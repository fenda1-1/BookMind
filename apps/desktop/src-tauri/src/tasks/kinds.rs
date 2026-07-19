use crate::models::{TaskKind, TaskRecord, TaskRunStatus, TaskStage};

use super::now_millis_string;

pub(super) fn is_index_task_kind(kind: &str) -> bool {
    kind == TaskKind::PARSE_AND_INDEX || kind == TaskKind::REBUILD_INDEX
}

pub(super) fn is_runnable_task_kind(kind: &str) -> bool {
    is_index_task_kind(kind) || kind == TaskKind::CHARACTER_EXTRACTION
}

pub(super) fn is_restorable_archived_task_kind(kind: &str) -> bool {
    matches!(
        kind,
        TaskKind::PARSE_AND_INDEX
            | TaskKind::REBUILD_INDEX
            | TaskKind::FULL_TEXT_INDEX
            | TaskKind::EMBEDDING_INDEX
            | TaskKind::AI_SUMMARY
            | TaskKind::CHARACTER_EXTRACTION
    )
}

fn dependencies_satisfied(task: &TaskRecord, tasks: &[TaskRecord]) -> bool {
    task.depends_on.iter().all(|dependency_id| {
        tasks
            .iter()
            .find(|candidate| &candidate.id == dependency_id)
            .map(|dependency| is_dependency_success_status(&dependency.status))
            .unwrap_or(false)
    })
}

fn is_dependency_success_status(status: &str) -> bool {
    status == TaskRunStatus::SUCCEEDED || status == TaskRunStatus::SKIPPED
}

fn blocked_dependency_ids(task: &TaskRecord, tasks: &[TaskRecord]) -> Vec<String> {
    task.depends_on
        .iter()
        .filter(|dependency_id| {
            tasks
                .iter()
                .find(|candidate| &candidate.id == *dependency_id)
                .map(|dependency| !is_dependency_success_status(&dependency.status))
                .unwrap_or(true)
        })
        .cloned()
        .collect()
}

pub(super) fn update_dag_blockers(tasks: &mut [TaskRecord]) {
    let snapshot = tasks.to_vec();
    for task in tasks.iter_mut() {
        task.blocked_by = blocked_dependency_ids(task, &snapshot);
    }
}

pub(super) fn complete_ready_placeholder_dag_tasks(tasks: &mut [TaskRecord]) {
    loop {
        update_dag_blockers(tasks);
        let snapshot = tasks.to_vec();
        let Some(task) = tasks.iter_mut().find(|task| {
            task.status == TaskRunStatus::QUEUED
                && is_placeholder_dag_task_kind(&task.kind)
                && dependencies_satisfied(task, &snapshot)
        }) else {
            break;
        };
        let (status, message) = placeholder_dag_completion(&task.kind);
        task.status = status.to_string();
        task.stage = TaskStage::DONE.to_string();
        task.progress = 100.0;
        task.message = message.to_string();
        task.finished_at = now_millis_string();
        task.updated_at = task.finished_at.clone();
    }
    update_dag_blockers(tasks);
}

fn is_placeholder_dag_task_kind(kind: &str) -> bool {
    matches!(
        kind,
        TaskKind::FULL_TEXT_INDEX | TaskKind::EMBEDDING_INDEX | TaskKind::AI_SUMMARY
    )
}

fn placeholder_dag_completion(kind: &str) -> (&'static str, &'static str) {
    match kind {
        TaskKind::FULL_TEXT_INDEX => (TaskRunStatus::SUCCEEDED, "全文索引已由解析任务完成"),
        TaskKind::EMBEDDING_INDEX => (
            TaskRunStatus::SKIPPED,
            "语义向量索引尚未接入，已跳过占位任务",
        ),
        TaskKind::AI_SUMMARY => (TaskRunStatus::SKIPPED, "AI 摘要尚未接入，已跳过占位任务"),
        _ => (TaskRunStatus::SKIPPED, "占位任务已跳过"),
    }
}
