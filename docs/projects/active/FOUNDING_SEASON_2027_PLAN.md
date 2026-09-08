# Founding Season 2027 — the free season runs through September 30, 2027; the offer goes front and centre

**Status:** Phase 0 ✅ **committed `2f02a949` on `dev` 2026-09-07** after `/review` (§3b; owner QA §150 ✅ **PASSED 73/73, zero defects, 2026-09-07** — B9 on the owner's run-order artifact `5ef0163e`; the one question it raised — the comparison table had no Coaches Portal column — was RULED the same day: **the table is removed** (`BUSINESS_DECISIONS.md` 2026-09-07);
**migration 279 applied to dev, PROD-OWED and invisible to `check:migrations` — it is data-only**).
**Phase 1 ✅ committed `d2b3b2db` on `dev` 2026-09-08** after `/review` (the campaign emails, the demos, the help, the offer bar walked into both demos; migration 284 applied to dev, PROD-OWED and data-only; owner QA §154 owed; copy approved by the owner on artifact `4e8c6474` before any seed was written, walk artifact `fc80f4bf`). Phases 2–3 planned. Ruling: `docs/agents/strategy/BUSINESS_DECISIONS.md` 2026-09-07. Design:
`memory/design_decisions.md` 2026-09-07. Copy: `FOUNDING_SEASON_2027_OFFER_COPY.md` (approved canon).
Mockups: artifact `61a78f09` (source `FOUNDING_SEASON_2027_OFFER_MOCKUP.html`).
**PM brief:** `FOUNDING_SEASON_2027_PM_BRIEF.md`. **Predecessors (archived):** `FOUNDING_SEASON_PLAN.md`,
`FOUNDING_SEASON_COACHES_FREE_PLAN.md` — their January 2027 conversion mechanics are superseded here.

## 1. The decision this plan builds (ratified 2026-09-07)

| # | Decision | Recommendation taken |
|---|---|---|
| D1 | Free period ends **September 30, 2027** (not August 31) | Settlement, awards, documents and next year's tryout happen after the last game; ball tryouts run August into September — the ask must coincide with "I have next year's team" |
| D2 | Signup window closes **December 31, 2026**; **no second promotion** after it | A second offer would make the first deadline a lie. Consequence: after the window a free org upgrading meets the live checkout — Stripe is live in production and the smoke test is done (owner-confirmed 2026-09-07) |
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

### Phase 1 — autumn: the acquisition push (copy + demos + help) ✅ committed `d2b3b2db` 2026-09-08

**Owner QA `OWNER_QA_LEDGER.md` §154** (walk artifact `fc80f4bf`; the copy was approved by the owner on
the send-book artifact `4e8c6474` before any seed was written — copy is a mockup gate here, not an
afterthought). **Migration 284 applied to dev 2026-09-07; PROD-OWED and invisible to
`check:migrations` — it is data-only.**

**Ten campaigns became eight, and the campaign SET now exists exactly once.**

1. **The eight campaigns, rewritten against the summer-2027 calendar.** Welcome and check-in keep their
   event triggers; the summer sequence is `founding_renewal` (**Jun 1, 2027**, the day the card window
   opens — the plan choice, annual first), **`founding_nudge` NEW** (**Aug 1, 2027**) and
   `founding_final` (**Sep 15, 2027**); the autumn acquisition push is the two Coaches Portal spotlights
   (Oct 1, 2026) and the wrap-up (Nov 15, 2026). Every date and price is DERIVED —
   `lib/marketing-email-defaults.ts` reads the labels, the offer-line helpers and the `PLAN_CONFIG`
   prices. Not one is typed.
   - **Retired, not deleted:** `spotlight_club`, `spotlight_league`, `spotlight_club_last` (parked
     products; two of them were sitting on the board marked *past due*, asking to be sent). The row and
     its copy stay, so a revival costs nothing; a `retired` marker drops it from the board, the
     recipient counts and the send allowlist. ⚠ **A data-only DELETE is invisible to both drift
     gates** — that is exactly how migration 264 stranded.
   - **"Welcome-email polish" turned out to be a real defect:** the live welcome email promised "up to 3
     active tournaments at once". Tournament Plus is **unlimited**, and three is not even the free
     plan's limit (that is one). Every organization that ever signed up was told the paid product was
     smaller than it is.
   - Removed from `spotlight_full_picture`: the parked products it sold as free, and its "add a payment
     method" ask (nothing in the product asks for a card before June 1, 2027). "See plan comparison" →
     "See the plans" (the table was removed by owner ruling 2026-09-07).
   - **No email counts down days.** "Ends in 16 days, on December 31" was true only if it went out on
     exactly the right morning; every new email names the date and nothing else.
   - The `hasCard` branch is written but inert: the app does not RECORD card-on-file yet (Phase 2.1).
     Both branches are in the walk; today the "no card" one is what sends.

