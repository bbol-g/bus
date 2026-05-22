'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DayOfWeek, ShuttleBase } from '@/types';
import { DAY_OF_WEEK, PICKUP_SECTIONS } from '@/types';
import { matchesDay } from '@/lib/dateUtils';

interface Entry {
  bus: string;
  section: string;
  time: string;
  place: string;
  dayMwf: string;
  dayTuTh: string;
  overrideSlot: 'mwf' | 'tuth';
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
            overrideSlot: s.dayMwf ? 'mwf' : 'tuth',
          });
        }
      }
    }
  }
  return { name, entries };
}

function applyOverrides(entries: Entry[], overrides: Record<string, string>): Entry[] {
  return entries.map(e => {
    const key = `${e.section}||${e.bus}||${e.overrideSlot}`;
    if (!(key in overrides)) return e;
    const days = overrides[key];
    return e.overrideSlot === 'mwf'
      ? { ...e, dayMwf: days, dayTuTh: '' }
      : { ...e, dayMwf: '', dayTuTh: days };
  });
}

function entrySig(entries: Entry[]): string {
  return [...entries].map(e => `${e.section}|${e.bus}|${e.time}|${e.place}`).sort().join(';;');
}

function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const aP = (PICKUP_SECTIONS as string[]).includes(a.section) ? 0 : 1;
    const bP = (PICKUP_SECTIONS as string[]).includes(b.section) ? 0 : 1;
    return aP - bP;
  });
}

function formatGroupLabel(days: DayOfWeek[]): string {
  if (days.length === 5) return '매일';
  if (days.length === 1) return days[0] + '요일';
  return days.join('·');
}

function GroupDayBadge({
  groupDays,
  entries,
  onToggle,
}: {
  groupDays: DayOfWeek[];
  entries: Entry[];
  onToggle: (entries: Entry[], day: DayOfWeek) => void;
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

  const label = groupDays.length === 0 ? '요일 없음' : formatGroupLabel(groupDays);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors ${
          open ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
        }`}
        title="탑승 요일 클릭하여 수정"
      >
        {label}
        <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={open ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-[60] bg-white border border-gray-200 rounded-xl shadow-lg p-2.5 flex gap-1.5">
          {DAY_OF_WEEK.map(day => {
            const active = groupDays.includes(day);
            return (
              <button
                key={day}
                onClick={() => onToggle(entries, day)}
                className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${
                  active ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
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

function ScheduleModal({
  schedule,
  overrides,
  onClose,
  onToggleDay,
}: {
  schedule: StudentSchedule;
  overrides: Record<string, string>;
  onClose: () => void;
  onToggleDay: (entries: Entry[], day: DayOfWeek) => void;
}) {
  const effective = applyOverrides(schedule.entries, overrides);

  const perDay = DAY_OF_WEEK.map(day => ({
    day,
    entries: effective.filter(e => matchesDay(e.dayMwf, day) || matchesDay(e.dayTuTh, day)),
  })).filter(({ entries }) => entries.length > 0);

  const groups: { days: DayOfWeek[]; entries: Entry[] }[] = [];
  for (const { day, entries } of perDay) {
    const sig = entrySig(entries);
    const existing = groups.find(g => entrySig(g.entries) === sig);
    if (existing) existing.days.push(day);
    else groups.push({ days: [day], entries });
  }

  function EntryRow({ e }: { e: Entry }) {
    const isPickup = (PICKUP_SECTIONS as string[]).includes(e.section);
    return (
      <div className="flex items-center gap-2 py-1.5 text-sm">
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${isPickup ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
          {isPickup ? '등원' : '하원'}
        </span>
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
          <h2 className="font-bold text-gray-900">
            {schedule.name} <span className="text-sm font-normal text-gray-400">시간표</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          {groups.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">배치 정보 없음</p>
          ) : (
            groups.map(g => (
              <div key={entrySig(g.entries)}>
                <div className="mb-1.5">
                  <GroupDayBadge
                    groupDays={g.days}
                    entries={g.entries}
                    onToggle={onToggleDay}
                  />
                </div>
                <div className="flex flex-col divide-y divide-gray-50 pl-1 border-l-2 border-gray-100 ml-1">
                  {sortEntries(g.entries).map((e, i) => <EntryRow key={i} e={e} />)}
                </div>
              </div>
            ))
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
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

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
    setOverrides({});
    setOpen(false);
    setQuery('');
    fetch(`/api/day-overrides?name=${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then((d: Record<string, string>) => setOverrides(d))
      .catch(() => {});
  }

  function handleToggleDayGroup(entries: Entry[], day: DayOfWeek) {
    let newOverrides = { ...overrides };
    for (const entry of entries) {
      const key = `${entry.section}||${entry.bus}||${entry.overrideSlot}`;
      const currentDays = entry.overrideSlot === 'mwf' ? entry.dayMwf : entry.dayTuTh;
      const wasActive = matchesDay(currentDays, day);
      const newDays = DAY_OF_WEEK.filter(d => d === day ? !wasActive : matchesDay(currentDays, d)).join('');
      newOverrides = { ...newOverrides, [key]: newDays };
    }
    setOverrides(newOverrides);
    if (selected) {
      fetch('/api/day-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selected.name, overrides: newOverrides }),
      }).catch(() => {});
    }
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

      {selected && (
        <ScheduleModal
          schedule={selected}
          overrides={overrides}
          onClose={() => setSelected(null)}
          onToggleDay={handleToggleDayGroup}
        />
      )}
    </>
  );
}
