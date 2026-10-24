# House league — Club Tier Stage 9 (PM brief)

> Deep dive walked and the first stage (9a) drawn 2026-10-24. Plan: `HOUSE_LEAGUE_STAGE9_PLAN.md`. Hub: the House League
> Deep Dive artifact (source `HOUSE_LEAGUE_STAGE9_HUB.html`).

## What this is

House league is a club's biggest program and its biggest source of money, and it is the least finished part of the
product. Stage 9 makes it something a volunteer convenor can run for a whole season, from either a desk or a phone. It also
gets sign-ups and money ready for online payment, which is the stage after this one.

## What we found

- **A club admin can open every house-league screen but can't save anything.** Only the owner and the league admin can.
- **The season's money is wrong.** The season's money page reports nothing owing even when most families haven't paid.
  A family that paid and was then declined disappears from the books. Changing the fee mid-season changes what every
  family owes, including families who already paid. None of the fees reach the club's Budget vs. Actual statement.
- **Sign-ups don't follow their own dates.** A season can say "Registration closes August 1" and still take sign-ups in
  October. There is no consent-to-email box, a family with two children fills in the form twice, and two families
  signing up at the same moment can both get the last spot.
- **Families hear almost nothing during the season.** A rainout, a moved game or a team placement sends no message. The
  public schedule doesn't say where a game is, hides cancelled games, and shows postponed games as if they're still on.
- **It's hard to get around.** The season's own home and its money page aren't in the menu. On a phone there's no way to
  move between a season's pages, and the convenor can't approve a sign-up at all, because those buttons are off the
  edge of the screen.
- **Whole jobs are missing:** player ratings for balanced teams, coaches as real people with their own view, copying a
  season forward, a Withdraw button, and bulk approval.

## What changes, in stages

1. **9a · The frame.** One house-league home that leads with the seasons being played. A season's pages, including its
   money page, sit together in the menu and in a tab strip on a phone. A club admin can do what a league admin does.
   Every season status change asks first and says what changes for families.
2. **9b-1 · Sign-up.** The dates open and close the form. A price can be set per division, with an early-bird price. One
   form can register several children. The form asks for consent to email, and capacity can't be overfilled.
3. **9b-2 · Money.** Each child's price is fixed when they sign up, so a later change to the fee doesn't change it. Ending
   a paid registration asks whether the money was refunded. The money page's figures are right, and fees show on the
   club's statement. The places where a "Pay now" button will go are drawn in, ready for online payment.
4. **9c · Teams and people.** A simple player rating for balanced drafts, and, if approved, light accounts for coaches.
5. **9d · The schedule.** A real schedule generator. An honest public schedule. Families told about changes.
6. **9e · Game day.** Standings that follow the sport's scoring rules, and scores entered by coaches.
7. **9f · Season end.** Finishing a season, looking back at past seasons, and starting next season from this one.

## Who it affects

- **Convenors (league admins and club admins):** the main users. Club admins gain the ability to save.
- **Registrars:** the role question (Q17) gives them registrations, fees and family email.
- **Treasurers:** proposed to see the season's money page (they can't today).
- **Families:** a shorter sign-up for siblings, honest schedules, and change notices.

## Why it matters

House league is where a club's money and its families are. As long as the money figures are wrong, the club can't trust
its own books, and online payment would be built on top of them. As long as the frame is broken, every later fix lands
somewhere convenors can't find.

## Priority and success criteria

- 9a and both halves of 9b come before payments (Stage 12) is drawn.
- **Done means:**
  - a club admin can run a season end to end;
  - the season's money page and the club's statement agree to the cent;
  - no season takes a sign-up outside its own dates;
  - a convenor can approve a sign-up from a phone;
  - every live season shows on the club's public pages.

## Open decisions

Twenty-four questions are on the hub. Each has a recommendation, and the owner rules them by ticking. The biggest are:

- when a family pays;
- when the price is fixed;
- whether coaches get accounts;
- how fees appear on the statement.
