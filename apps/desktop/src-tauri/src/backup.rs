use crate::models::DataBackupResultPayload;
use crate::paths::{secure_ai_key_store_path, secure_local_data_key_store_path};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const BACKUP_SCHEMA: &str = "bookmind.data-backup.v1";
const BACKUP_MANIFEST_FILE_NAME: &str = "backup-manifest.json";
const MANUAL_BACKUP_PREFIX: &str = "bookmind-backup-";
const AUTO_BACKUP_PREFIX: &str = "bookmind-auto-backup-";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum BackupMode {
    Full,
    Incremental,
}

impl BackupMode {
    pub(crate) fn from_option(value: Option<&str>) -> Self {
        match value {
            Some("incremental") => Self::Incremental,
            _ => Self::Full,
        }
    }

    const fn as_str(self) -> &'static str {
        match self {
            Self::Full => "full",
            Self::Incremental => "incremental",
        }
    }
}

#[derive(Default)]
struct BackupCopyStats {
    copied_files: usize,
    copied_bytes: u64,
    reused_files: usize,
}

pub(crate) fn create_data_backup_in(data_dir: &Path) -> Result<DataBackupResultPayload, String> {
    create_data_backup_with_mode_in(data_dir, BackupMode::Full)
}

pub(crate) fn create_data_backup_with_mode_in(
    data_dir: &Path,
    backup_mode: BackupMode,
) -> Result<DataBackupResultPayload, String> {
    create_data_backup_with_prefix_in(data_dir, MANUAL_BACKUP_PREFIX, backup_mode)
}

pub(crate) fn create_auto_data_backup_in(
    data_dir: &Path,
    retention_limit: usize,
) -> Result<DataBackupResultPayload, String> {
    create_auto_data_backup_with_mode_in(data_dir, retention_limit, BackupMode::Full)
}

pub(crate) fn create_auto_data_backup_with_mode_in(
    data_dir: &Path,
    retention_limit: usize,
    backup_mode: BackupMode,
) -> Result<DataBackupResultPayload, String> {
    let result = create_data_backup_with_prefix_in(data_dir, AUTO_BACKUP_PREFIX, backup_mode)?;
    prune_auto_data_backups_in(data_dir, retention_limit.clamp(1, 30))?;
    Ok(result)
}

fn create_data_backup_with_prefix_in(
    data_dir: &Path,
    backup_prefix: &str,
    backup_mode: BackupMode,
) -> Result<DataBackupResultPayload, String> {
    fs::create_dir_all(data_dir)
        .map_err(|error| format!("无法创建数据目录 {}: {error}", data_dir.display()))?;
    let backup_root = data_dir.join("backups");
    fs::create_dir_all(&backup_root)
        .map_err(|error| format!("无法创建备份目录 {}: {error}", backup_root.display()))?;
    let previous_backup = if backup_mode == BackupMode::Incremental {
        find_latest_backup_snapshot(&backup_root, backup_prefix)?
    } else {
        None
    };
    let backup_dir = create_unique_backup_dir(&backup_root, backup_prefix)?;

    let excluded_paths = excluded_secret_paths(data_dir);
    let mut stats = BackupCopyStats::default();
    copy_dir_filtered(
        data_dir,
        &backup_dir,
        data_dir,
        previous_backup.as_deref(),
        &excluded_paths,
        CopyMode::Backup,
        &mut stats,
    )?;
    write_backup_manifest(&backup_dir, &stats, backup_mode)?;

    Ok(DataBackupResultPayload {
        backup_path: backup_dir.display().to_string(),
        restored_from: String::new(),
        copied_files: stats.copied_files,
        copied_bytes: stats.copied_bytes,
        reused_files: stats.reused_files,
        backup_mode: backup_mode.as_str().to_string(),
        excluded_secrets: true,
        created_at: current_timestamp_string()?,
    })
}

fn prune_auto_data_backups_in(data_dir: &Path, retention_limit: usize) -> Result<usize, String> {
    let backup_root = data_dir.join("backups");
    if !backup_root.exists() {
        return Ok(0);
    }
    let mut snapshots = Vec::new();
    for entry in fs::read_dir(&backup_root)
        .map_err(|error| format!("无法读取备份目录 {}: {error}", backup_root.display()))?
    {
        let entry = entry
            .map_err(|error| format!("无法读取备份目录项 {}: {error}", backup_root.display()))?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(name) = path
            .file_name()
            .and_then(|value| value.to_str())
            .map(|value| value.to_string())
        else {
            continue;
        };
        if !name.starts_with(AUTO_BACKUP_PREFIX) {
            continue;
        }
        snapshots.push((path.clone(), backup_snapshot_timestamp(&path, &name)));
    }
    snapshots.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| right.0.cmp(&left.0)));
    let mut removed = 0usize;
    for (path, _) in snapshots.into_iter().skip(retention_limit) {
        fs::remove_dir_all(&path)
            .map_err(|error| format!("无法清理旧自动备份 {}: {error}", path.display()))?;
        removed += 1;
    }
    Ok(removed)
}

