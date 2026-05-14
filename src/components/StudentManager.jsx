import { useMemo, useState } from 'react';
const days=['월','화','수','목','금'];
const emptyLeg={ time:null, method:'none', bus:null, stopTime:null, place:'', note:'' };

export default function StudentManager({ data, setData }) {
  const [name,setName]=useState(''); const [className,setClassName]=useState('');
  const [status,setStatus]=useState('all'); const [q,setQ]=useState('');
  const students = useMemo(()=>data.students.filter(s=>(status==='all'||s.status===status)&&s.name.includes(q)),[data,status,q]);
  const add=()=>{ if(!name) return; const id=`stu_${Date.now()}`; const s={id,name,className,status:'active',memo:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    const ws = days.map(day=>({id:`sch_${id}_${day}`,studentId:id,dayOfWeek:day,arrival:emptyLeg,departure:emptyLeg}));
    setData({...data,students:[...data.students,s],weeklySchedules:[...data.weeklySchedules,...ws]}); setName(''); setClassName(''); };
  const setStudentStatus=(id,st)=>setData({...data,students:data.students.map(s=>s.id===id?{...s,status:st}:s)});
  const hardDelete=(id)=>{ if(!confirm('완전 삭제하시겠습니까?')) return; setData({...data,students:data.students.filter(s=>s.id!==id),weeklySchedules:data.weeklySchedules.filter(w=>w.studentId!==id),dailyOverrides:data.dailyOverrides.filter(o=>o.studentId!==id)}); };
  return <section><div className='controls'><input placeholder='이름' value={name} onChange={e=>setName(e.target.value)}/><input placeholder='반' value={className} onChange={e=>setClassName(e.target.value)}/><button onClick={add}>학생 추가</button></div>
  <div className='controls'><input placeholder='검색' value={q} onChange={e=>setQ(e.target.value)}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value='all'>전체</option><option value='active'>재원</option><option value='paused'>휴원</option><option value='left'>퇴원</option></select></div>
  <div className='grid'>{students.map(s=><div className='card' key={s.id}><strong>{s.name}</strong><div>{s.className}</div><div>{s.status}</div><button onClick={()=>setStudentStatus(s.id,'paused')}>휴원</button><button onClick={()=>setStudentStatus(s.id,'left')}>퇴원</button><button className='danger' onClick={()=>hardDelete(s.id)}>완전 삭제</button></div>)}</div></section>;
}
