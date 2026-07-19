use aes_gcm::aead::{rand_core::RngCore, Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{
    engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD},
    Engine as _,
};
use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::{SystemTime, UNIX_EPOCH},
};

use crate::paths::{
    local_data_key_registry_path, local_data_key_wrap_path, secure_local_data_key_store_path,
};

pub(crate) const LOCAL_ENVELOPE_ALGORITHM: &str = "local-envelope-v1";
const LOCAL_ENVELOPE_CIPHER: &str = "AES-256-GCM";
const LOCAL_ENVELOPE_NONCE_BYTES: usize = 12;
const LOCAL_ENVELOPE_KEY_BYTES: usize = 32;

const LOCAL_DATA_KEYRING_SERVICE: &str = "BookMind";
const LOCAL_DATA_KEYRING_USER: &str = "local-data-key";
const LOCAL_DATA_KEYRING_USER_PREFIX: &str = "local-data-key:";
const LOCAL_DATA_KEY_REGISTRY_SCHEMA: &str = "bookmind.local-data-keys.v1";
const LOCAL_DATA_KEY_WRAP_SCHEMA: &str = "bookmind.local-data-key-wrap.v1";
const MASTER_PASSWORD_KDF: &str = "argon2id";
const MASTER_PASSWORD_MEMORY_KIB: u32 = 19_456;
const MASTER_PASSWORD_ITERATIONS: u32 = 2;
const MASTER_PASSWORD_PARALLELISM: u32 = 1;
const MASTER_PASSWORD_SALT_BYTES: usize = 16;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub(crate) struct LocalEncryptedEnvelope {
    pub(crate) encrypted: bool,
    pub(crate) algorithm: String,
    #[serde(default, rename = "keyId", skip_serializing_if = "String::is_empty")]
    pub(crate) key_id: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub(crate) cipher: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub(crate) nonce: String,
    pub(crate) payload: String,
    #[serde(
        default,
        rename = "createdAt",
        skip_serializing_if = "String::is_empty"
    )]
    pub(crate) created_at: String,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LocalEncryptionStatusPayload {
    pub(crate) algorithm: String,
    pub(crate) envelope_version: String,
    pub(crate) key_status: String,
    pub(crate) active_key_id: String,
    pub(crate) retired_key_count: usize,
    pub(crate) master_password_enabled: bool,
    pub(crate) fallback_protection: String,
    pub(crate) keyring_available: bool,
    pub(crate) fallback_file_exists: bool,
    pub(crate) fallback_file_path: String,
    pub(crate) wrapped_fallback_file_exists: bool,
    pub(crate) wrapped_fallback_file_path: String,
    pub(crate) protected_kinds: Vec<String>,
    pub(crate) nonce_bytes: usize,
    pub(crate) key_bytes: usize,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LocalDataKeyRotationPayload {
    pub(crate) previous_key_id: String,
    pub(crate) active_key_id: String,
    pub(crate) reencrypted_reader_records: usize,
    pub(crate) reencrypted_note_files: usize,
    pub(crate) retired_key_count: usize,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalDataKeyRegistry {
    schema: String,
    active_key_id: String,
    keys: Vec<LocalDataKeyRegistryEntry>,
    created_at: String,
    updated_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalDataKeyRegistryEntry {
    key_id: String,
    status: String,
    created_at: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    retired_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalDataKeyWrapFile {
    schema: String,
    kdf: String,
    kdf_params: LocalDataKeyKdfParams,
    salt: String,
    wrap_algorithm: String,
    keys: Vec<WrappedLocalDataKey>,
    created_at: String,
    updated_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalDataKeyKdfParams {
    memory_cost_kib: u32,
    iterations: u32,
    parallelism: u32,
    output_bytes: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WrappedLocalDataKey {
    key_id: String,
    status: String,
    nonce: String,
    wrapped_key: String,
    created_at: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    retired_at: String,
}

#[derive(Clone, Debug, Default)]
struct LocalKeyStoreStatus {
    available: bool,
    exists: bool,
    key_available: bool,
    has_error: bool,
}

#[derive(Clone, Debug, Default)]
struct LocalDataKeyCache {
    keys: HashMap<String, [u8; LOCAL_ENVELOPE_KEY_BYTES]>,
}

static LOCAL_DATA_KEY_CACHE: OnceLock<Mutex<HashMap<PathBuf, LocalDataKeyCache>>> = OnceLock::new();

pub(crate) fn local_encryption_status_in(
    data_dir: &Path,
) -> Result<LocalEncryptionStatusPayload, String> {
    let registry = read_local_data_key_registry(data_dir).unwrap_or_default();
    let active_key_id = registry
        .as_ref()
        .map(|item| item.active_key_id.clone())
        .unwrap_or_default();
    let retired_key_count = registry
        .as_ref()
        .map(|item| {
            item.keys
                .iter()
                .filter(|key| key.status == "retired")
                .count()
        })
        .unwrap_or(0);
    let fallback_path = secure_local_data_key_store_path(data_dir);
    let wrap_path = local_data_key_wrap_path(data_dir);
    let fallback_key_status = inspect_local_data_key_file(&fallback_path);
    let keyring_status = inspect_local_data_keyring();
    let wrapped_fallback_file_exists = wrap_path.exists();
    let active_key_available = active_key_id
        .trim()
        .is_empty()
        .then_some(false)
        .unwrap_or_else(|| {
            load_local_data_key_by_id(data_dir, &active_key_id)
                .map(|item| item.is_some())
                .unwrap_or(false)
        });
    let key_status = if active_key_available
        || keyring_status.key_available
        || fallback_key_status.key_available
    {
        "available"
    } else if wrapped_fallback_file_exists {
        "locked"
    } else if keyring_status.has_error || fallback_key_status.has_error {
        "error"
    } else {
        "missing"
    };
    let fallback_protection = if wrapped_fallback_file_exists {
        "masterPassword"
    } else if fallback_key_status.key_available || has_per_key_plaintext_fallback(data_dir) {
        "plaintextFile"
    } else if keyring_status.key_available {
        "keyringOnly"
    } else {
        "none"
    };

    Ok(LocalEncryptionStatusPayload {
        algorithm: LOCAL_ENVELOPE_CIPHER.to_string(),
        envelope_version: LOCAL_ENVELOPE_ALGORITHM.to_string(),
        key_status: key_status.to_string(),
        active_key_id,
        retired_key_count,
        master_password_enabled: wrapped_fallback_file_exists,
        fallback_protection: fallback_protection.to_string(),
        keyring_available: keyring_status.available,
        fallback_file_exists: fallback_key_status.exists,
        fallback_file_path: fallback_path.display().to_string(),
        wrapped_fallback_file_exists,
        wrapped_fallback_file_path: wrap_path.display().to_string(),
        protected_kinds: local_encryption_protected_kinds(),
        nonce_bytes: LOCAL_ENVELOPE_NONCE_BYTES,
        key_bytes: LOCAL_ENVELOPE_KEY_BYTES,
    })
}

pub(crate) fn set_local_master_password_in(
    data_dir: &Path,
    password: &str,
) -> Result<LocalEncryptionStatusPayload, String> {
    validate_master_password(password)?;
    let (active_key_id, active_key) = load_or_create_active_local_data_key(data_dir)?;
    let mut registry = ensure_local_data_key_registry(data_dir, &active_key_id)?;
    let mut keys = load_all_known_local_data_keys(data_dir, None)?;
    keys.insert(active_key_id.clone(), active_key);
    write_local_data_key_wrap_file(data_dir, password, &registry, &keys)?;
    cache_local_data_keys(data_dir, keys);
    delete_plaintext_local_data_key_files(data_dir)?;
    registry.updated_at = timestamp_millis_string();
    save_local_data_key_registry(data_dir, &registry)?;
    local_encryption_status_in(data_dir)
}

pub(crate) fn verify_local_master_password_in(
    data_dir: &Path,
    password: &str,
) -> Result<LocalEncryptionStatusPayload, String> {
    let keys = decrypt_local_data_key_wrap_file(data_dir, password)
        .map_err(|error| format!("主密码验证失败: {error}"))?;
    cache_local_data_keys(data_dir, keys);
    local_encryption_status_in(data_dir)
}

pub(crate) fn rotate_local_data_key_in(
    data_dir: &Path,
    master_password: Option<&str>,
) -> Result<LocalDataKeyRotationPayload, String> {
    let master_password_enabled = local_data_key_wrap_path(data_dir).exists();
    if master_password_enabled && master_password.unwrap_or_default().is_empty() {
        return Err("本地数据密钥已启用主密码保护，轮换时需要主密码".to_string());
    }
    if master_password_enabled {
        let keys = decrypt_local_data_key_wrap_file(data_dir, master_password.unwrap_or_default())?;
        cache_local_data_keys(data_dir, keys);
    }
    let (previous_key_id, previous_key) = load_or_create_active_local_data_key(data_dir)?;
    let mut registry = ensure_local_data_key_registry(data_dir, &previous_key_id)?;
    let mut keys = load_all_known_local_data_keys(data_dir, master_password)?;
    keys.insert(previous_key_id.clone(), previous_key);
    let active_key_id = generate_local_data_key_id();
    let active_key = generate_local_data_key();
    let now = timestamp_millis_string();
    let mut previous_found = false;
    for entry in &mut registry.keys {
        if entry.key_id == previous_key_id {
            entry.status = "retired".to_string();
            entry.retired_at = now.clone();
            previous_found = true;
        } else if entry.status == "active" {
            entry.status = "retired".to_string();
            entry.retired_at = now.clone();
        }
    }
    if !previous_found {
        registry.keys.push(LocalDataKeyRegistryEntry {
            key_id: previous_key_id.clone(),
            status: "retired".to_string(),
            created_at: now.clone(),
            retired_at: now.clone(),
        });
    }
    registry.active_key_id = active_key_id.clone();
    registry.updated_at = now.clone();
    registry.keys.push(LocalDataKeyRegistryEntry {
        key_id: active_key_id.clone(),
        status: "active".to_string(),
        created_at: now,
        retired_at: String::new(),
    });
    keys.insert(active_key_id.clone(), active_key);

    save_local_data_key_registry(data_dir, &registry)?;
    save_local_data_key_to_keyring(&active_key_id, &active_key, true)?;
    if master_password_enabled {
        write_local_data_key_wrap_file(
            data_dir,
            master_password.unwrap_or_default(),
            &registry,
            &keys,
        )?;
        delete_plaintext_local_data_key_files(data_dir)?;
    } else {
        save_plaintext_local_data_key_fallback(data_dir, &active_key_id, &active_key, true)?;
        for (key_id, key) in &keys {
            save_plaintext_local_data_key_fallback(
                data_dir,
                key_id,
                key,
                key_id == &active_key_id,
            )?;
        }
    }
    cache_local_data_keys(data_dir, keys);

    let reencrypted_reader_records =
        crate::reader_data::reencrypt_sensitive_reader_records_in(data_dir)?;
    let reencrypted_note_files = crate::notes::reencrypt_local_encrypted_note_files_in(data_dir)?;
    let retired_key_count = registry
        .keys
        .iter()
        .filter(|entry| entry.status == "retired")
        .count();
    Ok(LocalDataKeyRotationPayload {
        previous_key_id,
        active_key_id,
        reencrypted_reader_records,
        reencrypted_note_files,
        retired_key_count,
    })
}

pub(crate) fn encrypt_local_payload(
    data_dir: &Path,
    payload: &str,
) -> Result<LocalEncryptedEnvelope, String> {
    let (key_id, key) = load_or_create_active_local_data_key(data_dir)?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let encrypted = cipher
        .encrypt(&nonce, payload.as_bytes())
        .map_err(|error| format!("本地 envelope 加密失败: {error}"))?;
    Ok(LocalEncryptedEnvelope {
        encrypted: true,
        algorithm: LOCAL_ENVELOPE_ALGORITHM.to_string(),
        key_id,
        cipher: LOCAL_ENVELOPE_CIPHER.to_string(),
        nonce: STANDARD.encode(nonce),
        payload: STANDARD.encode(encrypted),
        created_at: timestamp_millis_string(),
    })
}

pub(crate) fn decrypt_local_payload(
    data_dir: &Path,
    envelope: &LocalEncryptedEnvelope,
) -> Result<String, String> {
    if envelope.algorithm != LOCAL_ENVELOPE_ALGORITHM {
        return Err(format!(
            "不支持的本地 envelope 算法: {}",
            envelope.algorithm
        ));
    }
    if envelope.nonce.trim().is_empty() {
        return decode_legacy_base64_payload(&envelope.payload);
    }
    let nonce_bytes = STANDARD
        .decode(&envelope.nonce)
        .map_err(|error| format!("本地 envelope nonce 无法解码: {error}"))?;
    if nonce_bytes.len() != LOCAL_ENVELOPE_NONCE_BYTES {
        return Err(format!(
            "本地 envelope nonce 长度无效: {}",
            nonce_bytes.len()
        ));
    }
    let encrypted = STANDARD
        .decode(&envelope.payload)
        .map_err(|error| format!("本地 envelope payload 无法解码: {error}"))?;
    if !envelope.key_id.trim().is_empty() {
        let key = load_local_data_key_by_id(data_dir, &envelope.key_id)?
            .ok_or_else(|| format!("找不到本地数据密钥: {}", envelope.key_id))?;
        return decrypt_payload_with_key(&key, &nonce_bytes, &encrypted);
    }
    decrypt_legacy_keyless_payload(data_dir, &nonce_bytes, &encrypted)
}

pub(crate) fn parse_local_encrypted_envelope(
    value: &serde_json::Value,
) -> Result<Option<LocalEncryptedEnvelope>, String> {
    let Some(encrypted) = value.get("encrypted").and_then(|item| item.as_bool()) else {
        return Ok(None);
    };
    if !encrypted {
        return Ok(None);
    }
    let envelope = serde_json::from_value::<LocalEncryptedEnvelope>(value.clone())
        .map_err(|error| format!("本地 envelope 无法解析: {error}"))?;
    if envelope.algorithm != LOCAL_ENVELOPE_ALGORITHM {
        return Err(format!(
            "不支持的本地 envelope 算法: {}",
            envelope.algorithm
        ));
    }
    if !envelope.cipher.trim().is_empty() && envelope.cipher != LOCAL_ENVELOPE_CIPHER {
        return Err(format!("不支持的本地 envelope cipher: {}", envelope.cipher));
    }
    Ok(Some(envelope))
}

fn decrypt_payload_with_key(
    key: &[u8; LOCAL_ENVELOPE_KEY_BYTES],
    nonce_bytes: &[u8],
    encrypted: &[u8],
) -> Result<String, String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let decrypted = cipher
        .decrypt(Nonce::from_slice(nonce_bytes), encrypted)
        .map_err(|error| format!("本地 envelope 解密失败: {error}"))?;
    String::from_utf8(decrypted)
        .map_err(|error| format!("本地 envelope payload 不是 UTF-8: {error}"))
}

fn decrypt_legacy_keyless_payload(
    data_dir: &Path,
    nonce_bytes: &[u8],
    encrypted: &[u8],
) -> Result<String, String> {
    let keys = load_legacy_candidate_local_data_keys(data_dir)?;
    let mut last_error = "没有可用的本地数据密钥".to_string();
    for key in keys {
        match decrypt_payload_with_key(&key, nonce_bytes, encrypted) {
            Ok(payload) => return Ok(payload),
            Err(error) => last_error = error,
        }
    }
    Err(last_error)
}

fn decode_legacy_base64_payload(payload: &str) -> Result<String, String> {
    let bytes = STANDARD
        .decode(payload)
        .or_else(|_| decode_browser_base64(payload))
        .map_err(|error| format!("旧版本地 envelope payload 无法解码: {error}"))?;
    String::from_utf8(bytes)
        .map_err(|error| format!("旧版本地 envelope payload 不是 UTF-8: {error}"))
}

fn load_or_create_active_local_data_key(
    data_dir: &Path,
) -> Result<(String, [u8; LOCAL_ENVELOPE_KEY_BYTES]), String> {
    if let Some(registry) = read_local_data_key_registry(data_dir)? {
        if registry.active_key_id.trim().is_empty() {
            return Err("本地数据密钥 registry 缺少 activeKeyId".to_string());
        }
        let key = load_local_data_key_by_id(data_dir, &registry.active_key_id)?
            .ok_or_else(|| format!("无法读取 active 本地数据密钥: {}", registry.active_key_id))?;
        return Ok((registry.active_key_id, key));
    }
    if local_data_key_wrap_path(data_dir).exists() {
        return Err("本地数据密钥已受主密码保护，请先验证主密码".to_string());
    }
    let key = load_legacy_local_data_key(data_dir)?.unwrap_or_else(generate_local_data_key);
    let key_id = generate_local_data_key_id();
    let now = timestamp_millis_string();
    let registry = LocalDataKeyRegistry {
        schema: LOCAL_DATA_KEY_REGISTRY_SCHEMA.to_string(),
        active_key_id: key_id.clone(),
        keys: vec![LocalDataKeyRegistryEntry {
            key_id: key_id.clone(),
            status: "active".to_string(),
            created_at: now.clone(),
            retired_at: String::new(),
        }],
        created_at: now.clone(),
        updated_at: now,
    };
    save_local_data_key_registry(data_dir, &registry)?;
    save_local_data_key_to_keyring(&key_id, &key, true)?;
    save_plaintext_local_data_key_fallback(data_dir, &key_id, &key, true)?;
    cache_one_local_data_key(data_dir, &key_id, key);
    Ok((key_id, key))
}

fn ensure_local_data_key_registry(
    data_dir: &Path,
    active_key_id: &str,
) -> Result<LocalDataKeyRegistry, String> {
    if let Some(mut registry) = read_local_data_key_registry(data_dir)? {
        if registry.active_key_id.trim().is_empty() {
            registry.active_key_id = active_key_id.to_string();
        }
        if !registry
            .keys
            .iter()
            .any(|entry| entry.key_id == active_key_id)
        {
            registry.keys.push(LocalDataKeyRegistryEntry {
                key_id: active_key_id.to_string(),
                status: "active".to_string(),
                created_at: timestamp_millis_string(),
                retired_at: String::new(),
            });
            save_local_data_key_registry(data_dir, &registry)?;
        }
        return Ok(registry);
    }
    let now = timestamp_millis_string();
    let registry = LocalDataKeyRegistry {
        schema: LOCAL_DATA_KEY_REGISTRY_SCHEMA.to_string(),
        active_key_id: active_key_id.to_string(),
        keys: vec![LocalDataKeyRegistryEntry {
            key_id: active_key_id.to_string(),
            status: "active".to_string(),
            created_at: now.clone(),
            retired_at: String::new(),
        }],
        created_at: now.clone(),
        updated_at: now,
    };
    save_local_data_key_registry(data_dir, &registry)?;
    Ok(registry)
}

fn read_local_data_key_registry(data_dir: &Path) -> Result<Option<LocalDataKeyRegistry>, String> {
    let path = local_data_key_registry_path(data_dir);
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取本地数据密钥 registry {}: {error}", path.display()))?;
    let mut registry: LocalDataKeyRegistry = serde_json::from_str(&raw)
        .map_err(|error| format!("无法解析本地数据密钥 registry {}: {error}", path.display()))?;
    if registry.schema.trim().is_empty() {
        registry.schema = LOCAL_DATA_KEY_REGISTRY_SCHEMA.to_string();
    }
    Ok(Some(registry))
}

fn save_local_data_key_registry(
    data_dir: &Path,
    registry: &LocalDataKeyRegistry,
) -> Result<(), String> {
    let path = local_data_key_registry_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "无法创建本地数据密钥 registry 目录 {}: {error}",
                parent.display()
            )
        })?;
    }
    let raw = serde_json::to_string_pretty(registry)
        .map_err(|error| format!("无法序列化本地数据密钥 registry: {error}"))?;
    fs::write(&path, raw)
        .map_err(|error| format!("无法写入本地数据密钥 registry {}: {error}", path.display()))
}

fn load_local_data_key_by_id(
    data_dir: &Path,
    key_id: &str,
) -> Result<Option<[u8; LOCAL_ENVELOPE_KEY_BYTES]>, String> {
    if key_id.trim().is_empty() {
        return Ok(None);
    }
    if let Some(key) = cached_local_data_key(data_dir, key_id) {
        return Ok(Some(key));
    }
    if let Some(key) = load_local_data_key_from_keyring_user(&keyring_user_for_key_id(key_id))? {
        cache_one_local_data_key(data_dir, key_id, key);
        return Ok(Some(key));
    }
    if is_active_key_id(data_dir, key_id)? {
        if let Some(key) = load_local_data_key_from_keyring_user(LOCAL_DATA_KEYRING_USER)? {
            cache_one_local_data_key(data_dir, key_id, key);
            return Ok(Some(key));
        }
    }
    if let Some(key) =
        load_local_data_key_from_plaintext_file(&local_key_file_for_key_id(data_dir, key_id))?
    {
        cache_one_local_data_key(data_dir, key_id, key);
        return Ok(Some(key));
    }
    if is_active_key_id(data_dir, key_id)? {
        if let Some(key) =
            load_local_data_key_from_plaintext_file(&secure_local_data_key_store_path(data_dir))?
        {
            cache_one_local_data_key(data_dir, key_id, key);
            return Ok(Some(key));
        }
    }
    if local_data_key_wrap_path(data_dir).exists() {
        return Err("本地数据密钥已受主密码保护，请先在设置中心验证主密码".to_string());
    }
    Ok(None)
}

fn load_all_known_local_data_keys(
    data_dir: &Path,
    master_password: Option<&str>,
) -> Result<HashMap<String, [u8; LOCAL_ENVELOPE_KEY_BYTES]>, String> {
    if let Some(password) = master_password.filter(|value| !value.is_empty()) {
        let keys = decrypt_local_data_key_wrap_file(data_dir, password)?;
        cache_local_data_keys(data_dir, keys.clone());
        return Ok(keys);
    }
    let mut keys = cached_all_local_data_keys(data_dir);
    let Some(registry) = read_local_data_key_registry(data_dir)? else {
        let (key_id, key) = load_or_create_active_local_data_key(data_dir)?;
        keys.insert(key_id, key);
        return Ok(keys);
    };
    for entry in &registry.keys {
        if keys.contains_key(&entry.key_id) {
            continue;
        }
        if let Some(key) = load_local_data_key_by_id(data_dir, &entry.key_id)? {
            keys.insert(entry.key_id.clone(), key);
        }
    }
    let missing = registry
        .keys
        .iter()
        .filter(|entry| !keys.contains_key(&entry.key_id))
        .map(|entry| entry.key_id.clone())
        .collect::<Vec<_>>();
    if !missing.is_empty() && local_data_key_wrap_path(data_dir).exists() {
        return Err("本地数据密钥已受主密码保护，请先验证主密码".to_string());
    }
    Ok(keys)
}

fn load_legacy_candidate_local_data_keys(
    data_dir: &Path,
) -> Result<Vec<[u8; LOCAL_ENVELOPE_KEY_BYTES]>, String> {
    let mut candidates = Vec::new();
    if let Some(registry) = read_local_data_key_registry(data_dir)? {
        if let Some(active) = load_local_data_key_by_id(data_dir, &registry.active_key_id)? {
            candidates.push(active);
        }
        for entry in registry
            .keys
            .iter()
            .filter(|entry| entry.status == "retired")
        {
            if let Some(key) = load_local_data_key_by_id(data_dir, &entry.key_id)? {
                candidates.push(key);
            }
        }
        return Ok(candidates);
    }
    let (_, key) = load_or_create_active_local_data_key(data_dir)?;
    candidates.push(key);
    Ok(candidates)
}

fn load_legacy_local_data_key(
    data_dir: &Path,
) -> Result<Option<[u8; LOCAL_ENVELOPE_KEY_BYTES]>, String> {
    if let Some(key) = load_local_data_key_from_keyring_user(LOCAL_DATA_KEYRING_USER)? {
        return Ok(Some(key));
    }
    load_local_data_key_from_plaintext_file(&secure_local_data_key_store_path(data_dir))
}

fn is_active_key_id(data_dir: &Path, key_id: &str) -> Result<bool, String> {
    Ok(read_local_data_key_registry(data_dir)?
        .map(|registry| registry.active_key_id == key_id)
        .unwrap_or(false))
}

fn save_local_data_key_to_keyring(
    key_id: &str,
    key: &[u8; LOCAL_ENVELOPE_KEY_BYTES],
    active: bool,
) -> Result<(), String> {
    save_local_data_key_to_keyring_user(&keyring_user_for_key_id(key_id), key)?;
    if active {
        save_local_data_key_to_keyring_user(LOCAL_DATA_KEYRING_USER, key)?;
    }
    Ok(())
}

fn save_local_data_key_to_keyring_user(
    user: &str,
    key: &[u8; LOCAL_ENVELOPE_KEY_BYTES],
) -> Result<(), String> {
    let entry = local_data_keyring_entry(user)?;
    match entry.set_password(&STANDARD.encode(key)) {
        Ok(()) | Err(_) => Ok(()),
    }
}

fn load_local_data_key_from_keyring_user(
    user: &str,
) -> Result<Option<[u8; LOCAL_ENVELOPE_KEY_BYTES]>, String> {
    let Ok(entry) = local_data_keyring_entry(user) else {
        return Ok(None);
    };
    match entry.get_password() {
        Ok(value) => decode_local_data_key(&value).map(Some),
        Err(_) => Ok(None),
    }
}

fn save_plaintext_local_data_key_fallback(
    data_dir: &Path,
    key_id: &str,
    key: &[u8; LOCAL_ENVELOPE_KEY_BYTES],
    active: bool,
) -> Result<(), String> {
    save_local_data_key_to_plaintext_file(&local_key_file_for_key_id(data_dir, key_id), key)?;
    if active {
        save_local_data_key_to_plaintext_file(&secure_local_data_key_store_path(data_dir), key)?;
    }
    Ok(())
}

fn load_local_data_key_from_plaintext_file(
    path: &Path,
) -> Result<Option<[u8; LOCAL_ENVELOPE_KEY_BYTES]>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("无法读取本地数据密钥 {}: {error}", path.display()))?;
    decode_local_data_key(raw.trim()).map(Some)
}

