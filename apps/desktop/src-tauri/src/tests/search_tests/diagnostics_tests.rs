use super::*;

#[test]
fn index_diagnostics_report_queue_chunks_fts_and_recent_errors() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let ok_source = source_dir.join("诊断测试.txt");
    let failed_source = source_dir.join("失败任务.txt");
    std::fs::write(
        &ok_source,
        "第一章 索引诊断\n任务中心应该显示 chunks 数和 FTS 路径。\n第二章 AI 检索\n已索引书籍应该可被 AI 检索。",
    )
    .expect("source txt should be written");
    std::fs::write(&failed_source, "失败任务用于显示最近错误。")
        .expect("failed source should be written");

    import_book_from_path_into(&dir, &ok_source).expect("ok import should queue");
    let failed_book =
        import_book_from_path_into(&dir, &failed_source).expect("failed import should queue");
    let tasks = load_task_records(&dir).expect("tasks should load");
    let failed_task_id = parse_task_for_book(&tasks, &failed_book.id).id.clone();
    cancel_task_in(&dir, &failed_task_id).expect("task should cancel");
    retry_task_in(&dir, &failed_task_id).expect("task should retry");
    pause_task_in(&dir, &failed_task_id).expect("task should pause");

    let before = index_diagnostics_for_ui(&dir).expect("diagnostics should load before run");
    assert_eq!(before.summary.queued_count, 1);
    assert_eq!(before.summary.running_count, 0);
    assert_eq!(before.summary.succeeded_count, 2);
    assert_eq!(before.summary.failed_count, 0);
    assert_eq!(before.summary.paused_count, 1);
    assert_eq!(before.summary.cancelled_count, 0);
    assert_eq!(before.summary.indexed_chunk_count, 0);
    assert!(before
        .summary
        .fts_database_path
        .ends_with("bookmind.sqlite"));

    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    let after = index_diagnostics_for_ui(&dir).expect("diagnostics should load after run");

    assert_eq!(after.summary.queued_count, 0);
    assert_eq!(after.summary.running_count, 0);
    assert_eq!(after.summary.succeeded_count, 6);
    assert_eq!(after.summary.failed_count, 0);
    assert_eq!(after.summary.paused_count, 1);
    assert_eq!(after.summary.cancelled_count, 0);
    assert!(after.summary.indexed_chunk_count > 0);
    assert!(after.summary.fts_available);
    assert_eq!(after.summary.indexed_book_count, 1);
    assert_eq!(after.summary.sidecar_status, "not-configured");
    assert!(after.summary.sidecar_message.contains("not configured"));
    assert_eq!(after.summary.vector_index_status, "not-built");
    assert_eq!(after.summary.vector_indexed_book_count, 0);
    assert_eq!(after.summary.vector_indexed_chunk_count, 0);
    assert!(after.summary.vector_provider.is_empty());
    assert_eq!(after.summary.vector_dimension, 0);
    assert!(after.summary.vector_last_built_at.is_empty());
    assert!(after.summary.vector_last_error.is_empty());
    assert!(after.summary.recent_error.contains("任务已暂停"));
    assert_eq!(after.summary.recent_errors.len(), 1);
    assert!(after.summary.recent_errors[0].contains("任务已暂停"));
}

#[test]
fn index_diagnostics_respects_recent_index_error_limit_setting() {
    let dir = unique_temp_library_dir();
    crate::settings::save_settings_v2(
        &dir,
        &SettingsV2 {
            settings_schema_version: 2,
            global: serde_json::json!({}),
            reader: serde_json::json!({}),
            extended: serde_json::json!({ "indexRecentErrorLimit": "2" }),
        },
    )
    .expect("settings v2 should save recent error limit");
    let tasks = (0..4)
        .map(|index| TaskRecord {
            id: format!("failed-index-task-{index}"),
            book_id: format!("failed-book-{index}"),
            kind: TaskKind::PARSE_AND_INDEX.to_string(),
            status: TaskRunStatus::FAILED.to_string(),
            error_message: format!("索引失败 {index}"),
            updated_at: index.to_string(),
            ..TaskRecord::default()
        })
        .collect::<Vec<_>>();
    save_task_records(&dir, &tasks).expect("failed tasks should save");

    let diagnostics = index_diagnostics_for_ui(&dir).expect("diagnostics should load");

    assert_eq!(diagnostics.summary.recent_errors.len(), 2);
    assert!(diagnostics.summary.recent_errors[0].contains("索引失败 3"));
    assert!(diagnostics.summary.recent_errors[1].contains("索引失败 2"));
    assert!(diagnostics.summary.recent_error.contains("索引失败 3"));
}

