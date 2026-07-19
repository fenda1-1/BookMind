import type { ComponentProps, Dispatch, ReactNode, SetStateAction } from 'react';
import { AiReaderPanel } from '../../features/ai-reader/AiReaderPanel';
import { ReaderSettingsPanel } from '../../features/reader-core/ReaderSettingsPanel';
import { ReaderRulesPanel } from '../../features/reader-core/ReaderRulesPanel';
import type { ChapterRuleDraft } from '../../services/settingsCenterService';
import type { Book } from '../../types';

type AiReaderPanelProps = ComponentProps<typeof AiReaderPanel>;
type ReaderSettingsPanelProps = ComponentProps<typeof ReaderSettingsPanel>;

type ReaderPanelContent = {
  ai: ReactNode;
  settings: ReactNode;
  rules: ReactNode;
};

type ReaderPanelControls = {
  setAiPanelOpen: Dispatch<SetStateAction<boolean>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setRulesOpen: Dispatch<SetStateAction<boolean>>;
};

type BuildReaderPanelContentInput = {
  book: AiReaderPanelProps['book'];
  availableBooks?: AiReaderPanelProps['availableBooks'];
  readerContext: AiReaderPanelProps['readerContext'];
  readerChapters?: AiReaderPanelProps['readerChapters'];
  readerHighlights?: AiReaderPanelProps['readerHighlights'];
  readerBookmarks?: AiReaderPanelProps['readerBookmarks'];
  externalPromptRequest?: AiReaderPanelProps['externalPromptRequest'];
  onExternalPromptConsumed?: AiReaderPanelProps['onExternalPromptConsumed'];
  extendedSettings: {
    defaultAiMode: AiReaderPanelProps['defaultAiMode'];
    localAiEnabled: AiReaderPanelProps['localAiEnabled'];
    aiFallbackEnabled: AiReaderPanelProps['fallbackEnabled'];
    aiDefaultScope: AiReaderPanelProps['defaultAiScope'];
    aiNoSelectionFallbackScope: AiReaderPanelProps['noSelectionFallbackScope'];
    aiCommandDefaultScopes: AiReaderPanelProps['commandDefaultScopes'];
    aiScopePriorityStrategy: AiReaderPanelProps['scopePriorityStrategy'];
    aiAutoDowngradeScopeOnTokenOverflow: AiReaderPanelProps['scopeTokenPolicy']['autoDowngrade'];
    aiScopeTokenLimit: AiReaderPanelProps['scopeTokenPolicy']['maxTokens'];
    aiSlashMenuEnabled: AiReaderPanelProps['slashCommandsEnabled'];
    aiBuiltInSlashCommandEnabled: AiReaderPanelProps['builtInSlashCommandEnabled'];
    aiDefaultOutputFormat: AiReaderPanelProps['outputDefaults']['defaultFormat'];
    aiRequireCitations: AiReaderPanelProps['outputDefaults']['requireCitations'];
    aiNoCitationWarningEnabled: AiReaderPanelProps['outputDefaults']['noCitationWarningEnabled'];
    aiCitationCoverageVisible: AiReaderPanelProps['outputDefaults']['citationCoverageVisible'];
    aiCitationCardDefaultDensity: AiReaderPanelProps['outputDefaults']['citationCardDefaultDensity'];
    aiExternalCitationsDisabled: AiReaderPanelProps['outputDefaults']['externalCitationsDisabled'];
    aiCitationJumpRepairEnabled: AiReaderPanelProps['outputDefaults']['citationJumpRepairEnabled'];
    aiCitationFieldStrictness: AiReaderPanelProps['outputDefaults']['citationFieldStrictness'];
    aiToolCallDisplayMode: AiReaderPanelProps['outputDefaults']['toolCallDisplayMode'];
    aiDefaultRetrievalStrategy: AiReaderPanelProps['retrievalDefaults']['defaultStrategy'];
    aiRetrievalQueryRewriteMode: AiReaderPanelProps['retrievalDefaults']['queryRewriteMode'];
    aiMultiStageRetrievalMode: AiReaderPanelProps['retrievalDefaults']['multiStageMode'];
    aiCommandRetrievalStrategies: AiReaderPanelProps['retrievalDefaults']['commandStrategies'];
    aiLocalIndexResultLimit: AiReaderPanelProps['retrievalDefaults']['localResultLimit'];
    aiCitationMinConfidence: AiReaderPanelProps['retrievalDefaults']['citationMinConfidence'];
    aiCustomSlashCommandLimit: AiReaderPanelProps['slashCommandLimits']['customLimit'];
    aiRecentSlashCommandLimit: AiReaderPanelProps['slashCommandLimits']['recentLimit'];
    cloudAiEnabled: AiReaderPanelProps['cloudPrivacySettings']['enabled'];
    cloudAiRequireConfirmation: AiReaderPanelProps['cloudPrivacySettings']['requireConfirmation'];
    cloudAiAutoRedact: AiReaderPanelProps['cloudPrivacySettings']['autoRedact'];
    cloudAiSensitiveWords: AiReaderPanelProps['cloudPrivacySettings']['sensitiveWords'];
    cloudAiAllowSelectionText: AiReaderPanelProps['cloudPrivacySettings']['allowSelectionText'];
    cloudAiAllowCurrentPageText: AiReaderPanelProps['cloudPrivacySettings']['allowCurrentPageText'];
    cloudAiAllowCurrentChapterText: AiReaderPanelProps['cloudPrivacySettings']['allowCurrentChapterText'];
    cloudAiAllowBookSummaryContext: AiReaderPanelProps['cloudPrivacySettings']['allowBookSummaryContext'];
    aiRenderedBlockLimit: AiReaderPanelProps['renderedBlockLimit'];
    copyDiagnosticsAutoRedact: AiReaderPanelProps['copyDiagnosticsAutoRedact'];
    highlightFlashcardDefaultTags: NonNullable<AiReaderPanelProps['flashcardDefaults']>['tags'];
    highlightFlashcardDefaultReviewStatus: NonNullable<AiReaderPanelProps['flashcardDefaults']>['reviewStatus'];
    aiCitationDefaultSaveTarget: AiReaderPanelProps['citationDefaultSaveTarget'];
  };
  diagnostics: AiReaderPanelProps['diagnostics'];
  citations: AiReaderPanelProps['citations'];
  answer: AiReaderPanelProps['answer'];
  status: AiReaderPanelProps['status'];
  saveStatus: AiReaderPanelProps['saveStatus'];
  appSettings?: AiReaderPanelProps['appSettings'];
  onSelectAiModel?: AiReaderPanelProps['onSelectAiModel'];
  onToggleAiModelFavorite?: AiReaderPanelProps['onToggleAiModelFavorite'];
  onOpenSettings?: AiReaderPanelProps['onOpenSettings'];
  onOpenTasks?: AiReaderPanelProps['onOpenTasks'];
  onAsk: AiReaderPanelProps['onAsk'];
  onStop: AiReaderPanelProps['onStop'];
  onRetry: AiReaderPanelProps['onRetry'];
  onSaveNote: AiReaderPanelProps['onSaveNote'];
  onSaveHighlight: AiReaderPanelProps['onSaveHighlight'];
  onSaveExcerpt: AiReaderPanelProps['onSaveExcerpt'];
  onJumpCitation: AiReaderPanelProps['onJumpCitation'];
  readerPanelControls: ReaderPanelControls;
  settings: ReaderSettingsPanelProps['settings'];
  effectivePageWidth: ReaderSettingsPanelProps['effectivePageWidth'];
  settingsLevel: ReaderSettingsPanelProps['level'];
  setSettingsLevel: ReaderSettingsPanelProps['onLevelChange'];
  onUpdateSetting: ReaderSettingsPanelProps['onUpdate'];
  setPreviewSettings: Dispatch<SetStateAction<ReaderSettingsPanelProps['settings'] | null>>;
  onPresetChange: ReaderSettingsPanelProps['onPresetChange'];
  onExportSettings: ReaderSettingsPanelProps['onExportSettings'];
  onImportSettings: ReaderSettingsPanelProps['onImportSettings'];
  onRestoreDefault: ReaderSettingsPanelProps['onRestoreDefault'];
  onUndoSettings: ReaderSettingsPanelProps['onUndoSettings'];
  onSaveAsGlobalDefault: ReaderSettingsPanelProps['onSaveAsGlobalDefault'];
  bookChapterRulesOverrideEnabled: ReaderSettingsPanelProps['bookChapterRulesOverrideEnabled'];
  onSaveBookChapterRulesOverride: ReaderSettingsPanelProps['onSaveBookChapterRulesOverride'];
  onClearBookChapterRulesOverride: ReaderSettingsPanelProps['onClearBookChapterRulesOverride'];
  onExportDiagnostics: ReaderSettingsPanelProps['onExportDiagnostics'];
  chapterRules: ChapterRuleDraft;
  onSaveChapterRules: (rules: ChapterRuleDraft) => void | Promise<void>;
  onClearChapterRules: () => void | Promise<void>;
};

