use crate::models::{CharacterEvidenceRecord, CharacterMentionRecord, CharacterRelationRecord};
use std::collections::{BTreeMap, HashSet};

use super::filters::trim_context_gap;
use super::ids::{stable_hash, stable_relation_id};
use super::{
    MAX_EVIDENCE_PER_RELATION, MAX_RELATION_CHARACTERS_PER_WINDOW,
    MAX_TYPED_RELATION_MENTIONS_PER_WINDOW,
};
pub(super) fn build_cooccurrence_relations(
    book_id: &str,
    mentions: &[CharacterMentionRecord],
    built_at: &str,
) -> (Vec<CharacterRelationRecord>, Vec<CharacterEvidenceRecord>) {
    let mut mentions_by_window: BTreeMap<(String, usize, usize), Vec<&CharacterMentionRecord>> =
        BTreeMap::new();
    for mention in mentions {
        mentions_by_window
            .entry((
                mention.location.chunk_id.clone(),
                mention.location.chapter_index,
                mention.location.paragraph_index,
            ))
            .or_default()
            .push(mention);
    }

    let mut relation_by_pair: BTreeMap<(String, String, String), CharacterRelationRecord> =
        BTreeMap::new();
    let mut relation_evidence = Vec::new();
    for window_mentions in mentions_by_window.values_mut() {
        window_mentions.sort_by(|left, right| {
            left.location
                .start_offset
                .cmp(&right.location.start_offset)
                .then_with(|| left.character_id.cmp(&right.character_id))
        });
        let typed_mentions: Vec<&CharacterMentionRecord> = window_mentions
            .iter()
            .copied()
            .take(MAX_TYPED_RELATION_MENTIONS_PER_WINDOW)
            .collect();
        for left_index in 0..typed_mentions.len() {
            for right_index in left_index + 1..typed_mentions.len() {
                let left = typed_mentions[left_index];
                let right = typed_mentions[right_index];
                if left.character_id == right.character_id {
                    continue;
                }
                if let Some(typed_relation) = detect_typed_relation(left, right) {
                    upsert_relation(
                        book_id,
                        built_at,
                        &mut relation_by_pair,
                        &mut relation_evidence,
                        typed_relation,
                    );
                }
            }
        }
        let mut unique_mentions: Vec<&CharacterMentionRecord> = Vec::new();
        let mut seen_characters = HashSet::new();
        for mention in window_mentions.iter().copied() {
            if seen_characters.insert(mention.character_id.clone()) {
                unique_mentions.push(mention);
            }
        }
        if unique_mentions.len() > MAX_RELATION_CHARACTERS_PER_WINDOW {
            unique_mentions.truncate(MAX_RELATION_CHARACTERS_PER_WINDOW);
        }
        for left_index in 0..unique_mentions.len() {
            for right_index in left_index + 1..unique_mentions.len() {
                let left = unique_mentions[left_index];
                let right = unique_mentions[right_index];
                if left.character_id == right.character_id {
                    continue;
                }
                let (source_id, target_id, first_mention, second_mention) =
                    ordered_relation_pair(left, right);
                upsert_relation(
                    book_id,
                    built_at,
                    &mut relation_by_pair,
                    &mut relation_evidence,
                    RelationCandidate {
                        source_id,
                        target_id,
                        relation_type: "co-occurrence".to_string(),
                        label: "共现".to_string(),
                        direction: "undirected".to_string(),
                        base_confidence: 0.66,
                        max_confidence: 0.82,
                        status: "suspected".to_string(),
                        first_mention,
                        second_mention,
                        claim: format!(
                            "{} 与 {} 在同一段落共同出现。",
                            first_mention.name, second_mention.name
                        ),
                        quote: relation_quote(first_mention, second_mention),
                    },
                );
            }
        }
    }

    (relation_by_pair.into_values().collect(), relation_evidence)
}

struct RelationCandidate<'a> {
    source_id: String,
    target_id: String,
    relation_type: String,
    label: String,
    direction: String,
    base_confidence: f32,
    max_confidence: f32,
    status: String,
    first_mention: &'a CharacterMentionRecord,
    second_mention: &'a CharacterMentionRecord,
    claim: String,
    quote: String,
}

