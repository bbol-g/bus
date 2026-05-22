'use client';

import { useState } from 'react';
import type { Student, ChangeState, BusName, SectionType, StudentCategory, CategoryStore, DayOfWeek } from '@/types';
import { DAY_OF_WEEK } from '@/types';
import { matchesDay } from '@/lib/dateUtils';

interface Props {
  student: Student;
  bus: BusName;
  section: SectionType;
  changeState: ChangeState | null;
  isIndivStudent: boolean;
  categoryStore: CategoryStore;
  dayOverrides: Record<string, string>;
  onToggle: (key: string, state: ChangeState | null) => void;
  onDelete: (studentId: string, isTemp: boolean) => void;
  onSetCategory: (studentName: string, category: StudentCategory) => void;
  onDayOverride: (key: string, newDays: string) => void;
  changeKey: string;
}

const CYCLE_ORDER: StudentCategory[] = ['', 'MK', 'AK', '초등'];
const CATEGORY_BADGE: Record<string, string> = {
  '': 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200',
  MK: 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200',
  AK: 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200',
  '초등': 'bg-teal-100 text-teal-700 border-teal-300 hover:bg-teal-200',
};

function NoteTooltip({ note }: { note: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        className="text-amber-500 hover:text-amber-600 text-base leading-none"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        aria-label={note}
      >
        ⚠️
      </button>
      {visible && (
        <div className="absolute z-30 bottom-full right-0 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap max-w-xs">
          {note}
          <div className="absolute top-full right-2 border-4 border-transparent border-t-gray-800" />
        </div>
      )}
    </div>
  );
}

export default function StudentRow({
  student,
  bus,
  section,
  changeState,
  isIndivStudent,
  categoryStore,
  dayOverrides,
  onToggle,
  onDelete,
  onSetCategory,
  onDayOverride,
  changeKey,
}: Props) {
  const isAbsent = changeState === 'absent';
  const isIndividual = changeState === 'individual';
  const isShuttle = changeState === 'shuttle';
  const currentCategory = categoryStore[student.name] ?? '';

  let rowClass = 'hover:bg-gray-50';
  if (isAbsent) rowClass = 'bg-gray-100 opacity-60';
  else if (isIndividual) rowClass = 'bg-yellow-50';
  else if (isShuttle) rowClass = 'bg-blue-50';

  function cycleCategory() {
    const idx = CYCLE_ORDER.indexOf(currentCategory);
    onSetCategory(student.name, CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length]);
  }

  const isPickupSection = ['9시 30분 등원', '3시 등원', '4시 30분 등원'].includes(section);

  // 요일 override 키 & 현재 유효 요일
  const overrideKey = `${section}||${bus}||${student.dayMwf ? 'mwf' : 'tuth'}`;
  const effectiveDays = overrideKey in dayOverrides
    ? dayOverrides[overrideKey]
    : (student.dayMwf || student.dayTuTh || '');

  function toggleDay(day: DayOfWeek) {
    const wasActive = matchesDay(effectiveDays, day);
    const newDays = DAY_OF_WEEK.filter(d =>
      d === day ? !wasActive : matchesDay(effectiveDays, d)
    ).join('');
    onDayOverride(overrideKey, newDays);
  }

  return (
    <tr className={`${rowClass} border-b border-gray-100 transition-colors`}>
      {/* 시간 */}
      <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap w-14">{student.time}</td>

      {/* 장소: 데스크톱만 표시 */}
      <td className="hidden sm:table-cell px-3 py-2 text-sm text-gray-600 whitespace-nowrap max-w-[160px] truncate">{student.place}</td>

      {/* 아동명 + 요일 토글 */}
      <td className="px-3 py-2 text-sm font-medium">
        <div className={isAbsent ? 'line-through text-gray-400' : 'text-gray-900'}>
          {student.name}
          {isIndividual && (
            <span className="ml-1.5 inline-block bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded font-semibold">개별</span>
          )}
          {isShuttle && (
            <span className="ml-1.5 inline-block bg-blue-400 text-white text-xs px-1.5 py-0.5 rounded font-semibold">셔틀</span>
          )}
        </div>
        {student.place && (
          <div className="sm:hidden text-xs text-gray-400 mt-0.5 font-normal truncate max-w-[120px]">{student.place}</div>
        )}
        {!student.isTemp && (
          <div className="flex gap-0.5 mt-1">
            {DAY_OF_WEEK.map(day => {
              const active = matchesDay(effectiveDays, day);
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  title={`${day}요일 ${active ? '제외' : '포함'}`}
                  className={`text-[10px] w-5 h-5 rounded font-bold transition-colors ${
                    active
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-100 text-gray-300 hover:bg-gray-200 hover:text-gray-500'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        )}
      </td>

      {/* 구분 배지 */}
      <td className="px-2 py-2 w-14">
        <button
          onClick={cycleCategory}
          title="클릭하여 구분 변경"
          className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors whitespace-nowrap ${CATEGORY_BADGE[currentCategory]}`}
        >
          {currentCategory || '구분'}
        </button>
      </td>

      {/* 액션 버튼 */}
      <td className="px-2 py-2">
        <div className="flex items-center gap-1 whitespace-nowrap">
          <button
            onClick={() => onToggle(changeKey, isAbsent ? null : 'absent')}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              isAbsent ? 'bg-gray-500 text-white border-gray-500' : 'border-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
          >
            결석
          </button>
          {!isIndivStudent && (
            <button
              onClick={() => onToggle(changeKey, isIndividual ? null : 'individual')}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                isIndividual ? 'bg-yellow-400 text-yellow-900 border-yellow-400' : 'border-gray-300 text-gray-600 hover:bg-yellow-50'
              }`}
            >
              {isPickupSection ? '개별등원' : '개별하원'}
            </button>
          )}
          {isIndivStudent && (
            <button
              onClick={() => onToggle(changeKey, isShuttle ? null : 'shuttle')}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                isShuttle ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-300 text-gray-600 hover:bg-blue-50'
              }`}
            >
              셔틀
            </button>
          )}
          <button
            onClick={() => onDelete(student.id, student.isTemp ?? false)}
            className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
          >
            삭제
          </button>
        </div>
      </td>

      {/* 특이사항 */}
      <td className="px-2 py-2 w-8 text-center">
        {student.note ? <NoteTooltip note={student.note} /> : null}
      </td>
    </tr>
  );
}
