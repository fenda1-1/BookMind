use crate::encryption::{
    decrypt_local_payload, encrypt_local_payload, parse_local_encrypted_envelope,
};
use crate::paths::fts_database_path;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use std::{collections::HashSet, fs, path::Path};

const SQLITE_BUSY_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReaderRecordPayload {
    pub(crate) book_id: String,
    pub(crate) kind: String,
    pub(crate) payload: String,
    pub(crate) schema_version: i64,
    pub(crate) updated_at: String,
    pub(crate) source_window_id: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveReaderRecordRequest {
    pub(crate) book_id: String,
    pub(crate) kind: String,
    pub(crate) payload: String,
    #[serde(default = "default_schema_version")]
    pub(crate) schema_version: i64,
    #[serde(default)]
    pub(crate) source_window_id: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OrphanReaderRecordCleanupPayload {
    pub(crate) removed_records: usize,
    pub(crate) removed_book_ids: Vec<String>,
    pub(crate) kept_library_book_count: usize,
}

fn default_schema_version() -> i64 {
    1
}

fn open_reader_database(data_dir: &Path) -> Result<Connection, String> {
    let path = fts_database_path(data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("无法创建数据库目录 {}: {error}", parent.display()))?;
    }
    let connection = Connection::open(&path)
        .map_err(|error| format!("无法打开 Reader SQLite 数据库 {}: {error}", path.display()))?;
    connection
        .busy_timeout(SQLITE_BUSY_TIMEOUT)
        .map_err(|error| format!("无法设置 Reader SQLite busy timeout: {error}"))?;
    connection
        .execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
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
            CREATE INDEX IF NOT EXISTS idx_reader_records_kind_updated
                ON reader_records(kind, updated_at);
            CREATE TABLE IF NOT EXISTS books (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', content_hash TEXT NOT NULL DEFAULT '');
            CREATE TABLE IF NOT EXISTS book_contents (book_id TEXT PRIMARY KEY, content TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (datetime('now')));
            CREATE TABLE IF NOT EXISTS chapters (id TEXT PRIMARY KEY, book_id TEXT NOT NULL, source_chapter_index INTEGER NOT NULL, title TEXT NOT NULL, content_hash TEXT NOT NULL DEFAULT '');
            CREATE TABLE IF NOT EXISTS reader_states (book_id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
            CREATE TABLE IF NOT EXISTS reader_settings (book_id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
            CREATE TABLE IF NOT EXISTS reader_highlights (id TEXT PRIMARY KEY, book_id TEXT NOT NULL, chapter_id TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '', has_note INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS idx_reader_highlights_book_chapter_created_color_note ON reader_highlights(book_id, chapter_id, created_at, color, has_note);
            CREATE TABLE IF NOT EXISTS reader_bookmarks (id TEXT PRIMARY KEY, book_id TEXT NOT NULL, chapter_id TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS idx_reader_bookmarks_book_chapter_created ON reader_bookmarks(book_id, chapter_id, created_at);
            CREATE TABLE IF NOT EXISTS reader_toc_edits (id TEXT PRIMARY KEY, book_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
            CREATE TABLE IF NOT EXISTS reader_page_cache (book_id TEXT NOT NULL, cache_key TEXT NOT NULL, payload TEXT NOT NULL, byte_size INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(book_id, cache_key));
            CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, book_id TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT '');
            CREATE TABLE IF NOT EXISTS flashcards (id TEXT PRIMARY KEY, book_id TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT '');
            CREATE TABLE IF NOT EXISTS annotation_links (id TEXT PRIMARY KEY, source_type TEXT NOT NULL, source_id TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL);
            "#,
        )
        .map_err(|error| format!("无法初始化 Reader SQLite 表: {error}"))?;
    Ok(connection)
}

pub(crate) fn load_reader_record_in(
    data_dir: &Path,
    book_id: &str,
    kind: &str,
) -> Result<Option<ReaderRecordPayload>, String> {
    let connection = open_reader_database(data_dir)?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT book_id, kind, payload, schema_version, updated_at, source_window_id
            FROM reader_records
            WHERE book_id = ?1 AND kind = ?2
            "#,
        )
        .map_err(|error| format!("无法准备 Reader 记录查询: {error}"))?;
    let mut rows = statement
        .query(params![book_id, kind])
        .map_err(|error| format!("无法查询 Reader 记录: {error}"))?;
    let Some(row) = rows
        .next()
        .map_err(|error| format!("无法读取 Reader 记录: {error}"))?
    else {
        return Ok(None);
    };
    let mut record = ReaderRecordPayload {
        book_id: row
            .get(0)
            .map_err(|error| format!("Reader book_id 读取失败: {error}"))?,
        kind: row
            .get(1)
            .map_err(|error| format!("Reader kind 读取失败: {error}"))?,
        payload: row
            .get(2)
            .map_err(|error| format!("Reader payload 读取失败: {error}"))?,
        schema_version: row
            .get(3)
            .map_err(|error| format!("Reader schema_version 读取失败: {error}"))?,
        updated_at: row
            .get(4)
            .map_err(|error| format!("Reader updated_at 读取失败: {error}"))?,
        source_window_id: row
            .get(5)
            .map_err(|error| format!("Reader source_window_id 读取失败: {error}"))?,
    };
    let should_migrate = decrypt_reader_record_payload(data_dir, &mut record)?;
    if should_migrate {
        migrate_reader_record_payload_to_encrypted_storage(data_dir, &record)?;
    }
    Ok(Some(record))
}

pub(crate) fn list_reader_records_by_kind_in(
    data_dir: &Path,
    kind: &str,
) -> Result<Vec<ReaderRecordPayload>, String> {
    let connection = open_reader_database(data_dir)?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT book_id, kind, payload, schema_version, updated_at, source_window_id
            FROM reader_records
            WHERE kind = ?1
            ORDER BY updated_at DESC
            "#,
        )
        .map_err(|error| format!("无法准备 Reader 记录列表查询: {error}"))?;
    let rows = statement
        .query_map(params![kind], |row| {
            Ok(ReaderRecordPayload {
                book_id: row.get(0)?,
                kind: row.get(1)?,
                payload: row.get(2)?,
                schema_version: row.get(3)?,
                updated_at: row.get(4)?,
                source_window_id: row.get(5)?,
            })
        })
        .map_err(|error| format!("无法查询 Reader 记录列表: {error}"))?;
    let mut records = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("无法读取 Reader 记录列表: {error}"))?;
    for record in &mut records {
        let should_migrate = decrypt_reader_record_payload(data_dir, record)?;
        if should_migrate {
            migrate_reader_record_payload_to_encrypted_storage(data_dir, record)?;
        }
    }
    Ok(records)
}

pub(crate) fn save_reader_record_in(
    data_dir: &Path,
    request: &SaveReaderRecordRequest,
) -> Result<ReaderRecordPayload, String> {
    let connection = open_reader_database(data_dir)?;
    let storage_payload =
        encrypt_reader_record_storage_payload(data_dir, &request.kind, &request.payload)?;
    connection
        .execute(
            r#"
            INSERT INTO reader_records (book_id, kind, payload, schema_version, source_window_id)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(book_id, kind) DO UPDATE SET
                payload = excluded.payload,
                schema_version = excluded.schema_version,
                updated_at = datetime('now'),
                source_window_id = excluded.source_window_id
            "#,
            params![
                request.book_id,
                request.kind,
                storage_payload,
                request.schema_version,
                request.source_window_id
            ],
        )
        .map_err(|error| format!("无法保存 Reader 记录: {error}"))?;
    load_reader_record_in(data_dir, &request.book_id, &request.kind)?
        .ok_or_else(|| "Reader 记录保存后无法读取".to_string())
}

pub(crate) fn delete_reader_record_in(
    data_dir: &Path,
    book_id: &str,
    kind: &str,
) -> Result<usize, String> {
    let connection = open_reader_database(data_dir)?;
    let changed = connection
        .execute(
            "DELETE FROM reader_records WHERE book_id = ?1 AND kind = ?2",
            params![book_id, kind],
        )
        .map_err(|error| format!("无法删除 Reader 记录: {error}"))?;
    Ok(changed)
}

pub(crate) fn delete_reader_records_by_kind_in(
    data_dir: &Path,
    kind: &str,
) -> Result<usize, String> {
    let connection = open_reader_database(data_dir)?;
    let changed = connection
        .execute("DELETE FROM reader_records WHERE kind = ?1", params![kind])
        .map_err(|error| format!("无法按类型删除 Reader 记录: {error}"))?;
    Ok(changed)
}

pub(crate) fn delete_reader_records_by_book_in(
    data_dir: &Path,
    book_id: &str,
) -> Result<usize, String> {
    let connection = open_reader_database(data_dir)?;
    let changed = connection
        .execute(
            "DELETE FROM reader_records WHERE book_id = ?1",
            params![book_id],
        )
        .map_err(|error| format!("无法删除当前书 Reader 记录: {error}"))?;
    Ok(changed)
}

pub(crate) fn has_reader_records_for_book_in(
    data_dir: &Path,
    book_id: &str,
) -> Result<bool, String> {
    let connection = open_reader_database(data_dir)?;
    let count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM reader_records WHERE book_id = ?1",
            params![book_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("无法检查 Reader 记录: {error}"))?;
    Ok(count > 0)
}

pub(crate) fn cleanup_orphan_reader_records_in<S: AsRef<str>>(
    data_dir: &Path,
    library_book_ids: &[S],
) -> Result<OrphanReaderRecordCleanupPayload, String> {
    let mut keep_ids = HashSet::new();
    for book_id in library_book_ids {
        let normalized = book_id.as_ref().trim();
        if !normalized.is_empty() {
            keep_ids.insert(normalized.to_string());
        }
    }
    let connection = open_reader_database(data_dir)?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT DISTINCT book_id
            FROM reader_records
            ORDER BY book_id ASC
            "#,
        )
        .map_err(|error| format!("无法准备孤立 Reader 记录查询: {error}"))?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| format!("无法查询孤立 Reader 记录: {error}"))?;
    let all_book_ids = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("无法读取孤立 Reader 记录 book_id: {error}"))?;
    drop(statement);

    let mut removed_records = 0;
    let mut removed_book_ids = Vec::new();
    for book_id in all_book_ids {
        if keep_ids.contains(&book_id) {
            continue;
        }
        let changed = connection
            .execute(
                "DELETE FROM reader_records WHERE book_id = ?1",
                params![book_id],
            )
            .map_err(|error| format!("无法删除孤立 Reader 记录: {error}"))?;
        if changed > 0 {
            removed_records += changed;
            removed_book_ids.push(book_id);
        }
    }

    Ok(OrphanReaderRecordCleanupPayload {
        removed_records,
        removed_book_ids,
        kept_library_book_count: keep_ids.len(),
    })
}

