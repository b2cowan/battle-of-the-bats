# Coach Notifications — one row above the list, a page that says where it is, and the message you can't read

**Status:** D1 · D1b · D2 + the bare gear **ruled 2026-09-25 and built on dev the same day**; **D3 ruled
B the same day and built** — owner QA walk **§234 PASSED 2026-09-25** (all 17 steps, parts A and B).
Mockup (the spec): Claude Artifact "One Row for Notifications"
https://claude.ai/artifact/CNimUy8dmco8thDa778zND — source `COACH_NOTIFICATIONS_ONE_ROW_MOCKUP.html`.
PM brief: `COACH_NOTIFICATIONS_ONE_ROW_PM_BRIEF.md`.
Predecessors: `COACH_NOTIFICATIONS_REDRAW_PLAN.md` (the coach frame, 2026-09-03) ·
`COACH_NOTIFICATIONS_FEED_FIXES_PLAN.md` (zone pills off the phone, 2026-09-06) ·
`COACH_MOBILE_EXPERIENCE_PLAN.md` §14 R4 (the two-line clamp, 2026-09-24).

## How this started

The owner, from a phone screenshot of the coach Notifications page (2026-09-25):

1. *"can we not align the unread/all filters with the settings button to be in the same row to save space?"*
2. *"should we have a back navigation next to the header like our other pages?"*
3. (after the first ruling) *"I don't want the settings gear to have the white background — the same
   format as the help button"* and *"the notification message is cut off but there doesn't seem to be
   a way to read the whole thing — should clicking a notification open the full message, with a
   button to where I need to go?"*

## What the page did (measured on the dev server, 390 × 844, UAT coach)

- Three rows above the first notification: title (36–80), a row holding only the gear (92–136, pinned
  right), a row holding only Unread / All (148–196, pinned left). The list began at ≈208.
- **No tab in the bottom bar was lit.** Notifications is the first row of the More sheet but lives at
  `/{org}/coaches/notifications`, outside the team's address, so the bar's "is this a More page?" check
  (team-scoped) never matched it. Every other More page lights More.
- The Unread / All toggle was the admin feed's own: in the warm portal its track painted the page's
  own colour, so "Unread" had no edge and the chosen half was a 49 × 44 olive blob.

## Rulings (2026-09-25)

| # | Question | Ruling |
|---|---|---|
| D1 | The rows above the list | **A** — the gear moves to the title row beside the "?"; "Mark all read" moves to the list toolbar beside Unread / All. (B, both buttons in the toolbar, needed ~770px of a 688px desktop column and wrapped.) |
| D1b | The Unread / All switch | **The portal's own segmented switch** — Roster's List \| Depth chart. |
| D2 | A back arrow | **No arrow; light More** (and the Notifications row in the sheet). Every arrow in the portal goes UP to a page it names; this page has none above it, so an arrow would be the browser's Back under the same icon, with nothing behind it when opened from an email or a fresh tab. |
| — | The gear's look | **A bare glyph, the twin of the "?"** — no fill, no border. |
| D3 | Reading a message that's cut off | **B — a tap opens the notification in a reader** (owner: *"it allows me to mark individual ones as read (open modal, read, close) without having to leave the notifications page — this is a common behavior"*). A ("Show more" on a cut-off row) was the recommendation; the owner's reason — marking ONE read without leaving, which nothing offered before — was not weighed in it, and it is sound. |

## What was built (D1 · D1b · D2 · the gear)

- `components/coaches/CoachNotificationsPage.tsx` — the header's actions are the settings door only,
  `actionsPhoneInTitleRow`; the feed's row above the list is the kit's `CoachListToolbar`: zone pills
  (desktop only) + the portal switch (`segChoice` + `kit.toolbarView`), with "Mark all read" in its
  actions slot (icon-only on a phone via `headerBtnLabel`).
- `components/notifications/NotificationFeedBody.tsx` — the zone pills are an exported
  `NotificationZoneChips` (one copy wherever they sit); a new `toolbar` prop lets a frame draw its own
  row above the list. Omitted → the admin frame's default row, unchanged.
- `components/notifications/notifications-page.module.css` — `.settingsDoor`: mirrors
  `.helpButtonIconOnly` (34px box, no paint, same ink / hover / focus). **One deliberate difference:**
  its width floor runs to 768, where the "?" is 34px wide as baselined debt (F-21) — the check caught
  the copy at 768 on the first run.
- `components/coaches/CoachesBottomNav.tsx` — `isOnNotifications` lights More and marks the
  Notifications row (`dropActive`), the same treatment as every team More page.
