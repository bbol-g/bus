export default function ScheduleCard({ title, group, type }) {
  return <div className="card"><h3>{title}</h3>
    {Object.entries(group.buses).map(([bus, rows]) => <div key={bus}><strong>{bus}</strong>
      <ul>{rows.map((r) => <li key={r.student.id}>{r[type].stopTime || '-'} {r.student.name} / {r[type].place || '-'} {r[type].note ? `/ ${r[type].note}` : ''} {r.changed && <span className="badge">변경</span>}</li>)}</ul>
    </div>)}
    {group.individual.length > 0 && <div><strong>개별{type==='arrival'?'등원':'하원'}</strong><ul>{group.individual.map((r)=><li key={r.student.id}>{r.student.name} / {r[type].note || r.memo || '-'}</li>)}</ul></div>}
  </div>;
}
