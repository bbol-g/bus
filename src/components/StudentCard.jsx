export default function StudentCard({ row, dayOfWeek }) {
  const a = row.arrival;
  const d = row.departure;
  return <div className={`card ${row.absent ? 'absent' : ''}`}>
    <div className="row-between"><strong>{row.student.name}</strong>{row.changed && <span className="badge">변경</span>}</div>
    <div className="muted">{row.student.className} / {dayOfWeek}요일</div>
    <div>등원: {a?.method || 'none'} {a?.time || '-'}</div>
    <div>하원: {d?.method || 'none'} {d?.time || '-'}</div>
    {row.memo && <div className="warn">메모: {row.memo}</div>}
  </div>;
}
