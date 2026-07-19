use crate::database::{load_book_chunks_from_fts, load_book_chunks_page_from_fts};
use crate::models::{IndexedChunkPreviewItemPayload, IndexedChunksPreviewPayload, TextChunkRecord};
use crate::paths::chunk_file_path;
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    fs,
    io::{BufWriter, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const COMPACT_CHUNKS_SCHEMA: &str = "bookmind.text-chunks.compact.v1";
const SHARDED_CHUNKS_SCHEMA: &str = "bookmind.text-chunks.manifest.v1";
const CHUNK_BOOKS_DIR_NAME: &str = "books";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CompactChunkFile {
    schema: String,
    books: Vec<CompactChunkBookEntry>,
    chapters: Vec<CompactChunkChapterEntry>,
    chunks: Vec<CompactChunkEntry>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompactChunkBookEntry {
    id: String,
    title: String,
    content_hash: String,
    strategy_version: u32,
    created_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompactChunkChapterEntry {
    book: usize,
    chapter: String,
    title: String,
    index: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct CompactChunkEntry {
    id: String,
    b: usize,
    c: usize,
    o: usize,
    t: String,
    ps: usize,
    pe: usize,
    cs: usize,
    ce: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ShardedChunkManifestFile {
    schema: String,
    books: Vec<ShardedChunkManifestEntry>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ShardedChunkManifestEntry {
    pub(crate) book_id: String,
    pub(crate) file: String,
    pub(crate) chunk_count: usize,
}

pub(crate) fn load_chunk_records(data_dir: &Path) -> Result<Vec<TextChunkRecord>, String> {
    let path = chunk_file_path(data_dir);
    if !path.exists() {
        return load_chunk_records_from_shards(data_dir);
    }
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取全文索引 {}: {error}", path.display()))?;
    parse_chunk_records_json(data_dir, &raw)
        .map_err(|error| format!("无法解析全文索引 {}: {error}", path.display()))
}

pub(crate) fn save_chunk_records(
    data_dir: &Path,
    records: &[TextChunkRecord],
) -> Result<(), String> {
    prepare_chunk_records_commit(data_dir, records)?.commit()
}

pub(crate) fn save_book_chunk_records(
    data_dir: &Path,
    book_id: &str,
    records: &[TextChunkRecord],
) -> Result<(), String> {
    let mut writer = CompactChunkStreamWriter::new(data_dir, book_id)?;
    for record in records {
        writer.push(record)?;
    }
    writer.finish()
}

pub(crate) struct CompactChunkStreamWriter {
    path: PathBuf,
    temp_path: PathBuf,
    writer: BufWriter<fs::File>,
    books: Vec<CompactChunkBookEntry>,
    chapters: Vec<CompactChunkChapterEntry>,
    book_index: HashMap<(String, String, String, u32, String), usize>,
    chapter_index: HashMap<(usize, String, String, usize), usize>,
    first_chunk: bool,
    committed: bool,
}

impl CompactChunkStreamWriter {
    pub(crate) fn new(data_dir: &Path, book_id: &str) -> Result<Self, String> {
        let path = chunk_books_dir(data_dir).join(chunk_book_file_name(book_id));
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!("无法创建按书全文索引目录 {}: {error}", parent.display())
            })?;
        }
        let temp_path = unique_chunk_temp_path(&path);
        let file = fs::File::create(&temp_path).map_err(|error| {
            format!(
                "无法写入按书全文索引临时文件 {}: {error}",
                temp_path.display()
            )
        })?;
        let mut writer = BufWriter::new(file);
        writer
            .write_all(b"{\"schema\":\"")
            .and_then(|_| writer.write_all(COMPACT_CHUNKS_SCHEMA.as_bytes()))
            .and_then(|_| writer.write_all(b"\",\"chunks\":["))
            .map_err(|error| {
                format!(
                    "无法初始化按书全文索引临时文件 {}: {error}",
                    temp_path.display()
                )
            })?;
        Ok(Self {
            path,
            temp_path,
            writer,
            books: Vec::new(),
            chapters: Vec::new(),
            book_index: HashMap::new(),
            chapter_index: HashMap::new(),
            first_chunk: true,
            committed: false,
        })
    }

    pub(crate) fn push(&mut self, record: &TextChunkRecord) -> Result<(), String> {
        let book_key = (
            record.book_id.clone(),
            record.book_title.clone(),
            record.content_hash.clone(),
            record.chunk_strategy_version,
            record.created_at.clone(),
        );
        let b = *self.book_index.entry(book_key.clone()).or_insert_with(|| {
            let next = self.books.len();
            self.books.push(CompactChunkBookEntry {
                id: book_key.0.clone(),
                title: book_key.1.clone(),
                content_hash: book_key.2.clone(),
                strategy_version: book_key.3,
                created_at: book_key.4.clone(),
            });
            next
        });
        let chapter_key = (
            b,
            record.chapter.clone(),
            record.chapter_title.clone(),
            record.chapter_index,
        );
        let c = *self
            .chapter_index
            .entry(chapter_key.clone())
            .or_insert_with(|| {
                let next = self.chapters.len();
                self.chapters.push(CompactChunkChapterEntry {
                    book: chapter_key.0,
                    chapter: chapter_key.1.clone(),
                    title: chapter_key.2.clone(),
                    index: chapter_key.3,
                });
                next
            });
        if !self.first_chunk {
            self.writer
                .write_all(b",")
                .map_err(|error| format!("无法写入按书全文索引 chunk 分隔符: {error}"))?;
        }
        self.first_chunk = false;
        serde_json::to_writer(
            &mut self.writer,
            &CompactChunkEntry {
                id: record.id.clone(),
                b,
                c,
                o: record.ordinal,
                t: record.text.clone(),
                ps: record.paragraph_start,
                pe: record.paragraph_end,
                cs: record.char_start,
                ce: record.char_end,
            },
        )
        .map_err(|error| format!("无法写入按书全文索引 chunk: {error}"))?;
        Ok(())
    }

    pub(crate) fn finish(mut self) -> Result<(), String> {
        self.writer
            .write_all(b"],\"books\":")
            .and_then(|_| {
                serde_json::to_writer(&mut self.writer, &self.books).map_err(std::io::Error::other)
            })
            .and_then(|_| self.writer.write_all(b",\"chapters\":"))
            .and_then(|_| {
                serde_json::to_writer(&mut self.writer, &self.chapters)
                    .map_err(std::io::Error::other)
            })
            .and_then(|_| self.writer.write_all(b"}"))
            .and_then(|_| self.writer.flush())
            .map_err(|error| {
                format!(
                    "无法完成按书全文索引临时文件 {}: {error}",
                    self.temp_path.display()
                )
            })?;
        fs::rename(&self.temp_path, &self.path)
            .map_err(|error| format!("无法替换按书全文索引 {}: {error}", self.path.display()))?;
        self.committed = true;
        Ok(())
    }
}

impl Drop for CompactChunkStreamWriter {
    fn drop(&mut self) {
        if !self.committed && self.temp_path.exists() {
            let _ = fs::remove_file(&self.temp_path);
        }
    }
}

pub(crate) struct ChunkRecordsCommit {
    operations: Vec<ChunkRecordsCommitOperation>,
    cleanup_paths: Vec<PathBuf>,
}

pub(crate) struct ChunkRecordsCommitOperation {
    path: PathBuf,
    temp_path: PathBuf,
}

impl ChunkRecordsCommit {
    pub(crate) fn commit(self) -> Result<(), String> {
        for operation in &self.operations {
            fs::rename(&operation.temp_path, &operation.path).map_err(|error| {
                format!("无法替换全文索引 {}: {error}", operation.path.display())
            })?;
        }
        for cleanup_path in &self.cleanup_paths {
            if cleanup_path.exists() {
                let _ = fs::remove_file(cleanup_path);
            }
        }
        Ok(())
    }
}

impl Drop for ChunkRecordsCommit {
    fn drop(&mut self) {
        for operation in &self.operations {
            if operation.temp_path.exists() {
                let _ = fs::remove_file(&operation.temp_path);
            }
        }
    }
}

pub(crate) fn prepare_chunk_records_commit(
    data_dir: &Path,
    records: &[TextChunkRecord],
) -> Result<ChunkRecordsCommit, String> {
    let path = chunk_file_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建索引目录 {}: {error}", parent.display()))?;
    }
    let books_dir = chunk_books_dir(data_dir);
    fs::create_dir_all(&books_dir)
        .map_err(|error| format!("无法创建按书全文索引目录 {}: {error}", books_dir.display()))?;
    let mut operations = Vec::new();
    let mut manifest_entries = Vec::new();
    for (book_id, book_records) in group_chunk_records_by_book(records) {
        let file_name = chunk_book_file_name(&book_id);
        let book_path = books_dir.join(&file_name);
        let compact = compact_chunk_records(&book_records);
        let raw = serde_json::to_string_pretty(&compact)
            .map_err(|error| format!("无法序列化按书全文索引 {book_id}: {error}"))?;
        let temp_path = unique_chunk_temp_path(&book_path);
        fs::write(&temp_path, raw).map_err(|error| {
            format!(
                "无法写入按书全文索引临时文件 {}: {error}",
                temp_path.display()
            )
        })?;
        manifest_entries.push(ShardedChunkManifestEntry {
            book_id,
            file: file_name,
            chunk_count: book_records.len(),
        });
        operations.push(ChunkRecordsCommitOperation {
            path: book_path,
            temp_path,
        });
    }
    let manifest = ShardedChunkManifestFile {
        schema: SHARDED_CHUNKS_SCHEMA.to_string(),
        books: manifest_entries,
    };
    let raw = serde_json::to_string_pretty(&manifest)
        .map_err(|error| format!("无法序列化全文索引 manifest: {error}"))?;
    let temp_path = unique_chunk_temp_path(&path);
    fs::write(&temp_path, raw).map_err(|error| {
        format!(
            "无法写入全文索引 manifest 临时文件 {}: {error}",
            temp_path.display()
        )
    })?;
    operations.push(ChunkRecordsCommitOperation { path, temp_path });
    let active_files: HashSet<String> = manifest
        .books
        .iter()
        .map(|entry| entry.file.clone())
        .collect();
    let cleanup_paths = stale_chunk_book_files(&books_dir, &active_files)?;
    Ok(ChunkRecordsCommit {
        operations,
        cleanup_paths,
    })
}

pub(crate) fn parse_chunk_records_json(
    data_dir: &Path,
    raw: &str,
) -> Result<Vec<TextChunkRecord>, String> {
    let value: serde_json::Value =
        serde_json::from_str(raw).map_err(|error| format!("JSON 格式错误: {error}"))?;
    if value.is_array() {
        return serde_json::from_value(value)
            .map_err(|error| format!("旧版 chunks 格式错误: {error}"));
    }
    if value
        .get("schema")
        .and_then(|item| item.as_str())
        .is_some_and(|schema| schema == COMPACT_CHUNKS_SCHEMA)
    {
        let compact: CompactChunkFile = serde_json::from_value(value)
            .map_err(|error| format!("紧凑 chunks 格式错误: {error}"))?;
        return expand_compact_chunk_records(compact);
    }
    if value
        .get("schema")
        .and_then(|item| item.as_str())
        .is_some_and(|schema| schema == SHARDED_CHUNKS_SCHEMA)
    {
        let manifest: ShardedChunkManifestFile = serde_json::from_value(value)
            .map_err(|error| format!("按书 chunks manifest 格式错误: {error}"))?;
        return load_sharded_chunk_records(data_dir, &manifest);
    }
    Err("未知 chunks 文件格式".to_string())
}

fn load_sharded_chunk_records(
    data_dir: &Path,
    manifest: &ShardedChunkManifestFile,
) -> Result<Vec<TextChunkRecord>, String> {
    let books_dir = chunk_books_dir(data_dir);
    let mut records = Vec::new();
    for entry in &manifest.books {
        let path = books_dir.join(&entry.file);
        let raw = fs::read_to_string(&path)
            .map_err(|error| format!("无法读取按书全文索引 {}: {error}", path.display()))?;
        let mut book_records = parse_chunk_records_json(data_dir, &raw)?;
        records.append(&mut book_records);
    }
    Ok(records)
}

pub(crate) fn load_chunk_manifest_entries(
    data_dir: &Path,
) -> Result<Option<Vec<ShardedChunkManifestEntry>>, String> {
    let path = chunk_file_path(data_dir);
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取全文索引 {}: {error}", path.display()))?;
    let value: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|error| format!("无法解析全文索引 {}: {error}", path.display()))?;
    if value
        .get("schema")
        .and_then(|item| item.as_str())
        .is_some_and(|schema| schema == SHARDED_CHUNKS_SCHEMA)
    {
        let manifest: ShardedChunkManifestFile = serde_json::from_value(value)
            .map_err(|error| format!("按书 chunks manifest 格式错误: {error}"))?;
        return Ok(Some(manifest.books));
    }
    Ok(None)
}

fn load_chunk_records_from_shards(data_dir: &Path) -> Result<Vec<TextChunkRecord>, String> {
    let books_dir = chunk_books_dir(data_dir);
    if !books_dir.exists() {
        return Ok(Vec::new());
    }
    let mut records = Vec::new();
    for entry in fs::read_dir(&books_dir)
        .map_err(|error| format!("无法读取按书全文索引目录 {}: {error}", books_dir.display()))?
    {
        let entry = entry.map_err(|error| format!("无法读取按书全文索引目录项: {error}"))?;
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let is_chunk_file = path
            .file_name()
            .and_then(|value| value.to_str())
            .is_some_and(|name| name.ends_with(".chunks.json"));
        if !is_chunk_file {
            continue;
        }
        let raw = fs::read_to_string(&path)
            .map_err(|error| format!("无法读取按书全文索引 {}: {error}", path.display()))?;
        let mut book_records = parse_chunk_records_json(data_dir, &raw)?;
        records.append(&mut book_records);
    }
    Ok(records)
}

fn group_chunk_records_by_book(records: &[TextChunkRecord]) -> Vec<(String, Vec<TextChunkRecord>)> {
    let mut order = Vec::new();
    let mut grouped = HashMap::<String, Vec<TextChunkRecord>>::new();
    for record in records {
        if !grouped.contains_key(&record.book_id) {
            order.push(record.book_id.clone());
        }
        grouped
            .entry(record.book_id.clone())
            .or_default()
            .push(record.clone());
    }
    order
        .into_iter()
        .filter_map(|book_id| grouped.remove(&book_id).map(|records| (book_id, records)))
        .collect()
}

pub(crate) fn chunk_books_dir(data_dir: &Path) -> PathBuf {
    chunk_file_path(data_dir)
        .parent()
        .map(|parent| parent.join(CHUNK_BOOKS_DIR_NAME))
        .unwrap_or_else(|| {
            data_dir
                .join("indexes")
                .join("bm25")
                .join(CHUNK_BOOKS_DIR_NAME)
        })
}

fn chunk_book_file_name(book_id: &str) -> String {
    let safe = book_id
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_') {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>();
    format!("{safe}.chunks.json")
}

fn stale_chunk_book_files(
    books_dir: &Path,
    active_files: &HashSet<String>,
) -> Result<Vec<PathBuf>, String> {
    if !books_dir.exists() {
        return Ok(Vec::new());
    }
    let mut stale = Vec::new();
    for entry in fs::read_dir(books_dir)
        .map_err(|error| format!("无法读取按书全文索引目录 {}: {error}", books_dir.display()))?
    {
        let entry = entry.map_err(|error| format!("无法读取按书全文索引目录项: {error}"))?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.ends_with(".chunks.json") && !active_files.contains(&file_name) {
            stale.push(entry.path());
        }
    }
    Ok(stale)
}

pub(crate) fn compact_chunk_records(records: &[TextChunkRecord]) -> CompactChunkFile {
    let mut books = Vec::new();
    let mut book_index = HashMap::<(String, String, String, u32, String), usize>::new();
    let mut chapters = Vec::new();
    let mut chapter_index = HashMap::<(usize, String, String, usize), usize>::new();
    let chunks = records
        .iter()
        .map(|record| {
            let book_key = (
                record.book_id.clone(),
                record.book_title.clone(),
                record.content_hash.clone(),
                record.chunk_strategy_version,
                record.created_at.clone(),
            );
            let b = *book_index.entry(book_key.clone()).or_insert_with(|| {
                let next = books.len();
                books.push(CompactChunkBookEntry {
                    id: book_key.0.clone(),
                    title: book_key.1.clone(),
                    content_hash: book_key.2.clone(),
                    strategy_version: book_key.3,
                    created_at: book_key.4.clone(),
                });
                next
            });
            let chapter_key = (
                b,
                record.chapter.clone(),
                record.chapter_title.clone(),
                record.chapter_index,
            );
            let c = *chapter_index.entry(chapter_key.clone()).or_insert_with(|| {
                let next = chapters.len();
                chapters.push(CompactChunkChapterEntry {
                    book: chapter_key.0,
                    chapter: chapter_key.1.clone(),
                    title: chapter_key.2.clone(),
                    index: chapter_key.3,
                });
                next
            });
            CompactChunkEntry {
                id: record.id.clone(),
                b,
                c,
                o: record.ordinal,
                t: record.text.clone(),
                ps: record.paragraph_start,
                pe: record.paragraph_end,
                cs: record.char_start,
                ce: record.char_end,
            }
        })
        .collect();
    CompactChunkFile {
        schema: COMPACT_CHUNKS_SCHEMA.to_string(),
        books,
        chapters,
        chunks,
    }
}

fn expand_compact_chunk_records(compact: CompactChunkFile) -> Result<Vec<TextChunkRecord>, String> {
    compact
        .chunks
        .into_iter()
        .map(|chunk| {
            let book = compact
                .books
                .get(chunk.b)
                .ok_or_else(|| format!("紧凑 chunks 引用了不存在的 book 索引 {}", chunk.b))?;
            let chapter = compact
                .chapters
                .get(chunk.c)
                .ok_or_else(|| format!("紧凑 chunks 引用了不存在的 chapter 索引 {}", chunk.c))?;
            if chapter.book != chunk.b {
                return Err(format!(
                    "紧凑 chunks chapter/book 不匹配：chunk={} book={} chapter_book={}",
                    chunk.id, chunk.b, chapter.book
                ));
            }
            Ok(TextChunkRecord {
                id: chunk.id,
                book_id: book.id.clone(),
                book_title: book.title.clone(),
                chapter: chapter.chapter.clone(),
                ordinal: chunk.o,
                text: chunk.t,
                chapter_index: chapter.index,
                chapter_title: chapter.title.clone(),
                paragraph_start: chunk.ps,
                paragraph_end: chunk.pe,
                char_start: chunk.cs,
                char_end: chunk.ce,
                content_hash: book.content_hash.clone(),
                chunk_strategy_version: book.strategy_version,
                created_at: book.created_at.clone(),
            })
        })
        .collect()
}

fn unique_chunk_temp_path(path: &Path) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let thread_id = format!("{:?}", std::thread::current().id())
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect::<String>();
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("chunks.json");
    path.with_file_name(format!(
        "{file_name}.{}.{}.{}.tmp",
        std::process::id(),
        thread_id,
        nonce
    ))
}

