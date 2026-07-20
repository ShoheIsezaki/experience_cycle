import { useEffect, useMemo, useState } from 'react';
import { getAllItemsRaw, getChecksForDates, getEntriesForDates, getThemes } from '../db';
import type { ChecklistCheck, ChecklistItem, DailyEntry } from '../types';
import { WEATHER_OPTIONS } from '../types';
import {
  addMonths,
  formatMonth,
  getMonth,
  getMonthGrid,
  getYear,
  todayStr,
} from '../utils/date';
import { groupThemeSpans } from '../utils/theme';
import { dayProgress } from '../utils/checklist';
import EntrySheet from '../components/EntrySheet';

const WEEK_HEADERS = ['月', '火', '水', '木', '金', '土', '日'];

function weatherEmoji(w: DailyEntry['weather']): string {
  if (!w) return '';
  return WEATHER_OPTIONS.find((o) => o.value === w)?.emoji ?? '';
}

export default function CalendarPage() {
  const today = todayStr();
  const [cursor, setCursor] = useState(today);
  const [entries, setEntries] = useState<Map<string, DailyEntry>>(new Map());
  const [themes, setThemes] = useState<Map<number, string>>(new Map());
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [checks, setChecks] = useState<ChecklistCheck[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const year = getYear(cursor);
  const month = getMonth(cursor);
  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  useEffect(() => {
    const dates = grid.flat();
    let active = true;
    getEntriesForDates(dates).then((m) => {
      if (active) setEntries(m);
    });
    Promise.all([getAllItemsRaw(), getChecksForDates(dates)]).then(([its, cks]) => {
      if (active) {
        setItems(its);
        setChecks(cks);
      }
    });
    return () => {
      active = false;
    };
  }, [grid]);

  useEffect(() => {
    let active = true;
    getThemes().then((m) => {
      if (active) setThemes(m);
    });
    return () => {
      active = false;
    };
  }, []);

  const themeSpans = useMemo(() => groupThemeSpans(themes), [themes]);
  const hasTheme = useMemo(() => [...themes.values()].some((t) => t.trim() !== ''), [themes]);

  const selectedEntry = selected ? entries.get(selected) : undefined;

  return (
    <div className="page calendar-page">
      <header className="month-nav">
        <button
          type="button"
          className="month-nav__btn"
          aria-label="前月"
          onClick={() => setCursor(addMonths(cursor, -1))}
        >
          ‹
        </button>
        <button
          type="button"
          className="month-nav__title"
          onClick={() => setCursor(today)}
          title="今月へ"
        >
          {formatMonth(year, month)}
        </button>
        <button
          type="button"
          className="month-nav__btn"
          aria-label="翌月"
          onClick={() => setCursor(addMonths(cursor, 1))}
        >
          ›
        </button>
      </header>

      <div className="calendar-grid calendar-grid--head">
        {WEEK_HEADERS.map((w) => (
          <div key={w} className="calendar-head-cell">
            {w}
          </div>
        ))}
      </div>

      {hasTheme && (
        <div className="calendar-grid calendar-theme-band" aria-label="曜日テーマ">
          {themeSpans.map((s) => (
            <div
              key={s.start}
              className={'theme-band-cell' + (s.theme ? ' has-theme' : '')}
              style={{ gridColumn: `span ${s.span}` }}
              title={s.theme || undefined}
            >
              {s.theme && <span className="theme-band-cell__label">{s.theme}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="calendar-grid">
        {grid.flat().map((d) => {
          const inMonth = getMonth(d) === month;
          const entry = entries.get(d);
          const isToday = d === today;
          const dayNum = Number(d.slice(8, 10));
          const prog = dayProgress(items, checks, d);
          const progClass =
            prog.total === 0
              ? ''
              : prog.done >= prog.total
                ? ' is-full'
                : prog.done > 0
                  ? ' is-part'
                  : ' is-zero';
          return (
            <button
              key={d}
              type="button"
              className={
                'calendar-cell' +
                (inMonth ? '' : ' is-outside') +
                (isToday ? ' is-today' : '') +
                (entry ? ' has-entry' : '')
              }
              onClick={() => setSelected(d)}
            >
              <span className="calendar-cell__num">{dayNum}</span>
              <span className="calendar-cell__weather" aria-hidden="true">
                {weatherEmoji(entry?.weather)}
              </span>
              {prog.total > 0 && (
                <span className={'calendar-cell__prog' + progClass}>
                  {prog.done}/{prog.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <EntrySheet
          date={selected}
          entry={selectedEntry}
          items={items}
          checks={checks}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