pub(crate) fn quarantine_reader_record_in(
    data_dir: &Path,
    book_id: &str,
    kind: &str,
    reason: &str,
) -> Result<Option<ReaderRecordPayload>, String> {
    let Some(record) = load_reader_record_in(data_dir, book_id, kind)? else {
        return Ok(None);
    };
    let connection = open_reader_database(data_dir)?;
    let safe_reason = reason
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>();
    let quarantine_kind = format!("quarantine:{kind}:{safe_reason}:{}", chrono_millis());
    connection
        .execute(
            r#"
            UPDATE reader_records
            SET kind = ?3,
                updated_at = datetime('now')
            WHERE book_id = ?1 AND kind = ?2
            "#,
            params![book_id, kind, quarantine_kind],
        )
        .map_err(|error| format!("无法隔离损坏 Reader 记录: {error}"))?;
    Ok(Some(ReaderRecordPayload {
        kind: quarantine_kind,
        ..record
    }))
}

pub(crate) fn archive_reader_records_for_deleted_book_in(
    data_dir: &Path,
    book_id: &str,
) -> Result<usize, String> {
    let mut connection = open_reader_database(data_dir)?;
    let archived_book_id = format!("deleted:{book_id}");
    let tx = connection
        .transaction()
        .map_err(|error| format!("无法开启 Reader 数据归档事务: {error}"))?;
    let changed = tx
        .execute(
            r#"
            INSERT INTO reader_records (
                book_id, kind, payload, schema_version, source_window_id, created_at, updated_at
            )
            SELECT
                ?2, kind, payload, schema_version, source_window_id, created_at, datetime('now')
            FROM reader_records
            WHERE book_id = ?1
            ON CONFLICT(book_id, kind) DO UPDATE SET
                payload = excluded.payload,
                schema_version = excluded.schema_version,
                source_window_id = excluded.source_window_id,
                updated_at = datetime('now')
            "#,
            params![book_id, archived_book_id],
        )
        .map_err(|error| format!("无法归档已删除书籍的 Reader 数据: {error}"))?;
    tx.execute(
        "DELETE FROM reader_records WHERE book_id = ?1",
        params![book_id],
    )
    .map_err(|error| format!("无法清理已归档书籍的原 Reader 数据: {error}"))?;
    tx.commit()
        .map_err(|error| format!("无法提交 Reader 数据归档事务: {error}"))?;
    Ok(changed)
}

