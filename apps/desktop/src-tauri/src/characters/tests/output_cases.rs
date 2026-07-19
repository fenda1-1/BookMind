use super::fixtures::{
    character_test_book, character_test_profile, ready_character_manifest, unique_temp_library_dir,
};
use crate::characters::{build_character_book_summary, save_character_outputs};
use crate::library::save_library_records;
use crate::models::{BookIndexManifest, CharacterIndexManifestRecord};
use crate::paths::character_book_dir;
use crate::tasks::save_index_manifest;
use std::fs;

#[test]
fn character_summary_downgrades_ready_manifest_when_profile_file_is_missing() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-missing-profiles", "缺失人物文件", "sage");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: book.content_hash.clone(),
            status: "ready".to_string(),
            chunk_strategy_version: 1,
            chapter_rule_version: 1,
            chunk_count: 8,
            fts_row_count: 8,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");
    let character_manifest = ready_character_manifest(&book, &book.content_hash, 1, 1);
    let character_dir = character_book_dir(&dir, &book.id);
    fs::create_dir_all(&character_dir).expect("character dir should exist");
    fs::write(
        character_dir.join("manifest.json"),
        serde_json::to_string_pretty(&character_manifest).expect("manifest should serialize"),
    )
    .expect("manifest should be written");

    let summary = build_character_book_summary(&dir, &book, Some(&character_manifest));

    assert_eq!(summary.character_index_status, "missing");
    assert_eq!(summary.character_count, 0);
    assert!(summary.stale_reason.contains("人物索引文件缺失"));
}

#[test]
fn character_output_failure_does_not_replace_existing_manifest_first() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-manifest-last", "Manifest 最后写", "sage");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    let character_dir = character_book_dir(&dir, &book.id);
    fs::create_dir_all(&character_dir).expect("character dir should exist");
    let mut old_manifest = ready_character_manifest(&book, &book.content_hash, 1, 1);
    old_manifest.built_at = "old-built-at".to_string();
    old_manifest.updated_at = "old-updated-at".to_string();
    old_manifest.character_count = 1;
    fs::write(
        character_dir.join("manifest.json"),
        serde_json::to_string_pretty(&old_manifest).expect("old manifest should serialize"),
    )
    .expect("old manifest should be written");
    fs::create_dir_all(character_dir.join("profiles.json"))
        .expect("profiles path should block file replacement");
    let mut new_manifest = ready_character_manifest(&book, &book.content_hash, 1, 1);
    new_manifest.built_at = "new-built-at".to_string();
    new_manifest.updated_at = "new-updated-at".to_string();
    new_manifest.character_count = 2;

    let error = save_character_outputs(
        &dir,
        &book.id,
        &new_manifest,
        &[character_test_profile(&book, 0)],
        &[],
        &[],
        &[],
        &[],
        &[],
    )
    .expect_err("profile write failure should abort the character output update");

    assert!(error.contains("无法替换人物中心文件"));
    let reloaded_manifest: CharacterIndexManifestRecord = serde_json::from_str(
        &fs::read_to_string(character_dir.join("manifest.json"))
            .expect("manifest should remain readable"),
    )
    .expect("manifest should remain valid JSON");
    assert_eq!(reloaded_manifest.built_at, "old-built-at");
    assert_eq!(reloaded_manifest.updated_at, "old-updated-at");
    assert_eq!(reloaded_manifest.character_count, 1);
}

#[test]
fn character_output_late_collection_failure_keeps_existing_manifest() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-events-last", "Events 写入失败", "sage");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    let character_dir = character_book_dir(&dir, &book.id);
    fs::create_dir_all(&character_dir).expect("character dir should exist");
    let mut old_manifest = ready_character_manifest(&book, &book.content_hash, 1, 1);
    old_manifest.built_at = "old-events-built-at".to_string();
    old_manifest.updated_at = "old-events-updated-at".to_string();
    old_manifest.character_count = 3;
    fs::write(
        character_dir.join("manifest.json"),
        serde_json::to_string_pretty(&old_manifest).expect("old manifest should serialize"),
    )
    .expect("old manifest should be written");
    fs::create_dir_all(character_dir.join("events.json"))
        .expect("events path should block file replacement");
    let mut new_manifest = ready_character_manifest(&book, &book.content_hash, 1, 1);
    new_manifest.built_at = "new-events-built-at".to_string();
    new_manifest.updated_at = "new-events-updated-at".to_string();
    new_manifest.character_count = 4;

    let error = save_character_outputs(
        &dir,
        &book.id,
        &new_manifest,
        &[character_test_profile(&book, 0)],
        &[],
        &[],
        &[],
        &[],
        &[],
    )
    .expect_err("events write failure should abort before publishing manifest");

    assert!(error.contains("无法替换人物中心文件"));
    let reloaded_manifest: CharacterIndexManifestRecord = serde_json::from_str(
        &fs::read_to_string(character_dir.join("manifest.json"))
            .expect("manifest should remain readable"),
    )
    .expect("manifest should remain valid JSON");
    assert_eq!(reloaded_manifest.built_at, "old-events-built-at");
    assert_eq!(reloaded_manifest.updated_at, "old-events-updated-at");
    assert_eq!(reloaded_manifest.character_count, 3);
}

