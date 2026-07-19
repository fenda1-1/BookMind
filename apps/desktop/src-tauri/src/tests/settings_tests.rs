use super::*;
use crate::settings::preserve_secure_app_settings;

#[test]
fn app_settings_legacy_file_is_migrated_with_schema_version() {
    let dir = unique_temp_library_dir();
    let settings_dir = dir.join("settings");
    std::fs::create_dir_all(&settings_dir).expect("settings dir should be created");
    std::fs::write(
        settings_dir.join("settings.json"),
        r#"{"trashRetentionDays":9}"#,
    )
    .expect("legacy settings should be written");

    let settings = load_app_settings(&dir).expect("legacy settings should load");
    let raw = std::fs::read_to_string(settings_dir.join("settings.json"))
        .expect("migrated settings should be readable");

    assert_eq!(settings.schema_version, 1);
    assert_eq!(settings.trash_retention_days, 9);
    assert!(settings.trash_protect_reading_progress);
    assert!(settings.trash_protect_reader_assets);
    assert!(raw.contains("\"schemaVersion\": 1"));
    assert!(raw.contains("\"trashProtectReadingProgress\": true"));
    assert!(raw.contains("\"trashProtectReaderAssets\": true"));
}

#[test]
fn app_settings_save_writes_schema_version() {
    let dir = unique_temp_library_dir();
    let saved = save_app_settings(
        &dir,
        &crate::models::AppSettings {
            schema_version: 0,
            trash_retention_days: 90,
            trash_auto_cleanup_enabled: false,
            trash_protect_reading_progress: false,
            trash_protect_reader_assets: false,
            ai_api_key: " sk-test ".to_string(),
            ai_api_base_url: "https://api.openai.com/v1/".to_string(),
            ai_endpoint_mode: "chat.completions".to_string(),
            ai_model: "gpt-4.1-mini".to_string(),
            ai_proxy_url: " http://127.0.0.1:7890 ".to_string(),
            ai_custom_headers: " {\"X-Provider\":\"bookmind\"} ".to_string(),
            operation_log_level: "none".to_string(),
            ..crate::models::AppSettings::default()
        },
    )
    .expect("settings should save");
    let raw = std::fs::read_to_string(dir.join("settings").join("settings.json"))
        .expect("settings file should be readable");

    assert_eq!(saved.schema_version, 1);
    assert_eq!(saved.trash_retention_days, 30);
    assert_eq!(saved.ai_proxy_url, "http://127.0.0.1:7890");
    assert_eq!(saved.ai_custom_headers, "{\"X-Provider\":\"bookmind\"}");
    assert!(!saved.trash_auto_cleanup_enabled);
    assert!(!saved.trash_protect_reading_progress);
    assert!(!saved.trash_protect_reader_assets);
    assert!(raw.contains("\"schemaVersion\": 1"));
    assert!(raw.contains("\"trashAutoCleanupEnabled\": false"));
    assert!(raw.contains("\"trashProtectReadingProgress\": false"));
    assert!(raw.contains("\"trashProtectReaderAssets\": false"));
    assert!(raw.contains("\"aiProxyUrl\": \"http://127.0.0.1:7890\""));
    assert!(raw.contains("\"aiCustomHeaders\": \"{\\\"X-Provider\\\":\\\"bookmind\\\"}\""));
}

#[test]
fn app_settings_do_not_write_ai_api_key_to_plain_settings_file() {
    let dir = unique_temp_library_dir();
    let saved = save_app_settings(
        &dir,
        &crate::models::AppSettings {
            schema_version: 1,
            trash_retention_days: 3,
            trash_auto_cleanup_enabled: true,
            ai_api_key: "sk-secret-secure-store".to_string(),
            ai_api_base_url: "https://api.openai.com/v1".to_string(),
            ai_endpoint_mode: "responses".to_string(),
            ai_model: "gpt-4.1-mini".to_string(),
            operation_log_level: "none".to_string(),
            ..crate::models::AppSettings::default()
        },
    )
    .expect("settings should save");
    let raw = std::fs::read_to_string(dir.join("settings").join("settings.json"))
        .expect("settings file should be readable");
    let loaded = load_app_settings(&dir).expect("settings should reload with secure key");

    assert_eq!(saved.ai_api_key, "sk-secret-secure-store");
    assert_eq!(loaded.ai_api_key, "sk-secret-secure-store");
    assert!(!raw.contains("sk-secret-secure-store"));
}

