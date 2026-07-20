import { useEffect, useRef, useState } from 'react';
import {
  countEntries,
  db,
  emptyEntry,
  getAllEntries,
  getAllEntriesRaw,
  getThemes,
  isEntryEmpty,
  saveTheme,
} from '../db';
import { mergeEntries, parseBackup, serializeBackup, type MergeStrategy } from '../utils/backup';
import { todayStr } from '../utils/date';
import type { DailyEntry } from '../types';
import { cloudConfigured, redirectTo, supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import { fullSync, getLastSyncedAt } from '../lib/sync';

type SyncState = 'idle' | 'syncing' | 'error';

function AccountSection() {
  const { user, loading } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncMsg, setSyncMsg] = useState<string>('');
  const [lastSynced, setLastSynced] = useState<string | null>(getLastSyncedAt());

  const runSync = async (uid: string) => {
    setSyncState('syncing');
    setSyncMsg('');
    try {
      const result = await fullSync(uid);
      if (result) {
        setSyncMsg(`同期しました（取込 ${result.pulled}件 / 送信 ${result.pushed}件）。`);
      }
      setLastSynced(getLastSyncedAt());
      setSyncState('idle');
    } catch (err) {
      setSyncState('error');
      setSyncMsg(err instanceof Error ? err.message : '同期に失敗しました。');
    }
  };

  const handleLogin = async () => {
    if (!supabase) return;
    setSyncMsg('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo() },
    });
    if (error) {
      setSyncState('error');
      setSyncMsg(error.message);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSyncMsg('ログアウトしました。ローカルの記録は端末に残っています。');
    setSyncState('idle');
  };

  // 未設定
  if (!cloudConfigured) {
    return (
      <section className="settings-section">
        <h2 className="settings-section__title">アカウントと同期</h2>
        <p className="settings-desc">
          クラウド同期は未設定です（README のセットアップ手順を参照してください）。
          設定しない場合も、記録はこの端末内に保存され全機能が利用できます。
        </p>
      </section>
    );
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section__title">アカウントと同期</h2>

      {loading ? (
        <p className="settings-desc">読み込み中…</p>
      ) : user ? (
        <>
          <p className="settings-desc">
            ログイン中: <strong>{user.email ?? user.id}</strong>
          </p>
          <p className="settings-desc">
            最終同期:{' '}
            {lastSynced ? new Date(lastSynced).toLocaleString('ja-JP') : '未同期'}
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => runSync(user.id)}
            disabled={syncState === 'syncing'}
          >
            {syncState === 'syncing' ? '同期中…' : '今すぐ同期'}
          </button>
          <button type="button" className="btn" onClick={handleLogout}>
            ログアウト
          </button>
          <p className="settings-desc">
            ログアウトしても、この端末のローカルデータは削除されません。
          </p>
        </>
      ) : (
        <>
          <p className="settings-desc">
            Google でログインすると、複数の端末やブラウザ間で記録を同期できます。
          </p>
          <button type="button" className="btn btn--primary" onClick={handleLogin}>
            Googleでログイン
          </button>
        </>
      )}

      {syncMsg && (
        <p className={'settings-message' + (syncState === 'error' ? ' is-error' : '')}>
          {syncMsg}
        </p>
      )}
    </section>
  );
}

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

