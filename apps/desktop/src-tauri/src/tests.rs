use crate::backup::{create_auto_data_backup_in, create_data_backup_in, restore_data_backup_in};
use crate::characters::{
    extract_character_index_in, load_character_center_payload_in, queue_character_extraction_in,
};
use crate::cloud_ai::{
    build_cloud_ai_body_for_test, build_cloud_ai_prompt_for_test,
    build_custom_cloud_headers_for_test, cloud_ai_model_for_settings, parse_model_ids_for_test,
    parse_openai_text_for_test, resolve_ai_endpoint_url, resolve_ai_models_url,
};
use crate::commands::{
    empty_trash_command_in, import_books_from_directory_in, permanently_delete_book_command_in,
    update_book_metadata_in, update_settings_v2_in, write_reader_binary_file_in,
    write_reader_export_file_in,
};
use crate::database::{
    delete_book_fts_index_rows, rebuild_sqlite_database_indexes_in, save_chunks_to_fts,
    vacuum_sqlite_database_in,
};
use crate::library::{
    decode_txt_bytes, import_book_directory_into, import_book_from_path_into,
    import_book_from_path_with_cleanup_into, load_library_metadata_payloads, load_library_payloads,
    load_library_records, load_reader_document_payload, managed_import_text_file_path,
    normalize_epub_resource_href, read_book_content, safe_epub_asset_file_name,
    save_library_records, strip_epub_html_to_text_with_images, CustomCleanupRule,
    TxtImportCleanupOptions,
};
use crate::models::{
    AiRequestPayload, AppSettings, BookIndexManifest, BookRecord, SettingsV2, TaskErrorCode,
    TaskKind, TaskRecord, TaskRunStatus, TaskStage, TextChunkRecord, VectorIndexManifestEntry,
};
use crate::paths::{
    fts_database_path, original_backups_dir, task_file_path, task_log_file_path,
    task_log_file_path_for_day, vector_index_manifest_path,
};
use crate::reader_data::{load_reader_record_in, save_reader_record_in, SaveReaderRecordRequest};
use crate::search::{
    answer_from_ai_request_in, answer_from_local_index_in, build_vector_index_in,
    cancel_local_ai_request, get_indexed_chunks_preview_in, load_book_chunk_records,
    load_chunk_records, prepare_chunk_records_commit, save_chunk_records, search_index_in,
    search_index_page_in, search_index_page_payload_in, search_vector_index_in,
};
use crate::settings::{
    ai_api_key_storage_status_in, load_app_settings, normalize_ai_reasoning_effort,
    save_app_settings, save_settings_v2,
};
use crate::sidecar::check_ai_sidecar_health_in;
use crate::tasks::{
    append_task_log, apply_task_log_retention_in, apply_task_retention_in, archive_task_in,
    cancel_queued_tasks_in, cancel_task_in, clear_completed_tasks_in, clear_task_logs_in,
    delete_book_index_in, index_diagnostics_for_ui, load_index_manifest, load_task_logs_in,
    load_task_logs_page_in, load_task_records, load_vector_index_manifest, pause_queued_tasks_in,
    pause_task_in, rebuild_book_index_in, repair_book_fts_in, restore_archived_task_in,
    retry_failed_tasks_in, retry_task_in, run_parse_and_index_tasks_in,
    run_parse_and_index_tasks_with_events_in, save_index_manifest, save_task_records,
    save_vector_index_manifest, task_statuses_for_ui, validate_all_indexes_in,
};
use encoding_rs::GB18030;
use std::cell::Cell;
use std::time::{Duration, Instant};

mod backup_tests;
mod common;
use common::*;

mod characters_tests;
mod encryption_tests;
mod import_tests;
mod library_tests;
mod notes_tests;
mod reader_data_tests;
mod search_tests;
mod settings_tests;
mod sidecar_tests;
mod tasks_tests;

#[test]
fn decodes_utf8_without_replacement_characters() {
    let text = "<本地中文阅读测试>\n第1章 编码识别";
    let decoded = decode_txt_bytes(text.as_bytes()).expect("utf-8 should decode");
    assert!(decoded.contains("本地中文阅读测试"));
    assert!(!decoded.contains('\u{FFFD}'));
}

#[test]
fn decodes_utf8_bom_without_leaking_bom() {
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice("本地中文阅读测试".as_bytes());
    let decoded = decode_txt_bytes(&bytes).expect("utf-8 bom should decode");
    assert_eq!(decoded, "本地中文阅读测试");
    assert!(!decoded.contains('\u{FEFF}'));
}

#[test]
fn decodes_gb18030_imported_title_without_mojibake() {
    let (encoded, _, had_errors) = GB18030.encode("<本地中文阅读测试>\r\n第1章 编码识别");
    assert!(!had_errors);
    let decoded = decode_txt_bytes(&encoded).expect("gb18030 should decode");
    assert!(decoded.contains("本地中文阅读测试"));
    assert!(decoded.contains("编码识别"));
    assert!(!decoded.contains('\u{FFFD}'));
    assert!(!decoded.contains("���"));
}

