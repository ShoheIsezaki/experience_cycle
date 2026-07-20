import { describe, expect, it } from 'vitest';
import { groupThemeSpans } from './theme';

/** weekday→theme の Map を作るヘルパ（0=月..6=日） */
function themes(entries: Array<[number, string]>): Map<number, string> {
  return new Map(entries);
}

describe('groupThemeSpans', () => {
  it('merges adjacent identical themes and keeps empty gaps (spec example)', () => {
    // 月火=A, 水=空, 木金土=B, 日=A
    const m = themes([
      [0, 'A'],
      [1, 'A'],
      [3, 'B'],
      [4, 'B'],
      [5, 'B'],
      [6, 'A'],
    ]);
    expect(groupThemeSpans(m)).toEqual([
      { theme: 'A', start: 0, span: 2 },
      { theme: '', start: 2, span: 1 },
      { theme: 'B', start: 3, span: 3 },
      { theme: 'A', start: 6, span: 1 },
    ]);
  });

  it('returns a single empty span when nothing is set', () => {
    expect(groupThemeSpans(new Map())).toEqual([{ theme: '', start: 0, span: 7 }]);
  });

  it('merges all seven days when every day shares a theme', () => {
    const m = themes([0, 1, 2, 3, 4, 5, 6].map((wd) => [wd, '傾聴'] as [number, string]));
    expect(groupThemeSpans(m)).toEqual([{ theme: '傾聴', start: 0, span: 7 }]);
  });

  it('does not merge distinct themes and total span is always 7', () => {
    const m = themes([
      [0, 'A'],
      [1, 'B'],
      [2, 'A'],
    ]);
    const spans = groupThemeSpans(m);
    expect(spans).toEqual([
      { theme: 'A', start: 0, span: 1 },
      { theme: 'B', start: 1, span: 1 },
      { theme: 'A', start: 2, span: 1 },
      { theme: '', start: 3, span: 4 },
    ]);
    expect(spans.reduce((s, x) => s + x.span, 0)).toBe(7);
  });

  it('trims themes and merges values that are equal after trimming', () => {
    const m = themes([
      [0, ' A '],
      [1, 'A'],
      [2, '   '],
    ]);
    expect(groupThemeSpans(m)).toEqual([
      { theme: 'A', start: 0, span: 2 },
      { theme: '', start: 2, span: 5 },
    ]);
  });
});
