use super::*;

#[test]
fn delete_book_index_removes_chunks_fts_rows_and_manifest() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("删除索引.txt");
    std::fs::write(&source, "删除索引应该移除 chunk、FTS rows 和 manifest。")
        .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    assert!(!load_book_chunk_records(&dir, &book.id)
        .expect("book chunks should load")
        .is_empty());

    delete_book_index_in(&dir, &book.id).expect("book index should delete");

    assert!(load_chunk_records(&dir)
        .expect("chunks should load")
        .iter()
        .all(|chunk| chunk.book_id != book.id));
    assert!(load_book_chunk_records(&dir, &book.id)
        .expect("fts rows should load")
        .is_empty());
    assert!(load_index_manifest(&dir)
        .expect("manifest should load")
        .iter()
        .all(|entry| entry.book_id != book.id));
}

#[test]
fn repair_book_fts_rewrites_fts_rows_from_existing_chunks_without_dropping_manifest() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("修复fts.txt");
    std::fs::write(
        &source,
        "修复 FTS 应该只从已有 chunks 重写全文索引，不删除 manifest。",
    )
    .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    let chunks = load_chunk_records(&dir).expect("chunks should load");
    let expected_count = chunks
        .iter()
        .filter(|chunk| chunk.book_id == book.id)
        .count();
    assert!(expected_count > 0);

    delete_book_fts_index_rows(&dir, &book.id)
        .expect("fts rows should be removed for repair setup");
    let before = index_diagnostics_for_ui(&dir).expect("diagnostics should load");
    assert!(before
        .books
        .iter()
        .any(|entry| entry.book_id == book.id && entry.fts_row_count == 0));

    let diagnostics = repair_book_fts_in(&dir, &book.id).expect("fts should repair");

    let repaired = diagnostics
        .books
        .iter()
        .find(|entry| entry.book_id == book.id)
        .expect("book manifest should remain");
    assert_eq!(repaired.chunk_count, expected_count);
    assert_eq!(repaired.fts_row_count, expected_count);
    assert!(load_index_manifest(&dir)
        .expect("manifest should load")
        .iter()
        .any(|entry| entry.book_id == book.id));
}

#[test]
fn rebuild_book_index_creates_rebuild_task_with_clear_message() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("重建索引.txt");
    std::fs::write(&source, "重建索引应创建 rebuild-index 任务。")
        .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    let task = rebuild_book_index_in(&dir, &book.id).expect("rebuild task should create");

    assert_eq!(task.kind, "rebuild-index");
    assert_eq!(task.book_id, book.id);
    assert!(task
        .id
        .starts_with(&format!("task-rebuild-index-{}-", book.id)));
    assert_eq!(task.status, "queued");
    assert!(task
        .message
        .contains("已排队重建索引，将删除旧 chunks 后重新写入"));
}

#[test]
fn runner_executes_rebuild_index_task_after_index_deleted() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("执行重建索引.txt");
    std::fs::write(&source, "执行 rebuild-index 后应恢复可检索 chunks。")
        .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("initial parse/index should run");
    delete_book_index_in(&dir, &book.id).expect("book index should delete");
    rebuild_book_index_in(&dir, &book.id).expect("rebuild should queue");

    run_parse_and_index_tasks_in(&dir).expect("runner should execute rebuild task");

    assert!(!load_book_chunk_records(&dir, &book.id)
        .expect("book chunks should reload")
        .is_empty());
    let manifest = load_index_manifest(&dir).expect("manifest should load");
    assert!(manifest
        .iter()
        .any(|entry| entry.book_id == book.id && entry.status == "ready"));
    let tasks = load_task_records(&dir).expect("tasks should reload");
    assert!(tasks
        .iter()
        .any(|task| task.kind == "rebuild-index" && task.status == "succeeded"));
}

#[test]
fn rebuild_failure_preserves_existing_index_outputs() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("失败保留旧索引.txt");
    std::fs::write(&source, "重建失败时旧索引仍应保留。").expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("initial parse/index should run");
    let old_chunks = load_book_chunk_records(&dir, &book.id).expect("old chunks should exist");
    assert!(!old_chunks.is_empty());

    let mut records = load_library_records(&dir).expect("library should load");
    records[0].file_path = source_dir.join("missing.txt").display().to_string();
    save_library_records(&dir, &records).expect("library should save missing source");
    rebuild_book_index_in(&dir, &book.id).expect("rebuild should queue");

    run_parse_and_index_tasks_in(&dir)
        .expect("runner should fail rebuild without deleting old index");

    let tasks = load_task_records(&dir).expect("tasks should reload");
    assert!(tasks.iter().any(|task| task.kind == "rebuild-index"
        && task.status == "failed"
        && task.error_code == TaskErrorCode::FILE_MISSING));
    assert_eq!(
        load_book_chunk_records(&dir, &book.id)
            .expect("old fts chunks should remain")
            .len(),
        old_chunks.len()
    );
    assert!(load_index_manifest(&dir)
        .expect("manifest should remain")
        .iter()
        .any(|entry| entry.book_id == book.id));
}

