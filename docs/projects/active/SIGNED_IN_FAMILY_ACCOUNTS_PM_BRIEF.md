# Signed-in family accounts — PM Brief

**Plan:** `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md` · **Decision:** Business Decisions Log, 2026-10-31 · **Journeys:**
https://claude.ai/artifact/QmPoKvcyF3Bg1xpjCWw54C

## What changes for people

- **Parents sign up without an account.** A house-league or tryout sign-up never asks for a password.
- **A parent gets an account when their child is placed on a team.** The "your child's team" email is the invitation. The
  account is where the team's schedule, practices, chat and In / Out / Maybe replies live.
- **Before a team exists, one emailed page does everything.** "Your sign-up" shows status, takes payment and handles a
  withdraw request. It shows first names only, stops working when the season ends, can be reset by the club for one family,
  and is never sent when nothing is owed. A family who loses the email asks for it again and it goes only to their inbox.
- **Tournament coaches** still get their account when they register, now with one email instead of two and a finish screen
  that makes sense.
- **Tournament parents and fans** never need an account.
- **A second parent's email** can be added on the house-league form, so both parents get the team invitation.
  Drawn and ruled 2026-11-03: an always-visible "Second parent's email" box (no name asked). The second parent gets every
  email about the sign-up, with a line saying who added them; receipts and refunds still go to whoever paid. The coach and the
  club see it; it is never put on the marketing list.
- **Next season**, a signed-in parent finds the form filled in.

## Why it matters

One rule anyone can explain: you get an account when there is something in it for you. Families are never asked for a
password to sign up, payers without an account can always pay, and nothing sent to a family stays alive forever or works for
whoever forwards it.

## Priority and order

1. Harden "Your sign-up" (no prerequisite).
2. Tidy up tournament registration (no prerequisite).
3. Second parent's email (no prerequisite).
4. The invitation at team placement and the app's team space (unblocked: counsel stopped being a gate 2026-11-04 and Stage 14 is closed; drawn and ruled 2026-11-08: built as 4a, the invitation, the family team page, the sign-up inside, one family calendar and the club's status, then 4b, In / Out / Maybe; no chat until the Messages project).
5. Pre-filled next season (waits on 4).

## Success looks like

- No house-league family email carries more than one family link, and that link ends with the season.
- A club can cut off one family's link without affecting anyone else.
- A tournament coach receives one email at registration.
- Once Stage 4 ships, every placed child's parent receives exactly one invitation, and no family is ever sent a calendar or
  RSVP link.
- **Stage 4a is built (2026-11-08), switched off.** A parent joins once from the placement email and sees every child's team (house league
  and rep) in a "Your family" page, with one calendar address, Leave, and "Your sign-up" inside the app; the club sees each parent's status
  with Send again and Remove a parent; the rep coach's Send invitation now emails. In / Out / Maybe and the coach's headcount (4b) are next,
  after a drawing session. Owner walk: ledger §498.
