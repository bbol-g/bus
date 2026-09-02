'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { BusName, ChangeState, DailyChanges, DayOfWeek, SectionType, ShuttleBase, Student } from '@/types';
import { DAY_OF_WEEK, DROPOFF_SECTIONS, PICKUP_SECTIONS } from '@/types';
import { addDaysToStr, formatDate, getDayOfWeekFromStr, mondayOf } from '@/lib/dateUtils';
import { makeChangeKey } from '@/lib/storage';
import { studentRidesOn, type DayOverrides } from '@/lib/schedule';
import { actionLabel, resolveLine, type LineResult, type PlanOp } from '@/lib/inbox';

const BOARD_BUSES: BusName[] = ['1호차', '2호차', '3호차', '5호차', '6호차'];
const CHANGE_LABEL: Record<ChangeState, string> = { absent: '결석', individual: '개별', shuttle: '셔틀' };

interface Props {
  data: ShuttleBase;
  changes: DailyChanges;
  allDayOverrides: DayOverrides;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  onApplyInbox: (ops: PlanOp[]) => Promise<void>;
  onUndoInbox: (ops: PlanOp[]) => Promise<void>;
  onSetChange: (key: string, state: ChangeState | null) => void;
  onRemoveChange: (key: string) => void;
  confirmed: string[];
  onToggleConfirm: (key: string) => void;
  weekCounts: Record<string, number>;
}

function splitName(name: string): { ko: string; en: string } {
  const m = name.match(/^(.+?)\s+([A-Za-z].*)$/);
  return m ? { ko: m[1], en: m[2] } : { ko: name, en: '' };
}
function timeKey(t: string): number {
  const m = t.match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 9999;
}

