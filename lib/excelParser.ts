import * as XLSX from 'xlsx';
import type { BusData, BusName, Section, SectionType, ShuttleBase, Student } from '@/types';
import { ALL_SECTIONS, DROPOFF_SECTIONS, PICKUP_SECTIONS } from '@/types';

// 호차별 시트 이름
const BUS_SHEETS: BusName[] = ['1호차', '2호차', '3호차', '5호차', '6호차'];


const WEEK_DAYS = ['월', '화', '수', '목', '금'] as const;
type WeekDay = (typeof WEEK_DAYS)[number];

function expandDayValue(value: string): Set<WeekDay> {
  const trimmed = value.trim();
  if (!trimmed) return new Set();
  if (trimmed === '매일') return new Set(WEEK_DAYS);
  return new Set(WEEK_DAYS.filter((day) => trimmed.includes(day)));
}

function serializeDays(days: Set<WeekDay>): string {
  if (days.size === 0) return '';
  const ordered = WEEK_DAYS.filter((day) => days.has(day));
  return ordered.length === WEEK_DAYS.length ? '매일' : ordered.join('');
}

function removeClaimedDays(value: string, claimedDays: Set<WeekDay>): string {
  const days = expandDayValue(value);
  claimedDays.forEach((day) => days.delete(day));
  return serializeDays(days);
}

function sectionMode(section: SectionType): 'pickup' | 'dropoff' | null {
  if (PICKUP_SECTIONS.includes(section)) return 'pickup';
  if (DROPOFF_SECTIONS.includes(section)) return 'dropoff';
  return null;
}

