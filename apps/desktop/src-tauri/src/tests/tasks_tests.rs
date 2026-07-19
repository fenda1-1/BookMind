use super::*;

mod task_control_tests;
mod task_log_tests;
mod task_runner_tests;

#[test]
fn task_state_contract_values_serialize_to_frontend_strings() {
    assert_eq!(
        serde_json::to_string(&TaskRunStatus::Queued).expect("status should serialize"),
        "\"queued\""
    );
    assert_eq!(
        serde_json::to_string(&TaskRunStatus::Succeeded).expect("status should serialize"),
        "\"succeeded\""
    );
    assert_eq!(
        serde_json::to_string(&TaskKind::ParseAndIndex).expect("kind should serialize"),
        "\"parse-and-index\""
    );
    assert_eq!(
        serde_json::to_string(&TaskKind::RebuildIndex).expect("kind should serialize"),
        "\"rebuild-index\""
    );
    assert_eq!(
        serde_json::to_string(&TaskStage::ReadFile).expect("stage should serialize"),
        "\"read-file\""
    );
    assert_eq!(
        serde_json::to_string(&TaskStage::WriteFts).expect("stage should serialize"),
        "\"write-fts\""
    );
}

#[test]
fn task_error_contract_exposes_common_codes_and_structured_payload() {
    let models_source = include_str!("../models.rs");
    for required in [
        "pub(crate) struct TaskError",
        "code: String",
        "message: String",
        "stage: String",
        "retryable: bool",
        "detail: serde_json::Value",
        TaskErrorCode::BOOK_MISSING,
        TaskErrorCode::FILE_MISSING,
        TaskErrorCode::FILE_READ_FAILED,
        TaskErrorCode::CHAPTER_PARSE_FAILED,
        TaskErrorCode::CHUNK_WRITE_FAILED,
        TaskErrorCode::FTS_WRITE_FAILED,
        TaskErrorCode::MANIFEST_WRITE_FAILED,
        TaskErrorCode::CANCELLED_BY_USER,
    ] {
        assert!(
            models_source.contains(required),
            "TaskError contract should include {required}"
        );
    }

    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("结构化错误.txt");
    std::fs::write(&source, "移动源文件后应给出结构化任务错误。")
        .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    let mut records = load_library_records(&dir).expect("library should load");
    records[0].file_path = source_dir
        .join("missing-managed-copy.txt")
        .display()
        .to_string();
    save_library_records(&dir, &records).expect("library should save missing source path");
    run_parse_and_index_tasks_in(&dir)
        .expect("runner should persist failure instead of returning Err");

    let status = task_statuses_for_ui(&dir)
        .expect("statuses should load")
        .into_iter()
        .find(|task| task.book_id == book.id && task.kind == TaskKind::PARSE_AND_INDEX)
        .expect("failed task should be present");
    assert_eq!(status.error_code, TaskErrorCode::FILE_MISSING);
    assert_eq!(status.error_message, status.error.message);
    assert_eq!(status.error.code, TaskErrorCode::FILE_MISSING);
    assert_eq!(status.error.stage, TaskStage::READ_FILE);
    assert!(status.error.retryable);
    assert!(status
        .error
        .detail
        .get("bookId")
        .and_then(|value| value.as_str())
        .is_some());
}

#[test]
fn importing_book_creates_parse_index_dag_nodes() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("DAG任务.txt");
    std::fs::write(&source, "导入后应生成任务 DAG。").expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue DAG tasks");
    let tasks = load_task_records(&dir).expect("tasks should load");
    let book_tasks: Vec<_> = tasks
        .iter()
        .filter(|task| task.book_id == book.id)
        .collect();
    assert_eq!(
        book_tasks
            .iter()
            .map(|task| task.kind.as_str())
            .collect::<Vec<_>>(),
        vec![
            TaskKind::IMPORT_BOOK,
            TaskKind::PARSE_AND_INDEX,
            TaskKind::FULL_TEXT_INDEX,
            TaskKind::EMBEDDING_INDEX,
            TaskKind::AI_SUMMARY,
        ],
        "import should create the full DAG from import through AI summary"
    );

    let import_task = book_tasks[0];
    let parse_task = book_tasks[1];
    let full_text_task = book_tasks[2];
    let embedding_task = book_tasks[3];
    let summary_task = book_tasks[4];
    assert!(import_task.depends_on.is_empty());
    assert_eq!(parse_task.depends_on, vec![import_task.id.clone()]);
    assert_eq!(full_text_task.depends_on, vec![parse_task.id.clone()]);
    assert_eq!(embedding_task.depends_on, vec![full_text_task.id.clone()]);
    assert_eq!(summary_task.depends_on, vec![embedding_task.id.clone()]);
    assert_eq!(import_task.dag_id, parse_task.dag_id);
    assert_eq!(parse_task.dag_id, summary_task.dag_id);
}

