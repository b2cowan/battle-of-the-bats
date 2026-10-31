# Plan & billing · Stage 4b · "A Premium coach becomes a club, in place" · the DRAWINGS, FIRST PASS (prompt for Codex)

> Written 2026-10-30 for a Codex session. **This is a first pass. A second session on a stronger model (Claude) will read
> what you draw, find the gaps and the weak reasoning, run it through the design review, and publish the owner's
> version.** Write so that session can check your work fast: tag every claim with how you know it (§5), and end by listing
> what you are least sure of. A first pass that is honest about its holes is worth more than a polished one that hides them.
> **This session draws. It changes no code, no schema, no settings, runs no migration and calls no external service.**
> Another agent shares this working copy: do not stage, commit, or touch any file except the one you create (§4).

## 1 · What the owner asked for (his words and rulings, 2026-10-30; you do not reopen them)

**The story.** A coach who runs a club starts on the standalone Premium Coaches Portal, then decides to buy the whole
product for the club. They go from *standalone coach* to *club owner who is also head coach of their existing team*, and
that team is now owned by the club. **The coach's own workspace BECOMES the club, in place.** The team does not move, is
not copied and is not re-parented; the coach keeps every role they have. (Owner: "I don't think we need to change the
state of the coaches one team portal.")

**The other door stays as it is.** The Premium coach's Change plan slot already holds **"Part of a club?"** (joining
SOMEONE ELSE'S club; their team moves into that club's workspace). That door is unchanged. Your drawing must make the two
doors read as clearly different choices: *start my own club* vs *join a club that already exists*.

