const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function getKoreanDayOfWeek(date) {
  const d = new Date(date);
  return DAYS[d.getDay()];
}

export function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toInputDate(date) {
  return formatDate(date);
}
