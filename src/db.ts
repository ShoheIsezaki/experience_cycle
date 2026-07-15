import Dexie, { type Table } from 'dexie';
import type { DailyEntry } from './types';

export class ExperienceCycleDB extends Dexie {
  entries!: Table<DailyEntry, string>;

  constructor() {
    super('experience_cycle');
    this.version(1).stores({
      // date が主キー。updatedAt でも検索できるようインデックス
      entries: '&date, updatedAt',
    });
  }
}

export const db = new ExperienceCycleDB();

/** DailyEntry の本文フィールドがすべて空かどうか（天気は含めない判定用） */
export function isTextEmpty(e: Pick<DailyEntry, 'experience' | 'reflection' | 'lesson' | 'nextAction'>): boolean {
  return (
    e.experience.trim() === '' &&
    e.reflection.trim() === '' &&
    e.lesson.trim() === '' &&
    e.nextAction.trim() === ''
  );
}

/** レコード全体が空（天気も本文もなし）かどうか */
export function isEntryEmpty(e: DailyEntry): boolean {
  return e.weather === undefined && isTextEmpty(e);
}

/** 指定日付の空の初期エントリを作る */
export function emptyEntry(date: string): DailyEntry {
  return {
    date,
    weather: undefined,
    experience: '',
    reflection: '',
    lesson: '',
    nextAction: '',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * エントリを保存する。全項目が空ならレコードを削除する。
 * 返り値は「保存された（true）／削除された（false）」。
 */
export async function saveEntry(entry: DailyEntry): Promise<boolean> {
  const normalized: DailyEntry = {
    ...entry,
    experience: entry.experience.trim(),
    reflection: entry.reflection.trim(),
    lesson: entry.lesson.trim(),
    nextAction: entry.nextAction.trim(),
    updatedAt: new Date().toISOString(),
  };
  if (isEntryEmpty(normalized)) {
    await db.entries.delete(normalized.date);
    return false;
  }
  await db.entries.put(normalized);
  return true;
}

/** 指定日付のエントリを取得（なければ undefined） */
export async function getEntry(date: string): Promise<DailyEntry | undefined> {
  return db.entries.get(date);
}

/** 指定した日付配列に対応するエントリを一括取得（Map で返す） */
export async function getEntriesForDates(dates: string[]): Promise<Map<string, DailyEntry>> {
  const rows = await db.entries.where('date').anyOf(dates).toArray();
  return new Map(rows.map((r) => [r.date, r]));
}

/** 全エントリを日付昇順で取得 */
export async function getAllEntries(): Promise<DailyEntry[]> {
  const rows = await db.entries.toArray();
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/** 総レコード数 */
export async function countEntries(): Promise<number> {
  return db.entries.count();
}
