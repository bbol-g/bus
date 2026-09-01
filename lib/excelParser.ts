import * as XLSX from 'xlsx';
import type { BusData, BusName, Section, SectionType, ShuttleBase, Student } from '@/types';
import { ALL_SECTIONS, DROPOFF_SECTIONS, PICKUP_SECTIONS } from '@/types';

// 파싱 로직이 바뀔 때마다 올려서, 저장된 데이터를 원본 엑셀로부터
// 자동으로 다시 파싱하도록 트리거한다.
export const PARSER_VERSION = 6;

// 호차별 시트 이름
const BUS_SHEETS: BusName[] = ['1호차', '2호차', '3호차', '5호차', '6호차'];


const WEEK_DAYS = ['월', '화', '수', '목', '금'] as const;

function expandDayValue(value: string): Set<(typeof WEEK_DAYS)[number]> {
  const trimmed = value.trim();
  if (!trimmed) return new Set();
  if (trimmed === '매일') return new Set(WEEK_DAYS);
  return new Set(WEEK_DAYS.filter((day) => trimmed.includes(day)));
}

function serializeDays(days: Set<(typeof WEEK_DAYS)[number]>): string {
  if (days.size === 0) return '';
  const ordered = WEEK_DAYS.filter((day) => days.has(day));
  return ordered.length === WEEK_DAYS.length ? '매일' : ordered.join('');
}