#[test]
fn generic_app_settings_updates_preserve_secure_keys_by_stable_id() {
    let mut existing_profile =
        crate::models::AppSettings::default().ai_provider_profiles[0].clone();
    existing_profile.id = "provider-a".to_string();
    existing_profile.api_key = "provider-secret".to_string();
    let existing = crate::models::AppSettings {
        ai_api_key: "active-secret".to_string(),
        ai_active_provider_profile_id: "provider-a".to_string(),
        ai_provider_profiles: vec![existing_profile.clone()],
        translation_sources: vec![crate::models::TranslationSource {
            id: "libre-a".to_string(),
            name: "LibreTranslate".to_string(),
            kind: "libretranslate".to_string(),
            enabled: true,
            provider_id: String::new(),
            model: String::new(),
            api_base_url: "https://translate.example.test".to_string(),
            api_key: "translation-secret".to_string(),
            app_id: String::new(),
            region: String::new(),
            request_timeout_secs: 30,
        }],
        ..crate::models::AppSettings::default()
    };
    let mut incoming_profile = existing_profile.clone();
    incoming_profile.api_key.clear();
    let mut new_profile = existing_profile;
    new_profile.id = "provider-new".to_string();
    new_profile.api_key = "must-not-enter-through-generic-settings".to_string();
    let mut incoming = crate::models::AppSettings {
        ai_api_key: String::new(),
        ai_active_provider_profile_id: "provider-a".to_string(),
        ai_provider_profiles: vec![incoming_profile, new_profile],
        translation_sources: vec![
            crate::models::TranslationSource {
                id: "libre-a".to_string(),
                name: "LibreTranslate".to_string(),
                kind: "libretranslate".to_string(),
                enabled: true,
                provider_id: String::new(),
                model: String::new(),
                api_base_url: "https://translate.example.test".to_string(),
                api_key: String::new(),
                app_id: String::new(),
                region: String::new(),
                request_timeout_secs: 30,
            },
            crate::models::TranslationSource {
                id: "libre-new".to_string(),
                name: "New LibreTranslate".to_string(),
                kind: "libretranslate".to_string(),
                enabled: true,
                provider_id: String::new(),
                model: String::new(),
                api_base_url: "https://translate-new.example.test".to_string(),
                api_key: "must-not-enter-through-generic-settings".to_string(),
                app_id: String::new(),
                region: String::new(),
                request_timeout_secs: 30,
            },
        ],
        ..crate::models::AppSettings::default()
    };

    preserve_secure_app_settings(&existing, &mut incoming);

    assert_eq!(incoming.ai_api_key, "active-secret");
    assert_eq!(incoming.ai_provider_profiles[0].api_key, "provider-secret");
    assert!(incoming.ai_provider_profiles[1].api_key.is_empty());
    assert_eq!(
        incoming.translation_sources[0].api_key,
        "translation-secret"
    );
    assert!(incoming.translation_sources[1].api_key.is_empty());
}

