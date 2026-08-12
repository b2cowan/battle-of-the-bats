# PM Brief — Coach Portal Page Headers: One Rule, Forty Screens

**Decided:** 2026-08-11 (owner-approved through four mockup rounds).
**Mockup (binding):** https://claude.ai/code/artifact/1ae95cd8-8bc2-4500-b024-1f6f0bc78f3a
**Plan:** `COACH_PAGE_HEADER_CONSISTENCY_PLAN.md` (same folder).

## What changes for a coach

Today, every screen in a coach's team hub opens differently: some headers repeat the season the
sticky team bar already states two centimetres up (one screen literally says "2026 Season season"),
some repeat the team name, some carry a sentence of feature marketing, and the buttons, help "?",
back links and icons all sit in slightly different places page to page.

After this build, every screen opens the same way:

- **The team bar (top of every page) says who and where you are:** club, team, season, record — and
  now **your role**, as a small tag beside the team name ("Head Coach" / "Assistant Coach"). An
  assistant finally sees at a glance why their portal looks different. If a club names its season
  something real ("Fall Ball 2026"), the bar says that instead of a generic year.
- **The page header just names the room and holds the tools:** a title on the left, the buttons on
  the right, the help "?" always in the top-right corner — the same corner on every page, so help is
  found by muscle memory. Nothing is written under the title anymore.
- **Facts that mattered didn't disappear — they moved to where they're used:** the roster count now
  leads the roster list, "a coverage view, not a ranking" now sits on the coverage board itself,
  and first-visit explanations appear only when a page is empty (the one time they help).
- **On a phone, everything fits:** small buttons keep their icon and drop their words (the one
  green primary action keeps its label), the view switcher on Schedule moves down beside the events
  it switches, and no header spills into a messy stack. Scrolling still collapses the team bar to a
  slim line with just the team name.

Two screens also get honest names: the page the menu calls "Schedule" stops calling itself
"Team Calendar," and the two pairs of screens that shared identical titles ("Development" twice,
"Tryouts" twice) become distinguishable.

## Why it matters

- **Learn once, use everywhere.** A parent-volunteer coach shouldn't re-scan every screen to find
  help or the add button. One rhythm across ~40 screens compounds into the portal feeling smaller
  and calmer than it is.
- **It kills a live bug and the class it came from.** "2026 Season season" shipped because every
  page invents its own header; after this, no page composes season text at all, so the mistake has
  nowhere to live.
- **It stops silent drift.** Two screens had already forked the header styling and one fork broke
  its layout. A single shared header makes the next inconsistency impossible to write, not just
  discouraged.

## Customer impact / risk

- Visual + copy change only: no permissions, data, billing, or archive behavior changes. Archived
  seasons keep their "Complete" marker exactly as today.
- Coaches lose the season text under page titles — deliberate, since the team bar above always
  states it. The information that was genuinely useful is relocated, not removed.
- The demo sandbox and in-app help guides are checked in the same build so tour sentences and
  guides keep matching what's on screen.

## Priority & size

UX-debt / polish, medium priority — no revenue gate. Two build passes on `dev`: core screens +
shared pieces first, then the portal-wide sweep with the punch list (icons, help gaps, back links,
renames). No migration.

## Status — both passes built, 2026-08-11

**Done and waiting on you.** Owner QA is one sitting: `OWNER_QA_LEDGER.md` §10 (Group 3A), desktop +
390px phone, plus one archived season and one assistant-coach account.

Three things worth knowing before you walk it:

1. **Two real bugs fell out that nobody had reported.** The automated screen-rendering check found
   the practice-plan page scrolling sideways on a desktop — a spacing rule written for a slide-over
   panel had been copied into a bar that three full pages also use, so those pages hung 24 pixels
   off the edge of their own content. And the "Season insights" link on Lineups was 21 pixels tall,
   the smallest tap target in the portal. Both fixed. Neither was visible in a screenshot; both
   needed a browser to actually lay the page out.
2. **Three screens changed their names**, so if a coach has muscle memory they'll notice: the
   Insights coverage report is now **"Is everyone getting attention?"** (it used to be called
   "Development", which is also the name of a different screen — the pairing is what we were
   breaking), tryout history is now **"Tryout history"** (it used to be "Tryouts", same as the live
   tryout hub), and Season's End now names itself rather than repeating the team name.
3. **Nothing calculates differently.** No new data is read, no screen became reachable that wasn't
   before, and the rules about what a *finished* season lets a coach open were verified untouched.
   This is genuinely a change to the first inch of every screen.

## Success looks like

- Every team-hub screen: title left, tools right, "?" top-right, nothing under the title —
  desktop and phone.
- Phone headers fit a 390px screen with one right-aligned row of tools; nothing overflows.
- The team bar shows the named season and the viewer's role tag; scrolled phone bar stays bare.
- "2026 Season season" is impossible; no screen repeats the team bar's facts.
- Owner QA: one sitting, desktop + phone, including one archived season and one assistant account.
