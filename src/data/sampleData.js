const now = '2026-05-14T00:00:00.000Z';
const today = '2026-05-14';

const mkLeg = (time, method, bus, stopTime, place, note = '') => ({ time, method, bus, stopTime, place, note });
const noneLeg = { time: null, method: 'none', bus: null, stopTime: null, place: '', note: '' };

export const sampleData = {
  students: [
    '김민준','이서윤','박도윤','최지우','정하율','한예린','오지호','윤가은','서준호','장시우','강나윤'
  ].map((name, idx) => ({ id: `stu_${String(idx+1).padStart(3,'0')}`, name, className: idx%3===0?'초등A':idx%3===1?'초등B':'중등', status: 'active', memo: '', createdAt: now, updatedAt: now })),
  weeklySchedules: [],
  dailyOverrides: [
    { id:'ovr_001', date:today, studentId:'stu_004', absent:true, arrivalOverride:null, departureOverride:null, memo:'감기 결석', updatedAt:now },
    { id:'ovr_002', date:today, studentId:'stu_003', absent:false, arrivalOverride:null, departureOverride:mkLeg('16:30','individual',null,null,'','오늘 아빠가 직접 하원'), memo:'개별하원', updatedAt:now },
    { id:'ovr_003', date:today, studentId:'stu_002', absent:false, arrivalOverride:mkLeg('09:30','shuttle','3호차','09:22','B상가','오늘 3호차 이용'), departureOverride:null, memo:'셔틀 변경', updatedAt:now }
  ]
};

const patterns = [
  ['월','수','금'], ['화','목'], ['월','화','수','목','금']
];
const arrivals = ['09:30','15:00','16:30'];
const departures = ['15:00','16:30','18:00'];
const buses = ['1호차','2호차','3호차'];

sampleData.students.forEach((s, idx) => {
  ['월','화','수','목','금'].forEach((day) => {
    const include = patterns[idx%3].includes(day);
    let arrival = noneLeg;
    let departure = noneLeg;
    if (include) {
      const arrMethod = idx===5 ? 'individual' : 'shuttle';
      const depMethod = idx===6 ? 'individual' : 'shuttle';
      arrival = arrMethod === 'shuttle' ? mkLeg(arrivals[idx%3],'shuttle',buses[idx%3],`0${9+idx%3}:1${idx%6}`.slice(-5),`${String.fromCharCode(65+(idx%5))}아파트`,'') : mkLeg(arrivals[idx%3],'individual',null,null,'','직접 등원');
      departure = depMethod === 'shuttle' ? mkLeg(departures[idx%3],'shuttle',buses[(idx+1)%3],`${15+idx%3}:${40+(idx%9)}`,'A아파트','') : mkLeg(departures[idx%3],'individual',null,null,'','직접 하원');
    }
    sampleData.weeklySchedules.push({ id:`sch_${sampleData.weeklySchedules.length+1}`, studentId:s.id, dayOfWeek:day, arrival, departure });
  });
});
