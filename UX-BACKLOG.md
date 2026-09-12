# Tend UX backlog

Findings from UX sweeps of the app, and what was decided about each one. The
`tend-ux` agent appends to this file; decisions come back from the **Tend UX
Ledger** artifact, where each finding is approved, declined or deferred.

This file is the memory that stops a later sweep re-reporting something already
looked at. A declined row stays declined.

Ids are permanent. Never reuse one, even for a row that was declined.

**Status** — `open` (awaiting a decision) · `approved` (build it) · `declined`
(not doing it) · `later` (real, not now) · `done` (shipped, with the commit)

---

## Open and decided

All seven of the first sweep were approved in the ledger and shipped in
`Make Tend reachable by keyboard and readable on a phone`.

| Id | Finding | Area | Sev | Effort | Status |
|---|---|---|---|---|---|
| ux-0001 | `F` in the garden instantly finishes every sapling | garden | high | small | done |
| ux-0002 | Modals are not dialogs — no focus trap, no focus return | a11y | high | medium | done |
| ux-0003 | Toasts are never announced to a screen reader | a11y | medium | small | done |
| ux-0004 | No `:focus-visible` styling anywhere in the app | a11y | medium | medium | done |
| ux-0005 | Eleven unlabelled help icons, tooltip-only on touch | garden | medium | medium | done |
| ux-0006 | "Show recurring" is filed under the Completed heading | tasks | medium | small | done |
| ux-0007 | The undo toast expires in 5s, taking Undo with it | tasks | low | small | done |

Second sweep, 2026-09-11. Nine new findings, awaiting a decision.

| Id | Finding | Area | Sev | Effort | Status |
|---|---|---|---|---|---|
| ux-0008 | Steps on a repeating task's next copy cannot be ticked | tasks | high | small | open |
| ux-0009 | Task rows and calendar days are click-only, so the keyboard cannot open them | a11y | high | medium | open |
| ux-0010 | The three controls on a task row have no accessible name | a11y | medium | small | open |
| ux-0011 | A task row's controls are thumb-sized nowhere on a phone | mobile | medium | small | open |
| ux-0012 | A failed sign-in says nothing a screen reader can hear | auth | medium | small | open |
| ux-0013 | Going offline is invisible on a phone | sync | medium | small | open |
| ux-0014 | A new version reloads the page out from under whatever is half-typed | sync | medium | medium | open |
| ux-0015 | Segmented toggles say which one is chosen with colour alone | a11y | medium | small | open |
| ux-0016 | An empty "Completed" heading sits under the task list for ever | tasks | low | small | open |

---

## The findings in full

### ux-0001 — `F` in the garden instantly finishes every sapling
**garden · high · small · done · swept 2026-09-10**

`js/garden.js:2041` — pressing `F` with the garden focused sets `waterCount`
to `SAPLING_WATERS_NEEDED` on every planted sapling and saves. It is a
development shortcut that shipped. One stray keypress skips the watering loop
the entire reward system is built on, permanently and with no undo, and `F`
sits right next to the WASD keys used to walk.

**Fix:** remove the branch. If it is worth keeping for development, gate it
behind a flag in `js/config.js` that is off by default, so `build.py` never
ships it live.

**Refs:** `js/garden.js:2041`

---

### ux-0002 — Modals are not dialogs — no focus trap, no focus return
**a11y · high · medium · done · swept 2026-09-10**

The five modals in `index.html` (lines 259, 267, 321, 374, and the day/detail
modal) are plain `div`s. None carries `role="dialog"`, `aria-modal="true"` or
an `aria-labelledby` pointing at its own heading, and nothing traps focus. With
the New Task modal open, Tab walks straight out into the task list behind it,
and closing the modal drops focus back to the top of the document rather than
the button that opened it — so a keyboard user adding three tasks re-traverses
the header three times.

**Fix:** give each modal `role="dialog"`, `aria-modal="true"` and
`aria-labelledby` on its `<h3>`. On open, record `document.activeElement`; cycle
Tab and Shift+Tab within the modal; on close, restore focus to the recorded
element. The Escape handler at `js/app.js:3249` is the right place to hang the
restore, since it already closes all four.

