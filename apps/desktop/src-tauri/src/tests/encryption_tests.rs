use crate::encryption::{
    local_encryption_status_in, rotate_local_data_key_in, set_local_master_password_in,
    verify_local_master_password_in,
};
use crate::paths::{fts_database_path, local_data_key_wrap_path, secure_local_data_key_store_path};
use crate::reader_data::{load_reader_record_in, save_reader_record_in, SaveReaderRecordRequest};
use base64::Engine as _;

use super::common::*;

#[test]
fn sensitive_reader_records_are_encrypted_at_rest_and_decrypted_for_commands() {
    let dir = unique_temp_library_dir();
    let payload =
        r#"{"schemaVersion":1,"data":[{"id":"h1","text":"秘密高亮正文","note":"秘密高亮笔记"}]}"#;
    let saved = save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: "book-1".to_string(),
            kind: "highlights".to_string(),
            payload: payload.to_string(),
            schema_version: 1,
            source_window_id: "main".to_string(),
        },
    )
    .expect("sensitive reader record should save");
    assert_eq!(saved.payload, payload);

    let database =
        rusqlite::Connection::open(fts_database_path(&dir)).expect("reader sqlite should open");
    let raw: String = database
        .query_row(
            "SELECT payload FROM reader_records WHERE book_id = ?1 AND kind = ?2",
            rusqlite::params!["book-1", "highlights"],
            |row| row.get(0),
        )
        .expect("stored reader payload should read");
    assert!(raw.contains("\"encrypted\":true") || raw.contains("\"encrypted\": true"));
    assert!(raw.contains("\"nonce\""));
    assert!(!raw.contains("秘密高亮正文"));
    assert!(!raw.contains("秘密高亮笔记"));

    let loaded = load_reader_record_in(&dir, "book-1", "highlights")
        .expect("reader record should load")
        .expect("reader record should exist");
    assert_eq!(loaded.payload, payload);
}

#[test]
fn local_encryption_status_reports_key_boundary_without_key_material() {
    let dir = unique_temp_library_dir();
    let status_before = local_encryption_status_in(&dir).expect("encryption status should load");
    assert_eq!(status_before.algorithm, "AES-256-GCM");
    assert_eq!(status_before.envelope_version, "local-envelope-v1");
    assert_eq!(status_before.nonce_bytes, 12);
    assert_eq!(status_before.key_bytes, 32);
    assert_eq!(
        status_before.fallback_file_path,
        secure_local_data_key_store_path(&dir).display().to_string()
    );
    assert!(!status_before.fallback_file_exists);
    assert!(status_before
        .protected_kinds
        .contains(&"reader.highlights".to_string()));
    assert!(status_before
        .protected_kinds
        .contains(&"reader.cloudAiRequestHistory".to_string()));
    assert!(status_before.protected_kinds.contains(&"notes".to_string()));
    let serialized_before = serde_json::to_string(&status_before).expect("status should serialize");
    assert!(!serialized_before.contains("payload"));
    assert!(!serialized_before.contains("dataKey"));
    assert!(!serialized_before.contains("rawKey"));
    assert!(!serialized_before.contains("secretKey"));
    assert!(!serialized_before.contains("keyMaterial"));

    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: "book-key-status".to_string(),
            kind: "highlights".to_string(),
            payload: r#"{"schemaVersion":1,"data":[{"id":"h1","text":"密钥状态测试"}]}"#
                .to_string(),
            schema_version: 1,
            source_window_id: "main".to_string(),
        },
    )
    .expect("encrypted reader record should create a local key");

    let status_after = local_encryption_status_in(&dir).expect("encryption status should reload");
    assert_eq!(status_after.key_status, "available");
    assert!(status_after.keyring_available || status_after.fallback_file_exists);
    assert!(!status_after.fallback_file_path.contains("密钥状态测试"));
}

