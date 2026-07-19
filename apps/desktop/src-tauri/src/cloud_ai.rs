use crate::models::{
    AiDiagnosticsPayload, AiRequestPayload, AiResponsePayload, AppSettings, CloudAiModelsPayload,
    CloudAiTestResultPayload,
};
use reqwest::blocking::Client;
use reqwest::blocking::RequestBuilder;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::Read;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const CLOUD_MODEL: &str = "gpt-4.1-mini";

pub(crate) fn test_cloud_ai_connection_in(settings: &AppSettings) -> CloudAiTestResultPayload {
    let started = Instant::now();
    match post_cloud_ai(settings, "请只回复 pong") {
        Ok(response) => {
            let text = parse_openai_text(&response.body);
            CloudAiTestResultPayload {
                ok: response.status < 300 && text.to_ascii_lowercase().contains("pong"),
                status: response.status,
                model: response.model,
                duration_ms: started.elapsed().as_millis(),
                text,
                error: None,
            }
        }
        Err(error) => CloudAiTestResultPayload {
            ok: false,
            status: 0,
            model: String::new(),
            duration_ms: started.elapsed().as_millis(),
            text: String::new(),
            error: Some(redact_api_secrets(&error)),
        },
    }
}

pub(crate) fn request_cloud_ai_answer_in(
    settings: &AppSettings,
    request: &AiRequestPayload,
) -> Result<AiResponsePayload, String> {
    let prompt = build_cloud_ai_prompt(request);
    let response = post_cloud_ai_for_request(settings, &prompt, request)?;
    let text = parse_openai_text(&response.body);
    Ok(AiResponsePayload {
        answer: if text.is_empty() {
            "云端返回为空，请检查模型输出格式。".to_string()
        } else {
            text
        },
        citations: Vec::new(),
        diagnostics: AiDiagnosticsPayload {
            scope: request.scope.clone(),
            query_used: request.retrieval_query.clone().unwrap_or_default(),
            chunk_count: 0,
            fts_available: false,
            scope_empty: false,
            result_count: 1,
            fallback_used: false,
            error_kind: String::new(),
            recommendations: Vec::new(),
        },
    })
}

pub(crate) fn request_cloud_ai_answer_stream_in(
    app: AppHandle,
    settings: &AppSettings,
    request: &AiRequestPayload,
) -> Result<AiResponsePayload, String> {
    let prompt = build_cloud_ai_prompt(request);
    let text = post_cloud_ai_stream(
        &app,
        settings,
        request.request_id.as_deref().unwrap_or_default(),
        &prompt,
        request,
    )?;
    Ok(AiResponsePayload {
        answer: if text.is_empty() {
            "云端返回为空，请检查模型输出格式。".to_string()
        } else {
            text
        },
        citations: Vec::new(),
        diagnostics: AiDiagnosticsPayload {
            scope: request.scope.clone(),
            query_used: request.retrieval_query.clone().unwrap_or_default(),
            chunk_count: 0,
            fts_available: false,
            scope_empty: false,
            result_count: 1,
            fallback_used: false,
            error_kind: String::new(),
            recommendations: Vec::new(),
        },
    })
}

pub(crate) fn list_cloud_ai_models_in(
    settings: &AppSettings,
) -> Result<CloudAiModelsPayload, String> {
    let api_key = settings.ai_api_key.trim();
    if api_key.is_empty() {
        return Err("API Key 未配置".to_string());
    }
    let url = resolve_ai_models_url(&settings.ai_api_base_url);
    let timeout = Duration::from_secs(settings.ai_request_timeout_secs.clamp(5, 600));
    let response = apply_custom_cloud_headers(
        build_cloud_ai_client(settings, timeout)?.get(&url),
        settings,
    )?
    .bearer_auth(api_key)
    .send()
    .map_err(|error| diagnose_network_error(&url, &error.to_string()))?;
    let status = response.status().as_u16();
    let payload = response.json::<Value>().unwrap_or_else(|_| json!({}));
    if status >= 300 {
        let message = payload
            .get("error")
            .and_then(|error| error.get("message"))
            .and_then(Value::as_str)
            .unwrap_or("云端服务返回错误");
        return Err(format!("{} · {}", diagnose_http_status(status), message));
    }
    Ok(CloudAiModelsPayload {
        models: parse_model_ids(&payload),
    })
}

