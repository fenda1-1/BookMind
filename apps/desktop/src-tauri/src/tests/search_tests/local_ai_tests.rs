use super::*;

#[test]
fn search_index_page_applies_limit_and_offset() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("分页搜索.txt");
    std::fs::write(
        &source,
        (1..=5)
            .map(|index| {
                format!(
                    "第{index}章 分页\n分页关键词 第{index} 条证据。{}",
                    "正文".repeat(400)
                )
            })
            .collect::<Vec<_>>()
            .join("\n"),
    )
    .expect("source txt should be written");

    import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    let first_page =
        search_index_page_in(&dir, "分页关键词", 2, 0).expect("first page should search");
    let second_page =
        search_index_page_in(&dir, "分页关键词", 2, 2).expect("second page should search");

    assert_eq!(first_page.len(), 2);
    assert_eq!(second_page.len(), 2);
    assert_ne!(first_page[0].chunk_id, second_page[0].chunk_id);
}

#[test]
fn search_index_page_payload_reports_total_matches() {
    let dir = unique_temp_library_dir();
    let records = (0..6)
        .map(|index| TextChunkRecord {
            id: format!("chunk-total-{index}"),
            book_id: "book-total".to_string(),
            book_title: "总数测试".to_string(),
            chapter: format!("第{}章", index + 1),
            ordinal: index,
            text: format!("总数关键词 出现在第{}段。", index + 1),
            chapter_index: index,
            chapter_title: format!("第{}章", index + 1),
            paragraph_start: index,
            paragraph_end: index + 1,
            ..TextChunkRecord::default()
        })
        .collect::<Vec<_>>();
    save_chunk_records(&dir, &records).expect("chunks should save");

    let page = search_index_page_payload_in(&dir, "总数关键词", 2, 2, None)
        .expect("search page payload should load");

    assert_eq!(page.total, 6);
    assert_eq!(page.limit, 2);
    assert_eq!(page.offset, 2);
    assert_eq!(page.results.len(), 2);
}

#[test]
fn chunk_records_are_saved_in_compact_dictionary_format() {
    let dir = unique_temp_library_dir();
    let records = vec![
        TextChunkRecord {
            id: "book-one:c1:p0:k0".to_string(),
            book_id: "book-one".to_string(),
            book_title: "第一本".to_string(),
            chapter: "第一章".to_string(),
            ordinal: 0,
            text: "共同章节 第一段。".to_string(),
            chapter_index: 1,
            chapter_title: "第一章".to_string(),
            paragraph_start: 0,
            paragraph_end: 0,
            char_start: 0,
            char_end: 8,
            content_hash: "hash-one".to_string(),
            chunk_strategy_version: 1,
            created_at: "1000".to_string(),
        },
        TextChunkRecord {
            id: "book-one:c1:p1:k1".to_string(),
            book_id: "book-one".to_string(),
            book_title: "第一本".to_string(),
            chapter: "第一章".to_string(),
            ordinal: 1,
            text: "共同章节 第二段。".to_string(),
            chapter_index: 1,
            chapter_title: "第一章".to_string(),
            paragraph_start: 1,
            paragraph_end: 1,
            char_start: 8,
            char_end: 16,
            content_hash: "hash-one".to_string(),
            chunk_strategy_version: 1,
            created_at: "1000".to_string(),
        },
    ];

    save_chunk_records(&dir, &records).expect("chunks should save");
    let raw = std::fs::read_to_string(
        dir.join("indexes")
            .join("bm25")
            .join("books")
            .join("book-one.chunks.json"),
    )
    .expect("compact book chunks file should be readable");
    let value: serde_json::Value = serde_json::from_str(&raw).expect("chunks JSON should parse");

    assert_eq!(value["schema"], "bookmind.text-chunks.compact.v1");
    assert!(
        value["books"]
            .as_array()
            .expect("books should be array")
            .len()
            < records.len()
    );
    assert!(
        value["chapters"]
            .as_array()
            .expect("chapters should be array")
            .len()
            < records.len()
    );
    assert!(value["chunks"][0].get("bookId").is_none());
    assert_eq!(
        load_chunk_records(&dir).expect("chunks should load"),
        records
    );
}

