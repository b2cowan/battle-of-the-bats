You are a senior product designer and IA strategist working on **FieldLogicHQ**, a multi-tenant Canadian sports club and league management platform. This is a **planning-only kickoff** — no code changes, no migrations. Your job is to produce a real plan document and PM brief that a developer team can execute from.

---

## YOUR MISSION

Conduct a **Coaches Portal Information-Architecture + UX Review** for FieldLogicHQ. This is a journey-first, end-user-centered review, not a page audit. The output is a reorganized IA, a set of differentiated "wow" concepts, a 5-minute demo script, and a phased implementation plan with PM brief — all grounded in the actual codebase, audit findings, and design assets described below.

The organizing question is: **what does a volunteer coach experience, feel, and accomplish — from the moment they first arrive to the moment they walk off the field after the final game — and how do we make that journey feel effortless and impressive at the same time?**

---

## MANDATORY PROCESS STEPS (do these in order)

**Step 1 — Read before planning.** Before proposing anything, read these files in the repo (skip gracefully with a note if any is absent):

- `docs/projects/active/COACHES_EXPERIENCE_EVAL_PLAN.md` — the primary audit of the **Basic** (free / org-less / tournament-participant) portal; findings for the J2/J4/J5/J9 tournament-coach personas; three-lens framework (gap/wow/growth); TL;DR, Stage-by-stage, and synthesis sections. **Note: this doc covers the Basic portal (`/coaches/*`). The Premium portal's accreted IA pain is documented in the "Current State" section of this kickoff prompt itself — do not expect to find it in this file.**
- `docs/projects/active/COACH_NAV_REBUILD_PLAN.md` — progressive-disclosure nav model, tier 1/2 decisions, team-scoped rail, rediscovery system.
- `docs/projects/active/COACH_PREMIUM_UPGRADE_FLOW_PLAN.md` — Premium ≥ Free principle, data-migration contract, upgrade-continuity rules.
- `docs/projects/archive/ASSISTANT_COACHES_PLAN.md` and `ASSISTANT_COACHES_PM_BRIEF.md` — per-assistant capability model, per-area nav gating, PIPEDA constraints.
- `docs/projects/active/COACHES_PORTAL_LINEUP_INTELLIGENCE_PLAN.md` — lineup-intelligence "wow" features.
- `docs/projects/active/COACH_PORTAL_GROWTH_PLAN.md` — upsell voice rules, cannibalization guardrail, pressure-ladder, two-dialects contract.
- `docs/agents/strategy/PLAN_PRICING_FACTS.md` — canonical plan names, prices, gating. Single source of truth; never restate a price from memory.
- `memory/design_decisions.md` — binding design decisions, especially the 2026-06-29 "Coaches Portal mobile conventions" entry, the 2026-06-30 "field-side touch" entry, and all Coaches Portal entries.
- `memory/MEMORY.md` — project-state index; read the coach-portal entries: `project_coaches_portal_architecture`, `project_coaches_portal_ia_ux_review`, `project_coach_premium_upgrade_flow`, `project_assistant_coaches`, `reference_coach_portal_arch_decision`, `feedback_sport_neutral_no_debt`.
- `docs/projects/archive/PUBLIC_VISUAL_REDESIGN_PLAN.md` — the "wow" primitives inventory (RollingNumber, MyTeamDock, Countdown, SharePageButton, team-color, phase-adaptive Team HQ hero, illustrated empty states).

**Step 2 — Present a plain-language PM UX summary FIRST.** Before any plan structure, write the plain-language summary (Deliverable 1) describing what a coach sees and does differently after this work ships, for a product owner, not an engineer. Present it as a clearly delineated section at the top of your response, separated by a horizontal rule. **Then proceed immediately to the remaining deliverables — do not wait for a reply.** The owner will review the summary and flag corrections before acting on the plan.

**Step 3 — Follow the method sequence in the METHOD section below:** journey map first (A), then three-lens assessment (B), then IA relationship modeling + placement rubric (C), then wow moments + demo script (D), then the proposed reorganized IA (E).

**Step 4 — Produce ALL deliverables in the DELIVERABLES section.** Do not stop at partial delivery. Create `docs/projects/active/COACH_PORTAL_IA_UX_REVIEW_PLAN.md` + `..._PM_BRIEF.md`, add a summary line to `TODO.md` linking to both, and log any durable decisions via `/strategy`.

---

## WHO THE USER IS — EMPATHY BRIEF

**The primary user is a volunteer coach.** Not a tech person. Not someone who reads help docs. Someone who agreed to coach a rep team or a tournament team because they love the sport and their kids are on the team. They have a full-time job. They coach in the evenings and on weekends. Their season is 3–4 months, and then it's over.

