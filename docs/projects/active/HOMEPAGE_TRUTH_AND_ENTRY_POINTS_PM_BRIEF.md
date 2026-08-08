# PM Brief — the homepage stops contradicting the product

**One line:** your homepage was the last place on the internet still saying the Coaches Portal
wasn't ready — two weeks after it launched and started taking customers.

**Status:** built, awaiting owner QA. Plan: `HOMEPAGE_TRUTH_AND_ENTRY_POINTS_PLAN.md`.

---

## Why this matters

The Premium Coaches Portal went live on production on **24 July**. Your coaches page, your signup
chooser and your pricing page all say so. Your **homepage** — the page almost everyone sees first —
kept the Coaches Portal card greyed out and labelled *"Coming soon · express interest."*

Anyone who landed on the homepage and was coaching a team was told the product didn't exist yet.
Some of them left. We will never know how many, because the page did its job perfectly — it just
told them the wrong thing.

The cause is worth knowing because it will happen again otherwise: every other page **asks** the
product whether the Coaches Portal is on sale. The homepage had the answer typed into it by hand, so
when the product launched, three pages changed and one didn't.

**It now asks like the others.** The next launch, or pause, moves every surface together.

---

## What a visitor sees differently

**On the homepage.** The Coaches Portal card is live — full colour, an active link, and the badge
**"Free to start · no credit card"**, exactly matching the Tournament card beside it. League Plus and
Club still say "coming soon", because they still are.

**On both persona pages.** The green button now reads **"Start free"** on each. Previously the
tournament page said "Start Free — No Credit Card" and the coaches page said "Start free", which made
one product look like two. The credit-card reassurance hasn't gone anywhere — it's in the line above
the button and again in the trust list below.

**On the signup chooser.** Two cards now, not three: *Run a tournament* and *Coach a team*. The
invitation option moved below a dividing line as a quiet aside:

> **Joining a club or team you were invited to?**
> Create an account with the email address the invitation was sent to — it'll be waiting for you.

The cards are things you decide to build. An invitation already exists with your name on it — that's
not a decision, and listing it as one made people read three options and rule two out. The new
wording also answers the only question an invitee actually has: *which email address do I use?*

---

## Deliberate decisions worth knowing about

**No price on the homepage.** The badge says the Coaches Portal is free to start, and does **not**
say "$29 from January". Three reasons: putting a future price on the *Tournament* card would be
false (that plan is free permanently, not a promotion); a free Basic Coaches Portal exists and never
expires, so "$29" overstates what coaching with you costs; and the Founding Season's own goal — your
ratified one — is feedback volume, not revenue. A price on the first page a stranger sees trades
against that. The $29 and the January date still appear one click later, where there's room to
explain a promotion properly.

**The card order is unchanged.** Your two buyable products currently sit first and last, with two
that aren't for sale between them. Worth reconsidering — but that's a change to your homepage's
hierarchy and it shouldn't ride along inside a fix to a factual error. **Your call, still open.**

**The demos stayed out of this.** Which brings us to the thing you should know:

---

## The bigger finding: the demos aren't real yet

Neither demo exists on your production site. Not the fictional clubs, not the seeded tournaments,
not the links. They exist only on the development machine. A note in the project instructions said
otherwise; it's now corrected.

So making them public isn't a switch — it's three things: create the fictional clubs on production,
make sure the tournament actually keeps replaying and re-dating there, and turn on the links. And it
puts a shared no-login session that any stranger can walk into onto your live system.

**That decision is untouched and waiting for you.** Everything above ships without it.

---

## How to test it

1. Open the homepage. The **Coaches Portal** card should be full colour and read *"Free to start ·
   no credit card"*. League Plus and Club should still say "coming soon".
2. Click the card — you should land on the coaches page.
3. Open both persona pages. Each green button should read **"Start free"** and nothing else. Check
   the tournament page still reassures you about credit cards above and below the button.
4. Open the signup chooser on a phone. Expect **two** cards, then a line, then the invitation
   message — and confirm you can see the invitation **without scrolling**.
5. Click through the invitation link: it should take you to account creation, not to creating a club.

(Note: on your development machine you'll also see a "Start a league season" card. That's the League
beta flag, which is off in production — correct behaviour, not a bug.)

---

## Success criteria

- No page in the product disagrees with another about what is for sale.
- A coach arriving on the homepage is told the truth about the Coaches Portal.
- Someone who was invited to a club can find their way in without reading past two things they
  don't want.
- The next time a product launches or pauses, the homepage moves with everything else on its own.
