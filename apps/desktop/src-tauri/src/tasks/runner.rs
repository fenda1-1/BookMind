use crate::characters::{extract_character_index_with_progress_in, mark_character_index_failed_in};
use crate::database::FtsChunkWriter;
use crate::library::{load_library_records, BookLineStream};
use crate::models::{
    BookIndexManifest, TaskError, TaskErrorCode, TaskKind, TaskOutputSummaryRecord, TaskRecord,
    TaskRunStatus, TaskStage, TaskStageDurationsRecord,
};
use crate::search::{
    split_text_into_chunks_with_line_provider_cancel_and_visit, IndexChunkingOptions,
};
use crate::settings::load_settings_v2;
use std::{
    cell::Cell,
    fs,
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc,
    },
    thread,
    time::{Duration, Instant},
};

use super::{
    append_task_log, complete_ready_placeholder_dag_tasks, complete_task,
    complete_task_with_message, emit_task_progress, fail_task, is_index_task_kind,
    is_runnable_task_kind, load_index_manifest, load_task_records, mark_task_stage,
    now_millis_string, save_index_manifest, save_task_records, stream_task_progress_snapshot,
    IndexRuntimeSettings, TaskProgressEventSink, CURRENT_CHAPTER_RULE_VERSION,
    CURRENT_CHUNK_STRATEGY_VERSION, CURRENT_FTS_SCHEMA_VERSION, CURRENT_INDEX_VERSION,
};

const TASK_BATCH_COOLDOWN_MS: u64 = 25;
static TASK_RUNNER_ACTIVE: AtomicBool = AtomicBool::new(false);

pub(crate) struct TaskRunnerGuard;

pub(crate) fn try_acquire_task_runner() -> Option<TaskRunnerGuard> {
    TASK_RUNNER_ACTIVE
        .compare_exchange(false, true, Ordering::Acquire, Ordering::Relaxed)
        .ok()
        .map(|_| TaskRunnerGuard)
}

impl Drop for TaskRunnerGuard {
    fn drop(&mut self) {
        TASK_RUNNER_ACTIVE.store(false, Ordering::Release);
    }
}

fn recover_stale_running_tasks(data_dir: &Path, tasks: &mut [TaskRecord]) -> Result<(), String> {
    for task in tasks.iter_mut().filter(|task| {
        (task.kind == TaskKind::PARSE_AND_INDEX || task.kind == TaskKind::CHARACTER_EXTRACTION)
            && task.status == TaskRunStatus::RUNNING
    }) {
        task.status = TaskRunStatus::QUEUED.to_string();
        task.stage = TaskStage::QUEUED.to_string();
        task.progress = 0.0;
        task.error_code.clear();
        task.error_message.clear();
        task.error = TaskError::empty();
        task.message = "上次运行中断，已恢复排队继续执行".to_string();
        task.updated_at = now_millis_string();
        append_task_log(
            data_dir,
            task,
            "warn",
            "上次运行中断，任务已恢复排队继续执行",
        )?;
    }
    Ok(())
}

fn cancel_task_at_boundary(data_dir: &Path, task: &mut TaskRecord) -> Result<bool, String> {
    if task.status != TaskRunStatus::CANCELLING {
        return Ok(false);
    }
    task.status = TaskRunStatus::CANCELLED.to_string();
    task.stage = TaskStage::DONE.to_string();
    task.error_code = TaskErrorCode::CANCELLED_BY_USER.to_string();
    task.error_message = "用户取消任务".to_string();
    task.error = TaskError::new(
        TaskErrorCode::CANCELLED_BY_USER,
        task.error_message.clone(),
        TaskStage::DONE,
        false,
        serde_json::json!({ "bookId": task.book_id.clone(), "taskId": task.id.clone() }),
    );
    task.message = "任务已在阶段边界取消".to_string();
    task.updated_at = now_millis_string();
    append_task_log(data_dir, task, "info", "任务已在阶段边界取消")?;
    Ok(true)
}

fn sync_task_cancellation_from_disk(data_dir: &Path, task: &mut TaskRecord) -> Result<(), String> {
    if task.status != TaskRunStatus::RUNNING && task.status != TaskRunStatus::CANCELLING {
        return Ok(());
    }
    let latest_tasks = load_task_records(data_dir)?;
    let Some(latest_task) = latest_tasks.iter().find(|latest| latest.id == task.id) else {
        return Ok(());
    };
    if latest_task.status == TaskRunStatus::CANCELLING
        || latest_task.status == TaskRunStatus::CANCELLED
    {
        task.status = TaskRunStatus::CANCELLING.to_string();
    }
    Ok(())
}

fn cancel_task_at_boundary_from_disk(
    data_dir: &Path,
    task: &mut TaskRecord,
) -> Result<bool, String> {
    sync_task_cancellation_from_disk(data_dir, task)?;
    cancel_task_at_boundary(data_dir, task)
}

fn pause_task_at_boundary_from_disk(
    data_dir: &Path,
    task: &mut TaskRecord,
) -> Result<bool, String> {
    if task.status == TaskRunStatus::PAUSED {
        task.message = "任务已暂停，等待继续执行".to_string();
        task.updated_at = now_millis_string();
        append_task_log(data_dir, task, "info", "任务已暂停，等待继续执行")?;
        return Ok(true);
    }
    let latest_tasks = load_task_records(data_dir)?;
    let Some(latest_task) = latest_tasks.iter().find(|latest| latest.id == task.id) else {
        return Ok(false);
    };
    if latest_task.status != TaskRunStatus::PAUSED {
        return Ok(false);
    }
    task.status = TaskRunStatus::PAUSED.to_string();
    task.message = "任务已暂停，等待继续执行".to_string();
    task.updated_at = now_millis_string();
    append_task_log(data_dir, task, "info", "任务已暂停，等待继续执行")?;
    Ok(true)
}

