import { NextRequest, NextResponse } from 'next/server';
import type { ShuttleBase } from '@/types';
import { studentIdentityKey } from '@/lib/excelParser';
import { readBase, readDeletedStudents, writeBase, writeDeletedStudents } from '@/lib/serverStorage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { bus, section, studentId } = await req.json() as { bus: string; section: string; studentId: string };

  const data = await readBase() as ShuttleBase | null;
  if (!data) return NextResponse.json({ error: '데이터 없음' }, { status: 404 });

  let removedName: string | null = null;
  for (const b of data.buses) {
    if (b.name !== bus) continue;
    for (const s of b.sections) {
      if (s.name !== section) continue;
      const target = s.students.find((st) => st.id === studentId);
      if (target) {
        removedName = target.name;
        s.students = s.students.filter((st) => st.id !== studentId);
      }
    }
  }

  if (removedName) {
    const identity = studentIdentityKey(bus, section, removedName);
    const deleted = await readDeletedStudents();
    if (!deleted.includes(identity)) {
      await writeDeletedStudents([...deleted, identity]);
    }
  }

  await writeBase(data);
  return NextResponse.json(data);
}
