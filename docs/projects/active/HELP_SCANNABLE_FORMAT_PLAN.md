# Help Docs — Scannable Format (Plan)

**Status: Steps 1–5 BUILT on dev 2026-08-14. Step 6 (the article view) is NOT built — it is
gated on owner sign-off of the published mockups (§4.6).** Owner QA §18 batches 1–7. Coverage:
**29 of 147 sections carry sub-topics**, zero sections over the corrected standard, and the
screenshot pipeline is live with its first two pictures.

⚠ **CORRECTION 2026-08-14 — this plan's "zero sections over the standard" claim was true only
under a broken yardstick.** The standard counted paragraphs, so it could not see a list: "How to
run tryout day" is **1,386 words** — longer than every topic the sweep converted — but it is
three paragraphs plus one 16-item list, so it scored 3¶ and was never touched. The standard now
measures **words of body copy, list items included** (>~350 words converts), and
`npm run measure:help` is the executable copy of the counting method. Under the corrected
yardstick eight sections were still walls; they are listed and converted in §4.5.

Owner-approved 2026-08-14 (direction + format standard ratified; mockups artifact
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

- **A section over ~350 words of body copy must be sub-topics** (corrected 2026-08-14 — the
  original "~6 paragraphs" wording counted `<p>` and was blind to lists; see the correction at the
  top and `npm run measure:help`). A paragraph that is secretly a list must be a list.
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
- Short sections (≤~350 words) need no conversion. This standard targets long topics.

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

Priority order = paragraph count within one section. Each conversion is a small, reviewable
diff; short sections are left alone.

**Batch 1 DONE 2026-08-14** (the five worst after Money), QA = ledger §18 batch 2:
`premium-practice-plans` 17¶→8 subtopics · `premium-drills` 16→7 ·
`premium-family-access` 16→6 (its hand-written `<h4>`s became real anchors) ·
`premium-game-day` 13→8 · tournaments `public-site` 16→9. `tournaments.tsx` gained the
HelpBlocks import. Coverage measured by the paragraph-count script in §1: **20 → 15 sections
over standard; nothing above 12¶ remains.**

**Batch 2 DONE 2026-08-14** (the seven substantial remainders), QA = ledger §18 batch 3:
Your tournament records 12¶→5 · Player Development 12→5 · Export formats 12→4 (its `<h3>`s
became the sub-topics; `exports.tsx` gained the HelpNote import) · Season's End 11→5 ·
Plan templates 11→5 · Opponent book 11→6 · Assistant coaches & helpers 11→5.

**Batch 3 DONE 2026-08-14 — the sweep. 21 of 147 sections carry sub-topics (109 sub-topics in
all) and no section remained over the *paragraph-count* standard** — which is precisely the
claim §4.5 had to reopen, because that standard could not see a list.
The last eight: Chat with your coaches 9¶→5 · What the Coaches Portal is 8→3 · Running a
practice at the field 8→3 · Create/edit/launch a tournament 8→2 · How to turn on the tools you
need 7→3 · How to message your team 7→3 · Game-day details 7→4 · Building lineups 7→2.

**Owner ruling 2026-08-14 that replaced the earlier convert-on-touch plan:** consistency is
itself the feature. The "?" is ONE control, and a reader cannot form an expectation if it opens
a menu on one page and a wall on the next — that outweighs the smaller per-topic navigation win
at 7–9¶.

⚠ **The rule that keeps a sweep from making things worse:** a short section must break into
**3–5 grouped sub-topics, never one-paragraph-each**. Six one-paragraph accordions is worse
than six paragraphs — the reader has to open everything to read anything. Two sections in this
batch legitimately took only 2 sub-topics; that is the floor, not a target to pad past.

⚠ **Measuring coverage: count paragraphs between a section's `content: (` and its closing
`      ),` — do NOT split the section text on `links:`/`faqs:`, because `links` sometimes
precedes `content` (tournaments' public-site section does), which silently reports those
sections as 0¶. That artifact undercounted the remaining tail by 2 on 2026-08-14.

⚠ **Sub-topic `title` is PLAIN TEXT, not JSX** — an HTML entity (`&rsquo;`) renders literally
in the chip, the heading and the drawer row. Use the real character. (Caught twice in batch 1.)
⚠ A page whose drawer maps to ONE section opens that section's first sub-topic — so order
sub-topics with the page's own first question first, or set `subtopicId` on the caller. Batch 1
needed no `subtopicId`: the practice pages' first sub-topic is already their answer.

### 4.4 Step 4 — screenshot pipeline + first images ✅ BUILT 2026-08-14

**What shipped** (QA = ledger §18 batch 5):
- `lib/help-shots.ts` — the manifest, read by BOTH the renderer and the capture script so a
  picture and its capture instructions cannot drift. Carries path, readiness selector,
  optional `prepare` clicks, optional `clip`, alt, caption, and the rendered `size` (written
  back by the script so the guide reserves the space and never jumps as images load).
- `components/help/HelpScreenshot.tsx` — framed figure, caption, tap-to-enlarge via native
  `<dialog>`, lazy-loaded, optional highlight ring. **Unknown id renders nothing** — a picture
  is always supplementary, so a missing one must not leave a hole.
- `scripts/capture-help-shots.mjs` — `npm run capture:help-shots` (re-take), `--only=`,
  `--list`, and `npm run check:help-shots` (every declared picture exists with alt, caption
  and size).

**Three traps found while building it — all cost a run to diagnose, all now guarded in code:**
1. **The demo door is rate-limited** (10 presses / 10 min per IP — it is a public door). Press
   it ONCE per run per world and reuse the context; a per-shot press throttles mid-run and the
   remaining captures land on `/for-coaches` instead, which fails *silently* because the door
   redirects rather than erroring.
2. **`visible=true` on every selector is load-bearing.** The Money hub keeps visited panels
   mounted-but-hidden, so the first `table` in the DOM is invisible and a plain
   `waitForSelector` waits for *that* one forever.
3. **The demo's own chrome must be suppressed before capture** (`[data-sandbox-banner]`, and
   `--sandbox-chrome-h: 0`). ~200px of "LIVE DEMO" banner, phase dock and guided-tour bar is
   furniture a real coach has never seen — in documentation it is misleading, not just untidy.
   Suppressed rather than cropped because the dock's height moves with the tour state.

**Deliberately NOT built:** a freshness gate. `check:help-shots` proves a picture *exists*; it
cannot know whether it is *current*. Detecting staleness needs either pixel baselines (which
would fail on every demo re-anchor, since the demo's dates move nightly) or a route→picture
dependency the docs agent already carries as a rule. Revisit only if a stale image actually
ships.

#### Original design (for reference)

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

### 4.5 Step 5 — the corrected yardstick, and the eight topics it caught

**Why there is a Step 5 at all:** Step 3 declared itself complete against a rule that counted
paragraphs. The owner found "How to run tryout day" by spot-checking and it was 1,386 words. The
rule, not the sweep, was the defect.

**The fix to the rule** (`.claude/commands/docs.md` §"Content format standard", plus
`scripts/measure-help-length.mjs` / `npm run measure:help`):
- Trigger = **words of body copy, list items included**, >~350 words.
- Body copy = text inside a section's `content:` and each sub-topic's `content:`. Not `summary`,
  `keywords`, `searchText` or FAQ answers.
- **Block count is a judgement prompt, not a threshold.** A >8-block rule would flag "Tournament
  workflow at a glance" — 77 words in a 10-item list, the most scannable section in the guide.
  The script reports >12-block sections under the word limit for a human to read; it does not
  fail them. (Measured: only "Complete the tournament", 281 words / 17 blocks — already three
  structured lists, correctly left alone.)

**What it caught — eight sections, converted 2026-08-14:**

| Words | Section | Guide |
|------:|---------|-------|
| 1,386 | How to run tryout day | coaches |
| 1,046 | Getting around your Premium portal | coaches |
|   775 | Build and adjust the tournament schedule | tournaments |
|   606 | How to chat with your tournament organizer | coaches |
|   398 | Build a playoff bracket | tournaments |
|   389 | Your public organization page | org |
|   370 | How to cancel a customer subscription | platform-admin |
|   362 | Shared library: tags, awards & opponent books | rep-teams |

⚠ **A crude count flags ~70 topics; converting them would be the failure mode this plan already
warns about.** Everything under ~350 words is a genuinely short section whose 5-item list is
already the right form.

Same discipline as every prior batch: **re-set the prose, never rewrite it** — section ids,
keywords, `searchText`, links and FAQs stay byte-identical, because support links, hub cards and
the search index all point at them.

**Also measured and deliberately deferred:** five sub-topics *inside* the already-converted Money
topic are themselves over 350 words (Player dues 966, Imports/exports 655, Building your season
budget 423, Spreading costs 405, Getting around the Money hub 357), plus one in the tournaments
public-site topic (399). They are not walls in the reader's path — each sits behind its own
expander/heading, and the Money topic already carries the maximum useful number of sub-topics
(10). Splitting further would deepen the tree rather than shorten the read. Revisit only if the
article view (§6, Job 3) makes a single sub-topic the whole screen.

### 4.6 Step 6 — the guide becomes an article (NOT BUILT — awaiting owner sign-off)

Today every guide renders **every topic on one page** (the coaches guide: 40 topics, 22,131 words),
with a contents list that scrolls the reader around inside it. Sub-topics made each topic scannable;
the page is still enormous. The owner wants the full guide to read the way the "?" drawer does:
**pick a topic, read that topic, nothing else on screen.**

**⛔ BLOCKING GATE — mockups first, and they are published:** Claude artifact
**"Help Guide, One Topic at a Time"** (`32dfac02-8337-48bc-933c-4067a5964ab1`), 2026-08-14. Two
options at full density on the longest topic in the product, desktop + phone, every element tagged
NEW/RESTYLED/UNCHANGED:
- **Option A — the article page.** Contents rail becomes a picker with "you are here"; one topic
  fills the reading pane; sub-topics stay anchored headings + jump chips; Previous/Next topic at the
  foot; phone = contents screen → topic screen.
- **Option B — split view.** A middle "In this topic" column; one sub-answer at a time; phone drills
  three levels. Purer, but it charges the reader eleven selections to read one topic, breaks on
  2–3-sub-topic sections, and requires sub-answers to stand alone (several currently don't).
- **Option C — one menu that opens up (OWNER-PROPOSED 2026-08-14, and now the recommendation).**
  No second column: the contents list grows a level, so opening a topic reveals its sub-topics
  indented beneath it in the same rail while the topic fills the pane. The rail tracks BOTH the open
  topic and the sub-topic the reader has reached; only one topic is open at a time (else the rail is
  ~400 rows). Jump chips are retired — the tree does that job and stays on screen. Phone: the tree
  expands in place on the contents screen, and an "In this topic ▾" sheet from the bar replaces the
  pinned chips. **Open sub-decision:** tapping a sub-topic should *scroll within the topic*
  (recommended — keeps the topic one article and preserves answers that build on each other) rather
  than replace the pane (which inherits B's cost of turning a 1–2 sentence overview into a landing
  page and requiring every answer to stand alone).
- **Landing state** (a real decision, presented with a recommendation): a contents page with a short
  "Start here" row, versus opening on the first topic.

**⚠ THE RISK IS THE DEEP LINKS, and it is the whole risk.** Measured 2026-08-14: **102 anchored
links across 56 files**, plus the drawer's "Open the full guide" on every work page, plus **9 Money
screens carrying their own `subtopicId`**, plus whatever support has emailed. The resolver already
owns a `hashTargets` table covering sections, sub-topics and FAQs — the change is that a hash must
now **select the owning topic and then scroll**, so no link needs rewriting and no redirect table is
needed. Enumerate them before starting; walk a sample in a real browser afterwards. A unit test
cannot see this.

Expect to touch: the contents list (navigation, not anchors), the landing state, search results
(select a topic, don't scroll to one), and the scroll-spy machinery (probably deleted). **The drawer
is not touched** — it is already the article view.

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
