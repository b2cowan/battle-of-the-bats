# Account-First Sign-up — PM brief

**Status:** drawn and design-reviewed 2026-10-18; all seven asks ruled as recommended the same day. Part 1 (Start a
team, Start a league, Home's finish card, sign-in's Send the link again) built and committed `8647a4e8` 2026-10-18;
owner walk §336 owed. **Home's finish card revised 2026-10-19** (a workspace that waits for its name; drawn, OK'd by
the owner and built the same day; §336's W3 and W5 rewritten, W16–W17 added). Parts 2 (Run a tournament) and 3 (Coach Premium) next. Plan: `ACCOUNT_FIRST_SIGNUP_PLAN.md`.

## What changes for the person signing up

Every way to start something on FieldLogicHQ — run a tournament, start a team, start a league, Coach Premium — asks for
the same four things first: first name, last name, email, password. The person confirms their email. The link brings
them to the one thing they came to make: name the team, the league or the organization (and, for Coach Premium, pick
the sport and billing before checkout). Nothing is asked twice, and the page says from the start that naming comes
next.

If they open the email on another device, or come back days later and sign in, FieldLogicHQ still knows what they came
to start and takes them there. Home keeps a place for it under Workspaces — "Your team, not named yet" — until they name
it, and then that same card carries the team's name. Nothing to dismiss, and nothing to lose (revised 2026-10-19; it
was a "Finish creating your team" card with Not now).

## Why it matters

- **Nothing is built for an unproven email.** Today the tournament sign-up creates the organization, takes its web
  address and starts its Founding Season offer before anyone opens the link. Abandoned sign-ups leave live
  organizations behind, and an address typed by someone else can claim a club's name.
- **Nothing typed is lost.** Today the paid team sign-up forgets the team, sport and billing choice when the link opens
  in another tab or device, and the plan picked on the pricing page never reaches the plan step.
- **One sign-up to learn, test and support** instead of four different forms.

## Customer impact

Every new coach and organizer meets this on day one. The number of steps stays the same: one form, one email, one
name. The trade: the check-your-email screen can no longer name the team, because it has not been named yet.

Tournament registration, invitations and family claims do not change.

## Priority

High. It removes the organization-before-proof gap on the revenue sign-up and the "asked twice" confusion the owner hit
on the first walk of the verified sign-up. It sits on screens that went live on 2026-10-18, so it should land before
those screens see real traffic.

## Success criteria

- No organization, team or league exists for an email that has not been confirmed.
- A sign-up opened on a second device lands on the right create step with the pricing choice intact.
- No one who confirmed their email lands on a page with no way to start what they came for.
- The owner's walk of each of the four doors reads as one account step and one naming step.
