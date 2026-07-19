use super::fixtures::{
    character_test_book, character_test_event, character_test_profile, han_test_name,
    ready_character_manifest, unique_temp_library_dir,
};
use crate::characters::{
    build_character_book_summary, extract_character_index_in,
    load_character_center_book_summaries_in, load_character_center_payload_in,
    save_character_outputs, MAX_CHARACTER_PROFILES, MAX_MENTIONS_PER_CHARACTER,
    MAX_PAYLOAD_PROFILES, MAX_PAYLOAD_PROFILE_BYTES,
};
use crate::library::save_library_records;
use crate::models::{BookIndexManifest, CharacterIndexManifestRecord, TextChunkRecord};
use crate::paths::character_book_dir;
use crate::search::save_chunk_records;
use crate::tasks::save_index_manifest;
use std::fs;

#[test]
fn character_summary_marks_ready_manifest_stale_when_text_index_dependency_changes() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-stale", "人物过期", "sage");
    save_library_records(&dir, &[book.clone()]).expect("library should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: "new-text-hash".to_string(),
            status: "ready".to_string(),
            built_at: "1781100100000".to_string(),
            index_version: 1,
            chunk_strategy_version: 2,
            chapter_rule_version: 3,
            chunk_count: 8,
            fts_row_count: 8,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");

    let character_manifest = CharacterIndexManifestRecord {
        schema_version: "bookmind.character.index.v1".to_string(),
        book_id: book.id.clone(),
        book_title: book.display_title.clone(),
        content_hash: book.content_hash.clone(),
        text_index_content_hash: "old-text-hash".to_string(),
        index_version: 1,
        chunk_strategy_version: 1,
        chapter_rule_version: 1,
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
    };

    let summary = build_character_book_summary(&dir, &book, Some(&character_manifest));
    assert_eq!(summary.character_index_status, "stale");
    assert!(summary.stale_reason.contains("全文索引内容已变化"));
    assert!(summary.stale_reason.contains("人物识别算法版本已变化"));
    assert!(summary.stale_reason.contains("chunk 策略版本已变化"));
    assert!(summary.stale_reason.contains("章节规则版本已变化"));
    assert_eq!(summary.character_count, 2);
    assert_eq!(summary.evidence_count, 4);
}

#[test]
fn character_center_book_summaries_read_ready_manifest_counts() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-summary-ready", "摘要人物", "sage");
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
    save_character_outputs(
        &dir,
        &book.id,
        &character_manifest,
        &[],
        &[],
        &[],
        &[],
        &[],
        &[],
    )
    .expect("character manifest should save");

    let summaries = load_character_center_book_summaries_in(&dir).expect("summaries should load");
    let summary = summaries
        .iter()
        .find(|item| item.id == book.id)
        .expect("book summary should exist");
    assert_eq!(summary.character_index_status, "ready");
    assert_eq!(summary.character_count, 2);
    assert_eq!(summary.evidence_count, 4);
    assert_eq!(summary.last_character_built_at, "1781100000000");
}

#[test]
fn old_ready_character_manifest_without_new_collections_is_stale_not_missing() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-old-ready", "旧版人物", "sage");
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

    let mut character_manifest = ready_character_manifest(&book, &book.content_hash, 1, 1);
    character_manifest.index_version = 4;
    let character_dir = character_book_dir(&dir, &book.id);
    fs::create_dir_all(&character_dir).expect("character dir should exist");
    fs::write(
        character_dir.join("manifest.json"),
        serde_json::to_string_pretty(&character_manifest).expect("manifest should serialize"),
    )
    .expect("manifest should be written");
    fs::write(character_dir.join("profiles.json"), "[]").expect("profiles should be written");
    fs::write(character_dir.join("mentions.jsonl"), "").expect("mentions should be written");
    fs::write(character_dir.join("evidence.jsonl"), "").expect("evidence should be written");
    fs::write(character_dir.join("relations.json"), "[]").expect("relations should be written");

    let summary = build_character_book_summary(&dir, &book, Some(&character_manifest));
    assert_eq!(summary.character_index_status, "stale");
    assert!(summary.stale_reason.contains("人物识别算法版本已变化"));
}

