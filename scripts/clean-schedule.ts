/**
 * 셔틀 스케줄 엑셀 정리 도구
 * ------------------------------------------------------------------
 * 실무에서 관리하는 "원본" 엑셀은 병합 셀, 요일이 뒤섞인 열, 메모에 섞인
 * 요일 정보, 양식마다 다른 머리글(아동명/월수금/화목/연락처 등) 때문에
 * 웹앱 파서가 그대로 읽기 어렵다.
 *
 * 이 스크립트는 원본을 웹앱 파서(lib/excelParser)로 "해석"한 다음, 그 결과를
 * 파서가 항상 동일하게 읽어들이는 표준(클린) 형식으로 다시 써준다.
 *   - 5개 호차 시트: 표준 머리글 + 학생당 1행으로 재작성 (연락처 보존)
 *   - 요일은 실제 탑승 요일 하나로 합쳐서 기록 (앱도 합쳐서 표시함)
 *   - 자동 인식이 애매했던 학생은 요일을 비워 두어 앱에서 "검토" 배지가
 *     계속 뜨도록 한다 (사람이 최종 확인)
 *   - 학원 / 개별등하원 명단 등 참고용 시트는 원본 그대로 보존
 *
 * 사용법:
 *   npx tsx scripts/clean-schedule.ts <입력.xlsx> [출력.xlsx]
 */
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { parseExcelBuffer } from '@/lib/excelParser';
import { ALL_SECTIONS } from '@/types';
import type { BusData, Student } from '@/types';

const WEEK = ['월', '화', '수', '목', '금'] as const;

function expand(v: string): Set<string> {
  const t = (v || '').trim();
  if (!t) return new Set();
  if (t === '매일') return new Set(WEEK);
  return new Set(WEEK.filter((d) => t.includes(d)));
}

function serialize(set: Set<string>): string {
  const ordered = WEEK.filter((d) => set.has(d));
  if (ordered.length === 0) return '';
  return ordered.length === WEEK.length ? '매일' : ordered.join('');
}

function unionDays(a: string, b: string): string {
  const s = new Set<string>();
  expand(a).forEach((d) => s.add(d));
  expand(b).forEach((d) => s.add(d));
  return serialize(s);
}

function clean(s: string): string {
  return (s || '').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

// 앱은 월수금/화목을 화면에서 구분하지 않고 요일을 하나로 합쳐 표시하므로,
// 클린 파일도 학생당 1행(이름 + 실제 탑승 요일 하나)으로 단순화한다.
// '이름(화목)' 열은 항상 비어 있지만, 어떤 파서 버전이든 특이사항을 화목
// 이름으로 오인하지 않도록 머리글을 명시해 둔다(하위 호환).
const HEADER = ['', '시간', '장소', '연락처', '이름(월수금)', '요일', '시간', '이름(화목)', '특이사항'];

// 학생 1명 → 클린 행 1개. 요일이 아예 없는(정규화 과정에서 다른 시간대가
// 모두 가져간) 학생은 어차피 어느 요일에도 안 뜨므로 null을 반환해 건너뛴다.
function studentRow(s: Student): string[] | null {
  const union = unionDays(s.dayMwf, s.dayTuTh);
  if (!union) return null; // 탑승 요일 없음 → 스킵
  const contact = clean(s.contact);
  const note = clean(s.note);
  // 자동 인식이 애매했던 학생은 요일을 비워 앱에서 "검토" 배지가 계속 뜨게 한다.
  const day = s.needsReview ? '' : union;
  return ['', s.time || '', s.place || '', contact, s.name, day, '', '', note];
}

function buildBusSheet(bus: BusData): XLSX.WorkSheet {
  const aoa: string[][] = [];
  for (const sectionName of ALL_SECTIONS) {
    const section = bus.sections.find((s) => s.name === sectionName);
    if (!section || section.students.length === 0) continue;
    const rows = section.students.map(studentRow).filter((r): r is string[] => r !== null);
    if (rows.length === 0) continue;
    aoa.push(['', sectionName]);
    aoa.push([...HEADER]);
    aoa.push(...rows);
    aoa.push([]); // 섹션 사이 빈 줄
  }
  return XLSX.utils.aoa_to_sheet(aoa);
}

function main() {
  const inPath = process.argv[2];
  if (!inPath) {
    console.error('사용법: npx tsx scripts/clean-schedule.ts <입력.xlsx> [출력.xlsx]');
    process.exit(1);
  }
  const outPath =
    process.argv[3] ||
    path.join(path.dirname(inPath), path.basename(inPath, path.extname(inPath)) + '.cleaned.xlsx');

  const buf = fs.readFileSync(inPath);
  const data = parseExcelBuffer(buf);

  // 원본 워크북을 그대로 열어 참고용 시트(학원, 개별등하원 명단 등)를 보존한다.
  const srcWb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const outWb = XLSX.utils.book_new();

  const busNames = new Set<string>(data.buses.map((b) => b.name));

  // 1) 호차 시트: 클린 형식으로 재작성
  for (const bus of data.buses) {
    if (bus.name === '개별') continue;
    XLSX.utils.book_append_sheet(outWb, buildBusSheet(bus), bus.name);
  }

  // 2) 나머지 시트: 원본 그대로 보존
  for (const name of srcWb.SheetNames) {
    if (busNames.has(name)) continue; // 호차 시트는 위에서 재작성했음
    XLSX.utils.book_append_sheet(outWb, srcWb.Sheets[name], name);
  }

  XLSX.writeFile(outWb, outPath);

  // 요약 출력
  let total = 0;
  let review = 0;
  const reviewList: string[] = [];
  for (const bus of data.buses) {
    for (const sec of bus.sections) {
      for (const st of sec.students) {
        total++;
        if (st.needsReview) {
          review++;
          reviewList.push(`${bus.name} / ${sec.name} / ${st.name}`);
        }
      }
    }
  }
  console.log('입력 :', inPath);
  console.log('출력 :', outPath);
  console.log('시트 :', outWb.SheetNames.join(', '));
  console.log(`학생 : ${total}명 (검토 필요 ${review}명)`);
  if (reviewList.length) console.log('검토 대상:\n  - ' + reviewList.join('\n  - '));
}

main();