#[test]
fn writes_reader_export_file_to_selected_path() {
    let dir = unique_temp_library_dir();
    std::fs::create_dir_all(&dir).expect("export fixture dir should be created");
    let path = dir.join("reader-settings.json");

    write_reader_export_file_in(&path, r#"{"settings":{"fontSize":18}}"#)
        .expect("reader export should write the selected path");

    let written = std::fs::read_to_string(path).expect("reader export should be readable");
    assert_eq!(written, r#"{"settings":{"fontSize":18}}"#);
}

#[test]
fn reader_export_commands_reject_empty_paths() {
    assert!(write_reader_export_file_in(std::path::Path::new(""), "payload").is_err());
    assert!(write_reader_binary_file_in(std::path::Path::new(""), vec![1, 2, 3]).is_err());
}

#[test]
fn cloud_ai_endpoint_resolver_accepts_base_or_full_paths() {
    assert_eq!(
        resolve_ai_endpoint_url("https://gateway.example.test/v1", "responses"),
        "https://gateway.example.test/v1/responses"
    );
    assert_eq!(
        resolve_ai_endpoint_url("https://gateway.example.test/responses", "responses"),
        "https://gateway.example.test/responses"
    );
    assert_eq!(
        resolve_ai_endpoint_url("https://gateway.example.test/v1", "chat.completions"),
        "https://gateway.example.test/v1/chat/completions"
    );
}

#[test]
fn provider_profile_edit_fields_can_be_temporarily_empty() {
    let dir = unique_temp_library_dir();
    let mut settings = AppSettings::default();
    settings.ai_provider_profiles[0].api_base_url = String::new();
    settings.ai_provider_profiles[0].model = String::new();
    settings.ai_provider_profiles[0].models = vec![
        "  gpt-4.1-mini  ".to_string(),
        "gpt-4.1".to_string(),
        "gpt-4.1".to_string(),
    ];

    let saved = save_app_settings(&dir, &settings).expect("settings should save");

    assert_eq!(saved.ai_api_base_url, "https://api.openai.com/v1");
    assert_eq!(saved.ai_model, "gpt-4.1-mini");
    assert_eq!(saved.ai_provider_profiles[0].api_base_url, "");
    assert_eq!(saved.ai_provider_profiles[0].model, "");
    assert_eq!(
        saved.ai_provider_profiles[0].models,
        vec!["gpt-4.1-mini".to_string(), "gpt-4.1".to_string()]
    );

    settings.ai_provider_profiles[0].api_base_url = "https:/".to_string();
    let saved_draft = save_app_settings(&dir, &settings).expect("draft base URL should save");
    assert_eq!(saved_draft.ai_provider_profiles[0].api_base_url, "https:/");

    settings.ai_provider_profiles[0].api_base_url =
        " https://gateway.example.test/v1/ ".to_string();
    let saved_with_slash =
        save_app_settings(&dir, &settings).expect("base URL with slash should save");
    assert_eq!(
        saved_with_slash.ai_provider_profiles[0].api_base_url,
        "https://gateway.example.test/v1/"
    );
}

#[test]
fn provider_model_settings_are_persisted_per_model() {
    let dir = unique_temp_library_dir();
    let mut settings = AppSettings::default();
    settings.ai_provider_profiles[0].model = "gemini-2.5-flash".to_string();
    settings.ai_provider_profiles[0].models = vec!["gemini-2.5-flash".to_string()];
    settings.ai_provider_profiles[0].model_settings.insert(
        "gemini-2.5-flash".to_string(),
        crate::models::AiProviderModelSettings {
            id: "gemini-2.5-flash".to_string(),
            display_name: "Gemini Flash".to_string(),
            model_type: "chat".to_string(),
            context_window_tokens: 1_000_000,
            max_output_tokens: 65_536,
            capabilities: crate::models::AiProviderModelCapabilities {
                vision: true,
                reasoning: true,
                tool_use: true,
            },
            favorite: true,
        },
    );

    let saved = save_app_settings(&dir, &settings).expect("settings should save");
    let saved_config = saved.ai_provider_profiles[0]
        .model_settings
        .get("gemini-2.5-flash")
        .expect("model settings should be returned after save");
    assert_eq!(saved_config.display_name, "Gemini Flash");
    assert_eq!(saved_config.context_window_tokens, 1_000_000);
    assert_eq!(saved_config.max_output_tokens, 65_536);
    assert!(saved_config.capabilities.vision);
    assert!(saved_config.capabilities.reasoning);
    assert!(saved_config.capabilities.tool_use);
    assert!(saved_config.favorite);

    let loaded = load_app_settings(&dir).expect("settings should load");
    let loaded_config = loaded.ai_provider_profiles[0]
        .model_settings
        .get("gemini-2.5-flash")
        .expect("model settings should persist to disk");
    assert_eq!(loaded_config.display_name, "Gemini Flash");
    assert_eq!(loaded_config.context_window_tokens, 1_000_000);
    assert_eq!(loaded_config.max_output_tokens, 65_536);
    assert!(loaded_config.capabilities.vision);
    assert!(loaded_config.capabilities.reasoning);
    assert!(loaded_config.capabilities.tool_use);
    assert!(loaded_config.favorite);
}

#[test]
fn provider_api_keys_are_loaded_per_profile_without_plaintext_settings_leak() {
    let dir = unique_temp_library_dir();
    let mut settings = AppSettings::default();
    settings.ai_active_provider_profile_id = "p-local".to_string();
    settings.ai_api_key = "sk-local".to_string();
    settings.ai_provider_profiles[0].id = "p-openai".to_string();
    settings.ai_provider_profiles[0].api_key = "sk-openai".to_string();
    settings
        .ai_provider_profiles
        .push(crate::models::AiProviderProfile {
            id: "p-local".to_string(),
            name: "Local".to_string(),
            kind: "local-proxy".to_string(),
            enabled: true,
            api_key: "sk-local".to_string(),
            api_base_url: "http://localhost:11434/v1".to_string(),
            endpoint_mode: "chat.completions".to_string(),
            model: "local-model".to_string(),
            models: vec!["local-model".to_string()],
            proxy_url: String::new(),
            custom_headers: String::new(),
            streaming_enabled: true,
            request_timeout_secs: 120,
            retry_count: 1,
            temperature: 0.2,
            max_tokens: 0,
            top_p: 1.0,
            reasoning_effort: "none".to_string(),
            response_format: "auto".to_string(),
            model_settings: Default::default(),
        });

    save_app_settings(&dir, &settings).expect("provider settings should save");
    let raw_settings = std::fs::read_to_string(crate::paths::settings_file_path(&dir))
        .expect("settings file should be readable");
    assert!(!raw_settings.contains("sk-openai"));
    assert!(!raw_settings.contains("sk-local"));

    let loaded = load_app_settings(&dir).expect("provider settings should load");
    assert_eq!(loaded.ai_api_key, "sk-local");
    assert_eq!(loaded.ai_provider_profiles[0].api_key, "sk-openai");
    assert_eq!(loaded.ai_provider_profiles[1].api_key, "sk-local");
}

#[test]
fn cloud_ai_parser_reads_responses_and_chat_payloads() {
    assert_eq!(
        parse_openai_text_for_test(&serde_json::json!({ "output_text": "pong" })),
        "pong"
    );
    assert_eq!(
        parse_openai_text_for_test(&serde_json::json!({
            "choices": [{ "message": { "content": "chat pong" } }]
        })),
        "chat pong"
    );
    assert_eq!(
        parse_openai_text_for_test(&serde_json::json!({
            "output": [{ "content": [{ "text": "array pong" }] }]
        })),
        "array pong"
    );
}

#[test]
fn cloud_ai_models_can_be_fetched_and_selected() {
    assert_eq!(
        resolve_ai_models_url("https://gateway.example.test/v1"),
        "https://gateway.example.test/v1/models"
    );
    assert_eq!(
        resolve_ai_models_url("https://gateway.example.test/v1/responses"),
        "https://gateway.example.test/v1/models"
    );
    assert_eq!(
        parse_model_ids_for_test(&serde_json::json!({
            "data": [
                { "id": "gpt-4.1-mini" },
                { "id": "claude-3-5-sonnet" }
            ]
        })),
        vec!["gpt-4.1-mini".to_string(), "claude-3-5-sonnet".to_string()]
    );

    let custom_settings = AppSettings {
        ai_model: "deepseek-chat".to_string(),
        ..AppSettings::default()
    };
    assert_eq!(
        cloud_ai_model_for_settings(&custom_settings),
        "deepseek-chat"
    );
    assert_eq!(
        build_cloud_ai_body_for_test(
            "responses",
            &cloud_ai_model_for_settings(&custom_settings),
            "ping",
            &custom_settings
        )["model"],
        "deepseek-chat"
    );
}

#[test]
fn cloud_ai_body_uses_configurable_generation_parameters() {
    let settings = AppSettings {
        ai_temperature: 0.7,
        ai_max_tokens: 2048,
        ai_top_p: 0.9,
        ai_reasoning_effort: "high".to_string(),
        ai_response_format: "json_object".to_string(),
        ..AppSettings::default()
    };
    let responses_body = build_cloud_ai_body_for_test("responses", "gpt-test", "ping", &settings);
    assert_eq!(responses_body["temperature"], serde_json::json!(0.7));
    assert_eq!(responses_body["max_output_tokens"], serde_json::json!(2048));
    assert_eq!(responses_body["top_p"], serde_json::json!(0.9));
    assert_eq!(responses_body["reasoning"]["effort"], "high");
    assert_eq!(responses_body["text"]["format"]["type"], "json_object");

    let chat_body = build_cloud_ai_body_for_test("chat.completions", "gpt-test", "ping", &settings);
    assert_eq!(chat_body["temperature"], serde_json::json!(0.7));
    assert_eq!(chat_body["max_tokens"], serde_json::json!(2048));
    assert_eq!(chat_body["top_p"], serde_json::json!(0.9));
    assert_eq!(chat_body["reasoning_effort"], "high");
    assert_eq!(chat_body["response_format"]["type"], "json_object");
}

#[test]
fn cloud_ai_body_preserves_custom_reasoning_effort() {
    assert_eq!(normalize_ai_reasoning_effort(" xhigh "), "xhigh");
    assert_eq!(normalize_ai_reasoning_effort("max"), "max");
    assert_eq!(
        normalize_ai_reasoning_effort("provider_custom-2.0"),
        "provider_custom-2.0"
    );
    assert_eq!(normalize_ai_reasoning_effort("not allowed"), "none");
    for effort in ["xhigh", "max", "provider_custom-2.0"] {
        let settings = AppSettings {
            ai_reasoning_effort: effort.to_string(),
            ..AppSettings::default()
        };
        let responses_body =
            build_cloud_ai_body_for_test("responses", "gpt-test", "ping", &settings);
        let chat_body =
            build_cloud_ai_body_for_test("chat.completions", "gpt-test", "ping", &settings);
        assert_eq!(responses_body["reasoning"]["effort"], effort);
        assert_eq!(chat_body["reasoning_effort"], effort);
    }
}

#[test]
fn cloud_ai_custom_headers_filter_protected_credentials() {
    let settings = AppSettings {
        ai_custom_headers: r#"{
            "X-Provider": "bookmind",
            "X-Feature-Flag": true,
            "Authorization": "Bearer should-not-override",
            "Cookie": "session=secret",
            "X-API-Key": "secret"
        }"#
        .to_string(),
        ..AppSettings::default()
    };

    let headers =
        build_custom_cloud_headers_for_test(&settings).expect("custom headers should parse");

    assert_eq!(
        headers.get("x-provider").map(String::as_str),
        Some("bookmind")
    );
    assert_eq!(
        headers.get("x-feature-flag").map(String::as_str),
        Some("true")
    );
    assert!(!headers.contains_key("authorization"));
    assert!(!headers.contains_key("cookie"));
    assert!(!headers.contains_key("x-api-key"));
}

#[test]
fn cloud_ai_body_omits_reasoning_by_default_and_sends_full_json_schema_format() {
    let default_body =
        build_cloud_ai_body_for_test("responses", "gpt-4.1-mini", "ping", &AppSettings::default());
    assert!(default_body.get("reasoning").is_none());

    let settings = AppSettings {
        ai_response_format: "json_schema".to_string(),
        ..AppSettings::default()
    };
    let responses_body = build_cloud_ai_body_for_test("responses", "gpt-test", "ping", &settings);
    assert_eq!(responses_body["text"]["format"]["type"], "json_schema");
    assert_eq!(
        responses_body["text"]["format"]["name"],
        "bookmind_ai_response_v2"
    );
    assert_eq!(
        responses_body["text"]["format"]["schema"]["properties"]["schema"]["const"],
        "bookmind.ai.response.v2"
    );

    let chat_body = build_cloud_ai_body_for_test("chat.completions", "gpt-test", "ping", &settings);
    assert_eq!(chat_body["response_format"]["type"], "json_schema");
    assert_eq!(
        chat_body["response_format"]["json_schema"]["name"],
        "bookmind_ai_response_v2"
    );
    assert_eq!(
        chat_body["response_format"]["json_schema"]["schema"]["properties"]["schema"]["const"],
        "bookmind.ai.response.v2"
    );
}

#[test]
fn cloud_ai_agent_tool_decision_uses_raw_json_object_contract() {
    let settings = AppSettings {
        ai_response_format: "json_schema".to_string(),
        ..AppSettings::default()
    };
    let request = AiRequestPayload {
        scope: "chapter".to_string(),
        instruction: r#"只输出 {"next":{"tool":"get_current_context","args":{},"reason":"..."}}"#
            .to_string(),
        user_text: String::new(),
        selected_command_id: None,
        retrieval_strategy: None,
        retrieval_query: None,
        multi_stage_retrieval_mode: None,
        local_result_limit: None,
        citation_min_confidence: None,
        book_id: None,
        scope_text: None,
        scope_label: Some("Agent 工具决策".to_string()),
        conversation_context: Some(
            "1. 用户：上一轮问过最后一章\n2. AI：工具读取过章节列表".to_string(),
        ),
        mode: Some("cloud".to_string()),
        interaction_mode: Some("agent".to_string()),
        require_cloud_api: Some(true),
        cloud_prompt_mode: Some("agent_tool_decision".to_string()),
        cloud_response_format: Some("json_object".to_string()),
        request_id: Some("agent-decision-test".to_string()),
    };

    let prompt = build_cloud_ai_prompt_for_test(&request);
    assert!(!prompt.contains("bookmind.ai.response.v2"));
    assert!(prompt.contains(r#""next""#));
    assert!(prompt.contains("Conversation history context"));
    assert!(prompt.contains("上一轮问过最后一章"));

    let responses_body = crate::cloud_ai::build_cloud_ai_body_for_request_test(
        "responses",
        "gpt-test",
        &prompt,
        &settings,
        &request,
    );
    assert_eq!(responses_body["text"]["format"]["type"], "json_object");
    assert!(responses_body["text"]["format"].get("schema").is_none());

    let chat_body = crate::cloud_ai::build_cloud_ai_body_for_request_test(
        "chat.completions",
        "gpt-test",
        &prompt,
        &settings,
        &request,
    );
    assert_eq!(chat_body["response_format"]["type"], "json_object");
    assert!(chat_body["response_format"].get("json_schema").is_none());
}

#[test]
fn cloud_ai_plain_text_prompt_excludes_structured_bookmind_contract() {
    let request = AiRequestPayload {
        scope: "selection-translation".to_string(),
        instruction: "Translate the source and return only the translation.".to_string(),
        user_text: String::new(),
        selected_command_id: Some("translate-selection".to_string()),
        retrieval_strategy: None,
        retrieval_query: Some("你好，世界。".to_string()),
        multi_stage_retrieval_mode: None,
        local_result_limit: None,
        citation_min_confidence: None,
        book_id: None,
        scope_text: Some("你好，世界。".to_string()),
        scope_label: Some("Selected text".to_string()),
        conversation_context: None,
        mode: Some("cloud".to_string()),
        interaction_mode: Some("qa".to_string()),
        require_cloud_api: Some(true),
        cloud_prompt_mode: Some("plain_text".to_string()),
        cloud_response_format: Some("text".to_string()),
        request_id: Some("translation-test".to_string()),
    };

    let prompt = build_cloud_ai_prompt_for_test(&request);

    assert_eq!(
        prompt,
        "Translate the source and return only the translation.\n\nSource text:\n你好，世界。"
    );
    assert!(!prompt.contains("bookmind.ai.response.v2"));
    assert!(!prompt.contains("Context JSON"));
}

#[test]
fn cloud_ai_prompt_requires_jumpable_character_citations() {
    let request = AiRequestPayload {
        scope: "chapter".to_string(),
        instruction: "识别当前章节人物".to_string(),
        user_text: String::new(),
        selected_command_id: None,
        retrieval_strategy: None,
        retrieval_query: None,
        multi_stage_retrieval_mode: None,
        local_result_limit: None,
        citation_min_confidence: None,
        book_id: None,
        scope_label: Some("第31章 祈墨".to_string()),
        scope_text: Some("林七夜慌了。\n温祈墨瞪大了眼睛。".to_string()),
        conversation_context: None,
        mode: None,
        interaction_mode: None,
        require_cloud_api: None,
        cloud_prompt_mode: None,
        cloud_response_format: None,
        request_id: None,
    };

    let prompt = build_cloud_ai_prompt_for_test(&request);

    assert!(prompt.contains("\"characters_extracted\""));
    assert!(prompt.contains("\"citations\""));
    assert!(prompt.contains("\"sourceText\""));
    assert!(prompt.contains("必须是 Context 中连续出现的原文短句"));
    assert!(prompt.contains("不要写“注：”"));
    assert!(prompt.contains("analysis_char_1_1"));
}

#[test]
fn import_uses_stable_task_id_and_does_not_duplicate_active_parse_task() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("任务去重.txt");
    std::fs::write(&source, "重复导入同一本书不应该追加 queued parse 任务。")
        .expect("source txt should be written");

    let first = import_book_from_path_into(&dir, &source).expect("first import should work");
    let second = import_book_from_path_into(&dir, &source).expect("duplicate import should work");
    assert_eq!(first.id, second.id);

    let tasks = load_task_records(&dir).expect("tasks should load");
    let parse_tasks: Vec<_> = tasks
        .iter()
        .filter(|task| task.book_id == first.id && task.kind == "parse-and-index")
        .collect();
    assert_eq!(parse_tasks.len(), 1);
    assert!(parse_tasks[0]
        .id
        .starts_with(&format!("task-parse-and-index-{}-", first.id)));
}

#[test]
fn imported_epub_and_pdf_payloads_are_saved_as_text_files() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");

    let pdf_source = source_dir.join("示例.pdf");
    let epub_source = source_dir.join("示例.epub");

    let pdf_path = managed_import_text_file_path(&dir, &pdf_source, "pdf-hash")
        .expect("pdf path should derive");
    let epub_path = managed_import_text_file_path(&dir, &epub_source, "epub-hash")
        .expect("epub path should derive");

    assert_eq!(
        pdf_path.extension().and_then(|value| value.to_str()),
        Some("txt")
    );
    assert_eq!(
        epub_path.extension().and_then(|value| value.to_str()),
        Some("txt")
    );
    assert!(pdf_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap()
        .starts_with("pdf-hash-"));
    assert!(epub_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap()
        .starts_with("epub-hash-"));
}

#[test]
fn epub_html_image_tags_become_reader_image_markers() {
    let mut image_paths = std::collections::HashMap::new();
    image_paths.insert(
        "Images/pic.png".to_string(),
        "C:\\BookMindData\\library\\epub-assets\\source-hash\\pic.png".to_string(),
    );
    let text = strip_epub_html_to_text_with_images(
        r#"<html><body><p>图前</p><img src="../Images/pic.png" /><p>图后</p></body></html>"#,
        &image_paths,
    );
    assert!(text.contains("图前"));
    assert!(text.contains(
        "[[BOOKMIND_EPUB_IMAGE:C:\\BookMindData\\library\\epub-assets\\source-hash\\pic.png]]"
    ));
    assert!(text.contains("图后"));
    assert_eq!(
        normalize_epub_resource_href("../Images/pic.png#cover"),
        "Images/pic.png"
    );
    assert_eq!(
        safe_epub_asset_file_name("../Images/封面 图.png", "cover", "image/png"),
        "____.png"
    );
}

#[test]
fn epub_html_footnote_links_become_reader_note_markers() {
    let text = strip_epub_html_to_text_with_images(
        r##"<html><body><p>安德鲁·杰克逊<a href="#note-1" class="noteref">注</a>曾任总统。</p><aside id="note-1"><p>注安德鲁·杰克逊（Andrew Jackson, 1767—1845），美国将军。</p></aside></body></html>"##,
        &std::collections::HashMap::new(),
    );

    assert!(
        text.contains("安德鲁·杰克逊[[BOOKMIND_EPUB_NOTE_REF:note-1|注]]曾任总统。"),
        "inline note links should become clickable reader note reference markers: {text}"
    );
    assert!(
        text.contains("[[BOOKMIND_EPUB_NOTE_TARGET:note-1]]注安德鲁·杰克逊"),
        "note targets should be preserved before the note body: {text}"
    );
}

#[test]
fn epub_standalone_footnote_ref_paragraph_merges_into_previous_paragraph() {
    let text = strip_epub_html_to_text_with_images(
        r##"<html><body><p>斯蒂芬妮小姐说，当时有人建议把怪人送到塔斯卡卢萨</p><p><a href="#note-1" class="noteref">注</a></p><p>去疗养一段时间。</p><aside id="note-1"><p>注塔斯卡卢萨，地名。</p></aside></body></html>"##,
        &std::collections::HashMap::new(),
    );

    assert!(
        text.contains("斯蒂芬妮小姐说，当时有人建议把怪人送到塔斯卡卢萨[[BOOKMIND_EPUB_NOTE_REF:note-1|注]]\n去疗养一段时间。"),
        "standalone note reference paragraphs should attach to the previous paragraph instead of rendering as a large separate button: {text}"
    );
}

#[test]
fn epub_note_ref_punctuation_continuation_merges_into_same_paragraph() {
    let text = strip_epub_html_to_text_with_images(
        r##"<html><body><p>奥利弗·奥普蒂克</p><p><a href="#note-1" class="noteref">注</a></p><p>、维克多·阿普尔顿</p><aside id="note-1"><p>注奥普蒂克，作家。</p></aside></body></html>"##,
        &std::collections::HashMap::new(),
    );

    assert!(
        text.contains("奥利弗·奥普蒂克[[BOOKMIND_EPUB_NOTE_REF:note-1|注]]、维克多·阿普尔顿"),
        "punctuation-start continuation after a note reference should stay in the same paragraph: {text}"
    );
}

#[test]
fn epub_note_target_return_link_is_removed_and_body_is_merged() {
    let text = strip_epub_html_to_text_with_images(
        r##"<html><body><p>正文上一句。</p><aside id="nh0010"><p><a href="#nh0010" class="noteref">注</a></p><p>埃德加·赖斯·伯勒斯，美国科幻小说作家。</p></aside></body></html>"##,
        &std::collections::HashMap::new(),
    );

    assert!(
        text.contains("[[BOOKMIND_EPUB_NOTE_TARGET:nh0010]]埃德加·赖斯·伯勒斯，美国科幻小说作家。"),
        "note target paragraphs containing only a return note link should become one rendered note body card: {text}"
    );
    assert!(
        !text.contains("[[BOOKMIND_EPUB_NOTE_TARGET:nh0010]][[BOOKMIND_EPUB_NOTE_REF:nh0010|注]]"),
        "return note links inside note bodies should not render as a second clickable badge: {text}"
    );
}

#[test]
fn retry_failed_task_increments_attempt_and_preserves_history_logs() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("重试失败.txt");
    std::fs::write(&source, "失败任务重试应该增加 attempt 并保留历史日志。")
        .expect("source txt should be written");

    import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    let mut tasks = load_task_records(&dir).expect("tasks should load");
    tasks[0].status = "failed".to_string();
    tasks[0].attempt = 1;
    tasks[0].error_code = "file_read_failed".to_string();
    tasks[0].error_message = "读取失败".to_string();
    let failed_task = tasks[0].clone();
    save_task_records(&dir, &tasks).expect("failed task should save");
    append_task_log(&dir, &failed_task, "error", "历史失败日志")
        .expect("history log should append");

    let retried = retry_task_in(&dir, &failed_task.id).expect("task should retry");
    assert_eq!(retried.status, "queued");
    assert_eq!(retried.stage, "queued");
    assert_eq!(retried.progress, 0.0);
    assert_eq!(retried.attempt, 2);
    assert!(retried.error_code.is_empty());
    assert!(retried.error_message.is_empty());

    let logs = load_task_logs_in(&dir, Some(&failed_task.id)).expect("logs should load");
    assert!(logs.iter().any(|log| log.message.contains("历史失败日志")));
    assert!(logs
        .iter()
        .any(|log| log.message.contains("任务已重新排队")));
}

