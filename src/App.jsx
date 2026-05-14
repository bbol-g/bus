import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import OverrideEditor from './components/OverrideEditor';
import StudentManager from './components/StudentManager';
import ExcelUploadPreview from './components/ExcelUploadPreview';
import PrintShareView from './components/PrintShareView';
import { sampleData } from './data/sampleData';
import { formatDate, getKoreanDayOfWeek } from './utils/dateUtils';
import { loadData, saveData } from './utils/storage';

const tabs=['오늘 대시보드','변동사항 입력','학생/스케줄 관리','엑셀 업로드','출력/공유'];
export default function App(){
  const [tab,setTab]=useState(tabs[0]);
  const [data,setData]=useState(()=>loadData()||sampleData);
  useEffect(()=>{ saveData(data); },[data]);
  return <div className='app'><header><h1>{formatDate(new Date())} {getKoreanDayOfWeek(new Date())}요일</h1><nav>{tabs.map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</nav></header>
  {tab===tabs[0]&&<Dashboard data={data}/>} {tab===tabs[1]&&<OverrideEditor data={data} setData={setData}/>} {tab===tabs[2]&&<StudentManager data={data} setData={setData}/>} {tab===tabs[3]&&<ExcelUploadPreview/>} {tab===tabs[4]&&<PrintShareView data={data}/>}</div>;
}
