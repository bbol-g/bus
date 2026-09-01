'use client';

import { Fragment, useState } from 'react';
import type { BusName, DayOfWeek, DailyChanges, SectionType, ShuttleBase } from '@/types';
import { DAY_OF_WEEK } from '@/types';
import { buildDayGrid, buildWeekGrid, type CellStudent, type DayOverrides } from '@/lib/schedule';

interface Props {
  data: ShuttleBase;
  viewDay: DayOfWeek | null;
  changes: DailyChanges;
  allDayOverrides: DayOverrides;
  dateLabel: string;
}

function stateBadge(cs: CellStudent) {
  if (cs.state === 'absent') return <span className="text-[9px] px-1 rounded bg-gray-200 text-gray-500 ml-1">결석</span>;
  if (cs.state === 'individual') return <span className="text-[9px] px-1 rounded bg-yellow-200 text-yellow-800 ml-1">개별</span>;
  if (cs.state === 'shuttle') return <span className="text-[9px] px-1 rounded bg-blue-200 text-blue-800 ml-1">셔틀</span>;
  return null;
}

function StudentChip({ cs }: { cs: CellStudent }) {
  const dim = cs.state === 'absent' || cs.state === 'individual';
  return (
    <div className={`flex items-baseline gap-1 leading-tight ${cs.state === 'absent' ? 'line-through text-gray-400' : dim ? 'text-gray-500' : 'text-gray-800'}`}>
      {cs.student.time && <span className="text-[10px] text-gray-400 tabular-nums w-9 shrink-0">{cs.student.time}</span>}
      <span className="text-xs">{cs.student.name}</span>
      {stateBadge(cs)}
    </div>
  );
}

function DayGridView({ data, viewDay, changes, allDayOverrides }: Omit<Props, 'dateLabel'>) {
  if (!viewDay) return <div className="text-center text-gray-400 py-16">주말입니다. 셔틀 운행이 없습니다.</div>;
  const grid = buildDayGrid(data, viewDay, changes, allDayOverrides);
  if (grid.sections.length === 0) return <div className="text-center text-gray-400 py-16">이 날 운행하는 학생이 없습니다.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse w-full min-w-[720px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-gray-100 border border-gray-200 px-2 py-2 text-xs font-bold text-gray-600 text-left w-24">시간대 \ 호차</th>
            {grid.buses.map((bus) => (
              <th key={bus} className="border border-gray-200 bg-gray-100 px-2 py-2 text-xs font-bold text-gray-700">{bus}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.sections.map((section) => (
            <tr key={section}>
              <th className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-700 text-left align-top whitespace-nowrap">{section}</th>
              {grid.buses.map((bus) => {
                const cell = grid.cell(section, bus);
                return (
                  <td key={bus} className="border border-gray-200 px-2 py-1.5 align-top min-w-[120px]">
                    {cell.length === 0 ? (
                      <span className="text-gray-300 text-xs">·</span>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-gray-400 mb-0.5">{cell.filter((c) => c.state !== 'absent').length}명</div>
                        {cell.map((cs) => <StudentChip key={cs.student.id} cs={cs} />)}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WeekGridView({ data, allDayOverrides }: { data: ShuttleBase; allDayOverrides: DayOverrides }) {
  const grid = buildWeekGrid(data, DAY_OF_WEEK, allDayOverrides);
  if (grid.rows.length === 0) return <div className="text-center text-gray-400 py-16">표시할 일정이 없습니다.</div>;

  // 섹션별로 묶어서 소제목 + 호차 행
  type Row = { section: SectionType; bus: BusName };
  const bySection = new Map<SectionType, Row[]>();
  for (const row of grid.rows) {
    const arr = bySection.get(row.section) ?? [];
    arr.push(row);
    bySection.set(row.section, arr);
  }

  return (
    <div className="overflow-x-auto">
      <p className="text-xs text-gray-400 mb-2 print:hidden">* 반복 기본 일정 기준입니다. 특정 날짜의 결석·개별 변경은 &lsquo;하루&rsquo; 보기에서 확인하세요.</p>
      <table className="border-collapse w-full min-w-[820px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-gray-100 border border-gray-200 px-2 py-2 text-xs font-bold text-gray-600 text-left w-16">호차</th>
            {grid.days.map((d) => (
              <th key={d} className="border border-gray-200 bg-gray-100 px-2 py-2 text-xs font-bold text-gray-700">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from(bySection.entries()).map(([section, rows]) => (
            <Fragment key={section}>
              <tr>
                <td colSpan={grid.days.length + 1} className="border border-gray-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{section}</td>
              </tr>
              {rows.map((row) => (
                <tr key={`${section}-${row.bus}`}>
                  <th className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-700 text-left align-top whitespace-nowrap">{row.bus}</th>
                  {grid.days.map((d) => {
                    const cell = grid.cell(section, row.bus, d);
                    return (
                      <td key={d} className="border border-gray-200 px-1.5 py-1 align-top min-w-[130px]">
                        {cell.length === 0 ? (
                          <span className="text-gray-300 text-xs">·</span>
                        ) : (
                          <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                            {cell.map((cs) => (
                              <span key={cs.student.id} className="text-[11px] text-gray-700">{cs.student.name}</span>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OverviewBoard({ data, viewDay, changes, allDayOverrides, dateLabel }: Props) {
  const [tab, setTab] = useState<'day' | 'week'>('day');
  return (
    <div>
      <div className="flex items-center gap-2 mb-4 print:hidden">
        <button
          onClick={() => setTab('day')}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${tab === 'day' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
        >
          하루 ({dateLabel})
        </button>
        <button
          onClick={() => setTab('week')}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${tab === 'week' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
        >
          주간 한 장
        </button>
      </div>
      {tab === 'day'
        ? <DayGridView data={data} viewDay={viewDay} changes={changes} allDayOverrides={allDayOverrides} />
        : <WeekGridView data={data} allDayOverrides={allDayOverrides} />}
    </div>
  );
}