#[test]
fn character_output_appearance_stats_failure_keeps_existing_manifest() {
    let dir = unique_temp_library_dir();
    let book = character_test_book(
        "book-character-appearance-stats-last",
        "出场统计失败",
        "sage",
    );
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    let character_dir = character_book_dir(&dir, &book.id);
    fs::create_dir_all(&character_dir).expect("character dir should exist");
    let mut old_manifest = ready_character_manifest(&book, &book.content_hash, 1, 1);
    old_manifest.built_at = "old-appearance-built-at".to_string();
    old_manifest.updated_at = "old-appearance-updated-at".to_string();
    old_manifest.character_count = 5;
    fs::write(
        character_dir.join("manifest.json"),
        serde_json::to_string_pretty(&old_manifest).expect("old manifest should serialize"),
    )
    .expect("old manifest should be written");
    fs::create_dir_all(character_dir.join("appearance-stats.json"))
        .expect("appearance stats path should block file replacement");
    let mut new_manifest = ready_character_manifest(&book, &book.content_hash, 1, 1);
    new_manifest.built_at = "new-appearance-built-at".to_string();
    new_manifest.updated_at = "new-appearance-updated-at".to_string();
    new_manifest.character_count = 6;

    let error = save_character_outputs(
        &dir,
        &book.id,
        &new_manifest,
        &[character_test_profile(&book, 0)],
        &[],
        &[],
        &[],
        &[],
        &[],
    )
    .expect_err("appearance stats write failure should abort before publishing manifest");

    assert!(error.contains("无法替换人物中心文件"));
    let reloaded_manifest: CharacterIndexManifestRecord = serde_json::from_str(
        &fs::read_to_string(character_dir.join("manifest.json"))
            .expect("manifest should remain readable"),
    )
    .expect("manifest should remain valid JSON");
    assert_eq!(reloaded_manifest.built_at, "old-appearance-built-at");
    assert_eq!(reloaded_manifest.updated_at, "old-appearance-updated-at");
    assert_eq!(reloaded_manifest.character_count, 5);
}

#[test]
fn character_summary_does_not_derive_character_stale_when_text_index_is_not_ready() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-text-stale", "全文过期", "amber");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: "new-text-hash".to_string(),
            status: "stale".to_string(),
            stale_reason: "全文索引已过期".to_string(),
            chunk_strategy_version: 2,
            chapter_rule_version: 2,
            chunk_count: 8,
            fts_row_count: 8,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");

    let character_manifest = ready_character_manifest(&book, "old-text-hash", 1, 1);
    let summary = build_character_book_summary(&dir, &book, Some(&character_manifest));
    assert_eq!(summary.character_index_status, "blocked-by-text-index");
    assert_eq!(summary.stale_reason, "");
}

#[test]
fn character_summary_does_not_derive_stale_for_failed_character_manifest() {
    let dir = unique_temp_library_dir();
    let book = character_test_book(
        "book-character-failed-manifest",
        "人物失败 Manifest",
        "violet",
    );
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: "new-text-hash".to_string(),
            status: "ready".to_string(),
            chunk_strategy_version: 2,
            chapter_rule_version: 2,
            chunk_count: 8,
            fts_row_count: 8,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");

    let mut character_manifest = ready_character_manifest(&book, "old-text-hash", 1, 1);
    character_manifest.status = "failed".to_string();
    character_manifest.last_error = "人物识别失败".to_string();
    let summary = build_character_book_summary(&dir, &book, Some(&character_manifest));
    assert_eq!(summary.character_index_status, "failed");
    assert_eq!(summary.stale_reason, "");
    assert_eq!(summary.last_error, "人物识别失败");
}
