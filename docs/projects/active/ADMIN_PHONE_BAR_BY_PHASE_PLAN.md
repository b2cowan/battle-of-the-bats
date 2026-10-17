# The tournament phone bar follows the event's phase: plan

**Owner ask, 2026-10-16** (on his phone, U13 Battle of the Bats 2027, header "OPEN", 259 days out): *"this tournament is
well before its dates, why is check in and results in the bottom nav? I thought that was only for during the event."*
Then: *"mockup the bottom bar."*

Hub: `ADMIN_PHONE_BAR_BY_PHASE_HUB.html`, published as an Artifact (mockup · asks · brief · plan). PM brief:
`ADMIN_PHONE_BAR_BY_PHASE_PM_BRIEF.md`.

## 1 · What the code does today

- The admin's phone bar (the tournament bar inside a tournament) picks its four tabs by the tournament's **status**:
  `draft` → Setup · Teams · Schedule · Site; `active`, `completed`, `archived` → Results · Check-in · Schedule · Chat.
  An invite-only event (no Check-in, no Chat) shows Dashboard · Results · Schedule · Messages once launched.
- The event header, the dashboard (Draft / Weeks-before / Game-day / Finished boards) and the context strip above the
  bar all read the **phase**: Draft · Open · Game day · Completed · Archived. "Game day" means the event's dates have
  arrived **or** its first game has started, and it lasts until the event is marked complete (redesign G1,
  2026-09-29). The context strip, which the bar component itself renders, already computes that phase.
- So a launched event reads "OPEN" in its header and shows the weeks-before dashboard, while the bar under it shows the
  game-day tabs. The free-tier review recorded the gap as a fact on 2026-10-12 ("it never reads game day"). Nobody had
  ruled on it.
- The draft bar's ruling (2026-06-23, design log) set the model: **a bar rewards the screens revisited in that phase**,
  "draft bar = getting ready; live bar = running it", with **Schedule fixed in the third slot** so the bar never feels
  like a different app when it switches. When that ruling was made, "live" meant launched, because the Open phase did
  not exist yet.

## 2 · The proposal (drawn on the hub)

| Phase | Full plan | Invite-only event |
|---|---|---|
| Draft | **Dashboard · Teams · Schedule · Site** (ruled 2026-10-16; Setup in More) | the same |
| **Open** | **Dashboard · Teams · Schedule · Chat** | **Dashboard · Teams · Schedule · Messages** |
| Game day | **Dashboard · Results · Schedule · Chat** (ruled 2026-10-16; Check-in in More) | Dashboard · Results · Schedule · Messages (unchanged) |
| Completed / Archived | **Dashboard · Results · Schedule · Chat** (A3) | unchanged (already this shape) |

- **The switch moment** is the header's game-day rule, read the same way (A2).
- **Nothing becomes unreachable.** More already lists every row the bar doesn't show, so Results and Check-in appear
  there during Open, and Dashboard leaves More when it is on the bar.
- **Chat's unread count** already moves to More whenever Chat isn't on the bar (draft today). Chat is on the Open bar,
  so this changes nothing.
- **Teams** carries its waiting count (teams to review) on its tab, as it does on the draft bar.
- **Roles:** Dashboard and Teams carry no role gate, so every role gets four tabs.

## 3 · Asks for the owner

**Ruled 2026-10-16 (owner, after /design noticed game day kept the live board behind More):** *"I think GameDay should
have check in in more and keep dashboard in the left corner."* Game day is **Dashboard · Results · Schedule · Chat**;
Check-in joins More. Gate volunteers are unaffected (their own check-in screen, opened from the staff kit). An organizer
who checks teams in personally goes through More. The game-day board's "teams arrived" figure is not a door to Check-in
today; making it one is a possible follow-up, not ruled.

- **A1: the Open bar.** *Rec:* Dashboard · Teams · Schedule · Chat. Alternatives drawn: keep the draft bar
  (Setup · Teams · Schedule · Site) until game day; or Teams · Schedule · Chat · Site.
- **A2: when it switches.** *Rec:* the moment the header says "Game day" (the first day, or the first game started),
  and back to Dashboard first once the event is marked complete.
- **A3: after the event.** Check-in is just as empty once the event is over. *Rec:* Completed and Archived read
  Dashboard · Results · Schedule · Chat (the dashboard there is the Finished board: how it finished, next year, Summary).
- **A4: the invite-only Open bar.** *Rec:* Dashboard · Teams · Schedule · Messages (Messages already stands in for Chat
  on that plan).
- **Noted, then ruled (§6):** the draft bar leads with Setup because, in June, Event Settings was the draft's home. Since
  Stage 5 the dashboard's draft checklist is the home and opens every setup step. Leading the draft bar with Dashboard
  too would make every phase except game day lead with home. That is the owner's call, separately.

