use crate::models::{
    TaskError, TaskLogRecord, TaskOutputSummaryRecord, TaskRecord, TaskRunStatus, TaskStage,
    TaskStatusPayload,
};
use crate::paths::{task_log_file_path, task_log_file_path_for_day, task_logs_dir};
use std::{
    fs,
    io::Write,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

use super::{
    is_completed_task_status, is_retryable_task_error_code, load_task_records, now_millis_string,
    save_task_records, task_status_payload_for_record,
};

const STREAM_PROGRESS_MIN_DELTA: f64 = 0.5;
const STREAM_PROGRESS_MIN_INTERVAL_MS: u128 = 250;

pub(crate) trait TaskProgressEventSink {
    fn emit_task_progress(&self, reason: &str, status: &TaskStatusPayload);
}

pub(crate) fn append_task_log(
    data_dir: &Path,
    task: &TaskRecord,
    level: &str,
    message: &str,
) -> Result<(), String> {
    append_task_log_at(data_dir, task, level, message, current_millis())
}

pub(crate) fn append_task_log_at(
    data_dir: &Path,
    task: &TaskRecord,
    level: &str,
    message: &str,
    created_at_millis: u128,
) -> Result<(), String> {
    let created_at = created_at_millis.to_string();
    let path = task_log_file_path_for_day(data_dir, &task_log_day_from_millis(created_at_millis));
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建任务日志目录 {}: {error}", parent.display()))?;
    }
    let log = TaskLogRecord {
        id: format!("log-{}-{created_at}", task.id),
        task_id: task.id.clone(),
        book_id: task.book_id.clone(),
        level: level.to_string(),
        stage: task.stage.clone(),
        message: message.chars().take(500).collect(),
        detail: serde_json::json!({}),
        created_at,
    };
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| format!("无法打开任务日志 {}: {error}", path.display()))?;
    let raw =
        serde_json::to_string(&log).map_err(|error| format!("无法序列化任务日志: {error}"))?;
    writeln!(file, "{raw}").map_err(|error| format!("无法写入任务日志 {}: {error}", path.display()))
}

pub(crate) fn load_task_logs_in(
    data_dir: &Path,
    task_id: Option<&str>,
) -> Result<Vec<TaskLogRecord>, String> {
    load_task_logs_page_in(data_dir, task_id, Some(200), Some(0))
}

