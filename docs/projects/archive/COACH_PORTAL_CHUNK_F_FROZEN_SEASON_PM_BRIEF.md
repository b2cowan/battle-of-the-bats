# Chunk F — The frozen past season · PM Brief

**Status:** awaiting owner approval (decisions + mockups). No code written.
**Plan:** `COACH_PORTAL_CHUNK_F_FROZEN_SEASON_PLAN.md`

---

## The problem, as a coach experiences it

A coach spends a season building something real: a roster, a schedule, attendance, lineups, dues
records, waivers and medical forms, awards. The season ends. Today, one of two things happens.

- If the team **wasn't rolled forward**, the whole portal collapses to two doors — a Season's End
  summary and a results archive. Everything else is gone.
- If the team **was rolled forward into a new year**, it's worse and nobody has noticed: last
  season simply *doesn't exist* in the portal any more. There is no door to it at all. Only the
  new season is reachable.

That second case is the everyday one, and it's the one people actually hit — "who was on the team
last year", "what did we pay for that tournament", "did we ever get her medical form". Right now the
answer is: you can't look.

## What changes

A coach picks a season and the portal shows them that season — the whole thing, as a record.

- A **season switcher** lives exactly where the tournament switcher does — in the sidebar on a
  computer, and inside **More** on a phone, right below the team switcher already there. It takes no
  space on the page itself. Switching keeps you where you are: Roster 2026 → Roster 2025.
- While you're in a past season, the **2025 · Complete** chip beside the team name is also the way
  back out — one tap reopens the season list.
- A past season shows the **same doors the coach had at the time**, not a curated subset — roster,
  schedule and results, attendance, lineups, money records, documents, development and awards.
- A **2025 · Complete** chip beside the page title says what this is, backed by the amber switcher
  and the year in the breadcrumb. Buttons that would change something are simply not there. No
  banner — coaches learn the convention fast, and a banner on every one of 30-odd screens is noise.
- What each person can see is **what they could see then**. An assistant who was never given access
  to money doesn't get it in the archive. This is not a nicety — right now the system would hand
  them the *current* year's permissions when they open an old one.
- The one thing still live in a past season is **who's allowed to look at it**. The head coach can
  remove someone from a past season's staff, and that person loses access to it immediately.

## Why it matters

Records are most of what a volunteer coach actually needs from software after the season is over,
and they're the thing that makes staying worth it in February. A portal that forgets last year is a
portal you re-evaluate every spring.

It's also a quiet fairness gap: club **administrators** already have read-only past-season detail
pages. Coaches — who on a standalone team *are* the administrator — don't.

## The honest trade-offs

- **This is bigger than it was booked as.** The ledger called it "medium" on the belief that the
  rails already existed. Checking, they mostly don't: the piece that was supposed to guarantee "you
  see what you saw then" doesn't actually do that, and the reason past seasons are currently
  un-editable is an accident of how the code is shaped rather than a rule — so opening them up means
  writing that rule for real. The data itself is in good shape, which keeps it achievable.
  **Recommend calling it large and cutting the scope** (below).
- **What's left out of a past season:** chat and family email (a frozen season shouldn't offer to
  message a team that no longer exists), and anything that *moves* money or *runs* a tryout rather
  than recording one. Records in; instruments out.
- **Tryout history is in** (owner call, 2026-08-01 — I had it cut, and the owner was right).
  Turnout year over year tells a coach whether the program is growing, and when a candidate who
  didn't make the team last spring shows up again, last year's notes are the whole point. The portal
  already recognises a returning candidate; this turns that recognition into a link you can follow.
  It adds roughly a fifth to the build.
- **The risk is permissions, not pixels.** Every new way to read a past season is a new way to read
  a former team-mate's child's information. The build treats it that way — refusals are enforced by
  the server, not by hiding buttons, and the test suite proves it as a rule rather than page by page.

## Success criteria

- A coach can reach any season they were on, from any section, in one tap.
- An assistant sees exactly what their old permissions allowed — verified by test, not by eye.
- A coach removed from a past season's staff is refused by the server immediately.
- Nothing in a past season can be written, proven portal-wide rather than screen by screen.
- Every door in a past season carries help.

## Decisions

Five of seven settled by the owner 2026-08-01: scope (**tryout history added**), Season's End as the
past season's front door, no cut-off on how far back, rolled-forward teams included, and money
records in / money instruments out. Two open: confirming where the season switcher sits, and whether
the Staff screen keeps one line of explanatory text — the one screen where "Complete" is misleading,
because that's the one place the buttons still work.

**One thing recorded rather than asked:** tryout evaluations are written judgements about other
people's children, often children who were told no, and keeping them across years means those
judgements outlive the season. Two constraints already in the design keep that proportionate — only
coaches who had tryout access *at the time* can read them, and they open beside a live candidate
rather than as a browsable file on a child. Worth being a decision we made rather than one that
happened to us.
