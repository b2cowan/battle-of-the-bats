# Support console · Stage 4, Free time · finish: simplify, review, docs, strategy, commit

> Paste into a new chat on `dev`. Written 2026-10-25 by the Stage 4 build session. Stage 4 is BUILT and COMMITTED:
> `6c8f8fb89` (the door, every reader, mig 373) · `5353f2cf3` (the server rules) · `e9bb0b059` (the console) ·
> `a26ec5165` (the customer's billing pages), plus a docs commit after them. **This session runs four passes and ends
> with one commit (or one per pass, see §6). The owner has authorised that commit.** Everything here is a lead, not
> evidence: open the lines before you act on them.

## 1 · What Stage 4 is (one paragraph, for orientation)

Support staff (Super admin, Billing) give a club **free time**: a whole plan (Tournament Plus, Club, Club · Association),
sections, or a billing status, free through a last free day, with a reason. Every part of the product treats the club as
on the given plan until that day and on its own plan the moment after, with nothing scheduled: one server **door** answers
"what plan is this club on right now", and a build guard fails on any new raw read of the plan around it. **Every billing
action reads the plan the club pays for**, never the free one. The console shows it on the club record (chip, band, an
Access list with Change the end date and End it now, Story entries with Put it back), on a Free time list (Everyone ·
Founding Season · Given by staff) and on Today ("Free time ending", counted by club). The customer reads "Free through
{day}" on Plan & billing, amber in the last 14 days, "ended" for 30 days. Plan: `PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md`
("Stage 4 build gate", "Stage 4 threats → guards"). Walk (owner, owed): ledger §379,
https://claude.ai/artifact/4nqZcj52DpjYoQSEBWMUVZ.

## 2 · Where the code is

| Part | Files |
|---|---|
| The rules (pure, unit-tested) | `lib/free-time.ts` (fold, last day ↔ end instant in Eastern, caps, `decideGive`, `customerFreeTime`, `ownPlanOf`) |
| The door | `lib/entitlement-grants.ts` (`applyEntitlementGrants(org, storedLimits)`, `effectiveOrgFacts*`, `effectiveStatuses`, `getCustomerFreeTime`) |
| Writes | `lib/free-time-writes.ts`; routes `app/api/platform-admin/orgs/[id]/overrides/route.ts` (POST give), `…/overrides/[oid]/route.ts` (PATCH change, DELETE end), `…/put-back/route.ts` (`override_end`) |
| Console | `app/platform-admin/orgs/[id]/{ClubRecord.tsx,page.tsx}`, `app/platform-admin/RecordWindow.tsx` (`sentenceAfter`, `confirmHidden`), `record.module.css`; Story `lib/free-time-story.ts` (+ helpers moved to `lib/platform-story-view.ts`); list `lib/free-time-list.ts`, `app/platform-admin/free-time/*`; Today `lib/platform-waiting.ts`; menu `console-menu.ts`, `lib/platform-areas.ts` (`free_time`) |
| Customer | `app/api/admin/org/free-time/route.ts`, `lib/free-time-copy.ts`, `components/admin/FreeTimeBand.tsx`, `app/[orgSlug]/admin/org/billing/page.tsx`, `components/admin/kit/club/BillingKit.tsx`, `components/billing/PlanPanelDrawer.tsx` |
| Readers moved onto the door | register, chat, team move, permits, venue clashes, family access, notify, fan-notify, account notifications, user contexts, invite acceptance, directory + sitemaps, fan follows, scores feed, the db.ts sweeps; billing actions onto `ownPlanOf` |
| SQL | `supabase/migrations/373_the_fee_book_reads_free_time.sql` (`org_effective_plan`, `org_has_effective_addon`; the ONE SQL copy of the fold; dev applied, prod at release) |
| Guards | `tests/unit/{plan-reader-door-guard,free-time,free-time-give,free-time-story,free-time-surfaces}.test.ts` (62 tests) |

## 3 · The four passes, in this order

### 3.1 `/simplify` (the built-in skill) on the Stage 4 commits
Scope: `git diff 004aae8b2..a26ec5165 -- <the files in §2>` (other sessions' commits sit between; diff by path). Look
for: duplication between `lib/free-time.ts` sentence builders and `ClubRecord.tsx`'s window sentences
(`freeTimeSubject`, `dayAfterWords` exist in both the record and `lib/free-time-copy.ts`); `ClubRecord.tsx` grew ~350
lines (the three windows could move to their own file beside it); `lib/free-time-writes.ts` `changeFreeTimeEnd` reads
the club facts twice (once for the block). **Do not** change behaviour, rename a route, or touch the door's contract.

### 3.2 `/review` (`.claude/commands/review.md`) at **high**
High risk: the access path for the whole product, `proxy.ts`, a money-adjacent write. Ask each lens specifically:
- **The door.** Can any reader still see the stored plan for an ACCESS decision? (The census guard only sees column
  names; a reader that takes `org.ownPlanId` for access would pass it.) Is the client `currentOrg` (from
  `/api/org-context`) ever stale in a way that WRITES? Every write must re-check through the door.
- **Billing actions.** Every billing action on `ownPlanOf`, including any the census missed (grep `planId` in
  `app/api/billing`, `lib/plan-*`, `BillingKit`, `billing/page.tsx`).
- **The write rules.** Each refusal in `decideGive`; the compare-and-set in `changeFreeTimeEnd`; Put it back
  `override_end` (cap, a passed earlier day ends now); End it now refusing a comp period.
- **Time.** End instant = first moment after the last free day in America/Toronto across DST; `daysLeft`,
  `isEndingSoon` (< 14) and Today's window agree.
- **The SQL rule vs the TS fold** (`org_effective_plan` vs `foldGrants`): same rank, same running test, same grantable
  plans. The SQL cannot see the env switch; that is documented, decide whether it matters.
- **T15:** the customer route returns no reason, giver or grant id.
- Known, report-only (do not fix unasked): `/billing` noted `app/api/billing/cancel/confirm` has no server guard for a
  club with nothing to cancel; Bulk changes' Subscription status override still takes an optional end with no cap (the
  walk's call 14 asks the owner).

### 3.3 `/docs` (`.claude/commands/docs.md`)
The console's help on free time (`lib/help-content/platform-admin.tsx`: Give free time, Change the end date, End it now,
the Free time list, Today's Free time ending, who may give it and the caps, the refusals), and the customer's billing help
(the "Free through" band in three states; Club's page while Club is free). Words: "Free through {last free day}" only
(the spelling gate refuses "free until {date}"); never a price or a limit. ⚠ `lib/help-content/platform-admin.tsx` has
another session's uncommitted Bookkeeping edits: stage only your hunks (§6).

### 3.4 `/strategy` (`.claude/commands/strategy.md`)
Log, as **Decided** (owner rulings 2026-10-25, plan "Owner rulings … (Stage 4 drawings)" and "Stage 4 build gate"):
operator free time exists (who, caps, what can be given, refused on a paying club, not on a portal). Add the line to
`docs/agents/strategy/PLAN_PRICING_FACTS.md` (free time = an operator grant above the club's own plan, no price, no card)
and run its drift checklist. Raise as **Proposed / owner question**, not decided: a club could take up to 12 months of
free Club and then the full 90-day Club trial (moot until Club is on sale). Also fix the stale `/billing` guide claim in
`PROGRAM_BILLING_AND_ENTITLEMENTS.md` §1.4 (`type:'plan'` enforced by plan-gating-server: not true) if `/strategy`
routes it to you.

## 4 · Verify (after the passes, before the commit)
- `npx next typegen` then `npm run typecheck`.
- `npm run lint:focused -- <changed files>`.
- Tests WITHOUT clearing other sessions' results: `node --import ./tests/ts-resolver.mjs --test "tests/unit/**/*.test.ts" "lib/**/*.test.ts"`.
  Known reds that are other sessions' (do not chase): `migration-table-grants-guard` (mig 354 bookkeeping),
  `table-recipe-guard` (bookkeeping css), `possessive-guard` (`TryoutCoachAddressLine.tsx`),
  `tournament-stage3-part7-guard` (Teams toolbar). Report any NEW red.
- `node scripts/check-spelling-consistency.mjs`, `node scripts/check-css-selectors.mjs`,
  `node scripts/check-dictionary-coverage.mjs` (its current gaps are other sessions').
- If a pass changed a shared module or added files, restart the dev server (`npm run dev` only, with network) and
  re-run the read-only probe `node --env-file=.env.local .probe/pasc/s4-smoke.mjs` (it waits for the login page to load;
  it never writes).

## 5 · Records after the commit
- The plan's Stage 4 status line and S4 ladder row: add the new hash(es) and "simplify + review + docs + strategy done".
- Ledger §379 "Built:" line: add the hash(es). TODO's Stage 4 line likewise.
- The project index (https://claude.ai/artifact/TLP8d5Zec4xVkTSYrQU8tp): an `ArtifactData` write, never a republish.
  `stages/s4` (read it first, pin `if_version`): update `anchor` with the hashes. Add `log/l20261025-08` (next free id;
  query `log` where date == 2026-10-25 first) with what the passes found and fixed.
- The auto-memory note `project_platform_admin_support_console.md`: one line with the hashes and any review finding
  worth keeping.

## 6 · Git (the shared working copy)
- On `dev` only; re-check `git rev-parse --abbrev-ref HEAD` before every commit; `git show --stat HEAD` after.
- **Explicit pathspecs only.** Other sessions (Club Tier 12b, House league 9c, Bookkeeping) edit the same tree and commit
  while you work. For a file that also holds their edits, stage only your hunks:
  `node .probe/pasc/s4-stage-hunks.cjs --dry "path=regex"` prints each hunk KEEP/skip, then run it without `--dry` to
  stage the kept hunks (`git apply --cached --unidiff-zero`). Check the dry run before staging.
- Commit messages from a file (`git commit -F`), written with the Write tool. End with
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (or the attribution line the session gives you).
- Suggested commits: `refactor(support-console-s4): simplify …`, `fix(support-console-s4): review …`,
  `docs(support-console-s4): help …`, `docs(strategy): free time …`. One combined commit is fine if the passes are small.
- Never push; never touch `master`.

## 7 · Traps this stage already hit (don't repeat)
- **Shell strings eat code.** A heredoc dropped `\\` from regex replacements; a `node -e "…"` containing backticks ran
  them as commands. Write edit scripts and commit messages with the Write tool; edit prose with Edit.
- **`apply-migration-api.mjs` is not a query tool:** it triggers the snapshot refresh against BOTH databases.
- **The test resolver doesn't resolve `@/`:** a module a unit test imports uses relative imports (`lib/free-time*.ts` do).
- **The UAT console sign-in:** the probe must wait for the login page to load, or the click submits as a plain reload.
  Never overwrite `tests/uat/.auth/*.json`.
- Agents' own rules: `AGENTS.md`, `AGENCY_RULES.md` (product-owner voice to the owner; no perishable negatives in records).
