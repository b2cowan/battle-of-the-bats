# Coach Portal Launch Batch 4 — Tournament Games Get Real Tools — PM Brief

> **Status:** ✅ Approved 2026-07-29 — D1–D6 all ratified at the recommendations · building · plan: `COACH_PORTAL_LAUNCH_BATCH4_PLAN.md`
> **Mockups (binding):** `claude.ai/code/artifact/66c2fc6b-cea1-45fa-90ee-fa2effe620d6` (rev 2)
> **Owner calls at approval:** no "Tournament" badge on schedule rows (the colour rail + the tournament name already say it, and the badge cost phone width); reschedule behaviour spelled out and specced (below).
> **Closes the last of the 8 launch-blocking P0s** from the premium Coaches Portal readiness review. After this, Batches 1–4 are a release-ready bundle.

---

## What it does

**Today:** when a paying coach's team plays in a real FieldLogicHQ tournament, those games show up on their team calendar as a **read-only chip**. Tapping it goes to the public game page — or nowhere. There is no attendance, no lineup, no way to prepare. Meanwhile the practice they typed in themselves last Tuesday has both. For a lot of teams, tournament games *are* the season, so the product is at its weakest on the games that matter most.

**After:** a real tournament game behaves like any other game on the team calendar. The coach opens it and gets attendance and the lineup builder. It counts toward the season record, feeds Insights and the Season Wrapped card, and shows up in the "lineup not set" nudges. The **time, opponent, field and final score stay true to the organizer's schedule automatically** — when the tournament reschedules a game or a bracket resolves, the coach's calendar follows without anyone re-typing anything. What the coach adds on top — arrival time, uniform, notes, attendance, the lineup — is theirs and is never overwritten.

**Also in this batch:** **Attendance finally gets a front door.** Today the season attendance report is reachable only through a small secondary button on the Roster page that disappears when a coach switches to the depth-chart view — it is in neither the sidebar nor the phone navigation. Two independent reviewers found this separately. It becomes a real navigation item, and it stops being a dead end: the page now opens with "take attendance for your next game" and links straight to where attendance is actually recorded, and back again.

## Why it matters

The signup page sells "dues, documents, attendance, lineups" as the reason to pay $29/month. A coach who upgraded specifically to run their tournament weekend currently discovers those tools are missing on exactly the games they upgraded for. That is the single clearest value-realization gap left in the paid product, and it is the last thing standing between this portal and a confident go-to-market.

The attendance fix is smaller but the same category: a feature that is built, works well, and is effectively invisible.

## Who it affects

- **Every premium coach** whose team plays in a FieldLogicHQ tournament — head coaches and assistants alike (assistants use the same tools under the same permissions they already have; nothing new to grant).
- **Org-created club/league rep teams** gain something they have never had: today their tournament shows on the Tournaments page but its **games** never reach the Schedule at all. That inconsistency closes here.
- **Organizers** are unaffected — they keep running their tournament exactly as they do now. Their schedule simply becomes the source of truth for the coaches playing in it.
- **No plan or pricing change.** No new permission to configure.

## What the coach sees and does differently

1. **On the Schedule**, a tournament game is a normal game row with a small "Tournament" badge, sitting in date order alongside practices and league games. Games with no date yet (an unresolved bracket slot) stay in the existing "To be scheduled" group until the bracket resolves, then join the calendar on their own.
2. **Tapping it** opens the same panel as any game: Attendance and Lineup tabs, the same auto-save, the same "marked in but not in the lineup" reconciliation.
3. **A line at the top says where it came from** — *"From Spring Classic · organizer's schedule"* — with a link to the public game page. Time, opponent and venue are shown as facts, not fields.
4. **"Edit details" still works**, but only for the things that are genuinely the coach's: arrival time, uniform, field notes, links, tags. There is no Delete — that game belongs to the tournament.
5. **When the organizer moves a game**, the coach's calendar has already moved by the time they look.
6. **The season record now includes tournament games.** ⚠ A team that has been hand-typing its tournament games will see its displayed record change once when this lands — that is the correction, but it will be noticed.
7. **Attendance** appears in the sidebar under Squad (Roster → Attendance → Lineups) and in the phone "More" menu, and its page starts with the next game to take attendance for.

## "I built my lineup and then the organizer moved the game"

Owner question at approval. The answer, and what we build for it:

