use crate::commands::cleanup_orphan_reader_records_for_library_in;
use crate::library::save_library_records;
use crate::models::BookRecord;
use crate::paths::fts_database_path;
use crate::reader_data::{
    cleanup_orphan_reader_records_in, delete_reader_records_by_book_in,
    list_reader_records_by_kind_in, load_reader_record_in, quarantine_reader_record_in,
    save_reader_record_in, search_reader_annotations_in, SaveReaderRecordRequest,
};

use super::common::*;

#[test]
fn reader_records_round_trip_through_sqlite() {
    let dir = unique_temp_library_dir();
    let first = save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: "book-1".to_string(),
            kind: "highlights".to_string(),
            payload: r#"[{"id":"h1","text":"甲"}]"#.to_string(),
            schema_version: 1,
            source_window_id: "main".to_string(),
        },
    )
    .expect("reader record should save");
    assert_eq!(first.book_id, "book-1");
    assert_eq!(first.kind, "highlights");
    assert_eq!(first.schema_version, 1);
    assert_eq!(first.source_window_id, "main");

    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: "book-1".to_string(),
            kind: "highlights".to_string(),
            payload: r#"[{"id":"h1","text":"乙"}]"#.to_string(),
            schema_version: 2,
            source_window_id: "reader-window".to_string(),
        },
    )
    .expect("reader record should update");

    let loaded = load_reader_record_in(&dir, "book-1", "highlights")
        .expect("reader record should load")
        .expect("reader record should exist");
    assert_eq!(loaded.payload, r#"[{"id":"h1","text":"乙"}]"#);
    assert_eq!(loaded.schema_version, 2);
    assert_eq!(loaded.source_window_id, "reader-window");
    assert!(load_reader_record_in(&dir, "book-1", "bookmarks")
        .expect("missing kind query should succeed")
        .is_none());
}

#[test]
fn reader_records_can_be_listed_by_kind_for_diagnostics() {
    let dir = unique_temp_library_dir();
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: "book-1".to_string(),
            kind: "cloudAiRequestHistory".to_string(),
            payload: r#"[{"id":"h1","status":"succeeded"}]"#.to_string(),
            schema_version: 1,
            source_window_id: "main".to_string(),
        },
    )
    .expect("first AI history record should save");
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: "book-2".to_string(),
            kind: "cloudAiRequestHistory".to_string(),
            payload: r#"[{"id":"h2","status":"failed"}]"#.to_string(),
            schema_version: 1,
            source_window_id: "main".to_string(),
        },
    )
    .expect("second AI history record should save");
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: "book-3".to_string(),
            kind: "highlights".to_string(),
            payload: r#"[{"id":"hl1"}]"#.to_string(),
            schema_version: 1,
            source_window_id: "main".to_string(),
        },
    )
    .expect("other kind record should save");

    let records = list_reader_records_by_kind_in(&dir, "cloudAiRequestHistory")
        .expect("AI history records should list by kind");
    assert_eq!(records.len(), 2);
    assert!(records
        .iter()
        .all(|record| record.kind == "cloudAiRequestHistory"));
    assert!(records.iter().any(|record| record.book_id == "book-1"));
    assert!(records.iter().any(|record| record.book_id == "book-2"));
}

