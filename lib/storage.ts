import type { DailyChanges, ChangeState, CategoryStore, StudentCategory } from '@/types';

export function makeChangeKey(bus: string, section: string, studentId: string): string {
  return `${bus}_${section}_${studentId}`;
}

export function makeStudentKey(bus: string, section: string, studentId: string): string {
  return `${bus}||${section}||${studentId}`;
}

export function setStudentCategory(
  cats: CategoryStore,
  studentKey: string,
  category: StudentCategory
): CategoryStore {
  const next = { ...cats };
  if (category === '') {
    delete next[studentKey];
  } else {
    next[studentKey] = category;
  }
  return next;
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
