# Club Tier Readiness — Stage 2 mockup session prompt ("Rep teams & the coach bridge")

> Paste into a fresh session on `dev`. Written 2026-09-28. **This session draws and settles rulings. It does
> not build.** Plan: `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`. Read these sections:
> - §3 (the exit definition, points 2–3);
> - **§4B** (the rep-teams ledger B01–B13: what the club hits, with code anchors) and §4G (G03);
> - §5 (D1, D3, **D10**);
> - **§6 Stage 2**;
> - §6 Stage 1, for what is already built;
> - §11 (the J4 rows mapped to Stage 2).
>
> The PM brief sits beside the plan. Project hub (ONE artifact for the project's whole life; republish the SAME
> path): `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_HUB.html` =
> https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9. Memory: `project_club_tier_readiness`.
> The J4 finding text is in `docs/projects/archive/journeys/JOURNEY_J4_CLUB_PRESIDENT.md`.
> **The Admin Design Continuity release may be running in another session at the same time.** Read "Working
> beside the design release" before touching the dev server or the hub file.

## Blocking gate — item ONE is the mockup

1. **Mockups on the hub's Mockups tab, before any code.** Nothing in Stage 2 is built until the owner
   ratifies the drawings. Draw the DECISIONS, not every control (the specimens below), and **always the whole
   screen, before and after**, for the three screens a club lives on here: the Rep Teams home, the team page
   and the season controls.
2. **Every highlight is clickable** (owner ruling). A finding flag (`B03`, `J4-035` …) opens what the code does
   today and what the drawing changes. Every NEW / RESTYLED / UNCHANGED tag carries its own note. A findings
   dialog jumps to the matching heading on the Full Plan tab; add the heading if it is missing.
3. **True size for anything that is about size.** The phone frames are drawn at 390px with the 44px reference
   block beside them, and the hand-off tells the owner to open the hub on his phone.
4. **Both themes.** The admin follows the account's Warm / Dark setting now:
   - every "after" frame is warm, with a fixed dark copy cloned from it at load (the Stage 1 method, hub v6);
   - **the "before" frames are today's screens in the kit restyle** (Admin Design Continuity slice 3, which
     is live by the time Stage 2 is built), **not** the old dark console.
5. **Record every ruling on the hub's Decisions tab as it happens**, not at the end.

## ⚠ The first ruling decides half the drawings, and the plan's recommendation needs arguing first

Plan §6 Stage 2 recommends two things. First, a club team gets the standalone *Start next season* roll,
**invoked by the club admin**. Second, **a Draft year may coexist with an Active one, so next season's tryouts
can run while this season is still going.** The first half fits everything already built:
- the season-close plan (`COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN.md`, 2026-08-18) says *"A club-owned team sees
  neither [door]. Its club manages seasons; the page says so";*
- the coach's doors stay head-coach-and-standalone-only (binding, `CLAUDE.md`).

**The second half collides with the code and with a binding ruling. Verify both before drawing it:**
- **The coach's tryout tools only ever act on the team's live season.** Every coach tryout route resolves the
  active program year (`getActiveRepProgramYear` in `tryout-overview` and its siblings). The coach help says a
  season's tryout "stays readable … for as long as that season is the one your team is on". A tryout in a
  Draft year would be invisible to the coach, who is the person who runs tryouts in the portal.
- **`CLAUDE.md` (binding): "Anything that moves money, runs a tryout, messages families, or configures the
  team stays on the working season."** Making the portal's tryout tools reach a Draft year means adding a year
  parameter to an instrument. The build guard (`tests/unit/coach-history-endpoint-guard.test.ts`) exists to
  stop exactly that.
- **Read the standalone model before choosing.** Find out from the code and from the owner's words which season
  a tryout belongs to, and what a standalone coach does between the last game and next year's tryout.
  `CLAUDE.md` says next year's tryout happens *before* the season is closed. The coach help ("turn the tryout
  you just ran into the start of their season") reads as if it happens *after* the roll. State the answer
  with its anchors; do not guess.

**Put it to the owner as Ask 1**, with both shapes drawn small enough to compare:
- **(a) One model for both kinds of team.** The club admin has the same doors a standalone head coach has
  (Start next season / Close the season / Reopen, with the same warning on unsettled money that never blocks).
  Tryouts run on the working season exactly as they do for a standalone team.