#[test]
fn generic_updates_clear_keys_when_the_credential_owner_changes() {
    let mut profile = crate::models::AppSettings::default().ai_provider_profiles[0].clone();
    profile.id = "provider-a".to_string();
    profile.api_base_url = "https://trusted.example/v1/".to_string();
    profile.api_key = "provider-secret".to_string();
    let source = crate::models::TranslationSource {
        id: "source-a".to_string(),
        name: "Baidu".to_string(),
        kind: "baidu-translate".to_string(),
        enabled: true,
        provider_id: String::new(),
        model: String::new(),
        api_base_url: "https://trusted.example/translate/".to_string(),
        api_key: "translation-secret".to_string(),
        app_id: "trusted-app".to_string(),
        region: String::new(),
        request_timeout_secs: 30,
    };
    let existing = crate::models::AppSettings {
        ai_active_provider_profile_id: profile.id.clone(),
        ai_provider_profiles: vec![profile.clone()],
        translation_sources: vec![source.clone()],
        ..crate::models::AppSettings::default()
    };

    let mut changed_endpoint = existing.clone();
    changed_endpoint.ai_provider_profiles[0].api_key.clear();
    changed_endpoint.ai_provider_profiles[0].api_base_url =
        "https://attacker.example/v1".to_string();
    changed_endpoint.translation_sources[0].api_key.clear();
    changed_endpoint.translation_sources[0].api_base_url =
        "https://attacker.example/translate".to_string();
    preserve_secure_app_settings(&existing, &mut changed_endpoint);
    assert!(changed_endpoint.ai_provider_profiles[0].api_key.is_empty());
    assert!(changed_endpoint.translation_sources[0].api_key.is_empty());

    let mut changed_app_id = existing.clone();
    changed_app_id.translation_sources[0].api_key.clear();
    changed_app_id.translation_sources[0].app_id = "different-app".to_string();
    preserve_secure_app_settings(&existing, &mut changed_app_id);
    assert!(changed_app_id.translation_sources[0].api_key.is_empty());

    let mut canonical_equivalent = existing.clone();
    canonical_equivalent.ai_provider_profiles[0].api_key.clear();
    canonical_equivalent.ai_provider_profiles[0].api_base_url =
        " https://trusted.example/v1 ".to_string();
    canonical_equivalent.translation_sources[0].api_key.clear();
    canonical_equivalent.translation_sources[0].api_base_url =
        "https://trusted.example/translate".to_string();
    preserve_secure_app_settings(&existing, &mut canonical_equivalent);
    assert_eq!(
        canonical_equivalent.ai_provider_profiles[0].api_key,
        "provider-secret"
    );
    assert_eq!(
        canonical_equivalent.translation_sources[0].api_key,
        "translation-secret"
    );
}

#[test]
fn secure_fallback_paths_do_not_collide_for_lossy_legacy_ids() {
    let dir = unique_temp_library_dir();
    let first_id = format!("translation/{}/a", std::process::id());
    let second_id = format!("translation?{}/a", std::process::id());
    let template = crate::models::AppSettings::default().translation_sources[0].clone();
    let settings = crate::models::AppSettings {
        translation_sources: vec![
            crate::models::TranslationSource {
                id: first_id,
                kind: "google-translate".to_string(),
                api_key: "first-secret".to_string(),
                ..template.clone()
            },
            crate::models::TranslationSource {
                id: second_id,
                kind: "google-translate".to_string(),
                api_key: "second-secret".to_string(),
                ..template
            },
        ],
        ..crate::models::AppSettings::default()
    };

    save_app_settings(&dir, &settings).expect("colliding legacy IDs should save independently");
    let provider_dir = dir.join("settings").join("providers");
    let mut translation_key_files = std::fs::read_dir(provider_dir)
        .expect("provider key directory should exist")
        .filter_map(Result::ok)
        .filter(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .starts_with("translation-api-key.")
        })
        .collect::<Vec<_>>();
    translation_key_files.sort_by_key(|entry| entry.file_name());
    assert_eq!(translation_key_files.len(), 2);
    let values = translation_key_files
        .iter()
        .map(|entry| std::fs::read_to_string(entry.path()).expect("key should be readable"))
        .collect::<std::collections::HashSet<_>>();
    assert_eq!(
        values,
        std::collections::HashSet::from(["first-secret".to_string(), "second-secret".to_string(),])
    );
}

