# Club Tier Stage 14 · One player across seasons: build it (build prompt)

> **Written 2026-11-04**, the day the drawings were published and the owner ruled **all 14 asks A** (as recommended).
> **Paste `execute @docs/projects/active/CLUB_TIER_STAGE14_BUILD_PROMPT.md` into a new chat on `dev`.** It resumes from the
> **Progress** block: run the first session marked *Not started*, then stop and hand off. **One session per chunk**: six
> sessions, S1–S6, each ends with its own checks, offers and (where it changes a screen) its own walk.
>
> **Binding, do not reopen:** the 14 rulings (plan `CLUB_TIER_PRODUCTION_READINESS_PLAN.md`, Stage 14, the "📐 Drawn 2026-11-04 ·
> ⚖ RULED" note, ~line 3133) and the 2026-10-22 ruling that *Start next season* asks (a) same players moving up / (b) a new group.
> Ask 9 (privacy) is an owner ruling with **counsel's read parked until after the project**: build it as ruled, do not block on
> counsel, and do **not** switch the guardian tier on. CLAUDE.md's coaches-portal season rule stands: no season dial, no read-only
> branch, a finished season is the one closed-season page.
>
> **Read first, in this order:** (1) the plan's Stage 14 section (the 14a–14d items, the drawn/ruled note, the census corrections,
> the side findings, the build notes); (2) the drawings https://claude.ai/artifact/YRZjgsXZwkeNPnGmpPAapN (source
> `docs/projects/active/CLUB_TIER_STAGE14_DRAWINGS.html`, **version 2** is what was ruled); open only the tab your session builds;
> (3) `docs/agents/db/DATA_DICTIONARY.md` for the tables your session touches (decide columns from the snapshots, never from
> migration files); (4) `tests/unit/coach-history-endpoint-guard.test.ts` header (S3); (5) `CLUB_FAMILIES_BOOK_PLAN.md` ~442–471
> (the "confirmed, not inferred" rule and why continuity links are not the child seam).
>
> Other sessions share this working copy (billing, house league, public tournament pages, family accounts). Re-verify every lead
> below before building on it — a helper's summary, and this prompt, are leads, not evidence. Stage **explicit paths only**, commit
> only your own hunks, check `git diff --cached --name-only` before every commit, **commit only when the owner says**, on `dev`.
> **Migrations:** `ls supabase/migrations` first; the highest on 2026-11-04 was **433**. Each migration lands with its dictionary
> lines, `npm run refresh:snapshots`, a `MANUAL_PROD_STEPS.json` entry (`pending`) and `npm run check:dictionary`; dev only, prod is
> the owner's step.
>
> **Recommended model: Opus 5.5.** Before any code in a session, present the Product-Manager UX summary for that session and a task
> list (blocking, per AGENCY_RULES). Reading and searching go to helpers (Sonnet). Update the Progress block after each Part.

## ▶ Progress (read first when resuming)

- **2026-11-04 · Not started.** Facts below were read from the code on 2026-11-04 by five helpers, and each one this prompt relies on
  was opened at the cited lines by the author. Line numbers drift; re-check them.
