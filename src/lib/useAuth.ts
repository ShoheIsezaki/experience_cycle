import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { fullSync } from './sync';

export interface AuthState {
  user: User | null;
  loading: boolean;
}

/**
 * Supabase の認証状態を購読する hook。
 * - 起動時にセッションがあれば fullSync（バックグラウンド）。
 * - SIGNED_IN で fullSync。
 * - online 復帰時にもログイン中なら fullSync。
 * クラウド未設定なら user=null, loading=false を即返す。
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;
    let active = true;

    // 起動時: 既存セッションを取得し、あればバックグラウンド同期
    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      const u = data.session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (u) void fullSync(u.id).catch(() => {});
    });

    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (event === 'SIGNED_IN' && u) {
        void fullSync(u.id).catch(() => {});
      }
    });

    const onOnline = () => {
      client.auth.getSession().then(({ data }) => {
        const id = data.session?.user?.id;
        if (id) void fullSync(id).catch(() => {});
      });
    };
    window.addEventListener('online', onOnline);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return { user, loading };
}
