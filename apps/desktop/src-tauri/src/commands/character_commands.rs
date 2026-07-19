use crate::characters::{
    apply_character_ai_postprocess_in, load_character_center_book_summaries_in,
    load_character_center_payload_in, load_character_overview_snapshot_in,
    load_character_reference_quotes_in, queue_character_extraction_in, CharacterOverviewSnapshot,
};
use crate::library::load_library_records;
use crate::models::{
    CharacterAiPostprocessApplyResult, CharacterAiPostprocessOperationPayload,
    CharacterCenterBookSummaryPayload, CharacterCenterPayload, CharacterReferenceQuotePayload,
    TaskStatusPayload,
};
use crate::paths::app_data_dir;
use crate::tasks::load_task_logs_page_in;

#[tauri::command]
pub(crate) fn queue_character_extraction(book_id: String) -> Result<TaskStatusPayload, String> {
    let data_dir = app_data_dir()?;
    let task = queue_character_extraction_in(&data_dir, &book_id)?;
    let records = load_library_records(&data_dir)?;
    let logs =
        load_task_logs_page_in(&data_dir, Some(&task.id), Some(200), Some(0)).unwrap_or_default();
    let book = records.iter().find(|record| record.id == task.book_id);
    Ok(crate::tasks::task_status_payload_for_command(
        task,
        book,
        logs.len(),
    ))
}

#[tauri::command]
pub(crate) fn get_character_center_books() -> Result<Vec<CharacterCenterBookSummaryPayload>, String>
{
    let data_dir = app_data_dir()?;
    load_character_center_book_summaries_in(&data_dir)
}

#[tauri::command]
pub(crate) fn get_character_center_payload(
    book_id: String,
) -> Result<CharacterCenterPayload, String> {
    let data_dir = app_data_dir()?;
    load_character_center_payload_in(&data_dir, &book_id)
}

#[tauri::command]
pub(crate) fn get_character_reference_quotes(
    book_id: String,
) -> Result<Vec<CharacterReferenceQuotePayload>, String> {
    let data_dir = app_data_dir()?;
    load_character_reference_quotes_in(&data_dir, &book_id)
}

#[tauri::command]
pub(crate) fn apply_character_ai_postprocess(
    book_id: String,
    operations: Vec<CharacterAiPostprocessOperationPayload>,
) -> Result<CharacterAiPostprocessApplyResult, String> {
    let data_dir = app_data_dir()?;
    apply_character_ai_postprocess_in(&data_dir, &book_id, &operations)
}

#[tauri::command]
pub(crate) fn get_character_overview_snapshot(
    book_id: String,
) -> Result<CharacterOverviewSnapshot, String> {
    let data_dir = app_data_dir()?;
    load_character_overview_snapshot_in(&data_dir, &book_id)
}
