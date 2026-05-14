'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BusName, ChangeState, DailyChanges, ShuttleBase, Student } from '@/types';
import { BUS_NAMES } from '@/types';
import { getTodayKorean } from '@/lib/dateUtils';
import { loadTodayChanges, makeChangeKey, saveTodayChanges } from '@/lib/storage';
import HoTab from './HoTab';
import SummaryBar from './SummaryBar';
import { parseExcelFile } from '@/lib/excelParser';
import { saveBase } from '@/lib/storage';

const ALL_TAB = '전체';
type TabType = typeof ALL_TAB | BusName;

interface Props {
  data: ShuttleBase;
  onReupload: (data: ShuttleBase) => void;
}

export default function Dashboard({ data, onReupload }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>(ALL_TAB);
  const [changes, setChanges] = useState<DailyChanges>({});
  // tempStudents: { [`${bus}_${section}`]: Student[] }
  const [tempStudents, setTempStudents] = useState<Record<string, Student[]>>({});
  const today = getTodayKorean();
  const fileRef = useRef<HTMLInputElement>(null);
  const [reuploadLoading, setReuploadLoading] = useState(false);

  useEffect(() => {
    const loaded = loadTodayChanges();
    setChanges(loaded);
    // Extract temp students from changes
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
  }, []);

  const persistChanges = useCallback((next: DailyChanges) => {
    setChanges(next);
    saveTodayChanges(next);
  }, []);

  function handleToggle(key: string, state: ChangeState | null) {
    const next = { ...changes };
    if (state === null) delete next[key];
    else next[key] = state;
    persistChanges(next);
  }

  function handleDelete(studentId: string, isTemp: boolean, bus: BusName, section: string) {
    if (isTemp) {
      // Remove temp student from tempStudents + changes
      const mapKey = `${bus}_${section}`;
      setTempStudents((prev) => {
        const list = (prev[mapKey] ?? []).filter((s) => s.id !== studentId);
        return { ...prev, [mapKey]: list };
      });
      const next = { ...changes };
      delete next[studentId]; // temp key is stored by id
      persistChanges(next);
    } else {
      // Mark base student as absent
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
    // Save temp student data in changes under its id
    const next = {
      ...changes,
      [id]: { isTemp: true as const, name: student.name, place: student.place, time: student.time, note: student.note, bus, section, id },
    };
    persistChanges(next as DailyChanges);
  }

  async function handleReupload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setReuploadLoading(true);
    try {
      const newData = await parseExcelFile(file);
      saveBase(newData);
      onReupload(newData);
    } catch (err) {
      console.error(err);
      alert('파일 파싱 실패. 형식을 확인해주세요.');
    } finally {
      setReuploadLoading(false);
    }
  }

  const tabs: TabType[] = [ALL_TAB, ...BUS_NAMES];
  const displayedBuses =
    activeTab === ALL_TAB
      ? data.buses
      : data.buses.filter((b) => b.name === activeTab);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xl">🚌</span>
          <span className="font-bold text-gray-800">셔틀버스 대시보드</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
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

      {/* Summary bar */}
      <div className="print:hidden">
        <SummaryBar buses={data.buses} changes={changes} />
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 print:hidden">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block px-4 py-2 border-b">
        <span className="font-bold text-lg">셔틀버스 명단 — {activeTab}</span>
      </div>

      {/* Content */}
      <div className="p-4 max-w-5xl mx-auto">
        {today === null ? (
          <div className="text-center text-gray-400 py-16">
            오늘은 주말입니다. 셔틀 운행이 없습니다.
          </div>
        ) : (
          displayedBuses.map((bus) => (
            <div key={bus.name} className="mb-8">
              {activeTab === ALL_TAB && (
                <h2 className="text-base font-bold text-gray-700 mb-3 border-l-4 border-blue-500 pl-3">
                  {bus.name}
                </h2>
              )}
              <HoTab
                bus={bus}
                today={today}
                changes={changes}
                tempStudents={tempStudents}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onAddTemp={handleAddTemp}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
