use super::*;

#[test]
fn split_text_chunks_include_reader_location_metadata() {
    let book = BookRecord {
        id: "book-meta".to_string(),
        title: "元数据测试".to_string(),
        display_title: "元数据测试".to_string(),
        author: "本地导入".to_string(),
        format: "TXT".to_string(),
        status: "已导入".to_string(),
        progress: 0,
        file_name: "meta.txt".to_string(),
        file_path: "meta.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "sage".to_string(),
        deleted: false,
        deleted_at: String::new(),
        content_hash: "hash-meta".to_string(),
        imported_at: String::new(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    let chunks = crate::search::split_text_into_chunks(
        &book,
        "第一章 起点\n第一段内容。\n第二段内容。\n\n第二章 后续\n第三段内容。",
    );

    assert_eq!(chunks[0].id, "book-meta:c0:p0-1:k0");
    assert_eq!(chunks[0].chapter_index, 0);
    assert_eq!(chunks[0].chapter_title, "第一章 起点");
    assert_eq!(chunks[0].paragraph_start, 0);
    assert_eq!(chunks[0].paragraph_end, 1);
    assert_eq!(chunks[0].char_start, 0);
    assert!(chunks[0].char_end > chunks[0].char_start);
    assert_eq!(chunks[0].content_hash, "hash-meta");
    assert_eq!(chunks[0].chunk_strategy_version, 1);
    assert!(!chunks[0].created_at.is_empty());
}

#[test]
fn split_text_chunks_preserve_overlap_metadata() {
    let book = BookRecord {
        id: "book-overlap".to_string(),
        title: "Overlap".to_string(),
        display_title: "Overlap".to_string(),
        author: "Local".to_string(),
        format: "TXT".to_string(),
        status: "已导入".to_string(),
        progress: 0,
        file_name: "overlap.txt".to_string(),
        file_path: "overlap.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "sage".to_string(),
        deleted: false,
        deleted_at: String::new(),
        content_hash: "hash-overlap".to_string(),
        imported_at: String::new(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    let text = [
        "第一章 起点",
        "甲".repeat(80).as_str(),
        "乙".repeat(80).as_str(),
        "丙".repeat(80).as_str(),
        "丁".repeat(80).as_str(),
        "第二章 后续",
        "戊".repeat(80).as_str(),
    ]
    .join("\n");

    let chunks = crate::search::split_text_into_chunks_with_options_and_cancel(
        &book,
        &text,
        crate::search::IndexChunkingOptions::new(200, 120, 2),
        || false,
    )
    .expect("chunk split should complete");

    assert_eq!(chunks.len(), 3);
    assert_eq!(chunks[0].id, "book-overlap:c0:p0-2:k0");
    assert_eq!(chunks[0].paragraph_start, 0);
    assert_eq!(chunks[0].paragraph_end, 2);
    assert_eq!(chunks[0].char_start, 0);
    assert_eq!(chunks[0].char_end, 240);
    assert_eq!(
        chunks[0].text,
        format!(
            "{}\n{}\n{}",
            "甲".repeat(80),
            "乙".repeat(80),
            "丙".repeat(80)
        )
    );
    assert_eq!(chunks[1].id, "book-overlap:c0:p2-3:k1");
    assert_eq!(chunks[1].paragraph_start, 2);
    assert_eq!(chunks[1].paragraph_end, 3);
    assert_eq!(chunks[1].char_start, 160);
    assert_eq!(chunks[1].char_end, 320);
    assert_eq!(
        chunks[1].text,
        format!("{}\n{}", "丙".repeat(80), "丁".repeat(80))
    );
    assert_eq!(chunks[2].id, "book-overlap:c1:p4-4:k2");
    assert_eq!(chunks[2].chapter_title, "第二章 后续");
    assert_eq!(chunks[2].paragraph_start, 4);
    assert_eq!(chunks[2].paragraph_end, 4);
    assert_eq!(chunks[2].char_start, 320);
    assert_eq!(chunks[2].char_end, 400);
    assert_eq!(chunks[2].text, "戊".repeat(80));
    assert_eq!(chunks[2].chunk_strategy_version, 2);
}

#[test]
fn split_text_chunks_large_chinese_input_avoids_repeated_buffer_scans() {
    let book = BookRecord {
        id: "book-large-chinese".to_string(),
        title: "Large Chinese".to_string(),
        display_title: "Large Chinese".to_string(),
        author: "Local".to_string(),
        format: "TXT".to_string(),
        status: "已导入".to_string(),
        progress: 0,
        file_name: "large.txt".to_string(),
        file_path: "large.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "sage".to_string(),
        deleted: false,
        deleted_at: String::new(),
        content_hash: "hash-large".to_string(),
        imported_at: String::new(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    let text = (0..128_000)
        .map(|index| {
            if index % 300 == 0 {
                format!("第{}章 性能", index / 300 + 1)
            } else {
                format!(
                    "{index:05}{}",
                    "这是一段用于索引性能回归测试的中文文本。".repeat(2)
                )
            }
        })
        .collect::<Vec<_>>()
        .join("\n");

    let started_at = Instant::now();
    let chunks = crate::search::split_text_into_chunks_with_options_and_cancel(
        &book,
        &text,
        crate::search::IndexChunkingOptions::new(1200, 120, 1),
        || false,
    )
    .expect("large chunk split should complete");
    let elapsed = started_at.elapsed();

    assert!(
        chunks.len() > 2_000,
        "large sample should produce many chunks"
    );
    assert!(
        elapsed < Duration::from_secs(3),
        "large Chinese chunking should stay near-linear; elapsed={elapsed:?}, chunks={}",
        chunks.len()
    );
}

#[test]
fn split_text_chunks_large_input_throttles_progress_callbacks() {
    let book = BookRecord {
        id: "book-progress".to_string(),
        title: "Progress".to_string(),
        display_title: "Progress".to_string(),
        author: "Local".to_string(),
        format: "TXT".to_string(),
        status: "已导入".to_string(),
        progress: 0,
        file_name: "progress.txt".to_string(),
        file_path: "progress.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "sage".to_string(),
        deleted: false,
        deleted_at: String::new(),
        content_hash: "hash-progress".to_string(),
        imported_at: String::new(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    let text = (0..128_000)
        .map(|index| {
            if index % 300 == 0 {
                format!("第{}章 进度", index / 300 + 1)
            } else {
                format!(
                    "{index:05}{}",
                    "这是一段用于索引进度节流测试的中文文本。".repeat(2)
                )
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    let mut callbacks = Vec::new();
    let chunks = crate::search::split_text_into_chunks_with_options_cancel_and_progress(
        &book,
        &text,
        crate::search::IndexChunkingOptions::new(1200, 120, 1),
        || false,
        |chunk_count, processed_lines, total_lines| {
            callbacks.push((chunk_count, processed_lines, total_lines));
        },
    )
    .expect("large chunk split should complete");

    assert!(
        chunks.len() > 2_000,
        "large sample should produce many chunks"
    );
    assert!(
        callbacks.len() <= 130,
        "progress should be throttled by input progress, not emitted per chunk; callbacks={}, chunks={}",
        callbacks.len(),
        chunks.len()
    );
    assert_eq!(
        callbacks.last().copied(),
        Some((chunks.len(), 128_000, 128_000))
    );
}

#[test]
fn split_text_chunks_large_input_throttles_stop_checks() {
    let book = BookRecord {
        id: "book-stop-checks".to_string(),
        title: "Stop Checks".to_string(),
        display_title: "Stop Checks".to_string(),
        author: "Local".to_string(),
        format: "TXT".to_string(),
        status: "已导入".to_string(),
        progress: 0,
        file_name: "stop-checks.txt".to_string(),
        file_path: "stop-checks.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "sage".to_string(),
        deleted: false,
        deleted_at: String::new(),
        content_hash: "hash-stop-checks".to_string(),
        imported_at: String::new(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    let text = (0..128_000)
        .map(|index| {
            if index % 300 == 0 {
                format!("第{}章 停止检查", index / 300 + 1)
            } else {
                format!(
                    "{index:05}{}",
                    "这是一段用于索引停止检查节流测试的中文文本。".repeat(2)
                )
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    let stop_checks = Cell::new(0usize);
    let chunks = crate::search::split_text_into_chunks_with_options_and_cancel(
        &book,
        &text,
        crate::search::IndexChunkingOptions::new(1200, 120, 1),
        || {
            stop_checks.set(stop_checks.get() + 1);
            false
        },
    )
    .expect("large chunk split should complete");

    assert!(
        chunks.len() > 2_000,
        "large sample should produce many chunks"
    );
    assert!(
        stop_checks.get() <= 1_100,
        "stop checks should be throttled because production checks read task state; stop_checks={}",
        stop_checks.get()
    );
}

#[test]
#[ignore]
fn split_text_chunks_real_book_fixture_reports_timing() {
    let path = std::env::var("BOOKMIND_REAL_INDEX_FIXTURE")
        .unwrap_or_else(|_| "E:\\个人项目\\精神病病院学斩神.txt".to_string());
    let content = read_book_content(std::path::Path::new(&path))
        .expect("real TXT fixture should be readable");
    let book = BookRecord {
        id: "book-real-fixture".to_string(),
        title: "Real Fixture".to_string(),
        display_title: "Real Fixture".to_string(),
        author: "Local".to_string(),
        format: "TXT".to_string(),
        status: "已导入".to_string(),
        progress: 0,
        file_name: "real.txt".to_string(),
        file_path: path,
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "sage".to_string(),
        deleted: false,
        deleted_at: String::new(),
        content_hash: "hash-real".to_string(),
        imported_at: String::new(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    let mut callback_count = 0usize;
    let started_at = Instant::now();
    let chunks = crate::search::split_text_into_chunks_with_options_cancel_and_progress(
        &book,
        &content,
        crate::search::IndexChunkingOptions::new(1200, 120, 1),
        || false,
        |_chunk_count, _processed_lines, _total_lines| {
            callback_count += 1;
        },
    )
    .expect("real fixture chunk split should complete");
    let elapsed = started_at.elapsed();

    println!(
        "real fixture bytes={} lines={} chunks={} progress_callbacks={} elapsed_ms={}",
        content.len(),
        content.lines().count(),
        chunks.len(),
        callback_count,
        elapsed.as_millis()
    );
    assert!(
        chunks.len() > 1_000,
        "real fixture should produce many chunks"
    );
    assert!(
        callback_count <= 130,
        "real fixture progress should stay throttled; callbacks={callback_count}, chunks={}",
        chunks.len()
    );
    assert!(
        elapsed < Duration::from_secs(5),
        "real fixture pure chunking should be fast after throttling; elapsed={elapsed:?}"
    );
}

#[test]
#[ignore]
fn save_fts_real_book_fixture_reports_timing() {
    let path = std::env::var("BOOKMIND_REAL_INDEX_FIXTURE")
        .unwrap_or_else(|_| "E:\\个人项目\\精神病病院学斩神.txt".to_string());
    let content = read_book_content(std::path::Path::new(&path))
        .expect("real TXT fixture should be readable");
    let book = BookRecord {
        id: "book-real-fts-fixture".to_string(),
        title: "Real FTS Fixture".to_string(),
        display_title: "Real FTS Fixture".to_string(),
        author: "Local".to_string(),
        format: "TXT".to_string(),
        status: "已导入".to_string(),
        progress: 0,
        file_name: "real.txt".to_string(),
        file_path: path,
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "sage".to_string(),
        deleted: false,
        deleted_at: String::new(),
        content_hash: "hash-real-fts".to_string(),
        imported_at: String::new(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    let chunks = crate::search::split_text_into_chunks_with_options_and_cancel(
        &book,
        &content,
        crate::search::IndexChunkingOptions::new(1200, 120, 1),
        || false,
    )
    .expect("real fixture chunk split should complete");
    let dir = unique_temp_library_dir();
    let mut progress_callbacks = 0usize;
    let started_at = Instant::now();
    crate::database::save_chunks_to_fts_with_progress(
        &dir,
        &book.id,
        &chunks,
        |_written, _total| {
            progress_callbacks += 1;
        },
    )
    .expect("real fixture FTS rows should save");
    let elapsed = started_at.elapsed();
    let rows = crate::database::count_book_fts_rows(&dir, &book.id)
        .expect("real fixture FTS rows should count");

    println!(
        "real fixture fts chunks={} rows={} progress_callbacks={} elapsed_ms={}",
        chunks.len(),
        rows,
        progress_callbacks,
        elapsed.as_millis()
    );
    assert_eq!(rows, chunks.len());
    assert!(progress_callbacks <= 120);
    assert!(
        elapsed < Duration::from_secs(4),
        "real fixture FTS write should not build duplicate FTS indexes; elapsed={elapsed:?}"
    );
}
