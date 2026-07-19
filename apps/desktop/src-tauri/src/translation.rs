use crate::cloud_ai::request_cloud_ai_answer_in;
use crate::models::{
    AiProviderProfile, AiRequestPayload, AppSettings, TranslationRequestPayload,
    TranslationResponsePayload, TranslationSource,
};
use reqwest::blocking::{Client, Response};
use reqwest::redirect::Policy;
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use url::{Host, Url};

const MAX_TRANSLATION_TEXT_BYTES: usize = 100_000;
const MAX_TRANSLATION_RESPONSE_BYTES: usize = 1_000_000;
const BAIDU_TRANSLATION_TEXT_BYTES: usize = 6_000;
const GOOGLE_TRANSLATION_TEXT_CHARS: usize = 30_000;
const MICROSOFT_TRANSLATION_TEXT_CHARS: usize = 50_000;
const BAIDU_TRANSLATE_ENDPOINT: &str = "https://fanyi-api.baidu.com/api/trans/vip/translate";
const GOOGLE_TRANSLATE_ENDPOINT: &str = "https://translation.googleapis.com/language/translate/v2";
const MICROSOFT_TRANSLATOR_ENDPOINT: &str = "https://api.cognitive.microsofttranslator.com";

#[derive(Serialize)]
struct LibreTranslateRequest<'a> {
    q: &'a str,
    source: &'a str,
    target: &'a str,
    format: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    api_key: Option<&'a str>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LibreTranslateResponse {
    translated_text: String,
}

#[derive(Serialize)]
struct BaiduTranslateRequest<'a> {
    q: &'a str,
    from: &'a str,
    to: &'a str,
    appid: &'a str,
    salt: &'a str,
    sign: &'a str,
}

#[derive(Deserialize)]
struct BaiduTranslateResult {
    dst: String,
}

#[derive(Deserialize)]
struct BaiduTranslateResponse {
    #[serde(default)]
    trans_result: Vec<BaiduTranslateResult>,
    error_code: Option<String>,
    error_msg: Option<String>,
}

#[derive(Serialize)]
struct GoogleTranslateRequest<'a> {
    q: &'a str,
    target: &'a str,
    format: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    source: Option<&'a str>,
}

#[derive(Deserialize)]
struct GoogleTranslateResponse {
    data: GoogleTranslateData,
}

#[derive(Deserialize)]
struct GoogleTranslateData {
    translations: Vec<GoogleTranslation>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoogleTranslation {
    translated_text: String,
}

#[derive(Deserialize)]
struct ProviderErrorResponse {
    error: ProviderError,
}

#[derive(Deserialize)]
struct ProviderError {
    code: serde_json::Value,
    message: String,
}

#[derive(Serialize)]
struct MicrosoftTranslateRequest<'a> {
    #[serde(rename = "Text")]
    text: &'a str,
}

#[derive(Deserialize)]
struct MicrosoftTranslateResponse {
    translations: Vec<MicrosoftTranslation>,
}

#[derive(Deserialize)]
struct MicrosoftTranslation {
    text: String,
}

pub(crate) fn translate_with_configured_source(
    settings: &AppSettings,
    request: &TranslationRequestPayload,
) -> Result<TranslationResponsePayload, String> {
    validate_translation_request(request)?;
    let source = settings
        .translation_sources
        .iter()
        .find(|source| source.id == request.source_id)
        .ok_or_else(|| "Translation source was not found".to_string())?;
    if !source.enabled {
        return Err("Translation source is disabled".to_string());
    }
    validate_provider_text_limit(source, request)?;
    match source.kind.as_str() {
        "libretranslate" => translate_with_libretranslate(source, request),
        "baidu-translate" => translate_with_baidu(source, request),
        "google-translate" => translate_with_google(source, request),
        "microsoft-translator" => translate_with_microsoft(source, request),
        "ai-model" => translate_with_ai_model(settings, source, request),
        _ => Err("Translation source type is unsupported".to_string()),
    }
    .map_err(|error| redact_api_key(&error, source.api_key.trim()))
}

fn translate_with_libretranslate(
    source: &TranslationSource,
    request: &TranslationRequestPayload,
) -> Result<TranslationResponsePayload, String> {
    let endpoint = resolve_translate_url(&source.api_base_url, "")?;
    let api_key = source.api_key.trim();
    let body = LibreTranslateRequest {
        q: &request.text,
        source: libretranslate_language_code(&request.source_language),
        target: libretranslate_language_code(&request.target_language),
        format: "text",
        api_key: (!api_key.is_empty()).then_some(api_key),
    };
    let client = translation_client(source)?;
    let response = client
        .post(endpoint)
        .json(&body)
        .send()
        .map_err(|_| "Translation request failed".to_string())?;
    let status = response.status();
    let bytes = read_translation_response(response)?;
    ensure_success_status(status.as_u16(), status.is_success())?;
    let payload: LibreTranslateResponse = parse_translation_json(&bytes)?;
    if payload.translated_text.trim().is_empty() {
        return Err("Translation service returned an empty translation".to_string());
    }
    Ok(TranslationResponsePayload {
        translated_text: payload.translated_text,
    })
}

