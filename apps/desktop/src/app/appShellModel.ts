import type { CSSProperties } from 'react';
import { availableMonitors, getCurrentWindow, primaryMonitor, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';
import { createAutoDataBackup } from '../services/dataBackupService';
import { loadReaderDocument, refreshLibraryMetadata, type TxtImportCleanupOptions } from '../services/libraryService';
import { saveReaderRecord } from '../services/readerStorageService';
import { getUnfinishedTaskStatuses, loadTaskStatuses } from '../services/taskService';
import type { ChapterRuleDraft, ExtendedSettings } from '../services/settingsCenterService';
import type { Translator } from '../i18n';
import { buildReaderTocManifest } from '../features/reader-core/readerModel';
import type { AiAskRequest, AiResponse, AppPage, Book, TaskStatus } from '../types';
import type { CommandId } from './commandRegistry';
import { isTauriRuntime } from './platform';
import { requestAppConfirm } from '../components/useAppConfirm';

const recentCommandIdsStorageKey = 'bookmind:command-palette-recent-commands';
const lastReaderBookIdStorageKey = 'bookmind:last-reader-book-id';
const mainWindowGeometryStorageKey = 'bookmind:main-window-geometry';
const lastAutoDataBackupAtStorageKey = 'bookmind:last-auto-data-backup-at';
const recentCommandLimit = 12;
const defaultVisibleAppPages: AppPage[] = ['overview', 'reader', 'library', 'knowledge', 'characters', 'search', 'tasks', 'settings'];

export type MainWindowGeometry = { x: number; y: number; width: number; height: number; maximized?: boolean };
export type MainWindowWorkArea = MainWindowGeometry;

export function matchesCommandPaletteShortcut(event: KeyboardEvent, shortcut: ExtendedSettings['commandPaletteShortcut']) {
  if (shortcut === 'disabled') return false;
  const key = event.key.toLowerCase();
  if (shortcut === 'ctrl-k') return key === 'k' && !event.shiftKey;
  if (shortcut === 'ctrl-p') return key === 'p' && !event.shiftKey;
  if (shortcut === 'ctrl-shift-p') return key === 'p' && event.shiftKey;
  return false;
}

export function formatCommandPaletteShortcut(shortcut: ExtendedSettings['commandPaletteShortcut']) {
  if (shortcut === 'ctrl-k') return 'Ctrl/Cmd+K';
  if (shortcut === 'ctrl-p') return 'Ctrl/Cmd+P';
  if (shortcut === 'ctrl-shift-p') return 'Ctrl/Cmd+Shift+P';
  return 'disabled';
}

export function matchesConfiguredShortcut(event: KeyboardEvent, shortcut: string) {
  if (shortcut === 'disabled') return false;
  const key = event.key.toLowerCase();
  const parts = shortcut.split('-');
  const hasPrimaryModifier = event.ctrlKey || event.metaKey;
  return parts.includes(key) && hasPrimaryModifier && event.altKey === parts.includes('alt') && event.shiftKey === parts.includes('shift');
}

export function formatNavigationShortcut(shortcut: ExtendedSettings['navigationShortcuts'][keyof ExtendedSettings['navigationShortcuts']]) {
  if (shortcut === 'disabled') return undefined;
  if (shortcut === 'ctrl-b') return 'Ctrl/Cmd+B';
  if (shortcut === 'ctrl-r') return 'Ctrl/Cmd+R';
  if (shortcut === 'ctrl-l') return 'Ctrl/Cmd+L';
  if (shortcut === 'ctrl-alt-l') return 'Ctrl/Cmd+Alt+L';
  if (shortcut === 'ctrl-f') return 'Ctrl/Cmd+F';
  if (shortcut === 'ctrl-alt-f') return 'Ctrl/Cmd+Alt+F';
  return undefined;
}

export function formatImportShortcut(shortcut: ExtendedSettings['importShortcut']) {
  if (shortcut === 'disabled') return undefined;
  if (shortcut === 'ctrl-i') return 'Ctrl/Cmd+I';
  if (shortcut === 'ctrl-alt-i') return 'Ctrl/Cmd+Alt+I';
  return undefined;
}

export function formatAiSummaryShortcut(shortcut: ExtendedSettings['aiSummaryShortcut']) {
  if (shortcut === 'disabled') return undefined;
  if (shortcut === 'ctrl-enter') return 'Ctrl/Cmd+Enter';
  if (shortcut === 'ctrl-shift-enter') return 'Ctrl/Cmd+Shift+Enter';
  return undefined;
}

export function parseBoundedInteger(value: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function parseBoundedFloat(value: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function estimateCloudAiRequestTokens(request: AiAskRequest) {
  const requestText = [
    request.instruction,
    request.userText,
    request.scopeText,
    request.scopeLabel,
    request.conversationContext,
    request.retrievalQuery,
  ].filter((value) => Boolean(value?.trim())).join('\n\n');
  return Math.ceil(requestText.length / 2.6) + 500;
}

export function shouldUseHybridLocalFirstCloudSummary(request: AiAskRequest, settings: ExtendedSettings) {
  return settings.localAiEnabled
    && request.mode === 'cloud'
    && request.interactionMode !== 'agent'
    && settings.aiHybridLocalFirstCloudSummary
    && !request.scopeText?.trim();
}

export function buildHybridLocalFirstCloudRequest(request: AiAskRequest, localResponse: AiResponse, prompt: string): AiAskRequest {
  const evidenceLabel = request.interactionMode === 'agent' ? 'Agent 工具结果' : '本地索引检索证据';
  const evidence = formatHybridLocalEvidence(localResponse, evidenceLabel);
  const sourceInstruction = request.interactionMode === 'agent'
    ? '请基于下方“Agent 工具结果”进行最终总结。这些内容是 BookMind 工具读取和检索到的结果，不是用户手动发送的上下文；不要表述为“用户发送了上下文”“用户提供了段落”“你发送了内容”。优先使用工具结果中的引用和章节信息；如果证据不足，请明确说明不足，不要虚构未出现的情节。'
    : '请基于下方“本地索引检索证据”进行最终总结。优先使用证据中的引用和章节信息；如果证据不足，请明确说明不足，不要虚构未出现的情节。';
  return {
    ...request,
    instruction: [
      request.instruction,
      sourceInstruction,
    ].filter(Boolean).join('\n\n'),
    userText: [request.userText, `${evidenceLabel}：\n${evidence}`].filter((value) => Boolean(value?.trim())).join('\n\n'),
    retrievalQuery: request.retrievalQuery ?? prompt,
    scopeLabel: [request.scopeLabel, request.interactionMode === 'agent' ? 'Agent 工具结果增强' : '本地索引证据增强'].filter(Boolean).join(' · '),
  };
}

function formatHybridLocalEvidence(localResponse: AiResponse, title = '本地索引检索证据') {
  const answer = localResponse.answer.trim().slice(0, 3600);
  const citationLines = localResponse.citations.slice(0, 8).map((citation, index) => {
    const location = [
      citation.label,
      citation.chapterIndex !== undefined ? `章节 ${citation.chapterIndex + 1}` : '',
      citation.paragraphIndex !== undefined ? `段落 ${citation.paragraphIndex + 1}` : '',
    ].filter(Boolean).join(' · ');
    return `${index + 1}. ${location || '引用'}：${citation.text.trim().slice(0, 420)}`;
  });
  return [
    `${title}：`,
    answer ? `本地回答摘要：\n${answer}` : '本地回答摘要：无',
    citationLines.length ? `引用片段：\n${citationLines.join('\n')}` : '引用片段：无',
    localResponse.diagnostics?.recommendations?.length ? `检索诊断建议：${localResponse.diagnostics.recommendations.slice(0, 4).join('；')}` : '',
  ].filter(Boolean).join('\n\n');
}

export function loadRecentCommandIds(): CommandId[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(recentCommandIdsStorageKey) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is CommandId => typeof item === 'string').slice(0, recentCommandLimit) : [];
  } catch {
    return [];
  }
}

export function saveRecentCommandIds(commandId: CommandId, current: CommandId[]) {
  const next = [commandId, ...current.filter((id) => id !== commandId)].slice(0, recentCommandLimit);
  try {
    window.localStorage.setItem(recentCommandIdsStorageKey, JSON.stringify(next));
  } catch {
    // Ignore storage failures; command execution should not depend on usage ranking persistence.
  }
  return next;
}

export function loadMainWindowGeometry(): MainWindowGeometry | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(mainWindowGeometryStorageKey) ?? 'null') as Partial<MainWindowGeometry> | null;
    if (!parsed || !Number.isFinite(parsed.x) || !Number.isFinite(parsed.y) || !Number.isFinite(parsed.width) || !Number.isFinite(parsed.height)) return null;
    if (parsed.width! < 720 || parsed.height! < 520) return null;
    return withMainWindowMaximizedState({ x: Math.round(parsed.x!), y: Math.round(parsed.y!), width: Math.round(parsed.width!), height: Math.round(parsed.height!) }, parsed.maximized === true);
  } catch {
    return null;
  }
}

