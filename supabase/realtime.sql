-- ============================================================================
-- Tend - supabase/realtime.sql
-- ----------------------------------------------------------------------------
-- Turns on live sync, so a change made on one device shows up on the other
-- within a second instead of on the next reload.
--
-- Run this once in the Supabase SQL editor (Database -> SQL Editor -> New
-- query -> paste -> Run). It is safe to run more than once.
--
-- Tend still works without this: it falls back to checking for changes when a
-- device wakes up, comes back online, or every 25 seconds while you are
-- looking at it. This just makes it instant.
-- ============================================================================

-- 1. Let Postgres broadcast changes on these three tables.
--    (Adding a table twice is an error, hence the guard.)
do $$
declare
  t text;
begin
  foreach t in array array['tickets', 'categories', 'app_state'] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 2. Send the whole row on updates and deletes, not just the primary key.
--    Without this, a delete cannot be matched against "user_id = mine", so the
--    other device would never hear about a ticket you removed.
alter table public.tickets    replica identity full;
alter table public.categories replica identity full;
alter table public.app_state  replica identity full;

-- Row-level security still applies to everything sent this way: each account
-- only ever receives its own rows.
