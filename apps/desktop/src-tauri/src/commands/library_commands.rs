use crate::library::{
    empty_trash_in, import_book_directory_into, import_book_files_into, import_book_from_path_into,
    import_book_from_path_with_cleanup_into, import_library_cover_image_into,
    load_library_metadata_payloads, load_library_records, load_reader_document_payload,
    move_book_to_trash_in, permanently_delete_book_in, read_book_content,
    restore_book_from_trash_in, save_library_records, scan_book_import_directory_into,
    TxtImportCleanupOptions,
};
use crate::models::{
    BookPayload, BookRecord, DirectoryImportFileSelection, DirectoryImportPayload,
    DirectoryImportScanPayload,
};
use crate::paths::app_data_dir;
use crate::tasks::{run_parse_and_index_tasks_in, try_acquire_task_runner};
use std::path::{Path, PathBuf};

#[tauri::command]
pub(crate) fn get_library_books() -> Result<Vec<BookPayload>, String> {
    let data_dir = app_data_dir()?;
    load_library_metadata_payloads(&data_dir)
}

#[tauri::command]
pub(crate) fn get_reader_document(book_id: String) -> Result<BookPayload, String> {
    let data_dir = app_data_dir()?;
    load_reader_document_payload(&data_dir, &book_id)
}

#[tauri::command]
pub(crate) fn get_pdf_source_bytes(book_id: String) -> Result<Vec<u8>, String> {
    let data_dir = app_data_dir()?;
    let records = load_library_records(&data_dir)?;
    let record = records
        .iter()
        .find(|record| record.id == book_id)
        .ok_or_else(|| format!("找不到 PDF 书籍：{book_id}"))?;
    if !record.format.eq_ignore_ascii_case("pdf") {
        return Err(format!("当前书籍不是 PDF：{}", record.display_title));
    }
    let source_path = if record.source_file_path.trim().is_empty() {
        &record.file_path
    } else {
        &record.source_file_path
    };
    if source_path.trim().is_empty() {
        return Err("PDF 原始文件路径为空，请重新导入。".to_string());
    }
    let path = Path::new(source_path);
    let is_pdf = path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false);
    if !is_pdf {
        return Err(format!("PDF 原始文件路径不是 .pdf：{}", path.display()));
    }
    std::fs::read(path)
        .map_err(|error| format!("无法读取 PDF 原始文件 {}: {error}", path.display()))
}

#[tauri::command]
pub(crate) fn get_epub_source_bytes(book_id: String) -> Result<Vec<u8>, String> {
    let data_dir = app_data_dir()?;
    let records = load_library_records(&data_dir)?;
    let record = records
        .iter()
        .find(|record| record.id == book_id)
        .ok_or_else(|| format!("找不到 EPUB 书籍：{book_id}"))?;
    if !record.format.eq_ignore_ascii_case("epub") {
        return Err(format!("当前书籍不是 EPUB：{}", record.display_title));
    }
    let source_path = if record.source_file_path.trim().is_empty() {
        &record.file_path
    } else {
        &record.source_file_path
    };
    if source_path.trim().is_empty() {
        return Err("EPUB 原始文件路径为空，请重新导入。".to_string());
    }
    let path = Path::new(source_path);
    let is_epub = path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("epub"))
        .unwrap_or(false);
    if !is_epub {
        return Err(format!("EPUB 原始文件路径不是 .epub：{}", path.display()));
    }
    std::fs::read(path)
        .map_err(|error| format!("无法读取 EPUB 原始文件 {}: {error}", path.display()))
}

#[tauri::command]
pub(crate) fn update_book_metadata(updated: BookRecord) -> Result<BookRecord, String> {
    let data_dir = app_data_dir()?;
    update_book_metadata_in(&data_dir, updated)
}

