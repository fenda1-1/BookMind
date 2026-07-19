import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const rootTests = readFileSync('src-tauri/src/tests.rs', 'utf8');
const backupTestsPath = 'src-tauri/src/tests/backup_tests.rs';
const characterTestsPath = 'src-tauri/src/tests/characters_tests.rs';
const commonTestsPath = 'src-tauri/src/tests/common/mod.rs';
const encryptionTestsPath = 'src-tauri/src/tests/encryption_tests.rs';
const importTestsPath = 'src-tauri/src/tests/import_tests.rs';
const libraryTestsPath = 'src-tauri/src/tests/library_tests.rs';
const notesTestsPath = 'src-tauri/src/tests/notes_tests.rs';
const readerDataTestsPath = 'src-tauri/src/tests/reader_data_tests.rs';
const readerDataTests = existsSync(readerDataTestsPath)
  ? readFileSync(readerDataTestsPath, 'utf8')
  : '';
const searchTestsPath = 'src-tauri/src/tests/search_tests.rs';
const settingsTestsPath = 'src-tauri/src/tests/settings_tests.rs';
const taskTestsPath = 'src-tauri/src/tests/tasks_tests.rs';
const taskTests = readFileSync(taskTestsPath, 'utf8');
const taskControlTestsPath = 'src-tauri/src/tests/tasks_tests/task_control_tests.rs';
const taskLogTestsPath = 'src-tauri/src/tests/tasks_tests/task_log_tests.rs';
const taskRunnerTestsPath = 'src-tauri/src/tests/tasks_tests/task_runner_tests.rs';
const taskProgressPath = 'src-tauri/src/tasks/progress.rs';
const taskRunnerPath = 'src-tauri/src/tasks/runner.rs';
const taskKindsPath = 'src-tauri/src/tasks/kinds.rs';
const taskErrorsPath = 'src-tauri/src/tasks/errors.rs';
const taskStorePath = 'src-tauri/src/tasks/store.rs';
const characterModuleTestsFacadePath = 'src-tauri/src/characters/tests.rs';
const characterModuleFixturesPath = 'src-tauri/src/characters/tests/fixtures.rs';
const characterExtractionCasesPath = 'src-tauri/src/characters/tests/extraction_cases.rs';
const characterRelationCasesPath = 'src-tauri/src/characters/tests/relation_cases.rs';
const characterPayloadCasesPath = 'src-tauri/src/characters/tests/payload_cases.rs';
const characterStatusCasesPath = 'src-tauri/src/characters/tests/status_cases.rs';
const characterOutputCasesPath = 'src-tauri/src/characters/tests/output_cases.rs';
const characterModuleTestsFacade = readFileSync(characterModuleTestsFacadePath, 'utf8');

