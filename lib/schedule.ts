import type { BusName, DayOfWeek, SectionType, Student } from '@/types';
import { studentRunsToday } from './dateUtils';
import { makeStudentKey } from './storage';

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
