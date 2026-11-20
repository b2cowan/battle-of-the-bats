# Free time: the same rules for clubs and coaches — plan

**Owner rulings 2026-11-19** (given in the Free League and Founding removal Stage 2a session; recorded in
`FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md` §4 build record). PM brief: `FREE_TIME_SAME_RULES_PM_BRIEF.md`. Status: on the
board (`free-time-same-rules`), never here.

## 0. Why

Club free time and Coaches Portal free time are two features that grew apart:

| | Club free time | Coaches Portal free time |
|---|---|---|
| A super admin's limit | none, and "No end date" (owner ruling 2026-10-30) | 6 months, counted from the FIRST give; no "No end date" |
| Billing / Support | Billing 6 months from today | 90 days from the first give |
| Told before it ends | the billing page only (amber band, last 14 days) | the page, plus emails at 14 and 3 days |

Two rulings close the gaps:

1. **A super admin can give free time with no end date on BOTH** (owner: "super admin should be able to put no end date on
   both"). Coaches Portal free time gets the club rule for a super admin: no month limit (last day capped at 2099-12-31 like
   the club side) and a "No end date" tick, on the first give, a later give and a change of the end. Billing and Support keep
   their 90 days.
2. **Club free time gets the coach's ending reminders** (owner yes to ask A): an email to the club's owner(s) 14 days and 3
   days before the last free day, once each, as the portal job does. Not for a grant with no end date.

Why now: the three Founding holders were moved onto free time on 2026-11-19 (Stage 2a). The two clubs among them were
promised a summer reminder by today's Founding card; after Stage 2b nothing reminds them, and their free time ends
September 30, 2027. The coach's free time cannot be extended from the staff screens today (its 6 months count from the move).

## 1. Scope

- **Coach, no end date.** `lib/portal-free-time.ts` (`PORTAL_FREE_TIME_CAP` — super admin unlimited; `portalLastDayRefusal`;
  an `indefinite` input refused for every other role before the day check, as `INDEFINITE_REFUSAL` does for clubs),
  `lib/portal-free-time-give.ts` (first give, give again, change the end: an open end writes `expires_at` NULL on the grant AND
  `ends_at` NULL on the entitlement), the people-page Give / Change windows (the tick), the staff free-time list ("No end date",
  never "ending soon"), the Story words. **What an open-ended portal shows the coach:** like an open-ended club, no "free
  through" band (`portalCustomerFreeTime` returns null on a null end) and no reminder; check `portal-in-force` and the ended
  wall treat a null end as running. Check the reminder job skips it.
- **Club reminders.** A daily step (in the existing free-time daily job or beside it, decided at build) selecting running
  `plan_tier` / `module_addon` / `subscription_status` grants with an end date 14 and 3 days out; email the club's owner(s);
  once-only stamps (a column or a sent-email row — a schema change goes through the dictionary + snapshots); a new email kind;
  CASL review (`/legal`: a transactional notice about the account, as the portal one). Plan grants with no end date: no email.
- **Out of scope:** Billing/Support limits, the Founding code (Stage 2b of the removal plan).

## 2. Sequence

After Stage 2b of the Free League and Founding removal (2b edits the free-time band and the club record's free-time windows,
which this item also touches). One session; both parts. Done when: a super admin can give a coach free time with no end date
and change a coach's end past 6 months; a club with free time ending in 14 days gets one email and in 3 days another; a
no-end-date grant gets neither; `/legal` (the new email) and `/review` ran.

## 3. Open questions for the owner

None open. (The reminder's words are drafted at build, `/marketing` voice, and shown before the build is committed.)
