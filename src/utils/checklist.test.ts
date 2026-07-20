import { describe, expect, it } from 'vitest';
import {
  isActiveOn,
  sortItems,
  activeItemsOn,
  dayProgress,
  calcStreak,
  isChecked,
} from './checklist';
import type { ChecklistItem, ChecklistCheck } from '../types';

function item(over: Partial<ChecklistItem> & { id: string }): ChecklistItem {
  return {
    name: 'task',
    url: '',
    memo: '',
    time: '',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    archived: false,
    createdOn: '2026-07-01',
    archivedOn: null,
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...over,
  };
}

function check(itemId: string, date: string, checked = true): ChecklistCheck {
  return { itemId, date, checked, updatedAt: '2026-07-01T00:00:00.000Z' };
}

// 曜日確認: 2026-07-20 は月曜（themeWeekdayIndex=0）, 07-21 火(1) ... 07-25 土(5), 07-26 日(6)

describe('isActiveOn', () => {
  it('is active only on selected weekdays', () => {
    // 月・水のみ
    const it = item({ id: 'a', weekdays: [0, 2] });
    expect(isActiveOn(it, '2026-07-20')).toBe(true); // 月
    expect(isActiveOn(it, '2026-07-21')).toBe(false); // 火
    expect(isActiveOn(it, '2026-07-22')).toBe(true); // 水
  });

  it('respects createdOn (inclusive)', () => {
    const it = item({ id: 'a', createdOn: '2026-07-20' });
    expect(isActiveOn(it, '2026-07-19')).toBe(false);
    expect(isActiveOn(it, '2026-07-20')).toBe(true);
    expect(isActiveOn(it, '2026-07-21')).toBe(true);
  });

  it('respects archivedOn (archive day itself is inactive)', () => {
    const it = item({ id: 'a', archived: true, archivedOn: '2026-07-22' });
    expect(isActiveOn(it, '2026-07-21')).toBe(true);
    expect(isActiveOn(it, '2026-07-22')).toBe(false); // アーカイブ当日は非対象
    expect(isActiveOn(it, '2026-07-23')).toBe(false);
  });

  it('archived flag alone does not decide activity (history is by dates)', () => {
    // archived=true でも archivedOn より前の日は対象として履歴再現される
    const it = item({ id: 'a', archived: true, createdOn: '2026-07-01', archivedOn: '2026-07-25' });
    expect(isActiveOn(it, '2026-07-20')).toBe(true);
  });
});

describe('sortItems / activeItemsOn', () => {
  it('sorts by time asc with empty time last, then name', () => {
    const a = item({ id: 'a', name: 'あ', time: '21:00' });
    const b = item({ id: 'b', name: 'い', time: '' });
    const c = item({ id: 'c', name: 'う', time: '07:00' });
    const d = item({ id: 'd', name: 'え', time: '07:00' });
    const sorted = sortItems([a, b, c, d]).map((x) => x.id);
    expect(sorted).toEqual(['c', 'd', 'a', 'b']);
  });

  it('activeItemsOn filters then sorts', () => {
    const a = item({ id: 'a', time: '08:00', weekdays: [0] }); // 月のみ
    const b = item({ id: 'b', time: '07:00', weekdays: [1] }); // 火のみ
    const c = item({ id: 'c', time: '06:00', weekdays: [0] }); // 月のみ
    const res = activeItemsOn([a, b, c], '2026-07-20').map((x) => x.id); // 月
    expect(res).toEqual(['c', 'a']);
  });
});

