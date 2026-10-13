# Tournament admin redesign · Stage 3 defects pass (A45): the generators and the schedule's silent saves, fixed now

> Paste into a fresh session on `dev`. **Run this BEFORE the Stage 3 build**
> (`TOURNAMENT_ADMIN_REDESIGN_STAGE3_BUILD_PROMPT.md`). Both touch the schedule page and its generators, and this pass is
> small. Written 2026-10-09, the day the owner ruled Stage 3 from the hub's paste-back: S1–S8 as drawn, A33–A46 as
> recommended. A45 says: *"A defects pass now, its own prompt and commit (as Stage 1's was)."*
>
> **The record:**
> - Plan `TOURNAMENT_ADMIN_REDESIGN_PLAN.md`: §3 F69–F73, and §6c (the asks; "Ruled 2026-10-09, and what the two prompts
>   add").
> - Hub https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM: the **Stage 3** tab (S3 the generator, S8 publishing, the asks
>   A45 and A46) and the Decisions tab.
>
> **Read first:**
> - Memory: `project_tournament_admin_redesign`, `reference_code_gotchas_index` (dates and clocks through
>   `formatStoredDate`/`formatTime` only), `reference_probe_asserts_on_state`, `reference_probe_scratch_dir`.
> - The original defects pass, `TOURNAMENT_ADMIN_REDESIGN_DEFECTS_PROMPT.md`: same shape, same rules.

## What this is, and what it is not

Six live defects the Stage 3 measuring found on the schedule. Each is one of three kinds:
- **lost data:** a save that deletes played games;
- **a wrong answer:** a draft that double-books another division's diamond;
- **silence or a false sentence:** a refused save that says nothing; a moved bracket game that tells no one; a promise
  the Publish window doesn't keep.

**None is a redesign.** The Stage 3 build redraws the generator, the game window and the Publish window. Here, change
behaviour and the fewest words that make each screen honest:
- **Don't restyle or rearrange.** Don't fold the old look; the build retires it.
- **Don't add features.** In particular, don't count the club's other bookings in the drafts (S3, the build's work).

**One visible change is ruled, and it is part of the fix:** the generator's *Replace all | Build from current* switch
goes.
- S3 drew it gone: *"today's Build from current made the only behaviour"*.
- Once saving never deletes a played game, the two choices are the same.

## Preconditions

1. **The dev server works.**
   - Don't fix another session's code; tell the owner and wait.
   - Start it only with `npm run dev`, with network access (`AGENTS.md`).
2. **Ask the owner whether another session is measuring** before any probe, `auth-setup` or sweep. One browser tester at
   a time; scope any sweep with `--only=`.
3. **The UX summary for the owner comes first** (AGENCY_RULES). Keep it short: per defect, what the organizer sees
   differently, then P1.
4. **One placement the drawing does not show. Put it to the owner in the summary, with the recommendation.**
   - **P1 · How a replace becomes one step.**
     - Today the generator clears games in one request, then saves the draft in a second (`Generator.tsx`
       `commitTeams` ~960 and `commitSlots` ~982 both call `deleteGamesForCurrentScope` before `bulk-save`).
     - If the save fails, the division has lost its games and the draft is unsaved: *"deleted, then failed to save"*,
       which A45 rules out.
     - **Recommend:** one server action that writes the new games first, then removes the ones they replace. If the
       removal fails, it takes its own new games back out and says so. No migration. The worst case is a visible
       duplicate the organizer can see, never a lost game.
     - **Alternative:** a database function that does both inside one transaction. Truly atomic, but a migration (the
       dictionary and both snapshots in the same unit, and production before the code).
5. **Words go to `/marketing`.** You decide where a sentence goes and when it shows; `/marketing` writes it. Run it once,
   on this list:
   - the generator's save question once the switch goes: what it adds, what it replaces (*games still to play*) and
     what it keeps;
   - the refused-save message (F71);
   - the Publish window's reminder sentence (F73).

   Today's *"permanently clear any existing games"* becomes false in this pass.

   **⚠ The save question must not say teams are told.**
   - S3's drawn line is *"Their teams are told if U13 is published"*.
   - The generator's save tells no one today: `bulk-save` records no schedule change.
   - Making it true is the build's work, so the words must say what happens after this pass.

## ⚠ Running beside other work (as of 2026-10-09)

- **Club Tier Stage 6b** has a build prompt and may be building: the club calendar, the venue library, a migration.
- **Club Stage 6a's clash work is committed and shared:** every tournament writer returns `crossProgram`;
  `lib/booking-length.ts`, `lib/venue-clash*.ts`, `lib/schedule-conflict.ts`.
