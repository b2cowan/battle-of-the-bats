# Bank check — work it down to zero (the working draft)

**Status:** PLANNED 2026-11-07; **ALL SIX ASKS RULED 2026-11-07 (1A 2A 3A 4A 5A 6A, every recommendation taken: draft kept in this browser, "Started off by" shown, Add entry always there, 14-day expiry, restore at once, the words on a phone). WD1 committed `2a64a87d8` 2026-11-07 after /simplify and /review (see §7), owner walk owed. WD2 (the coach card) committed `47bd64918` 2026-11-07 after /design, /simplify and /review (see §8), owner walk owed; WD3 next.** Drawings: `BANK_CHECK_WORKING_DRAFT_DRAWINGS.html`, published https://claude.ai/artifact/HpFPDfFUAPLLeRLZyvTHMT
(round 2: button names and words settled with `/marketing`, see §4b). Asks in §5 ruled; build WD1 next. PM brief: `BANK_CHECK_WORKING_DRAFT_PM_BRIEF.md`.
Parent: `BANK_RECONCILIATION_PLAN.md` (the balance check, BC1–BC9). This is a sequel to it, not a change to its sum.

## 0. Where it came from

Owner, 2026-11-07, reading the second-account walk: "it would be good if I could enter the amount and, before saving, work
through entering my bank transactions in my ledger and see it working its way to the reconciled amount. Here I have to have
everything booked, then enter an amount and hope it reconciles."

**⚖ The premise was half right, and the code corrects it (checked 2026-11-07, not from the plan):**

| What the owner wants | What the club card does today | Gap |
|---|---|---|
| Type the statement balance first, watch "Off by" | Already live: every keystroke re-figures with the engine's `figureCheck`; no round trip (`BankCheckForm.tsx:111-116`) | none |
| Add the missing transactions without leaving | "Add the missing line" (today) opens the Ledger's own add window, prefilled with the gap; saving re-reads the figure and keeps the typed balance and marks (`:207-224`) | only offered once the check is **off**, and only as the one gap-sized line |
| Leave, book things in the Ledger, come back | **Nothing survives.** The typed balance, date and marks are React state only; navigating away or reloading loses them (`:67-80`) | **the real gap** |
| Open card notices a transaction booked elsewhere | Re-reads only on date change, "Try again", a saved/deleted check, or the in-app add door. **No** focus / visibility / polling re-read | gap (club only; the coach hub already re-reads on any money write) |
| Save when done | Save is allowed Off or Matching, no $0.00 gate (ruling 3) | none, keep |

So the work is small: **keep the work in progress, and keep the number fresh.** Nothing about the sum changes.

## 1. Rulings this builds on (do not re-open)

- The check is a **balance comparison, never a tick-off** (re-plan 2026-11-05). This plan adds no per-line marks. A
  line-by-line layer stays possible later: it would feed the same "Off by" figure and is not blocked by anything here.
  *(Reason it was dropped, for whoever revisits: the tick bookkeeping was most of R1–R2's cost, and a volunteer is not
  an accountant. Past rulings are reference; the merit argument is the volunteer.)*
- **Warn, never block.** Save stays allowed while off. A draft never gates a save.
- Nothing in bank code writes a book line. "Add entry" uses the Ledger's own add window and route.
- A saved check keeps the books it counted (Q3). A draft has no saved figures at all, so Q3 does not touch it.

## 2. What the owner sees after this

1. **The card remembers.** Type the date and balance, mark a line "Not in the bank yet", go to the Ledger, book three
   cheques, come back: the card is as you left it, "Off by" is re-figured from the books as they are now, and a quiet
   line says "Picked up where you left off · Nov 7 · Start over".
2. **A visible journey.** One quiet hint under the band: "Started off by $412.00" (worded like the shipped "Off by"),
   shown once the number has moved. Not a new tile and not a progress bar (a bar breaks when the number overshoots zero).
   At $0.00 the tile reads "Matches" as today.
3. **"Add entry" is always there** (once a date is set), not only when off. It opens the same Ledger add window blank
   (date filled from the check date) and stays on the card, so entering twelve statement lines moves the figure twelve times
   without a trip to the Ledger. The prefilled gap door stays as it is.
4. **The card notices outside changes.** Coming back to the browser tab re-reads the figure (focus / visibility), so a line
   booked in another tab shows up.
5. **Save is the finish line**, unchanged. Saving clears the draft.

Role differences: none new. A writer sees the card as today (the reader branch is unreachable on the club side; on the coach
side a money-read assistant sees no form, so no draft). Phone: same card, "Add entry" becomes a full-width quiet button above Save.

## 3. Design

### 3.1 Where a draft lives (ask 1; recommendation A)

