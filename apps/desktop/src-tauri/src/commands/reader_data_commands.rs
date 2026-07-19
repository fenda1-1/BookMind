use crate::library::load_library_records;
use crate::paths::app_data_dir;
use crate::reader_data::{
    cleanup_orphan_reader_records_in, delete_reader_record_in, delete_reader_records_by_book_in,
    delete_reader_records_by_kind_in, list_reader_records_by_kind_in, load_reader_record_in,
    quarantine_reader_record_in, save_reader_record_in, search_reader_annotations_in,
    OrphanReaderRecordCleanupPayload, ReaderRecordPayload, SaveReaderRecordRequest,
};
use std::path::Path;

#[tauri::command]
pub(crate) fn get_reader_record(
    book_id: String,
    kind: String,
) -> Result<Option<ReaderRecordPayload>, String> {
    let data_dir = app_data_dir()?;
    load_reader_record_in(&data_dir, &book_id, &kind)
}

#[tauri::command]
pub(crate) fn list_reader_records_by_kind(
    kind: String,
) -> Result<Vec<ReaderRecordPayload>, String> {
    let data_dir = app_data_dir()?;
    list_reader_records_by_kind_in(&data_dir, &kind)
}

#[tauri::command]
pub(crate) fn save_reader_record(
    request: SaveReaderRecordRequest,
) -> Result<ReaderRecordPayload, String> {
    let data_dir = app_data_dir()?;
    save_reader_record_in(&data_dir, &request)
}

#[tauri::command]
pub(crate) fn delete_reader_record(book_id: String, kind: String) -> Result<usize, String> {
    let data_dir = app_data_dir()?;
    delete_reader_record_in(&data_dir, &book_id, &kind)
}

#[tauri::command]
pub(crate) fn delete_reader_records_by_kind(kind: String) -> Result<usize, String> {
    let data_dir = app_data_dir()?;
    delete_reader_records_by_kind_in(&data_dir, &kind)
}

#[tauri::command]
pub(crate) fn delete_reader_records_by_book(book_id: String) -> Result<usize, String> {
    let data_dir = app_data_dir()?;
    delete_reader_records_by_book_in(&data_dir, &book_id)
}

pub(crate) fn cleanup_orphan_reader_records_for_library_in(
    data_dir: &Path,
) -> Result<OrphanReaderRecordCleanupPayload, String> {
    let records = load_library_records(data_dir)?;
    let library_book_ids = records
        .iter()
        .map(|record| record.id.clone())
        .collect::<Vec<_>>();
    cleanup_orphan_reader_records_in(data_dir, &library_book_ids)
}

#[tauri::command]
pub(crate) fn cleanup_orphan_reader_records() -> Result<OrphanReaderRecordCleanupPayload, String> {
    let data_dir = app_data_dir()?;
    cleanup_orphan_reader_records_for_library_in(&data_dir)
}

#[tauri::command]
pub(crate) fn quarantine_reader_record(
    book_id: String,
    kind: String,
    reason: String,
) -> Result<Option<ReaderRecordPayload>, String> {
    let data_dir = app_data_dir()?;
    quarantine_reader_record_in(&data_dir, &book_id, &kind, &reason)
}

#[tauri::command]
pub(crate) fn get_reader_state(book_id: String) -> Result<Option<ReaderRecordPayload>, String> {
    let data_dir = app_data_dir()?;
    load_reader_record_in(&data_dir, &book_id, "state")
}

#[tauri::command]
pub(crate) fn save_reader_state(
    book_id: String,
    state: String,
) -> Result<ReaderRecordPayload, String> {
    let data_dir = app_data_dir()?;
    save_reader_record_in(
        &data_dir,
        &SaveReaderRecordRequest {
            book_id,
            kind: "state".to_string(),
            payload: state,
            schema_version: 1,
            source_window_id: "typed-wrapper".to_string(),
        },
    )
}

#[tauri::command]
pub(crate) fn list_reader_highlights(
    book_id: String,
    _filters: Option<String>,
) -> Result<Option<ReaderRecordPayload>, String> {
    let data_dir = app_data_dir()?;
    load_reader_record_in(&data_dir, &book_id, "highlights")
}

#[tauri::command]
pub(crate) fn upsert_reader_highlight(
    request: SaveReaderRecordRequest,
) -> Result<ReaderRecordPayload, String> {
    let data_dir = app_data_dir()?;
    save_reader_record_in(
        &data_dir,
        &SaveReaderRecordRequest {
            kind: "highlights".to_string(),
            ..request
        },
    )
}

#[tauri::command]
pub(crate) fn delete_reader_highlight(id: String) -> Result<String, String> {
    Ok(id)
}

#[tauri::command]
pub(crate) fn list_reader_bookmarks(
    book_id: String,
) -> Result<Option<ReaderRecordPayload>, String> {
    let data_dir = app_data_dir()?;
    load_reader_record_in(&data_dir, &book_id, "bookmarks")
}

#[tauri::command]
pub(crate) fn upsert_reader_bookmark(
    request: SaveReaderRecordRequest,
) -> Result<ReaderRecordPayload, String> {
    let data_dir = app_data_dir()?;
    save_reader_record_in(
        &data_dir,
        &SaveReaderRecordRequest {
            kind: "bookmarks".to_string(),
            ..request
        },
    )
}

#[tauri::command]
pub(crate) fn delete_reader_bookmark(id: String) -> Result<String, String> {
    Ok(id)
}

#[tauri::command]
pub(crate) fn list_reader_toc_edits(
    book_id: String,
) -> Result<Option<ReaderRecordPayload>, String> {
    let data_dir = app_data_dir()?;
    load_reader_record_in(&data_dir, &book_id, "tocEdits")
}

#[tauri::command]
pub(crate) fn save_reader_toc_edit(
    request: SaveReaderRecordRequest,
) -> Result<ReaderRecordPayload, String> {
    let data_dir = app_data_dir()?;
    save_reader_record_in(
        &data_dir,
        &SaveReaderRecordRequest {
            kind: "tocEdits".to_string(),
            ..request
        },
    )
}

#[tauri::command]
pub(crate) fn search_reader_annotations(
    query: String,
    _filters: Option<String>,
) -> Result<Vec<ReaderRecordPayload>, String> {
    let data_dir = app_data_dir()?;
    search_reader_annotations_in(&data_dir, &query)
}

#[tauri::command]
pub(crate) fn migrate_reader_local_storage(
    payload: SaveReaderRecordRequest,
) -> Result<ReaderRecordPayload, String> {
    let data_dir = app_data_dir()?;
    save_reader_record_in(&data_dir, &payload)
}