fn translate_with_baidu(
    source: &TranslationSource,
    request: &TranslationRequestPayload,
) -> Result<TranslationResponsePayload, String> {
    let app_id = source.app_id.trim();
    let secret = source.api_key.trim();
    if app_id.is_empty() {
        return Err("Baidu Translate app ID is missing".to_string());
    }
    if secret.is_empty() {
        return Err("Baidu Translate secret is missing".to_string());
    }
    let endpoint = resolve_exact_url(&source.api_base_url, BAIDU_TRANSLATE_ENDPOINT)?;
    let salt = translation_salt();
    let sign = baidu_signature(app_id, &request.text, &salt, secret);
    let body = BaiduTranslateRequest {
        q: &request.text,
        from: baidu_language_code(&request.source_language),
        to: baidu_language_code(&request.target_language),
        appid: app_id,
        salt: &salt,
        sign: &sign,
    };
    let response = translation_client(source)?
        .post(endpoint)
        .form(&body)
        .send()
        .map_err(|_| "Translation request failed".to_string())?;
    let status = response.status();
    let bytes = read_translation_response(response)?;
    ensure_success_status(status.as_u16(), status.is_success())?;
    parse_baidu_response(&bytes)
}

fn translate_with_google(
    source: &TranslationSource,
    request: &TranslationRequestPayload,
) -> Result<TranslationResponsePayload, String> {
    let api_key = source.api_key.trim();
    if api_key.is_empty() {
        return Err("Google Translation API key is missing".to_string());
    }
    let mut endpoint = resolve_exact_url(&source.api_base_url, GOOGLE_TRANSLATE_ENDPOINT)?;
    endpoint.set_query(None);
    endpoint.query_pairs_mut().append_pair("key", api_key);
    let body = GoogleTranslateRequest {
        q: &request.text,
        target: google_language_code(&request.target_language)
            .ok_or_else(|| "Unsupported target language".to_string())?,
        format: "text",
        source: google_language_code(&request.source_language),
    };
    let response = translation_client(source)?
        .post(endpoint)
        .json(&body)
        .send()
        .map_err(|_| "Translation request failed".to_string())?;
    let status = response.status();
    let bytes = read_translation_response(response)?;
    if !status.is_success() {
        return Err(parse_provider_error(&bytes)
            .unwrap_or_else(|| format!("Translation service returned HTTP {}", status.as_u16())));
    }
    parse_google_response(&bytes)
}

fn translate_with_microsoft(
    source: &TranslationSource,
    request: &TranslationRequestPayload,
) -> Result<TranslationResponsePayload, String> {
    let api_key = source.api_key.trim();
    if api_key.is_empty() {
        return Err("Microsoft Translator API key is missing".to_string());
    }
    let mut endpoint = resolve_translate_url(&source.api_base_url, MICROSOFT_TRANSLATOR_ENDPOINT)?;
    endpoint.set_query(None);
    {
        let mut query = endpoint.query_pairs_mut();
        query.append_pair("api-version", "3.0").append_pair(
            "to",
            microsoft_language_code(&request.target_language)
                .ok_or_else(|| "Unsupported target language".to_string())?,
        );
        if let Some(source_language) = microsoft_language_code(&request.source_language) {
            query.append_pair("from", source_language);
        }
    }
    let body = [MicrosoftTranslateRequest {
        text: &request.text,
    }];
    let mut request_builder = translation_client(source)?
        .post(endpoint)
        .header("Ocp-Apim-Subscription-Key", api_key)
        .json(&body);
    let region = source.region.trim();
    if !region.is_empty() {
        request_builder = request_builder.header("Ocp-Apim-Subscription-Region", region);
    }
    let response = request_builder
        .send()
        .map_err(|_| "Translation request failed".to_string())?;
    let status = response.status();
    let bytes = read_translation_response(response)?;
    if !status.is_success() {
        return Err(parse_provider_error(&bytes)
            .unwrap_or_else(|| format!("Translation service returned HTTP {}", status.as_u16())));
    }
    parse_microsoft_response(&bytes)
}

