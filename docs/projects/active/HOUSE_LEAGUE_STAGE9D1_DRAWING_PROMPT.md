# Club Tier Stage 9d-1, House league "One email composer": draw it (prompt)

> **Written 2026-10-26**, the day 9c's walk (§381) passed 42 of 42 and the owner split 9d into **9d-1 (one email composer)**
> and **9d-2 (the schedule)**. **Paste this into a new chat on `dev`.** Other sessions share this working copy (TODO, the Club
> plan, the plan, the PM brief and the QA ledger carry their edits): stage explicit paths only, and commit only your own hunks.
>
> **This is a drawing session, not a build.** No product code, migration, seed, help article or demo change.

## What 9d-1 is, and what is already ruled

9d-1 is the fifth rung of the Stage 9 ladder (`docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md` §4): **a season's email to
families moves onto the club's one composer and its batched sender.** It goes before the schedule (9d-2) because the
schedule's change notices send through it. 9a, 9b-1, 9b-2 and 9c are built and walked (§372, §375, §378, §381).

**Ruled, do not reopen** (record each as ruled and add nothing it did not rule). Source: plan §0b, §0c.
- **Q12b, one composer:** the Families window, **opened from the season already set to it**; division / team / status /
  "Selected" audiences; the season's old Notifications page and the "Message registrants" window retire; **the season keeps
  its own sent history** (because the registrar has no Families access).
- **Q12c, the cap:** automatic notices never count toward a cap. **Each season has its own 3 typed sends a day.** Club-wide
  sends keep the club's 3.
- **9a build (§0c):** Email families **stays open on a finished season** for the people who may email it. A note to families
  is not a change to the season's record.
- **Q17:** the people who may email a season are the runners plus the registrar. The treasurer reads Money and does not email.
- **9c·4 / 9c build:** placement and move emails go through the batched sender's **service** mode, reach a family who
  unsubscribed from club news, and never count. Leave them alone; draw them only where they appear in a history.

## The facts the drawing rests on (from a census on 2026-10-26; re-verify each against the code before drawing on it)

| Fact | Where to look | Consequence for the screen |
|---|---|---|
| **There are three composers today, not two.** "Message registrants" is already gone (a test asserts it). Registrations has its own **Email window** (row ⋯ = one family, bulk bar = Selected, Tools › Email families = whole season), and it **already offers All / By division / By team / By status.** The season's rail page "Email families" offers All active / Waitlist / Pending review with a preview, then a "Sent history" table. | `components/admin/kit/club/league/registrations/EmailWindow.tsx:116-153`; `RegistrationsScreen.tsx:409,473,607,783-794`; `app/[orgSlug]/admin/house-league/seasons/[seasonId]/notifications/page.tsx:26-32,341-379`; `tests/unit/house-league-season-frame.test.ts:117` | Draw "today" from the real screens. The ruled audiences mostly exist already, on the **season's** window. What the season side lacks is the Families engine. Push-back 1. |
| Both season composers post to one route that sends **one email per registration in a loop**: no batches, no lock, no cap. It de-duplicates by guardian email only for Selected, so **two siblings get two emails** for every other audience. The log is `league_email_log` (Sent / Skipped). | `app/api/admin/house-league/seasons/[seasonId]/email/route.ts:47-183`; `lib/db.ts:2664-2696` | The family-side change is **one email per household**. Draw what a family with two children in one season receives, before and after. |
| ⚠ `league_email_log` has **no CREATE TABLE in the migrations** (plan §3 trap). | the dev and prod schema snapshots, not the migration files | The season's existing history has to go somewhere. Ask 3. |
| The Families window sends in batches of 100, **one email a household** (every unsubscribed guardian address excluded, the sender never a recipient), with an unsubscribe link. It logs to `family_email_sends` and shows "Reached x of y" with Sending / Stopped on Families › Emails. | `components/admin/kit/club/families/EmailFamiliesWindow.tsx`; `lib/families-audience.ts:11-23,107-153`; `lib/family-email.ts:215-254`; `lib/families-emails-log.ts` | This is the engine Q12b means. Its log never reads `league_email_log`. |
| ⚠ **Families is grant-only for every role, admin included.** `module_families` is in no role's defaults (the owner's 2026-08-17 decision, pinned by a test). Season email today is owner, admin, league admin, registrar. | `lib/roles.ts:31-37,59-61`; `lib/families-auth.ts:33`; `lib/house-league-access.ts:44-47` | **Load-bearing.** "The composer is the Families window" must not mean "you need Families to email a season." Push-back 2. |
| ⚠ The Families **season audience reaches only `registration_open` and `active` seasons.** It cannot reach draft, registration closed, completed or archived seasons. The gate's own comment admits this. | `lib/families-audience.ts:35-36`; `lib/families-read.ts:1019`; `lib/house-league-access.ts:24-28` | The ruling keeps email open on a finished season, and a closed-registration season (between sign-up and play) is exactly when a convenor emails most. The season door must reach **every** status. |
| **The cap is club-wide.** It counts every `family_email_sends` row for the org in a rolling 24 hours (3), plus a 60-second double-press guard. The row has a `season_id`, but the cap ignores it. A send that reached nobody gives its slot back. | `supabase/migrations/347_the_club_can_email_every_family.sql:75-104`; `lib/families-words.ts:332`; `lib/families-email.ts:203-207` | Q12c needs **two allowances** on screen: the season's 3 and the club's 3. Draw what each counter says and where, and what a refusal says (with the time the next send can go). |
| The "green 0 delivered" defect is live: the rail page shows "Email sent — {n} delivered" on a green banner whatever n is, including 0. Registrations' window says "Sent to 0 guardians." as a normal notice. | `notifications/page.tsx:240-256`; `lib/house-league-money-words.ts:543` | Draw nobody-matched, everyone-opted-out and a partial send honestly. A send nobody can receive should not be offered at all ("absent beats disabled"). |
| The rail page is **dual-look** (old buttons and HelpCallout behind the kit switch). The Email window, the Families window and Families › Emails are native kit. | `notifications/page.tsx` | The rail entry "Email families" retires its old page. Draw what the rail entry opens afterwards. |
| Automatic family email that is **not** a typed send: sign-up confirmation; approved / waitlisted / declined / withdrawn / released; waitlist promoted; price-change refund; Email the pay link (staff, one family); placement and move (service mode). | census §5; `lib/email.ts:907-1143`; `lib/house-league-placement-mail.ts` | None of these counts (Q12c). Decide which appear in the season's history (ask 4). Do not redraw them. |

