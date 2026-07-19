import type { Translator } from '../../i18n';
import type { AiReasoningEffort } from '../../types';

export type CustomSlashCommandScopeHint = 'selection' | 'page-lite' | 'page' | 'chapter' | 'volume' | 'book' | 'annotations' | 'library';

export type EditableCustomSlashCommandDraft = {
  label: string;
  prompt: string;
  aliases: string;
  scopeHint: CustomSlashCommandScopeHint;
  outputHint: string;
};

export type CustomSlashCommandTemplate = {
  id: `custom-template-${string}`;
  label: string;
  prompt: string;
  aliases: string[];
  scopeHint: CustomSlashCommandScopeHint;
  outputHint: string;
  retrievalStrategy: 'scope-first';
};

export type SelectOption = {
  value: string;
  label: string;
};

export type ReaderStaticSelectOptions = {
  pageVerticalAlign: Array<SelectOption & { value: 'top' | 'center' }>;
  longParagraphStrategy: Array<SelectOption & { value: 'strict' | 'punctuation' }>;
  cjkPunctuation: Array<SelectOption & { value: 'off' | 'punctuation' }>;
  mixedTextSpacing: Array<SelectOption & { value: 'off' | 'auto' }>;
  fontWeightBoost: Array<SelectOption & { value: 'off' | 'medium' | 'strong' }>;
};

export type ChapterStaticSelectOptions = {
  bookTitleBracketMode: Array<SelectOption & { value: 'both' | 'book-title' | 'angle' | 'custom' }>;
  paragraphMode: Array<SelectOption & { value: 'line' | 'blank-line' | 'merge-short-lines' | 'chinese-reflow' }>;
  tocRuleChangeRebuildMode: Array<SelectOption & { value: 'prompt' | 'auto' | 'off' }>;
};

export type AiProviderStaticSelectOptions = {
  endpoint: Array<SelectOption & { value: 'responses' | 'chat.completions' }>;
  providerKind: Array<SelectOption & { value: 'openai' | 'openai-compatible' | 'local-proxy' }>;
  cancelStrategy: Array<SelectOption & { value: 'abort-only' | 'abort-and-save-stopped' | 'abort-and-local-timeout' }>;
  reasoningEffort: Array<SelectOption & { value: AiReasoningEffort }>;
  responseFormat: Array<SelectOption & { value: 'auto' | 'json_object' | 'json_schema' }>;
};

export type AiModeSelectOption = SelectOption & { value: 'cloud' | 'local' | 'mock' };

export type AiInteractionStaticSelectOptions = {
  scope: Array<SelectOption & { value: CustomSlashCommandScopeHint }>;
  noSelectionFallbackScope: Array<SelectOption & { value: 'page' | 'chapter' | 'book' }>;
  scopePriorityStrategy: Array<SelectOption & { value: 'command-first' | 'panel-first' | 'narrowest-first' }>;
  retrievalStrategy: Array<SelectOption & { value: 'scope-first' | 'entity-extraction' | 'anomaly-extraction' | 'timeline-extraction' | 'key-sentences' }>;
  retrievalQueryRewriteMode: Array<SelectOption & { value: 'basic' | 'off' }>;
  multiStageRetrievalMode: Array<SelectOption & { value: 'off' | 'auto' }>;
  ftsUnavailableBehavior: Array<SelectOption & { value: 'show-warning' | 'text-fallback' | 'fail-fast' }>;
  defaultOutputFormat: Array<SelectOption & { value: 'structured' | 'markdown' }>;
  citationCardDefaultDensity: Array<SelectOption & { value: 'detailed' | 'compact' }>;
  citationFieldStrictness: Array<SelectOption & { value: 'normal' | 'lenient' | 'strict' }>;
  toolCallDisplayMode: Array<SelectOption & { value: 'summary' | 'hidden' | 'full' }>;
  citationDefaultSaveTarget: Array<SelectOption & { value: 'excerpt' | 'highlight' | 'both' }>;
};

