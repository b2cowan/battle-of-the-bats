# Club Tier Readiness — Stage 3b mockup session prompt ("Club money: the budget, Budget vs. Actual and the board summary")

> Paste into a fresh session on `dev`. Written 2026-10-05, after 3a was built, walked (§255 ✅, all six parts) and
> released (job 275). **This session draws and settles rulings. It does not build.** Round 1 of the joint sequence:
> the tournament redesign's Stage 4 drawing may run at the same time, and the "one control height" build may still be
> running — read "Working beside the other sessions" before touching the dev server or a shared file.
>
> Plan: `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`. Read:
> - §3 (the exit definition — the money points);
> - **§4C** (C04, C05, C09, C10, C11, C14, C15, and **"The same figure, computed differently"** — Collected has four
>   definitions, Headroom two, a ledger balance three scopes);
> - §5 **D1** (the coach's records are the truth for team money; the club READS them, labelled "held by the team",
>   never summed into the club's position) and **D2** (the club's year — designed in 3c; 3b must not contradict it);
> - **§6 Stage 3** — 3b's list, and **3a's whole record** (what was built, the §255 owner rulings, "Kept for 3b or
>   later", the Overview tab's four figures "C04 stays 3b's"), and **"The 3b shared-payee report, defined"** (D1
>   widened narrowly 2026-10-02 — the report is 3b's; its rows, its two stamps, "Nothing recorded (n)" and its words
>   are already written: draw them, decide the two open choices);
> - "Across every stage — formatting".
>
> Project hub (ONE artifact; republish the SAME path): `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_HUB.html` =
> https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 — 3a's Mockups section is your drawing method and your "before".
> Memory: `project_club_tier_readiness`; the coach-money decisions this stage must stay in step with (below).

## Blocking gate — item ONE is the mockup

1. **Mockups on the hub's Mockups tab, before any code.** Nothing in 3b is built until the owner ratifies the
   drawings. Whole screen, before and after.
2. **Every highlight is clickable** (finding flags with a `data-here` sentence; NEW / RESTYLED / UNCHANGED with
   their own note; a findings dialog jumps to its Full Plan heading).
3. **True size:** phone frames at 390px with the 44px block. **Both themes:** "after" drawn Warm, a Dark copy cloned
   at load. "Before" = today's Budget and Budget vs. Actual tabs as they are now.
4. **The formatting benchmark is checked BEFORE the owner sees a drawing** — put the check on the hub, as 3a did.
5. **Record every ruling on the Decisions tab as it happens.**

## The rulings since 3a was drawn — your drawings follow them (in-repo `memory/design_decisions.md`)

- **The club's book reads exactly like the coach's** (2026-09-30) and **the two Ledgers read the same** (Ledger
  Parity, 2026-10-02). The precedent for this stage: where the club's Budget and Budget vs. Actual mean what the
  coach's mean, they read the same (Ask 2).
- **Accounting is one page with tabs** (2026-09-30; supersedes the plan's "the sidebar gets Budget / BvA /
  Summary"). **The nav lists doors only** (2026-10-01).
- **The coach's Budget vs. Actual opens on Collected · Spent · Off-plan · Cash on hand** (2026-10-01, walked §256;
  Overview keeps Headroom; never a season-end forecast on the scheduled basis).
- **Three shared table parts:** a void row, a band that carries a total, a blank money cell (2026-09-30, table
  standard §3.5).
- **Every admin action button is the portal's white button; a door is olive text; an action that opens a window is
  an outlined button** (2026-10-01). **One control height: 34px on a computer** (2026-10-03). **Export is one button**
  (2026-10-01). **One toolbar in every view, rare tools behind Tools** (2026-10-01). **A record reads first and edits
  whole** (2026-10-01). **A waiting count is the amber pill** (2026-10-01). **A filter's count sits at its row's
  end** (2026-10-05). **No club name above a page title** (2026-10-01).
- Coach budget words the club must not contradict: **the category is the shelf**; **one word, one line**; **a door
  budget is a ceiling** ("behind the figure"); **the budget window starts at opening**.

## Verify before drawing

- **Which C rows are still open** after 3a (C04, C05, C09, C10's planning half, C11, C14's leftovers, C15) — tag each
  open / fixed (commit) / partly on the hub.
- **Each figure's one definition.** For every figure you draw (Allocated, Collected, Outstanding, Headroom, Actual,
  the club's position, held by the teams), write the definition beside it, and say which of today's competing
  definitions it replaces. The build puts each into the club-money arithmetic gate (`check:club-money-arithmetic`,
  already in `verify:changed`), so a figure without a written definition can't be built.
- **The coach's Budget and Budget vs. Actual,** read from the portal's code, to decide Ask 2 from what they do.

## The specimens (draw these; nothing else)

