use crate::models::TextChunkRecord;
use regex::Regex;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::OnceLock;

use super::filters::{
    is_non_character_candidate, is_non_character_candidate_in_context,
    is_non_character_connector_phrase, is_pronoun_or_determiner_phrase, is_stop_word,
    trim_context_gap, trim_leading_manner_context, trim_leading_movement_target_context,
    CHARACTER_HESITATION_MARKERS, CONNECTOR_FOLLOWED_SPEECH_PREDICATES,
};
use super::name_rules::{
    classify_character_candidate_name, is_exceptional_person_name, is_known_chinese_surname_start,
    looks_like_possible_proper_character_name, looks_like_specific_titled_character_name,
    CharacterCandidateKind,
};
use super::{MAX_MENTIONS_PER_CHARACTER, MAX_TOTAL_CANDIDATE_MENTIONS, MENTION_CONTEXT_CHARS};
#[derive(Clone, Debug)]
pub(super) struct CandidateMention {
    pub(super) name: String,
    pub(super) start_char: usize,
    pub(super) end_char: usize,
    pub(super) chunk_id: String,
    pub(super) chapter: String,
    pub(super) chapter_index: usize,
    pub(super) chapter_title: String,
    pub(super) paragraph_start: usize,
    pub(super) paragraph_end: usize,
    pub(super) quote: String,
    pub(super) prefix_text: String,
    pub(super) suffix_text: String,
}

#[derive(Clone, Debug)]
pub(super) struct CharacterAccumulator {
    pub(super) name: String,
    pub(super) mention_count: usize,
    pub(super) mentions: Vec<CandidateMention>,
    pub(super) last_mention: Option<CandidateMention>,
    pub(super) chapter_stats: BTreeMap<usize, CharacterChapterAccumulator>,
}

#[derive(Clone, Debug)]
pub(super) struct CharacterChapterAccumulator {
    pub(super) mention_count: usize,
    pub(super) evidence_count: usize,
    pub(super) first_mention: CandidateMention,
    pub(super) last_mention: CandidateMention,
}

pub(super) fn collect_character_accumulators(
    chunks: &[TextChunkRecord],
) -> BTreeMap<String, CharacterAccumulator> {
    collect_character_accumulators_with_progress(chunks, None)
        .expect("character accumulator collection without progress should not fail")
}

pub(super) fn collect_character_accumulators_with_progress(
    chunks: &[TextChunkRecord],
    mut progress: Option<&mut dyn FnMut(f64, String) -> Result<(), String>>,
) -> Result<BTreeMap<String, CharacterAccumulator>, String> {
    let mut accumulators: BTreeMap<String, CharacterAccumulator> = BTreeMap::new();
    let mut total_saved_mentions = 0usize;
    let mut seen_mentions = HashSet::new();
    let progress_interval = character_progress_interval(chunks.len());
    for (index, chunk) in chunks.iter().enumerate() {
        for (name, start_byte, end_byte) in extract_names_from_text(&chunk.text) {
            push_candidate_mention(
                &mut accumulators,
                &mut seen_mentions,
                &mut total_saved_mentions,
                chunk,
                name,
                start_byte,
                end_byte,
            );
        }
        emit_character_scan_progress(
            &mut progress,
            index + 1,
            chunks.len(),
            progress_interval,
            28.0,
            35.0,
            "扫描规则人物候选",
        )?;
    }
    collect_high_frequency_name_accumulators_with_progress(
        chunks,
        &mut accumulators,
        &mut seen_mentions,
        &mut total_saved_mentions,
        &mut progress,
    )?;
    let result = prune_subsumed_accumulators(merge_residue_suffix_accumulators(accumulators))
        .into_iter()
        .filter(|(_, item)| item.mentions.len() >= 1)
        .collect();
    Ok(result)
}

fn push_candidate_mention(
    accumulators: &mut BTreeMap<String, CharacterAccumulator>,
    seen_mentions: &mut HashSet<String>,
    total_saved_mentions: &mut usize,
    chunk: &TextChunkRecord,
    name: String,
    start_byte: usize,
    end_byte: usize,
) {
    let normalized = normalize_character_name(&name);
    if is_stop_word(&normalized) && !is_exceptional_person_name(&normalized) {
        return;
    }
    let mention_key = format!("{}:{start_byte}:{end_byte}:{normalized}", chunk.id);
    if !seen_mentions.insert(mention_key) {
        return;
    }
    let start_char = byte_to_char_offset(&chunk.text, start_byte);
    let end_char = start_char.saturating_add(normalized.chars().count());
    let quote = quote_around(&chunk.text, start_byte, end_byte);
    let prefix_text = prefix_text(&chunk.text, start_byte);
    let suffix_text = suffix_text(&chunk.text, end_byte);
    let entry = accumulators
        .entry(normalized.clone())
        .or_insert_with(|| CharacterAccumulator {
            name: normalize_character_name(&name),
            mention_count: 0,
            mentions: Vec::new(),
            last_mention: None,
            chapter_stats: BTreeMap::new(),
        });
    let mention = CandidateMention {
        name: normalized.clone(),
        start_char,
        end_char,
        chunk_id: chunk.id.clone(),
        chapter: chunk.chapter.clone(),
        chapter_index: chunk.chapter_index,
        chapter_title: chunk.chapter_title.clone(),
        paragraph_start: chunk.paragraph_start,
        paragraph_end: chunk.paragraph_end,
        quote,
        prefix_text,
        suffix_text,
    };
    entry.mention_count += 1;
    entry.last_mention = Some(mention.clone());
    let chapter_stats = entry
        .chapter_stats
        .entry(mention.chapter_index)
        .or_insert_with(|| CharacterChapterAccumulator {
            mention_count: 0,
            evidence_count: 0,
            first_mention: mention.clone(),
            last_mention: mention.clone(),
        });
    chapter_stats.mention_count += 1;
    chapter_stats.last_mention = mention.clone();
    if entry.mentions.len() < MAX_MENTIONS_PER_CHARACTER
        && *total_saved_mentions < MAX_TOTAL_CANDIDATE_MENTIONS
    {
        entry.mentions.push(mention);
        chapter_stats.evidence_count += 1;
        *total_saved_mentions += 1;
    }
}

fn prune_subsumed_accumulators(
    accumulators: BTreeMap<String, CharacterAccumulator>,
) -> BTreeMap<String, CharacterAccumulator> {
    let names: Vec<(String, usize, bool)> = accumulators
        .iter()
        .map(|(name, item)| {
            (
                name.clone(),
                item.mention_count,
                item.mention_count > 1
                    && (!is_non_character_candidate(name) || is_exceptional_person_name(name))
                    && !is_definite_non_character_profile_name(name)
                    && character_accumulator_quality(item) > 0,
            )
        })
        .collect();
    accumulators
        .into_iter()
        .filter(|(name, item)| {
            let name_chars = name.chars().count();
            !names
                .iter()
                .any(|(other_name, other_count, other_is_keepable)| {
                    other_name != name
                        && *other_is_keepable
                        && other_name.chars().count() > name_chars
                        && other_name.contains(name)
                        && *other_count >= item.mention_count
                })
        })
        .collect()
}

fn collect_high_frequency_name_accumulators_with_progress(
    chunks: &[TextChunkRecord],
    accumulators: &mut BTreeMap<String, CharacterAccumulator>,
    seen_mentions: &mut HashSet<String>,
    total_saved_mentions: &mut usize,
    progress: &mut Option<&mut dyn FnMut(f64, String) -> Result<(), String>>,
) -> Result<(), String> {
    let mut candidates: HashMap<String, HighFrequencyCandidateStats> = HashMap::new();
    let progress_interval = character_progress_interval(chunks.len());
    for (index, chunk) in chunks.iter().enumerate() {
        for (name, start_byte, end_byte) in scan_possible_name_mentions(&chunk.text) {
            let entry = candidates.entry(name).or_default();
            entry.mention_count += 1;
            if has_high_frequency_name_context(&chunk.text, start_byte, end_byte) {
                entry.context_count += 1;
            }
        }
        emit_character_scan_progress(
            progress,
            index + 1,
            chunks.len(),
            progress_interval,
            35.0,
            42.0,
            "统计高频人物候选",
        )?;
    }
    let accepted: HashSet<String> = candidates
        .into_iter()
        .filter_map(|(name, stats)| {
            should_accept_high_frequency_name(&name, &stats).then_some(name)
        })
        .collect();
    if accepted.is_empty() {
        return Ok(());
    }
    for (index, chunk) in chunks.iter().enumerate() {
        for (name, start_byte, end_byte) in scan_possible_name_mentions(&chunk.text) {
            if !accepted.contains(&name) {
                continue;
            }
            push_candidate_mention(
                accumulators,
                seen_mentions,
                total_saved_mentions,
                chunk,
                name,
                start_byte,
                end_byte,
            );
        }
        emit_character_scan_progress(
            progress,
            index + 1,
            chunks.len(),
            progress_interval,
            42.0,
            45.5,
            "写入高频人物 mention",
        )?;
    }
    Ok(())
}