export type SearchIndexStaticSelectOptions = {
  indexStrategyVersion: Array<SelectOption & { value: 'stable' | 'latest' | 'compat' }>;
  ftsRepairStrategy: Array<SelectOption & { value: 'manual' | 'prompt' | 'auto' }>;
  indexRebuildStrategy: Array<SelectOption & { value: 'manual' | 'prompt' | 'auto' }>;
  indexPauseResumeStrategy: Array<SelectOption & { value: 'manual' | 'ask' | 'auto' }>;
};

export type LibraryImportStaticSelectOptions = {
  viewMode: Array<SelectOption & { value: 'card' | 'list' | 'shelf' }>;
  sort: Array<SelectOption & { value: 'recent' | 'title' | 'progress' | 'trashExpiry' }>;
  filter: Array<SelectOption & { value: 'all' | 'unread' | 'reading' | 'done' }>;
  duplicateStrategy: Array<SelectOption & { value: 'ask' | 'skip' | 'replace' | 'copy' }>;
  coverToneStrategy: Array<SelectOption & { value: 'format' | 'hash' | 'progress' }>;
  coverLabelStrategy: Array<SelectOption & { value: 'format' | 'ai' | 'read' | 'knowledge' | 'first-char' }>;
  importFileFilter: Array<SelectOption & { value: 'txt' | 'all' }>;
  txtImportEncodingMode: Array<SelectOption & { value: 'auto' | 'utf-8' | 'gb18030' }>;
  density: Array<SelectOption & { value: 'comfortable' | 'compact' | 'spacious' }>;
};

export type SearchStaticSelectOptions = {
  scope: Array<SelectOption & { value: 'page' | 'chapter' | 'book' | 'annotations' | 'bookmarks' | 'all' }>;
  globalMode: Array<SelectOption & { value: 'instant' | 'enter' }>;
  readerChapterFilter: Array<SelectOption & { value: 'all' | 'current' }>;
  readerHighlightColor: Array<SelectOption & { value: 'amber' | 'blue' | 'green' | 'pink' | 'violet' | 'red' }>;
};

export type AnnotationKnowledgeStaticSelectOptions = {
  highlightColor: Array<SelectOption & { value: 'yellow' | 'green' | 'blue' | 'pink' | 'violet' | 'red' }>;
  highlightColorShortcut: Array<SelectOption & { value: '1' | '2' | '3' | '4' | '5' | '6' | 'disabled' }>;
  highlightImportance: Array<SelectOption & { value: 'normal' | 'high' | 'critical' }>;
  highlightReviewStatus: Array<SelectOption & { value: 'new' | 'due' | 'reviewed' }>;
  highlightOverlapStrategy: Array<SelectOption & { value: 'first-start-longest' | 'latest-created' | 'highest-importance' }>;
  anchorRepairStrategy: Array<SelectOption & { value: 'context-first' | 'text-first' | 'manual' }>;
  exportFormat: Array<SelectOption & { value: 'markdown' | 'csv' | 'anki' | 'obsidian' | 'logseq' | 'readwise' | 'json' }>;
  annotationExportContent: Array<SelectOption & { value: 'all' | 'highlights' | 'bookmarks' | 'notes' }>;
  annotationJsonImportConflictStrategy: Array<SelectOption & { value: 'overwrite' | 'skip' | 'merge' }>;
  noteDefaultSaveTarget: Array<SelectOption & { value: 'knowledge' | 'book' | 'inbox' }>;
  annotationCsvField: Array<SelectOption & { value: 'type' | 'id' | 'chapter' | 'text' | 'note' | 'color' | 'createdAt' | 'location' }>;
  knowledgeDefaultColumn: Array<SelectOption & { value: 'highlights' | 'notes' | 'flashcards' }>;
  bookmarkSort: Array<SelectOption & { value: 'created-desc' | 'created-asc' | 'chapter-asc' }>;
  bookmarkGroup: Array<SelectOption & { value: 'none' | 'chapter' | 'created' | 'tag' }>;
};

