import type { BusName, ChangeState, SectionType, ShuttleBase } from '@/types';
import { DROPOFF_SECTIONS, PICKUP_SECTIONS } from '@/types';
import { addDaysToStr, getDayOfWeekFromStr } from './dateUtils';
import { makeChangeKey } from './storage';
import { studentRidesOn, type DayOverrides } from './schedule';

export type Direction = 'pickup' | 'dropoff' | 'both';

export interface ParsedIntent {
  raw: string;
  name: string;
  dates: string[]; // YYYY-MM-DD, 평일만
  action: ChangeState;
  direction: Direction;
  group?: string;
  error?: string;
}

export interface PlanOp {
  date: string;
  bus: BusName;
  section: SectionType;
  studentId: string;
  studentName: string;
  state: ChangeState;
  key: string;
}

export interface LineResult {
  intent: ParsedIntent;
  ops: PlanOp[];
  matched: { name: string; bus: BusName }[];
  warning?: string;
}

const ACTION_LABEL: Record<ChangeState, string> = {
  absent: '결석',
  individual: '개별',
  shuttle: '셔틀',
};

export function actionLabel(state: ChangeState, direction: Direction): string {
  if (state === 'individual') {
    if (direction === 'pickup') return '개별등원';
    if (direction === 'dropoff') return '개별하원';
    return '개별';
  }
  return ACTION_LABEL[state];
}