#[test]
fn corrupted_task_queue_is_quarantined_and_rebuilt_before_import() {
    let dir = unique_temp_library_dir();
    let queue_path = task_file_path(&dir);
    std::fs::create_dir_all(queue_path.parent().expect("queue path should have parent"))
        .expect("task queue dir should be created");
    std::fs::write(&queue_path, "micro 里主要快捷键如下：\n\nCtrl + F 搜索\n")
        .expect("corrupted task queue should be written");
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("损坏队列导入.txt");
    std::fs::write(&source, "损坏任务队列不应阻止导入。").expect("source txt should be written");

    let book =
        import_book_from_path_into(&dir, &source).expect("import should repair corrupted queue");
    let tasks = load_task_records(&dir).expect("repaired task queue should load");
    let queue_raw = std::fs::read_to_string(&queue_path).expect("queue should be rebuilt");
    let quarantined_files = std::fs::read_dir(queue_path.parent().expect("queue parent"))
        .expect("task queue dir should be readable")
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .starts_with("queue.json.corrupt-")
        })
        .count();

    assert!(tasks
        .iter()
        .any(|task| task.book_id == book.id && task.kind == TaskKind::PARSE_AND_INDEX));
    assert!(queue_raw.trim_start().starts_with('['));
    assert!(!queue_raw.contains("micro 里主要快捷键"));
    assert_eq!(quarantined_files, 1);
}

#[test]
fn parse_runner_advances_index_dag_and_skips_unwired_placeholder_tasks() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("DAG推进.txt");
    std::fs::write(&source, "第1章 DAG推进\n解析完成后应推进全文索引节点。")
        .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue DAG tasks");
    run_parse_and_index_tasks_in(&dir)
        .expect("DAG runner should advance parse and full-text tasks");

    let tasks = load_task_records(&dir).expect("tasks should reload");
    let task_by_kind = |kind: &str| {
        tasks
            .iter()
            .find(|task| task.book_id == book.id && task.kind == kind)
            .unwrap_or_else(|| panic!("missing {kind} task"))
    };
    let parse_task = task_by_kind(TaskKind::PARSE_AND_INDEX);
    let full_text_task = task_by_kind(TaskKind::FULL_TEXT_INDEX);
    let embedding_task = task_by_kind(TaskKind::EMBEDDING_INDEX);
    let summary_task = task_by_kind(TaskKind::AI_SUMMARY);

    assert_eq!(parse_task.status, TaskRunStatus::SUCCEEDED);
    assert_eq!(full_text_task.status, TaskRunStatus::SUCCEEDED);
    assert_eq!(full_text_task.depends_on, vec![parse_task.id.clone()]);
    assert_eq!(embedding_task.status, TaskRunStatus::SKIPPED);
    assert_eq!(embedding_task.stage, TaskStage::DONE);
    assert_eq!(embedding_task.progress, 100.0);
    assert_eq!(embedding_task.blocked_by, Vec::<String>::new());
    assert!(embedding_task.message.contains("语义向量索引尚未接入"));
    assert_eq!(summary_task.status, TaskRunStatus::SKIPPED);
    assert_eq!(summary_task.stage, TaskStage::DONE);
    assert_eq!(summary_task.progress, 100.0);
    assert_eq!(summary_task.blocked_by, Vec::<String>::new());
    assert!(summary_task.message.contains("AI 摘要尚未接入"));
}

