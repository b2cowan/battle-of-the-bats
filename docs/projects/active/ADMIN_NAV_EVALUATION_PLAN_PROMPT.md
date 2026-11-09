# Navigation evaluation across the three portals — planning and review prompt

Paste this into a fresh session. It is a PLAN-AND-DRAW session: it ends at an audit, a plan, a PM brief and a
mockup artifact for the owner to rule on. It builds nothing.

---

## The ask (owner, 2026-11-09)

Do an overall review of the navigation of the **club admin, the tournament admin and the coaches portal**, using the
**new club admin as the standard** (the pinned bar that names where you are, the desktop strip, the sidebar club cell,
tabs pinned inside the bar — Admin header bar Phases 1–4, walks §486 / §492 / §495 / §499 / §501 all passed).

**The goal is consistency.** An owner who also runs a tournament and coaches a team should feel one product as they
move between portals. Review everything that makes navigation feel the same or different: fonts and type sizes, nav
and row sizing, tap and click targets, icons (which ones, how big, when used), dropdowns and pickers, tab rows,
the sidebar, the strip, the phone bar, the More sheet, the account menu, the back arrows, how a screen names itself.

For **each difference found, decide whether it is justified**. Justified = a real difference in what the user is doing
(e.g. a coach season has a closed-season page, a tournament has dates). Not justified = history, or three screens built
at three times. Recommend the unjustified ones converge on the club standard. Do not carry anything over just because
the club has it: "carry over only what fits."

### The owner's specific idea (test it, do not assume it)

Tournament screens today name the tournament in the header, and the page names (Teams, Schedule…) sit in the page.
The owner proposes swapping that gracefully:

- Put the **tournament name in the sidebar, where the org name sits today**. Inside a tournament the user already knows
  the org, so the tournament is the useful fact.
- Make the way to switch tournaments a **quiet chevron** that opens the list of tournaments, not a dropdown that looks
  like a form control.
- Then **move the tournament's page names into the header** (the bar), as the club admin does.

### The logo ask (owner, walk §495 C1, folded in 2026-11-09)

The collapsed sidebar club tile shows the club's **initials** today. The owner asked whether it should show the org's
**own logo** when one is uploaded. Nothing is decided. This session **draws and asks; it does not build or scope an
upload feature**:

