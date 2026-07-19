use super::{
    chunk_storage::{load_book_chunk_records, load_chunk_manifest_entries},
    query::search_index_page_in,
};
use crate::database::count_book_fts_rows;
use crate::models::{
    AiDiagnosticsPayload, AiRequestPayload, AiResponsePayload, CitationPayload,
    SearchResultPayload, TextChunkRecord,
};
use crate::paths::fts_database_path;
use std::{
    collections::HashSet,
    path::Path,
    sync::{Mutex, OnceLock},
};

static CANCELLED_AI_REQUESTS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

fn cancelled_ai_requests() -> &'static Mutex<HashSet<String>> {
    CANCELLED_AI_REQUESTS.get_or_init(|| Mutex::new(HashSet::new()))
}

pub(crate) fn cancel_local_ai_request(request_id: &str) {
    if request_id.trim().is_empty() {
        return;
    }
    let mut cancelled = cancelled_ai_requests()
        .lock()
        .expect("cancelled AI request registry should lock");
    cancelled.insert(request_id.to_string());
}

fn clear_local_ai_cancellation(request_id: &str) {
    let mut cancelled = cancelled_ai_requests()
        .lock()
        .expect("cancelled AI request registry should lock");
    cancelled.remove(request_id);
}

fn ensure_local_ai_not_cancelled(request: &AiRequestPayload) -> Result<(), String> {
    let Some(request_id) = request
        .request_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    else {
        return Ok(());
    };
    let cancelled = cancelled_ai_requests()
        .lock()
        .expect("cancelled AI request registry should lock");
    if cancelled.contains(request_id) {
        return Err("AI 请求已停止".to_string());
    }
    Ok(())
}

fn strip_scope_prefixes(value: &str) -> String {
    let mut cleaned = value.trim().to_string();
    loop {
        let Some(rest) = cleaned.strip_prefix('[') else {
            break;
        };
        let Some(end) = rest.find(']') else {
            break;
        };
        let prefix = &rest[..end];
        if !matches!(
            prefix,
            "selection" | "page" | "chapter" | "volume" | "book" | "annotations" | "library"
        ) {
            break;
        }
        cleaned = rest[end + 1..].trim_start().to_string();
    }
    cleaned
}

fn extract_retrieval_terms(text: &str) -> Vec<String> {
    let cleaned = strip_scope_prefixes(text).replace(
        [
            '，', '。', '、', '：', '；', '！', '？', ',', '.', ':', ';', '!', '?', '\n',
        ],
        " ",
    );
    let stop_words = [
        "请", "当前", "章节", "本章", "主要", "事件", "信息", "增量", "角色", "状态", "变化",
        "给出", "引用", "依据", "总结", "梳理", "生成", "说明", "并", "的", "了", "和", "与", "或",
        "以及", "范围", "文本", "选区", "用", "三点",
    ];
    let mut terms = Vec::new();
    for raw in cleaned.split_whitespace() {
        let term = raw.trim_matches(|ch: char| {
            ch.is_ascii_punctuation() || ch == '“' || ch == '”' || ch == '‘' || ch == '’'
        });
        let char_count = term.chars().count();
        if char_count < 2 || stop_words.contains(&term) {
            continue;
        }
        if !terms.iter().any(|existing| existing == term) {
            terms.push(term.to_string());
        }
    }
    if terms.is_empty() {
        let compact: String = cleaned.chars().filter(|ch| !ch.is_whitespace()).collect();
        let mut current = String::new();
        for ch in compact.chars() {
            current.push(ch);
            if current.chars().count() == 4 {
                if !stop_words.contains(&current.as_str()) {
                    terms.push(current.clone());
                }
                current.clear();
            }
            if terms.len() >= 4 {
                break;
            }
        }
    }
    terms.into_iter().take(8).collect()
}

