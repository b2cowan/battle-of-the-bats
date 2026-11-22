# Build prompt — On-sale pages, session S3: the pages' open state

> Paste everything below the line into a new chat (`/clear` first). Written 2026-11-20, after every precondition landed:
> S2 committed `d21eade14` and walked (§545, 41 of 41); the Free League removal Stages 1, 2a and 2b committed (2b
> `bd2e7fd58`); the team move's words and the three small fixes committed `731fc586d` (walk §549 owed; walks never gate).
> The plan's order (owner 2026-11-19): removal → team move + small items → **S3** → S3b → S4. One session.
> **Model: Opus** (every public plan page, both gate states, guard tests). Helpers read on Sonnet.
> It ships with Club, Club · Association and League Plus still **closed** on production. On dev every plan is open by
> design (owner ruling 2026-10-30; never put dev's gating rows back); the closed state is seen with "show as closed".

---

You are building **S3 of the on-sale pages** for FieldLogicHQ. S1 made every public page read the on-sale switch; S2
built the doors a visitor lands on when it says open. S3 builds what the **public pages themselves look like once Club,
Club · Association and League Plus are open**: the plans in three audience bands on `/pricing`, three doors on the
picker, the home page's three audience doors and price rows, the nav in the bands' order, and "How the trial works" on
the Leagues and Clubs pages. Closed, every page reads exactly as S1 left it.

## Read first

1. `CLAUDE.md`, `AGENCY_RULES.md`, `AGENTS.md` (this is not the Next.js you know: read the guide in
   `node_modules/next/dist/docs/` before changing how a page renders or caches).
2. The plan of record, `docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md`: **S3** in full, the S2 record ("Built
   2026-11-19") for what the doors now do, "Sequencing against other builds", "Found outside this build", and **"Owner
   asks"** (all ruled; do not re-open one). The asks that are yours: 21 (bands), 22 (picker), 23 and 24 (home, no price on
   a door), 25 (nav), 27 (the trial section), 30 (S3 carries what it rebuilds; S3b does not), 32 (**B: Club leads
   `/pricing`** — the one lime button and the olive edge move from Tournament Plus to Club; never "Most popular"), 33 (the
   last band of the Leagues and Clubs pages has one button once open), 34 (the drawing calls).
3. **The amendments since the asks were ruled — these override the drawing where they differ:**
   - **The coaches band is Premium only** (`BUSINESS_DECISIONS.md` 2026-11-19): no Basic Coaches Portal strip and no
     "Free" price line on `/pricing`. The free portal is reached through tournament registration.
   - **"Coach a team" opens the paid Premium sign-up everywhere** (`d5ad99337`, 2026-11-19, with the tournament-door
     exception). The home page's coach door and role card keep that.
   - **League Plus wears "Coming soon" while closed, as Club does** (copy doc, the 2026-11-19 note under the closed
     words): its closed sentence is `/marketing`'s to write, in this session (Part 0). The tag helper, its tests and the
     strip's group-tag rule (W6) simplify with it.
   - **One place for the status pill** (plan S3, owner 2026-11-19): on the card's first line, on the right when the card
     has a small label on the left. Every card S3 rebuilds follows it, open and closed. Where a drawing breaks the rule,
     correct the drawing (and tell the owner) rather than building it as drawn.
   - **The Founding Season is gone** (removal Stage 2b): no Founding line, date or state survives on any page S3 rebuilds.
4. The drawings, https://claude.ai/artifact/CJ39nz8YunjGxRViXtQ3K7 (source `CLUB_ON_SALE_PAGES_DRAWINGS.html`, version
   3 after `/design`'s fourteen findings): tabs 2 (`/pricing`), 3 (the plan bands), 4 (`/for-clubs`), 5 (`/for-leagues` and
   the home page), 9 (the interest form), 10 (the nav). Click every numbered note. **Build to the drawings** as amended
   above; if a screen can't be built as drawn, stop and draw the difference for the owner.
5. The words, `docs/projects/active/CLUB_ON_SALE_COPY.md`: section M's **W58 to W63, W68 and W75**, and every open-state
   line for `/pricing`, home, `/for-clubs`, `/for-leagues`, `/for-tournament-organizers` and `/for-coaches` (Club line
   only). **Already shipped in S1, keep them, don't rebuild:** W63's footer column, W64 (titles), W72, W73, W74.
   Never type a price, a trial length or a tax word: `docs/agents/strategy/PLAN_PRICING_FACTS.md` is the only source,
   through `lib/plan-config.ts` (it must stay import-free; the demo seed scripts load it with plain Node),
   `lib/plan-trial-line.ts` and the tax words.

**The plan's code citations are leads, not evidence** (true on 2026-11-18; S1, S2, the removal and the team move have
since edited these pages). Open each line before building on it. A helper does the broad reading (every reader of
`RENDERED_PLAN_KEYS`, the picker, the home grid, the interest form's callers, the status pill's four placements); you
read the lines a decision turns on.

## Part 0 — records and checks (before building; each through its own agent)

- **`/marketing`:** League Plus's closed sentence (it wears "Coming soon" like Club). Then confirm the S3 open-state words
  as built match the canon; change nothing it does not change.
- **`/strategy`:** the Facts doc truth-up the plan lists under "Found outside this build" (three shipped things recorded
  as "not built", and the coach-into-Club move line) **before the open words ship**. If another session has already done
  it, say so and move on.