#[test]
fn switching_active_provider_does_not_copy_the_previous_provider_key() {
    let mut provider_a = crate::models::AppSettings::default().ai_provider_profiles[0].clone();
    provider_a.id = "provider-a".to_string();
    provider_a.api_key = "provider-a-secret".to_string();
    let mut provider_b = provider_a.clone();
    provider_b.id = "provider-b".to_string();
    provider_b.api_key.clear();
    let existing = crate::models::AppSettings {
        ai_api_key: provider_a.api_key.clone(),
        ai_active_provider_profile_id: provider_a.id.clone(),
        ai_provider_profiles: vec![provider_a.clone(), provider_b.clone()],
        ..crate::models::AppSettings::default()
    };
    let mut incoming = crate::models::AppSettings {
        ai_api_key: provider_a.api_key.clone(),
        ai_active_provider_profile_id: provider_b.id.clone(),
        ai_provider_profiles: vec![
            crate::models::AiProviderProfile {
                api_key: String::new(),
                ..provider_a
            },
            provider_b,
        ],
        ..crate::models::AppSettings::default()
    };

    preserve_secure_app_settings(&existing, &mut incoming);

    assert_eq!(
        incoming.ai_provider_profiles[0].api_key,
        "provider-a-secret"
    );
    assert!(incoming.ai_provider_profiles[1].api_key.is_empty());
    assert!(incoming.ai_api_key.is_empty());
}

#[test]
fn app_settings_preserve_translation_sources_without_plaintext_keys() {
    let dir = unique_temp_library_dir();
    let source_id = format!("libre-{}", std::process::id());
    let mut settings = crate::models::AppSettings::default();
    settings.translation_active_source_id = source_id.clone();
    settings.translation_sources = vec![crate::models::TranslationSource {
        id: source_id,
        name: "LibreTranslate".to_string(),
        kind: "libretranslate".to_string(),
        enabled: true,
        provider_id: String::new(),
        model: String::new(),
        api_base_url: "https://translate.example.test/".to_string(),
        api_key: "translation-secret".to_string(),
        app_id: String::new(),
        region: String::new(),
        request_timeout_secs: 30,
    }];

    save_app_settings(&dir, &settings).expect("translation source settings should save");
    let raw = std::fs::read_to_string(dir.join("settings").join("settings.json"))
        .expect("settings file should be readable");
    let loaded = load_app_settings(&dir).expect("translation source settings should reload");

    assert!(!raw.contains("translation-secret"));
    assert!(raw.contains("\"translationSources\""));
    assert_eq!(loaded.translation_sources[0].api_key, "translation-secret");
    assert_eq!(
        loaded.translation_sources[0].api_base_url,
        "https://translate.example.test"
    );
}

#[test]
fn app_settings_normalize_native_translation_sources_and_keep_only_api_key_secure() {
    let dir = unique_temp_library_dir();
    let suffix = std::process::id();
    let template = crate::models::AppSettings::default().translation_sources[0].clone();
    let google_id = format!("google-{suffix}");
    let mut settings = crate::models::AppSettings {
        translation_active_source_id: google_id.clone(),
        translation_sources: vec![
            crate::models::TranslationSource {
                id: format!("baidu-{suffix}"),
                name: "Baidu".to_string(),
                kind: "baidu-translate".to_string(),
                api_base_url: String::new(),
                app_id: " baidu-app-id ".to_string(),
                ..template.clone()
            },
            crate::models::TranslationSource {
                id: google_id,
                name: "Google".to_string(),
                kind: "google-translate".to_string(),
                api_base_url: String::new(),
                api_key: "google-secret".to_string(),
                ..template.clone()
            },
            crate::models::TranslationSource {
                id: format!("microsoft-{suffix}"),
                name: "Microsoft".to_string(),
                kind: "microsoft-translator".to_string(),
                api_base_url: String::new(),
                region: " eastasia ".to_string(),
                ..template
            },
        ],
        ..crate::models::AppSettings::default()
    };

    settings = save_app_settings(&dir, &settings).expect("translation sources should save");
    let raw = std::fs::read_to_string(dir.join("settings").join("settings.json"))
        .expect("settings file should be readable");
    let loaded = load_app_settings(&dir).expect("translation sources should reload");

    assert!(!raw.contains("google-secret"));
    assert!(raw.contains("\"appId\": \"baidu-app-id\""));
    assert!(raw.contains("\"region\": \"eastasia\""));
    assert_eq!(settings.translation_sources[0].app_id, "baidu-app-id");
    assert_eq!(settings.translation_sources[2].region, "eastasia");
    assert_eq!(loaded.translation_sources[1].api_key, "google-secret");
    assert_eq!(
        loaded.translation_sources[0].api_base_url,
        "https://fanyi-api.baidu.com/api/trans/vip/translate"
    );
    assert_eq!(
        loaded.translation_sources[1].api_base_url,
        "https://translation.googleapis.com/language/translate/v2"
    );
    assert_eq!(
        loaded.translation_sources[2].api_base_url,
        "https://api.cognitive.microsofttranslator.com"
    );
}

