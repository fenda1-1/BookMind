use super::{load_library_records, read_book_content};
use crate::models::BookPayload;
use std::path::Path;

pub(crate) fn load_reader_document_payload(
    data_dir: &Path,
    book_id: &str,
) -> Result<BookPayload, String> {
    let records = load_library_records(data_dir)?;
    let record = records
        .into_iter()
        .find(|record| record.id == book_id)
        .ok_or_else(|| format!("找不到阅读文档：{book_id}"))?;
    let content = read_book_content(Path::new(&record.file_path))?;
    let source_file_path = Some(record.source_file_path.clone());
    Ok(BookPayload {
        record,
        content,
        chunks: Vec::new(),
        source_file_path,
    })
}
