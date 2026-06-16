'use client';

import type { BusData, DailyChanges, ChangeState, Student, BusName, StudentCategory, CategoryStore } from '@/types';
import SectionTable from './SectionTable';
import { studentRunsToday } from '@/lib/dateUtils';
import type { DayOfWeek } from '@/types';
import { makeChangeKey, makeStudentKey } from '@/lib/storage';

interface Props {
  bus: BusData;
  today: DayOfWeek | null;
  changes: DailyChanges;
  tempStudents: Record<string, Student[]>;
  categoryStore: CategoryStore;
  allDayOverrides: Record<string, Record<string, string>>;
  onToggle: (key: string, state: ChangeState | null) => void;
  onDelete: (studentId: string, isTemp: boolean, bus: BusName, section: string) => void;
  onAddTemp: (bus: BusName, section: string, student: { name: string; place: string; time: string; note: string }) => void;
  onSetCategory: (studentKey: string, category: StudentCategory) => void;
  onDayOverride: (studentKey: string, updates: Record<string, string>) => void;
}

export default function HoTab({ bus, today, changes, tempStudents, categoryStore, allDayOverrides, onToggle, onDelete, onAddTemp, onSetCategory, onDayOverride }: Props) {
  const filteredSections = bus.sections.map((section) => {
    const filtered = today
      ? section.students.filter((s) => {
          const changeKey = makeChangeKey(bus.name, section.name, s.id);
          const change = changes[changeKey];
          if (typeof change === 'object' && change !== null) return false;

          // 요일 override 적용
          const mwfKey = `${section.name}||${bus.name}||mwf`;
          const tuthKey = `${section.name}||${bus.name}||tuth`;
          const studentOverrides = allDayOverrides[makeStudentKey(bus.name, section.name, s.id)] ?? {};
          const effectiveMwf = mwfKey in studentOverrides ? studentOverrides[mwfKey] : s.dayMwf;
          const effectiveTuTh = tuthKey in studentOverrides ? studentOverrides[tuthKey] : s.dayTuTh;

          return studentRunsToday(effectiveMwf, effectiveTuTh, today);
        })
      : [];
    const tempKey = `${bus.name}_${section.name}`;
    const temps = tempStudents[tempKey] ?? [];
    return { ...section, students: filtered, temps };
  });

  return (
    <div>
      {!today && (
        <div className="text-center text-gray-400 py-8">
          오늘은 주말입니다. 셔틀 운행이 없습니다.
        </div>
      )}
      {today && filteredSections.map((section) => (
        <SectionTable
          key={section.name}
          section={{ name: section.name, students: section.students }}
          bus={bus.name}
          changes={changes}
          tempStudents={section.temps}
          categoryStore={categoryStore}
          allDayOverrides={allDayOverrides}
          onToggle={onToggle}
          onDelete={onDelete}
          onAddTemp={onAddTemp}
          onSetCategory={onSetCategory}
          onDayOverride={onDayOverride}
        />
      ))}
    </div>
  );
}