function normName(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

// "9/1", "9.1", "9월1일" → [m, d]
function parseMd(s: string): [number, number] | null {
  const m = s.match(/(\d{1,2})\s*(?:[/.]|월)\s*(\d{1,2})\s*일?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

function toDateStr(year: number, m: number, d: number): string {
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 날짜(범위) 문자열을 평일 날짜 배열로 확장. 인식한 부분은 line에서 제거해 반환.
function extractDates(line: string, year: number): { dates: string[]; rest: string } {
  // 범위: 9/1~9/3, 9.1 - 9.3, 9월1일~9월3일
  const rangeRe = /(\d{1,2}\s*(?:[/.]|월)\s*\d{1,2}\s*일?)\s*[~\-–]\s*(\d{1,2}\s*(?:[/.]|월)\s*\d{1,2}\s*일?)/;
  const range = line.match(rangeRe);
  if (range) {
    const a = parseMd(range[1]);
    const b = parseMd(range[2]);
    if (a && b) {
      const start = toDateStr(year, a[0], a[1]);
      const end = toDateStr(year, b[0], b[1]);
      const dates = expandRange(start, end);
      return { dates, rest: line.replace(range[0], ' ') };
    }
  }
  // 같은 달 축약 범위: 9/1~3
  const shortRange = line.match(/(\d{1,2})\s*[/.]\s*(\d{1,2})\s*[~\-–]\s*(\d{1,2})(?!\s*[/.])/);
  if (shortRange) {
    const mo = Number(shortRange[1]);
    const d1 = Number(shortRange[2]);
    const d2 = Number(shortRange[3]);
    const dates = expandRange(toDateStr(year, mo, d1), toDateStr(year, mo, d2));
    return { dates, rest: line.replace(shortRange[0], ' ') };
  }
  // 단일 날짜(여러 개 가능): 9/1, 9/7
  const singleRe = /(\d{1,2}\s*(?:[/.]|월)\s*\d{1,2}\s*일?)/g;
  const found: string[] = [];
  let rest = line;
  let mm: RegExpExecArray | null;
  const re = new RegExp(singleRe);
  while ((mm = re.exec(line)) !== null) {
    const md = parseMd(mm[1]);
    if (md) {
      const ds = toDateStr(year, md[0], md[1]);
      if (getDayOfWeekFromStr(ds)) found.push(ds); // 평일만
      rest = rest.replace(mm[1], ' ');
    }
  }
  return { dates: found, rest };
}

function expandRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 400) {
    if (getDayOfWeekFromStr(cur)) out.push(cur); // 평일만
    cur = addDaysToStr(cur, 1);
    guard++;
  }
  return out;
}

function detectAction(line: string): { action: ChangeState; direction: Direction } | null {
  if (/개별\s*등원|등원\s*개별/.test(line)) return { action: 'individual', direction: 'pickup' };
  if (/개별\s*하원|하원\s*개별/.test(line)) return { action: 'individual', direction: 'dropoff' };
  if (/결석|불참|안\s*타|안탐|안옴/.test(line)) return { action: 'absent', direction: 'both' };
  if (/개별/.test(line)) return { action: 'individual', direction: 'both' };
  if (/셔틀|탑승|승차/.test(line)) return { action: 'shuttle', direction: 'both' };
  return null;
}

const GROUP_RE = /(오전유치부|오후유치부|오전반|오후반|유치부|초등부|초등|오전|오후)/;

// defaultDate(YYYY-MM-DD): 문장에 날짜가 없을 때 이 날짜(보통 현재 보고 있는
// 날짜)에 적용한다. 빠른 입력 바에서 "김건우 결석"처럼 날짜 없이 넣을 때 사용.
export function parseLine(raw: string, year: number, defaultDate?: string): ParsedIntent {
  const line = raw.trim();
  if (!line) return { raw, name: '', dates: [], action: 'absent', direction: 'both', error: '빈 줄' };

  const act = detectAction(line);
  if (!act) {
    return { raw, name: '', dates: [], action: 'absent', direction: 'both', error: '동작(결석/개별등원/개별하원 등)을 찾지 못함' };
  }

  const extracted = extractDates(line, year);
  const afterDates = extracted.rest;
  let dates = extracted.dates;
  if (dates.length === 0 && defaultDate && getDayOfWeekFromStr(defaultDate)) {
    dates = [defaultDate];
  }

  // 그룹 추출
  let rest = afterDates;
  let group: string | undefined;
  const g = rest.match(GROUP_RE);
  if (g) {
    group = g[1];
    rest = rest.replace(GROUP_RE, ' ');
  }

  // 동작 단어 제거
  rest = rest
    .replace(/개별\s*등원|등원\s*개별|개별\s*하원|하원\s*개별|개별|결석|불참|안\s*타|안탐|안옴|셔틀|탑승|승차/g, ' ')
    .replace(/[,\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const name = rest;
  const intent: ParsedIntent = { raw, name, dates, action: act.action, direction: act.direction, group };
  if (!name) intent.error = '이름을 찾지 못함';
  else if (dates.length === 0) intent.error = '적용할 날짜(평일)를 찾지 못함';
  return intent;
}

function sectionsForDirection(direction: Direction): SectionType[] {
  if (direction === 'pickup') return PICKUP_SECTIONS;
  if (direction === 'dropoff') return DROPOFF_SECTIONS;
  return [...PICKUP_SECTIONS, ...DROPOFF_SECTIONS];
}

// 이름으로 학생 찾기 (정확 일치 우선, 없으면 접두 일치). 한글 부분만 비교해
// "김건우 Ollie"를 "김건우"로도 찾는다.
function findStudents(data: ShuttleBase, name: string) {
  const target = normName(name);
  if (!target) return [];
  type Hit = { studentId: string; studentName: string; bus: BusName; section: SectionType };
  const exact: Hit[] = [];
  const prefix: Hit[] = [];
  for (const b of data.buses) {
    for (const sec of b.sections) {
      for (const st of sec.students) {
        const full = normName(st.name);
        const korean = normName(st.name.replace(/[a-zA-Z]/g, ''));
        const hit: Hit = { studentId: st.id, studentName: st.name, bus: b.name, section: sec.name };
        if (full === target || korean === target) exact.push(hit);
        else if (korean.startsWith(target) || full.startsWith(target)) prefix.push(hit);
      }
    }
  }
  return exact.length ? exact : prefix;
}

export function resolveLine(
  raw: string,
  data: ShuttleBase,
  dayOverrides: DayOverrides,
  year: number,
  defaultDate?: string
): LineResult {
  const intent = parseLine(raw, year, defaultDate);
  if (intent.error) return { intent, ops: [], matched: [] };

  const hits = findStudents(data, intent.name);
  if (hits.length === 0) {
    return { intent, ops: [], matched: [], warning: `'${intent.name}' 이름을 명단에서 찾지 못했습니다` };
  }

  const targetSections = new Set(sectionsForDirection(intent.direction));
  const ops: PlanOp[] = [];
  const matchedSet = new Map<string, { name: string; bus: BusName }>();

  for (const date of intent.dates) {
    const day = getDayOfWeekFromStr(date);
    if (!day) continue;
    for (const hit of hits) {
      if (!targetSections.has(hit.section)) continue;
      const busData = data.buses.find((b) => b.name === hit.bus);
      const sec = busData?.sections.find((s) => s.name === hit.section);
      const st = sec?.students.find((s) => s.id === hit.studentId);
      if (!st) continue;
      if (!studentRidesOn(st, hit.bus, hit.section, day, dayOverrides)) continue;
      ops.push({
        date,
        bus: hit.bus,
        section: hit.section,
        studentId: hit.studentId,
        studentName: hit.studentName,
        state: intent.action,
        key: makeChangeKey(hit.bus, hit.section, hit.studentId),
      });
      matchedSet.set(`${hit.studentName}|${hit.bus}`, { name: hit.studentName, bus: hit.bus });
    }
  }

  const matched = Array.from(matchedSet.values());
  let warning: string | undefined;
  if (ops.length === 0) {
    warning = '해당 날짜에 이 학생이 타는 일정이 없어 적용할 항목이 없습니다';
  }
  return { intent, ops, matched, warning };
}

export function resolveInbox(
  text: string,
  data: ShuttleBase,
  dayOverrides: DayOverrides,
  year: number
): LineResult[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => resolveLine(l, data, dayOverrides, year));
}