export type NavigationShortcutStaticSelectOptions = {
  navItem: Array<SelectOption & { value: 'overview' | 'reader' | 'library' | 'knowledge' | 'characters' | 'search' | 'tasks' | 'settings' }>;
  topbarButton: Array<SelectOption & { value: 'command' | 'night' | 'search' | 'aiSummary' }>;
  commandPaletteShortcut: Array<SelectOption & { value: 'ctrl-k' | 'ctrl-p' | 'ctrl-shift-p' | 'disabled' }>;
  commandPaletteSortMode: Array<SelectOption & { value: 'fixed' | 'recent' }>;
  readerNavigationShortcut: Array<SelectOption & { value: 'ctrl-b' | 'ctrl-r' | 'disabled' }>;
  libraryNavigationShortcut: Array<SelectOption & { value: 'ctrl-l' | 'ctrl-alt-l' | 'disabled' }>;
  searchNavigationShortcut: Array<SelectOption & { value: 'ctrl-f' | 'ctrl-alt-f' | 'disabled' }>;
  importShortcut: Array<SelectOption & { value: 'ctrl-i' | 'ctrl-alt-i' | 'disabled' }>;
  aiSummaryShortcut: Array<SelectOption & { value: 'ctrl-enter' | 'ctrl-shift-enter' | 'disabled' }>;
  readerHighlightShortcut: Array<SelectOption & { value: 'h' | 'ctrl-h' | 'disabled' }>;
  readerBookmarkShortcut: Array<SelectOption & { value: 'm' | 'ctrl-m' | 'disabled' }>;
  readerAiPanelShortcut: Array<SelectOption & { value: 'a' | 'ctrl-alt-a' | 'disabled' }>;
  readerSearchShortcut: Array<SelectOption & { value: 'ctrl-f' | 'slash' | 'disabled' }>;
};

export const defaultCustomSlashCommandDraft: EditableCustomSlashCommandDraft = {
  label: '',
  prompt: '',
  aliases: '',
  scopeHint: 'chapter',
  outputHint: 'custom',
};

export const customSlashCommandTemplateLibrary: CustomSlashCommandTemplate[] = [
  { id: 'custom-template-deep-summary', label: 'deep-summary', prompt: 'Summarize the current range in a structured format, including core events, character motivations, conflict progress, and questions worth tracking next.', aliases: ['deep summary', 'summary+'], scopeHint: 'chapter', outputHint: 'structured-summary', retrievalStrategy: 'scope-first' },
  { id: 'custom-template-style-notes', label: 'style-notes', prompt: 'Analyze the narrative style, sentence rhythm, imagery, and point-of-view changes in the current range, and list quotable evidence.', aliases: ['style analysis', 'prose style'], scopeHint: 'selection', outputHint: 'analysis-cards', retrievalStrategy: 'scope-first' },
  { id: 'custom-template-question-maker', label: 'question-maker', prompt: 'Generate review or reading-club questions from the current range, grouped by factual understanding, character motivation, foreshadowing inference, and open discussion.', aliases: ['questions', 'reading club'], scopeHint: 'chapter', outputHint: 'question-list', retrievalStrategy: 'scope-first' },
];

export function buildCustomSlashCommandTemplateLibrary(t?: Translator): CustomSlashCommandTemplate[] {
  if (!t) return customSlashCommandTemplateLibrary.map((template) => ({ ...template, aliases: [...template.aliases] }));
  return customSlashCommandTemplateLibrary.map((template) => ({
    ...template,
    prompt: translateSettingsOption(t, `settings.customSlashTemplates.${template.id}.prompt`, template.prompt),
    aliases: translateSettingsOption(t, `settings.customSlashTemplates.${template.id}.aliases`, template.aliases.join(', '))
      .split(',')
      .map((alias) => alias.trim())
      .filter(Boolean),
  }));
}

export const retentionDayOptions = [1, 3, 7, 30];