pub(crate) fn load_task_logs_page_in(
    data_dir: &Path,
    task_id: Option<&str>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<TaskLogRecord>, String> {
    let limit = limit.unwrap_or(200).max(1).min(1000);
    load_task_logs_window_in(data_dir, task_id, limit, offset.unwrap_or(0))
}

fn load_task_logs_window_in(
    data_dir: &Path,
    task_id: Option<&str>,
    limit: usize,
    offset: usize,
) -> Result<Vec<TaskLogRecord>, String> {
    let logs = load_all_task_logs(data_dir, task_id)?;
    Ok(logs
        .into_iter()
        .rev()
        .skip(offset)
        .take(limit)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect())
}

pub(crate) fn clear_task_logs_in(
    data_dir: &Path,
    scope: &str,
    task_id: Option<&str>,
) -> Result<usize, String> {
    if task_log_paths(data_dir)?.is_empty() {
        return Ok(0);
    }
    let logs = load_task_logs_window_in(data_dir, None, usize::MAX, 0)?;
    let tasks = load_task_records(data_dir)?;
    let completed_task_ids: std::collections::HashSet<&str> = tasks
        .iter()
        .filter(|task| is_completed_task_status(&task.status))
        .map(|task| task.id.as_str())
        .collect();
    let failed_task_ids: std::collections::HashSet<&str> = tasks
        .iter()
        .filter(|task| task.status == TaskRunStatus::FAILED)
        .map(|task| task.id.as_str())
        .collect();
    let mut removed = 0;
    let kept: Vec<TaskLogRecord> = logs
        .into_iter()
        .filter(|log| {
            let remove = match scope {
                "all" => true,
                "completed" => completed_task_ids.contains(log.task_id.as_str()),
                TaskRunStatus::FAILED => failed_task_ids.contains(log.task_id.as_str()),
                "task" => task_id.map(|id| id == log.task_id).unwrap_or(false),
                _ => false,
            };
            if remove {
                removed += 1;
            }
            !remove
        })
        .collect();
    write_task_logs_by_day_in(data_dir, &kept)?;
    Ok(removed)
}

pub(crate) fn apply_task_log_retention_in(
    data_dir: &Path,
    retention_days: u32,
    now_millis: u128,
) -> Result<usize, String> {
    if task_log_paths(data_dir)?.is_empty() || retention_days == 0 {
        return Ok(0);
    }
    let cutoff_millis = now_millis.saturating_sub(retention_days as u128 * 86_400_000);
    let logs = load_task_logs_window_in(data_dir, None, usize::MAX, 0)?;
    let tasks = load_task_records(data_dir)?;
    let completed_task_ids: std::collections::HashSet<&str> = tasks
        .iter()
        .filter(|task| is_completed_task_status(&task.status))
        .map(|task| task.id.as_str())
        .collect();
    let failed_task_ids: std::collections::HashSet<&str> = tasks
        .iter()
        .filter(|task| task.status == TaskRunStatus::FAILED)
        .map(|task| task.id.as_str())
        .collect();
    let mut removed = 0usize;
    let kept: Vec<TaskLogRecord> = logs
        .into_iter()
        .filter(|log| {
            let task_id = log.task_id.as_str();
            let created_at = log.created_at.parse::<u128>().unwrap_or(u128::MAX);
            let remove = completed_task_ids.contains(task_id)
                && !failed_task_ids.contains(task_id)
                && created_at < cutoff_millis;
            if remove {
                removed += 1;
            }
            !remove
        })
        .collect();
    write_task_logs_by_day_in(data_dir, &kept)?;
    Ok(removed)
}

fn load_all_task_logs(
    data_dir: &Path,
    task_id: Option<&str>,
) -> Result<Vec<TaskLogRecord>, String> {
    let mut logs = Vec::new();
    for path in task_log_paths(data_dir)? {
        let raw = fs::read_to_string(&path)
            .map_err(|error| format!("无法读取任务日志 {}: {error}", path.display()))?;
        for (line_index, line) in raw
            .lines()
            .filter(|line| !line.trim().is_empty())
            .enumerate()
        {
            match serde_json::from_str::<TaskLogRecord>(line) {
                Ok(log) => {
                    if task_id.map(|id| id == log.task_id).unwrap_or(true) {
                        logs.push(log);
                    }
                }
                Err(error) => {
                    eprintln!(
                        "跳过损坏的任务日志行 {}:{}: {error}",
                        path.display(),
                        line_index + 1
                    );
                }
            }
        }
    }
    Ok(logs)
}

fn task_log_paths(data_dir: &Path) -> Result<Vec<std::path::PathBuf>, String> {
    let mut paths = Vec::new();
    let legacy_path = task_log_file_path(data_dir);
    if legacy_path.exists() {
        paths.push(legacy_path);
    }
    let logs_dir = task_logs_dir(data_dir);
    if logs_dir.exists() {
        for entry in fs::read_dir(&logs_dir)
            .map_err(|error| format!("无法读取任务日志目录 {}: {error}", logs_dir.display()))?
        {
            let path = entry
                .map_err(|error| format!("无法读取任务日志目录项 {}: {error}", logs_dir.display()))?
                .path();
            let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if file_name.len() == "2026-06-08.jsonl".len()
                && file_name.ends_with(".jsonl")
                && file_name != "task_logs.jsonl"
            {
                paths.push(path);
            }
        }
    }
    paths.sort();
    Ok(paths)
}

fn write_task_logs_by_day_in(data_dir: &Path, logs: &[TaskLogRecord]) -> Result<(), String> {
    let existing_paths = task_log_paths(data_dir)?;
    for path in existing_paths {
        write_task_logs_in(&path, &[])?;
    }
    let mut grouped: std::collections::BTreeMap<String, Vec<TaskLogRecord>> =
        std::collections::BTreeMap::new();
    for log in logs {
        grouped
            .entry(task_log_day_from_created_at(&log.created_at))
            .or_default()
            .push(log.clone());
    }
    for (day, day_logs) in grouped {
        write_task_logs_in(&task_log_file_path_for_day(data_dir, &day), &day_logs)?;
    }
    Ok(())
}

fn write_task_logs_in(path: &Path, logs: &[TaskLogRecord]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建任务日志目录 {}: {error}", parent.display()))?;
    }
    let temp_path = path.with_extension("jsonl.tmp");
    if logs.is_empty() {
        if path.exists() {
            fs::remove_file(path)
                .map_err(|error| format!("无法删除任务日志 {}: {error}", path.display()))?;
        }
        if temp_path.exists() {
            let _ = fs::remove_file(&temp_path);
        }
        return Ok(());
    }
    let raw = logs
        .iter()
        .map(serde_json::to_string)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("无法序列化任务日志: {error}"))?
        .join("\n");
    fs::write(&temp_path, format!("{raw}\n"))
        .map_err(|error| format!("无法写入任务日志临时文件 {}: {error}", temp_path.display()))?;
    fs::rename(&temp_path, path)
        .map_err(|error| format!("无法替换任务日志 {}: {error}", path.display()))
}