fn translation_client(source: &TranslationSource) -> Result<Client, String> {
    Client::builder()
        .redirect(Policy::none())
        .timeout(Duration::from_secs(
            source.request_timeout_secs.clamp(5, 600),
        ))
        .build()
        .map_err(|_| "Could not create translation client".to_string())
}

fn read_translation_response(response: Response) -> Result<Vec<u8>, String> {
    if response
        .content_length()
        .is_some_and(|length| length > MAX_TRANSLATION_RESPONSE_BYTES as u64)
    {
        return Err("Translation response is too large".to_string());
    }
    let mut bytes = Vec::new();
    response
        .take(MAX_TRANSLATION_RESPONSE_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Could not read translation response".to_string())?;
    if bytes.len() > MAX_TRANSLATION_RESPONSE_BYTES {
        return Err("Translation response is too large".to_string());
    }
    Ok(bytes)
}

fn ensure_success_status(status: u16, success: bool) -> Result<(), String> {
    if success {
        Ok(())
    } else {
        Err(format!("Translation service returned HTTP {status}"))
    }
}

fn parse_translation_json<T: for<'de> Deserialize<'de>>(bytes: &[u8]) -> Result<T, String> {
    serde_json::from_slice(bytes)
        .map_err(|_| "Translation service returned an invalid response".to_string())
}

fn parse_baidu_response(bytes: &[u8]) -> Result<TranslationResponsePayload, String> {
    let payload: BaiduTranslateResponse = parse_translation_json(bytes)?;
    if let Some(code) = payload.error_code {
        let message = payload
            .error_msg
            .unwrap_or_else(|| "unknown error".to_string());
        return Err(format!("Baidu Translate error {code}: {message}"));
    }
    let translated_text = payload
        .trans_result
        .into_iter()
        .map(|result| result.dst)
        .collect::<Vec<_>>()
        .join("\n");
    nonempty_translation(translated_text)
}

fn parse_google_response(bytes: &[u8]) -> Result<TranslationResponsePayload, String> {
    let payload: GoogleTranslateResponse = parse_translation_json(bytes)?;
    let translated_text = payload
        .data
        .translations
        .into_iter()
        .map(|translation| decode_basic_html_entities(&translation.translated_text))
        .collect::<Vec<_>>()
        .join("\n");
    nonempty_translation(translated_text)
}

fn parse_microsoft_response(bytes: &[u8]) -> Result<TranslationResponsePayload, String> {
    let payload: Vec<MicrosoftTranslateResponse> = parse_translation_json(bytes)?;
    let translated_text = payload
        .into_iter()
        .next()
        .and_then(|result| result.translations.into_iter().next())
        .map(|translation| translation.text)
        .unwrap_or_default();
    nonempty_translation(translated_text)
}

fn nonempty_translation(translated_text: String) -> Result<TranslationResponsePayload, String> {
    if translated_text.trim().is_empty() {
        return Err("Translation service returned an empty translation".to_string());
    }
    Ok(TranslationResponsePayload { translated_text })
}

fn parse_provider_error(bytes: &[u8]) -> Option<String> {
    let payload: ProviderErrorResponse = serde_json::from_slice(bytes).ok()?;
    Some(format!(
        "Translation service error {}: {}",
        payload.error.code, payload.error.message
    ))
}

fn translation_salt() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
        .to_string()
}

fn baidu_signature(app_id: &str, text: &str, salt: &str, secret: &str) -> String {
    format!(
        "{:x}",
        md5::compute(format!("{app_id}{text}{salt}{secret}"))
    )
}

