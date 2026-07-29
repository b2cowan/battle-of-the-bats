# Free League Starter (Phase 6) — PM Brief

**Status:** Scoped 2026-06-11 (planning only — no code; all decisions ruled). Implementation plan: [FREE_TIER_LEAGUE_STARTER_PLAN.md](FREE_TIER_LEAGUE_STARTER_PLAN.md). Parent plan: [FREE_TIER_COACHES_UNIFIED_PLAN.md](FREE_TIER_COACHES_UNIFIED_PLAN.md) (Phase 6). Strategy detail: [FREE_TIER_STRATEGY_PLAN.md](FREE_TIER_STRATEGY_PLAN.md) §5/§12. Sits on the **Launch Rail** (free floors, no payment processing). Branch: `feat/free-tier-coaches`.

> This brief covers **proposed defaults**. The ⚠️ items in **Open decisions** await the owner's ruling before the implementation plan is written.

## What we're doing

Today a house-league admin who wants to try FieldLogicHQ hits a wall: the only way to run a real season is the **paid League plan ($89/mo)**, and the free entry point (`/start/league`) is a "we'll email you" waitlist — not a product. So small leagues bounce to a mailing list instead of becoming users.

Phase 6 gives a small-league organizer a **real, free season they can run end-to-end** — register players, make a division of up to ~8 teams, auto-generate a round-robin schedule, watch standings update, track who's paid by hand, and share **one public page** parents can use to register and follow the season. They never enter a credit card. When their league outgrows the free size — a second division, a ninth team, a second season, a full branded club website, exports — that's the moment they upgrade to paid **League**.

It ships as a **capped beta** from a controlled page, not a marketed front-door CTA, until the caps are proven server-side.

## The model in plain words

- **League Starter is a free floor, not a new plan.** Under the hood it's a **free-floor entitlement profile** layered on the org — it lights up the house-league module + a narrow public surface and clamps the size. The paid plan ladder (`tournament / tournament_plus / league / club`) is untouched, so we don't add a plan key, a pricing card, or a checkout path.
- **The caps are enforced on the server, not just hidden in the UI.** House-league is "module on / module off" today with no size limits — so the size limits are net-new code in the create APIs (season, division, team), mirroring exactly how the free Tournament floor already blocks a second tournament (count the rows, return a 403 with a plain-language "you've reached your free limit" message).
- **No money moves online.** Fees are tracked by hand (mark a registrant paid/unpaid). Online registration-fee collection is a paid-League + future-payments capability, not part of this floor.
- **One public surface, not a full website.** The free floor gets the public **season** pages (schedule / standings / register) that already exist for the house-league module. It does **not** get the branded full org homepage — that stays a League differentiator.

## What a league operator can do for free after Phase 6

**Included (free):**
- Start **one active season** with **one division**
- Add up to **~8 teams**
- **Auto-generate** a round-robin schedule for that division + live **standings**
- Collect **player registrations** through a public registration page
- **Manual fee tracking** — mark each registrant paid/unpaid by hand (display-only fee amount; no card collection)
- **One narrow public page** — public schedule, standings, and registration for the season, shareable with parents

