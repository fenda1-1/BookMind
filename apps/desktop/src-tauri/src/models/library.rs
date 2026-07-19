use super::*;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BookRecord {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) display_title: String,
    pub(crate) author: String,
    pub(crate) format: String,
    pub(crate) status: String,
    pub(crate) progress: u8,
    pub(crate) file_name: String,
    pub(crate) file_path: String,
    #[serde(default)]
    pub(crate) source_file_path: String,
    pub(crate) cover_label: String,
    pub(crate) cover_tone: String,
    #[serde(default)]
    pub(crate) cover_image_path: String,
    pub(crate) deleted: bool,
    #[serde(default)]
    pub(crate) deleted_at: String,
    #[serde(default)]
    pub(crate) content_hash: String,
    #[serde(default)]
    pub(crate) imported_at: String,
    #[serde(default)]
    pub(crate) last_opened_at: String,
    #[serde(default)]
    pub(crate) shelf_groups: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BookPayload {
    #[serde(flatten)]
    pub(crate) record: BookRecord,
    pub(crate) content: String,
    pub(crate) chunks: Vec<TextChunkRecord>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) source_file_path: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DirectoryImportPayload {
    pub(crate) books: Vec<BookPayload>,
    pub(crate) failed_count: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DirectoryImportScanItem {
    pub(crate) path: String,
    pub(crate) file_name: String,
    pub(crate) display_name: String,
    pub(crate) extension: String,
    pub(crate) relative_path: String,
    pub(crate) size_bytes: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DirectoryImportScanPayload {
    pub(crate) directory: String,
    pub(crate) recursive: bool,
    pub(crate) files: Vec<DirectoryImportScanItem>,
    pub(crate) total_bytes: u64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DirectoryImportFileSelection {
    pub(crate) path: String,
    #[serde(default)]
    pub(crate) display_name: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DataBackupResultPayload {
    pub(crate) backup_path: String,
    pub(crate) restored_from: String,
    pub(crate) copied_files: usize,
    pub(crate) copied_bytes: u64,
    pub(crate) reused_files: usize,
    pub(crate) backup_mode: String,
    pub(crate) excluded_secrets: bool,
    pub(crate) created_at: String,
}
