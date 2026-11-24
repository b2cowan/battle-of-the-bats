# Team Structure — Plan

> **Status:** on the board (`team-structure`); this header never restates it.
> **Created:** 2026-11-24 · **Branch:** dev · **PM brief:** [TEAM_STRUCTURE_PM_BRIEF.md](TEAM_STRUCTURE_PM_BRIEF.md)
> **Trigger:** the Milton Bats demo, 2026-11-24. They have two levels (Rep and Select). Each level has an age group
> from U11 to U19, and each age group has two teams (Purple, the older birth year; White, the younger). A VP of Rep and
> a VP of Select each run one level. Other clubs have more than two levels.

## 1. Goal

A club can describe its rep teams the way it actually runs them: its levels, the age groups inside each level, and
the teams inside each age group. It can also name the person who runs each level. That person gets the tools for
their level's teams and nothing club-wide. Every screen that lists teams then reads that one structure: the admin
board, the money filters, schedules, emails, tryouts and the public site. Today those screens show one heading
followed by a long stacked list.

This is a standalone project, not a stage of Club Website Enhancements. The public site is the last thing to read the
structure, so it is drawn last. The website project's Teams section waits on this project's end state (§6 Stage 4)
and does not invent its own.

## 2. What exists today (verified in code 2026-11-24)

**The structure is one flat layer.**
- `rep_team_groups` (`id, org_id, name, display_order`) has no parent and no kind, so groups cannot nest.
  `rep_teams.group_id` is nullable, so a team is in zero or one group. Names are unique per club; a group holding
  teams cannot be deleted (`DATA_DICTIONARY.md` ~2909-2929, ~2875).
- `rep_teams.division` is free text ("U13 Tier 1", Milton "U13"), linked to nothing (`DATA_DICTIONARY.md` ~2867).
  Tournament own-team entry matches a rep team to a tournament division **on this text**
  (`lib/club-own-teams-entry.ts`).
- Birth years are per season: `rep_program_years.born_from_year/born_to_year`.
- Purple/White (the "side") exists only in the team name. There is no gender, tier or level column.
- Milton's seed carries the level in both places: as the group (`repGroups: ['Rep','Select']`) and in the name
  ("Milton Bats U13 Rep Purple"), so a name standing alone is unique.

**Screens read it as heading, then list.**
- Public: `lib/club-site-home.ts` `clubTeamBands()` builds one band per group, sorted by name, with "Other teams"
  last. The Teams page, the club home Teams section and the Tryouts page all use it.
- Admin: `lib/club-board-view.ts` `boardBands()` ("Rep · 10 teams", "Ungrouped" last), a group filter, and the Team
  groups panel on Rep Teams.
- Also read the group: the Accounting Teams filter, the budget report's group column, the dome bill's fair shares,
  the Families book and the club schedule's team order. Permits, club schedules, team books and the budget band,
  tournament own-team entry, assistant invites, dues reminders and document templates honour the group *limit* (§2
  below). The coach portal's team switcher does not use groups.
- Communications has no "email a rep group" audience. A house league division audience exists and is the precedent.

**People who run a level: half built.**
- `org_member_rep_group_scopes (member_id, group_id)` limits a member to some groups, many-to-many. No rows means
  unrestricted. Owner, admin and treasurer are never limited. Limits are set in Manage member, owner or admin only,
  and audited.
- ⚠ **A limited member can only read.** `lib/club-team-route.ts:39` refuses every rep-team write unless the role is
  owner or admin, and those roles cannot be limited. So Milton's VP of Select either sees and edits the whole club,
  or sees only Select and changes nothing.
- A limited member is refused Families and Sponsorships, and gets no club group email.
- There is no VP, convenor or director role. `organization_members.title` is a free-text label.

**Precedent: house league** has `league_seasons → league_divisions` (name, capacity, birth years, price, publish
state) `→ league_teams.division_id`, and group email can target a division.

## 3. Rulings and promises that bound this

- **The club team limit counts every team the same, whatever the club calls it** (BD 2026-11-19, `BUSINESS_DECISIONS.md`
  ~315, ~325). A level is a label; it never changes what a team counts as.
