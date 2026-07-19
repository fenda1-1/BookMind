use crate::database::{count_book_fts_rows, delete_book_fts_rows, rewrite_book_fts_rows};
use crate::library::load_library_records;
use crate::models::{
    BookIndexManifest, BookRecord, IndexDiagnosticsPayload, IndexDiagnosticsSummaryPayload,
    TaskError, TaskErrorCode, TaskKind, TaskRecord, TaskRunStatus, TaskStage, TaskStatusPayload,
    VectorIndexManifestEntry, VectorIndexStatus,
};
use crate::paths::{
    fts_database_path, index_manifest_path, rebase_managed_data_path, vector_index_manifest_path,
};
use crate::search::{delete_book_chunk_records, load_book_chunk_records, IndexChunkingOptions};
use crate::settings::load_settings_v2;
use std::{
    fs,
    path::{Path, PathBuf},
};

mod errors;
mod kinds;
mod progress;
mod runner;
mod store;

use errors::collect_recent_index_errors;
pub(crate) use errors::is_retryable_task_error_code;
use kinds::{
    complete_ready_placeholder_dag_tasks, is_index_task_kind, is_restorable_archived_task_kind,
    is_runnable_task_kind, update_dag_blockers,
};
#[allow(unused_imports)]
pub(crate) use progress::{
    append_task_log, append_task_log_at, apply_task_log_retention_in, clear_task_logs_in,
    complete_task, complete_task_with_message, emit_task_progress, fail_task, load_task_logs_in,
    load_task_logs_page_in, mark_task_stage, stream_task_progress_snapshot, TaskProgressEventSink,
};
use runner::load_index_runtime_settings;
pub(crate) use runner::try_acquire_task_runner;
pub(crate) use runner::{run_parse_and_index_tasks_in, run_parse_and_index_tasks_with_events_in};
pub(crate) use store::{load_task_records, now_millis_string_for_records, save_task_records};

pub(super) const CURRENT_INDEX_VERSION: u32 = 1;
pub(super) const CURRENT_CHUNK_STRATEGY_VERSION: u32 = 1;
pub(super) const CURRENT_CHAPTER_RULE_VERSION: u32 = 1;
pub(super) const CURRENT_FTS_SCHEMA_VERSION: u32 = 1;

#[derive(Clone, Debug)]
pub(super) struct IndexRuntimeSettings {
    pub(super) concurrency_limit: usize,
    pub(super) chunking: IndexChunkingOptions,
    pub(super) rebuild_strategy: String,
    pub(super) recent_error_limit: usize,
}

impl Default for IndexRuntimeSettings {
    fn default() -> Self {
        Self {
            concurrency_limit: 1,
            chunking: IndexChunkingOptions::default(),
            rebuild_strategy: "prompt".to_string(),
            recent_error_limit: 5,
        }
    }
}

fn normalized_status(status: &str) -> String {
    match status {
        value
            if value == TaskRunStatus::LEGACY_DONE || value == TaskRunStatus::LEGACY_COMPLETED =>
        {
            TaskRunStatus::SUCCEEDED
        }
        other => other,
    }
    .to_string()
}

fn is_task_status_one_of(status: &str, statuses: &[&str]) -> bool {
    statuses.contains(&status)
}

fn is_completed_task_status(status: &str) -> bool {
    is_task_status_one_of(
        status,
        &[
            TaskRunStatus::SUCCEEDED,
            TaskRunStatus::SKIPPED,
            TaskRunStatus::CANCELLED,
            TaskRunStatus::ARCHIVED,
        ],
    )
}

fn is_active_task_status(status: &str) -> bool {
    is_task_status_one_of(
        status,
        &[
            TaskRunStatus::QUEUED,
            TaskRunStatus::RUNNING,
            TaskRunStatus::CANCELLING,
        ],
    )
}

pub(super) fn now_millis_string() -> String {
    now_millis_string_for_records()
}

fn tone_for_task_status(status: &str) -> String {
    match status {
        value
            if value == TaskRunStatus::LEGACY_DONE
                || value == TaskRunStatus::LEGACY_COMPLETED
                || is_task_status_one_of(
                    value,
                    &[
                        TaskRunStatus::SUCCEEDED,
                        TaskRunStatus::SKIPPED,
                        TaskRunStatus::ARCHIVED,
                    ],
                ) =>
        {
            "sage"
        }
        value
            if is_task_status_one_of(
                value,
                &[TaskRunStatus::RUNNING, TaskRunStatus::CANCELLING],
            ) =>
        {
            "indigo"
        }
        value if value == TaskRunStatus::PAUSED => "violet",
        value if value == TaskRunStatus::FAILED => "cinnabar",
        value if value == TaskRunStatus::CANCELLED => "cinnabar",
        _ => "amber",
    }
    .to_string()
}

