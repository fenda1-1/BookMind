use super::*;

#[test]
fn local_character_extraction_builds_profiles_mentions_and_evidence_from_indexed_chunks() {
    let dir = unique_temp_library_dir();
    let book = BookRecord {
        id: "book-character-core".to_string(),
        title: "人物核心".to_string(),
        display_title: "人物核心".to_string(),
        author: "本地导入".to_string(),
        format: "TXT".to_string(),
        status: "已导入".to_string(),
        progress: 0,
        file_name: "character-core.txt".to_string(),
        file_path: "E:/books/character-core.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "人".to_string(),
        cover_tone: "sage".to_string(),
        deleted: false,
        deleted_at: String::new(),
        content_hash: "character-book-hash".to_string(),
        imported_at: "1781100000000".to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
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
                id: "character-chunk-1".to_string(),
                book_id: book.id.clone(),
                book_title: book.display_title.clone(),
                chapter: "第一章 夜幕".to_string(),
                ordinal: 0,
                text: "林七夜说道：“李医生，我看见赵空城了。”李医生看向林七夜，病房里一片安静。"
                    .to_string(),
                chapter_index: 0,
                chapter_title: "第一章 夜幕".to_string(),
                paragraph_start: 0,
                paragraph_end: 1,
                char_start: 0,
                char_end: 42,
                content_hash: "chunk-hash-1".to_string(),
                chunk_strategy_version: 1,
                created_at: "1781100002000".to_string(),
            },
            TextChunkRecord {
                id: "character-chunk-2".to_string(),
                book_id: book.id.clone(),
                book_title: book.display_title.clone(),
                chapter: "第二章 守夜人".to_string(),
                ordinal: 1,
                text: "赵空城低声说道，林七夜点了点头。李医生没有回答。".to_string(),
                chapter_index: 1,
                chapter_title: "第二章 守夜人".to_string(),
                paragraph_start: 2,
                paragraph_end: 3,
                char_start: 43,
                char_end: 70,
                content_hash: "chunk-hash-2".to_string(),
                chunk_strategy_version: 1,
                created_at: "1781100003000".to_string(),
            },
        ],
    )
    .expect("chunks should save");

    let payload = extract_character_index_in(&dir, &book.id)
        .expect("character index should build from indexed chunks");

    assert_eq!(payload.manifest.status, "ready");
    assert_eq!(payload.manifest.book_id, book.id);
    assert_eq!(payload.manifest.text_index_content_hash, book.content_hash);
    assert!(payload.profiles.len() >= 3);
    assert!(payload
        .profiles
        .iter()
        .any(|profile| profile.canonical_name == "林七夜" && profile.mention_count >= 2));
    assert!(payload
        .profiles
        .iter()
        .any(|profile| profile.canonical_name == "李医生"));
    assert!(payload
        .profiles
        .iter()
        .any(|profile| profile.canonical_name == "赵空城"));
    assert!(!payload
        .profiles
        .iter()
        .any(|profile| profile.canonical_name == "病房"));
    assert!(payload
        .mentions
        .iter()
        .any(|mention| mention.name == "林七夜"
            && mention.location.chunk_id == "character-chunk-1"
            && mention.location.source_chapter_index == 0
            && mention.location.paragraph_index == 0
            && mention.location.end_offset > mention.location.start_offset));
    assert!(payload.evidence.len() >= payload.mentions.len());
    assert!(payload
        .evidence
        .iter()
        .any(|evidence| evidence.quote.contains("林七夜")
            && evidence.location.chunk_id == "character-chunk-1"));

    let reloaded = load_character_center_payload_in(&dir, &book.id)
        .expect("saved character payload should reload");
    assert_eq!(reloaded.manifest.character_count, payload.profiles.len());
    assert_eq!(reloaded.profiles.len(), payload.profiles.len());
    assert_eq!(reloaded.mentions.len(), payload.mentions.len());
    assert_eq!(reloaded.evidence.len(), payload.evidence.len());
}

