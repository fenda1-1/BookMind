use super::super::{extract_character_index_in, CHARACTER_INDEX_VERSION};
use crate::library::save_library_records;
use crate::models::{
    BookIndexManifest, BookRecord, CharacterAliasRecord, CharacterCenterPayload,
    CharacterEventRecord, CharacterIndexManifestRecord, CharacterLocationRecord,
    CharacterProfileRecord, TaskStatusPayload, TextChunkRecord,
};
use crate::search::save_chunk_records;
use crate::tasks::{save_index_manifest, TaskProgressEventSink};
use std::collections::HashSet;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex,
};
use std::time::{SystemTime, UNIX_EPOCH};

static TEMP_DIR_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Default)]
pub(super) struct RecordingTaskProgressSink {
    pub(super) events: Mutex<Vec<(String, TaskStatusPayload)>>,
}

impl TaskProgressEventSink for RecordingTaskProgressSink {
    fn emit_task_progress(&self, reason: &str, status: &TaskStatusPayload) {
        self.events
            .lock()
            .expect("progress events should lock")
            .push((reason.to_string(), status.clone()));
    }
}
pub(super) fn character_test_book(id: &str, title: &str, cover_tone: &str) -> BookRecord {
    BookRecord {
        id: id.to_string(),
        title: title.to_string(),
        display_title: title.to_string(),
        author: "本地导入".to_string(),
        format: "TXT".to_string(),
        status: "已导入".to_string(),
        progress: 0,
        file_name: format!("{id}.txt"),
        file_path: format!("E:/books/{id}.txt"),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "人".to_string(),
        cover_tone: cover_tone.to_string(),
        deleted: false,
        deleted_at: String::new(),
        content_hash: format!("{id}-hash"),
        imported_at: "1781100000000".to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    }
}

pub(super) fn ready_character_manifest(
    book: &BookRecord,
    text_index_content_hash: &str,
    chunk_strategy_version: u32,
    chapter_rule_version: u32,
) -> CharacterIndexManifestRecord {
    CharacterIndexManifestRecord {
        schema_version: "bookmind.character.index.v1".to_string(),
        book_id: book.id.clone(),
        book_title: book.display_title.clone(),
        content_hash: book.content_hash.clone(),
        text_index_content_hash: text_index_content_hash.to_string(),
        index_version: CHARACTER_INDEX_VERSION,
        chunk_strategy_version,
        chapter_rule_version,
        status: "ready".to_string(),
        extraction_mode: "rule".to_string(),
        built_at: "1781100000000".to_string(),
        updated_at: "1781100000000".to_string(),
        stale_reason: String::new(),
        last_error: String::new(),
        character_count: 2,
        alias_count: 2,
        mention_count: 4,
        relation_count: 0,
        evidence_count: 4,
        event_count: 0,
        faction_count: 0,
        source_text_index: Default::default(),
    }
}

pub(super) fn character_test_location(book: &BookRecord, index: usize) -> CharacterLocationRecord {
    CharacterLocationRecord {
        book_id: book.id.clone(),
        chapter_id: format!("chapter-{index}"),
        chapter_index: index,
        source_chapter_index: index,
        visible_chapter_position: index + 1,
        chapter_title: format!("第 {} 章", index + 1),
        paragraph_index: index,
        paragraph_start: index,
        paragraph_end: index + 1,
        start_offset: 0,
        end_offset: 2,
        chunk_id: format!("chunk-{index}"),
    }
}