#[test]
fn master_password_wraps_fallback_key_without_exposing_key_material() {
    let dir = unique_temp_library_dir();
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: "book-master-password".to_string(),
            kind: "highlights".to_string(),
            payload: r#"{"schemaVersion":1,"data":[{"id":"h1","text":"主密码保护测试"}]}"#
                .to_string(),
            schema_version: 1,
            source_window_id: "main".to_string(),
        },
    )
    .expect("encrypted reader record should create a local key");

    let status = set_local_master_password_in(&dir, "correct horse battery staple")
        .expect("master password should wrap the local data key");
    let wrap_path = local_data_key_wrap_path(&dir);
    let wrap_raw = std::fs::read_to_string(&wrap_path).expect("wrap file should be readable");

    assert!(status.master_password_enabled);
    assert_eq!(status.fallback_protection, "masterPassword");
    assert!(status.wrapped_fallback_file_exists);
    assert!(!secure_local_data_key_store_path(&dir).exists());
    assert!(wrap_raw.contains("\"schema\": \"bookmind.local-data-key-wrap.v1\""));
    assert!(wrap_raw.contains("\"kdf\": \"argon2id\""));
    assert!(wrap_raw.contains("\"wrappedKey\""));
    assert!(!wrap_raw.contains("主密码保护测试"));
    assert!(
        verify_local_master_password_in(&dir, "correct horse battery staple")
            .expect("correct master password should verify")
            .master_password_enabled
    );
    assert!(verify_local_master_password_in(&dir, "wrong password")
        .expect_err("wrong master password must not verify")
        .contains("主密码"));

    let loaded = load_reader_record_in(&dir, "book-master-password", "highlights")
        .expect("reader record should still decrypt after wrapping")
        .expect("reader record should exist");
    assert!(loaded.payload.contains("主密码保护测试"));
}

#[test]
fn rotated_local_data_key_adds_key_ids_and_keeps_mixed_envelopes_readable() {
    let dir = unique_temp_library_dir();
    let payload_before = r#"{"schemaVersion":1,"data":[{"id":"h1","text":"轮换前高亮"}]}"#;
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: "book-rotation-before".to_string(),
            kind: "highlights".to_string(),
            payload: payload_before.to_string(),
            schema_version: 1,
            source_window_id: "main".to_string(),
        },
    )
    .expect("pre-rotation record should save");
    let connection =
        rusqlite::Connection::open(fts_database_path(&dir)).expect("reader sqlite should open");
    let raw_before: String = connection
        .query_row(
            "SELECT payload FROM reader_records WHERE book_id = ?1 AND kind = ?2",
            rusqlite::params!["book-rotation-before", "highlights"],
            |row| row.get(0),
        )
        .expect("pre-rotation raw payload should read");
    let envelope_before: serde_json::Value =
        serde_json::from_str(&raw_before).expect("pre-rotation envelope should parse");
    let previous_key_id = envelope_before
        .get("keyId")
        .and_then(|value| value.as_str())
        .expect("new envelopes should include keyId")
        .to_string();

    let rotation = rotate_local_data_key_in(&dir, None).expect("key rotation should complete");

    assert_eq!(rotation.previous_key_id, previous_key_id);
    assert_ne!(rotation.previous_key_id, rotation.active_key_id);
    assert!(rotation.reencrypted_reader_records >= 1);
    assert!(rotation.retired_key_count >= 1);
    let status = local_encryption_status_in(&dir).expect("status should load after rotation");
    assert_eq!(status.active_key_id, rotation.active_key_id);
    assert!(status.retired_key_count >= 1);

    connection
        .execute(
            "UPDATE reader_records SET payload = ?3 WHERE book_id = ?1 AND kind = ?2",
            rusqlite::params!["book-rotation-before", "highlights", raw_before,],
        )
        .expect("old envelope should be restored to simulate interrupted rotation");
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: "book-rotation-after".to_string(),
            kind: "highlights".to_string(),
            payload: r#"{"schemaVersion":1,"data":[{"id":"h2","text":"轮换后高亮"}]}"#.to_string(),
            schema_version: 1,
            source_window_id: "main".to_string(),
        },
    )
    .expect("post-rotation record should save");

    let loaded_before = load_reader_record_in(&dir, "book-rotation-before", "highlights")
        .expect("old keyId envelope should still decrypt")
        .expect("old record should exist");
    let loaded_after = load_reader_record_in(&dir, "book-rotation-after", "highlights")
        .expect("new keyId envelope should decrypt")
        .expect("new record should exist");
    assert_eq!(loaded_before.payload, payload_before);
    assert!(loaded_after.payload.contains("轮换后高亮"));
}

