import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { convertFileSrc } from '@tauri-apps/api/core';
import { redactTaskText } from '../features/task-center/taskPrivacy';
import { buildCharacterProfileDetail, preloadCharacterProfileDetailIndex, type CharacterProfileDetail } from '../features/characters/characterProfileDetail';
import {
  buildCharacterAiPostprocessNameList,
  buildCharacterAiPostprocessDebugText,
  buildCharacterAiPostprocessPreview,
  buildCharacterAiPostprocessPrompt,
  chunkCharacterAiPostprocessNameList,
  parseCharacterAiPostprocessResponse,
  type CharacterAiPostprocessParseResult,
  type CharacterAiPostprocessOperation,
} from '../features/characters/characterAiPostprocessModel';
import { buildCharacterOverviewMetrics } from '../features/characters/characterOverviewMetrics';
import type { CharacterGraphEdgeDetail } from '../features/characters/characterGraphEdgeDetail';
import { CharacterRelationGraphView, renderCharacterGraphEdgeDetail } from '../features/characters/CharacterRelationGraphView';
import { renderCharacterAppearanceHeatmap, renderCharacterProfiles } from '../features/characters/CharacterWorkbenchViews';
import { buildCharacterEvidenceReaderOpenDetail, buildCharacterLocationReaderOpenDetail, type CharacterEvidenceReaderOpenDetail } from '../features/characters/characterEvidenceNavigation';
import { renderCharacterEvidenceTable } from '../features/characters/CharacterEvidenceTable';
import { getCharacterOverviewSectionFallbackKey } from '../features/characters/characterOverviewWorkbenchModel';
import { getPrivacyBookTitle, getPrivacyFileName, type ExtendedSettings } from '../services/settingsCenterService';
import { requestCloudAiAnswerStream } from '../services/aiService';
import { loadAppSettings } from '../services/settingsService';
import { resolveAiProviderRequestSettings } from '../features/settings-center/settingsCenterAiProviderModel';
import { applyCharacterAiPostprocess, loadCharacterCenterPayload, loadCharacterReferenceQuotes } from '../services/characterCenterService';
import { requestAppConfirm } from '../components/useAppConfirm';
import type { CharacterCenterBookSummary, CharacterCenterPayload, CharacterEvent, CharacterEvidence, CharacterFactionMembership, CharacterIndexStatus, CharacterLocation, CharacterOverviewSnapshot, CharacterRelation, CharacterWorkbenchView, IndexDiagnostics } from '../types';
import { useI18n, type TranslationKey } from '../i18n';
import { BookMindIcon, type BookMindIconName } from '../components/BookMindIcon';
import { ThemedSelect } from '../components/ThemedSelect';
import {
  buildTextIndexViewFromSummary,
  canQueueCharacterRebuild,
  characterOverviewStatHintKey,
  characterOverviewStatLabelKey,
  characterStatusLabel,
  formatCharacterLocation,
  indexStatusLabel,
  isEditableCharacterCenterShortcutTarget,
  isOpenableCharacterLocation,
  matchesBookStatusFilter,
  textIndexClassName,
} from './CharacterPageUtils';
import {
  formatCharacterRelationMeta,
  renderCharacterInspectorPanel,
  renderCharacterStubWorkbenchView,
} from './CharacterPageRenderers';
import {
  resolveCharacterCenterState,
  type CharacterCenterState,
} from '../features/characters/characterCenterState';
import type { CharacterGraphSessionState, CharacterGraphSessionStatePatch } from '../features/characters/characterCenterSession';

type CharactersPageProps = {
  bookSummaries: CharacterCenterBookSummary[];
  currentBook: CharacterCenterBookSummary | null;
  unavailableBookReason: CharacterCenterUnavailableBookReason;
  indexDiagnostics: IndexDiagnostics | null;
  characterPayload: CharacterCenterPayload | null;
  overviewSnapshot: CharacterOverviewSnapshot | null;
  overviewSnapshotLoading: boolean;
  selectedWorkbenchView: CharacterWorkbenchView;
  renderedWorkbenchView: CharacterWorkbenchView;
  characterGraphSessionState: CharacterGraphSessionState;
  privacySettings: ExtendedSettings;
  indexingBookId: string | null;
  characterExtractionBookId: string | null;
  onSelectBook: (bookId: string) => void;
  onOpenBook: (bookId: string) => void;
  onOpenLibrary: () => void;
  onOpenTasks: () => void;
  onSelectWorkbenchView: (view: CharacterWorkbenchView) => void;
  onRenderWorkbenchView: (view: CharacterWorkbenchView) => void;
  onCharacterGraphSessionStateChange: (patch: CharacterGraphSessionStatePatch) => void;
  onRequestCharacterOverviewSnapshot: (bookId: string) => void;
  onRequestCharacterPayload: (bookId: string) => void;
  onRequestCharacterBookSummaries: () => void | Promise<void>;
  onRunParseIndex: (bookId: string) => Promise<void>;
  onQueueCharacterExtraction: (bookId: string) => Promise<void>;
  onOpenReaderEvidence: (detail: CharacterEvidenceReaderOpenDetail) => void;
};

type CharacterCenterUnavailableBookReason = 'none' | 'missing' | 'deleted';

type CharacterBookStatusFilter = 'all' | 'ready' | 'missing' | 'stale' | 'failed' | 'character-failed';
type CharacterInspectorStyle = CSSProperties & { '--characters-inspector-width': string };
type CharacterBookMenuState = { bookId: string; x: number; y: number };

const characterWorkbenchViews: Array<{ id: CharacterWorkbenchView; labelKey: TranslationKey; icon: BookMindIconName }> = [
  { id: 'overview', labelKey: 'characters.mobileView.overview', icon: 'overview' },
  { id: 'profiles', labelKey: 'characters.mobileView.profiles', icon: 'characters' },
  { id: 'relations', labelKey: 'characters.mobileView.relations', icon: 'knowledge' },
  { id: 'heatmap', labelKey: 'characters.mobileView.heatmap', icon: 'librarySort' },
  { id: 'timeline', labelKey: 'characters.mobileView.timeline', icon: 'toc' },
  { id: 'factions', labelKey: 'characters.mobileView.factions', icon: 'libraryShelfView' },
  { id: 'evidence', labelKey: 'characters.mobileView.evidence', icon: 'note' },
  { id: 'review', labelKey: 'characters.mobileView.review', icon: 'diagnostics' },
  { id: 'export', labelKey: 'characters.mobileView.export', icon: 'saveCommand' },
];
const characterMobileViewTabs: Array<{ href: string; labelKey: TranslationKey; viewId?: CharacterWorkbenchView }> = [
  { href: '#characters-overview', labelKey: 'characters.mobileView.overview', viewId: 'overview' },
  { href: '#characters-profiles', labelKey: 'characters.mobileView.profiles', viewId: 'profiles' },
  { href: '#characters-relations', labelKey: 'characters.mobileView.relations', viewId: 'relations' },
  { href: '#characters-heatmap', labelKey: 'characters.mobileView.heatmap', viewId: 'heatmap' },
  { href: '#characters-evidence', labelKey: 'characters.mobileView.evidence', viewId: 'evidence' },
  { href: '#characters-detail', labelKey: 'characters.mobileView.detail' },
];

