# Coach Notifications screen — review and assessment (2026-09-03)

**Answers the owner's ask in `COACH_NOTIFICATIONS_REVIEW_PROMPT.md`.** Phase 1 (look) and phase 2
(assess) are in this file. Phase 3 (mockups) is the Claude Artifact **"Coach Notifications Redraw"**
— `https://claude.ai/code/artifact/56f7093f-2142-4891-970a-230dd033568c` — which ends in the owner's
decision sheet (D1–D6). **⚠ SUPERSEDED AS A STATUS LINE: the owner took all six decisions on
2026-09-03 (D1 approve · D2 Option B · D3 yes · D4 warm · D5 yes · D6 yes) and the build shipped on
dev the same day — see `COACH_NOTIFICATIONS_REDRAW_PLAN.md` (what shipped, by file) and ledger §138.
The findings and assessment below are the record of what was measured BEFORE the build.** Every finding below was measured on the rendered page (the layout
gate + Playwright computed styles), not read off the stylesheet; the given findings from the
hand-off were re-measured, one of them is wrong and is challenged in §1.6.

> **Fixture note.** The UAT coach had **3 rows, all weekly digests** — which is why the baseline
> never recorded "Mark all read" (it only renders when something is unread). To look at the screen
> a coach actually gets, **64 realistic rows (16 unread) were seeded for the UAT coach on dev**,
> tagged `metadata.seed = 'notif-review'` and idempotent (`scripts/seed-uat-coach-notifications.mjs`,
> untracked; remove with the same tag). Every number below says which fixture it came from.

---

## Phase 1 — What was found

### 1.1 The screen, in one paragraph

`/{org}/coaches/notifications` is the admin shell's "See all" page wearing the coach shell: a
15-line route around one shared component whose stylesheet was written for the dark admin theme and
has no responsive rules. On a **phone it is the coach's only notifications surface** (the bell exists
only in the desktop strip, >900px; phones reach the page from the More sheet), and that is exactly
where it is broken. On a **desktop it duplicates the bell panel** — the same 40 rows, same zones,
same bundles — adding only zone chips and Load more.

### 1.2 The rendered gate — thin fixture vs a coach's real feed

`npm run check:layout -- --only=coach-notifications`, both runs exit 1:

| Fixture | New findings | 361 · 390 · 768 · 1440 | Kinds |
|---|---|---|---|
| Thin (3 digests) | **31** | 16 · 16 · 10 · 4 | 2 page-overflow, 2 control-offscreen, 3 tap-floor, 8 content-overflow, 16 contrast |
| Busy (64 rows) | **66** | 25 · 25 · 19 · 12 | same + 48 contrast, 6 tap-floor |

15 further tap-floor entries for this screen already sit in the baseline **with no reason recorded**
(the three chips at 26px, Unread/All at 22px, the settings link at 33px, at 361/390/768).

### 1.3 A coach cannot do this at all

| # | Finding | Evidence | Given / mine |
|---|---|---|---|
| A1 | **"Mark all read" is unreachable on a phone.** The header row wants 443px; nothing may shrink or wrap. | 82px past the edge at 361, 53px at 390; page scrolls sideways; 28px tall against the 44px floor | given, re-measured |
| A2 | **Timestamps and the day headers are invisible.** `--white-30` remaps to the hairline token in the warm portal. | "4d ago", "Today / Yesterday / Earlier" at **1.43–1.44:1**; 48 contrast findings on the busy feed; the bundle chevron and "Loading…" use the same token | given, widened |
| A3 | **No way back from Notification settings on a phone.** The link lands in the consumer shell (Home · Scores · Chat · Account); the desktop-only "Coaches Portal" pill does not render on a phone. | Feed link: `/account/notifications?focus=coach-{org}` with **no `back` param**; the account-menu door already appends `?back=` and gets the "← Back to your Coaches Portal" bar — the two notification doors never got it. And on desktop the `?focus=` scroll pushes that bar above the fold on arrival. | given, sharpened |

### 1.4 A coach can, but it is unpleasant or confusing