1. **The Budget tab, whole screen, before/after, desktop + phone.** Allocated and Collected columns; many
   allocations per line (C11's one-per-line overwrite gone); the remainder allocatable, and what "the club keeps"
   really means; periods editable; **next year selectable** (C10's planning half — the year's NAME and its year-end
   are 3c's, so draw the selector to D2's shape and tag the rest "3c").
2. **The Budget vs. Actual tab, whole screen, before/after, desktop + phone.** **Actuals by line** (C09, J4-024 —
   entries carry a budget line; the "future update" words go); one Headroom (C05's 50-row cap gone); team health
   with one year rule (C09's "Behind" for a team with nothing due yet).
3. **The board summary, whole screen, desktop + phone** — the club's position, receivables from teams, **team-held
   money labelled and never summed in** (C04, D1), approved requests counted, one export. Where it lives is Ask 1.
4. **A team's money, as the club reads it** (C15, D1): the per-team rollup — allocated · collected · outstanding ·
   requests · cash on hand "held by the team" — and where a treasurer meets it (the board summary, a team's account
   from 3a, or both).
5. **The shared-payee report** (as defined in the plan): for one shared payee, which teams recorded paying it, how
   much, when, and "Nothing recorded (n)" — **labelled as what each team recorded, never proof of payment**. Decide
   the two open choices as asks: which teams are listed, and whether the rows are limited to the budget year.
6. **The coach's side, only where a 3b change reaches it** (for example, an allocation that now names its budget line
   in the coach's club panel). If nothing reaches the coach, say so on the hub instead of drawing a frame.

**Not drawn — listed on the hub as the build's work:** the entry↔budget-line link (a migration); one Headroom and one
Collected in the arithmetic module; the SQL aggregate for the ledger summary (3a kept a paged walk for 3b); the
"same figure, one definition" guard; **the old look's retirement** in every file 3b rebuilds (`npm run
check:old-look:report` lists what is left — the colour debt names `bva` and `budget`). 3c draws the club year (its
name, start month, year-end lock and carry).

## The asks (each with a recommendation; Decisions rows, `open`)

1. **Where the board summary lives.** Recommend: **the Overview tab becomes it** (its four figures are the ones C04
   says are wrong), not a seventh tab.
2. **Budget and Budget vs. Actual parity with the coach's.** Recommend: the same band and words where the meaning is
   the same (Collected · Spent · Off-plan · held cash), and a named difference where the club's budget is different
   (it allocates to teams; a team's money is read, not summed).
3. **The shared-payee report's two open choices** (which teams are listed; limited to the budget year or not).
   Recommend: active teams in the club's current budget year, rows limited to that year, with the year selectable.
4. **Anything the verification finds** that the plan's list misses — say so, don't force-fit.

## Working beside the other sessions

- **The tournament redesign's Stage 4 drawing** may run at the same time, and **the "one control height" build**
  may still be resizing every admin button. **One browser tester at a time:** before any probe, capture or
  `auth-setup`, ask the owner whether another session is measuring (a second runner rotates the shared UAT sessions).
  A "before" captured while the control-height build is in the tree may show 34px or 38px buttons — draw "after" at
  34px (ruled) and say which the "before" shows.
- **A new shared pattern is an ask, not an invention.** The admin's rows and tables have one recipe (`ClubRow*` in
  `RepKit`, extended by tournament Stage 1, and 3a's money table parts). A new variant is drawn as an ask tagged
  "shared — the tournament redesign draws tables too".
- **No code, no help, no gates.** Your files: the hub's Mockups Stage 3b section, its FINDINGS / INTENTS /
  Decisions additions, the plan's Stage 3 section, the PM brief, your TODO line, memory. Read the hub fresh before
  every edit; parse its scripts before every publish; never `force` a refused publish.
- **Git:** private index, explicit pathspecs; commit only when the owner says.

## Hand-off

Product-owner voice. Lead with what a treasurer and a club president see differently (the budget they can plan, the
actuals they can trust, the one page they'd show the board), and what a head coach sees, if anything. Each figure
with its one definition. **Tell the owner to open the hub on a phone.** The asks as numbered questions with a
recommendation each. Offer `/design` for a review pass if the session has budget. Write the 3b build prompts only
after the drawings are ratified; they carry the old-look retirement in their definition of done.

## Do not

- Build anything, or change routes, gates, seeds, help or copy files.
- Draw the club year itself (3c), tournament fees reaching the ledger (Stage 7), families' money (Stage 5 / Families
  P3), venues or permits.
- Sum a team's money into the club's position, or show a team figure the club doesn't read (D1, the shared-payee
  report's limits).
- Change a price, a plan, a gate; write customer copy (draw the placement, tagged `/marketing`).
- Mint a second artifact. The hub is the only one.
