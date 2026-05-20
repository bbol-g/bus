import { readBase } from '@/lib/serverStorage';
import type { ShuttleBase } from '@/types';

export async function GET() {
  const raw = await readBase();
  if (!raw) {
    return new Response('데이터 없음 — 엑셀을 먼저 업로드하세요.', { status: 404 });
  }

  const data = raw as ShuttleBase;
  const lines: string[] = [`업로드: ${data.uploadedAt}`, ''];

  for (const bus of data.buses) {
    lines.push(`━━━ ${bus.name} ━━━`);
    for (const sec of bus.sections) {
      lines.push(`  [${sec.name}] (${sec.students.length}명)`);
      for (const s of sec.students) {
        lines.push(`    ${s.time ?? ''} ${s.name}  (월수금=${s.dayMwf} 화목=${s.dayTuTh})`);
      }
    }
    lines.push('');
  }

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
