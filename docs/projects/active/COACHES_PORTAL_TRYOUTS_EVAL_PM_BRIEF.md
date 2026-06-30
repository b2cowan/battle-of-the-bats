# Coaches Portal — Tryouts & Evaluation — PM Brief

**Created:** 2026-06-29
**Status:** Active, planned (not started)
**Full plan:** `COACHES_PORTAL_TRYOUTS_EVAL_PLAN.md`
**Priority:** High — biggest functional gap in the Premium Coaches Portal, and the most-requested rep-coach job-to-be-done.

## What This Is

Today a rep coach can register a team for tryouts and an admin can accept players onto the roster — but there is **no tool for actually running tryout day or evaluating players**. Coaches do it on a paper clipboard and a spreadsheet. This project gives the Premium Coaches Portal a real **tryout & evaluation suite**, bundled into the existing per-team subscription instead of charged per-player like every competitor.

It's the first two phases of a larger 5-phase Coaches Portal value roadmap (see "The full roadmap" below).

## Why It Matters

- **It's the gap.** Rep coaches expect to evaluate players; we don't help them at all today.
- **Pricing wedge.** Dedicated tryout tools charge $4–$10 per player per year, or ~$799/year standalone. A 60-player club pays $240–$600 elsewhere — and $0 incremental with us.
- **Canadian-native moat.** Tryout-window rules, PIPEDA/CASL consent, and provincial evaluation norms are cheap for us and structurally invisible to US-first competitors. Provincial association reps are the people who recommend platforms to member clubs.
- **It closes a live compliance gap.** Our public tryout registration form already collects kids' birthdates, guardian contacts, and medical notes with no consent capture — a real PIPEDA exposure we should fix regardless.

## Customer Impact — what a coach sees and does differently

**Before tryout day:** builds a digital scorecard (their own skill categories, weights), and gets a friendly warning if their date falls outside the provincial tryout window.

**On tryout day:** opens a phone, sees the candidate list, checks players in with auto-assigned bib numbers, adds walk-ups in seconds. Co-coaches each open a link (no account needed) and score players one at a time — seeing only bib numbers, never names, so evaluation is fair and defensible. The head coach watches composite scores update live, with a nudge if one evaluator is scoring much harder or easier than the rest. A printable paper backup is one tap away for spotty cell coverage.

**Deciding the roster:** candidates sort by weighted score; the coach drags each into Offer / Waitlist / Not-this-season — a documented, data-backed decision instead of memory and a whiteboard. Accepting a player lands them on the roster with fees set in one step. Branded offer and release emails go out, with the waitlist auto-promoting when an offer lapses.

**And before any of that ships:** families giving their child's info now tick clear consent boxes, and the org gets a downloadable consent record it can stand behind.

There's also a standalone quick win in Phase 1 — a **pre-game attendance pulse**: two hours before a game, every player gets a one-tap "you coming?" and the coach sees a live headcount instead of chasing texts.

## Role & Access Differences

| User | What they get |
| --- | --- |
| Premium head coach | Full tryout suite: rubric, check-in, blind scoring, ranking, accept-to-roster, offer/release emails. |
| Co-coach / evaluator | A no-account link to score assigned players on their phone (bib numbers only in blind mode). No portal access, no PII. |
| Tryout candidate family | Consent-gated registration; branded offer/decline; no access to scores or rankings. |
| Org admin (club-run teams) | Existing admin tryout management continues; owns the consent log + retention. |
| Free / Basic coach | Not included (Premium feature — gating to be ratified before build). |

## Tradeoffs Made

- **Blind evaluation is the default** (a deliberate fairness + differentiation stance), with a one-way, audited "reveal names."
- **We dropped a "coachability flag"** idea that would highlight a low attitude score in the ranking view — it's a parent-dispute and documentation liability. Private notes stay; a flagged character score does not.
- **Day-of check-in ships before the rubric/scoring engine** so coaches get a usable tool fast, even though the rubric is the long-term foundation.
- **Per-player metrics that need live play-by-play are out of scope** by owner decision — this suite is evaluation and roster, not in-game scorekeeping.

## Priority & Timing

High, but **seasonal**: the provincial tryout window runs ~July 1 → second Sunday of September, so this realistically targets the 2026 fall / 2027 spring cycles. The consent gate and attendance pulse (Phase 1) are valuable immediately and independent of tryout season.

## Success Criteria

- A coach can run an entire tryout — check-in to roster decision — on a phone, with no paper.
- Evaluators score without an account and without seeing names; the composite is fair and the audit trail is defensible.
- An accepted candidate becomes a roster player with fees set in one action.
- Every family that registers has a timestamped consent record the org can produce on request.
- Coaches describe it as "the tool I wish I'd had" — and tell other coaches in the league.

---

## The full roadmap (context — this brief owns Phases 1–2)

A consolidated, owner-filtered view. Phases 3–5 get their own plan + brief when they come up.

1. **Phase 1 — Compliance + quick win:** consent gate · pre-game attendance pulse. *(this project)*
2. **Phase 2 — Tryout & Evaluation:** check-in/bib/walk-up · blind scoring · provincial date-check · rubric · multi-evaluator scoring · ranked decision board · accept-to-roster+fees · offer/release emails. *(this project)*
3. **Phase 3 — Roster depth & development:** Individual Development Plans · season playing-time heat map · returning-player history · manual measurables · depth chart.
4. **Phase 4 — Engagement & retention:** athlete/parent season portfolio · habit-streak tracker · practice-plan builder · team W-L-T dashboard.
5. **Phase 5 — Pitcher safety & arm care:** pitch-count + rest tracking (OBA compliance) · arm-care readiness check-in · (optional) pitch-arsenal charting.

**Parked (future, by owner direction):** cross-platform stat aggregation — only via coach-initiated upload of their own exported data (no vendor contracts); recruiting/exposure profiles (PIPEDA-sensitive; needs legal design).

**Excluded:** live play-by-play analytics; public minor profiles / view-tracking / child leaderboards; AI swing/pitch video analysis, auto-highlights, sensor metrics (hardware / out of reach).
