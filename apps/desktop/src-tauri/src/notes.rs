use crate::encryption::{
    decrypt_local_payload, encrypt_local_payload, parse_local_encrypted_envelope,
};
use crate::library::now_epoch_millis;
use crate::models::{
    AiGeneratedFlashcardRequest, AiNoteMetadataPayload, CitationPayload, FlashcardRecord,
    HighlightRecord, NoteRecord, ReaderLocationPayload,
};
use crate::paths::{exports_dir, flashcards_file_path, highlights_file_path, notes_file_path};
use std::{
    fs,
    path::{Path, PathBuf},
};

pub(crate) fn load_note_records(data_dir: &Path) -> Result<Vec<NoteRecord>, String> {
    let path = notes_file_path(data_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取笔记 {}: {error}", path.display()))?;
    let (records, encrypted) = parse_encrypted_or_plain_records::<NoteRecord>(data_dir, &raw)
        .map_err(|error| format!("无法解析笔记 {}: {error}", path.display()))?;
    if !encrypted {
        save_note_records(data_dir, &records)?;
    }
    Ok(records)
}

pub(crate) fn reencrypt_local_encrypted_note_files_in(data_dir: &Path) -> Result<usize, String> {
    let mut changed = 0usize;
    if reencrypt_records_file::<NoteRecord>(data_dir, &notes_file_path(data_dir), "笔记")? {
        changed += 1;
    }
    if reencrypt_records_file::<HighlightRecord>(
        data_dir,
        &highlights_file_path(data_dir),
        "高亮摘录",
    )? {
        changed += 1;
    }
    if reencrypt_records_file::<FlashcardRecord>(data_dir, &flashcards_file_path(data_dir), "闪卡")?
    {
        changed += 1;
    }
    Ok(changed)
}

fn reencrypt_records_file<T>(data_dir: &Path, path: &Path, label: &str) -> Result<bool, String>
where
    T: serde::de::DeserializeOwned + serde::Serialize,
{
    if !path.exists() {
        return Ok(false);
    }
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("无法读取{label} {}: {error}", path.display()))?;
    let (records, _) = parse_encrypted_or_plain_records::<T>(data_dir, &raw)
        .map_err(|error| format!("无法解析{label} {}: {error}", path.display()))?;
    let encrypted = serialize_encrypted_records(data_dir, &records)
        .map_err(|error| format!("无法重加密{label}: {error}"))?;
    fs::write(path, encrypted)
        .map_err(|error| format!("无法写入重加密{label} {}: {error}", path.display()))?;
    Ok(true)
}

fn save_note_records(data_dir: &Path, records: &[NoteRecord]) -> Result<(), String> {
    let path = notes_file_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建笔记目录 {}: {error}", parent.display()))?;
    }
    let raw = serialize_encrypted_records(data_dir, records)
        .map_err(|error| format!("无法序列化笔记: {error}"))?;
    fs::write(&path, raw).map_err(|error| format!("无法写入笔记 {}: {error}", path.display()))
}

fn parse_encrypted_or_plain_records<T>(data_dir: &Path, raw: &str) -> Result<(Vec<T>, bool), String>
where
    T: serde::de::DeserializeOwned,
{
    let value =
        serde_json::from_str::<serde_json::Value>(raw).map_err(|error| error.to_string())?;
    if let Some(envelope) = parse_local_encrypted_envelope(&value)? {
        let decoded = decrypt_local_payload(data_dir, &envelope)?;
        let records = serde_json::from_str::<Vec<T>>(&decoded)
            .map_err(|error| format!("加密记录 payload 无法解析: {error}"))?;
        return Ok((records, true));
    }
    let records = serde_json::from_value::<Vec<T>>(value).map_err(|error| error.to_string())?;
    Ok((records, false))
}

fn serialize_encrypted_records<T>(data_dir: &Path, records: &[T]) -> Result<String, String>
where
    T: serde::Serialize,
{
    let payload = serde_json::to_string(records).map_err(|error| error.to_string())?;
    let envelope = encrypt_local_payload(data_dir, &payload)?;
    serde_json::to_string_pretty(&envelope).map_err(|error| error.to_string())
}

