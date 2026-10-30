# House League 9d-2b: the settled words (the `[marketing]` pass)

> **Built, 2026-10-30.** All 13 rows applied in the close-out; runtime and verification findings are recorded in the build prompt's Progress block.

> **Settled 2026-10-29 (owner: "all as proposed"; `/marketing` pass over the strings Parts 5 and 7 built as drafts and tagged
> `[marketing]`).** Each row carries its reason; a ruling's *reason* is the authority, not its wording.
> **Not built by this document**: `HOUSE_LEAGUE_STAGE9D2B_CLOSEOUT_CODEX_PROMPT.md` applies it. Every row keeps the
> house rules: sentence case, "8:00 a.m.", the bare possessive, sport-neutral, one spelling.
> **Rulings these words stand on** (do not reopen): 9d2·2 (a practice change emails families), 9d2·13 (families hear about
> a published game once, from the league admin's send, never from the club's), 9d2·16 (what the club taking time back does).

## Changed

| # | Where it shows | Who reads it | Was | Now | Why |
|---|---|---|---|---|---|
| 1 | Send the changes: the button when only house-league games are in the send (no rep team, no house-league team ticked) | Club owner / admin | Send to 0 people | **Send to league admins** | Nobody is emailed directly, but the league admins are told. "0 people" says nobody is, which is false. |
| 2 | Same send: the heading above the list | Club owner / admin | Who is told · 0 people | **Who is told · league admins** | Same. |
| 3 | Same send: the line after it goes | Club owner / admin | Sent to 0 people on 0 teams. | **Sent. The league admins are told.** | Without it the "0 people" problem returns right after the button is fixed. |
| 4 | Send window hint, games-only send | Club owner / admin | House league’s game changes go out from the season. | **Families hear about game changes when a league admin sends them.** | Says who sends and to whom. On a games-only send this is the *only* hint sentence: "Each team’s coaches get one email…" is untrue there. When a house-league team is also in the send, `changesHintLeague` (settled) keeps its place and gets the same last sentence. |
| 5 | Statement at the top of the window, games only | Club owner / admin | …Their league admins are told. Nothing else on the schedule moves. | **…Their league admins are told, and families hear from them. Nothing else on the schedule moves.** | 9d2·13, said where the owner reads it. |
| 6 | Statement, rep teams plus games (no house-league team) | Club owner / admin | Only those teams’ coaches are told | **Those teams’ coaches are told, and so are the divisions’ league admins** | The old clause is wrong: the league admins are told too. (Plural "divisions’" / singular "division’s" follows the count, as the reach clause does.) |
| 7 | Statement, house-league teams plus games | Club owner / admin | Their coaches are told, and so are the house-league team’s families | **Their coaches are told, and so are the house-league team’s families and the divisions’ league admins** | Same omission. |
| 8 | A games row in Send the changes, when the club took a game’s time back | Club owner; league admins' tray | Thu, Jun 3, 6:00 p.m. · Diamond 1: taken back | **Thu, Jun 3, 6:00 p.m. · Diamond 1: time taken back** | "Taken back" alone reads as if the game is cancelled. It is the time that goes; the game goes to Needs a new date. |
| 9 | Families' "your games changed" email, a game that has a date now | Families | Date set: {game}, {when}. | **New date: {game}, {when}.** | Sits beside "Postponed: … A new date is to come", so it reads as the answer. Covers a game that never had a date. |
| 10 | Same email, a dated game lost its date | Families | Date to come: {game}. The club will tell you the new one. | **Date to come: {game}. The club will tell you the new date.** | "The new one" points at nothing. "Date to come" matches the public page's word: keep it. |
| 11 | Undo refused on a game the club changed | League admin | The club moved this game’s time, so it can’t go back. Give it a new date instead. | **The club changed this game’s time, so Undo can’t put it back. Give it a new date instead.** | The club may have taken the time away, not moved it. Names the button that is refused. |
| 12 | The league admins' bell, body, after the "N games wait in Changes to send." sentence | League admins | …3 games wait in Changes to send. | **…3 games wait in Changes to send. Families hear once you send them.** | The admin's next step is the point of the notice. Added only when games wait (a draft's move tells nobody). |
| 13 | The league admins' bell, one line per game | League admins | U12: Sun, Nov 8: Field 2 → Field 4 | **U12 · Sun, Nov 8: Field 2 → Field 4** | Two colons in a row read as a typo; the Send window already writes "U9 Rookie games · Sun, Nov 15: …". |

## Kept as is (said so, so nobody reopens them)

- The league admins' bell **title**: "{schedule} changed house league’s practices and game time" (or "game time", or "practices").
- The **draft-game line** when the club takes a slot back ("House league uses this time: … Nobody has been told about it."),
  the games-row **sub-lines** (published: "{n} game(s) move to Needs a new date."; draft: "{n} draft game(s) move." /
  "come off the draft." / "Nobody is told: {division}’s schedule isn’t published yet."), the team row's "House league ·
  U9 Rookie · nobody to email", and the families' closer "Questions? Ask the Reds or Blues coach."

## Build notes (not words)

- Items 1–4 and 6–7 are **not a string swap**: the games-only case needs its own heading, button, confirmation and hint, and the
  statement needs a branch for "house-league teams AND games" and for "rep teams AND games". The Codex close-out prompt has the
  truth table.
- Two unit tests pin the old strings and move with them; they are not loosened, they are edited to the new words.
