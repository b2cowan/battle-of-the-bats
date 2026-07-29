# Active Projects — Index

> **Created 2026-07-28** as part of a consolidation sweep. `docs/projects/active/` had grown to 175
> files; 157 of them hadn't been touched in over two days and most recorded work that has since
> shipped to production. This index is the map.

---

## 1. How this folder is organised now

**Three kinds of file live here:**

| Kind | What it is | How many |
|------|-----------|----------|
| **In-flight projects** | Touched in the last two days; actively being built | 12 |
| **Program docs** (`PROGRAM_*.md`) + this index | Consolidated backlogs — outstanding work only, grouped by domain | 12 |
| **Retained specs** | Individual plans for unstarted work whose plan *is* the build spec | 8 |
| **Archive candidates** | Superseded by a program doc; ready to move | 143 |

**Build prompts are gone.** All 12 were archived 2026-07-28 by owner instruction — a build prompt is
single-use, and every one of them had been executed except the Flip P4 prompt, whose full scope was
lifted into `PROGRAM_PLATFORM_SURFACES.md` §1.1 before it moved. **Do not write new prompts into
`active/`;** they belong to the chat that runs them and should be archived on completion.

---

## 2. In-flight (do not touch in a consolidation sweep)

| Project | State |
|---------|-------|
| `COACH_PORTAL_LAUNCH_BATCH1_PLAN.md` | Built on dev; remaining = owner phone QA → commit |
| `COACH_PORTAL_LAUNCH_BATCH2_PLAN.md` | Built on dev; remaining = dev restart → phone QA → `/simplify` → `/review` → commit |
| `FREE_COACH_PORTAL_EXPERIENCE_PLAN.md` | All phases built; B2.3 ships migration 205 — **apply to prod before promoting** |
| `FACILITATED_PAYMENTS_SCOPING_PLAN.md` | Core decisions ratified; open = counsel session, tax display, intl-card policy |
| `FACILITATED_PAYMENTS_COUNSEL_BRIEF.md` | Ready for the counsel session |
| `CODEBASE_CLEANUP_ANALYSIS.md` | T0–T3 executed; T4–T5 open |
| `FREE_TIER_STRATEGY_PLAN.md` | Current free-floor strategy |
| `DATE_CORRECTNESS_DEBT.md` | Current; guardrail at zero |

Plus the associated PM briefs. The coach-portal loose ends (dead admin animations, the
platform-wide standings read, the B2.1 bar placement, the docs archive sweep) were **all four
completed** on 2026-07-28, so that prompt was archived with the rest.

---

## 3. The 11 program docs

| Doc | Covers | Biggest open item |
|-----|--------|-------------------|
| `PROGRAM_COACH_PORTAL.md` | Free + premium coaches portal (35 source files) | Readiness P0 #1 season-end lockout, #2 tournament lineup tools |
| `PROGRAM_COACH_CHAT.md` | Chat engine + 4 surfaces (19 files) | Projects 2–4 never started; **is this program still wanted?** |
| `PROGRAM_HELP_AND_ONBOARDING.md` | Help system, in-context help, onboarding (13 files) | Cross-device dismissals need a server column |
| `PROGRAM_BILLING_AND_ENTITLEMENTS.md` | Stripe, plans, grants, retention (17 files) | **Stripe Phase G** + the January 2027 conversion concentration |
| `PROGRAM_TOURNAMENT_ENGINE.md` | Brackets, playoffs, standings, schedule, multi-sport (22 files) | **Standings Remodel — not started** |
| `PROGRAM_ORGANIZER_EXPERIENCE.md` | Org-admin dashboard, admin IA, roles (14 files) | Admin IA multi-module nav — the League/Club skew |
| `PROGRAM_ACCOUNTS_AND_ACCESS.md` | Identity, invites, follows (9 files) | **`/api/league/create` has no one-org guard** |
| `PROGRAM_LEAGUE_AND_CLUB.md` | League Starter launch, early access, in-season trust (7 files) | Phase 9 launch — blocked by the guard above |
| `PROGRAM_PLATFORM_ADMIN_CONSOLE.md` | Operator console QA (1 large file) | No per-org team-cap control |
| `PROGRAM_TECH_DEBT_AND_QA.md` | Cleanup tranches, token debt, QA/UAT (8 files) | Inline-TSX colour sweep (52 defects) |
| `PROGRAM_PLATFORM_SURFACES.md` | Nav, notifications, PWA, changelog (11 files) | **Android push is broken on prod; the diagnostic is unrun** |

---

## 4. The single most important finding

`origin/master` is at `6afa1429` (2026-07-27) and `dev` is **only 8 commits ahead**, all dated
2026-07-27/28. Migration watermark is **205** and dev↔prod parity is green.

**Therefore every plan header reading "BUILT on dev, unpushed, awaiting browser verification" for work
dated before 2026-07-27 is stale — that code is live in production and has been for weeks.**

Roughly **40 of the 157 stale files** were being carried as open projects purely because nobody struck
through a verification marker. Those are the cheapest archives in the list. Each program doc collapses
its share of them into a single "verification debt" line.