describe('dayProgress', () => {
  it('counts done/total on a given day', () => {
    const a = item({ id: 'a', weekdays: [0] });
    const b = item({ id: 'b', weekdays: [0] });
    const c = item({ id: 'c', weekdays: [0] });
    const checks = [check('a', '2026-07-20'), check('c', '2026-07-20')];
    expect(dayProgress([a, b, c], checks, '2026-07-20')).toEqual({ done: 2, total: 3 });
  });

  it('ignores checks for non-active items and other days', () => {
    const a = item({ id: 'a', weekdays: [0] });
    const checks = [check('a', '2026-07-21'), check('a', '2026-07-20', false)];
    expect(dayProgress([a], checks, '2026-07-20')).toEqual({ done: 0, total: 1 });
  });

  it('total is 0 on an off day', () => {
    const a = item({ id: 'a', weekdays: [1] }); // 火のみ
    expect(dayProgress([a], [], '2026-07-20')).toEqual({ done: 0, total: 0 });
  });
});

describe('isChecked', () => {
  it('true only for a matching checked row', () => {
    const checks = [check('a', '2026-07-20'), check('b', '2026-07-20', false)];
    expect(isChecked(checks, 'a', '2026-07-20')).toBe(true);
    expect(isChecked(checks, 'b', '2026-07-20')).toBe(false);
    expect(isChecked(checks, 'a', '2026-07-19')).toBe(false);
  });
});

describe('calcStreak', () => {
  const daily = (id: string) => item({ id, weekdays: [0, 1, 2, 3, 4, 5, 6], createdOn: '2026-07-01' });

  it('returns 0 with no items', () => {
    expect(calcStreak([], [], '2026-07-20')).toBe(0);
  });

  it('counts consecutive fully-achieved days including today', () => {
    const a = daily('a');
    const checks = [
      check('a', '2026-07-18'),
      check('a', '2026-07-19'),
      check('a', '2026-07-20'),
    ];
    expect(calcStreak([a], checks, '2026-07-20')).toBe(3);
  });

  it('keeps streak when today is incomplete (counts up to yesterday)', () => {
    const a = daily('a');
    const checks = [
      check('a', '2026-07-17'),
      check('a', '2026-07-18'),
      check('a', '2026-07-19'),
      // 07-20（今日）は未チェック
    ];
    expect(calcStreak([a], checks, '2026-07-20')).toBe(3);
  });

  it('breaks on a past incomplete day', () => {
    const a = daily('a');
    const checks = [
      check('a', '2026-07-20'),
      check('a', '2026-07-19'),
      // 07-18 未達成
      check('a', '2026-07-17'),
    ];
    expect(calcStreak([a], checks, '2026-07-20')).toBe(2);
  });

  it('skips zero-task days without breaking the streak (weekday gap)', () => {
    // 平日のみのタスク。土日(07-25/07-26)は対象0でスキップされ連続維持
    const a = item({ id: 'a', weekdays: [0, 1, 2, 3, 4], createdOn: '2026-07-01' });
    const checks = [
      check('a', '2026-07-24'), // 金
      check('a', '2026-07-23'), // 木
    ];
    // 今日=07-27(月)未達成→猶予, 26日(日)/25日(土)対象0スキップ, 24金・23木達成
    expect(calcStreak([a], checks, '2026-07-27')).toBe(2);
  });

  it('requires all active tasks done to count a day', () => {
    const a = daily('a');
    const b = daily('b');
    const checks = [
      check('a', '2026-07-20'),
      check('b', '2026-07-20'),
      check('a', '2026-07-19'), // b未達成 → 19日は全達成でない
      check('b', '2026-07-18'),
      check('a', '2026-07-18'),
    ];
    // 20日全達成(1) → 19日で切れる
    expect(calcStreak([a, b], checks, '2026-07-20')).toBe(1);
  });

  it('handles month-boundary consecutive days', () => {
    const a = item({ id: 'a', weekdays: [0, 1, 2, 3, 4, 5, 6], createdOn: '2026-06-01' });
    const checks = [
      check('a', '2026-07-01'),
      check('a', '2026-06-30'),
      check('a', '2026-06-29'),
    ];
    expect(calcStreak([a], checks, '2026-07-01')).toBe(3);
  });

  it('does not count today when today is the only (incomplete) day', () => {
    const a = daily('a');
    expect(calcStreak([a], [], '2026-07-20')).toBe(0);
  });
});