#[test]
fn parse_runner_streams_task_started_stage_and_completion_events() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("事件流任务.txt");
    std::fs::write(
        &source,
        "第1章 事件流\n任务中心应该不依赖轮询也能看到开始、阶段和完成进度。",
    )
    .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    let sink = RecordingTaskProgressSink::default();
    run_parse_and_index_tasks_with_events_in(&dir, &sink)
        .expect("parse/index task should run with progress events");

    let events = sink.events.lock().expect("progress events should lock");
    let reasons: Vec<&str> = events.iter().map(|(reason, _)| reason.as_str()).collect();
    assert!(
        reasons.first() == Some(&"task-started"),
        "first progress event should tell the frontend the task started without waiting for polling: {reasons:?}"
    );
    assert!(
        reasons.contains(&"stage-updated"),
        "runner should stream stage progress events without polling: {reasons:?}"
    );
    assert!(
        reasons.last() == Some(&"task-completed"),
        "last progress event should tell the frontend the task reached a terminal state: {reasons:?}"
    );

    let started = events
        .iter()
        .find(|(reason, _)| reason == "task-started")
        .expect("task-started event should exist");
    assert_eq!(started.1.book_id, book.id);
    assert_eq!(started.1.status, TaskRunStatus::RUNNING);
    assert_eq!(started.1.stage, TaskStage::READ_FILE);
    assert_eq!(started.1.progress, 0.0);

    let completed = events
        .iter()
        .find(|(reason, _)| reason == "task-completed")
        .expect("task-completed event should exist");
    assert_eq!(completed.1.book_id, book.id);
    assert_eq!(completed.1.status, TaskRunStatus::SUCCEEDED);
    assert_eq!(completed.1.progress, 100.0);
    assert!(
        completed.1.log_count > 0,
        "streamed task payloads should include the current task log count"
    );
}

#[test]
fn parse_runner_streams_and_persists_heavy_index_build_stages() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("大文件阶段进度.txt");
    let mut content = String::from("第1章 大文件阶段\n");
    for index in 0..2400 {
        content.push_str(&format!(
            "这是第 {index} 段用于模拟 100MB TXT 的长文本，索引时应该持续写入阶段进度并允许用户取消。\n"
        ));
    }
    std::fs::write(&source, content).expect("large-ish txt fixture should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    let sink = RecordingTaskProgressSink::default();
    run_parse_and_index_tasks_with_events_in(&dir, &sink)
        .expect("parse/index task should run with progress events");

    let events = sink.events.lock().expect("progress events should lock");
    let stage_events: Vec<_> = events
        .iter()
        .filter(|(reason, _)| reason == "stage-updated")
        .map(|(_, status)| status)
        .collect();
    let stages: Vec<String> = stage_events
        .iter()
        .map(|status| status.stage.clone())
        .collect();
    for required_stage in [
        TaskStage::READ_FILE,
        TaskStage::PARSE_CHAPTERS,
        TaskStage::BUILD_CHUNKS,
        TaskStage::WRITE_CHUNKS,
        TaskStage::WRITE_FTS,
        TaskStage::VERIFY,
    ] {
        assert!(
            stages.iter().any(|stage| stage == required_stage),
            "large TXT indexing must stream required stage {required_stage}: {stages:?}"
        );
    }
    assert!(
        stage_events.len() > 6,
        "large TXT indexing must stream intra-stage progress, not only six stage boundary jumps: {stages:?}"
    );
    let progress_values: Vec<f64> = stage_events
        .iter()
        .map(|status| {
            status
                .progress
                .to_string()
                .parse::<f64>()
                .expect("progress should parse")
        })
        .collect();
    assert!(
        progress_values.iter().any(|progress| progress.fract() > 0.0),
        "progress stream should include decimal percentages for smooth UI updates: {progress_values:?}"
    );
    assert!(
        stage_events
            .iter()
            .any(|status| status.stage == TaskStage::BUILD_CHUNKS
                && status.output_summary.chunks > 0),
        "build-chunks events should carry partial chunk counts before the task completes"
    );
    assert!(
        stage_events.iter().any(
            |status| status.stage == TaskStage::WRITE_FTS && status.output_summary.fts_rows > 0
        ),
        "write-fts events should carry partial FTS row counts before the task completes"
    );
    let tasks = load_task_records(&dir).expect("tasks should reload");
    let persisted = parse_task_for_book(&tasks, &book.id);
    assert_eq!(persisted.status, TaskRunStatus::SUCCEEDED);
    assert_eq!(persisted.stage, TaskStage::DONE);
    assert!(persisted.output_summary.bytes_read > 80_000);
    assert!(persisted.output_summary.stage_durations_ms.read_file > 0);
    assert!(persisted.output_summary.stage_durations_ms.parse_chapters > 0);
    assert!(persisted.output_summary.stage_durations_ms.build_chunks > 0);
}
