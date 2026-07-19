use super::*;

#[test]
fn index_chunk_settings_change_actual_chunking() {
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("chunk设置.txt");
    let mut content = String::from("第一章 Chunk 设置\n");
    for index in 0..48 {
        content.push_str(&format!(
            "第 {index} 段用于验证索引 chunk 大小和 overlap 设置会进入 Rust 分块逻辑并改变输出边界。\n"
        ));
    }
    std::fs::write(&source, content).expect("source txt should be written");

    let small_dir = unique_temp_library_dir();
    crate::settings::save_settings_v2(
        &small_dir,
        &SettingsV2 {
            settings_schema_version: 2,
            global: serde_json::json!({}),
            reader: serde_json::json!({}),
            extended: serde_json::json!({
                "indexChunkSize": "200",
                "indexChunkOverlap": "120"
            }),
        },
    )
    .expect("small chunk settings should save");
    let small_book =
        import_book_from_path_into(&small_dir, &source).expect("small import should queue");
    run_parse_and_index_tasks_in(&small_dir).expect("small chunk parse/index should run");
    let small_chunks =
        load_book_chunk_records(&small_dir, &small_book.id).expect("small chunks should load");
    let small_manifest = load_index_manifest(&small_dir).expect("small manifest should load");
    let small_entry = small_manifest
        .iter()
        .find(|entry| entry.book_id == small_book.id)
        .expect("small manifest entry should exist");

    let large_dir = unique_temp_library_dir();
    crate::settings::save_settings_v2(
        &large_dir,
        &SettingsV2 {
            settings_schema_version: 2,
            global: serde_json::json!({}),
            reader: serde_json::json!({}),
            extended: serde_json::json!({
                "indexChunkSize": "5000",
                "indexChunkOverlap": "0"
            }),
        },
    )
    .expect("large chunk settings should save");
    let large_book =
        import_book_from_path_into(&large_dir, &source).expect("large import should queue");
    run_parse_and_index_tasks_in(&large_dir).expect("large chunk parse/index should run");
    let large_chunks =
        load_book_chunk_records(&large_dir, &large_book.id).expect("large chunks should load");
    let large_manifest = load_index_manifest(&large_dir).expect("large manifest should load");
    let large_entry = large_manifest
        .iter()
        .find(|entry| entry.book_id == large_book.id)
        .expect("large manifest entry should exist");

    assert!(
        small_chunks.len() > large_chunks.len(),
        "smaller chunk size should produce more chunks"
    );
    assert_eq!(small_entry.chunk_count, small_chunks.len());
    assert_eq!(large_entry.chunk_count, large_chunks.len());
    assert!(
        small_chunks
            .windows(2)
            .any(|pair| pair[1].paragraph_start <= pair[0].paragraph_end),
        "configured overlap should retain paragraph ranges across adjacent chunks"
    );
}

#[test]
fn parses_txt_into_searchable_chunks() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("搜索测试.txt");
    std::fs::write(
        &source,
        "第一章 阅读方法\n主动阅读需要记录问题。\n第二章 证据索引\n关键词证据用于回跳原文。",
    )
    .expect("source txt should be written");

    import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    let results = search_index_in(&dir, "关键词证据").expect("search should work");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].book_title, "搜索测试");
    assert!(results[0].snippet.contains("关键词证据"));
    assert!(results[0].chunk_id.starts_with("book-"));
    assert!(results[0].chunk_id.contains(":c"));
    assert!(results[0].chunk_id.contains(":p"));
    assert_eq!(results[0].source_chapter_index, 1);
    assert_eq!(results[0].paragraph_index, 1);
    assert!(results[0].end_offset >= results[0].start_offset);
}

#[test]
fn parse_runner_writes_sqlite_fts_index_for_search() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("FTS测试.txt");
    std::fs::write(
        &source,
        "第一章 本地数据库\nSQLite FTS5 应该保存全文索引。\n第二章 检索\n全文索引返回证据片段。",
    )
    .expect("source txt should be written");

    import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    let db_path = fts_database_path(&dir);
    let results = search_index_in(&dir, "FTS5").expect("search should work");

    assert!(
        db_path.exists(),
        "FTS database should exist at {}",
        db_path.display()
    );
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].book_title, "FTS测试");
    assert!(results[0].snippet.contains("FTS5"));
}