fn task_cancel_requested(data_dir: &Path, task_id: &str) -> bool {
    load_task_records(data_dir)
        .map(|tasks| {
            tasks.iter().any(|task| {
                task.id == task_id
                    && (task.status == TaskRunStatus::CANCELLING
                        || task.status == TaskRunStatus::CANCELLED)
            })
        })
        .unwrap_or(false)
}

fn task_pause_requested(data_dir: &Path, task_id: &str) -> bool {
    load_task_records(data_dir)
        .map(|tasks| {
            tasks
                .iter()
                .any(|task| task.id == task_id && task.status == TaskRunStatus::PAUSED)
        })
        .unwrap_or(false)
}

fn task_stop_requested(data_dir: &Path, task_id: &str) -> bool {
    load_task_records(data_dir)
        .map(|tasks| {
            tasks.iter().any(|task| {
                task.id == task_id
                    && (task.status == TaskRunStatus::CANCELLING
                        || task.status == TaskRunStatus::CANCELLED
                        || task.status == TaskRunStatus::PAUSED)
            })
        })
        .unwrap_or(false)
}

fn index_build_stop_failure(data_dir: &Path, task_id: &str) -> IndexBuildFailure {
    if task_pause_requested(data_dir, task_id) {
        paused_index_build_failure()
    } else {
        cancelled_index_build_failure()
    }
}

#[derive(Default)]
struct IndexTimingMetrics {
    read_file_ms: u64,
    parse_chapters_ms: u64,
    build_chunks_ms: u64,
    write_chunks_ms: u64,
    write_fts_ms: u64,
    verify_ms: u64,
}

impl IndexTimingMetrics {
    fn record_read_file(&mut self, started_at: Instant) {
        self.read_file_ms = elapsed_millis_floor_one(started_at);
    }

    fn record_parse_chapters(&mut self, started_at: Instant) {
        self.parse_chapters_ms = elapsed_millis_floor_one(started_at);
    }

    fn record_build_chunks(&mut self, started_at: Instant) {
        self.build_chunks_ms = elapsed_millis_floor_one(started_at);
    }

    fn record_write_chunks(&mut self, started_at: Instant) {
        self.write_chunks_ms = elapsed_millis_floor_one(started_at);
    }

    fn record_write_fts(&mut self, started_at: Instant) {
        self.write_fts_ms = elapsed_millis_floor_one(started_at);
    }

    fn record_verify(&mut self, started_at: Instant) {
        self.verify_ms = elapsed_millis_floor_one(started_at);
    }

    fn total_ms(&self) -> u64 {
        self.read_file_ms
            + self.parse_chapters_ms
            + self.build_chunks_ms
            + self.write_chunks_ms
            + self.write_fts_ms
            + self.verify_ms
    }

    fn stage_durations(&self) -> TaskStageDurationsRecord {
        TaskStageDurationsRecord {
            read_file: self.read_file_ms,
            parse_chapters: self.parse_chapters_ms,
            build_chunks: self.build_chunks_ms,
            write_chunks: self.write_chunks_ms,
            write_fts: self.write_fts_ms,
            verify: self.verify_ms,
        }
    }
}

fn record_character_stage_timing(
    timings: &mut IndexTimingMetrics,
    stage: &str,
    started_at: Instant,
) {
    match stage {
        value if value == TaskStage::READ_FILE => timings.record_read_file(started_at),
        value if value == TaskStage::BUILD_CHUNKS => timings.record_build_chunks(started_at),
        value if value == TaskStage::WRITE_CHUNKS => timings.record_write_chunks(started_at),
        value if value == TaskStage::VERIFY => timings.record_verify(started_at),
        _ => {}
    }
}

fn elapsed_millis_floor_one(started_at: Instant) -> u64 {
    started_at.elapsed().as_millis().max(1) as u64
}

struct BuiltIndexOutput {
    book: crate::models::BookRecord,
    chunk_count: usize,
    first_chunk_preview: String,
    fts_writer: FtsChunkWriter,
    chapter_count: usize,
    paragraph_count: usize,
    bytes_read: usize,
    timings: IndexTimingMetrics,
    build_chunks_diagnostics: BuildChunksDiagnostics,
}

#[derive(Clone, Debug, Default)]
struct BuildChunksDiagnostics {
    split_elapsed_ms: u128,
    stop_check_count: usize,
    stop_check_elapsed_ms: u128,
    progress_callback_count: usize,
    progress_callback_elapsed_ms: u128,
}

impl BuildChunksDiagnostics {
    fn summary(&self) -> String {
        format!(
            "buildChunksDiagnostics splitMs={} stopChecks={} stopCheckMs={} progressCallbacks={} progressCallbackMs={}",
            self.split_elapsed_ms,
            self.stop_check_count,
            self.stop_check_elapsed_ms,
            self.progress_callback_count,
            self.progress_callback_elapsed_ms
        )
    }
}

struct IndexBuildFailure {
    code: &'static str,
    error: String,
    message: &'static str,
}

enum IndexWorkerMessage {
    Stage {
        task_id: String,
        stage: &'static str,
        progress: f64,
        message: &'static str,
    },
    Progress {
        task_id: String,
        stage: &'static str,
        progress: f64,
        message: &'static str,
        output_summary: TaskOutputSummaryRecord,
    },
    Built {
        task_id: String,
        output: BuiltIndexOutput,
    },
    Failed {
        task_id: String,
        failure: IndexBuildFailure,
    },
    Paused {
        task_id: String,
    },
}

