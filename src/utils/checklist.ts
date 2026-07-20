/**
 * デイリーチェックリストの純粋関数群（DB・DOM 非依存）。
 * すべて端末ローカルタイムゾーン基準の "YYYY-MM-DD" 文字列で日付を扱う。
 * weekdays は 0=月..6=日（テーマ・カレンダーと揃える）。
 */
import type { ChecklistItem, ChecklistCheck } from '../types';
import { addDays, themeWeekdayIndex } from './date';

/**
 * タスクが指定日に「対象（オン）」かどうかを履歴対応で判定する。
 * archived フラグそのものではなく作成日／アーカイブ日で判定するため、
 * 過去日を遡って表示・集計しても当時の状態が正しく再現される。
 *   - その日の曜日が weekdays に含まれる
 *   - createdOn 以降（createdOn を含む）
 *   - archivedOn が null、またはその日が archivedOn より前（archivedOn 当日は非対象）
 */
export function isActiveOn(item: ChecklistItem, dateStr: string): boolean {
  if (!item.weekdays.includes(themeWeekdayIndex(dateStr))) return false;
  if (item.createdOn > dateStr) return false;
  if (item.archivedOn !== null && dateStr >= item.archivedOn) return false;
  return true;
}

/**
 * タスクの表示順に並べ替える（純粋関数・非破壊）。
 * time 昇順（'' は最後）→ name（日本語ロケール）。
 */
export function sortItems(items: ChecklistItem[]): ChecklistItem[] {
  return [...items].sort((a, b) => {
    // '' の time は末尾に回すため大きい値に置換
    const at = a.time === '' ? '99:99' : a.time;
    const bt = b.time === '' ? '99:99' : b.time;
    if (at !== bt) return at < bt ? -1 : 1;
    return a.name.localeCompare(b.name, 'ja');
  });
}

/** 指定日に対象のタスクだけを表示順で返す。 */
export function activeItemsOn(items: ChecklistItem[], dateStr: string): ChecklistItem[] {
  return sortItems(items.filter((it) => isActiveOn(it, dateStr)));
}

/** checked=true のチェックを (itemId|date) キーの Set 化する（内部用）。 */
function checkedKeySet(checks: ChecklistCheck[]): Set<string> {
  const set = new Set<string>();
  for (const c of checks) {
    if (c.checked) set.add(`${c.itemId}|${c.date}`);
  }
  return set;
}

/** 特定のタスク×日がチェック済みか。 */
export function isChecked(checks: ChecklistCheck[], itemId: string, dateStr: string): boolean {
  return checks.some((c) => c.itemId === itemId && c.date === dateStr && c.checked);
}

export interface DayProgress {
  /** チェック済みの対象タスク数 */
  done: number;
  /** その日の対象タスク総数 */
  total: number;
}

/**
 * 指定日の達成数（done/total）を計算する（純粋関数）。
 * total はその日に対象のタスク数、done はそのうち checked=true の数。
 */
export function dayProgress(
  items: ChecklistItem[],
  checks: ChecklistCheck[],
  dateStr: string,
): DayProgress {
  const active = items.filter((it) => isActiveOn(it, dateStr));
  const set = checkedKeySet(checks);
  let done = 0;
  for (const it of active) {
    if (set.has(`${it.id}|${dateStr}`)) done += 1;
  }
  return { done, total: active.length };
}

/**
 * 連続「全達成」日数（ストリーク）を計算する（純粋関数）。
 * - 全達成日 = 対象タスクが1つ以上あり、その全てが checked=true の日。
 * - 対象タスク0の日（曜日オフ・作成前・アーカイブ後）はスキップ扱いで連続を切らない。
 * - 今日がまだ未完了でも連続は切らず、昨日までの連続を維持して数える
 *   （今日自体はまだ全達成でなければカウントしない）。
 * - 過去日で全達成でない日に当たった時点で終了。
 * 返り値は連続日数（表示側で 2 以上のとき「◯日連続で全達成中」を出す想定）。
 */
export function calcStreak(
  items: ChecklistItem[],
  checks: ChecklistCheck[],
  todayStr: string,
): number {
  if (items.length === 0) return 0;
  // これ以上遡っても対象タスクが存在しない下限（最古の作成日）
  const earliest = items.reduce((min, it) => (it.createdOn < min ? it.createdOn : min), todayStr);

  let streak = 0;
  let cursor = todayStr;
  // 全曜日オフ等で対象0が延々と続くケースの保険（earliest でも止まる）
  let guard = 0;
  while (cursor >= earliest && guard < 1000) {
    guard += 1;
    const { done, total } = dayProgress(items, checks, cursor);
    if (total === 0) {
      // 対象なしの日はスキップ（連続を切らない・数えない）
      cursor = addDays(cursor, -1);
      continue;
    }
    if (done === total) {
      streak += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    // 未達成の日。今日だけは猶予（数えないが連続は切らない）
    if (cursor === todayStr) {
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }
  return streak;
}
