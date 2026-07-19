use super::*;

#[test]
fn task_and_manifest_writes_use_atomic_temp_rename() {
    let tasks_source = include_str!("../../tasks.rs");
    let task_store_source = include_str!("../../tasks/store.rs");
    let search_source = include_str!("../../search.rs");
    let save_tasks_start = task_store_source
        .find("pub(crate) fn save_task_records")
        .expect("task save function should exist");
    let save_manifest_start = tasks_source
        .find("pub(crate) fn save_index_manifest")
        .expect("manifest save function should exist");
    let save_manifest_end = tasks_source[save_manifest_start..]
        .find("pub(crate) fn mark_index_manifests_stale_for_settings_change")
        .expect("next task function should delimit manifest save");
    let save_tasks_source = &task_store_source[save_tasks_start..];
    let save_manifest_source =
        &tasks_source[save_manifest_start..save_manifest_start + save_manifest_end];
    let save_chunks_start = search_source
        .find("pub(crate) struct ChunkRecordsCommit")
        .expect("chunk commit type should exist");
    let save_chunks_end = search_source[save_chunks_start..]
        .find("pub(crate) fn load_book_chunk_records")
        .expect("next search function should delimit chunk commit helpers");
    let save_chunks_source = &search_source[save_chunks_start..save_chunks_start + save_chunks_end];

    for (name, source) in [
        ("tasks", save_tasks_source),
        ("manifest", save_manifest_source),
    ] {
        assert!(
            source.contains("with_extension(\"json.tmp\")"),
            "{name} writes must use a temporary json file"
        );
        assert!(
            source.contains("fs::rename(&temp_path, &path)")
                || source.contains("fs::rename(&self.temp_path, &self.path)"),
            "{name} writes must atomically replace the final json file"
        );
    }
    assert!(
        save_chunks_source.contains("unique_chunk_temp_path(&path)"),
        "chunk writes must use unique temporary files so overlapping commits do not share chunks.json.tmp"
    );
    assert!(
        save_chunks_source.contains("fs::rename(&operation.temp_path, &operation.path)"),
        "chunk writes must atomically replace every staged json file"
    );
}

#[test]
fn chunk_record_commits_use_unique_temp_paths_for_overlapping_writes() {
    let dir = unique_temp_library_dir();
    let first_chunks = vec![TextChunkRecord {
        id: "first-overlap-chunk".to_string(),
        book_id: "book-overlap-a".to_string(),
        book_title: "重叠写入 A".to_string(),
        text: "第一次写入应保留自己的临时文件。".to_string(),
        ..TextChunkRecord::default()
    }];
    let second_chunks = vec![TextChunkRecord {
        id: "second-overlap-chunk".to_string(),
        book_id: "book-overlap-b".to_string(),
        book_title: "重叠写入 B".to_string(),
        text: "第二次写入不能移动第一次的临时文件。".to_string(),
        ..TextChunkRecord::default()
    }];

    let first_commit =
        prepare_chunk_records_commit(&dir, &first_chunks).expect("first chunk commit should stage");
    let second_commit = prepare_chunk_records_commit(&dir, &second_chunks)
        .expect("second chunk commit should stage independently");
    second_commit
        .commit()
        .expect("second overlapping chunk commit should succeed");
    first_commit
        .commit()
        .expect("first overlapping chunk commit should still have its temp file");

    let saved = load_chunk_records(&dir).expect("final chunks should load");
    assert_eq!(saved.len(), 1);
    assert_eq!(saved[0].id, "first-overlap-chunk");
}