pub(crate) fn load_book_chunk_records(
    data_dir: &Path,
    book_id: &str,
) -> Result<Vec<TextChunkRecord>, String> {
    let sqlite_chunks = load_book_chunks_from_fts(data_dir, book_id)?;
    if !sqlite_chunks.is_empty() {
        return Ok(sqlite_chunks);
    }
    let direct_path = chunk_books_dir(data_dir).join(chunk_book_file_name(book_id));
    if direct_path.exists() {
        let raw = fs::read_to_string(&direct_path)
            .map_err(|error| format!("无法读取按书全文索引 {}: {error}", direct_path.display()))?;
        return parse_chunk_records_json(data_dir, &raw);
    }
    if let Some(entries) = load_chunk_manifest_entries(data_dir)? {
        let books_dir = chunk_books_dir(data_dir);
        if let Some(entry) = entries.iter().find(|entry| entry.book_id == book_id) {
            let path = books_dir.join(&entry.file);
            let raw = fs::read_to_string(&path)
                .map_err(|error| format!("无法读取按书全文索引 {}: {error}", path.display()))?;
            return parse_chunk_records_json(data_dir, &raw);
        }
        return Ok(Vec::new());
    }
    let manifest_path = chunk_file_path(data_dir);
    if !manifest_path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&manifest_path)
        .map_err(|error| format!("无法读取全文索引 {}: {error}", manifest_path.display()))?;
    let all = parse_chunk_records_json(data_dir, &raw)?;
    Ok(all
        .into_iter()
        .filter(|chunk| chunk.book_id == book_id)
        .collect())
}

