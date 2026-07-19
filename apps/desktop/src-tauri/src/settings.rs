use crate::models::{
    AiProviderModelCapabilities, AiProviderModelSettings, AiProviderProfile, AppSettings,
    SettingsV2, TranslationSource,
};
use crate::paths::{secure_ai_key_store_path, settings_file_path, settings_v2_file_path};
use keyring::Entry;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{collections::HashMap, fs, path::Path};

const AI_KEYRING_SERVICE: &str = "BookMind";
const AI_KEYRING_USER: &str = "ai-api-key";
const AI_PROVIDER_KEYRING_USER_PREFIX: &str = "ai-api-key-provider";
const TRANSLATION_KEYRING_USER_PREFIX: &str = "translation-api-key";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SettingsFile {
    #[serde(default = "default_schema_version")]
    schema_version: u32,
    #[serde(default = "default_trash_retention_days")]
    trash_retention_days: u32,
    #[serde(default = "default_trash_auto_cleanup_enabled")]
    trash_auto_cleanup_enabled: bool,
    #[serde(default = "default_trash_protect_reading_progress")]
    trash_protect_reading_progress: bool,
    #[serde(default = "default_trash_protect_reader_assets")]
    trash_protect_reader_assets: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    ai_api_key: Option<String>,
    #[serde(default = "default_ai_api_base_url")]
    ai_api_base_url: String,
    #[serde(default = "default_ai_endpoint_mode")]
    ai_endpoint_mode: String,
    #[serde(default = "default_ai_model")]
    ai_model: String,
    #[serde(default = "default_ai_request_timeout_secs")]
    ai_request_timeout_secs: u64,
    #[serde(default = "default_ai_retry_count")]
    ai_retry_count: u32,
    #[serde(default = "default_ai_proxy_url")]
    ai_proxy_url: String,
    #[serde(default = "default_ai_custom_headers")]
    ai_custom_headers: String,
    #[serde(default = "default_ai_streaming_enabled")]
    ai_streaming_enabled: bool,
    #[serde(default = "default_ai_temperature")]
    ai_temperature: f64,
    #[serde(default = "default_ai_max_tokens")]
    ai_max_tokens: u32,
    #[serde(default = "default_ai_top_p")]
    ai_top_p: f64,
    #[serde(default = "default_ai_reasoning_effort")]
    ai_reasoning_effort: String,
    #[serde(default = "default_ai_response_format")]
    ai_response_format: String,
    #[serde(default = "default_ai_active_provider_profile_id")]
    ai_active_provider_profile_id: String,
    #[serde(default = "default_ai_provider_profiles")]
    ai_provider_profiles: Vec<AiProviderProfile>,
    #[serde(default = "default_translation_active_source_id")]
    translation_active_source_id: String,
    #[serde(default = "default_translation_sources")]
    translation_sources: Vec<TranslationSource>,
    #[serde(default = "default_translation_source_language")]
    translation_source_language: String,
    #[serde(default = "default_translation_target_language")]
    translation_target_language: String,
    #[serde(default = "default_ai_cancel_strategy")]
    ai_cancel_strategy: String,
    #[serde(default = "default_operation_log_level")]
    operation_log_level: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiApiKeyStorageStatusPayload {
    pub(crate) key_status: String,
    pub(crate) primary_store: String,
    pub(crate) keyring_available: bool,
    pub(crate) keyring_has_key: bool,
    pub(crate) fallback_file_exists: bool,
    pub(crate) fallback_file_has_key: bool,
    pub(crate) fallback_file_path: String,
}

pub(crate) fn load_app_settings(data_dir: &Path) -> Result<AppSettings, String> {
    let path = settings_file_path(data_dir);
    if !path.exists() {
        let mut settings = AppSettings::default();
        settings.ai_api_key = load_secure_ai_api_key(data_dir)?;
        hydrate_provider_api_keys(data_dir, &mut settings)?;
        hydrate_translation_api_keys(data_dir, &mut settings)?;
        return Ok(settings);
    }
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取设置 {}: {error}", path.display()))?;
    let needs_schema_migration = !raw.contains("\"schemaVersion\"");
    let mut settings_file: SettingsFile = serde_json::from_str(&raw)
        .map_err(|error| format!("无法解析设置 {}: {error}", path.display()))?;
    let plaintext_key = settings_file.ai_api_key.take().unwrap_or_default();
    if !plaintext_key.trim().is_empty() {
        save_secure_ai_api_key(data_dir, &plaintext_key)?;
    }
    let mut settings = settings_from_file(settings_file);
    settings.ai_api_key = load_secure_ai_api_key(data_dir)?;
    let original_file = raw;
    normalize_app_settings(&mut settings);
    hydrate_provider_api_keys(data_dir, &mut settings)?;
    hydrate_translation_api_keys(data_dir, &mut settings)?;
    let next_raw = serialize_plain_settings(&settings)?;
    if needs_schema_migration || next_raw != original_file {
        save_app_settings(data_dir, &settings)?;
    }
    Ok(settings)
}

pub(crate) fn save_app_settings(
    data_dir: &Path,
    settings: &AppSettings,
) -> Result<AppSettings, String> {
    let mut normalized = settings.clone();
    normalize_app_settings(&mut normalized);
    let path = settings_file_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建设置目录 {}: {error}", parent.display()))?;
    }
    save_secure_ai_api_key(data_dir, &normalized.ai_api_key)?;
    save_provider_api_keys(data_dir, &normalized)?;
    save_translation_api_keys(data_dir, &normalized)?;
    let raw = serialize_plain_settings(&normalized)?;
    fs::write(&path, raw).map_err(|error| format!("无法写入设置 {}: {error}", path.display()))?;
    Ok(normalized)
}

pub(crate) fn preserve_secure_app_settings(existing: &AppSettings, next: &mut AppSettings) {
    for profile in &mut next.ai_provider_profiles {
        if let Some(saved) = existing
            .ai_provider_profiles
            .iter()
            .find(|candidate| same_ai_credential_owner(candidate, profile))
        {
            profile.api_key = saved.api_key.clone();
        } else {
            profile.api_key.clear();
        }
    }
    for source in &mut next.translation_sources {
        if !is_translation_api_source(&source.kind) {
            source.api_key.clear();
            continue;
        }
        if let Some(saved) = existing.translation_sources.iter().find(|candidate| {
            same_translation_credential_owner(candidate, source)
                && is_translation_api_source(&candidate.kind)
        }) {
            source.api_key = saved.api_key.clone();
        } else {
            source.api_key.clear();
        }
    }
    next.ai_api_key = next
        .ai_provider_profiles
        .iter()
        .find(|profile| profile.id == next.ai_active_provider_profile_id)
        .map(|profile| profile.api_key.clone())
        .unwrap_or_default();
}

