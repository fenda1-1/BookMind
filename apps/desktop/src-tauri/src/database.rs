use crate::models::{
    DatabaseIndexMaintenancePayload, DatabaseVacuumPayload, SearchIndexPagePayload,
    SearchResultPayload, TextChunkRecord,
};
use crate::paths::fts_database_path;
use crate::search::locate_terms_in_chunk;
use rusqlite::{params, Connection};
use std::time::Duration;
use std::{fs, path::Path};
// OnceLock-ready boundary: schema initialization is centralized so the next step can reuse a cached connection or prepare_cached statements.

const SQLITE_BUSY_TIMEOUT: Duration = Duration::from_secs(5);

pub(crate) fn open_fts_database(data_dir: &Path) -> Result<Connection, String> {
    let path = fts_database_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建数据库目录 {}: {error}", parent.display()))?;
    }
    let connection = Connection::open(&path)
        .map_err(|error| format!("无法打开 SQLite 数据库 {}: {error}", path.display()))?;
    connection
        .busy_timeout(SQLITE_BUSY_TIMEOUT)
        .map_err(|error| format!("无法设置 SQLite busy timeout: {error}"))?;
    connection
        .execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA temp_store = MEMORY;
            PRAGMA cache_size = -8000;
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
                id UNINDEXED,
                book_id UNINDEXED,
                book_title UNINDEXED,
                chapter,
                ordinal UNINDEXED,
                text,
                chapter_index UNINDEXED,
                chapter_title UNINDEXED,
                paragraph_start UNINDEXED,
                paragraph_end UNINDEXED,
                char_start UNINDEXED,
                char_end UNINDEXED,
                content_hash UNINDEXED,
                chunk_strategy_version UNINDEXED,
                created_at UNINDEXED,
                tokenize = 'unicode61'
            );
            "#,
        )
        .map_err(|error| format!("无法初始化 SQLite/FTS5 索引: {error}"))?;
    Ok(connection)
}

pub(crate) fn ensure_fts_schema(data_dir: &Path) -> Result<(), String> {
    let mut connection = open_fts_database(data_dir)?;
    migrate_chunks_fts_schema(&mut connection)?;
    Ok(())
}

fn migrate_chunks_fts_schema(connection: &mut Connection) -> Result<(), String> {
    let has_ordinal = sqlite_table_has_column(connection, "chunks_fts", "ordinal")?;
    let has_chapter_index = sqlite_table_has_column(connection, "chunks_fts", "chapter_index")?;
    let has_chapter_title = sqlite_table_has_column(connection, "chunks_fts", "chapter_title")?;
    let has_paragraph_start = sqlite_table_has_column(connection, "chunks_fts", "paragraph_start")?;
    let has_paragraph_end = sqlite_table_has_column(connection, "chunks_fts", "paragraph_end")?;
    let has_char_start = sqlite_table_has_column(connection, "chunks_fts", "char_start")?;
    let has_char_end = sqlite_table_has_column(connection, "chunks_fts", "char_end")?;
    let has_content_hash = sqlite_table_has_column(connection, "chunks_fts", "content_hash")?;
    let has_strategy = sqlite_table_has_column(connection, "chunks_fts", "chunk_strategy_version")?;
    let has_created_at = sqlite_table_has_column(connection, "chunks_fts", "created_at")?;
    if has_ordinal
        && has_chapter_index
        && has_chapter_title
        && has_paragraph_start
        && has_paragraph_end
        && has_char_start
        && has_char_end
        && has_content_hash
        && has_strategy
        && has_created_at
    {
        return Ok(());
    }

    let mut existing_rows = Vec::new();
    {
        let mut statement = connection
            .prepare(
                r#"
                SELECT id, book_id, book_title, chapter,
                       rowid - 1 AS ordinal,
                       text,
                       0 AS chapter_index,
                       '' AS chapter_title,
                       0 AS paragraph_start,
                       0 AS paragraph_end,
                       0 AS char_start,
                       0 AS char_end,
                       '' AS content_hash,
                       0 AS chunk_strategy_version,
                       '' AS created_at
                FROM chunks_fts
                ORDER BY book_id, rowid
                "#,
            )
            .map_err(|error| format!("无法读取旧版 chunks_fts: {error}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok(TextChunkRecord {
                    id: row.get(0)?,
                    book_id: row.get(1)?,
                    book_title: row.get(2)?,
                    chapter: row.get(3)?,
                    ordinal: row.get::<_, i64>(4)? as usize,
                    text: row.get(5)?,
                    chapter_index: row.get::<_, i64>(6)? as usize,
                    chapter_title: row.get(7)?,
                    paragraph_start: row.get::<_, i64>(8)? as usize,
                    paragraph_end: row.get::<_, i64>(9)? as usize,
                    char_start: row.get::<_, i64>(10)? as usize,
                    char_end: row.get::<_, i64>(11)? as usize,
                    content_hash: row.get(12)?,
                    chunk_strategy_version: row.get::<_, i64>(13)? as u32,
                    created_at: row.get(14)?,
                })
            })
            .map_err(|error| format!("无法解析旧版 chunks_fts: {error}"))?;
        for row in rows {
            existing_rows
                .push(row.map_err(|error| format!("无法读取旧版 chunks_fts 行: {error}"))?);
        }
    }

    connection
        .execute_batch("DROP TABLE IF EXISTS chunks_fts;")
        .map_err(|error| format!("无法删除旧版 chunks_fts: {error}"))?;
    connection
        .execute_batch(
            r#"
            CREATE VIRTUAL TABLE chunks_fts USING fts5(
                id UNINDEXED,
                book_id UNINDEXED,
                book_title UNINDEXED,
                chapter,
                ordinal UNINDEXED,
                text,
                chapter_index UNINDEXED,
                chapter_title UNINDEXED,
                paragraph_start UNINDEXED,
                paragraph_end UNINDEXED,
                char_start UNINDEXED,
                char_end UNINDEXED,
                content_hash UNINDEXED,
                chunk_strategy_version UNINDEXED,
                created_at UNINDEXED,
                tokenize = 'unicode61'
            );
            "#,
        )
        .map_err(|error| format!("无法重建 chunks_fts: {error}"))?;

    let tx = connection
        .transaction()
        .map_err(|error| format!("无法开启 chunks_fts 迁移事务: {error}"))?;
    for chunk in existing_rows {
        tx.execute(
            r#"
            INSERT INTO chunks_fts (
                id, book_id, book_title, chapter, ordinal, text,
                chapter_index, chapter_title, paragraph_start, paragraph_end,
                char_start, char_end, content_hash, chunk_strategy_version, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
            "#,
            params![
                chunk.id,
                chunk.book_id,
                chunk.book_title,
                chunk.chapter,
                chunk.ordinal as i64,
                chunk.text,
                chunk.chapter_index as i64,
                chunk.chapter_title,
                chunk.paragraph_start as i64,
                chunk.paragraph_end as i64,
                chunk.char_start as i64,
                chunk.char_end as i64,
                chunk.content_hash,
                chunk.chunk_strategy_version as i64,
                chunk.created_at,
            ],
        )
        .map_err(|error| format!("无法迁移 chunks_fts 行: {error}"))?;
    }
    tx.commit()
        .map_err(|error| format!("无法提交 chunks_fts 迁移: {error}"))?;
    Ok(())
}

