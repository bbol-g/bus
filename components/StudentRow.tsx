'use client';

import { useEffect, useRef, useState } from 'react';
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
  onSetCategory: (studentKey: string, category: StudentCategory) => void;
  onDayOverride: (studentKey: string, key: string, newDays: string) => void;
  changeKey: string;
  studentKey: string;
}

const CATEGORY_ACTIVE: Record<string, string> = {
  MK: 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200',
  AK: 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200',
  '초등': 'bg-teal-100 text-teal-700 border-teal-300 hover:bg-teal-200',
};
const CATEGORY_INACTIVE = 'bg-white text-gray-300 border-gray-200 hover:border-gray-300 hover:text-gray-500';

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

function DayBadge({
  effectiveDays,
  isOverridden,
  onToggle,
}: {
  effectiveDays: string;
  isOverridden: boolean;
  onToggle: (day: DayOfWeek) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const activeDays = DAY_OF_WEEK.filter(d => matchesDay(effectiveDays, d));
  const label = activeDays.length === 5 ? '매일'
    : activeDays.length === 0 ? '요일 없음'
    : activeDays.length === 1 ? activeDays[0] + '요일'
    : activeDays.join('·');

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className={`mt-0.5 flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
          open
            ? 'bg-blue-100 text-blue-600'
            : isOverridden
              ? 'text-blue-500 hover:text-blue-600'
              : 'text-gray-400 hover:text-gray-600'
        }`}
        title="탑승 요일 클릭하여 수정"
      >
        {label}
        <svg className="w-2.5 h-2.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={open ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-gray-200 rounded-xl shadow-lg p-2.5 flex gap-1.5">
          {DAY_OF_WEEK.map(day => {
            const active = matchesDay(effectiveDays, day);
            return (
              <button
                key={day}
                onClick={() => onToggle(day)}
                className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${
                  active
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
              >
                {day}
              </button>
            );
          })}
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
  studentKey,
}: Props) {
  const isAbsent = changeState === 'absent';
  const isIndividual = changeState === 'individual';
  const isShuttle = changeState === 'shuttle';
  const currentCategory = categoryStore[student.name] ?? '';

  let rowClass = 'hover:bg-gray-50';
  if (isAbsent) rowClass = 'bg-gray-100 opacity-60';
  else if (isIndividual) rowClass = 'bg-yellow-50';
  else if (isShuttle) rowClass = 'bg-blue-50';

  const isPickupSection = ['9시 30분 등원', '3시 등원', '4시 30분 등원'].includes(section);

  const overrideKey = `${section}||${bus}||${student.dayMwf ? 'mwf' : 'tuth'}`;
  const isOverridden = overrideKey in dayOverrides;
  const effectiveDays = isOverridden
    ? dayOverrides[overrideKey]
    : (student.dayMwf || student.dayTuTh || '');

  function toggleDay(day: DayOfWeek) {
    const wasActive = matchesDay(effectiveDays, day);
    const newDays = DAY_OF_WEEK.filter(d =>
      d === day ? !wasActive : matchesDay(effectiveDays, d)
    ).join('');
    onDayOverride(studentKey, overrideKey, newDays);
  }

  return (
    <tr className={`${rowClass} border-b border-gray-100 transition-colors`}>
      <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap w-14">{student.time}</td>

      <td className="hidden sm:table-cell px-3 py-2 text-sm text-gray-600 whitespace-nowrap max-w-[160px] truncate">{student.place}</td>

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
          <DayBadge
            effectiveDays={effectiveDays}
            isOverridden={isOverridden}
            onToggle={toggleDay}
          />
        )}
      </td>

      <td className="px-2 py-2">
        <div className="flex gap-0.5">
          {(['MK', 'AK', '초등'] as Exclude<StudentCategory, ''>[]).map(cat => (
            <button
              key={cat}
              onClick={() => onSetCategory(student.name, currentCategory === cat ? '' : cat)}
              className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold transition-colors whitespace-nowrap ${
                currentCategory === cat ? CATEGORY_ACTIVE[cat] : CATEGORY_INACTIVE
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </td>

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
            title={student.isTemp ? '오늘 임시로 추가한 학생을 목록에서 제거합니다' : '명단에서 영구 삭제합니다 (결석과 다름)'}
          >
            삭제
          </button>
        </div>
      </td>

      <td className="px-2 py-2 w-8 text-center">
        {student.note ? <NoteTooltip note={student.note} /> : null}
      </td>
    </tr>
  );
}