pub(super) fn load_index_runtime_settings(data_dir: &Path) -> IndexRuntimeSettings {
    let Ok(settings) = load_settings_v2(data_dir) else {
        return IndexRuntimeSettings::default();
    };
    let global_limit =
        json_string_or_number_to_usize(settings.extended.get("taskConcurrency"), 1).clamp(1, 8);
    let parse_limit =
        json_string_or_number_to_usize(settings.extended.get("parseConcurrency"), 1).clamp(1, 8);
    let vector_reserved =
        json_string_or_number_to_usize(settings.extended.get("vectorConcurrencyReserved"), 0)
            .min(global_limit);
    let available_for_cpu = global_limit.saturating_sub(vector_reserved).max(1);
    let chunk_size = json_string_or_number_to_usize(settings.extended.get("indexChunkSize"), 1200)
        .clamp(200, 5000);
    let chunk_overlap =
        json_string_or_number_to_usize(settings.extended.get("indexChunkOverlap"), 120)
            .min(1000)
            .min(chunk_size.saturating_sub(1));
    let strategy_version =
        index_chunk_strategy_version_from_setting(settings.extended.get("indexStrategyVersion"));
    let rebuild_strategy =
        index_rebuild_strategy_from_setting(settings.extended.get("indexRebuildStrategy"));
    let recent_error_limit =
        json_string_or_number_to_usize(settings.extended.get("indexRecentErrorLimit"), 5).min(50);

    IndexRuntimeSettings {
        concurrency_limit: parse_limit.min(available_for_cpu).max(1),
        chunking: IndexChunkingOptions::new(chunk_size, chunk_overlap, strategy_version),
        rebuild_strategy,
        recent_error_limit,
    }
}

fn json_string_or_number_to_usize(value: Option<&serde_json::Value>, fallback: usize) -> usize {
    match value {
        Some(serde_json::Value::String(raw)) => raw.trim().parse::<usize>().unwrap_or(fallback),
        Some(serde_json::Value::Number(number)) => number
            .as_u64()
            .and_then(|value| usize::try_from(value).ok())
            .unwrap_or(fallback),
        _ => fallback,
    }
}

fn index_chunk_strategy_version_from_setting(value: Option<&serde_json::Value>) -> u32 {
    match value.and_then(|value| value.as_str()) {
        Some("latest") => CURRENT_CHUNK_STRATEGY_VERSION + 1,
        Some("compat") => CURRENT_CHUNK_STRATEGY_VERSION.saturating_sub(1).max(1),
        _ => CURRENT_CHUNK_STRATEGY_VERSION,
    }
}

fn index_rebuild_strategy_from_setting(value: Option<&serde_json::Value>) -> String {
    match value.and_then(|value| value.as_str()) {
        Some("manual") => "manual",
        Some("auto") => "auto",
        _ => "prompt",
    }
    .to_string()
}

fn select_runnable_index_task_ids(tasks: &[TaskRecord], limit: usize) -> Vec<String> {
    let mut selected = Vec::new();
    let mut selected_book_ids = std::collections::HashSet::new();
    let running_book_ids: std::collections::HashSet<&str> = tasks
        .iter()
        .filter(|task| {
            is_index_task_kind(&task.kind)
                && (task.status == TaskRunStatus::RUNNING
                    || task.status == TaskRunStatus::CANCELLING)
        })
        .map(|task| task.book_id.as_str())
        .collect();
    for task in tasks {
        if selected.len() >= limit.max(1) {
            break;
        }
        if !is_runnable_task_kind(&task.kind)
            || task.status != TaskRunStatus::QUEUED
            || !task.blocked_by.is_empty()
            || task.book_id.is_empty()
            || running_book_ids.contains(task.book_id.as_str())
            || !selected_book_ids.insert(task.book_id.clone())
        {
            continue;
        }
        selected.push(task.id.clone());
    }
    selected
}