pub(crate) fn resolve_ai_endpoint_url(base_url: &str, mode: &str) -> String {
    let raw = if base_url.trim().is_empty() {
        "https://api.openai.com/v1"
    } else {
        base_url.trim()
    }
    .trim_end_matches('/');

    if mode == "chat.completions" {
        if raw.ends_with("/chat/completions") {
            raw.to_string()
        } else if raw.ends_with("/v1") {
            format!("{raw}/chat/completions")
        } else {
            format!("{raw}/chat/completions")
        }
    } else if raw.ends_with("/responses") {
        raw.to_string()
    } else if raw.ends_with("/v1") {
        format!("{raw}/responses")
    } else {
        format!("{raw}/responses")
    }
}

pub(crate) fn resolve_ai_models_url(base_url: &str) -> String {
    let raw = if base_url.trim().is_empty() {
        "https://api.openai.com/v1"
    } else {
        base_url.trim()
    }
    .trim_end_matches('/');
    let api_base = raw
        .strip_suffix("/responses")
        .or_else(|| raw.strip_suffix("/chat/completions"))
        .unwrap_or(raw)
        .trim_end_matches('/');
    if api_base.ends_with("/models") {
        api_base.to_string()
    } else {
        format!("{api_base}/models")
    }
}

fn build_cloud_ai_client(settings: &AppSettings, timeout: Duration) -> Result<Client, String> {
    let mut builder = Client::builder().timeout(timeout);
    let proxy_url = settings.ai_proxy_url.trim();
    if !proxy_url.is_empty() {
        let proxy =
            reqwest::Proxy::all(proxy_url).map_err(|error| format!("AI 代理地址无效：{error}"))?;
        builder = builder.proxy(proxy);
    }
    builder
        .build()
        .map_err(|error| format!("无法创建云端请求客户端：{error}"))
}

fn apply_custom_cloud_headers(
    request: RequestBuilder,
    settings: &AppSettings,
) -> Result<RequestBuilder, String> {
    let headers = build_custom_cloud_headers(settings)?;
    Ok(headers.into_iter().fold(request, |builder, (name, value)| {
        builder.header(name, value)
    }))
}

fn build_custom_cloud_headers(settings: &AppSettings) -> Result<HashMap<String, String>, String> {
    let raw = settings.ai_custom_headers.trim();
    if raw.is_empty() {
        return Ok(HashMap::new());
    }
    let value: Value = serde_json::from_str(raw)
        .map_err(|error| format!("AI 自定义请求头必须是 JSON 对象：{error}"))?;
    let Some(object) = value.as_object() else {
        return Err("AI 自定义请求头必须是 JSON 对象".to_string());
    };
    let mut headers = HashMap::new();
    for (name, value) in object {
        let header_name = name.trim().to_ascii_lowercase();
        if header_name.is_empty() || is_protected_custom_header(&header_name) {
            continue;
        }
        let header_value = match value {
            Value::String(text) => text.trim().to_string(),
            Value::Number(number) => number.to_string(),
            Value::Bool(flag) => flag.to_string(),
            _ => continue,
        };
        if header_value.is_empty() {
            continue;
        }
        headers.insert(header_name, header_value);
    }
    Ok(headers)
}

fn is_protected_custom_header(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "authorization"
            | "proxy-authorization"
            | "bearer"
            | "api-key"
            | "x-api-key"
            | "cookie"
            | "set-cookie"
    )
}

#[cfg(test)]
pub(crate) fn parse_openai_text_for_test(payload: &Value) -> String {
    parse_openai_text(payload)
}

#[cfg(test)]
pub(crate) fn parse_model_ids_for_test(payload: &Value) -> Vec<String> {
    parse_model_ids(payload)
}

#[cfg(test)]
pub(crate) fn build_cloud_ai_body_for_test(
    mode: &str,
    model: &str,
    prompt: &str,
    settings: &AppSettings,
) -> Value {
    build_cloud_ai_body(mode, model, prompt, settings, false)
}

#[cfg(test)]
pub(crate) fn build_cloud_ai_body_for_request_test(
    mode: &str,
    model: &str,
    prompt: &str,
    settings: &AppSettings,
    request: &AiRequestPayload,
) -> Value {
    build_cloud_ai_body_for_request(mode, model, prompt, settings, false, request)
}

#[cfg(test)]
pub(crate) fn build_cloud_ai_prompt_for_test(request: &AiRequestPayload) -> String {
    build_cloud_ai_prompt(request)
}

