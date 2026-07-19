use super::*;

pub(super) fn collect_import_files(
    directory: &Path,
    files: &mut Vec<PathBuf>,
    depth: usize,
    total_bytes: &mut u64,
    recursive: bool,
) -> Result<(), String> {
    if depth > MAX_DIRECTORY_IMPORT_DEPTH {
        return Err(format!(
            "导入目录层级过深：最多支持 {MAX_DIRECTORY_IMPORT_DEPTH} 层，当前到达 {}",
            directory.display()
        ));
    }
    for entry in fs::read_dir(directory)
        .map_err(|error| format!("无法读取目录 {}: {error}", directory.display()))?
    {
        let entry =
            entry.map_err(|error| format!("无法读取目录项 {}: {error}", directory.display()))?;
        let path = entry.path();
        if path.is_dir() {
            if recursive {
                collect_import_files(&path, files, depth + 1, total_bytes, recursive)?;
            }
        } else if is_supported_import_book_file(&path) {
            if files.len() >= MAX_DIRECTORY_IMPORT_BOOK_FILES {
                return Err(format!(
                    "导入目录 TXT 文件过多：最多支持 {MAX_DIRECTORY_IMPORT_BOOK_FILES} 个文件"
                ));
            }
            let size = fs::metadata(&path)
                .map_err(|error| format!("无法读取导入文件大小 {}: {error}", path.display()))?
                .len();
            *total_bytes = total_bytes.saturating_add(size);
            if *total_bytes > MAX_DIRECTORY_IMPORT_TOTAL_BYTES {
                return Err(format!(
                    "导入目录 TXT 总大小过大：最多支持 {} MB",
                    MAX_DIRECTORY_IMPORT_TOTAL_BYTES / 1024 / 1024
                ));
            }
            files.push(path);
        }
    }
    Ok(())
}

pub(crate) fn scan_book_import_directory_into(
    directory: &Path,
    recursive: bool,
) -> Result<DirectoryImportScanPayload, String> {
    if !directory.is_dir() {
        return Err(format!("导入目录不存在或不是目录：{}", directory.display()));
    }
    let mut paths = Vec::new();
    let mut total_bytes = 0;
    scan_supported_import_files(directory, &mut paths, 0, &mut total_bytes, recursive)?;
    paths.sort_by(|left, right| {
        left.components()
            .count()
            .cmp(&right.components().count())
            .then_with(|| left.cmp(right))
    });
    let files = paths
        .into_iter()
        .map(|path| {
            let size_bytes = fs::metadata(&path)
                .map(|metadata| metadata.len())
                .unwrap_or(0);
            let file_name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_string();
            let extension = path
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase();
            let display_name = path
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or(file_name.as_str())
                .to_string();
            let relative_path = path
                .strip_prefix(directory)
                .unwrap_or(path.as_path())
                .display()
                .to_string();
            DirectoryImportScanItem {
                path: path.display().to_string(),
                file_name,
                display_name,
                extension,
                relative_path,
                size_bytes,
            }
        })
        .collect();
    Ok(DirectoryImportScanPayload {
        directory: directory.display().to_string(),
        recursive,
        files,
        total_bytes,
    })
}

pub(crate) fn is_supported_import_book_file(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "txt" | "md" | "markdown" | "epub" | "mobi" | "pdf"
            )
        })
        .unwrap_or(false)
}

pub(crate) fn import_book_directory_into(
    data_dir: &Path,
    directory: &Path,
    recursive: bool,
    continue_after_failure: bool,
    cleanup_options: Option<&TxtImportCleanupOptions>,
) -> Result<DirectoryImportOutcome, String> {
    if !directory.is_dir() {
        return Err(format!("导入目录不存在或不是目录：{}", directory.display()));
    }
    let records_before_import = load_library_records(data_dir)?;
    let tasks_before_import = load_task_records(data_dir)?;
    let mut import_files = Vec::new();
    let mut total_bytes = 0u64;
    collect_import_files(directory, &mut import_files, 0, &mut total_bytes, recursive)?;
    import_files.sort_by(|left, right| {
        left.components()
            .count()
            .cmp(&right.components().count())
            .then_with(|| left.cmp(right))
    });

    let mut imported = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();
    let mut failed_count = 0usize;
    for path in import_files {
        match import_book_from_path_with_cleanup_into(data_dir, &path, cleanup_options) {
            Ok(record) => {
                if seen_ids.insert(record.id.clone()) {
                    imported.push(record);
                }
            }
            Err(error) if continue_after_failure => {
                failed_count = failed_count.saturating_add(1);
                eprintln!("跳过导入失败文件 {}: {error}", path.display());
            }
            Err(error) => {
                save_library_records(data_dir, &records_before_import)?;
                save_task_records(data_dir, &tasks_before_import)?;
                return Err(error);
            }
        }
    }
    if imported.is_empty() && failed_count > 0 {
        return Err(format!("目录导入失败：{failed_count} 个书籍文件导入失败"));
    }
    attach_directory_import_parent_task(data_dir, directory, &imported)?;
    Ok(DirectoryImportOutcome {
        records: imported,
        failed_count,
    })
}

pub(crate) fn import_book_files_into(
    data_dir: &Path,
    paths: &[PathBuf],
    display_names: Option<&HashMap<PathBuf, String>>,
    continue_after_failure: bool,
    cleanup_options: Option<&TxtImportCleanupOptions>,
) -> Result<DirectoryImportOutcome, String> {
    if paths.is_empty() {
        return Ok(DirectoryImportOutcome {
            records: Vec::new(),
            failed_count: 0,
        });
    }
    if paths.len() > MAX_DIRECTORY_IMPORT_BOOK_FILES {
        return Err(format!(
            "导入书籍文件过多：最多支持 {MAX_DIRECTORY_IMPORT_BOOK_FILES} 个文件"
        ));
    }
    let records_before_import = load_library_records(data_dir)?;
    let tasks_before_import = load_task_records(data_dir)?;
    let mut total_bytes = 0u64;
    let mut imported = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();
    let mut failed_count = 0usize;
    for path in paths {
        if !path.is_file() || !is_supported_import_book_file(path) {
            let error = format!("不支持的书籍文件：{}", path.display());
            if continue_after_failure {
                failed_count = failed_count.saturating_add(1);
                eprintln!("{error}");
                continue;
            }
            save_library_records(data_dir, &records_before_import)?;
            save_task_records(data_dir, &tasks_before_import)?;
            return Err(error);
        }
        let size = fs::metadata(path)
            .map_err(|error| format!("无法读取导入文件大小 {}: {error}", path.display()))?
            .len();
        total_bytes = total_bytes.saturating_add(size);
        if total_bytes > MAX_DIRECTORY_IMPORT_TOTAL_BYTES {
            save_library_records(data_dir, &records_before_import)?;
            save_task_records(data_dir, &tasks_before_import)?;
            return Err(format!(
                "导入书籍总大小过大：最多支持 {} MB",
                MAX_DIRECTORY_IMPORT_TOTAL_BYTES / 1024 / 1024
            ));
        }
        match import_book_from_path_with_cleanup_into(data_dir, path, cleanup_options) {
            Ok(mut record) => {
                if let Some(display_name) = display_names
                    .and_then(|names| names.get(path))
                    .map(|value| value.trim())
                    .filter(|value| !value.is_empty())
                {
                    record.title = display_name.to_string();
                    record.display_title = display_name.to_string();
                    let mut records = load_library_records(data_dir)?;
                    if let Some(existing) = records.iter_mut().find(|item| item.id == record.id) {
                        existing.title = record.title.clone();
                        existing.display_title = record.display_title.clone();
                    }
                    save_library_records(data_dir, &records)?;
                }
                if seen_ids.insert(record.id.clone()) {
                    imported.push(record);
                }
            }
            Err(error) if continue_after_failure => {
                failed_count = failed_count.saturating_add(1);
                eprintln!("跳过导入失败文件 {}: {error}", path.display());
            }
            Err(error) => {
                save_library_records(data_dir, &records_before_import)?;
                save_task_records(data_dir, &tasks_before_import)?;
                return Err(error);
            }
        }
    }
    if imported.is_empty() && failed_count > 0 {
        return Err(format!("书籍导入失败：{failed_count} 个书籍文件导入失败"));
    }
    Ok(DirectoryImportOutcome {
        records: imported,
        failed_count,
    })
}

