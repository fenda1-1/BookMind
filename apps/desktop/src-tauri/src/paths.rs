use directories::BaseDirs;
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
};

const LIBRARY_DIR_NAME: &str = "BookMindData";
const LIBRARY_FILE_NAME: &str = "library.json";
const TASK_FILE_NAME: &str = "queue.json";
const INDEX_MANIFEST_FILE_NAME: &str = "index_manifest.json";
const VECTOR_INDEX_MANIFEST_FILE_NAME: &str = "vector_index_manifest.json";
const CHUNK_FILE_NAME: &str = "chunks.json";
const NOTES_FILE_NAME: &str = "notes.json";
const HIGHLIGHTS_FILE_NAME: &str = "highlights.json";
const FLASHCARDS_FILE_NAME: &str = "flashcards.json";
const SETTINGS_FILE_NAME: &str = "settings.json";
const SETTINGS_V2_FILE_NAME: &str = "settings_v2.json";
const DATA_DIR_POINTER_FILE_NAME: &str = "data-dir.json";
const DATA_DIR_LOCATION_FILE_NAME: &str = ".bookmind-data-location.json";
const PORTABLE_DATA_DIR_NAME: &str = "BookMindPortableData";

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DataDirectoryStatusPayload {
    pub(crate) data_dir: String,
    pub(crate) default_data_dir: String,
    pub(crate) mode: String,
    pub(crate) locator_file: String,
    pub(crate) portable_dir: String,
    pub(crate) custom_data_dir: String,
    pub(crate) exists: bool,
    pub(crate) portable_available: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DataDirectoryMigrationProgressPayload {
    pub(crate) phase: String,
    pub(crate) copied_files: u64,
    pub(crate) total_files: u64,
    pub(crate) copied_bytes: u64,
    pub(crate) total_bytes: u64,
    pub(crate) current_path: String,
}

pub(crate) fn app_data_dir() -> Result<PathBuf, String> {
    let data_dir = resolve_app_data_dir()?;
    repair_relocated_data_dir_references(&data_dir)?;
    Ok(data_dir)
}

pub(crate) fn data_directory_status() -> Result<DataDirectoryStatusPayload, String> {
    let status = data_directory_status_in(current_exe_dir().ok().as_deref(), None)?;
    repair_relocated_data_dir_references(Path::new(&status.data_dir))?;
    Ok(status)
}

pub(crate) fn migrate_app_data_dir(
    target_dir: &Path,
) -> Result<DataDirectoryStatusPayload, String> {
    migrate_app_data_dir_with_progress(target_dir, |_| {})
}

pub(crate) fn migrate_app_data_dir_with_progress(
    target_dir: &Path,
    mut on_progress: impl FnMut(DataDirectoryMigrationProgressPayload),
) -> Result<DataDirectoryStatusPayload, String> {
    let support_dir = default_support_dir()?;
    let current = resolve_app_data_dir_in(None, Some(&support_dir))?;
    migrate_app_data_dir_in_with_progress(&current, target_dir, &support_dir, &mut on_progress)
}

pub(crate) fn enable_portable_data_dir() -> Result<DataDirectoryStatusPayload, String> {
    let exe_dir = current_exe_dir()?;
    enable_portable_data_dir_in(&exe_dir, None)
}

fn current_exe_dir() -> Result<PathBuf, String> {
    std::env::current_exe()
        .map_err(|error| format!("无法定位程序路径: {error}"))?
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "无法定位程序目录".to_string())
}

fn default_support_dir() -> Result<PathBuf, String> {
    BaseDirs::new()
        .map(|directories| directories.data_local_dir().join(LIBRARY_DIR_NAME))
        .ok_or_else(|| "无法定位当前系统的用户数据目录".to_string())
}

fn default_data_dir_in(support_dir: &Path) -> PathBuf {
    support_dir.to_path_buf()
}

fn locator_file_in(support_dir: &Path) -> PathBuf {
    support_dir
        .with_extension("config")
        .join(DATA_DIR_POINTER_FILE_NAME)
}

fn legacy_locator_file_in(support_dir: &Path) -> PathBuf {
    support_dir
        .join("settings")
        .join(DATA_DIR_POINTER_FILE_NAME)
}

fn effective_locator_file_in(support_dir: &Path) -> PathBuf {
    let locator_file = locator_file_in(support_dir);
    if locator_file.exists() {
        return locator_file;
    }
    let legacy_locator_file = legacy_locator_file_in(support_dir);
    if legacy_locator_file.exists() {
        return legacy_locator_file;
    }
    locator_file
}

fn portable_data_dir_in(exe_dir: &Path) -> PathBuf {
    exe_dir.join(PORTABLE_DATA_DIR_NAME)
}

fn resolve_app_data_dir() -> Result<PathBuf, String> {
    resolve_app_data_dir_in(current_exe_dir().ok().as_deref(), None)
}

