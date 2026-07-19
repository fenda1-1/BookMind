use crate::models::{
    BookIndexManifest, CharacterCenterBookSummaryPayload, CharacterIndexManifestRecord,
    CharacterProfileRecord, TaskKind, TaskRecord, TaskRunStatus,
};
use crate::paths::character_book_dir;
use crate::tasks::{load_index_manifest, load_task_logs_page_in, load_task_records};
use std::{fs, path::Path};

use super::CHARACTER_INDEX_VERSION;
#[rustfmt::skip]
pub(super) fn build_character_book_summary(
    data_dir: &Path,
    book: &crate::models::BookRecord,
    character_manifest: Option<&CharacterIndexManifestRecord>,
) -> CharacterCenterBookSummaryPayload {
    let text_manifest = load_index_manifest(data_dir)
        .ok()
        .and_then(|items| items.into_iter().find(|item| item.book_id == book.id));
    let text_index_chunk_count = text_manifest
        .as_ref()
        .map(|item| item.chunk_count)
        .unwrap_or(0);
    let text_index_fts_rows = text_manifest
        .as_ref()
        .map(|item| item.fts_row_count)
        .unwrap_or(0);
    let text_index_status = text_manifest
        .as_ref()
        .map(|item| item.status.clone())
        .unwrap_or_else(|| "missing".to_string());
    let text_index_ready =
        text_index_status == "ready" && text_index_chunk_count > 0 && text_index_fts_rows > 0;
    let manifest_status = character_manifest
        .map(|manifest| manifest.status.clone())
        .unwrap_or_default();
    let mut character_stale_reason =
        derive_character_stale_reason(text_manifest.as_ref(), character_manifest);
    let files_complete = character_manifest
        .map(|manifest| character_index_files_complete(data_dir, &manifest.book_id))
        .unwrap_or(false);
    let missing_ready_files = manifest_status == "ready"
        && text_index_ready
        && character_stale_reason.is_empty()
        && !files_complete;
    let effective_manifest_status = if manifest_status == "ready" && !character_stale_reason.is_empty() {
        "stale"
    } else if missing_ready_files {
        if character_stale_reason.is_empty() {
            character_stale_reason = "人物索引文件缺失，请重建人物索引".to_string();
        }
        "missing"
    } else {
        manifest_status.as_str()
    };
    let recent_task = latest_character_task_for_book(data_dir, &book.id);
    let recent_task_status = recent_task
        .as_ref()
        .map(|task| task.status.as_str())
        .unwrap_or("");
    let recent_task_newer_than_manifest =
        recent_task_is_newer_than_manifest(recent_task.as_ref(), character_manifest);
    let recent_task_log = recent_task
        .as_ref()
        .and_then(|task| recent_task_log_message(data_dir, &task.id));
    let recent_task_failed = recent_task
        .as_ref()
        .map(|task| task.status == TaskRunStatus::FAILED)
        .unwrap_or(false);
    let derived_character_status = derive_character_index_status(
        effective_manifest_status,
        text_index_ready,
        recent_task_status,
        recent_task_newer_than_manifest,
    );
    let derived_last_error = recent_task
        .as_ref()
        .filter(|_| recent_task_failed)
        .and_then(|task| {
            if task.error_message.is_empty() {
                None
            } else {
                Some(task.error_message.clone())
            }
        })
        .or_else(|| character_manifest.map(|item| item.last_error.clone()))
        .unwrap_or_default();
    let derived_error_stage = recent_task
        .as_ref()
        .filter(|_| recent_task_failed)
        .map(|task| {
            if task.error.stage.is_empty() {
                task.stage.clone()
            } else {
                task.error.stage.clone()
            }
        })
        .unwrap_or_default();
    let visible_character_count = character_manifest
        .filter(|_| !missing_ready_files)
        .and_then(|manifest| visible_character_count(data_dir, &manifest.book_id).ok())
        .or_else(|| character_manifest.filter(|_| !missing_ready_files).map(|item| item.character_count))
        .unwrap_or(0);
    CharacterCenterBookSummaryPayload {
        id: book.id.clone(),
        title: book.title.clone(),
        display_title: book.display_title.clone(),
        author: book.author.clone(),
        file_name: book.file_name.clone(),
        cover_tone: book.cover_tone.clone(),
        progress: book.progress,
        text_index_status,
        text_index_ready,
        text_index_chunk_count,
        text_index_fts_rows,
        character_index_status: derived_character_status,
        character_count: visible_character_count,
        relation_count: character_manifest
            .filter(|_| !missing_ready_files)
            .map(|item| item.relation_count)
            .unwrap_or(0),
        evidence_count: character_manifest
            .filter(|_| !missing_ready_files)
            .map(|item| item.evidence_count)
            .unwrap_or(0),
        last_character_built_at: character_manifest
            .map(|item| item.built_at.clone())
            .unwrap_or_default(),
        stale_reason: if !character_stale_reason.is_empty() {
            character_stale_reason
        } else {
            character_manifest
                .map(|item| item.stale_reason.clone())
                .unwrap_or_default()
        },
        last_error: derived_last_error,
        last_task_id: recent_task
            .as_ref()
            .map(|task| task.id.clone())
            .unwrap_or_default(),
        error_code: recent_task
            .as_ref()
            .filter(|_| recent_task_failed)
            .map(|task| task.error_code.clone())
            .unwrap_or_default(),
        error_stage: if recent_task_failed {
            derived_error_stage
        } else {
            String::new()
        },
        recent_log_entry: recent_task_log.unwrap_or_default(),
    }
}

