# House League Stage 9d-2b · Part 4: `/simplify` then `/review` (session prompt)

> **Written 2026-10-28**, right after Part 4 was committed. **Paste the kick-off block into a new chat on `dev`.** This
> session cleans up and adversarially reviews ONE commit, `670b00682` ("the families' game emails"), and writes its walk.
> It does not build Part 5. Recommended model: Opus 5.5; helpers on Sonnet for reading.

## Kick-off block (paste this)

```
Run /simplify and then /review (high) on House League 9d-2b Part 4, commit 670b00682, following
docs/projects/active/HOUSE_LEAGUE_STAGE9D2B_PART4_SIMPLIFY_REVIEW_PROMPT.md. Read that file and the build prompt's
Progress block (HOUSE_LEAGUE_STAGE9D2B_BUILD_PROMPT.md, "Part 4 — COMMITTED") first. Simplify first, commit it, then
review the cleaned-up code, fix what the review confirms, write the Part 4 walk alongside, and update the records.
```

## What Part 4 is (so the review knows the intent)

When a league admin presses **Publish schedule**, **Send changes** (Changes to send) or **Cancel/Postpone and tell
families now** (f5), each family gets one email, the changed teams' coaches get a copy (changes only, first send only),
and the season's Email families history lists **Schedule published: {division}** / **Schedule changes: {division}**.
A stopped send offers **Send to the N it missed**. "See the email" (Publish) and "See their email" (Changes to send)
preview the real words. Settled words: `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md` "Stage 9d-2b" f2–f5 (that file wins over a
drawing). Rulings 9d2·1, 9d2·2, 9d2·13, 9d2·16 and 9d2b·A–D (plan §0h) are binding — do not reopen them.

**The commit (`git show --stat 670b00682`):**
- New: `lib/league-schedule-mail.ts` (the sender: claim → build → `sendFamilyServiceBatch` → outcome → recount;
  `sendChangesAndTell`; the two previews), `lib/league-schedule-email.ts` (pure lines and words),
  `supabase/migrations/410_…` (`sending`/`skipped` + `league_schedule_emails_claim`), `tests/unit/league-schedule-email.test.ts`.
- Changed: the three schedule routes (`publish`, `changes`, `[gameId]`) and the season `emails` route (`resendNotice`);
  `lib/families-emails-log.ts` + `families/EmailLog.tsx` + `SeasonEmailsScreen.tsx` (the history rows and their
  resend); `PublishScheduleWindow`, `ChangesToSendWindow`, `SchedulePublishLine`, `GameWindow` (done lines, previews,
  "See them"); `lib/email.ts` (`leagueScheduleNoticeHtml`), `lib/email-kinds.ts`, `lib/league-schedule-words.ts`,
  `lib/league-game-changes-server.ts` (`notice` on the send result), `SendParts` (a list item keeps its own lines).
- Dev e2e: `.probe/9d2b-p4/e2e.ts` — run
  `npx --yes tsx@4.19.2 --env-file=.env.local --require ./.probe/9d2b-p4/stub.cjs .probe/9d2b-p4/e2e.ts`;
  it must print `SCHEDULE_EMAILS_E2E_PASSED` and `rows left: 0`. Re-run it after any change to the sender. Dev has
  no email key: every row records `skipped`.

## Step 1 · `/simplify` (commit it on its own)

Look hardest at these (leads, not verdicts — argue from the code):
1. **The claim / outcome / recount loop is now in two senders.** `lib/league-schedule-mail.ts` and
   `lib/house-league-placement-mail.ts` each have `recordOutcome`, a recount, and the claim-and-unwrap. Decide whether
   one small shared helper earns its keep, or whether two tables and two status sets make the copies cheaper than the
   abstraction. Say which, and why.
2. **The two windows' preview state is the same code twice** (`openEmail` + `sample` + `sampleFailed` in
   `PublishScheduleWindow` and `ChangesToSendWindow`). A small hook beside `useSendLevel` in `SendParts`?
3. **Family grouping is written a third time** in `sampleFor` (by lower-cased guardian email). `familiesFor` /
   `childrenOnTeams` in `lib/league-game-changes*.ts` already do it.
4. **`placeReader` repeats the public page's `placeOf`**, and `publishedLinesByTeam` reads the whole season's games
   to use one division's.
5. **Two functions named `changeLine`** — the tray's (`ChangesToSendWindow`, "6:00 p.m. → 7:30 p.m.") and the email's
   (`lib/league-schedule-email.ts`, "Now / Was"). Different words on purpose; consider whether the names should say so.
6. `copyCoaches` queries per team in a loop — fine at 10 teams, check the shape.

Do NOT merge the house-league game emails into the club's practice-change path (11b Part 5) — two senders, two
Automatic rows, by ruling. Do not change any settled word. Run the e2e and the focused tests, commit, then Step 2.

## Step 2 · `/review` (high) — a send that emails people, a public read, an atomic path

