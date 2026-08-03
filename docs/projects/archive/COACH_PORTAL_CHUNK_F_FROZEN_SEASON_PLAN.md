# Coach Portal — Chunk F: The frozen past season — Implementation Plan

> **Status:** ✅ **BUILT ON DEV 2026-08-01, UNCOMMITTED — awaiting owner QA.**
> All seven decisions settled; mockups approved ("looks good, go ahead", rev 3), with the two
> open items taken **as drawn** (tappable chip on a phone · the one line of text on Staff) — both
> trivially reversible at QA if the owner meant otherwise.
> Gate: typecheck 0 · `npm test` **730/730** · focused lint 0 errors · all six colour baselines
> **ZERO** · date ratchet ZERO · **no migration** (as predicted). Schema-parity ✖ and the residual
> typecheck errors are **another agent's untracked practice-plan work**, not this chunk.
> Mockups artifact: `16ff15b9-09f5-4063-81f1-36b673d06adf` — **revision 2** is the current spec.
> Created 2026-07-31. Baseline: `dev` level with `origin/master` @ `beb953ca` (clean).
> Handoff prompt: `COACH_PORTAL_CHUNK_F_FROZEN_SEASON_BUILD_PROMPT.md`. Ledger: `PROGRAM_COACH_PORTAL.md` §1.1 (chunk F) + §1.5.

---

## 0. Ground-truth verification — SEVEN corrections (read this before anything else)

The handoff prompt told me to verify, not trust, and it was right to. Five of the claims that shape
the estimate are wrong, and two of them are wrong in the direction that breaks the design.

| # | Claim (from §1.5 / the build prompt) | **Verified reality** | Impact |
|---|---|---|---|
| **C1** | "the season-READ resolver… capabilities resolved from the SEASON'S OWN assignment row — rule 1 falls out of this design" | ❌ **FALSE.** `lib/coach-season-read.ts` takes **no year parameter at all**. It returns the team's *active* assignment's capabilities, else the **newest closed** one (`getClosedCoachingAssignmentsForUser` sorts newest-first and the resolver takes `.find()`). | **Governing rule 1 does NOT fall out of the design.** Viewing 2023 with a 2025 assignment today grants 2025's capabilities. Making rule 1 true is *new work at the centre of the chunk*, not a freebie. This is the biggest correction. |
| **C2** | "`resolveCoachContext` — the ~49 write routes' resolver" | ❌ **There is no shared resolver.** `resolveCoachContext` is a **locally-declared function copy-pasted into ~53 route files**. | There is **no single chokepoint** to add a year guard to. Any portal-wide rule must be enforced by a rail the routes *opt into*, plus a test that proves they did. |
| **C3** | "per-row read-only past-season write guards exist (partial)" | ⚠️ **True but the reason is misunderstood.** Closed-season writes are refused **structurally**, not by a guard: every write route resolves the assignment through the *active-only* lookup (→403) and then `getActiveRepProgramYear` (→404). The three per-row guards exist only to catch a *past row id* passed to a *rolled-forward* team. | ⚠️ **The structural refusal evaporates the instant any route learns to accept a year.** F does not inherit write safety — F must build it. |
| **C4** | "roster, schedule, lineups, attendance, money, documents, awards and staff have **no year-parameterised read path at all** — genuinely new plumbing for ~8 sections" | ⚠️ **Overstated in the pessimistic direction.** The **data layer is already fully year-keyed**: `getRepRosterPlayers(programYearId)`, `getRepTeamEvents(programYearId)`, `getRepTeamAttendanceReliability(programYearId)`, `getRepTeamSeasonLineups(programYearId)`, `getRepPlayerDuesSummary(playerId, programYearId)`, `getRepTeamStaffForYear(programYearId, orgId)`. | The missing plumbing is at the **route** layer only — each route hardcodes `getActiveRepProgramYear(teamId)` then passes `programYear.id` down. Swapping the resolver is **mechanical and shaped**, not exploratory. F is cheaper than the prompt feared on reads. |
| **C5** | (implicit throughout) "a closed season" = a team whose season ended | ❌ **Two populations, and the ledger only names one.** `resolveClosedAssignment` returns **null whenever the team has ANY active assignment**. So a **rolled-forward** team (2026 active + 2025 closed) is not "closed" — and today has **no path whatsoever** to 2025's detail. | ⚠️ **Read-only must be keyed on THE YEAR BEING VIEWED, never on the team's state.** Reusing the existing shared predicate to decide read-only would silently make a rolled-forward team's archive **writable**. See D-F6 — the rolled-forward coach is the *more common* case. |
| **C6** | — | ✅ **An admin precedent exists and was not mentioned:** `/{org}/admin/rep-teams/teams/{teamId}/history/{yearId}` with genuinely year-scoped admin APIs (`program-years/{yearId}/{roster,events,coaches,tryouts}`). Org-admin-gated, so not reusable as-is by coaches — but it proves the shape and the data reads. | Lowers design risk; raises the "why don't coaches have this" fairness argument behind §1.5. |
| **C7** | "the closed-season nav — exactly two doors" | ✅ **TRUE.** `CLOSED_TEAM_NAV_ITEMS` = Season's End + Insights, shared by sidebar and bottom nav. And ✅ `isCoachNavItemVisible` is confirmed **keyed by display label** with a `default: return true` fallthrough. | Any new door named outside that switch **opens for every assistant**. Naming is a security decision here. |