fn build_index_output_for_task(
    records: &[crate::models::BookRecord],
    task: &TaskRecord,
    data_dir: &Path,
    settings: &IndexRuntimeSettings,
    sender: &mpsc::Sender<IndexWorkerMessage>,
) -> Result<BuiltIndexOutput, IndexBuildFailure> {
    let Some(book) = records.iter().find(|record| record.id == task.book_id) else {
        return Err(IndexBuildFailure {
            code: TaskErrorCode::BOOK_MISSING,
            error: "找不到对应书籍记录".to_string(),
            message: "找不到对应书籍记录",
        });
    };
    send_worker_stage(sender, &task.id, TaskStage::READ_FILE, 10.0, "开始读取文件")?;
    if task_cancel_requested(data_dir, &task.id) {
        return Err(cancelled_index_build_failure());
    }
    let mut timings = IndexTimingMetrics::default();
    let read_started_at = Instant::now();
    let metadata = fs::metadata(&book.file_path).map_err(|error| {
        let code = if Path::new(&book.file_path).exists() {
            TaskErrorCode::FILE_READ_FAILED
        } else {
            TaskErrorCode::FILE_MISSING
        };
        IndexBuildFailure {
            code,
            error: format!("无法读取书籍 {}: {error}", book.file_path),
            message: "读取文件失败",
        }
    })?;
    timings.record_read_file(read_started_at);
    send_worker_stage(
        sender,
        &task.id,
        TaskStage::PARSE_CHAPTERS,
        25.0,
        "解析章节",
    )?;
    if task_cancel_requested(data_dir, &task.id) {
        return Err(cancelled_index_build_failure());
    }
    let parse_started_at = Instant::now();
    timings.record_parse_chapters(parse_started_at);
    let build_started_at = Instant::now();
    let task_id = task.id.clone();
    let task_id_for_progress = task.id.clone();
    let data_dir = data_dir.to_path_buf();
    let chunking = settings.chunking;
    let progress_sender = sender.clone();
    let stop_check_count = Cell::new(0usize);
    let stop_check_elapsed_ms = Cell::new(0u128);
    let progress_callback_count = Cell::new(0usize);
    let progress_callback_elapsed_ms = Cell::new(0u128);
    let chapter_count = Cell::new(0usize);
    let paragraph_count = Cell::new(0usize);
    let mut line_reader =
        BookLineStream::new(Path::new(&book.file_path), "auto").map_err(|error| {
            let code = if Path::new(&book.file_path).exists() {
                TaskErrorCode::FILE_READ_FAILED
            } else {
                TaskErrorCode::FILE_MISSING
            };
            IndexBuildFailure {
                code,
                error,
                message: "读取文件失败",
            }
        })?;
    let total_units = metadata.len().max(1) as usize;
    let fts_writer =
        FtsChunkWriter::new(&data_dir, &book.id, 1).map_err(|error| IndexBuildFailure {
            code: TaskErrorCode::FTS_WRITE_FAILED,
            error,
            message: "初始化 FTS 写入器失败",
        })?;
    let mut fts_writer = fts_writer;
    send_worker_stage(
        sender,
        &task.id,
        TaskStage::BUILD_CHUNKS,
        45.0,
        "生成 chunks",
    )?;
    if task_cancel_requested(&data_dir, &task.id) {
        return Err(cancelled_index_build_failure());
    }
    let split_started_at = Instant::now();
    let mut chunk_count = 0usize;
    let mut first_chunk_preview = String::new();
    let mut noop_progress = |_written_rows: usize, _total_rows: usize| {};
    split_text_into_chunks_with_line_provider_cancel_and_visit(
        book,
        chunking,
        || {
            stop_check_count.set(stop_check_count.get().saturating_add(1));
            let stop_check_started_at = Instant::now();
            let requested = task_stop_requested(&data_dir, &task_id);
            stop_check_elapsed_ms.set(
                stop_check_elapsed_ms
                    .get()
                    .saturating_add(stop_check_started_at.elapsed().as_millis()),
            );
            requested
        },
        total_units,
        || {
            let next = line_reader.next_line()?;
            if let Some((line, units)) = next {
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    if is_index_chapter_heading(trimmed) {
                        chapter_count.set(chapter_count.get().saturating_add(1));
                    } else {
                        paragraph_count.set(paragraph_count.get().saturating_add(1));
                    }
                }
                Ok(Some((line, units)))
            } else {
                Ok(None)
            }
        },
        |chunk| {
            if first_chunk_preview.is_empty() {
                first_chunk_preview = chunk.text.chars().take(80).collect();
            }
            chunk_count = chunk_count.saturating_add(1);
            fts_writer
                .push(&chunk, &mut noop_progress)
                .map_err(|error| error.to_string())?;
            Ok(())
        },
        |processed_count, processed_lines, total_lines| {
            progress_callback_count.set(progress_callback_count.get().saturating_add(1));
            let progress_callback_started_at = Instant::now();
            let line_fraction = processed_lines as f64 / total_lines.max(1) as f64;
            let mut output_summary = TaskOutputSummaryRecord::default();
            output_summary.chapters = chapter_count.get();
            output_summary.paragraphs = paragraph_count.get();
            output_summary.chunks = processed_count;
            output_summary.bytes_read = metadata.len() as usize;
            let _ = send_worker_progress(
                &progress_sender,
                &task_id_for_progress,
                TaskStage::BUILD_CHUNKS,
                45.0 + (line_fraction * 20.0),
                "生成 chunks",
                output_summary,
            );
            progress_callback_elapsed_ms.set(
                progress_callback_elapsed_ms
                    .get()
                    .saturating_add(progress_callback_started_at.elapsed().as_millis()),
            );
        },
    )
    .map_err(|_| index_build_stop_failure(&data_dir, &task_id))?;
    let build_chunks_diagnostics = BuildChunksDiagnostics {
        split_elapsed_ms: split_started_at.elapsed().as_millis(),
        stop_check_count: stop_check_count.get(),
        stop_check_elapsed_ms: stop_check_elapsed_ms.get(),
        progress_callback_count: progress_callback_count.get(),
        progress_callback_elapsed_ms: progress_callback_elapsed_ms.get(),
    };
    timings.record_build_chunks(build_started_at);
    Ok(BuiltIndexOutput {
        book: book.clone(),
        chunk_count,
        first_chunk_preview,
        fts_writer,
        chapter_count: chapter_count.get(),
        paragraph_count: paragraph_count.get(),
        bytes_read: metadata.len() as usize,
        timings,
        build_chunks_diagnostics,
    })
}

fn send_worker_stage(
    sender: &mpsc::Sender<IndexWorkerMessage>,
    task_id: &str,
    stage: &'static str,
    progress: f64,
    message: &'static str,
) -> Result<(), IndexBuildFailure> {
    sender
        .send(IndexWorkerMessage::Stage {
            task_id: task_id.to_string(),
            stage,
            progress,
            message,
        })
        .map_err(|_| IndexBuildFailure {
            code: TaskErrorCode::CHAPTER_PARSE_FAILED,
            error: "索引 worker 无法发送阶段进度".to_string(),
            message: "索引阶段进度写入失败",
        })
}

