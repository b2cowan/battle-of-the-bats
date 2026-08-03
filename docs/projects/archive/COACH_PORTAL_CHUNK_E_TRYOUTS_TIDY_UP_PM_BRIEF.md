# Coach Portal — Chunk E: Tryouts & Development tidy-up — PM Brief

> **Status:** Proposed — awaiting owner decisions at the mockup round.
> Plan: `COACH_PORTAL_CHUNK_E_TRYOUTS_TIDY_UP_PLAN.md`. Created 2026-07-30.

## What this is

The Tryouts flow is one of the best things in the product — a four-stage walkthrough that runs a
whole selection day from a phone. This chunk fixes the one place it breaks its own promise, protects
the typed work inside it, and tidies the Development hub beside it. It also acts on what a fresh
three-persona walk of the experience found (the head coach, the volunteer with a link, and the
family being told no).

## What changes for a coach

1. **They can finally score their own tryout.** Today the product says "score them" three times but
   the only way a head coach can score is to invite *themselves* as an "evaluator" and open their own
   guest link. After this chunk, Tryout Day has a **Score players** button that opens the same
   field-ready scorecard, signed in as them — no link, nothing to lose, works across a multi-weekend
   tryout, and their scores show on the live board marked "(you)".

2. **Half-built setup work stops vanishing.** The scorecard builder, the session form, and the
   accept-to-roster drawer can all be dismissed with one stray tap today, losing everything typed.
   They now ask first — and the ask names what's at stake ("6 categories and their weights"), never
   a generic "unsaved changes". Clean forms still close silently.

3. **Decision emails become the coach's choice — off by default.** Today, Offer, Waitlist, and
   "Not this season" each email the family the instant they're tapped, and the board never says
   so — it reads like a private sorting tool while actually sending a release note on every pass.
   After this change (owner-directed 2026-07-30), decisions **just get recorded** unless the
   coach flips the "Email families my decisions" switch that sits right above the buttons —
   coaches who deliver news personally are never sending emails they didn't mean to send. With
   the switch off, any offered player still has a one-tap **"Email this offer"** action for
   selectively sending the self-serve Accept/Decline link. With it on, the automatic emails work
   as today, plus a confirm before each pass — a decision can be re-tapped, but an email can't be
   unsent. In both modes: a walk-up with **no email on file** gets a visible "notify by phone"
   chip, a kid who **never checked in** is marked as such (today a no-show looks identical to a
   low scorer), and the **note the family wrote at registration** finally shows up where the
   coach decides. Behind the scenes, emails that do fire become reliably delivered rather than
   best-effort, and the offer's "respond by" date always shows the family the right calendar day.

4. **Volunteer scoring links stop dying awkwardly.** Links last 48 hours and can't be re-shown. If
   a volunteer loses theirs — or the tryout spans two weekends — the coach can now issue a fresh
   link for the *same* helper, keeping all their scores together (today the workaround creates a
   second identity that quietly double-counts that volunteer's opinion in the rankings). The
   scoring page says how long the link lives; if the link dies mid-session the volunteer now sees
   a plain explanation instead of taps that silently stop counting; and turning a link off asks
   the coach first, naming who loses access.

5. **Evaluators stop scrolling past no-shows.** The scorecard now lists checked-in players first,
   with absentees tucked under a muted divider.

6. **The Depth Chart gets its desktop room.** It's a comparison grid capped to the portal's reading
   column today; it takes the same wide-layout treatment Budget vs. Actual got, with the standard
   swipe affordance.

7. **The Development hub stops offering two doors to one question.** Both doors currently call
   themselves "a coverage view". After this, one door asks "What's each player working on?" (the
   working board) and the other "Is everyone getting attention?" (the read-only report). Three
   small honesty fixes ride along: "Give an award" on a team with no players yet says "add players
   first" instead of opening an empty picker; the Awards report gets the same honest "no season
   yet" message its sibling reports already have; and the Test types list gets the portal's
   standard empty state plus one line distinguishing it from the tryout scorecard. The "Practice
   plans — coming later" card goes to an owner decision: the walkthrough found it's honest and
   unclickable (not a dead button), so the call is keep-as-roadmap vs remove.

8. **Access edges get tightened.** The tryout day check-in screen currently renders for any coach
   on the team (the server always refused their changes, so nothing leaked — but the screen
   shouldn't pretend). It now shows the same honest "not turned on for you" message as the hub.

9. **Rolling into next season warns about a live tryout.** Starting the next season today
   silently strands an unfinished tryout (undecided candidates become unreachable). The rollover
   sheet now says so, with the count — a warning, never a block.

## What does NOT change

- The scoring surface itself (praised in review), check-in, blind mode, the live board's ranking
  math, and the four-stage flow all stay as they are.
- The product still **never makes the cut** — ranking and flags stay decision support; the coach
  chooses, always.
- No pricing, gating, or plan change anywhere in this chunk. No database change.

## Why it matters

Tryouts are the front door to the roster — the first real work a new premium coach does, once a
year, under time pressure, on a field. Every defect here lands on day one of their season. The
scoring detour in particular undermines the flow's whole pitch on the day that matters most; and
the un-announced decline email is the kind of surprise that erodes trust in front of families.

## Priority & size

Small chunk, collision-free with the concurrent Overview/chrome work. No migration.

## Success criteria

- A head coach goes from Tryout Day to scoring a candidate in one tap, on a phone, signed in.
- No tryout setup form can lose typed work to a stray tap without asking.
- A coach who never touches the email switch never sends a family an email from the decision
  board — and a coach can state, before tapping, exactly what a family will receive.
- A lost or expired volunteer link is a 30-second fix that keeps the volunteer's scores.
- The two Development doors describe two different questions; no permanently-dead card remains.
- New tryouts probe suite green at 360 and desktop, including the read-only-assistant sweep.