export function buildRetentionSelectOptions(t?: Translator): SelectOption[] {
  return retentionDayOptions.map((days) => ({ value: String(days), label: translateSettingsOption(t, `settings.options.retention.days`, `${days} days`, { days }) }));
}

export function buildReaderStaticSelectOptions(t?: Translator): ReaderStaticSelectOptions {
  return localizeOptionGroups({
    pageVerticalAlign: [
      { value: 'top', label: 'Top' },
      { value: 'center', label: 'Center' },
    ],
    longParagraphStrategy: [
      { value: 'strict', label: 'Strict pagination' },
      { value: 'punctuation', label: 'Prefer punctuation' },
    ],
    cjkPunctuation: [
      { value: 'off', label: 'Off' },
      { value: 'punctuation', label: 'Punctuation hanging/trim' },
    ],
    mixedTextSpacing: [
      { value: 'off', label: 'Off' },
      { value: 'auto', label: 'Auto CJK-Latin spacing' },
    ],
    fontWeightBoost: [
      { value: 'off', label: 'Off' },
      { value: 'medium', label: 'Medium boost' },
      { value: 'strong', label: 'Strong boost' },
    ],
  }, 'settings.options.reader', t) as ReaderStaticSelectOptions;
}

export function buildChapterStaticSelectOptions(t?: Translator): ChapterStaticSelectOptions {
  return localizeOptionGroups({
    bookTitleBracketMode: [
      { value: 'both', label: 'Book-title marks + angle brackets' },
      { value: 'book-title', label: 'Book-title marks only' },
      { value: 'angle', label: 'Angle brackets only' },
      { value: 'custom', label: 'Custom regex' },
    ],
    paragraphMode: [
      { value: 'line', label: 'Each line as paragraph' },
      { value: 'blank-line', label: 'Blank line separates paragraphs' },
      { value: 'merge-short-lines', label: 'Auto-merge short lines' },
      { value: 'chinese-reflow', label: 'CJK paragraph reflow' },
    ],
    tocRuleChangeRebuildMode: [
      { value: 'prompt', label: 'Ask before rebuilding' },
      { value: 'auto', label: 'Auto rebuild' },
      { value: 'off', label: 'Do not auto rebuild' },
    ],
  }, 'settings.options.chapter', t) as ChapterStaticSelectOptions;
}

export function buildAiProviderStaticSelectOptions(t?: Translator): AiProviderStaticSelectOptions {
  return localizeOptionGroups({
    endpoint: [
      { value: 'responses', label: 'Responses API' },
      { value: 'chat.completions', label: 'Chat Completions' },
    ],
    providerKind: [
      { value: 'openai', label: 'OpenAI' },
      { value: 'openai-compatible', label: 'Compatible service' },
      { value: 'local-proxy', label: 'Local proxy' },
    ],
    cancelStrategy: [
      { value: 'abort-and-save-stopped', label: 'Abort and save stopped history' },
      { value: 'abort-only', label: 'Abort current request only' },
      { value: 'abort-and-local-timeout', label: 'Abort and wait for local cancel timeout' },
    ],
    reasoningEffort: [
      { value: 'none', label: 'none' },
      { value: 'minimal', label: 'minimal' },
      { value: 'low', label: 'low' },
      { value: 'medium', label: 'medium' },
      { value: 'high', label: 'high' },
      { value: 'xhigh', label: 'xhigh' },
      { value: 'max', label: 'max' },
    ],
    responseFormat: [
      { value: 'auto', label: 'Auto' },
      { value: 'json_object', label: 'JSON object' },
      { value: 'json_schema', label: 'JSON schema' },
    ],
  }, 'settings.options.aiProvider', t) as AiProviderStaticSelectOptions;
}

export function buildAiModeSelectOptions(t?: Translator): AiModeSelectOption[] {
  return localizeOptions([
    { value: 'cloud', label: 'Cloud model' },
    { value: 'local', label: 'Local index' },
    { value: 'mock', label: 'Demo' },
  ], 'settings.options.aiMode', t) as AiModeSelectOption[];
}

