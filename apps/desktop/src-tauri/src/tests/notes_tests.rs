use crate::models::{
    AiGeneratedFlashcardRequest, AiNoteMetadataPayload, CitationPayload, ReaderLocationPayload,
};
use crate::notes::{
    export_knowledge_markdown_in, export_knowledge_markdown_with_options_in,
    generate_flashcards_from_highlights_in, generate_flashcards_from_highlights_with_defaults_in,
    load_flashcard_records, load_highlight_records, load_note_records,
    save_ai_generated_flashcards_in, save_ai_note_in, save_highlight_in,
};
use crate::paths::notes_file_path;

use super::common::*;

#[test]
fn saves_ai_answer_as_note_with_citations() {
    let dir = unique_temp_library_dir();
    let citation = CitationPayload {
        id: 1,
        label: "引用测试 · 第一章".to_string(),
        text: "这是一条可追溯到原文的 AI 回答证据。".to_string(),
        target_id: "chunk-book-1-0".to_string(),
        book_id: None,
        chunk_id: None,
        chapter_id: None,
        source_chapter_index: None,
        paragraph_index: None,
        start_offset: None,
        end_offset: None,
        confidence: None,
    };

    let saved = save_ai_note_in(
        &dir,
        "阅读证据",
        "AI 回答正文",
        &[citation.clone()],
        None,
        None,
        None,
        None,
    )
    .expect("note should save");
    let notes = load_note_records(&dir).expect("notes should load");

    assert_eq!(notes.len(), 1);
    assert_eq!(notes[0].id, saved.id);
    assert_eq!(notes[0].title, "阅读证据");
    assert_eq!(notes[0].body, "AI 回答正文");
    assert_eq!(notes[0].citations, vec![citation]);
    assert!(notes[0].reader_location.is_none());
}

#[test]
fn saves_ai_note_with_default_save_target() {
    let dir = unique_temp_library_dir();

    let saved = save_ai_note_in(
        &dir,
        "默认位置",
        "AI 回答正文",
        &[],
        Some("book".to_string()),
        None,
        None,
        None,
    )
    .expect("note should save with target");
    let notes = load_note_records(&dir).expect("notes should load");

    assert_eq!(saved.save_target.as_deref(), Some("book"));
    assert_eq!(notes[0].save_target.as_deref(), Some("book"));
}

#[test]
fn ignores_invalid_ai_note_save_target() {
    let dir = unique_temp_library_dir();

    let saved = save_ai_note_in(
        &dir,
        "非法位置",
        "AI 回答正文",
        &[],
        Some("archive".to_string()),
        None,
        None,
        None,
    )
    .expect("note should save without invalid target");
    let notes = load_note_records(&dir).expect("notes should load");

    assert!(saved.save_target.is_none());
    assert!(notes[0].save_target.is_none());
}

#[test]
fn saves_ai_answer_as_note_with_reader_location() {
    let dir = unique_temp_library_dir();
    let location = ReaderLocationPayload {
        book_id: "book-1".to_string(),
        chapter_id: Some("reader-chapter-1".to_string()),
        source_chapter_index: Some(1),
        paragraph_index: Some(2),
        start_offset: Some(3),
        end_offset: Some(4),
    };

    let saved = save_ai_note_in(
        &dir,
        "阅读现场",
        "AI 回答正文",
        &[],
        None,
        Some(location.clone()),
        None,
        None,
    )
    .expect("note should save with reader location");
    let notes = load_note_records(&dir).expect("notes should load");

    assert_eq!(notes[0].id, saved.id);
    assert_eq!(notes[0].reader_location, Some(location));
}

