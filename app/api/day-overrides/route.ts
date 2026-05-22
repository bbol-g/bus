import { NextRequest, NextResponse } from 'next/server';
import { readDayOverrides, writeDayOverrides } from '@/lib/serverStorage';

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name');
  const all = await readDayOverrides();
  if (name) return NextResponse.json(all[name] ?? {});
  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const { name, overrides } = await req.json() as { name: string; overrides: Record<string, string> };
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const all = await readDayOverrides();
  all[name] = overrides;
  await writeDayOverrides(all);
  return NextResponse.json({ ok: true });
}
