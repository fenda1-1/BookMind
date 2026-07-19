use super::fixtures::{character_test_book, unique_temp_library_dir, RecordingTaskProgressSink};
use crate::characters::{
    build_character_book_summary, extract_character_index_in, load_character_center_payload_in,
    queue_character_extraction_in, MAX_MENTIONS_PER_CHARACTER, MENTION_CONTEXT_CHARS,
};
use crate::library::save_library_records;
use crate::models::{BookIndexManifest, TaskKind, TaskRunStatus, TaskStage, TextChunkRecord};
use crate::paths::character_book_dir;
use crate::search::save_chunk_records;
use crate::tasks::{run_parse_and_index_tasks_with_events_in, save_index_manifest};
use std::fs;

#[test]
fn character_extraction_builds_first_appearance_events_and_appearance_stats() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-events", "人物事件", "sage");
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
            chunk_count: 2,
            fts_row_count: 2,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");
    save_chunk_records(
        &dir,
        &[
            TextChunkRecord {
                id: "event-chunk-1".to_string(),
                book_id: book.id.clone(),
                book_title: book.display_title.clone(),
                chapter: "第一章 初见".to_string(),
                ordinal: 0,
                text: "林七夜说道，李医生点头。林七夜看向窗外。".to_string(),
                chapter_index: 0,
                chapter_title: "第一章 初见".to_string(),
                paragraph_start: 0,
                paragraph_end: 1,
                char_start: 0,
                char_end: 24,
                content_hash: "event-chunk-hash-1".to_string(),
                chunk_strategy_version: 1,
                created_at: "1781100002000".to_string(),
            },
            TextChunkRecord {
                id: "event-chunk-2".to_string(),
                book_id: book.id.clone(),
                book_title: book.display_title.clone(),
                chapter: "第二章 回声".to_string(),
                ordinal: 1,
                text: "赵空城保护林七夜，李医生沉默。".to_string(),
                chapter_index: 1,
                chapter_title: "第二章 回声".to_string(),
                paragraph_start: 2,
                paragraph_end: 3,
                char_start: 25,
                char_end: 44,
                content_hash: "event-chunk-hash-2".to_string(),
                chunk_strategy_version: 1,
                created_at: "1781100003000".to_string(),
            },
        ],
    )
    .expect("chunks should save");

    let payload = extract_character_index_in(&dir, &book.id)
        .expect("character index should build events and appearance stats");
    assert_eq!(payload.manifest.event_count, payload.events.len());
    assert!(payload.events.len() >= 3);
    assert!(payload.events.iter().all(|event| {
        event.event_type == "appearance"
            && event.title.contains("首次出场")
            && event.chapter_label.starts_with("第")
            && !event.participant_character_ids.is_empty()
            && !event.evidence_ids.is_empty()
            && event.summary.contains("首次出场")
    }));
    let lin = payload
        .profiles
        .iter()
        .find(|profile| profile.canonical_name == "林七夜")
        .expect("林七夜 should be profiled");
    assert!(payload.events.iter().any(|event| {
        event.participant_character_ids.contains(&lin.id)
            && event.location.chapter_index == 0
            && event.evidence_ids.iter().any(|id| {
                payload
                    .evidence
                    .iter()
                    .any(|evidence| evidence.id == *id && evidence.target_type == "mention")
            })
    }));
    let lin_chapter_stats: Vec<_> = payload
        .appearance_stats
        .iter()
        .filter(|stat| stat.character_id == lin.id)
        .collect();
    assert_eq!(lin_chapter_stats.len(), 2);
    assert!(lin_chapter_stats.iter().any(|stat| stat.chapter_index == 0
        && stat.source_chapter_index == 0
        && stat.mention_count == 2
        && stat.evidence_count == 2
        && stat.first_paragraph_index == 0
        && stat.last_paragraph_index == 0
        && (stat.heat - 2.0).abs() < f32::EPSILON));
    assert!(lin_chapter_stats.iter().any(|stat| stat.chapter_index == 1
        && stat.source_chapter_index == 1
        && stat.mention_count == 1
        && stat.evidence_count == 1
        && (stat.heat - 1.0).abs() < f32::EPSILON));

    let events_path = character_book_dir(&dir, &book.id).join("events.json");
    let raw_events: Vec<serde_json::Value> =
        serde_json::from_str(&fs::read_to_string(events_path).expect("events file"))
            .expect("events json should parse");
    assert_eq!(raw_events.len(), payload.events.len());
    let first_raw_event = raw_events
        .first()
        .expect("events file should contain items");
    assert!(first_raw_event.get("participantCharacterIds").is_some());
    assert!(first_raw_event.get("characterIds").is_none());
    assert_eq!(
        first_raw_event
            .get("eventType")
            .and_then(|item| item.as_str()),
        Some("appearance")
    );
}

