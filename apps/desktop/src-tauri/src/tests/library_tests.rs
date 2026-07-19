use super::*;

#[test]
fn library_metadata_payloads_do_not_load_content_or_chunks() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("meta-only.txt");
    std::fs::write(&source, "第1章 元数据\n正文内容").expect("source txt should be written");
    let record = import_book_from_path_into(&dir, &source).expect("book should import");

    let metadata = load_library_metadata_payloads(&dir).expect("metadata payloads should load");
    let book = metadata
        .iter()
        .find(|item| item.record.id == record.id)
        .expect("imported book metadata should exist");
    assert_eq!(book.content, "");
    assert!(book.chunks.is_empty());
}

#[test]
fn reader_document_payload_loads_content_without_index_chunks() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("reader-doc.txt");
    std::fs::write(&source, "第1章 阅读\n正文内容用于阅读。")
        .expect("source txt should be written");
    let record = import_book_from_path_into(&dir, &source).expect("book should import");
    save_chunk_records(
        &dir,
        &[TextChunkRecord {
            id: "reader-doc:c0".to_string(),
            book_id: record.id.clone(),
            book_title: record.title.clone(),
            chapter: "第1章 阅读".to_string(),
            text: "正文内容用于阅读。".to_string(),
            ordinal: 0,
            chapter_index: 0,
            chapter_title: "第1章 阅读".to_string(),
            paragraph_start: 0,
            paragraph_end: 0,
            char_start: 0,
            char_end: 9,
            content_hash: record.content_hash.clone(),
            chunk_strategy_version: 1,
            created_at: "1".to_string(),
        }],
    )
    .expect("test chunks should save");

    let payload =
        load_reader_document_payload(&dir, &record.id).expect("reader document should load");

    assert!(payload.content.contains("正文内容用于阅读"));
    assert!(payload.chunks.is_empty());
}

#[test]
fn empty_library_stays_empty_without_builtin_book() {
    let dir = unique_temp_library_dir();
    let books = load_library_payloads(&dir).expect("library payloads should load");
    assert!(books.is_empty());
}

#[test]
fn library_payloads_report_missing_book_file_instead_of_empty_content() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("丢失正文.txt");
    std::fs::write(&source, "第1章 文件丢失\n正文不应被静默清空。")
        .expect("source txt should be written");
    let record = import_book_from_path_into(&dir, &source).expect("book should import");
    std::fs::remove_file(&record.file_path).expect("stored original should be removable");

    let error = load_library_payloads(&dir).expect_err("missing book file should surface an error");

    assert!(error.contains("无法读取书籍"));
    assert!(error.contains("丢失正文"));
}

