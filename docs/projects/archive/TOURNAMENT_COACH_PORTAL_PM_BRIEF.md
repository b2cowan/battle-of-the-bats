# PM Brief — Tournament Coach Portal

**Created:** 2026-05-24  
**Status:** Planning  
**Full plan:** `docs/projects/active/TOURNAMENT_COACH_PORTAL_PLAN.md`

---

## What is this?

Every coach who registers a team for a tournament on FieldLogicHQ currently submits a form and disappears. Their only platform touchpoint after that is a generic confirmation email containing a direct link to a paid Stripe checkout. They have no dashboard, no status view, no schedule, and no reason to come back.

This plan gives tournament coaches a real FieldLogicHQ account — created in one step as part of the registration form — and a personal dashboard where they can track registrations across all tournaments and all years on the platform.

---

## What the coach experiences after this ships

1. Coach fills out the tournament registration form (unchanged: team name, contact name, email, division)
2. **New at the bottom of the form:** A password field. "Create your FieldLogicHQ account to track this registration and access your tournament history." One field. Done.
3. If the coach already has a FieldLogicHQ account (maybe they registered for a different tournament last year, or they're a rep team coach): the password section swaps to a sign-in prompt automatically after they enter their email. Their existing account gets linked to the new registration.
4. After submitting: the coach is logged in and redirected to **`/my/registrations`** — their personal coach dashboard.
5. The dashboard shows:
   - All tournament registrations tied to their email, across all organizations and all years
   - Registration status (Pending / Accepted / Waitlisted / Rejected) per entry
   - Active / upcoming registrations at the top; past seasons below
6. Clicking into a registration shows:
   - Live registration status with contextual messaging
   - Tournament details (dates, location, division)
   - **Their game schedule** — only their games, once the organizer publishes them
   - **Tournament announcements** as the organizer posts them
   - Two CTAs (see below)
7. When the organizer accepts their registration, the acceptance email now links to the dashboard — not a generic public team profile page.

---

## The two coach CTAs

**"Take your season further — Coaches Portal"**  
Shown when a registration is accepted. Explains that FieldLogicHQ has a full year-round team workspace: roster, schedule, dues, budget, documents, lineups. Links to the Team workspace product. This is FieldLogicHQ's conversion moment — not the organizer's job to push this, not a link that appears before the coach has experienced any value.

**"Ready to run your own tournament?"**  
Shown always, at quieter visual weight. Tournament coaches are ideal prospects for the Tournament plan — they've experienced the product from the team side and may organize one themselves. Links to the tournament organizer landing page or pricing. This is a long-game plant, not a hard sell.

---

## What changes for admins

The "Workspace Invite" bulk action and per-row mail icon are **removed** from the Registrations admin. Tournament organizers should not be in a position to push FieldLogicHQ products on coaches from other clubs. Upsells are the platform's responsibility.

Replacing the per-row workspace invite is a **"Resend access link"** action — a simple way for an admin to re-send a coach their login/dashboard link if they've lost their confirmation email. Single-registration only, not a bulk action.

---

## Why this matters

**For coaches:** They have a real home base on the platform — not just an inbox thread. They can self-serve "am I in?", "when do I play?", and "what's the latest update?" without emailing the organizer. And they accumulate history: every tournament they've ever registered for is in one place.

**For organizers:** Fewer "what's our status?" emails. The platform communicates on their behalf as they update registrations and publish schedules.

**For conversion:** The current flow asks coaches to pay for a workspace before they've seen anything. The new flow lets coaches experience the platform — status tracking, schedule, announcements — and then presents the workspace upsell in context, when the coach is already a logged-in user who has gotten value. The CTA is no longer a cold pitch; it's a natural next step.

**For FieldLogicHQ growth:** Tournament coaches are the warmest top-of-funnel users on the platform — they found it, trusted it with their team info, and engaged with a form. Creating an account at that moment locks in a persistent relationship. Whether or not they ever convert to a paid plan, they're now in the ecosystem: a named user, a re-engagement target, and a word-of-mouth vector.

---

## Who is affected

| Person | Before | After |
|---|---|---|
| Coach (new to platform) | Gets confirmation email; only touchpoint is Stripe link | Creates account during registration; gets dashboard immediately |
| Coach (existing account, e.g. returning registrant) | Gets confirmation email; Stripe link confused them | Recognized by email; signs in inline; new registration linked automatically |
| Tournament admin | Has "Workspace Invite" bulk action to push coaches to Stripe | Workspace invite removed; has "Resend access link" for coaches who lose their email |
| Org owner | No change | No change |
| Platform admin | No change | No change |

---

## Priority

**High.** Account creation at registration is one form field and a server-side auth call. The dashboard is a standard read-only data view. The platform already has all the authentication infrastructure. This is a high-leverage, moderate-effort change that closes the most obvious UX gap on the product and opens the conversion path the platform has been trying to optimize with increasingly complex token infrastructure.

---

## Success criteria

- Coaches create a FieldLogicHQ account as part of the registration form (no separate step)
- Existing accounts are detected and linked gracefully — no duplicate accounts
- `/my/registrations` shows all registrations for the logged-in coach's email, across all organizations and all years
- Registration detail view shows: live status, tournament info, game schedule (when published), announcements
- Acceptance email links coaches to their dashboard
- "Workspace Invite" admin action is fully removed; "Resend access link" per-row action is in its place
- Auth destination correctly routes tournament-only coaches to `/my/registrations` on login
