use super::*;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TextChunkRecord {
    pub(crate) id: String,
    pub(crate) book_id: String,
    pub(crate) book_title: String,
    pub(crate) chapter: String,
    pub(crate) ordinal: usize,
    pub(crate) text: String,
    #[serde(default)]
    pub(crate) chapter_index: usize,
    #[serde(default)]
    pub(crate) chapter_title: String,
    #[serde(default)]
    pub(crate) paragraph_start: usize,
    #[serde(default)]
    pub(crate) paragraph_end: usize,
    #[serde(default)]
    pub(crate) char_start: usize,
    #[serde(default)]
    pub(crate) char_end: usize,
    #[serde(default)]
    pub(crate) content_hash: String,
    #[serde(default)]
    pub(crate) chunk_strategy_version: u32,
    #[serde(default)]
    pub(crate) created_at: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct IndexedChunkPreviewItemPayload {
    pub(crate) chunk_id: String,
    pub(crate) ordinal: usize,
    pub(crate) chapter_index: usize,
    pub(crate) chapter_title: String,
    pub(crate) paragraph_start: usize,
    pub(crate) paragraph_end: usize,
    pub(crate) paragraph_range: String,
    pub(crate) char_start: usize,
    pub(crate) char_end: usize,
    pub(crate) source_chapter_index: usize,
    pub(crate) paragraph_index: usize,
    pub(crate) start_offset: usize,
    pub(crate) end_offset: usize,
    pub(crate) char_count: usize,
    pub(crate) text_preview: String,
    pub(crate) full_text: String,
    pub(crate) reader_location: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct IndexedChunksPreviewPayload {
    pub(crate) book_id: String,
    pub(crate) total: usize,
    pub(crate) limit: usize,
    pub(crate) offset: usize,
    pub(crate) items: Vec<IndexedChunkPreviewItemPayload>,
}

impl Default for TextChunkRecord {
    fn default() -> Self {
        Self {
            id: String::new(),
            book_id: String::new(),
            book_title: String::new(),
            chapter: String::new(),
            ordinal: 0,
            text: String::new(),
            chapter_index: 0,
            chapter_title: String::new(),
            paragraph_start: 0,
            paragraph_end: 0,
            char_start: 0,
            char_end: 0,
            content_hash: String::new(),
            chunk_strategy_version: 0,
            created_at: String::new(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SearchResultPayload {
    pub(crate) chunk_id: String,
    pub(crate) book_id: String,
    pub(crate) book_title: String,
    pub(crate) chapter: String,
    pub(crate) source_chapter_index: usize,
    pub(crate) chapter_title: String,
    pub(crate) snippet: String,
    pub(crate) score: usize,
    pub(crate) paragraph_index: usize,
    pub(crate) start_offset: usize,
    pub(crate) end_offset: usize,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SearchIndexPagePayload {
    pub(crate) query: String,
    pub(crate) total: usize,
    pub(crate) limit: usize,
    pub(crate) offset: usize,
    pub(crate) results: Vec<SearchResultPayload>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiSidecarHealthPayload {
    pub(crate) sidecar_status: String,
    pub(crate) message: String,
    pub(crate) version: String,
    pub(crate) capabilities: Vec<String>,
    pub(crate) checked_at: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VectorIndexBuildPayload {
    pub(crate) ok: bool,
    pub(crate) book_id: String,
    pub(crate) sidecar_status: String,
    pub(crate) vector_index_status: String,
    pub(crate) indexed_chunk_count: usize,
    pub(crate) message: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VectorSearchPayload {
    pub(crate) ok: bool,
    pub(crate) query: String,
    pub(crate) sidecar_status: String,
    pub(crate) vector_index_status: String,
    pub(crate) results: Vec<SearchResultPayload>,
    pub(crate) message: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CitationPayload {
    pub(crate) id: usize,
    pub(crate) label: String,
    pub(crate) text: String,
    pub(crate) target_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) book_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) chunk_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) chapter_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) source_chapter_index: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) paragraph_index: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) start_offset: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) end_offset: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) confidence: Option<f32>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiRequestPayload {
    pub(crate) scope: String,
    #[serde(default)]
    pub(crate) instruction: String,
    #[serde(default)]
    pub(crate) user_text: String,
    #[serde(default)]
    pub(crate) selected_command_id: Option<String>,
    #[serde(default)]
    pub(crate) retrieval_strategy: Option<String>,
    #[serde(default)]
    pub(crate) retrieval_query: Option<String>,
    #[serde(default)]
    pub(crate) multi_stage_retrieval_mode: Option<String>,
    #[serde(default)]
    pub(crate) local_result_limit: Option<String>,
    #[serde(default)]
    pub(crate) citation_min_confidence: Option<String>,
    #[serde(default)]
    pub(crate) book_id: Option<String>,
    #[serde(default)]
    pub(crate) scope_text: Option<String>,
    #[serde(default)]
    pub(crate) scope_label: Option<String>,
    #[serde(default)]
    pub(crate) conversation_context: Option<String>,
    #[serde(default)]
    pub(crate) mode: Option<String>,
    #[serde(default)]
    pub(crate) interaction_mode: Option<String>,
    #[serde(default)]
    pub(crate) require_cloud_api: Option<bool>,
    #[serde(default)]
    pub(crate) cloud_prompt_mode: Option<String>,
    #[serde(default)]
    pub(crate) cloud_response_format: Option<String>,
    #[serde(default)]
    pub(crate) request_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiResponsePayload {
    pub(crate) answer: String,
    pub(crate) citations: Vec<CitationPayload>,
    pub(crate) diagnostics: AiDiagnosticsPayload,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiDiagnosticsPayload {
    pub(crate) scope: String,
    pub(crate) query_used: String,
    pub(crate) chunk_count: usize,
    pub(crate) fts_available: bool,
    pub(crate) scope_empty: bool,
    pub(crate) result_count: usize,
    pub(crate) fallback_used: bool,
    pub(crate) error_kind: String,
    pub(crate) recommendations: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiProviderModelCapabilities {
    #[serde(default)]
    pub(crate) vision: bool,
    #[serde(default)]
    pub(crate) reasoning: bool,
    #[serde(default)]
    pub(crate) tool_use: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiProviderModelSettings {
    #[serde(default)]
    pub(crate) id: String,
    #[serde(default)]
    pub(crate) display_name: String,
    #[serde(default, rename = "type")]
    pub(crate) model_type: String,
    #[serde(default = "default_ai_model_context_window_tokens")]
    pub(crate) context_window_tokens: u64,
    #[serde(default = "default_ai_model_max_output_tokens")]
    pub(crate) max_output_tokens: u64,
    #[serde(default)]
    pub(crate) capabilities: AiProviderModelCapabilities,
    #[serde(default)]
    pub(crate) favorite: bool,
}

impl Default for AiProviderModelCapabilities {
    fn default() -> Self {
        Self {
            vision: false,
            reasoning: false,
            tool_use: false,
        }
    }
}

impl Default for AiProviderModelSettings {
    fn default() -> Self {
        Self {
            id: default_ai_model(),
            display_name: default_ai_model(),
            model_type: "chat".to_string(),
            context_window_tokens: default_ai_model_context_window_tokens(),
            max_output_tokens: default_ai_model_max_output_tokens(),
            capabilities: AiProviderModelCapabilities::default(),
            favorite: false,
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiProviderProfile {
    #[serde(default)]
    pub(crate) id: String,
    #[serde(default)]
    pub(crate) name: String,
    #[serde(default = "default_ai_provider_kind")]
    pub(crate) kind: String,
    #[serde(default = "default_ai_provider_enabled")]
    pub(crate) enabled: bool,
    #[serde(default)]
    pub(crate) api_key: String,
    #[serde(default = "default_ai_api_base_url")]
    pub(crate) api_base_url: String,
    #[serde(default = "default_ai_endpoint_mode")]
    pub(crate) endpoint_mode: String,
    #[serde(default = "default_ai_model")]
    pub(crate) model: String,
    #[serde(default)]
    pub(crate) models: Vec<String>,
    #[serde(default)]
    pub(crate) model_settings: HashMap<String, AiProviderModelSettings>,
    #[serde(default = "default_ai_proxy_url")]
    pub(crate) proxy_url: String,
    #[serde(default = "default_ai_custom_headers")]
    pub(crate) custom_headers: String,
    #[serde(default = "default_ai_streaming_enabled")]
    pub(crate) streaming_enabled: bool,
    #[serde(default = "default_ai_request_timeout_secs")]
    pub(crate) request_timeout_secs: u64,
    #[serde(default = "default_ai_retry_count")]
    pub(crate) retry_count: u32,
    #[serde(default = "default_ai_temperature")]
    pub(crate) temperature: f64,
    #[serde(default = "default_ai_max_tokens")]
    pub(crate) max_tokens: u32,
    #[serde(default = "default_ai_top_p")]
    pub(crate) top_p: f64,
    #[serde(default = "default_ai_reasoning_effort")]
    pub(crate) reasoning_effort: String,
    #[serde(default = "default_ai_response_format")]
    pub(crate) response_format: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TranslationSource {
    #[serde(default)]
    pub(crate) id: String,
    #[serde(default)]
    pub(crate) name: String,
    #[serde(default)]
    pub(crate) kind: String,
    #[serde(default = "default_ai_provider_enabled")]
    pub(crate) enabled: bool,
    #[serde(default)]
    pub(crate) provider_id: String,
    #[serde(default)]
    pub(crate) model: String,
    #[serde(default)]
    pub(crate) api_base_url: String,
    #[serde(default)]
    pub(crate) api_key: String,
    #[serde(default)]
    pub(crate) app_id: String,
    #[serde(default)]
    pub(crate) region: String,
    #[serde(default = "default_ai_request_timeout_secs")]
    pub(crate) request_timeout_secs: u64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TranslationRequestPayload {
    pub(crate) source_id: String,
    pub(crate) text: String,
    pub(crate) source_language: String,
    pub(crate) target_language: String,
    #[serde(default)]
    pub(crate) request_id: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TranslationResponsePayload {
    pub(crate) translated_text: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppSettings {
    #[serde(default = "default_schema_version")]
    pub(crate) schema_version: u32,
    #[serde(default = "default_trash_retention_days")]
    pub(crate) trash_retention_days: u32,
    #[serde(default = "default_trash_auto_cleanup_enabled")]
    pub(crate) trash_auto_cleanup_enabled: bool,
    #[serde(default = "default_trash_protect_reading_progress")]
    pub(crate) trash_protect_reading_progress: bool,
    #[serde(default = "default_trash_protect_reader_assets")]
    pub(crate) trash_protect_reader_assets: bool,
    #[serde(default)]
    pub(crate) ai_api_key: String,
    #[serde(default = "default_ai_api_base_url")]
    pub(crate) ai_api_base_url: String,
    #[serde(default = "default_ai_endpoint_mode")]
    pub(crate) ai_endpoint_mode: String,
    #[serde(default = "default_ai_model")]
    pub(crate) ai_model: String,
    #[serde(default = "default_ai_request_timeout_secs")]
    pub(crate) ai_request_timeout_secs: u64,
    #[serde(default = "default_ai_retry_count")]
    pub(crate) ai_retry_count: u32,
    #[serde(default = "default_ai_proxy_url")]
    pub(crate) ai_proxy_url: String,
    #[serde(default = "default_ai_custom_headers")]
    pub(crate) ai_custom_headers: String,
    #[serde(default = "default_ai_streaming_enabled")]
    pub(crate) ai_streaming_enabled: bool,
    #[serde(default = "default_ai_temperature")]
    pub(crate) ai_temperature: f64,
    #[serde(default = "default_ai_max_tokens")]
    pub(crate) ai_max_tokens: u32,
    #[serde(default = "default_ai_top_p")]
    pub(crate) ai_top_p: f64,
    #[serde(default = "default_ai_reasoning_effort")]
    pub(crate) ai_reasoning_effort: String,
    #[serde(default = "default_ai_response_format")]
    pub(crate) ai_response_format: String,
    #[serde(default = "default_ai_active_provider_profile_id")]
    pub(crate) ai_active_provider_profile_id: String,
    #[serde(default = "default_ai_provider_profiles")]
    pub(crate) ai_provider_profiles: Vec<AiProviderProfile>,
    #[serde(default = "default_translation_active_source_id")]
    pub(crate) translation_active_source_id: String,
    #[serde(default = "default_translation_sources")]
    pub(crate) translation_sources: Vec<TranslationSource>,
    #[serde(default = "default_translation_source_language")]
    pub(crate) translation_source_language: String,
    #[serde(default = "default_translation_target_language")]
    pub(crate) translation_target_language: String,
    #[serde(default = "default_ai_cancel_strategy")]
    pub(crate) ai_cancel_strategy: String,
    #[serde(default = "default_operation_log_level")]
    pub(crate) operation_log_level: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SettingsV2 {
    #[serde(default = "default_settings_schema_version")]
    pub(crate) settings_schema_version: u32,
    #[serde(default)]
    pub(crate) global: serde_json::Value,
    #[serde(default)]
    pub(crate) reader: serde_json::Value,
    #[serde(default)]
    pub(crate) extended: serde_json::Value,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CloudAiTestRequest {
    pub(crate) settings: AppSettings,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CloudAiTestResultPayload {
    pub(crate) ok: bool,
    pub(crate) status: u16,
    pub(crate) model: String,
    pub(crate) duration_ms: u128,
    pub(crate) text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CloudAiAnswerRequest {
    pub(crate) settings: AppSettings,
    pub(crate) request: AiRequestPayload,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CloudAiModelsRequest {
    pub(crate) settings: AppSettings,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CloudAiModelsPayload {
    pub(crate) models: Vec<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            schema_version: default_schema_version(),
            trash_retention_days: default_trash_retention_days(),
            trash_auto_cleanup_enabled: default_trash_auto_cleanup_enabled(),
            trash_protect_reading_progress: default_trash_protect_reading_progress(),
            trash_protect_reader_assets: default_trash_protect_reader_assets(),
            ai_api_key: String::new(),
            ai_api_base_url: default_ai_api_base_url(),
            ai_endpoint_mode: default_ai_endpoint_mode(),
            ai_model: default_ai_model(),
            ai_request_timeout_secs: default_ai_request_timeout_secs(),
            ai_retry_count: default_ai_retry_count(),
            ai_proxy_url: default_ai_proxy_url(),
            ai_custom_headers: default_ai_custom_headers(),
            ai_streaming_enabled: default_ai_streaming_enabled(),
            ai_temperature: default_ai_temperature(),
            ai_max_tokens: default_ai_max_tokens(),
            ai_top_p: default_ai_top_p(),
            ai_reasoning_effort: default_ai_reasoning_effort(),
            ai_response_format: default_ai_response_format(),
            ai_active_provider_profile_id: default_ai_active_provider_profile_id(),
            ai_provider_profiles: default_ai_provider_profiles(),
            translation_active_source_id: default_translation_active_source_id(),
            translation_sources: default_translation_sources(),
            translation_source_language: default_translation_source_language(),
            translation_target_language: default_translation_target_language(),
            ai_cancel_strategy: default_ai_cancel_strategy(),
            operation_log_level: default_operation_log_level(),
        }
    }
}

impl Default for SettingsV2 {
    fn default() -> Self {
        Self {
            settings_schema_version: default_settings_schema_version(),
            global: serde_json::json!({}),
            reader: serde_json::json!({}),
            extended: serde_json::json!({}),
        }
    }
}
