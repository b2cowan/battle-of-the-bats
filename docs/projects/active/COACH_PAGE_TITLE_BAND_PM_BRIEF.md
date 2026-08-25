# PM brief — the page-title band on a phone

**Plan:** `COACH_PAGE_TITLE_BAND_PLAN.md` · **Mockup:**
https://claude.ai/code/artifact/972ab843-5972-458c-91ca-bf7f2e990d70
**State: RULED, BUILT and ✅ OWNER QA PASSED — 2026-08-25 (ledger §100, no defects). No migration.**
Approved and shipped: the margin trim + the Overview fix, and moving the help "?" into the team bar
at both widths. Not built: folding the page name into the team bar. **Withdrawn: the bottom bar's
fifth tab naming its section.**

---

## ⚠ What the build measured, and where I was wrong

**An ordinary screen came out flat — about one pixel.** The "?" needed a proper 44px home in the
team bar, and that grew the bar by 3px, which cancels the 4px trimmed off the strip below it. I told
you the move was worth 8px a screen; it isn't. It's worth 8px only on screens with **no** button in
their title strip — everywhere else the button, not the "?", was already setting the height.

**What genuinely moved:**

| | before | after |
| --- | --- | --- |
| **Overview** (phone) | 116px of title strip | **56px** — a 57px gain |
| **A screen with no buttons** (Documents, Staff, Lineups, Insights, Practice plans, Tryouts, Settings) | 60px | **48px** |
| An ordinary screen (Roster, Schedule, Money) | 60px | 56px — offset by the bar, so ~flat |
| **A computer, any screen** | — | no height change at all, but **help stops scrolling away** |

**The desktop half delivered exactly what it promised** — scrolled well down a long roster on a full
window, the "?" is still on screen. On a phone the bar shrinks to the bare team name as you scroll
and the "?" goes with it, which is what we ruled. That remains reversible if you'd rather it stayed.

**One thing I broke and caught by measuring:** reserving the "?"'s height on the team bar also
applied to the *shrunken* bar, which took a scrolled phone from 36px to 55px — costing far more than
the change saved. Fixed, and re-measured back at 36px.

**Not taken, and it's your call:** the phone team bar could give back those 3px (and more) by
tightening its own padding. It would make an ordinary screen a real gain rather than a wash — but
it re-tightens a bar you've signed off twice in eight days, so I left it alone rather than slipping
it in behind an approved change.

---

## The question we asked

Every coach screen opens with a strip carrying the screen's name, its icon, its main button and the
help "?". On a phone that strip is the biggest piece of furniture left above a coach's actual work.
Is it worth what it costs — and if not, what replaces it?

## The answer, in plain terms

**Mostly yes, and the thing that looked expensive turned out to be something else.**

The strip is 60px tall on a phone. But its height is set by the **help "?"** — a round button sized
to be reliably tappable with a thumb — not by the screen's name. The name itself accounts for about
a quarter of the height. So removing the words would reclaim almost nothing; the only way to make the
strip meaningfully shorter is to move the *buttons* somewhere else, and everywhere else we could put
them is worse.

**The real find is Overview.** It costs 116px — nearly double every other screen — because its
"Season setup 4/5" chip is too wide to sit next to the title, so it drops onto a line of its own.
That chip already has a picture (its progress ring), and we already have a rule that says a phone
turns words into pictures. Shrink it to the ring and it fits beside the "?" — **Overview loses 56px,
and it is the very first screen a brand-new coach sees.**

## What we recommend

| | What changes | What a coach notices |
| --- | --- | --- |
| **1** | The gap under the title strip shrinks slightly on every screen. | 4px more of their list. ⚠ *The build showed the team bar takes 3px of this back — see the correction above.* |
| **2** | Overview's "Season setup" chip becomes its progress ring on a phone and moves up beside the "?". | The new-coach dashboard gains almost a full strip's worth of screen. Tapping the ring opens the same setup checklist. |
| **3** | *(Separate pass)* The help "?" moves out of the strip and up into the team bar — **on phones and on computers alike**, sitting last in that bar. | **On a computer** it's then always on screen: today it scrolls away with the strip, and a coach deep in a long roster has to scroll back to the top. **On a phone** it's one findable place instead of two. ⚠ *The "8px back" written here at ruling time only happens on screens with no button in their strip — see the correction above.* |

Every screen keeps its name, its icon and its main button exactly where they are today. No screen
behaves differently on a computer or tablet.

⚠ **The "?" moves; the "+" deliberately does not.** Help means the same thing on every screen —
*explain what I'm looking at* — so it reads correctly in a bar that says "U13 Rockets". A create
button doesn't: in that same bar it can't tell a coach whether it adds a player, an event or a
payment. That asymmetry is why one moves and the other stays.

## Where the "?" goes on a computer — and where it doesn't

