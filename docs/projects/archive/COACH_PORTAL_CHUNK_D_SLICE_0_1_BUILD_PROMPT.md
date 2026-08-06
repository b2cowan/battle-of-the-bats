# Chunk D — BUILD PROMPT, Phase 1 (Slices 0 + 1): substrate + the follower experience

> **Created 2026-08-01** at the close of the Chunk D discovery/rulings session. Paste into a
> FRESH chat. **This IS a build prompt** — discovery is done, the owner has ruled, mockups are
> approved, the strategy entry is logged. Your job is Slices 0 and 1 of
> `COACH_PORTAL_CHUNK_D_FAMILY_EXPERIENCE_PLAN.md`, nothing more.

---

## Read these FIRST, in order (the plan is the authority)

1. `docs/projects/active/COACH_PORTAL_CHUNK_D_FAMILY_EXPERIENCE_PLAN.md` — **the build spec.**
   §1 (Slice 0 table) + §2 (Slice 1 table) are your work items; §6 cross-cutting rules bind.
2. `docs/projects/active/COACH_PORTAL_CHUNK_D_FAMILY_EXPERIENCE_DISCOVERY.md` — §10 (owner
   rulings, binding), §2 (verified ground truth), §8 (constraints).
3. **Mockups artifact `2b0cbcab-9848-4a69-a0e6-a8c90cc85eb2` v3 — APPROVED = the binding visual
   spec.** Screens S2 (request page, follower path), S3 (one-list schedule + calendar row), S4
   (game page), S5 (coach Family access panel + visibility setting). Any deviation gets flagged
   in the plan's deviations section and called out at QA, mockup-rule style.
4. `docs/agents/strategy/BUSINESS_DECISIONS.md` — top entry (2026-08-01 two-tier/premium-only)
   incl. its `/billing` handoff, which YOU execute at the gate-wiring step.
5. `CLAUDE.md` + `AGENCY_RULES.md` — archive opt-in, post-edit review/simplify/docs offers,
   verification workflow, branch policy.

## Scope — exactly this, nothing else

**Slice 0 (substrate, items 0.1–0.6):** guardian-email normalization (write paths + backfill
migration) · consent ledger table · Email-families per-guardian unsubscribe (HMAC rail variant +
footer link + send-path suppression) · tryout-response page name minimization (first name + last
initial) · counsel packet as a WRITTEN DELIVERABLE for the owner (plan item 0.5 — a document, not
code) · data-dictionary/snapshot sync per migration (incl. fixing the known drift at
DATA_DICTIONARY.md:2563).

**Slice 1 (the follower experience, items 1.1–1.13):** shared no-login-token helper + rate
limiting · team family link + reset · request page (FOLLOWER path only — tier chooser renders,
but the guardian option routes to a "coming soon for guardians" hold state, clearly labeled;
guardian path is Slice 2, counsel-gated) · coach Family access panel: link controls, follower
list, batched approval queue · schedule visibility setting (staff / families DEFAULT /
public_link) enforced server-side · family team view with the ONE-LIST schedule (chronological,
no sections, anchored at next upcoming, scores on completed only, practices inline) · consumer
Following integration (verified follower plants an account team-follow) · rep-team game page +
per-game "Share game link" · standing no-login team page at public_link only · ICS feed
(per-family token at families; team token at public_link) · game-update notifications (in-app +
email ONLY — push is not honest yet, see landmines) · SW denylist + anonymous-public-invariant
extensions · adoption metrics from day one.

**Explicitly OUT:** the guardian tier (Slice 2 — blocked on PIPEDA/CASL counsel sign-off),
recap/certificates/byproducts (Slice 3), chat (Slice 4), RSVP, photos, anything Basic-tier,
anything public that names a child. The `family_links` migration DOES create the full two-tier
schema per plan §2 (so Slice 2 adds no migration), but only the follower path gets wired.

## Owner rulings that bind every line you write (discovery §10)

1. **Premium portals only.** Every family surface gates on the premium team entitlement
   (`getTeamScopedRepTeamAccess` pattern; org-native Club teams pass via org plan). Execute the
   strategy entry's `/billing` handoff: gate + `PLAN_PRICING_FACTS.md` reconciliation + drift
   check in the same unit of work.
2. **Followers are NEVER tied to a player.** `role='follower'` ⇒ `player_id IS NULL`, enforced
   by CHECK. Follower DTOs are team-level allow-lists — schedule/results/announcement-free. The
   tier boundary is a security boundary; probes cover it.
3. **Parent-initiated, coach-approved; NO public search for a team or child, ever.** The link is
   the only door. The request page shows the requester NOTHING from the roster.
4. **Visibility setting enforced at the API**, never by hiding UI. Default `families`. The
   standing team page + team ICS token exist only at `public_link`.
5. Retention play · nothing naming a child on any public surface · no pitch-by-pitch · no new
   recurring coach input required for surfaces to stay truthful.

## Ground truth you may rely on — RE-VERIFY the load-bearing ones anyway (session tradition:
every handoff so far contained at least one false claim; this one was adversarially verified but
code moves under you — concurrent sessions are active)

- Token rail: 4 near-identical implementations to factor (`lib/tryout-offer-token.ts`,
  `lib/tryout-evaluator-token.ts`, `lib/assistant-invite-token.ts`, team-workspace claims).
  None has rate limiting today — you add it in the shared helper.
