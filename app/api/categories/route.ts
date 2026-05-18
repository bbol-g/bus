import { NextRequest, NextResponse } from 'next/server';
import { readCategories, writeCategories } from '@/lib/serverStorage';

export async function GET() {
  return NextResponse.json(readCategories());
}

export async function POST(req: NextRequest) {
  const { categories } = await req.json() as { categories: unknown };
  writeCategories(categories);
  return NextResponse.json({ ok: true });
}
