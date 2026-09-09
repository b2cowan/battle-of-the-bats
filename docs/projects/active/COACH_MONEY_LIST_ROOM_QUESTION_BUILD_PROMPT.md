# BUILD PROMPT — List · Room · Question (open a build session with this)

**Read first, in this order:** `COACH_MONEY_LIST_ROOM_QUESTION_PLAN.md` (the plan of record) ·
`_PM_BRIEF.md` · the 2026-09-02 "LIST · ROOM · QUESTION" entry in `memory/design_decisions.md`
(binding; it names every reversal so you do not rediscover them as conflicts) · the mockup artifact
`claude.ai/code/artifact/11607f0a-e0c1-4bb4-bbd5-b6f81d834fbc` (the spec — rulings D1–D7 stamped
in place) · auto-memory `project_coach_money_list_room_question.md`.

## 0. Preconditions — verify before the first edit, stop if any fails

1. **The tree is quiet.** `git status` shows no OTHER session's uncommitted money files
   (`accounting/budget/`, `budget-vs-actual/`, `expenses/`, `lib/coach-budget-*`, `lib/db.ts`,
   `lib/types.ts`). The pre-commit gates are green on a no-op commit. One hot money stream at a
   time in this shared working copy — that is a standing rule, not a preference.
2. **Migrations 268–272 and 264 are on prod (verified in sync 2026-09-08)** — or the
   owner has explicitly waived this for Phase A in writing. Rooms are built against the schema
   prod runs.
3. **BvA Two Truths and the Budget tab revamp have landed their tranches** (their plans in
   `docs/projects/active/`). If the budget revamp has not built yet, run its approved mockups past
   the grammar once (five-minute read: no forms in rows) before it does.
4. Branch is `dev`; the dev server is not being used by another session for a sweep.

## 1. ITEM ONE — the mockup gate

The artifact is the spec. **Before QA on every phase**, put a whole-screen screenshot of the
built screen (desktop AND a true-size ≤640 phone frame) beside its artifact frame and list every
deviation. A deviation is acceptable only when forced by a standing ruling; each one is written
into the plan's deviations list with the ruling that forced it. The owner sees the comparison
before the walk, not after. Annotation chips sit beside elements, never over them.

## 2. Phase 0 — the room shell (new shared component; build and test first)

