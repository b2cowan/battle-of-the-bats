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

## Public pages (owner ask 2026-10-16)

The owner asked for the account button to "behave the same way" anywhere it exists. Three public
doors still linked straight to `/account`; all three now mount `AccountMenu`:

| Surface | Trigger | Notes |
|---|---|---|
| Public tournament strip (`ConsumerNav` tournament variant, >900px) | the person glyph, `.stripIcon` skin | already inside the strip's `!inSandbox` cluster |
| Org public identity row (`Navbar` org branch, desktop) | the word "Account", `.actionLink` skin | hidden in a demo org (`isDemoOrgSlug`): the menu carries Sign out; the phone shed rule hides the whole wrapper |
| Marketing bar, signed in (`Navbar` marketing branch) | the quiet pill, identical shell + face (glyph-only ≤375px) | the only phone placement — the popover re-anchors to `.marketingActions`' right edge ≤900px so it can't start off-screen |

- **Theme: off on all three** — organizer colors on the event/org pages, an always-dark marketing bar.
- **Deliberately unchanged:** the Account TABS (consumer top row, every phone bottom bar). A tab is a
  location marker; one that pops a menu can no longer say "you are here", and the Account screen it
  opens is the full version of this menu.
- **Sign out on a public page reloads in place** (`signOutTo="here"`) — **Proposed, owner yes owed.**
  Nothing on a public page is protected, and a fan following an event should still be looking at it
  afterwards. Portals keep decision 4 (→ sign-in page).
- Component: new `children` (trigger content), `signOutTo`, `wrapClassName` props; the button reset
  became `:where(.trigger)` (zero specificity) so a host's own border/padding always beats it
  regardless of bundle order. The coach/admin `.iconDoor` sets neither, so the strips are unchanged.
- ⚠ `check:layout` re-keys these three doors link→button on its next baseline run — expected.
- **/review (standard tier, 2026-10-16):** 3 lenses, no Critical/High/Medium. One Low fixed: the two
  client demo gates (the tournament strip's `inSandbox`, the org row's) compared the raw URL
  segment while the router — and every other demo predicate — decodes it, so `/%72iverdale-…` was
  the demo to the session rule and a stranger to the gate. That gate now hides a Sign out which,
  on the shared demo account, ends every visitor's session (`signOut()` is Supabase's default
  global scope). Both gates now run `decodePathSegment`.
- **/docs (2026-10-16):** tournaments guide → "A door to the wider app" describes the menu; the
  follow FAQ's "(and as a row in the account menu opened from the header chip)" was removed — no
  such row or chip exists, and with a real account menu on the strip it would send fans hunting.
  Org guide → "How visitors get into the app" names the desktop Account menu. Search fields carry
  `account menu` / `sign out`.
- Found on the way (not changed): the marketing quiet pill's `border border-blueprint-blue/40`
  never paints — Tailwind preflight is off, so nothing sets `border-style` and the outline is
  invisible on both the Sign In and Account states.

## QA

Owner QA Ledger §127 (walkthrough: menu on both strips, theme flip persists, feedback dialog,
notification deep-link + return bar round trip, sign-out landing, wall variant, demo sandbox
hides the avatar, phone More sheet unchanged but relabeled).