#[test]
fn parse_runner_starts_concurrent_batch_with_one_index_task_per_book() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let first_source = source_dir.join("并发队列-A.txt");
    let second_source = source_dir.join("并发队列-B.txt");
    std::fs::write(
        &first_source,
        "第1章 A\n并发队列应允许不同书籍同时开始解析索引。",
    )
    .expect("first source should be written");
    std::fs::write(
        &second_source,
        "第1章 B\n同一本书不能在同一批次同时运行两个索引任务。",
    )
    .expect("second source should be written");
    let first = import_book_from_path_into(&dir, &first_source).expect("first book should import");
    let second =
        import_book_from_path_into(&dir, &second_source).expect("second book should import");
    crate::settings::save_settings_v2(
        &dir,
        &crate::models::SettingsV2 {
            extended: serde_json::json!({
                "taskConcurrency": "2",
                "parseConcurrency": "2",
                "vectorConcurrencyReserved": "0"
            }),
            ..Default::default()
        },
    )
    .expect("settings v2 should save parse concurrency");
    save_task_records(
        &dir,
        &[
            TaskRecord {
                id: "task-parse-a".to_string(),
                book_id: first.id.clone(),
                kind: TaskKind::PARSE_AND_INDEX.to_string(),
                message: "A 解析排队".to_string(),
                ..TaskRecord::default()
            },
            TaskRecord {
                id: "task-rebuild-a".to_string(),
                book_id: first.id.clone(),
                kind: TaskKind::REBUILD_INDEX.to_string(),
                message: "A 重建排队".to_string(),
                ..TaskRecord::default()
            },
            TaskRecord {
                id: "task-parse-b".to_string(),
                book_id: second.id.clone(),
                kind: TaskKind::PARSE_AND_INDEX.to_string(),
                message: "B 解析排队".to_string(),
                ..TaskRecord::default()
            },
        ],
    )
    .expect("custom task queue should save");
    let sink = RecordingTaskProgressSink::default();

    run_parse_and_index_tasks_with_events_in(&dir, &sink)
        .expect("runner should finish queued tasks");

    let events = sink.events.lock().expect("events should lock");
    let first_completion_index = events
        .iter()
        .position(|(reason, _)| reason == "task-completed")
        .expect("at least one task should complete");
    let started_before_first_completion: Vec<_> = events[..first_completion_index]
        .iter()
        .filter(|(reason, _)| reason == "task-started")
        .map(|(_, status)| status.book_id.clone())
        .collect();
    assert_eq!(
        started_before_first_completion,
        vec![first.id.clone(), second.id.clone()],
        "concurrent batch should start two different books before either one completes"
    );
    assert_eq!(
        load_task_records(&dir)
            .expect("tasks should reload")
            .iter()
            .filter(|task| task.book_id == first.id && task.status == TaskRunStatus::RUNNING)
            .count(),
        0,
        "same-book parse and rebuild tasks must never remain running together"
    );
    let completed_tasks = load_task_records(&dir).expect("completed tasks should reload");
    for book in [&first, &second] {
        let manifest = load_index_manifest(&dir).expect("manifest should reload");
        let entry = manifest
            .iter()
            .find(|entry| entry.book_id == book.id)
            .expect("each concurrently indexed book should have a manifest entry");
        let chunks =
            load_book_chunk_records(&dir, &book.id).expect("book chunks should load after batch");
        let fts_rows = crate::database::count_book_fts_rows(&dir, &book.id)
            .expect("book FTS rows should count after batch");
        let task = completed_tasks
            .iter()
            .find(|task| task.book_id == book.id && task.kind == TaskKind::PARSE_AND_INDEX)
            .expect("parse task should exist after batch");

        assert_eq!(task.status, TaskRunStatus::SUCCEEDED);
        assert_eq!(entry.status, "ready");
        assert_eq!(entry.chunk_count, chunks.len());
        assert_eq!(entry.fts_row_count, fts_rows);
        assert_eq!(chunks.len(), fts_rows);
        assert!(chunks.len() > 0);
    }
}