**The money rules (ratified, `docs/agents/strategy/BUSINESS_DECISIONS.md`, top entry, and the Facts doc bullet "Premium
coach → Club IN PLACE"):**
1. The price is **Club's ordinary price**. No discount, no middle plan. Never type a real price (§3): label any figure "example".
2. **A paying Premium coach:** the one subscription changes now. They see a **preview before confirming** (what is charged
   today, which includes credit for the unused Premium time, and the new price from renewal). Their billing interval
   (monthly or yearly) is **kept**; they cannot change it in this move. **No second trial.**
3. **A coach on free time** (Founding Season free time, or free time our staff gave the portal) has no subscription, so this
   is a **start-paying** step: an ordinary Club checkout with **Club's 90-day trial and a card collected**. The Premium free
   days **end at the upgrade and do not carry** (the coach must be told this before they confirm). The Founding Season
   offer never reaches a Club.
4. This is **not the bridge**: the bridge's "you won't be charged again, never mention a refund" wording governs the
   bridge only. This move shows the coach what is charged today.
5. Not ruled, so **do not draw**: a way back down from Club to Premium; Club · Association (reached afterwards by the
   existing band move). If your drawing needs either, put it in the Asks tab as a question.

**Other rulings that bind this (cite, don't argue):** Plan & billing is **the OWNER's alone** (a member who types the URL
sees the locked card; absent beats disabled everywhere else). The real move **ships when Club opens for sale**; until then
the Club rows on every plan read "Contact us to move" (plan §9 ruling 7). Draw the real flow, plus the one pre-sale state of the
row. Club has **no Founding offer**.

**Who reads the result.** The owner is a product owner, not an engineer. Your top section is written for him (§6).

## 2 · Read these first, in this order (every file name is a LEAD, not a fact: open it and check)

1. `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`, then **`docs/projects/active/PLAN_AND_BILLING_CODEX_RULES.md`** (the standing
   design, words and access rules for this whole project; its §2 binds you).
2. `docs/projects/active/PLAN_AND_BILLING_ONE_EXPERIENCE_PLAN.md`: §5 "Stage 4b", §6 question B, §9 rulings 7 and 8, and
   the Stage 2 to Stage 4 sections for what already shipped.
3. `docs/agents/strategy/PLAN_PRICING_FACTS.md` (plan names, bands, the new bullet) and the top two entries of
   `docs/agents/strategy/BUSINESS_DECISIONS.md`.
4. **The layout to copy:** `docs/projects/active/PLAN_AND_BILLING_STAGE3_DOORS_DRAWINGS.html` (the owner's accepted drawings
   frame) and, for the Plan & billing body itself, `PLAN_AND_BILLING_STAGE_A_DRAWINGS.html`. Open them and match their frame
   (§4), tokens and caption tags. Do not copy their content.
5. **The screens as shipped** (draw FROM these, never from a look-alike): `app/[orgSlug]/coaches/billing/page.tsx` (the
   coach host), `components/billing/BillingBody.tsx` (the shared body and its Change plan table),
   `components/billing/PlanMoveDialog.tsx` (the shipped move window with the proration preview; this is the pattern for the
   paying coach), `components/billing/FreeTimeBand.tsx` (how free time reads), `components/shared/KitDialog.tsx` (every
   window), `lib/plan-billing-words.ts` (the words, including the "Part of a club?" door and the Club trial line), and the
   registry that holds each plan's profile (follow the imports from `BillingBody`).
6. **The portal's chrome**, because the coach lands in a different one after upgrading: the coaches rail and phone More sheet
   (`components/coaches/`, `docs/agents/design/NAV_STANDARD.md`), and the Admin shell a club owner sees. Stage 3 REMOVED the
   Admin door for a standalone coach; an upgraded coach is a club owner and gets it back. Find out how that door appears
   and draw the before and after of the rail.
7. `docs/agents/design/TABLE_AND_LIST_STANDARD.md`, `COACH_SURFACE_DESIGN_ADDENDUM.md`, and the Stage 4 "Covered by {Club}"
   card in Team settings (the owner of the paying club does NOT see it; check what the upgraded coach sees on their team).

## 3 · Rules that bite (from the project rules and the owner's standing preferences)

- **Never type a plan price, plan name or gate as fresh copy.** Plan names and prices come from the plan config and the Facts
  doc; if they disagree anywhere you read, LIST it, don't pick one. Any figure you draw is labelled **"example"**. Prices read
  in the CAD monthly form the shipped screens use.
- **Draw a control from the component that ships**, name the component in the caption, and say so when the shipped component
  does not fit. If a drawing is silent on something, say what you reused (hand-off note), never invent a control.
- **Portal formatting is the benchmark** (sentence-case headings, 8px cards without shadow, one lime per screen, white callout
  with a coloured edge instead of tinted panels). Money figures read as **one connected band**, never floating tiles.
- **A window's foot is a sentence on the LEFT, buttons on the RIGHT; the close × is the plain glyph; the primary button names
  what it does** ("Start my club", never "OK"). A phone's secondary action is its symbol alone at a 44px tap floor.
- **Absent beats disabled.** A control a person cannot use is removed. **Required fields are marked; optional ones are never tagged.**
- **Words:** one spelling everywhere (`installment`, the clock is "8:00 a.m.", dates read like the shipped screens), sport-neutral,
  possessives through the one helper (a name ending in s takes the bare apostrophe). Coaches say "season". Customers read free time only as
  **"Free through {day}"**. Mark every sentence you write **"draft words"**: customer copy is finished later by `/marketing`.
- **Draw DECISIONS, not every control.** A handful of specimens, plus **one WHOLE screen, BEFORE and AFTER** (the Premium coach's
  Plan & billing page, then the same page once the Club row exists), so the owner can judge the cumulative effect.
- **True size:** the computer frame is 1280px wide and the phone frame 390px, fixed frames that do not reflow.

## 4 · The assignment: ONE HTML page

Create exactly one file: `docs/projects/active/PLAN_AND_BILLING_STAGE4B_PREMIUM_TO_CLUB_DRAWINGS.html`. A plain HTML page
(not a design canvas, not an artifact; Claude publishes it later), in the owner's house layout, copied from the Stage 3 doors file:

- **A sticky row of numbered tabs** across the top; one section visible at a time; the last tab is **"Asks"**.
- **A `View` row under the tabs with ONE white track holding `Everything` and `Show only what differs`** (the shipped view-switch look),
  only on tabs that compare things. Leave it off a tab with nothing to compare.
- **Numbered markers on the specimens that open their explanation when clicked** (hover alone is not enough); a written
  explanation beside each specimen; every caption tagged **NEW / RESTYLED / UNCHANGED**.
- The warm look, light and dark. Rust marks what is new or moved. A different ground behind the product frames so they read as specimens.

**The tabs (name each for the decision it holds):**

1. **The Premium coach's page, before and after.** The whole Plan & billing page for a standalone Premium coach, then the same
   page with the Club row added. Where does "Start your own club" sit relative to "Part of a club?"; how does the Change plan table
   (and the phone's cards) tell the two doors apart in a glance; the pre-sale state of the Club row ("Contact us to move").
2. **Name your club.** The step that asks for the club's name and web address (the workspace is named after the team today; the
   club needs its own). What is prefilled, what is required, how a taken address reads, and what the coach is told they are about
   to become (club owner; the team stays; they stay head coach).
3. **A paying coach: the preview.** The shipped move window's pattern for this move: charged today (with the credit for unused
   Premium time), the new price from renewal, the interval that is kept, no second trial. Where the coach confirms.
4. **A free-time coach: start paying.** The same moment for a coach with no subscription: free days end (told BEFORE confirming),
   the 90-day trial sentence, the card step, what the first charge date is. Draw both flavours (Founding free time, staff-given free time) if they read differently.
5. **After paying: the landing.** What the coach sees on return from payment (the upgrade finishes behind the scenes, so draw an honest
   "finishing setting up your club" state, and what it says if it takes long or fails), then the first screen as a club owner:
   an empty club, what to set up first, and where their team is. Draw the **rail before and after** (the Admin door returns).
   Check the team's own Team settings: what does the upgraded coach see where the "Covered by {Club}" card would be?
6. **The same on a phone (390px).** The change-plan cards, the two windows as the phone presents windows, and the landing.
7. **States.** A compact board: a non-owner who types the URL; payment fails or the card is declined; the Stripe return with a
   cancel; leaving and coming back mid-way; a coach whose own tournament is draft or active (check the code: is this a block for an in-place
   upgrade? the bridge refuses it); a coach on the last 14 days of free time. Say which you walked and which you could not.
8. **Asks.** The numbered questions only the owner can answer, each with your recommendation and the alternative.

## 5 · Evidence tags and honesty

Tag every statement about the product **[saw in code]** (name the file), **[from the plan]** (name the section) or **[my guess]**.
Where the shipped screen and the plan disagree, say which you drew from and why. If you could not tell how a shipped
thing behaves, say so rather than drawing it confidently. Do not describe how the upgrade works underneath; this pass is
about what the person sees and does. Where a screen depends on something that does not exist yet (the finishing state,
the preview for a move from Premium), mark it **"depends on the build"**.

## 6 · The hand-back

1. **The page's first tab or a note at the very top, written for the owner, under 200 words:** what the coach sees and does,
   start to finish, in plain words; no file names, no component names.
2. **A "least sure of" list on the Asks tab:** the five places most likely to be wrong, in your order of worry.
3. **Anything you noticed in the shipped screens that looks like a bug or a standing-rule breach**, listed and NOT fixed.
4. Do not stage or commit. Say in your final message the one file you wrote, and that you changed nothing else.