#[test]
fn chunk_records_are_sharded_by_book_on_save() {
    let dir = unique_temp_library_dir();
    let records = vec![
        TextChunkRecord {
            id: "book-a:c0:p0:k0".to_string(),
            book_id: "book-a".to_string(),
            book_title: "甲书".to_string(),
            chapter: "第一章".to_string(),
            ordinal: 0,
            text: "甲书正文。".to_string(),
            chapter_index: 0,
            chapter_title: "第一章".to_string(),
            content_hash: "hash-a".to_string(),
            chunk_strategy_version: 1,
            created_at: "1000".to_string(),
            ..TextChunkRecord::default()
        },
        TextChunkRecord {
            id: "book-b:c0:p0:k0".to_string(),
            book_id: "book-b".to_string(),
            book_title: "乙书".to_string(),
            chapter: "第一章".to_string(),
            ordinal: 0,
            text: "乙书正文。".to_string(),
            chapter_index: 0,
            chapter_title: "第一章".to_string(),
            content_hash: "hash-b".to_string(),
            chunk_strategy_version: 1,
            created_at: "1000".to_string(),
            ..TextChunkRecord::default()
        },
    ];

    save_chunk_records(&dir, &records).expect("sharded chunks should save");
    let manifest_raw = std::fs::read_to_string(crate::paths::chunk_file_path(&dir))
        .expect("chunk manifest should be readable");
    let manifest: serde_json::Value =
        serde_json::from_str(&manifest_raw).expect("chunk manifest JSON should parse");

    assert_eq!(manifest["schema"], "bookmind.text-chunks.manifest.v1");
    assert!(manifest.get("chunks").is_none());
    assert!(dir
        .join("indexes")
        .join("bm25")
        .join("books")
        .join("book-a.chunks.json")
        .exists());
    assert!(dir
        .join("indexes")
        .join("bm25")
        .join("books")
        .join("book-b.chunks.json")
        .exists());
    assert_eq!(
        load_chunk_records(&dir).expect("sharded chunks should load"),
        records
    );
}

#[test]
fn chunk_record_save_removes_stale_book_shards() {
    let dir = unique_temp_library_dir();
    let first = vec![
        TextChunkRecord {
            id: "book-a:c0:p0:k0".to_string(),
            book_id: "book-a".to_string(),
            book_title: "甲书".to_string(),
            text: "甲书正文。".to_string(),
            ..TextChunkRecord::default()
        },
        TextChunkRecord {
            id: "book-b:c0:p0:k0".to_string(),
            book_id: "book-b".to_string(),
            book_title: "乙书".to_string(),
            text: "乙书正文。".to_string(),
            ..TextChunkRecord::default()
        },
    ];
    let second = vec![first[0].clone()];
    save_chunk_records(&dir, &first).expect("initial shards should save");
    let removed_path = dir
        .join("indexes")
        .join("bm25")
        .join("books")
        .join("book-b.chunks.json");
    assert!(removed_path.exists());

    save_chunk_records(&dir, &second).expect("updated shards should save");

    assert!(!removed_path.exists());
    assert_eq!(
        load_chunk_records(&dir).expect("remaining chunks should load"),
        second
    );
}

#[test]
fn chunk_records_loader_keeps_legacy_array_compatibility() {
    let dir = unique_temp_library_dir();
    let records = vec![TextChunkRecord {
        id: "legacy-chunk-1".to_string(),
        book_id: "legacy-book".to_string(),
        book_title: "旧格式书籍".to_string(),
        chapter: "旧章节".to_string(),
        ordinal: 0,
        text: "旧数组格式仍然应该可读。".to_string(),
        chapter_index: 1,
        chapter_title: "旧章节".to_string(),
        paragraph_start: 0,
        paragraph_end: 0,
        char_start: 0,
        char_end: 12,
        content_hash: "legacy-hash".to_string(),
        chunk_strategy_version: 1,
        created_at: "1000".to_string(),
    }];
    let path = crate::paths::chunk_file_path(&dir);
    std::fs::create_dir_all(path.parent().expect("chunk file should have parent"))
        .expect("chunk dir should exist");
    std::fs::write(
        &path,
        serde_json::to_string_pretty(&records).expect("legacy chunks should serialize"),
    )
    .expect("legacy chunks should write");

    assert_eq!(
        load_chunk_records(&dir).expect("legacy chunks should load"),
        records
    );
}