fn task_label(kind: &str, book_title: &str) -> String {
    if kind == TaskKind::IMPORT_DIRECTORY {
        "目录导入".to_string()
    } else if kind == TaskKind::IMPORT_BOOK {
        format!("导入书籍 · {book_title}")
    } else if kind == TaskKind::PARSE_AND_INDEX {
        format!("解析索引 · {book_title}")
    } else if kind == TaskKind::CHARACTER_EXTRACTION {
        format!("人物识别 · {book_title}")
    } else if kind == "embedding" {
        format!("语义向量 · {book_title}")
    } else if kind == "summary" {
        format!("摘要生成 · {book_title}")
    } else {
        format!("{kind} · {book_title}")
    }
}

fn stage_label(kind: &str, stage: &str) -> String {
    if kind == TaskKind::CHARACTER_EXTRACTION {
        return match stage {
            value if value == TaskStage::READ_FILE => "读取全文索引",
            value if value == TaskStage::BUILD_CHUNKS => "扫描人物",
            value if value == TaskStage::WRITE_CHUNKS => "写入人物索引",
            value if value == TaskStage::VERIFY => "校验人物索引",
            value if value == TaskStage::DONE => "保存人物索引",
            _ => "排队中",
        }
        .to_string();
    }
    match stage {
        value if value == TaskStage::READ_FILE => "读取文件",
        value if value == TaskStage::PARSE_CHAPTERS => "解析章节",
        value if value == TaskStage::BUILD_CHUNKS => "生成 chunks",
        value if value == TaskStage::WRITE_CHUNKS => "写入 chunk store",
        value if value == TaskStage::WRITE_FTS => "写入 FTS",
        value if value == TaskStage::VERIFY => "校验索引",
        value if value == TaskStage::DONE => "保存 metadata",
        _ => "排队中",
    }
    .to_string()
}

pub(crate) fn load_index_manifest(data_dir: &Path) -> Result<Vec<BookIndexManifest>, String> {
    let path = index_manifest_path(data_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取索引 manifest {}: {error}", path.display()))?;
    let mut manifest: Vec<BookIndexManifest> = serde_json::from_str(&raw)
        .map_err(|error| format!("无法解析索引 manifest {}: {error}", path.display()))?;
    let mut changed = false;
    for entry in &mut manifest {
        if let Some(rebased) = rebase_managed_data_path(data_dir, &entry.file_path) {
            entry.file_path = rebased;
            changed = true;
        }
    }
    if changed {
        save_index_manifest(data_dir, &manifest)?;
    }
    Ok(manifest)
}

pub(crate) fn save_index_manifest(
    data_dir: &Path,
    manifest: &[BookIndexManifest],
) -> Result<(), String> {
    let path = index_manifest_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建索引 manifest 目录 {}: {error}", parent.display()))?;
    }
    let raw = serde_json::to_string_pretty(manifest)
        .map_err(|error| format!("无法序列化索引 manifest: {error}"))?;
    let temp_path = unique_atomic_temp_path(&path, "json.tmp");
    fs::write(&temp_path, raw).map_err(|error| {
        format!(
            "无法写入索引 manifest 临时文件 {}: {error}",
            temp_path.display()
        )
    })?;
    fs::rename(&temp_path, &path)
        .map_err(|error| format!("无法替换索引 manifest {}: {error}", path.display()))
}

pub(crate) fn load_vector_index_manifest(
    data_dir: &Path,
) -> Result<Vec<VectorIndexManifestEntry>, String> {
    let path = vector_index_manifest_path(data_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取向量索引 manifest {}: {error}", path.display()))?;
    serde_json::from_str(&raw)
        .map_err(|error| format!("无法解析向量索引 manifest {}: {error}", path.display()))
}

pub(crate) fn save_vector_index_manifest(
    data_dir: &Path,
    manifest: &[VectorIndexManifestEntry],
) -> Result<(), String> {
    let path = vector_index_manifest_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "无法创建向量索引 manifest 目录 {}: {error}",
                parent.display()
            )
        })?;
    }
    let raw = serde_json::to_string_pretty(manifest)
        .map_err(|error| format!("无法序列化向量索引 manifest: {error}"))?;
    let temp_path = unique_atomic_temp_path(&path, "vector.json.tmp");
    fs::write(&temp_path, raw).map_err(|error| {
        format!(
            "无法写入向量索引 manifest 临时文件 {}: {error}",
            temp_path.display()
        )
    })?;
    fs::rename(&temp_path, &path)
        .map_err(|error| format!("无法替换向量索引 manifest {}: {error}", path.display()))
}

fn unique_atomic_temp_path(path: &Path, suffix: &str) -> PathBuf {
    let timestamp = now_millis_string();
    let thread_id = format!("{:?}", std::thread::current().id())
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>();
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("manifest");
    path.with_file_name(format!("{file_name}.{timestamp}.{thread_id}.{suffix}"))
}

pub(crate) fn mark_index_manifests_stale_for_settings_change(
    data_dir: &Path,
    changed_keys: &[&str],
) -> Result<usize, String> {
    if changed_keys.is_empty() {
        return Ok(0);
    }
    let mut manifest = load_index_manifest(data_dir)?;
    let reason = format!("索引策略设置变更：{}", changed_keys.join("、"));
    let mut marked_count = 0usize;
    for entry in &mut manifest {
        if entry.status == "ready" {
            entry.status = "stale".to_string();
            entry.stale_reason = reason.clone();
            marked_count += 1;
        }
    }
    if marked_count > 0 {
        save_index_manifest(data_dir, &manifest)?;
        let settings = load_index_runtime_settings(data_dir);
        if settings.rebuild_strategy == "auto" {
            enqueue_rebuild_tasks_for_stale_manifests(data_dir, &manifest)?;
        }
    }
    Ok(marked_count)
}

