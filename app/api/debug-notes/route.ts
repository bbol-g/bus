import { NextResponse } from 'next/server';
import { readBase } from '@/lib/serverStorage';
import type { ShuttleBase, BusData, Student } from '@/types';

// 임시 디버그 엔드포인트: 파싱된 학생 note 필드를 버스별로 확인
export async function GET() {
  const data = await readBase() as ShuttleBase | null;
  if (!data) return NextResponse.json({ error: '데이터 없음' });

  const result: Record<string, { section: string; name: string; note: string }[]> = {};

  for (const bus of data.buses as BusData[]) {
    const studentsWithNotes: { section: string; name: string; note: string }[] = [];
    for (const section of bus.sections) {
      for (const student of section.students as Student[]) {
        if (student.note) {
          studentsWithNotes.push({ section: section.name, name: student.name, note: student.note });
        }
      }
    }
    result[bus.name] = studentsWithNotes;
  }

  return NextResponse.json(result);
}
