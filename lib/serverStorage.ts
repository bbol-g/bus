import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), '.data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function read<T>(filename: string, fallback: T): T {
  ensureDir();
  const p = path.join(DATA_DIR, filename);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function write(filename: string, data: unknown): void {
  ensureDir();
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data), 'utf-8');
}

export function readBase(): unknown {
  return read('base.json', null);
}

export function writeBase(data: unknown): void {
  write('base.json', data);
}

export function readChanges(date: string): Record<string, unknown> {
  return read<Record<string, unknown>>(`changes_${date}.json`, {});
}

export function writeChanges(date: string, data: unknown): void {
  write(`changes_${date}.json`, data);
}

export function readCategories(): Record<string, string> {
  return read<Record<string, string>>('categories.json', {});
}

export function writeCategories(data: unknown): void {
  write('categories.json', data);
}
