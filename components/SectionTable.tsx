'use client';

import { useState } from 'react';
import type { Section, BusName, DailyChanges, ChangeState, Student, StudentCategory, CategoryStore } from '@/types';
import { PICKUP_SECTIONS } from '@/types';
import StudentRow from './StudentRow';
import AddStudentModal from './AddStudentModal';
import { makeChangeKey } from '@/lib/storage';

interface Props {
  section: Section;
  bus: BusName;
  changes: DailyChanges;
  tempStudents: Student[];
  categoryStore: CategoryStore;
  onToggle: (key: string, state: ChangeState | null) => void;
  onDelete: (studentId: string, isTemp: boolean, bus: BusName, section: string) => void;
  onAddTemp: (bus: BusName, section: string, student: { name: string; place: string; time: string; note: string }) => void;
  onSetCategory: (studentName: string, category: StudentCategory) => void;
}

export default function SectionTable({
  section, bus, changes, tempStudents, categoryStore,
  onToggle, onDelete, onAddTemp, onSetCategory,
}: Props) {
  const [showModal, setShowModal] = useState(false);

  const isPickup = PICKUP_SECTIONS.includes(section.name);
  const headerBg = isPickup ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700';
  const headerBorder = isPickup ? 'border-blue-200' : 'border-green-200';

  const allStudents = [...section.students, ...tempStudents];

  return (
    <div className="mb-6">
      <div className={`flex items-center justify-between px-4 py-2 rounded-t-lg border ${headerBg} ${headerBorder}`}>
        <span className="font-semibold text-sm">{section.name}</span>
        <span className="text-xs opacity-70">{isPickup ? '등원' : '하원'}</span>
      </div>
      <div className="overflow-x-auto border border-t-0 border-gray-200 rounded-b-lg">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-200">
              <th className="px-3 py-2 text-left font-medium w-20">시간</th>
              <th className="px-3 py-2 text-left font-medium w-28">장소</th>
              <th className="px-3 py-2 text-left font-medium">아동명</th>
              <th className="px-3 py-2 text-center font-medium w-10">특이</th>
              <th className="px-3 py-2 text-left font-medium w-28">구분</th>
              <th className="px-3 py-2 text-left font-medium w-44">액션</th>
            </tr>
          </thead>
          <tbody>
            {allStudents.map((student) => {
              const key = makeChangeKey(bus, section.name, student.id);
              const rawChange = changes[key];
              const changeState: ChangeState | null =
                rawChange === 'absent' || rawChange === 'individual' || rawChange === 'shuttle'
                  ? rawChange
                  : null;
              return (
                <StudentRow
                  key={student.id}
                  student={student}
                  bus={bus}
                  section={section.name}
                  changeState={changeState}
                  isIndivStudent={bus === '개별'}
                  categoryStore={categoryStore}
                  onToggle={onToggle}
                  onDelete={(id, isTemp) => onDelete(id, isTemp, bus, section.name)}
                  onSetCategory={onSetCategory}
                  changeKey={key}
                />
              );
            })}
            {allStudents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-400 text-xs">
                  오늘 해당 학생이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button
        onClick={() => setShowModal(true)}
        className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 ml-1"
      >
        <span className="text-base leading-none">+</span> 추가
      </button>
      {showModal && (
        <AddStudentModal
          bus={bus}
          section={section.name}
          onAdd={(s) => onAddTemp(bus, section.name, s)}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
