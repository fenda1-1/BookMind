use super::*;
use crate::tasks::append_task_log_at;

#[test]
fn task_logs_can_be_loaded_and_cleared_for_completed_tasks() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("日志清理.txt");
    std::fs::write(&source, "任务日志应该写入 JSONL，并可按已完成任务清理。")
        .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    let tasks = load_task_records(&dir).expect("tasks should load");
    let task_id = parse_task_for_book(&tasks, &book.id).id.clone();

    let logs = load_task_logs_in(&dir, Some(&task_id)).expect("task logs should load");
    assert!(logs
        .iter()
        .any(|log| log.message.contains("解析和全文索引已完成")));

    let removed = clear_task_logs_in(&dir, "completed", None).expect("completed logs clear");
    assert!(removed > 0);
    let remaining = load_task_logs_in(&dir, Some(&task_id)).expect("task logs should reload");
    assert!(remaining.is_empty());
}

#[test]
fn task_logs_can_be_cleared_for_failed_tasks_without_removing_other_errors() {
    let dir = unique_temp_library_dir();
    let failed = crate::models::TaskRecord {
        id: "failed-log-task".to_string(),
        book_id: "book-clear-failed".to_string(),
        status: TaskRunStatus::FAILED.to_string(),
        ..crate::models::TaskRecord::default()
    };
    let succeeded = crate::models::TaskRecord {
        id: "succeeded-log-task".to_string(),
        book_id: "book-clear-failed".to_string(),
        status: TaskRunStatus::SUCCEEDED.to_string(),
        ..crate::models::TaskRecord::default()
    };
    save_task_records(&dir, &[failed.clone(), succeeded.clone()]).expect("tasks should save");

    let path = task_log_file_path(&dir);
    std::fs::create_dir_all(path.parent().expect("log parent should exist"))
        .expect("log parent should be created");
    std::fs::write(
        &path,
        [
            task_log_json("failed-info", &failed.id, "info", "failed info", "1000"),
            task_log_json("failed-error", &failed.id, "error", "failed error", "2000"),
            task_log_json(
                "succeeded-error",
                &succeeded.id,
                "error",
                "succeeded error",
                "3000",
            ),
        ]
        .join("\n"),
    )
    .expect("logs should write");

    let removed = clear_task_logs_in(&dir, "failed", None).expect("failed logs clear");
    let remaining =
        load_task_logs_page_in(&dir, None, Some(20), Some(0)).expect("remaining logs should load");
    let messages: Vec<&str> = remaining.iter().map(|log| log.message.as_str()).collect();

    assert_eq!(removed, 2);
    assert_eq!(messages, vec!["succeeded error"]);
}

#[test]
fn clearing_all_task_logs_persists_after_restart() {
    let dir = unique_temp_library_dir();
    let completed = crate::models::TaskRecord {
        id: "clear-all-completed".to_string(),
        book_id: "book-clear-all".to_string(),
        status: TaskRunStatus::SUCCEEDED.to_string(),
        ..crate::models::TaskRecord::default()
    };
    let failed = crate::models::TaskRecord {
        id: "clear-all-failed".to_string(),
        book_id: "book-clear-all".to_string(),
        status: TaskRunStatus::FAILED.to_string(),
        ..crate::models::TaskRecord::default()
    };
    save_task_records(&dir, &[completed.clone(), failed.clone()]).expect("tasks should save");

    let legacy_path = task_log_file_path(&dir);
    std::fs::create_dir_all(
        legacy_path
            .parent()
            .expect("legacy log parent should exist"),
    )
    .expect("legacy log parent should be created");
    std::fs::write(
        &legacy_path,
        [
            task_log_json(
                "clear-all-legacy-info",
                &completed.id,
                "info",
                "legacy completed",
                "1000",
            ),
            task_log_json(
                "clear-all-legacy-error",
                &failed.id,
                "error",
                "legacy failed",
                "2000",
            ),
        ]
        .join("\n"),
    )
    .expect("legacy logs should write");
    append_task_log_at(&dir, &completed, "info", "sharded completed", 1780876800000)
        .expect("sharded completed log should append");
    append_task_log_at(&dir, &failed, "error", "sharded failed", 1780876801000)
        .expect("sharded failed log should append");

    assert!(legacy_path.exists());
    assert!(task_log_file_path_for_day(&dir, "2026-06-08").exists());
    assert_eq!(
        load_task_logs_page_in(&dir, None, Some(20), Some(0))
            .expect("logs should load before clearing")
            .len(),
        4
    );

    let removed = clear_task_logs_in(&dir, "all", None).expect("all logs should clear");
    assert_eq!(removed, 4);
    assert!(!legacy_path.exists());
    assert!(!task_log_file_path_for_day(&dir, "2026-06-08").exists());

    let restarted_data_dir = dir.clone();
    let after_restart = load_task_logs_page_in(&restarted_data_dir, None, Some(20), Some(0))
        .expect("logs should still load after restart");
    assert!(after_restart.is_empty());
}

