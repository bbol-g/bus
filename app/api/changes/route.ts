import { NextRequest, NextResponse } from 'next/server';
import { readChanges, writeChanges } from '@/lib/serverStorage';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? '';
  if (!date) return NextResponse.json({}, { status: 400 });
  return NextResponse.json(readChanges(date));
}

export async function POST(req: NextRequest) {
  const { date, changes } = await req.json() as { date: string; changes: unknown };
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });
  writeChanges(date, changes);
  return NextResponse.json({ ok: true });
}
