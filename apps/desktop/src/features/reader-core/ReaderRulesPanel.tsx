import { useEffect, useState, type ReactNode } from 'react';
import { BookMindIcon } from '../../components/BookMindIcon';
import { ThemedSelect } from '../../components/ThemedSelect';
import { useI18n } from '../../i18n';
import type { ChapterRegexRuleDraft, ChapterRuleDraft, CustomCleanupRuleDraft } from '../../services/settingsCenterService';

type ReaderRulesPanelProps = {
  rules: ChapterRuleDraft;
  hasBookOverride: boolean;
  onSave: (rules: ChapterRuleDraft) => void | Promise<void>;
  onClear: () => void | Promise<void>;
  onClose: () => void;
};

type RuleGroup = 'chapters' | 'cleanup';

export function ReaderRulesPanel({ rules, hasBookOverride, onSave, onClear, onClose }: ReaderRulesPanelProps) {
  const { t } = useI18n();
  const [activeGroup, setActiveGroup] = useState<RuleGroup>('chapters');
  const [draft, setDraft] = useState(() => prepareRules(rules, t('reader.rules.customRegex')));
  const [saved, setSaved] = useState(false);
  const rulesSignature = JSON.stringify(rules);

  useEffect(() => setDraft(prepareRules(rules, t('reader.rules.customRegex'))), [rulesSignature, t]);

  function updateDraft(updater: (current: ChapterRuleDraft) => ChapterRuleDraft) {
    setSaved(false);
    setDraft(updater);
  }

  function patch<K extends keyof ChapterRuleDraft>(key: K, value: ChapterRuleDraft[K]) {
    updateDraft((current) => ({ ...current, [key]: value }));
  }

  function updateChapterRule(ruleId: string, rulePatch: Partial<ChapterRegexRuleDraft>) {
    patch('customRegexRules', draft.customRegexRules.map((rule) => rule.id === ruleId ? { ...rule, ...rulePatch } : rule));
  }

  function addChapterRule() {
    const index = draft.customRegexRules.length;
    patch('customRegexRules', [...draft.customRegexRules, {
      id: createRuleId('reader-chapter'),
      name: t('reader.rules.chapterRuleName', { index: index + 1 }),
      pattern: '',
      enabled: true,
      priority: index,
    }]);
  }

  function moveChapterRule(ruleId: string, direction: -1 | 1) {
    patch('customRegexRules', moveRule(draft.customRegexRules, ruleId, direction));
  }

  function removeChapterRule(ruleId: string) {
    patch('customRegexRules', draft.customRegexRules.filter((rule) => rule.id !== ruleId));
  }

  function updateCleanupRule(ruleId: string, rulePatch: Partial<CustomCleanupRuleDraft>) {
    patch('customCleanupRules', draft.customCleanupRules.map((rule) => rule.id === ruleId ? { ...rule, ...rulePatch } : rule));
  }

  function addCleanupRule() {
    const index = draft.customCleanupRules.length;
    patch('customCleanupRules', [...draft.customCleanupRules, {
      id: createRuleId('reader-cleanup'),
      name: t('reader.rules.cleanupRuleName', { index: index + 1 }),
      pattern: '',
      replacement: '',
      enabled: true,
      mode: 'remove-line',
      priority: index,
    }]);
  }

  function moveCleanupRule(ruleId: string, direction: -1 | 1) {
    patch('customCleanupRules', moveRule(draft.customCleanupRules, ruleId, direction));
  }

  function removeCleanupRule(ruleId: string) {
    patch('customCleanupRules', draft.customCleanupRules.filter((rule) => rule.id !== ruleId));
  }

  const hasInvalidRegex = [...draft.customRegexRules, ...draft.customCleanupRules]
    .some((rule) => rule.enabled && Boolean(validateRegexPattern(rule.pattern)));

  async function saveRules() {
    if (hasInvalidRegex) return;
    await onSave({
      ...draft,
      customRegex: '',
      customRegexRules: normalizePriorities(draft.customRegexRules),
      customCleanupRules: normalizePriorities(draft.customCleanupRules),
    });
    setSaved(true);
  }

  async function clearRules() {
    await onClear();
    setSaved(false);
  }

  return (
    <aside className="reader-rules-panel" role="dialog" aria-modal="false" aria-label={t('reader.rules')}>
      <header className="reader-rules-header">
        <span className="reader-rules-title-icon"><BookMindIcon name="wrench" /></span>
        <span><strong>{t('reader.rules')}</strong><small>{t('reader.rules.subtitle')}</small></span>
        <button type="button" className="reader-rules-close" aria-label={t('common.cancel')} onClick={onClose}>×</button>
      </header>
      <div className="reader-rules-body">
        <div className="reader-rules-group-switch" role="tablist" aria-label={t('reader.rules.groupSwitch')}>
          <button type="button" role="tab" className={activeGroup === 'chapters' ? 'active' : ''} aria-selected={activeGroup === 'chapters'} onClick={() => setActiveGroup('chapters')}>
            <span>{t('reader.rules.groupChapters')}</span><small>{t('reader.rules.ruleCount', { count: draft.customRegexRules.length })}</small>
          </button>
          <button type="button" role="tab" className={activeGroup === 'cleanup' ? 'active' : ''} aria-selected={activeGroup === 'cleanup'} onClick={() => setActiveGroup('cleanup')}>
            <span>{t('reader.rules.groupCleanup')}</span><small>{t('reader.rules.ruleCount', { count: draft.customCleanupRules.length })}</small>
          </button>
        </div>

        {activeGroup === 'chapters' ? <>
          <section className="reader-rules-section">
            <div className="reader-rules-section-title"><strong>{t('reader.rules.tocMode')}</strong><small>{t('reader.rules.tocModeHint')}</small></div>
            <ThemedSelect
              label={t('reader.rules.tocMode')}
              ariaLabel={t('reader.rules.tocMode')}
              value={draft.tocHierarchyMode}
              options={[
                { value: 'novel', label: t('reader.rules.modeNovel') },
                { value: 'document', label: t('reader.rules.modeDocument') },
              ]}
              onChange={(value) => patch('tocHierarchyMode', value)}
              menuPlacement="bottom"
            />
            <div className="reader-rules-preview" data-mode={draft.tocHierarchyMode}>
              <span><i />{t('reader.rules.previewChapter')}</span>
              <span className="level-2"><i />{t('reader.rules.previewHeading')}</span>
              <span className="level-3"><i />{t('reader.rules.previewSection')}</span>
            </div>
          </section>

          <section className="reader-rules-section">
            <div className="reader-rules-section-title"><strong>{t('reader.rules.chapterDetection')}</strong><small>{t('reader.rules.chapterDetectionHint')}</small></div>
            <div className="reader-rules-toggle-grid">
              <RuleToggle label={t('reader.rules.enableChineseChapter')} checked={draft.enableChineseChapter} onChange={(value) => patch('enableChineseChapter', value)} />
              <RuleToggle label={t('reader.rules.enableChineseVolume')} checked={draft.enableChineseVolume} onChange={(value) => patch('enableChineseVolume', value)} />
              <RuleToggle label={t('reader.rules.enableEnglishChapter')} checked={draft.enableEnglishChapter} onChange={(value) => patch('enableEnglishChapter', value)} />
              <RuleToggle label={t('reader.rules.enableSpecialHeadings')} checked={draft.enableSpecialHeadings} onChange={(value) => patch('enableSpecialHeadings', value)} />
            </div>
            <label className="reader-rules-field"><span>{t('reader.rules.maxHeadingLength')}</span><input type="number" min={5} max={80} value={draft.maxHeadingLength} onChange={(event) => patch('maxHeadingLength', Math.min(80, Math.max(5, Number(event.target.value) || 5)))} /></label>
          </section>

          <section className="reader-rules-section reader-custom-rules-section">
            <div className="reader-rules-section-title"><strong>{t('reader.rules.customChapterRules')}</strong><small>{t('reader.rules.customChapterRulesHint')}</small></div>
            <div className="reader-rule-card-list">
              {draft.customRegexRules.map((rule, index) => (
                <ReaderRuleCard key={rule.id} name={rule.name} enabled={rule.enabled} index={index} total={draft.customRegexRules.length} typeLabel={t('reader.rules.chapterExpression')} onToggle={(enabled) => updateChapterRule(rule.id, { enabled })} onMove={(direction) => moveChapterRule(rule.id, direction)} onDelete={() => removeChapterRule(rule.id)}>
                  <label className="reader-rules-field"><span>{t('reader.rules.ruleName')}</span><input value={rule.name} onChange={(event) => updateChapterRule(rule.id, { name: event.target.value })} /></label>
                  <RegexRuleField pattern={rule.pattern} flags="" placeholder={t('reader.rules.chapterRegexPlaceholder')} onChange={(pattern) => updateChapterRule(rule.id, { pattern })} />
                </ReaderRuleCard>
              ))}
              {!draft.customRegexRules.length ? <div className="reader-rule-empty">{t('reader.rules.noChapterRules')}</div> : null}
            </div>
            <button type="button" className="reader-rule-add" onClick={addChapterRule}><BookMindIcon name="plus" /><span>{t('reader.rules.addChapterRule')}</span></button>
          </section>
        </> : null}

        {activeGroup === 'cleanup' ? <>
          <section className="reader-rules-section">
            <div className="reader-rules-section-title"><strong>{t('reader.rules.cleanup')}</strong><small>{t('reader.rules.cleanupHint')}</small></div>
            <div className="reader-rules-toggle-grid">
              <RuleToggle label={t('reader.rules.removeAds')} checked={draft.removeAds} onChange={(value) => patch('removeAds', value)} />
              <RuleToggle label={t('reader.rules.removeAdUrls')} checked={draft.removeAdUrls} onChange={(value) => patch('removeAdUrls', value)} />
              <RuleToggle label={t('reader.rules.removePaginationNoise')} checked={draft.removePaginationNoise} onChange={(value) => patch('removePaginationNoise', value)} />
              <RuleToggle label={t('reader.rules.normalizeBlankLines')} checked={draft.normalizeBlankLines} onChange={(value) => patch('normalizeBlankLines', value)} />
            </div>
            <label className="reader-rules-field"><span>{t('reader.rules.adKeywords')}</span><textarea rows={3} value={draft.adKeywords} placeholder={t('reader.rules.adKeywordsPlaceholder')} onChange={(event) => patch('adKeywords', event.target.value)} /></label>
          </section>

          <section className="reader-rules-section reader-custom-rules-section">
            <div className="reader-rules-section-title"><strong>{t('reader.rules.customCleanupRules')}</strong><small>{t('reader.rules.customCleanupRulesHint')}</small></div>
            <div className="reader-rule-card-list">
              {draft.customCleanupRules.map((rule, index) => (
                <ReaderRuleCard key={rule.id} name={rule.name} enabled={rule.enabled} index={index} total={draft.customCleanupRules.length} typeLabel={rule.mode === 'remove-line' ? t('reader.rules.removeLine') : t('reader.rules.replace')} onToggle={(enabled) => updateCleanupRule(rule.id, { enabled })} onMove={(direction) => moveCleanupRule(rule.id, direction)} onDelete={() => removeCleanupRule(rule.id)}>
                  <div className="reader-rule-card-field-grid">
                    <label className="reader-rules-field"><span>{t('reader.rules.ruleName')}</span><input value={rule.name} onChange={(event) => updateCleanupRule(rule.id, { name: event.target.value })} /></label>
                    <label className="reader-rules-field"><span>{t('reader.rules.action')}</span><ThemedSelect label={t('reader.rules.action')} ariaLabel={t('reader.rules.action')} value={rule.mode} options={[{ value: 'remove-line', label: t('reader.rules.removeLine') }, { value: 'replace', label: t('reader.rules.replace') }]} onChange={(mode) => updateCleanupRule(rule.id, { mode })} menuPlacement="bottom" /></label>
                  </div>
                  <RegexRuleField pattern={rule.pattern} flags="g" placeholder={t('reader.rules.cleanupRegexPlaceholder')} onChange={(pattern) => updateCleanupRule(rule.id, { pattern })} />
                  <label className="reader-rules-field"><span>{t('reader.rules.replacement')}</span><input value={rule.replacement} disabled={rule.mode === 'remove-line'} placeholder={rule.mode === 'remove-line' ? t('reader.rules.replacementDisabled') : t('reader.rules.replacementPlaceholder')} onChange={(event) => updateCleanupRule(rule.id, { replacement: event.target.value })} /></label>
                </ReaderRuleCard>
              ))}
              {!draft.customCleanupRules.length ? <div className="reader-rule-empty">{t('reader.rules.noCleanupRules')}</div> : null}
            </div>
            <button type="button" className="reader-rule-add" onClick={addCleanupRule}><BookMindIcon name="plus" /><span>{t('reader.rules.addCleanupRule')}</span></button>
          </section>
        </> : null}
      </div>
      <footer className="reader-rules-footer">
        <span className={hasInvalidRegex ? 'invalid' : ''}>{hasInvalidRegex ? t('reader.rules.fixInvalidRegex') : saved ? t('reader.rules.saved') : hasBookOverride ? t('reader.rules.bookOverride') : t('reader.rules.globalFallback')}</span>
        {hasBookOverride ? <button type="button" className="ghost-btn" onClick={() => void clearRules()}>{t('reader.rules.clear')}</button> : null}
        <button type="button" className="primary-btn" disabled={hasInvalidRegex} onClick={() => void saveRules()}>{t('reader.rules.save')}</button>
      </footer>
    </aside>
  );
}

