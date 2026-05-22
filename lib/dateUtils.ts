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
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${month}월 ${day}일 (${dow})`;
}

export function getDayOfWeekFromStr(dateStr: string): DayOfWeek | null {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return DAY_MAP[dow] ?? null;
}

export function addDaysToStr(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  const yr = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const dy = String(date.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}