2. **⚠ THE CAMPAIGN SET WAS DECLARED FIVE TIMES AND ALL FIVE HAD DRIFTED.** The copy defaults, the send
   route's key allowlist, the audience map in `lib/email-sender.ts`, the per-key counts in
   `app/api/admin/email/route.ts`, and the dashboard's own hardcoded board. The board's table already
   preferred the DB subject, so the rewrite LOOKED complete — but the **Confirm Send dialog** reads its
   own hardcoded copy and would have quoted a December 31 subject while sending a September 30 email, at
   the one moment an operator is committing to mail real customers. `lib/marketing-email-defaults.ts` is
   now the registry (copy + audience + timing + retired) and the other four derive from it.
   `tests/unit/marketing-campaign-registry.test.ts` (10 tests) fails the build when they disagree, when
   a live campaign stops naming the free-season end, when a token is used but undeclared, when a banned
   brand-voice word appears, when the summer sequence falls out of order — and **when the copy changes
   without a reseed migration** (migration 198's "KEEP IN SYNC" comment was an honour system; this
   replaces it).
   **Ownership note:** three of those four files were Phase 2's under the build prompt's split. Raised
   before any code was written; **owner ruled 2026-09-07 that Phase 1 owns the campaign set end to end**
   (Phase 2 owns the desk). Every edit is confined to the campaign-list lines.

3. **Demos — verified, and nothing added.** Both docks and both tours were read end to end: neither has
   a pricing or offer moment (the tournament tour is game day → bracket → organizer's seat → break the
   schedule; the coach tour walks a season). Per the plan, that means say so and add nothing.
   ⚠ **But the demos never mention the offer AT ALL** — the bar is marketing-path-only, so a prospect
   can walk a whole sandbox, be sold, press "Start your own — free" (true of the free floor, silent
   about the offer) and never learn that a whole 2027 season is free. **Flagged, not changed:**
   persistent demo chrome is an owner copy call (walk Part I).

4. **Help.** The "batch marketing email" article claimed a template could show *not built* and be
   unsendable — a state the dashboard has never actually shown. Rewritten to say the preview is rendered
   by the send's own code, and that a retired campaign leaves the board entirely. Fixed in the same
   sweep: the feature matrix was described as "the public plan comparison" — the table removed on
   2026-09-07 — when what it actually decides is which modules each plan includes, which understated its
   blast radius. Every help article and customer-visible string was swept for the old cliff; the only
   remaining hits are the three retired bodies (deliberate, and unsendable).

5. **The offer bar walked INTO both demos — 34/34 browser checks** at 390px and 1440px. The bar renders
   on `/demos` with the nav below it rather than under it; inside both sandboxes there is no bar, no
   `data-offer-bar` stamp, no `--offer-bar-h` left set and **no reserved gap** — which was the failure
   mode that actually mattered, since the bar reserves its own height at the top of the document.

