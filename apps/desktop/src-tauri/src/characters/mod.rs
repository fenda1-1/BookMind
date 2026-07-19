use crate::library::load_library_records;
use crate::models::{
    CharacterAiPostprocessApplyResult, CharacterAiPostprocessOperationPayload,
    CharacterAliasRecord, CharacterAppearanceStatRecord, CharacterCenterBookSummaryPayload,
    CharacterCenterPayload, CharacterEventRecord, CharacterEvidenceRecord,
    CharacterIndexManifestRecord, CharacterLocationRecord, CharacterMentionRecord,
    CharacterProfileRecord, CharacterReferenceQuotePayload, CharacterRelationRecord,
    CharacterSourceTextIndexRecord,
};
use crate::models::{TaskKind, TaskRecord, TaskRunStatus};
use crate::paths::character_book_dir;
use crate::search::load_book_chunk_records;
use crate::tasks::{load_index_manifest, load_task_records, save_task_records};
use std::{
    collections::{BTreeMap, HashSet},
    fs,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

const CHARACTER_SCHEMA_VERSION: &str = "bookmind.character.index.v1";
const CHARACTER_INDEX_VERSION: u32 = 11;
const MAX_CHARACTER_PROFILES: usize = 10_000;
const MAX_TOTAL_CANDIDATE_MENTIONS: usize = 100_000;
const MAX_MENTIONS_PER_CHARACTER: usize = 300;
const MAX_RELATION_CHARACTERS_PER_WINDOW: usize = 8;
const MAX_TYPED_RELATION_MENTIONS_PER_WINDOW: usize = MAX_RELATION_CHARACTERS_PER_WINDOW * 4;
const MAX_EVIDENCE_PER_RELATION: usize = 12;
const MAX_PAYLOAD_PROFILES: usize = 10_000;
const MAX_PAYLOAD_PROFILE_BYTES: usize = 256 * 1024;
const MAX_PAYLOAD_MENTIONS: usize = 20_000;
const MAX_PAYLOAD_RELATION_BYTES: usize = 128 * 1024;
const MAX_PAYLOAD_EVIDENCE: usize = 20_000;
const MAX_PAYLOAD_EVENTS: usize = 1_000;
const MAX_PAYLOAD_EVENT_BYTES: usize = 128 * 1024;
const MAX_PAYLOAD_APPEARANCE_STATS: usize = 10_000;
const MAX_PAYLOAD_APPEARANCE_STAT_BYTES: usize = 64 * 1024;
const MAX_REFERENCE_QUOTE_MENTIONS: usize = 200_000;
const MENTION_CONTEXT_CHARS: usize = 40;
const MAX_OVERVIEW_MAIN_PROFILES: usize = 5;
const MAX_OVERVIEW_RECENT_APPEARANCES: usize = 5;

mod events;
mod extraction;
mod filters;
mod ids;
mod io;
mod name_rules;
mod overview;
mod relations;
mod status;
use events::{build_appearance_stats, build_first_appearance_events, event_counts_by_character};
use extraction::{
    character_accumulator_quality, collect_character_accumulators_with_progress,
    normalize_character_name, should_keep_character_accumulator, CandidateMention,
    CharacterAccumulator,
};
use ids::{relation_evidence_index, stable_character_id, stable_hash};
use io::{
    read_json_file, read_limited_json_array_file, read_limited_jsonl_file, write_json_file,
    write_jsonl_file,
};
pub(crate) use overview::CharacterOverviewSnapshot;
use overview::{
    build_character_overview_snapshot, read_character_overview_snapshot,
    write_character_overview_snapshot,
};
use relations::{build_cooccurrence_relations, relation_counts_by_character};
use status::{build_character_book_summary, load_ready_text_index_manifest};

pub(crate) fn queue_character_extraction_in(
    data_dir: &Path,
    book_id: &str,
) -> Result<TaskRecord, String> {
    let records = load_library_records(data_dir)?;
    if !records
        .iter()
        .any(|record| record.id == book_id && !record.deleted)
    {
        return Err(format!("找不到可识别人物的书籍 {book_id}"));
    }
    let mut tasks = load_task_records(data_dir)?;
    if let Some(existing) = tasks.iter().find(|task| {
        task.book_id == book_id
            && task.kind == TaskKind::CHARACTER_EXTRACTION
            && matches!(
                task.status.as_str(),
                TaskRunStatus::QUEUED
                    | TaskRunStatus::RUNNING
                    | TaskRunStatus::PAUSED
                    | TaskRunStatus::CANCELLING
            )
    }) {
        return Ok(existing.clone());
    }
    let created_at = now_millis_string();
    let task = TaskRecord {
        id: format!("task-character-extraction-{book_id}-{created_at}"),
        book_id: book_id.to_string(),
        kind: TaskKind::CHARACTER_EXTRACTION.to_string(),
        message: "已排队人物识别，将从全文索引 chunks 中抽取人物候选和证据".to_string(),
        created_at: created_at.clone(),
        updated_at: created_at,
        ..TaskRecord::default()
    };
    tasks.push(task.clone());
    save_task_records(data_dir, &tasks)?;
    Ok(task)
}

#[allow(dead_code)]
pub(crate) fn extract_character_index_in(
    data_dir: &Path,
    book_id: &str,
) -> Result<CharacterCenterPayload, String> {
    extract_character_index_with_progress_in(data_dir, book_id, None)
}

pub(crate) fn extract_character_index_with_progress_in(
    data_dir: &Path,
    book_id: &str,
    mut progress: Option<&mut dyn FnMut(&str, f64, String) -> Result<(), String>>,
) -> Result<CharacterCenterPayload, String> {
    report_character_progress(
        &mut progress,
        "read-file",
        12.0,
        "读取全文索引 chunks".to_string(),
    )?;
    let books = load_library_records(data_dir)?;
    let book = books
        .iter()
        .find(|record| record.id == book_id && !record.deleted)
        .ok_or_else(|| format!("找不到可识别人物的书籍 {book_id}"))?;
    let text_manifest = load_ready_text_index_manifest(data_dir, book_id)?;
    let mut chunks = load_book_chunk_records(data_dir, book_id)?;
    if chunks.is_empty() {
        return Err(
            "character_index_missing_text_index: 当前书没有可用于人物识别的 chunks".to_string(),
        );
    }
    chunks.sort_by(|left, right| {
        left.chapter_index
            .cmp(&right.chapter_index)
            .then_with(|| left.ordinal.cmp(&right.ordinal))
    });

    report_character_progress(
        &mut progress,
        "build-chunks",
        28.0,
        format!("扫描 {} 个 chunks 的人物候选", chunks.len()),
    )?;
    let built_at = now_millis_string();
    let inherited_genders = load_inherited_character_genders(data_dir, book_id);
    let mut accumulator_progress = |percent: f64, message: String| -> Result<(), String> {
        report_character_progress(&mut progress, "build-chunks", percent, message)
    };
    let accumulators =
        collect_character_accumulators_with_progress(&chunks, Some(&mut accumulator_progress))?;
    report_character_progress(
        &mut progress,
        "build-chunks",
        46.0,
        format!("整理 {} 个候选人物", accumulators.len()),
    )?;
    let mut profiles = Vec::new();
    let mut mentions = Vec::new();
    let mut evidence = Vec::new();

    let mut sorted_accumulators: Vec<&CharacterAccumulator> = accumulators
        .values()
        .filter(|accumulator| should_keep_character_accumulator(accumulator))
        .collect();
    sorted_accumulators.sort_by(|left, right| {
        character_accumulator_quality(right)
            .cmp(&character_accumulator_quality(left))
            .then_with(|| right.mention_count.cmp(&left.mention_count))
            .then_with(|| left.name.cmp(&right.name))
    });

    for (profile_index, accumulator) in sorted_accumulators
        .into_iter()
        .take(MAX_CHARACTER_PROFILES)
        .enumerate()
    {
        let character_id = stable_character_id(book_id, &accumulator.name);
        let alias_id = format!("{character_id}-alias-main");
        let mention_count = accumulator.mention_count;
        let first_mention = accumulator
            .mentions
            .first()
            .expect("accumulator should have first mention");
        let last_mention = accumulator
            .last_mention
            .as_ref()
            .expect("accumulator should have last mention");
        let confidence = character_confidence(mention_count);
        let first_location = location_from_mention(book_id, first_mention);
        let last_location = location_from_mention(book_id, last_mention);
        let alias = CharacterAliasRecord {
            id: alias_id.clone(),
            book_id: book_id.to_string(),
            character_id: character_id.clone(),
            name: accumulator.name.clone(),
            normalized_name: normalize_character_name(&accumulator.name),
            kind: "name".to_string(),
            source: "rule".to_string(),
            confidence,
            mention_count,
            first_seen: first_location.clone(),
            created_at: built_at.clone(),
            updated_at: built_at.clone(),
        };
        let inherited_gender = inherited_character_gender_for(
            &inherited_genders,
            book_id,
            &accumulator.name,
            &character_id,
        );
        profiles.push(CharacterProfileRecord {
            id: character_id.clone(),
            book_id: book_id.to_string(),
            canonical_name: accumulator.name.clone(),
            display_name: accumulator.name.clone(),
            kind: "person".to_string(),
            role: if profile_index == 0 {
                "main"
            } else {
                "unknown"
            }
            .to_string(),
            gender: inherited_gender,
            aliases: vec![alias],
            summary: format!("本地规则识别到 {mention_count} 次出场。"),
            tags: Vec::new(),
            importance_score: (mention_count as f32).min(100.0),
            confidence,
            first_appearance: first_location,
            last_appearance: last_location,
            mention_count,
            relation_count: 0,
            event_count: 0,
            faction_memberships: Vec::new(),
            hidden: false,
            merged_into_character_id: String::new(),
            source: "rule".to_string(),
            created_at: built_at.clone(),
            updated_at: built_at.clone(),
        });

        for (mention_index, mention) in accumulator.mentions.iter().enumerate() {
            let mention_id = format!("{character_id}-mention-{mention_index}");
            let location = location_from_mention(book_id, mention);
            mentions.push(CharacterMentionRecord {
                id: mention_id.clone(),
                book_id: book_id.to_string(),
                character_id: character_id.clone(),
                alias_id: alias_id.clone(),
                name: mention.name.clone(),
                normalized_name: normalize_character_name(&mention.name),
                location: location.clone(),
                quote: mention.quote.clone(),
                prefix_text: mention.prefix_text.clone(),
                suffix_text: mention.suffix_text.clone(),
                context_hash: stable_hash(&format!(
                    "{}:{}:{}:{}",
                    mention.chunk_id, mention.name, mention.start_char, mention.end_char
                )),
                confidence,
                source: "rule".to_string(),
                created_at: built_at.clone(),
            });
            evidence.push(CharacterEvidenceRecord {
                id: format!("{character_id}-evidence-{mention_index}"),
                book_id: book_id.to_string(),
                target_type: "mention".to_string(),
                target_id: mention_id,
                claim: format!("{} 在原文中出现。", mention.name),
                quote: mention.quote.clone(),
                location,
                evidence_hash: stable_hash(&format!(
                    "{}:{}:{}",
                    mention.chunk_id, mention.name, mention.start_char
                )),
                confidence,
                source: "rule".to_string(),
                status: "valid".to_string(),
                created_at: built_at.clone(),
                updated_at: built_at.clone(),
            });
        }
    }

    report_character_progress(
        &mut progress,
        "build-chunks",
        64.0,
        format!(
            "生成人物关系：{} 个人物，{} 条 mention",
            profiles.len(),
            mentions.len()
        ),
    )?;
    let (relations, mut relation_evidence) =
        build_cooccurrence_relations(book_id, &mentions, &built_at);
    report_character_progress(
        &mut progress,
        "build-chunks",
        76.0,
        format!("整理关系证据：{} 条关系", relations.len()),
    )?;
    let relation_count_by_character = relation_counts_by_character(&relations);
    let events = build_first_appearance_events(book_id, &profiles, &evidence, &built_at);
    let event_count_by_character = event_counts_by_character(&events);
    let appearance_stats = build_appearance_stats(book_id, &profiles, &accumulators);
    for profile in &mut profiles {
        profile.relation_count = *relation_count_by_character.get(&profile.id).unwrap_or(&0);
        profile.event_count = *event_count_by_character.get(&profile.id).unwrap_or(&0);
    }
    relation_evidence.sort_by(|left, right| {
        relation_evidence_index(&left.id)
            .cmp(&relation_evidence_index(&right.id))
            .then_with(|| left.target_id.cmp(&right.target_id))
            .then_with(|| left.id.cmp(&right.id))
    });
    let mention_evidence = evidence;
    let mut evidence = relation_evidence;
    evidence.extend(mention_evidence);

    let manifest = CharacterIndexManifestRecord {
        schema_version: CHARACTER_SCHEMA_VERSION.to_string(),
        book_id: book.id.clone(),
        book_title: book.display_title.clone(),
        content_hash: book.content_hash.clone(),
        text_index_content_hash: text_manifest.content_hash.clone(),
        index_version: CHARACTER_INDEX_VERSION,
        chunk_strategy_version: text_manifest.chunk_strategy_version,
        chapter_rule_version: text_manifest.chapter_rule_version,
        status: "ready".to_string(),
        extraction_mode: "rule".to_string(),
        built_at: built_at.clone(),
        updated_at: built_at.clone(),
        stale_reason: String::new(),
        last_error: String::new(),
        character_count: profiles.len(),
        alias_count: profiles.iter().map(|profile| profile.aliases.len()).sum(),
        mention_count: profiles.iter().map(|profile| profile.mention_count).sum(),
        relation_count: relations.len(),
        evidence_count: evidence.len(),
        event_count: events.len(),
        faction_count: 0,
        source_text_index: CharacterSourceTextIndexRecord {
            status: text_manifest.status.clone(),
            built_at: text_manifest.built_at.clone(),
            chunk_count: text_manifest.chunk_count,
            fts_row_count: text_manifest.fts_row_count,
        },
    };

    report_character_progress(
        &mut progress,
        "write-chunks",
        86.0,
        format!(
            "写入人物索引：{} 人物 · {} 关系 · {} 证据",
            manifest.character_count, manifest.relation_count, manifest.evidence_count
        ),
    )?;
    save_character_outputs(
        data_dir,
        book_id,
        &manifest,
        &profiles,
        &mentions,
        &relations,
        &evidence,
        &events,
        &appearance_stats,
    )?;
    report_character_progress(
        &mut progress,
        "verify",
        96.0,
        "校验人物索引 payload".to_string(),
    )?;
    load_character_center_payload_in(data_dir, book_id)
}

pub(crate) fn load_character_center_payload_in(
    data_dir: &Path,
    book_id: &str,
) -> Result<CharacterCenterPayload, String> {
    let books = load_library_records(data_dir)?;
    let book = books
        .iter()
        .find(|record| record.id == book_id)
        .ok_or_else(|| format!("找不到书籍 {book_id}"))?;
    let manifest = load_character_manifest(data_dir, book_id)?;
    let profiles: Vec<CharacterProfileRecord> = read_limited_json_array_file(
        &character_book_dir(data_dir, book_id).join("profiles.json"),
        MAX_PAYLOAD_PROFILES,
        MAX_PAYLOAD_PROFILE_BYTES,
        "单个人物档案",
    )?;
    let mentions: Vec<CharacterMentionRecord> = read_limited_jsonl_file(
        &character_book_dir(data_dir, book_id).join("mentions.jsonl"),
        MAX_PAYLOAD_MENTIONS,
    )?;
    let mut relations: Vec<CharacterRelationRecord> = read_limited_json_array_file(
        &character_book_dir(data_dir, book_id).join("relations.json"),
        manifest.relation_count,
        MAX_PAYLOAD_RELATION_BYTES,
        "单个人物关系",
    )?;
    let evidence: Vec<CharacterEvidenceRecord> = read_limited_jsonl_file(
        &character_book_dir(data_dir, book_id).join("evidence.jsonl"),
        MAX_PAYLOAD_EVIDENCE,
    )?;
    let mut events: Vec<CharacterEventRecord> = read_limited_json_array_file(
        &character_book_dir(data_dir, book_id).join("events.json"),
        MAX_PAYLOAD_EVENTS,
        MAX_PAYLOAD_EVENT_BYTES,
        "单个人物事件",
    )?;
    let appearance_stats: Vec<CharacterAppearanceStatRecord> = read_limited_json_array_file(
        &character_book_dir(data_dir, book_id).join("appearance-stats.json"),
        MAX_PAYLOAD_APPEARANCE_STATS,
        MAX_PAYLOAD_APPEARANCE_STAT_BYTES,
        "单个人物出场统计",
    )?;
    let available_evidence_ids: HashSet<&str> =
        evidence.iter().map(|item| item.id.as_str()).collect();
    relations.retain_mut(|relation| {
        relation
            .evidence_ids
            .retain(|id| available_evidence_ids.contains(id.as_str()));
        true
    });
    events.retain_mut(|event| {
        event
            .evidence_ids
            .retain(|id| available_evidence_ids.contains(id.as_str()));
        !event.evidence_ids.is_empty()
    });
    Ok(CharacterCenterPayload {
        book: build_character_book_summary(data_dir, book, Some(&manifest)),
        manifest,
        profiles,
        mentions,
        relations,
        evidence,
        events,
        faction_memberships: Vec::new(),
        appearance_stats,
        loaded_at: now_millis_string(),
    })
}

pub(crate) fn apply_character_ai_postprocess_in(
    data_dir: &Path,
    book_id: &str,
    operations: &[CharacterAiPostprocessOperationPayload],
) -> Result<CharacterAiPostprocessApplyResult, String> {
    let book_dir = character_book_dir(data_dir, book_id);
    let profile_path = book_dir.join("profiles.json");
    let mut profiles: Vec<CharacterProfileRecord> = read_limited_json_array_file(
        &profile_path,
        MAX_PAYLOAD_PROFILES,
        MAX_PAYLOAD_PROFILE_BYTES,
        "单个人物档案",
    )?;
    let mut updated_count = 0usize;
    let mut hidden_count = 0usize;
    let mut gender_count = 0usize;
    let updated_at = now_millis_string();
    for operation in operations {
        let Some(profile) = profiles
            .iter_mut()
            .find(|item| item.id == operation.profile_id)
        else {
            continue;
        };
        if operation.operation_type == "gender" {
            let gender = normalize_character_gender(&operation.gender);
            if profile.gender != gender {
                profile.gender = gender;
                profile.updated_at = updated_at.clone();
                updated_count += 1;
                gender_count += 1;
            }
        } else if operation.operation_type == "noise" && operation.hidden && !profile.hidden {
            profile.hidden = true;
            profile.updated_at = updated_at.clone();
            updated_count += 1;
            hidden_count += 1;
        }
    }
    write_json_file(&profile_path, &profiles)?;
    let _ = fs::remove_file(book_dir.join("overview.json"));
    Ok(CharacterAiPostprocessApplyResult {
        updated_count,
        hidden_count,
        gender_count,
    })
}

pub(crate) fn load_character_reference_quotes_in(
    data_dir: &Path,
    book_id: &str,
) -> Result<Vec<CharacterReferenceQuotePayload>, String> {
    let profiles: Vec<CharacterProfileRecord> = read_limited_json_array_file(
        &character_book_dir(data_dir, book_id).join("profiles.json"),
        MAX_PAYLOAD_PROFILES,
        MAX_PAYLOAD_PROFILE_BYTES,
        "单个人物档案",
    )?;
    let profile_ids: HashSet<String> = profiles.into_iter().map(|profile| profile.id).collect();
    let mentions: Vec<CharacterMentionRecord> = read_limited_jsonl_file(
        &character_book_dir(data_dir, book_id).join("mentions.jsonl"),
        MAX_REFERENCE_QUOTE_MENTIONS,
    )?;
    let mut seen = HashSet::new();
    let mut quotes = Vec::new();
    for mention in mentions {
        if !profile_ids.contains(&mention.character_id) || seen.contains(&mention.character_id) {
            continue;
        }
        let quote = mention.quote.trim();
        if quote.is_empty() {
            continue;
        }
        seen.insert(mention.character_id.clone());
        quotes.push(CharacterReferenceQuotePayload {
            character_id: mention.character_id,
            quote: quote.chars().take(160).collect(),
        });
    }
    Ok(quotes)
}

pub(crate) fn load_character_overview_snapshot_in(
    data_dir: &Path,
    book_id: &str,
) -> Result<CharacterOverviewSnapshot, String> {
    let book_dir = character_book_dir(data_dir, book_id);
    if let Some(snapshot) = read_character_overview_snapshot(&book_dir)? {
        return Ok(snapshot);
    }
    let manifest = load_character_manifest(data_dir, book_id)?;
    let profiles: Vec<CharacterProfileRecord> = read_limited_json_array_file(
        &book_dir.join("profiles.json"),
        MAX_PAYLOAD_PROFILES,
        MAX_PAYLOAD_PROFILE_BYTES,
        "单个人物档案",
    )?;
    let relations: Vec<CharacterRelationRecord> = read_limited_json_array_file(
        &book_dir.join("relations.json"),
        manifest.relation_count,
        MAX_PAYLOAD_RELATION_BYTES,
        "单个人物关系",
    )?;
    let evidence: Vec<CharacterEvidenceRecord> =
        read_limited_jsonl_file(&book_dir.join("evidence.jsonl"), MAX_PAYLOAD_EVIDENCE)?;
    let appearance_stats: Vec<CharacterAppearanceStatRecord> = read_limited_json_array_file(
        &book_dir.join("appearance-stats.json"),
        MAX_PAYLOAD_APPEARANCE_STATS,
        MAX_PAYLOAD_APPEARANCE_STAT_BYTES,
        "单个人物出场统计",
    )?;
    let total_chapter_count = load_index_manifest(data_dir)
        .ok()
        .and_then(|items| items.into_iter().find(|item| item.book_id == book_id))
        .map(|item| item.chapter_count)
        .unwrap_or(0);
    let snapshot = build_character_overview_snapshot(
        &manifest,
        &profiles,
        &relations,
        &evidence,
        &appearance_stats,
        total_chapter_count,
    );
    write_character_overview_snapshot(&book_dir, &snapshot)?;
    Ok(snapshot)
}

pub(crate) fn load_character_center_book_summaries_in(
    data_dir: &Path,
) -> Result<Vec<CharacterCenterBookSummaryPayload>, String> {
    let books = load_library_records(data_dir)?;
    Ok(books
        .iter()
        .filter(|book| !book.deleted)
        .map(|book| {
            let character_manifest = load_character_manifest(data_dir, &book.id).ok();
            build_character_book_summary(data_dir, book, character_manifest.as_ref())
        })
        .collect())
}

pub(crate) fn mark_character_index_failed_in(
    data_dir: &Path,
    book_id: &str,
    error_code: &str,
    error_message: &str,
    stage: &str,
    task_id: &str,
) -> Result<(), String> {
    let books = load_library_records(data_dir)?;
    let book = books
        .iter()
        .find(|record| record.id == book_id)
        .ok_or_else(|| format!("找不到书籍 {book_id}"))?;
    let text_manifest = load_index_manifest(data_dir)
        .ok()
        .and_then(|items| items.into_iter().find(|item| item.book_id == book_id));
    let now = now_millis_string();
    let manifest = CharacterIndexManifestRecord {
        schema_version: CHARACTER_SCHEMA_VERSION.to_string(),
        book_id: book.id.clone(),
        book_title: book.display_title.clone(),
        content_hash: book.content_hash.clone(),
        text_index_content_hash: text_manifest
            .as_ref()
            .map(|item| item.content_hash.clone())
            .unwrap_or_default(),
        index_version: CHARACTER_INDEX_VERSION,
        chunk_strategy_version: text_manifest
            .as_ref()
            .map(|item| item.chunk_strategy_version)
            .unwrap_or_default(),
        chapter_rule_version: text_manifest
            .as_ref()
            .map(|item| item.chapter_rule_version)
            .unwrap_or_default(),
        status: "failed".to_string(),
        extraction_mode: "rule".to_string(),
        built_at: now.clone(),
        updated_at: now.clone(),
        stale_reason: String::new(),
        last_error: error_message.to_string(),
        character_count: 0,
        alias_count: 0,
        mention_count: 0,
        relation_count: 0,
        evidence_count: 0,
        event_count: 0,
        faction_count: 0,
        source_text_index: CharacterSourceTextIndexRecord {
            status: text_manifest
                .as_ref()
                .map(|item| item.status.clone())
                .unwrap_or_else(|| "missing".to_string()),
            built_at: text_manifest
                .as_ref()
                .map(|item| item.built_at.clone())
                .unwrap_or_default(),
            chunk_count: text_manifest
                .as_ref()
                .map(|item| item.chunk_count)
                .unwrap_or(0),
            fts_row_count: text_manifest
                .as_ref()
                .map(|item| item.fts_row_count)
                .unwrap_or(0),
        },
    };
    save_character_outputs(data_dir, book_id, &manifest, &[], &[], &[], &[], &[], &[])?;
    write_json_file(
        &character_book_dir(data_dir, book_id).join("last-error.json"),
        &serde_json::json!({
            "schema": "bookmind.character.error.v1",
            "bookId": book_id,
            "taskId": task_id,
            "errorCode": error_code,
            "errorMessage": error_message,
            "stage": stage,
            "createdAt": now,
        }),
    )
}

pub(crate) fn load_character_manifest(
    data_dir: &Path,
    book_id: &str,
) -> Result<CharacterIndexManifestRecord, String> {
    read_json_file(&character_book_dir(data_dir, book_id).join("manifest.json"))
}

fn character_confidence(mention_count: usize) -> f32 {
    (0.62 + mention_count.min(6) as f32 * 0.05).min(0.95)
}

fn normalize_character_gender(value: &str) -> String {
    match value {
        "male" | "female" => value.to_string(),
        _ => "unknown".to_string(),
    }
}

fn load_inherited_character_genders(data_dir: &Path, book_id: &str) -> BTreeMap<String, String> {
    let profile_path = character_book_dir(data_dir, book_id).join("profiles.json");
    let Ok(profiles) = read_limited_json_array_file::<CharacterProfileRecord>(
        &profile_path,
        MAX_PAYLOAD_PROFILES,
        MAX_PAYLOAD_PROFILE_BYTES,
        "单个人物档案",
    ) else {
        return BTreeMap::new();
    };
    let mut genders = BTreeMap::new();
    for profile in profiles {
        let gender = normalize_character_gender(&profile.gender);
        if gender == "unknown" {
            continue;
        }
        insert_inherited_gender_key(&mut genders, &profile.id, &gender);
        insert_inherited_gender_key(
            &mut genders,
            &normalize_character_name(&profile.canonical_name),
            &gender,
        );
        insert_inherited_gender_key(
            &mut genders,
            &normalize_character_name(&profile.display_name),
            &gender,
        );
        for alias in profile.aliases {
            insert_inherited_gender_key(
                &mut genders,
                &normalize_character_name(&alias.name),
                &gender,
            );
        }
    }
    genders
}

fn inherited_character_gender_for(
    genders: &BTreeMap<String, String>,
    book_id: &str,
    name: &str,
    character_id: &str,
) -> String {
    let normalized_name = normalize_character_name(name);
    genders
        .get(character_id)
        .or_else(|| genders.get(&stable_character_id(book_id, name)))
        .or_else(|| genders.get(&normalized_name))
        .cloned()
        .unwrap_or_else(|| "unknown".to_string())
}

fn insert_inherited_gender_key(genders: &mut BTreeMap<String, String>, key: &str, gender: &str) {
    if key.trim().is_empty() {
        return;
    }
    genders
        .entry(key.to_string())
        .or_insert_with(|| gender.to_string());
}

fn location_from_mention(book_id: &str, mention: &CandidateMention) -> CharacterLocationRecord {
    CharacterLocationRecord {
        book_id: book_id.to_string(),
        chapter_id: format!("chapter-{}", mention.chapter_index),
        chapter_index: mention.chapter_index,
        source_chapter_index: mention.chapter_index,
        visible_chapter_position: mention.chapter_index.saturating_add(1),
        chapter_title: if mention.chapter_title.is_empty() {
            mention.chapter.clone()
        } else {
            mention.chapter_title.clone()
        },
        paragraph_index: mention.paragraph_start,
        paragraph_start: mention.paragraph_start,
        paragraph_end: mention.paragraph_end,
        start_offset: mention.start_char,
        end_offset: mention.end_char,
        chunk_id: mention.chunk_id.clone(),
    }
}

fn save_character_outputs(
    data_dir: &Path,
    book_id: &str,
    manifest: &CharacterIndexManifestRecord,
    profiles: &[CharacterProfileRecord],
    mentions: &[CharacterMentionRecord],
    relations: &[CharacterRelationRecord],
    evidence: &[CharacterEvidenceRecord],
    events: &[CharacterEventRecord],
    appearance_stats: &[CharacterAppearanceStatRecord],
) -> Result<(), String> {
    let dir = character_book_dir(data_dir, book_id);
    fs::create_dir_all(&dir)
        .map_err(|error| format!("无法创建人物中心目录 {}: {error}", dir.display()))?;
    let total_chapter_count = load_index_manifest(data_dir)
        .ok()
        .and_then(|items| items.into_iter().find(|item| item.book_id == book_id))
        .map(|item| item.chapter_count)
        .unwrap_or(0);
    let overview = build_character_overview_snapshot(
        manifest,
        profiles,
        relations,
        evidence,
        appearance_stats,
        total_chapter_count,
    );
    write_json_file(&dir.join("profiles.json"), profiles)?;
    write_jsonl_file(&dir.join("mentions.jsonl"), mentions)?;
    write_jsonl_file(&dir.join("evidence.jsonl"), evidence)?;
    write_json_file(&dir.join("relations.json"), relations)?;
    write_json_file(&dir.join("events.json"), events)?;
    write_json_file(&dir.join("appearance-stats.json"), appearance_stats)?;
    write_character_overview_snapshot(&dir, &overview)?;
    write_json_file(&dir.join("manifest.json"), manifest)
}

fn now_millis_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_default()
}

fn report_character_progress(
    progress: &mut Option<&mut dyn FnMut(&str, f64, String) -> Result<(), String>>,
    stage: &str,
    progress_percent: f64,
    message: String,
) -> Result<(), String> {
    if let Some(callback) = progress.as_deref_mut() {
        callback(stage, progress_percent, message)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests;
