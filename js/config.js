/* ============================================================================
   Tend - config.js
   ----------------------------------------------------------------------------
   THIS IS THE ONLY FILE YOU NEED TO EDIT TO TURN ON CLOUD ACCOUNTS.

   Leave both values empty and Tend runs in LOCAL MODE: profiles are created
   on the device and everything is stored in that browser. No signup, no
   server, works the moment you push it to GitHub Pages.

   Fill both values in and Tend runs in CLOUD MODE: real accounts with email
   and password, and every ticket, category and garden follows the user to any
   device they sign in on.

   To get these two values:
     1. Create a free project at https://supabase.com
     2. Run supabase/schema.sql in the project's SQL Editor
     3. Project Settings -> API -> copy the Project URL and the "anon public" key

   The anon key is designed to be public and safe to commit. It grants no access
   on its own: every table is protected by row-level security, so a signed-in
   user can only ever read and write their own rows. Never put the "service_role"
   key here.
   ============================================================================ */

window.TEND_CONFIG = {
  SUPABASE_URL: 'https://vhkwqfxykluhbpvofzdx.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_9ySOQl3T9dcmtoHEnQhHpg_Z7E1JFeE',

  /* Shown on the sign-in card and in the browser tab. */
  APP_NAME: 'Tend',
  TAGLINE: 'Tickets that grow a garden.',

  /* Set false to hide the "create an account" form, so only people you invite
     from the Supabase dashboard can sign in. Ignored in local mode. */
  ALLOW_SIGNUP: true,

  /* Optional. Set this to "your-username/your-repo" and a "Suggest something"
     link appears in the app that opens a pre-filled ticket on your GitHub
     repository's Issues tab. Issues are public and permanent, which makes them
     a good place for feedback about the app - and a poor place for anyone's
     private to-do list. Leave blank to hide the link. */
  GITHUB_REPO: 'joetherockhey/tend',

  /* Set true once you have run supabase/daily-digest.sql and scheduled it, to
     reveal the "Daily summary email" switch in each account's settings. Leave
     false and nobody sees an option that would do nothing. Cloud mode only -
     a local profile has no email address to send to. */
  DAILY_EMAIL: false,

  /* Where the Supabase client library is loaded from. Change this only if you
     want to self-host the library instead of using the CDN. */
  SUPABASE_LIB_URL: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
};