fn enqueue_rebuild_tasks_for_stale_manifests(
    data_dir: &Path,
    manifest: &[BookIndexManifest],
) -> Result<usize, String> {
    let records = load_library_records(data_dir)?;
    let live_book_ids: std::collections::HashSet<&str> =
        records.iter().map(|record| record.id.as_str()).collect();
    let mut tasks = load_task_records(data_dir)?;
    let mut active_rebuild_book_ids: std::collections::HashSet<String> = tasks
        .iter()
        .filter(|task| task.kind == TaskKind::REBUILD_INDEX && is_active_task_status(&task.status))
        .map(|task| task.book_id.clone())
        .collect();
    let mut queued = 0usize;
    for entry in manifest
        .iter()
        .filter(|entry| entry.status == "stale" && live_book_ids.contains(entry.book_id.as_str()))
    {
        if active_rebuild_book_ids.contains(&entry.book_id) {
            continue;
        }
        tasks.push(TaskRecord {
            id: format!(
                "task-rebuild-index-{}-{}",
                entry.book_id,
                now_millis_string()
            ),
            book_id: entry.book_id.clone(),
            kind: TaskKind::REBUILD_INDEX.to_string(),
            message: "索引策略设置变更，已自动排队重建索引".to_string(),
            ..TaskRecord::default()
        });
        active_rebuild_book_ids.insert(entry.book_id.clone());
        queued += 1;
    }
    if queued > 0 {
        save_task_records(data_dir, &tasks)?;
    }
    Ok(queued)
}

pub(crate) fn task_statuses_for_ui(data_dir: &Path) -> Result<Vec<TaskStatusPayload>, String> {
    let tasks = load_task_records(data_dir)?;
    let records = load_library_records(data_dir)?;
    let logs = load_task_logs_in(data_dir, None).unwrap_or_default();
    let statuses = tasks
        .into_iter()
        .map(|task| {
            let book = records.iter().find(|record| record.id == task.book_id);
            let log_count = logs.iter().filter(|log| log.task_id == task.id).count();
            task_status_payload_for_record(task, book, log_count)
        })
        .collect();
    Ok(statuses)
}

pub(crate) fn task_status_payload_for_command(
    task: TaskRecord,
    book: Option<&crate::models::BookRecord>,
    log_count: usize,
) -> TaskStatusPayload {
    task_status_payload_for_record(task, book, log_count)
}

pub(super) fn task_status_payload_for_record(
    task: TaskRecord,
    book: Option<&crate::models::BookRecord>,
    log_count: usize,
) -> TaskStatusPayload {
    let book_title = book
        .map(|record| record.display_title.as_str())
        .unwrap_or("未知书籍")
        .to_string();
    let file_name = book
        .map(|record| record.file_name.clone())
        .unwrap_or_default();
    let status = normalized_status(&task.status);
    TaskStatusPayload {
        id: task.id,
        kind: task.kind.clone(),
        name: task_label(&task.kind, &book_title),
        status: status.clone(),
        progress: task.progress.clamp(0.0, 100.0),
        stage: task.stage.clone(),
        stage_label: stage_label(&task.kind, &task.stage),
        tone: tone_for_task_status(&status),
        message: task.message,
        book_id: task.book_id,
        book_title,
        file_name,
        created_at: task.created_at,
        updated_at: task.updated_at,
        started_at: task.started_at,
        finished_at: task.finished_at,
        duration_ms: task.duration_ms,
        attempt: task.attempt,
        max_attempts: task.max_attempts,
        error_code: task.error_code,
        error_message: task.error_message,
        error: task.error,
        dag_id: task.dag_id,
        depends_on: task.depends_on,
        blocked_by: task.blocked_by,
        log_count,
        output_summary: task.output_summary,
    }
}

