'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BusName, CategoryFilter, CategoryStore, ChangeState, DailyChanges, DayOfWeek, ShuttleBase, Student, StudentCategory } from '@/types';
import { BUS_NAMES, DAY_OF_WEEK } from '@/types';
import { formatDate, getTodayKorean, getTodayString } from '@/lib/dateUtils';
import { makeChangeKey, setStudentCategory } from '@/lib/storage';
import HoTab from './HoTab';
import DropoffBoard from './DropoffBoard';
import SearchPanel from './SearchPanel';

type AppMode = 'dropoff' | 'manage';
type ManageTab = '전체' | BusName;

const CATEGORY_FILTERS: CategoryFilter[] = ['전체', 'MK', 'AK', '초등'];
const MANAGE_TABS: ManageTab[] = ['전체', ...BUS_NAMES];

const CATEGORY_ACTIVE_STYLE: Record<string, string> = {
  '전체': 'bg-gray-800 text-white',
  'MK': 'bg-purple-600 text-white',
  'AK': 'bg-orange-500 text-white',
  '초등': 'bg-teal-600 text-white',
};
const CATEGORY_INACTIVE_STYLE = 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50';

interface Props {
  data: ShuttleBase;
  onReupload: (data: ShuttleBase) => void;
}

export default function Dashboard({ data, onReupload }: Props) {
  const [mode, setMode] = useState<AppMode>('manage');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('전체');
  const [manageTab, setManageTab] = useState<ManageTab>('전체');
  const [changes, setChanges] = useState<DailyChanges>({});
  const [tempStudents, setTempStudents] = useState<Record<string, Student[]>>({});
  const [categoryStore, setCategoryStore] = useState<CategoryStore>({});
  const today = getTodayKorean();
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(today);
  const fileRef = useRef<HTMLInputElement>(null);
  const [reuploadLoading, setReuploadLoading] = useState(false);

  useEffect(() => {
    const todayStr = getTodayString();

    Promise.all([
      fetch(`/api/changes?date=${todayStr}`).then((r) => r.ok ? r.json() : {}).catch(() => ({})),
      fetch('/api/categories').then((r) => r.ok ? r.json() : {}).catch(() => ({})),
    ]).then(([loaded, cats]: [DailyChanges, CategoryStore]) => {
      setChanges(loaded);
      setCategoryStore(cats);

      const temps: Record<string, Student[]> = {};
      for (const [key, value] of Object.entries(loaded)) {
        if (typeof value === 'object' && value !== null && 'isTemp' in value) {
          const temp = value as { isTemp: true; name: string; place: string; time: string; note: string; bus: BusName; section: string; id: string };
          const mapKey = `${temp.bus}_${temp.section}`;
          if (!temps[mapKey]) temps[mapKey] = [];
          temps[mapKey].push({
            id: temp.id ?? key,
            name: temp.name,
            time: temp.time,
            place: temp.place,
            contact: '',
            note: temp.note,
            dayMwf: '매일',
            timeTuTh: '',
            dayTuTh: '매일',
            bus: temp.bus as BusName,
            section: temp.section as Student['section'],
            isTemp: true,
          });
        }
      }
      setTempStudents(temps);
    });
  }, []);

  const persistChanges = useCallback((next: DailyChanges) => {
    setChanges(next);
    const date = getTodayString();
    fetch('/api/changes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, changes: next }),
    }).catch(console.error);
  }, []);

  function handleToggle(key: string, state: ChangeState | null) {
    const next = { ...changes };
    if (state === null) delete next[key];
    else next[key] = state;
    persistChanges(next);
  }

  function handleDelete(studentId: string, isTemp: boolean, bus: BusName, section: string) {
    if (isTemp) {
      const mapKey = `${bus}_${section}`;
      setTempStudents((prev) => ({
        ...prev,
        [mapKey]: (prev[mapKey] ?? []).filter((s) => s.id !== studentId),
      }));
      const next = { ...changes };
      delete next[studentId];
      persistChanges(next);
    } else {
      const key = makeChangeKey(bus, section, studentId);
      handleToggle(key, 'absent');
    }
  }

  function handleAddTemp(bus: BusName, section: string, student: { name: string; place: string; time: string; note: string }) {
    const id = `temp_${bus}_${section}_${student.name}_${Date.now()}`;
    const newStudent: Student = {
      id,
      name: student.name,
      time: student.time,
      place: student.place,
      contact: '',
      note: student.note,
      dayMwf: '매일',
      timeTuTh: '',
      dayTuTh: '매일',
      bus,
      section: section as Student['section'],
      isTemp: true,
    };
    const mapKey = `${bus}_${section}`;
    setTempStudents((prev) => ({
      ...prev,
      [mapKey]: [...(prev[mapKey] ?? []), newStudent],
    }));
    const next = {
      ...changes,
      [id]: { isTemp: true as const, name: student.name, place: student.place, time: student.time, note: student.note, bus, section, id },
    };
    persistChanges(next as DailyChanges);
  }

  function handleSetCategory(studentName: string, category: StudentCategory) {
    const next = setStudentCategory(categoryStore, studentName, category);
    setCategoryStore(next);
    fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: next }),
    }).catch(console.error);
  }

  async function handleReupload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setReuploadLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error('upload failed');
      const newData = await res.json() as ShuttleBase;
      onReupload(newData);
    } catch (err) {
      console.error(err);
      alert('파일 업로드/파싱 실패. 형식을 확인해주세요.');
    } finally {
      setReuploadLoading(false);
    }
  }

  const displayedBuses =
    manageTab === '전체'
      ? data.buses
      : data.buses.filter((b) => b.name === manageTab);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xl">🚌</span>
          <div>
            <span className="font-bold text-gray-800">셔틀버스 대시보드</span>
            <span className="ml-3 text-sm text-gray-500">{formatDate(getTodayString())}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SearchPanel data={data} />
          <button
            onClick={() => window.print()}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            인쇄
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {reuploadLoading ? '업로드 중...' : '엑셀 재업로드'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleReupload} />
        </div>
      </div>

      {/* Mode tabs */}
      <div className="bg-white border-b border-gray-200 px-4 print:hidden">
        <div className="flex">
          <button
            onClick={() => setMode('dropoff')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              mode === 'dropoff' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            하원 명단
          </button>
          <button
            onClick={() => setMode('manage')}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              mode === 'manage' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            버스 관리
          </button>
        </div>
      </div>

      {/* ── 하원 명단 mode ── */}
      {mode === 'dropoff' && (
        <div className="p-4 max-w-6xl mx-auto">
          {/* 요일 선택 */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {DAY_OF_WEEK.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors border ${
                  selectedDay === d
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }${today === d ? ' ring-2 ring-indigo-300' : ''}`}
              >
                {d}
                {today === d && <span className="ml-1 text-[10px] opacity-80">오늘</span>}
              </button>
            ))}
          </div>

          {selectedDay === null ? (
            <div className="text-center text-gray-400 py-16">요일을 선택하세요.</div>
          ) : (
            <>
              {/* Category filter pills */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {CATEGORY_FILTERS.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                      categoryFilter === cat ? CATEGORY_ACTIVE_STYLE[cat] : CATEGORY_INACTIVE_STYLE
                    }`}
                  >
                    {cat}
                  </button>
                ))}
                {categoryFilter !== '전체' && (
                  <span className="text-xs text-gray-400 self-center ml-1">
                    * 구분 미설정 학생은 버스 관리에서 MK/AK/초등 버튼으로 지정하세요
                  </span>
                )}
              </div>

              <DropoffBoard
                buses={data.buses}
                changes={changes}
                categoryStore={categoryStore}
                categoryFilter={categoryFilter}
                today={selectedDay}
                tempStudents={tempStudents}
              />
            </>
          )}
        </div>
      )}

      {/* ── 버스 관리 mode ── */}
      {mode === 'manage' && (
        <>
          {/* Bus sub-tabs */}
          <div className="bg-white border-b border-gray-200 px-4 print:hidden">
            <div className="flex gap-0 overflow-x-auto">
              {MANAGE_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setManageTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    manageTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 max-w-5xl mx-auto">
            {today === null ? (
              <div className="text-center text-gray-400 py-16">오늘은 주말입니다. 셔틀 운행이 없습니다.</div>
            ) : (
              displayedBuses.map((bus) => (
                <div key={bus.name} className="mb-8">
                  {manageTab === '전체' && (
                    <h2 className="sticky top-0 z-20 text-base font-bold text-gray-700 mb-3 border-l-4 border-blue-500 pl-3 bg-gray-50 py-2 -mx-4 px-4">
                      {bus.name}
                    </h2>
                  )}
                  <HoTab
                    bus={bus}
                    today={today}
                    changes={changes}
                    tempStudents={tempStudents}
                    categoryStore={categoryStore}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onAddTemp={handleAddTemp}
                    onSetCategory={handleSetCategory}
                  />
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
