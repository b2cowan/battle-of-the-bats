# Player Development — PM Brief

> Companion to [COACHES_PORTAL_PLAYER_DEVELOPMENT_PLAN.md](COACHES_PORTAL_PLAYER_DEVELOPMENT_PLAN.md) · ✅ **COMPLETE ON DEV + ARCHIVED 2026-07-17** — all four slices (3A `ae48ead6` · 3B `8bc62990` · 3C `22f1cb41` · 3D `c7a6806f`) + both pre-ship gates (D2 privacy sign-off + D6 marketing copy, `f7efdd36`) committed. Tail = prod promotion of migs 189–192 (via /release) + the D3 retention follow-up. Originally PLANNED rev 2, 2026-07-17 (Evaluation Sessions + Development hub added at owner direction).
> Mockups (round 2, accepted — binding visual spec): https://claude.ai/code/artifact/01f4f7a8-410b-4b68-b521-f9888a9d9d8e

## What coaches get

Today the Premium portal remembers a coach's **team** — schedule, lineups, money, results. This phase makes it remember each **player**, and fits how coaches actually work: evaluations happen **all at once at practice**, not one profile page at a time.

**A new Development hub** (its own spot in the Squad menu) is the team-wide door:

- **Evaluation Sessions** — the coach taps "New session," picks which tests they're running tonight (60-yd sprint, home-to-first, throw velocity — from a list the team defines once), and works down the whole roster in a tap-friendly grid, phone-first. Autosaves as they go, shows "9 of 14 entered," skips absent players honestly. The session is saved as a reviewable artifact: "July 17 — 14 players, 3 tests." Coaches who ran our tryout day already know this interaction — *the tryout is just the first evaluation session of the year.* Two or three sessions a season is exactly what makes the trend lines real.
- **A team development board** — every player's active focus areas, latest numbers, and last-evaluated date at a glance, in roster order (deliberately never sorted best-to-worst).
- **A reserved spot for practice plans** — visible but not built; the next roadmap phase fills this room instead of inventing new navigation later.

**The player's profile page in the roster keeps everything** (owner decision): the Development card lives there alongside attendance, awards, and dues — the roster player page is the single home for all of a player's summary data. Focus areas with a simple status (Working on it / Achieved / Parked — no grades), that player's measurable history with honest trend lines, context quoted from the depth chart and playing-time reports, and a printable one-page summary to hand a family at pickup. The hub and the profile card are two doors to the same data — enter it in a session, read it on the profile, or vice versa.

**And it connects the years:** next season's tryout list quietly flags "Possible returning player — verify" (name, birth date, guardian side by side; the coach decides; one tap to undo a wrong link). Confirmed links unlock a previous-seasons archive — a scrapbook, never "improved 12%" scorekeeping — and at rollover the coach gets an explicit offer to carry notes forward instead of silently losing them. **Insights gains a full "Development" tile** (owner decision D4) — development takes equal billing with Results, Playing time, Attendance, Money, and Awards — opening a dedicated report: one row per player showing active focus areas, last evaluation, and whether their history is linked, in roster order. The report page is deliberately built as the future home for deeper development analytics (always player-vs-self, never player-vs-player).

## Why it matters

- This is the retention feature: a coach whose player histories and evaluation sessions live here doesn't churn after one season, and next January's tryout — where the app already knows the returning kids — is a moment no competitor offers.
- It completes the arc we already shipped: tryouts → roster → lineups → **development** → next tryout.
- It quietly answers the #1 reason a parent would want an app — "how is my kid doing?" — via a coach-printed page, without opening the parent-users decision.

## Guardrails (locked into the design)

Supportive, never ranking — the session grid and team board stay in roster order with no sort-by-result; no leaderboards anywhere. Player-vs-self only. Coach-only visibility; assistants excluded by default. Privacy-minimal record linking (pointers, never copied personal data). No vendor stat imports, no pitch-count logs (reserved for the arm-care phase).

## Decisions

**All six DECIDED 2026-07-17.** At the recommendations: head-coach-only writes (D1) · privacy sign-off gates 3A (D2) · retention/purge spun out as its own project (D3) · returning-player check on both tryouts and manual roster adds (D5) · marketing tone pass gates ship (D6). **D4 decided at Option B** after reviewing the side-by-side mockups: full Insights tile + dedicated report — owner rationale: development is a growth pillar and should deliver robust coach analytics; the report page is architected to grow into that.

## Sequencing & success

Four independently shippable slices: **3A** the per-player Development card → **3B** the hub + Evaluation Sessions + team board → **3C** returning-player verify → **3D** history, rollover carry-forward, coverage, print. Success looks like: a coach runs a full evaluation session at practice on their phone without instruction, logs the whole roster in under ten minutes, zero "my notes disappeared" reports at rollover, and at least one coach telling us the returning-player prompt saved them a tryout-day mix-up.
