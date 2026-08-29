# Tend

A personal ticket tracker where finishing things grows a garden. Every ticket you
complete earns a gold coin; coins buy plants, tools, saplings and pets from the
shop; and every ten completed tickets unlocks another section of the garden,
which you walk around with the arrow keys. Watering a plant costs nothing and
earns nothing - it is just a sparkle and a splash.

Pick your world when you sign up, and change it whenever you like: a **garden**
tended by a farmer, or an **ocean** reef tended by a merman or mermaid. Same
rules, same progress, completely different look.

It is a single static site — no build step, no server of your own to run — and it
works two ways:

| | **Local mode** | **Cloud mode** |
|---|---|---|
| Sign-in | None. Pick a profile on the device. | Email and password. |
| Where data lives | That browser only. | Your Supabase project, plus an offline copy in the browser. |
| Follows you across devices | No (export/import by hand). | Yes. |
| Setup | None. | About ten minutes, once. |

Local mode is the default, so the site works the moment you publish it. Filling in
two values in `js/config.js` switches the whole app to cloud mode.

---

## Quick start: publish it in local mode

1. Create a new repository on GitHub and put these files in it (the root of the
   repo, so `index.html` sits at the top level).
2. In the repository, go to **Settings → Pages**. Under *Build and deployment*,
   set **Source** to `Deploy from a branch`, pick the `main` branch and the
   `/ (root)` folder, and save.
3. Wait a minute, then open `https://<your-username>.github.io/<your-repo>/`.

That is the whole deployment. Anyone you send the link to creates their own
profile in their own browser; nobody can see anyone else's tickets, because
nothing ever leaves their device.

You can also just open `standalone/tend.html` directly off your desktop — it is
the same app inlined into one file, no web server needed.

---

## Cloud mode: real accounts that sync across devices

### 1. Create the project