fn same_ai_credential_owner(existing: &AiProviderProfile, next: &AiProviderProfile) -> bool {
    existing.id == next.id
        && existing.kind == next.kind
        && normalize_credential_endpoint(&existing.api_base_url)
            == normalize_credential_endpoint(&next.api_base_url)
}

fn same_translation_credential_owner(
    existing: &TranslationSource,
    next: &TranslationSource,
) -> bool {
    existing.id == next.id
        && existing.kind == next.kind
        && normalize_credential_endpoint(&existing.api_base_url)
            == normalize_credential_endpoint(&next.api_base_url)
        && existing.app_id.trim() == next.app_id.trim()
        && existing.region.trim() == next.region.trim()
}

fn normalize_credential_endpoint(value: &str) -> &str {
    value.trim().trim_end_matches('/')
}

pub(crate) fn save_ai_provider_api_key(
    data_dir: &Path,
    provider_id: &str,
    api_key: &str,
) -> Result<AppSettings, String> {
    let mut settings = load_app_settings(data_dir)?;
    let profile = settings
        .ai_provider_profiles
        .iter_mut()
        .find(|profile| profile.id == provider_id)
        .ok_or_else(|| format!("AI Provider 不存在: {provider_id}"))?;
    profile.api_key = api_key.trim().to_string();
    if settings.ai_active_provider_profile_id == provider_id {
        settings.ai_api_key = profile.api_key.clone();
    }
    save_app_settings(data_dir, &settings)
}

pub(crate) fn save_translation_api_key(
    data_dir: &Path,
    source_id: &str,
    api_key: &str,
) -> Result<AppSettings, String> {
    let mut settings = load_app_settings(data_dir)?;
    let source = settings
        .translation_sources
        .iter_mut()
        .find(|source| source.id == source_id && is_translation_api_source(&source.kind))
        .ok_or_else(|| format!("翻译 API 源不存在: {source_id}"))?;
    source.api_key = api_key.trim().to_string();
    save_app_settings(data_dir, &settings)
}

pub(crate) fn load_settings_v2(data_dir: &Path) -> Result<SettingsV2, String> {
    let path = settings_v2_file_path(data_dir);
    if !path.exists() {
        return Ok(SettingsV2::default());
    }
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取统一设置 {}: {error}", path.display()))?;
    let mut settings: SettingsV2 = serde_json::from_str(&raw)
        .map_err(|error| format!("无法解析统一设置 {}: {error}", path.display()))?;
    normalize_settings_v2(&mut settings);
    let next_raw = serde_json::to_string_pretty(&settings)
        .map_err(|error| format!("无法序列化统一设置: {error}"))?;
    if next_raw != raw {
        fs::write(&path, next_raw)
            .map_err(|error| format!("无法迁移统一设置 {}: {error}", path.display()))?;
    }
    Ok(settings)
}

pub(crate) fn save_settings_v2(
    data_dir: &Path,
    settings: &SettingsV2,
) -> Result<SettingsV2, String> {
    let mut normalized = settings.clone();
    normalize_settings_v2(&mut normalized);
    let path = settings_v2_file_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建统一设置目录 {}: {error}", parent.display()))?;
    }
    let raw = serde_json::to_string_pretty(&normalized)
        .map_err(|error| format!("无法序列化统一设置: {error}"))?;
    fs::write(&path, raw)
        .map_err(|error| format!("无法写入统一设置 {}: {error}", path.display()))?;
    Ok(normalized)
}

fn settings_from_file(settings_file: SettingsFile) -> AppSettings {
    AppSettings {
        schema_version: settings_file.schema_version,
        trash_retention_days: settings_file.trash_retention_days,
        trash_auto_cleanup_enabled: settings_file.trash_auto_cleanup_enabled,
        trash_protect_reading_progress: settings_file.trash_protect_reading_progress,
        trash_protect_reader_assets: settings_file.trash_protect_reader_assets,
        ai_api_key: String::new(),
        ai_api_base_url: settings_file.ai_api_base_url,
        ai_endpoint_mode: settings_file.ai_endpoint_mode,
        ai_model: settings_file.ai_model,
        ai_request_timeout_secs: settings_file.ai_request_timeout_secs,
        ai_retry_count: settings_file.ai_retry_count,
        ai_proxy_url: settings_file.ai_proxy_url,
        ai_custom_headers: settings_file.ai_custom_headers,
        ai_streaming_enabled: settings_file.ai_streaming_enabled,
        ai_temperature: settings_file.ai_temperature,
        ai_max_tokens: settings_file.ai_max_tokens,
        ai_top_p: settings_file.ai_top_p,
        ai_reasoning_effort: settings_file.ai_reasoning_effort,
        ai_response_format: settings_file.ai_response_format,
        ai_active_provider_profile_id: settings_file.ai_active_provider_profile_id,
        ai_provider_profiles: settings_file.ai_provider_profiles,
        translation_active_source_id: settings_file.translation_active_source_id,
        translation_sources: settings_file.translation_sources,
        translation_source_language: settings_file.translation_source_language,
        translation_target_language: settings_file.translation_target_language,
        ai_cancel_strategy: settings_file.ai_cancel_strategy,
        operation_log_level: settings_file.operation_log_level,
    }
}

