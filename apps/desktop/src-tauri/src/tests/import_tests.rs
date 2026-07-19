use super::*;

#[test]
fn imports_txt_once_by_content_hash_and_copies_original() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("导入测试.txt");
    std::fs::write(&source, "第一章\n这是导入流水线测试。").expect("source txt should be written");

    let first = import_book_from_path_into(&dir, &source).expect("first import should work");
    let second = import_book_from_path_into(&dir, &source).expect("duplicate import should work");
    let records = load_library_records(&dir).expect("records should load");

    assert_eq!(first.id, second.id);
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].title, "导入测试");
    assert!(std::path::Path::new(&records[0].file_path).exists());
    assert!(records[0].file_path.contains("originals"));
}

#[test]
fn import_without_cleanup_preserves_original_txt_bytes() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("原文编码测试.txt");
    let (encoded, _, _) = GB18030.encode("第一章\r\n这是GB18030原文。");
    let source_bytes = encoded.into_owned();
    std::fs::write(&source, &source_bytes).expect("encoded source txt should be written");

    let record = import_book_from_path_into(&dir, &source).expect("default import should work");
    let stored_bytes = std::fs::read(&record.file_path).expect("managed copy should be readable");

    assert_eq!(stored_bytes, source_bytes);
}

#[test]
fn import_cleanup_options_can_be_explicitly_disabled() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("显式关闭清理.txt");
    let source_text = "第1章 正文   \n请收藏本站 www.example.com\n真正内容";
    std::fs::write(&source, source_text).expect("source txt should be written");

    let record = import_book_from_path_with_cleanup_into(
        &dir,
        &source,
        Some(&TxtImportCleanupOptions {
            enabled: false,
            encoding_mode: "auto".to_string(),
            backup_original_on_import: false,
            cover_tone_strategy: "format".to_string(),
            cover_label_strategy: "format".to_string(),
            clean_title_from_filename: false,
            auto_detect_author: false,
            preserve_original_backup: false,
            remove_ads: true,
            ad_keywords: vec!["真正内容".to_string()],
            remove_ad_urls: true,
            remove_pagination_noise: true,
            normalize_blank_lines: true,
            trim_trailing_whitespace: true,
            normalize_full_width_spaces: true,
            custom_cleanup_rules: vec![],
        }),
    )
    .expect("disabled cleanup import should work");
    let stored = std::fs::read_to_string(&record.file_path).expect("managed copy should read");

    assert_eq!(stored, source_text);
}

#[test]
fn import_encoding_mode_can_reject_non_utf8_when_forced() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("强制UTF8.txt");
    let (encoded, _, _) = GB18030.encode("第一章\r\n这是GB18030原文。");
    std::fs::write(&source, encoded.as_ref()).expect("encoded source txt should be written");

    let error = import_book_from_path_with_cleanup_into(
        &dir,
        &source,
        Some(&TxtImportCleanupOptions {
            enabled: false,
            encoding_mode: "utf-8".to_string(),
            backup_original_on_import: false,
            cover_tone_strategy: "format".to_string(),
            cover_label_strategy: "format".to_string(),
            clean_title_from_filename: false,
            auto_detect_author: false,
            preserve_original_backup: false,
            remove_ads: false,
            ad_keywords: vec![],
            remove_ad_urls: false,
            remove_pagination_noise: false,
            normalize_blank_lines: false,
            trim_trailing_whitespace: false,
            normalize_full_width_spaces: false,
            custom_cleanup_rules: vec![],
        }),
    )
    .expect_err("forced UTF-8 should reject GB18030 bytes");

    assert!(error.contains("UTF-8"));
}

#[test]
fn import_can_clean_txt_before_managed_copy_when_requested() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("清理测试.txt");
    std::fs::write(
        &source,
        "第1章 正文   \n请收藏本站 www.example.com\n\n\n\n真正内容   \n本章未完，点击下一页继续阅读",
    )
    .expect("dirty txt should be written");

    let record = import_book_from_path_with_cleanup_into(
        &dir,
        &source,
        Some(&TxtImportCleanupOptions {
            enabled: true,
            encoding_mode: "auto".to_string(),
            backup_original_on_import: false,
            cover_tone_strategy: "format".to_string(),
            cover_label_strategy: "format".to_string(),
            clean_title_from_filename: false,
            auto_detect_author: false,
            preserve_original_backup: false,
            remove_ads: true,
            ad_keywords: vec![],
            remove_ad_urls: true,
            remove_pagination_noise: true,
            normalize_blank_lines: true,
            trim_trailing_whitespace: true,
            normalize_full_width_spaces: false,
            custom_cleanup_rules: vec![],
        }),
    )
    .expect("cleaned import should work");
    let stored = read_book_content(std::path::Path::new(&record.file_path))
        .expect("managed copy should remain readable");

    assert_eq!(stored, "第1章 正文\n\n真正内容");
}