pub(crate) fn update_book_metadata_in(
    data_dir: &Path,
    updated: BookRecord,
) -> Result<BookRecord, String> {
    let mut records = load_library_records(&data_dir)?;

    let Some(record) = records.iter_mut().find(|record| record.id == updated.id) else {
        return Err(format!("找不到书籍元数据：{}", updated.id));
    };
    record.display_title = updated.display_title.trim().to_string();
    if record.display_title.is_empty() {
        record.display_title = record.title.clone();
    }
    record.author = updated.author.trim().to_string();
    if record.author.is_empty() {
        record.author = "本地导入".to_string();
    }
    if !updated.source_file_path.trim().is_empty() {
        record.source_file_path = updated.source_file_path;
    }
    record.cover_label = updated.cover_label;
    record.cover_tone = updated.cover_tone;
    record.cover_image_path = updated.cover_image_path;
    record.deleted = updated.deleted;
    record.deleted_at = updated.deleted_at;
    record.progress = updated.progress.min(100);
    record.last_opened_at = updated.last_opened_at;
    record.shelf_groups = normalize_shelf_groups(&updated.shelf_groups);

    let saved = record.clone();
    save_library_records(&data_dir, &records)?;
    Ok(saved)
}

fn normalize_shelf_groups(groups: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();
    for raw in groups {
        let group = raw
            .chars()
            .map(|ch| match ch {
                '\\' | '/' | '|' | '<' | '>' | ':' | '"' | '?' | '*' => ' ',
                _ => ch,
            })
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        let group = group.chars().take(32).collect::<String>();
        if group.is_empty() || normalized.iter().any(|item| item == &group) {
            continue;
        }
        normalized.push(group);
    }
    normalized
}

#[tauri::command]
pub(crate) fn import_book_from_path(
    path: String,
    cleanup_options: Option<TxtImportCleanupOptions>,
) -> Result<BookPayload, String> {
    let data_dir = app_data_dir()?;
    let record = import_book_from_path_with_cleanup_into(
        &data_dir,
        Path::new(&path),
        cleanup_options.as_ref(),
    )?;
    let content = read_book_content(Path::new(&record.file_path))?;
    let source_file_path = Some(record.source_file_path.clone());
    Ok(BookPayload {
        record,
        content,
        chunks: Vec::new(),
        source_file_path,
    })
}

#[tauri::command]
pub(crate) fn move_book_to_trash(book_id: String) -> Result<BookRecord, String> {
    let data_dir = app_data_dir()?;
    move_book_to_trash_in(&data_dir, &book_id)
}

#[tauri::command]
pub(crate) fn restore_book_from_trash(book_id: String) -> Result<BookRecord, String> {
    let data_dir = app_data_dir()?;
    restore_book_from_trash_in(&data_dir, &book_id)
}

#[tauri::command]
pub(crate) fn permanently_delete_book(book_id: String) -> Result<Vec<BookPayload>, String> {
    let data_dir = app_data_dir()?;
    permanently_delete_book_command_in(&data_dir, &book_id)
}

pub(crate) fn permanently_delete_book_command_in(
    data_dir: &Path,
    book_id: &str,
) -> Result<Vec<BookPayload>, String> {
    permanently_delete_book_in(data_dir, book_id)?;
    load_library_metadata_payloads(data_dir)
}

#[tauri::command]
pub(crate) fn empty_trash(force: Option<bool>) -> Result<Vec<BookPayload>, String> {
    let data_dir = app_data_dir()?;
    empty_trash_command_in(&data_dir, force.unwrap_or(false))
}

pub(crate) fn empty_trash_command_in(
    data_dir: &Path,
    force: bool,
) -> Result<Vec<BookPayload>, String> {
    empty_trash_in(data_dir, force)?;
    load_library_metadata_payloads(data_dir)
}

#[tauri::command]
pub(crate) fn import_library_cover_image(path: String) -> Result<String, String> {
    let data_dir = app_data_dir()?;
    import_library_cover_image_into(&data_dir, Path::new(&path))
}

#[tauri::command]
pub(crate) fn import_books_from_directory(
    path: String,
    recursive: Option<bool>,
    continue_after_failure: Option<bool>,
    cleanup_options: Option<TxtImportCleanupOptions>,
) -> Result<DirectoryImportPayload, String> {
    let data_dir = app_data_dir()?;
    import_books_from_directory_in(
        &data_dir,
        Path::new(&path),
        recursive.unwrap_or(true),
        continue_after_failure.unwrap_or(false),
        cleanup_options.as_ref(),
    )
}

