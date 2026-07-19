use super::*;

#[test]
fn data_backup_copies_data_and_excludes_secure_key_files() {
    let dir = unique_temp_library_dir();
    std::fs::create_dir_all(dir.join("library")).expect("library dir should be created");
    std::fs::create_dir_all(dir.join("settings")).expect("settings dir should be created");
    std::fs::create_dir_all(dir.join("settings").join("providers"))
        .expect("provider settings dir should be created");
    std::fs::create_dir_all(dir.join("db")).expect("db dir should be created");
    std::fs::write(
        dir.join("library").join("library.json"),
        r#"[{"id":"book"}]"#,
    )
    .expect("library metadata should be written");
    std::fs::write(
        dir.join("settings").join("settings.json"),
        r#"{"schemaVersion":1}"#,
    )
    .expect("plain settings should be written");
    std::fs::write(dir.join("db").join("bookmind.sqlite"), "sqlite data")
        .expect("sqlite file should be written");
    std::fs::write(crate::paths::secure_ai_key_store_path(&dir), "sk-secret")
        .expect("secure AI key should be written");
    std::fs::write(
        crate::paths::secure_local_data_key_store_path(&dir),
        "local-secret",
    )
    .expect("secure local key should be written");
    std::fs::write(
        dir.join("settings")
            .join("local-data-key.key-secret.secure"),
        "retired local secret",
    )
    .expect("per-key secure local key should be written");
    std::fs::write(
        dir.join("settings")
            .join("providers")
            .join("ai-api-key.provider.secure"),
        "provider secret",
    )
    .expect("provider key should be written");
    std::fs::write(
        dir.join("settings")
            .join("providers")
            .join("translation-api-key.libre.secure"),
        "translation secret",
    )
    .expect("translation key should be written");
    std::fs::write(
        dir.join("settings").join("local-data-key.wrap.json"),
        r#"{"schema":"bookmind.local-data-key-wrap.v1"}"#,
    )
    .expect("password-protected key wrap should be written");
    std::fs::write(
        dir.join("settings").join("local-data-keys.json"),
        r#"{"schema":"bookmind.local-data-keys.v1"}"#,
    )
    .expect("local key registry should be written");

    let result = create_data_backup_in(&dir).expect("data backup should be created");
    let backup_path = std::path::PathBuf::from(&result.backup_path);

    assert!(backup_path.join("library").join("library.json").exists());
    assert!(backup_path.join("settings").join("settings.json").exists());
    assert!(backup_path.join("db").join("bookmind.sqlite").exists());
    assert!(backup_path.join("backup-manifest.json").exists());
    assert!(!backup_path
        .join("settings")
        .join("ai-api-key.secure")
        .exists());
    assert!(!backup_path
        .join("settings")
        .join("local-data-key.secure")
        .exists());
    assert!(!backup_path
        .join("settings")
        .join("local-data-key.key-secret.secure")
        .exists());
    assert!(!backup_path
        .join("settings")
        .join("providers")
        .join("ai-api-key.provider.secure")
        .exists());
    assert!(!backup_path
        .join("settings")
        .join("providers")
        .join("translation-api-key.libre.secure")
        .exists());
    assert!(backup_path
        .join("settings")
        .join("local-data-key.wrap.json")
        .exists());
    assert!(backup_path
        .join("settings")
        .join("local-data-keys.json")
        .exists());
    assert!(result.copied_files >= 3);
    assert!(result.copied_bytes >= "sqlite data".len() as u64);
    assert!(result.excluded_secrets);
}

#[test]
fn data_restore_preserves_default_backup_source_and_snapshots_current_data() {
    let dir = unique_temp_library_dir();
    std::fs::create_dir_all(dir.join("library")).expect("library dir should be created");
    std::fs::write(dir.join("library").join("library.json"), "before backup")
        .expect("library metadata should be written");
    let backup = create_data_backup_in(&dir).expect("data backup should be created");
    let backup_path = std::path::PathBuf::from(&backup.backup_path);
    std::fs::write(dir.join("library").join("library.json"), "after backup")
        .expect("library metadata should be changed");
    std::fs::create_dir_all(dir.join("notes")).expect("notes dir should be created");
    std::fs::write(dir.join("notes").join("notes.json"), "current notes")
        .expect("current notes should be written");

    let restored = restore_data_backup_in(&dir, &backup_path).expect("data backup should restore");

    assert!(backup_path.join("backup-manifest.json").exists());
    assert!(!dir.join("backup-manifest.json").exists());
    assert_eq!(
        std::fs::read_to_string(dir.join("library").join("library.json"))
            .expect("restored library metadata should be readable"),
        "before backup"
    );
    assert!(!dir.join("notes").join("notes.json").exists());
    let restore_snapshot = std::path::PathBuf::from(&restored.backup_path);
    assert!(restore_snapshot
        .join("library")
        .join("library.json")
        .exists());
    assert_eq!(
        std::fs::read_to_string(restore_snapshot.join("notes").join("notes.json"))
            .expect("restore snapshot notes should be readable"),
        "current notes"
    );
    assert_eq!(restored.restored_from, backup_path.display().to_string());
}

