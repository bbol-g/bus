'use client';

import type { BusData, DailyChanges } from '@/types';
import { PICKUP_SECTIONS, DROPOFF_SECTIONS } from '@/types';
import { getTodayString, formatDate } from '@/lib/dateUtils';

interface Props {
  buses: BusData[];
  changes: DailyChanges;
}

function countActiveStudents(bus: BusData, changes: DailyChanges, type: 'pickup' | 'dropoff'): number {
  const targetSections = type === 'pickup' ? PICKUP_SECTIONS : DROPOFF_SECTIONS;
  let count = 0;
  for (const section of bus.sections) {
    if (!targetSections.includes(section.name)) continue;
    for (const student of section.students) {
      const key = `${bus.name}_${section.name}_${student.id}`;
      const change = changes[key];
      if (change !== 'absent') count++;
    }
  }
  return count;
}

export default function SummaryBar({ buses, changes }: Props) {
  const today = getTodayString();

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 flex-wrap text-sm">
      <span className="font-semibold text-gray-700">{formatDate(today)}</span>
      <div className="flex gap-3 flex-wrap">
        {buses.map((bus) => {
          const pickup = countActiveStudents(bus, changes, 'pickup');
          const dropoff = countActiveStudents(bus, changes, 'dropoff');
          return (
            <span key={bus.name} className="text-gray-600">
              <span className="font-medium text-gray-800">{bus.name}</span>
              {': '}
              <span className="text-blue-600">등원 {pickup}명</span>
              {' / '}
              <span className="text-green-600">하원 {dropoff}명</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
