-- 経験学習サイクル: クラウド同期用スキーマ
-- Supabase の SQL Editor で実行してください。
-- このファイルは冪等（再実行可能）です。全体をもう一度丸ごと実行してもエラーになりません。
-- anon key は公開されても、以下の RLS により自分の行以外はアクセスできません。

-- =====================================================================
-- entries: 1日1レコードの経験学習サイクルの記録
-- =====================================================================
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
drop policy if exists "entries_select_own" on public.entries;
create policy "entries_select_own"
  on public.entries for select
  using (auth.uid() = user_id);

-- 自分の行のみ追加
drop policy if exists "entries_insert_own" on public.entries;
create policy "entries_insert_own"
  on public.entries for insert
  with check (auth.uid() = user_id);

-- 自分の行のみ更新
drop policy if exists "entries_update_own" on public.entries;
create policy "entries_update_own"
  on public.entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 自分の行のみ削除
drop policy if exists "entries_delete_own" on public.entries;
create policy "entries_delete_own"
  on public.entries for delete
  using (auth.uid() = user_id);

-- =====================================================================
-- weekday_themes: 曜日ごとに意識する「テーマ」（weekday 0=月..6=日）
-- =====================================================================
create table if not exists public.weekday_themes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  theme text not null default '',
  updated_at timestamptz not null,
  primary key (user_id, weekday)
);

-- RLS を有効化
alter table public.weekday_themes enable row level security;

-- 自分の行のみ参照
drop policy if exists "weekday_themes_select_own" on public.weekday_themes;
create policy "weekday_themes_select_own"
  on public.weekday_themes for select
  using (auth.uid() = user_id);

-- 自分の行のみ追加
drop policy if exists "weekday_themes_insert_own" on public.weekday_themes;
create policy "weekday_themes_insert_own"
  on public.weekday_themes for insert
  with check (auth.uid() = user_id);

-- 自分の行のみ更新
drop policy if exists "weekday_themes_update_own" on public.weekday_themes;
create policy "weekday_themes_update_own"
  on public.weekday_themes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 自分の行のみ削除
drop policy if exists "weekday_themes_delete_own" on public.weekday_themes;
create policy "weekday_themes_delete_own"
  on public.weekday_themes for delete
  using (auth.uid() = user_id);