export function isMainWindowGeometryUsable(geometry: MainWindowGeometry | null | undefined) {
  if (!geometry) return false;
  return [geometry.x, geometry.y, geometry.width, geometry.height].every(Number.isFinite)
    && geometry.width >= 720
    && geometry.height >= 520;
}

export function resolveMainWindowGeometryForWorkAreas(geometry: MainWindowGeometry, workAreas: MainWindowWorkArea[]) {
  const safeWidth = Math.max(720, Math.round(geometry.width));
  const safeHeight = Math.max(520, Math.round(geometry.height));
  const safeGeometry = withMainWindowMaximizedState({ x: Math.round(geometry.x), y: Math.round(geometry.y), width: safeWidth, height: safeHeight }, geometry.maximized === true);
  const usableAreas = workAreas.filter(isMainWindowGeometryUsable);
  if (!usableAreas.length) return safeGeometry;
  const visibleArea = usableAreas.find((area) => getGeometryIntersectionArea(safeGeometry, area) >= Math.min(160 * 120, safeWidth * safeHeight * 0.12));
  if (visibleArea) return safeGeometry;
  const fallbackArea = usableAreas[0];
  return withMainWindowMaximizedState({
    x: Math.round(fallbackArea.x + Math.max(0, fallbackArea.width - safeWidth) / 2),
    y: Math.round(fallbackArea.y + Math.max(0, fallbackArea.height - safeHeight) / 2),
    width: Math.min(safeWidth, fallbackArea.width),
    height: Math.min(safeHeight, fallbackArea.height),
  }, geometry.maximized === true);
}