#[test]
fn key_rotation_with_master_password_rewraps_active_and_retired_keys() {
    let dir = unique_temp_library_dir();
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: "book-master-rotation".to_string(),
            kind: "highlights".to_string(),
            payload: r#"{"schemaVersion":1,"data":[{"id":"h1","text":"主密码轮换"}]}"#.to_string(),
            schema_version: 1,
            source_window_id: "main".to_string(),
        },
    )
    .expect("reader record should save");
    set_local_master_password_in(&dir, "correct horse battery staple")
        .expect("master password should enable");

    let missing_password_error = rotate_local_data_key_in(&dir, None)
        .expect_err("rotation must require the master password when wrap is enabled");
    assert!(missing_password_error.contains("主密码"));
    let result = rotate_local_data_key_in(&dir, Some("correct horse battery staple"))
        .expect("rotation should succeed with the master password");
    let status = verify_local_master_password_in(&dir, "correct horse battery staple")
        .expect("new wrap should verify after rotation");

    assert_eq!(status.active_key_id, result.active_key_id);
    assert!(status.master_password_enabled);
    assert_eq!(status.fallback_protection, "masterPassword");
    assert!(status.retired_key_count >= 1);
    assert!(!secure_local_data_key_store_path(&dir).exists());
    let loaded = load_reader_record_in(&dir, "book-master-rotation", "highlights")
        .expect("rotated record should load")
        .expect("record should exist");
    assert!(loaded.payload.contains("主密码轮换"));
}

#[test]
fn key_rotation_keeps_legacy_envelopes_without_key_id_readable() {
    let dir = unique_temp_library_dir();
    let payload = r#"{"schemaVersion":1,"data":[{"id":"h1","text":"旧 envelope 无 keyId"}]}"#;
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: "book-legacy-no-key-id".to_string(),
            kind: "highlights".to_string(),
            payload: payload.to_string(),
            schema_version: 1,
            source_window_id: "main".to_string(),
        },
    )
    .expect("record should save");
    let connection =
        rusqlite::Connection::open(fts_database_path(&dir)).expect("reader sqlite should open");
    let raw_with_key_id: String = connection
        .query_row(
            "SELECT payload FROM reader_records WHERE book_id = ?1 AND kind = ?2",
            rusqlite::params!["book-legacy-no-key-id", "highlights"],
            |row| row.get(0),
        )
        .expect("stored payload should read");
    let mut legacy_envelope: serde_json::Value =
        serde_json::from_str(&raw_with_key_id).expect("envelope should parse");
    legacy_envelope
        .as_object_mut()
        .expect("envelope should be an object")
        .remove("keyId");
    let raw_without_key_id =
        serde_json::to_string(&legacy_envelope).expect("legacy envelope should serialize");

    rotate_local_data_key_in(&dir, None).expect("rotation should keep old key retired");
    connection
        .execute(
            "UPDATE reader_records SET payload = ?3 WHERE book_id = ?1 AND kind = ?2",
            rusqlite::params!["book-legacy-no-key-id", "highlights", raw_without_key_id,],
        )
        .expect("legacy envelope should be restored after rotation");

    let loaded = load_reader_record_in(&dir, "book-legacy-no-key-id", "highlights")
        .expect("legacy envelope without keyId should decrypt through retired keys")
        .expect("record should exist");
    assert_eq!(loaded.payload, payload);
}