#[test]
fn saves_ai_answer_as_note_with_request_metadata() {
    let dir = unique_temp_library_dir();
    let citation = CitationPayload {
        id: 1,
        label: "引用测试 · 第一章".to_string(),
        text: "这是一条需要沉淀的原文证据。".to_string(),
        target_id: "chunk-book-1-0".to_string(),
        book_id: None,
        chunk_id: None,
        chapter_id: None,
        source_chapter_index: None,
        paragraph_index: None,
        start_offset: None,
        end_offset: None,
        confidence: None,
    };
    let metadata = AiNoteMetadataPayload {
        instruction: "总结本章".to_string(),
        scope: "chapter".to_string(),
        user_text: "请用三点总结".to_string(),
        selected_command_id: Some("summary".to_string()),
        retrieval_strategy: Some("scope-first".to_string()),
        retrieval_query: Some("三点总结".to_string()),
        multi_stage_retrieval_mode: None,
        model: "local-index".to_string(),
        saved_at: "123456789".to_string(),
        schema: None,
        mode: None,
        interaction_mode: None,
        generated_at: None,
        citation_coverage: None,
        book_range: None,
    };

    let saved = save_ai_note_in(
        &dir,
        "阅读证据",
        "AI 回答正文",
        &[citation.clone()],
        None,
        None,
        Some(metadata.clone()),
        None,
    )
    .expect("note should save");
    let notes = load_note_records(&dir).expect("notes should load");

    assert_eq!(saved.ai_metadata, Some(metadata.clone()));
    assert_eq!(notes[0].ai_metadata, Some(metadata));
    assert_eq!(notes[0].citations, vec![citation]);
}

#[test]
fn saves_ai_notes_to_encrypted_storage_while_loading_plain_records() {
    let dir = unique_temp_library_dir();
    let citation = CitationPayload {
        id: 1,
        label: "秘密引用标签".to_string(),
        text: "秘密引用原文".to_string(),
        target_id: "chunk-secret-1".to_string(),
        book_id: Some("book-secret".to_string()),
        chunk_id: Some("chunk-secret-1".to_string()),
        chapter_id: Some("chapter-secret".to_string()),
        source_chapter_index: Some(0),
        paragraph_index: Some(1),
        start_offset: Some(2),
        end_offset: Some(3),
        confidence: Some(0.91),
    };
    let metadata = AiNoteMetadataPayload {
        instruction: "秘密指令".to_string(),
        scope: "chapter".to_string(),
        user_text: "秘密用户问题".to_string(),
        selected_command_id: Some("summary".to_string()),
        retrieval_strategy: Some("scope-first".to_string()),
        retrieval_query: Some("秘密检索词".to_string()),
        multi_stage_retrieval_mode: Some("auto".to_string()),
        model: "secret-model".to_string(),
        saved_at: "2026-06-09T00:00:00.000Z".to_string(),
        schema: Some("bookmind.ai.response.v2".to_string()),
        mode: Some("cloud".to_string()),
        interaction_mode: None,
        generated_at: Some("2026-06-09T00:00:00.000Z".to_string()),
        citation_coverage: Some("1 citations / 1 blocks".to_string()),
        book_range: Some("秘密章节范围".to_string()),
    };
    let structured = serde_json::json!({
        "schema": "bookmind.ai.response.v2",
        "summary": { "秘密标题": ["秘密结构化内容"] }
    });

    save_ai_note_in(
        &dir,
        "秘密笔记标题",
        "秘密笔记正文",
        &[citation.clone()],
        None,
        None,
        Some(metadata.clone()),
        Some(structured.clone()),
    )
    .expect("note should save");

    let raw =
        std::fs::read_to_string(notes_file_path(&dir)).expect("notes file should be readable");
    assert!(raw.contains("\"encrypted\": true"));
    assert!(raw.contains("\"algorithm\": \"local-envelope-v1\""));
    for secret in [
        "秘密笔记标题",
        "秘密笔记正文",
        "秘密引用标签",
        "秘密引用原文",
        "秘密指令",
        "秘密用户问题",
        "秘密检索词",
        "secret-model",
        "秘密结构化内容",
    ] {
        assert!(
            !raw.contains(secret),
            "encrypted notes file must not contain plaintext secret: {secret}"
        );
    }

    let notes = load_note_records(&dir).expect("encrypted notes should load");
    assert_eq!(notes.len(), 1);
    assert_eq!(notes[0].title, "秘密笔记标题");
    assert_eq!(notes[0].body, "秘密笔记正文");
    assert_eq!(notes[0].citations, vec![citation]);
    assert_eq!(notes[0].ai_metadata, Some(metadata));
    assert_eq!(notes[0].structured_response, Some(structured));

    let export_path = export_knowledge_markdown_with_options_in(&dir, true, true, None)
        .expect("encrypted notes export");
    let markdown = std::fs::read_to_string(export_path).expect("markdown should read");
    assert!(markdown.contains("秘密笔记标题"));
    assert!(markdown.contains("秘密笔记正文"));
    assert!(markdown.contains("secret-model"));
    assert!(markdown.contains("秘密结构化内容"));
}