function normalizeStudentName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizePlace(place: string): string {
  return place.replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeOverlappingSectionDays(sections: Section[]): Section[] {
  const entriesByStudent = new Map<string, { sectionIndex: number; student: Student }[]>();

  sections.forEach((section, sectionIndex) => {
    const mode = sectionMode(section.name);
    if (!mode) return;
    for (const student of section.students) {
      const key = `${mode}||${normalizeStudentName(student.name)}||${normalizePlace(student.place)}`;
      const entries = entriesByStudent.get(key) ?? [];
      entries.push({ sectionIndex, student });
      entriesByStudent.set(key, entries);
    }
  });

  entriesByStudent.forEach((entries) => {
    if (entries.length < 2) return;
    entries.sort((a, b) => a.sectionIndex - b.sectionIndex);
    const claimedDays = new Set<WeekDay>();

    // 같은 학생이 같은 등원/하원 그룹 안에서 여러 시간대에 있으면 뒤 시간대가 우선한다.
    // 예: 3시 하원 = 월화수목, 4시 30분 하원 = 금. 3시가 매일로 파싱되어도 금은 뒤 시간대에 남긴다.
    for (let i = entries.length - 1; i >= 0; i--) {
      const { student } = entries[i];
      student.dayMwf = removeClaimedDays(student.dayMwf, claimedDays);
      student.dayTuTh = removeClaimedDays(student.dayTuTh, claimedDays);

      const currentDays = new Set<WeekDay>();
      expandDayValue(student.dayMwf).forEach((day) => currentDays.add(day));
      expandDayValue(student.dayTuTh).forEach((day) => currentDays.add(day));
      currentDays.forEach((day) => claimedDays.add(day));
    }
  });

  return sections;
}

function cellStr(row: unknown[], idx: number): string {
  const v = (row as (string | number | boolean | null | undefined)[])[idx];
  if (v == null || v === '') return '';
  return String(v).trim();
}

function isDateString(value: string): boolean {
  return /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/.test(value)
    && /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(value)
    && (value.includes('GMT') || value.includes('Coordinated Universal Time'));
}

function isTimeLikeString(value: string): boolean {
  return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(value)
    || /^[월화수목금]\s*\d{1,2}:\d{2}/.test(value);
}

function isInvalidNameValue(value: string): boolean {
  if (!value) return true;
  if (isHeaderValue(value)) return true;
  if (isDateString(value)) return true;
  if (isTimeLikeString(value)) return true;
  return false;
}

function cellName(row: unknown[], idx: number): string {
  const raw = (row as unknown[])[idx];
  if (raw == null || raw === '' || raw instanceof Date || typeof raw === 'number' || typeof raw === 'boolean') {
    return '';
  }
  const value = String(raw).trim();
  return isInvalidNameValue(value) ? '' : value;
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

interface ColumnMap {
  timeMwf: number;
  place: number;
  nameMwf: number;
  dayMwf: number;
  timeTuTh: number;
  nameTuTh: number;
  note: number;
}

interface SectionContext {
  section: Section;
  startCol: number;
  endCol: number;
  headerPending: boolean;
  hasHeader: boolean;
  hasNameColumn: boolean;
  studentIdx: number;
  lastTimeMwf: string;
  lastPlace: string;
  columns: ColumnMap;
}

function defaultColumns(startCol: number): ColumnMap {
  // 기존 템플릿은 B~H(1~7)를 사용한다. 섹션 헤더가 다른 열에서 시작하는
  // 병렬 표도 같은 상대 위치로 읽을 수 있게 startCol 기준 기본값을 둔다.
  return {
    timeMwf: startCol,
    place: startCol + 1,
    nameMwf: startCol + 2,
    dayMwf: startCol + 3,
    timeTuTh: startCol + 4,
    nameTuTh: startCol + 5,
    note: startCol + 6,
  };
}

function findSectionHeaders(row: unknown[]): { section: SectionType; col: number }[] {
  const matches: { section: SectionType; col: number }[] = [];
  for (let i = 0; i < row.length; i++) {
    const section = isSectionHeader(cellStr(row, i));
    if (section) matches.push({ section, col: i });
  }
  return matches;
}

function createSectionContext(section: SectionType, startCol: number, endCol: number): SectionContext {
  return {
    section: { name: section, students: [] },
    startCol,
    endCol,
    headerPending: true,
    hasHeader: false,
    hasNameColumn: false,
    studentIdx: 0,
    lastTimeMwf: '',
    lastPlace: '',
    columns: defaultColumns(startCol),
  };
}

function applyHeaderRow(ctx: SectionContext, row: unknown[]): void {
  const cells = (row as (string | number | boolean | null | undefined)[]).map(c => String(c ?? '').trim());
  let timeSeen = 0;
  let nameSeen = 0;
  let sawHeaderCell = false;
  for (let i = ctx.startCol; i < Math.min(ctx.endCol, cells.length); i++) {
    const v = cells[i];
    if (!v) continue;
    if (v === '시간(월수금)') {
      ctx.columns.timeMwf = i;
      sawHeaderCell = true;
    } else if (v === '시간(화목)') {
      ctx.columns.timeTuTh = i;
      sawHeaderCell = true;
    } else if (v === '시간') {
      if (timeSeen === 0) ctx.columns.timeMwf = i; else ctx.columns.timeTuTh = i;
      timeSeen++;
      sawHeaderCell = true;
    } else if (v === '장소') {
      ctx.columns.place = i;
      sawHeaderCell = true;
    } else if (v === '이름(월수금)') {
      ctx.columns.nameMwf = i; nameSeen++;
      sawHeaderCell = true;
    } else if (v === '이름(화목)') {
      ctx.columns.nameTuTh = i; nameSeen++;
      sawHeaderCell = true;
    } else if (v === '이름' || v.startsWith('이름(')) {
      if (nameSeen === 0) ctx.columns.nameMwf = i; else ctx.columns.nameTuTh = i;
      nameSeen++;
      sawHeaderCell = true;
    } else if (v === '요일' || v.startsWith('요일(')) {
      ctx.columns.dayMwf = i;
      sawHeaderCell = true;
    } else if (v === '비고' || v === '특이사항') {
      ctx.columns.note = i;
      sawHeaderCell = true;
    }
  }
  ctx.hasHeader = sawHeaderCell;
  ctx.hasNameColumn = nameSeen > 0;
  ctx.headerPending = false;
}

function appendStudentsFromRow(sheetName: BusName, ctx: SectionContext, row: unknown[]): void {
  if (!ctx.hasHeader || !ctx.hasNameColumn) return;

  const { columns } = ctx;
  const isInContext = (idx: number) => idx >= ctx.startCol && idx < ctx.endCol;
  const rawInContext = (idx: number) => isInContext(idx) ? (row as unknown[])[idx] : '';
  const cellInContext = (idx: number) => isInContext(idx) ? cellStr(row, idx) : '';
  const nameInContext = (idx: number) => isInContext(idx) ? cellName(row, idx) : '';

  const rawTimeMwf = rawInContext(columns.timeMwf);
  const rawPlace   = cellInContext(columns.place);
  const nameMwf    = nameInContext(columns.nameMwf);
  const dayMwf     = cellInContext(columns.dayMwf);
  const rawTimeTuTh = rawInContext(columns.timeTuTh);
  const nameTuTh   = nameInContext(columns.nameTuTh);
  const note       = cellInContext(columns.note);

  // 헤더 값 혼입 방지: 시간/장소 승계 전에 검사하여 lastTimeMwf/lastPlace 오염 방지
  const headerCellCount = [nameMwf, nameTuTh, cellInContext(columns.timeMwf), rawPlace].filter(v => isHeaderValue(String(v))).length;
  if (headerCellCount >= 2) return;

  // 시간/장소 승계 (빈 셀이면 이전 값 사용)
  if (rawTimeMwf != null && rawTimeMwf !== '') ctx.lastTimeMwf = formatExcelTime(rawTimeMwf);
  if (rawPlace) ctx.lastPlace = rawPlace;

  const timeMwfStr = ctx.lastTimeMwf;
  const placeStr = ctx.lastPlace;

  const hasMwf = !!nameMwf;
  const hasTuTh = !!nameTuTh;

  // 같은 학생이 양쪽 컬럼에 모두 있는 경우: 하나로 합침 (중복 방지)
  if (hasMwf && hasTuTh && nameMwf === nameTuTh) {
    const timeTuThStr = formatExcelTime(rawTimeTuTh);
    const tuThDay = inferTuThDay(dayMwf, cellInContext(columns.timeTuTh));
    ctx.section.students.push({
      id: generateId(sheetName, ctx.section.name, nameMwf, ctx.studentIdx++),
      name: nameMwf,
      time: timeMwfStr,
      place: placeStr,
      contact: '',
      note,
      dayMwf: dayMwf || '매일',
      timeTuTh: timeTuThStr,
      dayTuTh: tuThDay,
      bus: sheetName,
      section: ctx.section.name,
    });
    return;
  }

  // ① 월수금 학생
  if (hasMwf) {
    ctx.section.students.push({
      id: generateId(sheetName, ctx.section.name, nameMwf, ctx.studentIdx++),
      name: nameMwf,
      time: timeMwfStr,
      place: placeStr,
      contact: '',
      note,
      dayMwf: dayMwf || '매일',
      timeTuTh: '',
      dayTuTh: '',
      bus: sheetName,
      section: ctx.section.name,
    });
  }

  // ② 화목 학생
  if (hasTuTh) {
    const timeTuThStr = formatExcelTime(rawTimeTuTh);
    const tuThDay = inferTuThDay(dayMwf, cellInContext(columns.timeTuTh));

    ctx.section.students.push({
      id: generateId(sheetName, ctx.section.name, nameTuTh, ctx.studentIdx++),
      name: nameTuTh,
      time: timeTuThStr,
      place: placeStr,
      contact: '',
      note,
      dayMwf: '',
      timeTuTh: timeTuThStr,
      dayTuTh: tuThDay,
      bus: sheetName,
      section: ctx.section.name,
    });
  }
}

function mergeSectionsByName(sections: Section[]): Section[] {
  const byName = new Map<SectionType, Section>();
  for (const section of sections) {
    const existing = byName.get(section.name);
    if (existing) existing.students.push(...section.students);
    else byName.set(section.name, { name: section.name, students: [...section.students] });
  }
  return ALL_SECTIONS.flatMap((sectionName) => {
    const section = byName.get(sectionName);
    return section ? [section] : [];
  });
}

function parseBusSheet(sheetName: BusName, rows: unknown[][]): BusData {
  const sections: Section[] = [];
  let contexts: SectionContext[] = [];

  function flushContexts() {
    for (const ctx of contexts) sections.push(ctx.section);
    contexts = [];
  }

  for (const row of rows) {
    if ((row as unknown[]).every((c) => c == null || c === '')) continue;

    // 섹션 헤더를 특정 열(B/A)에 한정하지 않고 행 전체에서 찾는다.
    // 새 양식처럼 "4시 30분 등원"과 "4시 30분 하원" 표가 같은 행에
    // 병렬 배치되어도 각 섹션을 독립 컨텍스트로 파싱한다.
    const headers = findSectionHeaders(row as unknown[]);
    if (headers.length > 0) {
      flushContexts();
      contexts = headers.map((header, index) => {
        const nextHeader = headers[index + 1];
        return createSectionContext(header.section, header.col, nextHeader?.col ?? Number.POSITIVE_INFINITY);
      });
      continue;
    }

    if (contexts.length === 0) continue;

    if (contexts.some((ctx) => ctx.headerPending)) {
      contexts.forEach((ctx) => applyHeaderRow(ctx, row));
      continue;
    }

    contexts.forEach((ctx) => appendStudentsFromRow(sheetName, ctx, row));
  }

  flushContexts();
  return { name: sheetName, sections: normalizeOverlappingSectionDays(mergeSectionsByName(sections)) };
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

    const name = cellName(row, 4);
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
