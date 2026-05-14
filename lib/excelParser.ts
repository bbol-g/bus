import * as XLSX from 'xlsx';
import type { BusData, BusName, Section, SectionType, ShuttleBase, Student } from '@/types';
import { ALL_SECTIONS } from '@/types';

const BUS_SHEET_NAMES: BusName[] = ['1호차', '2호차', '3호차', '5호차', '6호차'];

interface ColMap {
  time: number;
  place: number;
  contact: number;
  name: number;
  dayMwf: number;
  timeTuTh: number;
  dayTuTh: number;
  note: number;
}

const DEFAULT_COL: ColMap = {
  time: 0, place: 1, contact: 2, name: 3,
  dayMwf: 4, timeTuTh: 5, dayTuTh: 6, note: 7,
};

function cellStr(row: unknown[], idx: number): string {
  if (idx < 0) return '';
  const v = (row as (string | number | null | undefined)[])[idx];
  return v != null ? String(v).trim() : '';
}

function isBlankRow(row: unknown[]): boolean {
  return row.every((c) => c == null || String(c).trim() === '');
}

// Flexible section header detection — handles different spacing/formats
function detectSection(value: string): SectionType | null {
  const v = value.trim();
  if (!v) return null;

  // Exact match first
  if (ALL_SECTIONS.includes(v as SectionType)) return v as SectionType;

  // Remove spaces and normalize for fuzzy match
  const n = v.replace(/\s/g, '');
  const isPickup = n.includes('등원');
  const isDropoff = n.includes('하원');
  if (!isPickup && !isDropoff) return null;

  if ((n.includes('9') || n.includes('오전9')) && n.includes('30') && isPickup) return '9시 30분 등원';
  if (n.includes('4') && n.includes('30') && isPickup) return '4시 30분 등원';
  if ((n.includes('3시') || n.startsWith('3')) && isPickup && !n.includes('4') && !n.includes('9')) return '3시 등원';
  if (n.includes('4') && n.includes('30') && isDropoff) return '4시 30분 하원';
  if ((n.includes('6시') || n.startsWith('6')) && isDropoff) return '6시 하원';
  if ((n.includes('3시') || n.startsWith('3')) && isDropoff && !n.includes('4') && !n.includes('6')) return '3시 하원';

  return null;
}

// Detect if a row is a column header row (contains '아동명' or similar)
function isHeaderRow(row: unknown[]): boolean {
  return row.some((c) => {
    const s = String(c ?? '').trim();
    return s === '아동명' || s === '이름' || s === '학생명' || s === '원생명';
  });
}

// Build column map from header row
function buildColMap(row: unknown[]): ColMap {
  const map = { ...DEFAULT_COL };
  for (let i = 0; i < row.length; i++) {
    const h = String(row[i] ?? '').trim();
    if (!h) continue;
    if (h === '시간') map.time = i;
    else if (['장소', '정류장', '승차위치', '하차위치', '승하차위치'].includes(h)) map.place = i;
    else if (['연락처', '전화', '전화번호', '보호자연락처'].includes(h)) map.contact = i;
    else if (['아동명', '이름', '학생명', '원생명'].includes(h)) map.name = i;
    else if (h.includes('월수금') && h.includes('요일')) map.dayMwf = i;
    else if (h.includes('화목') && h.includes('시간')) map.timeTuTh = i;
    else if (h.includes('화목') && h.includes('요일')) map.dayTuTh = i;
    else if (['특이사항', '비고', '메모', '참고'].includes(h)) map.note = i;
  }
  return map;
}

function makeId(bus: string, section: string, name: string, idx: number): string {
  return `${bus}_${section}_${name}_${idx}`;
}

function parseBusSheet(sheetName: BusName, rows: unknown[][]): BusData {
  const sections: Section[] = [];
  let currentSection: Section | null = null;
  let colMap: ColMap = { ...DEFAULT_COL };
  let studentIdx = 0;

  for (const row of rows) {
    if (isBlankRow(row)) continue;

    const firstCell = cellStr(row, 0);

    // Section header?
    const sectionMatch = detectSection(firstCell);
    if (sectionMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = { name: sectionMatch, students: [] };
      colMap = { ...DEFAULT_COL };
      studentIdx = 0;
      continue;
    }

    // Column header row?
    if (isHeaderRow(row)) {
      colMap = buildColMap(row);
      continue;
    }

    if (!currentSection) continue;

    const name = cellStr(row, colMap.name);
    if (!name) continue;

    const student: Student = {
      id: makeId(sheetName, currentSection.name, name, studentIdx++),
      name,
      time: cellStr(row, colMap.time),
      place: cellStr(row, colMap.place),
      contact: cellStr(row, colMap.contact),
      note: cellStr(row, colMap.note),
      dayMwf: cellStr(row, colMap.dayMwf),
      timeTuTh: cellStr(row, colMap.timeTuTh),
      dayTuTh: cellStr(row, colMap.dayTuTh),
      bus: sheetName,
      section: currentSection.name,
    };
    currentSection.students.push(student);
  }

  if (currentSection) sections.push(currentSection);
  return { name: sheetName, sections };
}

