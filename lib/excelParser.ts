import * as XLSX from 'xlsx';
import type { BusData, BusName, Section, SectionType, ShuttleBase, Student } from '@/types';
import { ALL_SECTIONS } from '@/types';

const BUS_SHEETS: BusName[] = ['1호차', '2호차', '3호차', '5호차', '6호차'];

// Column indices for bus sheets (0-based)
// 시간(0) 장소(1) 연락처(2) 아동명(3) 요일(월수금)(4) 시간(화목)(5) 요일(화목)(6) 특이사항(7)
const COL = {
  TIME: 0,
  PLACE: 1,
  CONTACT: 2,
  NAME: 3,
  DAY_MWF: 4,
  TIME_TUTH: 5,
  DAY_TUTH: 6,
  NOTE: 7,
};

// Column indices for 개별등하원 sheet (0-based)
// 구분(0) 시간(1) 장소(2) 연락처(3) 아동명(4) 요일(월수금)(5) 시간(화목)(6) 요일(화목)(7) 특이사항(8)
const INDIV_COL = {
  TYPE: 0,
  TIME: 1,
  PLACE: 2,
  CONTACT: 3,
  NAME: 4,
  DAY_MWF: 5,
  TIME_TUTH: 6,
  DAY_TUTH: 7,
  NOTE: 8,
};

function cellStr(row: unknown[], idx: number): string {
  const v = (row as (string | number | null | undefined)[])[idx];
  return v != null ? String(v).trim() : '';
}

function isSectionHeader(value: string): SectionType | null {
  return ALL_SECTIONS.includes(value as SectionType) ? (value as SectionType) : null;
}

function generateId(bus: string, section: string, name: string, idx: number): string {
  return `${bus}_${section}_${name}_${idx}`;
}

function parseBusSheet(sheetName: BusName, rows: unknown[][]): BusData {
  const sections: Section[] = [];
  let currentSection: Section | null = null;
  let headerSkip = false;
  let studentIdx = 0;

  for (const row of rows) {
    const firstCell = cellStr(row, 0);
    if (!firstCell && row.every((c) => !c)) continue; // fully blank

    const sectionMatch = isSectionHeader(firstCell);
    if (sectionMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = { name: sectionMatch, students: [] };
      headerSkip = true;
      studentIdx = 0;
      continue;
    }

    // Skip the column-header row right after section header
    if (headerSkip) {
      headerSkip = false;
      continue;
    }

    if (!currentSection) continue;

    const name = cellStr(row, COL.NAME);
    if (!name) continue; // blank row = section boundary (already handled above)

    const student: Student = {
      id: generateId(sheetName, currentSection.name, name, studentIdx++),
      name,
      time: cellStr(row, COL.TIME),
      place: cellStr(row, COL.PLACE),
      contact: cellStr(row, COL.CONTACT),
      note: cellStr(row, COL.NOTE),
      dayMwf: cellStr(row, COL.DAY_MWF),
      timeTuTh: cellStr(row, COL.TIME_TUTH),
      dayTuTh: cellStr(row, COL.DAY_TUTH),
      bus: sheetName,
      section: currentSection.name,
    };
    currentSection.students.push(student);
  }

  if (currentSection) sections.push(currentSection);
  return { name: sheetName, sections };
}

function parseIndivSheet(rows: unknown[][]): BusData {
  const indivPickup: Section = { name: '9시 30분 등원', students: [] };
  const indivDropoff: Section = { name: '3시 하원', students: [] };

  let headerPassed = false;
  let studentIdx = 0;

  for (const row of rows) {
    const firstCell = cellStr(row, 0);
    if (!firstCell && row.every((c) => !c)) continue;

    // Skip header row
    if (!headerPassed) {
      if (firstCell === '구분' || firstCell === '등원_개별' || firstCell === '하원_개별') {
        if (firstCell === '구분') { headerPassed = true; continue; }
        headerPassed = true;
      } else {
        headerPassed = true;
        continue;
      }
    }

    const type = firstCell as '등원_개별' | '하원_개별';
    if (type !== '등원_개별' && type !== '하원_개별') continue;

    const name = cellStr(row, INDIV_COL.NAME);
    if (!name) continue;

    const section: SectionType = type === '등원_개별' ? '9시 30분 등원' : '3시 하원';

    const student: Student = {
      id: generateId('개별', section, name, studentIdx++),
      name,
      time: cellStr(row, INDIV_COL.TIME),
      place: cellStr(row, INDIV_COL.PLACE),
      contact: cellStr(row, INDIV_COL.CONTACT),
      note: cellStr(row, INDIV_COL.NOTE),
      dayMwf: cellStr(row, INDIV_COL.DAY_MWF),
      timeTuTh: cellStr(row, INDIV_COL.TIME_TUTH),
      dayTuTh: cellStr(row, INDIV_COL.DAY_TUTH),
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
  const wb = XLSX.read(buffer, { type: 'array' });

  const buses: BusData[] = [];

  for (const sheetName of BUS_SHEETS) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
    buses.push(parseBusSheet(sheetName, rows));
  }

  // Parse 개별등하원
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
