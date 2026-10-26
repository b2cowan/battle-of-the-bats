# Club Tier Stage 9c, House league "Teams and people": draw it (prompt)

> **Written 2026-10-25**, the day 9b-2's walk (§378) passed 51 of 51. **Paste this into a new chat on `dev`.** Other sessions share
> this working copy (TODO, the Club plan, the plan and PM brief carry their edits): stage explicit paths only, and commit only your
> own hunks.
>
> **This is a drawing session, not a build.** No product code, migration, seed, help article or demo change.

## What 9c is, and what is already ruled

9c is the third rung of the Stage 9 ladder (`docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md` §4): **Ratings (convenor-only) +
a balanced snake draft; a draft per division; coach accounts as a column of 9a's gate; Publish teams with placement notices; the
status page shows the team.** 9a and 9b-1/9b-2 are built and walked (§372, §375, §378).

**Ruled — do not reopen** (record each as ruled; add nothing it did not rule). Source: plan §0, §0b, §0c.
- **Q7** light coach accounts: invited by email, **own team only**, roster contacts + schedule + scores. (Scores arrive in 9e; draw
  the door and say plainly what is not there yet.)
- **Q8** a light **1–5 rating** that feeds a **balanced snake draft**. Convenor-only.
- **Q9** volunteers are their own project, **not Stage 9**. Do not draw them.
- **Q17** club admin = league admin; registrar = registrations, fees and refunds, add by hand, email families, reads the rest;
  treasurer reads Money; **a coach is a column of the same gate, decided in 9c**. The gate is one place (`lib/house-league-access.ts`).
- **Q19** one season, age groups as divisions. **Q3** an accepted unpaid registration holds its spot.
- **9a·2** the season block already has a **Teams & draft** page in the rail and a phone tab strip. Draw inside that frame; do not
  redraw the frame.
- Q12b/Q12c (the one composer; automatic notices never count toward a cap) and 9d's batched sender are ruled. Do not reopen.

## The facts the drawing rests on (re-verify each against the code before drawing on it)

| Fact | Where to look | Consequence for the screen |
|---|---|---|
| A Teams page already exists with a **manual draft overlay** (draft mode, pick order, round/pick, "Exit draft", Shuffle) and a typed **coach name** per team; 1,074 lines | `app/[orgSlug]/admin/house-league/seasons/[seasonId]/teams/page.tsx`, `LeagueDraftState` in `lib/types.ts` | Draw "today" from the real page, not the plan's description. Decide what survives, what the rating-fed draft replaces, and whether a manual draft remains |
| No ratings exist anywhere in house league; the coach is only a typed name (census F16) | `league_teams.coach_name`; `app/[orgSlug]/coaches/page.tsx:56-67` ("No team assignments yet") | Ratings are new data about a **minor**: draw where it lives, who may see it, and how long it is kept (ask) |
| Registrations are **account-less**: a family is a guardian email, not a login | `docs/agents/db/DATA_DICTIONARY.md` house-league section (`league_registrations`) | A coach "sees roster contacts" only through a lawful basis; check what the Families/CASL basis says about sharing a guardian's email with a volunteer coach |
| The public status page looks a family up by email and **omits the team** (census F23) | `app/api/**/status-lookup/route.ts`, `app/[orgSlug]/league/**` | Draw the status page before publish (no team), after publish, and after a move |
| The Coaches Portal is a whole product (tryouts, money, closed-season page, one-door rule in `CLAUDE.md`) built for rep teams | `app/[orgSlug]/coaches/**`, `CLAUDE.md` Coaches Portal section | A "light" house-league coach must not inherit the portal's weight or break its rules. Find what a house-league coach assignment opens **today**, then draw the narrowest honest door |
| Who holds a spot: accepted, unpaid, waitlisted, withdrawn, ended | `lib/league-money.ts`, `lib/league-registration-place.ts`, 9b-2 plan §0e | Say who is **in** the draft pool (an unpaid accepted child holds a spot; a waitlisted child does not) and what happens to a child withdrawn after publishing |
| Placement notices go to families, but the season email moves onto the batched sender in **9d** | plan §4 and §6a; `lib/family-email.ts`, `lib/families-email.ts` | Push-back 4 below |
| Phone reorder is hold-and-drag, the number is the handle; never arrows | auto-memory `decision_reorder_is_hold_and_drag` | A pick order that can be changed on a phone follows it |
| A change that **tells families** is held until the check mark, not autosaved | auto-memory `decision_edit_autosaves_create_asks` | Publish teams is held and asks; an unpublished draft autosaves |

## Read first

`AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (broad reading goes to a helper; a helper's summary is a lead, open the cited lines
yourself; disagree out loud). The plan §0–§0e, §3 (census F16, F23), §4, §6a. The drawings you are following in shape and frame
rules: 9b's https://claude.ai/artifact/Ru3aDgVoyBTJb8XivYPLgT (source `HOUSE_LEAGUE_STAGE9B_DRAWINGS.html`) and the deep-dive hub
https://claude.ai/artifact/UtrYHLaqbkfQQC2kBbGEQ7. The 9b-2 build prompt for what the Registrations screen and Families window now
do (`HOUSE_LEAGUE_STAGE9B2_BUILD_PROMPT.md`). House rulings in the auto-memory index that touch these screens: mockups are Claude
Artifacts at true size, whole-screen before/after; a phone's secondary action is its symbol alone; absent beats disabled; every
highlight is clickable; sport-neutral words; player names are the baseline; one spelling. Check each against the code before drawing.

## Push back (out loud, on the drawings page, before the work)

1. **A "light" coach is not light if it is the Coaches Portal.** Q7 says own team, roster contacts, schedule, scores. The portal is
   the heavy product. Show what a house-league coach would land in today, then recommend: a narrow team page of its own, or the portal
   with a house-league workspace. State the case for the one you recommend and what each costs the coach and the convenor.
2. **A rating is data about a child.** Convenor-only is ruled. What is not: does the registrar rate, and see ratings (Q17 says
   registrar "reads the rest")? Is a rating kept per season, cleared at archive, or carried to next year's draft? Can a guardian ask
   to see it? Recommend one answer for each and flag it as an ask.
3. **Is the snake draft the right unit?** It balances by rating, but a house league's real constraints are siblings, "with a friend"
   and a coach's own child. None of those is ruled; do **not** add them as scope. Say whether the balanced draft is honest without
   them, and put "let the convenor lock a child to a team before the draft runs" to the owner as an ask rather than drawing it in.
4. **Placement notices before the batched sender exists.** 9c publishes teams and tells families; the sender that dedupes and caps
   arrives in 9d. Name which path the notice takes in 9c, what happens at a club with a large season, and whether Publish teams
   should wait for 9d's sender. Recommend, do not assume.

## What to produce

1. **One published Artifact** (source `docs/projects/active/HOUSE_LEAGUE_STAGE9C_DRAWINGS.html`; load `artifact-design` first), in
   the shape of the 9b drawings: before = today's screen from the real page; after = drawn at **true size**, a desk and a phone for
   each frame; NEW / RESTYLED / UNCHANGED tags; clickable flags; one checkbox per option for each ask; a paste-back summary at the end.
2. **Frames:** (a) Teams & draft today, then after, with nothing drafted yet; (b) rating a division's children: where it lives, one
   row, bulk, a division with no ratings; (c) the balanced draft: setup, the result per division, adjusting a pick, locking; (d) the
   manual path if one remains; (e) a coach's door: the invite, the coach's own-team view, and what is not there yet; (f) Publish teams:
   the held window, what families will read, and a change after publishing (a child moved or withdrawn); (g) the family status page
   before publish, after, and after a move; (h) the gate: the coach column added to 9a's who-can-do-what table, and what each role sees
   on these screens; (i) edge states: fewer children than teams, an odd number, an unpaid accepted child, a waitlisted child, a
   withdrawn child, two divisions for one age group.
3. **Words:** provisional, marked provisional. Final words go through `/marketing` **after the owner rules**, before any code (house
   rules: sentence case, "8:00 a.m.", the bare possessive, `npm run check:spelling`).
4. **Flow + design:** run `/ux` on the journeys (convenor, coach, family: who, where, how long, what goes wrong). Run `/design` on the
   whole page **before the hand-off**, apply its fixes, republish, report what it changed.
5. **Asks:** numbered, each with a recommendation; ask 1 = the coach's door (push-back 1), ask 2 = the rating's keeping (push-back 2).
6. **Records, same unit of work:** a 9c entry in the plan's §4 row and status log ("drawn, asks open", the link), the plan's
   PM brief, the `TODO.md` Stage 9 line, a `s9` update in the Club Tier project index (artifact `MBKRySURVFu3V9cZJvmjVr`: read `stages`
   first, pin `if_version`, state `ruled` only after the owner rules), and the auto-memory file `project_club_stage9_house_league.md`.
   Record rulings as ruled.

## Do not

- Build, migrate, seed or touch AWS or DNS.
- Reopen Q7, Q8, Q9, Q17, 9a's frame, or the 9b-2 money. Push back only where a frame exposes a real conflict, and name it.
- Draw the schedule, standings or score entry (9d, 9e), volunteers (Q9), or returning families (Stage 14).
- Restate a plan name, price or gate: point at `docs/agents/strategy/PLAN_PRICING_FACTS.md`.
- Promise timing anywhere.

## Definition of done

The drawings page is published and linked from the plan; `/ux` and `/design` have run and their changes are reported; every frame in
item 2 is drawn in its empty, working and edge states; asks 1 and 2 are answered with a recommendation; the records say "drawn, asks
open"; and a 9c build prompt can be written from the owner's answers without re-deciding anything.