export function shouldRestoreMainWindowMaximized(geometry: MainWindowGeometry | null | undefined) {
  return isMainWindowGeometryUsable(geometry) && geometry?.maximized === true;
}

export function resolveActiveCharacterExtractionBookId(
  localCharacterExtractionBookId: string | null,
  selectedCharacterBookId: string | null,
  tasks: Pick<TaskStatus, 'bookId' | 'kind' | 'status' | 'createdAt' | 'startedAt' | 'updatedAt' | 'finishedAt'>[],
) {
  if (localCharacterExtractionBookId) {
    const latestLocalTask = getLatestCharacterExtractionTask(tasks, localCharacterExtractionBookId);
    if (!latestLocalTask) return localCharacterExtractionBookId;
    return isLiveCharacterExtractionStatus(latestLocalTask.status) ? localCharacterExtractionBookId : null;
  }
  if (!selectedCharacterBookId) return null;
  const latestSelectedTask = getLatestCharacterExtractionTask(tasks, selectedCharacterBookId);
  return latestSelectedTask && isLiveCharacterExtractionStatus(latestSelectedTask.status) ? latestSelectedTask.bookId : null;
}

function getLatestCharacterExtractionTask(
  tasks: Pick<TaskStatus, 'bookId' | 'kind' | 'status' | 'createdAt' | 'startedAt' | 'updatedAt' | 'finishedAt'>[],
  bookId: string,
) {
  return tasks
    .filter((task) => task.bookId === bookId && task.kind === 'character-extraction')
    .sort((left, right) => taskStatusSortMillisForShell(right) - taskStatusSortMillisForShell(left))[0] ?? null;
}