- **A member limited to some teams never has Families** (`docs/agents/legal/IN_CLUB_VISIBILITY_PROMISES.md`;
  `lib/families-access.ts`). Giving a level lead their level's families changes a promise, so it goes to `/legal`
  before it is drawn as a yes.
- **Coach books stay the team's** (owner 2026-11-06): the club sees one cash figure. A level lead is club-side, so they
  see what the club sees, never more.
- **The Coaches Portal is not in scope.** A coach's team switcher, season rules and closed-season page are unchanged.
- **One spelling.** Whatever word a club's levels are shown under goes through `check:spelling`, and the product's
  own chrome uses one word for it (§7 O1).
- **No release timing** in this plan: stages are ordered by dependency and rework risk.

## 4. PM Brief

See [TEAM_STRUCTURE_PM_BRIEF.md](TEAM_STRUCTURE_PM_BRIEF.md). In short: clubs set up levels and age groups once;
every team list then reads as a tidy grid in place of a stacked list; a VP of each level runs their own teams without
being handed the whole club.

## 5. Plans and gates

Rep teams belong to the Club plans (`module_rep_teams`, `lib/plan-config.ts`); the canonical list is
`docs/agents/strategy/PLAN_PRICING_FACTS.md`. This project **adds no new gate**. Levels and level leads come with Rep
Teams. If anyone proposes selling level leads separately, that is a `/strategy` entry, not a stage here.

## 6. Stage ladder (PROPOSED 2026-11-24, not accepted)

Every stage after Stage 0 is one deep dive at a time: its own drawing from real captures → `/ux` and `/design` before
hand-off → the owner's asks ruled → a build prompt → the build → `/simplify` and `/review`, plus `/legal` where §6
says → `/docs` → one walk.

- [ ] **Stage 0 — The walk, the census and the end state, in one publish.** Nothing built.
  - Walk today's rep-team surfaces for the dressed Milton club on a phone and a computer: the admin Rep Teams board and
    groups panel, Manage member's group limit, Accounting's Teams filter, the budget report, the dome bill, Families,
    the club schedule, permits, Communications' audiences, and the public Teams, home and Tryouts pages.
  - Census from code, not from §2 (§2 is a lead): every reader of `rep_team_groups`, `group_id`, `division` and the
    group limit, with what each one does with it.
  - Draw the end state of every one of those surfaces once, phone first: one club with two levels (Milton), and one
    with four levels and a boys/girls split (to test O3).
  - Bring the model decision (O2) and the owner calls in §7, each with a recommendation.
  - Milton's answers on how the two VPs split the work go into the drawing's feedback slot (board: owner step).
- [ ] **Stage 1 — The structure itself.** Migration first.
  - [ ] Migration: the model chosen in O2. The working proposal (§8 AD-1) is: groups become the club's **levels**;
    each team gets a real **age group** (from a club list that knows its birth-year rule); the **side** is an optional
    short label with an order. Existing groups carry over as levels, and existing `division` text is matched to an age
    group where it reads cleanly. Anything that doesn't is left for the club to set, never guessed.
  - [ ] `docs/agents/db/DATA_DICTIONARY.md` updated; `npm run refresh:snapshots` (dev and prod).
  - [ ] Setup: where a club defines levels and age groups, and where a team is placed (create and edit team). This
    folds in parked S2-07: the panel says what a level limits.
  - [ ] Tournament own-team entry matches on the age group, not the free text (O4).
  - [ ] The Milton seed and the riverdale demo set levels, age groups and sides as data, not only in names.
- [ ] **Stage 2 — People who run a level.** `/legal` before the drawing is handed off.
  - [ ] What a level lead can open and change (O5), drawn as one table of rights by area.
  - [ ] The write guard admits a level lead on their own level's teams (`lib/club-team-route.ts:39` and every route
    that copies its rule; census in Stage 0).
  - [ ] Fold in: S2-08 (create, rename and delete of a group checks the limit), Stage 13's silent count request for a
    limited admin (`CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md` ~680), Access Sweep 3's club-wide permit a limited
    member can save, and journey J10's one line of orientation for a limited member.
  - [ ] Communications: "email a level" as an audience, for the club and for the level's own lead.
  - [ ] `/legal`: the in-club visibility promises, and whether a level lead may have their level's families.