fn save_local_data_key_to_plaintext_file(
    path: &Path,
    key: &[u8; LOCAL_ENVELOPE_KEY_BYTES],
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建本地数据密钥目录 {}: {error}", parent.display()))?;
    }
    fs::write(path, STANDARD.encode(key))
        .map_err(|error| format!("无法写入本地数据密钥 {}: {error}", path.display()))?;
    restrict_secure_file_permissions(path)
}

fn inspect_local_data_keyring() -> LocalKeyStoreStatus {
    let Ok(entry) = local_data_keyring_entry(LOCAL_DATA_KEYRING_USER) else {
        return LocalKeyStoreStatus {
            has_error: true,
            ..Default::default()
        };
    };
    match entry.get_password() {
        Ok(value) => {
            let key_available = decode_local_data_key(&value).is_ok();
            LocalKeyStoreStatus {
                available: true,
                key_available,
                has_error: !key_available,
                ..Default::default()
            }
        }
        Err(keyring::Error::NoEntry) => LocalKeyStoreStatus {
            available: true,
            ..Default::default()
        },
        Err(_) => LocalKeyStoreStatus {
            has_error: true,
            ..Default::default()
        },
    }
}

fn inspect_local_data_key_file(path: &Path) -> LocalKeyStoreStatus {
    if !path.exists() {
        return LocalKeyStoreStatus::default();
    }
    let Ok(raw) = fs::read_to_string(path) else {
        return LocalKeyStoreStatus {
            exists: true,
            has_error: true,
            ..Default::default()
        };
    };
    let key_available = decode_local_data_key(raw.trim()).is_ok();
    LocalKeyStoreStatus {
        exists: true,
        key_available,
        has_error: !key_available,
        ..Default::default()
    }
}