#[test]
fn retry_after_source_txt_missing_surfaces_file_missing_again() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("移动后重试.txt");
    std::fs::write(&source, "源 TXT 丢失后重试应该继续显示 file_missing。")
        .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    let mut records = load_library_records(&dir).expect("library should load");
    let managed_copy = std::path::PathBuf::from(&records[0].file_path);
    std::fs::remove_file(&managed_copy).expect("managed TXT copy should be moved away");

    run_parse_and_index_tasks_in(&dir).expect("runner should persist missing-file failure");
    let failed_once = parse_task_for_book(
        &load_task_records(&dir).expect("tasks should reload after first run"),
        &book.id,
    )
    .clone();
    assert_eq!(failed_once.status, TaskRunStatus::FAILED);
    assert_eq!(failed_once.error_code, TaskErrorCode::FILE_MISSING);
    assert_eq!(failed_once.error.code, TaskErrorCode::FILE_MISSING);
    assert_eq!(failed_once.error.stage, TaskStage::READ_FILE);
    assert!(failed_once.error.retryable);

    let retried =
        retry_task_in(&dir, &failed_once.id).expect("missing-file task should requeue for retry");
    assert_eq!(retried.status, TaskRunStatus::QUEUED);
    assert_eq!(retried.stage, TaskStage::QUEUED);
    assert_eq!(retried.progress, 0.0);
    assert!(retried.error_code.is_empty());

    run_parse_and_index_tasks_in(&dir)
        .expect("runner should retry and persist missing-file failure again");
    let after_retry_tasks = load_task_records(&dir).expect("tasks should reload after retry");
    let failed_again = parse_task_for_book(&after_retry_tasks, &book.id);
    assert_eq!(failed_again.status, TaskRunStatus::FAILED);
    assert_eq!(failed_again.error_code, TaskErrorCode::FILE_MISSING);
    assert_eq!(failed_again.message, "读取文件失败");
    assert!(failed_again.error_message.contains("系统找不到指定的文件"));
    assert_eq!(failed_again.error.code, TaskErrorCode::FILE_MISSING);
    assert_eq!(failed_again.error.message, failed_again.error_message);
    assert_eq!(failed_again.error.stage, TaskStage::READ_FILE);
    assert!(failed_again.error.retryable);
    assert!(load_task_logs_in(&dir, Some(&failed_again.id))
        .expect("missing-file logs should load")
        .iter()
        .any(|log| log.message.contains("读取文件失败")));

    records[0].file_path = managed_copy.display().to_string();
    save_library_records(&dir, &records).expect("library should remain saveable");
}

