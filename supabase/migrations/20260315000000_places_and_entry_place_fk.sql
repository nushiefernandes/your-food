-- Phase 6: places table + entries.place_id FK
-- Apply: supabase db push   (or run directly in the Supabase dashboard SQL editor)
-- Rollback: see bottom of this file

-- ─── places table ────────────────────────────────────────────────────────────

create table if not exists public.places (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  google_place_id  text        not null,
  name             text        not null,
  lat              double precision,
  lng              double precision,
  address          jsonb,
  created_at       timestamptz not null default now(),

  -- one saved copy per user per Google Place
  unique(user_id, google_place_id)
);

alter table public.places enable row level security;

create policy "places_select_own"
  on public.places for select
  using (auth.uid() = user_id);

create policy "places_insert_own"
  on public.places for insert
  with check (auth.uid() = user_id);

create policy "places_update_own"
  on public.places for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "places_delete_own"
  on public.places for delete
  using (auth.uid() = user_id);

-- ─── entries.place_id FK ─────────────────────────────────────────────────────
-- ON DELETE SET NULL: deleting a saved place orphans the entry gracefully
-- (the free-text venue_name field still holds the display value)

alter table public.entries
  add column if not exists place_id uuid
    references public.places(id)
    on delete set null;

-- ─── Rollback (run only after backing up the places table) ───────────────────
-- alter table public.entries drop column if exists place_id;
-- drop table if exists public.places;
