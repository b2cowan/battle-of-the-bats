# PM Brief — Tournament Admin Settings Restructure

**Created:** 2026-05-27
**Status:** Approved for implementation
**Plan:** `docs/projects/active/TOURNAMENT_SETTINGS_RESTRUCTURE_PLAN.md`

---

## What is this?

A reorganization of how tournament admins access and manage their tournament settings. No new features are being added — existing functionality is moved to better locations, the navigation is simplified, and some quality-of-life gaps are closed.

---

## What changes for the user?

### Tournament organizers (Tournament / Tournament Plus)

**Before:** To rename a tournament or change its status, you navigated to Settings & Access → Tournaments & Seasons → a separate manage page. Dates lived in a different place (Event Settings). Creating a new tournament required yet another route.

**After:** Everything about a single tournament — name, slug, dates, fees, competition rules, status, and archive — lives in **Event Settings**, one page. To create a new tournament, click the **`+` button** right next to the tournament switcher in the sidebar. No extra pages, no tab hunting.

**Before:** Settings & Access had three tabs. Two of them showed a single locked or restricted tile. The third had three items.

**After:** Settings & Access is a flat grid — 3 cards (Registration Questions, Staff & Access, Plan & Subscription) with no tabs. Locked cards for lower-tier features now link to the upgrade page instead of doing nothing when clicked.

**Before:** Tournament Notifications (your personal mute settings) required: Settings & Access → Tournament Setup tab → Manage Notifications.

**After:** Tournament Notifications is a direct link in the sidebar footer — one click, always visible regardless of role.

**Before:** Registration Questions required navigating into the Settings & Access hub.

**After:** Registration Questions appears directly in the Setup section of the sidebar, alongside Event Settings and other setup tools.

### Admins (not owners)

**Before:** Event Settings showed a "owners only" message to admins even though managing dates, fees, and competition rules is core admin work.

**After:** Admins can fully use Event Settings. (This change is already shipped.)

### Staff members and scorekeepers

**Before:** Event Settings appeared in the sidebar for staff, clicked through to an unhelpful empty message.

**After:** Event Settings is hidden from the sidebar for staff and officials — only owners and admins see it.

**Before:** Tournament Notifications was buried in the Settings & Access hub which staff could technically reach.

**After:** Tournament Notifications is in the sidebar footer, clearly visible to all roles including staff.

### League and Club subscribers

**Before:** Settings & Access showed Staff & Access and Plan & Subscription tiles that duplicated what's already in the Org Admin section.

**After:** Those tiles are hidden for League/Club — they manage staff and billing through Org Admin where it belongs. Settings & Access is removed from their tournament sidebar entirely; Registration Questions moves to a direct sidebar nav item instead.

---

## Why does this matter?

- **Fewer clicks to common tasks** — creating a tournament and renaming a tournament are both significantly more discoverable
- **Role-appropriate navigation** — staff members no longer land on "access denied" pages from sidebar links
- **Upgrade path for locked features** — locked plan features now lead to the billing page instead of doing nothing
- **Tier-appropriate UI** — League/Club orgs no longer see settings surfaces that don't apply to them

---

## Success criteria

- A Tournament plan organizer can create a second tournament (or see a clear message if at limit) directly from the sidebar
- A Tournament Plus organizer can rename their tournament without leaving the tournament admin
- An admin (non-owner) can update event dates, fees, and competition rules
- A staff member does not see Event Settings in the sidebar
- Clicking a plan-locked card takes the user to the subscription/upgrade page
- Tournament notification preferences are reachable in one click from any tournament admin page

---

## What this does not include

- No changes to the org/tournaments/manage page (left as-is; future cleanup)
- No changes to registration questions page itself
- No new billing or plan features
- No changes to the org admin section for League/Club users
