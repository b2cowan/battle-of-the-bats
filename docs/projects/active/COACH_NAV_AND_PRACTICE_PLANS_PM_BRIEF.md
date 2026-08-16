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

### 3. The Attendance page now answers once *(built on dev, 2026-08-15)*

The screen that started this review is fixed. What a coach sees now, by situation:

- **Nothing on the schedule yet** — one card, alone on the page: *"Nothing to take attendance for
  yet"*, with a single button, **Open schedule**. Nothing else draws. This was the reported
  screenshot, and it is the rarest state. *(The mockup also drew a "How attendance works" button
  here; the owner cut it — the "?" is already in the corner of the same screen and opens the same
  help, and a second door to it one line below is the duplication this phase exists to remove.)*
- **Games and practices exist, but nobody has been marked** — the *common* first-week case, and the
  one that used to get a second "nothing here" message. The coach now sees the **"Take attendance"**
  shortcut, one quiet line saying totals fill in as they mark, and **their real roster** with a dash
  in each column. It proves the roster is connected and shows the shape that's coming.
- **Attendance is being taken** — the shortcut card, then the report as a proper table with
  **Games** and **Practices** headed once at the top instead of the label repeated inside every row.
  A player nobody has marked yet still reads *"not tracked yet"* rather than a pair of zeros.
- **No active players on the roster** — one quiet line, alone, with no button: the coach who can
  hold the attendance duty may not have roster access at all, so we don't offer a door that would
  refuse them.

**The paragraph about how figures are counted** — including the deliberate "to inform playing-time
decisions… not a ranking" wording — is kept word for word, but folded shut under the table as
**"How these figures are counted"**. It's out of the way of the data, and it doesn't appear at all
on a page with no figures.

**Everything now shares one left edge.** That was the actual complaint: three blocks starting in
three different places. On a phone the table stacks into per-player cards, where each figure gets
its label back automatically.

One small correctness fix travelled with it: opening a player from a **past season's** attendance
report used to land on that player's *current* season. It now stays in the season the coach was
reading.

### What the review changed afterwards

An adversarial review of all four phases found the navigation and permissions work clean, and
everything worth fixing in one place — what a **finished season** does. Four things changed:

- **The Roster page's "Attendance" button is gone.** We'd said Attendance now had one way in; it
  had two, and the second one meant the "back" link was still wrong for anyone who used it. Insights
  is now genuinely the only door — which is what makes the back link honest. *(That button also
  disappeared whenever a coach switched Roster to its depth-chart view, so it was an unreliable door
  as well as a duplicate one.)*
- **A finished season no longer offers to take attendance.** The shortcut card used to appear there
  exactly as in a live season, and tapping it did nothing at all — it looked for the old event on
  this year's schedule and found nothing. A completed season now shows the report and nothing else,
  and its wording is in the past tense rather than promising totals that will never arrive.
- **A flicker on brand-new teams is gone.** Depending on which of two lookups came back first, the
  page could draw the full roster table and then replace it with the "nothing here" card a moment
  later. It now waits until it actually knows.
- **Two help passages** still used the old wording and one pointed at the Roster button. Corrected.

**One thing found and deliberately not fixed here, because it's outside this project:** in a
finished season, the "Insights" link leads to the season results page — and *that* page doesn't read
which season you asked for. A coach still running the team sees this year's results, with nothing on
screen saying so. It's the most valuable item left on that rail and it's written up in the plan.

### 4. Attendance now lives in Insights *(built on dev, 2026-08-15)*

Attendance has left the sidebar. Nothing is lost and nothing about taking attendance changes — the
page never recorded anything in the first place. Marking players present still happens on the
**Schedule**, inside a game or practice, exactly as before.

What a coach sees:

- **The sidebar is one item shorter**, on desktop and in the phone "More" sheet. The report is
  reached from **Insights**, where it always had a tile, alongside "How are we doing?", "Where is
  playing time going?" and the rest.
- **The page is titled "Who's showing up?"** — a question, like every other report on that hub. The
  Insights tile was reworded to match it word for word, so a coach never goes through a door named
  one thing and lands on a page named another.
- **The back link is finally right.** It used to point at Insights whether or not you came from
  there — wrong for most coaches, because most arrived from the sidebar. Now there is only one way
  in, so the link tells the truth. On a **finished season** it points at the season's results
  archive instead, which is where the coach actually was.

**Two things worth knowing, because both were nearly decided the wrong way:**

- **No coach loses access.** The plan flagged this as an owner decision — the worry being that an
  assistant whose only duty is attendance would keep marking players present but lose the season
  report. That turned out to be **untrue of the product as it stands**: holding the attendance duty
  already grants Insights. There was nothing to rule on, and the rule is now locked down by an
  automated check so a future change can't quietly break it.
- **A finished season keeps its own Attendance link in the sidebar.** This looks inconsistent and
  isn't: in a past season, "Insights" goes to the results archive rather than the reports hub, so
  that sidebar entry is the *only* way back to a past season's attendance. Removing it to match the
  live sidebar would have silently deleted a report the archive is supposed to keep.

### 5. The sidebar is reordered around what a coach is doing *(built on dev, 2026-08-15)*

The sidebar had never had a stated ordering principle. Its groups described *what the data was
about* — "Squad" is people, "Season" is time — but a coach on a Tuesday night isn't thinking
"people", they're thinking "practice is in two hours". The groups now run **hottest at the top,
coldest at the bottom**:

| Group | What's in it |
| --- | --- |
| *(top, ungrouped)* | Overview |
| **Season** | Schedule, Practice plans, **Lineups**, Tournaments |
| **Progress** *(new)* | **Development**, Insights |
| **Money** | Money |
| **Communication** | Chat, Email families |
| **Team** *(was "Squad")* | Roster, Tryouts |
| **Team admin** | Staff, Documents, Settings |

Lineups moved because a lineup is something you build for a *game*, not a fact about the roster.
Development moved because it's closer to Insights than to the schedule. Roster and Tryouts travelled
down together and kept their order — they're both "set the season up" jobs, and one produces the
other. **Nothing was renamed except the "Squad" heading**, and no page moved, so nobody's
permissions changed.

**The "Explore" shelf is gone.** Tryouts and Tournaments used to sit under it until your team ran a
tryout or entered a tournament, then jump up into another group — which meant **the sidebar
rearranged itself mid-season**, moving items a coach had already learned the position of. They're
now permanent, in their proper groups, from day one. Both surfaces already explain what they're for
when you open them, which is the job the shelf was doing badly.

Everything moved on **desktop and phone together** — the phone's "More" sheet carries the same six
groups in the same order.

**Two knock-on fixes travelled with it:** the first-run portal tour named a group ("Squad") that no
longer exists and claimed three tools "sit together" that no longer do; and the help guide described
the Explore shelf as a feature. Both corrected in the same change. *(The **free** portal's separate
"Explore" tab — where a free coach turns optional tools on — is a different thing and is untouched.)*

**One open question for you:** under a strict "how often do you open it" rule, **Chat probably
outranks Money** — Chat is daily, Money is monthly. Money is left above Communication because it's
the bigger product pillar. Arguable either way; flagged rather than decided.

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

**Attendance moving to Insights changes no role case.** This brief previously said an assistant
whose *only* duty is attendance would keep marking players present but lose the season report, and
that it needed an owner yes. Checked against the product before building: **it was not true.**
Holding the attendance duty already grants Insights, so every coach who could open the report
before can open it now. No decision was needed, and an automated check now holds that true so a
future change cannot quietly break it.

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