## Read first

`AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (broad reading goes to a helper; a helper's summary is a lead, so open the cited
lines yourself; disagree out loud). The plan §0b, §0c, §3 (the `league_email_log` trap and the green "0 delivered"), §4, §6a
(where Q12b/Q12c were argued). The Families book plan's email part (`CLUB_FAMILIES_BOOK_PLAN.md`, Stage 7c) for why the cap
and the household rule exist. The drawings you follow in shape and frame rules: 9c's
https://claude.ai/artifact/C56VdDqASJ4x53EoFWZjyk (source `HOUSE_LEAGUE_STAGE9C_DRAWINGS.html`) and the deep-dive hub
https://claude.ai/artifact/UtrYHLaqbkfQQC2kBbGEQ7. House rulings in the auto-memory index that touch these screens: mockups
are Claude Artifacts at true size, whole-screen before/after; a window's foot has the sentence left and the buttons right; a
change that tells families is held until ✓ (edit autosaves, create asks); one toolbar with rare tools behind Tools; a waiting
count is the amber pill; a phone's secondary action is its symbol alone; absent beats disabled; every highlight is
clickable; one spelling, "8:00 a.m.". Check each against the code before drawing on it.

## Push back (out loud, on the drawings page, before the work)

1. **"The Families window" may be the wrong noun; the ruling's target is one engine.** The season's own Email window already
   has the ruled audiences. What it lacks is the Families engine: households, batches, the cap, the log, honest results.
   Draw the honest options and recommend one: (a) the Families window learns the season audiences and opens from the season;
   (b) the season's Email window keeps its face and sends through the Families engine; (c) one shared window both doors
   open. Either way, a person must never see two different composers for one club. Name what each option costs the
   registrar, the convenor and the next stage (9d-2's change notices).
2. **A season door must not need Families.** Families is grant-only, even for an admin. Recommend that opening the composer
   from a season is gated by **the season's email gate** (runners + registrar, finished seasons included) and shows **only
   that season's families**: no Families book, no other season, no club-wide audience. Say plainly what an admin without a
   Families grant sees after 9d-1 (it must not be less than today), and what a registrar who *was* granted Families sees
   (both doors, each scoped as it is).
3. **The season's history vs the club's log.** One send, two places to read it. Recommend where a season send shows (the
   season's history for certain; Families › Emails too?), and what the season history shows for sends made **before** 9d-1
   in `league_email_log` (ask 3). Don't let a season's history become a second Families log.
4. **The allowance is two counters a convenor will confuse.** Each season has 3 a day and the club has 3. Draw where each is
   read, whether a season send ever touches the club's 3 (ruled: no), and what a convenor running two live seasons sees.
   Then say whether a **one-family** email (the row ⋯) is a typed send that counts. Today Families treats a one-family message
   as its own thing. Recommend, don't assume.

## What to produce

1. **One published Artifact** (source `docs/projects/active/HOUSE_LEAGUE_STAGE9D1_DRAWINGS.html`; load `artifact-design`
   first), in the shape of the 9c drawings: before = today's screens from the real pages; after = drawn at **true size**, a
   desk and a phone for each frame; NEW / RESTYLED / UNCHANGED tags; clickable flags; one checkbox per option for each ask; a
   paste-back summary at the end.
2. **Frames:**
   - (a) **Today:** the rail page, Registrations' Email window from its three doors, and Families › Email families.
   - (b) **The composer opened from a season:** the whole season, a division, a team (only once that division is published,
     as today's route already rules), a status, Selected from the bulk bar, one family from a row. Show the preview and who
     it reaches, counted in **households** and children.
   - (c) **Held until ✓:** the send window's foot, the allowance sentence, and the refusal when the season's 3 are spent,
     naming when the next can go.
   - (d) **Results:** sent, partly reached, nobody reachable (and whether Send is offered at all), everyone opted out, and
     Stopped mid-batch.
   - (e) **The season's sent history** (what the rail's "Email families" opens now): typed sends, plus any automatic notices
     ask 4 admits, the old `league_email_log` rows per ask 3, and an empty season.
   - (f) **Families › Email families and Families › Emails** after 9d-1: what changes, if anything, for a club-wide sender.
   - (g) **Status edges:** a draft season (no families), registration closed, active, completed and archived (still open per
     §0c), and two live seasons side by side.
   - (h) **The gate:** the 9a who-can-do-what table with the email column restated per door (season door vs Families door) for
     owner, admin without a Families grant, league admin, registrar, registrar with a Families grant, treasurer, and coach.
   - (i) **The family's side:** what a household with two children in the season receives, before and after (one email
     naming both, or one email as typed?), and the unsubscribe footer on a typed send.
3. **Words:** provisional, marked provisional. Final words go through `/marketing` **after the owner rules**, before any code
   (house rules: sentence case, "8:00 a.m.", the bare possessive, `npm run check:spelling`).
4. **Flow + design:** run `/ux` on the journeys (convenor, registrar without Families, owner with both doors, family: who,
   where, how long, what goes wrong). Run `/design` on the whole page **before the hand-off**, apply its fixes, republish, and
   report what it changed.
5. **Asks:** numbered, each with a recommendation. Ask 1 = which composer (push-back 1). Ask 2 = the season door's gate
   (push-back 2). Ask 3 = the old history's fate. Ask 4 = which automatic notices the season history shows. Ask 5 = does a
   one-family email count. Then any the frames raise.
6. **Build notes, not asks** (put them on the page so the build prompt carries them): the per-season count needs the cap
   function to read `season_id` (a migration); `league_email_log`'s real shape comes from the snapshot; the season send must
   reach every season status, so it cannot reuse `isCurrentLeagueSeason`; retiring the rail page and the route's
   per-registration loop; 9d-2's change notices will call this path.
7. **Records, same unit of work:** the plan's §4 9d-1 row and status log ("drawn, asks open", the link), the PM brief, the
   `s9` entry in the Club Tier project index (artifact `MBKRySURVFu3V9cZJvmjVr`: read `stages/s9` first, pin `if_version`,
   say `ruled` only after the owner rules), and the auto-memory file `project_club_stage9_house_league.md`. Record rulings as
   ruled.

## Do not

- Build, migrate, seed, or touch AWS or DNS.
- Reopen Q12b, Q12c, §0c's finished-season email, Q17, or 9c's service-mode notices. Push back only where a frame exposes a
  real conflict, and name the conflict.
- Add `module_families` to any role's defaults, or draw a season door that grants the Families book. That is a standing owner
  decision.
- Draw the schedule, Publish schedule or change notices (9d-2), game day (9e), or season end (9f).
- Restate a plan name, price or gate: point at `docs/agents/strategy/PLAN_PRICING_FACTS.md`.
- Promise timing anywhere.

## Definition of done

The drawings page is published and linked from the plan. `/ux` and `/design` have run and their changes are reported. Every
frame in item 2 is drawn in its empty, working and edge states. Asks 1–5 are answered with a recommendation. The records say
"drawn, asks open". A 9d-1 build prompt can be written from the owner's answers without re-deciding anything.