#[tauri::command]
pub(crate) fn scan_book_import_directory(
    path: String,
    recursive: Option<bool>,
) -> Result<DirectoryImportScanPayload, String> {
    scan_book_import_directory_into(Path::new(&path), recursive.unwrap_or(true))
}

#[tauri::command]
pub(crate) fn import_book_files(
    files: Vec<DirectoryImportFileSelection>,
    continue_after_failure: Option<bool>,
    cleanup_options: Option<TxtImportCleanupOptions>,
) -> Result<DirectoryImportPayload, String> {
    let data_dir = app_data_dir()?;
    let mut display_names = std::collections::HashMap::new();
    let paths = files
        .into_iter()
        .map(|file| {
            let path = PathBuf::from(file.path);
            if !file.display_name.trim().is_empty() {
                display_names.insert(path.clone(), file.display_name);
            }
            path
        })
        .collect::<Vec<_>>();
    let outcome = import_book_files_into(
        &data_dir,
        &paths,
        Some(&display_names),
        continue_after_failure.unwrap_or(false),
        cleanup_options.as_ref(),
    )?;
    let failed_count = outcome.failed_count;
    let books = outcome
        .records
        .into_iter()
        .map(|record| {
            let source_file_path = Some(record.source_file_path.clone());
            BookPayload {
                record,
                content: String::new(),
                chunks: Vec::new(),
                source_file_path,
            }
        })
        .collect();
    Ok(DirectoryImportPayload {
        books,
        failed_count,
    })
}

pub(crate) fn import_books_from_directory_in(
    data_dir: &Path,
    path: &Path,
    recursive: bool,
    continue_after_failure: bool,
    cleanup_options: Option<&TxtImportCleanupOptions>,
) -> Result<DirectoryImportPayload, String> {
    let outcome = import_book_directory_into(
        data_dir,
        path,
        recursive,
        continue_after_failure,
        cleanup_options,
    )?;
    let failed_count = outcome.failed_count;
    let books = outcome
        .records
        .into_iter()
        .map(|record| {
            let source_file_path = Some(record.source_file_path.clone());
            BookPayload {
                record,
                content: String::new(),
                chunks: Vec::new(),
                source_file_path,
            }
        })
        .collect();
    Ok(DirectoryImportPayload {
        books,
        failed_count,
    })
}

#[tauri::command]
pub(crate) fn import_dev_sample_book_and_index() -> Result<BookPayload, String> {
    let data_dir = app_data_dir()?;
    let sample_dir = data_dir.join("developer-samples");
    std::fs::create_dir_all(&sample_dir)
        .map_err(|error| format!("无法创建开发示例目录 {}: {error}", sample_dir.display()))?;
    let sample_path = sample_dir.join("BookMind AI 研究台示例.txt");
    std::fs::write(
        &sample_path,
        "第一章 雨夜病院\n林七夜在雨夜抵达病院，墙上的钟声忽然停止。医生记录他的异常反应，并提醒他不要相信走廊尽头的影子。\n\n第二章 证据纸条\n主角开始把每次钟声、影子和医生的措辞记录成证据纸条。重复出现的钟声可能暗示时间异常，也适合测试伏笔、时间线和人物关系分析。\n\n第三章 回跳验证\n研究台需要先检索本地索引，再用 citation 回跳到原文段落。这个示例书籍用于开发环境快速验证导入、解析索引和 AI 回答渲染。",
    )
    .map_err(|error| format!("无法写入开发示例书籍 {}: {error}", sample_path.display()))?;
    let record = import_book_from_path_into(&data_dir, &sample_path)?;
    if let Some(runner_guard) = try_acquire_task_runner() {
        let _runner_guard = runner_guard;
        run_parse_and_index_tasks_in(&data_dir)?;
    }
    load_reader_document_payload(&data_dir, &record.id)
}
