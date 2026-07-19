use super::*;

pub(crate) fn move_book_to_trash_in(data_dir: &Path, book_id: &str) -> Result<BookRecord, String> {
    let mut records = load_library_records(data_dir)?;
    let Some(record) = records.iter_mut().find(|record| record.id == book_id) else {
        return Err(format!("找不到书籍：{book_id}"));
    };
    record.deleted = true;
    record.deleted_at = now_epoch_millis().to_string();
    record.status = "已移入回收站".to_string();
    let updated = record.clone();
    save_library_records(data_dir, &records)?;
    Ok(updated)
}

pub(crate) fn restore_book_from_trash_in(
    data_dir: &Path,
    book_id: &str,
) -> Result<BookRecord, String> {
    let mut records = load_library_records(data_dir)?;
    let Some(record) = records.iter_mut().find(|record| record.id == book_id) else {
        return Err(format!("找不到回收站书籍：{book_id}"));
    };
    record.deleted = false;
    record.deleted_at.clear();
    record.status = "已恢复到书架".to_string();
    let updated = record.clone();
    save_library_records(data_dir, &records)?;
    Ok(updated)
}

pub(crate) fn permanently_delete_book_in(
    data_dir: &Path,
    book_id: &str,
) -> Result<Vec<BookRecord>, String> {
    let mut records = load_library_records(data_dir)?;
    let removed: Vec<BookRecord> = records
        .iter()
        .filter(|record| record.id == book_id && record.deleted)
        .cloned()
        .collect();
    if removed.is_empty() {
        return Err(format!("找不到可永久删除的回收站书籍：{book_id}"));
    }
    purge_records(data_dir, &removed)?;
    records.retain(|record| !(record.id == book_id && record.deleted));
    save_library_records(data_dir, &records)?;
    Ok(records)
}

pub(crate) fn empty_trash_in(data_dir: &Path, force: bool) -> Result<Vec<BookRecord>, String> {
    let mut records = load_library_records(data_dir)?;
    let settings = load_app_settings(data_dir)?;
    let removed: Vec<BookRecord> = records
        .iter()
        .filter_map(|record| {
            if !record.deleted {
                None
            } else if force {
                Some(Ok(record.clone()))
            } else {
                match is_trash_record_protected(
                    data_dir,
                    record,
                    settings.trash_protect_reading_progress,
                    settings.trash_protect_reader_assets,
                ) {
                    Ok(true) => None,
                    Ok(false) => Some(Ok(record.clone())),
                    Err(error) => Some(Err(error)),
                }
            }
        })
        .collect::<Result<_, String>>()?;
    let ids: std::collections::HashSet<&str> =
        removed.iter().map(|record| record.id.as_str()).collect();
    purge_records(data_dir, &removed)?;
    records.retain(|record| !ids.contains(record.id.as_str()));
    save_library_records(data_dir, &records)?;
    Ok(records)
}

fn purge_records(data_dir: &Path, records: &[BookRecord]) -> Result<(), String> {
    for record in records {
        remove_managed_original_file(data_dir, &record.file_path)?;
        remove_managed_original_file(data_dir, &record.source_file_path)?;
        delete_book_index_in(data_dir, &record.id)?;
        remove_character_outputs_for_book(data_dir, &record.id)?;
        archive_reader_records_for_deleted_book_in(data_dir, &record.id)?;
    }
    Ok(())
}

pub(super) fn expired_trash_record_ids(
    data_dir: &Path,
    records: &[BookRecord],
    retention_days: u32,
    protect_reading_progress: bool,
    protect_reader_assets: bool,
) -> Result<Vec<String>, String> {
    let now = now_epoch_millis();
    let retention_millis = retention_days as u128 * DAY_MILLIS;
    let mut expired_ids = Vec::new();
    for record in records {
        if !record.deleted {
            continue;
        }
        let deleted_at = record.deleted_at.parse::<u128>().unwrap_or(now);
        if now.saturating_sub(deleted_at) < retention_millis {
            continue;
        }
        if is_trash_record_protected(
            data_dir,
            record,
            protect_reading_progress,
            protect_reader_assets,
        )? {
            continue;
        }
        expired_ids.push(record.id.clone());
    }
    Ok(expired_ids)
}

