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

Built straight after Stage 2b of the Free League and Founding removal (2b edits the free-time band and the club record's
free-time windows, which this item also touches), and **released together with 2b** (owner 2026-11-19, agreeing with
`/legal`'s condition: 2b removes the only lines that promise the two former Founding clubs a reminder, so 2b does not reach
production without the club reminders). One session; both parts. Done when: a super admin can give a coach free time with no end date
and change a coach's end past 6 months; a club with free time ending in 14 days gets one email and in 3 days another; a
no-end-date grant gets neither; `/legal` (the new email) and `/review` ran.

## 3. Open questions for the owner

None open. (The reminder's words are drafted at build, `/marketing` voice, and shown before the build is committed.)

## 4. Build record

**Built 2026-11-20** (owner go "Build it", with both calls as recommended: call 1, a coach with no end date sees a dateless
line on Plan & billing; call 2, the club email covers all three kinds).

**Part 1 · coach, no end date.**
- The rule: `PORTAL_FREE_TIME_CAP.super_admin` is null (no limit, last day capped at 2099-12-31); the role check is
  `canGivePortalFreeTime` (never a limit's words, which would have taken the door from a Super admin); `portalEndOf` takes
  `indefinite: true` for a Super admin only, with the club's refusal; `portalChangeDecision` replaces `portalChangeRefusal`.
- The coach: `portalCustomerFreeTime` reads a running grant with no end as `{ state: 'open' }`: the band "Premium Coaches
  Portal is free from FieldLogicHQ.", "FieldLogicHQ gave you Premium, with no end date set. Nothing is charged.", card
  "Free from FieldLogicHQ · no end date", no countdown, no reminder; the cancel refusal says "with no end date set".
- Twenty-odd null-end defects fixed (census by a helper, critical ones read in the code):
  - **the coach's own Cancel went through on an open-ended portal** (archive + retention clock, T15) — `runningPortalFreeTime`
    now counts a no-end grant on a marked portal;
  - End it now left a no-end entitlement running (`.or(ends_at.is.null, ends_at.gt.now)`);
  - Keep Premium left a no-end grant running, and its repair marker read the entitlement's end (now `source`);
  - change-end compare-and-set, the entitlement follow and the put-back match a null with `is null`;
  - the half-made-portal repair no longer writes the string "null";
  - Clubs list and Find no longer call an open-ended portal "Free time ended";
  - the club change window (PATCH) now refuses a portal, as its DELETE did (it would move the grant without the entitlement);
  - a team moved into a club ends the old portal's free time with a Story row written first (`endFreeTimeOnMove`).
- Windows: the club's "No end date: it stays until someone ends it" tick on Give and Change the end date (Super admin only).

**Part 2 · club reminders.** `lib/club-free-time-reminders.ts` (+ `-words.ts`), a step in the free-time daily job (no new
cron; production's job is migration 408), migration **512** (`org_overrides.ending_reminded_14_for` / `_3_for`, applied to
dev 2026-11-20; **production before the promote**), email kind `club_free_time_ending`. Every active owner; no email when
nothing changes at the end, for a Coaches Portal, a suspended club or a no-end grant. The staff windows now say the owner is
emailed where it is true.

**Reviews.** `/legal` 2026-11-20: no must-fix; not a CEM on its face; the Stage 2b condition is met; applied: the ended-club
button reads "Open Plan & billing", the coach line "no end date set" (`docs/agents/legal/CASL_FREE_TIME_ENDING_REMINDERS.md`).
`/review`: see the commit. Owner question left by `/legal`: should ending free time early email the coach or club?

**Release:** with Stage 2b only; migration 512 on production first.