fn translate_with_ai_model(
    settings: &AppSettings,
    source: &TranslationSource,
    request: &TranslationRequestPayload,
) -> Result<TranslationResponsePayload, String> {
    let provider = resolve_ai_translation_provider(settings, source)
        .ok_or_else(|| "Translation AI provider was not found".to_string())?;
    if !provider.enabled {
        return Err("Translation AI provider is disabled".to_string());
    }
    if provider.api_key.trim().is_empty() {
        return Err("Translation AI provider API key is missing".to_string());
    }
    let model = if source.model.trim().is_empty() || provider.id != source.provider_id {
        provider.model.trim()
    } else {
        source.model.trim()
    };
    if model.is_empty() {
        return Err("Translation AI model is missing".to_string());
    }

    let mut transport_settings = settings.clone();
    transport_settings.ai_api_key = provider.api_key.clone();
    transport_settings.ai_api_base_url = provider.api_base_url.clone();
    transport_settings.ai_endpoint_mode = provider.endpoint_mode.clone();
    transport_settings.ai_model = model.to_string();
    transport_settings.ai_request_timeout_secs = provider.request_timeout_secs;
    transport_settings.ai_retry_count = provider.retry_count;
    transport_settings.ai_proxy_url = provider.proxy_url.clone();
    transport_settings.ai_custom_headers = provider.custom_headers.clone();
    transport_settings.ai_streaming_enabled = false;
    transport_settings.ai_temperature = provider.temperature;
    transport_settings.ai_max_tokens = provider.max_tokens;
    transport_settings.ai_top_p = provider.top_p;
    transport_settings.ai_reasoning_effort = provider.reasoning_effort.clone();
    transport_settings.ai_response_format = "auto".to_string();

    let ai_request = AiRequestPayload {
        scope: "selection-translation".to_string(),
        instruction: build_ai_translation_instruction(
            &request.source_language,
            &request.target_language,
        ),
        user_text: String::new(),
        selected_command_id: Some("translate-selection".to_string()),
        retrieval_strategy: None,
        retrieval_query: None,
        multi_stage_retrieval_mode: None,
        local_result_limit: None,
        citation_min_confidence: None,
        book_id: None,
        scope_text: Some(request.text.clone()),
        scope_label: Some("Selected reader text".to_string()),
        conversation_context: None,
        mode: Some("cloud".to_string()),
        interaction_mode: Some("qa".to_string()),
        require_cloud_api: Some(true),
        cloud_prompt_mode: Some("plain_text".to_string()),
        cloud_response_format: Some("text".to_string()),
        request_id: Some(request.request_id.clone()),
    };
    let response = request_cloud_ai_answer_in(&transport_settings, &ai_request)?;
    if response.answer.trim().is_empty() {
        return Err("Translation service returned an empty translation".to_string());
    }
    Ok(TranslationResponsePayload {
        translated_text: response.answer,
    })
}

fn resolve_ai_translation_provider<'a>(
    settings: &'a AppSettings,
    source: &TranslationSource,
) -> Option<&'a AiProviderProfile> {
    let configured = settings
        .ai_provider_profiles
        .iter()
        .find(|provider| provider.id == source.provider_id);
    if configured.is_some() || source.id != "translation-ai-default" {
        return configured;
    }

    settings
        .ai_provider_profiles
        .iter()
        .find(|provider| {
            provider.id == settings.ai_active_provider_profile_id
                && is_ai_translation_provider_configured(provider)
        })
        .or_else(|| {
            settings
                .ai_provider_profiles
                .iter()
                .find(|provider| is_ai_translation_provider_configured(provider))
        })
}

fn is_ai_translation_provider_configured(provider: &AiProviderProfile) -> bool {
    provider.enabled
        && !provider.api_base_url.trim().is_empty()
        && !provider.model.trim().is_empty()
}

fn validate_translation_request(request: &TranslationRequestPayload) -> Result<(), String> {
    if request.source_id.trim().is_empty() {
        return Err("Translation source is required".to_string());
    }
    if request.text.trim().is_empty() {
        return Err("Translation text is required".to_string());
    }
    if request.text.len() > MAX_TRANSLATION_TEXT_BYTES {
        return Err("Translation text is too large".to_string());
    }
    if !is_translation_language(&request.source_language, true) {
        return Err("Unsupported source language".to_string());
    }
    if !is_translation_language(&request.target_language, false) {
        return Err("Unsupported target language".to_string());
    }
    Ok(())
}

fn validate_provider_text_limit(
    source: &TranslationSource,
    request: &TranslationRequestPayload,
) -> Result<(), String> {
    let within_limit = match source.kind.as_str() {
        "baidu-translate" => request.text.len() <= BAIDU_TRANSLATION_TEXT_BYTES,
        "google-translate" => request.text.chars().count() <= GOOGLE_TRANSLATION_TEXT_CHARS,
        "microsoft-translator" => request.text.chars().count() <= MICROSOFT_TRANSLATION_TEXT_CHARS,
        _ => true,
    };
    if within_limit {
        Ok(())
    } else {
        Err(format!(
            "Translation text exceeds the {} provider limit",
            source.name
        ))
    }
}

fn is_translation_language(value: &str, allow_auto: bool) -> bool {
    matches!(
        value,
        "zh-CN" | "zh-TW" | "en" | "ja" | "ko" | "fr" | "de" | "es" | "ru"
    ) || (allow_auto && value == "auto")
}

fn libretranslate_language_code(value: &str) -> &str {
    match value {
        "zh-CN" => "zh",
        "zh-TW" => "zt",
        _ => value,
    }
}

fn baidu_language_code(value: &str) -> &str {
    match value {
        "zh-CN" => "zh",
        "zh-TW" => "cht",
        "ja" => "jp",
        "ko" => "kor",
        "fr" => "fra",
        "es" => "spa",
        _ => value,
    }
}