#[test]
fn loading_legacy_plain_notes_reencrypts_notes_file() {
    let dir = unique_temp_library_dir();
    let path = notes_file_path(&dir);
    std::fs::create_dir_all(path.parent().expect("notes path should have parent"))
        .expect("notes dir should be created");
    let legacy_note = serde_json::json!([{
        "id": "note-legacy-1",
        "title": "旧版明文标题",
        "body": "旧版明文正文",
        "source": "ai-reader",
        "createdAt": "2026-06-09T00:00:00.000Z",
        "citations": [],
        "aiMetadata": {
            "instruction": "旧版明文指令",
            "scope": "chapter",
            "userText": "旧版明文问题",
            "model": "legacy-model",
            "savedAt": "2026-06-09T00:00:00.000Z"
        }
    }]);
    std::fs::write(
        &path,
        serde_json::to_string_pretty(&legacy_note).expect("legacy note should serialize"),
    )
    .expect("legacy notes should write");

    let loaded = load_note_records(&dir).expect("legacy notes should load");
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0].title, "旧版明文标题");
    assert_eq!(loaded[0].body, "旧版明文正文");
    assert_eq!(
        loaded[0]
            .ai_metadata
            .as_ref()
            .map(|metadata| metadata.model.as_str()),
        Some("legacy-model")
    );

    let migrated = std::fs::read_to_string(&path).expect("migrated notes should read");
    assert!(migrated.contains("\"encrypted\": true"));
    assert!(!migrated.contains("旧版明文标题"));
    assert!(!migrated.contains("旧版明文正文"));
    assert!(!migrated.contains("旧版明文指令"));
    assert!(!migrated.contains("旧版明文问题"));
    assert!(!migrated.contains("legacy-model"));
}

#[test]
fn saves_citation_as_highlight() {
    let dir = unique_temp_library_dir();
    let citation = CitationPayload {
        id: 1,
        label: "引用测试 · 第一章".to_string(),
        text: "这是一条需要沉淀的原文证据。".to_string(),
        target_id: "chunk-book-1-0".to_string(),
        book_id: None,
        chunk_id: None,
        chapter_id: None,
        source_chapter_index: None,
        paragraph_index: None,
        start_offset: None,
        end_offset: None,
        confidence: None,
    };

    let saved = save_highlight_in(&dir, &citation).expect("highlight should save");
    let highlights = load_highlight_records(&dir).expect("highlights should load");

    assert_eq!(highlights.len(), 1);
    assert_eq!(highlights[0].id, saved.id);
    assert_eq!(highlights[0].label, citation.label);
    assert_eq!(highlights[0].text, citation.text);
    assert_eq!(highlights[0].target_id, citation.target_id);
}

