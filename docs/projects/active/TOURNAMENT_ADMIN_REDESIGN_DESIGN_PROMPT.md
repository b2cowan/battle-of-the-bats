# Prompt — Tournament admin redesign · the deep dive (walk, stage ladder, Stage 1 drawn)

> Paste everything below the line into a fresh Claude Code session on `dev`. Written 2026-09-28, the day the
> Admin Design Continuity foundation released (`74f45113`, master job 273). This is that program's **Phase 3**
> (`ADMIN_DESIGN_CONTINUITY_PLAN.md` §3 "Phase 3 — Tournament screens"), opening as its own project.
> **Design only: no product code until the owner rules.** The owner will run this beside the Club Tier stages
> and beside the foundation's cleanup (Part B); read "Working beside the other streams" before touching the
> dev server, a shared file or a test sign-in.

---

You are opening a NEW project: **"Tournament admin redesign"** — the analysis and DESIGN phase for every screen a
tournament organizer (and the staff an organizer delegates to) works in, at BOTH widths. The foundation that
just shipped **restyled** these screens: same layout, same words, the coaches portal's look, Warm and Dark. This
project **redesigns** them: what each screen shows first, how a job gets done, what can go. Your deliverable is
ONE publish of a new project hub carrying a measured walk, a stage ladder and Stage 1 drawn at true size, plus
the plan and the PM brief. You build nothing in this session.

## The shape of this session (owner's pattern for a deep dive — binding)

1. **A measured walk** on the hub's first tab, stations in the order an organizer meets them. Each station:
   *as built* (captures in both themes + browser-measured numbers), *my read* (what works, what gets in the
   way, what I'd change, with clickable finding flags), and **shape questions** (Keep · Reshape · Not yet) with
   a recommendation, what rides on it, and a notes box.
2. **Standing back:** the rules that cut across the stations.
3. **A stage ladder** (table: stage · covers · asks · state).
4. **Stage 1 drawn** at true size on its own tab in the SAME first publish: before = captures of today's kit
   screens, after = drawn, NEW / RESTYLED / UNCHANGED tags, fix chips, one checkbox per option for each ask.
5. **A paste-back summary.** The owner reads it against the product; the next stage is drawn only once the one
   before is ruled.

A QA walk of earlier work is **never a gate** in front of this. Push back and widen inside the walk, not by
stopping early.

## Evidence first — this product has no real tournament yet

`PROGRAM_TOURNAMENTS.md` (§1.1, Stage 4) records **zero customers** and says the first real tournament should
choose what comes after it, because everything before it is a guess. The owner has chosen to redesign now,
before a first director learns these screens. That is a defensible call, and it raises the bar for evidence:
- **Argue from what exists:** the June persona walks — `docs/projects/archive/journeys/JOURNEY_J1_TOURNAMENT_ORGANIZER.md`
  ("Dana", who runs one weekend event from her phone) and `JOURNEY_J8_SCOREKEEPER_GATE.md` — **re-verified
  against today's code** (many rows were fixed since; a row is open only if the code still does it); your
  measured walk; the public demo (`riverdale-minor-ball`, three events at three moments of a season).
- **Label every guess as a guess** on the walk ("no evidence yet — a first director would tell us"). A shape
  question that rests only on a guess recommends "Not yet" unless the cost of waiting is real.
- `PROGRAM_TOURNAMENTS.md` is the tournaments ledger; per its own rule, trust only what you verify in code.

## Read first (in this order)

1. `docs/projects/archive/ADMIN_DESIGN_CONTINUITY_PLAN.md` — §1 (rulings R0–R5), §3 Phase 3, and §3a
   "RELEASE — Part A" (what shipped). The foundation's hub https://claude.ai/artifact/R1Zcp2s93gmgaHGHn6SLSZ,
   Mockups tab specimens 2 (Teams restyled), 4 (the tournament frame on a phone) and 7 (scorekeeper): match
   its visual identity; you are starting a new hub, not adding to that one.
2. The foundation's **"found, not fixed" findings on tournament screens** — your seed list, re-verify each:
   - the dashboard shows the event twice: the event header, then the dashboard's own heading with a second
     status tag (slice 4b: "a question for the tournament redesign"; walked as is on §245 W3);
   - Teams' Pools view spills ~200px past a phone's edge, taking a button with it (slice 0, pinned in 4b);
   - Teams' status colours disagree across views (accepted: green in the list, grey on the slot board, lime on
     the phone marker; waitlisted has no colour of its own) (4b);
   - Event settings' "Fee model" control spills at 361px (slice 6);
   - the new-tournament wizard's upgrade notice uses styling that doesn't exist (4a);
   - the bracket view never shows a winner or a score on the fixture (4c);
   - on the volunteer screens, the "Install this app" banner covers the status filters on a phone; the desktop
     Sign out and Check-in links are small targets (slice 5).
