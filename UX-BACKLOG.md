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
