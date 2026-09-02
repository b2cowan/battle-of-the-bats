# Exceptions First — the Set-dues-for-all-players preview (owner-ruled 2026-09-01)

**Paste into a fresh chat:** `execute docs/projects/archive/COACH_DUES_PREVIEW_EXCEPTIONS_FIRST_PLAN.md`
(archived 2026-09-02 — built, reviewed, QA §128 PASSED 28/28, committed `e5bc9fd0`)

**Rulings (all option A, on mockup artifact `4f742ce0-2b8c-4050-a229-911894aaec62` — the spec,
but THE CODE OUTRANKS THE PICTURE):**
- **Q1 A** — the replace question ("keep the ones I set by hand") moves INTO the preview, as a
  checkbox on the named row; the post-confirm dialog retires for previewed runs.
- **Q2 A** — a payout-floor refusal shows as a BLOCKED row in the preview, excluded from the
  button's count; the run still completes for everyone else (what the server already does,
  surfaced one step earlier).
- **Q3 A** — the identical-rows grid renders ONLY when per-player amounts genuinely vary
  (overrides); a uniform roster collapses to one sentence.

Two rulings from the same walk are already LIVE and bind this build's copy:
- **Catch 9:** the over/short strip renders once — beside Confirm when the preview is open.
- **Catch 10:** over-collecting is a BUFFER — quiet ink, the budget card's own sentence
  ("Includes a $X buffer above the plan."), never danger tone or a scold. Short keeps amber.

## What this changes for a coach

The preview stops printing N identical rows and answers the commit-step questions: one sentence
for the common case ("Every player: $1,000.00 due Oct 10 — $12,000.00 across 12 players"), a
named row per player the run treats differently — paid money re-applying, credits being created,
hand-set plans (with the keep-checkbox right there), due-date changes, floor refusals — then ONE
"When you confirm:" line itemizing counts, and a button that counts what it will actually write
("Set dues for 10 players"). The two after-the-button surprises die: the replace dialog and the
refusal both show BEFORE confirm.

## State of the world (verify — this tree moves)

- The write route (`budget-plan/generate-installments`) already: refuses per-family on the
  payout floor pre-flight (`payoutFloorRefusals`, a subset of `playersFailed`, invariant
  `processed + skipped + failed.length === players.length`); accepts `skipPlayerIds`; detects
  hand-set schedules by SHAPE COMPARISON (never the `source` column — that lesson is written at
  the detection site); returns `playersWithDateChange`; and 409s `ALREADY_HAS_DUES` with
  `handSetPlayers` named when `replace` is absent.
- The preview endpoint (`budget-plan/installment-preview`) returns per-player installment rows
  only — no exception facts. The modal (`GenerateInstallmentsModal.tsx`) renders the grid,
  handles the 409-replace dance, and reports refusals post-confirm.
- §124's uncommitted walk fixes touch the same modal (single strip, buffer tone, refusal
  rendering) — build ON TOP of them; re-read the file fresh.

## Build shape (no migration; the server's guards never move)

**A · The preview learns the exceptions (data first, pure where possible).** Enrich the preview
response (same endpoint or a sibling — decide from the code) with, per player: payments total /
kept; projected overpayment-credit delta (reuse `planOverpaymentReconcile` — never new
arithmetic); hand-set flag + current shape summary (REUSE the write route's shape comparison —
extract it to one shared home so the two screens can never disagree about who differs); due-date
change flag; payout-floor refusal (reuse `projectScheduleTotalChange` + `payoutFloorViolation`).
Plus a uniform/varied verdict. Unit-test the extracted derivations.

**B · The modal recomposes.** Common-case sentence (`.common` treatment per mockup) · buffer/short
strip (catch 9/10 rules) · exceptions list with the four row kinds (plain / warn=hand-set with
checkbox / blocked=refusal) · "When you confirm:" count line · button counting writes. Grid only
on variance, below the exceptions. Phone: the list stacks; no sideways scroll.

**C · The folds.** The keep-checkbox drives `skipPlayerIds`; a previewed run sends `replace`
resolved up front, so the `ALREADY_HAS_DUES` 409 becomes the BELT for stale/non-previewed calls
— it is never removed. The refusal row mirrors the server's own answer; on confirm the server
still re-checks (pre-flight-not-transaction is the accepted posture; a raced refusal still comes
back named in the result and the modal already renders it).

**D · Verification.** Unit on the extracted derivations · typecheck (shared modules) · the
lifecycle spec's bulk test must stay green (⚠ that spec is a cross-session MUTEX — announce
before running; `--retries=0`; a money test green on retry is not a pass) · a preview-shape UAT
test (exceptions named for the mixed fixture) · throwaway Playwright measurement for the modal at
360/768 (`check:layout` cannot open modals mid-flow) · ⚠ `verify:changed` dies at schema parity
while any migration is dev-only — attribute before believing.

