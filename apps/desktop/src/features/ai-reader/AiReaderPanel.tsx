import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { BookMindIcon, type BookMindIconName } from '../../components/BookMindIcon';
import { ThemedSelect } from '../../components/ThemedSelect';
import { useI18n, type Translator } from '../../i18n';
import { parseAiResponseProtocol, type AiProtocolCitation, type AiResponseBlock, type BookMindAiStructuredResponse } from '../../services/aiResponseProtocol';
import { getReaderRecord, parseReaderRecord, saveReaderRecord } from '../../services/readerStorageService';
import { loadAiCustomSlashCommands, saveAiCustomSlashCommands, type AiCustomSlashCommandDraft } from '../../services/settingsCenterService';
import { redactCloudText as redactSensitiveCloudText } from '../../services/cloudAiPrivacy';
import { requestCloudAiAnswer } from '../../services/aiService';
import { AiConversationMessageList } from './AiConversationMessageList';
import { AiReaderComposerInput } from './AiReaderComposerInput';
import { AiReaderPanelToolbar } from './AiReaderPanelToolbar';
import { protocolCitationToKnowledgeCitation } from './AiStructuredAnswerView';
import { subscribeCurrentBookDataCleared } from '../reader-core/currentBookDataEvents';
import { getAiProviderModelConfig, normalizeAiReasoningEffortForUi } from '../settings-center/settingsCenterAiProviderModel';
import type { ReaderChapter } from '../reader-core/readerModel';
import { getAgentToolCatalog, getDefaultAgentEnabledTools, getDefaultAgentPresetPrompt, normalizeAgentEnabledTools } from '../../app/agentToolModel';
import { aiInteractionModeOptions, buildAgentModeInstruction, buildAgentScopePanelItems, parseAgentEnabledToolsPreference, parseAgentPresetPromptPreference, parseAiInteractionModePreference, resolveAiTransportModeForInteraction, resolveConfiguredAiInteractionMode, resolveScopeTextForInteraction, shouldShowAiScopeSelect, shouldShowCitationWarningsForInteraction, type AiInteractionMode } from './aiReaderModeModel';
import {
  applyConversationContextCompression,
  restoreConversationContextCompression,
  type AiConversation,
} from './aiConversationHistory';
import { useAiConversationState } from './useAiConversationState';
import { useAiRequestLifecycle } from './useAiRequestLifecycle';
import type { AiAskRequest, AiDiagnostics, AiProviderModelSettings, AiReasoningEffort, AppSettings, Book, Citation, ReaderBookmark, ReaderHighlight } from '../../types';

type AiReaderPanelProps = {
  book: Book | null;
  readerContext?: {
    bookId?: string;
    chapterTitle?: string;
    chapterText?: string;
    pageText?: string;
    selectionText?: string;
    paragraphIndex?: number;
    demo?: boolean;
  };
  defaultAiMode: 'local' | 'cloud' | 'mock';
  localAiEnabled: boolean;
  fallbackEnabled: boolean;
  defaultAiScope: 'selection' | 'page-lite' | 'page' | 'chapter' | 'volume' | 'book' | 'annotations' | 'library';
  noSelectionFallbackScope: 'page' | 'chapter' | 'book';
  commandDefaultScopes: Record<'summary' | 'characters' | 'foreshadow' | 'timeline' | 'cards', AiReaderPanelProps['defaultAiScope']>;
  scopePriorityStrategy: 'command-first' | 'panel-first' | 'narrowest-first';
  scopeTokenPolicy: { autoDowngrade: boolean; maxTokens: string };
  slashCommandsEnabled: boolean;
  builtInSlashCommandEnabled: Record<'summary' | 'characters' | 'foreshadow' | 'timeline' | 'cards', boolean>;
  outputDefaults: { defaultFormat: 'structured' | 'markdown'; requireCitations: boolean; noCitationWarningEnabled: boolean; citationCoverageVisible: boolean; citationCardDefaultDensity: 'compact' | 'detailed'; externalCitationsDisabled: boolean; citationJumpRepairEnabled: boolean; citationFieldStrictness: 'lenient' | 'normal' | 'strict'; toolCallDisplayMode: 'hidden' | 'summary' | 'full' };
  retrievalDefaults: { defaultStrategy: AiCommandRetrievalStrategy; queryRewriteMode: 'off' | 'basic'; multiStageMode: 'off' | 'auto'; commandStrategies: Record<'summary' | 'characters' | 'foreshadow' | 'timeline' | 'cards', AiCommandRetrievalStrategy>; localResultLimit: string; citationMinConfidence: string };
  slashCommandLimits: { customLimit: string; recentLimit: string };
  cloudPrivacySettings: { enabled: boolean; requireConfirmation: boolean; autoRedact: boolean; sensitiveWords: string; allowSelectionText: boolean; allowCurrentPageText: boolean; allowCurrentChapterText: boolean; allowBookSummaryContext: boolean };
  renderedBlockLimit?: string;
  copyDiagnosticsAutoRedact?: boolean;
  flashcardDefaults?: { tags: string; reviewStatus: 'new' | 'due' | 'reviewed' };
  citationDefaultSaveTarget?: 'highlight' | 'excerpt' | 'both';
  citations: Citation[];
  diagnostics?: AiDiagnostics;
  status: 'idle' | 'loading' | 'streaming' | 'ready' | 'no-index' | 'no-result' | 'error';
  saveStatus: string;
  appSettings?: AppSettings | null;
  availableBooks?: Book[];
  readerChapters?: ReaderChapter[];
  readerHighlights?: ReaderHighlight[];
  readerBookmarks?: ReaderBookmark[];
  externalPromptRequest?: AiExternalPromptRequest | null;
  onExternalPromptConsumed?: (requestId: number) => void;
  onSelectAiModel?: (providerId: string, model: string) => Promise<void> | void;
  onToggleAiModelFavorite?: (providerId: string, model: string) => Promise<void> | void;
  onAsk: (request: AiPanelAskRequest) => void;
  onStop: () => void;
  onRetry: (request: AiPanelAskRequest) => void;
  onSaveNote: () => Promise<void>;
  onSaveHighlight: (citation: Citation) => Promise<void>;
  onSaveExcerpt: (citation: Citation) => Promise<void>;
  onJumpCitation: (citation: Citation) => void;
  onToggleCollapsed: () => void;
  onOpenSettings: (target?: 'ai-api') => void;
  onOpenTasks: () => void;
  answer: string;
};

export type AiExternalPromptRequest = {
  id: number;
  prompt: string;
  scope: AiReaderPanelProps['defaultAiScope'];
  selectionText?: string;
};

type AiCommandRetrievalStrategy = 'scope-first' | 'entity-extraction' | 'anomaly-extraction' | 'timeline-extraction' | 'key-sentences';
type BuiltInSlashCommandId = keyof AiReaderPanelProps['builtInSlashCommandEnabled'];

type SlashCommand = {
  id: BuiltInSlashCommandId | `custom-${string}`;
  label: string;
  prompt: string;
  aliases: string[];
  scopeHint: AiReaderPanelProps['defaultAiScope'];
  outputHint: string;
  retrievalStrategy: AiCommandRetrievalStrategy;
};

type AiPanelAskRequest = AiAskRequest;
type AiResolvedScope = { scope: string; text?: string; label: string };
type AiBottomPopoverId = 'attachment' | 'scope' | 'mode' | 'evidence' | 'model';
type AiAttachmentOptionId = 'chapter' | 'page' | 'book' | 'summary' | 'highlight' | 'bookmark' | 'library';
type AiAttachmentPreviewMaterial = { text: string; totalChars: number; truncated: boolean };
type ReaderAiModelGroup = {
  providerId: string;
  providerName: string;
  models: { id: string; label: string; settings: AiProviderModelSettings }[];
};

const defaultCommandDefaultScopes: AiReaderPanelProps['commandDefaultScopes'] = {
  summary: 'chapter',
  characters: 'book',
  foreshadow: 'book',
  timeline: 'book',
  cards: 'selection',
};
const defaultRetrievalDefaults: AiReaderPanelProps['retrievalDefaults'] = {
  defaultStrategy: 'scope-first',
  queryRewriteMode: 'basic',
  multiStageMode: 'off',
  commandStrategies: {
    summary: 'scope-first',
    characters: 'entity-extraction',
    foreshadow: 'anomaly-extraction',
    timeline: 'timeline-extraction',
    cards: 'key-sentences',
  },
  localResultLimit: '20',
  citationMinConfidence: '0.25',
};
const defaultOutputDefaults: AiReaderPanelProps['outputDefaults'] = {
  defaultFormat: 'structured',
  requireCitations: true,
  noCitationWarningEnabled: true,
  citationCoverageVisible: true,
  citationCardDefaultDensity: 'detailed',
  externalCitationsDisabled: true,
  citationJumpRepairEnabled: true,
  citationFieldStrictness: 'normal',
  toolCallDisplayMode: 'summary',
};
const defaultScopeTokenPolicy: AiReaderPanelProps['scopeTokenPolicy'] = {
  autoDowngrade: true,
  maxTokens: '4000',
};
const defaultCloudPrivacySettings: AiReaderPanelProps['cloudPrivacySettings'] = {
  enabled: true,
  requireConfirmation: true,
  autoRedact: true,
  sensitiveWords: '',
  allowSelectionText: true,
  allowCurrentPageText: true,
  allowCurrentChapterText: true,
  allowBookSummaryContext: true,
};
const defaultFlashcardDefaults: NonNullable<AiReaderPanelProps['flashcardDefaults']> = {
  tags: '',
  reviewStatus: 'new',
};
const defaultSlashCommandLimits: AiReaderPanelProps['slashCommandLimits'] = {
  customLimit: '8',
  recentLimit: '4',
};
const defaultBuiltInSlashCommandEnabled: AiReaderPanelProps['builtInSlashCommandEnabled'] = {
  summary: true,
  characters: true,
  foreshadow: true,
  timeline: true,
  cards: true,
};
const COMPOSER_LINE_HEIGHT = 24;
const COMPOSER_VERTICAL_PADDING = 20;
const COMPOSER_ATTACHMENT_HEIGHT = 36;
const COMPOSER_MIN_LINES = 2;
const COMPOSER_MAX_LINES = 6;
const COMPOSER_MIN_HEIGHT = COMPOSER_LINE_HEIGHT * COMPOSER_MIN_LINES + COMPOSER_VERTICAL_PADDING;
const COMPOSER_MAX_HEIGHT = COMPOSER_LINE_HEIGHT * COMPOSER_MAX_LINES + COMPOSER_VERTICAL_PADDING;
const ATTACHMENT_PREVIEW_CHAR_LIMIT = 12000;
const AGENT_CONTEXT_COMPRESSION_RESERVE_TOKENS = 16000;
const AI_REASONING_EFFORT_PRESETS: AiReasoningEffort[] = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
type ComposerStyle = CSSProperties & { '--composer-input-height': string };

