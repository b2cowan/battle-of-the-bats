# Tournament Admin — Design Review Tracker

> **Status:** In Progress
> **Created:** 2026-05-22
> **Branch:** dev
> **Purpose:** Track design review progress across all tournament admin pages and shared navigation components. One row per page/component; check off each column as work is completed.

---

## How to use this tracker

| Column | Meaning |
|---|---|
| **📸 Screenshotted** | At least one desktop screenshot captured and filed (mobile screenshot optional but noted if done) |
| **👁 Reviewed** | Visual review completed — layout, spacing, colour, typography, component usage assessed |
| **📝 Decisions Logged** | All design decisions, findings, or follow-up action items recorded in `memory/design_decisions.md` |
| **✅ Done** | All findings actioned (or explicitly deferred), row is closed |

Mark each cell with `[x]` when complete, leave `[ ]` when pending.

---

## Section 1 — Shared Shell & Navigation

These components are rendered on every admin page; review them before individual pages so findings carry through.

| Component | File | 📸 Screenshotted | 👁 Reviewed | 📝 Decisions Logged | ✅ Done |
|---|---|:---:|:---:|:---:|:---:|
| Root admin layout | `app/[orgSlug]/admin/layout.tsx` | [ ] | [ ] | [ ] | [ ] |
| Admin chrome shell | `app/[orgSlug]/admin/AdminChrome.tsx` | [ ] | [ ] | [ ] | [ ] |
| Shared admin CSS | `app/[orgSlug]/admin/admin-common.module.css` | [ ] | [ ] | [ ] | [ ] |
| Admin sidebar nav | `components/admin/AdminSidebar.tsx` | [ ] | [ ] | [ ] | [ ] |
| Admin sidebar CSS | `components/admin/AdminSidebar.module.css` | [ ] | [ ] | [ ] | [ ] |
| Admin bottom nav (mobile) | `components/admin/AdminBottomNav.tsx` | [ ] | [ ] | [ ] | [ ] |
| Top navbar | `components/Navbar.tsx` | [ ] | [ ] | [ ] | [ ] |
| Org nav context | `components/OrgNavContext.tsx` | [ ] | [ ] | [ ] | [ ] |
| Tournament nav sync | `components/TournamentNavSync.tsx` | [ ] | [ ] | [ ] | [ ] |
| Tournament admin UI shell | `components/admin/tournament/TournamentAdminUI.tsx` | [ ] | [ ] | [ ] | [ ] |
| Tournament admin UI CSS | `components/admin/tournament/TournamentAdminUI.module.css` | [ ] | [ ] | [ ] | [ ] |

---

## Section 2 — Admin Hub & Onboarding

| Page | Route | File | 📸 Screenshotted | 👁 Reviewed | 📝 Decisions Logged | ✅ Done |
|---|---|---|:---:|:---:|:---:|:---:|
| Admin hub | `/{orgSlug}/admin` | `app/[orgSlug]/admin/page.tsx` | [ ] | [ ] | [ ] | [ ] |
| Admin hub client | — | `app/[orgSlug]/admin/AdminHubClient.tsx` | [ ] | [ ] | [ ] | [ ] |
| Onboarding checklist | `/{orgSlug}/admin/onboarding` | `app/[orgSlug]/admin/onboarding/page.tsx` | [ ] | [ ] | [ ] | [ ] |

---

## Section 3 — Tournament Entry Points

| Page | Route | File | 📸 Screenshotted | 👁 Reviewed | 📝 Decisions Logged | ✅ Done |
|---|---|---|:---:|:---:|:---:|:---:|
| Tournament list / selector | `/{orgSlug}/admin/tournaments` | `app/[orgSlug]/admin/tournaments/page.tsx` | [ ] | [ ] | [ ] | [ ] |
| Create / manage wizard | `/{orgSlug}/admin/tournaments/manage` | `app/[orgSlug]/admin/tournaments/manage/page.tsx` | [ ] | [ ] | [ ] | [ ] |
| Tournament setup wizard component | — | `components/admin/TournamentSetupWizard.tsx` | [ ] | [ ] | [ ] | [ ] |

---

## Section 4 — Active Tournament Operational Pages

Pages rendered inside the tournament context (sidebar shows tournament nav).