fn character_progress_interval(total: usize) -> usize {
    (total.max(1) / 100).max(25)
}

fn emit_character_scan_progress(
    progress: &mut Option<&mut dyn FnMut(f64, String) -> Result<(), String>>,
    current: usize,
    total: usize,
    interval: usize,
    start_percent: f64,
    end_percent: f64,
    label: &str,
) -> Result<(), String> {
    if current < total && current % interval != 0 {
        return Ok(());
    }
    let Some(callback) = progress.as_deref_mut() else {
        return Ok(());
    };
    let ratio = if total == 0 {
        1.0
    } else {
        current.min(total) as f64 / total as f64
    };
    let percent = start_percent + (end_percent - start_percent) * ratio;
    callback(
        percent,
        format!("{label} {}/{} chunks", current.min(total), total),
    )
}

#[derive(Default)]
struct HighFrequencyCandidateStats {
    mention_count: usize,
    context_count: usize,
}

fn should_accept_high_frequency_name(name: &str, stats: &HighFrequencyCandidateStats) -> bool {
    if stats.mention_count >= 30 && stats.context_count >= 2 {
        return true;
    }
    stats.mention_count >= 8
        && stats.context_count >= 4
        && looks_like_possible_proper_character_name(name)
}

fn scan_possible_name_mentions(text: &str) -> Vec<(String, usize, usize)> {
    let chars: Vec<(usize, char)> = text.char_indices().collect();
    let mut matches = Vec::new();
    for index in 0..chars.len() {
        if !is_known_chinese_surname_start(chars[index].1) {
            continue;
        }
        for len in [2usize, 3usize, 4usize] {
            let end_index = index + len;
            if end_index > chars.len() {
                continue;
            }
            let start_byte = chars[index].0;
            let end_byte = chars
                .get(end_index)
                .map(|(byte, _)| *byte)
                .unwrap_or(text.len());
            if !is_possible_name_span_boundary(text, start_byte, end_byte) {
                continue;
            }
            let Some(name) = text.get(start_byte..end_byte) else {
                continue;
            };
            if !looks_like_high_frequency_name_candidate(name) {
                continue;
            }
            matches.push((name.to_string(), start_byte, end_byte));
        }
    }
    matches
}

fn looks_like_high_frequency_name_candidate(name: &str) -> bool {
    let char_count = name.chars().count();
    (2..=4).contains(&char_count)
        && looks_like_possible_proper_character_name(name)
        && !is_non_character_candidate(name)
        && !is_high_frequency_name_object_noise(name)
}

fn is_high_frequency_name_object_noise(name: &str) -> bool {
    const OBJECT_SUFFIXES: &[&str] = &[
        "家", "府", "城", "楼", "宗", "门", "山", "河", "湖", "江", "海", "军", "国", "州", "郡",
        "县", "镇", "街", "路", "院", "阁", "宫", "殿", "舫", "船", "鼎", "丹", "诀", "术", "法",
        "书", "剑", "刀", "枪", "拳", "掌", "阵", "符", "药", "石", "珠", "镜",
    ];
    OBJECT_SUFFIXES
        .iter()
        .any(|suffix| name.ends_with(suffix) && !is_exceptional_person_name(name))
}

fn is_possible_name_span_boundary(text: &str, start: usize, end: usize) -> bool {
    let prefix = text.get(..start).unwrap_or("");
    let suffix = text.get(end..).unwrap_or("");
    let left_intro = has_name_introduction_prefix(prefix);
    let left_boundary = previous_char(text, start).is_none_or(|ch| !is_cjk_char(ch)) || left_intro;
    let right_boundary = next_char(text, end).is_none_or(|ch| !is_cjk_char(ch))
        || has_name_introduction_suffix(suffix)
        || starts_with_character_activity_suffix(suffix)
        || (left_intro && suffix_starts_with_intro_name_tail(suffix));
    left_boundary && right_boundary
}

fn suffix_starts_with_intro_name_tail(suffix: &str) -> bool {
    let suffix = trim_context_gap(suffix);
    suffix
        .chars()
        .next()
        .is_some_and(|ch| matches!(ch, '的' | '了' | '是' | '，' | ',' | '。' | '！' | '!'))
}

fn has_high_frequency_name_context(text: &str, start: usize, end: usize) -> bool {
    let prefix = text.get(..start).unwrap_or("");
    let suffix = text.get(end..).unwrap_or("");
    has_name_introduction_prefix(prefix)
        || has_name_introduction_suffix(suffix)
        || starts_with_character_activity_suffix(suffix)
}

fn has_name_introduction_prefix(prefix: &str) -> bool {
    let preview: String = prefix.chars().rev().take(12).collect();
    let preview: String = preview.chars().rev().collect();
    NAME_INTRODUCTION_PREFIXES
        .iter()
        .any(|item| preview.ends_with(item))
}

fn has_name_introduction_suffix(suffix: &str) -> bool {
    let suffix = trim_context_gap(suffix);
    suffix.starts_with('！')
        || suffix.starts_with('!')
        || suffix.starts_with('，')
        || suffix.starts_with(',')
        || suffix.starts_with('。')
        || suffix.starts_with('的')
        || suffix.starts_with('是')
        || suffix.starts_with("拜见")
        || suffix.starts_with("见过")
}

fn starts_with_character_activity_suffix(suffix: &str) -> bool {
    let suffix = trim_context_gap(suffix);
    CHARACTER_NAME_ACTIVITY_SUFFIXES
        .iter()
        .any(|item| suffix.starts_with(item))
}

fn previous_char(text: &str, start: usize) -> Option<char> {
    text.get(..start)?.chars().next_back()
}

fn next_char(text: &str, end: usize) -> Option<char> {
    text.get(end..)?.chars().next()
}

pub(super) fn should_keep_character_accumulator(accumulator: &CharacterAccumulator) -> bool {
    character_candidate_admission_kind(accumulator).is_some()
}

fn character_candidate_admission_kind(
    accumulator: &CharacterAccumulator,
) -> Option<CharacterCandidateKind> {
    let name = accumulator.name.as_str();
    if accumulator.mention_count <= 1 {
        return None;
    }
    if is_non_character_candidate(name) && !is_exceptional_person_name(name) {
        return None;
    }
    if is_definite_non_character_profile_name(name) {
        return None;
    }
    let kind = classify_character_candidate_name(name)?;
    let strong_mentions = accumulator
        .mentions
        .iter()
        .filter(|mention| is_strong_character_mention(mention))
        .count();
    let explicit_mentions = accumulator
        .mentions
        .iter()
        .filter(|mention| has_explicit_naming_context(mention))
        .count();
    let object_mentions = accumulator
        .mentions
        .iter()
        .filter(|mention| has_strong_object_context(mention))
        .count();
    let positive_evidence = strong_mentions + explicit_mentions + object_mentions;
    if positive_evidence == 0 {
        return None;
    }
    match kind {
        CharacterCandidateKind::TitledName => Some(kind),
        CharacterCandidateKind::StableAlias => {
            if strong_mentions > 0
                && (accumulator.mention_count >= 2
                    || explicit_mentions > 0
                    || accumulator.chapter_stats.len() >= 2
                    || accumulator.mentions.iter().any(has_speech_subject_context))
            {
                Some(kind)
            } else {
                None
            }
        }
        CharacterCandidateKind::ProperName => {
            if is_exceptional_person_name(name)
                && !(strong_mentions > 0
                    || explicit_mentions > 0
                    || accumulator.mentions.iter().any(has_speech_subject_context))
            {
                return None;
            }
            if accumulator.mention_count <= 2 {
                (strong_mentions > 0 || explicit_mentions > 0).then_some(kind)
            } else {
                Some(kind)
            }
        }
    }
}