#[test]
fn search_index_page_counts_single_cjk_literal_matches() {
    let dir = unique_temp_library_dir();
    let records = (0..4)
        .map(|index| TextChunkRecord {
            id: format!("chunk-cjk-{index}"),
            book_id: "book-cjk".to_string(),
            book_title: "单字搜索测试".to_string(),
            chapter: format!("第{}章", index + 1),
            ordinal: index,
            text: "的字在这段里应该按普通全文包含关系命中。".to_string(),
            chapter_index: index,
            chapter_title: format!("第{}章", index + 1),
            paragraph_start: index,
            paragraph_end: index + 1,
            ..TextChunkRecord::default()
        })
        .collect::<Vec<_>>();
    save_chunk_records(&dir, &records).expect("chunks should save");

    let page = search_index_page_payload_in(&dir, "的", 3, 0, None)
        .expect("single CJK literal search should load");

    assert_eq!(page.total, 4);
    assert_eq!(page.results.len(), 3);
}

#[test]
fn search_index_page_payload_can_filter_by_book_id() {
    let dir = unique_temp_library_dir();
    save_chunk_records(
        &dir,
        &[
            TextChunkRecord {
                id: "chunk-book-filter-1".to_string(),
                book_id: "book-one".to_string(),
                book_title: "第一本".to_string(),
                chapter: "第一章".to_string(),
                ordinal: 0,
                text: "共同关键词 在第一本书里出现。".to_string(),
                chapter_index: 0,
                chapter_title: "第一章".to_string(),
                paragraph_start: 0,
                paragraph_end: 0,
                ..TextChunkRecord::default()
            },
            TextChunkRecord {
                id: "chunk-book-filter-2".to_string(),
                book_id: "book-two".to_string(),
                book_title: "第二本".to_string(),
                chapter: "第一章".to_string(),
                ordinal: 0,
                text: "共同关键词 在第二本书里出现。".to_string(),
                chapter_index: 0,
                chapter_title: "第一章".to_string(),
                paragraph_start: 0,
                paragraph_end: 0,
                ..TextChunkRecord::default()
            },
        ],
    )
    .expect("chunks should save");

    let page = search_index_page_payload_in(&dir, "共同关键词", 20, 0, Some("book-two"))
        .expect("book filtered search should load");

    assert_eq!(page.total, 1);
    assert_eq!(page.results.len(), 1);
    assert_eq!(page.results[0].book_id, "book-two");
}

#[test]
fn search_index_page_uses_literal_search_for_cjk_with_punctuation() {
    let dir = unique_temp_library_dir();
    save_chunk_records(
        &dir,
        &[
            TextChunkRecord {
                id: "chunk-cjk-punct-1".to_string(),
                book_id: "book-cjk-punct".to_string(),
                book_title: "中文标点搜索测试".to_string(),
                chapter: "第一章".to_string(),
                ordinal: 0,
                text: "林七夜在大雨里意识到危险。".to_string(),
                chapter_index: 0,
                chapter_title: "第一章".to_string(),
                paragraph_start: 0,
                paragraph_end: 0,
                ..TextChunkRecord::default()
            },
            TextChunkRecord {
                id: "chunk-cjk-punct-2".to_string(),
                book_id: "book-cjk-punct".to_string(),
                book_title: "中文标点搜索测试".to_string(),
                chapter: "第二章".to_string(),
                ordinal: 1,
                text: "赵空城在雨幕中回头。".to_string(),
                chapter_index: 1,
                chapter_title: "第二章".to_string(),
                paragraph_start: 1,
                paragraph_end: 1,
                ..TextChunkRecord::default()
            },
        ],
    )
    .expect("chunks should save");

    let page = search_index_page_payload_in(&dir, "林七夜？", 20, 0, None)
        .expect("CJK search with punctuation should load");

    assert_eq!(page.total, 1);
    assert_eq!(page.results[0].chunk_id, "chunk-cjk-punct-1");
    assert!(page.results[0].snippet.contains("林七夜"));
}