fn write_local_data_key_wrap_file(
    data_dir: &Path,
    password: &str,
    registry: &LocalDataKeyRegistry,
    keys: &HashMap<String, [u8; LOCAL_ENVELOPE_KEY_BYTES]>,
) -> Result<(), String> {
    let salt = random_bytes::<MASTER_PASSWORD_SALT_BYTES>();
    let params = default_kdf_params();
    let master_key = derive_master_key(password, &salt, &params)?;
    let mut wrapped_keys = Vec::new();
    for entry in &registry.keys {
        let key = keys
            .get(&entry.key_id)
            .ok_or_else(|| format!("无法写入主密码保护：缺少数据密钥 {}", entry.key_id))?;
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&master_key));
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let wrapped_key = cipher
            .encrypt(&nonce, key.as_slice())
            .map_err(|error| format!("本地数据密钥 wrap 加密失败: {error}"))?;
        wrapped_keys.push(WrappedLocalDataKey {
            key_id: entry.key_id.clone(),
            status: entry.status.clone(),
            nonce: STANDARD.encode(nonce),
            wrapped_key: STANDARD.encode(wrapped_key),
            created_at: entry.created_at.clone(),
            retired_at: entry.retired_at.clone(),
        });
    }
    let now = timestamp_millis_string();
    let wrap = LocalDataKeyWrapFile {
        schema: LOCAL_DATA_KEY_WRAP_SCHEMA.to_string(),
        kdf: MASTER_PASSWORD_KDF.to_string(),
        kdf_params: params,
        salt: STANDARD.encode(salt),
        wrap_algorithm: LOCAL_ENVELOPE_CIPHER.to_string(),
        keys: wrapped_keys,
        created_at: now.clone(),
        updated_at: now,
    };
    let path = local_data_key_wrap_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "无法创建本地数据密钥 wrap 目录 {}: {error}",
                parent.display()
            )
        })?;
    }
    fs::write(
        &path,
        serde_json::to_string_pretty(&wrap)
            .map_err(|error| format!("无法序列化本地数据密钥 wrap: {error}"))?,
    )
    .map_err(|error| format!("无法写入本地数据密钥 wrap {}: {error}", path.display()))?;
    restrict_secure_file_permissions(&path)
}