#[cfg(test)]
pub(crate) fn build_custom_cloud_headers_for_test(
    settings: &AppSettings,
) -> Result<HashMap<String, String>, String> {
    build_custom_cloud_headers(settings)
}

struct CloudPostResponse {
    status: u16,
    model: String,
    body: Value,
}

fn post_cloud_ai(settings: &AppSettings, prompt: &str) -> Result<CloudPostResponse, String> {
    post_cloud_ai_with_body(settings, prompt, None)
}

fn post_cloud_ai_for_request(
    settings: &AppSettings,
    prompt: &str,
    request: &AiRequestPayload,
) -> Result<CloudPostResponse, String> {
    post_cloud_ai_with_body(settings, prompt, Some(request))
}

fn post_cloud_ai_with_body(
    settings: &AppSettings,
    prompt: &str,
    request: Option<&AiRequestPayload>,
) -> Result<CloudPostResponse, String> {
    let api_key = settings.ai_api_key.trim();
    if api_key.is_empty() {
        return Err("API Key 未配置".to_string());
    }

    let mode = if settings.ai_endpoint_mode.trim().is_empty() {
        "responses"
    } else {
        settings.ai_endpoint_mode.trim()
    };
    let url = resolve_ai_endpoint_url(&settings.ai_api_base_url, mode);
    let model = cloud_ai_model_for_settings(settings);
    let body = request
        .map(|request| {
            build_cloud_ai_body_for_request(mode, &model, prompt, settings, false, request)
        })
        .unwrap_or_else(|| build_cloud_ai_body(mode, &model, prompt, settings, false));
    let timeout = Duration::from_secs(settings.ai_request_timeout_secs.clamp(5, 600));

    let client = build_cloud_ai_client(settings, timeout)?;
    let mut response_result = None;
    for attempt in 0..=settings.ai_retry_count.min(5) {
        match apply_custom_cloud_headers(client.post(&url), settings)?
            .bearer_auth(api_key)
            .json(&body)
            .send()
        {
            Ok(response) => {
                response_result = Some(Ok(response));
                break;
            }
            Err(error) => {
                if attempt >= settings.ai_retry_count.min(5) {
                    response_result = Some(Err(error));
                }
            }
        }
    }
    let response = response_result
        .unwrap_or_else(|| unreachable!("cloud retry loop should always set a response"))
        .map_err(|error| diagnose_network_error(&url, &error.to_string()))?;

    let status = response.status().as_u16();
    let payload = response.json::<Value>().unwrap_or_else(|_| json!({}));

    if status >= 300 {
        let message = payload
            .get("error")
            .and_then(|error| error.get("message"))
            .and_then(Value::as_str)
            .unwrap_or("云端服务返回错误");
        return Err(format!("{} · {}", diagnose_http_status(status), message));
    }

    let model = payload
        .get("model")
        .and_then(Value::as_str)
        .unwrap_or(&model)
        .to_string();

    Ok(CloudPostResponse {
        status,
        model,
        body: payload,
    })
}

