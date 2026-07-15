import type { DailyEntry } from './types';

export type StepField = 'experience' | 'reflection' | 'lesson' | 'nextAction';

export interface StepMeta {
  field: StepField;
  no: number;
  title: string;
  subtitle: string;
  placeholder: string;
  icon: string;
}

/** コルブの経験学習サイクルの4ステップ定義（UI表示順） */
export const STEPS: StepMeta[] = [
  {
    field: 'experience',
    no: 1,
    title: 'やったこと',
    subtitle: '具体的経験',
    placeholder: '今日やったこと・起きた出来事を具体的に書きましょう',
    icon: '🌱',
  },
  {
    field: 'reflection',
    no: 2,
    title: '振り返り',
    subtitle: '内省的観察',
    placeholder: 'どう感じた？何がうまくいって、何がひっかかった？',
    icon: '🔍',
  },
  {
    field: 'lesson',
    no: 3,
    title: '気づき・教訓',
    subtitle: '抽象的概念化',
    placeholder: 'そこから学んだこと・一般化できる法則は？',
    icon: '💡',
  },
  {
    field: 'nextAction',
    no: 4,
    title: '次の行動',
    subtitle: '能動的実験',
    placeholder: '次に試すこと・明日からの具体的なアクションは？',
    icon: '🚀',
  },
];

/** エントリの本文フィールド数のうち入力済みの数を返す */
export function filledCount(e: Pick<DailyEntry, StepField>): number {
  return STEPS.reduce((n, s) => n + (e[s.field].trim() !== '' ? 1 : 0), 0);
}
