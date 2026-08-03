> STALE HEADER (corrected 2026-08-01): this chunk WAS BUILT on dev 2026-07-31 (code-verified: "Email families", More-sheet Notifications row). The "PLANNED / NO CODE WRITTEN" status below predates the build session. Owner QA tracked in active/OWNER_QA_LEDGER.md.

# Coach Portal â€” Chunk B: Findability & portal chrome â€” Implementation Plan

> **Created:** 2026-07-31 Â· **Status:** PLANNED â€” mockups pending owner approval; **NO CODE WRITTEN**.
> **Owner sequencing calls, 2026-07-31:** (1) Chunk B is planned + mocked now, **released after** â€”
> the 30-commit release does not block this chat; (2) **building waits until the concurrent agent
> commits its ~50 uncommitted files.** Plan + PM brief + mockups proceed in the meantime.
> **Mockups:** `claude.ai/code/artifact/96e4a359-7966-4f1c-9105-3ddbb85dd969` **rev 1** â€”
> **binding visual spec on approval** (regions labelled NEW / RESTYLED / UNCHANGED / REJECTED).
> **PM brief:** `COACH_PORTAL_CHUNK_B_FINDABILITY_PM_BRIEF.md`
> **Ledger:** `PROGRAM_COACH_PORTAL.md` Â§1.1 â€” this chunk closes P1 #1, #4, #17 and narrows #12.

---

## 0. Ground truth â€” VERIFIED AT PICKUP 2026-07-31 (read, not trusted)

The build prompt warned that its own facts had drifted under three concurrent streams. Every claim
below was re-derived from the code in this working copy. **Five corrections; two change scope.**

| # | Handoff claimed | Verified |
|---|---|---|
| **P1 #2** | Already fixed â€” drop it | âœ… **CONFIRMED CLOSED.** `CoachChatView.tsx:131-155` renders `CoachEmptyState` headlined *"No tournament chats yet"*. Its code comment already records that staff rooms make this an entitlement edge case, so the copy is correctly scoped, not stale. **Tick in Â§1.1; do not re-plan.** |
| **P1 #4** | Bell missing on mobile | âœ… **CONFIRMED â€” and worse.** `/{orgSlug}/coaches/notifications` has **exactly one inbound link in the entire product** (`CoachesSidebar.tsx:140`, inside the bell's panel footer). The bell lives only in `.sidebar`, which is `display:none` â‰¤900px. **On a phone the coach notification feed is unreachable by any route.** |
| **P1 #17** | 12 of 41 pages; "29 pages still have none" | âœ… Count confirmed â€” **framing corrected.** All 12 are *top-level nav destinations*. Measured against the nav, the rule is already ~70% implemented and the real gap is **5 doors**, not 29 pages (Â§3). |
| **P1 #1** | Confirmed open; nav rename governs naming | âœ… **CONFIRMED OPEN** â€” `CoachesSidebar.tsx:47-48`, still adjacent under a `Communication` group; the `4d634258` rename did not touch them. âš  **The review's premise is out of date** â€” see below. |
| **P1 #12** | Open for premium | âš ï¸ **PARTIALLY CLOSED, undocumented.** Quiet Mode Phase C1 shipped `CoachPortalTour` on the premium Overview â€” but it is offered from exactly two places, both conditional (Â§5). |

### The five findings that shape the build

1. **The admin shell already solved P1 #4 â€” reuse it, don't design it.** "The Flip" (2026-07-22)
   moved admin's mobile bell into the **More sheet as a row that opens the full feed page**, with
   the unread count badging the **More tab** so the coach discovers it without opening the sheet
   (`AdminBottomNav.tsx:286-303`, `.dropCount`). `useNotificationUnread` is already the one shared
   hook driving sidebar bell + More-tab badge + row badge. Coach reuses all of it.

2. **The bell's panel is desktop/admin-shaped; the feed page is not.** `notifications.module.css`
   anchors the phone panel at `top: calc(48px + safe-area + 0.4rem)` with the comment *"anchor the
   panel under the admin top bar"*. **The premium coach portal has no top bar at any width** â€” the
   panel would hang below 48px of nothing. This is the prompt's *"a bell that opens a desktop-only
   panel is not a fix"* warning, confirmed. **Mobile goes to the page, not the panel.**

