use super::*;

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterLocationRecord {
    pub(crate) book_id: String,
    #[serde(default)]
    pub(crate) chapter_id: String,
    #[serde(default)]
    pub(crate) chapter_index: usize,
    #[serde(default)]
    pub(crate) source_chapter_index: usize,
    #[serde(default)]
    pub(crate) visible_chapter_position: usize,
    #[serde(default)]
    pub(crate) chapter_title: String,
    #[serde(default)]
    pub(crate) paragraph_index: usize,
    #[serde(default)]
    pub(crate) paragraph_start: usize,
    #[serde(default)]
    pub(crate) paragraph_end: usize,
    #[serde(default)]
    pub(crate) start_offset: usize,
    #[serde(default)]
    pub(crate) end_offset: usize,
    #[serde(default)]
    pub(crate) chunk_id: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterAliasRecord {
    pub(crate) id: String,
    pub(crate) book_id: String,
    pub(crate) character_id: String,
    pub(crate) name: String,
    pub(crate) normalized_name: String,
    pub(crate) kind: String,
    pub(crate) source: String,
    pub(crate) confidence: f32,
    pub(crate) mention_count: usize,
    pub(crate) first_seen: CharacterLocationRecord,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterMentionRecord {
    pub(crate) id: String,
    pub(crate) book_id: String,
    pub(crate) character_id: String,
    pub(crate) alias_id: String,
    pub(crate) name: String,
    pub(crate) normalized_name: String,
    pub(crate) location: CharacterLocationRecord,
    pub(crate) quote: String,
    pub(crate) prefix_text: String,
    pub(crate) suffix_text: String,
    pub(crate) context_hash: String,
    pub(crate) confidence: f32,
    pub(crate) source: String,
    pub(crate) created_at: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterEvidenceRecord {
    pub(crate) id: String,
    pub(crate) book_id: String,
    pub(crate) target_type: String,
    pub(crate) target_id: String,
    pub(crate) claim: String,
    pub(crate) quote: String,
    pub(crate) location: CharacterLocationRecord,
    pub(crate) evidence_hash: String,
    pub(crate) confidence: f32,
    pub(crate) source: String,
    pub(crate) status: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterRelationRecord {
    pub(crate) id: String,
    pub(crate) book_id: String,
    pub(crate) source_character_id: String,
    pub(crate) target_character_id: String,
    pub(crate) relation_type: String,
    pub(crate) label: String,
    pub(crate) summary: String,
    pub(crate) direction: String,
    pub(crate) confidence: f32,
    pub(crate) evidence_ids: Vec<String>,
    pub(crate) first_seen: CharacterLocationRecord,
    pub(crate) last_seen: CharacterLocationRecord,
    pub(crate) status: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterEventRecord {
    pub(crate) id: String,
    pub(crate) book_id: String,
    #[serde(default)]
    pub(crate) title: String,
    #[serde(default)]
    pub(crate) summary: String,
    #[serde(default)]
    pub(crate) event_type: String,
    #[serde(default, alias = "characterIds")]
    pub(crate) participant_character_ids: Vec<String>,
    #[serde(default)]
    pub(crate) location: CharacterLocationRecord,
    #[serde(default)]
    pub(crate) chapter_label: String,
    #[serde(default)]
    pub(crate) evidence_ids: Vec<String>,
    #[serde(default)]
    pub(crate) confidence: f32,
    #[serde(default)]
    pub(crate) source: String,
    #[serde(default)]
    pub(crate) created_at: String,
    #[serde(default)]
    pub(crate) updated_at: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterAppearanceStatRecord {
    pub(crate) id: String,
    pub(crate) book_id: String,
    pub(crate) character_id: String,
    #[serde(default)]
    pub(crate) chapter_index: usize,
    #[serde(default)]
    pub(crate) source_chapter_index: usize,
    #[serde(default)]
    pub(crate) chapter_title: String,
    #[serde(default)]
    pub(crate) mention_count: usize,
    #[serde(default)]
    pub(crate) evidence_count: usize,
    #[serde(default)]
    pub(crate) first_paragraph_index: usize,
    #[serde(default)]
    pub(crate) last_paragraph_index: usize,
    #[serde(default)]
    pub(crate) heat: f32,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterProfileRecord {
    pub(crate) id: String,
    pub(crate) book_id: String,
    pub(crate) canonical_name: String,
    pub(crate) display_name: String,
    pub(crate) kind: String,
    pub(crate) role: String,
    #[serde(default = "default_character_gender")]
    pub(crate) gender: String,
    pub(crate) aliases: Vec<CharacterAliasRecord>,
    pub(crate) summary: String,
    pub(crate) tags: Vec<String>,
    pub(crate) importance_score: f32,
    pub(crate) confidence: f32,
    pub(crate) first_appearance: CharacterLocationRecord,
    pub(crate) last_appearance: CharacterLocationRecord,
    pub(crate) mention_count: usize,
    pub(crate) relation_count: usize,
    pub(crate) event_count: usize,
    pub(crate) faction_memberships: Vec<serde_json::Value>,
    pub(crate) hidden: bool,
    pub(crate) merged_into_character_id: String,
    pub(crate) source: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

fn default_character_gender() -> String {
    "unknown".to_string()
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterAiPostprocessOperationPayload {
    pub operation_type: String,
    pub profile_id: String,
    #[serde(default)]
    pub gender: String,
    #[serde(default)]
    pub hidden: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterAiPostprocessApplyResult {
    pub updated_count: usize,
    pub hidden_count: usize,
    pub gender_count: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterReferenceQuotePayload {
    pub character_id: String,
    pub quote: String,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterSourceTextIndexRecord {
    pub(crate) status: String,
    pub(crate) built_at: String,
    pub(crate) chunk_count: usize,
    pub(crate) fts_row_count: usize,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterIndexManifestRecord {
    pub(crate) schema_version: String,
    pub(crate) book_id: String,
    pub(crate) book_title: String,
    pub(crate) content_hash: String,
    pub(crate) text_index_content_hash: String,
    pub(crate) index_version: u32,
    pub(crate) chunk_strategy_version: u32,
    pub(crate) chapter_rule_version: u32,
    pub(crate) status: String,
    pub(crate) extraction_mode: String,
    pub(crate) built_at: String,
    pub(crate) updated_at: String,
    pub(crate) stale_reason: String,
    pub(crate) last_error: String,
    pub(crate) character_count: usize,
    pub(crate) alias_count: usize,
    pub(crate) mention_count: usize,
    pub(crate) relation_count: usize,
    pub(crate) evidence_count: usize,
    pub(crate) event_count: usize,
    pub(crate) faction_count: usize,
    pub(crate) source_text_index: CharacterSourceTextIndexRecord,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterCenterBookSummaryPayload {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) display_title: String,
    pub(crate) author: String,
    pub(crate) file_name: String,
    pub(crate) cover_tone: String,
    pub(crate) progress: u8,
    pub(crate) text_index_status: String,
    pub(crate) text_index_ready: bool,
    pub(crate) text_index_chunk_count: usize,
    pub(crate) text_index_fts_rows: usize,
    pub(crate) character_index_status: String,
    pub(crate) character_count: usize,
    pub(crate) relation_count: usize,
    pub(crate) evidence_count: usize,
    pub(crate) last_character_built_at: String,
    pub(crate) stale_reason: String,
    pub(crate) last_error: String,
    pub(crate) last_task_id: String,
    pub(crate) error_code: String,
    pub(crate) error_stage: String,
    pub(crate) recent_log_entry: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterCenterPayload {
    pub(crate) book: CharacterCenterBookSummaryPayload,
    pub(crate) manifest: CharacterIndexManifestRecord,
    pub(crate) profiles: Vec<CharacterProfileRecord>,
    pub(crate) mentions: Vec<CharacterMentionRecord>,
    pub(crate) relations: Vec<CharacterRelationRecord>,
    pub(crate) evidence: Vec<CharacterEvidenceRecord>,
    pub(crate) events: Vec<CharacterEventRecord>,
    pub(crate) faction_memberships: Vec<serde_json::Value>,
    pub(crate) appearance_stats: Vec<CharacterAppearanceStatRecord>,
    pub(crate) loaded_at: String,
}