#[test]
fn generates_flashcards_from_highlights() {
    let dir = unique_temp_library_dir();
    let citation = CitationPayload {
        id: 1,
        label: "引用测试 · 第一章".to_string(),
        text: "本地索引会记录关键概念和对应原文。".to_string(),
        target_id: "chunk-book-1-0".to_string(),
        book_id: None,
        chunk_id: None,
        chapter_id: None,
        source_chapter_index: None,
        paragraph_index: None,
        start_offset: None,
        end_offset: None,
        confidence: None,
    };
    save_highlight_in(&dir, &citation).expect("highlight should save");

    let generated =
        generate_flashcards_from_highlights_in(&dir).expect("flashcards should generate");
    let loaded = load_flashcard_records(&dir).expect("flashcards should load");

    assert_eq!(generated.len(), 1);
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0].front, "引用测试 · 第一章");
    assert!(loaded[0].back.contains("关键概念"));
    assert_eq!(loaded[0].source_target_id, "chunk-book-1-0");
}

#[test]
fn highlights_and_flashcards_are_encrypted_at_rest_and_legacy_files_migrate() {
    let dir = unique_temp_library_dir();
    let citation = CitationPayload {
        id: 1,
        label: "秘密高亮标签".to_string(),
        text: "秘密高亮原文".to_string(),
        target_id: "chunk-secret-highlight".to_string(),
        book_id: None,
        chunk_id: None,
        chapter_id: None,
        source_chapter_index: None,
        paragraph_index: None,
        start_offset: None,
        end_offset: None,
        confidence: None,
    };
    save_highlight_in(&dir, &citation).expect("highlight should save encrypted");
    let highlights_raw =
        std::fs::read_to_string(crate::paths::highlights_file_path(&dir)).expect("highlights file");
    assert!(highlights_raw.contains("\"encrypted\": true"));
    assert!(!highlights_raw.contains("秘密高亮标签"));
    assert!(!highlights_raw.contains("秘密高亮原文"));

    generate_flashcards_from_highlights_in(&dir).expect("flashcards should generate encrypted");
    let flashcards_raw =
        std::fs::read_to_string(crate::paths::flashcards_file_path(&dir)).expect("flashcards file");
    assert!(flashcards_raw.contains("\"encrypted\": true"));
    assert!(!flashcards_raw.contains("秘密高亮标签"));
    assert!(!flashcards_raw.contains("秘密高亮原文"));
    assert_eq!(
        load_flashcard_records(&dir)
            .expect("flashcards should decrypt")
            .first()
            .map(|card| card.back.as_str()),
        Some("秘密高亮原文")
    );

    let legacy_dir = unique_temp_library_dir();
    let legacy_highlights_path = crate::paths::highlights_file_path(&legacy_dir);
    std::fs::create_dir_all(legacy_highlights_path.parent().expect("highlights parent"))
        .expect("legacy highlights dir");
    std::fs::write(
        &legacy_highlights_path,
        r#"[{"id":"highlight-legacy","label":"旧版摘录标签","text":"旧版摘录正文","targetId":"legacy-target","createdAt":"2026"}]"#,
    )
    .expect("legacy highlights should write");
    assert_eq!(
        load_highlight_records(&legacy_dir)
            .expect("legacy highlights should load")
            .first()
            .map(|highlight| highlight.text.as_str()),
        Some("旧版摘录正文")
    );
    let migrated_highlights =
        std::fs::read_to_string(&legacy_highlights_path).expect("migrated highlights");
    assert!(migrated_highlights.contains("\"encrypted\": true"));
    assert!(!migrated_highlights.contains("旧版摘录正文"));

    let legacy_flashcards_path = crate::paths::flashcards_file_path(&legacy_dir);
    std::fs::write(
        &legacy_flashcards_path,
        r#"[{"id":"flashcard-legacy","front":"旧版问题","back":"旧版答案","sourceLabel":"旧版来源","sourceTargetId":"legacy-target","createdAt":"2026","tags":[],"citationIds":[],"reviewStatus":"new"}]"#,
    )
    .expect("legacy flashcards should write");
    assert_eq!(
        load_flashcard_records(&legacy_dir)
            .expect("legacy flashcards should load")
            .first()
            .map(|card| card.back.as_str()),
        Some("旧版答案")
    );
    let migrated_flashcards =
        std::fs::read_to_string(&legacy_flashcards_path).expect("migrated flashcards");
    assert!(migrated_flashcards.contains("\"encrypted\": true"));
    assert!(!migrated_flashcards.contains("旧版答案"));
}