#[test]
fn character_extraction_task_runs_through_task_center_and_writes_index() {
    let dir = unique_temp_library_dir();
    let book = BookRecord {
        id: "book-character-task".to_string(),
        title: "人物任务".to_string(),
        display_title: "人物任务".to_string(),
        author: "本地导入".to_string(),
        format: "TXT".to_string(),
        status: "已导入".to_string(),
        progress: 0,
        file_name: "character-task.txt".to_string(),
        file_path: "E:/books/character-task.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "任".to_string(),
        cover_tone: "amber".to_string(),
        deleted: false,
        deleted_at: String::new(),
        content_hash: "character-task-hash".to_string(),
        imported_at: "1781100000000".to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
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

    let queued = queue_character_extraction_in(&dir, &book.id)
        .expect("character extraction task should queue");
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
fn character_rebuild_inherits_confirmed_gender_from_previous_profiles() {
    let dir = unique_temp_library_dir();
    let book = BookRecord {
        id: "book-character-gender-rebuild".to_string(),
        title: "人物性别继承".to_string(),
        display_title: "人物性别继承".to_string(),
        author: "本地导入".to_string(),
        format: "TXT".to_string(),
        status: "已导入".to_string(),
        progress: 0,
        file_name: "character-gender.txt".to_string(),
        file_path: "E:/books/character-gender.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "性".to_string(),
        cover_tone: "indigo".to_string(),
        deleted: false,
        deleted_at: String::new(),
        content_hash: "character-gender-hash".to_string(),
        imported_at: "1781100000000".to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
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
                id: "character-gender-chunk-1".to_string(),
                book_id: book.id.clone(),
                book_title: book.display_title.clone(),
                chapter: "第一章".to_string(),
                ordinal: 0,
                text: "陈平安说道，宁姚问道。陈平安看向宁姚。".to_string(),
                chapter_index: 0,
                chapter_title: "第一章".to_string(),
                paragraph_start: 0,
                paragraph_end: 1,
                char_start: 0,
                char_end: 24,
                content_hash: "character-gender-chunk-hash-1".to_string(),
                chunk_strategy_version: 1,
                created_at: "1781100002000".to_string(),
            },
            TextChunkRecord {
                id: "character-gender-chunk-2".to_string(),
                book_id: book.id.clone(),
                book_title: book.display_title.clone(),
                chapter: "第二章".to_string(),
                ordinal: 1,
                text: "陈平安问道，宁姚笑道。陈平安回答。".to_string(),
                chapter_index: 1,
                chapter_title: "第二章".to_string(),
                paragraph_start: 2,
                paragraph_end: 3,
                char_start: 25,
                char_end: 48,
                content_hash: "character-gender-chunk-hash-2".to_string(),
                chunk_strategy_version: 1,
                created_at: "1781100003000".to_string(),
            },
        ],
    )
    .expect("chunks should save");

    let first_payload =
        extract_character_index_in(&dir, &book.id).expect("initial character index should build");
    let mut profiles = first_payload.profiles.clone();
    let chen = profiles
        .iter_mut()
        .find(|profile| profile.canonical_name == "陈平安")
        .expect("陈平安 should be extracted");
    chen.gender = "male".to_string();
    let profile_path = crate::paths::character_book_dir(&dir, &book.id).join("profiles.json");
    std::fs::write(
        &profile_path,
        serde_json::to_string_pretty(&profiles).expect("profiles should serialize"),
    )
    .expect("profiles should be overwritten");

    let rebuilt =
        extract_character_index_in(&dir, &book.id).expect("rebuilt character index should build");

    let chen = rebuilt
        .profiles
        .iter()
        .find(|profile| profile.canonical_name == "陈平安")
        .expect("陈平安 should remain after rebuild");
    assert_eq!(chen.gender, "male");
}