#[test]
fn answers_with_citations_from_indexed_chunks() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("引用测试.txt");
    std::fs::write(&source, "第一章 阅读证据\n本地索引会记录关键概念和对应原文。\n第二章 复习卡片\n摘录可以生成复习问题。").expect("source txt should be written");

    import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    run_parse_and_index_tasks_in(&dir).expect("parse/index task should run");
    let response = answer_from_local_index_in(&dir, "关键概念").expect("local answer should work");

    assert!(response.answer.contains("关键概念"));
    assert_eq!(response.citations.len(), 1);
    assert_eq!(response.citations[0].label, "引用测试 · 第一章 阅读证据");
    assert!(response.citations[0].text.contains("关键概念"));
    assert!(response.citations[0].target_id.starts_with("book-"));
    assert!(response.citations[0].target_id.contains(":c"));
    assert!(response.citations[0].target_id.contains(":p"));
    assert_eq!(
        response.citations[0].chunk_id.as_deref(),
        Some(response.citations[0].target_id.as_str())
    );
    assert_eq!(response.citations[0].source_chapter_index, Some(0));
    assert_eq!(response.citations[0].paragraph_index, Some(0));
    assert!(response.citations[0].end_offset >= response.citations[0].start_offset);
}

#[test]
fn structured_ai_request_does_not_use_scope_prefix_as_query() {
    let dir = unique_temp_library_dir();
    crate::search::save_chunk_records(
        &dir,
        &[TextChunkRecord {
            id: "chunk-book-1-0".to_string(),
            book_id: "book-1".to_string(),
            book_title: "结构化请求测试".to_string(),
            chapter: "第一章".to_string(),
            ordinal: 0,
            text: "主角进入医院，夜晚的钟声第一次出现。".to_string(),
            ..TextChunkRecord::default()
        }],
    )
    .expect("chunk records should save");

    let response = crate::search::answer_from_ai_request_in(
        &dir,
        &AiRequestPayload {
            scope: "selection".to_string(),
            instruction: "请解释选区".to_string(),
            user_text: "请给出依据".to_string(),
            selected_command_id: None,
            retrieval_strategy: None,
            retrieval_query: Some("[selection] 钟声".to_string()),
            multi_stage_retrieval_mode: None,
            local_result_limit: None,
            citation_min_confidence: None,
            book_id: Some("book-1".to_string()),
            scope_text: None,
            scope_label: None,
            conversation_context: None,
            mode: Some("local".to_string()),
            interaction_mode: None,
            require_cloud_api: None,
            cloud_prompt_mode: None,
            cloud_response_format: None,
            request_id: None,
        },
    )
    .expect("structured local answer should work");

    assert_eq!(response.citations.len(), 1);
    assert!(!response.answer.contains("[selection]"));
    assert!(response
        .answer
        .contains("\"schema\":\"bookmind.ai.response.v2\""));
    assert!(!response.answer.contains("retrieval query"));
}

#[test]
fn chapter_summary_uses_scope_text_when_keyword_retrieval_is_weak() {
    let dir = unique_temp_library_dir();
    crate::search::save_chunk_records(
        &dir,
        &[TextChunkRecord {
            id: "chunk-book-2-0".to_string(),
            book_id: "book-2".to_string(),
            book_title: "章节兜底测试".to_string(),
            chapter: "第一章 初见".to_string(),
            ordinal: 0,
            text: "林七夜在雨夜抵达病院，医生记录了他的异常反应。".to_string(),
            ..TextChunkRecord::default()
        }],
    )
    .expect("chunk records should save");

    let response = crate::search::answer_from_ai_request_in(
        &dir,
        &AiRequestPayload {
            scope: "chapter".to_string(),
            instruction: "请总结当前章节的主要事件、信息增量、角色状态变化，并给出可回跳的引用依据。".to_string(),
            user_text: "请用三点总结".to_string(),
            selected_command_id: Some("summary".to_string()),
            retrieval_strategy: None,
            retrieval_query: None,
            multi_stage_retrieval_mode: None,
            local_result_limit: None,
            citation_min_confidence: None,
            book_id: Some("book-2".to_string()),
            scope_text: Some("林七夜在雨夜抵达病院，医生记录了他的异常反应。墙上的钟声突然停止，角色状态从迷茫转为警觉。".to_string()),
            scope_label: Some("第一章 初见".to_string()),
            conversation_context: None,
            mode: Some("local".to_string()),
            interaction_mode: None,
            require_cloud_api: None,
            cloud_prompt_mode: None,
            cloud_response_format: None,
            request_id: None,
        },
    )
    .expect("chapter summary fallback should work");

    assert_ne!(response.citations.len(), 0);
    assert!(!response.answer.contains("暂未找到"));
    assert!(response
        .answer
        .contains("\"schema\":\"bookmind.ai.response.v2\""));
    assert!(!response.answer.contains("关键词召回不足"));
    assert!(!response.answer.contains("scope fallback"));
    assert!(response.answer.contains("林七夜") || response.answer.contains("病院"));
    assert!(response.diagnostics.fallback_used);
    assert!(response
        .diagnostics
        .recommendations
        .iter()
        .any(|item| item.contains("当前范围正文")));
}

