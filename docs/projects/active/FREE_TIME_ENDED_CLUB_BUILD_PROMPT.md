# Build prompt — free time brings an ended club fully back, and the cancellation returns when it ends

> Written 2026-11-18 by the Club release Stage 8 writing session, at the owner's request ("write the prompt to build it
> now"). Source: `docs/agents/ops/CLUB_SUPPORT_AND_ROLLBACK_RUNBOOK.md` §4 (the known gap) and owner question 3 there.
> Board: the "Club release" line (`club-tier`) lists it under what remains. Branch: `dev`. Do not push or deploy.

You are building a small, money-adjacent fix in FieldLogicHQ (Next.js 16 — read `AGENTS.md`; this repo's conventions
differ from your training data). Read `CLAUDE.md` and `AGENCY_RULES.md` first. The working copy is shared with other
sessions: stage explicit paths only, check `git show --stat HEAD` after every commit, commit only when the owner says.

## The problem, in the owner's words

A club's paid plan ends (Stripe gave up on a failing card, or they cancelled and changed their mind). The owner wants to
let them back in for a while, free, as a favour: platform admin › the club › **Give free time**. Today that half-works:
the club's people can sign in again, but **its public site stays off and its tournaments stay archived**. A plan
change brings everything back but has no end date, so it is the wrong tool for a favour.

## What the code does today (verified 2026-11-18 — re-read before building)

- **Cancellation** (in-app cancel, platform cancel / End now, Stripe ending the subscription) suspends the account
  (`billing_suspended_at` + reason), sets `is_public = false`, archives tournaments into `billing_retained_records`
  (with a 90-day `retention_until`), files an account record there, and writes a cancellation intent.
- **`restoreAfterReactivation(orgId, tournamentLimit)`** (`lib/billing-reactivation.ts`) undoes all four, idempotently.
  It runs from checkout (`app/api/billing/create-checkout/route.ts`), the Stripe webhook (`lib/billing-webhook-handler.ts`)
  and an operator plan change from cancelled to active/trialing (`lib/operator-plan-change.ts` ~275, the pattern to copy:
  restore failure → a warning, not a failed request).
- **Free time** (`lib/free-time.ts` `decideGive`, written by `lib/free-time-writes.ts` `giveFreeTime`) has three kinds:
  a whole plan (`plan_tier`), sections (`module_addon`) and a **billing status** (`subscription_status` = `active`,
  "the club reads as active while unpaid"). **Only the billing-status kind lifts a cancelled club's wall** — the door
  (`lib/entitlement-grants.ts` → `lib/free-time.ts` ~254) replaces the status only for that kind. A plan or sections grant
  on a cancelled club leaves it locked out. Grants **end by themselves**: nothing is scheduled; the end is compared with
  the moment of reading. Staff can also end one early, or "Put it back" (`free-time-writes.ts` ~200, ~265).
- **`giveFreeTime` never calls the restore.** So the club can sign in, but `is_public` is still false and the
  tournaments are still archived. (The public site reads the live status *and* `is_public` — `lib/public-club-access.ts`
  `isPublicClubSiteOpen`.)
- ⚠ **A second defect, same root:** the retention sweep (`lib/billing-retention.ts` `processBillingRetentionExpiry`,
  reached from `app/api/platform-admin/observability/sweep/route.ts`) selects the club's **raw** `subscription_status`,
  not the door's answer. A cancelled club on billing-status free time keeps counting down: it can be warned "your
  information will be deleted" and moved to pending purge **while the owner is helping it**. Confirm whether it skips on
  status at all.
- The Privacy Policy (`lib/legal-documents/privacy/2026-11-17.md` §9): when a paid plan ends, the organization's
  information is kept **90 days** so the club can come back, with a warning email, and after that "may be permanently
  deleted". Whatever this build does must leave that true.

## Why it is not one line

Calling the restore when free time is given is easy. But free time **ends silently**. If the give brings the site and
tournaments back and closes the retention records, then when the free time runs out the club is cancelled again with its
site still public, its tournaments live, and **no 90-day clock at all** — its data kept forever, and the public site up
for a club that is not paying. So the build has two halves: **on give**, and **on end**.

## Part 0 — confirm the design with the owner before code (plain language, product-owner voice)

Present this, then build what he confirms. **Recommended (A):**