fn send_worker_progress(
    sender: &mpsc::Sender<IndexWorkerMessage>,
    task_id: &str,
    stage: &'static str,
    progress: f64,
    message: &'static str,
    output_summary: TaskOutputSummaryRecord,
) -> Result<(), IndexBuildFailure> {
    sender
        .send(IndexWorkerMessage::Progress {
            task_id: task_id.to_string(),
            stage,
            progress,
            message,
            output_summary,
        })
        .map_err(|_| IndexBuildFailure {
            code: TaskErrorCode::CHAPTER_PARSE_FAILED,
            error: "索引 worker 无法发送实时进度".to_string(),
            message: "索引实时进度写入失败",
        })
}

fn cancelled_index_build_failure() -> IndexBuildFailure {
    IndexBuildFailure {
        code: TaskErrorCode::CANCELLED_BY_USER,
        error: "用户取消任务".to_string(),
        message: "用户取消任务",
    }
}

fn paused_index_build_failure() -> IndexBuildFailure {
    IndexBuildFailure {
        code: TaskRunStatus::PAUSED,
        error: "用户暂停任务".to_string(),
        message: "任务已暂停，等待继续执行",
    }
}

fn is_index_chapter_heading(line: &str) -> bool {
    if !line.starts_with("第") || line.chars().count() > 48 {
        return false;
    }
    if line.contains('。')
        || line.contains('，')
        || line.contains(',')
        || line.contains('.')
        || line.contains('！')
        || line.contains('？')
    {
        return false;
    }
    line.contains('章') || line.contains('节') || line.contains('卷')
}

fn run_index_task_batch(
    data_dir: &Path,
    records: &[crate::models::BookRecord],
    tasks: &mut [TaskRecord],
    task_ids: &[String],
    manifest: &mut Vec<BookIndexManifest>,
    settings: &IndexRuntimeSettings,
    sink: Option<&dyn TaskProgressEventSink>,
) -> Result<(), String> {
    let mut handles = Vec::new();
    let (sender, receiver) = mpsc::channel::<IndexWorkerMessage>();
    for task_id in task_ids {
        let Some(task_index) = tasks.iter().position(|task| task.id == *task_id) else {
            continue;
        };
        if tasks[task_index].status != TaskRunStatus::QUEUED
            || !tasks[task_index].blocked_by.is_empty()
        {
            continue;
        }
        if tasks[task_index].kind == TaskKind::CHARACTER_EXTRACTION {
            run_character_extraction_task(data_dir, records, tasks, task_index, sink)?;
            continue;
        }
        start_index_task(data_dir, records, tasks, task_index, sink)?;
        if cancel_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
            save_task_records(data_dir, tasks)?;
            emit_task_progress(data_dir, records, tasks, task_index, "task-cancelled", sink);
            continue;
        }
        if pause_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
            save_task_records(data_dir, tasks)?;
            emit_task_progress(data_dir, records, tasks, task_index, "task-paused", sink);
            continue;
        }
        let task = tasks[task_index].clone();
        let worker_records = records.to_vec();
        let worker_data_dir = data_dir.to_path_buf();
        let worker_settings = settings.clone();
        let worker_sender = sender.clone();
        handles.push(thread::spawn(move || {
            let task_id = task.id.clone();
            let message = match build_index_output_for_task(
                &worker_records,
                &task,
                &worker_data_dir,
                &worker_settings,
                &worker_sender,
            ) {
                Ok(output) => IndexWorkerMessage::Built { task_id, output },
                Err(failure) if failure.code == TaskRunStatus::PAUSED => {
                    IndexWorkerMessage::Paused { task_id }
                }
                Err(failure) => IndexWorkerMessage::Failed { task_id, failure },
            };
            let _ = worker_sender.send(message);
        }));
    }
    drop(sender);

    for message in receiver {
        match message {
            IndexWorkerMessage::Stage {
                task_id,
                stage,
                progress,
                message,
            } => {
                let Some(task_index) = tasks.iter().position(|task| task.id == task_id) else {
                    continue;
                };
                if tasks[task_index].status == TaskRunStatus::CANCELLED {
                    continue;
                }
                if cancel_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
                    save_task_records(data_dir, tasks)?;
                    emit_task_progress(
                        data_dir,
                        records,
                        tasks,
                        task_index,
                        "task-cancelled",
                        sink,
                    );
                    continue;
                }
                if pause_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
                    save_task_records(data_dir, tasks)?;
                    emit_task_progress(data_dir, records, tasks, task_index, "task-paused", sink);
                    continue;
                }
                mark_task_stage(
                    data_dir, records, tasks, task_index, stage, progress, message, sink,
                )?;
                if cancel_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
                    save_task_records(data_dir, tasks)?;
                    emit_task_progress(
                        data_dir,
                        records,
                        tasks,
                        task_index,
                        "task-cancelled",
                        sink,
                    );
                    continue;
                }
                if pause_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
                    save_task_records(data_dir, tasks)?;
                    emit_task_progress(data_dir, records, tasks, task_index, "task-paused", sink);
                }
            }
            IndexWorkerMessage::Progress {
                task_id,
                stage,
                progress,
                message,
                output_summary,
            } => {
                let Some(task_index) = tasks.iter().position(|task| task.id == task_id) else {
                    continue;
                };
                if tasks[task_index].status == TaskRunStatus::CANCELLED {
                    continue;
                }
                if cancel_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
                    save_task_records(data_dir, tasks)?;
                    emit_task_progress(
                        data_dir,
                        records,
                        tasks,
                        task_index,
                        "task-cancelled",
                        sink,
                    );
                    continue;
                }
                if pause_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
                    save_task_records(data_dir, tasks)?;
                    emit_task_progress(data_dir, records, tasks, task_index, "task-paused", sink);
                    continue;
                }
                stream_task_progress_snapshot(
                    data_dir,
                    records,
                    tasks,
                    task_index,
                    stage,
                    progress,
                    message,
                    output_summary,
                    sink,
                )?;
            }
            IndexWorkerMessage::Built { task_id, output } => {
                let Some(task_index) = tasks.iter().position(|task| task.id == task_id) else {
                    continue;
                };
                if tasks[task_index].status == TaskRunStatus::CANCELLED {
                    continue;
                }
                if cancel_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
                    save_task_records(data_dir, tasks)?;
                    emit_task_progress(
                        data_dir,
                        records,
                        tasks,
                        task_index,
                        "task-cancelled",
                        sink,
                    );
                    continue;
                }
                if pause_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
                    save_task_records(data_dir, tasks)?;
                    emit_task_progress(data_dir, records, tasks, task_index, "task-paused", sink);
                    continue;
                }
                commit_built_index_output(
                    data_dir, records, tasks, task_index, manifest, output, sink,
                )?;
            }
            IndexWorkerMessage::Paused { task_id } => {
                let Some(task_index) = tasks.iter().position(|task| task.id == task_id) else {
                    continue;
                };
                if tasks[task_index].status != TaskRunStatus::PAUSED {
                    tasks[task_index].status = TaskRunStatus::PAUSED.to_string();
                    tasks[task_index].message = "任务已暂停，等待继续执行".to_string();
                    tasks[task_index].updated_at = now_millis_string();
                    append_task_log(
                        data_dir,
                        &tasks[task_index],
                        "info",
                        "任务已暂停，等待继续执行",
                    )?;
                    save_task_records(data_dir, tasks)?;
                }
                emit_task_progress(data_dir, records, tasks, task_index, "task-paused", sink);
            }
            IndexWorkerMessage::Failed { task_id, failure } => {
                let Some(task_index) = tasks.iter().position(|task| task.id == task_id) else {
                    continue;
                };
                if failure.code == TaskErrorCode::CANCELLED_BY_USER {
                    if tasks[task_index].status != TaskRunStatus::CANCELLED {
                        tasks[task_index].status = TaskRunStatus::CANCELLING.to_string();
                        if cancel_task_at_boundary(data_dir, &mut tasks[task_index])? {
                            save_task_records(data_dir, tasks)?;
                            emit_task_progress(
                                data_dir,
                                records,
                                tasks,
                                task_index,
                                "task-cancelled",
                                sink,
                            );
                        }
                    }
                    continue;
                }
                fail_task(
                    data_dir,
                    records,
                    tasks,
                    task_index,
                    failure.code,
                    failure.error,
                    failure.message,
                    sink,
                )?;
            }
        }
    }
    for handle in handles {
        handle
            .join()
            .map_err(|_| "索引 worker 线程异常退出".to_string())?;
    }
    Ok(())
}

