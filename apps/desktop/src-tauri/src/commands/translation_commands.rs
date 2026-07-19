use crate::models::{TranslationRequestPayload, TranslationResponsePayload};
use crate::paths::app_data_dir;
use crate::settings::load_app_settings;
use crate::translation::translate_with_configured_source;

#[tauri::command]
pub(crate) async fn translate_text(
    request: TranslationRequestPayload,
) -> Result<TranslationResponsePayload, String> {
    let data_dir = app_data_dir()?;
    tauri::async_runtime::spawn_blocking(move || {
        let settings = load_app_settings(&data_dir)?;
        translate_with_configured_source(&settings, &request)
    })
    .await
    .map_err(|_| "Translation task failed".to_string())?
}
