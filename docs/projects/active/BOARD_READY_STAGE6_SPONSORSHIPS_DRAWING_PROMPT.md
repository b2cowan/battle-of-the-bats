# Board Ready · Stage 6, Sponsorships — design kickoff prompt

**Use this to start a NEW chat with `/design`.** This is a drawing session, not a build: no product code changes until
the drawing is ruled and a build prompt is written from it. Written 2026-11-20.

## Why this session exists

Sponsorship is item 7 of the eight things a club board asked for before it says yes, and the owner marked it important
(that is why it sits before camps). It has never been drawn. Every Board Ready stage gets its own drawing session,
`/design`, an Artifact at true size, before it is built (`BOARD_READY_PLAN.md` §4).

The owner also ruled on 2026-11-20 that **sponsors on the public tournament pages wait for this stage**: the tournament
side is drawn after this one, from what this one decides (its prompt, on hold: `PUBLIC_TOURNAMENT_SPONSORS_DESIGN_PROMPT.md`).
So this drawing has to settle two things the tournament side will build on: what a sponsorship says about **where the
sponsor's logo shows**, and **which plans show sponsors on a tournament**.

## Read first

- `BOARD_READY_PLAN.md`: §4 (shape), §5 "Stage 6 — Sponsorships" (the stage's own list), Stage 4 Forms (which this
  stage is built on) and Stage 5 Club events (which joins it later), §7b (the owner's order of 2026-11-20), and §9
  (gates and the tax shape, both accepted by the owner 2026-11-10).
- Stage 4's ruled drawing and its rulings.
- `BOARD_READY_PM_BRIEF.md`, and the Business Decisions Log entries of 2026-11-10 (Board Ready gates) and 2026-10-27
  ("One sponsor list per organization"), in `docs/agents/strategy/BUSINESS_DECISIONS.md`.
- `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` §7: the tournament side's ruled shape.
- **The shipped pieces this stage builds on.** Draw controls from the shipped component, never from memory
  (`feedback_draw_controls_from_shipped_component`):
  - The club's sponsor list on the public site editor (Club Tier Stage 4d): a name (the only required field), a logo, a
    link and an optional last day; at most 20; no tiers; an ended sponsor stays in the editor marked Ended. Shown in the
    Sponsors strip on the club home.
  - The tournament team pay link: the precedent for a page a business opens without an account.
  - The coach portal's sponsor invoice: the precedent for a sponsorship invoice. It carries no tax by ruling, because a
    team is not a registrant; a club can be, which is why §9 exists.
  - The club's books: where sponsorship income lands.
  - Club Tier Stage 12, families pay online: the card payment this stage reuses (its state is on the board).

## What is already ruled (do not re-open; if you disagree, argue from the reason)

1. **One sponsor list per organization, and each sponsor says where it shows:** the club site and/or chosen
   tournaments. A club adds a business once. A club sponsor is not automatically a tournament sponsor (2026-10-27).
2. **Sponsors follow branding's logic** on tournaments: the organization puts its sponsors there, or lets each
   tournament organizer put their own. An organizer not linked to a club gets its own sponsors section (2026-10-27).
3. **Gates (2026-11-10):** Stage 6 rides League Plus and both Club bands. Sponsor *display* stays with the public site.
   Tournament-only organizers get display only, not packages or deals. No pricing is restated here; see
   `docs/agents/strategy/PLAN_PRICING_FACTS.md`.
4. **Tax (2026-11-10, §9, accepted):** a club setting "registered for GST/HST" with its number, default **no tax**; a tax
   switch on each deal; the rate by province, never a hard-coded 13%; the deliverables listed on the invoice; and never
   the words "donation", "gift" or "tax receipt" (a sponsorship is not a gift).
5. **Team sponsorships in the Coaches Portal stay the team's** (2026-11-06). Not merged or moved.
6. **Live card payment waits on Club Tier Stage 12's production switch.** Everything up to the pay button can ship first.

## What the stage contains (the plan's list, to draw)

- **Packages:** name, price, what's included (a list of deliverables, for example logo on the site, a field banner, a
  jersey crest, a named division), how many are available, and an optional sponsorship document (PDF) to send.
- **Sponsors and deals:** a deal is a sponsor + a package + what it is attached to (the club · a house-league division ·
  a house-league team · a club event, once Stage 5 exists · a tournament) + an amount. States: Offered · Form received · Invoiced · Paid ·
  Delivered.
- **The sponsor link:** a page the business opens without an account. It shows the package, the club's sponsorship
  form (a Stage 4 form), a logo upload, then pay by card (the club is the merchant) or "we'll send a cheque / e-transfer", which the
  club records. A business is not a family, so the 2026-10-31 family-links rule does not apply.
- **The club's invoice** (PDF) and receipt, under the tax shape above.
- **The delivery checklist:** each deliverable ticked as it is delivered.
- **The paid deal feeds the one sponsor list**, so the logo shows where the deal says.
- **Renewal:** "Offer again" from last year's deals.

## Where this stage sits (owner order, 2026-11-20)