## House rules that WILL bite

- Shared working copy: fresh-read before editing; explicit pathspecs; constructed blobs for
  co-edited files; no commit/push without the owner's word.
- One home per sentence/derivation — extract, never copy (the floor sentence, the shape
  comparison, the reconcile planner all live once already; join them, don't sibling them).
- Chips/tags beside elements in any mockup update, never over.
- QA: a NEW ledger section with a checkable walkthrough artifact (real checkboxes + localStorage
  + paste-back; never the artifact capability) — §124 is the dues-forms walk and stays its own.

**PM brief:** `COACH_DUES_PREVIEW_EXCEPTIONS_FIRST_PM_BRIEF.md`.

---

## BUILT ON DEV 2026-09-01 — what actually landed, and where it departed from the picture

**QA section: §128** (the Owner QA Ledger) · **walkthrough artifact:**
`claude.ai/code/artifact/bcdda5ea-7b8d-477d-9f14-82582fa8a7ef` (28 checkable steps, eight parts).

**A · the preview learned the exceptions.** One new pure module, `lib/dues-bulk-run.ts`, holds the
whole derivation: the shape comparison (MOVED out of the write route, with its reasoning, so both
screens read one function), the due-date diff, and `planRosterDuesRun`, which joins them per player
with the reconcile planner's credit figure and the payout floor's own refusal. No arithmetic is
re-implemented anywhere in it. The preview endpoint grew four season-wide reads, all in parallel,
and returns a `run` block beside its rows. The write route now calls the shared comparison instead
of its own copy; its behaviour is unchanged.

**B · the modal recomposed** to: the common-case sentence · the strip (once) · the named exception
rows in three tones · the keep-checkbox · the "When you confirm:" line · the grid, on variance only ·
a button counting the writes. The 409 belt is untouched and still renders `replaceFacts`.

### Three departures from the mockup, all deliberate

1. **Q3 removes the grid rather than demoting it, today.** The mockup's variance scenario is
   per-player overrides; this door cannot produce one — every active player gets the identical
   schedule and the sheet says so in its opening line. The variance branch is built and derived from
   the amounts (`amountsVary`), so the table returns unaided the day a screen sends an override.
   Until then, the honest description of Q3's visible effect is "the table is gone".
2. **The plain "has paid" rows cap at six** (`PLAIN_ROW_CAP`), with "+N more players have payments…"
   beneath. Hand-set and blocked rows are never truncated — they are decisions, not information.
   Without a cap, a mid-season roster where every family has sent something rebuilds the exact wall
   this screen exists to pull down.
3. **The hand-set row follows the checkbox** — "kept exactly as it is" / "this run replaces it". The
   mockup left it fixed at "would replace it" beside a checkbox ticked to keep, which is one row
   saying two things.

### Two rulings from the plan text that the mockup overruled

- **Date changes are a COUNT, not rows.** The plan's prose lists them among the row kinds; the
  mockup carries them only in the "When you confirm:" line, and the mockup is right — a team-wide
  date fix moves everybody's dates, so rows would print twelve names to say one thing. The count
  follows the keep-checkbox exactly (the ids ride in the payload for that reason).
- **A refused player is never sent as a skip.** The outcome for the family is identical either way,
  but a skip is silent and a refusal comes back BY NAME with the floor's sentence. The server stays
  the thing that says "this family was protected", which is what the preview's row promised.

### Verification actually run

Typecheck clean · focused lint clean · **2,758 unit tests green** (new suite:
`tests/unit/dues-bulk-run.test.ts`) · **coach money lifecycle UAT 16/16 at `--retries=0`**, carrying a
new test that asserts the preview's hand-set names and refusals are IDENTICAL to the write route's
own answer, read through both live endpoints · spelling, CSS purity, CSS selectors, contrast,
text-contrast, date-correctness and token gates green · a throwaway Playwright measurement at 360 and
768 on a live 12-player roster (no horizontal page scroll, rows stacking at 360 and inline at 768,
"Set dues for 10 players" against 12 with 2 kept).

⚠ `verify:changed` was NOT run end to end: it dies at schema parity while migrations 268–272 are
dev-only, so the gates it wraps were run individually. ⚠ Two typecheck errors in a PEER session's
practice page are theirs, pre-existing and untouched.

⚠ **Pre-existing finding, surfaced not introduced:** the shared money modal's footer buttons measure
**31.4px tall** at both widths — under the portal's 44px touch floor, portal-wide across every Money
sheet. It belongs to the header house-rules work, not here.