fn decrypt_local_data_key_wrap_file(
    data_dir: &Path,
    password: &str,
) -> Result<HashMap<String, [u8; LOCAL_ENVELOPE_KEY_BYTES]>, String> {
    let path = local_data_key_wrap_path(data_dir);
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取本地数据密钥 wrap {}: {error}", path.display()))?;
    let wrap: LocalDataKeyWrapFile = serde_json::from_str(&raw)
        .map_err(|error| format!("无法解析本地数据密钥 wrap {}: {error}", path.display()))?;
    if wrap.schema != LOCAL_DATA_KEY_WRAP_SCHEMA {
        return Err(format!("不支持的本地数据密钥 wrap schema: {}", wrap.schema));
    }
    if wrap.kdf != MASTER_PASSWORD_KDF {
        return Err(format!("不支持的主密码 KDF: {}", wrap.kdf));
    }
    if wrap.wrap_algorithm != LOCAL_ENVELOPE_CIPHER {
        return Err(format!(
            "不支持的数据密钥 wrap 算法: {}",
            wrap.wrap_algorithm
        ));
    }
    let salt = STANDARD
        .decode(&wrap.salt)
        .map_err(|error| format!("主密码 salt 无法解码: {error}"))?;
    let master_key = derive_master_key(password, &salt, &wrap.kdf_params)?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&master_key));
    let mut keys = HashMap::new();
    for wrapped in &wrap.keys {
        let nonce = STANDARD
            .decode(&wrapped.nonce)
            .map_err(|error| format!("数据密钥 wrap nonce 无法解码: {error}"))?;
        if nonce.len() != LOCAL_ENVELOPE_NONCE_BYTES {
            return Err(format!("数据密钥 wrap nonce 长度无效: {}", nonce.len()));
        }
        let payload = STANDARD
            .decode(&wrapped.wrapped_key)
            .map_err(|error| format!("数据密钥 wrap payload 无法解码: {error}"))?;
        let decrypted = cipher
            .decrypt(Nonce::from_slice(&nonce), payload.as_ref())
            .map_err(|error| format!("主密码无法解开本地数据密钥: {error}"))?;
        let key: [u8; LOCAL_ENVELOPE_KEY_BYTES] = decrypted
            .try_into()
            .map_err(|_| "解开的本地数据密钥长度无效".to_string())?;
        keys.insert(wrapped.key_id.clone(), key);
    }
    Ok(keys)
}

