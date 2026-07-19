import { createContext, useContext } from 'react';
import { enUS } from './en-US';
import { esES } from './es-ES';
import { frFR } from './fr-FR';
import { jaJP } from './ja-JP';
import { koKR } from './ko-KR';
import { zhCN, type Messages, type TranslationKey } from './zh-CN';

export type { Messages, TranslationKey };

export type Locale = 'zh-CN' | 'en-US' | 'ja-JP' | 'es-ES' | 'fr-FR' | 'ko-KR';
export type LocalePreference = Locale | 'system';
export type TranslationFallbackStrategy = 'default-locale' | 'key';
export type CustomTerminologyRule = { source: string; target: string };
export type CustomTerminologyOptions = {
  enabled: boolean;
  rules: CustomTerminologyRule[];
};

export const DEFAULT_LOCALE: Locale = 'zh-CN';
export const LOCALE_STORAGE_KEY = 'bookmind.locale';

const messages: Record<Locale, Messages> = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'ja-JP': jaJP,
  'es-ES': esES,
  'fr-FR': frFR,
  'ko-KR': koKR,
};

export type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

export type I18nContextValue = {
  locale: Locale;
  localePreference: LocalePreference;
  setLocalePreference: (locale: LocalePreference) => void;
  t: Translator;
};

export const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  localePreference: DEFAULT_LOCALE,
  setLocalePreference: () => undefined,
  t: createTranslator(DEFAULT_LOCALE),
});

export function isLocale(value: unknown): value is Locale {
  return value === 'zh-CN' || value === 'en-US' || value === 'ja-JP' || value === 'es-ES' || value === 'fr-FR' || value === 'ko-KR';
}

export function isLocalePreference(value: unknown): value is LocalePreference {
  return value === 'system' || isLocale(value);
}

export function loadStoredLocalePreference(): LocalePreference {
  const stored = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY);
  return isLocalePreference(stored) ? stored : DEFAULT_LOCALE;
}

export function saveStoredLocalePreference(locale: LocalePreference) {
  globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
}

export function resolveLocalePreference(preference: LocalePreference, navigatorLanguage = globalThis.navigator?.language): Locale {
  if (preference !== 'system') return preference;
  const language = String(navigatorLanguage ?? '').toLocaleLowerCase();
  if (language.startsWith('en')) return 'en-US';
  if (language.startsWith('ja')) return 'ja-JP';
  if (language.startsWith('es')) return 'es-ES';
  if (language.startsWith('fr')) return 'fr-FR';
  if (language.startsWith('ko')) return 'ko-KR';
  return DEFAULT_LOCALE;
}

export function createTranslator(locale: Locale, fallbackStrategy: TranslationFallbackStrategy = 'default-locale', customTerminology?: CustomTerminologyOptions): Translator {
  return (key, values) => {
    const template = messages[locale][key] ?? (fallbackStrategy === 'default-locale' ? messages[DEFAULT_LOCALE][key] : undefined) ?? key;
    const translated = values ? Object.entries(values).reduce(
      (translated, [name, value]) => translated.replaceAll(`{${name}}`, String(value)),
      template,
    ) : template;
    return applyCustomTerminology(translated, customTerminology);
  };
}

function applyCustomTerminology(text: string, customTerminology?: CustomTerminologyOptions) {
  if (!customTerminology?.enabled || !customTerminology.rules.length) return text;
  return customTerminology.rules.reduce((current, rule) => (
    rule.source ? current.replaceAll(rule.source, rule.target) : current
  ), text);
}

export function useI18n() {
  return useContext(I18nContext);
}
