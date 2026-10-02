# Which game an award is for — plan

**Hub (mockup · brief · plan · decisions on one URL):** https://claude.ai/artifact/BaSM8ojh6AjMup6VJArCUv —
source `docs/projects/active/COACH_AWARD_OCCASION_HUB.html`. PM brief: `COACH_AWARD_OCCASION_PM_BRIEF.md`.

**Status:** drawn 2026-10-01; **ruled 2026-10-02** ("I agree with your recommendations, proceed" — all four as
recommended); **built on dev 2026-10-02** (see *As built*); **/review 2026-10-02**, four fixes before the commit; **committed `55c237ee` 2026-10-02**. **Owner QA §257 ✅ PASSED
2026-10-02** — W1 8/8, W2 6/6; two calls from W1 fixed (the double-check names ONE action — "If it’s the same award,
close this without saving." — and sits at note size). Production with the next promote; no migration.

## Where it came from

Production, 2026-10-01: Alex Tennant (Milton Bats U13 Purple) showed 🏆 2× MVP for one game. Read-only
check of `rep_player_awards`: the coach gave the award twice. 7:26 a.m. from the Awards page's Give an
award, whose only occasion field is free text ("Majors game MVP", no event, dated the day given, Oct 1);
7:28 the Sep 30 game's 14–3 score was entered (a game can't carry an award until it is scored); 7:29 the
same MVP from the game itself (linked, dated Sep 30). Two real rows; the once-per-occasion rule (mig 289)
can't see them, because a typed occasion and a game are two occasions. Production data was not changed —
the coach removes the Oct 1 row with the bin icon.

This is the next step the *Awards at any event* plan (2026-09-25) named and left out of scope: "a 'For'
picker on the report's Give form listing schedule events".

## Findings

- **F01 — The Awards page can't say which game.** `GiveAwardModal` with `eventContext` null shows only a
  free-text "Tournament or occasion" input; the award is stored with `tournament_label` and no `event_id`.
- **F02 — A game without its score is invisible from the Awards page.** `awardUnlockState` ('needs-score')
  is shown only in the game's window ("Enter a final score to unlock awards for this game.").
- **F03 — Nothing notices a near-duplicate.** `sameAwardOccasion` / `findRepPlayerAwardCollision` and the
  two partial unique indexes key on the event, or on date + label.
- **F04 — A typed occasion is always dated the day given.** The window sends no date; the POST route
  defaults `awarded_at` to `tournamentToday()`.

## Proposal (as drawn; subject to the rulings)

1. **"For" dropdown** on the Awards page's Give window (new award only; edit mode and the game window
   unchanged): the season's events that have happened, newest first, labelled by `awardOccasionLabel` with
   the day and a game's result; then **Something else** (today's free-text box + a **Date**, default today)
   and **The season** (general). Opens on the newest event (question 2). A portal-drawn dropdown, not a
   native select (sublines and a greyed row with a reason).
2. **A game needing its score** is listed where it falls, greyed, "enter its score first" (question 3).
3. **A quiet double-check** in the shared window (both doors): when the player already holds the same
   award for an occasion within two days either side, an amber line above Save names it. Never blocks;
   the exact same game is still refused at Save as today (question 4).
4. The Player and Award labels get the plain required asterisk (ruling of 2026-08-26).

## Approach

- `GiveAwardModal` gains the team's events and existing awards from its two callers (the Awards page and
  `ScheduleEventSheet` already load both). No new request.
- One pure list function beside `awardUnlockState` in `lib/rep-award-occasion.ts` (order, unlock state,
  label); one pure near-duplicate predicate beside `sameAwardOccasion`. Words in the same module.
- Server: the POST route already accepts `eventId` and refuses an unscored game; a typed occasion posts
  its date as `awardedAt`. **No migration.**

## Checks

