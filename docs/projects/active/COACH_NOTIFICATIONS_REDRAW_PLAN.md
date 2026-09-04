# Coach Notifications Redraw — plan of record

**Status: BUILT on dev 2026-09-03 (uncommitted), owner QA = ledger §138. No migration.**
Review that produced it: `COACH_NOTIFICATIONS_REVIEW.md` (phase 1 findings, phase 2 assessment).
Mockups = the spec: Claude Artifact "Coach Notifications Redraw"
`https://claude.ai/code/artifact/56f7093f-2142-4891-970a-230dd033568c`.
PM brief: `COACH_NOTIFICATIONS_REDRAW_PM_BRIEF.md`.

## Owner decisions (2026-09-03, all six taken from the pictures)

| # | Decision | Ruling |
|---|---|---|
| D1 | The coach route wears the house header; the feed body stays shared; tokens fixed at the token (R1 · R2 · R10) | **Approve** |
| D2 | The way home from Notification settings | **Option B** — pinned return bar + the two doors carry `?back=` |
| D3 | "Mark all read" marks Activity only; Needs-attention rows clear when opened (R5) | **Yes** |
| D4 | The desktop bell panel's skin (R9) | **Warm**, like the popovers beside it |
| D5 | The sidebar keeps the team's navigation on this page (R7) | **Yes** |
| D6 | A coach's "Game moved" opens their own Schedule (R4, the S half) | **Yes, in this build** |

Deferred by the same rulings: **R8** (client navigation on tap + URL-remembered filters) to a second
pass; **D4 recipient scoping** (coach-role members receiving org-admin events at all) stays its own
ticketed project — the feed still shows those rows, deliberately.

## What shipped (by file, for the engineer)

**The feed split — one body, two frames (D1)**
- `components/notifications/useNotificationFeed.ts` — NEW. All page state (load, page, zones,
  bundles, mark-read, mark-all) as a hook; `error` is now a state, not a swallowed catch.
- `components/notifications/NotificationFeedBody.tsx` — NEW. Toolbar · list · Load more · the three
  quiet states (loading, failed with Try again, empty with per-shell copy). Shared by both shells.
- `components/notifications/NotificationsPageContent.tsx` — now the ADMIN frame only (its header
  gained `flex-wrap` so the admin page stops scrolling sideways on a phone too).
- `components/coaches/CoachNotificationsPage.tsx` — NEW. The coach frame: `CoachPageHeader` (Bell
  tile, "Notifications", actions with `.headerBtnLabel` so they go icon-only on phones, the "?"
  pointing at the portal-tour bell subtopic) + the shared body with coach empty-state copy.
- `app/[orgSlug]/coaches/notifications/page.tsx` — renders the coach frame.

**Tokens (R2) and touch floors (R10)**
- `components/notifications/notifications-page.module.css` — rewritten: every text colour reads
  `--text-secondary` / `--text-tertiary`; row separators and day-header bands read `--home-line` /
  `--home-paper` with alpha fallbacks for the admin shell; `@media (max-width: 768px)` gives chips,
  the toggle, Load more and Try again the 44px floor; new `.chipCount`, `.sectionHint`, error and
  empty-state styles.
- `components/notifications/notifications.module.css` — the bell panel's text tokens swept the same
  way (title, chips, chevron, headers, body, time, empty, loading, footer links).
- `tests/unit/warm-palette-contrast.test.ts` — the unread-row tint `#F4F5F1` joins `GROUNDS`.
- ⚠ The other five coach-reachable stylesheets that paint with `--white-30/25/20` were re-read and
  **deliberately left**: every remaining use is punctuation, a chevron/glyph, a placeholder, a
  hover border or a dark-only surface (their own comments say so — `.statStripDot`, `.wltSep`,
  `.lineupZero` carry the "punctuation, not text" note). No prose remains on the hairline.

**The way home (D2 = Option B)**
- `components/coaches/CoachTopStrip.tsx` — the bell's settings door appends `?back=<pathname>`
  (the AccountMenu row already did); the bell gets `warm`.
- `components/coaches/CoachNotificationsPage.tsx` — the feed's door appends `?back=` too.
- `app/(consumer)/account/AccountReturnBar.tsx` + `account.module.css` — the bar is
  `position: sticky` under the consumer top bar (`--consumer-top-h`), paper ground, `id`
  `account-return-bar`.
