# Club Tier Stage 9d-1: one email composer (build prompt)

> **Written 2026-10-26**, the day the owner ruled all twelve 9d-1 asks as recommended (plan §0g). **Paste this into a new chat
> on `dev` and re-verify every lead first.** The leads below were read in the code during the 9d-1 drawing session
> (2026-10-26), with file and line where it helped, but code moves: re-open each before building on it. Other sessions share
> this working copy (Stage 12, the support console, bookkeeping): stage explicit paths only, commit only your own hunks, use a
> temporary index when a file is shared (memory: "Partial commit out of shared files").
>
> **Recommended model: Opus 5.5** (a send path every family email will use, a cap migration, an access door for the registrar,
> and the path 9d-2's schedule notices will call). Helpers stay on Sonnet as configured.
>
> 9d-1 is built in **parts, each committed locally after its own checks**. Part 1 (data) and Part 2 (the engine) are the base.

## What 9d-1 makes true

A house-league season has **one way to email its families**, and it is the club's own: the Families window's face, opened from
the season, listing only that season's families. A convenor or registrar picks **everyone in the season, one or more
divisions, one or more published teams, one or more statuses, the families they ticked on Registrations, or one family**, and
the window counts **families**, with children beside them, so siblings get **one email**. It sends through the Families engine:
batches of 100, the double-press guard, the unsubscribe list and link, and an honest result ("Reached 8 of 10 families", naming
who it missed). Each season has **its own 3 typed emails in any 24 hours**, shown in the window's foot and on the season's
page; a message to one family never counts. The rail's **Email families** opens the season's **sent history**: typed sends,
one-family messages (no words), automatic notices sent to many families at once (Publish teams), and the old history read-only
under "Earlier sends · counted per child". The season's old page, the Registrations Email window and the per-child send loop
are gone. Families keeps its window and the club's 3; its season choice reaches every season with families and counts toward
that season; Families › Emails lists season sends with the season named.

## The rulings (do not reopen; record nothing they did not rule)

**Already ruled before the drawings:** Q12b one composer, opened from the season already set to it, division / team / status /
"Selected" audiences, the old page and "Message registrants" retire, the season keeps its own sent history (the registrar has
no Families access) · Q12c automatic notices never count, each season has its own 3 typed sends, club-wide sends keep the
club's 3 · §0c email stays open on a finished season · Q17 the people who email a season are the runners plus the registrar ·
9c·4 and the 9c build: placement and move emails go through the batched sender's **service** mode and never count.

**§0g, owner 2026-10-26 (all twelve as recommended):** 9d1·1 one window, two doors; the door decides the Who list; the season's
old page and Email window are deleted · 9d1·2 the season door is gated by the **season's email gate**, every status, that
season's families only; **Families stays a grant and is never needed for a season** · 9d1·3 old history read-only under
"Earlier sends · counted per child", saying where the audience wasn't recorded; nothing converted; nothing writes the old log
again · 9d1·4 the season history shows notices to many families at once (Publish teams now, 9d-2's schedule notices later), one
row each, tagged Automatic; one-family status emails stay off it · 9d1·5 a one-family email never counts and has the club's
limit of 3 a day to that family; its row keeps date, sender and family, never the words; ticking two or more families counts ·
9d1·6 the allowance follows the audience: a season picked from Families counts toward **that season's** 3; the picker lists every
season with families, any status; divisions, teams and statuses stay on the season's door · 9d1·7 Families › Emails lists
season sends with the season named; the season page lists only its own · 9d1·8 the allowance is always shown, in the foot and
the page subtitle, on the club's door too; the refusal names the time · 9d1·9 "Copy the team's coaches" offered on a team
audience, unticked; a copied coach isn't counted as a family · 9d1·10 "Send to the N it missed" on a stopped send: same words,
not counted, also listed on Families › Emails · 9d1·11 a season send's footer names the season · 9d1·12 **any 24 hours**, the
club's rule, one engine counts both (9d1·8's example "left today" is superseded; /marketing words it).

**Drawn but not asked (build as drawn, from /ux and /design):** "See who gets it" under Who; the opted-out families said in the
foot before Send; the recount state ("Who this reaches changed while you were writing…"); the discard ask on × with words
typed (today's Registrations words); the refusal shown when the window opens on a spent allowance, before typing; one-family
and ticked results; a zero-count status or team left out (absent beats disabled); a finished season's "Everyone" = families
whose child was active when it finished; Families › Emails' Season filter; a desk window keeps held messages and results in
the foot as Families does today, a phone window ends its body with them.

## Read first

`AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (broad reading goes to a helper; a helper's summary is a lead, so open the cited
lines yourself; disagree out loud). The plan `HOUSE_LEAGUE_STAGE9_PLAN.md` §0g, §0c, §3 (the `league_email_log` trap) and the
9d-1 status-log entry. The drawings https://claude.ai/artifact/Xy8ENL1KbUZVbWpDthD9EB (source
`HOUSE_LEAGUE_STAGE9D1_DRAWINGS.html`): every frame, the reviews card, the build notes card. The Families book plan's Stage 7c
(`CLUB_FAMILIES_BOOK_PLAN.md`) for why the household rule and the cap exist. Memory: "Edit autosaves, create asks", "A window's
foot", "Absent beats disabled" (the disabled-btn ruling), "Every highlight is clickable", "One spelling", the clock rule.

## Leads to re-verify (read in the code 2026-10-26)

| Lead | Where | Why it matters |
|---|---|---|
| The season route sends **one email per registration** in a loop (`sendFamilyEmail`), de-dupes by address only for `selected`, honours the suppression list, adds the unsubscribe link, footer reason "you have a registration in {season}", logs one `league_email_log` row (`scope`, `audience` = the bare word for division/team/status, `count_sent`, `count_skipped` = no address + failure + suppressed) | `app/api/admin/house-league/seasons/[seasonId]/email/route.ts` (~47-186), `lib/db.ts` `insertLeagueEmailLog` / `getLeagueEmailLog` | Part 4 deletes the POST loop and the log writes; GET (or its reader) survives only to read "Earlier sends" |
| "By team" lists every team; an unpublished division's team is refused with 409 **after** Send; the team count/send includes declined and withdrawn children | `EmailWindow.tsx:59`, `route.ts:79-88` | The new team list = published divisions only, active children only |
| Registrations' three doors: row ⋯ "Email this family" (`:409`), bulk "Email" (`:473`), Tools › "Email families" (`:607`), all behind `rights.email` (`:597`); the window `:783-794` | `components/admin/kit/club/league/registrations/RegistrationsScreen.tsx`, `EmailWindow.tsx` | The doors stay; the window they open changes |
| The rail entry is `SEASON_PAGES` key `notifications`, gated by `access.email`; the page is dual-look | `lib/house-league-season.ts:21-44`, `app/[orgSlug]/admin/house-league/seasons/[seasonId]/notifications/page.tsx` | Becomes the season's sent history; the segment can stay `notifications` (a rename is a route change: decide, and redirect if renamed) |
| The season email gate: `email: desk` = owner, admin, league_admin, league_registrar, every status | `lib/house-league-access.ts:44-47, 101` | 9d1·2: the season door's gate. Never `canOpenModule(…, 'module_families')` |
| Families is grant-only: `module_families` in no role's defaults; the gate refuses team-limited members | `lib/roles.ts:31-61`, `lib/families-auth.ts:33` | Do not add it to any default; do not route a season send through the Families gate |
| The club send: `sendFamilyEmailToClub` = parse scope → `loadFamilyAudience(…, { attach: true })` → `familyAudience` (households, suppressed, sender removed) → the `expected` count must match (`changed`) → `family_email_claim` → `sendFamilyEmailBatch` with `onBatch` progress → a send that reached nobody deletes its claim | `lib/families-email.ts:141-215` | The one engine. The season door must call the same path, not a copy of it |
| The audience's league facts per person are `{ seasonId, seasonName, current }` only, `current` = `registration_open` or `active` | `lib/families-read.ts:~1019`, `lib/families-audience.ts:35-36` | The season door needs **division, team, registration status** per child and **every** season status. `current` must keep its meaning for "Every family" (unchanged) |
| The claim: per-club advisory lock; refuses `just_sent` within 60 s of the club's last send; counts every row of the org in 24 h against `v_cap` = 3; writes the row with `season_id` (stored, never counted) | `supabase/migrations/347_the_club_can_email_every_family.sql:73-117`; `CLUB_EMAIL_CAP` in `lib/families-words.ts:332`, held equal by `tests/unit/families-email.test.ts` | Part 1's migration |
| `family_email_sends` keeps **counts only** (`family_count`, `reached_count`, `failed_count`, `opted_out_count`, `status`), no per-family outcome | the dev/prod column snapshots | 9d1·10 needs to know who was reached (argument 3) |
| The one-family message: per **person**, `family_message_claim` (mig 334), its own 3 a day per family, `family_messages` = org, person, sender, time (no season, no words) | `app/api/admin/families/[personId]/message/route.ts`, `supabase/migrations/334_*.sql` | 9d1·5: the season's one-family door reuses it; the season history needs the season on the row |
| Placement / move emails: `league_placement_emails`, one row per family (`kind` placed / moved, `division_id`, `created_at`, `status`), sent in service mode | `supabase/migrations/377_house_league_teams_and_people.sql:139-161`, `lib/house-league-placement-mail.ts` | 9d1·4's Automatic rows: a Publish is many rows with nothing marking them as one act (argument 4) |
| Families › Emails: columns Sent · Subject · To · By · Reached; "Stopped" = still sending after 15 minutes; no Stop control | `components/admin/kit/club/families/EmailsTab.tsx`, `lib/families-emails-log.ts` | The season history reads the same record; add the Season filter |
| The footer: `familyEnvelopeFooterWords(sender, reason)`; the club reason is `FAMILY_MESSAGE_REASON` | `lib/family-mail-footer.ts:75`, `lib/families-words.ts:19` | 9d1·11: the season reason |
| `league_email_log` has **no CREATE TABLE in the migrations**; its shape is in the snapshots (`id, org_id, season_id, sent_by, sent_at, subject, scope, audience, count_sent, count_skipped`); dev has **0 rows** | `docs/agents/db/schema-snapshots/schema-dump-columns-{dev,prod}.json`; `DATA_DICTIONARY.md` `league_email_log` | Read it; never migrate or drop it in 9d-1. Count prod's rows read-only before Part 5 |
| A guard already proves "Message registrants" is gone | `tests/unit/house-league-season-frame.test.ts:~117` | Extend it to the retired window, page and loop |
| The fixture: Dev House League 2026 (active) 11 active children / **10 families** (Ava and Henry Kim share one), 1 to review (Maya Singh), 7 ended; Draft Test 2027 (`registration_closed`) 120 / 101; Dev House League 2027 (`registration_open`) 5 / 3 (the Test family has three); 2025 completed, empty; "test season" draft | dev DB, `.probe/hl/q9d1.mjs` | The walk's numbers |

## Things to argue before building (disagree out loud)

1. **One engine, two scopes, and the season audience built from the Families world.** Recommended: the season door's audience
   comes from the same people-and-households load as Families (so a household is the same household from either door), with
   each person's league facts widened to carry the registration's status, division and team, and **no** `current` filter on
   the season door. "Everyone in the season" = families with an active child (on a finished season, a child who was active when
   it finished); a team = active children on a team of a **published** division; a status = the four tab statuses (Active,
   To review, Waitlist, Ended = declined + withdrawn). A registration with no linked person is attached first (`attach: true`,
   as the club send does), or a hand-added child silently drops out.
2. **The claim counts by bucket, and the double-press guard is per bucket.** Recommended: one migration replaces
   `family_email_claim`'s count with a bucket: a row with a `season_id` counts toward that season (any door, 9d1·6), a row
   without counts toward the club. The 60-second `just_sent` guard looks at the same bucket (today it is club-wide, so a convenor
   and a club admin a few seconds apart refuse each other). The lock can stay per club. The "reached nobody gives the slot back"
   rule stays. Keep `CLUB_EMAIL_CAP` and the function's `v_cap` equal (the test holds them); a season's cap is the same number,
   one constant. The window's allowance line needs a read of "used in the last 24 hours, and when the oldest falls off" per
   bucket: add it to the preview, not a second query path.
3. **"Send to the N it missed" needs a per-family outcome, which nothing records today.** `family_email_sends` keeps counts.
   Recommended: a small recipients table (send, household key or person, the addresses tried, status sent / failed / opted
   out), written as each batch returns, read by the stopped row's window to resend to the families with no `sent`. The retry is
   the **same send** (same row, same words, never a new claim, never counted), and its result updates the counts. This table is
   also what lets the row window and the result name who was missed (drawn) and who opted out. Data about who was emailed:
   RLS on, service role only, as its siblings.
4. **Automatic rows need one record per act.** A Publish writes one `league_placement_emails` row per family, with nothing
   marking them as one Publish (a late placement is the same `kind`). Grouping by timestamp is fragile. Recommended: a season
   notices record (season, kind = `teams_published` now and 9d-2's kinds later, division, family count, reached / failed,
   created_by, time) written by Publish in its transaction and updated by its send, which the history reads. Moves and a single
   late placement are one family each: off the history (9d1·4). 9d-2's schedule notices write the same record. Do not put
   automatic notices into `family_email_sends`: 9d1·7 makes that the book of typed sends.
5. **The one-family message carries the season.** Reuse `family_message_claim` (per person, its own 3 a day, never the
   season's count). Add a nullable season to `family_messages` so the season's history can list "A message to this family"
   (never the words). Ticking one family, or two children of one family, is this path; ticking two or more families is a
   season send. Confirm the unsubscribe list governs a one-family message as today; the held sentence must match.
6. **The words follow 9d1·12, not 9d1·8's example.** "Today" is wrong under a rolling 24 hours ("2 of this season's 3 emails
   left today" would be a lie at 11 p.m.). /marketing settles the sentence; the refusal keeps "The next can go at {time}" in
   the house clock (`formatTime`).
7. **Families' "Every family" does not change.** Its definition (families with a child on a live team or in an open season)
   was not ruled on here. Only the "A house league season" picker widens to every status (9d1·6).

## Before any code

1. **The product-manager UX summary** (AGENCY_RULES, blocking), plain words: what the convenor, the club admin with and without
   a Families grant, the registrar, the treasurer and a family see differently; the per-door gate table; the seven arguments
   above. Get the owner's yes.
2. **The words.** Run `/marketing` on the drawings' provisional words before code and write `HOUSE_LEAGUE_STAGE9D1_COPY.md`:
   the Who rows and their counts, "See who gets it", the allowance line under 9d1·12 (window foot, page subtitle, club door),
   the refusals (season, club, one family), the recount line, the results (all reached, partly, none, couldn't tell, one
   family, ticked), the history (columns, "A message to this family", the Automatic tag and its window, the "Earlier sends ·
   counted per child" divider, "which one wasn't recorded", "not sent"), the stopped row and "Send to the N it missed", the
   Families picker's "Counts toward {season}'s 3…" line and the club refusal's added sentence, "Copy the team's coaches", the
   season footer, the empty and no-families states, the finished-season note. House rules: sentence case, the bare possessive
   (`possessive()`), "8:00 a.m.", "emails" never "sends" on a screen, `npm run check:spelling`.

## What to build, in parts

**Part 1 · Data.** One additive migration (next number after the highest in `supabase/migrations`, **384** when this was
written; another session took a number the same hour twice this month, so `ls` right before creating it): the claim counted
and guarded by bucket (argument 2); the recipients table (argument 3); the season notices record (argument 4); a nullable season
on `family_messages` (argument 5). `DATA_DICTIONARY.md` in the same unit (including that `league_email_log` is now read-only
history) and `npm run refresh:snapshots`. Add the migration to the end of `MANUAL_PROD_STEPS.json`. Prove the claim with a
SQL check: two seasons and the club each take 3 in 24 hours; a 4th in one bucket is refused with the next time; a press in one
bucket doesn't trip another's 60 seconds; a send that reached nobody gives its slot back.

**Part 2 · The engine.** The season scope in the audience (argument 1) as pure, tested functions beside `familyAudience`
(everyone, divisions, teams, statuses, selected registrations; households once; sender out; suppressed counted, not sent); the
send path shared with the club send (one function, the scope decides the bucket, the footer reason and the label); the
recipients written per batch; "Send to the N it missed"; "Copy the team's coaches" from 9c's team–coach rows with an address,
each once, never counted as a family; the one-family path through `family_message_claim` with the season. The season door's
route is gated by `houseLeagueRefusal(ctx, 'email')` and the season scope check (`lib/league-season-scope.ts`), **never** the
Families gate; the Families route keeps its gate. Tests: siblings once, a two-guardian household once, an ended child not in a
team audience, an unpublished team refused, a finished season reachable, a registrar without Families allowed, a treasurer
refused, a season send never touching the club's count.

**Part 3 · The window.** The Families window takes its audience from its door: the season door passes the season and gets the
season's Who list (frame b); the Families door keeps today's list with the season picker widened (frame f). Build every frame
on the drawings' "The window" and "Sending & results" tabs: the allowance line, the refusal on open, the recount, the discard
ask, See who gets it, See the email, Last sent (this season's), the results, the held states, the phone full-screen window.
Absent, not disabled: no Send when nobody is reachable; zero-count statuses and teams left out.

**Part 4 · The doors, and the retirement.** Registrations' three doors open the new window (row ⋯ = one family; bulk = the
ticked families, or one family when they are one household; Tools = the whole Who list). The rail's Email families becomes the
season's sent history (Part 5). Delete the Registrations `EmailWindow`, the old page's composer and preview, the route's POST
loop and every write to `league_email_log`, and the words only they used ("Sent to {n} guardians.", "Email sent — {n}
delivered"). Extend the season-frame guard: the window, the loop and the writes are gone, and nothing outside the history
reader names `league_email_log`.

**Part 5 · The history and the Families side.** The season's sent history on the kit (frame e): the subtitle allowance, Email
families as the one primary button, typed sends and one-family rows from the club's record, Automatic rows from the notices
record, "Earlier sends" from `league_email_log` read-only (hidden when the season has none), the row window (words for typed
sends, names for missed and opted-out families, "Send to the N it missed" on a stopped send), the empty and no-families states,
the phone list. Families › Emails lists season sends with the season named and gains the Season filter (All · Club-wide · each
season); its refusal adds the sentence about each season's own 3. Publish teams (9c) writes the notices record.

**Part 6 · Help.** `/docs`: the house-league email guide (one window, who it reaches, the season's 3 in any 24 hours, what
doesn't count, the history) and the Families email guide (the season picker, which allowance a send uses, season sends on the
Emails tab). Search keywords in the one spelling.

## Definition of done

- Parts 1–6 committed; `npm run verify:changed` and `npm run typecheck` clean; the audience, claim and send tests pass; the
  existing guards stay green (`house-league-gate-guard`, `league-season-scope-guard`, `house-league-season-frame`,
  `club-stage5c-families-guard`, `families-email` with its cap equality).
- `/review` on Parts 1–2 (the cap, the access door, the send) and on the whole; findings fixed or recorded.
- `check:layout --changed` on the season's Email families and Registrations if the UAT fixture renders them (it has not for
  house league since 9a; say so if it still doesn't).
- **The 9d-1 walk**: a checkable Artifact and the next § in `OWNER_QA_LEDGER.md` (check the last number), one purpose per walk.
  Cover: the rail page on 2026 (history, subtitle allowance); a whole-season send (10 families, 11 children; the Kims once);
  a division, a published team, an unpublished division's team (said up front), a status, ticked families (and two Kim children
  ticked = one family); a one-family message (doesn't count; history row without words); the allowance going 3 → 0 and the
  refusal with its time, then a one-family message still going; two live seasons each with their own 3; Draft Test 2027
  (Registration closed, 101 families, two batches); a completed season; the registrar without Families (every door works, no
  Families anywhere); the treasurer (no door); a club admin granted Families picking a season (counts toward the season, not
  the club); Families › Emails (season rows, the filter); the Automatic row after publishing a division; "Earlier sends" if any
  old rows exist on the walk database. Dev sends no email: say which steps read the history instead of an inbox.
- The plan's status log and §4 updated; the PM brief updated; a news row on the Club index (`ArtifactData`, artifact
  `MBKRySURVFu3V9cZJvmjVr`, stage `s9`; read it first and pin `if_version`); memory `project_club_stage9_house_league.md`.

## Carried in, not yours to build

- **9d-2** calls this engine for schedule change notices as automatic, writing the notices record; it never touches the cap.
  **9e**'s rainout is an automatic notice too.
- **Stage 13** (the rail's top level, the phone bar, the More sheet) and **Stage 14** (one player across seasons).
- **Prod:** the pending migrations in `MANUAL_PROD_STEPS.json` go in their order and yours joins the end. No
  promote.

## Do not

- Require, grant or default `module_families` for any season door or role. Route a season send through the Families gate.
- Keep a second composer, a second send loop, or any write to `league_email_log`. Convert, migrate or drop `league_email_log`.
- Count an automatic notice, a one-family message or a finished stopped send toward any allowance. Put automatic notices in
  `family_email_sends`.
- Change Families' "Every family" definition, the placement / move emails' service mode, or the one-family limit's number.
- Build 9d-2 (the generator, Publish schedule, change notices), 9e, 9f, a Stop button, or a bounce line (the product cannot see a
  bounce).
- Say "today" for a rolling 24 hours, or "sends" on a screen. Reopen a ruling. Push or promote.

## Git

`dev` only. Explicit pathspecs; `git show --stat HEAD` after every commit; a temporary index when a file carries another session's
hunks. Part 1 may be committed alone once its SQL check passes. No push and no promote without the owner's word.