- **The lineup and the attendance survive, untouched.** They are attached to the game itself, not to the slot it was in — so a reschedule carries them. The coach opens the game at its new time and their work is exactly as they left it. Nothing to rebuild. (This is the property that makes the whole design worth having, so it gets a dedicated test rather than an assumption.)
- **We tell them it moved.** A quiet **Moved** marker on the schedule row and a *"Moved from Sat May 16, 9:00 a.m."* line inside the game, which clears once they've opened it.
- **When the *day* changes, one extra sentence:** *"Attendance was taken for the old time — worth re-checking."* Eleven people said yes to a Saturday morning; Sunday afternoon is a different question. We never wipe their attendance — we just say so.
- **Some organizers reschedule by deleting and re-creating**, and regenerating a bracket does it wholesale. Left naive, that would strand a coach's lineups on dead rows mid-tournament and hand them a set of empty new games. So we **recognise the replacement** — same tournament, same opponent, same day — and move the coach's game onto it rather than killing one and creating another. Their work follows. If more than one game could be the replacement, we don't guess; the old one is kept as cancelled with everything intact.
- **Not in this batch:** a push or email "your game moved" to the coach. That alert is already being built for families following a team in another workstream; the coach-facing version should ride it rather than being written twice.

## The one thing that needs care at launch

Coaches have been **working around this gap by typing their tournament games in by hand.** The moment the real games arrive, those teams see two rows for the same game — and both count toward the record. The plan handles this deliberately: the duplicate is **named, not silently resolved**. The coach gets a quiet notice and a one-tap "remove my copy", with a confirmation that says plainly what goes with it (its attendance and its lineup). We never delete a coach's work on a guess, and we never quietly double-count their season.

## Trade-offs taken

- **We mirror the organizer's games onto the team calendar rather than teaching every tool to understand two kinds of game.** The mirror is one small addition plus a keep-in-step routine; the alternative touches roughly a dozen places, any one of which could later be updated for one kind of game and not the other. The mirror also means tournament games work in places nobody would have remembered to update — the season record, Insights, Season Wrapped, and the club admin's past-season view.
- **The coach cannot edit an organizer-owned fact.** This is deliberate: a coach should never be able to make their own calendar disagree with the tournament they are playing in. Everything a coach genuinely owns stays fully editable.
- **A game the organizer removes is cancelled, not erased, when the coach has already worked on it.** Their attendance and lineup survive; the row reads as cancelled and stops counting. When there is no coach work on it, it just disappears cleanly.
- **Games only join the current season.** A tournament played before this season began stays with the season that closed, so a rollover never resurrects last year's results into a fresh record.

## Priority

**High — the last launch blocker.** With it done, all eight P0s from the readiness review are closed and Batches 1–4 can be planned as a single production release.

## Success criteria

- A coach can take attendance and build a lineup on a real platform tournament game, from the Schedule and from the Overview's game-day card.
- Rescheduling a game on the tournament side moves it on the coach's calendar with no coach action.
- Removing a game on the tournament side never destroys attendance or a lineup the coach already saved.
- A coach cannot edit or delete the organizer's facts, from the UI or by any other route.
- Tournament games appear in the season record, Insights and Season Wrapped through the same rule every other game uses.
- Attendance is reachable from the sidebar and the phone navigation, and its page names where to go to record it.
- An org-created rep team with an admin-linked registration sees its tournament **games**, not just its tournament.
- Nothing scrolls sideways at 360px; owner phone pass is clean on both themes.

## Decisions needed from the owner (detail in the plan, recommendations marked)

1. **Mirror the organizer's games onto the team calendar** (recommended) vs teach attendance/lineups to attach to two different kinds of game.
2. **Only games from this season mirror in** (recommended) vs every linked tournament game regardless of when it was played.
3. **Tournament games count toward the record, Insights and Wrapped** (recommended yes).
4. **Attendance becomes its own Squad navigation item, page opens on "take attendance"** (recommended).
5. **Bundle the game-day card fix** — on game day the Overview currently offers *less* than it did three days earlier (recommended: fix that, skip the bigger game-day card for now).
6. **How to handle coaches who already typed their tournament games in by hand** — surface the duplicate and offer a one-tap fix (recommended) vs leave both vs auto-merge.

## Out of scope

The frozen read-only past-season portal (next project), a no-login "follow this game" link for families, the postgame recap draft, in-portal tournament registration, and the remaining post-launch P1 list (weekly recurrence, schedule import, money reports on phones, the mobile notification bell, Chat vs Announcements clarity).