fn resolve_app_data_dir_in(
    exe_dir: Option<&Path>,
    support_dir_override: Option<&Path>,
) -> Result<PathBuf, String> {
    let support_dir = support_dir_override
        .map(Path::to_path_buf)
        .map(Ok)
        .unwrap_or_else(default_support_dir)?;
    if let Some(exe_dir) = exe_dir {
        let portable_dir = portable_data_dir_in(exe_dir);
        let portable_has_data = portable_dir.exists()
            && fs::read_dir(&portable_dir)
                .map_err(|error| {
                    format!("无法读取便携数据目录 {}: {error}", portable_dir.display())
                })?
                .next()
                .is_some();
        if portable_has_data {
            return Ok(portable_dir);
        }
    }
    let locator_file = effective_locator_file_in(&support_dir);
    if locator_file.exists() {
        let target = read_custom_data_dir_from_locator(&locator_file)?;
        if !target.as_os_str().is_empty() {
            return Ok(target);
        }
    }
    Ok(default_data_dir_in(&support_dir))
}

fn data_directory_status_in(
    exe_dir: Option<&Path>,
    support_dir_override: Option<&Path>,
) -> Result<DataDirectoryStatusPayload, String> {
    let support_dir = support_dir_override
        .map(Path::to_path_buf)
        .map(Ok)
        .unwrap_or_else(default_support_dir)?;
    let default_data_dir = default_data_dir_in(&support_dir);
    let locator_file = effective_locator_file_in(&support_dir);
    let portable_dir = exe_dir
        .map(portable_data_dir_in)
        .unwrap_or_else(|| PathBuf::from(PORTABLE_DATA_DIR_NAME));
    let custom_data_dir = if locator_file.exists() {
        read_custom_data_dir_from_locator(&locator_file).unwrap_or_default()
    } else {
        PathBuf::new()
    };
    let portable_available = portable_dir.exists();
    let data_dir = resolve_app_data_dir_in(exe_dir, Some(&support_dir))?;
    let mode = if portable_available && data_dir == portable_dir {
        "portable"
    } else if !custom_data_dir.as_os_str().is_empty() && data_dir == custom_data_dir {
        "custom"
    } else {
        "default"
    };
    Ok(DataDirectoryStatusPayload {
        exists: data_dir.exists(),
        data_dir: data_dir.display().to_string(),
        default_data_dir: default_data_dir.display().to_string(),
        mode: mode.to_string(),
        locator_file: locator_file.display().to_string(),
        portable_dir: portable_dir.display().to_string(),
        custom_data_dir: custom_data_dir.display().to_string(),
        portable_available,
    })
}

fn read_custom_data_dir_from_locator(locator_file: &Path) -> Result<PathBuf, String> {
    let raw = fs::read_to_string(locator_file).map_err(|error| {
        format!(
            "无法读取数据目录定位文件 {}: {error}",
            locator_file.display()
        )
    })?;
    let value: serde_json::Value = serde_json::from_str(&raw).map_err(|error| {
        format!(
            "无法解析数据目录定位文件 {}: {error}",
            locator_file.display()
        )
    })?;
    let data_dir = value
        .get("dataDir")
        .and_then(|item| item.as_str())
        .unwrap_or("")
        .trim();
    Ok(PathBuf::from(data_dir))
}

fn write_data_dir_locator(locator_file: &Path, target_dir: &Path) -> Result<(), String> {
    if let Some(parent) = locator_file.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!("无法创建数据目录定位文件目录 {}: {error}", parent.display())
        })?;
    }
    let raw = serde_json::to_string_pretty(&serde_json::json!({
        "schema": "bookmind.data-dir-pointer.v1",
        "dataDir": target_dir.display().to_string()
    }))
    .map_err(|error| format!("无法序列化数据目录定位文件: {error}"))?;
    fs::write(locator_file, raw).map_err(|error| {
        format!(
            "无法写入数据目录定位文件 {}: {error}",
            locator_file.display()
        )
    })
}

fn migrate_app_data_dir_in(
    current_dir: &Path,
    target_dir: &Path,
    support_dir: &Path,
) -> Result<DataDirectoryStatusPayload, String> {
    migrate_app_data_dir_in_with_progress(current_dir, target_dir, support_dir, &mut |_| {})
}