#[test]
fn parse_runner_writes_index_manifest_for_completed_book() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("manifest测试.txt");
    std::fs::write(
        &source,
        "第一章 Manifest\n索引完成后应该写入 manifest，记录 chunk 和 FTS 行数。",
    )
    .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");

    let manifest = load_index_manifest(&dir).expect("manifest should load");
    let entry = manifest
        .iter()
        .find(|entry| entry.book_id == book.id)
        .expect("book manifest should exist");
    assert_eq!(entry.status, "ready");
    assert!(entry.chunk_count > 0);
    assert_eq!(entry.chunk_count, entry.fts_row_count);
    assert_eq!(entry.content_hash, book.content_hash);
    assert!(!entry.built_at.is_empty());
}

#[test]
fn diagnostics_marks_manifest_stale_when_content_hash_changes() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("hash变化.txt");
    std::fs::write(&source, "第一版内容会先建立索引。").expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    let mut records = load_library_records(&dir).expect("library should load");
    records[0].content_hash = "changed-content-hash".to_string();
    save_library_records(&dir, &records).expect("library should save");

    let diagnostics = index_diagnostics_for_ui(&dir).expect("diagnostics should load");
    let entry = diagnostics
        .books
        .iter()
        .find(|entry| entry.book_id == book.id)
        .expect("book manifest should be present");
    assert_eq!(entry.status, "stale");
    assert!(entry.stale_reason.contains("内容变更"));
    assert_eq!(diagnostics.summary.stale_book_count, 1);
}

#[test]
fn diagnostics_marks_manifest_stale_when_fts_rows_mismatch_chunks() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("fts不一致.txt");
    std::fs::write(&source, "FTS 行数和 chunk 数不一致时应该标记 stale。")
        .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: book.content_hash.clone(),
            index_version: 1,
            chunk_strategy_version: 1,
            chapter_rule_version: 1,
            fts_schema_version: 1,
            status: "ready".to_string(),
            chunk_count: 999,
            fts_row_count: 0,
            ..BookIndexManifest::default()
        }],
    )
    .expect("manifest should save");

    let diagnostics = index_diagnostics_for_ui(&dir).expect("diagnostics should load");
    let entry = diagnostics
        .books
        .iter()
        .find(|entry| entry.book_id == book.id)
        .expect("book manifest should be present");
    assert_eq!(entry.status, "stale");
    assert!(entry.stale_reason.contains("校验失败"));
}

#[test]
fn validate_all_indexes_scans_consistency_without_rebuilding() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("只校验不重建.txt");
    std::fs::write(
        &source,
        "校验全部索引时只能扫描一致性，不能重建 chunks 或 FTS。",
    )
    .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: book.content_hash.clone(),
            index_version: 1,
            chunk_strategy_version: 1,
            chapter_rule_version: 1,
            fts_schema_version: 1,
            status: "ready".to_string(),
            chunk_count: 999,
            fts_row_count: 0,
            ..BookIndexManifest::default()
        }],
    )
    .expect("manifest should save");
    let chunks_before = load_chunk_records(&dir).expect("chunks should load before validation");
    let fts_rows_before =
        load_book_chunk_records(&dir, &book.id).expect("fts rows should load before validation");
    let manifest_before =
        load_index_manifest(&dir).expect("manifest should load before validation");

    let diagnostics = validate_all_indexes_in(&dir).expect("validation should scan consistency");

    let entry = diagnostics
        .books
        .iter()
        .find(|entry| entry.book_id == book.id)
        .expect("book manifest should be present");
    assert_eq!(entry.status, "stale");
    assert!(entry.stale_reason.contains("校验失败"));
    assert_eq!(
        load_chunk_records(&dir).expect("chunks should load after validation"),
        chunks_before,
        "validation must not rewrite chunks"
    );
    assert_eq!(
        load_book_chunk_records(&dir, &book.id).expect("fts rows should load after validation"),
        fts_rows_before,
        "validation must not rewrite FTS rows"
    );
    assert_eq!(
        load_index_manifest(&dir).expect("manifest should load after validation"),
        manifest_before,
        "validation must not rewrite manifest"
    );
}