fn post_cloud_ai_stream(
    app: &AppHandle,
    settings: &AppSettings,
    request_id: &str,
    prompt: &str,
    request: &AiRequestPayload,
) -> Result<String, String> {
    let api_key = settings.ai_api_key.trim();
    if api_key.is_empty() {
        return Err("API Key 未配置".to_string());
    }

    let mode = if settings.ai_endpoint_mode.trim().is_empty() {
        "responses"
    } else {
        settings.ai_endpoint_mode.trim()
    };
    let url = resolve_ai_endpoint_url(&settings.ai_api_base_url, mode);
    let model = cloud_ai_model_for_settings(settings);
    let body = build_cloud_ai_body_for_request(mode, &model, prompt, settings, true, request);
    let timeout = Duration::from_secs(settings.ai_request_timeout_secs.clamp(5, 600));

    let client = build_cloud_ai_client(settings, timeout)?;
    let mut response_result = None;
    for attempt in 0..=settings.ai_retry_count.min(5) {
        match apply_custom_cloud_headers(client.post(&url), settings)?
            .bearer_auth(api_key)
            .json(&body)
            .send()
        {
            Ok(response) => {
                response_result = Some(Ok(response));
                break;
            }
            Err(error) => {
                if attempt >= settings.ai_retry_count.min(5) {
                    response_result = Some(Err(error));
                }
            }
        }
    }
    let mut response = response_result
        .unwrap_or_else(|| unreachable!("cloud retry loop should always set a response"))
        .map_err(|error| diagnose_network_error(&url, &error.to_string()))?;

    let status = response.status().as_u16();
    if status >= 300 {
        let payload = response.json::<Value>().unwrap_or_else(|_| json!({}));
        let message = payload
            .get("error")
            .and_then(|error| error.get("message"))
            .and_then(Value::as_str)
            .unwrap_or("云端服务返回错误");
        return Err(format!("{} · {}", diagnose_http_status(status), message));
    }

    let mut buffered = String::new();
    let mut full_text = String::new();
    let mut chunk = [0_u8; 8192];
    loop {
        let read = response
            .read(&mut chunk)
            .map_err(|error| diagnose_network_error(&url, &error.to_string()))?;
        if read == 0 {
            break;
        }
        buffered.push_str(&String::from_utf8_lossy(&chunk[..read]));
        while let Some(newline_index) = buffered.find('\n') {
            let line = buffered[..newline_index].trim_end_matches('\r').to_string();
            buffered = buffered[newline_index + 1..].to_string();
            if let Some(token) = parse_streaming_line_token(&line) {
                if token.is_empty() {
                    continue;
                }
                full_text.push_str(&token);
                app.emit(
                    "cloud-ai-stream-token",
                    json!({ "requestId": request_id, "token": token }),
                )
                .map_err(|error| format!("无法发送云端流式 token：{error}"))?;
            }
        }
    }
    if let Some(token) = parse_streaming_line_token(buffered.trim()) {
        if !token.is_empty() {
            full_text.push_str(&token);
            app.emit(
                "cloud-ai-stream-token",
                json!({ "requestId": request_id, "token": token }),
            )
            .map_err(|error| format!("无法发送云端流式 token：{error}"))?;
        }
    }
    Ok(full_text.trim().to_string())
}

pub(crate) fn cloud_ai_model_for_settings(settings: &AppSettings) -> String {
    let model = settings.ai_model.trim();
    if model.is_empty() {
        CLOUD_MODEL.to_string()
    } else {
        model.to_string()
    }
}

fn build_cloud_ai_body(
    mode: &str,
    model: &str,
    prompt: &str,
    settings: &AppSettings,
    stream: bool,
) -> Value {
    build_cloud_ai_body_with_response_format(
        mode,
        model,
        prompt,
        settings,
        stream,
        settings.ai_response_format.trim(),
    )
}

fn build_cloud_ai_body_for_request(
    mode: &str,
    model: &str,
    prompt: &str,
    settings: &AppSettings,
    stream: bool,
    request: &AiRequestPayload,
) -> Value {
    let response_format = request
        .cloud_response_format
        .as_deref()
        .filter(|value| !value.trim().is_empty() && *value != "default")
        .unwrap_or_else(|| settings.ai_response_format.trim());
    build_cloud_ai_body_with_response_format(mode, model, prompt, settings, stream, response_format)
}

fn build_cloud_ai_body_with_response_format(
    mode: &str,
    model: &str,
    prompt: &str,
    settings: &AppSettings,
    stream: bool,
    response_format: &str,
) -> Value {
    let temperature = normalize_request_float(settings.ai_temperature, 0.2, 0.0, 2.0);
    let top_p = normalize_request_float(settings.ai_top_p, 1.0, 0.0, 1.0);
    let max_tokens = settings.ai_max_tokens.min(200_000);
    let reasoning_effort = settings.ai_reasoning_effort.trim();
    let mut body = if mode == "chat.completions" {
        json!({
            "model": model,
            "messages": [{ "role": "user", "content": prompt }],
            "temperature": temperature,
            "top_p": top_p
        })
    } else {
        json!({
            "model": model,
            "input": prompt,
            "temperature": temperature,
            "top_p": top_p
        })
    };
    if stream {
        body["stream"] = json!(true);
    }
    if max_tokens > 0 {
        if mode == "chat.completions" {
            body["max_tokens"] = json!(max_tokens);
        } else {
            body["max_output_tokens"] = json!(max_tokens);
        }
    }
    if !matches!(reasoning_effort, "" | "none") {
        if mode == "chat.completions" {
            body["reasoning_effort"] = json!(reasoning_effort);
        } else {
            body["reasoning"] = json!({ "effort": reasoning_effort });
        }
    }
    if response_format == "json_object" {
        if mode == "chat.completions" {
            body["response_format"] = json!({ "type": "json_object" });
        } else {
            body["text"] = json!({ "format": { "type": "json_object" } });
        }
    } else if response_format == "json_schema" {
        let schema = bookmind_ai_response_json_schema();
        if mode == "chat.completions" {
            body["response_format"] = json!({
                "type": "json_schema",
                "json_schema": {
                    "name": "bookmind_ai_response_v2",
                    "schema": schema,
                    "strict": false
                }
            });
        } else {
            body["text"] = json!({
                "format": {
                    "type": "json_schema",
                    "name": "bookmind_ai_response_v2",
                    "schema": schema,
                    "strict": false
                }
            });
        }
    }
    body
}