fn sqlite_table_has_column(
    connection: &Connection,
    table_name: &str,
    column_name: &str,
) -> Result<bool, String> {
    let mut statement = connection
        .prepare(&format!("PRAGMA table_info({table_name})"))
        .map_err(|error| format!("无法查询表结构 {table_name}: {error}"))?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("无法枚举表结构 {table_name}: {error}"))?;
    for row in rows {
        if row
            .map_err(|error| format!("无法读取表结构 {table_name}: {error}"))?
            .eq_ignore_ascii_case(column_name)
        {
            return Ok(true);
        }
    }
    Ok(false)
}

pub(crate) fn rebuild_sqlite_database_indexes_in(
    data_dir: &Path,
) -> Result<DatabaseIndexMaintenancePayload, String> {
    ensure_fts_schema(data_dir)?;
    let connection = open_fts_database(data_dir)?;
    connection
        .execute_batch(
            r#"
            REINDEX;
            ANALYZE;
            INSERT INTO chunks_fts(chunks_fts) VALUES('optimize');
            "#,
        )
        .map_err(|error| format!("无法重建 SQLite 数据库索引: {error}"))?;
    let chunk_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM chunks_fts", [], |row| row.get(0))
        .map_err(|error| format!("无法统计数据库 chunks_fts: {error}"))?;
    let fts_row_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM chunks_fts", [], |row| row.get(0))
        .map_err(|error| format!("无法统计数据库 FTS rows: {error}"))?;
    Ok(DatabaseIndexMaintenancePayload {
        database_path: fts_database_path(data_dir).display().to_string(),
        reindexed: true,
        analyzed: true,
        fts_optimized: true,
        chunk_count: chunk_count.max(0) as usize,
        fts_row_count: fts_row_count.max(0) as usize,
    })
}

