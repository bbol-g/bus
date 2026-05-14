import type { ShuttleBase, DailyChanges, ChangeState, CategoryStore, StudentCategory } from '@/types';
import { getTodayString } from './dateUtils';

const BASE_KEY = 'shuttleBase';
const CHANGES_PREFIX = 'shuttleChanges_';
const CATEGORIES_KEY = 'shuttleCategories';

export function saveBase(data: ShuttleBase): void {
  localStorage.setItem(BASE_KEY, JSON.stringify(data));
}

export function loadBase(): ShuttleBase | null {
  const raw = localStorage.getItem(BASE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ShuttleBase;
  } catch {
    return null;
  }
}

export function clearBase(): void {
  localStorage.removeItem(BASE_KEY);
}

export function loadCategories(): CategoryStore {
  const raw = localStorage.getItem(CATEGORIES_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as CategoryStore;
  } catch {
    return {};
  }
}

export function saveCategories(cats: CategoryStore): void {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
}

export function setStudentCategory(
  cats: CategoryStore,
  studentName: string,
  category: StudentCategory
): CategoryStore {
  const next = { ...cats };
  if (category === '') {
    delete next[studentName];
  } else {
    next[studentName] = category;
  }
  return next;
}

function changesKey(date: string): string {
  return `${CHANGES_PREFIX}${date}`;
}

export function loadTodayChanges(): DailyChanges {
  purgePastChanges();
  const raw = localStorage.getItem(changesKey(getTodayString()));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as DailyChanges;
  } catch {
    return {};
  }
}

export function saveTodayChanges(changes: DailyChanges): void {
  localStorage.setItem(changesKey(getTodayString()), JSON.stringify(changes));
}

export function purgePastChanges(): void {
  const today = getTodayString();
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CHANGES_PREFIX)) {
      const date = key.slice(CHANGES_PREFIX.length);
      if (date < today) toRemove.push(key);
    }
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}

export function makeChangeKey(bus: string, section: string, studentId: string): string {
  return `${bus}_${section}_${studentId}`;
}

export function setStudentChange(
  changes: DailyChanges,
  key: string,
  state: ChangeState | null
): DailyChanges {
  const next = { ...changes };
  if (state === null) {
    delete next[key];
  } else {
    next[key] = state;
  }
  return next;
}
