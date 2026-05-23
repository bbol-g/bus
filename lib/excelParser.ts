import * as XLSX from 'xlsx';
import type { BusData, BusName, Section, SectionType, ShuttleBase, Student } from '@/types';
import { ALL_SECTIONS } from '@/types';

// 호차별 시트 이름
const BUS_SHEETS: BusName[] = ['1호차', '2호차', '3호차', '5호차', '6호차'];

// 실제 엑셀 컬럼 구조 (0-based, A열은 항상 빈칸)
// A(0)=empty, B(1)=시간(월수금), C(2)=장소, D(3)=이름(월수금), E(4)=요일(월수금),
// F(5)=시간(화목), G(6)=이름(화목)
const COL = {
  TIME_MWF: 1,
  PLACE: 2,
  NAME_MWF: 3,
  DAY_MWF: 4,
  TIME_TUTH: 5,
  NAME_TUTH: 6,
  NOTE: 7,
};

function cellStr(row: unknown[], idx: number): string {
  const v = (row as (string | number | boolean | null | undefined)[])[idx];
  if (v == null || v === '') return '';
  return String(v).trim();
}

// Excel 시간값(소수) 또는 Date를 HH:MM 문자열로 변환
function formatExcelTime(val: unknown): string {
  if (val == null || val === '') return '';
  if (typeof val === 'number') {
    const totalMinutes = Math.round(val * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  }
  if (val instanceof Date) {
    return `${val.getUTCHours()}:${String(val.getUTCMinutes()).padStart(2, '0')}`;
  }
  // 문자열인 경우 (예: '화 3:07', '목 3:10 ')
  const s = String(val).trim();
  const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) return `${timeMatch[1]}:${timeMatch[2]}`;
  return s;
}

// 화목 학생의 요일 추론
// - col4(요일 컬럼)가 화목 패턴이면 그것을 사용
// - col5(화목 시간)이 '화 3:07' 형태면 '화' 추출
function inferTuThDay(dayCol: string, timeCol: string): string {
  // 화목 요일 패턴인 경우
  if (/^[화목]+$/.test(dayCol)) return dayCol;
  // 시간 컬럼에 요일 포함 (예: '화 3:07')
  if (timeCol.startsWith('화') && !timeCol.startsWith('화목')) return '화';
  if (timeCol.startsWith('목')) return '목';
  if (timeCol.startsWith('화목')) return '화목';
  // 기본값
  return '화목';
}

// 유니코드 공백(전각·비분리 등) 및 한글 숫자 변형을 정규화
function normalizeSection(value: string): string {
  return value
    .replace(/[   -   　﻿]/g, ' ') // 유니코드 공백 → 일반 공백
    .replace(/\s+/g, ' ')
    .trim();
}

function isSectionHeader(value: string): SectionType | null {
  const normalized = normalizeSection(value);
  if (ALL_SECTIONS.includes(normalized as SectionType)) return normalized as SectionType;

  // 공백 없이 붙어있는 경우도 허용 (예: "3시하원" → "3시 하원")
  for (const sec of ALL_SECTIONS) {
    if (normalizeSection(sec).replace(/\s/g, '') === normalized.replace(/\s/g, '')) {
      return sec;
    }
  }
  return null;
}

function generateId(bus: string, section: string, name: string, idx: number): string {
  return `${bus}_${section}_${name}_${idx}`;
}

// 학생 이름이 헤더 텍스트인지 판별 (파싱 오류 방지)
function isHeaderValue(v: string): boolean {
  const EXACT = ['시간', '장소', '이름', '요일', '아동명', '연락처', '구분', '특이사항'];
  if (EXACT.includes(v)) return true;
  // 괄호 포함 변형: '이름(화목)', '이름(월수금)', '시간(화목)' 등
  if (EXACT.some(h => v.startsWith(h + '('))) return true;
  // 요일+시간 패턴: '금 3:08', '화3:10', '목 15:00' 등
  if (/^[월화수목금]\s*\d{1,2}:\d{2}/.test(v)) return true;
  return false;
}

