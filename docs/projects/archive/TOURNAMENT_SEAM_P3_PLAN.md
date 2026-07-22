# Tournament Seam — Phase 3 (cohesion & polish)

**Status:** Scoped + owner-approved 2026-07-22 · **Source review:** `TOURNAMENT_SEAM_UX_REVIEW.md` (P3 bucket, items 10 + 12) · **Prior:** P1 committed `5b3743c1`, P2 (WI-2A/2B `6c8805d2`, WI-2C `742eca07`) committed on dev.

Phase 3 = the review's "cohesion & polish" tail. After scouting current state (some P3 items were already handled), the owner confirmed **4 items** to build and **3 to defer**.

## In scope (4 items)

### P3-1 — Offline shell for signed-in (authed) screens  *(headline)*
- **Gap (review §80):** coach/admin/scorekeeper navigations are service-worker *no-intercept* (`isNeverCache` → `return` before the navigate branch in `public/sw.js`), so an offline navigation to a signed-in screen yields the browser's raw error page. Public tournament pages already fall back to the branded `public/offline.html`.
- **Fix:** in `public/sw.js`, intercept **navigations** to never-cache routes with a *network-only + offline fallback* strategy — try network (pass through, incl. redirects), and on failure serve `OFFLINE_URL`. **Never cache authed HTML** (the shared-device PII rule stays intact — `offline.html` is a fixed generic shell with no per-user data). Reorder the fetch handler so the `navigate` branch runs before the `isNeverCache` straight-to-network `return` (which stays for non-navigation authed subresources/API). Add a `navigationOfflineOnly(request)` helper. **Bump `CACHE_VERSION` v7 → v8.**
- **Copy:** make `offline.html` role-neutral (it's shared by fan + staff PWAs) — drop the fan-only "live scores/standings" framing for a generic "reconnect to continue; this page reloads when you're back."
- **Constraint:** no new cached routes; no change to the public-page caching or the no-`skipWaiting` update model. Verify online behavior is byte-identical (fetch passes straight through).

### P3-2 — Coach-view door in the ADMIN shell for Basic (free) coaches
- **Gap (review Finding B / §87):** every Coaches-Portal link in the admin shell is gated behind `hasCurrentOrgCoachAccess` → only enabled when `canSeeRepTeams` (paid `module_rep_teams`). A free-tier owner who runs the tournament AND coaches has no door to their coach view from inside admin.
- **Fix:** add a "Coach view / Coaches Portal" door in `components/admin/AdminSidebar.tsx` (footer/utility area) + `components/admin/AdminBottomNav.tsx` (More sheet), shown when the signed-in user actually coaches — detect coach presence via a signal that covers **basic** coaches (not just `canSeeRepTeams`). Destination = the coaches launchpad (`/coaches`), which lists all their teams. Confirm the presence signal available client-side (basic-coach membership / any coaching assignment); if none exists client-side, fetch a cheap boolean or reuse an existing context value. Never show the door for a non-coach admin.

### P3-3 — Mobile admin → global Chat / Account / Home
- **Gap (review B11):** `AdminBottomNav`'s "More" sheet (the entirety of mobile admin nav) has zero link to `/chat`, `/account`, or `/home`/`/discover`. The only such link is desktop-only + gated to 2+-workspace accounts, so a single-org mobile admin can't reach their own inbox/account from admin.
- **Fix:** add Chat, Account, and Home rows to the `AdminBottomNav` More sheet (consumer/global doors, distinct from the admin-scoped items). Follow the existing sheet-row pattern.

### P3-4 — Coach portal → admin backlink
- **Gap (review §110):** `CoachPortalShell` only offers "All workspaces" (`/discover`) as an up-and-out link. An admin-who-also-coaches has no direct link back to the org admin shell.
- **Fix:** in `components/coaches/CoachPortalShell.tsx` (rail footer + More sheet), add a "Back to admin" link to `/${orgSlug}/admin`, shown **only when the signed-in user is an admin of this org** (role/capability check). No door for a coach who isn't an admin.

## Deferred (owner call 2026-07-22 — NOT building)
- **P3-x session-aware `/` root redirect** — arguably-intentional (signed-in users may want the marketing/public root); routing blast-radius. (PWA-launch redirect already exists.)
- **P3-y capability-filter mobile admin primary tabs** — low visible impact; scoped-staff minority; screens gate on arrival anyway.
- **P3-z unified primary-identity rule (Home vs chip)** — internal refactor, low visible payoff, higher care cost.

## Cross-cutting
- **No migration.** No new top-level consumer routes (the admin/portal doors point at existing routes; the coach door points at `/coaches`, already denylisted in the SW).
- **Handoff:** `sw.js` v7→v8 forces a client SW refresh on deploy (device re-test of offline behavior + normal navigation). Dev-server restart before browser QA (sw.js + shared nav components).
- **Verify:** `npm run verify:changed`; `npm run typecheck` if shared modules/nav config change. Post-build: `/simplify` (if any new shared door helper), `/review` (nav/identity-adjacent + SW change), `/docs` (only if a user-facing labelled flow needs a guide note — likely minimal).

## Definition of done
All 4 built; online SW behavior unchanged + offline authed nav serves the branded shell without caching PII; coach door shown only to coaching admins; mobile admin reaches chat/account; portal shows admin backlink only to admins; typecheck + verify:changed green; `/review` run/offered; TODO + memory updated; commits only with per-action owner OK.