3. **Chat is no longer only the organizer channel.** Project 2A added standing **staff rooms** â€”
   the coach's own staff, all season, no tournament (`CoachChatView.tsx` header; guide
   `recipe-staff-room`). The room list already heads itself *"Your chats"*, not "Your tournament
   chats". **Any naming that calls Chat "the organizer channel" would be wrong.** The true
   distinction is *two-way, with people inside your club or event* vs *one-way email out to
   families*.

4. **The Chat page has no page header to hang a help icon on.** It is deliberately full-bleed
   (`chat/page.tsx`, `data-chat-fullbleed`); the conversation header carries the room name +
   switcher. Its help already exists but **only in the empty state** (a "How tournament chat works"
   secondary action) â€” i.e. only for the coach who has no chats.

5. **One of the five help gaps has no guide to open.** Attendance, Season's End and Insights all
   have written sections (`recipe-attendance`, `premium-season-end`, `premium-insights`); Chat has
   two. **Settings has none** â€” there is no `settings`/`team-settings` section in
   `lib/help-content/coaches.tsx`.

### Ground truth on the concurrent streams

- **`4d634258` (nav rename)** â€” landed; **did not touch** the premium coach Chat/Announcements
  labels. Its binding rule (*controls named by DESTINATION; one operator door per screen*) governs
  D-B1.
- **Desktop Phase 2** â€” introduced **no** new notifications surface. `/account/notifications` is the
  universal **settings** page (pre-existing, locked D2: feed and settings are separate screens). The
  **feed** stays per-org at `/{orgSlug}/coaches/notifications`. Chunk B points at both; it duplicates
  neither.
- **Quiet Mode** â€” retired the "Also in your portal" chips (do not reinvent) and shipped the tour in
  finding 5 above.
- **âš  Nav Unification (uncommitted, in this working copy)** â€” `NAV_UNIFICATION_PLAN.md` Stage C/H
  proposes an operator strip **carrying a bell** on the premium coach portal, **desktop â‰¥1024 only**,
  gated on owner decision **D2** (reverses the no-wordmark ruling), with mobile explicitly deferred
  pending a real-device overflow check. **No collision:** Chunk B is mobile-only for the bell and
  changes no desktop bell. Stage H, if ratified, adds a *second desktop* door to the same feed â€” a
  question for that plan, recorded here in Â§8 so it is not discovered late.
- **Working copy state:** the premium nav files (`CoachesSidebar.tsx`, `CoachesBottomNav.{tsx,module.css}`,
  `components/notifications/*`, `components/help/*`) are **clean**. `coaches.module.css` carries
  foreign uncommitted hunks (lineup game-card phone grid, ~lines 907 + 1060) â€” a **different region**
  from anything this chunk edits, but it makes explicit `:(literal)` staging mandatory.

---

## 1. Scope

**In:** P1 #4 (mobile notifications), P1 #17 (the help-icon rule), P1 #1 (Chat vs Announcements),
P1 #12 (premium cold-signup welcome).
**Out:** P1 #2 (verified closed). Anything desktop-bell. The free portal (two-family ruling stands).
**No migration expected.** No new API route expected. No write path â€” this chunk is education +
navigation only, which sets the `/review` tier (Â§7).

---

## 2. Work item B1 â€” a coach on a phone can reach their notifications

