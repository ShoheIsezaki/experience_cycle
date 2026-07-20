import { describe, expect, it } from 'vitest';
import {
  entryToRow,
  rowToEntry,
  planSync,
  normalizeIso,
  themeToRow,
  rowToTheme,
  planThemeSync,
  itemToRow,
  rowToItem,
  planItemSync,
  checkToRow,
  rowToCheck,
  planCheckSync,
  type EntryRow,
  type ThemeRow,
  type ItemRow,
  type CheckRow,
} from './sync';
import type { ChecklistCheck, ChecklistItem, DailyEntry, WeekdayTheme } from '../types';

function entry(over: Partial<DailyEntry> & { date: string }): DailyEntry {
  return {
    weather: undefined,
    experience: '',
    reflection: '',
    lesson: '',
    nextAction: '',
    updatedAt: '2026-07-15T00:00:00.000Z',
    ...over,
  };
}

describe('entryToRow / rowToEntry round trip', () => {
  it('maps camelCase <-> snake_case and preserves values', () => {
    const e = entry({
      date: '2026-07-15',
      weather: 3,
      experience: '経験',
      reflection: '振り返り',
      lesson: '教訓',
      nextAction: '次の行動',
      updatedAt: '2026-07-15T10:00:00.000Z',
    });
    const row = entryToRow(e, 'user-1');
    expect(row.user_id).toBe('user-1');
    expect(row.next_action).toBe('次の行動');
    expect(row.weather).toBe(3);
    expect(row.updated_at).toBe('2026-07-15T10:00:00.000Z');
    // 往復でローカル型に戻る
    expect(rowToEntry(row)).toEqual(e);
  });

  it('maps undefined weather to null and back', () => {
    const e = entry({ date: '2026-07-15', weather: undefined });
    const row = entryToRow(e, 'u');
    expect(row.weather).toBeNull();
    expect(rowToEntry(row).weather).toBeUndefined();
  });

  it('coerces invalid weather from a row to undefined', () => {
    const row: EntryRow = {
      user_id: 'u',
      date: '2026-07-15',
      weather: 9,
      experience: '',
      reflection: '',
      lesson: '',
      next_action: '',
      updated_at: '2026-07-15T00:00:00.000Z',
    };
    expect(rowToEntry(row).weather).toBeUndefined();
  });
});

describe('normalizeIso（Postgres形式のタイムスタンプ正規化）', () => {
  it('converts Postgres timestamptz format (+00:00, microseconds) to JS ISO format', () => {
    expect(normalizeIso('2026-07-15T10:00:00.123000+00:00')).toBe('2026-07-15T10:00:00.123Z');
    expect(normalizeIso('2026-07-15T10:00:00+00:00')).toBe('2026-07-15T10:00:00.000Z');
  });

  it('leaves unparsable strings as-is', () => {
    expect(normalizeIso('not-a-date')).toBe('not-a-date');
  });

  it('rowToEntry normalizes updated_at so a pushed row round-trips as identical', () => {
    // push した行を Postgres が "+00:00"・マイクロ秒形式で返しても、
    // 正規化により同一時刻と判定され、再push（毎回全件送信）が起きないこと
    const local = entry({ date: '2026-07-15', experience: 'x', updatedAt: '2026-07-15T10:00:00.123Z' });
    const row: EntryRow = {
      ...entryToRow(local, 'u'),
      updated_at: '2026-07-15T10:00:00.123000+00:00',
    };
    const cloud = rowToEntry(row);
    expect(cloud.updatedAt).toBe(local.updatedAt);
    const plan = planSync([local], [cloud]);
    expect(plan.toPush).toHaveLength(0);
    expect(plan.pulled).toBe(0);
  });
});