fn is_definite_non_character_profile_name(name: &str) -> bool {
    is_action_plus_generic_title_noise(name) || has_character_action_residue_suffix(name)
}

fn is_action_plus_generic_title_noise(name: &str) -> bool {
    const ACTION_PREFIXES: &[&str] = &[
        "听", "让", "随", "拜见", "拜访", "拜", "帮", "比", "比起", "请", "替", "代替", "冲", "朝",
        "别说", "参加", "像", "打断", "打杀", "打死", "得到", "得见", "得让", "递给", "都对",
        "都让", "都听", "都在", "多说", "成为", "承蒙", "诚邀",
    ];
    const GENERIC_TITLE_SUFFIXES: &[&str] = &[
        "师父",
        "师傅",
        "师兄",
        "师姐",
        "先生",
        "小姐",
        "姑娘",
        "少爷",
        "陛下",
        "殿下",
        "城主",
        "将军",
        "道长",
        "老先生",
        "老将军",
        "仙子",
    ];
    ACTION_PREFIXES.iter().any(|prefix| {
        name.starts_with(prefix)
            && name.chars().count() > prefix.chars().count()
            && GENERIC_TITLE_SUFFIXES
                .iter()
                .any(|suffix| name.ends_with(suffix))
    })
}

fn has_character_action_residue_suffix(name: &str) -> bool {
    const ACTION_RESIDUE_SUFFIXES: &[&str] = &[
        "见状", "闻言", "只得", "只好", "还要", "会心", "重新", "一本", "先后", "蓦然", "暗自",
        "搓手", "心声", "谄媚", "狞", "说道", "问道", "答道", "喊道", "叫道", "喃喃", "脸上",
        "居然", "羡慕", "时", "先", "冷", "失", "终", "淡", "调", "反",
    ];
    ACTION_RESIDUE_SUFFIXES
        .iter()
        .any(|suffix| name.ends_with(suffix) && name.chars().count() > suffix.chars().count() + 1)
        || CHARACTER_TRAILING_PARTIAL_ACTIONS.iter().any(|suffix| {
            name.ends_with(suffix) && name.chars().count() > suffix.chars().count() + 1
        })
}

fn merge_residue_suffix_accumulators(
    mut accumulators: BTreeMap<String, CharacterAccumulator>,
) -> BTreeMap<String, CharacterAccumulator> {
    let names: Vec<String> = accumulators.keys().cloned().collect();
    let mut merges = Vec::new();
    for candidate_name in &names {
        if !accumulators.contains_key(candidate_name) {
            continue;
        }
        let Some(base_name) = best_residue_suffix_base(candidate_name, &names, &accumulators)
        else {
            continue;
        };
        merges.push((candidate_name.clone(), base_name));
    }
    for (candidate_name, base_name) in merges {
        if candidate_name == base_name || !accumulators.contains_key(&base_name) {
            continue;
        }
        let Some(source) = accumulators.remove(&candidate_name) else {
            continue;
        };
        if let Some(target) = accumulators.get_mut(&base_name) {
            merge_character_accumulator(target, source);
        }
    }
    accumulators
}

fn best_residue_suffix_base(
    candidate_name: &str,
    names: &[String],
    accumulators: &BTreeMap<String, CharacterAccumulator>,
) -> Option<String> {
    let candidate_chars = candidate_name.chars().count();
    if candidate_chars < 3 {
        return None;
    }
    names
        .iter()
        .filter_map(|base_name| {
            if base_name == candidate_name || !candidate_name.starts_with(base_name) {
                return None;
            }
            let base_chars = base_name.chars().count();
            if base_chars < 2 || base_chars >= candidate_chars {
                return None;
            }
            let suffix: String = candidate_name.chars().skip(base_chars).collect();
            if !is_name_residue_suffix(&suffix) {
                return None;
            }
            let base = accumulators.get(base_name)?;
            let candidate = accumulators.get(candidate_name)?;
            if base.mention_count < 2 || character_accumulator_quality(base) == 0 {
                return None;
            }
            if candidate.mention_count > base.mention_count.saturating_mul(2).max(3) {
                return None;
            }
            Some((base_name.clone(), base_chars))
        })
        .max_by(|left, right| left.1.cmp(&right.1).then_with(|| left.0.cmp(&right.0)))
        .map(|(name, _)| name)
}

fn is_name_residue_suffix(suffix: &str) -> bool {
    const SINGLE_CHAR_RESIDUES: &[&str] = &[
        "不", "有", "开", "也", "就", "才", "又", "还", "没", "要", "会", "能", "想", "看", "说",
        "问", "笑", "走", "来", "去", "都", "只", "将", "把", "被", "在", "对", "向", "给", "从",
        "往", "与", "跟", "和", "便", "却", "仍", "正", "已", "可", "点", "摇", "转", "回", "抬",
        "低", "盯", "答", "喊", "叫", "停", "起", "皱", "挑", "眯", "睁", "闭", "反", "时", "先",
        "冷", "失", "终", "淡", "调",
    ];
    const PHRASE_RESIDUES: &[&str] = &[
        "接话", "嫣然", "直腰", "果然", "很快", "开始", "也只", "赧颜", "抢先", "悄悄", "开心",
        "难得", "当时", "说道", "问道", "答道", "喊道", "叫道", "脸上", "喃喃", "也会", "居然",
        "羡慕",
    ];
    if SINGLE_CHAR_RESIDUES.contains(&suffix) {
        return true;
    }
    if PHRASE_RESIDUES.contains(&suffix) {
        return true;
    }
    has_character_action_residue_suffix(&format!("甲乙{suffix}"))
}

fn merge_character_accumulator(target: &mut CharacterAccumulator, source: CharacterAccumulator) {
    target.mention_count += source.mention_count;
    let target_name = target.name.clone();
    if let Some(last_mention) = source.last_mention {
        let last_mention = retarget_candidate_mention(last_mention, &target_name);
        if target
            .last_mention
            .as_ref()
            .is_none_or(|current| mention_order(&last_mention) >= mention_order(current))
        {
            target.last_mention = Some(last_mention);
        }
    }
    for mention in source.mentions {
        if target.mentions.len() >= MAX_MENTIONS_PER_CHARACTER {
            break;
        }
        target
            .mentions
            .push(retarget_candidate_mention(mention, &target_name));
    }
    for (chapter_index, source_stat) in source.chapter_stats {
        let retargeted_first = retarget_candidate_mention(source_stat.first_mention, &target_name);
        let retargeted_last = retarget_candidate_mention(source_stat.last_mention, &target_name);
        target
            .chapter_stats
            .entry(chapter_index)
            .and_modify(|target_stat| {
                target_stat.mention_count += source_stat.mention_count;
                target_stat.evidence_count += source_stat.evidence_count;
                if mention_order(&retargeted_first) < mention_order(&target_stat.first_mention) {
                    target_stat.first_mention = retargeted_first.clone();
                }
                if mention_order(&retargeted_last) > mention_order(&target_stat.last_mention) {
                    target_stat.last_mention = retargeted_last.clone();
                }
            })
            .or_insert(CharacterChapterAccumulator {
                mention_count: source_stat.mention_count,
                evidence_count: source_stat.evidence_count,
                first_mention: retargeted_first,
                last_mention: retargeted_last,
            });
    }
}

fn retarget_candidate_mention(
    mut mention: CandidateMention,
    target_name: &str,
) -> CandidateMention {
    mention.name = target_name.to_string();
    let target_chars = target_name.chars().count();
    mention.end_char = mention.start_char.saturating_add(target_chars);
    mention
}

fn mention_order(mention: &CandidateMention) -> (usize, usize, usize) {
    (
        mention.chapter_index,
        mention.paragraph_start,
        mention.start_char,
    )
}