**The gap:** unreachable feed, unreachable settings (Â§0, P1 #4).

**Build â€” mirror `AdminBottomNav` exactly:**

1. `CoachesBottomNav` mounts `useNotificationUnread(currentOrg?.id)` â€” the same hook the sidebar
   bell uses. Coach shell does **not** hoist the count (admin does, because it has two consumers at
   one breakpoint; the coach sidebar and bottom nav are mutually exclusive by media query, and the
   hook's `useId` channel key already makes a double mount safe).
2. A **Notifications** row pinned **first** in the More sheet â€” above the team switcher, matching
   admin's placement â€” gated on `currentOrg?.id`, linking to `/{orgSlug}/coaches/notifications`,
   with a trailing unread count and a divider beneath.
3. The unread count **badges the More tab** so it is discoverable without opening the sheet. The
   bar already has an unread-dot precedent (`chatUnread` on the Chat tab) â€” reuse that visual
   language rather than inventing a second one.
4. **No new page.** `/{orgSlug}/coaches/notifications` already renders `NotificationsPageContent`
   with the "Notification settings" affordance into `/account/notifications?focus=coach-{orgSlug}`,
   so both the feed and its settings become reachable from one row.

**Deliberately not doing:**
- **A 6th bottom-bar tab.** The bar is 4 team tabs + More. At 361px a 6th slot is ~60px; the label
  breaks and one of Roster/Chat is evicted. Rejected on the tap floor.
- **A bell in `.pageHeader`.** Three pages have no `.pageHeader` (Chat is full-bleed), and that
  exact slot is where the help icon lives (Â§3) â€” two competing icons in one corner on 38 pages.
- **Opening the panel on mobile.** Finding 2. The page is already mobile-correct; the panel is not.

**Debt noted, not fixed here:** the Chat tab's unread badge is written as **inline styles with
hard-coded values** (`CoachesBottomNav.tsx:154-159`) â€” a live instance of the inline-TSX token debt
tracked in `INLINE_TSX_TOKEN_DEBT.md`. The new count must **not** copy that pattern; it takes a
CSS-module class, and folding the existing badge onto the same class is a one-line net reduction.

---

## 3. Work item B2 â€” the help-icon rule

**The rule (proposed, binding on approval):**

> **Every navigation destination carries a help icon. A page you reached by drilling *into* a
> destination inherits its parent's guide and carries none of its own.**

This is not a new standard â€” it is the standard the portal already follows. All 12 existing
`HelpButton`s are nav destinations; every drill-in page (player detail, a budget report, a lineup
editor, a tryout sub-tab) correctly has none. **Measured against the nav rather than against the
file count, the promise is 12 of 17 kept, and the gap is five doors:**

| Door | Route | Guide | Note |
|---|---|---|---|
| **Attendance** | `/attendance` | `recipe-attendance` âœ… | Gained a nav home in Batch 4; the help icon was never added |
| **Chat** | `/chat` | `recipe-tournament-chat` + `recipe-staff-room` âœ… | **No `.pageHeader`** â€” see placement below |
| **Settings** | `/settings` | âŒ **none exists** | See "the missing guide" below |
| **Season's End** | `/season-end` | `premium-season-end` âœ… | A closed season's primary nav destination |
| **Insights (closed season)** | `/history/results` | `premium-insights` âœ… | On a closed season this *is* the nav destination; `/history` (which has an icon) is not reachable |

**Placement:** the established slot â€” `iconOnly` in the `.pageHeader` trailing position, which
`.pageHeader > *:last-child:not(.pageHeaderLeft) { margin-left: auto }` already pins right at every
width. Four of the five take it unchanged. **Chat** takes its trigger in the room-list header beside
*"Your chats"*, which is that surface's own header row â€” and it generalises the help the empty state
already offers to the coach who *has* chats.

**The missing guide â€” the rule's own hard case.** *"What happens on a page whose guide does not
exist yet?"*

> **An icon that opens the hub is a broken promise dressed as help.** A coach taps "?" expecting an
> answer about *this screen* and gets a table of contents. **A page with no guide gets no icon â€”
> and the answer is to write the guide, not to weaken the rule.**

So Settings gets a **new guide section** written in this same unit of work (division, season,
lineup rules, parent organization â€” the four panels the page actually renders), and the rule then
has zero exceptions. **A help icon is not a feature until its guide is findable:** search matches
keywords, never body text, so the new section and every section newly pointed at get their keyword
lists checked against what a coach would actually type. Routed through `/docs`.

---

## 4. Work item B3 â€” Chat vs Announcements

**What they actually are (verified, Â§0 finding 3):**

| | Chat | Announcements |
|---|---|---|
| Who | Your coaching staff (standing, all season) **and** the organizer + other coaches during an event | Every family on your roster |
| Medium | In-app conversation, phone notification, no email | **Email**, to the guardian addresses on your roster |
| Direction | Two-way | One-way |

**They must not merge, and "Messages with two tabs" is wrong** â€” it would file a rarely-live
organizer channel beside a family broadcast and imply they are two views of one thing. The nav
ruling (*named by destination*) and Stage C's own warning (*"same word, two meanings on one
screen"*) both point the same way: **disambiguate by naming the audience.**

**Recommendation (D-B1):**
- **`Chat` stays.** It is the app-wide word for a conversation, the consumer bottom bar uses it, the
  page already heads itself "Your chats", and the destination genuinely is a chat. Renaming it would
  fracture a platform-wide vocabulary to fix a local problem.
- **`Announcements` â†’ `Email families`.** Two words that name both the audience and the medium, and
  cannot be confused with Chat by anyone. Every other label in the sidebar is a noun-place; this one
  door genuinely *is* send-shaped (you land on a composer plus what you've already sent), so the
  slight verb lean reports the destination honestly rather than decorating it.
- **The `Communication` group header stays** â€” it is a category label exactly like Squad / Season /
  Money / Team admin, and with two self-explaining children it no longer implies interchangeability.
- Applied in **both** navs (sidebar + More sheet), the portal tour card, and the help guide.

**Alternative carried into the mockups for the owner to choose:** `Families` (pure noun-place;
shorter; loses the medium). Both are drawn.

---

## 5. Work item B4 â€” what a cold-signup premium coach sees first

**Verified state:** `CoachPortalTour` exists and is good â€” a non-modal side drawer, capability-filtered
cards, one-time offer, account-scoped `tourDismissed`. **But it is offered from only two places:**
`page.tsx:1368` (inside the setup panel) and `page.tsx:1724` (**inside the preseason anchor's answers
row**, gated `!tourSeen`). Chunk I's resolver returns **one** anchor by an ordered rule â€” so a coach
whose anchor resolves to `game_day`, `next_event`, `season_check`, `lull`, or to `null`, **is never
offered the tour at all.** A premium coach who signs up mid-season, or whose team already has data,
falls straight through.

**Recommendation (D-B4): the welcome is an anchor STATE, not a card beside the anchor.**

Add a `welcome` kind at the **top** of `resolveOverviewAnchor`'s ordered list, eligible when the
coach has never been offered the tour **and** the team shows no coach activity yet. First match
wins, so it *replaces* the pre-season next-step card for a first visit; finishing or skipping the
tour sets `tourDismissed`, the candidate becomes permanently ineligible, and the resolver falls
through to today's behaviour forever after.

Why this shape and not a banner:
- **Chunk I rule 1** â€” one anchor slot, ordered rule. A welcome band beside the anchor is precisely
  the nine-independent-bands defect that chunk existed to remove.
- **Chunk I rule 1's corollary** â€” a brand-new coach *is* a pre-season coach plus extra facts, so
  the specific state **replaces** the general one it is a superset of.
- **Chunk I rule 2** â€” a state that replaces another **inherits its door**: the welcome carries the
  pre-season card's "next step" as its secondary answer, so nothing is lost.
- **Chunk I rule 4** â€” CTAs gate on "can complete". Every coach can take a tour, so the card is
  never button-less; the inherited setup-step answer keeps its existing capability filter.
- **Quiet Mode** â€” the tour is *offered*, never auto-opened. Unchanged: this makes the offer
  reachable, it does not make it interrupt.

**Also:** the tour stays reachable forever from Help, independent of the one-time offer (already
true; asserted by a probe so a future change cannot silently strand it).

---

## 6. Files expected to change

Navigation Â· `components/coaches/CoachesBottomNav.{tsx,module.css}` (B1 row + badge, B3 label)
Â· `components/coaches/CoachesSidebar.tsx` (B3 label).
Help doors Â· `attendance/page.tsx`, `settings/page.tsx`, `season-end/page.tsx`,
`history/results/page.tsx` (+ `components/chat/CoachChatView.{tsx,module.css}` for Chat's).
Welcome Â· `lib/coach-overview.ts` (+ its unit tests) Â· `teams/[teamId]/page.tsx`.
Content Â· `lib/help-content/coaches.tsx` (new Settings section; keyword sync) Â·
`components/coaches/CoachPortalTour.tsx` (B3 copy).
Shared Â· `app/[orgSlug]/coaches/coaches.module.css` **only if unavoidable** â€” foreign uncommitted
hunks live there (Â§0); prefer the component's own module.

**Not touched:** any write route, any API, any migration, the desktop bell, the free portal.

---

## 7. Verification

- **Static:** `npm run typecheck` (shared modules: `lib/coach-overview.ts`), `npm run verify:changed`
  fully green with **all six colour baselines + the date baseline unchanged at ZERO**, focused lint.
- **Unit:** `resolveOverviewAnchor` gains cases for the `welcome` kind â€” that it wins from a cold
  start, that it inherits the pre-season door, and **that it never returns once `tourDismissed`**
  (the regression that would re-welcome a coach every visit).
- **Probes** â€” new spec on the `coach-schedule-smoke.spec.ts` exemplar (service-role self-provisioning,
  marker prefix, asserted teardown, computed styles never screenshots, deterministic waits):
  1. **At 360px**, a coach reaches the notification feed: More â†’ Notifications â†’ the feed page
     renders; the settings link resolves.
  2. The unread count appears on **both** the More tab and the row, from one hook.
  3. **Every nav destination carries a help icon** â€” asserted by walking the nav's own door list, so
     a future nav item added without help fails the probe. (This is the rule, enforced.)
  4. Tapping each new "?" **opens the drawer with content**, not an empty panel.
  5. **The read-only-assistant sweep** (Chunk G rule 4) â€” an education surface must leak no write
     affordance; that class has bitten three chunks running.
  6. **Composed layout at 361px, at more than one scroll position** â€” Chunk C's QA found two
     portal-wide layout defects that control-level probes missed. Assert the More sheet with its new
     first row still fits its `max-height: min(70vh, 100dvh âˆ’ 5.5rem âˆ’ safe-area)` cap and remains
     scrollable, and that no header gains a second right-pinned control that collides with the help
     icon.
- **`/review` tier:** standard. Planning found **no write path** â€” every surface added is a link, a
  label, a pure resolver branch, or help content.
- **Owner QA on a real phone.** Every chunk since A has found its worst defect there.

---

## 8. Risks, and what is deliberately left open

1. **Stage H of the nav plan may add a second desktop door to this feed.** Chunk B does not create
   the conflict and does not resolve it â€” recorded so that plan owns it knowingly.
2. **`coaches.module.css` has foreign uncommitted hunks.** Mitigation: prefer component modules;
   stage `:(literal)` pathspecs only; `git show --stat HEAD` audited after every commit; build does
   not start until the concurrent agent commits (owner's call).
3. **Renaming a nav label changes a word customers have learned.** `Announcements` has shipped; the
   help guide, the tour and the empty states all say it. Mitigated by sweeping every occurrence in
   the same unit of work and re-syncing guide keywords so a search for "announcements" still lands.
4. **The welcome anchor is one more state in the portal's most contended slot.** Mitigated by
   putting the decision in the pure, unit-tested resolver rather than in the page, and by the
   `tourDismissed` gate making it a strictly one-time candidate.

---

## 9. Owner decisions for the mockup round

| # | Decision | Recommendation |
|---|---|---|
| **D-B1** | What distinguishes Chat from Announcements â€” rename, description, merge, or one "Messages" door with tabs? | **Rename one label: `Announcements` â†’ `Email families`; `Chat` unchanged; group header unchanged.** Merge and two-tab both rejected (different audience, medium and direction). Alternative `Families` is drawn. |
| **D-B2** | Where the mobile notification bell lives â€” bottom nav, page header, or More? | **More sheet, first row, opening the full feed page, unread badging the More tab** â€” the admin shell's shipped pattern. Costs of the other two placements stated in Â§2. |
| **D-B3** | The help-icon rule, and what a page with no guide does. | **Every nav destination gets one; drill-ins inherit their parent's. A page with no guide gets no icon â€” and the guide gets written.** Five doors close; Settings gains a new guide section. |
| **D-B4** | What a cold-signup premium coach sees first, given the Overview shows exactly ONE card. | **A `welcome` state at the top of Chunk I's ordered resolver**, inheriting the pre-season door, permanently retired by `tourDismissed`. Not a banner, not a second card. |

---

## 10. Definition of done

Plan + PM brief + **approved mockups** (labelled NEW / RESTYLED / UNCHANGED) before any code Â·
built in one pass Â· `/simplify` â†’ `/review` (standard) â†’ `/docs` Â· typecheck / `npm test` / focused
lint green Â· `verify:changed` green with all baselines unchanged Â· new probe spec passing Â· layout
measured at 361px at more than one scroll position Â· fresh dev restart (login 200, no `EACCES`) Â·
owner QA Â· committed on `dev` with explicit per-action OK and `:(literal)` pathspecs Â·
`PROGRAM_COACH_PORTAL.md` Â§1.1 ticked **including P1 #2** Â· `memory/design_decisions.md` entry Â·
help content updated in the same unit of work.
