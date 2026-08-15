# PM brief — Team settings regroup, and the dues settings move into it

**Status:** built on dev 2026-08-14 · awaiting owner QA (§22) and a release · no migration
**Full plan:** `COACH_TEAM_SETTINGS_REGROUP_PLAN.md`

## What changes for a coach

**Player Dues gets shorter and stays just as clear.** The two settings cards at the bottom of the
page — automatic reminder emails, and where fundraising credits land on a family's schedule — are
gone. In their place is one quiet line under the table: *"Reminders on — 30 and 7 days before each
due date · Credits reduce the last payment first · Change in Team settings."* The coach still
knows what the table is obeying; they just aren't asked to re-decide it every week.

**Team settings becomes a page you can read at a glance.** Six groups — Team, Season, Game day,
Money, Sharing, Organization — each closed, each showing what it's currently set to on its own
line. A coach can now see how their team is set up without opening anything. Opening a group
reveals the same shape every time: the setting's name, one line of plain English, the control.

**Following the link lands on the setting, not the page.** "Change in Team settings" opens the
Money group, scrolls to it and flashes it once — the same arrival cue tournament settings uses. A
coach never has to guess which of six shut cards to open. The Depth Chart's "Edit in Settings"
link now behaves the same way.

**Setting up for the first time is unchanged in spirit, better in fact.** Before a coach has set
any dues, Player Dues shows both controls inline along with "Set dues for all players" — because
that's the moment they're deciding how dues will work, and nobody owes anything yet. The moment
the first schedule exists, that block is replaced by the table and the one-line statement.

## Why it matters

A control that is decided once a season and then displayed forever on a weekly working screen is
paying rent it doesn't earn. But deleting it outright would have cost something real: *"credits
reduce the last payment first"* is the explanation for why a family's final installments keep
shrinking while their next bill holds its date. Moving the control while keeping the sentence
gets both.

## Access — the one thing to watch in QA

Team settings used to open for head coaches and for assistants who manage the schedule. **Money
access is a different permission.** A head coach who set an assistant up as the team's treasurer —
money only — would have lost both controls entirely the day they moved.

So the door now also opens for coaches who can edit money, and **the page narrows to match**: that
treasurer sees a settings page containing the Money group and nothing else. No division, no lineup
rules, no organization link. Nobody gains anything except money editors gaining the Money group.
A coach with view-only money access doesn't get the door at all — there's nothing there for them
to change, and Player Dues still tells them the answer.

## Past seasons

Money is one of the doors a coach can open in a finished season; settings is deliberately not,
because nothing in a finished season is configurable. So in a past season the policy line still
states what was in force, without the link — rather than offering a door that isn't there.

## Trade-off we accepted

Closing every group by default costs a first-time coach one click per group. That's the same
bargain tournament admin settings already made, and the value lines on each header pay most of it
back — nothing is hidden, only folded.

## Success criteria

- A coach can read their whole team setup from the closed settings page.
- Player Dues is measurably shorter and still explains its own numbers.
- A team treasurer can still change both dues settings.
- No link anywhere lands on a shut card or a missing page — including from a finished season.

## Help

Updated in the same change: six passages that named the old location, the Team settings guide
(which now describes Money and Sharing), and a new question — *"Where did the dues reminder and
credit settings go?"*
