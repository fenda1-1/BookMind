use crate::backup::{
    create_auto_data_backup_in, create_auto_data_backup_with_mode_in, create_data_backup_in,
    create_data_backup_with_mode_in, restore_data_backup_in, BackupMode,
};
use crate::models::DataBackupResultPayload;
use crate::paths::{
    app_data_dir, data_directory_status, enable_portable_data_dir, migrate_app_data_dir,
    migrate_app_data_dir_with_progress, DataDirectoryStatusPayload,
};
use crate::tasks::try_acquire_task_runner;
use std::path::Path;
use std::process::Command;
use tauri::{Emitter, Manager};

pub(crate) fn configure_current_data_asset_scope(app: &tauri::AppHandle) -> Result<(), String> {
    let data_dir = app_data_dir()?;
    allow_data_asset_scope(app, &data_dir)
}

fn allow_data_asset_scope(app: &tauri::AppHandle, data_dir: &Path) -> Result<(), String> {
    let library_dir = data_dir.join("library");
    std::fs::create_dir_all(&library_dir)
        .map_err(|error| format!("无法创建书库资源目录 {}: {error}", library_dir.display()))?;
    app.asset_protocol_scope()
        .allow_directory(&library_dir, true)
        .map_err(|error| {
            format!(
                "无法授权书库图片资源目录 {}: {error}",
                library_dir.display()
            )
        })
}

// Trust boundary: callers must route this command through a user-visible save dialog.
// The command rejects empty paths but intentionally preserves user-selected arbitrary export paths.
pub(crate) fn write_reader_export_file_in(path: &Path, payload: &str) -> Result<(), String> {
    if path.as_os_str().is_empty() {
        return Err("导出路径不能为空".to_string());
    }
    std::fs::write(path, payload)
        .map_err(|error| format!("无法写入阅读导出文件 {}: {error}", path.display()))
}

pub(crate) fn write_reader_binary_file_in(path: &Path, payload: Vec<u8>) -> Result<(), String> {
    if path.as_os_str().is_empty() {
        return Err("导出路径不能为空".to_string());
    }
    std::fs::write(path, payload)
        .map_err(|error| format!("无法写入阅读导出文件 {}: {error}", path.display()))
}

#[tauri::command]
pub(crate) fn open_data_directory() -> Result<String, String> {
    let data_dir = app_data_dir()?;
    std::fs::create_dir_all(&data_dir)
        .map_err(|error| format!("无法创建数据目录 {}: {error}", data_dir.display()))?;
    open_path_in_file_manager(&data_dir)?;
    Ok(data_dir.display().to_string())
}

#[tauri::command]
pub(crate) fn get_data_directory_status() -> Result<DataDirectoryStatusPayload, String> {
    data_directory_status()
}

#[tauri::command]
pub(crate) fn migrate_data_directory(
    target_dir: String,
    app: tauri::AppHandle,
) -> Result<DataDirectoryStatusPayload, String> {
    let _runner_guard = try_acquire_task_runner()
        .ok_or_else(|| "数据迁移前请等待正在运行的解析、索引或人物提取任务完成".to_string())?;
    let status = migrate_app_data_dir(Path::new(&target_dir))?;
    allow_data_asset_scope(&app, Path::new(&status.data_dir))?;
    Ok(status)
}

#[tauri::command]
pub(crate) fn migrate_data_directory_with_progress(
    target_dir: String,
    app: tauri::AppHandle,
) -> Result<DataDirectoryStatusPayload, String> {
    let _runner_guard = try_acquire_task_runner()
        .ok_or_else(|| "数据迁移前请等待正在运行的解析、索引或人物提取任务完成".to_string())?;
    let status = migrate_app_data_dir_with_progress(Path::new(&target_dir), |progress| {
        if let Err(error) = app.emit("bookmind://data-directory-migration-progress", progress) {
            eprintln!("无法发送数据目录迁移进度: {error}");
        }
    })?;
    allow_data_asset_scope(&app, Path::new(&status.data_dir))?;
    Ok(status)
}

