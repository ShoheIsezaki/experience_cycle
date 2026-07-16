import type { DailyEntry, Weather } from '../types';
import { db, getAllEntriesRaw } from '../db';
import { mergeEntries } from '../utils/backup';
import { supabase } from './supabase';

/** Supabase の public.entries テーブルの1行（snake_case カラム）。 */
export interface EntryRow {
  user_id: string;
  date: string;
  weather: number | null;
  experience: string;
  reflection: string;
  lesson: string;
  next_action: string;
  updated_at: string;
}

function isValidWeather(w: unknown): w is Weather {
  return w === 1 || w === 2 || w === 3 || w === 4 || w === 5;
}

/**
 * タイムスタンプを JS の toISOString 形式（ミリ秒精度・"Z" 終端）に正規化する。
 * Postgres は "2026-07-15T10:00:00.123000+00:00" のような形式を返すため、
 * そのまま文字列比較すると同時刻でもローカル（"...Z"）が常に新しい扱いになり、
 * 毎回全件 push される。パース不能な文字列はそのまま返す。
 */
export function normalizeIso(s: string): string {
  const t = Date.parse(s);
  return Number.isNaN(t) ? s : new Date(t).toISOString();
}

/** DailyEntry → DB 行（純粋関数）。weather は undefined→null。 */
export function entryToRow(entry: DailyEntry, userId: string): EntryRow {
  return {
    user_id: userId,
    date: entry.date,
    weather: entry.weather === undefined ? null : entry.weather,
    experience: entry.experience,
    reflection: entry.reflection,
    lesson: entry.lesson,
    next_action: entry.nextAction,
    updated_at: entry.updatedAt,
  };
}

/** DB 行 → DailyEntry（純粋関数）。null→undefined、不正 weather も undefined 化。 */
export function rowToEntry(row: EntryRow): DailyEntry {
  return {
    date: row.date,
    weather: isValidWeather(row.weather) ? row.weather : undefined,
    experience: row.experience ?? '',
    reflection: row.reflection ?? '',
    lesson: row.lesson ?? '',
    nextAction: row.next_action ?? '',
    updatedAt: normalizeIso(row.updated_at),
  };
}

export interface SyncPlan {
  /** マージ後のローカルへ書き込むべき全エントリ（トンボストーン込み） */
  merged: DailyEntry[];
  /** クラウドへ upsert すべき（ローカルが新しい）エントリ */
  toPush: DailyEntry[];
  /** クラウドから取り込んで新しくなったローカル件数 */
  pulled: number;
  /** クラウドへ送信する件数（toPush.length と一致） */
  pushed: number;
}

/**
 * ローカル（raw）とクラウドのエントリ集合から同期プランを計算する（純粋関数）。
 * - merged: updatedAt の新しい方を採用（LWW）。同値はローカル優先。
 * - toPush: ローカル側が新しい（またはクラウドに存在しない）エントリ。
 * - pulled: クラウド側が新しく、ローカルを更新することになる件数。
 * トンボストーン（空エントリ）も通常のエントリと同様に扱い、削除を伝播させる。
 */
export function planSync(local: DailyEntry[], cloud: DailyEntry[]): SyncPlan {
  // 同値はローカル優先にしたいので existing=cloud, incoming=local
  const merged = mergeEntries(cloud, local, 'merge');

  const cloudMap = new Map(cloud.map((e) => [e.date, e]));
  const localMap = new Map(local.map((e) => [e.date, e]));

  const toPush: DailyEntry[] = [];
  let pulled = 0;

  for (const e of merged) {
    const c = cloudMap.get(e.date);
    // ローカル（＝merged の勝者）がクラウドより新しい／クラウド未存在なら push
    if (!c || e.updatedAt > c.updatedAt) {
      toPush.push(e);
    }
    const l = localMap.get(e.date);
    // クラウド由来の値でローカルが更新される（ローカル未存在 or クラウドが新しい）
    if (!l || e.updatedAt > l.updatedAt) {
      pulled += 1;
    }
  }

  return { merged, toPush, pulled, pushed: toPush.length };
}

/** 直近の fullSync 完了時刻（ISO）。UI 表示用。成功時のみ更新。 */
let lastSyncedAt: string | null = null;
export function getLastSyncedAt(): string | null {
  return lastSyncedAt;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
}

/**
 * クラウド全行を取得 → ローカル(raw)と LWW マージ → ローカルへ bulkPut、
 * ローカルが新しい行のみクラウドへ upsert。取込/送信件数を返す。
 * 未設定・未ログイン時は null。失敗時は例外を投げる（呼び出し側で表示）。
 * 同時に複数箇所から呼ばれた場合は実行中の同期を共有する（重複実行しない）。
 */
let inFlight: Promise<SyncResult | null> | null = null;

export function fullSync(userId: string): Promise<SyncResult | null> {
  if (inFlight) return inFlight;
  inFlight = doFullSync(userId).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doFullSync(userId: string): Promise<SyncResult | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;

  const cloud = (data as EntryRow[]).map(rowToEntry);
  const local = await getAllEntriesRaw();
  const plan = planSync(local, cloud);

  await db.entries.bulkPut(plan.merged);

  if (plan.toPush.length > 0) {
    const rows = plan.toPush.map((e) => entryToRow(e, userId));
    const { error: upErr } = await supabase
      .from('entries')
      .upsert(rows, { onConflict: 'user_id,date' });
    if (upErr) throw upErr;
  }

  lastSyncedAt = new Date().toISOString();
  return { pulled: plan.pulled, pushed: plan.pushed };
}

/**
 * ログイン中の書き込みをクラウドへ即時 upsert（write-through）。
 * 未設定・未ログイン・失敗時は throw せず false を返す
 * （次回 fullSync が自己修復するため致命的ではない）。
 */
export async function pushEntry(entry: DailyEntry): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return false;
    const { error } = await supabase
      .from('entries')
      .upsert(entryToRow(entry, userId), { onConflict: 'user_id,date' });
    return !error;
  } catch {
    return false;
  }
}