#[test]
fn importing_existing_book_resets_failed_parse_task_without_duplicate() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("失败后导入.txt");
    std::fs::write(
        &source,
        "失败任务再次导入应该重置旧任务，而不是追加重复任务。",
    )
    .expect("source txt should be written");

    let book = import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    let mut tasks = load_task_records(&dir).expect("tasks should load");
    let parse_index = tasks
        .iter()
        .position(|task| task.book_id == book.id && task.kind == TaskKind::PARSE_AND_INDEX)
        .expect("parse task should exist");
    tasks[parse_index].status = "failed".to_string();
    tasks[parse_index].attempt = 1;
    tasks[parse_index].error_code = "file_missing".to_string();
    tasks[parse_index].error_message = "文件缺失".to_string();
    save_task_records(&dir, &tasks).expect("failed task should save");

    import_book_from_path_into(&dir, &source).expect("re-import should reset failed task");
    let after = load_task_records(&dir).expect("tasks should reload");
    let parse_tasks: Vec<_> = after
        .iter()
        .filter(|task| task.book_id == book.id && task.kind == "parse-and-index")
        .collect();
    assert_eq!(parse_tasks.len(), 1);
    assert_eq!(parse_tasks[0].status, "queued");
    assert_eq!(parse_tasks[0].attempt, 2);
    assert!(parse_tasks[0].error_code.is_empty());
    assert!(parse_tasks[0].error_message.is_empty());
}

