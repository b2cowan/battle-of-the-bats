# Coach Notifications — feed grouping, ordering and filters

**Status: SHIPPED — committed `baa9be54`, on prod 2026-09-08 (job 262) with migration 278.**
Owner QA = a new ledger section (§147 proposed). Mockup = the spec:
Claude Artifact "Four Fixes to the Notification Feed"
`https://claude.ai/code/artifact/9427bc24-94e4-47dc-9823-ae94d95d09ff`.
PM brief: `COACH_NOTIFICATIONS_FEED_FIXES_PM_BRIEF.md`.
Predecessor: `COACH_NOTIFICATIONS_REDRAW_PLAN.md` (§138 walk — **complete**, owner 2026-09-06).

## How this started

The owner opened the §138 walk on a phone and asked three things about one screenshot:

1. can the three filter pills fit on one row?
2. what is the difference between **Needs attention** and **Activity**?
3. why does **Earlier** contain dates more recent than the rows above it?

Question 3 turned out to be a **real defect**, not a stale fixture. Questions 1 and 2 turned out to
have the same answer as each other — the pills and the zone headings were saying the same thing
twice, and the sentence that would have answered question 2 was switched off on phones because the
pills left it nowhere to go.

## Owner decisions (2026-09-06, taken from the mockup)

| # | Decision | Ruling |
|---|---|---|
| 01 | One clock — the heading owns the day, the row owns the time inside it | **Approve** |
| 02 | A fourth bucket, "Earlier this week", Monday-start | **Approve** |
| 03 | Zone pills removed on phone, kept on desktop | **Approve** |
| 04 | Needs attention holds a row until **Clear** (option C, not A or B) | **Approve** |
| — | Recipient scoping (admin-only events in a coach's zone) | **Own ticket** — explicitly out of scope for this pass |

## 01 — One clock

`relativeTime()` counted **elapsed hours** ("1d ago" = age ÷ 24). `dayBucket()` counted **calendar
days**. Two clocks answering one question, disagreeing by up to a full day in **both** directions:

- posted Friday 6:21 p.m., read Sunday morning → **"1d ago"** (47h) under the heading **"Earlier"**
  (two calendar days back). This is the row in the owner's screenshot.
- posted 11:00 p.m., read at 00:30 → **"1h ago"** under the heading **"Yesterday"**.

The fix is not to make both calendar-based; it is to stop asking them the same question.

| Bucket | Row label | Why |
|---|---|---|
| Today | `2h ago` | Recency is the useful fact, and cannot contradict the heading |
| Yesterday | `6:21 p.m.` | The heading already said the day |
| Earlier this week | `Fri, 6:21 p.m.` | The heading covers several days, so the row names one |
| Earlier | `Aug 30` | Past a week the hour stops being read |

`relativeTime()` was **renamed** to `notificationTime()` — a function returning "Fri, 6:21 p.m."
under the old name is a lie waiting to be re-broken. Clock labels go through `formatTime()`, so the
house spelling ("6:21 p.m.") holds. ⚠ **A pinned "Needs attention" row passes `withDay: true`**,
because that zone is a triage list with no day heading above it — without the flag it rendered a
bare "12:53 p.m." and the coach could not tell which day's. **This was caught in rendered
verification, not by reading the code**, and it is the reason the whole-screen render is worth
running before hand-off.

## 02 — "Earlier this week"

In the QA fixture, Earlier held **39 of 61** activity rows — Wednesday's champions in the same
bucket as a digest from 10 July. The new bucket splits it roughly in half (≈16 / ≈23).

⚠ **Monday-start, deliberately.** A Sunday-start week (the `en-CA` default) makes the bucket empty
on a **Sunday** — precisely the day a coach sits down to catch up. Monday-start puts Mon–Fri under
it on that Sunday. On a Monday or Tuesday it is correctly empty and simply does not render.

## 03 — The pills

The pills named **Needs attention** and **Activity**; the list labels both, a finger below. The
count on the pill repeated the count in the heading underneath it. Two wrapped rows plus the read
toggle = **164 px** of a 720 px screen; the toggle alone = **60 px**.

- **Phone (≤768):** `.chips { display: none }` — display-only, so the filter state survives a
  rotation back to a wide viewport.
- **Desktop:** unchanged. The row fits on one line and the list is long enough to filter.
- The room reclaimed is what let `.sectionHint` come back on phones. Those two changes are one
  unit of work, not two tidy-ups — the alternative-one-row-pill treatment is drawn in the mockup as
  a rejected fallback.

⚠ **MEASURED, and it is LESS than the mockup's arithmetic promised — record the real number.** The
mockup claimed 104 px back and "five rows instead of three". Measured on the rendered page at 390 px
against the seeded fixture: **54 px back, one more row fully visible (2 → 3), and the "Today"
heading moves from y=749 to y=695 — from below the fold to above it.** Two reasons for the gap, both
worth knowing:

1. At exactly 390 px the three pills fit on **one** row, not the two the owner's screenshot showed —
   that wrap happens at narrower/zoomed viewports. So the pills were costing 54 px here, not 94.
2. **Change 04 spends some of it back.** Clear sits on a meta line held to the 44 px touch floor, so
   every act row grew. With three act rows on screen the two changes very nearly cancel; the pills
   removal is still what puts the first day heading above the fold rather than below it.

The gain is real but it is **one row, not two**. Do not re-quote the mockup's figure.

## 04 — A decision stays until you clear it (mig 278)

The zone was built on `read_at IS NULL AND category = 'act'` — a **read-state** list wearing the
label of a **resolved-state** one. Open a failed payment on the bus, fix nothing, and the row left
the zone and took the count down with it.

- **`notifications.cleared_at`** (mig 278, + partial index on uncleared rows). Nullable, no
  backfill: every existing act row starts uncleared, which is the honest reading.
- **Zone rule is now `!clearedAt && category === 'act'`**, in `useNotificationFeed` *and*
  `NotificationPanel` — the bell carries the same **Clear** button, because a row a coach could only
  dispatch on one of the two surfaces is exactly the drift `lib/notification-view` exists to prevent.
- ⚠ **The zone is computed over ALL items, not over the unread filter.** A row can be read and still
  owed a decision, and the bell defaults to Unread — which would have hidden the very rows the zone
  exists to show. The Unread/All toggle now filters the **activity feed**; the triage list is never
  filtered out from under itself. The panel's empty-state guard had to learn this too, or a
  read-but-uncleared decision rendered "You're all caught up" over the top of itself.
- **Clear also stamps `read_at`** when it is still null (server-side, guarded so an old row's
  first-seen stamp is never rewritten). A row you are finished with should not also sit unread.
- **There is no clear-all**, by design: emptying the zone is a series of decisions, not one gesture.
- ⚠ **Owner ruling D3 (2026-09-03) is now LOAD-BEARING rather than tidy.** "Mark all read" excluding
  act rows is the only thing standing between one tap and a silently emptied list of unmade
  decisions. It must never learn to write `cleared_at`. Noted at all three sites.

**Known tradeoff, stated in the mockup and unchanged:** the zone only empties if the coach clears
it. If it fills and stays full it becomes wallpaper — which is the strongest argument for doing the
recipient-scoping ticket next.

## 05 — The desktop bell panel ran off the bottom of the window (found in QA, 2026-09-06)

Owner found it walking the build: the dropdown extended past the bottom of the browser window and
would not scroll further. **Two compounding defects, both latent before this pass and both made
reachable by it** — 01–04 each made the panel taller (Clear's meta line, a fourth day heading, and
pinned rows that no longer hide under the Unread filter).

1. **`.notifList` had `flex: 1; overflow-y: auto` but no `min-height: 0`.** A flex item's default
   `min-height: auto` resolves to its content height and refuses to shrink below it, so the list's
   scroller never engaged. The list pushed the panel past its cap and `.panel`'s own
   `overflow-y: auto` scrolled instead — taking the header, the Unread/All toggle and the footer
   with it. `.panel` is now `overflow: hidden`, so the list is the only scroller and the three
   `flex-shrink: 0` chrome rows actually stay put.
2. **`.panelTopStrip` overrode `top` but inherited `.panel`'s `max-height: calc(100vh - 16px)`** — a
   budget written for a panel starting 8px from the top. Starting ~54px down with a full-viewport
   height budget put the panel's bottom edge **below the window**, and *you cannot scroll a
   container whose own bottom is off-screen*. The anchor offset is now named once in a local custom
   property and subtracted from the height budget, so the two cannot drift apart again.

**Measured before/after on the same open panel at 1440×900:** before — panel bottom **938** on a
900px window (**38px of overhang**), "See all" footer at **929**, off-screen and unreachable. After
— bottom **884**, footer at **875**, on screen. The 38px matches the arithmetic exactly
(`top 54 + (100vh − 16) − 100vh`).

⚠ **This also fixed the admin bell**, which shares the panel and the same top-strip anchor.

## Deviation from the approved mockup

**One, flagged at build time per the mockups-are-the-spec rule:** the drawing showed the **Clear**
button at **34 px** tall. Built at **44 px** on phones, because the portal's touch floor applies to
every control in the body and the layout gate enforces it. Act rows are therefore ~10 px taller
than drawn. Everything else matches the drawing.

## Files

- `supabase/migrations/278_a_decision_stays_until_you_clear_it.sql` — on prod 2026-09-08 (job 262)
- `lib/notification-view.ts` — `relativeTime` → `notificationTime` (bucket-derived, `withDay`
  option, injectable `now`); `DAY_ORDER` gains "Earlier this week"; `dayBucket` gains the
  Monday-start branch and an injectable `now`
- `lib/types.ts` — `AppNotification.clearedAt`
- `app/api/notifications/route.ts` — `cleared_at` mapped; new `clear` action; D3 comment corrected
- `components/notifications/useNotificationFeed.ts` — `clearRow`; zone rule; `needsCount`
- `components/notifications/NotificationFeedBody.tsx` — Clear on the act row's meta line; hint copy
- `components/notifications/NotificationPanel.tsx` — same zone rule, same Clear, empty-state guard
- `components/notifications/notifications-page.module.css` — `.meta` / `.clearBtn`; `.chips` hidden
  ≤768; `.sectionHint` un-hidden; `.sectionHeader` wraps
- `components/notifications/notifications.module.css` — `.notifMeta` / `.clearBtn` + phone floor;
  panel sizing (05): `.panel` overflow hidden, `.notifList` min-height 0, `.panelTopStrip` height budget
- `lib/help-content/coaches.tsx`, `lib/help-content/org.tsx` — both bell paragraphs described
  behaviour this change deletes; prose + `keywords` + `searchText` updated in the same unit of work
- `tests/unit/notification-feed-grouping.test.ts` — NEW, 15 tests
- `docs/agents/db/DATA_DICTIONARY.md` + snapshots; `scripts/.schema-parity-baseline.json`

## Verification (run 2026-09-06)

- [x] `npx next typegen` + `npx tsc --noEmit` — clean
- [x] `npm run verify:changed` — green end to end; **3,072 unit tests pass**, 0 lint errors
      (189 pre-existing warnings). Schema parity green after recording mig 278 as accepted
      debt at the time (2 entries added by hand, NOT `--init`); both cleared when 278 reached prod — the parity baseline is now at ZERO
- [x] `npm run check:layout -- --only=coach-notifications` — **zero new findings at 361/390/768/1440**
- [x] `npm run refresh:snapshots` — watermark #278, dictionary coverage OK
- [x] **Rendered verification as the UAT coach (Playwright, 16/16)** — at 390: pills hidden, read
      toggle present, `scrollWidth 390 = clientWidth`, hint visible, all four day headings render in
      order, 14 timestamps with **zero** "Nd ago" labels and no uppercase AM/PM, Clear present on all
      3 act rows at **44 px**, Clear takes the count 3 → 2 **and it survives a reload** (server
      truth), the cleared row leaves the zone but stays in the feed as history, **"Mark all read"
      leaves the zone at 2** (D3 holds); at 1440 the pills return and timestamps follow the same rule
- [x] **Panel sizing (05) proved by measurement, not inspection** — at 1440×900 / 1280×720 /
      1440×600 / 1024×700: the panel fits the window, the LIST is the scroller (not the panel), the
      "See all" footer stays on screen, and the list scrolls to its very end. The old rules were
      re-injected onto the same open panel to confirm they genuinely failed (38px overhang, footer
      at y=929 on a 900px window). The coach strip hides the bell at ≤900px, so the phone path is
      the bottom nav and is unaffected
- [x] Fixture reseeded (64 rows, 16 unread) — the §138 fixture was spent
- [ ] `/review` and `/simplify` — offered at hand-off, not yet run
- [ ] Owner QA walkthrough artifact

## Open after this build

- **Recipient scoping (the owner's question 4, deferred by him to its own ticket).** All three act
  rows a coach sees are club-admin decisions — billing, tournament check-in, rep-team admin — linking
  to admin screens they may not be able to open. Clear makes an unactionable list *stickier*, so this
  is now the highest-value follow-up rather than a nice-to-have.
- **Option B as a later layer.** "Still failing — last tried 6:00 a.m." is genuinely better than a
  manual Clear for the one event that knows whether it is still true. Two of the current act types
  have a resolved signal; `team_no_show` has none, which is why B was not built alone.
- **R8** (client navigation on row tap, zone/toggle in the URL) — still open from the redraw.
- **Demo sandboxes:** both `riverdale-*` orgs have **zero** notification rows (verified against dev),
  so no demo copy or tour step describes the bell. Nothing to true up — but the moment a demo gains a
  notification, this zone's vocabulary is the thing to re-read.
