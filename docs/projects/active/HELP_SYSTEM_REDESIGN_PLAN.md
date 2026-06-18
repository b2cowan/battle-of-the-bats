# Help System Redesign — Comprehensive Review & Plan (v2)

**Status:** Proposed — review complete, awaiting owner direction on the open decisions in §10.
**Created:** 2026-06-17
**Supersedes:** `docs/projects/archive/TOURNAMENT_HELP_DOCS_REVIEW_PLAN.md` — that v1 plan shipped the search + Popular Questions + grouped-Topics rail + one-topic-at-a-time article that this review critiques.
**Scope:** The whole in-app help system (help hub + guide pages + in-app contextual help). The tournament-organizer surface is the worked example for the in-app review.
**Method:** 6-lens multi-agent audit (IA/navigation, visual design, content/taxonomy, in-app inventory, pattern-fit, accessibility) + a 14-principle industry benchmark + an adversarial verification pass that read source line-by-line. 22 agents, 60 findings, 14 high-severity — all 14 verified against the real code; 4 overstatements were caught and corrected (see Appendix §11).

> PM brief lives alongside this file: `HELP_SYSTEM_REDESIGN_PM_BRIEF.md`.

---

# FieldLogicHQ In-App Help System — Product Review
**Version 2 Critique | June 2026 | Decision-Ready**

---

## 1. EXECUTIVE SUMMARY

The help system's core problem is structural, not cosmetic: it was designed as a reference encyclopedia but is being used by time-pressured operators who want task answers in context. The result is a guide page that buries 18 sections behind a one-at-a-time slideshow — making Ctrl+F impossible and scanning impossible — while the sidebar injects a block of FAQ buttons between the search box and the topic list, producing exactly the "questions in between search and content headers" the operator describes. The hub compounds this with four competing entry systems visible simultaneously, all at identical visual weight, so every visit starts with a navigation decision rather than an answer. Meanwhile, the in-app surface — the admin pages where operators are actually doing the work — has help components on only 2 of roughly 20 tournament pages, and even those fire only on empty states, disappearing the moment work begins. The headline recommendation is a three-part structural fix: (1) replace the slideshow with a single-scroll article and a sticky TOC, (2) collapse the dual recipe/subject taxonomy into one workflow-ordered set of 10–12 sections, and (3) establish a "help on this page" entry point on every tournament admin page so help is available in context, not only in a separate help center.

---

## 2. HOW WE REVIEWED IT