#[test]
fn task_runner_source_uses_named_helpers_and_central_state_constants() {
    let tasks_source = include_str!("../tasks.rs");
    let task_kinds_source = include_str!("../tasks/kinds.rs");
    let task_runner_source = include_str!("../tasks/runner.rs");
    let task_progress_source = include_str!("../tasks/progress.rs");
    let library_source = include_str!("../library.rs");
    let commands_source = include_str!("../commands.rs");

    for required in [
        "fn run_queued_tasks_in",
        "fn run_index_task_batch",
        "fn select_runnable_index_task_ids",
        "fn build_index_output_for_task",
    ] {
        assert!(
            task_runner_source.contains(required),
            "task runner module should expose helper: {required}"
        );
    }

    for required in [
        "fn mark_task_stage",
        "fn complete_task",
        "fn fail_task",
        "fn append_task_log",
    ] {
        assert!(
            task_progress_source.contains(required),
            "task progress module should expose helper: {required}"
        );
    }

    for required in [
        "fn is_runnable_task_kind",
        "fn is_restorable_archived_task_kind",
        "fn update_dag_blockers",
        "fn complete_ready_placeholder_dag_tasks",
    ] {
        assert!(
            task_kinds_source.contains(required),
            "task kinds module should expose helper: {required}"
        );
    }

    for forbidden in [
        "\"queued\"",
        "\"running\"",
        "\"paused\"",
        "\"cancelling\"",
        "\"cancelled\"",
        "\"failed\"",
        "\"succeeded\"",
        "\"skipped\"",
        "\"archived\"",
        "\"parse-and-index\"",
        "\"rebuild-index\"",
        "\"read-file\"",
        "\"parse-chapters\"",
        "\"build-chunks\"",
        "\"write-chunks\"",
        "\"write-fts\"",
        "\"verify\"",
        "\"done\"",
    ] {
        assert!(
            !tasks_source.contains(forbidden),
            "tasks.rs should use centralized task state constants instead of {forbidden}"
        );
        assert!(
            !library_source.contains(forbidden),
            "library.rs should use centralized task state constants instead of {forbidden}"
        );
    }

    let command_start = commands_source
        .find("pub(crate) async fn run_parse_and_index_tasks(")
        .expect("run_parse_and_index_tasks command should exist");
    let next_command = commands_source[command_start + 1..]
        .find("#[tauri::command]")
        .expect("run_parse_and_index_tasks should be followed by another command")
        + command_start
        + 1;
    let run_command_source = &commands_source[command_start..next_command];
    assert!(
        run_command_source.contains("app: tauri::AppHandle"),
        "parse/index Tauri command must accept an AppHandle so it can stream task progress events"
    );
    assert!(
        run_command_source.contains("tauri::async_runtime::spawn(async move"),
        "parse/index Tauri command must detach a true background worker so the UI command can return immediately"
    );
    assert!(
        run_command_source.contains("spawn_blocking(move ||")
            && run_command_source.contains("run_parse_and_index_tasks_with_events_in(&blocking_data_dir"),
        "parse/index background worker must still move heavy 10MB+ TXT indexing work onto a blocking thread"
    );
    let detached_spawn_position = run_command_source
        .find("tauri::async_runtime::spawn(async move")
        .expect("run_parse_and_index_tasks should start a detached async worker");
    let status_return_position = run_command_source
        .find("task_statuses_for_ui(&data_dir)")
        .expect("run_parse_and_index_tasks should return current task statuses");
    let after_detached_spawn = &run_command_source[detached_spawn_position..status_return_position];
    let detached_spawn_end = after_detached_spawn
        .rfind("\n    });")
        .expect("detached worker spawn should end before returning task statuses");
    let outer_command_after_spawn = &after_detached_spawn[detached_spawn_end..];
    assert!(
        !outer_command_after_spawn.contains(".await"),
        "parse/index Tauri command must not await the detached indexing worker before returning statuses to the UI"
    );

    assert!(
        commands_source.contains("emit_task_progress_event")
            && commands_source.contains("\"bookmind://task-progress\"")
            && commands_source.contains("app.emit("),
        "parse/index background worker must emit task-progress events through Tauri instead of relying only on polling"
    );
    assert!(
        tasks_source.contains("TaskProgressEventSink")
            && tasks_source.contains("run_parse_and_index_tasks_with_events_in")
            && tasks_source.contains("emit_task_progress"),
        "task runner must expose an event sink and emit progress whenever task state changes"
    );

    let diagnostics_command_start = commands_source
        .find("pub(crate) async fn get_index_diagnostics(")
        .expect("get_index_diagnostics command should be async");
    let diagnostics_next_command = commands_source[diagnostics_command_start + 1..]
        .find("#[tauri::command]")
        .expect("get_index_diagnostics should be followed by another command")
        + diagnostics_command_start
        + 1;
    let diagnostics_command_source =
        &commands_source[diagnostics_command_start..diagnostics_next_command];
    assert!(
        diagnostics_command_source
            .contains("spawn_blocking(move || index_diagnostics_for_ui(&blocking_data_dir))")
            && diagnostics_command_source.contains(".await"),
        "index diagnostics command must move full chunk/FTS scanning off the async command thread"
    );
    let validate_command_start = commands_source
        .find("pub(crate) async fn validate_all_indexes(")
        .expect("validate_all_indexes command should be async");
    let validate_next_command = commands_source[validate_command_start + 1..]
        .find("#[tauri::command]")
        .expect("validate_all_indexes should be followed by another command")
        + validate_command_start
        + 1;
    let validate_command_source = &commands_source[validate_command_start..validate_next_command];
    assert!(
        validate_command_source
            .contains("spawn_blocking(move || validate_all_indexes_in(&blocking_data_dir))")
            && validate_command_source.contains(".await"),
        "index validation command must move full consistency scanning off the async command thread"
    );
}