fn backup_snapshot_timestamp(path: &Path, name: &str) -> u64 {
    read_manifest_created_at(path).unwrap_or_else(|| {
        name.strip_prefix(AUTO_BACKUP_PREFIX)
            .or_else(|| name.strip_prefix(MANUAL_BACKUP_PREFIX))
            .and_then(parse_backup_timestamp_from_name)
            .unwrap_or(0)
    })
}

fn parse_backup_timestamp_from_name(value: &str) -> Option<u64> {
    value
        .split_once('-')
        .map(|(stamp, _)| stamp)
        .unwrap_or(value)
        .parse::<u64>()
        .ok()
}

fn read_manifest_created_at(path: &Path) -> Option<u64> {
    let raw = fs::read_to_string(path.join(BACKUP_MANIFEST_FILE_NAME)).ok()?;
    let value = serde_json::from_str::<serde_json::Value>(&raw).ok()?;
    if value.get("schema").and_then(|schema| schema.as_str()) != Some(BACKUP_SCHEMA) {
        return None;
    }
    value
        .get("createdAt")
        .and_then(|created_at| created_at.as_str())
        .and_then(|created_at| created_at.parse::<u64>().ok())
}

pub(crate) fn restore_data_backup_in(
    data_dir: &Path,
    backup_path: &Path,
) -> Result<DataBackupResultPayload, String> {
    if !backup_path.exists() || !backup_path.is_dir() {
        return Err(format!(
            "备份目录不存在或不可读取：{}",
            backup_path.display()
        ));
    }
    if !backup_path.join(BACKUP_MANIFEST_FILE_NAME).exists() {
        return Err(format!(
            "备份目录缺少 backup-manifest.json：{}",
            backup_path.display()
        ));
    }
    fs::create_dir_all(data_dir)
        .map_err(|error| format!("无法创建数据目录 {}: {error}", data_dir.display()))?;
    let restore_backup_root = data_dir.join("restore-backups");
    fs::create_dir_all(&restore_backup_root).map_err(|error| {
        format!(
            "无法创建恢复前备份目录 {}: {error}",
            restore_backup_root.display()
        )
    })?;
    let current_backup = create_unique_backup_dir(&restore_backup_root, "before-restore-")?;
    if has_restorable_content(data_dir, backup_path) {
        fs::create_dir_all(&current_backup)
            .map_err(|error| format!("无法创建恢复前快照 {}: {error}", current_backup.display()))?;
        copy_dir_filtered(
            data_dir,
            &current_backup,
            data_dir,
            None,
            &[],
            CopyMode::RestoreSnapshot,
            &mut BackupCopyStats::default(),
        )?;
    }
    clear_data_dir_for_restore(data_dir)?;

    let mut stats = BackupCopyStats::default();
    let restore_excluded_paths = restore_excluded_paths(backup_path);
    copy_dir_filtered(
        backup_path,
        data_dir,
        backup_path,
        None,
        &restore_excluded_paths,
        CopyMode::Restore,
        &mut stats,
    )?;

    Ok(DataBackupResultPayload {
        backup_path: current_backup.display().to_string(),
        restored_from: backup_path.display().to_string(),
        copied_files: stats.copied_files,
        copied_bytes: stats.copied_bytes,
        reused_files: 0,
        backup_mode: BackupMode::Full.as_str().to_string(),
        excluded_secrets: true,
        created_at: current_timestamp_string()?,
    })
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum CopyMode {
    Backup,
    Restore,
    RestoreSnapshot,
}

fn copy_dir_filtered(
    source_root: &Path,
    target_root: &Path,
    current: &Path,
    previous_backup_root: Option<&Path>,
    excluded_paths: &[PathBuf],
    mode: CopyMode,
    stats: &mut BackupCopyStats,
) -> Result<(), String> {
    if !current.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(current)
        .map_err(|error| format!("无法读取目录 {}: {error}", current.display()))?
    {
        let entry =
            entry.map_err(|error| format!("无法读取目录项 {}: {error}", current.display()))?;
        let source_path = entry.path();
        if should_skip_path(&source_path, source_root, excluded_paths, mode) {
            continue;
        }
        let relative = source_path
            .strip_prefix(source_root)
            .map_err(|error| format!("无法计算备份相对路径 {}: {error}", source_path.display()))?;
        let target_path = target_root.join(relative);
        let metadata = entry
            .metadata()
            .map_err(|error| format!("无法读取文件信息 {}: {error}", source_path.display()))?;
        if metadata.is_dir() {
            fs::create_dir_all(&target_path).map_err(|error| {
                format!("无法创建备份子目录 {}: {error}", target_path.display())
            })?;
            copy_dir_filtered(
                source_root,
                target_root,
                &source_path,
                previous_backup_root,
                excluded_paths,
                mode,
                stats,
            )?;
        } else if metadata.is_file() {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("无法创建备份父目录 {}: {error}", parent.display()))?;
            }
            if mode == CopyMode::Backup
                && copy_or_link_unchanged_backup_file(
                    &source_path,
                    &target_path,
                    previous_backup_root.map(|root| root.join(relative)),
                    &metadata,
                )
            {
                stats.reused_files += 1;
            } else {
                fs::copy(&source_path, &target_path)
                    .map_err(|error| format!("无法备份文件 {}: {error}", source_path.display()))?;
            }
            stats.copied_files += 1;
            stats.copied_bytes += metadata.len();
        }
    }
    Ok(())
}

