'use client';

import { useState } from 'react';
import type { Student, ChangeState, BusName, SectionType, StudentCategory, CategoryStore } from '@/types';

interface Props {
  student: Student;
  bus: BusName;
  section: SectionType;
  changeState: ChangeState | null;
  isIndivStudent: boolean;
  categoryStore: CategoryStore;
  onToggle: (key: string, state: ChangeState | null) => void;
  onDelete: (studentId: string, isTemp: boolean) => void;
  onSetCategory: (studentName: string, category: StudentCategory) => void;
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
        <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap max-w-xs">
          {note}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </div>
      )}
    </div>
  );
}

export default function StudentRow({
  student,
  section,
  changeState,
  isIndivStudent,
  categoryStore,
  onToggle,
  onDelete,
  onSetCategory,
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

  function toggleAbsent() {
    onToggle(changeKey, isAbsent ? null : 'absent');
  }
  function toggleIndividual() {
    onToggle(changeKey, isIndividual ? null : 'individual');
  }
  function toggleShuttle() {
    onToggle(changeKey, isShuttle ? null : 'shuttle');
  }
  function cycleCategory() {
    const idx = CYCLE_ORDER.indexOf(currentCategory);
    const next = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length];
    onSetCategory(student.name, next);
  }

  return (
    <tr className={`${rowClass} border-b border-gray-100 transition-colors`}>
      <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{student.time}</td>
      <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{student.place}</td>
      <td className="px-3 py-2 text-sm font-medium whitespace-nowrap">
        <span className={isAbsent ? 'line-through text-gray-400' : 'text-gray-900'}>
          {student.name}
        </span>
        {isIndividual && (
          <span className="ml-1.5 inline-block bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded font-semibold">
            개별
          </span>
        )}
        {isShuttle && (
          <span className="ml-1.5 inline-block bg-blue-400 text-white text-xs px-1.5 py-0.5 rounded font-semibold">
            셔틀
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        {student.note ? <NoteTooltip note={student.note} /> : null}
      </td>
      {/* Category */}
      <td className="px-3 py-2">
        <button
          onClick={cycleCategory}
          title="클릭하여 구분 변경 (MK→AK→초등→없음)"
          className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${CATEGORY_BADGE[currentCategory]}`}
        >
          {currentCategory || '구분'}
        </button>
      </td>
      {/* Actions */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={toggleAbsent}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              isAbsent
                ? 'bg-gray-500 text-white border-gray-500'
                : 'border-gray-300 text-gray-600 hover:bg-gray-100'
            }`}
          >
            결석
          </button>
          {!isIndivStudent && (
            <button
              onClick={toggleIndividual}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                isIndividual
                  ? 'bg-yellow-400 text-yellow-900 border-yellow-400'
                  : 'border-gray-300 text-gray-600 hover:bg-yellow-50'
              }`}
            >
              {['9시 30분 등원', '3시 등원', '4시 30분 등원'].includes(section) ? '개별등원' : '개별하원'}
            </button>
          )}
          {isIndivStudent && (
            <button
              onClick={toggleShuttle}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                isShuttle
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'border-gray-300 text-gray-600 hover:bg-blue-50'
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
    </tr>
  );
}
