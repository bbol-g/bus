'use client';

import { useMemo, useRef, useState } from 'react';
import type { BusName, ChangeState, DailyChanges, DayOfWeek, SectionType, ShuttleBase, Student } from '@/types';
import { DAY_OF_WEEK, DROPOFF_SECTIONS, PICKUP_SECTIONS } from '@/types';
import { addDaysToStr, formatDate, getDayOfWeekFromStr } from '@/lib/dateUtils';
import { makeChangeKey } from '@/lib/storage';
import { studentRidesOn, type DayOverrides } from '@/lib/schedule';
import { actionLabel, resolveLine, type LineResult, type PlanOp } from '@/lib/inbox';

const BOARD_BUSES: BusName[] = ['1호차', '2호차', '3호차', '5호차', '6호차'];

interface Props {
  data: ShuttleBase;
  changes: DailyChanges;
  allDayOverrides: DayOverrides;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  onApplyInbox: (ops: PlanOp[]) => Promise<void>;
  onRemoveChange: (key: string) => void;
}

const CHANGE_LABEL: Record<ChangeState, string> = { absent: '결석', individual: '개별', shuttle: '셔틀' };

function splitName(name: string): { ko: string; en: string } {
  const m = name.match(/^(.+?)\s+([A-Za-z].*)$/);
  if (m) return { ko: m[1], en: m[2] };
  return { ko: name, en: '' };
}

function timeKey(t: string): number {
  const m = t.match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 9999;
}