**Refs:** `index.html:259`, `index.html:267`, `index.html:321`, `index.html:374`, `js/app.js:3249`

---

### ux-0003 — Toasts are never announced to a screen reader
**a11y · medium · small · done · swept 2026-09-10**

`js/app.js:3073` builds `#sync-toast` with no `aria-live` and no `role`. Every
piece of transient feedback in the app goes through it — the coin you just
earned, "Updated from your other device", the date a recurring task comes back
on, and the Undo offer at `js/app.js:3092`. None of it is announced. A screen
reader user completes a task and hears nothing at all.

**Fix:** set `role="status"` and `aria-live="polite"` on the element when it is
created. Give the undo variant `aria-live="assertive"`, since it carries an
action that expires.

**Refs:** `js/app.js:3073`, `js/app.js:3092`

---

### ux-0004 — No `:focus-visible` styling anywhere in the app
**a11y · medium · medium · done · swept 2026-09-10**

`css/styles.css` has no `:focus-visible` rule in 4,219 lines. The app is built
almost entirely from custom-styled `button`s, and several set their own
backgrounds and borders, so the browser's default ring is either invisible
against them or suppressed outright. Tabbing through the header, the tab row,
the shop and the eleven help icons gives no reliable sign of where you are.

**Fix:** one `:focus-visible` rule with a 2px outline and offset, in a token
that reads on both themes, plus a `:focus:not(:focus-visible)` reset so mouse
clicks stay clean. The garden plot at `index.html:83` needs its own treatment —
it is `tabindex="0"` and the whole interaction depends on knowing it has focus.

**Refs:** `css/styles.css`, `index.html:83`

---

### ux-0005 — Eleven unlabelled help icons, tooltip-only on touch
**garden · medium · medium · done · swept 2026-09-10**

`index.html:105` opens a row of eleven `.help-icon-btn`s — coins, water, cash
in, pick up, axe, hoe, shovel, sapling, cabin, pets, unlock — each an emoji or
inline SVG whose only label is a `title`. On a phone there is no hover, so the
titles never appear and the only way to find out what any of them does is to
tap all eleven and read the panel. Undifferentiated icon rows are also the
first thing to blur together on a desktop: nothing groups the tools apart from
the mechanics.

**Fix:** give each button an `aria-label` matching its `title` so it is at
least reachable, then group the strip — mechanics (coins, water, cash in,
unlock) apart from tools (axe, hoe, shovel) apart from life (sapling, cabin,
pets) — with a visible caption per group. On narrow widths, a labelled list
beats a row of icons.

**Refs:** `index.html:105`

---

### ux-0006 — "Show recurring" is filed under the Completed heading
**tasks · medium · small · done · swept 2026-09-10**

The three reveal toggles sit in the Completed section's header
(`index.html:191`–`195`), so the control for recurring tasks waiting for their
day reads as belonging to Completed — which is the one thing it is not. Worse,
the section it opens (`index.html:181`) renders *above* the header that holds
its toggle, so pressing "Show recurring" makes content appear off-screen
upward. Same for Archived.

**Fix:** move the toggle row out of the Completed header into its own line
under the task feed, ahead of the three revealable sections, so each toggle
sits above what it reveals and none of them inherits a heading that misnames
it.

**Refs:** `index.html:181`, `index.html:191`, `index.html:195`

---

### ux-0007 — The undo toast expires in 5s, taking Undo with it
**tasks · low · small · done · swept 2026-09-10**

`js/app.js:3092` shows the Undo button inside a toast that removes itself after
5,000ms. That toast is the only Undo affordance at the place the action
happened; after it goes, the route back is the header button at
`index.html:61`, which is across the page and names what it will undo only in a
`title` — invisible on touch, and never announced while it is `disabled`.

**Fix:** keep the toast up while the pointer is over it, and cancel the timer
on focus so a keyboard user can reach the button. Separately, put the label on
the header Undo itself ("Undo: completed *Water the plants*") rather than in a
`title`.

**Refs:** `js/app.js:3092`, `index.html:61`