fn google_language_code(value: &str) -> Option<&str> {
    match value {
        "auto" => None,
        "zh-CN" => Some("zh-CN"),
        "zh-TW" => Some("zh-TW"),
        "en" => Some("en"),
        "ja" => Some("ja"),
        "ko" => Some("ko"),
        "fr" => Some("fr"),
        "de" => Some("de"),
        "es" => Some("es"),
        "ru" => Some("ru"),
        _ => None,
    }
}

fn microsoft_language_code(value: &str) -> Option<&str> {
    match value {
        "auto" => None,
        "zh-CN" => Some("zh-Hans"),
        "zh-TW" => Some("zh-Hant"),
        "en" => Some("en"),
        "ja" => Some("ja"),
        "ko" => Some("ko"),
        "fr" => Some("fr"),
        "de" => Some("de"),
        "es" => Some("es"),
        "ru" => Some("ru"),
        _ => None,
    }
}

fn build_ai_translation_instruction(source_language: &str, target_language: &str) -> String {
    format!(
        "Translate from {} to {}. Preserve meaning, tone, paragraph breaks, names, and key terms. Return only the translation without a title, quotation marks, commentary, or the source text.",
        translation_language_label(source_language),
        translation_language_label(target_language),
    )
}

fn translation_language_label(value: &str) -> &'static str {
    match value {
        "auto" => "the automatically detected source language",
        "zh-CN" => "Simplified Chinese",
        "zh-TW" => "Traditional Chinese",
        "en" => "English",
        "ja" => "Japanese",
        "ko" => "Korean",
        "fr" => "French",
        "de" => "German",
        "es" => "Spanish",
        "ru" => "Russian",
        _ => "the requested language",
    }
}

fn resolve_exact_url(endpoint: &str, default_endpoint: &str) -> Result<Url, String> {
    let endpoint = if endpoint.trim().is_empty() {
        default_endpoint
    } else {
        endpoint.trim()
    };
    let url = Url::parse(endpoint).map_err(|_| "Translation endpoint is invalid".to_string())?;
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Translation endpoint must not contain credentials".to_string());
    }
    match url.scheme() {
        "https" => {}
        "http" if is_loopback_host(&url) => {}
        "http" => return Err("Translation endpoint must use HTTPS".to_string()),
        _ => return Err("Translation endpoint must use HTTPS".to_string()),
    }
    Ok(url)
}

fn resolve_translate_url(endpoint: &str, default_endpoint: &str) -> Result<Url, String> {
    let mut url = resolve_exact_url(endpoint, default_endpoint)?;

    let path = url.path().trim_end_matches('/').to_string();
    if !path.ends_with("/translate") {
        let next_path = if path.is_empty() {
            "/translate".to_string()
        } else {
            format!("{path}/translate")
        };
        url.set_path(&next_path);
    } else if path != url.path() {
        url.set_path(&path);
    }
    Ok(url)
}

fn decode_basic_html_entities(value: &str) -> String {
    let mut decoded = String::with_capacity(value.len());
    let mut remaining = value;
    while let Some(start) = remaining.find('&') {
        decoded.push_str(&remaining[..start]);
        let entity_start = start + 1;
        let Some(relative_end) = remaining[entity_start..].find(';') else {
            decoded.push_str(&remaining[start..]);
            return decoded;
        };
        let entity_end = entity_start + relative_end;
        let entity = &remaining[entity_start..entity_end];
        if let Some(replacement) = decode_html_entity(entity) {
            decoded.push_str(&replacement);
            remaining = &remaining[entity_end + 1..];
        } else {
            decoded.push('&');
            remaining = &remaining[entity_start..];
        }
    }
    decoded.push_str(remaining);
    decoded
}

fn decode_html_entity(entity: &str) -> Option<String> {
    let named = match entity {
        "amp" => Some("&"),
        "lt" => Some("<"),
        "gt" => Some(">"),
        "quot" => Some("\""),
        "apos" | "#39" => Some("'"),
        _ => None,
    };
    if let Some(value) = named {
        return Some(value.to_string());
    }
    let code_point = entity
        .strip_prefix("#x")
        .or_else(|| entity.strip_prefix("#X"))
        .and_then(|value| u32::from_str_radix(value, 16).ok())
        .or_else(|| {
            entity
                .strip_prefix('#')
                .and_then(|value| value.parse::<u32>().ok())
        })?;
    char::from_u32(code_point).map(|character| character.to_string())
}