fn serialize_plain_settings(settings: &AppSettings) -> Result<String, String> {
    let mut plain_provider_profiles = settings.ai_provider_profiles.clone();
    for profile in &mut plain_provider_profiles {
        profile.api_key.clear();
    }
    let mut plain_translation_sources = settings.translation_sources.clone();
    for source in &mut plain_translation_sources {
        source.api_key.clear();
    }
    let settings_file = SettingsFile {
        schema_version: settings.schema_version,
        trash_retention_days: settings.trash_retention_days,
        trash_auto_cleanup_enabled: settings.trash_auto_cleanup_enabled,
        trash_protect_reading_progress: settings.trash_protect_reading_progress,
        trash_protect_reader_assets: settings.trash_protect_reader_assets,
        ai_api_key: None,
        ai_api_base_url: settings.ai_api_base_url.clone(),
        ai_endpoint_mode: settings.ai_endpoint_mode.clone(),
        ai_model: settings.ai_model.clone(),
        ai_request_timeout_secs: settings.ai_request_timeout_secs,
        ai_retry_count: settings.ai_retry_count,
        ai_proxy_url: settings.ai_proxy_url.clone(),
        ai_custom_headers: settings.ai_custom_headers.clone(),
        ai_streaming_enabled: settings.ai_streaming_enabled,
        ai_temperature: settings.ai_temperature,
        ai_max_tokens: settings.ai_max_tokens,
        ai_top_p: settings.ai_top_p,
        ai_reasoning_effort: settings.ai_reasoning_effort.clone(),
        ai_response_format: settings.ai_response_format.clone(),
        ai_active_provider_profile_id: settings.ai_active_provider_profile_id.clone(),
        ai_provider_profiles: plain_provider_profiles,
        translation_active_source_id: settings.translation_active_source_id.clone(),
        translation_sources: plain_translation_sources,
        translation_source_language: settings.translation_source_language.clone(),
        translation_target_language: settings.translation_target_language.clone(),
        ai_cancel_strategy: settings.ai_cancel_strategy.clone(),
        operation_log_level: settings.operation_log_level.clone(),
    };
    serde_json::to_string_pretty(&settings_file).map_err(|error| format!("无法序列化设置: {error}"))
}

fn load_secure_ai_api_key(data_dir: &Path) -> Result<String, String> {
    if let Ok(Some(key)) = load_ai_api_key_from_keyring() {
        if !key.is_empty() {
            return Ok(key);
        }
    }
    load_ai_api_key_from_secure_file(data_dir)
}

fn hydrate_provider_api_keys(data_dir: &Path, settings: &mut AppSettings) -> Result<(), String> {
    let legacy_global_key = settings.ai_api_key.clone();
    let active_id = settings.ai_active_provider_profile_id.clone();
    for profile in &mut settings.ai_provider_profiles {
        profile.api_key = load_secure_ai_provider_api_key(data_dir, &profile.id)?;
    }
    if !legacy_global_key.is_empty() {
        if let Some(active_profile) = settings
            .ai_provider_profiles
            .iter_mut()
            .find(|profile| profile.id == active_id)
        {
            if active_profile.api_key.is_empty() {
                active_profile.api_key = legacy_global_key;
                save_secure_ai_provider_api_key(
                    data_dir,
                    &active_profile.id,
                    &active_profile.api_key,
                )?;
            }
        }
    }
    if let Some(active_profile) = settings
        .ai_provider_profiles
        .iter()
        .find(|profile| profile.id == active_id)
    {
        settings.ai_api_key = active_profile.api_key.clone();
    }
    Ok(())
}

fn save_provider_api_keys(data_dir: &Path, settings: &AppSettings) -> Result<(), String> {
    for profile in &settings.ai_provider_profiles {
        save_secure_ai_provider_api_key(data_dir, &profile.id, &profile.api_key)?;
    }
    Ok(())
}

fn hydrate_translation_api_keys(data_dir: &Path, settings: &mut AppSettings) -> Result<(), String> {
    for source in &mut settings.translation_sources {
        if is_translation_api_source(&source.kind) {
            source.api_key = load_secure_translation_api_key(data_dir, &source.id)?;
        } else {
            source.api_key.clear();
        }
    }
    Ok(())
}

fn save_translation_api_keys(data_dir: &Path, settings: &AppSettings) -> Result<(), String> {
    for source in &settings.translation_sources {
        if is_translation_api_source(&source.kind) {
            save_secure_translation_api_key(data_dir, &source.id, &source.api_key)?;
        }
    }
    Ok(())
}

fn load_secure_ai_provider_api_key(data_dir: &Path, provider_id: &str) -> Result<String, String> {
    if let Ok(Some(key)) = load_ai_provider_api_key_from_keyring(provider_id) {
        if !key.is_empty() {
            return Ok(key);
        }
    }
    load_ai_provider_api_key_from_secure_file(data_dir, provider_id)
}

fn save_secure_ai_provider_api_key(
    data_dir: &Path,
    provider_id: &str,
    key: &str,
) -> Result<(), String> {
    let normalized_key = key.trim();
    let _stored_in_keyring = save_ai_provider_api_key_to_keyring(provider_id, normalized_key);
    save_ai_provider_api_key_to_secure_file(data_dir, provider_id, normalized_key)
}

fn load_secure_translation_api_key(data_dir: &Path, source_id: &str) -> Result<String, String> {
    if let Ok(Some(key)) = load_translation_api_key_from_keyring(source_id) {
        if !key.is_empty() {
            return Ok(key);
        }
    }
    load_translation_api_key_from_secure_file(data_dir, source_id)
}

fn save_secure_translation_api_key(
    data_dir: &Path,
    source_id: &str,
    key: &str,
) -> Result<(), String> {
    let normalized_key = key.trim();
    let _stored_in_keyring = save_translation_api_key_to_keyring(source_id, normalized_key);
    save_translation_api_key_to_secure_file(data_dir, source_id, normalized_key)
}

fn save_secure_ai_api_key(data_dir: &Path, key: &str) -> Result<(), String> {
    let normalized_key = key.trim();
    let _stored_in_keyring = save_ai_api_key_to_keyring(normalized_key);
    save_ai_api_key_to_secure_file(data_dir, normalized_key)
}

pub(crate) fn ai_api_key_storage_status_in(
    data_dir: &Path,
) -> Result<AiApiKeyStorageStatusPayload, String> {
    let keyring_status = inspect_ai_api_key_keyring();
    let fallback_path = secure_ai_key_store_path(data_dir);
    let fallback_status = inspect_ai_api_key_secure_file(&fallback_path);
    let primary_store = if keyring_status.has_key {
        "keyring"
    } else if fallback_status.has_key {
        "fallbackFile"
    } else {
        "none"
    };
    let key_status = if keyring_status.has_key || fallback_status.has_key {
        "saved"
    } else if keyring_status.has_error || fallback_status.has_error {
        "error"
    } else {
        "missing"
    };

    Ok(AiApiKeyStorageStatusPayload {
        key_status: key_status.to_string(),
        primary_store: primary_store.to_string(),
        keyring_available: keyring_status.available,
        keyring_has_key: keyring_status.has_key,
        fallback_file_exists: fallback_status.exists,
        fallback_file_has_key: fallback_status.has_key,
        fallback_file_path: fallback_path.display().to_string(),
    })
}