#[test]
fn app_settings_preserve_ai_provider_profiles_without_plaintext_keys() {
    let dir = unique_temp_library_dir();
    let saved = save_app_settings(
        &dir,
        &crate::models::AppSettings {
            ai_api_key: "sk-provider-secret".to_string(),
            ai_active_provider_profile_id: "local-proxy".to_string(),
            ai_cancel_strategy: "abort-and-local-timeout".to_string(),
            ai_provider_profiles: vec![
                crate::models::AiProviderProfile {
                    id: "openai".to_string(),
                    name: "OpenAI".to_string(),
                    kind: "openai".to_string(),
                    api_base_url: "https://api.openai.com/v1/".to_string(),
                    endpoint_mode: "responses".to_string(),
                    model: "gpt-4.1-mini".to_string(),
                    ..crate::models::AiProviderProfile {
                        id: String::new(),
                        name: String::new(),
                        kind: String::new(),
                        enabled: true,
                        api_key: String::new(),
                        api_base_url: String::new(),
                        endpoint_mode: String::new(),
                        model: String::new(),
                        models: Vec::new(),
                        model_settings: Default::default(),
                        proxy_url: String::new(),
                        custom_headers: String::new(),
                        streaming_enabled: true,
                        request_timeout_secs: 120,
                        retry_count: 1,
                        temperature: 0.2,
                        max_tokens: 0,
                        top_p: 1.0,
                        reasoning_effort: "none".to_string(),
                        response_format: "auto".to_string(),
                    }
                },
                crate::models::AiProviderProfile {
                    id: "local-proxy".to_string(),
                    name: "本地代理".to_string(),
                    kind: "local-proxy".to_string(),
                    api_base_url: " http://127.0.0.1:11434/v1 ".to_string(),
                    endpoint_mode: "chat.completions".to_string(),
                    model: "qwen3".to_string(),
                    custom_headers: r#" {
                        "X-Provider": "local",
                        "Authorization": "Bearer should-not-persist",
                        "Cookie": "session=should-not-persist",
                        "X-API-Key": "provider-secret"
                    } "#
                    .to_string(),
                    request_timeout_secs: 900,
                    retry_count: 9,
                    ..crate::models::AiProviderProfile {
                        id: String::new(),
                        name: String::new(),
                        kind: String::new(),
                        enabled: true,
                        api_key: String::new(),
                        api_base_url: String::new(),
                        endpoint_mode: String::new(),
                        model: String::new(),
                        models: Vec::new(),
                        model_settings: Default::default(),
                        proxy_url: String::new(),
                        custom_headers: String::new(),
                        streaming_enabled: true,
                        request_timeout_secs: 120,
                        retry_count: 1,
                        temperature: 0.2,
                        max_tokens: 0,
                        top_p: 1.0,
                        reasoning_effort: "none".to_string(),
                        response_format: "auto".to_string(),
                    }
                },
            ],
            ..crate::models::AppSettings::default()
        },
    )
    .expect("settings with provider profiles should save");
    let raw = std::fs::read_to_string(dir.join("settings").join("settings.json"))
        .expect("settings file should be readable");
    let loaded = load_app_settings(&dir).expect("settings should reload");

    assert_eq!(saved.ai_active_provider_profile_id, "local-proxy");
    assert_eq!(saved.ai_cancel_strategy, "abort-and-local-timeout");
    assert_eq!(saved.ai_provider_profiles.len(), 2);
    assert_eq!(
        saved.ai_provider_profiles[0].api_base_url,
        "https://api.openai.com/v1"
    );
    assert_eq!(
        saved.ai_provider_profiles[1].api_base_url,
        "http://127.0.0.1:11434/v1"
    );
    assert_eq!(
        saved.ai_provider_profiles[1].custom_headers,
        "{\"X-Provider\":\"local\"}"
    );
    assert_eq!(saved.ai_provider_profiles[1].request_timeout_secs, 600);
    assert_eq!(saved.ai_provider_profiles[1].retry_count, 5);
    assert_eq!(loaded.ai_provider_profiles.len(), 2);
    assert_eq!(loaded.ai_active_provider_profile_id, "local-proxy");
    assert!(!raw.contains("sk-provider-secret"));
    assert!(!raw.contains("should-not-persist"));
    assert!(!raw.contains("provider-secret"));
    assert!(!raw.contains("Authorization"));
    assert!(!raw.contains("Cookie"));
    assert!(!raw.contains("X-API-Key"));
    assert!(raw.contains("\"aiProviderProfiles\""));
    assert!(raw.contains("\"aiCancelStrategy\": \"abort-and-local-timeout\""));
}

