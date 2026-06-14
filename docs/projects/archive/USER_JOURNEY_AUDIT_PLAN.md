# Platform-Wide User Journey Audit — Implementation Plan

> **Status:** Phases 1–4 COMPLETE (all 10 journeys walked + routed). **NEXT = Phase 5 cross-persona synthesis** (separate session, after owner review of the Phase 4 reports).
> **Created:** 2026-06-10
> **Branch:** dev (docs/reports only; no product code changes in this project)
> **Companion:** [USER_JOURNEY_AUDIT_PM_BRIEF.md](USER_JOURNEY_AUDIT_PM_BRIEF.md)
> **Running totals:** 10 journeys · J1 118 · J5 65 · J6 57 · J3 80 · J4 50 · J7 26 · **J2 38 · J8 23 · J9 16 · J10 27** = 500 findings, 0 refuted across all risk-targeted verification.

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

### Phase 3 — Public + league core (ALL FOUR WALKED + ROUTED 2026-06-11)
- [x] J6 Tournament parent/fan → [`journeys/JOURNEY_J6_TOURNAMENT_PARENT_FAN.md`](journeys/JOURNEY_J6_TOURNAMENT_PARENT_FAN.md) — DONE 2026-06-11. 12-agent walk (6 walkers + risk-targeted verify) + 26 shots + 2 design lenses. **57 findings (9 High · 30 Med · 18 Low), 1 refuted, 82 raw→57.** Headliners: **FIX-NOW PII leak — public pages + anonymous `/api/public/tournament-data` serve every team's coach email, paymentStatus, and adminNotes** (verifier-confirmed via curl; ScoreTicker/MyTeamDock re-fetch it on every game-day pageview); register page + API ignore event lifecycle (mid-tournament registrations mint junk accounts); drifted follow helpers (team-profile Follow never fires `fl-follow-change` → the My Team dock never appears from the likeliest landing page); one game simultaneously LIVE / "Pending score review" / a banked tie / PENDING depending on surface. Routing: **PUBLIC_VISUAL_REDESIGN is archived/closed — its 32 routed findings stay in the report as the candidate successor fan-experience project for Phase 5 triage**; 24 backlog incl. 3 fix-now.
- [x] J3 House league admin → [`journeys/JOURNEY_J3_HOUSE_LEAGUE_ADMIN.md`](journeys/JOURNEY_J3_HOUSE_LEAGUE_ADMIN.md) — DONE 2026-06-11. 12-agent walk + 28 shots (re-captured after a harness fix) + 3 lens passes + auditor live verification. **80 findings (1 Blocker · 27 High · 38 Med · 14 Low), 1 refuted, 109 raw→80.** Headliners: **FIX-NOW org-context bug — 78 admin API route files (121 call sites: house-league, accounting, rep-teams, members, org, public-site) resolve the org from the caller's FIRST membership row instead of the URL org** (multi-org users get Forbidden or wrong-org reads/WRITES; proven live); **Blocker child-disclosure oracle on the public status lookup**; Coaches-Portal express-interest CTA 400s (kills that plan's only acquisition channel); timezone-naive game times (prod-breaking for any live League org); the comms spine ("0 delivered" success, platform-Gmail reply path). Routing: 8 → FREE_TIER_STRATEGY §16 extension; 72 backlog.
- [x] J4 Club president (delta walk) → [`journeys/JOURNEY_J4_CLUB_PRESIDENT.md`](journeys/JOURNEY_J4_CLUB_PRESIDENT.md) — DONE 2026-06-11. 10-agent delta walk + 20 shots + desktop-primary lens + auditor live probes. **50 findings (1 Blocker · 23 High · 19 Med · 7 Low), 0 refuted, 66 raw→50.** **The franchise-model audit section formally ABSORBS the open "Rep Teams franchise model review" TODO**: the contract holds on every surface that has a UI (roster verified read-only, allocations/payment-requests correctly franchised both directions, tryouts org-driven); every violation is a UI-less side-door — the events API PATCH+DELETE remnant of hardening commit 0406d42, four routes missing owner|admin gates, a lateral coach-role GET leak, org full-write on coach-owned team ledgers. Other headliners: **FIX-NOW Next-16 sync-params breakage — 17 client pages (the program-year admin cluster + the ENTIRE premium coach accounting suite, i.e. J2's Phase-4 surfaces) fetch `/teams/undefined/...` and render dead** (live-probe proven); Blocker duplicate-General-ledger snowball (data corruption); billing-lifecycle incoherence (archive keeps billing). Routing: 5 → COACHES_EXPERIENCE_EVAL; 2 stripe items stay in-report (STRIPE_INTEGRATION_PLAN archived); 43 backlog incl. 6 fix-now.
- [x] J7 House-league parent → [`journeys/JOURNEY_J7_HOUSE_LEAGUE_PARENT.md`](journeys/JOURNEY_J7_HOUSE_LEAGUE_PARENT.md) — DONE 2026-06-11 (never walked before). 8-agent walk (incl. one live registration POST) + 22 shots + mobile-primary lens. **26 findings (1 Blocker · 4 High · 15 Med · 6 Low), 0 refuted, 54 raw→26 + 15 folded into J3-owned anchors.** Headliners: **FIX-NOW Blocker — the active in-progress season VANISHES from all public navigation once the next season opens registration** (single featured-season slot; the journey's entire in-season half unreachable; escalates J3-067); the $165 fee has no payment instructions anywhere (league seasons lack the field tournaments have); the status card never says what team the kid is on or who coaches; the "contact us" mailto reads `organizations.contact_email` — a column that exists in NEITHER dev nor prod. Routing: 7 → FREE_TIER_STRATEGY §16 extension; 19 backlog.
- Phase 3 harness additions (reusable): `scripts/journeys/run-dev-seeds.mjs` (platform-admin-session dev-seed caller), `topup-league-org.mjs` + `topup-club-org.mjs` (realistic league/club staging — the club one drives the real admin APIs), `create-journey-users.mjs` (**single-org `league-owner@`/`club-owner@dev.local` harness users — required because of the J3-012 first-membership bug**), per-shot `localStorage` support in `journey-shots.mjs` (anonymous follow-state fixtures). Staging gotchas hit: the dev-seed house-league + rep-team routes write CHECK-violating statuses/sources and silently ignore insert errors (zero rows, success logs); the dev server crashed twice under concurrent walker load (stop → clear `.next` → restart per AGENTS.md).

### Phase 4 — Deferred coach journey + light journeys (ALL FOUR WALKED + ROUTED 2026-06-13)
- [x] J2 Rep head coach team ops → [`journeys/JOURNEY_J2_REP_HEAD_COACH.md`](journeys/JOURNEY_J2_REP_HEAD_COACH.md) — DONE 2026-06-13. 6-walker code walk + risk-targeted verify + 28 shots (14 screens × 2 vp) + 2 design lenses (Basic/marketing + Premium). **38 findings (15 High · 14 Med · 9 Low), 0 refuted**, 2 internal merges + ~6 minor lens Lows folded. Headliners: the live free `/start/team` product is **unreachable from the entire signed-out marketing arc** (J2-001, AP→FTS Phase 8) while "Get Started" mints org accounts (J2-002); **"carries over automatically" is undelivered for the org-join path** — the free-floor-to-Club thesis rests on an unbuilt import (J2-024); the **marquee lineup builder has zero nav presence + a false checklist + a mobile-hostile grid** (J2-031); org coach assignment (the Premium gateway) sends no notification (J2-025); the Basic weekly loop strains for a real 14-player team (single-add roster/fees, flat schedule, instant parent blast); the now-live premium accounting suite (post-J4-001) is capable but its franchise *voice* fights its mechanics (J2-033/034/035). Routing: 8 → FTS §16/Phase 8 · 9 → COACHES_EXPERIENCE_EVAL · 10 → UNIFIED_PLAN · 10 → PHASE_5_BUILD · 1 dup (J3-007).
- [x] J8 Scorekeeper + gate volunteer (combined) → [`journeys/JOURNEY_J8_SCOREKEEPER_GATE.md`](journeys/JOURNEY_J8_SCOREKEEPER_GATE.md) — DONE 2026-06-13. 3-walker walk + verify + 18 shots + 1 lens. **23 findings (1 Blocker · 10 High · 9 Med · 3 Low), 0 refuted.** Headliners: **Sign Out is a dead `/auth/logout` 404 on BOTH volunteer shells** (Blocker J8-001); session-expiry strands the volunteer with no sign-in control (J8-002); the cross-org volunteer URL is an infinite login loop (J8-018); the gate roster Edit is a destructive delete-all + re-insert that rewrites coach provenance + drops DOB/position/notes (J8-010); the field score sheet's inputs are invisible with no steppers + a skippable policy note (J8-007/008); the role-to-surface mapping is backwards (official → blank admin hub, staff → full dashboard). **No active plan owns the volunteer shells** — J8 is the source of truth + a candidate "Volunteer day-of experience" fix project for Phase 5. 2 in-report · 21 backlog.
- [x] J9 House-league team coach → [`journeys/JOURNEY_J9_HOUSE_LEAGUE_COACH.md`](journeys/JOURNEY_J9_HOUSE_LEAGUE_COACH.md) — DONE 2026-06-13. Confirmed the premise: **the platform has no surface for a house-league coach** (he exists only as `league_teams.coach_name` TEXT). Per owner direction, the report **pivots to a constructive UX-upgrade recommendation set** — each coach job mapped to a named existing primitive. 2-walker walk + verify + 18 shots + 1 lens. **16 findings (8 High · 6 Med · 2 Low), 0 refuted**; 3 structural roots deduped to J3-061. The recommendation set: **J9-010 keystone** = `coach_email` on `league_teams` + claim-by-email (reuse `coachPortalUrl`), then roster read (`league_registrations`), practices read (`league_practices`), rainout notify (`lib/notify.ts` `userIds`), score report (scorekeeper pattern) — all *already built and merely admin-gated*. Fix-now defects independent of the portal: the coach-role "No team assignments yet" dead-end promise (J9-002) + the module-cap over-grant that leaks ALL guardian PII (J9-003). Routing: 3 → FTS §16 · 6 → COACHES_EXPERIENCE_EVAL · 1 → UNIFIED · 5 backlog.
- [x] J10 Invited org staff admin (checklist) → [`journeys/JOURNEY_J10_INVITED_STAFF_ADMIN.md`](journeys/JOURNEY_J10_INVITED_STAFF_ADMIN.md) — DONE 2026-06-13. 4-walker walk + verify + 26 shots + 1 lens. **27 findings (6 High · 14 Med · 7 Low), 0 refuted.** Verdict: the Admin Role Parity *policy* is sound + the gates largely hold for `admin`, but the *experience* fails — **no day-one orientation** (J10-015) so correct-scoping reads as breakage, and owner-only walls use **3 inconsistent styles** that should converge on the settings-hub locked card (J10-013/016). Net-new bugs the parity build left open: **`GET /api/admin/members` is ungated** (any member reads every email + capabilities map, J10-002); the **multi-club invite 409** blocks the exact second-in-command the coach funnel creates (J10-001); a **fresh tournament-tier admin redirect loop** (J10-014); acceptance is advisory (J10-006); the suspended-member silent infinite login loop (J10-019). The Tournament-tier Audit Log button **hard-404s** (J10-003). Routing: 8 → ADMIN_ROLE_PARITY · 3 → USER_MANAGEMENT_TOURNAMENT_UX · 7 in-report · 9 backlog.
- Phase 4 harness additions (reusable): `scripts/journeys/{j2,j2b,j8,j8b,j9,j9b,j10,j10a-d}-shots.json` specs; the single-org Phase-4 users (`j2-coach@`/`j2-rep-coach@`/`j8-scorekeeper@`/`j8-gate@`/`j9-coach@`/`j10-admin@`/`j10-owner@`/`j10-admin2@`/`j10-club-admin@dev.local`, devpass123 — required by J3-012) staged via `create-journey-users.mjs`-style scripts; `journey-shots.mjs` interaction-shot pattern (open a modal/sheet then scroll-to-heading) for click-dependent states. **Total Phase 4: 104 findings (3 Blocker · 39 High · 43 Med · 19 Low), 0 refuted across all risk-targeted verification.**

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
- [x] J9 may collapse to a 1-page report if the house-league coach surface is genuinely email-only — **RESOLVED 2026-06-13:** the surface IS email-only (coach has no identity), but per owner direction the report is a full report that pivots to a constructive UX-upgrade recommendation set grounded in existing primitives (16 findings, not a 1-pager). Did not merge into J3.
