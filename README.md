# 経験学習サイクル (experience_cycle)

デービッド・コルブの **経験学習モデル** を毎日記録するための、シンプルなPWA（プログレッシブ・ウェブアプリ）です。iPhone の Safari で開き、ホーム画面に追加してアプリのように使えます。データは既定では端末内（IndexedDB）にのみ保存されます。任意で **Google ログインによるクラウド同期（Supabase）** を設定すると、複数端末・複数ブラウザ間で記録を同期できます（未設定なら従来どおりローカルのみで全機能が動作します）。

公開URL: https://shoheisezaki.github.io/experience_cycle/

## 経験学習サイクルとは

コルブの経験学習モデルは、経験を確かな学びに変えるための4ステップの循環プロセスです。

1. **🌱 具体的経験 (Concrete Experience)** — 実際に行動し、経験する
2. **🔍 内省的観察 (Reflective Observation)** — その経験を振り返る
3. **💡 抽象的概念化 (Abstract Conceptualization)** — 教訓・法則として概念化する
4. **🚀 能動的実験 (Active Experimentation)** — 次の場面で試す

このアプリでは、1日1レコードで上記4項目と「今日の学習状態」を表す天気マーク（☀️🌤☁️🌧⛈）を記録できます。すべての項目は任意入力で、天気だけの記録や、あとから過去日を編集することもできます。

## 機能

- **記録**: 日付ナビ（前日 / 翌日 / 日付ピッカー）付きの入力画面。入力すると自動保存されます。
- **カレンダー**: 月表示。各日に天気マークを表示。日をタップして内容を確認し、そのまま編集画面へ。
- **週ビュー**: 月曜始まりの週表示で7日分をリスト表示。
- **設定**: JSONエクスポート / インポート（マージ・上書き）、記録件数の表示、アプリの説明。

## セットアップ

必要環境: Node.js 20 以上。

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動（http://localhost:5173/experience_cycle/）
npm run dev

# 本番ビルド（dist/ に出力）
npm run build

# ビルド結果のプレビュー
npm run preview

# ユニットテスト
npm test

