use super::*;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NoteRecord {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) body: String,
    pub(crate) source: String,
    pub(crate) created_at: String,
    pub(crate) citations: Vec<CitationPayload>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) save_target: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) reader_location: Option<ReaderLocationPayload>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) ai_metadata: Option<AiNoteMetadataPayload>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) structured_response: Option<serde_json::Value>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveNoteRequest {
    pub(crate) title: String,
    pub(crate) body: String,
    pub(crate) citations: Vec<CitationPayload>,
    #[serde(default)]
    pub(crate) save_target: Option<String>,
    #[serde(default)]
    pub(crate) reader_location: Option<ReaderLocationPayload>,
    #[serde(default)]
    pub(crate) ai_metadata: Option<AiNoteMetadataPayload>,
    #[serde(default)]
    pub(crate) structured_response: Option<serde_json::Value>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiNoteMetadataPayload {
    pub(crate) instruction: String,
    pub(crate) scope: String,
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
    pub(crate) model: String,
    pub(crate) saved_at: String,
    #[serde(default)]
    pub(crate) schema: Option<String>,
    #[serde(default)]
    pub(crate) mode: Option<String>,
    #[serde(default)]
    pub(crate) interaction_mode: Option<String>,
    #[serde(default)]
    pub(crate) generated_at: Option<String>,
    #[serde(default)]
    pub(crate) citation_coverage: Option<String>,
    #[serde(default)]
    pub(crate) book_range: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReaderLocationPayload {
    pub(crate) book_id: String,
    #[serde(default)]
    pub(crate) chapter_id: Option<String>,
    #[serde(default)]
    pub(crate) source_chapter_index: Option<usize>,
    #[serde(default)]
    pub(crate) paragraph_index: Option<usize>,
    #[serde(default)]
    pub(crate) start_offset: Option<usize>,
    #[serde(default)]
    pub(crate) end_offset: Option<usize>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HighlightRecord {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) text: String,
    pub(crate) target_id: String,
    pub(crate) created_at: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FlashcardRecord {
    pub(crate) id: String,
    pub(crate) front: String,
    pub(crate) back: String,
    pub(crate) source_label: String,
    pub(crate) source_target_id: String,
    pub(crate) created_at: String,
    #[serde(default)]
    pub(crate) tags: Vec<String>,
    #[serde(default)]
    pub(crate) citation_ids: Vec<String>,
    #[serde(default)]
    pub(crate) chapter: Option<String>,
    #[serde(default)]
    pub(crate) review_status: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiGeneratedFlashcardRequest {
    pub(crate) front: String,
    pub(crate) back: String,
    pub(crate) source_label: String,
    pub(crate) source_target_id: String,
    #[serde(default)]
    pub(crate) tags: Vec<String>,
    #[serde(default)]
    pub(crate) citation_ids: Vec<String>,
    #[serde(default)]
    pub(crate) chapter: Option<String>,
    #[serde(default)]
    pub(crate) review_status: Option<String>,
}
