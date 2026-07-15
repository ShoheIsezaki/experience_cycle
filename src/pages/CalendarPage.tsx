import { useEffect, useMemo, useState } from 'react';
import { getEntriesForDates } from '../db';
import type { DailyEntry } from '../types';
import { WEATHER_OPTIONS } from '../types';
import {
  addMonths,
  formatMonth,
  getMonth,
  getMonthGrid,
  getYear,
  todayStr,
} from '../utils/date';
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
    return () => {
      active = false;
    };
  }, [grid]);

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

      <div className="calendar-grid">
        {grid.flat().map((d) => {
          const inMonth = getMonth(d) === month;
          const entry = entries.get(d);
          const isToday = d === today;
          const dayNum = Number(d.slice(8, 10));
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
            </button>
          );
        })}
      </div>

      {selected && (
        <EntrySheet
          date={selected}
          entry={selectedEntry}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
