use crate::database::{rebuild_sqlite_database_indexes_in, vacuum_sqlite_database_in};
use crate::models::{
    DatabaseIndexMaintenancePayload, DatabaseVacuumPayload, IndexDiagnosticsPayload, TaskLogRecord,
    TaskProgressEventPayload, TaskStatusPayload,
};
use crate::paths::app_data_dir;
use crate::tasks::{
    apply_task_log_retention_in, apply_task_retention_in, archive_task_in, cancel_queued_tasks_in,
    cancel_task_in, clear_completed_tasks_in, clear_task_logs_in, delete_book_index_in,
    index_diagnostics_for_ui, load_task_logs_page_in, pause_queued_tasks_in, pause_task_in,
    rebuild_book_index_in, repair_book_fts_in, restore_archived_task_in, retry_failed_tasks_in,
    retry_task_in, run_parse_and_index_tasks_with_events_in, task_statuses_for_ui,
    try_acquire_task_runner, validate_all_indexes_in, TaskProgressEventSink,
};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;

struct TauriTaskProgressEmitter {
    app: tauri::AppHandle,
}

impl TaskProgressEventSink for TauriTaskProgressEmitter {
    fn emit_task_progress(&self, reason: &str, status: &TaskStatusPayload) {
        if let Err(error) = self.app.emit(
            "bookmind://task-progress",
            TaskProgressEventPayload {
                reason: reason.to_string(),
                status: status.clone(),
            },
        ) {
            eprintln!("无法发送任务进度事件: {error}");
        }
    }
}

#[tauri::command]
pub(crate) fn get_task_statuses() -> Result<Vec<TaskStatusPayload>, String> {
    task_statuses_for_ui(&app_data_dir()?)
}

#[tauri::command]
pub(crate) async fn get_index_diagnostics() -> Result<IndexDiagnosticsPayload, String> {
    let data_dir = app_data_dir()?;
    tauri::async_runtime::spawn_blocking(move || index_diagnostics_for_ui(&data_dir))
        .await
        .map_err(|error| format!("索引诊断线程失败: {error}"))?
}

#[tauri::command]
pub(crate) async fn validate_all_indexes() -> Result<IndexDiagnosticsPayload, String> {
    let data_dir = app_data_dir()?;
    tauri::async_runtime::spawn_blocking(move || validate_all_indexes_in(&data_dir))
        .await
        .map_err(|error| format!("索引校验线程失败: {error}"))?
}

#[tauri::command]
pub(crate) fn rebuild_database_indexes() -> Result<DatabaseIndexMaintenancePayload, String> {
    rebuild_sqlite_database_indexes_in(&app_data_dir()?)
}

#[tauri::command]
pub(crate) fn vacuum_database() -> Result<DatabaseVacuumPayload, String> {
    vacuum_sqlite_database_in(&app_data_dir()?)
}

#[tauri::command]
pub(crate) async fn run_parse_and_index_tasks(
    app: tauri::AppHandle,
) -> Result<Vec<TaskStatusPayload>, String> {
    let data_dir = app_data_dir()?;
    let Some(runner_guard) = try_acquire_task_runner() else {
        return task_statuses_for_ui(&data_dir);
    };
    let runner_data_dir = data_dir.clone();
    tauri::async_runtime::spawn(async move {
        let _runner_guard = runner_guard;
        let progress_emitter = TauriTaskProgressEmitter { app };
        match tauri::async_runtime::spawn_blocking(move || {
            run_parse_and_index_tasks_with_events_in(&runner_data_dir, &progress_emitter)
        })
        .await
        {
            Ok(Ok(_)) => {}
            Ok(Err(error)) => eprintln!("解析索引任务失败: {error}"),
            Err(error) => eprintln!("解析索引任务线程失败: {error}"),
        }
    });
    task_statuses_for_ui(&data_dir)
}

#[tauri::command]
pub(crate) fn pause_task(task_id: String) -> Result<Vec<TaskStatusPayload>, String> {
    update_task_statuses(|data_dir| pause_task_in(data_dir, &task_id))
}

#[tauri::command]
pub(crate) fn cancel_task(task_id: String) -> Result<Vec<TaskStatusPayload>, String> {
    update_task_statuses(|data_dir| cancel_task_in(data_dir, &task_id))
}

#[tauri::command]
pub(crate) fn retry_task(task_id: String) -> Result<Vec<TaskStatusPayload>, String> {
    update_task_statuses(|data_dir| retry_task_in(data_dir, &task_id))
}

#[tauri::command]
pub(crate) fn cancel_queued_tasks() -> Result<Vec<TaskStatusPayload>, String> {
    update_task_statuses(cancel_queued_tasks_in)
}

#[tauri::command]
pub(crate) fn retry_failed_tasks() -> Result<Vec<TaskStatusPayload>, String> {
    update_task_statuses(retry_failed_tasks_in)
}

#[tauri::command]
pub(crate) fn pause_queued_tasks() -> Result<Vec<TaskStatusPayload>, String> {
    update_task_statuses(pause_queued_tasks_in)
}

#[tauri::command]
pub(crate) fn clear_completed_tasks() -> Result<Vec<TaskStatusPayload>, String> {
    update_task_statuses(clear_completed_tasks_in)
}

#[tauri::command]
pub(crate) fn archive_task(task_id: String) -> Result<Vec<TaskStatusPayload>, String> {
    update_task_statuses(|data_dir| archive_task_in(data_dir, &task_id))
}

#[tauri::command]
pub(crate) fn restore_archived_task(task_id: String) -> Result<Vec<TaskStatusPayload>, String> {
    update_task_statuses(|data_dir| restore_archived_task_in(data_dir, &task_id))
}

#[tauri::command]
pub(crate) fn load_task_logs(
    task_id: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<TaskLogRecord>, String> {
    load_task_logs_page_in(&app_data_dir()?, task_id.as_deref(), limit, offset)
}

#[tauri::command]
pub(crate) fn clear_task_logs(scope: String, task_id: Option<String>) -> Result<usize, String> {
    clear_task_logs_in(&app_data_dir()?, &scope, task_id.as_deref())
}

#[tauri::command]
pub(crate) fn apply_task_log_retention(retention_days: u32) -> Result<usize, String> {
    let now_millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    apply_task_log_retention_in(&app_data_dir()?, retention_days, now_millis)
}

#[tauri::command]
pub(crate) fn apply_task_retention(completed_limit: usize) -> Result<usize, String> {
    apply_task_retention_in(&app_data_dir()?, completed_limit)
}

#[tauri::command]
pub(crate) fn rebuild_book_index(book_id: String) -> Result<Vec<TaskStatusPayload>, String> {
    update_task_statuses(|data_dir| rebuild_book_index_in(data_dir, &book_id))
}

#[tauri::command]
pub(crate) fn delete_book_index(book_id: String) -> Result<IndexDiagnosticsPayload, String> {
    let data_dir = app_data_dir()?;
    delete_book_index_in(&data_dir, &book_id)?;
    index_diagnostics_for_ui(&data_dir)
}

#[tauri::command]
pub(crate) fn repair_book_fts(book_id: String) -> Result<IndexDiagnosticsPayload, String> {
    repair_book_fts_in(&app_data_dir()?, &book_id)
}

fn update_task_statuses<T>(
    action: impl FnOnce(&std::path::Path) -> Result<T, String>,
) -> Result<Vec<TaskStatusPayload>, String> {
    let data_dir = app_data_dir()?;
    action(&data_dir)?;
    task_statuses_for_ui(&data_dir)
}
