import { NextRequest, NextResponse } from 'next/server';
import { parseExcelBuffer } from '@/lib/excelParser';
import { writeBase } from '@/lib/serverStorage';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: '파일 없음' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const data = parseExcelBuffer(buffer);
    writeBase(data);
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '파싱 실패' }, { status: 500 });
  }
}