fn upsert_relation(
    book_id: &str,
    built_at: &str,
    relation_by_pair: &mut BTreeMap<(String, String, String), CharacterRelationRecord>,
    relation_evidence: &mut Vec<CharacterEvidenceRecord>,
    candidate: RelationCandidate<'_>,
) {
    let pair_key = (
        candidate.source_id.clone(),
        candidate.target_id.clone(),
        candidate.relation_type.clone(),
    );
    let existing_evidence_count = relation_by_pair
        .get(&pair_key)
        .map(|relation| relation.evidence_ids.len());
    let relation_id = stable_relation_id(
        book_id,
        &candidate.source_id,
        &candidate.target_id,
        &candidate.relation_type,
    );
    let evidence_id = format!(
        "{relation_id}-evidence-{}",
        existing_evidence_count.unwrap_or(0)
    );
    let relation = relation_by_pair
        .entry(pair_key)
        .or_insert_with(|| CharacterRelationRecord {
            id: relation_id.clone(),
            book_id: book_id.to_string(),
            source_character_id: candidate.source_id.clone(),
            target_character_id: candidate.target_id.clone(),
            relation_type: candidate.relation_type.clone(),
            label: candidate.label.clone(),
            summary: candidate.claim.clone(),
            direction: candidate.direction.clone(),
            confidence: candidate.base_confidence,
            evidence_ids: Vec::new(),
            first_seen: candidate.first_mention.location.clone(),
            last_seen: candidate.first_mention.location.clone(),
            status: candidate.status.clone(),
            created_at: built_at.to_string(),
            updated_at: built_at.to_string(),
        });
    let should_add_evidence = relation.evidence_ids.len() < MAX_EVIDENCE_PER_RELATION
        && !relation.evidence_ids.contains(&evidence_id);
    if should_add_evidence {
        relation.evidence_ids.push(evidence_id.clone());
    }
    relation.last_seen = candidate.first_mention.location.clone();
    relation.confidence = (candidate.base_confidence
        + relation.evidence_ids.len().min(4) as f32 * 0.04)
        .min(candidate.max_confidence);
    if should_add_evidence {
        relation_evidence.push(CharacterEvidenceRecord {
            id: evidence_id,
            book_id: book_id.to_string(),
            target_type: "relation".to_string(),
            target_id: relation.id.clone(),
            claim: candidate.claim,
            quote: candidate.quote,
            location: candidate.first_mention.location.clone(),
            evidence_hash: stable_hash(&format!(
                "{}:{}:{}:{}",
                relation.id,
                candidate.first_mention.context_hash,
                candidate.second_mention.context_hash,
                relation.evidence_ids.len()
            )),
            confidence: relation.confidence,
            source: "rule".to_string(),
            status: "valid".to_string(),
            created_at: built_at.to_string(),
            updated_at: built_at.to_string(),
        });
    }
}

fn detect_typed_relation<'a>(
    left: &'a CharacterMentionRecord,
    right: &'a CharacterMentionRecord,
) -> Option<RelationCandidate<'a>> {
    detect_possessive_relation(left, right)
        .or_else(|| detect_possessive_relation(right, left))
        .or_else(|| detect_direct_relation(left, right))
        .or_else(|| detect_direct_relation(right, left))
}

fn detect_direct_relation<'a>(
    source: &'a CharacterMentionRecord,
    target: &'a CharacterMentionRecord,
) -> Option<RelationCandidate<'a>> {
    let between = text_between_mentions(source, target)?;
    let rule = DIRECT_RELATION_RULES
        .iter()
        .find(|rule| between.contains(rule.keyword))?;
    Some(typed_relation_candidate(
        source, target, rule, 0.78, 0.92, "valid",
    ))
}

fn detect_possessive_relation<'a>(
    source: &'a CharacterMentionRecord,
    target: &'a CharacterMentionRecord,
) -> Option<RelationCandidate<'a>> {
    POSSESSIVE_RELATION_RULES.iter().find_map(|rule| {
        let source_suffix = trim_context_gap(&source.suffix_text);
        let forward_pattern = format!("是{}的{}", target.name, rule.keyword);
        if source_suffix.starts_with(&forward_pattern) {
            return Some(typed_relation_candidate(
                source,
                target,
                rule,
                0.72,
                0.86,
                "suspected",
            ));
        }
        None
    })
}

fn typed_relation_candidate<'a>(
    source: &'a CharacterMentionRecord,
    target: &'a CharacterMentionRecord,
    rule: &RelationRule,
    base_confidence: f32,
    max_confidence: f32,
    status: &str,
) -> RelationCandidate<'a> {
    RelationCandidate {
        source_id: source.character_id.clone(),
        target_id: target.character_id.clone(),
        relation_type: rule.relation_type.to_string(),
        label: rule.label.to_string(),
        direction: "directed".to_string(),
        base_confidence,
        max_confidence,
        status: status.to_string(),
        first_mention: source,
        second_mention: target,
        claim: format!("{} {} {}。", source.name, rule.label, target.name),
        quote: relation_quote(source, target),
    }
}

