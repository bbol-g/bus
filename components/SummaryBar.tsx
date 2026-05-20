'use client';

import type { BusData, DailyChanges, DayOfWeek } from '@/types';
import { PICKUP_SECTIONS, DROPOFF_SECTIONS } from '@/types';
import { makeChangeKey } from '@/lib/storage';
import { studentRunsToday } from '@/lib/dateUtils';

interface Props {
  buses: BusData[];
  changes: DailyChanges;
  today: DayOfWeek | null;
}

function countActive(bus: BusData, changes: DailyChanges, today: DayOfWeek | null, type: 'pickup' | 'dropoff'): number {
  const targets = type === 'pickup' ? PICKUP_SECTIONS : DROPOFF_SECTIONS;
  let count = 0;
  for (const section of bus.sections) {
    if (!targets.includes(section.name)) continue;
    for (const s of section.students) {
      if (today && !studentRunsToday(s.dayMwf, s.dayTuTh, today)) continue;
      const key = makeChangeKey(bus.name, section.name, s.id);
      if (changes[key] !== 'absent') count++;
    }
  }
  return count;
}

export default function SummaryBar({ buses, changes, today }: Props) {
  const busCounts = buses
    .filter((b) => b.name !== '개별')
    .map((bus) => ({
      name: bus.name,
      pickup: countActive(bus, changes, today, 'pickup'),
      dropoff: countActive(bus, changes, today, 'dropoff'),
    }));

  const totalPickup = busCounts.reduce((s, b) => s + b.pickup, 0);
  const totalDropoff = busCounts.reduce((s, b) => s + b.dropoff, 0);

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-4 overflow-x-auto text-sm print:hidden">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-bold text-gray-700">전체</span>
        <span className="bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 text-xs font-semibold">등원 {totalPickup}</span>
        <span className="bg-green-50 text-green-700 rounded px-1.5 py-0.5 text-xs font-semibold">하원 {totalDropoff}</span>
      </div>
      <div className="w-px h-4 bg-gray-200 shrink-0" />
      <div className="flex gap-3 flex-wrap">
        {busCounts.map((b) => (
          <span key={b.name} className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
            <span className="font-medium text-gray-700">{b.name}</span>
            <span className="text-blue-500">↑{b.pickup}</span>
            <span className="text-green-500">↓{b.dropoff}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