### ux-0008 — Steps on a repeating task's next copy cannot be ticked
**tasks · high · small · open · swept 2026-09-11**

`js/app.js:764` — when a repeating task is ticked off, `spawnRepeat` copies its
steps across as `{ title, done: false }` with no `id`. The row then renders each
step's checkbox as `App.toggleSubtask(taskId, 'undefined')` (`js/app.js:878`),
and `toggleSubtask` looks the step up by id (`js/app.js:859`), finds nothing and
returns. So on every recurring task after the first, ticking a step does
nothing at all: the `0/3` counter never moves, and the box un-ticks itself the
next time anything redraws the list. A weekly checklist — which is the reason to
put steps on a repeat in the first place — is dead on arrival, and nothing says
so. Editing the task and pressing Save quietly repairs it, because
`readSubtaskEditor` backfills a missing id (`js/app.js:946`), but nobody would
ever guess that.

**Fix:** give each copied step an id in `spawnRepeat` —
`subtasks: subtasksOf(t).map(sub => ({ id: Util.uid(), title: sub.title, done: false }))`.
Tasks already saved carry idless steps, so also backfill defensively: either in
`subtasksOf`, or once on boot beside `pruneRepeats`, assign `Util.uid()` to any
step without one and save.

**Refs:** `js/app.js:764`, `js/app.js:878`, `js/app.js:859`, `js/app.js:946`

---

### ux-0009 — Task rows and calendar days are click-only, so the keyboard cannot open them
**a11y · high · medium · open · swept 2026-09-11**

Every row and cell in Tend that opens something is a bare `li` or `div` with an
`onclick` and no `tabindex`, no `role` and no key handler: the task row
(`js/app.js:1389`–`1390`), each calendar square (`js/app.js:1985`), each task
listed inside a day (`js/app.js:2032`) or under Due today (`js/app.js:1492`),
and each row of Tasks by category (`js/app.js:3155`).

A keyboard or switch user can reach the Calendar tab and then cannot open a
single day — there is no other route to a day's tasks anywhere in the app, so a
whole view is reachable but unusable. On the task list they can still tab to the
checkbox, the star and the ⋯ menu, but not to the detail panel, which is where
the created date, the notes, the steps and the repeat rule now live.

**Fix:** make each of them a real control. The task row's opener is cleanest as a
`button` filling the row's body — the checkbox, star and menu are already
siblings outside it, so Enter and Space would open the detail and
`taskRowClick`'s guard against nested controls stops being needed. For the
calendar squares, the `day-task` items and the `cat-task` items, either use
`button`s styled to fill the cell or add `tabindex="0"`, `role="button"` and a
keydown handler for Enter and Space. While there, give each calendar square an
accessible name that includes its date and counts ("11 September, 2 due")
instead of the bare day number.

**Refs:** `js/app.js:1389`, `js/app.js:1390`, `js/app.js:1985`, `js/app.js:2032`, `js/app.js:1492`, `js/app.js:3155`

---

### ux-0010 — The three controls on a task row have no accessible name
**a11y · medium · small · open · swept 2026-09-11**

The tick box at `js/app.js:1391` carries no label of any kind, so a screen reader
announces "checkbox, not checked" with nothing to say which task it belongs to —
and it is the most-used control in the app. The star (`js/app.js:1380`) and the
⋯ menu (`js/app.js:1401`) are glyph-only buttons, so their text content wins the
accessible name and they announce as "white star" and "midline horizontal
ellipsis"; the useful wording is in a `title`, which a phone never shows. The
steps chip (`js/app.js:1364`) announces "ballot box 1/3". Subtask checkboxes
(`js/app.js:878`) are unlabelled too. Same shape as ux-0005, on the screen
people actually live in.