export default function BoardView({
  data, changes, allDayOverrides, selectedDate, setSelectedDate,
  onApplyInbox, onUndoInbox, onSetChange, onRemoveChange, confirmed, onToggleConfirm, weekCounts,
}: Props) {
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [quick, setQuick] = useState('');
  const [result, setResult] = useState<LineResult | null>(null);
  const [previewed, setPreviewed] = useState('');
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');
  const [lastOps, setLastOps] = useState<PlanOp[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const quickRef = useRef<HTMLInputElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const viewDay = getDayOfWeekFromStr(selectedDate);
  const year = Number(selectedDate.slice(0, 4));
  const sections = direction === 'in' ? PICKUP_SECTIONS : DROPOFF_SECTIONS;
  const monday = mondayOf(selectedDate);
  const confirmedSet = useMemo(() => new Set(confirmed), [confirmed]);

  // 카드 편집 메뉴 바깥 클릭 닫기
  useEffect(() => {
    if (!editing) return;
    function onDoc(e: MouseEvent) {
      if (boardRef.current && !(e.target as HTMLElement).closest('[data-edit-menu]') && !(e.target as HTMLElement).closest('[data-edit-trigger]')) {
        setEditing(null);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [editing]);

  function pickDay(day: DayOfWeek) {
    const order: Record<DayOfWeek, number> = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    setSelectedDate(addDaysToStr(selectedDate, order[day] - dow));
  }

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

  const todayChanges = useMemo(() => {
    const items: { key: string; student: Student; bus: BusName; section: SectionType; state: ChangeState }[] = [];
    for (const b of data.buses) {
      if (!BOARD_BUSES.includes(b.name)) continue;
      for (const sec of b.sections) {
        const isPickup = PICKUP_SECTIONS.includes(sec.name);
        if (direction === 'in' ? !isPickup : isPickup) continue;
        for (const s of sec.students) {
          const key = makeChangeKey(b.name, sec.name, s.id);
          const c = changes[key];
          if (typeof c === 'string') items.push({ key, student: s, bus: b.name, section: sec.name, state: c as ChangeState });
        }
      }
    }
    return items;
  }, [data, changes, direction]);

  // 다가오는 변동 (이번 주 중 선택일 이후 평일)
  const upcoming = useMemo(() => {
    const out: { day: DayOfWeek; count: number }[] = [];
    for (let i = 0; i < 5; i++) {
      const date = addDaysToStr(monday, i);
      if (date <= selectedDate) continue;
      const n = weekCounts[date] ?? 0;
      if (n > 0) out.push({ day: DAY_OF_WEEK[i], count: n });
    }
    return out;
  }, [monday, selectedDate, weekCounts]);

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
      setLastOps(result.ops);
      setMessage(`${result.matched.map((m) => m.name).join(', ')} 변동 ${result.ops.length}건 등록 완료`);
      setQuick(''); setResult(null); setPreviewed('');
      quickRef.current?.focus();
    } finally { setApplying(false); }
  }
  async function undoLast() {
    if (!lastOps) return;
    await onUndoInbox(lastOps);
    setLastOps(null);
    setMessage('실행취소됨');
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
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
          <span className="text-gray-400">📅</span>
          <input type="date" value={selectedDate} onChange={(e) => e.target.value && setSelectedDate(e.target.value)} className="text-sm text-gray-700 focus:outline-none bg-transparent" />
        </div>
        <div className="flex items-center gap-1.5">
          {DAY_OF_WEEK.map((d, i) => {
            const date = addDaysToStr(monday, i);
            const hasChanges = (weekCounts[date] ?? 0) > 0;
            return (
              <button key={d} onClick={() => pickDay(d)}
                className={`relative w-10 h-10 rounded-full text-sm font-bold transition-colors ${viewDay === d ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
                {d}
                {hasChanges && <span className={`absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full ${viewDay === d ? 'bg-white' : 'bg-amber-500'}`} />}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex bg-gray-100 rounded-lg p-0.5">
          <button onClick={() => setDirection('out')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${direction === 'out' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>하원 보기</button>
          <button onClick={() => setDirection('in')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${direction === 'in' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>등원 보기</button>
        </div>
      </div>

      {/* 다가오는 변동 */}
      {upcoming.length > 0 && (
        <div className="text-xs text-gray-500 mb-3">
          🔔 다가오는 변동:{' '}
          {upcoming.map((u, i) => (
            <button key={u.day} onClick={() => pickDay(u.day)} className="text-blue-600 hover:underline font-medium">
              {u.day} {u.count}건{i < upcoming.length - 1 ? ', ' : ''}
            </button>
          ))}
        </div>
      )}

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
          <input ref={quickRef} value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={onQuickKey}
            placeholder="예: 오전유치부 김건우 9/1 개별하원"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          {showQuickResult && result && result.ops.length > 0 ? (
            <button onClick={applyQuick} disabled={applying} className="shrink-0 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
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
        {message && (
          <div className="mt-2 text-xs text-green-600 flex items-center gap-2">
            ✅ {message}
            {lastOps && message.includes('완료') && (
              <button onClick={undoLast} className="text-gray-500 hover:text-gray-700 underline">실행취소</button>
            )}
          </div>
        )}
      </div>

      {/* 오늘 꼭 확인 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
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
            {todayChanges.map((c) => {
              const isConfirmed = confirmedSet.has(c.key);
              return (
                <div key={c.key} className={`relative rounded-lg p-3 pr-8 border ${isConfirmed ? 'bg-green-50 border-green-200' : 'bg-white border-amber-200'}`}>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{CHANGE_LABEL[c.state]}</span>
                  <div className="font-semibold text-gray-800 text-sm mt-1">{splitName(c.student.name).ko}</div>
                  <div className="text-xs text-gray-500 mb-2">{c.section} · {c.bus}</div>
                  <button onClick={() => onToggleConfirm(c.key)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${isConfirmed ? 'bg-green-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    {isConfirmed ? '✓ 확인완료' : '확인하기'}
                  </button>
                  <button onClick={() => onRemoveChange(c.key)} aria-label="변동 삭제" className="absolute top-2 right-2 text-gray-300 hover:text-red-500 text-sm">×</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 스케줄 보드 */}
      <div ref={boardRef}>
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
                            const key = makeChangeKey(bus, section, student.id);
                            const open = editing === key;
                            return (
                              <div key={student.id} className="relative">
                                <button
                                  data-edit-trigger
                                  onClick={() => setEditing(open ? null : key)}
                                  className={`w-full text-left flex gap-2 px-3 py-2 hover:bg-blue-50/50 ${state === 'absent' ? 'bg-gray-50' : state ? 'bg-amber-50' : ''}`}
                                >
                                  <time className="text-xs text-gray-400 tabular-nums w-11 shrink-0 pt-0.5">{student.time}</time>
                                  <div className="min-w-0">
                                    <div className={`text-sm font-semibold ${state === 'absent' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                      {nm.ko}{nm.en && <span className="text-gray-400 font-normal text-xs"> {nm.en}</span>}
                                      {state && <span className="ml-1 text-[10px] px-1 rounded bg-amber-100 text-amber-700 align-middle">{CHANGE_LABEL[state]}</span>}
                                    </div>
                                    {student.place && <div className="text-xs text-gray-400 truncate">{student.place}</div>}
                                  </div>
                                </button>
                                {open && (
                                  <div data-edit-menu className="absolute z-30 left-3 top-full mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg p-1 flex gap-1">
                                    {([['absent', '결석'], ['individual', '개별']] as [ChangeState, string][]).map(([st, label]) => (
                                      <button key={st} onClick={() => { onSetChange(key, state === st ? null : st); setEditing(null); }}
                                        className={`text-xs px-2 py-1 rounded ${state === st ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{label}</button>
                                    ))}
                                    <button onClick={() => { onSetChange(key, null); setEditing(null); }}
                                      className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">정상</button>
                                  </div>
                                )}
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
    </div>
  );
}
