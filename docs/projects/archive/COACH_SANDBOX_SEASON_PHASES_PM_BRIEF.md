# Coach Sandbox with Season Phases — PM Brief

**Status:** **All five moments BUILT** — Phase 1 committed dev `7a7092ea` (2026-08-04), Phase 2
built 2026-08-05 (dev, uncommitted). Owner QA outstanding for both (ledger §5.4). Plan:
`COACH_SANDBOX_SEASON_PHASES_PLAN.md`.

## What changed in Phase 2 (2026-08-05)

The dock now walks a whole year rather than three points of it. Two teams joined the club:

- **Riverdale Ridge 14U — Off-season.** Lands on Money, budget vs. actual. A season that has been
  *planned* but not played: a budget built line by line, the winter's spending already logged
  against it, a tournament balance still to pay, dues part-collected with one family behind, winter
  Sunday sessions, two written practice plans (one a real three-station rotation you can open and
  run), and a testing session with the two players who missed it left honestly blank.
- **Riverdale Ridge 10U — Season start.** Lands on Schedule. Two weeks in: the whole year already
  on the calendar, three games played, the opener's lineup saved and nothing since — the shape of a
  season set up in one evening in March.

The 12U also gained write-ups on two practices it has already run, so mid-season shows the record a
coach leaves behind rather than only the week ahead.

**Known judgement call for QA:** on a phone the five-chip dock is wider than the screen. It now
scrolls the moment you're standing in into view, so the highlight is never hidden — but you still
see roughly three and a half chips at a time and swipe for the rest. The alternative is a second
row of chips, permanently taller. Worth your eyes.

## What a prospect sees

One tap from the coaches marketing page — no login, no email — and they're inside the real
premium Coaches Portal on a fictional demo team. A slim banner says "Sandbox — nothing here is
saved," and a dock offers five moments of a team's year: **Tryout day, Off-season, Season start,
Mid-season, Season's End.** Each tap drops them into that moment's best screen: live tryout
scoring mid-evaluation; a budget with real expenses and dues underway; a finished schedule; the
mid-season Overview with a game this Saturday; a closed season with its Wrapped recap. They can
wander anywhere, open anything, even edit on screen — and the moment they try to save, the
sandbox says: "Not saved here — start your own team free to keep this."

## Why it matters

The portal's breadth is its pitch, but breadth across a *year* can't be seen in one visit — no
single moment contains tryouts AND practice plans AND budgets AND Season Wrapped. The phase dock
answers the question every evaluating coach actually asks — "what does my October look like?" —
in five taps. And because the sandbox IS the real product (not screenshots, not a replica), it
always shows the current portal with zero drift, and it proves look-and-feel in a way no
marketing page can. It's also a shareable link: a coach who likes it can text it to their
co-coach, which is the cheapest word-of-mouth we can buy.

## Tradeoffs made

- **Look, don't keep.** Visitors share one demo team, so nothing anyone does is saved — edits
  work on screen and vanish. This is what makes no-login safe, and the save moment doubles as
  the signup pitch.
- **Phased delivery.** Launch with three moments (Tryout day, Mid-season, Season's End — the
  most differentiated), add Off-season and Season start next. The machinery is built once.
- **The closed season is real.** Season's End is produced through the genuine season-close
  process, per the archive ruling — slower to build, but the demo can never show a state the
  real product can't reach.
- All players and families are fictional; the demo can never email anyone.

## Bonus value

The five seeded teams become permanent internal QA fixtures and screenshot/marketing sources —
every future feature can be tested against realistic teams at five points of the season
lifecycle.

## How to test (owner QA at launch)

Open the sandbox link in a private browser window (no account): confirm you land in the portal
with the banner and dock; visit all launch moments and confirm each lands on its showcase screen
with alive-looking data; try to save a lineup edit and confirm the nudge (and that nothing
persists on refresh); confirm "Email families" cannot actually send; come back the next day and
confirm the demo still says "today" (dates re-anchored).

## Success criteria

A cold visitor reaches the portal in one tap and can see all launch moments inside two minutes;
nothing a visitor does persists or sends; the demo never shows stale dates; the "start your own"
door is present at every dead end.

---

## Update — the guided tour (Phase 3, built 2026-08-05)

**What a visitor sees that they didn't before.** The demo now offers to walk them through the
season rather than leaving them to wander it. A row in the demo banner reads *"The season,
guided — Walk the year →"*. Press it and seven presses take them from a tryout nobody has decided
yet to a season that has been finished and kept, each one arriving with a sentence saying what
they are looking at.

**Why one continuous tour rather than a tour per moment.** The moments dock already lets anyone
jump around self-serve. A tour per moment would have been the dock with extra buttons, and it
would have turned a season into five feature demos — which is the pitch the whole "moments"
framing exists to avoid. There is also a story that only works in order: the tour shows a coach
the playing-time table, with one player well below the rest, and *then* opens the page that
player's family reads at the end of the season. Those two only land together.

**The rule behind every stop:** the dock drops you at a moment's front door; the tour opens the
drawer behind it. If a visitor would have found it by wandering, it isn't a stop.

**It never starts itself.** The demo promises that nothing moves while you watch, so it does not
move a stranger either. It introduces itself once and waits to be pressed.

**Something that got fixed on the way.** To point at the budget mid-season we needed a budget
worth looking at — and found the mid-season team showing a $9,400 plan with **nothing spent
against it**, eighteen games into its year. Anyone who wandered into Money saw a report saying
nothing had happened all season. That team now has a real ledger, with **one line deliberately
over plan**: a demo where every line comes in under budget quietly teaches a prospect that the
report flatters them.

**On a phone**, the sandbox's honesty promise — *"nothing is saved"* — is now visible from the
first screen. It wasn't before: it was hidden on narrow screens on the assumption that the first
guided sentence would carry it, which was true of the tournament demo and never true here.

**Still open:** collateral for pitching in person (a QR code to the demo), and folding the beats
that didn't make the tour into the dock's own arrival sentences.