fn has_explicit_naming_context(mention: &CandidateMention) -> bool {
    let prefix = trim_context_gap(&mention.prefix_text);
    let suffix = trim_context_gap(&mention.suffix_text);
    prefix.ends_with('叫')
        || prefix.ends_with("名叫")
        || prefix.ends_with("名字叫")
        || prefix.ends_with("称作")
        || suffix.starts_with('！')
        || suffix.starts_with('!')
        || suffix.starts_with('，')
        || suffix.starts_with(',')
}

fn has_strong_object_context(mention: &CandidateMention) -> bool {
    let prefix = trim_context_gap(&mention.prefix_text);
    STRONG_CHARACTER_OBJECT_PREFIXES
        .iter()
        .any(|predicate| prefix.ends_with(predicate))
}

fn has_speech_subject_context(mention: &CandidateMention) -> bool {
    let raw_suffix = trim_context_gap(&mention.suffix_text);
    let suffix = trim_leading_manner_context(raw_suffix);
    CONNECTOR_FOLLOWED_SPEECH_PREDICATES
        .iter()
        .any(|predicate| raw_suffix.starts_with(predicate) || suffix.starts_with(predicate))
}

pub(super) fn character_accumulator_quality(accumulator: &CharacterAccumulator) -> usize {
    let strong_mentions = accumulator
        .mentions
        .iter()
        .filter(|mention| is_strong_character_mention(mention))
        .count();
    let titled_name_bonus = if looks_like_specific_titled_character_name(&accumulator.name) {
        2
    } else {
        0
    };
    strong_mentions * 3 + titled_name_bonus
}

fn is_strong_character_mention(mention: &CandidateMention) -> bool {
    let raw_suffix = trim_context_gap(&mention.suffix_text);
    let suffix = trim_leading_manner_context(raw_suffix);
    let movement_suffix = trim_leading_movement_target_context(suffix);
    let prefix = trim_context_gap(&mention.prefix_text);
    if has_visual_predicate_with_non_character_target(raw_suffix)
        || has_visual_predicate_with_non_character_target(suffix)
    {
        return false;
    }
    STRONG_CHARACTER_PREDICATES.iter().any(|predicate| {
        raw_suffix.starts_with(predicate)
            || suffix.starts_with(predicate)
            || movement_suffix.starts_with(predicate)
    }) || has_adverbial_speech_suffix(raw_suffix)
        || STRONG_CHARACTER_OBJECT_PREFIXES
            .iter()
            .any(|predicate| prefix.ends_with(predicate))
        || looks_like_specific_titled_character_name(&mention.name)
}

fn has_visual_predicate_with_non_character_target(suffix: &str) -> bool {
    VISUAL_CHARACTER_PREDICATES.iter().any(|predicate| {
        suffix
            .strip_prefix(predicate)
            .and_then(first_cjk_token)
            .is_some_and(|target| {
                is_non_character_candidate(&target) && !is_exceptional_person_name(&target)
            })
    })
}

fn first_cjk_token(value: &str) -> Option<String> {
    let token: String = value
        .trim_start_matches(is_candidate_boundary_char)
        .chars()
        .take_while(|ch| is_cjk_char(*ch))
        .take(4)
        .collect();
    if token.is_empty() {
        None
    } else {
        Some(token)
    }
}

fn has_adverbial_speech_suffix(suffix: &str) -> bool {
    let preview: String = suffix.chars().take(24).collect();
    CHARACTER_HESITATION_MARKERS
        .iter()
        .any(|marker| preview.starts_with(marker))
        && CONNECTOR_FOLLOWED_SPEECH_PREDICATES
            .iter()
            .any(|predicate| preview.contains(predicate))
}

fn extract_names_from_text(text: &str) -> Vec<(String, usize, usize)> {
    static CONTEXT_RE: OnceLock<Regex> = OnceLock::new();
    static TITLE_RE: OnceLock<Regex> = OnceLock::new();
    static OBJECT_RE: OnceLock<Regex> = OnceLock::new();
    static ADVERBIAL_SPEECH_RE: OnceLock<Regex> = OnceLock::new();
    let context_regex = CONTEXT_RE.get_or_init(|| {
        Regex::new(
            r"([\p{Han}]{2,10}?)(?:低声说道|轻声说道|沉声说道|冷声说道|低声道|轻声道|沉声道|冷声道|反问道|大喊道|微笑道|苦笑道|冷笑道|轻笑道|干笑道|大笑道|继续说道|继续问道|继续开口|悠悠开口|正色说道|答道|说道|问道|笑道|喊道|叫道|反问|大喊|说|问|答|喊|叫|开口|低语|喃喃道|冷笑|看向|望向|盯着|保护|守护|攻击|询问|命令|救下|救助|追踪|怀疑|帮助|点了点头|摇了摇头|点点头|摇摇头|点头|摇头|沉默|回答|走来|转过头|回过头|抬起头|低下头|转头|回头|抬头|低头)",
        )
        .expect("character context regex should compile")
    });
    let title_regex = TITLE_RE.get_or_init(|| {
        Regex::new(r"[\p{Han}]{1,3}(?:医生|先生|小姐|队长|教官|老师|道长|城主|院长|将军|师兄|师姐|师父|师傅|殿下|陛下|少爷|姑娘|大叔)")
            .expect("character title regex should compile")
    });
    let object_regex = OBJECT_RE.get_or_init(|| {
        Regex::new(r"(?:看见|追上|保护|攻击|询问|命令|救下|遇见|找到|盯着|望向|看向|抱住|拦住|扶起|叫住|提到|想起)([\p{Han}]{2,5})")
            .expect("character object regex should compile")
    });
    let adverbial_speech_regex = ADVERBIAL_SPEECH_RE.get_or_init(|| {
        Regex::new(
            r"([\p{Han}]{2,4})(?:犹豫|迟疑|沉默|思索|思考|愣了|怔了|停顿)(?:了)?(?:片刻|半晌|一下|一会儿|良久)?[，,]?(?:却?还是|终于|这才|才|缓缓|慢慢|低声|轻声|沉声|冷声)?(?:开口|说道|问道|答道|说|问|答)",
        )
        .expect("character adverbial speech regex should compile")
    });
    let mut seen = HashSet::new();
    let mut matches = Vec::new();
    collect_named_captures(text, adverbial_speech_regex, &mut seen, &mut matches);
    collect_named_captures(text, context_regex, &mut seen, &mut matches);
    collect_named_captures(text, object_regex, &mut seen, &mut matches);
    for mat in title_regex.find_iter(text) {
        push_name_match(text, mat.start(), mat.end(), &mut seen, &mut matches);
    }
    matches.sort_by(|left, right| left.1.cmp(&right.1).then_with(|| left.0.cmp(&right.0)));
    matches
}

fn collect_named_captures(
    text: &str,
    regex: &Regex,
    seen: &mut HashSet<String>,
    matches: &mut Vec<(String, usize, usize)>,
) {
    for capture in regex.captures_iter(text) {
        if let Some(name) = capture.get(1) {
            push_name_match(text, name.start(), name.end(), seen, matches);
        }
    }
}

fn push_name_match(
    text: &str,
    start: usize,
    end: usize,
    seen: &mut HashSet<String>,
    matches: &mut Vec<(String, usize, usize)>,
) {
    let Some(raw_name) = text.get(start..end) else {
        return;
    };
    let Some((mut name, leading_bytes, trailing_bytes)) = clean_character_candidate(raw_name)
    else {
        return;
    };
    let adjusted_start = start + leading_bytes;
    let mut adjusted_end = end.saturating_sub(trailing_bytes);
    if let Some(trimmed_name) =
        trim_contextual_trailing_residue(text, adjusted_start, adjusted_end, &name)
    {
        adjusted_end = adjusted_end.saturating_sub(name.len().saturating_sub(trimmed_name.len()));
        name = trimmed_name;
    }
    if is_invalid_single_speech_predicate_suffix(text, adjusted_end, &name) {
        return;
    }
    if is_non_character_candidate_in_context(text, adjusted_start, adjusted_end, &name) {
        return;
    }
    let key = format!("{adjusted_start}:{name}");
    if seen.insert(key) {
        matches.push((name, adjusted_start, adjusted_end));
    }
}

