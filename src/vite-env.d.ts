/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Supabase プロジェクト URL（未設定ならクラウド同期は無効） */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon key（公開されても RLS で保護される。未設定なら無効） */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