- **`/billing`:** confirm production's Stripe webhook receives the "trial ending" signal
  (`docs/agents/ops/stripe-setup-guide.md`, `scripts/audit-stripe-billing.mjs`), because "How the trial works" promises
  that email (Ask 27: confirmed **before** the section ships). Read-only; if it can't be confirmed from here, the section
  is built and gated off, and the confirmation becomes an owner step on the board — never ship the promise unconfirmed.

## Part 1 — the build (plan S3)

Before any code: the **plain-language UX summary** `AGENCY_RULES.md` requires, and a task list.

1. **The plan cards:** the Club · Association card joins the rendered plans (and the new-plan checklist test); League Plus's
   trial-and-payment sentence; the tax line on the three open prices; buttons to the S2 doors; the trial sentence reads
   the length checkout will use.
2. **`/pricing`, three audience bands** (W58, Ask 21 as amended): Running a tournament · Running a league or a club (each
   under a label that says what a club runs) · Coaching one team (Premium only). Each band reads the gate and shows only
   open plans; band 2 does not render until one of its plans is open; a closed plan stays in the strip. Club leads (Ask
   32). With both open, the League Plus and Club bridge cards under the grid go (W75).
3. **The role picker** (W59): three doors when all three plans are open, each jumping to its band; the four-door picker
   while one is closed.
4. **Home** (W60 to W62): three audience doors, all four roles as full cards, three price rows in place of the grid with
   one tax line in the same container, shown only when all three are open (`/accounting`'s ruling), the hero's two buttons
   with two destinations. **No price on a door** (Ask 24 A). The home page stops rendering the grid when all three are
   open.
5. **The public nav** in the bands' order, and "Start a club" in the Get started menu (W63).
6. **"How the trial works"** (W68) under the plan cards on `/for-clubs` and `/for-leagues`: the numbered row, no trial
   length typed in it, `/legal`'s additions ("first paid plan", "renews until you cancel"). Ships only per Part 0's
   `/billing` check.
7. **Every open-state line** in the copy doc for the six pages switches on the gate, including `/for-clubs`' demo block
   (Ask 11) and the one-button last band (Ask 33).
8. **The interest form follows the gate** (Ask 5): offered only for a closed plan; with all three open it appears on no
   public page; its own closed-state words fixed.
9. **The status pill** in one place on every card S3 touches.

**Not in S3:** the selling sections (S3b: W65 to W67, W69 to W71, the pictures and their A-or-B choice); buying from
inside the product and Plan & billing (S4; Settings in both workspaces is building on Plan & billing now, so leave that
screen alone); any plan turned on in production.

## Tests and checks

- Every page S3 touches renders correctly in **both** states; the S1 guards (`public-plan-availability-guard`,
  `public-plan-pages-both-states`) and the S2 door guard (every open plan's card points at a door that sells it) stay
  green and gain the bands, the picker and the home rows. A partial flip (one of the three open) reads right everywhere.
- `npm run verify:changed`; `npm run typecheck` (shared modules); `npm run check:spelling`.
- `check:layout --changed` on the screens touched, on the dev server, both states (never a whole-product sweep on dev).
  Restart the dev server before handing off if you add files or change a shared module.

## Reviews before handing off

`/legal` on "How the trial works" and any changed promise (before hand-off, not offered after); `/accounting` on the home
price rows' tax line and the trial sentence as built; `/design` on every screen against the drawings and the pill rule;
`/review` at the standard tier (gate logic on every public page). Offer `/simplify` if the bands, picker and home rows
each grow their own copy of the gate reading. `/docs` is not needed unless a help article describes these pages.

## Rules

- Branch `dev` only. Explicit pathspecs. **No commit and no push without the owner's yes.** Re-check the branch before
  every commit; confirm with `git show --stat HEAD` that only your files landed.
- **Other sessions have uncommitted edits in files this session will touch** (on 2026-11-20 they included
  `components/Footer.tsx` and `app/for-coaches/page.tsx`). Run `git diff` on a file before editing it, and stage only
  your hunks.
- Push back first if the code, the gate or the canon says the plan is wrong. A number on a page comes from the Facts doc.
- Production is read only as counts and schema, never a person's row.

## Gate before S3b

On dev with the gate open: `/pricing` shows the three bands with Club leading, the picker's three doors jump to them, no
bridge cards; home shows the three doors, four role cards and three price rows with one tax line; the nav is in band
order with "Start a club" in Get started; "How the trial works" sits under the Leagues and Clubs plan cards (or is gated
off pending the `/billing` confirmation); the interest form appears nowhere. With "show as closed" set, every page reads
as S1 left it, League Plus says "Coming soon" with `/marketing`'s sentence, and each pill sits in its one place.

## Hand back

1. What a visitor sees differently in the open state, in product-owner voice, and how to see both states on dev.
2. A checkable walk (an Artifact, 20 to 50 boxes, one action per step, exact logins where any are needed) covering both
   states, entered in the Owner QA Ledger; owner calls never in the counter.
3. Records in the same pass: the plan's S3 stage (with its commit once the owner commits), the board line `club-tier`, the
   copy doc (which open-state words are now in code), the Claude memory file `project_club_on_sale_pages.md`.
4. The S3b prompt is written only after S3 commits. S3b opens with the owner's side-by-side choice of real screenshots or
   drawn pictures (plan S3b).