export default function BoardView({ data, changes, allDayOverrides, selectedDate, setSelectedDate, onApplyInbox, onRemoveChange }: Props) {
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [quick, setQuick] = useState('');
  const [result, setResult] = useState<LineResult | null>(null);
  const [previewed, setPreviewed] = useState('');
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');
  const quickRef = useRef<HTMLInputElement>(null);

  const viewDay = getDayOfWeekFromStr(selectedDate);
  const year = Number(selectedDate.slice(0, 4));
  const sections = direction === 'in' ? PICKUP_SECTIONS : DROPOFF_SECTIONS;

  function pickDay(day: DayOfWeek) {
    const order: Record<DayOfWeek, number> = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    setSelectedDate(addDaysToStr(selectedDate, order[day] - dow));
  }

  // 학생이 이 날 이 섹션에서 타는지 + 당일 변경상태
  function cellStudents(bus: BusName, section: SectionType): { student: Student; state: ChangeState | null }[] {
    if (!viewDay) return [];
    const sec = data.buses.find((b) => b.name === bus)?.sections.find((s) => s.name === section);
    if (!sec) return [];
    return sec.students
      .filter((s) => studentRidesOn(s, bus, section, viewDay, allDayOverrides))
      .map((s) => {
        const c = changes[makeChangeKey(bus, section, s.id)];
        return { student: s, state: typeof c === 'object' ? null : ((c as ChangeState) ?? null) };
      })
      .sort((a, b) => timeKey(a.student.time) - timeKey(b.student.time));
  }

  // "오늘 꼭 확인": 이 날짜의 변경들을 사람이 읽을 수 있게 목록화 (방향 필터)
  const todayChanges = useMemo(() => {
    const items: { key: string; student: Student; bus: BusName; section: SectionType; state: ChangeState }[] = [];
    for (const b of data.buses) {
      if (!BOARD_BUSES.includes(b.name)) continue;
      for (const sec of b.sections) {
        const isPickup = PICKUP_SECTIONS.includes(sec.name);
        if (direction === 'in' ? !isPickup : isPickup) continue;
        for (const s of sec.students) {
          const c = changes[makeChangeKey(b.name, sec.name, s.id)];
          if (typeof c === 'string') items.push({ key: makeChangeKey(b.name, sec.name, s.id), student: s, bus: b.name, section: sec.name, state: c as ChangeState });
        }
      }
    }
    return items;
  }, [data, changes, direction]);

  function previewQuick() {
    const t = quick.trim();
    if (!t) { setResult(null); setPreviewed(''); return; }
    setResult(resolveLine(t, data, allDayOverrides, year, selectedDate));
    setPreviewed(t);
    setMessage('');
  }
  async function applyQuick() {
    if (!result || result.ops.length === 0) return;
    setApplying(true);
    try {
      await onApplyInbox(result.ops);
      setMessage(`${result.matched.map((m) => m.name).join(', ')} 변동 ${result.ops.length}건 등록 완료`);
      setQuick(''); setResult(null); setPreviewed('');
      quickRef.current?.focus();
    } finally { setApplying(false); }
  }
  function onQuickKey(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (result && result.ops.length > 0 && previewed === quick.trim()) applyQuick();
    else previewQuick();
  }
  const showQuickResult = result && previewed === quick.trim();

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* 날짜 · 요일 · 방향 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
          <span className="text-gray-400">📅</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="text-sm text-gray-700 focus:outline-none bg-transparent"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {DAY_OF_WEEK.map((d) => (
            <button
              key={d}
              onClick={() => pickDay(d)}
              className={`w-10 h-10 rounded-full text-sm font-bold transition-colors ${
                viewDay === d ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="ml-auto flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setDirection('out')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${direction === 'out' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
          >하원 보기</button>
          <button
            onClick={() => setDirection('in')}
            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${direction === 'in' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
          >등원 보기</button>
        </div>
      </div>

      {/* 변동사항 빠른 입력 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex items-start gap-2 mb-2">
          <span className="text-lg">💬</span>
          <div>
            <div className="font-bold text-gray-800 text-sm">변동사항 빠른 입력</div>
            <div className="text-xs text-gray-400">예: 김건우 결석 · 이해니 9/7 개별등원 · 박시연 9/8~9/10 결석 (날짜 생략 시 선택한 날짜)</div>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            ref={quickRef}
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={onQuickKey}
            placeholder="예: 오전유치부 김건우 9/1 개별하원"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {showQuickResult && result && result.ops.length > 0 ? (
            <button onClick={applyQuick} disabled={applying} className="shrink-0 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
              ✈️ {applying ? '등록 중…' : `등록 (${result.ops.length})`}
            </button>
          ) : (
            <button onClick={previewQuick} className="shrink-0 px-4 py-2 text-sm rounded-lg bg-gray-800 text-white hover:bg-gray-700">확인</button>
          )}
        </div>
        {showQuickResult && result && (
          <div className="mt-2 text-xs">
            {result.intent.error ? <span className="text-red-600">✗ {result.intent.error}</span>
              : result.warning ? <span className="text-amber-700">⚠️ {result.warning}</span>
              : <span className="text-gray-600"><b className="text-gray-800">{result.matched.map((m) => `${m.name}(${m.bus})`).join(', ')}</b> · {actionLabel(result.intent.action, result.intent.direction)} · {Array.from(new Set(result.ops.map((o) => formatDate(o.date)))).join(', ')} · 총 {result.ops.length}건 <span className="text-gray-400">— Enter 한 번 더로 등록</span></span>}
          </div>
        )}
        {message && <div className="mt-2 text-xs text-green-600">✅ {message}</div>}
      </div>

      {/* 오늘 꼭 확인 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-amber-500">⚠️</span>
            <strong className="text-gray-800 text-sm">오늘 꼭 확인</strong>
            <span className="text-xs font-bold bg-amber-200 text-amber-800 rounded-full px-2 py-0.5">{todayChanges.length}</span>
          </div>
          <span className="text-xs text-gray-400">변동 학생은 원래 호차 명단에도 그대로 표시됩니다.</span>
        </div>
        {todayChanges.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-6">오늘 등록된 {direction === 'out' ? '하원' : '등원'} 변동이 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {todayChanges.map((c) => (
              <div key={c.key} className="relative bg-white border border-amber-200 rounded-lg p-3 pr-8">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{CHANGE_LABEL[c.state]}</span>
                <div className="font-semibold text-gray-800 text-sm mt-1">{splitName(c.student.name).ko}</div>
                <div className="text-xs text-gray-500">{c.section} · {c.bus}</div>
                <button onClick={() => onRemoveChange(c.key)} aria-label="변동 삭제" className="absolute top-2 right-2 text-gray-300 hover:text-red-500 text-sm">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 스케줄 보드 */}
      {!viewDay ? (
        <div className="text-center text-gray-400 py-16">주말입니다. 셔틀 운행이 없습니다.</div>
      ) : (
        sections.map((section) => {
          const perBus = BOARD_BUSES.map((bus) => ({ bus, list: cellStudents(bus, section) }));
          const total = perBus.reduce((n, x) => n + x.list.filter((s) => s.state !== 'absent').length, 0);
          if (perBus.every((x) => x.list.length === 0)) return null;
          return (
            <div key={section} className="mb-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="h-px bg-gray-200 flex-1" />
                <span className="text-sm font-bold text-blue-600 bg-blue-50 rounded-full px-3 py-1">{section} <span className="text-gray-400 font-normal">{total}명</span></span>
                <div className="h-px bg-gray-200 flex-1" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {perBus.map(({ bus, list }) => (
                  <div key={bus} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
                      <span className="font-bold text-gray-700 text-sm">{bus}</span>
                      <span className="text-xs text-gray-400">{list.filter((s) => s.state !== 'absent').length}명</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {list.length === 0 ? (
                        <div className="text-center text-gray-300 text-xs py-6">운행 없음</div>
                      ) : (
                        list.map(({ student, state }) => {
                          const nm = splitName(student.name);
                          return (
                            <div key={student.id} className={`flex gap-2 px-3 py-2 ${state === 'absent' ? 'bg-gray-50' : state ? 'bg-amber-50' : ''}`}>
                              <time className="text-xs text-gray-400 tabular-nums w-11 shrink-0 pt-0.5">{student.time}</time>
                              <div className="min-w-0">
                                <div className={`text-sm font-semibold ${state === 'absent' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                  {nm.ko}{nm.en && <span className="text-gray-400 font-normal text-xs"> {nm.en}</span>}
                                  {state && <span className="ml-1 text-[10px] px-1 rounded bg-amber-100 text-amber-700 align-middle">{CHANGE_LABEL[state]}</span>}
                                </div>
                                {student.place && <div className="text-xs text-gray-400 truncate">📍 {student.place}</div>}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
