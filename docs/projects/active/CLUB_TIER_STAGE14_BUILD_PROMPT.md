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

- **2026-11-04 · S1 done, S2 committed `5c3acb04c`.** Facts below were read from the code on 2026-11-04 by five helpers, and each one this prompt relies on
  was opened at the cited lines by the author. Line numbers drift; re-check them.
- **S1 · the season window (14a)** — **BUILT + committed `59722b97a` 2026-11-04** (Parts 0–4; `/simplify`, `/review` and
  `/docs` done; **owner walk §453 (ledger §452) PASSED 61/61 on 2026-11-04, all seven calls "Keep as built"**,
  https://claude.ai/artifact/SbzSAt6P9RGg5ysD7jgtKm). **Next: S2 (the child record, a migration).** What landed:
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
- **S2 · the child record underneath (14b data)** — **BUILT + committed `5c3acb04c` 2026-11-04 (Parts 0–4); `/simplify` +
  `/review` (high) DONE 2026-11-04 — see "Review outcome" below; the fixes landed in the commit after `5c3acb04c`; prod mig 435 owed (MANUAL_PROD_STEPS, `pending`).** No walk (no screen changes). What landed:
  - **Mig 435 `a_child_is_one_record_across_seasons`** (applied to DEV): `org_children` (id, org, first/last name, birth date;
    service role only); NOT NULL `child_id` on `rep_roster_players`, `rep_tryout_registrations`, `league_registrations`.
    `rep_child_components(team, child?)` = THE same-team rule (non-call-up roster rows + tryout sign-ups; edges = accept
    (roster row ↔ its sign-up) + CONFIRMED links). Triggers: `org_child_for_entry` (BEFORE INSERT / UPDATE OF child_id —
    mints a child when none is given, an accepted tryout takes its sign-up's, refuses another org's child; SECURITY DEFINER
    because of the old anon insert policies), `org_child_follows_entry` (a LIVE entry's name/DOB edit writes through),
    `org_child_follows_link` (confirm → `org_children_join`, keeping the prior's record; a confirmed link undone →
    `org_children_split_team`). Backfill: one child per same-team component, one per remaining entry; deletes nothing.
    `move_team_into_club` re-created from 351 with `org_children` in `c_moves` (diffed: the only two changed lines).
    The house-league placement RPC and `accept_tryout_and_create_dues` were NOT touched (pinned by a test).
  - **App:** the roll passes the carried entry's `childId` (set explicitly — the link mint is best-effort);
    `pickCarriedPlayers` carries one entry per child (the build gate); `RepRosterPlayer.childId`; the Families book
    (`families-read.ts`) keys children by `child_id` (`childKeyOfRow`) and no longer reads continuity links; the family
    file export adds a house-league sign-up to its child instead of replacing it.
  - **S2-3:** `ROSTER_PLAYER_DEPENDENTS` gains notes, observations, goal reviews, not-assessed marks AND
    `rep_fundraiser_credit_plan`; `roster-delete-guard.test.ts`'s completeness scan is now case-insensitive (the cause:
    migs 268/295/296 write lower-case SQL). TODO line moved to the archive.
  - **The owner check ("the Families book reads the same")** — `.probe/s2-child/compare.mjs` ran the OLD read-time rule and
    the stored child side by side on every dev org: 710 rows (500 roster, 210 house league), **708 children both ways, 0
    splits, 0 joins, 249 households, 373 household children both ways, 0 households differing.** Dev has only 2 confirmed
    links, so the logic is proved by the fixture: **`tests/sql/org-children-fixture.sql` (dev, one DO block that rolls itself
    back) — 11/11 rules** (3-season chain; the roll mints nothing; cross-team same name apart; twins + a high suggestion apart;
    house-league repeat apart; accept takes the confirmed sign-up's child; call-up apart; live vs closed write-through;
    another org's child refused; undo splits at the link; the components rule = the stored children). Two deliberate mutants
    failed as they should. Run it: `node .probe/s2-child/q.mjs --file tests/sql/org-children-fixture.sql`.
  - **Found and fixed while testing:** the "newest entry" that names a backfilled or split child was ordered by write time
    only, so rows written in one moment (a seed) named it at random; now newest SEASON, roster before sign-up, then write
    time, then id. Dev was brought level (split function re-created, multi-entry children re-named); prod runs the final file.
  - **Checks:** unit tests touched 110/110 (`season-roll-path` +2 build-gate tests, `roster-delete-guard`, `team-move-coverage`,
    `migration-table-grants-guard`, `families-stage5a-guard`, new `org-children-guard` 6); `typecheck` clean; lint 0 errors on
    every touched file; `check:dictionary` OK. `verify:changed`: the full `npm test` has 9 failures, none in this work
    (practice plans phone, billing free time, public focused page, tournament Stage 1 frame + Stage 6 walk, series dates,
    support console); the chain's later checks run separately — schema parity lists `org_children` as dev-only (prod owed, as
    expected); the rest (lint config, admin look/lettering, org-slug, demos, CSS selectors, export catalog, root files) are
    other sessions'.
  - **Defaults taken (raise with the owner):** (1) the child holds name + birth date only in S2 — the medical note and
    emergency contact join it in S4 with their readers (S2-1 narrowed so the medical note never has two homes);
    (2) an undone confirmed link splits the child (not in the prompt; without it the Families book would keep a coach's "not
    the same player" joined); (3) a tryout sign-up a coach confirmed as a returning player BEFORE accept is already that child
    (a person's yes; the old read ignored unaccepted sign-ups — no household count moved on dev); (4) a call-up is its own
    child; (5) a removed entry's child is kept, invisible (S4-1), and a JOIN deletes the absorbed record — **S4 must carry the
    child's health facts across before that delete once it holds them**; (6) "live" for write-through = rep season draft/active,
    house-league season not completed/archived.
  - **Review outcome (2026-11-04, `/simplify` then `/review` high; five lenses — join/split, trigger safety, data/contract,
    callers, duplicate-child writers; no Critical or High found).** Fixed in the 435 file + dev (the commit after `5c3acb04c`):
    (1) **the undo-splits keep rule** (reproduced by two lenses): an undone link used to regroup the WHOLE child by links, so
    a roll's fact with no link row (the mint is best-effort) was torn apart by an unrelated undo — it now moves ONLY the group
    holding the link's current entry (`org_children_split_team` gained a 4th argument); (2) the kept child kept the split-off
    entry's written-through name, and a join kept the older record's — both now re-named from the newest entry
    (`org_child_rename_from_entries`; the backfill and the split share ONE newest-entry rule, `org_child_newest_entry`);
    (3) a fix to an OLDER entry still live no longer renames the child over a newer season; (4) join/split lock the child
    records first (id order) — races could wrong-merge; (5) the `child_id` FKs are DEFERRABLE INITIALLY DEFERRED (an organization
    delete depends on trigger-name order otherwise); (6) apply takes the three tables' locks up front with a 15 s
    lock_timeout, the backfill updates guard `child_id is null`; (7) link triggers + name write-through have WHEN filters,
    the org check is skipped for a child the trigger just minted, the split evaluates the rule once; (8) TS: `childKeyOfRow`
    has no fallback key (a missing column fails loudly), `childKeys`/`childKeyOf` removed, the export shares one child-building
    step, `createRepRosterPlayer` sends `child_id` only when a fact supplies it, the guard test uses the shared source helpers.
    Proof: fixture 15/15 (rules 12–15 new), the reviewers' four reproductions re-run clean, `compare.mjs` identical (708 / 373 / 0),
    naming equivalence 531 components 0 differing, org delete with entries OK, and the WHOLE final file replayed on dev's real rows
    in a rolled-back transaction (`.probe/s2-child/replay.cjs`: same partition, same names). 110/110 unit tests, typecheck clean.
    **Not changed, for the owner:** (a) a unique index on (child, season) so no writer can put a child on a roster twice — real
    guard, but it rejects writes and needs a data check first; today only the roll's picker enforces it; (b) a deleted or
    re-pointed confirmed link does not unjoin children (only a status change does); (c) `org_children` has no erasure path —
    a minor's name and birth date outlive the entry (S4-1 "keep" is the ruling; the privacy plan should say how erasure reaches
    them); (d) the old anon INSERT policies on the sign-up tables are inert only because mig 311 revoked the grants — if a
    grant is ever restored, a supplied `child_id` would need guarding. **Prod mig 435: apply in a quiet window, run the two
    org pre-checks in its MANUAL_PROD_STEPS note first.** The DEV schema snapshots were not refreshed for the FK deferral
    (`npm run refresh:snapshots` when the commit is made).
  - **Records:** dictionary (`org_children` entry, three `child_id` lines, a ⚠ on `rep_player_continuity_links`), the plan's
    14b line + the corrected "Migrations" line (it said the backfill "merges what the matcher is sure of" — Ask 4 overrules),
    TODO line. Probe scripts in `.probe/s2-child/` (dev only: `q.mjs`, `compare.mjs`, the migration builder).
  - **For S3:** `child_id` is on every entry; the picker reads `rep_roster_players.child_id` of this team's earlier seasons and
    creates working-season entries WITH that `child_id` (and mints the history link as the roll does — the link trigger is then a
    no-op). A stored "no" (S3's migration) is separate from `rep_player_continuity_links`' rejected tombstones.
- **S3 · Bring back a past player + "Same child?" (14b screens)** — **BUILT 2026-11-04 (Parts 0–4), committed `54e3458f1`; `/simplify`,
  `/review` (high) and `/docs` DONE 2026-11-04; owner walk §455 PASSED 40/40 2026-11-04 (artifact
  https://claude.ai/artifact/EPuHScE2jnYLfNxdzpzxKB, fixture `.probe/s3-walk/`), calls J1–J3 and J5 kept as built, J4 fixed
  (the shared disclosure toggle has a 44 px floor, in the same commit); prod mig 438 owed (MANUAL_PROD_STEPS, `pending`).
  Next: S4.** One more fix found while writing the walk: the stored "no" was only read at tryout
  accept, so Add Player and paste asked again after a No — the add doors now read it (`answeredNo` rides the picker GET). Owner rulings at Part 0
  (2026-11-04): **"yes on the lock"** (the one-child-per-season index) and **"go ahead with your recommendations"** (the
  calls listed below). What landed:
  - **Mig 438 `a_no_is_remembered_and_a_child_plays_once_a_season`** (numbered after the bank session's uncommitted 436/437;
    applied to DEV): `child_match_rejections` (ordered pair of `org_children`, `door`, who/when; service role only; NO
    `org_id` on purpose — the tenancy is the children's, so `move_team_into_club` is untouched); UNIQUE
    `rep_roster_players_one_child_per_season (child_id, program_year_id)` (dev had 0 such pairs, any status — prod
    pre-check in the MANUAL_PROD_STEPS note); `org_children_join` re-created from 435 + the stored-"no" carry-over.
    Fixture `tests/sql/child-match-rejections-fixture.sql` 4/4 on dev; S2's fixture re-run 15/15.
  - **Modules:** `lib/past-player-words.ts` (every drawn string + `sameNameCandidates`, `bornWarning`); `lib/past-player-rules.ts`
    (pure: `partitionEntries`, `toPastPlayers` with the `rosterPii` redaction, `carriedEntryFields` — now the ROLL's copy list
    too, `decideAddDoor`, `decideAcceptWith`); `lib/past-players.ts` (server: `readPastPlayers` incl. that season's dues via
    `readRepMoney`, `bringBackChild` — child set on the entry + the confirmed link minted as the roll does,
    `storeNotSameChild`, `confirmReturningAtAccept`, `rejectAtAccept`, `returningCaptions`). `normName` exported from the
    matcher; `getRepTeamRosterEntriesAllSeasons` (db, one caller); `RepTryoutRegistration.childId`.
  - **Routes:** new `roster/past-players` (GET list, POST bring back; head coach; registered in `CROSS_SEASON_READERS` with
    the three answers); roster POST (`needs_answer` / yes / no), roster GET (+ `returning` captions), bulk POST (any
    unanswered row refuses the batch), coach accept (refuse same child · refuse same name with "add anyway" · ask · confirm
    link on yes · store + reject the board suggestion on no), club accept (the index refusal in the drawn words, no
    question), continuity decide (a confirm that would put one child on a season twice → Ask 11's words).
  - **Screens:** `PastPlayersPicker` (640, tick list, search, chips, phone lines, empty states); Add Player's second door
    line, the amber question, "Same child: … Change", the birth-year warning under Date of birth; paste rows' Same child |
    New player with the foot reason; the tryout board's 520 question and 416 refusal; the roster's "Back from the {season}"
    caption. `PAST_PLAYER_PICKER_BUILT = true` (S1's held clauses now show).
  - **Checks:** typecheck clean; new `tests/unit/past-players.test.ts` 35/35; affected suites 300/300; the full unit run
    13,936/13,943 — the 7 failures are other sessions' (practice plans phone, billing free time, tournament Stage 6 walk,
    series dates, support console foot-note); lint 0 errors on every touched file (warnings all pre-existing lines);
    `check:dictionary`, `check:spelling` OK. **Layout:** new screens `coach-roster-add-player` and `coach-roster-past-players`
    at 361/390/768/1440 — the picker clean; Add Player's two door links got the phone tap floor (`.addDoorLinks`); its two
    disclosure toggles ("Add parent / guardian contact", "More details", 37px, the shared `CoachFormDisclosure`) were
    measured for the first time and are recorded in the baseline as a found-not-fixed finding. The coach fixture team has
    no earlier season, so the sweep measures the picker's empty state — the walk measures the list by eye.
  - **Defaults taken (owner said "go ahead with your recommendations"):** (1) a "no" is stored on all three doors; (2) two
    past namesakes are asked newest season first; (3) "Yes" fills only blank boxes (number, birth date); the server copies
    the rest; (4) the birth-year warning only for staff with birth dates, on the picker and single add only; (5) a child
    inactive on this season is not in the picker (the off-roster shelf's Add back is the door); (6) a call-up who played for
    this team is listed, as drawn; (7) the picker door shows on a phone too; a "No" at accept also rejects the board's
    suggestion for that pair; (8) head coach only (`rosterWrite`); (9) same-NAME at accept, another record → the refusal
    with "A different child — add anyway" (stored as a no); (10) "Back from…" only for a child who LEFT (previous entry
    older than last season, or not active in it), team-level "until the first game"; (11) the prompt's "same-season
    matches … left out by default" is read as "left out of the question" — a pasted name already on this season keeps
    today's warning and is still added (the existing test pins "without blocking it"); (12) the club's accept asks
    nothing (the Children queue is S6's) — the index refuses the provable duplicate.
  - **Found, not fixed:** the shared disclosure toggle is 37px at touch widths everywhere it is used; a board confirm can
    still race a second confirmed link for one sign-up (the existing one-confirmed index refuses it with the old words).
  - **`/simplify` outcome (2026-11-04):** the name adapter (8 call sites) is now the roster's one `playerName`; one
    `sameName` predicate serves the matcher and the accept check; `lib/past-players.ts` no longer re-exports the rules
    (routes import `lib/past-player-rules` directly); `bringBackChild`'s override merge is a short loop (no casts); the add
    doors no longer count call-up games (the picker's read only). **Skipped on purpose:** one add-door orchestrator and a
    typed "already on season" error (bigger than a cleanup); dropping the roster page's `serverAsk`, one shared picker
    fetch, parallel bring-back (each changes screen behaviour — the walk exercises them); one "latest earlier entry"
    helper (the two loops differ at the same-year boundary on purpose).
  - **`/review` outcome (high, 2026-11-04) — fixed:** (1) after a "yes" at accept the join DELETES the sign-up's own child,
    so the "no"s were being stored against a dead id and the failure swallowed — they now go to the surviving child;
    (2) a "yes" passed arbitrary ids to the stored-no write (the child just confirmed, or an id from nowhere) — a "no"
    is now stored only against this sign-up's own namesakes, at accept AND at the single/paste add doors (so a name edited
    after the answer drops the stale "no" too); (3) "A different child — add anyway" was forgotten on the next request and
    the refusal looped — the window's "no" for that entry now also skips the refusal; (4) the accept's confirm raising the
    one-confirmed or one-child-per-season index was a 500 — both are now a 409 in plain words; (5) the guard test now
    enumerates the four routes that read the team's earlier roster entries (`CROSS_SEASON_ROSTER_READERS`, with the three
    answers); (6) the roster's "Back from…" read fetches the small season list first and skips the all-seasons read for a
    team with no earlier season; (7) the paste route's per-row lookup was O(n²); (8) the picker forgets its list when it
    closes, so a child just brought back is not offered again. Unit tests added for each rule fix.
    **Not fixed — owner questions:** (a) the continuity route's "Both are on the {team} {season} roster" words always name the
    ACTIVE season, but the index also refuses a join whose collision is on an EARLIER season — the drawn words are Ask 11's,
    so rewording (or naming the collided season) is the owner's call; the accept route reuses them. (b) Add Player's "Bring
    back a past player" door line closes the window without the unsaved-changes ask, exactly as the existing "Paste a list"
    door does — change both or neither.
- **S4 · documents and the health check (14c)** — **COMMITTED `285f2b1d7` 2026-11-05** (built 2026-11-04/05; finish run below; walk §458 owed; prod mig 441 owed). Part 0 presented; owner "go ahead" with all
  eight recommendations: (1) documents do NOT move — they stay on the season's entry; the child's papers are read through
  its entries (entry = whose + which season), so no backfill, no join/split step, no retention change (an entry holding a
  document already cannot be removed); (2) rows = the club's templates for the team + any type the child signed before on
  this team; validity = the template's, else the type default (a standalone coach gets defaults, no editor — a coach
  template editor is owed if wanted); (3) a coach sees their own team's papers only (Ask 9 narrowest; a child moving teams
  re-signs the medical consent for the new coach; the medical NOTE crosses); (4) the medical note stays where it is (Family
  & paperwork › Safety — the drawing's "Details" was wrong); (5) the child holds ONE current health value, each entry keeps
  its season's copy, live entries kept equal by trigger; (6) one wording "Still right for the {season}?", shown on a
  returning child's live entry with something on file, needs rosterWrite + rosterPii, saving Safety confirms; club's
  Confirm with S5; (7) the roll's documents line is composed from the team's real settings and shows only when the team has
  a template or a document; the club window gets the same line; (8) the validity choice is a plain two-option field in the
  shipped template windows (not drawn).
  - **Part 1 DONE:** mig **441** `papers_and_health_follow_the_child` (440 was taken by the bank session minutes earlier),
    applied to DEV; fixture `tests/sql/child-health-fixture.sql` 9/9, S2's 15/15 + S3's 4/4 re-run; dictionary +
    snapshots + MANUAL_PROD_STEPS (`pending`, with a pre-check).
  - **Part 2 DONE (2026-11-04/05):** the shared rule `lib/forms-coverage.ts` (`FormsHeld` = this season's types + the
    child's other entries on the SAME team; `validityOf`/`defaultValidity`); words + rows `lib/document-state.ts`
    (`documentStateRows`, `toSignLabel`, `healthAsk*`, `DOCUMENT_TYPE_LABEL` sentence case — the club's dialog label now
    re-exports it); server reads `lib/child-documents.ts` (`readHeldForms` paged, `readChildTeamDocuments`,
    `documentIsTheChilds`, `readHealthCheck`). Coach documents GET lists the child's own-team papers every season +
    rows + "N to sign"; POST keeps a row's `templateId` only when it is an active applicable template of that type (was
    unvalidated); the single-doc GET downloads a history copy, DELETE refuses an earlier season's (409). Player GET has
    `healthCheck` (rosterPii, working season); PATCH `confirmHealth` (needs rosterPii) or a CHANGED Safety value stamps
    `health_confirmed_*` (⚠ the page autosaves the whole form, so "sent" ≠ "changed"). Player page: the amber "Still
    right for the {season}?" + Confirm on Safety; the documents section's state rows, per-row Upload (icon-only 44×44
    on a phone), Season column, Delete on this season's copies only. Club template windows: "Signed" select (follows
    the type until changed; edit window PATCHes it), status line + page lede by validity; both template routes accept
    `validity`. Coach templates page: sentence-case labels + a "Signed" column. Rep Teams board + Families book read
    `readHeldForms` (the board's "13 of 14", the worklist's Missing forms, the family page's forms). The roll's note and
    both windows' papers line come from `rollDocuments` (the team's templates, else this season's types at their
    defaults; nothing when neither); the club's staff note no longer says documents start fresh. Look-back guard:
    three routes added to `CROSS_SEASON_ROSTER_READERS` with the answers. `.badgeTryout` deleted (its last users left).
  - **Part 3 (in progress):** `tests/unit/child-documents.test.ts` (new) + 17 affected suites 446/446; typecheck clean;
    lint 0 errors on touched files; spelling, dates, CSS purity/selectors (one other session's `statItem`), contrast OK.
    Layout (after two dev-server restarts — the first sweep aborted on the memory floor with the server at 4.9 GB):
    coach-player-family(-edit), coach-documents, admin-rep-documents(-upload), admin-rep-team-start-season(-players)
    at 361/390/768/1440 — **no new findings**; the one new one (the row Upload 38 px at 768) was fixed with a tablet tap
    floor. ⚠ Unmeasured: the upload window AFTER a type is picked (the "Signed" field), and the player page WITH the
    health ask (the fixture child has no earlier season) — measure them by eye at the walk. 3 baseline entries on
    admin-rep-documents ("Public site" link) no longer reproduce — not this work; left for whoever prunes.
  - **Defaults taken while building (raise at the walk):** (a) the history copy line reads "Uploaded {date} for the
    {season}." for an each-season form on file (not drawn); (b) the health line reads "Confirm the medical note and
    emergency contact once a season, or change them." (the drawing said "The coach or a parent confirms it" — the
    parent tier is off); (c) the ask shows only for a child with an entry on an EARLIER season and something on file;
    (d) the window's papers line names the team's each-season forms first, then "… carry"; (e) the type chip in the files
    table is the quiet chip (was the blue badge); (f) a row Upload on a tablet keeps its word.
  - **Finish run, step 1 · `/simplify` (2026-11-05):** "stricter wins" is now ONE helper (`validityForType`, used by the
    player-page rows AND the roll); `DOCUMENT_TYPE_ORDER` has one home (`lib/forms-coverage.ts`; the roll's copy, the two
    routes' `VALID_DOC_TYPES` and the template dialogs' `DOC_TYPES`/`DOC_TYPE_LABEL` aliases are gone); the child's-entries
    lookup is shared by the list and the history-download check. **Skipped on purpose:** the third `VALID_DOC_TYPES` copy
    (the admin per-player documents route — not S4's file); the `.pastChip*` rename (the picker is S3's, it would touch its
    layout baseline). Typecheck clean; 480 tests green.
  - **Finish run, step 2 · `/review` high (2026-11-05) — fixed:** (1) **the "Still right for the {season}?" ask never
    showed on a laptop** (it was hidden whenever the Safety form was open, which on a laptop is always) — now hidden only
    while a PHONE is editing Safety; (2) **mig 441 F1** an entry copied from a team's older record overwrote the child's
    newer medical note (and spread it to the other team's live entry) — the child's value now wins on insert; (3) **F2** a
    join where the kept child won left the absorbed side's live entries stale — the join now syncs them; (4) **F3** an
    entry made live again by a Reopen pushed all three of its (older) values to the child on a one-field edit — only the
    changed column travels now. Fixture is **12/12** (rules 10–12 are the three above; the old fill rule was put back as a
    mutant and rule 10 failed); S2's 15/15 and S3's 4/4 still hold. Also: the roll's documents read is org-scoped; a
    slow documents read for the player just left can't overwrite the open one; `healthConfirmedAt` is redacted with the
    other health fields for staff without roster details; "Last signed for …" is dropped when the season name is missing.
    **Counts (lens c):** on dev the board's Documents column and the Families book's Missing forms do NOT move — no
    good-until-replaced copy sits on an earlier entry yet (e.g. 15U AAA 9 of 12 and 4 missing, before and after).
    **Not fixed — owner questions:** (a) a paper the child signed before for a type the team NO LONGER asks for (template
    off, or none) still shows "Needs signing" on the player page (and in the roll's words) while the board and the Families
    book call the child complete — S4 Part 0 call 2 ruled the rows that way; say whether a no-template type should show
    only "On file". (b) The "Still right?" ask appears for a child whose only earlier entry is on ANOTHER team (the medical
    note crosses, "last checked" names nothing) — one bit of cross-team history; keep or own-team only. (c) A coach's edit
    on one team rewrites the child's other-team live entry with no confirm stamp, so the other coach's "Still right?" stays up
    over a value they did not enter. **Known, not changed:** two concurrent health saves for one child (or a save beside a
    join) can deadlock — Postgres aborts one, the coach sees an error and saves again (the same shape 435 already had for
    name edits); a cleared note can come back from a CLOSED entry on a split or a picker copy; the admin per-player
    documents route (not S4's) still stores an unchecked `templateId`.
  - **Finish run, step 3 · `/docs` (2026-11-05):** updated — the Rep Teams board's Documents description and the
    document-templates article (the new "Signed" choice; last season's copies stay on the player), the Families book's
    "Missing forms" line, the coach guides' Safety line ("Still right for the 2027 Season?"), the Player documents article
    (Needs signing / On file rows, "2 to sign", earlier copies download but don't delete) and Start next season (papers stay
    with the season; the closing summary no longer says to "re-collect waivers"). No S5 promise anywhere. Not touched:
    `premium-season-end` (it names documents only in passing — still true). **Demos:** `lib/demo-coach.ts`'s "1 unsigned
    waiver" (Riverdale Ridge 12U) is still true under the new rule (dev read: 11 of 12 on file before and after) — no
    `/demos` item. Spelling check clean; lint 0 errors.
  - **Finish run, step 4 · the walk (2026-11-05):** `OWNER_QA_LEDGER.md` **§458** — [interactive walk](https://claude.ai/artifact/ARfwd2i3rPuMHXEQkzM19c)
    · repository HTML `CLUB_TIER_STAGE14_S4_WALK.html`. One purpose, 8 parts (A–H) of 36 steps + I, nine owner calls
    ("Keep as built" first; I-7…I-9 are the review's three open questions). Dev fixture `.probe/s4-walk/` (a standalone
    team and a club-owned team, four sign-ins; `fixture.mjs --reset|--destroy`, `verify.mjs`). `verify.mjs` signed in
    without a browser and read the real routes: Liam "2 to sign" + the ask, Ella "1 to sign", Noah/Owen nothing, Mason the
    ask, the assistant refused (403) — ALL CHECKS PASSED. ⚠ Not seen on screen by me: the club-side pages (the club
    fixture's counts were computed in SQL), and the layout of the player page WITH the ask and the club's upload window
    with a type picked — part B asks the owner to look.
  - **Next: S5 (the child's page, the household list, the club's doors). Owed from S4: prod migration 441 (pre-check in
    `MANUAL_PROD_STEPS.json`), the §458 walk, and the three owner questions above.**

## ▶ S4 finish run (owner asked 2026-11-05 for all five steps in one session, in this order)

> **Paste:** `execute the "S4 finish run" in @docs/projects/active/CLUB_TIER_STAGE14_BUILD_PROMPT.md` into a new chat on `dev`.
> Read the S4 Progress entry above first (what landed, the Part 0 calls, the defaults taken). This run builds NO new
> feature: it cleans, reviews, documents, writes the walk and commits. A PM summary is not owed again (it was presented and
> ruled); do give the owner a short product-owner note at each step boundary. Recommended model: Opus 5.5; reading goes to
> helpers. Update the S4 Progress entry after each step. The dev server is shared — check `localhost:3000` answers before
> any layout run; never start a second one; restart only if a sweep aborts or memory is near the floor (AGENTS.md).

**S4's files (re-verify with `git diff` — several are SHARED with other sessions' uncommitted hunks):** new —
`supabase/migrations/441_papers_and_health_follow_the_child.sql`, `tests/sql/child-health-fixture.sql`,
`lib/document-state.ts`, `lib/child-documents.ts`, `tests/unit/child-documents.test.ts`; changed (S4 hunks only) —
`lib/forms-coverage.ts`, `lib/db.ts` (template mapper/create/update `validity`, roster mapper `healthConfirmedAt`,
`updateRepRosterPlayer` `healthConfirmedBy`), `lib/types.ts` (two fields), `lib/families-read.ts`, `lib/club-team-board.ts`,
`lib/rep-season-rollover.ts`, `lib/season-roll-path.ts`, `lib/club-season-words.ts`, `components/coaches/PlayerDocumentsSection.tsx`,
`components/coaches/StartNextSeasonModal.tsx`, `components/admin/kit/club/TemplateDialogs.tsx`,
`components/admin/kit/club/SeasonDialogs.tsx`, `app/[orgSlug]/coaches/teams/[teamId]/roster/[playerId]/page.tsx`,
`app/[orgSlug]/coaches/teams/[teamId]/documents/page.tsx`, `app/[orgSlug]/admin/rep-teams/documents/page.tsx`,
`app/[orgSlug]/coaches/coaches.module.css` (the `.docState*` + `.healthAsk` block, the `.badgeTryout` removal), the coach
player route + its `documents/` and `documents/[docId]/` routes, both `app/api/admin/rep-teams/document-templates` routes,
`tests/unit/{club-stage2-server-guard,coach-history-endpoint-guard,coach-people-phone-guard}.test.ts`,
`docs/agents/db/DATA_DICTIONARY.md`, `supabase/migrations/MANUAL_PROD_STEPS.json` (the 441 entry only), this file, the plan's
14c line, the TODO line. NOT S4's (leave alone): `app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx`,
`lib/help-content/coaches.tsx`'s existing hunks, migrations 440/442, everything billing / bank / public-page.

**1 · `/simplify`** on S4's files only. Candidates seen at build time (verify, don't trust): the "stricter wins" rule is
written twice (`documentStateRows` and `rollDocuments`) — one helper; `readChildTeamDocuments` and `documentIsTheChilds`
both resolve "the child's entries on this team" — share it; `VALID_DOC_TYPES` is copied in three routes (pre-existing — fold
into one export only if cheap); `TemplateDialogs`' `DOC_TYPE_LABEL`/`DOC_TYPES` re-exports (keep or inline the import); the
reuse of the picker's `.pastChip*` classes for document chips (rename to a neutral chip only if no layout baseline moves).
Skip anything that changes what a screen shows. Re-run the affected unit suites after.

**2 · `/review` at high** (migration + triggers on the roster write path + a route that widened its read). Lenses to give
the reviewers: (a) **trigger safety** — the four health triggers on `rep_roster_players` / `org_children` fire on the roll's
inserts, bulk add, the picker, `accept_tryout_and_create_dues`; recursion stops after one hop; lock order vs
`org_children_join` (which locks children first) — can a roll + a confirm deadlock?; the join's health carry runs BEFORE the
absorbed record's delete; the split re-reads BOTH sides; (b) **privacy** — Ask 9 own-team only (`readChildTeamDocuments`,
`readHeldForms`, `documentIsTheChilds` all scoped to team + non-call-up), `rosterPii` still gates every documents read and
the health ask/confirm, a history download cannot reach another team's or child's file by id; (c) **the counts move** — on
dev, compare the Rep Teams board's Documents column and the Families book's Missing forms before/after (stash-free: run the
old rule in a probe) and state the numbers; (d) **the autosave** — the health stamp fires only on a CHANGED Safety value or
Confirm, never on an unrelated field save; (e) the upload's `templateId` check; the DELETE 409 on an earlier season's copy;
(f) the roll's note and both windows' papers line on a team with no templates, only templates, and templates + papers.
Fixes to the migration go in the 441 file AND dev (its statements are re-runnable: `add column if not exists`, constraint
drop-if-exists, `create or replace`, the backfill loop) — then re-run all three SQL fixtures
(`node .probe/s2-child/q.mjs --file tests/sql/{child-health,org-children,child-match-rejections}-fixture.sql`, expect 9/9,
15/15, 4/4) and a deliberate mutant that must fail.

**3 · `/docs`.** Known stale: `lib/help-content/rep-teams.tsx` ~338–351 ("Families sign again each season, which is why the
board's Documents count starts at zero on a new season") and the templates article; `lib/help-content/coaches.tsx`
`recipe-track-documents` (~6371), `recipe-start-next-season`, `premium-season-end`, the Family & paperwork / Safety lines
(~1396); the Families help that names "Missing forms". Say what S4 does, never promise S5's child page. Demos: do NOT
hand-edit; check whether `lib/demo-coach.ts` ~805 ("1 unsigned waiver") is still true under the new rule and record it as a
`/demos` item if not (the cycle's curation runs once at the end of Stage 14). `lib/walkthrough-content.ts` stays
`/marketing`'s.

**4 · The walk** — next free `OWNER_QA_LEDGER.md` § (§457 was the highest on 2026-11-05; check), ONE purpose: **"papers
follow the child"**, as a checkable Artifact with paste-back (memory: QA walks). Build a dev-only fixture in
`.probe/s4-walk/` modelled on `.probe/s3-walk/` (`--reset`, `--destroy`): a team with a closed 2025/2026 season and a live
one; a returning child whose earlier entry holds a waiver, a code of conduct and a medical consent, plus a medical note and
emergency contact; a club template set; an assistant without the roster-details grant. Outline: A the coach's Family tab
rows (Needs signing / On file, "Last signed for…", "2 to sign"); B a row's Upload → On file, the count drops; C an earlier
season's copy downloads and has no Delete; D "Still right for the {season}?" → Confirm → gone; a jersey-number edit does NOT
clear it, an allergy edit does; E the club's "Signed" choice — defaults by type in the upload window, changing the waiver to
"Good until replaced" flips the coach's row to On file; F the Rep Teams board count and the Families book's Missing forms
agree with the player page; G Start next season, both portals: the papers line, and the success bullet; H a phone (Upload
icon 44 × 44, Confirm full width) — and measure by eye the two screens the sweep could not (the upload window with a type
picked; the player page with the ask); I the assistant without roster details sees no documents and no ask. Put the six
"Defaults taken while building" (a)–(f) as calls with "Keep as built" first. Publish, add the ledger §, link it here.

**5 · Commit** (the owner authorized it in this request — the walk's results are not a gate; anything the walk finds goes in a
later commit). On `dev`. Stage explicit paths only; for a SHARED file take only S4's hunks (memory: "Partial commit out of
shared files" — temp index, exact hunks); `git diff --cached --name-only` before committing and `git show --stat HEAD`
after. `npm run refresh:snapshots` first; include the snapshot files only if their diff holds nothing but 441's objects
(other sessions' 440/442 are on dev too) — otherwise leave them and say so. One commit for the feature (+ its records) is
fine; message says what changes for the coach and the club. Then record the hash in the S4 Progress entry, the TODO line and
the plan's 14c line, and hand off with: the walk link, prod mig 441 owed (with its pre-check), and S5 next.
- **S5 · the child's page, the household list, the club's doors (14d part 1)** — **BUILT + finished 2026-11-05 (committed `f455aeb13`).** Part 0 presented;
  owner "agree as recommended, go ahead" on all eight calls: (A) the household's Children list is ALREADY one line per child
  for nearly every family (E08: each child once, older same-name lines hidden) — the drawing's "Today" frame overstated it; a
  child with two CURRENT seasons (rep + house league) keeps two money lines because "Record a payment" works per line — S5 adds
  the door (the name opens the child's page) and the sub-line ("3 seasons · 2 documents to sign"), nothing else; (B) "Split
  records" is NOT shown until S6 builds it (no dead button); (C) the club's health Confirm stamps every LIVE entry of the child
  (clears every coach's ask — the value is the child's); (D) documents per TEAM, never pooled (same rule and count as the coach
  page, board and Families book); read-only on the child page (no upload/download); a house-league "waiver accepted at
  sign-up" shows in the Waiver row's history; (E) the coach's "With the {team} {years}" line only for a child with ≥2 seasons
  on this team, runs compressed ("2022–2025 · 2027"); (F) search keeps opening the household (it already matches child names) —
  no child-level result list; (G) no door on the house-league registrations list / teams board in S5; (H) Ask 9's widening
  switch is OWED, not built (nothing to widen yet — a coach sees only their own team). Doors: a household's child name, a name
  on any rep roster (live roster + the past-season record; a link only for an admin with Families access), the "No family on
  file" rows. No migration. Walk = §462 ("one page per child").
  - **BUILT 2026-11-05 (Parts 1–4), uncommitted.** What landed:
    - **Words + pure rules** `lib/child-page-words.ts` (season statuses, `repFeesLine`/`leagueFeesLine` — "$1,450.00 · $725.00
      paid" / "Paid in full" / "No dues" / "No fee" / "Not owed yet", `sortSeasonRows`, `currentChip`, the phone row lines,
      `yearsLine`/`withTeamLine` ("2022–2025 · 2027"), `householdChildSub`, `documentRows`/`historyOnlyRows`/`documentsSentence`).
    - **Server read** `lib/child-page.ts`: `buildChildPage` (child record; non-call-up rep entries; sign-ups not declined;
      rep fees via `readRepMoney`; a sign-up's fee via the new `loadRegistrationsReceivedCents` in `lib/league-money-read.ts`;
      documents per team with a LIVE entry by `readChildTeamDocuments` + `documentStateRows`, else the newest team's history;
      a sign-up's accepted waiver joins the Waiver history; the ask = the coach's `readHealthCheck` on the newest live entry;
      parents = people on the entries + a co-guardian whose newest link is verified, else the newest typed guardian with no
      door) and `confirmChildHealth` (stamps every live, unstamped entry of the child; writes no value).
    - **Routes** `GET /api/admin/families/children/[childId]` and `POST …/[childId]/health` (409 nothing to confirm) — both
      `requireFamiliesAccess`, org-scoped, a malformed id = 404.
    - **Page** `/admin/families/children/[childId]` (`ChildPage.tsx` + `ChildPage.module.css`): header back to the household
      (`?from=` when that person is a parent) else Families; Born + now chips; Seasons (table / phone rows); Documents and
      Health side by side ≥1024px; Parents (each opens the household). `FamiliesFrame` draws no title or tab row over it
      (`isFamiliesChildPage`); `usePageTitle(null)` sets nothing (a parent's effect runs after its child's).
    - **Doors:** the household window's child name (`FamilyChildLine.childId` + `sub`), the rep roster and the past-season
      record names (only with `canOpen('module_families')`, never a call-up), the "No family on file" rep rows (`href`).
    - **Coach:** the player GET returns `withTeam` from `readYearsWithTeam` (same-team scope as the papers); the glance row
      shows it as a quiet chip. Registered in `coach-history-endpoint-guard` (`READS_EARLIER_ROSTERS` + the comment).
    - **Checks:** typecheck clean (needs `NODE_OPTIONS=--max-old-space-size=8192` — the default 4 GB ran out); new
      `tests/unit/child-page.test.ts` 20/20; the neighbouring suites 841 + 679 green; eslint 0 errors; spelling OK.
      **Dev proof** `.probe/s5-walk/` (fixture `--reset|--destroy`, `verify.mjs` 21/21: Maya's three seasons and fees, the
      drawn document rows, the ask, Grace with a door, Jonah's typed guardian and his no-family door, the household line
      "3 seasons · 2 documents to sign", the coach line, the coach refused the club page, the club Confirm clears the coach's
      ask and keeps the closed entry's stamp, a second Confirm 409); `look.mjs` read the S4 club too. ⚠ The fixture JOINS
      Maya's Summer 2025 sign-up to her record BY HAND (S6 builds the join).
    - **Layout:** new screen `admin-family-child` (+ `clubChildId` in the fixture context). `coach-player` clean at all four
      widths; `admin-family`, `admin-rep-team-roster` clean at 361; `admin-family-child` @361 had 4 findings — the rest of
      the run was cut short when the shared UAT club (`uat-rep-club`) was deleted mid-run by another session (signed out,
      then gone). **Re-run owed:** `node scripts/check-layout-invariants.mjs --only=admin-family-child,admin-family,admin-rep-team-roster`
      once the club fixture is back.
    - **Defaults taken while building (raise at the walk):** (a) the household line's "documents to sign" uses the Families
      book's forms rule (templates only), the page uses the coach's rule — they differ only for a type signed before that
      the team no longer asks for (S4 owner question (a)); (b) a team-limited member with Families sees the roster link
      and the layout refuses them (the client has no group list); (c) the house league's own screens get no door (call G);
      (d) a finished house-league sign-up that was waitlisted/in review reads "Finished"; (e) the club Confirm stamps live
      entries even where that entry's own coach was not asked (a first-season entry) — harmless, it is the child's value.
    - **`/legal` (2026-11-05, helper):** no admin surface read the medical note before; our draft privacy policy promises
      health info is sensitive and limited to whom the CLUB authorizes — still true, so not a FieldLogicHQ-promise defect.
      The real exposure is PIPEDA need-to-know (Families also goes to finance/registrar roles) and two gaps the draft already
      names (no MFA for accounts that can open children's medical notes; no breach register; L11). **Fixed now:** the
      Families grant's words in Manage member (`member-summary.ts` gains/loses) now say "…and each child's medical note and
      emergency contact". **Owner question (open):** B a separate "health details" grant (like the coach's roster
      details) · C keep Families-only and log each read · D the note collapsed behind "Show health details", the open
      logged. Lawyer, later (not a gate): health data under the club-controller / FieldLogicHQ-provider split.
  - **Finish run DONE 2026-11-05** (simplify, review high, docs, layout re-measure, walk, commit):
    - **/simplify:** dead `seasonsCount` removed; the two row shapes typed (`RepRow`, `LeagueRow`) and the repeated sort/year/team reads gathered; the posted-cents fold shared (`sumPostedCents` in `lib/league-money-read.ts`, used by the org read and the one-child read); the parents' display name reused from the household's; the page loads parents and templates with its other reads; Confirm reads only the child and its rep entries; document counts read each row's `state`, not the chip's words; the parents block hoists its two helpers. Skipped on purpose (noted): the co-guardian rule shared with `householdOf` (shared file, no behaviour change), a `ChildNameLink` for the two roster pages (5 lines each), per-team document reads re-using the entries already loaded, the route-group move for the frame (medium, dirty tree).
    - **/review (high), four lenses:** access — clean (`requireFamiliesAccess` on both routes and the layout, org-scoped, malformed id 404, mig 441 triggers do not fire on the Confirm's UPDATE, no double-stamp against a coach's save); money/counts — fixed the house-league fee cell (a not-active sign-up with money received now reads "$X paid" or "Nothing owed", never a figure that reads as owing; a $0 fee reads "No fee"); regression — stale comments in `FamiliesBook` corrected; coach `withTeam` — clean. **Fixed from the gate:** a type field tripped the house-league money guard (`registration_fee_paid?`); two hand-built possessives now use `possessive()`. **Added:** the Confirm writes `families_child_health_confirmed` to the club's activity log (child id + count, no values). **Carried to the walk as calls:** (a) now wider than first written (draft-season teams count on the page not the household line; two templates of one type count 2 vs 1; a waiver no longer asked for), (b) a team-limited member with Families sees a link that bounces, (g) the rep fee cell vs the balance when a credit covers part, (h) browser Back from the family window, and the Confirm asserts "right" without proving which value the club saw (Low-Medium; the same model as the coach's own Confirm).
    - **/docs:** Families help — new article "One page per child" (`families-child-page`), the Children list, the search article, "No family on file" and its FAQ; Rep Teams help — roster and past-season names open the child's page (accept-a-player recipe, past seasons); Coaches help — the player page's "With the {team} {years}" line (profile FAQ). Nothing promises S6. **Demos:** no tour stop touches Families, so no `/demos` item.
    - **Layout:** the shared test club was present again (another session's second "Chidi Okafor" with five house-league sign-ups broke the sweep's lookup; the sweep now picks the seeded one by email — the other session's data untouched). `admin-family-child` had the back link's path text under the 44 px floor and two phone lists painted twice; the header now holds only the back link, the lists pass `inset`. `admin-family-child`, `admin-family`, `admin-rep-team-roster`, `coach-player` clean at 361 / 390 / 768 / 1440.
    - **Walk:** §462 — https://claude.ai/artifact/5kvoxyHeMkZymmSSarzD2v. Committed `f455aeb13` (34 files, no migration). The dev server was restarted (new files) before the hand-over.
- **S6 · joining records + the parent link (14d part 2, Ask 13)** — Not started. Needs S5.

## ▶ S5 finish run (owner asked 2026-11-05 for simplify, review, docs, walk and commit in one session, in this order)

> **Paste:** `execute the "S5 finish run" in @docs/projects/active/CLUB_TIER_STAGE14_BUILD_PROMPT.md` into a new chat on `dev`.
> Read the S5 Progress entry first (what landed, the eight Part 0 calls A–H, the defaults (a)–(e), the `/legal` outcome). This
> run builds NO new feature: it cleans, reviews, documents, re-measures, writes the walk and commits. A PM summary is not owed
> again; give the owner a short product-owner note at each step boundary. Recommended model: Opus 5.5; reading goes to helpers.
> Update the S5 Progress entry after each step. The dev server is shared — check `localhost:3000` answers; never start a
> second one; it needs ONE restart before the owner browses the walk (S5 added files) — do it at step 5, not mid-sweep.
> Typecheck needs `NODE_OPTIONS=--max-old-space-size=8192` (the default 4 GB runs out).

**S5's files (re-verify with `git diff` — several are SHARED with other sessions' uncommitted hunks; take only S5's):** new —
`lib/child-page-words.ts`, `lib/child-page.ts`, `components/admin/kit/club/families/ChildPage.tsx` + `ChildPage.module.css`,
`app/[orgSlug]/admin/families/children/[childId]/page.tsx`, `app/api/admin/families/children/[childId]/route.ts` and
`…/[childId]/health/route.ts`, `tests/unit/child-page.test.ts`; changed (S5 hunks only) — `lib/families-read.ts` (the line's
`childId` + `sub`, `childIdOfKey`, `childSubLines`, the no-family rep `href`), `lib/league-money-read.ts`
(`loadRegistrationsReceivedCents`), `lib/admin-kit-nav.ts` (`familiesChildHref`, `isFamiliesChildPage`), `lib/usePageTitle.ts`
(accepts null), `lib/child-documents.ts` (`readYearsWithTeam`), `components/admin/kit/club/families/FamiliesFrame.tsx`,
`components/admin/kit/club/families/FamilyRecordWindow.tsx`, `components/admin/kit/club/member-summary.ts` (the Families grant
words), `app/[orgSlug]/admin/rep-teams/teams/[teamId]/roster/page.tsx`, `app/[orgSlug]/admin/rep-teams/teams/[teamId]/history/[yearId]/page.tsx`,
the coach player route + page (`app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/route.ts`,
`app/[orgSlug]/coaches/teams/[teamId]/roster/[playerId]/page.tsx` — the `withTeam` hunks), `tests/unit/admin-kit-nav.test.ts`,
`tests/unit/coach-history-endpoint-guard.test.ts`, `scripts/layout-screens.mjs` (`admin-family-child`),
`scripts/uat-fixture-context.mjs` (`clubChildId`), `scripts/check-layout-invariants.mjs` (the `__CHILD__` placeholder), this
file, the plan's 14d line, the TODO line. Dev-only, untracked: `.probe/s5-walk/` (`fixture.mjs --reset|--destroy`,
`verify.mjs` 21/21, `look.mjs`, `okafor.mjs`).

**1 · `/simplify`** on S5's files only. Candidates (verify, don't trust): `lib/child-page.ts` is loosely typed (`any` rows, 26
lint warnings) — type the two row shapes if cheap; the "newest live entry" sort is written twice in `buildChildPage`; the
typed-guardian parent and the household's typed guardian may share a rule with `families-read`; `householdOf`'s verified-link
rule is restated in `readParents` — one helper if it stays readable; `seasonsCount` in the words module may be unused; the
two roster pages repeat the name-link JSX. Skip anything that changes what a screen shows. Re-run `child-page`, `admin-kit-nav`,
`coach-history-endpoint-guard`, `member-summary`, the `families-*`/`club-stage5*` suites, and `verify.mjs`.

**2 · `/review` at high** (a new read across rep + house league + money, a new write on roster entries, a new gate). Lenses:
(a) **access** — both routes behind `requireFamiliesAccess`; every read org-scoped (`league_teams` has no `org_id` — scoped by
the child's own sign-ups); a team-limited member; a coach; another org's child id; (b) **the Confirm write** — stamps only LIVE,
unstamped entries of THIS child, writes no value, never a closed entry; a race with a coach's Safety save; what the 441
triggers do on that UPDATE; (c) **money parity** — a season's fees equal the team's Money hub / the house league's book for
the same child (compare on dev); a negative balance; a withdrawn sign-up with a refund; (d) **counts parity** — the household
line's "documents to sign" vs the page's (default (a) — state when they differ), the "seasons" count vs the page's rows
(declined, call-up, withdrawn); (e) **the household window** — `FamilyChildLine.childId` on every line kind (money line keys
`child:{id}|{season}`), Record a payment and the hand-off chips unchanged; (f) **nav** — the frame skips its title/tabs only on
the child page; the page title not overwritten; `?from=` of a person who is not a parent; (g) the coach's `withTeam` — own
team only, call-ups excluded, the look-back guard registration.

**3 · `/docs`.** Families help (`lib/help-content/families.tsx`): `families-family-page-money` ("Children lists each child
once…" — now each name opens the child's page, and the sub-line), `families-no-family` / `faq-no-family-on-file` (a rep row now
opens the child's page), a NEW short article for the child's page (seasons, documents per team, the health check and Confirm
clearing the coach's question, parents; no add-player door), the search article (search opens the household — say the child
is one click further). Rep Teams help: a roster name opens the child's page for someone with Families. Coaches help: the
player page's "With the {team} {years}" line (`premium` player-page article — find it). Never promise S6 (joining, split, the
parent link). Demos: do NOT hand-edit; note whether any demo tour stop needs the new door (record a `/demos` item if so).

**4 · Re-measure, then the walk.** First the layout re-run S5 could not finish (the shared `uat-rep-club` fixture was deleted
mid-run by another session): `node scripts/check-layout-invariants.mjs --only=admin-family-child,admin-family,admin-rep-team-roster,coach-player`
— if the club fixture is still missing, ask the owner before reseeding it (a reseed signs everyone out). Fix any new finding on
the child page (4 were seen @361, unread). Then the walk: `OWNER_QA_LEDGER.md` **§462** (check it is still free), ONE purpose:
**"one page per child"**, a checkable Artifact with paste-back (memory: QA walks). Fixture `.probe/s5-walk/` (`--reset` first;
sign-ins `s5-walk-admin@dev.local`, `s5-walk-clubcoach@dev.local`, password in its CREDENTIALS.md; say on the page that Maya's
Summer 2025 house-league season is joined to her record by hand — S6 builds that join). Outline: A the household (Grace Chen):
Maya's line "3 seasons · 2 documents to sign", Leo's line with no sub-line, each name opens the page and Back returns to the
family; B Maya's page — the chips, three seasons newest first with their fees, the house-league row; C Documents — Waiver and
Code of conduct "Needs signing" with their history (incl. "Summer 2025 waiver"), Medical consent "On file" by its date, "2 to
sign"; D Health — the note, the contact, "Still right for the 2027 Season?" → Confirm → gone; then sign in as the coach: Maya's
page no longer asks; E Parents — Grace opens her household; Jonah's page shows the typed "Ana Ruiz" with no door; F the doors —
the S5 Lynx roster name, a past season's record name, the "No family on file" row for Jonah; G the coach's player page "With
the S5 Lynx 2026 · 2027"; H a phone (Seasons as rows, documents as one sentence, Confirm full width); I who is refused (the coach
opening the club page's address). Calls ("Keep as built" first): the five defaults (a)–(e) and **the health-details question
from `/legal` — B a separate permission (recommended) · C a read log · D collapsed + logged**. Publish, add the ledger §, link it
in the Progress entry. Restart the dev server (AGENTS.md sequence) before handing the walk over.

**5 · Commit** (the owner authorized it in this request; the walk's results are not a gate — what it finds goes in a later
commit). On `dev`. Explicit paths only; for a SHARED file take only S5's hunks (memory: "Partial commit out of shared files" —
temp index, exact hunks); `git diff --cached --name-only` before, `git show --stat HEAD` after. No migration, so no snapshot or
`MANUAL_PROD_STEPS` change. Message says what changes for the club admin and the coach. Then record the hash in the S5 Progress
entry, the TODO line and the plan's 14d line; hand off with the walk link, the health-details owner question, and S6 next.

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
