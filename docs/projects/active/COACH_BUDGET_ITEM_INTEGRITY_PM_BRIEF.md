# PM Brief — budget items: what a word is, and who may take it away

**Status: design ruled by the owner 2026-08-16/17. Not built.**
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
