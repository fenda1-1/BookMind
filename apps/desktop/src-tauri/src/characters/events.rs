use crate::models::{
    CharacterAppearanceStatRecord, CharacterEventRecord, CharacterEvidenceRecord,
    CharacterLocationRecord, CharacterProfileRecord,
};
use std::collections::BTreeMap;

use super::extraction::{normalize_character_name, CharacterAccumulator};
use super::ids::{stable_character_id, stable_hash};

pub(super) fn build_first_appearance_events(
    book_id: &str,
    profiles: &[CharacterProfileRecord],
    evidence: &[CharacterEvidenceRecord],
    built_at: &str,
) -> Vec<CharacterEventRecord> {
    let evidence_by_target: BTreeMap<&str, &CharacterEvidenceRecord> = evidence
        .iter()
        .filter(|item| item.target_type == "mention")
        .map(|item| (item.target_id.as_str(), item))
        .collect();
    let mut events = Vec::new();
    for profile in profiles {
        let first_evidence = evidence_by_target
            .values()
            .find(|item| {
                item.location.book_id == book_id
                    && item.claim.contains(&profile.canonical_name)
                    && item.location.chapter_index == profile.first_appearance.chapter_index
                    && item.location.paragraph_index == profile.first_appearance.paragraph_index
                    && item.location.start_offset == profile.first_appearance.start_offset
            })
            .map(|item| item.id.clone());
        let evidence_ids = first_evidence.into_iter().collect();
        events.push(CharacterEventRecord {
            id: format!(
                "{}-event-first-appearance",
                stable_character_id(book_id, &profile.canonical_name)
            ),
            book_id: book_id.to_string(),
            title: format!("{} 首次出场", profile.display_name),
            summary: format!("{} 首次出场。", profile.display_name),
            event_type: "appearance".to_string(),
            participant_character_ids: vec![profile.id.clone()],
            location: profile.first_appearance.clone(),
            chapter_label: character_chapter_label(&profile.first_appearance),
            evidence_ids,
            confidence: profile.confidence,
            source: "rule".to_string(),
            created_at: built_at.to_string(),
            updated_at: built_at.to_string(),
        });
    }
    events.sort_by(|left, right| {
        left.location
            .chapter_index
            .cmp(&right.location.chapter_index)
            .then_with(|| {
                left.location
                    .paragraph_index
                    .cmp(&right.location.paragraph_index)
            })
            .then_with(|| left.location.start_offset.cmp(&right.location.start_offset))
            .then_with(|| left.id.cmp(&right.id))
    });
    events
}

fn character_chapter_label(location: &CharacterLocationRecord) -> String {
    if !location.chapter_title.is_empty() {
        return location.chapter_title.clone();
    }
    if location.visible_chapter_position > 0 {
        return format!("第 {} 章", location.visible_chapter_position);
    }
    format!("第 {} 章", location.source_chapter_index + 1)
}

pub(super) fn build_appearance_stats(
    book_id: &str,
    profiles: &[CharacterProfileRecord],
    accumulators: &BTreeMap<String, CharacterAccumulator>,
) -> Vec<CharacterAppearanceStatRecord> {
    let mut stats = Vec::new();
    for profile in profiles {
        let normalized_name = normalize_character_name(&profile.canonical_name);
        let Some(accumulator) = accumulators.get(&normalized_name) else {
            continue;
        };
        for (chapter_index, chapter) in &accumulator.chapter_stats {
            stats.push(CharacterAppearanceStatRecord {
                id: format!(
                    "appearance-{}",
                    stable_hash(&format!("{}:{}:{}", book_id, profile.id, chapter_index))
                ),
                book_id: book_id.to_string(),
                character_id: profile.id.clone(),
                chapter_index: *chapter_index,
                source_chapter_index: chapter.first_mention.chapter_index,
                chapter_title: chapter.first_mention.chapter_title.clone(),
                mention_count: chapter.mention_count,
                evidence_count: chapter.evidence_count,
                first_paragraph_index: chapter.first_mention.paragraph_start,
                last_paragraph_index: chapter.last_mention.paragraph_start,
                heat: chapter.mention_count as f32,
            });
        }
    }
    stats.sort_by(|left, right| {
        left.chapter_index
            .cmp(&right.chapter_index)
            .then_with(|| left.character_id.cmp(&right.character_id))
    });
    stats
}

pub(super) fn event_counts_by_character(
    events: &[CharacterEventRecord],
) -> BTreeMap<String, usize> {
    let mut counts = BTreeMap::new();
    for event in events {
        for character_id in &event.participant_character_ids {
            *counts.entry(character_id.clone()).or_insert(0) += 1;
        }
    }
    counts
}