**⚠ OPEN — the gap Phase 2 must close.** The summer sequence's audiences are **now** filtered to
**organizations** — before `/review` they were not, and every campaign would have gone to comped coach
workspaces in an organization's words (see Phase 1b, the confirmed critical). With the filter in place a
coach on a standalone Premium Coaches Portal is in none of them, so a coach's free season would end on
September 30, 2027 with no email ever having warned them. Deliberately NOT papered
over with a product-neutral rewrite: the honest sentence differs by product (an organization drops to
the free Tournament plan and keeps everything it built; a coach's portal closes), and copy canon §1
rule 4 keeps product-specific consequences off a shared surface. When Phase 2 builds the
coach-workspace audience, these three campaigns want coach-facing twins.

**Verification:** 3,224/3,224 unit tests (10 new) · typecheck clean on every touched file · focused
lint 0 errors · `verify:changed` green except `check:parity` / `check:migrations`, which fail on
**pre-existing** drift from other sessions' migrations 276–283 (284 is data-only and adds no schema, so
its prod apply must be recorded by hand). No marketing screen was touched, so no rendered check was
required.

### Phase 1b. `/review` 2026-09-07 — high-risk tier, five lenses; what it found and what changed

**Deterministic gate:** typecheck ✓ (0 errors in every touched file) · focused lint ✓ (0 errors) ·
`npm test` ✓ for everything in this build · spelling ✓ · dates ✓ · observability ✓ · export-catalog ✓
· root ✓ · index coverage ✓ · demos ✓ · marketing shots ✓ · **rendered check n/a** — `check:layout`
sweeps 75 coach + marketing screens and the platform-admin Email board is not one of them (asked the
script with `--list` rather than trusting prose). Failing for **other sessions' in-flight work, not
this build**: `check:parity` / `check:migrations` (migrations 276–283), `check:dictionary`
(`organization_billing_facts`, mig 283), `check:css-selectors` (`readonlyValue` in the coach
stylesheet), and `tests/unit/next-season-choice.test.ts` (Phase 2's own test, importing an export
their module does not have yet).

**⚠ CONFIRMED CRITICAL — every founding campaign was about to be sent to COACHES, in an
organization's words.** A comped standalone Premium Coaches Portal is backed by a **shadow org**
(`account_kind='team_workspace'` / `plan_id='team'`), and `provisionCompTeamWorkspaceFromCheckout`
calls `ensureFoundingSeasonCompPeriod` on it — so it carries the **same** `comp_period` override a
real organization does. The audience query selected overrides with **no plan filter**, so a coach
would have received "Tournament Plus is free through September 30, 2027", been quoted **$39/month
for a product they never had**, and been linked to an org billing page and a tournaments dashboard
their account does not have. It had not fired only because no coach has taken the comp on this data
— and the two Coaches Portal spotlights in this very campaign set exist to change that, so the
window where it was harmless was closing. **Fixed** with the repo's canonical shadow-org predicate
in all three places at once (both recipient fetchers AND `getMarketingAudienceCounts`, so the count
an operator reads before pressing Send cannot describe different people from the send).
⚠ **This reverses what this plan said before the review.** The claim was "coaches are in none of
these audiences, so they hear nothing" — the truth was worse: they were in, and would have heard the
wrong thing. The gap is now real *because* it was made real; see the open item above.

**Confirmed and fixed (same unit of work):**
1. **`spotlight_full_picture` credited the FREE plan with auto-scheduling** — a Tournament Plus
   feature (`plan-features.ts` gates `auto_schedule` at `tournament_plus`), and contradicted inside
   the same campaign set by `founding_final`, which correctly calls the free plan "manual
   scheduling". The same bullet's "**both** are free through September 30, 2027" also read back onto
   the free Tournament plan, implying **the free tier expires**. It does not. Three separate product
   lines now, and the offer sentence comes from the helper verbatim instead of being hand-written
   ("for everyone who signs up by" → the canonical "when you sign up by … No credit card.").
2. **`founding_final`'s card-on-file branch said "continues on the plan you chose"** — saving a card
   and choosing a plan are two separate actions, so an account that added a card in June and never
   chose would have been told "nothing else to do" by the LAST email before their season ended. It
   now names the choice as the one thing outstanding and gives them the button.
3. **"Annual is what most organizations want"** — a customer-behaviour claim with nothing behind it
   (three accounts, none has chosen). Reframed in both emails to say what the year *is*.
