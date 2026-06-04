# Sign-up Flow Fixes — Implementation Plan

**Status:** In progress (2026-06-04)
**Owner:** Engineering
**Trigger:** Prod sign-up review (b2cowan@gmail.com) surfaced two bugs + a plan-select / email-sequence rework.

## Problems observed in prod

1. **Two emails at sign-up.** The sign-up route fired the founding-season `founding_welcome`
   email ("Tournament Plus is free through Dec 31") *immediately* at sign-up — alongside the
   email-verification email. This is wrong: the org is created on the **free `tournament`**
   plan and the user hasn't verified or chosen a plan yet, so "you have Tournament Plus" is
   premature and contradicts the plan-select screen.
2. **Plan cards unscrollable on mobile.** The onboarding plan-select screen renders inside the
   *focused* admin shell. On mobile the shell is locked to `height:100dvh; overflow:hidden`,
   but `.adminShellFocused` switches it to `display:block`, defeating the flex scroll pattern.
   The plan cards below the fold (and their CTAs) were clipped with no way to scroll → users
   could not select a plan.

## Desired end-state (per product)

- Sign-up sends **only** the verification email.
- After verifying, the user lands on the plan-select screen with **Tournament Plus presented
  first and highlighted as free until Dec 31, 2026**.
- **If they choose Tournament Plus** → a welcome email goes out **~1 day later** (no "set up your
  first tournament" CTA, because the wizard already follows plan selection).
- **If they choose the free Tournament plan** → a marketing upsell email is **queued ~1 week
  later** promoting that Tournament Plus is free this season and highlighting what they're missing.

## Changes

### A. Stop the welcome email at sign-up  ✅
`app/api/auth/signup/route.ts` — remove the `founding_welcome` send block. Keep the founding
`comp_period` override (entitlement) and the verification email. Drop now-unused imports.

### B. Mobile scroll fix  ✅
`app/[orgSlug]/admin/admin.module.css` — in the `≤900px` media query, override focused shells
(`.adminShellFocused` / `.adminMainFocused`) to use natural document scroll
(`height:auto; min-height:100dvh; overflow:visible`) instead of the app-shell viewport lock.
Desktop and the normal app shell are untouched.

### C. Tournament Plus first + featured on plan select  ✅
`components/PricingSection.tsx` + `.module.css` — add optional `order?: OrgPlan[]` and
`featuredPlan?: OrgPlan` props. The onboarding plan chooser
(`app/[orgSlug]/admin/onboarding/page.tsx → renderPlanChooser`) passes
`order={['tournament_plus','tournament','league','club']}` and `featuredPlan='tournament_plus'`.
Public pricing page is unchanged (it doesn't pass the props).

### D. Plan-choice-triggered emails  ✅
- `lib/email-sender.ts` — add `scheduledAt?: string` (ISO 8601) passed through to Resend's
  native `scheduled_at` (no cron needed).
- `lib/email.ts` — new templates `tournamentPlusWelcomeHtml` (CTA → admin dashboard, **not**
  "set up first tournament") and `tournamentPlusUpsellHtml` (free-tier upsell).
- Triggers (already scoped to onboarding):
  - **Welcome (+1 day):** `app/api/billing/create-checkout/route.ts`, inside the
    `isFoundingSeasonTournamentUpgrade` branch when `isOnboardingPlanSelection` — transactional,
    `skipOptOutCheck`.
  - **Upsell (+7 days):** `app/api/admin/org/onboarding-plan/route.ts` (free Tournament first-run,
    already guarded to first-run only) — marketing, respects opt-out.
  - Both are non-fatal (wrapped in try/catch; never block plan selection).

## Known limitations / follow-ups

- **Upsell staleness:** the +7-day upsell is scheduled fire-and-forget via Resend. If a user picks
  Free during onboarding and upgrades to Tournament Plus within the week, they could still receive
  one upsell email. Fast-follow: store the scheduled Resend message id and cancel it on upgrade
  (cancel-on-upgrade), or move to a daily cron with a condition-at-send check.
- **Upsell timing** is set to **7 days** (constant `UPSELL_DELAY_DAYS`). Product was undecided
  between 1 week and 1 month — easy to change in one place.

## Verification

- `npm run typecheck` (shared modules + API routes touched).
- Restart dev server (new templates + shared email-sender + API routes + new files).
- Browser (user): mobile plan-select scroll; Tournament Plus shown first/highlighted; sign-up
  sends only the verification email; choose-Plus and choose-Free email scheduling.