#[test]
fn task_logs_support_tail_limit_and_incremental_offsets() {
    let dir = unique_temp_library_dir();
    let mut task = crate::models::TaskRecord {
        id: "task-log-window".to_string(),
        book_id: "book-log-window".to_string(),
        status: TaskRunStatus::RUNNING.to_string(),
        ..crate::models::TaskRecord::default()
    };

    for index in 0..12 {
        task.stage = format!("stage-{index}");
        append_task_log(&dir, &task, "info", &format!("log-window-{index:02}"))
            .expect("log should append");
    }

    let tail = load_task_logs_page_in(&dir, Some(&task.id), Some(5), Some(0))
        .expect("tail logs should load");
    assert_eq!(tail.len(), 5);
    assert_eq!(tail[0].message, "log-window-07");
    assert_eq!(tail[4].message, "log-window-11");

    let previous = load_task_logs_page_in(&dir, Some(&task.id), Some(5), Some(5))
        .expect("older logs should load");
    assert_eq!(previous.len(), 5);
    assert_eq!(previous[0].message, "log-window-02");
    assert_eq!(previous[4].message, "log-window-06");

    let first = load_task_logs_page_in(&dir, Some(&task.id), Some(5), Some(10))
        .expect("oldest logs should load");
    assert_eq!(first.len(), 2);
    assert_eq!(first[0].message, "log-window-00");
    assert_eq!(first[1].message, "log-window-01");
}

#[test]
fn task_logs_are_sharded_by_created_date_and_loaded_across_shards() {
    let dir = unique_temp_library_dir();
    let completed = crate::models::TaskRecord {
        id: "task-date-shard-completed".to_string(),
        book_id: "book-date-shard".to_string(),
        status: TaskRunStatus::SUCCEEDED.to_string(),
        ..crate::models::TaskRecord::default()
    };
    let failed = crate::models::TaskRecord {
        id: "task-date-shard-failed".to_string(),
        book_id: "book-date-shard".to_string(),
        status: TaskRunStatus::FAILED.to_string(),
        ..crate::models::TaskRecord::default()
    };
    save_task_records(&dir, &[completed.clone(), failed.clone()]).expect("tasks should save");

    append_task_log_at(
        &dir,
        &completed,
        "info",
        "old completed shard",
        1780790400000,
    )
    .expect("old shard log should append");
    append_task_log_at(
        &dir,
        &completed,
        "info",
        "today completed shard",
        1780876800000,
    )
    .expect("today shard log should append");
    append_task_log_at(&dir, &failed, "error", "old failed shard", 1780790400000)
        .expect("failed shard log should append");

    assert!(task_log_file_path_for_day(&dir, "2026-06-07").exists());
    assert!(task_log_file_path_for_day(&dir, "2026-06-08").exists());
    assert!(!task_log_file_path(&dir).exists());

    let logs =
        load_task_logs_page_in(&dir, None, Some(10), Some(0)).expect("sharded logs should load");
    let messages: Vec<&str> = logs.iter().map(|log| log.message.as_str()).collect();
    assert_eq!(
        messages,
        vec![
            "old completed shard",
            "old failed shard",
            "today completed shard"
        ]
    );

    let removed = apply_task_log_retention_in(&dir, 1, 1780876800000 + 2000)
        .expect("retention should prune across shards");
    assert_eq!(removed, 1);
    let remaining = load_task_logs_page_in(&dir, None, Some(10), Some(0))
        .expect("remaining sharded logs should load");
    let messages: Vec<&str> = remaining.iter().map(|log| log.message.as_str()).collect();
    assert_eq!(messages, vec!["old failed shard", "today completed shard"]);
}