# 型チェック
npm run typecheck
```

### アイコンの再生成

アプリアイコンは依存ライブラリなしの Node スクリプトで生成しています（`public/` に出力済み）。デザインを変更した場合のみ再生成してください。

```bash
npm run gen:icons
```

## iPhone でホーム画面に追加する手順

1. iPhone の **Safari** で https://shoheisezaki.github.io/experience_cycle/ を開く
2. 画面下部の **共有ボタン**（□に↑のアイコン）をタップ
3. メニューから **「ホーム画面に追加」** を選ぶ
4. 名前（「経験学習」）を確認して **「追加」** をタップ
5. ホーム画面のアイコンから起動すると、全画面のアプリとして使えます（オフラインでも動作します）

## GitHub Pages の有効化

このリポジトリには `main` ブランチへの push で自動デプロイする GitHub Actions（`.github/workflows/deploy.yml`）が含まれています。初回のみ以下の設定が必要です。

1. GitHub リポジトリの **Settings → Pages** を開く
2. **Build and deployment → Source** を **「GitHub Actions」** に設定
3. `main` ブランチへ push すると、テスト → ビルド → デプロイが自動実行されます

> `vite.config.ts` の `base` は `'/experience_cycle/'` に設定されています。リポジトリ名を変更する場合はここも合わせて変更してください。

## Discord リマインド通知

毎日 **21:30 JST**（cron は UTC の `30 12 * * *`）に Discord へ「記録しましょう」というリマインドを送る GitHub Actions（`.github/workflows/remind.yml`）を用意しています。手動実行（workflow_dispatch）も可能です。

### Webhook の設定手順

1. Discord で通知したいチャンネルの **設定 → 連携サービス → ウェブフック** から Webhook を作成し、**Webhook URL** をコピー
2. GitHub リポジトリの **Settings → Secrets and variables → Actions → New repository secret** を開く
3. 名前を **`DISCORD_WEBHOOK_URL`**、値にコピーした Webhook URL を貼り付けて保存

Secret が未設定の場合、リマインドの workflow は失敗せずにスキップされます。

## 技術構成

- Vite + React + TypeScript
- PWA: `vite-plugin-pwa`（manifest / Service Worker / オフライン対応 / iOS向けメタタグ）
- データ保存: IndexedDB（`Dexie.js`）。任意でクラウド同期（`Supabase` + Google OAuth PKCE）
- ルーティング: `react-router-dom`（`HashRouter`。GitHub Pages でのリロード404を回避）
- スタイル: プレーンCSS（UIライブラリ不使用）。ダークモード対応
- テスト: Vitest（日付ユーティリティ・週計算・エクスポート/インポートのシリアライズ）

## データについて

- 記録はこの端末のブラウザ内（IndexedDB）に保存されます。クラウド同期を設定してログインすると、Supabase 経由で複数端末と同期されます。
- 機種変更やデータ移行の際は、設定画面から **JSONエクスポート** し、移行先で **JSONインポート** してください。
- インポートは「マージ（日付ごとに新しい方を優先）」または「上書き（既存を全消去）」を選べます。

## クラウド同期のセットアップ（任意）

Google ログインでクラウド同期を有効にするには、以下を設定します。**未設定でもアプリはローカルのみで完全に動作します**（設定画面には「クラウド同期は未設定です」と表示されます）。

1. **Supabase プロジェクトを作成**: [supabase.com](https://supabase.com/) で無料プロジェクトを作成します。**Project Settings → API** から **Project URL** と **anon public key** を控えます。
2. **Google OAuth クライアントを作成**: [Google Cloud Console](https://console.cloud.google.com/) の **APIとサービス → 認証情報** で OAuth 2.0 クライアント ID（種類: ウェブアプリケーション）を作成します。**承認済みのリダイレクト URI** に次を追加します。
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
   （`<project-ref>` は Supabase の Project URL のサブドメイン部分）。作成後の **クライアント ID** と **クライアントシークレット** を控えます。
3. **Supabase で Google を有効化**: Supabase の **Authentication → Providers → Google** を有効化し、上のクライアント ID / シークレットを入力して保存します。
4. **URL 設定**: Supabase の **Authentication → URL Configuration** で、**Site URL** を `https://shoheisezaki.github.io/experience_cycle/` に設定し、**Redirect URLs** にも同じ URL を追加します。
5. **スキーマを作成**: Supabase の **SQL Editor** で、このリポジトリの [`supabase/schema.sql`](supabase/schema.sql) の内容を実行します（`entries` テーブルと RLS ポリシーが作成されます）。
6. **GitHub に接続情報を登録**: リポジトリの **Settings → Secrets and variables → Actions → Variables**（Secrets ではなく **Variables**）に、次の2つの **Repository variables** を登録します。
   - `VITE_SUPABASE_URL` = Supabase の Project URL
   - `VITE_SUPABASE_ANON_KEY` = Supabase の anon public key
7. **再デプロイ**: `Deploy to GitHub Pages` ワークフローを再実行（または `main` に push）すると、接続情報がビルドに埋め込まれ、クラウド同期が有効になります。

> **anon key の公開について**: anon key はクライアントに埋め込まれ公開されますが、これは設計上安全です。全アクセスは Row Level Security（RLS）で保護されており、各ユーザーは自分の行（`auth.uid() = user_id`）以外を読み書きできません。

### 同期の仕組み

- 書き込みはログイン中に即時クラウドへ反映（write-through）されます。失敗しても致命的ではなく、次回のフル同期が差分を修復します。
- フル同期は、アプリ起動時（セッションあり）・ログイン成立時・オンライン復帰時・「今すぐ同期」ボタン・インポート適用後に実行されます。
- 競合は **updatedAt が新しい方を採用（Last-Write-Wins）** で解決します。削除は「空の記録（トンボストーン）」として同期され、端末間で伝播します。

## ライセンス

個人利用向けのプロジェクトです。
