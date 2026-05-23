import { NextResponse } from 'next/server';
import { readBase } from '@/lib/serverStorage';
import type { ShuttleBase, BusData } from '@/types';

// 임시 디버그: 버스별 섹션 구조와 학생 목록 확인
export async function GET() {
  const data = await readBase() as ShuttleBase | null;
  if (!data) return NextResponse.json({ error: '데이터 없음' });

  const result: Record<string, { section: string; count: number; students: string[] }[]> = {};

  for (const bus of data.buses as BusData[]) {
    result[bus.name] = bus.sections.map(section => ({
      section: section.name,
      count: section.students.length,
      students: section.students.map(s => s.name),
    }));
  }

  return NextResponse.json(result);
}
