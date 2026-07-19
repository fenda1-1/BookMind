use crate::models::{
    BookRecord, DirectoryImportScanItem, DirectoryImportScanPayload, TaskKind, TaskRecord,
    TaskRunStatus, TaskStage,
};
use crate::paths::{
    character_book_dir, epub_assets_dir, library_covers_dir, library_file_path,
    original_backups_dir, originals_dir, rebase_managed_data_path,
};
use crate::reader_data::{
    archive_reader_records_for_deleted_book_in, has_reader_records_for_book_in,
};
use crate::settings::load_app_settings;
use crate::tasks::{delete_book_index_in, load_task_records, save_task_records};
use epub_parser::Epub;
use mobi::{
    headers::{Compression, Encryption, ExthRecord, TextEncoding},
    Mobi,
};
use regex::Regex;
use serde::Deserialize;
use std::{
    collections::hash_map::DefaultHasher,
    collections::HashMap,
    fs,
    hash::{Hash, Hasher},
    io::{Cursor, Read},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

mod document_reading;
mod import;
mod metadata;
mod reader_document;
mod trash;

use document_reading::decode_txt_bytes_with_mode;
#[allow(unused_imports)]
pub(crate) use document_reading::{
    decode_txt_bytes, read_book_content, read_book_lines, read_book_lines_with_mode, BookLineStream,
};
#[allow(unused_imports)]
pub(crate) use import::{
    decode_epub_file, decode_mobi_file, decode_pdf_file, import_book_directory_into,
    import_book_files_into, import_book_from_path_into, import_book_from_path_with_cleanup_into,
    import_library_cover_image_into, managed_import_source_file_path,
    managed_import_text_file_path, normalize_epub_resource_href, now_epoch_millis,
    safe_epub_asset_file_name, scan_book_import_directory_into,
    strip_epub_html_to_text_with_images,
};
#[allow(unused_imports)]
pub(crate) use metadata::{
    load_library_metadata_payloads, load_library_payloads, load_library_records,
    save_library_records,
};
pub(crate) use reader_document::load_reader_document_payload;
pub(crate) use trash::{
    empty_trash_in, move_book_to_trash_in, permanently_delete_book_in, restore_book_from_trash_in,
};

const DAY_MILLIS: u128 = 24 * 60 * 60 * 1000;
const MAX_DIRECTORY_IMPORT_BOOK_FILES: usize = 200;
const MAX_DIRECTORY_IMPORT_TOTAL_BYTES: u64 = 100 * 1024 * 1024;
const MAX_DIRECTORY_IMPORT_DEPTH: usize = 8;

#[derive(Debug)]
pub(crate) struct DirectoryImportOutcome {
    pub(crate) records: Vec<BookRecord>,
    pub(crate) failed_count: usize,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TxtImportCleanupOptions {
    #[serde(default)]
    pub(crate) enabled: bool,
    #[serde(default = "default_txt_import_encoding_mode")]
    pub(crate) encoding_mode: String,
    #[serde(default)]
    pub(crate) backup_original_on_import: bool,
    #[serde(default = "default_cover_tone_strategy")]
    pub(crate) cover_tone_strategy: String,
    #[serde(default = "default_cover_label_strategy")]
    pub(crate) cover_label_strategy: String,
    #[serde(default)]
    pub(crate) clean_title_from_filename: bool,
    #[serde(default)]
    pub(crate) auto_detect_author: bool,
    #[serde(default)]
    pub(crate) preserve_original_backup: bool,
    #[serde(default)]
    pub(crate) remove_ads: bool,
    #[serde(default)]
    pub(crate) ad_keywords: Vec<String>,
    #[serde(default)]
    pub(crate) remove_ad_urls: bool,
    #[serde(default)]
    pub(crate) remove_pagination_noise: bool,
    #[serde(default)]
    pub(crate) normalize_blank_lines: bool,
    #[serde(default)]
    pub(crate) trim_trailing_whitespace: bool,
    #[serde(default)]
    pub(crate) normalize_full_width_spaces: bool,
    #[serde(default)]
    pub(crate) custom_cleanup_rules: Vec<CustomCleanupRule>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CustomCleanupRule {
    #[serde(default)]
    #[allow(dead_code)]
    pub(crate) id: String,
    #[serde(default)]
    #[allow(dead_code)]
    pub(crate) name: String,
    #[serde(default)]
    pub(crate) pattern: String,
    #[serde(default)]
    pub(crate) replacement: String,
    #[serde(default)]
    pub(crate) enabled: bool,
    #[serde(default)]
    pub(crate) mode: String,
    #[serde(default)]
    pub(crate) priority: i32,
}

fn default_txt_import_encoding_mode() -> String {
    "auto".to_string()
}

fn default_cover_tone_strategy() -> String {
    "format".to_string()
}

fn default_cover_label_strategy() -> String {
    "format".to_string()
}