- **A. This browser, per person, per account (recommended).** The draft is the date, the typed balance, the marked
  "not in the bank yet" lines and the figure the check started at. Kept in the browser's own storage, keyed by club + account +
  signed-in person. **No migration, no new route, no dictionary change, no prod step.** The kit already keeps per-viewer
  conveniences this way (`YearPill`, `TeamsScreen`). Cost: it does not follow the person to another device, and clearing site
  data loses it.
- B. On the server, per person per account. Follows the person across devices; needs a table, routes, the data dictionary,
  snapshots, a prod migration (and the BC1 migrations 447/449/450 are already waiting on prod), and a cleanup rule.
  Worth it only if volunteers start on a laptop and finish on a phone.

**⚠ Disagreement with my own earlier chat summary:** I first described "a draft on the account". The merit case is for A:
the inputs are four small values, the figures are always re-read from the books, and the whole point is "leave and come back
to the same screen" (same browser). Say so out loud before building B by reflex.

Draft rules (A):
- Written only once there is something worth keeping (a balance typed, or a line marked); never for an empty card.
- Per account. Switching account pill shows that account's draft.
- Removed on: Save (success), "Start over", 14 days idle, sign-out where the app already clears per-person storage.
- Restore re-figures from the server's current books (the date's figure is re-read first; the band draws only after).
  A restored mark whose line the books no longer offer is dropped with one sentence, never silently kept (the server's
  `bad_item` refusal remains the backstop on Save).
- The draft holds a statement balance, which is the club's figure, not a person's data. No new collection about people,
  so no `/legal` change; shared-computer risk is the one point to state in help ("Start over clears it").

### 3.2 Keeping the number fresh

- Re-read the figure on window focus / tab becoming visible (club). Debounced with the date read already there. No polling.
- The "started at $X off" figure is the first Off by the draft saw with a typed balance; it resets when the date changes
  (a new day is a new check, as the form already treats marks).

### 3.3 Add entry, anytime

- Reuse the existing Ledger add window and route (`AddEntryWindow`); only the trigger is new.
- **Which book (checked 2026-11-07):** the account's own club book, else its first (`BankCheckForm.tsx:144-146`); the window's
  eyebrow names it. The plain button chooses the same way. Money and Date open set (Money follows the gap), the amount blank.
- **Heading-row action** is an existing kit pattern; the new button is the outline kind ("an action that opens a window").
- Coach side: the Record-money conversation, opened blank. The coach hub already re-reads on every money write.

### 3.4 Not in this plan

- Per-line ticking (see §1). Shared/co-editing drafts (needs B and an "who is editing" rule). Drafts for a *saved* check
  (that is "Check this statement again", unchanged). Any change to the report, Find's hints, Matches/Off by rules.

## 4. Stages (each one session)

- **WD1 · club desk + phone.** Draft store (A) for the club card; restore + "Picked up…" line + Start over; started-at caption;
  Add entry button; focus re-read. Tests: pure draft helpers (write/expire/restore/validate marks) in unit tests; a guard that the
  draft code writes only to browser storage and never calls a bank route; walk on dev at 1440 / 390 / 361.
- **WD2 · coach portal.** The same helpers on `CoachBankCheck` (balance + cash); "Record" opens Record-money blank; walk.
- **WD3 · words + help + walk.** `/marketing` pass on the new sentences; the `bank-tab` help article gains "Work it down to
  zero"; `/docs`; one short owner walk per portal (they are short; one purpose each).

Finishing passes per stage: `/design`, `/simplify` (the draft helper is a new shared abstraction), `/review`.

## 4b. Words (owner ruled the button names 2026-11-07; strings settled through /marketing the same day)

Rule: **a button is named after the window it opens, in each portal's own vocabulary.** Not unified across portals (club
says "entry", coach says "record"; "entry" in the coach portal means a tournament entry, so it must not be used there).

