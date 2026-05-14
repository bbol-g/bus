'use client';

import type { BusData, DailyChanges, ChangeState, Student, BusName } from '@/types';
import SectionTable from './SectionTable';
import { studentRunsToday } from '@/lib/dateUtils';
import type { DayOfWeek } from '@/types';
import { makeChangeKey } from '@/lib/storage';

interface Props {
  bus: BusData;
  today: DayOfWeek | null;
  changes: DailyChanges;
  tempStudents: Record<string, Student[]>; // key: `${bus}_${section}`
  onToggle: (key: string, state: ChangeState | null) => void;
  onDelete: (studentId: string, isTemp: boolean, bus: BusName, section: string) => void;
  onAddTemp: (bus: BusName, section: string, student: { name: string; place: string; time: string; note: string }) => void;
}

export default function HoTab({ bus, today, changes, tempStudents, onToggle, onDelete, onAddTemp }: Props) {
  const filteredSections = bus.sections.map((section) => {
    // Filter students by day; weekend → show all as fallback (show message)
    const filtered = today
      ? section.students.filter((s) => {
          // Check if marked absent-deleted → skip
          const key = makeChangeKey(bus.name, section.name, s.id);
          const change = changes[key];
          if (typeof change === 'object' && change !== null) return false; // shouldn't happen for base students
          return studentRunsToday(s.dayMwf, s.dayTuTh, today);
        })
      : [];
    const tempKey = `${bus.name}_${section.name}`;
    const temps = (tempStudents[tempKey] ?? []).filter((s) => {
      const key = makeChangeKey(bus.name, section.name, s.id);
      // Temp deleted students are stored with a special marker
      return !(changes[key] as unknown as string === '__deleted__');
    });
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
          onToggle={onToggle}
          onDelete={onDelete}
          onAddTemp={onAddTemp}
        />
      ))}
    </div>
  );
}
