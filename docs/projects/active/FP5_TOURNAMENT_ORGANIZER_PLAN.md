# FP-5 — Tournament Organizer Experience (Implementation Plan)

**Branch:** `dev` — the single shared branch for ALL chats (owner decision 2026-06-15; FP-5 was consolidated onto `dev` by merging `fix/fp3-volunteer-dayof` in). No per-initiative branches; see `AGENCY_RULES.md` → Branch and Deployment Policy.
**Status:** Clusters 1 (bracket-math trust), 2 (false strings), 3 (live game day), and 4 (wizard / Event Settings mental model) BUILT on `dev`; **Cluster 4 browser-verified COMPLETE 2026-06-16** (fees OPTIONAL to activate + UX refinements + orgSlug-save + contact-gate consistency fixes). **Cluster 5 (registrations + staffing + discovery) IN PROGRESS — Registrations sub-cluster (J1-066/067/068/069) BUILT + BROWSER-VERIFIED 2026-06-16 (`f4513c0`); test fixture `scripts/seed-fp5-cluster5.mjs`. Staffing (J1-077/078/080) NEXT; discovery (J1-001–004) after.**
**Source of truth:** `docs/projects/active/journeys/JOURNEY_J1_TOURNAMENT_ORGANIZER.md` (118 findings) + `docs/projects/active/USER_JOURNEY_AUDIT_SYNTHESIS.md` (§FP-5).
**Wave:** Audit Wave-2. FP-1 (Trust & Integrity) and FP-3 (Volunteer Day-of) complete; FP-5 is the largest Wave-2 project.

---

## 0. Re-verification snapshot (2026-06-15, against current code)

The J1 audit walked the code 2026-06-10; the tournament section has had heavy work since and **most file refs moved**. Every cluster was re-verified before planning. Results:

| Finding | Audit ref | Status now | Current location |
|---|---|---|---|
| J1-083 ties advance away team | lib/db.ts | **PRESENT** | `lib/db.ts:1800` `(home\|\|0) > (away\|\|0) ? home : away` — no tie guard |
| J1-084 coin toss no re-seed | divisions/route.ts | **PRESENT** | `app/api/admin/divisions/route.ts:343-346` persists `coinTossResults` only; never re-runs seed resolution (`lib/db.ts:1846-1888`) |
| J1-091 no forfeit handling | — | **PRESENT (missing)** | no forfeit action anywhere |
| J1-043 wrong Public URL | dashboard | **PRESENT** | `app/[orgSlug]/admin/tournaments/dashboard/page.tsx:1801` emits `/{org}/tournaments/{slug}`; real route is `/{org}/{slug}` → 404 |
| J1-045 contact-privacy bypassed | news/rules/home | **PRESENT** | `news/page.tsx:26`, `rules/page.tsx:27`, `TournamentHomeContent.tsx:55-59` use raw `tournament.contactEmail ?? org.contactEmail`; skip `resolveTournamentContactEmail(…, 'public')` (`lib/db.ts:2471`) |
| J1-103 archive modal wrong | dashboard | **PRESENT** | `dashboard/page.tsx:1776` "Archiving seals… cannot be undone" — sealing is a separate Plus action; archive IS undoable |
| J1-087 results empty-state false promise | results | **PARTIAL** | `results/page.tsx:761-766` fires "scores appear live / no refresh" when `games.length === 0` incl. no-schedule-built |
| J1-100 champion on game-day board | dashboard | **PARTIAL** | `dashboard/page.tsx:1558-1575` crowns champions only inside `{isCompleted && …}`; API computes live (route.ts:287-302) but UI waits for `status==='completed'`, not final-goes-final |
| J1-065 single-team email literal names | — | **DONE — dropped** | `registrations/[id]/route.ts:62` resolves real names + routes via `resolveTournamentContactEmail` |
| J1-076 publish unreachable in playoffs | — | **DONE — dropped** | reworked to division-scoped `scheduleVisibility` "covers both stages" |
| J1-028/029/030/032 wizard / Event Settings | — | **PRESENT** | see Cluster 4 |
| J1-085/086/047/097 live game day | — | **PRESENT** | see Cluster 3 |
| J1-066/067/068/069 registrations | — | **PRESENT** | see Cluster 5 |
| J1-077/078/080 staffing | — | **PRESENT** | see Cluster 5 |
| J1-001/002/003/004 discovery | — | **PRESENT** | see Cluster 5 |

