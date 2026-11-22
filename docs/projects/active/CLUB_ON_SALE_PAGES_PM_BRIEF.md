# The on-sale pages — PM brief

**Status:** on the board (project "Club release"). **Plan:** `CLUB_ON_SALE_PAGES_PLAN.md`. **Drawings:**
https://claude.ai/artifact/CJ39nz8YunjGxRViXtQ3K7 (source `CLUB_ON_SALE_PAGES_DRAWINGS.html`). **Words:**
`CLUB_ON_SALE_COPY.md` (draft for ruling).

## What it is

Club, Club · Association and League Plus go on sale together at the Club release. Today the public pages about them are
typed in and never look at the on-sale switch, and nothing lets a visitor actually start one of these plans. This build
makes every page follow the switch and gives each plan a real way to buy. Closed, the pages look as they do today. Open,
a visitor can start a trial in a few minutes.

## Why it matters

The Club release is defined as "a club can sign up, pay us and start". Without this build, flipping the switch would:
- show "Coming soon" and "Express interest" on plans that are for sale;
- send the Club button to the tournament sign-up, which makes the wrong kind of organization;
- show no Club · Association card at all;
- tell League Plus buyers "No credit card required" over a trial that takes a payment method.

Because most of the pages are built once at deploy time, the flip would not even reach them until the next release.

## What a visitor sees after the flip

- **Pricing, home, the Clubs and Leagues pages:**
  - Club, Club · Association and League Plus as real plans, each with its price, "plus applicable taxes", one trial sentence and a "Start your … trial" button.
  - The interest form and the "Not open yet" sections disappear.
  - One line says the plans are available in Canada, outside Québec, in Canadian dollars.
- **A Club start:** account → club name → choose Club or Club · Association → billing address → payment → "Setting up your club" → the club setup kit.
- **A League Plus start:** the same, with one plan.
- **Inside the product:**
  - A free Tournament organization can start any of the three plans from Plan & billing.
  - A paying Tournament Plus organization can move to League Plus.
  - The house-league cap prompt opens a real upgrade.
- **People who expressed interest** get one last "it's open" email, sent by hand. It goes only to recent people who ticked the box.

## Added by the audience review (18 Nov): making the pages sell

The first pass made the pages true. A second pass the same day walked every public page as each buyer and asked whether
it would make them start. It is folded into this build, not a separate project. What a visitor sees on top of the above:

- **Pricing groups plans by who buys them.** Three bands: running a tournament, running a league or a club, coaching one
  team. League Plus, Club and Club · Association sit side by side, each labelled by what a club runs. The free Coaches
  Portal gets a place beside Premium for the first time.
- **The home page sends each visitor to their page.** Three doors instead of two cards and a "roadmap" row, and three
  short price rows instead of six plan cards.
- **A league or club buyer can see the product.** The Leagues and Clubs pages show the product's own screens, from a
  fictional club. These two plans have no demo, and today no marketing page has a picture.
- **The trial is explained.** Four steps on what happens to the payment method, including the email before it ends.
- **The Clubs page speaks to the whole board.** The treasurer and the registrar are on it, with a section on what each
  person at the club gets.
- **A board's questions are answered on the page.** Switching mid-season, a change of treasurer, families' information
  (including that it is stored in the United States), and stopping.
- **Lines that are not true today are fixed at the next promote:** three pricing answers that describe customers we do
  not have, "Free right now" on the paid Premium card, and "Start Tournament Plus free" over a checkout that takes a
  payment method.

**Why it matters:** the release is aimed at the club that runs house league and rep teams together, bought by a volunteer
board. Today's pages give that board nothing to look at, nothing for its treasurer, and no answers to take to a meeting.

**What it was not allowed to promise** (the product or the policies do not back it): families paying online, a
president's summary, bringing an existing season in from a spreadsheet, "export everything", storage in Canada, any
customer count or quote.

## Who can do what

Buying stays with the organization's owner. A signed-in person who already runs an organization, and presses a Club
button, lands on that organization's Plan & billing; a Premium coach gets the existing "Start your club". No one ends up
with a second organization.

## Priority and order

Five sessions, ordered by dependency and rework risk:
1. **S1:** the pages follow the switch, with no visible change while closed apart from the lines that are wrong today.
2. **S2:** the Club and League Plus starts. This is the riskiest part: money and accounts.
3. **S3:** the pages' open words and cards, now including the three bands, the home page doors and price rows, the nav
   order and the trial steps. These are pieces S3 rebuilds anyway, so they are built once in their final shape.
4. **S3b:** the selling sections (the pictures, the board section, the board's questions, the rebalanced Clubs page, the
   paths between audiences). **It does not hold the flip**: your 17 Nov ruling puts marketing after the launch, so it can
   ship before the flip or after it.
5. **S4:** buying from inside the product. It gets its own drawings first. **Drawn 21 Nov**
   (https://claude.ai/artifact/5axLqJjfLTuT42Hm589H2y). What changes for a customer: a free Tournament organization can
   start League Plus, Club or Club · Association from Plan & billing (three more rows in the table it already has, each
   only while its plan is on sale, "Coming soon" otherwise); a paying Tournament Plus organization can move to League
   Plus (proved impossible today); a free-time organization can start the plans above its gift; every start offers
   monthly or yearly and says its true trial; coming back from Stripe waits until the plan has really changed; someone
   who left Stripe halfway finds their start waiting. **Why it matters:** at the flip the public pages send every
   signed-in owner to their Plan & billing, so without S4 our existing customers meet a dead end; it is recommended as a
   launch item (call 42). **Success:** each start and move proved with a Stripe test purchase; nobody can pay twice for
   one start; a closed plan never shows a start. **Calls 35–46 ruled 21 Nov, all as recommended**: a free-time
   organization that stops a paid plan falls back to its free plan while its free time runs (call 40 A), and S4 is a
   launch item (call 42). **Built in four parts:** Parts 1–3 committed 21–22 Nov (the starts and the wait; the move to
   League Plus; free time falls back); Part 4 committed 22 Nov: if two tabs pay at once and a second
   subscription slips through, you get one email naming the club, both subscriptions and the charge, and staff cancel
   and refund it by hand; For Tournament Organizers' League Plus and Club cards end "Already running tournaments here?
   Start {plan} from Plan & billing." while that plan is on sale; the onboarding window names only plans an
   organization can reach (your re-ruling 22 Nov). Next: push dev so staging carries S4, then the one walk, §556.

Each session ships with the plans still closed. The flip itself is the runbook's job.

**Your calls:** 34 on the drawings' last tab, each with a recommendation (20 from the first pass, 14 from the audience
review; Ask 4 is replaced by Ask 21).

## Success looks like

- With the switch closed on production, every page reads as it does today, apart from the closed-word fixes.
- With it open on staging, a new visitor buys each plan end to end and lands in the right setup. The trial is right, the payment method is asked for, the tax shows on the price, and a returning customer is told there is no second trial before checkout.
- A free Tournament organization and a Founding Season Tournament Plus organization can each start Club from inside the product.
- Nothing on any public page says "Coming soon", "Express interest" or "early access" about a plan that is for sale.
- A club treasurer, a house league registrar and a coach each find their plan on the pricing page without reading the
  other two bands, and each of the Leagues and Clubs pages shows the product, explains the trial and answers the
  board's questions.
- No public page describes customers we do not have, or says "free" over a plan that takes a payment method.

## Before the flip (not this build)

- The Terms and Privacy are live on production, and a test purchase records the acceptance.
- The roughly $1 live purchase, with a printed-invoice check.
- Live Stripe steps.
- The Club test suite.