#[test]
fn legacy_builtin_record_is_removed_from_library() {
    let dir = unique_temp_library_dir();
    let record = BookRecord {
        id: "sample-local-txt".to_string(),
        title: "旧占位记录".to_string(),
        display_title: "旧占位记录".to_string(),
        author: "本地 TXT 示例".to_string(),
        format: "TXT".to_string(),
        status: "旧占位记录".to_string(),
        progress: 12,
        file_name: "legacy-placeholder.txt".to_string(),
        file_path: "E:/books/legacy-placeholder.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "amber".to_string(),
        deleted: false,
        deleted_at: String::new(),
        content_hash: "sample-local-txt".to_string(),
        imported_at: "123456789".to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    save_library_records(&dir, &[record]).expect("legacy builtin record should save");

    let books = load_library_payloads(&dir).expect("library payloads should load");
    let records = load_library_records(&dir).expect("library records should reload");

    assert!(books.is_empty());
    assert!(records.is_empty());
}

#[test]
fn persists_book_metadata_round_trip() {
    let dir = unique_temp_library_dir();
    let record = BookRecord {
        id: "sample-local-txt".to_string(),
        title: "旧占位记录".to_string(),
        display_title: "自定义书名".to_string(),
        author: "本地 TXT 示例".to_string(),
        format: "TXT".to_string(),
        status: "已导入".to_string(),
        progress: 31,
        file_name: "legacy-placeholder.txt".to_string(),
        file_path: "E:/books/legacy-placeholder.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "知".to_string(),
        cover_tone: "violet".to_string(),
        deleted: true,
        deleted_at: (crate::library::now_epoch_millis() + 60_000).to_string(),
        content_hash: "hash-for-round-trip".to_string(),
        imported_at: "123456789".to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };

    save_library_records(&dir, &[record.clone()]).expect("library metadata should save");
    let loaded = load_library_records(&dir).expect("library metadata should load");

    assert_eq!(loaded, vec![record]);
}

#[test]
fn expired_trash_records_are_kept_when_auto_cleanup_is_disabled() {
    let dir = unique_temp_library_dir();
    crate::settings::save_app_settings(
        &dir,
        &crate::models::AppSettings {
            trash_retention_days: 1,
            trash_auto_cleanup_enabled: false,
            ..crate::models::AppSettings::default()
        },
    )
    .expect("settings should save");
    let record = BookRecord {
        id: "expired-trash-kept".to_string(),
        title: "过期回收站".to_string(),
        display_title: "过期回收站".to_string(),
        author: "本地导入".to_string(),
        format: "TXT".to_string(),
        status: "在回收站".to_string(),
        progress: 0,
        file_name: "expired-trash-kept.txt".to_string(),
        file_path: "E:/books/expired-trash-kept.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "sage".to_string(),
        deleted: true,
        deleted_at: (crate::library::now_epoch_millis() - 2 * 24 * 60 * 60 * 1000).to_string(),
        content_hash: "expired-trash-kept-hash".to_string(),
        imported_at: "123456789".to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    save_library_records(&dir, &[record.clone()]).expect("expired trash metadata should save");

    let loaded = load_library_records(&dir).expect("library metadata should load");

    assert_eq!(loaded, vec![record]);
}

#[test]
fn expired_trash_records_with_reading_progress_are_protected_from_auto_cleanup() {
    let dir = unique_temp_library_dir();
    crate::settings::save_app_settings(
        &dir,
        &crate::models::AppSettings {
            trash_retention_days: 1,
            trash_auto_cleanup_enabled: true,
            trash_protect_reading_progress: true,
            ..crate::models::AppSettings::default()
        },
    )
    .expect("settings should save");
    let protected = BookRecord {
        id: "expired-trash-progress".to_string(),
        title: "有阅读进度".to_string(),
        display_title: "有阅读进度".to_string(),
        author: "本地导入".to_string(),
        format: "TXT".to_string(),
        status: "在回收站".to_string(),
        progress: 12,
        file_name: "expired-trash-progress.txt".to_string(),
        file_path: "E:/books/expired-trash-progress.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "sage".to_string(),
        deleted: true,
        deleted_at: (crate::library::now_epoch_millis() - 2 * 24 * 60 * 60 * 1000).to_string(),
        content_hash: "expired-trash-progress-hash".to_string(),
        imported_at: "123456789".to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    let unprotected = BookRecord {
        id: "expired-trash-unread".to_string(),
        title: "无保护".to_string(),
        display_title: "无保护".to_string(),
        author: "本地导入".to_string(),
        format: "TXT".to_string(),
        status: "在回收站".to_string(),
        progress: 0,
        file_name: "expired-trash-unread.txt".to_string(),
        file_path: "E:/books/expired-trash-unread.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "sage".to_string(),
        deleted: true,
        deleted_at: protected.deleted_at.clone(),
        content_hash: "expired-trash-unread-hash".to_string(),
        imported_at: "123456789".to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    save_library_records(&dir, &[protected.clone(), unprotected.clone()])
        .expect("expired trash metadata should save");

    let loaded = load_library_records(&dir).expect("library metadata should load");

    assert_eq!(loaded, vec![protected]);
}

#[test]
fn empty_trash_keeps_reader_assets_when_exception_protection_is_enabled() {
    let dir = unique_temp_library_dir();
    crate::settings::save_app_settings(
        &dir,
        &crate::models::AppSettings {
            trash_protect_reader_assets: true,
            ..crate::models::AppSettings::default()
        },
    )
    .expect("settings should save");
    let protected = BookRecord {
        id: "trash-reader-assets".to_string(),
        title: "有阅读资产".to_string(),
        display_title: "有阅读资产".to_string(),
        author: "本地导入".to_string(),
        format: "TXT".to_string(),
        status: "在回收站".to_string(),
        progress: 0,
        file_name: "trash-reader-assets.txt".to_string(),
        file_path: "E:/books/trash-reader-assets.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "sage".to_string(),
        deleted: true,
        deleted_at: crate::library::now_epoch_millis().to_string(),
        content_hash: "trash-reader-assets-hash".to_string(),
        imported_at: "123456789".to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    let unprotected = BookRecord {
        id: "trash-no-assets".to_string(),
        title: "无阅读资产".to_string(),
        display_title: "无阅读资产".to_string(),
        author: "本地导入".to_string(),
        format: "TXT".to_string(),
        status: "在回收站".to_string(),
        progress: 0,
        file_name: "trash-no-assets.txt".to_string(),
        file_path: "E:/books/trash-no-assets.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "sage".to_string(),
        deleted: true,
        deleted_at: protected.deleted_at.clone(),
        content_hash: "trash-no-assets-hash".to_string(),
        imported_at: "123456789".to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    save_library_records(&dir, &[protected.clone(), unprotected])
        .expect("trash metadata should save");
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: protected.id.clone(),
            kind: "bookmarks".to_string(),
            payload: r#"[{"id":"keep"}]"#.to_string(),
            schema_version: 1,
            source_window_id: "reader".to_string(),
        },
    )
    .expect("reader bookmark should save");

    let remaining =
        crate::library::empty_trash_in(&dir, true).expect("trash should empty with protection");

    assert_eq!(remaining, vec![protected.clone()]);
    assert!(load_reader_record_in(&dir, &protected.id, "bookmarks")
        .expect("reader record should load")
        .is_some());
    assert!(load_library_records(&dir)
        .expect("library should reload")
        .iter()
        .any(|record| record.id == protected.id && record.deleted));
}

#[test]
fn update_book_metadata_persists_manual_author_edits() {
    let dir = unique_temp_library_dir();
    let record = BookRecord {
        id: "manual-author".to_string(),
        title: "原始书名".to_string(),
        display_title: "原始书名".to_string(),
        author: "本地导入".to_string(),
        format: "TXT".to_string(),
        status: "已导入".to_string(),
        progress: 10,
        file_name: "manual-author.txt".to_string(),
        file_path: "E:/books/manual-author.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "sage".to_string(),
        deleted: false,
        deleted_at: String::new(),
        content_hash: "manual-author-hash".to_string(),
        imported_at: "123456789".to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    save_library_records(&dir, &[record.clone()]).expect("library metadata should save");

    let updated = update_book_metadata_in(
        &dir,
        BookRecord {
            display_title: "  手动书名  ".to_string(),
            author: "  手动作者  ".to_string(),
            progress: 150,
            ..record
        },
    )
    .expect("metadata update should save");
    let loaded = load_library_records(&dir).expect("library metadata should reload");

    assert_eq!(updated.display_title, "手动书名");
    assert_eq!(updated.author, "手动作者");
    assert_eq!(updated.progress, 100);
    assert_eq!(loaded[0].author, "手动作者");
}

#[test]
fn permanent_delete_clears_legacy_external_paths_without_deleting_external_file() {
    let dir = unique_temp_library_dir();
    let outside_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&outside_dir).expect("outside dir should be created");
    let outside_file = outside_dir.join("不要误删.txt");
    std::fs::write(&outside_file, "outside file must survive")
        .expect("outside file should be written");
    let record = BookRecord {
        id: "unsafe-delete".to_string(),
        title: "篡改路径".to_string(),
        display_title: "篡改路径".to_string(),
        author: "本地导入".to_string(),
        format: "TXT".to_string(),
        status: "在回收站".to_string(),
        progress: 0,
        file_name: "不要误删.txt".to_string(),
        file_path: outside_file.display().to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "sage".to_string(),
        deleted: true,
        deleted_at: crate::library::now_epoch_millis().to_string(),
        content_hash: "unsafe-delete-hash".to_string(),
        imported_at: "123456789".to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    save_library_records(&dir, &[record.clone()]).expect("tampered library metadata should save");

    crate::library::permanently_delete_book_in(&dir, "unsafe-delete")
        .expect("legacy external path should not block permanent delete");

    assert!(outside_file.exists());
    assert!(load_library_records(&dir)
        .expect("records should reload after delete")
        .is_empty());
}

#[test]
fn empty_trash_clears_legacy_external_paths_without_deleting_external_files() {
    let dir = unique_temp_library_dir();
    let outside_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&outside_dir).expect("outside dir should be created");
    let outside_file = outside_dir.join("旧外部书籍.txt");
    std::fs::write(&outside_file, "external file must survive")
        .expect("outside file should be written");
    let record = BookRecord {
        id: "legacy-external-trash".to_string(),
        title: "旧外部路径".to_string(),
        display_title: "旧外部路径".to_string(),
        author: "本地导入".to_string(),
        format: "TXT".to_string(),
        status: "在回收站".to_string(),
        progress: 0,
        file_name: "旧外部书籍.txt".to_string(),
        file_path: outside_file.display().to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "sage".to_string(),
        deleted: true,
        deleted_at: crate::library::now_epoch_millis().to_string(),
        content_hash: "legacy-external-trash-hash".to_string(),
        imported_at: "123456789".to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    save_library_records(&dir, &[record]).expect("legacy trash metadata should save");

    crate::library::empty_trash_in(&dir, true)
        .expect("legacy external path should not block empty trash");

    assert!(outside_file.exists());
    assert!(load_library_records(&dir)
        .expect("records should reload after empty trash")
        .is_empty());
}

#[test]
fn empty_trash_command_returns_metadata_when_remaining_book_content_is_missing() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let trashed_source = source_dir.join("待清除回收站.txt");
    let remaining_source = source_dir.join("剩余缺失正文.txt");
    std::fs::write(&trashed_source, "第1章 删除\n这本书在回收站。")
        .expect("trashed source should be written");
    std::fs::write(&remaining_source, "第1章 剩余\n这本书正文稍后缺失。")
        .expect("remaining source should be written");
    let trashed =
        import_book_from_path_into(&dir, &trashed_source).expect("trashed book should import");
    let remaining =
        import_book_from_path_into(&dir, &remaining_source).expect("remaining book should import");
    crate::library::move_book_to_trash_in(&dir, &trashed.id).expect("book should move to trash");
    std::fs::remove_file(&remaining.file_path).expect("remaining managed copy should be removable");

    let books = empty_trash_command_in(&dir, true)
        .expect("empty trash command should return metadata only");
    assert_eq!(books.len(), 1);
    assert_eq!(books[0].record.id, remaining.id);
    assert_eq!(books[0].content, "");
    assert!(books[0].chunks.is_empty());
}

#[test]
fn permanent_delete_command_returns_metadata_when_remaining_book_content_is_missing() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let trashed_source = source_dir.join("单本永久删除.txt");
    let remaining_source = source_dir.join("单本剩余缺失正文.txt");
    std::fs::write(&trashed_source, "第1章 删除\n这本书在回收站。")
        .expect("trashed source should be written");
    std::fs::write(&remaining_source, "第1章 剩余\n这本书正文稍后缺失。")
        .expect("remaining source should be written");
    let trashed =
        import_book_from_path_into(&dir, &trashed_source).expect("trashed book should import");
    let remaining =
        import_book_from_path_into(&dir, &remaining_source).expect("remaining book should import");
    crate::library::move_book_to_trash_in(&dir, &trashed.id).expect("book should move to trash");
    std::fs::remove_file(&remaining.file_path).expect("remaining managed copy should be removable");

    let books = permanently_delete_book_command_in(&dir, &trashed.id)
        .expect("permanent delete command should return metadata only");
    assert_eq!(books.len(), 1);
    assert_eq!(books[0].record.id, remaining.id);
    assert_eq!(books[0].content, "");
    assert!(books[0].chunks.is_empty());
}

#[test]
fn permanent_delete_archives_reader_records_for_deleted_book() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("带标注删除.txt");
    std::fs::write(&source, "第1章 删除\nReader 数据应归档。")
        .expect("source txt should be written");
    let record = import_book_from_path_into(&dir, &source).expect("book should import");
    crate::library::move_book_to_trash_in(&dir, &record.id).expect("book should move to trash");
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: record.id.clone(),
            kind: "bookmarks".to_string(),
            payload: r#"[{"id":"b1"}]"#.to_string(),
            schema_version: 1,
            source_window_id: "reader".to_string(),
        },
    )
    .expect("reader bookmark record should save");

    crate::library::permanently_delete_book_in(&dir, &record.id)
        .expect("book should delete permanently");

    assert!(load_reader_record_in(&dir, &record.id, "bookmarks")
        .expect("active reader record query should succeed")
        .is_none());
    let archived = load_reader_record_in(&dir, &format!("deleted:{}", record.id), "bookmarks")
        .expect("archived reader record query should succeed")
        .expect("archived reader record should exist");
    assert_eq!(archived.payload, r#"[{"id":"b1"}]"#);
}

#[test]
fn permanent_delete_is_idempotent_when_archived_reader_records_already_exist() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("重复归档删除.txt");
    std::fs::write(&source, "第1章 删除\n重复归档不应阻止清空回收站。")
        .expect("source txt should be written");
    let record = import_book_from_path_into(&dir, &source).expect("book should import");
    crate::library::move_book_to_trash_in(&dir, &record.id).expect("book should move to trash");
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: record.id.clone(),
            kind: "bookmarks".to_string(),
            payload: r#"[{"id":"current"}]"#.to_string(),
            schema_version: 1,
            source_window_id: "reader".to_string(),
        },
    )
    .expect("current reader bookmark record should save");
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: format!("deleted:{}", record.id),
            kind: "bookmarks".to_string(),
            payload: r#"[{"id":"archived"}]"#.to_string(),
            schema_version: 1,
            source_window_id: "reader".to_string(),
        },
    )
    .expect("existing archived reader bookmark record should save");

    crate::library::permanently_delete_book_in(&dir, &record.id)
        .expect("book should delete even when archived reader rows already exist");

    assert!(load_library_records(&dir)
        .expect("library should load after delete")
        .is_empty());
    assert!(load_reader_record_in(&dir, &record.id, "bookmarks")
        .expect("active reader record query should succeed")
        .is_none());
    let archived = load_reader_record_in(&dir, &format!("deleted:{}", record.id), "bookmarks")
        .expect("archived reader record query should succeed")
        .expect("archived reader record should exist");
    assert_eq!(archived.payload, r#"[{"id":"current"}]"#);
}

