-- ============================================================================
-- Tend - database schema for Supabase (Postgres)
-- ----------------------------------------------------------------------------
-- Paste this whole file into your Supabase project's SQL Editor and run it.
-- Safe to run more than once.
--
-- The security model in one line: every table is keyed by the signed-in user's
-- id, row-level security is on, and every policy checks auth.uid() = user_id.
-- One user can never see or touch another user's rows, even though the anon
-- key that the web page ships with is public.
-- ============================================================================

-- ---------------------------------------------------------------- tickets ---
create table if not exists public.tickets (
  id            text        not null,
  user_id       uuid        not null references auth.users (id) on delete cascade,
  title         text        not null default '',
  notes         text        not null default '',
  setting       text        not null default '',
  category      text        not null default '',
  follow_up     boolean     not null default false,
  priority      boolean     not null default false,
  archived      boolean     not null default false,
  due_date      date,
  created_on    date        not null default current_date,
  completed_on  date,
  sort_index    integer     not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (id, user_id)
);

create index if not exists tickets_user_idx on public.tickets (user_id, sort_index);

-- ------------------------------------------------------------- categories ---
create table if not exists public.categories (
  id          text        not null,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  name        text        not null,
  color       text        not null default '#8a8f98',
  sort_index  integer     not null default 0,
  primary key (id, user_id)
);

create index if not exists categories_user_idx on public.categories (user_id, sort_index);

-- -------------------------------------------------------------- app_state ---
-- One row per user: display name, view preferences, and the whole garden.
-- The garden is a key/value bag rather than columns, so garden features can be
-- added later without a migration.
create table if not exists public.app_state (
  user_id       uuid        primary key references auth.users (id) on delete cascade,
  display_name  text        not null default '',
  prefs         jsonb       not null default '{}'::jsonb,
  garden        jsonb       not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);

-- ============================ row-level security ============================

alter table public.tickets    enable row level security;
alter table public.categories enable row level security;
alter table public.app_state  enable row level security;

-- tickets
drop policy if exists "tickets are private" on public.tickets;
create policy "tickets are private"
  on public.tickets
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- categories
drop policy if exists "categories are private" on public.categories;
create policy "categories are private"
  on public.categories
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- app_state
drop policy if exists "app state is private" on public.app_state;
create policy "app state is private"
  on public.app_state
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================ housekeeping ============================

-- Keep updated_at honest on every write.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tickets_touch on public.tickets;
create trigger tickets_touch
  before insert or update on public.tickets
  for each row execute function public.touch_updated_at();

drop trigger if exists app_state_touch on public.app_state;
create trigger app_state_touch
  before insert or update on public.app_state
  for each row execute function public.touch_updated_at();

-- Give every new account an app_state row with the name they signed up with,
-- so the gardener has a name on the very first load.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_state (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