#[test]
fn ai_api_key_storage_status_reports_storage_boundary_without_secret() {
    let dir = unique_temp_library_dir();
    let status_before =
        ai_api_key_storage_status_in(&dir).expect("AI key storage status should load");
    assert_eq!(status_before.key_status, "missing");
    assert_eq!(
        status_before.fallback_file_path,
        crate::paths::secure_ai_key_store_path(&dir)
            .display()
            .to_string()
    );
    assert!(!status_before.fallback_file_exists);
    assert!(!crate::paths::secure_ai_key_store_path(&dir).exists());

    let mut settings = AppSettings::default();
    settings.ai_api_key = "sk-secret-storage-status".to_string();
    save_app_settings(&dir, &settings).expect("settings should save API key securely");

    let status_after =
        ai_api_key_storage_status_in(&dir).expect("AI key storage status should reload");
    assert_eq!(status_after.key_status, "saved");
    assert!(status_after.keyring_available || status_after.fallback_file_exists);
    let serialized_after = serde_json::to_string(&status_after).expect("status should serialize");
    assert!(!serialized_after.contains("sk-secret-storage-status"));
    assert!(!serialized_after.contains("apiKey"));
    assert!(!serialized_after.contains("secretKey"));
    assert!(!serialized_after.contains("keyMaterial"));
}

#[test]
fn settings_v2_save_writes_unified_settings_file() {
    let dir = unique_temp_library_dir();
    let saved = crate::settings::save_settings_v2(
        &dir,
        &crate::models::SettingsV2 {
            settings_schema_version: 0,
            global: serde_json::json!({ "startupPage": "reader" }),
            reader: serde_json::json!({ "fontSize": 22 }),
            extended: serde_json::json!({ "pageTurnSound": true }),
        },
    )
    .expect("settings v2 should save");
    let raw = std::fs::read_to_string(crate::paths::settings_v2_file_path(&dir))
        .expect("settings v2 file should be readable");
    let loaded = crate::settings::load_settings_v2(&dir).expect("settings v2 should reload");

    assert_eq!(saved.settings_schema_version, 2);
    assert_eq!(loaded.settings_schema_version, 2);
    assert_eq!(loaded.extended["pageTurnSound"], true);
    assert!(raw.contains("\"settingsSchemaVersion\": 2"));
    assert!(raw.contains("\"extended\""));
}

#[test]
fn settings_v2_legacy_file_is_migrated_with_schema_version() {
    let dir = unique_temp_library_dir();
    let settings_dir = dir.join("settings");
    std::fs::create_dir_all(&settings_dir).expect("settings dir should be created");
    std::fs::write(
        settings_dir.join("settings_v2.json"),
        r#"{"extended":{"startupPage":"library"}}"#,
    )
    .expect("legacy settings v2 should be written");

    let settings = crate::settings::load_settings_v2(&dir).expect("legacy settings v2 should load");
    let raw = std::fs::read_to_string(settings_dir.join("settings_v2.json"))
        .expect("migrated settings v2 should be readable");

    assert_eq!(settings.settings_schema_version, 2);
    assert_eq!(settings.extended["startupPage"], "library");
    assert!(raw.contains("\"settingsSchemaVersion\": 2"));
    assert!(raw.contains("\"global\""));
    assert!(raw.contains("\"reader\""));
}
