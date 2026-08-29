# Build prompt — Guarded deletes for Fundraising (sponsors Q14 + drives R5)

**Paste into a fresh chat:** `execute docs/projects/active/COACH_FUNDRAISING_GUARDED_DELETE_PROMPT.md`

**Mockups (owner-reviewed, the spec — but THE CODE OUTRANKS THE PICTURE):**
https://claude.ai/code/artifact/02614de4-4df7-4275-a908-56427d52f8fb — section **"Guarded deletes —
sponsors (Q14) and drives"**. Four specimens: sponsor delete live (pledge) / refused (money in),
the drive drill-in's new per-entry **Remove**, and the drive Settings sheet's refused delete.

## Do not start until

1. **The §121 walk is closed and its session's work is committed.** That chat owns
   `SponsorBand.tsx` and the fundraisers panel while it walks; racing it re-creates the
   file-modified collisions of 2026-08-29. Check the Owner QA Ledger §121 entry and `git log`.
2. **R5 is ruled.** Q14 (sponsors) is ruled: guarded delete. R5 (drives) is the question box at
   the foot of the mockup section — A (per-entry Remove + refuse-until-empty, recommended),
   B (cascade with stated totals), C (sponsor-only). If the owner has not pasted an R5 ruling,
   ask before building the drive half; the sponsor half can proceed on Q14 alone.

## The state of the world (verified 2026-08-29 — re-verify, files move)

- **Nothing in Fundraising can be deleted today.** The sponsor/fundraiser record route
  (`app/api/coaches/[orgSlug]/teams/[teamId]/fundraisers/[fundraiserId]/route.ts`) exports
  **PATCH only**. A drive's per-player entry route (`…/entries/[entryId]/route.ts`) exports
  **PATCH only** — an entry can be edited, never removed. Sponsor arrivals DO have DELETE
  (`…/arrivals/[entryId]/route.ts`) — that is the sponsor's unwind path, already QA'd (§120/§121).
- Sponsors: Direction A — no pages; the record's one editor is the **"Edit sponsorship"** sheet in
  `app/[orgSlug]/coaches/teams/[teamId]/accounting/fundraisers/SponsorBand.tsx`. The create door
  is **"+ Pledge"** (renamed mid-§121-walk — do not "fix" it back). Status is DERIVED from
  arrivals; last-arrival undo returns a sponsor to a pledge.
- Drives: drill-in (`…/fundraisers/detail.tsx`) with leaderboard + **"Edit fundraiser settings"**
  sheet. ⚠ detail.tsx still carries a marked-dead sponsor half awaiting /simplify — do not extend
  it; drive work only.
- The payout floor lives in `lib/dues-credit-guards.ts` (§118): fundraiser/sponsor credits count
  toward a family's exposure; a credit already paid out refuses changes that would take the
  family below it. **Pre-flight before ANY write — a guard that fires after an irreversible write
  strands the record forever** (memory: `project_coach_money_centralization`).
- Drive entries create dues credits with provenance (`fundraiser_entry_id`); the dues drawer
  refuses editing/deleting them there (`CREDIT_HAS_SOURCE`) and directs to the fundraiser — the
  fundraiser side is therefore the ONLY place an entry can be unwound, which is why per-entry
  Remove must exist for a guarded drive delete to be honest.

## The design (one grammar, both kinds)

**Empty shell → delete with one plain confirm. Money on the books → the delete button is DEAD
with the reason beside it** (owner's foreseeable-refusal ruling, §118), **and the way out is to
unwind row by row** through doors that already state amounts and already carry the floor.

1. **Sponsor delete (Q14, ruled).** Delete strip at the FOOT of "Edit sponsorship":
   - Pledge (zero arrivals): live. Helper: *"Removes the $X promise from the plan and the forward
     view. No money moves."* Confirm restates. Record, credit plan, expected-by, tags all go.
   - Arrivals exist: dead, reason: *"This sponsor has $X on the team's books across N arrivals —
     undo its arrivals from the row first."* Server DELETE refuses too (409 + directions), as the
     belt against a stale screen.
2. **Per-entry Remove on the drive drill-in (R5-A).** Beside "Edit amount" on each player row.
   Confirm states both figures (the amount off the books, the credit off that family's dues).
   Floor-guarded per family; new DELETE verb on the entry route mirrors the guard server-side.
3. **Drive delete (R5-A).** Delete strip at the foot of "Edit fundraiser settings":
   - No entries ever logged: live, plain confirm.
   - Entries exist: dead, reason names the total and count and points at Remove — AND names the
     softer tool: *"If it's simply finished, set it to Closed instead: closing keeps every
     credit."*

**Why refuse instead of cascade (if asked):** a cascade erases several dated register rows at once
(cash-on-hand moves by a compound amount no confirm can honestly state) and must half-fail when
any family's credit is paid out. Unwinding row by row fires every guard in order.

## House rules that WILL bite

- Re-assert `pending + org + team` in every WHERE (memory: `reference_coach_money_check_then_act`).
- Dead-button = disabled + reason beside it + `title`; Enter-submit belt too.
- No new hex anywhere (token ratchet) — danger ink is `var(--danger)`.
- `SponsorBand.tsx` and the panel may have moved again — read them fresh, splice CRLF-aware.
- Stage explicit pathspecs; `[id]` directories need `:(literal)` pathspecs.
- Migrations: none expected. If one becomes necessary, dictionary + snapshots same unit of work.

## Done means

- Unit/UAT: extend `tests/uat/scenarios/coach-sponsor-money-lifecycle.spec.ts` (delete refused
  with arrivals → undo all → delete succeeds; pledge deletes clean) and add drive coverage
  (entry Remove floor-refusal path included). Run them live, not just typecheck.
- `npm run verify:changed` green; `check:layout --only=` the fundraising screen if layout moved.
- QA: extend the §-next walkthrough artifact (checkable, localStorage, paste-back — NEVER the
  artifact self-save capability) with a Deletes part; add the ledger entry (never renumber).
- Help docs: the fundraising answer in `lib/help-content/coaches.tsx` gains one sentence per
  delete door (search terms: 'delete a sponsorship', 'delete a fundraiser', 'remove an entry').
- Demo: narration is silent on fundraising BY RULING (`ea8ddd14`) — nothing to update unless a
  seeded record is deleted, which this must not do.
- **No commit without the owner's confirmation.** Offer `/review` after the build.