fn build_retrieval_query(request: &AiRequestPayload) -> String {
    if let Some(query) = &request.retrieval_query {
        let terms = extract_retrieval_terms(query);
        if !terms.is_empty() {
            return terms.join(" ");
        }
    }
    let mut combined = String::new();
    if let Some(command) = &request.selected_command_id {
        combined.push_str(command);
        combined.push(' ');
    }
    combined.push_str(&request.user_text);
    if combined.trim().is_empty() {
        combined.push_str(&request.instruction);
    }
    extract_retrieval_terms(&combined).join(" ")
}

fn is_summary_request(request: &AiRequestPayload) -> bool {
    request.selected_command_id.as_deref() == Some("summary")
        || request.instruction.contains("总结")
        || request.instruction.to_lowercase().contains("summarize")
}

fn should_use_scope_first(request: &AiRequestPayload) -> bool {
    request.retrieval_strategy.as_deref() == Some("scope-first")
}

fn should_use_multi_stage_retrieval(request: &AiRequestPayload) -> bool {
    request.multi_stage_retrieval_mode.as_deref() == Some("auto")
        && !should_use_scope_first(request)
}

fn local_result_limit(request: &AiRequestPayload) -> usize {
    request
        .local_result_limit
        .as_deref()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .unwrap_or(20)
        .clamp(1, 100)
}

fn citation_min_confidence(request: &AiRequestPayload) -> f32 {
    request
        .citation_min_confidence
        .as_deref()
        .and_then(|value| value.trim().parse::<f32>().ok())
        .unwrap_or(0.25)
        .clamp(0.0, 1.0)
}

fn search_ai_request(
    data_dir: &Path,
    request: &AiRequestPayload,
    query: &str,
) -> Result<Vec<SearchResultPayload>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let mut results = search_index_page_in(data_dir, query, local_result_limit(request), 0)?;
    if let Some(book_id) = &request.book_id {
        results.retain(|result| &result.book_id == book_id);
    }
    if request.scope == "chapter" {
        if let Some(scope_label) = &request.scope_label {
            results.retain(|result| {
                result.chapter == *scope_label
                    || scope_label.contains(&result.chapter)
                    || result.chapter.contains(scope_label)
            });
        }
    }
    Ok(results)
}

fn fallback_results_from_scope(
    data_dir: &Path,
    request: &AiRequestPayload,
) -> Result<Vec<SearchResultPayload>, String> {
    if let Some(scope_text) = request
        .scope_text
        .as_deref()
        .map(str::trim)
        .filter(|text| !text.is_empty())
    {
        return Ok(scope_results_from_text(request, scope_text));
    }
    let Some(book_id) = &request.book_id else {
        return Ok(Vec::new());
    };
    let chunks = load_book_chunk_records(data_dir, book_id)?;
    if chunks.is_empty() {
        return Ok(Vec::new());
    }
    let limit = local_result_limit(request);
    let scoped_chunks: Vec<TextChunkRecord> = if request.scope == "chapter" {
        let scope_label = request.scope_label.as_deref().unwrap_or_default();
        let chapter_matches: Vec<TextChunkRecord> = chunks
            .iter()
            .filter(|chunk| {
                scope_label.is_empty()
                    || chunk.chapter == scope_label
                    || chunk.chapter.contains(scope_label)
                    || scope_label.contains(&chunk.chapter)
            })
            .cloned()
            .collect();
        if chapter_matches.is_empty() {
            chunks.into_iter().take(limit).collect()
        } else {
            chapter_matches.into_iter().take(limit).collect()
        }
    } else {
        chunks.into_iter().take(limit).collect()
    };
    Ok(scoped_chunks
        .into_iter()
        .map(|chunk| SearchResultPayload {
            chunk_id: chunk.id,
            book_id: chunk.book_id,
            book_title: chunk.book_title,
            chapter: chunk.chapter,
            source_chapter_index: chunk.chapter_index,
            chapter_title: chunk.chapter_title,
            snippet: chunk.text.chars().take(180).collect(),
            score: 1,
            paragraph_index: chunk.paragraph_start,
            start_offset: 0,
            end_offset: 0,
        })
        .collect())
}