fn copy_or_link_unchanged_backup_file(
    source_path: &Path,
    target_path: &Path,
    previous_path: Option<PathBuf>,
    metadata: &fs::Metadata,
) -> bool {
    let Some(previous_path) = previous_path else {
        return false;
    };
    let Ok(previous_metadata) = fs::metadata(&previous_path) else {
        return false;
    };
    if !previous_metadata.is_file() || previous_metadata.len() != metadata.len() {
        return false;
    }
    if previous_metadata.modified().ok() != metadata.modified().ok()
        && !files_have_same_bytes(source_path, &previous_path)
    {
        return false;
    }
    fs::hard_link(&previous_path, target_path).is_ok()
}

fn files_have_same_bytes(left: &Path, right: &Path) -> bool {
    let Ok(left_bytes) = fs::read(left) else {
        return false;
    };
    let Ok(right_bytes) = fs::read(right) else {
        return false;
    };
    left_bytes == right_bytes
}

fn clear_data_dir_for_restore(data_dir: &Path) -> Result<(), String> {
    if !data_dir.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(data_dir)
        .map_err(|error| format!("无法读取恢复目标目录 {}: {error}", data_dir.display()))?
    {
        let path = entry
            .map_err(|error| format!("无法读取恢复目标目录项 {}: {error}", data_dir.display()))?
            .path();
        let top_level_name = path.file_name().and_then(|name| name.to_str());
        if matches!(top_level_name, Some("backups" | "restore-backups")) {
            continue;
        }
        if path.is_dir() {
            fs::remove_dir_all(&path)
                .map_err(|error| format!("无法清理恢复目标目录 {}: {error}", path.display()))?;
        } else {
            fs::remove_file(&path)
                .map_err(|error| format!("无法清理恢复目标文件 {}: {error}", path.display()))?;
        }
    }
    Ok(())
}

fn should_skip_path(
    path: &Path,
    source_root: &Path,
    excluded_paths: &[PathBuf],
    mode: CopyMode,
) -> bool {
    if excluded_paths.iter().any(|excluded| path == excluded) {
        return true;
    }
    let Ok(relative) = path.strip_prefix(source_root) else {
        return false;
    };
    if is_secret_relative_path(relative) {
        return true;
    }
    let top_level_name = relative
        .components()
        .next()
        .and_then(|component| component.as_os_str().to_str());
    matches!(
        (mode, top_level_name),
        (
            CopyMode::Backup | CopyMode::RestoreSnapshot,
            Some("backups" | "restore-backups")
        )
    )
}

fn excluded_secret_paths(data_dir: &Path) -> Vec<PathBuf> {
    vec![
        secure_ai_key_store_path(data_dir),
        secure_local_data_key_store_path(data_dir),
    ]
}

fn restore_excluded_paths(backup_path: &Path) -> Vec<PathBuf> {
    vec![
        backup_path.join(BACKUP_MANIFEST_FILE_NAME),
        backup_path.join("settings").join("ai-api-key.secure"),
        backup_path.join("settings").join("local-data-key.secure"),
    ]
}

fn is_secret_relative_path(relative: &Path) -> bool {
    let components = relative
        .components()
        .filter_map(|item| item.as_os_str().to_str())
        .collect::<Vec<_>>();
    let Some(first) = components.first() else {
        return false;
    };
    if *first != "settings" {
        return false;
    }
    if components.len() == 3 && components[1] == "providers" && components[2].ends_with(".secure") {
        return true;
    }
    if components.len() != 2 {
        return false;
    }
    let file_name = components[1];
    file_name == "ai-api-key.secure"
        || file_name == "local-data-key.secure"
        || (file_name.starts_with("local-data-key.") && file_name.ends_with(".secure"))
}

