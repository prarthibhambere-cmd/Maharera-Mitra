-- User-scoped chat sessions table.
-- Replaces localStorage-only chat history once a user signs in.
-- RLS policies ensure users can only access their own chats.

create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New Chat',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Fast lookup of a user's chats ordered by recency
create index if not exists chats_user_updated_idx
  on chats (user_id, updated_at desc);

-- Row-Level Security: each user only sees their own chats
alter table chats enable row level security;

drop policy if exists "Users view own chats" on chats;
create policy "Users view own chats" on chats
  for select using (auth.uid() = user_id);

drop policy if exists "Users insert own chats" on chats;
create policy "Users insert own chats" on chats
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own chats" on chats;
create policy "Users update own chats" on chats
  for update using (auth.uid() = user_id);

drop policy if exists "Users delete own chats" on chats;
create policy "Users delete own chats" on chats
  for delete using (auth.uid() = user_id);

notify pgrst, 'reload schema';