export function buildAiInteractionStaticSelectOptions(t?: Translator): AiInteractionStaticSelectOptions {
  return localizeOptionGroups({
    scope: [
      { value: 'selection', label: 'Selection' },
      { value: 'page-lite', label: 'Current page lite' },
      { value: 'page', label: 'Current page' },
      { value: 'chapter', label: 'Current chapter' },
      { value: 'volume', label: 'Current volume' },
      { value: 'book', label: 'Whole book' },
      { value: 'annotations', label: 'Annotations' },
      { value: 'library', label: 'Library' },
    ],
    noSelectionFallbackScope: [
      { value: 'page', label: 'Current page' },
      { value: 'chapter', label: 'Current chapter' },
      { value: 'book', label: 'Whole book' },
    ],
    scopePriorityStrategy: [
      { value: 'command-first', label: 'Command scope first' },
      { value: 'panel-first', label: 'Panel scope first' },
      { value: 'narrowest-first', label: 'Narrower scope first' },
    ],
    retrievalStrategy: [
      { value: 'scope-first', label: 'Scope first' },
      { value: 'entity-extraction', label: 'Entity extraction' },
      { value: 'anomaly-extraction', label: 'Anomaly/foreshadowing extraction' },
      { value: 'timeline-extraction', label: 'Timeline extraction' },
      { value: 'key-sentences', label: 'Key sentences' },
    ],
    retrievalQueryRewriteMode: [
      { value: 'basic', label: 'Basic rule rewrite' },
      { value: 'off', label: 'Rewrite off' },
    ],
    multiStageRetrievalMode: [
      { value: 'off', label: 'Keep single-stage retrieval' },
      { value: 'auto', label: 'Auto multi-stage retrieval' },
    ],
    ftsUnavailableBehavior: [
      { value: 'show-warning', label: 'Warn and require repair' },
      { value: 'text-fallback', label: 'Fallback to text search' },
      { value: 'fail-fast', label: 'Fail directly' },
    ],
    defaultOutputFormat: [
      { value: 'structured', label: 'Structured cards' },
      { value: 'markdown', label: 'Markdown fallback' },
    ],
    citationCardDefaultDensity: [
      { value: 'detailed', label: 'Detailed citations by default' },
      { value: 'compact', label: 'Compact citations by default' },
    ],
    citationFieldStrictness: [
      { value: 'normal', label: 'Normal: core location fields' },
      { value: 'lenient', label: 'Lenient: warn on key missing fields only' },
      { value: 'strict', label: 'Strict: require full location and source' },
    ],
    toolCallDisplayMode: [
      { value: 'summary', label: 'Summary' },
      { value: 'hidden', label: 'Hidden' },
      { value: 'full', label: 'Full' },
    ],
    citationDefaultSaveTarget: [
      { value: 'excerpt', label: 'Excerpt note' },
      { value: 'highlight', label: 'Highlight' },
      { value: 'both', label: 'Highlight + excerpt note' },
    ],
  }, 'settings.options.aiInteraction', t) as AiInteractionStaticSelectOptions;
}

export function buildSearchIndexStaticSelectOptions(t?: Translator): SearchIndexStaticSelectOptions {
  return localizeOptionGroups({
    indexStrategyVersion: [
      { value: 'stable', label: 'Stable strategy' },
      { value: 'latest', label: 'Latest strategy' },
      { value: 'compat', label: 'Compatible with old indexes' },
    ],
    ftsRepairStrategy: [
      { value: 'prompt', label: 'Prompt to repair after detection' },
      { value: 'manual', label: 'Manual repair only' },
      { value: 'auto', label: 'Allow automatic repair' },
    ],
    indexRebuildStrategy: [
      { value: 'prompt', label: 'Mark stale and prompt rebuild' },
      { value: 'manual', label: 'Mark stale; rebuild manually' },
      { value: 'auto', label: 'Queue automatic rebuild' },
    ],
    indexPauseResumeStrategy: [
      { value: 'manual', label: 'Resume manually after pause' },
      { value: 'ask', label: 'Ask to resume on startup' },
      { value: 'auto', label: 'Resume paused indexes on startup' },
    ],
  }, 'settings.options.searchIndex', t) as SearchIndexStaticSelectOptions;
}