#[test]
fn import_can_apply_custom_cleanup_rules() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("自定义清洗测试.txt");
    std::fs::write(
        &source,
        "第1章 正文\n【广告】加入书友群 12345\nVIP章节由站点A整理\n真正内容",
    )
    .expect("dirty txt should be written");

    let record = import_book_from_path_with_cleanup_into(
        &dir,
        &source,
        Some(&TxtImportCleanupOptions {
            enabled: true,
            encoding_mode: "auto".to_string(),
            backup_original_on_import: false,
            cover_tone_strategy: "format".to_string(),
            cover_label_strategy: "format".to_string(),
            clean_title_from_filename: false,
            auto_detect_author: false,
            preserve_original_backup: false,
            remove_ads: false,
            ad_keywords: vec![],
            remove_ad_urls: false,
            remove_pagination_noise: false,
            normalize_blank_lines: true,
            trim_trailing_whitespace: true,
            normalize_full_width_spaces: false,
            custom_cleanup_rules: vec![
                CustomCleanupRule {
                    id: "site-note".to_string(),
                    name: "站点声明".to_string(),
                    pattern: "^VIP章节由站点A整理$".to_string(),
                    replacement: String::new(),
                    enabled: true,
                    mode: "replace".to_string(),
                    priority: 20,
                },
                CustomCleanupRule {
                    id: "group-ad".to_string(),
                    name: "书友群广告".to_string(),
                    pattern: "书友群\\s*\\d+".to_string(),
                    replacement: String::new(),
                    enabled: true,
                    mode: "remove-line".to_string(),
                    priority: 10,
                },
                CustomCleanupRule {
                    id: "broken".to_string(),
                    name: "坏正则".to_string(),
                    pattern: "[".to_string(),
                    replacement: String::new(),
                    enabled: true,
                    mode: "remove-line".to_string(),
                    priority: 0,
                },
            ],
        }),
    )
    .expect("custom cleanup import should work");
    let stored = read_book_content(std::path::Path::new(&record.file_path))
        .expect("managed copy should remain readable");

    assert_eq!(stored, "第1章 正文\n真正内容");
}

#[test]
fn import_cleanup_rejects_empty_cleaned_txt() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("清空测试.txt");
    std::fs::write(&source, "请收藏本站 www.example.com").expect("source txt should be written");

    let error = import_book_from_path_with_cleanup_into(
        &dir,
        &source,
        Some(&TxtImportCleanupOptions {
            enabled: true,
            encoding_mode: "auto".to_string(),
            backup_original_on_import: false,
            cover_tone_strategy: "format".to_string(),
            cover_label_strategy: "format".to_string(),
            clean_title_from_filename: false,
            auto_detect_author: false,
            preserve_original_backup: false,
            remove_ads: true,
            ad_keywords: vec![],
            remove_ad_urls: true,
            remove_pagination_noise: true,
            normalize_blank_lines: true,
            trim_trailing_whitespace: true,
            normalize_full_width_spaces: false,
            custom_cleanup_rules: vec![],
        }),
    )
    .expect_err("empty cleaned TXT should be rejected");

    assert!(error.contains("清理后内容为空"));
}

