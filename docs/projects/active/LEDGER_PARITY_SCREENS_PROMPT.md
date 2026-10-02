# Ledger Parity · session 2 — the coach's Ledger reads like the club's; Tools; Payees for every team; shared payees in the picker

> Paste into a fresh session on `dev` **after session 1 (`LEDGER_PARITY_SERVER_PROMPT.md`) is committed**. Its call
> list (routes, shapes, refusal codes and words, the picker's scope marker, the D7b counts) is in
> `LEDGER_PARITY_PLAN.md`. Written 2026-10-02, the day the drawings were **ratified** — D1–D7, D7a, D7b, every one as
> recommended.
>
> **The spec is the hub:** https://claude.ai/artifact/EQqEd3s4CBLbnrnPuUVAAo → Mockup screens 2–8, Decisions.
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every marker's dialog ("What the
>   proposal does") and every NEW tag note is a requirement — open each one.
> - The AFTER frames were drawn **on the live pages** (the change applied in the page), so each is the product's own
>   geometry: match them, don't redraw them.
> - **Superseded inside the hub, follow the later screen:** screen 2's Payees *button* → screen 7's Tools menu (D6);
>   screen 6's "on a phone, the View menu's foot" → D6's Tools sheet on a phone.
> - Where you must depart, say so at build time and record why; never silently.
>
> **Read first:** `LEDGER_PARITY_PLAN.md` (whole), memory `project_ledger_parity`,
> `feedback_portal_is_the_formatting_benchmark`, `feedback_build_to_approved_mockups`,
> `decision_one_toolbar_rare_tools_behind_tools`, `decision_record_reads_first_edits_whole`,
> `decision_edit_autosaves_create_asks`, `decision_autosave_word_is_transient`, `decision_drawer_layers_form_vs_menu`,
> `feedback_shared_component_over_shared_class`, `project_coach_row_list_recipe`, `project_coach_phone_list_frame`;
> the in-repo `memory/design_decisions.md` entries from 2026-10-01 on (one admin button size; a toolbar door is a
> button; olive text is a card-foot door; no club name above a page title).

## Preconditions (check before code)

1. **Session 1 is committed**; read its call list.
2. **The UX summary for the owner comes first** — short: what a coach in a club, a standalone coach and a club
   treasurer each see differently, and any departure from the drawings.
3. **Git and the dev server:** private index, explicit pathspecs; **ask before** a restart, a sweep or `auth-setup`
   (one browser tester at a time — the owner may be walking). ⚠ A saved UAT session goes Unauthorized after several
   probe runs: run `auth-setup` (after asking) right before a capture batch.

## Part 0 · Record the rulings where the product reads them (its own commit, first)

- **`memory/design_decisions.md`** (newest first) + its `memory/MEMORY.md` line, in the same change: **the two Ledgers
  read the same** — D1 (a ledger row prints the day; the year is said once, on the balance rows), D2 (both portals'
  Starting / Opening / Ending balance rows name their full dates; the club's under-table note goes), D3 (no control
  in a ledger cell on either portal except Record on an unpaid installment; a row another tab wrote opens a read
  window naming its home), D4 (one phone card for a ledger row), D6 (a rare tool goes behind Tools on both Ledgers;
  Payees is not a tab), D7's picker words ("Shared by your club" / "Your team's own" + the notice line).
- **`docs/agents/design/TABLE_EXCEPTION_REGISTER.md`:** K-01 and K-25 name the coach's Ledger and the club's as ONE
  recipe; the hub's screen 9 ("What stays different") goes in as the named differences between the two Ledgers, each
  with its reason, so the next comparison starts from it.

## What to build (by hub screen)

### Screens 2 and 7 · the coach's Ledger (D1, D2, D3, D6)

- **D1:** one ledger-date rule for a register row: the day only (`formatStoredDate(d, { withYear: false })` — the
  club's `day()`); never a hand-roll.
- **D2:** the Starting / Opening / Ending balance rows read "Starting balance · Sep 1, 2026" — the window the Date pill
  holds, full date with the year.
- **D3:** every row opens on a click; the last column is **one chevron**; the name in What is the row's keyboard door
  and is bold (the club's `nameButton` pattern). Leaves the cell: the pencil (`RowEditButton` — check its other
  callers before touching the component) and the worded `Link` ("Player Dues →", "Club →", `r.sourceLabel`). Stays:
  **Record** beside the chevron on an unpaid installment (`settle`, ruled 2026-09-04). A typed entry or a bill opens
  exactly as today. **A row another tab wrote opens a read window** (hub screen 4): its facts (amount, category, date,
  the family or payer, method), one sentence naming where it is changed ("Recorded on Player Dues. Change it there, and
  the Ledger follows."), and one button to go there (Open Player Dues / Open Fundraising / Open Club). It is the club's
  window for a line another screen wrote (`LedgerWindows` `LineWindow`'s read shape) **shared, not copied** — promote
  the read shape to the shared kit if the coach can't import it. It shows for a read-only money assistant too.
- **D6 Tools:** the toolbar reads View · Export · **Tools** · Add a bill. Tools is the portal's `CoachToolbarMenu`
  (a sheet on a phone): heading "The team's lists", item **Payees** ("Rename a payee or merge two spellings").
- Keep: the coloured row edge, Item, Tags, Cash on hand (screen 9).

### Screen 5 · the coach's phone card (D4)

- The coach's register at phone width takes the club's ledger card (K-25: date top right, bold name, its caption,
  labelled lines, one corner chevron; the balance lines plain between the cards, never a card). **Promote the club's
  recipe to the shared kit** and render both Ledgers from it — never a second card. An unpaid installment's card keeps
  Record.

### Screens 6–8 · Payees (D5, D6, D7)

- **The coach's Payees page:** one level down from the Ledger (back arrow "Ledger", no tab row), the club's Payees
  page's shape: Payee · Entries · Last used, a payee window whose name saves as you type (the fading "Saved"), Merge
  asks, Delete only when nothing names it. A club team also lists **Shared by your club** (read-only, the club's
  blue), and Merge's "Keep" offers the shared payees first, marked as the club's. A standalone team has no shared
  section. Note under the table — words by `/marketing` (draft: "The team's payees only: the club's are the club's.").
- **The payee picker** (`PayeeCombobox`), on a coach's form: the section "Shared by your club" (the tag legend's own
  words and blue) with the line "Your club sees payments to these payees." under it; "Your team's own"; and a foot row
  **Manage payees…** opening the Payees page. The club's own pickers are unchanged.
- **The club's Ledger:** Book · Export · **Tools** · Add entry. Tools: "This book" → Transfer, "The club's lists" →
  Payees. The Payees button (added 2026-10-01) and the Transfer button leave the toolbar. On a phone, Tools is the ⋯
  icon opening a sheet; the Book pill's foot keeps Add ledger only.
- **The club's Payees page:** a **Teams** column ("Shared with teams" chip in the club's blue / "The club's own"), a
  **Shared with teams** switch in the payee window with its hint (hub screen 8), and the note under the table rewritten
  (words by `/marketing`). ⚠ **"What the teams recorded" is NOT built here** — it is Club Tier Stage 3b.

### Screen 3 · the club's Ledger (D2)

- The balance rows carry the year ("Starting balance · Jul 3, 2026"); the note under the table ("Oldest at the top, as
  a bank statement reads…") is removed.

## Help, walks, fixture, sweep

- **`/docs`:** the coach's Ledger (opening a row, the read window, the dates, the phone card, Tools); the coach's
  Payees (the page, merge, "Shared by your club" and what the club sees); the club's Payees (sharing, what teams see);
  the club's Ledger (Tools; the note). **`/marketing`** writes the picker's notice line, the switch hint and both
  under-table notes before they ship.
- **Demos:** the build fails if a tour anchor stops existing — check any coach tour stop on a ledger row's pencil or
  worded button, and move it to the row itself.
- **Walks on the hub's QA tab** (unhide it; one purpose per walk, checkable, paste-back; number the Owner QA Ledger
  row at write time after re-reading the ledger): the coach's Ledger at a desk · the coach's Ledger on a phone · Tools
  and the coach's Payees page (including merging into a shared payee) · the club's side (Tools, sharing, the Teams
  column, the balance rows) · the picker as a coach in a club (shared vs own, the notice; an unshared club payee is
  absent).
- **The fixture** (`scripts/seed-club-fixture.mjs`, `seed-uat-coach-fixture.mjs`): one shared club payee and one
  unshared; a team duplicate of the shared one to merge; a derived row of each kind (Player Dues, Fundraising, Club)
  on the UAT team's Ledger; an unpaid installment with Record.
- **The layout sweep** in both themes for every changed screen and state at the phone widths; the coach's Money and
  Insights hubs must not move.

## Gates

- `verify:changed`, `typecheck`, unit tests (a guard: no ledger cell on either portal holds a control other than
  Record; both portals format a ledger date through one rule; the shared phone card is the only one the two Ledgers
  render), `check:layout` both themes, `check:css-selectors`, `check:spelling`, `check:old-look`.
- `/simplify`, then `/review` at the **high-risk** tier (money screens, a shared component moved, a visibility change),
  then `/docs`. Offer `/design` for a review pass.

## Hand-off

- An owner-voice summary: what a coach in a club, a standalone coach and a club treasurer see differently, and how to
  walk it. The walks are ready on the hub.
- The plan record, memory (`project_ledger_parity`), TODO. **Commit only when the owner says**, from a private index.
- ⚠ **Session 1's migration goes on production before the ONE promote that carries both sessions** (MANUAL_PROD_STEPS).
