export type Book = {
  id: string;
  title: string;
  displayTitle: string;
  author: string;
  format: string;
  status: string;
  progress: number;
  fileName: string;
  filePath: string;
  sourceFilePath?: string;
  coverLabel: string;
  coverTone: 'amber' | 'indigo' | 'sage' | 'violet' | 'cinnabar';
  coverImagePath?: string;
  deleted: boolean;
  deletedAt: string;
  contentHash: string;
  importedAt: string;
  lastOpenedAt?: string;
  shelfGroups: string[];
  sourceKind?: string;
  networkSource?: BookNetworkSource;
  content: string;
  chunks: TextChunk[];
};

export type TextChunk = {
  id: string;
  bookId: string;
  bookTitle: string;
  chapter: string;
  ordinal: number;
  text: string;
  chapterIndex?: number;
  chapterTitle?: string;
  paragraphStart?: number;
  paragraphEnd?: number;
  charStart?: number;
  charEnd?: number;
  contentHash?: string;
  chunkStrategyVersion?: number;
  createdAt?: string;
};

export type BookNetworkSource = { sourceId: string; sourceName: string; bookUrl: string; tocUrl: string; latestChapter: string; cachedChapterCount: number; preloadedChapterCount: number; tocCount: number; addedAt: string };
export type BookSourceSearchResult = { sourceId: string; sourceName: string; name: string; author: string; bookUrl: string; coverUrl: string; latestChapter: string; intro: string; alternatives?: BookSourceSearchResult[] };
export type BookSourceEditPayload = { id: string; name: string; group: string; baseUrl: string; enabled: boolean; sourceType: number; searchUrl: string; exploreUrl: string; bookUrlPattern: string; rawJson: string };
export type NetworkBookManifestPayload = { bookId: string; title: string; author: string; sourceId: string; sourceName: string; bookUrl: string; tocUrl: string; coverUrl: string; latestChapter: string; tocCount: number; cachedChapterCount: number; toc: Array<{ index: number; title: string; url: string; cached: boolean; cachedAt: string }> };
export type NetworkBookChapterPayload = { bookId: string; chapterIndex: number; title: string; url: string; content: string; media: { kind: 'text' | 'image' | 'comic' | 'audio' | 'pdf'; urls: string[] }; cached: boolean; cachedChapterCount: number; tocCount: number };


export type Citation = {
  id: number;
  label: string;
  text: string;
  targetId: string;
  bookId?: string;
  chapterId?: string;
  chapterIndex?: number;
  sourceChapterIndex?: number;
  visibleChapterPosition?: number;
  paragraphIndex?: number;
  startOffset?: number;
  endOffset?: number;
  chunkId?: string;
  confidence?: number;
  failureReason?: string;
};

export type AiResponse = {
  answer: string;
  citations: Citation[];
  diagnostics?: AiDiagnostics;
};

export type SemanticCapabilityNotice = {
  status: 'unavailable';
  title: string;
  detail: string;
  action: string;
};

export type AiDiagnostics = {
  scope?: string;
  queryUsed?: string;
  chunkCount?: number;
  ftsAvailable?: boolean;
  scopeEmpty?: boolean;
  resultCount?: number;
  fallbackUsed?: boolean;
  errorKind?: string;
  cloudErrorMessage?: string;
  agentTokensUsed?: number;
  agentTokenBudget?: number;
  agentToolSteps?: number;
  agentToolIterationCount?: number;
  agentToolsUsed?: string[];
  agentNextPlan?: string;
  agentTaskGoal?: string;
  agentTaskCompleted?: string[];
  agentTaskBlockedReason?: string;
  agentPendingConfirmation?: {
    tool: string;
    summary: string;
    confirmationText: string;
  };
  agentLocalResultCount?: number;
  agentDurationMs?: number;
  indexStatus?: BookIndexManifest['status'];
  staleReason?: string;
  semanticCapabilityNotice?: SemanticCapabilityNotice | null;
  recommendations?: string[];
};