fn is_loopback_host(url: &Url) -> bool {
    match url.host() {
        Some(Host::Domain(domain)) => domain.eq_ignore_ascii_case("localhost"),
        Some(Host::Ipv4(address)) => address.is_loopback(),
        Some(Host::Ipv6(address)) => address.is_loopback(),
        None => false,
    }
}

fn redact_api_key(message: &str, api_key: &str) -> String {
    if api_key.is_empty() {
        message.to_string()
    } else {
        message.replace(api_key, "[hidden]")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;

    fn request(source_id: &str) -> TranslationRequestPayload {
        TranslationRequestPayload {
            source_id: source_id.to_string(),
            text: "Hello".to_string(),
            source_language: "en".to_string(),
            target_language: "zh-CN".to_string(),
            request_id: "translation-test".to_string(),
        }
    }

    fn settings(source: TranslationSource) -> AppSettings {
        AppSettings {
            translation_sources: vec![source],
            ..AppSettings::default()
        }
    }

    fn source(endpoint: String) -> TranslationSource {
        TranslationSource {
            id: "libre-local".to_string(),
            name: "Local LibreTranslate".to_string(),
            kind: "libretranslate".to_string(),
            enabled: true,
            provider_id: String::new(),
            model: String::new(),
            api_base_url: endpoint,
            api_key: "secret-key".to_string(),
            app_id: String::new(),
            region: String::new(),
            request_timeout_secs: 1,
        }
    }

    #[test]
    fn translation_url_requires_https_except_loopback_and_appends_path_once() {
        assert_eq!(
            resolve_translate_url("https://translate.example.test/api", "")
                .expect("HTTPS endpoint should resolve")
                .as_str(),
            "https://translate.example.test/api/translate"
        );
        assert_eq!(
            resolve_translate_url("http://localhost:5000/translate/", "")
                .expect("loopback HTTP should resolve")
                .as_str(),
            "http://localhost:5000/translate"
        );
        assert!(resolve_translate_url("http://translate.example.test", "").is_err());
        assert!(resolve_translate_url("https://user:pass@translate.example.test", "").is_err());
        assert_eq!(
            resolve_exact_url("", GOOGLE_TRANSLATE_ENDPOINT)
                .expect("default endpoint should resolve")
                .as_str(),
            GOOGLE_TRANSLATE_ENDPOINT
        );
    }

    #[test]
    fn translation_request_validates_source_and_languages() {
        let configured = settings(source("https://translate.example.test".to_string()));
        let mut invalid = request("missing");
        assert!(translate_with_configured_source(&configured, &invalid).is_err());

        let mut disabled_source = source("https://translate.example.test".to_string());
        disabled_source.enabled = false;
        assert_eq!(
            translate_with_configured_source(&settings(disabled_source), &request("libre-local")),
            Err("Translation source is disabled".to_string())
        );

        let mut wrong_kind = source("https://translate.example.test".to_string());
        wrong_kind.kind = "unsupported".to_string();
        assert_eq!(
            translate_with_configured_source(&settings(wrong_kind), &request("libre-local")),
            Err("Translation source type is unsupported".to_string())
        );

        invalid.source_id = "libre-local".to_string();
        invalid.target_language = "auto".to_string();
        assert!(translate_with_configured_source(&configured, &invalid).is_err());

        invalid.target_language = "zh-CN".to_string();
        invalid.text = " ".to_string();
        assert!(translate_with_configured_source(&configured, &invalid).is_err());
    }

    #[test]
    fn translation_payloads_use_frontend_camel_case_and_optional_api_key() {
        let command_request =
            serde_json::to_value(request("libre-local")).expect("command request should serialize");
        assert_eq!(command_request["sourceId"], "libre-local");
        assert_eq!(command_request["sourceLanguage"], "en");
        assert_eq!(command_request["targetLanguage"], "zh-CN");

        let transport_request = LibreTranslateRequest {
            q: "Hello",
            source: "en",
            target: "zh-CN",
            format: "text",
            api_key: None,
        };
        let transport_request =
            serde_json::to_value(transport_request).expect("transport request should serialize");
        assert!(transport_request.get("api_key").is_none());

        let command_response = serde_json::to_value(TranslationResponsePayload {
            translated_text: "Translated".to_string(),
        })
        .expect("command response should serialize");
        assert_eq!(command_response["translatedText"], "Translated");
    }

    #[test]
    fn provider_payloads_serialize_protocol_specific_fields() {
        let google = serde_json::to_value(GoogleTranslateRequest {
            q: "Hello",
            target: "zh-CN",
            format: "text",
            source: None,
        })
        .expect("Google request should serialize");
        assert_eq!(
            google,
            serde_json::json!({
                "q": "Hello",
                "target": "zh-CN",
                "format": "text"
            })
        );

        let microsoft = serde_json::to_value([MicrosoftTranslateRequest { text: "Hello" }])
            .expect("Microsoft request should serialize");
        assert_eq!(microsoft, serde_json::json!([{ "Text": "Hello" }]));

        let baidu = BaiduTranslateRequest {
            q: "Hello",
            from: "en",
            to: "zh",
            appid: "app-id",
            salt: "123",
            sign: "signature",
        };
        let baidu = serde_json::to_value(baidu).expect("Baidu request should serialize");
        assert_eq!(baidu["appid"], "app-id");
        assert_eq!(baidu["from"], "en");
        assert_eq!(baidu["to"], "zh");
        assert_eq!(baidu["sign"], "signature");
        assert_eq!(
            baidu_signature("app-id", "Hello", "123", "secret"),
            "2f34d1a539bff9ce34f409ac0b255042"
        );
    }

    #[test]
    fn provider_language_maps_cover_supported_languages_and_auto() {
        assert_eq!(baidu_language_code("auto"), "auto");
        assert_eq!(baidu_language_code("zh-CN"), "zh");
        assert_eq!(baidu_language_code("zh-TW"), "cht");
        assert_eq!(baidu_language_code("ja"), "jp");
        assert_eq!(baidu_language_code("ko"), "kor");
        assert_eq!(baidu_language_code("fr"), "fra");
        assert_eq!(baidu_language_code("es"), "spa");
        for language in ["en", "de", "ru"] {
            assert_eq!(baidu_language_code(language), language);
        }

        assert_eq!(google_language_code("auto"), None);
        assert_eq!(google_language_code("zh-CN"), Some("zh-CN"));
        assert_eq!(google_language_code("zh-TW"), Some("zh-TW"));
        assert_eq!(microsoft_language_code("auto"), None);
        assert_eq!(microsoft_language_code("zh-CN"), Some("zh-Hans"));
        assert_eq!(microsoft_language_code("zh-TW"), Some("zh-Hant"));
        for language in ["en", "ja", "ko", "fr", "de", "es", "ru"] {
            assert_eq!(google_language_code(language), Some(language));
            assert_eq!(microsoft_language_code(language), Some(language));
        }
    }

    #[test]
    fn provider_response_parsers_extract_translations_and_errors() {
        let baidu = parse_baidu_response(br#"{"trans_result":[{"dst":"First"},{"dst":"Second"}]}"#)
            .expect("Baidu response should parse");
        assert_eq!(baidu.translated_text, "First\nSecond");
        assert_eq!(
            parse_baidu_response(br#"{"error_code":"54003","error_msg":"Invalid Access Limit"}"#),
            Err("Baidu Translate error 54003: Invalid Access Limit".to_string())
        );

        let google = parse_google_response(
            br#"{"data":{"translations":[{"translatedText":"Tom &amp; Jerry &#39;ok&#39; &lt;x&gt; &#x4E2D;"}]}}"#,
        )
        .expect("Google response should parse");
        assert_eq!(google.translated_text, "Tom & Jerry 'ok' <x> 中");
        assert_eq!(
            decode_basic_html_entities("&amp;lt; &unknown;"),
            "&lt; &unknown;"
        );

        let microsoft = parse_microsoft_response(
            br#"[{"translations":[{"text":"Translated","to":"zh-Hans"}]}]"#,
        )
        .expect("Microsoft response should parse");
        assert_eq!(microsoft.translated_text, "Translated");
    }

    #[test]
    fn dispatch_recognizes_all_native_translation_source_kinds() {
        for (kind, expected_error) in [
            ("baidu-translate", "Baidu Translate app ID is missing"),
            ("google-translate", "Google Translation API key is missing"),
            (
                "microsoft-translator",
                "Microsoft Translator API key is missing",
            ),
        ] {
            let mut configured_source = source(String::new());
            configured_source.kind = kind.to_string();
            configured_source.api_key.clear();
            assert_eq!(
                translate_with_configured_source(
                    &settings(configured_source),
                    &request("libre-local")
                ),
                Err(expected_error.to_string())
            );
        }
    }

    #[test]
    fn provider_specific_text_limits_reject_oversized_requests_before_transport() {
        for (kind, text) in [
            (
                "baidu-translate",
                "a".repeat(BAIDU_TRANSLATION_TEXT_BYTES + 1),
            ),
            (
                "google-translate",
                "a".repeat(GOOGLE_TRANSLATION_TEXT_CHARS + 1),
            ),
            (
                "microsoft-translator",
                "a".repeat(MICROSOFT_TRANSLATION_TEXT_CHARS + 1),
            ),
        ] {
            let mut configured_source = source("https://translate.example.test".to_string());
            configured_source.kind = kind.to_string();
            configured_source.name = kind.to_string();
            let mut oversized = request("libre-local");
            oversized.text = text;
            assert!(validate_provider_text_limit(&configured_source, &oversized)
                .expect_err("oversized provider request must fail")
                .contains("provider limit"));
        }

        let mut google = source("https://translate.example.test".to_string());
        google.kind = "google-translate".to_string();
        let mut boundary = request("libre-local");
        boundary.text = "中".repeat(GOOGLE_TRANSLATION_TEXT_CHARS);
        assert!(validate_provider_text_limit(&google, &boundary).is_ok());
    }

    #[test]
    fn translation_posts_libretranslate_json_and_parses_translated_text() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("test server should bind");
        let address = listener
            .local_addr()
            .expect("test server address should resolve");
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("test request should connect");
            let mut bytes = Vec::new();
            let mut chunk = [0_u8; 1024];
            loop {
                let read = stream.read(&mut chunk).expect("request should be readable");
                bytes.extend_from_slice(&chunk[..read]);
                let request = String::from_utf8_lossy(&bytes);
                let Some(header_end) = request.find("\r\n\r\n") else {
                    continue;
                };
                let content_length = request[..header_end]
                    .lines()
                    .find_map(|line| {
                        line.strip_prefix("content-length: ")
                            .or_else(|| line.strip_prefix("Content-Length: "))
                    })
                    .and_then(|value| value.parse::<usize>().ok())
                    .expect("request should have content length");
                if bytes.len() >= header_end + 4 + content_length {
                    break;
                }
            }
            let raw = String::from_utf8(bytes).expect("request should be UTF-8");
            assert!(raw.starts_with("POST /translate HTTP/1.1\r\n"));
            let body = raw
                .split_once("\r\n\r\n")
                .expect("request should have body")
                .1;
            let body: serde_json::Value = serde_json::from_str(body).expect("body should be JSON");
            assert_eq!(body["q"], "Hello");
            assert_eq!(body["source"], "en");
            assert_eq!(body["target"], "zh");
            assert_eq!(body["format"], "text");
            assert_eq!(body["api_key"], "secret-key");

            let response_body = r#"{"translatedText":"Translated"}"#;
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                response_body.len(),
                response_body
            )
            .expect("response should be writable");
        });

        let configured = settings(source(format!("http://{address}")));
        let response = translate_with_configured_source(&configured, &request("libre-local"))
            .expect("translation should succeed");
        assert_eq!(response.translated_text, "Translated");
        server.join().expect("test server should finish");
    }

    #[test]
    fn api_key_redaction_never_returns_the_configured_key() {
        assert_eq!(
            redact_api_key("server echoed secret-key", "secret-key"),
            "server echoed [hidden]"
        );
    }

    #[test]
    fn ai_translation_instruction_uses_allowlisted_language_labels() {
        let instruction = build_ai_translation_instruction("auto", "zh-CN");
        assert!(instruction.contains("automatically detected source language"));
        assert!(instruction.contains("Simplified Chinese"));
        assert!(!instruction.contains("{sourceLanguage}"));
    }

    #[test]
    fn ai_translation_keeps_an_explicit_provider_and_only_migrates_a_missing_legacy_provider() {
        let mut selected = AppSettings::default().ai_provider_profiles[0].clone();
        selected.id = "selected-provider".to_string();
        selected.api_key.clear();
        selected.model = "selected-model".to_string();

        let mut active = selected.clone();
        active.id = "active-provider".to_string();
        active.api_key = "active-secret".to_string();
        active.model = "active-model".to_string();

        let mut configured = AppSettings::default();
        configured.ai_active_provider_profile_id = active.id.clone();
        configured.ai_provider_profiles = vec![selected.clone(), active.clone()];
        let mut translation_source = configured.translation_sources[0].clone();
        translation_source.provider_id = selected.id.clone();
        translation_source.model = selected.model.clone();

        assert_eq!(
            resolve_ai_translation_provider(&configured, &translation_source).map(|provider| provider.id.as_str()),
            Some("selected-provider"),
            "an explicitly selected provider must never be silently replaced because its secure key is unavailable",
        );

        translation_source.provider_id = "removed-provider".to_string();
        assert_eq!(
            resolve_ai_translation_provider(&configured, &translation_source)
                .map(|provider| provider.id.as_str()),
            Some("active-provider"),
            "a legacy source may migrate only when its stored provider no longer exists",
        );
    }
}
