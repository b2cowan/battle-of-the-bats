# Club Tier Stage 2 · session 1 — the server half (seasons, coaches, tryouts, the board's reads)

> Paste into a fresh session on `dev`. Written 2026-09-28, the day Stage 2's drawings were **ratified**
> (hub v15). This session builds what the drawings need underneath them. It changes **no club screens**
> (session 3 builds those) beyond the few named here.
>
> **Stage 2 runs as three sessions** (the Stage 1 precedent):
> 1. **This one:** the server half. Additive where possible, and it ships on its own.
> 2. `CLUB_TIER_STAGE2_TRANSFER_PROMPT.md`: bringing a coach's own portal into the club (B04). Independent;
>    it may run beside this one.
> 3. `CLUB_TIER_STAGE2_SCREENS_PROMPT.md`: the club's screens, built to the hub. It starts after this
>    session's commit.
>
> **Read first:**
> - Plan `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`:
>   - §3 (point 2 amended; point 11 added);
>   - §4B (B01–B13);
>   - §5 (D1, D10);
>   - §6 "Across every stage — formatting";
>   - §6 Stage 2, every blockquote: drawn, redrawn, **ratified**.
> - The spec is the hub: https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 → Mockups → **Stage 2**
>   (specimens 1–9; 10 is not built). Every tag note there is a requirement.
> - Memory: `project_club_tier_readiness` and `feedback_portal_is_the_formatting_benchmark`.

## The rulings this builds (owner, 2026-09-28: "other than that, I agree with your recommendations")

- **Ask 1: one season model (shape a).**
  - A club team's owner or admin holds the standalone head coach's three doors: *Start next season*,
    *Close the season* and *Reopen*.
  - The roll carries the same five things: roster, budget plan, fee plan, opening balance and continuity
    links.
  - Unsettled money gives the same warning, and it **never blocks** (binding).
  - **No self-heal for a club.**
  - Tryouts run on the working season. **No year parameter reaches a coach tryout tool.** The
    `HISTORY_ENDPOINTS` guard holds.
  - There is no undo for a roll (season-close plan §3.4).
- **D10 and Ask 4: one door.**
  - "Invite a coach" lives on the team's Coaches page. It writes the coach membership and the team staff
    membership, and sends the staff-invite email.
  - There is no Coach row in Members.
  - It works **between seasons**, because staff belong to the team.
- **Ask 5: the health board's columns.**
  - Season (Live or Closed) with its record.
  - Head coach (red when missing, amber while invited).
  - Roster on the live season.
  - Next event.
  - **Documents:** players on the live season who have signed every active template **the club
    published** that applies to the team.
  - No money column until Stage 3.
- **Ask 6: today's split for assistants.** The head coach invites their own staff. The club's "Require
  admin approval" switch stays optional and off by default.
- **Ask 3 is no.** There is no rep registrar and no role work. **Ask 7:** G03 moves to Stage 7.
- **Formatting.** The Coaches Portal is the benchmark (§6), which matters here only for the words and
  codes the screens will show.

## Before code

- Present the product-manager UX summary (AGENCY_RULES). For a server session it is short: what a club
  admin and a coach will be able to do once session 3 lands, and what changes today (the portal's
  season-end doors fix, the coach notification rows, the refusal words).
- Check `git status`. Other sessions' hunks sit in the tree, so use a private index and explicit
  pathspecs at commit.
- **Admin Design Continuity was released 2026-09-28** (flip `74f45113`). Its Part B (the cleanup) waits
  for a settling period and **skips the rep-teams screens Stage 2 replaces**. Nothing here touches its
  files.
- The dev server may be shared. Ask before a sweep or a restart.

## What to build

### 1. Club seasons (B03, Ask 1, specimen 3)

- **A club-side season route** for an org-owned team, open to the owner and to an admin with Rep Teams
  (the rep-teams write gate, owner or admin, never treasurer). It has four parts:
  - **GET, the preflight.** Is the season live? May it reopen? Plus the warning's **counts only**:
    families still owing, and families with money waiting to go back. Reuse `loadSeasonSettlement` the
    way the portal's `GET /seasons` does. It returns nothing that refuses. There are no dollar
    figures: the club reads team money only from Stage 3 (D1).
  - **POST, start next season.** Call `startNextRepSeason`.
    - Fee and budget carries default on.
    - Cash carry is `mode: 'all'` only: the club never chooses an amount, and the coach adjusts it in
      Team settings.
    - It rolls from the live season, or from the newest closed one when there is none, exactly as the
      portal route does.
  - **PATCH `close`.** A status flip on one row, every condition re-asserted in the `WHERE` (copy the
    portal PATCH).
  - **PATCH `reopen`.** Only while the team has no live season, and only the newest closed season.