function ReaderRuleCard({ name, enabled, index, total, typeLabel, onToggle, onMove, onDelete, children }: {
  name: string;
  enabled: boolean;
  index: number;
  total: number;
  typeLabel: string;
  onToggle: (enabled: boolean) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <article className={`reader-rule-card${enabled ? '' : ' disabled'}`}>
      <header>
        <span className="reader-rule-order">{String(index + 1).padStart(2, '0')}</span>
        <span className="reader-rule-card-title"><strong>{name || t('reader.rules.untitledRule')}</strong><small>{typeLabel}</small></span>
        <RuleToggle label={enabled ? t('reader.rules.enabled') : t('reader.rules.disabled')} checked={enabled} compact onChange={onToggle} />
        <div className="reader-rule-card-actions">
          <button type="button" title={t('reader.rules.moveUp')} aria-label={t('reader.rules.moveUp')} disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
          <button type="button" title={t('reader.rules.moveDown')} aria-label={t('reader.rules.moveDown')} disabled={index >= total - 1} onClick={() => onMove(1)}>↓</button>
          <button type="button" className="danger" title={t('reader.rules.delete')} aria-label={t('reader.rules.delete')} onClick={onDelete}><BookMindIcon name="libraryMenuDelete" /></button>
        </div>
      </header>
      <div className="reader-rule-card-content">{children}</div>
    </article>
  );
}