**Size verdict — the chunk is LARGE, not "medium".** 33 section pages exist under the team shell
(schedule alone is 3,176 lines); 43 GET routes resolve the active year. Even with the scope cut in
D-F1 this is the biggest chunk since A. **Recommendation: accept the cut in D-F1 and call F large.**

---

## 1. What F is, in one paragraph

A coach can open any season they were on the staff of — last year's or five years back — and see the
whole portal for that season exactly as it looked, read-only: roster, schedule and results,
attendance, lineups, money records, documents, development and awards, staff. What they can see is
what their capabilities showed them *at the time*. Nothing in a past season can be changed, except
the one deliberate exception: the head coach can still manage who is allowed to look at it.

## 2. Architecture

### 2.1 The rail — one year-aware read context (fixes C1)

`lib/coach-season-read.ts` gains a year and becomes the single read rail:

```
resolveCoachSeasonReadContext(orgSlug, teamId, { yearId?: string })
  → { ctx, team, programYear, capabilities, isReadOnly }
```

- Resolves the **requested** program year; absent `yearId`, the active year, else the newest closed one.
- Finds the assignment row **for that exact program year** across active + closed lookups and takes
  capabilities from **it** — this is what makes governing rule 1 true rather than assumed.
- `isReadOnly = programYear.status ∈ {completed, archived}` — **derived from the year, never the team**
  (fixes C5).
- No assignment on that year → `403`. Rule 3's revocation therefore bites immediately and at the API,
  not in the nav.
- Contract stays **GET-only**. The existing two callers (`wrapped`, `history`) migrate to it and their
  latent capability bug (C1) is fixed as a side-effect.

### 2.2 The write guard F must BUILD (fixes C3)

Because closed-season write refusal is structural and F dissolves the structure:

1. Write handlers keep their existing local `resolveCoachContext` **untouched** — they never learn
   about `yearId`, so the active-only lookup keeps refusing.
2. The three existing per-row guards stay.
3. **New: a source-level test** walks every file under `app/api/coaches/**` and fails if a
   `POST`/`PATCH`/`PUT`/`DELETE` handler reads a year parameter or imports the season-read rail. A
   greppable, durable proof that rule 2 holds portal-wide — cheaper and more honest than 40 runtime
   probes.
4. Runtime probe: a representative write against a closed year answers 4xx.

### 2.3 Read-only rendering

- One hook, `useSeasonView(teamId)`, derives `{ yearId, yearLabel, isReadOnly, seasons[] }` from the
  URL's `?year=` plus the assignments **already on `useCoaches()`** — the switcher needs **no new
  endpoint** (verified: the shell seeds both active and closed assignments).
- **D-F4 (owner, 2026-08-01): no band.** The read-only signal is the `2025 · Complete` chip beside
  the page title + the amber switcher + the year in the breadcrumb. The Staff screen is the single
  proposed exception (pending). Do not reintroduce a per-screen banner.