fn run_character_extraction_task(
    data_dir: &Path,
    records: &[crate::models::BookRecord],
    tasks: &mut [TaskRecord],
    task_index: usize,
    sink: Option<&dyn TaskProgressEventSink>,
) -> Result<(), String> {
    const CHARACTER_EXTRACTION_CANCELLED: &str = "__bookmind_character_extraction_cancelled__";
    const CHARACTER_EXTRACTION_PAUSED: &str = "__bookmind_character_extraction_paused__";

    start_index_task(data_dir, records, tasks, task_index, sink)?;
    if cancel_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
        save_task_records(data_dir, tasks)?;
        emit_task_progress(data_dir, records, tasks, task_index, "task-cancelled", sink);
        return Ok(());
    }
    if pause_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
        save_task_records(data_dir, tasks)?;
        emit_task_progress(data_dir, records, tasks, task_index, "task-paused", sink);
        return Ok(());
    }
    mark_task_stage(
        data_dir,
        records,
        tasks,
        task_index,
        TaskStage::READ_FILE,
        15.0,
        "读取全文索引 chunks",
        sink,
    )?;
    let read_file_started_at = Instant::now();
    mark_task_stage(
        data_dir,
        records,
        tasks,
        task_index,
        TaskStage::BUILD_CHUNKS,
        45.0,
        "扫描人物候选和 mention 证据",
        sink,
    )?;
    let mut timings = IndexTimingMetrics::default();
    timings.record_read_file(read_file_started_at);
    let book_id = tasks[task_index].book_id.clone();
    let started_at = Instant::now();
    let mut current_timing_stage = TaskStage::BUILD_CHUNKS.to_string();
    let mut current_timing_started_at = Instant::now();
    let mut progress_callback =
        |stage: &str, progress: f64, message: String| -> Result<(), String> {
            if cancel_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
                save_task_records(data_dir, tasks)?;
                emit_task_progress(data_dir, records, tasks, task_index, "task-cancelled", sink);
                return Err(CHARACTER_EXTRACTION_CANCELLED.to_string());
            }
            if pause_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
                save_task_records(data_dir, tasks)?;
                emit_task_progress(data_dir, records, tasks, task_index, "task-paused", sink);
                return Err(CHARACTER_EXTRACTION_PAUSED.to_string());
            }
            if current_timing_stage != stage {
                record_character_stage_timing(
                    &mut timings,
                    &current_timing_stage,
                    current_timing_started_at,
                );
                current_timing_stage = stage.to_string();
                current_timing_started_at = Instant::now();
            }
            stream_task_progress_snapshot(
                data_dir,
                records,
                tasks,
                task_index,
                stage,
                progress,
                &message,
                tasks[task_index].output_summary.clone(),
                sink,
            )
        };
    let payload = match extract_character_index_with_progress_in(
        data_dir,
        &book_id,
        Some(&mut progress_callback),
    ) {
        Ok(payload) => payload,
        Err(error) => {
            if error == CHARACTER_EXTRACTION_CANCELLED || error == CHARACTER_EXTRACTION_PAUSED {
                return Ok(());
            }
            let error_code = if error.contains(TaskErrorCode::CHARACTER_INDEX_MISSING_TEXT_INDEX) {
                TaskErrorCode::CHARACTER_INDEX_MISSING_TEXT_INDEX
            } else {
                TaskErrorCode::CHARACTER_WRITE_FAILED
            };
            let stage = tasks[task_index].stage.clone();
            let task_id = tasks[task_index].id.clone();
            let mark_failed_result = mark_character_index_failed_in(
                data_dir, &book_id, error_code, &error, &stage, &task_id,
            );
            if let Err(mark_error) = mark_failed_result {
                append_task_log(
                    data_dir,
                    &tasks[task_index],
                    "warn",
                    &format!("人物识别失败状态写入失败：{mark_error}"),
                )?;
            }
            return fail_task(
                data_dir,
                records,
                tasks,
                task_index,
                error_code,
                error,
                "人物识别失败",
                sink,
            );
        }
    };
    record_character_stage_timing(
        &mut timings,
        &current_timing_stage,
        current_timing_started_at,
    );
    mark_task_stage(
        data_dir,
        records,
        tasks,
        task_index,
        TaskStage::WRITE_CHUNKS,
        80.0,
        "写入人物索引",
        sink,
    )?;
    let write_chunks_started_at = Instant::now();
    timings.record_write_chunks(write_chunks_started_at);
    mark_task_stage(
        data_dir,
        records,
        tasks,
        task_index,
        TaskStage::VERIFY,
        95.0,
        "校验人物索引",
        sink,
    )?;
    let verify_started_at = Instant::now();
    timings.record_verify(verify_started_at);
    {
        let task = &mut tasks[task_index];
        task.duration_ms = elapsed_millis_floor_one(started_at);
        task.output_summary.chapters = payload.manifest.source_text_index.chunk_count;
        task.output_summary.paragraphs = payload.manifest.mention_count;
        task.output_summary.chunks = payload.manifest.character_count;
        task.output_summary.fts_rows = payload.manifest.relation_count;
        task.output_summary.bytes_read = payload.manifest.evidence_count;
        task.output_summary.stage_durations_ms = timings.stage_durations();
        task.output_summary.warnings = Vec::new();
    }
    complete_task_with_message(data_dir, records, tasks, task_index, "人物识别已完成", sink)
}