- Find out which logo an org or tournament already has (the public site's?) and whether the admin would need its own
  upload. State it as a fact from the code, not a guess.
- Draw the cell with and without a logo, in all three portals: the club cell, the tournament cell (once the owner's idea
  puts the tournament name there, does a tournament carry a logo too?) and the coaches portal's team cell, open and
  collapsed, on desktop and phone. Include the fallback (initials) and a badly shaped or very light logo.
- Make it one ask (with a recommendation) for the owner. If the answer is yes and needs a new upload or storage, say
  what it needs and plan it as its own later build phase.

## Read first (in this order)

1. `CLAUDE.md`, `AGENCY_RULES.md` — **Disagree out loud, by default.** If the owner's idea is wrong anywhere, say so
   before drawing. Do not manufacture disagreement; if it is right, say so and name where the risk is.
2. `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md` — every Architectural Decision, Round 3 asks A2–A10, Round 4,
   Round 5, "After this project". The decisions there are **reference, not authority**: cite a ruling's REASON and
   decide on merit (memory: past decisions are reference not authority).
3. Memory: `project_admin_header_bar`, `project_coach_phone_stage4`, `project_coach_account_menu`,
   `project_coach_row_list_recipe`, `project_one_window`, `project_warm_coaches_portal_followup`,
   `reference_memory_index_settled.md#ui-conventions-owner-rulings…` (READ before drawing any control, window,
   toolbar or list), `feedback_portal_is_the_formatting_benchmark`, `feedback_draw_controls_from_shipped_component`,
   `feedback_mockups_as_claude_artifacts`, `feedback_always_run_design_on_mockups`.
4. `memory/design_decisions.md` (the in-repo one is LIVE) and `docs/agents/design/` for the written rules.

## Facts the session must verify in the code (do not take any from this prompt)

- **What the tournament admin shows today**: where the event is named (bar, strip, sidebar picker), what the picker
  looks like and does, what the page names do, how a tournament-only org differs from a club that runs tournaments.
  The 2026-11-07 ruling (A10) says event pages name the event and only org-wide screens name the org, and "the
  sidebar picker keeps the event on screen". **Find out what is really shipped**; the owner's proposal may be a
  restyle plus a reversal of one ruling, not a new feature. State which, and argue the reversal from the ruling's
  reason, not from the ruling's existence.
- **The coaches portal's real navigation**: desktop sidebar, phone bar, the More sheet, the account menu, the team
  switcher, how a screen names itself, the closed-season door. Hard constraints that STAY unless the owner says
  otherwise: a closed season is ONE page and the team with no live season has ONE door (CLAUDE.md, coaches-portal
  section); the coaches portal is "untouched" only in the Admin header bar project, and this evaluation is allowed to
  reverse that.
- **The sidebar club cell's job today** (open Overview, lined up with the tab band, collapses to a tile). If it shows
  the tournament name inside a tournament, **what is the way back to the club** for a club that runs tournaments?
  Answer this explicitly. It is the main risk in the owner's idea.
- **The multi-role user**: an owner who is also a tournament organizer and a coach. How do they move between the three
  today (Workspaces pill, strip, account menu)? Walk that journey end to end on desktop and on a phone, as
  the evidence for "feels consistent". The same person in one session is the test case for every recommendation.

## Method

- **Broad reading goes to helpers** (CLAUDE.md): use `Explore` to inventory each portal's navigation components,
  type sizes, icon usage and spacing tokens, in parallel, and ask for the answer (paths with line numbers plus a short
  verdict), not the dump. **A helper's summary is a lead, not evidence**: open the cited lines before building on a
  claim.
- **Measure, do not eyeball.** Use the existing probes / layout tooling against the dev server for real sizes (bar
  heights, font sizes, tap targets, icon sizes) on the same screens at 1440 and 390. Probes live in `.probe/`.
  Refresh the saved UAT sign-ins first if a probe reads "0 nodes" (they expire). Screenshot before trusting an empty
  result. Do NOT run a whole-product layout sweep on the dev server.
- **Build the comparison as a table**: one row per navigation element (strip, sidebar, club cell / tournament cell /
  team cell, tab row, phone bar, More sheet, account menu, picker, back arrow, page title, icons, fonts), one column
  per portal, then a verdict column: **same / different and justified / different and not justified** with the reason
  in plain words.
- The `/design` agent reviews the drawings **before** hand-off to the owner (memory: always run /design on every
  mockup). Route anything about copy to `/marketing` and plan gating to `/billing`; do not invent either.
- Do not touch `.claude/settings*.json`, hooks or database checks (AGENCY_RULES: shared automation).

## Deliverables (one publish for the owner, in this order)

1. **The audit**, in product-owner language: what each portal does today, the comparison table, the justified and
   unjustified differences, and the multi-role journey as it feels today.
2. **A verdict on the owner's tournament idea**: right / right with changes / wrong, with the risks (the way back to
   the club, the 2026-11-07 ruling's reasons, a tournament-only org that has no club above it, phone vs desktop).
3. **The proposed standard**: the one navigation model all three portals share, and the short list of things each
   portal keeps different on purpose.
4. **Mockups as a Claude Artifact** (HTML page, never the canvas; house layout: sticky tabs, "Everything / Show only
   what differs"; whole-screen before/after; TRUE SIZE; controls drawn from their SHIPPED components, not redrawn;
   money figures, if any appear, as one joined band; every highlight clickable). Cover, on desktop and phone: the
   tournament admin (the cell with the quiet chevron and the open tournament list, the bar naming the page, a
   tournament-only org and a club that runs tournaments), the coaches portal (the same standard applied), and the
   multi-role owner moving between all three, each cell shown with and without a logo (the logo ask above).
5. **The asks**: every decision the owner must make, each with a recommendation, each answerable as a letter
   (the A1–A10 pattern).
6. `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md` + `ADMIN_NAV_EVALUATION_PM_BRIEF.md` (plain language: proposed
   functionality, why it matters, customer impact, priority, success criteria), a one-line pointer in `TODO.md`
   (replacing the queued line in the Admin header entry, not adding a duplicate), and the memory pointer. The plan
   lists the phases a build would take, sequenced by dependency and rework risk, **never by calendar timing**.

## Before any drawing

Per AGENCY_RULES, present the **Product Manager UX plan** (what the user sees and does differently, benefits,
role differences) and an implementation plan / task list in the conversation. No code changes in this session.

## Do not

- Do not build anything. The session ends at drawings and asks.
- Do not add a thirtieth finished-season branch or give the coaches portal a season dial (CLAUDE.md).
- Do not restate a plan name or price anywhere (Plan & pricing section of CLAUDE.md).
- Do not treat an old walk or an old ruling as a gate; cite its reason.
- Do not assume the club standard is perfect. If the audit finds the club admin itself is inconsistent somewhere,
  say so and put it in the asks.
- Do not commit or push without the owner's yes; stage explicit pathspecs only; branch is `dev`.