Their phone is their computer. They are looking at it standing on a sideline, one hand on it, one eye on the field. They might be wearing gloves. The sun might be on the screen.

> **Key behavioral constraint:** Coaches do not retain software knowledge between seasons. They arrive each year largely from scratch. Any solution that depends on learned behavior — remembered nav patterns, remembered feature locations — will fail. **Design for zero-retention users; onboarding tutorials are not the answer.**

They need the portal to work the way their brain works at the field: **what do I need to do right now?** The answer changes by day: pre-season it is "get my roster in order"; game morning it is "who is showing up and who is playing where"; post-game it is "record the result and tell the parents what happened."

They will not tolerate confusion. If a screen looks broken, they assume it is broken. If a button is too small, they misfire it. If a nav item leads somewhere they didn't expect, they lose confidence in the whole tool. Three confusing moments and they are back to a group chat and a spreadsheet.

**But they are also proud.** They care about their team's record. They want to know if their roster is ready. They want to see at a glance that 14 of 15 players are coming Saturday. They want to share the championship result with the team group chat. They appreciate data — they just need it presented clearly, not buried.

**The tension this review must hold:** the surface must be dead simple for a non-tech, time-poor, seasonal user, AND it must surface a robust array of meaningful metrics and data that coaches genuinely appreciate and that no other tool puts this effortlessly at their fingertips. Both. Not one or the other.

**Three coach sub-personas to keep distinct throughout:**

1. **Tournament coach (Basic / free)** — a team registered in a tournament; no permanent org; email-keyed identity; arrives via the claim-team flow. Main jobs: know their schedule, communicate with parents, track who is showing up and what fees are owed. Duration: days to weeks around the tournament.

2. **Rep head coach (Premium)** — operates a year-round team workspace, likely standalone or Club-included. Runs tryouts, manages a full roster with positions and lineups, tracks season budget and dues, communicates with parents. Duration: full season, then "start next season." **This is the power user and the commercial engine.** Their assistant coaches have capability-gated nav (they see only what the head coach grants them).

3. **House-league coach** — a coach-role member inside a house-league org. Today this lands on a permanent dead end (a known HIGH-severity gap). **Default assumption for this review: house-league coach extension is OUT OF SCOPE (treat as a separate stream). Flag it as Owner Decision #1 but do not let it gate the rest of the plan.**

**The franchise model is binding:** the coach is the primary operator. The org/club has oversight only (visibility, remove, optional approval gating, default off). The coach administers their team, their assistants, their roster, schedule, fees, and announcements. Admin does not manage day-to-day coaching relationships.

---

## THE GOAL — SIMPLICITY + DATA RICHNESS + DIFFERENTIATION

Three simultaneous goals, held together, not traded off:

**Goal 1 — As easy as possible for a non-tech volunteer coach.** Every screen answers "what do I do next?" without the coach having to read anything. Setup guides without lecturing. Run-mode surfaces the most time-sensitive information at the top. Nothing requires knowing what a nav item is called before you know you need it.

**Goal 2 — A robust array of metrics and data at their fingertips.** The data exists; the analysis functions exist; none of it is organized around what a coach actually wants to know. Coaches want to know: Where do we stand? Who is showing up? Who hasn't paid? Is my lineup compliant? How did we do this year vs last? That data all exists — it is buried four screens deep, not surfaced at all, or dumped in one long column on the Overview page.

**Goal 3 — A real "WOW" that differentiates and that a coach feels within a 5-minute demo.** Not "it works." A moment where a coach says "oh, that's cool" or "I didn't know software could do that." There are at least seven wow opportunities already built (below). The review must decide which to lead with, how to sequence them in the journey, and how to make them feel inevitable rather than bolted-on.

---

## CURRENT STATE — WHAT YOU ARE REVIEWING

### The Two Portal Models

**Model A — Basic Coaches Portal (free, org-less, tournament-participant).** Routes `/coaches/*` and `/coaches/team/[basicTeamId]/*`. Email-keyed identity, no org. Shell = a desktop left rail + mobile bottom-nav. Nav uses progressive disclosure in two tiers: Tier-1 always visible (Overview, Tournaments, Chat); Tier-2 activated as the coach earns a feature (Roster, Schedule, Fees, Announcements). Per-team lifecycle chip on the team card (pending → accepted → live/game-day → result).

**Model B — Premium Coaches Portal (paid, org-scoped rep-team workspace).** Routes `/{orgSlug}/coaches/*`. Auth-guarded; hard "not assigned" wall if no active coaching assignment. Billing: standalone monthly/seasonal, org-billed add-on, or Club-included. Shell = a desktop sidebar + mobile bottom-nav.