function ThemeSection() {
  const [values, setValues] = useState<string[]>(() => Array(7).fill(''));
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout> | null>>(Array(7).fill(null));
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // デバウンス待ちの未保存値（weekday→入力値）。保存確定で削除する
  const pendingRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    let active = true;
    getThemes().then((m) => {
      if (!active) return;
      setValues(Array.from({ length: 7 }, (_, wd) => m.get(wd) ?? ''));
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // アンマウント時・アプリ終了（pagehide）時に保留中の保存を確定する
  useEffect(() => {
    const flushPending = () => {
      timersRef.current.forEach((t) => t && clearTimeout(t));
      timersRef.current = Array(7).fill(null);
      for (const [wd, value] of pendingRef.current) {
        void saveTheme(wd, value);
      }
      pendingRef.current.clear();
    };
    window.addEventListener('pagehide', flushPending);
    return () => {
      window.removeEventListener('pagehide', flushPending);
      flushPending();
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const handleChange = (weekday: number, value: string) => {
    setValues((prev) => {
      const next = [...prev];
      next[weekday] = value;
      return next;
    });
    pendingRef.current.set(weekday, value);
    const timers = timersRef.current;
    if (timers[weekday]) clearTimeout(timers[weekday] as ReturnType<typeof setTimeout>);
    timers[weekday] = setTimeout(() => {
      pendingRef.current.delete(weekday);
      void saveTheme(weekday, value).then(() => {
        setSaved(true);
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaved(false), 1800);
      });
    }, 500);
  };

  return (
    <section className="settings-section">
      <h2 className="settings-section__title">曜日テーマ</h2>
      <p className="settings-desc">
        曜日ごとに意識するテーマを設定すると、記録画面とカレンダーに表示されます。
      </p>
      <div className="theme-editor" aria-busy={!loaded}>
        {WEEKDAY_LABELS.map((label, wd) => (
          <label key={wd} className="theme-editor__row">
            <span className="theme-editor__label">{label}</span>
            <input
              type="text"
              className="theme-editor__input"
              value={values[wd]}
              placeholder="例: 傾聴、仕組み化 など"
              onChange={(e) => handleChange(wd, e.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="save-status" role="status" aria-live="polite">
        {saved && <span className="save-status__saved">✓ 保存しました</span>}
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const [count, setCount] = useState<number | null>(null);
  const [message, setMessage] = useState<string>('');
  const [pending, setPending] = useState<DailyEntry[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshCount = () => countEntries().then(setCount);

  useEffect(() => {
    refreshCount();
  }, []);

  const handleExport = async () => {
    const entries = await getAllEntries();
    const json = serializeBackup(entries);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `experience_cycle_${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage(`${entries.length}件をエクスポートしました。`);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 同じファイルを連続選択しても onChange が発火するようリセット
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const entries = parseBackup(text);
      if (entries.length === 0) {
        setMessage('インポート可能な記録が見つかりませんでした。');
        setPending(null);
        return;
      }
      setPending(entries);
      setMessage(`${entries.length}件の記録を読み込みました。取り込み方法を選んでください。`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました。');
      setPending(null);
    }
  };

  const applyImport = async (strategy: MergeStrategy) => {
    if (!pending) return;
    // 既存との統合はトンボストーン込みの raw を使う（削除情報を失わないため）
    const existing = await getAllEntriesRaw();
    let merged = mergeEntries(existing, pending, strategy);
    if (strategy === 'overwrite') {
      // 上書きで消えた既存日付はトンボストーン化してクラウドにも削除を伝播させる
      // （単に消すだけだと次回同期でクラウドから復活してしまう）
      const kept = new Set(pending.map((e) => e.date));
      const now = new Date().toISOString();
      const tombstones = existing
        .filter((e) => !kept.has(e.date) && !isEntryEmpty(e))
        .map((e) => ({ ...emptyEntry(e.date), updatedAt: now }));
      merged = [...merged, ...tombstones];
    }
    await db.transaction('rw', db.entries, async () => {
      await db.entries.clear();
      await db.entries.bulkPut(merged);
    });
    setPending(null);
    await refreshCount();
    const imported = merged.filter((e) => !isEntryEmpty(e)).length;
    setMessage(
      strategy === 'overwrite'
        ? `上書きインポートが完了しました（${imported}件）。`
        : `マージインポートが完了しました（${imported}件）。`,
    );
    // ログイン中ならインポート結果をクラウドへ反映
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (uid) void fullSync(uid).catch(() => {});
    }
  };

  return (
    <div className="page settings-page">
      <header className="page-header">
        <h1 className="page-header__title">設定</h1>
      </header>

      <AccountSection />

      <ThemeSection />

      <section className="settings-section">
        <h2 className="settings-section__title">データ</h2>
        <p className="settings-count">
          記録件数: <strong>{count ?? '…'}</strong> 件
        </p>

        <button type="button" className="btn btn--primary" onClick={handleExport}>
          JSONでエクスポート
        </button>

        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          JSONをインポート
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={handleFile}
        />

        {pending && (
          <div className="import-confirm">
            <p className="import-confirm__q">取り込み方法を選択してください</p>
            <div className="import-confirm__actions">
              <button type="button" className="btn btn--primary" onClick={() => applyImport('merge')}>
                マージ（新しい方を優先）
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => applyImport('overwrite')}
              >
                上書き（既存を全消去）
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setPending(null)}>
                キャンセル
              </button>
            </div>
          </div>
        )}

        {message && <p className="settings-message">{message}</p>}
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">経験学習サイクルとは</h2>
        <p className="settings-desc">
          デービッド・コルブが提唱した学習モデルです。次の4ステップを繰り返すことで、
          日々の経験を確かな学びに変えていきます。
        </p>
        <ol className="settings-cycle">
          <li>
            <strong>🌱 具体的経験</strong> ― 実際に行動し、経験する
          </li>
          <li>
            <strong>🔍 内省的観察</strong> ― その経験を振り返る
          </li>
          <li>
            <strong>💡 抽象的概念化</strong> ― 教訓・法則として概念化する
          </li>
          <li>
            <strong>🚀 能動的実験</strong> ― 次の場面で試す
          </li>
        </ol>
        <p className="settings-desc">
          毎日少しずつでも記録することで、このサイクルを習慣化できます。
        </p>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">このアプリについて</h2>
        <p className="settings-desc">
          データはこの端末のブラウザ内（IndexedDB）に保存されます。Google でログインすると、
          クラウド（Supabase）経由で複数端末と同期できます。ログインしない場合は
          サーバー送信は行われず、端末内のみで動作します。機種変更やデータ移行の際は、
          エクスポートしたJSONをインポートすることもできます。
        </p>
      </section>
    </div>
  );
}