pub(crate) fn save_ai_note_in(
    data_dir: &Path,
    title: &str,
    body: &str,
    citations: &[CitationPayload],
    save_target: Option<String>,
    reader_location: Option<ReaderLocationPayload>,
    ai_metadata: Option<AiNoteMetadataPayload>,
    structured_response: Option<serde_json::Value>,
) -> Result<NoteRecord, String> {
    let mut notes = load_note_records(data_dir)?;
    let created_at = now_epoch_millis().to_string();
    let note = NoteRecord {
        id: format!("note-{created_at}-{}", notes.len() + 1),
        title: title.trim().to_string(),
        body: body.trim().to_string(),
        source: "ai-reader".to_string(),
        created_at,
        citations: citations.to_vec(),
        save_target: normalize_note_save_target(save_target),
        reader_location,
        ai_metadata,
        structured_response,
    };
    notes.insert(0, note.clone());
    save_note_records(data_dir, &notes)?;
    Ok(note)
}

pub(crate) fn delete_note_records_in(data_dir: &Path, ids: &[String]) -> Result<usize, String> {
    if ids.is_empty() {
        return Ok(0);
    }
    let mut notes = load_note_records(data_dir)?;
    let delete_ids: std::collections::HashSet<&str> = ids.iter().map(String::as_str).collect();
    let before = notes.len();
    notes.retain(|note| !delete_ids.contains(note.id.as_str()));
    let removed = before.saturating_sub(notes.len());
    if removed > 0 {
        save_note_records(data_dir, &notes)?;
    }
    Ok(removed)
}

fn normalize_note_save_target(save_target: Option<String>) -> Option<String> {
    match save_target.as_deref().map(str::trim) {
        Some("knowledge" | "book" | "inbox") => save_target.map(|target| target.trim().to_string()),
        _ => None,
    }
}

pub(crate) fn load_highlight_records(data_dir: &Path) -> Result<Vec<HighlightRecord>, String> {
    let path = highlights_file_path(data_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取高亮摘录 {}: {error}", path.display()))?;
    let (records, encrypted) = parse_encrypted_or_plain_records::<HighlightRecord>(data_dir, &raw)
        .map_err(|error| format!("无法解析高亮摘录 {}: {error}", path.display()))?;
    if !encrypted {
        save_highlight_records(data_dir, &records)?;
    }
    Ok(records)
}

fn save_highlight_records(data_dir: &Path, records: &[HighlightRecord]) -> Result<(), String> {
    let path = highlights_file_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建高亮目录 {}: {error}", parent.display()))?;
    }
    let raw = serialize_encrypted_records(data_dir, records)
        .map_err(|error| format!("无法序列化高亮摘录: {error}"))?;
    fs::write(&path, raw).map_err(|error| format!("无法写入高亮摘录 {}: {error}", path.display()))
}

pub(crate) fn save_highlight_in(
    data_dir: &Path,
    citation: &CitationPayload,
) -> Result<HighlightRecord, String> {
    let mut highlights = load_highlight_records(data_dir)?;
    let created_at = now_epoch_millis().to_string();
    let highlight = HighlightRecord {
        id: format!("highlight-{created_at}-{}", highlights.len() + 1),
        label: citation.label.clone(),
        text: citation.text.clone(),
        target_id: citation.target_id.clone(),
        created_at,
    };
    highlights.insert(0, highlight.clone());
    save_highlight_records(data_dir, &highlights)?;
    Ok(highlight)
}

pub(crate) fn delete_highlight_records_in(
    data_dir: &Path,
    ids: &[String],
) -> Result<usize, String> {
    if ids.is_empty() {
        return Ok(0);
    }
    let mut highlights = load_highlight_records(data_dir)?;
    let delete_ids: std::collections::HashSet<&str> = ids.iter().map(String::as_str).collect();
    let before = highlights.len();
    highlights.retain(|highlight| !delete_ids.contains(highlight.id.as_str()));
    let removed = before.saturating_sub(highlights.len());
    if removed > 0 {
        save_highlight_records(data_dir, &highlights)?;
    }
    Ok(removed)
}

pub(crate) fn load_flashcard_records(data_dir: &Path) -> Result<Vec<FlashcardRecord>, String> {
    let path = flashcards_file_path(data_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取闪卡 {}: {error}", path.display()))?;
    let (records, encrypted) = parse_encrypted_or_plain_records::<FlashcardRecord>(data_dir, &raw)
        .map_err(|error| format!("无法解析闪卡 {}: {error}", path.display()))?;
    if !encrypted {
        save_flashcard_records(data_dir, &records)?;
    }
    Ok(records)
}

fn save_flashcard_records(data_dir: &Path, records: &[FlashcardRecord]) -> Result<(), String> {
    let path = flashcards_file_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建闪卡目录 {}: {error}", parent.display()))?;
    }
    let raw = serialize_encrypted_records(data_dir, records)
        .map_err(|error| format!("无法序列化闪卡: {error}"))?;
    fs::write(&path, raw).map_err(|error| format!("无法写入闪卡 {}: {error}", path.display()))
}