describe('planSync', () => {
  it('pulls cloud rows missing locally', () => {
    const local: DailyEntry[] = [];
    const cloud = [entry({ date: '2026-07-14', experience: 'cloud' })];
    const plan = planSync(local, cloud);
    expect(plan.merged.map((e) => e.date)).toEqual(['2026-07-14']);
    expect(plan.pulled).toBe(1);
    expect(plan.toPush).toHaveLength(0);
    expect(plan.pushed).toBe(0);
  });

  it('pushes local rows missing in cloud', () => {
    const local = [entry({ date: '2026-07-14', experience: 'local' })];
    const cloud: DailyEntry[] = [];
    const plan = planSync(local, cloud);
    expect(plan.toPush.map((e) => e.date)).toEqual(['2026-07-14']);
    expect(plan.pushed).toBe(1);
    expect(plan.pulled).toBe(0);
  });

  it('keeps the newer side per date (LWW) and pushes when local is newer', () => {
    const local = [
      entry({ date: '2026-07-14', experience: 'local-new', updatedAt: '2026-07-14T12:00:00.000Z' }),
    ];
    const cloud = [
      entry({ date: '2026-07-14', experience: 'cloud-old', updatedAt: '2026-07-14T00:00:00.000Z' }),
    ];
    const plan = planSync(local, cloud);
    expect(plan.merged[0].experience).toBe('local-new');
    expect(plan.toPush).toHaveLength(1);
    expect(plan.pulled).toBe(0);
  });

  it('keeps cloud when it is newer and does not push it back', () => {
    const local = [
      entry({ date: '2026-07-14', experience: 'local-old', updatedAt: '2026-07-14T00:00:00.000Z' }),
    ];
    const cloud = [
      entry({ date: '2026-07-14', experience: 'cloud-new', updatedAt: '2026-07-14T12:00:00.000Z' }),
    ];
    const plan = planSync(local, cloud);
    expect(plan.merged[0].experience).toBe('cloud-new');
    expect(plan.toPush).toHaveLength(0);
    expect(plan.pulled).toBe(1);
  });

  it('does nothing when both sides are identical (equal updatedAt)', () => {
    const same = entry({ date: '2026-07-14', experience: 'x', updatedAt: '2026-07-14T00:00:00.000Z' });
    const plan = planSync([same], [{ ...same }]);
    expect(plan.toPush).toHaveLength(0);
    expect(plan.pulled).toBe(0);
    expect(plan.merged).toHaveLength(1);
  });

  it('propagates a tombstone (empty entry) as a push when local deletion is newer', () => {
    const local = [
      entry({ date: '2026-07-14', experience: '', updatedAt: '2026-07-14T12:00:00.000Z' }), // deleted locally
    ];
    const cloud = [
      entry({ date: '2026-07-14', experience: 'still-here', updatedAt: '2026-07-14T00:00:00.000Z' }),
    ];
    const plan = planSync(local, cloud);
    expect(plan.merged[0].experience).toBe('');
    expect(plan.toPush).toHaveLength(1);
    expect(plan.toPush[0].experience).toBe('');
  });
});

function theme(over: Partial<WeekdayTheme> & { weekday: number }): WeekdayTheme {
  return {
    theme: '',
    updatedAt: '2026-07-15T00:00:00.000Z',
    ...over,
  };
}

describe('themeToRow / rowToTheme round trip', () => {
  it('maps fields and preserves values', () => {
    const t = theme({ weekday: 2, theme: '傾聴', updatedAt: '2026-07-15T10:00:00.000Z' });
    const row = themeToRow(t, 'user-1');
    expect(row.user_id).toBe('user-1');
    expect(row.weekday).toBe(2);
    expect(row.theme).toBe('傾聴');
    expect(row.updated_at).toBe('2026-07-15T10:00:00.000Z');
    expect(rowToTheme(row)).toEqual(t);
  });

  it('normalizes Postgres updated_at so a pushed theme round-trips as identical', () => {
    const local = theme({ weekday: 0, theme: 'A', updatedAt: '2026-07-15T10:00:00.123Z' });
    const row: ThemeRow = {
      ...themeToRow(local, 'u'),
      updated_at: '2026-07-15T10:00:00.123000+00:00',
    };
    const cloud = rowToTheme(row);
    expect(cloud.updatedAt).toBe(local.updatedAt);
    const plan = planThemeSync([local], [cloud]);
    expect(plan.toPush).toHaveLength(0);
    expect(plan.pulled).toBe(0);
  });

  it('coerces a null theme from a row to empty string', () => {
    const row = { user_id: 'u', weekday: 3, theme: null, updated_at: '2026-07-15T00:00:00.000Z' } as unknown as ThemeRow;
    expect(rowToTheme(row).theme).toBe('');
  });
});