pub(crate) fn index_diagnostics_for_ui(data_dir: &Path) -> Result<IndexDiagnosticsPayload, String> {
    let runtime_settings = load_index_runtime_settings(data_dir);
    let tasks = load_task_records(data_dir)?;
    let records = load_library_records(data_dir)?;
    prune_orphan_index_outputs(data_dir, &records)?;
    let manifest = load_index_manifest(data_dir)?;
    let vector_manifest = load_vector_index_manifest(data_dir)?;
    let queued_count = tasks
        .iter()
        .filter(|task| {
            task.kind == TaskKind::PARSE_AND_INDEX && task.status == TaskRunStatus::QUEUED
        })
        .count();
    let running_count = tasks
        .iter()
        .filter(|task| {
            is_runnable_task_kind(&task.kind)
                && (task.status == TaskRunStatus::RUNNING
                    || task.status == TaskRunStatus::CANCELLING)
        })
        .count();
    let succeeded_count = tasks
        .iter()
        .filter(|task| {
            task.status == TaskRunStatus::SUCCEEDED || task.status == TaskRunStatus::SKIPPED
        })
        .count();
    let failed_count = tasks
        .iter()
        .filter(|task| task.status == TaskRunStatus::FAILED)
        .count();
    let paused_count = tasks
        .iter()
        .filter(|task| task.status == TaskRunStatus::PAUSED)
        .count();
    let cancelled_count = tasks
        .iter()
        .filter(|task| task.status == TaskRunStatus::CANCELLED)
        .count();
    let recent_errors = collect_recent_index_errors(&tasks, runtime_settings.recent_error_limit);
    let mut recent_error = recent_errors.first().cloned().unwrap_or_default();
    let indexed_book_count = manifest.len();
    let mut manifest_by_book_id: std::collections::BTreeMap<String, BookIndexManifest> = manifest
        .into_iter()
        .map(|entry| (entry.book_id.clone(), entry))
        .collect();
    for record in &records {
        manifest_by_book_id
            .entry(record.id.clone())
            .or_insert_with(|| BookIndexManifest {
                book_id: record.id.clone(),
                book_title: record.display_title.clone(),
                file_path: record.file_path.clone(),
                content_hash: record.content_hash.clone(),
                status: "missing".to_string(),
                stale_reason: "manifest 缺失".to_string(),
                ..BookIndexManifest::default()
            });
    }
    let mut books = Vec::new();
    for (_, mut entry) in manifest_by_book_id {
        let chunk_count = match entry.chunk_count {
            0 => load_book_chunk_records(data_dir, &entry.book_id)?.len(),
            count => count,
        };
        let fts_row_count = match count_book_fts_rows(data_dir, &entry.book_id) {
            Ok(count) => count,
            Err(error) => {
                if recent_error.is_empty() {
                    recent_error = error.clone();
                }
                entry.status = "stale".to_string();
                entry.stale_reason = format!("FTS 校验失败：{error}");
                0
            }
        };
        if let Some(book) = records.iter().find(|record| record.id == entry.book_id) {
            entry.book_title = book.display_title.clone();
            entry.file_path = book.file_path.clone();
            if !entry.content_hash.is_empty() && entry.content_hash != book.content_hash {
                entry.status = "stale".to_string();
                entry.stale_reason = "内容变更".to_string();
            }
        } else if entry.status != "stale" {
            entry.status = "stale".to_string();
            entry.stale_reason = "书籍记录缺失".to_string();
        }
        mark_entry_stale_for_index_version_migration(&mut entry);
        if entry.status == "ready"
            && ((entry.chunk_count > 0 && entry.chunk_count != chunk_count)
                || (entry.fts_row_count > 0 && entry.fts_row_count != fts_row_count)
                || chunk_count != fts_row_count)
        {
            entry.status = "stale".to_string();
            entry.stale_reason = "校验失败：chunks 与 FTS 行数不一致".to_string();
        }
        entry.chunk_count = chunk_count;
        entry.fts_row_count = fts_row_count;
        books.push(entry);
    }
    let fts_path = fts_database_path(data_dir);
    let fts_metadata = fs::metadata(&fts_path).ok();
    let vector_summary =
        summarize_vector_index_manifest(data_dir, &vector_manifest, &records, &books);
    Ok(IndexDiagnosticsPayload {
        summary: IndexDiagnosticsSummaryPayload {
            queued_count,
            running_count,
            succeeded_count,
            failed_count,
            paused_count,
            cancelled_count,
            stale_book_count: books.iter().filter(|book| book.status == "stale").count(),
            indexed_chunk_count: books.iter().map(|book| book.chunk_count).sum(),
            indexed_book_count,
            fts_available: fts_path.exists(),
            fts_database_path: fts_path.display().to_string(),
            fts_database_size_bytes: fts_metadata
                .as_ref()
                .map(|metadata| metadata.len())
                .unwrap_or(0),
            fts_database_modified_at: String::new(),
            recent_error,
            recent_errors,
            sidecar_status: "not-configured".to_string(),
            sidecar_message: "Python sidecar is not configured; SQLite FTS remains active."
                .to_string(),
            vector_index_status: vector_summary.status,
            vector_indexed_book_count: vector_summary.indexed_book_count,
            vector_indexed_chunk_count: vector_summary.indexed_chunk_count,
            vector_provider: vector_summary.provider,
            vector_dimension: vector_summary.dimension,
            vector_last_built_at: vector_summary.last_built_at,
            vector_last_error: vector_summary.last_error,
        },
        books,
    })
}

pub(crate) fn validate_all_indexes_in(data_dir: &Path) -> Result<IndexDiagnosticsPayload, String> {
    index_diagnostics_for_ui(data_dir)
}

#[derive(Clone, Debug, Default)]
struct VectorIndexDiagnosticsSummary {
    status: String,
    indexed_book_count: usize,
    indexed_chunk_count: usize,
    provider: String,
    dimension: usize,
    last_built_at: String,
    last_error: String,
}

