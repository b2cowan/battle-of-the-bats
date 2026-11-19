# Build prompt — On-sale pages, session S1: the switch reaches every page

> Paste everything below the line into a new chat. Written 2026-11-18, after the owner ruled every ask as recommended.
> One session. It ships with Club, Club · Association and League Plus still **closed** on production.

---

You are building **S1 of the on-sale pages** for FieldLogicHQ: the first of five sessions that let Club,
Club · Association and League Plus go on sale. S1 is the foundation. After it, every public page about those plans reads
the on-sale switch on every visit, and the handful of lines that are wrong on the live pages today are fixed. A visitor
sees no other change while the plans stay closed.

## Read first

1. `CLAUDE.md`, `AGENCY_RULES.md`, `AGENTS.md` (this is not the Next.js you know: read the guide in
   `node_modules/next/dist/docs/` before changing how a page renders).
2. The plan of record, `docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md`: "What the code does today", "The build" → **S1**,
   "Reviews run", and **"Owner asks" (all ruled 2026-11-18, as recommended)**. Do not re-open a ruled ask.
3. The words, `docs/projects/active/CLUB_ON_SALE_COPY.md`: the table **"Closed words that change (the S1 list)"** and the
   W-lines it names. Section A (the three sentences), W72, W73, W74, W63 (footer only), W64.
