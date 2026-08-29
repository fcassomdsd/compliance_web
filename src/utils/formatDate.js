export function formatDate(value) {
  if (!value) return '';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return str;
  return parsed.toLocaleDateString('en-US');
}

export function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-US');
}
