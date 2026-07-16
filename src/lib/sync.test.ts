import { describe, expect, it } from 'vitest';
import { entryToRow, rowToEntry, planSync, normalizeIso, type EntryRow } from './sync';
import type { DailyEntry } from '../types';

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
