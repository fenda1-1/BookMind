use crate::models::{AiSidecarHealthPayload, SettingsV2};
use crate::settings::load_settings_v2;
use serde_json::Value;
use std::{
    io::ErrorKind,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

const SIDECAR_NOT_CONFIGURED: &str = "not-configured";
const SIDECAR_AVAILABLE: &str = "available";
const SIDECAR_ERROR: &str = "error";
const DEFAULT_HEALTH_TIMEOUT_MS: u64 = 5_000;

pub(crate) fn check_ai_sidecar_health_in(data_dir: &Path) -> AiSidecarHealthPayload {
    let checked_at = now_millis_string();
    let settings = match load_settings_v2(data_dir) {
        Ok(settings) => settings,
        Err(_) => {
            return health_payload(
                SIDECAR_ERROR,
                "AI sidecar settings could not be read.",
                "",
                Vec::new(),
                checked_at,
            );
        }
    };
    let config = SidecarHealthConfig::from_settings(&settings);
    if !config.enabled || config.command.trim().is_empty() {
        return health_payload(
            SIDECAR_NOT_CONFIGURED,
            "Python sidecar is not configured; SQLite FTS remains active.",
            "",
            Vec::new(),
            checked_at,
        );
    }

    let Some((program, args)) = split_command_line(&config.command) else {
        return health_payload(
            SIDECAR_ERROR,
            "AI sidecar command is invalid.",
            "",
            Vec::new(),
            checked_at,
        );
    };

    let working_dir = match resolve_working_dir(&config.working_dir) {
        Ok(working_dir) => working_dir,
        Err(message) => {
            return health_payload(SIDECAR_ERROR, message, "", Vec::new(), checked_at);
        }
    };

    run_health_probe(
        &program,
        &args,
        working_dir.as_deref(),
        config.timeout_ms,
        checked_at,
    )
}

pub(crate) fn sidecar_health_error_payload(message: &str) -> AiSidecarHealthPayload {
    health_payload(SIDECAR_ERROR, message, "", Vec::new(), now_millis_string())
}

fn run_health_probe(
    program: &str,
    args: &[String],
    working_dir: Option<&Path>,
    timeout_ms: u64,
    checked_at: String,
) -> AiSidecarHealthPayload {
    let mut command = Command::new(program);
    command.args(args);
    command.arg("--health");
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());
    if let Some(working_dir) = working_dir {
        command.current_dir(working_dir);
    }
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            return health_payload(
                SIDECAR_ERROR,
                classify_spawn_error(&error.kind()),
                "",
                Vec::new(),
                checked_at,
            );
        }
    };

    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let Ok(output) = child.wait_with_output() else {
                    return health_payload(
                        SIDECAR_ERROR,
                        "AI sidecar health output could not be read (output-read-failed).",
                        "",
                        Vec::new(),
                        checked_at,
                    );
                };
                if !status.success() {
                    return health_payload(
                        SIDECAR_ERROR,
                        "AI sidecar health command exited with an error (process-exited).",
                        "",
                        Vec::new(),
                        checked_at,
                    );
                }
                return parse_health_output(&output.stdout, checked_at);
            }
            Ok(None) if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait_with_output();
                return health_payload(
                    SIDECAR_ERROR,
                    "AI sidecar health command timed out (timeout).",
                    "",
                    Vec::new(),
                    checked_at,
                );
            }
            Ok(None) => thread::sleep(Duration::from_millis(20)),
            Err(_) => {
                return health_payload(
                    SIDECAR_ERROR,
                    "AI sidecar health status could not be read (status-read-failed).",
                    "",
                    Vec::new(),
                    checked_at,
                );
            }
        }
    }
}

