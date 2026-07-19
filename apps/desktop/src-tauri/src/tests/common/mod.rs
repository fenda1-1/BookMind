use crate::models::{TaskKind, TaskRunStatus, TaskStatusPayload};
use crate::tasks::{cancel_task_in, pause_task_in, TaskProgressEventSink};
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex,
};
use std::time::{SystemTime, UNIX_EPOCH};

static TEMP_DIR_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Default)]
pub(super) struct RecordingTaskProgressSink {
    pub(super) events: Mutex<Vec<(String, TaskStatusPayload)>>,
}

impl TaskProgressEventSink for RecordingTaskProgressSink {
    fn emit_task_progress(&self, reason: &str, status: &TaskStatusPayload) {
        self.events
            .lock()
            .expect("progress events should lock")
            .push((reason.to_string(), status.clone()));
    }
}

pub(super) struct CancellingTaskProgressSink {
    data_dir: std::path::PathBuf,
    target_stage: &'static str,
    cancelled_task_id: Mutex<Option<String>>,
    pub(super) events: Mutex<Vec<(String, TaskStatusPayload)>>,
}

impl CancellingTaskProgressSink {
    pub(super) fn new(data_dir: std::path::PathBuf, target_stage: &'static str) -> Self {
        Self {
            data_dir,
            target_stage,
            cancelled_task_id: Mutex::new(None),
            events: Mutex::new(Vec::new()),
        }
    }
}

impl TaskProgressEventSink for CancellingTaskProgressSink {
    fn emit_task_progress(&self, reason: &str, status: &TaskStatusPayload) {
        self.events
            .lock()
            .expect("progress events should lock")
            .push((reason.to_string(), status.clone()));
        if reason != "stage-updated" || status.stage != self.target_stage {
            return;
        }
        let mut cancelled_task_id = self
            .cancelled_task_id
            .lock()
            .expect("cancelled task id should lock");
        if cancelled_task_id.is_some() {
            return;
        }
        cancel_task_in(&self.data_dir, &status.id)
            .expect("task should accept cancellation request");
        *cancelled_task_id = Some(status.id.clone());
    }
}

pub(super) struct PausingTaskProgressSink {
    data_dir: std::path::PathBuf,
    target_stage: &'static str,
    paused_task_id: Mutex<Option<String>>,
    pub(super) events: Mutex<Vec<(String, TaskStatusPayload)>>,
}

impl PausingTaskProgressSink {
    pub(super) fn new(data_dir: std::path::PathBuf, target_stage: &'static str) -> Self {
        Self {
            data_dir,
            target_stage,
            paused_task_id: Mutex::new(None),
            events: Mutex::new(Vec::new()),
        }
    }
}

impl TaskProgressEventSink for PausingTaskProgressSink {
    fn emit_task_progress(&self, reason: &str, status: &TaskStatusPayload) {
        self.events
            .lock()
            .expect("progress events should lock")
            .push((reason.to_string(), status.clone()));
        if reason != "stage-updated" || status.stage != self.target_stage {
            return;
        }
        let mut paused_task_id = self
            .paused_task_id
            .lock()
            .expect("paused task id should lock");
        if paused_task_id.is_some() {
            return;
        }
        pause_task_in(&self.data_dir, &status.id).expect("task should accept pause request");
        *paused_task_id = Some(status.id.clone());
    }
}

pub(super) fn unique_temp_library_dir() -> std::path::PathBuf {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock should be after epoch")
        .as_nanos();
    let counter = TEMP_DIR_COUNTER.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!("bookmind-library-test-{stamp}-{counter}"))
}

pub(super) fn parse_task_for_book<'a>(
    tasks: &'a [crate::models::TaskRecord],
    book_id: &str,
) -> &'a crate::models::TaskRecord {
    tasks
        .iter()
        .find(|task| task.book_id == book_id && task.kind == TaskKind::PARSE_AND_INDEX)
        .expect("parse task should exist")
}

pub(super) fn is_completed_status_for_test(status: &str) -> bool {
    matches!(
        status,
        TaskRunStatus::SUCCEEDED
            | TaskRunStatus::SKIPPED
            | TaskRunStatus::CANCELLED
            | TaskRunStatus::FAILED
            | TaskRunStatus::ARCHIVED
    )
}