fn migrate_app_data_dir_in_with_progress(
    current_dir: &Path,
    target_dir: &Path,
    support_dir: &Path,
    on_progress: &mut impl FnMut(DataDirectoryMigrationProgressPayload),
) -> Result<DataDirectoryStatusPayload, String> {
    if target_dir.as_os_str().is_empty() {
        return Err("目标数据目录不能为空".to_string());
    }
    if canonical_or_self(current_dir) == canonical_or_self(target_dir) {
        return Err("目标数据目录与当前数据目录相同".to_string());
    }
    if canonical_or_self(target_dir).starts_with(canonical_or_self(current_dir)) {
        return Err("目标数据目录不能位于当前数据目录内部".to_string());
    }
    if target_dir.exists() {
        let mut entries = fs::read_dir(target_dir)
            .map_err(|error| format!("无法读取目标数据目录 {}: {error}", target_dir.display()))?;
        if entries.next().is_some() {
            return Err("目标数据目录必须为空，避免覆盖已有数据".to_string());
        }
    } else {
        fs::create_dir_all(target_dir)
            .map_err(|error| format!("无法创建目标数据目录 {}: {error}", target_dir.display()))?;
    }
    let (total_files, total_bytes) = measure_data_dir_for_migration(current_dir)?;
    on_progress(DataDirectoryMigrationProgressPayload {
        phase: "preparing".to_string(),
        copied_files: 0,
        total_files,
        copied_bytes: 0,
        total_bytes,
        current_path: current_dir.display().to_string(),
    });
    copy_data_dir_for_migration(
        current_dir,
        target_dir,
        total_files,
        total_bytes,
        on_progress,
    )?;
    on_progress(DataDirectoryMigrationProgressPayload {
        phase: "rewriting".to_string(),
        copied_files: total_files,
        total_files,
        copied_bytes: total_bytes,
        total_bytes,
        current_path: target_dir.display().to_string(),
    });
    rewrite_migrated_data_dir_references(current_dir, target_dir)?;
    write_data_dir_location_metadata(target_dir)?;
    on_progress(DataDirectoryMigrationProgressPayload {
        phase: "finalizing".to_string(),
        copied_files: total_files,
        total_files,
        copied_bytes: total_bytes,
        total_bytes,
        current_path: target_dir.display().to_string(),
    });
    let locator_file = locator_file_in(support_dir);
    write_data_dir_locator(&locator_file, target_dir)?;
    on_progress(DataDirectoryMigrationProgressPayload {
        phase: "cleaning".to_string(),
        copied_files: total_files,
        total_files,
        copied_bytes: total_bytes,
        total_bytes,
        current_path: current_dir.display().to_string(),
    });
    remove_source_data_dir_after_migration(current_dir, &locator_file)?;
    let status = data_directory_status_in(None, Some(support_dir))?;
    on_progress(DataDirectoryMigrationProgressPayload {
        phase: "completed".to_string(),
        copied_files: total_files,
        total_files,
        copied_bytes: total_bytes,
        total_bytes,
        current_path: status.data_dir.clone(),
    });
    Ok(status)
}

fn remove_source_data_dir_after_migration(
    source_dir: &Path,
    locator_file: &Path,
) -> Result<(), String> {
    if !source_dir.exists() {
        return Ok(());
    }
    let source = canonical_or_self(source_dir);
    let locator = canonical_or_self(locator_file);
    if source.parent().is_none() || locator.starts_with(&source) {
        return Err(format!(
            "配置已切换到新目录，但为避免删除系统目录，无法清理原目录 {}",
            source_dir.display()
        ));
    }
    fs::remove_dir_all(source_dir).map_err(|error| {
        format!(
            "配置已切换到新目录，但无法删除原目录 {}: {error}",
            source_dir.display()
        )
    })
}

fn enable_portable_data_dir_in(
    exe_dir: &Path,
    support_dir_override: Option<&Path>,
) -> Result<DataDirectoryStatusPayload, String> {
    let support_dir = support_dir_override
        .map(Path::to_path_buf)
        .map(Ok)
        .unwrap_or_else(default_support_dir)?;
    let portable_dir = portable_data_dir_in(exe_dir);
    let current_dir = resolve_app_data_dir_in(None, Some(&support_dir))?;
    if canonical_or_self(&current_dir) != canonical_or_self(&portable_dir) {
        if portable_dir.exists()
            && fs::read_dir(&portable_dir)
                .map_err(|error| {
                    format!("无法读取便携数据目录 {}: {error}", portable_dir.display())
                })?
                .next()
                .is_none()
        {
            fs::remove_dir(&portable_dir).map_err(|error| {
                format!(
                    "无法重置空的便携数据目录 {}: {error}",
                    portable_dir.display()
                )
            })?;
        }
        migrate_app_data_dir_in(&current_dir, &portable_dir, &support_dir)?;
    }
    data_directory_status_in(Some(exe_dir), Some(&support_dir))
}

fn repair_relocated_data_dir_references(data_dir: &Path) -> Result<(), String> {
    if !data_dir.exists() {
        return Ok(());
    }
    let location_file = data_dir.join(DATA_DIR_LOCATION_FILE_NAME);
    if let Some(recorded_dir) = read_data_dir_location_metadata(&location_file)? {
        if canonical_or_self(&recorded_dir) == canonical_or_self(data_dir) {
            return Ok(());
        }
        rewrite_migrated_data_dir_references(&recorded_dir, data_dir)?;
        write_data_dir_location_metadata(data_dir)?;
        return Ok(());
    }

    let previous_dir = infer_previous_data_dir_from_library(data_dir).or_else(|| {
        default_support_dir()
            .ok()
            .filter(|path| canonical_or_self(path) != canonical_or_self(data_dir))
    });
    if let Some(previous_dir) = previous_dir {
        rewrite_migrated_data_dir_references(&previous_dir, data_dir)?;
    }
    write_data_dir_location_metadata(data_dir)
}

