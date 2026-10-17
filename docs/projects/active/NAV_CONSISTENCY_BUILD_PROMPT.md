# Nav Consistency: build the nav standard into every sidebar and phone More sheet (stages A–D, built to the ruled hub)

> Paste into a fresh session on `dev`. Written 2026-10-17. The review was **ruled 2026-10-17**: all fourteen asks as
> recommended (owner, on hub v2: *"looks good, i agree with your recommendations"*). This session builds **all four
> stages, in order A → B → C → D**, one commit per stage (each when the owner says), and one QA section with a walk per
> purpose. If the session runs long, stop at a stage boundary, write that stage's as-built note, and hand off; the next
> session resumes from the plan.
>
> **The spec, in this order of authority:**
> 1. **The standard:** `docs/agents/design/NAV_STANDARD.md` (rules N1–N9, the icon dictionary, the exceptions). It
>    holds exactly what was ruled.
> 2. **The drawings:** https://claude.ai/artifact/RtcrWCxpfuNMkTRQMK8pA3, tab "Drawn proposal" (source
>    `docs/projects/active/NAV_CONSISTENCY_REVIEW_HUB.html`). Every numbered marker is a change, with its rule and its
>    stage. Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). The phone "before" sheets
>    were drawn from the code, not captured: where today's product differs from a "before", trust the code and build
>    the "after".
> 3. **The plan:** `docs/projects/active/NAV_CONSISTENCY_PLAN.md`. §3 is the call list, stage by stage, with where each
>    change lives. §4 lists the risks, §5 the gates. Where you must depart from it, say so at build time and record why
>    in §10, "As built"; never silently.
>
> **Read first:**
> - the standard, the plan and the PM brief, whole;
> - `AGENTS.md` (this Next.js is not the one you know);
> - the binding closed-season rule in `CLAUDE.md` (a team with no live season has ONE door, in every nav, the phone
>   More sheet included);
> - memory: `project_nav_consistency_review`, `feedback_build_to_approved_mockups`,
>   `feedback_portal_is_the_formatting_benchmark`, `decision_drawer_layers_form_vs_menu`,
>   `project_admin_phone_bar_and_push_banner` (the phase bar this builds on), `project_free_coach_header_parity`,
>   `project_sidebar_strip_grid_width` (the strip touches the same rails), `feedback_qa_walkthroughs_as_checkable_artifacts`,
>   `reference_artifact_publish_needs_full_read`, `reference_hub_script_parse_trap`,
>   `reference_partial_commit_shared_tree`, `feedback_ruling_record_drift`.

## ⚠ What the code says (read 2026-10-17; re-read before you build)

- **One stylesheet draws every phone sheet.** `CoachesBottomNav.module.css` is imported by the admin bar, the free bar
  and the Premium bar. The heading change (A1) lands on all four sheets at once; that is intended. Check each.
- **The admin shell doesn't mount the overlay provider** (`lib/coaches-overlay.tsx` is mounted only in the coaches
  layouts), and its windows don't enroll. So "the admin bar hides behind an open form" (plan §3 A.5) may mean enrolling
  every admin window. Measure that first. If it does, report it to the owner as its own unit of work and leave it.
- **Tournament Accounting is drawn outside the groups.** `AdminKitRail`'s `TournamentRail` renders it as a lone row
  after the last group, with `active={false}`, and the phone sheet doesn't list it. B4 moves it into the tournament
  groups' config so the rail and the sheet read one list.
- **The full rail's program chevron is `hasPages={p.pages.length > 0}`,** so Public site (one page, the site editor)
  draws one. The strip already knows the better test: a program opens a menu when it has more than one page, or is a
  rep team's or a season's block. A2's chevron rule matches that, plus House league always (its season's pages open
  under it).
- **The account menu is hidden in the demo sandbox** (`AdminTopStrip`: `!inSandbox`). Removing the rail's Sign out
  (B1) is safe there: a shared demo user must never be signed out. Hide the new Send feedback rows in the sandbox the
  same way the account menu does.