#[test]
fn generates_flashcards_from_highlights_with_default_tags_and_review_status() {
    let dir = unique_temp_library_dir();
    let citation = CitationPayload {
        id: 1,
        label: "引用测试 · 第一章".to_string(),
        text: "本地索引会记录关键概念和对应原文。".to_string(),
        target_id: "chunk-book-1-0".to_string(),
        book_id: None,
        chunk_id: None,
        chapter_id: None,
        source_chapter_index: None,
        paragraph_index: None,
        start_offset: None,
        end_offset: None,
        confidence: None,
    };
    save_highlight_in(&dir, &citation).expect("highlight should save");

    let generated = generate_flashcards_from_highlights_with_defaults_in(
        &dir,
        &["重点".to_string(), "AI".to_string()],
        "due",
    )
    .expect("flashcards should generate with defaults");
    let loaded = load_flashcard_records(&dir).expect("flashcards should load");

    assert_eq!(generated.len(), 1);
    assert_eq!(loaded[0].tags, vec!["重点".to_string(), "AI".to_string()]);
    assert_eq!(loaded[0].review_status, "due");
}

#[test]
fn saves_ai_generated_flashcards_into_library() {
    let dir = unique_temp_library_dir();
    let cards = vec![
        AiGeneratedFlashcardRequest {
            front: "本章核心冲突是什么？".to_string(),
            back: "主角进入病院后发现异常。".to_string(),
            source_label: "AI 生成 · 第一章".to_string(),
            source_target_id: "ai:c1".to_string(),
            tags: Vec::new(),
            citation_ids: Vec::new(),
            chapter: None,
            review_status: None,
        },
        AiGeneratedFlashcardRequest {
            front: "钟声停止暗示什么？".to_string(),
            back: "可能暗示时间或感知异常。".to_string(),
            source_label: "AI 生成 · 第一章".to_string(),
            source_target_id: "ai:c2".to_string(),
            tags: Vec::new(),
            citation_ids: Vec::new(),
            chapter: None,
            review_status: None,
        },
    ];

    let saved = save_ai_generated_flashcards_in(&dir, &cards).expect("AI cards should save");
    let loaded = load_flashcard_records(&dir).expect("flashcards should load");

    assert_eq!(saved.len(), 2);
    assert_eq!(loaded.len(), 2);
    assert_eq!(loaded[0].front, "钟声停止暗示什么？");
    assert_eq!(loaded[0].source_target_id, "ai:c2");
    assert_eq!(loaded[1].front, "本章核心冲突是什么？");
    assert_eq!(loaded[1].source_label, "AI 生成 · 第一章");
}

#[test]
fn exports_knowledge_to_markdown() {
    let dir = unique_temp_library_dir();
    let citation = CitationPayload {
        id: 1,
        label: "引用测试 · 第一章".to_string(),
        text: "本地索引会记录关键概念和对应原文。".to_string(),
        target_id: "chunk-book-1-0".to_string(),
        book_id: None,
        chunk_id: None,
        chapter_id: None,
        source_chapter_index: None,
        paragraph_index: None,
        start_offset: None,
        end_offset: None,
        confidence: None,
    };
    save_ai_note_in(
        &dir,
        "阅读证据",
        "AI 回答正文",
        &[citation.clone()],
        None,
        None,
        None,
        None,
    )
    .expect("note should save");
    save_highlight_in(&dir, &citation).expect("highlight should save");
    generate_flashcards_from_highlights_in(&dir).expect("flashcards should generate");

    let path = export_knowledge_markdown_in(&dir).expect("markdown should export");
    let markdown = std::fs::read_to_string(&path).expect("markdown should be readable");

    assert!(path.ends_with("bookmind-knowledge.md"));
    assert!(markdown.contains("# BookMind Knowledge Export"));
    assert!(markdown.contains("## Notes"));
    assert!(markdown.contains("阅读证据"));
    assert!(markdown.contains("## Highlights"));
    assert!(markdown.contains("## Flashcards"));
    assert!(markdown.contains("关键概念"));
}