#[test]
fn import_cleanup_can_preserve_original_txt_backup() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("备份测试.txt");
    let source_text = "第1章 正文   \n请收藏本站 www.example.com\n真正内容   ";
    std::fs::write(&source, source_text.as_bytes()).expect("source txt should be written");

    let record = import_book_from_path_with_cleanup_into(
        &dir,
        &source,
        Some(&TxtImportCleanupOptions {
            enabled: true,
            encoding_mode: "auto".to_string(),
            backup_original_on_import: false,
            cover_tone_strategy: "format".to_string(),
            cover_label_strategy: "format".to_string(),
            clean_title_from_filename: false,
            auto_detect_author: false,
            preserve_original_backup: true,
            remove_ads: true,
            ad_keywords: vec![],
            remove_ad_urls: true,
            remove_pagination_noise: true,
            normalize_blank_lines: true,
            trim_trailing_whitespace: true,
            normalize_full_width_spaces: false,
            custom_cleanup_rules: vec![],
        }),
    )
    .expect("cleaned import should work");

    let stored = read_book_content(std::path::Path::new(&record.file_path))
        .expect("managed copy should remain readable");
    let backup_path =
        original_backups_dir(&dir).join(format!("{}-备份测试.txt", record.content_hash));
    let backup_bytes = std::fs::read(&backup_path).expect("original backup should be written");

    assert_eq!(stored, "第1章 正文\n真正内容");
    assert_eq!(backup_bytes, source_text.as_bytes());
}

#[test]
fn import_can_backup_original_txt_without_cleanup() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("自动备份.txt");
    let source_text = "第一章\r\n原文不清理也应该可备份。";
    std::fs::write(&source, source_text.as_bytes()).expect("source txt should be written");

    let record = import_book_from_path_with_cleanup_into(
        &dir,
        &source,
        Some(&TxtImportCleanupOptions {
            enabled: false,
            encoding_mode: "auto".to_string(),
            backup_original_on_import: true,
            cover_tone_strategy: "format".to_string(),
            cover_label_strategy: "format".to_string(),
            clean_title_from_filename: false,
            auto_detect_author: false,
            preserve_original_backup: false,
            remove_ads: false,
            ad_keywords: vec![],
            remove_ad_urls: false,
            remove_pagination_noise: false,
            normalize_blank_lines: false,
            trim_trailing_whitespace: false,
            normalize_full_width_spaces: false,
            custom_cleanup_rules: vec![],
        }),
    )
    .expect("backup import should work");

    let managed_bytes = std::fs::read(&record.file_path).expect("managed copy should read");
    let backup_path =
        original_backups_dir(&dir).join(format!("{}-自动备份.txt", record.content_hash));
    let backup_bytes = std::fs::read(&backup_path).expect("original backup should be written");

    assert_eq!(managed_bytes, source_text.as_bytes());
    assert_eq!(backup_bytes, source_text.as_bytes());
}

#[test]
fn import_can_apply_default_cover_tone_strategy() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("封面色策略.txt");
    std::fs::write(&source, "封面色策略测试内容").expect("source txt should be written");

    let record = import_book_from_path_with_cleanup_into(
        &dir,
        &source,
        Some(&TxtImportCleanupOptions {
            enabled: false,
            encoding_mode: "auto".to_string(),
            backup_original_on_import: false,
            cover_tone_strategy: "hash".to_string(),
            cover_label_strategy: "format".to_string(),
            clean_title_from_filename: false,
            auto_detect_author: false,
            preserve_original_backup: false,
            remove_ads: false,
            ad_keywords: vec![],
            remove_ad_urls: false,
            remove_pagination_noise: false,
            normalize_blank_lines: false,
            trim_trailing_whitespace: false,
            normalize_full_width_spaces: false,
            custom_cleanup_rules: vec![],
        }),
    )
    .expect("cover tone strategy import should work");

    assert_ne!(record.cover_tone, "sage");
    assert!(matches!(
        record.cover_tone.as_str(),
        "amber" | "indigo" | "sage" | "violet" | "cinnabar"
    ));
}

#[test]
fn import_can_apply_default_cover_label_strategy() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("封面标签策略.txt");
    std::fs::write(&source, "封面标签策略测试内容").expect("source txt should be written");

    let record = import_book_from_path_with_cleanup_into(
        &dir,
        &source,
        Some(&TxtImportCleanupOptions {
            enabled: false,
            encoding_mode: "auto".to_string(),
            backup_original_on_import: false,
            cover_tone_strategy: "format".to_string(),
            cover_label_strategy: "first-char".to_string(),
            clean_title_from_filename: false,
            auto_detect_author: false,
            preserve_original_backup: false,
            remove_ads: false,
            ad_keywords: vec![],
            remove_ad_urls: false,
            remove_pagination_noise: false,
            normalize_blank_lines: false,
            trim_trailing_whitespace: false,
            normalize_full_width_spaces: false,
            custom_cleanup_rules: vec![],
        }),
    )
    .expect("cover label strategy import should work");

    assert_eq!(record.cover_label, "封");
}

