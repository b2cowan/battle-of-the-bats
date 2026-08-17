# New-chat prompt — build P3: the practice-plans shelf

Paste everything below the line into a fresh chat.

---

You are building **P3 of `docs/projects/active/COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md`** — the
practice-plans history shelf. The owner-gated mockup session is **done and approved**
(2026-08-16, artifact `f42be4f3`). Your spec is
`docs/projects/active/COACH_PRACTICE_PLANS_SHELF_PLAN.md` — read it and its PM brief first. The
mockups ARE the spec (house rule); do not redesign.

## What is already decided, so you do not re-open it

- **The shape.** Three chunks: C1 truth-up, C2 a third source in the copy picker, C3 a collapsed
  "practices you ran" section on Season's End. Plan §2.
- **What was rejected.** A drawer on the Practice plans hub. Plan §3 records why. If you find
  yourself adding anything to `practice/page.tsx` beyond C1's rewritten between-seasons message, or
  to `practice/[eventId]/page.tsx` beyond C2's third tab, stop — the governing constraint is that
  **the live screens measure identical before and after.**
- **No season dial, ever.** Nothing points the portal at a past year. Only Season's End and the
  routes it calls take a season.
- **No migration.** Every read is over existing columns. If you think you need one, you have
  misread the plan.

## Order, and the one thing that ships alone

**C1 first, committed on its own.** It is a live defect — the Practice plans hub currently tells a
between-seasons coach that a finished season does *not* keep its plans and to switch back to their
current season. Both clauses are false (plan §1.1). It needs no design decision and must not wait
behind the shelf.

Then C2 + C3 together.

## The three questions, already answered — carry them into the code

C3 adds **two** `HISTORY_ENDPOINTS` entries and **one** `HISTORY_PAGES` entry. The answers are
written in plan §2 C3 and must be transcribed into the guard test at the list, in the same commit,
in the form the existing entries use. Do not paraphrase them into something weaker.

C2 adds **none** — it is a cross-season reader, and C1 builds the enumerated list it joins. Read the
existing `CROSS_SEASON_READERS` note before writing the new detector: it explains why the signal
must be a named function rather than "reads more than one year".

## Where the risk is — plan §5, and it is the list, not the plan

1. A silently capped list tells a coach they ran fewer practices than they did.
2. The existing read door's gate (`canViewSchedule && hasRecordAccess`) exists to keep out a helper
   who turns up to run one station, and its header says the gate and the entry point must move
   together. Your new entry point carries the same pair.
3. A cancelled practice did not happen and must not appear.
4. The past-plan page's back link hard-codes one destination; C3 gives it a second caller and the
   season must survive the trip.

## Argue from the code, not the prose

This repo's plans have been wrong repeatedly, and §1 of the plan you are handed exists **because the
mockup session found three things the plan line got wrong.** If the code disagrees with the plan,
the code wins — say so in the commit and correct the plan in the same unit of work.

Two specifics already known to be stale, which C1 fixes: the read route's header describes a
`?year=` it no longer takes and an approved list it is no longer on; both `past-seasons` routes
claim to be listed in the guard test and are not.

## Gates before you hand off

- `npm run verify:changed` per chunk; `npm run typecheck` (C2/C3 touch shared read modules).
- ⚠ The layout fixture's *UAT Between Seasons* team has finished seasons and games but **no
  practices carrying plans** — seed them, then `node scripts/seed-uat-coach-fixture.mjs` before
  `check:layout`, or the sweep proves nothing about any of this.
- Offer `/simplify` if C2 and C3 land together (C2 adds a third branch to a two-branch picker),
  **then** `/review`.
- `/docs`: the practice-plans help section's wording about finished seasons follows C1's correction.
- Demos: the coach sandbox's 13U team is between seasons, so **C1's rewritten message is on the demo
  path** — check the tour narration and the dock lines still tell the truth beside it.
- Add one owner-QA ledger section, walked with three sign-ins (head coach, assistant with record
  access, helper without) on a between-seasons team **and** on a team that has rolled forward. The
  second is the case the whole phase exists for.

## Do not

- Touch P4 (the money past-season book) — its own gate, its own session.
- Make the drill or plan-template **libraries** season-aware. C2 copies the words of a past practice
  into tonight's plan; the decided-absence tests must stay green untouched.
- Reintroduce a season chip to answer "which season am I reading?" — it was a switcher wearing a
  label. Season's End answers it structurally.

## In flight beside you

A money-tab session has been working in the same checkout (`accounting/`, `lib/coach-money-*`).
Stage explicit pathspecs, bracketed dirs need `:(literal)`, and check `git diff` per file before
staging — two sessions have collided here already.