pub(crate) fn generate_flashcards_from_highlights_in(
    data_dir: &Path,
) -> Result<Vec<FlashcardRecord>, String> {
    generate_flashcards_from_highlights_with_defaults_in(data_dir, &[], "new")
}

pub(crate) fn generate_flashcards_from_highlights_with_defaults_in(
    data_dir: &Path,
    default_tags: &[String],
    default_review_status: &str,
) -> Result<Vec<FlashcardRecord>, String> {
    generate_flashcards_from_highlights_with_template_defaults_in(
        data_dir,
        default_tags,
        default_review_status,
        None,
        None,
    )
}

pub(crate) fn generate_flashcards_from_highlights_with_template_defaults_in(
    data_dir: &Path,
    default_tags: &[String],
    default_review_status: &str,
    front_template: Option<&str>,
    back_template: Option<&str>,
) -> Result<Vec<FlashcardRecord>, String> {
    let highlights = load_highlight_records(data_dir)?;
    let mut flashcards = load_flashcard_records(data_dir)?;
    let existing_targets: std::collections::HashSet<String> = flashcards
        .iter()
        .map(|card| card.source_target_id.clone())
        .collect();
    let mut generated = Vec::new();
    let tags = normalize_flashcard_tags(default_tags);
    let review_status = normalize_flashcard_review_status(default_review_status);
    let front_template = normalize_flashcard_template(front_template, "{label}");
    let back_template = normalize_flashcard_template(back_template, "{text}");

    for highlight in highlights {
        if existing_targets.contains(&highlight.target_id) {
            continue;
        }
        let created_at = now_epoch_millis().to_string();
        let front = apply_flashcard_template(&front_template, &highlight, &created_at, "{label}");
        let back = apply_flashcard_template(&back_template, &highlight, &created_at, "{text}");
        let card = FlashcardRecord {
            id: format!(
                "flashcard-{created_at}-{}",
                flashcards.len() + generated.len() + 1
            ),
            front,
            back,
            source_label: highlight.label,
            source_target_id: highlight.target_id,
            created_at,
            tags: tags.clone(),
            citation_ids: Vec::new(),
            chapter: None,
            review_status: review_status.clone(),
        };
        generated.push(card.clone());
        flashcards.insert(0, card);
    }

    save_flashcard_records(data_dir, &flashcards)?;
    Ok(generated)
}