Unit tests for the list and the predicate (one day, three days, the award being edited, a different
player, a different award) · layout sweep on the Awards page and the game window, both themes · /review ·
/docs (the giving-awards help) · a QA walk on the hub.

## As built (2026-10-02)

- **Rules, one home:** `lib/rep-award-occasion.ts` — `awardForOptions` (what has happened, newest first, via the same
  `awardUnlockState` the server refuses by; a started game with no score is `needs-score`; cancelled and future never
  listed; the day is the org's, `orgDayKey`), `awardForSubline` ("Wed Sep 30 · W 14–3", "· enter its score first"),
  `nearDuplicateAward` (same player + award type within `NEAR_DUPLICATE_DAYS` = 2, excluding the award being edited;
  nearest, then newest given) and `nearDuplicateSentence`; the words in `AWARD_FOR_WORDS`.
- **The window:** `components/coaches/GiveAwardModal.tsx` asks For only for a NEW award with no event of its own.
  ⚠ **Not a new picker:** it is `SublinedChoice`, the portal's sub-lined dropdown — it floats over the window (an
  in-flow list was rejected on sight in the §80 walk: opening a field must not resize the window). `SublinedChoice`
  gained one option field, `disabled` (`aria-disabled`, greyed, says why in its sub-line, ignores the tap).
  Four newest events, then an *Other* band (Something else, The season), then *Earlier in the season* — four because
  that fills `.convWhatList`'s height exactly; at six the two non-event answers opened below the fold (measured).
  The closed field shows the sub-line only for an event. Something else adds Occasion + Date * (max today). Player and
  Award take the plain asterisk. POST: an event → `eventId`; Something else → `tournamentLabel` + `awardedAt`; The
  season → neither. The amber line (`.awardNear`, `role="status"`) sits between Award and Note and never disables Save.
- **The doors:** the Awards page reads `/events?to=<now>` the first time Give opens (it loaded no events before) and
  passes `forEvents` + `existingAwards`; a failed read leaves only Something else and The season. The game window
  (`ScheduleEventSheet`) passes `existingAwards` and `eventContext.day`.
- **Server:** the awards POST refuses a typed occasion dated after today (400, `AWARD_FOR_WORDS.futureDate`).
- **Help:** `lib/help-content/coaches.tsx` — the *Awards at any event* sub-topic, the *How do I give a player an award?*
  FAQ (answer, `answerText`, keywords) and the leaderboard FAQ's Give sentence.
- **Proven:** `tests/unit/coach-award-for.test.ts` (pure rules + source guards); full unit suite 5,459 pass;
  `verify:changed` green; typecheck and lint clean; layout sweep of `coach-history-awards` Warm and Dark, no new
  findings; probes `.probe/award-for-shots.mjs` + `.probe/award-for-near.mjs` (1440 + 390, Warm + Dark; the near-line
  probe answers the awards GETs with one stand-in MVP and writes nothing).

- **/review (high-risk, four lenses, 2026-10-02) — fixed before the commit:** the For list is read FRESH on every open
  (it was read once per visit, so a game scored after the first open stayed "enter its score first" until a reload; a
  run counter drops an older read); two events on one day list by START TIME (a doubleheader had fallen to an id
  tie-break and could open on the earlier game); a Date box cleared to '' matches no award (it read as 0 days apart);
  a greyed row's keyboard focus is a quiet outline, not the "choosable" fill. **Report-only:** a staff member with
  award access but Schedule Off is refused the events read and sees only Something else / The season (correct — the
  list IS the schedule); the phone award sheet's edit has no double-check (ruling 4 named the Give window's two doors);
  the sales walkthrough's award slide ("for any occasion you type in", `lib/walkthrough-content.ts` #21) is still
  true but undersells — /marketing's copy; "Something else" with a blank Occasion saves a dated general award, as drawn.

## Not in scope

Removing Alex's Oct 1 award (the coach's bin icon, or on the owner's say-so on production) · changing an
existing award's event (still remove and give again).
