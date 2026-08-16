# Coach Money — money coming IN gets a vocabulary, and a hosted tournament fills it in

**Status:** planned 2026-08-16 · **not built** · awaiting owner approval
**Raised by:** the owner, 2026-08-16, from a real club budget — *"a coach can run a tournament on
our platform, so do we have items that align with funds they may get from that (a new money in
category perhaps)?"*
**Sibling:** [COACH_BUDGET_ITEM_ALIGNMENT_PLAN.md](COACH_BUDGET_ITEM_ALIGNMENT_PLAN.md) — this is
the same argument, applied to the other side of the ledger.
**Migration:** one (a revenue taxonomy + a link from a hosted tournament).

---

## 1. The gap, in one sentence

**Money going out has a shared vocabulary. Money coming in has none.**

A coach types a description on an expected-fundraising line and that description is the row. It is
exactly the state costs were in before 2026-08-15: nothing downstream can match on it, so "did we
raise what we expected?" is answered by a human reading two lists side by side.

## 2. What a real budget actually carries

From the club budget the owner shared (2026-08-16), the money-in side is four distinct things:

| What arrives | How it arrives today |
|---|---|
| Fundraising drives | an expected-fundraising line, named by hand |
| **Concession revenue from a tournament they ran** | nowhere — typed into a free-text line, or omitted |
| Sponsorship / grants | an expected-sponsorship line (mig 237) |
| Player-raised amounts | fundraiser entries, per player |

That budget carries **two separate concession lines** for two tournaments the club hosted. It is
not an edge case; hosting is how these clubs fund their season.

## 3. The proposal

### 3.1 A revenue taxonomy, separate from the spending one

⚠ **NOT the cost taxonomy reused.** The owner's ruling of 2026-08-13 stands and is the reason this
is a separate list: *a spending taxonomy has nothing sensible to say about a bottle drive.* That was
an argument against reusing the cost words, never against having words at all.

A small, flat list — no categories, because money-in has one level of structure and inventing two
would be ceremony:

- Fundraising drive
- Tournament we hosted
- Concessions
- Sponsorship
- Grant
- Apparel & merchandise sales
- Gate / admission
- Other

Same three-tier ownership as the cost items (platform / club-published / team) and the same
sport-awareness rail (mig 241), both for free — they are the same shape.

### 3.2 A hosted tournament fills its own line in

**This is the part nobody else can do.** A coach running a tournament on this platform generates
entry fees *we already hold*: the participating teams registered here, and their payments are in
our own tables. Today a coach re-types that number into their budget as a guess and reconciles it
by eye.

Instead: a money-in line of kind *Tournament we hosted* may point at **the tournament itself**, and
its ACTUAL is read from what that tournament actually took. Budget vs. Actual then answers "did
hosting pay for the season?" with no data entry at all.

⚠ **The plan side stays typed.** A coach budgets what they *expect* the tournament to bring in
before it runs; only the actual is derived. Deriving both would make the comparison meaningless.

### 3.3 What the report gains

Money-in rows group by their kind, exactly as costs group by item — so expected-vs-raised reads
line for line instead of as two totals. A club hosting two tournaments sees them separately.

## 4. What this does NOT change

- **Player dues stay out of it.** Dues are their own system with their own screens, and folding
  them into a revenue taxonomy would put one dollar in two places.
- **Fundraiser and sponsor records are unchanged.** This adds a word to the budget LINE; the
  fundraiser and sponsor records that report actuals against it keep their own shapes.
- ⚠ **Rebates still credit the player who raised them**, and the team's expected figure stays the
  team's SHARE (owner ruling 2026-08-12). Nothing here re-opens that.

## 5. Sequencing and risk

Independent of everything currently in flight. The taxonomy (§3.1) is small and could ship alone;
the hosted-tournament link (§3.2) is the valuable half and the one worth building carefully — it
crosses from the coaches portal into tournament data, which is a boundary this codebase has kept
clean and should keep clean.

**The one real risk is double-counting.** A coach who both budgets "Tournament we hosted" AND
records a fundraiser for the same money would see it twice. The build has to decide whether a
derived actual suppresses a manual one, and say so on screen.

## 6. Open questions for the owner

1. **Does a hosted tournament's revenue mean gross entry fees, or net of what the club paid out**
   (umpires, diamond hire, prizes)? A treasurer usually wants net, and the platform only knows
   gross.
2. **Whose money is it?** A tournament is run by the ORG; the budget is the TEAM's. If one team
   hosts to fund its own season, that is clear — if the club hosts and splits proceeds, it is not.
3. **Should concessions be tracked at all, or is that below the line** most clubs want in software?
