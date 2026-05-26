# Tournament Admin — Mobile Review Tracker

> **Status:** In Progress
> **Created:** 2026-05-25
> **Branch:** dev
> **Scope:** Phone-sized viewport (390x844 primary; spot-check 375x667 and 430x932).
> **Role under review:** Organization owner/admin on base Tournament subscription.
> **Related docs:**
> - Mobile findings: `docs/active/codex_TOURNAMENT_OWNER_MOBILE_REVIEW.md`
> - Mobile implementation plan: `docs/active/codex_TOURNAMENT_OWNER_MOBILE_IMPLEMENTATION_PLAN.md`
> - Desktop review tracker (separate scope): `docs/active/agent_TOURNAMENT_DESIGN_REVIEW.md`

---

## Phase 0 — Shared Mobile Foundation

These code fixes were applied in a prior session (recorded in the implementation plan) but have **not yet been reviewed or browser-verified** in this mobile review pass.

| Fix | Code Applied | 👁 Reviewed | ✅ Browser Verified |
|---|:---:|:---:|:---:|
| Offset `SelectionActionBar` above fixed bottom nav | ✅ | [ ] | [ ] |
| Raise shared mobile touch targets to 44px minimum | ✅ | [ ] | [ ] |
| Convert Venues to mobile-card pattern + preserve orgSlug in API calls | ✅ | [ ] | [ ] |
| Add actionable fallback for admin hub startup hang | ✅ | [ ] | [ ] |
| Remove casual `Set as Live` from mobile More menu | ✅ | [ ] | [ ] |
| Make locked toolbar menu items tappable (show explanation) | ✅ | [ ] | [ ] |

---

## Page Review Status

### Active Tournament Pages

| Page | Route | File | 👁 Reviewed | 🛠 Fixes Applied | ✅ Verified (browser) |
|---|---|---|:---:|:---:|:---:|
| Registrations / Teams | `/{orgSlug}/admin/tournaments/teams` | `app/[orgSlug]/admin/tournaments/teams/page.tsx` | ✅ | ✅ | [ ] |
| Schedule | `/{orgSlug}/admin/tournaments/schedule` | `app/[orgSlug]/admin/tournaments/schedule/page.tsx` | ✅ | ✅ | [ ] |
| Results | `/{orgSlug}/admin/tournaments/results` | `app/[orgSlug]/admin/tournaments/results/page.tsx` | ✅ | ✅ | [ ] |
| Dashboard | `/{orgSlug}/admin/tournaments/dashboard` | `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` | [ ] | [ ] | [ ] |
| Communication | `/{orgSlug}/admin/tournaments/communication` | `app/[orgSlug]/admin/tournaments/communication/page.tsx` | [ ] | [ ] | [ ] |
| Announcements / News | `/{orgSlug}/admin/tournaments/announcements` | `app/[orgSlug]/admin/tournaments/announcements/page.tsx` | [ ] | [ ] | [ ] |
| Rules | `/{orgSlug}/admin/tournaments/rules` | `app/[orgSlug]/admin/tournaments/rules/page.tsx` | [ ] | [ ] | [ ] |
| Branding | `/{orgSlug}/admin/tournaments/branding` | `app/[orgSlug]/admin/tournaments/branding/page.tsx` | [ ] | [ ] | [ ] |
| Contacts | `/{orgSlug}/admin/tournaments/contacts` | `app/[orgSlug]/admin/tournaments/contacts/page.tsx` | [ ] | [ ] | [ ] |
| Divisions | `/{orgSlug}/admin/tournaments/age-groups` | `app/[orgSlug]/admin/tournaments/age-groups/page.tsx` | [ ] | [ ] | [ ] |
| Venues | `/{orgSlug}/admin/tournaments/venues` | re-exports org diamonds page | [ ] | [ ] | [ ] |
| Archives | `/{orgSlug}/admin/tournaments/archives` | `app/[orgSlug]/admin/tournaments/archives/page.tsx` | [ ] | [ ] | [ ] |
| Post-Event Summary *(Plus)* | `/{orgSlug}/admin/tournaments/summary` | `app/[orgSlug]/admin/tournaments/summary/page.tsx` | [ ] | [ ] | [ ] |

### Settings Sub-Pages

| Page | Route | File | 👁 Reviewed | 🛠 Fixes Applied | ✅ Verified (browser) |
|---|---|---|:---:|:---:|:---:|
| Settings hub | `/{orgSlug}/admin/tournaments/settings` | `app/[orgSlug]/admin/tournaments/settings/page.tsx` | [ ] | [ ] | [ ] |
| Event details | `/{orgSlug}/admin/tournaments/settings/event` | `app/[orgSlug]/admin/tournaments/settings/event/page.tsx` | [ ] | [ ] | [ ] |
| Registration fields | `/{orgSlug}/admin/tournaments/settings/registration-fields` | `app/[orgSlug]/admin/tournaments/settings/registration-fields/page.tsx` | [ ] | [ ] | [ ] |
| Members & Access | `/{orgSlug}/admin/tournaments/settings/members` | `app/[orgSlug]/admin/tournaments/settings/members/page.tsx` | [ ] | [ ] | [ ] |
| Subscription / Billing | `/{orgSlug}/admin/tournaments/settings/subscription` | `app/[orgSlug]/admin/tournaments/settings/subscription/page.tsx` | [ ] | [ ] | [ ] |

### Shell & Navigation

| Component | File | 👁 Reviewed | 🛠 Fixes Applied | ✅ Verified (browser) |
|---|---|:---:|:---:|:---:|
| Admin bottom nav (mobile) | `components/admin/AdminBottomNav.tsx` | [ ] | [ ] | [ ] |
| Tournament admin UI shell | `components/admin/tournament/TournamentAdminUI.tsx` | [ ] | [ ] | [ ] |
| Admin hub / entry routing | `app/[orgSlug]/admin/AdminHubClient.tsx` | [ ] | [ ] | [ ] |
| Mobile More menu grouping | `components/admin/AdminBottomNav.tsx` | [ ] | [ ] | [ ] |

---

## Priority Queue

### P1 — Next up (finish Phase 1 operational pages)
1. **Dashboard** — entry point; clone prompt, branding language, and activation flow issues
2. **Communication** — tournament-day mobile use; compose density and channel controls
3. **Mobile More menu grouping** — setup vs tournament-day vs history separation

### P2 — Setup completeness
4. **Branding** — known high-severity mobile issue: long Plus upsell wall after free Public Pages
5. **Contacts** — likely table density/mobile-card issues
6. **Divisions** — similar data-density pass
7. **Settings hub** — does not expose all base setup routes on mobile

### P3 — Lifecycle and gating polish
8. **Archives** — Plus sealed records appear before free archive history
9. **Settings › Registration fields** — disabled card on mobile (no hover, not tappable)
10. **Settings › Subscription** — Tournament Plus path buried under unrelated plans
11. **Post-Event Summary** — base nav item leads to Plus upgrade card

---

## Open Design Decisions (mobile-specific)

1. Should Dashboard or Settings be the complete setup hub on mobile?
2. Should Summary appear in base mobile nav with a Plus label, or only as a contextual completed-event upsell?
3. Should locked Plus controls open a shared bottom sheet or route directly to the subscription page?
4. Should Workspace Invite move out of the primary mobile registration selection bar?
5. Should Branding be renamed "Public Pages" in mobile nav with advanced branding nested below?
6. Should Archives be split into two sections with plan-specific ordering?