function removeClaimedDays(value: string, claimedDays: Set<(typeof WEEK_DAYS)[number]>): string {
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

// 학생을 영구 삭제할 때 사용하는 식별자. 재파싱 시에도 같은 학생을
// 다시 걸러낼 수 있도록 호차/섹션/이름 기준으로 식별한다.
export function studentIdentityKey(bus: string, section: string, name: string): string {
  return `${bus}||${section}||${normalizeStudentName(name)}`;
}

// 영구 삭제된 학생을 파싱 결과에서 제거한다.
export function applyDeletedStudents(data: ShuttleBase, deletedKeys: string[]): void {
  if (deletedKeys.length === 0) return;
  const deleted = new Set(deletedKeys);
  for (const bus of data.buses) {
    for (const section of bus.sections) {
      section.students = section.students.filter(
        (s) => !deleted.has(studentIdentityKey(bus.name, section.name, s.name))
      );
    }
  }
}

function normalizeOverlappingSectionDays(buses: BusData[]): void {
  const entriesByStudent = new Map<string, { priority: number; student: Student }[]>();

  for (const bus of buses) {
    for (const section of bus.sections) {
      const mode = sectionMode(section.name);
      if (!mode) continue;
      const priority = ALL_SECTIONS.indexOf(section.name);
      for (const student of section.students) {
        const key = `${mode}||${normalizeStudentName(student.name)}||${student.place}`;
        const entries = entriesByStudent.get(key) ?? [];
        entries.push({ priority, student });
        entriesByStudent.set(key, entries);
      }
    }
  }

  entriesByStudent.forEach((entries) => {
    if (entries.length < 2) return;
    entries.sort((a, b) => a.priority - b.priority);
    const claimedDays = new Set<(typeof WEEK_DAYS)[number]>();

    // 같은 학생이 같은 등원/하원 그룹 안에서 여러 시간대(혹은 다른 호차)에 있으면
    // 뒤 시간대가 우선한다. 예: 3시 하원 = 월화수목, 4시 30분 하원 = 금이면
    // 3시가 매일로 파싱되어도 금은 뒤 시간대에 남긴다.
    for (let i = entries.length - 1; i >= 0; i--) {
      const { student } = entries[i];
      student.dayMwf = removeClaimedDays(student.dayMwf, claimedDays);
      student.dayTuTh = removeClaimedDays(student.dayTuTh, claimedDays);

      const currentDays = new Set<(typeof WEEK_DAYS)[number]>();
      expandDayValue(student.dayMwf).forEach((day) => currentDays.add(day));
      expandDayValue(student.dayTuTh).forEach((day) => currentDays.add(day));
      currentDays.forEach((day) => claimedDays.add(day));
    }
  });
}

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

const MWF_SET: readonly string[] = ['월', '수', '금'];
const TUTH_SET: readonly string[] = ['화', '목'];

// 병합 학생(같은 이름이 월수금·화목 열에 모두 있음)의 탑승 요일을 결정한다.
// 요일 열(col4)이 이 학생의 "전체 탑승 요일"이므로, 그것을 벗어나 추측하지 않는다.
// 월수금에 해당하는 요일은 mwf(월수금 시간), 화목에 해당하는 요일은 화목 시간을 쓴다.
// 요일 열이 비어 있을 때만 '매일'로 가정하고 guessed=true로 표시한다.
function splitRideDays(dayCol: string): { mwf: string; tuth: string; guessed: boolean } {
  const trimmed = dayCol.trim();
  const guessed = trimmed === '';
  const all = guessed ? new Set(WEEK_DAYS) : expandDayValue(trimmed);
  const mwf = serializeDays(new Set(WEEK_DAYS.filter((d) => MWF_SET.includes(d) && all.has(d))));
  const tuth = serializeDays(new Set(WEEK_DAYS.filter((d) => TUTH_SET.includes(d) && all.has(d))));
  return { mwf, tuth, guessed };
}

// 화목 단독 학생의 요일을 결정한다.
// - 요일 열에 화/목이 있으면 그것을 사용(가장 신뢰도 높음)
// - 없으면 시간 열의 요일 접두사(예: '화 3:07')로 판단
// - 둘 다 없을 때만 '화목'으로 추측하고 guessed=true로 표시한다.
function deriveTuThDays(dayCol: string, timeCol: string): { days: string; guessed: boolean } {
  const fromCol = WEEK_DAYS.filter((d) => TUTH_SET.includes(d) && expandDayValue(dayCol).has(d));
  if (fromCol.length) return { days: serializeDays(new Set(fromCol)), guessed: false };
  const t = timeCol.trim();
  if (t.startsWith('화목')) return { days: '화목', guessed: false };
  if (t.startsWith('화')) return { days: '화', guessed: false };
  if (t.startsWith('목')) return { days: '목', guessed: false };
  return { days: '화목', guessed: true };
}

// 유니코드 공백(전각·비분리 등) 및 한글 숫자 변형을 정규화
function normalizeSection(value: string): string {
  return value
    .replace(/[   -   　﻿]/g, ' ') // 유니코드 공백 → 일반 공백
    .replace(/\s+/g, ' ')
    .trim();
}

function isSectionHeader(value: string): SectionType | null {
  // "3호차 3시 하원"처럼 호차 번호가 섹션명 앞에 붙어 있는 경우 제거하고 비교
  const normalized = normalizeSection(value).replace(/^\d*\s*호차\s*/, '');
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

// '이름(화목)' 칸에 이름 대신 "화목3:08", "화목3:12 금3:18"처럼
// 요일+시간 정보만 적혀 있는 경우 (같은 학생의 화목 시간을 별도 표기한 것일 뿐
// 별도 학생이 아님) 판별
function isDayTimeOnly(v: string): boolean {
  return /^([월화수목금]+\s*\d{1,2}:\d{2}\s*)+$/.test(v);
}

// 셀 값이 자바스크립트 Date 객체의 toString 결과(예: "Tue Jun 16 2026 ... GMT")인지 판별.
// 엑셀에서 날짜/시간 셀이 문자열로 흘러들어와 이름 칸으로 잘못 읽히는 경우를 막는다.
function isDateString(value: string): boolean {
  return /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/.test(value)
    && /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(value)
    && (value.includes('GMT') || value.includes('Coordinated Universal Time'));
}

// "3:07", "15:00:00", "화 3:07"처럼 시간(또는 요일+시간)만 적힌 값인지 판별.
function isTimeLikeString(value: string): boolean {
  return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(value)
    || /^[월화수목금]\s*\d{1,2}:\d{2}/.test(value);
}

// 이름 칸에 들어올 수 없는 값(헤더·날짜·시간 문자열)인지 판별.
function isInvalidNameValue(value: string): boolean {
  return isHeaderValue(value) || isDateString(value) || isTimeLikeString(value);
}

interface ColumnMap {
  timeMwf: number;
  place: number;
  contact: number;
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
    contact: -1, // 연락처 열은 헤더에 '연락처'가 있을 때만 활성화 (구 양식엔 없음)
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
  let sawTuThName = false;
  for (let i = ctx.startCol; i < Math.min(ctx.endCol, cells.length); i++) {
    const v = cells[i];
    if (!v) continue;
    if (v === '시간(월수금)') {
      ctx.columns.timeMwf = i;
    } else if (v === '시간(화목)') {
      ctx.columns.timeTuTh = i;
    } else if (v === '시간') {
      if (timeSeen === 0) ctx.columns.timeMwf = i; else ctx.columns.timeTuTh = i;
      timeSeen++;
    } else if (v === '장소') {
      ctx.columns.place = i;
    } else if (v === '연락처') {
      ctx.columns.contact = i;
    } else if (v === '이름(월수금)' || v === '아동명' || v === '월수금') {
      // 신양식은 이름 열 머리글로 '아동명'(등원)·'월수금'(등하원)을 쓴다.
      ctx.columns.nameMwf = i; nameSeen++;
    } else if (v === '이름(화목)' || v === '화목') {
      ctx.columns.nameTuTh = i; nameSeen++; sawTuThName = true;
    } else if (v === '이름' || v.startsWith('이름(')) {
      if (nameSeen === 0) ctx.columns.nameMwf = i; else { ctx.columns.nameTuTh = i; sawTuThName = true; }
      nameSeen++;
    } else if (v === '요일' || v.startsWith('요일(')) {
      ctx.columns.dayMwf = i;
    } else if (v === '비고' || v === '특이사항') {
      ctx.columns.note = i;
    }
  }
  // 이 섹션 헤더에 '이름(화목)' 열이 없으면(예: 시간·장소·이름·요일·시간·특이사항
  // 6열 구성), 기본값(startCol+5)이 특이사항 열을 가리켜 메모가 학생으로
  // 잘못 파싱되는 것을 막기 위해 화목 이름 열을 비활성화한다.
  if (!sawTuThName) ctx.columns.nameTuTh = -1;
  ctx.headerPending = false;
}

function appendStudentsFromRow(sheetName: BusName, ctx: SectionContext, row: unknown[]): void {
  const { columns } = ctx;
  const isInContext = (idx: number) => idx >= ctx.startCol && idx < ctx.endCol;
  const rawInContext = (idx: number) => isInContext(idx) ? (row as unknown[])[idx] : '';
  const cellInContext = (idx: number) => isInContext(idx) ? cellStr(row, idx) : '';

  const rawTimeMwf = rawInContext(columns.timeMwf);
  const rawPlace   = cellInContext(columns.place);
  const nameMwf    = cellInContext(columns.nameMwf);
  const dayMwf     = cellInContext(columns.dayMwf);
  const rawTimeTuTh = rawInContext(columns.timeTuTh);
  const nameTuTh   = cellInContext(columns.nameTuTh);
  const note       = cellInContext(columns.note);
  const contact    = cellInContext(columns.contact).replace(/\s*\n\s*/g, ' ');

  // 헤더 값 혼입 방지: 시간/장소 승계 전에 검사하여 lastTimeMwf/lastPlace 오염 방지
  if (isHeaderValue(nameMwf)) return;
  const headerCellCount = [nameMwf, nameTuTh, cellInContext(columns.timeMwf), rawPlace].filter(v => isHeaderValue(String(v))).length;
  if (headerCellCount >= 2) return;

  // 시간/장소 승계 (빈 셀이면 이전 값 사용)
  if (rawTimeMwf != null && rawTimeMwf !== '') ctx.lastTimeMwf = formatExcelTime(rawTimeMwf);
  if (rawPlace) ctx.lastPlace = rawPlace;

  const timeMwfStr = ctx.lastTimeMwf;
  const placeStr = ctx.lastPlace;

  // 요일 칸이 "5 김하준 Ryan"처럼 다른 학생 이름/번호가 잘못 들어간 경우
  // (예: 호차 합승표) 해당 칸은 요일 정보로 쓸 수 없으므로 행을 건너뛴다.
  const isValidDayValue = dayMwf === '' || dayMwf === '매일' || /^[월화수목금]+$/.test(dayMwf);

  const hasMwf = !!nameMwf && !isInvalidNameValue(nameMwf) && isValidDayValue;
  const hasTuTh = nameTuTh && !isInvalidNameValue(nameTuTh) && !isDayTimeOnly(nameTuTh);

  // 같은 학생이 양쪽 컬럼에 모두 있는 경우: 하나로 합침 (중복 방지)
  if (hasMwf && hasTuTh && nameMwf === nameTuTh) {
    const timeTuThStr = formatExcelTime(rawTimeTuTh);
    const { mwf, tuth, guessed } = splitRideDays(dayMwf);
    ctx.section.students.push({
      id: generateId(sheetName, ctx.section.name, nameMwf, ctx.studentIdx++),
      name: nameMwf,
      time: timeMwfStr,
      place: placeStr,
      contact,
      note,
      dayMwf: mwf,
      timeTuTh: timeTuThStr,
      dayTuTh: tuth,
      bus: sheetName,
      section: ctx.section.name,
      ...(guessed ? { needsReview: true } : {}),
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
      contact,
      note,
      dayMwf: dayMwf || '매일',
      timeTuTh: '',
      dayTuTh: '',
      bus: sheetName,
      section: ctx.section.name,
      // 요일 열이 비어 '매일'로 가정한 경우 검토 표시
      ...(dayMwf ? {} : { needsReview: true }),
    });
  }

  // ② 화목 학생
  if (hasTuTh) {
    const timeTuThStr = formatExcelTime(rawTimeTuTh);
    const { days, guessed } = deriveTuThDays(dayMwf, cellInContext(columns.timeTuTh));

    // 화목 이름 칸에 이름이 아니라 메모("단독승하차" 등)가 잘못 들어간 경우 방지:
    // 같은 행에 월수금 학생이 이미 있고, 화목 요일 근거(요일 열의 화/목,
    // 화목 시간)가 전혀 없어 요일을 추측만 한 상황이면 별도 화목 학생을
    // 만들지 않는다. (실제 화목 학생은 요일 열이나 시간에 화/목 근거가 있음)
    if (guessed && hasMwf) return;

    ctx.section.students.push({
      id: generateId(sheetName, ctx.section.name, nameTuTh, ctx.studentIdx++),
      name: nameTuTh,
      time: timeTuThStr,
      place: placeStr,
      contact,
      note,
      dayMwf: '',
      timeTuTh: timeTuThStr,
      dayTuTh: days,
      bus: sheetName,
      section: ctx.section.name,
      ...(guessed ? { needsReview: true } : {}),
    });
  }
}

// 재업로드 시에도 같은 학생이 같은 id를 갖도록, 파싱이 모두 끝난 뒤
// 최종 목록 기준으로 id를 재부여한다. id는 순서(idx)가 아니라
// 호차·섹션·정규화된 이름·동명이인 순번으로 만들어, 엑셀에서 행 순서가
// 바뀌거나 다른 학생이 추가/삭제되어도 안정적으로 유지된다.
// (요일 override 등 사용자가 앱에서 수정한 값이 재업로드 후에도 보존됨)
function assignStableIds(buses: BusData[]): void {
  for (const bus of buses) {
    for (const section of bus.sections) {
      const seq = new Map<string, number>();
      for (const student of section.students) {
        const nameKey = normalizeStudentName(student.name);
        const occ = seq.get(nameKey) ?? 0;
        seq.set(nameKey, occ + 1);
        student.id = `${bus.name}||${section.name}||${nameKey}||${occ}`;
      }
    }
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
      // 새로 발견된 헤더와 같은 시작 열을 가진 컨텍스트만 종료하고,
      // 다른 병렬 컨텍스트(예: 같은 행에 헤더가 다시 등장하지 않는
      // "4시 30분 하원")는 그대로 데이터를 이어서 받는다.
      const headerCols = new Set(headers.map((h) => h.col));
      const survivors = contexts.filter((ctx) => !headerCols.has(ctx.startCol));
      const toFlush = contexts.filter((ctx) => headerCols.has(ctx.startCol));
      for (const ctx of toFlush) sections.push(ctx.section);

      type StartEntry =
        | { col: number; ctx: SectionContext }
        | { col: number; header: { section: SectionType; col: number } };
      const starts: StartEntry[] = [
        ...survivors.map((ctx) => ({ col: ctx.startCol, ctx })),
        ...headers.map((header) => ({ col: header.col, header })),
      ].sort((a, b) => a.col - b.col);

      contexts = starts.map((entry, index) => {
        const nextCol = starts[index + 1]?.col ?? Number.POSITIVE_INFINITY;
        if ('header' in entry) {
          return createSectionContext(entry.header.section, entry.col, nextCol);
        }
        entry.ctx.endCol = nextCol;
        return entry.ctx;
      });
      continue;
    }

    if (contexts.length === 0) continue;

    if (contexts.some((ctx) => ctx.headerPending)) {
      contexts.forEach((ctx) => {
        if (ctx.headerPending) applyHeaderRow(ctx, row);
        else appendStudentsFromRow(sheetName, ctx, row);
      });
      continue;
    }

    contexts.forEach((ctx) => appendStudentsFromRow(sheetName, ctx, row));
  }

  flushContexts();
  return { name: sheetName, sections: mergeSectionsByName(sections) };
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
      contact: cellStr(row, 3).replace(/\s*\n\s*/g, ' '),
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

  // 같은 학생이 다른 호차/시간대의 등원 또는 하원 섹션에 중복으로 들어간
  // 경우, 호차 전체 기준으로 요일 겹침을 정리한다.
  normalizeOverlappingSectionDays(buses);

  const indivWs = wb.Sheets['개별등하원'];
  if (indivWs) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(indivWs, { header: 1, defval: '' });
    buses.push(parseIndivSheet(rows));
  }

  // 파싱 완료 후 안정적 id 재부여 (재업로드 시 사용자 수정사항 보존)
  assignStableIds(buses);

  return {
    buses,
    uploadedAt: new Date().toISOString(),
    parserVersion: PARSER_VERSION,
  };
}