pub(crate) fn search_reader_annotations_in(
    data_dir: &Path,
    query: &str,
) -> Result<Vec<ReaderRecordPayload>, String> {
    let normalized = query.trim();
    if normalized.is_empty() {
        return Ok(Vec::new());
    }
    let connection = open_reader_database(data_dir)?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT book_id, kind, payload, schema_version, updated_at, source_window_id
            FROM reader_records
            WHERE kind IN ('highlights', 'bookmarks')
            ORDER BY updated_at DESC
            LIMIT 100
            "#,
        )
        .map_err(|error| format!("无法准备 Reader 标注搜索: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(ReaderRecordPayload {
                book_id: row.get(0)?,
                kind: row.get(1)?,
                payload: row.get(2)?,
                schema_version: row.get(3)?,
                updated_at: row.get(4)?,
                source_window_id: row.get(5)?,
            })
        })
        .map_err(|error| format!("无法执行 Reader 标注搜索: {error}"))?;
    let mut records = Vec::new();
    for row in rows {
        let mut record = row.map_err(|error| format!("无法读取 Reader 标注搜索结果: {error}"))?;
        let should_migrate = decrypt_reader_record_payload(data_dir, &mut record)?;
        if should_migrate {
            migrate_reader_record_payload_to_encrypted_storage(data_dir, &record)?;
        }
        if record.payload.contains(normalized) {
            records.push(record);
        }
    }
    Ok(records)
}

