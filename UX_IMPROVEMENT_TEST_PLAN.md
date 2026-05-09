# FieldLogicHQ: Role-Based UX Improvement Test Plan

## Objective
To review the existing codebase and planned modules for FieldLogicHQ and identify ways to improve the User Experience (UX) from the perspective of every available role. This test plan outlines the key areas to evaluate, ensuring the platform remains intuitive, mobile-friendly, and professional.

---

## 1. Org Owner & Admin (Platform Managers)
**Focus:** High-level management, ease of navigation, and operational efficiency.
- **Onboarding / Empty States:** When a new organization is created, is there a clear "Getting Started" flow or dashboard? If no tournaments or seasons exist, are there obvious calls to action to create them?
- **Navigation Clarity:** With the introduction of multiple modules (Tournaments, House League, Accounting), is the transition between these contexts seamless? Do breadcrumbs or sidebar highlights clearly indicate where the admin currently is?
- **Bulk Operations:** Can admins perform bulk actions, such as changing registration statuses, assigning teams, or editing schedules? This is critical for scaling.
- **Cross-Module Dashboard:** Is there a consolidated view where an owner can see active tournaments, ongoing house league registrations, and recent accounting entries at a glance?

## 2. Treasurer
**Focus:** Financial accuracy, speed of data entry, and clear reporting.
- **Data Entry Efficiency:** Is the manual entry of financial records optimized for speed? (e.g., keyboard navigation support, auto-suggest for categories like "Umpire Fees" or "Diamond Rental").
- **Ledger Switching:** Is it obvious whether the treasurer is working within the general Org Ledger vs. a specific Tournament Ledger?
- **Pending Reconciliations:** Are pending entries clearly highlighted so the treasurer knows what still needs to be posted when funds actually clear?
- **Export & Reporting:** Is there a one-click export to CSV/PDF so the treasurer can share reports with the board or external accountants?

## 3. League Admin & Registrar
**Focus:** Managing high volumes of player registrations, waitlists, and team drafts.
- **Registration Pipeline:** Is the list of pending, active, and waitlisted registrations easily scannable? Is there a quick way to filter by division or status?
- **Waitlist UX:** When a division hits capacity, is the waitlist position clear to both the admin and the registrant? Is the workflow for promoting a player from the waitlist intuitive and accompanied by an automated email?
- **Team Builder / Draft Board:** During manual or draft modes, is the drag-and-drop interface responsive? Can the admin easily see player preferences (e.g., jersey size, position) while making team assignments?
- **Inline Communication:** Can the registrar preview the email templates before blasting notifications to a division or team?

## 4. Coach (Registered in a Tournament / Rep Teams)
**Focus:** Roster management, schedule awareness, and game-day logistics.
- **Mobile-First Rostering:** Coaches often manage rosters from their phones at the diamond. Is the UI for adding players, editing details, and confirming waivers optimized for mobile?
- **Schedule & Bracket Clarity:** Are tournament brackets and game times easy to read on small screens? Are advancements clearly visualized?
- **Real-Time Alerts:** Is there a mechanism (or planned mechanism) for coaches to receive instant notifications (SMS or email) regarding rain delays, diamond changes, or score disputes?

## 5. House League Registrant (Parent / Guardian / Player)
**Focus:** Frictionless sign-up, clear communication, and schedule access.
- **Public Registration Form:** Is the C5 public registration form fully responsive? Are validation errors (e.g., missing email) clear and inline?
- **Division Selection:** Does the form clearly indicate which divisions have available capacity versus those that are waitlist-only?
- **Status Tracking:** Once registered, can a parent easily understand their child's status or waitlist position? (Likely via the confirmation email).
- **Calendar Sync:** Once the season schedule is generated, is there an option to export or sync their specific team's schedule to Google/Apple Calendar?

## 6. Official / Scorekeeper
**Focus:** Fast, reliable score entry from the field.
- **Score Entry Interface:** Is the score entry UI optimized for mobile devices, specifically with large tap targets and high contrast for outdoor visibility?
- **Low Connectivity Support:** Does the UI handle slow networks gracefully? (e.g., optimistic UI updates or clear loading states when submitting a score).
- **Game Assignments:** Can officials easily see their upcoming game schedule, locations, and diamond numbers?

## 7. Platform Admin (Superuser)
**Focus:** Global platform health and support.
- **Impersonation/Support Tools:** If an org owner reports an issue, can the platform admin easily troubleshoot their specific context without requiring their password?
- **Global Metrics:** Is there a high-level dashboard showing platform-wide metrics (total active orgs, tournaments created this month, active subscriptions)?

---

## Next Steps for Execution
1. **Walkthrough Sessions:** Conduct a guided UI walkthrough for each role using the active dev server.
2. **Friction Logging:** Document any clicks that feel redundant, pages that take too long to load, or UI elements that are confusing.
3. **Prioritization:** Rank the identified UX improvements based on development effort vs. user impact.
4. **Implementation:** Feed the prioritized items back into the `PLATFORM_ROADMAP.md` or a dedicated `UX_POLISH_PLAN.md` for execution.