fn read_data_dir_location_metadata(path: &Path) -> Result<Option<PathBuf>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("无法读取数据位置元数据 {}: {error}", path.display()))?;
    let value: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|error| format!("无法解析数据位置元数据 {}: {error}", path.display()))?;
    Ok(value
        .get("dataDir")
        .and_then(|item| item.as_str())
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(PathBuf::from))
}

fn write_data_dir_location_metadata(data_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(data_dir)
        .map_err(|error| format!("无法创建数据目录 {}: {error}", data_dir.display()))?;
    let path = data_dir.join(DATA_DIR_LOCATION_FILE_NAME);
    let raw = serde_json::to_string_pretty(&serde_json::json!({
        "schema": "bookmind.data-location.v1",
        "dataDir": data_dir.display().to_string()
    }))
    .map_err(|error| format!("无法序列化数据位置元数据: {error}"))?;
    fs::write(&path, raw)
        .map_err(|error| format!("无法写入数据位置元数据 {}: {error}", path.display()))
}

fn infer_previous_data_dir_from_library(data_dir: &Path) -> Option<PathBuf> {
    let raw = fs::read_to_string(library_file_path(data_dir)).ok()?;
    let value: serde_json::Value = serde_json::from_str(&raw).ok()?;
    find_previous_data_dir_in_json(&value, data_dir)
}

fn find_previous_data_dir_in_json(value: &serde_json::Value, data_dir: &Path) -> Option<PathBuf> {
    match value {
        serde_json::Value::String(raw) => infer_data_dir_from_managed_path(raw, data_dir),
        serde_json::Value::Array(items) => items
            .iter()
            .find_map(|item| find_previous_data_dir_in_json(item, data_dir)),
        serde_json::Value::Object(items) => items
            .values()
            .find_map(|item| find_previous_data_dir_in_json(item, data_dir)),
        _ => None,
    }
}

fn infer_data_dir_from_managed_path(raw: &str, data_dir: &Path) -> Option<PathBuf> {
    let normalized = raw.trim().replace('\\', "/");
    let marker = "/library/";
    let marker_index = normalized.to_ascii_lowercase().find(marker)?;
    let relative = &normalized[marker_index + 1..];
    let candidate = relative
        .split('/')
        .filter(|part| !part.is_empty())
        .fold(data_dir.to_path_buf(), |path, part| path.join(part));
    if !candidate.exists() {
        return None;
    }
    let previous = normalized[..marker_index].trim();
    if previous.is_empty() {
        return None;
    }
    let previous = PathBuf::from(previous);
    (canonical_or_self(&previous) != canonical_or_self(data_dir)).then_some(previous)
}

fn rewrite_migrated_data_dir_references(
    source_dir: &Path,
    target_dir: &Path,
) -> Result<(), String> {
    if canonical_or_self(source_dir) == canonical_or_self(target_dir) || !target_dir.exists() {
        return Ok(());
    }
    let replacements = data_dir_reference_replacements(source_dir, target_dir);
    rewrite_migrated_references_in_path(target_dir, target_dir, &replacements)
}

fn data_dir_reference_replacements(source_dir: &Path, target_dir: &Path) -> Vec<(String, String)> {
    let source_native = source_dir.display().to_string();
    let target_native = target_dir.display().to_string();
    let source_forward = source_native.replace('\\', "/");
    let target_forward = target_native.replace('\\', "/");
    let mut replacements = vec![
        (
            source_native.replace('\\', "\\\\"),
            target_native.replace('\\', "\\\\"),
        ),
        (source_native, target_native),
        (source_forward, target_forward),
    ];
    replacements.retain(|(source, target)| !source.is_empty() && source != target);
    replacements.sort_by(|left, right| {
        right
            .0
            .len()
            .cmp(&left.0.len())
            .then_with(|| left.0.cmp(&right.0))
    });
    replacements.dedup_by(|left, right| left.0 == right.0);
    replacements
}