3. `PROGRAM_TOURNAMENTS.md` §1–§3 (the funnel as verified; **Stages 5 Storm Mode and 6 The Big Board are their
   own projects** — see Rulings; §3 "Decided NOT to build").
4. The two journey reports above, and `TOURNAMENT_EXHIBITION_FORMAT_PLAN.md` (an Exhibition event has no
   standings or bracket; "a format is read through TWO questions; an inapplicable menu item is ABSENT").
5. The surfaces: `app/[orgSlug]/admin/tournaments/**` — `dashboard`, `registrations` (the Teams screen and its
   views), `schedule` and its components, `results`, `check-in`, `staff-kit`, `communication`, `chat`,
   `settings/**` (Settings & access, `event`, `members`, `notifications`, `pdf`, `registration-fields`,
   `subscription`), `divisions`, `venues`, `rules`, `branding` (Public site), `archives`, `summary`,
   `data-tools`, `manage` (the tournaments list), `preview`; the new-tournament wizard
   (`components/admin/TournamentSetupWizard.tsx` + `TournamentCreationPreview.tsx` + `TournamentStyleCards.tsx`);
   the shared tournament parts (`components/admin/tournament/` — `TournamentAdminUI`, `GuidanceRail`,
   `PersonaPanel`); the volunteer shells `app/[orgSlug]/scorekeeper/**` and `app/[orgSlug]/check-in/**`; and the
   help articles in `lib/help-content/tournaments.tsx`. Plan gating for what each plan shows: `lib/plan-config.ts` and
   `docs/agents/strategy/PLAN_PRICING_FACTS.md` (never restate a price; read it).
