use super::{
    chunk_books_dir, load_book_chunk_records, load_chunk_manifest_entries, locate_terms_in_chunk,
    parse_chunk_records_json, snippet_around_query,
};
use crate::database::{
    ensure_fts_schema, open_fts_database, read_chunk_row, search_fts_index_page_payload,
};
use crate::models::{SearchIndexPagePayload, SearchResultPayload, TextChunkRecord};
use crate::paths::fts_database_path;
use rusqlite::params;
use std::{cmp::Ordering, fs, path::Path};

pub(crate) fn search_index_page_in(
    data_dir: &Path,
    query: &str,
    limit: usize,
    offset: usize,
) -> Result<Vec<SearchResultPayload>, String> {
    Ok(search_index_page_payload_in(data_dir, query, limit, offset, None)?.results)
}

pub(crate) fn search_index_page_payload_in(
    data_dir: &Path,
    query: &str,
    limit: usize,
    offset: usize,
    book_id: Option<&str>,
) -> Result<SearchIndexPagePayload, String> {
    let normalized = query.trim().to_lowercase();
    if normalized.is_empty() {
        return Ok(SearchIndexPagePayload {
            query: query.trim().to_string(),
            total: 0,
            limit: 0,
            offset,
            results: Vec::new(),
        });
    }
    let clamped_limit = limit.clamp(1, 500);
    if !should_use_literal_chunk_search(&normalized) {
        let fts_page =
            search_fts_index_page_payload(data_dir, &normalized, clamped_limit, offset, book_id)?;
        if fts_page.total > 0 {
            return Ok(fts_page);
        }
    }
    let terms = literal_search_terms(&normalized);
    let book_filter = book_id.map(str::trim).filter(|value| !value.is_empty());
    let keep_count = offset.saturating_add(clamped_limit);
    let mut collector = LiteralSearchCollector::new(keep_count);
    if let Some(book_id) = book_filter {
        collect_literal_search_candidates_from_book(data_dir, book_id, &terms, &mut collector)?;
    } else if let Some(entries) = load_chunk_manifest_entries(data_dir)? {
        if entries.is_empty() {
            collect_literal_search_candidates_from_fts(data_dir, &terms, &mut collector)?;
        } else {
            let books_dir = chunk_books_dir(data_dir);
            for entry in entries {
                let path = books_dir.join(&entry.file);
                let raw = fs::read_to_string(&path)
                    .map_err(|error| format!("无法读取按书全文索引 {}: {error}", path.display()))?;
                collect_literal_search_candidates_from_json(
                    data_dir,
                    &raw,
                    &terms,
                    &mut collector,
                )?;
            }
        }
    } else {
        collect_literal_search_candidates_from_fts(data_dir, &terms, &mut collector)?;
    }
    let total = collector.total_matches;
    let mut results = collector.into_sorted_results();
    results.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then_with(|| a.book_title.cmp(&b.book_title))
            .then_with(|| a.chunk_id.cmp(&b.chunk_id))
    });
    let results = results
        .into_iter()
        .skip(offset)
        .take(clamped_limit)
        .collect();
    Ok(SearchIndexPagePayload {
        query: query.trim().to_string(),
        total,
        limit: clamped_limit,
        offset,
        results,
    })
}

#[derive(Debug)]
struct LiteralSearchCollector {
    keep_count: usize,
    total_matches: usize,
    items: Vec<LiteralSearchCandidate>,
}

impl LiteralSearchCollector {
    fn new(keep_count: usize) -> Self {
        Self {
            keep_count,
            total_matches: 0,
            items: Vec::new(),
        }
    }

    fn consider(&mut self, chunk: TextChunkRecord, terms: &[String]) {
        let haystack = format!("{}\n{}", chunk.chapter, chunk.text).to_lowercase();
        let score = terms
            .iter()
            .filter(|term| haystack.contains(term.as_str()))
            .count();
        if score == 0 {
            return;
        }
        self.total_matches = self.total_matches.saturating_add(1);
        if self.keep_count == 0 {
            return;
        }
        let snippet = snippet_around_query(&format!("{}\n{}", chunk.chapter, chunk.text), terms);
        let (paragraph_index, start_offset, end_offset) = locate_terms_in_chunk(&chunk.text, terms);
        let candidate = LiteralSearchCandidate {
            score,
            book_title: chunk.book_title.clone(),
            chunk_id: chunk.id.clone(),
            result: SearchResultPayload {
                chunk_id: chunk.id,
                book_id: chunk.book_id,
                book_title: chunk.book_title,
                chapter: chunk.chapter,
                source_chapter_index: chunk.chapter_index,
                chapter_title: chunk.chapter_title,
                snippet,
                score,
                paragraph_index: chunk.paragraph_start + paragraph_index,
                start_offset,
                end_offset,
            },
        };
        self.items.push(candidate);
        if self.items.len() > self.keep_count {
            self.items.sort_by(|a, b| {
                a.score
                    .cmp(&b.score)
                    .then_with(|| b.book_title.cmp(&a.book_title))
                    .then_with(|| b.chunk_id.cmp(&a.chunk_id))
            });
            let _ = self.items.remove(0);
        }
    }

    fn into_sorted_results(self) -> Vec<SearchResultPayload> {
        let mut items = self.items;
        items.sort_by(|a, b| {
            b.score
                .cmp(&a.score)
                .then_with(|| a.book_title.cmp(&b.book_title))
                .then_with(|| a.chunk_id.cmp(&b.chunk_id))
        });
        items.into_iter().map(|item| item.result).collect()
    }
}