describe('planThemeSync', () => {
  it('pulls cloud themes missing locally', () => {
    const cloud = [theme({ weekday: 1, theme: 'cloud' })];
    const plan = planThemeSync([], cloud);
    expect(plan.merged.map((t) => t.weekday)).toEqual([1]);
    expect(plan.pulled).toBe(1);
    expect(plan.toPush).toHaveLength(0);
  });

  it('pushes local themes missing in cloud', () => {
    const local = [theme({ weekday: 4, theme: 'local' })];
    const plan = planThemeSync(local, []);
    expect(plan.toPush.map((t) => t.weekday)).toEqual([4]);
    expect(plan.pushed).toBe(1);
    expect(plan.pulled).toBe(0);
  });

  it('keeps the newer side per weekday (LWW)', () => {
    const local = [theme({ weekday: 0, theme: 'local-new', updatedAt: '2026-07-14T12:00:00.000Z' })];
    const cloud = [theme({ weekday: 0, theme: 'cloud-old', updatedAt: '2026-07-14T00:00:00.000Z' })];
    const plan = planThemeSync(local, cloud);
    expect(plan.merged[0].theme).toBe('local-new');
    expect(plan.toPush).toHaveLength(1);
    expect(plan.pulled).toBe(0);
  });

  it('does nothing when both sides are identical (equal updatedAt)', () => {
    const same = theme({ weekday: 2, theme: 'x', updatedAt: '2026-07-14T00:00:00.000Z' });
    const plan = planThemeSync([same], [{ ...same }]);
    expect(plan.toPush).toHaveLength(0);
    expect(plan.pulled).toBe(0);
    expect(plan.merged).toHaveLength(1);
  });

  it('propagates an empty-string tombstone (clear) as a push when local is newer', () => {
    const local = [theme({ weekday: 5, theme: '', updatedAt: '2026-07-14T12:00:00.000Z' })];
    const cloud = [theme({ weekday: 5, theme: 'still-here', updatedAt: '2026-07-14T00:00:00.000Z' })];
    const plan = planThemeSync(local, cloud);
    expect(plan.merged[0].theme).toBe('');
    expect(plan.toPush).toHaveLength(1);
    expect(plan.toPush[0].theme).toBe('');
  });
});

function citem(over: Partial<ChecklistItem> & { id: string }): ChecklistItem {
  return {
    name: 'task',
    url: '',
    memo: '',
    time: '',
    weekdays: [0, 1, 2, 3, 4],
    archived: false,
    createdOn: '2026-07-01',
    archivedOn: null,
    updatedAt: '2026-07-15T00:00:00.000Z',
    ...over,
  };
}

describe('itemToRow / rowToItem round trip', () => {
  it('maps fields and keeps weekdays array', () => {
    const it = citem({
      id: 'x1',
      name: '英語',
      url: 'https://example.com',
      memo: 'メモ\n改行',
      time: '07:30',
      weekdays: [0, 2, 4],
      updatedAt: '2026-07-15T10:00:00.000Z',
    });
    const row = itemToRow(it, 'user-1');
    expect(row.user_id).toBe('user-1');
    expect(row.created_on).toBe('2026-07-01');
    expect(row.archived_on).toBeNull();
    expect(row.weekdays).toEqual([0, 2, 4]);
    expect(rowToItem(row)).toEqual(it);
  });

  it('normalizes Postgres updated_at so a pushed item round-trips as identical', () => {
    const local = citem({ id: 'x', updatedAt: '2026-07-15T10:00:00.123Z' });
    const row: ItemRow = {
      ...itemToRow(local, 'u'),
      updated_at: '2026-07-15T10:00:00.123000+00:00',
    };
    const cloud = rowToItem(row);
    expect(cloud.updatedAt).toBe(local.updatedAt);
    const plan = planItemSync([local], [cloud]);
    expect(plan.toPush).toHaveLength(0);
    expect(plan.pulled).toBe(0);
  });

  it('defaults a missing weekdays array to empty', () => {
    const row = { ...itemToRow(citem({ id: 'y' }), 'u'), weekdays: null } as unknown as ItemRow;
    expect(rowToItem(row).weekdays).toEqual([]);
  });
});

