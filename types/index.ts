export type DayString = string; // '매일' | '월수금' | '화목' | '월' | '화' | '수' | '목' | '금' | 복합 조합
export type DayOfWeek = '월' | '화' | '수' | '목' | '금';

export type SectionType =
  | '9시 30분 등원'
  | '3시 등원'
  | '4시 30분 등원'
  | '3시 하원'
  | '4시 30분 하원'
  | '6시 하원';

export type BusName = '1호차' | '2호차' | '3호차' | '5호차' | '6호차' | '개별';

export type ChangeState = 'absent' | 'individual' | 'shuttle';

export type StudentCategory = 'MK' | 'AK' | '초등' | '';

export type CategoryFilter = '전체' | StudentCategory;

export type CategoryStore = Record<string, StudentCategory>; // key: student unique key

export interface Student {
  id: string;
  name: string;
  time: string;
  place: string;
  contact: string;
  note: string;
  dayMwf: string;
  timeTuTh: string;
  dayTuTh: string;
  bus: BusName;
  section: SectionType;
  isTemp?: boolean;
  type?: '등원_개별' | '하원_개별';
}

export interface Section {
  name: SectionType;
  students: Student[];
}

export interface BusData {
  name: BusName;
  sections: Section[];
}

export interface ShuttleBase {
  buses: BusData[];
  uploadedAt: string;
  parserVersion?: number;
}

export interface TempStudentChange {
  isTemp: true;
  id: string;
  name: string;
  place: string;
  time: string;
  note: string;
  bus: BusName;
  section: SectionType;
}

export type DailyChanges = Record<string, ChangeState | TempStudentChange>;

export const PICKUP_SECTIONS: SectionType[] = ['9시 30분 등원', '3시 등원', '4시 30분 등원'];
export const DROPOFF_SECTIONS: SectionType[] = ['3시 하원', '4시 30분 하원', '6시 하원'];
export const ALL_SECTIONS: SectionType[] = [...PICKUP_SECTIONS, ...DROPOFF_SECTIONS];
export const BUS_NAMES: BusName[] = ['1호차', '2호차', '3호차', '5호차', '6호차', '개별'];
export const DAY_OF_WEEK: DayOfWeek[] = ['월', '화', '수', '목', '금'];
export const CATEGORY_LABELS: Record<Exclude<StudentCategory, ''>, string> = { MK: 'MK', AK: 'AK', '초등': '초등' };
