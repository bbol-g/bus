import { NextRequest, NextResponse } from 'next/server';
import { parseExcelBuffer } from '@/lib/excelParser';
import { writeBase, writeDeletedStudents, writeRawExcel } from '@/lib/serverStorage';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: '파일 없음' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const data = parseExcelBuffer(buffer);
    await writeBase(data);
    await writeRawExcel('');
    // 새 원본 엑셀이므로 이전에 영구 삭제했던 학생 목록은 더 이상 유효하지 않다.
    await writeDeletedStudents([]);
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '파싱 실패' }, { status: 500 });
  }
}