fn bookmind_ai_response_json_schema() -> Value {
    json!({
        "type": "object",
        "additionalProperties": true,
        "properties": {
            "schema": {
                "type": "string",
                "const": "bookmind.ai.response.v2"
            },
            "version": {
                "type": "string",
                "const": "bookmind.ai.response.v2"
            },
            "scope": {
                "type": "string"
            },
            "scope_label": {
                "type": "string"
            },
            "summary": {
                "type": ["object", "array", "string"]
            },
            "evidence": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": true,
                    "properties": {
                        "claim": {
                            "type": "string"
                        },
                        "references": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": true,
                                "properties": {
                                    "quote": {
                                        "type": "string"
                                    },
                                    "locationHint": {
                                        "type": "string"
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "diagnostics": {
                "type": ["object", "array", "string"]
            },
            "blocks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": true
                }
            }
        }
    })
}

fn normalize_request_float(value: f64, fallback: f64, min: f64, max: f64) -> f64 {
    if value.is_finite() {
        value.clamp(min, max)
    } else {
        fallback
    }
}

fn build_cloud_ai_prompt(request: &AiRequestPayload) -> String {
    if request.cloud_prompt_mode.as_deref() == Some("plain_text") {
        return [
            request.instruction.clone(),
            request
                .scope_text
                .as_ref()
                .filter(|value| !value.trim().is_empty())
                .map(|value| format!("Source text:\n{value}"))
                .unwrap_or_default(),
            request.user_text.clone(),
        ]
        .into_iter()
        .filter(|part| !part.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\n\n");
    }
    if request.cloud_prompt_mode.as_deref() == Some("agent_tool_decision") {
        return [
            "BookMind Agent tool-decision prompt: 只输出一个 JSON 对象，不要 Markdown，不要使用普通回答包装。".to_string(),
            request
                .scope_label
                .as_ref()
                .filter(|value| !value.trim().is_empty())
                .map(|value| format!("Scope label: {value}"))
                .unwrap_or_default(),
            request
                .conversation_context
                .as_ref()
                .filter(|value| !value.trim().is_empty())
                .map(|value| format!("Conversation history context:\n{value}"))
                .unwrap_or_default(),
            request.instruction.clone(),
            request.user_text.clone(),
        ]
        .into_iter()
        .filter(|part| !part.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\n\n");
    }
    [
        "BookMind system prompt: 优先输出 bookmind.ai.response.v2 JSON；所有事实性章节分析必须附引用；没有引用时输出 diagnostics 块，不要编造引用；用户询问工具时只列 BookMind 阅读工具：get_current_context、search_local_index、get_paragraph_window、jump_to_source、save_ai_note、save_citation_highlight、generate_flashcards、build_timeline、extract_characters、extract_foreshadowing、request_cloud_ai；禁止提到内部开发代理、命令行、仓库、补丁工具；云端模式的引用只能来自提供的上下文，未提供上下文时请说不确定或建议检索。".to_string(),
        "BookMind structured output contract: 必须只输出一个 JSON 对象，不要包 Markdown 代码块。顶层使用 {\"schema\":\"bookmind.ai.response.v2\",\"title\":\"...\",\"analysis\":{\"characters_extracted\":[{\"name\":\"人物名\",\"evidence\":[\"原文短句1\",\"原文短句2\"],\"citationIds\":[\"analysis_char_1_1\",\"analysis_char_1_2\"]}]},\"blocks\":[],\"citations\":[],\"diagnostics\":{}}。如果用户要求识别人物或分析人物，请在 blocks 中输出 character_table，并把人物列表同步放入 analysis.characters_extracted。citations 中必须有对应项：{\"id\":\"analysis_char_1_1\",\"type\":\"paragraph\",\"label\":\"人物名\",\"quote\":\"原文短句1\",\"snippet\":\"原文短句1\",\"sourceText\":\"原文短句1\"}。evidence、quote、snippet、sourceText 必须是 Context 中连续出现的原文短句，长度建议 6-40 个中文字符；不要改写、不要概括、不要跨句拼接、不要写“注：”、不要写“第32章提到”、不要把解释塞进 evidence。若不能在 Context 中找到连续原文短句，就不要抽取该人物，或放入 diagnostics.uncertain，不要生成可跳引用。".to_string(),
        format!("BookMind AI request scope: {}", request.scope),
        request
            .scope_label
            .as_ref()
            .filter(|value| !value.trim().is_empty())
            .map(|value| format!("Scope label: {value}"))
            .unwrap_or_default(),
        request.instruction.clone(),
        request.user_text.clone(),
        request
            .conversation_context
            .as_ref()
            .filter(|value| !value.trim().is_empty())
            .map(|value| format!("\nConversation history context:\n{value}"))
            .unwrap_or_default(),
        request
            .scope_text
            .as_ref()
            .filter(|value| !value.trim().is_empty())
            .map(|value| format!("\nContext:\n{value}"))
            .unwrap_or_default(),
    ]
    .into_iter()
    .filter(|part| !part.trim().is_empty())
    .collect::<Vec<_>>()
    .join("\n\n")
}

fn parse_openai_text(payload: &Value) -> String {
    if let Some(text) = payload.get("output_text").and_then(Value::as_str) {
        return text.to_string();
    }
    if let Some(content) = payload.get("content") {
        return content_value_to_text(content);
    }
    if let Some(choices) = payload.get("choices").and_then(Value::as_array) {
        if let Some(message) = choices
            .first()
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
        {
            return content_value_to_text(message);
        }
    }
    if let Some(output) = payload.get("output").and_then(Value::as_array) {
        return output
            .iter()
            .filter_map(|item| item.get("content"))
            .map(content_value_to_text)
            .filter(|text| !text.is_empty())
            .collect::<Vec<_>>()
            .join("\n")
            .trim()
            .to_string();
    }
    String::new()
}

fn content_value_to_text(value: &Value) -> String {
    if let Some(text) = value.as_str() {
        return text.to_string();
    }
    let Some(items) = value.as_array() else {
        return String::new();
    };
    items
        .iter()
        .filter_map(|item| {
            if let Some(text) = item.as_str() {
                Some(text.to_string())
            } else {
                item.get("text")
                    .or_else(|| item.get("output_text"))
                    .or_else(|| item.get("content"))
                    .and_then(Value::as_str)
                    .map(str::to_string)
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn parse_model_ids(payload: &Value) -> Vec<String> {
    payload
        .get("data")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("id").and_then(Value::as_str))
                .filter(|id| !id.trim().is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn parse_streaming_line_token(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed == "data: [DONE]" || trimmed == "[DONE]" {
        return None;
    }
    let payload = trimmed.strip_prefix("data:").unwrap_or(trimmed).trim();
    if payload.is_empty() || payload == "[DONE]" {
        return None;
    }
    let value = serde_json::from_str::<Value>(payload).ok()?;
    if value.get("type").and_then(Value::as_str) == Some("response.output_text.delta") {
        return value
            .get("delta")
            .and_then(Value::as_str)
            .map(str::to_string);
    }
    if let Some(delta) = value.get("delta").and_then(Value::as_str) {
        return Some(delta.to_string());
    }
    if let Some(output_text) = value.get("output_text").and_then(Value::as_str) {
        return Some(output_text.to_string());
    }
    value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("delta"))
        .and_then(|delta| delta.get("content"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn diagnose_http_status(status: u16) -> String {
    match status {
        401 | 403 => "认证失败，请检查 API Key".to_string(),
        404 => "Endpoint 路径错误".to_string(),
        429 => "请求限流".to_string(),
        500..=599 => "服务端错误".to_string(),
        _ => format!("HTTP {status}"),
    }
}

fn diagnose_network_error(url: &str, error: &str) -> String {
    format!("云端请求失败：{} · {}", url, redact_api_secrets(error))
}

fn redact_api_secrets(value: &str) -> String {
    value
        .split_whitespace()
        .map(|part| {
            if part.starts_with("sk-") || part.starts_with("Bearer ") {
                "[hidden]"
            } else {
                part
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}