#[test]
fn freeform_chapter_feeling_question_returns_structured_reader_response() {
    let dir = unique_temp_library_dir();
    crate::search::save_chunk_records(
        &dir,
        &[TextChunkRecord {
            id: "chunk-book-feeling-0".to_string(),
            book_id: "book-feeling".to_string(),
            book_title: "章节感想测试".to_string(),
            chapter: "第二十四章 大雨".to_string(),
            ordinal: 0,
            text: "赵空城在大雨里独自迎向鬼面王，林七夜意识到危险后冲出家门。雨声压住了家庭晚饭的温度，也把守夜人的孤勇推到台前。".to_string(),
            ..TextChunkRecord::default()
        }],
    )
    .expect("chunk records should save");

    let response = crate::search::answer_from_ai_request_in(
        &dir,
        &AiRequestPayload {
            scope: "chapter".to_string(),
            instruction: "当前章节你感觉怎么样".to_string(),
            user_text: String::new(),
            selected_command_id: None,
            retrieval_strategy: Some("scope-first".to_string()),
            retrieval_query: Some("当前章节你感觉怎么样".to_string()),
            multi_stage_retrieval_mode: None,
            local_result_limit: None,
            citation_min_confidence: None,
            book_id: Some("book-feeling".to_string()),
            scope_text: Some("赵空城在大雨里独自迎向鬼面王，林七夜意识到危险后冲出家门。雨声压住了家庭晚饭的温度，也把守夜人的孤勇推到台前。".to_string()),
            scope_label: Some("第二十四章 大雨".to_string()),
            conversation_context: None,
            mode: Some("local".to_string()),
            interaction_mode: None,
            require_cloud_api: None,
            cloud_prompt_mode: None,
            cloud_response_format: None,
            request_id: None,
        },
    )
    .expect("freeform chapter feeling answer should work");

    assert!(response
        .answer
        .contains("\"schema\":\"bookmind.ai.response.v2\""));
    assert!(response.answer.contains("第二十四章 大雨"));
    assert!(response.answer.contains("整体感觉"));
    assert!(response.answer.contains("赵空城") || response.answer.contains("林七夜"));
    assert!(!response.answer.contains("Markdown 兜底回答"));
    assert!(!response.answer.contains("严格本地模式"));
    assert!(!response.answer.contains("检索 query"));
    assert!(!response.answer.contains("证据摘要"));
    assert!(response.diagnostics.fallback_used);
    assert_ne!(response.citations.len(), 0);
}