**Fix:** set an `aria-label` built from the task's own title on each row control:
"Finish *Water the plants*" on the checkbox (and "Mark *Water the plants* as not
done" when it is ticked), "Star *Water the plants* as priority" / "Unstar" on
the star, "More actions for *Water the plants*" on the ⋯ button, and "Show the
steps for *Water the plants*, 1 of 3 done" on the chip — escaped the same way
the visible title already is. The existing `title` attributes can stay or go;
the `aria-label` is what carries the meaning.

**Refs:** `js/app.js:1391`, `js/app.js:1380`, `js/app.js:1401`, `js/app.js:1364`, `js/app.js:878`

---

### ux-0011 — A task row's controls are thumb-sized nowhere on a phone
**mobile · medium · small · open · swept 2026-09-11**

On a phone the tick box is 18x18px (`css/styles.css:477`), the star is about
22x18 and the ⋯ menu about 25x22 (`css/styles.css:1399`, `css/styles.css:1288`),
and `.task-actions` leaves 2px between the last two (`css/styles.css:1393`).
Nothing in the phone layout enlarges any of them — the category colour swatches
got exactly that treatment a breakpoint away, these did not. All three are well
under the 44px a thumb needs, and because the row itself opens the detail modal
on click (`js/app.js:1390`), a near-miss on the star or the menu does not simply
miss: it opens a modal you then have to dismiss.

**Fix:** under `html[data-mode="phone"]`, grow the tick box to 24x24 with padding
around it, give `.star-btn` and `.row-menu-btn` `min-width: 44px` and
`min-height: 44px` with the glyph centred, and raise `.task-actions`' gap to
8px. Leave the glyph sizes alone and let the padding do the work, so the row
height barely moves.

**Refs:** `css/styles.css:477`, `css/styles.css:1393`, `css/styles.css:1399`, `css/styles.css:1288`, `js/app.js:1390`

---

### ux-0012 — A failed sign-in says nothing a screen reader can hear
**auth · medium · small · open · swept 2026-09-11**

Every message on the auth gate goes into one `div` built by `msgSlot()`
(`js/auth.js:215`) that has no `role` and no `aria-live`, and which
`css/styles.css:2112` keeps at `display: none` until a kind class is added.
Nothing is ever announced. A screen reader user mistypes their password, presses
Sign in, and gets silence: `message('error', …)` at `js/auth.js:253` paints "That
email and password combination did not work" above the form, focus stays on the
submit button, and the only other change is the button's label flipping back
from "Signing in..." to "Sign in". There is no signal that anything failed, and
no signal what to fix. This is the first screen of the app and the one place a
person can be stuck at entirely.

**Fix:** give the slot `role="alert"` and `aria-live="assertive"`, and keep it in
the accessibility tree — swap the `display: none` default for an empty box with
no padding, or toggle `hidden`, so it is the text changing that gets announced
rather than the element appearing. Then have `submitSignin` (and the signup,
reset and new-password handlers) move focus to the field that needs correcting:
the password box for bad credentials, the email box for an unknown or
unconfirmed address.

**Refs:** `js/auth.js:215`, `js/auth.js:207`, `js/auth.js:253`, `css/styles.css:2112`

---

### ux-0013 — Going offline is invisible on a phone
**sync · medium · small · open · swept 2026-09-11**

The sync badge (`index.html:41`, filled in by `renderSyncBadge` at
`js/app.js:2223`) is the only thing in Tend that ever says "Offline — saved on
this device". `css/styles.css:2462` hides it outright under 720px — which is
every phone, the device most likely to be on a bad connection. A cloud-mode user
on the train ticks tasks off, watches them appear, and has no way of knowing
that `flush()` is failing and retrying every 15 seconds (`js/store.js:329`).
Nothing is lost while the browser keeps its cache, but nothing tells them not to
sign out, clear the site, or expect any of it on the laptop yet. It is also a
plain `span` with no `role`, so even on a desktop the change from "Saved to your
account" to "Offline" is never announced.

**Fix:** on narrow screens hide the badge's label rather than the badge, keeping
the dot, and let the `offline` and `saving` states show their word again —
"Offline" is the one state worth the space. Add `role="status"` and
`aria-live="polite"` to `#sync-badge` so the wording is announced when it
changes. And fire the existing toast once on the transition into `offline`
("Offline — changes are saved on this device and will sync when you are back"),
since on a phone the toast is the surface people actually see.

**Refs:** `css/styles.css:2462`, `js/app.js:2223`, `index.html:41`, `js/store.js:329`

---

### ux-0014 — A new version reloads the page out from under whatever is half-typed
**sync · medium · medium · open · swept 2026-09-11**

The service worker calls `skipWaiting()` on install (`sw.js:43`) and
`clients.claim()` on activate (`sw.js:52`), and `boot.js:59` asks it to check for
an update every time the tab becomes visible, gains focus or is shown. So a
deploy that lands while Tend is open takes over at once and `js/boot.js:81` calls
`location.reload()` — in practice the moment you tab back to the app.

Tasks and the garden survive, because `Store` writes localStorage synchronously
on every change. Everything not yet committed does not: a New Task modal you were
part way through, an unsaved edit, a display name being typed in Settings, the
search you had the list filtered to, where you were scrolled. Nothing warns
beforehand and there is no way back afterwards.

**Fix:** do not reload while there is unfinished input. On `controllerchange`,
if any modal backdrop is `active` or `document.activeElement` is a field with a
value, hold the reload and show the toast instead — "A new version of Tend is
ready" with a Reload button — and reload on the next close of the last modal if
it is ignored. That toast is the better default in every case: it turns a page
that vanishes into a page that offers. `App.checkForUpdate` (`js/app.js:2590`)
already has the wording and the plumbing to share.

**Refs:** `js/boot.js:81`, `js/boot.js:59`, `sw.js:43`, `sw.js:52`, `js/app.js:2590`

---

### ux-0015 — Segmented toggles say which one is chosen with colour alone
**a11y · medium · small · open · swept 2026-09-11**

Every segmented control in the app marks the chosen option by adding an `on`
class and nothing else — By category / By date / By status
(`js/app.js:1080`), Numbers / List (`js/app.js:1826`), Still to do / Everything
(`js/app.js:3123`), the theme tiles, the layout tiles and the world chooser. And
`.cat-toggle button.on` at `css/styles.css:3692` changes only the background tint
and the text colour, at the same font weight, so which one is live disappears in
greyscale or with a red-green deficiency. No `aria-pressed` is set anywhere, so
a screen reader reads three identical buttons with no hint which is on. The top
tabs (`js/app.js:1678`) and the bottom nav (`js/app.js:1692`) have the same gap
on the aria side: `active` is a class only, with no `aria-current`.

**Fix:** two parts. Give `.cat-toggle button.on` a cue that is not colour — a 2px
inset ring in the accent, or the segment's own border — so the choice survives
greyscale. Then set `aria-pressed="true"|"false"` on each button as it is built
in `renderListGroupToggle`, `renderCalViewToggle`, `renderCategoryScopeToggle`,
`renderThemePicker`, `renderViewModePicker` and the world chooser, and set
`aria-current="page"` on the active tab and bottom-nav button in `switchView`,
removing it from the rest. `App.pickCategoryColor` already does exactly this
`aria-pressed` dance for the colour swatches and is the pattern to copy.

**Refs:** `css/styles.css:3692`, `js/app.js:1080`, `js/app.js:1826`, `js/app.js:3123`, `js/app.js:1678`, `js/app.js:1692`

---

### ux-0016 — An empty "Completed" heading sits under the task list for ever
**tasks · low · small · open · swept 2026-09-11**

Show recurring and Show archived hide their whole `section` (`js/app.js:1165`,
`js/app.js:1169`). Show completed hides only the `ul` inside it
(`js/app.js:1160`). So the task list always ends with an uppercase COMPLETED
heading, 28px of margin, and nothing underneath — a heading for a section that
is shut. The button's `aria-controls` points at `completed-section`
(`index.html:209`), which is never hidden (`index.html:225`), so
`aria-expanded="false"` describes an element a screen reader can walk straight
into and find empty.

**Fix:** hide the section rather than the list —
`document.getElementById('completed-section').style.display = showCompleted ? '' : 'none'`,
matching the two lines beside it. That also makes `aria-controls` true as
written, and leaves the reveal-toggle row as the last thing on the page when all
three are collapsed.

**Refs:** `js/app.js:1160`, `js/app.js:1169`, `index.html:225`, `index.html:209`