#[test]
fn database_index_rebuild_reindexes_without_deleting_reader_or_search_data() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("数据库索引维护.txt");
    std::fs::write(
        &source,
        "第一章 数据库维护\nREINDEX 和 ANALYZE 应该维护 SQLite 索引但不删除阅读数据。\n第二章 搜索\nFTS optimize 后仍能检索维护关键词。",
    )
    .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: book.id.clone(),
            kind: "state".to_string(),
            payload: r#"{"chapter":1}"#.to_string(),
            schema_version: 1,
            source_window_id: "test".to_string(),
        },
    )
    .expect("reader state record should save");
    let chunk_count_before = load_book_chunk_records(&dir, &book.id)
        .expect("book chunks should load before maintenance")
        .len();
    let fts_count_before = crate::database::count_book_fts_rows(&dir, &book.id)
        .expect("fts rows should count before maintenance");
    assert!(chunk_count_before > 0);
    assert_eq!(chunk_count_before, fts_count_before);

    let payload = rebuild_sqlite_database_indexes_in(&dir)
        .expect("database index maintenance should succeed");

    assert!(payload.reindexed);
    assert!(payload.analyzed);
    assert!(payload.fts_optimized);
    assert!(payload.database_path.ends_with("bookmind.sqlite"));
    assert_eq!(payload.chunk_count, chunk_count_before);
    assert_eq!(payload.fts_row_count, fts_count_before);
    assert_eq!(
        load_book_chunk_records(&dir, &book.id)
            .expect("book chunks should load after maintenance")
            .len(),
        chunk_count_before
    );
    assert_eq!(
        crate::database::count_book_fts_rows(&dir, &book.id)
            .expect("fts rows should count after maintenance"),
        fts_count_before
    );
    assert!(load_reader_record_in(&dir, &book.id, "state")
        .expect("reader state should load after database maintenance")
        .is_some());
    let results =
        search_index_in(&dir, "维护关键词").expect("search should work after maintenance");
    assert_eq!(results.len(), 1);
}

#[test]
fn database_vacuum_compacts_without_deleting_reader_or_search_data() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("数据库vacuum.txt");
    std::fs::write(
        &source,
        "第一章 Vacuum\nVACUUM 应该压缩 SQLite 文件但保留阅读数据。\n第二章 搜索\nvacuum 之后仍能检索压缩关键词。",
    )
    .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: book.id.clone(),
            kind: "state".to_string(),
            payload: r#"{"chapter":2}"#.to_string(),
            schema_version: 1,
            source_window_id: "test".to_string(),
        },
    )
    .expect("reader state record should save");
    let chunk_count_before = load_book_chunk_records(&dir, &book.id)
        .expect("book chunks should load before vacuum")
        .len();
    let fts_count_before = crate::database::count_book_fts_rows(&dir, &book.id)
        .expect("fts rows should count before vacuum");
    assert!(chunk_count_before > 0);

    let payload = vacuum_sqlite_database_in(&dir).expect("database vacuum should succeed");

    assert!(payload.vacuumed);
    assert!(payload.database_path.ends_with("bookmind.sqlite"));
    assert!(payload.size_before_bytes > 0);
    assert!(payload.size_after_bytes > 0);
    assert_eq!(payload.chunk_count, chunk_count_before);
    assert_eq!(payload.fts_row_count, fts_count_before);
    assert_eq!(
        load_book_chunk_records(&dir, &book.id)
            .expect("book chunks should load after vacuum")
            .len(),
        chunk_count_before
    );
    assert_eq!(
        crate::database::count_book_fts_rows(&dir, &book.id)
            .expect("fts rows should count after vacuum"),
        fts_count_before
    );
    assert!(load_reader_record_in(&dir, &book.id, "state")
        .expect("reader state should load after vacuum")
        .is_some());
    let results = search_index_in(&dir, "压缩关键词").expect("search should work after vacuum");
    assert_eq!(results.len(), 1);
}