#[test]
fn validate_all_indexes_marks_indexes_stale_when_strategy_versions_change() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("版本迁移.txt");
    std::fs::write(
        &source,
        "第一章 旧索引\nchunk 策略、章节规则或 FTS schema 改变时应该标记 stale。",
    )
    .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    let chunks_before = load_chunk_records(&dir).expect("chunks should load before validation");
    let fts_rows_before =
        load_book_chunk_records(&dir, &book.id).expect("fts rows should load before validation");

    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: book.id.clone(),
            book_title: book.display_title.clone(),
            content_hash: book.content_hash.clone(),
            status: "ready".to_string(),
            index_version: 1,
            chunk_strategy_version: 0,
            chapter_rule_version: 0,
            fts_schema_version: 0,
            chunk_count: chunks_before.len(),
            fts_row_count: fts_rows_before.len(),
            ..BookIndexManifest::default()
        }],
    )
    .expect("legacy manifest should save");
    let manifest_before =
        load_index_manifest(&dir).expect("manifest should load before validation");

    let diagnostics = validate_all_indexes_in(&dir).expect("validation should scan versions");

    let entry = diagnostics
        .books
        .iter()
        .find(|entry| entry.book_id == book.id)
        .expect("book manifest should be present");
    assert_eq!(entry.status, "stale");
    assert!(entry.stale_reason.contains("索引版本迁移"));
    assert!(entry.stale_reason.contains("chunk 策略"));
    assert!(entry.stale_reason.contains("章节规则"));
    assert!(entry.stale_reason.contains("FTS schema"));
    assert_eq!(
        load_chunk_records(&dir).expect("chunks should load after validation"),
        chunks_before,
        "validation must not rewrite chunks during version migration detection"
    );
    assert_eq!(
        load_book_chunk_records(&dir, &book.id).expect("fts rows should load after validation"),
        fts_rows_before,
        "validation must not rewrite FTS rows during version migration detection"
    );
    assert_eq!(
        load_index_manifest(&dir).expect("manifest should load after validation"),
        manifest_before,
        "validation must not persist stale migration markers until an explicit rebuild"
    );
}

#[test]
fn settings_v2_index_strategy_changes_persist_stale_manifest_marker() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("设置策略变更.txt");
    std::fs::write(
        &source,
        "第一章 设置策略\n索引 chunk 大小、overlap 或策略版本改变时，已建索引应自动标记 stale。",
    )
    .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    let before = load_index_manifest(&dir).expect("manifest should load before settings change");
    let ready_entry = before
        .iter()
        .find(|entry| entry.book_id == book.id)
        .expect("indexed book manifest should exist");
    assert_eq!(ready_entry.status, "ready");

    let saved = update_settings_v2_in(
        &dir,
        SettingsV2 {
            settings_schema_version: 2,
            global: serde_json::json!({}),
            reader: serde_json::json!({}),
            extended: serde_json::json!({
                "indexStrategyVersion": "stable",
                "indexChunkSize": "1600",
                "indexChunkOverlap": "120"
            }),
        },
    )
    .expect("settings v2 update should save");
    assert_eq!(saved.extended["indexChunkSize"], "1600");

    let manifest = load_index_manifest(&dir).expect("manifest should reload after settings change");
    let entry = manifest
        .iter()
        .find(|entry| entry.book_id == book.id)
        .expect("indexed book manifest should still exist");
    assert_eq!(entry.status, "stale");
    assert!(entry.stale_reason.contains("索引策略设置变更"));
    assert!(entry.stale_reason.contains("indexChunkSize"));
}

