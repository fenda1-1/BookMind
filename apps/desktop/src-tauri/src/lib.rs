mod backup;
mod characters;
mod cloud_ai;
mod commands;
mod database;
mod encryption;
mod library;
mod models;
mod notes;
mod paths;
mod reader_data;
mod search;
mod settings;
mod sidecar;
mod tasks;
mod translation;

use commands::{
    answer_from_local_index, apply_character_ai_postprocess, apply_task_log_retention,
    apply_task_retention, archive_task, build_vector_index, cancel_local_ai_answer,
    cancel_queued_tasks, cancel_task, check_ai_sidecar_health, cleanup_orphan_reader_records,
    clear_completed_tasks, clear_task_logs, configure_current_data_asset_scope,
    create_auto_data_backup, create_data_backup, delete_book_index, delete_flashcards,
    delete_highlights, delete_notes, delete_reader_bookmark, delete_reader_highlight,
    delete_reader_record, delete_reader_records_by_book, delete_reader_records_by_kind,
    empty_trash, enable_portable_data_directory, export_knowledge_markdown,
    generate_flashcards_from_highlights, get_ai_api_key_storage_status, get_app_settings,
    get_character_center_books, get_character_center_payload, get_character_overview_snapshot,
    get_character_reference_quotes, get_data_directory_status, get_epub_source_bytes,
    get_flashcards, get_highlights, get_index_diagnostics, get_indexed_chunks_preview,
    get_library_books, get_local_encryption_status, get_notes, get_pdf_source_bytes,
    get_reader_document, get_reader_record, get_reader_state, get_settings_v2, get_task_statuses,
    import_book_files, import_book_from_path, import_books_from_directory,
    import_dev_sample_book_and_index, import_library_cover_image, list_cloud_ai_models,
    list_reader_bookmarks, list_reader_highlights, list_reader_records_by_kind,
    list_reader_toc_edits, load_task_logs, migrate_data_directory,
    migrate_data_directory_with_progress, migrate_reader_local_storage, move_book_to_trash,
    open_data_directory, open_external_url, pause_queued_tasks, pause_task,
    permanently_delete_book, quarantine_reader_record, queue_character_extraction,
    rebuild_book_index, rebuild_database_indexes, repair_book_fts, request_cloud_ai_answer,
    request_cloud_ai_answer_stream, restore_archived_task, restore_book_from_trash,
    restore_data_backup, retry_failed_tasks, retry_task, rotate_local_data_key,
    run_parse_and_index_tasks, save_ai_generated_flashcards, save_ai_note, save_highlight,
    save_reader_record, save_reader_state, save_reader_toc_edit, scan_book_import_directory,
    search_index, search_index_page, search_reader_annotations, search_vector_index,
    set_local_master_password, test_cloud_ai_connection, translate_text,
    update_ai_provider_api_key, update_app_settings, update_book_metadata, update_settings_v2,
    update_translation_api_key, upsert_reader_bookmark, upsert_reader_highlight, vacuum_database,
    validate_all_indexes, verify_local_master_password, write_reader_binary_file,
    write_reader_export_file,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            configure_current_data_asset_scope(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_library_books,
            get_reader_document,
            get_pdf_source_bytes,
            get_epub_source_bytes,
            get_app_settings,
            update_app_settings,
            update_ai_provider_api_key,
            update_translation_api_key,
            get_settings_v2,
            update_settings_v2,
            get_local_encryption_status,
            set_local_master_password,
            verify_local_master_password,
            rotate_local_data_key,
            get_ai_api_key_storage_status,
            open_data_directory,
            open_external_url,
            get_data_directory_status,
            migrate_data_directory,
            migrate_data_directory_with_progress,
            enable_portable_data_directory,
            create_data_backup,
            create_auto_data_backup,
            restore_data_backup,
            update_book_metadata,
            import_book_from_path,
            import_books_from_directory,
            scan_book_import_directory,
            import_book_files,
            import_library_cover_image,
            import_dev_sample_book_and_index,
            move_book_to_trash,
            restore_book_from_trash,
            permanently_delete_book,
            empty_trash,
            get_task_statuses,
            get_index_diagnostics,
            validate_all_indexes,
            rebuild_database_indexes,
            vacuum_database,
            run_parse_and_index_tasks,
            pause_task,
            cancel_task,
            retry_task,
            cancel_queued_tasks,
            retry_failed_tasks,
            pause_queued_tasks,
            clear_completed_tasks,
            archive_task,
            restore_archived_task,
            load_task_logs,
            clear_task_logs,
            apply_task_log_retention,
            apply_task_retention,
            rebuild_book_index,
            delete_book_index,
            repair_book_fts,
            queue_character_extraction,
            apply_character_ai_postprocess,
            get_character_center_books,
            get_character_center_payload,
            get_character_reference_quotes,
            get_character_overview_snapshot,
            get_indexed_chunks_preview,
            search_index,
            search_index_page,
            answer_from_local_index,
            cancel_local_ai_answer,
            build_vector_index,
            search_vector_index,
            check_ai_sidecar_health,
            test_cloud_ai_connection,
            request_cloud_ai_answer,
            request_cloud_ai_answer_stream,
            list_cloud_ai_models,
            translate_text,
            save_ai_note,
            get_notes,
            delete_notes,
            save_highlight,
            get_highlights,
            delete_highlights,
            generate_flashcards_from_highlights,
            save_ai_generated_flashcards,
            get_flashcards,
            delete_flashcards,
            export_knowledge_markdown,
            write_reader_export_file,
            get_reader_record,
            list_reader_records_by_kind,
            delete_reader_record,
            delete_reader_records_by_book,
            delete_reader_records_by_kind,
            cleanup_orphan_reader_records,
            quarantine_reader_record,
            save_reader_record,
            get_reader_state,
            save_reader_state,
            list_reader_highlights,
            upsert_reader_highlight,
            delete_reader_highlight,
            list_reader_bookmarks,
            upsert_reader_bookmark,
            delete_reader_bookmark,
            list_reader_toc_edits,
            save_reader_toc_edit,
            search_reader_annotations,
            write_reader_binary_file,
            migrate_reader_local_storage
        ])
        .run(tauri::generate_context!())
        .expect("error while running BookMind desktop app");
}

#[cfg(test)]
mod tests;
