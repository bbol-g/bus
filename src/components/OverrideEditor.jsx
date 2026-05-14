import { useMemo, useState } from 'react';
import { formatDate, getKoreanDayOfWeek } from '../utils/dateUtils';
import { applyDailyOverrides } from '../utils/scheduleUtils';
import StudentCard from './StudentCard';

export default function OverrideEditor({ data, setData }) {
  const [date, setDate] = useState(formatDate(new Date()));
  const [q, setQ] = useState('');
  const rows = useMemo(()=>applyDailyOverrides(data.students, data.weeklySchedules, data.dailyOverrides, date),[data,date]);
  const filtered = rows.filter(r=>r.student.name.includes(q));
  const save = (studentId, patch)=>{
    const idx = data.dailyOverrides.findIndex(o=>o.studentId===studentId && o.date===date);
    const next = [...data.dailyOverrides];
    const base = idx>=0 ? next[idx] : { id:`ovr_${Date.now()}`, date, studentId, absent:false, arrivalOverride:null, departureOverride:null, memo:'', updatedAt:new Date().toISOString() };
    const merged = { ...base, ...patch, updatedAt:new Date().toISOString() };
    if (idx>=0) next[idx] = merged; else next.push(merged);
    setData({ ...data, dailyOverrides: next });
  };
  return <section><div className='controls'><input type='date' value={date} onChange={e=>setDate(e.target.value)}/><span>{getKoreanDayOfWeek(date)}요일</span><input placeholder='학생 검색' value={q} onChange={e=>setQ(e.target.value)} /></div>
  <div className='grid'>{filtered.map(r=><div key={r.student.id}><StudentCard row={r} dayOfWeek={getKoreanDayOfWeek(date)} />
  <label><input type='checkbox' checked={r.absent} onChange={e=>save(r.student.id,{ absent:e.target.checked })}/> 결석</label>
  <button onClick={()=>save(r.student.id,{ departureOverride:{...r.departure, method:'individual', bus:null, stopTime:null, note:'개별하원 변경'}})}>개별하원</button>
  <button onClick={()=>save(r.student.id,{ arrivalOverride:{...r.arrival, method:'individual', bus:null, stopTime:null, note:'개별등원 변경'}})}>개별등원</button>
  <button onClick={()=>save(r.student.id,{ arrivalOverride:null, departureOverride:null, memo:'' })}>기본대로</button></div>)}</div></section>;
}