export function buildLibraryImportStaticSelectOptions(t?: Translator): LibraryImportStaticSelectOptions {
  return localizeOptionGroups({
    viewMode: [
      { value: 'card', label: 'Cards' },
      { value: 'list', label: 'List' },
      { value: 'shelf', label: 'Shelf' },
    ],
    sort: [
      { value: 'recent', label: 'Recently imported' },
      { value: 'title', label: 'Title' },
      { value: 'progress', label: 'Progress' },
      { value: 'trashExpiry', label: 'Trash expiry' },
    ],
    filter: [
      { value: 'all', label: 'All' },
      { value: 'unread', label: 'Unread' },
      { value: 'reading', label: 'Reading' },
      { value: 'done', label: 'Done' },
    ],
    duplicateStrategy: [
      { value: 'ask', label: 'Ask every time' },
      { value: 'skip', label: 'Skip' },
      { value: 'replace', label: 'Replace' },
      { value: 'copy', label: 'Save a copy' },
    ],
    coverToneStrategy: [
      { value: 'format', label: 'By format' },
      { value: 'hash', label: 'By content hash' },
      { value: 'progress', label: 'By reading progress' },
    ],
    coverLabelStrategy: [
      { value: 'format', label: 'TXT' },
      { value: 'ai', label: 'AI' },
      { value: 'read', label: 'Read' },
      { value: 'knowledge', label: 'Knowledge' },
      { value: 'first-char', label: 'First file character' },
    ],
    importFileFilter: [
      { value: 'txt', label: 'Recommended formats' },
      { value: 'all', label: 'All files' },
    ],
    txtImportEncodingMode: [
      { value: 'auto', label: 'Auto detect' },
      { value: 'utf-8', label: 'Force UTF-8' },
      { value: 'gb18030', label: 'Force GB18030' },
    ],
    density: [
      { value: 'comfortable', label: 'Comfortable' },
      { value: 'compact', label: 'Compact' },
      { value: 'spacious', label: 'Spacious' },
    ],
  }, 'settings.options.libraryImport', t) as LibraryImportStaticSelectOptions;
}

export function buildSearchStaticSelectOptions(t?: Translator): SearchStaticSelectOptions {
  return localizeOptionGroups({
    scope: [
      { value: 'page', label: 'Current page' },
      { value: 'chapter', label: 'Current chapter' },
      { value: 'book', label: 'Whole book' },
      { value: 'annotations', label: 'Annotations' },
      { value: 'bookmarks', label: 'Bookmarks' },
      { value: 'all', label: 'All' },
    ],
    globalMode: [
      { value: 'instant', label: 'Search while typing' },
      { value: 'enter', label: 'Search on Enter' },
    ],
    readerChapterFilter: [
      { value: 'all', label: 'All chapters' },
      { value: 'current', label: 'Current chapter' },
    ],
    readerHighlightColor: [
      { value: 'amber', label: 'Amber' },
      { value: 'blue', label: 'Blue' },
      { value: 'green', label: 'Green' },
      { value: 'pink', label: 'Pink' },
      { value: 'violet', label: 'Violet' },
      { value: 'red', label: 'Red' },
    ],
  }, 'settings.options.search', t) as SearchStaticSelectOptions;
}

