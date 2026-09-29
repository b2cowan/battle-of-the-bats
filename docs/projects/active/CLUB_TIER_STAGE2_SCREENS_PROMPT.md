# Club Tier Stage 2 · session 3 — the club's rep-teams screens (built to hub v15)

> Paste into a fresh session on `dev` **after session 1 (`CLUB_TIER_STAGE2_SERVER_PROMPT.md`) is
> committed**. Its call list (routes, shapes, refusal codes, the retire list) is in plan §6 Stage 2.
> Session 2 (`CLUB_TIER_STAGE2_TRANSFER_PROMPT.md`) builds specimen 9's page; this session does not.
> Written 2026-09-28, the day the drawings were **ratified**.
>
> **The spec is the hub:** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stage 2**.
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every NEW /
>   RESTYLED / UNCHANGED tag note is a requirement.
> - Where you must depart, say so at build time and record why; never silently.
> - Specimen 10 is **not built** (Ask 3: no rep registrar).
>
> **Read first:**
> - Plan §3 (point 2 amended; point 11), §4B, §6 "Across every stage — formatting" (and its Ask 8
>   rulings), §6 Stage 2's blockquotes and session 1's call list.
> - Memory: `project_club_tier_readiness`, `feedback_portal_is_the_formatting_benchmark`,
>   `feedback_build_to_approved_mockups`, `decision_edit_autosaves_create_asks`,
>   `decision_autosave_word_is_transient`, `decision_drawer_layers_form_vs_menu`,
>   `feedback_mobile_icon_only_actions`, `feedback_form_selects_are_dropdowns`.

## Preconditions (check before code)

1. **Session 1 is committed.** Read its call list.
2. **Admin Design Continuity has settled.** It was released 2026-09-28 (flip `74f45113`); its rollback
   runbook ("revert the flip") is valid until its Part B starts.
   - These screens are built on the released kit **with no switch**, so a rollback would strip their
     look.
   - Confirm with the owner that the release is staying before starting. Part B then **skips the
     rep-teams screens this session replaces**, as Stage 1 set the precedent. Check that the ADC plan's
     Part B list says so; if it doesn't, add one line naming the screens.
3. **The UX summary for the owner comes first** (AGENCY_RULES). It is short, because the drawings are
   ratified: what each person sees differently, and any place the build departs from the drawings.

## Formatting: the benchmark is the Coaches Portal (owner, 2026-09-28)

The hub's **Formatting check** screen is your checklist, and every one of its rows applies. In short:

- **Tables** follow `docs/agents/design/TABLE_AND_LIST_STANDARD.md` and its register:
  - column headings in the **condensed display face, uppercase, secondary ink**;
  - figures right-aligned and tabular, with the heading aligned the same way;
  - groups as **band rows**;
  - the **name is the link**, with **one chevron** in the last column and nothing conditional beside it;
  - **no links or buttons in cells** (owner ruling 2026-09-28);
  - no "⋯";
  - delete never a row action;
  - a list that doesn't fit on a phone becomes **white cards with a corner chevron**.
- ⚠ **S2-06.** The released admin kit layer overrides admin table headings to sentence case in the
  faintest ink (`rep-teams.module.css:1224-1233`, the tryouts table too). Your new tables must **not**
  inherit that override. Where you replace a page, the override goes with it. Report any override left
  for other admin tables to the ADC programme, and don't fix those tables here.
- **Page header** (`AdminPageHeader`): the **display-face title**, the back arrow in the leading corner
  behind a hairline (up one level), the eyebrow naming the program, and no subtitle. Actions are real
  ones only: the page's create first and lime, two buttons plus help at most. Export goes in the toolbar
  over what it exports.
- **Sections** follow `CoachPageSection`'s shape: a card with its heading **inside** (16 / 700, sentence
  case), a mono count beside it, and its actions on the right.
- **Cards** follow the kit: 8 px, a hairline, no shadow. A card that opens something is a **door card**
  (arrow in the eyebrow, lifts on hover), and cards never hold links.
- **Components:** prefer the portal's shared ones where they fit (`CoachRowList`, the kit cards, a
  compact `CoachEmptyState`). A shared component beats a shared class.
- **No tinted panels.** A callout is a white card with a coloured edge.
- **Words:** records with hyphens (12-8-1), times as "10:00 a.m.", one spelling (`check:spelling`).

## What to build (by hub specimen)

