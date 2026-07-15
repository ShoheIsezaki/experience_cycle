/**
 * 日付ユーティリティ。すべて端末のローカルタイムゾーン基準で扱う。
 * 内部表現は "YYYY-MM-DD" 文字列。
 */

const pad = (n: number): string => String(n).padStart(2, '0');

/** Date → "YYYY-MM-DD"（ローカル） */
export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" → ローカル0時のDate */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 今日の日付文字列（ローカル） */
export function todayStr(): string {
  return formatDate(new Date());
}

/** 日付文字列に n 日加算した日付文字列を返す */
export function addDays(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

/** 月を n 加算（日は月末に丸める） */
export function addMonths(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  const targetMonthDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  // 月末調整（例: 1/31 + 1ヶ月 → 2/28）
  const lastDay = daysInMonth(d.getFullYear(), d.getMonth());
  d.setDate(Math.min(targetMonthDay, lastDay));
  return formatDate(d);
}

/** その年月（0始まりの月）の日数 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

/** 曜日番号(0=日)→日本語1文字 */
export function weekdayJa(dateStr: string): string {
  return WEEKDAY_JA[parseDate(dateStr).getDay()];
}

/** "2026年7月15日（水）" 形式 */
export function formatDisplay(dateStr: string): string {
  const d = parseDate(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAY_JA[d.getDay()]}）`;
}

/** "7/15（水）" 形式（短縮） */
export function formatShort(dateStr: string): string {
  const d = parseDate(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAY_JA[d.getDay()]}）`;
}

/**
 * その日付を含む週（月曜始まり）の月曜日の日付文字列を返す。
 */
export function getWeekStart(dateStr: string): string {
  const d = parseDate(dateStr);
  const day = d.getDay(); // 0=日,1=月,...6=土
  const diff = day === 0 ? -6 : 1 - day; // 月曜までの差
  d.setDate(d.getDate() + diff);
  return formatDate(d);
}

/** その日付を含む週（月曜始まり）の7日分の日付文字列配列 */
export function getWeekDays(dateStr: string): string[] {
  const start = getWeekStart(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * カレンダー月表示用の6週×7日のグリッド（月曜始まり）を生成。
 * 各セルは日付文字列。前月・翌月の日も埋める。
 */
export function getMonthGrid(year: number, month: number): string[][] {
  const firstOfMonth = `${year}-${pad(month + 1)}-01`;
  const gridStart = getWeekStart(firstOfMonth);
  const weeks: string[][] = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** 日付文字列の月(0始まり)を返す */
export function getMonth(dateStr: string): number {
  return parseDate(dateStr).getMonth();
}

/** 日付文字列の年を返す */
export function getYear(dateStr: string): number {
  return parseDate(dateStr).getFullYear();
}

/** "2026年7月" 形式 */
export function formatMonth(year: number, month: number): string {
  return `${year}年${month + 1}月`;
}