- **No self-heal for a club** (`lib/rep-season-rollover.ts:127-140`).
  - Give the roll a choice: the standalone path keeps completing a stray open season; the club path
    refuses with `SeasonRolloverError('two_open_seasons', 409, …)` naming both seasons.
  - Unit-test both branches and mutation-test the club branch.
- **The first season.** Today's Add Program Year:
  - stays only for a team with **no seasons at all**, and creates the season `active`;
  - refuses with a coded 409 in words once any season exists ("start the next one from the team's
    current season").
- **One live-season rule for the club side:** a season is **live when it is draft or active**. That is the
  portal's rule (`lib/coach-season-view.ts`, `getActiveRepProgramYear`). "Draft" stops being a
  preparation state anywhere a club reads.
- **Leave the year PATCH's status path working** until session 3 replaces the season page. Record in the
  call list that session 3 then refuses status changes on that PATCH (Activate and Archive fire on one
  click today, S2-04).
- **The coach is told.** When the club closes, starts or reopens a season, the head coach and the team's
  staff get a notification.
  - Check whether notification event types are constrained in the database (dev and prod snapshots,
    `information_schema`). If they are, that is a migration plus the data dictionary.
  - Each row ships with its event (S1-04). Draft the words; the bell copy is product copy.
- **A refused save says why** (specimen 4, frame C).
  - Find the shared place where portal write routes resolve the live season.
  - Make the refusal for "this team has no live season" **one coded answer**:
    `409 { code: 'season_not_live', seasonName, closedBy: 'club' | 'coach' }`.
  - Session 3 turns it into the drawn sentence and door. Do not add a year parameter anywhere.
- **S2-01.** The closed-season page offers *Start next season* and *Reopen* from `isTeamWorkspace` alone
  (`season-end/page.tsx:580-595`). The server's `mayManageSeasons` also excludes `org_owned` and
  `archived`. Make the page ask the **same** function; share it and don't copy it.

### 2. Coaches on the team (B01, D10, J4-035, B09, specimens 5–6)

- **A team-level coaches route.** Today's is per program year:
  `app/api/admin/rep-teams/teams/[teamId]/program-years/[yearId]/coaches/route.ts`.
  - **GET:** the team's staff memberships, head coaches included, plus pending invitations, including
    `pending_approval`.
  - **POST invite:** `{ email, kind: 'head_coach' | 'assistant_coach' }`.
    - Reuse the portal's invite machinery (`lib/assistant-invites.ts`, the staff invite route, the
      7-day link, `/auth/accept-assistant-invite`).
    - A **head-coach kind** does not exist today. The four `STAFF_KIND_COPY` kinds are all non-head. Add
      one with full capabilities, and never let the kind reach the portal's own invite form.
  - **Resend and Cancel.**
  - **DELETE:** allowed for the club even for the team's **last head coach** (the club must be able to
    act when a coach leaves). It requires an explicit `confirmLastHeadCoach: true` when that is the case;
    without it, return 409 `last_head_coach`.
    - The portal keeps refusing last-head-coach removal (`refuseLastHeadCoach`); do not change it.
- **Between seasons.** The membership is team-level. When a live season exists, project onto it
  (`projectMembershipsOntoProgramYear`).
- **The email (S2-02).**
  - Add a head-coach wording that names the club and the inviting person. Never use the "The head
    coach" fallback on a club invite.
  - Draft the words and mark them for `/marketing`, as the hub's copy tags do.
- **Accept** lands on the team through the destination resolver. With no live season it lands on the
  closed-season page; the gate already does that.
- **Keep the old program-year coaches route** until session 3 replaces its page, then retire it. Put that
  in the call list.

### 3. Tryouts on the live season (B07, specimen 7)

- **The admin tryout routes** (`…/tryouts/route.ts`, `…/tryouts/[regId]/route.ts`) and the accept path
  (`acceptTryoutAndAddToRoster`): writes **refuse a season that is not live**, with a coded 409 in
  words. The "tryouts open" switch refuses on a closed season.
