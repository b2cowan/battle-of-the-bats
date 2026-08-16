# PM brief — sponsorships beside fundraisers

**Plan:** [COACH_SPONSORSHIPS_PLAN.md](COACH_SPONSORSHIPS_PLAN.md)
**Status:** approved from mockup 2026-08-15, building · one database change
**Mockup the build follows:** https://claude.ai/code/artifact/47fdb6e1-dab4-4f4e-876c-558e190a9711

## What a coach can do that they couldn't

**Record a sponsor.** Today the only way is to invent a "fundraiser" and log an amount against one
player, leaving the rest of the roster showing dashes forever. Now **＋ New** asks one question first
— is this a fundraiser or a sponsor — and the form follows the answer. A sponsor asks for the
business name, the amount, whether it has actually arrived, optionally which family brought it in,
and how much of it that family keeps.

**See the two apart.** The tab is now **Fundraising** and holds both, each row tagged. A filter
switches between All / Fundraisers / Sponsors, and the summary splits into money raised by the team
selling things versus money from sponsors — which is the question a treasurer actually asks.

**Know what's promised versus banked.** A sponsor is **Pledged** or **Received**. A pledge counts
toward the plan but never counts as money in until it arrives, so the budget stops flattering
itself.

**Stop retyping the split.** Most teams run one standard share all year, so **Team settings → Money**
gains a *default player credit* — it fills in on every new fundraiser and sponsor and can still be
changed on any one of them. Changing it later never touches anything already recorded.

**Enter a family's share whichever way they think about it.** The credit takes dollars *or* a
percentage, with the other shown underneath in plain words ("= $125.00 off Ash Ledger's dues").

## What the list looks like now

The owner's note was that the table had become a wall of text. It has. Each row is now **one line** —
name, kind, three figures, status, and a way in — with the settings, dates, progress count, notes
and tags all moved inside the record. The one piece of text kept is a sponsor's attribution, two
muted words, because that's the fact a sponsor list gets scanned for.

## What it changes elsewhere

| Area | Change |
|---|---|
| Player dues | A sponsor's credit lands on a family's bill exactly as a fundraiser rebate does, named after the sponsor. |
| Season budget | Sponsorship gets its own budget lines, separate from fundraising, and its own row in Budget vs. Actual — so "did our sponsorship hit the number?" has an answer for the first time. |
| Past seasons | Sponsors read as records beside past drives. Nothing extra to build. |
| Exports | The list export gains a kind column so the two total separately in a spreadsheet. |
| Money tags | The same tags Payables uses. No second tag system. |

## Trade-offs made

- **A sponsor has no screen of its own.** It opens the sheet it was created in, prefilled — the way
  an expense does. A single arrival has nothing to drill into, and this removed work rather than
  adding it.
- **The kind can't be changed after entries exist.** A drive's rows are players and a sponsor is one
  arrival; a switch has nothing sensible to do with what's recorded.
- **The credit is stored in dollars.** A percentage is how you typed it. This means correcting a
  sponsor's total later doesn't silently revalue a credit already on a family's bill.
- **No tag filter on this screen** (owner call). Tags still reach exports and reporting; the filter
  can return when a team has thirty rows rather than five.
- **"Expected fundraising" splits in two**, which knowingly revisits a naming decision from August
  that had it covering sponsors and grants.

## How to test it

Money → Fundraising. Create a fundraiser and a sponsor; check the list reads as one line each with
the right chips and the summary splits the two. On a sponsor, set a family and a credit as a
percentage — confirm the dollars shown underneath match, and that the family's dues drop by that
amount. Flip a sponsor from Pledged to Received and confirm it only then counts as money in. Set the
team default in Team settings → Money and confirm both new forms pre-fill from it.

## Success criteria

1. Recording a single sponsor never creates a roster full of empty rows.
2. A treasurer can see fundraising and sponsorship as separate figures, in the tab and in the budget.
3. A pledge is visible but never counted as money in hand.
4. The standard split is typed once per season, not once per record.

---

# Follow-up pass — built 2026-08-15

Seven things sat on top of the feature after it shipped. All seven are now built (owner directed a
single pass, and confirmed the one open question: the tag field was wanted). Nothing here corrects
what shipped.

## What a coach gets

**Two doors instead of one.** The Money overview listed *Fundraisers* once, for a tab that holds two
different things. It now lists **Fundraisers** and **Sponsorships** separately, each opening the tab
already showing just that kind — and the Sponsorships row appears even at zero ("None yet · add
one"), so a coach who has never recorded a sponsor finds out they can.

Because a row is a door, which kind you're looking at is now part of the **address**. Three things
follow from that, all improvements: a filtered list can be bookmarked or sent to someone, **Back**
steps through it, and the **export now matches what's on screen** rather than always dumping the
whole season.

**Money coming in can be tagged.** A fundraiser or sponsor gains the same Tags box an expense has,
drawing on the same list of labels. Until now only spending could be tagged, so "Winter dome" could
tell a coach what it cost and never what it brought in. Tags sit inside the record (not on the list
row, which the row-density ruling keeps clear) and come through on the export.

**The demo shows a sponsor.** A $750 sponsor now sits beside the bottle drive in the coach sandbox
— deliberately club-wide and credited to nobody, because the demo's bills carry two stories the
guided tour narrates by name and a credited sponsor could quietly clear either. One sentence joined
the money tour step.

**One word, one meaning.** The two places still saying "Fundraisers" for the whole tab now say
*Fundraising*, and the help guide follows.

## What it cost us to make safe

Three things exist only so the next defect doesn't ship:

- **Something automated now opens a sponsor.** Nothing ever had — the screen sweep opens a
  *fundraiser*, which draws a different page. A sponsor is now swept, and a new test walks the money
  rather than the markup: a **pledged** sponsor must add nothing to the money-in figure, nothing to
  Budget vs. Actual, and nothing to any family's bill; marking it **received** must move all three;
  marking it back must unwind all three. That is the test that would have caught the review's worst
  finding before a person did.
- **The budget-line guard now proves what it claimed.** It used to check whether a file *mentioned*
  the kind of budget line, which is why it stayed green while five places were wrong. **On its first
  run under the new rule it found two more.**
- **Five places now say which season a record belongs to, not three.** The three we knew about are
  fixed; a new guard found two nobody had listed.

## What's left

Owner QA — **ledger §30**. And the database change (migration 239) has to reach production before
this code does.
