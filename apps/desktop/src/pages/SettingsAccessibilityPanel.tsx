import { useEffect, useMemo, useState } from 'react';
import { ThemedSelect } from './SettingsSelect';
import { SettingControl, SettingsNumberInput, SettingsSection, SettingsTextarea } from './SettingsPageScaffold';
import type { SettingsSupplementalPanelsProps } from './SettingsSupplementalPanels';

export function SettingsAccessibilityPanel(props: SettingsSupplementalPanelsProps) {
  const {
    t,
    locale,
    localePreference,
    setLocalePreference,
    extendedSettings,
    localeOptions,
    translationFallbackOptions,
    updateExtendedSetting,
  } = props;
  const tr = (key: string, values?: Record<string, string | number>) => t(key as never, values);
  const onOff = (checked: boolean) => checked ? tr('settings.common.on') : tr('settings.common.off');
  const enabledDisabled = (checked: boolean) => checked ? tr('settings.common.enabled') : tr('settings.common.disabled');
  const speechVoices = useSpeechSynthesisVoices();
  const voiceOptions = useMemo(() => [
    { value: '', label: tr('settings.accessibility.voice.systemDefault') },
    ...speechVoices.map((voice) => ({
      value: voice.voiceURI,
      label: `${voice.name} · ${voice.lang}${voice.default ? ` · ${tr('settings.accessibility.voice.defaultSuffix')}` : ''}`,
    })),
  ], [speechVoices, t]);

  return (
    <SettingsSection title={tr('settings.accessibility.section.title')} description={tr('settings.accessibility.section.description')}>
      <SettingControl title={t('settings.language.title')} description={t('settings.language.help')} valueText={`${localePreference === 'system' ? t('locale.system') : localePreference} · ${locale}`}>
        <ThemedSelect label={t('settings.language.title')} value={localePreference} options={localeOptions} onChange={setLocalePreference} />
      </SettingControl>
      <SettingControl title={tr('settings.accessibility.translationFallback.title')} description={tr('settings.accessibility.translationFallback.description')} valueText={translationFallbackOptions.find((item) => item.value === extendedSettings.translationFallbackStrategy)?.label}>
        <ThemedSelect label={tr('settings.accessibility.translationFallback.title')} value={extendedSettings.translationFallbackStrategy} options={translationFallbackOptions} onChange={(value) => updateExtendedSetting('translationFallbackStrategy', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.accessibility.customTerminology.title')} description={tr('settings.accessibility.customTerminology.description')} valueText={enabledDisabled(extendedSettings.customTerminologyEnabled)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.customTerminologyEnabled} onChange={(event) => updateExtendedSetting('customTerminologyEnabled', event.target.checked)} /><span>{enabledDisabled(extendedSettings.customTerminologyEnabled)}</span></label>
        <SettingsTextarea rows={5} value={extendedSettings.customTerminologyRules} placeholder={tr('settings.accessibility.customTerminology.placeholder')} onCommit={(value) => updateExtendedSetting('customTerminologyRules', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.accessibility.reduceMotion.title')} description={tr('settings.accessibility.reduceMotion.description')} valueText={onOff(extendedSettings.reduceMotion)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.reduceMotion} onChange={(event) => updateExtendedSetting('reduceMotion', event.target.checked)} /><span>{enabledDisabled(extendedSettings.reduceMotion)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.accessibility.highContrast.title')} description={tr('settings.accessibility.highContrast.description')} valueText={onOff(extendedSettings.highContrast)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.highContrast} onChange={(event) => updateExtendedSetting('highContrast', event.target.checked)} /><span>{enabledDisabled(extendedSettings.highContrast)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.accessibility.enhancedFocus.title')} description={tr('settings.accessibility.enhancedFocus.description')} valueText={onOff(extendedSettings.enhancedFocus)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.enhancedFocus} onChange={(event) => updateExtendedSetting('enhancedFocus', event.target.checked)} /><span>{enabledDisabled(extendedSettings.enhancedFocus)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.accessibility.largeTouchTargets.title')} description={tr('settings.accessibility.largeTouchTargets.description')} valueText={extendedSettings.largeTouchTargets ? '44px' : tr('settings.accessibility.largeTouchTargets.compact')}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.largeTouchTargets} onChange={(event) => updateExtendedSetting('largeTouchTargets', event.target.checked)} /><span>{extendedSettings.largeTouchTargets ? tr('settings.accessibility.largeTouchTargets.guaranteed') : tr('settings.accessibility.largeTouchTargets.compactMode')}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.accessibility.colorBlindFriendlyHighlights.title')} description={tr('settings.accessibility.colorBlindFriendlyHighlights.description')} valueText={extendedSettings.colorBlindFriendlyHighlights ? tr('settings.accessibility.colorBlindFriendlyHighlights.friendly') : tr('settings.accessibility.colorBlindFriendlyHighlights.default')}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.colorBlindFriendlyHighlights} onChange={(event) => updateExtendedSetting('colorBlindFriendlyHighlights', event.target.checked)} /><span>{enabledDisabled(extendedSettings.colorBlindFriendlyHighlights)}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.accessibility.readerReadAloudEnabled.title')} description={tr('settings.accessibility.readerReadAloudEnabled.description')} valueText={enabledDisabled(extendedSettings.readerReadAloudEnabled)}>
        <label className="settings-toggle"><input type="checkbox" checked={extendedSettings.readerReadAloudEnabled} onChange={(event) => updateExtendedSetting('readerReadAloudEnabled', event.target.checked)} /><span>{extendedSettings.readerReadAloudEnabled ? tr('settings.accessibility.readerReadAloudEnabled.showButton') : tr('settings.accessibility.readerReadAloudEnabled.hideButton')}</span></label>
      </SettingControl>
      <SettingControl title={tr('settings.accessibility.readerReadAloudRate.title')} description={tr('settings.accessibility.readerReadAloudRate.description')} valueText={`${extendedSettings.readerReadAloudRate}%`}>
        <SettingsNumberInput min={50} max={200} step={5} value={extendedSettings.readerReadAloudRate} onCommit={(value) => updateExtendedSetting('readerReadAloudRate', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.accessibility.readerReadAloudPitch.title')} description={tr('settings.accessibility.readerReadAloudPitch.description')} valueText={`${extendedSettings.readerReadAloudPitch}%`}>
        <SettingsNumberInput min={50} max={200} step={5} value={extendedSettings.readerReadAloudPitch} onCommit={(value) => updateExtendedSetting('readerReadAloudPitch', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.accessibility.narratorVoice.title')} description={tr('settings.accessibility.narratorVoice.description')} valueText={getVoiceLabel(extendedSettings.readerReadAloudNarratorVoiceURI, voiceOptions, tr)}>
        <ThemedSelect label={tr('settings.accessibility.narratorVoice.title')} value={extendedSettings.readerReadAloudNarratorVoiceURI} options={voiceOptions} onChange={(value) => updateExtendedSetting('readerReadAloudNarratorVoiceURI', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.accessibility.maleVoice.title')} description={tr('settings.accessibility.maleVoice.description')} valueText={getVoiceLabel(extendedSettings.readerReadAloudMaleVoiceURI, voiceOptions, tr)}>
        <ThemedSelect label={tr('settings.accessibility.maleVoice.title')} value={extendedSettings.readerReadAloudMaleVoiceURI} options={voiceOptions} onChange={(value) => updateExtendedSetting('readerReadAloudMaleVoiceURI', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.accessibility.femaleVoice.title')} description={tr('settings.accessibility.femaleVoice.description')} valueText={getVoiceLabel(extendedSettings.readerReadAloudFemaleVoiceURI, voiceOptions, tr)}>
        <ThemedSelect label={tr('settings.accessibility.femaleVoice.title')} value={extendedSettings.readerReadAloudFemaleVoiceURI} options={voiceOptions} onChange={(value) => updateExtendedSetting('readerReadAloudFemaleVoiceURI', value)} />
      </SettingControl>
      <SettingControl title={tr('settings.accessibility.characterVoiceRules.title')} description={tr('settings.accessibility.characterVoiceRules.description')} valueText={extendedSettings.readerReadAloudCharacterVoiceRules.trim() ? tr('settings.accessibility.characterVoiceRules.configured') : tr('settings.accessibility.characterVoiceRules.notConfigured')}>
        <SettingsTextarea
          rows={6}
          value={extendedSettings.readerReadAloudCharacterVoiceRules}
          placeholder={tr('settings.accessibility.characterVoiceRules.placeholder')}
          onCommit={(value) => updateExtendedSetting('readerReadAloudCharacterVoiceRules', value)}
        />
      </SettingControl>
    </SettingsSection>
  );
}

function useSpeechSynthesisVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const refreshVoices = () => setVoices(window.speechSynthesis.getVoices());
    refreshVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', refreshVoices);
  }, []);

  return voices;
}

function getVoiceLabel(value: string, options: Array<{ value: string; label: string }>, t: (key: string) => string) {
  return options.find((option) => option.value === value)?.label ?? (value ? t('settings.accessibility.voice.unavailable') : t('settings.accessibility.voice.systemDefault'));
}
