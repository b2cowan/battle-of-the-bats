# Program — Tournament Engine (brackets, playoffs, standings, schedule, multi-sport)

> **Consolidated 2026-07-28.** Replaces 19 tournament-engine plan/brief files (§5).
> **Scope:** outstanding work only. Shipped work appears as one-line reference in §4.

---

## 0. Ground truth (verified 2026-07-28)

`dev` is 8 commits ahead of `origin/master`, all from 07-27/28. **Every engine build recorded before
2026-07-27 is live in production**, including the ones whose plan headers still read "BUILT on dev,
awaiting browser verification" (manual brackets, tiered auto-split, inline tiered editing, coin-toss
tie-breaker, run-diff cap, public bracket venues, unified My Team card, schedule/event rework).

Two things here are genuinely unstarted, and one is deliberately paused.

---

## 1. Outstanding work

### 1.1 Standings Page Remodel — NOT STARTED
The largest unbuilt item in this program, and the most customer-visible. Scope as planned:
- **View toggle** — Standard / Race to Playoffs.
- **Podium cards + a cutoff line** so a fan can see who's in and who's out at a glance.
- **Follow-bar redesign.**
- **Live playoff bracket** — visual tree on desktop, rounds list on mobile.
- **The bracket flips above the standings** once pool play completes.

No migration. Pure front-end. Worth noting the standings read path was just optimised
(`c15f477e`, "getStandings read the whole platform on every call"), so the data layer is in good shape
for this.

### 1.2 Multi-Sport — PAUSED by owner, with a live latent defect
Phases 0 and 1 (the silent anchor: sport stored and threaded end-to-end through creation, cloning and
pre-fill) are **deployed to production**. Phase 2 — the organizer-facing **sport picker** — was
deliberately held so organizers never see "choose your sport" before the sport-aware wording exists.
Phases 2–4 are **not started and paused** (owner: softball first).

Two things must not be lost while paused:
- **⚠ Build guardrail (owner directive 2026-06-24):** while building softball/baseball features, keep
  new logic **sport-neutral** — route score/period/label vocabulary and rules through the `lib/sports.ts`
  Sport Pack. Do not hard-code innings.
- **⚠ Latent casing mismatch:** coach signup stores a **Title-case** sport while admin stores
  **lowercase** ids. Full reconciliation (lowercase everywhere + backfill) was deferred. This is a
  quiet data-integrity bug that gets more expensive the longer multi-sport stays paused.

Also carried: the **sport-neutrality sweep of the lineup surfaces** (see `PROGRAM_COACH_PORTAL.md` §1.6)
is a hard prerequisite before enabling any non-diamond sport.

### 1.3 Bracket Builder — free vs paid UX roadmap (P0s not built)
A polish roadmap for the two tier experiences. Phase-1 P0s, none built:
- **"Edit Bracket" reopen-loaded canvas** — today you can't reopen a saved bracket into the builder.
- **Optional venue / TBD** (structure-first bracket building).
- **Badge scheduling-order violations** in the read-only bracket view.
- **Honest tier labels** — "Build Bracket Manually" vs "Auto-Generate (Tournament Plus)".
- **Live free Bracket-Health panel.**

Six open design questions block the start — see §2.

### 1.4 Schedule & Event experience — Tier 2+ residue
Tier 1 (per-type grouped event form, slimmer detail panel, game-day fields, smart location/Maps,
recurrence + series edit, W-L-T filter, attendance) is complete and live. The plan flags a deferred
control-model choice on one Tier-2 surface — re-read before the next schedule touch rather than
carrying it as an open project.

### 1.5 Inline tiered bracket editing — Phase 2 close-out
Phases 0, 1 and 3 are deployed to production. Phase 2 (manual "split into tiers" + loading an existing
multi-bracket division as separate titled tier sections) and the tier-split bracket PDF are built and
shipped. **Remaining: owner walkthrough, then close.**

---

## 2. Decisions required from you

All six gate the Bracket Builder roadmap (§1.3):

| # | Decision | Recommendation |
|---|----------|----------------|
| TE-1 | **Build the "Edit Bracket" reopen-loaded canvas now**, or is per-game edit + Clear/rebuild enough for v1? | Build it. "I can't reopen what I built" is the kind of gap that reads as broken, not minimal. |
| TE-2 | **Venue/date optionality on playoff games** — fully optional, or optional with a soft "unscheduled" warning? | Soft warning. Keeps structure-first building while protecting data quality. |
| TE-3 | **Upsell aggressiveness** — surface the auto-generate upsell at every friction point (Clear, 4+ games), or only at major transitions? | Major transitions only. |
| TE-4 | **Auto-generated brackets (Plus)** — immediately editable on the canvas, or require an explicit "Edit"? | Explicit Edit — protects against accidental changes to a generated bracket. |
| TE-5 | **Free Bracket-Health depth** — purely structural, or tease the Plus rest/feasibility metrics read-only as an upsell? | Structural only. Teasing metrics you then withhold reads as bait. |
| TE-6 | **Mobile bracket dropdowns** — native `<select>` (simpler, better a11y) or tune dnd-kit touch sensors so drag + pan + dropdowns coexist? | Native `<select>`. |
| TE-7 | **Is Multi-Sport still paused?** It's been paused since June. The casing defect and the sport-neutrality debt both accrue while it sits. | Stay paused on the *feature*, but **fix the casing mismatch now** — it's cheap today and a backfill later. |
| TE-8 | **Standings Remodel priority.** It's the biggest unbuilt fan-facing item in the platform. | Schedule it — fan-facing polish is what makes an org's public site worth having. |