export function AiReaderPanel({ book, readerContext, defaultAiMode, localAiEnabled, fallbackEnabled, defaultAiScope, noSelectionFallbackScope, commandDefaultScopes = defaultCommandDefaultScopes, scopePriorityStrategy = 'command-first', scopeTokenPolicy = defaultScopeTokenPolicy, slashCommandsEnabled = true, builtInSlashCommandEnabled = defaultBuiltInSlashCommandEnabled, outputDefaults = defaultOutputDefaults, retrievalDefaults = defaultRetrievalDefaults, slashCommandLimits = defaultSlashCommandLimits, cloudPrivacySettings = defaultCloudPrivacySettings, renderedBlockLimit, copyDiagnosticsAutoRedact = true, flashcardDefaults = defaultFlashcardDefaults, citationDefaultSaveTarget = 'excerpt', citations, diagnostics, status, saveStatus, appSettings = null, availableBooks = [], readerChapters = [], readerHighlights = [], readerBookmarks = [], externalPromptRequest = null, onExternalPromptConsumed, onSelectAiModel, onToggleAiModelFavorite, onAsk, onStop, onRetry, onSaveNote, onSaveHighlight, onSaveExcerpt, onJumpCitation, onToggleCollapsed, onOpenSettings, onOpenTasks, answer }: AiReaderPanelProps) {
  const { t } = useI18n();
  const configuredReasoningEffort = resolveReaderAiReasoningEffort(appSettings);
  const [question, setQuestion] = useState('');
  const [pendingExternalPromptRequest, setPendingExternalPromptRequest] = useState<AiExternalPromptRequest | null>(null);
  const [scope, setScope] = useState(() => defaultAiScope);
  const [interactionMode, setInteractionMode] = useState<AiInteractionMode>(() => resolveConfiguredAiInteractionMode(defaultAiMode));
  const [agentContextCompressionThreshold, setAgentContextCompressionThreshold] = useState(() => resolveDefaultAgentContextCompressionThreshold(resolveCurrentAiModelContextWindow(appSettings, appSettings?.aiModel?.trim() || 'gpt-4.1-mini')));
  const [agentCompressionStatus, setAgentCompressionStatus] = useState('');
  const [agentContextCompressing, setAgentContextCompressing] = useState(false);
  const customSlashCommandLimit = parseSlashCommandLimit(slashCommandLimits.customLimit, 8, 0, 50);
  const recentSlashCommandLimit = parseSlashCommandLimit(slashCommandLimits.recentLimit, 4, 0, 20);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [selectedSlashCommand, setSelectedSlashCommand] = useState<SlashCommand | null>(null);
  const [slashDetailCommand, setSlashDetailCommand] = useState<SlashCommand | null>(null);
  const [recentSlashCommandIds, setRecentSlashCommandIds] = useState<SlashCommand['id'][]>([]);
  const [customSlashCommands, setCustomSlashCommands] = useState<SlashCommand[]>(() => loadAiCustomSlashCommands(customSlashCommandLimit));
  const [activeSlashIndex, setActiveSlashIndex] = useState(0);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [scopePopoverOpen, setScopePopoverOpen] = useState(false);
  const [agentEnabledTools, setAgentEnabledTools] = useState<string[]>(() => getDefaultAgentEnabledTools());
  const defaultAgentPresetPrompt = useMemo(() => getDefaultAgentPresetPrompt(), []);
  const [agentPresetPrompt, setAgentPresetPrompt] = useState(() => defaultAgentPresetPrompt);
  const [attachmentPopoverOpen, setAttachmentPopoverOpen] = useState(false);
  const [attachmentPreviewId, setAttachmentPreviewId] = useState<AiAttachmentOptionId | null>(null);
  const [agentCompressionPreviewOpen, setAgentCompressionPreviewOpen] = useState(false);
  const [modePopoverOpen, setModePopoverOpen] = useState(false);
  const [evidencePopoverOpen, setEvidencePopoverOpen] = useState(false);
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
  const [modelQuery, setModelQuery] = useState('');
  const [modelFavoriteOnly, setModelFavoriteOnly] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState(() => configuredReasoningEffort);
  const [expandedProviderIds, setExpandedProviderIds] = useState<Set<string>>(() => new Set());
  const [apiSettingsOpen, setApiSettingsOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [questionTimelineOpen, setQuestionTimelineOpen] = useState(false);
  const [highlightedTimelineMessageId, setHighlightedTimelineMessageId] = useState<string | null>(null);
  const [composerInputHeight, setComposerInputHeight] = useState(COMPOSER_MIN_HEIGHT);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const aiAnswerStreamRef = useRef<HTMLDivElement | null>(null);
  const questionTimelineRef = useRef<HTMLElement | null>(null);
  const shouldAutoScrollAnswerRef = useRef(true);
  const canAsk = Boolean(book) || readerContext?.demo;
  const isGenerating = status === 'loading' || status === 'streaming';
  const currentConsentBookId = book?.id ?? readerContext?.bookId ?? '';
  const activeReasoningEffort = normalizeAiReasoningEffortForUi(reasoningEffort);
  const reasoningEffortOptions = useMemo(() => {
    const values = AI_REASONING_EFFORT_PRESETS.includes(activeReasoningEffort)
      ? AI_REASONING_EFFORT_PRESETS
      : [...AI_REASONING_EFFORT_PRESETS, activeReasoningEffort];
    return values.map((value) => ({ value, label: value }));
  }, [activeReasoningEffort]);
  const aiTransportMode = resolveAiTransportModeForInteraction(interactionMode, cloudPrivacySettings.enabled);
  const hasCloudConsent = true;
  useEffect(() => {
    setReasoningEffort(configuredReasoningEffort);
  }, [configuredReasoningEffort]);
  const scopeSelectVisible = shouldShowAiScopeSelect(interactionMode);
  const structuredAnswer = useMemo(() => answer.trim() ? parseAiResponseProtocol(answer) : null, [answer]);
  const filteredStructuredAnswer = useMemo(() => structuredAnswer ? filterStructuredAnswerCitations(structuredAnswer, retrievalDefaults.citationMinConfidence) : null, [structuredAnswer, retrievalDefaults.citationMinConfidence]);
  const citationCoverage = useMemo(() => {
    const structuredCoverage = filteredStructuredAnswer ? collectStructuredClaimCoverage(filteredStructuredAnswer.blocks) : null;
    const fallbackParagraphs = answer.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
    const totalClaims = Math.max(1, structuredCoverage?.totalClaims ?? fallbackParagraphs.length);
    const supportedClaims = structuredCoverage?.supportedClaims ?? Math.min(totalClaims, citations.length);
    const percent = answer.trim() ? Math.round((supportedClaims / totalClaims) * 100) : 0;
    const level = percent >= 80 ? 'high' : percent > 0 ? 'partial' : 'none';
    return { totalClaims, supportedClaims, percent, level };
  }, [answer, citations.length, filteredStructuredAnswer]);
  const shouldRenderStructuredAnswer = outputDefaults.defaultFormat === 'structured' && filteredStructuredAnswer ? filteredStructuredAnswer : null;
  const citationWarningsEnabledForMode = shouldShowCitationWarningsForInteraction(interactionMode);
  const shouldShowNoCitationWarning = citationWarningsEnabledForMode && outputDefaults.noCitationWarningEnabled && answer.trim() && !isGenerating && citations.length === 0 ? true : false;
  const shouldShowRequiredCitationWarning = citationWarningsEnabledForMode && outputDefaults.requireCitations && answer.trim() && !isGenerating && citationCoverage.level !== 'high' ? true : false;
  const shouldShowCitationCoverage = outputDefaults.citationCoverageVisible;
  const safeRenderedBlockLimit = parseRenderedBlockLimit(renderedBlockLimit);
  const emptyCitationMessage = status === 'idle'
    ? t('ai.emptyCitations.idle')
    : status === 'loading' || status === 'streaming'
      ? t('ai.emptyCitations.loading')
      : status === 'no-index'
        ? t('ai.emptyCitations.noIndex')
        : status === 'no-result'
          ? t('ai.emptyCitations.noResult')
          : status === 'error'
            ? t('ai.emptyCitations.error')
            : t('ai.emptyCitations');
  const builtInSlashCommands: SlashCommand[] = [
    { id: 'summary', label: t('ai.template.summary'), prompt: t('ai.command.summary.prompt'), aliases: ['zj', 'zongjie', 'summary', 'chapter'], scopeHint: commandDefaultScopes.summary, outputHint: 'chapter_summary + citations', retrievalStrategy: retrievalDefaults.commandStrategies.summary },
    { id: 'characters', label: t('ai.template.characters'), prompt: t('ai.command.characters.prompt'), aliases: ['rw', 'rwgx', 'renwu', 'characters'], scopeHint: commandDefaultScopes.characters, outputHint: 'character_relationships', retrievalStrategy: retrievalDefaults.commandStrategies.characters },
    { id: 'foreshadow', label: t('ai.template.foreshadow'), prompt: t('ai.command.foreshadow.prompt'), aliases: ['fb', 'fubi', 'foreshadow'], scopeHint: commandDefaultScopes.foreshadow, outputHint: 'foreshadowing', retrievalStrategy: retrievalDefaults.commandStrategies.foreshadow },
    { id: 'timeline', label: t('ai.template.timeline'), prompt: t('ai.command.timeline.prompt'), aliases: ['sjj', 'timeline', 'time'], scopeHint: commandDefaultScopes.timeline, outputHint: 'timeline', retrievalStrategy: retrievalDefaults.commandStrategies.timeline },
    { id: 'cards', label: t('ai.template.cards'), prompt: t('ai.command.cards.prompt'), aliases: ['kp', 'card', 'cards', 'flashcard'], scopeHint: commandDefaultScopes.cards, outputHint: 'flashcards', retrievalStrategy: retrievalDefaults.commandStrategies.cards },
  ];
  const scopeOptions = useMemo(() => [
    { value: 'selection', label: t('ai.scope.selection') },
    { value: 'page-lite', label: t('ai.scope.pageLite') },
    { value: 'page', label: t('ai.scope.page') },
    { value: 'chapter', label: t('ai.scope.chapter') },
    { value: 'volume', label: t('ai.scope.volume') },
    { value: 'book', label: t('ai.scope.book') },
    { value: 'annotations', label: t('ai.scope.annotations') },
    { value: 'library', label: t('ai.scope.library') },
  ], [t]);
  const attachmentOptions = useMemo(() => {
    const createOption = (id: AiAttachmentOptionId, label: string) => ({
      id,
      label,
      tokenLabel: formatAttachmentTokenLabel(resolveAttachmentTokenEstimate(id, {
        book,
        readerContext,
        citations,
        availableBooks,
        readerChapters,
        readerHighlights,
        readerBookmarks,
        summaryPrompt: builtInSlashCommands.find((command) => command.id === 'summary')?.prompt ?? '',
      }), t),
    });
    return [
      createOption('chapter', t('ai.attachment.chapter')),
      createOption('page', t('ai.attachment.page')),
      createOption('book', t('ai.attachment.book')),
      createOption('summary', t('ai.attachment.summary')),
      createOption('highlight', t('ai.attachment.highlight')),
      createOption('bookmark', t('ai.attachment.bookmark')),
      createOption('library', t('ai.attachment.library')),
    ];
  }, [availableBooks, book, citations, readerBookmarks, readerChapters, readerContext, readerHighlights, t]);
  const attachmentPreviewOption = useMemo(() => attachmentOptions.find((option) => option.id === attachmentPreviewId) ?? null, [attachmentOptions, attachmentPreviewId]);
  const attachmentPreviewMaterial = useMemo(() => attachmentPreviewId ? buildAttachmentPreviewMaterial(attachmentPreviewId, {
    book,
    readerContext,
    citations,
    availableBooks,
    readerChapters,
    readerHighlights,
    readerBookmarks,
    summaryPrompt: builtInSlashCommands.find((command) => command.id === 'summary')?.prompt ?? '',
    emptyText: t('ai.attachment.previewEmpty'),
  }) : null, [attachmentPreviewId, availableBooks, book, citations, readerBookmarks, readerChapters, readerContext, readerHighlights, t]);
  const enabledBuiltInSlashCommands = builtInSlashCommands.filter((command) => isSlashCommandEnabled(command, builtInSlashCommandEnabled));
  const slashCommands = useMemo(() => slashCommandsEnabled ? [...customSlashCommands, ...enabledBuiltInSlashCommands] : [], [slashCommandsEnabled, customSlashCommands, builtInSlashCommandEnabled.summary, builtInSlashCommandEnabled.characters, builtInSlashCommandEnabled.foreshadow, builtInSlashCommandEnabled.timeline, builtInSlashCommandEnabled.cards, commandDefaultScopes.summary, commandDefaultScopes.characters, commandDefaultScopes.foreshadow, commandDefaultScopes.timeline, commandDefaultScopes.cards, retrievalDefaults.commandStrategies.summary, retrievalDefaults.commandStrategies.characters, retrievalDefaults.commandStrategies.foreshadow, retrievalDefaults.commandStrategies.timeline, retrievalDefaults.commandStrategies.cards, t]);
  const slashQuery = !selectedSlashCommand && question.startsWith('/') ? question.slice(1).trim().toLocaleLowerCase() : '';
  const slashCommandRank = (command: SlashCommand) => {
    const recentIndex = recentSlashCommandIds.indexOf(command.id);
    return recentIndex >= 0 ? recentIndex : 100 + slashCommands.findIndex((item) => item.id === command.id);
  };
  const filteredSlashCommands = slashCommands.filter((command) => matchSlashCommand(command, slashQuery)).sort((left, right) => slashCommandRank(left) - slashCommandRank(right));
  const activeSlashCommand = filteredSlashCommands[Math.min(activeSlashIndex, Math.max(0, filteredSlashCommands.length - 1))];
  const promptModifiers = useMemo(() => parsePromptModifiers(question), [question]);
  const currentAiModel = appSettings?.aiModel?.trim() || 'gpt-4.1-mini';
  const agentToolCatalog = useMemo(() => getAgentToolCatalog(), []);
  const enabledAgentToolNames = useMemo(() => normalizeAgentEnabledTools(agentEnabledTools), [agentEnabledTools]);
  const capabilityPanelTitle = useMemo(() => createReaderCapabilityPanelTitle(interactionMode, t), [interactionMode, t]);
  const aiModelGroups = useMemo(() => buildReaderAiModelGroups(appSettings), [appSettings]);
  const filteredAiModelGroups = useMemo(() => filterReaderAiModelGroups(aiModelGroups, modelQuery, modelFavoriteOnly), [aiModelGroups, modelQuery, modelFavoriteOnly]);
  const currentAiModelConfig = useMemo(() => resolveCurrentAiModelConfig(appSettings, currentAiModel), [appSettings, currentAiModel]);
  const currentAiModelContextWindow = useMemo(() => resolveCurrentAiModelContextWindow(appSettings, currentAiModel), [appSettings, currentAiModel]);
  const defaultAgentContextCompressionThreshold = useMemo(() => resolveDefaultAgentContextCompressionThreshold(currentAiModelContextWindow), [currentAiModelContextWindow]);
  const aiConversationBookId = book?.id ?? readerContext?.bookId ?? (readerContext?.demo ? 'demo-ai-research-desk' : '');
  const {
    activeConversation,
    conversationHistory,
    conversationHistoryReady,
    updateConversationHistory,
    resetConversationHistory,
    createNewConversation: startNewConversation,
    selectConversation,
    updateConversationTitle,
    removeConversation,
    removeConversationMessage,
    updateConversationPinned,
    beginAssistantRequest,
  } = useAiConversationState({
    bookId: aiConversationBookId,
    answer,
    status,
    saveStatus,
    citations,
    diagnostics,
    model: currentAiModel,
    t,
  });
  const activeQuestionTimelineItems = useMemo(() => activeConversation.messages
    .filter((message) => message.role === 'user')
    .map((message, index) => ({ id: message.id, label: message.content, createdAt: message.createdAt, order: index + 1 })),
  [activeConversation]);
  const activeConversationContext = useMemo(() => formatAiConversationContext(activeConversation, interactionMode === 'agent' ? agentPresetPrompt : ''), [activeConversation, agentPresetPrompt, interactionMode]);
  const activeConversationContextTokens = useMemo(() => estimateAiTextTokens(activeConversationContext), [activeConversationContext]);
  const activeCompressionHistory = activeConversation.contextCompressionHistory ?? [];
  const agentCompressionThresholdTokens = useMemo(() => parseAgentContextCompressionThreshold(agentContextCompressionThreshold || defaultAgentContextCompressionThreshold, Number(defaultAgentContextCompressionThreshold)), [agentContextCompressionThreshold, defaultAgentContextCompressionThreshold]);
  const effectivePrompt = selectedSlashCommand
    ? [selectedSlashCommand.prompt, promptModifiers.text].filter(Boolean).join('\n\n')
    : question;
  const scopeRangeSummary = useMemo(() => {
    const chapterTitle = readerContext?.chapterTitle || t('ai.scope.currentChapter');
    const pageChars = readerContext?.pageText?.length ?? 0;
    const chapterChars = readerContext?.chapterText?.length ?? 0;
    const selectionChars = readerContext?.selectionText?.length ?? 0;
    const activeText = scope === 'page-lite'
      ? `${chapterTitle}\n${readerContext?.pageText ?? ''}`
      : scope === 'selection'
        ? readerContext?.selectionText ?? ''
        : scope === 'page'
        ? readerContext?.pageText ?? ''
        : scope === 'chapter'
          ? readerContext?.chapterText ?? ''
          : '';
    const estimatedTokens = Math.ceil(activeText.length / 2.6);
    const pageLabel = readerContext?.paragraphIndex !== undefined ? `P${readerContext.paragraphIndex + 1}` : 'P1';
    return {
      chapterTitle,
      pageLabel,
      selectionChars,
      pageChars,
      chapterChars,
      estimatedTokens,
      text: t('ai.scope.summaryText', { chapter: chapterTitle, page: pageLabel, selection: selectionChars, tokens: estimatedTokens }),
    };
  }, [readerContext?.chapterText, readerContext?.chapterTitle, readerContext?.pageText, readerContext?.paragraphIndex, readerContext?.selectionText, scope, t]);
  const agentPromptTokenEstimate = useMemo(() => Math.ceil(([activeConversationContext, question, selectedSlashCommand?.prompt, attachments.join('\n')].filter(Boolean).join('\n\n').length) / 2.6), [activeConversationContext, question, selectedSlashCommand?.prompt, attachments]);
  const agentPanelItems = useMemo(() => buildAgentScopePanelItems({
    usedTokens: diagnostics?.agentTokensUsed ?? agentPromptTokenEstimate,
    plannedTokens: diagnostics?.agentTokenBudget ?? currentAiModelContextWindow,
    toolCount: enabledAgentToolNames.length,
    stepCount: diagnostics?.agentToolSteps ?? 4,
  }, {
    pendingTokenLabel: t('ai.agentPanel.pendingToken'),
    toolCountLabel: t('ai.agentPanel.toolCount', { count: enabledAgentToolNames.length }),
    stepCountLabel: t('ai.agentPanel.stepCount', { count: diagnostics?.agentToolSteps ?? 4 }),
    contextValue: t('ai.agentPanel.contextValue'),
  }).map((item, index) => ({
    ...item,
    label: t(`ai.agentPanel.item${index}.label` as never),
    detail: t(`ai.agentPanel.item${index}.detail` as never),
  })), [agentPromptTokenEstimate, currentAiModelContextWindow, diagnostics?.agentTokenBudget, diagnostics?.agentTokensUsed, diagnostics?.agentToolSteps, enabledAgentToolNames.length, t]);
  const agentTaskPanel = useMemo(() => ({
    goal: diagnostics?.agentTaskGoal || question.trim() || activeConversation.messages.filter((message) => message.role === 'user').at(-1)?.content || t('ai.agentTask.waitingInput'),
    completed: diagnostics?.agentTaskCompleted ?? [],
    nextPlan: diagnostics?.agentNextPlan || (isGenerating ? t('ai.agentTask.waitingNextStep') : t('ai.agentTask.notStarted')),
    blockedReason: diagnostics?.agentTaskBlockedReason || '',
    tokenBudget: `${formatAttachmentTokenLabel(diagnostics?.agentTokensUsed ?? agentPromptTokenEstimate, t)} / ${formatAttachmentTokenLabel(diagnostics?.agentTokenBudget ?? currentAiModelContextWindow, t)}`,
    toolsUsed: diagnostics?.agentToolsUsed ?? [],
    pendingConfirmation: diagnostics?.agentPendingConfirmation,
  }), [activeConversation.messages, agentPromptTokenEstimate, currentAiModelContextWindow, diagnostics, isGenerating, question, t]);
  const liveScopePreview = useMemo(() => {
    const effective = resolveEffectiveScope(scope, readerContext, 'chapter', true, true, true, true, t);
    if (interactionMode === 'agent') return t('ai.agentToolbox.preview', { enabled: enabledAgentToolNames.length, total: agentToolCatalog.length, token: agentPanelItems[0]?.value ?? '' });
    return `${effective.label} · ${scopeRangeSummary.text}`;
  }, [readerContext, scope, scopeRangeSummary.text, interactionMode, enabledAgentToolNames.length, agentToolCatalog.length, agentPanelItems, t]);
  useEffect(() => {
    void loadAiModePreferenceForCurrentBook();
  }, [currentConsentBookId, defaultAiMode, currentAiModelContextWindow, defaultAgentPresetPrompt]);

  useEffect(() => {
    setScope(defaultAiScope);
  }, [defaultAiScope]);

  useLayoutEffect(() => {
    if (!aiAnswerStreamRef.current || !shouldAutoScrollAnswerRef.current) return;
    const stream = aiAnswerStreamRef.current;
    aiAnswerStreamRef.current.scrollTo({
      top: stream.scrollHeight,
      behavior: isGenerating ? 'auto' : 'smooth',
    });
  }, [answer, activeConversation.messages.length, isGenerating, shouldRenderStructuredAnswer]);

  useEffect(() => {
    if (!slashCommandsEnabled) {
      setSelectedSlashCommand(null);
      setSlashMenuOpen(false);
      setSlashDetailCommand(null);
    }
  }, [slashCommandsEnabled]);

  useEffect(() => {
    setCustomSlashCommands((current) => {
      const next = current.slice(0, customSlashCommandLimit);
      if (next.length !== current.length) saveAiCustomSlashCommands(next.map(toAiCustomSlashCommandDraft));
      return next;
    });
    setRecentSlashCommandIds((current) => current.slice(0, recentSlashCommandLimit));
  }, [customSlashCommandLimit, recentSlashCommandLimit]);

  useEffect(() => {
    setRecentSlashCommandIds((current) => current.filter((id) => slashCommands.some((command) => command.id === id)).slice(0, recentSlashCommandLimit));
  }, [recentSlashCommandLimit, slashCommands]);

  useEffect(() => {
    if (selectedSlashCommand && !isSlashCommandEnabled(selectedSlashCommand, builtInSlashCommandEnabled)) {
      setSelectedSlashCommand(null);
      setSlashMenuOpen(false);
      setSlashDetailCommand(null);
    }
  }, [selectedSlashCommand, builtInSlashCommandEnabled]);

  useEffect(() => {
    const hasOpenBottomPopover = attachmentPopoverOpen || scopePopoverOpen || modePopoverOpen || evidencePopoverOpen || modelPopoverOpen;
    if (!hasOpenBottomPopover) return undefined;
    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('.ai-popover-wrap, .ai-scope-status-wrap')) return;
      closeBottomPopovers();
    }
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') closeBottomPopovers();
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [attachmentPopoverOpen, scopePopoverOpen, modePopoverOpen, evidencePopoverOpen, modelPopoverOpen]);

  useEffect(() => {
    if (!questionTimelineOpen) return undefined;
    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && questionTimelineRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-ai-question-timeline-trigger]')) return;
      setQuestionTimelineOpen(false);
    }
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setQuestionTimelineOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [questionTimelineOpen]);

  useEffect(() => {
    function resetCurrentBookAiPanelData(detail?: { bookId?: string }) {
      if (!detail?.bookId || detail.bookId !== currentConsentBookId) return;
      setQuestion('');
      setAttachments([]);
      setScope(defaultAiScope);
      setSelectedSlashCommand(null);
      setSlashMenuOpen(false);
      setSlashDetailCommand(null);
      setAttachmentPopoverOpen(false);
      setScopePopoverOpen(false);
      setEvidencePopoverOpen(false);
      setHistoryDrawerOpen(false);
      setQuestionTimelineOpen(false);
      resetConversationHistory();
      setInteractionMode(resolveConfiguredAiInteractionMode(defaultAiMode));
      setAgentPresetPrompt(defaultAgentPresetPrompt);
      setModePopoverOpen(false);
    }
    function onCurrentBookDataCleared(detail: { bookId: string }) {
      resetCurrentBookAiPanelData(detail);
    }
    return subscribeCurrentBookDataCleared(onCurrentBookDataCleared);
  }, [currentConsentBookId, defaultAiMode, defaultAiScope]);

  useLayoutEffect(() => {
    resizeComposerToQuestion();
  }, [question, selectedSlashCommand, attachments.length]);

  function resizeComposerToQuestion() {
    const textarea = promptInputRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    const attachmentHeight = attachments.length ? COMPOSER_ATTACHMENT_HEIGHT : 0;
    const nextHeight = Math.min(COMPOSER_MAX_HEIGHT + attachmentHeight, Math.max(COMPOSER_MIN_HEIGHT + attachmentHeight, textarea.scrollHeight + attachmentHeight));
    textarea.style.height = `${Math.max(0, nextHeight - COMPOSER_VERTICAL_PADDING - attachmentHeight)}px`;
    setComposerInputHeight(nextHeight);
  }

  function createNewConversation() {
    setQuestion('');
    setSelectedSlashCommand(null);
    startNewConversation();
  }

  function selectConversationFromHistory(conversationId: string) {
    setHistoryDrawerOpen(false);
    selectConversation(conversationId);
  }

  async function loadAiModePreferenceForCurrentBook() {
    if (!currentConsentBookId) {
      setInteractionMode(resolveConfiguredAiInteractionMode(defaultAiMode));
      setModePopoverOpen(false);
      return;
    }
    try {
      const record = await getReaderRecord(currentConsentBookId, 'aiModePreference');
      const parsedPreference = parseReaderRecord(record, null) as Record<string, unknown> | null;
      const preference = parseAiInteractionModePreference(parsedPreference);
      const enabledTools = parseAgentEnabledToolsPreference(parsedPreference);
      const presetPrompt = parseAgentPresetPromptPreference(parsedPreference);
      const compressionThreshold = parseAgentContextCompressionThresholdPreference(parsedPreference);
      setInteractionMode(resolveConfiguredAiInteractionMode(preference ?? defaultAiMode));
      setAgentEnabledTools(enabledTools ?? getDefaultAgentEnabledTools());
      setAgentPresetPrompt(presetPrompt ?? defaultAgentPresetPrompt);
      setAgentContextCompressionThreshold(compressionThreshold ?? resolveDefaultAgentContextCompressionThreshold(currentAiModelContextWindow));
      setModePopoverOpen(false);
    } catch {
      setInteractionMode(resolveConfiguredAiInteractionMode(defaultAiMode));
      setAgentEnabledTools(getDefaultAgentEnabledTools());
      setAgentPresetPrompt(defaultAgentPresetPrompt);
      setAgentContextCompressionThreshold(resolveDefaultAgentContextCompressionThreshold(currentAiModelContextWindow));
      setModePopoverOpen(false);
    }
  }

  async function saveAiModePreferenceForCurrentBook(nextMode: AiInteractionMode, nextEnabledTools = enabledAgentToolNames, nextCompressionThreshold = agentContextCompressionThreshold, nextPresetPrompt = agentPresetPrompt) {
    if (!currentConsentBookId) return;
    await saveReaderRecord(currentConsentBookId, 'aiModePreference', { interactionMode: nextMode, agentEnabledTools: normalizeAgentEnabledTools(nextEnabledTools), agentContextCompressionThreshold: nextCompressionThreshold, agentPresetPrompt: nextPresetPrompt.trim().slice(0, 24000), updatedAt: new Date().toISOString() }, 'ai-research-desk').catch(() => undefined);
  }

  function updateAiMode(mode: AiInteractionMode) {
    setInteractionMode(mode);
    setModePopoverOpen(false);
    void saveAiModePreferenceForCurrentBook(mode);
  }

  function toggleBottomPopover(target: AiBottomPopoverId) {
    const isOpen =
      target === 'attachment' ? attachmentPopoverOpen
        : target === 'scope' ? scopePopoverOpen
          : target === 'mode' ? modePopoverOpen
            : target === 'evidence' ? evidencePopoverOpen
              : modelPopoverOpen;
    const next = isOpen ? null : target;
    setAttachmentPopoverOpen(next === 'attachment');
    if (next !== 'attachment') setAttachmentPreviewId(null);
    setScopePopoverOpen(next === 'scope');
    if (next !== 'scope') setAgentCompressionPreviewOpen(false);
    setModePopoverOpen(next === 'mode');
    setEvidencePopoverOpen(next === 'evidence');
    setModelPopoverOpen(next === 'model');
  }

  function closeBottomPopovers() {
    setAttachmentPopoverOpen(false);
    setAttachmentPreviewId(null);
    setScopePopoverOpen(false);
    setAgentCompressionPreviewOpen(false);
    setModePopoverOpen(false);
    setEvidencePopoverOpen(false);
    setModelPopoverOpen(false);
  }

  function toggleQuestionTimeline() {
    setQuestionTimelineOpen((open) => !open);
    setHistoryDrawerOpen(false);
    setApiSettingsOpen(false);
  }

  function jumpToConversationMessage(messageId: string) {
    const target = document.getElementById(`ai-message-${messageId}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedTimelineMessageId(messageId);
    setQuestionTimelineOpen(false);
    window.setTimeout(() => {
      setHighlightedTimelineMessageId((current) => current === messageId ? null : current);
    }, 1200);
  }

  function toggleAgentTool(toolName: string) {
    const nextTools = enabledAgentToolNames.includes(toolName)
      ? enabledAgentToolNames.filter((name) => name !== toolName)
      : normalizeAgentEnabledTools([...enabledAgentToolNames, toolName]);
    setAgentEnabledTools(nextTools);
    void saveAiModePreferenceForCurrentBook(interactionMode, nextTools);
  }

  function updateAgentCompressionThreshold(value: string) {
    const normalized = value.replace(/[^\d]/g, '').slice(0, 8);
    setAgentContextCompressionThreshold(normalized);
    void saveAiModePreferenceForCurrentBook(interactionMode, enabledAgentToolNames, normalized);
  }

  function updateAgentPresetPrompt(value: string) {
    setAgentPresetPrompt(value.slice(0, 24000));
  }

  function resetAgentPresetPrompt() {
    setAgentPresetPrompt(defaultAgentPresetPrompt);
    void saveAiModePreferenceForCurrentBook(interactionMode, enabledAgentToolNames, agentContextCompressionThreshold, defaultAgentPresetPrompt);
  }

  function redactCloudText(prompt: string) {
    if (!cloudPrivacySettings.autoRedact) return prompt;
    return redactSensitiveCloudText(prompt, cloudPrivacySettings.sensitiveWords);
  }

  function buildConversationPromptText(prompt: string) {
    const text = prompt.trim();
    if (!selectedSlashCommand) return text;
    const followup = promptModifiers.text.trim();
    return [`/${selectedSlashCommand.label}`, followup].filter(Boolean).join(' ');
  }

  function clearSubmittedComposerDraft() {
    setQuestion('');
    setSelectedSlashCommand(null);
    setSlashMenuOpen(false);
    setSlashDetailCommand(null);
    setActiveSlashIndex(0);
  }

  function buildAiAskRequest(prompt = effectivePrompt, options: { conversationContext?: string } = {}): AiPanelAskRequest | null {
    const nextPrompt = prompt.trim();
    if (!nextPrompt) return null;
    if (aiTransportMode === 'cloud' && !hasCloudConsent) return null;
    const requestedScope = resolveAiRequestedScope({
      scopePriorityStrategy,
      promptScopeOverride: promptModifiers.scopeOverride,
      commandScope: selectedSlashCommand?.scopeHint,
      panelScope: scope,
    });
    const allowSelectionText = cloudPrivacySettings.allowSelectionText;
    const allowCurrentPageText = cloudPrivacySettings.allowCurrentPageText;
    const allowCurrentChapterText = cloudPrivacySettings.allowCurrentChapterText;
    const allowBookSummaryContext = cloudPrivacySettings.allowBookSummaryContext;
    const effectiveScope = resolveEffectiveScope(requestedScope, readerContext, noSelectionFallbackScope, allowSelectionText, allowCurrentPageText, allowCurrentChapterText, allowBookSummaryContext, t);
    const tokenBoundedScope = resolveTokenBoundedScope(effectiveScope, requestedScope, readerContext, scopeTokenPolicy, currentAiModelContextWindow, { allowCurrentPageText, allowCurrentChapterText }, t);
    const scopeText = resolveScopeTextForInteraction(interactionMode, tokenBoundedScope.text);
    const requestBookId = book?.id ?? readerContext?.bookId;
    const cloudPromptText = redactCloudText(nextPrompt);
    const commandPromptText = selectedSlashCommand?.prompt ?? '';
    const cloudCommandPromptText = redactCloudText(commandPromptText);
    const cloudModifierText = redactCloudText(promptModifiers.text);
    const baseInstruction = selectedSlashCommand ? cloudCommandPromptText : cloudPromptText;
    const instruction = interactionMode === 'agent' ? buildAgentModeInstruction(baseInstruction) : baseInstruction;
    return {
      scope: tokenBoundedScope.scope,
      instruction,
      userText: selectedSlashCommand ? cloudModifierText : '',
      selectedCommandId: selectedSlashCommand?.id,
      retrievalStrategy: selectedSlashCommand?.retrievalStrategy ?? retrievalDefaults.defaultStrategy,
      retrievalQuery: buildRetrievalQuery(selectedSlashCommand ? cloudModifierText : cloudPromptText, retrievalDefaults.queryRewriteMode, selectedSlashCommand?.id),
      multiStageRetrievalMode: retrievalDefaults.multiStageMode,
      bookId: requestBookId,
      scopeText: redactCloudText(scopeText ?? ''),
      scopeLabel: tokenBoundedScope.label,
      conversationContext: redactCloudText(options.conversationContext ?? activeConversationContext),
      mode: aiTransportMode,
      interactionMode,
      reasoningEffort: activeReasoningEffort,
      agentEnabledTools: interactionMode === 'agent' ? enabledAgentToolNames : undefined,
      requireCloudApi: true,
      localResultLimit: retrievalDefaults.localResultLimit,
      citationMinConfidence: retrievalDefaults.citationMinConfidence,
      customSensitiveWords: cloudPrivacySettings.sensitiveWords,
    };
  }

  async function compressActiveConversationContext(trigger: 'manual' | 'auto' = 'manual') {
    if (!appSettings) {
      setAgentCompressionStatus(t('ai.agentCompression.status.noCloud'));
      return null;
    }
    const conversation = activeConversation;
    const sourceContext = formatAiConversationContext(conversation, agentPresetPrompt);
    const sourceTokens = estimateAiTextTokens(sourceContext);
    if (!sourceContext.trim()) {
      setAgentCompressionStatus(t('ai.agentCompression.status.empty'));
      return null;
    }
    setAgentContextCompressing(true);
    setAgentCompressionStatus(trigger === 'auto' ? t('ai.agentCompression.status.autoCompressing') : t('ai.agentCompression.status.manualCompressing'));
    try {
      const thresholdTokens = parseAgentContextCompressionThreshold(agentContextCompressionThreshold || defaultAgentContextCompressionThreshold, Number(defaultAgentContextCompressionThreshold));
      const response = await requestCloudAiAnswer(appSettings, {
        scope: 'conversation-context-compression',
        instruction: buildAiContextCompressionInstruction({ thresholdTokens, sourceTokens }),
        userText: sourceContext,
        mode: 'cloud',
        interactionMode: 'agent',
        reasoningEffort: activeReasoningEffort,
        requireCloudApi: true,
        cloudResponseFormat: 'json_object',
        requestId: `context-compress-${Date.now()}`,
        customSensitiveWords: cloudPrivacySettings.sensitiveWords,
      });
      const compressedContent = parseAiContextCompressionResponse(response.answer);
      const targetTokens = estimateAiTextTokens(compressedContent);
      const compression = {
        id: createAiConversationId(),
        content: compressedContent,
        sourceContent: sourceContext.slice(0, 24000),
        compressedAt: new Date().toISOString(),
        messageCount: conversation.messages.length,
        sourceTokenEstimate: sourceTokens,
        targetTokenEstimate: targetTokens,
        thresholdTokens,
        model: currentAiModel,
      };
      updateConversationHistory((current) => applyConversationContextCompression(current, conversation.id, compression));
      setAgentCompressionStatus(t('ai.agentCompression.status.compressed', { source: formatAttachmentTokenLabel(sourceTokens, t), target: formatAttachmentTokenLabel(targetTokens, t) }));
      return formatAiConversationContext({ ...conversation, contextCompression: compression }, agentPresetPrompt);
    } catch (error) {
      setAgentCompressionStatus(t('ai.agentCompression.status.failed', { error: error instanceof Error ? error.message : String(error) }));
      return null;
    } finally {
      setAgentContextCompressing(false);
    }
  }

  function restoreCompressionSnapshot(snapshotId: string) {
    updateConversationHistory((current) => restoreConversationContextCompression(current, activeConversation.id, snapshotId));
    setAgentCompressionStatus(t('ai.agentCompression.status.restored'));
  }

  async function resolveConversationContextBeforeSend(prompt: string) {
    if (interactionMode !== 'agent') return activeConversationContext;
    const thresholdTokens = parseAgentContextCompressionThreshold(agentContextCompressionThreshold || defaultAgentContextCompressionThreshold, Number(defaultAgentContextCompressionThreshold));
    if (thresholdTokens <= 0) return activeConversationContext;
    const projectedTokens = estimateAiTextTokens([activeConversationContext, prompt, selectedSlashCommand?.prompt, attachments.join('\n')].filter(Boolean).join('\n\n'));
    if (projectedTokens < thresholdTokens) return activeConversationContext;
    return await compressActiveConversationContext('auto');
  }

  function runWithChapterFallback() {
    if (!fallbackEnabled) return;
    if (!localAiEnabled) return;
    const command = builtInSlashCommands.find((item) => item.id === 'summary') ?? builtInSlashCommands[0];
    onAsk({
      scope: 'chapter',
      instruction: command.prompt,
      userText: question.trim(),
      selectedCommandId: command.id,
      retrievalQuery: question.trim(),
      multiStageRetrievalMode: retrievalDefaults.multiStageMode,
      bookId: book?.id ?? readerContext?.bookId,
      scopeText: readerContext?.chapterText,
      scopeLabel: readerContext?.chapterTitle,
      mode: 'local',
      localResultLimit: retrievalDefaults.localResultLimit,
      citationMinConfidence: retrievalDefaults.citationMinConfidence,
    });
  }

  function switchToCloudMode() {
    if (!fallbackEnabled) return;
    updateAiMode('qa');
  }

  function updateScope(value: string) {
    if (isAiScope(value)) setScope(value);
  }

  function onSaveProtocolHighlight(citation: AiProtocolCitation) {
    const knowledgeCitation = protocolCitationToKnowledgeCitation(citation);
    if (knowledgeCitation) void onSaveHighlight(knowledgeCitation);
  }

  function onSaveProtocolExcerpt(citation: AiProtocolCitation) {
    const knowledgeCitation = protocolCitationToKnowledgeCitation(citation);
    if (knowledgeCitation) void onSaveExcerpt(knowledgeCitation);
  }

  function saveCitationByDefault(citation: Citation) {
    if (citationDefaultSaveTarget === 'highlight' || citationDefaultSaveTarget === 'both') void onSaveHighlight(citation);
    if (citationDefaultSaveTarget === 'excerpt' || citationDefaultSaveTarget === 'both') void onSaveExcerpt(citation);
  }

  function onSaveProtocolDefault(citation: AiProtocolCitation) {
    const knowledgeCitation = protocolCitationToKnowledgeCitation(citation);
    if (knowledgeCitation) saveCitationByDefault(knowledgeCitation);
  }

  function selectSlashCommand(command: SlashCommand) {
    const trailingText = question.startsWith('/') ? question.slice(1).trim() : question.trim();
    const shouldKeepTrailingText = trailingText && !command.label.toLocaleLowerCase().includes(trailingText.toLocaleLowerCase());
    setSelectedSlashCommand(command);
    setRecentSlashCommandIds((current) => [command.id, ...current.filter((id) => id !== command.id)].slice(0, recentSlashCommandLimit));
    setQuestion(shouldKeepTrailingText ? trailingText : '');
    setSlashMenuOpen(false);
    setSlashDetailCommand(null);
    setActiveSlashIndex(0);
    window.requestAnimationFrame(() => promptInputRef.current?.focus());
  }

  function removeSlashCommand() {
    setSelectedSlashCommand(null);
    setSlashMenuOpen(false);
    setSlashDetailCommand(null);
    window.requestAnimationFrame(() => promptInputRef.current?.focus());
  }

  function addCustomSlashCommand() {
    if (!slashCommandsEnabled) return;
    const prompt = question.trim();
    if (!prompt) return;
    const label = prompt.split(/\s+/).slice(0, 4).join(' ').slice(0, 18) || t('ai.command.customTemplate');
    const command: SlashCommand = {
      id: `custom-${Date.now().toString(36)}`,
      label,
      prompt,
      aliases: [label, prompt].map((item) => item.toLocaleLowerCase()),
      scopeHint: scope,
      outputHint: 'custom',
      retrievalStrategy: 'scope-first',
    };
    setCustomSlashCommands((current) => {
      const next = [command, ...current].slice(0, customSlashCommandLimit);
      saveAiCustomSlashCommands(next.map(toAiCustomSlashCommandDraft));
      return next;
    });
    selectSlashCommand(command);
  }

  function addAttachmentChip(label: string) {
    setAttachments((current) => [...current, label]);
    setAttachmentPreviewId(null);
    setAttachmentPopoverOpen(false);
  }

  function openAttachmentPreview(event: ReactMouseEvent<HTMLButtonElement>, id: AiAttachmentOptionId) {
    event.preventDefault();
    setAttachmentPreviewId(id);
  }

  function removeAttachmentChip(index: number) {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function startComposerResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = composerInputHeight;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    function onMove(moveEvent: PointerEvent) {
      const attachmentHeight = attachments.length ? COMPOSER_ATTACHMENT_HEIGHT : 0;
      const nextHeight = Math.min(COMPOSER_MAX_HEIGHT + attachmentHeight, Math.max(COMPOSER_MIN_HEIGHT + attachmentHeight, startHeight + startY - moveEvent.clientY));
      setComposerInputHeight(Math.round(nextHeight));
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }

  function submitOrStopPrompt() {
    if (isGenerating) {
      requestLifecycle.stop();
      return;
    }
    void requestLifecycle.submit(effectivePrompt);
  }

  function updateQuestion(value: string) {
    setQuestion(value);
    setSlashMenuOpen(!selectedSlashCommand && slashCommandsEnabled && value.trim().startsWith('/'));
    if (!value.trim().startsWith('/')) setSlashDetailCommand(null);
    setActiveSlashIndex(0);
  }

  function quoteConversationSelection(text: string) {
    const quoted = text.trim().split(/\r?\n/).map((line) => `> ${line}`).join('\n');
    if (!quoted) return;
    setSelectedSlashCommand(null);
    setSlashMenuOpen(false);
    setSlashDetailCommand(null);
    setQuestion((current) => current.trim() ? `${current.trimEnd()}\n\n${quoted}\n\n` : `${quoted}\n\n`);
    window.requestAnimationFrame(() => promptInputRef.current?.focus());
  }

  function openSlashCommandDetail(event: ReactMouseEvent, command: SlashCommand) {
    event.preventDefault();
    event.stopPropagation();
    setSlashDetailCommand(command);
    setSlashMenuOpen(true);
  }

  function closeSlashCommandDetail() {
    setSlashDetailCommand(null);
    window.requestAnimationFrame(() => promptInputRef.current?.focus());
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      submitOrStopPrompt();
      return;
    }
    if (slashMenuOpen && filteredSlashCommands.length) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveSlashIndex((current) => {
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          return (current + delta + filteredSlashCommands.length) % filteredSlashCommands.length;
        });
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        selectSlashCommand(activeSlashCommand);
        return;
      }
    }
    if ((event.key === 'Backspace' || event.key === 'Delete') && selectedSlashCommand && !question) {
      event.preventDefault();
      removeSlashCommand();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setSlashMenuOpen(false);
    }
  }

  function handleAnswerStreamScroll() {
    const stream = aiAnswerStreamRef.current;
    if (!stream) return;
    const { scrollHeight, scrollTop, clientHeight } = stream;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    shouldAutoScrollAnswerRef.current = distanceFromBottom < 48;
  }

  const requestLifecycle = useAiRequestLifecycle({
    isGenerating,
    resolveConversationContext: resolveConversationContextBeforeSend,
    buildRequest: buildAiAskRequest,
    buildDisplayPrompt: buildConversationPromptText,
    beginAssistantRequest,
    clearSubmittedComposerDraft,
    onAsk,
    onRetry,
    onStop,
    searchingEvidenceLabel: t('ai.status.searchingEvidence'),
    regeneratingLabel: t('ai.status.regenerating'),
  });

  useEffect(() => {
    if (!externalPromptRequest) return;
    setScope(externalPromptRequest.scope);
    setQuestion(externalPromptRequest.prompt);
    setSelectedSlashCommand(null);
    setSlashMenuOpen(false);
    setSlashDetailCommand(null);
    setPendingExternalPromptRequest(externalPromptRequest);
    onExternalPromptConsumed?.(externalPromptRequest.id);
  }, [externalPromptRequest?.id]);

  useEffect(() => {
    const pending = pendingExternalPromptRequest;
    if (!pending || isGenerating || !conversationHistoryReady) return;
    if (scope !== pending.scope || question !== pending.prompt || selectedSlashCommand) return;
    if ((pending.selectionText ?? '') !== (readerContext?.selectionText ?? '')) return;
    setPendingExternalPromptRequest(null);
    void requestLifecycle.submit(pending.prompt, { displayPrompt: pending.prompt });
  }, [pendingExternalPromptRequest, conversationHistoryReady, isGenerating, question, readerContext?.selectionText, scope, selectedSlashCommand]);

  return (
    <aside className="ai-panel research-desk" aria-label="AI">
      <AiReaderPanelToolbar
        t={t}
        apiSettingsOpen={apiSettingsOpen}
        questionTimelineOpen={questionTimelineOpen}
        historyDrawerOpen={historyDrawerOpen}
        conversations={conversationHistory.conversations}
        activeConversationId={conversationHistory.activeConversationId}
        timelineItems={activeQuestionTimelineItems}
        timelineRef={questionTimelineRef}
        onToggleApiSettings={() => setApiSettingsOpen((open) => !open)}
        onToggleQuestionTimeline={toggleQuestionTimeline}
        onToggleHistory={() => setHistoryDrawerOpen((open) => !open)}
        onCloseQuestionTimeline={() => setQuestionTimelineOpen(false)}
        onOpenSettings={() => onOpenSettings('ai-api')}
        onToggleCollapsed={onToggleCollapsed}
        onCreateConversation={createNewConversation}
        onSwitchConversation={selectConversationFromHistory}
        onRenameConversation={updateConversationTitle}
        onDeleteConversation={removeConversation}
        onPinConversation={updateConversationPinned}
        onJumpToMessage={jumpToConversationMessage}
        formatTimelineTime={formatQuestionTimelineTime}
      />

      <div className="ai-answer-stream" ref={aiAnswerStreamRef} onScroll={handleAnswerStreamScroll}>
        <AiConversationMessageList
          conversation={activeConversation}
          bookReady={Boolean(book)}
          status={status}
          saveStatus={saveStatus}
          isGenerating={isGenerating}
          structuredAnswer={filteredStructuredAnswer}
          shouldRenderStructuredAnswer={shouldRenderStructuredAnswer}
          renderedBlockLimit={safeRenderedBlockLimit}
          answer={answer}
          citations={citations}
          diagnostics={diagnostics}
          scope={scope}
          selectedCommandId={selectedSlashCommand?.id}
          copyDiagnosticsAutoRedact={copyDiagnosticsAutoRedact}
          fallbackEnabled={fallbackEnabled}
          localAiEnabled={localAiEnabled}
          cloudEnabled={cloudPrivacySettings.enabled}
          defaultCitationDensity={interactionMode === 'agent' ? 'compact' : outputDefaults.citationCardDefaultDensity}
          externalCitationsDisabled={outputDefaults.externalCitationsDisabled}
          citationJumpRepairEnabled={outputDefaults.citationJumpRepairEnabled}
          citationFieldStrictness={outputDefaults.citationFieldStrictness}
          toolCallDisplayMode={outputDefaults.toolCallDisplayMode}
          flashcardDefaults={flashcardDefaults}
          noCitationWarning={shouldShowNoCitationWarning}
          requiredCitationWarning={shouldShowRequiredCitationWarning}
          citationCoverage={citationCoverage}
          emptyGuide={<AiEmptyGuide bookReady={Boolean(book)} statusText={saveStatus || t(`ai.status.${status}`)} />}
          onRenameConversationTitle={updateConversationTitle}
          onQuoteSelection={quoteConversationSelection}
          onDeleteMessage={removeConversationMessage}
          onRunChapterFallback={runWithChapterFallback}
          onSwitchToCloudMode={switchToCloudMode}
          onOpenTasks={onOpenTasks}
          onStop={onStop}
          onCopyAnswer={() => { void navigator.clipboard?.writeText(answer); }}
          onRetry={() => { void requestLifecycle.retry(effectivePrompt); }}
          onSaveProtocolDefault={onSaveProtocolDefault}
          onSaveProtocolHighlight={onSaveProtocolHighlight}
          onSaveProtocolExcerpt={onSaveProtocolExcerpt}
          highlightedMessageId={highlightedTimelineMessageId}
          t={t}
        />
      </div>

      <div className="ai-composer-card ai-companion-dock resizable-composer" style={{ '--composer-input-height': `${composerInputHeight}px` } as ComposerStyle}>
        <button className="ai-composer-resize-handle" type="button" data-tooltip={t('ai.composer.resize')} aria-label={t('ai.composer.resize')} onPointerDown={startComposerResize} />
        <AiReaderComposerInput
          t={t}
          attachments={attachments}
          question={question}
          selectedCommand={selectedSlashCommand}
          slashMenuOpen={slashMenuOpen}
          activeSlashIndex={activeSlashIndex}
          activeSlashCommand={activeSlashCommand}
          filteredSlashCommands={filteredSlashCommands}
          slashCommandsEnabled={slashCommandsEnabled}
          promptModifiers={promptModifiers.modifiers}
          promptInputRef={promptInputRef}
          slashDetail={slashDetailCommand ? <SlashCommandDetailPopover command={slashDetailCommand} onClose={closeSlashCommandDetail} t={t} /> : null}
          renderSlashCommandPreview={(command) => <SlashCommandPreview command={command as SlashCommand} />}
          onRemoveAttachment={removeAttachmentChip}
          onRemoveCommand={removeSlashCommand}
          onQuestionChange={updateQuestion}
          onOpenSlashMenu={() => setSlashMenuOpen(true)}
          onPromptKeyDown={handlePromptKeyDown}
          onOpenSlashCommandDetail={(event, command) => openSlashCommandDetail(event, command as SlashCommand)}
          onSelectSlashCommand={(command) => selectSlashCommand(command as SlashCommand)}
          onSetActiveSlashIndex={setActiveSlashIndex}
        />
        <div className="ai-bottom-toolbar">
          <div className="ai-bottom-left-tools">
            <div className="ai-popover-wrap">
              <button className={attachmentPopoverOpen ? 'reader-icon-btn ai-attachment-add-btn active' : 'reader-icon-btn ai-attachment-add-btn'} type="button" data-tooltip={t('ai.attachment.title')} aria-label={t('ai.attachment.title')} onClick={() => toggleBottomPopover('attachment')}><BookMindIcon name="plus" /></button>
              {attachmentPopoverOpen ? (
                <aside className={attachmentPreviewId ? 'ai-attachment-popover floating-card-stack previewing' : 'ai-attachment-popover floating-card-stack'} aria-label={t('ai.attachment.selectAria')}>
                  {attachmentPreviewOption && attachmentPreviewMaterial ? (
                    <>
                      <header className="ai-attachment-preview-header">
                        <button className="ai-attachment-preview-back" type="button" onClick={() => setAttachmentPreviewId(null)}>{t('ai.attachment.previewBack')}</button>
                        <span><strong>{attachmentPreviewOption.label}</strong><small>{attachmentPreviewOption.tokenLabel}</small></span>
                      </header>
                      <div className="ai-attachment-preview-body">
                        {attachmentPreviewMaterial.truncated ? <small>{t('ai.attachment.previewTruncated', { shown: ATTACHMENT_PREVIEW_CHAR_LIMIT, total: attachmentPreviewMaterial.totalChars })}</small> : null}
                        <pre>{attachmentPreviewMaterial.text}</pre>
                      </div>
                    </>
                  ) : (
                    <>
                      <header><strong>{t('ai.attachment.title')}</strong><small>{t('ai.attachment.subtitle')}</small></header>
                      <p className="ai-attachment-context-hint">{t('ai.attachment.contextHint')}</p>
                      <div className="ai-attachment-option-grid">
                        {attachmentOptions.map((option) => (
                          <button type="button" key={option.id} title={t('ai.attachment.itemHint')} onClick={() => addAttachmentChip(option.label)} onContextMenu={(event) => openAttachmentPreview(event, option.id)}>
                            <span className="ai-attachment-option-label">{option.label}</span>
                            <small className="ai-attachment-token-tag">{option.tokenLabel}</small>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </aside>
              ) : null}
            </div>
            <div className="ai-scope-status-wrap">
              <button className={scopePopoverOpen ? 'reader-icon-btn ai-scope-status-btn active' : 'reader-icon-btn ai-scope-status-btn'} type="button" data-tooltip={capabilityPanelTitle.tooltip} aria-label={capabilityPanelTitle.tooltip} onClick={() => toggleBottomPopover('scope')}><BookMindIcon name="more" /></button>
              {scopePopoverOpen ? (
                <aside className={interactionMode === 'agent' ? 'ai-scope-popover agent-toolbox-popover' : 'ai-scope-popover'} aria-label={t('ai.panel.detailAria', { title: capabilityPanelTitle.title })}>
                  <header><div><strong>{capabilityPanelTitle.title}</strong><br /><small>{capabilityPanelTitle.subtitle}</small></div><small>{t('ai.panel.apiMode', { mode: interactionMode === 'agent' ? t('ai.mode.agent.short') : t('ai.mode.qa.short') })}</small></header>
                  {interactionMode === 'agent' && agentCompressionPreviewOpen ? (
                    <section className="ai-agent-compression-preview" aria-label={t('ai.agentCompression.previewAria')}>
                      <div className="ai-attachment-preview-header">
                        <button type="button" className="ai-attachment-preview-back" onClick={() => setAgentCompressionPreviewOpen(false)}>{t('common.back')}</button>
                        <span><strong>{t('ai.agentCompression.versionManager')}</strong><small>{activeCompressionHistory.length ? t('ai.agentCompression.versionSummary', { count: activeCompressionHistory.length, token: formatAttachmentTokenLabel(activeConversation.contextCompression?.targetTokenEstimate ?? 0, t) }) : t('ai.agentCompression.noResult')}</small></span>
                      </div>
                      <div className="ai-agent-compression-preview-body">
                        {activeConversation.contextCompression ? (
                          <section className="ai-agent-compression-current">
                            <header><strong>{t('ai.agentCompression.currentVersion')}</strong><small>{activeConversation.contextCompression.compressedAt}</small></header>
                            <pre>{activeConversation.contextCompression.content}</pre>
                          </section>
                        ) : <p className="empty-hint">{t('ai.agentCompression.emptyPreview')}</p>}
                        {activeCompressionHistory.length ? (
                          <div className="ai-agent-compression-history">
                            {activeCompressionHistory.map((snapshot, index) => (
                              <details className="ai-agent-compression-version" key={snapshot.id} open={index === 0}>
                                <summary>
                                  <span><b>{index === 0 ? t('ai.agentCompression.previousVersion') : t('ai.agentCompression.historyVersion', { index: index + 1 })}</b><small>{snapshot.compressedAt}</small></span>
                                  <em>{formatAttachmentTokenLabel(snapshot.sourceTokenEstimate, t)} {'->'} {formatAttachmentTokenLabel(snapshot.targetTokenEstimate, t)}</em>
                                </summary>
                                <div className="ai-agent-compression-diff">
                                  <span><b>{t('ai.agentCompression.before')}</b><pre>{snapshot.sourceContent || snapshot.previousContent || t('ai.agentCompression.noSourceSnapshot')}</pre></span>
                                  <span><b>{t('ai.agentCompression.after')}</b><pre>{snapshot.content}</pre></span>
                                </div>
                                <button type="button" className="ghost-btn small" disabled={activeConversation.contextCompression?.id === snapshot.id} onClick={() => restoreCompressionSnapshot(snapshot.id)}>
                                  {activeConversation.contextCompression?.id === snapshot.id ? t('ai.agentCompression.inUse') : t('ai.agentCompression.restoreVersion')}
                                </button>
                                {snapshot.restoredAt ? <small className="ai-agent-compression-restored">{t('ai.agentCompression.restoredAt', { time: snapshot.restoredAt })}</small> : null}
                              </details>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </section>
                  ) : (
                    <>
                      {interactionMode === 'agent' ? (
                        <div className="ai-agent-toolbox-outer-scroll">
                          {scopeSelectVisible ? <ThemedSelect menuPlacement="top" className="ai-scope-select" label={t('ai.scopeSelect')} value={scope} options={scopeOptions} onChange={updateScope} /> : null}
                          <div className="ai-agent-toolbox-scroll">
                            <section className={agentTaskPanel.blockedReason ? 'ai-agent-task-card blocked' : 'ai-agent-task-card'} aria-label={t('ai.agentTask.aria')}>
                              <header>
                                <span><strong>{t('ai.agentTask.title')}</strong><small>{agentTaskPanel.tokenBudget}</small></span>
                                <em>{agentTaskPanel.blockedReason ? t('ai.agentTask.status.blocked') : isGenerating ? t('ai.agentTask.status.running') : t('ai.agentTask.status.ready')}</em>
                              </header>
                              <p>{agentTaskPanel.goal}</p>
                              <div className="ai-agent-task-grid">
                                <span><b>{t('ai.agentTask.completed')}</b><small>{agentTaskPanel.completed.length ? agentTaskPanel.completed.slice(-3).join(' / ') : t('common.none')}</small></span>
                                <span><b>{t('ai.agentTask.next')}</b><small>{agentTaskPanel.nextPlan}</small></span>
                                <span><b>{t('ai.agentTask.toolsUsed')}</b><small>{agentTaskPanel.toolsUsed.length ? agentTaskPanel.toolsUsed.join(' / ') : t('common.none')}</small></span>
                                <span><b>{t('ai.agentTask.blocked')}</b><small>{agentTaskPanel.blockedReason || t('common.no')}</small></span>
                              </div>
                              {agentTaskPanel.pendingConfirmation ? (
                                <div className="ai-agent-confirmation-strip">
                                  <b>{t('ai.agentTask.needConfirmation')}</b>
                                  <span>{agentTaskPanel.pendingConfirmation.summary}</span>
                                  <code>{agentTaskPanel.pendingConfirmation.confirmationText}</code>
                                </div>
                              ) : null}
                            </section>
                            <div className="ai-scope-info-grid agent-scope-grid">
                              {agentPanelItems.map((item) => <span key={item.label}><b>{item.label}</b><em>{item.value}</em><small>{item.detail}</small></span>)}
                            </div>
                            <section className="ai-agent-compression-card" aria-label={t('ai.agentCompression.aria')}>
                              <header>
                                <span><strong>{t('ai.agentCompression.title')}</strong><small>{activeConversation.contextCompression ? t('ai.agentCompression.compressedToMessage', { count: activeConversation.contextCompression.messageCount }) : t('ai.agentCompression.notCompressed')}</small></span>
                                <em>{formatAttachmentTokenLabel(activeConversationContextTokens, t)}</em>
                              </header>
                              <label>
                                <span>{t('ai.agentCompression.autoThreshold')}</span>
                                <input value={agentContextCompressionThreshold || defaultAgentContextCompressionThreshold} inputMode="numeric" onChange={(event) => updateAgentCompressionThreshold(event.target.value)} aria-label={t('ai.agentCompression.thresholdAria')} />
                                <small>{t('ai.agentCompression.thresholdHelp')}</small>
                              </label>
                              <div className="ai-agent-compression-actions">
                                <button type="button" className="ghost-btn small" disabled={agentContextCompressing || !activeConversationContext.trim()} onClick={() => { void compressActiveConversationContext('manual'); }}>{agentContextCompressing ? t('ai.agentCompression.compressing') : t('ai.agentCompression.compressNow')}</button>
                                <button type="button" className="ghost-btn small" disabled={!activeConversation.contextCompression?.content} onClick={() => setAgentCompressionPreviewOpen(true)}>{t('ai.agentCompression.viewContext')}</button>
                              </div>
                              {agentCompressionStatus ? <p>{agentCompressionStatus}</p> : null}
                            </section>
                            <section className="ai-agent-preset-card" aria-label={t('ai.agentPreset.aria')}>
                              <header>
                                <span><strong>{t('ai.agentPreset.title')}</strong><small>{t('ai.agentPreset.subtitle')}</small></span>
                                <em>{t('ai.agentPreset.injected')}</em>
                              </header>
                              <textarea value={agentPresetPrompt} onChange={(event) => updateAgentPresetPrompt(event.target.value)} onBlur={() => { void saveAiModePreferenceForCurrentBook(interactionMode, enabledAgentToolNames, agentContextCompressionThreshold, agentPresetPrompt); }} aria-label={t('ai.agentPreset.inputAria')} />
                              <div className="ai-agent-preset-footer">
                                <small>{t('ai.agentPreset.help')}</small>
                                <button type="button" className="ghost-btn small" onClick={resetAgentPresetPrompt}>{t('ai.agentPreset.reset')}</button>
                              </div>
                            </section>
                            <details className="ai-agent-toolbox-disclosure">
                              <summary><span>{t('ai.agentToolbox.expand')}</span><small>{t('ai.agentToolbox.enabledCount', { enabled: enabledAgentToolNames.length, total: agentToolCatalog.length })}</small></summary>
                              <div className="ai-agent-toolbox-list" aria-label={t('ai.agentToolbox.aria')}>
                                {agentToolCatalog.map((tool) => {
                                  const enabled = enabledAgentToolNames.includes(tool.name);
                                  const toolLabel = t(`ai.agentTool.${tool.name}.label` as never);
                                  const toolDescription = t(`ai.agentTool.${tool.name}.description` as never);
                                  return (
                                    <details className={enabled ? 'ai-agent-tool-card enabled' : 'ai-agent-tool-card disabled'} key={tool.name}>
                                      <summary>
                                        <span className="ai-agent-tool-title"><strong>{toolLabel}</strong><em>{tool.name}</em></span>
                                        <label className="ai-agent-tool-toggle" onClick={(event) => event.stopPropagation()}>
                                          <input type="checkbox" checked={enabled} onChange={() => toggleAgentTool(tool.name)} aria-label={t(enabled ? 'ai.agentToolbox.toolEnabledAria' : 'ai.agentToolbox.toolDisabledAria', { label: toolLabel })} />
                                          <small>{enabled ? t('ai.agentToolbox.enabled') : t('ai.agentToolbox.disabled')}</small>
                                        </label>
                                      </summary>
                                      <p>{toolDescription}</p>
                                      <div className="ai-agent-tool-samples">
                                        <span><b>{t('ai.agentToolbox.args')}</b><pre>{formatToolSample(tool.argsExample)}</pre></span>
                                        <span><b>{t('ai.agentToolbox.result')}</b><pre>{formatToolSample(tool.resultExample)}</pre></span>
                                      </div>
                                    </details>
                                  );
                                })}
                              </div>
                            </details>
                          </div>
                          <footer className="ai-scope-live-preview">{liveScopePreview}</footer>
                        </div>
                      ) : (
                        <>
                          {scopeSelectVisible ? <ThemedSelect menuPlacement="top" className="ai-scope-select" label={t('ai.scopeSelect')} value={scope} options={scopeOptions} onChange={updateScope} /> : null}
                          <div className="ai-scope-info-grid">
                            <span><b>{t('ai.scopeInfo.range')}</b><em>{scopeOptions.find((option) => option.value === scope)?.label ?? t('ai.scope.book')}</em></span>
                            <span><b>{t('ai.scopeInfo.chapter')}</b><em>{scopeRangeSummary.chapterTitle}</em></span>
                            <span><b>{t('ai.scopeInfo.page')}</b><em>{scopeRangeSummary.pageLabel}</em></span>
                            <span><b>{t('ai.scopeInfo.selection')}</b><em>{t('ai.scopeInfo.chars', { count: scopeRangeSummary.selectionChars })}</em></span>
                            <span><b>{t('ai.scopeInfo.estimate')}</b><em>{t('ai.scopeInfo.tokens', { count: scopeRangeSummary.estimatedTokens })}</em></span>
                            <span><b>{t('ai.scopeInfo.attachments')}</b><em>{t('ai.scopeInfo.items', { count: attachments.length })}</em></span>
                          </div>
                          <footer className="ai-scope-live-preview">{liveScopePreview}</footer>
                        </>
                      )}
                    </>
                  )}
                </aside>
              ) : null}
            </div>
            <div className="ai-popover-wrap">
              <button className={modePopoverOpen ? 'reader-icon-btn ai-mode-status-btn active' : 'reader-icon-btn ai-mode-status-btn'} type="button" data-tooltip={interactionMode === 'agent' ? t('ai.mode.agent.title') : t('ai.mode.qa.title')} aria-label={t('ai.mode.title')} onClick={() => toggleBottomPopover('mode')}><BookMindIcon name={interactionMode === 'agent' ? 'aiDesk' : 'aiLocal'} /></button>
              {modePopoverOpen ? (
                <aside className="ai-mode-popover floating-card-stack" aria-label={t('ai.mode.title')}>
                  <header><strong>{t('ai.mode.title')}</strong><small>{t('ai.mode.subtitle')}</small></header>
                  {aiInteractionModeOptions.map((option) => (
                    <button type="button" className={interactionMode === option.value ? 'active' : ''} onClick={() => updateAiMode(option.value)} key={option.value}>
                      <BookMindIcon name={renderAiModeOptionIcon(option.value)} />
                      <span><b>{t(option.value === 'agent' ? 'ai.mode.agent.title' : 'ai.mode.qa.title')}</b><strong>{t(option.value === 'agent' ? 'ai.mode.agent.badge' : 'ai.mode.qa.badge')}</strong><em>{t(option.value === 'agent' ? 'ai.mode.agent.description' : 'ai.mode.qa.description')}</em></span>
                    </button>
                  ))}
                  {!cloudPrivacySettings.enabled ? <p className="empty-hint">{t('ai.mode.cloudDisabledHint')}</p> : null}
                </aside>
              ) : null}
            </div>
            <div className="ai-popover-wrap">
              <button className={evidencePopoverOpen ? 'reader-icon-btn ai-evidence-btn active' : 'reader-icon-btn ai-evidence-btn'} type="button" data-tooltip={t('ai.evidence.title')} aria-label={t('ai.evidence.title')} onClick={() => toggleBottomPopover('evidence')}><BookMindIcon name="highlights" /></button>
              {evidencePopoverOpen ? (
                <aside className="ai-evidence-popover floating-card-stack" aria-label={t('ai.citations')}>
                  <header><strong>{t('ai.citations')}</strong><small>{t('ai.evidence.count', { count: citations.length })}</small></header>
                  {shouldShowCitationCoverage ? (
                    <div className={`citation-coverage coverage-${citationCoverage.level}`} role="status" aria-live="polite">
                      <span>{t('ai.citationCoverage.title')}</span>
                      <strong>{citationCoverage.percent}%</strong>
                      <em>{t('ai.citationCoverage.detail', { supported: citationCoverage.supportedClaims, total: citationCoverage.totalClaims })}</em>
                      {citationCoverage.level === 'high' ? <small>{t('ai.citationCoverage.supported')}</small> : <small>{t('ai.citationCoverage.unsupported')}</small>}
                    </div>
                  ) : null}
                  <div className="ai-citation-grid">
                    {citations.length === 0 ? <p className="empty-hint">{emptyCitationMessage}</p> : null}
                    {citations.map((citation) => (
                      <article className="ai-citation-card evidence-note citation-card" key={citation.id}>
                        <strong>[{citation.id}] {citation.label}</strong>
                        <p>{citation.text}</p>
                        <div className="action-row">
                          <button className="ghost-btn small" onClick={() => onJumpCitation(citation)}>{t('ai.jumpSource')}</button>
                          <button className="ghost-btn small" onClick={() => { void onSaveHighlight(citation); }}>{t('ai.saveHighlight')}</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </aside>
              ) : null}
            </div>
            <div className="ai-popover-wrap">
              <button className={modelPopoverOpen ? 'reader-icon-btn ai-model-btn active' : 'reader-icon-btn ai-model-btn'} type="button" data-tooltip={t('ai.model.currentTooltip', { model: currentAiModel, effort: activeReasoningEffort })} aria-label={t('ai.model.selectAria')} onClick={() => toggleBottomPopover('model')}><BookMindIcon name="aiDesk" /></button>
              {modelPopoverOpen ? (
                <aside className="ai-model-popover floating-card-stack" aria-label={t('ai.model.selectAria')}>
                  <header><strong>{t('ai.model.title')}</strong><small><span>{currentAiModel}</span><em>{activeReasoningEffort}</em>{renderReaderAiModelCapabilityIcons(currentAiModelConfig, t)}</small></header>
                  <div className="ai-model-reasoning-control">
                    <ThemedSelect label={t('ai.reasoningEffort.title')} ariaLabel={t('ai.reasoningEffort.selectAria')} value={activeReasoningEffort} options={reasoningEffortOptions} menuPlacement="bottom" onChange={(value) => setReasoningEffort(value)} />
                    <label className="ai-model-reasoning-custom">
                      <span>{t('ai.reasoningEffort.customLabel')}</span>
                      <input
                        value={reasoningEffort === 'none' ? '' : reasoningEffort}
                        maxLength={48}
                        placeholder={t('ai.reasoningEffort.customPlaceholder')}
                        aria-label={t('ai.reasoningEffort.customLabel')}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (/^[A-Za-z0-9._-]{0,48}$/.test(value)) setReasoningEffort(value);
                        }}
                        onBlur={() => setReasoningEffort(activeReasoningEffort)}
                      />
                    </label>
                  </div>
                  <div className="ai-model-filter-row">
                    <input value={modelQuery} placeholder={t('ai.model.searchPlaceholder')} onChange={(event) => setModelQuery(event.target.value)} />
                    <button type="button" className={modelFavoriteOnly ? 'active' : ''} onClick={() => setModelFavoriteOnly((value) => !value)}>{t('ai.model.favoriteOnly')}</button>
                  </div>
                  <div className="ai-model-provider-list">
                    {filteredAiModelGroups.map((group) => {
                      const expanded = modelQuery.trim() || modelFavoriteOnly || expandedProviderIds.has(group.providerId);
                      const favoriteCount = group.models.filter((model) => model.settings.favorite).length;
                      return (
                        <section key={group.providerId} className="ai-model-provider-group">
                          <button
                            type="button"
                            className="ai-model-provider-toggle"
                            onClick={() => setExpandedProviderIds((current) => {
                              const next = new Set(current);
                              if (next.has(group.providerId)) next.delete(group.providerId);
                              else next.add(group.providerId);
                              return next;
                            })}
                          >
                            <span><b>{group.providerName}</b><small>{t('ai.model.providerSummary', { count: group.models.length, favorite: favoriteCount })}</small></span>
                            <em>{expanded ? t('ai.model.collapse') : t('ai.model.expand')}</em>
                          </button>
                          {expanded ? (
                            <div className="ai-model-option-list">
                              {group.models.map((model) => (
                                <div key={`${group.providerId}:${model.id}`} className={model.id === currentAiModel ? 'ai-model-option-row active' : 'ai-model-option-row'}>
                                  <button type="button" onClick={() => { void onSelectAiModel?.(group.providerId, model.id); setModelPopoverOpen(false); }}><span>{model.label}</span>{renderReaderAiModelCapabilityIcons(model.settings, t)}</button>
                                  <button
                                    type="button"
                                    className={model.settings.favorite ? 'ai-model-favorite-btn active' : 'ai-model-favorite-btn'}
                                    aria-label={model.settings.favorite ? t('ai.model.unfavoriteAria', { model: model.label }) : t('ai.model.favoriteAria', { model: model.label })}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void onToggleAiModelFavorite?.(group.providerId, model.id);
                                    }}
                                  ><BookMindIcon name="bookmark" /></button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </section>
                      );
                    })}
                    {filteredAiModelGroups.length ? null : <p className="empty-hint">{t('ai.model.empty')}</p>}
                  </div>
                  <button type="button" className="ghost-btn small" onClick={() => { setModelPopoverOpen(false); onOpenSettings('ai-api'); }}>{t('ai.model.manage')}</button>
                </aside>
              ) : null}
            </div>
            {isGenerating ? <span className="ai-processing-pill"><i />{t('ai.status.processing')}</span> : null}
          </div>
          <div className="ai-bottom-right-tools">
            <button className={isGenerating ? 'ai-send-stop-btn processing' : 'ai-send-stop-btn'} type="button" data-tooltip={isGenerating ? t('ai.stop') : t('ai.sendShortcut')} aria-label={isGenerating ? t('ai.stop') : t('ai.send')} onClick={submitOrStopPrompt} disabled={!isGenerating && (agentContextCompressing || !canAsk || !effectivePrompt.trim() || !hasCloudConsent)}>{isGenerating ? <BookMindIcon name="stop" /> : <BookMindIcon name="aiSend" />}</button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function AiEmptyGuide({ bookReady, statusText }: { bookReady: boolean; statusText: string }) {
  const { t } = useI18n();
  const steps = [
    { id: 'import', label: t('ai.emptyGuide.import') },
    { id: 'index', label: t('ai.emptyGuide.index') },
    { id: 'ask', label: t('ai.emptyGuide.ask') },
    { id: 'capture', label: t('ai.emptyGuide.capture') },
  ];
  return (
    <div className="ai-empty-guide-illustration" role="img" aria-label={t('ai.emptyGuide.aria')}>
      <div className="ai-empty-guide-flow">
        {steps.map((step, index) => (
          <Fragment key={step.id}>
            <span className={`ai-empty-guide-step step-${step.id}${bookReady || index > 1 ? '' : ' pending'}`}>
              <i aria-hidden="true" />
              <b>{step.label}</b>
            </span>
            {index < steps.length - 1 ? <em aria-hidden="true" /> : null}
          </Fragment>
        ))}
      </div>
      <p className="ai-empty-guide-background-note">{bookReady ? t('ai.helpReady') : t('ai.helpEmpty')}<span>{statusText}</span></p>
    </div>
  );
}

function resolveReaderAiReasoningEffort(settings: AppSettings | null) {
  const profiles = settings?.aiProviderProfiles ?? [];
  const activeProfile = profiles.find((profile) => profile.id === settings?.aiActiveProviderProfileId) ?? profiles[0];
  return normalizeAiReasoningEffortForUi(activeProfile?.reasoningEffort ?? settings?.aiReasoningEffort);
}

function resolveEffectiveScope(scope: string, readerContext: AiReaderPanelProps['readerContext'], noSelectionFallbackScope: AiReaderPanelProps['noSelectionFallbackScope'] = 'chapter', allowSelectionText = true, allowCurrentPageText = true, allowCurrentChapterText = true, allowBookSummaryContext = true, t: ReturnType<typeof useI18n>['t']): AiResolvedScope {
  const chapterTitle = readerContext?.chapterTitle ?? t('ai.scope.currentChapter');
  if (scope === 'selection') {
    if (scope === 'selection' && !allowSelectionText) return resolveNoSelectionFallbackScope(noSelectionFallbackScope, readerContext, chapterTitle, allowCurrentPageText, allowCurrentChapterText, allowBookSummaryContext, t);
    const selectedText = readerContext?.selectionText ?? '';
    if (selectedText.trim()) return { scope: 'selection', text: selectedText, label: t('ai.scopeLabel.selection', { count: selectedText.length }) };
    return resolveNoSelectionFallbackScope(noSelectionFallbackScope, readerContext, chapterTitle, allowCurrentPageText, allowCurrentChapterText, allowBookSummaryContext, t);
  }
  if ((scope === 'page' || scope === 'page-lite') && !allowCurrentPageText) return resolveNoSelectionFallbackScope(noSelectionFallbackScope, readerContext, chapterTitle, allowCurrentPageText, allowCurrentChapterText, allowBookSummaryContext, t);
  if (scope === 'page-lite') {
    return { scope: 'page-lite', text: [chapterTitle, readerContext?.pageText].filter(Boolean).join('\n'), label: t('ai.scopeLabel.pageLite', { chapter: chapterTitle }) };
  }
  if (scope === 'page') return { scope, text: readerContext?.pageText, label: t('ai.scopeLabel.page', { chapter: chapterTitle }) };
  if ((scope === 'chapter' || scope === 'volume') && !allowCurrentChapterText) return resolveNoSelectionFallbackScope(noSelectionFallbackScope, readerContext, chapterTitle, allowCurrentPageText, allowCurrentChapterText, allowBookSummaryContext, t);
  if (scope === 'chapter') return { scope, text: readerContext?.chapterText, label: chapterTitle };
  if (scope === 'volume') return { scope, text: readerContext?.chapterText, label: t('ai.scopeLabel.volume', { chapter: chapterTitle }) };
  if ((scope === 'book' || scope === 'annotations' || scope === 'library') && !allowBookSummaryContext) return resolveBookSummaryContextFallbackScope('selection', t);
  return { scope, text: undefined, label: scope };
}

function resolveTokenBoundedScope(effectiveScope: AiResolvedScope, requestedScope: string, readerContext: AiReaderPanelProps['readerContext'], scopeTokenPolicy: AiReaderPanelProps['scopeTokenPolicy'], modelContextWindowTokens: number, permissions: { allowCurrentPageText: boolean; allowCurrentChapterText: boolean }, t: ReturnType<typeof useI18n>['t']): AiResolvedScope {
  const maxTokens = Math.max(1, modelContextWindowTokens || parseTokenLimit(scopeTokenPolicy.maxTokens));
  if (!scopeTokenPolicy.autoDowngrade || estimateScopeTokens(effectiveScope.text) <= maxTokens) return effectiveScope;
  const chapterTitle = readerContext?.chapterTitle ?? t('ai.scope.currentChapter');
  const pageLiteTextLimit = Math.max(1, maxTokens - estimateScopeTokens(chapterTitle) - 1);
  if ((requestedScope === 'chapter' || requestedScope === 'volume' || effectiveScope.scope === 'chapter' || effectiveScope.scope === 'volume') && permissions.allowCurrentPageText && readerContext?.pageText?.trim()) {
    const pageScope = { scope: 'page', text: readerContext.pageText, label: t('ai.scopeLabel.downgradedPage', { chapter: chapterTitle, tokens: maxTokens }) };
    if (estimateScopeTokens(pageScope.text) <= maxTokens) return pageScope;
    return { scope: 'page-lite', text: buildPageLiteText(chapterTitle, fitTextToTokenLimit(readerContext.pageText, pageLiteTextLimit)), label: t('ai.scopeLabel.downgradedPageLite', { chapter: chapterTitle, tokens: maxTokens }) };
  }
  if ((requestedScope === 'page' || effectiveScope.scope === 'page') && permissions.allowCurrentPageText && readerContext?.pageText?.trim()) {
    return { scope: 'page-lite', text: buildPageLiteText(chapterTitle, fitTextToTokenLimit(readerContext.pageText, pageLiteTextLimit)), label: t('ai.scopeLabel.downgradedPageLite', { chapter: chapterTitle, tokens: maxTokens }) };
  }
  return resolveTokenOverflowRestrictedScope(effectiveScope, maxTokens, t);
}

function estimateScopeTokens(text?: string) {
  const value = text ?? '';
  const cjkChars = value.match(/[\u3400-\u9fff\u3040-\u30ff\uff00-\uffef]/g)?.length ?? 0;
  const otherChars = Math.max(0, value.length - cjkChars);
  return Math.ceil(cjkChars + otherChars / 2.6);
}

function fitTextToTokenLimit(text: string, maxTokens: number) {
  if (estimateScopeTokens(text) <= maxTokens) return text;
  let next = text.slice(0, Math.max(1, Math.min(text.length, maxTokens)));
  while (next.length > 0 && estimateScopeTokens(next) > maxTokens) {
    next = next.slice(0, Math.floor(next.length * 0.8));
  }
  return next.trimEnd();
}

function buildPageLiteText(chapterTitle: string, pageText: string) {
  return [chapterTitle, pageText].filter(Boolean).join('\n');
}

function resolveTokenOverflowRestrictedScope(effectiveScope: AiResolvedScope, maxTokens: number, t: ReturnType<typeof useI18n>['t']): AiResolvedScope {
  return { scope: 'restricted', text: undefined, label: t('ai.scopeLabel.restricted', { scope: effectiveScope.label, tokens: maxTokens }) };
}

function parseTokenLimit(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 4000;
  return Math.min(200000, Math.max(200, parsed));
}

function parseRenderedBlockLimit(value?: string) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return 120;
  return Math.min(500, Math.max(20, parsed));
}

function formatToolSample(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function resolveAttachmentTokenEstimate(id: AiAttachmentOptionId, context: {
  book: Book | null;
  readerContext?: AiReaderPanelProps['readerContext'];
  citations: Citation[];
  availableBooks: Book[];
  readerChapters: ReaderChapter[];
  readerHighlights: ReaderHighlight[];
  readerBookmarks: ReaderBookmark[];
  summaryPrompt: string;
}): number | null {
  if (id === 'chapter') return estimateAttachmentTextTokens(context.readerContext?.chapterText);
  if (id === 'page') return estimateAttachmentTextTokens(context.readerContext?.pageText);
  if (id === 'book') return estimateBookTextTokens(context.book, context.readerChapters);
  if (id === 'summary') return estimateAttachmentTextTokens([
    context.summaryPrompt,
    context.readerContext?.chapterTitle,
    context.readerContext?.chapterText,
  ].filter(Boolean).join('\n'));
  if (id === 'highlight') return estimateAttachmentTextTokens(formatHighlightsForTokenEstimate(context.readerHighlights, context.citations));
  if (id === 'bookmark') return estimateAttachmentTextTokens(formatBookmarksForTokenEstimate(context.readerBookmarks));
  if (id === 'library') return estimateAttachmentTextTokens(formatLibraryForTokenEstimate(context.availableBooks));
  return null;
}

function buildAttachmentPreviewMaterial(id: AiAttachmentOptionId, context: {
  book: Book | null;
  readerContext?: AiReaderPanelProps['readerContext'];
  citations: Citation[];
  availableBooks: Book[];
  readerChapters: ReaderChapter[];
  readerHighlights: ReaderHighlight[];
  readerBookmarks: ReaderBookmark[];
  summaryPrompt: string;
  emptyText: string;
}): AiAttachmentPreviewMaterial {
  const fullText = resolveAttachmentPreviewText(id, context).trim() || context.emptyText;
  const totalChars = fullText.length;
  const truncated = totalChars > ATTACHMENT_PREVIEW_CHAR_LIMIT;
  return {
    text: truncated ? fullText.slice(0, ATTACHMENT_PREVIEW_CHAR_LIMIT) : fullText,
    totalChars,
    truncated,
  };
}

function resolveAttachmentPreviewText(id: AiAttachmentOptionId, context: {
  book: Book | null;
  readerContext?: AiReaderPanelProps['readerContext'];
  citations: Citation[];
  availableBooks: Book[];
  readerChapters: ReaderChapter[];
  readerHighlights: ReaderHighlight[];
  readerBookmarks: ReaderBookmark[];
  summaryPrompt: string;
}) {
  if (id === 'chapter') return [context.readerContext?.chapterTitle, context.readerContext?.chapterText].filter(Boolean).join('\n\n');
  if (id === 'page') return context.readerContext?.pageText ?? '';
  if (id === 'book') return getBookAttachmentText(context.book, context.readerChapters);
  if (id === 'summary') return [context.summaryPrompt, context.readerContext?.chapterTitle, context.readerContext?.chapterText].filter(Boolean).join('\n\n');
  if (id === 'highlight') return formatHighlightsForTokenEstimate(context.readerHighlights, context.citations);
  if (id === 'bookmark') return formatBookmarksForTokenEstimate(context.readerBookmarks);
  if (id === 'library') return formatLibraryForTokenEstimate(context.availableBooks);
  return '';
}

function estimateAttachmentTextTokens(text?: string) {
  const length = text?.trim().length ?? 0;
  return Math.ceil(length / 2.6);
}

function estimateBookTextTokens(book: Book | null, chapters: ReaderChapter[]) {
  const chapterLength = chapters.reduce((total, chapter) => total + chapter.title.length + chapter.paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0), 0);
  if (chapterLength) return Math.ceil(chapterLength / 2.6);
  if (!book) return 0;
  const contentLength = book.content?.trim().length ?? 0;
  if (contentLength) return Math.ceil(contentLength / 2.6);
  const chunkLength = book.chunks?.reduce((total, chunk) => total + (chunk.text?.trim().length ?? 0), 0) ?? 0;
  return Math.ceil(chunkLength / 2.6);
}

function getBookAttachmentText(book: Book | null, chapters: ReaderChapter[]) {
  const chapterText = getReaderChaptersAttachmentText(chapters);
  if (chapterText) return chapterText;
  if (!book) return '';
  const content = book.content?.trim();
  if (content) return content;
  return book.chunks?.map((chunk) => chunk.text).filter(Boolean).join('\n\n') ?? '';
}

function getReaderChaptersAttachmentText(chapters: ReaderChapter[]) {
  return chapters.map((chapter) => [chapter.title, ...chapter.paragraphs].filter(Boolean).join('\n')).filter(Boolean).join('\n\n');
}

function formatHighlightsForTokenEstimate(highlights: ReaderHighlight[], citations: Citation[]) {
  if (highlights.length) {
    return highlights.map((highlight) => [
      highlight.text,
      highlight.note,
      highlight.tags?.join(' '),
      highlight.colorMeaning,
    ].filter(Boolean).join('\n')).join('\n\n');
  }
  return citations.map((citation) => citation.text).filter(Boolean).join('\n');
}

function formatBookmarksForTokenEstimate(bookmarks: ReaderBookmark[]) {
  return bookmarks.map((bookmark) => [
    bookmark.title,
    bookmark.label,
    bookmark.note,
    bookmark.tags?.join(' '),
  ].filter(Boolean).join('\n')).join('\n\n');
}

function formatLibraryForTokenEstimate(books: Book[]) {
  return books.map((item) => [
    item.displayTitle || item.title,
    item.author,
    item.format,
    item.status,
  ].filter(Boolean).join(' · ')).join('\n');
}

function formatAttachmentTokenLabel(tokens: number | null, t: ReturnType<typeof useI18n>['t']) {
  if (tokens === null) return t('ai.token.unloaded');
  if (tokens >= 1000000) return t('ai.token.value', { count: `${formatCompactTokenCount(tokens / 1000000)}m` });
  if (tokens >= 1000) return t('ai.token.value', { count: `${formatCompactTokenCount(tokens / 1000)}k` });
  return t('ai.token.value', { count: tokens });
}

function formatCompactTokenCount(value: number) {
  return value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, '');
}

function isAiScope(value: string): value is AiReaderPanelProps['defaultAiScope'] {
  return value === 'selection' || value === 'page-lite' || value === 'page' || value === 'chapter' || value === 'volume' || value === 'book' || value === 'annotations' || value === 'library';
}

function resolveAiRequestedScope(input: { scopePriorityStrategy: AiReaderPanelProps['scopePriorityStrategy']; promptScopeOverride?: string; commandScope?: AiReaderPanelProps['defaultAiScope']; panelScope: AiReaderPanelProps['defaultAiScope'] }) {
  if (input.promptScopeOverride && isAiScope(input.promptScopeOverride)) return input.promptScopeOverride;
  if (!input.commandScope) return input.panelScope;
  if (input.scopePriorityStrategy === 'panel-first') return input.panelScope;
  if (input.scopePriorityStrategy === 'narrowest-first') return getNarrowestAiScope(input.commandScope, input.panelScope);
  return input.commandScope;
}

function getNarrowestAiScope(left: AiReaderPanelProps['defaultAiScope'], right: AiReaderPanelProps['defaultAiScope']) {
  const scopeWeight: Record<AiReaderPanelProps['defaultAiScope'], number> = {
    selection: 1,
    'page-lite': 2,
    page: 3,
    chapter: 4,
    volume: 5,
    annotations: 6,
    book: 7,
    library: 8,
  };
  return scopeWeight[left] <= scopeWeight[right] ? left : right;
}

function createAiConversationId() {
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const AGENT_PRESET_CONTEXT_MARKER = '【Agent 预设提示词】';

function formatAiConversationContext(conversation: AiConversation, agentPresetPrompt = '') {
  const maxMessages = 16;
  const maxChars = 12000;
  const compression = conversation.contextCompression;
  const messages = compression ? conversation.messages.slice(compression.messageCount) : conversation.messages;
  const parts = messages
    .slice(-maxMessages)
    .map((message, index) => {
      const role = message.role === 'user' ? '用户' : message.role === 'assistant' ? 'AI' : message.role;
      const content = message.content.replace(/\s+/g, ' ').trim();
      if (!content) return '';
      return `${index + 1}. ${role}：${content}`;
    })
    .filter(Boolean);
  const compressedHeader = compression?.content.trim()
    ? [
        '【已压缩的早期对话上下文】',
        `压缩时间：${compression.compressedAt}`,
        `覆盖消息：前 ${compression.messageCount} 条`,
        stripAgentPresetContext(compression.content.trim()),
      ].join('\n')
    : '';
  const preset = agentPresetPrompt.trim()
    ? `${AGENT_PRESET_CONTEXT_MARKER}\n${agentPresetPrompt.trim()}`
    : '';
  const body = [compressedHeader, parts.length ? '【压缩点之后的新对话】\n' + parts.join('\n') : ''].filter(Boolean).join('\n\n');
  const text = [preset, body].filter(Boolean).join('\n\n');
  if (text.length <= maxChars) return text;
  if (!preset) return `...已截断更早的对话...\n${text.slice(-maxChars)}`;
  const availableBodyChars = Math.max(0, maxChars - preset.length - 40);
  return `${preset}\n\n...已截断更早的对话...\n${body.slice(-availableBodyChars)}`;
}

function stripAgentPresetContext(value: string) {
  const text = value.trim();
  if (!text) return '';
  const markerIndex = text.indexOf(AGENT_PRESET_CONTEXT_MARKER);
  if (markerIndex < 0) return text;
  const afterMarker = text.slice(markerIndex + AGENT_PRESET_CONTEXT_MARKER.length);
  const nextSectionIndex = afterMarker.search(/\n\s*【/u);
  const withoutPreset = nextSectionIndex >= 0
    ? `${text.slice(0, markerIndex)}${afterMarker.slice(nextSectionIndex)}`
    : text.slice(0, markerIndex);
  return withoutPreset.trim();
}

function buildAiContextCompressionInstruction(input: { thresholdTokens: number; sourceTokens: number }) {
  return [
    '你是 BookMind 阅读研究台的对话上下文压缩器。你的任务是把旧对话压缩为后续 Agent 可直接继续工作的上下文记忆。',
    '只根据输入的对话历史压缩，不要添加外部知识，不要推测缺失事实，不要美化，不要生成新的阅读分析。',
    '必须保留：',
    '1. 用户当前目标、明确要求、否定要求和偏好。',
    '2. 已经做过的关键操作、设置变更、工具调用结论、失败原因。',
    '3. 当前书籍、章节、人物、线索、引用编号、路径、设置键名、阈值等可继续执行任务的信息。',
    '4. 未完成任务、待验证风险、用户不满意点、下一步计划。',
    '5. 对后续 Agent 的约束：工具结果不能表述为用户发送的上下文；不确定处必须标记不确定。',
    '必须删除：寒暄、重复确认、已经被后续内容推翻的旧结论、无效中间输出、冗余长 JSON，只保留必要摘要。',
    `当前原始上下文估算约 ${input.sourceTokens} tokens，自动压缩阈值 ${input.thresholdTokens} tokens。目标是尽量压到原始的 20%-35%，但不得丢失关键约束。`,
    '只输出 JSON，不要 Markdown，不要代码块，不要解释。',
    'JSON 格式：',
    '{"summary":"一段可直接给后续 Agent 使用的压缩上下文","memory":{"userGoals":[],"stablePreferences":[],"bookState":[],"agentState":[],"toolFindings":[],"openTasks":[],"constraints":[],"risks":[]},"carryForwardPrompt":"给后续 Agent 的继续执行提示"}',
  ].join('\n');
}

function parseAiContextCompressionResponse(raw: string) {
  const parsed = parseFirstJsonObject(raw);
  if (!parsed) return raw.trim().slice(0, 16000);
  const memory = parsed.memory && typeof parsed.memory === 'object' ? parsed.memory as Record<string, unknown> : {};
  const lines = [
    `摘要：${stringFromJsonValue(parsed.summary)}`,
    formatCompressionMemoryList('用户目标', memory.userGoals),
    formatCompressionMemoryList('稳定偏好', memory.stablePreferences),
    formatCompressionMemoryList('书籍/阅读状态', memory.bookState),
    formatCompressionMemoryList('Agent 状态', memory.agentState),
    formatCompressionMemoryList('工具发现', memory.toolFindings),
    formatCompressionMemoryList('未完成任务', memory.openTasks),
    formatCompressionMemoryList('约束', memory.constraints),
    formatCompressionMemoryList('风险/不确定', memory.risks),
    `继续执行提示：${stringFromJsonValue(parsed.carryForwardPrompt)}`,
  ].filter((line) => line.trim() && !line.endsWith('：'));
  return lines.join('\n').slice(0, 16000);
}

function parseFirstJsonObject(raw: string): Record<string, unknown> | null {
  const candidates = [
    raw.trim(),
    ...[...raw.matchAll(/```\s*(?:json)?\s*([\s\S]*?)```/giu)].map((match) => match[1].trim()),
  ];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

function formatCompressionMemoryList(label: string, value: unknown) {
  if (!Array.isArray(value)) return '';
  const items = value.map(stringFromJsonValue).filter(Boolean);
  if (!items.length) return '';
  return `${label}：\n${items.map((item) => `- ${item}`).join('\n')}`;
}

function stringFromJsonValue(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

function estimateAiTextTokens(text: string) {
  return Math.ceil(text.length / 2.6);
}

function resolveDefaultAgentContextCompressionThreshold(contextWindow: number) {
  return String(Math.max(0, Math.round(contextWindow - AGENT_CONTEXT_COMPRESSION_RESERVE_TOKENS)));
}

function parseAgentContextCompressionThreshold(value: string, fallback = 64000) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return Math.min(2_000_000, Math.max(0, fallback));
  return Math.min(2_000_000, Math.max(0, parsed));
}

function parseAgentContextCompressionThresholdPreference(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const raw = (value as Record<string, unknown>).agentContextCompressionThreshold;
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  return String(parseAgentContextCompressionThreshold(String(raw)));
}

function resolveNoSelectionFallbackScope(noSelectionFallbackScope: AiReaderPanelProps['noSelectionFallbackScope'], readerContext: AiReaderPanelProps['readerContext'], chapterTitle: string, allowCurrentPageText = true, allowCurrentChapterText = true, allowBookSummaryContext = true, t: ReturnType<typeof useI18n>['t']) {
  if (noSelectionFallbackScope === 'page' && allowCurrentPageText) return { scope: 'page', text: readerContext?.pageText, label: t('ai.scopeLabel.selectionFallbackPage', { chapter: chapterTitle }) };
  if (noSelectionFallbackScope === 'chapter' && allowCurrentChapterText) return { scope: 'chapter', text: readerContext?.chapterText, label: t('ai.scopeLabel.selectionFallbackChapter', { chapter: chapterTitle }) };
  if (noSelectionFallbackScope === 'book' && allowBookSummaryContext) return { scope: 'book', text: undefined, label: t('ai.scopeLabel.selectionFallbackBook') };
  if (allowCurrentPageText) return { scope: 'page', text: readerContext?.pageText, label: t('ai.scopeLabel.selectionFallbackPage', { chapter: chapterTitle }) };
  if (allowCurrentChapterText) return { scope: 'chapter', text: readerContext?.chapterText, label: t('ai.scopeLabel.selectionFallbackChapter', { chapter: chapterTitle }) };
  if (allowBookSummaryContext) return { scope: 'book', text: undefined, label: t('ai.scopeLabel.selectionFallbackBook') };
  return resolveBookSummaryContextFallbackScope('selection', t);
}

function resolveBookSummaryContextFallbackScope(scope: string, t: ReturnType<typeof useI18n>['t']) {
  return { scope: 'restricted', text: undefined, label: t('ai.scopeLabel.bookContextDisabled', { scope }) };
}

function parsePromptModifiers(prompt: string) {
  const scopeAliases: Record<string, string> = {
    当前章: 'chapter',
    本章: 'chapter',
    chapter: 'chapter',
    当前页: 'page',
    本页: 'page',
    page: 'page',
    轻量页: 'page-lite',
    pageLite: 'page-lite',
    selection: 'selection',
    选区: 'selection',
    当前卷: 'volume',
    本卷: 'volume',
    volume: 'volume',
    全书: 'book',
    book: 'book',
    标注: 'annotations',
    annotations: 'annotations',
    书库: 'library',
    library: 'library',
  };
  const modifiers: string[] = [];
  let scopeOverride: string | undefined;
  const text = prompt
    .split(/\s+/)
    .filter((part) => {
      if (!part) return false;
      if (part.startsWith('@')) {
        const rawScope = part.slice(1);
        modifiers.push(part);
        scopeOverride = scopeAliases[rawScope] ?? scopeOverride;
        return false;
      }
      if (part.startsWith('#')) {
        modifiers.push(part);
        return false;
      }
      return true;
    })
    .join(' ')
    .trim();
  return { text, modifiers, scopeOverride };
}

function buildRetrievalQuery(value: string, mode: AiReaderPanelProps['retrievalDefaults']['queryRewriteMode'], commandId?: SlashCommand['id']) {
  if (mode === 'off') return value;
  const rewritten = rewriteRetrievalQueryTerms(value, commandId);
  return rewritten || value;
}

function rewriteRetrievalQueryTerms(value: string, commandId?: SlashCommand['id']) {
  const commandHints: Record<string, string[]> = {
    summary: ['总结', '概括', '章节'],
    characters: ['人物', '角色', '关系', '身份'],
    foreshadow: ['伏笔', '线索', '异常', '意象'],
    timeline: ['时间', '事件', '顺序', '时间线'],
    cards: ['知识点', '闪卡', '记忆', '要点'],
  };
  const stopWords = new Set([
    '请', '帮我', '帮忙', '给我', '一下', '当前', '本章', '章节', '这章', '本文', '文本',
    '总结', '概括', '梳理', '生成', '说明', '分析', '回答', '输出', '列出', '提取',
    '引用', '依据', '证据', '基于', '范围', '内容', '信息', '主要', '关键',
    'please', 'summarize', 'summary', 'analyze', 'extract', 'generate', 'explain',
    'with', 'from', 'this', 'that', 'chapter', 'page', 'selection', 'book',
  ]);
  const source = value
    .replace(/(^|\s)@\S+/g, ' ')
    .replace(/(^|\s)#\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const terms = source
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term && term.length >= 2 && !stopWords.has(term.toLocaleLowerCase()));
  const seededTerms = commandId ? [...(commandHints[commandId] ?? []), ...terms] : terms;
  return Array.from(new Set(seededTerms)).slice(0, 10).join(' ').trim();
}

function matchSlashCommand(command: SlashCommand, query: string) {
  if (!query) return true;
  const haystack = [command.label, command.prompt, command.id, ...command.aliases]
    .join(' ')
    .toLocaleLowerCase();
  if (haystack.includes(query)) return true;
  let cursor = 0;
  for (const char of haystack) {
    if (char === query[cursor]) cursor += 1;
    if (cursor === query.length) return true;
  }
  return false;
}

function isSlashCommandEnabled(command: SlashCommand, enabled: AiReaderPanelProps['builtInSlashCommandEnabled']) {
  if (!isBuiltInSlashCommandId(command.id)) return true;
  return enabled[command.id] !== false;
}

function isBuiltInSlashCommandId(id: SlashCommand['id']): id is BuiltInSlashCommandId {
  return id === 'summary' || id === 'characters' || id === 'foreshadow' || id === 'timeline' || id === 'cards';
}

function buildReaderAiModelGroups(settings?: AppSettings | null): ReaderAiModelGroup[] {
  const profiles = settings?.aiProviderProfiles?.length ? settings.aiProviderProfiles : [{
    id: 'default-provider',
    name: '默认 Provider',
    kind: 'openai' as const,
    apiBaseUrl: settings?.aiApiBaseUrl ?? 'https://api.openai.com/v1',
    endpointMode: settings?.aiEndpointMode ?? 'responses',
    model: settings?.aiModel ?? 'gpt-4.1-mini',
    models: [settings?.aiModel ?? 'gpt-4.1-mini'],
  }];
  return profiles.map((profile) => {
    const seen = new Set<string>();
    const models = [profile.model, ...(profile.models ?? [])]
      .map((model) => model.trim())
      .filter((model) => {
        if (!model || seen.has(model)) return false;
        seen.add(model);
        return true;
      })
      .map((model) => {
        const settingsForModel = getAiProviderModelConfig(profile, model);
        return {
          id: model,
          label: settingsForModel.displayName || model,
          settings: settingsForModel,
        };
      });
    return {
      providerId: profile.id,
      providerName: profile.name,
      models,
    };
  }).filter((group) => group.models.length);
}

function filterReaderAiModelGroups(groups: ReaderAiModelGroup[], query: string, favoritesOnly: boolean): ReaderAiModelGroup[] {
  const normalizedQuery = query.trim().toLowerCase();
  return groups.map((group) => {
    const providerMatches = !normalizedQuery || group.providerName.toLowerCase().includes(normalizedQuery);
    const models = group.models.filter((model) => {
      if (favoritesOnly && !model.settings.favorite) return false;
      if (providerMatches) return true;
      return model.id.toLowerCase().includes(normalizedQuery) || model.label.toLowerCase().includes(normalizedQuery);
    });
    return { ...group, models };
  }).filter((group) => group.models.length);
}

function createReaderCapabilityPanelTitle(interactionMode: AiInteractionMode, t: Translator) {
  if (interactionMode === 'agent') {
    return {
      title: t('ai.agentToolbox.title'),
      subtitle: t('ai.agentToolbox.subtitle'),
      tooltip: t('ai.agentToolbox.tooltip'),
    };
  }
  return {
    title: t('ai.scopePanel.title'),
    subtitle: t('ai.scopePanel.subtitle'),
    tooltip: t('ai.scopePanel.tooltip'),
  };
}

function renderAiModeOptionIcon(mode: AiInteractionMode): BookMindIconName {
  return mode === 'agent' ? 'aiDesk' : 'aiLocal';
}

function resolveCurrentAiModelConfig(settings: AppSettings | null | undefined, model: string) {
  const activeProfile = settings?.aiProviderProfiles?.find((profile) => profile.id === settings.aiActiveProviderProfileId)
    ?? settings?.aiProviderProfiles?.find((profile) => profile.model === model || profile.models?.includes(model))
    ?? settings?.aiProviderProfiles?.[0];
  return activeProfile ? getAiProviderModelConfig(activeProfile, model) : getAiProviderModelConfig({
    id: 'default-provider',
    name: '默认 Provider',
    kind: 'openai',
    apiBaseUrl: settings?.aiApiBaseUrl ?? 'https://api.openai.com/v1',
    endpointMode: settings?.aiEndpointMode ?? 'responses',
    model,
    models: [model],
  }, model);
}

function resolveCurrentAiModelContextWindow(settings: AppSettings | null | undefined, model: string) {
  return resolveCurrentAiModelConfig(settings, model).contextWindowTokens;
}

function renderReaderAiModelCapabilityIcons(model: AiProviderModelSettings, t: Translator) {
  const capabilityItems = [
    model.capabilities.vision ? { key: 'vision', label: t('settings.aiPanel.modelCapability.vision'), icon: 'readerSearch' as BookMindIconName } : null,
    model.capabilities.reasoning ? { key: 'reasoning', label: t('settings.aiPanel.modelCapability.reasoning'), icon: 'aiDesk' as BookMindIconName } : null,
    model.capabilities.toolUse ? { key: 'toolUse', label: t('settings.aiPanel.modelCapability.toolUse'), icon: 'wrench' as BookMindIconName } : null,
    model.favorite ? { key: 'favorite', label: t('settings.aiPanel.modelCapability.favorite'), icon: 'bookmark' as BookMindIconName } : null,
  ].filter((item): item is { key: string; label: string; icon: BookMindIconName } => Boolean(item));
  if (!capabilityItems.length) return null;
  return (
    <span className="ai-model-capability-icons" aria-label={t('settings.aiPanel.modelCapability.aria')}>
      {capabilityItems.map((item) => <span key={item.key} title={item.label} aria-label={item.label}><BookMindIcon name={item.icon} /></span>)}
    </span>
  );
}

function parseSlashCommandLimit(value: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toAiCustomSlashCommandDraft(command: SlashCommand): AiCustomSlashCommandDraft {
  return {
    id: command.id as `custom-${string}`,
    label: command.label,
    prompt: command.prompt,
    aliases: command.aliases,
    scopeHint: command.scopeHint,
    outputHint: command.outputHint,
    retrievalStrategy: 'scope-first',
  };
}

function formatQuestionTimelineTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function SlashCommandPreview({ command }: { command: SlashCommand }) {
  return (
    <span className="ai-slash-preview">
      <small>Prompt</small>
      <span>{command.prompt}</span>
      <small>Scope</small>
      <span>{command.scopeHint}</span>
      <small>Output</small>
      <span>{command.outputHint}</span>
    </span>
  );
}

function SlashCommandDetailPopover({ command, onClose, t }: { command: SlashCommand; onClose: () => void; t: Translator }) {
  return (
    <aside className="ai-slash-detail-popover" role="dialog" aria-label={t('ai.command.detailAria', { command: command.label })}>
      <header>
        <strong>/{command.label}</strong>
        <button type="button" onClick={onClose} aria-label={t('ai.command.closeDetail')}>×</button>
      </header>
      <dl>
        <dt>Prompt</dt>
        <dd>{command.prompt}</dd>
        <dt>Scope</dt>
        <dd>{command.scopeHint}</dd>
        <dt>Output</dt>
        <dd>{command.outputHint}</dd>
        <dt>Aliases</dt>
        <dd>{command.aliases.join(' / ')}</dd>
      </dl>
    </aside>
  );
}

function collectStructuredClaimCoverage(blocks: AiResponseBlock[]) {
  const claims = blocks.flatMap((block) => {
    if (block.type === 'chapter_summary' && Array.isArray(block.bullets)) return block.bullets.map((item) => (item as Record<string, unknown>)?.citationIds);
    if (block.type === 'timeline' && Array.isArray(block.events)) return block.events.map((item) => (item as Record<string, unknown>)?.citationIds);
    if (block.type === 'flashcards' && Array.isArray(block.cards)) return block.cards.map((item) => (item as Record<string, unknown>)?.citationIds);
    if (block.type === 'table' && Array.isArray(block.rows)) return block.rows.map((item) => (item as Record<string, unknown>)?.citationIds);
    return [block.citationIds];
  });
  const totalClaims = Math.max(1, claims.length);
  const supportedClaims = claims.filter((citationIds) => Array.isArray(citationIds) && citationIds.length > 0).length;
  return { totalClaims, supportedClaims };
}

function filterStructuredAnswerCitations(response: BookMindAiStructuredResponse, minConfidenceSetting: string): BookMindAiStructuredResponse {
  const minConfidence = parseBoundedConfidence(minConfidenceSetting);
  const citations = response.citations.filter((citation) => shouldKeepProtocolCitation(citation, minConfidence));
  const keptIds = new Set(citations.map((citation) => citation.id));
  return {
    ...response,
    citations,
    blocks: response.blocks.map((block) => filterBlockCitationIds(block, keptIds)),
  };
}

function filterBlockCitationIds(block: AiResponseBlock, keptIds: Set<string>): AiResponseBlock {
  if (!Array.isArray(block.citationIds)) return block;
  return { ...block, citationIds: block.citationIds.filter((id) => keptIds.has(id)) };
}

function shouldKeepProtocolCitation(citation: AiProtocolCitation, minConfidence: number) {
  const confidence = typeof citation.confidence === 'number'
    ? citation.confidence
    : typeof citation.score === 'number' && citation.score >= 0 && citation.score <= 1
      ? citation.score
      : undefined;
  if (typeof confidence !== 'number') return true;
  return confidence >= minConfidence;
}

function parseBoundedConfidence(value: string) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0.25;
  return Math.min(1, Math.max(0, parsed));
}
