use crate::models::{VectorIndexBuildPayload, VectorSearchPayload};
use std::path::Path;

mod chunk_storage;
mod chunking;
mod local_ai;
mod query;

#[cfg(test)]
pub(crate) use chunking::split_text_into_chunks;
#[allow(unused_imports)]
pub(crate) use chunking::{
    split_text_into_chunks_with_cancel, split_text_into_chunks_with_line_provider_cancel_and_visit,
    split_text_into_chunks_with_options_and_cancel,
    split_text_into_chunks_with_options_cancel_and_progress,
    split_text_into_chunks_with_options_cancel_and_visit, IndexChunkingOptions,
};

#[allow(unused_imports)]
pub(crate) use chunk_storage::{
    chunk_books_dir, compact_chunk_records, delete_book_chunk_records,
    get_indexed_chunks_preview_in, load_book_chunk_records, load_chunk_manifest_entries,
    load_chunk_records, parse_chunk_records_json, prepare_chunk_records_commit,
    save_book_chunk_records, save_chunk_records, ChunkRecordsCommit, ChunkRecordsCommitOperation,
    CompactChunkFile, CompactChunkStreamWriter, ShardedChunkManifestEntry,
};
pub(crate) use local_ai::{
    answer_from_ai_request_in, answer_from_local_index_in, cancel_local_ai_request,
};
#[allow(unused_imports)]
pub(crate) use query::{search_index_in, search_index_page_in, search_index_page_payload_in};

const SIDECAR_NOT_CONFIGURED: &str = "not-configured";
const VECTOR_INDEX_NOT_BUILT: &str = "not-built";
const VECTOR_UNAVAILABLE_MESSAGE: &str =
    "Python sidecar is not configured; vector index build/read commands are staged only.";

pub(crate) fn build_vector_index_in(
    _data_dir: &Path,
    book_id: &str,
) -> Result<VectorIndexBuildPayload, String> {
    Ok(VectorIndexBuildPayload {
        ok: false,
        book_id: book_id.to_string(),
        sidecar_status: SIDECAR_NOT_CONFIGURED.to_string(),
        vector_index_status: VECTOR_INDEX_NOT_BUILT.to_string(),
        indexed_chunk_count: 0,
        message: VECTOR_UNAVAILABLE_MESSAGE.to_string(),
    })
}

pub(crate) fn search_vector_index_in(
    _data_dir: &Path,
    query: &str,
    _limit: usize,
) -> Result<VectorSearchPayload, String> {
    Ok(VectorSearchPayload {
        ok: false,
        query: query.to_string(),
        sidecar_status: SIDECAR_NOT_CONFIGURED.to_string(),
        vector_index_status: VECTOR_INDEX_NOT_BUILT.to_string(),
        results: Vec::new(),
        message: VECTOR_UNAVAILABLE_MESSAGE.to_string(),
    })
}

pub(crate) fn locate_terms_in_chunk(text: &str, terms: &[String]) -> (usize, usize, usize) {
    let lower = text.to_lowercase();
    let Some((byte_index, term_len)) = terms
        .iter()
        .filter_map(|term| lower.find(term).map(|index| (index, term.len())))
        .min_by_key(|(index, _)| *index)
    else {
        return (0, 0, 0);
    };
    let mut paragraph_index = 0usize;
    let mut paragraph_start_byte = 0usize;
    for (index, ch) in text.char_indices() {
        if index >= byte_index {
            break;
        }
        if ch == '\n' {
            paragraph_index += 1;
            paragraph_start_byte = index + ch.len_utf8();
        }
    }
    let start_offset = text[paragraph_start_byte..byte_index].chars().count();
    let end_offset = start_offset
        + text[byte_index..byte_index + term_len.min(text.len() - byte_index)]
            .chars()
            .count();
    (paragraph_index, start_offset, end_offset)
}

pub(crate) fn snippet_around_query(text: &str, terms: &[String]) -> String {
    let lower = text.to_lowercase();
    let first_match = terms
        .iter()
        .filter_map(|term| lower.find(term).or_else(|| text.find(term)))
        .min()
        .unwrap_or(0);
    let before_match: Vec<usize> = text
        .char_indices()
        .map(|(index, _)| index)
        .take_while(|index| *index <= first_match)
        .collect();
    let start = before_match.iter().rev().nth(40).copied().unwrap_or(0);
    text[start..].chars().take(160).collect()
}