fn start_index_task(
    data_dir: &Path,
    records: &[crate::models::BookRecord],
    tasks: &mut [TaskRecord],
    task_index: usize,
    sink: Option<&dyn TaskProgressEventSink>,
) -> Result<(), String> {
    {
        let task = &mut tasks[task_index];
        task.status = TaskRunStatus::RUNNING.to_string();
        task.stage = TaskStage::READ_FILE.to_string();
        task.progress = 0.0;
        task.message = "任务已开始".to_string();
        task.started_at = now_millis_string();
        task.updated_at = task.started_at.clone();
    }
    save_task_records(data_dir, tasks)?;
    emit_task_progress(data_dir, records, tasks, task_index, "task-started", sink);
    Ok(())
}

fn commit_built_index_output(
    data_dir: &Path,
    records: &[crate::models::BookRecord],
    tasks: &mut [TaskRecord],
    task_index: usize,
    manifest: &mut Vec<BookIndexManifest>,
    mut output: BuiltIndexOutput,
    sink: Option<&dyn TaskProgressEventSink>,
) -> Result<(), String> {
    if cancel_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
        save_task_records(data_dir, tasks)?;
        emit_task_progress(data_dir, records, tasks, task_index, "task-cancelled", sink);
        return Ok(());
    }
    if pause_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
        save_task_records(data_dir, tasks)?;
        emit_task_progress(data_dir, records, tasks, task_index, "task-paused", sink);
        return Ok(());
    }
    mark_task_stage(
        data_dir,
        records,
        tasks,
        task_index,
        TaskStage::WRITE_CHUNKS,
        65.0,
        "写入 chunk store",
        sink,
    )?;
    if cancel_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
        save_task_records(data_dir, tasks)?;
        emit_task_progress(data_dir, records, tasks, task_index, "task-cancelled", sink);
        return Ok(());
    }
    if pause_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
        save_task_records(data_dir, tasks)?;
        emit_task_progress(data_dir, records, tasks, task_index, "task-paused", sink);
        return Ok(());
    }
    let write_chunks_started_at = Instant::now();
    output.timings.record_write_chunks(write_chunks_started_at);
    mark_task_stage(
        data_dir,
        records,
        tasks,
        task_index,
        TaskStage::WRITE_FTS,
        85.0,
        "写入 FTS",
        sink,
    )?;
    if cancel_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
        save_task_records(data_dir, tasks)?;
        emit_task_progress(data_dir, records, tasks, task_index, "task-cancelled", sink);
        return Ok(());
    }
    if pause_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
        save_task_records(data_dir, tasks)?;
        emit_task_progress(data_dir, records, tasks, task_index, "task-paused", sink);
        return Ok(());
    }
    let write_fts_started_at = Instant::now();
    if let Err(error) = output.fts_writer.finish() {
        return fail_task(
            data_dir,
            records,
            tasks,
            task_index,
            TaskErrorCode::FTS_WRITE_FAILED,
            error,
            "FTS 写入失败",
            sink,
        );
    }
    output.timings.record_write_fts(write_fts_started_at);
    mark_task_stage(
        data_dir,
        records,
        tasks,
        task_index,
        TaskStage::VERIFY,
        95.0,
        "校验索引",
        sink,
    )?;
    if cancel_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
        save_task_records(data_dir, tasks)?;
        emit_task_progress(data_dir, records, tasks, task_index, "task-cancelled", sink);
        return Ok(());
    }
    if pause_task_at_boundary_from_disk(data_dir, &mut tasks[task_index])? {
        save_task_records(data_dir, tasks)?;
        emit_task_progress(data_dir, records, tasks, task_index, "task-paused", sink);
        return Ok(());
    }
    let verify_started_at = Instant::now();
    output.timings.record_verify(verify_started_at);
    let write_chunks_started_at = Instant::now();
    output.timings.record_write_chunks(write_chunks_started_at);
    let total_ms = output.timings.total_ms().max(1);
    let seconds = total_ms as f64 / 1000.0;
    {
        let task = &mut tasks[task_index];
        task.duration_ms = total_ms;
        task.output_summary.chapters = output.chapter_count;
        task.output_summary.paragraphs = output.paragraph_count;
        task.output_summary.chunks = output.chunk_count;
        task.output_summary.fts_rows = output.chunk_count;
        task.output_summary.bytes_read = output.bytes_read;
        task.output_summary.chunks_per_second = output.chunk_count as f64 / seconds;
        task.output_summary.mb_per_second = (output.bytes_read as f64 / 1_048_576.0) / seconds;
        task.output_summary.stage_durations_ms = output.timings.stage_durations();
    }
    append_task_log(
        data_dir,
        &tasks[task_index],
        "debug",
        &output.build_chunks_diagnostics.summary(),
    )?;
    let output_summary = tasks[task_index].output_summary.clone();
    manifest.retain(|entry| entry.book_id != output.book.id);
    manifest.push(BookIndexManifest {
        book_id: output.book.id.clone(),
        book_title: output.book.display_title.clone(),
        file_path: output.book.file_path.clone(),
        content_hash: output.book.content_hash.clone(),
        index_version: CURRENT_INDEX_VERSION,
        chunk_strategy_version: output
            .first_chunk_preview
            .is_empty()
            .then_some(CURRENT_CHUNK_STRATEGY_VERSION)
            .unwrap_or(CURRENT_CHUNK_STRATEGY_VERSION),
        chapter_rule_version: CURRENT_CHAPTER_RULE_VERSION,
        fts_schema_version: CURRENT_FTS_SCHEMA_VERSION,
        status: "ready".to_string(),
        built_at: now_millis_string(),
        stale_reason: String::new(),
        chapter_count: output.chapter_count,
        paragraph_count: output.paragraph_count,
        chunk_count: output_summary.chunks,
        fts_row_count: output_summary.fts_rows,
        bytes_indexed: output_summary.bytes_read,
        first_chunk_preview: output.first_chunk_preview,
        last_error: String::new(),
    });
    complete_task(data_dir, records, tasks, task_index, sink)
}

