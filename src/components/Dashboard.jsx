import { useMemo, useState } from 'react';
import { formatDate, getKoreanDayOfWeek } from '../utils/dateUtils';
import { applyDailyOverrides, getDashboardSummary, groupByTimeAndBus } from '../utils/scheduleUtils';
import ScheduleCard from './ScheduleCard';

export default function Dashboard({ data }) {
  const [date, setDate] = useState(formatDate(new Date()));
  const [tab, setTab] = useState('all');
  const finalRows = useMemo(() => applyDailyOverrides(data.students, data.weeklySchedules, data.dailyOverrides, date), [data, date]);
  const summary = getDashboardSummary(finalRows);
  const arrival = groupByTimeAndBus(finalRows, 'arrival');
  const departure = groupByTimeAndBus(finalRows, 'departure');
  return <section><div className='controls'><input type='date' value={date} onChange={(e)=>setDate(e.target.value)} /><span>{getKoreanDayOfWeek(date)}요일</span></div>
  <div className='summary'>전체 {summary.total} / 결석 {summary.absent} / 변경 {summary.changed}</div>
  <div className='tabs'>{['all','arrival','departure'].map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t==='all'?'전체':t==='arrival'?'등원':'하원'}</button>)}</div>
  <div className='grid'>
    {(tab==='all'||tab==='arrival') && Object.keys(arrival).sort().map((time)=><ScheduleCard key={time} title={`${time} 등원`} group={arrival[time]} type='arrival' />)}
    {(tab==='all'||tab==='departure') && Object.keys(departure).sort().map((time)=><ScheduleCard key={time} title={`${time} 하원`} group={departure[time]} type='departure' />)}
  </div></section>;
}