pub(crate) fn reencrypt_sensitive_reader_records_in(data_dir: &Path) -> Result<usize, String> {
    let connection = open_reader_database(data_dir)?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT book_id, kind, payload, schema_version, updated_at, source_window_id
            FROM reader_records
            WHERE kind IN (
                'highlights',
                'bookmarks',
                'tocEdits',
                'tocManifest',
                'chapterRulesOverride',
                'cloudAiRequestHistory',
                'aiConversationHistory'
            )
            ORDER BY updated_at ASC
            "#,
        )
        .map_err(|error| format!("无法准备 Reader 敏感记录重加密查询: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(ReaderRecordPayload {
                book_id: row.get(0)?,
                kind: row.get(1)?,
                payload: row.get(2)?,
                schema_version: row.get(3)?,
                updated_at: row.get(4)?,
                source_window_id: row.get(5)?,
            })
        })
        .map_err(|error| format!("无法查询 Reader 敏感记录: {error}"))?;
    let mut records = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("无法读取 Reader 敏感记录: {error}"))?;
    drop(statement);

    let mut changed = 0usize;
    for record in &mut records {
        decrypt_reader_record_payload(data_dir, record)?;
        let storage_payload =
            encrypt_reader_record_storage_payload(data_dir, &record.kind, &record.payload)?;
        connection
            .execute(
                r#"
                UPDATE reader_records
                SET payload = ?3,
                    schema_version = ?4,
                    source_window_id = ?5,
                    updated_at = datetime('now')
                WHERE book_id = ?1 AND kind = ?2
                "#,
                params![
                    record.book_id,
                    record.kind,
                    storage_payload,
                    record.schema_version,
                    record.source_window_id
                ],
            )
            .map_err(|error| format!("无法重加密 Reader 敏感记录: {error}"))?;
        changed += 1;
    }

    Ok(changed)
}