#[derive(Clone, Copy, Debug, Default)]
struct AiApiKeyStoreProbe {
    available: bool,
    exists: bool,
    has_key: bool,
    has_error: bool,
}

fn inspect_ai_api_key_keyring() -> AiApiKeyStoreProbe {
    let Ok(entry) = keyring_entry() else {
        return AiApiKeyStoreProbe {
            has_error: true,
            ..Default::default()
        };
    };
    match entry.get_password() {
        Ok(value) => AiApiKeyStoreProbe {
            available: true,
            has_key: !value.trim().is_empty(),
            has_error: value.trim().is_empty(),
            ..Default::default()
        },
        Err(keyring::Error::NoEntry) => AiApiKeyStoreProbe {
            available: true,
            ..Default::default()
        },
        Err(_) => AiApiKeyStoreProbe {
            has_error: true,
            ..Default::default()
        },
    }
}

fn inspect_ai_api_key_secure_file(path: &Path) -> AiApiKeyStoreProbe {
    if !path.exists() {
        return AiApiKeyStoreProbe::default();
    }
    let Ok(raw) = fs::read_to_string(path) else {
        return AiApiKeyStoreProbe {
            exists: true,
            has_error: true,
            ..Default::default()
        };
    };
    AiApiKeyStoreProbe {
        exists: true,
        has_key: !raw.trim().is_empty(),
        has_error: raw.trim().is_empty(),
        ..Default::default()
    }
}

fn keyring_entry() -> Result<Entry, String> {
    Entry::new(AI_KEYRING_SERVICE, AI_KEYRING_USER)
        .map_err(|error| format!("无法打开系统安全存储: {error}"))
}

fn provider_keyring_entry(provider_id: &str) -> Result<Entry, String> {
    Entry::new(
        AI_KEYRING_SERVICE,
        &format!(
            "{AI_PROVIDER_KEYRING_USER_PREFIX}:{}",
            secure_provider_key_id(provider_id)
        ),
    )
    .map_err(|error| format!("无法打开 Provider 系统安全存储: {error}"))
}

fn translation_keyring_entry(source_id: &str) -> Result<Entry, String> {
    Entry::new(
        AI_KEYRING_SERVICE,
        &format!(
            "{TRANSLATION_KEYRING_USER_PREFIX}:{}",
            secure_provider_key_id(source_id)
        ),
    )
    .map_err(|error| format!("无法打开翻译源系统安全存储: {error}"))
}

fn load_ai_api_key_from_keyring() -> Result<Option<String>, String> {
    let entry = keyring_entry()?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value.trim().to_string())),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Ok(None),
    }
}

fn save_ai_api_key_to_keyring(key: &str) -> bool {
    let Ok(entry) = keyring_entry() else {
        return false;
    };
    if key.is_empty() {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => true,
            Err(_) => false,
        }
    } else {
        entry.set_password(key).is_ok()
    }
}

fn load_ai_provider_api_key_from_keyring(provider_id: &str) -> Result<Option<String>, String> {
    let entry = provider_keyring_entry(provider_id)?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value.trim().to_string())),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Ok(None),
    }
}

fn save_ai_provider_api_key_to_keyring(provider_id: &str, key: &str) -> bool {
    let Ok(entry) = provider_keyring_entry(provider_id) else {
        return false;
    };
    if key.is_empty() {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => true,
            Err(_) => false,
        }
    } else {
        entry.set_password(key).is_ok()
    }
}

fn load_translation_api_key_from_keyring(source_id: &str) -> Result<Option<String>, String> {
    let entry = translation_keyring_entry(source_id)?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value.trim().to_string())),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Ok(None),
    }
}

fn save_translation_api_key_to_keyring(source_id: &str, key: &str) -> bool {
    let Ok(entry) = translation_keyring_entry(source_id) else {
        return false;
    };
    if key.is_empty() {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => true,
            Err(_) => false,
        }
    } else {
        entry.set_password(key).is_ok()
    }
}

fn load_ai_api_key_from_secure_file(data_dir: &Path) -> Result<String, String> {
    let path = secure_ai_key_store_path(data_dir);
    if !path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(&path)
        .map(|value| value.trim().to_string())
        .map_err(|error| format!("无法读取安全密钥存储 {}: {error}", path.display()))
}

fn save_ai_api_key_to_secure_file(data_dir: &Path, key: &str) -> Result<(), String> {
    let path = secure_ai_key_store_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建设置目录 {}: {error}", parent.display()))?;
    }
    if key.is_empty() {
        if path.exists() {
            fs::remove_file(&path)
                .map_err(|error| format!("无法清除安全密钥存储 {}: {error}", path.display()))?;
        }
        return Ok(());
    }
    fs::write(&path, key)
        .map_err(|error| format!("无法写入安全密钥存储 {}: {error}", path.display()))?;
    restrict_secure_file_permissions(&path)
}

fn ai_provider_key_store_path(data_dir: &Path, provider_id: &str) -> std::path::PathBuf {
    let file_name = format!("ai-api-key.{}.secure", secure_provider_key_id(provider_id));
    data_dir.join("settings").join("providers").join(file_name)
}

fn load_ai_provider_api_key_from_secure_file(
    data_dir: &Path,
    provider_id: &str,
) -> Result<String, String> {
    let path = ai_provider_key_store_path(data_dir, provider_id);
    load_provider_key_with_legacy_migration(
        &path,
        &legacy_ai_provider_key_store_path(data_dir, provider_id),
        "Provider",
    )
}