fn multi_stage_results_from_scope(
    data_dir: &Path,
    request: &AiRequestPayload,
    current_results: &[SearchResultPayload],
) -> Result<Vec<SearchResultPayload>, String> {
    let limit = local_result_limit(request);
    if current_results.len() >= limit {
        return Ok(Vec::new());
    }
    let mut scope_results = fallback_results_from_scope(data_dir, request)?;
    scope_results.truncate(limit.saturating_sub(current_results.len()));
    Ok(scope_results)
}

fn merge_search_results_by_chunk_id(
    mut primary: Vec<SearchResultPayload>,
    secondary: Vec<SearchResultPayload>,
    limit: usize,
) -> Vec<SearchResultPayload> {
    for result in secondary {
        if primary
            .iter()
            .any(|existing| existing.chunk_id == result.chunk_id)
        {
            continue;
        }
        primary.push(result);
        if primary.len() >= limit {
            break;
        }
    }
    primary.truncate(limit);
    primary
}

fn scope_results_from_text(
    request: &AiRequestPayload,
    scope_text: &str,
) -> Vec<SearchResultPayload> {
    let book_id = request
        .book_id
        .clone()
        .unwrap_or_else(|| "scope".to_string());
    let chapter = request
        .scope_label
        .clone()
        .unwrap_or_else(|| request.scope.clone());
    let book_title = request
        .scope_label
        .clone()
        .unwrap_or_else(|| "当前范围".to_string());
    if request.scope == "chapter" && is_summary_request(request) && scope_text.chars().count() > 720
    {
        return split_scope_text_segments(scope_text, 420)
            .into_iter()
            .enumerate()
            .map(|(index, segment)| SearchResultPayload {
                chunk_id: format!("scope-chapter-segment-{}", index + 1),
                book_id: book_id.clone(),
                book_title: book_title.clone(),
                chapter: chapter.clone(),
                source_chapter_index: index,
                chapter_title: chapter.clone(),
                snippet: segment.chars().take(220).collect(),
                score: 1,
                paragraph_index: index,
                start_offset: 0,
                end_offset: 0,
            })
            .collect();
    }
    vec![SearchResultPayload {
        chunk_id: format!("scope-{}", request.scope),
        book_id,
        book_title,
        chapter,
        source_chapter_index: 0,
        chapter_title: String::new(),
        snippet: scope_text.chars().take(180).collect(),
        score: 1,
        paragraph_index: 0,
        start_offset: 0,
        end_offset: 0,
    }]
}

fn split_scope_text_segments(scope_text: &str, max_chars: usize) -> Vec<String> {
    let mut segments = Vec::new();
    let mut current = String::new();
    for paragraph in scope_text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
    {
        let paragraph_len = paragraph.chars().count();
        let current_len = current.chars().count();
        if current_len > 0 && current_len + paragraph_len + 1 > max_chars {
            segments.push(current.trim().to_string());
            current.clear();
        }
        if paragraph_len > max_chars {
            if !current.trim().is_empty() {
                segments.push(current.trim().to_string());
                current.clear();
            }
            let mut chunk = String::new();
            for ch in paragraph.chars() {
                chunk.push(ch);
                if chunk.chars().count() >= max_chars {
                    segments.push(chunk.trim().to_string());
                    chunk.clear();
                }
            }
            if !chunk.trim().is_empty() {
                segments.push(chunk.trim().to_string());
            }
            continue;
        }
        if !current.is_empty() {
            current.push('\n');
        }
        current.push_str(paragraph);
    }
    if !current.trim().is_empty() {
        segments.push(current.trim().to_string());
    }
    segments
}