Asked whether the "?" should move on computers too, or go up beside the account icon in the top bar.

**Both widths, yes.** The original rule for this control is that it lives top-right **at every
width — one findable place**. Moving it on phones only would quietly give it two homes, so it moves
on computers as well and sits **last** in the team bar, after "Next up" and the public-site link.

**Beside the account icon, no — and that boundary is already settled.** The top bar holds only
"leave this place" doors: the logo, your account, your workspaces. The **chat icon was taken out of
it last July** for being part of the work rather than an exit, and for duplicating a door that
already existed at the same width. A "?" there repeats both: it's about the screen you're on, and
**the sidebar already has a Help item**, so we'd have two help doors within a couple of hundred
pixels of each other.

⚠ **A correction to what I told you first.** I sold this as *"help stops scrolling away."* That's
**true on a computer and not on a phone.** The team bar on a computer never shrinks, so the "?"
would be permanently on screen — and it costs nothing there, because the strip's height is set by
the section icon, not the "?". On a phone the team bar collapses to the bare team name as you
scroll and hides its right-hand side, so the "?" would fold away regardless. **We're letting it fold
on phones** rather than reopening a rule you re-confirmed the day before. If you'd rather it survive
the collapse on a phone, that's still open — it's your call, and I'm flagging it rather than
assuming it.

## Withdrawn after your question: the bottom bar naming its section

I proposed having the fifth tab read **Money** instead of **More** while you're inside Money. You
asked whether that would make the More menu hard to find, and whether any app does it well. Looking
properly:

- **No app I can point to does it, and the reference implementation does the opposite.** When an
  iPhone app has more than five tabs, the system creates a "More" tab automatically — and it has
  kept the word "More" and the ••• icon since 2008, putting the section's name in a **title bar at
  the top of the content**. That is the same answer we just reached from the other direction. Google's
  design guidance says the same: bottom-bar labels stay fixed, because the bar works on muscle memory.
- **We already send the signal, twice.** The More tab already lights up when you're inside a More
  section, and the sheet already highlights the row you're on. The rename was adding nothing except
  risk.
- **And it would have put a number on the wrong word.** That tab carries the unread-notifications
  count. Renamed to "Money" while showing it, a coach reads *two things waiting in Money*.

**Your instinct was right and the reason is sharper than mine was:** a coach standing in Money who
wants Tryouts scans the bar for "More" and finds the word for where they already are.

## What we decided *not* to do, and why it matters

The obvious big win was to **merge the page name into the team bar above it** — one bar instead of
two, about 60px back on every screen. We drew it, and we're recommending against it:

- At 390px the **team's name is what gets cut short** to make room. The bar exists to tell a coach
  which team they're in; making the team name the part that gives way defeats it.
- That bar **shrinks to just the team name when you scroll**. The screen's name would then disappear
  and come back — the exact behaviour that was built, measured and rejected on sight in August.
- It would mean **two different header designs**, one for phones and one for computers, and forty
  screens rewired to feed their name up into a bar that doesn't currently know it.

We also looked at moving the help "?" up into the team bar. It's only worth 8px, so it isn't a space
saving — but it *would* mean help is always on screen instead of scrolling away, which is a genuine
improvement worth taking on its own later.

## Trade-offs we're accepting

- **The portal-wide gain is small.** 4px a screen. We're saying so plainly rather than dressing it
  up: the tap-target floor is real and we're not shrinking a button that was only just fixed.
- **Moving the "?" is worth 8px on a phone and nothing at all on a computer.** We're taking it for
  what it actually delivers — one findable place, and a help door that stays on screen on a
  computer — and not counting it as a space saving.
- **It touches every screen's header at once**, so it's a separate pass from the trim, with its own
  walkthrough. It also has to share the corner with the public-site link on teams that have one.
- ⚠ **The narrow-laptop range needs measuring before we call it done.** Between roughly 900 and
  1100px the team bar would carry the team name and role on the left and three things on the right.
  That's the same squeeze that took the "Next up" line off phones two days ago, so it gets measured
  on a real build rather than assumed.

## How to judge it

Open the mockup, leave it on **390 / Warm**, and step through options 0 → 1 → 2. The measurements
redraw themselves beside each screen; option 0 is today. Watch the "Content starts at" column, and
on option 2 watch what happens to "U13 Rockets" when the page name arrives next to it.

## Success criteria

- Overview at 390px starts its content at the same height as Roster and Money.
- No screen loses its name, its main button or its help.
- The "?" is reachable from anywhere on a long screen without scrolling to the top.
- On a team with a public site, both the "?" and the public-site link fit the team bar at 361px.
- Nothing regresses on a computer or tablet.

---

**✅ Ruled 2026-08-25. Recorded in the binding design decisions log**
(`memory/design_decisions.md` — *"The phone title band stays, and its height was never the title —
plus: do not rename the More tab"*).
