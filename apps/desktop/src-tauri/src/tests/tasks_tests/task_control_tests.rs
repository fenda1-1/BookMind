use super::*;

#[test]
fn task_controls_pause_retry_and_cancel_parse_tasks() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("控制测试.txt");
    std::fs::write(&source, "任务控制应该可暂停、重试、取消。")
        .expect("source txt should be written");

    import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    let queued = load_task_records(&dir).expect("tasks should load");
    let task_id = queued[0].id.clone();

    let paused = pause_task_in(&dir, &task_id).expect("task should pause");
    assert_eq!(paused.status, "paused");
    assert_eq!(paused.message, "任务已暂停，等待继续执行");
    assert_eq!(paused.attempt, 0);

    let retried = retry_task_in(&dir, &task_id).expect("task should retry");
    assert_eq!(retried.status, "queued");
    assert_eq!(retried.progress, 0.0);
    assert_eq!(retried.message, "任务已继续执行");
    assert_eq!(retried.attempt, paused.attempt);

    let cancelled = cancel_task_in(&dir, &task_id).expect("task should cancel");
    assert_eq!(cancelled.status, "cancelled");
    assert_eq!(cancelled.message, "任务已取消");
}

#[test]
fn batch_task_controls_only_update_matching_statuses() {
    let dir = unique_temp_library_dir();
    let mut tasks: Vec<crate::models::TaskRecord> = (0..5)
        .map(|index| crate::models::TaskRecord {
            id: format!("batch-task-{index}"),
            book_id: format!("batch-book-{index}"),
            kind: TaskKind::PARSE_AND_INDEX.to_string(),
            ..crate::models::TaskRecord::default()
        })
        .collect();
    tasks[0].status = TaskRunStatus::QUEUED.to_string();
    tasks[1].status = TaskRunStatus::QUEUED.to_string();
    tasks[2].status = TaskRunStatus::FAILED.to_string();
    tasks[2].stage = TaskStage::READ_FILE.to_string();
    tasks[2].progress = 35.0;
    tasks[2].attempt = 1;
    tasks[2].error_code = TaskErrorCode::FILE_READ_FAILED.to_string();
    tasks[2].error_message = "读取失败".to_string();
    tasks[3].status = TaskRunStatus::FAILED.to_string();
    tasks[3].attempt = 3;
    tasks[3].max_attempts = 3;
    tasks[4].status = TaskRunStatus::RUNNING.to_string();
    let queued_ids = [tasks[0].id.clone(), tasks[1].id.clone()];
    let retryable_failed_id = tasks[2].id.clone();
    let exhausted_failed_id = tasks[3].id.clone();
    let running_id = tasks[4].id.clone();
    save_task_records(&dir, &tasks).expect("mixed tasks should save");

    let cancelled = cancel_queued_tasks_in(&dir).expect("queued tasks should cancel");
    assert_eq!(cancelled.len(), 2);
    let after_cancel = load_task_records(&dir).expect("tasks should reload after cancel");
    for task_id in queued_ids {
        let task = after_cancel.iter().find(|task| task.id == task_id).unwrap();
        assert_eq!(task.status, TaskRunStatus::CANCELLED);
        assert_eq!(task.stage, TaskStage::DONE);
        assert_eq!(task.error_code, TaskErrorCode::CANCELLED_BY_USER);
    }
    assert_eq!(
        after_cancel
            .iter()
            .find(|task| task.id == retryable_failed_id)
            .unwrap()
            .status,
        TaskRunStatus::FAILED
    );
    assert_eq!(
        after_cancel
            .iter()
            .find(|task| task.id == running_id)
            .unwrap()
            .status,
        TaskRunStatus::RUNNING
    );

    let retried = retry_failed_tasks_in(&dir).expect("retryable failed tasks should retry");
    assert_eq!(retried.len(), 1);
    assert_eq!(retried[0].id, retryable_failed_id);
    assert_eq!(retried[0].status, TaskRunStatus::QUEUED);
    assert_eq!(retried[0].stage, TaskStage::QUEUED);
    assert_eq!(retried[0].progress, 0.0);
    assert_eq!(retried[0].attempt, 2);
    assert!(retried[0].error_code.is_empty());
    let after_retry = load_task_records(&dir).expect("tasks should reload after retry");
    assert_eq!(
        after_retry
            .iter()
            .find(|task| task.id == exhausted_failed_id)
            .unwrap()
            .status,
        TaskRunStatus::FAILED
    );

    let mut tasks = load_task_records(&dir).expect("tasks should load before pause");
    tasks
        .iter_mut()
        .filter(|task| task.status == TaskRunStatus::CANCELLED)
        .for_each(|task| task.status = TaskRunStatus::QUEUED.to_string());
    save_task_records(&dir, &tasks).expect("queued tasks should save before pause");

    let paused = pause_queued_tasks_in(&dir).expect("queued tasks should pause");
    assert_eq!(paused.len(), 3);
    assert!(paused
        .iter()
        .all(|task| task.status == TaskRunStatus::PAUSED
            && task.message == "任务已暂停，等待继续执行"));
    let after_pause = load_task_records(&dir).expect("tasks should reload after pause");
    assert_eq!(
        after_pause
            .iter()
            .find(|task| task.id == running_id)
            .unwrap()
            .status,
        TaskRunStatus::RUNNING
    );
}

