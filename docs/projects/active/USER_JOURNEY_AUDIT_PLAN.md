# Platform-Wide User Journey Audit — Implementation Plan

> **Status:** Planning (approved structure — Phase 0 not started)
> **Created:** 2026-06-10
> **Branch:** dev (docs/reports only; no product code changes in this project)
> **Companion:** [USER_JOURNEY_AUDIT_PM_BRIEF.md](USER_JOURNEY_AUDIT_PM_BRIEF.md)

## Goal

Experience FieldLogicHQ end-to-end as 10 personas — marketing landing → signup → setup → daily operation → season close — scoring every step against six experience questions, and produce (a) one journey report per persona, (b) a deduplicated cross-persona master findings backlog, and (c) routed inputs into the in-flight coaches plans. This is an **evaluation project**: it produces reports and a triaged backlog, **not code**. Fix work spins out as separate scoped projects after owner review.

## Locked decisions (owner, 2026-06-10)

- **Method = hybrid:** multi-agent code/route walk for breadth (every step), plus live dev-server browser passes with screenshots at mobile (390×844) + desktop (1440×900) for the ~8–12 signature screens per journey.
- **Personas = 10:** the original 6 + house-league parent, scorekeeper/gate volunteer (combined), house-league team coach, invited org staff admin (last three = light journeys).
- **Cadence = checkpoint after Journey 1:** owner reviews report format/depth after the tournament-organizer journey; remaining journeys run with that calibration. **CHECKPOINT PASSED 2026-06-11** — no format/depth changes requested.
- **In-flight surfaces (J2/J5) — revised at checkpoint (2026-06-11):** J5 walks NOW (its findings feed Phase 5 slices 5j–5o before they're built); **J2 deferred to Phase 4** (its Premium rep-portal surfaces are comparatively stable). Findings on owned surfaces still route into the existing plans rather than forking them.
- **Verification = risk-targeted (owner, 2026-06-11):** adversarially verify only findings that are (a) High severity, (b) type `bug` (factual code-behavior claims), or (c) routed into another plan. Screenshot-backed design/copy/wow findings go unverified — the screenshot is the evidence. (J1 used full per-group verification; this supersedes it for J2–J10.)

## The six-question rubric (applied to every leg of every journey)

1. **Purpose** — do I know what this page and these features are for?
2. **Sequence** — is the journey easy to follow; are tasks buried or out of logical order?
3. **Visual appeal** — is the design appealing, on mobile AND desktop?
4. **Friction** — what can be done here to make this process easier?
5. **Scanability** — is the information organized so the purpose of everything is clear at first glance?
6. **Delight** — can anything be done to make my experience better (wow opportunities)?

## Journey roster

Execution order maximizes routing value (in-flight coaches journeys early) and reuse (J4 walks only the delta on J3).

| ID | Persona | Depth | Journey arc | In-flight routing |
|----|---------|-------|-------------|-------------------|
| **J1** | Tournament organizer | Full | Landing → pricing → `/start/tournament` → signup/onboarding → create tournament (divisions, settings, registration) → branding/public site → manage registrations → schedule build (generator + timeline) → comms → game day (live dashboard, scoring, check-in, playoffs incl. tie-breakers) → completion (champions, Summary) → reuse setup for next event. Includes free→Plus upgrade moments. | Validates Dashboard-Completed/Summary IA (just built) |
| **J2** | Rep head coach (team ops) | Full | Landing → segment discovery (how does a coach find the team offering at all?) → `/start/team` Basic standalone → team home (roster, schedule, fees, announcements) → ceiling/upgrade moments → Premium org-attached portal (lineups?, budgets, expense tracking, dues). Lineups may be a missing-feature finding. | → Coaches Experience A–E / unified plan |
| **J3** | House league admin | Full | Landing → pricing → today's League path (`/start/league` express-interest — document the consultative reality) → provisioned org → league onboarding wizard → seasons/divisions/teams → registration forms + fees → schedule generation → coach comms → accounting → public league site → "run a tournament each season" cross-module moment. | League free floor = Free Tier Phase 6 (not built) — document today's paid-only path as-is |
| **J4** | Club president | Full (delta on J3) | Everything in J3 assumed; walk the delta: rep-teams oversight (franchise model — coach writes, admin read-only), advanced budgeting with links to coach budgets/ledgers (org ledger ↔ team ledgers), coach account oversight (ownership transfers, links flow), multi-module IA/navigation at Club scale. | **Absorbs the open "Rep Teams franchise model review" TODO item** |
| **J5** | Rep coach in a tournament | Full | Invited/registers via public register form → merged account creation → Basic portal Team HQ → tournament status + fees → roster submission → game day (bridge to public live experience) → afterglow. Walk the current built state (through slice 5h). | → Free Tier Coaches Phase 5 (slices 5i–5o are literally this journey's back half — findings are direct design input) |
| **J6** | Tournament parent/fan | Full | Receives a shared link → public tournament home → schedule → follow team (My Team dock) → live scores → standings → share cards → PWA install + score alerts (Plus) → post-event. Mobile-first emphasis. | Complements the public redesign Phase E QA checklist (experience-level vs surface-level) |
| **J7** | House-league parent | Full | Discovers league public site → registers a kid (form, fees, payment) → confirmation/emails → in-season: schedules, team info, announcements received → next-season re-registration. Never been walked. | — |
| **J8** | Scorekeeper + gate volunteer | Light | How they're assigned (invite/capability) → `/{org}/scorekeeper/` scoring on a phone at the field → `/{org}/check-in/` gate board (arrival, pay-at-gate, roster confirm). Least-trained users, most stressful day. | — |
| **J9** | House-league team coach | Light | Receiving end of J3's "communicate to coaches": what arrives (email? portal?), org-scoped coaches portal for house league, schedule visibility. May be largely email-only — documenting that IS the finding. | — |
| **J10** | Invited org staff admin | Light | Owner invites admin → invite email → accept-invite flow (recent fix: invited-only members route to accept-invite) → role-scoped admin experience → capability overrides → what's correctly hidden vs confusingly absent. | Leverages just-built Admin Role Parity; checklist-style |

**Shared surfaces hit by many journeys** (deduped in Phase 5 synthesis): marketing landing + pricing, `/start` picker + sub-pages, auth (signup/login/accept-invite), `/home` workspace switcher, emails as a class.

## Finding taxonomy

Every finding carries:

- **ID:** `J<journey>-<seq>` (e.g. `J1-014`)
- **Leg:** which journey step
- **Severity:** `Blocker` (journey cannot proceed) / `High` (major friction, misleading, or trust-damaging) / `Medium` / `Low` (polish)
- **Type:** `bug` / `copy` / `ia-sequence` / `design-visual` / `missing-feature` / `wow-opportunity` / `trust-brand`
- **Rubric question failed:** Q1–Q6
- **Evidence:** file refs (`path:line`) and/or screenshot filename
- **Suggested direction:** one or two sentences, not a spec
- **Route:** `backlog` (this audit) / `phase5` / `coaches-a-e` / `existing:<plan>` (when an open plan already owns the surface)

`missing-feature` is explicitly distinct from UX defect — e.g., J3 hitting "League signup is express-interest only" or J2 finding no lineup tool are documented expectations-vs-reality gaps, not bugs.

## Per-journey execution recipe (workflow shape)

Each journey runs as a multi-agent workflow (ultracode), consistent with the owner's standing preference for adversarial verification:

- **Stage A — Route-map:** one agent maps the persona's actual click-path from code (entry → exit), enumerating every page, component, email, and decision point. Output = the journey map with numbered legs. This is the skeleton the report follows.
- **Stage B — Leg walk (parallel):** agents per leg-group score the six questions against code (page + CSS modules + components + copy), producing candidate findings with file refs. Each agent walks AS the persona (goal-driven), not as an auditor reading files.
- **Stage C — Live pass:** dev server (network access — see AGENTS.md EACCES warning) + Playwright; screenshot the journey's signature screens at 390×844 and 1440×900 (dark default; branded/light where the surface theme matters). A design-lens agent reviews screenshots for visual appeal, hierarchy, and first-glance scanability (Q3/Q5) — the questions code-reading can't answer.
- **Stage D — Adversarial verify (risk-targeted from J5 on):** skeptic agents re-derive only High-severity, `bug`-type, and routed-to-other-plan findings — real? already fixed/planned in an open plan (→ re-route, don't duplicate)? duplicate? severity inflated? Screenshot-backed design/copy/wow findings skip verification.
- **Stage E — Synthesis:** the per-persona report (template below).

## Report template (one file per journey)

Created during execution at `docs/projects/active/journeys/JOURNEY_<ID>_<PERSONA>.md`:

```markdown
# J<id> — <Persona> Journey Report
> Walked: <date> | Method: code-walk + live browser | Status: draft | findings routed: <date|pending>

## The journey at a glance
[Narrative: what this persona experienced start→finish, written as their story. 3–6 paragraphs.]

## Leg-by-leg scorecard
| # | Leg | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Notes |
[✓ / ⚠ / ✗ per question per leg]

## Findings
[Full findings table per the taxonomy]

## Top 5 moves
[The five changes that would most improve this persona's experience, ranked]

## Wow opportunities
[Delight ideas worth a future project]

## Screenshots index
[filename → what it shows]
```

## Phases

### Phase 0 — Harness & staging
- [x] Create `docs/projects/active/journeys/` + drop the report template in as `_TEMPLATE.md` (2026-06-10)
- [x] Seed data: `seed-live-tournament.mjs` re-run 2026-06-10 (day 1 = today, 1 LIVE game); `completed-demo` verified 200. Tournament IDs for admin deep-links: live `a860d51b-…`, completed `8444a33d-…` (`?tournamentId=` switches the admin context)
- [x] **League/Club staging gap — largely solved by existing tooling:** `app/api/dev/seed/org` (POST, plan param `tournament|tournament_plus|league|club` → `dev-league-org`/`dev-club-org` owned by `owner@dev.local`/`devpass123`) + `app/api/dev/seed/house-league` (seasons/teams/registrations incl. guardian emails) + `.env.local` already has `UAT_CLUB_ORG_SLUG`. Remaining: run the seeds + verify data richness before J3 (ledger data may still need topping up)
- [x] UAT accounts confirmed in `.env.local` (owner/admin/coach/scorekeeper + plus-scorekeeper + club slug); dev-test-org has `owner|admin|staff|coach@dev.local` (password `devpass123` per `app/api/dev/seed/org/route.ts`)
- [x] Screenshot storage: `tests/uat/results/journeys/<J>/` — `tests/uat/results/` is gitignored ✓; new reusable driver `scripts/journey-shots.mjs` + per-journey spec `scripts/journeys/<j>-shots.json` (mobile 390×844 + desktop 1440×900, full-page, one login → shared storage state)
- [x] Dev server verified: already running on :3000, login page 200, public + demo pages 200 (2026-06-10)

### Phase 1 — J1 Tournament organizer + CHECKPOINT ⛔
- [x] Run the J1 workflow (Stages A–E) → [`journeys/JOURNEY_J1_TOURNAMENT_ORGANIZER.md`](journeys/JOURNEY_J1_TOURNAMENT_ORGANIZER.md) — DONE 2026-06-10. Stage A route-map (14 legs, 3 surprises) → 8 leg-walkers → 8 adversarial verifiers (1 finding refuted, 1 worsened) → 40 screenshots (20 screens × 2 viewports) → 5 design-lens reviewers (48 visual findings) → synthesis. **Result: 118 verified findings (25 High · 64 Medium · 29 Low), 48-leg scorecard, top-5 moves, routing table** (103 backlog · 11 DASHBOARD_SUMMARY_IA · 2 FREE_TIER_STRATEGY · 1 unified-plan · 1 phase5). Cost: ~3.4M subagent tokens across 28 agents
- [x] **Owner checkpoint PASSED 2026-06-11** — no format/depth/severity changes requested. Two decisions taken at checkpoint: risk-targeted verification for J2–J10; J5 next / J2 deferred to Phase 4
- [x] Calibration folded into this plan (Stage D recipe + locked decisions updated; `_TEMPLATE.md` unchanged)
- [x] J1 routing executed 2026-06-11: 11 findings → `DASHBOARD_SUMMARY_IA_PLAN.md` §9 · 2 → `FREE_TIER_STRATEGY_PLAN.md` §16 · 1 → `FREE_TIER_COACHES_UNIFIED_PLAN.md` · 1 note → `FREE_TIER_COACHES_PHASE_5_BUILD.md`

### Phase 2 — J5 Tournament coach (time-sensitive: slice 5j is next in the Phase 5 build queue)
- [x] J5 Rep coach in a tournament → [`journeys/JOURNEY_J5_TOURNAMENT_COACH.md`](journeys/JOURNEY_J5_TOURNAMENT_COACH.md) — DONE 2026-06-11. 9-agent code-walk (6 walkers, risk-targeted verify: 58 verified, 0 refuted, 1 batch resumed after a stream timeout) + 22 screenshots + 2 design lenses + 1 auditor live-DB finding. **65 findings (21 High · 24 Med · 20 Low).** Headliners: UTC date family (render off-by-one everywhere + 8pm-Eastern phase-flip freezing the live scorebug), organizer-Paid-vs-coach-OWED resolver precedence bug, orphaned-basic-team access limbo (inaccessible AND unclaimable; delete-user does no cleanup), bulk emails sending "Division division" placeholders with fieldlogichq@gmail.com as contact, claim-wall arrival, champions get "Event complete", /coaches has no PWA manifest (5i install prompt dead). **Routing EXECUTED 2026-06-11:** per-slice design input (5j/5k · 5m ×9 incl. plan-independence non-negotiable · 5n · 5o · 32 built-slice refinements) → `FREE_TIER_COACHES_PHASE_5_BUILD.md` "Journey-audit inputs"; 7 shell/IA findings → `COACHES_EXPERIENCE_EVAL_PLAN.md`; 13 backlog (2 tagged fix-now: J5-012, J5-026). Staging notes: coach@dev.local claim-links created via DB (mirrors claim flow); J5 spec at `scripts/journeys/j5-shots.json`

### Phase 3 — Public + league core
- [ ] J6 Tournament parent/fan → report
- [ ] J3 House league admin → report
- [ ] J4 Club president (delta walk) → report; fold in the rep-teams franchise-model audit and mark that TODO item absorbed
- [ ] J7 House-league parent → report

### Phase 4 — Deferred coach journey + light journeys
- [ ] J2 Rep head coach team ops → report + route findings into the Coaches Experience / unified plan (deferred from Phase 2 at checkpoint — Premium portal surfaces comparatively stable; needs standalone-team staging: `basic_coach_teams` is currently empty in dev)
- [ ] J8 Scorekeeper + gate volunteer → report (combined)
- [ ] J9 House-league team coach → report
- [ ] J10 Invited org staff admin → report (checklist-style)

### Phase 5 — Cross-persona synthesis & triage
- [ ] Dedupe shared-surface findings (landing/pricing, `/start`, auth, `/home`, emails) across all 10 reports
- [ ] Master backlog: severity-ranked, routed, with a theme grouping (e.g. "first-run emptiness", "mobile admin", "email voice")
- [ ] Propose the fix-project breakdown (each significant theme → its own future `_PLAN.md` + `_PM_BRIEF.md`)
- [ ] Owner review → spin out approved fix projects → archive this plan + reports per docs convention

## Architectural decisions

- **Decision:** One umbrella program, not 10 projects. **Rationale:** shared method/taxonomy, cross-persona dedupe of shared surfaces, avoids 10× plan/brief overhead; fix work gets its own scoped projects post-triage.
- **Decision:** Findings on in-flight surfaces route into the open plans instead of this backlog. **Rationale:** cheapest moment to act is while those plans are mid-build; forking would create two sources of truth.
- **Decision:** Reports + backlog are the only commit artifacts; screenshots stay out of git. **Rationale:** binary bloat; reports cite filenames from the gitignored harness output.
- **Decision:** J4 walks only the delta on J3. **Rationale:** Club ⊇ League; re-walking shared legs would double cost for zero new findings.
- **Decision:** Marketing-surface findings get `trust-brand` type and are synthesized for the /marketing agent rather than fixed ad hoc. **Rationale:** brand copy has its own canon (`docs/agents/brand/`) and owner.

## Open questions

- [ ] League/Club seed: extend an existing script vs. new `seed-league-org.mjs`? (Resolve in Phase 0 after auditing what `uat`/dev orgs already have.)
- [ ] Stripe legs (J3/J4 checkout, J7 registration payment): walk in test mode as far as test mode allows; depth beyond that = documented as out of scope?
- [ ] J9 may collapse to a 1-page report if the house-league coach surface is genuinely email-only — acceptable, or should it merge into J3's report as a "receiving end" appendix?
