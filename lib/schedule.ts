import type {
  BusName,
  ChangeState,
  DailyChanges,
  DayOfWeek,
  SectionType,
  ShuttleBase,
  Student,
} from '@/types';
import { ALL_SECTIONS, BUS_NAMES } from '@/types';
import { studentRunsToday } from './dateUtils';
import { makeChangeKey, makeStudentKey } from './storage';

export type DayOverrides = Record<string, Record<string, string>>;

// 요일 override(앱에서 수정한 탑승 요일)를 반영한 실제 월수금/화목 요일값
export function effectiveDays(
  student: Student,
  bus: BusName,
  section: SectionType,
  dayOverrides: DayOverrides
): { mwf: string; tuth: string } {
  const o = dayOverrides[makeStudentKey(bus, section, student.id)] ?? {};
  const mwfKey = `${section}||${bus}||mwf`;
  const tuthKey = `${section}||${bus}||tuth`;
  return {
    mwf: mwfKey in o ? o[mwfKey] : student.dayMwf,
    tuth: tuthKey in o ? o[tuthKey] : student.dayTuTh,
  };
}

// 해당 학생이 특정 요일에 이 (호차·섹션)에서 셔틀을 타는지 (요일 override 반영)
export function studentRidesOn(
  student: Student,
  bus: BusName,
  section: SectionType,
  day: DayOfWeek,
  dayOverrides: DayOverrides
): boolean {
  const { mwf, tuth } = effectiveDays(student, bus, section, dayOverrides);
  return studentRunsToday(mwf, tuth, day);
}

export interface CellStudent {
  student: Student;
  state: ChangeState | null; // null=평상시 셔틀, 'absent'=결석, 'individual'=개별, 'shuttle'=셔틀지정
}

// 한 (호차·섹션)에서 특정 요일에 타는 학생 목록 (결석 등 당일 변경 반영 여부 선택)
function cellStudents(
  data: ShuttleBase,
  bus: BusName,
  section: SectionType,
  day: DayOfWeek,
  changes: DailyChanges,
  dayOverrides: DayOverrides,
  applyChanges: boolean
): CellStudent[] {
  const busData = data.buses.find((b) => b.name === bus);
  const sec = busData?.sections.find((s) => s.name === section);
  if (!sec) return [];
  const out: CellStudent[] = [];
  for (const student of sec.students) {
    if (!studentRidesOn(student, bus, section, day, dayOverrides)) continue;
    let state: ChangeState | null = null;
    if (applyChanges) {
      const c = changes[makeChangeKey(bus, section, student.id)];
      if (typeof c === 'object' && c !== null) continue; // temp 객체는 여기서 제외
      state = (c as ChangeState) ?? null;
    }
    out.push({ student, state });
  }
  // 시간순 정렬 (빈 시간은 뒤로)
  out.sort((a, b) => timeKey(a.student.time) - timeKey(b.student.time));
  return out;
}

function timeKey(t: string): number {
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 9999;
  return Number(m[1]) * 60 + Number(m[2]);
}

// 어떤 호차들이 실제로 학생을 갖고 있는지 (빈 호차 열 숨김용)
export function busesWithStudents(data: ShuttleBase): BusName[] {
  return BUS_NAMES.filter((name) => {
    const b = data.buses.find((x) => x.name === name);
    return b && b.sections.some((s) => s.students.length > 0);
  });
}

// 하루 그리드: 섹션(행) × 호차(열) → 셀 학생목록 (당일 변경 반영)
export interface DayGrid {
  sections: SectionType[];
  buses: BusName[];
  cell: (section: SectionType, bus: BusName) => CellStudent[];
}

export function buildDayGrid(
  data: ShuttleBase,
  day: DayOfWeek,
  changes: DailyChanges,
  dayOverrides: DayOverrides
): DayGrid {
  const buses = busesWithStudents(data);
  const sections = ALL_SECTIONS.filter((sec) =>
    buses.some((bus) => cellStudents(data, bus, sec, day, changes, dayOverrides, true).length > 0)
  );
  const cache = new Map<string, CellStudent[]>();
  const cell = (section: SectionType, bus: BusName) => {
    const k = `${bus}|${section}`;
    if (!cache.has(k)) cache.set(k, cellStudents(data, bus, section, day, changes, dayOverrides, true));
    return cache.get(k)!;
  };
  return { sections, buses, cell };
}

// 주간 그리드: 섹션×호차(행) × 요일(열) → 셀 학생목록 (반복 기본 스케줄, 당일 변경 미반영)
export interface WeekGrid {
  rows: { section: SectionType; bus: BusName }[];
  days: DayOfWeek[];
  cell: (section: SectionType, bus: BusName, day: DayOfWeek) => CellStudent[];
}

export function buildWeekGrid(
  data: ShuttleBase,
  days: DayOfWeek[],
  dayOverrides: DayOverrides
): WeekGrid {
  const buses = busesWithStudents(data);
  const rows: { section: SectionType; bus: BusName }[] = [];
  for (const section of ALL_SECTIONS) {
    for (const bus of buses) {
      const any = days.some(
        (d) => cellStudents(data, bus, section, d, {}, dayOverrides, false).length > 0
      );
      if (any) rows.push({ section, bus });
    }
  }
  const cache = new Map<string, CellStudent[]>();
  const cell = (section: SectionType, bus: BusName, day: DayOfWeek) => {
    const k = `${bus}|${section}|${day}`;
    if (!cache.has(k)) cache.set(k, cellStudents(data, bus, section, day, {}, dayOverrides, false));
    return cache.get(k)!;
  };
  return { rows, days, cell };
}
