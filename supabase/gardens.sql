-- ============================================================================
-- Tend - supabase/gardens.sql
-- ----------------------------------------------------------------------------
-- The Friends tab: every account's name and garden, readable by anyone signed
-- in. Run this in the Supabase SQL editor. Safe to re-run.
--
-- WHAT THIS SHARES, and nothing else:
--   * the display name
--   * which world they picked (garden or reef)
--   * their plot, the land they have unlocked, and which kinds they have found
--
-- Tasks, categories, notes, due dates and email addresses stay private: the
-- policies on `tickets` and `categories` are untouched, and this view names the
-- three garden keys one at a time rather than handing over the whole bag - so
-- the coin ledgers (which hold task ids) are not in it either.
--
-- The view belongs to the table owner and is NOT security_invoker, which is
-- what lets it read past app_state's own row-level security. That is the point:
-- it is the one deliberate window onto other people's rows, and it is
-- read-only - nobody can write through it.
-- ============================================================================

create or replace view public.gardens as
select
  s.user_id,
  coalesce(nullif(s.display_name, ''), 'Gardener')        as display_name,
  coalesce(s.prefs ->> 'world', 'garden')                 as world,
  s.garden ->> 'garden-layout-v5'                         as layout,
  s.garden ->> 'garden-sections-v1'                       as sections,
  s.garden ->> 'garden-found-v1'                          as found,
  s.updated_at
from public.app_state s;

alter view public.gardens set (security_invoker = false);

-- Read-only, and only for people who are signed in.
revoke all on public.gardens from anon, authenticated;
grant select on public.gardens to authenticated;