function RegexRuleField({ pattern, flags, placeholder, onChange }: { pattern: string; flags: string; placeholder: string; onChange: (pattern: string) => void }) {
  const { t } = useI18n();
  const error = validateRegexPattern(pattern);
  const errorText = error === 'required' ? t('reader.rules.regexRequired') : error;
  return (
    <label className="reader-rules-field reader-regex-field">
      <span>{t('reader.rules.expression')}</span>
      <span className={`reader-regex-expression${error ? ' invalid' : ''}`}>
        <code aria-hidden="true">/</code>
        <input value={pattern} placeholder={placeholder} aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)} />
        <code aria-hidden="true">/{flags}</code>
      </span>
      <small className={error ? 'invalid' : 'valid'}>{errorText || t('reader.rules.regexValid')}</small>
    </label>
  );
}

function RuleToggle({ label, checked, compact = false, onChange }: { label: string; checked: boolean; compact?: boolean; onChange: (value: boolean) => void }) {
  return <label className={`reader-rules-toggle${compact ? ' compact' : ''}`}><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}

function prepareRules(rules: ChapterRuleDraft, legacyRuleName: string): ChapterRuleDraft {
  const legacyPattern = rules.customRegex.trim();
  if (!legacyPattern || rules.customRegexRules.some((rule) => rule.pattern === legacyPattern)) return rules;
  return {
    ...rules,
    customRegexRules: [{ id: 'reader-rules-custom', name: legacyRuleName, pattern: legacyPattern, enabled: true, priority: 0 }, ...rules.customRegexRules],
  };
}

function createRuleId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function moveRule<T extends { id: string }>(rules: T[], ruleId: string, direction: -1 | 1) {
  const currentIndex = rules.findIndex((rule) => rule.id === ruleId);
  const targetIndex = currentIndex + direction;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= rules.length) return rules;
  const next = [...rules];
  [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
  return next;
}

function normalizePriorities<T extends { priority: number }>(rules: T[]) {
  return rules.map((rule, priority) => ({ ...rule, priority }));
}

function validateRegexPattern(pattern: string) {
  if (!pattern.trim()) return 'required';
  try {
    new RegExp(pattern);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