fn current_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn task_log_day_from_created_at(created_at: &str) -> String {
    task_log_day_from_millis(created_at.parse::<u128>().unwrap_or_default())
}

fn task_log_day_from_millis(created_at_millis: u128) -> String {
    civil_date_from_unix_days((created_at_millis / 86_400_000) as i64)
}

fn civil_date_from_unix_days(days_since_epoch: i64) -> String {
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    if month <= 2 {
        year += 1;
    }
    format!("{year:04}-{month:02}-{day:02}")
}

pub(crate) fn emit_task_progress(
    data_dir: &Path,
    records: &[crate::models::BookRecord],
    tasks: &[TaskRecord],
    task_index: usize,
    reason: &str,
    sink: Option<&dyn TaskProgressEventSink>,
) {
    let Some(sink) = sink else {
        return;
    };
    let Some(task) = tasks.get(task_index) else {
        return;
    };
    let book = records.iter().find(|record| record.id == task.book_id);
    let log_count = load_task_logs_in(data_dir, Some(&task.id))
        .map(|logs| logs.len())
        .unwrap_or(0);
    let status = task_status_payload_for_record(task.clone(), book, log_count);
    sink.emit_task_progress(reason, &status);
}

pub(crate) fn mark_task_stage(
    data_dir: &Path,
    records: &[crate::models::BookRecord],
    tasks: &mut [TaskRecord],
    task_index: usize,
    stage: &str,
    progress: f64,
    message: &str,
    sink: Option<&dyn TaskProgressEventSink>,
) -> Result<(), String> {
    update_task_progress_snapshot(tasks, task_index, stage, progress, message, None);
    append_task_log(data_dir, &tasks[task_index], "info", message)?;
    save_task_records(data_dir, tasks)?;
    emit_task_progress(data_dir, records, tasks, task_index, "stage-updated", sink);
    Ok(())
}

