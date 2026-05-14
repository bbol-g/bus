export function normalizeTime(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const m = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function formatDisplayTime(value) {
  const t = normalizeTime(value);
  if (!t) return '-';
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 ? '오전' : '오후';
  const dh = h % 12 || 12;
  return `${suffix} ${dh}:${String(m).padStart(2, '0')}`;
}

export function sortByTime(a, b) {
  const ta = normalizeTime(a) || '99:99';
  const tb = normalizeTime(b) || '99:99';
  return ta.localeCompare(tb);
}