- `tests/unit/coach-page-actions-guard.test.ts` — the Notifications `SITES` row: holds the gear only,
  `phoneInTitleRow: 'true'`. Logged in `archive/COACH_HEADER_ACTIONS_CONSISTENCY_PLAN.md` §10.

### Verification (2026-09-25)

- Probe at 360 / 390 / 768 / 1280: gear and "?" share the title row, same ink, 20px glyphs, 44 × 44 at
  touch widths; the switch row sits at 92, **the list begins at 152 (was 208) — 56px back**, matching
  the mockup's projection; More lit and the sheet's Notifications row marked; no sideways scroll.
- "Mark all read" seen by rewriting the feed response IN THE PROBE BROWSER ONLY (every row unread,
  nothing written): same row as the switch at 360 (icon, 45 × 44) and at 1280 (labelled, the row fits).
- `check:layout --only=coach-notifications`: no new findings (the 768 finding it did raise was the
  gear's width, fixed). Header guard + nav groups + feed grouping + reports-phone guard unit tests:
  pass. `tsc`: clean. ESLint on the four files: clean.
- ⚠ The probe's stored UAT session intermittently drew 401s on concurrent notification calls while it
  refreshed, showing "Couldn't load your notifications" in some runs **before and after** the change.
  A test-login artefact on the evidence so far; not chased.

## D3 — the message you cannot read (ruled B 2026-09-25, built)

**The widened finding.** The 09-24 clamp (stage 6 R4) cut the week in review to two lines on a phone
because *"its page says the rest"*. That holds only for the newest review: the link opens the team's
Insights page, which describes the team **today**. On the UAT team the Sep 20 and Sep 13 reviews are
both cut at *"⚠ #12 Logan Tes…"* — mid pitching-cap warning — and differ only after the cut (#5 Emerson,
12 innings on the bench · #1 Avery, 11). Of 40 rows in that feed, the three weekly reviews are the
only bodies over 92 characters (214–216); the rest fit. The desktop bell panel cuts every row to one
line but is a glance with "See all"; the phone has no panel, so the full page is its only reader.

**Options drawn:** A (recommended) — "Show more" on a cut-off row's date line, where Clear sits on a
Needs-attention row; unfolds in place, "Show less" folds; the row itself still opens its page; rows
that fit are unchanged. B (as asked) — every tap opens a reader sheet with a button onward: +1 tap on
all 40 rows to help 3, and 23 notification kinds each need a button label. C — undo the clamp: ≈4 more
lines (≈75px) per weekly review at 390, one every Sunday. **§232's walk step F1 ("two lines on a
phone") is superseded by B:** the clamp stays on the row; the reader shows the rest.

### What was built for D3 (2026-09-25)

- `components/coaches/CoachNotificationReader.tsx` (+ `.module.css`) — the reader. The kind and the
  day + clock ("Sun, Sep 13 · 7:00 p.m."), the title, the WHOLE message (a bundle opens as its
  members), one onward button named for where it goes, **Clear** on a Needs-attention row, Close.
  - **A MENU, not a form**, by the drawer ruling (2026-09-23): nothing is typed, so on a phone it is
    the More sheet's own container at the bar's top edge and the bar stays visible and tappable
    beneath it; above 900px it is a 480px centred dialog (the RSVP sheet's answer).
  - Stands on `useDialogFloor`: Escape, the Tab trap, focus back to the row, and the phone's **Back
    closes the reader and stays on the page**.
  - The onward control is a plain `<a href>` — full-document navigation, as the feed's tap was (R8).
  - ⚠ The stamp is NOT uppercased with the eyebrow: the caps painted "7:00 P.M." on screen — a second
    spelling of the house clock that no source gate can see. Caught on the rendered check.
- `lib/notification-view.ts` — `notificationDestination(link)` ("Open Insights", "Open the practice
  plan", "Open Chat", "Open in admin", else "Open") named from the LINK in the nav's own words, not
  from the 23 event kinds; `notificationStamp(iso)`. Pinned in `tests/unit/notification-reader.test.ts`.
- `useNotificationFeed` — `markSeen(members)`: mark read WITHOUT navigating (the owner's reason for
  B). `markRead` / `bundleClick` now call it, then go — the admin feed's tap, unchanged.
- `NotificationFeedBody` — `onOpen`: when a frame passes it, a row opens (`aria-haspopup="dialog"`)
  instead of marking-and-going. Only the coach page passes it.
- **Deliberately unchanged:** the admin "See all" feed (tap = mark read and go) and the desktop
  bell's panel (a one-line glance with "See all"; its tap still goes straight to the page).

**Verified 2026-09-25 (dev server, UAT coach):** at 390 the Sep 13 review opens in full — the part the
row cuts ("#1 Avery Test has sat the bench most — 11 innings") is there; the sheet ends at the bar's
top (772) and a tap at the bar lands on a tab; "Open Insights" → `/history`; Back, Close and Escape
each close it and stay on `/coaches/notifications`; focus returns to the row, which reads as read.
At 1280, a 480px centred dialog. A bundle ("17 scores submitted") opens as its 17 members, scrolling
inside the sheet — and its button says "Open in admin", the parked recipient-scoping bug (D4) made
visible rather than new. Gates: `tsc` clean · ESLint clean (one pre-existing warning in the feed's
load effect) · 161 related unit tests pass · CSS selectors / module purity / spelling / date /
contrast clean · `check:layout --only=coach-notifications` no new findings.

## /simplify + /review (2026-09-25) — and what they left behind on purpose

**/simplify** (four lenses: reuse · simplification · efficiency · altitude). Applied: `entryMembers()`
(the entry → notifications rule was written twice) · `clockOf()` (the list's clock and the reader's
stamp built the same string twice) · the reader's remount `key` dropped (no path swaps one entry for
another while it is open) · `COACH_TEAM_PAGE` — a THIRD hand-typed copy of the nav's page names —
pinned to the phone nav by `coach-nav-groups.test.ts` (proved: renaming "Insights" in the table fails
it). Efficiency found nothing new (the per-id mark-read POSTs are the old bundle pattern, extracted).

**/review** (high-risk tier: shared lib + the admin feed's body). Stage 0 green — `verify:changed` (4,750
unit tests), `tsc`, focused ESLint, `check:layout --only=coach-notifications,coach-help` (no new
findings; 39 coach-help entries no longer reproduce — not pruned from a shared copy), `measure:help`
(the bell sub-topic was 368 words BEFORE this change and 418 after the first draft; trimmed to under
350). Four lenses. **Confirmed and fixed:**
- **High — the More sheet buried an open reader.** The bar stays tappable under a menu-layer sheet, and
  More draws in the nav's stacking context (300) over the reader's anchor (260): tap More with the
  reader open and it vanished underneath, still open. The reader now closes on a pointer-down outside
  its OWN subtree (scrim + panel) — i.e. a tap on the bar — the team sheet's "never both" rule. A local
  listener, not `useDismissable`: that hook claims Escape and would take the key from the floor.
  ⚠ The boundary is the anchor, not the panel — closing on a scrim pointer-down would let the tap's
  click land on the row beneath and open a second reader. Verified at 390 touch: More opens and the
  reader closes; a scrim tap over a row closes and opens nothing; Escape, Back, Close unchanged.
- **Medium — a failed Clear from the reader put a read row back to unread.** The reader holds a
  snapshot taken before opening marked it read, and Clear's rollback restores the row it is handed;
  the page now clears the LIVE row.
- **Medium — "Open …" tapped at once could cancel the in-flight mark-read** (the onward link is a
  full-document load and the POST was not awaited): `postAction` sends with `keepalive`.
- **Medium (latent) — `/practice/templates|circuits` read as "Open the practice plan".** No sender
  links there today; the libraries now fall through to "Open Practice plans", pinned in the test.

**Refuted / accepted:** a double tap posts mark-read twice (idempotent) · a bundle's button uses the
first member WITH a link while its stamp is the newest member's (every bundling sender sets a link).
Security lens: clean — every `link` is server-built from DB slugs/ids; the reader renders text, not
HTML; mark-read is scoped to the caller.

**Follow-ups, deliberately not done here:**
- `.settingsDoor` mirrors the help "?" — reuse its class once the peer session's bare-glyph change to
  `components/help/*` is committed (at HEAD that class would paint the gear as a blue link).
- The phone-sheet + desktop-dialog pair now exists in the RSVP sheet AND the reader (and the grab
  button in the lineup position sheet too) — one shared shell before a third caller.
- More / team sheet / reader all anchor at z 260 with no stacking rule between them; the reader and
  the team sheet each close on a bar tap, More does not know about either.
- A batch mark-read endpoint (a 17-row bundle posts 17 times — pre-existing).
- **Pre-existing, outside this change, raised by the security lens:** `lib/notify.ts` interpolates a
  notification's `body` raw into the EMAIL HTML — an admin-typed tournament announcement can carry
  markup into members' inboxes. Its own ticket.

## Owed

- Nothing on this change — walked (§234), simplified, reviewed, documented, committed (the commit
  carrying this record).
