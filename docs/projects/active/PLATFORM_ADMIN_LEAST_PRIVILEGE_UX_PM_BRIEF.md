# PM Brief — Platform-Admin Least-Privilege UX Consistency (F2)

**One line:** Every enabled button a platform-admin staff member cannot use will be visually disabled or hidden, with a plain-language explanation — so "not allowed" can never be mistaken for "broken."

---

## Why this matters

Right now, four of our six platform-admin roles encounter controls that look fully interactive but silently fail when clicked. A support rep sees the "+30 days" button on the Retention Queue — enabled, no tooltip — clicks it, fills in a reason, submits, and gets nothing back. A read-only auditor opens the Customer Users page and sees a full Actions menu (Notes, Reset Password, Ban User, Delete User) with no indication it is a dead end. Every click fails without explanation.

This is not a minor polish issue. It is the #1 reason a new hire cannot be productive on day one: they cannot tell the difference between "this feature is broken" and "I don't have permission to do this." The result is support tickets, Slack messages to senior staff, and eroded confidence in the console's reliability — for actions the console was never supposed to allow in the first place.

The only surface that handles this correctly today is the Observability error-group page, which shows a "View-only for your role" note when a staff member's role is read-only. This fix extends that single good pattern to every other surface where it is currently absent.

---

## What changes

**For support reps:** The Retention Queue "+30 days" and "Process expiry" buttons become visually disabled with a "Requires billing access" label. The Org Detail Entitlements and Billing & Access override forms show the same note, consistent with how the Identity/Ownership sections already behave. A Cancel Subscription stub appears for billing-restricted roles so they can see the feature exists and know to contact the billing team. The Feedback list page adds a one-line note explaining why the Status column shows a badge instead of a dropdown.

**For read-only observers:** The Customer Users Actions button is suppressed entirely — a view-only indicator replaces it. The Overview Action Queue tiles that link to areas the read-only role cannot access are rendered as non-clickable count tiles with a tooltip, not dead navigation links.

**For billing specialists:** The Change Requests list shows a "Review-only — requires product access" note when a billing specialist is viewing it, and all Approve/Apply/Reject buttons that were previously clickable-but-broken are gated.

**For product operators:** The Customer Users Actions menu is suppressed the same way as for read-only, since product lacks `manage_support`. The Bulk Operations default action type changes to one product can actually execute (instead of defaulting to a billing action).

**Across all roles:** A new shared `RequiresAccess` note component provides a consistent, on-brand way to explain access restrictions anywhere in the console. One pattern. One voice.

---

## What does NOT change

The underlying API permissions are not touched here — that is the F1 Hardening project. This project is purely about what staff members see and whether those controls truthfully represent what they can do. The support-seam permission design (should support be able to change feedback status?) is F3 and is explicitly out of scope.

---

## Who benefits

The direct beneficiaries are FieldLogicHQ's own internal staff — support reps, billing specialists, product operators, and read-only observers. Customers are indirect beneficiaries: a platform team that can orient faster, make fewer mistakes, and trust what they see resolves customer issues more quickly and with less risk of accidental action on the wrong record.

---

## Priority and size

**Priority: P1** — this is the #1 confirmed day-one usability blocker across the platform-admin console, affecting four of six roles. It should ship as soon as F1 (API hardening, P0) is complete, or in parallel since the changes do not overlap.

**Size: Small-medium.** The changes are localized to client components and server page props — no new API routes, no database migrations. The largest single item is the `CustomerUsersClient` role prop (one server-page change + one client conditional). Most other tasks are one-to-five-line additions of a `disabled` prop and a `RequiresAccess` note. Estimated engineering time: one focused session of two to four hours.

**Success criteria:**
- No role encounters an enabled control that 403s silently after this ships.
- The read-only observer can open Customer Users and immediately see a view-only indicator with no interactive Actions column.
- The support rep can open the Retention Queue and see disabled buttons with a clear "Requires billing access" note — not enabled buttons that silently fail.
- A new hire on any of the four affected roles can understand their access boundary from the screen alone, without tribal knowledge.