- `rep_team_events` carries team-level home/away scores + result; the tournament public
  game-detail page (`app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/page.tsx` + 30s
  `GameDetailLiveRefresher`) is the pattern for the game page. `toPublicTeam()`
  (lib/public-tournament-data.ts) is the DTO-discipline exemplar.
- `fan_follows` accepts entity_type 'team' — planting the follower's account follow is a normal
  write through the existing consumer follow path (origin 'account'), NOT a new follow kind.
- ICS composition exists client-side in `lib/export/ics.ts`; the FEED (server route,
  subscribe-once) is new.
- Email = raw fetch to Resend via `lib/email.ts` (memory's "Resend SDK pattern B" is FALSE);
  unsubscribe rail = deterministic HMAC (`lib/unsubscribe-token.ts`), unrevocable per-link.
- The tryout-response page (`app/tryout-response/[token]`) renders the child's FULL name — your
  0.4 fix. Route + page both.
- `resolveCoachContext` is hand-declared per coach route (~53 copies) — your new family/coach
  routes follow the same auth chain; the coach-side family routes are live-season-only and must
  NOT import the season-read rail (they must NOT appear in `APPROVED_SEASON_AWARE_ROUTES` —
  the build fails if they do, which is correct).
- Migration numbering: **213 is taken (practice plans, dev-only, concurrent session). Check
  `supabase/migrations/` live and take the next free number(s).** Never apply anything to prod;
  dev via the established apply script; `npm run refresh:snapshots` + dictionary same unit.

## Landmines

- ⚠ **Concurrent sessions share this working copy.** Do NOT touch the practice-plans set
  (`app/[orgSlug]/coaches/teams/[teamId]/practice/`, `lib/rep-practice-plan.ts`, mig 213, its
  plan/brief) or the nav-unification set (Navbar/ConsumerNav/SiteChrome/org-public-sections/
  OrgSectionTabs/consumer-routes/globals.css and friends). `git status` before you start; stage
  **explicit `:(literal)` pathspecs only**; audit `git show --stat HEAD` after every commit;
  re-check the branch is `dev` before committing.
- ⚠ **NO commit/push without explicit per-action owner OK** (standing rule; approval never
  carries over).
- ⚠ **SW cache denylist:** `/family` (and any new authed top-level route) into
  `public/sw.js` `NEVER_CACHE_PREFIXES` in the SAME commit that creates the route — the
  /coaches PII-leak lesson. Bumping sw.js forces a client SW refresh; note it for QA.
- ⚠ **Anonymous-public invariant:** the game page + standing team page must carry zero identity
  in SSR HTML; extend `tests/uat/scenarios/anonymous-public-invariant.spec.ts` per plan 1.12.
- ⚠ **Push is NOT honest yet** (Android VAPID runbook still open) — game-update notifications
  are in-app + email only; do not wire or promise push.
- ⚠ **Timezone:** any "today / next upcoming" logic goes through `lib/timezone.ts`
  (`tournamentToday()` family) — never raw UTC date math; the date guardrail is at ZERO and
  must stay there.
- ⚠ **Design system:** no hex/inline colors (token guardrail at ZERO, all scopes); ink chip =
  primary action, lime ONLY at the account-creation conversion moment (as mocked), olive =
  links; sport-neutral copy everywhere (no innings/pitch vocabulary in family surfaces).
- ⚠ **Consumer surfaces are warm-theme + dark; style both** per the existing consumer modules;
  mobile touch floor 44px.
- ⚠ **The archive is OPT-IN** (build-enforced): nothing you add appears in past seasons; family
  links are season/team-scoped by construction; don't touch the allow-lists.
- **Probes:** copy `tests/uat/scenarios/coach-frozen-season-smoke.spec.ts` (service-role
  self-provisioning + marker prefix, asserted teardown, computed styles not screenshots, drive
  real in-app controls). Primary personas are UNAUTHORIZED: stranger/guessed URL, declined
  requester, revoked follower, follower of team A probing team B, expired/reset token,
  visibility flipped to `staff`, **follower probing any player-level route (must fail closed —
  the standing tier-boundary invariant)**, anonymous probing `/api/family/*`.

## Process (owner-mandated, unchanged)

Plan §6.7–6.8 order: build → focused verification (`npm run verify:changed`; `typecheck` on
shared-module touches) → probes → `/simplify` (new shared helper + new surfaces = offer it) →
`/review` at **high-risk** (family layer; two Criticals were found in the sibling chunk by this
funnel) → `/docs` (coach Family access + request flow + visibility setting + family views) →
**fresh dev-server restart** (new files + shared modules; stop → delete `.next` → start → wait
Ready) → **owner QA on the §2 exit-walk** (share link → request → approve → schedule → calendar
→ game page on a second device; visibility flip probe) → commit per-action OK. Write all
owner-facing summaries in product-owner voice (UX first, no file paths). Budget for the pattern
that every chunk's worst defect surfaced on the owner's real phone.

## Program state at handoff

Chunks A·G·H·E·I·C·B live on prod; F committed on dev, unreleased. Practice-plans session
concurrent + uncommitted (mig 213 dev-only). Chunk B still owes an owner phone QA pass. Chunk D
docs (discovery/plan/brief/prompt) are on dev uncommitted — commit them WITH your build or
before it, owner OK first. `dev` is several commits ahead of `origin/master`; that's normal.
The counsel packet you produce (0.5) goes to the owner — Slice 2 (guardian tier) starts only
after their counsel sign-off lands in `BUSINESS_DECISIONS.md`.
