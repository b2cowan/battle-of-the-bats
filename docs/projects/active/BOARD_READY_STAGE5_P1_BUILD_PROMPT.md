# Board Ready · Stage 5 (Club events) · Part 1: the Events place and the create-event window

> **Written 2026-11-27** (owner: "i agree, write the part 1 build prompt"). Run it in a fresh `/clear` chat:
> *"Read and follow `docs/projects/active/BOARD_READY_STAGE5_P1_BUILD_PROMPT.md`, Session 1."*
> **Two sessions.** Session 1 draws what the drawings leave open and gets it ruled; it builds nothing. Session 2 is a new
> chat that builds. Plan of record: `BOARD_READY_PLAN.md` §5 Stage 5. **The plan beats this prompt; the code beats the
> plan.** Where either happens, say so.
> Model: Opus (a new table, a new grantable access, a plan gate).

## What a club gets

An **Events** place in the club admin: a list of the club's own events, month by month, and one window that makes or
changes an event (name, kind, day or days, time, venue from the venue library, who it's shown to, a few lines about it).
Nothing public, nothing on the calendar, no sign-ups, no money.

## Start conditions

1. Read `BOARD_READY_PLAN.md` §5 Stage 5 in full, including the rulings of **2026-11-27** at its end.
2. Those rulings and round 2's (paid events) were **uncommitted** on 2026-11-27. Check `git log` for them; if still
   uncommitted, tell the owner before building.
3. `git status`. On 2026-11-27 other sessions had unfinished changes in files this part may reach: the venue library
   (`lib/venue-library.ts`, `lib/venue-library-server.ts`, its route, page and styles), `lib/help-content/org.tsx`,
   `DATA_DICTIONARY.md`, `MANUAL_PROD_STEPS.json`, `tests/unit/team-move-coverage.test.ts` and the shared record files.
   **Ruled 2026-11-27:** Part 1 stays clear of the venue library's unfinished changes and of the schedules project's next
   stage (`SCHEDULE_FIELDS_SAME_TIME_TRADES_PLAN.md`). If the build needs one of those files while it is still
   uncommitted, stop and ask.

## The source of truth

- Round 1, `BOARD_READY_STAGE5_7_EVENTS_CAMPS_DRAWINGS.html` (https://claude.ai/artifact/RdoaEjuySmXcVLyEQc6RtD):
  tab 1 (where Events sits), tab 2 (the list, phone, empty state), tab 3 (the window, desktop and phone, and its rules).
- Edit window and the nearest thing to an event's own page: `BOARD_READY_STAGE5_PAID_EVENTS_DRAWINGS.html` ("Edit the
  year-end banquet", the "About the banquet" card) and round 1's camp page. Both are drawn with later parts on them.
- Session 1's drawing, once ruled.

Build to the drawings and rulings. A difference the build needs is drawn and ruled first.

## The rulings this part holds (add nothing to them)

- **1.** Events is its own place in Programs, after House league. The owner, admins and the registrar open it, and a club
  can give it to anyone else, as it can Sponsorships. (Tabs: Events now; Sign-ups only once a camp or clinic exists, so
  **no tabs in Part 1**.)
- **2.** An event holds: name, kind (Banquet, Champs day, AGM, Clinic, Camp, Other), one day or several, a time or All
  day, a venue from the venue library (a new place is added to the library from the same list), who it's for, a few lines.
  A create window that asks before it saves. (Permit field time is Part 2.)
- **3.** Shown to: Everyone or Club staff. "Our families" isn't shown until the family app is switched on.
- **9.** Events sends no email.
- **19.** Words: "Events", "Add an event", "Shown to" (Everyone, Club staff), "Club events". Use "Shown to" for the
  audience; "Who it's for" means birth years.
- **Gate** (`BUSINESS_DECISIONS.md`, 2026-11-10): League Plus and both Club bands; no new price, band or key. The
  drawing's `/billing` note: its own place the way Sponsorships was, not the venue library's access check. On Tournament
  and Tournament Plus it is absent (no row, no upsell). No copy presents events as a reason to move between League Plus
  and Club.
- **2026-11-27:** schedule listings (E11), the coaches' view (E12) and closed-place warnings (E7) are Part 2's; champs
  day follows Part 2; the public event page is Part 3's.

## `/legal` rules for this part

`docs/agents/legal/BOARD_READY_STAGE5_7_EVENTS_CAMPS_REVIEW.md`.
- A helper line on the description: no children's names or health details. The words are not written (`/marketing`).
- A Club staff event never appears on any public page, feed, sitemap, share image or public data. Part 1 adds no public
  reader at all.
- No announcement email from Events.
- Keep the event's **end date** as its own stored fact: the later retention clock runs from it.

## Not in this part

| Left out | Where it goes |
|---|---|
| Sign-ups tab, spot and review chips | Stage 7 (tab) and Part 3 on |
| Field time from a permit, and the footer line naming it | Part 2 |
| The calendar, "Add an event" there, "Club events" as a program | Part 2 |
| "Also on these schedules", the coaches' row, closed-place warnings | Part 2 |
| Champs day's season picker, game count and page | Its own slice after Part 2 |
| Public event page, club website rows, sign-ups | Part 3 |
| Price, refund policy, GST/HST, cancelling a paid event | Part 4 |
| "Who signs up", team offers, "Only people with the link" | Part 5 |
| Camp page, sessions, instructors | Stage 7 |
| Family app view; a club event as a sponsor placement | Later |

---

## Session 1: draw what is open, get it ruled, build nothing

One Artifact page, house layout: before/after, true size, desktop and phone, controls drawn from the shipped components,
every highlight clickable, one numbered ask per open point with a recommendation. Run `/design` before hand-off and
`/marketing` on every new word. Record the rulings as ruled in the plan, and give the owner the plain-language UX
summary `AGENCY_RULES.md` requires before Session 2.

Open on 2026-11-27 (nothing found that settles them; check again):

1. **The list's rows.** The drawing joins up to five facts with dots. The owner ruled that out on 2026-11-26
   (`docs/agents/design/TABLE_AND_LIST_STANDARD.md`), after the drawing. Redraw, desktop and phone; the drawn phone rows
   also drop kind, venue and audience unevenly.
2. **One event's own page** for a plain event: layout, facts, the card's title for AGM and Other, where "About it"
   shows, and with nothing written.
3. **Editing:** a window with Save (drawn on round 2) against the quoted "edit autosaves, create asks"; which fields
   change; whether the kind can.
4. **Cancelling or deleting** an event with no sign-ups and no money: nothing drawn or ruled.
5. **After "Add the event":** where the person lands and what they're told.
6. **Champs day, Camp and Clinic in Part 1:** offered or held back? Their own pieces come later, and the drawing opens a
   camp page after saving.
7. **Words that promise unbuilt things** (window subtitle, the two "Shown to" hints, the empty state, "Sign-ups, sessions
   and a price are added on the event's page"), and **whether Part 1 reaches production alone** or is held until a later
   part. A release hold exists as precedent (`lib/sponsorships-open.ts`).
8. **Several days:** the fields, one time or one per day, days that aren't back to back.
9. **Time:** required or not, end optional, end before start, past midnight, All day.
10. **Adding a new place from the list.** Today only the owner, admins, the league admin and tournament creators may save
    to the venue library (`canSaveVenueLibrary`), so a registrar, whom ruling 1 lets open Events, is refused. No
    club-admin picker both chooses and adds a place, and the shipped Add venue window isn't made to open over another.
11. **The league admin:** ruling 1 names the owner, admins and the registrar. Is the league admin in by default?
12. **Where Events sits** when House league is under "Also on your plan" or absent (today only the Club group takes added
    places), and the phone's More sheet row.
13. **The year control and the list:** calendar year or fiscal year (the shipped pill is the money side's); the Past band
    opened; when an event becomes past; an event crossing two months; search, no results, an empty year, a failed load.
14. **The records trail:** do making, changing and removing an event show in the owner's Audit log?

---

## Session 2: build

### Facts read from the code (a helper's census, 2026-11-27: re-check each before relying on it)

- **Precedent:** Sponsorships Part 1, commit `ee17f50df` (read its file list: it is the touchpoint list).
- **Access:** `lib/roles.ts` (a new capability; role defaults; `ALL_CAPABILITY_KEYS`); a pure place gate and an API gate
  like `lib/club-sponsorships-place.ts` and `lib/club-sponsorships-auth.ts`; a layout for the place; routes under
  `withObservability`. Grants: `lib/member-access.ts`, the member dialog, the limited-member refusal in the member route,
  `member-summary.ts`, `RoleGuide.tsx`, `lib/not-yours-words.ts`.
- **Navigation:** `lib/admin-kit-nav.ts`, `useAdminKitNav.ts`, `AdminBarPlace.tsx`. Programs-group placement is new code.
- **Plan gate:** `lib/plan-config.ts`, `lib/plan-module-entitlements.ts`, `lib/billing-cancellation-policy.ts`; the
  database check on plan module keys needs widening. `PLAN_PRICING_FACTS.md` changes in the same unit of work (its Board
  Ready line is stale), and `/strategy` runs its drift check.
- **Venue:** stored as the library venue and facility ids plus a copy of the words (`clubVenueFields`,
  `lib/rep-event-where.ts`). A new user of a venue joins the usage, booked and rename-carry reads in
  `lib/venue-library-server.ts`, or a used venue can be deleted.
- **Database:** no club-event table exists. Next migration looked like **556** (555 was another session's, uncommitted):
  check again. Re-runnable, row security on, public roles revoked, service role granted (see migration 525).
- **Deletion:** the table goes with its org. Club deletion removes venue facilities before the org row, so the event's
  facility link must not block it. A new org table also enters `team-move-coverage`.
- **UI:** `KitDialog` (`kind="form"`, `dirty`, `discardAsk`; the ask-before-saving precedent is the sponsorship package
  window), `ClubSection` / `ClubRowList` / `ClubRow`, `SearchField`, the shared date and time inputs (native date inputs
  fail the build), `formatTime` / `formatStoredDate`.
- **Help:** an article in `lib/help-content/org.tsx`, the help page index, the place's entry in `admin-page-help.ts`.

### Order

1. The UX summary and the task list.
2. **Migration first**, applied to **dev only** at the owner's yes; dictionary and snapshots; the production step in
   `MANUAL_PROD_STEPS.json` for anything the migration check can't see.
3. Access, plan gate and navigation.
4. The routes, the list, the window, the event's page.
5. Help, deletion coverage, guards and tests (nav, role defaults, member access, plan profile, team move, a Stage 5
   guard), `scripts/layout-screens.mjs` entries.

## Standing rules

- Branch `dev`. Explicit paths only. A private index for files other sessions hold. No commit or push without the owner's
  yes; no Co-Authored-By footer.
- `npm run verify:changed` and `npm run typecheck`; type-check a clean checkout before a commit. Restart the dev server
  before the owner tests (new files and shared modules).
- Production: counts and schema only. No demo reseed.
- Record the commit and walk number in the plan, the prompts index row and the board line, in the same commit.

## Closing the session

`/legal` re-check, `/docs`, one `/marketing` pass, `/simplify` then `/review`, `/ux` at 390, a probe, then a checkable
Artifact walk (20–50 boxes, one action each, exact logins including a registrar and a person given Events, password
`UATPassword2026!`; include a plan without Events). Commit at the owner's yes. Hand back the commit hashes and the walk
number.
