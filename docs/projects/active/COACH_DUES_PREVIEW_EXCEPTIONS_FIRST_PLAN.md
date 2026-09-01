# Exceptions First — the Set-dues-for-all-players preview (owner-ruled 2026-09-01)

**Paste into a fresh chat:** `execute docs/projects/active/COACH_DUES_PREVIEW_EXCEPTIONS_FIRST_PLAN.md`

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