fn rewrite_migrated_references_in_path(
    path: &Path,
    target_dir: &Path,
    replacements: &[(String, String)],
) -> Result<(), String> {
    if path.is_dir() {
        for entry in fs::read_dir(path)
            .map_err(|error| format!("无法检查迁移目录 {}: {error}", path.display()))?
        {
            let entry = entry.map_err(|error| format!("无法读取迁移目录项: {error}"))?;
            rewrite_migrated_references_in_path(&entry.path(), target_dir, replacements)?;
        }
        return Ok(());
    }

    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let is_json = matches!(extension.as_str(), "json" | "jsonl");
    let is_managed_text = path.starts_with(originals_dir(target_dir))
        && matches!(extension.as_str(), "txt" | "md" | "markdown");
    if !is_json && !is_managed_text {
        return Ok(());
    }
    let bytes = fs::read(path)
        .map_err(|error| format!("无法读取迁移后的文本文件 {}: {error}", path.display()))?;
    let raw = match String::from_utf8(bytes) {
        Ok(raw) => raw,
        Err(_) if is_managed_text => return Ok(()),
        Err(error) => {
            return Err(format!(
                "迁移后的 JSON 文件不是有效 UTF-8 {}: {error}",
                path.display()
            ))
        }
    };
    if is_managed_text && !raw.contains("[[BOOKMIND_EPUB_IMAGE:") {
        return Ok(());
    }
    let mut rewritten = raw.clone();
    for (source, target) in replacements {
        rewritten = rewritten.replace(source, target);
    }
    if rewritten != raw {
        fs::write(path, rewritten)
            .map_err(|error| format!("无法更新迁移后的路径引用 {}: {error}", path.display()))?;
    }
    Ok(())
}

pub(crate) fn rebase_managed_data_path(data_dir: &Path, raw: &str) -> Option<String> {
    let normalized = raw.trim().replace('\\', "/");
    if normalized.is_empty() {
        return None;
    }
    let current = data_dir.display().to_string().replace('\\', "/");
    if normalized.eq_ignore_ascii_case(&current)
        || normalized.to_ascii_lowercase().starts_with(&format!(
            "{}/",
            current.trim_end_matches('/').to_ascii_lowercase()
        ))
    {
        return None;
    }
    for root in [
        "library",
        "indexes",
        "db",
        "settings",
        "tasks",
        "notes",
        "characters",
        "exports",
        "backups",
    ] {
        let marker = format!("/{root}/");
        let Some(index) = normalized.to_ascii_lowercase().find(&marker) else {
            continue;
        };
        let relative = &normalized[index + 1..];
        let candidate = relative
            .split('/')
            .filter(|part| !part.is_empty())
            .fold(data_dir.to_path_buf(), |path, part| path.join(part));
        if candidate.exists() {
            return Some(candidate.display().to_string());
        }
    }
    None
}

fn measure_data_dir_for_migration(source_dir: &Path) -> Result<(u64, u64), String> {
    if !source_dir.exists() {
        return Ok((0, 0));
    }
    let mut total_files = 0;
    let mut total_bytes = 0;
    for entry in fs::read_dir(source_dir)
        .map_err(|error| format!("无法读取当前数据目录 {}: {error}", source_dir.display()))?
    {
        let entry = entry.map_err(|error| format!("无法读取当前数据目录项: {error}"))?;
        let (files, bytes) = measure_path_for_migration(&entry.path())?;
        total_files += files;
        total_bytes += bytes;
    }
    Ok((total_files, total_bytes))
}

fn measure_path_for_migration(path: &Path) -> Result<(u64, u64), String> {
    if !path.is_dir() {
        let bytes = fs::metadata(path)
            .map_err(|error| format!("无法读取迁移文件 {}: {error}", path.display()))?
            .len();
        return Ok((1, bytes));
    }
    let mut total_files = 0;
    let mut total_bytes = 0;
    for entry in fs::read_dir(path)
        .map_err(|error| format!("无法读取迁移目录 {}: {error}", path.display()))?
    {
        let entry = entry.map_err(|error| format!("无法读取迁移目录项: {error}"))?;
        let (files, bytes) = measure_path_for_migration(&entry.path())?;
        total_files += files;
        total_bytes += bytes;
    }
    Ok((total_files, total_bytes))
}

fn copy_data_dir_for_migration(
    source_dir: &Path,
    target_dir: &Path,
    total_files: u64,
    total_bytes: u64,
    on_progress: &mut impl FnMut(DataDirectoryMigrationProgressPayload),
) -> Result<(), String> {
    if !source_dir.exists() {
        fs::create_dir_all(target_dir)
            .map_err(|error| format!("无法创建目标数据目录 {}: {error}", target_dir.display()))?;
        return Ok(());
    }
    let mut copied_files = 0;
    let mut copied_bytes = 0;
    for entry in fs::read_dir(source_dir)
        .map_err(|error| format!("无法读取当前数据目录 {}: {error}", source_dir.display()))?
    {
        let entry = entry.map_err(|error| format!("无法读取当前数据目录项: {error}"))?;
        copy_path_for_migration(
            &entry.path(),
            &target_dir.join(entry.file_name()),
            total_files,
            total_bytes,
            &mut copied_files,
            &mut copied_bytes,
            on_progress,
        )?;
    }
    Ok(())
}