const aiDemoBook: Book = {
  id: 'demo-ai-research-desk',
  title: 'AI 研究台演示文本',
  displayTitle: 'AI 研究台演示文本',
  author: 'BookMind',
  format: 'TXT',
  status: '演示模式',
  progress: 0,
  fileName: 'demo-ai-research-desk.txt',
  filePath: '',
  coverLabel: 'AI',
  coverTone: 'indigo',
  deleted: false,
  deletedAt: '',
  contentHash: 'demo-ai-research-desk',
  importedAt: '',
  shelfGroups: [],
  content: '第一章 演示\n林七夜在雨夜抵达病院，墙上的钟声突然停止。医生记录了他的异常反应，角色状态从迷茫转为警觉。',
  chunks: [],
};

export function getReaderPanelDemoContext(): NonNullable<AiReaderPanelProps['readerContext']> {
  return {
    bookId: aiDemoBook.id,
    chapterTitle: '第一章 演示',
    chapterText: aiDemoBook.content,
    pageText: aiDemoBook.content,
    paragraphIndex: 0,
    demo: true,
  };
}

export function buildReaderPanelContent({
  book,
  availableBooks,
  readerContext,
  readerChapters,
  readerHighlights,
  readerBookmarks,
  externalPromptRequest,
  onExternalPromptConsumed,
  extendedSettings,
  diagnostics,
  citations,
  answer,
  status,
  saveStatus,
  appSettings,
  onSelectAiModel,
  onToggleAiModelFavorite,
  onOpenSettings,
  onOpenTasks,
  onAsk,
  onStop,
  onRetry,
  onSaveNote,
  onSaveHighlight,
  onSaveExcerpt,
  onJumpCitation,
  readerPanelControls,
  settings,
  effectivePageWidth,
  settingsLevel,
  setSettingsLevel,
  onUpdateSetting,
  setPreviewSettings,
  onPresetChange,
  onExportSettings,
  onImportSettings,
  onRestoreDefault,
  onUndoSettings,
  onSaveAsGlobalDefault,
  bookChapterRulesOverrideEnabled,
  onSaveBookChapterRulesOverride,
  onClearBookChapterRulesOverride,
  onExportDiagnostics,
  chapterRules,
  onSaveChapterRules,
  onClearChapterRules,
}: BuildReaderPanelContentInput): ReaderPanelContent {
  return {
    ai: (
      <AiReaderPanel
        book={book ?? aiDemoBook}
        availableBooks={availableBooks}
        readerContext={readerContext}
        readerChapters={readerChapters}
        readerHighlights={readerHighlights}
        readerBookmarks={readerBookmarks}
        externalPromptRequest={externalPromptRequest}
        onExternalPromptConsumed={onExternalPromptConsumed}
        defaultAiMode={extendedSettings.defaultAiMode}
        localAiEnabled={extendedSettings.localAiEnabled}
        fallbackEnabled={extendedSettings.aiFallbackEnabled}
        defaultAiScope={extendedSettings.aiDefaultScope}
        noSelectionFallbackScope={extendedSettings.aiNoSelectionFallbackScope}
        commandDefaultScopes={extendedSettings.aiCommandDefaultScopes}
        scopePriorityStrategy={extendedSettings.aiScopePriorityStrategy}
        scopeTokenPolicy={{
          autoDowngrade: extendedSettings.aiAutoDowngradeScopeOnTokenOverflow,
          maxTokens: extendedSettings.aiScopeTokenLimit,
        }}
        slashCommandsEnabled={extendedSettings.aiSlashMenuEnabled}
        builtInSlashCommandEnabled={extendedSettings.aiBuiltInSlashCommandEnabled}
        outputDefaults={{
          defaultFormat: extendedSettings.aiDefaultOutputFormat,
          requireCitations: extendedSettings.aiRequireCitations,
          noCitationWarningEnabled: extendedSettings.aiNoCitationWarningEnabled,
          citationCoverageVisible: extendedSettings.aiCitationCoverageVisible,
          citationCardDefaultDensity: extendedSettings.aiCitationCardDefaultDensity,
          externalCitationsDisabled: extendedSettings.aiExternalCitationsDisabled,
          citationJumpRepairEnabled: extendedSettings.aiCitationJumpRepairEnabled,
          citationFieldStrictness: extendedSettings.aiCitationFieldStrictness,
          toolCallDisplayMode: extendedSettings.aiToolCallDisplayMode,
        }}
        retrievalDefaults={{
          defaultStrategy: extendedSettings.aiDefaultRetrievalStrategy,
          queryRewriteMode: extendedSettings.aiRetrievalQueryRewriteMode,
          multiStageMode: extendedSettings.aiMultiStageRetrievalMode,
          commandStrategies: extendedSettings.aiCommandRetrievalStrategies,
          localResultLimit: extendedSettings.aiLocalIndexResultLimit,
          citationMinConfidence: extendedSettings.aiCitationMinConfidence,
        }}
        slashCommandLimits={{
          customLimit: extendedSettings.aiCustomSlashCommandLimit,
          recentLimit: extendedSettings.aiRecentSlashCommandLimit,
        }}
        cloudPrivacySettings={{
          enabled: extendedSettings.cloudAiEnabled,
          requireConfirmation: extendedSettings.cloudAiRequireConfirmation,
          autoRedact: extendedSettings.cloudAiAutoRedact,
          sensitiveWords: extendedSettings.cloudAiSensitiveWords,
          allowSelectionText: extendedSettings.cloudAiAllowSelectionText,
          allowCurrentPageText: extendedSettings.cloudAiAllowCurrentPageText,
          allowCurrentChapterText: extendedSettings.cloudAiAllowCurrentChapterText,
          allowBookSummaryContext: extendedSettings.cloudAiAllowBookSummaryContext,
        }}
        renderedBlockLimit={extendedSettings.aiRenderedBlockLimit}
        copyDiagnosticsAutoRedact={extendedSettings.copyDiagnosticsAutoRedact}
        flashcardDefaults={{
          tags: extendedSettings.highlightFlashcardDefaultTags,
          reviewStatus: extendedSettings.highlightFlashcardDefaultReviewStatus,
        }}
        citationDefaultSaveTarget={extendedSettings.aiCitationDefaultSaveTarget}
        diagnostics={diagnostics}
        citations={citations}
        answer={answer}
        status={status}
        saveStatus={saveStatus}
        appSettings={appSettings}
        onSelectAiModel={onSelectAiModel}
        onToggleAiModelFavorite={onToggleAiModelFavorite}
        onToggleCollapsed={() => readerPanelControls.setAiPanelOpen(false)}
        onOpenSettings={onOpenSettings ?? (() => undefined)}
        onOpenTasks={onOpenTasks ?? (() => undefined)}
        onAsk={onAsk}
        onStop={onStop}
        onRetry={onRetry}
        onSaveNote={onSaveNote}
        onSaveHighlight={onSaveHighlight}
        onSaveExcerpt={onSaveExcerpt}
        onJumpCitation={onJumpCitation}
      />
    ),
    settings: (
      <ReaderSettingsPanel
        settings={settings}
        effectivePageWidth={effectivePageWidth}
        level={settingsLevel}
        onLevelChange={setSettingsLevel}
        onUpdate={onUpdateSetting}
        onPreviewSetting={(key, value) => setPreviewSettings((current) => ({ ...(current ?? settings), [key]: value }))}
        onPresetChange={onPresetChange}
        onExportSettings={onExportSettings}
        onImportSettings={onImportSettings}
        onRestoreDefault={onRestoreDefault}
        onUndoSettings={onUndoSettings}
        onSaveAsGlobalDefault={onSaveAsGlobalDefault}
        bookChapterRulesOverrideEnabled={bookChapterRulesOverrideEnabled}
        onSaveBookChapterRulesOverride={onSaveBookChapterRulesOverride}
        onClearBookChapterRulesOverride={onClearBookChapterRulesOverride}
        onExportDiagnostics={onExportDiagnostics}
        onClose={() => readerPanelControls.setSettingsOpen(false)}
      />
    ),
    rules: (
      <ReaderRulesPanel
        rules={chapterRules}
        hasBookOverride={bookChapterRulesOverrideEnabled}
        onSave={onSaveChapterRules}
        onClear={onClearChapterRules}
        onClose={() => readerPanelControls.setRulesOpen(false)}
      />
    ),
  };
}
