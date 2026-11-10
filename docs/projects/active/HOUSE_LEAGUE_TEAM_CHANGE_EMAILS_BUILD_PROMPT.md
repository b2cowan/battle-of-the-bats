# House League: team-change emails after publishing (build prompt)

> **Written 2026-11-10.** **Paste this into a new chat on `dev`.** Size **M**. **One migration expected** (`ls supabase/migrations`
> first; the highest on 2026-11-10 was **458**, so **459** or higher).
>
> **Binding, do not reopen:** rulings **TC·1 to TC·8** (plan `HOUSE_LEAGUE_TEAM_CHANGE_EMAILS_PLAN.md`), which **supersede 9c·12**
> in `HOUSE_LEAGUE_STAGE9_PLAN.md` §0f; and the house-league-wide rulings 9f·17 (house-league seasons read in place; add no
> one-page closed season and no coaches-portal branch).
> **Drawings (approved by the owner 2026-11-10):** https://claude.ai/artifact/DSwtAPGb9fJsoEZTTmAD5h, source
> `HOUSE_LEAGUE_TELL_FAMILIES_DRAWINGS.html`. Seven tabs: 1 banner, 2 review window (interactive), 3 Don't email, 4 whole screen
> before and after, 5 the email and who-gets-what, 6 phone, 7 asks. **Build to them** (NEW / RESTYLED / UNCHANGED tags apply).
>
> **Read first, in this order:** (1) the plan; (2) the drawings, tabs 1 to 6; (3) the precedent you reuse, the Schedule's
> "tell the families" window: `components/admin/kit/club/league/time/PracticeTellWindow.tsx` (`PracticeTellReminder` :335 is the
> amber Callout with count chip and button; the default export :52 is the Send window; `LeftOutLine` :257 and `SeeThem` :270 are
> the "families no email can reach" row; "See an example" is a level inside the window), with its words
> (`lib/league-practice-tell.ts`) and server (`lib/league-practice-tell-server.ts`: `readTell` :214, `tellFamilies` :386,
> `sendPracticeNotice` :457); (4) `lib/house-league-placement-mail.ts` (the whole file: claim, outcome, second-parent copies,
> invitation slots); (5) `supabase/migrations/377_house_league_teams_and_people.sql` (`league_team_place` ~:293,
> `league_division_publish`) and `385_*` (the publish function as it stands); (6) `docs/agents/db/DATA_DICTIONARY.md` for
> `league_registrations`, `league_placement_emails`, `league_season_notices`.
>
> Re-verify every lead below before building on it: other sessions share this working copy and a helper's summary is a lead, not
> evidence. Stage **explicit paths only**, commit only your own hunks, check `git diff --cached --name-only` before every commit,
> **commit only when the owner says**, on `dev`.
>
> **Recommended model: Opus 5.5, one session** (split after Part 4 if context is deep; the Progress block lets the next chat
> resume). Before any code, present the Product-Manager UX summary and task list (the repo makes that a blocking step). Reading
> and searching go to helpers. Update the Progress block after each Part.

## ▶ Progress (read first when resuming)

- **2026-11-10 · Part 0 done.** Owner took all six push-backs as recommended (defaults: `run` rights only; no-email children are
  one amber line and get marked told; backfill told = team for published divisions; trigger clears told on leave/division
  change; different first-parent emails stay separate; old `moved` rows keep working).
- **2026-11-10 · Part 2 DONE (dev).** `459_team_changes_are_told_in_one_email.sql` applied to dev; `MANUAL_PROD_STEPS.json` entry
  `pending`; dictionary updated; `scripts/house-league-teams-check.sql` T7 rewritten and passes (HOUSE_LEAGUE_TEAMS_PASSED).
  Departures from the prompt, on purpose: (1) Publish stamps told on EVERY accepted child on a team (not only emailed ones),
  so a child with no address never wears "Not told" from minute one; (2) the fingerprint lives in SQL only
  (`league_division_untold_fingerprint(division)`), the TS rule does not compute one: the server reads it by rpc;
  (3) `league_division_tell_changes(org, season, division, actor, fingerprint, send[], skip[])` takes LOWER-CASED family
  addresses and requires send + skip to be exactly the untold families, each once (anything else = `changed`); returns
  `(refusal, notice, email_ids, sent_families, skipped_families, no_email_children)`; refusals `finished`, `not_published`,
  `changed`.