| Where | Words |
|---|---|
| Club card button | **+ Add entry** (outline; the Ledger's button and window say the same) |
| Coach card button | **+ Record** (outline; Money's button, opens Record money) |
| Club gap link (renamed from "Add the missing line") | **Add the missing entry** |
| Coach gap link (renamed) | **Record the missing amount** |
| Restore line | **Picked up where you left off**, plus " · last worked on Nov 5, 2026" only when from an earlier day (shipped date helper); link **Start over** |
| Journey hint | **Started off by $412.00** (hidden while it equals the live "Off by") |
| Resting sentence | **Kept in this browser only, until you save this check.** (long form if the card has room: "Your work is kept in this browser until you save this check. It won't follow you to another device.") "On this device" was dropped: it hides the laptop-to-phone case. "Save this check" ties it to the button, not the saved list. |
| Dropped-mark callout | **One line you marked isn't in your books any more, so we took it off.** Plural: "{n} lines you marked aren't in your books any more, so we took them off." |

Open items, not decided here:
- The shared hint text says "a deposit or interest you haven't entered" (club and coach, one words file). The coach would
  read "entered" beside "Record". Giving the coach its own verb ("recorded") is a wider change; owner call.
- The card already used three nouns for one thing (**line** for a marked item and the list, **item** in the saved-check
  words, **entry** for the Ledger window). Reported, not fixed; "line" stays the card's noun for a marked row.
- Coach-only strings need their own keys in the shared words file (`lib/bank-tab-words.ts`, shared by both portals).

## 5. Asks for the owner — RULED 2026-11-07, all A, as recommended (all in the drawings, tab "Asks")

1. **Where the draft lives:** A this browser (recommended) · B the server.
2. **"Started off by $X" hint:** show it once the number has moved (recommended) · show nothing extra.
3. **Add entry:** always available on the card (recommended) · only when off, as today.
4. **Idle expiry:** 14 days (recommended) · keep until saved or discarded.
5. **Restore:** automatic with a one-line "Picked up where you left off" (recommended) · ask first ("Continue your check? Continue / Start over").
6. **Add entry on a phone:** the words, as drawn (recommended; a bare "+" beside "Check a statement" could read as adding a whole check) · a bare + button (the usual phone rule).

**My calls, stated in the drawings, flip on request:** "Start over" clears at once with no confirm (only a typed balance and marks
are lost); "Kept in this browser only, until you save this check." is a resting sentence while a draft exists (not a fading pill);
both "Add entry" (blank amount) and the gap door "Add the missing entry" stay, with their two names; the restore line names the
day last worked on only when it was an earlier day. Exact words to `/marketing` in WD3.

**`/design` pass 2026-11-07 (drawings):** 3 must-fix applied (the Add an entry window redrawn from the shipped one: Money is a
select, field order, `*`; the "Today" frame's dates follow the typed date; the saved line shows the page notice, not a toast).
Should-fix applied: Find heading drawn, desk notes under the date/balance row, 44px links on a phone, "Started off by" wording,
dated restore line, dropped-mark callout, markers on every note, dark tokens aligned to shipped. Not applied: the nit about
placing the hint under the sums.

## 6. Risks and where they sit

- **A false comfort at $0.00.** Two mistakes can cancel. Unchanged from today; wording stays "Matches" = totals agree.
- **Two people, two drafts.** With A each person works their own; the second to Save replaces the first's check for that
  date ("Saving replaces that check" already warns). Shared drafts are explicitly out (§3.4).
- **A restore that lies.** A draft older than the books it was typed against. Mitigated: figures are always re-read; marks
  validated; date shown on the restore line.
- **Accounting / tax:** none (product feature; no change to what we charge, invoice or record). Legal: none (§3.1). Help-docs
  sync: yes, WD3. Demos: no demo number touched.

## 7. WD1 build record (2026-11-07)

Built as ruled. Draft helper `lib/bank-check-draft.ts` (pure, storage injected; WD2 reuses it), wired in `BankCheckForm`;
`BankTab` hands the signed-in person (`useOrg().user.id`; the form re-keys when it arrives); sign-out clears every draft in
`signOut()` (lib/auth, beside the support console's Recent; the `scope: 'local'` sign-out paths that skip that wrapper are not
covered, but the key carries the person, so another person never reads it). Words in `lib/bank-tab-words.ts` (`addEntry`,
`addMissingEntry`, `draftPickedUp(On)`, `startOver`, `startedOffBy`, `draftKept`, `draftDropped`); the coach's
`addMissing` is untouched for WD2. Tests: `tests/unit/bank-check-draft.test.ts` (helpers + guards); two pins in
`bank-r2c-screens-guard.test.ts` moved with the code.

**Two calls made in the build, said to the owner (flip on request):**
1. **"Started off by" anchors at the balance as last typed**, not the first difference seen. Typing "5402.10" passes through
   "5"; the literal reading would have said "Started off by $4,985". A new balance or a new date re-anchors; marks and lines
   added are the work and never move it. Hidden when it equals the live difference, and when the check started at a match.
2. **Marks are re-checked on every read of the day**, not only on restore: a line deleted (or its amount changed) in another
   tab drops with the same amber callout, and a kept mark always carries the books' amount now. Only keys are stored.

Also: "Kept in this browser only…" shows only when this browser will hold a draft (a probe at open), never over blocked storage.
"Check this statement again" opens that day fresh and leaves the draft until the first keystroke replaces it.

**/simplify + /review (2026-11-07), committed `2a64a87d8`:** Find and the draft helper now share one line-to-item conversion (`itemOfLine`; the coach card's own copy goes in WD2). One defect found and fixed: a date cleared from the calendar was stored as an empty date, which the reader refuses whole, so the typed balance went with it; the draft now keeps the balance and comes back on today. Looked at and left as built: a restored date the server now refuses (the sentence shows, the marks wait, Save is off until another day is picked); "Check this statement again" over a draft (starts fresh, the old draft stays until the first keystroke replaces it); the person arriving after mount (the form re-keys); a focus re-read while Add entry is open (the window keeps what it opened with); a failed Save (the draft is cleared only on success); blocked storage (every touch is wrapped). Checks: bank tests 420/420, spelling, focused lint clean, typecheck clean for WD1 (its only errors are two in `tests/unit/renewals.test.ts`, another session's; the dev server's generated `.next/dev/types/routes.d.ts` also has a syntax error that hides every other error from a plain `npm run typecheck`, so it was run with that folder excluded).

## 8. WD2 build record (2026-11-07, committed `47bd64918`)

Built as ruled, on the coach card (`CoachBankCheck`), through the WD1 helper: club = the org slug, account = the **team id**,
person = the signed-in coach (`useOrg().user.id` in `CoachBankView`; the card is keyed on team + person, so it re-keys when the
person arrives and never carries one team's work into another's draft). Same storage prefix, so `signOut()` clears coach drafts
too (both coach sign-out doors use it). The helper grew one optional field, **the cash** (stored only when typed, so a WD1 draft
and the club's stored shape are unchanged; key version stays `v1`; counted in "worth keeping"; a non-string is refused). Words:
`record` ("Record") and `recordMissingAmount` ("Record the missing amount"); `addMissing` retired (no reader left). Find uses
the shared `itemOfLine`; its own copy is gone. "+ Record" opens the Ledger's Record money conversation with no branch and no
amount, both day fields set to the check's date (the coach answers what happened; picking a branch keeps the day). The focus
re-read listens only while the Ledger is on screen (`active`); restore still happens at mount. No year parameter, no look-back:
`HISTORY_ENDPOINTS` unchanged, history guard green.

**One call made in the build, said to the owner (flip on request):** the build prompt said marks are re-checked "through the shared
`offeredItems`", which counted this season's lines and the Still-waiting items only. **The coach's Find also offers last season's
lines** (a cheque across the rollover, Q1-A) and the server's save rule accepts them (`coachMarkable`), so as written every such
mark would have been dropped, with the amber callout, on every re-read. `offeredItems` now also takes the figure's optional
`lastSeason` lines (and an optional `onItsWay`, as ruled). The club figure has neither change in effect.

**/design (code-only):** no must-fix; order and position match the club frames tab for tab (heading row → restore line → callout →
fields; band → "Started off by" → sums → Find; under Save: off note, replaces note, "Kept in this browser only…", then the coach's
own "Statements from this season only…" line). No coach frame needed in the drawings. Applied: a token without a literal
fallback; `p.note` / `p.since` element-qualified so their margin never depends on sheet order.
**/simplify:** applied the simpler optional-`cash` type (one stored shape, no casts) and a loop in `offeredItems`. Not applied,
recorded as a follow-up after the owner walks: one shared draft hook for both cards (≈60 near-identical lines, and a shared
"tab came back" hook), and a per-portal offered-lines rule beside each server rule; both would rework the walked, committed club
card, which this session's brief keeps untouched.
**/review (high-risk tier, 4 lenses: correctness, concurrency/state, regression, security/roles/privacy):** no Critical/High/Medium
survived. Applied: the card key carries the team (hardening). Refuted: "+ Record off until the day's figure is read" (as ruled);
"Check again then Save clears the other day's draft" (its first keystroke already replaced it, the WD1 rule, and Save needs a
typed balance). Left as built, both the same on the club card: a failed background re-read hides the band until "Try again"
(the work is untouched); the amber dropped-mark note stays until a new day or Start over. Help text still names "Add the missing
line" (`lib/help-content/coaches.tsx`, and the club's in `accounting.tsx`): WD3.
Checks: bank tests + history guard 449/449; spelling; focused lint clean (the Ledger panel's 25 warnings are older); typecheck clean
with `.next` excluded; `check:layout --only=coach-ledger-bank` clean at 361 / 390 / 768 / 1440. `npm test` has one failure in
another session's files (a GST/HST words guard on `lib/console-money-sales-tax-wait.ts`), not this one's.

**Open owner call (plan §4b):** the shared hint says "a deposit or interest you haven't **entered**", and the coach now reads it
beside "+ Record". Recommendation: give the coach card its own verb ("…you haven't recorded"), a coach-only key in the words file,
in WD3's `/marketing` pass, not widened here.