#[test]
fn character_payload_filters_events_with_unavailable_evidence() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-event-evidence", "事件证据", "sage");
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
    fs::write(
        character_dir.join("profiles.json"),
        serde_json::to_string(&vec![character_test_profile(&book, 0)])
            .expect("profile should serialize"),
    )
    .expect("profiles should be written");
    fs::write(character_dir.join("mentions.jsonl"), "").expect("mentions should be written");
    fs::write(character_dir.join("relations.json"), "[]").expect("relations should be written");
    fs::write(character_dir.join("evidence.jsonl"), "").expect("evidence should be written");
    fs::write(
        character_dir.join("events.json"),
        serde_json::to_string(&vec![character_test_event(
            &book,
            "event-missing-evidence",
            "character-large-0",
            vec!["missing-evidence".to_string()],
        )])
        .expect("event should serialize"),
    )
    .expect("events should be written");
    fs::write(character_dir.join("appearance-stats.json"), "[]")
        .expect("appearance stats should be written");

    let payload = load_character_center_payload_in(&dir, &book.id)
        .expect("payload should load with missing event evidence filtered");

    assert!(payload.events.is_empty());
}

#[test]
fn character_payload_reads_only_safe_profile_window_before_corrupt_tail() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-large-profile", "巨大人物文件", "sage");
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

    let mut character_manifest = ready_character_manifest(&book, &book.content_hash, 1, 1);
    character_manifest.character_count = MAX_PAYLOAD_PROFILES + 10_000;
    let character_dir = character_book_dir(&dir, &book.id);
    fs::create_dir_all(&character_dir).expect("character dir should exist");
    fs::write(
        character_dir.join("manifest.json"),
        serde_json::to_string_pretty(&character_manifest).expect("manifest should serialize"),
    )
    .expect("manifest should be written");
    let mut profiles_raw = String::from("[");
    for index in 0..MAX_PAYLOAD_PROFILES {
        if index > 0 {
            profiles_raw.push(',');
        }
        profiles_raw.push_str(
            &serde_json::to_string(&character_test_profile(&book, index))
                .expect("profile should serialize"),
        );
    }
    profiles_raw.push_str(", {\"tailThatMustNotBeRead\": ");
    fs::write(character_dir.join("profiles.json"), profiles_raw)
        .expect("profiles should be written");
    fs::write(character_dir.join("mentions.jsonl"), "").expect("mentions should be written");
    fs::write(character_dir.join("evidence.jsonl"), "").expect("evidence should be written");
    fs::write(character_dir.join("relations.json"), "[]").expect("relations should be written");
    fs::write(character_dir.join("events.json"), "[]").expect("events should be written");
    fs::write(character_dir.join("appearance-stats.json"), "[]")
        .expect("appearance stats should be written");

    let payload = load_character_center_payload_in(&dir, &book.id)
        .expect("payload loading should stop after the safe profile window");

    assert_eq!(payload.profiles.len(), MAX_PAYLOAD_PROFILES);
    assert_eq!(payload.book.character_count, MAX_PAYLOAD_PROFILES + 10_000);
}

#[test]
fn character_payload_rejects_single_profile_over_safe_byte_limit() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-huge-single-profile", "超大人物档案", "sage");
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
    let mut profile = character_test_profile(&book, 0);
    profile.summary = "超".repeat(MAX_PAYLOAD_PROFILE_BYTES + 1);
    fs::write(
        character_dir.join("profiles.json"),
        format!(
            "[{}]",
            serde_json::to_string(&profile).expect("profile should serialize")
        ),
    )
    .expect("profiles should be written");
    fs::write(character_dir.join("mentions.jsonl"), "").expect("mentions should be written");
    fs::write(character_dir.join("evidence.jsonl"), "").expect("evidence should be written");
    fs::write(character_dir.join("relations.json"), "[]").expect("relations should be written");
    fs::write(character_dir.join("events.json"), "[]").expect("events should be written");
    fs::write(character_dir.join("appearance-stats.json"), "[]")
        .expect("appearance stats should be written");

    let error = load_character_center_payload_in(&dir, &book.id)
        .expect_err("oversized profile should be rejected before unbounded allocation");

    assert!(error.contains("单个人物档案超过安全读取上限"));
}