- **Anatomy props:** title, status chip, tiles (2–4, money figures only — never invent a tile),
  the record's own table (children), History fold (collapsed; auto-open only when something
  landed this session), footer doors (Edit · guarded Delete), one Record door, Prev/Next list
  (names + "n of N" count, order = the host list's rendered/filtered order, disabled at ends).
- **Shell behaviour (guard rule G3):** full viewport height, internal scroll region, width set by
  the record's table (~1040px default), full-screen sheet ≤640 with back arrow, 44px floors.
- **ARIA floor (D7 — ships with the shell, not per surface):** `role="dialog"`, `aria-modal`,
  `aria-label` naming the record, Escape closes, focus trap, focus restore to the opening row.
- **Dismissible-write-surface guard rails** (carried from the club fold's /review): live controls
  settle by comparing VALUES never by latching on a bump; close is busy-gated while a write is in
  flight; errors are raised to a surface that survives the room closing.
- **Addressability — BLOCKING checklist per room, same commit:** (a) a UNIQUE query key
  (`clubBill`, `clubRequest`, `drive`, `sponsor`, `bill`, `player`… never one shared key) and
  registration in the money hub's one-shot key list — the 08-26 "mounted twice" defect; (b) ≥2
  `layout-screens` SCREENS entries (room open populated · list state) — `check:layout` cannot open
  anything it is not told about, and the `?bill=` page shipped unswept once.
- Unit tests: prev/next order under a filter; one-open invariant; Escape/focus behaviour.

## 3. Phase A — Club tab (first: the screen that prompted the session)

- List flattens: two group headings, fixed rows (name · chip · one figure · chevron button with
  `aria-expanded` semantics replaced by open-room semantics), the **one-tap pill** on a bill with
  exactly one clean action ("Record as paid · $340"), the **reason preview line** on a declined
  request (truncated ~90 chars).
- **Club bill room:** tiles Billed / Paid / Left; one-tap installments (ruling R-D unchanged —
  fieldless, server-derived); files-under picker capped at 30rem; the club's description
  read-only; History; Prev/Next across bills.
- **Club request → QUESTION (D3):** the creation modal reopens pre-filled as the ONE editor
  (kills the fold/modal duplicate editor of the money-in answer); Withdraw at the form foot;
  decided requests readable from the row (decision + reason — today's unreachable decline-reason
  branch becomes reachable). Legacy requests with no money-in answer keep the ask-before-filing
  guard, now inside the form.
- Retire: the multi-open `expanded` map, in-row `ClubFilingControl`, the fold CSS. Re-baseline
  the club tab's layout entries with reasons (rows→rooms re-keys everything).
- Demo: the coach sandbox holds a filed bill + three requests in three states — it is the fixture
  that exercises this screen (the UAT fixture has zero club bills). Re-read every club sentence in
  the dock lines and tour; reseed if a new state must show.

## 4. Phase B — Fundraising (the large piece)

- Both bands become flat lists; the in-place expansions retire (D2: room only; the recorded
  fallback if the "who hasn't paid" skim is missed is a G1 read-only glance — never live
  controls).
- **Drive room:** tiles Raised / Team keeps / Credited; entries table with per-entry Edit /
  Remove as compact Questions (the inline `EntryEditor` + `doorsLive` lockout retire); Edit drive;
  guarded delete (floor sentences unchanged); Record = the grid Question.
- **Sponsor room — the one TWO-ZONE room:** tiles Pledged / Arrived / To come (+ past-due cue);
  arrivals list WITH Edit parity (undo-only today, no recorded reason); the per-family $/% credit
  plan as a live zone in the room, not behind Edit; Edit sponsorship; guarded delete; Record.
- **Record conversation:** add "A sponsor promised money — nothing arrived yet" → hands into the
  existing "+ Pledge" sheet, typing carried, reversible (mirror of the bill's "we agreed to pay
  something later" row).
- Help: the fundraising answers were rewritten 08-29 for two bands — rewrite again for rooms.
  Demo: narration is SILENT on fundraising by ruling `ea8ddd14` — keep it silent; do not re-grow.

## 5. Phase C — Ledger: the bill room + field fixes

- `CommitmentView` re-shells as a room over the always-mounted Ledger (it is already a `?bill=`
  sub-view; `.payDrawer*` classes still say so). Tiles Total / Paid / Left / Next due from the
  existing standing computation. Schedule stays primary and inline (Record / Change / Remove per
  piece; the scope sheet stacks as a Question); inline add-installment row stays, stacking to two
  lines ≤560px. Recorded payments → History fold. Close replaces the hardcoded "back to Ledger".
- **Field fixes (audit 2026-09-02):** drop `addAsChip` on Tags (the repo's only call site —
  reverses the 08-27 §114 tweak, owner-flagged); pass `paperGround` on Filing (the record view
  never got the creation form's unified ground); `.commitFields` 34rem → 30rem; decide the Name
  required-marker treatment (title-slot exemption or plain `*`) and record it.
- Read-only money staff see the same room with plain values — keep this the one place they can
  read payee and tags.

## 6. Phase D — Dues fixes (small; may ride any earlier phase)

Banner door → **"Send it back"** (Record pre-answered to the give-back branch); the lime
**Record** stays the one door for money arriving. Payments · payouts · credits → History. Room
shell adoption (ARIA floor, named Prev/Next across families). Migrated-payment note text stays
(logged debt).

## 7. Every phase, same unit of work

- `/simplify` then `/review` (correctness review runs on the cleaned version).
- `/docs` for every touched flow; `npm run check:demos` plus a HUMAN re-read of every dock line
  and tour step on the touched tab (the gate catches breakage, never a sentence that stopped being
  true).
- A checkable QA walkthrough artifact (checkboxes + localStorage + paste-back; the Sign-in-as
  card) and its own Owner QA Ledger section — do not pre-claim a § number; read the ledger tail.
- Commit with EXPLICIT pathspecs (`[id]` directories need quoting; verify `git show --stat HEAD`
  carried only your files); update TODO.md's one line with the commit anchor.

## 8. Out of scope — do not take on the way past

No glance folds on fundraising (D2) · no page for any money record (D4 reversed) · no changes to
the Budget tab or the BvA report (other projects) · no migration · no room for the club request
(D3) or budget lines · never edit another session's uncommitted files · never restore an in-place
ruling this project supersedes.
