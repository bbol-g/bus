import fs from 'fs';
import path from 'path';

// Vercel KV 환경 변수가 있으면 KV 사용, 없으면 로컬 파일 사용
const USE_KV = !!process.env.KV_REST_API_URL;

// ── 로컬 파일 스토리지 ──────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), '.data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function fsRead<T>(filename: string, fallback: T): T {
  ensureDir();
  const p = path.join(DATA_DIR, filename);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function fsWrite(filename: string, data: unknown): void {
  ensureDir();
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data), 'utf-8');
}

// ── Vercel KV 스토리지 ──────────────────────────────────────────

async function kvGet<T>(key: string): Promise<T | null> {
  const { kv } = await import('@vercel/kv');
  return kv.get<T>(key);
}

async function kvSet(key: string, value: unknown): Promise<void> {
  const { kv } = await import('@vercel/kv');
  await kv.set(key, value);
}

// ── 공개 API (모두 async) ────────────────────────────────────────

export async function readBase(): Promise<unknown> {
  if (USE_KV) return kvGet('base');
  return fsRead('base.json', null);
}

export async function writeBase(data: unknown): Promise<void> {
  if (USE_KV) return kvSet('base', data);
  fsWrite('base.json', data);
}

export async function readChanges(date: string): Promise<Record<string, unknown>> {
  if (USE_KV) return (await kvGet<Record<string, unknown>>(`changes_${date}`)) ?? {};
  return fsRead<Record<string, unknown>>(`changes_${date}.json`, {});
}

export async function writeChanges(date: string, data: unknown): Promise<void> {
  if (USE_KV) return kvSet(`changes_${date}`, data);
  fsWrite(`changes_${date}.json`, data);
}

export async function readCategories(): Promise<Record<string, string>> {
  if (USE_KV) return (await kvGet<Record<string, string>>('categories')) ?? {};
  return fsRead<Record<string, string>>('categories.json', {});
}

export async function writeCategories(data: unknown): Promise<void> {
  if (USE_KV) return kvSet('categories', data);
  fsWrite('categories.json', data);
}