fn save_ai_provider_api_key_to_secure_file(
    data_dir: &Path,
    provider_id: &str,
    key: &str,
) -> Result<(), String> {
    let path = ai_provider_key_store_path(data_dir, provider_id);
    let legacy_path = legacy_ai_provider_key_store_path(data_dir, provider_id);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建 Provider 密钥目录 {}: {error}", parent.display()))?;
    }
    if key.is_empty() {
        if path.exists() {
            fs::remove_file(&path).map_err(|error| {
                format!("无法清除 Provider 安全密钥存储 {}: {error}", path.display())
            })?;
        }
        remove_legacy_provider_key_file(&legacy_path, "Provider")?;
        return Ok(());
    }
    fs::write(&path, key)
        .map_err(|error| format!("无法写入 Provider 安全密钥存储 {}: {error}", path.display()))?;
    restrict_secure_file_permissions(&path)?;
    remove_legacy_provider_key_file(&legacy_path, "Provider")
}

fn translation_key_store_path(data_dir: &Path, source_id: &str) -> std::path::PathBuf {
    let file_name = format!(
        "translation-api-key.{}.secure",
        secure_provider_key_id(source_id)
    );
    data_dir.join("settings").join("providers").join(file_name)
}

fn load_translation_api_key_from_secure_file(
    data_dir: &Path,
    source_id: &str,
) -> Result<String, String> {
    let path = translation_key_store_path(data_dir, source_id);
    let legacy_path = legacy_translation_key_store_path(data_dir, source_id);
    load_provider_key_with_legacy_migration(&path, &legacy_path, "翻译源")
}

fn save_translation_api_key_to_secure_file(
    data_dir: &Path,
    source_id: &str,
    key: &str,
) -> Result<(), String> {
    let path = translation_key_store_path(data_dir, source_id);
    let legacy_path = legacy_translation_key_store_path(data_dir, source_id);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建翻译源密钥目录 {}: {error}", parent.display()))?;
    }
    if key.is_empty() {
        if path.exists() {
            fs::remove_file(&path).map_err(|error| {
                format!("无法清除翻译源安全密钥存储 {}: {error}", path.display())
            })?;
        }
        remove_legacy_provider_key_file(&legacy_path, "翻译源")?;
        return Ok(());
    }
    fs::write(&path, key)
        .map_err(|error| format!("无法写入翻译源安全密钥存储 {}: {error}", path.display()))?;
    restrict_secure_file_permissions(&path)?;
    remove_legacy_provider_key_file(&legacy_path, "翻译源")
}

fn secure_provider_key_id(provider_id: &str) -> String {
    let normalized = provider_id.trim();
    if normalized.is_empty() {
        return "default".to_string();
    }
    format!("{:x}", Sha256::digest(normalized.as_bytes()))
}

fn legacy_ai_provider_key_store_path(data_dir: &Path, provider_id: &str) -> std::path::PathBuf {
    let file_name = format!(
        "ai-api-key.{}.secure",
        legacy_normalize_provider_key_id(provider_id)
    );
    data_dir.join("settings").join("providers").join(file_name)
}

fn legacy_translation_key_store_path(data_dir: &Path, source_id: &str) -> std::path::PathBuf {
    let file_name = format!(
        "translation-api-key.{}.secure",
        legacy_normalize_provider_key_id(source_id)
    );
    data_dir.join("settings").join("providers").join(file_name)
}

fn load_provider_key_with_legacy_migration(
    path: &Path,
    legacy_path: &Path,
    owner_label: &str,
) -> Result<String, String> {
    if path.exists() {
        return fs::read_to_string(path)
            .map(|value| value.trim().to_string())
            .map_err(|error| {
                format!(
                    "无法读取 {owner_label} 安全密钥存储 {}: {error}",
                    path.display()
                )
            });
    }
    if !legacy_path.exists() {
        return Ok(String::new());
    }
    let value = fs::read_to_string(legacy_path)
        .map(|value| value.trim().to_string())
        .map_err(|error| {
            format!(
                "无法读取旧版 {owner_label} 安全密钥存储 {}: {error}",
                legacy_path.display()
            )
        })?;
    if value.is_empty() {
        fs::remove_file(legacy_path).map_err(|error| {
            format!(
                "无法清理旧版 {owner_label} 安全密钥存储 {}: {error}",
                legacy_path.display()
            )
        })?;
        return Ok(value);
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "无法创建 {owner_label} 密钥目录 {}: {error}",
                parent.display()
            )
        })?;
    }
    fs::write(path, &value).map_err(|error| {
        format!(
            "无法迁移 {owner_label} 安全密钥存储 {}: {error}",
            path.display()
        )
    })?;
    restrict_secure_file_permissions(path)?;
    fs::remove_file(legacy_path).map_err(|error| {
        format!(
            "无法清理旧版 {owner_label} 安全密钥存储 {}: {error}",
            legacy_path.display()
        )
    })?;
    Ok(value)
}

fn remove_legacy_provider_key_file(path: &Path, owner_label: &str) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    fs::remove_file(path).map_err(|error| {
        format!(
            "无法清理旧版 {owner_label} 安全密钥存储 {}: {error}",
            path.display()
        )
    })
}

fn legacy_normalize_provider_key_id(provider_id: &str) -> String {
    let normalized = provider_id
        .trim()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();
    if normalized.is_empty() {
        "default".to_string()
    } else {
        normalized
    }
}

#[cfg(unix)]
fn restrict_secure_file_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let permissions = fs::Permissions::from_mode(0o600);
    fs::set_permissions(path, permissions)
        .map_err(|error| format!("无法限制安全密钥存储权限 {}: {error}", path.display()))
}

