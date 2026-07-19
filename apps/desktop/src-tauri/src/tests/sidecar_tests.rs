use super::*;

#[test]
fn sidecar_health_default_settings_returns_not_configured_without_sensitive_fields() {
    let dir = unique_temp_library_dir();

    let health = check_ai_sidecar_health_in(&dir);

    assert_eq!(health.sidecar_status, "not-configured");
    assert!(health.message.contains("not configured"));
    assert_eq!(health.version, "");
    assert!(health.capabilities.is_empty());
    assert!(!health.checked_at.is_empty());

    let serialized = serde_json::to_string(&health).expect("health payload should serialize");
    assert!(!serialized.contains("sidecarCommand"));
    assert!(!serialized.contains("sidecarWorkingDir"));
    assert!(!serialized.contains("sidecarHealthTimeoutMs"));
    assert!(!serialized.contains("sidecarMaxMemoryMb"));
}

#[test]
fn sidecar_health_spawn_failure_is_structured_and_redacted() {
    let dir = unique_temp_library_dir();
    let work_dir = dir.join("sidecar-work");
    std::fs::create_dir_all(&work_dir).expect("sidecar work dir should be created");
    save_settings_v2(
        &dir,
        &SettingsV2 {
            extended: serde_json::json!({
                "sidecarEnabled": true,
                "sidecarCommand": "E:\\private\\bookmind-sidecar\\missing-sidecar.exe",
                "sidecarWorkingDir": work_dir.display().to_string(),
                "sidecarHealthTimeoutMs": "1000",
                "sidecarMaxMemoryMb": "2048"
            }),
            ..SettingsV2::default()
        },
    )
    .expect("sidecar settings should save");

    let health = check_ai_sidecar_health_in(&dir);

    assert_eq!(health.sidecar_status, "error");
    assert!(health.message.contains("could not start"));
    assert_eq!(health.version, "");
    assert!(health.capabilities.is_empty());
    assert!(!health.checked_at.is_empty());

    let serialized = serde_json::to_string(&health).expect("health payload should serialize");
    assert!(!serialized.contains("E:\\private"));
    assert!(!serialized.contains("bookmind-sidecar"));
    assert!(!serialized.contains("missing-sidecar"));
    assert!(!serialized.contains("sidecarCommand"));
    assert!(!serialized.contains("sidecarWorkingDir"));
    assert!(!serialized.contains(&work_dir.display().to_string()));
}

#[test]
fn sidecar_health_failures_are_structured_for_timeout_invalid_json_and_crash() {
    for scenario in build_sidecar_failure_scenarios() {
        let dir = unique_temp_library_dir();
        configure_sidecar_for_test(&dir, scenario.command.as_deref(), scenario.timeout_ms);

        let started_at = std::time::Instant::now();
        let health = check_ai_sidecar_health_in(&dir);

        assert_eq!(
            health.sidecar_status, scenario.expected_status,
            "{} should expose a stable sidecar status",
            scenario.name
        );
        assert!(
            health.message.contains(scenario.expected_message),
            "{} should expose structured failure detail, got {}",
            scenario.name,
            health.message
        );
        if scenario.name == "timeout" {
            assert!(
                started_at.elapsed() < std::time::Duration::from_secs(5),
                "timeout health check should stop promptly instead of hanging the app"
            );
        }
        assert_eq!(health.version, "");
        assert!(health.capabilities.is_empty());
        assert!(!health.checked_at.is_empty());
        assert_sidecar_payload_is_redacted(&health);
    }
}

#[test]
fn sidecar_failures_do_not_block_reader_library_settings_tasks_or_fts() {
    for scenario in build_sidecar_failure_scenarios() {
        let dir = unique_temp_library_dir();
        configure_sidecar_for_test(&dir, scenario.command.as_deref(), scenario.timeout_ms);
        let health = check_ai_sidecar_health_in(&dir);
        assert_eq!(health.sidecar_status, scenario.expected_status);

        let source_dir = unique_temp_library_dir();
        std::fs::create_dir_all(&source_dir).expect("source dir should be created");
        let source = source_dir.join(format!("sidecar-fallback-{}.txt", scenario.name));
        std::fs::write(
            &source,
            format!(
                "第一章 Sidecar 失败兜底\n{} 场景下，阅读器、书库、设置、任务中心和 FTS 搜索仍应可用。钟声作为检索关键词。",
                scenario.name
            ),
        )
        .expect("source txt should be written");

        let book = import_book_from_path_into(&dir, &source).expect("library import should work");
        let settings =
            crate::settings::load_settings_v2(&dir).expect("settings should remain readable");
        assert_eq!(
            settings
                .extended
                .get("sidecarEnabled")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(false),
            scenario.command.is_some()
        );

        run_parse_and_index_tasks_in(&dir).expect("task runner should keep FTS indexing available");
        let metadata =
            load_library_metadata_payloads(&dir).expect("library metadata should remain available");
        assert!(
            metadata.iter().any(|payload| payload.record.id == book.id),
            "library should list the imported book after {} sidecar failure",
            scenario.name
        );
        let reader =
            load_reader_document_payload(&dir, &book.id).expect("reader document should load");
        assert!(
            reader.content.contains("钟声"),
            "reader content should remain readable after {} sidecar failure",
            scenario.name
        );
        let task_statuses =
            task_statuses_for_ui(&dir).expect("task center statuses should remain available");
        assert!(
            task_statuses
                .iter()
                .any(|task| task.book_id == book.id && task.kind == TaskKind::PARSE_AND_INDEX),
            "task center should expose parse/index status after {} sidecar failure",
            scenario.name
        );
        let fts_results =
            search_index_page_in(&dir, "钟声", 5, 0).expect("FTS search should remain available");
        assert!(
            fts_results.iter().any(|result| result.book_id == book.id),
            "FTS search should find indexed content after {} sidecar failure",
            scenario.name
        );

        let vector_build = build_vector_index_in(&dir, &book.id)
            .expect("vector build should return structured fallback payload");
        assert!(!vector_build.ok);
        assert_eq!(vector_build.sidecar_status, "not-configured");
        let vector_search = search_vector_index_in(&dir, "钟声", 5)
            .expect("vector search should return structured fallback payload");
        assert!(!vector_search.ok);
        assert_eq!(vector_search.sidecar_status, "not-configured");
    }
}