**Not included (the paid-League boundary they'll feel):**
- A **second division** · a **9th team** · a **second/concurrent season**
- The **full branded public org website** (custom homepage, hero, branding, multi-section site)
- **Exports** (CSV / XLSX / calendar / PDF of schedule, standings, registrations)
- **Online fee collection** (a future payments capability, not just a paid-League one)
- Club-scale extras that already sit above League (accounting ledger, rep teams, cross-module visibility)

**Upgrade triggers (where the wall appears):** trying to add a second division, a ninth team, a second season, turn on the full public site, or export a list. Each wall is **upgrade-aware** — it names the operational thing they were trying to do ("Multiple divisions are part of League") rather than a bare "upgrade your plan," even while paid League is still early-access.

## Why it matters

- **It closes our biggest market-floor gap.** The Canadian grassroots tools we compete with (RAMP, TeamLinkt, Spond) all let an organization run its core for **$0**. A house-league admin currently can't even try ours without paying. League Starter puts a real free season in their hands.
- **It unblocks the rest of the program.** The platform-wide user-journey audit flagged the **League/Club seed org as "the big gap"** — there's no free way to exercise the league and club personas end-to-end. League Starter is that missing on-ramp, so it also unblocks the audit's League/Club journeys.
- **It makes the paid-League boundary credible.** Once a small league can produce a real schedule + standings free, paid League stops being "the only way to run a league" and becomes "the way to run a *bigger* league" — multiple divisions/seasons, the full public site, exports, scale comms, online payments. That's a healthier, more honest upsell.
- **It protects the paid core.** The floor is deliberately *one* division / *one* season / *no* full site / *no* exports / *no* online money — the emotional core of paid League (operate at scale + polish) is preserved.

## How it's built (grounded in today's code)

- **Entry:** `/start/league` flips from a waitlist (`EarlyAccessModalTrigger`) into a real create path, mirroring `/start/tournament` (signed-in → form → create API → land in onboarding). The existing **league onboarding wizard** (season → divisions → registration → review) is reused.
- **Caps:** net-new server-side count checks in `POST /api/admin/house-league/seasons`, `…/divisions`, and `…/teams` (incl. the bulk array path), each returning a 403 with an upgrade-aware message — the same shape as the tournament-slot cap.
- **Public surface:** the public league season pages already render off the house-league module; the free floor simply does **not** receive `module_public_site` (the branded full org home). One scoping nuance to settle: today an org without the public-site module still shows a *simplified* fallback org homepage — we'll decide whether League Starter points parents straight at the season page or keeps that minimal fallback.
- **Exports / fees:** "no exports" = the client-side CSV/XLSX/ICS buttons are gated off for the floor; "manual fee tracking" = the per-registrant paid/unpaid marking (the full accounting ledger stays a Club module).

## Priority & sequencing

**High priority** within the Launch Rail. Phase 6 is **parallelizable with the coach stream** (Phase 5, now complete) — it touches the house-league surface, not the coach surface, so there's no file collision. It depends only on **D1** (the `/start` front door, already built) and **D6** (the free-floor caps, built here). Instrumentation (Phase 7) is best woven in as the floor is built and verified after; the marketing flip (Phase 9) is gated on instrumentation and comes last.

## Success criteria

- A small-league admin can self-serve a **usable season** (division + teams + generated schedule + standings) for free, and share a working public page.
- **Caps hold server-side** — a direct API call cannot create a second division/season or a ninth team.
- League-admin **activation moves off ~zero** (today it's a waitlist).
- Cap-hit and first-value events are instrumented so we can tell a real season from an empty account (first-value = season created + teams + schedule generated + public link shared).
- The **paid-League boundary reads as fair** — upgrade walls name the operational outcome, and no public surface advertises a free start that isn't live (beta stays controlled until caps are proven).

## Role-based access

No new admin roles. Inside a League Starter workspace the existing org roles apply (Owner / League Admin create seasons/divisions/teams; same capability checks as paid League). The only change is **which free entry a league persona lands on** and a logged-in user being able to **add a League Starter workspace** from `/home` without re-signing-up. Platform-admin sessions remain barred from owning workspaces (the existing `/start` guards already enforce this).

## Open decisions

**Ruled 2026-06-11 (owner, via AskUserQuestion):**
1. ✅ **Caps = 1 active season / 1 division / 8 teams**, teams-only (no separate registrant/player cap — per-division capacity + waitlist already bounds roster size).
2. ✅ **Beta gating = feature flag + unlisted entry page** — self-serve for anyone with the link, not marketed — until caps + first-value data prove the boundary; widen later.
3. ✅ **Narrow public page = in Phase 6 scope**, reusing the existing public league season pages (no branded org home).
4. ✅ **Abuse/support controls = minimal now** (rate-limit workspace creation + admin visibility of free-floor creation & cap-hits); **defer** dormant-workspace retention + duplicate-detection to Phase 8. **email-verify-before-public-publish stays bundled in Phase 8's unified email-verification work** (not pulled forward).

5. ✅ **Entitlement-profile representation (ruled 2026-06-11, owner).** A **persistent free-floor field/profile on the org** (e.g. a `free_floor` column → `'league_starter'`), contributing module entitlements + caps to a computed effective-entitlements result — **decoupled** from the timed `org_overrides`/`ENTITLEMENT_GRANTS_ENABLED` machinery (which stays for timed grants only). `plan_id` stays the paid ladder. The **onboarding-wizard trigger** moves from `plan_id === 'league'` to a house-league **entitlement** check so a free-floor org reaches the existing season→divisions→registration→review wizard.

### Related, not folded in

A combined **standalone + tournament coach-surface design/UX pass** is still outstanding (owner-deferred, separate track) — it reviews the coach surface, not the league surface, and is not part of Phase 6.
