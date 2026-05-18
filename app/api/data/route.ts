import { NextResponse } from 'next/server';
import { readBase } from '@/lib/serverStorage';

export async function GET() {
  const data = await readBase();
  return NextResponse.json(data ?? null);
}
