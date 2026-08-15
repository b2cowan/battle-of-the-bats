# Kickoff prompt — the monthly recurrence engine, on its own (paste into a fresh chat)

Build **one pure module and its tests**. No UI, no routes, no migration, nothing wired up. This is
the date arithmetic behind recurring payables, extracted so it can be built and proven while the
screen it will eventually serve is busy with other work.

## Why it exists

Coaches need monthly payables (dome blocks, field rental, insurance, equipment financing). The
portal's existing recurrence engine — `lib/coach-recurrence.ts`, built for the schedule's "repeat
weekly" — is **weekly-only**. The interaction pattern is already settled and reused; only the month
arithmetic is new.

Full context: `docs/projects/active/COACH_RECURRING_PAYABLES_PLAN.md` (§3.3, §3.4, §3.5, §6.1, §6.5).
**Build only §6.1 and §6.5 here.**

## Read first

1. `lib/coach-recurrence.ts` — **in full, including the docblocks.** This new module is its sibling
   and must match it in contract, discipline and comment quality. Note especially:
   - the relative `./timezone.ts` import (not `@/`) so tests run under plain `node --test`;
   - `generateWeeklyOccurrences` / `reviewRecurrenceOccurrences` and *why* the reconcile exists;
   - the note on why UTC arithmetic on a DATE-ONLY value is safe and what the banned idiom is.
2. `tests/unit/coach-schedule-intelligence.test.ts` — how the weekly generator is tested.
3. `memory/date_correctness_guardrail.md` and `lib/timezone.ts`.

## What to build

`lib/coach-monthly-recurrence.ts`

```
MAX_MONTHLY_OCCURRENCES = 24

MonthlyRecurrenceRule {
  dayOfMonth: number | 'last'          // 1–31, or the month's last day
  startDate: string                    // YYYY-MM-DD, inclusive
  end: { until: string } | { count: number }
}

generateMonthlyOccurrences(rule): MonthlyOccurrence[]      // { date: string; clamped: boolean }
reviewMonthlyOccurrences(rule, submitted): { accepted, removed, unknown }
```

### The rules that are product decisions, not implementation detail

**Clamping (plan §3.3).** "The 31st" does not exist in February. Silently skipping the month gives
five payments from a six-month rule; silently clamping gives a date the coach never typed. **Clamp to
the last day of a short month, keep the count, and flag the row** — `clamped: true` is what the UI
renders its *"February has no 31st"* note from. `dayOfMonth: 'last'` is a first-class value, not
sugar for 31.

**The ceiling (plan §3.4).** 24. Refused by the generator, and later by the commit route, with the
same message. The weekly module's 60 is right for 53 weeks and wrong here.

**The reconcile (plan §3.5).** Identical in spirit to `reviewRecurrenceOccurrences`: a submitted date
the rule cannot produce is `unknown` and must fail the whole request — never quietly dropped, never
written. A generated date that was not submitted is a deliberate `removed` (the month off).

**Date discipline.** Pure string stepping. No `Date` constructed to answer "what day is this", and no
instant ever formatted down to a calendar day. Returns `[]` on a malformed or incomplete rule rather
than throwing.

### Tests — `tests/unit/coach-monthly-recurrence.test.ts`

Plain `node --test`. Non-negotiable cases:

- the 31st across February — **clamped, and the count preserved**;
- `'last'` across a leap February and a non-leap February;
- `{ count: 6 }` and `{ until: <the 6th date> }` producing the **same list**;
- the cap refusing at 25, and a rule that would run for years;
- `reviewMonthlyOccurrences` returning `unknown` for a date the rule cannot produce;
- a removed date reported as `removed`, **not** `unknown`;
- a duplicate submitted date treated as `unknown` (match the weekly module's behaviour);
- month-length edges: 29th/30th/31st across a year boundary, and a start date that is not itself on
  the chosen day of month.

## Scope boundaries — important

- ⛔ **Nothing outside the new module and the new test file.** No form, no route, no migration, no
  type added to `lib/types.ts`, no export barrel.
- ⛔ **Do not touch `app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx`** — another
  chat is actively working on that screen.
- ✅ The module having **no callers yet is correct and expected.** Do not wire it in to prove it
  works; the tests are the proof. If a lint rule objects to an unused export, report it rather than
  inventing a consumer.

## Finishing

- `node --test tests/unit/coach-monthly-recurrence.test.ts`, then `npm run verify:changed`.
- No help-docs and no demo work — nothing user-facing changes.
- Update `docs/projects/active/COACH_RECURRING_PAYABLES_PLAN.md` to record that §6.1 and §6.5 are
  built, so the chat that picks up the screen work knows the engine is ready.
- Offer `/review` — it is small, but it is date arithmetic that money will ride on. `/simplify` is
  not warranted.

## Working rules

- Branch is **`dev`** — check before committing; another chat may have moved it.
- Stage **explicit pathspecs only**, never `git add -A`. Confirm with `git show --stat HEAD` that
  only your two files landed.
- **Do not commit or push without explicit confirmation from the owner.**
