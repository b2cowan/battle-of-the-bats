# Notifications Open in Place — plan

**Status:** D1–D9 accepted 2026-10-05 (owner, on round 3: "looks good"). Hub (Mockup · Decisions · PM Brief · Plan
notes): https://claude.ai/artifact/X78EK19TCyba8wTLAfCfyZ, source `docs/projects/active/NOTIFICATIONS_OPEN_IN_PLACE_HUB.html`.
PM brief: `NOTIFICATIONS_OPEN_IN_PLACE_PM_BRIEF.md`. Build prompt (one step per chat):
`NOTIFICATIONS_OPEN_IN_PLACE_BUILD_PROMPT.md`. Ruling recorded in `memory/design_decisions.md` (2026-10-05).

Started from the owner's screenshot of the club bell on Accounting › Payment requests: every row cut to one line, and a
click leaving for a page it never names (the first row reloaded the page he was on).

## The rulings

| # | Ruling |
|---|---|
| D1 | A click on a notification OPENS it (kind, day + clock, whole title and message) and marks it read; going to the page is a second click on a button that names the page. |
| D2 | On a computer the bell opens a DRAWER on the right (380px, full height under the top strip) holding the list; a click opens a 440px message pane to the LEFT of the list (820px total), the selected row highlighted, another row swaps the message. × on the pane → list alone; × on the drawer, Escape, or a click on the light dim → closed (Escape closes the pane first). A row read this visit stays in the list until the drawer closes, even under Unread. |
| D3 | An opened notification has: Open [the place] · Done (Needs attention only) · Delete (trash, set apart at the right) · a way to close (× in the drawer, Close on a phone). Delete = own copy only, at once, Undo for a few seconds, no confirmation. No Mark read button. Trash also on the row under the pointer / keyboard focus. |
| D4 | The onward button names the page in that screen's own words and lands on the record ("Open the request", "Open the bill", "Open Registrations", "Open the team"). The holding-payout notice carries its request when exactly one is held. "Open in admin" survives only as the fallback for a coach who received an admin notice. |
| D5 | The admin's Notifications page opens notifications too: a menu-layer sheet above the bottom bar on a phone, a dialog on a computer. |
| D6 | On a computer the drawer IS the list: Unread / All, Mark all read, the list by day, Load more, the settings gear in its header. The "See all" link goes. Both Notifications pages stay (they are the phones' home). The page's All / Needs attention / Activity chips stay out of the drawer. |
| D7 | Two panes at every width the drawer exists (> 900px). |
| D8 | Clear becomes **Done** everywhere a customer reads it (rows, both pages, the reader, the zone hint "stays until you mark it Done", help + its keywords). Prose only: the API action `clear` and column `cleared_at` keep their names. |
| D9 | Mark all read marks EVERYTHING read, Needs attention included. Reverses the owner's 09-03 rule, whose reason ended 09-06 (only `cleared_at` moves a row out of Needs attention). Must never write `cleared_at`. |

## Facts the build stands on (verified in code 2026-10-05 — re-verify, they are leads)

- **The bell exists only on a computer.** It is mounted by `AdminTopStrip` and `CoachTopStrip`; both strips are hidden
  at ≤ 900px (the admin shell zeroes `--admin-topstrip-h`; `CoachTopStrip.module.css` is `display: none`). Phones reach
  `/{org}/admin/notifications` from `AdminKitBottomNav`'s More sheet and `/{org}/coaches/notifications` from the coach
  More sheet. So the drawer is computer-only, and `NotificationPanel`'s ≤ 900 rules in `notifications.module.css` are
  dead code.
- **The reader exists:** `components/coaches/CoachNotificationReader.tsx` (09-25, OQA §234) — eyebrow (`iconFor` +
  `NOTIFICATION_EVENT_LABELS` + `notificationStamp`), title, body or bundle members, onward `<a href>` named by
  `notificationDestination`, Clear, Close; menu-layer sheet ≤ 900, 480px dialog above. Only `CoachNotificationsPage`
  passes `onOpen` to `NotificationFeedBody`.
- **⚠ Sheet Frame step 4 moves this reader's FRAME onto `SheetFrame`** (`components/coaches/SheetFrame.tsx`, menu layer,
  committed `9ab32b23`). This project lifts its CONTENT into a shared block. Same file — whichever lands second adapts;
  check `git log`/`git status` on the file first.
