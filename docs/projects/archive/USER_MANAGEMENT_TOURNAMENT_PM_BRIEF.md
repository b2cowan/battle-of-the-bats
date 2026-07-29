# PM Brief — User Management UX (Tournament & Tournament Plus)

**Status:** Planning
**Tier scope:** Tournament (free) and Tournament Plus ($39/mo) only
**Full plan:** [USER_MANAGEMENT_TOURNAMENT_UX_PLAN.md](USER_MANAGEMENT_TOURNAMENT_UX_PLAN.md)

---

## What this is

A focused UX polish pass on the Members management page for our two tournament-focused plan tiers. The page works mechanically, but several details create confusion or broken flows — most critically, the "Upgrade" button sends users to the wrong destination.

---

## What changes for users

**Tournament plan admins** will see:
- A working "Upgrade" button that actually takes them to their billing page (currently broken)
- A clear explanation that their plan includes 3 staff seats total
- A helpful empty state when they first open the page, guiding them to invite their first Staff or Scorekeeper
- Accurate language: "Manage who has access to your tournaments" instead of "your organization" (they don't have org-level access)

**Tournament Plus admins** will see:
- A working "Upgrade" link (edge case if they somehow hit a limit)
- A clear explanation that their plan has unlimited seats and scorekeepers are always free
- A hint in the role selector when promoting someone to Scorekeeper: "Scorekeepers are free seats on your plan"

**All tournament-tier admins** will see:
- A plan context note in the Role Guide explaining their specific seat model
- An ownership transfer note in the manage modal when viewing their own account, instead of silently omitting the role selector

---

## Why it matters

The "Upgrade" link is the primary upgrade path from the Members page — it's what a user clicks when they hit the 3-seat limit on the free Tournament plan. If that link goes to the wrong place (and currently it does), we're leaking upgrade intent at the most motivated moment in the funnel.

The seat model confusion matters during the founding season, when we're onboarding new Tournament Plus orgs who may not understand they can add unlimited scorekeepers at no cost. Surfacing this clearly reduces support questions and makes the value prop tangible inside the product.

---

## Who can manage members

- **Owner** — full access to everything, including suspend/reinstate and capability overrides
- **Admin** — can invite, manage roles, and remove members; cannot manage billing or org settings
- **Staff / Scorekeeper** — no access to the Members page at all

---

## Roles available on Tournament tiers

Only four roles are offered — Coach, League Admin, League Registrar, and Treasurer are deliberately excluded as they apply to higher-tier plans.

| Role | What they do | Seat cost |
|---|---|---|
| Owner | Everything, including subscription | Billable |
| Admin | Full tournament management, no billing | Billable |
| Staff | Day-of: scores, schedules, announcements | Billable |
| Scorekeeper | Score entry only via dedicated link | Billable on Tournament; **Free** on Tournament Plus |

---

## Priority & success criteria

**Priority:** Medium — not blocking any feature, but the broken upgrade link is a funnel leak and should be fixed before the founding season conversion push.

**Success criteria:**
- "Upgrade" CTA from the Members page lands on the correct billing page for Tournament users
- First-time users see a meaningful empty state with an "Invite Member" CTA
- Seat model (3 seats vs unlimited + free scorekeepers) is clearly communicated inline without requiring the user to leave the page
- No new UX regressions for League/Club users who share the same page component

**Not in scope:** Redesigning the page layout, adding new member capabilities, or changing the billing model.