#[test]
fn import_can_clean_title_from_filename_when_requested() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("【完本】001-《剑来》作者：烽火戏诸侯 精校版.txt");
    std::fs::write(&source, "文件名清洗标题测试内容").expect("source txt should be written");

    let record = import_book_from_path_with_cleanup_into(
        &dir,
        &source,
        Some(&TxtImportCleanupOptions {
            enabled: false,
            encoding_mode: "auto".to_string(),
            backup_original_on_import: false,
            cover_tone_strategy: "format".to_string(),
            cover_label_strategy: "format".to_string(),
            clean_title_from_filename: true,
            auto_detect_author: false,
            preserve_original_backup: false,
            remove_ads: false,
            ad_keywords: vec![],
            remove_ad_urls: false,
            remove_pagination_noise: false,
            normalize_blank_lines: false,
            trim_trailing_whitespace: false,
            normalize_full_width_spaces: false,
            custom_cleanup_rules: vec![],
        }),
    )
    .expect("title cleanup import should work");

    assert_eq!(record.title, "剑来");
    assert_eq!(record.display_title, "剑来");
}

#[test]
fn import_title_filename_cleanup_is_opt_in_and_conservative() {
    let cases = [
        ("001 - 三体 精校版.txt", true, "三体"),
        (
            "[全集] 003. 大奉打更人 by 卖报小郎君.txt",
            true,
            "大奉打更人",
        ),
        ("雪中悍刀行_校对版.txt", true, "雪中悍刀行"),
        (
            "【完本】001-《剑来》作者：烽火戏诸侯 精校版.txt",
            false,
            "【完本】001-《剑来》作者：烽火戏诸侯 精校版",
        ),
        ("1984.txt", true, "1984"),
        ("001号档案.txt", true, "001号档案"),
        ("小说作者之谜.txt", true, "小说作者之谜"),
        ("全本书店.txt", true, "全本书店"),
        ("C++ Primer.txt", true, "C++ Primer"),
    ];

    for (index, (file_name, clean_title_from_filename, expected_title)) in cases.iter().enumerate()
    {
        let dir = unique_temp_library_dir();
        let source_dir = unique_temp_library_dir();
        std::fs::create_dir_all(&source_dir).expect("source dir should be created");
        let source = source_dir.join(file_name);
        std::fs::write(&source, format!("文件名清洗标题测试内容 {index}"))
            .expect("source txt should be written");

        let record = import_book_from_path_with_cleanup_into(
            &dir,
            &source,
            Some(&TxtImportCleanupOptions {
                enabled: false,
                encoding_mode: "auto".to_string(),
                backup_original_on_import: false,
                cover_tone_strategy: "format".to_string(),
                cover_label_strategy: "format".to_string(),
                clean_title_from_filename: *clean_title_from_filename,
                auto_detect_author: false,
                preserve_original_backup: false,
                remove_ads: false,
                ad_keywords: vec![],
                remove_ad_urls: false,
                remove_pagination_noise: false,
                normalize_blank_lines: false,
                trim_trailing_whitespace: false,
                normalize_full_width_spaces: false,
                custom_cleanup_rules: vec![],
            }),
        )
        .expect("title cleanup import should work");

        assert_eq!(record.title, *expected_title, "case {file_name}");
    }
}