function isLiveCharacterExtractionStatus(status: TaskStatus['status']) {
  return status === 'queued' || status === 'running' || status === 'paused' || status === 'cancelling';
}

function taskStatusSortMillisForShell(task: Pick<TaskStatus, 'createdAt' | 'startedAt' | 'updatedAt' | 'finishedAt'>) {
  return [task.finishedAt, task.updatedAt, task.startedAt, task.createdAt]
    .map((value) => parseTaskStatusMillisForShell(value))
    .find((value) => value > 0) ?? 0;
}

function parseTaskStatusMillisForShell(value: string) {
  if (!value) return 0;
  const numeric = Number.parseInt(value, 10);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsedDate = Date.parse(value);
  return Number.isFinite(parsedDate) ? parsedDate : 0;
}

function withMainWindowMaximizedState(geometry: MainWindowGeometry, maximized: boolean): MainWindowGeometry {
  return maximized ? { ...geometry, maximized: true } : geometry;
}

function getGeometryIntersectionArea(left: MainWindowGeometry, right: MainWindowGeometry) {
  const xOverlap = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const yOverlap = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return xOverlap * yOverlap;
}

async function loadMainWindowWorkAreas(): Promise<MainWindowWorkArea[]> {
  try {
    const monitors = await availableMonitors();
    if (monitors.length) return monitors.map((monitor) => ({
      x: monitor.position.x,
      y: monitor.position.y,
      width: monitor.size.width,
      height: monitor.size.height,
    }));
    const primary = await primaryMonitor();
    return primary ? [{
      x: primary.position.x,
      y: primary.position.y,
      width: primary.size.width,
      height: primary.size.height,
    }] : [];
  } catch {
    return [];
  }
}

export async function restoreMainWindowGeometry() {
  const geometry = loadMainWindowGeometry();
  if (!geometry) return;
  const current = getCurrentWindow();
  const resolved = resolveMainWindowGeometryForWorkAreas(geometry, await loadMainWindowWorkAreas());
  await current.setSize(new PhysicalSize(resolved.width, resolved.height));
  await current.setPosition(new PhysicalPosition(resolved.x, resolved.y));
  if (shouldRestoreMainWindowMaximized(geometry)) await current.maximize();
}

export async function saveMainWindowGeometry() {
  const current = getCurrentWindow();
  if (await current.isMinimized()) return;
  const [position, size, maximized] = await Promise.all([current.outerPosition(), current.outerSize(), current.isMaximized()]);
  const previous = loadMainWindowGeometry();
  const currentGeometry: MainWindowGeometry = { x: position.x, y: position.y, width: size.width, height: size.height, maximized };
  const geometry: MainWindowGeometry = maximized && previous && isMainWindowGeometryUsable(previous)
    ? withMainWindowMaximizedState(previous, true)
    : currentGeometry;
  if (!isMainWindowGeometryUsable(geometry)) return;
  try {
    window.localStorage.setItem(mainWindowGeometryStorageKey, JSON.stringify(geometry));
  } catch {
    // Window geometry is a convenience preference; ignore storage failures.
  }
}

export function scheduleMainWindowGeometrySave(timerRef: { current: number | null }) {
  if (timerRef.current) window.clearTimeout(timerRef.current);
  timerRef.current = window.setTimeout(() => { void saveMainWindowGeometry(); }, 400);
}

export function cancelScheduledMainWindowGeometrySave(timerRef: { current: number | null }) {
  if (!timerRef.current) return;
  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}

export async function confirmExternalPathOpen(path: string, enabled: boolean, kind: 'file' | 'directory') {
  if (!enabled) return true;
  const label = kind === 'directory' ? '目录' : '文件';
  return requestAppConfirm(`确认打开外部${label}路径并导入到 BookMind？\n\n${path}`);
}