export function CharactersPage({
  bookSummaries,
  currentBook,
  unavailableBookReason,
  indexDiagnostics,
  characterPayload,
  overviewSnapshot,
  overviewSnapshotLoading,
  selectedWorkbenchView,
  renderedWorkbenchView,
  characterGraphSessionState,
  privacySettings,
  indexingBookId,
  characterExtractionBookId,
  onSelectBook,
  onOpenBook,
  onOpenLibrary,
  onOpenTasks,
  onSelectWorkbenchView,
  onRenderWorkbenchView,
  onCharacterGraphSessionStateChange,
  onRequestCharacterOverviewSnapshot,
  onRequestCharacterPayload,
  onRequestCharacterBookSummaries,
  onRunParseIndex,
  onQueueCharacterExtraction,
  onOpenReaderEvidence,
}: CharactersPageProps) {
  const { t } = useI18n();
  const bookSearchInputRef = useRef<HTMLInputElement | null>(null);
  const overviewSnapshotRequestKeyRef = useRef('');
  const [actionError, setActionError] = useState('');
  const [bookQuery, setBookQuery] = useState('');
  const [bookStatusFilter, setBookStatusFilter] = useState<CharacterBookStatusFilter>('all');
  const [bookMenu, setBookMenu] = useState<CharacterBookMenuState | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedRelationDetail, setSelectedRelationDetail] = useState<CharacterGraphEdgeDetail | null>(null);
  const [graphFullscreen, setGraphFullscreen] = useState(false);
  const deferredWorkbenchView = useDeferredValue(renderedWorkbenchView);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(320);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiApplyStatus, setAiApplyStatus] = useState('');
  const [aiOperations, setAiOperations] = useState<CharacterAiPostprocessOperation[]>([]);
  const [aiDebugRequest, setAiDebugRequest] = useState('');
  const [aiDebugResponse, setAiDebugResponse] = useState('');
  const [aiBatchSize, setAiBatchSize] = useState('400');
  const [aiPreparedPayload, setAiPreparedPayload] = useState<CharacterCenterPayload | null>(null);
  const [aiPreparedNames, setAiPreparedNames] = useState<ReturnType<typeof buildCharacterAiPostprocessNameList>>([]);
  const workbenchSwitching = selectedWorkbenchView !== deferredWorkbenchView;
  const filteredBooks = useMemo<CharacterCenterBookSummary[]>(() => {
    const normalizedQuery = bookQuery.trim().toLocaleLowerCase();
    return bookSummaries.filter((book) => {
      const searchableText = [
        getPrivacyBookTitle(book.displayTitle || book.title, privacySettings),
        book.author,
        getPrivacyFileName(book.fileName, privacySettings),
      ].join(' ').toLocaleLowerCase();
      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);
      return matchesQuery && matchesBookStatusFilter(book, bookStatusFilter);
    });
  }, [bookQuery, bookStatusFilter, bookSummaries, privacySettings]);
  const selectedBook = currentBook;
  const menuBook = bookMenu ? bookSummaries.find((book) => book.id === bookMenu.bookId) ?? null : null;
  const workbenchNeedsFullPayload = selectedBook && (
    deferredWorkbenchView === 'profiles'
    || deferredWorkbenchView === 'relations'
    || deferredWorkbenchView === 'heatmap'
    || deferredWorkbenchView === 'evidence'
  );
  const selectedCharacterPayload = useMemo(() => {
    return selectedBook && characterPayload?.book.id === selectedBook.id ? characterPayload : null;
  }, [characterPayload, selectedBook]);
  const deferredSelectedCharacterId = useDeferredValue(selectedCharacterId);
  const selectedCharacterDetail = useMemo(() => {
    if (!selectedCharacterPayload || !deferredSelectedCharacterId) return null;
    return buildCharacterProfileDetail(selectedCharacterPayload, deferredSelectedCharacterId, { previewLimit: 24 });
  }, [selectedCharacterPayload, deferredSelectedCharacterId]);
  const selectedIndexView = buildTextIndexViewFromSummary(selectedBook);
  const characterStatus = selectedBook?.characterIndexStatus ?? 'missing';
  const overviewSnapshotRequestKey = selectedBook
    ? [
      selectedBook.id,
      selectedBook.characterIndexStatus,
      selectedBook.characterCount ?? 0,
      selectedBook.relationCount ?? 0,
      selectedBook.evidenceCount ?? 0,
      selectedBook.lastCharacterBuiltAt ?? '',
      selectedBook.lastTaskId ?? '',
    ].join(':')
    : '';
  const characterStateIssue = selectedBook ? {
    staleReason: selectedBook.staleReason,
    lastError: selectedBook.lastError,
    lastTaskId: selectedBook.lastTaskId,
    errorCode: selectedBook.errorCode,
    errorStage: selectedBook.errorStage,
    recentLogEntry: selectedBook.recentLogEntry,
  } : {};
  const centerState = resolveCharacterCenterState(selectedBook, selectedIndexView, characterStatus, characterStateIssue);
  const extractingCharacters = Boolean(selectedBook && characterExtractionBookId === selectedBook.id);
  const overviewMetricProfiles = useMemo(() => [], []);
  const metrics = useMemo(() => buildCharacterOverviewMetrics({
    book: selectedBook,
    manifest: null,
    profiles: overviewMetricProfiles,
    centerState: { showZeroCharacterMetrics: centerState.showZeroCharacterMetrics },
  }), [centerState.showZeroCharacterMetrics, overviewMetricProfiles, selectedBook]);
  const privacyMode = Boolean(privacySettings.applicationPrivacyMode);
  const centerMetrics = useMemo(() => ({
    readyBooks: bookSummaries.filter((book) => book.characterIndexStatus === 'ready').length,
    characters: bookSummaries.reduce((total, book) => total + (book.characterCount ?? 0), 0),
    relations: bookSummaries.reduce((total, book) => total + (book.relationCount ?? 0), 0),
    evidence: bookSummaries.reduce((total, book) => total + (book.evidenceCount ?? 0), 0),
  }), [bookSummaries]);

  function selectWorkbenchView(view: CharacterWorkbenchView) {
    if (view === 'overview') markCharacterPerformance('overview-switch-start');
    if (view !== 'relations') setSelectedRelationDetail(null);
    if (view !== 'relations') setGraphFullscreen(false);
    onSelectWorkbenchView(view);
    startTransition(() => onRenderWorkbenchView(view));
  }

  function selectCharacter(characterId: string) {
    startTransition(() => {
      setSelectedRelationDetail(null);
      setSelectedCharacterId(characterId);
    });
  }

  function openBookMenu(event: ReactMouseEvent<HTMLElement>, book: CharacterCenterBookSummary) {
    event.preventDefault();
    event.stopPropagation();
    onSelectBook(book.id);
    const rect = event.currentTarget.getBoundingClientRect();
    const anchorX = event.type === 'contextmenu' ? event.clientX : rect.right;
    const anchorY = event.type === 'contextmenu' ? event.clientY : rect.top;
    const menuWidth = 292;
    const menuHeight = 410;
    setBookMenu({
      bookId: book.id,
      x: Math.max(10, Math.min(anchorX, window.innerWidth - menuWidth - 10)),
      y: Math.max(10, Math.min(anchorY, window.innerHeight - menuHeight - 10)),
    });
  }

  const inspectRelationDetail = useCallback((detail: CharacterGraphEdgeDetail | null) => {
    setSelectedRelationDetail(detail);
    if (detail) setInspectorCollapsed(false);
  }, []);

  useEffect(() => {
    setSelectedCharacterId(null);
    setSelectedRelationDetail(null);
    setGraphFullscreen(false);
  }, [selectedBook?.id]);

  useEffect(() => {
    if (!bookMenu) return undefined;
    const closeMenu = () => setBookMenu(null);
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('keydown', closeMenuOnEscape);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('keydown', closeMenuOnEscape);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [bookMenu]);

  useEffect(() => {
    if (!selectedCharacterPayload || !selectedCharacterId) return;
    if (!selectedCharacterPayload.profiles.some((profile) => profile.id === selectedCharacterId)) {
      setSelectedCharacterId(null);
    }
  }, [selectedCharacterPayload, selectedCharacterId]);

  useEffect(() => {
    if (deferredWorkbenchView !== 'overview' || !selectedBook || overviewSnapshot?.bookId === selectedBook.id || overviewSnapshotLoading) return;
    if (overviewSnapshotRequestKeyRef.current === overviewSnapshotRequestKey) return;
    overviewSnapshotRequestKeyRef.current = overviewSnapshotRequestKey;
    onRequestCharacterOverviewSnapshot(selectedBook.id);
  }, [deferredWorkbenchView, onRequestCharacterOverviewSnapshot, overviewSnapshot?.bookId, overviewSnapshotLoading, overviewSnapshotRequestKey, selectedBook]);

  useEffect(() => {
    if (deferredWorkbenchView !== 'overview' || !selectedBook) return;
    if (overviewSnapshotLoading && overviewSnapshot?.bookId !== selectedBook.id) return;
    markCharacterPerformance('overview-summary-ready');
  }, [deferredWorkbenchView, overviewSnapshot?.bookId, overviewSnapshotLoading, selectedBook]);

  useEffect(() => {
    if (!workbenchNeedsFullPayload || !selectedBook) return;
    if (selectedCharacterPayload) return;
    onRequestCharacterPayload(selectedBook.id);
  }, [workbenchNeedsFullPayload, selectedBook, selectedCharacterPayload, onRequestCharacterPayload]);

  useEffect(() => {
    if (!selectedCharacterPayload) return undefined;
    let disposed = false;
    const preload = () => {
      if (!disposed) preloadCharacterProfileDetailIndex(selectedCharacterPayload);
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(preload, { timeout: 1200 });
      return () => {
        disposed = true;
        window.cancelIdleCallback(idleId);
      };
    }
    const timer = globalThis.setTimeout(preload, 0);
    return () => {
      disposed = true;
      globalThis.clearTimeout(timer);
    };
  }, [selectedCharacterPayload]);

  async function runParseIndexForBook(bookId: string) {
    if (!bookId || indexingBookId === bookId) return;
    setActionError('');
    try {
      await onRunParseIndex(bookId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  function confirmCharacterRebuild() {
    return requestAppConfirm(t('characters.confirmRebuildCharacterIndex'));
  }

  async function queueCharacterExtractionForBook(bookId: string, options: { confirmRebuild?: boolean } = {}) {
    if (!bookId || characterExtractionBookId === bookId) return;
    if (options.confirmRebuild && !await confirmCharacterRebuild()) return;
    setActionError('');
    try {
      await onQueueCharacterExtraction(bookId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  async function queueCharacterExtraction(options: { confirmRebuild?: boolean } = {}) {
    if (!selectedBook) return;
    await queueCharacterExtractionForBook(selectedBook.id, options);
  }

  async function prepareCharacterAiPostprocessRequest() {
    if (!selectedBook) return;
    setAiDebugRequest('正在准备发送内容…');
    let payload = selectedCharacterPayload ?? (characterPayload?.book.id === selectedBook.id ? characterPayload : null);
    if (!payload) {
      payload = await loadCharacterCenterPayload(selectedBook.id);
      if (!payload) {
        setAiDebugRequest('人物数据尚未生成，无法准备发送内容。');
        setAiApplyStatus('人物数据尚未生成，请先重建人物索引。');
        return;
      }
      onRequestCharacterPayload(selectedBook.id);
    }
    const referenceQuotes = await loadCharacterReferenceQuotes(selectedBook.id);
    const names = buildCharacterAiPostprocessNameList(payload.profiles, referenceQuotes, payload.evidence);
    const batchSize = normalizeCharacterAiBatchSize(aiBatchSize);
    const chunks = chunkCharacterAiPostprocessNameList(names, batchSize);
    setAiPreparedPayload(payload);
    setAiPreparedNames(names);
    setAiDebugRequest(`分批发送：共 ${names.length} 个人物，${chunks.length} 批，每批最多 ${batchSize} 个。\n\n实际 userText:\n\n<空>\n\n人物名单/引用预览:\n\n${buildCharacterAiPostprocessDebugText(names)}`);
  }

  function openCharacterAiPostprocessPanel() {
    if (!selectedBook) return;
    setAiPanelOpen(true);
    setAiApplyStatus('点击“开始AI处理”后再发送云端请求。');
    setAiDebugRequest('');
    setAiDebugResponse('');
    setAiOperations([]);
    setAiPreparedPayload(null);
    setAiPreparedNames([]);
    setActionError('');
    void prepareCharacterAiPostprocessRequest();
  }

  function updateCharacterAiBatchSize(value: string) {
    setAiBatchSize(value);
    if (!aiPreparedNames.length) return;
    const batchSize = normalizeCharacterAiBatchSize(value);
    const chunks = chunkCharacterAiPostprocessNameList(aiPreparedNames, batchSize);
    setAiDebugRequest(`分批发送：共 ${aiPreparedNames.length} 个人物，${chunks.length} 批，每批最多 ${batchSize} 个。\n\n实际 userText:\n\n<空>\n\n人物名单/引用预览:\n\n${buildCharacterAiPostprocessDebugText(aiPreparedNames)}`);
  }

  async function runCharacterAiPostprocess() {
    if (!selectedBook) return;
    setAiPanelOpen(true);
    setAiApplyStatus('');
    setAiDebugResponse('等待人物数据加载…');
    setActionError('');
    setAiProcessing(true);
    try {
      let payload = aiPreparedPayload;
      let names = aiPreparedNames;
      if (!payload || !names.length) {
        setAiApplyStatus('人物数据正在加载…');
        setAiDebugResponse('人物数据正在加载，云端请求尚未开始。');
        payload = await loadCharacterCenterPayload(selectedBook.id);
        if (!payload) {
          setAiApplyStatus('人物数据尚未生成，请先重建人物索引。');
          setAiDebugResponse('人物数据尚未生成，未发送云端请求。');
          return;
        }
        onRequestCharacterPayload(selectedBook.id);
        const referenceQuotes = await loadCharacterReferenceQuotes(selectedBook.id);
        names = buildCharacterAiPostprocessNameList(payload.profiles, referenceQuotes, payload.evidence);
        setAiPreparedPayload(payload);
        setAiPreparedNames(names);
      }
      const batchSize = normalizeCharacterAiBatchSize(aiBatchSize);
      const chunks = chunkCharacterAiPostprocessNameList(names, batchSize);
      setAiDebugRequest(`分批发送：共 ${names.length} 个人物，${chunks.length} 批，每批最多 ${batchSize} 个。\n\n实际 userText:\n\n<空>\n\n人物名单/引用预览:\n\n${buildCharacterAiPostprocessDebugText(names)}`);
      if (!names.length) {
        setAiApplyStatus('当前没有可处理的人物。');
        setAiDebugResponse('当前没有可发送的人物名单，未发送云端请求。');
        return;
      }
      const appSettings = resolveAiProviderRequestSettings(await loadAppSettings());
      if (!privacySettings.cloudAiEnabled || !appSettings.aiApiKey || !appSettings.aiModel || !appSettings.aiApiBaseUrl) {
        setAiApplyStatus('云端 AI 未配置完整。请到设置中心配置 API Key、Base URL 和模型后再使用。');
        setAiDebugResponse('云端 AI 未配置完整，未发送云端请求。');
        return;
      }
      const mergedParsed: CharacterAiPostprocessParseResult = { genderByIndex: new Map(), noiseIndexes: new Set() };
      const responseParts: string[] = [];
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        const chunk = chunks[chunkIndex];
        const chunkStart = chunk.items[0].index;
        const chunkEnd = chunk.items.at(-1)?.index ?? chunkStart;
        const prompt = buildCharacterAiPostprocessPrompt(chunk.items);
        let streamedAnswer = '';
        responseParts.push(`\n\n--- 第 ${chunkIndex + 1}/${chunks.length} 批：编号 ${chunkStart}-${chunkEnd} ---\n`);
        setAiApplyStatus(`AI处理中：第 ${chunkIndex + 1}/${chunks.length} 批，编号 ${chunkStart}-${chunkEnd}`);
        setAiDebugResponse(`${responseParts.join('')}云端请求已发送，等待流式输出…`);
        const answer = await requestCloudAiAnswerStream(appSettings, {
          mode: 'cloud',
          scope: 'character-center',
          instruction: prompt,
          userText: '',
          scopeLabel: `${selectedBook.displayTitle || selectedBook.title} · 第 ${chunkIndex + 1}/${chunks.length} 批`,
          requestId: `character-ai-${Date.now()}-${chunkIndex}`,
        }, {
          onToken: (token) => {
            streamedAnswer += token;
            setAiDebugResponse(`${responseParts.join('')}${streamedAnswer}`);
          },
        });
        const finalAnswer = answer.answer || streamedAnswer;
        responseParts.push(finalAnswer);
        setAiDebugResponse(responseParts.join(''));
        const parsed = parseCharacterAiPostprocessResponse(finalAnswer);
        parsed.genderByIndex.forEach((gender, index) => mergedParsed.genderByIndex.set(index, gender));
        parsed.noiseIndexes.forEach((index) => mergedParsed.noiseIndexes.add(index));
        const partialPreview = buildCharacterAiPostprocessPreview(payload.profiles, mergedParsed);
        setAiOperations(partialPreview.operations);
      }
      const preview = buildCharacterAiPostprocessPreview(payload.profiles, mergedParsed);
      setAiOperations(preview.operations);
      setAiApplyStatus(preview.operations.length ? `AI 生成 ${preview.operations.length} 项待确认操作。` : 'AI 没有返回需要应用的操作。');
    } catch (error) {
      setAiApplyStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setAiProcessing(false);
    }
  }

  async function confirmCharacterAiPostprocess() {
    if (!selectedBook) return;
    const enabledOperations = aiOperations.filter((operation) => operation.enabled);
    if (!enabledOperations.length) {
      setAiApplyStatus('没有勾选任何操作。');
      return;
    }
    setAiProcessing(true);
    try {
      const result = await applyCharacterAiPostprocess(selectedBook.id, enabledOperations);
      setAiApplyStatus(`已应用 ${result.updatedCount} 项：性别 ${result.genderCount}，噪音隐藏 ${result.hiddenCount}。`);
      setAiOperations([]);
      await onRequestCharacterBookSummaries();
      onRequestCharacterPayload(selectedBook.id);
      onRequestCharacterOverviewSnapshot(selectedBook.id);
    } catch (error) {
      setAiApplyStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setAiProcessing(false);
    }
  }

  function toggleAiOperation(operationId: string) {
    setAiOperations((current) => current.map((operation) => (
      operation.id === operationId ? { ...operation, enabled: !operation.enabled } : operation
    )));
  }

  function openCharacterEvidenceInReader(evidence: CharacterEvidence) {
    if (!selectedBook) return;
    const detail = buildCharacterEvidenceReaderOpenDetail(evidence, {
      bookTitle: getPrivacyBookTitle(selectedBook.displayTitle || selectedBook.title, privacySettings),
    });
    if (!detail) {
      setActionError(t('characters.detailJumpEvidenceUnavailable'));
      return;
    }
    setActionError('');
    onOpenReaderEvidence(detail);
  }

  function openCharacterLocationInReader(location: CharacterLocation, label: string) {
    if (!selectedBook) return;
    const detailProfile = selectedCharacterDetail?.profile;
    const characterName = detailProfile
      ? getPrivacyBookTitle(detailProfile.displayName || detailProfile.canonicalName, privacySettings)
      : getPrivacyBookTitle(label, privacySettings);
    const detail = buildCharacterLocationReaderOpenDetail(location, {
      bookId: selectedBook.id,
      bookTitle: getPrivacyBookTitle(selectedBook.displayTitle || selectedBook.title, privacySettings),
      label,
      snippet: characterName,
      score: detailProfile?.confidence ?? 1,
    });
    if (!detail) {
      setActionError(t('characters.detailJumpEvidenceUnavailable'));
      return;
    }
    setActionError('');
    onOpenReaderEvidence(detail);
  }

  useEffect(() => {
    function onCharacterCenterKeyDown(event: KeyboardEvent) {
      const shortcutKey = event.key.toLocaleLowerCase();
      if (event.key === 'Escape') {
        if (!selectedCharacterId && !selectedRelationDetail) return;
        if (isEditableCharacterCenterShortcutTarget(event.target)) return;
        event.preventDefault();
        setSelectedRelationDetail(null);
        setSelectedCharacterId(null);
        return;
      }
      if (shortcutKey === 'g' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        if (isEditableCharacterCenterShortcutTarget(event.target)) return;
        event.preventDefault();
        selectWorkbenchView('relations');
        return;
      }
      if (shortcutKey === 'e' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        if (isEditableCharacterCenterShortcutTarget(event.target)) return;
        event.preventDefault();
        selectWorkbenchView('evidence');
        return;
      }
      if (shortcutKey === 'r' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        if (event.repeat) return;
        if (isEditableCharacterCenterShortcutTarget(event.target)) return;
        if (!canQueueCharacterRebuild(centerState.primaryAction, selectedIndexView, characterStatus, extractingCharacters)) return;
        event.preventDefault();
        queueCharacterExtraction({ confirmRebuild: true });
        return;
      }
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (isEditableCharacterCenterShortcutTarget(event.target)) return;
      if (!bookSearchInputRef.current) return;
      event.preventDefault();
      bookSearchInputRef.current?.focus();
      bookSearchInputRef.current?.select();
    }
    window.addEventListener('keydown', onCharacterCenterKeyDown);
    return () => window.removeEventListener('keydown', onCharacterCenterKeyDown);
  }, [centerState.primaryAction, characterStatus, extractingCharacters, onQueueCharacterExtraction, selectedBook?.id, selectedCharacterId, selectedIndexView.ready, selectedRelationDetail, t]);

  if (unavailableBookReason === 'missing' || unavailableBookReason === 'deleted') {
    return (
      <section className="page-surface characters-page">
        <article className="characters-empty-state" role="status" aria-live="polite">
          <p className="eyebrow">{t('characters.noBookEyebrow')}</p>
          <h2>{t(unavailableBookReason === 'deleted' ? 'characters.unavailable.deletedTitle' : 'characters.unavailable.missingTitle')}</h2>
          <p>{t(unavailableBookReason === 'deleted' ? 'characters.unavailable.deletedBody' : 'characters.unavailable.missingBody')}</p>
          <div className="action-row">
            <button className="primary-btn" type="button" onClick={onOpenLibrary} aria-label={t('characters.openLibraryAria')}>{t('characters.openLibrary')}</button>
          </div>
        </article>
      </section>
    );
  }

  if (bookSummaries.length === 0) {
    return (
      <section className="page-surface characters-page">
        <article className="characters-empty-state">
          <p className="eyebrow">{t('characters.center.title')}</p>
          <h2>{t('characters.emptyLibraryTitle')}</h2>
          <p>{t('characters.emptyLibraryBody')}</p>
          <div className="action-row">
            <button className="primary-btn" type="button" onClick={onOpenLibrary} aria-label={t('characters.openLibraryAria')}>{t('characters.openLibrary')}</button>
          </div>
        </article>
      </section>
    );
  }

  const characterPortalHost = document.querySelector<HTMLElement>('.app-shell') ?? document.body;

  return (
    <section
      className="page-surface characters-page characters-workbench"
      style={{ '--characters-inspector-width': inspectorCollapsed ? '44px' : `${inspectorWidth}px` } as CharacterInspectorStyle}
    >
      <header className="characters-atlas-toolbar characters-center-header">
        <div className="characters-center-heading">
          <span className="characters-center-mark"><BookMindIcon name="characters" /></span>
          <div><h2>{t('characters.center.title')}</h2><p>{t('characters.center.workspaceSubtitle')}</p></div>
        </div>
        <div className="characters-center-metrics" aria-label={t('characters.metricsAria')}>
          <CharacterCenterHeaderMetric value={centerMetrics.readyBooks} label={t('characters.metric.readyBooks')} />
          <CharacterCenterHeaderMetric value={centerMetrics.characters} label={t('characters.metric.characters')} />
          <CharacterCenterHeaderMetric value={centerMetrics.relations} label={t('characters.metric.relations')} />
          <CharacterCenterHeaderMetric value={centerMetrics.evidence} label={t('characters.metric.evidence')} />
        </div>
      </header>

      <div className="characters-center-shell">
        <aside className="characters-book-pane">
          <div className="characters-book-pane-head"><div><strong>{t('characters.books')}</strong><span>{filteredBooks.length}</span></div><ThemedSelect className="characters-book-status-select" label={t('characters.bookStatusFilter')} ariaLabel={t('characters.bookStatusFilter')} value={bookStatusFilter} options={[
            { value: 'all', label: t('characters.bookStatusFilter.all') },
            { value: 'ready', label: t('characters.bookStatusFilter.ready') },
            { value: 'missing', label: t('characters.bookStatusFilter.missing') },
            { value: 'stale', label: t('characters.bookStatusFilter.stale') },
            { value: 'failed', label: t('characters.bookStatusFilter.failed') },
            { value: 'character-failed', label: t('characters.bookStatusFilter.characterFailed') },
          ]} onChange={setBookStatusFilter} menuPlacement="bottom" /></div>
          <label className="characters-book-search characters-book-pane-search">
            <BookMindIcon name="readerSearch" />
            <input ref={bookSearchInputRef} type="search" value={bookQuery} onChange={(event) => setBookQuery(event.target.value)} placeholder={t('characters.bookSearchPlaceholder')} aria-label={t('characters.bookSearchPlaceholder')} />
          </label>
          <div className="characters-book-strip" aria-label={t('characters.bookPicker')}>
          {filteredBooks.length === 0 ? (
            <div className="characters-book-filter-empty">
              <strong>{t('characters.bookNoMatchesTitle')}</strong>
              <p>{t('characters.bookNoMatchesBody')}</p>
            </div>
          ) : null}
          {filteredBooks.map((book) => {
            const bookDisplayTitle = getPrivacyBookTitle(book.displayTitle || book.title, privacySettings);
            const bookDisplayFileName = getPrivacyFileName(book.fileName, privacySettings);
            const active = selectedBook?.id === book.id;
            return (
              <article
                className={active ? 'characters-book-option active' : 'characters-book-option'}
                onContextMenu={(event) => openBookMenu(event, book)}
                key={book.id}
              >
                <button className="characters-book-option-main" type="button" onClick={() => onSelectBook(book.id)} aria-label={t('characters.selectBookAria', { title: bookDisplayTitle })}>
                  <CharacterBookCover book={book} title={bookDisplayTitle} />
                  <span className="characters-book-option-copy"><strong title={bookDisplayTitle}>{bookDisplayTitle}</strong><em title={bookDisplayFileName}>{book.author || bookDisplayFileName}</em><small>{t('characters.bookKnowledgeSummary', { characters: book.characterCount ?? 0, relations: book.relationCount ?? 0 })}</small></span>
                </button>
                <button className="characters-book-more" type="button" aria-label={t('characters.bookActionsAria', { title: bookDisplayTitle })} title={t('characters.bookActions')} onClick={(event) => openBookMenu(event, book)}><BookMindIcon name="more" /></button>
              </article>
            );
          })}
        </div>
        </aside>

        <section className="characters-workspace-pane">
          <nav className="characters-atlas-tabs" aria-label={t('characters.viewNavigationAria')}>
            {characterWorkbenchViews.map((view) => <button className={selectedWorkbenchView === view.id ? 'characters-atlas-tab active' : 'characters-atlas-tab'} type="button" key={view.id} onClick={() => selectWorkbenchView(view.id)} aria-pressed={selectedWorkbenchView === view.id}><BookMindIcon name={view.icon} /><span>{t(view.labelKey)}</span></button>)}
          </nav>

      <div className={`characters-atlas-body ${graphFullscreen ? 'graph-fullscreen' : ''}`.trim()}>
        <main className="characters-main-pane">
          {!selectedBook ? (
            <article className="characters-empty-state">
              <p className="eyebrow">{t('characters.noBookEyebrow')}</p>
              <h2>{t('characters.noBookTitle')}</h2>
              <p>{t('characters.noBookBody')}</p>
              <div className="action-row">
                <button className="ghost-btn" type="button" onClick={onOpenLibrary} aria-label={t('characters.openLibraryAria')}>{t('characters.openLibrary')}</button>
              </div>
            </article>
          ) : (
            <>
              {renderCharacterMobileViewTabs(
                t,
                Boolean(selectedCharacterDetail),
                selectedWorkbenchView,
                selectWorkbenchView,
                setInspectorCollapsed,
              )}

              {actionError ? <p className="inline-error" role="alert">{actionError}</p> : null}
              {centerState.stateId !== 'character-index-ready' ? <article className={`characters-readiness-card ${centerState.readinessClassName}`} role="status" aria-live="polite">
                <p className="eyebrow">{t('characters.readinessEyebrow')}</p>
                <h3>{t(centerState.readinessTitleKey)}</h3>
                <p>{t(centerState.readinessBodyKey, centerState.readinessBodyParams)}</p>
                {centerState.readinessHintKey ? <p>{t(centerState.readinessHintKey)}</p> : null}
                {centerState.failureDiagnostics ? (
                  <dl className="characters-diagnostics-list" aria-label={t('characters.failureDiagnosticsAria')}>
                    {centerState.failureDiagnostics.lastTaskId ? <><dt>{t('characters.failure.taskId')}</dt><dd>{redactTaskText(centerState.failureDiagnostics.lastTaskId, privacyMode)}</dd></> : null}
                    {centerState.failureDiagnostics.errorCode ? <><dt>{t('characters.failure.errorCode')}</dt><dd>{redactTaskText(centerState.failureDiagnostics.errorCode, privacyMode)}</dd></> : null}
                    {centerState.failureDiagnostics.errorStage ? <><dt>{t('characters.failure.errorStage')}</dt><dd>{redactTaskText(centerState.failureDiagnostics.errorStage, privacyMode)}</dd></> : null}
                    {centerState.failureDiagnostics.recentLogEntry ? <><dt>{t('characters.failure.recentLog')}</dt><dd>{redactTaskText(centerState.failureDiagnostics.recentLogEntry, privacyMode)}</dd></> : null}
                    {centerState.failureDiagnostics.errorCode ? <><dt>{t('characters.failure.advice')}</dt><dd>{t(centerState.failureDiagnostics.errorAdviceKey)}</dd></> : null}
                  </dl>
                ) : null}
              </article> : null}

              <div className={workbenchSwitching ? 'characters-workbench-switching' : 'characters-workbench-ready'}>
                {renderCharacterWorkbenchView(
                  deferredWorkbenchView,
                  selectedBook,
                  selectedCharacterPayload,
                  overviewSnapshot,
                  overviewSnapshotLoading,
                  centerState,
                  selectedCharacterId,
                  selectCharacter,
                  inspectRelationDetail,
                  openCharacterEvidenceInReader,
                  openCharacterLocationInReader,
                  characterGraphSessionState,
                  onCharacterGraphSessionStateChange,
                  graphFullscreen,
                  setGraphFullscreen,
                  privacySettings,
                  t,
                )}
              </div>
            </>
          )}
        </main>
        {selectedBook ? (
          <aside className={inspectorCollapsed ? 'characters-inspector-pane collapsed' : 'characters-inspector-pane'} aria-label={t('characters.inspectorAria')}>
            <div className="characters-inspector-toolbar">
              <button
                className="ghost-btn small"
                type="button"
                onClick={() => setInspectorCollapsed((collapsed) => !collapsed)}
                aria-expanded={!inspectorCollapsed}
                aria-label={t(inspectorCollapsed ? 'characters.inspectorExpand' : 'characters.inspectorCollapse')}
                data-tooltip={t(inspectorCollapsed ? 'characters.inspectorExpand' : 'characters.inspectorCollapse')}
              >
                {inspectorCollapsed ? '>' : '<'}
              </button>
              {!inspectorCollapsed ? (
                <button
                  className="characters-inspector-resize"
                  type="button"
                  role="separator"
                  aria-orientation="vertical"
                  aria-valuemin={280}
                  aria-valuemax={460}
                  aria-valuenow={inspectorWidth}
                  onPointerDown={(event) => beginInspectorResize(event, setInspectorWidth)}
                  onKeyDown={(event) => handleInspectorResizeKeyDown(event, inspectorWidth, setInspectorWidth)}
                  aria-label={t('characters.inspectorResizeAria')}
                  data-tooltip={t('characters.inspectorResizeAria')}
                />
              ) : null}
            </div>
            <div className="characters-inspector-content" hidden={inspectorCollapsed}>
              {renderCharacterInspectorPanel(
                selectedCharacterDetail,
                selectedRelationDetail,
                selectedBook,
                selectedCharacterPayload,
                metrics,
                centerState,
                () => setSelectedRelationDetail(null),
                openCharacterEvidenceInReader,
                openCharacterLocationInReader,
                privacySettings,
                t,
              )}
            </div>
          </aside>
        ) : null}
      </div>
        </section>
      </div>
      {bookMenu && menuBook ? createPortal(
        <CharacterBookMenu
          state={bookMenu}
          book={menuBook}
          privacySettings={privacySettings}
          indexing={indexingBookId === menuBook.id}
          extracting={characterExtractionBookId === menuBook.id}
          aiProcessing={aiProcessing}
          onOpenReader={() => { setBookMenu(null); onOpenBook(menuBook.id); }}
          onOpenTasks={() => { setBookMenu(null); onOpenTasks(); }}
          onRebuildText={() => { setBookMenu(null); void runParseIndexForBook(menuBook.id); }}
          onRebuildCharacters={() => { setBookMenu(null); void queueCharacterExtractionForBook(menuBook.id, { confirmRebuild: true }); }}
          onAiProcess={() => { setBookMenu(null); openCharacterAiPostprocessPanel(); }}
        />,
        characterPortalHost,
      ) : null}
      {aiPanelOpen ? createPortal(<div className="modal-backdrop characters-ai-modal-backdrop" role="presentation"><CharacterAiPostprocessPanel operations={aiOperations} status={aiApplyStatus} processing={aiProcessing} requestDebugText={aiDebugRequest} responseDebugText={aiDebugResponse} batchSize={aiBatchSize} onBatchSizeChange={updateCharacterAiBatchSize} onRun={runCharacterAiPostprocess} onToggleOperation={toggleAiOperation} onConfirm={confirmCharacterAiPostprocess} onCancel={() => { setAiPanelOpen(false); setAiOperations([]); setAiApplyStatus(''); setAiDebugRequest(''); setAiDebugResponse(''); }} /></div>, characterPortalHost) : null}
    </section>
  );
}

function CharacterCenterHeaderMetric({ value, label }: { value: number; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function CharacterBookCover({ book, title, className = 'characters-book-avatar' }: { book: CharacterCenterBookSummary; title: string; className?: string }) {
  if (book.coverImagePath) {
    return <span className={`${className} image-cover`}><img src={toCharacterCoverUrl(book.coverImagePath)} alt="" loading="lazy" draggable={false} /></span>;
  }
  return <span className={`${className} ${book.coverTone}`} aria-hidden="true">{book.coverLabel || title.trim().slice(0, 1).toLocaleUpperCase() || 'B'}</span>;
}

function CharacterBookMenu({
  state,
  book,
  privacySettings,
  indexing,
  extracting,
  aiProcessing,
  onOpenReader,
  onOpenTasks,
  onRebuildText,
  onRebuildCharacters,
  onAiProcess,
}: {
  state: CharacterBookMenuState;
  book: CharacterCenterBookSummary;
  privacySettings: ExtendedSettings;
  indexing: boolean;
  extracting: boolean;
  aiProcessing: boolean;
  onOpenReader: () => void;
  onOpenTasks: () => void;
  onRebuildText: () => void;
  onRebuildCharacters: () => void;
  onAiProcess: () => void;
}) {
  const { t } = useI18n();
  const title = getPrivacyBookTitle(book.displayTitle || book.title, privacySettings);
  const fileName = getPrivacyFileName(book.fileName, privacySettings);
  return (
    <div
      className="characters-book-menu"
      role="menu"
      aria-label={t('characters.bookActionsAria', { title })}
      style={{ left: state.x, top: state.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <header className="characters-book-menu-head">
        <CharacterBookCover book={book} title={title} className="characters-book-menu-cover" />
        <div><span>{t('characters.currentBook')}</span><strong title={title}>{title}</strong><em title={fileName}>{fileName}</em></div>
      </header>
      <div className="characters-book-menu-status" aria-label={t('characters.statusAria')}>
        <span className={`characters-status-pill ${textIndexClassName(book)}`}>{indexStatusLabel(book, t)}</span>
        <span className={`characters-status-pill ${book.characterIndexStatus}`}>{characterStatusLabel(book.characterIndexStatus, t)}</span>
      </div>
      <div className="characters-book-menu-summary">{t('characters.bookKnowledgeSummary', { characters: book.characterCount ?? 0, relations: book.relationCount ?? 0 })}</div>
      <div className="characters-book-menu-separator" />
      <button type="button" role="menuitem" onClick={onOpenReader}><BookMindIcon name="libraryMenuOpen" /><span>{t('characters.openReader')}</span></button>
      <button type="button" role="menuitem" onClick={onOpenTasks}><BookMindIcon name="tasks" /><span>{t('characters.openTasks')}</span></button>
      <div className="characters-book-menu-separator" />
      <button type="button" role="menuitem" onClick={onRebuildText} disabled={indexing}><BookMindIcon name="aiMessageRetry" /><span>{t(indexing ? 'characters.indexing' : 'characters.rebuildTextIndex')}</span></button>
      <button type="button" role="menuitem" onClick={onRebuildCharacters} disabled={!book.textIndexReady || extracting}><BookMindIcon name="characters" /><span>{t(extracting ? 'characters.extracting' : 'characters.rebuildCharacterIndex')}</span></button>
      <button type="button" role="menuitem" onClick={onAiProcess} disabled={book.characterIndexStatus !== 'ready' || aiProcessing}><BookMindIcon name="aiDesk" /><span>{t('characters.aiProcess')}</span></button>
    </div>
  );
}

function toCharacterCoverUrl(path: string) {
  try { return convertFileSrc(path); } catch { return path; }
}

function renderCharacterMobileViewTabs(
  t: ReturnType<typeof useI18n>['t'],
  hasCharacterDetail: boolean,
  selectedWorkbenchView: CharacterWorkbenchView,
  onSelectWorkbenchView: (view: CharacterWorkbenchView) => void,
  setInspectorCollapsed: (collapsed: boolean) => void,
) {
  const visibleTabs = hasCharacterDetail
    ? characterMobileViewTabs
    : characterMobileViewTabs.filter((tab) => tab.href !== '#characters-detail');
  return (
    <nav className="characters-mobile-view-tabs" aria-label={t('characters.mobileViewTabsAria')}>
      {visibleTabs.map((tab) => (
        <a
          href={tab.href}
          key={tab.href}
          aria-current={tab.viewId && selectedWorkbenchView === tab.viewId ? 'page' : undefined}
          onClick={(event) => {
            if (!tab.viewId) {
              if (tab.href === '#characters-detail') setInspectorCollapsed(false);
              return;
            }
            event.preventDefault();
            onSelectWorkbenchView(tab.viewId);
          }}
        >
          {t(tab.labelKey)}
        </a>
      ))}
    </nav>
  );
}

function CharacterAiPostprocessPanel({
  operations,
  status,
  processing,
  requestDebugText,
  responseDebugText,
  batchSize,
  onBatchSizeChange,
  onRun,
  onToggleOperation,
  onConfirm,
  onCancel,
}: {
  operations: CharacterAiPostprocessOperation[];
  status: string;
  processing: boolean;
  requestDebugText: string;
  responseDebugText: string;
  batchSize: string;
  onBatchSizeChange: (value: string) => void;
  onRun: () => void;
  onToggleOperation: (operationId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const genderOperations = operations.filter((operation) => operation.type === 'gender');
  const noiseOperations = operations.filter((operation) => operation.type === 'noise');
  const enabledCount = operations.filter((operation) => operation.enabled).length;
  const [debugView, setDebugView] = useState<'request' | 'response' | null>(null);
  const runLabel = operations.length || responseDebugText || requestDebugText ? '重新AI处理' : '开始AI处理';
  return (
    <div className="characters-ai-panel" role="dialog" aria-label="AI处理人物索引">
      <div className="characters-ai-panel-head">
        <div>
          <p className="eyebrow">AI处理</p>
          <h3>人物索引后处理</h3>
        </div>
        <div className="characters-ai-head-actions">
          <button className="ghost-btn small" type="button" onClick={onRun} disabled={processing}>{processing ? '处理中…' : runLabel}</button>
          <button className="primary-btn small" type="button" onClick={onConfirm} disabled={processing || enabledCount === 0}>确认应用 {enabledCount} 项</button>
          <button className="ghost-btn small" type="button" onClick={onCancel} disabled={processing}>取消</button>
        </div>
      </div>
      <div className="characters-ai-panel-scroll">
        <div className="characters-ai-panel-grid">
          <section>
            <h4>AI男女识别</h4>
            <CharacterAiOperationList operations={genderOperations} onToggleOperation={onToggleOperation} />
          </section>
          <section>
            <h4>AI去除噪音</h4>
            <CharacterAiOperationList operations={noiseOperations} onToggleOperation={onToggleOperation} />
          </section>
        </div>
        <label className="characters-ai-batch-setting">
          <span>每批编号数</span>
          <input
            type="number"
            min={20}
            max={5000}
            step={20}
            value={batchSize}
            disabled={processing}
            onChange={(event) => onBatchSizeChange(event.target.value)}
          />
        </label>
        {status ? <p className="characters-ai-status" role="status">{status}</p> : null}
        <div className="characters-ai-debug-actions">
          <button className="ghost-btn small" type="button" onClick={() => setDebugView(debugView === 'request' ? null : 'request')} disabled={!requestDebugText}>发送内容查看</button>
          <button className="ghost-btn small" type="button" onClick={() => setDebugView(debugView === 'response' ? null : 'response')} disabled={!responseDebugText && !processing}>AI回复查看</button>
        </div>
        {debugView ? (
          <section className="characters-ai-debug-panel" aria-label={debugView === 'request' ? '发送内容查看' : 'AI回复查看'}>
            <div className="characters-ai-debug-head">
              <strong>{debugView === 'request' ? '发送内容查看' : 'AI回复查看'}</strong>
              <button className="ghost-btn small" type="button" onClick={() => setDebugView(null)}>收起</button>
            </div>
            <pre>{debugView === 'request' ? requestDebugText : (responseDebugText || '等待云端回复…')}</pre>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function CharacterAiOperationList({
  operations,
  onToggleOperation,
}: {
  operations: CharacterAiPostprocessOperation[];
  onToggleOperation: (operationId: string) => void;
}) {
  if (!operations.length) return <p className="characters-ai-empty">暂无待确认操作。</p>;
  return (
    <div className="characters-ai-operation-list">
      {operations.map((operation) => (
        <label className={operation.enabled ? 'characters-ai-operation enabled' : 'characters-ai-operation'} key={operation.id}>
          <input type="checkbox" checked={operation.enabled} onChange={() => onToggleOperation(operation.id)} />
          <span>
            <strong>{operation.name}</strong>
            <em>{formatCharacterAiOperation(operation)}</em>
          </span>
        </label>
      ))}
    </div>
  );
}

function formatCharacterAiOperation(operation: CharacterAiPostprocessOperation) {
  if (operation.type === 'noise') return '隐藏为噪音人物';
  return `性别：${formatCharacterGender(operation.from)} -> ${formatCharacterGender(operation.to)}`;
}

function formatCharacterGender(value: CharacterAiPostprocessOperation['from']) {
  if (value === 'male') return '男';
  if (value === 'female') return '女';
  if (value === 'unknown') return '未知';
  return value ? '是' : '否';
}

function normalizeCharacterAiBatchSize(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 400;
  return Math.min(5000, Math.max(20, Math.floor(parsed)));
}

function beginInspectorResize(event: ReactPointerEvent<HTMLButtonElement>, setInspectorWidth: (width: number) => void) {
  event.preventDefault();
  const handle = event.currentTarget;
  handle.setPointerCapture(event.pointerId);
  const pointerId = event.pointerId;
  const startX = event.clientX;
  const root = handle.closest<HTMLElement>('.characters-workbench');
  const currentWidth = root
    ? Number.parseFloat(getComputedStyle(root).getPropertyValue('--characters-inspector-width')) || 320
    : 320;

  function onPointerMove(pointerEvent: PointerEvent) {
    setInspectorWidth(clampCharacterInspectorWidth(currentWidth - (pointerEvent.clientX - startX)));
  }

  function cleanup() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', cleanup);
    window.removeEventListener('pointercancel', cleanup);
    handle.removeEventListener('lostpointercapture', cleanup);
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
  }

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', cleanup, { once: true });
  window.addEventListener('pointercancel', cleanup, { once: true });
  handle.addEventListener('lostpointercapture', cleanup, { once: true });
}

function handleInspectorResizeKeyDown(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  inspectorWidth: number,
  setInspectorWidth: (width: number) => void,
) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const direction = event.key === 'ArrowLeft' ? 1 : -1;
  setInspectorWidth(clampCharacterInspectorWidth(inspectorWidth + direction * 20));
}

function clampCharacterInspectorWidth(width: number) {
  return Math.min(460, Math.max(280, Math.round(width)));
}

function markCharacterPerformance(name: string) {
  if (import.meta.env.PROD || typeof performance === 'undefined') return;
  performance.mark(`bookmind:characters:${name}`);
}

function renderCharacterWorkbenchView(
  selectedWorkbenchView: CharacterWorkbenchView,
  selectedBook: CharacterCenterBookSummary | null,
  selectedCharacterPayload: CharacterCenterPayload | null,
  overviewSnapshot: CharacterOverviewSnapshot | null,
  overviewSnapshotLoading: boolean,
  centerState: CharacterCenterState,
  selectedCharacterId: string | null,
  setSelectedCharacterId: (characterId: string) => void,
  inspectRelationDetail: (detail: CharacterGraphEdgeDetail | null) => void,
  openCharacterEvidenceInReader: (evidence: CharacterEvidence) => void,
  openCharacterLocationInReader: (location: CharacterLocation, label: string) => void,
  characterGraphSessionState: CharacterGraphSessionState,
  onCharacterGraphSessionStateChange: (patch: CharacterGraphSessionStatePatch) => void,
  graphFullscreen: boolean,
  onGraphFullscreenChange: (fullscreen: boolean) => void,
  privacySettings: ExtendedSettings,
  t: ReturnType<typeof useI18n>['t'],
) {
  switch (selectedWorkbenchView) {
    case 'overview':
      return renderCharacterOverviewWorkbench(selectedBook, overviewSnapshot, overviewSnapshotLoading, centerState, privacySettings, t);
    case 'profiles':
      return selectedCharacterPayload
        ? renderCharacterProfiles(selectedCharacterPayload, selectedCharacterId, setSelectedCharacterId, privacySettings, t)
        : renderCharacterPayloadPlaceholder(t);
    case 'relations':
      return (
        <CharacterRelationGraphView
          characterPayload={selectedCharacterPayload}
          centerState={centerState}
          selectedCharacterId={selectedCharacterId}
          onSelectCharacter={setSelectedCharacterId}
          onInspectRelationDetail={inspectRelationDetail}
          onOpenEvidence={openCharacterEvidenceInReader}
          graphSessionState={characterGraphSessionState}
          onGraphSessionStateChange={onCharacterGraphSessionStateChange}
          fullscreen={graphFullscreen}
          onFullscreenChange={onGraphFullscreenChange}
          privacySettings={privacySettings}
          t={t}
          formatLocation={(location) => formatCharacterLocation(location, t)}
          formatRelationMeta={(relation) => formatCharacterRelationMeta(relation, t)}
        />
      );
    case 'heatmap':
      return selectedCharacterPayload
        ? renderCharacterAppearanceHeatmap(selectedCharacterPayload, openCharacterLocationInReader, privacySettings, t)
        : renderCharacterPayloadPlaceholder(t);
    case 'timeline':
      return renderCharacterStubWorkbenchView('characters.timelineViewEyebrow', 'characters.timelineViewTitle', 'characters.timelineViewBody', t);
    case 'factions':
      return renderCharacterStubWorkbenchView('characters.factionsViewEyebrow', 'characters.factionsViewTitle', 'characters.factionsViewBody', t);
    case 'evidence':
      return selectedCharacterPayload
        ? renderCharacterEvidenceTable(selectedCharacterPayload, openCharacterEvidenceInReader, privacySettings, t)
        : renderCharacterPayloadPlaceholder(t);
    case 'review':
      return renderCharacterStubWorkbenchView('characters.reviewViewEyebrow', 'characters.reviewViewTitle', 'characters.reviewViewBody', t);
    case 'export':
      return renderCharacterStubWorkbenchView('characters.exportViewEyebrow', 'characters.exportViewTitle', 'characters.exportViewBody', t);
    default:
      return null;
  }
}

function renderCharacterOverviewWorkbench(
  selectedBook: CharacterCenterBookSummary | null,
  overviewSnapshot: CharacterOverviewSnapshot | null,
  overviewSnapshotLoading: boolean,
  centerState: CharacterCenterState,
  privacySettings: ExtendedSettings,
  t: ReturnType<typeof useI18n>['t'],
) {
  if (!selectedBook) return renderCharacterPayloadPlaceholder(t);
  const stats = overviewSnapshot?.stats ?? [
    { id: 'characters' as const, value: String(selectedBook.characterCount ?? 0) },
    { id: 'relations' as const, value: String(selectedBook.relationCount ?? 0) },
    { id: 'evidence' as const, value: String(selectedBook.evidenceCount ?? 0) },
    { id: 'chapter-coverage' as const, value: '-' },
    { id: 'review' as const, value: '-' },
  ];
  const mainProfiles = overviewSnapshot?.mainProfiles ?? [];
  const recentAppearances = overviewSnapshot?.recentAppearances ?? [];
  const overviewSectionFallbackKey = getCharacterOverviewSectionFallbackKey({
    hasOverviewSnapshot: Boolean(overviewSnapshot),
    overviewSnapshotLoading,
    centerStateId: centerState.stateId,
  });
  return (
    <article className="characters-placeholder-board" id="characters-overview-panel" aria-label={t('characters.overviewWorkbenchAria')}>
      <div>
        <p className="eyebrow">{t('characters.overviewWorkbenchEyebrow')}</p>
        <h3>{t('characters.overviewWorkbenchTitle')}</h3>
        <p>{t('characters.overviewWorkbenchBody')}</p>
      </div>
      <div className="characters-metric-grid characters-overview-stat-grid" aria-label={t('characters.overviewStatsAria')}>
        {stats.map((stat) => (
          <article className="characters-metric-card" key={stat.id}>
            <span>{t(characterOverviewStatLabelKey(stat.id))}</span>
            <strong>{stat.value}</strong>
            <p>{t(characterOverviewStatHintKey(stat.id), {
              covered: overviewSnapshot?.coveredChapterCount ?? 0,
              total: overviewSnapshot?.totalChapterCount ?? 0,
              count: overviewSnapshot?.reviewIssueCount ?? 0,
            })}</p>
          </article>
        ))}
      </div>
      <div className="characters-next-list" style={{ display: 'grid', gap: '10px', paddingLeft: 0, listStyle: 'none' }}>
        <section>
          <strong>{t('characters.overviewMainProfiles')}</strong>
          {overviewSectionFallbackKey ? <p>{t(overviewSectionFallbackKey)}</p> : null}
          {overviewSnapshot && mainProfiles.length === 0 ? <p>{t('characters.detailNone')}</p> : null}
          {mainProfiles.length > 0 ? (
            <ul>
              {mainProfiles.map((profile) => (
                <li key={profile.id}>
                  {profile.rankLabel} · {getPrivacyBookTitle(profile.name, privacySettings)} · {t('characters.profileMentionCount', { count: profile.mentionCount })}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <section>
          <strong>{t('characters.overviewRecentAppearances')}</strong>
          {overviewSectionFallbackKey ? <p>{t(overviewSectionFallbackKey)}</p> : null}
          {overviewSnapshot && recentAppearances.length === 0 ? <p>{t('characters.detailNone')}</p> : null}
          {recentAppearances.length > 0 ? (
            <ul>
              {recentAppearances.map((appearance) => (
                <li key={appearance.id}>
                  {getPrivacyBookTitle(appearance.name, privacySettings)} · {appearance.chapterTitle || formatCharacterLocation(appearance.location, t)} · {t('characters.profileMentionCount', { count: appearance.mentionCount })}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <section>
          <strong>{t('characters.overviewStateSummary')}</strong>
          <p>{t(centerState.readinessTitleKey)}</p>
          <p>{t('characters.overviewReviewSummary', { count: overviewSnapshot?.reviewIssueCount ?? 0 })}</p>
        </section>
      </div>
    </article>
  );
}

function renderCharacterPayloadPlaceholder(t: ReturnType<typeof useI18n>['t']) {
  return (
    <article className="characters-placeholder-board">
      <div>
        <p className="eyebrow">{t('characters.nextStageEyebrow')}</p>
        <h3>{t('characters.nextStageTitle')}</h3>
        <p>{t('characters.nextStageBody')}</p>
      </div>
      <ul className="characters-next-list">
        <li>{t('characters.nextProfiles')}</li>
        <li>{t('characters.nextRelations')}</li>
        <li>{t('characters.nextEvidence')}</li>
      </ul>
    </article>
  );
}
