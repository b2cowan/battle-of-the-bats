# List · Room · Question — one grammar for every money surface

**Status:** owner-ruled 2026-09-02 (D1–D7, all stamped). **Phase 0 (the room shell) + Phase A (the
Club tab) BUILT, /simplify + /review run, committed `246bff21` 2026-09-02 — Owner QA §134 ✅ PASSED
2026-09-03 (33/33, five parts), its remediation committed `cab938e8`**
(walk artifact `4bce9d5d`). **Phase B (Fundraising) BUILT 2026-09-02 on dev, committed `e34af83a` 2026-09-03 — see §3.1 for what
shipped and the nine mockup deviations; Owner QA §135 ✅ PASSED 36/36**, eight walk rulings built the
same day (`dc1756d6`) and a ninth on read-back (`4a9d25a5`). **Phase C (the Ledger's bill room)
BUILT 2026-09-04 on dev, committed `52c2637e` — see §4.1 for what shipped and its seven deviations;
Owner QA §141 ✅ PASSED 2026-09-06 (36/36, all six parts, zero defects, no walk rulings), which
ratifies deviation D-C1 on the screen.**
**Phase D (dues) needs RE-PLANNING before anything is built** — §5's four items pre-date the
2026-09-03/04 dues rebuild (§136, §137, and the "set once, chase weekly" stream), so some are done,
moot or contradicted. The layout reseed + sweep of `coach-club` / `coach-club-bill` is owed (needs a
quiet dev server).
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
   action ("Record as paid · $340"). ⚠ **The pill is REVERSED — see §8.** An action that fires on a
   minority of rows still sizes the trailing column for all of them, and the last column of a list
   holds one shape: the chevron.
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
| Club bill | Room | Rebuild from fold (Phase A); ~~list row gains the one-tap pill~~ (reversed, §8) |
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
lines, ~~the one-tap pill~~ (deleted §8) and Prev/Next. If month-end reconciliation is missed in practice, the
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

- List flattens: two group headings, fixed rows, chevron opens; ~~bills gain the **one-tap pill**
  when exactly one clean action exists~~ (reversed §8 — every row ends in the chevron and nothing
  else); declined requests carry the **reason preview line**.
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

### 3.1 Phase B — BUILT 2026-09-02, committed `e34af83a` 2026-09-03 · **Owner QA §135 ✅ PASSED 2026-09-03 (36/36, six parts, zero defects), eight walk rulings built and committed `dc1756d6`, plus a NINTH taken on the read-back that reversed Phase B's promise flow (`4a9d25a5`) — ⚠ which makes the walk's Part E VACUOUS**

**What shipped.** `fundraisers/panel.tsx` rebuilt as two flat lists over one `useRoomAddress('fundraiser')`
(the record's kind decides the room); `fundraisers/DriveRoom.tsx` (the drive room's body, the entry
Question, the Edit-drive sheet) and `fundraisers/SponsorRoom.tsx` (the two-zone body with the live
credit split, the cheque Question, the Edit-sponsorship sheet, the pledge sheet); `DriveBand`,
`SponsorBand`, `BandRows` and `RecordEditorFooter` deleted. New shared pieces: `QuestionShell`
(the Question chrome on the floor), `GuardedDelete` (the room-foot door, the footer's mode machinery
moved whole), the floor's **most-recently-opened-owns-the-bare-document rule** and its focus-only-if-
outside seat. **A new server door:** `PATCH …/arrivals/[entryId]` (`editSponsorArrival` — a replay
through the stored plan, floor-guarded per family pre-flight; `rewriteSponsorCredits` extracted so the
agreement edit and the cheque edit share one writer). The conversation gained the promise row inside
the Which-sponsor picker (`requestPledge` on the record signal; the hub switches tab and the panel
opens the pledge sheet with the carry) and now stands on the floor itself. The sponsor chip is
DERIVED (`sponsorStanding`: Pledged / Part received / Received). Fixture: the seeder heals by NAME
(Northside Physio's guard matched any received sponsor and never seeded once QA specimens existed;
Chocolate sale gains entries with linked credits); the resolver resolves both by name.

**Deviations from the §2 mockup, each with the ruling that forced it:**

| # | Mockup shows | Built | Forced by |
|---|---|---|---|
| 1 | A History fold on the drive room | No History fold on either room | The build prompt: "no History fold unless something real accumulates — do not render empty theatre"; nothing accumulates beyond the entries/cheques |
| 2 | Drive entries carry a method ("Aug 30 · E-Transfer") | Received date only | Drive entries store no method (the drive's Record branch asks none); showing an always-empty column would be a lie |
| 3 | Delete at the foot as a dead link + sentence | A pressable Delete that answers with the reason or the confirm | Owner §122 walk 2026-08-30: "the reason waits to be asked" — the permanent sentence was removed for this exact control |
| 4 | Record "with the drive locked" (build prompt) | The drive PRE-ANSWERED, not locked | The conversation's one lock gate hides every identity question including "which player" — a locked drive leaves nobody to record for |
| 5 | Sponsor chip "PLEDGED" on a part-arrived sponsor | Derived Pledged / **Part received** / Received | The prompt: status is DERIVED; "Pledged" on $250 of $500 arrived misreads to a treasurer — the third word is an owner wording call |
| 6 | Credit split saves per change (implied by "live") | Live editor with its own **Save split** + Cancel | SP-1: every save replays all credits and asks the payout floor; per-keystroke saves would fire the floor on every digit |
| 7 | — | The Edit-sponsorship sheet lost its credit-split section | One editor per field (the 2026-08-26 "a record has ONE editor" defect class); the room zone is the split's editor |
| 8 | — | Drive rows read Raised · Team keeps; sponsor rows Pledged · In · To come (both lists drop the Credits column) | The build prompt's row anatomy; the figure lives in the room's tile |
| 9 | — | A quiet facts line under the tiles (players logged of roster, dates, description, tags) | The 2026-08-29 meta-line ruling's facts survive; without it "who hasn't yet" had no home |

**Carried, not built (out of scope by §4):** the bill room (C), dues fixes (D), a glance fold (D2).

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

### 4.1 — BUILT (2026-09-04, committed `52c2637e`; Owner QA §141 ✅ PASSED 2026-09-06, 36/36, all six parts, zero defects)

**The bill's page is gone and its room is over the Ledger.** `CommitmentView` now renders `RoomShell`
(`sentinel="bill"`), and the panel's `{!focusBillId && …}` gate — *"the list and its chrome do not
exist on a commitment's own page"* — was deleted, so the Ledger stays mounted underneath with its
filters and scroll intact. `?bill=` is written through `useRoomAddress('bill')`; the panel's own
`useSearchParams` read, both `router.push`es, `useRouter` itself and `billBackTo` all retired with
it. Deep links unchanged.

**What shipped, in the room's order:** title = the autosaving name field (title-slot exemption,
below) · status chip "N of M paid" · tiles **Total · Paid · Left · Next due** · the **Schedule**
first, inline, with per-piece Record / Change / Remove and the inline add row · **Details** (Filing ·
Payee · Tags · How · Notes) under its own section label · **History** holding the recorded payments,
closed at rest and auto-open when a payment lands this session · one lime **Record** door,
pre-answered to the bill · foot = `GuardedDelete` "Delete this bill" + the save strip + named
Prev/Next ("3 of 5 bills"). Read-only money staff get the same room with values and no write control.

**Three field fixes, same pass:** `addAsChip` deleted outright from `TagSearchCombobox` (prop, branch
and `.tagComboAdd`) · `paperGround` passed on the record view's Filing picker · `.commitFields`
34rem → **30rem**. `.commitStanding`, `.payDrawerTotal` and `.commitFoot` retired with the page shape.

**Two things found while building, both fixed here:**
- **`InstallmentScopeSheet` had no accessibility floor at all** — it hand-rolled `.modalOverlay` +
  `.modal` with no dialog role, label, Escape, focus trap or focus restore. Survivable over a page;
  over a room it is not, because the floor's last-opened rule is the only thing that makes a bare
  Escape peel ONE layer. It stands in `QuestionShell` now, which is what §4 asked for anyway.
- **`CoachCollapseSection` seeds `open` once, at mount**, so a History fold asked to open itself
  *after* a payment landed simply would not. `RoomShell` re-keys the section on `defaultOpen`.

**Deviations from the prompt and the mockup, each with the ruling that forced it:**

| # | Deviation | Why |
|---|---|---|
| D-C1 | The Payables list's trailing column keeps **Record beside the chevron** rather than the chevron alone | Owner ruling 2026-09-04, asked before building. §134's argument does not carry: that pill fired on a MINORITY of rows, so one exception sized the column for all; Record fires on nearly every unpaid row, and the By-due-date lens is the month-end instrument — the room's walk steps between BILLS, not installments, so moving the act inside costs two taps per payment. **The chevron was added** on both row shapes (bill header and piece), right-aligned in `.listRowActions`, corner-pinned on a card — closing a real accessibility gap: a `<tr onClick>` is mouse-only. `Club →` folded into the same chevron with an honest accessible name. |
| D-C2 | "Next due" reads **"Paid off"**, not the prompt's suggested "Paid in full" | The club bill's room got here first and already says "Paid off" for the same state. Two rooms, one word. |
| D-C3 | The name field takes **no required marker** | The 2026-09-03 title-slot ruling: *a card's lead cell is its TITLE and takes no label.* A `*` beside a heading reads as a footnote. This is the decided treatment for §4's open "required-but-unmarked Name" item. |
| D-C4 | An **over-payment** gets its own chip — "$X over the total", amber | The mockup drew only "N OF M PAID"; with the tiles reading "Left $0.00" nothing would say where the excess went. Amber not red: over-payment is ACCEPTED by design (R6), so it is worth noticing and is not a failure. |
| D-C5 | The **Record door is fully locked**, not partially (`lock.asks` unused) | The prompt called it "a lock that spares one question". The bill's branch (`spend`) asks *what did this pay for?*, which the door answers; what stays editable is WHICH INSTALLMENT, and that is allocation rather than identity, so it was never under the lock. Nothing to spare. |
| D-C6 | `CommitmentView` is **no longer keyed by bill** at its call site | A key remounts `RoomShell`, firing the floor's focus RESTORE on every Prev/Next — focus lands on the list row behind the room and scrolls the Ledger to it. The draft follows the bill through a render-phase change guard instead, and every exit (✕, Escape, backdrop, both arrows) **flushes a pending edit and waits for the verdict**, because a room's ✕ is not a link and `UnsavedChangesGuard` never sees it. |
| D-C7 | The **Schedule leads the body, Details follows** — the reverse of the page | On the page, the short fixed things sat above and the unbounded schedule took the page scroll. The room's TILES answer "where does this stand" before anything scrolls, so the rule (*what cannot grow sits above what can*) is unbroken while the order flips. Matches the mockup. |

**`/review` (high-risk tier, five lenses) — 18 findings → 9 confirmed and fixed, 3 refuted with the
ruling that refutes them, 6 advisory/pre-existing.** The nine, because several are shell-level and
the next room will meet them:

1. **The remove-payment sentence lied on an over-paid bill.** It read `remaining + amount`, and
   `remaining` is floored at zero by design (R6 accepts over-payment) — so a $100 bill carrying $130
   promised "$50.00 still owing" where the truth was $20, and past the tipping point promised money
   owed on a bill that was still over. Re-derived from the standing's own arithmetic. Carried in
   from the code this phase re-homed, but it now sits inside a confirmation whose whole promise is
   that its figure and the outcome cannot drift.
2. **The walk stayed live over an unanswered question.** Prev/Next is a sibling of the doors slot,
   so the "a question replaces the controls it suspends" CSS never reached it — a coach could step
   to the next bill and the named-dollar question simply vanished, unanswered and unrecorded. The
   arrows are now hidden with the doors, and `useDialogFloor` carries the same check for the ←/→
   KEYS, which no stylesheet can reach.
3. **"Delete and reverse" was lost** when the foot adopted the shared `GuardedDelete`, which
   hard-coded "Delete". The label is a `confirmLabel` prop now: pressing it on a bill money has
   landed on moves cash, and the button should say the bigger of the two things.
4. **The delete confirmation's two clauses ran together.** `GuardedDelete` wrapped `confirmBody` in
   a `<p>`, so the cash sentence and the family's-credit sentence — two different consequences —
   were one hedged paragraph (a `<p>` in a `<p>` is invalid and silently unnests). It is a block
   now; both consumers are unaffected.
5. **History re-opened itself on every RETURN to the last-paid bill**, overriding a coach who had
   collapsed it, because the flag was set and never cleared. It clears when the room moves on —
   which makes the shell's own claim ("it flips at most twice in a record's life") true.
6. **A refusal could be swallowed by a tab switch.** The room is unmounted when the coach leaves the
   Money tab (as every room is, so a hidden panel cannot leave an Escape floor armed elsewhere), and
   the route guard only intercepts a link while the draft is *dirty*, not while a save is in flight
   — correct, because interrupting a coach for the ~200ms of an ordinary save is worse. So a refused
   rename set state on a component that no longer existed. It now reports to the panel, which is
   still mounted. ⚠ The page had no such hole: it was not gated on the visible tab.
7. **A standing refusal waved the second exit through.** `leaveFor` skipped its flush when
   `saveError` was set, so the first ✕ blocked and showed the reason and the second sailed past with
   the edit unsaved — which is exactly what someone presses when a window will not close. A refusal
   is a reason to retry, not to stop trying.
8. **Two writers had no ref latch** (Add an installment, Delete this bill) where Record and Remove
   already did — the file argues for the latch twice in its own comments; it had not been carried.
9. **A stalled write could hold every exit shut.** The busy gate is the room's contract and a page's
   writers gated nothing, so the ceiling arrives with the room: the three writers that feed `busy`
   now abort at a timeout and say so. ⚠ Aborting is not undoing — it returns the room's controls,
   not the write.

**Refuted, with the ruling:** *Escape closing the room while a confirmation is open* is the §134/§10
rider, verified in Chromium at the time — three ways out, and Escape leaves the window. *The save
strip not standing down during `GuardedDelete`'s own confirm* — the shell's new `:has()` rule
already hides it. *The tiles disagreeing on a payment targeted at a later installment* is
`commitmentStanding`'s pour semantics, faithfully reported; not this phase's.

**Same-commit obligations, done:** the `coach-commitment` sweep entry re-pointed to
`[data-room="bill"][data-room-state="loaded"]` (id deliberately unchanged — the baseline is keyed on
it) · `tests/uat/scenarios/coach-bill-room.spec.ts` written and RUN (5 tests, all passing) — the
`?bill=` screen had **no UAT coverage at all** before it · `premium-money-ledger` rewritten for the
room with keywords and `searchText` (`premium-money-tags` checked: it describes the always-visible
box already, no change) · `lib/sandbox-chrome.ts` re-read with a dated Phase C note ("Tap any row to
open the bill behind it" got *more* true, no new stop) · the header-actions guard's
`CommitmentView` row retired with a headstone (the room draws no `CoachPageHeader`).

---

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

---

## 8. §134 walk corrections — the trailing column (owner, 2026-09-03)

The Club tab's action column was walked and two rulings above were reversed on the spot. Both were
about the same thing: **the last column of a list has one job, and one shape.**

- **The requests band's "Edit"/"Details" button → the chevron.** §2's grammar (*name · status chip ·
  one figure · chevron*) was already the rule, and the Fundraising bands already obeyed it; the club
  requests band was the only money list ending in a labelled button. Its defence — that a chevron
  "promises a room a request does not have" — is a distinction between a Room and a Question that is
  real in this document and invisible on the screen. The glyph reads "this opens", and it does.
  A pending request still declares itself three ways (amber left edge, "Awaiting the club" badge,
  no decision date), and the button's accessible name keeps the honest verb ("Edit …" / "Open …").
- **D5, the one-tap "Record as paid · $x" pill → deleted.** *"Having this 1 off take up that much
  column width I don't think is worth it; users will be familiar with the process of opening to pay
  and the buttons seem to be the exception so they aren't saving much time."* The pill fired only on
  a bill with exactly one unpaid installment — a minority of rows — but the widest cell sizes the
  column for every row, so an exception was holding ~260px of table width away from *What*, *Files
  under* and *Status* permanently. Recording a payment did not move: it is on the installment inside
  the bill's room, where Player Dues has always put it, and now every installment offers it rather
  than only the last one.
- **Alignment:** the trailing group is right-aligned, so every row's last control hangs on the same
  edge. It was content-width and therefore left-aligned, which is why two chevrons in one column sat
  at two different x positions.

⚠ **This weakens §0's named trade.** Multi-open club folds died with the pill and the preview lines
named as mitigations; the pill is now gone too, leaving preview lines + Prev/Next. The recorded
fallback is unchanged and still preferred over live controls in rows: if month-end reconciliation is
missed in practice, add a **read-only glance fold** (G1-compliant), not a button.

---

## 9. §134 walk — a club payment can be taken back (owner, 2026-09-03)

**The finding, in the owner's words:** *"if I mark something as 'paid' and click the wrong one by
accident, should we allow an undo so they can click the proper one?"*

**What was actually wrong.** "Record as paid" on a club installment was the **only** money a coach
records that could not be undone — a dues payment, a payout and a credit all have a remove, and no
unmark existed anywhere, for coaches or for club admins. It is also the **fastest write in the
portal**: one tap, no question asked. The least-guarded write was the only irreversible one, and
the tap does not set a flag — it posts a real transfer between the team's ledger and the club's, so
a mis-tap moved money with no way home short of phoning the club office.

**Built.**
- **Migration 275** — `create_accounting_transfer` now RETURNS the payer-side (`transfer_out`)
  entry id instead of `void`, and both mark-paid routes (coach **and** admin) store it on the
  installment. It has to: reversal means voiding the two entries the payment posted, and nothing
  recorded which two they were. ⚠ A DROP-and-CREATE, because Postgres will not change a return type
  in place; all four call sites ignored the result, so void → uuid is backward-compatible.
- **Backfill, deliberately narrow.** Already-paid installments adopt their entry where the match is
  beyond doubt (same team ledger, category, amount, and the description this code path writes) and
  is **unique in both directions**. Ambiguity is skipped, never guessed — a team that paid two
  identically-numbered, identically-sized installments keeps both unlinked and the undo refuses.
- **`DELETE` on the installment route + `unmarkRepAllocationInstallmentPaid`.** Voids **both
  halves** of the transfer through `linked_entry_id`, then clears `paid_at`/`paid_by`/the link.
  ⚠ Void, not delete — the schema's own word for "cancelled, kept for audit, excluded from totals".
  The ledger void runs first because it is idempotent while clearing the stamp is not.
- **The control:** a quiet ghost `Undo` on a paid installment inside the bill's room.

**Three decisions worth keeping.**
1. **No confirm.** The act it reverses costs one tap; guarding the reversal harder than the act is
   backwards, and this is the tap a coach reaches for having *just* made a mistake. It is also
   itself reversible — recording it paid again is one tap — so it is not a one-way door and must
   not wear one's clothes (no `btnDanger`).
2. **It refuses rather than half-undoing.** A payment recorded before 275 with no unambiguous
   backfill match cannot be reversed here; clearing the stamp anyway would report the bill unpaid
   while the transfer still stood on both ledgers, which is worse than the state being fixed. The
   refusal names the way out (the club office).
3. **"Refuses once the club has settled" was NOT built, and the reason is that the concept does not
   exist.** There is no period-close or reconciliation state in the accounting model — only
   `pending` / `posted` / `void`. Inventing one to satisfy a plan sentence would have been building
   a policy the product does not have. ⚠ **If a period-close is ever added, this undo is one of its
   consumers** — that is the point at which the refusal becomes real rather than hypothetical.

**Open, and deliberately not taken:** the club admin's own allocations screen still has no unmark.
Its marks now leave the link, so building one is a route away — but it is the club's decision
surface, not the coach's, and it gets its own walk.

### ⚠⚠ 9.1 — MIGRATION 275 IS INVISIBLE TO EVERY DRIFT GATE. Do not trust a green check.

275 changes a **function's return type**. `check-prod-migration-drift.mjs` and the committed
snapshots compare **tables, columns, indexes, constraints and RLS** — neither reads `pg_proc`. So
`check:migrations` will report "in sync" while 275 is outstanding on prod, exactly as it did for the
data-only mig 264. **This is the third member of that family (data-only DELETE, column DROP,
function signature); assume the gate is blind to anything that is not a column.**

**What happens if the code ships without it:** nothing breaks loudly. A `void`-returning RPC hands
Supabase `data: null`, so the mark still records the payment and simply stores no link — and every
undo then hits the "recorded before payments could be taken back" refusal. **The failure mode is a
feature that silently does not work, on a screen that looks perfectly healthy.** Apply 275 to prod
in the same promote, and verify by taking back a test payment rather than by reading a gate.

---

## 10. §134 walk — a confirmation docks in the footer, never in the body (owner, 2026-09-03)

**The finding:** *"hitting withdraw makes the warning message show up below the visible screen and I
have to scroll to find it… cancel doesn't work while that warning is present, so if I don't know it
is down there as a user I can be stuck."*

**Both halves were real, and together they were worse than either.** The confirmation was appended
to the bottom of the request form's SCROLLING BODY, so on a long request it rendered below the fold
— pressing Withdraw looked like it did nothing. Meanwhile the footer's Cancel and Save had been
deliberately disabled while the confirmation was up (sound reasoning: a live "Save changes" under an
unanswered question let a coach save the very edit they were abandoning). The result: the only
control still on screen was dead, and the question explaining why was off it. **A dead button plus
an invisible explanation is how someone gets stranded in a modal.**

**The rule, now stated in CSS and reusable:** an `alertdialog` docked in a `.modalFooter` takes the
band's full width and drops its own margin — the identical contract `RoomShell` already gives its
doors slot. **The question REPLACES the controls it suspends, in the one band that is always
visible.** Nothing is disabled any more, because nothing competing is rendered.

- **Club request → Withdraw** (the reported one) and **the money form's two deletes on Transactions**
  (found by grepping the siblings — same shape, same modal, same defect) all dock in their footer.
- Three ways out, all on screen or universal: **Keep it**, the header **X**, **Escape**.
- ⚠ `!confirmDelete` / `disabled={… || confirmWithdraw}` guards were deleted with the move. They were
  compensating for the wrong placement; with the confirmation owning the band there is nothing left
  to hide or disable. **Do not reinstate them** — that would recreate the dead-control half.

**Not adopted: the owner's literal proposal** that Cancel should cancel the withdrawal *and* close
the window. With the confirmation owning the footer there is no Cancel beside it to press, which
removes the trap at the source rather than teaching one button two meanings. Stated here because it
was a reasonable ask and the reason for the different answer should outlive the conversation.

**Verified in Chromium at 1100×620** (a viewport short enough to reproduce the original): the
confirmation renders fully on screen without scrolling, Keep it returns to the live form, and Escape
leaves the window rather than stranding the coach.

---

## 11. The room's running order, and the chip that lied (owner, 2026-09-06)

**Mockup:** `claude.ai/code/artifact/6c24f0e6-5e42-4858-ac86-1cb2df790adf` (both frames at the room's
true 1040px width). Raised by the owner reading a live bill: *"installments then the general details
and then payment history — it reads weird."*

### 11.1 The diagnosis — three tenses, and the middle one is the least visited

A room tells three stories in a row: what is **owed** (the schedule), what the record **is** (its
fields), and what money actually **moved** (History). The first and third are one conversation. The
schedule says *"4 days overdue · $540.00 still owing"* on a $1,000 piece, and the answer to *why $540
and not $1,000* is a payment in the fold — which sat five form rows below, behind a fold, past the
cut of an ordinary laptop screen. **History also opens itself the moment a payment lands**, so the
one confirmation a coach wants was arriving off-screen.

**Direction of travel already agreed:** Phase C had moved the fields off the TOP of the page and
under the schedule (§4). What it could not do was get them past History, which `RoomShell` pins
after the body. This is that same move, one step further.

### 11.2 Built — the running order: plan → actual → identity

- **`RoomShell` gains `fields`**, rendered BELOW the History fold. Anatomy is now: header · tiles ·
  action row · the record's own table (`children`) · History · `fields` · foot. ⚠ One room uses it
  (the bill's); sponsor and drive rooms have no reference block and are untouched. A room that
  gains one puts it here rather than at the end of its body.
- **`CommitmentView` moves its Details block into that slot.** Details stays FULLY OPEN and every
  row still draws, set or not — collapsing it was considered and rejected: it would re-introduce a
  door onto fields Part B deliberately made editable in place.
- **The bill's identity joins the doors' row** (`facts`) — `Facilities · Diamond Permits · test ·
  E-Transfer`. That slot was reserved for a record's quiet facts and a bill was the one room that
  never filled it, so the band above the schedule held one right-aligned button and nothing else.
  It matters more now that the fields sit at the foot: without it, opening a bill says nothing about
  what the bill IS until the coach scrolls past History. ⚠⚠ **Built from the DRAFT, never from the
  prop** — those three facts are live controls forty rows below and the panel's copy is re-read
  ~1.2s after a save, so sourcing the summary from `expense` would state an old payee while the
  coach looks at the new one. Empty bill → empty summary; nothing is invented.
- **UAT asserts the ORDER**, not three presence checks (`coach-bill-room.spec.ts`): the defect this
  guards against is a block MOVING, not a block vanishing.

**Rejected: merging payments into the schedule as a nested timeline.** A payment is not owned by an
installment — it lands on one and spills forward (`lib/payable-standing.ts`), so a $600 payment can
partly settle two pieces. Nesting would force either a split row the coach never entered, or filing
it under one piece and lying about where the money went. Two adjacent lists tell the truth with no
invented rows.

### 11.3 Built — the consequence strip learns a second grammar

**Reported:** recording **$17.00** against a bill with $540.00 owing drew
`Spring classic entry · still owing ▼ $523.00` — which reads as a $523 drop.

**The number was right and the arrow was the lie.** Every other chip on a strip reports a CHANGE
(cash down *by* $17, a line up *by* what was spent, a family owed *more by* what they fronted); this
one reports the balance the payment LEAVES BEHIND, wearing a change's mark.

- `ConsequenceMove` gains **`reads: 'move' | 'result'`**; the bill balance is the product's one
  `result` chip and renders **`→`** instead of ▲/▼. ⚠ The renderer asks `reads` FIRST — re-deriving
  the mark from `direction` brings the defect straight back, and there is now a unit test saying so.
- **The cleared case was already right** and is the shape this copies: it states a standing
  ("fully paid") in words, with no arrow and no figure. This makes the part-paid case behave like
  its own other half.
- **A screen reader was never wrong here** — the mark is decorative in both grammars, so what is
  announced is "Spring classic entry, still owing, $523.00" either way. Only the sighted reading
  was broken, and only the sighted reading changes.
- **Rejected:** making it a delta too (the strip would say the payment amount three times and never
  show the balance the coach came for); dropping the arrow for a bare figure (an absent mark reads
  as an oversight, and this strip's design is that a missing mark must be a hole you can see).

### 11.4 Status

- **Owner QA ✅ PASSED 2026-09-06** — the room's new order, the identity line and the chip, confirmed
  by the owner on the built screen in the same session. Walked in-session, so **no ledger § was
  assigned**; if this needs a numbered entry in `OWNER_QA_LEDGER.md`, it has to be added deliberately
  rather than inferred from this line.
- **Layout sweep baseline** for `coach-commitment` may move with the reorder; reseed before reading
  it as a regression. ⚠ The sweep opens no folds, so it cannot see History's contents either way.
- **Help synced in the same unit of work** (`/docs`, 2026-09-06). The coach money guide described the
  bill panel in its OLD order — fields, then History — so the two paragraphs were reordered to follow
  the screen, the identity line beside **Record** was written up, and the consequence strip gained
  the sentence that distinguishes a change from a standing ("Paying a bill adds one figure that isn't
  a change… it carries a **→**", with the $17 / $540 / $523 example). Sixteen search terms added for
  the questions this change invites ("where are the bill details", "what does the arrow mean",
  "still owing went down by more than i paid").
- **Demo narration checked and NOT stale** (the CLAUDE.md reflex). Neither the moments dock nor the
  guided-tour steps say anything about the bill panel's layout or the consequence chips, so there is
  nothing to true up; and a running order is a refinement rather than a capability a prospect needs
  pointed at, so no new moment is earned. `check:demos` reports both worlds presentable.
- ⚠ **PRE-EXISTING DEBT, NOT INTRODUCED HERE, BUT NOW MEASURED:** `npm run measure:help` puts "The
  Ledger: one book, three views" at **2,411 words** — a sub-topic seven times the 350-word standard,
  and one of two unconverted long topics in the coaches guide. This session's sync added ~150 of
  those words. Converting it is not a paragraph edit: a sub-topic cannot hold sub-topics, so it means
  promoting the Ledger to a section of its own and re-homing every anchor that points into it. Owed,
  scoped, and deliberately not done on the way past.
