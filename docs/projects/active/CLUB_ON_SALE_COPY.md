# The on-sale pages: words for Club, Club · Association and League Plus (draft for owner ruling)

**Status:** ⚖ **ruled as recommended by the owner, 2026-11-18** ("I agree with all 33 recommendations": every plan ask,
so every line here stands as written, with the recommended option wherever an ask offered two). Drafted by `/marketing`
the same day. Nothing here is in code or in the copy canon yet: `/marketing` writes the accepted lines into
`PRICING_PAGE_COPY.md` as Part 0 of the S1 build (`CLUB_ON_SALE_S1_BUILD_PROMPT.md`).
W1 to W57 are the on-sale words; **W58 to W75 (section M) were added the same day by the audience review** and replace
W9 and W41's roadmap row for the open state (each is marked where it stands).
**Belongs to:** `CLUB_ON_SALE_PAGES_PLAN.md` (S1 to S3). **Words only:** no code, no canon edits. Once the owner accepts a
line, `/marketing` (main session) writes it into `docs/agents/brand/PRICING_PAGE_COPY.md`; the build applies it.
**Read against:** `PLAN_PRICING_FACTS.md` (prices, names, bands, trial lengths: this file types none), `BUSINESS_DECISIONS.md`
2026-11-18 (open launch, no club demo, no "we set up Club with you" or "talk to us" framing after the flip) and 2026-09-25
(the trial sentence is one sentence; Club · Association is self-serve), `CLUB_GATE_FLIP_RUNBOOK.md` Step 0 and its drift table.

## How to read this file

Every line has an id (W1, W2, ...). Each says what a visitor reads **today while the switch is closed**, what they read
**when that plan's switch is open**, and whether the **closed words also change**.

- **Closed also changes = No:** the closed words stay exactly as they are today.
- **Closed also changes = Yes:** today's closed words break the copy canon (or the Facts doc), so they change too. These
  are the lines S1 can carry (plan Ask 8). They are collected in "Closed words that change" near the end.
- Each plan reads **its own** switch. Where a page names two plans (the strip, a FAQ), the open words for a plan appear
  only when that plan is open and its closed words only while it is closed. Nothing here assumes all three flip together
  on the page; the build must not either.

**Placeholders** (the page fills each from config or helpers; never typed as a number or sentence):