fn trim_contextual_trailing_residue(
    text: &str,
    start: usize,
    end: usize,
    name: &str,
) -> Option<String> {
    if name.ends_with("猛")
        && name.chars().count() > 2
        && text
            .get(end..)
            .is_some_and(starts_with_particle_followed_by_action)
    {
        return trim_last_cjk_char(name);
    }
    if name.ends_with("来")
        && name.chars().count() > 2
        && text
            .get(end..)
            .is_some_and(|suffix| suffix.starts_with('说'))
        && previous_non_whitespace_char(text, start).is_some_and(|ch| ch == '对')
    {
        return trim_last_cjk_char(name);
    }
    None
}

fn starts_with_particle_followed_by_action(value: &str) -> bool {
    let trimmed = trim_context_gap(value);
    let Some(rest) = trimmed
        .strip_prefix('的')
        .or_else(|| trimmed.strip_prefix('地'))
    else {
        return false;
    };
    let rest = trim_context_gap(rest);
    CHARACTER_TRAILING_ACTIONS
        .iter()
        .chain(STRONG_CHARACTER_PREDICATES.iter())
        .any(|predicate| rest.starts_with(predicate))
}

fn previous_non_whitespace_char(text: &str, start: usize) -> Option<char> {
    text.get(..start)?
        .chars()
        .rev()
        .find(|ch| !ch.is_whitespace())
}

fn trim_last_cjk_char(value: &str) -> Option<String> {
    let mut chars: Vec<char> = value.chars().collect();
    chars.pop()?;
    let trimmed: String = chars.into_iter().collect();
    if (2..=4).contains(&trimmed.chars().count())
        && (!is_non_character_candidate(&trimmed) || is_exceptional_person_name(&trimmed))
    {
        Some(trimmed)
    } else {
        None
    }
}

fn clean_character_candidate(raw_name: &str) -> Option<(String, usize, usize)> {
    let (mut value, mut leading_bytes, mut trailing_bytes) =
        trim_candidate_boundaries(raw_name, 0, 0);
    loop {
        let mut changed = false;
        for prefix in CHARACTER_LEADING_NOISE
            .iter()
            .chain(CHARACTER_LEADING_FUNCTION_PREFIXES.iter())
        {
            if value.starts_with(prefix) && value.chars().count() > prefix.chars().count() + 1 {
                value = &value[prefix.len()..];
                leading_bytes += prefix.len();
                changed = true;
                break;
            }
        }
        if changed {
            let trimmed = trim_candidate_boundaries(value, leading_bytes, trailing_bytes);
            value = trimmed.0;
            leading_bytes = trimmed.1;
            trailing_bytes = trimmed.2;
            continue;
        }
        for suffix in CHARACTER_TRAILING_ACTIONS {
            if value.ends_with(suffix) && value.chars().count() > suffix.chars().count() + 1 {
                value = &value[..value.len() - suffix.len()];
                trailing_bytes += suffix.len();
                changed = true;
                break;
            }
        }
        if !changed {
            for suffix in CHARACTER_TRAILING_MODIFIERS {
                if value.ends_with(suffix) && value.chars().count() > suffix.chars().count() + 1 {
                    value = &value[..value.len() - suffix.len()];
                    trailing_bytes += suffix.len();
                    changed = true;
                    break;
                }
            }
        }
        if !changed {
            for suffix in CHARACTER_TRAILING_STATE_SUFFIXES {
                if value.ends_with(suffix) && value.chars().count() > suffix.chars().count() + 1 {
                    value = &value[..value.len() - suffix.len()];
                    trailing_bytes += suffix.len();
                    changed = true;
                    break;
                }
            }
        }
        if !changed {
            for suffix in CHARACTER_TRAILING_AUXILIARY_SUFFIXES {
                if value.ends_with(suffix)
                    && value.chars().count() > suffix.chars().count() + 1
                    && (suffix.chars().count() > 1 || *suffix != "都")
                {
                    value = &value[..value.len() - suffix.len()];
                    trailing_bytes += suffix.len();
                    changed = true;
                    break;
                }
            }
        }
        if !changed {
            for suffix in CHARACTER_TRAILING_MANNER_SUFFIXES {
                if value.ends_with(suffix) && value.chars().count() > suffix.chars().count() + 1 {
                    value = &value[..value.len() - suffix.len()];
                    trailing_bytes += suffix.len();
                    changed = true;
                    break;
                }
            }
        }
        if !changed {
            for suffix in CHARACTER_TRAILING_PARTIAL_ACTIONS {
                if value.ends_with(suffix) && value.chars().count() > suffix.chars().count() + 1 {
                    value = &value[..value.len() - suffix.len()];
                    trailing_bytes += suffix.len();
                    changed = true;
                    break;
                }
            }
        }
        if changed {
            let trimmed = trim_candidate_boundaries(value, leading_bytes, trailing_bytes);
            value = trimmed.0;
            leading_bytes = trimmed.1;
            trailing_bytes = trimmed.2;
            continue;
        }
        break;
    }
    let name = trim_name_particles(value);
    let char_count = name.chars().count();
    if !(2..=4).contains(&char_count) {
        return None;
    }
    if is_non_character_candidate(&name) && !is_exceptional_person_name(&name) {
        return None;
    }
    Some((name, leading_bytes, trailing_bytes))
}

fn is_invalid_single_speech_predicate_suffix(text: &str, end: usize, name: &str) -> bool {
    if !is_non_character_connector_phrase(name) && !is_pronoun_or_determiner_phrase(name) {
        return false;
    }
    let Some(suffix) = text.get(end..) else {
        return false;
    };
    let mut chars = suffix.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if !matches!(first, '说' | '问' | '答' | '喊' | '叫') {
        return false;
    }
    let Some(second) = chars.next() else {
        return false;
    };
    is_cjk_char(second)
        && !matches!(
            second,
            '了' | '着' | '过' | '些' | '什' | '道' | '起' | '出'
        )
}

pub(super) fn is_cjk_char(ch: char) -> bool {
    matches!(ch, '\u{3400}'..='\u{9fff}' | '\u{f900}'..='\u{faff}')
}

fn trim_candidate_boundaries(
    value: &str,
    mut leading_bytes: usize,
    mut trailing_bytes: usize,
) -> (&str, usize, usize) {
    let trimmed_start = value.trim_start_matches(is_candidate_boundary_char);
    leading_bytes += value.len().saturating_sub(trimmed_start.len());
    let trimmed_end = trimmed_start.trim_end_matches(is_candidate_boundary_char);
    trailing_bytes += trimmed_start.len().saturating_sub(trimmed_end.len());
    (trimmed_end, leading_bytes, trailing_bytes)
}

fn is_candidate_boundary_char(ch: char) -> bool {
    matches!(
        ch,
        '的' | '了'
            | '吗'
            | '呢'
            | '吧'
            | '啊'
            | '呀'
            | '着'
            | '过'
            | '在'
            | '和'
            | '与'
            | '对'
            | '向'
            | '把'
            | '被'
            | '“'
            | '”'
            | '‘'
            | '’'
            | '，'
            | '。'
            | '、'
            | '：'
            | '；'
            | '！'
            | '？'
            | '"'
            | '\''
            | ','
            | '.'
            | ':'
            | ';'
            | '!'
            | '?'
    )
}

fn trim_name_particles(name: &str) -> String {
    name.trim_matches(|ch: char| matches!(ch, '的' | '了' | '着' | '过' | '在' | '和' | '与'))
        .to_string()
}

const CHARACTER_LEADING_NOISE: &[&str] = &[
    "此时",
    "这时",
    "随后",
    "接着",
    "然后",
    "突然",
    "只见",
    "却见",
    "眼前",
    "身后",
    "面前",
    "远处",
    "旁边",
    "一旁",
    "下一刻",
    "与此同时",
];

pub(super) const CHARACTER_LEADING_FUNCTION_PREFIXES: &[&str] = &[
    "从", "见", "是", "眼", "且", "将", "那", "问", "到", "给", "就", "位", "连", "有", "于", "救",
    "找", "以", "复活", "听到", "刚才", "有关", "此刻", "没等", "直到", "好", "个", "由", "待着",
    "跟", "奉", "等", "可", "但", "而", "作为", "包括", "只是", "只能", "可以", "可是", "不过",
    "但是", "原来", "即便", "宗主", "叔叔", "伥鬼", "婢女", "剑仙", "剑修", "道士", "道人", "女冠",
    "女鬼", "天君", "国师", "城主", "堡主", "观主", "山主", "皇帝", "太子", "公主", "皇子",
];

