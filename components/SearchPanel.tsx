'use client';

import { useMemo, useRef, useState } from 'react';
import type { ShuttleBase } from '@/types';
import { PICKUP_SECTIONS } from '@/types';

interface Entry {
  bus: string;
  section: string;
  time: string;
  place: string;
  dayMwf: string;
  dayTuTh: string;
}

interface StudentSchedule {
  name: string;
  entries: Entry[];
}

interface Props {
  data: ShuttleBase;
}

function buildSchedule(data: ShuttleBase, name: string): StudentSchedule {
  const entries: Entry[] = [];
  for (const bus of data.buses) {
    for (const section of bus.sections) {
      for (const s of section.students) {
        if (s.name === name) {
          entries.push({
            bus: bus.name,
            section: section.name,
            time: s.time,
            place: s.place,
            dayMwf: s.dayMwf,
            dayTuTh: s.dayTuTh,
          });
        }
      }
    }
  }
  return { name, entries };
}

const SECTION_COLOR: Record<string, string> = {
  '9시 30분 등원': 'bg-blue-50 text-blue-700 border-blue-200',
  '3시 등원': 'bg-blue-50 text-blue-700 border-blue-200',
  '4시 30분 등원': 'bg-blue-50 text-blue-700 border-blue-200',
  '3시 하원': 'bg-green-50 text-green-700 border-green-200',
  '4시 30분 하원': 'bg-green-50 text-green-700 border-green-200',
  '6시 하원': 'bg-green-50 text-green-700 border-green-200',
};

function ScheduleModal({ schedule, onClose }: { schedule: StudentSchedule; onClose: () => void }) {
  const pickups = schedule.entries.filter((e) => PICKUP_SECTIONS.includes(e.section as never));
  const dropoffs = schedule.entries.filter((e) => !PICKUP_SECTIONS.includes(e.section as never));

  function EntryRow({ e }: { e: Entry }) {
    const colorClass = SECTION_COLOR[e.section] ?? 'bg-gray-50 text-gray-700 border-gray-200';
    return (
      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm ${colorClass}`}>
        <span className="font-semibold whitespace-nowrap">{e.section}</span>
        <span className="text-xs opacity-70 whitespace-nowrap">{e.bus}</span>
        <span className="font-mono whitespace-nowrap">{e.time}</span>
        <span className="truncate opacity-80">{e.place}</span>
        {e.dayMwf && <span className="ml-auto text-xs opacity-60 whitespace-nowrap shrink-0">{e.dayMwf}</span>}
        {e.dayTuTh && !e.dayMwf && <span className="ml-auto text-xs opacity-60 whitespace-nowrap shrink-0">{e.dayTuTh}</span>}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{schedule.name} <span className="text-sm font-normal text-gray-400">시간표</span></h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          {pickups.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wide">등원</div>
              <div className="flex flex-col gap-1.5">{pickups.map((e, i) => <EntryRow key={i} e={e} />)}</div>
            </div>
          )}
          {dropoffs.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-green-600 mb-2 uppercase tracking-wide">하원</div>
              <div className="flex flex-col gap-1.5">{dropoffs.map((e, i) => <EntryRow key={i} e={e} />)}</div>
            </div>
          )}
          {schedule.entries.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">배치 정보 없음</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPanel({ data }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<StudentSchedule | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 이름 기준으로 중복 제거
  const results = useMemo<string[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>();
    for (const bus of data.buses) {
      for (const section of bus.sections) {
        for (const s of section.students) {
          if (s.name.toLowerCase().includes(q)) seen.add(s.name);
        }
      }
    }
    return Array.from(seen).slice(0, 20);
  }, [query, data]);

  function handleSelect(name: string) {
    setSelected(buildSchedule(data, name));
    setOpen(false);
    setQuery('');
  }

  return (
    <>
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
          <div className="absolute right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-64 max-h-72 overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-4 py-4 text-sm text-gray-400 text-center">검색 결과 없음</div>
            ) : (
              results.map((name) => (
                <button
                  key={name}
                  onMouseDown={() => handleSelect(name)}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                >
                  {name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {selected && <ScheduleModal schedule={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