fn attach_directory_import_parent_task(
    data_dir: &Path,
    directory: &Path,
    imported: &[BookRecord],
) -> Result<(), String> {
    if imported.is_empty() {
        return Ok(());
    }
    let timestamp = now_epoch_millis();
    let dag_id = format!("dag-import-directory-{timestamp}");
    let parent_id = format!("task-import-directory-{timestamp}");
    let mut tasks = load_task_records(data_dir)?;
    let mut parent_task = TaskRecord::new_dag_task(
        parent_id.clone(),
        String::new(),
        TaskKind::IMPORT_DIRECTORY,
        dag_id.clone(),
        Vec::new(),
        format!(
            "目录导入完成：{} 本书 · {}",
            imported.len(),
            directory.display()
        ),
    );
    parent_task.status = TaskRunStatus::SUCCEEDED.to_string();
    parent_task.stage = TaskStage::DONE.to_string();
    parent_task.progress = 100.0;
    parent_task.finished_at = timestamp.to_string();
    parent_task.updated_at = timestamp.to_string();
    tasks.push(parent_task);

    for book in imported {
        let Some(import_index) =
            newest_task_index_for_book_kind(&tasks, &book.id, TaskKind::IMPORT_BOOK)
        else {
            continue;
        };
        let original_dag_id = tasks[import_index].dag_id.clone();
        let import_task_id = tasks[import_index].id.clone();
        for task in tasks.iter_mut().filter(|task| {
            task.book_id == book.id && (task.dag_id == original_dag_id || task.id == import_task_id)
        }) {
            task.dag_id = dag_id.clone();
            task.updated_at = timestamp.to_string();
            if task.id == import_task_id {
                task.depends_on = vec![parent_id.clone()];
            }
        }
    }
    save_task_records(data_dir, &tasks)
}

fn newest_task_index_for_book_kind(
    tasks: &[TaskRecord],
    book_id: &str,
    kind: &str,
) -> Option<usize> {
    tasks
        .iter()
        .enumerate()
        .rev()
        .find(|(_, task)| task.book_id == book_id && task.kind == kind)
        .map(|(index, _)| index)
}

fn scan_supported_import_files(
    directory: &Path,
    files: &mut Vec<PathBuf>,
    depth: usize,
    total_bytes: &mut u64,
    recursive: bool,
) -> Result<(), String> {
    if depth > MAX_DIRECTORY_IMPORT_DEPTH {
        return Err(format!(
            "导入目录层级过深：最多支持 {MAX_DIRECTORY_IMPORT_DEPTH} 层，当前到达 {}",
            directory.display()
        ));
    }
    for entry in fs::read_dir(directory)
        .map_err(|error| format!("无法读取目录 {}: {error}", directory.display()))?
    {
        let entry =
            entry.map_err(|error| format!("无法读取目录项 {}: {error}", directory.display()))?;
        let path = entry.path();
        if path.is_dir() {
            if recursive {
                scan_supported_import_files(&path, files, depth + 1, total_bytes, recursive)?;
            }
        } else if is_supported_import_book_file(&path) {
            *total_bytes = total_bytes.saturating_add(
                fs::metadata(&path)
                    .map(|metadata| metadata.len())
                    .unwrap_or(0),
            );
            files.push(path);
        }
    }
    Ok(())
}

pub(crate) fn import_library_cover_image_into(
    data_dir: &Path,
    source_path: &Path,
) -> Result<String, String> {
    if !source_path.is_file() {
        return Err(format!(
            "封面图片不存在或不是文件：{}",
            source_path.display()
        ));
    }
    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "webp" | "gif") {
        return Err(format!(
            "不支持的封面图片格式：{}。请选择 PNG / JPG / JPEG / WEBP / GIF。",
            source_path.display()
        ));
    }
    let bytes = fs::read(source_path)
        .map_err(|error| format!("无法读取封面图片 {}: {error}", source_path.display()))?;
    if bytes.is_empty() {
        return Err(format!("封面图片为空：{}", source_path.display()));
    }
    let hash = content_hash(&bytes);
    let covers_dir = library_covers_dir(data_dir);
    fs::create_dir_all(&covers_dir)
        .map_err(|error| format!("无法创建封面目录 {}: {error}", covers_dir.display()))?;
    let target_path = covers_dir.join(format!("{hash}.{extension}"));
    if !target_path.exists() {
        fs::write(&target_path, bytes)
            .map_err(|error| format!("无法写入封面图片副本 {}: {error}", target_path.display()))?;
    }
    Ok(target_path.display().to_string())
}

