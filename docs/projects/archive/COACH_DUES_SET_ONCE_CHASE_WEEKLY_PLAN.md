# Coach Player Dues — Set Once, Chase Weekly (build plan)

**Status:** ✅ COMPLETE — committed `06645a32` (D1–D3 · E1–E5 · G1–G3) + `d7771935` (the owner's
second look on the built grid) 2026-09-04 on `dev`, Owner QA **§140 PASSED** 2026-09-06, 37/37, all
nine parts, zero defects. **G4 (sticky headings) is the one item NOT built** — deferred by the owner
at ruling time to the first twenty-family roster, and carried in TODO.md's Deferred Enhancements so
it does not retire with this plan.
**Owner QA:** ledger **§140** — PASSED; Part I's three calls all ratified as built (the never-paid
nudge's missing "Last reminded" was closed separately in the *stamp it* direction by §136,
`885e56a1`). One assertion rests on the code rather than a signed-in look: the fixture has no
read-only money account to prove the set-once door is withheld from a coach who cannot write money.
**Walk artifact:** https://claude.ai/code/artifact/92122f73-a728-4b60-b913-aa3e994a4601

**Owner decisions:** 2026-09-04, twelve answers on mockup artifact
`6bd4c6d9-bcfd-4198-8aa5-2fb709284f8b` ("Set Once, Chase Weekly", rev 2). All on the recommended
path. One refinement (G1 notes): the "Swipe to see later installments" chip is **removed outright**
once the pager exists — it never worked for a mouse user.
**PM brief:** `COACH_DUES_SET_ONCE_CHASE_WEEKLY_PM_BRIEF.md`
**Predecessors:** the money banner standard (D4/D5, 2026-09-03), exceptions-first Set-dues preview
(QA §128), the chase-card removal (`e046df39`, 2026-09-03).

---

## 0. The ruling this build rests on

**No lock on dues.** The owner re-asked the 2026-08-14 question ("should we lock the team payment
schedule at some point?") and the answer is the same: re-running mid-season is legitimate, the help
guide promises it works, and the protection is the exceptions-first preview (hand-set schedules
named and kept by default, payments never touched, the payout floor refuses by name). What changes
is **prominence**: a set-once door does not belong beside the weekly buttons. Budget Plan and
Overview already hide their doors once dues exist; Player Dues was the odd one out.

Corrected premise, recorded so it is not re-argued: changing dues does **not** change the budget
plan (the plan feeds dues). What moves is Assessed, family balances, reminder dates and the
expected player money on Overview / Budget vs. Actual.

---

## 1. Scope — twelve items, one pass

| # | Item | Surface | Size |
|---|------|---------|------|
| D1 | View pill replaces the segmented Season totals / By installment pair | dues panel | **built** (this session, pre-decision) |
| D2 | "Set dues for all players" leaves the toolbar once dues exist; "Change the schedule for everyone" at the foot of the Collection schedule | dues panel, `CollectionSchedule` | small |
| D3 | Send due reminders confirmation: count, skipped, missing-email, zero state, "See what they'll receive" (on-demand variant) | dues panel, `send-reminders` route (preview mode), `DuesReminderPreviewModal` | medium |
| E1 | Balance owing caption: "excludes $X owed back to N families" | dues panel band | tiny |
| E2 | "Last reminded" line in the player's panel | dues panel | small |
| E3 | `Showing` filter beside View: Everyone · Behind · Still owing · Nothing owing; export follows | dues panel, `InstallmentBreakdown` | small |
| E4 | "Remind this family" for any family late / due within 3 days / never paid; one button, the right email | dues panel, `send-reminders` route (`playerId`) | medium |
| E5 | Guardian contact line in the player's panel, gated by the roster PII grant (already applied server-side) | dues panel | small |
| G1 | Date-first column headings: "Oct 4" over "#4 · $97.08"; "Varies" where dates differ | `InstallmentBreakdown` | small |
| G2 | The installment to chase is lit (BvA `.thisMonth` tint) and in view on open | `InstallmentBreakdown`, `lib/dues-installment-view.ts` (shared focus helper) | small |
| G3 | ‹ › pager beside View when columns overflow, one column per press; swipe chip removed; shared `ColumnPager` adopted by BvA too | `CoachScrollX`, `InstallmentBreakdown`, dues panel, BvA panel | small |
| G4 | Sticky column headings on a long roster | — | **later** (owner: revisit at the first twenty-family roster) |

No migration. D3 and E4 change a server route and get the `/review` pass.

---

## 2. Design facts the build obeys

- **D2 door.** Rendered only when `showSeasonTotals` (a schedule exists) and `moneyCanWrite`. Foot
  line inside the open fold: "Same N installments for every family" or "N installments · M families
  set by hand" (hand-set = `describeExistingSchedules` from `lib/dues-bulk-run.ts`, the ONE home of
  that judgement — computed client-side from the players' installments, same shape comparison the
  write route uses). Link opens the same generator (`setApplyAllOpen(true)`), tap floor 44px. The
  toolbar button stays for the no-dues setup block (unchanged) and goes from the toolbar when dues
  exist. Layout baseline: the `button·Set dues for all players` tap-floor entries on
  `coach-dues*` become stale — prune on the next sweep.