---

## 5. Archive candidates

**12 build prompts were archived 2026-07-28.** A further **143 files** are consolidated into the
program docs and ready to move. Each program doc's final section lists exactly which files it absorbed.

**8 files stay active** because the project is unstarted and the plan is the build spec, not history:

- `STANDINGS_REMODEL_PLAN.md` + `STANDINGS_REMODEL_PM_BRIEF.md`
- `ADMIN_IA_MULTIMODULE_NAV_PLAN.md`
- `USER_MANAGEMENT_TOURNAMENT_UX_PLAN.md`
- `HOUSE_LEAGUE_INSEASON_TRUST_PLAN.md`
- `INLINE_TSX_TOKEN_DEBT.md`
- `STRIPE_PRODUCTION_SMOKE_TEST_TODO.md`
- `PUSH_DELIVERY_TEST_PLAN.md`

The Flip P4 build prompt was archived with the others; its scope now lives in
`PROGRAM_PLATFORM_SURFACES.md` §1.1, which is the build spec for that phase.

**One file should move sideways rather than to archive:** `ACCOUNT_MODEL_FREEDOM_ANALYSIS.md` is the
reference behind a ratified business decision with an unfinished build-out — it belongs in
`docs/agents/strategy/`, which is never archived.

---

## 6. Conflicts between projects — resolve before building

| Conflict | Where it stands |
|----------|-----------------|
| **Coach shell: two incompatible designs.** `COACH_NAV_REBUILD_PLAN.md` (June) specifies a team-scoped rail for the free portal with 7 unanswered design questions. The in-flight Free Coach Portal Experience rebuilt that same shell on a *different* model (consumer-family chrome, ratified 2026-07-25). | The in-flight version won and shipped. **Decision CP-1** — retire the old plan, carry forward only OQ-7 (how to persist per-team activated capabilities). |
| **Premium portal: two evaluations.** The June premium walkthrough and the July 18-agent readiness review both catalogue premium portal defects, with partial overlap. | The readiness review is newer, verified, and drives the current batches. The walkthrough's three genuinely-unaddressed items are carried in `PROGRAM_COACH_PORTAL.md` §1.2; the rest is superseded. |
| **League launch vs. account model.** `PROGRAM_LEAGUE_AND_CLUB.md` wants to flip the League flag; `PROGRAM_ACCOUNTS_AND_ACCESS.md` records that the league-create route has no one-org guard and is held shut *only* by that flag. | **Hard dependency. Decisions AA-1 / LC-1 — fix the guard first.** |
| **Admin IA nav: owned twice.** Scoped as its own project, but it's the same customer problem as the League/Club tournament-first skew. | **Decision OE-6** — fold it into League/Club so it ships once. |
| **Assistant coaches: scoped in two places.** `IN_ORG_COACH_CHAT_PLAN.md` claims to "introduce the assistant-coach concept", but assistant coaches were built and shipped independently. | The chat plan is out of date. Re-scope Project 2 against the shipped model before building. |
| **Multi-sport paused, debt accruing.** The sport picker is paused, but a Title-case-vs-lowercase sport-id mismatch between coach signup and admin is live, and the lineup surfaces carry diamond-sport assumptions. | **Decision TE-7** — stay paused on the feature, fix the casing now while it's cheap. |
| **Post-event story split across two programs.** The wrap-up "Next steps" row sits in the help program; the completed-dashboard/summary IA sits in the organizer program. | Build them in one pass — noted in both docs. |
| **January 2027 concentration.** Founding-season org conversion, coach-portal $0 expiry, and the manual comp-cohort runbook all land within 48 hours of each other, and all depend on Stripe Phase G. | **Decision BL-1** — set a Phase G date and work backwards. |

---

## 7. Decisions waiting on you

Each program doc carries its own decision table. Counting across all 11: **48 open decisions.**
The ones that block other work, in priority order:

1. **AA-1 / LC-1** — fix the `/api/league/create` one-org guard (blocks the League launch).
2. **BL-1** — set the Stripe Phase G date (blocks everything paid, including January conversion).
3. **PS-1** — run the push-delivery diagnostic (Android push is dead on production).
4. **CH-8** — is the Coach Chat program (Projects 2–4) still wanted? Answering "no" closes 7 other decisions.
5. **CP-1** — retire the Coach Nav Rebuild plan.
6. **LC-2** — re-commit to an early-access date, or shelve the managed cohort.
7. **TE-8** — schedule the Standings Remodel, the largest unbuilt fan-facing item.
8. **TD-1** — green-light the inline-TSX colour sweep.

---

## 8. Note on PM briefs

`AGENCY_RULES.md` requires a PM brief alongside every significant plan. These program docs are
**consolidated backlogs, not new feature plans** — so rather than doubling the file count with 11 more
briefs, each program doc is written in plain product language throughout, with customer impact stated
inline. New feature plans spun out of these programs still get their own `_PLAN` + `_PM_BRIEF` pair.
