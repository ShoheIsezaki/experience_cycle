import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAllChecksRaw, getAllItemsRaw, setCheck } from '../db';
import type { ChecklistCheck, ChecklistItem } from '../types';
import { addDays, formatDisplay, todayStr } from '../utils/date';
import { activeItemsOn, calcStreak, dayProgress, isChecked } from '../utils/checklist';

const WEEKDAY_TIME_ICONS = ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'];

/** "HH:MM" → だいたいの時計絵文字（見た目の遊び。無ければ🕐）。 */
function clockIcon(time: string): string {
  const h = Number(time.slice(0, 2));
  if (Number.isNaN(h)) return '🕐';
  return WEEKDAY_TIME_ICONS[h % 12] ?? '🕐';
}

export default function CheckPage() {
  const { date: paramDate } = useParams();
  const navigate = useNavigate();
  const today = todayStr();
  const date = paramDate ?? today;
  const isToday = date === today;

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [checks, setChecks] = useState<ChecklistCheck[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    const [its, cks] = await Promise.all([getAllItemsRaw(), getAllChecksRaw()]);
    setItems(its);
    setChecks(cks);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let active = true;
    void reload().catch(() => {
      if (active) setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [reload]);

  const dayItems = useMemo(() => activeItemsOn(items, date), [items, date]);
  const progress = useMemo(() => dayProgress(items, checks, date), [items, checks, date]);
  const streak = useMemo(() => calcStreak(items, checks, today), [items, checks, today]);

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const toggle = async (itemId: string) => {
    const next = !isChecked(checks, itemId, date);
    // 楽観的更新: ローカル state を即反映してから永続化
    setChecks((prev) => {
      const rest = prev.filter((c) => !(c.itemId === itemId && c.date === date));
      return [...rest, { itemId, date, checked: next, updatedAt: new Date().toISOString() }];
    });
    await setCheck(itemId, date, next);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const statusText = (): string => {
    if (progress.total === 0) return '今日のタスクはありません';
    if (progress.done >= progress.total) return '今日は全部完了！🎉';
    return `あと${progress.total - progress.done}つで全部完了！`;
  };

  return (
    <div className="page check-page">
      <header className="record-header">
        <div className="date-nav">
          <button
            type="button"
            className="date-nav__btn"
            aria-label="前日"
            onClick={() => navigate(`/check/${addDays(date, -1)}`)}
          >
            ‹
          </button>
          <label className="date-nav__center">
            <span className="date-nav__display">{formatDisplay(date)}</span>
            <input
              type="date"
              className="date-nav__input"
              value={date}
              onChange={(e) => e.target.value && navigate(`/check/${e.target.value}`)}
              aria-label="日付を選択"
            />
            {isToday && <span className="date-nav__today">今日</span>}
          </label>
          <button
            type="button"
            className="date-nav__btn"
            aria-label="翌日"
            onClick={() => navigate(`/check/${addDays(date, 1)}`)}
          >
            ›
          </button>
        </div>
      </header>

      <div className="progress-card">
        <div
          className="progress-card__ring"
          style={{
            background: `conic-gradient(#fff 0 ${pct}%, rgba(255,255,255,.25) ${pct}% 100%)`,
          }}
          aria-hidden="true"
        >
          <div className="progress-card__ring-inner">
            {progress.done}/{progress.total}
          </div>
        </div>
        <div className="progress-card__txt">
          <b>{statusText()}</b>
          {streak >= 2 && <span>🔥 {streak}日連続で全達成中</span>}
        </div>
      </div>

      {loaded && dayItems.length === 0 ? (
        <div className="check-empty">
          <p className="check-empty__msg">この日のチェックリストはありません。</p>
          <button
            type="button"
            className="check-empty__add"
            onClick={() => navigate('/check/manage')}
          >
            ＋ タスクを追加
          </button>
        </div>
      ) : (
        <ul className="task-list" aria-busy={!loaded}>
          {dayItems.map((it) => {
            const done = isChecked(checks, it.id, date);
            const isOpen = expanded.has(it.id);
            return (
              <li key={it.id} className={'task' + (done ? ' is-done' : '')}>
                <button
                  type="button"
                  className={'task__check' + (done ? ' is-on' : '')}
                  aria-pressed={done}
                  aria-label={done ? `${it.name} を未完了にする` : `${it.name} を完了にする`}
                  onClick={() => toggle(it.id)}
                >
                  {done ? '✓' : ''}
                </button>
                <div className="task__body">
                  <div className="task__name">{it.name}</div>
                  {(it.time || it.url) && (
                    <div className="task__meta">
                      {it.time && (
                        <span className="chip chip--time">
                          {clockIcon(it.time)} {it.time}
                        </span>
                      )}
                      {it.url && (
                        <a
                          className="chip chip--link"
                          href={it.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          🔗 参考リンク
                        </a>
                      )}
                    </div>
                  )}
                  {it.memo && (
                    <p
                      className={'task__memo' + (isOpen ? ' is-open' : '')}
                      onClick={() => toggleExpand(it.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleExpand(it.id);
                        }
                      }}
                    >
                      {it.memo}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" className="edit-link" onClick={() => navigate('/check/manage')}>
        ＋ チェックリストを編集
      </button>
    </div>
  );
}