fn has_restorable_content(data_dir: &Path, backup_path: &Path) -> bool {
    fs::read_dir(data_dir)
        .map(|mut entries| {
            entries.any(|entry| {
                let Ok(entry) = entry else {
                    return false;
                };
                let path = entry.path();
                path != backup_path
                    && path.file_name().and_then(|name| name.to_str()) != Some("restore-backups")
            })
        })
        .unwrap_or(false)
}

fn find_latest_backup_snapshot(
    backup_root: &Path,
    backup_prefix: &str,
) -> Result<Option<PathBuf>, String> {
    if !backup_root.exists() {
        return Ok(None);
    }
    let mut snapshots = Vec::new();
    for entry in fs::read_dir(backup_root)
        .map_err(|error| format!("无法读取备份目录 {}: {error}", backup_root.display()))?
    {
        let entry = entry
            .map_err(|error| format!("无法读取备份目录项 {}: {error}", backup_root.display()))?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if name.starts_with(backup_prefix) {
            snapshots.push((path.clone(), backup_snapshot_timestamp(&path, name)));
        }
    }
    snapshots.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| right.0.cmp(&left.0)));
    Ok(snapshots.into_iter().next().map(|(path, _)| path))
}

fn write_backup_manifest(
    backup_dir: &Path,
    stats: &BackupCopyStats,
    backup_mode: BackupMode,
) -> Result<(), String> {
    let manifest = serde_json::json!({
        "schema": BACKUP_SCHEMA,
        "createdAt": current_timestamp_string()?,
        "backupMode": backup_mode.as_str(),
        "copiedFiles": stats.copied_files,
        "copiedBytes": stats.copied_bytes,
        "reusedFiles": stats.reused_files,
        "excludedSecrets": true,
        "excludedFields": [
            "settings/ai-api-key.secure",
            "settings/providers/*.secure",
            "settings/local-data-key.secure",
            "settings/local-data-key.*.secure"
        ],
        "includedProtectedKeyWrap": [
            "settings/local-data-key.wrap.json",
            "settings/local-data-keys.json"
        ]
    });
    fs::write(
        backup_dir.join(BACKUP_MANIFEST_FILE_NAME),
        serde_json::to_string_pretty(&manifest)
            .map_err(|error| format!("无法序列化备份清单: {error}"))?,
    )
    .map_err(|error| format!("无法写入备份清单 {}: {error}", backup_dir.display()))
}

fn create_unique_backup_dir(backup_root: &Path, prefix: &str) -> Result<PathBuf, String> {
    let base_stamp = timestamp_millis()?;
    for suffix in 0..100usize {
        let name = if suffix == 0 {
            format!("{prefix}{base_stamp}")
        } else {
            format!("{prefix}{base_stamp}-{suffix}")
        };
        let backup_dir = backup_root.join(name);
        match fs::create_dir(&backup_dir) {
            Ok(()) => return Ok(backup_dir),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(format!(
                    "无法创建备份快照 {}: {error}",
                    backup_dir.display()
                ));
            }
        }
    }
    Err(format!(
        "无法创建唯一备份快照目录：{}",
        backup_root.join(format!("{prefix}*")).display()
    ))
}

fn timestamp_millis() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|error| format!("系统时间异常：{error}"))
}

fn current_timestamp_string() -> Result<String, String> {
    Ok(timestamp_millis()?.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unique_test_dir() -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "bookmind-backup-test-{}-{}",
            std::process::id(),
            timestamp_millis().expect("timestamp should be available")
        ));
        path
    }

    #[test]
    fn incremental_backup_reuses_unchanged_files_without_losing_restore_shape() {
        let dir = unique_test_dir();
        let library_dir = dir.join("library");
        fs::create_dir_all(&library_dir).expect("library dir should be created");
        fs::write(library_dir.join("library.json"), "stable library")
            .expect("library fixture should be written");

        let first = create_data_backup_with_mode_in(&dir, BackupMode::Full)
            .expect("full backup should be created");
        let second = create_data_backup_with_mode_in(&dir, BackupMode::Incremental)
            .expect("incremental backup should be created");
        let second_path = PathBuf::from(&second.backup_path);
        let manifest = fs::read_to_string(second_path.join(BACKUP_MANIFEST_FILE_NAME))
            .expect("incremental manifest should be readable");

        assert_eq!(first.reused_files, 0);
        assert_eq!(second.backup_mode, "incremental");
        assert!(second.reused_files >= 1);
        assert!(second_path.join("library").join("library.json").exists());
        assert!(manifest.contains("\"backupMode\": \"incremental\""));
        assert!(manifest.contains("\"reusedFiles\""));

        fs::remove_dir_all(dir).ok();
    }
}