fn citations_from_results(
    results: &[SearchResultPayload],
    min_confidence: f32,
) -> Vec<CitationPayload> {
    let citation_limit = if results
        .iter()
        .any(|result| result.chunk_id.starts_with("scope-chapter-segment-"))
    {
        results.len()
    } else {
        3
    };
    let max_score = results.iter().map(|result| result.score).max().unwrap_or(1);
    results
        .iter()
        .filter(|result| {
            normalize_search_score_confidence(result.score, max_score) >= min_confidence
        })
        .take(citation_limit)
        .enumerate()
        .map(|(index, result)| CitationPayload {
            id: index + 1,
            label: format!("{} · {}", result.book_title, result.chapter),
            text: result.snippet.clone(),
            target_id: result.chunk_id.clone(),
            book_id: Some(result.book_id.clone()),
            chunk_id: Some(result.chunk_id.clone()),
            chapter_id: Some(result.chapter.clone()),
            source_chapter_index: Some(result.source_chapter_index),
            paragraph_index: Some(result.paragraph_index),
            start_offset: Some(result.start_offset),
            end_offset: Some(result.end_offset),
            confidence: Some(normalize_search_score_confidence(result.score, max_score)),
        })
        .collect()
}

fn normalize_search_score_confidence(score: usize, max_score: usize) -> f32 {
    if max_score == 0 {
        return 0.0;
    }
    ((score as f32) / (max_score as f32)).clamp(0.0, 1.0)
}

fn synthesize_local_answer(
    request: &AiRequestPayload,
    _query: &str,
    citations: &[CitationPayload],
    used_scope_fallback: bool,
) -> String {
    let segmented_note = used_scope_fallback
        && citations
            .iter()
            .any(|citation| citation.target_id.starts_with("scope-chapter-segment-"));
    let title = request
        .scope_label
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(if segmented_note {
            "本地分段摘要"
        } else if is_feeling_question(request) {
            "当前章节感受"
        } else {
            "本地阅读回答"
        });
    let citation_ids = citations
        .iter()
        .map(|citation| citation.id.to_string())
        .collect::<Vec<_>>();
    let evidence_lines = citations
        .iter()
        .take(3)
        .map(|citation| compact_local_answer_text(&citation.text, 96))
        .collect::<Vec<_>>();
    let first_evidence = evidence_lines
        .first()
        .map(String::as_str)
        .unwrap_or("当前范围缺少可用证据。");
    let answer_title = if segmented_note {
        "分段摘要"
    } else if is_feeling_question(request) {
        "整体感觉"
    } else if is_summary_request(request) {
        "章节摘要"
    } else if used_scope_fallback {
        "当前范围回答"
    } else {
        "回答"
    };
    let answer =
        build_local_answer_content(request, first_evidence, &evidence_lines, segmented_note);
    let protocol_citations = citations
        .iter()
        .map(|citation| {
            serde_json::json!({
                "id": citation.id.to_string(),
                "type": "pending",
                "label": citation.label,
                "quote": citation.text,
                "snippet": citation.text,
                "sourceText": citation.text,
                "bookId": citation.book_id,
                "chapterId": citation.chapter_id,
                "sourceChapterIndex": citation.source_chapter_index,
                "chapterIndex": citation.source_chapter_index,
                "paragraphIndex": citation.paragraph_index,
                "startOffset": citation.start_offset,
                "endOffset": citation.end_offset,
                "chunkId": citation.chunk_id,
                "confidence": citation.confidence,
                "status": "pending_binding"
            })
        })
        .collect::<Vec<_>>();
    let evidence_items = citations
        .iter()
        .map(|citation| {
            let id = citation.id.to_string();
            serde_json::json!({
                "claim": compact_local_answer_text(&citation.text, 72),
                "references": [{
                    "id": id,
                    "quote": citation.text,
                    "locationHint": citation.label,
                    "tool": "local-index"
                }],
                "citationIds": [id]
            })
        })
        .collect::<Vec<_>>();
    let response = serde_json::json!({
        "schema": "bookmind.ai.response.v2",
        "mode": "local",
        "title": title,
        "summary": compact_local_answer_text(&answer, 140),
        "blocks": [
            {
                "id": "blk_local_answer",
                "type": "paragraph",
                "title": answer_title,
                "content": answer,
                "citationIds": citation_ids,
            },
            {
                "id": "blk_local_evidence",
                "type": "evidence_list",
                "title": "依据",
                "items": evidence_items,
                "citationIds": citation_ids,
            }
        ],
        "citations": protocol_citations,
        "diagnostics": {
            "renderer": "local-index-structured",
            "fallbackUsed": used_scope_fallback,
            "segmentedScope": segmented_note
        }
    });
    serde_json::to_string(&response).unwrap_or_else(|_| {
        format!(
            "{}\n\n{}",
            answer_title,
            citations
                .iter()
                .map(|citation| citation.text.as_str())
                .collect::<Vec<_>>()
                .join("\n")
        )
    })
}