#[test]
fn scope_first_retrieval_strategy_prefers_scope_text_over_keyword_hits() {
    let dir = unique_temp_library_dir();
    crate::search::save_chunk_records(
        &dir,
        &[TextChunkRecord {
            id: "chunk-book-2-strategy-0".to_string(),
            book_id: "book-2-strategy".to_string(),
            book_title: "策略测试".to_string(),
            chapter: "第二章 旁支".to_string(),
            ordinal: 0,
            text: "关键词命中的是旁支章节，不应覆盖当前章总结范围。".to_string(),
            ..TextChunkRecord::default()
        }],
    )
    .expect("chunk records should save");

    let response = crate::search::answer_from_ai_request_in(
        &dir,
        &AiRequestPayload {
            scope: "chapter".to_string(),
            instruction: "请总结当前章节的主要事件。".to_string(),
            user_text: String::new(),
            selected_command_id: Some("summary".to_string()),
            retrieval_strategy: Some("scope-first".to_string()),
            retrieval_query: Some("关键词".to_string()),
            multi_stage_retrieval_mode: None,
            local_result_limit: None,
            citation_min_confidence: None,
            book_id: Some("book-2-strategy".to_string()),
            scope_text: Some("当前章正文讲述林七夜进入病院并听见钟声停止。".to_string()),
            scope_label: Some("第一章 当前".to_string()),
            conversation_context: None,
            mode: Some("local".to_string()),
            interaction_mode: None,
            require_cloud_api: None,
            cloud_prompt_mode: None,
            cloud_response_format: None,
            request_id: None,
        },
    )
    .expect("scope-first retrieval should answer from scope text");

    assert_eq!(response.citations[0].target_id, "scope-chapter");
    assert!(response.diagnostics.fallback_used);
    assert!(response.answer.contains("林七夜") || response.answer.contains("钟声"));
}

#[test]
fn multi_stage_retrieval_supplements_keyword_results_with_scope_evidence() {
    let dir = unique_temp_library_dir();
    crate::search::save_chunk_records(
        &dir,
        &[
            TextChunkRecord {
                id: "multi-stage-keyword-hit".to_string(),
                book_id: "book-multi-stage".to_string(),
                book_title: "多阶段检索测试".to_string(),
                chapter: "第一章 当前".to_string(),
                ordinal: 0,
                text: "关键词钟声只在这一段命中，用于形成第一阶段结果。".to_string(),
                ..TextChunkRecord::default()
            },
            TextChunkRecord {
                id: "multi-stage-unmatched".to_string(),
                book_id: "book-multi-stage".to_string(),
                book_title: "多阶段检索测试".to_string(),
                chapter: "第二章 旁支".to_string(),
                ordinal: 1,
                text: "旁支段落不包含目标关键词。".to_string(),
                ..TextChunkRecord::default()
            },
        ],
    )
    .expect("chunk records should save");

    let basic = crate::search::answer_from_ai_request_in(
        &dir,
        &AiRequestPayload {
            scope: "chapter".to_string(),
            instruction: "请解释钟声线索和当前章上下文。".to_string(),
            user_text: String::new(),
            selected_command_id: None,
            retrieval_strategy: Some("entity-extraction".to_string()),
            retrieval_query: Some("钟声".to_string()),
            multi_stage_retrieval_mode: Some("auto".to_string()),
            local_result_limit: Some("3".to_string()),
            citation_min_confidence: None,
            book_id: Some("book-multi-stage".to_string()),
            scope_text: Some(
                "当前章正文补充：林七夜在病院停步，医生的病历让他意识到钟声背后另有线索。"
                    .to_string(),
            ),
            scope_label: Some("第一章 当前".to_string()),
            conversation_context: None,
            mode: Some("local".to_string()),
            interaction_mode: None,
            require_cloud_api: None,
            cloud_prompt_mode: None,
            cloud_response_format: None,
            request_id: None,
        },
    )
    .expect("basic multi-stage retrieval should work");

    assert_eq!(basic.diagnostics.result_count, 2);
    assert!(basic
        .citations
        .iter()
        .any(|citation| citation.target_id == "multi-stage-keyword-hit"));
    assert!(basic
        .citations
        .iter()
        .any(|citation| citation.target_id == "scope-chapter"));

    let off = crate::search::answer_from_ai_request_in(
        &dir,
        &AiRequestPayload {
            scope: "chapter".to_string(),
            instruction: "请解释钟声线索和当前章上下文。".to_string(),
            user_text: String::new(),
            selected_command_id: None,
            retrieval_strategy: Some("entity-extraction".to_string()),
            retrieval_query: Some("钟声".to_string()),
            multi_stage_retrieval_mode: Some("off".to_string()),
            local_result_limit: Some("3".to_string()),
            citation_min_confidence: None,
            book_id: Some("book-multi-stage".to_string()),
            scope_text: Some(
                "当前章正文补充：林七夜在病院停步，医生的病历让他意识到钟声背后另有线索。"
                    .to_string(),
            ),
            scope_label: Some("第一章 当前".to_string()),
            conversation_context: None,
            mode: Some("local".to_string()),
            interaction_mode: None,
            require_cloud_api: None,
            cloud_prompt_mode: None,
            cloud_response_format: None,
            request_id: None,
        },
    )
    .expect("disabled multi-stage retrieval should work");

    assert_eq!(off.diagnostics.result_count, 1);
    assert!(off
        .citations
        .iter()
        .all(|citation| citation.target_id != "scope-chapter"));
}

