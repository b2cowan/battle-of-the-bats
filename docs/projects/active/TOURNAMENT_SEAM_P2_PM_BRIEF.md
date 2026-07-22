# PM Brief — Tournament Seam Fixes, Phase 2 ("Re-point the broken doors")

**Status:** In progress (owner decisions 2026-07-22) · **Plan:** `TOURNAMENT_SEAM_P2_PLAN.md` · **Source review:** `TOURNAMENT_SEAM_UX_REVIEW.md` · **Phase 1:** committed on dev

## What this phase is

Three coach-side seam repairs from the same review that drove Phase 1. In each, the *correct* screen or data already exists — the coach's "Schedule" and "Fees" doors, and the public-page coach recognition, just point at the wrong thing. No new product surfaces; we reconnect existing ones.

## What users see and do differently

1. **Fees tell the truth (free coaches).** The team Overview "Fees" area no longer shows a misleading "$0 / all clear" when a tournament entry fee is owed. It shows **both**, clearly labeled: the **tournament entry fee** you owe the organizer (highlighted when outstanding) and your own self-entered **player fees**. *Today: the tile only reads your self-entered ledger, so a real unpaid entry fee is invisible.* **(Built.)**

2. **Schedule stops dead-ending.** The coach "Schedule" tab folds your team's **real, live tournament games** (auto-updating, with scores on game day) into the calendar alongside your hand-entered practices — instead of a self-typed calendar with no connection to the actual event. *Today: the tab shows only what you typed, with no link to the tournament schedule two taps away.* **(Owner chose the fuller "merge" option → needs a mockup before build.)**

3. **Paid-portal coaches recognized on the public site.** A coach who runs their team through the paid portal is recognized as a coach on that tournament's public pages (the account chip → their coach view), not just coaches who came through the free "claim your team" flow. *Today: only claimed-via-free coaches are detected.* **(See tradeoff below.)**

## Why it matters

These are the next tier of the review's confirmed seam breaks after Phase 1: a money surface that hides real amounts owed, a primary navigation tab that dead-ends, and a promise ("we know you're a coach") the public page doesn't keep for paying customers.

## Tradeoffs / decisions

- **Coach recognition — owner chose the full data project (2026-07-22).** Baseline coverage (match the coach's account email to the registration contact email) ships with no database change and catches the common cases. Guaranteeing *every* paid coach — including teams the org registered under a generic office email — is a **separate sub-project**: it needs a new way for org staff to link a tournament registration to a rep team (that association doesn't exist anywhere today), a database change to store it, and a best-effort backfill. It's sequenced **after** the Fees and Schedule items and gated on a schema + flow design pass. One open product question to settle there: exactly where/how org staff attaches a registration to a rep team.
- **Schedule "merge" needs a mockup.** You chose folding live games into the calendar (vs. a simple link), which changes the page's core content — so it gets an approval mockup first, matching how Phase 1 ran.

## Who's affected
- **Free coaches** — the Fees tile.
- **All coaches (free + paid)** — the Schedule tab.
- **Paid-portal (rep-team) coaches** — public-page recognition.

## Success criteria
1. A free team owing a tournament entry fee sees that amount on the Overview Fees tile (no false $0); the number matches the tournament record's fee strip.
2. From the coach Schedule tab, the team's real tournament games appear alongside self-entered events (per the approved mockup).
3. A paid-portal coach whose email is on the registration is recognized on the tournament's public page and can open their coach view.