- **API** (`app/api/notifications/route.ts`): `mark-read`, `mark-all-read` (skips Needs-attention types via
  `ACT_EXCLUDE_IN`), `clear` (writes `cleared_at` + `read_at`). Every write is `.eq('user_id', user.id)`. Rows are per
  recipient (`notify()` writes one per user). Nothing purges old rows.
- **The zone:** Needs attention = act type AND `cleared_at` null (since 09-06); read state does not move a row out. The
  route's comment calling the mark-all skip "load-bearing" since 09-06 is therefore wrong — rewrite it.
- **The feed:** `useNotificationFeed` pages by `FEED_PAGE_SIZE` (40) with `loadMore`, `unreadOnly`, `filter`, `markSeen`
  (read without navigating), `markRead`, `bundleClick`, `markAllRead`, `clearRow`. `NotificationPanel` fetches its own
  40 instead — the drawer should use the hook so the drawer and the pages read one source.
- **The count:** `NotificationBell` uses `useNotificationUnread` (Realtime) or an ancestor-owned count; any delete or
  mark-all must keep it right.
- **Destination words:** `notificationDestination(link)` (`lib/notification-view.ts`) names coach team pages and Chat;
  everything under `/admin` reads "Open in admin". Pinned in `tests/unit/notification-reader.test.ts`; the coach page
  names are pinned to the nav by `tests/unit/coach-nav-groups.test.ts`.
- **The holding-payout notice** (`lib/club-money-moves.ts`) links `clubMoneyLinks.requests(slug)` with no request id; the
  Payment requests page already opens `?request=` on arrival.

## Build — three steps, one chat each

### Step 1 · the rules under every surface (no new surface)

1. **Mark all read means all (D9).** Drop `ACT_EXCLUDE_IN` in the route and the `ACT_EVENT_TYPES` skip in both clients'
   optimistic updates (`NotificationPanel`, `useNotificationFeed`); `anyActivityUnread` becomes "any unread"; rewrite
   the route comment. Guard: mark-all never writes `cleared_at`.
2. **Delete (D3).** API action `delete` (own rows only). Client: `useNotificationFeed` gains a delete with Undo — the row
   leaves at once, a "Notification deleted · Undo" note shows ~6 s, the request is sent when the window ends, or at once
   with `keepalive` if the surface closes or the page navigates; Undo cancels the pending request. **No migration:** a
   lost delete leaves the row in place, which is benign. The unread count drops when an unread row is deleted. The coach
   reader gets the trash (set apart at the right).
3. **Done (D8).** Rename every customer-visible "Clear" on notification surfaces: the bell panel rows (still live until
   step 2), `NotificationFeedBody` rows, `CoachNotificationReader`, the aria-labels ("Clear “…” from Needs attention" →
   "Mark “…” done"), the zone hint, the bell tour, and the help articles that discuss Needs attention (coach, org,
   families, platform-admin — grep `needs attention` and `clear` in `lib/help-content/*.tsx`, including `keywords` /
   `searchText`). Identifiers stay.
4. **Destination words (D4).** `notificationDestination` learns the admin pages from the link: payment-requests
   (`?request=` → "Open the request", else "Open Payment requests"), allocations/{id} (`?bill=` → "Open the bill", else
   "Open the allocation"), tournaments/registrations → "Open Registrations", tournaments/results → "Open Results",
   rep-teams/teams/{id} → "Open the team", and every other admin link shape (grep `link:` in `notify()` callers). Pin to
   the admin nav's labels. The holding-payout notice passes the request id when exactly one is held; check
   `team_request_filed` does.

