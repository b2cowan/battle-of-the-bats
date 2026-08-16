# ⚠ SPENT — P2 was committed `fd7c2c3e` on 2026-08-16.

The landing described below is DONE except for one item: **the rendered baseline for the five new
finished-season screens**, which needs a quiet dev server (see §2 below, and the plan's §8). Kept for
the record of how the commit boundary was drawn against the money-tab session; do not re-run it.

---

# New-chat prompt — land P2 (the season toggle is already out; this gets it committed)

Paste everything below the line into a fresh chat.

---

You are **landing a finished phase, not building one.** P2 of
`docs/projects/active/COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md` — "the season toggle and the archive
place come out" — is **built, gated and reviewed on dev, and sitting UNCOMMITTED in a shared working
copy.** Your job is to get it committed cleanly, finish one piece of verification that could not run,
and hand the owner a walk-through. Read the plan's **§5 P2 build checklist**, the **P2 build state**
block under it, and **§8 (the follow-ups)** before touching anything.

## ⚠⚠ Read this part twice — the working copy is SHARED and has moved

A **money-tab session** has been running in parallel in this same checkout for the whole of P2, and it
has grown from 9 files to a substantial rework (`CoachMoneySection` re-split into Transactions /
Payables, a new money-records panel, ledger changes). **Its work and P2's are now interleaved in the
same files.**

**These files are THEIRS. Never stage them, never "fix" them, never revert them:**

```
lib/db.ts
lib/expense-ledger.ts
lib/timezone.ts
lib/coach-money-links.ts
scripts/seed-qa-day-fixtures.mjs
tests/unit/expense-ledger.test.ts
app/[orgSlug]/coaches/coaches.module.css
app/[orgSlug]/coaches/teams/[teamId]/accounting/MoneyRail.tsx
app/[orgSlug]/coaches/teams/[teamId]/accounting/OverviewDashboard.tsx
app/[orgSlug]/coaches/teams/[teamId]/accounting/SetupOverview.tsx
app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx
app/api/coaches/[orgSlug]/teams/[teamId]/expenses/[expenseId]/route.ts
components/coaches/MoneyMonthGrid.tsx
docs/projects/active/COACH_MONEY_*.md, COACH_MONEY_*.html
```

⚠ **Three of those carry a P2 edit inside them** — `accounting/expenses/panel.tsx`,
`components/coaches/MoneyMonthGrid.tsx` and `app/api/.../expenses/route.ts` all had their season
query removed by P2, and the money session has since rewritten large parts of the same files around
that removal. **Do not try to hunk-separate the panel or the grid.** Their rewrite has absorbed P2's
deletions; the P2 property that matters (no `?year=` anywhere) is already true in the committed-to-be
state and is build-enforced by `tests/unit/coach-history-endpoint-guard.test.ts`. Only
`app/api/.../expenses/route.ts` has a genuinely separable two-line P2 hunk (the resolver rename).

⚠ **THE TYPECHECK IS CURRENTLY RED, AND NONE OF IT IS P2's.** Five files fail on the money session's
in-flight `CoachMoneySection` rename (`'expenses'` left the union). **Verify that before you do
anything else** — if the red has moved to a file P2 owns, something changed after P2 was reviewed and
you need to find out what. P2's own state at review time was: typecheck ✓ · 2,032 unit tests ✓ ·
`check:demos` ✓ · CSS purity ✓ · contrast/token/date ratchets ✓ · dictionary ✓ · lint 0 errors.

⚠ **Waiting does not make this safer — it makes it worse.** Every day P2 sits uncommitted, the money
session rewrites more of the files it shares. If the other chat has landed its work by the time you
start, commit P2 immediately after theirs. If it has NOT, commit P2 anyway with explicit pathspecs;
that is what the pathspec discipline exists for.

## The job, in order

### 1. Re-verify, because the tree has moved since the review

Run, and read the output rather than assuming:
- `npm run typecheck` — expect failures ONLY in the money session's files listed above. Anything
  else is new and must be understood before committing.
- `npm test` — expect **2,032 passing**. A failure in `expense-ledger.test.ts` is theirs.
- `npm run check:demos`, `node scripts/check-css-module-purity.mjs`
- `npm run lint:focused -- <the P2 files you are about to stage>`

Schema-parity being red is expected and not P2's — migrations 236–245 are dev-only from other
sessions. **P2 adds no migration.**

### 2. The rendered check that could not run — finish it

P2 closed a fixture gap that had hidden three rounds of defects: the sweep's world had **no completed
season anywhere in it**, so Season's End, the compare list and every read-only record state were
invisible to it. There is now a **"UAT Between Seasons"** team in the seeded fixture and **five new
screens** on it: `coach-season-end`, `coach-finished-insights`, `coach-finished-results`,
`coach-finished-roster`, `coach-finished-money`.

**They have no baseline yet.** The run was attempted and produced nothing after ten minutes against a
dev server the money session was also using, so it was stopped rather than left to chew the shared
server (`AGENTS.md`: stop a check that appears hung; an abort is a failure, not a pass).

Do this on a **quiet** server, when nobody else is browsing it:
1. `node scripts/seed-uat-coach-fixture.mjs` — idempotent; it will report the between-seasons team.
2. Warm the routes once (open them in a browser or curl them) — cold Turbopack compile is what
   swallowed the first attempt, not a layout failure.
3. `node scripts/check-layout-invariants.mjs --only=coach-season-end,coach-finished-insights,coach-finished-results,coach-finished-roster,coach-finished-money --init`
4. Read every finding before baselining it. ⚠ **A green sweep over an empty fixture is not evidence** —
   confirm each screen actually rendered its content (a roster with players, a results table with
   the four seeded games, a Wrapped card), not a "no data" state.
5. If findings are real layout defects, fix them and re-run rather than baselining them in.

⚠ Do **not** run the full 29-screen sweep against a server the other session is using.

### 3. Commit

Branch `dev` (re-check with `git rev-parse --abbrev-ref HEAD` first — another chat may have switched
it). **Explicit pathspecs only, never `git add -A`.** Bracketed directories need `:(literal)`:

```
git add ":(literal)app/api/coaches/[orgSlug]/..." ...
```

After committing, run `git show --stat HEAD` and **confirm only P2 files landed.** If a money-session
file slipped in: `git reset --soft HEAD~1`, `git restore --staged <file>`, re-commit.

Suggested commit message shape — the second paragraph matters, because a future session will ask why
two test files vanished:

```
feat(coaches): the season toggle comes out — history is delivered in place (M1, P2)

The sidebar season <select>, the phone More-sheet season list and the page-title
season chip are deleted, with the parallel closed-season nav behind them. A coach
sees the season their team is ON; looking back is Season's End, Season Wrapped and
the compare list at the foot of Insights.

Tests were REWRITTEN, never deleted. coach-season-write-guard →
coach-history-endpoint-guard (new contract, plus a client-side half that was
impossible before: no coach PAGE may read ?year=). coach-archive-season-rail is
retired with its keepers redistributed into coach-finished-season-surfaces — its
season-switching assertions died with the feature. coach-frozen-season-smoke →
coach-membership-smoke, re-fixtured around a between-seasons team.

No migration. Owner QA: ledger §40.
```

### 4. Truth-up after the commit

Per `AGENCY_RULES.md`'s status-wording rule — **record the positive fact with its anchor, never a
perishable negative:**
- The plan's **P2 build state** block: "✅ BUILT ON DEV" → "committed `<hash>` 2026-08-<dd>".
- `TODO.md`'s membership line: same.
- The Claude auto-memory file `project_coach_membership_history_in_place.md` and its `MEMORY.md`
  index line: same.
- Owner QA ledger **§40**'s header: "not on production" stays true, but add the commit anchor.

## What you must NOT do

- **Do not build P3 (the practice-plans shelf) or P4 (the money past-season book).** Both are
  **owner-gated behind their own mockup sessions** — his explicit ruling, recorded in plan §1.6:
  each shelf gets a detailed planning session with mockups, approved before build, and **the current
  season stays the page's primary focus**. Deleting the archive did not license building the shelves.
  If you find yourself adding an entry to `HISTORY_ENDPOINTS`, stop.
- **Do not fix the money session's typecheck errors.** They are mid-flight.
- **Do not close the follow-ups in plan §8 opportunistically.** #1 (the client/server mid-rollover
  tie-break) needs a shared-DB change in `lib/db.ts`, which is the money session's file. #4
  (`moneySectionHref`'s dead 4th parameter) is inside their active rework. Both are logged on
  purpose.

## The one judgement call worth re-making

P2's §8 follow-up #1 is a **real, narrow divergence**: the browser picks a mid-rollover season by
highest year, the API by most-recently-created. They agree for every rollover the product performs.
It pre-dates P2, but P2 removed the `?year=` that used to override it. **If the money session's
`lib/db.ts` work lands first, closing this becomes cheap** — carry `created_at` onto the assignment
row and sort on it client-side. Judge it then; do not force it now.

## What to produce

1. The commit, with `git show --stat HEAD` output confirming only P2 files landed.
2. The five new screens baselined, with a sentence on what each actually rendered.
3. The truth-ups above.
4. A short product-owner summary: what landed, what is still owed (owner QA §40), and anything the
   re-verification turned up that the review did not.
