# Build prompt — On-sale pages, session S2: the doors (a real Club start and a League Plus start)

> Paste everything below the line into a new chat. Written 2026-11-19, after S1 committed (`4ded7e325`) and the owner
> walked it 43 of 43. One session. The riskiest of the five: it creates accounts and takes money. It ships with Club,
> Club · Association and League Plus still **closed** on production; the doors are built and proved on dev, where every
> plan is open by design (owner ruling 2026-10-30, never put dev's rows back).

---

You are building **S2 of the on-sale pages** for FieldLogicHQ. After S1, every public page reads the on-sale switch on
every visit. S2 builds what a visitor lands on when the switch says **open**: a real way to start a club, and a real way
to start a League Plus organization, with the 90-day trial, the billing address and Stripe's payment page — and the
return trip that does not strand the buyer. Closed, the two start pages stay exactly as S1 left them.

## Read first

1. `CLAUDE.md`, `AGENCY_RULES.md`, `AGENTS.md` (this is not the Next.js you know: read the guide in
   `node_modules/next/dist/docs/` before changing how a page renders or how a route handler redirects).
2. The plan of record, `docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md`: **S2** in full, "What the code does today",
   "Reviews run", and **"Owner asks" (all ruled 2026-11-18, as recommended)**: Asks 14 (no Founding comp on the new
   doors) and 15 (Québec and the US said on step 1) are yours. Do not re-open a ruled ask.
3. The drawings, https://claude.ai/artifact/CJ39nz8YunjGxRViXtQ3K7 (source `CLUB_ON_SALE_PAGES_DRAWINGS.html`): tabs 6
   and 7 (the doors, the plan step, the billing address screen drawn from the shipped `AddressStep`), tab 3 where it
   shows the account and name steps. **Build to the drawings**; if a screen cannot be built as drawn, push back first.
4. The words, `docs/projects/active/CLUB_ON_SALE_COPY.md`: the door lines (the open-state words for `/start`, `/start/club`,
   `/start/league`, the plan step, the "Setting up your club" wait). Use `lib/plan-trial-line.ts` (`planTrialLine`) and
   `lib/workspace-upgrade-preview.ts` for the trial line the plan step shows; never type a trial length, a price or a tax
   word (`docs/agents/strategy/PLAN_PRICING_FACTS.md` is the only source).
5. What S1 left: `lib/plan-config.ts` (`isPlanOpen`, the closed-word helpers; **it must stay import-free**, the demo seed
   scripts load it with plain Node), `lib/plan-trial-line.ts`, the dev "show as closed" cookie, and the guards
   `tests/unit/public-plan-availability-guard.test.ts` and `public-plan-pages-both-states.test.ts`. Ledger §543 and
   `docs/agents/legal/ON_SALE_PAGES_S1_REVIEW.md` for what S1's reviews found.

**The plan's code citations are leads, not evidence.** They were true on 2026-11-18. Open each line before building on
it; a helper agent does the broad reading (censuses of every reader of the start doors and of `LEAGUE_STARTER_BETA`),
you read the lines a decision turns on.

## Owner rulings carried in from the S1 walk (2026-11-19)

- **Ruled (do it in this session, first, it is words only):** the interest line when the updates box is unticked.
  Replace "Tell us you're interested and we'll let you know when it opens." (`GATED_PLAN_INTEREST_LINE`,
  `lib/plan-config.ts`, read on ~12 pages) and the interest window's intro line, which makes the same promise, with
  `/legal`'s sentence: **"Tell us you're interested. Tick the box on the form if you'd like an email when it opens."**
  Also `app/pricing/page.tsx:420` ("and we'll let you know when it opens"). One spelling everywhere; the S1 guards that
  pin the old sentence move with it. Record it as ruled in the plan's Owner asks.
- **Proposed, NOT ruled — do not build until the owner answers; ask at the start of the session if still open:**
  - *A team move ends the coach's own plan at once with no refund* (`lib/team-ownership-transfer.ts:534-545`; Terms
    2026-11-17 §8 promises a cancelled plan runs to the end of the paid period). Proposal: (a) say it where the coach says
    yes to the move — their own plan ends today and the unused part of what they paid is not refunded, with the date it
    would have run to; (b) one Terms sentence carving the move out (`/legal` drafts it; Terms are published, so this is a
    Terms-version question for `/legal`, not a quiet edit); (c) keep "you won't be charged for your own Coaches Portal
    again" (true) and gate the "everything comes with it" lines (coach help, the Plan & billing Club card, settings) on
    Club being open, since no club can receive a team yet; (d) a prorated refund is a separate, later decision.
  - *The tax words inside Tournament Plus's trial sentence* (Ask 8 named three plans; S1 put the tax in all four because
    it is one sentence from one function and the tax line already sits under Tournament Plus's price). Proposal: keep.
    Nothing to build either way until the owner says so.

