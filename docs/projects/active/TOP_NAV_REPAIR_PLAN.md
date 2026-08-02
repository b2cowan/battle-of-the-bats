# Top Nav Repair Plan (2026-08-01) — decisions R1–R10 + hygiene sweep

> ## ✅ BUILD STATUS — ALL FOUR PHASES BUILT ON DEV 2026-08-01, UNCOMMITTED, owner QA pending
>
> Built off `TOP_NAV_REPAIR_BUILD_PROMPT.md`. **R1–R11 + T1 all landed**, plus the Phase 0 sweep and
> the four micro-rulings (logged in `memory/design_decisions.md`; micro-ruling (a) also had code).
>
> **Gate:** browser guards **58/58** (baseline 33/33 — 25 new assertions added across the phases, in
> `anonymous-public-invariant.spec.ts` plus two new standing specs, `coach-wall-doors.spec.ts` and
> `marketing-seam.spec.ts`); unit **816/817**; typecheck + focused lint clean; all six token ratchets
> ZERO; dev server restarted on a cleared cache, platform-admin login probe 200.
>
> **Two findings the guards caught that the audit had not:**
> 1. The tournament nav's own SSR frame emitted `href="/{orgSlug}"` for its logo and title, and built
>    its section tabs as `/{org}/null/teams` — the nav context is filled during the render, so the
>    server frame saw a null slug and fell back to the org root. On a non-public org that is a door to
>    a 404 in the first painted frame. Fixed by deriving the event slug from the URL param.
> 2. `--consumer-top-h`'s fallback on the Discover sticky search bar read `--nav-height` (the 72px
>    BRANDED row) rather than the platform chrome bar — 24px too tall had the shell var ever failed.
>
> **Three deliberate deviations from the plan text, all flagged for QA:**
> - **R4's current-tier badge says "Current plan", not "Your plan"** — that string already exists in the
>   in-app billing wizard, and inventing a second term for one concept costs more than it gains.
> - **`EntitlementOrg` was NOT widened.** R1 says "widen the type and every caller's select"; widening
>   that shared type would have forced `isPublic` onto ~100 `hasModuleEntitlement` call sites that have
>   no business knowing about it. A dedicated `OrgHomeDestinationOrg` covers the predicate's two
>   callers instead. Sitemap/directory behaviour is unchanged and asserted.
> - **The home page's hero is 40px tighter.** R5 asked for ONE clearance rule derived from the token;
>   the home page had been deriving from `--nav-height` (~72px of air) while every sibling hardcoded
>   6rem (~32px). One rule means one number, and the siblings' is the majority.
>
> **Not verifiable on this tree:** the operator strips' Workspaces pill could not be measured live —
> it self-gates at 2+ workspaces and both UAT fixtures hold one. Its geometry is token-wired and
> asserted at the token level. The coach fixture still holds ZERO workspaces (flagged to `/uat`).
>
> ### `/simplify` + `/review` complete (2026-08-01) — 4 confirmed defects found and fixed
>
> **`/simplify` (4 lenses) — 7 applied.** The one that mattered: the pricing CTA hardcoded
> `/{slug}/admin/org/billing`, which **Tournament and Tournament Plus orgs are redirected out of** —
> the largest tier would have been handed a door it cannot open, the exact defect class this pass
> exists to close. Now via the canonical `getBillingHref`, with new `lib/billing-urls.test.ts`
> covering the tier split (that resolver had no test at all). Also: the six League pages now WEAR
> the global `.container` alongside their column instead of restating its geometry (the pattern the
> tab row they align to already uses); `--nav-pill-h` derives from `--icon-door-size` rather than
> being a second literal that agrees by luck; the primary-org door is resolved once and shared;
> duplicate link/CTA branches collapsed in the marketing bar and the plan cards.
>
> **`/review` (high-risk tier, 5 lenses) — 3 CONFIRMED in this diff, all fixed:**
> 1. **High — the platform's highest tier got no "Current plan" badge.** The viewer's plan was
>    tested against `PLAN_CONFIG`, but the grid only renders four of the six real plans. A **Club ·
>    Association** (`club_large`) operator matched nothing, so no card was marked and all four read
>    "Choose X →". Fixed by testing the RENDERED set (new exported `RENDERED_PLAN_KEYS`), plus a
>    drift guard (`lib/plan-config.test.ts`) that fails the build if a new plan is added without a
>    deliberate decision about whether it gets a card.
> 2. **High — a signed-in operator could click into the sign-up funnel mid-resolve.** Until the role
>    summary landed, the grid rendered prospect CTAs whose href is a LIVE `/auth/signup` link, and
>    `/auth/signup` has no signed-in guard. Fixed with the codebase's own ratified cure — the
>    resolving flag now comes FROM the hook that owns the resolution (new `useRoleSummaryState`,
>    mirroring `usePublicFlip`), never from a caller-side probe. It clears on failure too, so a
>    fail-quiet response can't strand anyone on a dead button. ⚠ **Residual, stated honestly:** the
>    pre-hydration frame still carries the prospect CTA, because the alternative is either SSR-ing
>    identity into a cacheable page (forbidden by §5) or taxing every anonymous prospect. This is a
>    large narrowing of a pre-existing permanent exposure, not its elimination.
> 3. **Medium — the coach wall's team-workspace door was unreachable dead code.** A team workspace
>    can never own the public-site module nor run two events, so the shared resolver always says
>    "not real" for it — the `Back to Coaches Portal home` branch could never render, leaving a
>    lapsed team-workspace coach with no door back. Fixed by pointing that persona at the org-less
>    coach hub (`/coaches`), which is what the copy always meant.
> 4. **Low — floating promise.** The tournament layout creates the org-home promise early and awaits
>    it late; an unguarded query throwing in between would have left an unhandled rejection.
>    `.catch(() => null)` at creation.
>
> Also fixed: the marketing bar's Sign In / Get Started controls render at every width, and this
> pass had shaved them from ~32px to 30px — both under the tap floor. They now take the 44px floor
> at ≤900px while desktop keeps the ratified T1 pill height.
>
> **Explicitly cleared** (checked, not defects): the anonymous-public invariant holds on `/pricing`
> (no anonymous request, no identity in SSR, no shared-device replay); the sitemap/search result set
> is provably unchanged; `adminHref`'s new derivation is byte-identical to the old; no `PricingSection`
> caller regresses; the `.column > *` rule caps nothing that needed full width; the z-index moves
> collide with nothing.
>
> ⚠ **FOUND BUT NOT MINE — belongs to the concurrent practice-plan session.** That session retired
> `.ppCount` from `coaches.module.css` while `_PracticePlanEditor.tsx` still applies it to the
> "Draw them at random" group-count input. That input now falls back to `width: 100%` and will break
> the row layout. Left untouched (editing another session's in-flight work is the collision the
> branch policy warns about) — **flag it to whoever owns the practice-plan work before they commit.**