#[test]
fn reader_records_can_be_deleted_by_book_including_quarantine_rows() {
    let dir = unique_temp_library_dir();
    for (book_id, kind, payload) in [
        ("book-1", "state", r#"{"chapter":1}"#),
        ("book-1", "highlights", r#"[{"id":"h1"}]"#),
        ("book-2", "state", r#"{"chapter":2}"#),
    ] {
        save_reader_record_in(
            &dir,
            &SaveReaderRecordRequest {
                book_id: book_id.to_string(),
                kind: kind.to_string(),
                payload: payload.to_string(),
                schema_version: 1,
                source_window_id: "main".to_string(),
            },
        )
        .expect("reader record fixture should save");
    }
    let quarantined = quarantine_reader_record_in(&dir, "book-1", "state", "invalid-json")
        .expect("quarantine should succeed")
        .expect("quarantined row should exist");

    let removed = delete_reader_records_by_book_in(&dir, "book-1")
        .expect("book-scoped reader record deletion should succeed");

    assert_eq!(removed, 2);
    assert!(load_reader_record_in(&dir, "book-1", "highlights")
        .expect("deleted active record query should succeed")
        .is_none());
    assert!(load_reader_record_in(&dir, "book-1", &quarantined.kind)
        .expect("deleted quarantine record query should succeed")
        .is_none());
    assert!(load_reader_record_in(&dir, "book-2", "state")
        .expect("other book record query should succeed")
        .is_some());
}

#[test]
fn orphan_reader_records_cleanup_removes_missing_and_archived_books_only() {
    let dir = unique_temp_library_dir();
    let active_book = BookRecord {
        id: "active-book".to_string(),
        title: "在库书".to_string(),
        display_title: "在库书".to_string(),
        author: "本地导入".to_string(),
        format: "TXT".to_string(),
        status: "已导入".to_string(),
        progress: 0,
        file_name: "active.txt".to_string(),
        file_path: "active.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "sage".to_string(),
        deleted: false,
        deleted_at: String::new(),
        content_hash: "active-hash".to_string(),
        imported_at: "1000".to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    let trashed_book = BookRecord {
        id: "trashed-book".to_string(),
        title: "回收站书".to_string(),
        display_title: "回收站书".to_string(),
        author: "本地导入".to_string(),
        format: "TXT".to_string(),
        status: "在回收站".to_string(),
        progress: 0,
        file_name: "trashed.txt".to_string(),
        file_path: "trashed.txt".to_string(),
        source_file_path: String::new(),
        cover_image_path: String::new(),
        cover_label: "TXT".to_string(),
        cover_tone: "mist".to_string(),
        deleted: true,
        deleted_at: "2000".to_string(),
        content_hash: "trashed-hash".to_string(),
        imported_at: "1001".to_string(),
        last_opened_at: String::new(),
        shelf_groups: Vec::new(),
    };
    save_library_records(&dir, &[active_book.clone(), trashed_book.clone()])
        .expect("library fixture should save");
    for (book_id, kind, payload) in [
        ("active-book", "state", r#"{"chapter":1}"#),
        ("trashed-book", "bookmarks", r#"[{"id":"trash-bookmark"}]"#),
        (
            "missing-book",
            "highlights",
            r#"[{"id":"orphan-highlight"}]"#,
        ),
        (
            "deleted:old-book",
            "cloudAiRequestHistory",
            r#"[{"id":"archived-ai"}]"#,
        ),
    ] {
        save_reader_record_in(
            &dir,
            &SaveReaderRecordRequest {
                book_id: book_id.to_string(),
                kind: kind.to_string(),
                payload: payload.to_string(),
                schema_version: 1,
                source_window_id: "test".to_string(),
            },
        )
        .expect("reader record fixture should save");
    }

    let payload = cleanup_orphan_reader_records_in(&dir, &["active-book", "trashed-book"])
        .expect("orphan reader cleanup should succeed");

    assert_eq!(payload.removed_records, 2);
    assert_eq!(
        payload.removed_book_ids,
        vec!["deleted:old-book", "missing-book"]
    );
    assert_eq!(payload.kept_library_book_count, 2);
    assert!(load_reader_record_in(&dir, "active-book", "state")
        .expect("active reader record query should succeed")
        .is_some());
    assert!(load_reader_record_in(&dir, "trashed-book", "bookmarks")
        .expect("trashed reader record query should succeed")
        .is_some());
    assert!(load_reader_record_in(&dir, "missing-book", "highlights")
        .expect("orphan reader record query should succeed")
        .is_none());
    assert!(
        load_reader_record_in(&dir, "deleted:old-book", "cloudAiRequestHistory")
            .expect("archived reader record query should succeed")
            .is_none()
    );
}

#[test]
fn orphan_reader_records_command_uses_full_library_records_including_trash() {
    let dir = unique_temp_library_dir();
    save_library_records(
        &dir,
        &[
            BookRecord {
                id: "active-book".to_string(),
                title: "在库书".to_string(),
                display_title: "在库书".to_string(),
                author: "本地导入".to_string(),
                format: "TXT".to_string(),
                status: "已导入".to_string(),
                progress: 0,
                file_name: "active.txt".to_string(),
                file_path: "active.txt".to_string(),
                source_file_path: String::new(),
                cover_image_path: String::new(),
                cover_label: "TXT".to_string(),
                cover_tone: "sage".to_string(),
                deleted: false,
                deleted_at: String::new(),
                content_hash: "active-hash".to_string(),
                imported_at: "1000".to_string(),
                last_opened_at: String::new(),
                shelf_groups: Vec::new(),
            },
            BookRecord {
                id: "trash-book".to_string(),
                title: "回收站书".to_string(),
                display_title: "回收站书".to_string(),
                author: "本地导入".to_string(),
                format: "TXT".to_string(),
                status: "在回收站".to_string(),
                progress: 0,
                file_name: "trash.txt".to_string(),
                file_path: "trash.txt".to_string(),
                source_file_path: String::new(),
                cover_image_path: String::new(),
                cover_label: "TXT".to_string(),
                cover_tone: "mist".to_string(),
                deleted: true,
                deleted_at: (crate::library::now_epoch_millis() + 60_000).to_string(),
                content_hash: "trash-hash".to_string(),
                imported_at: "1001".to_string(),
                last_opened_at: String::new(),
                shelf_groups: Vec::new(),
            },
        ],
    )
    .expect("library records should save");
    for (book_id, kind) in [
        ("active-book", "state"),
        ("trash-book", "bookmarks"),
        ("missing-book", "state"),
    ] {
        save_reader_record_in(
            &dir,
            &SaveReaderRecordRequest {
                book_id: book_id.to_string(),
                kind: kind.to_string(),
                payload: r#"{"ok":true}"#.to_string(),
                schema_version: 1,
                source_window_id: "test".to_string(),
            },
        )
        .expect("reader record fixture should save");
    }

    let payload = cleanup_orphan_reader_records_for_library_in(&dir)
        .expect("command helper cleanup should succeed");

    assert_eq!(payload.removed_records, 1);
    assert_eq!(payload.removed_book_ids, vec!["missing-book"]);
    assert!(load_reader_record_in(&dir, "active-book", "state")
        .expect("active book query should succeed")
        .is_some());
    assert!(load_reader_record_in(&dir, "trash-book", "bookmarks")
        .expect("trash book query should succeed")
        .is_some());
    assert!(load_reader_record_in(&dir, "missing-book", "state")
        .expect("missing book query should succeed")
        .is_none());
}

#[test]
fn encrypted_reader_annotations_remain_searchable_after_decryption() {
    let dir = unique_temp_library_dir();
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: "book-search".to_string(),
            kind: "highlights".to_string(),
            payload: r#"{"schemaVersion":1,"data":[{"id":"h1","text":"可搜索的秘密标注","note":"需要命中"}]}"#.to_string(),
            schema_version: 1,
            source_window_id: "main".to_string(),
        },
    )
    .expect("encrypted annotation should save");

    let database =
        rusqlite::Connection::open(fts_database_path(&dir)).expect("reader sqlite should open");
    let raw: String = database
        .query_row(
            "SELECT payload FROM reader_records WHERE book_id = ?1 AND kind = ?2",
            rusqlite::params!["book-search", "highlights"],
            |row| row.get(0),
        )
        .expect("stored encrypted annotation should read");
    assert!(!raw.contains("可搜索的秘密标注"));

    let results = search_reader_annotations_in(&dir, "秘密标注")
        .expect("encrypted annotations should remain searchable");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].book_id, "book-search");
    assert!(results[0].payload.contains("可搜索的秘密标注"));
}

#[test]
fn quarantines_corrupt_reader_record_without_losing_payload() {
    let dir = unique_temp_library_dir();
    save_reader_record_in(
        &dir,
        &SaveReaderRecordRequest {
            book_id: "book-1".to_string(),
            kind: "state".to_string(),
            payload: "{bad-json".to_string(),
            schema_version: 1,
            source_window_id: "main".to_string(),
        },
    )
    .expect("corrupt record fixture should save");

    let quarantined = quarantine_reader_record_in(&dir, "book-1", "state", "invalid-json")
        .expect("corrupt record should be quarantined")
        .expect("corrupt record should exist");

    assert_eq!(quarantined.payload, "{bad-json");
    assert!(quarantined
        .kind
        .starts_with("quarantine:state:invalid-json:"));
    assert!(load_reader_record_in(&dir, "book-1", "state")
        .expect("active record query should succeed")
        .is_none());
    assert_eq!(
        load_reader_record_in(&dir, "book-1", &quarantined.kind)
            .expect("quarantine record should load")
            .expect("quarantine record should exist")
            .payload,
        "{bad-json"
    );
}
