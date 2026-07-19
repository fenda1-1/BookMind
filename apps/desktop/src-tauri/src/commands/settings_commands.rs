use crate::encryption::{
    local_encryption_status_in, rotate_local_data_key_in, set_local_master_password_in,
    verify_local_master_password_in, LocalDataKeyRotationPayload, LocalEncryptionStatusPayload,
};
use crate::models::{AppSettings, SettingsV2};
use crate::paths::app_data_dir;
use crate::settings::{
    ai_api_key_storage_status_in, load_app_settings, load_settings_v2,
    preserve_secure_app_settings, save_ai_provider_api_key, save_app_settings, save_settings_v2,
    save_translation_api_key, AiApiKeyStorageStatusPayload,
};
use crate::tasks::mark_index_manifests_stale_for_settings_change;
use std::path::Path;
use std::sync::Mutex;

static APP_SETTINGS_WRITE_LOCK: Mutex<()> = Mutex::new(());

#[tauri::command]
pub(crate) fn get_app_settings() -> Result<AppSettings, String> {
    load_app_settings(&app_data_dir()?)
}

#[tauri::command]
pub(crate) fn update_app_settings(settings: AppSettings) -> Result<AppSettings, String> {
    let _guard = APP_SETTINGS_WRITE_LOCK
        .lock()
        .map_err(|_| "设置写入锁已损坏".to_string())?;
    let data_dir = app_data_dir()?;
    let existing = load_app_settings(&data_dir)?;
    let mut next = settings;
    preserve_secure_app_settings(&existing, &mut next);
    save_app_settings(&data_dir, &next)
}

#[tauri::command]
pub(crate) fn update_ai_provider_api_key(
    provider_id: String,
    api_key: String,
) -> Result<AppSettings, String> {
    let _guard = APP_SETTINGS_WRITE_LOCK
        .lock()
        .map_err(|_| "设置写入锁已损坏".to_string())?;
    save_ai_provider_api_key(&app_data_dir()?, &provider_id, &api_key)
}

#[tauri::command]
pub(crate) fn update_translation_api_key(
    source_id: String,
    api_key: String,
) -> Result<AppSettings, String> {
    let _guard = APP_SETTINGS_WRITE_LOCK
        .lock()
        .map_err(|_| "设置写入锁已损坏".to_string())?;
    save_translation_api_key(&app_data_dir()?, &source_id, &api_key)
}

#[tauri::command]
pub(crate) fn get_settings_v2() -> Result<SettingsV2, String> {
    load_settings_v2(&app_data_dir()?)
}

#[tauri::command]
pub(crate) fn update_settings_v2(settings: SettingsV2) -> Result<SettingsV2, String> {
    update_settings_v2_in(&app_data_dir()?, settings)
}

#[tauri::command]
pub(crate) fn get_local_encryption_status() -> Result<LocalEncryptionStatusPayload, String> {
    local_encryption_status_in(&app_data_dir()?)
}

#[tauri::command]
pub(crate) fn set_local_master_password(
    password: String,
) -> Result<LocalEncryptionStatusPayload, String> {
    set_local_master_password_in(&app_data_dir()?, &password)
}

#[tauri::command]
pub(crate) fn verify_local_master_password(
    password: String,
) -> Result<LocalEncryptionStatusPayload, String> {
    verify_local_master_password_in(&app_data_dir()?, &password)
}

#[tauri::command]
pub(crate) fn rotate_local_data_key(
    master_password: Option<String>,
) -> Result<LocalDataKeyRotationPayload, String> {
    rotate_local_data_key_in(&app_data_dir()?, master_password.as_deref())
}

#[tauri::command]
pub(crate) fn get_ai_api_key_storage_status() -> Result<AiApiKeyStorageStatusPayload, String> {
    ai_api_key_storage_status_in(&app_data_dir()?)
}

pub(crate) fn update_settings_v2_in(
    data_dir: &Path,
    settings: SettingsV2,
) -> Result<SettingsV2, String> {
    let previous = load_settings_v2(data_dir)?;
    let saved = save_settings_v2(data_dir, &settings)?;
    let changed_keys = index_strategy_changed_keys(&previous, &saved);
    if !changed_keys.is_empty() {
        mark_index_manifests_stale_for_settings_change(data_dir, &changed_keys)?;
    }
    Ok(saved)
}

fn index_strategy_changed_keys(previous: &SettingsV2, next: &SettingsV2) -> Vec<&'static str> {
    let mut changed = Vec::new();
    if normalized_index_strategy_version(previous) != normalized_index_strategy_version(next) {
        changed.push("indexStrategyVersion");
    }
    if normalized_index_chunk_size(previous) != normalized_index_chunk_size(next) {
        changed.push("indexChunkSize");
    }
    if normalized_index_chunk_overlap(previous) != normalized_index_chunk_overlap(next) {
        changed.push("indexChunkOverlap");
    }
    changed
}

fn normalized_index_strategy_version(settings: &SettingsV2) -> &'static str {
    match settings
        .extended
        .get("indexStrategyVersion")
        .and_then(|value| value.as_str())
    {
        Some("latest") => "latest",
        Some("compat") => "compat",
        _ => "stable",
    }
}

fn normalized_index_chunk_size(settings: &SettingsV2) -> u64 {
    json_string_or_number_to_u64(settings.extended.get("indexChunkSize"), 1200).clamp(200, 5000)
}

fn normalized_index_chunk_overlap(settings: &SettingsV2) -> u64 {
    json_string_or_number_to_u64(settings.extended.get("indexChunkOverlap"), 120).clamp(0, 1000)
}

fn json_string_or_number_to_u64(value: Option<&serde_json::Value>, fallback: u64) -> u64 {
    match value {
        Some(serde_json::Value::String(raw)) => raw.trim().parse::<u64>().unwrap_or(fallback),
        Some(serde_json::Value::Number(number)) => number.as_u64().unwrap_or(fallback),
        _ => fallback,
    }
}
