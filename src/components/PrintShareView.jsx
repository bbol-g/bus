import { useMemo, useState } from 'react';
import { formatDate, getKoreanDayOfWeek } from '../utils/dateUtils';
import { applyDailyOverrides, groupByTimeAndBus } from '../utils/scheduleUtils';

export default function PrintShareView({ data }) {
  const [date,setDate]=useState(formatDate(new Date()));
  const [type,setType]=useState('arrival');
  const rows = useMemo(()=>applyDailyOverrides(data.students,data.weeklySchedules,data.dailyOverrides,date),[data,date]);
  const grouped = groupByTimeAndBus(rows,type);
  const text = useMemo(()=>{
    const lines=[`[${date} ${getKoreanDayOfWeek(date)}요일 ${type==='arrival'?'등원표':'하원표}]`,` `];
    Object.keys(grouped).sort().forEach((t)=>{ lines.push(`${t} ${type==='arrival'?'등원':'하원'}`,''); Object.entries(grouped[t].buses).forEach(([bus,list])=>{lines.push(bus); list.forEach((r,i)=>lines.push(`${i+1}. ${r[type].stopTime||'-'} ${r.student.name} / ${r[type].place||'-'}${r[type].note?` / ${r[type].note}`:''}`)); lines.push('');}); if(grouped[t].individual.length){lines.push(type==='arrival'?'개별등원':'개별하원'); grouped[t].individual.forEach((r,i)=>lines.push(`${i+1}. ${r.student.name} / ${r[type].note||r.memo||''}`)); lines.push('');}});
    const changed=rows.filter(r=>r.changed); if(changed.length){lines.push('[변경사항]'); changed.forEach(r=>lines.push(`- ${r.student.name}: ${r.memo||'변경 있음'}`));}
    return lines.join('\n');
  },[grouped,date,type,rows]);
  const copy=async()=>{ try{ await navigator.clipboard.writeText(text); alert('복사되었습니다'); } catch{ prompt('복사 실패: 아래 텍스트를 수동 복사하세요', text); } };
  return <section><div className='controls no-print'><input type='date' value={date} onChange={e=>setDate(e.target.value)}/><select value={type} onChange={e=>setType(e.target.value)}><option value='arrival'>등원표</option><option value='departure'>하원표</option></select><button onClick={copy}>텍스트 복사</button><button onClick={()=>window.print()}>인쇄하기</button></div><textarea value={text} readOnly rows={20} /></section>;
}