The owner set the order on 2026-11-20 (`BOARD_READY_PLAN.md` §7b): **custom forms (Stage 4) first, then this stage
built on it**, then club events (Stage 5). So:

- **The sponsor link's questions are a Stage 4 club form**: the club's own sponsorship form, built with the same editor
  and the same question types, with the document block for the sponsorship PDF. Draw from Stage 4's ruled drawing
  (its record is in `BOARD_READY_PLAN.md` Stage 4 and `BOARD_READY_PROMPTS_INDEX.md`); if it has not been ruled yet,
  stop and say so rather than drawing a form of your own. Decide only what the sponsorship form starts with (the
  business's contact, the name as it should appear, the address for the invoice, the logo) and which of those the
  club can't remove.
- **"A club event" is not drawn as a choice yet.** Club events come after this stage. Draw the deal's "attached to" so
  a fifth choice can join it later without a change to the deal; the other four (the club, a house-league division,
  a house-league team, a tournament) are drawn now.
- This drawing can run while Stage 4 is being built; this stage's build waits for Stage 4's.

## What still has to be decided, by the end of the session

1. **Which plans show sponsors on a tournament** (owed since 2026-10-27; tied to this stage on 2026-11-10). Route it to
   `/strategy`. The lean in the tournament plan is to follow the Tournament Plus branding gate: a free event cannot show
   even its own host's logo, so its editor would show sponsors locked and name the plan that has them.
2. **Who pays the card fee on a sponsor's card payment** (open since 2026-11-10). The families-pay default doesn't fit a
   business. Route it to `/strategy`; if FieldLogicHQ takes any fee on the payment, `/accounting` reviews it too.
3. **Where the logo shows, as one choice.** A paid deal's "attached to" and the sponsor list's "where it shows" must be
   **the same choice**, not two. Settle how a deal attached to a division, a team or an event shows the logo, since
   the list today only knows the club site. The tournament side will build on this.
4. **The words of each state**, from Offered to Delivered, and what the club does next at each.

## The stations to draw (desktop and phone, true size, in the house layout)

- **A.** Packages: the list, a new package, and what a full package (sold out) looks like.
- **B.** Deals: the list of this season's deals by state, and one deal's own page (sponsor, package, what it is
  attached to, the amount, the tax switch, the state, the delivery checklist).
- **C.** Offering a deal: from choosing the business to the sponsor link going out, plus the email the business gets.
- **D.** The sponsor link, as the business sees it: package, questions, logo, pay or "we'll send a cheque / e-transfer",
  and the page after. Before Stage 12 is switched on in production, the card choice is absent rather than broken.
- **E.** The club's invoice and receipt, with and without tax (a registered club and an unregistered one).
- **F.** Recording a cheque or e-transfer, and what the club books show afterwards.
- **G.** The deal feeding the sponsor list: what the club's sponsor list shows for a sponsor who came from a deal, and
  one who was typed in by hand.
- **H.** Renewal: "Offer again" from last year's deals.
- **I.** The empty state: a club with no packages yet, and what it sees first.

## How to run it

- **Mockups are a Claude Artifact HTML page**, never the canvas, in the house layout (sticky tabs, *Everything* /
  *Show only what differs*), whole-screen at true size (`feedback_mockups_as_claude_artifacts`). The coach portal's
  written formatting rules are the benchmark (`feedback_portal_is_the_formatting_benchmark`); money figures sit in one
  joined band, and on a phone they are rows (`feedback_money_figures_one_joined_band`, `feedback_phone_figures_are_rows`).
  Every highlight is clickable (`feedback_clickable_design_annotations`). Read the UI conventions in memory before
  drawing any control, window, list or export.
- **Run `/design` on the mockup before it goes to the owner** (`feedback_always_run_design_on_mockups`).
- **`/legal` before hand-off, not after** (CLAUDE.md): the sponsor link collects a business's details and a logo, the
  offer goes out by email (a commercial message to a business is still under CASL), and the club's invoice says what
  was supplied. `/legal` checks the link, the offer email and the invoice words.
- **The club's tax is product work, not `/accounting`'s** (its charter is FieldLogicHQ's own books): use the §9 shape.
  `/accounting` comes in only if FieldLogicHQ charges, collects or records something on the payment.
- **Words:** draft them in the drawing; `/marketing` confirms them after the ruling. One spelling everywhere
  (`npm run check:spelling`); "cheque" and "e-transfer" as written.
- **End with the asks**, ranked by how much they change, each with a recommendation, in a paste-back block on the page.
  Record the rulings in `BOARD_READY_PLAN.md` (Stage 6 and §7b), log the two gate calls through `/strategy`, change the
  Board Ready board line in the same commit, and update the tournament sponsors prompt with what this stage decided.
  Then write the build prompt.

## Out of scope

- Sponsors on the public tournament pages (drawn next, from this stage's rulings).
- Camps and clinics (Stage 7), the forms builder itself (Stage 4), and club events themselves (Stage 5).
- The coach portal's team sponsorships (they stay the team's).
- Switching live card payments on in production (Club Tier Stage 12).
