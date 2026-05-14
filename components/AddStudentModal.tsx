'use client';

import { useEffect, useRef, useState } from 'react';
import type { BusName, SectionType } from '@/types';

interface Props {
  bus: BusName;
  section: SectionType;
  onAdd: (student: { name: string; place: string; time: string; note: string }) => void;
  onClose: () => void;
}

export default function AddStudentModal({ bus, section, onAdd, onClose }: Props) {
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ name: name.trim(), place: place.trim(), time: time.trim(), note: note.trim() });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">학생 추가</h2>
        <p className="text-sm text-gray-500 mb-4">
          {bus} · {section} (오늘만 적용)
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">아동명 *</label>
            <input
              ref={nameRef}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">장소</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="장소"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시간</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="시간"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">특이사항</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="특이사항"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
            >
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
