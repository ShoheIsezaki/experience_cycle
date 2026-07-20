import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import WeatherPicker from '../components/WeatherPicker';
import { STEPS, type StepField } from '../steps';
import { emptyEntry, getEntry, getThemes, saveEntry } from '../db';
import type { DailyEntry, Weather } from '../types';
import { addDays, formatDisplay, themeWeekdayIndex, todayStr } from '../utils/date';

type SaveStatus = 'idle' | 'saving' | 'saved';

export default function RecordPage() {
  const { date: paramDate } = useParams();
  const navigate = useNavigate();
  const date = paramDate ?? todayStr();
  const isToday = date === todayStr();

  const [entry, setEntry] = useState<DailyEntry>(() => emptyEntry(date));
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [loaded, setLoaded] = useState(false);
  const [dayTheme, setDayTheme] = useState<string>('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // デバウンス待ちの未保存エントリ。保存が確定したら null に戻す
  const pendingRef = useRef<DailyEntry | null>(null);

  // 日付が変わったらDBから読み込む
  useEffect(() => {
    let active = true;
    setLoaded(false);
    getEntry(date).then((existing) => {
      if (!active) return;
      setEntry(existing ?? emptyEntry(date));
      setStatus('idle');
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [date]);

  // その日の曜日テーマを読み込む（設定変更後に戻ってきた場合も反映）
  useEffect(() => {
    let active = true;
    getThemes().then((themes) => {
      if (active) setDayTheme(themes.get(themeWeekdayIndex(date)) ?? '');
    });
    return () => {
      active = false;
    };
  }, [date]);

  const flushSave = useCallback(async (next: DailyEntry) => {
    pendingRef.current = null;
    setStatus('saving');
    await saveEntry(next);
    setStatus('saved');
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setStatus('idle'), 1800);
  }, []);

  const scheduleSave = useCallback(
    (next: DailyEntry) => {
      pendingRef.current = next;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void flushSave(next);
      }, 700);
    },
    [flushSave],
  );

  // アンマウント時・アプリ終了（pagehide）時に保留中の保存を確定する。
  // アンマウント後は setState できないため saveEntry を直接呼ぶ
  useEffect(() => {
    const flushPending = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const pending = pendingRef.current;
      if (pending) {
        pendingRef.current = null;
        void saveEntry(pending);
      }
    };
    window.addEventListener('pagehide', flushPending);
    return () => {
      window.removeEventListener('pagehide', flushPending);
      flushPending();
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const update = useCallback(
    (patch: Partial<DailyEntry>) => {
      setEntry((prev) => {
        const next = { ...prev, ...patch };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const handleText = (field: StepField, value: string) => {
    update({ [field]: value } as Partial<DailyEntry>);
  };

  const handleWeather = (w: Weather | undefined) => {
    update({ weather: w });
  };

  const goDate = (target: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (pendingRef.current) {
      void flushSave(pendingRef.current);
    }
    navigate(`/record/${target}`);
  };

  return (
    <div className="page record-page">
      <header className="record-header">
        <div className="date-nav">
          <button
            type="button"
            className="date-nav__btn"
            aria-label="前日"
            onClick={() => goDate(addDays(date, -1))}
          >
            ‹
          </button>
          <label className="date-nav__center">
            <span className="date-nav__display">{formatDisplay(date)}</span>
            <input
              type="date"
              className="date-nav__input"
              value={date}
              onChange={(e) => e.target.value && goDate(e.target.value)}
              aria-label="日付を選択"
            />
            {isToday && <span className="date-nav__today">今日</span>}
          </label>
          <button
            type="button"
            className="date-nav__btn"
            aria-label="翌日"
            onClick={() => goDate(addDays(date, 1))}
          >
            ›
          </button>
        </div>
      </header>

      {dayTheme && (
        <p className="record-theme">
          🎯 「{dayTheme}」についての振り返り
        </p>
      )}

      <section className="record-weather">
        <p className="section-label">今日の学習状態</p>
        <WeatherPicker value={entry.weather} onChange={handleWeather} />
      </section>

      <div className="steps" aria-busy={!loaded}>
        {STEPS.map((step) => (
          <section key={step.field} className="step-card">
            <label className="step-card__label" htmlFor={`field-${step.field}`}>
              <span className="step-card__no" aria-hidden="true">
                {step.icon}
              </span>
              <span className="step-card__titles">
                <span className="step-card__title">
                  {step.no}. {step.title}
                </span>
                <span className="step-card__subtitle">{step.subtitle}</span>
              </span>
            </label>
            <textarea
              id={`field-${step.field}`}
              className="step-card__textarea"
              value={entry[step.field]}
              placeholder={step.placeholder}
              onChange={(e) => handleText(step.field, e.target.value)}
              rows={3}
            />
          </section>
        ))}
      </div>

      <div className="save-status" role="status" aria-live="polite">
        {status === 'saving' && <span className="save-status__saving">保存中…</span>}
        {status === 'saved' && <span className="save-status__saved">✓ 保存しました</span>}
        {status === 'idle' && <span className="save-status__hint">入力すると自動で保存されます</span>}
      </div>
    </div>
  );
}