- **If any file you need holds someone else's uncommitted edits, stop and tell the owner** rather than editing around
  them. Files to check: `app/api/admin/games/route.ts`, `lib/schedule-conflict.ts`, `lib/game-delete-policy.ts`, the
  schedule page or its generators.
- Typecheck your commit's own tree in an isolated copy if the whole tree is red from other work.

## The six

Re-read each cited line first; they may have moved.

1. **F70 · Saving a round-robin draft deletes played games, with their scores.**
   - **Today:**
     - `generationScope` defaults to `'replace'` (`Generator.tsx` ~235).
     - `deleteGamesForCurrentScope` (~1075) then sends `delete-division-games`.
     - The route's delete (`app/api/admin/games/route.ts` ~595) is scoped by `applyDivisionRoundRobinDeleteScope`
       (`lib/game-delete-policy.ts:40`): the division, `is_playoff = false`, **any state**. Final, submitted,
       forfeited, cancelled and kept games all go.
     - Its question says *"permanently clear any existing games"*.
     - On the demo's Friday, U11's round robin is all played, so the default would delete six final scores.
   - **Build from current already holds the ruled rule:**
     - `replaceableExistingGames` (~276): round robin, `scheduled`, not `generatorLocked`.
     - `preservedExistingGames` (~281): everything else, playoff games included, fixed as taken assignments in
       `getPartialContext` (~434).
   - **Fix:**
     - Build from current's rule is the only behaviour; the switch goes. With no games in the division, the two were
       already identical.
     - **The server's division delete narrows to the same rule for every caller** (scheduled and not kept), so no
       later door can take a played game.
     - The question names what it replaces and keeps (words: Precondition 5).
     - ⚠ **Check the slot-based path** (`commitSlots`, placeholders instead of teams) honours the partial context. If it
       doesn't, it must before the switch goes.
     - **Leave `delete-tournament-games` and the playoff deletes alone.** They are explicit delete tools that ask first,
       not a draft's save.
   - **Proof:** a unit test that the division delete never takes a game that isn't `scheduled`, or is kept. Also a
     read-only probe on the demo's Friday: generate (it is computed in the browser, no write) and stub the save. The
     save's request names no played game, and the window shows no switch.
2. **F70 · Replace in one step (P1, as the owner rules it).**
   - Both commit paths, team-based and slot-based.
   - After the fix, the replaced games are only games still to play; the draft stays on screen on any failure.
   - The organizer is told what happened in words.
   - **Proof:** a route test for the failure branch (the removal fails → the new games are gone again, and the reply
     says so).
3. **F69 · The generators double-book the tournament's other divisions.**
   - **Today:**
     - The round-robin generator keeps only the chosen division's games (`currentDivisionExistingGames` ~272).
     - The playoff generator fetches the tournament's games and keeps only its division's (`PlayoffWizard.tsx` ~279).
     - Both `buildTimeSlots` (`Generator.tsx` ~390, `PlayoffWizard.tsx` ~723) emit every date × time × surface slot
       with nothing subtracted.
     - The demo's U11 and U13 share Diamonds 1–4, so a U13 draft can land on a U11 game.
   - **Fix:**
     - Both treat every game of the tournament's other divisions as taken (cancelled games excepted), on its surface,
       for its length.
     - Use `resolveGameTiming`'s chain (game → division → tournament → the shared 90), by the same overlap rule the Add
       window refuses (`lib/schedule-conflict.ts`). A draft then never offers a slot the Add window would refuse.
     - A buffer still warns, as today.
     - "Taken" must only block slots. It must not count toward this division's teams, rest or field metrics.
     - If a draft can no longer fit, it says so in today's words for too few slots.
   - **Proof:** a unit test of slot building with another division's game on one surface, and a read-only probe on the
     demo's Summer Classic: a U13 draft (generated, not saved) overlaps no U11 game. **The club's other programs are not
     this pass** (the build counts them, S3).
4. **F71 · A refused save says nothing.**
   - **Today:** the schedule page's `handleSaveGame` (~734) never reads `saveRes.ok`; it refreshes (~824). So a refused
     drop, inline save or phone-sheet move snaps back without a word. The route refuses with 400, 403, 409 or 423
     (venue errors, plan, a final result locked, a locked tournament).
   - **Fix:**
     - Read the reply. On a refusal, the game stays where the server has it and the page says why, through the page's
       existing feedback: the route's own message where it has one, `/marketing`'s words where it doesn't.
     - The inline row stays open, as `'bracket-order'` already does by throwing.
     - The sandbox's `X-Sandbox-Blocked` branch stays first and untouched.
     - Then check this page's other writes (cancel, reinstate, delete, the rain delay) for the same silence. Fix any that
       drops a refusal, and list them.
   - **Proof:** a probe with a stubbed refusal on a drop and on the inline edit: the message shows, the game is where the
     server has it.