**Owner decision 2026-06-13:** bracket math stays in FP-5 — do NOT route back to FP-1.

---

## 1. Forfeit data model (owner decision 2026-06-15)

**Chosen: `status='forfeit'` + winner recorded in score; no migration.**

- `games.status` has **no DB CHECK** (app-level `GameStatus` enum only — `lib/types.ts:620`). Add `'forfeit'` to the enum → **no migration**, no DATA_DICTIONARY/snapshot churn for a new column. *(Dictionary `games.status` enum note WILL be updated to list `forfeit` — schema=dictionary same unit of work; this is a doc edit, not a migration.)*
- A forfeit game records a nominal win for the present team (e.g. home present, away no-show → `home_score = <forfeit margin>`, `away_score = 0`, `status = 'forfeit'`). Win/Loss **counts**.
- The tie-breaker engine **excludes `status==='forfeit'` games from RF / RA / RD** so invented margins can't poison seeding. W/L/pts still count (a forfeit is a real loss for the no-show).
- Forfeit margin convention: configurable later; V1 uses a small fixed nominal (decided in build, documented in code comment) — but since RF/RA/RD ignore it, the exact number is cosmetic.

---

## 2. Phasing — one reviewable commit per cluster, correctness first

### Cluster 1 — Bracket-math trust  *(start here; "wrong champion" risk)*
**Findings:** J1-083, J1-084, J1-091. **Commit:** `fix(bracket): tie guard + coin-toss re-seed + forfeit (J1-083/084/091)`

