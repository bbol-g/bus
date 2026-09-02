import type { DayOfWeek } from '@/types';

const DAY_MAP: Record<number, DayOfWeek> = {
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
};

// 한국 표준시 UTC+9 (서머타임 없음)
function nowKST(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

export function getTodayKorean(): DayOfWeek | null {
  const dow = nowKST().getUTCDay();
  return DAY_MAP[dow] ?? null;
}

export function getTodayString(): string {
  return nowKST().toISOString().slice(0, 10);
}

export function matchesDay(dayValue: string, today: DayOfWeek): boolean {
  if (!dayValue || dayValue.trim() === '') return false;
  const v = dayValue.trim();
  if (v === '매일') return true;
  // 각 요일 한글자가 포함되는지 확인 (월수금, 화목, 월수, 월화목 등 모든 조합 처리)
  return v.includes(today);
}

export function studentRunsToday(dayMwf: string, dayTuTh: string, today: DayOfWeek): boolean {
  return matchesDay(dayMwf, today) || matchesDay(dayTuTh, today);
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = ['일', '월', '화', '수', '목', '금', '토'][date.getUTCDay()];
  return `${m}월 ${d}일 (${dow})`;
}

export function getDayOfWeekFromStr(dateStr: string): DayOfWeek | null {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return DAY_MAP[dow] ?? null;
}

// 해당 날짜가 속한 주의 월요일(YYYY-MM-DD). 주말이면 다가오는 주 월요일로.
export function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay(); // 0=일 … 6=토
  const deltaToMonday = dow === 0 ? 1 : 1 - dow;
  return addDaysToStr(dateStr, deltaToMonday);
}

export function addDaysToStr(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  const yr = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(date.getUTCDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}
