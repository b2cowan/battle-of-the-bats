# Founding Season 2027 — the free season runs through September 30, 2027; the offer goes front and centre

**Status:** Phase 0 ✅ **committed `2f02a949` on `dev` 2026-09-07** after `/review` (§3b; owner QA §150 owed, listed as B9 on the owner's run-order artifact `5ef0163e`;
**migration 279 applied to dev, PROD-OWED and invisible to `check:migrations` — it is data-only**).
Phases 1–3 planned. Ruling: `docs/agents/strategy/BUSINESS_DECISIONS.md` 2026-09-07. Design:
`memory/design_decisions.md` 2026-09-07. Copy: `FOUNDING_SEASON_2027_OFFER_COPY.md` (approved canon).
Mockups: artifact `61a78f09` (source `FOUNDING_SEASON_2027_OFFER_MOCKUP.html`).
**PM brief:** `FOUNDING_SEASON_2027_PM_BRIEF.md`. **Predecessors (archived):** `FOUNDING_SEASON_PLAN.md`,
`FOUNDING_SEASON_COACHES_FREE_PLAN.md` — their January 2027 conversion mechanics are superseded here.

## 1. The decision this plan builds (ratified 2026-09-07)

| # | Decision | Recommendation taken |
|---|---|---|
| D1 | Free period ends **September 30, 2027** (not August 31) | Settlement, awards, documents and next year's tryout happen after the last game; ball tryouts run August into September — the ask must coincide with "I have next year's team" |
| D2 | Signup window closes **December 31, 2026**; **no second promotion** after it | A second offer would make the first deadline a lie. Consequence: the Stripe production smoke test keeps its December 31, 2026 deadline — after the window a free org upgrading meets the live checkout |
| D3 | End-of-season ask = **2028 plan choice, annual first**, made with the card | A seasonal buyer charged monthly on October 1 has nothing to use until spring |
| D4 | Turn-off: org → free Tournament plan (data kept); coach → cancel-only; **read-only window ratified in principle** | Build the window before the coach consequence line may promise it |
| D5 | Homepage persona-card badge rule (2026-08-07) **stands**; the offer still goes front and centre | Bar + panel carry the calendar; the cards stay the doors |
| D6 | Platform-admin desk in **winter**; manual-vs-automatic turn-off decided by **May 2027** by cohort size | The 2026-07-20 hand-run-under-fifty rule stands until then |

Mockup-sheet choices: **bar variant A** (dark, lime type) · **panel product lines as text** · **pricing
cards "$0 through September 30, 2027"**.

## 2. Verified state before the build (why the phases are ordered this way)

- Live production cohort: **three accounts** (Milton Softball on Tournament Plus since June with two
  tournaments; one coach workspace, Aug 25; one free org, Aug 29). Extending them costs nothing.
- The signup deadline and the free-period end were **the same instant** in code (`2027-01-01`), read by
  one helper for both jobs.
- **Nothing turned a comp off by itself**: `comp_period` is access-inert, no cron, no downgrade job;
  the January runbook was planned but never written; card-on-file status lived only in Stripe and the
  one email that branched on it always assumed no card.
- The org billing page was hardcoded to start asking for a card on **October 1, 2026** with copy
  promising nothing before January — wrong the day the date moved. **Time-critical.**
- The date was typed out in words in about two dozen screens and all ten campaign emails.
- `/for-tournament-organizers` had hand-written Founding Season copy with **no gate at all**.

## 3. Phases

### Phase 0 — the date split + the acquisition pass (ship before October 1, 2026) ✅ BUILT 2026-09-07

**Foundation** — `lib/plan-config.ts`: `FOUNDING_SEASON_SIGNUP_CLOSE` (`2027-01-01T05:00Z` = end of Dec 31
Eastern) and `FOUNDING_SEASON_END` (`2027-10-01T04:00Z` = end of Sept 30 Eastern), both env-overridable;
`FOUNDING_SEASON_CARD_WINDOW_OPEN` (`2027-06-01T04:00Z`); `isFoundingSeasonSignupOpen()` (offer surfaces +
comp granting) vs `isFoundingSeasonActive()` (comp still running) vs `isFoundingSeasonCardWindowOpen()`;
customer labels **derived** from the instants in `America/Toronto` (`FOUNDING_SEASON_END_LABEL` etc.);
`foundingSeasonOfferLine()` / `foundingSeasonOfferCore()` / `FOUNDING_SEASON_AFTER_LINE`. Pinned by
`tests/unit/founding-season-dates.test.ts`.

**Comp-granting paths now read the SIGNUP window:** `/api/auth/signup`, `/api/org/create`,
`/api/league/create`, `/api/admin/org/onboarding-plan` (the upsell email), `/api/billing/create-checkout`,
`/api/billing/create-team-checkout`. Reason strings derive from the label. `lib/founding-season.ts`,
`lib/team-checkout.ts` follow.

