use crate::models::{
    AiGeneratedFlashcardRequest, CitationPayload, FlashcardRecord, HighlightRecord, NoteRecord,
    SaveNoteRequest,
};
use crate::notes::{
    delete_flashcard_records_in, delete_highlight_records_in, delete_note_records_in,
    export_knowledge_markdown_with_options_in,
    generate_flashcards_from_highlights_with_template_defaults_in, load_flashcard_records,
    load_highlight_records, load_note_records, save_ai_generated_flashcards_in, save_ai_note_in,
    save_highlight_in,
};
use crate::paths::app_data_dir;

#[tauri::command]
pub(crate) fn save_ai_note(request: SaveNoteRequest) -> Result<NoteRecord, String> {
    let data_dir = app_data_dir()?;
    save_ai_note_in(
        &data_dir,
        &request.title,
        &request.body,
        &request.citations,
        request.save_target,
        request.reader_location,
        request.ai_metadata,
        request.structured_response,
    )
}

#[tauri::command]
pub(crate) fn get_notes() -> Result<Vec<NoteRecord>, String> {
    let data_dir = app_data_dir()?;
    load_note_records(&data_dir)
}

#[tauri::command]
pub(crate) fn delete_notes(ids: Vec<String>) -> Result<usize, String> {
    let data_dir = app_data_dir()?;
    delete_note_records_in(&data_dir, &ids)
}

#[tauri::command]
pub(crate) fn save_highlight(citation: CitationPayload) -> Result<HighlightRecord, String> {
    let data_dir = app_data_dir()?;
    save_highlight_in(&data_dir, &citation)
}

#[tauri::command]
pub(crate) fn get_highlights() -> Result<Vec<HighlightRecord>, String> {
    let data_dir = app_data_dir()?;
    load_highlight_records(&data_dir)
}

#[tauri::command]
pub(crate) fn delete_highlights(ids: Vec<String>) -> Result<usize, String> {
    let data_dir = app_data_dir()?;
    delete_highlight_records_in(&data_dir, &ids)
}

#[tauri::command]
pub(crate) fn generate_flashcards_from_highlights(
    default_tags: Option<Vec<String>>,
    default_review_status: Option<String>,
    front_template: Option<String>,
    back_template: Option<String>,
) -> Result<Vec<FlashcardRecord>, String> {
    let data_dir = app_data_dir()?;
    generate_flashcards_from_highlights_with_template_defaults_in(
        &data_dir,
        &default_tags.unwrap_or_default(),
        default_review_status.as_deref().unwrap_or("new"),
        front_template.as_deref(),
        back_template.as_deref(),
    )
}

#[tauri::command]
pub(crate) fn save_ai_generated_flashcards(
    cards: Vec<AiGeneratedFlashcardRequest>,
) -> Result<Vec<FlashcardRecord>, String> {
    let data_dir = app_data_dir()?;
    save_ai_generated_flashcards_in(&data_dir, &cards)
}

#[tauri::command]
pub(crate) fn get_flashcards() -> Result<Vec<FlashcardRecord>, String> {
    let data_dir = app_data_dir()?;
    load_flashcard_records(&data_dir)
}

#[tauri::command]
pub(crate) fn delete_flashcards(ids: Vec<String>) -> Result<usize, String> {
    let data_dir = app_data_dir()?;
    delete_flashcard_records_in(&data_dir, &ids)
}

#[tauri::command]
pub(crate) fn export_knowledge_markdown(
    include_ai_metadata: Option<bool>,
    include_structured_response: Option<bool>,
    export_path: Option<String>,
) -> Result<String, String> {
    let data_dir = app_data_dir()?;
    export_knowledge_markdown_with_options_in(
        &data_dir,
        include_ai_metadata.unwrap_or(false),
        include_structured_response.unwrap_or(false),
        export_path.as_deref(),
    )
}
