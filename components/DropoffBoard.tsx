'use client';

import type { BusData, BusName, CategoryFilter, CategoryStore, DailyChanges, DayOfWeek, StudentCategory } from '@/types';
import { BUS_NAMES, DROPOFF_SECTIONS } from '@/types';
import { makeChangeKey, makeStudentKey } from '@/lib/storage';
import { studentRunsToday } from '@/lib/dateUtils';

interface Props {
  buses: BusData[];
  changes: DailyChanges;
  categoryStore: CategoryStore;
  categoryFilter: CategoryFilter;
  today: DayOfWeek;
  tempStudents: Record<string, import('@/types').Student[]>;
  allDayOverrides: Record<string, Record<string, string>>;
}

const CATEGORY_COLOR: Record<Exclude<StudentCategory, ''>, string> = {
  MK: 'bg-purple-100 text-purple-700',
  AK: 'bg-orange-100 text-orange-700',
  '초등': 'bg-teal-100 text-teal-700',
};

const SECTION_LABELS: Record<string, string> = {
  '3시 하원': '3시 하원',
  '4시 30분 하원': '4시 30분 하원',
  '6시 하원': '6시 하원',
};

export default function DropoffBoard({ buses, changes, categoryStore, categoryFilter, today, tempStudents, allDayOverrides }: Props) {
  // For each dropoff section × each bus, collect active students
  type StudentEntry = { name: string; isAbsent: boolean; category: StudentCategory };
  type BoardData = Record<string, Record<BusName, StudentEntry[]>>; // section → bus → students

  const board: BoardData = {};
  for (const section of DROPOFF_SECTIONS) {
    board[section] = {} as Record<BusName, StudentEntry[]>;
    for (const busName of BUS_NAMES) {
      board[section][busName] = [];
    }
  }

  for (const bus of buses) {
    for (const section of bus.sections) {
      if (!DROPOFF_SECTIONS.includes(section.name)) continue;

      const tempKey = `${bus.name}_${section.name}`;
      const allStudents = [...section.students, ...(tempStudents[tempKey] ?? [])];

      for (const student of allStudents) {
        const key = makeChangeKey(bus.name, section.name, student.id);
        const change = changes[key];

        // Skip individual-changed base students (going home on their own)
        if (change === 'individual') continue;
        // Skip 개별 bus students unless changed to shuttle
        if (bus.name === '개별' && change !== 'shuttle') continue;
        // Day filter (temp students always show)
        if (!student.isTemp) {
          const studentKey = makeStudentKey(bus.name, section.name, student.id);
          const overrideMap = allDayOverrides[studentKey] ?? {};
          const effectiveMwf = `${section.name}||${bus.name}||mwf` in overrideMap ? overrideMap[`${section.name}||${bus.name}||mwf`] : student.dayMwf;
          const effectiveTuTh = `${section.name}||${bus.name}||tuth` in overrideMap ? overrideMap[`${section.name}||${bus.name}||tuth`] : student.dayTuTh;
          if (!studentRunsToday(effectiveMwf, effectiveTuTh, today)) continue;
        }
        // Skip deleted temp students
        if (typeof change === 'object' && change !== null) continue;

        const category = categoryStore[makeStudentKey(bus.name, section.name, student.id)] ?? '';
        // Category filter
        if (categoryFilter !== '전체' && category !== categoryFilter) continue;

        const isAbsent = change === 'absent';

        board[section.name][bus.name].push({ name: student.name, isAbsent, category });
      }
    }
  }

  // Count totals for summary
  const counts: Record<string, number> = { 전체: 0, MK: 0, AK: 0, '초등': 0, '미분류': 0 };
  for (const bus of buses) {
    for (const section of bus.sections) {
      if (!DROPOFF_SECTIONS.includes(section.name)) continue;
      const tempKey = `${bus.name}_${section.name}`;
      const allStudents = [...section.students, ...(tempStudents[tempKey] ?? [])];
      for (const student of allStudents) {
        const key = makeChangeKey(bus.name, section.name, student.id);
        const change = changes[key];
        if (change === 'individual') continue;
        if (bus.name === '개별' && change !== 'shuttle') continue;
        if (!student.isTemp) {
          const studentKey = makeStudentKey(bus.name, section.name, student.id);
          const overrideMap = allDayOverrides[studentKey] ?? {};
          const effectiveMwf = `${section.name}||${bus.name}||mwf` in overrideMap ? overrideMap[`${section.name}||${bus.name}||mwf`] : student.dayMwf;
          const effectiveTuTh = `${section.name}||${bus.name}||tuth` in overrideMap ? overrideMap[`${section.name}||${bus.name}||tuth`] : student.dayTuTh;
          if (!studentRunsToday(effectiveMwf, effectiveTuTh, today)) continue;
        }
        if (typeof change === 'object' && change !== null) continue;
        if (change === 'absent') continue;
        counts['전체']++;
        const cat = categoryStore[makeStudentKey(bus.name, section.name, student.id)] ?? '';
        if (cat === 'MK') counts['MK']++;
        else if (cat === 'AK') counts['AK']++;
        else if (cat === '초등') counts['초등']++;
        else counts['미분류']++;
      }
    }
  }

  return (
    <div>
      {/* Category summary */}
      <div className="mb-4 text-sm text-gray-500 flex gap-3 flex-wrap">
        <span>전체 <strong className="text-gray-800">{counts['전체']}명</strong></span>
        <span className="text-purple-700">MK <strong>{counts['MK']}명</strong></span>
        <span className="text-orange-700">AK <strong>{counts['AK']}명</strong></span>
        <span className="text-teal-700">초등 <strong>{counts['초등']}명</strong></span>
        {counts['미분류'] > 0 && (
          <span className="text-gray-400">미분류 {counts['미분류']}명</span>
        )}
      </div>

      {DROPOFF_SECTIONS.map((sectionName) => {
        // Check if any bus has students in this section
        const hasSomeStudents = BUS_NAMES.some((b) => board[sectionName][b].length > 0);

        return (
          <div key={sectionName} className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-green-200" />
              <span className="text-sm font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                {SECTION_LABELS[sectionName]}
              </span>
              <div className="h-px flex-1 bg-green-200" />
            </div>

            {!hasSomeStudents ? (
              <p className="text-center text-gray-400 text-sm py-4">해당 학생 없음</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {BUS_NAMES.map((busName) => {
                  const students = board[sectionName][busName];
                  if (students.length === 0) return null;
                  return (
                    <div key={busName} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                      <div className="text-xs font-bold text-gray-600 mb-2 pb-1.5 border-b border-gray-100">
                        {busName}
                        <span className="ml-1 text-gray-400 font-normal">
                          ({students.filter((s) => !s.isAbsent).length}명)
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {students.map((s, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <span className={s.isAbsent ? 'line-through text-gray-300 text-sm' : 'text-sm text-gray-800'}>
                              {s.name}
                            </span>
                            {s.category && !s.isAbsent && (
                              <span className={`text-[10px] px-1 py-0.5 rounded font-semibold ${CATEGORY_COLOR[s.category as Exclude<StudentCategory, ''>]}`}>
                                {s.category}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