pub(super) fn character_index_files_complete(data_dir: &Path, book_id: &str) -> bool {
    let dir = character_book_dir(data_dir, book_id);
    [
        "profiles.json",
        "mentions.jsonl",
        "evidence.jsonl",
        "relations.json",
        "events.json",
        "appearance-stats.json",
    ]
    .iter()
    .all(|file_name| dir.join(file_name).is_file())
}

fn visible_character_count(data_dir: &Path, book_id: &str) -> Result<usize, String> {
    let path = character_book_dir(data_dir, book_id).join("profiles.json");
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取人物中心文件 {}: {error}", path.display()))?;
    let profiles: Vec<CharacterProfileRecord> = serde_json::from_str(&raw)
        .map_err(|error| format!("无法解析人物中心文件 {}: {error}", path.display()))?;
    Ok(profiles.iter().filter(|profile| !profile.hidden).count())
}

fn derive_character_stale_reason(
    text_manifest: Option<&BookIndexManifest>,
    character_manifest: Option<&CharacterIndexManifestRecord>,
) -> String {
    let (Some(text_manifest), Some(character_manifest)) = (text_manifest, character_manifest)
    else {
        return String::new();
    };
    if text_manifest.status != "ready" {
        return String::new();
    }
    if character_manifest.status != "ready" {
        return String::new();
    }
    let mut reasons = Vec::new();
    if character_manifest.text_index_content_hash != text_manifest.content_hash {
        reasons.push("全文索引内容已变化");
    }
    if character_manifest.index_version != CHARACTER_INDEX_VERSION {
        reasons.push("人物识别算法版本已变化");
    }
    if character_manifest.chunk_strategy_version != text_manifest.chunk_strategy_version {
        reasons.push("chunk 策略版本已变化");
    }
    if character_manifest.chapter_rule_version != text_manifest.chapter_rule_version {
        reasons.push("章节规则版本已变化");
    }
    reasons.join("；")
}

fn latest_character_task_for_book(data_dir: &Path, book_id: &str) -> Option<TaskRecord> {
    load_task_records(data_dir)
        .ok()?
        .into_iter()
        .filter(|task| task.book_id == book_id && task.kind == TaskKind::CHARACTER_EXTRACTION)
        .max_by_key(task_sort_millis)
}

fn task_sort_millis(task: &TaskRecord) -> u128 {
    [
        &task.finished_at,
        &task.updated_at,
        &task.started_at,
        &task.created_at,
    ]
    .into_iter()
    .find_map(|value| value.parse::<u128>().ok().filter(|parsed| *parsed > 0))
    .unwrap_or(0)
}

fn recent_task_is_newer_than_manifest(
    task: Option<&TaskRecord>,
    manifest: Option<&CharacterIndexManifestRecord>,
) -> bool {
    let Some(task) = task else {
        return false;
    };
    let task_millis = task_sort_millis(task);
    let manifest_millis = manifest
        .and_then(|item| {
            [&item.updated_at, &item.built_at]
                .into_iter()
                .find_map(|value| value.parse::<u128>().ok().filter(|parsed| *parsed > 0))
        })
        .unwrap_or(0);
    task_millis >= manifest_millis
}

fn derive_character_index_status(
    manifest_status: &str,
    text_index_ready: bool,
    recent_task_status: &str,
    recent_task_newer_than_manifest: bool,
) -> String {
    if recent_task_newer_than_manifest {
        if recent_task_status == TaskRunStatus::QUEUED {
            return "queued".to_string();
        }
        if recent_task_status == TaskRunStatus::RUNNING
            || recent_task_status == TaskRunStatus::CANCELLING
        {
            return "building".to_string();
        }
        if recent_task_status == TaskRunStatus::FAILED {
            return "failed".to_string();
        }
    }
    if !text_index_ready {
        return "blocked-by-text-index".to_string();
    }
    if !manifest_status.is_empty() {
        return manifest_status.to_string();
    }
    "missing".to_string()
}

fn recent_task_log_message(data_dir: &Path, task_id: &str) -> Option<String> {
    load_task_logs_page_in(data_dir, Some(task_id), Some(1), Some(0))
        .ok()?
        .into_iter()
        .last()
        .map(|log| log.message)
}

pub(super) fn load_ready_text_index_manifest(
    data_dir: &Path,
    book_id: &str,
) -> Result<BookIndexManifest, String> {
    let manifest = load_index_manifest(data_dir)?;
    let Some(entry) = manifest.into_iter().find(|item| item.book_id == book_id) else {
        return Err("character_index_missing_text_index: 当前书没有全文索引 manifest".to_string());
    };
    if entry.status != "ready" || entry.chunk_count == 0 || entry.fts_row_count == 0 {
        return Err("character_index_missing_text_index: 当前书全文索引未就绪".to_string());
    }
    Ok(entry)
}