pub(crate) fn delete_book_chunk_records(data_dir: &Path, book_id: &str) -> Result<(), String> {
    let direct_path = chunk_books_dir(data_dir).join(chunk_book_file_name(book_id));
    if direct_path.exists() {
        let _ = fs::remove_file(&direct_path);
    }
    let path = chunk_file_path(data_dir);
    if !path.exists() {
        return Ok(());
    }
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取全文索引 {}: {error}", path.display()))?;
    let value: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|error| format!("无法解析全文索引 {}: {error}", path.display()))?;
    if value
        .get("schema")
        .and_then(|item| item.as_str())
        .is_some_and(|schema| schema == SHARDED_CHUNKS_SCHEMA)
    {
        let mut manifest: ShardedChunkManifestFile = serde_json::from_value(value)
            .map_err(|error| format!("按书 chunks manifest 格式错误: {error}"))?;
        let books_dir = chunk_books_dir(data_dir);
        if let Some(pos) = manifest
            .books
            .iter()
            .position(|entry| entry.book_id == book_id)
        {
            let entry = manifest.books.remove(pos);
            let _ = fs::remove_file(books_dir.join(&entry.file));
            let raw = serde_json::to_string_pretty(&manifest)
                .map_err(|error| format!("无法序列化全文索引 manifest: {error}"))?;
            let temp_path = unique_chunk_temp_path(&path);
            fs::write(&temp_path, raw).map_err(|error| {
                format!(
                    "无法写入全文索引 manifest 临时文件 {}: {error}",
                    temp_path.display()
                )
            })?;
            fs::rename(&temp_path, &path)
                .map_err(|error| format!("无法替换全文索引 {}: {error}", path.display()))?;
        }
        return Ok(());
    }
    let mut records = parse_chunk_records_json(data_dir, &raw)?;
    records.retain(|chunk| chunk.book_id != book_id);
    save_chunk_records(data_dir, &records)
}

