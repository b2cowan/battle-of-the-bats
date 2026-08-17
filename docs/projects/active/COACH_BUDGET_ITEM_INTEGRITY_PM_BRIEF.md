# PM Brief — budget items: what a word is, and who may take it away

**Status: design ruled by the owner 2026-08-16/17. All phases built on dev 2026-08-17
(Owner QA §44, §45 and §47). Nothing open.**

**Phase 3 is the fold — "Use a shared word instead."** A coach on the Budget Plan ticks any number
of their own words, picks one word their club or FieldLogicHQ already shares, and reads exactly what
is about to happen: how many records move, broken down by kind; that their own words go afterwards;
that no money changes. If the shared word sits under a different heading on the report, it says so
by name before the button. **It is the only place in the product where a word with history behind it
disappears** — everywhere else refuses — and it is safe because the records are carried onto the new
word first, and the old ones only go if all of them made it.

⚠ **One thing was wider than the plan said, and it was the same defect one step over.** Every record
stores its *category* beside its *item*, and the report reads the stored one. A fold that moved only
the item would have left those records filed under their old heading — every dollar present, and the
costs no longer lining up with the plan they belong to. That is now moved too, checked automatically
before and after against Budget vs. Actual, and guarded so a future record type cannot slip past.

**Phase 2 made the words tell you where they came from** — *Standard*, *Club* or *Our own*, on
every list a coach picks from. That is what pays for Phase 1: once publishing stopped deleting other
teams' copies, the same name can appear twice, and without a tag that reads as a bug rather than a
feature. When two words genuinely share a name the search box also names the tier after you pick
one, so a saved record can still be told apart later.

**Phase 1 shut all three doors.** Publishing a team's word to the club now promotes it and deletes
nothing. A club word can no longer be deleted while any team has anything filed against it — the
refusal names what is holding it and points at rename. A team can remove its own words under the
same guard. And a word's side became part of what identifies it, so *Grant* the cheque and *Grant*
the application fee can live side by side. **One thing shipped last week was retracted:** a team's
own word can be renamed or removed, never moved between income and expenses.
**Plan:** [COACH_BUDGET_ITEM_INTEGRITY_PLAN.md](COACH_BUDGET_ITEM_INTEGRITY_PLAN.md)
**Mockup:** https://claude.ai/code/artifact/484b5971-5f79-42a4-9c1e-e5165bfaf15a

## The problem in one sentence

A club can delete a word out from under work a team is relying on, through three different doors, and
when it happens the money stays but its classification disappears from the report with nothing said
to anybody.

## Why it matters now

Every budget word — *Entry fees*, *Diamond permits*, *Grant* — is the name of a row on the season
plan and the thing spending is matched against. When a word is deleted, the records filed under it do
not break; they quietly become unclassified. A coach opens Budget vs. Actual and finds spending they
recorded sitting under **Not itemized**, with no way to know what happened.

Two of the three doors have been open since before this month. The third was created by the money
form release now sitting on dev, so this should not promote without at least the first fix.

## What changes for a club admin

- **Publishing a team's word to everyone stops deleting anything.** It promotes the word and stops
  there. Today it hunts for similarly-named words on other teams and removes them — the behaviour
  behind the worst of the three doors.
- **A shared word can no longer be deleted while teams are using it.** The refusal names the teams
  and how many records each has filed. Renaming is offered instead, because renaming reaches every
  record and loses nothing.

## What changes for a coach

- **The list of words tells you where each came from** — *Standard*, *Club*, or *Our own*. The same
  name can now legitimately appear twice, and you can see which is which.
- **You can remove your own words**, unless something is filed against them. If something is, the
  screen says exactly what is holding it and offers rename instead.
- **You can fold your own words into a shared one when you want to** — several at once. A coach who
  invented *Public grants* and *Company grants* can replace both with the club's *Grants*; the
  records move and the two local words go. Before it happens, the screen says how many records move
  and warns if they will land under a different heading on the report.
- **Nothing is merged behind your back.** A coach who genuinely tracks two kinds of grant separately
  simply does nothing, and keeps both.
- **One thing goes away:** the *move to the other side* button that shipped with the money form last
  week. Categories can belong to income or expenses, so moving a word across can strand it somewhere
  meaningless. It is rare enough that removing the word and adding it properly is the honest fix — so
  a team's own word can be **renamed or removed**, and that is all.

## Impact

- **No pricing or plan-gating change.**
- **One database change** — a word's identity gains which side of the books it is on, so a team may
  keep *Grant* as income and *Grant* as an expense. No data is rewritten.
- **Two of the fixes are small and close live data loss** — worth shipping ahead of the rest.
- **This can be built alongside the money project's next phase** (the register). The two touch
  different screens; the boundary is written into the plan.

## Success criteria

1. No path in the product can delete a budget word that any record still points at.
2. Publishing never removes another team's work.
3. A coach can tell a club word from their own at a glance, on every screen that lists them.
4. Folding words into a shared one states its consequences before it acts, and moves no money.
5. A future kind of money record cannot slip past these guards unnoticed — the build fails instead.