export type AiAskRequest = {
  scope: string;
  instruction: string;
  userText: string;
  selectedCommandId?: string;
  retrievalStrategy?: string;
  retrievalQuery?: string;
  multiStageRetrievalMode?: string;
  localResultLimit?: string;
  citationMinConfidence?: string;
  bookId?: string;
  scopeText?: string;
  scopeLabel?: string;
  conversationContext?: string;
  mode?: 'local' | 'cloud' | 'mock';
  interactionMode?: 'qa' | 'agent';
  agentEnabledTools?: string[];
  requireCloudApi?: boolean;
  cloudPromptMode?: 'bookmind' | 'agent_tool_decision' | 'plain_text';
  cloudResponseFormat?: 'default' | 'text' | 'json_object' | 'json_schema';
  requestId?: string;
  customSensitiveWords?: string;
  reasoningEffort?: AiReasoningEffort;
};

export type NoteSaveTarget = 'knowledge' | 'book' | 'inbox';

export type NoteRecord = {
  id: string;
  title: string;
  body: string;
  source: string;
  createdAt: string;
  citations: Citation[];
  saveTarget?: NoteSaveTarget;
  readerLocation?: ReaderNoteLocation;
  aiMetadata?: AiNoteMetadata;
  structuredResponse?: unknown;
};

export type AiNoteMetadata = {
  instruction: string;
  scope: string;
  userText: string;
  selectedCommandId?: string;
  retrievalStrategy?: string;
  retrievalQuery?: string;
  multiStageRetrievalMode?: string;
  model: string;
  savedAt: string;
  schema?: string;
  mode?: 'local' | 'cloud' | 'mock';
  interactionMode?: 'qa' | 'agent';
  generatedAt?: string;
  citationCoverage?: string;
  bookRange?: string;
};

export type ReaderNoteLocation = {
  bookId: string;
  chapterId?: string;
  sourceChapterIndex?: number;
  paragraphIndex?: number;
  startOffset?: number;
  endOffset?: number;
};

export type HighlightRecord = {
  id: string;
  label: string;
  text: string;
  targetId: string;
  createdAt: string;
};

export type FlashcardRecord = {
  id: string;
  front: string;
  back: string;
  sourceLabel: string;
  sourceTargetId: string;
  createdAt: string;
  tags?: string[];
  citationIds?: string[];
  chapter?: string;
  reviewStatus?: 'new' | 'due' | 'reviewed';
};

export type AiGeneratedFlashcardRequest = {
  front: string;
  back: string;
  sourceLabel: string;
  sourceTargetId: string;
  tags?: string[];
  citationIds?: string[];
  chapter?: string;
  reviewStatus?: 'new' | 'due' | 'reviewed';
};

export type TaskRunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'cancelling'
  | 'cancelled'
  | 'failed'
  | 'succeeded'
  | 'skipped'
  | 'archived';

export type CharacterIndexStatus =
  | 'missing'
  | 'blocked-by-text-index'
  | 'queued'
  | 'building'
  | 'ready'
  | 'stale'
  | 'failed';

export type CharacterWorkbenchView =
  | 'overview'
  | 'profiles'
  | 'relations'
  | 'heatmap'
  | 'timeline'
  | 'factions'
  | 'evidence'
  | 'review'
  | 'export';

export type CharacterEntityKind =
  | 'person'
  | 'organization'
  | 'faction'
  | 'place'
  | 'artifact'
  | 'unknown';

export type CharacterRole =
  | 'protagonist'
  | 'main'
  | 'supporting'
  | 'minor'
  | 'antagonist'
  | 'unknown';

export type CharacterExtractionSource =
  | 'rule'
  | 'ai'
  | 'manual'
  | 'imported';

export type CharacterCenterBookSummary = {
  id: string;
  title: string;
  displayTitle: string;
  author: string;
  fileName: string;
  coverTone: Book['coverTone'];
  coverLabel: string;
  coverImagePath?: string;
  progress: number;
  textIndexStatus: BookIndexManifest['status'];
  textIndexReady: boolean;
  textIndexChunkCount: number;
  textIndexFtsRows: number;
  characterIndexStatus: CharacterIndexStatus;
  characterCount: number;
  relationCount: number;
  evidenceCount: number;
  lastCharacterBuiltAt: string;
  staleReason: string;
  lastError: string;
  lastTaskId: string;
  errorCode: string;
  errorStage: string;
  recentLogEntry: string;
};