- **Part 3 DONE.** `lib/house-league-team-changes.ts` (+ `tests/unit/house-league-team-changes.test.ts`, 12 pass): `teamChanges`,
  `isUntold`, `familyKey`.
- **Parts 1, 4, 5 DONE in code (typecheck of the route fixed, whole-repo rerun owed after Part 6; run it with
  `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`, the default heap runs out).** Words: `lib/house-league-team-changes-words.ts`
  (`TC_BANNER`, `TC_CHIP`, `TC_WINDOW`, `TC_SKIP`, `TC_PILL`, `TC_HISTORY`, `TC_MAIL`). Server: `lib/house-league-team-changes-server.ts`
  (`readTeamChanges`, `tellTeamChanges`); route `app/api/admin/house-league/seasons/[seasonId]/team-changes/route.ts` (GET
  `?divisionId=`; POST `{divisionId, fingerprint, send[], skip[]}` or `{divisionId, skipAll:true, count}`; returns
  `{ok, sentFamilies, skippedFamilies, noEmailChildren, outcome, at}`); email `leagueTeamChangesHtml` in `lib/email.ts`; `sendClaimed`
  has the `changes` branch; board read has `board.untold {families, children, noEmail}`, `BoardPlayer.untold`, `DivisionTab.untold`;
  `placePlayer(org, season, reg, team, actor)` no longer takes `confirmed` and the placement route no longer sends; Email families
  history knows `team_changes`. Departure: the registrations screen's "published" refusal was DELETED (a move there now lands
  and joins the banner) instead of reworded, because the database no longer refuses it.
- **Parts 6, 7, 8 DONE 2026-11-10 (dev, uncommitted).** Screen: `TeamChangesBanner.tsx`, `TeamChangesWindow.tsx` (Review and email, example-email and no-address levels), the Don't email confirm (the shipped confirm window), the "Not told" chip on the player row's state line, the division picker's amber count, the screen's own pill; `HeldMoveWindow`, its acts and its words are gone. Help article `build-teams-after` rewritten; Stage 9 plan status line + TODO line updated. `/legal` ran: `docs/agents/legal/CASL_PRIVACY_TEAM_CHANGE_EMAILS.md` (no change to the email or the record; ONE owner call: reword `FAMILY_HOME_WORDS.family.noTeam` after the 4A walk, because "The club will email you when teams are set." can now be untrue). Checks: whole-repo typecheck clean; the DB check passes; the house-league guards, the new unit tests (rule 12, email/words 9) and spelling pass; dictionary, snapshot freshness, index, observability checks pass. NOT mine and failing in the shared tree: billing/permits-layout/platform-admin tests, org-slug callers, css selectors, export catalog, root `debug.log`, index coverage on four other tables, and the `team-move-coverage` test for `platform_charge_tax_looks`. `check:schema-parity` lists mig 459's two widened CHECKs as dev-vs-prod drift until the prod apply. Dev server restarted and answering. NOT DONE then: `check:layout` at 4 widths (needs a published division with untold families; owner walk covers it), `/simplify`, `/review`, the walk, the commit, the Family App and 9c walk rewrites.
- **2026-11-10 · `/simplify` + `/review` DONE, COMMITTED `cdc1eea19` (dev, 40 files; not pushed).** Simplify: dead words/fields removed, one family key (`householdKey`), division tabs read in parallel and skip unpublished divisions. Review (5 lenses: correctness, security/tenancy, data/contract, concurrency, regression) found nothing Critical or High and no cross-org reach. Fixed: the window read the fingerprint with the rows (now fingerprint first, as the board does); a `null` POST body gave 500 (now 400); banner Don't email now REQUIRES the count it was shown; two stale lines of screen copy still said a move emails the family (Publish step line, draft refusal); the division picker read out "to review" for the new amber count (now "n families not told"); stale help search text; the prod-steps note described the deploy gap backwards and now says apply once, not re-runnable. Committed the email with the committed invitation order (button then panel); another session's uncommitted money-block work reorders the placed and moved emails and must reorder this one too. Plan, PM brief, the §0l section and the §155 supersede note of the Stage 9 plan are NOT committed (not on the commit list).
  **Open for the owner (not guessed):** (1) Don't email on the banner guards only by count; a move-back plus a new placement between the screen and the confirm keeps the count equal and would skip a family never seen (fix = the board carries the untold fingerprint, one more call). (2) A failed team-change email shows in "Send the {n} again" with the Publish banner's words. (3) An unsent team-change email is not voided when the child moves again; Send again after a further move can send two contradictory emails to a family. (4) The history line and the pill say "emailed" even if the send died after saving (corrects itself after Send again). (5) Latent, new migration if wanted: an address padded with a tab or non-breaking space makes SQL and JS disagree, so Send returns "changed" for that division until the address is fixed; a guardian-email edit in the same millisecond as a Send could stamp a family told with no email (lock the rows). (6) Seasons over 1000 accepted children undercount the picker (existing read limit). (7) A silent move shows on the family's status page ("moved from") and in practice-time emails before the family is told; this matches TC·1.
