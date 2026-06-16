import { NextResponse } from 'next/server';
import { readBase } from '@/lib/serverStorage';

// 정적 캐싱 방지: 매 요청마다 최신 저장 데이터를 읽어야 한다
export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await readBase();
  if (!data) return NextResponse.json(null);
  return NextResponse.json(data);
}