#[test]
fn character_extraction_counts_all_mentions_while_capping_saved_evidence_samples() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-mention-counts", "人物计数", "sage");
    let total_mentions = MAX_MENTIONS_PER_CHARACTER + 25;
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
    let text = (0..total_mentions)
        .map(|_| "林七夜说道。")
        .collect::<Vec<_>>()
        .join("");
    save_chunk_records(
        &dir,
        &[TextChunkRecord {
            id: "mention-counts-chunk-1".to_string(),
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            chapter: "第一章 高频出场".to_string(),
            ordinal: 0,
            char_end: text.chars().count(),
            text,
            chapter_index: 0,
            chapter_title: "第一章 高频出场".to_string(),
            paragraph_start: 0,
            paragraph_end: total_mentions,
            char_start: 0,
            content_hash: "mention-counts-hash-1".to_string(),
            chunk_strategy_version: 1,
            created_at: "1781100002000".to_string(),
        }],
    )
    .expect("chunks should save");

    let payload = extract_character_index_in(&dir, &book.id)
        .expect("character extraction should count all mentions");
    let profile = payload
        .profiles
        .iter()
        .find(|profile| profile.canonical_name == "林七夜")
        .expect("林七夜 should be profiled");

    assert_eq!(profile.mention_count, total_mentions);
    assert_eq!(profile.aliases[0].mention_count, total_mentions);
    assert_eq!(payload.manifest.mention_count, total_mentions);
    assert_eq!(
        payload
            .mentions
            .iter()
            .filter(|mention| mention.character_id == profile.id)
            .count(),
        MAX_MENTIONS_PER_CHARACTER
    );
    let stat = payload
        .appearance_stats
        .iter()
        .find(|stat| stat.character_id == profile.id && stat.chapter_index == 0)
        .expect("林七夜 should have chapter appearance stats");
    assert_eq!(stat.mention_count, total_mentions);
    assert_eq!(stat.evidence_count, MAX_MENTIONS_PER_CHARACTER);
    assert!((stat.heat - total_mentions as f32).abs() < f32::EPSILON);
}

#[test]
fn character_extraction_avoids_overbroad_typed_relation_words() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-relation-negatives", "关系负例", "sage");
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
    save_chunk_records(
        &dir,
        &[TextChunkRecord {
            id: "relation-negative-chunk-1".to_string(),
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            chapter: "第一章 负例".to_string(),
            ordinal: 0,
            text: "林七夜的问题让李医生沉默。王老师说道，林七夜正在观察赵空城。".to_string(),
            chapter_index: 0,
            chapter_title: "第一章 负例".to_string(),
            paragraph_start: 0,
            paragraph_end: 1,
            char_start: 0,
            char_end: 40,
            content_hash: "relation-negative-hash-1".to_string(),
            chunk_strategy_version: 1,
            created_at: "1781100002000".to_string(),
        }],
    )
    .expect("chunks should save");

    let payload = extract_character_index_in(&dir, &book.id)
        .expect("character index should build from negative relation sample");
    assert!(
        !payload
            .relations
            .iter()
            .any(|relation| relation.relation_type == "asks"),
        "nominal word 问题 must not become an asks relation"
    );
    assert!(
        !payload
            .relations
            .iter()
            .any(|relation| relation.relation_type == "teacher"),
        "title-like name 王老师 must not create teacher relation without A 是 B 的老师"
    );
    assert!(payload.mentions.iter().all(|mention| {
        mention.prefix_text.chars().count() <= MENTION_CONTEXT_CHARS
            && mention.suffix_text.chars().count() <= MENTION_CONTEXT_CHARS
    }));
}

