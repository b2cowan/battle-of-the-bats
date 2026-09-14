# Kickoff — development lifecycle re-evaluation, stage 1 · Define (proposal tab only)

Paste everything below the line into a fresh chat.

---

You are picking up the **coach development lifecycle re-evaluation** at **stage 1 · Define**. Your
deliverable is a **proposal tab on the existing walk artifact** — analysis and a drawn proposal for
the owner to rule on. **You are not building anything in this chat.** No product code changes.

## Where things stand (read these first, in this order)

1. Your auto-memory file `project_coach_development_lifecycle.md` (loaded for you) — the top block
   is the current state. Stage 0 · Arrive was ruled, built, restyled and **walked 18/18 on
   2026-09-14**. The re-evaluation is run **one stage at a time**: the owner reads a proposal tab,
   answers its decisions, pastes the summary back, the stage is built and logged, then the next
   tab opens. A later stage may depend on an earlier ruling — treat Stage 0's rulings as settled.
2. The artifact — **https://claude.ai/code/artifact/0f62f000-5b68-4923-ad00-9f32fb1fe3ad** — source
   `docs/projects/active/COACH_DEVELOPMENT_LIFECYCLE_REEVALUATION.html`. Read it with the Artifact
   tool (`action: "read"`, that url) **before** you edit anything, and read the whole of the
   **"The walk"** tab's station 1 ("Define what the team measures") plus the **Standing back**
   section (S1 — "one record, how many names?" — is Define's question as much as station 1's).
   Then read the **"0 · Arrive"** tab end to end: it is the template for yours.
3. Ledger `docs/projects/active/OWNER_QA_LEDGER.md` **§185** (what Stage 0 built and walked) and
   plan `docs/projects/active/COACH_DEVELOPMENT_LIFECYCLE_PLAN.md` **§17** (the eight Stage 0
   rulings in a table). Also §16 of the plan and the hub's Decisions for the Phase 1 build calls
   that Define already carries (the successor rule, "null→text method keeps the series", etc.).

## What Stage 0 settled that Define inherits

- **Overview is the landing.** Skills & Goals = Overview · Sessions · Players · Metrics. A fresh
  team's Overview is ONE card whose lime is "Define your first metric" → the metric editor. So the
  Define stage now BEGINS on that card, not on the Metrics tab.
- **Money's grammar is the design model** for this hub: white cards, mono eyebrow + state chip, a
  door band at the foot; list tabs = a toolbar on the paper + the table on white (the Metrics tab
  already looks like this). Do not propose tinted panels or new chrome styles.
- **A coach without the Development grant has no door** to Skills & Goals at all (D5). The
  definition page is a room inside it. Do not re-open that.
- **No team-level trend** until S5 is ruled (D8). Not Define's business either way.
- The four door tiles are gone; practice plans/drills belong to a separate session — do not
  propose anything in Practice plans.

## What Define covers (the stage's scope — argue from the CODE, not from the plan)

The coach's job: *decide what this team measures and how* — before the season, and the day a
test turns out to be wrong. Screens and code to read:

- The Metrics tab of the hub: `app/[orgSlug]/coaches/teams/[teamId]/development/page.tsx`
  (`MetricsView`) — the table, "Retired definitions" disclosure, "+ Define a metric".
- The editor page: `components/coaches/MetricDefinitionEditor.tsx` (+ its module CSS), routes
  `development/metrics/new` and `development/metrics/[typeId]`.
- The definition model and its rules: `lib/measurable-definition.ts` (vocabulary, `definitionChange`
  — the successor rule), `lib/measurable-series.ts` (`sessionHeadline` etc.), `lib/development-input.ts`
  (`validateDefinitionShape`, `applyDefinitionPatch`), migrations 293/294 (read the dictionary
  `docs/agents/db/DATA_DICTIONARY.md`, never the migration files, for what a column means).
- The routes: `app/api/coaches/[orgSlug]/teams/[teamId]/development/measurable-types/**` — create,
  PATCH (the 409 + successor answer), `[typeId]/replace`, retire/restore.
- The quick road: "+ New test…" on the session page (`NewTypeFields`) — a name + unit creates a
  record-only test that reads "method not recorded" everywhere until finished.
- The vocabulary the coach meets for these things: metric · test · observed skill · measurable ·
  result · reading · attempt · headline · descriptor — grep the customer-visible copy and count.
- The help articles for Metrics (`lib/help-content/coaches.tsx`, `premium-development*`).

Walk them in the browser as the UAT head coach (`tests/uat/.auth/coach.json` is a Playwright
storage state; `UAT_ORG_SLUG` in `.env.local`; the team is "UAT Test Team") at 1440 and 390 — the
Arrive session took its screenshots with a small Playwright script run from inside the repo
(`scripts/.tmp-*.mjs`, deleted afterwards) because `playwright` resolves only there. **The dev
server is shared with other sessions: do not restart it, and never run a full `check:layout`
sweep or `--prune`.** Read-only browsing is fine.

## What the walk already said (your starting point, not your conclusion)