> Repair plan for the confirmed findings in `TOP_NAV_CONSISTENCY_FINDINGS.md` (the evidence base —
> every claim there was adversarially verified; this doc only plans the fixes). **No code until the
> owner rules on R1–R10.** Mockups (before/after + alternatives, one section per decision):
> see the published mockup artifact linked from the PM brief / TODO.
> Companion brief: `TOP_NAV_REPAIR_PM_BRIEF.md`.

## Ground rules carried in

- Binding rulings stay binding: 48px chrome bar / 72px branded row, width-by-surface, D1 phone-only
  frame, Stage F tier gate, operator strips carry no chat, consumer strip keeps chat, flip-beats-pill.
  Nothing below reverses any of them.
- The anonymous-public invariant (plan §5) gates every phase; both standing guards
  (`anonymous-public-invariant.spec.ts`, `org-return-flip-smoke.spec.ts`) must stay green, and
  Phase 1 adds assertions (below).
- Two audit items are explicitly **not** re-opened: signed-in acquisition chrome (ratified WI-1/WI-2)
  and the dual geometry mechanisms (complementary by construction; docs note only).

## Decisions for the owner (R1–R11 + T1)

> **RULED 2026-08-01 (owner: "I agree with your recommendations"): R1–R11 all per REC, T1 per REC,
> and "Run a tournament ▾" hides for workspace-holders alongside R11's Pricing removal.**
> Prospect-facing chrome (anonymous + workspace-less): Pricing AND Run-a-tournament both stay —
> the owner asked whether Pricing is redundant beside the menu; answered KEEP BOTH (research door
> vs action door — see R11 note below). `/strategy` to log the WI-1/WI-2 adjustment + R9 wording
> in one entry. Build may proceed per phases.

Each has a REC (recommended) and, where viable, an ALT. Mockups show both.