fn summarize_vector_index_manifest(
    data_dir: &Path,
    manifest: &[VectorIndexManifestEntry],
    records: &[BookRecord],
    text_indexes: &[BookIndexManifest],
) -> VectorIndexDiagnosticsSummary {
    if manifest.is_empty() {
        return VectorIndexDiagnosticsSummary {
            status: VectorIndexStatus::NOT_BUILT.to_string(),
            ..VectorIndexDiagnosticsSummary::default()
        };
    }

    let current_embedding_model = current_vector_embedding_model(data_dir);
    let runtime_settings = load_index_runtime_settings(data_dir);
    let records_by_book_id: std::collections::BTreeMap<&str, &BookRecord> = records
        .iter()
        .map(|record| (record.id.as_str(), record))
        .collect();
    let text_indexes_by_book_id: std::collections::BTreeMap<&str, &BookIndexManifest> =
        text_indexes
            .iter()
            .map(|entry| (entry.book_id.as_str(), entry))
            .collect();

    let mut summary = VectorIndexDiagnosticsSummary::default();
    let mut ready_book_ids = std::collections::BTreeSet::new();
    let mut stale_reasons = Vec::new();
    let mut has_failed = false;
    let mut has_stale = false;
    let mut has_building = false;

    for entry in manifest {
        match entry.status.as_str() {
            VectorIndexStatus::READY => {
                if let Some(reason) = vector_stale_reason(
                    entry,
                    records_by_book_id.get(entry.book_id.as_str()).copied(),
                    text_indexes_by_book_id.get(entry.book_id.as_str()).copied(),
                    runtime_settings.chunking.strategy_version,
                    &current_embedding_model,
                ) {
                    has_stale = true;
                    stale_reasons.push(reason);
                    remember_vector_manifest_metadata(&mut summary, entry);
                    continue;
                }
                ready_book_ids.insert(entry.book_id.as_str());
                summary.indexed_chunk_count += entry.chunk_count;
                remember_vector_manifest_metadata(&mut summary, entry);
            }
            VectorIndexStatus::FAILED => {
                has_failed = true;
                remember_vector_manifest_metadata(&mut summary, entry);
                if summary.last_error.is_empty() {
                    summary.last_error = safe_vector_diagnostic_message(&entry.last_error);
                }
            }
            VectorIndexStatus::STALE => {
                has_stale = true;
                remember_vector_manifest_metadata(&mut summary, entry);
                if !entry.last_error.trim().is_empty() {
                    stale_reasons.push(safe_vector_diagnostic_message(&entry.last_error));
                }
            }
            VectorIndexStatus::BUILDING => {
                has_building = true;
                remember_vector_manifest_metadata(&mut summary, entry);
            }
            _ => {
                has_stale = true;
                remember_vector_manifest_metadata(&mut summary, entry);
                stale_reasons.push("vector manifest status is not ready".to_string());
            }
        }
    }

    summary.indexed_book_count = ready_book_ids.len();
    summary.status = if has_failed {
        VectorIndexStatus::FAILED.to_string()
    } else if has_stale {
        VectorIndexStatus::STALE.to_string()
    } else if has_building {
        VectorIndexStatus::BUILDING.to_string()
    } else if summary.indexed_book_count > 0 {
        VectorIndexStatus::READY.to_string()
    } else {
        VectorIndexStatus::NOT_BUILT.to_string()
    };
    if summary.last_error.is_empty() && !stale_reasons.is_empty() {
        summary.last_error = stale_reasons.join("; ");
    }
    summary
}

fn vector_stale_reason(
    entry: &VectorIndexManifestEntry,
    record: Option<&BookRecord>,
    text_index: Option<&BookIndexManifest>,
    current_chunk_strategy_version: u32,
    current_embedding_model: &str,
) -> Option<String> {
    let Some(record) = record else {
        return Some(format!(
            "book {} vector index stale: book record missing",
            entry.book_id
        ));
    };
    if !entry.content_hash.is_empty() && entry.content_hash != record.content_hash {
        return Some(format!(
            "book {} vector index stale: content hash changed",
            entry.book_id
        ));
    }
    let Some(text_index) = text_index else {
        return Some(format!(
            "book {} vector index stale: text index manifest missing",
            entry.book_id
        ));
    };
    if entry.chunk_strategy_version != text_index.chunk_strategy_version
        || entry.chunk_strategy_version != current_chunk_strategy_version
    {
        return Some(format!(
            "book {} vector index stale: chunk strategy changed",
            entry.book_id
        ));
    }
    if entry.embedding_model.trim() != current_embedding_model {
        return Some(format!(
            "book {} vector index stale: embedding model changed",
            entry.book_id
        ));
    }
    None
}

fn current_vector_embedding_model(data_dir: &Path) -> String {
    let Ok(settings) = load_settings_v2(data_dir) else {
        return "unconfigured".to_string();
    };
    settings
        .extended
        .get("vectorEmbeddingModel")
        .or_else(|| settings.extended.get("sidecarEmbeddingModel"))
        .or_else(|| settings.extended.get("embeddingModel"))
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("unconfigured")
        .to_string()
}

