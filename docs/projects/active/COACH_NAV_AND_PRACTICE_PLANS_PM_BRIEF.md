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

---

# Phase 5 (proposed) — the sidebar goes from six headings to five

**Awaiting your decision. Nothing built.** Side-by-side mockup of all four versions:
`https://claude.ai/code/artifact/93e1e3ef-0382-408b-ad45-1499e1b02580`

## The proposal on the table

Move **Roster** and **Tryouts** *down* to join Staff, Documents and Settings under a single **Team**
heading — rather than *up* to join Development and Insights.

## What a coach sees differently

The sidebar loses one heading. The bottom of the menu becomes a single group of five — Roster,
Tryouts, Staff, Documents, Settings — instead of two groups of two and three sitting one above the
other with near-identical names ("Team" and "Team admin").

**Nothing changes position.** Every door a coach has learned to find stays exactly where it is; one
divider line and one heading disappear. On a phone the improvement is bigger: the More sheet
currently has three headings that label a single row each, and this removes one of them.

## Why not the other way round

Moving Roster and Tryouts *up* would put Tryouts — a tool used for about two weeks a year — above
Money and Chat, which coaches open weekly. The sidebar's ordering rule is "hot at the top, cold at
the bottom", and that merge is the one version of this change that breaks it. It also keeps both the
"Team" and "Team admin" headings, which is the confusion worth fixing.

The name is the other problem: a group holding Development, Insights, Roster and Tryouts means
*the people on the team, plus how the team is performing, plus people who aren't on the team yet*. A
heading that broad can also hold Staff, Settings, Money and Chat — and a heading that rules nothing
out doesn't help anyone find anything.

## Tradeoffs

- The bottom group becomes the longest in the nav at five rows. That density is spent in the region
  coaches scan deliberately rather than glance at.
- A further cut to **four** headings is available (folding Development and Insights up into Season)
  and is deliberately held back — six rows under one heading starts to need reading rather than
  seeing. It stays a one-line change available any time.

## What this does not fix

The sidebar currently runs off the bottom of a laptop screen — Tryouts is clipped. Removing a
heading buys back about one row. **Treat the overflow as its own decision**: collapse the coldest
group by default, pin the team switcher and Help/Admin doors so only the list scrolls, or accept
that fifteen doors is the honest count and the list scrolls.

## How to test it (if built)

1. Open a team → the sidebar shows five headings: Season, Progress, Money, Communication, Team.
2. Confirm Roster and Tryouts are still first in that last group, in that order, with Staff,
   Documents and Settings beneath them.
3. On a phone, open **More** → the same grouping, with Tryouts leading the Team section.
4. Sign in as an assistant coach with no tryouts or staff permission → those rows are absent and no
   empty heading is left behind.
5. Open a team whose season has finished → the first slot still reads **Season's End**, and the
   groups a finished season can honestly serve are unchanged.

## Success criteria

- One fewer heading on desktop and on phone, with no door moving position.
- No coach gains or loses access to anything.
- "Team" and "Team admin" no longer both appear.

## Phase 5b — the groups collapse *(added 2026-08-18)*

**Grouping half approved.** Added to scope: the five groups become collapsible, working the same way
tournament admin's sidebar already does.

*(Correction to the section above: the sidebar has **15** rows, not 17, and the phone sheet has 11,
not 10. The argument is unchanged; the figures were wrong.)*

### What a coach sees differently

Each group heading gains a small arrow and can be folded shut. Whatever they open or close stays that
way next time they sign in. Two behaviours make it safe rather than fiddly:

- **You can never hide where you are.** The group holding the page you're on opens itself, whatever
  you last set — so a coach can't close a group, arrive there from somewhere else, and find their own
  location missing from the menu.
- **A closed group still tells you what's inside.** It shows how many doors are folded away, and if
  something in there needs attention — an unread message — the badge moves up onto the heading.

### The default, and why only one group starts closed

**Team starts closed. The other four start open.**

The nav's ordering rule is how often a coach opens a group, and it settles this: anything opened
weekly or more should never start closed. Folding Money or Communication away by default would tax a
weekly job on every device to save scroll on an August one. Team is the longest group and the
coldest — five rows recovered for the cost of one click a season.

That takes the sidebar from **fifteen visible rows to ten**, which is what actually fixes it running
off the bottom of the screen. The grouping change on its own was only ever worth about one row.

All five stay collapsible either way — a coach who never runs tournaments can close Season and keep
it closed. The default just decides who pays the click.

### The thing that could have gone wrong quietly

