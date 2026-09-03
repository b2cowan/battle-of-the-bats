# List · Room · Question — one grammar for every money surface

**Status:** owner-ruled 2026-09-02 (D1–D7, all stamped). **Phase 0 (the room shell) + Phase A (the
Club tab) BUILT, /simplify + /review run, committed `246bff21` 2026-09-02 — Owner QA §134 owed**
(walk artifact `4bce9d5d`). Phases B, C, D open. The layout reseed + sweep of `coach-club` /
`coach-club-bill` is owed (needs a quiet dev server).
**Ruling record:** `memory/design_decisions.md` 2026-09-02 entry "LIST · ROOM · QUESTION" (binding; names the reversals).
**Mockups (the spec, rulings stamped in place):** `claude.ai/code/artifact/11607f0a-e0c1-4bb4-bbd5-b6f81d834fbc` ("List, Room, Question", rounds 1–2c).
**PM brief:** `COACH_MONEY_LIST_ROOM_QUESTION_PM_BRIEF.md`. **Build session opens with:**
`COACH_MONEY_LIST_ROOM_QUESTION_BUILD_PROMPT.md` (preconditions §0 are blocking).
**No migration expected.** Prod-owed migrations 268–272 (and held 264) must reach prod **before or alongside Phase A** so rooms are built against the schema prod runs.

---

## 0. The ruling in one page

Owner direction (2026-09-02, verbatim in spirit): *"evaluate what YOU think would be the best user
experience for each use case and not over-consider past rulings … think outside the box on the best
and most consistent user experience, be creative."* The result — stress-tested by a four-agent red
team and a three-agent code review before being ruled — is one grammar:

