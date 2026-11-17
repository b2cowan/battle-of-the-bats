# Quiet teams and a far-off tournament — plan (owner ruled 2026-11-15)

**Status:** on the board (Owner Morning Brief).

Raised by the owner from production: a team with no activity since September kept getting the same
"Your week in review" every Sunday, and a tournament entered for next July showed as "Next up".
Same root: nothing asked whether anything had happened (or was about to) recently.

## Rulings (all four recommendations accepted 2026-11-15)
1. **Digest activity gate.** The Sunday "Your week in review" goes to a team only if the team had a game,
   tournament game or practice (not cancelled) that already took place in the last 7 days.
2. **Digest repeat gate.** A coach is never sent a digest whose findings are identical to the one they got last time.
3. **Next-up tournament horizon: 30 days** from the tournament's first day (or live now). Further out is a date, not a prompt.
4. **Season-end prompt** is no longer hidden by a far-off tournament (same one fix: such a tournament no longer counts as "upcoming").

Not bounded: the team's own scheduled games and practices; the top-bar status line; the Tournaments tile (still shows the date).

## What was wrong (from the code)
- Digest sweep listed every team with an open season; "quiet" meant only "no season-to-date finding fires", and
  findings are season-to-date ("2-0 lineup", "won 9 straight"), so a frozen season never went quiet. The only repeat
  guard was a 6-day timer, with no content comparison.
- Next-up: any registered tournament that had not ended counted, at any distance. That same flag also kept the team
  "in season" and suppressed the season-end prompt.

## Built
- `lib/insights-digest-gate.ts` (pure): `teamHadActivityInWindow`, `isRepeatOfLastDigest` (key-order-proof, because the stored copy is jsonb).
- `lib/insights-digest.ts`: both gates; `lib/db.ts`: `getLatestNotificationFacts`.
- `lib/coach-overview.ts`: `TOURNAMENT_NEXT_UP_HORIZON_DAYS`, `tournamentIsNextUp`; the team Overview page uses it for `hasUpcomingTournament`.
- Help article (notifications) now says what the weekly note is sent for.
- Tests: `tests/unit/insights-digest-gate.test.ts`; additions to `tests/unit/coach-overview.test.ts`.

## Open
- **Title.** "Your week in review" still carries season-to-date facts; the one-row notifications plan already notes this.
  Not changed here (a copy call, and Stage 3 of that plan settled the words today). Owner to rule: leave, rename ("Where your team stands"), or week-scope the facts.
- A coach who deleted last week's digest will be sent the repeat once (the repeat gate reads what is still in their list).
- Walk owed: one dormant team (expect no Sunday note; Overview reads "Nothing on your schedule" and offers closing the season)
  and one active team (expect the note).

## Review 2026-11-15 (high-risk tier; two finders + main-loop verification)
Fixed: a failed "what were they last told" lookup could throw mid-loop and leave later coaches unsent for the week —
it now fails open (sends). A test title overclaimed; renamed, and the phase effect of a far tournament is now pinned.
Known, accepted, owner may re-rule:
- The repeat gate reads the coach's bell list, so a coach with the bell turned off for this note (push/email only) is not protected from repeats; the activity gate still holds.
- A coach who deletes the digest (hard delete) is sent it again on the next run; for a one-coach team the Monday catch-up can re-send it.
- A score entered after Sunday for a team with no event the following week is not delivered until the team next plays.
- A registered-for-a-tournament team with a roster but no finished game reads as pre-season (setup steps) until the tournament is within 30 days.
- The season-end question can now appear with a tournament 31+ days ahead; "Not yet" dismisses it for the season.
