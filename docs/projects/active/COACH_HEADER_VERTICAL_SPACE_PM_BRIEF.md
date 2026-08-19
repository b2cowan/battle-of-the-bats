# PM Brief — Coach portal header: reclaiming vertical space

**Status:** ✅ **BUILT ON DEV 2026-08-18** · ⚠ **one direction REVERTED by the owner 2026-08-19 — see the last section; the bar no longer slims on scroll** — owner approved four of the five directions the same day.
Owner QA owed (ledger §59). Nothing shipped to production. **The fifth direction is parked, not
closed** — the owner is reconsidering it.
**Plan:** `COACH_HEADER_VERTICAL_SPACE_PLAN.md` · **Mockup:** `claude.ai/code/artifact/ccc08606-fcc2-41b4-b56f-627a8967a7cd`

---

## What a coach gets, as built

On a laptop, the chrome a coach scrolls past before reaching real content went from **234 pixels to
190** — and once they start scrolling, from **122 pixels of permanently pinned bars to 88**. On a
phone, 208 to 188.

Four things changed, and a coach arriving on a page loses nothing:

- **The team bar slims as you scroll**, on a computer as well as a phone. Full bar at the top of the
  page; one slim line — team name and today's status — once you're reading. Scroll back up, it returns.
- **The club's name moved down one line**, from its own line above the team name to the start of the
  quieter line below it. Still on every team page. A standalone team sees no change.
- **Assistant coaches stop being told their role twice** — the sidebar heading went, the badge beside
  the team name stayed.
- **Every page title is quieter** — smaller icon, smaller heading, tighter gap. Same slots, same
  places, same behaviour; 80 pixels of title band is now 52.

### Three things that came out differently from the estimate

1. **The phone's page title barely shrank** (4px, not the ~28 estimated). Its height is set by the
   minimum finger-friendly size of the help button, not by the icon — so shrinking the icon bought
   nothing there. The phone's real gain came from the club-name change instead.
2. **The 98-pixel finished-season phone bar is now 82, not ~72.** The extra line it was carrying is
   genuinely gone; what's left is the test team's unusually long name wrapping its role badge. A
   normal team name won't do that — worth confirming with your own eyes on a real team.
3. **One thing could not be proved by measurement**: the test team has no game this week, so the slim
   desktop bar had no status to show. The mechanism is in place and correct; whether it reads well
   needs a look at a team with a game coming up.

---

# The proposal, for the record

*Everything below is the exploration as presented on 2026-08-18, kept unedited so the reasoning behind
the approved build stays readable. Where it says "recommended" or "not recommended", read "proposed".*

## The question that was asked