### R1 — Kill the 404 doors (findings D1) — Phase 1
An org with the public-page toggle off still gets event-page crumb/eyebrow links to `/{orgSlug}`,
which 404s ([tournament layout:204](../../app/[orgSlug]/[tournamentSlug]/layout.tsx#L204) omits the
`isPublic` check that [org home:42](../../app/[orgSlug]/page.tsx#L42) enforces; sitemap + directory
already check it).
- **REC — hide the door.** Fold `isPublic` into `isOrgHomeRealDestination` itself (the predicate's
  own comment claims to be the ONE statement of "is /{orgSlug} real") so every present and future
  caller — event chrome, sitemap, directory, the coach wall link (R2) — agrees by construction.
  Rail then shows the org name un-linked… no: per the existing rail rule, no `orgHomeHref` → the
  crumb line is absent (phone eyebrow renders as today's inert text). Respects the org's own
  "not public" choice; zero new surface.
- **ALT — make the destination real.** A minimal branded landing for private orgs ("‹Org› hasn't
  published a public page") behind the link. More build, contradicts the org's toggle, and
  duplicates the placeholder problem `/marketing` already owns for tournament tiers. Not preferred.
- Consequence either way: `search` (which already excludes non-public orgs) and the guards stay
  consistent. New guard assertion: a non-public org's event page renders **no** anchor to
  `/{orgSlug}` (SSR + hydrated).

### R2 — The coach "not assigned" wall gets chrome and honest doors (D2) — Phase 1
Today the wall returns before any chrome mounts: no wordmark, no account, no sign-out; its only
link is the possibly-404 `/{orgSlug}` ([coaches layout:91-116](../../app/[orgSlug]/coaches/layout.tsx#L91)).
- **REC — wall renders inside the portal frame.** CoachTopStrip (wordmark→Home · account ·
  Workspaces) above a wall card offering: Go to Home, Sign out, org contact mailto; the org link
  renders only when R1's predicate says the org page is real. A revoked coach keeps the "where am
  I / who am I / way out" triad. (Strip's own 2+-workspace guard means the pill only shows when
  meaningful — unchanged behavior.)
- **ALT — minimal:** keep the bare wall, add Home + Sign out links under the existing copy. Cheaper,
  still chrome-less; acceptable if the owner wants the wall to feel like a hard stop.
- Team-workspace variant keeps its distinct copy; same doors.

### R3 — Marketing's tablet band (D3) — Phase 2 (defect fix; confirm only)
768–900px shows both nav sets, wordmark collides, Sign In wraps. Fix: the desktop link cluster
hides below **900** (the platform's one breakpoint) instead of Tailwind's default 768; the bottom
link bar already owns ≤900. No alternative worth mocking — 768 exists nowhere else in the product.

### R4 — The pricing page, by who you are (D4) — Phase 2 · AMENDED 2026-08-01 after owner question
Owner asked: marketing header on /pricing, or app header so it feels like they never left?
**Answer recommended: neither an app-skinned brochure nor a second in-app pricing page.** One
pricing page (marketing = the single copy of the pitch, per the pricing-facts single-source rule),
three states:
- **Anonymous + signed-in fans (prospects): unchanged** — today's bar and CTAs.
- **Signed-in (all): header knows you** — Account door + "Open app →" replace Sign In / Get
  Started. Client-side post-hydration (`useClientSignedIn` pattern) — no SSR identity, pages stay
  static-cacheable.
- **Signed-in operators: page CTAs point at real actions** — current-tier card marked "Your plan";
  the upgrade card's CTA deep-links to the org's existing billing screen (coach → the coach
  premium upgrade flow) instead of the sign-up funnel. CTA copy from the same plan config billing
  already renders — no second copy of prices.
- **Rejected: app header above the marketing page** — mixes workspace chrome over persuasion copy,
  warm-strip-on-pitch-black clash, and couples marketing to app chrome; the inverted form of the
  rejected D1 "sandwich".

### R11 — Pricing leaves operators' chrome (owner direction 2026-08-01) — Phase 4
**R4 RULED ✓ same day** (owner: "still good with R4 work being completed so that page is user
aware"). Owner further directed: don't taint operators' everyday chrome with the sales link.
- **REC (per owner direction, refined):** the consumer strip's "Pricing" **hides for
  workspace-holders** (the strip already resolves workspaces client-side for the operator pill —
  same signal, no new plumbing). Anonymous + workspace-less fans keep it (ratified WI-1/WI-2
  acquisition chrome — they're prospects). Operators find plans where billing lives; R4's page CTAs
  deep-link there, and the billing screen carries the one "Compare all plans →" door out.
- **⚠ Premise correction recorded:** the app wordmark goes to the app's own Home (/discover) by the
  Zone-1 rule, NOT the marketing home — so the logo is not the operators' path to plans; billing is.
- **Open sub-question (owner to rule):** "Run a tournament ▾" is the other acquisition item and an
  org owner adds events in admin, not via the sign-up journey — recommend it hides for
  workspace-holders in the same change. Either way `/strategy` logs ONE entry adjusting WI-1/WI-2
  ("operator chrome carries no acquisition items" or the narrower Pricing-only form).
- **ALT:** relabel to "Plans" → billing screen (keeps a strip door; keeps a plan item in everyday
  chrome — the thing this decision removes).
- **RULED + follow-up answered (2026-08-01):** removal per REC, AND Run-a-tournament hides for
  workspace-holders too. Owner then asked: for prospects, is Pricing redundant beside
  "Run a tournament ▾"? **Answer: no — keep both.** Pricing is the low-commitment RESEARCH door
  (the most-visited page for a shopper; hiding price behind a CTA menu reads as "call us" and
  fights the self-serve free-tier motion); the persona menu is the ACTION door for someone already
  deciding. Precedent already in the product: customer-branded tournament pages deliberately omit
  Pricing while FLHQ-owned surfaces show it. If the pair still feels heavy later, measure first —
  the existing nav-click beacon pattern can count Pricing-link clicks before any removal.

### T1 — Chrome materials: measured consistency verdict (owner question 2026-08-01) — Phase 3
Measured across the five bars at 1440px: **materials consistent** — IBM Plex Mono labels over Inter
base everywhere incl. marketing; pill radius fully-round everywhere; icon doors one size/two radii
(ruled); wordmark = shared lockup on admin+coach (ruled), text variant on consumer (ruled),
marketing's own larger mark (rides R5). **Fine metrics NOT consistent, no reason:** nav labels
11.52 / 12 / 12.48px at three letter-spacings and two weights for one job; Sign-in pill 32 vs 34px;
the SAME shared WorkspacesPill renders 26px (admin) vs 30px (consumer) because hosts size it
locally. This is Stage G's scoped-but-never-built third ("nav type scale + pill silhouette").
**Work item: one nav-label type token + one pill-height token, applied to all five bars** — folded
into Phase 3. `/design` confirms the canonical values (recommend the consumer strip's: 12.48/600 +
30px pill).

### R5 — Marketing joins the geometry system (D11) — Phase 2
64px bar (unruled third height), 1152px column vs the 1200px `.container` its own pages use
(24px stagger), two hand-rolled clearance schemes.
- **REC — ratify 64px as marketing's own bar height** (tokenized `--marketing-bar-h`), adopt the
  1200px `.container` for the bar's inner row, and derive all page top-clearances from the token
  (one rule). Marketing is FLHQ's own branded room — its number can differ *by ruling*, like the
  72px customer row does; the defect was that nobody chose it and nothing shares it.
- **ALT-A — adopt 48px platform chrome** (marketing becomes the consumer strip's sibling). Most
  unified; costs marketing its presence and touches every marketing page's rhythm.
- **ALT-B — adopt 72px branded-row treatment.** Consistent with "branded rooms get 72" but makes
  the marketing bar taller than it is today for no user benefit.
- Either way: dead-code removal (unreachable Portal/Upgrade branch + dead path checks) rides Phase 0.

### R6 — League/Club public pages adopt the shared column (D5) — Phase 3 (defect fix; confirm only)
The Stage F tab row wears `.container` to align with the identity row; the League index + five
season sub-pages centre ad hoc 560–800px columns on the raw viewport — measured 244–304px off.
Fix: pages adopt `.container` as the outer column; existing narrow reading/form columns keep their
max-widths but **left-align inside it**, so headings sit under the active tab. Alternative
(ratify the centered narrow column) would defeat the row's stated purpose — not offered.

### R7 — The org identity row's door order (D7) — Phase 3
Operator door renders inside Account (Account outermost), against both written orders; the two
rules' scopes (§3 "everywhere" vs Stage G "strips") were never reconciled.
- **REC — grammar applies to branded rows too:** swap so Account sits inside and the operator door
  (⇄ flip / Workspaces) is outermost — matching every strip. One-line JSX order change; `/design`
  logs the scope ruling ("Zone-3 order binds ALL top bars, branded rows included").
- **ALT — ratify the exception:** branded rows keep Account outermost; `/design` logs why (e.g.
  "on a customer's page, the platform's operator door defers to the personal door"). Zero code.
  Viable, but it leaves the one corner that behaves differently for the multi-hat operator.

### R8 — Admin phone: the More sheet's consumer-Chat door (D8) — Phase 4
The You group offers `/chat` (personal, consumer chrome) while a tournament Chat tab can sit on the
same screen — two same-named doors, different rooms; the desktop strips removed exactly this door
by ruling; the mobile sheet was explicitly left un-rebuilt at the time.
- **REC — generalize the ruling:** You group becomes Home · Account (Chat row removed). Coach
  bottom nav/sheet checked for the same door in the same pass.
- **ALT — grandfather in writing:** keep the row, log "the phone More sheet is the app-doors
  drawer; the double-door is accepted" in design_decisions. Zero code; keeps the known confusion.

### R9 — Pricing on a customer's public pages at phone widths (D6) — Phase 4, `/strategy` decision
The phone shed hides Pricing on the theory the bottom bar carries it; the bar never has.
- **REC — status quo, true up the words.** A paying club's page is not our billboard (the same
  principle as D1/D3 org-branding rulings); the acquisition path already exists where it belongs
  (free-tier event pages carry the banner + powered-by). Fix the shed comment and the recorded
  ruling wording so they stop over-claiming ("the bar provides Discover/Account/Sign-In; Pricing
  is deliberately dropped on customer pages at phone widths").
- **ALT — restore Pricing for anonymous phone visitors only** in the 72px row (signed-in keeps the
  clean row). Serves the "parent decides to run their own event" case at the cost of platform
  presence on a customer's page — that's a packaging judgement, hence `/strategy`.

### R10 — The suspended-account page (D10) — Phase 4
Copy says sign-out is the only action; chrome offers the full working 4-tab app (Chat/Account do
work).
- **REC — the copy tells the truth** ("Your access to this workspace is paused… you can still
  browse Scores and manage your account below"), chrome unchanged. Smallest honest fix.
- **ALT — state-based chrome:** suspended users get the signed-out tab set (Home/Scores/Sign-out).
  More correct-feeling severity, more build, and it hides doors that genuinely work.

### Micro-rulings bundle (no mockups — `/design` to log one sentence each) — Phase 4
Recommendations: **(a)** rail vs phone org-name: adopt the phone rule everywhere (name always
renders; it's a link only when the org page is real) — the rail currently dropping the org's NAME
on lower tiers loses information, not just a link; **(b)** consumer variant's phone wordmark bar:
ratify as-is (the base app has no other identity anchor; tournament/coach substitute their own);
**(c)** day-of shells (scorekeeper/check-in/platform-admin): wordmarks stay deliberately inert —
log it and add the one-line "ruled exception" comment each file lacks; **(d)** check-in gets no
flip door (no public twin to flip to) — log as considered-and-declined rather than unexamined.

## Phases (build order after rulings)

- **Phase 0 — hygiene sweep (no owner gate, no visual change except one).** Stale comments
  contradicting rulings (coach layout, AdminChrome, ConsumerNav, plan 44px lines); fallback sweep
  (44px/48px/64px stragglers → tokens; consumer `3rem` → `--chrome-bar-h`); marketing dead code;
  "Sign In"/"Sign in" casing (canonical: **Sign In**); z-index pair (notification/What's-New 1100
  tie; toast-over-panel); scorekeeper adopts `--hud-surface` + shared 52px constant (**visible**:
  scorekeeper's background matches check-in's — flagging, not gating); day-of exception comments;
  docs truing (geometry-mechanisms note).
- **Phase 1 — the 404 family:** R1 + R2. New guard assertions: no `/{orgSlug}` anchor on a
  non-public org's event pages; the wall (rendered for an assignment-less member) contains Home +
  sign-out doors and no dead link.
- **Phase 2 — the marketing seam:** R3 + R4 + R5. New assertion: at 820px exactly one nav set
  renders on `/`; signed-in `/pricing` shows no "Sign In".
- **Phase 3 — paid-surface polish:** R6 + R7. Assertion: tab-row track left edge == first content
  heading left edge (±8px) on the League index + one season page.
- **Phase 4 — rulings tail:** R8 + R9 + R10 + R11 (if ruled yes) + micro-rulings logged.

Every phase: `verify:changed`, focused lint, both standing guards; measurement re-run
(scripted, not eyeballed) for the phase's surfaces; `/review` offered per repo rule after each
substantive phase.

## Out of scope (already tracked elsewhere)

Stage H mobile pass; the org light/dark setting; the rep-teams index page (Teams tab); the
platform-admin `next=` open redirect (security, independent); UAT coach fixture reseed (`/uat`).
