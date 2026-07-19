use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

mod ai;
mod character;
mod library;
mod reader;
mod task;

pub(crate) use ai::*;
pub(crate) use character::*;
pub(crate) use library::*;
pub(crate) use reader::*;
pub(crate) use task::*;

fn default_schema_version() -> u32 {
    1
}

fn default_task_kind() -> String {
    TaskKind::ParseAndIndex.as_str().to_string()
}

fn default_task_status() -> String {
    TaskRunStatus::Queued.as_str().to_string()
}

fn default_task_stage() -> String {
    TaskStage::Queued.as_str().to_string()
}

fn default_task_max_attempts() -> u32 {
    3
}

fn default_manifest_status() -> String {
    "missing".to_string()
}

fn default_settings_schema_version() -> u32 {
    2
}

fn default_trash_retention_days() -> u32 {
    3
}

fn default_trash_auto_cleanup_enabled() -> bool {
    true
}

fn default_trash_protect_reading_progress() -> bool {
    true
}

fn default_trash_protect_reader_assets() -> bool {
    true
}

fn default_operation_log_level() -> String {
    "none".to_string()
}

fn default_ai_api_base_url() -> String {
    "https://api.openai.com/v1".to_string()
}

fn default_ai_endpoint_mode() -> String {
    "responses".to_string()
}

fn default_ai_model() -> String {
    "gpt-4.1-mini".to_string()
}

fn default_ai_request_timeout_secs() -> u64 {
    120
}

fn default_ai_retry_count() -> u32 {
    1
}

fn default_ai_proxy_url() -> String {
    String::new()
}

fn default_ai_custom_headers() -> String {
    String::new()
}

fn default_ai_streaming_enabled() -> bool {
    true
}

fn default_ai_temperature() -> f64 {
    0.2
}

fn default_ai_max_tokens() -> u32 {
    0
}

fn default_ai_top_p() -> f64 {
    1.0
}

fn default_ai_reasoning_effort() -> String {
    "none".to_string()
}

fn default_ai_response_format() -> String {
    "auto".to_string()
}

fn default_ai_provider_kind() -> String {
    "openai".to_string()
}

fn default_ai_provider_enabled() -> bool {
    true
}

fn default_ai_active_provider_profile_id() -> String {
    "openai-default".to_string()
}

fn default_translation_active_source_id() -> String {
    "translation-ai-default".to_string()
}

fn default_translation_source_language() -> String {
    "auto".to_string()
}

fn default_translation_target_language() -> String {
    "zh-CN".to_string()
}

fn default_ai_provider_profiles() -> Vec<AiProviderProfile> {
    let model = default_ai_model();
    vec![AiProviderProfile {
        id: default_ai_active_provider_profile_id(),
        name: "OpenAI 默认".to_string(),
        kind: default_ai_provider_kind(),
        enabled: default_ai_provider_enabled(),
        api_key: String::new(),
        api_base_url: default_ai_api_base_url(),
        endpoint_mode: default_ai_endpoint_mode(),
        model: model.clone(),
        models: vec![model.clone()],
        model_settings: default_ai_provider_model_settings_map(&model),
        proxy_url: default_ai_proxy_url(),
        custom_headers: default_ai_custom_headers(),
        streaming_enabled: default_ai_streaming_enabled(),
        request_timeout_secs: default_ai_request_timeout_secs(),
        retry_count: default_ai_retry_count(),
        temperature: default_ai_temperature(),
        max_tokens: default_ai_max_tokens(),
        top_p: default_ai_top_p(),
        reasoning_effort: default_ai_reasoning_effort(),
        response_format: default_ai_response_format(),
    }]
}

fn default_translation_sources() -> Vec<TranslationSource> {
    vec![TranslationSource {
        id: default_translation_active_source_id(),
        name: "AI Translation".to_string(),
        kind: "ai-model".to_string(),
        enabled: true,
        provider_id: default_ai_active_provider_profile_id(),
        model: default_ai_model(),
        api_base_url: String::new(),
        api_key: String::new(),
        app_id: String::new(),
        region: String::new(),
        request_timeout_secs: default_ai_request_timeout_secs(),
    }]
}

fn default_ai_model_context_window_tokens() -> u64 {
    128_000
}

fn default_ai_model_max_output_tokens() -> u64 {
    4_096
}

fn default_ai_provider_model_settings_map(model: &str) -> HashMap<String, AiProviderModelSettings> {
    let mut settings = HashMap::new();
    settings.insert(
        model.to_string(),
        AiProviderModelSettings {
            id: model.to_string(),
            display_name: model.to_string(),
            ..AiProviderModelSettings::default()
        },
    );
    settings
}

fn default_ai_cancel_strategy() -> String {
    "abort-and-save-stopped".to_string()
}
