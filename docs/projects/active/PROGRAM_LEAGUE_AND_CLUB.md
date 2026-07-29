# Program — League & Club segments

> **Consolidated 2026-07-28.** Replaces 7 league/club plan-brief files (§5).
> **Scope:** outstanding work only. Shipped work appears as one-line reference in §4.
> **Related current doc:** `FREE_TIER_STRATEGY_PLAN.md` (updated 2026-07-27) stays as its own file —
> it owns the free-floor strategy; this doc owns the League/Club *build and launch*.

---

## 0. Ground truth (verified 2026-07-28)

**League Starter is built and prod-DB-ready but has never launched.** Phases 6.0–6.7 are complete,
migration 125 is applied to production, and the whole thing sits behind a feature flag as an unlisted
beta. What's left is **Phase 9 — the launch itself**: flip the flag and complete the
League Starter → League branding rename.

This is the largest piece of finished, paid-for work in the repository that customers cannot see.

---

## 1. Outstanding work

### 1.1 League Starter Phase 9 — launch ⚠ has a blocker
The launch itself is small: flip `LEAGUE_STARTER_BETA`, complete the branding rename
(free house-league floor = "League"; the paid $89 tier = "League Plus", mirroring Tournament /
Tournament Plus — internal keys unchanged), and open the entry page.

**⚠ Blocker — `/api/league/create` has no one-org guard.** Today it is held shut only by the flag being
off in production (it is **on** in dev). Flipping the flag without the guard opens unrestricted org
creation. See `PROGRAM_ACCOUNTS_AND_ACCESS.md` §AA-1. **Do not launch before this is fixed.**

Smaller open items carried in the plan:
- Founding-comp parity on league create (confirmed harmless by red-team; lean: mirror `/api/org/create`).
- Fallback org-home for a league-only org — accept the existing simplified fallback, or build a minimal league-focused landing.
- Beta-flag scope — one shared `NEXT_PUBLIC_*` read in both places, or separate client/server flags.
- Confirm `module_public_site` stays off so the branded org home isn't served.

### 1.2 League + Club Early-Access Readiness — SCOPED, NOT STARTED
Defines the go/no-go "ready to open" checklist and the hardening scope gating the managed early-access
cohort (~Aug 2026 as originally planned — that date has now passed, see §2). The checklist includes
"no vanishing-season / schedule-honesty blockers outstanding", which depends on §1.3.

### 1.3 House-League In-Season Trust — SCOPED, NOT STARTED
The in-season half of the league product (Free Tier Strategy owns *acquisition*; this owns *keeping
them*). Six threads:
- **Vanishing-season Blocker** — the highest-severity item.
- **Schedule honesty** — location, cancelled, postponed states.
- **Comms spine** — ⚠ Waitlist/Pending audiences **silently email nobody** and report a green "0 delivered" success; provider failures are counted as sent; no guardian dedupe; no reply path; no rainout notify.
- **Parent payment loop.**
- **A real schedule generator.**
- **Email-injection fix (flagged fix-now).**

> The comms-spine and email-injection items are correctness/security defects sitting in a shipped
> module. They are not "league launch polish" — they are live bugs.

### 1.4 Admin IA multi-module navigation
The tournament-first skew that makes the product feel wrong to a league or club org. Scoped, not
started, and best folded in here rather than run standalone — see
`PROGRAM_ORGANIZER_EXPERIENCE.md` §1.1 and decision **OE-6**.

---

## 2. Decisions required from you

| # | Decision | Recommendation |
|---|----------|----------------|
| LC-1 | **⚠ Fix the `/api/league/create` one-org guard before flipping the League flag?** | Yes — blocking, non-negotiable. |
| LC-2 | **The ~Aug 2026 early-access cohort date has passed with the readiness checklist unstarted. Re-commit to a date, or shelve the managed cohort?** | Re-commit to a date. League Starter being built-but-invisible is the most expensive state it can be in. |
| LC-3 | **Do League and Club open at the same time, or League first?** League has fewer dependencies. | League first, staggered — don't let Club repackaging hold League. |
| LC-4 | **How is the founding-season comp represented for cohort orgs** — the existing comp/override path, or something new? → routes to `/billing`. | Existing comp/override path. |
| LC-5 | **Cohort selection criteria + outreach** → routes to `/marketing`, coordinated with the mid-size beachhead focus. | Pick 3–5 named orgs you can call, not an open signup. |
| LC-6 | **House-League In-Season Trust — split the live defects out and fix now?** The comms-spine "0 delivered" bug and the email-injection issue don't belong in a launch-readiness project. | Yes. Pull those two out as an immediate fix; leave the rest as the in-season project. |
| LC-7 | **Fallback org-home for a league-only org** — accept the existing simplified fallback, or build a minimal league landing? | Accept the fallback for launch. |

---

## 3. Shipped — reference only

- **Free League Starter (Phases 6.0–6.7)** — league creation wizard with caps (1 active season / 1 division / 8 teams), public league season pages, abuse controls (per-account, per-IP and global rate limits on league creation), instrumentation on the existing platform-events store, migration 125 applied to production. Browser-QA'd by the owner 2026-06-13.
- **Free-floor entitlement model** — a persistent `free_floor` field on the org contributing module entitlements, rather than a one-off flag.
- **Branding rename** — "League Starter"/"League" → "League"/"League Plus" executed across product copy; internal keys unchanged.

---

## 4. Source files consolidated (archive candidates)

`FREE_TIER_LEAGUE_STARTER_PLAN.md` · `FREE_TIER_LEAGUE_STARTER_PM_BRIEF.md` ·
`LEAGUE_CLUB_EARLY_ACCESS_READINESS_PLAN.md` · `LEAGUE_CLUB_EARLY_ACCESS_READINESS_PM_BRIEF.md` ·
`HOUSE_LEAGUE_INSEASON_TRUST_PLAN.md` · `HOUSE_LEAGUE_INSEASON_TRUST_PM_BRIEF.md` ·
`FREE_TIER_STRATEGY_PM_BRIEF.md` (superseded — the current strategy doc is `FREE_TIER_STRATEGY_PLAN.md`)

> **Keep active:** `HOUSE_LEAGUE_INSEASON_TRUST_PLAN.md` — unstarted, and it carries the itemised
> defect list (J3-058/059/060 etc.) that the fix work will need.