Sign up at [supabase.com](https://supabase.com) and create a new project. The free
tier is enough for this. Choose a region near you and keep the database password
somewhere safe — you will not need it for Tend, but you will want it eventually.

### 2. Create the tables

In your project, open **SQL Editor → New query**, paste in the entire contents of
[`supabase/schema.sql`](supabase/schema.sql), and run it.

That creates three tables — `tickets`, `categories`, `app_state` — turns on
row-level security, and adds a policy on each one saying *you may only touch rows
where `user_id` is your own id*. That policy is what makes it safe to publish the
site: the key in the page grants nothing by itself.

### 2b. Turn on live sync (optional but worth it)

Open **SQL Editor → New query** again and run
[`supabase/realtime.sql`](supabase/realtime.sql).

That lets Postgres broadcast changes on those three tables, so a ticket added on
your laptop appears on your phone a second later without either device being
touched. Without it Tend still keeps devices in step — it checks for changes
whenever a device wakes, comes back online, or every 25 seconds while you are
looking at it — this just makes it instant. Row-level security still applies, so
each account only ever receives its own rows.

### 3. Point the app at it

In your Supabase project, go to **Project Settings → API** and copy:

- the **Project URL**
- the **anon public** key

Put both into `js/config.js`:

```js
window.TEND_CONFIG = {
  SUPABASE_URL: 'https://abcdefghijk.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi...',
  ...
};
```

Commit and push. The next load shows a sign-in screen instead of the profile
picker.

> **On committing that key.** The anon key is designed to be public — it is in the
> HTML of every Supabase site on the web. It only ever acts on behalf of whoever
> is signed in, and row-level security decides what that person can see. The key
> you must never put here is the `service_role` key, which bypasses those policies
> entirely. If you ever paste that one into a web page, rotate it immediately.

### 4. Decide how people get in

In **Authentication → Providers → Email**, decide whether to require email
confirmation (on by default, and worth keeping). In **Authentication → URL
Configuration**, add your GitHub Pages URL to the redirect allow-list so password
reset links come back to the right place.

If you would rather invite people yourself than let anyone sign up, set
`ALLOW_SIGNUP: false` in `js/config.js` and add users from
**Authentication → Users → Add user**.

### 5. Try it

Open the site, create an account, add a ticket, then open the same URL on your
phone and sign in. The ticket is there. So is the garden, down to where the
gardener is standing.

---

## "Can people create tickets from GitHub itself?"

Yes, in two quite different senses — worth separating, because one is a good idea
and the other usually is not.

**Feedback about the app: use GitHub Issues.** Set `GITHUB_REPO` in
`js/config.js` to `your-username/your-repo` and a *Suggest something on GitHub*
link appears in the account menu, opening a pre-filled ticket form
(`.github/ISSUE_TEMPLATE/ticket.yml`). Anything filed there is stored in the
repository permanently, is searchable, threads into a conversation, and costs you
nothing to host. This is the right home for "the calendar is wrong in Safari".

**Someone's private to-do list: do not use GitHub Issues.** It is tempting,
because the storage is free and permanent, but issues in a public repo are
readable by the entire internet, closing one requires a write token, and everyone
using it needs a GitHub account. A shared *board* — a family list, a small team,
a club — could work this way, and the API to do it is
`GET /repos/{owner}/{repo}/issues`. A personal tracker should not.

Cloud mode exists for the private case, which is why it is built on a database
with per-user access rules rather than on a public issue tracker.

---

## What is in here

```
index.html              markup and the page shell
manifest.webmanifest    makes it installable as a phone app
sw.js                   service worker: offline use, network-first
icons/                  app icons (192, 512, maskable, apple-touch)
css/styles.css          all styling, light theme, responsive
js/config.js            the only file you edit to configure anything
js/util.js              dates, escaping, colours, debounce
js/worlds.js            the two skins: sprites, plants, creatures, names
js/store.js             storage: local and Supabase backends, offline queue
js/auth.js              the sign-in gate and the local profile picker
js/app.js               tickets, lists, calendar, stats, categories, settings
js/garden.js            the garden: sprites, movement, shop, pets, sections
js/boot.js              wires branding in and starts the gate
js/qr.js                a small QR encoder, for the install code
supabase/schema.sql     tables, row-level security, triggers
supabase/realtime.sql   optional: instant sync between devices
supabase/daily-digest.sql   optional daily reminder email, all in SQL
test/mock-supabase.js   a fake backend, for exercising cloud mode locally
build.py                inlines everything into standalone/tend.html
standalone/tend.html    the whole app as one file
```

### How saving works

Every change is written to `localStorage` synchronously, so nothing is ever lost
to a closed tab. In cloud mode the change is also queued and pushed about a
second later, batched, and diffed against the last confirmed push so only real
changes go over the wire. If the network is down the queue survives in the browser
and drains when it comes back — the badge in the header says which of those is
happening. The garden is stored as one JSON blob per account, so new garden
features never need a database migration.

Changes travel the other way too. Each device subscribes to its own rows over a
websocket, so a change made anywhere shows up everywhere within a second or so,
with a short note at the bottom of the screen saying where it came from. If the
websocket cannot be established, the same refresh runs when a device wakes up,
regains focus, comes back online, or every 25 seconds while the tab is on screen.
One thing deliberately does not sync: where your farmer or mermaid is standing.
That belongs to the device you are standing on — otherwise walking about on the
laptop would drag the phone's character around.

---

## Customising

- **Header colour** — Settings → *Header colour*, eight ribbon palettes including one
  light one. A theme sets six CSS tokens (`--header-bg`, `--header-bg-2`,
  `--header-text`, `--header-dim`, `--header-line`, and the chip pair) and touches
  nothing below the ribbon, so adding a ninth is a six-line block in `styles.css` plus
  a row in `THEMES` in `app.js`.
- **Name and tagline** — `APP_NAME` and `TAGLINE` in `js/config.js`.
- **Colours** — the CSS custom properties at the top of `css/styles.css`.
  `--header-bg` and `--header-bg-2` are the header gradient; `--accent` is the
  purple used for buttons and the active tab.
- **How many tickets fit in a list-view cell** before it says "+n more" —
  `AGENDA_ROWS` in `js/app.js`.
- **What the calendar plots** — the three chips above the calendar toggle
  Created, Due and Completed dates on and off. Due and Completed are on by
  default; the defaults live in `CAL_SERIES` in `js/app.js`. Due and Completed
  are drawn large, Created small, and a day's Due count is the work still
  outstanding on that date, not everything that was ever due then.
- **Categories** — the starting five (Home, Health, Money, Errands, Fun) are in
  `DEFAULT_CATEGORIES` in `js/store.js`. Users can add and remove their own from
  the Categories panel, and each one colour-codes both its tickets and its plant
  pots in the garden.
- **Garden sections** — `SECTIONS` at the top of `js/garden.js`. Add entries and
  every ten completed tickets keeps unlocking new ground.
- **The unlock rate** — `TICKETS_PER_SECTION` in `js/garden.js`.
- **What a plant costs** — `PLANT_COST` in `js/garden.js`, alongside
  `SAPLING_COST` and the pet and item prices.
- **The app's name and icon on a phone** — `manifest.webmanifest` and `icons/`.
- **Digest send times offered** — `DIGEST_HOURS` in `js/app.js`.
- **Worlds** — `js/worlds.js`. Section names, sprites, plant names and art all
  live in the two world objects.
- **Tile size** — `TILE` at the top of `js/worlds.js`, used by both files.

After editing anything, re-run `python3 build.py` if you want the standalone file
to match. The standalone build blanks the Supabase keys so the single file always
opens into on-device profiles; use `python3 build.py --cloud` to keep them.

### Worlds

`js/worlds.js` holds two skins - `garden` and `ocean` - and nothing else. Every
rule lives in `js/garden.js` and is identical in both. The two are index-matched
all the way down, which is what makes switching safe: plant variety 7 is a Bonsai
Tree above water and Staghorn Coral below, the pet stored as `dog` is a dog or a
clownfish, the tool stored as `axe` is an axe or a coral saw. Changing world is a
preference change and a redraw - not one byte of saved data moves, so a reef full
of coral becomes the same garden full of plants and back again.

The layout of every section is shared too: `DECORATIONS_BY_THEME` in `garden.js`
says where things sit and how they behave, and tags each one with an art name
that the current world resolves when drawing.

To add a third world, copy one of the two objects in `worlds.js` and keep the
keys and array lengths the same. Nothing else needs to change.

### Installing it as a phone app

Tend is a progressive web app, so it installs from the browser with no app store
involved and no cost. On **iPhone**: open the site in Safari, Share, *Add to Home
Screen*. On **Android**: Chrome offers *Install app*, or Menu → *Add to Home
screen*. It then opens full screen with its own icon.

**Get Tend on your phone**, in the account menu, is the shortcut for all of that:
it shows the site address as a QR code to point a camera at, the link to send to
somebody, and the two taps each phone needs afterwards. On Chrome it also offers
a real one-tap install button, because Chrome hands the page its install prompt;
Safari has no equivalent, so on an iPhone the Share → Add to Home Screen step is
unavoidable, whether you arrived by link, by code or by typing the address.

The code is drawn by `js/qr.js`, written out here rather than fetched from a
service, so it works offline and inside the single-file build.

The service worker takes a **network-first** approach for the app's own files:
online you always get the current code, so a push reaches everyone on their next
open; the cache is only the fallback for when there is no connection. Requests to
Supabase are never intercepted, so data is never served stale. Bump `VERSION` in
`sw.js` if you ever need to force every cache to clear.

Offline, everything still works against the copy in the browser, and the queue
pushes when the connection returns.

### Daily reminder emails

Optional and off by default. `supabase/daily-digest.sql` adds a job that emails
each opted-in account a morning list of what is due today and anything overdue,
sending nothing on a day with neither. It runs inside Postgres - pg_cron wakes it
hourly, it works out whose local morning it is, and pg_net posts to an email API.
There is no server and no function to deploy; the file explains the setup, which
needs an email provider and a domain to send from.

Once it is scheduled, set `DAILY_EMAIL: true` in `js/config.js` and a switch
appears in each account's settings.

### How the garden economy works

Tickets can carry a checklist of steps. Ticking steps off shows progress on the
ticket row, but only completing the ticket itself pays a coin - otherwise a
ten-step ticket would be worth ten times a one-step one.

Completing a ticket pays one coin, once. The ledger of which tickets have already
paid sits in `coins-awarded-v1`, so un-ticking a ticket takes its coin back and
re-ticking it does not mint a second one. Deleting a completed ticket leaves the
coin alone - the work was still done.

Plants are bought, not granted: one coin each, a random variety and pot colour,
placed next to the gardener. They are objects in their own right, so they stay
where you put them and survive the ticket that paid for them being edited or
deleted.

---

## Known limits

- Cloud mode resolves conflicts last-write-wins. Edit the same ticket on two
  devices while one of them is offline and the later write survives. For one
  person on a few devices this is nearly never noticeable; for shared lists it
  would need real merge logic.
- There is no sharing or assigning between accounts yet. The schema is per-row
  rather than one blob per user partly to leave that door open.
- The garden expects a keyboard, so it is best on a laptop. On a phone the
  tickets come first and the garden sits at the bottom.

## Licence

MIT — see [LICENSE](LICENSE). Do what you like with it.