export function openFirstImportedBookAfterDirectoryImport(imported: Book[], openImportedBookAfterImport: boolean): { bookId: string | null; targetPage: AppPage } {
  const firstImportedBookId = imported.find((item) => !item.deleted)?.id ?? null;
  return { bookId: firstImportedBookId, targetPage: firstImportedBookId && openImportedBookAfterImport ? 'reader' : 'library' };
}

export function buildImportSummaryToast(kind: 'file' | 'directory', imported: Book[], failedCount = 0): { message: string; bookId: string | null } {
  const available = imported.filter((item) => !item.deleted);
  const skipped = imported.length - available.length;
  const firstImportedBookId = available[0]?.id ?? null;
  const label = kind === 'directory' ? '目录导入完成' : '文件导入完成';
  const skippedText = skipped > 0 ? `，跳过 ${skipped} 本` : '';
  const failedText = failedCount > 0 ? `，失败 ${failedCount} 本` : '';
  return { message: `${label}：成功 ${available.length} 本${skippedText}${failedText}。`, bookId: firstImportedBookId };
}

export function shouldRunImportTocParsing(autoParseTocOnImport: boolean, imported: Book[]) {
  return autoParseTocOnImport && imported.some((item) => !item.deleted);
}

export async function saveImportedBookTocManifests(imported: Book[], chapterRules: ChapterRuleDraft) {
  const options = buildChapterParsingOptions(chapterRules);
  for (const importedBook of imported.filter((item) => !item.deleted)) {
    const book = importedBook.content ? importedBook : await loadReaderDocument(importedBook.id);
    const manifest = buildReaderTocManifest(book, options);
    await saveReaderRecord(book.id, 'tocManifest', manifest, 'import-toc');
  }
}

export function buildTxtImportCleanupOptions(enabled: boolean, encodingMode: ExtendedSettings['txtImportEncodingMode'], backupOriginalOnImport: boolean, coverToneStrategy: ExtendedSettings['defaultCoverToneStrategy'], coverLabelStrategy: ExtendedSettings['defaultCoverLabelStrategy'], cleanTitleFromFilename: boolean, autoDetectAuthor: boolean, chapterRules: ChapterRuleDraft): TxtImportCleanupOptions {
  return {
    enabled,
    encodingMode,
    backupOriginalOnImport,
    coverToneStrategy,
    coverLabelStrategy,
    cleanTitleFromFilename,
    autoDetectAuthor,
    preserveOriginalBackup: chapterRules.preserveOriginalBackup,
    removeAds: chapterRules.removeAds,
    adKeywords: chapterRules.adKeywords.split(/[，,\n]/).map((keyword) => keyword.trim()).filter(Boolean),
    removeAdUrls: chapterRules.removeAdUrls,
    removePaginationNoise: chapterRules.removePaginationNoise,
    normalizeBlankLines: chapterRules.normalizeBlankLines,
    trimTrailingWhitespace: chapterRules.trimTrailingWhitespace,
    normalizeFullWidthSpaces: chapterRules.normalizeFullWidthSpaces,
    customCleanupRules: chapterRules.customCleanupRules,
  };
}

export function buildChapterParsingOptions(chapterRules: ChapterRuleDraft) {
  return {
    enabled: chapterRules.enabled,
    maxHeadingLength: chapterRules.maxHeadingLength,
    minHeadingConfidence: chapterRules.minHeadingConfidence,
    enableChineseChapter: chapterRules.enableChineseChapter,
    enableChineseVolume: chapterRules.enableChineseVolume,
    enableSpecialHeadings: chapterRules.enableSpecialHeadings,
    enableEnglishChapter: chapterRules.enableEnglishChapter,
    enableCompactSplit: chapterRules.enableCompactSplit,
    autoIgnoreAdHeadings: chapterRules.autoIgnoreAdHeadings,
    autoIgnoreRepeatedTocHeadings: chapterRules.autoIgnoreRepeatedTocHeadings,
    compactHeadingSuffixLength: chapterRules.compactHeadingSuffixLength,
    preserveCompactPrefixText: chapterRules.preserveCompactPrefixText,
    autoDetectBookTitle: chapterRules.autoDetectBookTitle,
    bookTitleBracketMode: chapterRules.bookTitleBracketMode,
    customBookTitleBracketPattern: chapterRules.customBookTitleBracketPattern,
    bookTitleMaxLength: chapterRules.bookTitleMaxLength,
    firstLineAsBookTitle: chapterRules.firstLineAsBookTitle,
    inferBookTitleFromFileName: chapterRules.inferBookTitleFromFileName,
    paragraphMode: chapterRules.paragraphMode,
    shortLineMergeThreshold: chapterRules.shortLineMergeThreshold,
    longParagraphSliceSize: chapterRules.longParagraphSliceSize,
    forbiddenHeadingPunctuation: chapterRules.forbiddenHeadingPunctuation,
    forbiddenHeadingStartChars: chapterRules.forbiddenHeadingStartChars,
    customRegexRules: chapterRules.customRegexRules,
  };
}