4. **"Retired" was only enforced on the batch send.** The **test-send** route (reachable from the
   template editor, which still lists retired campaigns by design) would render and *deliver* a
   retired campaign's deliberately un-rewritten copy to the requesting admin's own inbox, and the
   **preview** route would render it into the dashboard. Both now refuse a retired campaign with an
   explanation; non-marketing templates are untouched.
5. **The dashboard still said "All 10 founding season emails"** above a table of 8 — the exact drift
   class this refactor exists to end, surviving inside the refactor itself. Now derived.
6. **Nothing tied a campaign's declared variables to what the send path actually supplies.** The
   registry test checks copy↔`variables`; it could not see `buildVars`. A token added to a body
   would render as a literal `{{token}}` — or silently take the wrong `::if` branch and state the
   opposite of the truth about someone's billing. The send route now proves the contract on the
   first recipient and **refuses the whole batch** rather than discovering it one sent email late.
7. **The module header cited a generator script that did not exist** ("GENERATED, NEVER
   HAND-TYPED"). Written for real: `scripts/generate-campaign-reseed-migration.mjs`, so the next
   reseed is generated rather than hand-copied — which is the risk the comment claimed was closed.
8. **The planned-date guard could clobber an operator's choice.** There is no `is_customised` flag
   for `planned_send_date`, so the move was gated on the old seeded value alone — an operator who
   deliberately re-picked that same value would have been overwritten. It now also requires the row
   to be untouched by a human (`updated_by like 'migration-%'`), and **the date statement is emitted
   BEFORE the content statement** because the content write stamps `updated_by` and would otherwise
   destroy the evidence the date guard reads. Ordering is load-bearing; the generator says so.
9. **Two of the new test's own assertions were weak, and one was wrong twice.** The gate accepted any
   statement merely *mentioning* `planned_send_date` (an unconditional date write would have passed),
   and its whole-file substring check could not tell a new campaign's INSERT copy from its UPDATE
   copy, so a typo in one would hide behind the other. Both tightened, and **both tightenings were
   mutation-tested** — corrupting only the INSERT body, and removing one date gate, each now fails
   the build. ⚠ Splitting this SQL on `;` is wrong (campaign bodies are prose and contain
   semicolons); that mistake was made twice while writing these tests, so the statement tokenizer
   now lives in one place with the reason written next to it.

**Refuted / accepted with a note:** the audience-routing rewrite changes no campaign's audience
(before/after mapping built and diffed); `default:` cannot be reached with an unknown key (the
allowlist and the audience map derive from the same list); opt-out handling and every permission
gate are byte-identical; reset-to-default still works for a retired campaign (deliberate — the copy
is kept); the retired campaigns' bodies still describe the January 2027 cliff (deliberate, and now
unreachable by every send path). **Accepted, pre-existing, flagged not fixed:** the GET route's
`recipientCounts` is dead — the dashboard applies only `batches` from that response and renders
counts computed elsewhere. It is now derived rather than hardcoded (a dead field that lies is worse
than one that does not) and the comment says so, but a cleanup pass should delete it rather than
maintain it. Also pre-existing: `resolvePlatformTemplate` has no `category` filter.

**Verification after the fixes:** typecheck ✓ 0 errors in touched files · the build's own tests ✓
(11 registry tests, 2 of them mutation-proved) · offer-bar browser walk re-run on the restarted dev
server, **34/34** · migration regenerated by the new script and re-applied to dev.

### Phase 2 — winter: the platform-admin Founding Season desk — `/plan` + `/billing`

1. One list: every comped organization AND coach workspace — free-period end, **card on file** (the fact
   must be recorded in the app at webhook time; today it lives only in Stripe), last activity, events run
   / roster size, contact. Export.
2. Reminder sends targeted at **"no card yet"** (a new audience) — the account-notice framing.
3. **Card saving for coach workspaces** (the SetupIntent path exists for orgs only).
4. The **2028 plan-choice checkout**: annual first, monthly available, with the saved card — replaces
   "add a payment method" as the summer ask.
5. ~~Stripe production smoke test by December 31, 2026~~ **✅ DONE — owner-confirmed 2026-09-07: the
   production smoke test was run and Stripe is live in prod.** The list-price checkout is what anyone who
   misses the window meets from January 1, 2027.
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
