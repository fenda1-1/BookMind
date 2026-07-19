use super::fixtures::{
    character_test_book, han_test_name, ready_character_manifest, unique_temp_library_dir,
};
use crate::characters::{
    build_character_book_summary, extract_character_index_in, save_character_outputs,
    MAX_EVIDENCE_PER_RELATION,
};
use crate::library::{move_book_to_trash_in, permanently_delete_book_in, save_library_records};
use crate::models::{
    BookIndexManifest, TaskKind, TaskRecord, TaskRunStatus, TaskStage, TextChunkRecord,
};
use crate::paths::character_book_dir;
use crate::search::save_chunk_records;
use crate::tasks::{save_index_manifest, save_task_records};
use std::fs;

#[test]
fn character_extraction_keeps_all_generated_relations_and_bounds_evidence_per_relation() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-many-relations", "大量人物关系", "sage");
    const MANY_RELATION_PROFILE_COUNT: usize = 2_200;
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
            chunk_count: MANY_RELATION_PROFILE_COUNT,
            fts_row_count: MANY_RELATION_PROFILE_COUNT,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");
    let names: Vec<String> = (0..MANY_RELATION_PROFILE_COUNT)
        .map(han_test_name)
        .collect();
    let chunks: Vec<TextChunkRecord> = (0..MANY_RELATION_PROFILE_COUNT)
        .map(|index| {
            let window_names: Vec<String> = (0..8)
                .map(|slot| names[(index + slot) % names.len()].clone())
                .collect();
            TextChunkRecord {
                id: format!("many-relation-chunk-{index}"),
                book_id: book.id.clone(),
                book_title: book.display_title.clone(),
                chapter: format!("第 {} 章", index + 1),
                ordinal: index,
                text: window_names
                    .iter()
                    .map(|name| format!("{name}说道。"))
                    .collect::<Vec<_>>()
                    .join(""),
                chapter_index: index,
                chapter_title: format!("第 {} 章", index + 1),
                paragraph_start: index,
                paragraph_end: index + 1,
                char_start: 0,
                char_end: 80,
                content_hash: format!("many-relation-hash-{index}"),
                chunk_strategy_version: 1,
                created_at: "1781100002000".to_string(),
            }
        })
        .collect();
    save_chunk_records(&dir, &chunks).expect("chunks should save");

    let payload = extract_character_index_in(&dir, &book.id)
        .expect("character extraction should keep generated relations");

    assert!(
        payload.manifest.relation_count > 2_000,
        "character extraction must not cap generated relations at the old 2000 limit"
    );
    assert_eq!(payload.relations.len(), payload.manifest.relation_count);
    assert!(payload
        .relations
        .iter()
        .all(|relation| relation.evidence_ids.len() <= MAX_EVIDENCE_PER_RELATION));
    for relation in &payload.relations {
        for evidence_id in &relation.evidence_ids {
            assert!(
                payload.evidence.iter().any(|evidence| {
                    evidence.id == *evidence_id
                        && evidence.target_type == "relation"
                        && evidence.target_id == relation.id
                }),
                "relation {} evidence {} must resolve to relation evidence",
                relation.id,
                evidence_id
            );
        }
    }
}

#[test]
fn permanent_delete_removes_character_outputs_for_deleted_book() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-delete", "人物删除", "sage");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    let manifest = ready_character_manifest(&book, &book.content_hash, 1, 1);
    save_character_outputs(&dir, &book.id, &manifest, &[], &[], &[], &[], &[], &[])
        .expect("character outputs should save");
    let character_dir = character_book_dir(&dir, &book.id);
    assert!(
        character_dir.exists(),
        "character outputs should exist before permanent delete"
    );
    move_book_to_trash_in(&dir, &book.id).expect("book should move to trash");

    permanently_delete_book_in(&dir, &book.id).expect("book should delete permanently");

    assert!(
        !character_dir.exists(),
        "permanent delete should remove character center outputs"
    );
}

#[test]
fn permanent_delete_rejects_character_output_path_escape() {
    let dir = unique_temp_library_dir();
    let mut book = character_test_book("..\\escaped-character-book", "异常人物目录", "sage");
    book.deleted = true;
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    let escaped_dir = dir.join("characters").join("escaped-character-book");
    fs::create_dir_all(&escaped_dir).expect("escaped sentinel dir should exist");
    fs::write(escaped_dir.join("sentinel.txt"), "must stay").expect("sentinel should be written");

    let error = permanently_delete_book_in(&dir, &book.id)
        .expect_err("path-escaping character output must be rejected");

    assert!(error.contains("人物中心数据路径异常"));
    assert!(
        escaped_dir.join("sentinel.txt").exists(),
        "path guard must not delete outside characters/books"
    );
}

#[test]
fn newer_failed_character_task_takes_priority_over_derived_stale() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-stale-task", "人物过期任务", "cinnabar");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: "new-text-hash".to_string(),
            status: "ready".to_string(),
            built_at: "1781100100000".to_string(),
            chunk_strategy_version: 2,
            chapter_rule_version: 2,
            chunk_count: 8,
            fts_row_count: 8,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");

    let task = TaskRecord {
        id: "task-character-stale-failed".to_string(),
        book_id: book.id.clone(),
        kind: TaskKind::CHARACTER_EXTRACTION.to_string(),
        status: TaskRunStatus::FAILED.to_string(),
        stage: TaskStage::VERIFY.to_string(),
        error_code: "character_write_failed".to_string(),
        error_message: "写入人物索引失败".to_string(),
        updated_at: "1781100200000".to_string(),
        ..TaskRecord::default()
    };
    save_task_records(&dir, &[task]).expect("task should save");

    let character_manifest = ready_character_manifest(&book, "old-text-hash", 1, 1);
    let summary = build_character_book_summary(&dir, &book, Some(&character_manifest));
    assert_eq!(summary.character_index_status, "failed");
    assert_eq!(summary.error_code, "character_write_failed");
    assert_eq!(summary.last_error, "写入人物索引失败");
}

#[test]
fn newer_running_character_task_takes_priority_over_derived_stale() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-stale-running-task", "人物运行任务", "sage");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: "new-text-hash".to_string(),
            status: "ready".to_string(),
            built_at: "1781100100000".to_string(),
            chunk_strategy_version: 2,
            chapter_rule_version: 2,
            chunk_count: 8,
            fts_row_count: 8,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");

    let task = TaskRecord {
        id: "task-character-stale-running".to_string(),
        book_id: book.id.clone(),
        kind: TaskKind::CHARACTER_EXTRACTION.to_string(),
        status: TaskRunStatus::RUNNING.to_string(),
        stage: TaskStage::BUILD_CHUNKS.to_string(),
        updated_at: "1781100200000".to_string(),
        ..TaskRecord::default()
    };
    save_task_records(&dir, &[task]).expect("task should save");

    let character_manifest = ready_character_manifest(&book, "old-text-hash", 1, 1);
    let summary = build_character_book_summary(&dir, &book, Some(&character_manifest));
    assert_eq!(summary.character_index_status, "building");
    assert_eq!(summary.last_task_id, "task-character-stale-running");
}