fn remember_vector_manifest_metadata(
    summary: &mut VectorIndexDiagnosticsSummary,
    entry: &VectorIndexManifestEntry,
) {
    if summary.provider.is_empty() && !entry.embedding_model.trim().is_empty() {
        summary.provider = entry.embedding_model.trim().to_string();
    }
    if summary.dimension == 0 {
        summary.dimension = entry.dimension;
    }
    if entry.built_at > summary.last_built_at {
        summary.last_built_at = entry.built_at.clone();
    }
}

fn safe_vector_diagnostic_message(message: &str) -> String {
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.contains("\\\\")
        || trimmed.contains('\\')
        || trimmed.contains('/')
        || trimmed.contains("C:")
        || trimmed.contains("D:")
        || trimmed.contains("E:")
        || trimmed.to_ascii_lowercase().contains("prompt")
        || trimmed.to_ascii_lowercase().contains("embedding")
    {
        return "vector manifest error".to_string();
    }
    trimmed.chars().take(240).collect()
}

fn mark_entry_stale_for_index_version_migration(entry: &mut BookIndexManifest) {
    let mut reasons = Vec::new();
    if entry.index_version != 0 && entry.index_version < CURRENT_INDEX_VERSION {
        reasons.push(format!(
            "索引版本 v{} -> v{}",
            entry.index_version, CURRENT_INDEX_VERSION
        ));
    }
    if entry.chunk_strategy_version != CURRENT_CHUNK_STRATEGY_VERSION {
        reasons.push(format!(
            "chunk 策略 v{} -> v{}",
            entry.chunk_strategy_version, CURRENT_CHUNK_STRATEGY_VERSION
        ));
    }
    if entry.chapter_rule_version != CURRENT_CHAPTER_RULE_VERSION {
        reasons.push(format!(
            "章节规则 v{} -> v{}",
            entry.chapter_rule_version, CURRENT_CHAPTER_RULE_VERSION
        ));
    }
    if entry.fts_schema_version != CURRENT_FTS_SCHEMA_VERSION {
        reasons.push(format!(
            "FTS schema v{} -> v{}",
            entry.fts_schema_version, CURRENT_FTS_SCHEMA_VERSION
        ));
    }
    if reasons.is_empty() {
        return;
    }
    if entry.status == "ready" || entry.stale_reason.is_empty() {
        entry.status = "stale".to_string();
        entry.stale_reason = format!("索引版本迁移：{}", reasons.join("；"));
    }
}

fn update_task_status_in(
    data_dir: &Path,
    task_id: &str,
    status: &str,
    progress: Option<u8>,
    message: &str,
) -> Result<TaskRecord, String> {
    let mut tasks = load_task_records(data_dir)?;
    let Some(task) = tasks.iter_mut().find(|task| task.id == task_id) else {
        return Err(format!("找不到任务 {task_id}"));
    };
    task.status = status.to_string();
    task.status = normalized_status(&task.status);
    if let Some(progress) = progress {
        task.progress = f64::from(progress.min(100));
    }
    task.updated_at = now_millis_string();
    task.stage = if task.status == TaskRunStatus::SUCCEEDED {
        TaskStage::DONE.to_string()
    } else {
        task.stage.clone()
    };
    task.message = message.to_string();
    let updated = task.clone();
    save_task_records(data_dir, &tasks)?;
    Ok(updated)
}

pub(crate) fn pause_task_in(data_dir: &Path, task_id: &str) -> Result<TaskRecord, String> {
    let mut tasks = load_task_records(data_dir)?;
    let Some(task) = tasks.iter_mut().find(|task| task.id == task_id) else {
        return Err(format!("找不到任务 {task_id}"));
    };
    let was_running = task.status == TaskRunStatus::RUNNING;
    task.status = TaskRunStatus::PAUSED.to_string();
    task.message = if was_running {
        "当前阶段完成后暂停".to_string()
    } else {
        "任务已暂停，等待继续执行".to_string()
    };
    task.updated_at = now_millis_string();
    let updated = task.clone();
    save_task_records(data_dir, &tasks)?;
    Ok(updated)
}

pub(crate) fn cancel_task_in(data_dir: &Path, task_id: &str) -> Result<TaskRecord, String> {
    let mut tasks = load_task_records(data_dir)?;
    let Some(task) = tasks.iter_mut().find(|task| task.id == task_id) else {
        return Err(format!("找不到任务 {task_id}"));
    };
    if task.status == TaskRunStatus::RUNNING {
        task.status = TaskRunStatus::CANCELLING.to_string();
        task.message = "将在当前阶段完成后取消".to_string();
    } else {
        task.status = TaskRunStatus::CANCELLED.to_string();
        task.stage = TaskStage::DONE.to_string();
        task.progress = 0.0;
        task.error_code = TaskErrorCode::CANCELLED_BY_USER.to_string();
        task.error_message = "用户取消任务".to_string();
        task.error = TaskError::new(
            TaskErrorCode::CANCELLED_BY_USER,
            task.error_message.clone(),
            TaskStage::DONE,
            false,
            serde_json::json!({ "bookId": task.book_id.clone(), "taskId": task.id.clone() }),
        );
        task.message = "任务已取消".to_string();
    }
    task.updated_at = now_millis_string();
    let updated = task.clone();
    save_task_records(data_dir, &tasks)?;
    Ok(updated)
}