export function buildImportDialogOptions(
  kind: 'file' | 'directory',
  defaultPath: ExtendedSettings['defaultImportPath'],
  importFileFilter: ExtendedSettings['importFileFilter'],
  t: Translator,
) {
  const trimmedDefaultPath = defaultPath.trim();
  const fileFilters = importFileFilter === 'txt'
    ? { filters: [{ name: t('dialog.filterBooks'), extensions: ['txt', 'md', 'markdown', 'epub', 'mobi', 'pdf'] }] }
    : {};
  return kind === 'directory'
    ? {
        title: t('dialog.chooseDirectory'),
        directory: true,
        recursive: true,
        multiple: false,
        ...(trimmedDefaultPath ? { defaultPath: trimmedDefaultPath } : {}),
      }
    : {
        title: t('dialog.chooseBook'),
        multiple: false,
        ...fileFilters,
        ...(trimmedDefaultPath ? { defaultPath: trimmedDefaultPath } : {}),
      };
}

export function showTaskCenterForLongOperation(enabled: boolean, setActivePage: (page: AppPage) => void) {
  if (enabled) setActivePage('tasks');
}

export function loadLastReaderBookId() {
  try {
    return window.localStorage.getItem(lastReaderBookIdStorageKey);
  } catch {
    return null;
  }
}

export function clearLastReaderBookId() {
  try {
    window.localStorage.removeItem(lastReaderBookIdStorageKey);
  } catch {
    // Clearing privacy-sensitive recent-reader state should not block the rest of the shell.
  }
}

export function saveLastReaderBookId(bookId: string, recordRecentReaderBooks: boolean) {
  try {
    if (!recordRecentReaderBooks) {
      window.localStorage.removeItem(lastReaderBookIdStorageKey);
      return;
    }
    window.localStorage.setItem(lastReaderBookIdStorageKey, bookId);
  } catch {
    // Last-book startup restore is a convenience setting; opening the book should continue.
  }
}

export function resolveStartupReaderBookId(standaloneBookId: string | null, books: Book[], openLastReaderBookOnStartup: boolean, recordRecentReaderBooks: boolean) {
  if (standaloneBookId && books.some((item) => item.id === standaloneBookId && !item.deleted)) return standaloneBookId;
  if (!openLastReaderBookOnStartup || !recordRecentReaderBooks) return null;
  return resolveRecentReaderBookId(books, recordRecentReaderBooks);
}

export function resolveRecentReaderBookId(books: Book[], recordRecentReaderBooks: boolean) {
  if (!recordRecentReaderBooks) return null;
  const lastReaderBookId = loadLastReaderBookId();
  return lastReaderBookId && books.some((item) => item.id === lastReaderBookId && !item.deleted) ? lastReaderBookId : null;
}

export async function checkUnfinishedTasksOnStartup() {
  const tasks = getUnfinishedTaskStatuses(await loadTaskStatuses());
  return tasks.length ? { count: tasks.length, tasks } : null;
}

export async function refreshLibraryMetadataOnStartup() {
  return await refreshLibraryMetadata();
}

