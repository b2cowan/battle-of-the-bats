# BUILD PROMPT — List · Room · Question, PHASE C: the Ledger's bill room (open a FRESH session with this)

You are building Phase C of an owner-ruled project. Phase 0 (the shared room shell), Phase A (the
Club tab) and Phase B (Fundraising) are **built, committed and WALKED** — `246bff21` (§134 ✅ 33/33)
and `e34af83a` (§135 ✅ 36/36), with **fifteen rulings taken on the two walks and built the same
day** (`dc1756d6`, `4a9d25a5`, plan §8–§10). Several of those rulings bind this phase. Phase C
re-homes the team bill's page as a room over the always-mounted Ledger. **This is a re-home, not a
rebuild:** the bill already renders as a `?bill=` sub-view whose styles are still named "drawer",
and its six fields already save themselves. Do not redesign; the design is ruled and drawn.

**Read first, in this order:**
1. `docs/projects/active/COACH_MONEY_LIST_ROOM_QUESTION_PLAN.md` — §0 (grammar, guard rules,
   classifier), §4 (Phase C), **and §8–§10** (the §134 walk corrections: one shape in a list's last
   column; a club payment can be taken back — and ⚠ migration 275 is invisible to every drift gate;
   a confirmation docks in the FOOTER, never in the scrolling body). Then the ledger's §135 block
   (`OWNER_QA_LEDGER.md`) for its eight rulings and the ninth — ruling 7 settles the WORDS this room
   uses: **Undo** = one tap and one tap back (the club installment, and only that); **Remove** = it
   asks, because money moves (a payment on a bill is a Remove).
2. `memory/design_decisions.md`, the five 2026-09-03 entries — binding: "One shape in a list's last
   column: the chevron, and nothing conditional beside it"; "A confirmation docks in the sticky
   FOOTER of a modal"; "The card's lead cell is its TITLE and takes no label; a card's door is a
   CORNER"; "A promise is an ANSWER" (it deleted Phase B's pledge hand-off — do not rebuild any
   cross-panel hand-off wire); the muted-ink correction.
3. The mockup artifact `claude.ai/code/artifact/11607f0a-e0c1-4bb4-bbd5-b6f81d834fbc` — the section
   **"You were right: the page exception dissolves"** DRAWS THE TEAM BILL'S ROOM: title + "2 OF 3
   PAID" chip, tiles Total · Paid · Left · Next due, the Schedule inline (Record / Change · Remove per
   piece, "+ Add an installment"), the Details fields (Filing · Payee · Tags · How · Notes), a
   History fold ("$800.00 recorded · 1 payment"), named Prev/Next ("3 of 5 bills"), "Delete this
   bill" at the foot — and its five rulings R1–R5. The artifact IS the spec.
4. `components/coaches/RoomShell.tsx` (props: `open onClose ariaLabel title status tiles actions
   facts factsTitle children history footer nav busy recordKey width sentinel loaded`),
   `useDialogFloor.ts`, `useRoomAddress.ts`, `QuestionShell.tsx`, `GuardedDelete.tsx`,
   `useLatestRef.ts`, `lib/room-neighbours.ts` — the shell you consume — and the TWO reference
   consumers: `accounting/club/panel.tsx` (`sentinel="club-bill"`) and
   `accounting/fundraisers/panel.tsx` (two room shapes over one address; Questions in
   `QuestionShell`; the room-foot `GuardedDelete`). Copy their patterns exactly: the address hook +
   stale-address effect, the memoised room derivation, `key={record.id}` on every live control,
   busy reported BY VALUE from every writer into the room's `busy`, value-settled write marks, the
   after-write reload reading the LIVE open id, `tabActive` gating, `sentinel` + `loaded`.
5. `accounting/CommitmentView.tsx` — its docblock is the contract for the six autosaving fields
   ("a modal is for a question, not for a field"; the name is the ONE field the server can refuse;
   the draft is seeded once and the caller keys by bill). And its mount site in
   `accounting/expenses/panel.tsx`: `backTo={billBackTo}` (~6643), the sweep sentinel
   `data-commitment="loaded"` (~6657 — read the ⚠ comment: it is on the branch that has the
   STANDING, deliberately), `focusBillId = seasonSearchParams.get('bill')` (~2449), the back-push
   (~3965) and `billBackTo` (~3538). These are what Phase C replaces.
6. Auto-memory `project_coach_money_list_room_question.md` — the review catches from A and B (key
   the live control by the record; a trap must hold when focus falls out; a write's "done" is the
   discarded reload; busy by value; the after-write callback reads the live open id; a note is not
   money; delete-then-insert restores on failure) and the fixture/spec traps.

## 0. Preconditions — verify, stop if any fails

