import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ビルド時環境変数から接続情報を読む。未設定ならクラウド機能を無効化する。
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** URL / anon key の両方が設定されていればクラウド同期が有効 */
export const cloudConfigured: boolean = Boolean(url && anonKey);

/**
 * Supabase クライアント。未設定なら null。
 * OAuth は PKCE フロー（フルページリダイレクト）を使う。
 */
export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        detectSessionInUrl: true,
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/** OAuth 後に戻ってくるリダイレクト先。HashRouter 配下でも BASE_URL 直下に戻す。 */
export function redirectTo(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}