**Important:** these are SEPARATE codepaths and SEPARATE data models. The decision to NOT unify them onto shared tier-gated tables is locked (2026-06-19). Do not propose unification. Do not re-litigate.

### Premium Portal — Current Navigation

**Sidebar groups (recently clustered):**
- (ungrouped): Overview
- Squad: Roster (Depth chart is a view toggle inside Roster), Tryouts
- Season: Schedule, Tournaments
- Communication: Chat, Announcements
- Admin: Accounting, Documents, History, Staff, Settings

Plus Help + Sign out at the bottom; a notification bell in the header; a chat unread badge.

**Mobile bottom nav — primary 4 tabs:** Overview, Schedule, Chat, Roster. "More" drawer holds the rest (Tryouts, Tournaments, Announcements, Accounting, Documents, History, Staff, Settings) + team switcher (only with 2+ teams).

### IA Pain — The Concrete Problems to Fix

Treat these as symptoms of a structural problem to redesign away, not a checklist to close one by one.

1. **The Overview page is one long single-column stack doing two contradictory jobs** — it is simultaneously the setup wizard (progress bar + core/optional steps) and the run-mode dashboard (snapshot tiles + season-record widget). The setup panel gates the tiles (binary flip, not a graceful evolution). The season-record — arguably the most emotionally resonant data — sits at the very bottom. There is no persistent "what matters most right now" anchor that adapts by season phase.
2. **The lineup builder — the premium killer feature — has zero navigation presence.** It is buried inside the Schedule event slide-over, below attendance, with no nav item. The setup checklist marks lineups "done" on game count, not on a saved lineup existing, so it can read Done while no lineup was ever built. A coach who has never built one cannot discover it.
3. **Accounting is a hub of sub-hubs** — seven link tiles in a column, each its own page; the most actionable data ("3 players overdue, $420 outstanding") is invisible without entering a sub-page.
4. **Settings has grown beyond settings scope** — it mixes per-team identity config (division), season lifecycle ops (start next season), and gameplay rules (lineup caps): different mental models in one place.
5. **Nav grew item-by-item without a placement rubric** — the "Admin" group is 5 heterogeneous items (financial ops, filing, archive, people, config) placed as each was built, not from a model of relationships.
6. **No section relationships are modeled** — attendance affects lineup readiness shown on Overview's next-up tile, but there is no connective surface; a coach checking who's "in" for Friday can't see the lineup from the same context; the season-record widget has no link to the per-game scores in Schedule; standings data exists but appears nowhere.
7. **Tryouts is always visible** even for orgs that never run tryouts.
8. **The Tournaments tab dead-ends a coach who never registers for external tournaments** — the Season group makes the team's own schedule (frequent) a peer of external tournament history (infrequent), despite different rhythms of use.
9. **History is hard to find and has no preview** — nested at the bottom of Admin; previous-season records (wins, losses, dues, expenses) are emotionally resonant for competitive coaches but never surfaced proactively.
10. **High-value data never shown in the portal at all:** league standings position; per-player attendance-reliability trends; lineup-analysis alerts ("2 players under minimum innings", "no pitcher set"); "who hasn't paid anything" vs a generic outstanding total; tournament placement/result cards for Premium teams; season-over-season record + financials comparison; position-coverage gaps ("no catcher on roster").

---

## METHOD — HOW TO CONDUCT THIS REVIEW

### Step A — Journey mapping first
Before touching the IA, map the coach's end-to-end journey per persona across the full season, as a sequence of **job stages** with a named goal each, not a feature list. Example stages (refine): Arrive + Claim → Set Up → Pre-Game Prep → Game Day → Post-Game → Season Wind-Down → Off-Season. For each stage: what is the coach's primary job? what data do they need? what decision do they make? what do they look at on their phone? where does the current portal fail them? where is a wow opportunity?

### Step B — Apply the three-lens framework
For every surface and stage, apply all three lenses (the method used across the platform's journey audit): **Gap** (friction, dead ends, missing states, data they need but can't see) · **Wow** (premium delight, broadcast-grade, genuine surprise no competitor delivers) · **Growth** (the portal honestly demonstrating its own value so the upgrade feels self-evident, not pitched). Gap analysis alone produces a bug list, not a product — hold all three.

