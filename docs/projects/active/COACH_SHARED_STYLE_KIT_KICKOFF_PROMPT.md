# Kickoff — the coach-portal shared style kit (walkthrough + mockup only; nothing built)

*(paste everything below the line into a fresh chat)*

---

You are opening a **new, independent project**: deciding what a shared "coach dashboard and list"
style kit holds, and which coach-portal screens adopt it. This is the **close-out item** the owner
asked to hold back on 2026-09-14, when the Development lifecycle re-evaluation started: *"let's make
sure this is discussed when this project is over — shared stylings are important for consistency
across the app."* That project closed 2026-09-16. This is that discussion. **You do not touch the
Development lifecycle project itself** — it is committed and archived; read its record for context
only.

**Your deliverable is a mockup on a Claude Artifact, current state vs. proposed, with lettered
decisions and a paste-back summary for the owner to rule on — plus a plan doc and a short PM brief.
You are not building anything in this chat.** No product code changes. A build happens in a later
session, after the owner rules, from a build prompt you write at the end of this one.

## Step zero — before you draw a single frame

1. **Check whether the table-standard pass has landed.** A separate session found and fixed one
   piece of this exact problem on 2026-09-16 (owner-raised, "why is the roster table not following
   our table conventions and having a transparent background?"): every coach list table now sits on
   a white card, `Insights → Development`'s tables are centred and 37px-not-58px rows. Read
   `docs/agents/design/TABLE_AND_LIST_STANDARD.md` and `TABLE_EXCEPTION_REGISTER.md` (their
   changelogs) and Owner QA Ledger §194 and §195. If that work is still uncommitted when you start,
   say so to the owner before proceeding — you are extending a foundation, not re-discovering it,
   and building on top of an in-flight peer session's uncommitted files needs a private-index commit
   later (see the shared-worktree memory file below).
2. **Confirm scope with the owner as your first question, not an assumption.** Every duplicated
   pattern found so far is a coach-portal screen (Skills & Goals, Money, the team Overview, Insights)
   — but the owner's own sentence said "consistency across the app." Recommend coach-portal-first
   (that's where the evidence and the design docs already anchor, and Money/Skills & Goals/Insights
   share one visual language already) and ask whether the door should be left open for tournament and
   public-site screens later, rather than silently narrowing or silently expanding the ask.

## 1. Read first, in this order

1. **Memory** (auto-loaded): `feedback_mockups_as_claude_artifacts`, `feedback_clickable_design_annotations`,
   `feedback_build_to_approved_mockups`, `feedback_project_hub_single_artifact`,
   `feedback_product_owner_summaries`, `feedback_shared_component_over_shared_class` (the repo's
   standing rule — this whole project exists to apply it), `feedback_holistic_reeval_over_item_fixes`,
   `reference_shared_worktree_stage_race`, `project_app_wide_table_consistency_review` (a prior,
   already-shipped pass in the same spirit — read what it covered and how it verified, so this
   project doesn't re-walk the same ground), `project_warm_coaches_portal_followup` (the warm-theme
   program this sits inside), `design_system.md`, `design_principles.md`.
2. **The archived plan** — `docs/projects/archive/COACH_DEVELOPMENT_LIFECYCLE_PLAN.md` §17.1
   ("Project close-out item — shared stylings") is the origin of this project; read it in full. Also
   skim §21's "Built as" table, row G4's right-hand column, which names the specific debt this
   project inherits: *"the one-line phone row is the codebase's THIRD use of stage 3's one-line
   card — promote it into the shared card recipe at [this project], not here."*
3. **The known duplication, as a starting inventory (verify each against the current code before
   trusting it — this list is a starting point, not a finding)**:
   - `app/[orgSlug]/coaches/teams/[teamId]/development/overview.module.css` is a **value-for-value
     twin** of the Money area's `accounting/overview-dashboard.module.css` — `.card`, `.eye`,
     `.chip*`, `.big`, `.bar`, `.foot`, `.railRow`, the attention list — copied by hand rather than
     shared. Two dashboards proving one shape is the extraction point.
   - The Development list tabs (Sessions, Metrics, and formerly Players) reuse the shared
     `.panelToolbar` but carry their own `.devListLede` / `.devTableCard` — decide whether the
     toolbar-plus-lede-plus-white-table shape becomes one component every list tab reaches for.
   - **Three separate hand-rolled copies of "a table row becomes one line on a phone"**:
     `.devReportPhoneLine` / `.devReportDesktopCell` (the newest, Development stage 4), a twin from
     Development stage 3, and whatever the table-standard pass's `.rowTapLink` turns out to be.
     Fold them into one `.tableAsCards`-family recipe.
   - Other dashboard-shaped surfaces to check against whatever kit you propose: the team Overview
     page's tile row, Insights' report bands, and any other `*-dashboard.module.css` in the coach
     area.
4. **The code itself** — do not trust the inventory above without opening the files. Read every
   `*.module.css` in `app/[orgSlug]/coaches/` and `components/coaches/` that has "dashboard",
   "overview", "table", "list", or "card" in it or its selectors, and diff the ones that look alike.

## 2. Method — walk it the way the Development lifecycle project did

That project's assessment (`docs/projects/archive/COACH_DEVELOPMENT_LIFECYCLE_PLAN.md` §2–§3) is
the template: **source-based, not a signed-in browser test.** Read page and component rendering,
inspect the actual CSS modules side by side, and tag every finding **Code finding** (follows
directly from what the code does), **UX hypothesis** (a plausible inconsistency a coach would
notice, not yet observed), or **Proposal** (a future shared shape, not something that exists today).
Build a table: for each pattern (dashboard cards, list-tab chrome, table-row-as-phone-card, and any
others you find), which screens have it, whether their copies already differ in ways that matter
(a real design decision) or differ only by accident (drift), and what a single shared version would
need to support every one of them.

**Two boundary questions to settle explicitly, because getting them backwards is the failure mode
this project exists to prevent:**
- **A shared component, not a shared class** (the repo's standing rule) — where the pattern carries
  behavior (a dashboard's four-tile grid, a list tab's toolbar), propose an actual component with
  props, not a CSS class every screen must remember to apply correctly by hand. Where it is purely
  visual (a card's border-radius and shadow), a shared class or design token is enough — say which is
  which and why.
- **Where the existing copies already deliberately differ**, name it and propose keeping the
  difference rather than forcing one shape — this project is about accidental drift, not about
  making every screen identical regardless of what it needs.

## 3. Deliverable

Build a Claude Artifact (project-hub pattern: mockup, decisions, plan and — later — QA walk as tabs
on ONE URL). For every pattern found: a **true-size before frame** (the real screens as they render
today, side by side, so the drift is visible at a glance) and a **true-size after frame** (every
affected screen restyled to the proposed shared kit). Every callout is clickable, not a hover title.
Lettered decisions (A, B, C…) with a recommendation on each, and a paste-back block the owner can
fill in to rule on all of them at once.

Write the matching **plan doc** (`docs/projects/active/COACH_SHARED_STYLE_KIT_PLAN.md`) and a short
**PM brief** (`COACH_SHARED_STYLE_KIT_PM_BRIEF.md`) — plain-language, outcome-focused: what changes
for a coach looking at these screens (likely: very little visually on the screens that already got
it right, a real visual change on the ones that didn't), why consistency here matters, and how this
gets verified once built (the layout gate's screen baseline will need re-measuring wherever a shared
kit changes real pixel positions — say so plainly rather than treating it as a detail).

Add **one summary line to `TODO.md`** linking the new plan (this is a new project — do not touch the
Development lifecycle entry, which is closed and archived).

**End the chat by writing a build-kickoff prompt** for the session that implements whatever the
owner rules — following this same file's own shape (read-first list, what's settled, method, "you
are not building anything" boundary reversed to "you are only building what was ruled").

## 4. Guardrails

- **Nothing here is a redesign.** The visible outcome on most screens should be small or invisible —
  this project pays down duplication, it does not re-open settled visual decisions (warm theme,
  colour tokens, the existing table standard). If a pattern's current shape looks wrong on its own
  merits, name it as a separate, clearly-flagged finding — don't fold a redesign into a consistency
  pass.
- **Verify in both skins.** Warm is the default; check the dark skin too (`reference_warm_theme_badge_contrast`
  is a standing trap — a static gate here has read dark-only defects before).
- **This is a shared checkout.** Another session may be mid-edit in any file you read. Re-read
  before trusting a stale view, and build your eventual commit as a private index if anything you
  touch is also in another session's working set (`reference_shared_worktree_stage_race`).
