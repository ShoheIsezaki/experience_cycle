import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { archiveItem, getActiveItems, saveItem } from '../db';
import type { ChecklistItem } from '../types';
import { WEEKDAY_LABELS } from '../types';
import { sortItems } from '../utils/checklist';
import { todayStr } from '../utils/date';

const MEMO_MAX = 1000;

const PRESETS: { label: string; days: number[] }[] = [
  { label: '毎日', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: '平日', days: [0, 1, 2, 3, 4] },
  { label: '週末', days: [5, 6] },
];

interface Draft {
  id: string;
  name: string;
  url: string;
  memo: string;
  time: string;
  weekdays: number[];
  createdOn: string;
  archived: boolean;
  archivedOn: string | null;
  updatedAt: string;
}

function newDraft(today: string): Draft {
  return {
    id: crypto.randomUUID(),
    name: '',
    url: '',
    memo: '',
    time: '',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    createdOn: today,
    archived: false,
    archivedOn: null,
    updatedAt: '',
  };
}

function toDraft(item: ChecklistItem): Draft {
  return { ...item };
}

function sameWeekdays(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export default function ChecklistManagePage() {
  const navigate = useNavigate();
  const today = todayStr();

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [original, setOriginal] = useState<Draft | null>(null);

  const reload = useCallback(async () => {
    setItems(await getActiveItems());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sorted = useMemo(() => sortItems(items), [items]);

  const startNew = () => {
    const d = newDraft(today);
    setDraft(d);
    setOriginal(d);
    setIsNew(true);
  };

  const startEdit = (item: ChecklistItem) => {
    const d = toDraft(item);
    setDraft(d);
    setOriginal(d);
    setIsNew(false);
  };

  const isDirty = (): boolean => {
    if (!draft || !original) return false;
    return (
      draft.name !== original.name ||
      draft.url !== original.url ||
      draft.memo !== original.memo ||
      draft.time !== original.time ||
      !sameWeekdays(draft.weekdays, original.weekdays)
    );
  };

  const closeForm = () => {
    setDraft(null);
    setOriginal(null);
    setIsNew(false);
  };

  const cancel = () => {
    if (isDirty() && !window.confirm('変更を破棄して戻りますか？')) return;
    closeForm();
  };

  const save = async () => {
    if (!draft) return;
    if (draft.name.trim() === '') {
      window.alert('タスク名を入力してください。');
      return;
    }
    const item: ChecklistItem = {
      id: draft.id,
      name: draft.name.trim(),
      url: draft.url.trim(),
      memo: draft.memo,
      time: draft.time,
      weekdays: [...draft.weekdays].sort((a, b) => a - b),
      archived: draft.archived,
      createdOn: draft.createdOn,
      archivedOn: draft.archivedOn,
      updatedAt: draft.updatedAt,
    };
    await saveItem(item);
    await reload();
    closeForm();
  };

  const remove = async () => {
    if (!draft || isNew) return;
    if (!window.confirm(`「${draft.name}」を削除しますか？（履歴は残ります）`)) return;
    await archiveItem(draft.id, today);
    await reload();
    closeForm();
  };

  // 既存タスクを元に未保存のコピーを作り、新規作成モードに切り替える。
  // 保存するまでDBには書き込まれない（時刻だけ変えて保存する使い方を想定）。
  const duplicate = () => {
    if (!draft || isNew) return;
    const copy: Draft = {
      ...draft,
      id: crypto.randomUUID(),
      createdOn: today,
      archived: false,
      archivedOn: null,
      updatedAt: '',
    };
    setDraft(copy);
    // 比較元を空の新規ドラフトにして、保存せず戻る際は必ず破棄confirmを出す
    setOriginal(newDraft(today));
    setIsNew(true);
  };

  const toggleWeekday = (wd: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const has = prev.weekdays.includes(wd);
      const weekdays = has ? prev.weekdays.filter((w) => w !== wd) : [...prev.weekdays, wd];
      return { ...prev, weekdays };
    });
  };

  // ---- 編集フォーム ----
  if (draft) {
    return (
      <div className="page manage-page">
        <header className="record-header">
          <div className="date-nav">
            <button type="button" className="date-nav__btn" aria-label="戻る" onClick={cancel}>
              ‹
            </button>
            <div className="date-nav__center">
              <span className="date-nav__display">{isNew ? '新しいタスク' : 'タスクを編集'}</span>
            </div>
            <span className="date-nav__btn date-nav__btn--spacer" aria-hidden="true" />
          </div>
        </header>

        <div className="form-sheet">
          <div className="form-field">
            <label className="form-field__label" htmlFor="task-name">
              名前 <span className="form-field__req">*</span>
            </label>
            <input
              id="task-name"
              className="form-field__input"
              type="text"
              value={draft.name}
              placeholder="例: 英語シャドーイング10分"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label className="form-field__label" htmlFor="task-time">
              目安の時間
            </label>
            <input
              id="task-time"
              className="form-field__input"
              type="time"
              value={draft.time}
              onChange={(e) => setDraft({ ...draft, time: e.target.value })}
            />
            <p className="form-field__hint">この時刻にDiscordへアラートを送ります（任意）</p>
          </div>

          <div className="form-field">
            <span className="form-field__label">オンにする曜日</span>
            <div className="weekday-chips">
              {WEEKDAY_LABELS.map((label, wd) => (
                <button
                  key={wd}
                  type="button"
                  className={'weekday-chip' + (draft.weekdays.includes(wd) ? ' is-on' : '')}
                  aria-pressed={draft.weekdays.includes(wd)}
                  onClick={() => toggleWeekday(wd)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="weekday-presets">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="weekday-preset"
                  onClick={() => setDraft({ ...draft, weekdays: [...p.days] })}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label className="form-field__label" htmlFor="task-url">
              参考リンク（任意）
            </label>
            <input
              id="task-url"
              className="form-field__input"
              type="url"
              inputMode="url"
              value={draft.url}
              placeholder="https://..."
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label className="form-field__label" htmlFor="task-memo">
              メモ（任意）
            </label>
            <textarea
              id="task-memo"
              className="form-field__textarea"
              value={draft.memo}
              maxLength={MEMO_MAX}
              rows={4}
              placeholder="やり方やコツなど"
              onChange={(e) => setDraft({ ...draft, memo: e.target.value.slice(0, MEMO_MAX) })}
            />
            <p className="form-field__counter">
              {draft.memo.length} / {MEMO_MAX}
            </p>
          </div>

          {!isNew && (
            <button type="button" className="form-btn form-btn--copy" onClick={duplicate}>
              ⧉ コピーして新規作成
            </button>
          )}

          <div className="form-actions">
            {!isNew && (
              <button type="button" className="form-btn form-btn--danger" onClick={remove}>
                削除
              </button>
            )}
            <button type="button" className="form-btn form-btn--primary" onClick={save}>
              保存
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- 一覧 ----
  return (
    <div className="page manage-page">
      <header className="record-header">
        <div className="date-nav">
          <button
            type="button"
            className="date-nav__btn"
            aria-label="チェックへ戻る"
            onClick={() => navigate('/check')}
          >
            ‹
          </button>
          <div className="date-nav__center">
            <span className="date-nav__display">チェックリストを編集</span>
          </div>
          <span className="date-nav__btn date-nav__btn--spacer" aria-hidden="true" />
        </div>
      </header>

      {sorted.length === 0 ? (
        <p className="manage-empty">まだタスクがありません。下のボタンから追加しましょう。</p>
      ) : (
        <ul className="manage-list">
          {sorted.map((it) => (
            <li key={it.id}>
              <button type="button" className="manage-item" onClick={() => startEdit(it)}>
                <div className="manage-item__body">
                  <span className="manage-item__name">{it.name}</span>
                  <span className="manage-item__sub">
                    {it.time && <span className="chip chip--time">🕐 {it.time}</span>}
                    <span className="manage-item__days">
                      {it.weekdays.length === 7
                        ? '毎日'
                        : [...it.weekdays]
                            .sort((a, b) => a - b)
                            .map((w) => WEEKDAY_LABELS[w])
                            .join('・')}
                    </span>
                  </span>
                </div>
                <span className="manage-item__chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="manage-add" onClick={startNew}>
        ＋ 新しいタスク
      </button>
    </div>
  );
}