fn derive_master_key(
    password: &str,
    salt: &[u8],
    params: &LocalDataKeyKdfParams,
) -> Result<[u8; LOCAL_ENVELOPE_KEY_BYTES], String> {
    let argon_params = Params::new(
        params.memory_cost_kib,
        params.iterations,
        params.parallelism,
        Some(params.output_bytes),
    )
    .map_err(|error| format!("主密码 KDF 参数无效: {error}"))?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, argon_params);
    let mut output = [0u8; LOCAL_ENVELOPE_KEY_BYTES];
    argon
        .hash_password_into(password.as_bytes(), salt, &mut output)
        .map_err(|error| format!("主密码 KDF 失败: {error}"))?;
    Ok(output)
}

fn default_kdf_params() -> LocalDataKeyKdfParams {
    LocalDataKeyKdfParams {
        memory_cost_kib: MASTER_PASSWORD_MEMORY_KIB,
        iterations: MASTER_PASSWORD_ITERATIONS,
        parallelism: MASTER_PASSWORD_PARALLELISM,
        output_bytes: LOCAL_ENVELOPE_KEY_BYTES,
    }
}

fn validate_master_password(password: &str) -> Result<(), String> {
    if password.chars().count() < 8 {
        return Err("主密码至少需要 8 个字符".to_string());
    }
    Ok(())
}