#[test]
fn permanent_delete_removes_index_outputs_for_deleted_book() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("删除索引残留.txt");
    std::fs::write(&source, "第1章 删除\n永久删除后不应保留索引浏览器条目。")
        .expect("source txt should be written");
    let record = import_book_from_path_into(&dir, &source).expect("book should import");
    run_parse_and_index_tasks_in(&dir).expect("book should index");
    assert!(!load_book_chunk_records(&dir, &record.id)
        .expect("book chunks should exist before delete")
        .is_empty());
    crate::library::move_book_to_trash_in(&dir, &record.id).expect("book should move to trash");

    crate::library::permanently_delete_book_in(&dir, &record.id)
        .expect("book should delete permanently");

    assert!(load_book_chunk_records(&dir, &record.id)
        .expect("book chunks should load after delete")
        .is_empty());
    assert_eq!(
        crate::database::count_book_fts_rows(&dir, &record.id)
            .expect("fts rows should count after delete"),
        0
    );
    assert!(load_index_manifest(&dir)
        .expect("manifest should load after delete")
        .iter()
        .all(|entry| entry.book_id != record.id));
    assert!(index_diagnostics_for_ui(&dir)
        .expect("diagnostics should load after delete")
        .books
        .iter()
        .all(|entry| entry.book_id != record.id));
}