#[test]
fn cancel_running_task_marks_cancelling_until_runner_boundary() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("运行中取消.txt");
    std::fs::write(&source, "运行中取消应在阶段边界变为 cancelled。")
        .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    let mut tasks = load_task_records(&dir).expect("tasks should load");
    let parse_index = tasks
        .iter()
        .position(|task| task.book_id == book.id && task.kind == TaskKind::PARSE_AND_INDEX)
        .expect("parse task should exist");
    tasks[parse_index].status = "running".to_string();
    tasks[parse_index].stage = "read-file".to_string();
    tasks[parse_index].progress = 10.0;
    let task_id = tasks[parse_index].id.clone();
    save_task_records(&dir, &tasks).expect("running task should save");

    let cancelling = cancel_task_in(&dir, &task_id).expect("running task should request cancel");
    assert_eq!(cancelling.status, "cancelling");
    assert_eq!(cancelling.progress, 10.0);

    run_parse_and_index_tasks_in(&dir).expect("runner should observe cancellation");
    let after = load_task_records(&dir).expect("tasks should reload");
    let after_parse = parse_task_for_book(&after, &book.id);
    assert_eq!(after_parse.status, "cancelled");
    assert_eq!(after_parse.stage, "done");
    assert_eq!(after_parse.error_code, "cancelled_by_user");
}

#[test]
fn parse_runner_streams_cancelled_terminal_events() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("取消事件流.txt");
    std::fs::write(&source, "取消任务应通过事件流通知前端。")
        .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    let mut tasks = load_task_records(&dir).expect("tasks should load");
    let parse_index = tasks
        .iter()
        .position(|task| task.book_id == book.id && task.kind == TaskKind::PARSE_AND_INDEX)
        .expect("parse task should exist");
    tasks[parse_index].status = TaskRunStatus::CANCELLING.to_string();
    tasks[parse_index].stage = TaskStage::READ_FILE.to_string();
    tasks[parse_index].progress = 10.0;
    let task_id = tasks[parse_index].id.clone();
    save_task_records(&dir, &tasks).expect("cancelling task should save");

    let sink = RecordingTaskProgressSink::default();
    run_parse_and_index_tasks_with_events_in(&dir, &sink)
        .expect("runner should observe cancellation with progress events");

    let events = sink.events.lock().expect("progress events should lock");
    let cancelled = events
        .iter()
        .find(|(reason, status)| reason == "task-cancelled" && status.id == task_id)
        .expect("cancelled terminal progress event should exist");
    assert_eq!(cancelled.1.status, TaskRunStatus::CANCELLED);
    assert_eq!(cancelled.1.stage, TaskStage::DONE);
    assert_eq!(cancelled.1.error_code, TaskErrorCode::CANCELLED_BY_USER);
}

#[test]
fn runner_resumes_stale_running_tasks_after_restart() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("残留运行中.txt");
    std::fs::write(&source, "上次运行中断的任务应该在下次启动时恢复续跑。")
        .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    let mut tasks = load_task_records(&dir).expect("tasks should load");
    let parse_index = tasks
        .iter()
        .position(|task| task.book_id == book.id && task.kind == TaskKind::PARSE_AND_INDEX)
        .expect("parse task should exist");
    tasks[parse_index].status = "running".to_string();
    tasks[parse_index].stage = "write-fts".to_string();
    tasks[parse_index].progress = 85.0;
    save_task_records(&dir, &tasks).expect("running task should save");

    run_parse_and_index_tasks_in(&dir).expect("runner should recover stale running task");
    let after = load_task_records(&dir).expect("tasks should reload");
    let after_parse = parse_task_for_book(&after, &book.id);
    assert_eq!(after_parse.status, "succeeded");
    assert_eq!(after_parse.stage, "done");
    assert!(after_parse.error_code.is_empty());
    assert!(search_index_in(&dir, "恢复续跑")
        .expect("search should work")
        .iter()
        .any(|result| result.book_id == book.id));
    let logs = load_task_logs_in(&dir, Some(&after_parse.id)).expect("task logs should load");
    assert!(logs.iter().any(|log| log.message.contains("上次运行中断")));
}
