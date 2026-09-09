# PM brief — Fundraising money gets exactly one way in

**Plan:** `COACH_FUNDRAISING_ONE_WAY_IN_PLAN.md` · **Mockup:** https://claude.ai/code/artifact/8aa1e633-af41-47af-b312-d852aae462a3 · **Rulings:** owner, 2026-09-08 · **Status:** **built on `dev` 2026-09-08** (migration 285, prod-owed) · Owner QA **§157**, walk artifact `f8e843e3` · one confirmation still open (F4)

## The problem, in one sentence

A coach who plans "$800 of merchandise sales" cannot make the merchandise money land on that line —
and the product tells them so in three contradictory ways.

## What a coach meets today

- On the budget plan, the picker says **"From a drive"** under a heading that already says
  FUNDRAISING. The note is describing where the app will make them stand three months later. It is a
  fact about our filing system, not about their money.
- In Record money, **"Other money in" says "Interest, a grant, anything else"** while two rows up
  "A sponsor came through" says "a business or grant gave directly." Follow the first and the form
  refuses you after you've typed everything in — with an amber note that looked like advice.
- The team sold hoodies at a table at the rink and banked $400. **There is no way to enter it.** A
  fundraiser logs money one player at a time, and nobody counted who sold what.
- Budget a bottle drive *and* merchandise as two lines and **both go blank on Budget vs. Actual** —
  all the money piles into a row called "Not itemized." A team is punished for planning carefully.
- Add your own word to the Fundraising shelf and it **reports under "Expected other income."**

Five things, one cause: fundraising money can arrive by two routes, and neither knows about the
budget line the coach planned it against.

## What changes — the rule

**The category decides everything.**

- **Fundraising and Sponsorship money is always recorded on the Fundraising tab.** A fundraiser says
  which Fundraising line it is *raising for* (pre-filled: Fundraising drive). A sponsor says which
  Sponsorship line (pre-filled: Team sponsorship). The coach's own words on those shelves appear in
  the list too.
- **"Other money in" holds only what is typed** — Tournaments, Other Income, anything a coach
  invents. The four fundraising and sponsorship words are simply not in that list any more.
- **A line reports under the shelf it was filed on.** File a word under Fundraising, it reports under
  Expected fundraising — whether a drive fills it in or not.
- **"The whole team" can be the one who raised it.** A drive entry with no player and no family
  share. That is how hoodie-table money gets in.

## What a coach sees and does differently

| Screen | Before | After |
|---|---|---|
| Budget plan, adding a money-in line | "From a drive" beside four words | No note. Four shelves, the coach picks a kind of money. |
| Record money → What happened? | "Other money in — Interest, a grant, anything else" | "Interest, a facility rebate, a plain donation." The sponsor answer says "a grant" plainly; the fundraiser answer says "the whole team, or one player." |
| Record money → Other money in | Fundraising and Sponsorship words listed, refused on Save | Not listed. Nothing to refuse. (If they search "merch," the empty state points them to the right answer above.) |
| A sponsor, new | "Which sponsor?" → "Sponsor" | "Which sponsor or grant?" → "A new sponsor or grant…" → "Sponsor or grant" → **Raising for** (Grant or Team sponsorship). No sponsor-versus-grant switch — this field *is* the difference. |
| A fundraiser, new or edited | Name, description, credit %, dates, tags | **Raising for** as the second field, pre-filled, showing only Fundraising words. |
| Logging drive money | "Which player" — one player, always | "Who raised it" — **The whole team** first, then the players. The board shows a dash where a share would be, and "2 of 14 players · plus 1 team entry." |
| Budget vs. Actual | Two fundraising lines both blank; "Not itemized" holds the money | Every line with its own actual. "Not itemized" only for the honest cases. |

## What a coach gives up

**Fundraising or sponsorship money cannot be recorded without a fundraiser or sponsor record.** Ran a
bake sale and banked $265? Create a fundraiser called "Bake sale" — three fields, pre-filled where
they can be — and log $265 for the whole team. One more step than typing it in. In return: the money
lands on the line they planned, they get a record with a board and a date, and there is exactly one
way for fundraising money to exist, which is what makes every screen above so short.

## Why now

- **Nobody's report moves.** Measured on both databases: no coach or club has invented a money-in
  word yet, and only a handful of money-in budget lines exist at all. The shelf rule and the migration
  change no figure anywhere today. That window closes the first time a coach names their own word.
- The contradiction in the money form is a bug shipping today.
- The coach demo on production **holds the exact state the model removes** — a $480 hoodie margin
  typed against Merchandise sales. It becomes the demo's showing of the new feature (a drive raising
  for Merchandise sales, one whole-team entry), and production's demo is reseeded in the release.

## What it touches beyond the coach's screens

- One migration: the shelf carries its source; a drive or sponsor carries its line. Existing drives
  are linked to the line today's report already places them on, or left as-is with a nudge — never
  blanket-defaulted (that would move one team's money to the wrong row).
- The Budget vs. Actual placement: per record, not per pool.
- The coach demo seed and its narration; four help articles; the data dictionary.

## Priority

High within coach money — it closes the thread the owner opened and removes a live contradiction,
and it is cheapest today. Sits after the Budget Plan ladder (§156) in the QA queue.

## Success criteria (Owner QA §157)

- A drive raising for *Merchandise sales* shows its money on that row, with a second fundraising line
  on the same plan showing its own.
- A whole-team entry of $400 appears on the drive's board with no share, in the season's fundraising
  total, and on Budget vs. Actual; the participation count does not count it as a player.
- "Other money in" lists no Fundraising or Sponsorship word; typing "merch" explains where to go.
- A grant recorded as "a new sponsor or grant" raising for *Grant* reports under Expected sponsorship
  on the Grant row.
- A coach's own word under Fundraising reports under Expected fundraising.
- The budget picker shows no note on any row.
- The coach demo tells the hoodie story through a drive, and `check:demos` is green.

## One confirmation open

Whole-team entries on a drive that **also** has a family-share percentage set: recommended **allowed**,
drawn in the mockup (the team row shows a dash, the facts line counts it separately). The owner has
not said the word — **it is step F4 of the §157 walk**, the only item on that walk that asks for a
ruling rather than a tick. Built allowed; the alternatives are to refuse a team entry above 0%, or to
ask at save time, and both cost a step the current design does not.

## What actually shipped, against this brief

Everything above, plus two wording calls the owner answered before any code was written: the create
panel says **"Will report under Other income."** (the budget-ladder release had taken "Expected" off
every section heading the same day), and **"Who raised it" is a dropdown** with *The whole team* first
and a **Players** group under it — not the open list the mockup drew — because every other identity
question on that form is a dropdown and the house rule says so. The "no family share" fact moved from a
chip on the row to a hint under the field, where a phone can read it.

**Nobody's figures moved, measured rather than assumed.** Typed income sitting on a fundraising or
sponsorship word: exactly one record on dev and the same one on production — the coach demo's $480
hoodie margin — and no club or coach has invented a money-in word anywhere. That record is now the
demo's drive with one whole-team entry. Production's demo is reseeded by hand, so the release runbook
has to reseed `riverdale-ridge` after the deploy.