fn content_hash(bytes: &[u8]) -> String {
    let mut hasher = DefaultHasher::new();
    bytes.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

pub(crate) fn now_epoch_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn sanitize_file_stem(path: &Path) -> String {
    path.file_stem()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("未命名书籍")
        .to_string()
}

fn title_from_file_stem(path: &Path, clean_title_from_filename: bool) -> String {
    let title = sanitize_file_stem(path);
    if clean_title_from_filename {
        clean_title_from_filename_stem(&title)
    } else {
        title
    }
}

fn clean_title_from_filename_stem(stem: &str) -> String {
    let normalized = normalize_filename_title_spaces(stem);
    if let Some(quoted_title) = extract_book_title_quotes(&normalized) {
        return quoted_title;
    }

    let mut title = normalized;
    title = trim_leading_filename_noise(&title);
    title = remove_author_suffix(&title);
    title = remove_common_filename_suffix_noise(&title);
    title = trim_filename_title_separators(&title);
    if title.is_empty() {
        stem.trim().to_string()
    } else {
        title
    }
}

fn normalize_filename_title_spaces(value: &str) -> String {
    value
        .replace(['_', '\u{3000}'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn extract_book_title_quotes(value: &str) -> Option<String> {
    let start = value.find('《')?;
    let end = value[start + '《'.len_utf8()..].find('》')? + start + '《'.len_utf8();
    let title = value[start + '《'.len_utf8()..end].trim();
    if title.is_empty() {
        None
    } else {
        Some(title.to_string())
    }
}

fn trim_leading_filename_noise(value: &str) -> String {
    let mut title = value.trim().to_string();
    loop {
        let trimmed = title.trim_start();
        if let Some(without_prefix_digits) = trim_leading_number_token(trimmed) {
            title = without_prefix_digits;
            continue;
        }

        let Some((close_index, close_char)) = leading_bracket_close(trimmed) else {
            break;
        };
        let inner = &trimmed[1..close_index];
        if !is_filename_noise_tag(inner) {
            break;
        }
        title = trimmed[close_index + close_char.len_utf8()..]
            .trim_start()
            .to_string();
    }
    title
}

fn trim_leading_number_token(value: &str) -> Option<String> {
    let digit_end = value
        .char_indices()
        .take_while(|(_, ch)| ch.is_ascii_digit())
        .map(|(index, ch)| index + ch.len_utf8())
        .last()?;
    let raw_rest = &value[digit_end..];
    let first_rest = raw_rest.chars().next()?;
    if !matches!(first_rest, '-' | '_' | '.' | '、' | '：' | ':' | ' ' | '\t') {
        return None;
    }
    let cleaned = raw_rest
        .trim_start()
        .trim_start_matches(['-', '_', '.', '、', '：', ':'])
        .trim_start()
        .to_string();
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

fn leading_bracket_close(value: &str) -> Option<(usize, char)> {
    let close = match value.chars().next()? {
        '[' => ']',
        '【' => '】',
        '(' => ')',
        '（' => '）',
        '{' => '}',
        '〔' => '〕',
        '〖' => '〗',
        _ => return None,
    };
    value.find(close).map(|index| (index, close))
}

fn is_filename_noise_tag(value: &str) -> bool {
    let tag = value.trim().to_ascii_lowercase();
    if tag.is_empty() {
        return false;
    }
    tag.chars().all(|ch| ch.is_ascii_digit())
        || [
            "完本",
            "全本",
            "全集",
            "精校",
            "精校版",
            "校对",
            "校对版",
            "txt",
            "md",
            "markdown",
            "epub",
            "mobi",
            "下载",
            "小说",
        ]
        .iter()
        .any(|keyword| tag.contains(keyword))
}

fn remove_author_suffix(value: &str) -> String {
    let mut title = value.to_string();
    for marker in ["作者：", "作者:", "作者 ", " by ", " By ", " BY "] {
        if let Some(index) = title.find(marker) {
            title.truncate(index);
        }
    }
    title.trim().to_string()
}

fn remove_common_filename_suffix_noise(value: &str) -> String {
    let mut title = value.trim().to_string();
    for suffix in [
        "精校版",
        "校对版",
        "完本",
        "全本",
        "全集",
        "TXT",
        "MD",
        "MARKDOWN",
        "txt",
        "EPUB",
        "epub",
        "MOBI",
        "mobi",
    ] {
        if let Some(stripped) = title.strip_suffix(suffix) {
            title = stripped
                .trim_end_matches(['-', '_', '.', '、', '：', ':', ' '])
                .to_string();
        }
    }
    title.trim().to_string()
}

fn trim_filename_title_separators(value: &str) -> String {
    value
        .trim()
        .trim_matches(['-', '_', '.', '、', '：', ':', ' ', '\t'])
        .trim_matches(['[', ']', '【', '】', '(', ')', '（', '）'])
        .trim()
        .to_string()
}

fn author_for_import(
    source_path: &Path,
    managed_bytes: &[u8],
    encoding_mode: &str,
    auto_detect_author: bool,
) -> String {
    if !auto_detect_author {
        return "本地导入".to_string();
    }
    let stem = sanitize_file_stem(source_path);
    extract_author_from_text(&stem)
        .or_else(|| {
            decode_imported_text(source_path, managed_bytes, encoding_mode)
                .ok()
                .and_then(|content| extract_author_from_content_head(&content))
        })
        .unwrap_or_else(|| "本地导入".to_string())
}

fn extract_author_from_content_head(content: &str) -> Option<String> {
    content.lines().take(8).find_map(extract_author_from_text)
}

fn extract_author_from_text(value: &str) -> Option<String> {
    for marker in [
        "作者：",
        "作者:",
        "作者=",
        "作者 = ",
        "作者\t",
        "作者 ",
        "Author:",
        "Author：",
        "Author=",
        "Author = ",
        "author:",
        "author：",
        "author=",
        "By:",
        "By：",
        "by:",
        "by：",
    ] {
        if let Some(author) = extract_author_after_marker(value, marker) {
            return Some(author);
        }
    }
    for marker in [" by ", " By ", " BY "] {
        if let Some(author) = extract_author_after_marker(value, marker) {
            return Some(author);
        }
    }
    None
}

fn extract_author_after_marker(value: &str, marker: &str) -> Option<String> {
    let start = value.find(marker)? + marker.len();
    let candidate = value[start..]
        .split(['[', '【', '(', '（', '《', '。', '，', ',', '\n', '\r'])
        .next()
        .unwrap_or_default();
    let author = remove_common_filename_suffix_noise(candidate);
    let author = trim_filename_title_separators(&author);
    if is_plausible_author_name(&author) {
        Some(author)
    } else {
        None
    }
}

fn is_plausible_author_name(value: &str) -> bool {
    let length = value.chars().count();
    length > 0
        && length <= 40
        && !value.contains("作者")
        && !value.contains("书名")
        && !value.contains("标题")
        && !value.contains("http")
        && !value.contains("www.")
}

pub(crate) fn import_book_from_path_into(
    data_dir: &Path,
    source_path: &Path,
) -> Result<BookRecord, String> {
    import_book_from_path_with_cleanup_into(data_dir, source_path, None)
}

pub(crate) fn import_book_from_path_with_cleanup_into(
    data_dir: &Path,
    source_path: &Path,
    cleanup_options: Option<&TxtImportCleanupOptions>,
) -> Result<BookRecord, String> {
    if !source_path.exists() {
        return Err(format!("导入文件不存在：{}", source_path.display()));
    }
    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !matches!(
        extension.as_str(),
        "txt" | "md" | "markdown" | "epub" | "mobi" | "pdf"
    ) {
        return Err(format!(
            "当前导入流水线暂只支持 TXT / Markdown / EPUB / MOBI / PDF：{}",
            source_path.display()
        ));
    }

    let bytes = fs::read(source_path)
        .map_err(|error| format!("无法读取导入文件 {}: {error}", source_path.display()))?;
    let cleanup_enabled = cleanup_options.filter(|options| options.enabled);
    let encoding_mode = cleanup_options
        .map(|options| options.encoding_mode.as_str())
        .unwrap_or("auto");
    let preserve_original_backup = cleanup_options
        .map(|options| {
            options.backup_original_on_import
                || (options.enabled && options.preserve_original_backup)
        })
        .unwrap_or(false);
    let original_backup_bytes = if preserve_original_backup {
        Some(bytes.clone())
    } else {
        None
    };
    let mut cover_image_path = String::new();
    let content = if extension == "epub" || extension == "mobi" {
        let preliminary_text = decode_imported_text(source_path, &bytes, encoding_mode)?;
        let _preliminary_managed = if let Some(options) = cleanup_enabled {
            let cleaned = clean_import_txt_content(&preliminary_text, options);
            if cleaned.trim().is_empty() {
                return Err(format!("导入清理后内容为空：{}", source_path.display()));
            }
            cleaned
        } else {
            preliminary_text
        };
        let source_hash = content_hash(&bytes);
        let asset_key = format!("source-{source_hash}");
        let asset_dir = epub_assets_dir(data_dir, &asset_key);
        let (text, first_image_path) = if extension == "epub" {
            decode_epub_bytes_with_assets_and_cover(&bytes, &asset_dir)?
        } else {
            decode_mobi_bytes_with_assets_and_cover(&bytes, &asset_dir)?
        };
        cover_image_path = first_image_path;
        text
    } else {
        decode_imported_text(source_path, &bytes, encoding_mode)?
    };
    let managed_text = if let Some(options) = cleanup_enabled {
        let cleaned = clean_import_txt_content(&content, options);
        if cleaned.trim().is_empty() {
            return Err(format!("导入清理后内容为空：{}", source_path.display()));
        }
        cleaned
    } else {
        content
    };
    let managed_bytes = managed_text.as_bytes();
    let hash = content_hash(managed_bytes);
    let mut records = load_library_records(data_dir)?;
    if let Some(existing) = records.iter().find(|record| record.content_hash == hash) {
        upsert_parse_task_for_import(data_dir, existing)?;
        return Ok(existing.clone());
    }

    let original_dir = originals_dir(data_dir);
    fs::create_dir_all(&original_dir)
        .map_err(|error| format!("无法创建原始书籍目录 {}: {error}", original_dir.display()))?;
    let file_name = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("imported.book");
    let stored_path = managed_import_text_file_path(data_dir, source_path, &hash)?;
    fs::write(&stored_path, &managed_bytes)
        .map_err(|error| format!("无法写入导入文件副本 {}: {error}", stored_path.display()))?;
    let source_copy_path = managed_import_source_file_path(data_dir, source_path, &hash)?;
    fs::write(&source_copy_path, &bytes).map_err(|error| {
        format!(
            "无法写入原始书籍副本 {}: {error}",
            source_copy_path.display()
        )
    })?;
    if preserve_original_backup {
        let backup_dir = original_backups_dir(data_dir);
        fs::create_dir_all(&backup_dir)
            .map_err(|error| format!("无法创建原文备份目录 {}: {error}", backup_dir.display()))?;
        let backup_path = backup_dir.join(format!("{hash}-{file_name}"));
        fs::write(
            &backup_path,
            original_backup_bytes.as_deref().unwrap_or_default(),
        )
        .map_err(|error| format!("无法写入原文备份 {}: {error}", backup_path.display()))?;
    }

    let title = title_from_file_stem(
        source_path,
        cleanup_options
            .map(|options| options.clean_title_from_filename)
            .unwrap_or(false),
    );
    let cover_tone_strategy = cleanup_options
        .map(|options| options.cover_tone_strategy.as_str())
        .unwrap_or("format");
    let cover_label_strategy = cleanup_options
        .map(|options| options.cover_label_strategy.as_str())
        .unwrap_or("format");
    let author = author_for_import(
        source_path,
        &managed_bytes,
        encoding_mode,
        cleanup_options
            .map(|options| options.auto_detect_author)
            .unwrap_or(false),
    );
    let record = BookRecord {
        id: format!("book-{hash}"),
        title: title.clone(),
        display_title: title.clone(),
        author,
        format: extension.to_ascii_uppercase(),
        status: "已导入 · 等待解析索引".to_string(),
        progress: 0,
        file_name: file_name.to_string(),
        file_path: stored_path.display().to_string(),
        source_file_path: source_copy_path.display().to_string(),
        cover_label: cover_label_for_import(
            &extension.to_ascii_uppercase(),
            &title,
            cover_label_strategy,
        ),
        cover_tone: cover_tone_for_import(
            &extension.to_ascii_uppercase(),
            &hash,
            cover_tone_strategy,
        ),
        cover_image_path,
        deleted: false,
        deleted_at: String::new(),
        content_hash: hash.clone(),
        imported_at: now_epoch_millis().to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    records.push(record.clone());
    save_library_records(data_dir, &records)?;

    upsert_parse_task_for_import(data_dir, &record)?;

    Ok(record)
}

pub(crate) fn managed_import_text_file_path(
    data_dir: &Path,
    source_path: &Path,
    hash: &str,
) -> Result<PathBuf, String> {
    let original_dir = originals_dir(data_dir);
    let file_name = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("imported.book");
    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(file_name);
    Ok(original_dir.join(format!("{hash}-{stem}.txt")))
}

pub(crate) fn managed_import_source_file_path(
    data_dir: &Path,
    source_path: &Path,
    hash: &str,
) -> Result<PathBuf, String> {
    let original_dir = originals_dir(data_dir);
    let file_name = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("imported.book");
    Ok(original_dir.join(format!("{hash}-{file_name}")))
}

fn decode_imported_text(
    source_path: &Path,
    bytes: &[u8],
    encoding_mode: &str,
) -> Result<String, String> {
    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    match extension.as_str() {
        "txt" | "md" | "markdown" => decode_txt_bytes_with_mode(bytes, encoding_mode),
        "epub" => decode_epub_bytes(bytes),
        "mobi" => decode_mobi_bytes(bytes),
        "pdf" => decode_pdf_bytes(bytes),
        _ => Err(format!("不支持的导入格式：{}", source_path.display())),
    }
}

fn decode_epub_bytes(bytes: &[u8]) -> Result<String, String> {
    let epub =
        Epub::parse_from_buffer(bytes).map_err(|error| format!("无法解析 EPUB 文件：{error}"))?;
    let mut text = decode_epub_pages(&epub);
    if text.trim().is_empty() {
        text = String::new();
    }
    if text.trim().is_empty() {
        return Err("EPUB 内容为空".to_string());
    }
    Ok(text)
}

fn decode_mobi_bytes(bytes: &[u8]) -> Result<String, String> {
    let mobi = Mobi::new(bytes.to_vec()).map_err(|error| format!("无法解析 MOBI 文件：{error}"))?;
    let html = decode_mobi_html(bytes, &mobi)?;
    let text = strip_epub_html_to_text_with_images(&html, &HashMap::new());
    if text.trim().is_empty() {
        return Err("MOBI 内容为空或受 DRM 保护".to_string());
    }
    Ok(text)
}

fn decode_mobi_bytes_with_assets_and_cover(
    bytes: &[u8],
    asset_dir: &Path,
) -> Result<(String, String), String> {
    let mobi = Mobi::new(bytes.to_vec()).map_err(|error| format!("无法解析 MOBI 文件：{error}"))?;
    let html = decode_mobi_html(bytes, &mobi)?;
    let (image_paths, cover_image_path) = write_mobi_images(&mobi, &html, asset_dir)?;
    let html_with_image_sources = rewrite_mobi_image_sources(&html, &image_paths);
    let text = strip_epub_html_to_text_with_images(&html_with_image_sources, &image_paths);
    if text.trim().is_empty() {
        return Err("MOBI 内容为空或受 DRM 保护".to_string());
    }
    Ok((text, cover_image_path))
}

fn decode_mobi_html(bytes: &[u8], mobi: &Mobi) -> Result<String, String> {
    if mobi.encryption() != Encryption::No {
        return Err("MOBI 受 DRM 保护，无法读取正文".to_string());
    }
    if mobi.compression() == Compression::Huff {
        return mobi
            .content_as_string()
            .or_else(|_| Ok(mobi.content_as_string_lossy()))
            .map_err(|error: mobi::MobiError| format!("无法解压 MOBI Huff/CDIC 正文：{error}"));
    }

    let trailing_flags = mobi_extra_record_data_flags(bytes).unwrap_or(0);
    let records = mobi.raw_records();
    let first = usize::from(mobi.metadata.mobi.first_content_record);
    let count = usize::from(mobi.metadata.palmdoc.record_count);
    let available = records.records().len().saturating_sub(first);
    if count == 0 || available < count {
        return Err(format!(
            "MOBI 正文记录不完整：需要 {count} 条，仅找到 {available} 条"
        ));
    }

    let expected_len = mobi.metadata.palmdoc.text_length as usize;
    let mut decoded = Vec::with_capacity(expected_len);
    for record in records.records().iter().skip(first).take(count) {
        let trailing_len = mobi_trailing_data_len(record.content, trailing_flags);
        let body_len = record.content.len().saturating_sub(trailing_len);
        let body = &record.content[..body_len];
        match mobi.compression() {
            Compression::No => decoded.extend_from_slice(body),
            Compression::PalmDoc => decoded.extend(decompress_palmdoc_record(body)?),
            Compression::Huff => unreachable!("Huff/CDIC handled above"),
        }
    }
    if expected_len > 0 {
        if decoded.len() < expected_len {
            return Err(format!(
                "MOBI 正文解压不完整：预期 {expected_len} 字节，实际 {} 字节",
                decoded.len()
            ));
        }
        decoded.truncate(expected_len);
    }
    decode_mobi_text_bytes(&decoded, mobi.text_encoding())
}

fn decompress_palmdoc_record(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut output = Vec::with_capacity(data.len().saturating_mul(2));
    let mut cursor = 0usize;
    while cursor < data.len() {
        let byte = data[cursor];
        cursor += 1;
        match byte {
            0 | 9..=0x7f => output.push(byte),
            1..=8 => {
                let count = usize::from(byte);
                if cursor + count > data.len() {
                    return Err("MOBI PalmDOC 字面量超出记录边界".to_string());
                }
                output.extend_from_slice(&data[cursor..cursor + count]);
                cursor += count;
            }
            0x80..=0xbf => {
                if cursor >= data.len() {
                    return Err("MOBI PalmDOC 回溯标记缺少第二字节".to_string());
                }
                let pair = u16::from_be_bytes([byte, data[cursor]]) & 0x3fff;
                cursor += 1;
                let distance = usize::from(pair >> 3);
                let count = usize::from((pair & 7) + 3);
                if distance == 0 || distance > output.len() {
                    return Err("MOBI PalmDOC 回溯距离无效".to_string());
                }
                for _ in 0..count {
                    output.push(output[output.len() - distance]);
                }
            }
            _ => {
                output.push(b' ');
                output.push(byte ^ 0x80);
            }
        }
    }
    Ok(output)
}

fn mobi_extra_record_data_flags(bytes: &[u8]) -> Option<u32> {
    let record_zero_offset = read_be_u32(bytes.get(78..82)?)? as usize;
    let mobi_header_offset = record_zero_offset.checked_add(16)?;
    if bytes.get(mobi_header_offset..mobi_header_offset + 4)? != b"MOBI" {
        return None;
    }
    let header_len =
        read_be_u32(bytes.get(mobi_header_offset + 4..mobi_header_offset + 8)?)? as usize;
    const EXTRA_FLAGS_OFFSET: usize = 0xe0;
    if header_len < EXTRA_FLAGS_OFFSET + 4 {
        return Some(0);
    }
    let offset = mobi_header_offset.checked_add(EXTRA_FLAGS_OFFSET)?;
    read_be_u32(bytes.get(offset..offset + 4)?)
}

fn read_be_u32(bytes: &[u8]) -> Option<u32> {
    let raw: [u8; 4] = bytes.try_into().ok()?;
    Some(u32::from_be_bytes(raw))
}

fn mobi_trailing_data_len(data: &[u8], flags: u32) -> usize {
    let mut end = data.len();
    for _ in 0..(flags >> 1).count_ones() {
        if end < 4 {
            break;
        }
        let mut value = 0usize;
        for byte in &data[end - 4..end] {
            if byte & 0x80 != 0 {
                value = 0;
            }
            value = (value << 7) | usize::from(byte & 0x7f);
        }
        if value == 0 || value > end {
            break;
        }
        end -= value;
    }
    if flags & 1 != 0 && end > 0 {
        end = end.saturating_sub(usize::from((data[end - 1] & 3) + 1));
    }
    data.len() - end
}

fn decode_mobi_text_bytes(bytes: &[u8], encoding: TextEncoding) -> Result<String, String> {
    match encoding {
        TextEncoding::UTF8 => String::from_utf8(bytes.to_vec())
            .map_err(|error| format!("MOBI UTF-8 正文包含无效字节：{error}")),
        TextEncoding::CP1252 => {
            let (text, _, _) = encoding_rs::WINDOWS_1252.decode(bytes);
            Ok(text.into_owned())
        }
        TextEncoding::Unknown(value) => Err(format!("不支持的 MOBI 正文编码：{value}")),
    }
}

fn write_mobi_images(
    mobi: &Mobi,
    html: &str,
    asset_dir: &Path,
) -> Result<(HashMap<String, String>, String), String> {
    let recindex_re = Regex::new(r#"(?is)<img\b[^>]*\brecindex\s*=\s*[\"']?(\d+)[\"']?[^>]*>"#)
        .expect("valid MOBI image regex");
    let mut recindexes = recindex_re
        .captures_iter(html)
        .filter_map(|captures| captures.get(1)?.as_str().parse::<usize>().ok())
        .collect::<Vec<_>>();
    recindexes.sort_unstable();
    recindexes.dedup();

    let cover_offset = mobi
        .metadata
        .exth_record(ExthRecord::CoverOffset)
        .and_then(|records| records.first())
        .and_then(|bytes| read_be_u32(bytes));
    if let Some(offset) = cover_offset {
        recindexes.push(offset as usize);
    }
    if recindexes.is_empty() {
        return Ok((HashMap::new(), String::new()));
    }

    fs::create_dir_all(asset_dir)
        .map_err(|error| format!("无法创建 MOBI 图片目录 {}: {error}", asset_dir.display()))?;
    let raw_records = mobi.raw_records();
    let first_image_index = mobi.metadata.mobi.first_image_index as usize;
    let mut image_paths = HashMap::new();
    let mut cover_path = String::new();
    for recindex in recindexes {
        let Some(record_index) = first_image_index.checked_add(recindex) else {
            continue;
        };
        let Some(record) = raw_records.records().get(record_index) else {
            continue;
        };
        let Some(extension) = mobi_image_extension(record.content) else {
            continue;
        };
        let path = asset_dir.join(format!("mobi-image-{record_index}.{extension}"));
        fs::write(&path, record.content)
            .map_err(|error| format!("无法写入 MOBI 图片 {}: {error}", path.display()))?;
        let display_path = path.display().to_string();
        image_paths.insert(format!("mobi-recindex-{recindex}"), display_path.clone());
        if cover_offset == Some(recindex as u32) {
            cover_path = display_path;
        }
    }
    Ok((image_paths, cover_path))
}

fn rewrite_mobi_image_sources(html: &str, image_paths: &HashMap<String, String>) -> String {
    let recindex_re = Regex::new(r#"(?is)<img\b[^>]*\brecindex\s*=\s*[\"']?(\d+)[\"']?[^>]*>"#)
        .expect("valid MOBI image regex");
    recindex_re
        .replace_all(html, |captures: &regex::Captures| {
            let recindex = captures
                .get(1)
                .and_then(|value| value.as_str().parse::<usize>().ok());
            let Some(recindex) = recindex else {
                return String::new();
            };
            let key = format!("mobi-recindex-{recindex}");
            if image_paths.contains_key(&key) {
                format!(r#"<img src="{key}">"#)
            } else {
                String::new()
            }
        })
        .into_owned()
}

fn mobi_image_extension(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        Some("jpg")
    } else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("png")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("gif")
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        Some("webp")
    } else if bytes.starts_with(b"BM") {
        Some("bmp")
    } else {
        None
    }
}

pub(crate) fn decode_mobi_file(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path)
        .map_err(|error| format!("无法读取 MOBI 文件 {}: {error}", path.display()))?;
    decode_mobi_bytes(&bytes)
}

fn decode_epub_bytes_with_assets_and_cover(
    bytes: &[u8],
    asset_dir: &Path,
) -> Result<(String, String), String> {
    let epub =
        Epub::parse_from_buffer(bytes).map_err(|error| format!("无法解析 EPUB 文件：{error}"))?;
    let image_paths = write_epub_images(&epub, asset_dir)?;
    let cover_image_path = first_epub_cover_image_path(&epub, &image_paths);
    let mut text =
        decode_epub_spine_html_with_image_markers(bytes, &image_paths).unwrap_or_default();
    if text.trim().is_empty() {
        text = decode_epub_pages_with_image_markers(&epub, &image_paths);
    }
    if text.trim().is_empty() {
        text = decode_epub_pages(&epub);
    }
    if text.trim().is_empty() {
        return Err("EPUB 内容为空".to_string());
    }
    Ok((text, cover_image_path))
}

fn decode_epub_spine_html_with_image_markers(
    bytes: &[u8],
    image_paths: &std::collections::HashMap<String, String>,
) -> Result<String, String> {
    let cursor = Cursor::new(bytes.to_vec());
    let mut archive =
        zip::ZipArchive::new(cursor).map_err(|error| format!("无法读取 EPUB 压缩包：{error}"))?;
    let container = read_zip_text_file(&mut archive, "META-INF/container.xml")?;
    let opf_path = parse_epub_container_opf_path(&container)
        .ok_or_else(|| "EPUB 缺少 OPF 路径".to_string())?;
    let opf = read_zip_text_file(&mut archive, &opf_path)?;
    let manifest = parse_epub_opf_manifest(&opf);
    let spine = parse_epub_opf_spine(&opf);
    let mut text = String::new();
    for idref in spine {
        let Some(href) = manifest.get(&idref) else {
            continue;
        };
        let content_path = resolve_epub_archive_path(&opf_path, href);
        let content = match read_zip_text_file(&mut archive, &content_path) {
            Ok(value) => value,
            Err(_) => continue,
        };
        let cleaned = strip_epub_html_to_text_with_images(&content, image_paths);
        if cleaned.trim().is_empty() {
            continue;
        }
        if !text.is_empty() {
            text.push_str("\n\n");
        }
        text.push_str(&cleaned);
    }
    Ok(text)
}

pub(crate) fn decode_epub_file(path: &Path) -> Result<String, String> {
    let epub = Epub::parse(path)
        .map_err(|error| format!("无法解析 EPUB 文件 {}: {error}", path.display()))?;
    let text = decode_epub_pages(&epub);
    if text.trim().is_empty() {
        return Err(format!("EPUB 内容为空：{}", path.display()));
    }
    Ok(text)
}

fn decode_epub_pages(epub: &Epub) -> String {
    let mut text = String::new();
    for page in &epub.pages {
        let cleaned = strip_html_like_text(&page.content);
        if !cleaned.trim().is_empty() {
            if !text.is_empty() {
                text.push_str("\n\n");
            }
            text.push_str(&cleaned);
        }
    }
    text
}

fn decode_epub_pages_with_image_markers(
    epub: &Epub,
    image_paths: &std::collections::HashMap<String, String>,
) -> String {
    let mut text = String::new();
    for page in &epub.pages {
        let cleaned = strip_epub_html_to_text_with_images(&page.content, image_paths);
        if !cleaned.trim().is_empty() {
            if !text.is_empty() {
                text.push_str("\n\n");
            }
            text.push_str(&cleaned);
        }
    }
    text
}

fn write_epub_images(
    epub: &Epub,
    asset_dir: &Path,
) -> Result<std::collections::HashMap<String, String>, String> {
    let mut image_paths = std::collections::HashMap::new();
    if epub.images.is_empty() {
        return Ok(image_paths);
    }
    fs::create_dir_all(asset_dir)
        .map_err(|error| format!("无法创建 EPUB 图片目录 {}: {error}", asset_dir.display()))?;
    for image in &epub.images {
        if image.content.is_empty() {
            continue;
        }
        let file_name = safe_epub_asset_file_name(&image.href, &image.id, &image.media_type);
        let path = asset_dir.join(file_name);
        fs::write(&path, &image.content)
            .map_err(|error| format!("无法写入 EPUB 图片 {}: {error}", path.display()))?;
        let display_path = path.display().to_string();
        for key in epub_image_lookup_keys(&image.href) {
            image_paths.insert(key, display_path.clone());
        }
        if !image.id.trim().is_empty() {
            image_paths.insert(image.id.trim().to_string(), display_path);
        }
    }
    Ok(image_paths)
}

fn first_epub_cover_image_path(
    epub: &Epub,
    image_paths: &std::collections::HashMap<String, String>,
) -> String {
    for image in &epub.images {
        let id = image.id.trim().to_ascii_lowercase();
        let href = image.href.trim().to_ascii_lowercase();
        if id.contains("cover") || href.contains("cover") {
            if let Some(path) = image_paths
                .get(image.id.trim())
                .or_else(|| image_paths.get(&normalize_epub_resource_href(&image.href)))
                .or_else(|| {
                    image_paths.get(
                        image
                            .href
                            .split(['/', '\\'])
                            .next_back()
                            .unwrap_or_default(),
                    )
                })
            {
                return path.clone();
            }
        }
    }
    epub.images
        .iter()
        .find_map(|image| {
            image_paths
                .get(image.id.trim())
                .or_else(|| image_paths.get(&normalize_epub_resource_href(&image.href)))
                .or_else(|| {
                    image_paths.get(
                        image
                            .href
                            .split(['/', '\\'])
                            .next_back()
                            .unwrap_or_default(),
                    )
                })
                .cloned()
        })
        .unwrap_or_default()
}

fn read_zip_text_file<R: Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    path: &str,
) -> Result<String, String> {
    let mut file = archive
        .by_name(path)
        .map_err(|error| format!("EPUB 内文件不存在 {path}: {error}"))?;
    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|error| format!("无法读取 EPUB 内文件 {path}: {error}"))?;
    Ok(content)
}

fn parse_epub_container_opf_path(container: &str) -> Option<String> {
    let re = Regex::new(r#"(?is)<rootfile\b[^>]*full-path\s*=\s*["']([^"']+)["'][^>]*/?>"#).ok()?;
    Some(re.captures(container)?.get(1)?.as_str().trim().to_string())
}

fn parse_epub_opf_manifest(opf: &str) -> std::collections::HashMap<String, String> {
    let mut manifest = std::collections::HashMap::new();
    let item_re = Regex::new(r#"(?is)<item\b[^>]*>"#).expect("valid OPF item regex");
    let id_re = Regex::new(r#"\bid\s*=\s*["']([^"']+)["']"#).expect("valid OPF id regex");
    let href_re = Regex::new(r#"\bhref\s*=\s*["']([^"']+)["']"#).expect("valid OPF href regex");
    for item in item_re.find_iter(opf) {
        let raw = item.as_str();
        let Some(id) = id_re
            .captures(raw)
            .and_then(|captures| captures.get(1))
            .map(|value| value.as_str().to_string())
        else {
            continue;
        };
        let Some(href) = href_re
            .captures(raw)
            .and_then(|captures| captures.get(1))
            .map(|value| value.as_str().to_string())
        else {
            continue;
        };
        manifest.insert(id, href);
    }
    manifest
}

fn parse_epub_opf_spine(opf: &str) -> Vec<String> {
    let item_ref_re = Regex::new(r#"(?is)<itemref\b[^>]*\bidref\s*=\s*["']([^"']+)["'][^>]*/?>"#)
        .expect("valid OPF itemref regex");
    item_ref_re
        .captures_iter(opf)
        .filter_map(|captures| captures.get(1).map(|value| value.as_str().to_string()))
        .collect()
}

fn resolve_epub_archive_path(base_path: &str, href: &str) -> String {
    let base_parts = base_path.replace('\\', "/");
    let parent = base_parts
        .rsplit_once('/')
        .map(|(left, _)| left)
        .unwrap_or_default();
    normalize_epub_resource_href(&format!("{parent}/{href}"))
}

fn decode_pdf_bytes(bytes: &[u8]) -> Result<String, String> {
    let text = pdf_extract::extract_text_from_mem(bytes)
        .map_err(|error| format!("无法解析 PDF 文件：{error}"))?;
    if text.trim().is_empty() {
        return Err("PDF 内容为空".to_string());
    }
    Ok(text)
}

pub(crate) fn decode_pdf_file(path: &Path) -> Result<String, String> {
    let text = pdf_extract::extract_text(path)
        .map_err(|error| format!("无法解析 PDF 文件 {}: {error}", path.display()))?;
    if text.trim().is_empty() {
        return Err(format!("PDF 内容为空：{}", path.display()));
    }
    Ok(text)
}

fn strip_html_like_text(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut in_tag = false;
    let mut in_entity = false;
    for ch in value.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            '&' if !in_tag => in_entity = true,
            ';' if in_entity => in_entity = false,
            _ if !in_tag && !in_entity => output.push(ch),
            _ => {}
        }
    }
    output
        .replace('\u{a0}', " ")
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

pub(crate) fn strip_epub_html_to_text_with_images(
    value: &str,
    image_paths: &std::collections::HashMap<String, String>,
) -> String {
    let note_target_re = Regex::new(
        r#"(?is)<(aside|section|div|p|li|ol)\b([^>]*)\bid\s*=\s*["']([^"']+)["']([^>]*)>"#,
    )
    .expect("valid EPUB note target regex");
    let note_link_re =
        Regex::new(r#"(?is)<a\b([^>]*)\bhref\s*=\s*["'][^"']*#([^"']+)["']([^>]*)>(.*?)</a>"#)
            .expect("valid EPUB note link regex");
    let image_re = Regex::new(
        r#"(?is)<(?:img|image)\b[^>]*(?:src|href|xlink:href)\s*=\s*["']([^"']+)["'][^>]*/?>"#,
    )
    .expect("valid EPUB image regex");
    let block_re = Regex::new(
        r#"(?i)</?(?:p|div|section|article|li|h[1-6]|br|tr|table|figure|figcaption)\b[^>]*>"#,
    )
    .expect("valid EPUB block regex");
    let tag_re = Regex::new(r#"(?is)<[^>]+>"#).expect("valid HTML tag regex");
    let entity_re =
        Regex::new(r#"&(?:nbsp|amp|lt|gt|quot|apos|#39|#x27);"#).expect("valid entity regex");
    let linked_note_ids = collect_epub_linked_note_ids(value, &note_link_re);
    let with_note_targets = note_target_re.replace_all(value, |captures: &regex::Captures| {
        let tag = captures
            .get(1)
            .map(|item| item.as_str())
            .unwrap_or_default();
        let before_id = captures
            .get(2)
            .map(|item| item.as_str())
            .unwrap_or_default();
        let id = captures
            .get(3)
            .map(|item| item.as_str())
            .unwrap_or_default();
        let after_id = captures
            .get(4)
            .map(|item| item.as_str())
            .unwrap_or_default();
        let safe_id = sanitize_epub_note_id(id);
        if linked_note_ids.contains(&safe_id)
            || is_epub_note_anchor_id(id)
            || has_epub_note_hint(before_id)
            || has_epub_note_hint(after_id)
        {
            format!(
                "<{tag}{before_id} id=\"{id}\"{after_id}>\n[[BOOKMIND_EPUB_NOTE_TARGET:{}]]\n",
                sanitize_epub_note_id(id)
            )
        } else {
            captures
                .get(0)
                .map(|item| item.as_str())
                .unwrap_or_default()
                .to_string()
        }
    });
    let with_note_refs =
        note_link_re.replace_all(&with_note_targets, |captures: &regex::Captures| {
            let attrs_before = captures
                .get(1)
                .map(|item| item.as_str())
                .unwrap_or_default();
            let id = captures
                .get(2)
                .map(|item| item.as_str())
                .unwrap_or_default();
            let attrs_after = captures
                .get(3)
                .map(|item| item.as_str())
                .unwrap_or_default();
            let label_html = captures
                .get(4)
                .map(|item| item.as_str())
                .unwrap_or_default();
            let label = strip_html_like_text(label_html);
            if is_epub_note_anchor_id(id)
                || has_epub_note_hint(attrs_before)
                || has_epub_note_hint(attrs_after)
                || is_epub_note_label(&label)
            {
                format!(
                    "[[BOOKMIND_EPUB_NOTE_REF:{}|{}]]",
                    sanitize_epub_note_id(id),
                    sanitize_epub_note_label(&label)
                )
            } else {
                label
            }
        });
    let with_images = image_re.replace_all(&with_note_refs, |captures: &regex::Captures| {
        let raw = captures
            .get(1)
            .map(|item| item.as_str())
            .unwrap_or_default();
        let normalized = normalize_epub_resource_href(raw);
        let file_name = normalized.split('/').next_back().unwrap_or(&normalized);
        if let Some(path) = image_paths
            .get(&normalized)
            .or_else(|| image_paths.get(raw.trim()))
            .or_else(|| image_paths.get(file_name))
        {
            format!("\n[[BOOKMIND_EPUB_IMAGE:{path}]]\n")
        } else {
            String::new()
        }
    });
    let with_breaks = block_re.replace_all(&with_images, "\n");
    let without_tags = tag_re.replace_all(&with_breaks, "");
    let decoded = entity_re.replace_all(&without_tags, |captures: &regex::Captures| match captures
        .get(0)
        .map(|item| item.as_str())
        .unwrap_or_default()
    {
        "&nbsp;" => " ".to_string(),
        "&amp;" => "&".to_string(),
        "&lt;" => "<".to_string(),
        "&gt;" => ">".to_string(),
        "&quot;" => "\"".to_string(),
        "&apos;" | "&#39;" | "&#x27;" => "'".to_string(),
        value => value.to_string(),
    });
    let lines = decoded
        .replace('\u{a0}', " ")
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    merge_epub_standalone_note_ref_lines(lines).join("\n")
}

fn merge_epub_standalone_note_ref_lines(lines: Vec<String>) -> Vec<String> {
    let Ok(note_ref_line_re) = Regex::new(r#"^\[\[BOOKMIND_EPUB_NOTE_REF:[^\]\n]+\]\]$"#) else {
        return lines;
    };
    let Ok(note_ref_end_re) = Regex::new(r#"\[\[BOOKMIND_EPUB_NOTE_REF:[^\]\n]+\]\]$"#) else {
        return lines;
    };
    let Ok(note_target_only_re) = Regex::new(r#"^\[\[BOOKMIND_EPUB_NOTE_TARGET:[^\]\n]+\]\]$"#)
    else {
        return lines;
    };
    let Ok(note_target_with_return_ref_re) = Regex::new(
        r#"^(\[\[BOOKMIND_EPUB_NOTE_TARGET:[^\]\n]+\]\])\[\[BOOKMIND_EPUB_NOTE_REF:[^\]\n]+\]\]$"#,
    ) else {
        return lines;
    };
    let Ok(punctuation_continuation_re) = Regex::new(r#"^[、，,。；;：:！？!?\)）】》」』…—-]"#)
    else {
        return lines;
    };
    let mut merged: Vec<String> = Vec::with_capacity(lines.len());
    for line in lines {
        if let Some(captures) = note_target_with_return_ref_re.captures(&line) {
            if let Some(target) = captures.get(1) {
                merged.push(target.as_str().to_string());
                continue;
            }
        }
        if note_ref_line_re.is_match(&line) {
            if let Some(previous) = merged.last() {
                if note_target_only_re.is_match(previous) {
                    continue;
                }
            }
        }
        if note_ref_line_re.is_match(&line) {
            if let Some(previous) = merged.last_mut() {
                previous.push_str(&line);
                continue;
            }
        }
        if punctuation_continuation_re.is_match(&line) {
            if let Some(previous) = merged.last_mut() {
                if note_ref_end_re.is_match(previous) {
                    previous.push_str(&line);
                    continue;
                }
            }
        }
        if let Some(previous) = merged.last_mut() {
            if note_target_only_re.is_match(previous) {
                previous.push_str(&line);
                continue;
            }
        }
        merged.push(line);
    }
    merged
}

fn collect_epub_linked_note_ids(
    value: &str,
    note_link_re: &Regex,
) -> std::collections::HashSet<String> {
    note_link_re
        .captures_iter(value)
        .filter_map(|captures| {
            let attrs_before = captures
                .get(1)
                .map(|item| item.as_str())
                .unwrap_or_default();
            let id = captures
                .get(2)
                .map(|item| item.as_str())
                .unwrap_or_default();
            let attrs_after = captures
                .get(3)
                .map(|item| item.as_str())
                .unwrap_or_default();
            let label_html = captures
                .get(4)
                .map(|item| item.as_str())
                .unwrap_or_default();
            let label = strip_html_like_text(label_html);
            if is_epub_note_anchor_id(id)
                || has_epub_note_hint(attrs_before)
                || has_epub_note_hint(attrs_after)
                || is_epub_note_label(&label)
            {
                Some(sanitize_epub_note_id(id))
            } else {
                None
            }
        })
        .filter(|id| !id.is_empty())
        .collect()
}

fn is_epub_note_anchor_id(id: &str) -> bool {
    let normalized = id.trim().to_ascii_lowercase();
    normalized.contains("note")
        || normalized.contains("foot")
        || normalized.contains("fn")
        || normalized.contains("endnote")
        || normalized.contains("annotation")
        || normalized.contains("注")
}

fn has_epub_note_hint(attrs: &str) -> bool {
    let normalized = attrs.trim().to_ascii_lowercase();
    normalized.contains("noteref")
        || normalized.contains("footnote")
        || normalized.contains("endnote")
        || normalized.contains("doc-noteref")
        || normalized.contains("doc-footnote")
        || normalized.contains("注")
}

fn is_epub_note_label(label: &str) -> bool {
    let trimmed = label.trim();
    trimmed == "注"
        || trimmed.eq_ignore_ascii_case("note")
        || trimmed.len() <= 4 && trimmed.chars().any(|ch| ch.is_ascii_digit())
}

fn sanitize_epub_note_id(id: &str) -> String {
    id.trim()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | ':' | '.'))
        .collect::<String>()
}

fn sanitize_epub_note_label(label: &str) -> String {
    let trimmed = label.trim();
    if trimmed.is_empty() {
        return "注".to_string();
    }
    trimmed
        .replace('|', "/")
        .replace("[[", "[")
        .replace("]]", "]")
}

pub(crate) fn safe_epub_asset_file_name(href: &str, id: &str, media_type: &str) -> String {
    let raw_name = href
        .split(['/', '\\'])
        .next_back()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(id)
        .trim();
    let mut safe = raw_name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_') {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>();
    if safe.trim_matches(['.', '_']).is_empty() {
        safe = "image".to_string();
    }
    if Path::new(&safe).extension().is_none() {
        safe.push_str(epub_image_extension(media_type));
    }
    safe
}

fn epub_image_extension(media_type: &str) -> &'static str {
    match media_type.to_ascii_lowercase().as_str() {
        "image/png" => ".png",
        "image/gif" => ".gif",
        "image/webp" => ".webp",
        "image/svg+xml" => ".svg",
        _ => ".jpg",
    }
}

fn epub_image_lookup_keys(href: &str) -> Vec<String> {
    let normalized = normalize_epub_resource_href(href);
    let file_name = normalized
        .split('/')
        .next_back()
        .unwrap_or(&normalized)
        .to_string();
    let mut keys = vec![normalized, file_name];
    keys.sort();
    keys.dedup();
    keys
}

pub(crate) fn normalize_epub_resource_href(href: &str) -> String {
    let without_fragment = href.trim().split('#').next().unwrap_or_default();
    let without_query = without_fragment.split('?').next().unwrap_or_default();
    let mut parts = Vec::new();
    let normalized_path = without_query.replace('\\', "/");
    for part in normalized_path.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            parts.pop();
            continue;
        }
        parts.push(part);
    }
    parts.join("/")
}

fn clean_import_txt_content(content: &str, options: &TxtImportCleanupOptions) -> String {
    let custom_ad_keywords = options
        .ad_keywords
        .iter()
        .map(|keyword| keyword.trim())
        .filter(|keyword| !keyword.is_empty())
        .collect::<Vec<_>>();
    let custom_cleanup_rules = compile_import_custom_cleanup_rules(&options.custom_cleanup_rules);
    let lines = content
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .split('\n')
        .map(|line| {
            if options.normalize_full_width_spaces {
                line.replace('\u{3000}', " ")
            } else {
                line.to_string()
            }
        })
        .map(|line| {
            if options.trim_trailing_whitespace {
                line.trim_end().to_string()
            } else {
                line
            }
        })
        .filter(|line| !should_remove_import_ad_line(line, options, &custom_ad_keywords))
        .filter_map(|line| apply_import_custom_cleanup_rules(line, &custom_cleanup_rules))
        .collect::<Vec<_>>();
    let cleaned = if options.normalize_blank_lines {
        collapse_import_blank_lines(lines)
    } else {
        lines
    };
    cleaned.join("\n").trim().to_string()
}

struct CompiledImportCleanupRule {
    regex: Regex,
    replacement: String,
    mode: String,
    priority: i32,
}

fn compile_import_custom_cleanup_rules(
    rules: &[CustomCleanupRule],
) -> Vec<CompiledImportCleanupRule> {
    let mut compiled = rules
        .iter()
        .filter(|rule| rule.enabled && !rule.pattern.trim().is_empty())
        .filter_map(|rule| {
            let mode = rule.mode.as_str();
            if mode != "remove-line" && mode != "replace" {
                return None;
            }
            Regex::new(&rule.pattern)
                .ok()
                .map(|regex| CompiledImportCleanupRule {
                    regex,
                    replacement: rule.replacement.clone(),
                    mode: rule.mode.clone(),
                    priority: rule.priority,
                })
        })
        .collect::<Vec<_>>();
    compiled.sort_by_key(|rule| rule.priority);
    compiled
}

fn apply_import_custom_cleanup_rules(
    line: String,
    rules: &[CompiledImportCleanupRule],
) -> Option<String> {
    let original_was_nonblank = !line.trim().is_empty();
    let mut next = line;
    for rule in rules {
        if rule.mode == "remove-line" && rule.regex.is_match(&next) {
            return None;
        }
        if rule.mode == "replace" {
            next = rule
                .regex
                .replace_all(&next, rule.replacement.as_str())
                .into_owned();
        }
    }
    if original_was_nonblank && next.trim().is_empty() {
        None
    } else {
        Some(next)
    }
}

fn should_remove_import_ad_line(
    line: &str,
    options: &TxtImportCleanupOptions,
    custom_ad_keywords: &[&str],
) -> bool {
    if !options.remove_ads {
        return false;
    }
    let lower = line.to_ascii_lowercase();
    if line.contains("请收藏") || line.contains("最新网址") || line.contains("手机用户请浏览")
    {
        return true;
    }
    if options.remove_ad_urls
        && (lower.contains("www.")
            || lower.contains("http://")
            || lower.contains("https://")
            || lower.contains(".com")
            || lower.contains(".net")
            || lower.contains(".org")
            || lower.contains(".cn"))
    {
        return true;
    }
    if options.remove_pagination_noise && (line.contains("点击下一页") || line.contains("本章未完"))
    {
        return true;
    }
    custom_ad_keywords
        .iter()
        .any(|keyword| line.contains(keyword))
}

fn collapse_import_blank_lines(lines: Vec<String>) -> Vec<String> {
    let mut collapsed = Vec::new();
    let mut previous_blank = false;
    for line in lines {
        let blank = line.trim().is_empty();
        if blank {
            if !previous_blank {
                collapsed.push(String::new());
            }
        } else {
            collapsed.push(line);
        }
        previous_blank = blank;
    }
    collapsed
}

fn cover_tone_for_import(format: &str, content_hash: &str, strategy: &str) -> String {
    const TONES: [&str; 5] = ["amber", "indigo", "sage", "violet", "cinnabar"];
    match strategy {
        "hash" => {
            let index = content_hash
                .chars()
                .next()
                .and_then(|value| value.to_digit(16))
                .map(|value| value as usize % TONES.len())
                .unwrap_or(2);
            let tone = TONES[index];
            if format.eq_ignore_ascii_case("txt") && tone == "sage" {
                "indigo".to_string()
            } else {
                tone.to_string()
            }
        }
        "progress" => "amber".to_string(),
        _ if format.eq_ignore_ascii_case("txt") => "sage".to_string(),
        _ => "indigo".to_string(),
    }
}

fn cover_label_for_import(format: &str, title: &str, strategy: &str) -> String {
    match strategy {
        "ai" => "AI".to_string(),
        "read" => "阅".to_string(),
        "knowledge" => "知".to_string(),
        "first-char" => title
            .trim()
            .chars()
            .find(|ch| !ch.is_whitespace())
            .map(|ch| ch.to_string())
            .unwrap_or_else(|| format.to_string()),
        _ => format.to_ascii_uppercase(),
    }
}

fn upsert_parse_task_for_import(data_dir: &Path, record: &BookRecord) -> Result<(), String> {
    let mut tasks = load_task_records(data_dir)?;
    if tasks.iter().any(|task| {
        task.book_id == record.id
            && task.kind == TaskKind::PARSE_AND_INDEX
            && matches!(
                task.status.as_str(),
                TaskRunStatus::QUEUED | TaskRunStatus::RUNNING | TaskRunStatus::CANCELLING
            )
    }) {
        return Ok(());
    }
    if let Some(task) = tasks.iter_mut().find(|task| {
        task.book_id == record.id
            && task.kind == TaskKind::PARSE_AND_INDEX
            && task.status == TaskRunStatus::FAILED
    }) {
        task.status = TaskRunStatus::QUEUED.to_string();
        task.stage = TaskStage::QUEUED.to_string();
        task.progress = 0.0;
        task.attempt = task.attempt.saturating_add(1);
        task.error_code.clear();
        task.error_message.clear();
        task.updated_at = now_epoch_millis().to_string();
        task.message = "导入新版本后已重新排队解析索引".to_string();
        save_task_records(data_dir, &tasks)?;
        return Ok(());
    }
    let timestamp = now_epoch_millis();
    let dag_id = format!("dag-import-index-{}-{timestamp}", record.id);
    let import_id = format!("task-import-book-{}-{timestamp}", record.id);
    let parse_id = format!("task-parse-and-index-{}-{timestamp}", record.id);
    let full_text_id = format!("task-full-text-index-{}-{timestamp}", record.id);
    let embedding_id = format!("task-embedding-index-{}-{timestamp}", record.id);
    let summary_id = format!("task-ai-summary-{}-{timestamp}", record.id);
    let mut import_task = TaskRecord::new_dag_task(
        import_id.clone(),
        record.id.clone(),
        TaskKind::IMPORT_BOOK,
        dag_id.clone(),
        Vec::new(),
        "导入书籍已完成".to_string(),
    );
    import_task.status = TaskRunStatus::SUCCEEDED.to_string();
    import_task.stage = TaskStage::DONE.to_string();
    import_task.progress = 100.0;
    import_task.finished_at = timestamp.to_string();
    import_task.updated_at = timestamp.to_string();
    tasks.push(import_task);
    tasks.push(TaskRecord::new_dag_task(
        parse_id.clone(),
        record.id.clone(),
        TaskKind::PARSE_AND_INDEX,
        dag_id.clone(),
        vec![import_id],
        "已创建解析任务".to_string(),
    ));
    tasks.push(TaskRecord::new_dag_task(
        full_text_id.clone(),
        record.id.clone(),
        TaskKind::FULL_TEXT_INDEX,
        dag_id.clone(),
        vec![parse_id],
        "等待全文索引".to_string(),
    ));
    tasks.push(TaskRecord::new_dag_task(
        embedding_id.clone(),
        record.id.clone(),
        TaskKind::EMBEDDING_INDEX,
        dag_id.clone(),
        vec![full_text_id],
        "等待向量索引".to_string(),
    ));
    tasks.push(TaskRecord::new_dag_task(
        summary_id,
        record.id.clone(),
        TaskKind::AI_SUMMARY,
        dag_id,
        vec![embedding_id],
        "等待 AI 摘要".to_string(),
    ));
    save_task_records(data_dir, &tasks)
}