- **S1 · the season window (14a)** — **BUILT + committed `59722b97a` 2026-11-04** (Parts 0–4; `/simplify`, `/review` and
  `/docs` done; **owner walk §453 WRITTEN and owed**, https://claude.ai/artifact/SbzSAt6P9RGg5ysD7jgtKm, 61 steps in eight
  parts + the seven calls). **Next: S2 (the child record, a migration), after the walk.** What landed:
  - **Pure module `lib/season-roll-path.ts`** (client-safe; the words of BOTH windows): `nextAgeDivision` (11U, U11, U-11,
    "11 and under"; never Mosquito / a bare 11 / a birth year), `theSeason` + `closesLine` (the "2026 Season season" fix —
    the club's `startLead` now uses it too), the choice lines (coach names the division; club names the birth years),
    `bornYearsForPath` (a: stay, not marked carried; b: +1, marked carried), `bornMovedLine`, `rollPlayerChoices` /
    `defaultTicked` / `pickCarriedPlayers` (call-ups never listed and refused; an unknown id refuses the whole roll),
    `parseRollChoice` (both routes; `path` required → 400 `roll_choice`; division ≤ 30 chars, absent = leave it),
    `rosterOutcomeLine`. Tests `tests/unit/season-roll-path.test.ts` (36).
  - **The roll** (`startNextRepSeason`) takes `path`, `carryPlayerIds`, `division`, `currentDivision`; reads + checks the pick
    BEFORE the insert (409 `players_changed`, 500 `roster_read_failed`, nothing written); carries `picked.carried` (a
    ticked inactive player comes as active); writes `rep_teams.division` on (a) only, best-effort with a warning; never
    touches the name. Summary gains `path`, `roster.stayed`, `division`. New `seasonWindowFacts` feeds both GET preflights
    (`roll`: players as names + numbers only, division, birth years, the sport's cut-off).
  - **Coach window**: the question first after the consequence; (a) division box (only when the team has a division) + the
    Pay out sheet's tick list (`.debtList`/`.debtRow`, scrolls at 15rem, "N of M coming", All · None); (b) the birth-years
    line (only with years) + "Bring last season's players anyway" (only when someone was active). Start waits with the
    reason in the foot. Roster sentence and the stale goals bullet replaced; success bullet = `rosterOutcomeLine`. Team
    settings' row no longer says "Your active roster carries forward".
  - **Club window**: same question and words, inline list, same division box; the fixed roster row and
    `rosterCarryDetail` / `START_CARRIES.roster` are gone (callers no longer pass `rosterCount`).
  - **Tests updated, not loosened:** `club-stage4c2-admin-side` (the pair follows the path), `coach-call-ups-guard` (the pick
    refuses a call-up), `club-stage2-screens-guard` (roster-row words removed).
  - **Checks:** the 12 affected test files 405/405; `typecheck` clean except another session's
    `billing-location-evidence.test.ts`; eslint clean on every touched file (the `verify:changed` wrapper's ESLint run fails
    on a config/plugin error across 87 changed files, not this code); spelling, CSS purity, contrast, dates, observability
    clean. The full `npm test` has 23 failures, none in this work (public tournament Stage 8, billing, Stripe mode, support
    console). **Layout:** new screen `admin-rep-team-start-season-players` (the club window with path (a) picked) at
    361/390/768 — its one finding is the label-row checkbox the existing `admin-rep-team-start-season` entry already
    ACCEPTS; recorded with the same reason. **The coach window has no layout screen:** the only coach fixture coaches a
    club team, which never sees the door — a note in `scripts/layout-screens.mjs` says so; the walk measures it by eye.
  - **Defaults taken (owner away; raise at the walk):** (1) the clauses that point at the S3 picker ("Bring Jonah back from
    Roster any time", "…or bring back a past player from Roster", "You can bring anyone back from the Roster later") are
    held behind `PAST_PLAYER_PICKER_BUILT = false`, which S3 flips; (2) the drawn documents bullet ("Waivers and the code
    of conduct need signing again… Medical forms carry") is held for S4 — today nothing carries, so it would be false; the
    roll's existing "not carried" note stays; (3) no "Inactive since Jun 2, 2026" sub-line — no column records when a
    player went inactive, so the row shows the Inactive chip only; (4) the drawing's hint "The list scrolls." is dropped as
    a drawing note, not product copy; (5) the club window gets the same Division box on (a) (the club frame drew only the
    card line); (6) path (b)'s birth-years box shows on the coach's window only — the club's card line already names the
    new years; (7) a ticked inactive player comes back as active.
  - **Found, not fixed (other sessions'):** the dev server had to be restarted twice; after the first restart every team
    page 404'd until `.next` was cleared (the AGENTS.md stale-cache sequence fixed it). The dev log also shows another
    session's `billing-location-server.ts` importing a missing `currentReview`.
  - **Finish run 2026-11-04 (one session, owner asked for the whole run incl. the commit):**
    - **`/simplify`:** one `SeasonWindowFacts` type shared by the server read and both windows; `rollRequestFields` +
      `rollWaitReason` (the request fields and the wait ladder both windows repeated) moved into the module; `startLead`
      reuses `closesLine`; full names via `playerName`; both preflights read side by side; `isRollPath` no longer
      exported. Skipped on purpose: the club kit's `ck.link` for All / None (always underlines, tap rule differs — would move
      the layout baseline), merging `theSeason` with `seasonPhrase` (wording ruled), a `?need=` switch on the coach
      preflight (the Close window pays for the player read, the Start window for the money read — an endpoint-contract
      change, raise it separately).
    - **`/review` (high-risk, four lenses): no Critical or High.** Confirmed + fixed: the club window dropped the roll's
      warnings (a failed division move would have looked like success) — they now keep the notice up (`bad` tone, a
      `good` one fades); the club's "Each returning player's history" row now hides when the choice brings nobody;
      stale lines in the data dictionary (`born_from/to_year`, `born_years_carried`) and two code comments. Left (Low):
      the roster is a snapshot from when the window opened (a player added after is skipped and shows under "stayed";
      deleted or turned call-up refuses 409), the division box can overwrite a change made elsewhere meanwhile,
      `nextAgeDivision` moves only the first age token ("11U/12U", "U9"→"U10", zero padding), "0 players' fee plans
      carried" on a new group with the fee box ticked, and the Team details note still says "If this team keeps its
      players, change it back" after a new-group roll.
    - **`/docs`:** `coaches.tsx` (`recipe-start-next-season` and its FAQ, `premium-team-settings`, `premium-season-end`'s
      two lines) and `rep-teams.tsx` (`recipe-seasons`, the birth-years line) now describe the question and both paths;
      neither promises "bring back a past player" (S3) nor "medical forms carry" (S4).
    - **Owed to `/marketing`, not edited:** `lib/walkthrough-content.ts:215` (the pre-sales walkthrough says "it carries
      the active roster").
    - **Walk + fixture:** `.probe/s1-walk/fixture.mjs` (dev only, `--reset`, `--destroy`) and `look.mjs` (read-only; proved
      13 listed / 12 ticked / call-up absent on every team). **The reset has only been tested against a simulated roll —
      read its output after the first real one (walk step E1).** The coach window's heading reads "Birth years for the 2027
      Season" (capital S) while the club's Team details says "…2027 season" — a one-word mismatch to settle.
  - **Help + marketing owed via `/docs`:** DONE (see above); `lib/walkthrough-content.ts:215` stays `/marketing`'s.
- **S2 · the child record underneath (14b data)** — Not started. Needs S1 committed or at least walked (S2 changes the roll S1 edits).
- **S3 · Bring back a past player + "Same child?" (14b screens)** — Not started. Needs S2.
- **S4 · documents and the health check (14c)** — Not started. Needs S2.
- **S5 · the child's page, the household list, the club's doors (14d part 1)** — Not started. Needs S2 (S4 for the documents block).
- **S6 · joining records + the parent link (14d part 2, Ask 13)** — Not started. Needs S5.

## What the owner gets (the PM summary, in this shape, per session)

What the coach / club admin sees and does differently; how it affects other screens (Families book, tryouts, house league, money);
why it matters; the trade-offs taken; how to walk it. Product-owner voice, no file names. Lead with the screen, not the table.

## Facts read from the code (2026-11-04; verify, then build on them)

**The season roll** (`lib/rep-season-rollover.ts`, `startNextRepSeason` at :107; params at :107-129):
- Always carries `status === 'active'` players only (:303-307) by **copying** each into a new `rep_roster_players` row via
  `createRepRosterPlayer` (:310-339): name, DOB, number, positions, guardian fields, `notes`, medical notes, emergency contact,
  bats/throws, jersey size, lineup profile. Drops `adminNotes` and `tryoutRegistrationId`. `person_id` is not copied.
- Always moves the birth years +1 (`rollBornYears`, :218-239, sets `born_years_carried`). **It does both ruled paths at once.**
- Mints `rep_player_continuity_links` CONFIRMED / `high` old→new (:356-383). Notes "Player waivers and documents are not carried —
  collect fresh ones for the new season." (:353). No duplicate check (the new season starts empty; `year_exists` 409 at :255).
- Never writes `rep_teams` (name, slug, division unchanged). Statuses are `active | inactive | callup` (`lib/types.ts:1178`) —
  there is no "released".
- Callers: coach `app/api/coaches/[orgSlug]/teams/[teamId]/seasons/route.ts` (~236-298; standalone head coach only,
  `mayManageSeasons` in `lib/season-doors.ts:28-33`); club `app/api/admin/rep-teams/teams/[teamId]/seasons/route.ts` (~130-171;
  opening balance always 'all' at ~160; emails staff via `tellClubTeamStaff`).

**The two windows.** Coach: `components/coaches/StartNextSeasonModal.tsx` (QuestionShell, 520). Its first line renders "This closes
the {currentSeasonName} season." (:280) — with the default name "2026 Season" that reads "…2026 Season season."; the roster is one
sentence (:288-290); the Development-history bullet promises a per-player goals offer that was removed 2026-09-16 (:383-386; the
roll's own comment at :356-363 says so). The submit reads "Start next season" ("Starting..."); the success view is the same window
titled "New season started", "**{new}** is now your active season.", a bullet list, foot "See {old}'s Season Wrapped" + lime "Go
to {new}" (:175-215). Club: `components/admin/kit/club/SeasonDialogs.tsx` (:63-166) with words in `lib/club-season-words.ts`
(:46-66): roster is a fixed row "The roster · the {n} active players". The club's Team details page shows the carried-birth-years
note (`app/[orgSlug]/admin/rep-teams/teams/[teamId]/page.tsx:735-738`) and edits division (:703-707) and birth years (:708-739).
A standalone coach edits Division (`canEditDivision`, coach `.../teams/[teamId]/route.ts:336-353`); coaches never edit birth years.

**Where a child lives.** No durable child key exists. Per-season rows: `rep_roster_players` (incl. call-ups, `status='callup'`, no
email allowed by CHECK), `rep_tryout_registrations`, `league_registrations`. Every `person_id` points at the **guardian**
(`org_people`, adults only, `UNIQUE(org_id, email_normalized)`). `rep_player_continuity_links` joins two entries **of the same team
only** — composite FKs on `(…_id, team_id)` (mig 191:72-78) refuse cross-team. The Families book already unions a team's confirmed
chain into one child at read time (`lib/families-read.ts:337-350`, `childKeys`); a house-league child is `league:${r.id}` — new
per sign-up (:369). Free-tier `basic_coach_team_players` has no seasons (out of scope).

**What hangs on a roster entry** (all CASCADE unless noted): money (dues payments/credits/payouts/schedules/installments,
fundraiser entries, refund adjustments), `rep_player_documents` (no season or valid-until column; staff upload only), awards,
development goals, measurables, baselines, notes/observations/goal reviews/not-assessed (composite same-team FKs), attendance,
lineup entries, call-up appearances, game moments (SET NULL), `family_links`. Lineup templates hold player ids in jsonb and break
across seasons today (`DB_ARCHITECTURE_REVIEW.md:358`).

**The add doors.** Coach single add (`app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx` ~954-1100; POST
`.../roster/route.ts:60-97`): no duplicate check; DOB optional in the folded "More details". Paste a list
(`components/coaches/RosterBulkAddSheet.tsx`; `lib/coach-roster-bulk.ts:204-231`): same-season, name-only warning "{name} is
already on your roster.". Tryout accept (coach `tryout-decisions/accept/route.ts`, club `admin/.../tryouts/[regId]/route.ts`, RPC
`accept_tryout_and_create_dues`, mig 169): no name check, so a child already on the roster gets a second entry. Club admin: no
add-player door. House league: `league_is_duplicate` (mig 362) refuses a same-season duplicate.

**The matcher.** `lib/continuity-match.ts:116-141`: `high` = DOB exact AND (email OR strong name); `possible` = email + strong
name + DOB missing, or DOB + weak name + email. `high` admits twins (same DOB + family email, different first name; documented
:156-162). Confirm card `components/coaches/ContinuityCompareCard.tsx` ("Possible returning player — verify" · "Confirm — same
player" · "Not the same player" · "Not sure yet"); decide route `.../development/continuity/[linkId]/route.ts` (one confirmed link
per current entity; reject is a tombstone).

**The Families book's duplicate queue** (model for S6): rule `lib/families-duplicates.ts:142-251`; tab
`components/admin/kit/club/families/DuplicatesTab.tsx` (reason first, two sides each "Keep this record", one consequence line,
"Merge into {keeper}" lime on the first card only / "Not the same person" outline; confirm "Merge … into {keeper}?" — "A merge can't
be undone."); server `app/api/admin/families/duplicates/route.ts:34-79` (re-proposes, 409 when stale, audits); merge
`families_merge_people` (latest mig 338:110-181). Words `lib/families-words.ts:131-182`. Tabs are **Families · Duplicates ·
Emails** (`lib/admin-kit-nav.ts:415-422`).

**Documents, health, consent.** Templates `rep_document_templates` (org + optional team, no season). Coach documents route
404s a past season's entry (`.../roster/[playerId]/documents/route.ts:46-56`); GET needs `documents` + `rosterPii`. Club route has
no season filter. Coach player page tabs: Details · This season · Skills & goals · Notes · **Family & paperwork**
(`lib/coach-player-tabs.ts:24-29`); documents (`PlayerDocumentsSection`) and emergency contact live on Family. Coach document
labels are Title Case ("Medical Consent", `PlayerDocumentsSection.tsx:12-13`); club's are sentence case. Medical note is a Details
field, redacted under `rosterPii` (`lib/coach-capabilities.ts:979-1002`). House-league consent `family_consents` keyed to guardian
email + one registration (`lib/org-people.ts:80-108`). No photo-consent type exists.

**The parent link.** `family_links.player_id` → one roster entry (NOT NULL by CHECK, mig 290). **Nothing moves it at a roll**
(no code; the dictionary was corrected 2026-11-04). It stays live — `lib/family-access.ts` has no season check — and a new invite
to the new entry is refused by the live-unique index: "That address already has a connection to this player."
(`lib/family-guardian.ts:349-352`). `GUARDIAN_TIER_ENABLED` is off (`lib/family-guardian.ts:41`). A team moving into its club
clears `person_id` (mig 313:33-36, 334-336).

**Standalone coaches** have no Families book (`module_families` is League/Club only, `lib/plan-config.ts`; every families route
gates in `lib/families-auth.ts:26-38`); their team is its own organization.

**The look-back guard.** `HISTORY_ENDPOINTS` (:152-159) is for routes reading `?year=` / `resolveCoachHistoryRead*`;
`CROSS_SEASON_READERS` (:191-194) for routes calling `resolveCoachTeamCapabilities` without a year. Blind to a season id in a
request body (:33-39). A write body may not read `?year=` or call the history resolvers (:448-482).

## Decisions already made (build as written, do not ask)

1. **The window (Asks 1–3), both portals, same words.** Nothing chosen when it opens; until a choice, the primary button keeps its
   name, is disabled, and the foot says "Choose what the team is doing.". **(a) "The same players, moving up an age group"**: the
   players come (a tick list — Ask 2: active ticked, inactive listed unticked at the bottom, call-ups left out, "N of M coming",
   All · None); birth years **stay**; the division moves up in an editable box **only when it starts with an age** ("11U AAA" →
   "12U AAA", "U11" → "U12"), otherwise the box shows the old division; **the team's name is never changed for them**. **(b) "A
   new group of players, same age group"**: no players by default, one box "Bring last season's players anyway" (all active);
   birth years +1 as today (shown as "Born 2016–2017 (was 2015–2016)" only when the team has birth years). The club's window
   shows the **same tick list inline** (the drawing's club frame says "Choose who on the next step" — that was a drawing shortcut;
   build it inline, same as the coach's). Fix the first line ("This closes the 2026 Season." — drop the trailing "season" when the
   name already ends in "season", case-insensitive) and replace the stale Development-history bullet with the drawn one.
   Success view unchanged except its roster bullet: "13 players came with the team as 12U AAA. Jonah Ruiz stayed on the 2026
   Season. Bring Jonah back from Roster any time." / (b) "The roster is empty. Add players, open tryouts, or bring back a past
   player from Roster." Use names, never a guessed pronoun. Birth years written with `bornLine` (`lib/born-years.ts:111-127`).
2. **One child, never inferred (Ask 4).** Every new entry starts its own child. Two become one only by a **fact** (the roll; the
   picker; accepting a tryout whose returning-player match the head coach already confirmed) or **a person's yes** (the "same
   child?" question, the Children queue). A match is always a question. The question requires the **same first and last name**
   (normalised as the matcher does) within the scope the asker may see; birth date / family email raise confidence and never
   answer it; twins are never asked about. A "no" is stored and never asked again, anywhere.
3. **Shape (Ask 5).** Build the **organization-level child record now**; roster entries, tryout sign-ups and house-league sign-ups
   point at it. The first screens show only **this team's** past players. The cross-team picker is **not built** in Stage 14.
4. **Who links (Ask 6).** The head coach links within their own team's seasons (picker, "same child?", tryout accept). The club
   admin (Families access) links across teams and the house league, and owns the Children queue.
5. **Standalone (Ask 7).** Same record, no Families book. When a coach's team moves into its club, its children move with it and
   the club's queue proposes matches.
6. **No club add-player door (Ask 8).** The club admin's doors: a household's children (one line each), a name on any team's
   roster (read-only), search → the child's page; and the Children queue.
7. **Privacy (Ask 9, counsel's read parked).** A coach sees **their own team's seasons only**, on the player page and in the
   picker. Notes, evaluations, observations and tryout scores **never leave the team that wrote them**. A club admin may widen
   *development history* (goals and measurements, never notes) to the club's teams — **a setting, default off; build the switch only
   if S5 has room, else record it as owed**. The picker shows birth date, family and dues only to staff with `rosterPii` (the
   grant that hides them on the roster today).
8. **Documents (Ask 10).** Per template, the club (or the standalone coach for their own templates) sets **"Signed each season"**
   or **"Good until replaced"**; defaults: waiver + code of conduct = each season, medical consent + other = until replaced. A
   document belongs to the child with its history; its state for the working season is "Needs signing for {season}" / "On file".
   Medical note + emergency contact live on the child and carry, with a once-a-season **"Still right for the {season}?" → Confirm**.
   Sentence-case document labels in both portals (fix the coach constants). No photo-consent type is added.
9. **Joining (Ask 11).** A standing **Children** half of Families → Duplicates (a kit `ViewSwitch` "Parents · N | Children · N"),
   reusing the shipped duplicate card. At the first run, roll-linked and coach-confirmed chains are already one child (S2's
   backfill). A join never deletes a season's entry; **a join can be split again** ("Split records" on the child's page); the
   kept record decides name and birth date; health values: newest season wins, older kept as history; refused when both entries
   are on one team in one season ("Both are on the {team} {season} roster. Remove the extra entry first, then join them.").
10. **Birth-year check (Ask 12).** Warn, never block: "Born 2014. The team is 2015–2016." Only when the team has birth years.
11. **The parent link (Ask 13).** It points at the **child**; what a connected parent sees follows the child's **live** seasons, so
    last season's team stops reaching them when it closes. The tier stays off; nothing new is shown on the roster for it.
12. **P3 (Ask 14) ruled yes:** a parent account is a person, clear of the one-home-organization rules. Nothing to build here; S6
    must not make the parent link depend on an org membership. (Logging it in `BUSINESS_DECISIONS.md` is `/strategy`'s job — offer it
    once if not already done.)
13. **Never on public forms.** The public tryout and house-league sign-ups never reveal a match. Call-ups never ask (held with the
    cross-team picker).
14. **The `/design` round on the drawings is binding for look:** One Window ladder (520 form · 640 picker · 416 question), the Pay
    out sheet's tick list for pick-many (`coaches.module.css` `.debtList`/`.debtRow`, not `CoachRowList`), the "same child?"
    question disables the window's buttons with the reason in the foot, sentence-case mono chips + quiet identity chips, the
    returning caption under the name on the roster ("Back from the 2025 Season", until the first game), Upload icon-only 44×44 on a
    phone.
15. **No money moves.** Past-season dues are shown in the picker and stay on their season's book. Nothing changes what FieldLogicHQ
    charges, so no `/accounting` pass. The demos follow the product; do not hand-edit them (CLAUDE.md).

## Push-back, before you build (raise in that session's Part 0; build the recommendation if the owner is away, list it under "Defaults taken")

- **S2-1 · What lives on the child, and what stays on the season's entry.** Rewriting every roster reader off the entry's name
  columns is the whole product. **Recommend:** the child holds the key and the child-level facts (first/last name, birth date,
  medical note, emergency contact, the health-checked season); each entry **keeps its own name/DOB columns** as that season's copy.
  Editing name/DOB on a **live** entry writes through to the child; past entries stay as recorded. The child's page, the picker and
  the queue read the child.
- **S2-2 · One writer for "a new child".** **Recommend** a `BEFORE INSERT` trigger on the three entry tables that creates a child
  when `child_id` is null (from the row's name/DOB/org), so every writer — the house-league RPC, the roll, bulk add, accept,
  check-in — is covered without editing each; the roll, picker and confirmed accept set `child_id` explicitly. Watch: the
  house-league placement RPC is the money-adjacent hot path; the trigger must not change its locking or its duplicate refusal.
- **S2-3 · Fold in the side bug.** The roster delete/Undo check (`ROSTER_PLAYER_DEPENDENTS`, `lib/db.ts:4638-4656`) misses notes,
  observations, goal reviews and not-assessed marks. S2 touches that check anyway. **Recommend** fixing it in S2 and closing its
  TODO line.
- **S4-1 · Documents outlive the entry.** Moving a document to the child means deleting a roster entry no longer deletes its papers
  — a retention change. **Recommend:** a document keeps the entry it was signed on (for history and the season label) and belongs to
  the child; deleting an entry keeps the child's documents; a child with no entries left is hidden from every list but kept.
  Record the retention point for counsel's later read.
- **S6-1 · The parent link's shape.** `family_links.player_id` is NOT NULL by CHECK. **Recommend:** add `child_id`, keep `player_id`
  as "the entry it was made on", and make access read the child's live entry on that team; the live-unique index moves to
  `(child_id, invited_email)` so a re-invite after the roll is no longer refused. No family is affected (the tier is off).

## Sessions and parts

### S1 · The season window (14a) — size S/M, no migration expected
**Part 0** PM summary + task list. **Part 1** a pure module beside `lib/season-carry.ts`: the division bump ("starts with an age"
rule; unit-test 11U, U11, 11 and under, "Mosquito", empty), the closes-line wording, the roster bullet sentences, the born-years
line for each path. **Part 2** the roll takes `path: 'moving_up' | 'new_group'` and `carryPlayerIds` (validated: rows of the
current season and team, never call-ups) and an optional `division`; birth years stay on (a), +1 on (b); on (a) with a division,
write `rep_teams.division` (coach route only for a standalone head coach; the club route for the club). Both routes require `path`
(400 with plain words if absent). The continuity links are minted only for carried players (as today). **Part 3** the coach window
per tab 2 (desk + phone) and the club's window (inline list). Update the help that names the roll (list below) via `/docs`, not by
hand. **Part 4** checks: unit tests for the module and the roll's new params (`tests/unit/season-carry-forward.test.ts` and the roll's
tests — update assertions, do not loosen); `npm run typecheck`; `npm run verify:changed`; `check:layout --changed` on both windows
at 360/390/768 (dev server, changed screens only). Offer `/review` (route + shared roll), `/docs`. Walk = next free ledger §
(**452+**; check), one purpose: "the season window asks". Outline: A both doors open with nothing chosen · B path (a): list, All/None,
inactive unticked, division bump and a non-age division, birth years unchanged · C path (b): empty roster, the box, birth years
+1, a team with no birth years · D the success view's bullet, both paths · E the club's window, same words · F the first line fixed,
the stale bullet gone · G a phone.

### S2 · The child record underneath (14b data) — size L, one migration
**Part 0** summary + push-backs S2-1..3. **Part 1** migration: `org_children` (name it per the dictionary's conventions; org-scoped,
RLS like `org_people`), `child_id` on `rep_roster_players`, `rep_tryout_registrations`, `league_registrations` (FK, indexed), the
insert trigger (S2-2), the **backfill**: one child per confirmed same-team chain (port `childKeys`' union-find and the
registration alias rule exactly, then delete nothing), one child per remaining tryout registration and per house-league
registration; the coach team-move function (mig 313's) moves the team's children with it. Dictionary + snapshots + prod step.
**Part 2** writers: the roll sets the carried entry's `child_id` to the old entry's; accept sets the roster entry's child from the
registration's (and from a confirmed returning-player link's prior entry); live-entry name/DOB edits write through (S2-1).
**Part 3** readers: `lib/families-read.ts` reads `child_id` instead of `childKeys` — **the Families book's household counts must
not change** for any household whose rows were not joined; pin that with a test over the fixture. **Part 4** S2-3 (the delete check).
Tests: backfill on a fixture (a 3-season chain, a cross-team same-name pair left apart, twins left apart, a house-league repeat
left apart); "a roll never invents a duplicate for a child already on the new season" (the plan's build gate). `npm run typecheck`,
`verify:changed`. Offer `/simplify` (new shared module + trigger), then `/review` (high-risk: migration, backfill, RPC-adjacent
trigger). No walk (no screen changes); the owner check is "the Families book reads the same" — state the numbers you compared.

### S3 · Bring back a past player + "Same child?" (14b screens) — size L, one small migration
**Part 0** summary. **Part 1** migration: the stored "no" (`child_match_rejections`: org, two child ids or an entry→child pair, who,
when; unique pair). **Part 2** the picker: a GET over **this team's** earlier seasons' entries whose child is not on the working
season (latest entry per child; season name; number; status; born; family; that season's dues state from the season book — read
the existing figure, do not recompute), redacted by `rosterPii`; a POST that creates working-season entries from the chosen
children (season fields from their latest entry; `child_id` set; history link minted as the roll does; refuses a child already on
the roster with the drawn words, skipping it and adding the rest). **Register the GET in the history guard on purpose**
(`CROSS_SEASON_READERS`, with the three questions answered in its comment — record read feeding a write; no subtree; each row names
its season). **Part 3** "same child?" on: the single add (the roster POST answers `needs_answer` with the candidate when the name
matches and no decision was sent; Yes → bring that child back; No → store the "no" and add a new child), paste a list (the
preview route returns per-row candidates; rows need an answer before Add; same-season matches keep today's warning and are left
out by default), and the tryout accept (confirmed link → attach silently; unconfirmed match → the window asks; child already on the
roster → the 416 refusal). Birth-year warning on picker and add (Ask 12). The roster caption "Back from the {season}" until the
first game. **Part 4** tests (the picker's reads incl. redaction and a closed season refusal; the match rule incl. twins and a stored
"no"; accept's three branches), typecheck, verify, `check:layout --changed` (roster, Add Player, the picker, paste, the accept
window at 360/390/768). Offer `/simplify`, `/review`, `/docs`. Walk § (one purpose: "a returning child is picked, never retyped").

### S4 · Documents and the health check (14c) — size M/L, one migration
**Part 0** summary + S4-1. **Part 1** migration: template validity (`signed_each_season | good_until_replaced`, defaults by type),
`child_id` on `rep_player_documents` (backfilled from the entry's child) plus the season it was signed for; health columns on the
child (`medical_notes`, emergency contact, the season last confirmed) backfilled from each child's **newest** entry. **Part 2**
the documents routes read by child, state per working season; the coach Family & paperwork tab and the club's per-player documents
read "Needs signing for {season}" / "On file"; the template editor gains the validity choice; the roll's "collect fresh ones"
note becomes the drawn sentence (waivers and code of conduct need signing again; medical forms carry). The health "Still right for
the {season}?" Confirm (Family tab + the club's child page later). Sentence-case labels. **Part 3** tests (state per validity; a
signed-each-season doc from last season shows Needs signing; a good-until-replaced doc shows On file across a roll; delete of an
entry keeps the child's documents), typecheck, verify, layout. Offer `/review`, `/docs`. Walk § ("papers follow the child").

### S5 · The child's page, the household list, the club's doors (14d part 1) — size M
**Part 0** summary. Build the club admin's child page per tab 5 (Seasons table across teams and house league, Documents, Health and
emergency, Parents, "Split records" placeholder disabled until S6), the household's one-line-per-child list (tab 8), and the door
from a name on a team's roster. The coach's player page shows "With the {team} {years}" for **own-team** seasons only. Families
access gates the club page. Ask 9's widening switch only if there is room (else a Progress note). Tests, typecheck, verify, layout
(desk + phone). Offer `/review`, `/docs`. Walk § ("one page per child").

### S6 · Joining records + the parent link (14d part 2, Ask 13) — size L, one migration
**Part 0** summary + S6-1. **Part 1** the Children half of Duplicates: the proposal rule (same first+last name and same birth date
across teams/house league; same name + one DOB missing + same parent email; never a different first name; never a stored "no"),
the shipped card, the 416 confirm ("Join {name}'s records?"), the server that re-proposes and 409s when stale (copy the Parents
route's shape), audit lines; **split** on the child's page (exact, since nothing was deleted). **Part 2** migration + the parent
link (S6-1): `child_id` on `family_links` (backfilled from the entry's child), access by the child's live entry, the live-unique
index moved; the coach's guardians card groups by child. **Part 3** tests (join/split round-trip leaves every season's entry and
its money untouched; the same-team-same-season refusal; a stale pair 409; a parent link survives a roll and stops reaching the
closed season; a re-invite after a roll is accepted), typecheck, verify, layout. Offer `/simplify`, `/review` (high-risk: identity
merge + access), `/docs`, `/demos` once at the end of Stage 14 (the cycle's curation, not per commit). Walk § ("joining records").
**Then** close Stage 14 in the plan (status line, Definition of done checked item by item) and the TODO line.

## Help + demo exposure (for each session's `/docs`; change nothing by hand)

`lib/help-content/coaches.tsx`: `recipe-add-player` (~351), `premium-bulk-roster` (~1516), `recipe-start-next-season` (~6138),
`premium-season-end` (~1540), `premium-team-settings` (~5956), `premium` (~1258), `recipe-run-tryouts` (~394),
`premium-portal-tour` (~1674). `lib/help-content/rep-teams.tsx`: `recipe-seasons` (~115), `recipe-create-team-program-year` (~84),
`recipe-accept-player-to-roster` (~218). Families help for S5/S6 (find it). Demos: no tour stop points at the roster add or the
roll; the coach tour's "Read what a parent gets" (`lib/sandbox-chrome.ts:548-555`) and the off-season demo team that "has rolled
over" (`lib/demo-coach.ts:1839`) must stay true — the build fails if a tour anchor stops existing. A number in a demo sentence is
computed from the seed.

## Files you will touch (verify; do not trust)

S1: `lib/rep-season-rollover.ts`, a new pure module beside `lib/season-carry.ts` + tests, both seasons routes,
`components/coaches/StartNextSeasonModal.tsx`, `components/admin/kit/club/SeasonDialogs.tsx`, `lib/club-season-words.ts`,
`lib/born-years.ts` (read). S2: a migration, `DATA_DICTIONARY.md`, `MANUAL_PROD_STEPS.json`, `lib/db.ts` (`createRepRosterPlayer`,
`ROSTER_PLAYER_DEPENDENTS`, `acceptTryoutAndAddToRoster`), `lib/families-read.ts`, `lib/types.ts`. S3: roster routes (`roster`,
`roster/bulk/preview`, `roster/bulk`, a new `roster/past-players`), `tryout-decisions/accept` + the club accept route,
`roster/page.tsx`, `RosterBulkAddSheet.tsx`, `TryoutDecisionBoard.tsx`, `lib/coach-roster-bulk.ts`, `lib/continuity-match.ts`
(read), the history guard test. S4: documents routes (coach + club), `PlayerDocumentsSection.tsx`, the template dialogs, the roll's
note. S5/S6: `components/admin/kit/club/families/*`, `lib/families-*.ts`, `app/api/admin/families/*`, `lib/family-guardian.ts`,
`lib/family-access.ts`, `lib/admin-kit-nav.ts` (read). Always: TODO.md, the plan's Stage 14 status, this Progress block,
`OWNER_QA_LEDGER.md` (the walk §).