#[test]
fn legacy_sensitive_reader_records_are_loaded_and_reencrypted_on_save() {
    let dir = unique_temp_library_dir();
    let legacy_payload = r#"{"schemaVersion":1,"data":[{"id":"h1","text":"旧版明文高亮"}]}"#;
    let database_path = fts_database_path(&dir);
    std::fs::create_dir_all(database_path.parent().expect("db path should have parent"))
        .expect("db dir should be created");
    let connection = rusqlite::Connection::open(&database_path).expect("reader sqlite should open");
    connection
        .execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS reader_records (
                book_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                payload TEXT NOT NULL,
                schema_version INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                source_window_id TEXT NOT NULL DEFAULT '',
                PRIMARY KEY(book_id, kind)
            );
            "#,
        )
        .expect("legacy reader schema should initialize");
    connection
        .execute(
            "INSERT INTO reader_records (book_id, kind, payload, schema_version, source_window_id) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params!["book-legacy", "highlights", legacy_payload, 1, "legacy"],
        )
        .expect("legacy plaintext record should insert");

    let loaded = load_reader_record_in(&dir, "book-legacy", "highlights")
        .expect("legacy reader record should load")
        .expect("legacy reader record should exist");
    assert_eq!(loaded.payload, legacy_payload);

    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: "book-legacy".to_string(),
            kind: "highlights".to_string(),
            payload: legacy_payload.to_string(),
            schema_version: 1,
            source_window_id: "main".to_string(),
        },
    )
    .expect("legacy reader record should re-save");
    let raw: String = connection
        .query_row(
            "SELECT payload FROM reader_records WHERE book_id = ?1 AND kind = ?2",
            rusqlite::params!["book-legacy", "highlights"],
            |row| row.get(0),
        )
        .expect("re-saved reader payload should read");
    assert!(raw.contains("\"encrypted\":true") || raw.contains("\"encrypted\": true"));
    assert!(!raw.contains("旧版明文高亮"));
}

#[test]
fn legacy_base64_reader_envelopes_are_reencrypted_with_nonce() {
    let dir = unique_temp_library_dir();
    let database_path = fts_database_path(&dir);
    std::fs::create_dir_all(database_path.parent().expect("db path should have parent"))
        .expect("db dir should be created");
    let connection = rusqlite::Connection::open(&database_path).expect("reader sqlite should open");
    connection
        .execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS reader_records (
                book_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                payload TEXT NOT NULL,
                schema_version INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                source_window_id TEXT NOT NULL DEFAULT '',
                PRIMARY KEY(book_id, kind)
            );
            "#,
        )
        .expect("legacy reader schema should initialize");
    let legacy_inner = r#"{"schemaVersion":1,"data":[{"id":"h1","text":"旧版 Base64 高亮"}]}"#;
    let legacy_payload = serde_json::json!({
        "encrypted": true,
        "algorithm": "local-envelope-v1",
        "payload": base64::engine::general_purpose::STANDARD.encode(legacy_inner)
    })
    .to_string();
    connection
        .execute(
            "INSERT INTO reader_records (book_id, kind, payload, schema_version, source_window_id) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params!["book-base64", "highlights", legacy_payload, 1, "legacy"],
        )
        .expect("legacy base64 record should insert");

    let loaded = load_reader_record_in(&dir, "book-base64", "highlights")
        .expect("legacy base64 reader record should load")
        .expect("legacy base64 reader record should exist");
    assert_eq!(loaded.payload, legacy_inner);

    let migrated: String = connection
        .query_row(
            "SELECT payload FROM reader_records WHERE book_id = ?1 AND kind = ?2",
            rusqlite::params!["book-base64", "highlights"],
            |row| row.get(0),
        )
        .expect("migrated base64 reader payload should read");
    assert!(migrated.contains("\"encrypted\":true") || migrated.contains("\"encrypted\": true"));
    assert!(migrated.contains("\"nonce\""));
    assert!(!migrated.contains("旧版 Base64 高亮"));
}

#[test]
fn corrupt_reader_envelope_nonce_returns_error_without_panic() {
    let dir = unique_temp_library_dir();
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: "book-corrupt-nonce".to_string(),
            kind: "highlights".to_string(),
            payload: r#"{"schemaVersion":1,"data":[]}"#.to_string(),
            schema_version: 1,
            source_window_id: "main".to_string(),
        },
    )
    .expect("fixture should save");
    let connection =
        rusqlite::Connection::open(fts_database_path(&dir)).expect("reader sqlite should open");
    connection
        .execute(
            "UPDATE reader_records SET payload = ?3 WHERE book_id = ?1 AND kind = ?2",
            rusqlite::params![
                "book-corrupt-nonce",
                "highlights",
                r#"{"encrypted":true,"algorithm":"local-envelope-v1","nonce":"AA==","payload":"AA=="}"#
            ],
        )
        .expect("corrupt nonce fixture should write");

    let error = load_reader_record_in(&dir, "book-corrupt-nonce", "highlights")
        .expect_err("bad nonce should return an error");
    assert!(error.contains("nonce 长度无效"));
}