#[test]
fn import_can_auto_detect_author_when_requested() {
    let cases = [
        (
            "《剑来》作者：烽火戏诸侯.txt",
            "正文内容",
            true,
            "烽火戏诸侯",
        ),
        (
            "大奉打更人 by 卖报小郎君.txt",
            "正文内容",
            true,
            "卖报小郎君",
        ),
        (
            "正文作者测试.txt",
            "书名：样本\n作者：猫腻\n第一章",
            true,
            "猫腻",
        ),
        (
            "metadata-author.txt",
            "Title: Sample\nAuthor: Ursula K. Le Guin\nChapter 1",
            true,
            "Ursula K. Le Guin",
        ),
        (
            "等号作者.txt",
            "书名 = 样本\n作者 = 刘慈欣\n第一章",
            true,
            "刘慈欣",
        ),
        (
            "《剑来》作者：烽火戏诸侯.txt",
            "正文内容",
            false,
            "本地导入",
        ),
        ("小说作者之谜.txt", "正文内容", true, "本地导入"),
    ];

    for (index, (file_name, content, auto_detect_author, expected_author)) in
        cases.iter().enumerate()
    {
        let dir = unique_temp_library_dir();
        let source_dir = unique_temp_library_dir();
        std::fs::create_dir_all(&source_dir).expect("source dir should be created");
        let source = source_dir.join(file_name);
        std::fs::write(&source, format!("{content}\ncase {index}"))
            .expect("source txt should be written");

        let record = import_book_from_path_with_cleanup_into(
            &dir,
            &source,
            Some(&TxtImportCleanupOptions {
                enabled: false,
                encoding_mode: "auto".to_string(),
                backup_original_on_import: false,
                cover_tone_strategy: "format".to_string(),
                cover_label_strategy: "format".to_string(),
                clean_title_from_filename: false,
                auto_detect_author: *auto_detect_author,
                preserve_original_backup: false,
                remove_ads: false,
                ad_keywords: vec![],
                remove_ad_urls: false,
                remove_pagination_noise: false,
                normalize_blank_lines: false,
                trim_trailing_whitespace: false,
                normalize_full_width_spaces: false,
                custom_cleanup_rules: vec![],
            }),
        )
        .expect("author detection import should work");

        assert_eq!(record.author, *expected_author, "case {file_name}");
    }
}

#[test]
fn imports_txt_directory_recursively_with_deduplication() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    let nested = source_dir.join("nested");
    std::fs::create_dir_all(&nested).expect("nested source dir should be created");
    std::fs::write(source_dir.join("第一本.txt"), "第一本内容")
        .expect("first txt should be written");
    std::fs::write(nested.join("第二本.txt"), "第二本内容").expect("second txt should be written");
    std::fs::write(nested.join("重复.txt"), "第一本内容").expect("duplicate txt should be written");
    std::fs::write(nested.join("ignore.md"), "不是书").expect("ignored file should be written");

    let imported = import_book_directory_into(&dir, &source_dir, true, false, None)
        .expect("directory import should work")
        .records;
    let records = load_library_records(&dir).expect("records should load");

    assert_eq!(imported.len(), 2);
    assert_eq!(records.len(), 2);
    assert!(records.iter().any(|record| record.title == "第一本"));
    assert!(records.iter().any(|record| record.title == "第二本"));
}

#[test]
fn directory_import_creates_parent_and_per_book_child_tasks() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    let nested = source_dir.join("nested");
    std::fs::create_dir_all(&nested).expect("nested source dir should be created");
    std::fs::write(source_dir.join("第一本.txt"), "第一本内容")
        .expect("first txt should be written");
    std::fs::write(nested.join("第二本.txt"), "第二本内容").expect("second txt should be written");

    let imported = import_book_directory_into(&dir, &source_dir, true, false, None)
        .expect("directory import should work")
        .records;
    let tasks = load_task_records(&dir).expect("tasks should load");

    assert_eq!(imported.len(), 2);
    let parent_tasks = tasks
        .iter()
        .filter(|task| task.kind == TaskKind::IMPORT_DIRECTORY)
        .collect::<Vec<_>>();
    assert_eq!(parent_tasks.len(), 1);
    let parent = parent_tasks[0];
    assert_eq!(parent.status, TaskRunStatus::SUCCEEDED);
    assert_eq!(parent.progress, 100.0);
    assert_eq!(parent.depends_on.len(), 0);
    assert!(parent.book_id.is_empty());

    for book in &imported {
        let import_task = tasks
            .iter()
            .find(|task| task.book_id == book.id && task.kind == TaskKind::IMPORT_BOOK)
            .expect("per-book import task should exist");
        assert_eq!(import_task.dag_id, parent.dag_id);
        assert_eq!(import_task.depends_on, vec![parent.id.clone()]);
        assert_eq!(import_task.status, TaskRunStatus::SUCCEEDED);

        let parse_task = parse_task_for_book(&tasks, &book.id);
        assert_eq!(parse_task.dag_id, parent.dag_id);
        assert_eq!(parse_task.depends_on, vec![import_task.id.clone()]);
    }
}

