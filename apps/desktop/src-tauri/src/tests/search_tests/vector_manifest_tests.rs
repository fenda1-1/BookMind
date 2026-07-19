use super::*;

#[test]
fn vector_manifest_path_and_roundtrip_use_required_camel_case_fields() {
    let dir = unique_temp_library_dir();
    let path = vector_index_manifest_path(&dir);

    assert!(path.ends_with("indexes/vector/vector_index_manifest.json"));
    assert_eq!(
        load_vector_index_manifest(&dir).expect("missing vector manifest should load as empty"),
        Vec::<VectorIndexManifestEntry>::new()
    );

    let manifest = vec![VectorIndexManifestEntry {
        book_id: "book-vector-manifest".to_string(),
        content_hash: "hash-v1".to_string(),
        chunk_strategy_version: 1,
        embedding_model: "bge-small-zh-v1.5".to_string(),
        dimension: 1024,
        chunk_count: 12,
        built_at: "1781548000000".to_string(),
        status: "ready".to_string(),
        last_error: String::new(),
    }];

    save_vector_index_manifest(&dir, &manifest).expect("vector manifest should save");

    let saved = load_vector_index_manifest(&dir).expect("vector manifest should reload");
    assert_eq!(saved, manifest);
    let raw = std::fs::read_to_string(path).expect("vector manifest json should be readable");
    assert!(raw.contains("\"bookId\""));
    assert!(raw.contains("\"contentHash\""));
    assert!(raw.contains("\"chunkStrategyVersion\""));
    assert!(raw.contains("\"embeddingModel\""));
    assert!(raw.contains("\"dimension\""));
    assert!(raw.contains("\"chunkCount\""));
    assert!(raw.contains("\"builtAt\""));
    assert!(raw.contains("\"status\""));
    assert!(raw.contains("\"lastError\""));
    assert!(!raw.contains("vectorStorePath"));
    assert!(!raw.contains("embedding\":"));
}

#[test]
fn vector_manifest_ready_entries_drive_diagnostics_without_enabling_vector_commands() {
    let (dir, book, text_manifest) = indexed_book_fixture("vector-ready.txt");
    crate::settings::save_settings_v2(
        &dir,
        &SettingsV2 {
            settings_schema_version: 2,
            global: serde_json::json!({}),
            reader: serde_json::json!({}),
            extended: serde_json::json!({ "vectorEmbeddingModel": "bge-small-zh-v1.5" }),
        },
    )
    .expect("vector embedding setting should save");

    save_vector_index_manifest(
        &dir,
        &[VectorIndexManifestEntry {
            book_id: book.id.clone(),
            content_hash: book.content_hash.clone(),
            chunk_strategy_version: text_manifest.chunk_strategy_version,
            embedding_model: "bge-small-zh-v1.5".to_string(),
            dimension: 1024,
            chunk_count: text_manifest.chunk_count,
            built_at: "1781548000000".to_string(),
            status: "ready".to_string(),
            last_error: String::new(),
        }],
    )
    .expect("ready vector manifest should save");

    let diagnostics = index_diagnostics_for_ui(&dir).expect("diagnostics should load");
    assert_eq!(diagnostics.summary.vector_index_status, "ready");
    assert_eq!(diagnostics.summary.vector_indexed_book_count, 1);
    assert_eq!(
        diagnostics.summary.vector_indexed_chunk_count,
        text_manifest.chunk_count
    );
    assert_eq!(diagnostics.summary.vector_provider, "bge-small-zh-v1.5");
    assert_eq!(diagnostics.summary.vector_dimension, 1024);
    assert_eq!(diagnostics.summary.vector_last_built_at, "1781548000000");
    assert!(diagnostics.summary.vector_last_error.is_empty());

    let build = build_vector_index_in(&dir, &book.id)
        .expect("vector build command should remain structured unavailable");
    assert!(!build.ok);
    assert_eq!(build.vector_index_status, "not-built");
    let search = search_vector_index_in(&dir, "雨夜", 5)
        .expect("vector search command should remain structured unavailable");
    assert!(!search.ok);
    assert_eq!(search.vector_index_status, "not-built");
}