#[test]
fn load_book_chunk_records_reads_only_requested_book() {
    let dir = unique_temp_library_dir();
    crate::search::save_chunk_records(
        &dir,
        &[
            TextChunkRecord {
                id: "c1".to_string(),
                book_id: "book-a".to_string(),
                book_title: "甲".to_string(),
                chapter: "第一章".to_string(),
                ordinal: 0,
                text: "甲正文".to_string(),
                ..TextChunkRecord::default()
            },
            TextChunkRecord {
                id: "c2".to_string(),
                book_id: "book-b".to_string(),
                book_title: "乙".to_string(),
                chapter: "第二章".to_string(),
                ordinal: 0,
                text: "乙正文".to_string(),
                ..TextChunkRecord::default()
            },
        ],
    )
    .expect("chunk records should save");

    let chunks = load_book_chunk_records(&dir, "book-b").expect("book chunks should load");

    assert_eq!(chunks.len(), 1);
    assert_eq!(chunks[0].id, "c2");
    assert_eq!(chunks[0].book_id, "book-b");
}

#[test]
fn search_index_page_literal_fallback_uses_sqlite_chunks() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("回退搜索.txt");
    std::fs::write(
        &source,
        "第一章 回退\n这里有一个不会走 FTS 的词组：罕见字符组合甲乙丙。第二段继续补充。",
    )
    .expect("source txt should be written");

    import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    let manifest = load_index_manifest(&dir).expect("manifest should load");
    assert_eq!(manifest.len(), 1);

    let results = search_index_page_in(&dir, "甲乙丙", 10, 0).expect("literal search should work");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].book_title, "回退搜索");
}

#[test]
fn indexed_chunks_preview_supports_pagination_query_and_chapter_filter() {
    let dir = unique_temp_library_dir();
    crate::search::save_chunk_records(
        &dir,
        &[
            TextChunkRecord {
                id: "preview-1".to_string(),
                book_id: "book-preview".to_string(),
                book_title: "预览书".to_string(),
                chapter: "第一章 起点".to_string(),
                ordinal: 0,
                text: "第一段包含关键词火花，并且这段文字足够长，需要在预览里被截断。第二句继续补充上下文。".to_string(),
                chapter_index: 0,
                chapter_title: "第一章 起点".to_string(),
                paragraph_start: 0,
                paragraph_end: 2,
                char_start: 0,
                char_end: 48,
                ..TextChunkRecord::default()
            },
            TextChunkRecord {
                id: "preview-2".to_string(),
                book_id: "book-preview".to_string(),
                book_title: "预览书".to_string(),
                chapter: "第二章 后续".to_string(),
                ordinal: 1,
                text: "第二章也出现火花，用于确认章节筛选。".to_string(),
                chapter_index: 1,
                chapter_title: "第二章 后续".to_string(),
                paragraph_start: 3,
                paragraph_end: 4,
                char_start: 49,
                char_end: 70,
                ..TextChunkRecord::default()
            },
            TextChunkRecord {
                id: "preview-other".to_string(),
                book_id: "other-book".to_string(),
                book_title: "其他书".to_string(),
                chapter: "第一章".to_string(),
                ordinal: 0,
                text: "其他书的火花不应该出现在结果里。".to_string(),
                ..TextChunkRecord::default()
            },
        ],
    )
    .expect("chunk records should save");

    let first_page = get_indexed_chunks_preview_in(&dir, "book-preview", 1, 0, "", None)
        .expect("first page should load");
    let second_page = get_indexed_chunks_preview_in(&dir, "book-preview", 1, 1, "", None)
        .expect("second page should load");
    let searched = get_indexed_chunks_preview_in(&dir, "book-preview", 10, 0, "火花", Some(1))
        .expect("filtered preview should load");

    assert_eq!(first_page.total, 2);
    assert_eq!(first_page.items.len(), 1);
    assert_eq!(first_page.items[0].chunk_id, "preview-1");
    assert_eq!(first_page.items[0].paragraph_range, "0-2");
    assert_eq!(
        first_page.items[0].reader_location,
        "reader://book-preview/0/0?start=0&end=48"
    );
    assert!(first_page.items[0].text_preview.ends_with('…'));
    assert_eq!(second_page.items[0].chunk_id, "preview-2");
    assert_eq!(searched.total, 1);
    assert_eq!(searched.items[0].chapter_index, 1);
    assert!(searched.items[0].text_preview.contains("火花"));
}
