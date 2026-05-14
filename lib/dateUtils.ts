import type { DayOfWeek } from '@/types';

const DAY_MAP: Record<number, DayOfWeek> = {
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
};

export function getTodayKorean(): DayOfWeek | null {
  const dow = new Date().getDay();
  return DAY_MAP[dow] ?? null;
}

export function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function matchesDay(dayValue: string, today: DayOfWeek): boolean {
  if (!dayValue || dayValue.trim() === '') return false;
  const v = dayValue.trim();
  if (v === '매일' || v === '전일' || v === '항상') return true;
  // Handles any combination: '월수금', '화목', '월수', '월화수금', single chars, etc.
  const DAY_CHARS: DayOfWeek[] = ['월', '화', '수', '목', '금'];
  if (DAY_CHARS.some(d => v.includes(d))) return v.includes(today);
  return false;
}

export function studentRunsToday(dayMwf: string, dayTuTh: string, today: DayOfWeek): boolean {
  // If both day columns are empty, treat as 매일 (every day)
  if (!dayMwf.trim() && !dayTuTh.trim()) return true;
  return matchesDay(dayMwf, today) || matchesDay(dayTuTh, today);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${month}월 ${day}일 (${dow})`;
}