| # | Finding | Evidence | Given / mine |
|---|---|---|---|
| B1 | **Most rows eject the coach into a different shell.** Coach-role members receive every org-wide event because `notify()` fans out to all active members (the parked D4 scoping bug), and those rows carry admin links. A coach-role session **opens the admin registrations page and it renders** (h1 "Teams", admin shell); `/admin/rep-teams` and `/admin/org/billing` bounce to the admin dashboard. "Game moved" links to the **family app**; announcements, playoffs and champions link to the **public site**. Four shells from one list. | Real dev data: 16 coach-role members, 28 rows; of the 23 that show in the bell, **14 link into `/admin/`**, 9 are digests. Verified by navigation as the UAT coach. | mine |
| B2 | **"Needs attention" is a triage list that "Mark all read" dissolves.** Act rows are pinned only while unread; the three act events a coach can actually receive (assistant approval, no-show, the club's failed payment) are **all admin decisions**. | Busy fixture: Mark all read → zone gone, 14 rows unchanged, 3 admin-only items now "handled". | mine |
| B3 | **Every tap is a full page reload after a round trip.** The row awaits its mark-read POST, then sets `window.location`. Back returns to the top with filters reset and paging lost. | ~950ms tap-to-navigate at 1440; no URL state for zone/toggle/cursor | mine |
| B4 | **The desktop sidebar goes empty here.** Outside a team route it shows "Choose a team…" and Help — the coach's whole navigation disappears on this one screen. The phone bar resolves a default team; the sidebar does not. | 1440 screenshot | mine |
| B5 | **The filters disagree with each other.** "Needs attention" ignores the Unread/All toggle (unread only, always); Load more is offered in every filtered view and fetches rows the filter will hide. | chip=needs + All → 3 rows; Load more present in all three chip states | mine |
| B6 | **A failed load is shown as an empty feed.** The fetch failure is swallowed and the page prints "No notifications yet". The portal has `CoachLoadError` for exactly this. | code path; a phone at a rink is the ordinary case | mine |
| B7 | **The bell panel is dark inside a warm portal.** It is portaled to `<body>`, so it escapes the warm marker — the two popovers beside it in the same strip (account, Workspaces) are warm-aware. No ruling covers it (the help drawer's dark ruling is about help). | 1440 screenshot | mine |
| B8 | **Not the house page header.** Hand-rolled title at 21.6px/800 with a subtitle (the header ruling has no subtitle slot), no icon tile, no "?" help button — the only coach page with none. | computed styles; `hasHelp: false` | mine |
| B9 | **The feed does not live-update; the badge does.** A row arriving while the page is open changes the More/bell count and not the list. | `useNotificationUnread` subscribes; the page fetches once | mine, minor |

### 1.5 Cosmetic

| # | Finding | Evidence |
|---|---|---|
| C1 | Row separators are paper-on-white (`--white-5` → `#F8F4ED` on `#FFFFFF`), so read rows merge into one block. | computed `borderTopColor` |
| C2 | Chips 26px, Unread/All 22px, settings link 33px, Load more 33px on touch widths. | baseline + busy sweep |
| C3 | The feed's chrome tokens are three sizes below the type ladder's `support` step (10.24px chips and day headers). | computed |

### 1.6 The given findings, challenged

- **"`.markAllBtn`'s border is `--blueprint-blue`, the platform-admin accent, in a portal whose accent is olive" — wrong on the rendered page.** The warm block remaps `--blueprint-blue-rgb` to `--home-olive-rgb`; the border measures `rgba(87, 101, 30, 0.4)` and the list border `rgba(87, 101, 30, 0.2)`. Navy appears only under the explicit dark theme, where navy is the operator accent. Not a defect.
- **The offscreen "Mark all read" is real but fixture-fragile.** It renders only with unread rows; the 15-entry baseline was taken when the UAT coach had none, so the gate had been green over a control it never saw. The seeded fixture makes the finding reproducible.
- Everything else in the hand-off re-measured as stated.

### 1.7 What could not be seen

- **Three teams in one org, 200 rows**: the seed is one coach, one org, 64 rows. Rows carry no team id (only the digest's metadata does), so a per-team lens cannot be evaluated or built until `notify()` carries one.
- **The dark coach theme**: every measurement is warm (the default). The stylesheet was written for dark, so dark is presumed fine; not measured.
- **The demo sandbox**: both `riverdale-*` orgs have **zero notification rows**, so a prospect who opens the bell sees "No notifications yet". Not a defect in this screen — a shop-window gap for the demo drift plan.
- **Assistant coaches**: the fixture's coach is a head coach.

---

## Phase 2 — Assessment and recommendations

### 2.A The review, ranked by what it costs a coach

1. **The rows send a coach into the admin shell, the family app and the public site (B1).** This is the real "forces you out". It is not a feed defect — the feed only shows it — and its fix is the parked recipient-scoping project (D4), plus one link fix (a coach's "Game moved" should open their own Schedule).
2. **The phone is the only surface and it is the broken one (A1, A2, C2).** Sideways scroll, an unreachable control, invisible time.
3. **Settings has no way home on a phone (A3)** — and the mechanism already exists three menu rows away.
4. **"Needs attention" holds admin decisions and "Mark all read" erases them (B2).**
5. **The page loses the coach's place: empty sidebar, full reloads, reset filters (B3, B4, B5).**
6. **Error, empty and chrome consistency (B6, B7, B8, C1).**

**Is the feed useful?** On a desktop, honestly, very little beyond Load more — the bell panel already has the zones and bundles. On a phone it is essential, because there is no bell. Design it phone-first and treat desktop as the archive view it already is.

### 2.B The "forces you out" question — recommendation

**Keep the universal settings page. Give the two notification doors the way home that the account-menu door already has, and make it impossible to lose.** Concretely: the feed's link and the bell footer's link append `?back=<current path>` exactly as `AccountMenu` does; the "← Back to your Coaches Portal" bar becomes **sticky** so the `?focus=` scroll cannot hide it and it renders on a phone. Size **S**.

Why not a settings page inside the portal (D2 allows it): the coach card on the universal page has **one row** (Weekly summary). Everything else a coach configures — the device registration, the pause switch, and the **Followed-teams switches the help guide sends coaches to for schedule alerts** — lives on the same universal page because it is account-level. A portal-hosted page either duplicates four cards for one toggle, or shows one toggle and a link out. Both cost more than they give. Revisit only if the coach card ever grows real coach-only rows.

What the coach sees after: they tap Notification settings, the page looks the same as today (it is already warm paper), and a pinned bar at the top says "← Back to your Coaches Portal" on every width. What it costs us: two hrefs and one CSS rule.

### 2.C The borrowed-component decision

**Keep the feed body shared; let each shell own the frame; fix the ink at the token layer.**

- **Shared:** the data loading, zones, day grouping, bundling, rows and Load more stay one component (they already share `lib/notification-view.ts` with the bell, and the plan's "no drift" reason still holds).
- **Per shell:** the coach route wraps that body in `CoachPageHeader` (icon tile, "Notifications", actions, the "?" — the house shape whose phone grid and 44px floor already exist). The admin route keeps its own header. This is where A1, B8 and the missing help button are fixed, and it is the shape every other coach page already has.
- **Tokens:** the shared stylesheet stops painting text with `--white-N` and uses the semantic inks (`--text-secondary`, `--text-tertiary`) and the hairline (`--home-line` with a dark fallback), which both shells define. **This is not a call-site colour pick** — the same remap paints text with `--white-30/25/20` on **30 lines across 17 stylesheets**, seven of them reachable in the coach portal (the bell panel ×4, `coaches.module.css` ×4, chat ×2, Home ×2, teams ×1, globals ×3). Sweep those in the same change and add the unread-row tint (`rgb(244,245,241)`) to the palette test's grounds; it is a ground the test does not hold.
- **What is lost:** nothing functional. The alternative — a coach-only feed — would fork ~250 lines of JSX/CSS and leave the admin page with the same invisible timestamps in any future light admin theme.

### 2.D Improvements, ranked, with sizes

| # | Recommendation | Fixes | Size |
|---|---|---|---|
| R1 | Coach route adopts `CoachPageHeader`: Bell icon tile, title, actions **Notification settings** + **Mark all read** (icon-only on phones, 44px floor), "?" → the existing phone-notifications FAQ. Subtitle dropped per the header ruling. | A1, B8, C2 (header) | S |
| R2 | Re-token the feed stylesheet to semantic inks/hairlines and sweep the seven coach-reachable stylesheets that paint text with `--white-30/25/20`; add the new ground to the palette test. | A2, C1, C3 | S–M (portal-wide) |
| R3 | `?back=` on the feed and bell settings links; sticky return bar on `/account`. | A3 | S |
| R4 | Coach links land in the coach portal: split `family_game_update` recipients by hat so a coach's copy links to their Schedule; **and** finish D4 so coach-role members stop receiving org-admin events at all. Until then, hide nothing — the feed is where the bug shows, not where it lives. | B1, B2 (root) | S + M (D4 is its own ticketed project) |
| R5 | "Mark all read" marks **Activity** only; Needs-attention rows clear when opened. One-line behaviour change, worth an owner ruling because it changes what the button means. | B2 | S |
| R6 | Failed load → `CoachLoadError` with Try again; first-run empty → `CoachEmptyState` with honest copy about what arrives here. | B6 | S |
| R7 | Sidebar keeps the team nav on this page (resolve the default team the way the phone bar does). | B4 | S |
| R8 | Client navigation on tap (mark read in the background), zone/toggle in the URL so Back restores; Load more hidden under a zone filter. | B3, B5 | M |
| R9 | Bell panel warm skin (its own warm rule, like the phone More sheet has) — or rule it dark like help. Owner call; recommend warm to match the two popovers beside it. | B7 | S |
| R10 | Touch floor on chips, toggle and Load more at ≤768 (the header rule's pattern). | C2 | S |
| — | **Leave alone:** zones, bundling and day grouping (they work and match the bell); the page defaulting to All; a per-team filter (rows carry no team id); live updates on the page (the badge covers it); the demo's empty bell (log it for the demo drift plan, not this build). | | |

**Build order if approved:** R1 + R2 + R3 + R6 + R10 in one pass (the screen becomes reachable and legible); R4's link split and R5 with it if ruled; R7, R8, R9 second.

---

## How the owner can check this

- Sign in as `uat-coach@uat-test-org.local` / `UATPassword2026!`, phone width, More → Notifications. The seeded feed shows Needs attention (3), Today, Yesterday, Earlier, bundles and Load more. Scroll sideways to find Mark all read; try to read a timestamp.
- Tap **Notification settings** on a phone; look for a way back. Then open the avatar menu on desktop and take its Notification settings row — that one has the bar.
- Tap **4 new registrations** — you are in the admin shell.
- `npm run check:layout -- --only=coach-notifications` (the `=` is required) reproduces the counts above.