pub(super) fn character_test_profile(book: &BookRecord, index: usize) -> CharacterProfileRecord {
    let location = character_test_location(book, index);
    let character_id = format!("character-large-{index}");
    CharacterProfileRecord {
        id: character_id.clone(),
        book_id: book.id.clone(),
        canonical_name: format!("人物{index}"),
        display_name: format!("人物{index}"),
        kind: "person".to_string(),
        role: "unknown".to_string(),
        gender: "unknown".to_string(),
        aliases: vec![CharacterAliasRecord {
            id: format!("{character_id}-alias-main"),
            book_id: book.id.clone(),
            character_id,
            name: format!("人物{index}"),
            normalized_name: format!("人物{index}"),
            kind: "name".to_string(),
            source: "rule".to_string(),
            confidence: 0.7,
            mention_count: 1,
            first_seen: location.clone(),
            created_at: "1781100000000".to_string(),
            updated_at: "1781100000000".to_string(),
        }],
        summary: "测试人物".to_string(),
        tags: Vec::new(),
        importance_score: 1.0,
        confidence: 0.7,
        first_appearance: location.clone(),
        last_appearance: location,
        mention_count: 1,
        relation_count: 0,
        event_count: 0,
        faction_memberships: Vec::new(),
        hidden: false,
        merged_into_character_id: String::new(),
        source: "rule".to_string(),
        created_at: "1781100000000".to_string(),
        updated_at: "1781100000000".to_string(),
    }
}

pub(super) fn extract_character_payload_for_test(
    book_id: &str,
    book_title: &str,
    text: String,
) -> CharacterCenterPayload {
    let dir = unique_temp_library_dir();
    let book = character_test_book(book_id, book_title, "sage");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: book.content_hash.clone(),
            status: "ready".to_string(),
            built_at: "1781100001000".to_string(),
            index_version: 1,
            chunk_strategy_version: 1,
            chapter_rule_version: 1,
            chunk_count: 1,
            fts_row_count: 1,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");
    let char_end = text.chars().count();
    save_chunk_records(
        &dir,
        &[TextChunkRecord {
            id: format!("{book_id}-chunk-1"),
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            chapter: "第一章".to_string(),
            ordinal: 0,
            text,
            chapter_index: 0,
            chapter_title: "第一章".to_string(),
            paragraph_start: 0,
            paragraph_end: 1,
            char_start: 0,
            char_end,
            content_hash: format!("{book_id}-chunk-hash-1"),
            chunk_strategy_version: 1,
            created_at: "1781100002000".to_string(),
        }],
    )
    .expect("chunks should save");

    extract_character_index_in(&dir, &book.id).expect("character index should build")
}

pub(super) fn payload_profile_names(payload: &CharacterCenterPayload) -> HashSet<&str> {
    payload
        .profiles
        .iter()
        .map(|profile| profile.canonical_name.as_str())
        .collect()
}

pub(super) fn character_test_event(
    book: &BookRecord,
    id: &str,
    character_id: &str,
    evidence_ids: Vec<String>,
) -> CharacterEventRecord {
    let location = character_test_location(book, 0);
    CharacterEventRecord {
        id: id.to_string(),
        book_id: book.id.clone(),
        title: "测试事件".to_string(),
        summary: "测试事件摘要".to_string(),
        event_type: "appearance".to_string(),
        participant_character_ids: vec![character_id.to_string()],
        chapter_label: location.chapter_title.clone(),
        location,
        evidence_ids,
        confidence: 0.8,
        source: "rule".to_string(),
        created_at: "1781100000000".to_string(),
        updated_at: "1781100000000".to_string(),
    }
}

pub(super) fn han_test_name(index: usize) -> String {
    let left = char::from_u32(0x4E00 + (index / 200) as u32).unwrap_or('安');
    let right = char::from_u32(0x4E00 + (index % 200) as u32).unwrap_or('乙');
    format!("安{left}{right}")
}

pub(super) fn unique_temp_library_dir() -> std::path::PathBuf {
    let counter = TEMP_DIR_COUNTER.fetch_add(1, Ordering::Relaxed);
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let dir = std::env::temp_dir().join(format!(
        "bookmind-character-test-{}-{timestamp}-{counter}",
        std::process::id()
    ));
    std::fs::create_dir_all(&dir).expect("temp dir should be created");
    dir
}
