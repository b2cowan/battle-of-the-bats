# PM Brief — Practice Plans get a front door, and the coach sidebar stops rearranging itself

**Approved:** 2026-08-15 from mockups. **Phase 1 built on dev the same day.**
**Plan:** `COACH_NAV_AND_PRACTICE_PLANS_PLAN.md` · **Mockups:** artifact `ed56fe2c…`

---

## What a coach sees differently

### 1. Practice plans are finally somewhere you can find them *(built)*

A coach who wants to prepare Thursday's practice on Wednesday night currently has to open the
Schedule, remember which day the practice is on, tap the right event, and scroll a panel. Three
interactions deep, and only if they already know the date.

Now there is a **Practice plans** item in the sidebar, sitting under Season between Schedule and
Lineups. It opens a page that shows:

- **Every upcoming practice**, nearest first, each one saying whether it has a plan yet.
- **A "Needs a plan" filter** with a live count — one tap to see only the practices still waiting.
- **Recent practices**, so last week's session is one tap away when this week's is a variation on it.
- **Run practice** on a practice happening now, so the door to the live screen is on the list itself.
- **A Templates tab** holding the same reusable plans the Development area already stores. One
  library, two doors — nothing is duplicated or moved.

The Schedule keeps its own "Plan this practice" button. This adds a way in; it takes none away.

### 2. Why this matters

We built the full treatment for the *less*-used tool. Lineups gets a nav door, a hub, a readiness
filter and templates — for something a coach makes maybe twenty times a season. Practice plans, made
two to three times as often, got a link buried in a panel. This corrects that imbalance, and it is
the only item in this project that adds capability rather than tidying what exists.

### 3. Coming next (approved, not yet built)

- **The Attendance page stops saying "nothing here" three times.** One empty state instead of two,
  everything on one left edge, and the paragraph explaining how attendance is counted moves under
  the table where the figures are. When there are games on the schedule but nothing marked yet, the
  coach sees their actual roster with dashes rather than a second empty message.
- **Attendance moves into Insights** and is retitled "Who's showing up?". It never recorded anything
  — marking players present happens on the Schedule, on the event — so it belongs with the other
  season reports. Nothing changes about how attendance is actually taken.
- **The sidebar is reordered by how often a coach opens things**: Season → Progress → Money →
  Communication → Team → Team admin. Roster and Tryouts move down together (both are September
  jobs), Development joins Insights under a new **Progress** group, and the **"Explore" shelf is
  deleted** — so items stop silently relocating themselves as a season progresses.

---

## Access and roles

- **Seeing** the practice plans list needs schedule access — the same access that already lets a
  coach see the schedule at all.
- **Creating or editing** a plan stays head-coach-only, exactly as it is today.
- **The Templates tab** appears only for coaches who can manage the schedule, matching what the
  template library already requires. An assistant without it sees the practice list alone rather
  than a tab that refuses them.
- **Past seasons:** practice plans are a live-season tool and are not part of the read-only archive.
  A coach viewing a completed season sees a short explanation instead of a list they could not open.

When Attendance moves to Insights, one role case changes: an assistant whose *only* duty is
attendance keeps the ability to mark players present, but loses the season report. **This needs an
owner yes before that phase is built.**

---

## Tradeoffs made

- **"Season" kept as the group label** rather than "Game day" or "This week" — practices aren't game
  day, and keeping the existing word means coaches don't have to relearn a heading.
- **Tryouts left exactly where it is.** An earlier proposal made it move to the top of its group
  while a tryout was open; the owner ruled against a nav that moves. Consistency beat cleverness.
- **The Explore shelf deleted, not renamed.** The deeper problem wasn't the word, it was a sidebar
  that rearranged itself based on what the team had and hadn't done yet.

---

## How to test it (Phase 1)

1. Open a team with practices on the schedule → **Practice plans** in the sidebar under Season.
2. Confirm upcoming practices list nearest-first, each showing **Plan set** or **No plan**.
3. Tap **Needs a plan** → only unplanned practices remain; the count matches.
4. Open one → the existing plan editor, unchanged.
5. Switch to **Templates** → the same templates visible under Development; the URL is shareable.
6. Switch the season selector to a completed season → a short explanation, no practice list.
7. As an assistant coach without schedule management → the Practices tab, no Templates tab.

---

## Success criteria

- A coach can get from anywhere in the portal to "which practices still need a plan" in one tap.
- No existing route, label, or permission changes — nothing a coach knows today stops working.
- Templates stay a single library however they are reached.