fn is_feeling_question(request: &AiRequestPayload) -> bool {
    let combined = format!(
        "{} {} {}",
        request.instruction,
        request.user_text,
        request.retrieval_query.as_deref().unwrap_or("")
    );
    ["感觉", "感受", "怎么样", "怎么看", "评价", "氛围"]
        .iter()
        .any(|keyword| combined.contains(keyword))
}

fn build_local_answer_content(
    request: &AiRequestPayload,
    first_evidence: &str,
    evidence_lines: &[String],
    segmented_note: bool,
) -> String {
    if is_feeling_question(request) {
        return format!(
            "我对这一段的整体感觉是：气氛被压得很紧，冲突感明显，人物选择也带着一种临场压力。最能支撑这个判断的是：{} 这让当前章节不像单纯交代事件，更像是在把角色推向必须行动的位置。",
            first_evidence
        );
    }
    if segmented_note {
        return format!(
            "分段摘要：{}",
            evidence_lines
                .iter()
                .enumerate()
                .map(|(index, line)| format!("第{}段 {}", index + 1, line))
                .collect::<Vec<_>>()
                .join("；")
        );
    }
    if is_summary_request(request) {
        return format!(
            "当前范围的核心内容可以概括为：{} 后续阅读时可以重点留意这些事实如何继续推动人物状态和冲突变化。",
            first_evidence
        );
    }
    let task = request.instruction.trim();
    if task.is_empty() {
        format!(
            "基于当前可引用文本，本地检索能确认的要点是：{}",
            first_evidence
        )
    } else {
        format!("针对“{}”，本地检索能确认的要点是：{}", task, first_evidence)
    }
}

fn compact_local_answer_text(value: &str, max_chars: usize) -> String {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut result = normalized.chars().take(max_chars).collect::<String>();
    if normalized.chars().count() > max_chars {
        result.push('…');
    }
    result
}

pub(crate) fn answer_from_local_index_in(
    data_dir: &Path,
    prompt: &str,
) -> Result<AiResponsePayload, String> {
    let request = AiRequestPayload {
        scope: "book".to_string(),
        instruction: prompt.to_string(),
        user_text: String::new(),
        selected_command_id: None,
        retrieval_strategy: None,
        retrieval_query: Some(prompt.to_string()),
        multi_stage_retrieval_mode: None,
        local_result_limit: None,
        citation_min_confidence: None,
        book_id: None,
        scope_text: None,
        scope_label: None,
        conversation_context: None,
        mode: Some("local".to_string()),
        interaction_mode: None,
        require_cloud_api: None,
        cloud_prompt_mode: None,
        cloud_response_format: None,
        request_id: None,
    };
    answer_from_ai_request_in(data_dir, &request)
}

