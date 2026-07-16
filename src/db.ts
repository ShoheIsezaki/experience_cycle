import Dexie, { type Table } from 'dexie';
import type { DailyEntry } from './types';
import { pushEntry } from './lib/sync';

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
 * エントリを保存する。
 * 全項目が空でもレコードは削除せず「空のまま put」してトンボストーン化する
 * （更新時刻付きの空エントリ＝削除、として同期で伝播させるため）。
 * ログイン中ならクラウドへ write-through（失敗しても致命的でない）。
 * 返り値は「本文または天気を含む有効なエントリか（true）／空エントリか（false）」。
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
  await db.entries.put(normalized);
  // ログイン中なら即時同期（fire-and-forget。失敗は次回 fullSync が自己修復）
  void pushEntry(normalized);
  return !isEntryEmpty(normalized);
}

/** 指定日付のエントリを取得（空エントリ＝存在しない扱いで undefined） */
export async function getEntry(date: string): Promise<DailyEntry | undefined> {
  const row = await db.entries.get(date);
  if (!row || isEntryEmpty(row)) return undefined;
  return row;
}

/**
 * 指定した日付配列に対応するエントリを一括取得（Map で返す）。
 * 空エントリ（トンボストーン）は除外する。
 */
export async function getEntriesForDates(dates: string[]): Promise<Map<string, DailyEntry>> {
  const rows = await db.entries.where('date').anyOf(dates).toArray();
  return new Map(rows.filter((r) => !isEntryEmpty(r)).map((r) => [r.date, r]));
}

/** 全エントリを日付昇順で取得（空エントリは除外） */
export async function getAllEntries(): Promise<DailyEntry[]> {
  const rows = await db.entries.toArray();
  return rows.filter((r) => !isEntryEmpty(r)).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 全エントリを日付昇順で取得（トンボストーン込みの生データ）。
 * 同期・インポートのマージ用。表示には getAllEntries を使うこと。
 */
export async function getAllEntriesRaw(): Promise<DailyEntry[]> {
  const rows = await db.entries.toArray();
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/** 総レコード数（空エントリを除外した実件数） */
export async function countEntries(): Promise<number> {
  const rows = await db.entries.toArray();
  return rows.filter((r) => !isEntryEmpty(r)).length;
}
