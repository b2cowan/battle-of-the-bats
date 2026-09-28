# PM Brief — Close the public-key door on tournament data

**Priority:** High. Do it before real clubs register teams.
**Plan:** `PROD_DATA_API_EXPOSURE_PLAN.md` · **Finding:** DB Architecture Review #44

## What's wrong

On the live site, anyone can pull every club's tournament data straight from the database. It takes only the site's public key, which every visitor's browser already has. What they can see:

- team registrations: coach names, contact emails, payment status, amounts paid and admin notes
- the email of whoever entered each score
- a tournament contact email that a club chose to hide
- the sender addresses on announcements

It also allows two kinds of change. Any signed-in account, from any club, can change any club's pools. Anyone can add a team to any tournament without going through registration, which skips capacity, fees and closed registration.

Our test environment never showed this, because it never had the permission that creates the gap.

## What changes

Nothing customers use changes. Every screen already loads this data through the server, and a week of production traffic confirms that nothing reads it through the public key. After the fix, the public key can read only what the live screens need: game scores and status for the public bracket, and a new team's name for the admin activity feed.

Bonus: live updates start working in the test environment for the first time. That covers the public bracket, the scorekeeper board, the admin activity feed and the notification bell. Test walks of live behaviour become meaningful.

## Stages

1. **Stage 1 (this fix):** one database change covering the tournament tables. Tested first in the test environment, then applied to production. It doesn't need a code release.
2. **Stage 2 (follow-up):** the same clean-up for every other table. Production's old blanket permission is what turned each of these rules into a door. After Stage 2, the test environment matches production's security exactly, so this class of problem shows up in testing.

## Success criteria

- The public key can't read team registrations, contact emails or scorekeeper emails on production. This is verified directly against production after the change.
- Public brackets, the scorekeeper board, the admin activity feed and the notification bell all still update live on production, and now also in testing.
- Registration and pool editing work exactly as before.
- The morning health check's "Live-update errors" row goes quiet.

## Decisions for the owner

1. Approve Stage 1.
2. Keep the "new team registered" line in the admin activity feed (recommended; members would see only the team name), or drop it.
3. Optional: hide draft schedules from the public key too. The risk is low; it's your call.
4. Optional, and only on your ask: add build checks so a gap like this can't hide again.
