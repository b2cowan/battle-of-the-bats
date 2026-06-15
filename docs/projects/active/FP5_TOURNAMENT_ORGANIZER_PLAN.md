# FP-5 — Tournament Organizer Experience (Implementation Plan)

**Branch:** `fix/fp5-tournament-organizer` (off `origin/master`)
**Status:** Planning complete — awaiting go-ahead to build Cluster 1.
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

- **Branch:** `fix/fp5-tournament-organizer` off `origin/master`; verified `git rev-list --count origin/master..HEAD == 0` at start. Never use `feat/free-tier-coaches`.
- **Concurrent-work hazard:** after EVERY commit run `git show --stat HEAD`; stage explicit pathspecs (never `git add -A`); split foreign files with `git reset --soft HEAD~1` + `git restore --staged <file>`. System-reminder diffs can be STALE — verify actual file state.
- **Next 16:** read `node_modules/next/dist/docs` before route/params/proxy changes (`params` is a Promise; `proxy.ts` not `middleware.ts`).
- **Schema:** forfeit needs **no migration** (status enum is app-level). Dictionary `games.status` enum note still gets the `forfeit` value added (doc edit). If any field IS added later → migration #131 dev-first via `scripts/apply-migration-api.mjs`, update DATA_DICTIONARY + `npm run refresh:snapshots`; decide column existence from live snapshots, never migration files.
- **Verify per cluster:** `npm run typecheck` (bracket/tie-breaker engines are shared — always); `npm run lint:focused -- <files>`; pure-engine unit tests for Cluster 1. Restart dev server (stop → `rm -rf .next` → `npm run dev`; verify `/platform-admin/login?next=%2Fplatform-admin` → 200, no Supabase EACCES) after shared-module/new-file/proxy changes — batch and restart once near handoff.
- **Browser/seed testing is the user's** unless asked. **Offer `/review` after the bracket-math cluster.**
- **Tick each J1 item below with its commit ref as completed.**

---

## 5. Status ledger (tick on commit)

- [ ] **J1-083** tie guard on elimination advance — _commit:_
- [ ] **J1-084** coin-toss re-seed — _commit:_
- [ ] **J1-091** forfeit action + RF/RA/RD exclusion — _commit:_
- [ ] **Cluster 1 unit tests** (tie / re-seed / forfeit) — _commit:_
- [ ] **J1-043** Activate-modal Public URL — _commit:_
- [ ] **J1-045** contact-privacy resolver on news/rules/home — _commit:_
- [ ] **J1-103** Archive confirm copy — _commit:_
- [ ] **J1-087** results empty-state (no-schedule vs unscored) — _commit:_
- [ ] **J1-100** live champion on admin game-day board — _commit:_
- [ ] **J1-085** live now-board scorecard — _commit:_
- [ ] **J1-086** game-day auto-refresh — _commit:_
- [ ] **J1-047/097** admin-scope live surfaces (confirm FP-2 boundary) — _commit:_
- [ ] **J1-028** venue/lane count in wizard — _commit:_
- [ ] **J1-029** Event Settings collapsed summaries — _commit:_
- [ ] **J1-030/032** consistent fee/activation gate — _commit:_
- [ ] **J1-066** slot-claim on accept — _commit:_
- [ ] **J1-067** `payment=` deep-link param — _commit:_
- [ ] **J1-068** render payment money-strip — _commit:_
- [ ] **J1-069** load real payment instructions — _commit:_
- [ ] **J1-077** staffing purpose-picker on invite — _commit:_
- [ ] **J1-078** scorekeeper seat policy (coordinate /billing) — _commit:_ / defer
- [ ] **J1-080** day-of staff kit panel — _commit:_ / triage
- [ ] **J1-001/002/003/004** discovery footer/motion/wordmark/imagery (coordinate marketing) — _commit:_

**Dropped (already fixed, verified 2026-06-15):** J1-065, J1-076.