pub(crate) fn retry_task_in(data_dir: &Path, task_id: &str) -> Result<TaskRecord, String> {
    let mut tasks = load_task_records(data_dir)?;
    let Some(task) = tasks.iter_mut().find(|task| task.id == task_id) else {
        return Err(format!("找不到任务 {task_id}"));
    };
    let was_paused = task.status == TaskRunStatus::PAUSED;
    if !was_paused && task.attempt >= task.max_attempts {
        return Err("任务已超过最大重试次数，请手动强制重试".to_string());
    }
    task.status = TaskRunStatus::QUEUED.to_string();
    task.stage = TaskStage::QUEUED.to_string();
    task.progress = 0.0;
    if !was_paused {
        task.attempt = task.attempt.saturating_add(1);
    }
    task.error_code.clear();
    task.error_message.clear();
    task.error = TaskError::empty();
    task.updated_at = now_millis_string();
    task.message = if was_paused {
        "任务已继续执行".to_string()
    } else {
        "任务已重新排队".to_string()
    };
    let updated = task.clone();
    append_task_log(data_dir, &updated, "info", &updated.message)?;
    save_task_records(data_dir, &tasks)?;
    Ok(updated)
}

pub(crate) fn cancel_queued_tasks_in(data_dir: &Path) -> Result<Vec<TaskRecord>, String> {
    let mut tasks = load_task_records(data_dir)?;
    let mut updated = Vec::new();
    let now = now_millis_string();
    for task in tasks
        .iter_mut()
        .filter(|task| task.status == TaskRunStatus::QUEUED && task.attempt == 0)
    {
        task.status = TaskRunStatus::CANCELLED.to_string();
        task.stage = TaskStage::DONE.to_string();
        task.progress = 0.0;
        task.error_code = TaskErrorCode::CANCELLED_BY_USER.to_string();
        task.error_message = "用户取消任务".to_string();
        task.error = TaskError::new(
            TaskErrorCode::CANCELLED_BY_USER,
            task.error_message.clone(),
            TaskStage::DONE,
            false,
            serde_json::json!({ "bookId": task.book_id.clone(), "taskId": task.id.clone() }),
        );
        task.message = "任务已取消".to_string();
        task.updated_at = now.clone();
        updated.push(task.clone());
    }
    save_task_records(data_dir, &tasks)?;
    Ok(updated)
}

pub(crate) fn pause_queued_tasks_in(data_dir: &Path) -> Result<Vec<TaskRecord>, String> {
    let mut tasks = load_task_records(data_dir)?;
    let mut updated = Vec::new();
    let now = now_millis_string();
    for task in tasks
        .iter_mut()
        .filter(|task| task.status == TaskRunStatus::QUEUED)
    {
        task.status = TaskRunStatus::PAUSED.to_string();
        task.message = "任务已暂停，等待继续执行".to_string();
        task.updated_at = now.clone();
        updated.push(task.clone());
    }
    save_task_records(data_dir, &tasks)?;
    Ok(updated)
}

pub(crate) fn retry_failed_tasks_in(data_dir: &Path) -> Result<Vec<TaskRecord>, String> {
    let mut tasks = load_task_records(data_dir)?;
    let mut updated = Vec::new();
    let now = now_millis_string();
    for task in tasks
        .iter_mut()
        .filter(|task| task.status == TaskRunStatus::FAILED && task.attempt < task.max_attempts)
    {
        task.status = TaskRunStatus::QUEUED.to_string();
        task.stage = TaskStage::QUEUED.to_string();
        task.progress = 0.0;
        task.attempt = task.attempt.saturating_add(1);
        task.error_code.clear();
        task.error_message.clear();
        task.error = TaskError::empty();
        task.updated_at = now.clone();
        task.message = "任务已重新排队".to_string();
        updated.push(task.clone());
    }
    save_task_records(data_dir, &tasks)?;
    for task in &updated {
        append_task_log(data_dir, task, "info", "任务已重新排队")?;
    }
    Ok(updated)
}

pub(crate) fn archive_task_in(data_dir: &Path, task_id: &str) -> Result<TaskRecord, String> {
    update_task_status_in(
        data_dir,
        task_id,
        TaskRunStatus::ARCHIVED,
        None,
        "任务已归档",
    )
}

pub(crate) fn restore_archived_task_in(
    data_dir: &Path,
    task_id: &str,
) -> Result<TaskRecord, String> {
    let mut tasks = load_task_records(data_dir)?;
    let Some(task) = tasks.iter_mut().find(|task| task.id == task_id) else {
        return Err(format!("找不到任务 {task_id}"));
    };
    if task.status != TaskRunStatus::ARCHIVED {
        return Err("只有已归档任务可以恢复".to_string());
    }
    if !is_restorable_archived_task_kind(&task.kind) {
        return Err("此类归档任务没有可恢复的后台执行器".to_string());
    }
    task.status = TaskRunStatus::QUEUED.to_string();
    task.stage = TaskStage::QUEUED.to_string();
    task.progress = 0.0;
    task.finished_at.clear();
    task.error_code.clear();
    task.error_message.clear();
    task.error = TaskError::empty();
    task.updated_at = now_millis_string();
    task.message = "任务已恢复到队列".to_string();
    update_dag_blockers(&mut tasks);
    let updated = tasks
        .iter()
        .find(|task| task.id == task_id)
        .cloned()
        .expect("restored task should still exist");
    append_task_log(data_dir, &updated, "info", &updated.message)?;
    save_task_records(data_dir, &tasks)?;
    Ok(updated)
}