fn is_trash_record_protected(
    data_dir: &Path,
    record: &BookRecord,
    protect_reading_progress: bool,
    protect_reader_assets: bool,
) -> Result<bool, String> {
    if !record.deleted {
        return Ok(false);
    }
    if protect_reading_progress && record.progress > 0 {
        return Ok(true);
    }
    if protect_reader_assets && has_reader_records_for_book_in(data_dir, &record.id)? {
        return Ok(true);
    }
    Ok(false)
}

fn managed_original_path(data_dir: &Path, raw_path: &str) -> Result<Option<PathBuf>, String> {
    let originals = originals_dir(data_dir);
    fs::create_dir_all(&originals)
        .map_err(|error| format!("无法创建原始书籍目录 {}: {error}", originals.display()))?;
    let managed_root = originals
        .canonicalize()
        .map_err(|error| format!("无法校验原始书籍目录 {}: {error}", originals.display()))?;
    let requested = Path::new(raw_path);
    if requested.as_os_str().is_empty() {
        eprintln!("跳过空书籍路径删除，仅移除书库记录");
        return Ok(None);
    }
    let candidate = if requested.exists() {
        requested
            .canonicalize()
            .map_err(|error| format!("无法校验待删除书籍路径 {}: {error}", requested.display()))?
    } else {
        let Some(parent) = requested.parent() else {
            eprintln!(
                "跳过缺少父目录的书籍路径删除，仅移除书库记录: {}",
                requested.display()
            );
            return Ok(None);
        };
        let Ok(canonical_parent) = parent.canonicalize() else {
            eprintln!(
                "跳过已丢失的书籍路径删除，仅移除书库记录: {}",
                requested.display()
            );
            return Ok(None);
        };
        let Some(file_name) = requested.file_name() else {
            eprintln!(
                "跳过缺少文件名的书籍路径删除，仅移除书库记录: {}",
                requested.display()
            );
            return Ok(None);
        };
        canonical_parent.join(file_name)
    };
    if candidate == managed_root || !candidate.starts_with(&managed_root) {
        eprintln!(
            "跳过旧版外部书籍路径删除，仅移除书库记录: {}",
            requested.display()
        );
        return Ok(None);
    }
    Ok(Some(candidate))
}

pub(super) fn remove_managed_original_file(data_dir: &Path, raw_path: &str) -> Result<(), String> {
    let Some(path) = managed_original_path(data_dir, raw_path)? else {
        return Ok(());
    };
    if !path.exists() {
        return Ok(());
    }
    fs::remove_file(&path)
        .map_err(|error| format!("无法删除受管原始书籍 {}: {error}", path.display()))
}

fn remove_character_outputs_for_book(data_dir: &Path, book_id: &str) -> Result<(), String> {
    if book_id.contains(['/', '\\']) || book_id == "." || book_id == ".." || book_id.is_empty() {
        return Err(format!("人物中心数据路径异常，拒绝删除 bookId: {book_id}"));
    }
    let root = data_dir.join("characters").join("books");
    let path = character_book_dir(data_dir, book_id);
    if !path.exists() {
        return Ok(());
    }
    let root_canonical = fs::canonicalize(&root)
        .map_err(|error| format!("无法校验人物中心目录 {}: {error}", root.display()))?;
    let target_canonical = fs::canonicalize(&path)
        .map_err(|error| format!("无法校验人物中心数据 {}: {error}", path.display()))?;
    if target_canonical.parent() != Some(root_canonical.as_path()) {
        return Err(format!("人物中心数据路径异常，拒绝删除 {}", path.display()));
    }
    fs::remove_dir_all(&path)
        .map_err(|error| format!("无法删除人物中心数据 {}: {error}", path.display()))
}