fn cache_one_local_data_key(data_dir: &Path, key_id: &str, key: [u8; LOCAL_ENVELOPE_KEY_BYTES]) {
    let cache = LOCAL_DATA_KEY_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = cache.lock().expect("local data key cache should lock");
    guard
        .entry(data_dir.to_path_buf())
        .or_default()
        .keys
        .insert(key_id.to_string(), key);
}

fn cache_local_data_keys(data_dir: &Path, keys: HashMap<String, [u8; LOCAL_ENVELOPE_KEY_BYTES]>) {
    let cache = LOCAL_DATA_KEY_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = cache.lock().expect("local data key cache should lock");
    guard
        .entry(data_dir.to_path_buf())
        .or_default()
        .keys
        .extend(keys);
}

fn cached_local_data_key(data_dir: &Path, key_id: &str) -> Option<[u8; LOCAL_ENVELOPE_KEY_BYTES]> {
    LOCAL_DATA_KEY_CACHE
        .get()
        .and_then(|cache| cache.lock().ok())
        .and_then(|guard| {
            guard
                .get(data_dir)
                .and_then(|cache| cache.keys.get(key_id).copied())
        })
}

fn cached_all_local_data_keys(data_dir: &Path) -> HashMap<String, [u8; LOCAL_ENVELOPE_KEY_BYTES]> {
    LOCAL_DATA_KEY_CACHE
        .get()
        .and_then(|cache| cache.lock().ok())
        .and_then(|guard| guard.get(data_dir).map(|cache| cache.keys.clone()))
        .unwrap_or_default()
}