#[test]
fn local_ai_result_limit_controls_search_and_scope_fallback_results() {
    let dir = unique_temp_library_dir();
    let chunks = (0..5)
        .map(|index| TextChunkRecord {
            id: format!("limit-chunk-{index}"),
            book_id: "book-limit".to_string(),
            book_title: "结果数量测试".to_string(),
            chapter: if index < 4 {
                "第一章 当前".to_string()
            } else {
                "第二章 旁支".to_string()
            },
            ordinal: index,
            text: format!(
                "共同关键词出现在第{}段，用于验证本地 AI 结果数量。",
                index + 1
            ),
            ..TextChunkRecord::default()
        })
        .collect::<Vec<_>>();
    crate::search::save_chunk_records(&dir, &chunks).expect("chunk records should save");

    let search_limited = crate::search::answer_from_ai_request_in(
        &dir,
        &AiRequestPayload {
            scope: "book".to_string(),
            instruction: "查找共同关键词".to_string(),
            user_text: String::new(),
            selected_command_id: None,
            retrieval_strategy: None,
            retrieval_query: Some("共同关键词".to_string()),
            multi_stage_retrieval_mode: None,
            local_result_limit: Some("2".to_string()),
            citation_min_confidence: None,
            book_id: Some("book-limit".to_string()),
            scope_text: None,
            scope_label: None,
            conversation_context: None,
            mode: Some("local".to_string()),
            interaction_mode: None,
            require_cloud_api: None,
            cloud_prompt_mode: None,
            cloud_response_format: None,
            request_id: None,
        },
    )
    .expect("limited search should work");
    assert_eq!(search_limited.diagnostics.result_count, 2);

    let fallback_limited = crate::search::answer_from_ai_request_in(
        &dir,
        &AiRequestPayload {
            scope: "chapter".to_string(),
            instruction: "请总结当前章节。".to_string(),
            user_text: String::new(),
            selected_command_id: Some("summary".to_string()),
            retrieval_strategy: Some("scope-first".to_string()),
            retrieval_query: Some("共同关键词".to_string()),
            multi_stage_retrieval_mode: None,
            local_result_limit: Some("4".to_string()),
            citation_min_confidence: None,
            book_id: Some("book-limit".to_string()),
            scope_text: None,
            scope_label: Some("第一章 当前".to_string()),
            conversation_context: None,
            mode: Some("local".to_string()),
            interaction_mode: None,
            require_cloud_api: None,
            cloud_prompt_mode: None,
            cloud_response_format: None,
            request_id: None,
        },
    )
    .expect("limited scope fallback should work");
    assert_eq!(fallback_limited.diagnostics.result_count, 4);

    let invalid_limit = crate::search::answer_from_ai_request_in(
        &dir,
        &AiRequestPayload {
            scope: "book".to_string(),
            instruction: "查找共同关键词".to_string(),
            user_text: String::new(),
            selected_command_id: None,
            retrieval_strategy: None,
            retrieval_query: Some("共同关键词".to_string()),
            multi_stage_retrieval_mode: None,
            local_result_limit: Some("not-a-number".to_string()),
            citation_min_confidence: None,
            book_id: Some("book-limit".to_string()),
            scope_text: None,
            scope_label: None,
            conversation_context: None,
            mode: Some("local".to_string()),
            interaction_mode: None,
            require_cloud_api: None,
            cloud_prompt_mode: None,
            cloud_response_format: None,
            request_id: None,
        },
    )
    .expect("invalid limit should fall back to default");
    assert_eq!(invalid_limit.diagnostics.result_count, 5);
}

