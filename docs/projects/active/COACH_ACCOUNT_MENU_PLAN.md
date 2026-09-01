# Coach Account Menu — the account door opens in place

**Status:** Approved 2026-09-01 (owner: "go ahead with your recommendations"). Mockup of record:
Claude Artifact "The Account Popover" (b9d8a1f6-d80b-439e-9fd2-4ffea6e32f1c) — Version A, all
question leans accepted. PM brief: `COACH_ACCOUNT_MENU_PM_BRIEF.md`.

## The ruling this completes

The 2026-07-31 chat-door removal established that a strip door which ejects the operator into
consumer chrome is the weaker of two doors. The account door was the last one in either strip still
making that trip (with no rescue link — only Chat ever got one). Both strips' other doors (bell,
Workspaces) already open in place. The avatar becomes the third.

## Decisions (all owner-ruled 2026-09-01)

1. **The avatar opens a menu** on both strips (coach + admin parity, one shared component).
   Rows: identity header (signed-in email) · Appearance Warm/Dark inline (**coach strip only** —
   tournament pages ignore the personal theme, a dead toggle reads as broken) · Notification
   settings (deep-links the org-focused pane, same door as the bell's gear) · Send feedback
   (opens the shared feedback dialog in place) · Account settings (`/account`) · Sign out.
2. **Help does NOT join the menu.** The sidebar's Help (with its ReleaseDot) stays the one help
   door; the masthead "?" stays contextual help. No-duplicate-doors holds.
3. **Sidebar sign-out is REMOVED** (desktop). The menu owns sign-out on desktop; phones keep the
   More sheet's sign-out, whose label unifies "Logout" → "Sign out" (one-spelling rule — three
   surfaces said it two ways).
4. **Sign out lands on the sign-in page** (`/auth/login`), matching the portal's existing
   behavior; no confirmation step. The consumer account page keeps its Discover landing
   (fan-side convention, deliberately not unified).
5. **Walls** (billing-suspended / not-assigned) keep the menu **minus Send feedback** — portal
   function stays off a wall exactly as the bell does; identity + exits remain.
6. **Sandboxes:** the avatar is hidden in the coach demo (new — mirrors the admin strip's
   existing gate). A "Sign out" on the shared demo account must never render.
7. **Return bar on the account pages:** arriving from a portal (menu rows carry
   `?back=<current path>`), `/account*` shows "← Back to your <Coaches Portal|Admin Area>" —
   Chat's A3-QA bar extended to its second surface. Label vocabulary from
   `lib/workspace-labels.ts`. Sanitized via `safeNextPath` + portal-prefix check; fans and
   direct visits never see it. v1 limitation (accepted): the bar lives on the arrival URL —
   navigating the account rail drops the param and the bar.

## Build

- `components/shared/AccountMenu.tsx` + `.module.css` — modeled on `WorkspacesPill` (same
  `useDismissable`, route-change close via lastPath pattern, HUD-token popover with `.warm`
  remap). Email from `getSession()` (local, no network) on first open. Theme block reuses
  `applyTheme`/`getEffectiveTheme`/`THEME_CHANGE_EVENT` + the `/api/account/theme` PATCH
  exactly as `AppearanceCard`. Feedback mounts the shared `FeedbackWidget`.
- `CoachTopStrip`: `showBell` prop generalizes to `wall` (bell off AND feedback row off);
  `useIsSandbox` hides the menu in the demo. Comment block updated (account is no longer a
  leave-this-place door; the strip's three controls all open in place, doors live inside them).
- `AdminTopStrip`: the `!inSandbox` account link becomes the menu (no theme, no warm).
- `CoachesSidebar`: sign-out button + handler + dead imports removed.
- `CoachesBottomNav`: "Logout" → "Sign out".
- `app/(consumer)/account/AccountReturnBar.tsx` (client, `useSearchParams` under Suspense),
  mounted by the account layout; styles in `account.module.css`.
- Tests: `tests/uat/scenarios/coach-wall-doors.spec.ts` re-targets the menu trigger + its
  Account settings row. ⚠ `check:layout` keys findings by element type — the avatar changes
  link→button on every coach page, so the sweep baseline re-keys on its next run.

## QA

Owner QA Ledger §127 (walkthrough: menu on both strips, theme flip persists, feedback dialog,
notification deep-link + return bar round trip, sign-out landing, wall variant, demo sandbox
hides the avatar, phone More sheet unchanged but relabeled).