#[test]
fn retry_failed_task_respects_max_attempts() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("超过重试.txt");
    std::fs::write(&source, "超过 maxAttempts 后不再自动重试。")
        .expect("source txt should be written");

    import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    let mut tasks = load_task_records(&dir).expect("tasks should load");
    tasks[0].status = "failed".to_string();
    tasks[0].attempt = 3;
    tasks[0].max_attempts = 3;
    let task_id = tasks[0].id.clone();
    save_task_records(&dir, &tasks).expect("failed task should save");

    let error = retry_task_in(&dir, &task_id).expect_err("retry should refuse max attempts");
    assert!(error.contains("超过最大重试次数"));
}

#[test]
fn loads_legacy_library_records_without_import_fields() {
    let dir = unique_temp_library_dir();
    let library_dir = dir.join("library");
    std::fs::create_dir_all(&library_dir).expect("library dir should be created");
    std::fs::write(
        library_dir.join("library.json"),
        r#"[{
          "id":"legacy",
          "title":"旧书",
          "displayTitle":"旧书",
          "author":"本地 TXT 示例",
          "format":"TXT",
          "status":"旧记录",
          "progress":12,
          "fileName":"legacy.txt",
          "filePath":"legacy.txt",
          "coverLabel":"TXT",
          "coverTone":"amber",
          "deleted":false
        }]"#,
    )
    .expect("legacy library should be written");

    let records = load_library_records(&dir).expect("legacy records should load");

    assert_eq!(records.len(), 1);
    assert_eq!(records[0].content_hash, "");
    assert_eq!(records[0].imported_at, "");
    assert_eq!(records[0].cover_image_path, "");
}

