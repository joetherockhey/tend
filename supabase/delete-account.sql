-- ============================================================================
-- Tend - supabase/delete-account.sql
-- ----------------------------------------------------------------------------
-- Lets a signed-in person delete their own account from inside the app: the
-- sign-in itself, not just the rows hanging off it.
--
-- Run this once in the Supabase SQL editor (Database -> SQL Editor -> New
-- query -> paste -> Run). Safe to run more than once.
--
-- Nothing has to be tidied up by hand afterwards. Every table in schema.sql
-- references auth.users (id) ON DELETE CASCADE, so removing the auth row takes
-- the tickets, the categories and the app_state row - display name, prefs and
-- the whole garden - with it, and the account drops out of the gardens view in
-- the same statement.
--
-- WHY A FUNCTION, AND WHY IT IS SAFE
--
-- Deleting from auth.users needs more rights than the anon key the web page
-- ships with. The alternatives are an Edge Function holding the service-role
-- key, or this: SECURITY DEFINER runs the body with the owner's rights, and
-- the body deletes exactly one row - the caller's own, named by auth.uid().
--
-- auth.uid() is read from the caller's signed JWT, so it cannot be forged or
-- passed in. There is no parameter to tamper with, because the function takes
-- none: the only account any caller can ever delete is the one they are
-- signed in as. No service-role key goes anywhere near the browser, and there
-- is no deploy step - the same paste-it-in-the-editor as every other file here.
-- ============================================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Belt and braces: EXECUTE is granted to authenticated only, so this should
  -- be unreachable. A SECURITY DEFINER function that deletes rows is the wrong
  -- place to rely on "should".
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

-- Reachable only by someone who is actually signed in.
revoke all     on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;
