import * as XLSX from 'xlsx';
import type { BusData, BusName, Section, SectionType, ShuttleBase, Student } from '@/types';
import { ALL_SECTIONS } from '@/types';

const BUS_SHEET_NAMES: BusName[] = ['1호차', '2호차', '3호차', '5호차', '6호차'];

// Excel stores times as fractions of a day (0.375 = 9:00)
function xlTime(val: unknown): string {
  if (typeof val === 'number' && val > 0 && val < 1) {
    const totalMin = Math.round(val * 24 * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  }
  return String(val ?? '').trim();
}

function cell(row: unknown[], i: number): string {
  if (i < 0 || i >= row.length) return '';
  return String((row as unknown[])[i] ?? '').trim();
}

function raw(row: unknown[], i: number): unknown {
  if (i < 0 || i >= row.length) return '';
  return (row as unknown[])[i];
}

function isBlank(row: unknown[]): boolean {
  return row.every(c => c == null || String(c).trim() === '');
}

function isValidName(s: string): boolean {
  if (!s || s.length > 25 || s.length < 1) return false;
  if (/^\d/.test(s)) return false;  // starts with digit = not a name
  if (/^[0-9:.\s]+$/.test(s)) return false;
  return true;
}

// Flexible section header matching
function detectSection(v: string): SectionType | null {
  if (!v) return null;
  if (ALL_SECTIONS.includes(v as SectionType)) return v as SectionType;
  const n = v.replace(/\s+/g, '');
  const pick = n.includes('등원');
  const drop = n.includes('하원');
  if (!pick && !drop) return null;
  if (n.includes('9') && n.includes('30') && pick) return '9시 30분 등원';
  if (n.includes('4') && n.includes('30') && pick) return '4시 30분 등원';
  if (pick && !n.includes('4') && !n.includes('9')) return '3시 등원';
  if (n.includes('4') && n.includes('30') && drop) return '4시 30분 하원';
  if (n.includes('6') && drop) return '6시 하원';
  if (drop && !n.includes('4') && !n.includes('6')) return '3시 하원';
  return null;
}

// Check first 3 columns for a section header
function findSection(row: unknown[]): { section: SectionType; col: number } | null {
  for (let i = 0; i < Math.min(row.length, 3); i++) {
    const s = detectSection(cell(row, i));
    if (s) return { section: s, col: i };
  }
  return null;
}

// Is this a column-header row? (contains student-name or day-pattern headers)
function isHeaderRow(row: unknown[], off: number): boolean {
  const NAME_HEADERS = new Set(['아동명', '이름', '학생명', '원생명', '월수금', '화목']);
  for (let i = off; i < Math.min(row.length, off + 12); i++) {
    const h = cell(row, i);
    if (NAME_HEADERS.has(h)) return true;
    if (h.includes('월수금') && h.length < 10) return true;
  }
  return false;
}

interface ColMap {
  dual: boolean;   // true = 2-student structure (월수금 col + 화목 col)
  time: number;    // index of first time column
  place: number;
  name: number;    // index of primary (월수금) name column
  day: number;     // index of day column for primary student
  note: number;
  nameTu: number;  // index of 화목 student name column (-1 if single)
  timeTu: number;  // index of 화목 time column (-1 if none)
}

function buildColMap(row: unknown[], off: number): ColMap {
  let time = off, place = off + 1, name = off + 2;
  let day = off + 3, note = off + 5;
  let nameTu = -1, timeTu = -1;
  let timeCount = 0;
  let hasMwf = false, hasTuTh = false;

  for (let i = off; i < row.length; i++) {
    const h = cell(row, i);
    if (!h) continue;
    if (h === '시간') {
      if (timeCount === 0) { time = i; timeCount++; }
      else { timeTu = i; timeCount++; }
    } else if (['장소', '정류장', '승차위치', '하차위치', '승하차위치'].includes(h)) {
      place = i;
    } else if (['아동명', '이름', '학생명', '원생명'].includes(h)) {
      name = i;
    } else if (h === '월수금' || (h.includes('월수금') && h.length < 10)) {
      name = i; hasMwf = true;
    } else if (h === '화목' || (h.includes('화목') && h.length < 10)) {
      nameTu = i; hasTuTh = true;
    } else if (h === '요일') {
      day = i;
    } else if (['특이사항', '비고', '메모'].includes(h)) {
      note = i;
    }
  }

  return {
    dual: hasMwf && hasTuTh,
    time, place, name, day, note,
    nameTu, timeTu,
  };
}

let _uid = 0;
function uid(): number { return ++_uid; }

function makeStudent(
  bus: BusName, section: SectionType,
  name: string, time: string, place: string,
  dayMwf: string, timeTuTh: string, dayTuTh: string, note: string,
): Student {
  return {
    id: `${bus}_${section}_${name}_${uid()}`,
    name, time, place, contact: '', note,
    dayMwf, timeTuTh, dayTuTh,
    bus, section,
  };
}

function parseBusSheet(busName: BusName, rows: unknown[][]): BusData {
  const sections: Section[] = [];
  let current: Section | null = null;
  let colMap: ColMap | null = null;
  let off = 0;

  // Detect column offset from the first section header found
  for (const row of rows.slice(0, 10)) {
    const r = findSection(row);
    if (r) { off = r.col; break; }
  }

  for (const row of rows) {
    if (isBlank(row)) continue;

    const sr = findSection(row);
    if (sr) {
      if (current) sections.push(current);
      current = { name: sr.section, students: [] };
      colMap = null;
      continue;
    }
    if (!current) continue;

    if (isHeaderRow(row, off)) {
      colMap = buildColMap(row, off);
      continue;
    }

    // Default colMap if no header row found (e.g. 6호차 9시30분)
    if (!colMap) {
      colMap = {
        dual: false, time: off, place: off + 1, name: off + 2,
        day: off + 3, note: off + 5, nameTu: -1, timeTu: -1,
      };
    }

    const place = cell(row, colMap.place);
    const note = cell(row, colMap.note);

    if (!colMap.dual) {
      // Single-student row
      const n = cell(row, colMap.name);
      if (!isValidName(n)) continue;
      current.students.push(makeStudent(
        busName, current.name, n,
        xlTime(raw(row, colMap.time)), place,
        cell(row, colMap.day), '', '', note,
      ));
    } else {
      // Dual-student row: 월수금 student + 화목 student
      const nMwf = cell(row, colMap.name);
      const nTu = colMap.nameTu >= 0 ? cell(row, colMap.nameTu) : '';
      const dayMwf = cell(row, colMap.day);
      const tMwf = xlTime(raw(row, colMap.time));
      const tTu = colMap.timeTu >= 0 ? xlTime(raw(row, colMap.timeTu)) : '';

      if (nMwf && nTu && nMwf === nTu) {
        // Same student, runs MWF and TuTh (possibly different times)
        if (isValidName(nMwf)) {
          current.students.push(makeStudent(
            busName, current.name, nMwf, tMwf, place,
            dayMwf, tTu, '화목', note,
          ));
        }
      } else {
        if (isValidName(nMwf)) {
          current.students.push(makeStudent(
            busName, current.name, nMwf, tMwf, place,
            dayMwf, '', '', note,
          ));
        }
        if (isValidName(nTu) && nTu !== nMwf) {
          current.students.push(makeStudent(
            busName, current.name, nTu, tTu || tMwf, place,
            '', tTu, '화목', note,
          ));
        }
      }
    }
  }

  if (current) sections.push(current);
  return { name: busName, sections };
}

function parseIndivSheet(rows: unknown[][]): BusData {
  const pickup: Section = { name: '9시 30분 등원', students: [] };
  const dropoff: Section = { name: '3시 하원', students: [] };
  let colMap: { type: number; time: number; place: number; name: number; dayMwf: number; timeTu: number; dayTu: number; note: number } | null = null;

  for (const row of rows) {
    if (isBlank(row)) continue;
    const first = cell(row, 0);

    if (first === '구분' || isHeaderRow(row, 0)) {
      colMap = { type: 0, time: 1, place: 2, name: 4, dayMwf: 5, timeTu: 6, dayTu: 7, note: 8 };
      for (let i = 0; i < row.length; i++) {
        const h = cell(row, i);
        if (h === '구분') colMap.type = i;
        else if (h === '시간') colMap.time = i;
        else if (['장소', '정류장'].includes(h)) colMap.place = i;
        else if (['아동명', '이름'].includes(h)) colMap.name = i;
        else if (h.includes('월수금') && h.includes('요일')) colMap.dayMwf = i;
        else if (h.includes('화목') && h.includes('시간')) colMap.timeTu = i;
        else if (h.includes('화목') && h.includes('요일')) colMap.dayTu = i;
        else if (['특이사항', '비고'].includes(h)) colMap.note = i;
      }
      continue;
    }
    if (!colMap) continue;

    const type = cell(row, colMap.type);
    const isPickup = type.includes('등원');
    const isDrop = type.includes('하원');
    if (!isPickup && !isDrop) continue;

    const name = cell(row, colMap.name);
    if (!isValidName(name)) continue;

    const s = makeStudent(
      '개별', isPickup ? '9시 30분 등원' : '3시 하원', name,
      xlTime(raw(row, colMap.time)), cell(row, colMap.place),
      cell(row, colMap.dayMwf), xlTime(raw(row, colMap.timeTu)), cell(row, colMap.dayTu),
      cell(row, colMap.note),
    );
    s.type = isPickup ? '등원_개별' : '하원_개별';
    if (isPickup) pickup.students.push(s);
    else dropoff.students.push(s);
  }

  const sects: Section[] = [];
  if (pickup.students.length) sects.push(pickup);
  if (dropoff.students.length) sects.push(dropoff);
  return { name: '개별', sections: sects };
}

function findSheet(wb: XLSX.WorkBook, names: string[]): XLSX.WorkSheet | null {
  for (const n of names) {
    if (wb.Sheets[n]) return wb.Sheets[n];
  }
  for (const sn of wb.SheetNames) {
    for (const n of names) {
      if (sn.includes(n) || n.includes(sn)) return wb.Sheets[sn];
    }
  }
  return null;
}

export interface ParseResult {
  data: ShuttleBase;
  log: string[];
}

export async function parseExcelFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const log: string[] = [`시트 목록: ${wb.SheetNames.join(', ')}`];
  const buses: BusData[] = [];
  _uid = 0;

  for (const busName of BUS_SHEET_NAMES) {
    const num = busName.replace('호차', '');
    const ws = findSheet(wb, [busName, `${num}호차`, `${num}호`]);
    if (!ws) { log.push(`⚠️ ${busName} 시트 없음`); continue; }
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
    const bd = parseBusSheet(busName, rows);
    const total = bd.sections.reduce((s, sec) => s + sec.students.length, 0);
    const detail = bd.sections.filter(s => s.students.length > 0).map(s => `${s.name} ${s.students.length}명`).join(', ');
    log.push(`✅ ${busName}: 총 ${total}명${detail ? ` (${detail})` : ''}`);
    buses.push(bd);
  }

  const iws = findSheet(wb, ['개별등하원', '개별']);
  if (iws) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(iws, { header: 1, defval: '' });
    const bd = parseIndivSheet(rows);
    const total = bd.sections.reduce((s, sec) => s + sec.students.length, 0);
    log.push(`✅ 개별: ${total}명`);
    if (total > 0) buses.push(bd);
  } else {
    log.push(`ℹ️ 개별등하원 시트 없음 (해당 없으면 무시)`);
  }

  return { data: { buses, uploadedAt: new Date().toISOString() }, log };
}