- **Next: owner walk (outline below); mig 459 to prod before the promote (apply once, then promote straight after).** Facts below were read from the code on 2026-11-10; a helper
  re-verified them the same day (all held). Re-check line numbers; they drift.

## What the owner gets (the PM summary)

After a division is published, moves save at once and email nobody. A banner under the published notice says how many families
haven't been told, with **Review and email** and **Don't email**. A small amber **Not told** chip marks each child it means.
Review and email opens one window listing each family and what changed for each child; three siblings are one row and one email,
and a child moved and moved back is not mentioned. Each family can be switched off. **Don't email** (whole banner, after one
confirm, or per family inside the window) clears the banner, is saved in Email families with who did it, and counts the child as
told the team they are on now. After sending or skipping, the screen's own notice pill confirms. The old "Move and email" and
"Place and email" windows are gone. Details: PM brief and plan.

## Facts read from the code (2026-11-10)

1. **Move today.** The screen's `place()` (`TeamsScreen.tsx` ~167-178) posts `{action:'place', registrationId, teamId|null,
   confirmed}` to `app/api/admin/house-league/seasons/[seasonId]/placement/route.ts`. Published and not confirmed: the client
   never calls the API, it opens `HeldMoveWindow` (`MoveWindow.tsx:80`, rendered `TeamsScreen.tsx` ~417). Confirmed: the route
   calls `placePlayer` (`lib/house-league-teams.ts:293`) which calls `league_team_place`; the route then calls
   `sendPlacementEmails` in the same request (route ~52-55; it is not wrapped in try/catch, so a throw fails the request after
   the move committed).
2. **`league_team_place`** (mig 377): pre-publish it sets `team_id` and clears `team_locked_at`, silently. Published and not
   confirmed it returns refusal `published`. Published and confirmed it sets `previous_team_id`, `team_changed_at`, `team_id` and
   inserts one `league_placement_emails` row (`kind` `placed` if the old team was null, else `moved`; `registration_ids` one child;
   `from_team_id`; first parent's email only; none if the target is null or the email is blank). Unchanged team: returns early.
   Off a team: no row.
3. **Publish** (`league_division_publish`, mig 377, replaced by 385): one `placed` row per family, grouped by
   `lower(btrim(guardian_email))` over active children with a team and a non-blank email (the FIRST parent's email only), plus a
   `teams_published` row in `league_season_notices`; it clears `team_locked_at`, `draft_team_id`, `previous_team_id`,
   `team_changed_at` for the division. Second parents get copies later through `sendSecondParentServiceCopies`.
4. **NOTHING records the team a family was last told.** No `told_team_id` or similar exists. `previous_team_id` is overwritten by
   each move and cleared at Publish, so it cannot serve. The nearest precedent is per team (`league_team_practices_told`).
5. **Danger.** `unsentPlacementEmails` (`lib/house-league-placement-mail.ts:281`) and `readDivisionBoard`'s `board.emails.unsent`
   (`lib/house-league-teams.ts` ~194-203) count every `failed`, `pending` or `sending` row of the division. **Silent moves must
   not be stored as `pending` email rows**: the "Send the {n} again" banner, the publish route's sweep and `resend` would all pick
   them up, unconsolidated. This design derives the untold list from the children instead (Part 2), and creates email rows only
   when the convenor presses Send.
6. **Other team writers.** No code other than `league_team_place` (and draft apply, clear, publish) writes `team_id`. The trigger
   `league_registrations_team_follows` (mig 377, redefined 379) nulls `team_id` when a child leaves `active` or changes division
   and sets `previous_team_id`; no email comes from it. Accepting a late child leaves `team_id` null ("Not on a team"). The
   registrations screen's `teamId` field calls `placePlayer(..., false)`: pre-publish it moves silently, published it refuses 409
   ("Move players on Teams & draft, where the family is told.").
7. **Board read.** `BoardEmails { atPublish, atPublishSent, unsent }` is declared `lib/house-league-teams.ts:70-76`, computed in
   `readDivisionBoard` (~140-223) from one `league_placement_emails` select; route `.../teams-board/route.ts` (gated `read`);
   client type `BoardRead` in `components/admin/kit/club/league/teams/api.ts:14-21`. `BoardPlayer.guardianEmail` already comes
   with the board, lowercased. `familyCount` is grouped by it (`TeamsScreen.tsx` ~154).
8. **Rights** (`lib/house-league-access.ts` ~100-117): `run` = owner/admin/league admin and the season not finished (423 when
   finished); `read` = anyone in house league (the registrar reads with no controls); `email` = `run` plus the registrar.
   Publish and resend are `run`.
9. **Emails.** Builders `leagueTeamsPlacedHtml` (`lib/email.ts` ~1289, takes `lines: PlacedTeamLine[]`) and `leagueTeamMovedHtml`
   (~1325, one child, `fromTeam`, `toTeam`, optional `practices`); words in `lib/house-league-teams-words.ts` (`placedMail` ~121,
   `movedMail` ~129, `familyCoachClause`). Both are SERVICE sends (`sendFamilyServiceBatch`, kind `house_league_placement`):
   unsubscribed families still get them and nothing counts toward a cap. `sendClaimed` already builds the invitation slots and the
   second parents' copies; the `moved` branch names only `asMail.slice(0, 1)`. A moved child onto an already-told team gets that
   team's practice dates (9d-3, ruled 2026-11-01 (b); `toldDateLines`): **the new email must keep that.**
10. **Guards.** `tests/unit/kit-dialog-foot-text-guard.test.ts` (any sentence in a window's foot goes in `footerStart`, never
    `footer`); `admin-overlay-guard.test.ts` (an allowlist of windows, includes `TeamsBoard.tsx`; a new window may need
    registering); `league-season-scope-guard.test.ts` (placement route pinned: `teamsInSeason` / `registrationsInSeason`;
    a new route needs the same checks); `house-league-board-notes-guard.test.ts` (guards the board's read shape);
    `club-stage13a-doors-guard`, `club-stage13i-places-guard` and `house-league-season-frame` (pin `NotYours`, `DivisionPicker`,
    the `/teams?d=` push in `TeamsScreen`); tests that read the placement mail source (`family-invitation-mail`,
    `league-second-parent-fanout`, `house-league-signup-guard`, `league-practice-tell`). No test names `HeldMoveWindow` or the
    screen's `W.move.*` words. `tests/unit/team-move-coverage.test.ts` lists every `org_id` table (this plan adds columns, not a
    table). No demo seed touches placement emails or league registrations.

## Push-back, before you build

Say these out loud at Part 0; the recommendation is the default if the owner is unreachable (list them under "Defaults taken").

1. **Who may send or skip: `run` only** (owner, admin, league admin), the same as Publish and Send again. The registrar sees the
   banner's absence and the chips' absence. The alternative, `email` (adds the registrar), widens who can send to families.
   *Recommended: `run`.*
2. **Children with no email address on file.** They cannot be emailed. Recommend: the window shows one amber line ("{n} children
   have no email address on file", with the same See them door the practice window uses), they are NOT rows, and pressing Send or
   Don't email marks them told so the banner never lingers on them.
3. **Existing data.** Backfill `told_team_id = team_id` for every active child with a team in an already-published division, on the
   assumption they were told (Publish email or an immediate move email). House league is not on sale; if a division has failed
   sends, the existing "Send the {n} again" banner still covers them. *Recommended.*
4. **A child who leaves and returns.** Withdrawn then accepted again, or moved to another division: recommend clearing
   `told_team_id` wherever the trigger nulls `team_id`, so a re-accepted child is "new" again. `/db` decides the trigger edit.
5. **Different first-parent emails.** Siblings registered under different first-parent emails get separate emails, exactly as
   Publish groups today. Said out loud, not fixed here.
6. **Old `moved` rows.** Keep the `moved` branch of `sendClaimed` working for rows that already exist; no new `moved` rows are
   created after this build.

## Decisions already made

TC·1 to TC·8 (plan). The design that follows from them, so the build does not re-derive it:

- **"Untold" is derived, not queued.** Each active child has `told_team_id` (the team their family was last told, or skipped-as-
  told) and `told_at`. A child is **untold** when they are active, on a team, and `team_id IS DISTINCT FROM told_team_id`:
  `told_team_id` null means **new** ("placed"), otherwise **moved from** `told_team_id`. Net zero (`team_id = told_team_id`)
  is not untold. A family is **quiet** (the window's "Nothing to send to the {family} family: {child} moved and came back to {team},
  the team they were last told") when none of its children is untold but one has `team_changed_at > told_at`. A child off a team is
  never untold and never emailed (TC·5).
- **Three sets, one grouping.** Group by `lower(btrim(guardian_email))`, the same as Publish. Families with a blank email are the
  "no email address" line, not rows.
- **Sending** creates the email rows at the moment the convenor presses Send, in one transaction with the notice and the told
  stamps (Part 2's `league_division_tell_changes`), then sends through the existing claim and outcome machinery
  (`sendPlacementEmails`), so a failure shows in the existing "Send the {n} again" banner and resend works with no new path.
- **A race is refused, not guessed.** The window reads a fingerprint of the list it shows (as Publish does with
  `league_division_fingerprint`); the transaction re-reads under lock and refuses with "The list changed. Review again." if it
  differs.
- **A skip is a send with no email.** Skipped families get no email row; their children are stamped told as of now, and the notice
  counts them.
- **The history row.** One `league_season_notices` row per press (kind `team_changes`, `family_count` = families listed in the
  press, `reached_count` / `failed_count` as sent, new `skipped_count`, `created_by`). Whole-banner Don't email is one row with
  `skipped_count = family_count`. The history screen (`lib/families-emails-log.ts` ~246) renders: "{n} families emailed",
  "Not emailed ({n} families)", or both ("2 emailed, 1 not emailed"), always "by {name}".
- **No new email kind.** Reuse `house_league_placement` (no change to `lib/email-kinds.ts`, `EMAIL_KINDS` guards untouched).

## Parts

### Part 0: PM summary and task list (blocking)

Present the PM summary above, the six push-backs and a task list, then wait for the owner's answers before Part 2. If the owner
is unreachable, build the recommended defaults and list them under "Defaults taken" in the Progress block.

### Part 1: Words

Put the screen's words in one place (`lib/house-league-team-changes-words.ts`; the Teams screen's existing words file keeps
its own). Starting words are the drawings' (provisional until a `/marketing` pass, as in the practice window's precedent):
banner "{n} family hasn't / {n} families haven't been told about team changes." with sub "Their status page{s} and the family app
already show the new team{s}."; buttons "Review and email" and "Don't email"; window title "Email {n} families about team changes?"
with sub "Each family gets one email with what changed for their children."; foot-left "One email per family · {n} emails" (in
`footerStart`, never `footer`); button "Send to {n} families"; chips "New", "Moved", "Not told"; per-family "Don't email this
family" / "Email this family"; off-note "Not emailed. Their status page still shows the team{s}."; all-off foot "Every family is
switched off. Nothing will be sent." with the Send button ABSENT (not greyed); confirm "Don't email {n} families?" /
"Their status pages and the family app already show the new teams. Nobody is emailed about these changes. This is saved in
Email families. You can still email any family later from their registration with Send again." / button "Don't email" (the confirm
repeats the opener's verb); pills "Emailed {n} families at {time}." (time only through `formatTime()`, "10:42 a.m.") and
"Not emailing {n} families. Saved in Email families."; the quiet line under the banner replaces `publish.after` ("Moving a player
doesn't email anyone. You choose when families are told. There is no unpublish."). The email: subject "Team changes for {names} ·
{season}", lead "Here is what changed for your children in {division}.", one block per child ("{child}: {team}" / "New team ·
Coach {coach}" or "Moved from {team} · Coach {coach}"), closing "Their status page always shows their current teams." and the
"Your sign-up" button only while money is owed, as the Publish email does. **One spelling, everywhere**: run `npm run
check:spelling`.

### Part 2: Migration 459 (dev first; `/db` conventions)

`459_<name>.sql`, applied to **dev**; a `MANUAL_PROD_STEPS.json` entry `pending`. Contents:

- `league_registrations.told_team_id uuid NULL REFERENCES league_teams ON DELETE SET NULL` and `told_at timestamptz NULL`,
  with the backfill from push-back 3. Check index needs against the board read.
- `league_placement_emails`: widen the `kind` CHECK to `placed | moved | changes`; add `changes jsonb NULL`
  (`[{registration_id, from_team_id}]`, a snapshot taken when the row is made, because `told_team_id` moves on send and a retry
  must still say "moved from {team}").
- `league_season_notices`: widen the `kind` CHECK (as 400, 409 and 415 did) to add `team_changes`; add
  `skipped_count integer NOT NULL DEFAULT 0`.
- **Replace `league_team_place`** (same signature, keep `p_confirmed` as an ignored parameter so no caller breaks): no
  `published` refusal, no `league_placement_emails` row, same `previous_team_id` / `team_changed_at` writes after publish, same
  early return for an unchanged team, same refusals for finished / not accepted / wrong division.
- **Replace `league_division_publish`** (385's body): in the same transaction as the email rows, stamp `told_team_id = team_id`,
  `told_at = now()` on every child those rows name (and clear nothing else new).
- **New `league_division_tell_changes(p_org, p_season, p_division, p_actor, p_fingerprint, p_send text[], p_skip text[])`**:
  lock the division, recompute the untold set, refuse on a fingerprint mismatch, create one `changes` row per family in `p_send`
  (snapshot in `changes`), create the notice and stamp `notice_id`, stamp `told_team_id = team_id`, `told_at = now()` on every
  child of every family in `p_send` or `p_skip` and on the children of the quiet and no-email families, return the row ids and
  counts.
- The trigger edit from push-back 4 if the owner accepted it.
- Dictionary: the new columns, the new kinds, "`told_team_id` is written only by Publish and the tell function", gotchas; refresh
  snapshots (`npm run refresh:snapshots`); `npm run check:dictionary`. Extend `scripts/house-league-teams-check.sql` with the
  cases below.

### Part 3: The pure rule and its tests

`lib/house-league-team-changes.ts` (no server import): given the division's active children (id, names, guardian email, `team_id`,
`told_team_id`, `told_at`, `team_changed_at`) and the teams, return `{ families: [{ email, children: [{ id, name, kind:
'placed'|'moved', fromTeamId, toTeamId }] }], quiet: [...], noEmail: [...] }` and a stable fingerprint. `tests/unit/` file covers:
three siblings placed; one moved twice (A→B→C says "from A"); moved and moved back (quiet, not a row); late child placed;
off a team (absent); no email (noEmail); email case and spacing; second parent not used for grouping; a child whose team was
deleted (`told_team_id` null by the FK): treated as new.

### Part 4: Server, route, email

- `lib/house-league-team-changes-server.ts`: `readTeamChanges(divisionId)` (the window's read, with the fingerprint and example
  data) and `tellTeamChanges({ send, skip, fingerprint })` (the RPC, then `sendPlacementEmails` for the new row ids, returning the
  outcome).
- `app/api/admin/house-league/seasons/[seasonId]/team-changes/route.ts`: GET (read) and POST (`send` families, `skip` families,
  or `skipAll`), both gated `houseLeagueRefusal(ctx, 'run')` with the finished-season 423, with the `teamsInSeason` /
  `registrationsInSeason` scope checks the guard pins. Wrap the send so a throw after the commit cannot fail the request: report
  the failed rows, as Publish does.
- `lib/email.ts`: `leagueTeamChangesHtml` (one block per changed child; coaches; the practice dates for a moved child onto a told
  team; the sign-up button while owing; invitation slots; second-parent copy handled by the existing `households` path with `own`
  = every changed child). `lib/house-league-placement-mail.ts`: `sendClaimed` gains a `changes` branch that reads the row's
  `changes` snapshot for each child's from-team; children no longer accepted or no longer on a team are not named (as today).
  The `moved` and `placed` branches stay.

### Part 5: The board read

`readDivisionBoard` gains `untold: { families, children, noEmail }` and each `BoardPlayer` gains `untold: boolean`; the tabs read
supplies each division's untold family count to the division picker's existing `waiting` count (currently `0`). Add the new
fields to the client type in `api.ts`. Re-check `house-league-board-notes-guard`.

### Part 6: The screen

- **Remove** `HeldMoveWindow`, the `held` act, the `published && !confirmed` client branch and the words that only they used
  (`W.move.confirm*`, `place*`, `foot`, `button`, `offTitle`, `offBody`, `offButton`, `working`, `emailFailed` if nothing else
  reads it); `place()` now simply posts and reloads. `rate.unplaced`'s "They're told when you place them" and
  `publish.after` are reworded (Part 1).
- **Add** `TeamChangesBanner` (the shipped `Callout tone="warn"`, action slot with the two buttons, directly under the published
  notice; renders nothing at 0 or without `rights.run`), `TeamChangesWindow` (`KitDialog` form kind: one row per family, chips,
  per-family switch, quiet line for quiet families, the no-email amber line, "See an example email", a `footerStart` sentence,
  Send button absent when all are off), the Don't email confirm (a small centred question dialog; the confirm repeats the verb),
  and the notice pill messages through the screen's existing `notice` state. The "Not told" chip goes on the player row (desktop
  and phone) where a row's state chip lives (not a dot, not on team cards).
- **Phone:** banner buttons under the words at 44px, same order as desktop; the review window fills the phone with its back arrow
  and a one-row foot; the per-family text button gets a 44px row.
- Reuse, do not rebuild: `Callout`, `KitDialog`, `NoticePill`, the practice window's `LeftOutLine` pattern. Register the window in
  the overlay guard allowlist if it requires it; keep the foot-text guard green.
- Reword the registrations screen's published-division refusal ("Move players on Teams & draft, where the family is told." →
  "Move players on Teams & draft.").

### Part 7: Docs, copy, walks

- `/docs` for `lib/help-content/house-league.tsx` (~430-431: "A move now asks first… Move and email", "Place them, and the family is
  emailed… Place and email") and the Email families passage.
- **Do not edit the live Family App walk (`SIGNED_IN_FAMILY_STAGE4A_WALK.html`, lines ~139, 146, 152, 211, 220, 269, 271, 340) or
  the 9c walk (`HOUSE_LEAGUE_STAGE9C_WALK.html` 144, 149, 154) while the owner is mid-walk**; after the build lands, rewrite the
  steps that name "Place and email" and the "ignore these three emails" workaround.
- Record in `HOUSE_LEAGUE_STAGE9_PLAN.md`: a note under §0f 9c·12 ("superseded by TC·1, 2026-11-10") and a status-log line. Add the
  copy to the `/marketing` pass queue.
- **`/legal` before handoff** (this changes what the product emails and records): it sends fewer emails, all still service
  notices; confirm the skip record and the consolidated email's contents need nothing more. Apply, or record as an owner question.

### Part 8: Checks and handoff

`npm run typecheck` (shared lib and types change); focused tests for every file touched; `npm run verify:changed`;
`npm run check:spelling`; `npm run check:dictionary`; the SQL check extended; `npm run check:layout -- --changed` on the Teams
screen at 4 widths (not a whole-product sweep on dev). **Restart the dev server** before handoff (new files, shared lib, types).
The owner does the browser walk. Offer `/simplify` (a new window and a new rule module), then `/review`, once each.

## Walk outline (for the walk-writing step; one purpose per walk)

A. After publish, drag three siblings to teams: no windows, no emails, the banner says 1 family, three "Not told" chips.
B. Review and email lists one family row naming all three; "See an example email" opens the example.
C. Send: one email arrives for the `+kids` address naming all three; the pill confirms; the banner and chips are gone; Email
   families shows "1 family emailed · by {you}".
D. Move a child to another team and back: no banner, or a banner whose window shows the quiet line only; no email.
E. Move a child twice (A→B→C): the email says "moved from A".
F. Don't email per family inside the window: that family is dropped from the send; the history row says "1 emailed, 1 not
   emailed".
G. Whole-banner Don't email: confirm, banner clears, history row "Not emailed (2 families)", Send again on a registration still
   emails.
H. A second parent's copy arrives; a late-accepted child placed after the others joins the next banner.
I. A failed send shows the existing "Send the {n} again" banner and resend works.
J. A viewer (registrar) and a finished season show no banner, chips or buttons.
K. Phone: banner buttons under the words, the review window full screen, every button 44px.
Fixture: the `+kids` family (Ava, Zane, Maya) with a published division; teardown in the walk.

## Files you will touch

New: `supabase/migrations/459_*.sql`; `lib/house-league-team-changes.ts` (+ test); `lib/house-league-team-changes-words.ts`;
`lib/house-league-team-changes-server.ts`; `app/api/admin/house-league/seasons/[seasonId]/team-changes/route.ts`;
`components/admin/kit/club/league/teams/TeamChangesBanner.tsx` and `TeamChangesWindow.tsx`.
Changed: `lib/house-league-teams.ts` (board read, `placePlayer` caller), `lib/house-league-placement-mail.ts`, `lib/email.ts`,
`lib/house-league-teams-words.ts` and `lib/house-league-teams-screen-words.ts`, `lib/families-emails-log.ts`,
`components/admin/kit/club/league/teams/{TeamsScreen.tsx,MoveWindow.tsx,TeamsBoard.tsx,api.ts,Teams.module.css}`,
`app/api/admin/house-league/seasons/[seasonId]/placement/route.ts`, the registrations route's refusal line,
`lib/help-content/house-league.tsx`, `docs/agents/db/DATA_DICTIONARY.md` + snapshots, `scripts/house-league-teams-check.sql`,
`supabase/migrations/MANUAL_PROD_STEPS.json`, the plan files named in Part 7, `TODO.md`.
