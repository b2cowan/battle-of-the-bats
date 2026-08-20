# Pre-Sales Walkthrough Layer — Plan

**Status:** APPROVED 2026-08-19 (owner accepted all four recommendations in-session) ·
**P1 BUILT 2026-08-19, owner QA owed (ledger §65)** — capture pipeline
(`lib/marketing-shots.ts` + `scripts/capture-marketing-shots.mjs`, `capture:marketing-shots` /
`check:marketing-shots`, the check wired into `verify:changed`), all 5 tournament shots captured
first-run from the dev demo world, `/for-tournament-organizers/walkthrough` live, persona-page
link in. typegen+typecheck ✅ · focused lint 0-err ✅ · verify:changed green through every gate
except the PRE-EXISTING schema-parity drift (Families Book + Payables tables, other sessions'
work, no migration here); post-parity checks run individually, all ✅. Phone-width captures are
width-capped on desktop. ⚠ Known weakest visual (named in §65): the bracket capture at 390px —
wide crop, unreadable card text; owner rules on v1 acceptability. ⚠ Playwright note for anyone
screenshotting the PAGE itself: its images lazy-load, so a fullPage screenshot without a
scroll-through captures empty frames — that is the tooling, not the page.
**Mockup spec (owner-approved):** https://claude.ai/code/artifact/6f16bc17-d5f3-45b6-bd03-b6df54231f15
**PM brief:** [PRESALES_WALKTHROUGH_PM_BRIEF.md](PRESALES_WALKTHROUGH_PM_BRIEF.md)

## What this is

A problem-first, screenshot-backed "90-second walkthrough" layer that sits between the persona
pages (prose claims) and the live demos (full product, exploration required). Each persona gets a
scroll page of panels: one recognizable volunteer pain → one REAL screenshot of the live demo
world → one sentence in brand voice → a quiet "see this screen live →" door into the demo.
Same structured content later renders as present mode (full-screen deck) and a print/PDF
leave-behind.

Research grounding (2026-08-19, five parallel readers): the public site has **zero product
screenshots anywhere**; persona pages open problem-first (4 pain cards) then go feature-led; the
demo tours are proof-of-capability copy, not problem-first; no prior plan covers this layer
(closest: codex_COACHES_STANDALONE_RESEARCH.md §2D proposed segment landing pages with
screenshots, never built).

## Owner decisions (2026-08-19, all binding for this build)

1. **Persona order:** tournament organizers first → head coaches second → president/club later
   (ends in express interest, feeds the 2027 tier-expansion list).
2. **Demo links land at the front door.** The doors deliberately take no destination; curated
   deep-link landing moments are a SEPARATE future decision — do not build them in passing.
3. **Scroll page before present mode.** The scroll page works unattended and outreach emails can
   link it immediately; present mode is a rendering pass on top (Phase 2).
4. **Real captures from day one** — hand-run is acceptable, drawn/faked screenshots are not
   (they'd contradict /demos' honesty claim that what you see is the real software).

## Binding constraints (from BUSINESS_DECISIONS.md / brand docs / CLAUDE.md)

- Demos stay UNGATED; this layer routes TO them, never intercepts. No new nav item, no second
  chooser — linked from persona pages (and outreach emails), ask-first/proof-second on every
  surface: "Start free" leads, walkthrough and demo links follow.
- No prices or promo dates on top-of-funnel surfaces. Plan NAMES are fine and required where a
  feature is gated (full canonical names only: "Tournament Plus", "Premium Coaches Portal").
- Brand voice: practical/direct/warm; forbidden-word list applies (no "powerful", "seamless",
  "streamline", "intuitive"…). Never name competitors — position against "the old way".
  Never "Canadian" outside factual CAD-pricing callouts.
- Availability claims read the live plan gate (`lib/plan-gating-server`), never hardcoded.
- **Screenshots come ONLY from `riverdale-*` demo orgs — enforced by the capture script's guard,
  same as help shots.** Never a real org. Captures suppress sandbox chrome (banner/dock/tour).
- Panel sentences that quote specifics (scores, counts, names) must match what the capture shows
  — this is the demo-drift lesson applied to a new surface. When the demo world re-anchors and a
  number changes, the copy must not quote perishable numbers; describe the screen, don't read it
  aloud, unless the number is anchored by the seed.
