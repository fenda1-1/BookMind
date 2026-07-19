use crate::models::{TaskErrorCode, TaskRecord, TaskRunStatus};

use super::is_index_task_kind;

pub(crate) fn is_retryable_task_error_code(code: &str) -> bool {
    matches!(
        code,
        TaskErrorCode::BOOK_MISSING
            | TaskErrorCode::FILE_MISSING
            | TaskErrorCode::FILE_READ_FAILED
            | TaskErrorCode::CHAPTER_PARSE_FAILED
            | TaskErrorCode::CHUNK_WRITE_FAILED
            | TaskErrorCode::FTS_WRITE_FAILED
            | TaskErrorCode::MANIFEST_WRITE_FAILED
            | TaskErrorCode::PREVIOUS_RUN_INTERRUPTED
            | TaskErrorCode::CHARACTER_INDEX_MISSING_TEXT_INDEX
            | TaskErrorCode::CHARACTER_WRITE_FAILED
    )
}

pub(super) fn is_recent_error_status(status: &str) -> bool {
    matches!(
        status,
        TaskRunStatus::FAILED | TaskRunStatus::CANCELLED | TaskRunStatus::PAUSED
    )
}

pub(super) fn collect_recent_index_errors(tasks: &[TaskRecord], limit: usize) -> Vec<String> {
    if limit == 0 {
        return Vec::new();
    }
    tasks
        .iter()
        .rev()
        .filter(|task| is_index_task_kind(&task.kind) && is_recent_error_status(&task.status))
        .filter_map(|task| {
            let message = if !task.error_message.trim().is_empty() {
                task.error_message.trim()
            } else {
                task.message.trim()
            };
            if message.is_empty() {
                None
            } else {
                Some(format!("{}：{}", task.book_id, message))
            }
        })
        .take(limit)
        .collect()
}
