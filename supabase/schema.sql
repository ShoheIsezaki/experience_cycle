-- 経験学習サイクル: クラウド同期用スキーマ
-- Supabase の SQL Editor で1回だけ実行してください。
-- anon key は公開されても、以下の RLS により自分の行以外はアクセスできません。

create table if not exists public.entries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date text not null,
  weather smallint check (weather is null or weather between 1 and 5),
  experience text not null default '',
  reflection text not null default '',
  lesson text not null default '',
  next_action text not null default '',
  updated_at timestamptz not null,
  primary key (user_id, date)
);

-- RLS を有効化
alter table public.entries enable row level security;

-- 自分の行のみ参照
create policy "entries_select_own"
  on public.entries for select
  using (auth.uid() = user_id);

-- 自分の行のみ追加
create policy "entries_insert_own"
  on public.entries for insert
  with check (auth.uid() = user_id);

-- 自分の行のみ更新
create policy "entries_update_own"
  on public.entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 自分の行のみ削除
create policy "entries_delete_own"
  on public.entries for delete
  using (auth.uid() = user_id);