pub(crate) fn stream_task_progress_snapshot(
    data_dir: &Path,
    records: &[crate::models::BookRecord],
    tasks: &mut [TaskRecord],
    task_index: usize,
    stage: &str,
    progress: f64,
    message: &str,
    output_summary: TaskOutputSummaryRecord,
    sink: Option<&dyn TaskProgressEventSink>,
) -> Result<(), String> {
    if should_skip_stream_progress_snapshot(&tasks[task_index], stage, progress) {
        return Ok(());
    }
    update_task_progress_snapshot(
        tasks,
        task_index,
        stage,
        progress,
        message,
        Some(output_summary),
    );
    save_task_records(data_dir, tasks)?;
    emit_task_progress(data_dir, records, tasks, task_index, "stage-updated", sink);
    Ok(())
}

fn should_skip_stream_progress_snapshot(task: &TaskRecord, stage: &str, progress: f64) -> bool {
    if task.stage != stage {
        return false;
    }
    let progress_delta = (round_progress_percent(progress.clamp(0.0, 100.0)) - task.progress).abs();
    if progress_delta >= STREAM_PROGRESS_MIN_DELTA {
        return false;
    }
    let last_updated = task.updated_at.parse::<u128>().unwrap_or(0);
    last_updated > 0
        && current_millis().saturating_sub(last_updated) < STREAM_PROGRESS_MIN_INTERVAL_MS
}

fn update_task_progress_snapshot(
    tasks: &mut [TaskRecord],
    task_index: usize,
    stage: &str,
    progress: f64,
    message: &str,
    output_summary: Option<TaskOutputSummaryRecord>,
) {
    let task = &mut tasks[task_index];
    task.stage = stage.to_string();
    task.progress = round_progress_percent(progress.clamp(0.0, 100.0));
    task.message = message.to_string();
    task.updated_at = now_millis_string();
    if let Some(output_summary) = output_summary {
        task.output_summary = output_summary;
    }
}

fn round_progress_percent(progress: f64) -> f64 {
    (progress * 10.0).round() / 10.0
}

pub(crate) fn fail_task(
    data_dir: &Path,
    records: &[crate::models::BookRecord],
    tasks: &mut [TaskRecord],
    task_index: usize,
    error_code: &str,
    error_message: String,
    message: &str,
    sink: Option<&dyn TaskProgressEventSink>,
) -> Result<(), String> {
    let task = &mut tasks[task_index];
    task.status = TaskRunStatus::FAILED.to_string();
    task.error_code = error_code.to_string();
    task.error_message = error_message.clone();
    task.error = TaskError::new(
        error_code,
        error_message,
        &task.stage,
        is_retryable_task_error_code(error_code),
        serde_json::json!({ "bookId": task.book_id.clone(), "taskId": task.id.clone() }),
    );
    task.message = message.to_string();
    task.updated_at = now_millis_string();
    append_task_log(data_dir, task, "error", message)?;
    save_task_records(data_dir, tasks)?;
    emit_task_progress(data_dir, records, tasks, task_index, "task-failed", sink);
    Ok(())
}

pub(crate) fn complete_task(
    data_dir: &Path,
    records: &[crate::models::BookRecord],
    tasks: &mut [TaskRecord],
    task_index: usize,
    sink: Option<&dyn TaskProgressEventSink>,
) -> Result<(), String> {
    complete_task_with_message(
        data_dir,
        records,
        tasks,
        task_index,
        "解析和全文索引已完成",
        sink,
    )
}

pub(crate) fn complete_task_with_message(
    data_dir: &Path,
    records: &[crate::models::BookRecord],
    tasks: &mut [TaskRecord],
    task_index: usize,
    message: &str,
    sink: Option<&dyn TaskProgressEventSink>,
) -> Result<(), String> {
    let task = &mut tasks[task_index];
    task.status = TaskRunStatus::SUCCEEDED.to_string();
    task.stage = TaskStage::DONE.to_string();
    task.progress = 100.0;
    task.finished_at = now_millis_string();
    task.updated_at = task.finished_at.clone();
    task.message = message.to_string();
    append_task_log(data_dir, task, "info", message)?;
    save_task_records(data_dir, tasks)?;
    emit_task_progress(data_dir, records, tasks, task_index, "task-completed", sink);
    Ok(())
}
