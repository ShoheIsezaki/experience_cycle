/**
 * 曜日テーマの表示用ユーティリティ。
 * weekday は 0=月..6=日（週表示・カレンダーと揃える）。
 */

/** 連続する同一テーマを結合した1区間。 */
export interface ThemeSpan {
  /** テーマ文字列（trim 済み）。未設定区間は空文字 */
  theme: string;
  /** 開始曜日（0=月..6=日） */
  start: number;
  /** 連続日数（1..7）。CSS Grid の grid-column span に使う */
  span: number;
}

/**
 * 月〜日（0..6）のテーマ Map から、隣り合う同一テーマを結合した区間配列を作る（純粋関数）。
 * - trim 後に一致するテーマが連続する場合のみ結合する。
 * - テーマ未設定（Map に無い or 空）の曜日は空文字テーマの区間として保持する
 *   （帯の高さ維持のため、区間自体はスキップしない）。
 * - 週をまたぐ結合はしない（常に 0..6 の範囲で完結し、span の合計は 7）。
 *
 * 例: 月火=A, 水=空, 木金土=B, 日=A → [A(2), 空(1), B(3), A(1)]
 */
export function groupThemeSpans(themes: Map<number, string>): ThemeSpan[] {
  const spans: ThemeSpan[] = [];
  for (let wd = 0; wd < 7; wd++) {
    const theme = (themes.get(wd) ?? '').trim();
    const prev = spans[spans.length - 1];
    if (prev && prev.theme === theme) {
      prev.span += 1;
    } else {
      spans.push({ theme, start: wd, span: 1 });
    }
  }
  return spans;
}