Station 1 rated Define the soundest station: the table says in one line what a record means, the
editor is "the best form in the lifecycle". Its items: the stale "observations come in a later
release" sentence (**already removed in Stage 0**); the editor preview promising "faster" where the
reports never say it; "Measured test" repeated in the Kind column. Its shape questions: Q1.1 (is a
full definition the right ceremony? — ruled and walked as built), Q1.2 (test vs. observed skill —
the split coaches think in?). Standing back S1: the coach meets ~9 words for two kinds of thing.
The push: "the risk is not the model; it is vocabulary."

Your analysis should go further than restating that. Questions worth answering from the code and
the screens: does the Define stage now read as one arc from the Overview's card → the editor →
back to the Overview's "Run your first session"? What does a coach see the moment they save their
first metric (where do they land, what does the page say next)? Does the quick road on the session
still make sense now that the landing points at the editor first? Is the editor's read-only face
dead code after D5 (no-grant coaches never reach it)? What is the one-word vocabulary decision the
owner should make here, and what rides on it (help articles, the Insights report labels, the
handout)? Where does the Kind split show up downstream, and would one decision here simplify
three later stations?

## The tab you will add — follow the Arrive tab's conventions exactly

- Add a **"1 · Define"** tab button beside "0 · Arrive" in the tab strip (replace the disabled
  placeholder `<span class="tab next">1 · Define…</span>`), wire it into the `panels` map in the
  page script (`define: 'tab-define'`), and add a `<div class="prop" id="tab-define" role="tabpanel"
  hidden>` panel after `#tab-arrive`. Add the next placeholder ("2 · Session", disabled) after it.
- Structure of the panel, in this order: header (eyebrow "Stage 1 · Define" + a
  `proposed · not built` status chip, an h1 that is a claim, a lede); **What changes / Why** two
  columns + a "what this stage does not touch" line; **Before** (as built today, frames with amber
  markers); **After** (the proposal, frames with green markers, one frame per state); **On a
  phone**; **Where else it touches**; **Decisions** (each an `.ask` with `data-q="B1"`, `data-q="B2"`…
  and `data-kind="build"` so it gets Build-as-drawn / Change-it / Not-now controls automatically);
  a **Build summary — Define** section with its own button/textarea (copy the Arrive pattern:
  `#buildSummaryDefine` / `#summaryOutDefine`, iterate `#tab-define .ask[data-q]`; do NOT add a walk
  block yet — the walk is written after the owner rules).
- Frames are drawn in the portal's own materials with the existing `.pf` classes (topbar, mast,
  grid, col, phead, ptabs, story cards, list-tab toolbar). Look at how the Arrive tab draws the
  Metrics tab and the Overview card and reuse those classes; add new `.pf .x` classes only for
  things the Arrive frames do not have (e.g. the editor's two-column form and its live preview).
  Frames sit in `<div class="framewrap"><div class="frame">…</div></div>` so the fit/true-size
  switch applies. Desktop 1440, phone 390. **Pin identities (60-yd sprint, Throw speed, Changeup
  speed, Sets feet before throwing, Shuttle run retired), never invent figures** — copy what the
  fixture shows.
- Every marker is `<span class="an">…<button class="mk [ok]">n</button><div class="pop" hidden>
  <b>title</b>text</div>…</span>` INSIDE the element it explains — never positioned by coordinates.
  Amber = what is wrong today, green (`ok`) = what changes.
- Decision keys: `data-q="B1"` … (Stage 0 used A1–A8; the page's answer store is keyed by the
  `data-q`, so a new letter avoids collisions). Number 6–8 decisions at most; each one states what
  rides on it in a `.rides` div.
- Write **"Where I'd push"** honesty into the decisions: disagree with the walk if the code says
  otherwise; do not manufacture a change for a station the walk already rated sound. If your
  honest proposal is "Define needs three copy fixes and one vocabulary ruling, nothing structural",
  say so and draw only that.

## Concurrency — read this before you write to the artifact file

The Arrive session is running `/simplify`, `/review`, `/docs` and then a **commit** on the SAME
working tree, and the artifact HTML is one of the files it will commit. Do your analysis and draft
your panel HTML in your scratchpad first. **Before splicing into
`docs/projects/active/COACH_DEVELOPMENT_LIFECYCLE_REEVALUATION.html`, run `git status --short` on
it: if it is still modified, the Arrive commit has not landed — use `ListAgents` and `SendMessage`
to tell the Arrive session you are ready to write the tab and wait for its "committed" reply
(or splice anyway and tell it exactly which lines you added so it can rebuild its commit from
HEAD + its hunks).** Never `git add -A`; stage explicit pathspecs; never commit without the owner's
say-so. Republish with the Artifact tool passing the artifact `url` (same path), and read it first
so the publish is accepted.

## Hand-off

When the tab is published: reply to the owner in product-owner voice (what changes, why, the
trade-offs, what to click), link the tab (`#tab=define`), and record the state in the lifecycle
memory file (append a short block at the top: "STAGE 1 DEFINE — PROPOSAL PUBLISHED <date>, decisions
B1–Bn, not built"). Do not update the ledger or TODO yet — those move when the stage is built.