export function buildAnnotationKnowledgeStaticSelectOptions(t?: Translator): AnnotationKnowledgeStaticSelectOptions {
  return localizeOptionGroups({
    highlightColor: [
      { value: 'yellow', label: 'Yellow' },
      { value: 'green', label: 'Green' },
      { value: 'blue', label: 'Blue' },
      { value: 'pink', label: 'Pink' },
      { value: 'violet', label: 'Violet' },
      { value: 'red', label: 'Red' },
    ],
    highlightColorShortcut: [
      { value: '1', label: '1' },
      { value: '2', label: '2' },
      { value: '3', label: '3' },
      { value: '4', label: '4' },
      { value: '5', label: '5' },
      { value: '6', label: '6' },
      { value: 'disabled', label: 'Disabled' },
    ],
    highlightImportance: [
      { value: 'normal', label: 'Normal' },
      { value: 'high', label: 'Important' },
      { value: 'critical', label: 'Critical' },
    ],
    highlightReviewStatus: [
      { value: 'new', label: 'New' },
      { value: 'due', label: 'Due' },
      { value: 'reviewed', label: 'Reviewed' },
    ],
    highlightOverlapStrategy: [
      { value: 'first-start-longest', label: 'Earliest start, longest range first' },
      { value: 'latest-created', label: 'Newest first' },
      { value: 'highest-importance', label: 'Importance first' },
    ],
    anchorRepairStrategy: [
      { value: 'context-first', label: 'Context-first auto repair' },
      { value: 'text-first', label: 'Text-first auto repair' },
      { value: 'manual', label: 'No automatic migration' },
    ],
    exportFormat: [
      { value: 'markdown', label: 'Markdown' },
      { value: 'csv', label: 'CSV' },
      { value: 'anki', label: 'Anki CSV' },
      { value: 'obsidian', label: 'Obsidian Markdown' },
      { value: 'logseq', label: 'Logseq Markdown' },
      { value: 'readwise', label: 'Readwise CSV' },
      { value: 'json', label: 'JSON' },
    ],
    annotationExportContent: [
      { value: 'all', label: 'All' },
      { value: 'highlights', label: 'Highlights' },
      { value: 'bookmarks', label: 'Bookmarks' },
      { value: 'notes', label: 'Notes' },
    ],
    annotationJsonImportConflictStrategy: [
      { value: 'overwrite', label: 'Overwrite same ID' },
      { value: 'skip', label: 'Skip same ID' },
      { value: 'merge', label: 'Merge notes and tags' },
    ],
    noteDefaultSaveTarget: [
      { value: 'knowledge', label: 'Knowledge notes' },
      { value: 'book', label: 'Current-book notes' },
      { value: 'inbox', label: 'Reader inbox' },
    ],
    annotationCsvField: [
      { value: 'type', label: 'Type' },
      { value: 'id', label: 'ID' },
      { value: 'chapter', label: 'Chapter' },
      { value: 'text', label: 'Text' },
      { value: 'note', label: 'Note' },
      { value: 'color', label: 'Color' },
      { value: 'createdAt', label: 'Created at' },
      { value: 'location', label: 'Location' },
    ],
    knowledgeDefaultColumn: [
      { value: 'highlights', label: 'Highlights' },
      { value: 'notes', label: 'Notes' },
      { value: 'flashcards', label: 'Flashcards' },
    ],
    bookmarkSort: [
      { value: 'created-desc', label: 'Newest created first' },
      { value: 'created-asc', label: 'Oldest created first' },
      { value: 'chapter-asc', label: 'Chapter order' },
    ],
    bookmarkGroup: [
      { value: 'none', label: 'No grouping' },
      { value: 'chapter', label: 'By chapter' },
      { value: 'created', label: 'By created date' },
      { value: 'tag', label: 'By tag' },
    ],
  }, 'settings.options.annotationKnowledge', t) as AnnotationKnowledgeStaticSelectOptions;
}

