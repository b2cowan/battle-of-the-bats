# House league — Club Tier Stage 9 (PM brief)

> Deep dive walked and the first stage (9a) drawn 2026-10-24. Plan: `HOUSE_LEAGUE_STAGE9_PLAN.md`. Hub: the House League
> Deep Dive artifact (source `HOUSE_LEAGUE_STAGE9_HUB.html`).
>
> **Status 2026-10-25:** 9a built and walked (§372 ✅). **9b-1 built** (sign-up, payments-ready): a season is set up on its
> own page, families sign up several children at once and see each outcome first, a spot can only be taken once, and the
> form's dates run it. Four owner rulings in its build session (plan §0d), the biggest: a child's price is fixed the day
> they sign up. Owner walk §375 walked 50 of 51.
>
> **9b-2 built 2026-10-25 (money, honest).** The convenor and registrar see the money on every registration: what is owing
> and for how long since the child was accepted (amber after the club's own number of days), what was received, when and
> how, what was refunded or kept. Marking a fee received takes a date and how it was paid; ending a registration that has
> money asks whether it was refunded (recorded as money going back, never erased) or kept with a reason; a price can be
> corrected with a reason; moving a child can re-price them unless they've paid. The Registrations screen is rebuilt for
> desk and phone, with bulk actions that say plainly what didn't happen. The season's Money page is its book; Families and
> the family's status page read the same money; families can ask to withdraw a child; on the Club plan the fees show as one
> row on Budget vs. Actual with each season under it and a starting budget of size × price. Seven owner rulings in its
> build session (plan §0e). Owner walk §378 passed 2026-10-25 (51 of 51). Unblocks Stage 12b (online payment lands through the same money writer).
>
> **9c drawn 2026-10-25, asks open (teams and people).** Drawings: https://claude.ai/artifact/C56VdDqASJ4x53EoFWZjyk.
> The convenor rates each child from 1 to 5, runs a balanced draft per division, adjusts it, then publishes. Publishing
> tells every family their child's team and coach in one email per household, and gives each coach their own team page.
> The recommended coach page is one screen: the roster with family contacts, then the schedule and scores once those stages
> land. It is not the Coaches Portal. The family status page gains the team. **Ruled 2026-10-26, all fourteen asks as
> recommended**: the coach's own page; ratings seen only by those who run the league and erased when the season finishes;
> a coach's own child can be locked to their team before the draft; one email per family per division, sent now rather
> than waiting for 9d. The words are settled and the build prompt is written.
>
> **9c built 2026-10-26.** Teams & draft is rebuilt: rate players, lock a coach's child, run a balanced draft, adjust,
> publish one division at a time. Each family gets one email (even if they unsubscribed from club news, because it is about
> their own child), sees the team and coach on their status page, and each coach is invited to a page of their own with
> their players and how to reach each family, never the Coaches Portal. The registrar reads the board but never a rating.
> Draft mode and Randomize are gone. Owner walk §381 passed 2026-10-26 (42 of 42); 9c is closed.
>
> **9d split in two (owner, 2026-10-26).** 9d-1 gives the club one place to email families: a season's email moves into the
> Families window, already set to that season, with a choice of division, team, status or picked families; each season
> gets its own three sends a day, and automatic notices never count. 9d-2 is the schedule. The email comes first because
> the schedule's change notices go out through it. The 9d-1 drawing prompt is written.
>
> **9d-1 drawn 2026-10-26, asks open.** Drawings: https://claude.ai/artifact/Xy8ENL1KbUZVbWpDthD9EB. A convenor or
> registrar emails a season from the same window the club uses for Families, opened from the season. It lists only that
> season's families and counts them as families, so siblings get one email, not one each. Each season shows how many of
> its three emails are left, and its own sent history: typed sends, the team-publishing notices, and the old sends,
> marked as counted per child. Recommended: the season's door never needs Families access, so an admin or registrar loses
> nothing. It reaches every season status, including Registration closed and finished seasons. A message to one family
> doesn't count, matching the club. **Ruled 2026-10-26, all twelve as recommended**; the limit is any 24 hours, the same
> as the club's. The build prompt is written; the words go through /marketing at the start of the build, before any code.
>
> **9d-1 built 2026-10-26; walk owed.** One email window for a season: from its Email families page (now the list of what
> went) or from Registrations, a convenor or registrar picks the whole season, a division, a team, a status or the families
> they ticked, and each family gets one email. Each season has its own three emails in any 24 hours, apart from the club's;
> a message to one family and the Publish teams emails never count. A stopped email can be finished for the families it
> missed. The owner ruled during the build that "everyone in a season" means families with an active child, from Families
> too. The walk is the next step.

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
4. **9c · Teams and people.** A simple player rating for balanced drafts; light accounts for coaches (ruled Q7), recommended
   as a one-screen team page of their own; Publish teams tells families their child's team and coach; the status page shows
   the team. Success: a convenor can build and publish a division's teams from a phone, every family hears once per
   publish, and no coach sees another team, a rating or a fee.
5. **9d-1 · One email composer.** A season's family email moves into the Families window, already set to the season, with
   division, team, status and picked-family choices, its own three sends a day, and its own sent history. The old
   Notifications page and "Message registrants" window go. Success: one place to email families, and a registrar can still
   email a season without seeing the club's Families book.
6. **9d-2 · The schedule.** A real schedule generator. An honest public schedule. Families told about changes.
7. **9e · Game day.** Standings that follow the sport's scoring rules, and scores entered by coaches.
8. **9f · Season end.** Finishing a season, looking back at past seasons, and starting next season from this one.

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