fn parse_health_output(stdout: &[u8], checked_at: String) -> AiSidecarHealthPayload {
    let raw = String::from_utf8_lossy(stdout);
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return health_payload(
            SIDECAR_ERROR,
            "AI sidecar health response was empty (empty-response).",
            "",
            Vec::new(),
            checked_at,
        );
    }
    let Ok(value) = serde_json::from_str::<Value>(trimmed) else {
        return health_payload(
            SIDECAR_ERROR,
            "AI sidecar health response was not valid JSON (invalid-json).",
            "",
            Vec::new(),
            checked_at,
        );
    };
    let version = value
        .get("version")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    let capabilities = value
        .get("capabilities")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    health_payload(
        SIDECAR_AVAILABLE,
        "AI sidecar health check succeeded.",
        &version,
        capabilities,
        checked_at,
    )
}

fn resolve_working_dir(value: &str) -> Result<Option<PathBuf>, &'static str> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    let path = PathBuf::from(trimmed);
    if path.is_dir() {
        Ok(Some(path))
    } else {
        Err("AI sidecar working directory is unavailable.")
    }
}

fn classify_spawn_error(kind: &ErrorKind) -> &'static str {
    match kind {
        ErrorKind::NotFound => "AI sidecar could not start (not-found).",
        ErrorKind::PermissionDenied => "AI sidecar could not start (permission-denied).",
        ErrorKind::InvalidInput => "AI sidecar could not start (invalid-command).",
        _ => "AI sidecar could not start (spawn-failed).",
    }
}

fn health_payload(
    sidecar_status: &str,
    message: &str,
    version: &str,
    capabilities: Vec<String>,
    checked_at: String,
) -> AiSidecarHealthPayload {
    AiSidecarHealthPayload {
        sidecar_status: sidecar_status.to_string(),
        message: message.to_string(),
        version: version.to_string(),
        capabilities,
        checked_at,
    }
}

#[derive(Clone, Debug)]
struct SidecarHealthConfig {
    enabled: bool,
    command: String,
    working_dir: String,
    timeout_ms: u64,
}

impl SidecarHealthConfig {
    fn from_settings(settings: &SettingsV2) -> Self {
        let extended = &settings.extended;
        Self {
            enabled: json_bool(extended.get("sidecarEnabled")),
            command: json_string(extended.get("sidecarCommand")),
            working_dir: json_string(extended.get("sidecarWorkingDir")),
            timeout_ms: json_u64(
                extended.get("sidecarHealthTimeoutMs"),
                DEFAULT_HEALTH_TIMEOUT_MS,
            )
            .clamp(1_000, 60_000),
        }
    }
}

fn json_bool(value: Option<&Value>) -> bool {
    match value {
        Some(Value::Bool(value)) => *value,
        Some(Value::String(value)) => value.trim().eq_ignore_ascii_case("true"),
        _ => false,
    }
}

fn json_string(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(value)) => value.trim().to_string(),
        _ => String::new(),
    }
}

fn json_u64(value: Option<&Value>, fallback: u64) -> u64 {
    match value {
        Some(Value::Number(number)) => number.as_u64().unwrap_or(fallback),
        Some(Value::String(value)) => value.trim().parse::<u64>().unwrap_or(fallback),
        _ => fallback,
    }
}

fn split_command_line(value: &str) -> Option<(String, Vec<String>)> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut quote_char = '\0';
    let mut escaped = false;
    for character in value.trim().chars() {
        if escaped {
            current.push(character);
            escaped = false;
            continue;
        }
        if character == '\\' && in_quotes {
            escaped = true;
            continue;
        }
        if in_quotes {
            if character == quote_char {
                in_quotes = false;
            } else {
                current.push(character);
            }
            continue;
        }
        if character == '"' || character == '\'' {
            in_quotes = true;
            quote_char = character;
            continue;
        }
        if character.is_whitespace() {
            if !current.is_empty() {
                args.push(std::mem::take(&mut current));
            }
            continue;
        }
        current.push(character);
    }
    if escaped || in_quotes {
        return None;
    }
    if !current.is_empty() {
        args.push(current);
    }
    let program = args.first()?.clone();
    Some((program, args.into_iter().skip(1).collect()))
}

fn now_millis_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