Feed the review the code, not this list; then use the list to check its coverage. Known risks to make sure are covered:
- **The race the claim exists for.** A resend racing the first send must never email a family twice (claim takes only
  `pending`/`failed`, or `sending` older than ten minutes). ⚠ `refreshCounts` counts `sending` rows as `failed`, so a
  history row opened while another send is in flight reads "stopped" and offers a resend that claims nothing. Decide:
  acceptable, or exclude a fresh `sending` from the count.
- **A notice in flight reads "done" with 0 of N** (`noticeState` no longer has a grace period). Honest enough?
- **What a "games changed" email says on a resend** is rebuilt from the rows the send stamped (`notice_id`): earliest
  `before` to latest `after`; games played since are left out. Check the rows are ordered, and that a game in two
  notices reads each notice's own changes.
- **`failed_count` changed meaning** for the two schedule kinds: every family still to reach (failed or never tried).
  The history, the division line and the windows all read it that way. Check nothing else reads `failed_count` for
  these kinds differently, and that the data dictionary's `league_season_notices.failed_count` says so (it does not
  yet — fix it).
- **`skipped` means two things**: "nothing left to say" (the children left the teams) and, on dev only, "the transport
  had no key". Fine for prod; say so or separate them.
- **Who can resend.** `resendNotice` sits under the season's EMAIL gate (runners + registrar), not `run`. Built on
  purpose (finishing a send already made); confirm, and confirm the notice is scoped to org + season before it sends.
- **Escaping.** `leagueScheduleNoticeHtml` opens with `escapeEmailFields`; the list items, titles and link are escaped
  where drawn; the link path is built from encoded slugs. Child, team and venue names are family-typed or admin-typed.
- **Inside the request.** The publish and send routes now await the emails (`maxDuration = 120`). Check the 101-family
  case (*Draft Test 2027*) and that a mail failure can never turn a landed publish/send into an error response.
- **The coaches' copy**: first send only, never the sender, never a coach who is also a parent this send reached; a
  coach of two changed teams gets two copies (one per team) — acceptable?
- **The previews** read real families' names to an admin — the same exposure as Publish teams' preview. Fine, but
  check the GET is behind `houseLeagueRefusal(ctx, 'run')` like the rest of each route.
- **Publish's window swaps `kind` from question to form** while the email shows (only a form has the named back, owner
  2026-10-26). Check focus, the overlay, Escape and the phone's Back.
- **Missed in Part 4, fix it here:** `lib/family-email.ts`'s header lists every sender outside the suppression door
  ("the count is the point, correct it here if you change one"). Its house-league service-notice bullet names the
  placement and moved-team emails only — add the schedule published / games changed emails.

Fix what the review CONFIRMS, each with its reason; record what it found and did not change (Low/Advisory) in the
build prompt's Progress block.

## Step 3 · the walk, written alongside the review (owner rule)

One walk, one purpose: **the families' emails and the history** (Part 7 lists the others; do not write them here).
Follow the house QA-walk format (a checkable Artifact with paste-back; check the last § number in `OWNER_QA_LEDGER.md`
first). Dev sends no email, so the walk reads what IS visible: Publish's "See the email", Changes to send's "See their
email" (a family with children on two teams — the fixture needs one), the done lines, the division line's
"See them", the two history rows, and "Send to the N it missed" (make a row stopped in the fixture). Fixtures: the
9d-2a walk fixture `.probe/9d2a-walk/fixture.mjs` (Walk U11) or *Draft Test 2027*. If the review changes a line the walk
quotes, grep the walk.

## Records and hand-off

- Build prompt Progress block: what simplify changed, what review fixed and left, the walk's § number.
- Plan §9 a line; memory `project_club_stage9_house_league` (and its MEMORY.md line); `TODO.md` only if a new item.
- Help (`/docs`) waits for Part 7, which rewrites `lib/help-content/house-league.tsx` once for all of 9d-2b.
- New files → the dev server needs a restart before the owner walks; ask first.

## Do not / shared-file traps

- Other sessions share this working copy. `GameWindow.tsx`, the schedule `page.tsx` and `lib/league-season-calendar.ts`
  carry ANOTHER session's uncommitted 9d-2a walk fixes. Commit only your hunks: build the staged blob from HEAD plus your
  exact edits (Part 4 did this with a small `git hash-object` + `update-index --cacheinfo` script), then check
  `git diff --cached` holds only yours and `git diff` holds only theirs. Stage explicit paths; `git show --stat HEAD`
  after every commit.
- Several files are CRLF; a scripted replace on them fails silently unless it normalizes — use Edit, or normalize.
- Do not re-baseline `check:schema-parity` (409/410 are dev-only until prod applies them — a database gate the owner
  has not asked to change). Failures in other sessions' files are theirs: confirm before blaming yourself.
- Do not build Part 5, the bell, 9d-3 or 9e. Do not reopen a ruling.
