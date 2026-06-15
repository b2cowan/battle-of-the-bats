# Signup / Org Decoupling — PM Brief

**Status:** Planned, sign-off received 2026-06-15. Continuation of the Invite Reconciliation fix.
**Priority:** High — fixes a live production dead-end (invited users) at its root and removes a junk-data source.

## What we're shipping

Today every new visitor is funneled into "Create Your Organization," even people who were *invited* to an existing org. Those invitees end up creating an empty organization they never wanted — junk data, and a confusing experience. This change lets a person **create an account without creating an organization**, and **splits the front door by intent** so the two kinds of people get two clean paths.

## What the customer sees

- **Organization owners (unchanged, protected):** Pick "Run a tournament" on the start screen, sign up with their org name, and get a workspace immediately on the free Tournament plan — same as today. Verify email, land in their org, choose or upgrade their plan during onboarding. **No extra steps.**
- **Invited / joining users (fixed):** Pick a new "I was invited / joining a team" option, create an **account only** (no org), verify their email, and land on their home screen where a **"You've been invited to {org}" card** lets them Accept in place. **No empty org is ever created.** If they change their mind, "Start something new" takes them to the owner path.
- **Multi-workspace is officially supported:** a person can own their own org *and* be a member of someone else's. The home-screen switcher already handles this; we're confirming it as intended behavior rather than blocking it.

## Why it matters

- **Removes a real support burden.** The originating ticket (an invited Milton Softball staffer stuck at "incorrect email or password") is fixed at the root, not patched.
- **Stops junk-org creation** from invited users doing the natural thing.
- **Cleaner front door** that matches the account-first architecture the home/start screens already assume.

## Support tooling (platform-admin)

- A **bulk filter for unconfirmed users** on Customer Users, so support can find accounts that never verified.
- An **"empty org" indicator + filter** on the Orgs page, so support can spot and clean up organizations that were created but never populated. (Surfacing only — deletion stays a deliberate manual action.)

## Success criteria

- An invited user can self-register, land on their home screen, and accept their invite — with no junk org created.
- The owner signup path has the same number of steps as today (no regression).
- Support can locate unconfirmed users and empty orgs in a couple of clicks.

## Risk & guardrails

Auth-critical work — full adversarial review before commit; user does browser testing; dev-only branch until explicitly deployed. The owner (revenue) funnel is the protected priority and must not regress.