#[test]
fn task_log_retention_prunes_old_completed_logs_but_keeps_failed_logs() {
    let dir = unique_temp_library_dir();
    let completed = crate::models::TaskRecord {
        id: "task-retention-completed".to_string(),
        book_id: "book-retention".to_string(),
        status: TaskRunStatus::SUCCEEDED.to_string(),
        ..crate::models::TaskRecord::default()
    };
    let failed = crate::models::TaskRecord {
        id: "task-retention-failed".to_string(),
        book_id: "book-retention".to_string(),
        status: TaskRunStatus::FAILED.to_string(),
        ..crate::models::TaskRecord::default()
    };
    save_task_records(&dir, &[completed.clone(), failed.clone()]).expect("tasks should save");

    let path = task_log_file_path(&dir);
    std::fs::create_dir_all(path.parent().expect("log parent should exist"))
        .expect("log parent should be created");
    std::fs::write(
        &path,
        [
            task_log_json(
                "old-completed",
                &completed.id,
                "info",
                "old completed",
                "1000",
            ),
            task_log_json(
                "new-completed",
                &completed.id,
                "info",
                "new completed",
                "3000",
            ),
            task_log_json("old-failed", &failed.id, "error", "old failed", "1000"),
        ]
        .join("\n"),
    )
    .expect("logs should write");

    let removed =
        apply_task_log_retention_in(&dir, 1, 86_400_000 + 2000).expect("retention should apply");
    let remaining =
        load_task_logs_page_in(&dir, None, Some(20), Some(0)).expect("remaining logs should load");
    let messages: Vec<&str> = remaining.iter().map(|log| log.message.as_str()).collect();

    assert_eq!(removed, 1);
    assert_eq!(messages, vec!["new completed", "old failed"]);
}

#[test]
fn task_retention_limits_completed_tasks_but_keeps_failed_tasks() {
    let dir = unique_temp_library_dir();
    let tasks = vec![
        retention_task("done-oldest", TaskRunStatus::SUCCEEDED, "1000"),
        retention_task("done-middle", TaskRunStatus::CANCELLED, "2000"),
        retention_task("done-newest", TaskRunStatus::SKIPPED, "3000"),
        retention_task("failed-old", TaskRunStatus::FAILED, "500"),
        retention_task("queued-live", TaskRunStatus::QUEUED, "4000"),
    ];
    save_task_records(&dir, &tasks).expect("retention fixture should save");

    let removed = apply_task_retention_in(&dir, 2).expect("task retention should apply");
    let remaining = load_task_records(&dir).expect("tasks should reload after retention");
    let ids: Vec<&str> = remaining.iter().map(|task| task.id.as_str()).collect();

    assert_eq!(removed, 1);
    assert_eq!(
        ids,
        vec!["done-middle", "done-newest", "failed-old", "queued-live"]
    );
}

fn retention_task(id: &str, status: &str, updated_at: &str) -> crate::models::TaskRecord {
    crate::models::TaskRecord {
        id: id.to_string(),
        book_id: format!("book-{id}"),
        status: status.to_string(),
        updated_at: updated_at.to_string(),
        finished_at: updated_at.to_string(),
        ..crate::models::TaskRecord::default()
    }
}

fn task_log_json(id: &str, task_id: &str, level: &str, message: &str, created_at: &str) -> String {
    serde_json::json!({
        "id": id,
        "taskId": task_id,
        "bookId": "book-retention",
        "level": level,
        "stage": "done",
        "message": message,
        "detail": {},
        "createdAt": created_at,
    })
    .to_string()
}