- **(b) The plan's Draft-coexists model.** Say what it costs:
  - a tryout that only the club side can see, or a year parameter in the coach's tryout tools against the
    binding ruling;
  - Draft redefined as a "prep" state that the portal must learn.

**Recommend (a)** unless the code shows the standalone model already runs next season's tryout before the
roll in a way (b) merely mirrors. Whatever is ruled, **do not draw an "undo the rollover"**: plan §3.4 of the
season-close plan deliberately does not build it.

## What Stage 2 changes (the brief for the drawings)

**Who does what, after Stage 2:**
- **The club admin (now on Rep Teams by D8)** sees every team's health on one screen: a head coach in place,
  the roster, the next event, documents.
- The admin edits a team's identity and names the head coach with **"Invite a coach"**. The coach is emailed
  and lands in a populated Premium portal (D10, B01).
- The admin runs each team's season doors (Ask 1), and can bring a coach's existing standalone portal into the
  club with everything intact (B04, Ask 2).
- **The coach** still owns the day-to-day (D3, the franchise ruling: the admin never writes a team's
  schedule).

Rulings that govern the drawings:
- **D10** (landed): "Invite a coach" on the team's Coaches page writes the coach membership and the team staff
  membership, and sends the staff-invite email. ⚠ D10 also said "a Coach row in the Members invite picker".
  Stage 1 built Members with **no** Coach row, and its drafted help says *coaches are added on each team's
  staff page*. That is Ask 4 (recommend: the team page only, one door; Members keeps coaching staff read-only
  as built).
- **D1** (landed): team money is the coach's records, and the club reads them. **Stage 1 drew no money figure
  on the hub until Stage 3** (C04). The health board's money column is a *slot* tagged "arrives with Stage 3",
  never a figure.
- **The franchise boundary (plan §4B, "What the club owns vs reads"):**
  - the club reads roster, schedule and results, payment requests, family counts, and closed-season
    W-L-T / roster / staff;
  - it reads **none** of attendance, lineups, awards, development or opponents;
  - a health-board column outside that list is a boundary decision, **Ask 5**, not a drawing choice.
- **D8 / Stage 1 as built:** an admin opens Rep Teams, and a treasurer sees team names in Accounting only. The
  treasurer's allocation and payment-request **screens** are Stage 3a's (do not draw them).

## The specimens (draw these; nothing else)

1. **Rep Teams home as the franchise health board, whole screen, before/after, desktop + phone (true size).**
   - One row per team: head coach in place, or a red **"No head coach"** flag; roster on the working season, red
     at **0 on a live season** (J4-008); next event; documents (only as far as Ask 5 allows); money as the
     Stage 3 slot; and each team's **season state** in Ask 1's words.
   - Groups and "Ungrouped" (B06's `group=none` 500: verify Stage 0 fixed it and tag it UNCHANGED if so).
   - One roster rule and one W-L-T rule behind every number (B08; tag the definition).

   Findings: B08, J4-006, J4-008, B06.
2. **The team page, whole screen, before/after.**
   - Edit the team's identity: name, division, colour, group, un-archive (B09; the PATCH that ignores the group
     today).
   - A "what the club sees" panel in the franchise's terms.
   - The season list with honest states.
   - The false copy gone ("the next season starts with an empty coach list"; the coach settings' "Division is
     managed by your club admin" gets a real home).

   Findings: B09, J4-002 (an honest error, not "Program year not found").
3. **The season controls, whole screen, before/after, drawn to Ask 1's recommended shape** (the alternative
   stays small on the ask).
   - The question window names what carries over: the standalone roll's five (roster, budget, fee template,
     opening balance, continuity links).
   - The unsettled-money **warning that never blocks** (binding).
   - Reopen only while the team has no live season.
   - **No self-heal:** the roll must never auto-complete another open year for a club (B03). Say so on the
     window's note.

   Findings: B03, G04.
4. **The coach's side of a club season change: portal, phone, both themes.**
   - What a club team's head coach sees when the club rolls or closes the season. **A team with no live season
     has ONE door** (the closed-season page, `CoachTeamSeasonGate`), and the portal says the club manages
     seasons. Do not add a portal door.
   - Nothing the club does may leave a coach on a live screen the server now refuses.

   Findings: B03 (portal half).
