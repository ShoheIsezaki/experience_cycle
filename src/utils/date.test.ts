import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  daysInMonth,
  formatDate,
  formatDisplay,
  getMonthGrid,
  getWeekDays,
  getWeekStart,
  parseDate,
  weekdayJa,
} from './date';

describe('formatDate / parseDate', () => {
  it('formats a Date to YYYY-MM-DD (local)', () => {
    expect(formatDate(new Date(2026, 6, 15))).toBe('2026-07-15');
    expect(formatDate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(formatDate(new Date(2026, 11, 9))).toBe('2026-12-09');
  });

  it('round-trips through parseDate', () => {
    const s = '2026-02-28';
    expect(formatDate(parseDate(s))).toBe(s);
  });

  it('parseDate builds a local midnight date', () => {
    const d = parseDate('2026-07-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });
});

describe('addDays', () => {
  it('adds and subtracts days', () => {
    expect(addDays('2026-07-15', 1)).toBe('2026-07-16');
    expect(addDays('2026-07-15', -1)).toBe('2026-07-14');
  });

  it('crosses month boundaries', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
  });

  it('crosses year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles leap year', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });
});

describe('addMonths', () => {
  it('adds months', () => {
    expect(addMonths('2026-07-15', 1)).toBe('2026-08-15');
    expect(addMonths('2026-07-15', -1)).toBe('2026-06-15');
  });

  it('clamps to month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29'); // leap
  });

  it('crosses years', () => {
    expect(addMonths('2026-12-10', 1)).toBe('2027-01-10');
  });
});

describe('daysInMonth', () => {
  it('returns correct counts', () => {
    expect(daysInMonth(2026, 1)).toBe(28); // Feb 2026
    expect(daysInMonth(2028, 1)).toBe(29); // Feb 2028 leap
    expect(daysInMonth(2026, 6)).toBe(31); // Jul
    expect(daysInMonth(2026, 3)).toBe(30); // Apr
  });
});

describe('weekdayJa', () => {
  it('returns Japanese weekday', () => {
    expect(weekdayJa('2026-07-15')).toBe('水');
    expect(weekdayJa('2026-07-13')).toBe('月');
    expect(weekdayJa('2026-07-19')).toBe('日');
  });
});

describe('getWeekStart (Monday start)', () => {
  it('returns the Monday of the week', () => {
    expect(getWeekStart('2026-07-15')).toBe('2026-07-13'); // Wed -> Mon
    expect(getWeekStart('2026-07-13')).toBe('2026-07-13'); // Mon -> Mon
    expect(getWeekStart('2026-07-19')).toBe('2026-07-13'); // Sun -> prev Mon
  });

  it('always lands on a Monday', () => {
    for (let i = 0; i < 30; i++) {
      const start = getWeekStart(addDays('2026-01-01', i));
      expect(parseDate(start).getDay()).toBe(1);
    }
  });
});

describe('getWeekDays', () => {
  it('returns 7 consecutive days from Monday', () => {
    const days = getWeekDays('2026-07-15');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-07-13');
    expect(days[6]).toBe('2026-07-19');
    for (let i = 1; i < days.length; i++) {
      expect(days[i]).toBe(addDays(days[i - 1], 1));
    }
  });
});

describe('getMonthGrid', () => {
  it('returns a 6x7 grid starting on Monday and containing the 1st', () => {
    const grid = getMonthGrid(2026, 6); // July 2026
    expect(grid).toHaveLength(6);
    grid.forEach((w) => expect(w).toHaveLength(7));
    expect(parseDate(grid[0][0]).getDay()).toBe(1); // Monday
    expect(grid.flat()).toContain('2026-07-01');
    expect(grid.flat()).toContain('2026-07-31');
  });

  it('first row includes leading days of previous month when needed', () => {
    // July 1 2026 is Wednesday, so grid starts Mon Jun 29
    const grid = getMonthGrid(2026, 6);
    expect(grid[0][0]).toBe('2026-06-29');
  });
});

describe('formatDisplay', () => {
  it('formats a human readable Japanese date', () => {
    expect(formatDisplay('2026-07-15')).toBe('2026年7月15日（水）');
  });
});