#[tauri::command]
pub(crate) fn enable_portable_data_directory(
    app: tauri::AppHandle,
) -> Result<DataDirectoryStatusPayload, String> {
    let _runner_guard = try_acquire_task_runner()
        .ok_or_else(|| "数据迁移前请等待正在运行的解析、索引或人物提取任务完成".to_string())?;
    let status = enable_portable_data_dir()?;
    allow_data_asset_scope(&app, Path::new(&status.data_dir))?;
    Ok(status)
}

fn open_path_in_file_manager(path: &Path) -> Result<(), String> {
    let mut command = if cfg!(target_os = "windows") {
        let mut command = Command::new("explorer");
        command.arg(path);
        command
    } else if cfg!(target_os = "macos") {
        let mut command = Command::new("open");
        command.arg(path);
        command
    } else {
        let mut command = Command::new("xdg-open");
        command.arg(path);
        command
    };
    command
        .spawn()
        .map_err(|error| format!("无法打开路径 {}: {error}", path.display()))?;
    Ok(())
}

pub(crate) fn validate_external_url_for_open(url: &str) -> Result<(), String> {
    let url = url.trim();
    if url.is_empty() {
        return Err("链接不能为空".to_string());
    }
    if url.chars().any(char::is_control) {
        return Err("链接包含非法控制字符".to_string());
    }
    if url.starts_with("https://") || url.starts_with("http://") || url.starts_with("mailto:") {
        return Ok(());
    }
    Err("仅允许打开 http、https 或 mailto 链接".to_string())
}

#[tauri::command]
pub(crate) fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    validate_external_url_for_open(trimmed)?;
    let mut command = if cfg!(target_os = "windows") {
        let mut command = Command::new("rundll32");
        command.args(["url.dll,FileProtocolHandler", trimmed]);
        command
    } else if cfg!(target_os = "macos") {
        let mut command = Command::new("open");
        command.arg(trimmed);
        command
    } else {
        let mut command = Command::new("xdg-open");
        command.arg(trimmed);
        command
    };
    command
        .spawn()
        .map_err(|error| format!("无法打开链接 {trimmed}: {error}"))?;
    Ok(())
}

#[tauri::command]
pub(crate) fn create_data_backup(
    backup_mode: Option<String>,
) -> Result<DataBackupResultPayload, String> {
    let data_dir = app_data_dir()?;
    match BackupMode::from_option(backup_mode.as_deref()) {
        BackupMode::Full => create_data_backup_in(&data_dir),
        BackupMode::Incremental => {
            create_data_backup_with_mode_in(&data_dir, BackupMode::Incremental)
        }
    }
}

#[tauri::command]
pub(crate) fn create_auto_data_backup(
    retention_limit: usize,
    backup_mode: Option<String>,
) -> Result<DataBackupResultPayload, String> {
    let data_dir = app_data_dir()?;
    match BackupMode::from_option(backup_mode.as_deref()) {
        BackupMode::Full => create_auto_data_backup_in(&data_dir, retention_limit),
        BackupMode::Incremental => create_auto_data_backup_with_mode_in(
            &data_dir,
            retention_limit,
            BackupMode::Incremental,
        ),
    }
}

#[tauri::command]
pub(crate) fn restore_data_backup(backup_path: String) -> Result<DataBackupResultPayload, String> {
    let data_dir = app_data_dir()?;
    restore_data_backup_in(&data_dir, Path::new(&backup_path))
}

#[tauri::command]
pub(crate) fn write_reader_export_file(path: String, payload: String) -> Result<(), String> {
    write_reader_export_file_in(Path::new(&path), &payload)
}

#[tauri::command]
pub(crate) fn write_reader_binary_file(path: String, payload: Vec<u8>) -> Result<(), String> {
    write_reader_binary_file_in(Path::new(&path), payload)
}