### Step C — Design the IA around data + task relationships
Work out loud: what is the relationship between attendance and lineup? between dues outstanding and the season budget? between the schedule and the W-L-T record? between this season's history and next season's setup? From those relationships derive a **section hierarchy** and a **placement rubric**. Use these five named categories as the proposed rubric vocabulary (refine only with strong reason), and define them explicitly in the plan so future sessions reference them by name rather than relitigating placement:
- **Dashboard** — what matters most right now, phase-adaptive.
- **Manage** — CRUD over a named entity (roster, fees, schedule).
- **Operate** — real-time game-day action (attendance live, lineup, live score).
- **Review** — history, analysis, comparison (season record, standings history).
- **Admin** — configuration, billing, lifecycle (settings, start next season, org link).

### Step D — Define the wow moments + the 5-minute demo script
Identify 3–5 signature moments a coach would *feel* — genuine delight or surprise. For each: what triggers it, what the coach sees, the intended reaction, and which **existing built primitive** delivers it (do not invent new work; use what exists). Then sequence them into a **5-minute demo script** ordered to build emotional momentum: open on the simplest surface (clarity wow) → data richness (intelligence wow) → peak at the game-day or result moment (emotional wow) → close on the growth bridge (aspiration wow). **The script is a required deliverable — write it out.**

Seven wow candidates already built (reference when designing the demo):
1. **Phase-adaptive Team HQ hero** — lifecycle-aware contextual UX (esp. the game-day live scorebug). No other youth-sports tool does this.
2. **Auto-fill lineup intelligence with a mode dial** — Competitive / Balanced / Development; A-squad emphasis; arm-care pitching caps; playing-time heat grid. Bundled, no per-player charge.
3. **Share card at the afterglow** — team share card at the result moment. Emotional peak, pride-first.
4. **Season Record W-L-T widget** — scope caption, filter chips, active-state accent.
5. **Depth-chart board** — team × positions matrix (desktop) / per-player accordion (mobile); A-squad star; auto-save + undo/redo.
6. **Tryout Day** — blind mode (names hidden until deliberate reveal), field-side check-in, provincial eligibility-window awareness.
7. **League standings position** — **this is the ONLY candidate on the list not yet surfaced anywhere in the coach portal; the other six are built.** It is also the single highest-value quick win: the competitive coach's #1 want ("where do we stand?") answered with roughly one new data route + one tile. Flag it separately from the "already built" primitives when sequencing the demo.

### Step E — Define the reorganized IA
From the journey map, the three-lens findings, and the relationship model, propose a reorganized IA: a renamed/regrouped Premium nav (sidebar + mobile), a **phase-aware Overview** (not a binary setup/run flip; the right data at the right time without a long single column), the placement rubric applied, conditional visibility (Tryouts, Tournaments), how the lineup builder gets nav presence, and how section relationships become connective flows rather than separate pages.

---

## CONSTRAINTS — MUST RESPECT ALL OF THESE

- **Franchise model (binding):** Coach = primary operator; org/club = oversight only. Don't move day-to-day coaching decisions into the org-admin layer.
- **Separate codepaths, do not unify (locked 2026-06-19):** Basic and Premium are separate models. Don't propose unification. Don't re-litigate.
- **Premium ≥ Free everywhere (locked 2026-06-18):** Every Premium capability must be at least as capable as the equivalent Basic one. If you surface a regression, flag it — don't silently accept it.
- **Assistant-coach capability-gated nav (binding):** Nav shows only what the head coach granted. An assistant with a capability off never sees that tab. Birthdates + parent contacts are OFF by default. Don't design around this model.
- **PIPEDA / least-privilege on guardian PII (binding):** Minor DOB + guardian contacts are sensitive. A module-capability gate is NEVER sufficient as the access gate for a coach surface (there is a live leak from exactly that pattern). Access to guardian PII must require an explicit per-coach grant. No design routes around this.
- **Sport-neutrality (binding):** No hard-coded "Runs / innings / mercy cap." All sport vocabulary + rules route through the Sport Pack. Adding a sport later = add a pack, not rework the portal.
- **Plan naming + pricing (binding, from PLAN_PRICING_FACTS.md):** Canonical names are "Basic Coaches Portal" (free) and "Premium Coaches Portal" (paid). Never restate a price from memory. Never show a participating coach the words "Basic"/"Premium" as competing tiers — one identity, "Your Coaches Portal"; Premium is additive ("Take your team further").
- **Pressure-ladder / one earned ask (binding):** Pre-event surfaces are pitch-free; the single acquisition moment is the afterglow (post-event result). Don't scatter upsell upstream.
- **Cannibalization guardrail (binding):** Standalone Premium must not quietly undercut Club. Club messaging emphasizes org data-sharing, not price comparison.
- **Mobile-first as the primary operating mode (binding):** Mobile is the primary field-side mode, not a squeezed desktop. The four primary mobile bottom-nav tabs are fixed (see Current State; owner decision 2026-06-29) — proposing changes in the More drawer is in scope; changing the primary four is not. Touch targets ≥40px (≥36px dense grids). Sunlight: the lime accent is weak as small text — use high-contrast labels + solid fills + bold weight for primary state.
- **Design system — two dialects, one brand (binding):** Coach portal = warm/rounded dialect; admin = dense cockpit. Don't unify; align brand chrome only. See `memory/design_decisions.md`.
- **Reuse don't rebuild (binding):** The shell, sidebar, Team HQ hero, roster/schedule/fee/announcement editors, lineup generator + analysis, season-record widget, and the wow primitives are already built — design around them, not past them.
- **Documentation conventions (binding):** Detailed plan → `docs/projects/active/`; PM brief alongside; one summary line in `TODO.md`. See `AGENCY_RULES.md`.
- **Planning-only, no code (this session):** Plan documents + PM brief only. No source edits, no migrations. A separate implementation session follows owner approval.
- **Conflict protocol:** If a proposed IA change conflicts with a binding constraint (e.g., a nav restructuring that would require rebuilding the sidebar beyond its current model, or a data surface that would need a migration), do NOT silently resolve it. Flag it explicitly as an owner decision (Deliverable 7), state the constraint it bumps against, present the tradeoff, and — where useful — describe the constrained and unconstrained options side by side.

