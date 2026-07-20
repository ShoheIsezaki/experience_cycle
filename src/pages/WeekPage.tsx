import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllItemsRaw, getChecksForDates, getEntriesForDates } from '../db';
import type { ChecklistCheck, ChecklistItem, DailyEntry } from '../types';
import { WEATHER_OPTIONS } from '../types';
import { STEPS } from '../steps';
import { dayProgress } from '../utils/checklist';
import {
  addDays,
  formatShort,
  getWeekDays,
  getWeekStart,
  parseDate,
  todayStr,
} from '../utils/date';

function weatherEmoji(w: DailyEntry['weather']): string {
  if (!w) return '';
  return WEATHER_OPTIONS.find((o) => o.value === w)?.emoji ?? '';
}

function weekRangeLabel(days: string[]): string {
  const first = parseDate(days[0]);
  const last = parseDate(days[6]);
  return `${first.getMonth() + 1}/${first.getDate()} 〜 ${last.getMonth() + 1}/${last.getDate()}`;
}

export default function WeekPage() {
  const today = todayStr();
  const [cursor, setCursor] = useState(today);
  const [entries, setEntries] = useState<Map<string, DailyEntry>>(new Map());
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [checks, setChecks] = useState<ChecklistCheck[]>([]);
  const navigate = useNavigate();

  const days = useMemo(() => getWeekDays(cursor), [cursor]);

  useEffect(() => {
    let active = true;
    getEntriesForDates(days).then((m) => {
      if (active) setEntries(m);
    });
    Promise.all([getAllItemsRaw(), getChecksForDates(days)]).then(([its, cks]) => {
      if (active) {
        setItems(its);
        setChecks(cks);
      }
    });
    return () => {
      active = false;
    };
  }, [days]);

  const isThisWeek = getWeekStart(cursor) === getWeekStart(today);

  return (
    <div className="page week-page">
      <header className="month-nav">
        <button
          type="button"
          className="month-nav__btn"
          aria-label="前週"
          onClick={() => setCursor(addDays(cursor, -7))}
        >
          ‹
        </button>
        <button
          type="button"
          className="month-nav__title"
          onClick={() => setCursor(today)}
          title="今週へ"
        >
          {weekRangeLabel(days)}
          {isThisWeek && <span className="month-nav__badge">今週</span>}
        </button>
        <button
          type="button"
          className="month-nav__btn"
          aria-label="翌週"
          onClick={() => setCursor(addDays(cursor, 7))}
        >
          ›
        </button>
      </header>

      <ul className="week-list">
        {days.map((d) => {
          const entry = entries.get(d);
          const isToday = d === today;
          const hasContent = !!entry;
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
            <li key={d}>
              <button
                type="button"
                className={
                  'week-day' + (hasContent ? '' : ' is-empty') + (isToday ? ' is-today' : '')
                }
                onClick={() => navigate(`/record/${d}`)}
              >
                <div className="week-day__head">
                  <span className="week-day__date">{formatShort(d)}</span>
                  <span className="week-day__head-right">
                    {prog.total > 0 && (
                      <span className={'day-badge' + progClass}>
                        {prog.done}/{prog.total}
                      </span>
                    )}
                    <span className="week-day__weather" aria-hidden="true">
                      {weatherEmoji(entry?.weather)}
                    </span>
                  </span>
                </div>
                {entry ? (
                  <div className="week-day__fields">
                    {STEPS.map((step) => {
                      const text = entry[step.field].trim();
                      if (!text) return null;
                      return (
                        <p key={step.field} className="week-day__field">
                          <span className="week-day__field-title">
                            {step.icon} {step.title}
                          </span>
                          <span className="week-day__field-text">{text}</span>
                        </p>
                      );
                    })}
                    {STEPS.every((s) => entry[s.field].trim() === '') && (
                      <p className="week-day__note">天気のみ記録</p>
                    )}
                  </div>
                ) : (
                  <p className="week-day__note">記録なし</p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
