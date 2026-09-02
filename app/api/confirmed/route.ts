import { NextRequest, NextResponse } from 'next/server';
import { readConfirmed, writeConfirmed } from '@/lib/serverStorage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? '';
  if (!date) return NextResponse.json([], { status: 400 });
  return NextResponse.json(await readConfirmed(date));
}

export async function POST(req: NextRequest) {
  const { date, keys } = (await req.json()) as { date: string; keys: string[] };
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });
  await writeConfirmed(date, Array.isArray(keys) ? keys : []);
  return NextResponse.json({ ok: true });
}