1. **On give:** giving **billing-status** free time to a **cancelled** club runs `restoreAfterReactivation` (site back on,
   tournaments back up to the plan's limit, retention records and intents closed), exactly as an operator plan change
   does, with the same "restore failed" warning. Plan and sections grants are unchanged (they don't lift the wall).
   The give window says so in one plain line when the club is cancelled (e.g. that free time brings back its site and
   tournaments, and that when it ends the club is closed again) — `/marketing` signs the words off.
2. **On end:** when that free time stops (by date, ended early, or put back) and the club is still cancelled, the
   cancellation's effects come back with a **fresh 90-day window** from that day: suspended, site off, tournaments into
   retention, account record filed, intent written — reuse the existing cancellation code path, do not write a second one.
   - Ended early / put back: run it in that request.
   - Ended by date: nothing fires, so the daily sweep catches it — a club whose **effective** status (through the door)
     is cancelled but which is **not suspended** (`billing_suspended_at` null) is re-cancelled. Confirm on dev that no
     other legitimate state matches that test (a club cancelled before the A07 suspension stamp existed, a Coaches
     Portal workspace — exclude those explicitly).
   - ⚠ The sweep is a job that runs by itself. The owner asked for this fix, which covers changing it, but say so in the
     commit message and keep the sweep change in its own commit (AGENCY_RULES, shared-automation rule).
3. **The countdown pauses during free time:** the retention sweep reads the club through the door (`effectiveOrgFacts`),
   and skips warning or purging a club whose effective status is not cancelled. (Under A, a give closes the records
   anyway; this also protects a club given free time while the restore failed.)

**Alternative (B), lighter, if he prefers:** don't restore on give. The public site opens at read time when the effective
status is not cancelled and the site was off only because of the cancellation (`billing_suspended_at` set), and closes
again by itself when free time ends; tournaments stay archived (the club sees them as retained on Billing); the sweep
pauses as in point 3. Nothing to undo at the end. Trade-off: a tournament club gets its site back but not its tournaments.

Recommend A: it is what "bring them back as a favour" means, and every piece reuses code that already exists.

Also confirm with the owner: a cancelled club that is given **a plan** or **sections** as free time is still locked
out. Recommended: the window says so and points at the billing-status kind, rather than silently granting nothing.

## Part 1 — prove it on dev first

Before changing code, reproduce on dev with a throwaway club (never a demo club, never production): cancel it, give it
billing-status free time, and record what the club sees (sign-in, public site, a tournament, Billing). Then end the
free time early and record it again. Put the before-state in the commit message. (Probe scratch lives in `.probe/`;
sign in without a browser per the memory note "probe signs in without a browser".)

## Part 2 — build (after Part 0)

- Keep the pure decision (`decideGive`) pure; the restore and the re-cancel are side effects in the write path, after
  the audit row, like the operator plan change.
- Tests (`tests/unit/`, node:test — see `tests/unit/plan-billing-body.test.ts` for the style): the give on a cancelled
  club calls the restore; on an active club it does not; a plan or sections grant on a cancelled club does not; ending
  early re-applies the cancellation with a fresh 90 days; the sweep re-cancels a date-ended club and leaves a club with
  running billing-status free time alone; the sweep does not warn or purge during free time. Guard tests that already
  pin who may bypass the billing rail (`tests/unit/org-billing-access-guard.test.ts`) and who reads the stored plan
  (`tests/unit/plan-reader-door-guard.test.ts`) must stay green — the sweep moving to the door may need its entry.
- No migration is expected. If one turns out to be needed, stop and tell the owner (data dictionary + snapshots rule).

## Part 3 — close

- `npm run verify:changed`; `npm run typecheck` (this touches `lib/` billing modules) — run it when the owner says the
  PC is free; `npm run lint:focused -- <files>`.
- `/review` (high-risk tier: billing access + a scheduled job). `/legal`: the change keeps Privacy §9's 90 days true —
  confirm, or record the question. `/docs`: platform-admin help for Give free time, and the support runbook §4 (replace
  the "known gap" paragraph with what now happens). `/marketing`: the give window's one line.
- Board: the `club-tier` line in `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json` (it lists this under "remains") changes
  in the same commit as the work; record positive facts with an anchor.
- Hand back in product-owner voice: what the owner now sees when he gives free time to an ended club, what happens when
  it ends, and how to try it on dev.