#[test]
fn settings_v2_auto_rebuild_strategy_queues_rebuild_tasks() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("自动重建策略.txt");
    std::fs::write(
        &source,
        "第一章 自动重建\n索引规则变化且策略为 auto 时，已索引书籍应自动进入重建队列。",
    )
    .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");

    update_settings_v2_in(
        &dir,
        SettingsV2 {
            settings_schema_version: 2,
            global: serde_json::json!({}),
            reader: serde_json::json!({}),
            extended: serde_json::json!({
                "indexRebuildStrategy": "auto",
                "indexChunkSize": "1600",
                "indexChunkOverlap": "120"
            }),
        },
    )
    .expect("auto rebuild settings update should save");

    let manifest = load_index_manifest(&dir).expect("manifest should reload");
    let entry = manifest
        .iter()
        .find(|entry| entry.book_id == book.id)
        .expect("indexed book manifest should still exist");
    assert_eq!(entry.status, "stale");
    assert!(entry.stale_reason.contains("indexChunkSize"));

    let tasks = load_task_records(&dir).expect("tasks should reload after auto rebuild");
    let rebuild_tasks = tasks
        .iter()
        .filter(|task| task.book_id == book.id && task.kind == TaskKind::REBUILD_INDEX)
        .collect::<Vec<_>>();
    assert_eq!(rebuild_tasks.len(), 1);
    assert_eq!(rebuild_tasks[0].status, TaskRunStatus::QUEUED);
    assert!(rebuild_tasks[0].message.contains("自动排队重建索引"));
}

#[test]
fn validate_all_indexes_reports_chunks_without_manifest() {
    let dir = unique_temp_library_dir();
    save_library_records(
        &dir,
        &[BookRecord {
            id: "orphan-book".to_string(),
            title: "孤立索引".to_string(),
            display_title: "孤立索引".to_string(),
            author: "本地导入".to_string(),
            format: "TXT".to_string(),
            status: "已导入".to_string(),
            progress: 0,
            file_name: "orphan-book.txt".to_string(),
            file_path: "E:/books/orphan-book.txt".to_string(),
            source_file_path: String::new(),
            cover_image_path: String::new(),
            cover_label: "TXT".to_string(),
            cover_tone: "sage".to_string(),
            deleted: false,
            deleted_at: String::new(),
            content_hash: "orphan-hash".to_string(),
            imported_at: "1".to_string(),
            last_opened_at: String::new(),
            shelf_groups: Vec::new(),
        }],
    )
    .expect("live library record should save");
    save_chunk_records(
        &dir,
        &[TextChunkRecord {
            id: "orphan-chunk-1".to_string(),
            book_id: "orphan-book".to_string(),
            book_title: "孤立索引".to_string(),
            chapter: "正文".to_string(),
            ordinal: 0,
            text: "manifest 缺失但 chunks 存在时也必须被校验结果暴露。".to_string(),
            chapter_index: 0,
            chapter_title: "正文".to_string(),
            paragraph_start: 0,
            paragraph_end: 0,
            char_start: 0,
            char_end: 24,
            content_hash: "orphan-hash".to_string(),
            chunk_strategy_version: 1,
            created_at: "1".to_string(),
        }],
    )
    .expect("orphan chunks should save");
    save_index_manifest(&dir, &[]).expect("empty manifest should save");

    let diagnostics = validate_all_indexes_in(&dir).expect("validation should scan orphan chunks");

    let entry = diagnostics
        .books
        .iter()
        .find(|entry| entry.book_id == "orphan-book")
        .expect("orphan chunk book should be visible in diagnostics");
    assert_eq!(entry.status, "stale");
    assert!(entry.stale_reason.contains("manifest 缺失"));
    assert_eq!(entry.chunk_count, 1);
    assert_eq!(diagnostics.summary.stale_book_count, 1);
}