function parseBusSheet(sheetName: BusName, rows: unknown[][]): BusData {
  const sections: Section[] = [];
  let currentSection: Section | null = null;
  let headerSkip = false;
  let studentIdx = 0;
  let lastTimeMwf = '';
  let lastPlace = '';

  // 컬럼 위치 — 헤더 행에서 동적 감지 (기본값은 COL 상수)
  let colTimeMwf = COL.TIME_MWF;
  let colPlace    = COL.PLACE;
  let colNameMwf  = COL.NAME_MWF;
  let colDayMwf   = COL.DAY_MWF;
  let colTimeTuTh = COL.TIME_TUTH;
  let colNameTuTh = COL.NAME_TUTH;
  let colNote     = COL.NOTE;

  for (const row of rows) {
    if ((row as unknown[]).every((c) => c == null || c === '')) continue;

    // 섹션 헤더 탐지: B열(index 1) 우선, 없으면 A열(index 0)도 확인
    const col1Str = cellStr(row, 1);
    const col0Str = cellStr(row, 0);
    const sectionMatch = isSectionHeader(col1Str) ?? isSectionHeader(col0Str);

    if (sectionMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = { name: sectionMatch, students: [] };
      headerSkip = true;
      studentIdx = 0;
      lastTimeMwf = '';
      lastPlace = '';
      continue;
    }

    // 섹션 헤더 직후의 컬럼명 행: 모든 컬럼 위치 동적 감지
    if (headerSkip) {
      headerSkip = false;
      const cells = (row as (string | number | boolean | null | undefined)[]).map(c => String(c ?? '').trim());
      let timeSeen = 0;
      let nameSeen = 0;
      for (let i = 0; i < cells.length; i++) {
        const v = cells[i];
        if (!v) continue;
        if (v === '시간(월수금)') {
          colTimeMwf = i;
        } else if (v === '시간(화목)') {
          colTimeTuTh = i;
        } else if (v === '시간') {
          if (timeSeen === 0) colTimeMwf = i; else colTimeTuTh = i;
          timeSeen++;
        } else if (v === '장소') {
          colPlace = i;
        } else if (v === '이름(월수금)') {
          colNameMwf = i; nameSeen++;
        } else if (v === '이름(화목)') {
          colNameTuTh = i; nameSeen++;
        } else if (v === '이름' || v.startsWith('이름(')) {
          if (nameSeen === 0) colNameMwf = i; else colNameTuTh = i;
          nameSeen++;
        } else if (v === '요일' || v.startsWith('요일(')) {
          colDayMwf = i;
        } else if (v === '비고' || v === '특이사항') {
          colNote = i;
        }
      }
      continue;
    }

    if (!currentSection) continue;

    const rawTimeMwf = (row as unknown[])[colTimeMwf];
    const rawPlace   = cellStr(row, colPlace);
    const nameMwf    = cellStr(row, colNameMwf);
    const dayMwf     = cellStr(row, colDayMwf);
    const rawTimeTuTh = (row as unknown[])[colTimeTuTh];
    const nameTuTh   = cellStr(row, colNameTuTh);
    const note       = cellStr(row, colNote);

    // 헤더 값 혼입 방지: 시간/장소 승계 전에 검사하여 lastTimeMwf/lastPlace 오염 방지
    if (isHeaderValue(nameMwf)) continue;
    const headerCellCount = [nameMwf, nameTuTh, cellStr(row, colTimeMwf), rawPlace].filter(v => isHeaderValue(String(v))).length;
    if (headerCellCount >= 2) continue;

    // 시간/장소 승계 (빈 셀이면 이전 값 사용)
    if (rawTimeMwf != null && rawTimeMwf !== '') lastTimeMwf = formatExcelTime(rawTimeMwf);
    if (rawPlace) lastPlace = rawPlace;

    const timeMwfStr = lastTimeMwf;
    const placeStr = lastPlace;

    const hasMwf = nameMwf && !isHeaderValue(nameMwf);
    const hasTuTh = nameTuTh && !isHeaderValue(nameTuTh);

    // 같은 학생이 양쪽 컬럼에 모두 있는 경우: 하나로 합침 (중복 방지)
    if (hasMwf && hasTuTh && nameMwf === nameTuTh) {
      const timeTuThStr = formatExcelTime(rawTimeTuTh);
      const tuThDay = inferTuThDay(dayMwf, cellStr(row, colTimeTuTh));
      currentSection.students.push({
        id: generateId(sheetName, currentSection.name, nameMwf, studentIdx++),
        name: nameMwf,
        time: timeMwfStr,
        place: placeStr,
        contact: '',
        note,
        dayMwf: dayMwf || '매일',
        timeTuTh: timeTuThStr,
        dayTuTh: tuThDay,
        bus: sheetName,
        section: currentSection.name,
      });
      continue;
    }

    // ① 월수금 학생 (D열에 이름이 있는 경우)
    if (hasMwf) {
      currentSection.students.push({
        id: generateId(sheetName, currentSection.name, nameMwf, studentIdx++),
        name: nameMwf,
        time: timeMwfStr,
        place: placeStr,
        contact: '',
        note,
        dayMwf: dayMwf || '매일',
        timeTuTh: '',
        dayTuTh: '',
        bus: sheetName,
        section: currentSection.name,
      });
    }

    // ② 화목 학생 (G열에 이름이 있는 경우, 다른 이름인 경우만)
    if (hasTuTh) {
      const timeTuThStr = formatExcelTime(rawTimeTuTh);
      const tuThDay = inferTuThDay(dayMwf, cellStr(row, colTimeTuTh));

      currentSection.students.push({
        id: generateId(sheetName, currentSection.name, nameTuTh, studentIdx++),
        name: nameTuTh,
        time: timeTuThStr,
        place: placeStr,
        contact: '',
        note,
        dayMwf: '',
        timeTuTh: timeTuThStr,
        dayTuTh: tuThDay,
        bus: sheetName,
        section: currentSection.name,
      });
    }
  }

  if (currentSection) sections.push(currentSection);
  return { name: sheetName, sections };
}

