# Tournament Admin Sandbox — build prompt for the remaining Phase 1 slices

**Written 2026-08-03 by the chat that built S1 / S2 / S5.** Everything invisible is done and
verified; nothing visible is started. This document is the handoff.

---

## Read these first, in this order

1. `TOURNAMENT_ADMIN_SANDBOX_PLAN.md` — the plan, with build status, ratified decisions D0–D4, and
   the **Build notes** section recording every deviation made so far and why.
2. `TOURNAMENT_SANDBOX_MOCKUPS.html` — **the approved, BINDING visual spec** (artifact
   `118b8d75-1b83-4272-b9f2-bfe0ae9f7ddf`). Build to it. Label NEW / RESTYLED / UNCHANGED when you
   describe your work, and flag any deviation the code forces rather than diverging quietly.
3. `docs/agents/strategy/BUSINESS_DECISIONS.md`, entry **2026-08-02 "The product demo is UNGATED
   at the door"** — the binding GTM posture. **No email, no form, no lead capture, ever.** The
   gating is curation of which admin surfaces the sandbox exposes, not who gets in.
4. `TOURNAMENT_ADMIN_SANDBOX_PM_BRIEF.md` — the product framing, in the owner's language.

---

## What already exists (do not rebuild any of this)

| Piece | Where | What it does |
|---|---|---|
| Demo-org allow-list | `lib/demo-org.ts` | The hardcoded truth. Slug-keyed, org-agnostic, shared with the coach sandbox. Also holds the one demo organizer email and the landing path. |
| Id resolution | `lib/demo-org-server.ts` | `isDemoOrgId()` for server code holding an org id. **Fail-closed and throws** if it cannot resolve — callers on a send path must treat that as "don't". |
| The write block | `lib/demo-guard.ts` + `proxy.ts` | Refuses every non-GET for a demo org, above every route and session check. Returns `{ sandbox: true, … }` with an `X-Sandbox-Blocked` header. |
| Body-identified exceptions | `app/api/register/route.ts`, `app/api/consumer/follows/route.ts` | The two public writes that name their org in the body. Pinned by a decision-point list in the test file. |
| Outbound silence | `lib/notify.ts`, `lib/email-sender.ts`, `lib/fan-notify.ts` | Three independent chokepoints. All fail-closed. |
| The canonical world | `lib/demo-tournament.ts` | Teams, strengths, divisions, venue, the round robin, the cycle, and `resolveDemoState(now)` — a **pure function of the clock** that says what every game's date/time/status/score should be. |
| The seed | `scripts/seed-demo-tournament.mjs` | Builds everything from first principles. Idempotent. Refuses production without `--allow-prod`. |
| The reconcile job | `lib/demo-reconcile-core.ts`, `lib/demo-reconcile.ts`, `app/api/platform-admin/demo-sandbox-tick/route.ts` | Tick + reset + date re-anchor in ONE stateless, idempotent, self-healing operation. Alerts on failure. |
| Dev runner | `scripts/tick-demo-sandbox.mjs` | `node --env-file=.env.local scripts/tick-demo-sandbox.mjs [--watch]` |
| Health probe | `scripts/check-demo-sandbox.mjs` | Asserts the sandbox is presentable. **Run this after any change.** |
| Contract tests | `tests/unit/demo-sandbox-write-guard.test.ts` | 22 tests. Keep them green. |

**Current dev state:** seeded and healthy. Fan side `/riverdale-minor-ball/summer-classic`,
operator side `/riverdale-minor-ball/admin/tournaments/dashboard`. Nothing is committed.

---

## Things that will bite you if nobody tells you

1. **"Live" is a TIME WINDOW, not a status.** `lib/game-status.ts` decides liveness from the game's
   scheduled window, so the only way to make something read LIVE is to place its window around
   `now`. This is why the semifinal floats with the clock instead of sitting at a literal 9:00 AM.
   Do not "fix" the times to look tidier — you will kill the liveness.
2. **The schedule health baseline is fragile and was hard-won.** It scores 89–92 / HEALTHY at every
   hour with zero conflicts, measured across all 72 cycle × phase combinations. It got there via
   four diamonds, midday pool play and a 75-minute game length — each of those is load-bearing and
   commented as such. **The whole "try to break the schedule" beat needs an intact baseline.** If
   you touch the seed's times, facilities or durations, re-run the sweep before believing it.
3. **The demo has no champion, on purpose.** The story stops before the last out — a landing state
   of "this tournament is over" sells nothing, and crowning would reach for the champions and
   notification paths the sandbox must never touch.
4. **Never write demo data through the app's own write paths.** They fire notifications. The
   reconcile job writes with the service-role client directly, deliberately.