1. **Quiet tree — ⚠ READ THIS ONE.** As of 2026-09-03 the working copy carries ANOTHER session's
   uncommitted work (the coach notifications redraw §138 and the dues "set once, chase weekly"
   stream), and it includes `app/[orgSlug]/coaches/coaches.module.css` and
   `scripts/.layout-baseline.json` — two files this phase must also touch. If that stream is still
   uncommitted when you start: say so in your first message, do all the work that does not touch
   those two files first, and stage your hunks in them by constructed blob (auto-memory
   `reference_shared_worktree_stage_race`). Never revert, stage or "tidy" another session's files.
   One hot money stream at a time — confirm no other session is in `expenses/panel.tsx`.
2. Branch `dev`; the dev server is not being used by anyone for a sweep.
3. The UAT fixture: `resolveUatContext()` returns `commitmentId` — a team bill with at least two
   installments, ONE PAID, and a recorded payment so History has a row on first open. If the bill
   has no paid piece, heal `scripts/seed-uat-coach-fixture.mjs` (guard by NAME, as Phase B learned —
   a guard that matches "any bill" is satisfied by QA specimens and seeds nothing).
4. `node scripts/check-layout-invariants.mjs --only=coach-commitment,coach-payables` is green BEFORE
   you change anything (today it unblocks on `[data-commitment="loaded"]`).

## 1. ITEM ONE — the mockup gate

Before QA, put whole-screen screenshots of TODAY's bill sub-view (before) and the built room
(after) — desktop and a true-size ≤640 phone frame each — beside the artifact's team-bill frame in
a Claude Artifact, and list every deviation with the ruling that forced it. A deviation is
acceptable only when forced by a standing ruling; each goes in the plan's Phase C deviations table.
The owner sees the comparison before the walk. ⚠ Phase B's prompt restated stale grammar twice and
the builder had to argue from the code: **if this prompt or the plan disagrees with a design-log
ruling, the ruling wins — record the deviation, do not follow the prompt.**

## 2. What Phase C builds

