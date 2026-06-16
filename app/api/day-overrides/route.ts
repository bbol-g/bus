import { NextRequest, NextResponse } from 'next/server';
import { readDayOverrides, writeDayOverrides } from '@/lib/serverStorage';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  const all = await readDayOverrides();
  if (key) return NextResponse.json(all[key] ?? {});
  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const { key, overrides } = await req.json() as { key: string; overrides: Record<string, string> };
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
  const all = await readDayOverrides();
  all[key] = overrides;
  await writeDayOverrides(all);
  return NextResponse.json({ ok: true });
}