export type CharacterLocation = ReaderNoteLocation & {
  chapterIndex?: number;
  visibleChapterPosition?: number;
  chapterTitle?: string;
  paragraphStart?: number;
  paragraphEnd?: number;
  chunkId?: string;
  readerLocation?: ReaderNoteLocation;
};

export type CharacterMentionLocation = CharacterLocation & {
  bookId: string;
  chapterId: string;
  sourceChapterIndex: number;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
};

export type CharacterEvidenceLocation = CharacterLocation & {
  chunkId: string;
};

export type CharacterAlias = {
  id: string;
  bookId: string;
  characterId: string;
  name: string;
  normalizedName: string;
  kind: 'name' | 'title' | 'nickname' | 'identity' | 'pronoun' | 'other';
  source: CharacterExtractionSource;
  confidence: number;
  mentionCount: number;
  firstSeen?: CharacterLocation;
  createdAt: string;
  updatedAt: string;
};

export type CharacterMention = {
  id: string;
  bookId: string;
  characterId: string;
  aliasId?: string;
  name: string;
  normalizedName: string;
  location: CharacterMentionLocation;
  quote: string;
  prefixText?: string;
  suffixText?: string;
  contextHash: string;
  confidence: number;
  source: CharacterExtractionSource;
  createdAt: string;
};

export type CharacterEvidence = {
  id: string;
  bookId: string;
  targetType: 'profile' | 'alias' | 'mention' | 'relation' | 'event' | 'faction';
  targetId: string;
  claim: string;
  quote: string;
  location: CharacterEvidenceLocation;
  evidenceHash: string;
  confidence: number;
  source: CharacterExtractionSource;
  status: 'valid' | 'stale' | 'broken' | 'pending-review';
  createdAt: string;
  updatedAt: string;
};

export type CharacterRelation = {
  id: string;
  bookId: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  relationType: string;
  label: string;
  summary: string;
  direction: 'directed' | 'undirected';
  confidence: number;
  evidenceIds: string[];
  firstSeen?: CharacterLocation;
  lastSeen?: CharacterLocation;
  status: 'active' | 'former' | 'suspected' | 'unknown';
  createdAt: string;
  updatedAt: string;
};

export type CharacterEvent = {
  id: string;
  bookId: string;
  title: string;
  summary: string;
  eventType: 'appearance' | 'identity' | 'relationship' | 'faction' | 'conflict' | 'life-event' | 'other';
  participantCharacterIds: string[];
  location: CharacterLocation;
  chapterLabel: string;
  evidenceIds: string[];
  confidence: number;
  source: CharacterExtractionSource;
  createdAt: string;
  updatedAt: string;
};

export type CharacterFactionMembership = {
  id: string;
  bookId: string;
  characterId: string;
  factionId?: string;
  factionName: string;
  role: string;
  status: 'active' | 'former' | 'suspected' | 'unknown';
  joinedAt?: CharacterLocation;
  leftAt?: CharacterLocation;
  evidenceIds: string[];
  confidence: number;
  source: CharacterExtractionSource;
  createdAt: string;
  updatedAt: string;
};

export type CharacterAppearanceStat = {
  id: string;
  bookId: string;
  characterId: string;
  chapterIndex: number;
  sourceChapterIndex?: number;
  chapterTitle: string;
  mentionCount: number;
  evidenceCount: number;
  firstParagraphIndex?: number;
  lastParagraphIndex?: number;
  heat: number;
};

export type CharacterProfile = {
  id: string;
  bookId: string;
  canonicalName: string;
  displayName: string;
  kind: CharacterEntityKind;
  role: CharacterRole;
  gender?: 'unknown' | 'male' | 'female';
  aliases: CharacterAlias[];
  summary: string;
  tags: string[];
  importanceScore: number;
  confidence: number;
  firstAppearance?: CharacterLocation;
  lastAppearance?: CharacterLocation;
  mentionCount: number;
  relationCount: number;
  eventCount: number;
  factionMemberships: CharacterFactionMembership[];
  hidden: boolean;
  mergedIntoCharacterId?: string;
  source: CharacterExtractionSource;
  createdAt: string;
  updatedAt: string;
};

export type CharacterOverviewSnapshotStat = {
  id: 'characters' | 'relations' | 'evidence' | 'chapter-coverage' | 'review';
  value: string;
};

