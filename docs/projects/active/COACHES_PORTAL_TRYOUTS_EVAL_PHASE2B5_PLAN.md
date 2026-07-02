# Coaches Portal Tryouts & Evaluation — Phase 2B.5: Offer / Release Emails + Waitlist Auto-Promote — Implementation Plan

> **Status:** Build-ready — decisions ratified 2026-07-02; building
> **Created:** 2026-07-02
> **Branch:** dev
> **Parent:** docs/projects/active/COACHES_PORTAL_TRYOUTS_EVAL_PHASE2B_PLAN.md (2B.5)
> **Predecessors BUILT + committed:** 2B.1/2B.2 (`91c0f1ae`), 2B.3 (`47f52d38`), 2B.4 (`7dfa36f9`)

## Goal
Close the family-communication loop on tryout decisions: send **org-branded** offer / waitlist / release emails, let a guardian **Accept or Decline via a secure no-login link** (which records their response and **flags the coach** to finalize — the coach still adds them to the roster with fees via the 2B.4 drawer), give offers a **7-day response deadline** (lazily enforced), and surface a **"waitlist has candidates"** nudge when a spot opens. No parent accounts, no automatic family-facing emails from system events.

## Ratified decisions (2026-07-02)
- **D1 — Accept = coach confirms.** A guardian's "Accept" records intent + notifies the coach; the coach finalizes via the existing 2B.4 accept drawer (roster + fees). Guardian action never writes to the roster directly. **Rationale:** keeps the coach in control of roster + fees; lowest PIPEDA/automation risk.
- **D2 — Auto-promote = flag the coach.** When an offer is declined or lapses, **no** automatic offer/email goes to the next family. Instead the board surfaces a "N waitlisted — extend an offer?" nudge; the coach chooses. **Rationale:** human-in-the-loop; never emails a family from a system event.
- **D3 — Offers carry a 7-day deadline** (adjustable), shown as "respond by". Expiry is computed **lazily on board/applicant view** (no scheduler — matches `maybeExpireClaim`). A lapsed offer is surfaced as "expired", not auto-mutated.

## What the code investigation found (grounding — verified 2026-07-02)
- **Token pattern to clone:** the no-account evaluator link (`lib/tryout-evaluator-token.ts`: `crypto.randomBytes(32).base64url` + SHA-256 hash stored, never the raw token; resolver at `app/api/tryout-score/[token]/route.ts` checks hash + expiry + revoked). Public page precedent: `app/tryout-score/[token]/page.tsx` (top-level, not under `[orgSlug]`).
- **No app scheduler.** pg_cron exists but only for observability. Lazy expiry on next view is the established convention (`lib/team-workspace-claims.ts:maybeExpireClaim`).
- **Ranking:** `rankTryoutCandidates` (`lib/tryout-scoring.ts`) already powers the decision board; filter its result by `status==='waitlisted'` for the nudge/top candidate.
- **Email triggers today:** the admin `[regId]` route fires offer/accepted/declined; **waitlisted sends nothing** (comment marks 2B.5 as owner). The **coach decisions route sends NO email** on offer/waitlist/cut. Both must route through one shared helper so the two surfaces behave identically.
- **Notifications:** `notify()` (`lib/notify.ts`) — event types are a **TS-union only, no DB CHECK**; `waitlist_opened` already exists. Add `tryout_offer_response` (bell default on).
- **Branding:** `ctx.org.name` / `ctx.org.logoUrl` / `ctx.org.contactEmail` are all available at the call sites; current tryout templates don't use org name/logo yet.

## Architecture
- **One shared decision-side-effects helper** (`lib/tryout-notifications.ts`) called by BOTH the admin route and the coach decisions route after a status change: `offered` → mint offer token + send branded offer email (Accept/Decline links + respond-by); `waitlisted` → waitlist email; `declined` → release email. Idempotent-friendly; fire-and-forget email.
- **Offer token** (`lib/tryout-offer-token.ts`): generate + SHA-256 hash (clone evaluator). Stored on the registration.
- **Public response** (`app/api/tryout-response/[token]/route.ts` + `app/tryout-response/[token]/page.tsx`): GET resolves token → player/team/deadline/state; POST records `accepted`/`declined` (single-use via `offer_responded_at`, guarded on status='offered' + not expired) then `notify()` the assigned coaches + admins. Minimal PII (player first name + team), token-scoped, expiring.
- **Coach finalize:** unchanged 2B.4 drawer; the board/applicant row badges "Family accepted ✓ — confirm" (opens the drawer) / "Family declined" / "Offer expired".
- **Lazy expiry + waitlist nudge:** computed at read time in the decisions GET (and admin list); no status mutation.

## Phases
### Phase 1 — Schema + offer machinery
- [ ] **mig 170** `rep_tryout_registrations` += `offer_token_hash text` (partial-unique where not null), `offer_sent_at timestamptz`, `offer_expires_at timestamptz`, `offer_response text CHECK (offer_response in ('accepted','declined'))`, `offer_responded_at timestamptz`. All nullable/additive. Apply to **dev**; refresh snapshots; update DATA_DICTIONARY (same unit of work).
- [ ] `lib/tryout-offer-token.ts` (generate/hash). Types + data-layer: `extendTryoutOffer`, `recordTryoutOfferResponse`, `clearTryoutOffer`, offer fields on `RepTryoutRegistration` + mapper.

### Phase 2 — Branded emails + shared trigger
- [ ] `lib/email.ts`: brand the offer template (orgName/logo, Accept/Decline buttons, respond-by), add `tryoutWaitlistHtml`, enhance the release template. **Draft copy → `/marketing` review before ship.**
- [ ] `lib/tryout-notifications.ts` shared helper; wire into the admin `[regId]` route (replace inline sends) and the coach decisions route (net-new sends). Add `tryout_offer_response` event type.

### Phase 3 — Public response page + coach surfacing
- [ ] Public token API + page (Accept/Decline). `notify()` the coach on response.
- [ ] Decisions GET returns offer state; board + admin applicant list badge awaiting/accepted/declined/expired + "waitlist has candidates" nudge; lazy expiry.

### Phase 4 — Docs + verify + review + commit
- [ ] `/docs` (coach recipe + admin guide: offers, family response, deadlines, waitlist). Verify gate. Adversarial `/review` (high-risk: public token surface + email + minors' data). Commit.

## Guardrails
- **Schema=dictionary same unit of work** + refresh snapshots (mig 170 adds columns → dictionary must update; `check:dictionary` will enforce).
- **PIPEDA:** public page shows minimal minor data, token-scoped + single-use + 7-day expiry; no account; no automatic family emails from system events (D2).
- **No new gate** (offers/emails are within the existing tryout suite / Premium). Confirm no plan-gate change.
- **`/marketing` copy review** of the three family-facing emails before owner sign-off.
- **mig 170** dev-only/prod-pending; promotes with 164–169 at release.

## Open questions (flag during build)
- **OQ1 — waitlist email timing:** send the "you're on the waitlist" email immediately when the coach sets waitlisted, or only when they choose to notify? Recommend: immediately (dignified, sets expectations), matching how offer/decline already email on transition.
- **OQ2 — re-offer hygiene:** when a coach moves a candidate back to `offered` after a prior offer, mint a fresh token + reset response/deadline (old link dies). Recommend yes (`clearTryoutOffer` on any non-offered transition).