**The address.** `expenses/panel.tsx` becomes the ONE writer of `?bill=` through
`useRoomAddress('bill')` (`bill` is already in the hub's `ONE_SHOT_KEYS`; the guard test forbids
two FILES on one key, not one file's read and write). The panel's own `focusBillId` read and its
`router.push` back both retire into the hook. Deep links keep working unchanged. ⚠ Do NOT touch the
dues panel's `setUrlParam` here — see §4.

**The room** (`sentinel="bill"`, `loaded` true only once the STANDING has landed — the sweep's
green-check-over-"Loading payment details…" trap is documented at today's mount site; keep that
discipline, just move it onto the shell's `data-room-state`).
- **Title** is the bill's autosaving name field — it stays the lead, and by the 2026-09-03 ruling a
  card's lead cell is its title and takes no label. That is the decided treatment for the plan's
  "required-but-unmarked Name" item (title-slot exemption); record it as such.
- **Status chip** "N of M paid", derived from the standing, never a field.
- **Tiles** Total · Paid · Left · Next due — all from the existing standing computation. Decide at
  build what Next due reads when nothing is left ("Paid in full") and record it.
- **Children, in this order:** (1) the **Schedule**, primary and inline — per piece Record /
  Change · Remove, the three-way scope sheet (this piece / this and later / all unpaid) stacking as
  a Question in `QuestionShell`; the inline add-installment row stays (it asks nothing) and stacks
  to two lines ≤560px. (2) the **Details** fields — Filing · Payee · Tags · How · Notes, the six
  autosaving controls `CommitmentView` already owns, status strip ("Saved ✓" / the refusal) intact.
  `CommitmentView` may keep owning the fields and lose its header/back-arrow/page chrome, or
  dissolve into the room body — whichever leaves ONE owner of the draft; the docblock's rules
  (seeded once, keyed by bill, autosave never rejects an empty name) survive either way.
- **History** (the shell's `history` fold) holds the recorded payments; it opens itself when a
  payment lands THIS session and is collapsed otherwise. Each payment's control is **Remove** — it
  asks, names the dollars, and its confirmation DOCKS in the footer/doors slot (plan §10; the
  shell's `footDoors > [role=alertdialog]` contract), never in the scrolling body.
- **Actions row:** the one lime **Record** door (the conversation, pre-answered to this bill —
  a lock that spares one question, §135 ruling 1) and nothing else that duplicates a field.
- **Footer:** `GuardedDelete` "Delete this bill" — keep today's sentence (the ledger-reversal
  preview and the "whose credit goes" family line); press → the reason or the confirm.
- **Nav:** named Prev/Next across the Ledger's bills in the list's current order ("3 of 5 bills").
- **Close** is the shell's ✕ and Escape; the hardcoded "back to Ledger" label and the `backTo` prop
  retire. The Ledger stays mounted behind the room — filters and scroll intact.
- **Read-only money staff** see the same room with plain values (this stays the one place they can
  read a bill's payee and tags — R5) and no write control at all.

**Field fixes, same pass (mockup R1–R2, plan §4):**
- Tags drop the `addAsChip` "+" reveal → the standard always-visible search under the chips. Its
  ONE call site is `CommitmentView.tsx:412`; delete the prop from `TagSearchCombobox` outright and
  the CSS that served it (the dead-selector gate will ask). This reverses the 08-27 §114 tweak,
  owner-flagged 2026-09-02 — say so in the deviations table.
- Filing gets the unified paper ground: `BudgetItemPicker` already takes `paperGround`; the
  creation form passes it (`expenses/panel.tsx` ~5339) and the record view never did.
- `.commitFields` column cap `minmax(0, 34rem)` → **30rem**, the house cap (cf. `.clubLiveField`).

**The Payables list is the room's list.** Check its trailing column against the 2026-09-03 ruling:
a right-aligned real `<button>` chevron ("Open {bill}") and nothing conditional beside it. If
conforming needs more than the trailing column, FLAG it in your first message instead of widening
the phase.

**Verify the stacked pairs:** the scope Question over the room, and the portaled Record
conversation over the room. A bare Escape closes only the top layer (the floor's last-opened rule);
Escape inside the Question never closes the room.

## 3. Same-commit obligations (blocking)

- `scripts/layout-screens.mjs`: re-point the EXISTING `coach-commitment` entry (keep the id — the
  baseline is keyed on it) to `ready: '[data-room="bill"][data-room-state="loaded"]'`; retire
  `data-commitment`. The guard test fails until every sentinel is named there.
- ⚠ **NO UAT SPEC COVERS THE BILL PAGE TODAY** (grepped 2026-09-03: nothing in `tests/uat/scenarios`
  opens `?bill=`). Write `coach-bill-room.spec.ts` and RUN it against the dev server: open the room
  from the list and by deep link; Prev/Next walk; a field autosaves and the list behind agrees;
  record a payment on a piece and History opens itself; Remove asks and reverses; the scope Question
  stacks and Escape peels one layer; a read-only coach sees no write control. Re-run
  `coach-money-mobile-smoke` (its surface loop names the bill page — update the label). A spec that
  only compiles is not run.
- Help: `premium-money-ledger` rewritten for the room (`/docs`), and `premium-money-tags` if it
  describes the "+" reveal; keywords AND `searchText` included (Phase B's review caught the
  searchText still carrying the old phrases).
- Demo: `lib/sandbox-chrome.ts` ~621–645 already reasons about "Tap any row to open the bill behind
  it" and the Payables→Ledger fold. A bill now opens a ROOM; re-read those lines, adjust what is no
  longer true, add the dated re-read note, run `check:demos`, reseed if a state must show.
- Layout re-baseline for `coach-commitment` (and `coach-payables` if the trailing column changes)
  with a reason on every in-scope entry; sweep on a quiet dev server.
- `/simplify` then `/review` (high-risk tier — the shared shell and the payment-remove write path);
  fix confirmed findings before the walk. Apply Phase B's fixes by construction: busy by value,
  after-write reads the live open id, confirmations dock in the footer.
- A checkable QA walkthrough artifact (checkboxes + localStorage + paste-back; the Sign-in-as card:
  `uat-coach@uat-test-org.local` on `localhost:3000`, dev password from `.env.local`; the read-only
  step uses `uat-asst-money-read@uat-test-org.local`) and its own ledger section — **read the ledger
  tail for the next § number, never guess it** (it is past §138 as of 2026-09-03).
- Plan §4 gains a "4.1 — BUILT" block (what shipped + deviations table), the PM brief a Phase C
  section, the TODO line its Phase C clause.
- Commit only on the owner's word, with EXPLICIT pathspecs (`git --literal-pathspecs add` for the
  bracket directories); co-edited shared files staged by constructed blob; `git show --stat HEAD`
  must carry only your files.

## 4. Out of scope — do not take on the way past

- **Phase D (dues) — and it needs RE-PLANNING before anything is built.** The dues panel was
  rebuilt on 2026-09-03 by another stream (§136 the chase card gone; §137 the summary band, both
  footers retired, the Collection schedule as a foldable timeline — `3c40b0f9`; a further dues plan
  `COACH_DUES_SET_ONCE_CHASE_WEEKLY_PLAN.md` is in flight). Plan §5's four items were written before
  all of that; some may be done, moot or contradicted. Do not adopt `useRoomAddress` in
  `dues/panel.tsx` here.
- The club admin's own allocations unmark (plan §9 — the club's decision surface, its own walk).
- Any migration · `budget/`, `budget-vs-actual/`, `dues/`, `club/`, `fundraisers/` (other streams,
  or done) · the Payables list beyond its trailing column · restoring any in-place ruling this
  project supersedes · any cross-panel hand-off wire (the ninth §135 ruling deleted the last one).