- `app/(consumer)/account/notifications/AccountNotificationsClient.tsx` — the `?focus=` arrival
  scroll also clears the bar's height.

**Mark all read = Activity only (D3)**
- `lib/notification-labels.ts` — `ACT_EVENT_TYPES`, derived from `NOTIFICATION_CATEGORY`.
- `app/api/notifications/route.ts` — `mark-all-read` excludes those event types (the truth).
- `NotificationPanel.tsx` + `useNotificationFeed.ts` — optimistic updates use the same set; the
  button renders only when an unread ACTIVITY row exists. ⚠ The admin bell inherits the rule (one
  API, one meaning).

**Bell panel warm (D4)**
- `NotificationBell.tsx` / `NotificationPanel.tsx` — `warm` prop; the panel root carries the coach
  shell's own marker (`coachWarmAttr`), so the warm token block reaches the body-portaled panel with
  no second copy of the palette. `.panelWarm` swaps only the shadow.

**Sidebar keeps the team (D5)**
- `lib/coach-nav-visibility.ts` — `resolveNavTeamId()`, ONE fallback rule (URL → first live team →
  first closed team), used by `CoachesSidebar` and `CoachesBottomNav`. The rail's "remember last
  team" effect now stores the URL's team, never the fallback.

**Coach copy of "Game moved" (D6)**
- `lib/family-notify.ts` — recipients split by hat via `getRepTeamCoaches(programYearId)`;
  coaches get `/{org}/coaches/teams/{team}/schedule`, families keep `/family/teams/{team}`. Lookup
  failure degrades to the family link, never to silence.

**Fixture**
- `scripts/seed-uat-coach-notifications.mjs` — the busy feed the review seeded (64 rows, 16
  unread, tag `notif-review`), so the sweep and the owner's walk measure the real state.

## Verification (run 2026-09-03)

- [x] `npx next typegen` + `npm run typecheck` — clean
- [x] `npm run lint:focused -- <changed files>` — 0 errors; 5 warnings, all the pre-existing
      navigate/effect idioms the P4 build accepted (window.location assignment, load-in-effect)
- [x] `npm run check:contrast` — green with the new ground (`--home-dim` 6.18:1 on the unread tint)
- [x] `npm run check:layout -- --only=coach-notifications` on the seeded fixture — **zero new
      findings at 361/390/768/1440**; the 15 grandfathered tap-floor entries no longer reproduced and
      were removed by hand (chips 44, toggle 44, settings link 44, Mark all read 44 — measured)
- [x] Playwright as the UAT coach — at 390: `scrollWidth 390 = clientWidth`, Mark all read right edge
      358px / 44px tall, timestamps and day headers `rgb(97,90,84)`, the "?" and tile present, settings
      href carries `back=`; Mark all read left the 3 Needs-attention rows unread **after a reload**
      (server truth) and the button hid; the return bar `position: sticky` at top 48px, visible after
      the focus scroll at 390 (scrollY 72) and 1440 (scrollY 314); at 1440 the rail listed the team's
      nav with the switcher resolved; the bell panel carried the warm marker, white ground, olive
      border, ink title, dim time
- [x] `npm run verify:changed` — green end to end (2,841 unit tests; the coach page-header guard
      first refused the new header until it was enumerated in `SITES` and logged in the archived
      header-actions plan §10 — done; every other check passed unchanged)
- [x] Owner QA walkthrough artifact (ledger §138):
      `https://claude.ai/code/artifact/74443f14-cdfc-4a95-98bf-6b73ef533c1b`
- [ ] `/review` and `/docs` offered at hand-off (not yet run)

## Open after this build

- **R8** — client navigation on row tap, zone/toggle in the URL, Load more hidden under a filter.
- **D4 scoping** — coach-role members still receive org-admin events with admin links (ticketed).
- **Demo sandbox** — both demo orgs have zero notification rows; the bell is silent in the shop
  window (log for `DEMO_SANDBOX_DRIFT_GUARDS_PLAN.md`).
- **Help docs** — the phone FAQ and portal-tour bell paragraph stay true; `/docs` to confirm the
  Mark-all-read sentence.