5. **The Coaches page: "Invite a coach", whole screen, before/after + phone.**
   - An invite form: name, email, head coach or assistant (a **dropdown**, house rule).
   - The pending state, with resend and cancel; reuse the coach staff list's pass-2 pattern (four kinds,
     access set before the invite), don't invent one.
   - A coach can be added **between seasons** (B01 blocks it today).
   - **Remove asks first** and guards the last head coach ("this team will have no head coach …", J4-035).
   - The Assign panel absent on a closed season (B09).
   - Who adds **assistants**: draw today's split (the head coach invites from the portal's staff list, and the
     club approves on Assistant coaches) and confirm it as **Ask 6**.

   Findings: B01, J4-035, B09, D10.
6. **The invited coach's arrival.** Two frames: the email (placement, with words tagged "copy: /marketing"),
   and the first landing (accept, then the portal on their team, populated). Reuse Stage 1's invitee pages
   (specimen 6) rather than a new pattern. Today **nothing tells a coach they were assigned** (B01).
7. **Tryouts, club side, before/after**, honest about the season.
   - Accept and "tryouts open" refused on a closed season.
   - The public page and the register form agree on which season takes sign-ups.
   - Admin and coach act on the same season.
   - The stale help lines named for the build.

   Draw it to Ask 1's shape. Findings: B07.
8. **Document templates with a team picker.** A dropdown of the club's teams (J4-009's raw UUID box goes), the
   owning team named in the table, the scope copy true ("club or team", not "program year"). Findings: B11,
   J4-009.
9. **Bringing a coach's own portal into the club, drawn to Ask 2's recommended shape.**
   - Today's "Coaches Portal Links" page reframed for what it is (J4-034: it collides with the built-in portal
     and dead-ends).
   - Prices shown before any approval, and no ops jargon ("Phase 5A", "Platform override") (J4-037).
   - What moves in plain words: everything the team built, its staff included.
   - The inert "Basic visibility" link retired or given a reader (B12).

   Findings: B04, J4-034, J4-037, B12.
10. **Only if Ask 3 says yes: a rep-side Registrar.** The role row in Stage 1's grouped role list, and what it
    opens (tryouts and applicants? rosters read-only? documents?). One small specimen, as a delta on Stage 1's
    Members, not a redraw. Finding: S1-01.

**Not drawn, and listed on the hub as the build's server work:**
- B10 (access read from memberships everywhere);
- B11's rep-group scope on money writes;
- B12's plan gate on the team-links API;
- B13 (the dev seed);
- B08's single count rules (the drawing shows them; the build writes them);
- the ownership-transfer RPC and its coverage guard (the set of `rep_*` tables that carry `org_id` must equal
  the set the RPC re-parents).