pub(crate) fn clear_completed_tasks_in(data_dir: &Path) -> Result<Vec<TaskRecord>, String> {
    let mut tasks = load_task_records(data_dir)?;
    tasks.retain(|task| !is_completed_task_status(&task.status));
    save_task_records(data_dir, &tasks)?;
    Ok(tasks)
}

pub(crate) fn apply_task_retention_in(
    data_dir: &Path,
    completed_limit: usize,
) -> Result<usize, String> {
    let tasks = load_task_records(data_dir)?;
    if tasks.is_empty() {
        return Ok(0);
    }
    let mut completed_tasks: Vec<(usize, u128)> = tasks
        .iter()
        .enumerate()
        .filter(|(_, task)| is_completed_task_status(&task.status))
        .map(|(index, task)| (index, task_retention_sort_time(task)))
        .collect();
    if completed_tasks.len() <= completed_limit {
        return Ok(0);
    }
    completed_tasks.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| right.0.cmp(&left.0)));
    let keep_completed_indexes: std::collections::HashSet<usize> = completed_tasks
        .iter()
        .take(completed_limit)
        .map(|(index, _)| *index)
        .collect();
    let mut removed = 0usize;
    let retained: Vec<TaskRecord> = tasks
        .into_iter()
        .enumerate()
        .filter_map(|(index, task)| {
            if is_completed_task_status(&task.status) && !keep_completed_indexes.contains(&index) {
                removed += 1;
                None
            } else {
                Some(task)
            }
        })
        .collect();
    save_task_records(data_dir, &retained)?;
    Ok(removed)
}

fn task_retention_sort_time(task: &TaskRecord) -> u128 {
    task.finished_at
        .parse::<u128>()
        .or_else(|_| task.updated_at.parse::<u128>())
        .or_else(|_| task.created_at.parse::<u128>())
        .unwrap_or_default()
}

pub(crate) fn rebuild_book_index_in(data_dir: &Path, book_id: &str) -> Result<TaskRecord, String> {
    let records = load_library_records(data_dir)?;
    if !records.iter().any(|record| record.id == book_id) {
        return Err(format!("找不到书籍 {book_id}"));
    }
    let mut tasks = load_task_records(data_dir)?;
    if let Some(existing) = tasks.iter().find(|task| {
        task.book_id == book_id
            && task.kind == TaskKind::REBUILD_INDEX
            && is_active_task_status(&task.status)
    }) {
        return Ok(existing.clone());
    }
    let task = TaskRecord {
        id: format!("task-rebuild-index-{book_id}-{}", now_millis_string()),
        book_id: book_id.to_string(),
        kind: TaskKind::REBUILD_INDEX.to_string(),
        message: "已排队重建索引，将删除旧 chunks 后重新写入".to_string(),
        ..TaskRecord::default()
    };
    tasks.push(task.clone());
    save_task_records(data_dir, &tasks)?;
    Ok(task)
}

pub(crate) fn delete_book_index_in(data_dir: &Path, book_id: &str) -> Result<(), String> {
    delete_book_chunk_records(data_dir, book_id)?;
    delete_book_fts_rows(data_dir, book_id)?;
    let mut manifest = load_index_manifest(data_dir)?;
    manifest.retain(|entry| entry.book_id != book_id);
    save_index_manifest(data_dir, &manifest)
}

pub(crate) fn repair_book_fts_in(
    data_dir: &Path,
    book_id: &str,
) -> Result<IndexDiagnosticsPayload, String> {
    let chunks = load_book_chunk_records(data_dir, book_id)?;
    let repaired_count = rewrite_book_fts_rows(data_dir, book_id, &chunks)?;
    if repaired_count == 0 {
        return Err("找不到可用于修复 FTS 的 chunks".to_string());
    }
    index_diagnostics_for_ui(data_dir)
}

fn prune_orphan_index_outputs(
    data_dir: &Path,
    records: &[crate::models::BookRecord],
) -> Result<(), String> {
    let mut manifest = load_index_manifest(data_dir)?;
    prune_orphan_index_outputs_from_state(records, &mut manifest)?;
    save_index_manifest(data_dir, &manifest)
}

pub(super) fn prune_orphan_index_outputs_from_state(
    records: &[crate::models::BookRecord],
    manifest: &mut Vec<BookIndexManifest>,
) -> Result<(), String> {
    let active_book_ids: std::collections::HashSet<&str> =
        records.iter().map(|record| record.id.as_str()).collect();
    manifest.retain(|entry| active_book_ids.contains(entry.book_id.as_str()));
    Ok(())
}