pub(crate) fn answer_from_ai_request_in(
    data_dir: &Path,
    request: &AiRequestPayload,
) -> Result<AiResponsePayload, String> {
    ensure_local_ai_not_cancelled(request)?;
    let query = build_retrieval_query(request);
    ensure_local_ai_not_cancelled(request)?;
    let mut results = if should_use_scope_first(request) {
        fallback_results_from_scope(data_dir, request)?
    } else {
        search_ai_request(data_dir, request, &query)?
    };
    if should_use_multi_stage_retrieval(request) && !results.is_empty() {
        let scope_stage_results = multi_stage_results_from_scope(data_dir, request, &results)?;
        results = merge_search_results_by_chunk_id(
            results,
            scope_stage_results,
            local_result_limit(request),
        );
    }
    ensure_local_ai_not_cancelled(request)?;
    let chunk_count = if let Some(book_id) = &request.book_id {
        if let Some(entries) = load_chunk_manifest_entries(data_dir)? {
            if let Some(entry) = entries.iter().find(|entry| entry.book_id == *book_id) {
                entry.chunk_count
            } else {
                let fts_count = count_book_fts_rows(data_dir, book_id)?;
                if fts_count > 0 {
                    fts_count
                } else {
                    load_book_chunk_records(data_dir, book_id)?.len()
                }
            }
        } else {
            let fts_count = count_book_fts_rows(data_dir, book_id)?;
            if fts_count > 0 {
                fts_count
            } else {
                load_book_chunk_records(data_dir, book_id)?.len()
            }
        }
    } else {
        load_chunk_manifest_entries(data_dir)?
            .map(|entries| entries.len())
            .unwrap_or(0)
    };
    ensure_local_ai_not_cancelled(request)?;
    let used_scope_fallback = should_use_scope_first(request)
        || (results.is_empty()
            && (is_summary_request(request)
                || matches!(request.scope.as_str(), "chapter" | "page" | "selection")));
    if used_scope_fallback {
        results = fallback_results_from_scope(data_dir, request)?;
    }
    results.truncate(local_result_limit(request));
    ensure_local_ai_not_cancelled(request)?;
    let diagnostics = AiDiagnosticsPayload {
        scope: request.scope.clone(),
        query_used: if query.is_empty() {
            "无有效关键词".to_string()
        } else {
            query.clone()
        },
        chunk_count,
        fts_available: fts_database_path(data_dir).exists(),
        scope_empty: request
            .scope_text
            .as_deref()
            .unwrap_or("")
            .trim()
            .is_empty(),
        result_count: results.len(),
        fallback_used: used_scope_fallback,
        error_kind: if results.is_empty() {
            if chunk_count == 0 {
                "index-empty"
            } else {
                "query-no-match"
            }
            .to_string()
        } else {
            String::new()
        },
        recommendations: if results.is_empty() {
            vec![
                "改用当前章全文总结".to_string(),
                "去任务中心重新索引".to_string(),
                "改用云端模式".to_string(),
            ]
        } else if used_scope_fallback {
            vec!["关键词召回不足，已改用当前范围正文".to_string()]
        } else {
            Vec::new()
        },
    };
    if results.is_empty() {
        return Ok(AiResponsePayload {
            answer: format!(
                "本地索引诊断：没有找到可引用证据。\n范围：{}\n检索 query：{}\nchunks：{}\n建议：确认当前书已解析索引，或改用当前章全文总结/云端模式。",
                request.scope,
                if query.is_empty() { "无有效关键词" } else { query.as_str() },
                chunk_count
            ),
            citations: Vec::new(),
            diagnostics,
        });
    }

    let citations = citations_from_results(&results, citation_min_confidence(request));
    ensure_local_ai_not_cancelled(request)?;
    if let Some(request_id) = request.request_id.as_deref() {
        clear_local_ai_cancellation(request_id);
    }

    Ok(AiResponsePayload {
        answer: synthesize_local_answer(request, &query, &citations, used_scope_fallback),
        citations,
        diagnostics,
    })
}