#[test]
fn data_auto_backup_prunes_auto_snapshots_without_touching_manual_or_restore_backups() {
    let dir = unique_temp_library_dir();
    std::fs::create_dir_all(dir.join("library")).expect("library dir should be created");
    std::fs::write(
        dir.join("library").join("library.json"),
        "auto backup source",
    )
    .expect("library metadata should be written");
    let backup_root = dir.join("backups");
    std::fs::create_dir_all(&backup_root).expect("backup root should be created");
    create_test_backup_snapshot(&backup_root, "bookmind-auto-backup-100", "100");
    create_test_backup_snapshot(&backup_root, "bookmind-auto-backup-200", "200");
    create_test_backup_snapshot(&backup_root, "bookmind-auto-backup-300", "300");
    create_test_backup_snapshot(&backup_root, "bookmind-backup-050", "50");
    let restore_backup_root = dir.join("restore-backups");
    create_test_backup_snapshot(&restore_backup_root, "before-restore-010", "10");

    let created = create_auto_data_backup_in(&dir, 2).expect("auto data backup should be created");
    let created_path = std::path::PathBuf::from(&created.backup_path);

    assert!(created_path.exists());
    assert!(created_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .starts_with("bookmind-auto-backup-"));
    assert!(!backup_root.join("bookmind-auto-backup-100").exists());
    assert!(!backup_root.join("bookmind-auto-backup-200").exists());
    assert!(backup_root.join("bookmind-auto-backup-300").exists());
    assert!(backup_root.join("bookmind-backup-050").exists());
    assert!(restore_backup_root.join("before-restore-010").exists());
    let auto_backup_count = std::fs::read_dir(&backup_root)
        .expect("backup root should be readable")
        .filter_map(Result::ok)
        .filter(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .starts_with("bookmind-auto-backup-")
        })
        .count();
    assert_eq!(auto_backup_count, 2);
}

#[test]
fn data_auto_backup_creates_unique_snapshots_and_clamps_retention() {
    let dir = unique_temp_library_dir();
    std::fs::create_dir_all(dir.join("library")).expect("library dir should be created");
    std::fs::write(
        dir.join("library").join("library.json"),
        "auto backup source",
    )
    .expect("library metadata should be written");

    let first = create_auto_data_backup_in(&dir, 30).expect("first auto backup should be created");
    let second =
        create_auto_data_backup_in(&dir, 99).expect("second auto backup should be created");

    assert_ne!(first.backup_path, second.backup_path);
    assert!(std::path::PathBuf::from(&first.backup_path).exists());
    assert!(std::path::PathBuf::from(&second.backup_path).exists());

    let backup_root = dir.join("backups");
    let auto_backup_count = std::fs::read_dir(&backup_root)
        .expect("backup root should be readable")
        .filter_map(Result::ok)
        .filter(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .starts_with("bookmind-auto-backup-")
        })
        .count();
    assert_eq!(auto_backup_count, 2);
}

fn create_test_backup_snapshot(root: &std::path::Path, name: &str, created_at: &str) {
    let snapshot = root.join(name);
    std::fs::create_dir_all(snapshot.join("library")).expect("snapshot dir should be created");
    std::fs::write(snapshot.join("library").join("library.json"), "snapshot")
        .expect("snapshot library metadata should be written");
    std::fs::write(
        snapshot.join("backup-manifest.json"),
        serde_json::json!({
            "schema": "bookmind.data-backup.v1",
            "createdAt": created_at,
            "copiedFiles": 1,
            "copiedBytes": 8,
            "excludedSecrets": true
        })
        .to_string(),
    )
    .expect("snapshot manifest should be written");
}