assert.ok(existsSync(backupTestsPath), 'Rust backup tests must live in src-tauri/src/tests/backup_tests.rs');
assert.match(rootTests, /mod backup_tests;/, 'Root Rust tests module must register tests/backup_tests.rs');
assert.ok(existsSync(characterTestsPath), 'Rust character integration tests must live in src-tauri/src/tests/characters_tests.rs');
assert.match(rootTests, /mod characters_tests;/, 'Root Rust tests module must register tests/characters_tests.rs');
assert.ok(existsSync(commonTestsPath), 'Rust test common helpers must live in src-tauri/src/tests/common/mod.rs');
assert.match(rootTests, /mod common;/, 'Root Rust tests module must register tests/common/mod.rs');
assert.ok(existsSync(encryptionTestsPath), 'Rust encryption tests must live in src-tauri/src/tests/encryption_tests.rs');
assert.match(rootTests, /mod encryption_tests;/, 'Root Rust tests module must register tests/encryption_tests.rs');
assert.ok(existsSync(importTestsPath), 'Rust import tests must live in src-tauri/src/tests/import_tests.rs');
assert.match(rootTests, /mod import_tests;/, 'Root Rust tests module must register tests/import_tests.rs');
assert.ok(existsSync(libraryTestsPath), 'Rust library tests must live in src-tauri/src/tests/library_tests.rs');
assert.match(rootTests, /mod library_tests;/, 'Root Rust tests module must register tests/library_tests.rs');
assert.ok(existsSync(notesTestsPath), 'Rust notes tests must live in src-tauri/src/tests/notes_tests.rs');
assert.match(rootTests, /mod notes_tests;/, 'Root Rust tests module must register tests/notes_tests.rs');
assert.ok(existsSync(readerDataTestsPath), 'Rust reader data tests must live in src-tauri/src/tests/reader_data_tests.rs');
assert.match(rootTests, /mod reader_data_tests;/, 'Root Rust tests module must register tests/reader_data_tests.rs');
assert.ok(existsSync(searchTestsPath), 'Rust search tests must live in src-tauri/src/tests/search_tests.rs');
assert.match(rootTests, /mod search_tests;/, 'Root Rust tests module must register tests/search_tests.rs');
assert.ok(existsSync(settingsTestsPath), 'Rust settings tests must live in src-tauri/src/tests/settings_tests.rs');
assert.match(rootTests, /mod settings_tests;/, 'Root Rust tests module must register tests/settings_tests.rs');
assert.ok(existsSync(taskTestsPath), 'Rust task tests must live in src-tauri/src/tests/tasks_tests.rs');
assert.match(rootTests, /mod tasks_tests;/, 'Root Rust tests module must register tests/tasks_tests.rs');
assert.ok(existsSync(taskControlTestsPath), 'Rust task control tests must live in tests/tasks_tests/task_control_tests.rs');
assert.ok(existsSync(taskLogTestsPath), 'Rust task log tests must live in tests/tasks_tests/task_log_tests.rs');
assert.ok(existsSync(taskRunnerTestsPath), 'Rust task runner tests must live in tests/tasks_tests/task_runner_tests.rs');
assert.ok(existsSync(taskProgressPath), 'Rust task progress code must live in src-tauri/src/tasks/progress.rs');
assert.match(readFileSync('src-tauri/src/tasks.rs', 'utf8'), /mod progress;/, 'Root tasks.rs must register tasks/progress.rs');
assert.ok(existsSync(taskRunnerPath), 'Rust task runner code must live in src-tauri/src/tasks/runner.rs');
assert.match(readFileSync('src-tauri/src/tasks.rs', 'utf8'), /mod runner;/, 'Root tasks.rs must register tasks/runner.rs');
assert.ok(existsSync(taskKindsPath), 'Rust task kind and DAG code must live in src-tauri/src/tasks/kinds.rs');
assert.match(readFileSync('src-tauri/src/tasks.rs', 'utf8'), /mod kinds;/, 'Root tasks.rs must register tasks/kinds.rs');
assert.ok(existsSync(taskErrorsPath), 'Rust task error helper code must live in src-tauri/src/tasks/errors.rs');
assert.match(readFileSync('src-tauri/src/tasks.rs', 'utf8'), /mod errors;/, 'Root tasks.rs must register tasks/errors.rs');
assert.ok(existsSync(taskStorePath), 'Rust task store code must live in src-tauri/src/tasks/store.rs');
assert.match(readFileSync('src-tauri/src/tasks.rs', 'utf8'), /mod store;/, 'Root tasks.rs must register tasks/store.rs');
assert.ok(existsSync(characterModuleFixturesPath), 'Character module test helpers and fixtures must live in src-tauri/src/characters/tests/fixtures.rs');
assert.match(characterModuleTestsFacade, /mod fixtures;/, 'Character tests facade must register the split fixtures module');
assert.ok(characterModuleTestsFacade.split(/\r?\n/).length <= 25, 'src-tauri/src/characters/tests.rs must be a thin facade, not a 3000+ line test module');
assert.ok(existsSync(characterExtractionCasesPath), 'Character extraction and name-rule tests must live in tests/extraction_cases.rs');
assert.ok(existsSync(characterRelationCasesPath), 'Character relation and event tests must live in tests/relation_cases.rs');
assert.ok(existsSync(characterPayloadCasesPath), 'Character payload safety tests must live in tests/payload_cases.rs');
assert.ok(existsSync(characterStatusCasesPath), 'Character summary/status tests must live in tests/status_cases.rs');
assert.ok(existsSync(characterOutputCasesPath), 'Character output and deletion tests must live in tests/output_cases.rs');
assert.match(characterModuleTestsFacade, /mod extraction_cases;/, 'Character tests facade must register extraction_cases');
assert.match(characterModuleTestsFacade, /mod relation_cases;/, 'Character tests facade must register relation_cases');
assert.match(characterModuleTestsFacade, /mod payload_cases;/, 'Character tests facade must register payload_cases');
assert.match(characterModuleTestsFacade, /mod status_cases;/, 'Character tests facade must register status_cases');
assert.match(characterModuleTestsFacade, /mod output_cases;/, 'Character tests facade must register output_cases');
assert.match(taskTests, /mod task_control_tests;/, 'Task tests module must register task_control_tests');
assert.match(taskTests, /mod task_log_tests;/, 'Task tests module must register task_log_tests');
assert.match(taskTests, /mod task_runner_tests;/, 'Task tests module must register task_runner_tests');
assert.doesNotMatch(
  rootTests,
  /fn task_state_contract_values_serialize_to_frontend_strings\(/,
  'Task state contract test must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn unique_temp_library_dir\(/,
  'Shared temp directory helper must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /struct RecordingTaskProgressSink/,
  'Shared task progress sink fixture must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn parse_task_for_book/,
  'Shared task lookup helper must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn data_backup_copies_data_and_excludes_secure_key_files\(/,
  'Data backup tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn data_auto_backup_prunes_auto_snapshots_without_touching_manual_or_restore_backups\(/,
  'Auto backup tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn imports_txt_once_by_content_hash_and_copies_original\(/,
  'TXT import tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn imports_txt_directory_recursively_with_deduplication\(/,
  'Directory import tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn library_metadata_payloads_do_not_load_content_or_chunks\(/,
  'Library metadata tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn empty_trash_removes_index_outputs_for_deleted_books\(/,
  'Library trash tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn saves_ai_answer_as_note_with_citations\(/,
  'AI note save tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn saves_ai_notes_to_encrypted_storage_while_loading_plain_records\(/,
  'Encrypted AI note tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn highlights_and_flashcards_are_encrypted_at_rest_and_legacy_files_migrate\(/,
  'Highlight and flashcard encryption tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn exports_knowledge_markdown_honors_ai_metadata_and_structured_response_options\(/,
  'Knowledge export tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn reader_records_round_trip_through_sqlite\(/,
  'Reader data persistence tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn sensitive_reader_records_are_encrypted_at_rest_and_decrypted_for_commands\(/,
  'Sensitive reader data encryption tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn master_password_wraps_fallback_key_without_exposing_key_material\(/,
  'Reader data master password tests must move out of root tests.rs',
);
assert.doesNotMatch(
  readerDataTests,
  /fn master_password_wraps_fallback_key_without_exposing_key_material\(/,
  'Master password tests must live in tests/encryption_tests.rs, not reader_data_tests.rs',
);
assert.doesNotMatch(
  readerDataTests,
  /fn key_rotation_keeps_legacy_envelopes_without_key_id_readable\(/,
  'Key rotation tests must live in tests/encryption_tests.rs, not reader_data_tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn quarantines_corrupt_reader_record_without_losing_payload\(/,
  'Reader data quarantine tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn diagnostics_marks_manifest_stale_when_content_hash_changes\(/,
  'Search diagnostics tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn parses_txt_into_searchable_chunks\(/,
  'Search indexing tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn search_index_page_applies_limit_and_offset\(/,
  'Search pagination tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn local_ai_request_can_be_cancelled_by_request_id\(/,
  'Local AI search tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn app_settings_legacy_file_is_migrated_with_schema_version\(/,
  'App settings tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn app_settings_preserve_ai_provider_profiles_without_plaintext_keys\(/,
  'AI provider profile settings tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn settings_v2_save_writes_unified_settings_file\(/,
  'Settings v2 tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn local_character_extraction_builds_profiles_mentions_and_evidence_from_indexed_chunks\(/,
  'Character integration tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn character_extraction_task_runs_through_task_center_and_writes_index\(/,
  'Character task integration tests must move out of root tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn parse_runner_starts_concurrent_batch_with_one_index_task_per_book\(/,
  'Task runner batch test must move out of root tests.rs',
);
assert.match(
  taskTests,
  /fn parse_runner_starts_concurrent_batch_with_one_index_task_per_book\(/,
  'Task runner batch test must live in tests/tasks_tests.rs',
);
assert.doesNotMatch(
  rootTests,
  /fn task_controls_pause_retry_and_cancel_parse_tasks\(/,
  'Task control tests must move out of root tests.rs',
);
assert.doesNotMatch(
  taskTests,
  /fn task_controls_pause_retry_and_cancel_parse_tasks\(/,
  'Task control tests must move out of the top-level tasks_tests.rs module',
);
assert.doesNotMatch(
  rootTests,
  /fn task_logs_can_be_loaded_and_cleared_for_completed_tasks\(/,
  'Task log tests must move out of root tests.rs',
);
assert.doesNotMatch(
  taskTests,
  /fn task_logs_can_be_loaded_and_cleared_for_completed_tasks\(/,
  'Task log tests must move out of the top-level tasks_tests.rs module',
);
assert.doesNotMatch(
  rootTests,
  /fn runner_executes_rebuild_index_task_after_index_deleted\(/,
  'Task rebuild runner tests must move out of root tests.rs',
);
assert.doesNotMatch(
  taskTests,
  /fn runner_executes_rebuild_index_task_after_index_deleted\(/,
  'Task rebuild runner tests must move out of the top-level tasks_tests.rs module',
);
assert.doesNotMatch(
  rootTests,
  /fn parse_runner_streams_and_persists_heavy_index_build_stages\(/,
  'Task runner streaming tests must move out of root tests.rs',
);
assert.doesNotMatch(
  taskTests,
  /fn parse_runner_streams_and_persists_heavy_index_build_stages\(/,
  'Task runner streaming tests must move out of the top-level tasks_tests.rs module',
);
assert.doesNotMatch(
  readFileSync('src-tauri/src/tasks.rs', 'utf8'),
  /fn rebuild_empty_task_queue_file\(/,
  'Task queue rebuild helper must move out of root tasks.rs',
);
assert.doesNotMatch(
  readFileSync('src-tauri/src/tasks.rs', 'utf8'),
  /fn quarantine_corrupted_task_queue_file\(/,
  'Corrupted task queue quarantine helper must move out of root tasks.rs',
);
assert.doesNotMatch(
  readFileSync('src-tauri/src/tasks.rs', 'utf8'),
  /pub\(crate\) fn append_task_log\(/,
  'Task log append helper must move out of root tasks.rs',
);
assert.doesNotMatch(
  readFileSync('src-tauri/src/tasks.rs', 'utf8'),
  /fn mark_task_stage\(/,
  'Task stage progress helper must move out of root tasks.rs',
);
assert.doesNotMatch(
  readFileSync('src-tauri/src/tasks.rs', 'utf8'),
  /fn run_index_task_batch\(/,
  'Task runner batch lifecycle must move out of root tasks.rs',
);
assert.doesNotMatch(
  readFileSync('src-tauri/src/tasks.rs', 'utf8'),
  /fn build_index_output_for_task\(/,
  'Task runner index build worker must move out of root tasks.rs',
);
assert.doesNotMatch(
  readFileSync('src-tauri/src/tasks.rs', 'utf8'),
  /fn is_runnable_task_kind\(/,
  'Task kind runnable helper must move out of root tasks.rs',
);
assert.doesNotMatch(
  readFileSync('src-tauri/src/tasks.rs', 'utf8'),
  /fn complete_ready_placeholder_dag_tasks\(/,
  'Task DAG placeholder completion helper must move out of root tasks.rs',
);
assert.doesNotMatch(
  readFileSync('src-tauri/src/tasks/store.rs', 'utf8'),
  /fn is_retryable_task_error_code\(/,
  'Task retryable error helper must move out of task store.rs',
);
assert.doesNotMatch(
  readFileSync('src-tauri/src/tasks.rs', 'utf8'),
  /fn collect_recent_index_errors\(/,
  'Task recent error collection helper must move out of root tasks.rs',
);

console.log('Verified Rust test architecture contracts.');
