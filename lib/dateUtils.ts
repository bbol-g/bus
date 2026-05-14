import type { DayOfWeek, DayString } from '@/types';

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
  const v = dayValue.trim() as DayString;
  if (v === '매일') return true;
  if (v === '월수금') return today === '월' || today === '수' || today === '금';
  if (v === '화목') return today === '화' || today === '목';
  return v === today;
}

export function studentRunsToday(dayMwf: string, dayTuTh: string, today: DayOfWeek): boolean {
  return matchesDay(dayMwf, today) || matchesDay(dayTuTh, today);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${month}월 ${day}일 (${dow})`;
}