export async function maybeCreateStartupAutoDataBackup(settings: ExtendedSettings) {
  if (!settings.dataAutoBackupEnabled || !isTauriRuntime()) return;
  const now = Date.now();
  const intervalMs = dataAutoBackupIntervalMs(settings.dataAutoBackupFrequency);
  const lastBackupAt = loadLastAutoDataBackupAt();
  if (lastBackupAt > 0 && now - lastBackupAt < intervalMs) return;
  try {
    const retentionLimit = parseBoundedInteger(settings.dataAutoBackupRetentionLimit, 5, 1, 30);
    await createAutoDataBackup(retentionLimit, settings.dataBackupMode);
    saveLastAutoDataBackupAt(now);
  } catch (error) {
    console.warn('Failed to create startup automatic data backup:', error);
  }
}

function dataAutoBackupIntervalMs(frequency: ExtendedSettings['dataAutoBackupFrequency']) {
  const day = 24 * 60 * 60 * 1000;
  if (frequency === 'daily') return day;
  if (frequency === 'monthly') return day * 30;
  return day * 7;
}

function loadLastAutoDataBackupAt() {
  try {
    const raw = window.localStorage.getItem(lastAutoDataBackupAtStorageKey);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  } catch {
    return 0;
  }
}

function saveLastAutoDataBackupAt(value: number) {
  try {
    window.localStorage.setItem(lastAutoDataBackupAtStorageKey, String(value));
  } catch {
    // Automatic backup scheduling state is best-effort; backup creation already completed.
  }
}

export function mergeLibraryMetadataBooks(current: Book[], refreshed: Book[]) {
  return refreshed.map(stripBookDocumentPayload);
}

export function stripBookDocumentPayload(book: Book): Book {
  // Browser preview keeps inline content so demo books remain readable without Tauri document loading.
  if (!isTauriRuntime()) return book;
  if (!book.content && book.chunks.length === 0) return book;
  return { ...book, content: '', chunks: [] };
}

export function stripBookDocumentPayloads(books: Book[]): Book[] {
  return books.map(stripBookDocumentPayload);
}

export function resolveVisibleAppPages(visibleNavItems: ExtendedSettings['visibleNavItems'], booksOpenInStandaloneReader: boolean): AppPage[] {
  const configured = booksOpenInStandaloneReader ? visibleNavItems.filter((page) => page !== 'reader') : visibleNavItems;
  const pages = [...configured, 'settings'].filter((page, index, list): page is AppPage => defaultVisibleAppPages.includes(page as AppPage) && list.indexOf(page) === index);
  return pages.length ? pages : ['settings'];
}

export function resolveVisibleAppPage(page: AppPage, visibleNavItems: ExtendedSettings['visibleNavItems'], booksOpenInStandaloneReader: boolean): AppPage {
  const visiblePages = resolveVisibleAppPages(visibleNavItems, booksOpenInStandaloneReader);
  return visiblePages.includes(page) ? page : visiblePages[0];
}

export function canOpenReaderOnStartup(startupPage: ExtendedSettings['startupPage'], visibleNavItems: ExtendedSettings['visibleNavItems'], booksOpenInStandaloneReader: boolean, openLastReaderBookOnStartup: boolean) {
  if (!openLastReaderBookOnStartup) return false;
  if (startupPage !== 'reader' && startupPage !== 'last') return false;
  return resolveVisibleAppPages(visibleNavItems, booksOpenInStandaloneReader).includes('reader');
}

export function resolveStartupPage(
  standaloneReader: boolean,
  startupPage: ExtendedSettings['startupPage'],
  visibleNavItems: ExtendedSettings['visibleNavItems'] = defaultVisibleAppPages as ExtendedSettings['visibleNavItems'],
  booksOpenInStandaloneReader = false,
): AppPage {
  if (standaloneReader) return 'reader';
  const preferredPage = startupPage === 'last' ? 'overview' : startupPage;
  return resolveVisibleAppPage(preferredPage, visibleNavItems, booksOpenInStandaloneReader);
}

export function isDarkAppTheme(extendedSettings: ExtendedSettings) {
  if (extendedSettings.appTheme === 'dark') return true;
  if (extendedSettings.appTheme === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function buildAppThemeStyle(settings: ExtendedSettings): CSSProperties {
  return { '--indigo': settings.customThemeColor } as CSSProperties;
}