pub(crate) fn vacuum_sqlite_database_in(data_dir: &Path) -> Result<DatabaseVacuumPayload, String> {
    ensure_fts_schema(data_dir)?;
    let database_path = fts_database_path(data_dir);
    let size_before = fs::metadata(&database_path)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    let connection = open_fts_database(data_dir)?;
    connection
        .execute_batch("VACUUM;")
        .map_err(|error| format!("无法执行 SQLite VACUUM: {error}"))?;
    let chunk_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM chunks_fts", [], |row| row.get(0))
        .map_err(|error| format!("无法统计 VACUUM 后 chunks_fts: {error}"))?;
    let fts_row_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM chunks_fts", [], |row| row.get(0))
        .map_err(|error| format!("无法统计 VACUUM 后 FTS rows: {error}"))?;
    let size_after = fs::metadata(&database_path)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    Ok(DatabaseVacuumPayload {
        database_path: database_path.display().to_string(),
        vacuumed: true,
        size_before_bytes: size_before,
        size_after_bytes: size_after,
        bytes_reclaimed: size_before.saturating_sub(size_after),
        chunk_count: chunk_count.max(0) as usize,
        fts_row_count: fts_row_count.max(0) as usize,
    })
}

pub(crate) fn save_chunks_to_fts(
    data_dir: &Path,
    book_id: &str,
    chunks: &[TextChunkRecord],
) -> Result<(), String> {
    save_chunks_to_fts_with_progress(data_dir, book_id, chunks, |_written_rows, _total_rows| {})
}

pub(crate) struct FtsChunkWriter {
    connection: Connection,
    staged_count: usize,
    total_rows: usize,
    progress_interval: usize,
    insert_sql: &'static str,
}