1. **LIST** — flat, fixed-height, scannable. A row = name · status chip · one figure · chevron.
   **A list never grows a form.** Rows may carry a read-only **preview line** (e.g. a declined
   request's reason, truncated) and a **one-tap pill** when the record has exactly one obvious
   action ("Record as paid · $340").
2. **ROOM** — tap a row, the record opens the same overlay anatomy everywhere: header (name +
   status chip), story strip of money tiles, the record's own table, **History** fold (collapsed),
   Edit / guarded Delete at the foot, one **Record** door, **named Prev / Next with a position
   count** ("‹ Ice rentals — fall block · 2 of 3 bills · Gym rental — winter ›"). Addressable by
   query param. Full-screen sheet on phone.
3. **QUESTION** — modals only ever ask: create forms, edit-setup forms, the shared Record
   conversation, named-dollar confirms, the bill's scope sheet. Stacks **at most once** over a list
   or room. Two sizes: compact, and **grid** (the drive's per-player Record window).

**Guard rules:**
- **G1 — a fold may show, never ask.** Read-only glances are legal (Ledger bill rows folding to
  show payments); any input belongs to the room.
- **G2 — a record that is also a document is a page.** Genuinely printed, read on its own
  (certificates, tournament summaries). **No money record qualifies** — verified 2026-09-02.
- **G3 — a room is full-height with its own scroll, never a height-capped centered box.** The §64
  Part E overflow (unreachable content in a ~90vh modal) is a shell defect; it is why the bill fled
  to a "page" and it must not recur in the room shell.

**Classifier** (for any future record): document → page · form-says-everything → question ·
otherwise (parallel money figures and/or its own sub-list) → room.

**Per-object verdicts (D1–D4):**

| Object | Verdict | Change |
|---|---|---|
| Family dues | Room | Keep the drawer; label + History + Prev/Next fixes (Phase D) |
| Fundraiser drive | Room | Rebuild from in-place band (Phase B); D2: room only, no glance fold at first |
| Sponsorship | Room, **two-zone** (arrivals + player credit plan both visible) | Rebuild from band (Phase B) |
| Club bill | Room | Rebuild from fold (Phase A); list row gains the one-tap pill |
| Club request | **Question** (D3) | Facts move to the row (+ decline-reason preview); creation form reopens pre-filled as the one editor; withdraw rides the form foot |
| Team bill | **Room** (D4, reversed on review) | CommitmentView becomes the room shell over the always-mounted Ledger (Phase C) |
| Budget line | Question | No change |
| Bulk "Set dues for all players" | Question (logged exception — classified by the operation's own questions) | No change |

**D1 scope (three tiers):** binding for the Money area now · the default for any NEW record-listing
surface app-wide (departures need a named reason) · existing non-money surfaces conform when next
touched — **no dedicated sweep**. The grammar governs record-keeping surfaces; dashboards and
instruments (Overview, Insights, Game-Day) sit outside it.

**Named reversals (do not rediscover these as conflicts):** this supersedes the *applications* of
the 2026-08-26 modal ruling on the drive band (08-31 "a drive opens in place"), the club fold
(09-01), and the bill's page shape + its one-off `addAsChip` tag reveal (08-27 §114 walk). The
08-26 **principle** — a modal is for a question — survives as the Question surface. The Q11 sponsor
record-page reversal (08-29) also survives in spirit: rooms are overlays over their list, not
navigated pages.

**Accepted trade (named, owner-accepted):** multi-open club folds die. Mitigations are the preview
lines, the one-tap pill, and Prev/Next. If month-end reconciliation is missed in practice, the
recorded fallback is a read-only glance fold on the club list (G1-compliant), not a return of
live controls in rows.

---

## 1. Cross-cutting: the room shell (build once, first)

A shared room component all four roomed surfaces consume:

- Full-height overlay, internal scroll region (G3), width set by the record's table (~1040px
  default, the dues drawer's figure); full-screen sheet ≤640 with back arrow; 44px floors.
- **ARIA floor ships with the shell** (D7): `role="dialog"`, `aria-modal`, `aria-label` naming the
  record, Escape-to-close, focus trap, focus restore. This closes the portal-wide gap found in
  review (only Season Settlement has it today).
- **Named Prev/Next + count** in the footer; arrow keys on desktop; order = the list's rendered
  order under current filters; disabled at the ends.
- **Addressability, with the two engineering guardrails as BLOCKING checklist items per room**
  (red-team findings, both previously-shipped defect classes):
  1. every room's query key is **unique** (`clubBill`, `clubRequest`, … — never a shared `bill` /
     `fundraiser`) and registered in the money hub's one-shot key list **in the same commit**
     (the 08-26 "mounted twice" lesson — kept-mounted panels must never let two instances answer
     one param);
  2. every room gets its **layout-sweep SCREENS entries** (≥2: room open populated + list state)
     in the same commit — `check:layout` is blind inside anything it does not open (the `?bill=`
     page shipped unswept once).
- Write-surface guard rails carried from the fold /review fixes (they are properties of
  *dismissible containers*, not folds): value-settled live controls (never latch on an event), a
  busy-gated close, errors raised to a surface that survives the room closing.
- **Built (Phase 0, 2026-09-02):** `components/coaches/RoomShell.tsx` (+ `.module.css`),
  `useDialogFloor.ts` (the floor, shared with Question modals), `useRoomAddress.ts`,
  `lib/room-neighbours.ts`; `tests/unit/room-address-keys-guard.test.ts` enforces BOTH guardrails
  (a room key on the one-shot list and unique; a room sentinel named by a sweep entry).
  Follow-ups the /simplify pass recorded: `HelpDrawer` / `BottomSheet` adopt `useDialogFloor`;
  the dues drawer's inline-styled tiles retire onto the shell's strip (Phase D).

## 2. Phase A — Club tab (first: the screen that prompted the session)

- List flattens: two group headings, fixed rows, chevron opens; bills gain the **one-tap pill**
  when exactly one clean action exists; declined requests carry the **reason preview line**.
- **Club bill room:** tiles Billed / Paid / Left, one-tap installments (ruling R-D unchanged —
  fieldless), files-under picker (30rem cap), club's description read-only, History, Prev/Next.
- **Club request → Question:** the creation modal reopens pre-filled as the one editor (kills the
  fold/modal duplicate editor of the money-in answer — the "one editor" defect found in review);
  Withdraw at the form foot; decided requests readable from the row (decision + reason restored —
  today's dead decline-reason branch becomes reachable again). Legacy requests with no money-in
  answer keep the ask-before-filing guard, now inside the form.
- Fold machinery (`expanded` map, in-row `ClubFilingControl`) retires.

## 3. Phase B — Fundraising (the large piece)

- Both bands become flat lists; expansions retire (D2: no glance fold at first — recorded fallback
  above).
- **Drive room:** tiles Raised / Team keeps / Credited, entries table with per-entry Edit/Remove as
  compact Questions (the inline `EntryEditor` and its lockout retire), Edit drive, guarded delete
  (unchanged floor sentences), Record (the grid Question).
- **Sponsor room (two-zone):** tiles Pledged / Arrived / To come (+ past-due cue), arrivals list
  **with Edit parity** (undo-only today — no recorded reason; carried ruling), the per-family $/%
  credit plan as a live zone in the room (not buried behind Edit), Edit sponsorship, guarded
  delete, Record.
- **Record conversation gains the promised-sponsorship hand-off** (carried ruling): "A sponsor
  promised money — nothing arrived yet" → hands into the existing "+ Pledge" sheet, typing carried,
  reversible — the mirror of the bill's "we agreed to pay something later" row.
- **Verify the first genuinely stacked pair** (the drive's Record grid Question over an open room):
  Escape with nothing focused must close only the top layer. `useDialogFloor` acts on keys from
  inside its panel or from the bare document; if the bare-document case double-fires, narrow it to
  the most recently opened dialog — never build a full overlay stack in `lib/coaches-overlay`.

## 4. Phase C — Ledger: the bill room

`CommitmentView` re-shells as a room over the always-mounted Ledger (it is already a `?bill=`
sub-view whose styles are named "drawer" — this is a re-home, not a rebuild):

- Tiles Total / Paid / Left / Next due (all served by the existing standing computation).
- Schedule stays primary and inline (per-piece Record / Change / Remove; the scope sheet stacks as
  a Question); the inline add-installment row stays (asks nothing) and stacks to two lines ≤560px.
- Recorded payments fold into **History** (auto-open when a payment lands this session); Undo
  stays an inline named-dollar confirm.
- Close replaces the hardcoded "back to Ledger" label (a fragility the code itself flags).
- **Retire the `data-commitment="loaded"` sentinel** in favour of the shell's `data-room` pair, and
  re-point the `coach-commitment` sweep entry — one sweep convention for every room, not two.
- The Ledger's own `?bill=` writer and the dues panel's `setUrlParam` both become `useRoomAddress`
  (Phase D for dues) — one address writer, as the hook's docblock intends.
- **Field fixes found in the 2026-09-02 audit, done in the same pass:**
  - Tags drop the one-call-site `addAsChip` "+" reveal → the standard always-visible search under
    chips (reverses the 08-27 §114 tweak, owner-flagged 2026-09-02);
  - Filing gains the unified paper ground the creation form already has (the `paperGround` opt-in
    was never passed on the record view);
  - field column cap reconciled 34rem → 30rem;
  - the required-but-unmarked Name gets a decided treatment at build (title-slot exemption or a
    plain `*`).

## 5. Phase D — Dues fixes (small; may ride any earlier phase)

- Banner door renamed **"Send it back"** (opens Record pre-answered to the give-back branch);
  the lime **Record** stays the one door for money arriving.
- Payments · payouts · credits collapse into **History**; the schedule is the one open view.
- Room shell adoption: ARIA floor + named Prev/Next across families.
- The migrated-payment note text stays (logged debt; data-only fix if ever requested).

## 6. Same-unit-of-work obligations (every phase)

- **Demo sandboxes:** the coach-money narration is the single most re-broken surface (three
  consecutive releases) — re-read dock lines + tour steps for every touched tab; reseed where a
  new state must be visible.
- **Help docs:** every touched flow (`/docs`); the club tab's help already went stale once this
  month.
- **Owner QA:** each phase gets its own ledger section and checkable walkthrough artifact.
- **Design-log corrections shipped with Phase A:** the 09-01 entry's misattribution (the
  three-way scope question belongs to team bills' scope sheet, not dues — dues schedule edits are
  full-replace; the drawer's real justification is its four interacting histories) — annotated in
  place + stated in the 09-02 entry.

## 7. Order and gates

1. Prod-owed migrations (268–272; 264 held awaiting owner) promoted first or alongside.
2. Room shell (§1) → Phase A (Club) → Phase B (Fundraising) → Phase C (bill room) → Phase D rides.
3. Each phase: own mockup-fidelity check against the artifact, own QA section, own commit;
   `/simplify` before `/review` on each.