## 4 · Build notes (after the ruling)

- One rule in the admin kit bar: compute the phase with the shared phase helpers (the context strip's exact call), and
  pick the tab set by phase instead of by status. One table of tab keys per phase is clearer than nested conditions.
- Tests: the admin-kit-nav unit test gains the Open and Completed sets, both plans, and the switch at the first game.
- Help: the tournament help that names the phone bar's tabs gets the phase table's sentence (`/docs`).
- Demo tours: the build's tour-anchor gate fails if a tour points at a tab that moved; run it.
- `/design` at 390 in Warm and Dark after the build; layout check on the dashboard, Teams, Results.

## 5 · Success

- Months out: Dashboard · Teams · Schedule · Chat, Dashboard lit on the dashboard.
- On game day: Dashboard · Results · Schedule · Chat, at the same moment the header reads "Game day"; Check-in in More.
- Nothing is reachable only from the old bar: every destination is in the bar or in More, in every phase.

## 6 · Ruled and built (2026-10-16)

**Rulings.** Game day first (above, §3). Then: *"All as recommended and I also like your teams arrived figure on the
dashboard opening checkin."* A1–A4 as recommended, plus the follow-up offered with the game-day ruling: the game-day
board's "teams arrived" figure opens Check-in. Then Draft: *"actually I think dashboard should replace setup in the draft
version since it has the checklist and all of the important setup items are links from this dashboard anyways. so
dashboard is essentially pinned to the bottom left in all versions."* Draft is Dashboard · Teams · Schedule · Site, and
Event settings joins More (the role fallback to Divisions retires with it: Dashboard has no role gate).

**As built — committed `c7ca70ff` 2026-10-16 (the bar, its test and the draft board's help); the alerts sentences `3b78ff78`; the game-day board's Check-in door `ca03e136` (with the owner's walk-time rename and the free-tier session's §320 fix, which it is built on):**
- `tournamentBarKeys(phase)` in `lib/admin-kit-nav.ts` is the one table: Draft → dashboard · registrations ·
  schedule · branding; Open → dashboard · registrations · schedule · chat; every later phase → dashboard · results ·
  schedule · chat. `AdminKitBottomNav` computes the phase with `resolvePhase` + `isGameDay` (the context strip's exact
  call) and maps the keys, keeping today's relabels (Site, and Messages for a plan without Chat). Dashboard is first in every phase and Schedule third. The
  status-keyed branch and its Check-in test are gone, and Check-in is never a tab.
- More needs nothing: it lists every row the bar doesn't show, Event settings included in Draft. Its "Review launch
  checklist / Open dashboard" row now shows only where Dashboard is not a tab at all (a fallback).
- The game-day board's arrivals figure is a link to Check-in (`${base}/check-in`): the figure keeps its ink,
  and the label is the door, reading **Check-in** (it read "teams arrived" until the owner renamed it to name the
  page it opens, 2026-10-16), in olive with a chevron, at the 44 px floor, underlined on hover. It shows only where the
  plan has check-in (another session's §320 fix).
- Tests: `admin-kit-nav.test.ts` checks the table directly (every phase, every key a real nav row) plus the bar's
  source (reads the table and the game-day rule, never Check-in).

**Checks.** Lint clean on the four files; typecheck clean; 141 of 141 in the nav, invite-only and club guard tests;
demo check, spelling and CSS-module purity green. Two `verify:changed` gates are red on **other sessions' files**: the
admin old-look baseline (`house-league.module.css`) and a selector clash (`GuidanceRail.module.css`). Neither is part of this change.

**⚠ Shared lines.** `GameDayBoard.tsx` carries another session's uncommitted "teams arrived goes with check-in" fix
(§320, the `arrived` null case) right under this change. Commit them together, or theirs first.

**QA §323 ✅ PASSED 2026-10-16, 11 of 11** (owner paste-back). During the walk the owner renamed the arrivals figure's
label from "teams arrived" to **Check-in**, so it says where it goes; verified on dev by the owner.

**Passes:** `/review` 2026-10-16 (high-risk, three lenses — correctness/regression on the bar and board, the alerts
flow, security/privacy): no Critical or High; fixed: the More sheet's unreachable "Review launch checklist" row (and,
in the alerts commit, four findings). `/docs` 2026-10-16: the draft board's article (Dashboard leads the bar, Event
settings in More) and the game-day board's (the arrivals count opens Check-in; the game-day bar); the organization
guide's new "Turning on alerts on your phone".

**Committed:** `3b78ff78` (alerts), `c7ca70ff` (the bar), `ca03e136` (the board's door, the rename, the §320 fix). Nothing
owed for the build; QA §323 passed. Next: the production promote (the release history records it).
