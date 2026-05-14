'use client';

import { useState } from 'react';
import type { Student, ChangeState, BusName, SectionType } from '@/types';

interface Props {
  student: Student;
  bus: BusName;
  section: SectionType;
  changeState: ChangeState | null;
  isIndivStudent: boolean; // from 개별등하원 sheet → can toggle 셔틀
  onToggle: (key: string, state: ChangeState | null) => void;
  onDelete: (studentId: string, isTemp: boolean) => void;
  changeKey: string;
}

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
  changeState,
  isIndivStudent,
  onToggle,
  onDelete,
  changeKey,
}: Props) {
  const isAbsent = changeState === 'absent';
  const isIndividual = changeState === 'individual';
  const isShuttle = changeState === 'shuttle';

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
              개별
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
