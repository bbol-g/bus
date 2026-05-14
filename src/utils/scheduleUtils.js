import { getKoreanDayOfWeek, formatDate } from './dateUtils';

export function getScheduleForStudentAndDay(studentId, dayOfWeek, weeklySchedules) {
  return weeklySchedules.find((s) => s.studentId === studentId && s.dayOfWeek === dayOfWeek);
}

export function applyDailyOverrides(students, weeklySchedules, dailyOverrides, selectedDate) {
  const dateKey = formatDate(selectedDate);
  const day = getKoreanDayOfWeek(selectedDate);
  const active = students.filter((s) => s.status === 'active');
  return active.map((student) => {
    const base = getScheduleForStudentAndDay(student.id, day, weeklySchedules);
    const override = dailyOverrides.find((o) => o.studentId === student.id && o.date === dateKey);
    const absent = override?.absent || false;
    return {
      student,
      absent,
      changed: !!override,
      memo: override?.memo || '',
      arrival: override?.arrivalOverride ?? base?.arrival ?? null,
      departure: override?.departureOverride ?? base?.departure ?? null,
    };
  });
}

export function groupByTimeAndBus(finalRows, type) {
  const grouped = {};
  finalRows.forEach((row) => {
    if (row.absent) return;
    const leg = row[type];
    if (!leg || leg.method === 'none' || !leg.time) return;
    grouped[leg.time] ??= { buses: {}, individual: [] };
    if (leg.method === 'individual') grouped[leg.time].individual.push(row);
    else {
      const bus = leg.bus || '미지정';
      grouped[leg.time].buses[bus] ??= [];
      grouped[leg.time].buses[bus].push(row);
    }
  });
  return grouped;
}

export function getDashboardSummary(finalRows) {
  const total = finalRows.length;
  const absent = finalRows.filter((r) => r.absent).length;
  const changed = finalRows.filter((r) => r.changed).length;
  return { total, absent, changed };
}