#[test]
fn character_extraction_caps_generated_profiles_for_many_strong_name_candidates() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-many-candidates", "大量候选人物", "sage");
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
            chunk_count: MAX_CHARACTER_PROFILES + 40,
            fts_row_count: MAX_CHARACTER_PROFILES + 40,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");
    let chunks: Vec<TextChunkRecord> = (0..MAX_CHARACTER_PROFILES + 40)
        .map(|index| {
            let candidate = han_test_name(index);
            TextChunkRecord {
                id: format!("many-candidate-chunk-{index}"),
                book_id: book.id.clone(),
                book_title: book.display_title.clone(),
                chapter: format!("第 {} 章", index + 1),
                ordinal: index,
                text: format!("{candidate}说道，{candidate}点头。"),
                chapter_index: index,
                chapter_title: format!("第 {} 章", index + 1),
                paragraph_start: index,
                paragraph_end: index + 1,
                char_start: 0,
                char_end: 16,
                content_hash: format!("many-candidate-hash-{index}"),
                chunk_strategy_version: 1,
                created_at: "1781100002000".to_string(),
            }
        })
        .collect();
    save_chunk_records(&dir, &chunks).expect("chunks should save");

    let payload = extract_character_index_in(&dir, &book.id)
        .expect("character extraction should cap generated profiles");

    assert!(
        payload.profiles.len() >= MAX_CHARACTER_PROFILES - 8,
        "strong generated names should still reach the profile cap window, got {}",
        payload.profiles.len()
    );
    assert_eq!(payload.manifest.character_count, payload.profiles.len());
    assert!(payload.manifest.mention_count <= MAX_CHARACTER_PROFILES * MAX_MENTIONS_PER_CHARACTER);
    let profile_size = fs::metadata(character_book_dir(&dir, &book.id).join("profiles.json"))
        .expect("profiles metadata should be readable")
        .len();
    let max_profile_bytes = (MAX_CHARACTER_PROFILES as u64) * 3_000;
    assert!(
        profile_size < max_profile_bytes,
        "profile output should remain bounded, got {profile_size}"
    );
}

#[test]
fn character_extraction_does_not_fill_profiles_with_weak_noise_candidates() {
    let dir = unique_temp_library_dir();
    let book = character_test_book("book-character-weak-noise", "弱候选噪声", "sage");
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
            chunk_count: MAX_CHARACTER_PROFILES + 20,
            fts_row_count: MAX_CHARACTER_PROFILES + 20,
            ..BookIndexManifest::default()
        }],
    )
    .expect("text index manifest should save");
    let mut chunks = vec![TextChunkRecord {
        id: "weak-noise-real-characters".to_string(),
        book_id: book.id.clone(),
        book_title: book.display_title.clone(),
        chapter: "第一章 真实人物".to_string(),
        ordinal: 0,
        text: "林七夜说道，李医生问道，赵空城答道，红缨喊道，安卿鱼开口。".to_string(),
        chapter_index: 0,
        chapter_title: "第一章 真实人物".to_string(),
        paragraph_start: 0,
        paragraph_end: 1,
        char_start: 0,
        char_end: 32,
        content_hash: "weak-noise-real-hash".to_string(),
        chunk_strategy_version: 1,
        created_at: "1781100002000".to_string(),
    }];
    chunks.extend(
        (0..MAX_CHARACTER_PROFILES + 20).map(|index| TextChunkRecord {
            id: format!("weak-noise-chunk-{index}"),
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            chapter: format!("第 {} 章", index + 2),
            ordinal: index + 1,
            text: format!(
                "一个身影看向远方，几人顿时转头，刚刚那个声音传来，方向看去。噪{}看向问题。",
                char::from_u32(0x4E00 + index as u32).unwrap_or('名')
            ),
            chapter_index: index + 1,
            chapter_title: format!("第 {} 章", index + 2),
            paragraph_start: index + 1,
            paragraph_end: index + 2,
            char_start: 0,
            char_end: 48,
            content_hash: format!("weak-noise-hash-{index}"),
            chunk_strategy_version: 1,
            created_at: "1781100002000".to_string(),
        }),
    );
    save_chunk_records(&dir, &chunks).expect("chunks should save");

    let payload = extract_character_index_in(&dir, &book.id)
        .expect("character extraction should reject weak noise candidates");
    let names: Vec<&str> = payload
        .profiles
        .iter()
        .map(|profile| profile.canonical_name.as_str())
        .collect();

    for expected in ["林七夜", "李医生", "赵空城", "红缨", "安卿鱼"] {
        assert!(
            names.contains(&expected),
            "expected real character {expected}"
        );
    }
    for rejected in ["一个身影", "几人顿时", "刚刚那个", "方向看去"] {
        assert!(
            !names.contains(&rejected),
            "weak non-character candidate {rejected} should be filtered"
        );
    }
    assert!(
        payload.profiles.len() < MAX_CHARACTER_PROFILES / 4,
        "weak noise must not fill the profile cap, got {} profiles",
        payload.profiles.len()
    );
}
