# Help Docs — Scannable Format (Plan)

**Status:** Owner-approved 2026-08-14 (direction + format standard ratified; mockups artifact
`2499e60b-f83c-4ee8-97c9-b0ce9cd9bb48` "Scannable Help"). **Steps 1+2 BUILT on dev
2026-08-14** — sub-topic contract + shared renderer (guide chips/headings, drawer expanders,
deep links, searchable titles, HelpSteps/HelpDefs/HelpNote primitives) and the Money topic
converted to overview + 10 sub-topics. Owner QA = ledger **§18**. Typecheck + focused lint +
unit tests (help-subtopics) + token guardrail all green; renderer is a no-op for every
unconverted section. ⚠ `HelpBlocks` carries a load-bearing `'use client'` — the help page
shells are server components, and guide prose crosses that seam only as client-module
references (see the component's header comment). **Owner QA §18 PASSED 2026-08-14; /simplify +
/review run same day post-QA — 5 confirmed findings fixed:** per-page `subtopicId` drawer
targeting on all 9 Money screens (`HelpRequest.subtopicId` → `defaultOpenSubtopicId`); the
drawer closes on pathname change (render-time reset in HelpDrawerProvider — query changes like
the Money hub's `?section=` tab switches deliberately keep it open); jump chips and `#` anchors
use the shared `followHashLink` contract (`components/help/help-scroll.ts` — no history push,
no double smooth-scroll); `resolveSubtopicId` always folds the index into fallback anchors so
same-slug titles can't collide (fallback shape `-t-<slug>-<n>`, explicit ids unaffected,
pinned by tests); the $100/$300 worked example restored to the dues sub-topic. `/simplify` had
collapsed the drawer expanders onto the FAQ accordion chrome (shared `HelpAccordionItem`,
three consumers) and unified the three deep-link lookups into one `hashTargets` table.
Advisories logged, not fixed: search hits on a sub-topic title land at the section top (the
jump chips make the hunt short — revisit if it generates noise); `--help-accent` is scoped to
`.helpPage`/`.helpDrawer` only (documented in the CSS). Steps 3 (remaining long topics) and 4
(screenshot pipeline) below remain to build.
**PM brief:** `HELP_SCANNABLE_FORMAT_PM_BRIEF.md`
**Owning agent:** `/docs` (format standard is encoded in `.claude/commands/docs.md` §"Content format standard")

---

## 1. Problem (measured 2026-08-14)

The help system's structure stops one level too high. Guides have a TOC, search, deep links, and a
shared renderer feeding both the full guide and the in-context "?" drawer — but **inside a section**
content is an unbroken paragraph run:

- ~1,300 `<p>` across the nine content modules; **7 `<h4>` total**; ~137 lists.
- The worst case, `coaches.tsx` `premium-money` ("Managing your team's money"): **28 consecutive
  paragraphs, ~4,700 words**, shown *in full* in the narrow drawer on every Money page.
- Each paragraph opens with a `<strong>` lead-in doing a heading's job — the structure exists in
  spirit but is not navigable, jumpable, or skimmable.
- Zero images anywhere in help; every spatial "where is it?" answer is prose.

## 2. The three moves (owner-ratified)

1. **Sub-topics.** A long section becomes a 1–2 sentence overview plus titled sub-topics.
   Drawer: sub-topics render as uncontrolled `<details>` expanders (the existing FAQ pattern) — a
   menu of answers. Full guide: real sub-headings with stable anchors + a jump-chip row at the top
   of the section. Sidebar TOC unchanged (sub-topics live *inside* the section).
2. **Scannable patterns.** Content that is secretly a list becomes one: numbered **steps** for
   "how do I…", **definition rows** for "what does X mean", short bullets for rules,
   **callouts** (existing `HelpCallout` variants) for the one caution/tip that matters. Prose stays
   for genuinely narrative ideas.
3. **Screenshots, sparingly.** A framed, captioned, tap-to-enlarge figure, used only where the
   answer is spatial ("where is that control?") or visual (a complex form / a report the reader
   must recognize). Captured **only** from the seeded demo worlds by a script, tracked in a
   manifest so product changes can name the images they touch.

## 3. Format standard (binding for all new/edited help content)

Encoded in `.claude/commands/docs.md`; summarized here as the canonical statement:

- **A section longer than ~6 paragraphs must be sub-topics.** A paragraph that is secretly a list
  must be a list.
- Every sub-topic gets a stable anchor id; support/deep links target the sub-topic, not the wall.
- Procedures → numbered steps (imperative voice, one action per step, ≤6 steps before splitting).
- Term explanations → definition rows (term | meaning), not serial bolded sentences.
- Max one callout per sub-topic; callouts carry the exception, never restate the body.
- Screenshots are **opt-in and rare**: only where text can't carry it; always demo-world data;
  always a standalone caption + alt text; always registered in the manifest with their capture
  route. A screenshot that can't be re-captured from the demo world is removed, not kept stale.
- Search contract is unchanged and still applies: rendered content is NOT searched — terms must
  appear in `keywords` / `searchText` / `answerText`. Sub-topic **titles** join the section search
  haystack (see §4.1).
- Short sections (≤6 paragraphs) need no conversion. This standard targets long topics.

## 4. Technical design

### 4.1 Step 1 — sub-topic support in the contract + shared renderer

- `lib/help-content/index.ts`:
  - `export interface HelpSubtopic { id?: string; title: string; content: ReactNode }`
  - `HelpSection` gains optional `subtopics?: HelpSubtopic[]` (coexists with `content`, which
    becomes the overview/intro when subtopics are present).
  - `resolveSubtopicId(sectionId, subtopic, index)` — same single-source pattern as
    `resolveFaqId` (`${sectionId}-t-${slug(title)}` fallback), so guide + drawer can never diverge.
- `components/help/HelpSectionBlock.tsx` gains a `presentation: 'guide' | 'drawer'` prop
  (default `'guide'`, drawer passes `'drawer'`):
  - **guide:** jump-chip row (anchor links, only when `subtopics.length >= 3`), then each subtopic
    as `h4`/`h5` (one level under the section heading) with `id` + a subtle `#` anchor affordance,
    ruled top border.
  - **drawer:** overview paragraph(s), an "In this topic" label, then one `<details class=topic>`
    per subtopic — uncontrolled, like the FAQ accordions, so reader toggles survive re-renders.
    First subtopic MAY default open when the drawer request maps to exactly one section.
- `HelpPageLayout.tsx` hash handling: extend the deep-link/scroll-spy resolution so a
  `#<subtopicId>` hash scrolls to the subtopic (sections keep owning the TOC/scroll-spy; subtopic
  hashes just scroll). Search: subtopic titles concatenate into the section's searchable haystack.
- `components/help/help.module.css`: styles for jump chips, subtopic headings, `.topic` expanders,
  steps list (`ol` with numbered discs), definition rows (`dl` grid), all per the approved mockups.
- **No content converted in this step** — renderer must be a no-op for every existing section
  (all current sections have no `subtopics`). That property is the step's acceptance test.
- Tests: unit tests for `resolveSubtopicId` stability/uniqueness (built:
  `tests/unit/help-subtopics.test.ts`). The promised render-parity test was **not built** —
  the node-test runner can't import the component (CSS-module + next/link imports); the no-op
  property is instead covered by owner QA §18's "unconverted guide renders exactly as before"
  step and by no other section declaring `subtopics`. Revisit if a JSX-capable test rig lands.

### 4.2 Step 2 — convert the Money topic end-to-end

- `premium-money` in `lib/help-content/coaches.tsx` → overview (2 sentences, current `summary`
  stays) + ~8 subtopics along the lines the owner approved:
  1. The three dashboard cards (definition rows) + Next 30 days
  2. Getting around the seven Money screens (Plan → Collect → Spend → Review)
  3. Building your season budget (starter, estimated total, fundraising lines)
  4. Spreading costs across the season (periods, splits, month view)
  5. Player dues & recording payments (steps + overpayment callout)
  6. Payables & the payment schedule
  7. Imports, exports & templates (incl. phone behaviour)
  8. Tags + assistant access
- Section-level `keywords`/`searchText`/`faqs` stay exactly as they are (search is unchanged);
  prose is **re-set, not rewritten** — same facts, same brand voice, list/step/definition form.
- Grep-check every anchor that targets `premium-money` still resolves (section id unchanged).
- `/docs`-style verification + `npm run lint:focused`; typecheck (shared contract changed in 4.1).

### 4.3 Step 3 — remaining long topics, by size

Priority order = paragraph count within one section: remaining `coaches.tsx` giants (game-day,
staff/assistants, tryouts), then `tournaments.tsx`, then `platform-admin.tsx`/`org.tsx`. Each
conversion is a small, reviewable diff; short sections are left alone.

### 4.4 Step 4 — screenshot pipeline + first images

- `components/help/HelpScreenshot.tsx`: `figure` — image (lazy, `alt` required), caption bar,
  tap-to-enlarge via native `<dialog>`; optional highlight-ring overlay positioned by the manifest
  entry. Dark-portal frame per the approved mockup.
- Assets: `public/help/<module>/<slug>.png`. Captured at fixed viewport(s) (1280 desktop; 390
  mobile only when the answer is mobile-specific), portal dark theme.
- Manifest: `scripts/help-shots/manifest.mjs` — one entry per image: `{ file, route, world:
  'riverdale-ridge' | 'riverdale-minor-ball', viewport, selector?, highlight?, note }`.
- Capture script: `scripts/capture-help-shots.mjs` (Playwright is already a dev dependency via
  /uat) — walks the manifest against a local dev server pointed at the seeded demo world, writes
  PNGs deterministically. Re-run = refresh all. **Never captures non-demo data.**
- Drift stance: a product change that touches a manifested route re-runs the capture for its
  images in the same unit of work (mirrors the demo-sandbox reflex in CLAUDE.md). A
  `check:helpshots` gate is a candidate later measure, not part of this plan.
- First batch (deliberately small, "where is it?" answers only): Record payment door,
  Generate installments window, Budget vs. Actual month grid, Import preview verdicts.

## 5. What does NOT change

- Search behaviour and its metadata contract; sidebar TOC; section `id` anchors; hub cards;
  the one-renderer/two-doors guarantee; the drawer's page→section mapping; FAQ accordions.
- Existing short sections.

## 6. Verification & risks

- Steps 1: `npm run typecheck` (shared contract) + unit tests + no-op render proof.
- Steps 2–3: `npm run lint:focused` per module; anchor grep per converted section; owner
  browser QA per the ledger when a batch lands.
- Step 4: capture script run twice must be pixel-stable on unchanged UI (determinism check).
- Risks: drawer regressions on pages mapping multiple sections (test both arms); subtopic anchor
  collisions (resolver enforces uniqueness); screenshot staleness (mitigated by manifest +
  demo-world capture; the standard mandates removal over staleness).