---

## DELIVERABLES (produce all — do not stop at partial delivery)

1. **Plain-language PM UX Summary (deliver FIRST, at the top, then continue).** 3–5 paragraphs for the product owner: what a coach sees and does differently after this ships; the emotional arc of their first 5 minutes; what they can do now that they couldn't; how it differs from the 2–3 tools they used before. No engineering detail.
2. **Journey Map — coach end-to-end by persona.** For the Tournament Coach (Basic) and the Rep Head Coach (Premium): named job stages from arrival to off-season, primary goal per stage, data needed, current failure mode, and the highest-value opportunity per stage. **Do NOT produce a separate assistant-coach map** — cover assistant differences as an annotation/footnote within the Premium map.
3. **IA Pain Assessment.** For each accreted problem: the symptom as the coach experiences it (not the technical description), the structural root cause (stacking, unmodeled relationship, nav-without-rubric), and the design principle it violates. Make an owner viscerally understand why the current IA is a liability even if no single page is "broken."
4. **Data Richness Inventory + Placement Map.** For each high-value data stream already available: what it is, where it lives, what coaching question it answers, its emotional/operational value, which surface it belongs on in the new IA, and in what format (number, bar, trend, alert, tile, inline).
5. **Proposed Reorganized IA.** Renamed/regrouped sidebar with rationale; mobile bottom-nav structure (primary 4 fixed; what changes in More); the phase-aware Overview concept (described, not wireframed); the placement rubric; conditional visibility logic; lineup-builder nav presence; section-relationship connective flows.
6. **Signature Wow Moments + 5-Minute Demo Script.** 3–5 wow moments (trigger, what's seen, reaction, delivering primitive) + the script written as a narrative sequence. **Audience:** a self-serve 5-minute scenario a **prospective volunteer head coach runs themselves on their own phone** — not a sales-rep walkthrough. They just signed up or were invited; they are deciding whether to pay for Premium or drop back to a group chat. Script for that exact moment.
7. **Owner Decisions List.** Each as a clear choice with the tradeoff named. Seed set (surface more as you find them): #1 is house-league coach extension in scope or a separate stream; how aggressively to surface standings vs staying team-focused; whether the lineup builder gets its own primary nav item or is elevated within a section; whether History gets an Overview preview tile; the trigger condition for hiding Tryouts.
8. **Phasing** structured around the coach journey (not the feature list). Phase 1 must be shippable and demonstrably better for a coach, each phase with a "what the coach gains" outcome. Note where an IA/nav change needs no migration vs where a wow (e.g., standings) needs a new data route.
9. **Plan Document + PM Brief.** `docs/projects/active/COACH_PORTAL_IA_UX_REVIEW_PLAN.md` (full structured plan) + `..._PM_BRIEF.md` (plain-language: proposed functionality, why it matters, customer impact, priority, success criteria — for a stakeholder who hasn't read the plan). Add one linking summary line to `TODO.md`.

---

## STARTING INSTRUCTION

Begin by reading the files under Step 1. Then present the plain-language PM UX Summary (Deliverable 1) as a clearly delineated section at the top of your response, and continue straight through the remaining deliverables — do not pause for confirmation. Say explicitly when you have finished reading and are starting the summary.