pub(crate) fn get_indexed_chunks_preview_in(
    data_dir: &Path,
    book_id: &str,
    limit: usize,
    offset: usize,
    query: &str,
    chapter_index: Option<usize>,
) -> Result<IndexedChunksPreviewPayload, String> {
    let normalized_query = query.trim().to_lowercase();
    let clamped_limit = limit.clamp(1, 100);
    let (total, chunks) = load_book_chunks_page_from_fts(
        data_dir,
        book_id,
        &normalized_query,
        chapter_index,
        clamped_limit,
        offset,
    )?;
    if total > 0 {
        let items = chunks.into_iter().map(indexed_chunk_preview_item).collect();
        return Ok(IndexedChunksPreviewPayload {
            book_id: book_id.to_string(),
            total,
            limit: clamped_limit,
            offset,
            items,
        });
    }
    let mut chunks = load_book_chunk_records(data_dir, book_id)?;
    chunks.sort_by(|left, right| {
        left.chapter_index
            .cmp(&right.chapter_index)
            .then_with(|| left.ordinal.cmp(&right.ordinal))
    });
    let filtered: Vec<TextChunkRecord> = chunks
        .into_iter()
        .filter(|chunk| chapter_index.map_or(true, |index| chunk.chapter_index == index))
        .filter(|chunk| {
            normalized_query.is_empty()
                || chunk.text.to_lowercase().contains(&normalized_query)
                || chunk
                    .chapter_title
                    .to_lowercase()
                    .contains(&normalized_query)
                || chunk.chapter.to_lowercase().contains(&normalized_query)
        })
        .collect();
    let total = filtered.len();
    let items = filtered
        .into_iter()
        .skip(offset)
        .take(clamped_limit)
        .map(indexed_chunk_preview_item)
        .collect();
    Ok(IndexedChunksPreviewPayload {
        book_id: book_id.to_string(),
        total,
        limit: clamped_limit,
        offset,
        items,
    })
}