fn decode_local_data_key(value: &str) -> Result<[u8; LOCAL_ENVELOPE_KEY_BYTES], String> {
    let bytes = STANDARD
        .decode(value)
        .map_err(|error| format!("本地数据密钥无法解码: {error}"))?;
    bytes
        .try_into()
        .map_err(|_| "本地数据密钥长度无效".to_string())
}

fn generate_local_data_key() -> [u8; LOCAL_ENVELOPE_KEY_BYTES] {
    let key = Aes256Gcm::generate_key(&mut OsRng);
    key.into()
}

fn generate_local_data_key_id() -> String {
    let random = random_bytes::<16>();
    format!("key-{}", URL_SAFE_NO_PAD.encode(random))
}

fn random_bytes<const N: usize>() -> [u8; N] {
    let mut bytes = [0u8; N];
    OsRng.fill_bytes(&mut bytes);
    bytes
}

fn keyring_user_for_key_id(key_id: &str) -> String {
    format!("{LOCAL_DATA_KEYRING_USER_PREFIX}{key_id}")
}

fn local_data_keyring_entry(user: &str) -> Result<Entry, String> {
    Entry::new(LOCAL_DATA_KEYRING_SERVICE, user)
        .map_err(|error| format!("无法打开本地数据密钥存储: {error}"))
}