pub(super) const CHARACTER_TRAILING_ACTIONS: &[&str] = &[
    "转过头",
    "回过头",
    "抬起头",
    "低下头",
    "点了点头",
    "摇了摇头",
    "点点头",
    "摇摇头",
    "转头",
    "低头",
    "回头",
    "抬头",
    "点头",
    "摇头",
    "转身",
    "扭头",
    "皱眉",
    "挑眉",
    "眯眼",
    "闭眼",
    "睁眼",
    "冷笑",
    "苦笑",
    "微笑",
    "大笑",
    "轻笑",
    "干笑",
    "沉默",
    "回答",
    "开口",
    "走来",
    "走去",
    "陷入",
    "起身",
    "停下",
    "看向",
    "望向",
    "盯着",
    "低声",
    "轻声",
    "沉声",
    "冷声",
    "大声",
    "小声",
    "柔声",
    "厉声",
    "怒声",
    "缓缓",
    "缓缓地",
    "慢慢",
    "慢慢地",
    "突然",
    "连忙",
    "立刻",
    "马上",
    "微微",
    "轻轻",
    "轻轻地",
    "淡淡",
    "淡淡地",
    "冷冷",
    "冷冷地",
    "猛地",
    "猛然",
    "忽然",
    "平静",
    "平静地",
    "认真",
    "认真地",
    "疑惑",
    "疑惑地",
];

const STRONG_CHARACTER_PREDICATES: &[&str] = &[
    "低声说道",
    "轻声说道",
    "沉声说道",
    "冷声说道",
    "低声道",
    "轻声道",
    "沉声道",
    "冷声道",
    "反问道",
    "大喊道",
    "微笑道",
    "苦笑道",
    "冷笑道",
    "轻笑道",
    "干笑道",
    "大笑道",
    "继续说道",
    "继续问道",
    "继续开口",
    "悠悠开口",
    "正色说道",
    "喃喃道",
    "说道",
    "问道",
    "答道",
    "笑道",
    "喊道",
    "叫道",
    "反问",
    "大喊",
    "开口",
    "低语",
    "回答",
    "看向",
    "望向",
    "盯着",
    "保护",
    "守护",
    "攻击",
    "询问",
    "命令",
    "救下",
    "救助",
    "追踪",
    "怀疑",
    "帮助",
    "点了点头",
    "摇了摇头",
    "点点头",
    "摇摇头",
    "点头",
    "摇头",
    "沉默",
    "走来",
    "走去",
];

const STRONG_CHARACTER_OBJECT_PREFIXES: &[&str] = &[
    "看见", "追上", "保护", "攻击", "询问", "命令", "救下", "遇见", "找到", "盯着", "望向", "看向",
    "抱住", "拦住", "扶起", "叫住", "提到", "想起",
];

const VISUAL_CHARACTER_PREDICATES: &[&str] = &["看向", "望向", "盯着"];

const NAME_INTRODUCTION_PREFIXES: &[&str] = &[
    "年轻人，",
    "年轻人,",
    "年轻女子，",
    "年轻女子,",
    "少女，",
    "少女,",
    "少年，",
    "少年,",
    "女子，",
    "女子,",
    "男子，",
    "男子,",
    "老人，",
    "老人,",
    "此乃",
    "此人是",
    "犬子",
    "名为",
    "名叫",
    "叫做",
    "小子",
    "丫头",
];

const CHARACTER_NAME_ACTIVITY_SUFFIXES: &[&str] = &[
    "说道", "问道", "答道", "笑道", "喊道", "叫道", "说", "问", "答", "喊", "叫", "开口", "点头",
    "摇头", "皱眉", "挥手", "摆手", "抬头", "低头", "转头", "回头", "转身", "走来", "走去", "现身",
    "出现", "上前", "起身", "停下", "看着", "看向", "望向", "盯着", "冷笑", "苦笑", "微笑", "大笑",
    "叹气", "叹息", "沉默", "沉声", "低声", "轻声", "怒道", "喝道", "道", "异常", "自然", "只是",
    "却", "也", "就", "已经", "正在", "忽然", "突然", "连忙", "赶忙", "立刻", "马上", "依旧",
    "仍旧", "一边", "将", "把", "被", "在", "从", "向", "给", "对", "见", "听",
];

pub(super) const CHARACTER_TRAILING_MODIFIERS: &[&str] = &[
    "忍不住",
    "正欲再",
    "正欲",
    "一边",
    "一字一顿",
    "义愤填膺",
    "义正严辞",
    "乐呵呵",
    "佯装",
    "佯装镇定",
    "决然",
    "冷静",
    "含泪",
    "恍然大悟",
    "恭恭敬敬",
    "哆哆嗦嗦",
    "怜巴巴",
    "意味深长",
    "手舞足蹈",
    "兴致勃勃",
    "双手叉腰",
    "满脸兴奋",
    "满脸不爽",
    "满脸老实",
    "脸颊通红",
    "咬牙切齿",
    "咬着牙",
    "有些诧异",
    "满脸羡慕",
    "脸颊微红",
    "若有所思",
    "不由得",
    "不得不",
    "不紧不慢",
    "似乎想",
    "似乎还想",
    "试探性",
    "试探性地",
    "难以置信",
    "面无表情",
    "表情古怪",
    "小心翼翼",
    "直勾勾",
    "骂骂咧咧",
    "语重心长",
    "压低声音",
    "无奈",
    "诧异",
    "惊讶",
    "错愕",
    "茫然",
    "担忧",
    "好奇",
    "狐疑",
    "虚弱",
    "含笑",
    "激动",
    "坚定",
    "笃定",
    "低沉",
    "沉声",
    "朗声",
    "咬牙",
    "果断",
    "僵硬",
    "礼貌",
    "凝重",
    "镇定",
    "乖巧",
    "惊恐",
    "温柔",
    "冰冷",
    "疑惑",
    "严肃",
    "郑重",
    "震惊",
    "满意",
    "森然",
    "沙哑",
    "苦涩",
    "恭敬",
    "满脸",
    "正死死",
    "死死",
    "死死地",
    "重重",
    "补充",
    "紧张地",
    "严肃地",
];

pub(super) const CHARACTER_TRAILING_STATE_SUFFIXES: &[&str] = &[
    "不解",
    "困惑",
    "疑惑",
    "无奈",
    "诧异",
    "惊讶",
    "错愕",
    "茫然",
    "担忧",
    "焦急",
    "好奇",
    "狐疑",
    "虚弱",
    "含笑",
    "激动",
    "坚定",
    "笃定",
    "低沉",
    "朗声",
    "咬牙",
    "果断",
    "僵硬",
    "礼貌",
    "凝重",
    "镇定",
    "乖巧",
    "惊恐",
    "温柔",
    "冰冷",
    "严肃",
    "郑重",
    "震惊",
    "满意",
    "森然",
    "沙哑",
    "苦涩",
    "恭敬",
    "平静",
    "认真",
    "尴尬",
    "遗憾",
    "急切",
    "抱歉",
    "头疼",
    "惊愕",
    "坚决",
    "惊喜",
    "短暂",
    "准确",
    "不好",
    "咧嘴",
    "没好气",
    "难以置信",
    "表情古怪",
    "面无表情",
    "骂骂咧咧",
    "小心翼翼",
    "直勾勾",
    "义愤填膺",
    "义正严辞",
    "乐呵呵",
    "佯装镇定",
    "兴致勃勃",
    "双手叉腰",
    "咬牙切齿",
    "咬着牙",
    "满脸羡慕",
    "满脸兴奋",
    "满脸不爽",
    "满脸老实",
    "脸颊微红",
    "脸颊通红",
    "试探性地",
    "死死地",
    "补充",
    "紧张地",
    "严肃地",
    "满脸",
    "正死死",
    "正死死地",
];