export function buildNavigationShortcutStaticSelectOptions(t?: Translator): NavigationShortcutStaticSelectOptions {
  return localizeOptionGroups({
    navItem: [
      { value: 'overview', label: 'Overview' },
      { value: 'reader', label: 'Reader' },
      { value: 'library', label: 'Library' },
      { value: 'knowledge', label: 'Knowledge' },
      { value: 'characters', label: 'Characters' },
      { value: 'search', label: 'Search' },
      { value: 'tasks', label: 'Tasks' },
      { value: 'settings', label: 'Settings' },
    ],
    topbarButton: [
      { value: 'command', label: 'Command palette' },
      { value: 'night', label: 'Night mode' },
      { value: 'search', label: 'Search' },
      { value: 'aiSummary', label: 'AI summary' },
    ],
    commandPaletteShortcut: [
      { value: 'ctrl-k', label: 'Ctrl/Cmd+K' },
      { value: 'ctrl-p', label: 'Ctrl/Cmd+P' },
      { value: 'ctrl-shift-p', label: 'Ctrl/Cmd+Shift+P' },
      { value: 'disabled', label: 'Disabled' },
    ],
    commandPaletteSortMode: [
      { value: 'fixed', label: 'Fixed categories' },
      { value: 'recent', label: 'Recently used first' },
    ],
    readerNavigationShortcut: [
      { value: 'ctrl-b', label: 'Ctrl/Cmd+B' },
      { value: 'ctrl-r', label: 'Ctrl/Cmd+R' },
      { value: 'disabled', label: 'Disabled' },
    ],
    libraryNavigationShortcut: [
      { value: 'ctrl-l', label: 'Ctrl/Cmd+L' },
      { value: 'ctrl-alt-l', label: 'Ctrl/Cmd+Alt+L' },
      { value: 'disabled', label: 'Disabled' },
    ],
    searchNavigationShortcut: [
      { value: 'ctrl-f', label: 'Ctrl/Cmd+F' },
      { value: 'ctrl-alt-f', label: 'Ctrl/Cmd+Alt+F' },
      { value: 'disabled', label: 'Disabled' },
    ],
    importShortcut: [
      { value: 'ctrl-i', label: 'Ctrl/Cmd+I' },
      { value: 'ctrl-alt-i', label: 'Ctrl/Cmd+Alt+I' },
      { value: 'disabled', label: 'Disabled' },
    ],
    aiSummaryShortcut: [
      { value: 'ctrl-enter', label: 'Ctrl/Cmd+Enter' },
      { value: 'ctrl-shift-enter', label: 'Ctrl/Cmd+Shift+Enter' },
      { value: 'disabled', label: 'Disabled' },
    ],
    readerHighlightShortcut: [
      { value: 'h', label: 'H' },
      { value: 'ctrl-h', label: 'Ctrl/Cmd+H' },
      { value: 'disabled', label: 'Disabled' },
    ],
    readerBookmarkShortcut: [
      { value: 'm', label: 'M' },
      { value: 'ctrl-m', label: 'Ctrl/Cmd+M' },
      { value: 'disabled', label: 'Disabled' },
    ],
    readerAiPanelShortcut: [
      { value: 'a', label: 'A' },
      { value: 'ctrl-alt-a', label: 'Ctrl/Cmd+Alt+A' },
      { value: 'disabled', label: 'Disabled' },
    ],
    readerSearchShortcut: [
      { value: 'ctrl-f', label: 'Ctrl/Cmd+F' },
      { value: 'slash', label: '/' },
      { value: 'disabled', label: 'Disabled' },
    ],
  }, 'settings.options.navigationShortcut', t) as NavigationShortcutStaticSelectOptions;
}

function localizeOptionGroups<T extends Record<string, SelectOption[]>>(groups: T, namespace: string, t?: Translator): T {
  if (!t) return groups;
  return Object.fromEntries(
    Object.entries(groups).map(([groupKey, options]) => [
      groupKey,
      localizeOptions(options, `${namespace}.${groupKey}`, t),
    ]),
  ) as T;
}

function localizeOptions<T extends SelectOption>(options: T[], namespace: string, t?: Translator): T[] {
  if (!t) return options;
  return options.map((option) => ({
    ...option,
    label: translateSettingsOption(t, `${namespace}.${option.value}`, option.label),
  }));
}

function translateSettingsOption(t: Translator | undefined, key: string, fallback: string, values?: Record<string, string | number>) {
  if (!t) return fallback;
  const translated = t(key as never, values);
  return translated === key ? fallback : translated;
}