#[test]
fn index_diagnostics_prunes_orphan_indexes_for_deleted_books() {
    let dir = unique_temp_library_dir();
    let chunks = vec![TextChunkRecord {
        id: "deleted-book-chunk-1".to_string(),
        book_id: "deleted-book".to_string(),
        book_title: "已删除书籍".to_string(),
        chapter: "正文".to_string(),
        ordinal: 0,
        text: "已经从书库和回收站移除的书籍不应继续显示索引状态。".to_string(),
        chapter_index: 0,
        chapter_title: "正文".to_string(),
        paragraph_start: 0,
        paragraph_end: 0,
        char_start: 0,
        char_end: 26,
        content_hash: "deleted-book-hash".to_string(),
        chunk_strategy_version: 1,
        created_at: "1".to_string(),
    }];
    save_chunk_records(&dir, &chunks).expect("orphan chunks should save");
    crate::database::save_chunks_to_fts(&dir, "deleted-book", &chunks)
        .expect("orphan fts rows should save");
    save_index_manifest(
        &dir,
        &[BookIndexManifest {
            book_id: "deleted-book".to_string(),
            book_title: "已删除书籍".to_string(),
            status: "ready".to_string(),
            content_hash: "deleted-book-hash".to_string(),
            chunk_count: 1,
            fts_row_count: 1,
            ..BookIndexManifest::default()
        }],
    )
    .expect("orphan manifest should save");

    let diagnostics = index_diagnostics_for_ui(&dir).expect("diagnostics should prune orphans");

    assert!(diagnostics
        .books
        .iter()
        .all(|entry| entry.book_id != "deleted-book"));
    assert!(load_chunk_records(&dir)
        .expect("chunks should load after orphan prune")
        .iter()
        .all(|chunk| chunk.book_id != "deleted-book"));
    assert_eq!(
        crate::database::count_book_fts_rows(&dir, "deleted-book")
            .expect("fts rows should count after orphan prune"),
        0
    );
    assert!(load_index_manifest(&dir)
        .expect("manifest should load after orphan prune")
        .iter()
        .all(|entry| entry.book_id != "deleted-book"));
}

#[test]
fn parse_runner_records_timing_and_throughput_diagnostics() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("性能诊断.txt");
    std::fs::write(
        &source,
        "第一章 性能\n索引任务应该记录阶段耗时。\n第二章 吞吐\n诊断输出应该包含 chunks/s 和 MB/s。",
    )
    .expect("source txt should be written");

    import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    let tasks = load_task_records(&dir)
        .expect("tasks should load")
        .into_iter()
        .collect::<Vec<_>>();
    let task = tasks
        .iter()
        .find(|task| {
            task.kind == TaskKind::PARSE_AND_INDEX && task.status == TaskRunStatus::SUCCEEDED
        })
        .expect("completed parse/index task should be present");

    assert!(task.duration_ms > 0);
    assert!(task.output_summary.chunks_per_second > 0.0);
    assert!(task.output_summary.mb_per_second > 0.0);
    assert!(task.output_summary.stage_durations_ms.read_file > 0);
    assert!(task.output_summary.stage_durations_ms.parse_chapters > 0);
    assert!(task.output_summary.stage_durations_ms.build_chunks > 0);
    assert!(task.output_summary.stage_durations_ms.write_chunks > 0);
    assert!(task.output_summary.stage_durations_ms.write_fts > 0);
    assert!(task.output_summary.stage_durations_ms.verify > 0);
    assert!(
        task.output_summary.warnings.is_empty(),
        "performance diagnostics should not be reported as task warnings"
    );
    let logs = load_task_logs_in(&dir, Some(&task.id)).expect("task logs should load");
    assert!(
        logs.iter().any(|log| {
            log.level == "debug" && log.message.contains("buildChunksDiagnostics splitMs=")
        }),
        "build chunk performance diagnostics should be available in debug task logs"
    );
}