---

## 3. Verification debt (replaces ~8 stale "awaiting browser verification" markers)

Manual brackets (free) · tiered auto-split (Plus) · inline tiered editing Phase 2 · coin-toss
tie-breaker + run-diff cap · public bracket venues/clickable cards/standings parity · unified My Team
card · schedule & event rework Tier 1 · playoff bracket builder canvas. All live in production for
4–7 weeks with no reported defect. Close with one owner pass, not eight.

---

## 4. Shipped — reference only

- **Manual playoff brackets (free) + tiered auto-split (Plus)** — free tier builds brackets by seed in all formats with manual scheduling; the auto-schedule optimizer stays Plus. `crossover:'tiers'` splits one round robin into N tiered brackets.
- **Playoff Bracket Builder canvas** — seed a first round (top-N 1v8/2v7) or start empty, then add rounds and matchups by hand with single-use Seed/Winner/Loser dropdowns and live links.
- **Inline tiered bracket editing** — the inline editor preserves each game's bracket id and tier name on save; public and admin diagrams split tiers into titled sections; bracket PDF prints each tier on its own page.
- **Tie-breakers** — a 5th "Coin Toss" tie-breaker (organizer records the winner; drives standings + playoff seeding) plus an optional per-game run-differential cap (caps the RD column only; RF/RA stay real, per-division overridable). Tie-breaker list is drag-and-drop with add/remove.
- **Multi-Sport Phases 0–1** — the shared sport foundation, four scattered sport dropdowns consolidated onto one list, sport stored and threaded through clone and pre-fill.
- **Public bracket** — venues on the meta line, tappable cards through to game detail, standings bracket split by tier/pool to match the schedule bracket.
- **Unified "My Team" card** — one shared followed-team card on both Standings and Schedule, mobile and desktop, with a labelled NEXT UP / LIVE / FINAL block.
- **Schedule & Event rework Tier 1** — per-type grouped event form, slimmer detail panel, game-day fields, smart location + Maps, recurrence and series edit, W-L-T filter, attendance.

---

## 5. Source files consolidated (archive candidates)

`PLAYOFF_BRACKET_BUILDER_UX_PLAN.md` · `PLAYOFF_BRACKET_BUILDER_PM_BRIEF.md` ·
`BRACKET_BUILDER_TIER_UX_PLAN.md` · `BRACKET_BUILDER_TIER_UX_PM_BRIEF.md` ·
`INLINE_TIERED_BRACKET_EDITING_PLAN.md` · `INLINE_TIERED_BRACKET_EDITING_PM_BRIEF.md` ·
`PLAYOFF_MANUAL_AND_TIERS_PLAN.md` · `PLAYOFF_MANUAL_AND_TIERS_PM_BRIEF.md` ·
`PLAYOFF_TIEBREAKER_COINTOSS_RUNDIFF_PLAN.md` · `PLAYOFF_TIEBREAKER_COINTOSS_RUNDIFF_PM_BRIEF.md` ·
`STANDINGS_REMODEL_PLAN.md` · `STANDINGS_REMODEL_PM_BRIEF.md` · `MULTISPORT_TOURNAMENTS_PLAN.md` ·
`MULTISPORT_TOURNAMENTS_PM_BRIEF.md` · `MULTISPORT_TOURNAMENTS_PHASE1_PM_BRIEF.md` ·
`MULTISPORT_TOURNAMENTS_PHASE2_PM_BRIEF.md` · `PUBLIC_BRACKET_VENUE_CLICKABLE_PLAN.md` ·
`PUBLIC_BRACKET_VENUE_CLICKABLE_PM_BRIEF.md` · `MY_TEAM_CARD_UNIFY_PLAN.md` ·
`MY_TEAM_CARD_UNIFY_PM_BRIEF.md` · `SCHEDULE_EVENT_UX_PLAN.md` · `SCHEDULE_EVENT_UX_PM_BRIEF.md`

> **Keep active:** `STANDINGS_REMODEL_PLAN.md` + its PM brief — that project is unstarted and the plan
> is the build spec, not a historical record.
