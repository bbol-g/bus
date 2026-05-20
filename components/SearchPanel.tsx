'use client';

import { useMemo, useRef, useState } from 'react';
import type { ShuttleBase } from '@/types';

interface Result {
  id: string;
  name: string;
  bus: string;
  section: string;
  time: string;
  place: string;
}

interface Props {
  data: ShuttleBase;
}

export default function SearchPanel({ data }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo<Result[]>(() => {
    const q = query.trim();
    if (!q) return [];
    const lower = q.toLowerCase();
    const found: Result[] = [];
    for (const bus of data.buses) {
      for (const section of bus.sections) {
        for (const student of section.students) {
          if (student.name.toLowerCase().includes(lower)) {
            found.push({
              id: student.id,
              name: student.name,
              bus: bus.name,
              section: section.name,
              time: student.time,
              place: student.place,
            });
          }
        }
      }
    }
    return found.slice(0, 30);
  }, [query, data]);

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-1.5">
        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="학생 이름 검색"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="bg-transparent text-sm outline-none w-36 placeholder-gray-400"
        />
        {query && (
          <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-80 max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-4 text-sm text-gray-400 text-center">검색 결과 없음</div>
          ) : (
            results.map((r) => (
              <div key={r.id} className="px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <span className="font-medium text-gray-900 text-sm">{r.name}</span>
                <div className="text-xs text-gray-400 mt-0.5">
                  {r.bus} · {r.section} · {r.time}{r.place ? ` · ${r.place}` : ''}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