#[test]
fn imports_txt_directory_non_recursively_when_requested() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    let nested = source_dir.join("nested");
    std::fs::create_dir_all(&nested).expect("nested source dir should be created");
    std::fs::write(source_dir.join("顶层书籍.txt"), "顶层内容")
        .expect("top-level txt should be written");
    std::fs::write(nested.join("深层书籍.txt"), "深层内容").expect("nested txt should be written");

    let imported = import_book_directory_into(&dir, &source_dir, false, false, None)
        .expect("non-recursive directory import should work")
        .records;
    let records = load_library_records(&dir).expect("records should load");

    assert_eq!(imported.len(), 1);
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].title, "顶层书籍");
}

#[test]
fn directory_import_command_returns_metadata_only_for_large_batches() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    for index in 0..12 {
        std::fs::write(
            source_dir.join(format!("批量导入-{index}.txt")),
            format!("批量导入内容 {index}"),
        )
        .expect("source txt should be written");
    }

    let payload = import_books_from_directory_in(&dir, &source_dir, true, false, None)
        .expect("directory command helper should import metadata payloads");

    assert_eq!(payload.books.len(), 12);
    assert_eq!(payload.failed_count, 0);
    assert!(payload.books.iter().all(|book| book.content.is_empty()));
    assert!(payload.books.iter().all(|book| book.chunks.is_empty()));
    assert_eq!(
        load_task_records(&dir)
            .expect("tasks should load")
            .iter()
            .filter(|task| task.kind == TaskKind::PARSE_AND_INDEX)
            .count(),
        12
    );
}

#[test]
fn directory_import_can_continue_after_failed_file_when_requested() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    std::fs::write(source_dir.join("正常书籍.txt"), "正常内容")
        .expect("valid txt should be written");
    std::fs::write(source_dir.join("坏文件.txt"), vec![0xff; 32])
        .expect("invalid txt should be written");

    let strict_error = import_book_directory_into(&dir, &source_dir, true, false, None)
        .expect_err("strict directory import should stop on failed files");
    assert!(strict_error.contains("无法可靠解码 TXT 文件"));
    assert!(load_library_records(&dir)
        .expect("records should remain readable")
        .is_empty());

    let payload = import_books_from_directory_in(&dir, &source_dir, true, true, None)
        .expect("directory import should continue after a failed file");
    let records = load_library_records(&dir).expect("records should load");

    assert_eq!(payload.books.len(), 1);
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].title, "正常书籍");
    assert_eq!(payload.failed_count, 1);
}

#[test]
fn directory_import_rejects_too_many_txt_files() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    for index in 0..=200 {
        std::fs::write(
            source_dir.join(format!("第{index:03}本.txt")),
            format!("第{index}本内容"),
        )
        .expect("txt fixture should be written");
    }

    let error = import_book_directory_into(&dir, &source_dir, true, false, None)
        .expect_err("directory import should reject excessive file counts");

    assert!(error.contains("导入目录 TXT 文件过多"));
    assert!(load_library_records(&dir)
        .expect("records should remain readable")
        .is_empty());
}

#[test]
fn directory_import_rejects_excessive_recursion_depth() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    let too_deep = (0..=9).fold(source_dir.clone(), |path, index| {
        path.join(format!("level-{index}"))
    });
    std::fs::create_dir_all(&too_deep).expect("deep source dir should be created");
    std::fs::write(too_deep.join("深层书籍.txt"), "深层内容")
        .expect("deep txt fixture should be written");

    let error = import_book_directory_into(&dir, &source_dir, true, false, None)
        .expect_err("directory import should reject excessive recursion depth");

    assert!(error.contains("导入目录层级过深"));
    assert!(load_library_records(&dir)
        .expect("records should remain readable")
        .is_empty());
}

#[test]
fn directory_import_rejects_excessive_total_bytes() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    std::fs::write(
        source_dir.join("超大合集.txt"),
        vec![b'x'; 101 * 1024 * 1024],
    )
    .expect("large txt fixture should be written");

    let error = import_book_directory_into(&dir, &source_dir, true, false, None)
        .expect_err("directory import should reject excessive total size");

    assert!(error.contains("导入目录 TXT 总大小过大"));
    assert!(load_library_records(&dir)
        .expect("records should remain readable")
        .is_empty());
}