#[test]
fn empty_trash_removes_index_outputs_for_deleted_books() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let first_source = source_dir.join("清空回收站-A.txt");
    let second_source = source_dir.join("清空回收站-B.txt");
    std::fs::write(&first_source, "第1章 A\n清空回收站应删除 A 的索引。")
        .expect("first source txt should be written");
    std::fs::write(&second_source, "第1章 B\n清空回收站应删除 B 的索引。")
        .expect("second source txt should be written");
    let first = import_book_from_path_into(&dir, &first_source).expect("first book should import");
    let second =
        import_book_from_path_into(&dir, &second_source).expect("second book should import");
    run_parse_and_index_tasks_in(&dir).expect("books should index");
    crate::library::move_book_to_trash_in(&dir, &first.id).expect("first should move to trash");
    crate::library::move_book_to_trash_in(&dir, &second.id).expect("second should move to trash");

    crate::library::empty_trash_in(&dir, true).expect("trash should empty");

    for book_id in [&first.id, &second.id] {
        assert!(load_book_chunk_records(&dir, book_id)
            .expect("book chunks should load after empty trash")
            .is_empty());
        assert_eq!(
            crate::database::count_book_fts_rows(&dir, book_id)
                .expect("fts rows should count after empty trash"),
            0
        );
        assert!(load_index_manifest(&dir)
            .expect("manifest should load after empty trash")
            .iter()
            .all(|entry| entry.book_id != *book_id));
        assert!(index_diagnostics_for_ui(&dir)
            .expect("diagnostics should load after empty trash")
            .books
            .iter()
            .all(|entry| entry.book_id != *book_id));
    }
}

#[test]
fn read_book_content_returns_full_txt_for_reader_toc() {
    let dir = unique_temp_library_dir();
    std::fs::create_dir_all(&dir).expect("source dir should be created");
    let source = dir.join("长篇目录测试.txt");
    let long_paragraph = "这是用于撑开阅读正文的长段落。".repeat(80);
    let full = (1..=12)
        .map(|index| format!("第{index}章 标题{index}\n{long_paragraph}\n这是第{index}章正文。"))
        .collect::<Vec<_>>()
        .join("\n\n");
    std::fs::write(&source, &full).expect("long txt should be written");

    let loaded = read_book_content(&source).expect("reader content should load");

    assert_eq!(loaded, full);
    assert!(loaded.contains("第12章 标题12"));
}