#[test]
fn legacy_task_records_migrate_to_new_fields_on_load() {
    let dir = unique_temp_library_dir();
    let task_path = crate::paths::task_file_path(&dir);
    std::fs::create_dir_all(task_path.parent().expect("task path should have parent"))
        .expect("task dir should be created");
    std::fs::write(
        &task_path,
        r#"[{"id":"parse-book-legacy","bookId":"book-legacy","kind":"parse-and-index","status":"done","progress":100,"message":"legacy done"}]"#,
    )
    .expect("legacy task file should be written");

    let tasks = load_task_records(&dir).expect("legacy task should load");
    assert_eq!(tasks.len(), 1);
    assert_eq!(tasks[0].status, "succeeded");
    assert_eq!(tasks[0].stage, "done");
    assert_eq!(tasks[0].progress, 100.0);
    assert_eq!(tasks[0].max_attempts, 3);
    assert_eq!(tasks[0].output_summary.chunks, 0);
}

#[test]
fn saving_task_records_writes_legacy_statuses_back_as_normalized_values() {
    let dir = unique_temp_library_dir();
    let tasks = vec![crate::models::TaskRecord {
        id: "parse-book-legacy".to_string(),
        book_id: "book-legacy".to_string(),
        kind: TaskKind::ParseAndIndex.as_str().to_string(),
        status: "completed".to_string(),
        stage: TaskStage::Queued.as_str().to_string(),
        progress: 100.0,
        message: "legacy completed".to_string(),
        ..crate::models::TaskRecord::default()
    }];

    save_task_records(&dir, &tasks).expect("legacy task should save normalized");
    let raw = std::fs::read_to_string(crate::paths::task_file_path(&dir))
        .expect("task file should be readable");

    assert!(raw.contains("\"status\": \"succeeded\""));
    assert!(raw.contains("\"stage\": \"done\""));
    assert!(!raw.contains("\"status\": \"completed\""));
}