describe('planItemSync', () => {
  it('pulls cloud items missing locally', () => {
    const cloud = [citem({ id: 'a' })];
    const plan = planItemSync([], cloud);
    expect(plan.merged.map((i) => i.id)).toEqual(['a']);
    expect(plan.pulled).toBe(1);
    expect(plan.toPush).toHaveLength(0);
  });

  it('pushes local items missing in cloud', () => {
    const local = [citem({ id: 'b' })];
    const plan = planItemSync(local, []);
    expect(plan.toPush.map((i) => i.id)).toEqual(['b']);
    expect(plan.pushed).toBe(1);
  });

  it('keeps the newer side per id (LWW)', () => {
    const local = [citem({ id: 'a', name: 'local-new', updatedAt: '2026-07-14T12:00:00.000Z' })];
    const cloud = [citem({ id: 'a', name: 'cloud-old', updatedAt: '2026-07-14T00:00:00.000Z' })];
    const plan = planItemSync(local, cloud);
    expect(plan.merged[0].name).toBe('local-new');
    expect(plan.toPush).toHaveLength(1);
    expect(plan.pulled).toBe(0);
  });

  it('propagates an archive (delete) as a push when local is newer', () => {
    const local = [citem({ id: 'a', archived: true, archivedOn: '2026-07-15', updatedAt: '2026-07-15T12:00:00.000Z' })];
    const cloud = [citem({ id: 'a', archived: false, updatedAt: '2026-07-15T00:00:00.000Z' })];
    const plan = planItemSync(local, cloud);
    expect(plan.merged[0].archived).toBe(true);
    expect(plan.toPush).toHaveLength(1);
    expect(plan.toPush[0].archived).toBe(true);
  });

  it('does nothing when identical', () => {
    const same = citem({ id: 'a', updatedAt: '2026-07-14T00:00:00.000Z' });
    const plan = planItemSync([same], [{ ...same }]);
    expect(plan.toPush).toHaveLength(0);
    expect(plan.pulled).toBe(0);
  });
});

function ccheck(over: Partial<ChecklistCheck> & { itemId: string; date: string }): ChecklistCheck {
  return { checked: true, updatedAt: '2026-07-15T00:00:00.000Z', ...over };
}

describe('checkToRow / rowToCheck round trip', () => {
  it('maps fields', () => {
    const c = ccheck({ itemId: 'x', date: '2026-07-20', updatedAt: '2026-07-20T09:00:00.000Z' });
    const row = checkToRow(c, 'user-1');
    expect(row.user_id).toBe('user-1');
    expect(row.item_id).toBe('x');
    expect(row.date).toBe('2026-07-20');
    expect(row.checked).toBe(true);
    expect(rowToCheck(row)).toEqual(c);
  });

  it('normalizes Postgres updated_at so a pushed check round-trips as identical', () => {
    const local = ccheck({ itemId: 'x', date: '2026-07-20', updatedAt: '2026-07-20T09:00:00.123Z' });
    const row: CheckRow = {
      ...checkToRow(local, 'u'),
      updated_at: '2026-07-20T09:00:00.123000+00:00',
    };
    const cloud = rowToCheck(row);
    expect(cloud.updatedAt).toBe(local.updatedAt);
    const plan = planCheckSync([local], [cloud]);
    expect(plan.toPush).toHaveLength(0);
    expect(plan.pulled).toBe(0);
  });
});

describe('planCheckSync', () => {
  it('uses itemId+date as the composite key', () => {
    const local = [ccheck({ itemId: 'a', date: '2026-07-20' })];
    const cloud = [ccheck({ itemId: 'a', date: '2026-07-19' })];
    const plan = planCheckSync(local, cloud);
    // 別キーなので両方 merged に残る
    expect(plan.merged).toHaveLength(2);
    expect(plan.toPush.map((c) => c.date)).toEqual(['2026-07-20']);
    expect(plan.pulled).toBe(1);
  });

  it('keeps the newer side per composite key (LWW)', () => {
    const local = [ccheck({ itemId: 'a', date: '2026-07-20', checked: true, updatedAt: '2026-07-20T12:00:00.000Z' })];
    const cloud = [ccheck({ itemId: 'a', date: '2026-07-20', checked: false, updatedAt: '2026-07-20T00:00:00.000Z' })];
    const plan = planCheckSync(local, cloud);
    expect(plan.merged[0].checked).toBe(true);
    expect(plan.toPush).toHaveLength(1);
  });

  it('propagates an uncheck (checked=false) tombstone when local is newer', () => {
    const local = [ccheck({ itemId: 'a', date: '2026-07-20', checked: false, updatedAt: '2026-07-20T12:00:00.000Z' })];
    const cloud = [ccheck({ itemId: 'a', date: '2026-07-20', checked: true, updatedAt: '2026-07-20T00:00:00.000Z' })];
    const plan = planCheckSync(local, cloud);
    expect(plan.merged[0].checked).toBe(false);
    expect(plan.toPush[0].checked).toBe(false);
  });
});