#[cfg(not(unix))]
fn restrict_secure_file_permissions(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn normalize_app_settings(settings: &mut AppSettings) {
    settings.schema_version = 1;
    settings.trash_retention_days = normalize_trash_retention_days(settings.trash_retention_days);
    settings.ai_api_key = settings.ai_api_key.trim().to_string();
    settings.ai_api_base_url = normalize_ai_api_base_url(&settings.ai_api_base_url);
    settings.ai_endpoint_mode = normalize_ai_endpoint_mode(&settings.ai_endpoint_mode);
    settings.ai_model = normalize_ai_model(&settings.ai_model);
    settings.ai_request_timeout_secs = settings.ai_request_timeout_secs.clamp(5, 600);
    settings.ai_retry_count = settings.ai_retry_count.min(5);
    settings.ai_proxy_url = normalize_ai_proxy_url(&settings.ai_proxy_url);
    settings.ai_custom_headers = normalize_ai_custom_headers(&settings.ai_custom_headers);
    settings.ai_temperature =
        normalize_ai_float(settings.ai_temperature, default_ai_temperature(), 0.0, 2.0);
    settings.ai_max_tokens = settings.ai_max_tokens.min(200_000);
    settings.ai_top_p = normalize_ai_float(settings.ai_top_p, default_ai_top_p(), 0.0, 1.0);
    settings.ai_reasoning_effort = normalize_ai_reasoning_effort(&settings.ai_reasoning_effort);
    settings.ai_response_format = normalize_ai_response_format(&settings.ai_response_format);
    normalize_ai_provider_profiles(settings);
    normalize_translation_sources(settings);
    settings.ai_cancel_strategy = normalize_ai_cancel_strategy(&settings.ai_cancel_strategy);
    settings.operation_log_level = normalize_operation_log_level(&settings.operation_log_level);
}

fn normalize_settings_v2(settings: &mut SettingsV2) {
    settings.settings_schema_version = 2;
    if !settings.global.is_object() {
        settings.global = serde_json::json!({});
    }
    if !settings.reader.is_object() {
        settings.reader = serde_json::json!({});
    }
    if !settings.extended.is_object() {
        settings.extended = serde_json::json!({});
    }
}

fn default_schema_version() -> u32 {
    1
}

fn default_trash_retention_days() -> u32 {
    3
}

fn default_trash_auto_cleanup_enabled() -> bool {
    true
}

fn default_trash_protect_reading_progress() -> bool {
    true
}

fn default_trash_protect_reader_assets() -> bool {
    true
}

fn default_operation_log_level() -> String {
    "none".to_string()
}

fn default_ai_api_base_url() -> String {
    "https://api.openai.com/v1".to_string()
}

fn default_ai_endpoint_mode() -> String {
    "responses".to_string()
}

fn default_ai_model() -> String {
    "gpt-4.1-mini".to_string()
}

fn default_ai_request_timeout_secs() -> u64 {
    120
}

fn default_ai_retry_count() -> u32 {
    1
}

fn default_ai_proxy_url() -> String {
    String::new()
}

fn default_ai_custom_headers() -> String {
    String::new()
}

fn default_ai_streaming_enabled() -> bool {
    true
}

fn default_ai_temperature() -> f64 {
    0.2
}

fn default_ai_max_tokens() -> u32 {
    0
}

fn default_ai_top_p() -> f64 {
    1.0
}

fn default_ai_reasoning_effort() -> String {
    "none".to_string()
}

fn default_ai_response_format() -> String {
    "auto".to_string()
}

fn default_ai_provider_kind() -> String {
    "openai".to_string()
}

fn default_ai_provider_enabled() -> bool {
    true
}

fn default_ai_active_provider_profile_id() -> String {
    "openai-default".to_string()
}

fn default_ai_provider_profiles() -> Vec<AiProviderProfile> {
    let model = default_ai_model();
    vec![AiProviderProfile {
        id: default_ai_active_provider_profile_id(),
        name: "OpenAI 默认".to_string(),
        kind: default_ai_provider_kind(),
        enabled: default_ai_provider_enabled(),
        api_key: String::new(),
        api_base_url: default_ai_api_base_url(),
        endpoint_mode: default_ai_endpoint_mode(),
        model: model.clone(),
        models: vec![model.clone()],
        model_settings: default_ai_provider_model_settings_map(&model),
        proxy_url: default_ai_proxy_url(),
        custom_headers: default_ai_custom_headers(),
        streaming_enabled: default_ai_streaming_enabled(),
        request_timeout_secs: default_ai_request_timeout_secs(),
        retry_count: default_ai_retry_count(),
        temperature: default_ai_temperature(),
        max_tokens: default_ai_max_tokens(),
        top_p: default_ai_top_p(),
        reasoning_effort: default_ai_reasoning_effort(),
        response_format: default_ai_response_format(),
    }]
}

fn default_translation_active_source_id() -> String {
    "translation-ai-default".to_string()
}

fn default_translation_sources() -> Vec<TranslationSource> {
    vec![TranslationSource {
        id: default_translation_active_source_id(),
        name: "AI Translation".to_string(),
        kind: "ai-model".to_string(),
        enabled: true,
        provider_id: default_ai_active_provider_profile_id(),
        model: default_ai_model(),
        api_base_url: String::new(),
        api_key: String::new(),
        app_id: String::new(),
        region: String::new(),
        request_timeout_secs: default_ai_request_timeout_secs(),
    }]
}

fn default_translation_source_language() -> String {
    "auto".to_string()
}

fn default_translation_target_language() -> String {
    "zh-CN".to_string()
}

fn default_ai_cancel_strategy() -> String {
    "abort-and-save-stopped".to_string()
}

fn normalize_trash_retention_days(days: u32) -> u32 {
    days.clamp(1, 30)
}

fn normalize_ai_api_base_url(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        "https://api.openai.com/v1".to_string()
    } else {
        trimmed.to_string()
    }
}

fn normalize_ai_endpoint_mode(value: &str) -> String {
    match value {
        "chat.completions" => "chat.completions".to_string(),
        _ => "responses".to_string(),
    }
}

fn normalize_ai_model(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        "gpt-4.1-mini".to_string()
    } else {
        trimmed.to_string()
    }
}

fn normalize_ai_proxy_url(value: &str) -> String {
    value.trim().to_string()
}

fn normalize_ai_custom_headers(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let Ok(Value::Object(object)) = serde_json::from_str::<Value>(trimmed) else {
        return if contains_sensitive_ai_header_text(trimmed) {
            String::new()
        } else {
            trimmed.to_string()
        };
    };
    let mut sanitized = serde_json::Map::new();
    for (name, header_value) in object {
        let header_name = name.trim();
        if header_name.is_empty() || is_protected_ai_custom_header(header_name) {
            continue;
        }
        match header_value {
            Value::String(text) => {
                let normalized = text.trim();
                if !normalized.is_empty() {
                    sanitized.insert(
                        header_name.to_string(),
                        Value::String(normalized.to_string()),
                    );
                }
            }
            Value::Number(_) | Value::Bool(_) => {
                sanitized.insert(header_name.to_string(), header_value);
            }
            _ => {}
        }
    }
    if sanitized.is_empty() {
        return String::new();
    }
    serde_json::to_string(&Value::Object(sanitized)).unwrap_or_else(|_| trimmed.to_string())
}