- Pain copy must not fork from `lib/plan-article-content.ts` painItems — same voice, no parallel
  contradicting bank. Where a walkthrough pain overlaps a persona-page pain card, keep the
  vocabulary consistent.

## Architecture

- **`lib/marketing-shots.ts`** — typed manifest, sibling of `lib/help-shots.ts`: id, persona,
  door, path (riverdale-only), ready, prepare?, clip?, width, size (written back), alt, caption.
  Output: `public/marketing/{persona}/{id}.png`.
- **`scripts/lib/shot-capture.mjs`** — THE shared capture core (extracted by the 2026-08-20
  /simplify pass, which found the duplication had already diverged: the timezone fix existed in
  one copy only). Owns the mechanics once: demo-world guard (upgraded to `isDemoOrgSlug` from
  `lib/demo-org.ts` — allow-list, not prefix), doors named from `lib/sandbox-door.ts`,
  one-door-press-per-run (public door rate limit: 10/10min/IP), landed-path re-check,
  `visible=true` selector discipline, sandbox-chrome suppression, org-timezone contexts,
  size write-back, `--check`/`--list`/`--only`. Both `capture-marketing-shots.mjs` and
  `capture-help-shots.mjs` are now thin wrappers over it (manifest + output root + hints);
  the help script gained the timezone pin through the core. Verified end-to-end: both --check
  modes, a full 5-shot marketing run (public + tournament doors), one help capture (coach door,
  write-back idempotent, test asset restored).
  **Deliberate keeps:** `networkidle` on shot navigation stays (capture reliability beats a few
  hundred ms in a dev tool — a half-loaded screen photographed is the failure this system
  exists to prevent); sequential capture stays (simplicity over ~2× dev-tool wall-clock).
  **Deferred by /simplify (2026-08-20), on the record:** (1) a shared marketing hero/CTA/door
  component (`SeeItLiveLink` / pitch hero) — the walkthrough is the 5th–6th instance of a
  duplication pattern all four persona pages already share; fixing only this pair would be
  inconsistent — belongs to a dedicated sitewide marketing-page cleanup; (2) wiring
  `check:help-shots` into `verify:changed` — pre-existing asymmetry, defensible (help images
  are optional figures, marketing images are the page's spine), separate small change if parity
  is wanted. ⚠ Alt texts must be CYCLE-PROOF: the demo replays its game day, so a capture can
  show any phase — describe the durable shape, never one phase's specifics (the bracket alt
  was caught describing a champion banner the next capture didn't show).
- **`components/marketing/WalkthroughPage.tsx` + `WalkthroughPage.module.css` +
  `WalkthroughPresent.tsx`** — THE renderer, shared by every persona (extracted at P3, its named
  trigger). Public server component in the persona pages' visual system; it owns the scroll page,
  present mode and the print leave-behind. Panel content typed per persona in
  **`lib/walkthrough-content.ts`**, which also carries everything else a walkthrough differs by:
  its route (`path` — canonical URL *and* the address printed on the PDF), `seo`, its `door`
  (each sandbox keeps its own door constant — "which account does this sign in" stays a
  compile-time constant, so the door is named, never derived from `persona`), and its `back`
  link. Images render with manifest alt/caption + reserved size (no CLS).
  **A new persona costs a content entry and a two-line route shell.**
- **Persona page links** — one link from each persona page's pain section ("See them fixed on the
  real screens — the 90-second walkthrough →"), same spec on both. Door CTAs on the walkthrough
  gate on `sandboxDoorsVisible()` exactly like the persona pages.
- **Drift guard:** wire `capture-marketing-shots.mjs --check` next to wherever help-shots
  `--check` runs (or add to `verify:changed` if help-shots isn't wired — confirm during build).
  Note: DEMO_SANDBOX_DRIFT_GUARDS Measure 3 (unbuilt) wants the same Playwright freshness
  machinery; building it is NOT in this plan's scope but the manifest should not preclude it.

## Phases

- **P1 (this session):** capture pipeline + 5 tournament captures + tournament walkthrough page +
  persona-page link + copy trued against real captures. The five panels (from the approved
  mockup): (1) fan's live-score public view · (2) Scorekeeper View + Staff Kit · (3) Rain delay
  re-time + one notice · (4) Playoff Picture/bracket from live standings (plan-tagged Tournament
  Plus, free plan's inline editor named) · (5) Registration Health card. Panel set may flex
  ±1 if a screen proves uncapturable in the demo world's seeded states — record any drop here.
- **P2: BUILT 2026-08-20 (QA §65 Part B owed).** Present mode: `Present.tsx` client component
  (+ own module CSS) renders the SAME `walkthrough-content` source as 7 slides (hero, 5 panels,
  closing) — trigger is text-weight under the hero meta; arrows/space/click advance, Esc/Exit
  restores scroll + focus; slides carry no buttons by design. Print/PDF: `@media print` in the
  page module (locally scoped — purity + zero-literal ratchets green) does one-panel-per-page
  with `print-color-adjust: exact` (dark kept deliberately: the artifact is an EMAILED PDF;
  paper is ink-heavy — owner rules), hides all interactive furniture, and shows a print-only
  URL line. Verified: lint/typecheck ✓, Playwright walk (open → arrows through 7 → overshoot
  clamps → Esc restores) ✓, print-media emulation + real `page.pdf()` render ✓. Known v1 rough
  edges (named in §65 B): global nav prints on PDF page 1, site footer on the last page —
  hiding them needs a global print rule (shared-chrome blast radius), deferred to the owner's
  verdict. ⚠ Playwright print checks must scope image-load waits to `/marketing/` images:
  a global print stylesheet can hide OTHER images (footer QR) before they lazy-load, and an
  every-image wait times out on the tooling, not the page.
- **P3: BUILT 2026-08-20 with TWO of its three panels (QA §66 owed).** `/for-coaches/walkthrough`
  + the persona-page link + sitemap entry. Panels: **Player Dues** (mid-season 12U) and
  **Season settlement** (off-season 14U). Present mode and the print leave-behind came free with
  the renderer extraction and were both verified on the new page.
  - **The renderer is now shared** — `components/marketing/WalkthroughPage.tsx` (+ its module CSS
    and `WalkthroughPresent`), which the /simplify altitude ruling deferred "until the second
    consumer". Everything a walkthrough differs by (story, door, way back, address, SEO) is data
    on `Walkthrough`; both route files are two-line shells. **The organizer page was proved
    unchanged three ways:** its server-rendered `<main>` is byte-identical to HEAD's, the moved
    CSS differs by one comment line, and a full-page render of HEAD's component beside the new
    one is **pixel-identical** (with the fixed site nav hidden — that chrome overlays the top
    band and its scroll state settles independently, which is the only thing that ever differed).
  - **Capture core gained `readyAfterPrepare`** (both callers): a wait for what the prepare
    clicks OPENED. The settlement sheet fetches when it opens, so the fixed post-click pause was
    a race against a "Loading…" line.
  - ⚠ **The PHASE is the picture.** The two money shots come from two different demo teams on
    purpose. Photographed mid-season, the settlement sheet is honest and useless — a team
    half-way through its spending is legitimately in the red, so every family's "refund" shows
    as a debt and the panel's point inverts. Captured on the off-season team it shows what the
    pain describes. (The season's-end team is not an option: its season is closed, and the
    season gate sends every money route to the closed-season page.)
  - ⚠ **THEME was a false alarm worth recording.** The capture core builds every context with
    `colorScheme: 'dark'` and the coach portal is warm — but nothing in the app reads
    `prefers-color-scheme` at all. The portal's palette comes from a `data-user-theme` attribute
    that defaults to **warm** with no stored preference, so a fresh capture context photographs
    exactly what a coach's first visit renders. No core change was needed.
  - **⚠⚠ TWO MOCKUP CLAIMS WERE FALSE AGAINST THE CODE AND WERE NOT SHIPPED:**
    1. *"[Season Settlement] won't let you close the books until every family is made whole."*
       Closing a season **WARNS, NEVER BLOCKS** (owner ruling 2026-08-18) — the close handler is
       a bare status flip with zero money checks and the modal's primary button is never disabled
       by money. What genuinely refuses is the settlement sheet's **bulk payout**, gated on
       `closeOutBlockers().canClose` (dues collected · enough cash held · no club request still
       pending). The panel says that instead.
    2. *"automatic overdue reminders."* The scheduled sweep runs two waves **30 and 7 days BEFORE**
       an installment is due — ahead of the date, not after it — and the never-paid nudge stays
       deliberately manual (it has no sent-stamp, so automating it would re-email daily). The
       panel now separates the two.
  - **/simplify (4 lenses) + /review (4 lenses), 2026-08-20 — what they caught.** /simplify: an
    invariant `back.label` re-typed per persona (now renderer-side copy); the caption riding into
    the client payload on every slide (split into `PresentImage` + caption); `walkthroughMetadata`
    living in the renderer rather than beside the `seo` data it transforms; raw team UUIDs in the
    manifest instead of `DEMO_COACH_TEAM_IDS`; a duplicated wait idiom in the capture core. The
    `.walkthroughLink`/`.seeItLive` CSS duplication was re-confirmed as the already-recorded
    sitewide deferral and deliberately left alone. /review confirmed and fixed three real ones:
    1. ⚠ **A COPY OVERCLAIM.** "Money a family raised fundraising comes off their own bill" is
       only true for two of the three `credit_application` modes — `keep_separate` deliberately
       does the opposite ("Credits don't reduce bills — settled at season's end"). Unqualified it
       would be FALSE for any team on that mode. Now reads "…or waits for season's end — your
       call." (The demo world pins the default, so the PICTURE was never wrong — only the words.)
    2. **The capture core's demo-world re-assert was left behind by its own new wait.** `ready`,
       the prepare clicks and `readyAfterPrepare` can each sit 20s, and the last origin+path
       assert happened before all of them — a window this build had just widened from ~0.6s to
       ~20s. There is now an assert **immediately before the shutter**. (Not exploitable by the
       shipped shots — the settlement door is a pure client-state toggle — but it is the shared,
       safety-critical path.)
    3. **The dev-badge fix was hiding Next's ERROR overlay too** — same React tree, same
       `nextjs-portal` host — which would have let a page that broke *after* its ready selector
       resolved be photographed with its red-flag suppressed. Now a style is injected INTO the
       shadow root to hide only `#devtools-indicator`, leaving the error overlay to do its job.
    Refuted by verification: the `.ts`-extension import producing duplicate module instances (the
    pattern already ships via `help-shots.ts`, and `demo-org`'s map is built from a frozen literal
    so two instances could not disagree); any PII in the new PNGs (every name traces to hardcoded
    fictional seed literals; no metadata in the binaries); `readyAfterPrepare` hanging CI (bounded
    20s, per-shot try/catch, and `--check` never opens a browser). Recorded, not fixed: the door
    label differs from the persona page's for the same door on BOTH personas (mockup's wording —
    owner rules, QA §66).
  - **⚠⚠ THE A11Y LENS FOUND A CRITICAL FUNCTIONAL BUG IN P2'S PRESENT MODE — fixed here.**
    The deck had **no focus trap**: `aria-modal="true"` is only a hint, nothing enforces it, so
    Tab walked past the footer buttons onto the page behind — links that are invisible (an opaque
    deck covers them) and unreachable (body scroll is locked) but still live. Enter on one fired a
    real navigation into the demo, ejecting a presenter mid-pitch, silently. Now traps both
    directions (verified: 8×Tab + 5×Shift+Tab all stay inside; arrows, Esc, focus-return and
    scroll-restore unaffected). `.footBtn` also shipped at 38.4px under a comment claiming a 44px
    floor — corrected to 44. **Left for the owner (QA §66) because each changes the ORGANIZER
    page's appearance while §65 is still unwalked:** the per-panel demo link is **15px tall** on
    every panel of both pages, under the **24px WCAG 2.2 AA floor** (pre-existing since P1; this
    build doubled its reach); the present trigger is 28px; and both pages nest a `<main>` inside
    the layout's `<main>` — pre-existing on every persona page, but now centralized in one
    component, which makes this the cheap moment to fix it once for all of them.
    Measured clean: heading order, alt text, CLS, all 8 contrast pairs (7.7:1–17:1 vs 4.5:1
    required), print scoping, reduced-motion gating, and the scroll-lock lifecycle including the
    unmount-while-open path. ⚠ **`check:layout` covers only the 28 coach-portal screens — not one
    marketing page is in its registry**, so these tap-target defects would have shipped silently;
    adding the marketing routes to it is a small, separate, worthwhile change.
  - **⚠ FOUND IN PASSING, PRE-EXISTING, NOT FIXED HERE:** `public/help/coaches/money-record-payment.png`
    **ships with the Next.js dev-tools badge painted over the portal's nav**, obscuring a label —
    it is one of only two unclipped shots, which is why it went unnoticed. The core now prevents
    the class; the image itself needs one `capture:help-shots --only=…` run. Its sibling
    `money-budget-vs-actual-months.png` is older (2026-08-14) so a re-take there also picks up
    six days of demo drift — check what it says before re-shooting it.
  - **THE THIRD PANEL (bench console) IS NOT BUILT — the demo world cannot photograph it**, for
    three independently verified reasons: the console's live face exists only inside a real game
    window (**Saturdays 07:00–14:00 Toronto** for the demo team, ~7h/week, so it is not
    re-capturable on demand); the demo's Saturday game is seeded with **no lineup on purpose**,
    so the bench board never renders; and game rows take a **fresh random id every reseed** while
    **no link anywhere in the portal** reaches a past game's console, so nothing can address it
    stably. Fixing this means changing the seeded demo world (fixed event id + a saved lineup),
    which undoes a deliberate demo design decision and needs its own session. The P1 rule already
    allows the panel set to flex ±1; **the owner's options are recorded in QA §66** — ship at two,
    change the demo world, or substitute a pain the world can show today (playing-time report, or
    the family-recap preview, which renders the family's own component).
- **P4 (later, separate owner sessions):** president/club walkthrough ending in express
  interest; curated demo deep-links (needs an owner ruling on the door design); outreach email
  templates linking the walkthroughs.

## /review results (2026-08-20, high-risk funnel: 4 lenses, deterministic gate first)

Confirmed + fixed in-session: (1) **the page used the repo's FIRST-ever `next/image`** — swapped
to plain `<img>` per `components/help/HelpScreenshot.tsx`'s documented precedent, avoiding the
request-time sharp optimizer path with a recorded Amplify outage class
(`memory/reference_sharp_turbopack_webpack.md`); (2) **plan-honesty**: the Registration Health
panel claimed "who's paid" unqualified while the Payments tile is Tournament-Plus-gated — panel
now carries the plan tag; (3) "emailed to every coach" softened to "sent" (email is a per-user
channel, not guaranteed); (4) walkthrough added to `app/sitemap.ts`; (5) capture core hardened —
landed check now asserts ORIGIN as well as path, and re-asserts after prepare clicks (which can
navigate); (6) closing copy reworded so it cannot read as tension against /demos' "not
recordings or screenshots" claim. Refuted by verification: the guard bypass attacks (dot-segment,
protocol-relative, absolute-URL, encoded/uppercase slugs — all fail closed via the landed
re-check); behavior parity of the extraction vs the old help script (verified line-by-line
against `git show HEAD:`). Advisory, not fixed: public-door shots get a generic timeout instead
of the friendly "not seeded" message; the write-back regex doesn't escape ids (repo-controlled).

⚠⚠ **COMMIT-STAGING TRAP (from the review): `public/marketing/tournament/*.png` are new binary
assets that `verify:changed` now HARD-REQUIRES. They must be staged in the same commit as the
code — a commit that takes the code and forgets the images breaks `verify:changed` for every
other session until someone re-captures.**

## QA / verification

- Owner QA ledger row owed when P1 lands (browser walk of the walkthrough page, phone + desktop).
- Static: focused lint + typecheck (new lib module), `verify:changed`.
- The walkthrough page is public and stateless — no auth, no SW-denylist impact, no migration.
- Help-docs sync: not needed (marketing surface, not an in-app flow). Demo-copy check: the
  walkthrough QUOTES the demo world, so any future demo reseed that changes anchored fixtures
  must re-run captures — the --check wiring plus this note are the guard.

## Risks

- **Demo world state on dev** — captures need the dev world seeded/fresh (`npm run check:demos`
  self-heals dev). The live event replays on a cycle; ready-selectors must assert content, and a
  capture run may need re-running to catch a photogenic moment. Prefer anchored events (finished
  / upcoming) for shots that don't need "live".
- **Door rate limit** — one context per world per run; never per-shot.
- **Screens whose access model differs** (Scorekeeper View may be token/QR-based) — resolved
  during build; if a screen can't be reached with the demo session, swap the panel for one that
  can and record it here.
