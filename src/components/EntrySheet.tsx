import { useNavigate } from 'react-router-dom';
import type { ChecklistCheck, ChecklistItem, DailyEntry } from '../types';
import { WEATHER_OPTIONS } from '../types';
import { STEPS } from '../steps';
import { formatDisplay } from '../utils/date';
import { activeItemsOn, isChecked } from '../utils/checklist';

interface Props {
  date: string;
  entry: DailyEntry | undefined;
  items: ChecklistItem[];
  checks: ChecklistCheck[];
  onClose: () => void;
}

/** カレンダーから日をタップした時に開く下部シート。内容表示＋編集導線。 */
export default function EntrySheet({ date, entry, items, checks, onClose }: Props) {
  const navigate = useNavigate();
  const weather = entry?.weather
    ? WEATHER_OPTIONS.find((o) => o.value === entry.weather)
    : undefined;

  const dayItems = activeItemsOn(items, date);

  const goEdit = () => navigate(`/record/${date}`);

  return (
    <div className="sheet-overlay" onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${formatDisplay(date)}の記録`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__handle" aria-hidden="true" />
        <header className="sheet__header">
          <div>
            <h2 className="sheet__title">{formatDisplay(date)}</h2>
            {weather && (
              <p className="sheet__weather">
                {weather.emoji} {weather.label}
              </p>
            )}
          </div>
          <button type="button" className="sheet__close" aria-label="閉じる" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="sheet__body">
          {!entry ? (
            <p className="sheet__empty">この日の記録はまだありません。</p>
          ) : (
            STEPS.map((step) => {
              const text = entry[step.field].trim();
              return (
                <div key={step.field} className="sheet__item">
                  <p className="sheet__item-title">
                    {step.icon} {step.no}. {step.title}
                  </p>
                  {text ? (
                    <p className="sheet__item-text">{text}</p>
                  ) : (
                    <p className="sheet__item-text is-empty">（記入なし）</p>
                  )}
                </div>
              );
            })
          )}

          {dayItems.length > 0 && (
            <div className="sheet__checklist">
              <p className="sheet__item-title">✅ チェック</p>
              <ul className="sheet__check-list">
                {dayItems.map((it) => {
                  const done = isChecked(checks, it.id, date);
                  return (
                    <li
                      key={it.id}
                      className={'sheet__check-row' + (done ? ' is-done' : '')}
                    >
                      <span className="sheet__check-mark" aria-hidden="true">
                        {done ? '✓' : '○'}
                      </span>
                      <span className="sheet__check-name">{it.name}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <button type="button" className="sheet__edit-btn" onClick={goEdit}>
          {entry ? 'この日を編集' : 'この日を記録する'}
        </button>
      </div>
    </div>
  );
}
