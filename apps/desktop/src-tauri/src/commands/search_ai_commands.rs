use crate::cloud_ai::{
    list_cloud_ai_models_in, request_cloud_ai_answer_in, request_cloud_ai_answer_stream_in,
    test_cloud_ai_connection_in,
};
use crate::models::{
    AiRequestPayload, AiResponsePayload, AiSidecarHealthPayload, CloudAiAnswerRequest,
    CloudAiModelsPayload, CloudAiModelsRequest, CloudAiTestRequest, CloudAiTestResultPayload,
    IndexedChunksPreviewPayload, SearchIndexPagePayload, SearchResultPayload,
    VectorIndexBuildPayload, VectorSearchPayload,
};
use crate::paths::app_data_dir;
use crate::search::{
    answer_from_ai_request_in, answer_from_local_index_in, build_vector_index_in,
    cancel_local_ai_request, get_indexed_chunks_preview_in, search_index_page_in,
    search_index_page_payload_in, search_vector_index_in,
};
use crate::sidecar::{check_ai_sidecar_health_in, sidecar_health_error_payload};

#[tauri::command]
pub(crate) fn get_indexed_chunks_preview(
    book_id: String,
    limit: Option<usize>,
    offset: Option<usize>,
    query: Option<String>,
    chapter_index: Option<usize>,
) -> Result<IndexedChunksPreviewPayload, String> {
    let data_dir = app_data_dir()?;
    get_indexed_chunks_preview_in(
        &data_dir,
        &book_id,
        limit.unwrap_or(20),
        offset.unwrap_or(0),
        query.as_deref().unwrap_or(""),
        chapter_index,
    )
}

#[tauri::command]
pub(crate) fn search_index(
    query: String,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<SearchResultPayload>, String> {
    let data_dir = app_data_dir()?;
    search_index_page_in(&data_dir, &query, limit.unwrap_or(20), offset.unwrap_or(0))
}

#[tauri::command]
pub(crate) fn search_index_page(
    query: String,
    limit: Option<usize>,
    offset: Option<usize>,
    book_id: Option<String>,
) -> Result<SearchIndexPagePayload, String> {
    let data_dir = app_data_dir()?;
    search_index_page_payload_in(
        &data_dir,
        &query,
        limit.unwrap_or(100),
        offset.unwrap_or(0),
        book_id.as_deref(),
    )
}

#[tauri::command]
pub(crate) fn answer_from_local_index(
    request: Option<AiRequestPayload>,
    prompt: Option<String>,
) -> Result<AiResponsePayload, String> {
    let data_dir = app_data_dir()?;
    if let Some(request) = request {
        return answer_from_ai_request_in(&data_dir, &request);
    }
    answer_from_local_index_in(&data_dir, &prompt.unwrap_or_default())
}

#[tauri::command]
pub(crate) fn cancel_local_ai_answer(request_id: String) -> Result<(), String> {
    cancel_local_ai_request(&request_id);
    Ok(())
}

#[tauri::command]
pub(crate) fn build_vector_index(book_id: String) -> Result<VectorIndexBuildPayload, String> {
    let data_dir = app_data_dir()?;
    build_vector_index_in(&data_dir, &book_id)
}

#[tauri::command]
pub(crate) fn search_vector_index(
    query: String,
    limit: Option<usize>,
) -> Result<VectorSearchPayload, String> {
    let data_dir = app_data_dir()?;
    search_vector_index_in(&data_dir, &query, limit.unwrap_or(20))
}

#[tauri::command]
pub(crate) fn check_ai_sidecar_health() -> Result<AiSidecarHealthPayload, String> {
    let Ok(data_dir) = app_data_dir() else {
        return Ok(sidecar_health_error_payload(
            "AI sidecar data directory could not be resolved.",
        ));
    };
    Ok(check_ai_sidecar_health_in(&data_dir))
}

#[tauri::command]
pub(crate) async fn test_cloud_ai_connection(
    request: CloudAiTestRequest,
) -> Result<CloudAiTestResultPayload, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(test_cloud_ai_connection_in(&request.settings)))
        .await
        .map_err(|error| format!("云端连接测试任务执行失败：{error}"))?
}

#[tauri::command]
// Privacy boundary: frontend services must sanitize and redact cloud AI requests before invoking this command.
// Rust validates provider transport details, while scope permission policy remains in the frontend settings layer.
pub(crate) async fn request_cloud_ai_answer(
    request: CloudAiAnswerRequest,
) -> Result<AiResponsePayload, String> {
    tauri::async_runtime::spawn_blocking(move || {
        request_cloud_ai_answer_in(&request.settings, &request.request)
    })
    .await
    .map_err(|error| format!("云端回答任务执行失败：{error}"))?
}

#[tauri::command]
pub(crate) async fn request_cloud_ai_answer_stream(
    app: tauri::AppHandle,
    request: CloudAiAnswerRequest,
) -> Result<AiResponsePayload, String> {
    tauri::async_runtime::spawn_blocking(move || {
        request_cloud_ai_answer_stream_in(app, &request.settings, &request.request)
    })
    .await
    .map_err(|error| format!("云端流式任务执行失败：{error}"))?
}

#[tauri::command]
pub(crate) async fn list_cloud_ai_models(
    request: CloudAiModelsRequest,
) -> Result<CloudAiModelsPayload, String> {
    tauri::async_runtime::spawn_blocking(move || list_cloud_ai_models_in(&request.settings))
        .await
        .map_err(|error| format!("云端模型列表任务执行失败：{error}"))?
}
