import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import es from './locales/es.json';

export const SUPPORTED_LOCALES = ['en', 'es'];
export const DEFAULT_LOCALE = 'en';

export function resolveSupportedLocale(candidate) {
  if (typeof candidate !== 'string') {
    return null;
  }
  const normalized = candidate.trim().toLowerCase().slice(0, 2);
  return SUPPORTED_LOCALES.includes(normalized) ? normalized : null;
}

export function detectBrowserLocale() {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LOCALE;
  }
  const candidates = navigator.languages && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];

  for (const candidate of candidates) {
    const resolved = resolveSupportedLocale(candidate);
    if (resolved) {
      return resolved;
    }
  }
  return DEFAULT_LOCALE;
}

const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, es },
});

export default i18n;
