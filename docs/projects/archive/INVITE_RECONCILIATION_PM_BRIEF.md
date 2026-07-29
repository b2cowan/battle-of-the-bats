# PM Brief — Invite Reconciliation & Pending-Invite Experience

**Plan:** [INVITE_RECONCILIATION_PLAN.md](./INVITE_RECONCILIATION_PLAN.md)
**Priority:** High — caused a real production support ticket; affects every newly-invited staff/coach/scorekeeper who doesn't follow the email link exactly.

## The problem in plain language

When an organization invites a new person, today the *only* way that person can get in is to find the invitation email and click its link within 24 hours. If they instead do the obvious thing — go to the site and create an account, or just try to log in — they get an "incorrect email or password" error and are completely stuck. There is nothing anywhere in the app that tells them "you've been invited, click here to accept." A support person then has to manually re-send the invite and coach them by hand. This will keep happening to a meaningful share of invited users, because clicking-the-email-link-or-nothing is a fragile assumption.

## What changes for the user

After this work:

- A person invited to an organization can **create their account the normal way** (or just log in once their account exists) and it will **just work**.
- When they sign in, they'll see a clear card: **"You've been invited to {Organization} as {role} — Accept / Decline."** One click and they're in.
- If they accidentally started creating their own separate organization, the system recognizes the pending invitation and steers them into it instead of leaving them with an empty junk org.
- The existing email-link flow still works exactly as before — this is an *additional* safety net, not a replacement.

## Why it matters

- **Removes a top-of-funnel friction point.** Invited staff/coaches are often the customer's volunteers and partners; a broken first login reflects badly on both the org and on FieldLogicHQ.
- **Cuts support load.** Today this requires a human to re-invite and explain. After this, it's self-service.
- **Closes known audit gaps** (J10-001, J10-011, J10-026) about invited-member dead-ends in one coordinated fix.

## Access / role differences

No new permissions. Org admins invite exactly as they do today. The change is entirely on the invited user's side: more ways to successfully accept, plus a visible pending-invite prompt. Decline is available to the invited user (removes the pending invite).

## Customer impact

Every organization that adds staff, coaches, scorekeepers, or treasurers benefits. Highest impact for clubs/leagues onboarding multiple volunteers at once, where "some of my people can't log in" is a recurring headache.

## Priority & sequencing

**High.** Ship in two waves:
1. **Wave 1 (the visible win):** self-register/login → see pending-invite card → Accept. Solves the reported ticket class.
2. **Wave 2 (cleanup):** smarter signup (no junk org) and relaxed one-org rule so edge cases stop blocking legitimate invites.

## Success criteria

- An invited new user who never opens the email can still get into their org within one login, via the pending-invite card.
- Zero "incorrect email or password" dead-ends for invited users who have created an account.
- Measurable drop in re-invite support actions.
- Existing email-link acceptance path unchanged (no regression).