5. **`lib/` modules imported by scripts need explicit `.ts` extensions** on their relative imports
   (`allowImportingTsExtensions` is on; it is an established repo convention). Without it, Node's
   type stripping cannot resolve them and the script dies.
6. **Other agents share this working copy.** Re-check the branch is `dev` before committing, stage
   explicit pathspecs only, and stay out of the coaches-portal and setup-wizard files.

---

## The remaining slices

### S3 · The door (next)

A route that establishes a session for the ONE fixed demo organizer and lands the visitor on the
**fan side** (the friendlier half, and the one that proves it is live within seconds).

Non-negotiable, from the plan and the ratified decisions:
- The account is **hardcoded** — `lib/demo-org.ts` already holds it. Nothing derived from the
  request may influence who gets signed in. No `next`/redirect parameter, at all.
- Origin resolution via `resolveTrustedAppOrigin` — see the auth-email origin gotcha in memory;
  raw request Origin here is an account-takeover shape.
- Rate-limited via `lib/rate-limit.ts`.
- **No email, no form, no interstitial.** Any friction here contradicts a binding decision.
- The demo account has no password (the seed sets a random one and discards it) — establish the
  session server-side rather than signing in with credentials.

Blast-radius argument to preserve: that session can only ever see one fictional org, and it cannot
write, because S2 already blocks it.

### S4 · The sandbox chrome

Banner + tour chips + reset countdown, mounted by the org shell **only** when the org is a demo
org. Build it **org-agnostic** — the coach sandbox mounts the same two pieces with its own chip
list. Sections 1, 2 and 3 of the mockups are the spec; note the banner is deliberately not
dismissible.

Also in this slice:
- The **toast catch-all** on the shared fetch layer, keyed off the `sandbox: true` response, so no
  screen can ever surface a raw failure.
- The **locked outbound controls** — visibly disabled *before* they are pressed, with the honest
  line beneath. Mockup section 5 covers the three shapes (card / toast / locked).
- The countdown reads the same cycle the reconcile job uses; `DEMO_CYCLE_MINUTES` is exported.

Copy in the mockups is a **working draft** — the shapes and placements are what was approved.
Final wording goes through `/marketing` before the door opens publicly.

### S6 · Hygiene remainder

Directory exclusion is already done in the seed (`is_discoverable` false, `list_in_directory`
false). Still to do:
- **Search-engine exclusion** of the demo org's public pages — they are genuine public tournament
  pages and could otherwise be indexed or mistaken for a real association. Added to scope with the
  ungated-door ruling.
- Exclude the demo org from **admin/platform metrics** and from **observability alerting**, so it
  does not pollute our own numbers or page someone.
- **Curated surfaces** (ratified): hide, don't dead-end — billing/subscription, staff invitations,
  data tools/exports, deep settings forms. See mockups section 3, "What the sandbox deliberately
  doesn't show", and the archive-is-opt-in precedent in `CLAUDE.md`.

### S7 · The marketing doors (dev only)

"See it live →" beside "Start Free" on `/for-tournament-organizers`, and a second link on the
homepage Tournament persona card. Mockup section 6. **Wire them on dev; do not promote to
production** — the production demo org and the live doors are a separate release step the owner
decides, and it gets its own entry in the decisions log.

### 1b · The drag beat (fenced)

The one delicate slice. The editors persist drags through the API; under the write block a raw drag
would snap back and look broken. Make the schedule/bracket editors treat the `sandbox: true`
rejection as **"keep my local state, show the nudge"**. The health engine already recomputes in the
browser against the in-memory game list, so a moved-but-unsaved game scores correctly with no new
maths — that half is free.

**If it fights, stop.** Ship everything else and let this follow. That fallback is pre-approved:
Phase 1 goes out with read-only editors and the "try it" prompt pointing at the public what-if
beats instead.

---

## Working agreements with the owner

- **Mockups are binding.** Label NEW / RESTYLED / UNCHANGED. Flag deviations; do not diverge
  quietly. Record them in the plan's Build notes section as you go.
- **No commits without an explicit, per-action OK.** Approval never carries across turns.
- **Ask before restarting the dev server.** (The owner declined a restart on 2026-08-03; browser
  verification of everything built so far is still outstanding.)
- **No schema changes are expected.** If one seems necessary, stop and ask first.
- **Dev only.** Nothing runs against production.
- Report in **product-owner voice** — what the user sees and does differently, not file paths and
  mechanics.
- Offer `/review` after substantive work, and `/docs` if a user-facing flow changes.

## Definition of done for Phase 1

A cold visitor with no login sees a live score move and both sides of the product within two
minutes; nothing they do persists or sends anything; the demo is never stale; and every dead end
offers "Start your own — free."
