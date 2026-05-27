# PM Brief — Tournament Contact Model Refactor

**Status:** Planning + first unified sign-in slice implemented  
**Plan:** `docs/projects/active/TOURNAMENT_CONTACT_REFACTOR_PLAN.md`

---

## What is this?

Right now, tournament admins can create a "Contacts" list — a separate directory of names, emails, and phone numbers that sits alongside the Staff & Access system. The problem is that this contact directory duplicates effort: anyone meaningful enough to receive admin notification emails should already have a staff account. The standalone contacts concept creates confusing double-entry and implies functionality (public directory, included in more emails) that doesn't actually exist.

This change removes the contacts concept entirely and replaces it with direct references to staff accounts — the people already set up in Staff & Access.

---

## What changes for the org admin

### Event Settings gets a "Public Contact" section

Instead of going to a separate Contacts page to designate who represents the tournament, admins select a staff member directly from a dropdown in Event Settings. That person's email becomes the reply-to address on coach emails and the contact shown on the public registration page when registration is closed.

This defaults to the org owner automatically — no setup required for small tournaments.

### Event Settings gets a "Notification Routing" toggle

Admins can now choose between two modes:

**"All registrations"** (default) — The owner and all admins receive registration notification emails for every division. If a division also has a specific contact assigned, that person gets notified too.

**"Assigned only"** — Each division's assigned contact is the only one notified for that division. This is the right setting when you've given conveners responsibility for their own divisions and don't want the owner buried in emails they've delegated.

### Division contacts become staff account assignments

When editing a division, instead of picking from a separate contacts list, admins pick directly from their staff roster (Owner, Admin, and Staff roles only — Scorekeepers are excluded). Each division defaults to the tournament's public contact (i.e. the owner by default). Override it division-by-division when you have a specific convenor running that age group.

### Removing a staff member warns about their contact assignments

If a staff member is currently assigned as a division contact or the default tournament contact, the "Remove member" confirmation modal will list exactly where they're assigned and confirm that all assignments will revert to the owner's email. No silent data gaps.

### Event Settings is now one click from the sidebar

Event Settings (dates, fees, scoring) moves to a direct link in the sidebar Setup group. It was previously buried two clicks deep under Settings & Access. This is the most frequently updated settings page and should be the easiest to reach.

### The "Contacts" sidebar item goes away

There's no longer a standalone Contacts section. Everything it did is handled inside Event Settings and the Divisions page.

---

## Who benefits and how

| Role | Before | After |
|---|---|---|
| **Org owner (small tournament)** | Creates contacts list manually even though it's just themselves | Zero setup — they're the default contact automatically |
| **Org owner (delegated event)** | Maintains a parallel contacts list that has no login enforcement | Assigns existing staff members as division contacts; notification routing is explicit |
| **Staff convenor** | Could be added to contacts but that address had no system access | Staff account is directly assigned to their division; they get the right notifications |
| **All admins** | 3 clicks to reach Event Settings | 1 click to reach Event Settings |

---

## What this is not

- This does not change who can log in or what they can do — permissions are unchanged
- This does not remove the ability to have a different contact per division — that still works, it just references a staff account instead of an arbitrary email
- This does not change any coach-facing emails — coaches still see the same contact email; it just comes from a staff account now

---

## Active: Unified Sign-In Home

This work now includes the first implementation slice for a cross-context user home. After sign-in, users with one clear destination still go straight there. Users with multiple contexts now route to `/home`, where they can choose between org admin workspaces, tournament operations, Coaches Portal Basic tournament records, and Coaches Portal Premium/team workspaces.

This reuses the existing tournament admin dashboard, org tournament list, and in-org tournament switchers. A tournament owner with one org and multiple tournaments keeps the same admin flow rather than seeing a duplicate tournament picker.

The org dashboard and rep-team admin navigation now only show the personal Coaches Portal shortcut when the signed-in user has a coach assignment in that same org. If a user is an admin in one org and a coach in another, those stay separate contexts.
