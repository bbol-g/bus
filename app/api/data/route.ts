import { NextResponse } from 'next/server';
import type { ShuttleBase } from '@/types';
import { PARSER_VERSION, applyDeletedStudents, parseExcelBuffer } from '@/lib/excelParser';
import { readBase, readDeletedStudents, readRawExcel, writeBase } from '@/lib/serverStorage';

// 정적 캐싱 방지: 매 요청마다 최신 저장 데이터를 읽어야 한다
// (캐싱되면 재배포/재파싱 결과가 반영되지 않음)
export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await readBase() as ShuttleBase | null;
  if (!data) return NextResponse.json(null);

  // 파서 로직이 업데이트된 경우, 보관된 원본 엑셀로 자동 재파싱한다.
  if (data.parserVersion !== PARSER_VERSION) {
    const raw = await readRawExcel();
    if (raw) {
      const reparsed = parseExcelBuffer(Buffer.from(raw, 'base64'));
      applyDeletedStudents(reparsed, await readDeletedStudents());
      await writeBase(reparsed);
      return NextResponse.json(reparsed);
    }
  }

  return NextResponse.json(data);
}