#[test]
fn long_chapter_summary_segments_scope_text() {
    let dir = unique_temp_library_dir();
    let long_scope = (0..36)
        .map(|index| {
            format!(
                "第{}段 林七夜继续调查病院线索，记录钟声、病历和守夜人的变化。",
                index + 1
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    let response = crate::search::answer_from_ai_request_in(
        &dir,
        &AiRequestPayload {
            scope: "chapter".to_string(),
            instruction: "请总结当前章节的主要事件。".to_string(),
            user_text: "请分段概括".to_string(),
            selected_command_id: Some("summary".to_string()),
            retrieval_strategy: Some("scope-first".to_string()),
            retrieval_query: None,
            multi_stage_retrieval_mode: None,
            local_result_limit: None,
            citation_min_confidence: None,
            book_id: Some("book-long-chapter".to_string()),
            scope_text: Some(long_scope),
            scope_label: Some("超长章节".to_string()),
            conversation_context: None,
            mode: Some("local".to_string()),
            interaction_mode: None,
            require_cloud_api: None,
            cloud_prompt_mode: None,
            cloud_response_format: None,
            request_id: None,
        },
    )
    .expect("long chapter summary should segment scope text");

    assert!(response.citations.len() >= 3);
    assert!(response
        .citations
        .iter()
        .all(|citation| citation.target_id.starts_with("scope-chapter-segment-")));
    assert!(response.answer.contains("分段摘要"));
    assert!(response.answer.contains("第1段"));
    assert!(response
        .citations
        .iter()
        .any(|citation| citation.target_id == "scope-chapter-segment-3"));
}

#[test]
fn local_ai_no_result_returns_structured_diagnostics() {
    let dir = unique_temp_library_dir();
    crate::search::save_chunk_records(
        &dir,
        &[TextChunkRecord {
            id: "chunk-book-3-0".to_string(),
            book_id: "book-3".to_string(),
            book_title: "诊断测试".to_string(),
            chapter: "第一章".to_string(),
            ordinal: 0,
            text: "这里没有目标关键词。".to_string(),
            ..TextChunkRecord::default()
        }],
    )
    .expect("chunk records should save");

    let response = crate::search::answer_from_ai_request_in(
        &dir,
        &AiRequestPayload {
            scope: "book".to_string(),
            instruction: "检索不存在的线索".to_string(),
            user_text: String::new(),
            selected_command_id: None,
            retrieval_strategy: None,
            retrieval_query: Some("完全不存在的关键词".to_string()),
            multi_stage_retrieval_mode: None,
            local_result_limit: None,
            citation_min_confidence: None,
            book_id: Some("book-3".to_string()),
            scope_text: None,
            scope_label: None,
            conversation_context: None,
            mode: Some("local".to_string()),
            interaction_mode: None,
            require_cloud_api: None,
            cloud_prompt_mode: None,
            cloud_response_format: None,
            request_id: None,
        },
    )
    .expect("local answer should return diagnostics");

    assert_eq!(response.citations.len(), 0);
    assert!(response.diagnostics.query_used.contains("完全不存在"));
    assert_eq!(response.diagnostics.scope, "book");
    assert_eq!(response.diagnostics.chunk_count, 1);
    assert!(response
        .diagnostics
        .recommendations
        .iter()
        .any(|item| item.contains("当前章全文")));
}

#[test]
fn local_ai_request_can_be_cancelled_by_request_id() {
    let dir = unique_temp_library_dir();
    let request_id = "ai-cancel-test".to_string();
    cancel_local_ai_request(&request_id);

    let result = answer_from_ai_request_in(
        &dir,
        &AiRequestPayload {
            scope: "book".to_string(),
            instruction: "请总结".to_string(),
            user_text: String::new(),
            selected_command_id: None,
            retrieval_strategy: None,
            retrieval_query: Some("关键词".to_string()),
            multi_stage_retrieval_mode: None,
            local_result_limit: None,
            citation_min_confidence: None,
            book_id: Some("book-cancel".to_string()),
            scope_text: None,
            scope_label: None,
            conversation_context: None,
            mode: Some("local".to_string()),
            interaction_mode: None,
            require_cloud_api: None,
            cloud_prompt_mode: None,
            cloud_response_format: None,
            request_id: Some(request_id),
        },
    );

    assert_eq!(
        result.expect_err("cancelled local request should stop"),
        "AI 请求已停止"
    );
}