fn text_between_mentions<'a>(
    source: &'a CharacterMentionRecord,
    target: &'a CharacterMentionRecord,
) -> Option<&'a str> {
    if source.location.chunk_id != target.location.chunk_id
        || source.location.paragraph_index != target.location.paragraph_index
        || source.location.end_offset > target.location.start_offset
    {
        return None;
    }
    let target_name_start = source.suffix_text.find(&target.name)?;
    source.suffix_text.get(..target_name_start)
}

struct RelationRule {
    keyword: &'static str,
    relation_type: &'static str,
    label: &'static str,
}

const DIRECT_RELATION_RULES: &[RelationRule] = &[
    RelationRule {
        keyword: "保护",
        relation_type: "protects",
        label: "保护",
    },
    RelationRule {
        keyword: "守护",
        relation_type: "protects",
        label: "保护",
    },
    RelationRule {
        keyword: "询问",
        relation_type: "asks",
        label: "询问",
    },
    RelationRule {
        keyword: "问道",
        relation_type: "asks",
        label: "询问",
    },
    RelationRule {
        keyword: "问向",
        relation_type: "asks",
        label: "询问",
    },
    RelationRule {
        keyword: "问了",
        relation_type: "asks",
        label: "询问",
    },
    RelationRule {
        keyword: "命令",
        relation_type: "commands",
        label: "命令",
    },
    RelationRule {
        keyword: "攻击",
        relation_type: "attacks",
        label: "攻击",
    },
    RelationRule {
        keyword: "追踪",
        relation_type: "tracks",
        label: "追踪",
    },
    RelationRule {
        keyword: "怀疑",
        relation_type: "suspects",
        label: "怀疑",
    },
    RelationRule {
        keyword: "救下",
        relation_type: "rescues",
        label: "救助",
    },
    RelationRule {
        keyword: "救助",
        relation_type: "rescues",
        label: "救助",
    },
    RelationRule {
        keyword: "帮助",
        relation_type: "helps",
        label: "帮助",
    },
];

const POSSESSIVE_RELATION_RULES: &[RelationRule] = &[
    RelationRule {
        keyword: "医生",
        relation_type: "doctor",
        label: "医生",
    },
    RelationRule {
        keyword: "老师",
        relation_type: "teacher",
        label: "老师",
    },
    RelationRule {
        keyword: "师父",
        relation_type: "master",
        label: "师父",
    },
    RelationRule {
        keyword: "师傅",
        relation_type: "master",
        label: "师父",
    },
    RelationRule {
        keyword: "父亲",
        relation_type: "father",
        label: "父亲",
    },
    RelationRule {
        keyword: "母亲",
        relation_type: "mother",
        label: "母亲",
    },
    RelationRule {
        keyword: "兄弟",
        relation_type: "sibling",
        label: "兄弟",
    },
    RelationRule {
        keyword: "姐妹",
        relation_type: "sibling",
        label: "姐妹",
    },
    RelationRule {
        keyword: "同学",
        relation_type: "classmate",
        label: "同学",
    },
    RelationRule {
        keyword: "队友",
        relation_type: "teammate",
        label: "队友",
    },
    RelationRule {
        keyword: "上司",
        relation_type: "superior",
        label: "上司",
    },
    RelationRule {
        keyword: "下属",
        relation_type: "subordinate",
        label: "下属",
    },
    RelationRule {
        keyword: "敌人",
        relation_type: "enemy",
        label: "敌人",
    },
];

fn ordered_relation_pair<'a>(
    left: &'a CharacterMentionRecord,
    right: &'a CharacterMentionRecord,
) -> (
    String,
    String,
    &'a CharacterMentionRecord,
    &'a CharacterMentionRecord,
) {
    if left.character_id <= right.character_id {
        (
            left.character_id.clone(),
            right.character_id.clone(),
            left,
            right,
        )
    } else {
        (
            right.character_id.clone(),
            left.character_id.clone(),
            right,
            left,
        )
    }
}

fn relation_quote(left: &CharacterMentionRecord, right: &CharacterMentionRecord) -> String {
    if left.quote.contains(&right.name) {
        return left.quote.clone();
    }
    if right.quote.contains(&left.name) {
        return right.quote.clone();
    }
    format!("{} / {}", left.quote, right.quote)
}

pub(super) fn relation_counts_by_character(
    relations: &[CharacterRelationRecord],
) -> BTreeMap<String, usize> {
    let mut counts = BTreeMap::new();
    for relation in relations {
        *counts
            .entry(relation.source_character_id.clone())
            .or_insert(0) += 1;
        *counts
            .entry(relation.target_character_id.clone())
            .or_insert(0) += 1;
    }
    counts
}