Can the team-identity bar (club name, team name, role, season, record, today's status) be folded into
the FieldLogicHQ strip at the very top, so a coach gets more screen for their actual work?

## The answer

**The two rows don't repeat each other — that was already fixed two days ago.** The shell slimdown
deleted the sidebar's copy of the club name, and since then the strip says one set of things (the
product's name, the words "Coaches Portal", your notifications/account/workspaces) and the team bar
says a completely different set (which club, which team, your role, which season, your record, what's
happening today). Not one word in common.

**But the space complaint is right.** On a laptop, a coach scrolls past **234 pixels of chrome** before
reaching the first line of anything useful — about a quarter of the screen. On a phone it's 208.

The pixels are just not where the question points.

---

## What a coach would see, and lose or gain

### Recommended: three changes, all small, none destructive

**1. The team bar shrinks as you scroll (desktop).**
When a coach lands on a page, nothing is different — full bar, club, team, role, season, record,
today's status. Once they scroll into the page it slims to a single line: team name on the left,
today's status on the right, still pinned. This is exactly what the phone has done since August;
the desktop version is slightly more generous because there's room for the status line.

- **Gains:** 34px back, permanently, *while reading* — which is when it's wanted.
- **Loses:** nothing at rest. While scrolled, the club name, role and season are out of sight until
  you scroll back to the top. The game-week scouting reminder also tucks away while scrolled (same as
  it already does on a phone).
- **Finished season:** collapses to team name + "Complete". The finished-season badge is never lost —
  it's the only place in the portal that says a season is over.
- **Phone:** unchanged.

**2. The team bar goes from three lines to two.**
Today: club name / team name + role / season · record. Proposed: team name + role / club · season ·
record. Nothing disappears — the club is still named on every team page.

- **Gains:** 11px on every screen, both devices, at rest.
- **Bonus fix:** on a phone, a finished season's bar is currently **98 pixels** — the tallest bar in
  the product on the smallest screen — because "Complete" and the final record get pushed onto a third
  line. This change brings it back to normal.
- **Loses:** the club name is one step quieter. Coaches with a standalone team (no club) see no change
  at all, since they never had a club line.

**3. Assistant coaches stop being told their role twice.**
An assistant currently reads "Assistant Coach" in the team bar *and* in the sidebar, two inches apart,
on all forty screens. The sidebar copy goes. Head coaches are unaffected.

- **Gains:** no pixels — this one is about not repeating yourself.
- **Loses:** nothing. The badge that remains is the one that's also visible on a phone.

### Considered and not recommended

**Moving team identity into the FieldLogicHQ strip** — the original idea. It's the biggest single
number (74px) but only on desktop; **on a phone it saves nothing at all**, because that strip doesn't
exist below 900px. It would mean building and maintaining the same identity twice, in two shapes; the
live "game day / what's next" line would have to be re-fetched on every page instead of once per team
visit; and the game-day link to the bench console and the scouting reminder would have nowhere to
live. Pages with no team — the team picker, notifications — would show a half-empty bar or a stale team.

**⚠ This is also the shape that was tried and rejected on 2026-08-02** and marked "do not re-propose".
Fair caveat: one of its two original reasons no longer applies (the shell slimdown removed the
duplicate it was reacting to). So it *can* be reopened — but it should be a deliberate call, not a
side effect of a space exercise. The plan flags it so the decision is made with eyes open.

**This is a different question from the Variant B decision.** That one was about whether to put a
quiet club line in the sidebar for the two pages that have no team bar; the answer was no, and nothing
recommended here touches it.

### Worth more than everything above, and deliberately separated

**The page title band.** The single biggest block of space isn't either header row — it's the **80
pixels** the page title takes: a 48px icon tile, the largest heading in the product, and a big gap
underneath, to say one word ("Schedule") that the highlighted sidebar item has already said. Making
the tile and heading one step smaller and tightening the gap gets ~28px back without changing the rule
that all forty screens open identically. It's recommended — but as its own session, with its own
mockups, because it lands on every screen in the portal.

---

## Why it matters

Coaches use this portal on the sideline and at the kitchen table. A quarter of a laptop screen spent
on chrome is a quarter of the roster, the schedule or the money book they have to scroll to reach.
Reclaiming 45 pixels while scrolling and 11 at rest isn't dramatic, but it's free — no feature removed,
no coach re-learning where anything lives.

## Access differences by role

None. Every direction here is chrome; nothing changes what a head coach or an assistant can do. The
one role-specific change (dropping the duplicate "Assistant Coach" label) affects assistants only, and
they keep the badge that also shows on their phone.

## Priority and success criteria

**Priority:** low-medium. Nothing is broken. The strongest single argument for doing it now is the
98px finished-season phone bar, which is a real defect hiding inside a polish item.

**Success:**
- A coach arriving on any team page sees exactly what they see today.
- A coach scrolling a long page keeps team name and today's status pinned, in 40px instead of 74.
- A finished season on a phone no longer wears a three-line header.
- No screen loses the club name, the finished-season badge, or the live status line.
- Chat, practice plans and section deep-links all still size and scroll correctly against a bar whose
  height now changes as you scroll — the one place this can break something invisible.

## Decisions needed before anything is built

1. Is the strip-merge idea closed for good, or reopened knowingly?
2. Does the shrunken desktop bar keep today's status, or match the phone's bare team name?
3. Is the club name on line two acceptable?
4. Does the page-title diet get its own session?

---

## The single-header idea is parked, not dead

The owner's call on 2026-08-18: *"don't close D forever, I am reconsidering. Let's see how this
solution goes but I am not opposed to revisiting moving to the single header."*

So the August "do not re-propose" is lifted, pending how this build feels in use. If it comes back, it
comes back with five questions that this pass did not answer — the phone (which has no top strip at
all), where today's status would come from, keeping the record identical on every device, where the
game-day link and the game-week reminder would live, and what the bar shows on pages with no team.

One thing worth carrying forward: the slim bar built here proves team identity fits in **40 pixels**.
A merged bar at that height is a genuinely different proposal from the one rejected in August, and
probably the version worth mocking up first.

---

## What the review changed (2026-08-19)

Two fixes, one owner ruling.

**A drill-in heading finally looks like a child.** Review found that the smaller heading used on
drill-in screens — Money → Fundraisers → one fundraiser, and the same for sponsors — **has never
actually rendered smaller**. The rule that shrinks it was written the day that screen shape shipped
(five days ago) but was placed where it could never take effect, so a drill-in heading has always
matched the hub heading above it exactly. It's fixed: the child heading is now visibly smaller than
its parent, which is the entire reason that shape exists. Worth a look when you walk it, because
you have never seen it render correctly.

**Keyboard users don't lose their place when the bar slims.** If someone was on the "Public site"
link or the reminder's dismiss button and then scrolled, that control disappeared out from under
them and their place on the page was silently lost — the next Tab restarted from the top. Now their
place lands on the bar itself. This was already happening on phones since August; nobody had hit it.

**The role badge stays off the sidebar, as you ruled.** Review flagged that deleting the sidebar
label and hiding the badge on scroll together mean an assistant's role isn't stated anywhere while
they're scrolled down — and that the reason I gave you for deleting it ("the badge is always
visible") was true at rest, not always. You ruled no change; desktop now matches the phone.

**One thing review got wrong, and how we knew.** Two reviewers disagreed about the drill-in heading
— one read a comment in the code claiming the sizes were fine and believed it. Rendering the actual
page settled it: the comment was wrong. The comment has been corrected, and the trap written down so
the next person can't repeat it.

---

## ⚠ Reverted on 2026-08-19 — the bar stays put

*"I want to revert one thing, I like the size changes we made but you can leave this header as is
when scrolling."*

**The team bar no longer slims as you scroll on a computer.** It stays full height at every scroll
position, exactly as it always did. Phones are untouched and still slim to the team name, as they
have since August.

**Everything else stands.** The bar is still two lines instead of three, the sidebar still doesn't
repeat your role, and every page title is still quieter.

### What a coach actually gets, final

| | before | after |
|---|---|---|
| Laptop — chrome above the first line of content | 234px | **190px** |
| Laptop — chrome pinned there while you scroll | 122px | **106px** |
| Phone — chrome above the first line of content | 208px | **188px** |

The difference from the earlier report: the laptop figure while scrolling is 106px rather than 88px,
because the bar no longer shrinks. Everything else is unchanged — and the at-rest gain, which is the
number a coach meets on every screen, was never affected by the collapse.

### The rule worth keeping from this

Space taken by making something **smaller** is kept. Space taken by making something **disappear and
come back** is borrowed. The collapse was the second kind, and it was the one change that made a bar
whose whole job is to sit still start moving. The reverted experiment is recorded as data, not as a
proposal to bring back.

### Two fixes from the reverted work were kept on purpose

The keyboard-focus fix stays — it turned out to be a **phone** problem that had been live since
August, and the desktop version was only what made a reviewer notice it. The drill-in heading fix
stays too; it was never related to the collapse. A reversal undoes the change, not the defects the
change exposed.
