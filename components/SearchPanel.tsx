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


function dayLabelOrder(label: string): number {
  if (label === '매일') return 0;
  if (label.includes('월')) return 1;
  if (label.includes('화')) return 2;
  if (label.includes('수')) return 3;
  if (label.includes('목')) return 4;
  if (label.includes('금')) return 5;
  return 99;
}

function formatDayLabel(label: string): string {
  if (!label || label === '매일') return '매일';
  if (label.length > 1) return label.split('').join('·');
  return label + '요일';
}

function ScheduleModal({ schedule, onClose }: { schedule: StudentSchedule; onClose: () => void }) {
  // 요일 기준으로 그룹핑
  const dayGroups = new Map<string, Entry[]>();
  for (const e of schedule.entries) {
    const dayLabel = e.dayMwf || e.dayTuTh || '매일';
    if (!dayGroups.has(dayLabel)) dayGroups.set(dayLabel, []);
    dayGroups.get(dayLabel)!.push(e);
  }

  const sortedDays = Array.from(dayGroups.keys()).sort(
    (a, b) => dayLabelOrder(a) - dayLabelOrder(b)
  );

  function EntryRow({ e }: { e: Entry }) {
    const isPickup = PICKUP_SECTIONS.includes(e.section as never);
    const typeLabel = isPickup ? '등원' : '하원';
    const typeColor = isPickup ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';
    return (
      <div className="flex items-center gap-2 py-1.5 text-sm">
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${typeColor}`}>{typeLabel}</span>
        <span className="font-medium whitespace-nowrap text-gray-800">{e.section}</span>
        <span className="text-xs text-gray-400 whitespace-nowrap">{e.bus}</span>
        {e.time && <span className="font-mono text-xs text-gray-500 whitespace-nowrap">{e.time}</span>}
        <span className="truncate text-xs text-gray-400">{e.place}</span>
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
          {schedule.entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">배치 정보 없음</p>
          ) : (
            sortedDays.map((dayLabel) => {
              const entries = dayGroups.get(dayLabel)!;
              const sorted = [...entries].sort((a, b) => {
                const aP = PICKUP_SECTIONS.includes(a.section as never) ? 0 : 1;
                const bP = PICKUP_SECTIONS.includes(b.section as never) ? 0 : 1;
                return aP - bP;
              });
              return (
                <div key={dayLabel}>
                  <div className="mb-1.5">
                    <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                      {formatDayLabel(dayLabel)}
                    </span>
                  </div>
                  <div className="flex flex-col divide-y divide-gray-50 pl-1 border-l-2 border-gray-100 ml-1">
                    {sorted.map((e, i) => <EntryRow key={i} e={e} />)}
                  </div>
                </div>
              );
            })
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