1. **Rep Teams → the health board** (specimen 1).
   - **Header:** Add team (lime, with the team-cap window).
   - **Toolbar:** a lede ("9 teams in 2 groups · 9 of 15 on your plan"), Team groups, Rename team URLs and
     the group filter with Ungrouped. The five door tiles leave; the rail carries them.
   - **Table columns:** Team, Season (a Live/Closed chip plus the record), Head coach (a red "No head
     coach" or amber "Invited" chip), Roster, Next event (an em dash when none), Documents, then the
     chevron.
   - **Band rows** per group.
   - **Upcoming bills:** unchanged (Stage 3a redraws it).
   - **Phone:** cards.
   - Deleting a group now asks (S2-04).
2. **The team page** (specimen 2), which replaces the season page.
   - **Header:** back to Teams; the eyebrow "Rep Teams · {group}"; the title plus the state chip; the two
     season doors (*Close the season*, *Start next season*).
   - **Four kit cards:** Record (a report card), then Roster, Next event and Tryouts as door cards.
   - **Sections:**
     - Coaches (a row list; each row opens the person on the Coaches page).
     - What the club sees (fixed copy, as drawn).
     - **Team details:** name, group, division, colour, sport, public address, description. **Autosave**,
       with the transient save word at the section foot. Archive sits in this editor.
     - Seasons (a row list; a closed season opens today's Past-season page; the live row opens nothing).
   - **The archived state:** "Bring back", with the cap window at the cap.
   - **The failed-load state:** the back arrow stays and "Try again" retries (J4-002).
   - **The rail's team block:** Team page, Roster, Schedule, Tryouts, Coaches.
   - The old season page redirects to the team page. **G04** goes with it.
   - The coach settings' "Division is managed by your club admin" is now true: the division field is its
     home.
3. **The season windows** (specimen 3).
   - **Start the next season:**
     - the consequence is the first line;
     - name and year;
     - the five carries, with budget and fee on by default;
     - **no money figure**;
     - the unsettled-money warning as **counts**, in a white card with an amber edge — it never blocks;
     - "{head coach} and the team's staff are told".
   - **Close the season,** with the same warning.
   - **The closed state card:** *Start the {next} Season*, plus the quiet "Closed this by mistake? Reopen …"
     shown only while no season is live.
   - **The two-open-seasons refusal,** in words.
   - **Start the first season,** for a team with none.
   - After this, the season PATCH refuses status changes (session 1's retire list).
4. **The coach's side** (specimen 4).
   - **Notification rows** for season closed, started and reopened, in the coach's notification settings.
     Each ships with its event (session 1).
   - **A one-time card on the Overview:** "{Club} started the {season}". Its facts are read from the
     season itself: roster count, whether there is a budget plan, a fee plan and an opening balance. It is
     dismissed per coach.
   - **A refused save** (`season_not_live`) says in words what happened, keeps the typed values on screen,
     and offers the one door (the closed-season page).
   - **No portal season door, ever,** for a club team (binding).
5. **The Coaches page** (specimen 5), team-level; it replaces the season's Coaches page.
   - **Header:** Invite a coach (lime).
   - **The no-head-coach callout:** a white card with a red edge.
   - **The row list:**
     - a pending invitation shows Resend and Cancel (Cancel asks);
     - a person's row opens their page, which shows their role, what they can open, and **Remove**.
       Remove asks, and names the case when it leaves the team with no head coach; the server needs the
       confirm (session 1).
   - **The footnote** about staff added by the head coach.
   - **The invite window** is the portal's: email, then a "Who are they?" dropdown (Head coach / Assistant
     coach), then the access summary. There is no name field; that was a deliberate call, see the hub
     note.
   - **Phone:** cards. The invite is a full-screen form that covers the bar.
6. **The invited coach's arrival** (specimen 6).
   - **The email:** the head-coach wording. Use `/marketing`'s words; draft ones until they rule.
   - **Stage 1's accept page and home-page card,** now naming the team and the role.
   - **The landing** is the team's Overview, with a one-time welcome card. A team with no live season
     lands on the closed-season page with its "Seasons are managed by …" note.
7. **Tryouts** (specimen 7): team-level, on the live season.
   - **Header:** Add applicant (lime).
   - **The Sign-ups section:** the Open chip, Copy link, Close sign-ups, and the team-named address.
   - **The toolbar:** the status views lead, and Export is pinned right.
   - **The table:** one chevron per row, which opens today's applicant panel; the per-row buttons move
     into that panel.
   - **S2-05:**
     - add **Waitlist** to the panel, matching the coach's decision board (the server already allows it);
     - drop the "one click brings a decline back" promise;
     - remove the unreachable toasts.
   - **Notes under the table:** the coach runs the tryout, and accepting adds a player to the roster.
   - **The closed-season record state,** with *Start the {next} Season*.
8. **Document templates** (specimen 8).
   - **One table** with an "Applies to" column.
   - The chevron opens the template: Download, Switch off/on, and Delete (which asks).
   - **The upload window** has an "Applies to" dropdown of the club's teams, grouped, with "Every team"
     first.
   - The scope sentence goes in the toolbar lede.

## Help, walks, sweep

- **`/docs`:**
  - rewrite the rep-teams article (seasons, Invite a coach, tryouts on the live season, templates);
  - fix every S2-03 stale line (coach and club help; the list is in plan §6 Stage 2);
  - "Set up your club" step 3 becomes "Invite a coach";
  - the roles article: a rep club's registrar-type work is the team's **team manager** (Ask 3).
  - Publish with the screens.
- **Walks on the hub's QA tab** (one purpose per walk, signed off one by one, checkable, with a paste-back;
  the memory `feedback_qa_walkthroughs_as_checkable_artifacts`), plus ledger rows numbered at write time:
  - **§C** teams and coaches;
  - **§D** seasons and tryouts;
  - the Club Shared Book **§1.16** walk the plan owes.
  - The host-own-team walk moved to Stage 7 with G03.
- **The fixture** (`scripts/seed-club-fixture.mjs --reset`) needs:
  - a team with no head coach;
  - a pending head-coach invitation;
  - a closed season with no next one;
  - a live season with no players;
  - club-published templates with some signatures.
  Keep the treasurer's role defaults as they are (the Stage 0 note).
- **The layout sweep** runs in both themes: entries for every new screen and state, the phone
  widths, and a baseline. Admin routes are in the sweep since ADC.

## Gates

- `verify:changed`, `typecheck`, the unit tests (the table-recipe and row-list guards where they reach
  admin), and `check:layout` in both themes.
- `/simplify`, then `/review` at the high-risk tier, then `/docs`. Offer `/design` for a review pass.
- The legacy rep-teams page branches this session replaces are **deleted**, not left as dead code.
  `check:css-selectors` catches orphans.

## Hand-off

- An owner-voice summary: what a club admin and a club coach see differently, and how to walk it.
- The walks are ready on the hub.
- The plan §6 Stage 2 record, memory and TODO.
- **Commit only when the owner says**, from a private index.
- Stage 2's exit is the owner's walks passing, plus session 2's transfer walk.