| Page | Route | File | Notes | 📸 Screenshotted | 👁 Reviewed | 📝 Decisions Logged | ✅ Done |
|---|---|---|---|:---:|:---:|:---:|:---:|
| Dashboard | `/{orgSlug}/admin/tournaments/dashboard` | `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` | CSS: `dashboard.module.css` | [ ] | [ ] | [ ] | [ ] |
| Registrations / Teams | `/{orgSlug}/admin/tournaments/teams` | `app/[orgSlug]/admin/tournaments/teams/page.tsx` | CSS: `teams-admin.module.css` | [x] | [x] | [x] | [ ] |
| Schedule | `/{orgSlug}/admin/tournaments/schedule` | `app/[orgSlug]/admin/tournaments/schedule/page.tsx` | CSS: `schedule-admin.module.css`; sub-components: `Generator.tsx`, `PlayoffWizard.tsx`, `GameList.tsx`, `BracketBuilder.tsx` | [x] | [x] | [x] | [ ] |
| Results | `/{orgSlug}/admin/tournaments/results` | `app/[orgSlug]/admin/tournaments/results/page.tsx` | | [x] | [x] | [x] | [ ] |
| Announcements | `/{orgSlug}/admin/tournaments/announcements` | `app/[orgSlug]/admin/tournaments/announcements/page.tsx` | CSS: `announcements-admin.module.css` | [x] | [x] | [x] | [x] |
| Communication | `/{orgSlug}/admin/tournaments/communication` | `app/[orgSlug]/admin/tournaments/communication/page.tsx` | CSS: `communication.module.css` | [ ] | [ ] | [ ] | [ ] |
| Rules | `/{orgSlug}/admin/tournaments/rules` | `app/[orgSlug]/admin/tournaments/rules/page.tsx` | Sub-component: `RulesAdmin.tsx` | [ ] | [ ] | [ ] | [ ] |
| Branding | `/{orgSlug}/admin/tournaments/branding` | `app/[orgSlug]/admin/tournaments/branding/page.tsx` | CSS: `branding.module.css` | [ ] | [ ] | [ ] | [ ] |
| Contacts | `/{orgSlug}/admin/tournaments/contacts` | `app/[orgSlug]/admin/tournaments/contacts/page.tsx` | | [ ] | [ ] | [ ] | [ ] |
| Age Groups | `/{orgSlug}/admin/tournaments/age-groups` | `app/[orgSlug]/admin/tournaments/age-groups/page.tsx` | CSS: `admin-page.module.css` | [ ] | [ ] | [ ] | [ ] |
| Venues | `/{orgSlug}/admin/tournaments/venues` | `app/[orgSlug]/admin/tournaments/venues/page.tsx` | | [ ] | [ ] | [ ] | [ ] |
| Archives | `/{orgSlug}/admin/tournaments/archives` | `app/[orgSlug]/admin/tournaments/archives/page.tsx` | CSS: `archives-admin.module.css` | [ ] | [ ] | [ ] | [ ] |
| Post-Event Summary *(Plus)* | `/{orgSlug}/admin/tournaments/summary` | `app/[orgSlug]/admin/tournaments/summary/page.tsx` | CSS: `summary.module.css`; plan-gated | [ ] | [ ] | [ ] | [ ] |

---

## Section 5 — Settings Sub-Pages

| Page | Route | File | 📸 Screenshotted | 👁 Reviewed | 📝 Decisions Logged | ✅ Done |
|---|---|---|:---:|:---:|:---:|:---:|
| Settings hub | `/{orgSlug}/admin/tournaments/settings` | `app/[orgSlug]/admin/tournaments/settings/page.tsx` | [ ] | [ ] | [ ] | [ ] |
| Settings › Event details | `/{orgSlug}/admin/tournaments/settings/event` | `app/[orgSlug]/admin/tournaments/settings/event/page.tsx` | [ ] | [ ] | [ ] | [ ] |
| Settings › Registration fields | `/{orgSlug}/admin/tournaments/settings/registration-fields` | `app/[orgSlug]/admin/tournaments/settings/registration-fields/page.tsx` | [ ] | [ ] | [ ] | [ ] |
| Settings › Members & Access | `/{orgSlug}/admin/tournaments/settings/members` | `app/[orgSlug]/admin/tournaments/settings/members/page.tsx` | [ ] | [ ] | [ ] | [ ] |
| Settings › Organization | `/{orgSlug}/admin/tournaments/settings/organization` | `app/[orgSlug]/admin/tournaments/settings/organization/page.tsx` | [ ] | [ ] | [ ] | [ ] |
| Settings › Subscription / Billing | `/{orgSlug}/admin/tournaments/settings/subscription` | `app/[orgSlug]/admin/tournaments/settings/subscription/page.tsx` | [ ] | [ ] | [ ] | [ ] |
| Settings shared CSS | — | `app/[orgSlug]/admin/tournaments/settings/settings-access.module.css` | [ ] | [ ] | [ ] | [ ] |

---

## Section 6 — Public Preview Shell (Admin-side)

| Page | Route | File | 📸 Screenshotted | 👁 Reviewed | 📝 Decisions Logged | ✅ Done |
|---|---|---|:---:|:---:|:---:|:---:|
| Preview layout | `/{orgSlug}/admin/tournaments/preview/[slug]` | `app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/layout.tsx` | [ ] | [ ] | [ ] | [ ] |
| Preview root | `/{orgSlug}/admin/tournaments/preview/[slug]` | `app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/page.tsx` | [ ] | [ ] | [ ] | [ ] |
| Preview section | `/{orgSlug}/admin/tournaments/preview/[slug]/[section]` | `app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx` | [ ] | [ ] | [ ] | [ ] |
| Tournament preview nav | — | `components/public/TournamentPreviewNav.tsx` | [ ] | [ ] | [ ] | [ ] |

---

## Progress summary

> Update these counts manually as rows are completed.

| Section | Total pages/components | ✅ Done |
|---|---|---|
| 1 — Shared Shell & Navigation | 11 | 0 |
| 2 — Admin Hub & Onboarding | 3 | 0 |
| 3 — Tournament Entry Points | 3 | 0 |
| 4 — Active Tournament Pages | 13 | 1 |
| 5 — Settings Sub-Pages | 7 | 0 |
| 6 — Public Preview Shell | 4 | 0 |
| **Total** | **41** | **0** |

---

## Notes & cross-references

- Design decisions go in `memory/design_decisions.md` — see also `memory/design_system.md` for token reference and `memory/design_principles.md` for UX philosophy.
- Screenshot storage convention: TBD — agree on folder before first screenshot pass.
- Plan-gated pages (Post-Event Summary, Branding advanced options) should be reviewed in both Free and Plus states.
- Schedule page has the most visual complexity (4 sub-components); treat it as two review passes: list view and bracket view.