fn run_queued_tasks_with_events_in(
    data_dir: &Path,
    sink: Option<&dyn TaskProgressEventSink>,
) -> Result<Vec<TaskRecord>, String> {
    let records = load_library_records(data_dir)?;
    let mut tasks = load_task_records(data_dir)?;
    let mut manifest = load_index_manifest(data_dir)?;

    recover_stale_running_tasks(data_dir, &mut tasks)?;
    complete_ready_placeholder_dag_tasks(&mut tasks);
    let cancelling_indexes: Vec<usize> = tasks
        .iter()
        .enumerate()
        .filter(|(_, task)| {
            is_runnable_task_kind(&task.kind) && task.status == TaskRunStatus::CANCELLING
        })
        .map(|(index, _)| index)
        .collect();
    for task_index in cancelling_indexes {
        let task = &mut tasks[task_index];
        if cancel_task_at_boundary(data_dir, task)? {
            save_task_records(data_dir, &tasks)?;
            emit_task_progress(
                data_dir,
                &records,
                &tasks,
                task_index,
                "task-cancelled",
                sink,
            );
        }
    }
    save_task_records(data_dir, &tasks)?;

    complete_ready_placeholder_dag_tasks(&mut tasks);

    let runtime_settings = load_index_runtime_settings(data_dir);
    loop {
        complete_ready_placeholder_dag_tasks(&mut tasks);
        let queued_task_ids =
            select_runnable_index_task_ids(&tasks, runtime_settings.concurrency_limit);
        if queued_task_ids.is_empty() {
            break;
        }
        run_index_task_batch(
            data_dir,
            &records,
            &mut tasks,
            &queued_task_ids,
            &mut manifest,
            &runtime_settings,
            sink,
        )?;
        thread::sleep(Duration::from_millis(TASK_BATCH_COOLDOWN_MS));
        complete_ready_placeholder_dag_tasks(&mut tasks);
    }

    complete_ready_placeholder_dag_tasks(&mut tasks);
    save_index_manifest(data_dir, &manifest)?;
    save_task_records(data_dir, &tasks)?;
    Ok(tasks)
}

pub(crate) fn run_queued_tasks_in(data_dir: &Path) -> Result<Vec<TaskRecord>, String> {
    run_queued_tasks_with_events_in(data_dir, None)
}

pub(crate) fn run_parse_and_index_tasks_in(data_dir: &Path) -> Result<Vec<TaskRecord>, String> {
    run_queued_tasks_in(data_dir)
}

pub(crate) fn run_parse_and_index_tasks_with_events_in(
    data_dir: &Path,
    sink: &dyn TaskProgressEventSink,
) -> Result<Vec<TaskRecord>, String> {
    run_queued_tasks_with_events_in(data_dir, Some(sink))
}