- **One public rule.**
  - The team's public page (`app/[orgSlug]/teams/[teamSlug]/page.tsx:60-62`, today **active** only) and
    the register API (`app/api/rep-teams/[orgSlug]/[teamSlug]/tryouts/[yearId]/register/route.ts`,
    today **any** status) both use **the live season with tryouts open**.
  - Add a team-named public address, `/{org}/teams/{teamSlug}/tryouts`, that always means the live
    season. An old year-id address redirects to it when that year is the live one, and otherwise says
    the team isn't taking sign-ups.
  - ⚠ Routing and rules only. The public pages' look is Stage 4's.
- **The coach side is unchanged.** It already acts on the live season only.

### 4. The board's and the team page's reads (B08, B09, Ask 5, specimens 1–2)

- **One roster rule:** active players on the **live** season, not call-ups.
  - Today the teams list counts every season's rows (`teams/route.ts:67-76`: a team of 14 reads 27).
    The history list counts inactive players and call-ups; the history detail excludes call-ups.
  - Write the rule once. Every club read uses it.
- **One record rule:** finalized games that count toward the record, via `countsTowardRecord`. League
  and tournament count; scrimmages don't.
  - Today the admin schedule widget counts league games only (`schedule/page.tsx:96-104`).
  - Write it once and read it everywhere.
  - Add a guard test that each surface calls the one function.
- **The board read,** per team:
  - the live season's name and Live or Closed, with its record;
  - the head coach from staff memberships, or the pending head-coach invitation;
  - the roster count;
  - the next event;
  - the Documents count (above);
  - the team's group.
- **The team read:** the same, plus the seasons list (record, players and head coach per closed season).
- **The team PATCH** (`teams/[teamId]/route.ts:72-79`):
  - accept `groupId`, validated to the org;
  - keep name, division, colour, sport, description and archive / un-archive (the cap check exists).

### 5. Document templates (B11, J4-009)

- The template create and update check that `teamId` is one of the org's teams (today they don't,
  `document-templates/route.ts:55,81-83`).
- A member limited to one team group sees and scopes only that group's teams.

### 6. The rest of the server list

- **B10:** read access from team membership in the four coach routes (tournament history, tournament
  games, hosted tournaments, team links; `lib/team-workspace-entitlements.ts:260-278`) and in the
  Assistant coaches list (`lib/db.ts:3978-3996`).
- **B11:** apply rep-group scope to payment-request approve and deny, the admin's mark-paid, and the
  allocation PATCH.
- **B12:** a module and plan gate on the team-links API. Retiring the basic link is session 2's work.
- **B13:** fix the dev seed:
  - roster `source`;
  - staff membership rows;
  - the Shared Book opt-in becomes head-coach-only as ruled
    (`coaches/.../route.ts:196-218`);
  - verify whether an archived team's public page stays up, and record the answer.

## Not in this session

- The transfer (session 2).
- Every club screen (session 3).
- Money (Stage 3).
- The public site's look (Stage 4).
- The admin rail and the nav review (Stage 8).
- Help articles. Session 3 publishes them. The stale lines are listed as S2-03 in plan §6 Stage 2.

## Gates

- **Unit tests:**
  - the club roll refuses a stray season, and the standalone roll still completes one (both
    mutation-tested);
  - close and reopen conditions;
  - the preflight never refuses;
  - an invitation writes both membership rows;
  - removing the last head coach requires the confirm;
  - tryout writes refuse a closed season;
  - the public page and register API agree;
  - one roster rule and one record rule (a guard that every surface calls them);
  - the team PATCH group;
  - the template team check;
  - the S2-01 predicate is shared.
- **Existing guards stay green:**
  - `coach-history-endpoint-guard` (no year parameter added);
  - the membership projection guards;
  - `check:org-slug-callers`;
  - `check:spelling`;
  - `check:dictionary` if a migration lands (plus `refresh:snapshots`).
- `npm run verify:changed`, `npm run typecheck` and the targeted unit files (a full unit run wipes
  `test-results/`; run it when no peer is sweeping).
- `/simplify`, then `/review` at the **high-risk** tier (seasons, membership, and a public form).

## Hand-off

- An owner-voice summary.
- **A call list for session 3:** routes, request and response shapes, refusal codes, the retire list
  (the old coaches route, the year PATCH's status path, the season page).
- The record in plan §6 Stage 2, the memory update, and a TODO line.
- **Commit only when the owner says**, from a private index with this session's files only.
- A migration, if any, is prod-owed. Record it in the plan and in the release notes' owed list.