fn copy_path_for_migration(
    source_path: &Path,
    target_path: &Path,
    total_files: u64,
    total_bytes: u64,
    copied_files: &mut u64,
    copied_bytes: &mut u64,
    on_progress: &mut impl FnMut(DataDirectoryMigrationProgressPayload),
) -> Result<(), String> {
    if source_path.is_dir() {
        fs::create_dir_all(target_path)
            .map_err(|error| format!("无法创建迁移目录 {}: {error}", target_path.display()))?;
        for entry in fs::read_dir(source_path)
            .map_err(|error| format!("无法读取迁移目录 {}: {error}", source_path.display()))?
        {
            let entry = entry.map_err(|error| format!("无法读取迁移目录项: {error}"))?;
            copy_path_for_migration(
                &entry.path(),
                &target_path.join(entry.file_name()),
                total_files,
                total_bytes,
                copied_files,
                copied_bytes,
                on_progress,
            )?;
        }
        return Ok(());
    }
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建迁移文件目录 {}: {error}", parent.display()))?;
    }
    let copied = fs::copy(source_path, target_path)
        .map_err(|error| format!("无法复制数据文件 {}: {error}", source_path.display()))?;
    *copied_files += 1;
    *copied_bytes += copied;
    on_progress(DataDirectoryMigrationProgressPayload {
        phase: "copying".to_string(),
        copied_files: *copied_files,
        total_files,
        copied_bytes: *copied_bytes,
        total_bytes,
        current_path: source_path.display().to_string(),
    });
    Ok(())
}

fn canonical_or_self(path: &Path) -> PathBuf {
    fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

pub(crate) fn library_file_path(data_dir: &Path) -> PathBuf {
    data_dir.join("library").join(LIBRARY_FILE_NAME)
}

pub(crate) fn originals_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("library").join("originals")
}

pub(crate) fn epub_assets_dir(data_dir: &Path, book_id: &str) -> PathBuf {
    data_dir.join("library").join("epub-assets").join(book_id)
}

pub(crate) fn library_covers_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("library").join("covers")
}

pub(crate) fn original_backups_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("library").join("original-backups")
}

pub(crate) fn task_file_path(data_dir: &Path) -> PathBuf {
    data_dir.join("tasks").join(TASK_FILE_NAME)
}

pub(crate) fn task_logs_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("tasks").join("task_logs")
}

pub(crate) fn task_log_file_path(data_dir: &Path) -> PathBuf {
    task_logs_dir(data_dir).join("task_logs.jsonl")
}

pub(crate) fn task_log_file_path_for_day(data_dir: &Path, day: &str) -> PathBuf {
    task_logs_dir(data_dir).join(format!("{day}.jsonl"))
}

pub(crate) fn index_manifest_path(data_dir: &Path) -> PathBuf {
    data_dir.join("indexes").join(INDEX_MANIFEST_FILE_NAME)
}

pub(crate) fn vector_index_manifest_path(data_dir: &Path) -> PathBuf {
    data_dir
        .join("indexes")
        .join("vector")
        .join(VECTOR_INDEX_MANIFEST_FILE_NAME)
}

pub(crate) fn chunk_file_path(data_dir: &Path) -> PathBuf {
    data_dir.join("indexes").join("bm25").join(CHUNK_FILE_NAME)
}

pub(crate) fn fts_database_path(data_dir: &Path) -> PathBuf {
    data_dir.join("db").join("bookmind.sqlite")
}

pub(crate) fn character_book_dir(data_dir: &Path, book_id: &str) -> PathBuf {
    data_dir.join("characters").join("books").join(book_id)
}

pub(crate) fn notes_file_path(data_dir: &Path) -> PathBuf {
    data_dir.join("notes").join(NOTES_FILE_NAME)
}

pub(crate) fn highlights_file_path(data_dir: &Path) -> PathBuf {
    data_dir.join("notes").join(HIGHLIGHTS_FILE_NAME)
}

pub(crate) fn flashcards_file_path(data_dir: &Path) -> PathBuf {
    data_dir.join("notes").join(FLASHCARDS_FILE_NAME)
}

pub(crate) fn exports_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("exports")
}

pub(crate) fn settings_file_path(data_dir: &Path) -> PathBuf {
    data_dir.join("settings").join(SETTINGS_FILE_NAME)
}

pub(crate) fn settings_v2_file_path(data_dir: &Path) -> PathBuf {
    data_dir.join("settings").join(SETTINGS_V2_FILE_NAME)
}

pub(crate) fn secure_ai_key_store_path(data_dir: &Path) -> PathBuf {
    data_dir.join("settings").join("ai-api-key.secure")
}

pub(crate) fn secure_local_data_key_store_path(data_dir: &Path) -> PathBuf {
    data_dir.join("settings").join("local-data-key.secure")
}

pub(crate) fn local_data_key_wrap_path(data_dir: &Path) -> PathBuf {
    data_dir.join("settings").join("local-data-key.wrap.json")
}