fn is_protected_ai_custom_header(name: &str) -> bool {
    matches!(
        name.trim().to_ascii_lowercase().as_str(),
        "authorization"
            | "proxy-authorization"
            | "bearer"
            | "api-key"
            | "x-api-key"
            | "cookie"
            | "set-cookie"
    )
}

fn contains_sensitive_ai_header_text(value: &str) -> bool {
    let normalized = value.to_ascii_lowercase();
    normalized.contains("authorization")
        || normalized.contains("proxy-authorization")
        || normalized.contains("x-api-key")
        || normalized.contains("api-key")
        || normalized.contains("cookie")
        || normalized.contains("bearer")
}

fn normalize_ai_float(value: f64, fallback: f64, min: f64, max: f64) -> f64 {
    if value.is_finite() {
        value.clamp(min, max)
    } else {
        fallback
    }
}

pub(crate) fn normalize_ai_reasoning_effort(value: &str) -> String {
    let normalized = value.trim();
    if normalized.is_empty() || normalized.eq_ignore_ascii_case("none") {
        return "none".to_string();
    }
    if normalized.len() <= 48
        && normalized.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
        })
    {
        return normalized.to_string();
    }
    "none".to_string()
}

fn normalize_ai_response_format(value: &str) -> String {
    match value.trim() {
        "json_object" => "json_object",
        "json_schema" => "json_schema",
        _ => "auto",
    }
    .to_string()
}

fn normalize_ai_provider_profiles(settings: &mut AppSettings) {
    if settings.ai_provider_profiles.is_empty() {
        settings.ai_provider_profiles = vec![AiProviderProfile {
            id: default_ai_active_provider_profile_id(),
            name: "OpenAI 默认".to_string(),
            kind: infer_ai_provider_kind(&settings.ai_api_base_url),
            enabled: true,
            api_key: settings.ai_api_key.clone(),
            api_base_url: settings.ai_api_base_url.clone(),
            endpoint_mode: settings.ai_endpoint_mode.clone(),
            model: settings.ai_model.clone(),
            models: vec![settings.ai_model.clone()],
            model_settings: default_ai_provider_model_settings_map(&settings.ai_model),
            proxy_url: settings.ai_proxy_url.clone(),
            custom_headers: settings.ai_custom_headers.clone(),
            streaming_enabled: settings.ai_streaming_enabled,
            request_timeout_secs: settings.ai_request_timeout_secs,
            retry_count: settings.ai_retry_count,
            temperature: settings.ai_temperature,
            max_tokens: settings.ai_max_tokens,
            top_p: settings.ai_top_p,
            reasoning_effort: settings.ai_reasoning_effort.clone(),
            response_format: settings.ai_response_format.clone(),
        }];
    }

    for (index, profile) in settings.ai_provider_profiles.iter_mut().enumerate() {
        profile.id = normalize_ai_provider_id(&profile.id, index);
        profile.name = normalize_ai_provider_name(&profile.name, index);
        profile.kind = normalize_ai_provider_kind(&profile.kind);
        profile.api_key = profile.api_key.trim().to_string();
        profile.api_base_url = normalize_ai_provider_api_base_url(&profile.api_base_url);
        profile.endpoint_mode = normalize_ai_endpoint_mode(&profile.endpoint_mode);
        profile.model = normalize_ai_provider_edit_text(&profile.model);
        profile.models = normalize_ai_provider_models(&profile.model, &profile.models);
        profile.model_settings =
            normalize_ai_provider_model_settings_map(&profile.models, &profile.model_settings);
        profile.proxy_url = normalize_ai_proxy_url(&profile.proxy_url);
        profile.custom_headers = normalize_ai_custom_headers(&profile.custom_headers);
        profile.request_timeout_secs = profile.request_timeout_secs.clamp(5, 600);
        profile.retry_count = profile.retry_count.min(5);
        profile.temperature =
            normalize_ai_float(profile.temperature, default_ai_temperature(), 0.0, 2.0);
        profile.max_tokens = profile.max_tokens.min(200_000);
        profile.top_p = normalize_ai_float(profile.top_p, default_ai_top_p(), 0.0, 1.0);
        profile.reasoning_effort = normalize_ai_reasoning_effort(&profile.reasoning_effort);
        profile.response_format = normalize_ai_response_format(&profile.response_format);
    }

    let active_id = settings.ai_active_provider_profile_id.trim();
    let active_exists = settings
        .ai_provider_profiles
        .iter()
        .any(|profile| profile.id == active_id);
    settings.ai_active_provider_profile_id = if active_exists {
        active_id.to_string()
    } else {
        settings
            .ai_provider_profiles
            .first()
            .map(|profile| profile.id.clone())
            .unwrap_or_else(default_ai_active_provider_profile_id)
    };
}

fn normalize_translation_sources(settings: &mut AppSettings) {
    for (index, source) in settings.translation_sources.iter_mut().enumerate() {
        source.id = if source.id.trim().is_empty() {
            format!("translation-source-{}", index + 1)
        } else {
            source.id.trim().to_string()
        };
        source.name = if source.name.trim().is_empty() {
            format!("Translation Source {}", index + 1)
        } else {
            source.name.trim().to_string()
        };
        source.kind = match source.kind.trim() {
            "libretranslate" => "libretranslate",
            "baidu-translate" => "baidu-translate",
            "google-translate" => "google-translate",
            "microsoft-translator" => "microsoft-translator",
            _ => "ai-model",
        }
        .to_string();
        source.provider_id = source.provider_id.trim().to_string();
        source.model = source.model.trim().to_string();
        source.api_base_url =
            normalize_translation_api_base_url(&source.kind, &source.api_base_url);
        source.api_key = source.api_key.trim().to_string();
        source.app_id = source.app_id.trim().to_string();
        source.region = source.region.trim().to_string();
        source.request_timeout_secs = source.request_timeout_secs.clamp(5, 600);
    }

    let active_id = settings.translation_active_source_id.trim();
    settings.translation_active_source_id = settings
        .translation_sources
        .iter()
        .find(|source| source.id == active_id)
        .or_else(|| settings.translation_sources.first())
        .map(|source| source.id.clone())
        .unwrap_or_default();
    settings.translation_source_language = normalize_translation_language(
        &settings.translation_source_language,
        true,
        &default_translation_source_language(),
    );
    settings.translation_target_language = normalize_translation_language(
        &settings.translation_target_language,
        false,
        &default_translation_target_language(),
    );
}