- [ ] **Stage 3 — Every admin screen that lists teams, as one set.** The Rep Teams board as a grid (level → age group
  → teams side by side), and the same order everywhere else: Accounting's filter, the budget report, the dome bill,
  Families, the club schedule, permits and tryouts. One shared ordering helper replaces `boardBands()` and its copies.
- [ ] **Stage 4 — The public Teams page, the club home's Teams section and Tryouts.** Drawn inside the Club Website
  Enhancements whole-site pass, using Stage 0's end state as a fixed input. Built here, because it reads this
  structure, or there if that project reaches it first. Either way it is drawn once.

## 7. Owner calls open (each comes back from Stage 0 with a recommendation)

- [ ] **O1 What the product calls a level.** The club's own word (Level, Tier, Program, Stream, Division) on its
  screens, with one fixed word in the product's own chrome and help? Watch for "Division": tournaments and house league
  already use it for something else.
- [ ] **O2 A grid or a tree.** A grid (levels × age groups, teams side by side) fits Milton and most clubs, and every
  screen can draw it the same way. A tree (groups inside groups, any depth) fits anything but every screen has to draw
  any depth. Working recommendation: the grid.
- [ ] **O3 Boys and girls.** A third axis, or levels named "Girls Rep" and "Boys Rep"? Test it on the four-level
  drawing.
- [ ] **O4 Age groups as one club list.** One list (U7 to U19, each knowing its birth years for a season) shared by
  rep teams, tryouts and tournament entry? Do house league divisions also read it, or stay their own?
- [ ] **O5 What a level lead runs.** Teams, staff, tryouts, schedules and permits for their level: yes in the working
  proposal. Their level's money: reading the club's figure for those teams, or more? Their level's families: a `/legal`
  question first. Can one person lead two levels? (The limit already allows several.)
- [ ] **O6 The lead on the public site.** Does "VP of Select" with a name show on the public Teams page or the About
  contacts? That puts a person's name on a public page by role, so it is a `/legal` look.
- [ ] **O7 A tryout for a whole age group** (one U13 Rep tryout that fills Purple and White). Out of scope here, but
  the structure must not make it harder. An idea for `IDEAS_BACKLOG.md` if the owner wants it kept.

## 8. Architectural decisions (proposed, ruled in Stage 0)

- **AD-1 (proposed):** a grid, not a tree: levels (the existing groups, renamed), a real age group per team, and an
  optional side label. **Rationale:** every list screen can draw a fixed two-layer grid, and the existing group limit
  keeps working unchanged because it already scopes by group. A tree would make every one of the ten-plus readers
  handle any depth.
- **AD-2 (proposed):** a level lead is a limited member who may write within their limit, not a new role.
  **Rationale:** roles already carry capabilities and the limit already exists. A new role would have to be taught to
  every role check in the club side.
- **AD-3:** nothing is parsed out of a team name. **Rationale:** names are the club's words. Milton puts the level in
  the name only so a name standing alone stays unique.

## 9. Findings routed, not acted on

- [ ] `DATA_DICTIONARY.md` ~327 says a group limit grants "visibility AND edit"; the code allows reading only
  (`lib/club-team-route.ts:39`). Correct the dictionary in Stage 0 or Stage 2, whichever lands first.
- [ ] Parked S2-07 and S2-08 in `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` ~670 move here (Stages 1 and 2). That plan's
  line points here once this plan is accepted.

## 10. Words for /marketing

> Customer-visible wording written during a build, settled in ONE `/marketing` pass per stage, before the walk.
- [ ] (none yet; the first words arrive with Stage 1's setup screen)

## Progress

- 2026-11-24: logged from the Milton demo. §2 checked against the code. Nothing drawn, nothing built.