// 개별등하원 시트 파싱 (선택적)
// 컬럼: A=구분, B=시간, C=장소, D=연락처, E=아동명, F=요일(월수금), G=시간(화목), H=요일(화목), I=특이사항
function parseIndivSheet(rows: unknown[][]): BusData {
  const indivPickup: Section = { name: '9시 30분 등원', students: [] };
  const indivDropoff: Section = { name: '3시 하원', students: [] };
  let headerPassed = false;
  let studentIdx = 0;

  for (const row of rows) {
    if ((row as unknown[]).every((c) => c == null || c === '')) continue;

    const firstCell = cellStr(row, 0);
    if (!headerPassed) {
      headerPassed = true;
      if (firstCell === '구분') continue;
    }

    const type = firstCell;
    if (type !== '등원_개별' && type !== '하원_개별') continue;

    const name = cellStr(row, 4);
    if (!name) continue;

    const section: SectionType = type === '등원_개별' ? '9시 30분 등원' : '3시 하원';
    const student: Student = {
      id: generateId('개별', section, name, studentIdx++),
      name,
      time: formatExcelTime((row as unknown[])[1]),
      place: cellStr(row, 2),
      contact: cellStr(row, 3),
      note: cellStr(row, 8),
      dayMwf: cellStr(row, 5),
      timeTuTh: formatExcelTime((row as unknown[])[6]),
      dayTuTh: cellStr(row, 7),
      bus: '개별',
      section,
      type,
    };

    if (type === '등원_개별') indivPickup.students.push(student);
    else indivDropoff.students.push(student);
  }

  const sections: Section[] = [];
  if (indivPickup.students.length) sections.push(indivPickup);
  if (indivDropoff.students.length) sections.push(indivDropoff);
  return { name: '개별', sections };
}

export async function parseExcelFile(file: File): Promise<ShuttleBase> {
  const buffer = await file.arrayBuffer();
  return parseWorkbook(XLSX.read(buffer, { type: 'array', cellDates: true }));
}

export function parseExcelBuffer(buffer: Buffer): ShuttleBase {
  return parseWorkbook(XLSX.read(buffer, { type: 'buffer', cellDates: true }));
}

function parseWorkbook(wb: XLSX.WorkBook): ShuttleBase {
  const buses: BusData[] = [];

  for (const sheetName of BUS_SHEETS) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
    buses.push(parseBusSheet(sheetName, rows));
  }

  const indivWs = wb.Sheets['개별등하원'];
  if (indivWs) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(indivWs, { header: 1, defval: '' });
    buses.push(parseIndivSheet(rows));
  }

  return {
    buses,
    uploadedAt: new Date().toISOString(),
  };
}
