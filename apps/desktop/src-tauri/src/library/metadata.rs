use super::*;
use crate::models::BookPayload;

pub(crate) fn load_library_payloads(data_dir: &Path) -> Result<Vec<BookPayload>, String> {
    let mut records = load_library_records(data_dir)?;
    let before_cleanup = records.len();
    records.retain(|record| {
        record.id != "sample-local-txt" && record.content_hash != "sample-local-txt"
    });
    if records.len() != before_cleanup {
        save_library_records(data_dir, &records)?;
    }

    records
        .into_iter()
        .map(|record| {
            let source_file_path = Some(record.source_file_path.clone());
            let content = super::read_book_content(Path::new(&record.file_path))?;
            Ok(BookPayload {
                record,
                content,
                chunks: Vec::new(),
                source_file_path,
            })
        })
        .collect()
}

pub(crate) fn load_library_metadata_payloads(data_dir: &Path) -> Result<Vec<BookPayload>, String> {
    let mut records = load_library_records(data_dir)?;
    let before_cleanup = records.len();
    records.retain(|record| {
        record.id != "sample-local-txt" && record.content_hash != "sample-local-txt"
    });
    if records.len() != before_cleanup {
        save_library_records(data_dir, &records)?;
    }
    Ok(records
        .into_iter()
        .map(|record| BookPayload {
            record,
            content: String::new(),
            chunks: Vec::new(),
            source_file_path: None,
        })
        .collect())
}

pub(crate) fn load_library_records(data_dir: &Path) -> Result<Vec<BookRecord>, String> {
    let path = library_file_path(data_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取书库元数据 {}: {error}", path.display()))?;
    let mut records: Vec<BookRecord> = serde_json::from_str(&raw)
        .map_err(|error| format!("无法解析书库元数据 {}: {error}", path.display()))?;
    let mut migrated_paths = false;
    for record in &mut records {
        for path_value in [
            &mut record.file_path,
            &mut record.source_file_path,
            &mut record.cover_image_path,
        ] {
            if let Some(rebased) = rebase_managed_data_path(data_dir, path_value) {
                *path_value = rebased;
                migrated_paths = true;
            }
        }
        if repair_epub_image_markers(data_dir, &record.file_path)? {
            migrated_paths = true;
        }
        if record.cover_image_path.trim().is_empty() && record.format.eq_ignore_ascii_case("EPUB") {
            record.cover_image_path = first_epub_image_marker_from_managed_text(&record.file_path);
        }
        if let Some(managed_cover_path) =
            migrate_external_cover_image_path(data_dir, &record.cover_image_path)
        {
            record.cover_image_path = managed_cover_path;
            migrated_paths = true;
        }
    }
    if migrated_paths {
        save_library_records(data_dir, &records)?;
    }
    let app_settings = load_app_settings(data_dir)?;
    if app_settings.trash_auto_cleanup_enabled {
        let purged_ids = super::trash::expired_trash_record_ids(
            data_dir,
            &records,
            app_settings.trash_retention_days,
            app_settings.trash_protect_reading_progress,
            app_settings.trash_protect_reader_assets,
        )?;
        if !purged_ids.is_empty() {
            for record in records
                .iter()
                .filter(|record| purged_ids.iter().any(|id| id == &record.id))
            {
                super::trash::remove_managed_original_file(data_dir, &record.file_path)?;
                delete_book_index_in(data_dir, &record.id)?;
                archive_reader_records_for_deleted_book_in(data_dir, &record.id)?;
            }
            records.retain(|record| !purged_ids.iter().any(|id| id == &record.id));
            save_library_records(data_dir, &records)?;
        }
    }
    Ok(records)
}

fn repair_epub_image_markers(data_dir: &Path, file_path: &str) -> Result<bool, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Ok(false);
    }
    let bytes =
        fs::read(path).map_err(|error| format!("无法读取书籍文件 {}: {error}", path.display()))?;
    let Ok(raw) = String::from_utf8(bytes) else {
        return Ok(false);
    };
    if !raw.contains("[[BOOKMIND_EPUB_IMAGE:") {
        return Ok(false);
    }
    let re = Regex::new(r#"\[\[BOOKMIND_EPUB_IMAGE:([^\]\n]+)\]\]"#)
        .map_err(|error| format!("无法创建 EPUB 图片路径修复规则: {error}"))?;
    let rewritten = re
        .replace_all(&raw, |captures: &regex::Captures<'_>| {
            let current = captures
                .get(1)
                .map(|value| value.as_str())
                .unwrap_or_default();
            rebase_managed_data_path(data_dir, current)
                .map(|path| format!("[[BOOKMIND_EPUB_IMAGE:{path}]]"))
                .unwrap_or_else(|| captures[0].to_string())
        })
        .into_owned();
    if rewritten == raw {
        return Ok(false);
    }
    fs::write(path, rewritten)
        .map_err(|error| format!("无法修复书籍内图片路径 {}: {error}", path.display()))?;
    Ok(true)
}

fn first_epub_image_marker_from_managed_text(file_path: &str) -> String {
    let Ok(raw) = fs::read_to_string(file_path) else {
        return String::new();
    };
    let Ok(re) = Regex::new(r#"\[\[BOOKMIND_EPUB_IMAGE:([^\]\n]+)\]\]"#) else {
        return String::new();
    };
    re.captures(&raw)
        .and_then(|captures| captures.get(1))
        .map(|value| value.as_str().trim().to_string())
        .unwrap_or_default()
}

fn migrate_external_cover_image_path(data_dir: &Path, cover_image_path: &str) -> Option<String> {
    let raw = cover_image_path.trim();
    if raw.is_empty() {
        return None;
    }
    let source_path = Path::new(raw);
    let covers_dir = library_covers_dir(data_dir);
    if let (Ok(source_canonical), Ok(covers_canonical)) =
        (source_path.canonicalize(), covers_dir.canonicalize())
    {
        if source_canonical.starts_with(covers_canonical) {
            return None;
        }
    }
    import_library_cover_image_into(data_dir, source_path).ok()
}

pub(crate) fn save_library_records(data_dir: &Path, records: &[BookRecord]) -> Result<(), String> {
    let path = library_file_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建书库目录 {}: {error}", parent.display()))?;
    }
    let raw = serde_json::to_string_pretty(records)
        .map_err(|error| format!("无法序列化书库元数据: {error}"))?;
    fs::write(&path, raw).map_err(|error| format!("无法写入书库元数据 {}: {error}", path.display()))
}