6. The sweep and fixture: `scripts/layout-screens.mjs` entries `admin-t-*` and `guest-*`;
   `scripts/uat-fixture-context.mjs` (`uat-plus-org` and its "UAT Phase 2C Plus Championship 2026", the only dev
   tournament with games; the Championship's busiest game day pins the scorekeeper clock).

## Rulings to build ON, not reopen

- **The foundation (R0–R5, F1–F4) as released:** the admin follows the one Warm / Dark setting; the
  organization's colour stays off working screens and on public pages and their previews (R2); scorekeeper and
  gate are fixed Warm (R3); help follows the theme (R4); no subtitle line under a page title (F3); type and
  card style follow the kit (F1, F2). The build-time calls kept on walk §245: Finalize lime, Revert and Forfeit
  red, Cancel amber; the stacked game row; every chosen filter olive; "Pending Review" as the product spells
  it; the score sheet keeps Cancel and never closes on an outside tap (owner, 2026-08-08). A redesign may
  amend one with a reason on the walk; it may not quietly undo it.
- **Storm Mode and the Big Board** (`PROGRAM_TOURNAMENTS.md` Stages 5–6) are their own projects with their own
  plans. This project does not design them. Where a screen you draw is their natural home (the dashboard, the
  schedule's rain-delay window), leave a visible place for them and say so.
- **The Club Tier stages own these, not you:** Stage 6 — the one venue book, the cross-module clash check on
  tournament games, the club calendar; Stage 7 — tournaments inside a club (the hub banner, "Add my team" for a
  club, tournament fees reaching the club ledger). Where your screen shows one of those (Venues & facilities,
  Teams' add-a-team, a fee), draw it as today's behaviour tagged "owned by Club Stage 6/7" and record the seam
  on the Decisions tab. **The admin frame and navigation** (rail, phone bar, More) are the foundation's and the
  Club program's (`PROGRAM_TOURNAMENTS.md` §3: admin IA folds into League/Club); a change you want there is a
  finding for them, not a drawing here.
- **Public pages are out of scope** (the families' tournament site). The organizer's PREVIEW of them is in
  scope only as a door; its contents stay the public page's.
- **Standing rules:** a form covers the nav, a menu sits on top of it; edit autosaves, create asks; form
  selects are dropdowns; icon-only actions on a phone admin; back goes up one level inside a sheet; the
  transient "Saved"; every delete asks first; "8:00 a.m."; one spelling everywhere a customer reads it; a row
  list is a table when a COLUMN answers the question; every highlight on a drawing is clickable.
- **The demo's tour anchors must survive.** The public demo's guided tour points at `data-sandbox-tour`
  targets on these screens (`now-playing` and `schedule-health` on the dashboard, `registration-health`,
  `schedule-health` on the schedule, `post-event-summary`); the build fails when one disappears. A redesign that
  moves one says where it goes; `/demos` curates the story.

## What to produce

1. **Measure before drawing.** A Playwright probe in `.probe/` (never `test-results/`), signed in with the
   `org-owner` UAT session for `uat-plus-org`, and through the demo door for the demo, at **390×844 and
   360×780** and **1440×900 and 768×1024**, in **Warm and Dark**. Read every number from the browser's geometry,
   never from a screenshot. Per station record: where the first thing the organizer came for sits (px from the
   top) and how many headers and panels come before it; taps to the station's main job (create the tournament;
   add a division; accept a team; publish the schedule; enter and finalize a score; check a team in; message
   every team; seal the records); every control under 44px; every sideways spill; what a Tournament plan sees
   against Tournament Plus. ⚠ The fixture is small (a handful of teams); say where a real weekend (30 teams, 60
   games, three diamonds) changes the answer, and seed nothing without asking.
2. **The stations, in the order an organizer meets them:** create (the wizard and its live preview) → set up
   (Settings & access, Event settings, Divisions, Venues & facilities, Rules & resources, Public site, Registration
   questions, notifications, Plan & billing as a tournament org reaches it) → registration and teams (Teams with
   its views, the registration health panel, Communications) → the schedule (generator, playoff builder,
   brackets, timeline, health, rain delay, publish) → game day (dashboard, Results, Check-in, Staff kit, Chat) →
   the volunteers (scorekeeper, score sheet, gate — phone) → after the event (Post-event summary, Archives, Data
   tools, reuse setup). Include the Exhibition format wherever it changes a station.
3. **Open the project hub.** Copy `docs/agents/design/PROJECT_HUB_TEMPLATE.html` to
   `docs/projects/active/TOURNAMENT_ADMIN_REDESIGN_HUB.html`, read its comment block, load the `artifact-design`
   skill and publish it with the Artifact tool — ONE URL for the project's life; republish the SAME path. Tabs:
   **Walk** (first) · **Stage 1** (the drawings) · PM Brief · Full Plan · Decisions · QA Walk (hidden until one
   exists). Stage strip with anchored positives only. Every "after" frame drawn Warm with a dark copy cloned at
   load (the foundation hub's method). **Parse the hub's scripts before every publish** (one unescaped
   apostrophe kills every tab).
4. **The stage ladder.** Propose the stages from what the walk finds, not from the plan's four job groups
   (setup · operations · records · scorekeeper and gate) — those are a starting point; the schedule alone was
   the foundation's largest slice. **Recommend a Stage 1** and argue it: the default candidate is **game day**
   (dashboard, Results, Check-in), the screens an organizer lives in on the weekend and the one place J1 and
   the foundation both found friction; overturn it if the walk says otherwise.
5. **Draw Stage 1 at true size, BOTH widths**, whole screen before/after per screen that changes, every flag
   and fix chip clickable with a per-instance `data-here` sentence, NEW / RESTYLED / UNCHANGED per element with
   its own note, and the 44px reference block beside every phone frame.
6. **The asks**, each with options, a recommendation, the tradeoff, and a checkbox per option on the paste-back.
   At minimum:
   - **A1 · Which stage first**, with the evidence.
   - **A2 · The dashboard's two headers** — one event identity at the top of every tournament screen, or keep
     the dashboard's own.
   - **A3 · Phone or desk for the organizer.** J1's organizer runs her weekend from a phone; the foundation drew
     both. Say which width each station is FOR (a setup screen may be desk-first, game day phone-first) and
     what that changes.
   - **A4 · Storm Mode and the Big Board** — confirm they stay their own projects and that Stage 1 leaves them
     a place (recommend yes).
   - **A5 · The Club seams** — confirm Stage 6 and Stage 7 own the venue book, the clash check, club
     tournaments and fees to the ledger (recommend yes), and name each screen where the seam shows.
   - **A6 · Plan gating on redesigned screens** — no gate value changes; where a Tournament-plan organizer
     meets a Plus feature, and how the upsell reads (placement only; words tagged for `/marketing`).
   - Anything the walk finds that this list misses: say so, don't force-fit.
7. **Write the plan and the PM brief** — `docs/projects/active/TOURNAMENT_ADMIN_REDESIGN_PLAN.md` (findings
   with measurements and anchors, the rulings above as "not reopened", the asks, the stage ladder, the build
   order against Part B below, verification at build, migrations: none expected — say so if one appears) and
   `TOURNAMENT_ADMIN_REDESIGN_PM_BRIEF.md` (plain language: what an organizer sees and does differently, why,
   priority, success criteria). Render both on the hub's tabs. Add ONE summary line to `TODO.md` linking the
   plan, a pointer line in `PROGRAM_TOURNAMENTS.md` (after checking the code, per its rule), and a memory note
   `project_tournament_admin_redesign`. No ledger § until something is built.

## Working beside the other streams (the owner runs three at once)

- **The foundation's cleanup (Part B)** deletes the old look from the tournament screens' code, area by area,
  proven pixel for pixel. **Every build stage of THIS project waits for Part B's pass on its area** — building a
  redesign on top of two stacked looks makes both jobs harder. Your drawings don't wait; say the order in the
  plan (and recommend Part B take the tournament areas early).
- **Club Tier stages** run in other sessions (Stage 2 is drawing Rep Teams now). The seams are A5's.
- **One browser tester at a time.** Probes and sweeps sign in with the shared UAT accounts, and a second runner
  (or a fresh `auth-setup`) rotates the other's tokens and revokes its sessions mid-run. **Before any probe or
  `auth-setup`, ask the owner whether another session is measuring**, and don't launch a full layout sweep —
  scope it with `--only=` (equals sign). An abort on the memory floor is a failure, not a pass.
- **Shared working copy:** stage only your own files, on `dev`, in a private index; other sessions have
  uncommitted work here (read `git diff HEAD` before assuming a file is clean). Commit only when the owner says.
- **Never touch production** or a production account in an artifact; walk cards name the dev UAT accounts and
  read passwords from `.env.local`.

## Hand-off

Product-owner voice. Lead with what an organizer sees and does differently in Stage 1 and why; the walk's three
or four biggest findings with their evidence (and which are guesses); the stage ladder in one table; the asks as
numbered questions with a recommendation each. **Tell the owner to open the hub on a phone** for the game-day
frames. Offer `/design` for a review pass if the session has budget. Do not write a build prompt until Stage 1
is ruled; when it is written, it settles the order against Part B's tournament passes.

## Do not

- Build anything, or change routes, gates, seeds, help or copy files.
- Design Storm Mode, the Big Board, the public tournament site, the admin frame/navigation, the venue book, the
  clash check, club tournaments or fees-to-ledger.
- Change a price, a plan name or a gate; write customer copy (draw the placement, tagged for `/marketing`).
- Remove a demo tour anchor without naming its new home.
- Mint a second artifact for this project. The hub is the only one.
