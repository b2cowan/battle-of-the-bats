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
- **`app/for-tournament-organizers/walkthrough/page.tsx` + `page.module.css`** — public server
  component in the persona page's visual system. Panel content typed and colocated per persona in
  **`lib/walkthrough-content.ts`** so Phase 2 (present mode) and Phase 3 (coach) render the same
  source. Images render with manifest alt/caption + reserved size (no CLS).
- **Persona page link** — one link from /for-tournament-organizers' pain section ("See these
  fixed on real screens → the 90-second walkthrough"). Door CTAs on the walkthrough gate on
  `sandboxDoorsVisible()` exactly like the persona pages.
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
- **P3:** coach persona walkthrough (Player Dues, Season Settlement, bench console/one-final-
  score-notification — warm-theme captures) linked from /for-coaches.
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