Four specialist lenses examined the system simultaneously: information architecture and navigation (how structure and wayfinding hold up under task-oriented use), visual design and hierarchy (whether the type scale, spacing, and color system communicate priority), content structure and taxonomy (whether the guide's 18 sections are organized logically with one coherent axis), and in-app help inventory (which admin pages have contextual help and what patterns are applied). Two additional lenses assessed pattern fit (whether the right help pattern is matched to the right moment) and accessibility and interaction (keyboard, screen reader, touch, and motion). All lens findings were then benchmarked against 14 published SaaS help-center design principles and subjected to an adversarial verification pass that read the actual source files line by line to confirm or refute each high-severity claim before it was included here. Three claims were materially refuted in verification and are noted in the appendix; the rest are grounded in real code.

---

## 3. CURRENT-STATE DIAGNOSIS

### (a) The Help Hub — Too Many Front Doors

- **Five entry systems compete for the same landing page.** The hub presents a search bar, "Start Here" featured cards, "Getting Started By Role" ordered-list cards, "How Do I..." task-link rows, and grouped guide cards — all visible simultaneously, all using the same small-caps section-header typography. A user who arrives wanting to close out a tournament sees four surfaces that could plausibly contain the answer and gets no signal about which to use.

- **Role-path cards are permanently visible, not gated to new users.** After an operator's first week they know their role; the seven role-path cards become scroll-past noise on every visit. These are onboarding content, not navigation content, and should not compete for permanent hub real estate with the guide cards operators return to regularly.

- **"Start Here" cards and guide cards cover the same ground twice.** The three featured "Start Here" cards (Tournaments, House League, Org Admin) are the same guide cards that appear again in the grouped section below — presented a second time with a different visual treatment, giving a first-time visitor the impression of more content than actually exists.

- **The "How Do I..." task-link block adds a third navigation layer with no unique value.** Its 11 quick-link buttons cover tasks already findable via search and via the guide cards, but present them as a separate browseable surface with per-row category badges that add classification noise rather than orientation.

### (b) The Guide Page — Slideshow Model, Cluttered Header, Rail Order

- **The one-section-at-a-time slideshow hides the entire content map.** Only the currently-selected section is visible; the other 17 are completely hidden. An operator who wants to know whether the guide covers a specific topic must either search or click through sections sequentially. Browser Ctrl+F finds nothing in hidden sections. The "Topic N of 18" counter signals an exhaustive document without making any of it visible. Deep links do survive page reloads (the client-side hash effect restores the section on mount), but that is the only link affordance — there are no shareable anchors to specific sections.

- **The sidebar injects FAQ buttons between search and the topic list.** The rail renders in this order: search input, then "Popular Questions" (up to 8 full-sentence FAQ buttons, each 36px tall — up to 340px of rail space), then "Topics" (the grouped TOC). The Popular Questions block disappears the moment a user starts typing, which is the moment FAQ shortcuts would be most useful as a browse complement. In the default no-search state, the TOC is pushed below the fold on typical viewport heights.

- **The article header stacks six metadata layers before the first word of content.** In sequence: page title + role badge, then an intro paragraph, then "Topic N of 18" + group name (both at 0.68rem uppercase), then the section heading, then a summary paragraph, then content. The counter and group name share the same font weight as each other but neither serves as the primary orientation cue — the section heading does, yet it arrives after four lines of metadata that cost more vertical attention than the heading itself.

- **Mobile experience buries content below 600–700px of navigation.** At tablet-width breakpoints the full rail (search, up to 8 FAQ buttons, all grouped TOC links) stacks above the article in DOM order, pushing the actual content far below the fold. The primary task — reading the article — is the last substantial element a mobile user reaches.

### (c) Content Taxonomy — Dual Axis, Redundancy, Weak Grouping

- **Two structural axes run simultaneously through the same guide.** Five "How-to recipe" sections (task-first, step-by-step) and nine subject-group sections (reference-first, topic-organized) coexist in the same TOC. Four of the five recipes have a direct subject-group twin covering the same admin page in different words — the schedule-building recipe and the schedule-and-playoffs subject section, the scores recipe and the scores-and-results subject section, the registration recipe and the registrations-and-teams section, the closeout recipe and the archive-and-seal section. This doubles the apparent length while halving clarity; operators cannot tell which version to read.

- **Six of seven named subject groups hold exactly one section each.** Only "Setup" is a genuine group (four sections). Every other subject group — Registration and Teams, Schedule and Playoffs, Scores and Results, Communication and Public Site, Admin and Settings, Closeout and Plan Limits — contains a single section, making the group headers decorative. Each group header adds a visual label for a one-item list and the TOC reads as a flat list in disguise.

- **Two sections have no group assignment and fall into a "Guide" catch-all.** The data-tools and exports sections were never assigned to a group; the layout code assigns them the fallback label "Guide" which surfaces in the TOC and in search results as if it were an intentional category name. The content existed before the grouping system was added and was never reconciled.

- **The FAQ layer is three-surfaced with opaque curation.** FAQs appear in the sidebar Popular Questions rail (up to 8, regardless of which section is active), in the article's "Related Questions" (section FAQs only — though the code was written to also pull page-level popular FAQs, that slot is always empty for the tournaments guide), and in search results. The same FAQ appears in both the rail and the article for any section whose FAQs are marked popular, giving operators the impression of duplication without explaining why.

### (d) In-App Contextual Help — Coverage Gaps and Missing Patterns

- **Help components are used on 2 of roughly 20 tournament-organizer admin pages, and only in empty states.** The schedule page and results page each have one HelpCallout that fires when no games exist and disappears permanently once any game is saved. The divisions page, registrations page, communication page, check-in page, dashboard, settings pages, and a dozen others have no help component of any kind — no tooltip, no callout, no link to the guide.

- **The HelpTooltip component exists but is used on zero tournament admin pages.** The component is deployed in accounting and rep-teams but has never been applied to any tournament admin page — the surface with the most conceptually dense controls (pool structure, playoff configuration, registration status lifecycle, bracket locking).

- **No page has a "help for this page" entry point.** Only the data-tools page links to a guide section, and that link is hand-built into a one-off HTML block, not a shared component. Every other page requires an operator who is confused mid-workflow to navigate away to the help hub, search, find the guide, and then navigate back — breaking task context entirely.

- **HelpTooltip has a critical touch-device bug.** The popover uses pointer-events: none and fires open only on mouse hover. On a touch device a tap flashes the popover open and immediately closes it because the outside-click handler fires in the same gesture. An iPad-using tournament organizer running game-day check-in gets nothing from every question-mark badge.

---

## 4. ROOT-CAUSE THEMES

**Theme 1 — Two taxonomies were added sequentially, never reconciled.** The guide was initially built as a subject-reference, then task-oriented recipe sections were added as a parallel track without removing the overlapping subject sections. The result is a guide organized on two incompatible axes simultaneously. This is the single most damaging structural problem because it affects everything downstream: TOC length, FAQ distribution, search-result relevance, and the operator's ability to predict where an answer lives.

**Theme 2 — Presentation hides hierarchy.** The slideshow model treats every section as equal regardless of depth or importance; the hub uses the same section-header typography for all four navigation systems; the sidebar rail uses the same heading style for FAQ shortcuts and the primary TOC. The visual system cannot communicate "this is navigation" vs "this is supplementary" vs "this is content" because everything is styled the same way.

**Theme 3 — Help is an afterthought on the pages where operators are actually working.** The guide center was built and maintained as an independent system; the admin pages were built without a convention for linking to it. The two touchpoints — guide and admin page — evolved in parallel with no shared contract. The result is that operators who are mid-workflow and confused have no path from the problem surface to the answer without leaving the workflow.

**Theme 4 — Patterns are matched to the wrong moments.** HelpCallout is used only as a zero-state placeholder when it should also serve as a pre-action warning, a first-run teacher, and a persistent process-context setter. HelpTooltip is under-deployed because there is no lighter-weight "field hint" primitive for the cases where a tooltip body would exceed one sentence. The toolkit has two tools and needs five.

**Theme 5 — No authoring rules govern content shape.** No documented rule specifies how many sections a guide should have, when to use groups, what makes a "recipe" different from a "subject section," or what group naming conventions to follow. The v1 guide was authored with one convention; the v2 additions layered a different convention on top without cleaning up. Without a codified style rule, every new module will likely repeat the same structural drift.

---

## 5. RECOMMENDED TARGET STATE

### Chosen Taxonomy (one axis, workflow-ordered)

Replace the dual recipe/subject split with one set of workflow-ordered groups, each named after what the operator is doing, not a metadata label. Target 5–6 groups, 2–3 sections each, totaling 10–12 sections:

| Group | Sections |
|---|---|
| Create & Launch | Create/edit tournament; Repeat-event reuse setup |
| Tournament Structure | Divisions, pools, and fees; Venues, contacts, and rules; Settings, branding, and access |
| Teams & Registration | Registration review and team management |
| Schedule & Playoffs | Build schedules and playoff brackets |
| Scores & Results | Scorekeeper workflow, score entry, and finalization |
| Data, Exports & Close Out | Data tools and imports; Exports and reports; Complete, archive, and seal |

Recipe tasks are absorbed into their subject section as a numbered "Steps" block — they do not get their own section. The hidden "Getting Started" section either becomes a visible first section titled "Overview" or its content moves into the HelpPageContent intro field.

### (i) Redesigned Guide Page — Single-Scroll Article

```
+----------------------------------------------------------+
| [<] Tournaments Guide                      [Search guide] |
+----------------------------------------------------------+
|                |                                          |
|  STICKY LEFT   |  SCROLLABLE MAIN                        |
|  COLUMN        |                                          |
|  (320px)       |  ## Create & Launch                     |
|                |  ─────────────────────────────────────  |
|  [Search]      |  ### Create, edit, and launch a         |
|  ───────────   |      tournament                         |
|                |                                          |
|  Create &      |  <intro paragraph>                      |
|  Launch        |                                          |
|  > Create,     |  <body content, steps, screenshots>     |
|    edit &      |                                          |
|    launch ◀   |  ▾ How do I publish a tournament?        |
|  > Repeat      |  ▾ Why can't I activate my tournament?  |
|    setup       |                                          |
|                |  ─────────────────────────────────────  |
|  Tournament    |  ### Repeat-event setup                 |
|  Structure     |                                          |
|  > Divisions   |  <body content>                         |
|  > Venues      |  ▾ Can I reuse setup from last year?   |
|  > Settings    |                                          |
|                |  ## Tournament Structure                 |
|  Teams &       |  ─────────────────────────────────────  |
|  Registration  |  ### Divisions, pools, and fees         |
|  > Registration|                                          |
|                |  <body content>                         |
|  Schedule &    |  ▾ How do pools work?                  |
|  Playoffs      |  ▾ Can I charge different fees per      |
|  > Schedule    |    division?                            |
|                |                                          |
|  Scores &      |  ... (continues scrolling)              |
|  Results       |                                          |
|  > Scores      |                                          |
|                |                                          |
|  Data &        |                                          |
|  Close Out     |                                          |
|  > Data tools  |                                          |
|  > Exports     |                                          |
|  > Close out   |                                          |
|                |                                          |
+------------------+-----------------------------------------+
```

Key design decisions:
- All sections render in a single scrolling column, separated by group-level h2 headings and section-level h3 headings.
- The left column is sticky and contains only: a search input (scoped to this guide), and the grouped TOC with IntersectionObserver-driven active highlighting.
- Popular Questions are removed from the rail entirely. Each section's FAQs appear inline below that section's prose as a native-details accordion.
- "Topic N of 18" is removed. "For: Admin, Owner" role badge moves to a single quiet line below the page title, not repeated per-section.
- Deep links resolve to real browser heading anchors (h3#create-edit-launch) — bookmarkable, shareable, Ctrl+F-searchable.
- Prev/Next navigation is removed; the TOC replaces it.

### (ii) Redesigned Hub

```
+----------------------------------------------------------+
| FieldLogicHQ Help                                        |
+----------------------------------------------------------+
|                                                          |
|  +----------------------------------------------------+ |
|  |  🔍  What do you need help with?                  | |
|  |  Search guides, topics, and common questions       | |
|  +----------------------------------------------------+ |
|                                                          |
|  ── GUIDES ──────────────────────────────────────────── |
|                                                          |
|  TOURNAMENTS          HOUSE LEAGUE        REP TEAMS      |
|  +----------------+  +----------------+  +-----------+  |
|  | Run and manage |  | Season and     |  | Franchise |  |
|  | tournaments    |  | house league   |  | and teams |  |
|  | 12 topics      |  | 9 topics       |  | 8 topics  |  |
|  +----------------+  +----------------+  +-----------+  |
|                                                          |
|  ACCOUNTING           ORG ADMIN           EXPORTS        |
|  +----------------+  +----------------+  +-----------+  |
|  | Ledger, fees,  |  | Members, roles,|  | Data and  |  |
|  | and payments   |  | and settings   |  | downloads |  |
|  | 7 topics       |  | 6 topics       |  | 6 topics  |  |
|  +----------------+  +----------------+  +-----------+  |
|                                                          |
|  ── NEW TO FIELDLOGICHQ? ──────────────────────────────  |
|  [▶ Show getting-started paths by role]                  |
|                                                          |
+----------------------------------------------------------+
```

Key design decisions:
- Search is the primary entry — one large search bar, results replace the page when active.
- Guide cards are the only browse surface: one grid, one card per guide module, no redundant surfaces.
- "Start Here" featured cards are retired — their content is captured in the card descriptions.
- "How Do I..." quick-link block is retired — search covers it better.
- Role paths collapse into a single disclosure ("New to FieldLogicHQ? Show getting-started paths by role") for first-time orientation, not a permanent prominent section.
- Card metadata shows topic count (not hidden role-gating logic) so operators have a sense of guide depth before clicking.

### (iii) In-App "Help On This Page" Pattern

```
+----------------------------------------------------------+
| [Tournament Name]  Divisions        [+ Add Division] [?] | ← page header
+----------------------------------------------------------+
|                                                          |
|  ... page content ...                                    |
|                                                          |
|                                         +-----------+    |
|  User clicks [?]  ─────────────────►   | HELP      |    |
|                                         | DRAWER    |    |
|                                         | (420px)   |    |
|                                         |           |    |
|                                         | Divisions,|    |
|                                         | pools, and|    |
|                                         | fees      |    |
|                                         |           |    |
|                                         | Pools split|   |
|                                         | a division |   |
|                                         | into...   |    |
|                                         |           |    |
|                                         | ▾ How do  |    |
|                                         |   pools   |    |
|                                         |   work?   |    |
|                                         |           |    |
|                                         | [Full     |    |
|                                         |  guide ↗] |    |
|                                         |           |    |
|                                         | [×]       |    |
|                                         +-----------+    |
+----------------------------------------------------------+
```

Key design decisions:
- A small labeled "?" button (or "Help" ghost button) sits in the top-right actions area of every tournament admin page header — the same position as the existing "Scorekeeper" external-link button on the results page, so the convention is already established.
- Clicking opens a right-edge HelpDrawer (slide-over, 420px, focus trap, Escape to close) that renders the relevant HelpSection from lib/help-content/ inline — no page navigation required.
- The drawer's "Full guide" link opens the guide page scrolled to that section in a new tab, for operators who want the full context.
- Per-section FAQs appear in the drawer as an accordion below the prose.
- The drawer is driven by a section ID prop: `<HelpDrawer sectionId="divisions-and-pools" />` — one line per page.

---

## 6. IN-APP HELP PATTERN MATRIX

| Moment / Content Type | Recommended Pattern | Why |
|---|---|---|
| Label a control whose name is non-obvious (one sentence) | **HelpTooltip** on the form label | Supplemental, space-constrained, operator-initiated; correct per NN/G tooltip guidelines |
| Explain a field that needs 2–3 sentences | **FieldHint** — always-visible sub-label text below the input | Persistent, never requires a click, cannot be missed; tooltip body is too short for this |
| Explain a status or state label (e.g. "Pending Review") | **FieldHint** or **StatusLegendPopover** (unconditional) | Operators read statuses mid-workflow; hover-only is unreliable |
| Warn before an irreversible action (publish, clear bracket, archive) | **HelpCallout variant=warning**, adjacent to the action button, always visible when relevant | Sets expectations before the click; confirm dialog is a second gate, not a substitute |
| Teach a multi-step workflow on first encounter | **HelpCallout variant=tip**, dismissible with localStorage key | Appears once, teaches, then stays out of the way; not a blocking modal |
| First-run orientation for a brand-new tournament | **SetupChecklist** component on the dashboard | Linear progress indicator surfaced in context, links to each step; replaces "read the guide to understand the sequence" |
| Answer a deep question without leaving the page | **HelpDrawer** — slide-over rendering the relevant guide section | No navigate-away, no context loss, full content available; the data-tools deep-link pattern promoted to a shared primitive |
| Orient a new platform user by role | **Role-path disclosure** in the help hub (collapsed by default) | Useful once; not a permanent hub section |
| Empty state with zero data | **HelpCallout variant=info** with a CTA | Structured, consistent, reusable; replaces bespoke empty-state divs |
| Filtered empty state (no results match) | **Inline text** + "Clear filters" link — no callout | Transient; a callout is too heavy for a filter state |
| Plan-gated feature (operator on wrong tier) | **HelpCallout variant=warning** with billing CTA | Gate message needs consequence + action, which a callout handles better than a bespoke strip |

**New primitives the toolkit needs beyond HelpTooltip + HelpCallout:**

1. **FieldHint** — a `<p className={styles.fieldHint}>` always visible below a form input label, 0.8rem, --white-55. For the 2–3 sentence case where a tooltip body would be too long. One line to add; no interaction required.

2. **HelpDrawer** — a right-edge slide-over (max-width 420px, z-index above page, focus trap, Escape to close) that accepts a `sectionId` prop, reads the matching HelpSection from lib/help-content/, and renders it with its FAQ accordion inline. Triggered by a "?" button in the page header.

3. **SetupChecklist** — a dismissible, state-aware checklist component on the tournament dashboard that tracks setup milestones (divisions added, registration open, teams accepted, schedule built, published) and links each item to the relevant page. Not a help component per se, but currently the biggest first-run gap.

4. **HelpTooltip (fixed)** — the existing component needs: pointer-events restored so the popover is reachable by touch, onFocus/onBlur handlers added alongside onMouseEnter/onMouseLeave so keyboard users can open it, a pointerdown outside-click handler to replace the mousedown one, and aria-describedby on the trigger button pointing to the popover id.

---

## 7. ENOUGH OR TOO MUCH?

**The verdict for tournament organizers is: too little, in the wrong places, in inconsistent forms.**

The guide system has 18 sections of content for one module — more than enough coverage in aggregate — but it is organized on two competing axes, hidden behind a slideshow, and reachable only by navigating away from the admin pages where operators actually need it. The in-app toolkit has two patterns and applies them on two pages, both in empty states only.

**Pages that most urgently need contextual help (none currently have any):**

- **Divisions** — pool count, requiresPoolSelection, fee inheritance, and tie-breaker cascade are the most conceptually novel controls in the entire setup flow. Zero help.
- **Registrations** — the accept/waitlist/reject lifecycle and what each state means for notifications and scheduling eligibility is invisible in the UI. Zero help.
- **Communication** — site-only vs email announcement, and what "targeted" means, are non-obvious. Zero help.
- **Check-in** — the admin vs gate-volunteer split and what check-in state affects are opaque. Zero help.
- **Schedule (mid-workflow)** — the empty-state callout is correct but disappears once games exist; the Schedule Health panel, generator lock, bracket builder vs Playoff Wizard distinction, and publish-closes-registration side effect all have zero guidance.

**Places to trim (currently over-explained relative to their complexity):**

- Popular Questions rail — 8 FAQ buttons in the sidebar before the TOC are more navigation than most users need before they know what they are looking for; trim to the TOC only.
- Hub role-path cards — useful once for a new user, noise for every subsequent visit; collapse into a disclosure.
- Recipe sections — merge into subject sections; the current 18-section count is the direct result of carrying both. After merge the guide is 10–12 sections, which is the right depth.

---

## 8. PRIORITIZED RECOMMENDATIONS

| # | Recommendation | Impact | Effort | Area | Quick Win? |
|---|---|---|---|---|---|
| 1 | Replace slideshow with single-scroll article + sticky IntersectionObserver TOC | H | H | Guide layout | No |
| 2 | Collapse dual recipe/subject taxonomy into one workflow-ordered set of 10–12 sections | H | M | Content | No |
| 3 | Remove Popular Questions from the left rail; FAQ accordion stays below each section inline | H | L | Guide layout | Yes |
| 4 | Add "?" HelpDrawer trigger to every tournament admin page header | H | M | In-app | No |
| 5 | Build HelpDrawer primitive (slide-over, sectionId prop, renders from lib/help-content/) | H | M | In-app | No |
| 6 | Fix HelpTooltip: touch support (pointer-events, pointerdown outside-click), keyboard focus (onFocus/onBlur), aria-describedby | H | L | In-app | Yes |
| 7 | Add FieldHint primitive; apply to divisions modal (poolCount, requiresPoolSelection, fees) and schedule generator controls | H | L | In-app | Yes |
| 8 | Simplify hub to search + guide-card grid; collapse role paths into a disclosure | H | M | Hub | No |
| 9 | Add dismissible HelpCallout (variant=warning) adjacent to Publish button explaining registration-close side effect | H | L | In-app | Yes |
| 10 | Assign group='Data & Exports' to data-tools-imports and exports sections; fix "Guide" fallback bucket | M | L | Content | Yes |
| 11 | Make StatusLegendPopover unconditional on results page; add HelpCallout for first pending registration on registrations page | M | L | In-app | Yes |
| 12 | Add :focus-visible styles to every interactive element in help.module.css; add @media (prefers-reduced-motion) block; fix FAQ details onToggle handler | M | L | A11y | Yes |

---

## 9. PHASED PLAN

This plan supersedes docs/projects/active/TOURNAMENT_HELP_DOCS_REVIEW_PLAN.md, which described the layout that has now been shipped and found insufficient.

---

### Phase 1 — Structural Fix (Highest Leverage)
**Goal:** Eliminate the slideshow, collapse the dual taxonomy, fix the rail order.

**What operators get:** A single-scroll guide page where all content is visible and Ctrl+F-searchable. The TOC highlights where you are as you scroll. FAQs appear below the section they belong to, not between the search box and the navigation. The guide drops from 18 sections to ~10–12 by merging recipe sections into their subject twins as embedded step blocks.

**Scope:** Rewrite HelpPageLayout to render all sections sequentially with anchored h3 headings; add IntersectionObserver sticky TOC; remove Prev/Next pagination and "Topic N of 18" counter; remove Popular Questions block from the rail; merge recipe sections into subject sections in tournaments.tsx; assign groups to data-tools-imports and exports; remove the "Guide" fallback as a visible label.

**Content rule to codify in .claude/commands/docs.md:** One taxonomy axis per module; groups require minimum 2 sections; every section in a module that uses groups must have a group; recipe-style steps belong inside the subject section as a numbered Steps block.

---

### Phase 2 — In-App Contextual Help Rollout
> **Build-ready detail: [HELP_PHASE2_INCONTEXT_PLAN.md](HELP_PHASE2_INCONTEXT_PLAN.md) + [HELP_PHASE2_INCONTEXT_PM_BRIEF.md](HELP_PHASE2_INCONTEXT_PM_BRIEF.md)** (2026-06-18). Mockup: [help-phase2-incontext-prototype.html](help-phase2-incontext-prototype.html). The summary below is superseded by that dedicated plan, which grounds every item in the current code and adds the page→section map, the shared foundation (content registry + extracted `HelpSectionBlock` + `HelpDrawerProvider`), the standalone-coaches help entry point, and six new owner decisions.

**Goal:** Every tournament admin page has at least one help affordance available mid-workflow.

**What operators get:** A "?" button in the top-right of every tournament page header that opens a slide-over HelpDrawer showing the relevant guide section inline — no navigate-away required. HelpTooltip fixed so it works on touch devices. FieldHint primitive added and applied to the highest-confusion form fields (divisions, schedule generator). HelpCallout variant=warning deployed before publish, clear-bracket, and archive-seal actions. StatusLegendPopover made unconditional on results page.

**Scope:** Build HelpDrawer primitive; add "?" trigger to TournamentAdminHeader following the existing "Scorekeeper" button convention; fix HelpTooltip (touch, keyboard, aria); add FieldHint to global help.module.css; apply to divisions, schedule, and registration-fields pages; add variant=warning callouts to schedule publish and results revert flows.

---

### Phase 3 — Hub Simplification
**Goal:** Reduce the hub from five entry systems to two.

**What operators get:** A large search bar as the primary entry point, with results replacing the page when active. A single grid of guide cards (one per module) as the browse fallback. Role paths collapse into a "New to FieldLogicHQ?" disclosure for first-time users. "Start Here" cards and "How Do I..." task-link block are retired.

**Scope:** Refactor HelpHubClient to remove featuredCards and quickLinks sections; move rolePaths into a collapsed disclosure component; update page.tsx to remove now-unused arrays; visual design pass to establish three-tier hierarchy (group header, card title, meta) using design-system tokens.

---

### Phase 4 — Accessibility and Token Alignment
**Goal:** Every interactive element in the help system is keyboard-navigable and motion-respecting; CSS is token-aligned with the rest of the platform.

**What operators get:** Visible focus rings on every clickable element. FAQ accordions that toggle correctly with keyboard. Screen readers announce search result counts. Animations off for users who have reduced motion enabled. The blue accent (#4fa3e0) aligned to --info-rgb so help-system colors update automatically when tokens change.

**Scope:** Add :focus-visible rules for all interactive classes in help.module.css; add @media (prefers-reduced-motion) block; fix FAQ details onToggle handler; add aria-live regions for search result counts; fix focus management after topic switch (tabIndex -1 on article, focus() call after section change); replace all literal hex and rgba values with CSS custom property references.

---

### Phase 5 — SetupChecklist and Search Gaps
**Goal:** New tournament organizers have an in-context progress tracker; high-frequency search terms reliably surface the right section.

**What operators get:** A checklist on the tournament dashboard tracking setup milestones (divisions, registration, schedule, publish), each linking directly to the relevant page. The "Tournament Plus" plan-tier name added to searchText of every section gating a Plus feature, so searching "Tournament Plus" reliably surfaces all gated-feature sections.

**Scope:** Build SetupChecklist component for dashboard; search metadata pass over tournaments.tsx adding "Tournament Plus" to registrations-and-teams, settings-and-access, public-communication, schedule-and-playoffs, archive-and-seal sections; add "waitlist promotion," "post-event email," and "check-in sheet" to relevant section keywords.

---

## 10. OPEN DECISIONS FOR THE OWNER

**Decision 1 — Single-scroll vs collapsible accordion for the guide page.** This review recommends single-scroll (all sections always rendered, sticky TOC highlights position). The alternative is a collapsible accordion where each section expands in place. Single-scroll enables Ctrl+F, real browser anchors, and faster scanning; the accordion reduces initial visual length. Both are better than the current slideshow. Which feels right for an operator who is mid-task and wants to skim to the relevant section?

**Decision 2 — HelpDrawer vs deep-link in new tab.** The drawer (in-context slide-over) keeps operators on their current admin page; the deep-link (new tab to the guide page) is simpler to build and easier to maintain. The drawer requires a new shared primitive; the deep-link requires only a button and a URL. The data-tools page already proves the deep-link works. Is the context-preservation value of the drawer worth the build cost, or should Phase 2 ship with deep-links and defer the drawer?

**Decision 3 — Role paths: collapse to a disclosure on the hub, or move them into each guide page's intro.** The recommendation is a hub disclosure. The alternative — surfacing the relevant role path at the top of each guide page as a "Quick start for [role]" checklist — puts the guidance closer to the content. Both approaches retire role paths as a permanent hub section. Which location is more useful to a new organizer: the hub, or the guide page they have opened?

**Decision 4 — How far to extend contextual help beyond tournaments.** This review covers tournament-organizer pages. The same coverage gaps exist on house-league, rep-teams, accounting, and org-admin pages. Should Phase 2 instrument all modules, or should the tournament rollout serve as a template that module owners apply later?

**Decision 5 — SetupChecklist: shared primitive or tournament-specific feature.** A reusable checklist component could serve any module with a linear setup sequence (house league seasons, rep team rosters). Building it as a shared primitive adds build cost but reduces future per-module work. Should Phase 5 build a generic checklist primitive or a tournament-specific one first?

**Decision 6 — "Guide" counter in the TOC.** After Phase 1 the single-scroll layout makes "Topic N of M" unnecessary. Should any topic-count signal appear in the UI (e.g. "12 topics" on the guide card in the hub, as the hub wireframe above shows) or should depth be conveyed only by scrolling and the TOC?

---

## 12. Decision Log & Open-Question Updates (2026-06-17)

Captured from the owner review of this plan.

**DECIDED — In-app help vehicle (Decision 2): build the HelpDrawer slide-over**, not just deep-links. A "?" in each tournament page header opens a panel rendering that page's guide section in-context; operators never leave the page. This is the everyday help surface and the primary overwhelm-reducer (see note below). Phase 2 builds the `HelpDrawer` primitive.

**DECIDED — Guide-page layout (Decision 1): SINGLE-SCROLL with a sticky map.** Owner reviewed an interactive prototype (`docs/projects/active/help-layout-prototype.html`) comparing accordion vs single-scroll and chose **single-scroll**. Two refinements were confirmed in the same review to address the "a big guide gets long" concern:
- **Sub-groups (a second grouping level): Group → Sub-section → Topic**, used *only where a group is large* (most groups stay flat). Demonstrated in the prototype on the ~25-topic Tournaments example.
- **Adaptive sticky map:** the left contents map is collapsible per group and **auto-focuses on the group the reader is currently in** (others collapse), so the map never becomes a wall even on a long guide. Search reveals all groups.

This sets the content-contract requirement: the help content model must support an optional sub-group level, and the guide layout must render group → sub-section → topic with a scroll-spy'd, collapsible TOC. Earlier "working lean = accordion/hybrid" is superseded by this decision.

### Note on content volume / progressive disclosure (addresses the overwhelm concern)

1. **Scope is per-module, not global.** Each role/module has its **own** guide page (Tournaments, Org Admin, Coaches, Accounting…). The layout choice governs only the ~10–12 topics **within one module's guide**. We are never putting all roles' content on one page; the hub routes to separate per-module guides.
2. **Volume is constant across layouts.** Slideshow, accordion, and single-scroll all contain the same words. The slideshow does not reduce volume — it hides 17/18 topics and removes the content map. Overwhelm comes from *lack of orientation + inability to find your spot*, not from page length. A persistent grouped TOC (~6 groups) + in-guide search is the map; users jump to a section rather than reading linearly.
3. **The HelpDrawer changes the load profile.** Because day-to-day help is now delivered as a single in-context section via the drawer, the full guide page is no longer the everyday surface — it becomes the occasional "browse/learn everything" library. This materially lowers the stakes of the full-guide-page length.
4. **Accordion vs single-scroll trade-off** (for the final call): accordion opens as a short, clean list of headings (best first-glance calm; costs a click + no cross-section Ctrl+F, mitigated by in-guide search); single-scroll is best for power-scanning and Ctrl+F but looks longer on arrival; hybrid offers both via an "expand all" toggle. Phase 1 should implement whichever the owner selects; the rest of Phase 1 (kill slideshow as the model, collapse dual taxonomy to ~10–12 single-axis topics, fix rail order, remove "Topic N of 18") is unaffected by this choice.

**Next step chosen:** owner is reading the full plan before any build. No code changes until the layout call (Decision 1) is locked and a focused Phase-1 UX plan is approved.

**ADDED — Discovery & Orientation layer (Layer 3).** Owner flagged a third, under-served help need: the *new, non-technical* user who doesn't yet know what to ask ("where do I start? what can this do for me? what will my parents/coaches/volunteers experience?") and can't discover capabilities they don't know exist (e.g. handing scorekeeping/check-in to volunteers). A focused design pass produced **§13 — The Discovery & Orientation Layer**, which extends the existing setup wizard + draft dashboard across the whole lifecycle with anti-overwhelm guardrails. This makes the model a **three-layer** one: Layer 1 Reference (guide pages), Layer 2 Contextual (tooltips / FieldHint / HelpDrawer), Layer 3 Discovery & Orientation (§13). The thin "Phase 5 — SetupChecklist" is superseded by the expanded **Phase 5a/5b** in §13.

**SCOPED — Guided tours (§14).** §13 deferred coachmark/walkthrough tours; the owner asked for a level-of-effort + UX proposal, now answered in **§14**. Recommendation: keep tours deferred behind the Layer 2 contextual surfaces; if new-user confusion persists after L2 ships, build **2 small opt-in tours** ("Set up your first tournament", "Hand off scorekeeping") on a permissively-licensed tour library — **~8–10 dev-days for the first two**, ~1 day each additional, plus a standing **~1–2 dev-days/quarter maintenance tax** (element-anchored tours break when the reorderable dashboard changes). Note: Shepherd.js and intro.js are AGPL — disqualified for commercial use.

---

## 11. APPENDIX — VERIFIED FINDINGS TABLE

### High-Severity Findings by Area

| ID | Title | Severity | Area | Verification Verdict |
|---|---|---|---|---|
| IA-001 | Slideshow pagination hides the content map | High | Guide layout | Partially true — slideshow confirmed; deep-link-on-reload claim refuted (hash is restored on mount via useEffect) |
| IA-002 | Popular Questions between search and topic nav | High | Guide layout | Confirmed |
| IA-003 | Dual taxonomy creates near-duplicate sections | High | Content | Partially true — overlap confirmed; Setup group count misstated (4 sections, not 3 as claimed) |
| IA-004 | Hub presents four competing entry systems | High | Hub | Partially true — confirmed for default state; featured cards are conditionally hidden when search is active (mild overstatement) |
| IA-006 | Contextual help absent from most tournament pages | Medium | In-app | Confirmed |
| VD-001 | Five competing labels above article content | High | Guide layout | Partially true — six layers confirmed (reviewer missed intro paragraph); role badge placement misdescribed |
| VD-002 | Rail stacks search + FAQs + TOC at identical weight | High | Guide layout | Confirmed |
| VD-003 | Hub four systems share same section-header style | High | Hub | Partially true — three systems share helpUtilityTitle; the guide-card group headers are meaningfully differentiated (helpHubGroupHeader) |
| CT-001 | Dual-axis taxonomy confirmed | High | Content | Confirmed |
| CT-002 | Seven of nine groups hold one section each | High | Content | Partially true — ratio wrong (6 of 7, not 7 of 9); directional finding confirmed |
| CT-003 | Two sections fall into "Guide" catch-all | High | Content | Confirmed |
| CT-004 | FAQ strategy three-layered and incoherent | High | Content | Partially true — core cross-section bleed scenario refuted (pagePopularFaqs is always empty for tournaments guide because all FAQs are section-attached); rail-vs-article duplication and three-surface incoherence confirmed |
| INV-001 | Schedule page help only on empty state | High | In-app | Confirmed |
| INV-002 | Results page help only on empty state | High | In-app | Confirmed |
| INV-004 | Divisions page zero help on dense controls | High | In-app | Partially true — playoffConfig bracket fields are not user-facing controls on this page (inherited from existing record); remaining fields confirmed with zero help |
| CPF-001 | HelpTooltip broken on touch | High | In-app | Confirmed |
| CPF-006 | No in-context guide surfacing from admin pages | High | In-app | Confirmed |
| CPF-007 | No pre-action warning for irreversible operations | High | In-app | Confirmed |
| A11Y-001 | HelpTooltip no keyboard path, conflicting ARIA | High | In-app | Confirmed |
| A11Y-002 | FAQ details controlled open prop, no onToggle | High | Guide layout | Confirmed |
| A11Y-003 | No focus management after topic switch | High | Guide layout | Confirmed |
| A11Y-004 | Search result counts not announced to screen readers | High | Guide layout | Confirmed |
| A11Y-005 | No :focus-visible styles on interactive elements | High | Guide layout | Confirmed |

### Refuted or Materially Overstated Claims

**IA-001 deep-link-on-reload:** The reviewer claimed that reloads always land on section 1 regardless of the URL hash. This is wrong. The useEffect hook at lines 104–133 of HelpPageLayout.tsx calls applyHash() on mount, reads window.location.hash, finds the matching section, and restores it. Deep links do survive reloads. The slideshow critique stands; this specific evidence does not.

**CT-004 cross-section FAQ bleed:** The reviewer described the "Related Questions" section padding with popular FAQs from unrelated sections (e.g. showing "How do I publish a tournament?" while reading the schedule builder). The code at line 178 filters pagePopularFaqs using `!faq.sectionId` — which excludes every FAQ in tournaments.tsx because all FAQs are attached to sections. The pagePopularFaqs list is always empty for this guide. The three-surface incoherence and rail-vs-article duplication are real; the specific cross-section contamination scenario is not what the code does.

**VD-003 hub section-header uniformity:** The reviewer counted "all four sections" sharing helpUtilityTitle. The guide-card group headers use a separate helpHubGroupHeader style (0.92rem, mixed case, horizontal rule separator) — meaningfully different from the three-section uniform utility-label style. The three-system critique is valid; the fourth system is already visually differentiated.

---

## 13. The Discovery & Orientation Layer (New-User Journey)

This section defines Layer 3 of the three-layer help model — Discovery & Orientation — which answers the new user's prior question: "where do I start, what can this platform do for me, and what journey am I creating for everyone else?" It extends the existing setup wizard and state-aware draft dashboard rather than duplicating them, inheriting their philosophy of progressive disclosure and one-clear-next-action at every point in the tournament lifecycle.

---

### B. The Problem

A first-time tournament organizer using FieldLogicHQ can complete the setup wizard, work through the draft launch checklist, and activate their tournament without ever learning that a volunteer can run all scorekeeping from their phone, that parents can install a fan app with live score alerts, that the schedule appears on the public site the instant it is saved (no publish button), or that a built-in Playoff Wizard eliminates the error-prone task of building brackets by hand. These are not edge cases — they are the capabilities that define whether game day is smooth or chaotic. The user does not know to search for them because they do not know they exist. On top of unknown unknowns, first-time organizers carry outcome questions that the platform never directly answers: "What will my coaches and parents see before, during, and after the event?", "How do I actually run game day?", "What does publishing even mean?" The setup wizard and checklist answer the question "what do I need to fill in?" but not "what am I building for everyone, and how does it all work on the day?"

---

### C. Design Principles (Anti-Overwhelm)

1. **One next-best action per stage.** At any lifecycle moment, surface exactly one recommended step with a one-sentence reason — not a menu of everything the organizer could do.
2. **Lifecycle-timed, not front-loaded.** Guidance about scorekeepers, check-in, and playoffs appears at the moment it becomes relevant, not on day one alongside divisions and venues.
3. **Dismissible and never blocking.** Every spotlight, nudge, and orientation card can be dismissed with one click and never reappears once acted on or dismissed.
4. **Beginner-aware, invisible to returning users.** Tips that a user has already seen or acted on are permanently suppressed; a returning organizer opening their second tournament sees only stage-appropriate guidance, not first-run orientation.
5. **Outcome-worded, not feature-named.** Guidance says "Free up your hands on game day — hand scorekeeping to a volunteer" rather than "Visit the Staff Kit page."
6. **Progressive disclosure across the lifecycle.** Orientation-level context appears first; secondary capabilities (check-in, fan alerts, data import) surface in the middle stages; advanced operations (bracket configuration, PDF export, custom branding) are reachable but never foregrounded until relevant.
7. **Pull always available.** Because tips are sparse and dismissible, a persistent outcome-organized HelpDrawer (Layer 2) and guide pages (Layer 1) serve as the always-accessible safety net — the organizer can retrieve any dismissed tip on demand.

---

### D. The Layer's Surfaces

#### D1. Lifecycle Guidance Rail — "What's Next" Dashboard Card

**What the organizer sees.** A single card pinned at the top of the tournament dashboard, just below the page header. The card has a short headline, one sentence of context, and one primary action button. Below the button is a smaller "Did you know?" line — a single capability nudge relevant to the current stage. The card does not list all possible actions; it surfaces exactly one.

**Where it lives.** Top of the dashboard, above the launch checklist (draft) or the metric strip (active/live/post). It replaces the current empty header space, occupying the same visual tier as the existing coin-toss alert.

**When it appears.** Every stage, every visit — but the content shifts by stage (see the Lifecycle Map in section E). It is not dismissible as a whole; it is the dashboard's persistent orientation anchor. The "Did you know?" nudge within it IS dismissible per tip.

**How it avoids overwhelm.** The card contains one action and one nudge — never a list. Previous-stage content retires automatically as the tournament advances. The nudge line is visually subordinate (smaller text, muted color) so the primary action remains unambiguous.

**How it extends the wizard/dashboard.** The wizard ends at the draft; the dashboard's launch checklist covers required setup. This card picks up where both leave off — it bridges each stage transition ("You've activated — here's what teams see now") and carries the same single-CTA discipline the checklist already uses.

**Build note.** Implemented as a `<GuidanceRail>` component inserted at the top of each dashboard stage render (draft/active/live/completed branches in `dashboard/page.tsx`). Tip dismissal stored as a per-tournament localStorage key (`guidance_nudge_{tournamentId}_{tipId}`). No migration required for v1.

---

#### D2. Capability Spotlight — "Did You Know?" Cards

**What the organizer sees.** A small, bordered card — roughly the size of a dashboard metric chip — that appears inline within the Guidance Rail (see D1) or, for higher-priority moments, as a slim banner just above the relevant dashboard panel. It contains: a one-line headline ("Did you know?"), one benefit sentence, one link, and an X dismiss button. It never appears as a modal or a blocking overlay.

**Where it lives.** Primarily inside the D1 Guidance Rail nudge line. For pre-event staff delegation — the highest-value unknown unknown — it also appears as a slim dismissible banner above the pre-event panel zone, matching the existing `reuseSetupPrompt` banner pattern in the dashboard.

**When it appears.** Triggered by lifecycle milestone, not by a schedule or a day counter. Each spotlight has one trigger condition:

| Spotlight | Trigger |
|---|---|
| Scorekeeper volunteer handoff | Tournament transitions to Active AND no staff-kit visit recorded |
| Gate check-in volunteer | Schedule health score >= 80 AND event is >= 3 days away |
| Fan PWA / score alerts (Plus) | First time branding page visited OR activated on Tournament Plus |
| Playoff Wizard | Pool play >= 80% complete AND no playoff games exist |
| Data import | Registrations list is empty AND organizer first visits the registrations page |
| Post-event summary (Plus) | Tournament transitions to completed state |
| Clone / reuse setup | Completed state, Plus plan, first completed tournament |

**How it avoids overwhelm.** One card at a time. Dismissed once, never repeated. Never shown as a batch. Tips that have been acted on (e.g., organizer visits Staff Kit after seeing the nudge) are suppressed immediately.

**How it extends the wizard/dashboard.** The wizard and checklist cover required setup only; they deliberately say nothing about volunteer delegation or fan experience. These spotlights fill the capability gap without touching the wizard's scope.

**Build note.** Each spotlight is a data object `{ id, triggerFn, headline, body, linkLabel, linkHref }`. Dismiss flags stored in localStorage keyed by `spotlight_{tournamentId}_{id}`. Server-side dismissal (using a `dismissed_tips` JSONB field on the member or tournament row) is the Phase 2 upgrade to make suppression cross-device.

---

#### D3. "What Your Parents, Coaches & Volunteers Will Experience" Explainer

**What the organizer sees.** A collapsible panel on the dashboard — visible in the draft and active stages — titled "What everyone else sees." When expanded, it shows three short persona cards side by side (or stacked on mobile):

- **Parents & Fans** — public tournament site, live standings, fan PWA alerts (Plus)
- **Coaches & Team Managers** — registration form, public schedule, coach portal
- **Scorekeepers & Gate Volunteers** — phone-friendly scoring view, check-in board, no admin access

Each persona card has: a one-line description of what they experience, the lifecycle moment when they first see anything ("From the moment you activate"), and a link to preview or visit the relevant surface. The panel defaults to collapsed on returning visits but defaults to open the first time an organizer views their draft dashboard.

**Where it lives.** Dashboard — collapsed panel below the Guidance Rail (D1), above the launch checklist. Also available as a section in the HelpDrawer under "Overview" (Layer 2), and as the first section of the guide page for discovery-via-search (Layer 1).

**When it appears.** Always present from draft onward, but collapsed after first expansion. The first-time draft dashboard expands it automatically. After the organizer collapses it, it stays collapsed.

**How it avoids overwhelm.** Collapsed by default after the first visit — it never dominates the dashboard. Each persona card is three lines maximum. Deep detail lives in the guide section (Layer 1) and preview page, not in this panel.

**How it extends the wizard/dashboard.** The wizard's Review step confirms what the organizer is building; the checklist confirms readiness. This panel is the first time the organizer is explicitly shown the perspective of the people their tournament serves — a gap the current product entirely lacks.

**Build note.** Collapse state stored in localStorage (`persona_panel_expanded_{tournamentId}`). Persona cards link to: `/admin/tournaments/preview/[slug]` (fan/parent view), the public registration URL (coach/team view), and `/admin/tournaments/staff-kit` (volunteer view).

---

#### D4. Outcome-Oriented Help Entry — "I want to…" Task Shortcuts

**What the organizer sees.** A short, curated list of outcome-worded task links — five to seven items — surfaced in two places: (a) as a collapsed "Common tasks" section at the bottom of the D1 Guidance Rail card, revealed by a "See common tasks" link, and (b) as the first visible section when the organizer opens the HelpDrawer ("?") from any tournament admin page. The list is lifecycle-filtered — it shows only tasks relevant to the current stage.

Example items (draft stage):
- "Preview what teams will see before I go live"
- "Set up divisions and pool play"
- "Import a team list from a spreadsheet"
- "Understand what activating does"

Example items (pre-event stage):
- "Get my schedule onto the public site"
- "Set up a playoff bracket"
- "Hand scorekeeping to a volunteer"
- "Send an announcement to all registered teams"

**What makes this different from the retired help hub "How Do I" block.** The old block was a static, exhaustive list organized by feature name. This list is curated (five to seven items), outcome-worded, and changes by lifecycle stage. It answers the questions the organizer is actually asking right now, not every question they might ever ask.

**How it avoids overwhelm.** Seven items maximum per stage. Collapsed behind a link from the Guidance Rail — it does not dominate the dashboard. The HelpDrawer version is the same list, not a separate exhaustive index.

**Build note.** Task list data lives in `lib/help-content/tournaments.tsx` as a new `taskShortcuts` export, keyed by stage. The HelpDrawer renders the stage-appropriate slice at the top of the panel. No new route required.

---

#### D5. First-Run Orientation Moment (Wizard Bridge)

**What the organizer sees.** Two lightweight additions to the existing wizard — neither blocking, neither verbose:

1. **First-time context blurb (wizard step 1, first-time organizers only).** Three bullet points above the tournament name field, visible only when `hasPastTournaments === false`. Content: "You're building a public tournament page your teams can find and register on. Your schedule, standings, and results will be live for coaches and parents on game day. You're in control of when it goes public — nothing is visible until you activate." Three lines. No CTA. Purely orienting.

2. **"What happens next" callout (wizard Review step, step 5).** A static box below the review summary, every time. Content: "After saving, you'll complete your setup checklist in the dashboard, preview what teams see, and activate when you're ready. Nothing goes public until you activate." This bridges the wizard exit to dashboard orientation — the single most disorienting handoff in the current flow.

**How it avoids overwhelm.** Three bullets and one static callout — no additional steps, no modal, no video. Both are skimmable in under ten seconds. Neither changes the wizard's flow or adds required steps.

**How it extends the wizard.** The wizard's Review step already reassures the organizer that the tournament is private. This callout makes the post-wizard journey explicit — "here is what you do next" — which the current Review step does not do at all.

---

### E. Lifecycle-Stage Map

| Stage | Organizer's one next-best action | Capability nudge to surface | What parents/coaches/volunteers experience |
|---|---|---|---|
| **Create** (wizard) | Complete the wizard — name, dates, first division | "You can copy last year's tournament — divisions, venues, rules — in one step" (shown only if past tournaments exist) | Nothing — tournament is completely private as a draft |
| **Set up** (draft checklist) | Complete the two required checklist items (dates, one division) | "Preview what teams will see before you go live — try it from the sidebar" | Nothing — draft is invisible to all external roles |
| **Pre-launch** (draft, checklist complete) | Preview the public page, then activate | "Activating doesn't send any emails automatically — you control that from Communications" | Public page goes live the moment you activate; parents can view info and register if a division is open |
| **Registration open** (active, registrations > 0) | Review pending registrations and accept or waitlist teams | "Only accepted teams appear in the schedule builder — review pending teams before you build" | Parents/coaches see public page and registration form; no confirmation email unless organizer sends one |
| **Pre-event** (active, schedule published) | Send "Schedule is live" announcement to teams | "Hand scorekeeping to a volunteer — they get a phone scoring view and you stay off the field" (Staff Kit spotlight) | Parents see live schedule on public site; coaches can view game times and fields; volunteers can test scoring/check-in access |
| **During event** (live/game-day) | Check Games Progress and confirm any scores in review | "Pool play nearly done? Open the Playoff Wizard from the Schedule page to build your bracket" (when pool games > 80% complete) | Parents see live scores update on public site; Plus fans get push alerts; scorekeepers enter scores on phone; gate volunteers run check-in |
| **After event** (completed/post-event) | Confirm all scores are final, then mark tournament Completed | "Completing the tournament unlocks your event summary and sets up next year's reuse" (Plus) | Public results and standings remain accessible at the original URL permanently; parents can share/bookmark final results |

---

### F. ASCII Mockups

#### F(i) — Dashboard Lifecycle Guidance Rail with "Did You Know?" Nudge (pre-event stage)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Your event is 4 days away                                          │
│                                                                     │
│  Teams are registered and your schedule is published. The next      │
│  step is making sure game-day operations are covered.               │
│                                                                     │
│  [ Set up volunteer access →  ]                                     │
│                                                                     │
│  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ │
│  💡 Did you know?  Scorekeeper volunteers use a phone-friendly       │
│  scoring view — no admin access needed. Generate their QR code      │
│  in Staff Kit.   [ Show me ]                          [ Dismiss × ] │
└─────────────────────────────────────────────────────────────────────┘
```

#### F(ii) — "What Everyone Will Experience" Persona-Journey Panel (draft stage, first visit expanded)

```
┌─────────────────────────────────────────────────────────────────────┐
│  What everyone else sees                                    [ ∧ ]   │
├────────────────────┬────────────────────┬───────────────────────────┤
│  Parents & Fans    │  Coaches & Teams   │  Scorekeepers & Volunteers │
│                    │                    │                            │
│  Public site with  │  Registration form │  Phone-friendly scoring    │
│  schedule, results,│  and public        │  view — today's games      │
│  standings, and    │  schedule. No      │  only, no admin access.    │
│  news. Plus: fan   │  admin access.     │  Gate volunteers run       │
│  app with live     │                    │  check-in from a           │
│  score alerts.     │  From activation.  │  separate board.           │
│                    │                    │                            │
│  From activation.  │  [ Preview reg → ] │  [ See Staff Kit → ]       │
│  [ Preview site → ]│                    │                            │
└────────────────────┴────────────────────┴───────────────────────────┘
│  This is the journey your tournament creates for everyone involved.  │
│  [ Learn more in the guide ]                                         │
└─────────────────────────────────────────────────────────────────────┘
```

#### F(iii) — "Did You Know?" Capability Spotlight in Context (inline banner, pre-event)

```
 ─────────────────────────────────────────────────────────────────────
  ┌──────────────────────────────────────────────────────────────── × ┐
  │ 💡 Did you know?                                                   │
  │ You can hand scorekeeping to a volunteer — they get a phone-       │
  │ friendly scoring view and can't see registration, payments, or     │
  │ any other part of your admin. Generate their access link in        │
  │ under 30 seconds.                          [ Open Staff Kit → ]    │
  └───────────────────────────────────────────────────────────────────┘
 ─────────────────────────────────────────────────────────────────────
  [ Schedule Health  92/100 · 1 warning ]    [ Customize dashboard ]
```

---

### G. How the Three Layers Coexist

| User intent | Layer | Surface that answers it |
|---|---|---|
| "I don't know what this platform can do for me" | Layer 3 — Discovery | Persona panel (D3), first-run orientation blurb (D5) |
| "Where do I start / what do I do next?" | Layer 3 — Discovery | Lifecycle Guidance Rail (D1), "I want to…" shortcuts (D4) |
| "I didn't know that capability existed" | Layer 3 — Discovery | Capability Spotlight (D2), lifecycle-timed "Did you know?" nudge |
| "What will my parents and coaches experience?" | Layer 3 — Discovery | Persona-journey panel (D3), preview page |
| "What does THIS toggle / field / section do?" | Layer 2 — Contextual | FieldHint tooltip, HelpDrawer section for current page |
| "How do I do this step by step?" | Layer 1 — Reference | Guide page section, opened via HelpDrawer or "I want to…" shortcut |
| "Give me the full procedure for playoffs" | Layer 1 — Reference | Guide page: Schedule & Playoffs section |
| "I want to search for something specific" | Layer 1 — Reference | Help search (matches keywords / searchText / answerText in help content) |
| "I dismissed a tip and now I need it back" | Layer 1 — Reference | HelpDrawer — "Common tasks" section, always accessible |
| "I'm a scorekeeper — where do I enter scores?" | Role-scoped Layer 3 | Scorekeeper surface orientation (separate from organizer layer) |

No content is duplicated across layers. Layer 3 surfaces give just enough to motivate exploration. Layer 2 answers the point-of-confusion "what does this mean?" Layer 1 gives the full procedure. The Guidance Rail (Layer 3) and the HelpDrawer (Layer 2) share the same `taskShortcuts` data from `lib/help-content/tournaments.tsx` — one content source, two access modes.

---

### H. Updated Phase Plan Slot

The existing plan has a thin "Phase 5 — Setup Checklist" slot. This should be expanded and renamed as follows:

**Recommended: rename Phase 5 to "Phase 5 — Discovery & Orientation" and split delivery across two drops.**

**Phase 5a — High-value, low-risk surfaces (ship with or shortly after Layer 2 HelpDrawer)**

Dependencies: Layer 1 guide taxonomy finalized; HelpDrawer shell (Layer 2) exists so "I want to…" shortcuts have a home.

Ships:
- D1 Lifecycle Guidance Rail with stage-appropriate headline + action (draft, active, live, completed)
- D2 Capability Spotlights — Staff Kit and Playoff Wizard spotlights only (highest-value, lowest build cost)
- D4 "I want to…" outcome shortcuts in HelpDrawer (lifecycle-filtered, five items per stage)
- D5 First-run wizard additions (three-bullet context blurb + "what happens next" callout on Review step)
- Empty-state teaching moments on the Staff Kit page and Data Tools page (static copy additions, no logic)

Rationale: D1, D4, and D5 are static or near-static content additions; D2 spotlights require only localStorage flags; all five items can ship without any schema changes. These surfaces deliver the highest-value unknown-unknown fixes (scorekeeper handoff, playoff wizard) at the lowest implementation cost.

**Phase 5b — Persona journey + full spotlight suite (follow-on, after Phase 5a is stable)**

Dependencies: Phase 5a live; preview page confirmed stable; at least three tournaments have completed the new guidance rail flow.

Ships:
- D3 Persona-journey "What everyone else sees" collapsible panel on the dashboard
- D2 Remaining capability spotlights (fan PWA, data import, post-event summary, clone/reuse)
- Cross-device dismiss sync (move localStorage flags to a `dismissed_tips` JSONB column on `organization_members` or a new `member_tips` table — one migration)
- "Day-of toolkit" discovery card in the draft dashboard optional checklist section
- Post-event wrap-up "Next steps" row on the completed-tournament wrap-up card

Rationale: D3 requires design validation that the persona panel layout works at all viewport sizes and doesn't clutter the dashboard for returning users. The full spotlight suite needs the cross-device dismiss infrastructure to feel polished. These can afford a follow-on slot.

**What does NOT belong in this phase plan:** guided product tours, video walkthroughs, and coach/scorekeeper role-specific onboarding flows. These are legitimate future work but carry higher build cost and higher overwhelm risk. Defer until the static and lifecycle-timed surfaces above have been measured for engagement.

---

### I. Open Decisions for the Owner

1. **How aggressive should capability nudges be on game day?** The pre-event Staff Kit spotlight is well-timed. But if an organizer arrives on game day and has never set up scorekeepers, showing a "Did you know?" nudge competes with the chaos of running the event. Decision needed: should the Playoff Wizard and Staff Kit spotlights hard-stop after the tournament goes live, appearing only during pre-event, or should they remain available as a quieter "Help" link on game day?

2. **Dashboard panel vs. guide section vs. both for the persona-journey explainer.** The mockup above shows the persona panel on the dashboard. An alternative is to make it purely a guide section (Layer 1) opened from a "What will everyone experience?" link in the Guidance Rail — keeping the dashboard cleaner. A third option is both: a two-line teaser on the dashboard that opens the full explainer in the HelpDrawer. The right answer depends on whether you expect organizers to look for it proactively (guide section) or need to be shown it exists (dashboard panel). Given that this is precisely an unknown-unknown, the dashboard panel version is recommended — but the owner should decide.

3. **Beginner vs. returning detection: localStorage only (v1) or a server column (v1)?** localStorage means dismiss flags are lost when the organizer clears their browser or switches devices — they will see already-dismissed spotlights again on a new device. A `dismissed_tips` JSONB column on `organization_members` (one migration, minimal schema footprint) makes suppress-forever actually work across devices. The question is whether the v1 ship should accept the localStorage limitation or whether the cross-device behavior is important enough to require the migration upfront.

4. **Should the lifecycle guidance rail be a tournament-specific primitive or a reusable one for other modules?** The rail pattern (headline + one action + dismissible nudge) is equally applicable to house league seasons, rep team rosters, and coach portal setup — all modules that will eventually need their own orientation layer. Building it as a generic `<GuidanceRail stage={} steps={} nudge={}>` component now costs almost nothing extra and positions all future modules to use the same anti-overwhelm discipline. The alternative is a tournament-specific implementation that gets refactored later. Recommended: build generic from the start, but this needs an explicit decision before implementation begins.

5. **Should the "What happens after activation" transition moment be a brief modal or inline copy?** The current activate-confirm modal (two lines) tells the organizer the public URL will go live. The question is whether extending that modal with two additional lines ("Activating doesn't send emails automatically — go to Communications to contact your teams") is the right surface, or whether a post-activation banner on the dashboard is less disruptive. A modal at the moment of activation has the highest attention but the lowest tolerance for verbosity — the organizer is anxious and wants to click confirm. A post-activation banner lands when the anxiety has passed. Recommended: post-activation banner, but the owner should confirm the preference.

---

## 14. Guided Tours — UX Proposal & Level of Effort

---

### A. Bottom Line

Add guided tours as a small, opt-in, two-tour Phase 5a release using **@reactour/tour** (MIT, ~18 KB gzipped, Floating UI positioning, React-idiomatic JSX steps) as the positioning and backdrop layer, paired with a thin custom step engine that reuses the existing wizard step-array pattern and localStorage dismissal pattern already in the codebase. First two tours — "Set up your first tournament" (4 steps, dashboard-only) and "Hand off scorekeeping" (3 steps, single page) — land at roughly **8–10 developer-days total** including engine wiring, dark-theme styling, accessibility, mobile fallback, and QA across all five dashboard status branches. The initial build is manageable; the real, ongoing cost is maintenance: element-anchored tours on a reorderable, branching dashboard have a 6–12 month decay cycle before steps silently point at wrong or missing elements, and every significant dashboard refactor requires a re-verification pass. Keep the tour set deliberately small (two tours to start, a hard cap of five lifetime), enforce a stable `data-tour-id` attribute convention on all targeted elements, and treat maintenance as a standing line item — roughly **half a day per significant dashboard change**. This stays deferred behind the Phase 4 L2 layer (FieldHint + HelpDrawer) and slots in as Phase 5a only after those contextual surfaces are live and proving insufficient for new-user orientation.

---

### B. How a User Would Experience a Tour

Tours are never launched automatically. A user reaches a tour through one of three paths:

1. **The §13 discovery rail** — the "What's next" milestone card on the dashboard (already planned for Phase 5) includes a "Show me how" link that triggers the relevant tour for the user's current tournament phase. This is the primary entry point: the tour is the "deep dive" escalation of the Did-you-know nudge.
2. **The help menu** — the "?" button already planned for each tournament page header includes a "Take a tour" item that launches the tour scoped to that page, if one exists.
3. **A one-time post-wizard offer** — after the Setup Wizard closes on a brand-new blank tournament, a single dismissible callout appears on the dashboard: "Want a quick walkthrough of what to do next? [Show me] [Not now]". If dismissed, it never appears again. This is a HelpCallout-style component, not a blocking modal.

**Step anatomy.** Each step is a coachmark — a compact card floating near the highlighted element, not a full-screen takeover. The card contains:

- A short heading (eight words or fewer)
- One sentence explaining why this element matters
- A footer row: **← Back** (disabled on step 1) · **Next →** (primary action) · dots showing current position · **Skip tour** as a text link at the far right

Behind the card, a semi-transparent dark overlay dims everything except a spotlight cutout around the targeted element, so the organizer's eye goes immediately to what the step is describing. The spotlight and card arrow track the element's live position.

**ASCII mockup — Step 2 of 4, "Launch checklist" panel:**

```
╔══════════════════════════════════════════════════════════════════╗
║  [dimmed dashboard content]                                      ║
║                                                                  ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │  ✓ Dates set                                            │   ║
║   │  ✓ Division added                                       │   ◄─ spotlight
║   │  ○ Venue (optional)                                     │   ║
║   │  ○ Schedule published                                   │   ║
║   └─────────────────────────────────────────────────────────┘   ║
║            ▲                                                     ║
║   ┌────────┴──────────────────────────────────────────┐         ║
║   │  Start here                                       │         ║
║   │  Complete these items to unlock the Activate      │         ║
║   │  button. Dates and one division are required.     │         ║
║   │                                                   │         ║
║   │  ← Back   [ Next → ]   ●●○○   Skip tour          │         ║
║   └───────────────────────────────────────────────────┘         ║
╚══════════════════════════════════════════════════════════════════╝
```

**Passive, not interactive.** Tours advance with Next/Back only — no "click this button to continue" steps. Tournament organizers are time-pressured; interactive tours that wait for a real click break silently when the UI re-renders or when the organizer is already in the middle of a task. Passive narration lets users absorb the tour on their own schedule and skip freely.

**Mobile (below 768px).** Element anchoring is dropped entirely on mobile. The coachmark becomes a centered modal with the same heading, body text, and footer but no backdrop spotlight and no element arrow. The user can still go Next/Back/Skip. This sidesteps every mobile anchoring failure mode (off-screen targets, collapsed sections, popover clipping) without requiring a separate mobile tour script.

**Skip and persistence.** "Skip tour" at any step immediately ends the tour and writes a localStorage key (matching the existing `flhq-help-dismissed-*` convention, e.g. `flhq-tour-dismissed-setup`). Completing the tour writes `flhq-tour-completed-setup`. Both keys prevent the tour from ever surfacing again through any entry point. If a user advances partway and closes the tab, the current step index is also persisted (`flhq-tour-progress-setup: 2`) and a "Resume tour" link appears in the help menu until the tour is completed or dismissed.

---

### C. Which Tours to Build

**Build these two first:**

| Tour | When offered | Steps | Value |
|---|---|---|---|
| Set up your first tournament | One-time post-wizard HelpCallout opt-in; also from "?" help menu on dashboard | 4 (dashboard-only, no cross-route) | Narrates the launch checklist — the single biggest new-user drop-off point |
| Hand off scorekeeping | "?" help menu on Scorekeeping page; or from the "Run game day" guidance rail card when status turns active | 3 (single page) | Surfaces the scorekeeper share link, which new organizers consistently miss |

A third candidate — "Understand the public page" (3 steps on the public preview) — is low risk because the public preview page has no drag zones or conditional branches. It can be Phase 5b once the first two tours have been live for a sprint and no major breakage has been observed.

**Do not build:**

- A "complete platform walkthrough" that spans settings, divisions, venues, schedule, and the dashboard. Cross-route tours spanning more than two pages multiply the maintenance surface without proportional value; the L1 guide pages and the L3 guidance rail cover the orientation role better.
- Any tour that targets an element inside the drag-reorderable card zones by position or DOM order. Only elements with a stable `data-tour-id` attribute are valid targets.
- Tours for power-user flows (bulk registration import, accounting, rep teams). The users who reach those flows do not need narration; they need fast reference, which the L1 help pages serve.

---

### D. Build vs. Buy

**Recommendation: adopt @reactour/tour as the positioning and backdrop layer; build a thin custom step engine on top.**

The codebase has zero positioning library today. HelpTooltip's pure-CSS absolute positioning clips at viewport edges and has no flip logic — it cannot safely anchor a coachmark to an arbitrary page element. Any element-anchored tour requires a positioning library. The options:

**Shepherd.js and intro.js are disqualified.** Both are AGPL-3.0 licensed. Using either in a commercial SaaS without a paid commercial license is a license violation. Do not evaluate further.

**driver.js** (~5 KB, MIT) is the lightest option and works as imperative vanilla JS inside a `useEffect`. Its downside is that tour state lives outside React — no hook integration, no idiomatic step gating by the existing `isDraft`/`isGameDay` flags, and cross-route resume requires manually wiring `useRouter` calls around an imperative object. For a product this deeply React-idiomatic, driver.js would feel like a foreign body.

**react-joyride v3** (~34 KB, MIT) is the most starred React tour library, uses Floating UI internally, and is WCAG-improved in v3. The bundle size and the fact that Floating UI is not yet in the dependency tree makes it heavier than necessary for two small tours.

**@reactour/tour** (~18 KB gzipped for `@reactour/tour` + `@reactour/mask`, MIT) sits in the middle: Floating UI positioning, headless-friendly component overrides, step definitions as React nodes (so existing HelpCallout content can be used inline), and a smaller community but adequate maintenance record. It adds `@floating-ui/react` as a new dependency — but that dependency is also the right foundation for the planned FieldHint and HelpDrawer L2 surfaces, so it is not tour-only cost.

**Custom build** with only `@floating-ui/react` (no tour library) is a valid alternative. The WIZARD_ORDER step-array and localStorage dismissal patterns are already proven in this codebase, and a thin TourEngine component (~150 lines) would reuse both. The cost is that focus trap, aria-live, spotlight rendering, and progress dots must all be built explicitly — roughly 1–2 extra days versus adopting @reactour/tour where these come partially for free. If the team wants zero third-party tour opinion in the markup, custom is the call; if they want to move faster and override styles, @reactour/tour is the call. Either way, `@floating-ui/react` is the single new runtime dependency.

**The existing TournamentSetupWizard proves the team can do step flows.** What it cannot do is anchor to ambient page elements — that is the one capability that requires the positioning library, and it is the only gap.

---

### E. Level of Effort

**Assumptions:** 1 mid-to-senior front-end developer. @reactour/tour selected as the tour library. Both recommended tours are single-page (no cross-route). No i18n required. Existing design tokens and HelpCallout CSS cover most styling. No automated tour QA (Playwright tour specs are out of scope for this phase).

| Work item | Dev days | T-shirt |
|---|---|---|
| Add @floating-ui/react + @reactour/tour; configure base TourProvider in the app shell; dark-theme style overrides using existing help.module.css tokens (backdrop, coachmark bubble, arrow, progress dots, skip link) | 1.5 | S |
| TourEngine: step definition schema, phase/status guards (skip step if element absent), `data-tour-id` attribute convention documented and added to targeted elements | 1.0 | S |
| localStorage persistence: dismissed/completed keys (reuse HelpCallout pattern), partial progress (step index), "Resume tour" link in help menu | 0.5 | XS |
| Mobile fallback: detect <768px viewport, swap element-anchored coachmark for centered modal card; test across three viewport sizes | 0.5 | XS |
| Accessibility: focus trap within coachmark, aria-live region for step announcements, keyboard Next/Back/Escape, backdrop non-interactive for screen readers | 1.0 | S |
| Tour 1 content — "Set up your first tournament" (4 steps): write step copy, add data-tour-id attributes to 4 dashboard targets, wire eligibility guard (draft status only) | 0.5 | XS |
| Tour 2 content — "Hand off scorekeeping" (3 steps): write step copy, add data-tour-id attributes to 3 targets on Scorekeeping page, wire eligibility guard | 0.5 | XS |
| Entry point wiring: post-wizard HelpCallout offer, "?" help menu items, guidance rail "Show me how" links | 0.5 | XS |
| QA — Tour 1 across all 5 dashboard status branches (draft / active-pre-event / active-game-day / active-post-event / completed); confirm absent-element skip logic fires correctly; desktop + mobile | 1.5 | S |
| QA — Tour 2 on Scorekeeping page; cross-browser; keyboard navigation; localStorage reset and re-test | 0.5 | XS |
| **Total — first 2 tours** | **8.0–10.0** | **M** |

**Incremental cost per additional tour (single-page, existing engine):** 0.5 days content authoring + 0.5 days QA = **~1 dev-day**, assuming the targeted page has no conditional rendering complexity. A tour on a conditionally branching page (like a second dashboard tour) adds 0.5–1 day for branch-guard logic and QA.

---

### F. The Real Cost Is Maintenance

Element-anchored tours are coupled to the UI they describe. Every time a targeted element moves, is renamed, is conditionally suppressed, or is wrapped in a new parent, the tour step either points at nothing or points at the wrong thing — silently, in production, for every user who hasn't yet completed the tour.

In this specific codebase, the maintenance surface is unusually high:

- The dashboard has three independently reorderable drag zones. A layout change in any of them can shift the visual position of a targeted card even if the element and its `data-tour-id` attribute are unchanged — the Floating UI anchor will still find the element correctly, but only if the attribute is on the card itself rather than a wrapper.
- The dashboard has five status branches. A new conditional section (e.g., a post-event summary panel added in a future sprint) added without checking whether it covers or displaces a tour target will silently break positioning.
- The admin section spans 16+ pages. Even single-page tours may target elements that shift during a UI redesign or when the page gains new panels.

**Quantified ongoing tax:** based on the dashboard's change cadence and the 6–12 month historical decay cycle for element-anchored tours on complex UIs, plan on **0.5 developer-days of tour re-verification per significant dashboard refactor** and **0.25 developer-days per page-level UI change** on any page with an active tour. With two tours live and the current sprint cadence, this is approximately **1–2 developer-days per quarter** as a standing maintenance line item — more if the dashboard undergoes a major layout change (e.g., the planned "dashboard customize in-place" drag/edit mode initiative would require a full tour re-verification pass).

**What reduces the tax:**

- A stable `data-tour-id` attribute convention on all targeted elements, treated as a public contract: the dev who removes or renames a targeted element owns updating the tour step in the same PR.
- Keeping the tour set small (two to three tours, hard cap). Each additional tour is additional maintenance surface.
- Scoping tours to stable, low-churn pages where possible. The Scorekeeping page changes far less often than the dashboard.
- Preferring the lighter §13 surfaces (guidance rail milestone cards, Did-you-know callouts) for most new-user orientation — tours should be the exception for the one or two flows where passive reading genuinely does not land.

---

### G. Risks That Would Push the Estimate Up

- **Cross-route tours.** If the owner later requests a tour spanning Settings → Divisions → Schedule → Dashboard (the natural "complete your setup" flow), add 2–3 days for routing persistence infrastructure (localStorage step index + page-mount resume logic) and an additional 1–1.5 days QA across all four pages and their respective conditional states. Cross-route tours are the single largest LOE multiplier.
- **The reorderable dashboard.** Any tour step anchored inside a drag zone must use `data-tour-id` attributes on individual card elements, not CSS selectors or DOM order. Adding `data-tour-id` to every potential target across three drag zones and documenting the convention is included in the current estimate; expanding tours to target additional reorderable cards in a future sprint costs 0.25–0.5 days per new target.
- **Mobile anchoring beyond the 768px fallback.** The centered-modal mobile fallback handles most cases. If the owner later wants element-anchored coachmarks on mobile (e.g., for a tablet-first scorekeeper workflow), this requires scroll-into-view logic, viewport dimension math, and significantly more QA. Add 1.5–2 days.
- **Accessibility hardening to WCAG 2.1 AA.** The estimate includes a baseline focus trap and aria-live. A full WCAG AA audit (reduced-motion support, high-contrast mode testing, screen reader testing in NVDA + VoiceOver) adds 1–1.5 days.
- **i18n.** Not in scope today. Adding French (or any second locale) to tour step copy after the fact requires extracting all step content to a translation key structure. Doing this at initial build costs 0.5 days; retrofitting it later costs more.
- **A11y regressions from the backdrop z-index layer.** The dashboard has DnD contexts, icon pickers, and add-menu popovers at z-index 60–100. A tour backdrop must sit above all of these without clipping the sticky tournament selector. If z-index conflicts arise during QA, resolving them could add 0.5–1 day.
- **Playwright tour automation.** Automated UAT specs for tours (verifying skip/resume/completion flows) are excluded from this estimate. If the release manager requires them before the Phase 5a ship gate, add 1 day per tour.

---

### H. Recommendation and Sequencing

**Keep guided tours deferred until Phase 5a, behind the Phase 4 L2 layer (FieldHint + HelpDrawer).**

The rationale: the "?" HelpDrawer and FieldHint contextual surfaces — the L2 layer — provide just-in-time, element-adjacent guidance without any of the anchoring fragility of a tour. They should ship first and be observed for 4–6 weeks to gauge how much new-user confusion remains. If organizers are still abandoning the setup flow or missing scorekeeping handoff after the L2 layer is live, that is the signal to build the tours.

When Phase 5a is greenlit, build in this order:

1. **Engine first** — TourProvider wiring, dark-theme styling, localStorage persistence, mobile fallback, accessibility baseline (~4–5 days). This is reusable for all future tours.
2. **Tour 1: Set up your first tournament** — the highest-value new-user orientation tour, dashboard-only, 4 steps (~1 day content + QA).
3. **Tour 2: Hand off scorekeeping** — the highest-value game-day tour, Scorekeeping page, 3 steps (~1 day content + QA).
4. Let both tours run for one full tournament season before authoring a third. Use localStorage completion-rate data (completions vs. dismissals) to decide whether tours are earning their maintenance cost before expanding the set.

The "Understand the public page" tour (Phase 5b candidate) should be held until the first two tours show positive completion rates. A completion rate below 30% is a signal to invest instead in improving the L1 guide pages or the L3 guidance rail rather than adding more tour content.

---

## 15. Mockup-First Sign-Off Convention (owner request, 2026-06-17)

Every phase's UX plan **opens with a visual** before any code is written, so the owner can sign off on what it looks like, not just a description. Clickable HTML prototype where the interaction matters; an annotated sketch where a static view is enough. The first prototype (`help-layout-prototype.html`) set the bar.

| Phase | Mockup for sign-off | What it should show |
|---|---|---|
| **1 — Help center usable** | ✅ **Done** (clickable) | Single-scroll guide + sub-groups + adaptive sticky map (`help-layout-prototype.html`); a simplified-hub sketch |
| **2 — In-context help** | ✅ **Done** (clickable) | [help-phase2-incontext-prototype.html](help-phase2-incontext-prototype.html) — the "?" slide-over drawer on a real work page; an always-visible field-hint; the fixed (touch/keyboard) tooltip; heads-up warnings |
| **3 — Discovery (rail + nudges + shortcuts)** | ✅ Yes (clickable) | The dashboard "what's next" rail across stages, a dismissible "Did you know?" nudge, the "I want to…" shortcut list |
| **4 — Persona panel + a11y/polish** | ◑ Partial | Clickable mock of the "what everyone else sees" persona panel; the a11y/token cleanup needs no mockup |
| **5 — Guided tours (optional)** | ✅ Yes (clickable) | A coachmark step over a real screen (the §14 experience) |

---

## 16. Phase 1 — UX Plan (for owner sign-off)

**Goal:** make the help center itself usable — fix the slideshow, the cluttered guide page, and the four-front-door hub — so people can scan, search, and find. This is Layer 1 (Reference) and the content foundation the later in-context and discovery layers read from.

**Mockup:** the clickable prototype already reviewed — `docs/projects/active/help-layout-prototype.html` (single-scroll guide, sub-groups, adaptive map). Hub sketch in §5(ii). This satisfies the §15 mockup-first gate for Phase 1.

### What the user sees change

1. **Opening a guide (every guide):** the one-topic-at-a-time slideshow is gone. The whole guide is one page, organized into clear groups (and sub-sections where a group is large), with a **sticky contents map that auto-focuses on the section you're in**. A search box filters the guide. Each topic's questions sit directly under that topic. The cluttered stack of badges/counters above the content ("Topic N of 18", duplicate labels) is removed — just a clean title, a quiet "For: …" line, and the content.
2. **The Tournaments content (worked example, done first):** the confusing double-listing — the same task showing up once as a "recipe" and again as a "subject" topic — collapses into **one logical, workflow-ordered set** of groups → topics, with step-by-steps folded into the topic they belong to. The orphaned "Guide" catch-all bucket disappears. Result: ~25 well-grouped topics instead of 18 jumbled ones that read as a flat wall.
3. **The help hub:** the four competing front doors (featured cards, role paths, "How do I…" links, and the guide grid) reduce to **a prominent search + one clean grid of guide cards**, one per area. Getting-started-by-role collapses into a "New to FieldLogicHQ?" disclosure for first-timers.

### Who sees what (access)
No change to *who* can see which guide — help stays gated to what each org/role actually has (e.g. only orgs with Accounting see the Accounting guide). This phase changes *structure and presentation*, not gating. Focus surface is the tournament organizer (owner/admin), but the new reading experience and hub apply to every guide at once.

### What is explicitly NOT in Phase 1
The in-context "?" help drawer (Phase 2), the discovery rail / "Did you know?" nudges / persona panel (Phases 3–4), and guided tours (Phase 5). Phase 1 is purely the help-center reading + browsing experience.

### Benefits
Directly fixes the owner's original complaint (scannable, searchable, navigable); kills the redundancy that doubled the apparent length; and lays the clean content structure the in-context drawer and discovery shortcuts depend on.

### How the owner tests / signs off (browser, on dev)
Open the Tournaments guide → confirm it's one scannable page, the map follows you, sub-groups read clearly, search filters, and a shared link lands on the right section. Open the hub → confirm search + a single clean grid, role paths tucked into the disclosure. Spot-check one or two other guides still render well. Check mobile stacks sensibly.

### Rough size & risk
Roughly **a week to a week-and-a-half** of focused work (new reading layout + adaptive map applied to all guides, Tournaments content reorganization, hub simplification; other guides adopt the same pattern as a quick fast-follow). **Low risk / reversible** — this is presentation and content structure, no customer data or billing involved.

### Defaults assumed (say otherwise to change)
Role paths → "New here?" disclosure on the hub; Tournaments guide reorganized first, other guides follow the same shape; the retired "How do I…" hub block returns later as the lifecycle-placed "I want to…" shortcuts in Phase 3.

### Content accuracy within Phase 1
Reorganizing the Tournaments content is **also a fact-check**: as recipes fold into topics, every statement is verified against the *current* product (real screens/flows/terminology/plan-gating), not copied forward. So the Tournaments guide ships both restructured **and** up-to-date. Accuracy for the *other* guides is handled by the dedicated audit in §17.

---

## 17. Content Accuracy Audit (added 2026-06-17, owner request)

**The gap:** Phases 1–5 fix *presentation and discovery*; none of them systematically verifies that each guide still matches what the product does today. With the recent pace of shipping (free tiers / League Starter, playoff bracket builder, scorekeeper + check-in, coaches portal, accounting, schedule publish changes, multi-org, invites), guides will have drifted — wrong steps, renamed terms, undocumented features, stale plan-gating.

**The fix — a content-accuracy track, in two parts:**

1. **Tournaments — folded into Phase 1.** Verified as part of the restructure (above), since we're rewriting that content anyway. No separate pass.

2. **Phase 1.5 — Content Accuracy Audit (all other guides).** A systematic, per-module sweep: **House League, Registrations, Rep Teams, Coaches, Accounting, Org Admin, Exports** (and the platform-admin mirror, which inherits automatically). For each guide, check against the live product:
   - Do the documented steps/screens still match the real flow? (Trace the actual current behavior — never document from memory or the old guide.)
   - Terminology current? (e.g. brand/feature renames, plan names like Tournament Plus / League / Club)
   - Plan-gating correct? (does the guide describe who actually sees the feature on each tier)
   - New shipped features missing from the guide? Removed/changed flows still described as-is?
   - Search terms (so a user's words actually find the section)
   Output: a per-module drift list, then the content fixes.

**Where it slots:** **before Phase 2.** The in-context "?" drawer (Phase 2) surfaces guide content *right on the work pages* — so that content must be accurate before we make it that prominent. Phase 1.5 can also overlap Phase 1 (it's content work, independent of the layout component).

**Execution:** run as a structured per-module audit using the docs-sync discipline (compare each guide's claims to the real current functionality, flag drift, fix). Can be parallelized by module. No mockup needed (it's content correctness, not layout).

**Sizing & honesty:** this is real effort — it means tracing the current behavior of every documented flow, not a skim. If we need to scope it, prioritize by drift risk: the modules with the most recent change first (Tournaments [in P1], League Starter/free tiers, Coaches, scorekeeper/check-in, Accounting), with lower-churn guides as a fast-follow. Recurring upkeep after this one-time audit is already covered by the existing code-time "offer /docs when a user-facing flow changes" rule — this phase clears the accumulated backlog; the rule keeps it clear.

**Updated phase order:** 1 (help center usable, incl. Tournaments fact-check) → **1.5 (content accuracy, all other guides)** → 2 (in-context help) → 3 (discovery A) → 4 (discovery B + a11y) → 5 (guided tours, optional).
