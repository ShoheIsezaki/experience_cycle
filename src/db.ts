import Dexie, { type Table } from 'dexie';
import type { ChecklistCheck, ChecklistItem, DailyEntry, WeekdayTheme } from './types';
import { pushCheck, pushEntry, pushItem, pushTheme } from './lib/sync';

export class ExperienceCycleDB extends Dexie {
  entries!: Table<DailyEntry, string>;
  themes!: Table<WeekdayTheme, number>;
  items!: Table<ChecklistItem, string>;
  checks!: Table<ChecklistCheck, [string, string]>;

  constructor() {
    super('experience_cycle');
    // version(1): entries のみ。既存端末のデータ保持のため定義を残す。
    this.version(1).stores({
      // date が主キー。updatedAt でも検索できるようインデックス
      entries: '&date, updatedAt',
    });
    // version(2): 曜日テーマ用ストアを追加（weekday=0..6 が主キー）。
    // entries は変更なし。既存データはそのまま引き継がれる。
    this.version(2).stores({
      entries: '&date, updatedAt',
      themes: '&weekday',
    });
    // version(3): デイリーチェックリスト（items / checks）を追加。
    // items は id が主キー、checks は itemId+date の複合主キー。
    // 既存の entries / themes は変更なし。既存データはそのまま引き継がれる。
    this.version(3).stores({
      entries: '&date, updatedAt',
      themes: '&weekday',
      items: '&id',
      checks: '&[itemId+date]',
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

// ---- 曜日テーマ ----

/**
 * 曜日→テーマ文字列の Map を返す（trim 後に空のものは除外＝未設定扱い）。
 * 表示用。weekday は 0=月..6=日。
 */
export async function getThemes(): Promise<Map<number, string>> {
  const rows = await db.themes.toArray();
  const map = new Map<number, string>();
  for (const r of rows) {
    const t = r.theme.trim();
    if (t !== '') map.set(r.weekday, t);
  }
  return map;
}

/**
 * 全曜日テーマの生データ（空文字トンボストーン込み）。
 * 同期のマージ用。表示には getThemes を使うこと。
 */
export async function getAllThemesRaw(): Promise<WeekdayTheme[]> {
  const rows = await db.themes.toArray();
  return rows.sort((a, b) => a.weekday - b.weekday);
}

/**
 * 曜日テーマを保存する。theme は trim して put、updatedAt を更新する。
 * 空文字も保存する（＝トンボストーン方式でクリアを同期伝播させる）。
 * ログイン中ならクラウドへ write-through（失敗しても致命的でない）。
 */
export async function saveTheme(weekday: number, theme: string): Promise<void> {
  const normalized: WeekdayTheme = {
    weekday,
    theme: theme.trim(),
    updatedAt: new Date().toISOString(),
  };
  await db.themes.put(normalized);
  // ログイン中なら即時同期（fire-and-forget。失敗は次回 fullSync が自己修復）
  void pushTheme(normalized);
}

// ---- チェックリスト（タスク） ----

/** アーカイブ済みを除く全タスクを取得（表示順の並べ替えは呼び出し側で行う）。 */
export async function getActiveItems(): Promise<ChecklistItem[]> {
  const rows = await db.items.toArray();
  return rows.filter((r) => !r.archived);
}

/** 全タスク（アーカイブ済み込みの生データ）。同期・履歴集計用。 */
export async function getAllItemsRaw(): Promise<ChecklistItem[]> {
  const rows = await db.items.toArray();
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

/** id からタスクを取得。 */
export async function getItem(id: string): Promise<ChecklistItem | undefined> {
  return db.items.get(id);
}

/**
 * タスクを保存する。updatedAt を更新して put し、ログイン中はクラウドへ write-through。
 * archived=true のアーカイブ保存もこの関数を通す（トンボストーン方式で同期伝播）。
 */
export async function saveItem(item: ChecklistItem): Promise<void> {
  const normalized: ChecklistItem = {
    ...item,
    name: item.name.trim(),
    url: item.url.trim(),
    memo: item.memo.slice(0, 1000),
    updatedAt: new Date().toISOString(),
  };
  await db.items.put(normalized);
  void pushItem(normalized);
}

/** タスクをアーカイブ（論理削除）する。archived=true + archivedOn=今日。 */
export async function archiveItem(id: string, today: string): Promise<void> {
  const item = await db.items.get(id);
  if (!item) return;
  await saveItem({ ...item, archived: true, archivedOn: today });
}

// ---- チェックリスト（チェック） ----

/** 全チェック（解除トンボストーン込みの生データ）。同期・集計用。 */
export async function getAllChecksRaw(): Promise<ChecklistCheck[]> {
  const rows = await db.checks.toArray();
  return rows.sort((a, b) => {
    const k = a.itemId.localeCompare(b.itemId);
    return k !== 0 ? k : a.date.localeCompare(b.date);
  });
}

/** 指定日のチェック一覧（checked=true/false 込み）。 */
export async function getChecksForDate(date: string): Promise<ChecklistCheck[]> {
  const rows = await db.checks.toArray();
  return rows.filter((r) => r.date === date);
}

/** 指定日配列に対応するチェック一覧（checked=true/false 込み）。 */
export async function getChecksForDates(dates: string[]): Promise<ChecklistCheck[]> {
  const rows = await db.checks.toArray();
  const set = new Set(dates);
  return rows.filter((r) => set.has(r.date));
}

/**
 * チェック状態を保存する。checked=false でも put する
 * （解除をトンボストーンとして同期伝播させるため）。即時 write-through。
 */
export async function setCheck(itemId: string, date: string, checked: boolean): Promise<void> {
  const row: ChecklistCheck = {
    itemId,
    date,
    checked,
    updatedAt: new Date().toISOString(),
  };
  await db.checks.put(row);
  void pushCheck(row);
}