export type CharacterOverviewSnapshotProfile = {
  id: string;
  name: string;
  mentionCount: number;
  relationCount: number;
  rankLabel: string;
  location?: CharacterLocation;
};

export type CharacterOverviewSnapshotAppearance = {
  id: string;
  characterId: string;
  name: string;
  chapterIndex: number;
  chapterTitle: string;
  mentionCount: number;
  location?: CharacterLocation;
};

export type CharacterOverviewSnapshot = {
  bookId: string;
  builtAt: string;
  stats: CharacterOverviewSnapshotStat[];
  mainProfiles: CharacterOverviewSnapshotProfile[];
  recentAppearances: CharacterOverviewSnapshotAppearance[];
  reviewIssueCount: number;
  coveredChapterCount: number;
  totalChapterCount: number;
};

export type CharacterIndexManifest = {
  schemaVersion: string;
  bookId: string;
  bookTitle: string;
  contentHash: string;
  textIndexContentHash: string;
  indexVersion: number;
  chunkStrategyVersion: number;
  chapterRuleVersion: number;
  status: CharacterIndexStatus;
  extractionMode: 'rule' | 'ai' | 'rule-ai' | 'manual';
  builtAt: string;
  updatedAt: string;
  staleReason: string;
  lastError: string;
  characterCount: number;
  aliasCount: number;
  mentionCount: number;
  relationCount: number;
  evidenceCount: number;
  eventCount: number;
  factionCount: number;
  sourceTextIndex: {
    status: BookIndexManifest['status'];
    builtAt: string;
    chunkCount: number;
    ftsRowCount: number;
  };
};

export type CharacterCenterPayload = {
  book: CharacterCenterBookSummary;
  manifest: CharacterIndexManifest | null;
  profiles: CharacterProfile[];
  mentions: CharacterMention[];
  relations: CharacterRelation[];
  evidence: CharacterEvidence[];
  events: CharacterEvent[];
  factionMemberships: CharacterFactionMembership[];
  appearanceStats: CharacterAppearanceStat[];
  loadedAt: string;
};

export type CharacterExportFormat = 'markdown' | 'json' | 'csv' | 'relations-json' | 'mentions-jsonl' | 'mermaid' | 'graphml' | 'cytoscape-json';
export type CharacterMarkdownExportStyle = 'standard' | 'obsidian' | 'logseq';
export type CharacterSpoilerLimit = {
  sourceChapterIndex?: number;
  paragraphIndex?: number;
};

export type CharacterExportOptions = {
  format: CharacterExportFormat;
  markdownStyle?: CharacterMarkdownExportStyle;
  spoilerLimit?: CharacterSpoilerLimit;
  selectedCharacterIds?: string[];
  onlyMajorCharacters?: boolean;
  includeHidden?: boolean;
  includeRelations?: boolean;
  includeEvidence?: boolean;
  includeMentions?: boolean;
  includeQuotes?: boolean;
  maxQuoteLength?: number;
  generatedAt?: string;
  privacyMode?: boolean;
  privateValue?: string;
};

export type TaskKind =
  | 'import-directory'
  | 'import-book'
  | 'parse-and-index'
  | 'rebuild-index'
  | 'full-text-index'
  | 'cleanup-index'
  | 'export-data'
  | 'embedding-index'
  | 'ai-summary'
  | 'backup'
  | 'diagnostics'
  | 'character-extraction';

export type TaskStage =
  | 'queued'
  | 'read-file'
  | 'parse-chapters'
  | 'build-chunks'
  | 'write-chunks'
  | 'write-fts'
  | 'verify'
  | 'done';

export type TaskOutputSummary = {
  chapters: number;
  paragraphs: number;
  chunks: number;
  ftsRows: number;
  bytesRead: number;
  warnings: string[];
  chunksPerSecond: number;
  mbPerSecond: number;
  stageDurationsMs: {
    readFile: number;
    parseChapters: number;
    buildChunks: number;
    writeChunks: number;
    writeFts: number;
    verify: number;
  };
};

export type TaskError = {
  code: string;
  message: string;
  stage: TaskStage;
  retryable: boolean;
  detail: Record<string, unknown>;
};