- **"Download app"** in the admin sheet dispatches `flhq:show-install` when the app isn't standalone. `InstallAppPrompt`
  listens, mounted in the root layout (and again in the admin layout). Confirm it fires on coach pages before reusing
  it there.
- **The coach sheet's guards:** `coach-nav-groups.test.ts` pins `MORE_SECTIONS` to the sidebar's groups and the hot row
  to exactly three keys ("a fourth is a design decision"). The new You group is account chrome, not a nav group: keep
  it out of `MORE_SECTIONS`.
- **The free rail's rows are inset:** its `.rail` has side padding and its rows have 8px corners. The paid rows are
  full-bleed (D1). Move the side padding onto the team header block, which stays (P5).
- **"Admin Area" already exists** in `lib/workspace-labels.ts` (the Workspaces list's name for the admin). Read it from
  there.
- **The admin foot's Send feedback icon is 15px** (`FeedbackLauncher` defaults to 15). That stops mattering when B1
  removes the row; don't fix it separately.
- **F39 looks fixed already:** where a plan has no Chat, the tournament bar's slot opens Communications, labelled
  "Messages" (`tournamentBarKeys`, 2026-10-16). Confirm and record. The label itself is open (one page, two names);
  don't change it.

## Preconditions (check before code)

1. **Git:** on `dev`; `git log` and `git status` read fresh. If another session holds uncommitted changes in any file
   this touches, wait or ask; never stage its hunks. The files: `AdminKitRail.tsx`, `AdminKitFrame.module.css`,
   `AdminKitBottomNav.tsx`, `AdminTopStrip.tsx`, `AdminContextStrip.tsx`, `admin-nav-config.ts`, `lib/admin-kit-nav.ts`,
   `CoachesSidebar.tsx`, `coaches.module.css`, `CoachesBottomNav.tsx` + `.module.css`, `CoachPortalShell.tsx` +
   `.module.css`, `CoachFreeBottomNav.tsx`, `lib/coach-team-tools.ts`, `lib/coach-free-nav.ts`. Other sessions' hunks in
   shared records (TODO, the QA ledger, the design log) are theirs.
2. **No other frame change in flight.** This changes every portal's nav; nothing else that changes a sidebar, a phone
   bar, the top strip or a shell runs beside it.
3. **The UX summary for the owner comes first** (AGENCY_RULES), short, from the PM brief: what each kind of user sees,
   that nothing moves out of the sidebar, that signing out moves to the account menu everywhere.
4. **Two owner calls at build start:**
   - Add "Rep Teams" to the spelling gate (`check:spelling`), so the old case can't come back? Recommend yes. The gate
     widens only on an owner ruling.
   - Only if the scope check above says so: the admin bar hiding behind forms becomes its own unit of work.
5. **One browser tester at a time.** Ask before any capture, probe, `check:layout` run or `auth-setup`. Shared shell
   modules change, so a dev-server restart is owed before the walks: ask first.

## What to build, in this order

Plan §3 has the detail and the file for every line. In short:

1. **Stage A: the same words, icons and headings.**
   - Headings 11px in the sidebar's face, in the rails and the sheet, one spacing.
   - Chevrons only where a row can open pages; one 55% strength.
   - The twelve icon changes.
   - "Rep teams" through every customer-visible string, with its help keywords and search text (classify the ~250 hits;
     identifiers stay). If the pricing Facts doc names the module, flag `/strategy` before touching it.
   - "Club overview"; "Admin Area" in the admin top strip.
   - The small fixes: tournament groups that flash closed, two rows that never light up, the Premium tabs'
     `aria-current`, the Premium sheet closing on tap.
   - The carried-in items: confirm F39, the count phrasings, the 44px "teams to review" link, the picker that spills.
   - **Commit A** when the owner says.
2. **Stage B: one foot, one More sheet.**
   - The rail feet: the admin's loses Send feedback and Sign out, and its Public site shows only when the rail has no
     Public site row; the coach foot goes to 12px.
   - The admin sheets in N7's order: Help; "Programs"; the Organization row; icons on every tournament row; Accounting
     in Admin (moved into the config, so the rail's lone row goes); "Club overview"; You = Account, Home, Coaches
     Portal; the foot.
   - The Premium sheet: You (Account, Home, Admin); Help, Send feedback, Download app, Sign out.
   - The free sheet: Send feedback and Download app.
   - Measure the sheets' height at 844 and 780.
   - Then `/docs` (help that says the admin signs out from the sidebar, "Back to club", what More holds).
   - **Commit B.**
3. **Stage C: the admin tiles.** Club: Calendar · Schedules · Families, only when all three exist; they leave their
   rows. Tournament: game day only, Check-in · Staff kit · Teams, still listed in Operations, none on a plan without
   Check-in or Staff kit. Stop and ask if a plan puts Families on the club bar. **Commit C.**
4. **Stage D: the free coach's rows.** The paid row style; the width and team header stay; the folded strip unchanged.
   **Commit D.**

## Gates

- After each stage: `npm run verify:changed`, `npm run typecheck`, and the nav guards: `admin-kit-nav.test.ts`,
  `coach-nav-groups.test.ts`, `coach-free-bar-guard.test.ts`, `sidebar-strip-guard.test.ts`.
- Before the walks:
  - `check:demos`, `check:css-selectors`, `check:contrast` + `check:text-contrast`, `check:spelling`.
  - **A guard for this project, `tests/unit/nav-standard-guard.test.ts`:** every nav config row's icon matches the
    dictionary; no nav label starts "Back to"; the admin and coach sheets render You and the foot in N7's order; the
    tile sets and their gates; the heading size token in the rails and the sheet.
  - **`check:layout --changed`** on a few club, tournament and coach screens at 1280 / 1440 and 390, Warm and Dark.
    Never run a whole-product sweep on the dev server (AGENTS.md); the release runs it on staging.
- Then:
  - `/simplify`: tiles become a shared pattern across two bars.
  - `/review` at the **high-risk** tier: shared shells, every portal.
  - A `/design` pass on the built result against the hub, at 1440 and 390, Warm and Dark.
  - `/marketing` for the marketing pages' "Rep teams".

## Walks and hand-off

- A new Owner QA ledger section (take the number **at the moment you write it**; grep the ledger before and after
  appending), as checkable walks on the hub's QA tab, one purpose each:
  - the club and tournament sidebars: headings, chevrons, icons, the foot;
  - the Premium and free sidebars;
  - the words: Rep teams in the product and help, Admin Area, Club overview;
  - signing out and sending feedback from the account menu in each portal;
  - the club More sheet;
  - the tournament More sheet before game day and on game day (the UAT "Stage 3 Walk" event reads game day from
    2026-10-17; re-check);
  - the Premium coach More sheet: You, Send feedback, Download app;
  - a closed-season coach team's one door;
  - the small fixes.

  Use the UAT fixtures (the UAT Rep Club owner, a Tournament Plus owner, a Premium coach, a free coach), passwords from
  `.env.local`. Name the account and the place in every walk.
- Republish the hub at the same address with a QA tab. Read the live copy in full first, and parse every script before
  publishing. The hub is generated from `.probe/nav-hub-*` (plan §9); if those files are gone, edit the built HTML in
  place.
- An owner-voice summary: what changed, the departures, anything found and not fixed.
- Records:
  - plan §10 (each stage as built) and the status line;
  - the PM brief's status;
  - `NAV_STANDARD.md`'s "Being built" line;
  - memory `project_nav_consistency_review`;
  - the TODO line;
  - the design log, only if a ruling was made during the build.
- **Commit only when the owner says**, from explicit paths (a private index when shared files hold other sessions'
  hunks); export and typecheck the staged tree first.
