-- ============================================================================
-- Tend - daily-digest.sql   (OPTIONAL - the app works fine without it)
-- ----------------------------------------------------------------------------
-- Sends each opted-in account one email a morning listing what is due today
-- and anything overdue. Nothing is sent on a day with neither.
--
-- It runs entirely inside Postgres: pg_cron wakes it hourly, it works out whose
-- local morning it is, builds their list, and posts it to an email API with
-- pg_net. No server, no Edge Function, no deploy step - you paste this into the
-- SQL Editor once.
--
-- ----------------------------------------------------------------------------
-- BEFORE YOU RUN IT you need an email provider and an address to send FROM.
-- Resend (resend.com) is the one this is written for: the free tier covers
-- 3,000 emails a month, which is far more than a household will ever use.
--
-- The catch is that Resend requires a domain you control - you cannot send from
-- a plain gmail address. If you do not own a domain, either buy one (about $15
-- a year) or swap the provider: the only part that is Resend-specific is the
-- URL, the auth header and the JSON body in send_tend_email() below, so any
-- provider with an HTTP API drops in.
--
-- ----------------------------------------------------------------------------
-- SETUP
--   1. Sign up at resend.com, add and verify your domain, create an API key.
--   2. In the SQL Editor run, with your own values:
--        select vault.create_secret('re_xxxxxxxx', 'resend_api_key');
--        select vault.create_secret('Tend <tend@yourdomain.com>', 'tend_from');
--   3. Run this whole file.
--   4. Set DAILY_EMAIL: true in js/config.js so the switch appears in Settings.
--   5. Turn it on for yourself in Settings, and test immediately with:
--        select public.send_daily_digests(force_hour => true);
--
-- To stop the whole thing:  select cron.unschedule('tend-daily-digest');
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------- sending ---
-- The only provider-specific function. Swap the URL, header and body to change
-- provider; everything below calls this and does not care how mail is sent.
create or replace function public.send_tend_email(to_email text, subject text, html text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  api_key text;
  from_addr text;
  request_id bigint;
begin
  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  select decrypted_secret into from_addr from vault.decrypted_secrets where name = 'tend_from';

  if api_key is null or from_addr is null then
    raise notice 'Tend digest: resend_api_key or tend_from is missing from the vault, nothing sent';
    return null;
  end if;

  select net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || api_key
    ),
    body := jsonb_build_object(
      'from', from_addr,
      'to', to_jsonb(array[to_email]),
      'subject', subject,
      'html', html
    )
  ) into request_id;

  return request_id;
end;
$$;

-- ------------------------------------------------------------ the digest ---
-- force_hour skips the "is it their morning?" check, for testing.
create or replace function public.send_daily_digests(force_hour boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  acct record;
  tz text;
  today date;
  due_rows text;
  late_rows text;
  due_count integer;
  late_count integer;
  body text;
  subject text;
  sent integer := 0;
begin
  for acct in
    select s.user_id,
           u.email,
           coalesce(nullif(s.display_name, ''), split_part(u.email, '@', 1)) as name,
           coalesce(s.prefs ->> 'timezone', 'UTC')                           as timezone,
           coalesce((s.prefs ->> 'dailyEmailHour')::int, 7)                  as send_hour
    from public.app_state s
    join auth.users u on u.id = s.user_id
    where coalesce((s.prefs ->> 'dailyEmail')::boolean, false)
      and u.email is not null
  loop
    tz := acct.timezone;

    -- Only at the hour they asked for, in their own time zone.
    begin
      if not force_hour
         and extract(hour from (now() at time zone tz)) <> acct.send_hour then
        continue;
      end if;
      today := (now() at time zone tz)::date;
    exception when others then
      -- an unrecognised time zone should skip that account, not kill the run
      raise notice 'Tend digest: bad time zone % for %', tz, acct.email;
      continue;
    end;

    select count(*),
           string_agg('<li style="margin:4px 0">' || replace(replace(title,'&','&amp;'),'<','&lt;') ||
             case when category <> '' then ' <span style="color:#737a8c">(' ||
               replace(replace(category,'&','&amp;'),'<','&lt;') || ')</span>' else '' end || '</li>',
             '' order by priority desc, title)
      into due_count, due_rows
      from public.tickets
     where user_id = acct.user_id and completed_on is null and not archived and due_date = today;

    select count(*),
           string_agg('<li style="margin:4px 0">' || replace(replace(title,'&','&amp;'),'<','&lt;') ||
             ' <span style="color:#e0546a">' || to_char(due_date, 'DD Mon') || '</span></li>',
             '' order by due_date)
      into late_count, late_rows
      from public.tickets
     where user_id = acct.user_id and completed_on is null and not archived and due_date < today;

    -- Nothing to say? Say nothing.
    if coalesce(due_count, 0) = 0 and coalesce(late_count, 0) = 0 then
      continue;
    end if;

    subject := case
      when coalesce(due_count, 0) = 0 then late_count || ' overdue'
      when coalesce(late_count, 0) = 0 then due_count || ' due today'
      else due_count || ' due today, ' || late_count || ' overdue'
    end;

    body :=
      '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;color:#1f2430">' ||
      '<p style="font-size:15px">Morning ' || replace(acct.name,'<','&lt;') || ',</p>' ||
      case when coalesce(due_count,0) > 0 then
        '<h3 style="font-size:14px;color:#8a5500;margin:18px 0 6px">Due today</h3><ul style="padding-left:18px;margin:0">' || due_rows || '</ul>'
      else '' end ||
      case when coalesce(late_count,0) > 0 then
        '<h3 style="font-size:14px;color:#a12b41;margin:18px 0 6px">Overdue</h3><ul style="padding-left:18px;margin:0">' || late_rows || '</ul>'
      else '' end ||
      '<p style="margin-top:22px"><a href="' ||
        coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'tend_site_url'), 'https://example.github.io/tend/') ||
        '" style="background:#7536ff;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px">Open Tend</a></p>' ||
      '<p style="font-size:12px;color:#737a8c;margin-top:24px">Turn this off in Tend under Settings &amp; backup.</p></div>';

    perform public.send_tend_email(acct.email, subject, body);
    sent := sent + 1;
  end loop;

  return sent;
end;
$$;

-- Nobody but the database itself should be able to call these.
revoke all on function public.send_tend_email(text, text, text) from public, anon, authenticated;
revoke all on function public.send_daily_digests(boolean) from public, anon, authenticated;

-- ------------------------------------------------------------- scheduling ---
-- Hourly, because "7am" means a different moment for each person's time zone.
-- The function itself decides whose hour it is.
select cron.unschedule('tend-daily-digest')
 where exists (select 1 from cron.job where jobname = 'tend-daily-digest');

select cron.schedule('tend-daily-digest', '0 * * * *', $$select public.send_daily_digests();$$);

-- Optional: the link the email points at.
--   select vault.create_secret('https://yourname.github.io/tend/', 'tend_site_url');