#[test]
fn completed_tasks_can_be_archived_and_cleared_without_removing_indexes() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("归档清理.txt");
    std::fs::write(&source, "清理任务记录不能删除索引产物。")
        .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    let tasks = load_task_records(&dir).expect("tasks should load");
    let task_id = parse_task_for_book(&tasks, &book.id).id.clone();

    let archived = archive_task_in(&dir, &task_id).expect("task should archive");
    assert_eq!(archived.status, "archived");
    let remaining = clear_completed_tasks_in(&dir).expect("completed tasks should clear");
    assert!(remaining
        .iter()
        .all(|task| !is_completed_status_for_test(&task.status)));

    let manifest = load_index_manifest(&dir).expect("manifest should remain");
    assert!(manifest.iter().any(|entry| entry.book_id == book.id));
}

#[test]
fn archived_task_can_be_restored_without_consuming_retry_attempts() {
    let dir = unique_temp_library_dir();
    let task_id = "task-archived-restore".to_string();
    save_task_records(
        &dir,
        &[TaskRecord {
            id: task_id.clone(),
            book_id: "book-restore".to_string(),
            kind: TaskKind::EMBEDDING_INDEX.to_string(),
            status: TaskRunStatus::ARCHIVED.to_string(),
            progress: 0.0,
            stage: TaskStage::DONE.to_string(),
            attempt: 3,
            max_attempts: 3,
            message: "任务已归档".to_string(),
            ..TaskRecord::default()
        }],
    )
    .expect("archived task should save");

    let restored =
        restore_archived_task_in(&dir, &task_id).expect("archived task should restore to queue");

    assert_eq!(restored.status, TaskRunStatus::QUEUED);
    assert_eq!(restored.stage, TaskStage::QUEUED);
    assert_eq!(restored.progress, 0.0);
    assert_eq!(restored.attempt, 3);
    assert_eq!(restored.max_attempts, 3);
    assert!(restored.message.contains("恢复"));
}

#[test]
fn archived_non_index_tasks_cannot_be_restored_to_dead_queue() {
    let dir = unique_temp_library_dir();
    let task_id = "task-archived-import".to_string();
    save_task_records(
        &dir,
        &[TaskRecord {
            id: task_id.clone(),
            book_id: "book-import".to_string(),
            kind: TaskKind::IMPORT_BOOK.to_string(),
            status: TaskRunStatus::ARCHIVED.to_string(),
            progress: 100.0,
            stage: TaskStage::DONE.to_string(),
            message: "任务已归档".to_string(),
            ..TaskRecord::default()
        }],
    )
    .expect("archived import task should save");

    let error = restore_archived_task_in(&dir, &task_id)
        .expect_err("non-index archived tasks should not restore into a dead queue");

    assert!(error.contains("没有可恢复的后台执行器"));
    let tasks = load_task_records(&dir).expect("tasks should reload");
    assert_eq!(tasks[0].status, TaskRunStatus::ARCHIVED);
}

