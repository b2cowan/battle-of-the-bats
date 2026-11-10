# PM Brief — Prospect Demo Program (a house-league admin, then his president)

> Plan: `PROSPECT_DEMO_PROGRAM_PLAN.md` · Created 2026-11-09

**What it does:** Gets a real club, with 17 rep teams, a tournament and a house league run on TeamSnap, to join as a free
first-year beta. Two demos run on the staging site in a club built from their own structure. First the house-league
administrator, signed in as himself, then the president. Before the president demo, the product's family gaps get
closed.

**Why it matters:** The admin has to want this before the president will look. His pain is the season's paperwork:
- registration in one tool and the money in another
- schedules built by hand
- rainouts handled game by game
- reporting to the president by email and Excel

The president's question is different: how does the club reach its families? Today house-league parents get email only,
a postponed game vanishes from their schedule, and house-league coaches can't post to their team.

**Who benefits:** House-league admins and registrars (Demo 1), presidents and club owners (the season snapshot), and
parents and house-league coaches (phone alerts, coach posts, In / Out / Maybe). The features follow existing plan gates:
house league on League and above, the club picture on Club.

**Expected impact:**
- **Demo 1:** the prospect registers a pretend child on his own phone and pays with a test card. He then drafts, places,
  schedules and rains out that same child, and gets each email on his phone. The president sees the league on the club
  home without being sent anything.
- **Demo 2:** parents install the app from a QR code, join their child's team, and get a phone alert when the schedule
  goes up or a game is rained out. A postponed game says "new date to come", the coach can post to the team, and parents
  answer In / Out / Maybe.
- **Separately:** a decision sheet on sibling pricing, discounts and payment plans, for house-league registration and
  tournament entry.

**Priority:** High. It's the first club-tier beta, and Demo 1's builds are small. Online payments being test-only is the
largest dependency for the beta itself, not for the demos.

**Success criteria:**
- The admin finishes Demo 1 saying it beats TeamSnap for running his season and agrees to bring it to the president.
- The president demo shows no gap without an answer: built, or shown as a drawing with "next".
- The club signs on as a beta.
- A clear ruling on payment options, so the beta's registration doesn't stall on discounts or payment plans.