**G03** (a club's own team into its own tournament in one click) is listed under both Stage 2 and Stage 7.
Recommend Stage 7, which is the tournaments stage, and record that on the Decisions tab.

Each specimen gets a one-line design intent in the hub's `#intent` footer, NEW / RESTYLED / UNCHANGED tags per
element with a note, and finding flags per instance with a `data-here` sentence. Use ids `s2-*` and class
`s2`, beside Stage 1's `s1-*`, with a sub-nav entry per specimen.

## The asks (numbered, each with a recommendation; put them on the Decisions tab as `open` rows)

1. **Club season lifecycle** (above). Recommend (a), one model.
2. **Ownership transfer (B04): finish it or retire it.** Recommend **finish**. The facts doc sells the "coach
   bridge", and early Club buyers will have coaches on their own portals. Retiring it means saying so on
   pricing and on this page.
3. **Does a rep club get a registrar role (S1-01)?** Today `league_registrar` exists only with the house-league
   module. Recommend yes if tryout applicants are real work for a rep club's volunteers; otherwise no, and the
   admin covers it.
4. **A Coach row in the Members invite picker (D10's second door)?** Recommend no: one door on the team page.
5. **The health board's columns against the franchise boundary.** Recommend only what the club already reads,
   the money column as the Stage 3 slot, and documents only if compliance is club-owned (templates are, and
   uploads are the family's and the coach's). Present the choice; do not widen what the club reads by drawing.
6. **Assistants: the head coach invites and the club approves (today's split)?** Recommend keeping it.
7. **G03 here or in Stage 7.** Recommend Stage 7.

## Working beside the design release

- **The dev server may be in the release's quiet window.** Ask the owner before any browser work on it. Draw
  the "before" frames from the code and from the design hub's specimens
  (https://claude.ai/artifact/R1Zcp2s93gmgaHGHn6SLSZ, slice 3 is Rep Teams). If you need real screens, take
  them from the `uat-rep-club` fixture outside that window, with the admin kit on.
- **No code, no help files, no gates.** The release session is editing the help articles and the layout
  baselines.
- **The hub file is shared.** Read it fresh before every edit. Your region is the Mockups tab's Stage 2 section,
  the `FINDINGS` entries you add, the `#intent` map, the sub-nav and the Decisions rows. True up the stale
  header line ("next: Stage 0") and the stage strip while you are there.
  - If a publish is refused because the artifact moved, merge onto the content handed back and republish.
    Never `force`.
  - **Parse the hub's scripts before every publish.** One unescaped apostrophe in the JS data kills every
    tab. Add FINDINGS / DECISIONS through a second `<script>` after the hub's own; top-level consts are shared
    across classic scripts.
- **Git:** private index, explicit pathspecs, never `checkout --` or `restore` the hub. Commit only when the
  owner says. Mockups and docs may be committed while the release is running; nothing else is being changed
  here.

## Inputs to read before drawing

- Plan §4B, §4G, §5, §6 Stage 1 (as built) and Stage 2. `CLAUDE.md`'s season ruling and
  `COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN.md` (§2 who sees which door, §3.1 the warning, §3.4 no undo).
- Code for the "before" frames and the facts:
  - the club-side screens under `app/[orgSlug]/admin/rep-teams/` (home, `teams/[teamId]`,
    `program-years/[yearId]` and its `coaches`, `tryouts`, `schedule`), plus `documents/`;
  - `app/[orgSlug]/admin/org/coaches-portal-links/page.tsx`;
  - the roll in `lib/rep-season-rollover.ts`, and the program-year and seasons routes named in B03;
  - the coach tryout routes (`app/api/coaches/[orgSlug]/teams/[teamId]/tryout-*`) and the coach help on
    tryouts (`lib/help-content/coaches.tsx`, the tryouts article and the "stays readable" line).
- The coach staff list's pass-2 pattern (`COACH_STAFF_ACCESS_PLAN.md`; memory
  `project_coach_staff_access_review`), to reuse in specimen 5.
- Stage 1's ratified specimens on the hub (5 Members, 6 invitee pages), to reuse.
- `memory/design_decisions.md` (in-repo), `memory/design_system.md`, the coach shared style kit, and
  `docs/agents/design/PROJECT_HUB_TEMPLATE.html` rules 7–8.
- Memory: `feedback_mockups_as_claude_artifacts` (true size), `feedback_clickable_design_annotations`,
  `feedback_form_selects_are_dropdowns`, `feedback_mobile_icon_only_actions`,
  `decision_drawer_layers_form_vs_menu`, `decision_edit_autosaves_create_asks` (the team-identity edit
  autosaves; "Invite a coach" asks), `feedback_build_to_approved_mockups`.

## Hand-off

Product-owner voice.
- Lead with what a club admin and a club coach each see differently.
- List the specimens by number, and say which findings each closes and which it leaves to a later stage.
- **Tell the owner to open the hub on his phone for specimens 1, 4 and 5.**
- Put the seven asks as numbered questions with a recommendation each, **Ask 1 first, with the evidence**
  (the coach's tryout tools only act on the live season, and the binding ruling keeps tryouts on the working
  season).
- Offer `/design` for a review pass if the session has budget.

Do not write the Stage 2 build prompt until the drawings are ratified. When it is written, it must settle the
order against Admin Design Continuity **Part B (the cleanup)**: Stage 2's redesigned rep-teams screens replace
the legacy ones, and Part B skips them. That is the precedent Stage 1 set with the foundation.

## Do not

- Build anything, or change routes, gates, seeds, help or copy files.
- Draw money surfaces (Stage 3: allocations, payment-request screens, the treasurer's pages, any team money
  figure), the public site (Stage 4), the calendar or venues (Stage 6), tournaments (Stage 7), or permits
  (Stage 10).
- Draw a portal door for a club team's season, an undo-rollover, or an admin write to a team's schedule.
- Widen what the club can read about a team by drawing it; that is Ask 5.
- Write customer copy for emails or prices. Draw the placement, tagged for `/marketing`.
- Mint a second artifact for this project. The hub is the only one.