#[test]
fn fts_writes_use_temporary_tables_before_replacing_existing_rows() {
    let database_source = include_str!("../../database.rs");
    let save_fts_start = database_source
        .find("pub(crate) fn save_chunks_to_fts")
        .expect("FTS save function should exist");
    let save_fts_end = database_source[save_fts_start..]
        .find("pub(crate) fn rewrite_book_fts_rows")
        .expect("next database function should delimit FTS save");
    let save_fts_source = &database_source[save_fts_start..save_fts_start + save_fts_end];

    assert!(
        save_fts_source.contains("CREATE TEMP TABLE temp_book_chunks"),
        "FTS writes must stage chunk rows in a temporary table before replacing formal rows"
    );
    assert!(
        !save_fts_source.contains("CREATE VIRTUAL TABLE temp.temp_book_chunks_fts"),
        "FTS writes should not build a temporary FTS5 index and then build the formal FTS5 index again"
    );
    assert!(
        save_fts_source.find("SELECT COUNT(*) FROM temp_book_chunks")
            < save_fts_source.find("DELETE FROM chunks WHERE book_id = ?1"),
        "temporary chunks must be counted and verified before formal chunks are deleted"
    );
    assert!(
        save_fts_source.contains("FROM temp_book_chunks"),
        "formal FTS rows should be populated from verified temporary chunk rows in the same transaction"
    );
    assert!(
        include_str!("../../tasks/runner.rs")
            .contains("prepare_chunk_records_commit(data_dir, &chunks)?"),
        "runner must stage the final chunk list in a temporary file before committing task outputs"
    );
}

#[test]
fn failed_temporary_fts_write_preserves_existing_rows() {
    let dir = unique_temp_library_dir();
    let old_chunks = vec![TextChunkRecord {
        id: "stable-old-chunk".to_string(),
        book_id: "book-temp-fts".to_string(),
        book_title: "临时 FTS".to_string(),
        chapter: "旧章节".to_string(),
        ordinal: 0,
        text: "旧索引内容必须在临时写入失败时保留。".to_string(),
        content_hash: "old-hash".to_string(),
        chunk_strategy_version: 1,
        created_at: "1".to_string(),
        ..TextChunkRecord::default()
    }];
    crate::database::save_chunks_to_fts(&dir, "book-temp-fts", &old_chunks)
        .expect("old fts rows should save");
    assert_eq!(
        crate::database::count_book_fts_rows(&dir, "book-temp-fts")
            .expect("old fts rows should count"),
        1
    );

    let duplicate_new_chunks = vec![
        TextChunkRecord {
            id: "duplicate-new-chunk".to_string(),
            book_id: "book-temp-fts".to_string(),
            book_title: "临时 FTS".to_string(),
            chapter: "新章节".to_string(),
            ordinal: 0,
            text: "第一条新索引。".to_string(),
            content_hash: "new-hash".to_string(),
            chunk_strategy_version: 1,
            created_at: "2".to_string(),
            ..TextChunkRecord::default()
        },
        TextChunkRecord {
            id: "duplicate-new-chunk".to_string(),
            book_id: "book-temp-fts".to_string(),
            book_title: "临时 FTS".to_string(),
            chapter: "新章节".to_string(),
            ordinal: 1,
            text: "重复 id 会让临时 chunks 表写入失败。".to_string(),
            content_hash: "new-hash".to_string(),
            chunk_strategy_version: 1,
            created_at: "2".to_string(),
            ..TextChunkRecord::default()
        },
    ];

    crate::database::save_chunks_to_fts(&dir, "book-temp-fts", &duplicate_new_chunks)
        .expect_err("duplicate temp chunks should fail before replacing formal rows");

    let rows = load_book_chunk_records(&dir, "book-temp-fts")
        .expect("formal fts chunks should remain readable");
    assert_eq!(rows, old_chunks);
    assert_eq!(
        crate::database::count_book_fts_rows(&dir, "book-temp-fts")
            .expect("formal fts rows should still count"),
        1
    );
}

#[test]
fn vector_commands_return_structured_unavailable_until_sidecar_is_configured() {
    let dir = unique_temp_library_dir();

    let build = build_vector_index_in(&dir, "book-vector")
        .expect("staged vector build command should return structured status");
    assert!(!build.ok);
    assert_eq!(build.book_id, "book-vector");
    assert_eq!(build.sidecar_status, "not-configured");
    assert_eq!(build.vector_index_status, "not-built");
    assert_eq!(build.indexed_chunk_count, 0);
    assert!(build.message.contains("not configured"));

    let search = search_vector_index_in(&dir, "雨夜", 5)
        .expect("staged vector search command should return structured status");
    assert!(!search.ok);
    assert_eq!(search.query, "雨夜");
    assert_eq!(search.sidecar_status, "not-configured");
    assert_eq!(search.vector_index_status, "not-built");
    assert!(search.results.is_empty());
    assert!(search.message.contains("staged"));
}