## Part 0 — records (no code; each through its own agent, before building)

- **`/billing`:** confirm, from the code and from production counts/schema only (never a person's row), the trial rule for
  a brand-new org (`hadSubscriptionBefore`, create-checkout ~:412), what `previewClubCheckout` returns for an org with no
  Stripe customer, and that Club and League Plus checkout can run with the gate open on dev (Stripe test mode).
- **`/legal`:** the plan step's promises (trial, first charge, tax, "you can cancel", who the Terms tick covers), the
  Québec/US wording on step 1, and the forfeited-remainder sentence once the owner rules it. Terms acceptance:
  `LEGAL_PAGES_PUBLISHED` is off on dev; with it off, `requireAcceptance` passes. Production must not sell without the
  tick, so make the door **fail visibly** (a build/guard check or a flip-runbook line, the plan names which) rather than
  trust the flag.
- **`/accounting`:** run before handing off. The doors change what FieldLogicHQ charges and collects (new checkout entry
  points, tax at the first charge, the billing address that decides the tax).

## Part 1 — the build (plan S2)

Before any code: the **plain-language UX summary** `AGENCY_RULES.md` requires, and a task list.

1. **A `club` start door** (and `league` reused for League Plus: no fourth door) in `lib/start-door.ts`. The pick rides on
   the account like the Premium door's; the org is created on `tournament` with **no Founding comp** (Ask 14); Home shows
   the waiting-workspace card ("Name your club").
2. **`/start/club`, open:** step 1 account (`StartDoorForm`), step 2 the club's name, step 3 the plan step with **Club**
   and **Club · Association** side by side (preselected from the pricing card's pick), then the billing address (the
   shipped `app/[orgSlug]/admin/onboarding/AddressStep.tsx`, the second half of step 3 by the 2026-11-04 ruling, so the
   step line stays three labels with Plan current), then Stripe's page through the existing checkout. Closed: S1's page,
   untouched.
3. **`/start/league`, open:** the same, one card. The free League starter path (`LEAGUE_STARTER_BETA`) is untouched; the
   readers that would hide the League Plus start (`lib/start-menu.ts`, `start/page.tsx`,
   `app/api/consumer/home/route.ts`) read the plan gate for it, and the flag keeps governing only the free floor. With the
   flag off and League Plus closed it stays the interest form.
4. **The return trip (trap A, verified in the plan):** Stripe returns before the webhook writes `plan_id`, and the org
   still reads `tournament`, so today's return opens "New tournament" for a club buyer. The doors return to a **"Setting
   up your club" wait** that polls the plan (the Premium-in-place `ClubUpgradeSetup` + `club-upgrade-status` pattern, with
   a status read that works for a plain org) and then lands in the club setup kit.
5. **Abandoned checkout:** the org stays free Tournament; the intended plan is kept on the org's onboarding state
   (`startup_tasks`, not `user_metadata.start`, which only steers screens), so a resume shows the Club / League Plus plan
   step instead of a Tournament-only one.