fn indexed_chunk_preview_item(chunk: TextChunkRecord) -> IndexedChunkPreviewItemPayload {
    let chapter_title = if chunk.chapter_title.trim().is_empty() {
        chunk.chapter.clone()
    } else {
        chunk.chapter_title.clone()
    };
    IndexedChunkPreviewItemPayload {
        chunk_id: chunk.id,
        ordinal: chunk.ordinal,
        chapter_index: chunk.chapter_index,
        chapter_title,
        paragraph_start: chunk.paragraph_start,
        paragraph_end: chunk.paragraph_end,
        paragraph_range: format!("{}-{}", chunk.paragraph_start, chunk.paragraph_end),
        char_start: chunk.char_start,
        char_end: chunk.char_end,
        source_chapter_index: chunk.chapter_index,
        paragraph_index: chunk.paragraph_start,
        start_offset: 0,
        end_offset: chunk.text.chars().count(),
        char_count: chunk.text.chars().count(),
        text_preview: truncate_chunk_preview(&chunk.text, 32),
        full_text: chunk.text,
        reader_location: format!(
            "reader://{}/{}/{}?start={}&end={}",
            chunk.book_id,
            chunk.chapter_index,
            chunk.paragraph_start,
            chunk.char_start,
            chunk.char_end
        ),
    }
}

fn truncate_chunk_preview(value: &str, max_chars: usize) -> String {
    let mut preview: String = value.chars().take(max_chars).collect();
    if value.chars().count() > max_chars {
        preview.push('…');
    }
    preview
}
