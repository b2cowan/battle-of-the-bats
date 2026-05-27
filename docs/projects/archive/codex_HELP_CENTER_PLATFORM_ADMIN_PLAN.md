# Help Center Platform Admin Documentation Plan

## Goal

Make Help usable as a task-based support center for both customers and FieldLogicHQ employees.

Customers should be able to find "how do I" guidance faster from their org admin Help area. Platform employees should be able to open the same customer-facing guide content from Platform Admin and also access a protected internal Platform Admin Operations guide.

## Scope

- Improve the org admin Help hub with search, task shortcuts, grouped guide cards, and role/module-aware guide visibility.
- Replace the thin Platform Admin help page with a full searchable Help Center.
- Add platform-admin routes that render the same customer guide content without requiring an org slug.
- Add a protected Platform Admin Operations guide with employee SOPs for:
  - Resetting customer passwords.
  - Temporarily overriding billing access.
  - Providing module access for unsubscribed accounts.
  - Running bulk billing and module operations.
  - Writing support notes and handling org identity changes.
  - Investigating account changes in the audit log.
  - Working with retention, plans/pricing, and platform users.
- Keep platform-admin-only content under `/platform-admin/help/*`, protected by the existing platform admin layout and auth gate.

## Implementation Checklist

- [x] Add reusable searchable help hub component.
- [x] Update org admin Help hub to use task-first navigation while preserving role/module filters.
- [x] Convert `/platform-admin/help` into a unified customer plus employee help center.
- [x] Add platform-admin customer guide routes backed by existing shared help content.
- [x] Expand Platform Admin Operations help content into practical SOP sections and FAQs.
- [x] Open the Platform Admin Help nav link in a separate tab/window for a dedicated reading workspace.
- [x] Run focused lint and type verification.
- [x] Replace long-scroll guide pages with a selected-topic article reader, searchable topic results, related FAQs, and previous/next navigation.
- [x] Initial browser verification completed by user.
- [x] Add expected customer-facing task-recipe content volume across major customer guides.
- [x] Open platform-admin Help in a separate tab/window and render platform-admin help routes without the platform-admin side navbar for easier reading.
- [x] Project accepted as complete by user after the content-density and platform-admin reading-shell pass.
- [x] Add role-based getting started paths for customer admins and platform employees.

## Access Model

- Customer org users access help at `/{orgSlug}/admin/help`.
- Platform admins access help at `/platform-admin/help`.
- Customer-facing help content is shared by importing the same `lib/help-content/*` guide modules.
- Employee-only Platform Admin Operations content is only routed under `/platform-admin/help/platform-admin`, which is already behind platform-admin authentication.

## Success Criteria

- A customer admin can search the Help hub by task, module, role, or export format.
- A platform employee can open customer docs and internal SOPs from one Help Center.
- Password reset, billing override, module override, and bulk operation instructions are findable through quick links and search.
- Internal platform-admin documentation does not appear in the org admin customer Help hub.
- Guide pages show one focused topic at a time instead of one long scrollable document.
- Platform-admin help opens outside the main admin shell and omits the platform-admin side navbar for article readability.
- Help hub users can start from their job role, then follow the right first tasks without already knowing which module guide contains them.

## Future Usage-Driven Improvements

These are not launch blockers for this project, but they are worth revisiting after real customer and support usage:

- Add short screenshots or annotated images for the highest-volume help tasks once the UI stabilizes.
- Add empty-state links from specific product screens into the exact help recipes.
- Add lightweight analytics for help search terms with no results.
- Add release-note prompts so newly shipped workflows are paired with help updates.

## Verification Notes

- `cmd /c npx tsc --noEmit` passed.
- Focused ESLint on the changed help/platform-admin files passed.
- Follow-up guide-reader pass: `cmd /c npx tsc --noEmit` passed and focused ESLint on `components/help/HelpPageLayout.tsx` passed.
- Full `cmd /c npm run lint` is currently blocked by pre-existing repo errors in `scripts/fix-encoding.js` and the existing warning backlog.
- Dev server was restarted after clearing `.next`; `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returned HTTP 200 with no Supabase `EACCES` failures in the server output.
- Dev server was restarted again after the shared guide-reader change; the platform-admin login check returned HTTP 200.
- User completed initial browser verification before the customer-facing recipe content pass.
- Customer-facing recipe content was expanded across Org Admin, Tournaments, House League, Registrations, Rep Teams, Coaches Portal, and Accounting. A second browser verification is intentionally still open so layout can be judged with end-state content density.
- Post-content code verification: `cmd /c npx tsc --noEmit` passed and focused ESLint on changed help routes/content passed.
- After adding shared help content and new help routes, the dev server was stopped, `.next` was cleared, `npm run dev` was restarted with network access, and `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returned HTTP 200 with no Supabase `EACCES` in server output.
- Platform-admin Help reading-shell change verification: `cmd /c npx tsc --noEmit` passed, focused ESLint on `app/platform-admin/layout.tsx` and `app/platform-admin/PlatformAdminNav.tsx` passed, the dev server was restarted after clearing `.next`, and `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returned HTTP 200.
- On user direction, the help-center project is marked complete. Remaining article and UI ideas should be handled as future usage-driven improvements, not active blockers.
- Role-based getting started paths were added as a follow-up improvement for Owner/Admin, Tournament Admin, League Admin, League Registrar, Rep Program Admin, Coach, Treasurer, Platform Support, Billing/Product Admin, and customer support reference workflows.
- Role-path verification: `cmd /c npx tsc --noEmit` passed, focused ESLint on the changed help hub/page files passed, the dev server was restarted after clearing `.next`, and `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returned HTTP 200.