- **D3 preview.** `POST /dues/send-reminders` with `{ preview: true }` computes the same selection
  the send uses and returns `{ families, installments, skippedRecent, missingEmail, nextDue }`
  without sending or stamping. `skippedRecent` = families who would qualify but for the 7-day
  courtesy (candidates re-run with `ignoreRecentReminders`). The modal fetches on open; while
  loading it says so; on zero it disables Send and names the next installment and its date. The
  preview modal takes `variant: 'wave' | 'onDemand'`; on-demand builds the sample with
  `window: null` and one overdue row, so the subject and "was due" wording match the send.
- **E1.** `inCredit = Σ max(0, −rollingBalance)`, `n` = count of those families; caption only when
  `n > 0`.
- **E2.** Max over the player's installments of `reminderSentAt` (on-demand / single-family) and
  `reminder30SentAt` / `reminder7SentAt` (automatic). Line: "Last reminded Nov 3 · Installment 2 ·
  automatic" or "· from this page". The never-paid nudge does not stamp (unchanged), so it is not
  reported here.
- **E3.** `?duesShow=behind|owing|clear` rides the URL like `duesView` (a coach shares "here's who's
  behind"); default Everyone. Behind = status Past due; Still owing = `leftToSend > 0.005`; Nothing
  owing = schedule exists and `leftToSend ≤ 0.005`. Not-set players appear under Everyone only.
  Option labels carry counts ("Behind · 3"). Filters the totals table and the grid; never the band
  or the Collection schedule. Export uses the filtered rows and appends the filter to `scopeLabel`.
  Empty result: one line, "No families are behind right now." etc.
- **E4.** One button, "Remind this family", shown when the family (a) has an installment past due or
  due within 3 days with money to send, or (b) `isNeverPaidPlayer`. (a) posts `send-reminders`
  with `{ playerId }` — same template, same 7-day courtesy (if suppressed the route answers
  `{ emailsSent: 0, skippedRecent: true }` and the panel says so); (b) posts `remind-unpaid`
  (the "nothing paid yet" email) as today. Server: `send-reminders` filters candidates to the
  player when `playerId` is given.
- **E5.** `selected.player.guardianFirstName/LastName/Email/Phone` — already null for a coach without
  the roster PII grant (`redactRosterPlayer` in the dues route), so the line simply renders nothing.
- **G1.** Heading primary = `commonDueDate` (short) or "Varies"; secondary = `#N · $amt` or
  `#N · amounts vary`. Cells unchanged.
- **G2.** `focusInstallmentColumn(columns)` moves into `lib/dues-installment-view.ts` (earliest with
  remaining > 0; a column with `behindCount > 0` outranks) and `CollectionSchedule` reads it too, so
  the timeline and the grid can never disagree. Column cells/heading carry `data-focus`; tint =
  `rgba(var(--primary-rgb), 0.10)` + heading in `--primary-light`, the BvA rule. On mount and when
  the focus changes, scroll the scroller so the focus column sits first after the pinned zone.
- **G3.** `CoachScrollX` gains `affordance: 'hint' | 'external'` and an `onOverflowChange` /
  `scrollerRef`; `'external'` renders no chip (the caller supplies the pager) but keeps the a11y
  region label. New shared `components/coaches/ColumnPager.tsx` (‹ range ›), styles moved from
  `bva.module.css` `.monthPager*` to `coaches.module.css` `.colPager*`; BvA adopts it (no visual
  change). The dues panel renders the pager in the toolbar's left group when `installmentView &&
  overflowing`; one column per press.

---

## 3. Files

- `app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/panel.tsx` — D2, D3, E1–E5, pager slot
- `app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/CollectionSchedule.tsx` — D2 foot, shared focus
- `app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/InstallmentBreakdown.tsx` — E3, G1–G3
- `lib/dues-installment-view.ts` — `focusInstallmentColumn`
- `components/coaches/CoachScrollX.tsx`, `components/coaches/ColumnPager.tsx` (new)
- `components/coaches/DuesReminderPreviewModal.tsx` — `variant`
- `app/api/coaches/[orgSlug]/teams/[teamId]/dues/send-reminders/route.ts` — preview + playerId
- `lib/db.ts` — `getDueReminderCandidates` option `ignoreRecentReminders`
- `app/[orgSlug]/coaches/coaches.module.css`, `budget-vs-actual/bva.module.css`, BvA `panel.tsx`
- `lib/help-content/coaches.tsx` — the door's home, the filter, the grid headings, the confirmation
- `scripts/layout-screens.mjs` — `coach-dues-behind`
- `tests/unit/dues-installment-view.test.ts` — focus helper

## 4. Verification

- `lint:focused` on every touched file; `typecheck`; `verify:changed` (spelling, css-selectors,
  contrast, demos).
- Unit: focus helper (late outranks future; fully collected → null).
- `check:layout --only=coach-dues,coach-dues-installments` needs the dev server + reseed — run in a
  follow-up session; expect the two `Set dues for all players` baseline entries to prune.
- Owner QA walk: new ledger §.

## 5. Deferred

- G4 sticky headings (owner: later).
- Demo narration: no tour step stops on Player Dues; nothing to true up.