impl FtsChunkWriter {
    pub(crate) fn new(data_dir: &Path, book_id: &str, total_rows: usize) -> Result<Self, String> {
        ensure_fts_schema(data_dir)?;
        let connection = open_fts_database(data_dir)?;
        connection
            .execute_batch("BEGIN IMMEDIATE;")
            .map_err(|error| format!("无法开启 SQLite 索引事务: {error}"))?;
        connection
            .execute(
                "DELETE FROM chunks_fts WHERE book_id = ?1",
                params![book_id],
            )
            .map_err(|error| format!("无法清理 FTS chunks: {error}"))?;
        let progress_interval = (total_rows.max(1) / 100).max(25);
        Ok(Self {
            connection,
            staged_count: 0,
            total_rows: total_rows.max(1),
            progress_interval,
            insert_sql: r#"
            INSERT INTO chunks_fts (
                id, book_id, book_title, chapter, ordinal, text,
                chapter_index, chapter_title, paragraph_start, paragraph_end,
                char_start, char_end, content_hash, chunk_strategy_version, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
            "#,
        })
    }

    pub(crate) fn push(
        &mut self,
        chunk: &TextChunkRecord,
        on_progress: &mut impl FnMut(usize, usize),
    ) -> Result<(), String> {
        let mut stmt = self
            .connection
            .prepare_cached(self.insert_sql)
            .map_err(|error| format!("无法准备 SQLite FTS chunk 语句: {error}"))?;
        stmt.execute(params![
            chunk.id,
            chunk.book_id,
            chunk.book_title,
            chunk.chapter,
            chunk.ordinal as i64,
            chunk.text,
            chunk.chapter_index as i64,
            chunk.chapter_title,
            chunk.paragraph_start as i64,
            chunk.paragraph_end as i64,
            chunk.char_start as i64,
            chunk.char_end as i64,
            chunk.content_hash,
            chunk.chunk_strategy_version as i64,
            chunk.created_at,
        ])
        .map_err(|error| format!("无法写入 SQLite FTS chunk {}: {error}", chunk.id))?;
        self.staged_count += 1;
        if self.staged_count == self.total_rows || self.staged_count % self.progress_interval == 0 {
            on_progress(self.staged_count, self.total_rows);
        }
        Ok(())
    }

    pub(crate) fn finish(self) -> Result<usize, String> {
        self.connection
            .execute_batch("COMMIT;")
            .map_err(|error| format!("无法提交 SQLite 索引事务: {error}"))?;
        Ok(self.staged_count)
    }
}

pub(crate) fn save_chunks_to_fts_with_progress(
    data_dir: &Path,
    book_id: &str,
    chunks: &[TextChunkRecord],
    mut on_progress: impl FnMut(usize, usize),
) -> Result<(), String> {
    ensure_fts_schema(data_dir)?;
    let mut connection = open_fts_database(data_dir)?;
    let tx = connection
        .transaction()
        .map_err(|error| format!("无法开启 SQLite 索引事务: {error}"))?;
    let total_rows = chunks.len().max(1);
    let progress_interval = (total_rows / 100).max(25);
    tx.execute_batch(
        r#"
        CREATE TEMP TABLE IF NOT EXISTS temp_book_chunks (
            id TEXT PRIMARY KEY,
            book_id TEXT NOT NULL,
            book_title TEXT NOT NULL,
            chapter TEXT NOT NULL,
            ordinal INTEGER NOT NULL,
            text TEXT NOT NULL,
            chapter_index INTEGER NOT NULL,
            chapter_title TEXT NOT NULL,
            paragraph_start INTEGER NOT NULL,
            paragraph_end INTEGER NOT NULL,
            char_start INTEGER NOT NULL,
            char_end INTEGER NOT NULL,
            content_hash TEXT NOT NULL,
            chunk_strategy_version INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );
        DELETE FROM temp_book_chunks;
        "#,
    )
    .map_err(|error| format!("无法准备临时 chunks 表: {error}"))?;
    for (index, chunk) in chunks.iter().enumerate() {
        tx.execute(
            r#"
            INSERT INTO temp_book_chunks (
                id, book_id, book_title, chapter, ordinal, text,
                chapter_index, chapter_title, paragraph_start, paragraph_end,
                char_start, char_end, content_hash, chunk_strategy_version, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
            "#,
            params![
                chunk.id,
                chunk.book_id,
                chunk.book_title,
                chunk.chapter,
                chunk.ordinal as i64,
                chunk.text,
                chunk.chapter_index as i64,
                chunk.chapter_title,
                chunk.paragraph_start as i64,
                chunk.paragraph_end as i64,
                chunk.char_start as i64,
                chunk.char_end as i64,
                chunk.content_hash,
                chunk.chunk_strategy_version as i64,
                chunk.created_at,
            ],
        )
        .map_err(|error| format!("无法写入 SQLite FTS chunk {}: {error}", chunk.id))?;
        let written_rows = index + 1;
        if written_rows == chunks.len() || written_rows % progress_interval == 0 {
            on_progress(written_rows, total_rows);
        }
    }
    let staged_count: i64 = tx
        .query_row("SELECT COUNT(*) FROM temp_book_chunks", [], |row| {
            row.get(0)
        })
        .map_err(|error| format!("无法统计临时 chunks: {error}"))?;
    if staged_count != chunks.len() as i64 {
        return Err("临时 chunks 计数与写入数量不一致".to_string());
    }
    tx.execute(
        "DELETE FROM chunks_fts WHERE book_id = ?1",
        params![book_id],
    )
    .map_err(|error| format!("无法清理 FTS chunks: {error}"))?;
    tx.execute(
        r#"
        INSERT INTO chunks_fts (
            id, book_id, book_title, chapter, ordinal, text,
            chapter_index, chapter_title, paragraph_start, paragraph_end,
            char_start, char_end, content_hash, chunk_strategy_version, created_at
        )
        SELECT
            id, book_id, book_title, chapter, ordinal, text,
            chapter_index, chapter_title, paragraph_start, paragraph_end,
            char_start, char_end, content_hash, chunk_strategy_version, created_at
        FROM temp_book_chunks
        ORDER BY ordinal
        "#,
        [],
    )
    .map_err(|error| format!("无法写入正式 FTS chunks: {error}"))?;
    tx.commit()
        .map_err(|error| format!("无法提交 SQLite 索引事务: {error}"))
}

pub(crate) fn rewrite_book_fts_rows(
    data_dir: &Path,
    book_id: &str,
    chunks: &[TextChunkRecord],
) -> Result<usize, String> {
    ensure_fts_schema(data_dir)?;
    let book_chunks: Vec<&TextChunkRecord> = chunks
        .iter()
        .filter(|chunk| chunk.book_id == book_id)
        .collect();
    let mut connection = open_fts_database(data_dir)?;
    let tx = connection
        .transaction()
        .map_err(|error| format!("无法开启 FTS 修复事务: {error}"))?;
    tx.execute(
        "DELETE FROM chunks_fts WHERE book_id = ?1",
        params![book_id],
    )
    .map_err(|error| format!("无法清理 FTS rows: {error}"))?;
    for chunk in &book_chunks {
        tx.execute(
            r#"INSERT INTO chunks_fts (
                id, book_id, book_title, chapter, ordinal, text,
                chapter_index, chapter_title, paragraph_start, paragraph_end,
                char_start, char_end, content_hash, chunk_strategy_version, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)"#,
            params![
                chunk.id,
                chunk.book_id,
                chunk.book_title,
                chunk.chapter,
                chunk.ordinal as i64,
                chunk.text,
                chunk.chapter_index as i64,
                chunk.chapter_title,
                chunk.paragraph_start as i64,
                chunk.paragraph_end as i64,
                chunk.char_start as i64,
                chunk.char_end as i64,
                chunk.content_hash,
                chunk.chunk_strategy_version as i64,
                chunk.created_at,
            ],
        )
        .map_err(|error| format!("无法恢复 FTS chunk {}: {error}", chunk.id))?;
    }
    tx.commit()
        .map_err(|error| format!("无法提交 FTS 修复事务: {error}"))?;
    Ok(book_chunks.len())
}

pub(crate) fn load_book_chunks_from_fts(
    data_dir: &Path,
    book_id: &str,
) -> Result<Vec<TextChunkRecord>, String> {
    let path = fts_database_path(data_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    ensure_fts_schema(data_dir)?;
    let connection = open_fts_database(data_dir)?;
    let has_ordinal = sqlite_table_has_column(&connection, "chunks_fts", "ordinal")?;
    let sql = if has_ordinal {
        r#"
        SELECT id, book_id, book_title, chapter, ordinal, text,
               chapter_index, chapter_title, paragraph_start, paragraph_end,
               char_start, char_end, content_hash, chunk_strategy_version, created_at
        FROM chunks_fts
        WHERE book_id = ?1
        ORDER BY ordinal
        "#
    } else {
        r#"
        SELECT id, book_id, book_title, chapter,
               rowid - 1 AS ordinal,
               text,
               COALESCE(chapter_index, 0) AS chapter_index,
               COALESCE(chapter_title, '') AS chapter_title,
               COALESCE(paragraph_start, 0) AS paragraph_start,
               COALESCE(paragraph_end, 0) AS paragraph_end,
               COALESCE(char_start, 0) AS char_start,
               COALESCE(char_end, 0) AS char_end,
               COALESCE(content_hash, '') AS content_hash,
               COALESCE(chunk_strategy_version, 0) AS chunk_strategy_version,
               COALESCE(created_at, '') AS created_at
        FROM chunks_fts
        WHERE book_id = ?1
        ORDER BY rowid
        "#
    };
    let mut statement = connection
        .prepare(sql)
        .map_err(|error| format!("无法准备单书 chunks 查询: {error}"))?;
    let rows = statement
        .query_map(params![book_id], |row| {
            Ok(TextChunkRecord {
                id: row.get(0)?,
                book_id: row.get(1)?,
                book_title: row.get(2)?,
                chapter: row.get(3)?,
                ordinal: row.get::<_, i64>(4)? as usize,
                text: row.get(5)?,
                chapter_index: row.get::<_, i64>(6)? as usize,
                chapter_title: row.get(7)?,
                paragraph_start: row.get::<_, i64>(8)? as usize,
                paragraph_end: row.get::<_, i64>(9)? as usize,
                char_start: row.get::<_, i64>(10)? as usize,
                char_end: row.get::<_, i64>(11)? as usize,
                content_hash: row.get(12)?,
                chunk_strategy_version: row.get::<_, i64>(13)? as u32,
                created_at: row.get(14)?,
            })
        })
        .map_err(|error| format!("无法执行单书 chunks 查询: {error}"))?;

    let mut chunks = Vec::new();
    for row in rows {
        chunks.push(row.map_err(|error| format!("无法读取单书 chunk: {error}"))?);
    }
    Ok(chunks)
}

pub(crate) fn read_chunk_row(row: &rusqlite::Row<'_>) -> Result<TextChunkRecord, rusqlite::Error> {
    Ok(TextChunkRecord {
        id: row.get(0)?,
        book_id: row.get(1)?,
        book_title: row.get(2)?,
        chapter: row.get(3)?,
        ordinal: row.get::<_, i64>(4)? as usize,
        text: row.get(5)?,
        chapter_index: row.get::<_, i64>(6)? as usize,
        chapter_title: row.get(7)?,
        paragraph_start: row.get::<_, i64>(8)? as usize,
        paragraph_end: row.get::<_, i64>(9)? as usize,
        char_start: row.get::<_, i64>(10)? as usize,
        char_end: row.get::<_, i64>(11)? as usize,
        content_hash: row.get(12)?,
        chunk_strategy_version: row.get::<_, i64>(13)? as u32,
        created_at: row.get(14)?,
    })
}

pub(crate) fn load_all_chunks_from_fts(data_dir: &Path) -> Result<Vec<TextChunkRecord>, String> {
    let path = fts_database_path(data_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    ensure_fts_schema(data_dir)?;
    let connection = open_fts_database(data_dir)?;
    let has_ordinal = sqlite_table_has_column(&connection, "chunks_fts", "ordinal")?;
    let sql = if has_ordinal {
        r#"
        SELECT id, book_id, book_title, chapter, ordinal, text,
               chapter_index, chapter_title, paragraph_start, paragraph_end,
               char_start, char_end, content_hash, chunk_strategy_version, created_at
        FROM chunks_fts
        ORDER BY book_id, chapter_index, ordinal
        "#
    } else {
        r#"
        SELECT id, book_id, book_title, chapter,
               rowid - 1 AS ordinal,
               text,
               COALESCE(chapter_index, 0) AS chapter_index,
               COALESCE(chapter_title, '') AS chapter_title,
               COALESCE(paragraph_start, 0) AS paragraph_start,
               COALESCE(paragraph_end, 0) AS paragraph_end,
               COALESCE(char_start, 0) AS char_start,
               COALESCE(char_end, 0) AS char_end,
               COALESCE(content_hash, '') AS content_hash,
               COALESCE(chunk_strategy_version, 0) AS chunk_strategy_version,
               COALESCE(created_at, '') AS created_at
        FROM chunks_fts
        ORDER BY book_id, chapter_index, rowid
        "#
    };
    let mut statement = connection
        .prepare(sql)
        .map_err(|error| format!("无法准备全文 chunks 查询: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(TextChunkRecord {
                id: row.get(0)?,
                book_id: row.get(1)?,
                book_title: row.get(2)?,
                chapter: row.get(3)?,
                ordinal: row.get::<_, i64>(4)? as usize,
                text: row.get(5)?,
                chapter_index: row.get::<_, i64>(6)? as usize,
                chapter_title: row.get(7)?,
                paragraph_start: row.get::<_, i64>(8)? as usize,
                paragraph_end: row.get::<_, i64>(9)? as usize,
                char_start: row.get::<_, i64>(10)? as usize,
                char_end: row.get::<_, i64>(11)? as usize,
                content_hash: row.get(12)?,
                chunk_strategy_version: row.get::<_, i64>(13)? as u32,
                created_at: row.get(14)?,
            })
        })
        .map_err(|error| format!("无法执行全文 chunks 查询: {error}"))?;

    let mut chunks = Vec::new();
    for row in rows {
        chunks.push(row.map_err(|error| format!("无法读取全文 chunk: {error}"))?);
    }
    Ok(chunks)
}

pub(crate) fn load_book_chunks_page_from_fts(
    data_dir: &Path,
    book_id: &str,
    query: &str,
    chapter_index: Option<usize>,
    limit: usize,
    offset: usize,
) -> Result<(usize, Vec<TextChunkRecord>), String> {
    let path = fts_database_path(data_dir);
    if !path.exists() {
        return Ok((0, Vec::new()));
    }
    ensure_fts_schema(data_dir)?;
    let connection = open_fts_database(data_dir)?;
    let normalized = query.trim().to_lowercase();
    let chapter_index = chapter_index.map(|value| value as i64);
    let total = connection
        .query_row(
            r#"
            SELECT COUNT(*)
            FROM chunks_fts
            WHERE book_id = ?1
              AND (?2 IS NULL OR chapter_index = ?2)
              AND (
                    ?3 = ''
                 OR instr(lower(text), ?3) > 0
                 OR instr(lower(chapter_title), ?3) > 0
                 OR instr(lower(chapter), ?3) > 0
              )
            "#,
            params![book_id, chapter_index, normalized],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| format!("无法统计单书 chunks 预览结果: {error}"))?
        .max(0) as usize;
    if total == 0 {
        return Ok((0, Vec::new()));
    }
    let has_ordinal = sqlite_table_has_column(&connection, "chunks_fts", "ordinal")?;
    let sql = if has_ordinal {
        r#"
        SELECT id, book_id, book_title, chapter, ordinal, text,
               chapter_index, chapter_title, paragraph_start, paragraph_end,
               char_start, char_end, content_hash, chunk_strategy_version, created_at
        FROM chunks_fts
        WHERE book_id = ?1
          AND (?2 IS NULL OR chapter_index = ?2)
          AND (
                ?3 = ''
             OR instr(lower(text), ?3) > 0
             OR instr(lower(chapter_title), ?3) > 0
             OR instr(lower(chapter), ?3) > 0
          )
        ORDER BY chapter_index, ordinal
        LIMIT ?4 OFFSET ?5
        "#
    } else {
        r#"
        SELECT id, book_id, book_title, chapter,
               rowid - 1 AS ordinal,
               text,
               COALESCE(chapter_index, 0) AS chapter_index,
               COALESCE(chapter_title, '') AS chapter_title,
               COALESCE(paragraph_start, 0) AS paragraph_start,
               COALESCE(paragraph_end, 0) AS paragraph_end,
               COALESCE(char_start, 0) AS char_start,
               COALESCE(char_end, 0) AS char_end,
               COALESCE(content_hash, '') AS content_hash,
               COALESCE(chunk_strategy_version, 0) AS chunk_strategy_version,
               COALESCE(created_at, '') AS created_at
        FROM chunks_fts
        WHERE book_id = ?1
          AND (?2 IS NULL OR chapter_index = ?2)
          AND (
                ?3 = ''
             OR instr(lower(text), ?3) > 0
             OR instr(lower(chapter_title), ?3) > 0
             OR instr(lower(chapter), ?3) > 0
          )
        ORDER BY chapter_index, rowid
        LIMIT ?4 OFFSET ?5
        "#
    };
    let mut statement = connection
        .prepare(sql)
        .map_err(|error| format!("无法准备单书 chunks 预览查询: {error}"))?;
    let rows = statement
        .query_map(
            params![
                book_id,
                chapter_index,
                normalized,
                limit as i64,
                offset as i64
            ],
            read_chunk_row,
        )
        .map_err(|error| format!("无法执行单书 chunks 预览查询: {error}"))?;
    let mut chunks = Vec::new();
    for row in rows {
        chunks.push(row.map_err(|error| format!("无法读取单书 chunks 预览结果: {error}"))?);
    }
    Ok((total, chunks))
}

pub(crate) fn count_book_fts_rows(data_dir: &Path, book_id: &str) -> Result<usize, String> {
    let path = fts_database_path(data_dir);
    if !path.exists() {
        return Ok(0);
    }
    let connection = open_fts_database(data_dir)?;
    let count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM chunks_fts WHERE book_id = ?1",
            params![book_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("无法统计 FTS 行数: {error}"))?;
    Ok(count.max(0) as usize)
}

#[cfg(test)]
pub(crate) fn delete_book_fts_index_rows(data_dir: &Path, book_id: &str) -> Result<(), String> {
    let path = fts_database_path(data_dir);
    if !path.exists() {
        return Ok(());
    }
    let connection = open_fts_database(data_dir)?;
    connection
        .execute(
            "DELETE FROM chunks_fts WHERE book_id = ?1",
            params![book_id],
        )
        .map_err(|error| format!("无法删除 FTS rows: {error}"))?;
    Ok(())
}

pub(crate) fn delete_book_fts_rows(data_dir: &Path, book_id: &str) -> Result<(), String> {
    let path = fts_database_path(data_dir);
    if !path.exists() {
        return Ok(());
    }
    let mut connection = open_fts_database(data_dir)?;
    let tx = connection
        .transaction()
        .map_err(|error| format!("无法开启 SQLite 删除事务: {error}"))?;
    tx.execute(
        "DELETE FROM chunks_fts WHERE book_id = ?1",
        params![book_id],
    )
    .map_err(|error| format!("无法删除 FTS rows: {error}"))?;
    tx.commit()
        .map_err(|error| format!("无法提交 SQLite 删除事务: {error}"))
}

pub(crate) fn search_fts_index_page_payload(
    data_dir: &Path,
    query: &str,
    limit: usize,
    offset: usize,
    book_id: Option<&str>,
) -> Result<SearchIndexPagePayload, String> {
    let path = fts_database_path(data_dir);
    if !path.exists() {
        return Ok(SearchIndexPagePayload {
            query: query.to_string(),
            total: 0,
            limit,
            offset,
            results: Vec::new(),
        });
    }
    ensure_fts_schema(data_dir)?;
    let connection = open_fts_database(data_dir)?;
    let escaped = query
        .split_whitespace()
        .map(|term| format!("\"{}\"", term.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" ");
    if escaped.trim().is_empty() {
        return Ok(SearchIndexPagePayload {
            query: query.to_string(),
            total: 0,
            limit,
            offset,
            results: Vec::new(),
        });
    }
    let book_filter = book_id.map(str::trim).filter(|value| !value.is_empty());
    let total = match book_filter {
        Some(book_id) => connection
            .query_row(
                "SELECT COUNT(*) FROM chunks_fts WHERE chunks_fts MATCH ?1 AND book_id = ?2",
                params![&escaped, book_id],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| format!("无法统计 FTS 查询结果: {error}"))?,
        None => connection
            .query_row(
                "SELECT COUNT(*) FROM chunks_fts WHERE chunks_fts MATCH ?1",
                params![&escaped],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| format!("无法统计 FTS 查询结果: {error}"))?,
    }
    .max(0) as usize;
    if total == 0 {
        return Ok(SearchIndexPagePayload {
            query: query.to_string(),
            total,
            limit,
            offset,
            results: Vec::new(),
        });
    }
    let has_ordinal = sqlite_table_has_column(&connection, "chunks_fts", "ordinal")?;
    let sql = if has_ordinal && book_filter.is_some() {
        r#"
            SELECT chunks_fts.id, chunks_fts.book_id, chunks_fts.book_title, chunks_fts.chapter,
                   snippet(chunks_fts, 5, '', '', '…', 24) AS snippet,
                   rank,
                   chunks_fts.text AS full_text,
                   chunks_fts.chapter_index,
                   chunks_fts.chapter_title,
                   chunks_fts.paragraph_start,
                   chunks_fts.paragraph_end,
                   chunks_fts.char_start,
                   chunks_fts.char_end,
                   chunks_fts.content_hash,
                   chunks_fts.chunk_strategy_version,
                   chunks_fts.created_at
            FROM chunks_fts
            WHERE chunks_fts MATCH ?1 AND chunks_fts.book_id = ?4
            ORDER BY rank
            LIMIT ?2 OFFSET ?3
            "#
    } else if has_ordinal {
        r#"
            SELECT chunks_fts.id, chunks_fts.book_id, chunks_fts.book_title, chunks_fts.chapter,
                   snippet(chunks_fts, 5, '', '', '…', 24) AS snippet,
                   rank,
                   chunks_fts.text AS full_text,
                   chunks_fts.chapter_index,
                   chunks_fts.chapter_title,
                   chunks_fts.paragraph_start,
                   chunks_fts.paragraph_end,
                   chunks_fts.char_start,
                   chunks_fts.char_end,
                   chunks_fts.content_hash,
                   chunks_fts.chunk_strategy_version,
                   chunks_fts.created_at
            FROM chunks_fts
            WHERE chunks_fts MATCH ?1
            ORDER BY rank
            LIMIT ?2 OFFSET ?3
            "#
    } else if book_filter.is_some() {
        r#"
            SELECT chunks_fts.id, chunks_fts.book_id, chunks_fts.book_title, chunks_fts.chapter,
                   snippet(chunks_fts, 5, '', '', '…', 24) AS snippet,
                   rank,
                   chunks_fts.text AS full_text,
                   COALESCE(chunks_fts.chapter_index, 0) AS chapter_index,
                   COALESCE(chunks_fts.chapter_title, '') AS chapter_title,
                   COALESCE(chunks_fts.paragraph_start, 0) AS paragraph_start,
                   COALESCE(chunks_fts.paragraph_end, 0) AS paragraph_end,
                   COALESCE(chunks_fts.char_start, 0) AS char_start,
                   COALESCE(chunks_fts.char_end, 0) AS char_end,
                   COALESCE(chunks_fts.content_hash, '') AS content_hash,
                   COALESCE(chunks_fts.chunk_strategy_version, 0) AS chunk_strategy_version,
                   COALESCE(chunks_fts.created_at, '') AS created_at
            FROM chunks_fts
            WHERE chunks_fts MATCH ?1 AND chunks_fts.book_id = ?4
            ORDER BY rank
            LIMIT ?2 OFFSET ?3
            "#
    } else {
        r#"
            SELECT chunks_fts.id, chunks_fts.book_id, chunks_fts.book_title, chunks_fts.chapter,
                   snippet(chunks_fts, 5, '', '', '…', 24) AS snippet,
                   rank,
                   chunks_fts.text AS full_text,
                   COALESCE(chunks_fts.chapter_index, 0) AS chapter_index,
                   COALESCE(chunks_fts.chapter_title, '') AS chapter_title,
                   COALESCE(chunks_fts.paragraph_start, 0) AS paragraph_start,
                   COALESCE(chunks_fts.paragraph_end, 0) AS paragraph_end,
                   COALESCE(chunks_fts.char_start, 0) AS char_start,
                   COALESCE(chunks_fts.char_end, 0) AS char_end,
                   COALESCE(chunks_fts.content_hash, '') AS content_hash,
                   COALESCE(chunks_fts.chunk_strategy_version, 0) AS chunk_strategy_version,
                   COALESCE(chunks_fts.created_at, '') AS created_at
            FROM chunks_fts
            WHERE chunks_fts MATCH ?1
            ORDER BY rank
            LIMIT ?2 OFFSET ?3
            "#
    };
    let mut statement = connection
        .prepare(sql)
        .map_err(|error| format!("无法准备 FTS 查询: {error}"))?;
    let read_row = |row: &rusqlite::Row<'_>| {
        let rank: f64 = row.get(5)?;
        let text: String = row.get(6)?;
        let paragraph_start = row.get::<_, i64>(9)? as usize;
        let terms = query
            .trim()
            .to_lowercase()
            .split_whitespace()
            .map(str::to_string)
            .collect::<Vec<_>>();
        let (paragraph_index, start_offset, end_offset) = locate_terms_in_chunk(&text, &terms);
        Ok(SearchResultPayload {
            chunk_id: row.get(0)?,
            book_id: row.get(1)?,
            book_title: row.get(2)?,
            chapter: row.get(3)?,
            source_chapter_index: row.get::<_, i64>(7)? as usize,
            chapter_title: row.get(8)?,
            snippet: row.get(4)?,
            score: ((1.0 / (1.0 + rank.abs())) * 1000.0) as usize,
            paragraph_index: paragraph_start + paragraph_index,
            start_offset,
            end_offset,
        })
    };
    let rows = match book_filter {
        Some(book_id) => statement.query_map(
            params![&escaped, limit as i64, offset as i64, book_id],
            read_row,
        ),
        None => statement.query_map(params![&escaped, limit as i64, offset as i64], read_row),
    }
    .map_err(|error| format!("无法执行 FTS 查询: {error}"))?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|error| format!("无法读取 FTS 查询结果: {error}"))?);
    }
    Ok(SearchIndexPagePayload {
        query: query.to_string(),
        total,
        limit,
        offset,
        results,
    })
}