- Write controls are **removed, not disabled**, when `isReadOnly` — a greyed Save still says "you
  could have". Server-side refusal remains the real guarantee (§2.2); hiding is courtesy only.

### 2.4 Nav

- `CLOSED_TEAM_NAV_ITEMS` retires. The closed-season nav becomes **the normal nav**, capability-gated
  through `isCoachNavItemVisible`, minus the excluded sections (D-F1), with `?year=` carried.
- ⚠ **Every label used must already exist in the `isCoachNavItemVisible` switch** or be added to it in
  the same edit — the `default: return true` fallthrough is an assistant-coach data leak (C7).
- Every new door owes a help entry; the existing probe walks the rendered sidebar and will fail
  otherwise.

### 2.5 Staff — the one live write surface (rule 3)

The staff page stays operative on a past season, with its writes re-pointed at that year's assignment
rows and scoped to **who-can-see only**. This is the sole route that accepts a `yearId` on a write
verb, and it is therefore the sole exception the §2.2 test allows — declared explicitly by name.

---

## 3. Work items

| # | Item |
|---|---|
| F1 | Year-aware `resolveCoachSeasonReadContext` + migrate `wrapped` / `history` (fixes C1's latent bug) |
| F2 | Year-parameterise the in-scope GET routes (D-F1) |
| F2b | **Tryout history read paths + the M9 returning-candidate link** (D-F1 rider, §5.1) |
| F3 | The §2.2 write-guard test + closed-year write probe |
| F4 | `useSeasonView` hook + season switcher — sidebar on desktop, **More sheet on phone** (D-F3, §5.0); tappable chip as the phone exit |
| F5 | Read-only band + control removal across in-scope pages (D-F4) |
| F6 | Nav: full capability-gated door set for a viewed past season (+ label-switch audit) |
| F7 | Staff kept live on a past season, year-scoped, read-access-only (rule 3) |
| F8 | Landing behaviour for a past season (D-F2) |
| F9 | Help content for every door reachable in a past season |
| F10 | Probe spec `coach-frozen-season-smoke.spec.ts` — incl. the **revoked assistant refused at the API** |
| F11 | Ledger §1.1 + §1.5 tick, `memory/design_decisions.md` entry, `/docs` sync |

**No migration expected** — every table is already `program_year_id`-keyed.

## 4. Risks

- **R1 — the leak class that has bitten four chunks running.** Every new read path is a former
  team-mate's data. Probed as the read-only assistant *and* as a revoked assistant.
- **R2 — label-keyed nav gate** (C7): a door named outside the switch opens for everyone.
- **R3 — write safety is being rebuilt, not inherited** (C3). The §2.2 test is the mitigation.
- **R4 — scale.** 33 pages. The D-F1 cut is what keeps one-pass delivery honest.

## 5. Decisions — owner ruling 2026-08-01

| # | Ruling |
|---|---|
| **D-F1** | ⚠️ **CHANGED from the recommendation — tryout history is IN.** Owner rationale: turnout trend over years, and a returning candidate who didn't make the team last time. **In:** Season's End · Roster · Schedule/results · Attendance · Lineups · Money records · Documents · Development/awards · **Tryout history** · Insights · Staff. **Out:** Chat · Email families · Settings · the *machinery* of running a tryout (check-in, evaluator links, recording decisions, offer emails). Verified feasible: `getRepTryout(programYearId)` → sessions/rubric/scores are all year-keyed, and `getRepTeamPriorSeasonIdentities` (the Chunk E "Returning player" matcher) **already spans prior years and already includes prior-year tryout registrations** — i.e. candidates who did NOT make the team. That is the rail for M9. |
| **D-F2** | ✅ Accepted. Season's End is the past season's front door. **Chunk I's resolver is not touched** and gains no closed-season state. |
| **D-F3** | ⚠️ **CHANGED by the owner 2026-08-01 — the switcher does NOT appear on a phone's pages.** Owner rationale: history is checked a few times a season; that row was charging rent on every screen. **Follow the tournament-switcher precedent exactly** — `AdminSidebar` renders it in the sidebar ("Editing Tournament"), `AdminBottomNav` renders it inside the **More** sheet under a `blockLabel`. Coach equivalent: sidebar on desktop; on phone a **"This team's seasons"** block in the More sheet, placed directly under the existing **"Your teams"** switcher in `CoachesBottomNav` (which already has a `Season complete` sub-group — see the rider below). 🕐 **One item open:** on a phone the `2025 · Complete` chip moves into the header line beside the team name and becomes **tappable** — the exit from a past season, at zero vertical cost. Owner to confirm, or keep it a plain label with More as the only route both ways. |
| **D-F4** | ⚠️ **CHANGED — the amber read-only band is CUT.** The `2025 · Complete` chip beside the page title carries it, with the amber switcher and the year in the breadcrumb as supporting context. Owner rationale: coaches who toggle to a past season learn the convention fast. Write controls are still **removed, not disabled**. 🕐 **One exception still open:** the Staff screen keeps a single explanatory line in the mockup, because that screen contradicts the chip (season complete + buttons that genuinely work). Owner to keep or cut. |
| **D-F5** | ✅ Accepted. No cut-off; every season the coach was on the staff of. Switcher hidden entirely when there is one season. |
| **D-F6** | ✅ Accepted — **rolled-forward teams are in scope and are the primary case.** |
| **D-F7** | ✅ Accepted. Money records in (dues ledger, expenses, budget, budget-vs-actual, fundraiser results); instruments out (payment requests, allocations, generating installments). This same records/instruments line now governs tryouts per D-F1. |

### 5.0 Switcher-placement rider (D-F3)

- **Precedent to mirror, not reinvent:** `components/admin/AdminSidebar.tsx` (desktop, "Editing
  Tournament" `<select>` + `.switcherLabel`) and `components/admin/AdminBottomNav.tsx` (mobile,
  `.tournamentBlock` / `.blockLabel` "Current tournament" — note its CSS classes are already named
  `.seasonSelectShell` / `.seasonSelect`).
- **Mobile home:** `components/coaches/CoachesBottomNav.tsx` already renders a **"Your teams"**
  switcher inside More, gated on `assignments.length + closedAssignments.length > 1`. The season
  block goes immediately below it, gated on that team having >1 season.
- ⚠️ **Pre-existing confusion this creates and must resolve:** that team switcher already shows a
  **"Season complete"** sub-group — but those entries are *teams* whose season ended, not seasons.
  Once seasons are first-class in the same sheet, two adjacent groups both saying "season" will read
  as the same thing. **Fold the closed-team entries back into "Your teams"** (they are teams) and let
  the new block own the word "seasons". Same treatment in `CoachesSidebar.tsx`.
- **No switcher renders in page content on any breakpoint.** The `2025 · Complete` chip is the only
  in-page indicator; on phone it relocates into the header line beside the team name.

### 5.1 Tryout-history rider (new work from D-F1)

- Read paths: tryout overview (turnout + prior-year comparison), candidate list with decisions,
  per-candidate evaluations/scores. All resolve through the same year-aware read rail (§2.1) and gate
  on the **`tryouts` capability recorded against that season's assignment row**.
- **M9 — the returning candidate.** In the LIVE season's candidate list, a `History` column linking a
  returning person to their prior-year record, opened **in place** so the coach never loses their
  position in a live tryout. Reuses the existing prior-season identity matcher; no new matching logic.
- **Excluded (instruments):** check-in, evaluator link issue/reissue, self-score, rubric edits,
  decision writes, offer emails.
- ⚠️ **Data-sensitivity note (recorded, no owner action requested):** evaluations are written
  judgements about other people's children, often children who were declined, now persisted and
  surfaced across years. Two existing constraints keep it proportionate and must be preserved:
  (a) the per-season capability rule means only coaches who held tryout access **at the time** can
  read them — a newly-added assistant cannot browse a stranger's old evaluations; (b) evaluations open
  **in place beside a live candidate**, not as a standalone browsable dossier. Do not add a
  cross-season "candidate dossier" surface without a fresh owner ruling.

## 5.2 What was actually built (2026-08-01)

| # | Delivered |
|---|---|
| F1 | `lib/coach-season-read.ts` rewritten: takes a year, resolves it first, takes capabilities from **that season's** assignment row, returns `{ programYear, capabilities, isReadOnly }`. `seasonParam()` + `resolveCoachSeasonRead(orgSlug, teamId, req)` are the GET entry points. `wrapped` + `history` migrated (both had latent rule-1 bugs; `wrapped` additionally let a coach open a season they were never on). New `resolveCoachSeasonCapabilityMap` gates the Insights archive **per season**. |
| F2 | ~20 in-scope GET routes converted (roster · events · attendance · dues · expenses · budget · budget-plan · budget-vs-actual · money-summary · season-surplus · fundraisers · awards · award-types · milestones · staff · tags · expense-tags · lineup-templates). ⚠ **`awards` gated its capability INSIDE its resolver** — the scripted conversion dropped it; restored explicitly in the GET with a comment naming the trap. |
| F2b | New `tryout-history` archive route (turnout + prior-year comparison + decisions + evaluations); live `tryout-candidates` GET now returns a `returning` map built from the **existing** prior-season identity matcher; check-in rows carry a quiet "Tried out in 2025" marker (**not** a link — the row is a tap-to-check-in target). |
| F3 | `tests/unit/coach-season-write-guard.test.ts` — 8 assertions incl. vacuous-pass guards, the label-switch gate, and the tryouts-door-points-at-the-archive rule. |
| F4 | `lib/coach-season-view.ts` (pure, unit-tested) + `seasons` on the coaches context, SSR-seeded. ⚠ **The plan's claim that "the switcher needs no new endpoint" was wrong** — the assignments API deduped closed seasons to one-per-team and dropped rolled-forward teams entirely. Added a third `seasons` array from the two lookups already in flight. |
| F5 | `CoachSeasonChip` + write flags routed through `page.canWrite()` on roster · schedule · attendance · lineups · accounting · documents · development · staff. |
| F6 | `CLOSED_TEAM_NAV_ITEMS` opened from 2 → 11 doors, capability-gated; sidebar + bottom nav both carry the season; the More sheet's "Season complete" team group renamed **"No live season"** so it can't be confused with the new seasons block. |
| F7 | Staff operative on a past season via `readAccessOnly` — invite form gone, capability controls become a read-out, `Remove access` stays; the one explanatory sentence. |
| F8 | Season's End is the archive's front door; new `/tryouts/history` page. |
| F9 | `premium-season-end` rewritten + **28 new archive keywords** (search matches keywords, NOT body); new `premium-tryout-history` guide + 2 FAQs. |
| F10 | `tests/uat/scenarios/coach-frozen-season-smoke.spec.ts` — rule 1 (assistant with money NOW refused the past season's money, at the API), rule 3 (**revoked coach refused by the server**, across four routes), rule 2 (write refused + no controls drawn), the rolled-forward case, the walked-nav help rule, and 361px. |

### 5.2b `/simplify` + `/review` round (2026-08-01) — what they found and what changed

`/simplify` (4 lenses) and `/review` (5 lenses, high-risk tier) both ran. **The review found two
Criticals and one systemic defect; the owner chose to finish the chunk properly rather than ship a
narrowed archive.**

**Applied from `/simplify`:** one shared season-switch rule replacing three hand-copies (the phone's
More sheet had silently disagreed — it always landed on Season's End instead of keeping your place) ·
`seasonQueryFor` / `buildCoachSeasons` / `seasonStatusLabel` extracted so the year parameter is named
once · the chip menu moved onto the shared `useAnchoredMenu` (it was hand-positioned and would clip
on a 361px phone) · history route stopped double-fetching the same assignment lists · team +
program-year lookups parallelised in the rail (every coach GET) · tryout-history's prior-turnout
query folded into its parallel batch · **~120 lines of dead local resolvers removed from 7 routes** ·
the write-guard test's filename corrected in the rail's own comment (it named a file that doesn't
exist, so the safety claim read as unfounded).

**CRITICAL 1 — the four converted loaders never refetched on a season switch.** `attendance`,
`schedule`, `lineups` and `accounting` interpolated the season into their fetch URL but omitted it
from the `useCallback` deps, so switching seasons repainted the *label* and kept the *data*. Roster
(hand-written) had it right; the scripted conversions did not. **Fixed, and the probe gap that hid it
is now covered** — every other probe used `page.goto()`, which remounts and masks it.

**CRITICAL 2 — the archive's Staff screen wrote to the LIVE season.** `staff/[coachId]` resolved the
team's ACTIVE program year and matched the target against it, so on a rolled-forward team "Remove
access" deleted the assistant's **live** assignment while the copy promised it only affected who
could view the archive; on a fully-closed team it 404'd. **Governing rule 3 was not delivered.**
Fixed properly: the resolver now resolves the TARGET'S OWN season, checks head-coach authority
**against that season**, permits DELETE (revoke read access) on a closed year, and **refuses PATCH**
with a 409 — the stored grants are the historical record rule 1 reads back, so editing them would
rewrite the past rather than change who can look.

**SYSTEMIC — the archive was correct only at hub level.** Eleven doors opened; the pages beneath
them still resolved the live season, several with full write UI. All closed:
| Leak | Fix |
|---|---|
| Money hub cards dropped the season → Expenses/Dues/Budget/Fundraisers/BvA resolved the LIVE year with write controls (a coach could log a real expense against the wrong season) | the `card()` helper now carries the season structurally; all five sub-pages converted, their write flags routed through `canWrite`, chips added |
| Org allocations + payment requests offered on a finished season | hidden in an archive (D-F7 — instruments, not records) |
| Roster → player detail dead-ended on "No active program year" | route + page season-scoped; the player must belong to the season being read |
| Lineups → game detail same dead end; "New template" offered in an archive | lineup GET season-scoped; template creation gated through `canWrite` |
| Schedule slide-over drew Edit / Cancel / Delete in an archive | whole action block hidden unless the season is writable |
| Development showed LIVE data under a "2025 · Complete" chip (route never converted) | sessions + board season-scoped; continuity deliberately left live-season-only (it requires write capability and reconciles the CURRENT season against priors — an instrument) |
| Client picked the first "live" season, server picked the newest-created — a team mid-rollover (draft + active) could label one season and load another | `programYearYear` added to `CoachingAssignment`; the client now picks the newest live season. Unit-tested. |
| Tryout history reported `waitlisted` / `pending_review` as "No decision recorded" — rewriting a real decision as no decision, on the one screen that exists to say what was decided | full status switch; average score now shows its sample size |

**Deliberately NOT changed** (reviewed, judged correct): the per-page `useSearchParams` + hook triplet
(a layout provider would force a Suspense boundary on ~10 pages to save 3 lines); the per-route
capability gates (pre-existing convention, and `awards` proves why folding them into a resolver is a
trap); deriving the archive nav from the live nav (attractive, but it means moving nav definitions
across module boundaries — the label-gate test already catches the dangerous half).

### 5.3 Left for the owner / next session
- **Owner QA** — nothing has been through a browser. Every chunk since A found its worst defect on a real phone.
- **The probe has not been RUN** (needs the dev server + service-role env); it is written to the newest exemplar's conventions.
- **Not converted** (deliberate, D-F1/D-F7 — instruments, not records): payment requests · allocations · upcoming payables · accounting settings · payees · installment generation · the six live tryout endpoints · chat · email families · settings.
- ⚠ **Concurrent work in this tree:** `lib/rep-practice-plan.ts` + `app/[orgSlug]/coaches/teams/[teamId]/practice/` are **untracked** and currently do not compile; `development/sessions/[sessionId]/route.ts` has foreign uncommitted edits. They are the sole cause of the residual typecheck errors and the schema-parity ✖. **Do not stage them.**

## 6. Definition of done

Approved mockups → one pass → `/simplify` → `/review` (**high-risk tier**) → `/docs` → typecheck /
`npm test` / focused lint / `verify:changed` all green with baselines unchanged → new probe passing
incl. the revoked-assistant case → 361px measured → fresh dev restart → owner QA → commit on `dev`
with per-action OK → §1.1 + §1.5 ticked + design-decision entry.