**Offer surfaces (all keyed on the signup window):**
- `components/marketing/FoundingSeasonOfferBar.tsx` (+css) — NEW, mounted by `SiteChrome` beside the
  Navbar; decides for itself (marketing path × window open); publishes `--offer-bar-h` + `data-offer-bar`
  like the sandbox banner; `globals.css` body padding + `--chrome-top-h` term; `Navbar.module.css` `top`.
- `components/marketing/FoundingSeasonPanel.tsx` (+css) — NEW; homepage (with product lines) and
  `/pricing` (`#founding-season`, without).
- `app/page.tsx` — eyebrow row removed; panel under the sub-headline; plans-section callout → one line.
- `app/for-tournament-organizers/page.tsx` — gate added; hero sub + trust row; plan card "$0 through …";
  Founding card re-aimed + consequence line (`.foundingSeasonConsequence`, `.heroNoteAccent` added);
  bottom CTA.
- `app/for-coaches/page.tsx` — hero sells one thing while the window is open; note/trust/plan card; the
  "free with no end date" reassurance in the plan-grid intro; fallback consequence line; bottom CTA.
- `app/pricing/page.tsx` — strip above the cards; after line as the footnote; FAQ rewrites incl. the
  post-window replacement (`faqsForWindow`); bottom CTA. `ComparisonTable.tsx` row reads the window at
  render (builder, not module constant). `components/PricingSection.tsx` — "$0 through …" price block,
  "Founding Season" chip in `.statusBadge`, badge CSS deleted.
- `app/(consumer)/start/page.tsx` — "2027 season free" pills; coach card opens the **Premium** door while
  the window is open; Basic companion line beneath (`.basicLine`).
- Coach signup (`TeamSignupClient`), coach welcome, `PlanArticlePanel`, `CoachExploreCatalog`,
  `ScopeCeilingInterest`, `ScopeShelf`, org onboarding (both banners), org billing page (card-saved
  toast, current-plan card, banner, tools block — the card ask now opens **June 1, 2027**), platform-admin
  email dashboard tooltip, `lib/email.ts` (org welcome, upsell, coach comp welcome).

**Data:** migration `279_the_founding_season_runs_through_september_2027.sql` — moves every active
comp row, comped workspace and comped org from the old instant to the new one (idempotent). **Applied to
dev 2026-09-07; PROD-OWED; data-only, so no drift check can see it — record the prod apply in the
release history.**

**Verification:** `npm run typecheck` clean; `npm test` 3131/3131 (7 new); `npm run verify:changed` green
(one stale text-contrast exemption for the removed eyebrow row deleted from `scripts/check-text-contrast.mjs`).
Owner QA: `OWNER_QA_LEDGER.md` §150.

**Deliberately NOT in Phase 0:** the ten campaign emails (rewritten in Phase 1 against the summer
calendar; sent by hand, so nothing wrong fires on its own — but do not send `founding_renewal` /
`founding_final` this autumn, they still say January); the read-only window; any admin-desk work.

### Phase 1 — autumn: the acquisition push (copy + demos + help) — `/marketing`, `/docs`

1. Rewrite the campaign email defaults against the summer-2027 calendar: welcome, check-in, and a new
   sequence — **June 1** "your free season ends September 30; choose a plan for 2028" (card window opens),
   **August 1** nudge, **mid-September** final notice. Retire the Club/League spotlights (parked
   products) and the "Club last chance". Data-only re-seed migration for uncustomised rows (the mig-198
   pattern). Welcome-email polish.
2. Demo dock lines + tour narration: check whether either demo mentions the offer (none found 2026-09-07);
   add one arrival line on the pricing/offer moment if the tour has one.
3. Help articles: the platform-admin "batch marketing email" article describes the founding sends
   (dates-free; verify after the email rewrite).
4. Offer bar on `/demos`: confirm it does not collide with the sandbox banner once inside a demo (the
   bar is marketing-path-only, the sandbox is an org — verified by construction; walk it).

### Phase 2 — winter: the platform-admin Founding Season desk — `/plan` + `/billing`

1. One list: every comped organization AND coach workspace — free-period end, **card on file** (the fact
   must be recorded in the app at webhook time; today it lives only in Stripe), last activity, events run
   / roster size, contact. Export.
2. Reminder sends targeted at **"no card yet"** (a new audience) — the account-notice framing.
3. **Card saving for coach workspaces** (the SetupIntent path exists for orgs only).
4. The **2028 plan-choice checkout**: annual first, monthly available, with the saved card — replaces
   "add a payment method" as the summer ask.
5. **Stripe production smoke test by December 31, 2026** (HARD — the list-price checkout is live from
   January 1, 2027 for anyone who missed the window).
6. Decide the read-only window's build slot (D4); until built, the coach copy stays on its fallback line.

### Phase 3 — by May 1, 2027: manual vs automatic turn-off