pub(super) const CHARACTER_TRAILING_AUXILIARY_SUFFIXES: &[&str] = &[
    "又",
    "也",
    "还",
    "仍",
    "很",
    "就",
    "却",
    "所",
    "才",
    "便",
    "才",
    "再",
    "已",
    "正",
    "都",
    "仍然",
    "依然",
    "已经",
    "正在",
    "没有",
    "并没有",
    "也没有",
    "都没有",
    "却没有",
    "但没有",
    "只是",
    "还是",
    "再度",
    "接着",
    "紧接",
    "随后",
    "然后",
    "突然",
    "同时",
    "纷纷",
    "连连",
    "一直",
    "下意识",
    "丝毫没有",
    "二话不",
    "时不时",
    "才微微",
    "刚要",
    "随即",
];

const CHARACTER_TRAILING_PARTIAL_ACTIONS: &[&str] = &[
    "点", "摇", "转", "回", "抬", "低", "看", "望", "盯", "问", "说", "答", "笑", "喊", "叫", "走",
    "停", "起", "皱", "挑", "眯", "睁", "闭", "向他", "向前", "俯身", "改口", "操控", "涌入",
    "思索", "站", "吃饭", "劝", "追", "气", "赶", "没",
];

pub(super) const CHARACTER_TRAILING_MANNER_SUFFIXES: &[&str] = &[
    "难以置信",
    "面无表情",
    "不紧不慢",
    "小心翼翼",
    "骂骂咧咧",
    "一字一顿",
    "没好气",
    "继续",
    "有些",
    "悠悠",
    "正经",
    "与关",
    "等人",
    "当即",
    "幽幽",
    "率先",
    "正色",
    "脸色",
    "双眸",
    "瞪眼",
    "苦恼",
    "沉思",
    "仔细",
    "关切",
    "干脆",
    "遗憾",
    "正想",
    "淡定",
    "适时",
    "震撼",
    "倔强",
    "紧",
    "张",
    "如实",
    "凝重",
    "淡淡",
    "慢悠悠",
    "冷冷",
    "缓缓",
    "慢慢",
    "默默",
    "猛地",
    "哈哈",
    "呵呵",
    "气",
    "嗤",
    "坏",
    "讥",
    "讪",
    "讪讪",
    "玩",
    "玩味",
    "奇怪",
    "担心",
    "灿烂",
    "爽朗",
    "坦然",
    "惨然",
    "欣慰",
    "小心",
    "自嘲",
    "默然",
    "闷闷",
    "洒然",
    "由衷",
    "纳闷",
    "高声",
    "畅快",
    "立即",
    "直接",
    "曾经",
    "虽然",
    "只能",
    "再次",
    "则",
    "这",
    "是",
    "一",
    "并肩",
    "甚至",
    "不敢",
    "不假",
    "偷偷",
    "嬉",
    "微",
    "哭",
    "怒",
    "按例",
    "残魂",
    "背后",
    "手心",
    "想要",
    "主动",
    "斜眼",
    "那个",
    "朝他",
    "老实",
    "抚须",
    "更",
    "嘲",
    "瞬间",
    "像",
    "于",
    "傻",
    "客",
    "死",
    "背",
    "几乎",
    "不忘",
    "确实",
    "抽空",
    "懒得",
    "赶忙",
    "终于",
    "飞快地",
    "关切地",
    "兴奋地",
    "大声地",
    "低声地",
    "轻声地",
];

pub(super) const CHARACTER_LEADING_PREDICATE_MODIFIERS: &[&str] = &[
    "转过头",
    "回过头",
    "抬起头",
    "低下头",
    "点了点头",
    "摇了摇头",
    "点点头",
    "摇摇头",
    "转头",
    "低头",
    "回头",
    "抬头",
    "扭头",
    "皱眉",
    "挑眉",
    "眯眼",
    "闭眼",
    "睁眼",
    "转身",
    "起身",
    "停下",
];

pub(super) fn normalize_character_name(name: &str) -> String {
    let trimmed = name.trim();
    canonicalize_exceptional_titled_name(trimmed)
        .or_else(|| canonicalize_exceptional_single_char_residue(trimmed))
        .unwrap_or(trimmed)
        .to_string()
}

fn canonicalize_exceptional_titled_name(name: &str) -> Option<&str> {
    const TITLE_SUFFIXES: &[&str] = &[
        "殿下", "姑娘", "先生", "将军", "长老", "王爷", "道长", "师兄", "师姐", "师弟", "师妹",
    ];
    TITLE_SUFFIXES.iter().find_map(|suffix| {
        let base = name.strip_suffix(suffix)?;
        (base.chars().count() >= 2 && is_exceptional_person_name(base)).then_some(base)
    })
}

fn canonicalize_exceptional_single_char_residue(name: &str) -> Option<&str> {
    let mut chars = name.char_indices().collect::<Vec<_>>();
    let (last_byte, last_char) = chars.pop()?;
    if !matches!(
        last_char,
        '不' | '有'
            | '开'
            | '凝'
            | '也'
            | '就'
            | '才'
            | '又'
            | '还'
            | '没'
            | '要'
            | '会'
            | '能'
            | '想'
            | '看'
            | '说'
            | '问'
            | '笑'
            | '走'
            | '来'
            | '去'
            | '都'
            | '只'
            | '将'
            | '把'
            | '被'
            | '在'
            | '对'
            | '向'
            | '给'
            | '从'
            | '往'
            | '与'
            | '跟'
            | '和'
            | '便'
            | '却'
            | '仍'
            | '正'
            | '已'
            | '可'
    ) {
        return None;
    }
    let base = &name[..last_byte];
    (base.chars().count() >= 2 && is_exceptional_person_name(base)).then_some(base)
}

fn byte_to_char_offset(text: &str, byte_offset: usize) -> usize {
    let boundary = previous_char_boundary(text, byte_offset.min(text.len()));
    text[..boundary].chars().count()
}

fn quote_around(text: &str, start: usize, end: usize) -> String {
    let quote_start = previous_char_boundary(text, start.saturating_sub(24));
    let quote_end = next_char_boundary(text, (end + 24).min(text.len()));
    text.get(quote_start..quote_end).unwrap_or("").to_string()
}

fn prefix_text(text: &str, start: usize) -> String {
    let prefix_start = previous_char_window_boundary(text, start, MENTION_CONTEXT_CHARS);
    text.get(prefix_start..start).unwrap_or("").to_string()
}

fn suffix_text(text: &str, end: usize) -> String {
    let suffix_end = next_char_window_boundary(text, end, MENTION_CONTEXT_CHARS);
    text.get(end..suffix_end).unwrap_or("").to_string()
}

fn previous_char_window_boundary(text: &str, end: usize, max_chars: usize) -> usize {
    let boundary = previous_char_boundary(text, end.min(text.len()));
    text[..boundary]
        .char_indices()
        .rev()
        .nth(max_chars.saturating_sub(1))
        .map(|(index, _)| index)
        .unwrap_or(0)
}

fn next_char_window_boundary(text: &str, start: usize, max_chars: usize) -> usize {
    let boundary = next_char_boundary(text, start.min(text.len()));
    text[boundary..]
        .char_indices()
        .nth(max_chars)
        .map(|(index, _)| boundary + index)
        .unwrap_or(text.len())
}

fn previous_char_boundary(text: &str, mut index: usize) -> usize {
    while index > 0 && !text.is_char_boundary(index) {
        index -= 1;
    }
    index
}