4. The drawings, https://claude.ai/artifact/CJ39nz8YunjGxRViXtQ3K7 (source `CLUB_ON_SALE_PAGES_DRAWINGS.html`): the
   **Closed today** state on tabs 2, 4, 5 and 9 (the amber notes are S1's word fixes), and tab 10 for the footer and
   the search titles. The Open state is S3's, not yours.
5. `docs/agents/strategy/PLAN_PRICING_FACTS.md` (the only source for a price, name, band, trial length or gate) and
   `docs/agents/ops/CLUB_GATE_FLIP_RUNBOOK.md` §Step 0.

**The plan's code citations are leads, not evidence.** They were true on 2026-11-18. Open each line before building on
it; a helper agent does the broad reading (the censuses below), you read the lines a decision turns on.

## Part 0 — records the rulings changed (no code; do these first, each through its own agent)

The owner's rulings change the canon the S1 words are read against. Nothing in Part 1 may type a sentence the canon
does not yet hold.

- **`/strategy`** logs, as **Decided** (owner, 2026-11-18, "I agree with all 33 recommendations"), exactly what the plan's
  "Owner asks" records and no more: the three audience bands and the home page as a router (superseding the grid,
  picker-order and nav-order clauses of the 2026-08-08 "live products lead" entry in the design log; its rule that no
  surface hand-writes availability stays); Club leads the pricing page from the flip (Ask 32); League Plus's trial and
  its sentence (Ask 7); the tax inside the trial sentence (Ask 8); the availability line (Ask 9); the over-30 quote path
  (Ask 10); Tournament Plus's trial is said on the page (Ask 31); the selling sections do not hold the flip (Ask 30).
  It then updates the Facts doc: a League Plus trial line, a Tournament Plus trial line, and the truth-up of the lines
  that say shipped things are not built (plan "Found outside this build": ~:116, :117, :137-139, :182, :185). Verify
  each of those against the code and the release record before changing it.
- **`/marketing`** writes the accepted S1 lines into `docs/agents/brand/PRICING_PAGE_COPY.md` and makes the canon
  amendments listed under "Handoffs" in the copy doc that S1 depends on (the trial-sentence exception naming League Plus,
  Club · Association and Tournament Plus; "Start Tournament Plus" replacing "Start Tournament Plus free"). It writes the
  one new sentence the rulings need and nobody has drafted: **Tournament Plus's trial sentence and button**, from the
  same function as Club's with Tournament Plus's own length. It confirms W72's four sports against the sport settings.
- **`/billing`** confirms what a first-time Tournament Plus checkout does on production (the trial length may be
  overridden in the database; this session reads production only as counts and schema, never a person's row).

## Part 1 — the build (plan S1, with the audience review's additions)

Before any code: the **plain-language UX summary** `AGENCY_RULES.md` requires, and a task list.

1. **Prove the problem first.** From a production-style build's route table, show which of `/pricing`, `/for-clubs`,
   `/for-leagues`, `/for-coaches`, `/for-tournament-organizers` are built once at deploy. Do not change rendering on a
   page the table shows is already per-request.
2. **One answer to "is this plan open?"** for every public page, read from the live gate on every request (the existing
   Premium helper is the precedent). The five pages and the home page use it; no page re-spells the gate or types
   availability.
3. **The two in-product readers** stop reading the code's copy of the gate: the house-league cap prompt and the
   onboarding page's first paint.
4. **A dev-only "show as closed"** on the plan-gates toggle, so a walk sees both states on dev without touching dev's
   rows. Dev's rows stay all open (owner ruling 2026-10-30): never put them back.
5. **Premium's code value becomes "live"** and the wrong comment beside it is corrected (Ask 18). The other three plans
   stay closed in code until after the flip.
6. **The closed words that are wrong today** (the copy doc's S1 table, every row): the canon closed sentences, the
   interest line, "bring your team in" on the five pages that carry it (Ask 13), every "early access" on the interest
   form, the Coaches Portal cross-sell on `/for-leagues` reading the Premium gate, `/start/club` and `/start/league`
   closed pages.
7. **The interest form's consent box opens unticked** (Ask 6, `/legal`).
8. **Added by the audience review, all wrong or missing today:**
   - the three `/pricing` answers that describe customers we do not have (W72);
   - "Free right now" off the Premium card on `/for-coaches` (W73);
   - "Start Tournament Plus free" becomes the button and trial sentence `/marketing` wrote in Part 0, on `/pricing` and
     `/for-tournament-organizers` (W73, Ask 31);
   - "8am" becomes "8:00 a.m." on `/for-leagues`, built with `formatTime()` or typed in the one ruled form (W74);
   - the footer's "Built for" column, and "Coaches" under "Get started" renamed "Coaches Portal" (W63, footer only: the
     nav order changes in S3, at the flip);
   - the search titles and descriptions for `/for-leagues`, `/for-clubs` and `/pricing` (W64).

**Not in S1:** any open-state word or card, the three bands, the picker, the home page doors, the nav order, the new
start doors, buying from inside the product. Those are S2, S3, S3b and S4.

## Tests and checks

- Unit tests mock **both** gate states for every page reader (dev cannot show the closed state from its rows).
- A guard that fails the build if a public plan page reads the gate from code or types "Express interest", "Coming
  soon" or "Available now" outside the one helper.
- `npm run verify:changed`; `npm run typecheck` (shared modules change); `npm run check:spelling`.
- `check:layout --changed` on the screens touched, on the dev server. Restart the dev server before handing off (new
  files and shared modules).
- Confirm `NEXT_PUBLIC_PLAN_GATES` is unset in the production build.

## Reviews before handing off

`/review` (shared modules, a rendering change on five public pages); `/legal` on the changed promises (the consent box,
"bring your team in", W72, W73); `/accounting` only if a price or tax line moved; offer `/docs` (the footer and titles
change no product flow, so likely none).

## Rules

- Branch `dev` only. Explicit pathspecs. **No commit and no push without the owner's yes.**
- This plan's own files (`CLUB_ON_SALE_*`, `club-on-sale/`) are uncommitted and belong to this project; the tree also
  holds other sessions' edits in shared files. Stage only your hunks.
- Push back first if the route table, the gate or the canon says the plan is wrong.
- A number on a page comes from the Facts doc; nothing is typed.

## Gate before S2

The build route table shows the five pages reading the gate per request, and with the dev switch set to "show as
closed" every page reads as production does today apart from the word fixes listed above.

## Hand back

1. What a visitor sees differently, in product-owner voice (closed state only), and how to see both states on dev.
2. The route table before and after.
3. A checkable walk (an Artifact, 20 to 50 boxes, one action per step) for the closed-state word fixes and the "show as
   closed" switch, entered in the Owner QA Ledger.
4. Records in the same pass: the plan's S1 stage marked with its commit once the owner commits, the board line
   `club-tier`, the copy doc (which W-lines are now in code), the Claude memory file `project_club_on_sale_pages.md`.
5. The S2 build prompt is written only after S1 commits and walks.