1. **J1-083 — tie on elimination game.** `lib/db.ts:1790 advancePlayoffs`. On an elimination (playoff) game where `homeScore === awayScore`, do NOT advance either team — leave the next slot's placeholder unfilled and surface the unresolved state. Reconcile with the dashboard champion logic (which already skips tied finals), so admin board + bracket agree. Decide: block tie at score-submit for playoff games, or allow-but-don't-advance + flag. (Build choice: allow save, do not advance, flag "tie — needs decision"; ties on pool games are legal and untouched.)
2. **J1-084 — coin toss re-seeds.** `app/api/admin/divisions/route.ts:290-348`. After persisting `coinTossResults`, re-run the seed-resolution pass so an already-filled bracket re-resolves. Cleanest: extract the seed-fill block (`lib/db.ts:1846-1888`) into a reusable `resolveAndFillPlayoffSeeds(divisionId, …)` and call it from both `advancePlayoffs` and the coin-toss record action. Re-resolution must only re-point slots whose source is still seed/pool placeholders (don't clobber games already played).
3. **J1-091 — forfeit action.** Add a "Mark forfeit" admin action (score-entry / game-detail surface) that sets `status='forfeit'` + nominal winner score. `lib/tie-breakers.ts:152-200` excludes `status==='forfeit'` from the RF/RA/RD accumulation (currently filters `completed|submitted`; forfeit counts for W/L only). `advancePlayoffs` treats a forfeit winner as the advancing team.

**Engines are pure / unit-testable** — `lib/playoff-bracket.ts` + `lib/tie-breakers.ts`. **Add regression tests** (`tests/unit/`):
- tie on elimination game → no advance / flagged.
- coin-toss recorded → re-seed re-points the bracket slot.
- forfeit game → excluded from RF/RA/RD; still counts as W/L.
- Run: `node --experimental-strip-types --test tests/unit/tie-breakers.test.ts tests/unit/playoff-bracket.test.ts` (verified working, Node v24 strips TS natively; existing 23 tie-breaker tests pass).

> ⚠ `lib/db.ts` is a shared module → run `npm run typecheck` and **restart the dev server** after this cluster.

### Cluster 2 — False strings  *(go-live trust)*
**Findings:** J1-043, J1-045, J1-103, J1-087. **Commit:** `fix(tournament): honest go-live links + privacy + confirm copy (J1-043/045/103/087)`

1. **J1-043** — `dashboard/page.tsx:1801`: drop the `/tournaments/` segment → `.../{currentOrg?.slug}/{currentTournament.slug}` (canonical public route, confirmed against 14 call sites).
2. **J1-045** — route the three public pages through `resolveTournamentContactEmail(tournament.id, org.contactEmail ?? null, 'public')`:
   - `app/[orgSlug]/[tournamentSlug]/news/page.tsx:26`
   - `app/[orgSlug]/[tournamentSlug]/rules/page.tsx:27`
   - `components/public/TournamentHomeContent.tsx:55-59` (home — trace its data source; likely `lib/public-tournament-data.ts:113` already resolves correctly — verify home uses that path, fix only the raw fallbacks).
   This honors `contact_show_on_public` (a privacy toggle currently silently bypassed) AND resolves the member-contact email.
3. **J1-103** — `dashboard/page.tsx:1776`: rewrite Archive confirm. Truth: archive is **undoable** (read-only, appears under Past Tournaments, can be restored); "sealing" is a separate Plus action and is NOT what archive does. New copy states the real consequence without the false "cannot be undone / seals permanently."
4. **J1-087** — `results/page.tsx:761-766`: distinguish **no schedule built** (don't promise live scores — point to the schedule/generator) from **built but unscored** (the existing "scores appear live" copy is correct).

### Cluster 3 — Live game day
**Findings:** J1-085, J1-086, J1-047(admin scope only), J1-097(admin scope), J1-100. **Commit:** `fix(gameday): live now-board + auto-refresh + live champion (J1-085/086/100…)`

- **J1-100 (PARTIAL → finish):** `dashboard/page.tsx:1558-1575` — crown the champion the **moment the final game goes final** (API already computes it live, route.ts:287-302), not only when `status==='completed'`. Show a champion chip in the active/game-day board state. *(Coordination: public-final champion render is FP-2's J1-112 — do NOT touch the public side here.)*
- **J1-085:** add a live "what's on right now" scorecard to the game-day board (`dashboard/page.tsx:1447-1537`) — current game(s), where, score.
- **J1-086:** the board gauges are one-shot `useEffect` (no polling) → add a bounded auto-refresh (poll interval) for the game-day board / check-in / results so live numbers don't freeze. Keep it cheap (visibility-gated).
- **J1-047 / J1-097:** admin-surface scope only (public hero scorebug + mobile "today" view are public; confirm FP-2 boundary before touching — likely TRIM from FP-5 if purely public). Re-confirm at build time.

### Cluster 4 — Wizard / Event Settings mental model
**Findings:** J1-028, J1-029, J1-030, J1-032. **Commit:** `fix(wizard): fee step + settings summaries + consistent activation gate (J1-028/029/030/032)`

- **J1-028:** wizard venue step (`app/[orgSlug]/admin/onboarding/page.tsx:2106-2154`) asks only name/address/notes and auto-creates exactly one facility (`venues/route.ts:408-415`); Generator then says "one scheduling lane" with no fix path. Add field/lane count to the venue step (or a clear pointer to where to add lanes).
- **J1-029:** all six `CollapsibleCard`s in `settings/event/page.tsx` are `defaultOpen={false}` with no value-summary; add a collapsed-state summary (current values) so the wall is scannable. Consider `?card=` anchor support.
- **J1-030 + J1-032 (the inconsistency):** the dashboard launch checklist gates on `hasFees` (`tournament-dashboard/route.ts:227,587`) but (a) the wizard `STARTUP_ORDER` has **no fee step** (`onboarding/page.tsx:24`) and (b) the server `set-status → active` blockers (`tournaments/route.ts:348-357`) never check `fee_scope`. Three activation surfaces disagree with the checklist. **Decide one model:** either fees are required to activate (add to wizard + blocker) or fees are optional (drop from checklist `ready`). Make all surfaces agree. *(This is a product call — surface in build for owner confirm.)*

### Cluster 5 — Registrations + staffing + discovery + design-visual
**Findings:** J1-066/067/068/069, J1-077/078/080, J1-001/002/003/004, + J1 design-visual mobile set. **Commit(s):** split as sensible (likely 2-3 commits — registrations; staffing; discovery/visual).

- **J1-066:** accept (bulk `bulk/route.ts:236-238` + single `registrations/page.tsx:1166`) sets status but never claims a slot; `unplaced` attention bucket is `plusOnly` so free orgs can't see the gap. Wire slot-claim on accept (or surface unplaced on free tier).
- **J1-067:** dashboard deep-links use `?payment=paid` but `registrations/page.tsx:1369-1370` only reads `attention`/`division` → add `payment=` param handling.
- **J1-068:** the payment money-strip (`paymentSummary` computed `registrations/page.tsx:1066-1097`; CSS `.paymentPanel` etc. exists) is **never rendered** — render it.
- **J1-069:** payment-instructions textarea defaults to a generic placeholder, never loads `tournament.settings.payment_instructions` (the field the bulk route actually emails) — fetch the real value.
- **J1-077:** member invite (`members/invite/route.ts:80-84`) only routes `official → /scorekeeper`; no check-in/gate path, no purpose-picker. Add staffing purpose options.
- **J1-078:** free-tier scorekeepers consume one of 3 seats (`plan-config.ts:37-39`) while Plus has `officialsFreeSeats`. (Product/billing call — likely **document & defer**, flag to /billing; not obviously a bug to fix in FP-5.)
- **J1-080:** no day-of staff kit / QR panel exists. (Net-new feature — scope/triage; likely a thin "staff links" panel reusing existing official/check-in layouts, or defer.)
- **J1-001/002/003/004:** public discovery — dead footer links (`/status`,`/docs`,`/contact`), `prefers-reduced-motion`/no-JS fallback for `.animateIn`, footer wordmark `FIELD|LOGIC` → `FIELDLOGICHQ` + stale tagline, no imagery/demo on discovery pages. *(Cross-check FP-2 / marketing footer-review memory before editing the footer — `marketing_footer_review` is paused; coordinate so we don't collide.)*

---

## 3. Coordination seams (do NOT cross)

- **J1-112 public-final champion → FP-2** owns the public render. FP-5 owns the **admin** J1-100 only.
- **completed/summary IA → DASHBOARD_SUMMARY_IA** (already built) — don't rework.
- **register-during-closed-event → FP-2** (J6-035), not J1-048.
- **J1-047/097 public hero/mobile** — FP-2 territory; FP-5 keeps the admin-side equivalents.
- **J1-078 seat/billing** — coordinate with /billing.
- **J1-001..004 footer/marketing** — coordinate with `marketing_footer_review`.

---

## 4. Operational rules (per project brief)

- **Branch:** `dev` — the SINGLE shared branch for all chats (2026-06-15). Before each commit re-check `git rev-parse --abbrev-ref HEAD`; if not `dev`, `git checkout dev`. Never `git checkout -b`, never `feat/free-tier-coaches`.
- **Concurrent-work hazard:** after EVERY commit run `git show --stat HEAD`; stage explicit pathspecs (never `git add -A`); split foreign files with `git reset --soft HEAD~1` + `git restore --staged <file>`. System-reminder diffs can be STALE — verify actual file state.
- **Next 16:** read `node_modules/next/dist/docs` before route/params/proxy changes (`params` is a Promise; `proxy.ts` not `middleware.ts`).
- **Schema:** forfeit needs **no migration** (status enum is app-level). Dictionary `games.status` enum note still gets the `forfeit` value added (doc edit). If any field IS added later → migration #131 dev-first via `scripts/apply-migration-api.mjs`, update DATA_DICTIONARY + `npm run refresh:snapshots`; decide column existence from live snapshots, never migration files.
- **Verify per cluster:** `npm run typecheck` (bracket/tie-breaker engines are shared — always); `npm run lint:focused -- <files>`; pure-engine unit tests for Cluster 1. Restart dev server (stop → `rm -rf .next` → `npm run dev`; verify `/platform-admin/login?next=%2Fplatform-admin` → 200, no Supabase EACCES) after shared-module/new-file/proxy changes — batch and restart once near handoff.
- **Browser/seed testing is the user's** unless asked. **Offer `/review` after the bracket-math cluster.**
- **Tick each J1 item below with its commit ref as completed.**

---

## 5. Status ledger (tick on commit)

- [x] **J1-083** tie guard on elimination advance — pure `resolvePlayoffWinner` returns `{tie:true}` on equal non-forfeit scores; `advancePlayoffs` bails (no silent away-advance). _commit: Cluster 1_
- [x] **J1-084** coin-toss re-seed — extracted `resolveAndFillPlayoffSeeds`; `record-coin-toss` re-runs it so an already-filled bracket re-points. _commit: Cluster 1_
- [x] **J1-091** forfeit action + RF/RA/RD exclusion — `status='forfeit'` (no migration), `Mark forfeit` in scoring UI, tie-breakers exclude forfeit RF/RA/RD but count W/L; advancement fires on forfeit. _commit: Cluster 1_
- [x] **Cluster 1 unit tests** — forfeit exclusion (tie-breakers, 3 cases) + `resolvePlayoffWinner` tie guard (5 cases); 106/106 pass. _commit: Cluster 1_
- [x] **J1-043** Activate-modal Public URL — dropped the `/tournaments/` segment → canonical `/{org}/{slug}`. _commit: 3794856 (Cluster 2)_
- [x] **J1-045** contact-privacy resolver on news/rules/home — all three now `resolveTournamentContactEmail(…, 'public')`; hidden email stays hidden, designated contact resolved. _commit: 3794856 (Cluster 2)_
- [x] **J1-103** Archive confirm copy — honest "moves to Past Tournaments, read-only, restorable"; dropped false "seals permanently / cannot be undone". _commit: 3794856 (Cluster 2)_
- [x] **J1-087** results empty-state — `games.length===0` now reads "No schedule built yet" + links to Schedule; live-scores reassurance only when games exist. _commit: 3794856 (Cluster 2)_
- [x] **J1-100** live champion on admin game-day board — By Division panel crowns the champion the moment the final goes final (was gated behind isCompleted); API champion now forfeit-aware too. _commit: 71d9622 (Cluster 3)_
- [x] **J1-085** live now-board scorecard — new "Now Playing" panel (in-review + started-unscored games, score/teams/venue, most-urgent first); API returns capped liveGames. _commit: 71d9622 (Cluster 3)_
- [x] **J1-086** game-day auto-refresh — fetchStats polls every 30s, visibility-gated + refetch on refocus; gauges no longer freeze. _commit: 71d9622 (Cluster 3)_
- [x] **J1-047/097** — confirmed PUBLIC/fan surfaces (public home scorebug, public mobile "today" view) → **FP-2's domain, trimmed from FP-5**. No admin-side equivalent beyond J1-085 (Now Playing), which is built.
- [x] **J1-028** venue/lane count in wizard — wizard venue step now asks "Fields / diamonds at this venue?"; `save` action auto-creates Diamond 1…N lanes (single surface keeps the venue-named lane); generator "not enough slots" errors now point to adding fields, widening the day, or shortening games. _commit: Cluster 4_
- [x] **J1-029** Event Settings collapsed summaries — all six cards now show a current-value summary in the collapsed header via the existing `meta` slot (status/dates, format/timing, fee model, routing+contact visibility, roster, registration questions). _commit: Cluster 4_
- [x] **J1-030/032** consistent fee/activation gate — **fees OPTIONAL** (owner decision 2026-06-16): dropped `hasFees` from the dashboard `ready` gate and moved the fee item to the optional list; server activation blocker already never enforced fees and the wizard never asked — all three surfaces now agree. _commit: Cluster 4_

  **Cluster 4 `/review` (high-risk, 4 lenses) — 0 confirmed defects.** Two finder-flagged "gaps" were investigated and intentionally NOT fixed after blast-radius analysis:
  - `save-venue` action creates zero facilities — **correct by design**: the org-level Venues page (`org/venues/page.tsx`) manages facilities explicitly via its own `add-facility` UI, so a generic venue-create deliberately doesn't auto-fan-out lanes.
  - AddVenueModal has no field/diamond count — **intentionally left alone**: the tournament Venues page (`tournaments/venues/page.tsx`) already renders a full per-facility add/edit UI beside the modal ("No facilities yet — add one below…"). Adding a count input there would duplicate the facility-creation path and risk double-creating lanes. The wizard needs the count only because it has NO facility UI (fire-and-forget setup); the Venues page is the deliberate, per-facility surface.

  **Cluster 4 UX refinements + bug fixes shipped during browser testing (all on `dev`, browser-verified 2026-06-16):**
  - Wizard venue step: added **Surface type** picker (Diamond/Field/Court/Rink/Gym) feeding `facility_type` + type-based lane naming; facility explainer; **`*`-required / no-"optional"** convention across all wizard steps; added venues now render as **concise read-only rows with Edit** (not a form stack); actionable **unsaved-venue banner** (Add it / Clear form) replacing the dead-end error; composer spacing.
  - **orgSlug on wizard save calls** — `setup-tournament`/`venues`/`complete-onboarding`/`onboarding-plan`/league-save were org-context fail-closed routes called without `?orgSlug=` → 401 at Review→Save; now threaded. (`fc65306`)
  - **Contact gate consistency** — the launch checklist, server activation blocker, AND the Manage Tournaments client pre-flight all ignored `default_contact_member_id` (the primary contact mechanism per `resolveTournamentContactEmail`), falsely blocking activation for a tournament with a selected contact member. Fixed all three to accept member OR tournament email OR org fallback; also closed 3 pre-existing parity gaps (admin preview resolver bypass, populate-from-source dropping the member id, help copy). (`a3cb91e`/`d343100`/`7414d39`)
  - Test fixture: `scripts/seed-fp5-cluster4.mjs` — two-org fixture (tournament-less wizard org + draft org with member-contact-only Draft Cup); browser-verified the full Cluster 4 surface.
- [x] **J1-066** slot-claim on accept — accept (bulk + single) now claims the next open pool slot via new `lib/slot-claim.ts`; `unplaced` bucket no longer `plusOnly`; slot board always shows an "Accepted — needs a spot" section so an accepted team can never silently fall off the board on any plan. Manual slot-pick stays Plus. _commit: f4513c0_
- [x] **J1-067** `payment=` deep-link param — page now reads `?payment=paid|deposit|pending` and maps onto the payment filter (`pending`→`unpaid`); previously dropped to the unfiltered list. _commit: f4513c0_
- [x] **J1-068** render payment money-strip — `paymentSummary` now rendered via the previously-orphaned `.paymentPanel`/`.paymentMetric` CSS (with-a-fee / expected / collected / outstanding / past-due); payment-tool-gated, shown only when a fee schedule applies. _commit: f4513c0_
- [x] **J1-069** load real payment instructions — reminder message pre-fills from saved `tournament.settings.payment_instructions` (the field the email actually sends), generic fallback only when unset. _commit: f4513c0_

  **Browser-verified 2026-06-16** (owner confirmed). Test fixture: `scripts/seed-fp5-cluster5.mjs` (separate from the Cluster-4 fixture — provisions a Plus org `fp5-c5-test` with an active "Slot Cup": 2 pools × 3 slots, 4 filled / 2 open / 2 waitlisted / 1 pending, $100/$500 fee + saved payment instructions, and an invited official for staffing).

  **Re-verified 2026-06-16 against current code (all four still PRESENT before fix):** single+bulk accept set `status='accepted'` but never claimed a slot, and the only recovery (`unplaced` bucket + `promote-from-waitlist`) was Plus-gated → free-tier teams vanished (J1-066); page read only `attention`/`division`, dashboard emitted `payment=paid/deposit/pending` (J1-067); `.paymentPanel`/`.paymentMetric` CSS had 0 JSX references while `paymentSummary` computed all 5 metrics (J1-068); reminder textarea defaulted to a generic placeholder, never reading the saved instructions (J1-069). Owner decision 2026-06-16: J1-066 = **Option 1** (auto-claim on accept + always-visible unplaced safety net on every plan). Typecheck clean; focused lint 0 errors; dev server restarted (new `lib/slot-claim.ts`) + login route 200.
- [x] **J1-077** staffing purpose-picker on invite — volunteer invite now offers a **Scorekeeping / Gate / Both** purpose (no new role/migration — officials already permit both surfaces); the invite email + landing route to the chosen screen; scorekeeper⇄check-in **cross-link** added to both volunteer shells (capability-gated). _commit: (staffing)_ — browser-verify pending.
- [ ] **J1-078** scorekeeper seat policy — **DOCUMENTED & DEFERRED to /billing** (owner decision 2026-06-16): pricing decision owned by `FREE_TIER_STRATEGY`, not an FP-5 bug. Recommendation to surface: free official/volunteer seats on all tiers, cap admin/staff only. Not built here.
- [x] **J1-080** day-of staff kit — new **Staff Kit** admin page (Operations nav) handing out Scorekeeper + Gate/Check-in as **QR codes + copy-links** with a printable one-pager; `qrcode` dep added (client-side render, no URL leaves the browser). _commit: (staffing)_ — browser-verify pending.

  **Staffing plan + brief:** `docs/projects/active/FP5_STAFFING_{PLAN,PM_BRIEF}.md`. Built 2026-06-16; typecheck clean, focused lint 0 errors; dev server restarted (new files + invite-route + shared nav). Fixture `seed-fp5-cluster5.mjs` provisions an invited official.
- [x] **J1-002** AnimateIn fallback — `app/globals.css`: `.animateIn` now forced `opacity:1` under `prefers-reduced-motion: reduce` AND `@media (scripting: none)`, so no-JS users never see permanently-blank sections and reduced-motion users don't get a void-until-scroll. CSS-only, no footer touch. _commit: (discovery)_ — browser-verify pending.
- [—] **J1-001 / J1-003 / J1-004** → **HANDED TO MARKETING / FP-2** (owner decision 2026-06-16). Re-verified 2026-06-16 all still PRESENT: footer `/status`,`/docs`,`/contact` pages still 404 (no legal pages either) (J1-001); footer wordmark still `FIELD|LOGIC` + "compete seriously" anti-persona tagline (J1-003); no product imagery on the discovery surfaces (J1-004). These sit in the footer/brand pass owned by the **paused `marketing_footer_review`** memory (which already pre-wrote the exact fixes: Legal-links replacement, full FIELDLOGICHQ wordmark, community-voice tagline) and FP-2's wow track. FP-5 does NOT edit the footer — coordinate via marketing. **FP-5 effectively COMPLETE on the organizer side; these three are tracked for the marketing pass.**

**Dropped (already fixed, verified 2026-06-15):** J1-065, J1-076.
