export type Weather = 1 | 2 | 3 | 4 | 5;

/**
 * 1日1レコードの経験学習サイクルの記録。
 * date を主キーとする。全項目は任意入力。
 */
export interface DailyEntry {
  /** "YYYY-MM-DD" 端末ローカルタイムゾーン基準。主キー */
  date: string;
  /** 学習状態の自己評価（天気マーク）。1=☀️ 2=🌤 3=☁️ 4=🌧 5=⛈ */
  weather?: Weather;
  /** ①具体的経験: やったこと */
  experience: string;
  /** ②内省的観察: 振り返り */
  reflection: string;
  /** ③抽象的概念化: 気づき・教訓 */
  lesson: string;
  /** ④能動的実験: 次の行動 */
  nextAction: string;
  /** 最終更新時刻（ISO文字列） */
  updatedAt: string;
}

/**
 * 曜日ごとに意識する「テーマ」（自由テキスト）。
 * weekday は 0=月曜..6=日曜（週表示・カレンダーと揃える）。
 */
export interface WeekdayTheme {
  /** 0=月..6=日 */
  weekday: number;
  /** テーマ本文（trim 済み。空文字はトンボストーン＝未設定として同期伝播） */
  theme: string;
  /** 最終更新時刻（ISO文字列） */
  updatedAt: string;
}

/**
 * デイリーチェックリストのタスク定義。
 * 削除は物理削除せず archived=true + archivedOn でアーカイブ（履歴保持）。
 */
export interface ChecklistItem {
  /** crypto.randomUUID()。主キー */
  id: string;
  /** タスク名（必須） */
  name: string;
  /** 参考リンク（任意。'' 可） */
  url: string;
  /** メモ（改行可・最大1000字はUIで制御。'' 可） */
  memo: string;
  /** 目安の時間 "HH:MM"。'' 可 */
  time: string;
  /** オンにする曜日（0=月..6=日）の配列 */
  weekdays: number[];
  /** アーカイブ済み（削除）フラグ */
  archived: boolean;
  /** 作成日 "YYYY-MM-DD"（ローカル）。この日以降が対象 */
  createdOn: string;
  /** アーカイブした日 "YYYY-MM-DD"。null=未アーカイブ。この日以降は非対象 */
  archivedOn: string | null;
  /** 最終更新時刻（ISO文字列） */
  updatedAt: string;
}

/**
 * チェックリストの1タスク×1日のチェック状態。
 * itemId+date を複合キーとする。checked=false 行はトンボストーン。
 */
export interface ChecklistCheck {
  /** 対象タスクの id */
  itemId: string;
  /** "YYYY-MM-DD"（ローカル） */
  date: string;
  /** チェック済みか。false=解除（トンボストーン） */
  checked: boolean;
  /** 最終更新時刻（ISO文字列） */
  updatedAt: string;
}

/** 曜日の短縮ラベル（0=月..6=日）。UIの曜日チップ・ヘッダーで共用。 */
export const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'] as const;

export const WEATHER_OPTIONS: { value: Weather; emoji: string; label: string }[] = [
  { value: 1, emoji: '☀️', label: '快晴' },
  { value: 2, emoji: '🌤', label: '晴れ' },
  { value: 3, emoji: '☁️', label: 'くもり' },
  { value: 4, emoji: '🌧', label: '雨' },
  { value: 5, emoji: '⛈', label: '嵐' },
];