6. **The true trial before checkout (trap B):** the plan step shows the server's trial-or-not line
   (`previewClubCheckout`), not the code value.
7. **Québec and the US before the org exists (trap C, Ask 15):** said on step 1, so a held address is not refused only
   after the org is made.
8. **Who the doors refuse (trap D):** a signed-in owner of any real org goes to that org's Plan & billing; a signed-in
   Coaches Portal coach goes to the in-place "Start your club" (`userBelongsToOtherRealOrg` exempts a portal, so the door
   would otherwise make a second org and strand the team).
9. **`/start` chooser:** Club and League cards appear when their plan is open.
10. **Pricing buttons go to the doors when open.** The G6 guard (`first-look-stage3.test.ts`) is rewritten to "every open
    org plan's card points at a door that sells it", reading the live gate, not the code value.
11. **The interest-line words** (the ruling above), if not already done.

**Not in S2:** the three audience bands, the picker, the home doors, the nav order (S3); the selling sections (S3b);
buying from inside the product and the Club row on Plan & billing (S4); any plan turned on in production; the Club
test suite.

## Tests and checks

- Unit tests mock **both** gate states for every reader. A door test for each trap (A to D) and for the abandoned-checkout
  resume. The money path (create-checkout for a brand-new org on a club door, the webhook, the wait) is exercised on dev
  with Stripe **test mode**; any throwaway org or Stripe test-clock customer is torn down afterwards (list calls hide
  test-clock objects: prove "none left" with search or per-customer lists).
- `npm run verify:changed`; `npm run typecheck` (shared modules); `npm run check:spelling`; `npm run check:dictionary`
  if a column or a stored field's meaning changes.
- `check:layout --changed` on the screens touched, on the dev server (never a whole-product sweep on dev). New files and
  shared modules change: **restart the dev server before handing off**.
- Never run a seed while a sweep or a walk is live (a seed's password reset signs everyone out).

## Reviews before handing off

`/review` at the high-risk tier (money, accounts, terms acceptance); `/legal` and `/accounting` as in Part 0, **before**
hand-off, not offered after; `/design` on the new screens against the drawings; offer `/docs` (a start flow changed: the
help for starting a club or a league, if any, must read as the product does). Offer `/simplify` if the doors duplicate the
Premium door's machinery.

## Rules

- Branch `dev` only. Explicit pathspecs. **No commit and no push without the owner's yes.** Re-check the branch before
  every commit; confirm with `git show --stat HEAD` that only your files landed.
- This plan's own files (`CLUB_ON_SALE_*`, `club-on-sale/`) are uncommitted and belong to this project; the tree also
  holds other sessions' edits in shared files. Stage only your hunks.
- Push back first if the code, the gate or the canon says the plan is wrong. A number on a page comes from the Facts doc.
- Production is read only as counts and schema, never a person's row.

## Gate before S3

On dev, with the gate open: a visitor with no account can start a club (both plans) and a League Plus organization to the
end of Stripe's test checkout, return to the wait, and land in the club setup kit (or the league's) with the right plan
and the trial dates a Stripe test customer shows; an abandoned checkout resumes at the right plan step; a signed-in owner
and a signed-in coach are sent where trap D says; with "show as closed" set, both start pages read as S1 left them.

## Hand back

1. What a visitor sees and does differently (open state), in product-owner voice, and how to see both states on dev.
2. A checkable walk (an Artifact, 20 to 50 boxes, one action per step) for the doors, entered in the Owner QA Ledger;
   owner calls never in the counter.
3. Records in the same pass: the plan's S2 stage with its commit once the owner commits, the board line `club-tier`, the
   copy doc (which door words are now in code), the Claude memory file `project_club_on_sale_pages.md`.
4. The S3 build prompt is written only after S2 commits and walks.
