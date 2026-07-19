use crate::models::{TaskError, TaskKind, TaskRecord, TaskRunStatus, TaskStage};
use crate::paths::task_file_path;
use std::{
    fs,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use super::is_retryable_task_error_code;

pub(crate) fn load_task_records(data_dir: &Path) -> Result<Vec<TaskRecord>, String> {
    let path = task_file_path(data_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取任务队列 {}: {error}", path.display()))?;
    if raw.trim().is_empty() {
        rebuild_empty_task_queue_file(&path)?;
        return Ok(Vec::new());
    }
    let mut tasks: Vec<TaskRecord> = match serde_json::from_str(&raw) {
        Ok(tasks) => tasks,
        Err(error) => {
            quarantine_corrupted_task_queue_file(&path, &raw, &error)?;
            Vec::new()
        }
    };
    for task in &mut tasks {
        migrate_task_record(task);
    }
    Ok(tasks)
}

fn rebuild_empty_task_queue_file(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建任务目录 {}: {error}", parent.display()))?;
    }
    fs::write(path, "[]").map_err(|error| format!("无法重建空任务队列 {}: {error}", path.display()))
}

fn quarantine_corrupted_task_queue_file(
    path: &Path,
    raw: &str,
    parse_error: &serde_json::Error,
) -> Result<(), String> {
    let Some(parent) = path.parent() else {
        return Err(format!("无法定位任务队列目录 {}", path.display()));
    };
    fs::create_dir_all(parent)
        .map_err(|error| format!("无法创建任务目录 {}: {error}", parent.display()))?;
    let stamp = now_millis_string_for_records();
    let mut quarantine_path = parent.join(format!("queue.json.corrupt-{stamp}"));
    let mut suffix = 1usize;
    while quarantine_path.exists() {
        quarantine_path = parent.join(format!("queue.json.corrupt-{stamp}-{suffix}"));
        suffix += 1;
    }
    fs::rename(path, &quarantine_path).or_else(|rename_error| {
        fs::write(&quarantine_path, raw).map_err(|write_error| {
            format!(
                "无法移动损坏任务队列 {} 到 {}: {rename_error}; 也无法复制隔离副本: {write_error}",
                path.display(),
                quarantine_path.display()
            )
        })?;
        Ok::<(), String>(())
    })?;
    rebuild_empty_task_queue_file(path)?;
    eprintln!(
        "任务队列 {} 解析失败，已隔离到 {} 并重建空队列: {parse_error}",
        path.display(),
        quarantine_path.display()
    );
    Ok(())
}

pub(crate) fn save_task_records(data_dir: &Path, records: &[TaskRecord]) -> Result<(), String> {
    let path = task_file_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建任务目录 {}: {error}", parent.display()))?;
    }
    let mut normalized_records = records.to_vec();
    for task in &mut normalized_records {
        migrate_task_record(task);
    }
    let raw = serde_json::to_string_pretty(&normalized_records)
        .map_err(|error| format!("无法序列化任务队列: {error}"))?;
    let temp_path = path.with_extension("json.tmp");
    fs::write(&temp_path, raw)
        .map_err(|error| format!("无法写入任务队列临时文件 {}: {error}", temp_path.display()))?;
    fs::rename(&temp_path, &path)
        .map_err(|error| format!("无法替换任务队列 {}: {error}", path.display()))
}

fn migrate_task_record(task: &mut TaskRecord) {
    if task.status == TaskRunStatus::LEGACY_DONE || task.status == TaskRunStatus::LEGACY_COMPLETED {
        task.status = TaskRunStatus::SUCCEEDED.to_string();
    }
    if task.stage.is_empty()
        || (task.status == TaskRunStatus::SUCCEEDED && task.stage == TaskStage::QUEUED)
    {
        task.stage = if task.status == TaskRunStatus::SUCCEEDED {
            TaskStage::DONE
        } else {
            TaskStage::QUEUED
        }
        .to_string();
    }
    if task.max_attempts == 0 {
        task.max_attempts = 3;
    }
    if task.kind.is_empty() {
        task.kind = TaskKind::PARSE_AND_INDEX.to_string();
    }
    if !task.error_code.is_empty() && task.error.code.is_empty() {
        task.error = TaskError::new(
            &task.error_code,
            task.error_message.clone(),
            &task.stage,
            is_retryable_task_error_code(&task.error_code),
            serde_json::json!({ "bookId": task.book_id.clone(), "taskId": task.id.clone() }),
        );
    }
}

pub(crate) fn now_millis_string_for_records() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_default()
}
