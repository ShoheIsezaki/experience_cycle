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

export const WEATHER_OPTIONS: { value: Weather; emoji: string; label: string }[] = [
  { value: 1, emoji: '☀️', label: '快晴' },
  { value: 2, emoji: '🌤', label: '晴れ' },
  { value: 3, emoji: '☁️', label: 'くもり' },
  { value: 4, emoji: '🌧', label: '雨' },
  { value: 5, emoji: '⛈', label: '嵐' },
];