#[test]
fn character_extraction_task_runs_through_task_center_and_writes_index() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-task", "人物任务", "amber");
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
    save_chunk_records(
        &dir,
        &[TextChunkRecord {
            id: "character-task-chunk".to_string(),
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            chapter: "第一章".to_string(),
            ordinal: 0,
            text: "林七夜问道，李医生点头。赵空城说道，林七夜沉默。".to_string(),
            chapter_index: 0,
            chapter_title: "第一章".to_string(),
            paragraph_start: 0,
            paragraph_end: 1,
            char_start: 0,
            char_end: 30,
            content_hash: "character-task-chunk-hash".to_string(),
            chunk_strategy_version: 1,
            created_at: "1781100002000".to_string(),
        }],
    )
    .expect("chunks should save");

    let queued =
        queue_character_extraction_in(&dir, &book.id).expect("character task should queue");
    assert_eq!(queued.kind, TaskKind::CHARACTER_EXTRACTION);
    assert_eq!(queued.status, TaskRunStatus::QUEUED);
    assert!(!queued.created_at.is_empty());
    assert_eq!(queued.updated_at, queued.created_at);
    let duplicate = queue_character_extraction_in(&dir, &book.id)
        .expect("duplicate active character extraction should reuse existing task");
    assert_eq!(duplicate.id, queued.id);

    let sink = RecordingTaskProgressSink::default();
    let tasks = run_parse_and_index_tasks_with_events_in(&dir, &sink)
        .expect("task runner should execute character extraction");
    let completed = tasks
        .iter()
        .find(|task| task.id == queued.id)
        .expect("queued character task should remain in queue");
    assert_eq!(completed.kind, TaskKind::CHARACTER_EXTRACTION);
    assert_eq!(completed.status, TaskRunStatus::SUCCEEDED);
    assert_eq!(completed.stage, TaskStage::DONE);
    assert_eq!(completed.progress, 100.0);
    assert!(completed.output_summary.chunks >= 1);
    assert!(completed.output_summary.warnings.is_empty());

    let payload = load_character_center_payload_in(&dir, &book.id)
        .expect("character task should persist character payload");
    assert!(payload.manifest.character_count >= 3);
    assert!(payload
        .profiles
        .iter()
        .any(|profile| profile.canonical_name == "林七夜"));

    let events = sink.events.lock().expect("events should lock");
    assert!(events.iter().any(|(reason, status)| {
        reason == "task-started"
            && status.id == queued.id
            && status.kind == TaskKind::CHARACTER_EXTRACTION
    }));
    assert!(events.iter().any(|(reason, status)| {
        reason == "task-completed" && status.id == queued.id && status.progress == 100.0
    }));
}

#[test]
fn character_extraction_failure_writes_failed_manifest_and_summary_diagnostics() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-failure", "人物失败", "violet");
    save_library_records(&dir, &[book.clone()]).expect("library should save");

    let queued =
        queue_character_extraction_in(&dir, &book.id).expect("character task should queue");
    let sink = RecordingTaskProgressSink::default();
    let tasks = run_parse_and_index_tasks_with_events_in(&dir, &sink)
        .expect("task runner should mark character extraction failed");
    let failed = tasks
        .iter()
        .find(|task| task.id == queued.id)
        .expect("queued character task should remain in queue");
    assert_eq!(failed.status, TaskRunStatus::FAILED);
    assert_eq!(
        failed.error_code,
        crate::models::TaskErrorCode::CHARACTER_INDEX_MISSING_TEXT_INDEX
    );

    let payload = load_character_center_payload_in(&dir, &book.id)
        .expect("failed character task should write a readable payload");
    assert_eq!(payload.manifest.status, "failed");
    assert_eq!(payload.book.character_index_status, "failed");
    assert_eq!(payload.book.last_task_id, queued.id);
    assert_eq!(
        payload.book.error_code,
        crate::models::TaskErrorCode::CHARACTER_INDEX_MISSING_TEXT_INDEX
    );
    assert!(payload.book.last_error.contains("全文索引"));
    assert_eq!(payload.profiles.len(), 0);
    assert_eq!(payload.mentions.len(), 0);

    let summary = build_character_book_summary(&dir, &book, None);
    assert_eq!(summary.character_index_status, "failed");
    assert_eq!(summary.last_task_id, failed.id);
    assert_eq!(
        summary.error_code,
        crate::models::TaskErrorCode::CHARACTER_INDEX_MISSING_TEXT_INDEX
    );
}