struct SidecarFailureScenario {
    name: &'static str,
    command: Option<String>,
    timeout_ms: &'static str,
    expected_status: &'static str,
    expected_message: &'static str,
}

fn build_sidecar_failure_scenarios() -> Vec<SidecarFailureScenario> {
    let script_dir = unique_temp_library_dir();
    std::fs::create_dir_all(&script_dir).expect("sidecar script dir should be created");
    vec![
        SidecarFailureScenario {
            name: "not-configured",
            command: None,
            timeout_ms: "1000",
            expected_status: "not-configured",
            expected_message: "not configured",
        },
        SidecarFailureScenario {
            name: "not-executable",
            command: Some(script_dir.join("missing-sidecar.exe").display().to_string()),
            timeout_ms: "1000",
            expected_status: "error",
            expected_message: "(not-found)",
        },
        SidecarFailureScenario {
            name: "timeout",
            command: Some(write_sidecar_probe_script(
                &script_dir,
                "timeout",
                timeout_probe_script(),
            )),
            timeout_ms: "1000",
            expected_status: "error",
            expected_message: "(timeout)",
        },
        SidecarFailureScenario {
            name: "invalid-json",
            command: Some(write_sidecar_probe_script(
                &script_dir,
                "invalid-json",
                invalid_json_probe_script(),
            )),
            timeout_ms: "1000",
            expected_status: "error",
            expected_message: "(invalid-json)",
        },
        SidecarFailureScenario {
            name: "process-exited",
            command: Some(write_sidecar_probe_script(
                &script_dir,
                "process-exited",
                crashed_probe_script(),
            )),
            timeout_ms: "1000",
            expected_status: "error",
            expected_message: "(process-exited)",
        },
    ]
}

fn configure_sidecar_for_test(dir: &std::path::Path, command: Option<&str>, timeout_ms: &str) {
    let work_dir = dir.join("sidecar-work");
    std::fs::create_dir_all(&work_dir).expect("sidecar work dir should be created");
    save_settings_v2(
        dir,
        &SettingsV2 {
            extended: serde_json::json!({
                "sidecarEnabled": command.is_some(),
                "sidecarCommand": command.unwrap_or_default(),
                "sidecarWorkingDir": work_dir.display().to_string(),
                "sidecarHealthTimeoutMs": timeout_ms,
                "sidecarMaxMemoryMb": "2048"
            }),
            ..SettingsV2::default()
        },
    )
    .expect("sidecar settings should save");
}

fn assert_sidecar_payload_is_redacted(health: &crate::models::AiSidecarHealthPayload) {
    let serialized = serde_json::to_string(health).expect("health payload should serialize");
    for forbidden in [
        "sidecarCommand",
        "sidecarWorkingDir",
        "private",
        "prompt",
        "vector-store",
        "C:\\Users",
        "/Users/alice",
    ] {
        assert!(
            !serialized.contains(forbidden),
            "health payload must not leak {forbidden}: {serialized}"
        );
    }
}

#[cfg(windows)]
fn write_sidecar_probe_script(dir: &std::path::Path, name: &str, body: &str) -> String {
    let path = dir.join(format!("{name}.ps1"));
    std::fs::write(&path, body).expect("PowerShell sidecar probe should be written");
    format!(
        "powershell.exe -NoProfile -ExecutionPolicy Bypass -File {}",
        path.display()
    )
}

#[cfg(not(windows))]
fn write_sidecar_probe_script(dir: &std::path::Path, name: &str, body: &str) -> String {
    let path = dir.join(format!("{name}.sh"));
    std::fs::write(&path, body).expect("shell sidecar probe should be written");
    format!("sh {}", path.display())
}

#[cfg(windows)]
fn invalid_json_probe_script() -> &'static str {
    "param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Rest)\nWrite-Output 'not-json'\nexit 0\n"
}

#[cfg(not(windows))]
fn invalid_json_probe_script() -> &'static str {
    "#!/bin/sh\necho 'not-json'\nexit 0\n"
}

#[cfg(windows)]
fn crashed_probe_script() -> &'static str {
    "param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Rest)\nWrite-Error 'private stderr prompt C:\\Users\\alice\\vector-store'\nexit 7\n"
}

#[cfg(not(windows))]
fn crashed_probe_script() -> &'static str {
    "#!/bin/sh\necho 'private stderr prompt /Users/alice/vector-store' >&2\nexit 7\n"
}

#[cfg(windows)]
fn timeout_probe_script() -> &'static str {
    "param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Rest)\nStart-Sleep -Milliseconds 2500\nWrite-Output '{\"version\":\"late\",\"capabilities\":[\"embedding\"]}'\nexit 0\n"
}

#[cfg(not(windows))]
fn timeout_probe_script() -> &'static str {
    "#!/bin/sh\nsleep 3\necho '{\"version\":\"late\",\"capabilities\":[\"embedding\"]}'\nexit 0\n"
}