By cohort size: under ~50 accounts the September runbook is hand-run (bulk plan-change + per-account
cancel already exist in platform admin); over it, build the October 1 job (convert card-on-file accounts
to their chosen 2028 plan; downgrade orgs / close coach workspaces without one). Write
`docs/agents/ops/SEPTEMBER_2027_CONVERSION_RUNBOOK.md` either way.

## 3b. `/review` 2026-09-07 — high-risk tier, five lenses; what it found and what changed

**Deterministic gate:** verify:changed ✓ · typecheck ✓ · focused lint ✓ (0 errors) · check:migrations ✗
(**pre-existing** drift from other sessions' 276–278; 279 is data-only and invisible by design) ·
rendered check ✓ on all seven marketing screens at 361/390/768/1440 (the first run widened to all 73
screens because another session's shared coach stylesheet is in the working copy, and aborted on
memory — re-run scoped after a dev-server restart; an abort is not a pass).

**Confirmed and fixed (in the same unit of work):**
1. **The org billing page's current-plan card keyed on the SIGNUP window** — after December 31, 2026 an
   organization still free through September would have been shown its list price and "Billed
   monthly". It now keys on the account's own comp status (the same endpoint the banner uses), with
   the window as the fallback only until that status answers. The same defect on `/pricing` for a
   signed-in operator's "Current plan" card is closed the same way (`ViewerAwarePlans` asks the
   status endpoint for the one rendered promo plan an org can hold; `PricingSection` takes
   `currentPlanComped`).
2. **Rollout-ordering hazard: the code and the data backfill (279) are two artifacts.** Between a deploy
   and the backfill, every existing founding organization would have dropped out of recognition
   (billing banner gone → a Stripe-portal button for an account with no Stripe customer; audience
   counts to zero; a comp reactivation inserting a duplicate row). Recognition is now TOLERANT of the
   legacy instant (`FOUNDING_SEASON_LEGACY_END`, `FOUNDING_SEASON_COMP_EXPIRIES`): the status
   endpoint, the six audience queries and the comp writer all accept either instant, and the writer
   heals a legacy row to the current one in passing. 279 stays as the bulk backfill; the order no
   longer matters for correctness.
3. **The audience queries never excluded REVOKED comps** (pre-existing) — fixed while touching them.
4. **The offer panel always named both products** even where the Premium checkout is gated — it now
   takes `product` and the two callers pass the same signal they already compute.
5. **Migration 279 could have re-dated a platform-admin's manual comp** that happened to end on the same
   instant — the org_overrides UPDATE now also requires a reason beginning "Founding Season" (every
   Founding Season writer stamps one), and a NULL reason stays NULL.
6. **Rendered check, three defects in the new bar:** every nav link sat UNDER the bar (the marketing
   nav's `top` was a Tailwind `top-0` utility, not the module rule that carries `--offer-bar-h` — moved
   to `.marketingNav`); the "·" separators failed AA (now `--data-gray`); the bar was 40px in the
   641–900 band (tap floor + wrap now apply ≤900px).
7. The bar's own link scrolled `#founding-season` under the fixed chrome (`scroll-margin-top` added);
   the promo cards' leading "$" reused a class tuned for a trailing "CAD" and sank (own class); the
   transactional welcome-email subject still said "Dec 31"; the pricing FAQ restated the annual prices
   as literals (now from config).

**Refuted / accepted with a note:** comp-granting functions do not self-check the window (accepted —
cohort members must still be able to comp-reactivate after the window; every caller gates); a coach
revisiting the welcome screen after the window sees the plain "ready" copy (true, accepted); the
env-override path can produce a label that lies if an instant is not end-of-day Eastern (documented
in the constants' header; the test pins the committed literals); the campaign-email subject list
still says "Dec 31" (Phase 1, hand-sent); `ComparisonTable` rebuilds its rows per render (cosmetic).

**Verification after the fixes:** typecheck ✓ · 3,135 unit tests ✓ (4 new: legacy tolerance) ·
verify:changed ✓ · scoped rendered check ✓ — no new findings, and five stale baseline entries for
the removed eyebrow row can be pruned.

## 4. Risks / accepted trade-offs

- **Phone fold:** the homepage panel pushes the first persona card down ≈210px on a 390×844 phone; its
  action link lands ≈40px below the fold. Accepted on the mockup sheet.
- **Two dates, one word:** any future surface that reads `isFoundingSeasonActive()` for an OFFER will
  advertise a closed offer for nine months. The helper docs say which is which; a reviewer should ask.
- **Data-only migration 279** cannot be seen by any drift gate — the release record is the only proof.
- **Campaign emails still say January** until Phase 1; they are hand-sent.
- **Amplify env:** if `NEXT_PUBLIC_FOUNDING_SEASON_END` was ever set as an env override on prod, it now
  OVERRIDES the new default — check the Amplify environment before the promote.