#[test]
fn vector_manifest_diagnostics_mark_entries_stale_when_content_hash_changes() {
    let (dir, book, text_manifest) = indexed_book_fixture("vector-hash-stale.txt");
    save_vector_settings_and_manifest(
        &dir,
        &book.id,
        &book.content_hash,
        text_manifest.chunk_strategy_version,
        "bge-small-zh-v1.5",
        text_manifest.chunk_count,
    );
    let mut records = load_library_records(&dir).expect("library should load");
    records[0].content_hash = "changed-content-hash".to_string();
    save_library_records(&dir, &records).expect("library should save changed hash");

    let diagnostics = index_diagnostics_for_ui(&dir).expect("diagnostics should load");

    assert_eq!(diagnostics.summary.vector_index_status, "stale");
    assert_eq!(diagnostics.summary.vector_indexed_book_count, 0);
    assert_eq!(diagnostics.summary.vector_indexed_chunk_count, 0);
    assert!(diagnostics
        .summary
        .vector_last_error
        .contains("content hash"));
}

#[test]
fn vector_manifest_diagnostics_mark_entries_stale_when_chunk_strategy_changes() {
    let (dir, book, text_manifest) = indexed_book_fixture("vector-chunk-stale.txt");
    save_vector_settings_and_manifest(
        &dir,
        &book.id,
        &book.content_hash,
        text_manifest.chunk_strategy_version + 1,
        "bge-small-zh-v1.5",
        text_manifest.chunk_count,
    );

    let diagnostics = index_diagnostics_for_ui(&dir).expect("diagnostics should load");

    assert_eq!(diagnostics.summary.vector_index_status, "stale");
    assert_eq!(diagnostics.summary.vector_indexed_book_count, 0);
    assert!(diagnostics
        .summary
        .vector_last_error
        .contains("chunk strategy"));
}

#[test]
fn vector_manifest_diagnostics_mark_entries_stale_when_embedding_model_changes() {
    let (dir, book, text_manifest) = indexed_book_fixture("vector-model-stale.txt");
    save_vector_settings_and_manifest(
        &dir,
        &book.id,
        &book.content_hash,
        text_manifest.chunk_strategy_version,
        "bge-small-zh-v1.5",
        text_manifest.chunk_count,
    );
    crate::settings::save_settings_v2(
        &dir,
        &SettingsV2 {
            settings_schema_version: 2,
            global: serde_json::json!({}),
            reader: serde_json::json!({}),
            extended: serde_json::json!({ "vectorEmbeddingModel": "bge-small-zh-v2" }),
        },
    )
    .expect("changed vector embedding setting should save");

    let diagnostics = index_diagnostics_for_ui(&dir).expect("diagnostics should load");

    assert_eq!(diagnostics.summary.vector_index_status, "stale");
    assert_eq!(diagnostics.summary.vector_indexed_book_count, 0);
    assert!(diagnostics
        .summary
        .vector_last_error
        .contains("embedding model"));
}

fn indexed_book_fixture(file_name: &str) -> (std::path::PathBuf, BookRecord, BookIndexManifest) {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join(file_name);
    std::fs::write(
        &source,
        "第一章 Vector Manifest\n向量 manifest 只记录索引元数据，不保存 embedding 或本地 vector store 路径。",
    )
    .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    let text_manifest = load_index_manifest(&dir)
        .expect("text manifest should load")
        .into_iter()
        .find(|entry| entry.book_id == book.id)
        .expect("book text manifest should exist");

    (dir, book, text_manifest)
}

fn save_vector_settings_and_manifest(
    dir: &std::path::Path,
    book_id: &str,
    content_hash: &str,
    chunk_strategy_version: u32,
    embedding_model: &str,
    chunk_count: usize,
) {
    crate::settings::save_settings_v2(
        dir,
        &SettingsV2 {
            settings_schema_version: 2,
            global: serde_json::json!({}),
            reader: serde_json::json!({}),
            extended: serde_json::json!({ "vectorEmbeddingModel": "bge-small-zh-v1.5" }),
        },
    )
    .expect("vector embedding setting should save");
    save_vector_index_manifest(
        dir,
        &[VectorIndexManifestEntry {
            book_id: book_id.to_string(),
            content_hash: content_hash.to_string(),
            chunk_strategy_version,
            embedding_model: embedding_model.to_string(),
            dimension: 1024,
            chunk_count,
            built_at: "1781548000000".to_string(),
            status: "ready".to_string(),
            last_error: String::new(),
        }],
    )
    .expect("vector manifest should save");
}
