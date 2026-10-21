# The first look — PM brief

**What it is.** An end-to-end review of every screen a new customer passes through on the way in: the buttons on the
marketing site, the four ways to start something, the account form, the email and the wait, signing in, and the first
screen inside. Walked on a phone, a computer and a laptop on 2026-10-19; the proposed end state is drawn on the hub.
Plan: `FIRST_LOOK_SIGNUP_PLAN.md`.

**Where it stands (2026-10-20).** Stage 1, *one account step*, is built in four parts. Every door asks for the account
with the same form, heading and "Create account". Coach Premium looks like the other doors, and the coach join page
sits in the app. The top bar reads in sentence case with a "Get started" menu. Every "Coach a team" leads to Coach
Premium while the Founding Season runs, the coach demo's button included. An account set to Dark stays dark through
the whole sign-up. Your walk is §348 (https://claude.ai/artifact/RtyhSgLER7LmhxtvAsFFCC); it ends with four small calls.
Stage 2, *the wait and the way back* (the two emails, sign-in, the Continue page, forgot and reset), is built, and your
walk §351 passed. Stage 3, *the first screen inside*, is built (2026-10-20). A new organizer's plan step is one heading
and two choices, with their pricing-page pick (paid or free) already chosen and named. A Founding Season coach's welcome
gives the dates once, and a paid coach waits on the same card after Stripe. A checkout page opened without a payment
says so at once, and a fan's empty Home has a line to start something. Your walk is §355
(https://claude.ai/artifact/BibiAY5Yt5GkutCfpW3WU9); three of its walks need staging. Stage 4 is reported, not drawn.

**Why it matters.** For most customers this is the product. Account-First Sign-up fixed *what* each sign-up asks and
*when*; the walk shows the *look and shape* are still uneven, and in three places they cost people real effort:
- **The plan step hides its buttons.** After naming their organization, an organizer sees the heading twice and four
  cards of feature lists; the buttons to choose sit about two screens down on a laptop and on a phone. Two of the four
  plans cannot be bought from this door at all.
- **One form looks six different ways.** The same four fields (name, email, password) are drawn in six styles, with
  five spellings of "Create account" and two heading cases. The sign-in and coach join pages still read like a terminal;
  the join page is always dark and wrapped in the marketing site.
- **When something goes wrong, nothing is said.** An expired email link drops the person on a plain sign-in page with
  no message and no way to ask for a new link; the email itself is the old dark layout and never says what comes next.

**What changes for the customer (proposed, in three stages).**
1. **One account step.** Every door shows the same form, the same heading style, the same "Create account" button and
   the same check-your-email, in the warm look, in the app's own frame. Run a tournament loses its extra intro screen.
   Coach Premium's sign-up loses its sales page and looks like the other doors (owner, 2026-10-19). The coach join
   page moves onto it. Every "Coach a team" leads to the same place.
2. **The wait and the way back.** The verification and password-reset emails move to a warm layout that says what
   happens next; an expired link says so in one sentence and offers a new one; sign-in and password reset lose the
   typewriter capitals.
3. **The first screen inside.** The plan step becomes a short choice between the two plans that door sells, both
   buttons in view; the paid and free Premium welcomes become
   one screen; a fan's empty Home gets one line pointing to "start your own".

**Who it affects.** Every new organizer, coach, assistant, invited staff member and fan; returning users every time
they sign in or reset a password. No roles change and no data changes; nothing about plans, prices or the Founding
Season offer changes.

**Priority.** High: it is the first impression, it closes Account-First Sign-up's owed review, and it should land
before the Club release brings a new wave of sign-ups.

**Success looks like.** From any button on the marketing site, a newcomer on a phone reaches their own team, league or
organization in the fewest screens; every screen on the way looks and speaks the same; the button is always in view;
and every failure (a typo, an old link, an address that already has an account) is answered in one sentence with the
way forward beside it. Measured by the walk: zero first-run screens with the primary button below the fold on a
390 × 844 phone or a 1366 × 768 laptop; one form design; one button wording.

**Open owner calls (on the hub).** Whether this project takes the sign-in stage of The public face, warm (recommended);
the plan step's re-frame; the join page and checkout complete; the intro page; parking the claim link; the expired-link
wording; a fan's start line; Warm / Dark; how big a sign-up heading is; the app's top bar wording for every visitor; closing Account-First.