#[test]
fn global_search_falls_back_to_fts_when_chunk_manifest_is_empty() {
    let dir = unique_temp_library_dir();
    let db_dir = dir.join("db");
    let indexes_dir = dir.join("indexes").join("bm25");
    std::fs::create_dir_all(&db_dir).expect("db dir should be created");
    std::fs::create_dir_all(&indexes_dir).expect("index dir should be created");

    let chunk_manifest = indexes_dir.join("chunks.json");
    std::fs::write(
        &chunk_manifest,
        r#"{"schema":"bookmind.text-chunks.manifest.v1","books":[]}"#,
    )
    .expect("chunk manifest should be written");

    let chunks = vec![TextChunkRecord {
        id: "book-1:c1:p0-0:k0".to_string(),
        book_id: "book-1".to_string(),
        book_title: "测试书".to_string(),
        chapter: "第1章".to_string(),
        ordinal: 0,
        text: "林七夜在雨夜抵达病院".to_string(),
        chapter_index: 1,
        chapter_title: "第1章".to_string(),
        paragraph_start: 0,
        paragraph_end: 0,
        char_start: 0,
        char_end: 10,
        content_hash: "hash".to_string(),
        chunk_strategy_version: 1,
        created_at: "1".to_string(),
    }];
    save_chunks_to_fts(&dir, "book-1", &chunks).expect("fts rows should save");

    let page = search_index_page_payload_in(&dir, "林七夜", 20, 0, None)
        .expect("global search should work");
    assert_eq!(page.total, 1);
    assert_eq!(page.results.len(), 1);
    assert_eq!(page.results[0].book_id, "book-1");
}

#[test]
fn exposes_import_tasks_as_ui_statuses() {
    let dir = unique_temp_library_dir();
    let source_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&source_dir).expect("source dir should be created");
    let source = source_dir.join("任务测试.txt");
    std::fs::write(&source, "任务中心应该读取真实导入任务。")
        .expect("source txt should be written");

    import_book_from_path_into(&dir, &source).expect("import should queue parse task");
    let statuses = task_statuses_for_ui(&dir).expect("task statuses should load");

    assert_eq!(statuses.len(), 5);
    let parse_status = statuses
        .iter()
        .find(|status| status.kind == TaskKind::PARSE_AND_INDEX)
        .expect("parse status should exist");
    assert_eq!(parse_status.name, "解析索引 · 任务测试");
    assert_eq!(parse_status.progress, 0.0);
    assert_eq!(parse_status.tone, "amber");
    assert_eq!(parse_status.status, "queued");
    assert!(!parse_status.dag_id.is_empty());
    assert_eq!(parse_status.depends_on.len(), 1);
}
