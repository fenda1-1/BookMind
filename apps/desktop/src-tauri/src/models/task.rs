use super::*;

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskOutputSummaryRecord {
    #[serde(default)]
    pub(crate) chapters: usize,
    #[serde(default)]
    pub(crate) paragraphs: usize,
    #[serde(default)]
    pub(crate) chunks: usize,
    #[serde(default)]
    pub(crate) fts_rows: usize,
    #[serde(default)]
    pub(crate) bytes_read: usize,
    #[serde(default)]
    pub(crate) warnings: Vec<String>,
    #[serde(default)]
    pub(crate) chunks_per_second: f64,
    #[serde(default)]
    pub(crate) mb_per_second: f64,
    #[serde(default)]
    pub(crate) stage_durations_ms: TaskStageDurationsRecord,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskStageDurationsRecord {
    #[serde(default)]
    pub(crate) read_file: u64,
    #[serde(default)]
    pub(crate) parse_chapters: u64,
    #[serde(default)]
    pub(crate) build_chunks: u64,
    #[serde(default)]
    pub(crate) write_chunks: u64,
    #[serde(default)]
    pub(crate) write_fts: u64,
    #[serde(default)]
    pub(crate) verify: u64,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskError {
    pub(crate) code: String,
    pub(crate) message: String,
    pub(crate) stage: String,
    pub(crate) retryable: bool,
    #[serde(default)]
    pub(crate) detail: Value,
}

impl TaskError {
    pub(crate) fn new(
        code: &str,
        message: String,
        stage: &str,
        retryable: bool,
        detail: Value,
    ) -> Self {
        Self {
            code: code.to_string(),
            message,
            stage: stage.to_string(),
            retryable,
            detail,
        }
    }

    pub(crate) fn empty() -> Self {
        Self::default()
    }
}

pub(crate) struct TaskErrorCode;

impl TaskErrorCode {
    pub(crate) const BOOK_MISSING: &'static str = "book_missing";
    pub(crate) const FILE_MISSING: &'static str = "file_missing";
    pub(crate) const FILE_READ_FAILED: &'static str = "file_read_failed";
    pub(crate) const CHAPTER_PARSE_FAILED: &'static str = "chapter_parse_failed";
    pub(crate) const CHUNK_WRITE_FAILED: &'static str = "chunk_write_failed";
    pub(crate) const FTS_WRITE_FAILED: &'static str = "fts_write_failed";
    pub(crate) const MANIFEST_WRITE_FAILED: &'static str = "manifest_write_failed";
    pub(crate) const CANCELLED_BY_USER: &'static str = "cancelled_by_user";
    pub(crate) const PREVIOUS_RUN_INTERRUPTED: &'static str = "previous_run_interrupted";
    pub(crate) const CHARACTER_INDEX_MISSING_TEXT_INDEX: &'static str =
        "character_index_missing_text_index";
    pub(crate) const CHARACTER_WRITE_FAILED: &'static str = "character_write_failed";
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum TaskRunStatus {
    Queued,
    Running,
    Paused,
    Cancelling,
    Cancelled,
    Failed,
    Succeeded,
    Skipped,
    Archived,
}

impl TaskRunStatus {
    pub(crate) const QUEUED: &'static str = "queued";
    pub(crate) const RUNNING: &'static str = "running";
    pub(crate) const PAUSED: &'static str = "paused";
    pub(crate) const CANCELLING: &'static str = "cancelling";
    pub(crate) const CANCELLED: &'static str = "cancelled";
    pub(crate) const FAILED: &'static str = "failed";
    pub(crate) const SUCCEEDED: &'static str = "succeeded";
    pub(crate) const SKIPPED: &'static str = "skipped";
    pub(crate) const ARCHIVED: &'static str = "archived";
    pub(crate) const LEGACY_DONE: &'static str = "done";
    pub(crate) const LEGACY_COMPLETED: &'static str = "completed";

    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Queued => Self::QUEUED,
            Self::Running => Self::RUNNING,
            Self::Paused => Self::PAUSED,
            Self::Cancelling => Self::CANCELLING,
            Self::Cancelled => Self::CANCELLED,
            Self::Failed => Self::FAILED,
            Self::Succeeded => Self::SUCCEEDED,
            Self::Skipped => Self::SKIPPED,
            Self::Archived => Self::ARCHIVED,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum TaskKind {
    ImportDirectory,
    ImportBook,
    ParseAndIndex,
    RebuildIndex,
    FullTextIndex,
    CleanupIndex,
    ExportData,
    EmbeddingIndex,
    AiSummary,
    Backup,
    Diagnostics,
    CharacterExtraction,
}

impl TaskKind {
    pub(crate) const IMPORT_DIRECTORY: &'static str = "import-directory";
    pub(crate) const IMPORT_BOOK: &'static str = "import-book";
    pub(crate) const PARSE_AND_INDEX: &'static str = "parse-and-index";
    pub(crate) const REBUILD_INDEX: &'static str = "rebuild-index";
    pub(crate) const FULL_TEXT_INDEX: &'static str = "full-text-index";
    pub(crate) const CLEANUP_INDEX: &'static str = "cleanup-index";
    pub(crate) const EXPORT_DATA: &'static str = "export-data";
    pub(crate) const EMBEDDING_INDEX: &'static str = "embedding-index";
    pub(crate) const AI_SUMMARY: &'static str = "ai-summary";
    pub(crate) const BACKUP: &'static str = "backup";
    pub(crate) const DIAGNOSTICS: &'static str = "diagnostics";
    pub(crate) const CHARACTER_EXTRACTION: &'static str = "character-extraction";

    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::ImportDirectory => Self::IMPORT_DIRECTORY,
            Self::ImportBook => Self::IMPORT_BOOK,
            Self::ParseAndIndex => Self::PARSE_AND_INDEX,
            Self::RebuildIndex => Self::REBUILD_INDEX,
            Self::FullTextIndex => Self::FULL_TEXT_INDEX,
            Self::CleanupIndex => Self::CLEANUP_INDEX,
            Self::ExportData => Self::EXPORT_DATA,
            Self::EmbeddingIndex => Self::EMBEDDING_INDEX,
            Self::AiSummary => Self::AI_SUMMARY,
            Self::Backup => Self::BACKUP,
            Self::Diagnostics => Self::DIAGNOSTICS,
            Self::CharacterExtraction => Self::CHARACTER_EXTRACTION,
        }
    }
}

impl std::fmt::Display for TaskKind {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum TaskStage {
    Queued,
    ReadFile,
    ParseChapters,
    BuildChunks,
    WriteChunks,
    WriteFts,
    Verify,
    Done,
}

impl TaskStage {
    pub(crate) const QUEUED: &'static str = "queued";
    pub(crate) const READ_FILE: &'static str = "read-file";
    pub(crate) const PARSE_CHAPTERS: &'static str = "parse-chapters";
    pub(crate) const BUILD_CHUNKS: &'static str = "build-chunks";
    pub(crate) const WRITE_CHUNKS: &'static str = "write-chunks";
    pub(crate) const WRITE_FTS: &'static str = "write-fts";
    pub(crate) const VERIFY: &'static str = "verify";
    pub(crate) const DONE: &'static str = "done";

    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Queued => Self::QUEUED,
            Self::ReadFile => Self::READ_FILE,
            Self::ParseChapters => Self::PARSE_CHAPTERS,
            Self::BuildChunks => Self::BUILD_CHUNKS,
            Self::WriteChunks => Self::WRITE_CHUNKS,
            Self::WriteFts => Self::WRITE_FTS,
            Self::Verify => Self::VERIFY,
            Self::Done => Self::DONE,
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskRecord {
    pub(crate) id: String,
    pub(crate) book_id: String,
    #[serde(default = "default_task_kind")]
    pub(crate) kind: String,
    #[serde(default = "default_task_status")]
    pub(crate) status: String,
    #[serde(default)]
    pub(crate) progress: f64,
    #[serde(default = "default_task_stage")]
    pub(crate) stage: String,
    #[serde(default)]
    pub(crate) message: String,
    #[serde(default)]
    pub(crate) created_at: String,
    #[serde(default)]
    pub(crate) updated_at: String,
    #[serde(default)]
    pub(crate) started_at: String,
    #[serde(default)]
    pub(crate) finished_at: String,
    #[serde(default)]
    pub(crate) duration_ms: u64,
    #[serde(default)]
    pub(crate) attempt: u32,
    #[serde(default = "default_task_max_attempts")]
    pub(crate) max_attempts: u32,
    #[serde(default)]
    pub(crate) error_code: String,
    #[serde(default)]
    pub(crate) error_message: String,
    #[serde(default)]
    pub(crate) error: TaskError,
    #[serde(default)]
    pub(crate) dag_id: String,
    #[serde(default)]
    pub(crate) depends_on: Vec<String>,
    #[serde(default)]
    pub(crate) blocked_by: Vec<String>,
    #[serde(default)]
    pub(crate) content_hash: String,
    #[serde(default)]
    pub(crate) index_version: u32,
    #[serde(default)]
    pub(crate) output_summary: TaskOutputSummaryRecord,
}

impl Default for TaskRecord {
    fn default() -> Self {
        Self {
            id: String::new(),
            book_id: String::new(),
            kind: default_task_kind(),
            status: default_task_status(),
            progress: 0.0,
            stage: default_task_stage(),
            message: String::new(),
            created_at: String::new(),
            updated_at: String::new(),
            started_at: String::new(),
            finished_at: String::new(),
            duration_ms: 0,
            attempt: 0,
            max_attempts: default_task_max_attempts(),
            error_code: String::new(),
            error_message: String::new(),
            error: TaskError::empty(),
            dag_id: String::new(),
            depends_on: Vec::new(),
            blocked_by: Vec::new(),
            content_hash: String::new(),
            index_version: 1,
            output_summary: TaskOutputSummaryRecord::default(),
        }
    }
}

impl TaskRecord {
    pub(crate) fn new_dag_task(
        id: String,
        book_id: String,
        kind: &str,
        dag_id: String,
        depends_on: Vec<String>,
        message: String,
    ) -> Self {
        Self {
            id,
            book_id,
            kind: kind.to_string(),
            dag_id,
            depends_on,
            message,
            ..Self::default()
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskStatusPayload {
    pub(crate) id: String,
    pub(crate) kind: String,
    pub(crate) name: String,
    pub(crate) status: String,
    pub(crate) progress: f64,
    pub(crate) stage: String,
    pub(crate) stage_label: String,
    pub(crate) tone: String,
    pub(crate) message: String,
    pub(crate) book_id: String,
    pub(crate) book_title: String,
    pub(crate) file_name: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
    pub(crate) started_at: String,
    pub(crate) finished_at: String,
    pub(crate) duration_ms: u64,
    pub(crate) attempt: u32,
    pub(crate) max_attempts: u32,
    pub(crate) error_code: String,
    pub(crate) error_message: String,
    pub(crate) error: TaskError,
    pub(crate) dag_id: String,
    pub(crate) depends_on: Vec<String>,
    pub(crate) blocked_by: Vec<String>,
    pub(crate) log_count: usize,
    pub(crate) output_summary: TaskOutputSummaryRecord,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskProgressEventPayload {
    pub(crate) reason: String,
    pub(crate) status: TaskStatusPayload,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct IndexDiagnosticsPayload {
    pub(crate) summary: IndexDiagnosticsSummaryPayload,
    pub(crate) books: Vec<BookIndexManifest>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct IndexDiagnosticsSummaryPayload {
    pub(crate) queued_count: usize,
    pub(crate) running_count: usize,
    pub(crate) succeeded_count: usize,
    pub(crate) failed_count: usize,
    pub(crate) paused_count: usize,
    pub(crate) cancelled_count: usize,
    pub(crate) stale_book_count: usize,
    pub(crate) indexed_chunk_count: usize,
    pub(crate) indexed_book_count: usize,
    pub(crate) fts_available: bool,
    pub(crate) fts_database_path: String,
    pub(crate) fts_database_size_bytes: u64,
    pub(crate) fts_database_modified_at: String,
    pub(crate) recent_error: String,
    pub(crate) recent_errors: Vec<String>,
    pub(crate) sidecar_status: String,
    pub(crate) sidecar_message: String,
    pub(crate) vector_index_status: String,
    pub(crate) vector_indexed_book_count: usize,
    pub(crate) vector_indexed_chunk_count: usize,
    pub(crate) vector_provider: String,
    pub(crate) vector_dimension: usize,
    pub(crate) vector_last_built_at: String,
    pub(crate) vector_last_error: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DatabaseIndexMaintenancePayload {
    pub(crate) database_path: String,
    pub(crate) reindexed: bool,
    pub(crate) analyzed: bool,
    pub(crate) fts_optimized: bool,
    pub(crate) chunk_count: usize,
    pub(crate) fts_row_count: usize,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DatabaseVacuumPayload {
    pub(crate) database_path: String,
    pub(crate) vacuumed: bool,
    pub(crate) size_before_bytes: u64,
    pub(crate) size_after_bytes: u64,
    pub(crate) bytes_reclaimed: u64,
    pub(crate) chunk_count: usize,
    pub(crate) fts_row_count: usize,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TaskLogRecord {
    pub(crate) id: String,
    pub(crate) task_id: String,
    #[serde(default)]
    pub(crate) book_id: String,
    pub(crate) level: String,
    #[serde(default = "default_task_stage")]
    pub(crate) stage: String,
    pub(crate) message: String,
    #[serde(default)]
    pub(crate) detail: serde_json::Value,
    pub(crate) created_at: String,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BookIndexManifest {
    pub(crate) book_id: String,
    #[serde(default)]
    pub(crate) book_title: String,
    #[serde(default)]
    pub(crate) file_path: String,
    #[serde(default)]
    pub(crate) content_hash: String,
    #[serde(default)]
    pub(crate) index_version: u32,
    #[serde(default)]
    pub(crate) chunk_strategy_version: u32,
    #[serde(default)]
    pub(crate) chapter_rule_version: u32,
    #[serde(default)]
    pub(crate) fts_schema_version: u32,
    #[serde(default = "default_manifest_status")]
    pub(crate) status: String,
    #[serde(default)]
    pub(crate) built_at: String,
    #[serde(default)]
    pub(crate) stale_reason: String,
    #[serde(default)]
    pub(crate) chapter_count: usize,
    #[serde(default)]
    pub(crate) paragraph_count: usize,
    #[serde(default)]
    pub(crate) chunk_count: usize,
    #[serde(default)]
    pub(crate) fts_row_count: usize,
    #[serde(default)]
    pub(crate) bytes_indexed: usize,
    #[serde(default)]
    pub(crate) first_chunk_preview: String,
    #[serde(default)]
    pub(crate) last_error: String,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VectorIndexManifestEntry {
    pub(crate) book_id: String,
    #[serde(default)]
    pub(crate) content_hash: String,
    #[serde(default)]
    pub(crate) chunk_strategy_version: u32,
    #[serde(default)]
    pub(crate) embedding_model: String,
    #[serde(default)]
    pub(crate) dimension: usize,
    #[serde(default)]
    pub(crate) chunk_count: usize,
    #[serde(default)]
    pub(crate) built_at: String,
    #[serde(default = "default_manifest_status")]
    pub(crate) status: String,
    #[serde(default)]
    pub(crate) last_error: String,
}

pub(crate) struct VectorIndexStatus;

impl VectorIndexStatus {
    pub(crate) const NOT_BUILT: &'static str = "not-built";
    pub(crate) const BUILDING: &'static str = "building";
    pub(crate) const READY: &'static str = "ready";
    pub(crate) const STALE: &'static str = "stale";
    pub(crate) const FAILED: &'static str = "failed";
}