export type TaskStatus = {
  id: string;
  kind: TaskKind;
  name: string;
  status: TaskRunStatus;
  progress: number;
  stage: TaskStage;
  stageLabel: string;
  tone: 'sage' | 'amber' | 'indigo' | 'cinnabar' | 'violet';
  message: string;
  bookId: string;
  bookTitle: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  attempt: number;
  maxAttempts: number;
  errorCode: string;
  errorMessage: string;
  error: TaskError;
  dagId: string;
  dependsOn: string[];
  blockedBy: string[];
  logCount: number;
  outputSummary: TaskOutputSummary;
};

export type TaskLogRecord = {
  id: string;
  taskId: string;
  bookId: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  stage: TaskStage;
  message: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export type BookIndexManifest = {
  bookId: string;
  bookTitle: string;
  filePath: string;
  contentHash: string;
  indexVersion: number;
  chunkStrategyVersion: number;
  chapterRuleVersion: number;
  ftsSchemaVersion: number;
  status: 'missing' | 'building' | 'ready' | 'stale' | 'failed';
  builtAt: string;
  staleReason: string;
  chapterCount: number;
  paragraphCount: number;
  chunkCount: number;
  ftsRowCount: number;
  bytesIndexed: number;
  firstChunkPreview: string;
  lastError: string;
};

export type IndexDiagnostics = {
  summary: {
    queuedCount: number;
    runningCount: number;
    succeededCount: number;
    failedCount: number;
    pausedCount: number;
    cancelledCount: number;
    staleBookCount: number;
    indexedChunkCount: number;
    indexedBookCount: number;
    ftsAvailable: boolean;
    ftsDatabasePath: string;
    ftsDatabaseSizeBytes: number;
    ftsDatabaseModifiedAt: string;
    recentError: string;
    recentErrors: string[];
    sidecarStatus: 'not-configured' | 'available' | 'unavailable' | 'error';
    sidecarMessage: string;
    sidecarVersion: string;
    sidecarCapabilities: string[];
    sidecarCheckedAt: string;
    sidecarErrorCode: string;
    vectorIndexStatus: 'not-built' | 'building' | 'ready' | 'stale' | 'failed';
    vectorIndexedBookCount: number;
    vectorIndexedChunkCount: number;
    vectorProvider: string;
    vectorDimension: number;
    vectorLastBuiltAt: string;
    vectorLastError: string;
  };
  books: BookIndexManifest[];
};

export type IndexedChunkPreviewItem = {
  chunkId: string;
  ordinal: number;
  chapterIndex: number;
  chapterTitle: string;
  paragraphStart: number;
  paragraphEnd: number;
  paragraphRange: string;
  charStart: number;
  charEnd: number;
  sourceChapterIndex: number;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  charCount: number;
  textPreview: string;
  fullText: string;
  readerLocation: string;
};

export type IndexedChunksPreview = {
  bookId: string;
  total: number;
  limit: number;
  offset: number;
  items: IndexedChunkPreviewItem[];
};

export type SearchResult = {
  chunkId: string;
  bookId: string;
  bookTitle: string;
  chapter: string;
  sourceChapterIndex: number;
  chapterTitle: string;
  snippet: string;
  score: number;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
};

export type SearchIndexPage = {
  query: string;
  total: number;
  limit: number;
  offset: number;
  results: SearchResult[];
};

export type EditableBook = Book;

export type AiEndpointMode = 'responses' | 'chat.completions';
export type AiProviderKind = 'openai' | 'openai-compatible' | 'local-proxy';
export type AiProviderModelType = 'chat' | 'embedding' | 'rerank' | 'image' | 'audio';
export type AiProviderModelCapabilities = {
  vision: boolean;
  reasoning: boolean;
  toolUse: boolean;
};
export type AiProviderModelSettings = {
  id: string;
  displayName: string;
  type: AiProviderModelType;
  contextWindowTokens: number;
  maxOutputTokens: number;
  capabilities: AiProviderModelCapabilities;
  favorite?: boolean;
};
export type AiReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | (string & {});

export type AiProviderProfile = {
  id: string;
  name: string;
  kind: AiProviderKind;
  enabled?: boolean;
  apiKey?: string;
  apiBaseUrl: string;
  endpointMode: AiEndpointMode;
  model: string;
  models?: string[];
  modelSettings?: Record<string, AiProviderModelSettings>;
  proxyUrl?: string;
  customHeaders?: string;
  streamingEnabled?: boolean;
  requestTimeoutSecs?: number;
  retryCount?: number;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  reasoningEffort?: AiReasoningEffort;
  responseFormat?: 'auto' | 'json_object' | 'json_schema';
};
export type TranslationLanguage = 'auto' | 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'ru';
export type AiModelTranslationSource = {
  id: string;
  name: string;
  kind: 'ai-model';
  enabled?: boolean;
  providerId: string;
  model: string;
};
export type LibreTranslateSource = {
  id: string;
  name: string;
  kind: 'libretranslate';
  enabled?: boolean;
  apiBaseUrl: string;
  apiKey?: string;
  requestTimeoutSecs?: number;
};
export type BaiduTranslateSource = {
  id: string;
  name: string;
  kind: 'baidu-translate';
  enabled?: boolean;
  apiBaseUrl: string;
  appId: string;
  apiKey?: string;
  requestTimeoutSecs?: number;
};
export type GoogleTranslateSource = {
  id: string;
  name: string;
  kind: 'google-translate';
  enabled?: boolean;
  apiBaseUrl: string;
  apiKey?: string;
  requestTimeoutSecs?: number;
};
export type MicrosoftTranslatorSource = {
  id: string;
  name: string;
  kind: 'microsoft-translator';
  enabled?: boolean;
  apiBaseUrl: string;
  apiKey?: string;
  region: string;
  requestTimeoutSecs?: number;
};
export type ApiTranslationSource = LibreTranslateSource | BaiduTranslateSource | GoogleTranslateSource | MicrosoftTranslatorSource;
export type TranslationSource = AiModelTranslationSource | ApiTranslationSource;
export type OperationLogLevel = 'none' | 'error' | 'basic' | 'debug';

export type AppSettings = {
  schemaVersion?: number;
  trashRetentionDays: number;
  trashAutoCleanupEnabled?: boolean;
  trashProtectReadingProgress?: boolean;
  trashProtectReaderAssets?: boolean;
  aiApiKey?: string;
  aiApiBaseUrl?: string;
  aiEndpointMode?: AiEndpointMode;
  aiModel?: string;
  aiRequestTimeoutSecs?: number;
  aiRetryCount?: number;
  aiProxyUrl?: string;
  aiCustomHeaders?: string;
  aiStreamingEnabled?: boolean;
  aiTemperature?: number;
  aiMaxTokens?: number;
  aiTopP?: number;
  aiReasoningEffort?: AiReasoningEffort;
  aiResponseFormat?: 'auto' | 'json_object' | 'json_schema';
  aiActiveProviderProfileId?: string;
  aiProviderProfiles?: AiProviderProfile[];
  translationActiveSourceId?: string;
  translationSources?: TranslationSource[];
  translationSourceLanguage?: TranslationLanguage;
  translationTargetLanguage?: Exclude<TranslationLanguage, 'auto'>;
  aiCancelStrategy?: 'abort-only' | 'abort-and-save-stopped' | 'abort-and-local-timeout';
  operationLogLevel?: OperationLogLevel;
};

export type LibraryViewMode = 'card' | 'list' | 'shelf';

export type ReaderLayoutMode = 'page' | 'flow';
export type ReaderPageMode = 'single' | 'double';
export type ReaderPageVerticalAlign = 'top' | 'center';
export type ReaderLongParagraphStrategy = 'strict' | 'punctuation';
export type ReaderTitleNumberCleanup = 'keep' | 'strip-number';
export type ReaderTitleDecoration = 'off' | 'line';
export type ReaderHeaderFooterTimeFormat = 'short-24h' | 'short-12h' | 'date-time';
export type ReaderHeaderFooterProgressFormat = 'percent' | 'current-page' | 'chapter-page' | 'total-pages';
export type ReaderCjkPunctuationHanging = 'off' | 'punctuation';
export type ReaderMixedTextSpacing = 'off' | 'auto';
export type ReaderFontWeightBoost = 'off' | 'medium' | 'strong';
export type ReaderAlign = 'left' | 'center' | 'right' | 'hidden';
export type ReaderInfoSlot = 'none' | 'title' | 'chapter' | 'progress' | 'page' | 'time' | 'custom';
export type ReaderAnimation = 'none' | 'fade' | 'slide' | 'lift' | 'turn' | 'zoom';
export type ReaderSettingsLevel = 'basic' | 'advanced';
export type ReaderHighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'violet' | 'red';
export type ReaderHighlightImportance = 'normal' | 'high' | 'critical';
export type ReaderHighlightReviewStatus = 'new' | 'due' | 'reviewed';
export type ReaderTheme = 'white' | 'paper' | 'eyeComfort' | 'dark' | 'oled' | 'system' | 'light' | 'night' | 'sepia';
export type ReaderPreset = 'custom' | 'novel' | 'paper' | 'eyeComfort' | 'compact' | 'spacious' | 'eInk';

export type ReaderHighlight = {
  id: string;
  bookId: string;
  chapterIndex: number;
  chapterId?: string;
  sourceChapterIndex?: number;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  text: string;
  note: string;
  color: ReaderHighlightColor;
  createdAt: string;
  updatedAt?: string;
  prefixText?: string;
  suffixText?: string;
  paragraphHash?: string;
  tags?: string[];
  importance?: ReaderHighlightImportance;
  reviewStatus?: ReaderHighlightReviewStatus;
  colorMeaning?: string;
};

export type ReaderBookmark = {
  id: string;
  bookId: string;
  chapterIndex: number;
  chapterId?: string;
  sourceChapterIndex?: number;
  paragraphIndex: number;
  screenPage: number;
  spreadIndex?: number;
  pageInSpread?: number;
  label: string;
  title?: string;
  note?: string;
  color?: ReaderHighlightColor;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
};

export type ReaderSettings = {
  theme: ReaderTheme;
  preset: ReaderPreset;
  layoutMode: ReaderLayoutMode;
  pageMode: ReaderPageMode;
  pageVerticalAlign: ReaderPageVerticalAlign;
  chapterStartsNewPage: boolean;
  longParagraphStrategy: ReaderLongParagraphStrategy;
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  paragraphSpacing: number;
  paperTextureStrength: number;
  eyeComfortBackgroundStrength: number;
  paperBackgroundStrength: number;
  customBackgroundColor: string;
  customTextColor: string;
  customSelectionColor: string;
  fontFamily: string;
  customFontFamily: string;
  fontFallbacks: string[];
  cjkPunctuationHanging: ReaderCjkPunctuationHanging;
  mixedTextSpacing: ReaderMixedTextSpacing;
  fontWeightBoost: ReaderFontWeightBoost;
  firstLineIndent: number;
  pageWidth: number;
  pageGap: number;
  bodyMarginX: number;
  bodyMarginY: number;
  narrowBodyMarginX: number;
  narrowBodyMarginY: number;
  headerMarginX: number;
  headerMarginY: number;
  footerMarginX: number;
  footerMarginY: number;
  titleAlign: ReaderAlign;
  titleOnlyOnChapterStart: boolean;
  titleNumberCleanup: ReaderTitleNumberCleanup;
  titleDecoration: ReaderTitleDecoration;
  titleFontSize: number;
  titleMarginTop: number;
  titleMarginBottom: number;
  headerVisible: boolean;
  headerLeft: ReaderInfoSlot;
  headerCenter: ReaderInfoSlot;
  headerRight: ReaderInfoSlot;
  footerVisible: boolean;
  footerLeft: ReaderInfoSlot;
  footerCenter: ReaderInfoSlot;
  footerRight: ReaderInfoSlot;
  headerFooterCustomFormat: string;
  headerFooterTimeFormat: ReaderHeaderFooterTimeFormat;
  headerFooterProgressFormat: ReaderHeaderFooterProgressFormat;
  headerFooterFontSize: number;
  headerFooterOpacity: number;
  pageAnimation: ReaderAnimation;
  wheelPaging: boolean;
  touchpadNaturalScroll: boolean;
  preserveBlankLines: boolean;
  privacyMode: boolean;
  encryptSensitiveReaderData: boolean;
};

export type AppPage = 'overview' | 'reader' | 'library' | 'knowledge' | 'characters' | 'search' | 'tasks' | 'settings';

export type NavItem = {
  id: AppPage;
  label: string;
  description: string;
  badge?: string;
};
