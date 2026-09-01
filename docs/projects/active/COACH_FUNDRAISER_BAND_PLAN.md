# Coach Money — The Drive Opens In Place (the fundraiser drill-in retires)

**Status:** BUILT ON DEV 2026-08-31 (all phases A–E, same day as planning) · Owner QA **§125** owed —
walked inside **§122's amended walkthrough** (Artifact `cf860db9-e202-4274-b572-d5f29284aca0`;
owner direction 2026-08-31: no separate walk — new parts N + W, parts C + D rewritten for the
band; the standalone `bac0cb60…` walk is superseded) · still owed: `check:layout` reseed+sweep,
marketing slide #04 retake · owner-approved direction (design session 2026-08-31, three rounds)
**Approved mockup (binding):** Artifact "Fundraiser Drill-In Redesign", **round 3** version —
source `docs/projects/active/FUNDRAISER_DETAIL_DESIGN_MOCKUP.html`
(https://claude.ai/code/artifact/a7efae7e-c11c-4bfa-b3ea-43f4028d4e12). Rounds 1–2 in the
artifact's history show the rejected alternatives (drill-in refinements; a modal, refused).
**Design ruling:** `memory/design_decisions.md` 2026-08-31 entry ("A DRIVE OPENS IN PLACE").
**PM brief:** `COACH_FUNDRAISER_BAND_PM_BRIEF.md` (same folder).
**Migration:** none. **Owner QA:** a new ledger § is owed after the build.

---

## 1. What changes, in one paragraph

A drive (team fundraiser) stops drilling into a separate `?fundraiser=` sub-view of the
Fundraisers tab. Its list row expands **in place** — exactly the construction the sponsor band
settled on the §121/§122 walks: a facts-only meta line, one **sibling row per logged entry
sharing the parent table's columns** (never a nested table), and a closing row with the two
doors (**Record** primary, **Edit** secondary). The board becomes **entries-first**: one row per
logged amount, never one row per roster player. The drill-in state, its nested page header, back
link, four per-drive tiles, Rank column, floating "15% player rebate" line and "Left to send"
dues column all retire. `detail.tsx` is deleted at the end (its sponsor half is already dead code
awaiting exactly this).

## 2. Binding constraints (rulings this plan must not re-litigate)

- **A modal is for a QUESTION** (2026-08-26) — the owner asked about a modal and refused it
  himself on this ruling; do not resurrect it. The Edit sheet (a form) stays a modal; the working
  surface does not.
- **Meta line = FACTS ONLY, never restating the columns above** (2026-08-29):
  `Credits families 15% · 3 of 12 players logged · Jun 1 → Jun 30 · <tags>`. The base of the %
  ("of what they raise") lives in the Edit sheet and help — the same trim the sponsor band took
  ("of each arrival"). A fresh drive keeps one state sentence ("Nothing logged yet.") under that
  ruling's own guard. Dates absent → clause absent; tags absent → absent.
- **Expansion rows are SIBLING rows of the parent table** (§122 lesson, documented in
  SponsorBand): identical cell count on every row, entry amounts literally under **Amount**,
  credits under **Credits**. A nested table cannot align by construction.
- **The reopen verb is Edit, never Settings** (§121). The drill-in's "Settings" button was drift;
  the band's door and the sheet's title both say Edit.
- **One word: credit** (2026-08-24 one-spelling ruling's spirit). "Rebate" leaves every
  customer-visible string on this surface. **Identifiers, API field names and DB columns are NOT
  renamed** (`rebate_percent`, `rebateAmount` etc. stay — a rename there is a migration, and the
  spelling ruling explicitly exempts identifiers).
- **Check-then-act** (`memory/reference_coach_money_check_then_act.md`) — no server contract
  changes here, but every touched write keeps re-asserting org+team+record in its WHERE.
- **⚠⚠ The re-dating gotcha survives verbatim** (/review Critical, 2026-08-23): the inline
  Edit-amount editor pre-fills the date the coach already sees (`effectiveDate`) and sends
  `receivedDate` **only when actually changed** — an untouched box sends nothing, or editing an
  old entry's amount silently moves its ledger row and family credit into the current month.

## 3. Build phases (one pass — build the full feature, then verify)

### Phase A — the band

- `fundraisers/panel.tsx`: a drive id in `?fundraiser=` stops rendering `FundraiserDetail` and
  joins the sponsor path — one `openId` for both bands (the param already means "the open
  record"; only the drive branch changes). Deep links land with the row open and scrolled into
  view (reuse the `sponsorBandRef` scroll pattern at row level).
- Row toggle: the drive's name is currently a `Link` to the drill-in (kept deliberately for
  keyboard/screen-reader reachability — panel.tsx's own comment). Since no destination page
  exists anymore, the name becomes a **button** that toggles, carrying `aria-expanded`; the
  trailing "Open ▾ / Close ▴" affordance toggles too. Match sponsor rows' behaviour; if trivially
  cheap, give the sponsor row's toggle the same real-button semantics (its `tr onClick` is the
  pattern that comment warns about) — otherwise note it and leave sponsors untouched.
- Expansion content per the mockup: meta line row → entry rows → doors row. Reuse
  `sponsorSubCell` styling classes; keep every expansion row at the parent's exact cell count
  (six for the drives table).
- Entry row: player name + received date (`formatStoredDate`, falling back to the effective
  date), amount under **Amount**, credit under **Credits**, actions **Edit amount** / **Remove**.
  Entries sort largest-first — that IS the leaderboard, wordlessly (Rank column retired).
- A player no longer on the active roster renders their entry like any other, with a quiet
  "no longer on roster" note beside the name. This retires the `hiddenEntryCount` machinery and
  the delete-refusal copy that pointed coaches at rows the board could not show.

### Phase B — entries-first data

- The entries endpoint (`fundraisers/[fundraiserId]/entries` GET) gains a flat `entries` array —
  every entry on the drive **regardless of the player's roster status** (join for the player
  name, carry an `active` flag) — plus `rosterCount` (active roster size) for the meta line's
  fraction. The fraction counts entries belonging to active players ("3 of 12"); an inactive
  player's entry is visible but outside the fraction.
- The roster-projected `players` array (and per-player `openBills` / `leftToSend`) remains in the
  response only as long as anything consumes it; when `detail.tsx` is deleted in Phase D, check
  remaining consumers (the Record window sources its own data) and drop the dead weight from the
  response if nothing reads it — server work stays in the same unit as its reader's retirement.

### Phase C — doors and forms

- **Record** (primary, `btnPrimary`): opens the one recording conversation locked to this drive
  — branch `drive`, no pre-picked player (the per-row Record door retires; the window's player
  list already only offers players with nothing logged). Absent on a closed drive.
- **Edit** (secondary, pencil): the existing settings sheet moved out of `detail.tsx` into the
  band, drive fork only — title **"Edit fundraiser"**, same fields (name, description, credit %,
  status, dates, tags), same discard guard, same `RecordEditorFooter` guarded delete. Two
  simplifications the move buys: the delete no longer navigates (collapse the row + money-bump,
  like `deleteSponsor` — the `deletedRef` guard against the post-delete refetch 404 must survive
  in whatever form the band needs); and the refusal copy drops its hidden-entries paragraph
  (entries-first shows every entry, so "remove them from the list first" is now always
  followable).
- **Edit amount** (per entry): swaps the entry row for the inline amount / date / notes editor —
  the drill-in's editor relocated, keeping the pre-fill + only-send-if-changed date rule (§2) and
  the Save/Cancel buttons. Dead on a closed drive (`title="Fundraiser is closed"`), like today.
- **Remove** (per entry): unchanged behaviour — dollars-stated confirm (both figures: off the
  books, off the family's dues), live even on a closed drive (it is the only unwind door; the
  dues drawer's refusal sends coaches here).
- The drill-in's fallback in-place ADD path (for a mount with no recording conversation around
  it) dies with the drill-in — the band only exists inside the hub, where the conversation is
  always reachable. Verify no other mount of the panel exists without the hub before deleting.

### Phase D — retirement and sweeps

- Delete `detail.tsx` (both halves — the sponsor half has been dead since Direction A; this
  completes the file). Move `fmt` to `lib/coach-fundraising.ts` first (panel + SponsorBand import
  it from `./detail` today).
- The legacy standalone route (`fundraisers/[fundraiserId]/page.tsx`) already redirects into
  `?fundraiser=` — verify it now lands on an open band row and keep it.
- Vocabulary sweep, customer-visible strings only: the "Rebate earned" concept → **Family
  credit** wherever it survives (entry rows, the Edit sheet's hint line, `lib/coach-money-exports`
  fundraiser column labels, help articles in the Phase E sweep). Grep this surface for `rebate`
  before calling it done; identifiers stay.
- Grep for `FundraiserDetail` / `'./detail'` imports and for `{ fundraiser:` deep-link senders
  (`lib/coach-budget-months.ts` builds "Open ⟨name⟩" doors; the Money overview and dues drawer
  link in) — all keep working unchanged, but each named sender gets a manual click-through in QA.

### Phase E — tests, help, demo (same unit of work)

- **UAT:** `coach-money-mobile-smoke.spec.ts` targets "Fundraiser detail" URLs twice — re-point
  at the band-open state (⚠ waits keyed to elements, never copy — standing memory). The drive
  legs of `coach-sponsor-money-lifecycle.spec.ts` (guarded delete, R5-A remove) re-drive through
  the band UI where they touch the browser; API-level legs unchanged. RUN them, don't just edit.
- **Unit:** `coach-page-actions-guard.test.ts` references the drill-in's nested header —
  re-anchor. `coach-frozen-season-smoke` seeded a past-only fundraiser + live-only player
  specifically to trap the drill-in's wrong-season roster defect (2026-08-14) — check what of it
  survived the season-close rework and re-anchor whatever still runs.
- **Layout sweep:** the `coach-fundraiser` screen in `scripts/layout-screens.mjs` re-points at
  the band-open URL rather than leaving the inventory — the 361px sideways-overflow defect was
  caught on exactly this surface, and expansion rows inherit the same lesson (**anything that
  must yield at a breakpoint cannot be an inline style**). ⚠ Reseed before `check:layout`
  (green-over-empty-fixture memory); `scripts/uat-fixture-context.mjs` already resolves a
  `fundraiserId`.
- **Help:** `/docs` sweep of `premium-money-fundraisers` — it describes opening a fundraiser's
  own screen, and says "rebate"; keywords/searchText arrays included (one-spelling ruling covers
  them).
- **Demo:** ⚠ CLAUDE.md standing instruction — **re-read the WHOLE coach-money narration**
  (dock lines + tour steps), stale across three releases; this change restructures a screen it
  narrates. Adjust any step that opens a fundraiser; run `npm run check:demos` (dev-only
  self-heal; proves nothing about prod).
- **Gates:** `npm run verify:changed`; `npm run typecheck` (shared modules move:
  `lib/coach-fundraising`, exports lib); `npx next typegen` first if types complain (Next 16.3
  memory).

## 4. What deliberately does not change

The recording conversation and its "where it lands" preview; the Edit sheet's fields,
foreseeable-refusal behaviour and guarded delete semantics; the season rollup tiles; the sponsor
band; Import/Export; the tab's phone card-stacking (expansion rows ride `tableAsCards` +
`data-label` exactly as the sponsor band's do); closed-drive rules (no new money, corrections
allowed); `fundraiser` staying in the hub's `ONE_SHOT_KEYS`; and the standing owner call
(2026-08-14) that fundraiser exports are **totals-only, never per-player** — do not add a
per-player file without asking again. **Undoing/re-opening decisions from other plans are not
touched in passing.**

## 5. Accepted tradeoffs (owner, 2026-08-31)

A fully-logged drive opens tall (~one row per participant) and scrolls with the page like a busy
sponsor. Rank retires; largest-first sort carries the leaderboard reading. If a real season shows
a coach living inside one big drive daily, a drives-only drill-in can return — nothing here
forecloses it, and this plan does not build it.