Visible after step 1: "Done" for "Clear"; Mark all read marks everything; the coach reader's trash and its admin button
names. Small walk.

### Step 2 · the drawer (D1, D2, D6, D7)

1. **One message block.** Lift the reader's content into `components/notifications/NotificationMessage.tsx` (eyebrow,
   title, body/members, actions: Open · Done · trash). The coach reader wears it (frame untouched — Sheet Frame's).
2. **The drawer replaces the panel** in both strips (`NotificationBell` opens it). Fixed: top = the strip's height + the
   sandbox banner term the panel carries (`--panel-anchor-top`), right 0, bottom 0; 380px list; 440px pane to its left
   when open; light dim below the strip, a click on it closes. Data from `useNotificationFeed`.
   - Head: "Notifications", settings gear (the strips' `settingsHref`, keep `?back=`), ×. Tools: Unread / All, Mark all
     read. List: Needs attention ("stays until you mark it Done"), activity by day, bundles, Load more. No "See all".
   - Selection: `open: ActivityEntry | null`; a row click → `markSeen` + open; a bundle opens as members; the selected
     row gets the olive tint/edge and `aria-current`. A seen-this-visit set keeps read rows visible under Unread until
     the drawer closes.
   - Done in the pane clears and closes the pane. Trash on row hover AND keyboard focus, and in the pane. The Undo note
     sits at the drawer's foot.
   - Keyboard: the drawer is a labelled dialog; focus to the message title on open, back to the row on pane ×; Escape
     closes the pane first (`useDismissable` claims Escape today — the pane must take the first press).
   - Theme: the panel portals to `body` with `coachWarmAttr` for the coach. Verify how the ADMIN's warm tokens reach a
     body-portaled surface (`KitDialog` deliberately renders in-tree for this); render in-tree if needed.
3. **Remove** `NotificationPanel` and its dead ≤ 900 rules once nothing imports it.
4. **Rendered check** at 1280 and 1024, warm and dark, with a long message (a coach weekly review, ~215 characters) to
   prove the pane scrolls on its own and the list keeps its height.

### Step 3 · the admin's Notifications page (D5) and the docs

1. `NotificationsPageContent` passes `onOpen`; the shared block in a `SheetFrame` menu-layer sheet ≤ 900 (bar visible and
   tappable, Back closes it) and a dialog above. Delete and Undo as in the drawer.
2. `/docs`: the bell tour, the notifications FAQ (coach + org help), every "See all" mention, the drawer, Done, Delete.
3. QA walk as a tab on the hub, and an Owner QA Ledger section.

## Guards

- `tests/unit/notification-reader.test.ts`: the admin destination words; the holding notice's request link.
- New `tests/unit/notification-open-in-place-guard.test.ts`: no customer-visible "Clear" on notification surfaces;
  mark-all never writes `cleared_at` and no longer skips act types; a bell row opens (no `window.location` in the row
  handler); no computer surface links to the Notifications pages; delete is scoped to the caller's rows.
- `npm run typecheck` (shared modules), focused lint, `npm run verify:changed` (includes `check:spelling`,
  `check:dictionary`).

## Out of scope

Client-side navigation on tap (R8); recipient scoping (coaches receiving admin notices, the 09-03 review's D4); Mark
unread; **auto-Done** — a Needs-attention notice marking itself Done when its work is done (answering the request,
confirming the payment): a good follow-up, its own project.

## Build record

_(each step appends: what was built, commits, checks run, findings.)_

### Step 1 · the rules under every surface — built 2026-10-05, committed `a9829568` 2026-10-05 (owner QA §265)

**Owner rulings in the build session (2026-10-05, on the drawing https://claude.ai/artifact/UH3XitdqBKmBPRX7PN61mB,
all three as recommended):**
- **Q1 · the Undo note's place on a page:** centred under the page's own column at the window's foot — 12px above the
  phone's bottom bar, 1rem above the window's edge on a computer. Not the save pill's corner.
- **Q2 · a tournament registration notice reads "Open Teams"**, not the drawn "Open Registrations": the page is
  *Teams* in its nav entry and its own title (D4's rule, "that screen's own words"). A house league's page really is
  *Registrations* and keeps that word.
- **Q3 · a score notice reads "Open the game"**, not "Open Results": its link carries `gameId`, which opens that
  game's score editor (D4's "lands on the record", as "Open the request" / "Open the bill"). Without a game → "Open
  Results".

**Built:**
1. **D9** — `mark-all-read` in `app/api/notifications/route.ts` drops `ACT_EXCLUDE_IN` and marks every unread row; the
   route comment calling the skip "load-bearing" is rewritten (only `cleared_at` moves a row out of Needs attention).
   Both clients' optimistic passes (`useNotificationFeed.markAllRead`, `NotificationPanel.handleMarkAllRead`) mark all;
   the panel pushes 0 to the bell. `anyActivityUnread` → `anyUnread` (the panel's `canMarkAllRead`). `ACT_EVENT_TYPES`
   is deleted from `lib/notification-labels.ts` (its one job was the skip; a tombstone says so).
2. **D3** — API action `delete` (`ids` array or `id`, ≤ 200, `.in('id', …).eq('user_id', user.id)`; nothing
   references a notification row — prod FK snapshot checked). `useNotificationFeed` gains `deleteRows` / `undoDelete` /
   `pendingDelete`: rows leave at once, the request is sent when `UNDO_WINDOW_MS` (6 s) ends, or at once on `pagehide`
   or unmount (`keepalive`); a second delete sends the first; a reload or Load more inside the window keeps the
   pending rows out; Undo restores the LIVE rows (read), newest-first. New `NotificationUndoNote` (rendered by
   `NotificationFeedBody`, so step 3's admin page has it too): an inverted pill, `role="status"`, centred on the
   column it measures; it takes focus when the delete left focus on `<body>` and hands focus to the list when it leaves
   holding it (a layout cleanup + microtask, so Strict Mode's dev remount does not pull focus off Undo).
3. **D8** — "Clear" → **Done** on the bell panel's rows, `NotificationFeedBody`'s rows, the coach reader; aria-labels
   "Mark “…” done"; the zone hint "stays until you mark it Done"; the coach and org help (body, `keywords`,
   `searchText`). "clear a notification" stays as a hidden search alias only. Identifiers unchanged.
4. **The coach reader** — Open · Done (✓) · Close · trash, in that order at every width (hub screen 7: "the buttons
   and their order are the same block in all three" frames). ⚠ This MOVES the computer dialog's onward button from
   last to first (it followed the portal's "way on last" dialog order). The trash is a square secondary button set
   apart at the end; desktop buttons now 34px (One control height, 2026-10-03 — the reader's `min-height: 0`
   predated it).
5. **D4** — `notificationDestination(link, portal)`: `portal` is now REQUIRED (`'coach' | 'admin'`). Coach portal:
   admin links still "Open in admin". Admin: `ADMIN_PAGE` words for every link shape a sender writes — Open the request
   / Open Payment requests · Open the bill / Open the allocation · Open Teams · Open the game / Open Results · Open
   Check-in · Open Registrations (house league) · Open Plan & billing · Open Rep Teams · Open Bring in a coach’s team ·
   Open the team · Open the team’s coaches; an unnamed admin page → "Open". The holding-payout notice
   (`tellClubIfRequestsHoldPayout`) links `?request=` when exactly one request is waiting; `team_request_filed`
   already did.
6. **Guards** — new `tests/unit/notification-open-in-place-guard.test.ts` (mark-all never writes `cleared_at` and
   skips nothing; `cleared_at` has one writer; delete scoped to the caller and sent only from the window; the reader's
   button order; no visible "Clear"; help says Done; every admin word pinned to the nav / tab / page title it names;
   the holding notice's link). `notification-reader.test.ts` gains the admin words and passes `'coach'` to the rest.
   `scripts/check-public-tokens.mjs`: the new stylesheet joins the operator scope.

**Checks:** `npm run typecheck` clean; focused eslint — no new warnings (7 pre-existing on untouched lines);
`npm run verify:changed` exit 0 (5,628 unit tests, spelling, dictionary, contrast, tokens). No browser render in this
step (the owner walks it, §265). No migration.

**Found, not fixed (for step 2 and later):**
- **The bell's live count never hears a delete or a page-side read.** `useNotificationUnread` listens for INSERT only,
  and the coach page's reads, Done, Mark all read and deletes never push a count to the strip's bell (they did not
  before this step either; the bell re-counts on remount). A delete cannot drop an UNREAD row yet (opening marks it read
  first), but step 2's row trash can — the drawer must push the count, which it will, owning the feed.
- **Public and coach-side links outside a team still read a bare "Open"**: `/{org}/{tournament}`, `/playoffs`,
  `/champions` (announcements, playoffs, champions), `/family/teams/…` (a schedule change), `/{org}/coaches/link-org`
  (a team move answered). D4 names admin pages; these were not asked for.
- **`CoachNotificationsPage`'s header comment** still says the desktop bell "is a glance with See all" — true until
  step 2, which rewrites it.

**/simplify (four lenses) and /review (high-risk tier: correctness, security + contract, concurrency, regression)
2026-10-05, then committed `a9829568` 2026-10-05.** /simplify: the Undo-window reset folded into one helper
(`takePending`), the live-rows ref dropped (`deleteRows` reads `items`), `ADMIN_PAGE` `as const`, the Undo note uses
`useLatestRef`, and the guard's local callback reader promoted to `_source-code.ts` as `callbackBody` (reads its
indentation; the first copy hard-coded two spaces). Efficiency: nothing worth changing. /review fixed four:
- **Load more could strand** — its cursor was the last row on screen; delete every loaded row with older history on
  the server and the button did nothing. It now keeps the server's own page end (`cursorRef`).
- **A bundle over 200 rows** would be refused whole while the rows were already gone from the list (not the benign
  failure the design assumed) — sent in batches of the shared `NOTIFICATION_DELETE_MAX_IDS`.
- **Malformed ids** were a 500 (a failed uuid cast) — now a 400.
- **An organization switch** with a delete pending sends it, so Undo cannot bring one org's notification into
  another's list.
Refuted or out of scope: no IDOR (every write keeps `.eq('user_id', user.id)`), no Realtime DELETE leak (the only
subscription is INSERT), nothing references a notification row; `useDialogFloor`'s Strict-Mode focus bounce is
pre-existing and harmless. Documented for step 2: the Undo note takes focus only because a delete removes its opener
in the same commit — a drawer row trash keeps its opener and must place focus itself. Rendered check
(`--only=coach-notifications,admin-notifications`, 4 widths): one finding, pre-existing and data-dependent — the
coach strip bell's red badge digit is 3.76:1 at 1440 (white on #ef4444, 10px) whenever the sweep coach has an unread
notification; it shows identically on coach-overview and coach-schedule, which this step did not touch. Not fixed
here (the bell's own stylesheet; the badge's comment claims ~6.1:1 on warm rust, so the strip resolves a different
`--danger` than it expects). Gate after the fixes: `npm run verify:changed` exit 0 (5,630 unit tests).

**Step 2 adapts to:** the reader's action row is the shared block's order now; `deleteRows`/`undoDelete`/`pendingDelete`
and `NotificationUndoNote` are the delete surface (the drawer places the note at its own foot — the component needs a
placement prop then); `notificationDestination(link, 'admin')` for the admin drawer, `'coach'` for the coach's.
