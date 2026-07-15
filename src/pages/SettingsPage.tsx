import { useEffect, useRef, useState } from 'react';
import { countEntries, db, getAllEntries } from '../db';
import { mergeEntries, parseBackup, serializeBackup, type MergeStrategy } from '../utils/backup';
import { todayStr } from '../utils/date';
import type { DailyEntry } from '../types';

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
    const existing = await getAllEntries();
    const merged = mergeEntries(existing, pending, strategy);
    await db.transaction('rw', db.entries, async () => {
      await db.entries.clear();
      await db.entries.bulkPut(merged);
    });
    setPending(null);
    await refreshCount();
    setMessage(
      strategy === 'overwrite'
        ? `上書きインポートが完了しました（${merged.length}件）。`
        : `マージインポートが完了しました（${merged.length}件）。`,
    );
  };

  return (
    <div className="page settings-page">
      <header className="page-header">
        <h1 className="page-header__title">設定</h1>
      </header>

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
          データはこの端末のブラウザ内（IndexedDB）だけに保存されます。
          サーバー送信やログインはありません。機種変更やデータ移行の際は、
          エクスポートしたJSONをインポートしてください。
        </p>
      </section>
    </div>
  );
}