#[test]
fn parse_runner_honors_cancel_requested_from_streamed_stage_update() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("阶段取消.txt");
    let mut content = String::from("第1章 阶段取消\n");
    for index in 0..2400 {
        content.push_str(&format!(
            "这是第 {index} 段用于触发多阶段索引，用户点击取消后 runner 不能用内存快照覆盖取消请求。\n"
        ));
    }
    std::fs::write(&source, content).expect("large-ish txt fixture should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    let sink = CancellingTaskProgressSink::new(dir.clone(), TaskStage::BUILD_CHUNKS);
    run_parse_and_index_tasks_with_events_in(&dir, &sink)
        .expect("parse/index task runner should honor cancellation");

    let tasks = load_task_records(&dir).expect("tasks should reload");
    let task = parse_task_for_book(&tasks, &book.id);
    assert_eq!(task.status, TaskRunStatus::CANCELLED);
    assert_eq!(task.stage, TaskStage::DONE);
    assert_eq!(task.error_code, TaskErrorCode::CANCELLED_BY_USER);
    let events = sink.events.lock().expect("progress events should lock");
    assert!(
        events
            .iter()
            .any(|(reason, status)| reason == "task-cancelled" && status.id == task.id),
        "runner should emit a terminal cancellation event after a streamed-stage cancellation"
    );
    assert!(
        load_book_chunk_records(&dir, &book.id)
            .expect("book chunks should load")
            .is_empty(),
        "cancelled large indexing must not commit chunks or FTS rows"
    );
}

#[test]
fn parse_runner_honors_pause_requested_from_streamed_stage_update() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("阶段暂停.txt");
    let mut content = String::from("第1章 阶段暂停\n");
    for index in 0..2400 {
        content.push_str(&format!(
            "这是第 {index} 段用于触发多阶段索引，用户点击暂停后 runner 不能提交半成品索引。\n"
        ));
    }
    std::fs::write(&source, content).expect("large-ish txt fixture should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    let sink = PausingTaskProgressSink::new(dir.clone(), TaskStage::BUILD_CHUNKS);
    run_parse_and_index_tasks_with_events_in(&dir, &sink)
        .expect("parse/index task runner should honor pause request");

    let tasks = load_task_records(&dir).expect("tasks should reload");
    let task = parse_task_for_book(&tasks, &book.id);
    assert_eq!(task.status, TaskRunStatus::PAUSED);
    assert_eq!(task.stage, TaskStage::BUILD_CHUNKS);
    assert_eq!(task.message, "任务已暂停，等待继续执行");
    let events = sink.events.lock().expect("progress events should lock");
    assert!(
        events
            .iter()
            .any(|(reason, status)| reason == "task-paused" && status.id == task.id),
        "runner should emit a terminal pause event after a streamed-stage pause request"
    );
    assert!(
        load_book_chunk_records(&dir, &book.id)
            .expect("book chunks should load")
            .is_empty(),
        "paused large indexing must not commit chunks or FTS rows"
    );
    assert!(
        load_index_manifest(&dir)
            .expect("manifest should load")
            .iter()
            .all(|entry| entry.book_id != book.id),
        "paused indexing must not commit a ready manifest"
    );
}

#[test]
fn parse_runner_skips_paused_and_cancelled_tasks() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let paused_source = source_dir.join("暂停任务.txt");
    let cancelled_source = source_dir.join("取消任务.txt");
    std::fs::write(&paused_source, "暂停任务不应该生成索引。")
        .expect("paused source should be written");
    std::fs::write(&cancelled_source, "取消任务不应该生成索引。")
        .expect("cancelled source should be written");

    let paused_book =
        import_book_from_path_into(&dir, &paused_source).expect("paused import should queue");
    let cancelled_book =
        import_book_from_path_into(&dir, &cancelled_source).expect("cancelled import should queue");
    let tasks = load_task_records(&dir).expect("tasks should load");
    let paused_task_id = parse_task_for_book(&tasks, &paused_book.id).id.clone();
    let cancelled_task_id = parse_task_for_book(&tasks, &cancelled_book.id).id.clone();
    pause_task_in(&dir, &paused_task_id).expect("first task should pause");
    cancel_task_in(&dir, &cancelled_task_id).expect("second task should cancel");

    let after_run = run_parse_and_index_tasks_in(&dir).expect("runner should skip held tasks");
    assert_eq!(
        after_run
            .iter()
            .find(|task| task.id == paused_task_id)
            .unwrap()
            .status,
        "paused"
    );
    assert_eq!(
        after_run
            .iter()
            .find(|task| task.id == cancelled_task_id)
            .unwrap()
            .status,
        "cancelled"
    );
    assert!(search_index_in(&dir, "不应该生成索引")
        .expect("search should work")
        .is_empty());
}