interface IndivColMap {
  type: number;
  time: number;
  place: number;
  contact: number;
  name: number;
  dayMwf: number;
  timeTuTh: number;
  dayTuTh: number;
  note: number;
}

function parseIndivSheet(rows: unknown[][]): BusData {
  const indivPickup: Section = { name: '9시 30분 등원', students: [] };
  const indivDropoff: Section = { name: '3시 하원', students: [] };

  let colMap: IndivColMap | null = null;
  let studentIdx = 0;

  for (const row of rows) {
    if (isBlankRow(row)) continue;

    const firstCell = cellStr(row, 0);

    // Header row: first cell is '구분' OR row contains '아동명'
    if (firstCell === '구분' || isHeaderRow(row)) {
      const m: IndivColMap = {
        type: 0, time: 1, place: 2, contact: 3, name: 4,
        dayMwf: 5, timeTuTh: 6, dayTuTh: 7, note: 8,
      };
      for (let i = 0; i < row.length; i++) {
        const h = String(row[i] ?? '').trim();
        if (h === '구분') m.type = i;
        else if (h === '시간') m.time = i;
        else if (['장소', '정류장', '승차위치', '하차위치'].includes(h)) m.place = i;
        else if (['연락처', '전화', '전화번호'].includes(h)) m.contact = i;
        else if (['아동명', '이름', '학생명', '원생명'].includes(h)) m.name = i;
        else if (h.includes('월수금') && h.includes('요일')) m.dayMwf = i;
        else if (h.includes('화목') && h.includes('시간')) m.timeTuTh = i;
        else if (h.includes('화목') && h.includes('요일')) m.dayTuTh = i;
        else if (['특이사항', '비고', '메모'].includes(h)) m.note = i;
      }
      colMap = m;
      continue;
    }

    if (!colMap) continue;

    const type = cellStr(row, colMap.type);
    const isPickup = type.includes('등원');
    const isDropoff = type.includes('하원');
    if (!isPickup && !isDropoff) continue;

    const name = cellStr(row, colMap.name);
    if (!name) continue;

    const section: SectionType = isPickup ? '9시 30분 등원' : '3시 하원';
    const student: Student = {
      id: makeId('개별', section, name, studentIdx++),
      name,
      time: cellStr(row, colMap.time),
      place: cellStr(row, colMap.place),
      contact: cellStr(row, colMap.contact),
      note: cellStr(row, colMap.note),
      dayMwf: cellStr(row, colMap.dayMwf),
      timeTuTh: cellStr(row, colMap.timeTuTh),
      dayTuTh: cellStr(row, colMap.dayTuTh),
      bus: '개별',
      section,
      type: isPickup ? '등원_개별' : '하원_개별',
    };

    if (isPickup) indivPickup.students.push(student);
    else indivDropoff.students.push(student);
  }

  const sections: Section[] = [];
  if (indivPickup.students.length) sections.push(indivPickup);
  if (indivDropoff.students.length) sections.push(indivDropoff);

  return { name: '개별', sections };
}

// Find a sheet by fuzzy name matching
function findSheet(wb: XLSX.WorkBook, candidates: string[]): XLSX.WorkSheet | null {
  // Exact match first
  for (const name of candidates) {
    if (wb.Sheets[name]) return wb.Sheets[name];
  }
  // Fuzzy: sheet name contains the candidate
  for (const sheetName of wb.SheetNames) {
    for (const c of candidates) {
      if (sheetName.includes(c) || c.includes(sheetName)) {
        return wb.Sheets[sheetName];
      }
    }
  }
  return null;
}

export interface ParseResult {
  data: ShuttleBase;
  log: string[];
}

export async function parseExcelFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const log: string[] = [];
  log.push(`시트 목록: ${wb.SheetNames.join(', ')}`);

  const buses: BusData[] = [];

  // Parse bus sheets
  for (const busName of BUS_SHEET_NAMES) {
    // Try exact name, then number-only variants
    const num = busName.replace('호차', '');
    const ws = findSheet(wb, [busName, `${num}호차`, `${num}호`, `Bus${num}`, `bus${num}`]);
    if (!ws) {
      log.push(`⚠️ ${busName} 시트 없음`);
      continue;
    }
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
    const busData = parseBusSheet(busName, rows);
    const total = busData.sections.reduce((s, sec) => s + sec.students.length, 0);
    log.push(`✅ ${busName}: ${total}명 (${busData.sections.map(s => `${s.name} ${s.students.length}명`).join(', ')})`);
    buses.push(busData);
  }

  // Parse 개별등하원
  const indivWs = findSheet(wb, ['개별등하원', '개별', '개별하원', '개별등원']);
  if (indivWs) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(indivWs, { header: 1, defval: '' });
    const indivData = parseIndivSheet(rows);
    const total = indivData.sections.reduce((s, sec) => s + sec.students.length, 0);
    log.push(`✅ 개별: ${total}명`);
    buses.push(indivData);
  } else {
    log.push(`⚠️ 개별등하원 시트 없음`);
  }

  const data: ShuttleBase = { buses, uploadedAt: new Date().toISOString() };
  return { data, log };
}
