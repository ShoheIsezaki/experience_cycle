import type { DailyEntry, Weather } from '../types';

export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: 'experience_cycle';
  version: number;
  exportedAt: string;
  entries: DailyEntry[];
}

/** 全エントリをバックアップ用JSON文字列にシリアライズ */
export function serializeBackup(entries: DailyEntry[], now: Date = new Date()): string {
  const payload: BackupFile = {
    app: 'experience_cycle',
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    entries: [...entries].sort((a, b) => a.date.localeCompare(b.date)),
  };
  return JSON.stringify(payload, null, 2);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidWeather(w: unknown): w is Weather {
  return w === 1 || w === 2 || w === 3 || w === 4 || w === 5;
}

function toStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** 1件分を検証・正規化。無効なら null */
export function normalizeEntry(raw: unknown): DailyEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.date !== 'string' || !DATE_RE.test(r.date)) return null;
  const entry: DailyEntry = {
    date: r.date,
    weather: isValidWeather(r.weather) ? r.weather : undefined,
    experience: toStr(r.experience),
    reflection: toStr(r.reflection),
    lesson: toStr(r.lesson),
    nextAction: toStr(r.nextAction),
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString(),
  };
  return entry;
}

/**
 * バックアップJSON文字列をパースしてエントリ配列を得る。
 * 形式不正なら例外を投げる。無効な個別エントリはスキップ。
 */
export function parseBackup(text: string): DailyEntry[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSONの解析に失敗しました。ファイルが壊れている可能性があります。');
  }
  let rawEntries: unknown;
  if (Array.isArray(data)) {
    // エントリ配列のみのファイルも許容
    rawEntries = data;
  } else if (typeof data === 'object' && data !== null && Array.isArray((data as Record<string, unknown>).entries)) {
    rawEntries = (data as Record<string, unknown>).entries;
  } else {
    throw new Error('対応していない形式のファイルです。');
  }
  const result: DailyEntry[] = [];
  for (const raw of rawEntries as unknown[]) {
    const norm = normalizeEntry(raw);
    if (norm) result.push(norm);
  }
  return result;
}

export type MergeStrategy = 'merge' | 'overwrite';

/**
 * 既存エントリとインポートエントリを統合する（純粋関数）。
 * - overwrite: 既存を全て破棄しインポート内容のみにする
 * - merge: 日付ごとに updatedAt が新しい方を採用（インポート優先の同値タイブレーク）
 * 返り値は日付昇順の統合後配列。
 */
export function mergeEntries(
  existing: DailyEntry[],
  incoming: DailyEntry[],
  strategy: MergeStrategy,
): DailyEntry[] {
  if (strategy === 'overwrite') {
    return [...incoming].sort((a, b) => a.date.localeCompare(b.date));
  }
  const map = new Map<string, DailyEntry>();
  for (const e of existing) map.set(e.date, e);
  for (const e of incoming) {
    const cur = map.get(e.date);
    if (!cur || e.updatedAt >= cur.updatedAt) {
      map.set(e.date, e);
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