Chat's unread count lives inside the Communication group. Once that group can close, a coach who
closes it stops seeing that anyone has messaged them — nothing breaks, the signal just goes away.
Hence the rolled-up badge on closed headings. Tournament admin doesn't need this because its groups
carry no badges; this is the one place the coach portal goes further than the pattern it's copying.

### Held back deliberately

A version that opens **Team** automatically during tryout season would be genuinely useful — but the
August work removed a mechanism that moved nav items around based on whether a team was using them
yet, because a sidebar that rearranges itself moves things a coach has already learned the position
of. Auto-opening is a gentler form of the same thing. A coach's own saved preference covers it.

### Tradeoffs

- One group starting closed is a modest-sounding outcome next to "make them all collapsible" — but
  it's the only group where the trade is favourable, and pretending otherwise costs weekly clicks.
- **Phone: no collapsing.** The More sheet is something you open in order to find something; folding
  its contents away works against that moment. Desktop and phone keep identical grouping — only the
  presentation differs.
- Worth doing in the same pass: pinning the team switcher and the Help/Admin doors so only the list
  of doors scrolls.

### How to test it

1. Open a team → five headings, each with an arrow. Team is folded shut, showing **5** beside it.
2. Click Team → it opens; sign out and back in → still open.
3. Close Team again, then reach Roster from a link elsewhere → the Team group is open around it, with
   Roster highlighted.
4. Have someone send a chat message, then close the Communication group → the unread count appears on
   the closed heading.
5. On a phone, open **More** → same five groups, nothing folded.
6. Sign in as an assistant coach with no tryouts or staff permission → those rows are gone and the
   heading's folded count reflects only what they can actually reach.

### Success criteria

- The sidebar fits a laptop screen without clipping, with no door moved and none removed.
- No coach loses sight of an unread message because of a group they closed.
- A coach who never touches a group can put it away permanently, and it stays away.

## Phase 5c — the phone's bottom bar, reviewed *(2026-08-18)*

**Outcome: the four tabs stay. What changes is that there's now a written reason for them.**

### Why the bar wasn't the problem

The four tabs — Overview, Schedule, Chat, Roster — were picked in June and nothing ever recorded
why. The sidebar got its ordering principle in August; the bar never got its counterpart. That's the
real gap: without a stated reason, the next person to look will rearrange it on instinct.

**The rule to adopt: the bar holds look-up surfaces, not work surfaces.** A phone gets opened for
ninety seconds to check one thing, so no two tabs may answer the same question. Under that rule all
four earn their place and each owns a different question — what's next, when, what's been said, who.
It's also the test any future fifth tab has to pass.

### On Roster specifically

Roster being low in the sidebar and prominent on the phone looks inconsistent but isn't. On a
laptop, Roster is the September editing session — adding players, fixing a jersey number. On a phone
it's *who is number 14 and what's their parent's number*. The same door, two different jobs, two
different frequencies. Worth writing down rather than leaving as something that looks like an
oversight.

### Are these tabs available to every coach? Not quite

Every head coach and every assistant on the standard permissions sees all four. The one exception is
a **volunteer helper** — a parent running a station — who loses Chat (they're not in the staff room)
and Roster (they hold no player records). Their bar is **Overview, Schedule, More**, and the three
stretch to fill the width.

That's correct behaviour rather than a fault: both closed doors are ones they couldn't use. But it's
a real state nobody had written down, and it's worth knowing it exists before someone reports it.

### Two things that leave this project

**1. A change landed this week that isn't finished on phones.** A team between seasons now gets one
door instead of a full menu — right on desktop, half-done on phone, where the menu behind **More**
still lists all eleven doors into a season that's over. So the same coach sees one door on a laptop
and twelve on a phone. The automated check meant to keep the two navs in step only compares
live-season menus, so it won't catch this. The bar also drops to two tabs stretched across half the
screen each — a state nobody designed. **This belongs to whoever is finishing that work**, and is
worth raising before it's committed.

**2. The bar's real gap is attendance, not Roster.** Marking who showed up is the most phone-shaped
job in the product, and there's no door to it in the bar — it's Schedule, find tonight's event, take
attendance. Three levels deep, and only if you already know the date. That's the same shape of
problem practice plans had before August.

A fifth tab is the wrong answer — it would overlap Schedule and break the rule above. Two cheaper
options deserve their own look: the Overview's "one thing to do today" card offering attendance
directly on event days, or the Schedule tab opening on today rather than at the top of the list.

### Success criteria

- The bar's four tabs are unchanged, with a recorded reason a future reviewer can argue with.
- The volunteer's three-tab bar is a documented state, not a surprise.
- The between-seasons mismatch and the attendance gap are owned somewhere, not lost in a mockup.