pub(crate) fn local_data_key_registry_path(data_dir: &Path) -> PathBuf {
    data_dir.join("settings").join("local-data-keys.json")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

    #[test]
    fn default_data_directory_uses_the_host_local_data_location() {
        let support_dir = default_support_dir().expect("host local data directory should resolve");

        assert!(support_dir.is_absolute());
        assert_eq!(
            support_dir.file_name().and_then(|name| name.to_str()),
            Some(LIBRARY_DIR_NAME)
        );
    }

    #[test]
    fn custom_locator_overrides_default_data_directory() {
        let support_dir = unique_temp_dir();
        let custom_dir = unique_temp_dir();
        write_data_dir_locator(&locator_file_in(&support_dir), &custom_dir)
            .expect("locator should be written");

        let resolved = resolve_app_data_dir_in(None, Some(&support_dir))
            .expect("custom data dir should resolve");

        assert_eq!(resolved, custom_dir);
    }

    #[test]
    fn portable_data_directory_takes_priority_over_custom_locator() {
        let support_dir = unique_temp_dir();
        let exe_dir = unique_temp_dir();
        let custom_dir = unique_temp_dir();
        let portable_dir = portable_data_dir_in(&exe_dir);
        std::fs::create_dir_all(&portable_dir).expect("portable dir should exist");
        std::fs::write(portable_dir.join("portable.marker"), "active")
            .expect("portable marker should exist");
        write_data_dir_locator(&locator_file_in(&support_dir), &custom_dir)
            .expect("locator should be written");

        let status = data_directory_status_in(Some(&exe_dir), Some(&support_dir))
            .expect("data directory status should resolve");

        assert_eq!(status.mode, "portable");
        assert_eq!(PathBuf::from(status.data_dir), portable_dir);
        assert!(status.portable_available);
    }

    #[test]
    fn empty_portable_directory_does_not_hide_active_data() {
        let support_dir = unique_temp_dir();
        let exe_dir = unique_temp_dir();
        let custom_dir = unique_temp_dir();
        std::fs::create_dir_all(portable_data_dir_in(&exe_dir))
            .expect("empty portable dir should exist");
        write_data_dir_locator(&locator_file_in(&support_dir), &custom_dir)
            .expect("locator should be written");

        let resolved = resolve_app_data_dir_in(Some(&exe_dir), Some(&support_dir))
            .expect("empty portable dir should be ignored");

        assert_eq!(resolved, custom_dir);
    }

    #[test]
    fn migration_copies_current_data_and_switches_locator_after_success() {
        let support_dir = unique_temp_dir();
        let current_dir = unique_temp_dir();
        let target_dir = unique_temp_dir().join("target");
        std::fs::create_dir_all(current_dir.join("library")).expect("library dir should exist");
        std::fs::write(
            current_dir.join("library").join("library.json"),
            "library data",
        )
        .expect("source data should be written");

        let status = migrate_app_data_dir_in(&current_dir, &target_dir, &support_dir)
            .expect("migration should succeed");

        assert_eq!(status.mode, "custom");
        assert_eq!(PathBuf::from(status.data_dir), target_dir);
        assert!(!current_dir.exists());
        assert_eq!(
            std::fs::read_to_string(target_dir.join("library").join("library.json"))
                .expect("target data should be readable"),
            "library data"
        );
        assert_eq!(
            read_custom_data_dir_from_locator(&locator_file_in(&support_dir))
                .expect("locator should point to target"),
            target_dir
        );
    }

    #[test]
    fn migration_rewrites_serialized_and_embedded_managed_paths() {
        let support_dir = unique_temp_dir();
        let current_dir = unique_temp_dir();
        let target_dir = unique_temp_dir().join("target");
        let old_book_path = current_dir
            .join("library")
            .join("originals")
            .join("book.txt");
        let old_cover_path = current_dir
            .join("library")
            .join("epub-assets")
            .join("cover.jpg");
        std::fs::create_dir_all(old_book_path.parent().expect("book parent should exist"))
            .expect("book directory should exist");
        std::fs::create_dir_all(old_cover_path.parent().expect("cover parent should exist"))
            .expect("cover directory should exist");
        std::fs::write(&old_cover_path, "cover").expect("cover should be written");
        std::fs::write(
            &old_book_path,
            format!("[[BOOKMIND_EPUB_IMAGE:{}]]", old_cover_path.display()),
        )
        .expect("book should be written");
        std::fs::write(
            current_dir.join("library").join("library.json"),
            serde_json::to_string(&serde_json::json!([{
                "filePath": old_book_path.display().to_string(),
                "coverImagePath": old_cover_path.display().to_string()
            }]))
            .expect("library should serialize"),
        )
        .expect("library should be written");

        migrate_app_data_dir_in(&current_dir, &target_dir, &support_dir)
            .expect("migration should succeed");

        let library = std::fs::read_to_string(target_dir.join("library").join("library.json"))
            .expect("library should be readable");
        let book = std::fs::read_to_string(
            target_dir
                .join("library")
                .join("originals")
                .join("book.txt"),
        )
        .expect("book should be readable");
        assert!(!library.contains(&current_dir.display().to_string()));
        assert!(!book.contains(&current_dir.display().to_string()));
        assert!(library.contains(&target_dir.display().to_string()));
        assert!(book.contains(&target_dir.display().to_string()));
    }

    #[test]
    fn relocated_data_self_repairs_paths_from_an_older_migration() {
        let old_dir = unique_temp_dir();
        let target_dir = unique_temp_dir();
        let target_book = target_dir
            .join("library")
            .join("originals")
            .join("book.txt");
        std::fs::create_dir_all(target_book.parent().expect("book parent should exist"))
            .expect("book directory should exist");
        std::fs::write(&target_book, "book").expect("book should be written");
        std::fs::write(
            target_dir.join("library").join("library.json"),
            serde_json::to_string(&serde_json::json!([{
                "filePath": old_dir.join("library").join("originals").join("book.txt")
            }]))
            .expect("library should serialize"),
        )
        .expect("library should be written");

        repair_relocated_data_dir_references(&target_dir)
            .expect("relocated paths should self-repair");

        let library = std::fs::read_to_string(target_dir.join("library").join("library.json"))
            .expect("library should be readable");
        assert!(!library.contains(&old_dir.display().to_string()));
        assert!(library.contains(&target_dir.display().to_string()));
        assert!(target_dir.join(DATA_DIR_LOCATION_FILE_NAME).exists());
    }

    #[test]
    fn enabling_portable_mode_migrates_and_removes_the_active_source() {
        let support_dir = unique_temp_dir();
        let exe_dir = unique_temp_dir();
        std::fs::create_dir_all(support_dir.join("library")).expect("source library should exist");
        std::fs::write(support_dir.join("library").join("library.json"), "[]")
            .expect("source library should be written");

        let status = enable_portable_data_dir_in(&exe_dir, Some(&support_dir))
            .expect("portable migration should succeed");

        let portable_dir = portable_data_dir_in(&exe_dir);
        assert_eq!(status.mode, "portable");
        assert_eq!(PathBuf::from(status.data_dir), portable_dir);
        assert!(!support_dir.exists());
        assert!(portable_dir.join("library").join("library.json").exists());
    }

    #[test]
    fn migration_refuses_target_inside_current_directory() {
        let support_dir = unique_temp_dir();
        let current_dir = unique_temp_dir();
        let target_dir = current_dir.join("nested-target");
        std::fs::create_dir_all(&current_dir).expect("source dir should exist");

        let error = migrate_app_data_dir_in(&current_dir, &target_dir, &support_dir)
            .expect_err("nested target should be rejected");

        assert!(error.contains("不能位于当前数据目录内部"));
        assert!(current_dir.exists());
    }

    #[test]
    fn migration_from_default_directory_deletes_source_and_keeps_locator() {
        let support_dir = unique_temp_dir();
        let target_dir = unique_temp_dir();
        std::fs::create_dir_all(support_dir.join("settings"))
            .expect("default settings dir should exist");
        std::fs::write(support_dir.join("settings").join("settings.json"), "{}")
            .expect("default settings should be written");

        let status = migrate_app_data_dir_in(&support_dir, &target_dir, &support_dir)
            .expect("default data migration should succeed");

        assert_eq!(PathBuf::from(status.data_dir), target_dir);
        assert!(!support_dir.exists());
        assert!(locator_file_in(&support_dir).exists());
        assert_eq!(
            resolve_app_data_dir_in(None, Some(&support_dir))
                .expect("external locator should survive source deletion"),
            target_dir
        );
    }

    #[test]
    fn legacy_locator_is_still_resolved() {
        let support_dir = unique_temp_dir();
        let custom_dir = unique_temp_dir();
        write_data_dir_locator(&legacy_locator_file_in(&support_dir), &custom_dir)
            .expect("legacy locator should be written");

        let resolved = resolve_app_data_dir_in(None, Some(&support_dir))
            .expect("legacy custom data dir should resolve");

        assert_eq!(resolved, custom_dir);
    }

    #[test]
    fn migration_refuses_non_empty_target_without_switching_locator() {
        let support_dir = unique_temp_dir();
        let current_dir = unique_temp_dir();
        let target_dir = unique_temp_dir();
        std::fs::create_dir_all(&target_dir).expect("target dir should exist");
        std::fs::write(target_dir.join("existing.txt"), "do not overwrite")
            .expect("existing target file should be written");

        let error = migrate_app_data_dir_in(&current_dir, &target_dir, &support_dir)
            .expect_err("non-empty target should be rejected");

        assert!(error.contains("目标数据目录必须为空"));
        assert!(!locator_file_in(&support_dir).exists());
    }

    fn unique_temp_dir() -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be valid")
            .as_nanos();
        let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("bookmind-path-test-{stamp}-{counter}"))
    }
}
