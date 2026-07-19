use crate::models::{
    CharacterAppearanceStatRecord, CharacterEvidenceRecord, CharacterIndexManifestRecord,
    CharacterLocationRecord, CharacterProfileRecord, CharacterRelationRecord,
};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::path::Path;

use super::io::{read_json_file, write_json_file};
use super::{MAX_OVERVIEW_MAIN_PROFILES, MAX_OVERVIEW_RECENT_APPEARANCES};
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterOverviewSnapshot {
    pub(crate) book_id: String,
    pub(crate) built_at: String,
    pub(crate) stats: Vec<CharacterOverviewSnapshotStat>,
    pub(crate) main_profiles: Vec<CharacterOverviewSnapshotProfile>,
    pub(crate) recent_appearances: Vec<CharacterOverviewSnapshotAppearance>,
    pub(crate) review_issue_count: usize,
    pub(crate) covered_chapter_count: usize,
    pub(crate) total_chapter_count: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterOverviewSnapshotStat {
    pub(crate) id: String,
    pub(crate) value: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterOverviewSnapshotProfile {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) mention_count: usize,
    pub(crate) relation_count: usize,
    pub(crate) rank_label: String,
    pub(crate) location: Option<CharacterLocationRecord>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterOverviewSnapshotAppearance {
    pub(crate) id: String,
    pub(crate) character_id: String,
    pub(crate) name: String,
    pub(crate) chapter_index: usize,
    pub(crate) chapter_title: String,
    pub(crate) mention_count: usize,
    pub(crate) location: Option<CharacterLocationRecord>,
}

pub(super) fn build_character_overview_snapshot(
    manifest: &CharacterIndexManifestRecord,
    profiles: &[CharacterProfileRecord],
    relations: &[CharacterRelationRecord],
    evidence: &[CharacterEvidenceRecord],
    appearance_stats: &[CharacterAppearanceStatRecord],
    total_chapter_count: usize,
) -> CharacterOverviewSnapshot {
    let mut visible_profiles: Vec<&CharacterProfileRecord> =
        profiles.iter().filter(|profile| !profile.hidden).collect();
    visible_profiles.sort_by(compare_overview_profiles);
    let main_profiles = visible_profiles
        .iter()
        .take(MAX_OVERVIEW_MAIN_PROFILES)
        .enumerate()
        .map(|(index, profile)| CharacterOverviewSnapshotProfile {
            id: profile.id.clone(),
            name: if profile.display_name.is_empty() {
                profile.canonical_name.clone()
            } else {
                profile.display_name.clone()
            },
            mention_count: profile.mention_count,
            relation_count: profile.relation_count,
            rank_label: format!("#{}", index + 1),
            location: Some(profile.first_appearance.clone()),
        })
        .collect();
    let recent_appearances = build_overview_recent_appearances(&visible_profiles, appearance_stats);
    let covered_chapter_count =
        count_overview_covered_chapters(appearance_stats, evidence, total_chapter_count);
    let review_issue_count = count_overview_review_issues(profiles, relations, evidence);
    let chapter_coverage_value = if total_chapter_count == 0 {
        "-".to_string()
    } else {
        format!(
            "{}%",
            ((covered_chapter_count as f32 / total_chapter_count as f32) * 100.0)
                .round()
                .clamp(0.0, 100.0) as usize
        )
    };

    CharacterOverviewSnapshot {
        book_id: manifest.book_id.clone(),
        built_at: manifest.built_at.clone(),
        stats: vec![
            overview_stat("characters", visible_profiles.len()),
            overview_stat("relations", relations.len()),
            overview_stat("evidence", evidence.len()),
            CharacterOverviewSnapshotStat {
                id: "chapter-coverage".to_string(),
                value: chapter_coverage_value,
            },
            overview_stat("review", review_issue_count),
        ],
        main_profiles,
        recent_appearances,
        review_issue_count,
        covered_chapter_count,
        total_chapter_count,
    }
}

fn compare_overview_profiles(
    left: &&CharacterProfileRecord,
    right: &&CharacterProfileRecord,
) -> std::cmp::Ordering {
    right
        .importance_score
        .partial_cmp(&left.importance_score)
        .unwrap_or(std::cmp::Ordering::Equal)
        .then_with(|| right.mention_count.cmp(&left.mention_count))
        .then_with(|| right.relation_count.cmp(&left.relation_count))
        .then_with(|| left.display_name.cmp(&right.display_name))
}

fn build_overview_recent_appearances(
    profiles: &[&CharacterProfileRecord],
    appearance_stats: &[CharacterAppearanceStatRecord],
) -> Vec<CharacterOverviewSnapshotAppearance> {
    let profile_by_id: BTreeMap<&str, &CharacterProfileRecord> = profiles
        .iter()
        .map(|profile| (profile.id.as_str(), *profile))
        .collect();
    let mut latest_by_character: BTreeMap<&str, &CharacterAppearanceStatRecord> = BTreeMap::new();
    for appearance in appearance_stats {
        if !profile_by_id.contains_key(appearance.character_id.as_str()) {
            continue;
        }
        let current = latest_by_character
            .get(appearance.character_id.as_str())
            .copied();
        if current
            .map(|item| compare_overview_appearance_position(appearance, item).is_gt())
            .unwrap_or(true)
        {
            latest_by_character.insert(appearance.character_id.as_str(), appearance);
        }
    }

    let mut appearances: Vec<&CharacterAppearanceStatRecord> =
        latest_by_character.values().copied().collect();
    appearances.sort_by(|left, right| {
        compare_overview_appearance_position(right, left)
            .then_with(|| right.mention_count.cmp(&left.mention_count))
    });
    appearances
        .into_iter()
        .take(MAX_OVERVIEW_RECENT_APPEARANCES)
        .filter_map(|appearance| {
            let profile = profile_by_id.get(appearance.character_id.as_str())?;
            Some(CharacterOverviewSnapshotAppearance {
                id: appearance.id.clone(),
                character_id: appearance.character_id.clone(),
                name: if profile.display_name.is_empty() {
                    profile.canonical_name.clone()
                } else {
                    profile.display_name.clone()
                },
                chapter_index: if appearance.source_chapter_index > 0 {
                    appearance.source_chapter_index
                } else {
                    appearance.chapter_index
                },
                chapter_title: appearance.chapter_title.clone(),
                mention_count: appearance.mention_count,
                location: Some(profile.last_appearance.clone()),
            })
        })
        .collect()
}

fn compare_overview_appearance_position(
    left: &CharacterAppearanceStatRecord,
    right: &CharacterAppearanceStatRecord,
) -> std::cmp::Ordering {
    let left_chapter = if left.source_chapter_index > 0 {
        left.source_chapter_index
    } else {
        left.chapter_index
    };
    let right_chapter = if right.source_chapter_index > 0 {
        right.source_chapter_index
    } else {
        right.chapter_index
    };
    left_chapter
        .cmp(&right_chapter)
        .then_with(|| left.last_paragraph_index.cmp(&right.last_paragraph_index))
        .then_with(|| left.first_paragraph_index.cmp(&right.first_paragraph_index))
}

fn count_overview_covered_chapters(
    appearance_stats: &[CharacterAppearanceStatRecord],
    evidence: &[CharacterEvidenceRecord],
    total_chapter_count: usize,
) -> usize {
    let mut chapters = HashSet::new();
    for appearance in appearance_stats {
        let chapter_index = if appearance.source_chapter_index > 0 {
            appearance.source_chapter_index
        } else {
            appearance.chapter_index
        };
        if total_chapter_count == 0 || chapter_index < total_chapter_count {
            chapters.insert(chapter_index);
        }
    }
    for item in evidence {
        let chapter_index = if item.location.source_chapter_index > 0 {
            item.location.source_chapter_index
        } else {
            item.location.chapter_index
        };
        if total_chapter_count == 0 || chapter_index < total_chapter_count {
            chapters.insert(chapter_index);
        }
    }
    chapters.len()
}

fn count_overview_review_issues(
    profiles: &[CharacterProfileRecord],
    relations: &[CharacterRelationRecord],
    evidence: &[CharacterEvidenceRecord],
) -> usize {
    profiles
        .iter()
        .filter(|profile| !profile.hidden && profile.confidence < 0.5)
        .count()
        + relations
            .iter()
            .filter(|relation| relation.evidence_ids.is_empty() || relation.confidence < 0.5)
            .count()
        + evidence
            .iter()
            .filter(|item| item.status != "valid" || item.confidence < 0.5)
            .count()
}

fn overview_stat(id: &str, value: usize) -> CharacterOverviewSnapshotStat {
    CharacterOverviewSnapshotStat {
        id: id.to_string(),
        value: value.to_string(),
    }
}

pub(super) fn write_character_overview_snapshot(
    book_dir: &Path,
    snapshot: &CharacterOverviewSnapshot,
) -> Result<(), String> {
    write_json_file(&book_dir.join("overview.json"), snapshot)
}

pub(super) fn read_character_overview_snapshot(
    book_dir: &Path,
) -> Result<Option<CharacterOverviewSnapshot>, String> {
    let input_path = book_dir.join("overview.json");
    if !input_path.exists() {
        return Ok(None);
    }
    read_json_file(&input_path).map(Some)
}
