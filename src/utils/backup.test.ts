import { describe, expect, it } from 'vitest';
import {
  mergeEntries,
  normalizeEntry,
  parseBackup,
  serializeBackup,
} from './backup';
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

describe('serializeBackup', () => {
  it('produces valid JSON with metadata and sorted entries', () => {
    const json = serializeBackup(
      [entry({ date: '2026-07-16' }), entry({ date: '2026-07-14' })],
      new Date('2026-07-15T10:00:00.000Z'),
    );
    const parsed = JSON.parse(json);
    expect(parsed.app).toBe('experience_cycle');
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBe('2026-07-15T10:00:00.000Z');
    expect(parsed.entries.map((e: DailyEntry) => e.date)).toEqual([
      '2026-07-14',
      '2026-07-16',
    ]);
  });
});

describe('serialize -> parse round trip', () => {
  it('preserves entries', () => {
    const entries = [
      entry({ date: '2026-07-15', weather: 2, experience: 'コード書いた' }),
      entry({ date: '2026-07-16', lesson: '学び' }),
    ];
    const json = serializeBackup(entries);
    const back = parseBackup(json);
    expect(back).toHaveLength(2);
    expect(back[0].experience).toBe('コード書いた');
    expect(back[0].weather).toBe(2);
    expect(back[1].lesson).toBe('学び');
  });
});

describe('parseBackup', () => {
  it('accepts a bare array of entries', () => {
    const json = JSON.stringify([entry({ date: '2026-07-15' })]);
    expect(parseBackup(json)).toHaveLength(1);
  });

  it('skips invalid entries but keeps valid ones', () => {
    const json = JSON.stringify({
      entries: [
        entry({ date: '2026-07-15' }),
        { date: 'not-a-date' },
        { nope: true },
        entry({ date: '2026-07-16' }),
      ],
    });
    const back = parseBackup(json);
    expect(back.map((e) => e.date)).toEqual(['2026-07-15', '2026-07-16']);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseBackup('{ broken')).toThrow();
  });

  it('throws on unsupported shape', () => {
    expect(() => parseBackup(JSON.stringify({ foo: 'bar' }))).toThrow();
  });
});

describe('normalizeEntry', () => {
  it('drops invalid weather to undefined', () => {
    const n = normalizeEntry({ date: '2026-07-15', weather: 9 });
    expect(n?.weather).toBeUndefined();
  });

  it('keeps valid weather', () => {
    expect(normalizeEntry({ date: '2026-07-15', weather: 3 })?.weather).toBe(3);
  });

  it('coerces missing text fields to empty strings', () => {
    const n = normalizeEntry({ date: '2026-07-15' });
    expect(n).not.toBeNull();
    expect(n?.experience).toBe('');
    expect(n?.nextAction).toBe('');
  });

  it('returns null for non-objects and bad dates', () => {
    expect(normalizeEntry(null)).toBeNull();
    expect(normalizeEntry('x')).toBeNull();
    expect(normalizeEntry({ date: '2026/07/15' })).toBeNull();
  });
});

describe('mergeEntries', () => {
  const existing = [
    entry({ date: '2026-07-14', experience: 'old14', updatedAt: '2026-07-14T00:00:00.000Z' }),
    entry({ date: '2026-07-15', experience: 'old15', updatedAt: '2026-07-15T00:00:00.000Z' }),
  ];

  it('overwrite replaces everything with incoming', () => {
    const incoming = [entry({ date: '2026-07-16', experience: 'new16' })];
    const merged = mergeEntries(existing, incoming, 'overwrite');
    expect(merged).toHaveLength(1);
    expect(merged[0].date).toBe('2026-07-16');
  });

  it('merge keeps newer updatedAt per date', () => {
    const incoming = [
      // newer than existing -> should win
      entry({ date: '2026-07-15', experience: 'new15', updatedAt: '2026-07-15T12:00:00.000Z' }),
      // older than existing -> should lose
      entry({ date: '2026-07-14', experience: 'stale14', updatedAt: '2026-07-13T00:00:00.000Z' }),
      // brand new date -> added
      entry({ date: '2026-07-16', experience: 'new16' }),
    ];
    const merged = mergeEntries(existing, incoming, 'merge');
    const byDate = Object.fromEntries(merged.map((e) => [e.date, e.experience]));
    expect(byDate['2026-07-15']).toBe('new15');
    expect(byDate['2026-07-14']).toBe('old14');
    expect(byDate['2026-07-16']).toBe('new16');
    expect(merged).toHaveLength(3);
  });

  it('merge returns entries sorted by date', () => {
    const incoming = [entry({ date: '2026-07-10' })];
    const merged = mergeEntries(existing, incoming, 'merge');
    expect(merged.map((e) => e.date)).toEqual(['2026-07-10', '2026-07-14', '2026-07-15']);
  });
});
