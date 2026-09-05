import i18n from '@/i18n';

const REGIONAL_TAG = {
  en: 'en-US',
  es: 'es-DO',
};

function resolveRegionalTag(locale) {
  const active = locale || i18n.global.locale.value;
  return REGIONAL_TAG[active] || REGIONAL_TAG.en;
}

export function formatDate(value, locale) {
  if (!value) return '';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return str;
  return parsed.toLocaleDateString(resolveRegionalTag(locale));
}

export function formatDateTime(value, locale) {
  if (!value) return '';
  return new Date(value).toLocaleString(resolveRegionalTag(locale));
}