#[test]
fn exports_knowledge_markdown_to_custom_path() {
    let dir = unique_temp_library_dir();
    let citation = CitationPayload {
        id: 1,
        label: "自定义导出引用".to_string(),
        text: "自定义路径应写入 Markdown 内容。".to_string(),
        target_id: "chunk-book-custom-1".to_string(),
        book_id: None,
        chunk_id: None,
        chapter_id: None,
        source_chapter_index: None,
        paragraph_index: None,
        start_offset: None,
        end_offset: None,
        confidence: None,
    };
    save_ai_note_in(
        &dir,
        "自定义路径笔记",
        "导出正文",
        &[citation.clone()],
        None,
        None,
        None,
        None,
    )
    .expect("note should save");
    save_highlight_in(&dir, &citation).expect("highlight should save");

    let custom_path = dir.join("custom").join("nested").join("knowledge.md");
    let path = export_knowledge_markdown_with_options_in(
        &dir,
        false,
        false,
        Some(custom_path.to_str().expect("custom path should be utf-8")),
    )
    .expect("custom markdown should export");
    let returned_path = std::path::PathBuf::from(&path);
    let markdown =
        std::fs::read_to_string(&custom_path).expect("custom markdown should be readable");

    assert!(
        returned_path == custom_path
            || returned_path
                .canonicalize()
                .expect("returned path should exist")
                == custom_path
                    .canonicalize()
                    .expect("custom path should exist")
            || path == custom_path.display().to_string()
    );
    assert!(custom_path.exists());
    assert!(markdown.contains("# BookMind Knowledge Export"));
    assert!(markdown.contains("自定义路径笔记"));
    assert!(markdown.contains("自定义路径应写入 Markdown 内容"));
}

#[test]
fn exports_knowledge_markdown_honors_ai_metadata_and_structured_response_options() {
    let dir = unique_temp_library_dir();
    let metadata = AiNoteMetadataPayload {
        instruction: "总结".to_string(),
        scope: "chapter".to_string(),
        user_text: "用户问题".to_string(),
        selected_command_id: Some("summary".to_string()),
        retrieval_strategy: Some("scope-first".to_string()),
        retrieval_query: Some("雨夜".to_string()),
        multi_stage_retrieval_mode: Some("auto".to_string()),
        model: "gpt-test".to_string(),
        saved_at: "2026-06-09T00:00:00.000Z".to_string(),
        schema: Some("bookmind.ai.response.v2".to_string()),
        mode: Some("cloud".to_string()),
        interaction_mode: None,
        generated_at: Some("2026-06-09T00:00:00.000Z".to_string()),
        citation_coverage: Some("1 citations / 1 blocks".to_string()),
        book_range: Some("第一章".to_string()),
    };
    let structured = serde_json::json!({
        "schema": "bookmind.ai.response.v2",
        "summary": { "主要事件": ["发现线索"] }
    });
    save_ai_note_in(
        &dir,
        "结构化笔记",
        "AI 回答正文",
        &[],
        None,
        None,
        Some(metadata),
        Some(structured),
    )
    .expect("note should save");

    let plain_path =
        export_knowledge_markdown_with_options_in(&dir, false, false, None).expect("plain export");
    let plain = std::fs::read_to_string(&plain_path).expect("plain markdown readable");
    assert!(!plain.contains("AI Metadata"));
    assert!(!plain.contains("Structured Response"));

    let rich_path =
        export_knowledge_markdown_with_options_in(&dir, true, true, None).expect("rich export");
    let rich = std::fs::read_to_string(&rich_path).expect("rich markdown readable");
    assert!(rich.contains("#### AI Metadata"));
    assert!(rich.contains("\"model\": \"gpt-test\""));
    assert!(rich.contains("#### Structured Response"));
    assert!(rich.contains("bookmind.ai.response.v2"));
}