fn local_key_file_for_key_id(data_dir: &Path, key_id: &str) -> PathBuf {
    data_dir
        .join("settings")
        .join(format!("local-data-key.{key_id}.secure"))
}

fn delete_plaintext_local_data_key_files(data_dir: &Path) -> Result<(), String> {
    let active_path = secure_local_data_key_store_path(data_dir);
    if active_path.exists() {
        fs::remove_file(&active_path).map_err(|error| {
            format!(
                "无法删除明文本地数据密钥 {}: {error}",
                active_path.display()
            )
        })?;
    }
    let settings_dir = data_dir.join("settings");
    if !settings_dir.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(&settings_dir)
        .map_err(|error| format!("无法读取设置目录 {}: {error}", settings_dir.display()))?
    {
        let entry = entry.map_err(|error| format!("无法读取设置目录项: {error}"))?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with("local-data-key.")
            && file_name.ends_with(".secure")
            && entry.path().is_file()
        {
            fs::remove_file(entry.path())
                .map_err(|error| format!("无法删除明文本地数据密钥 {}: {error}", file_name))?;
        }
    }
    Ok(())
}

fn has_per_key_plaintext_fallback(data_dir: &Path) -> bool {
    let settings_dir = data_dir.join("settings");
    let Ok(entries) = fs::read_dir(settings_dir) else {
        return false;
    };
    entries.filter_map(Result::ok).any(|entry| {
        let file_name = entry.file_name().to_string_lossy().to_string();
        file_name.starts_with("local-data-key.")
            && file_name.ends_with(".secure")
            && entry.path().is_file()
    })
}

fn local_encryption_protected_kinds() -> Vec<String> {
    [
        "reader.highlights",
        "reader.bookmarks",
        "reader.tocEdits",
        "reader.tocManifest",
        "reader.chapterRulesOverride",
        "reader.cloudAiRequestHistory",
        "reader.aiConversationHistory",
        "notes",
        "highlights",
        "flashcards",
    ]
    .into_iter()
    .map(str::to_string)
    .collect()
}

#[cfg(unix)]
fn restrict_secure_file_permissions(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let permissions = fs::Permissions::from_mode(0o600);
    fs::set_permissions(path, permissions)
        .map_err(|error| format!("无法限制本地数据密钥权限 {}: {error}", path.display()))
}

#[cfg(not(unix))]
fn restrict_secure_file_permissions(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn decode_browser_base64(payload: &str) -> Result<Vec<u8>, base64::DecodeError> {
    let normalized = payload.replace('-', "+").replace('_', "/");
    let padded = match normalized.len() % 4 {
        0 => normalized,
        remainder => format!("{}{}", normalized, "=".repeat(4 - remainder)),
    };
    STANDARD.decode(padded)
}

fn timestamp_millis_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
        .to_string()
}