fn normalize_flashcard_template(value: Option<&str>, fallback: &str) -> String {
    value
        .map(|template| template.trim().replace("\r\n", "\n"))
        .filter(|template| !template.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

fn apply_flashcard_template(
    template: &str,
    highlight: &HighlightRecord,
    created_at: &str,
    fallback: &str,
) -> String {
    let rendered = template
        .replace("{label}", &highlight.label)
        .replace("{text}", &highlight.text)
        .replace("{targetId}", &highlight.target_id)
        .replace("{createdAt}", created_at)
        .trim()
        .to_string();
    if rendered.is_empty() {
        match fallback {
            "{label}" if !highlight.label.trim().is_empty() => highlight.label.trim().to_string(),
            "{text}" if !highlight.text.trim().is_empty() => highlight.text.trim().to_string(),
            _ if !highlight.label.trim().is_empty() => highlight.label.trim().to_string(),
            _ if !highlight.text.trim().is_empty() => highlight.text.trim().to_string(),
            _ => created_at.to_string(),
        }
    } else {
        rendered
    }
}

fn normalize_flashcard_tags(tags: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();
    for tag in tags {
        let trimmed = tag.trim();
        if trimmed.is_empty() || normalized.iter().any(|item: &String| item == trimmed) {
            continue;
        }
        normalized.push(trimmed.to_string());
        if normalized.len() >= 12 {
            break;
        }
    }
    normalized
}

fn normalize_flashcard_review_status(value: &str) -> String {
    match value.trim() {
        "due" => "due",
        "reviewed" => "reviewed",
        _ => "new",
    }
    .to_string()
}

pub(crate) fn save_ai_generated_flashcards_in(
    data_dir: &Path,
    cards: &[AiGeneratedFlashcardRequest],
) -> Result<Vec<FlashcardRecord>, String> {
    let mut flashcards = load_flashcard_records(data_dir)?;
    let mut saved = Vec::new();

    for request in cards {
        if request.front.trim().is_empty() || request.back.trim().is_empty() {
            continue;
        }
        let created_at = now_epoch_millis().to_string();
        let card = FlashcardRecord {
            id: format!(
                "flashcard-ai-{created_at}-{}",
                flashcards.len() + saved.len() + 1
            ),
            front: request.front.trim().to_string(),
            back: request.back.trim().to_string(),
            source_label: request.source_label.trim().to_string(),
            source_target_id: request.source_target_id.trim().to_string(),
            created_at,
            tags: request.tags.clone(),
            citation_ids: request.citation_ids.clone(),
            chapter: request.chapter.clone(),
            review_status: request
                .review_status
                .clone()
                .unwrap_or_else(|| "new".to_string()),
        };
        saved.push(card.clone());
        flashcards.insert(0, card);
    }

    save_flashcard_records(data_dir, &flashcards)?;
    Ok(saved)
}

pub(crate) fn delete_flashcard_records_in(
    data_dir: &Path,
    ids: &[String],
) -> Result<usize, String> {
    if ids.is_empty() {
        return Ok(0);
    }
    let mut flashcards = load_flashcard_records(data_dir)?;
    let delete_ids: std::collections::HashSet<&str> = ids.iter().map(String::as_str).collect();
    let before = flashcards.len();
    flashcards.retain(|flashcard| !delete_ids.contains(flashcard.id.as_str()));
    let removed = before.saturating_sub(flashcards.len());
    if removed > 0 {
        save_flashcard_records(data_dir, &flashcards)?;
    }
    Ok(removed)
}

pub(crate) fn export_knowledge_markdown_in(data_dir: &Path) -> Result<String, String> {
    export_knowledge_markdown_with_options_in(data_dir, false, false, None)
}

pub(crate) fn export_knowledge_markdown_with_options_in(
    data_dir: &Path,
    include_ai_metadata: bool,
    include_structured_response: bool,
    export_path: Option<&str>,
) -> Result<String, String> {
    let notes = load_note_records(data_dir)?;
    let highlights = load_highlight_records(data_dir)?;
    let flashcards = load_flashcard_records(data_dir)?;
    let path = resolve_knowledge_markdown_export_path(data_dir, export_path)?;

    let mut markdown = String::from("# BookMind Knowledge Export\n\n");
    markdown.push_str("## Notes\n\n");
    if notes.is_empty() {
        markdown.push_str("_No notes saved._\n\n");
    }
    for note in &notes {
        markdown.push_str(&format!("### {}\n\n{}\n\n", note.title, note.body));
        for citation in &note.citations {
            markdown.push_str(&format!(
                "- [{}] {} — `{}`\n",
                citation.id, citation.label, citation.target_id
            ));
        }
        if include_ai_metadata {
            if let Some(metadata) = &note.ai_metadata {
                markdown.push_str("\n#### AI Metadata\n\n```json\n");
                markdown.push_str(
                    &serde_json::to_string_pretty(metadata)
                        .map_err(|error| format!("无法序列化 AI 元数据: {error}"))?,
                );
                markdown.push_str("\n```\n");
            }
        }
        if include_structured_response {
            if let Some(structured_response) = &note.structured_response {
                markdown.push_str("\n#### Structured Response\n\n```json\n");
                markdown.push_str(
                    &serde_json::to_string_pretty(structured_response)
                        .map_err(|error| format!("无法序列化结构化响应: {error}"))?,
                );
                markdown.push_str("\n```\n");
            }
        }
        markdown.push('\n');
    }

    markdown.push_str("## Highlights\n\n");
    if highlights.is_empty() {
        markdown.push_str("_No highlights saved._\n\n");
    }
    for highlight in &highlights {
        markdown.push_str(&format!(
            "- **{}**: {} (`{}`)\n",
            highlight.label, highlight.text, highlight.target_id
        ));
    }
    markdown.push('\n');

    markdown.push_str("## Flashcards\n\n");
    if flashcards.is_empty() {
        markdown.push_str("_No flashcards generated._\n");
    }
    for card in &flashcards {
        markdown.push_str(&format!(
            "### {}\n\n{}\n\nSource: `{}`\n\n",
            card.front, card.back, card.source_target_id
        ));
    }

    fs::write(&path, markdown)
        .map_err(|error| format!("无法写入 Markdown 导出 {}: {error}", path.display()))?;
    Ok(path.display().to_string())
}

fn resolve_knowledge_markdown_export_path(
    data_dir: &Path,
    export_path: Option<&str>,
) -> Result<PathBuf, String> {
    let path = match export_path.map(str::trim).filter(|path| !path.is_empty()) {
        Some(path) => PathBuf::from(path),
        None => exports_dir(data_dir).join("bookmind-knowledge.md"),
    };

    if let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建导出目录 {}: {error}", parent.display()))?;
    }

    Ok(path)
}
