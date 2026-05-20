import { NextResponse } from 'next/server';
import { readBase } from '@/lib/serverStorage';
import type { ShuttleBase } from '@/types';

export async function GET() {
  const raw = await readBase();
  if (!raw) return NextResponse.json({ error: 'no data' });

  const data = raw as ShuttleBase;
  const summary = data.buses.map((bus) => ({
    bus: bus.name,
    sections: bus.sections.map((sec) => ({
      section: sec.name,
      count: sec.students.length,
      students: sec.students.map((s) => ({ name: s.name, dayMwf: s.dayMwf, dayTuTh: s.dayTuTh })),
    })),
  }));

  return NextResponse.json({ uploadedAt: data.uploadedAt, buses: summary });
}