| Placeholder | Is |
|---|---|
| `{League Plus price}`, `{Club price}`, `{Club · Association price}` | the monthly price from `PLAN_CONFIG`, in the page's own price style; `{... annual}` is the yearly price |
| `{plusTax}` | `BILLING_TAX_WORDS.plusTax`, "plus applicable taxes", used verbatim |
| `{clubTrialLine}` | `clubTrialLine()` with the length checkout will use for Club and Club · Association |
| `{leagueTrialLine}` | the same sentence with League Plus's own trial length (new, see W1) |
| `{closedPlansLine}` | `closedProgramPlansSentence(gating)`: "Club is coming soon, and League Plus is built but not open for sign-up." (or whichever half is still true) |
| `{interestLine}` | `GATED_PLAN_INTEREST_LINE`: "Tell us you're interested. Tick the box on the form if you'd like an email when it opens." (owner ruling 2026-11-19, `/legal`'s sentence; it replaced "…and we'll let you know when it opens.", which promised an email the unticked box does not send. Every quotation of the old sentence below reads as this one.) |
| `{support email}` | `FIELDLOGICHQ_CONTACT_EMAIL` |

---

## A. The three sentences everything else hangs on

**The League Plus trial-and-payment sentence (new, owner ask 1).** It mirrors the Club sentence word for word. One
sentence, "payment method" not "card", the length is derived (not typed), no "free", nothing about cancelling (the page's
trust line carries that):

> **{N}-day trial — you add a payment method at checkout, and you’re first charged when the trial ends.**

With today's League Plus config (30 days) it reads: **"30-day trial — you add a payment method at checkout, and you’re
first charged when the trial ends."** Club and Club · Association read the same with their own length (90 today).

- It is already the same function: `clubTrialLine(trialDays)` takes the length as an argument and the billing page already
  calls it with whatever checkout will use (`lib/plan-billing-words.ts:111`). So League Plus needs no new sentence in code,
  only a plan-neutral name for the function (handoff `/billing`) and the right length passed in.
- **Where the canon must change (an owner ask, not an edit):** `PRICING_PAGE_COPY.md` ~351-358 says "Do not reintroduce
  trial-length language anywhere in live copy" and names **Club** as the one exception, "in the one sentence ... and nowhere
  else". Its "Where" list (~284) and "Only where a trial applies" note (~289-291) also name Club. For League Plus to say its
  trial, the exception has to name **League Plus and Club · Association** too. The reason it can: League Plus on sale has a
  trial that takes a payment method, so "No credit card required" would be false on it exactly as it was on Club.
  `BUSINESS_DECISIONS.md` 2026-11-18 already rules "League Plus with its trial, as configured"; what is not written
  anywhere is the card and the sentence. Facts has no League Plus trial line either (handoff `/strategy`).
- **Only where a trial applies.** Checkout gives no trial to a returning customer (`create-checkout/route.ts:413`) and a
  paid-to-paid move gets none (2026-09-25). So the sentence shows to a prospect on the public pages and on a free org's
  plan step, never on the billing page's move window. Public pages cannot know the visitor, so they say it; checkout is
  the arbiter.

**The tax words:** `{plusTax}` under every price a buyer will be charged: the three new open prices included. A closed
plan's price carries none (canon, 2026-11-05: a price that cannot be bought is not yet a charge).

**The two closed tags and sentences** stay as the canon has them: League Plus "Not open yet" / "League Plus is built, but not
open for sign-up."; Club "Coming soon" / "Club is coming soon — it isn't open for sign-up yet.".
**⚖ Superseded for League Plus (owner 2026-11-19):** League Plus goes on sale with Club (2026-11-06), so its "parked"
words no longer fit. It wears "Coming soon" too; its closed sentence is `/marketing`'s to write (plan S3).

---

## B. The plan cards: `components/PricingSection.tsx` (shared by /pricing, the home page, the onboarding chooser)

### W1. League Plus card: the note under the price
- **Today (closed):** the card is not a card; League Plus is in the strip (W6). In code, the open-state note is "No credit card required" (`:118-119`).
- **Open:** `{leagueTrialLine}`
  *(30-day trial — you add a payment method at checkout, and you’re first charged when the trial ends.)*
  Under it the tax line: `{plusTax}`. Annual view: the savings line may sit above, but the trial sentence stays in both views (see W7).
- **Closed also changes:** No (no closed card exists).

### W2. League Plus card: the button, and the fine print under it
- **Today (open-state code):** button "Start free", with the fine print "No credit card required" under it (`:127`, and `finePrint` at `:392`).
- **Open:** button **"Start your League Plus trial"**, going to the League Plus start (S2). **No fine print**: the terms live in the note, not the button (the 2026-08-07 and 2026-09-25 precedent). Nothing in the button says "free".
- **Closed also changes:** No.

### W3. Club card: the team-band line
- **Today:** "Up to 15 teams — or up to 30 on Club · Association" (`:154`). The note `{clubTrialLine}` and the button "Start your Club trial" are already right and do not change.
- **Open:** **"Up to 15 teams"**. Club · Association now has its own card beside it, so the pointer is no longer needed.
- **Closed also changes:** No (the pointer is right while Club · Association has no card and no price).

### W4. NEW: the Club · Association card
Full name always; never "Large", "Enterprise" or "top tier". Same modules as Club; it differs by team count and price only.

| Part | Open words |
|---|---|
| Name | **Club · Association** |
| Tagline | **The full Club platform for organizations with 16 to 30 teams.** |
| Price | `{Club · Association price}` /mo, CAD; annual `{Club · Association annual}` /year. Tax line `{plusTax}` |
| Note under the price | `{clubTrialLine}` (the same sentence; canon says same sentence for both bands) |
| Features | **Everything in Club** · **16 to 30 teams, every team type counted the same** · **Start here, or move up from Club when you pass 15 teams** |
| Button | **"Start your Club · Association trial"** (fallback if it is too long for the card: "Start your trial"; owner ask 4) |
| Quiet line under the button | see W5 |

- Why "16 to 30": Club's cap is 15 and Club · Association's is 30 (`lib/plan-config.ts:109,132`). "Up to 15" beside "16 to 30" leaves no overlap and makes the choice a count, not a judgment. The Facts doc writes "15–30"; both mean the same cap, this reads clearer on two cards side by side.
- "every team type counted the same" is Facts (rep, select and development teams all count equally).
- "move up from Club" is true once the band move ships (Stage 1b, decided 2026-09-25): one subscription, charged the prorated difference, shown before you confirm. The card promises only the move, not its arithmetic; W20 carries the detail.
- **Closed also changes:** No (not shown while closed; the price publishes at the flip, 2026-09-25).

### W5. NEW: the "more than 30 teams" line
- **Proposed (open):** under the Club · Association button, small and quiet: **"More than 30 teams? Email {support email} for a custom quote."**
- **Does this break the 2026-11-18 ruling?** In substance no, in wording it is close, so I changed the words. The ruling removes "we set up Club with you" and "talk to us" as **Club's door**: the way a normal club gets in. Above 30 teams there is nothing to buy at a listed price: Facts has "custom quote" above 30 (the platform admin sets the team cap by hand), so a path has to exist, and it is a quote, not a consultative onboarding. Two cautions: the literal phrase "talk to us" is exactly the one the owner struck, so do not use it; and the line must not be an interest-form button (that form is for a closed plan). **Recommendation:** keep the line, as an email for a quote, one line, no button. (owner ask 2)
- **Closed also changes:** No.

### W6. The strip for plans that are not open
- **Today:** the tag is one **"Not open yet"** for the whole strip; the body ends "Express interest to be notified when self-serve checkout opens." (`:525`, `:534`)
- **Open (a plan open):** that plan leaves the strip. With all three open the strip does not render; no new words.
- **Closed also changes: Yes.**
  - Tag: with one plan in the strip, use that plan's own tag (Club "Coming soon", League Plus "Not open yet"). With both in the strip, the strip keeps one group tag and **each plan's name carries its own status** after it, so Club never wears "Not open yet". (Canon ~266 names "Not open yet" as the strip's heading; I read that as the group heading when both are closed, and per-plan once they differ. Owner ask 3.)
  - The closing line "Express interest to be notified when self-serve checkout opens." becomes `{interestLine}` ("Tell us you're interested and we'll let you know when it opens."), the canon sentence beside an interest door.
  - The button label ("Express interest in League Plus or Club") stays.

### W7. Placement note: the trial sentence in the annual view (not words)
Canon ~302: on the annual view the "save two months" line replaces the note, so the trial sentence disappears. For the
three open cards the sentence must show in **both** views. Same words, handed to `/design` for where it sits.

---

## C. /pricing: `app/pricing/page.tsx`

### W8. The hero line
- **Today (closed, Premium open):** "Tournament, Tournament Plus, and the Premium Coaches Portal are live — start free, no credit card required. League Plus and Club are open for interest while we finish those workflows."
- **Open (all three):** **"Every plan is available now. Tournament is free, with no credit card required."** (the trust list under it already says it; this is the lead.)
- **Closed also changes: Yes.** Two canon breaks: "start free, no credit card required" reads as if Tournament Plus needs no card (drift table, 2026-11-18); "while we finish those workflows" is "being finished" language, banned for League Plus and an imminence promise for Club. Closed becomes: **"Tournament, Tournament Plus, and the Premium Coaches Portal are available now. Tournament is free, with no credit card required. {closedPlansLine}"** (and the same shape without the Coaches Portal when Premium is closed).

### W9. The role picker: the League Plus card
- **⟶ Superseded for the open state by W59 (audience review, 2026-11-18):** with all three plans open the picker has
  three doors, and the League Plus and Club doors become one "League or club board" door. The words below still apply
  while Club is closed and League Plus is open.
- **Today:** body "Player registration, draft, scheduling, standings, and season-wide parent messaging — from opening day to final game, in one dashboard."; link "Express interest in League Plus" (opens the form).
- **Open:** body unchanged; link **"See what League Plus includes"**, going to /for-leagues (the same shape as the Club card's "See what Club includes", so both lead to a page that carries the plan card and the terms). The Club card needs no change either way.
- **Closed also changes:** No.

### W10. "Available now": the section intro
- **Today:** "Organization plans for tournaments and operations, plus the standalone Premium Coaches Portal for coaches. League Plus and Club are open for early interest below."
- **Open:** **"Plans for tournaments, house leagues and clubs, plus the standalone Premium Coaches Portal for coaches."**
- **Closed also changes: Yes** ("early interest" is the withdrawn early-access framing): **"Organization plans for tournaments and operations, plus the standalone Premium Coaches Portal for coaches. {closedPlansLine}"**

### W11. The League Plus bridge card
- **Today:** body ends "It's built, but not open for sign-up — express interest to be notified when it opens."; button "Express interest in League Plus".
- **Open:** body: **"League Plus is the complete house league platform — player registration, draft, season scheduling, standings, and season-wide parent messaging in one dashboard. No tournament plan required — League Plus is its own entry point for house league organizations."** then `{leagueTrialLine}` as the card's last line; button **"Start your League Plus trial"** (to the League Plus start). (A button that names the trial carries the terms beside it.)
- **Closed also changes: Yes** (last sentence only): "League Plus is built, but not open for sign-up. {interestLine}" The button label stays.

### W12. The Club bridge card
- **Today:** "... priced by club size (up to 15 teams, or up to 30 on Club · Association). Start directly on Club — you don't need to have been on League Plus first. Coming soon — express interest to be notified when it opens."; button "Express interest in Club".
- **Open:** **"Club is the complete platform — tournaments, house league, rep teams, and accounting in one place. The Premium Coaches Portal is included for your whole coaching staff — every team, no per-team fee. Club covers up to 15 teams at {Club price}/mo and Club · Association up to 30 teams at {Club · Association price}/mo, {plusTax}. Start directly on Club — you don't need to have been on League Plus first."** then `{clubTrialLine}`; button **"Start your Club trial"**.
- **Closed also changes: Yes** (last sentence): **"Club is coming soon — it isn't open for sign-up yet. {interestLine}"**

### W13. The "League Plus and Club — what they cover" section (the dark band with the three stat cards)
- **Today:** eyebrow "Not open yet"; body "... shown here so organizations can understand the full platform direction before committing their tournament workflow to us", "That keeps the launch honest while giving interested clubs a path into the roadmap."; cards "Available now", "Not open yet", "Express interest" ("We'll notify you when self-serve checkout opens — no commitment required."); button "Express interest in League Plus or Club".
- **Open:** **the whole section is removed** while both plans are open. Its only job is to explain plans you cannot yet buy and to catch interest; the cards above already show them, and /for-clubs and /for-leagues say what they cover. (The only reference to its `id="early-access"` is the section itself.) With one plan still closed, the section shows for that plan alone, with its closed words. (Owner ask 8.)
- **Closed also changes: Yes.** Roadmap and launch language goes:
  - Body: **"League Plus and Club are shown here so you can see what they cover."**
  - Last paragraph: **"If you want either plan, start on a live tournament plan now, or tell us you're interested and we'll let you know when it opens."**
  - Third card ("Express interest"): **"Share your details and which plans you want. We'll let you know when they open — no commitment."**
  - The middle card keeps `{closedPlansLine}`; the eyebrow follows W6's rule.

### W14. FAQ: "Is the platform only for tournaments?"
- **Today:** "No. Tournament and Tournament Plus are the live self-serve plans today, and the Coaches Portal is coming ... League Plus and Club ... are the next parts of the platform. They're shown here so your organization can plan ahead." (Premium-open variant lists Premium and ends the same way.)
- **Open:** **"No. Tournament, Tournament Plus, League Plus, Club, Club · Association, and the Premium Coaches Portal are all available now: tournaments, house league seasons, rep teams, accounting, and a workspace for one competitive team."**
- **Closed also changes: Yes** ("the next parts of the platform" promises League Plus's timing): replace that sentence with **"League Plus and Club — covering house league seasons, rep team management, and accounting — are shown here so your organization can plan ahead. {closedPlansLine}"**

### W15. FAQ: "Can I buy League Plus, Club, or the Coaches Portal today?"
- **Today (Premium open):** "The Premium Coaches Portal is available now through self-serve checkout at {Premium price}/month {plusTax}. Club is coming soon, and League Plus is built but not open for sign-up. They're shown here so organizations can plan ahead and express interest."
- **Open:** question becomes **"How do I buy League Plus, Club, or Club · Association?"** Answer: **"Choose the plan above, create your account, name your club or league, and check out. League Plus: {leagueTrialLine} Club and Club · Association: {clubTrialLine}"** (Each plan's sentence is verbatim, with its own length; the plan name in front is the only addition.)
- **Closed also changes: Yes** (last clause "plan ahead and express interest"): **"... {closedPlansLine} {interestLine}"**

### W16. FAQ: "How does billing work?"
- **Today:** "Tournament Plus is billed monthly or annually in Canadian dollars. Prices are plus applicable taxes. Monthly billing renews automatically each month. Annual ... Cancel any time; your plan runs to the end of the year you've paid for."
- **Open:** first sentence becomes **"Every paid plan is billed monthly or annually in Canadian dollars."**; the rest unchanged (it already carries "Prices are plus applicable taxes.", the canon sentence); then add **"League Plus: {leagueTrialLine} Club and Club · Association: {clubTrialLine}"** (the runbook found this answer had no trial-and-payment sentence).
- **Closed also changes:** No.

### W17. FAQ: "Can I change plans later?"
- **Today:** "Yes, at any time. If you upgrade mid-month, the new features are available immediately and billing adjusts pro-rata. If you downgrade, the change takes effect at your next billing date. There's no lock-in. ..."
- **Open:** add after the downgrade sentence: **"Moving from one paid plan to another doesn't start a second trial. Moving from Club · Association down to Club waits for your next renewal, and needs 15 teams or fewer."** (Both are decided rules, 2026-09-25.)
- **Closed also changes:** No.

### W18. FAQ: "Do I need a credit card to get started?"
- **Today (after the Founding Season window):** "No. Tournament is free — no credit card, no time limit. The Basic Coaches Portal is free with no time limit too. Paid plans use secure Stripe Checkout."
  - **⚠ Amended 2026-11-19** (`BUSINESS_DECISIONS.md` "'Coach a team' opens the PAID Premium Coaches Portal sign-up…"): the sentence "The Basic Coaches Portal is free with no time limit too." is **dropped**; no coach marketing surface says "free". `/marketing` re-words the answer.
- **Open:** keep those three sentences *(amended 2026-11-19: two, without the Basic Coaches Portal sentence)* and add **"League Plus: {leagueTrialLine} Club and Club · Association: {clubTrialLine}"** so the answer to "do I need a card" is true for the three plans that take one.
- **Closed also changes:** No. (The Founding Season variant of this answer is history; the window closed 2026-10-25.)

### W19. FAQ: "Is there a setup fee or onboarding cost?"
- **Today:** "No. There are no setup fees, implementation costs, or onboarding charges. You sign up, create your organization, and start using the live tournament tools. Documentation covers every available setup step."
- **Open:** **"No. There are no setup fees, implementation costs, or onboarding charges. You sign up, create your organization, and start using your plan's tools. Help articles cover every setup step."** ("the live tournament tools" would be wrong once clubs and leagues sign up; and nothing here promises we set anything up for you, per the open-launch ruling.)
- **Closed also changes:** No.

### W20. NEW FAQ (open only): "Which Club plan do I need?"
- **Open:** **"Club covers up to 15 teams and Club · Association up to 30. Count every team — rep, select and development teams all count the same. Start on the one that fits today; you can move up at any time and you see the prorated charge before you confirm. More than 30 teams? Email {support email} for a custom quote."**
- **Closed:** not shown. Carries the W5 line a second time, where the question actually gets asked.
- **Added by the audience review (2026-11-18):** after "all count the same.", one sentence: **"You don't need League Plus
  first: a club with rep teams starts on Club."** The Club bridge card carried that rule and W75 removes the card; the
  brand rule (League Plus is not a prerequisite for Club) says the FAQ must keep it.

### W21. The bottom call to action
- **Today:** lead ends "{closedPlansLine} Express interest to be notified."; second button "Express interest in League Plus or Club"; small line "All plans are billed in CAD. No long-term contract. No setup fees."
- **Open:** lead **"Start free with Tournament, or pick the plan that matches what you run."**; second button **"Browse all the ways to start"** (to /start; the same words as the interest window's own link); small line unchanged.
- **Closed also changes: Yes** (canon interest line): "... {closedPlansLine} {interestLine}"

### W22. The "bring your team in" promise in the two coach FAQs
- **Today:** "If your organization moves to Club later, it can bring your team in with everything you've built." (once in the closed answer, once in the Premium-open answer.)
- **Closed also changes: Yes.** Facts (the "Coach bridge" line, trued 2026-09-25) says do not promise a workspace carries over until the move is built; production still runs the partial operator transfer. Closed becomes **"If your organization moves to Club later, you won't be charged for the portal again."** (the one fact Facts allows.)
- **Open:** the full promise comes back only if the coach-into-Club move (Club readiness Stage 2, migration 313) reaches production with the release: **"If your organization moves to Club, it can bring your team in with everything you've built."** If it does not, open keeps the closed wording. (Owner ask 10. The same sentence sits on /for-coaches (`:19`, `:60`, `:67`), /for-clubs (W29) and /for-leagues (W35): one answer for all.)

---

## D. /for-clubs: `app/for-clubs/page.tsx`

### W23. The hero: button and note
- **Today:** primary button "Express interest in Club"; note "**Coming soon** — Club is in development. Tournament, Tournament Plus, and the Premium Coaches Portal are live today."
- **Open:** primary button **"Start your Club trial"** (to the Club start); note: `{clubTrialLine}` (the live-products sentence goes; everything is live).
- **Closed also changes: Yes:** "Club is in development" is not the canon sentence. **"Coming soon — it isn't open for sign-up yet. Tournament, Tournament Plus, and the Premium Coaches Portal are live today."**

### W24. The demo block (the readiness plan's recommendation: keep the coach door, say what it is)
- **Today:** eyebrow "Both halves are live today"; "Club bundles what's already running: tournaments and the Premium Coaches Portal. Walk both right now — no sign-up — and express interest for the day they're one product." Links "See a live tournament" and "See a coach's season". It renders only while the demo doors are on.
- **Open:**
  - Eyebrow: **"A coach's season inside a club"**
  - Body: **"Every coach on your staff works in the Premium Coaches Portal that comes with Club. This is one coach's season in a fictional club: roster, lineups, schedule and budget. No sign-up."**
  - One link: **"See a coach's season"** (the tournament link leaves this block; it has its own door on /for-tournament-organizers).
  - Says nothing about a club demo and promises none (ruled: no club demo for launch).
- **Closed also changes:** No. ("Both halves are live today" is true of the two sandboxes while Club is a promise. The reword is the open page's, matching plan Ask 11.)

### W25. The plan section's intro
- **Today:** "Club is finishing its final workflows before self-serve checkout opens. Express interest to be notified when it's ready for your organization."
- **Open:** **"Pick the Club plan that fits your team count: up to 15 teams, or up to 30 on Club · Association."**
- **Closed also changes: Yes:** **"Club is coming soon — it isn't open for sign-up yet. {interestLine}"** (the canon sentence and interest line; "finishing its final workflows" is the retired imminence framing.)

### W26. The Club card
- **Today:** price, "{Club annual}/year — save two months · priced by club size (up to 15 teams · up to 30 on Club · Association)", tag "Coming soon", button "Express interest".
- **Open:** tag removed; price line + **`{plusTax}`**; "{Club annual}/year — save two months · **up to 15 teams**"; note `{clubTrialLine}`; button **"Start your Club trial"**.
- **Closed also changes:** No.

### W27. NEW: the Club · Association card
Same words as W4 (name, tagline, price, tax line, `{clubTrialLine}`, features, the W5 line, button "Start your Club · Association trial"), set beside the Club card.
- **Closed also changes:** No (not shown).

### W28. "Start now: Running a tournament this year?" card
- **Today:** "Running a tournament this year? Get your org on the platform today." "... your org is already set up on FieldLogicHQ when Club opens, with no data to migrate." chips "Tournament — Free", "Tournament Plus — {price}/mo plus applicable taxes".
- **Open:** **the card is removed.** Its whole point is "start now while you wait for Club"; Club includes tournaments, so the second card slot belongs to Club · Association (W27).
- **Closed also changes:** No.

### W29. The two cross-sells ("More from FieldLogicHQ")
- **Today:** *Coaches Portal*: q "Do coaches need access before Club opens?"; body "The Coaches Portal is also available standalone — coaches can start on their own today. When you move to Club, you can bring each coach's team in with everything they've built, and it's included in your plan from then on."; link "See the Coaches Portal" (or "Express interest" when Premium is closed). *Tournament*: q "Running a tournament before Club opens?" "Tournament and Tournament Plus are live today — free to start, no credit card required. Your org is already on the platform when Club launches."
- **Open:** *Coaches Portal*: q **"Do your coaches need their own portal?"**; body **"Every coach on your staff gets the Premium Coaches Portal with Club — every team included, no per-team fee. A coach who already has a standalone portal can bring their team in when you move to Club, with everything they've built."** (the second sentence only if W22's condition holds); link **"See the Coaches Portal"**. *Tournament*: **removed** (Club includes tournaments; "before Club opens" no longer exists).
- **Closed also changes: Yes** (W22): "... When you move to Club, a coach with a standalone portal won't be charged for it again, and the portal is included in your plan from then on."

### W30. The bottom call to action
- **Today:** "Express interest in Club to be notified when self-serve checkout opens. Running a tournament now? Start free today."; buttons "Express interest in Club", "Start free with Tournament".
- **Open:** lead **"Pick the Club plan that fits your team count and start today."**; one button, **"Start your Club trial"**; under it a quiet link **"See every plan and price"**.
  - *Changed 2026-11-18 (owner's question, audience review):* the first draft kept the second button "Start free with Tournament" and the sentence "Running a tournament only? Start free with Tournament." Both leave once Club is open. Club includes tournaments, a free exit beside the trial button competes with it at the moment of decision, and W28 and W29 already remove the page's other two tournament offers for the same reason. The hero's quiet link "Running a tournament? See tournament plans" stays for a visitor on the wrong page.
- **Closed also changes: Yes:** lead **"{interestLine} Running a tournament now? Start free today."**

---

## E. /for-leagues: `app/for-leagues/page.tsx`

### W31. The hero: button and note
- **Today:** primary "Express interest in League Plus"; note "{Not open yet} — League Plus is built, but not open for sign-up. Tournament, Tournament Plus and the Premium Coaches Portal are live now."
- **Open:** primary **"Start your League Plus trial"** (to the League Plus start); note `{leagueTrialLine}`.
- **Closed also changes:** No (it already uses the canon tag and sentence).

### W32. The plan section's intro
- **Today:** "League Plus is built but not currently open for sign-up. Tell us your league is waiting — it is the clearest signal we have for when to open it."
- **Open:** **"League Plus is open for sign-up. It is its own plan: you don't need a tournament plan first."**
- **Closed also changes:** No (honest, no timing promise; the 2026-08-20 ruling stands).

### W33. The League Plus card
- **Today:** price, "{annual}/year — save two months", tag "Not open yet", button "Express interest".
- **Open:** tag removed; **`{plusTax}`** under the price; note `{leagueTrialLine}`; button **"Start your League Plus trial"**.
- **Closed also changes:** No.

### W34. "Start now: Running a tournament this year?" card
- **Today:** "Running a tournament this year? You can get started today. ... your org is already on the platform when League Plus opens." chips for Tournament and Tournament Plus.
- **Open:** replaced by a card that says what the plan already covers. Eyebrow **"Already included"**; title **"Running a tournament too? It is in your plan."**; body **"League Plus includes everything in Tournament Plus — public registration, check-in, schedule generators and your own branding — so one plan covers your season and your events."**; link **"See what Tournament Plus includes"** (to /for-tournament-organizers). (The feature list on the League Plus card starts "Everything in Tournament Plus", so this is Facts-true.)
- **Closed also changes:** No.

### W35. The two cross-sells
- **Today:** *Club*: "Also running rep teams?" ... button-card "Express interest in Club". *Coaches Portal*: "Do your coaches need their own workspace?" ... "And if your organization moves to Club, it can bring each coach's team in with everything they've built."; "Express interest in the Coaches Portal" (always, though Premium has been on sale since 2026-07-24).
- **Open:** *Club*: unchanged text; the card becomes a link **"See what Club includes"** (to /for-clubs). *Coaches Portal*: link **"See the Coaches Portal"** (to /for-coaches); the bring-in sentence follows W22.
- **Closed also changes: Yes.** Coaches Portal: the link is **"See the Coaches Portal"** (to /for-coaches) whenever Premium is open, which it is; the page already reads that gate for its hero (`teamCheckoutOpen`), so this is the same fix /for-clubs already carries. Bring-in sentence per W22's closed wording.

### W36. The bottom call to action
- **Today:** "Express interest in League Plus to be notified when self-serve checkout opens. Running a tournament now? Start free today."; buttons "Express interest in League Plus", "Start free with Tournament".
- **Open:** lead **"Start League Plus today."**; one button, **"Start your League Plus trial"**; under it a quiet link **"See every plan and price"**.
  - *Changed 2026-11-18 (owner's question, audience review):* "Start free with Tournament" and "Running a tournament instead?" leave once League Plus is open, for W30's reason: League Plus includes everything in Tournament Plus (W34 says so on this page). The hero's quiet tournament link stays.
- **Closed also changes: Yes:** lead **"{interestLine} Running a tournament now? Start free today."**

---

## F. /for-tournament-organizers: `app/for-tournament-organizers/page.tsx`

### W37. The League Plus cross-sell
- **Today:** q "Also running a house league season?" body "Player registration, draft tools, schedules, standings, and season-wide parent messaging — all in one dashboard." button-card "Express interest in League Plus". (The Club card here already links to /for-clubs.)
- **Open:** same text; the card becomes a link **"See what League Plus includes"** (to /for-leagues). The Club card is unchanged.
- **Closed also changes:** No.

---

## G. Home: `app/page.tsx`

### W38. Step 1 of "How it works"
- **Today:** "Create your organization and set up the tournament tools you need today. League Plus and Club modules can be added as they open."
- **Open:** **"Create your organization and set up the tools you need, from tournaments to house league and rep teams."**
- **Closed also changes:** No.

### W39. The "What's included" lead
- **Today:** "Tournament organizers and coaches can start today — free, no credit card required. League Plus and Club are in active development." (Premium-closed variant: "... League Plus, Club, and Coaches Portal are in active development.")
- **Open:** **"Tournament organizers, coaches, house leagues and clubs can start today. Tournament is free — no credit card required."**
- **Closed also changes: Yes** ("in active development" is imminence; canon is the one sentence): **"Tournament organizers and coaches can start today — free, no credit card required. {closedPlansLine}"** (Premium-closed: "The Coaches Portal is coming soon. {closedPlansLine}", the same shape /pricing uses.)

### W40. The module cards' tag
- **Today:** "Club · In development" and "League Plus · In development" (`:453`).
- **Open:** the card moves from the quiet roadmap row to a full module card, tag **"Club · Available now"** / **"League Plus · Available now"** (the live cards' pattern, "{plan} · {badge}").
- **Closed also changes: Yes:** the plan's own canon tag: **"Club · Coming soon"**, **"League Plus · Not open yet"**.

### W41. The role cards' badge (this is the single act that launches a card, per the code's own note)
- **⟶ The roadmap row is superseded for the open state by W60 (audience review, 2026-11-18):** with both plans open,
  the two role cards and the row become three audience doors. The badge words below ("Available now") carry over to
  the middle door unchanged.
- **Today:** closed badge `{tag} · express interest` (canon already: "Coming soon · express interest", "Not open yet · express interest"). Their open badge is unwritten (`liveBadge: null`).
- **Open (the missing words):** both League Plus and Club: **"Available now"**. No price and no free claim: the 2026-08-07 ruling keeps persona cards to availability, and these two plans are not free. The cards go to /for-leagues and /for-clubs, whose cards carry the terms.
- **Closed also changes:** No. (The roadmap row's eyebrow "On the roadmap" stays: the canon notes it as an order word, not a timing promise.)

### W42. The pricing intro
- **Note (audience review, 2026-11-18):** the intro stays; with all three plans open it sits above three price rows
  (W61), not the plan grid.
- **Today:** "Tournament, Tournament Plus, and the Premium Coaches Portal are available now. {closedPlansLine}"
- **Open:** **"Tournament, Tournament Plus, League Plus, Club, Club · Association, and the Premium Coaches Portal are available now."** (Built from the gate: each plan appears in "available now" when open, and `{closedPlansLine}` covers the rest, so a partial flip reads right.)
- **Closed also changes:** No.

---

## H. The chooser: `app/(consumer)/start/page.tsx`

Existing cards: label "Organizer" / title "Run a tournament"; label "Coach" or "Premium Coaches Portal" / title "Coach a team"; (flag-gated) label "League admin" / title "Start a league season". New cards are named in the same shape: a role label and a task title.

### W43. The page description (metadata)
- **Today:** "Tell us your job and start free — run a tournament, coach a team, start a league season, or explore Club."
- **Open:** **"Tell us your job and get started — run a tournament, coach a team, start a league season, or start a club."**
- **Closed also changes: Yes** ("start free" over-claims, and "start a league season" / "explore Club" name doors the chooser does not show while closed): **"Tell us your job and get started — run a tournament or coach a team."**

### W44. NEW: the Club card (open only)
- Label **"Club executive"** (the home page's own persona name) · title **"Start a club"** · tag **"Paid plan"** (owner ask 5) · body **"Tournaments, house league, rep teams and accounting in one place. Choose Club or Club · Association by how many teams you run."** Goes to /start/club.
- **Closed:** not shown (today's behaviour, per the S1-1 rider: nothing not-yet-live is promoted here).

### W45. The League card (open)
- **Today:** the card exists only behind the free-League beta flag: label "League admin", title "Start a league season", **tag "Free"**, body "Run a house-league season — registration, draft, scheduling, standings, and parent comms." and it points at the free League floor's start.
- **Open (League Plus open):** label "League admin" · title **"Start a league season"** (unchanged) · tag **"Paid plan"** (not "Free": League Plus has a trial that takes a payment method) · body **"Run a house league season — registration, draft, scheduling, standings, and parent messaging."** Goes to /start/league (the League Plus start).
- **Closed also changes:** No. (When the free-floor flag is on at the same time, which door this one card opens is a build call; S2 leaves the free floor as it is.)

---

## I. /start/club: the three steps (the Run a tournament pattern: `StartDoorForm`, `PlanStep`, `RUN_A_TOURNAMENT_STEPS`)

### W46. Step line, step 1 (account)
- **Step line:** **Account · Club · Plan** (Run a tournament's is Account · Organization · Plan).
- **Heading:** **"Start a club"** (repeats the chooser card's words).
- **Sub:** **"Create your account, name your club, then choose Club or Club · Association."**
- **Small print under the button:** none. The tournament door says "Free, no credit card"; this one is neither, and the plan step carries the terms. (No "free", and not "nothing is charged until...", which canon rejected as "free until" framing.)
- **If a plan was picked on /pricing:** the existing callout, with `pickedPlanLabel`: "**Club, billed monthly**, from the pricing page. You'll confirm it after naming your club." (the tournament door's words with "club" for "organization".)

### W47. Step 2 (name)
- Heading and step line as step 1. **Sub:** **"Name your club, then choose Club or Club · Association."**
- Field label **"Club or association name"** (it covers both bands; the tournament door's is "Organization name" and the league's "League or organization name"). Placeholder **"e.g. Milton Minor Baseball Association"**. Under it, the existing public-address line.
- Button **"Create club"**. Empty: **"Enter a club name."** Failed: **"Could not create your club."**

### W48. Step 3 (the plan step: two cards)
- **Heading:** **"How many teams does your club run?"** (the question that actually decides the plan; owner ask 6; the tournament door's "How do you want to start?" is the fallback).
- **Sub with a pick:** the existing words: "You picked **{Club, billed monthly}** on the pricing page. You can change it here, or any time in Plan & billing."
- **Sub without a pick:** **"{club name} starts on one of these. You can move between the two in Plan & billing."**
- **Card 1: Club.** Name "Club"; price from config with the Monthly / Annual pair; `{plusTax}`; note `{clubTrialLine}`; three points: **"Tournaments, house league, rep teams and accounting"** · **"Premium Coaches Portal for every coach, no per-team fee"** · **"Up to 15 teams"**. Button **"Start your Club trial"**.
- **Card 2: Club · Association.** Name "Club · Association"; price; `{plusTax}`; note `{clubTrialLine}`; points: **"Everything in Club"** · **"16 to 30 teams"** · **"Move up from Club at any time"**. Button **"Start your Club · Association trial"**.
- Above each button, the existing `PlanTermsLine` ("If your plan starts with a trial, it ends on the date shown at checkout, and your payment method is charged then unless you cancel. Your plan renews automatically until you cancel ...") is read, not rewritten.
- Foot link unchanged: "Compare every plan".
- **No Founding Season line and no "$0"**: Club has no Founding offer (2026-09-25).

### W49. Home's waiting card, if the person leaves before naming the club
- Badge **"Not named yet"** · title **"Your club"** · action **"Name your club"** (the shape of the other doors' cards).

### W50. /start/club while Club is CLOSED (a visitor can still reach the address)
- **Today:** heading "Explore Club"; sub "Club — let's talk"; "... Coaches Portal accounts. We set up Club with you directly. Tell us about your organization and we'll reach out to plan a guided setup."; button "Talk to us about Club"; link "See what Club includes →".
- **Closed also changes: Yes** (the page was the exact line the 2026-11-18 ruling struck). While closed:
  - Heading **"Explore Club"** (unchanged)
  - Sub **"Club — coming soon"** (the League page's own pattern: "League — not open yet")
  - Body **"Club brings everything together for multi-team organizations — house league, rep teams, accounting, and a Premium Coaches Portal for your whole coaching staff. Club is coming soon — it isn't open for sign-up yet. {interestLine}"**
  - Button **"Express interest in Club"**; link "See what Club includes →" unchanged.
- **Open:** this page is W46-W48.

---

## J. /start/league: League Plus (the free floor's beta start is not touched)

### W51. Step line and step 1
- **Step line:** **Account · League · Plan**. **Heading:** **"Start a league season"** (the chooser card's title; the free floor's existing door uses it too).
- **Sub:** **"Create your account, name your league, then start League Plus."** No small print about free, one season or 8 teams: those belong to the free floor, not to League Plus.

### W52. Step 2
- **Sub:** **"Name your league, then start League Plus."** Field label **"League or organization name"** and placeholder "e.g. Milton Minor Softball" (both existing). Button **"Create league"**. Empty and failed lines as the league door has them today.

### W53. Step 3 (one card)
- **Heading:** **"Start League Plus"**.
- **Sub with a pick:** "You picked **{League Plus, billed monthly}** on the pricing page." **Sub without:** **"{league name} starts on League Plus. You manage it in Plan & billing."**
- **Card: League Plus.** Price with the Monthly / Annual pair; `{plusTax}`; note `{leagueTrialLine}`; points **"Registration, divisions, seasons and standings"** · **"A public site for your league"** · **"Everything in Tournament Plus"**. Button **"Start your League Plus trial"**. `PlanTermsLine` above it as in W48.
- Home's waiting card: the league door's existing words ("Your league", "Name your league").

### W54. /start/league while League Plus is CLOSED and the free-floor flag is off
- **Today:** "Start a league season"; sub "League — not open yet"; "League runs your full house-league season ... It's built, but not open for sign-up. Tell us you're interested and we'll let you know when it opens."; button "Express interest in League"; link "See how League works →".
- **Closed also changes: Yes** ("League" is the free floor's name; this page sells League Plus): sub **"League Plus — not open yet"**; body **"League Plus runs your full house league season — registration, draft, scheduling, standings, and parent communications in one dashboard. League Plus is built, but not open for sign-up. {interestLine}"**; button **"Express interest in League Plus"**; link **"See how League Plus works →"**.

---

## K. The interest form: `EarlyAccessForm.tsx`, `EarlyAccessModalTrigger.tsx`

### W55. After the flip
The form is offered only for a plan whose switch is closed. With all three open it appears on no public page, and needs no new words. A visitor who reaches /start/club or /start/league while closed sees W50 / W54.

### W56. Closed-state words that break the canon (they change today)
**Closed also changes: Yes**, on every line below. The programme was withdrawn 2026-07-28, so "early access" is never read by a customer.

| Where | Today | Proposed |
|---|---|---|
| Window kicker | "Early access" | **"Express interest"** |
| Window intro | "Share a few details and we'll use them for release updates and early access planning." | ~~"Share a few details and we'll let you know when your plan opens."~~ → **`{interestLine}`** (owner ruling 2026-11-19, in code with S2) |
| Saved, with updates | "We've saved your request and we'll write to {email} as the areas you picked become ready." | **"We've saved your request. When the plans you picked open, we'll write to {email}."** |
| Saved, no updates | "We've saved your request for early access planning. You won't get release emails, as you asked." | **"We've saved your request. You won't get an email when it opens, as you asked."** |
| Close button label | "Close early access form" | **"Close the form"** |
| Submit button | "Join early access" | **"Express interest"** |
| Trigger's default label | "Join early access" | **"Express interest"** |
| Feature option | "Coach portal" | **"Coaches Portal"** |

- **Unchanged on purpose:** the window's heading ("Tell us what you want to see next"), the consent checkbox ("Send me feature and release updates for the areas I selected."), the plan options. The consent text is a CASL consent: changing it is a `/legal` change, not a word fix (handoff).
- The saved line promises an email; nothing sends it (runbook Step 6 does it by hand, to those who consented). Today's line has the same promise. It is kept, and flagged to `/legal`.

---

## L. The house-league cap prompt: `components/admin/LeagueCapUpgrade.tsx`

### W57. The upgrade button
- **Today (closed):** "Express interest in League Plus →". **Today (open, typed but unreachable):** "Upgrade to League Plus →", yet it opens the interest form.
- **Open:** keep **"Upgrade to League Plus →"** (already the right words); the change is where it goes (Plan & billing's League Plus start, not the form), and that the prompt reads the live gate, not the code value (S1, S4). The arrow is the prompt's own; plan-card buttons carry none, so `/design` may drop it. The body lines ("... Upgrade to League Plus for unlimited teams.", "... are part of League Plus.") are true in both states.
- **Closed also changes:** No.

---

## M. Audience review additions (2026-11-18): W58 to W75

Added by the audience review (plan section "Audience review, 2026-11-18"). Same rules as above: no price typed, every
number a placeholder, each line Today / Open / Closed also changes. **Stage** says which build session carries the line:
**S1** (wrong today, so it changes at the next promote), **S3** (a piece S3 rebuilds anyway, so it is built once in its
final shape) or **S3b** (a selling section; it does not hold the flip). Reviewed 2026-11-18 by `/marketing`, `/legal`,
`/accounting` and `/strategy`; the wording below is after their changes. Every product claim below was found in the code on 2026-11-18; the plan section lists the proof.
`{T+ price}` and `{Premium price}` are the Tournament Plus and Premium Coaches Portal monthly prices from `PLAN_CONFIG`.

### W58. /pricing: the plan grid in three bands (S3; replaces the two row labels drawn for Ask 4)
- **Today:** one grid of open plans, then a strip of closed ones. The first drawings proposed two rows, "Tournaments and
  leagues" and "Clubs and coaches".
- **Open:** three bands, each with a heading, one line, and its own cards.
  - **Band 1.** Heading **"Running a tournament"**. Line **"One event or a full calendar. Tournament is free; Tournament
    Plus adds public registration."** Cards: Tournament, Tournament Plus.
  - **Band 2.** Heading **"Running a league or a club"**. Line **"League Plus is for a house league. Club is for a club that also runs rep teams,
    and it includes house league. Pick by what your board runs; you don't need one before the other."** Cards: League Plus, Club, Club · Association. A small
    label sits over each card: **"A house league"** · **"A club with rep teams · up to 15 teams"** ·
    **"A club with 16 to 30 teams"**. The League Plus card's first line under its tagline is **"Running a tournament too? It's in
    your plan."**
  - **Band 3.** Heading **"Coaching one team"**. One full-width band, not a lone card. Left: **"Basic Coaches Portal"** (the
    naming canon pairs Basic with Premium), price **"Free"**, **"Every coach starts with a free Basic Coaches Portal. It
    follows every tournament your team enters."** Right: the Premium Coaches Portal card as it is today. Under both:
    **"If your club is on Club or Club · Association, every coach's Premium Coaches Portal is included."** (`/design`: the
    Basic portal is drawn as a strip across the top of the band, above Premium, because its few lines do not fill a
    column; plan Ask 34.)
  - **⚠ Amended 2026-11-19** (`BUSINESS_DECISIONS.md` "'Coach a team' opens the PAID Premium Coaches Portal sign-up…"): **Band 3 drops the Basic Coaches Portal strip and its "Free" price line.** The band is the Premium Coaches Portal card (plus the Club-included line); the free portal is reached through tournament registration, not from /pricing. The original words above stay as the record of Ask 21 / Ask 34 as first ruled.
- **Closed also changes:** No. While a plan is closed it stays in the strip (W6) and its band shows only open plans;
  band 2 does not render until one of its plans is open.
- **Why:** a visitor finds their plans without reading the other two groups. The labels over band 2 state what a club
  runs, not a rank: the brand rule is that League Plus and Club are peers, not steps. Club's label and the band line both
  say Club includes house league, so the club that runs both (the buyer we aim at first) does not buy the smaller plan by
  mistake. Club · Association is a size step from Club, and says so.
- **The page's one lime button** stays on Tournament Plus as today; which card leads once Club is on sale is plan Ask 32.

### W59. /pricing: the role picker has three doors (S3; supersedes W9)
- **Today:** four doors (tournaments, coach, house league, club).
- **Open:** three, in the bands' order, each jumping to its band.
  1. Label "Tournament organizer" · **"I run tournaments."** · body unchanged · link **"See tournament plans"**.
  2. Label **"League or club board"** · **"I run a league or a club."** · body **"House league seasons, rep teams and the
     club's books, run by a volunteer board."** · link **"See league and club plans"**.
  3. Label "Coach or team manager" · **"I coach one team."** · body **"Your free Coaches Portal follows every tournament
     you enter. Premium is the operations HQ for one competitive team: roster, lineups, budget, and schedule."** · link
     **"See the Coaches Portal"**.
  - **⚠ Amended 2026-11-19** (`BUSINESS_DECISIONS.md` "'Coach a team' opens the PAID Premium Coaches Portal sign-up…"): door 3's body **no longer says "Your free Coaches Portal…"**. The door leads to the paid Premium sign-up; `/marketing` re-words the body with no "free". The words above stay as the record.
- **Closed also changes:** No (the four-door picker stays while League Plus and Club are closed; "live products lead"
  still orders it).

### W60. Home: three audience doors (S3; supersedes W41's roadmap row)
- **Today:** two cards (tournament, coach) and an "On the roadmap" row for house league and club.
- **Open:** three cards in one row.
  1. Eyebrow "Tournament" · badge "Free to start · no credit card" · **"Running a tournament?"** · body unchanged ·
     links "I'm a tournament organizer", "See it live — no sign-up".
  2. Eyebrow **"Leagues and clubs"** · badge **"Available now"** (W41's words) · **"Running a league or a club?"** · body
     **"House league seasons, rep teams and the club's books in one place, built for a volunteer board."** · two links:
     **"I run a house league"** (to /for-leagues) and **"I run a club with rep teams"** (to /for-clubs). These are the
     roadmap row's own link labels.
  3. Eyebrow "Coaches Portal" · badge "Free to start · no credit card" · **"Coaching a single team?"** · body unchanged ·
     links "I'm a coach", "See it live — no sign-up".
     **⚠ Amended 2026-11-19** (`BUSINESS_DECISIONS.md` "'Coach a team' opens the PAID Premium Coaches Portal sign-up…"): card 3's badge is **"Available now"** (W41's paid-plan word), **not** "Free to start · no credit card"; "body unchanged" now means the W41 body with no "free" in it, and the "I'm a coach" link opens the paid Premium sign-up. Card 1 (Tournament) keeps its badge.
- **No price on any door** (the 2026-08-07 ruling stands; a price on the coach door would overstate the cost, because
  every coach starts free *(⚠ amended 2026-11-19: that reason no longer holds on a marketing door; the no-price rule stands)*). Plan Ask 24 offers the one exception worth arguing: "from {League Plus price}/mo" on door 2;
  `/marketing` and `/strategy` both recommend against it (the club we aim at first pays the Club price, and a League Plus
  anchor on the door pulls it toward the smaller plan).
- **Closed also changes:** No (the two cards and the row stay while both plans are closed; with one open, that plan's
  link shows in door 2 and the other stays on the row).

### W61. Home: three price rows replace the plan grid (S3; W42's intro stays above them)
- **Today:** the home page carries the same plan grid as /pricing.
- **Open:** three rows, each a heading, one sentence and one link.
  - **"Running a tournament"** · **"Tournament is free. Tournament Plus is {T+ price}/mo."** · **"See tournament plans"**
  - **"Running a league or a club"** · **"League Plus is {League Plus price}/mo. Club is {Club price}/mo for up to 15
    teams, and Club · Association is {Club · Association price}/mo for up to 30."** · **"See league and club plans"**
  - **"Coaching one team"** · **"The Coaches Portal is free. Premium is {Premium price}/mo."** · **"See the Coaches
    Portal"** *(⚠ amended 2026-11-19: "The Coaches Portal is free." is dropped; the row names Premium and its price only. `BUSINESS_DECISIONS.md` 2026-11-19.)*
  - Under the rows: **"Prices are in Canadian dollars, {plusTax}."** then the availability line, then the existing
    "Compare all plans in detail" link, reworded **"See every plan and price"** (the persona pages' label).
- **Closed also changes:** No (the grid and its strip stay on the home page until all three plans are open; the build
  switches the section once, at the same gate read as W42).
- **Why:** six cards are about 5,000 px on a phone, in the middle of the home page. The home page's job is to send each
  visitor to their page; /pricing holds the cards.

### W62. Home: the hero's two buttons (S3)
- **Today:** "Start free" and "Not sure? See your options". Both go to /start.
- **Open:** **"Get started"** (to /start) and **"See plans and prices"** (to /pricing).
- **Closed also changes:** No. ("Start free" is true while every door on /start is free. Once the chooser gains two
  paid doors, it is true of two doors in four.)

### W63. The public nav, the footer and the Get started menu (S3)
- **Nav today:** Tournaments · Coaches · Leagues · Clubs · Pricing. **Open:** **Tournaments · Leagues · Clubs · Coaches
  · Pricing** (the bands' order). Leagues and Clubs stay two entries.
- **Footer today:** no Leagues or Clubs link anywhere. **Both states:** a new column **"Built for"** (a heading in the shape of the
  footer's "Product" and "Get started") with **"Tournament organizers"**, **"House leagues"**, **"Clubs"**, **"Coaches"** (the
  four persona pages). The "Get started" column's existing "Coaches" link, which opens the coach start, becomes
  **"Coaches Portal"** so the footer does not hold two "Coaches" links with two destinations.
- **Get started menu (the /start family's bar) today:** no Club entry. **Open:** **"Start a club"** (W44's title) joins
  it when Club is open, as "Start a league season" does for League Plus.
- **Closed also changes: Yes** for the footer column only (the two pages exist today and nothing in the footer reaches
  them). The nav order changes at the flip.

### W64. Page titles and descriptions each audience would search (S3; words only)
| Page | Today | Proposed |
|---|---|---|
| /for-leagues title | "For house league administrators" | **"House league registration and scheduling"** |
| /for-leagues description | "Run your full house league season in one dashboard — … No spreadsheets, no reply-all emails." | **"Run your house league season in one place: online registration, the draft, the schedule, standings and emails to every family. Built for volunteer boards."** |
| /for-clubs title | "For club executives" | **"Club management: house league, rep teams"** |
| /for-clubs description | "One platform for tournaments, house league, rep teams, and org finances. …" | **"One place for a volunteer board: house league, rep teams, tournaments and the club's accounting, with a Premium Coaches Portal for every coach."** |
| /pricing title | "Pricing" | **"Plans and prices"** |
| /pricing description | "Simple, honest pricing for every role in your organization — …" | **"Prices for tournaments, house leagues, clubs and coaches, in CAD. Tournament is free."** |
- The site adds " | FieldLogicHQ" to each title, so a title stays at 45 characters or fewer.
- **Closed also changes: Yes** (a title is true in both states; none names availability).

### W65. /for-clubs: the hero's sub-line, and one word in the heading (S3b)
- **Today:** heading "Coaches run their team. You run the org." Sub-line "One platform for tournaments, house league,
  rep teams, and org finances. Coaches operate independently — you keep full visibility without owning every task."
- **Proposed (both states):** heading **"Coaches run their team. You run the club."** Sub-line **"One place for house
  league, rep teams, tournaments and the club's books. Coaches run their own teams, and the board keeps the
  registrations, rosters and money in the same place."**
- **Why:** "org" is our word, not a volunteer's (the chooser already follows that rule). "The club's books" puts the
  treasurer in the first ten seconds. "Full visibility" leans on a president's summary that is not built (2026-11-06:
  change no customer copy to promise it).
- **Closed also changes: Yes** (same words).

### W66. /for-clubs: the four "old way" cards, rebalanced toward the board (S3b)
- **Today:** all four are about coaches: "Your coaching staff runs on WhatsApp." · "You can't see the team finances
  without asking." · "Tryouts run on email chains." · "When a coach leaves, knowledge walks with them."
- **Proposed (both states):**
  1. **"The treasurer rebuilds the books every spring."** **"Team dues in one spreadsheet, club fees in another, the bank
     statement in a third. The board asks where the money went and gets a best guess."**
  2. **"House league registration is a form and an inbox."** **"Confirmations by hand, a spreadsheet to cross-check, and
     a registrar answering the same email all month."**
  3. "Your coaching staff runs on WhatsApp." (unchanged)
  4. **"When a volunteer leaves, the knowledge leaves too."** **"The contact list is in a personal Google Drive. The
     roster is someone's spreadsheet. Next year's board starts from nothing."**
- The tryouts card leaves the four; tryouts stay in module 3 and on the plan card.
- **Why:** the buyer we aim at first is the club that runs house league and rep teams together. Its treasurer and
  registrar read this page too, and today nothing on it is theirs.
- **Closed also changes: Yes** (same words).

### W67. Pictures: the product's own screens on /for-leagues and /for-clubs (S3b)
- **Today:** no picture on any marketing page.
- **Proposed (both states):** each of /for-leagues' four steps and /for-clubs' four modules gains one picture of the real
  screen, taken from a fictional club. One line under each section: **"These are the product's own screens, shown with
  a fictional house league."** (/for-clubs: **"…a fictional club."**)
  - /for-leagues: 01 the registrations list · 02 the draft board · 03 the season schedule with standings · 04 the Email
    families window.
  - /for-clubs: 01 a public event page with live scores · 02 the registrations list · 03 a coach's roster · 04 Budget
    vs. Actual. Under 03, the existing link **"See a coach's season"** (the live demo) while the demo doors are on.
- Alt text names the screen ("The registrations list for a house league season"). No figure is quoted in a caption.
- **Closed also changes: Yes** (the pictures are true in both states).
- **⚖ Owner, 2026-11-19:** screenshots vs. drawn pictures is NOT settled — S3b shows him both, side by side, and he
  chooses (plan S3b). The caption above is for screenshots; a drawn picture needs its own.
- **This is not a demo** and promises none (ruled 2026-11-18: no club demo for launch).
- **Conditions (`/legal`):** shot from a club built for the purpose with invented names; never the live demo clubs
  (anyone can type into them), never a production row; no birth date, medical field, real-looking email or phone, real
  logo or photo in a shot. Re-shot each release cycle with the `/demos` pass, because a picture goes stale silently.

### W68. "How the trial works" (S3; /for-leagues and /for-clubs, under the plan cards)
No trial length is typed here: the one trial sentence above it carries the number, from config.
- **Open:** heading **"How the trial works"**, then four short steps.
  1. **"Start today."** **"Create your account, name your club and add a payment method at checkout. The trial is for
     your club's first paid plan."** (/for-leagues: "name your league", "your league's first paid plan")
  2. **"Use all of it."** /for-clubs: **"Your whole plan is on from the first day. Set up your season, open registration
     and bring in your coaches."** /for-leagues: **"Your whole plan is on from the first day. Set up your season, open
     registration and build your teams."**
  3. **"We email you before it ends."** **"The owners get an email a few days before the trial ends. It names the date. To
     stop, cancel in Plan & billing before that date."**
  4. **"Or carry on."** **"Do nothing and your payment method is charged on that date, {plusTax}, monthly or yearly as you
     chose, and the plan renews until you cancel."**
- **Closed:** not shown.
- **Why:** today the trial is one sentence that reads as a hurdle. A board's real question is "what happens to the
  card?", and every step here is something the product does.
- **Review notes.** `/marketing`: "with nothing charged" was too close to the rejected "nothing is charged until the
  trial ends", so step 3 states the cancel route and no more; the copy rule that a trial's length lives in one sentence
  "and nowhere else" must name this section (plan Ask 27). `/strategy`: this is a disclosure, so it rides S3, not S3b.
  `/legal`: the email is real (it goes to every owner when Stripe signals the trial is about to end, a few days before);
  the Terms do not promise it, so this is a new promise, and production must be confirmed to receive that signal. When
  the email gains the price and tax (plan Ask 8), step 3 may say "the date and the amount".

### W69. /for-clubs: "What each person at your club gets" (S3b; new section after the modules)
- **Open and closed:** heading **"What each person at your club gets"** (coaches are not on the board), four cards.
  - **President.** **"One place for the whole club."** **"House league, rep teams, tournaments and the books under one
    sign-in. Give each board member their role, and take it back when someone steps down."**
  - **Treasurer.** **"Books the next treasurer can read."** **"One ledger, a budget checked against what was actually
    spent, and club costs split across teams. Export the board report for the meeting as a PDF or an Excel file."**
  - **Registrar.** **"Registration without the inbox."** **"Families register on your club's page. You accept players,
    manage the waitlist and email every family from one screen."**
  - **Coaches.** **"A Premium Coaches Portal for every coach."** **"Roster, lineups, schedule and team budget for every
    team, included in your plan with no per-team fee."**
  - Under the cards: **"Taking this to a board meeting? The plans, the prices and the trial are on one page."** link
    **"See every plan and price"**.
- **Closed also changes: Yes** (the section is true while closed; its last link is the page's existing one).

### W70. "Questions a board asks" (S3b; /for-clubs and /for-leagues, before the bottom call to action; the first four
also join the /pricing FAQ)
1. **"Can we switch in the middle of a season?"** **"The easiest time is your next registration: families register on
   your new page, so there is no list to move. A tournament can start any day. There is no import for a house league
   season that is already under way."** (/for-clubs adds: **"Coaches can paste or upload a roster."**)
2. **"What happens when our treasurer or registrar changes?"** **"Invite the new person, give them the role and remove
   the old one. Everything stays with the club: the books, the families and last season's setup, which next season can
   start from. To change the club's owner, email {support email} from the current owner's address."**
3. **"What do you do with our families' information?"** **"We never sell your club's information or use it to
   advertise. FieldLogicHQ never shows a player's name, birth date or roster on a public page. Your club's information
   is stored in the United States (Ohio), with our database host, Supabase, on Amazon Web Services."** link **"Read the Privacy Policy"**.
4. **"What if we decide to stop?"** **"Cancel any time in Plan & billing; an owner of the club does it. Your plan runs to
   the end of the period you have paid for, and we don't refund the unused part. We keep your information for 90 days
   after a plan ends, so you can come back. You can download your lists as Excel, CSV or PDF, or ask us for a full
   copy."**
5. **"Do our volunteers need training?"** **"No. It runs in a browser and can be added to a phone's home screen,
   with no app store. Help articles are built into the admin, and you can write to {support email}."**
6. **"What does a year cost?"** /for-clubs: **"Club is {Club annual} a year or {Club price} a month, {plusTax}, for up to
   15 teams. That covers the whole club: every coach's Premium Coaches Portal is included, with no per-team fee."**
   /for-leagues: **"League Plus is {League Plus annual} a year or {League Plus price} a month, {plusTax}. That covers
   your seasons and your tournaments."**
- **Closed also changes:** 1 to 5 are true in both states and may show while closed; 6 shows only when the plan is open
  (a closed price carries no tax line).
- **Review notes (`/legal`).** Answer 3: "your club's information", not "your information" (we do email account holders
  who agreed to updates); "FieldLogicHQ never shows…", not a flat "never shown" (a club can type a child's name into its
  own news post); the storage sentence stays, because asserting privacy while leaving out where the information sits is
  the worse position. No sentence about AI: that promise rests on a working rule, not on a guard. Answer 4: the 90 days
  and "no refund" are in the published Terms and must be said; "ask us for a full copy" is the approved wording, but
  the commitment is written only in the data terms, which are approved and not yet published. Publish them with this
  release, or the owner confirms the by-hand procedure (plan Ask 29). Never "export everything". Answer 2: only our
  staff can change a club's owner; the request must come from the current owner's address. The page must ship with the
  Terms and Privacy Policy live on production, or "Read the Privacy Policy" leads nowhere.

### W71. The paths between audiences (S3b)
- **/for-tournament-organizers, the League Plus and Club cross-sells (open):** add one line to each: **"Already running
  tournaments here? Start League Plus or Club from Plan & billing. Your events, teams and staff stay where they are."**
  (True once S4 ships. It carries the one true claim of the card W28 removes: "no data to migrate". It must not mention a
  trial: an organization that has already paid for a plan gets none.)
- **/for-coaches, the "Is your org considering Club?" card (both states):** heading **"Is your club considering Club?"**
  and a second link **"Copy a link for your club"** (copies the /for-clubs address to the clipboard and nothing else: no
  pre-filled email, no reward, nothing sent by us, which keeps it clear of the anti-spam rules). The coach-facing promise stays the
  canon one: "you won't be charged for your own portal again".
- **/demos, the coaches card (both states):** one line: **"Running a club? This is what each of your coaches gets with
  Club."**
- **Closed also changes:** as marked per line.

### W72. /pricing: three FAQ answers that claim customers we do not have (S1; they are wrong today)
- **Today:** "FieldLogicHQ is used by associations where the 'tech person' is whoever stepped up at the last AGM." ·
  "Most organizations are running their first tournament within an afternoon of signing up." (twice) · "used by
  softball associations, hockey organizations, soccer leagues, and baseball clubs."
- **Proposed (both states):**
  - "Is this too complex…": **"No. FieldLogicHQ is built for associations where the 'tech person' is whoever stepped up
    at the last AGM. It follows the jobs your board already does: scheduling, registration, score entry and emails,
    without the spreadsheets and email chains. You don't need to configure anything complicated to get started."**
  - "What if we get stuck?": the "Most organizations…" sentence is removed; the rest stays.
  - "Can I use FieldLogicHQ for multiple sports?": **"Yes. The platform is not tied to one sport: venue names, team
    structures, scoring and season setup work for softball, baseball, hockey and soccer. If you run more than one club
    or association, each one is set up separately."** (`/marketing` confirms the four sports against the sport settings
    before this ships.)
- **Closed also changes: Yes.** Nothing has been sold yet (`LEGAL_FACTS.md`); "used by" and "most organizations" are
  statements about customers. `/legal` rates this the most urgent item in this section: the three sentences are on the
  live page today.

### W73. Two "free" labels over a paid plan (found on the way; S1 if the owner agrees, plan Ask 31)
- **/for-coaches, the Premium card's tag. Today:** "Free right now" whenever Premium is on sale. Premium is
  {Premium price}/mo with no trial since the Founding Season closed. **Proposed:** no tag (the price line and
  "Start now" already say it). `/legal`: high risk, because the buyer is often an individual; remove it at the next
  promote.
- **"Start Tournament Plus free"** (the /pricing bridge and the /for-tournament-organizers plan card). Tournament Plus
  checkout takes a payment method and starts a trial. **Proposed:** **"Start Tournament Plus"**. What the note beside
  it says about the trial is a `/strategy` and `/billing` call: the canon says Tournament Plus advertises no trial,
  and the config gives it one.

### W74. /for-leagues: one clock (S1)
- **Today:** "…until someone called you at 8am on a Saturday." **Proposed:** **"…at 8:00 a.m. on a Saturday."** (the
  one-clock rule).

### W75. /pricing: the bridge cards after the bands (S3; refines W11 and W12)
- With League Plus and Club in their own band under their own heading, the two bridge cards for them repeat the band.
  **Open:** the League Plus and Club bridge cards are removed; the Tournament Plus bridge stays, and the three answers
  they carried move into the band's line (W58) and the FAQ (W20, W70). W11 and W12 then apply only while one plan is
  still closed.
- **Closed also changes:** No.

---

## Closed words that change (the S1 list, plan Ask 8)

Every row below is a line whose **closed** words break the canon or the Facts doc today. All are small; most are one sentence.

| Id | Surface | What changes |
|---|---|---|
| W6 | the strip | per-plan tag; the interest line |
| W8 | /pricing hero | drop "start free, no credit card required" for Tournament Plus; drop "while we finish those workflows" |
| W10 | /pricing "Available now" intro | drop "early interest" |
| W11, W12 | /pricing bridges | the canon sentence plus the interest line |
| W13 | /pricing "What they cover" | drop roadmap and launch language |
| W14, W15 | /pricing FAQs | drop "next parts of the platform" and "plan ahead and express interest" |
| W21 | /pricing bottom CTA | the interest line |
| W22 | coach FAQs, W29, W35 | "bring your team in with everything you've built" becomes "you won't be charged again" while the move is partial |
| W23, W25, W30 | /for-clubs | "in development", "finishing its final workflows", the interest line |
| W35, W36 | /for-leagues | Coaches Portal cross-sell reads the Premium gate; the interest line |
| W39, W40 | home | "in active development" and "In development" |
| W43 | /start description | no "start free", no doors that are not shown |
| W50, W54 | /start/club, /start/league | the consultative page is gone; "League" becomes "League Plus" |
| W56 | the interest form | every "early access" |
| W63 | the footer | the "Built for" column (the Leagues and Clubs pages are unreachable from it today) |
| W64 | page titles and descriptions | search titles for /for-leagues, /for-clubs, /pricing |
| W72 | /pricing FAQs | three answers that describe customers we do not have |
| W73 | /for-coaches, /pricing, /for-tournament-organizers | "Free right now" on the Premium card; "Start Tournament Plus free" |
| W74 | /for-leagues | "8am" becomes "8:00 a.m." |

**In code (S1, built 2026-11-18; walk `CLUB_ON_SALE_S1_WALK.html`):** every row above — W6, W8, W10, W11, W12, W13, W14,
W15, W21, W22 (and its twins on /for-coaches, W29, W35), W23, W25, W30, W35, W36, W39, W40, W43, W50, W54, W56, W63
(footer column only), W64, W72, W73, W74 — plus Ask 6 (the consent box opens unticked). The availability words come from
the helpers in `lib/plan-config.ts` (`gatedPlanTag`, `gatedPlanSentence`, `GATED_PLAN_INTEREST_LINE`,
`closedProgramPlansSentence`, and S1's `interestButtonLabel`, `closedPlansGroupTag`, `availableNowSentence`,
`PLAN_AVAILABLE_NOW`); no page types them (`tests/unit/public-plan-availability-guard.test.ts`). Where the build had to
choose (each is a small reading of a ruled line, flagged for the owner, not a new ruling):
- **W72 sports:** `/marketing` found the code offers softball and baseball only (`lib/sports.ts` `OFFERED_SPORT_IDS`); the
  answer is `/marketing`'s corrected sentence, with the sport names read from that list so it grows with it.
- **W73 Tournament Plus:** the button is "Start Tournament Plus"; the card carries `planTrialLine()` (the one trial
  sentence, renamed plan-neutral; `clubTrialLine()` stays as Club's name for it) with checkout's length. Because it is one
  sentence, **Ask 8's tax clause now reads on every plan that states a trial, Tournament Plus included**, and on the
  in-product billing page's trial line. `/strategy` logged that as noted, not ruled: an owner yes.
- **W6 strip, both plans closed:** each name carries its status in the parentheses with its price, "League Plus (Not
  open yet, …/mo) · Club (Coming soon, …/mo)".
- **W23 and the /for-coaches closed note:** "{tag} — it isn't open for sign-up yet." (the sentence's own words after the
  tag, so the tag is not said twice).
- **W50 / W54 sub-lines:** the tag lowercased after the name ("Club — coming soon", "League Plus — not open yet").

**In code (S2, built 2026-11-19; the doors, open state):** W43 open (the `/start` description names only the doors on
sale), W44, W45, W46, W47, W48, W49, W51, W52, W53, and the interest line's new sentence (`{interestLine}`, owner ruling
2026-11-19) everywhere it is read, the interest window's intro included. Where the build had to choose (each a small
reading of a ruled line or a gap the copy doc left, flagged for the owner and `/marketing`, not a new ruling):
- **The availability line (Ask 15)** is the ruled sentence from `BUSINESS_DECISIONS.md` (Ask 9), "Available to
  organizations in Canada, outside Québec for now. Prices are in Canadian dollars.", set as step 1's small print on both
  paid doors (where the free league's small print sat), not the drawing's filled box: the kit retired tinted panels.
  `/legal` proposed "For organizations in Canada, …"; the ruled spelling was kept, one spelling everywhere.
- **W48 / W53 the Terms sentence:** `/legal` (S2 review 1(c)) added one sentence above each paid button, "You’re starting
  this plan for {name}, and you confirm you’re allowed to agree to the Terms on its behalf.", because step 1's tick is
  made before the club has a name. Not in the drawings.
- **A returning customer's plan step:** no trial sentence; the shipped "You’ve had a subscription before, so there’s no
  second trial. The full charge, plus applicable taxes, is due today at checkout." instead (the tax clause added by
  `/accounting`, 2026-11-19; the same line in the in-product plan-change window gains it too), and the button reads "Start Club" (not "Start your
  Club trial").
- **W52 placeholder:** the copy doc's "e.g. Milton Minor Softball" (the league door's existing one), not the drawing's
  "e.g. Riverside House League".
- **The wait ("Setting up your club / league")** — words the copy doc does not carry, taken from the drawing and the
  shipped Coaches Portal return: "Setting up your club" · "Payment received. This takes a few seconds."; after ~50 s
  "Still setting up your club" · "Payment received. Please don’t start another payment. Check again in a minute." ·
  Check again; with no payment behind the page, at once, "We can’t find that payment" · "If you’ve just paid, your club
  is being set up. Otherwise, choose a plan to finish starting it." · Choose a plan. → `/marketing` to confirm.
- **A door closed after the club was made:** the plan step says "Club isn’t open for sign-up right now. {name} is saved,
  and you can come back to this step." → `/marketing` to confirm.
- **The billing address screen's intro** says "your club" on the league door too: it is the shipped sentence every
  organization reads on that screen, Run a tournament's included, left as shipped.
- **Not in S2 (S3's, already planned):** the League Plus pricing card still reads "Start free" and "No credit card
  required" while it now opens the League Plus start when open; S3 writes that card's trial-and-payment sentence.

---

## Rules checked

- Full plan names throughout: Tournament, Tournament Plus, League Plus, Club, Club · Association, Premium Coaches Portal. No old free-plan name, no "Large", no "Pro".
- No "early access" in any proposed customer wording (the only appearances are quoted as today's words). No "free" next to a trial. No trial length typed anywhere; the number always comes from config.
- No "unlock", "powerful", "robust", "seamlessly", "streamline", "intuitive".
- One spelling: "house league" (no hyphen), "organization", "payment method". No times appear.
- No price typed: every price is a `{...}` placeholder. The tax words are `{plusTax}` only.

## Noticed, not in scope

- `lib/plan-config.ts` gives Tournament Plus `trialDays: 14` while the canon says Tournament Plus has no advertised trial; `PlanTermsLine` already reads it as "if your plan starts with a trial". Worth a `/billing` check; not touched here.
- The `/for-clubs` Included list comes from `PLAN_ARTICLE_CONTENT.club`, and the drift table says Club's Included list says "Everything in League" and leaves out Families. Not edited; `/strategy` and `/marketing` fix when Club is read for its open state.

## Owner asks

1. **League Plus gets the same trial-and-payment sentence as Club, and the canon exception names League Plus and Club · Association.** (W1, section A.) The words are already settled by shape; the ban at `PRICING_PAGE_COPY.md` ~351-358 and the Club-only "where" list are what must change. **Recommend yes.** The alternative is to keep saying "No credit card required" on League Plus, which would be false at checkout.
2. **Keep a "more than 30 teams" line, worded as an email for a quote, never "talk to us".** (W5, W20.) It is a custom-quote path above the top band, which Facts already has, not Club's door; the ruling stays intact. **Recommend yes**, one quiet line on the Club · Association card and in the "Which Club plan do I need?" FAQ, not a button and not the interest form.
3. **The strip's tag.** (W6.) The brief wants Club on "Coming soon", and canon ~266 sets "Not open yet" as the strip heading. **Recommend per-plan status** after each plan's name, and one group tag only when both are closed.
4. **The two new button labels:** "Start your League Plus trial" and "Start your Club · Association trial" (long on a narrow card). (W2, W4.) **Recommend as written**, with "Start your trial" as the fallback if `/design` says the long one does not fit.
5. **The chooser's tag on the paid cards:** "Paid plan". (W44, W45.) The existing League card says "Free", which would be false. Alternatives are no tag (a surprise at step 3) or a price (the 2026-08-07 ruling keeps prices off the top-of-funnel cards). **Recommend "Paid plan".**
6. **The Club plan step's heading is a question about team count** ("How many teams does your club run?") rather than the tournament door's "How do you want to start?". (W48.) **Recommend the team-count question**: it is the one thing that decides between the two cards.
7. **The home page's open badge for League Plus and Club is "Available now"**, with no price and no "free". (W41.) **Recommend yes.**
8. **Remove the /pricing "what they cover" section while both plans are open.** (W13.) Its only job is closed plans. **Recommend removing it**, and carrying the one useful piece (which Club plan) in the new FAQ (W20).
9. **/for-clubs' demo block keeps only the coach's-season link, reworded; no tournament link and no club-demo promise.** (W24.) Matches the readiness plan's recommendation and the 2026-11-18 ruling. **Recommend yes.**
10. **The "bring your team in with everything you've built" promise.** (W22, W29, W35.) Today's closed pages already make it, and Facts says not to until the coach-into-Club move is built. **Recommend:** change the closed words now (to "won't be charged again"), and put the full promise back at the flip only if Club readiness Stage 2 (migration 313) reaches production with the release.
11. **Open /pricing and /for-leagues bridge cards use a trial-naming button with the sentence on the card** (W11, W12), rather than a link-out button. **Recommend as written**: it keeps the page's one verbatim sentence beside every button that names a trial.

### Asks from the audience review (2026-11-18, section M)

These are numbered on the plan and on the drawings' "Your calls" tab as **Asks 21 to 34**; they are not renumbered here.
The wording calls inside them, from `/marketing`: whether "How the trial works" may exist beyond the one-sentence rule
(Ask 27); band 2's line and labels (Ask 21); "I run…" against "I'm…" on the middle door's two links, "Built for" as the
footer heading, and "House leagues" in the footer while the bar says "Leagues" (Ask 25); "Basic Coaches Portal" on the
coaches band (Ask 21); the heading "What each person at your club gets" (Ask 28).

## Handoffs

- **From the audience review (section M), once the owner accepts:**
  - `/marketing` writes the accepted lines into `PRICING_PAGE_COPY.md` and amends: ~284 and ~289-291 (the trial sentence's
    "where" notes), ~351-358 (the one-exception paragraph names "How the trial works" as a second place), ~338
    ("organization" is never a volunteer's word: "club" or "league" in every section M line), ~306-310 (price rows inside
    the home page's pricing section are not persona cards), ~262-267 (the home price rows join "where it applies"),
    ~331-332 ("Start Free — No Credit Card" on the bridge is superseded by W73; W62 replaces the hero's "Start free"),
    ~363-368 ("Basic Coaches Portal" on the coaches band); and one sentence in `BRAND_STRATEGY.md` ~253-257 recording
    the band labels as how the peer rule shows on /pricing.
  - `/strategy` logs, as Decided only on the owner's yes: the three audience bands and the home page as a router
    (supersedes the grid, picker-order and nav-order clauses of the 2026-08-08 "live products lead" entry in the design
    log, whose reason ends when all six plans are on sale; its second rule, that no surface hand-writes availability,
    stays); which card leads the pricing page (Ask 32); Tournament Plus's trial (Ask 31). It also trues up the Facts doc
    (plan "Found outside this build").
  - `/design` amends the 2026-08-08 and 2026-05-24 design-log entries to match.
  - `/billing`: Tournament Plus's trial, said or switched off (Ask 31).
  - `/legal`: the data terms published with the release, or the by-hand "full copy" procedure confirmed (Ask 29).
  - `/demos`: the eight pictures join the per-release-cycle pass (Ask 26).
- **`/strategy`:** (a) record League Plus's trial terms in the Facts doc and log the owner's ruling on ask 1 (the 2026-11-18 entry says "as configured" but nothing records the length, the payment method or the sentence); (b) log the "more than 30 teams" quote path (ask 2) so it is not later read as the "talk to us" framing; (c) the Facts "Purchasable today?" rows change at the flip, as the runbook says; (d) the Facts "Coach bridge" line becomes a product fact only when Stage 2 reaches production (ask 10).
- **`/marketing` (main session, after the owner accepts):** write each accepted line into `PRICING_PAGE_COPY.md`, and amend ~284, ~289-291 and ~351-358 for League Plus and Club · Association. `PRICING_PAGE_COPY.md` ~378 ("hold band prices until the early-access cohort opens") and the Club $179 cards are already stale (the runbook's drift table); fix in the same pass.
- **`/legal`:** (a) the trial-and-payment promises on the League Plus and Club · Association pages and plan steps (the sentence, `PlanTermsLine` above each button, "returning customers get no trial"); (b) the interest window's saved line, which promises an email that is sent by hand, and the consent checkbox (unchanged here; do not edit without them); (c) "no setup fees" with nothing promised about setup, under an open launch.
- **`/billing`:** a plan-neutral name for `clubTrialLine` (it already takes the length), League Plus's length passed from the same source checkout uses; every page reads the live gate per plan (S1); the cap prompt and the onboarding first paint stop reading the code value.
- **`/design`:** six cards (Tournament, Tournament Plus, League Plus, Club, Club · Association, Premium Coaches Portal) in the grid; where the trial sentence sits in the annual view (W7); the Club · Association button's width; the chooser tag style for "Paid plan"; the cap prompt's arrow.
- **`/plan`:** S2 and S3 map straight onto these ids (S2: W44-W54; S3: sections B-H and K; S1: the "Closed words that change" table). The new start-door key names (club, League Plus) and their Home waiting cards (W49, W53) are for the build.
- **`/docs`:** help articles for starting a club and starting a League Plus league follow the build (new customer flow).
- **`/demos`:** nothing now (ruled: no club demo for launch).