fn is_translation_api_source(kind: &str) -> bool {
    matches!(
        kind,
        "libretranslate" | "baidu-translate" | "google-translate" | "microsoft-translator"
    )
}

fn normalize_translation_api_base_url(kind: &str, value: &str) -> String {
    let trimmed = value.trim().trim_end_matches('/');
    if !trimmed.is_empty() {
        return trimmed.to_string();
    }
    match kind {
        "baidu-translate" => "https://fanyi-api.baidu.com/api/trans/vip/translate",
        "google-translate" => "https://translation.googleapis.com/language/translate/v2",
        "microsoft-translator" => "https://api.cognitive.microsofttranslator.com",
        _ => "",
    }
    .to_string()
}

fn normalize_translation_language(value: &str, allow_auto: bool, fallback: &str) -> String {
    match value.trim() {
        "auto" if allow_auto => "auto",
        "zh-CN" => "zh-CN",
        "zh-TW" => "zh-TW",
        "en" => "en",
        "ja" => "ja",
        "ko" => "ko",
        "fr" => "fr",
        "de" => "de",
        "es" => "es",
        "ru" => "ru",
        _ => fallback,
    }
    .to_string()
}

fn normalize_ai_provider_id(value: &str, index: usize) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        format!("provider-{}", index + 1)
    } else {
        trimmed.to_string()
    }
}

fn normalize_ai_provider_name(value: &str, index: usize) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        format!("Provider {}", index + 1)
    } else {
        trimmed.to_string()
    }
}

fn normalize_ai_provider_kind(value: &str) -> String {
    match value.trim() {
        "openai-compatible" => "openai-compatible",
        "local-proxy" => "local-proxy",
        _ => "openai",
    }
    .to_string()
}

fn normalize_ai_provider_edit_text(value: &str) -> String {
    value.trim().to_string()
}

fn normalize_ai_provider_api_base_url(value: &str) -> String {
    value.trim().to_string()
}

fn normalize_ai_provider_models(model: &str, models: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();
    for value in std::iter::once(model).chain(models.iter().map(String::as_str)) {
        let trimmed = value.trim();
        if !trimmed.is_empty() && !normalized.iter().any(|item| item == trimmed) {
            normalized.push(trimmed.to_string());
        }
    }
    normalized
}

fn default_ai_model_context_window_tokens() -> u64 {
    128_000
}

fn default_ai_model_max_output_tokens(model: &str) -> u64 {
    let lower = model.to_lowercase();
    if lower.contains("reason") || lower.contains("thinking") || lower.contains("deepseek-r") {
        100_000
    } else {
        4_096
    }
}

fn default_ai_provider_model_settings(model: &str) -> AiProviderModelSettings {
    let id = model.trim();
    let id = if id.is_empty() {
        default_ai_model()
    } else {
        id.to_string()
    };
    let lower = id.to_lowercase();
    let model_type = if lower.contains("embedding") || lower.contains("embed") {
        "embedding"
    } else if lower.contains("rerank") {
        "rerank"
    } else if lower.contains("image") || lower.contains("vision") {
        "image"
    } else {
        "chat"
    };
    AiProviderModelSettings {
        id: id.clone(),
        display_name: id.clone(),
        model_type: model_type.to_string(),
        context_window_tokens: default_ai_model_context_window_tokens(),
        max_output_tokens: default_ai_model_max_output_tokens(&id),
        capabilities: AiProviderModelCapabilities {
            vision: lower.contains("vision")
                || lower.contains("vl")
                || lower.contains("gpt-4o")
                || lower.contains("image"),
            reasoning: lower.contains("reason")
                || lower.contains("thinking")
                || lower.contains("deepseek-r"),
            tool_use: false,
        },
        favorite: false,
    }
}

fn default_ai_provider_model_settings_map(model: &str) -> HashMap<String, AiProviderModelSettings> {
    let config = default_ai_provider_model_settings(model);
    HashMap::from([(config.id.clone(), config)])
}

fn normalize_ai_provider_model_settings_map(
    models: &[String],
    settings_map: &HashMap<String, AiProviderModelSettings>,
) -> HashMap<String, AiProviderModelSettings> {
    let mut next = HashMap::new();
    for model in models {
        let model_id = model.trim();
        if model_id.is_empty() {
            continue;
        }
        let incoming = settings_map.get(model_id).cloned();
        next.insert(
            model_id.to_string(),
            normalize_ai_provider_model_settings(model_id, incoming),
        );
    }
    next
}

fn normalize_ai_provider_model_settings(
    model_id: &str,
    settings: Option<AiProviderModelSettings>,
) -> AiProviderModelSettings {
    let defaults = default_ai_provider_model_settings(model_id);
    let mut next = settings.unwrap_or_else(|| defaults.clone());
    next.id = model_id.to_string();
    next.display_name = normalize_ai_provider_edit_text(&next.display_name);
    if next.display_name.is_empty() {
        next.display_name = model_id.to_string();
    }
    next.model_type = match next.model_type.trim() {
        "embedding" => "embedding",
        "rerank" => "rerank",
        "image" => "image",
        "audio" => "audio",
        _ => "chat",
    }
    .to_string();
    next.context_window_tokens = next.context_window_tokens.clamp(1, 4_000_000);
    next.max_output_tokens = next.max_output_tokens.clamp(1, 1_000_000);
    next
}

fn infer_ai_provider_kind(api_base_url: &str) -> String {
    if api_base_url.contains("api.openai.com") {
        "openai".to_string()
    } else if api_base_url.contains("127.0.0.1") || api_base_url.contains("localhost") {
        "local-proxy".to_string()
    } else {
        "openai-compatible".to_string()
    }
}

fn normalize_ai_cancel_strategy(value: &str) -> String {
    match value.trim() {
        "abort-only" => "abort-only",
        "abort-and-local-timeout" => "abort-and-local-timeout",
        _ => "abort-and-save-stopped",
    }
    .to_string()
}

fn normalize_operation_log_level(value: &str) -> String {
    match value {
        "error" | "basic" | "debug" => value.to_string(),
        _ => "none".to_string(),
    }
}
