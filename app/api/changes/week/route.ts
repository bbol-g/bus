import { NextRequest, NextResponse } from 'next/server';
import { readChanges } from '@/lib/serverStorage';

export const dynamic = 'force-dynamic';

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// monday=YYYY-MM-DD 기준 월~금 각 날짜의 변동 건수를 반환
export async function GET(req: NextRequest) {
  const monday = req.nextUrl.searchParams.get('monday') ?? '';
  if (!monday) return NextResponse.json({}, { status: 400 });
  const out: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    const date = addDays(monday, i);
    const changes = await readChanges(date);
    out[date] = Object.keys(changes ?? {}).length;
  }
  return NextResponse.json(out);
}