fn next_char_boundary(text: &str, mut index: usize) -> usize {
    while index < text.len() && !text.is_char_boundary(index) {
        index += 1;
    }
    index
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merges_single_character_residue_suffix_names_into_known_base_name() {
        let mut accumulators = BTreeMap::new();
        accumulators.insert(
            "陈平安".to_string(),
            test_accumulator("陈平安", 4, 0, "陈平安说道。"),
        );
        accumulators.insert(
            "陈平安不".to_string(),
            test_accumulator("陈平安不", 1, 1, "陈平安不说道。"),
        );
        accumulators.insert(
            "陈平安有".to_string(),
            test_accumulator("陈平安有", 1, 2, "陈平安有问道。"),
        );
        accumulators.insert(
            "陈平安开".to_string(),
            test_accumulator("陈平安开", 1, 3, "陈平安开说道。"),
        );

        let merged = merge_residue_suffix_accumulators(accumulators);

        let base = merged.get("陈平安").expect("base name should remain");
        assert_eq!(base.mention_count, 7);
        assert!(base.mentions.iter().all(|mention| mention.name == "陈平安"));
        assert!(!merged.contains_key("陈平安不"));
        assert!(!merged.contains_key("陈平安有"));
        assert!(!merged.contains_key("陈平安开"));
    }

    #[test]
    fn merges_phrase_residue_suffix_names_into_known_base_name() {
        let mut accumulators = BTreeMap::new();
        accumulators.insert(
            "宫艳".to_string(),
            test_accumulator("宫艳", 3, 0, "宫艳说道。"),
        );
        accumulators.insert(
            "宫艳嫣然".to_string(),
            test_accumulator("宫艳嫣然", 1, 1, "宫艳嫣然笑道。"),
        );
        accumulators.insert(
            "朱敛".to_string(),
            test_accumulator("朱敛", 3, 2, "朱敛说道。"),
        );
        accumulators.insert(
            "朱敛很快".to_string(),
            test_accumulator("朱敛很快", 1, 3, "朱敛很快说道。"),
        );

        let merged = merge_residue_suffix_accumulators(accumulators);

        assert_eq!(
            merged
                .get("宫艳")
                .expect("宫艳 should remain")
                .mention_count,
            4
        );
        assert_eq!(
            merged
                .get("朱敛")
                .expect("朱敛 should remain")
                .mention_count,
            4
        );
        assert!(!merged.contains_key("宫艳嫣然"));
        assert!(!merged.contains_key("朱敛很快"));
    }

    #[test]
    fn high_frequency_name_candidates_capture_plain_narration_names() {
        let chunks = vec![
            test_chunk(
                "c1",
                "年轻人，墨衍，他挥手否决。墨衍异常洒脱，墨衍见了满意地点点头。江枫！过来！此乃犬子江枫，小子江枫拜见苏伯伯。那名叫做傅玉桓的傅家天才来了，傅玉桓说道。",
                0,
            ),
            test_chunk(
                "c2",
                "墨衍说道，江枫在前面引路。墨衍看向苏瑶，江枫赶忙过来行礼。傅玉桓看向秋长明，傅玉桓微微皱眉。",
                1,
            ),
        ];

        let accumulators = collect_character_accumulators(&chunks);

        assert!(accumulators.contains_key("墨衍"));
        assert!(accumulators.contains_key("江枫"));
        assert!(accumulators.contains_key("傅玉桓"));
    }

    #[test]
    fn high_frequency_name_candidates_capture_fantasy_aliases_and_four_char_names() {
        let chunks = vec![
            test_chunk(
                "c1",
                "小黑说道。小黑问道。般若说道。般若看向张若尘。明王大尊说道。明王大尊看向众人。",
                0,
            ),
            test_chunk(
                "c2",
                "小黑笑道。小黑点头。般若开口。般若问道。明王大尊点头。明王大尊问道。",
                1,
            ),
            test_chunk(
                "c3",
                "小黑走来。小黑回答。般若沉默。般若说道。明王大尊沉默。明王大尊回答。",
                2,
            ),
            test_chunk(
                "c4",
                "小黑看向般若。般若看向小黑。明王大尊看向张若尘。明王大尊说道。",
                3,
            ),
        ];

        let accumulators = collect_character_accumulators(&chunks);

        assert!(accumulators.contains_key("小黑"));
        assert!(accumulators.contains_key("般若"));
        assert!(accumulators.contains_key("明王大尊"));
    }

    #[test]
    fn normalizes_confirmed_title_and_single_char_residue_names() {
        assert_eq!(normalize_character_name("般若殿下"), "般若");
        assert_eq!(normalize_character_name("般若姑娘"), "般若");
        assert_eq!(normalize_character_name("薛常进凝"), "薛常进");
    }

    #[test]
    fn rejects_confirmed_non_person_profiles_from_wangu_shendi_mentions() {
        for rejected in [
            "全部都",
            "莫非",
            "空间",
            "阎罗族",
            "罗刹族",
            "白衣谷",
            "黄泉印",
        ] {
            let accumulator = test_accumulator(rejected, 10, 0, &format!("{rejected}说道。"));
            assert!(
                !should_keep_character_accumulator(&accumulator),
                "{rejected} should not become a standalone profile"
            );
        }
    }

    #[test]
    fn removes_action_residue_profiles_from_known_character_names() {
        let mut accumulators = BTreeMap::new();
        accumulators.insert(
            "墨衍".to_string(),
            test_accumulator("墨衍", 10, 0, "墨衍说道。"),
        );
        for (index, name) in [
            "墨衍点",
            "墨衍摇",
            "墨衍反",
            "墨衍说道",
            "墨衍问道",
            "墨衍脸上",
            "墨衍喃喃",
        ]
        .iter()
        .enumerate()
        {
            accumulators.insert(
                (*name).to_string(),
                test_accumulator(name, 2, index + 1, &format!("{name}。")),
            );
        }

        let merged = merge_residue_suffix_accumulators(accumulators);

        assert_eq!(
            merged
                .get("墨衍")
                .expect("墨衍 should remain")
                .mention_count,
            24
        );
        for rejected in [
            "墨衍点",
            "墨衍摇",
            "墨衍反",
            "墨衍说道",
            "墨衍问道",
            "墨衍脸上",
            "墨衍喃喃",
        ] {
            assert!(
                !merged.contains_key(rejected),
                "{rejected} should merge into 墨衍"
            );
        }
    }

    #[test]
    fn definite_action_residue_profile_names_are_rejected_without_base() {
        for rejected in [
            "墨衍点",
            "墨衍摇",
            "墨衍反",
            "墨衍说道",
            "墨衍脸上",
            "井空羡慕",
            "叶晨居然",
        ] {
            let accumulator = test_accumulator(rejected, 3, 0, &format!("{rejected}。"));
            assert!(
                !should_keep_character_accumulator(&accumulator),
                "{rejected} should not become a standalone profile"
            );
        }
    }

    fn test_accumulator(
        name: &str,
        mention_count: usize,
        chapter_index: usize,
        quote: &str,
    ) -> CharacterAccumulator {
        let mention = CandidateMention {
            name: name.to_string(),
            start_char: 0,
            end_char: name.chars().count(),
            chunk_id: format!("chunk-{chapter_index}"),
            chapter: format!("第{}章", chapter_index + 1),
            chapter_index,
            chapter_title: format!("第{}章", chapter_index + 1),
            paragraph_start: chapter_index,
            paragraph_end: chapter_index + 1,
            quote: quote.to_string(),
            prefix_text: String::new(),
            suffix_text: "说道。".to_string(),
        };
        CharacterAccumulator {
            name: name.to_string(),
            mention_count,
            mentions: vec![mention.clone()],
            last_mention: Some(mention.clone()),
            chapter_stats: BTreeMap::from([(
                chapter_index,
                CharacterChapterAccumulator {
                    mention_count,
                    evidence_count: 1,
                    first_mention: mention.clone(),
                    last_mention: mention,
                },
            )]),
        }
    }

    fn test_chunk(id: &str, text: &str, chapter_index: usize) -> TextChunkRecord {
        TextChunkRecord {
            id: id.to_string(),
            book_id: "book-test".to_string(),
            book_title: "测试".to_string(),
            chapter: format!("第{}章", chapter_index + 1),
            ordinal: chapter_index,
            text: text.to_string(),
            chapter_index,
            chapter_title: format!("第{}章", chapter_index + 1),
            paragraph_start: chapter_index,
            paragraph_end: chapter_index + 1,
            char_start: 0,
            char_end: text.chars().count(),
            content_hash: String::new(),
            chunk_strategy_version: 1,
            created_at: String::new(),
        }
    }
}

pub(super) const NEGATIVE_FUNCTION_PREFIXES: &[&str] = &[
    "不",
    "并不",
    "不是",
    "不能",
    "不要",
    "不会",
    "不需要",
    "不好",
    "不如",
    "不算",
    "但",
    "也",
    "从",
    "见",
    "是",
    "眼",
    "且",
    "将",
    "那",
    "问",
    "听到",
    "刚才",
    "有关",
    "此刻",
    "没等",
    "直到",
    "好",
    "个",
    "由",
    "待着",
    "跟",
    "奉",
    "等",
    "作为",
    "可以",
    "可是",
    "只是",
    "只能",
    "即便",
    "原本",
    "原来",
    "便",
    "再",
    "像是",
];