5. **F72 · The bracket editor moves a published game and tells no one.**
   - **Today:**
     - `save-bracket` (the games route ~502) updates existing games' time and field (~560) and records no change.
     - The single-game `update` is the only writer that calls `announceScheduleChange` (~157, called ~1205), which
       records through `recordGameScheduleChanges` and re-syncs the game-day reminder.
   - **Fix:**
     - Read each updated game's schedule snapshot before the update, then record the batch's changes in one call.
     - The publish gate inside the recorder already tells nobody about an unpublished division.
     - Its quiet-window collapse already drops a game moved and moved back.
     - Re-sync the reminders as the single-game path does: fire-and-forget, never failing the save.
   - **Proof:** a route test: a save-bracket that moves a published game records one change for that game, and none for
     an unpublished division.
6. **F73 · The Publish window promises a reminder it doesn't send (words only, A46).**
   - **Today:**
     - The window says *"Publishing also schedules a game-day reminder email … this is sent even if the box above is
       left unchecked"* (`page.tsx` ~2956).
     - The route returns before the reminders when Notify is unticked (`schedule-publish/route.ts` ~61), and again on
       a plan without `schedule_notification` (~66). The reminders are scheduled only after that (~131).
     - Event settings can also turn the reminder off.
   - **Fix:** the sentence says what happens: the reminder goes with the *"schedule is live"* email on Tournament Plus.
     It shows only when the reminder will actually be scheduled (Notify ticked, the plan has the email, the reminder
     setting on). Words: Precondition 5.
   - **Don't change the route.** Whether every publish on every plan should schedule the reminder is the packaging
     question A46 recorded for `/strategy`.
   - **Proof:** a unit test of the sentence's condition, read from the same rule the route reads.

And one latent key:

7. **The playoff generator reads its own plan feature.**
   - **Today:**
     - The page's `canAutoGenerateSchedule` (~208) reads `auto_schedule`. It also gates the playoff window's door (~258)
       and is passed as `canAutoBracket` (~1564).
     - The window's free default reads `auto_schedule` too (`PlayoffWizard.tsx` ~251).
     - The server already gates the generated bracket on `playoff_generator` (the games route ~355).
   - **Fix:** the playoff window's doors and default read `playoff_generator`.
   - **Both sit at Tournament Plus** (`lib/plan-features.ts:86–87`), so no one's access changes. **No gate value
     changes**, so `/billing` is not needed. Say so in the summary.

## Fixtures, and what never gets written

- **The demo door allows 10 entries per 10 minutes per IP.** Enter once, save the session, reuse it (the design session
  used `.probe/s3/demo.json`). The demo's Summer Classic is live on its seed's game day; check its dates before relying
  on "today".
- **The UAT Plus Championship** (June, finals and pending games) is the organizer fixture. The free club proves the
  Tournament plan's lock.
- **Probes write nothing** (refuse every non-GET). A save, a delete, a generate-and-save or a publish happens only on
  the owner's word, then undone and read back. **Dev email is live:** never publish or notify from a probe.

## Verification

- `npm run verify:changed` (includes the spelling gate), and `npm run typecheck` (a route and shared libraries).
- The unit and route tests above, run by file. Probes in `.probe/`, asserting on state, never on a guessed delay. Warm
  and Dark. The admin scrolls inside `main[class*="adminMain"]`.
- The demo tour-anchor guard stays green (`schedule-health` is untouched).

## Close-out

- **Offer `/review`** before the commit: a delete rule, a two-step write and an alert path.
- **Commit only when the owner says**, as its own commit, on `dev`, from a private index with explicit pathspecs, then
  `git show --stat HEAD`.
- **An owner walk:** a checkable walk on the hub's QA tab. The hub is ONE artifact, so republish the same URL, after a
  full read of the live copy.
  - One purpose: "the generator keeps what was played and leaves other divisions' diamonds alone; a refused save says
    so".
  - Its own Owner QA Ledger §: the next free one, after re-reading the ledger.
  - Its writes are the owner's, on dev. Name the event and division to use, and how each change is put back.
- **Help:** `/docs` if an article describes Replace all, Build from current, or the reminder (none mentioned *Replace
  all* on 2026-10-09; check the publish passages).
- **Record:**
  - plan §6c, a "defects pass, as built" paragraph with its commit;
  - §5's row 3;
  - the hub's stage strip and Stage 3 tab;
  - the TODO line;
  - memory `project_tournament_admin_redesign`.
- **Migrations:** none, unless the owner chooses P1's database function.