fn collect_literal_search_candidates_from_book(
    data_dir: &Path,
    book_id: &str,
    terms: &[String],
    collector: &mut LiteralSearchCollector,
) -> Result<(), String> {
    let path = fts_database_path(data_dir);
    if path.exists() {
        ensure_fts_schema(data_dir)?;
        let connection = open_fts_database(data_dir)?;
        let mut statement = connection
            .prepare(
                r#"
                SELECT id, book_id, book_title, chapter, ordinal, text,
                       chapter_index, chapter_title, paragraph_start, paragraph_end,
                       char_start, char_end, content_hash, chunk_strategy_version, created_at
                FROM chunks_fts
                WHERE book_id = ?1
                ORDER BY chapter_index, ordinal
                "#,
            )
            .map_err(|error| format!("无法准备单书字面搜索查询: {error}"))?;
        let rows = statement
            .query_map(params![book_id], read_chunk_row)
            .map_err(|error| format!("无法执行单书字面搜索查询: {error}"))?;
        for row in rows {
            collector.consider(
                row.map_err(|error| format!("无法读取单书字面搜索结果: {error}"))?,
                terms,
            );
        }
        return Ok(());
    }
    for chunk in load_book_chunk_records(data_dir, book_id)? {
        collector.consider(chunk, terms);
    }
    Ok(())
}

fn collect_literal_search_candidates_from_json(
    data_dir: &Path,
    raw: &str,
    terms: &[String],
    collector: &mut LiteralSearchCollector,
) -> Result<(), String> {
    for chunk in parse_chunk_records_json(data_dir, raw)? {
        collector.consider(chunk, terms);
    }
    Ok(())
}

fn collect_literal_search_candidates_from_fts(
    data_dir: &Path,
    terms: &[String],
    collector: &mut LiteralSearchCollector,
) -> Result<(), String> {
    let path = fts_database_path(data_dir);
    if !path.exists() {
        return Ok(());
    }
    ensure_fts_schema(data_dir)?;
    let connection = open_fts_database(data_dir)?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, book_id, book_title, chapter, ordinal, text,
                   chapter_index, chapter_title, paragraph_start, paragraph_end,
                   char_start, char_end, content_hash, chunk_strategy_version, created_at
            FROM chunks_fts
            ORDER BY book_id, chapter_index, ordinal
            "#,
        )
        .map_err(|error| format!("无法准备全文字面搜索查询: {error}"))?;
    let rows = statement
        .query_map([], read_chunk_row)
        .map_err(|error| format!("无法执行全文字面搜索查询: {error}"))?;
    for row in rows {
        collector.consider(
            row.map_err(|error| format!("无法读取全文字面搜索结果: {error}"))?,
            terms,
        );
    }
    Ok(())
}

#[derive(Debug)]
struct LiteralSearchCandidate {
    score: usize,
    book_title: String,
    chunk_id: String,
    result: SearchResultPayload,
}

impl PartialEq for LiteralSearchCandidate {
    fn eq(&self, other: &Self) -> bool {
        self.score == other.score
            && self.book_title == other.book_title
            && self.chunk_id == other.chunk_id
    }
}

impl Eq for LiteralSearchCandidate {}

impl PartialOrd for LiteralSearchCandidate {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for LiteralSearchCandidate {
    fn cmp(&self, other: &Self) -> Ordering {
        self.score
            .cmp(&other.score)
            .then_with(|| self.book_title.cmp(&other.book_title))
            .then_with(|| self.chunk_id.cmp(&other.chunk_id))
    }
}

fn should_use_literal_chunk_search(query: &str) -> bool {
    let trimmed = query.trim();
    !trimmed.is_empty() && trimmed.chars().any(is_cjk_char)
}

fn is_cjk_char(ch: char) -> bool {
    matches!(ch, '\u{3400}'..='\u{9fff}' | '\u{f900}'..='\u{faff}')
}

fn literal_search_terms(query: &str) -> Vec<String> {
    let mut terms = Vec::new();
    let mut current = String::new();
    for ch in query.chars() {
        if ch.is_whitespace() || is_search_term_separator(ch) {
            push_literal_search_term(&mut terms, &mut current);
        } else {
            current.push(ch);
        }
    }
    push_literal_search_term(&mut terms, &mut current);
    if terms.is_empty() && !query.trim().is_empty() {
        terms.push(query.trim().to_string());
    }
    terms
}

fn push_literal_search_term(terms: &mut Vec<String>, current: &mut String) {
    let term = current.trim();
    if !term.is_empty() && !terms.iter().any(|existing| existing == term) {
        terms.push(term.to_string());
    }
    current.clear();
}

fn is_search_term_separator(ch: char) -> bool {
    ch.is_ascii_punctuation()
        || matches!(
            ch,
            '，' | '。'
                | '、'
                | '：'
                | '；'
                | '！'
                | '？'
                | '“'
                | '”'
                | '‘'
                | '’'
                | '（'
                | '）'
                | '《'
                | '》'
                | '【'
                | '】'
                | '…'
                | '—'
        )
}

pub(crate) fn search_index_in(
    data_dir: &Path,
    query: &str,
) -> Result<Vec<SearchResultPayload>, String> {
    search_index_page_in(data_dir, query, 20, 0)
}