fn encrypt_reader_record_storage_payload(
    data_dir: &Path,
    kind: &str,
    payload: &str,
) -> Result<String, String> {
    if !is_sensitive_reader_record_kind(kind) {
        return Ok(payload.to_string());
    }
    let value = serde_json::from_str::<serde_json::Value>(payload)
        .map_err(|error| format!("敏感 Reader payload 必须是 JSON: {error}"))?;
    if parse_local_encrypted_envelope(&value)?.is_some() {
        return Ok(reencrypt_reader_record_payload(data_dir, &value)?);
    }
    let envelope = encrypt_local_payload(data_dir, payload)?;
    serde_json::to_string(&envelope)
        .map_err(|error| format!("无法序列化敏感 Reader envelope: {error}"))
}

fn decrypt_reader_record_payload(
    data_dir: &Path,
    record: &mut ReaderRecordPayload,
) -> Result<bool, String> {
    if !is_sensitive_reader_record_kind(&record.kind) {
        return Ok(false);
    }
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&record.payload) else {
        return Ok(false);
    };
    if let Some(envelope) = parse_local_encrypted_envelope(&value)? {
        let is_legacy_envelope = envelope.nonce.trim().is_empty();
        record.payload = decrypt_local_payload(data_dir, &envelope)?;
        return Ok(is_legacy_envelope);
    }
    Ok(true)
}

fn reencrypt_reader_record_payload(
    data_dir: &Path,
    value: &serde_json::Value,
) -> Result<String, String> {
    let Some(envelope) = parse_local_encrypted_envelope(value)? else {
        let envelope = encrypt_local_payload(data_dir, &value.to_string())?;
        return serde_json::to_string(&envelope)
            .map_err(|error| format!("无法序列化敏感 Reader envelope: {error}"));
    };
    let decrypted = decrypt_local_payload(data_dir, &envelope)?;
    let envelope = encrypt_local_payload(data_dir, &decrypted)?;
    serde_json::to_string(&envelope)
        .map_err(|error| format!("无法序列化敏感 Reader envelope: {error}"))
}

fn is_sensitive_reader_record_kind(kind: &str) -> bool {
    matches!(
        kind,
        "highlights"
            | "bookmarks"
            | "tocEdits"
            | "tocManifest"
            | "chapterRulesOverride"
            | "cloudAiRequestHistory"
            | "aiConversationHistory"
    )
}

fn migrate_reader_record_payload_to_encrypted_storage(
    data_dir: &Path,
    record: &ReaderRecordPayload,
) -> Result<(), String> {
    let connection = open_reader_database(data_dir)?;
    let storage_payload =
        encrypt_reader_record_storage_payload(data_dir, &record.kind, &record.payload)?;
    connection
        .execute(
            r#"
            UPDATE reader_records
            SET payload = ?3,
                schema_version = ?4,
                source_window_id = ?5,
                updated_at = datetime('now')
            WHERE book_id = ?1 AND kind = ?2
            "#,
            params![
                record.book_id,
                record.kind,
                storage_payload,
                record.schema_version,
                record.source_window_id
            ],
        )
        .map_err(|error| format!("无法迁移敏感 Reader 记录加密状态: {error}"))?;
    Ok(())
}

fn chrono_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}
