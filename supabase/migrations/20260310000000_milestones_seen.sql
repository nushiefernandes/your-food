-- milestones_seen: tracks which milestone celebrations a user has already seen
-- user_id defaults to auth.uid() so inserts don't need to pass it explicitly

create table if not exists public.milestones_seen (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default auth.uid()
                          references auth.users(id) on delete cascade,
  milestone   text        not null,
  seen_at     timestamptz not null default now(),
  unique(user_id, milestone)
);

alter table public.milestones_seen enable row level security;

create policy "Users can read their own milestones"
  on public.milestones_seen for select
  using (auth.uid() = user_id);

create policy "Users can insert their own milestones"
  on public.milestones_seen for insert
  with check (auth.uid() = user_id);
