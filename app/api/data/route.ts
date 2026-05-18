import { NextResponse } from 'next/server';
import { readBase } from '@/lib/serverStorage';

export async function GET() {
  const data = readBase();
  if (!data) return NextResponse.json(null);
  return NextResponse.json(data);
}
