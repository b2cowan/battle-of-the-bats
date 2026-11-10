# Build prompt — Bank check: work it down to zero, WD1 (club desk + phone)

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-07, after the owner ruled all six asks
> (1A 2A 3A 4A 5A 6A) and the words were settled through `/marketing`. Plan of record:
> `docs/projects/active/BANK_CHECK_WORKING_DRAFT_PLAN.md`. WD2 (coach portal) and WD3 (words, help, walks) are separate sessions.

---

Bank check: work it down to zero — **WD1, the club desk and phone.** Product code.

## Read first, in this order

1. `docs/projects/active/BANK_CHECK_WORKING_DRAFT_PLAN.md`: §0 (what the code already does, so you do not rebuild it), §1 rulings,
   §2, §3, **§4b (the settled words, use them exactly)**, §5 (rulings), §6 risks. Then the PM brief next to it.
2. The drawings: artifact https://claude.ai/artifact/HpFPDfFUAPLLeRLZyvTHMT (source
   `docs/projects/active/BANK_CHECK_WORKING_DRAFT_DRAWINGS.html`). Tabs 1–5 are what you build to, desk and phone. Build to them.
3. `components/admin/kit/club/money/bank/BankCheckForm.tsx` in full (state, the figure read, `figureCheck`, the own-book choice, the add door),
   then `BankFind.tsx` and `lib/bank-tab-words.ts` (every sentence on the card lives there; **new words go there too**).
4. `components/admin/kit/club/money/LedgerWindows.tsx` (`AddEntryWindow` and the `prefill` it already takes).
5. The per-viewer browser-storage precedents, to copy their try/catch habit: `components/admin/kit/club/money/YearPill.tsx`,
   `components/admin/kit/club/league/teams/TeamsScreen.tsx`.
6. `docs/projects/active/BANK_RECONCILIATION_PLAN.md` ruling 1 and Q3 only (a check is a balance comparison; a saved check keeps the books it counted).

Broad reading and censuses go to a helper agent (CLAUDE.md). Check a helper's claims against the code before building on them.

## What this session changes (owner-ruled, do not re-open)

- **The draft lives in this browser** (ask 1 = A). No migration, no new route, no data-dictionary change, no prod step.
  Keyed by club + account + signed-in person. Written only once there is something worth keeping (a balance typed or a line
  marked), never for an empty card. Holds: date, typed balance, marked "not in the bank yet" lines, and the figure the check started at.
  Removed on Save (success), **Start over**, 14 days idle (ask 4 = A), and wherever the app already clears per-person storage on sign-out.
  Every read and write in try/catch; the card must work with storage blocked.
- **Restore at once** (ask 5 = A): the card comes back as you left it with the quiet line "Picked up where you left off", plus
  " · last worked on {date}" only when from an earlier day (shipped date helper, never hand-built), plus the link **Start over**,
  which clears at once with no confirm. **Figures are never restored**: the date's figure is re-read from the books first, the band draws after.
  A restored mark the books no longer offer is dropped with the amber callout (plural form in §4b), never silently kept. The server's
  `bad_item` refusal on Save stays as the backstop.
- **"Started off by $X"** (ask 2 = A): the first "Off by" the draft saw with a typed balance; resets when the date changes; hidden while
  it equals the live figure. Quiet hint type, not a tile, not a bar.
- **"+ Add entry" always there** (ask 3 = A) once a date is set and the day's figure has loaded. Outline button in the heading row (Save stays the one
  green button). Opens `AddEntryWindow` blank (Money set to follow the gap, Date from the check date, amount empty), the account's own club book else its first,
  as the gap door already chooses. Nothing in bank code writes a book line. After Add, the page notice (not a toast), the day's figure re-reads, and the
  typed balance, date and marks stay. The gap door is kept and renamed **"Add the missing entry"**.
- **Resting sentence** while a draft exists: "Kept in this browser only, until you save this check." (§4b). Under the date and balance row on a desk,
  under Save with the other notes on a phone.
- **Fresh figure:** re-read on window focus and when the tab becomes visible, debounced with the date read that is already there. No polling.
- **Phone** (ask 6 = A): the words "+ Add entry", full word, 44px, in the heading row; Save stays last and full width. Check at 1440 / 390 / 361.
- **Save is the finish line, unchanged.** Save while off still works. Nothing about the sum, Matches/Off by, Find's hints or the printed report changes.

## Boundaries

- **Club card only.** The coach card (`CoachBankCheck`) is WD2. Words that live in `lib/bank-tab-words.ts` are shared by both portals: add the new
  club strings without changing what the coach card shows. Do not rename the coach's "Add the missing line" link here (it becomes "Record the missing amount" in WD2).
- **No per-line ticking, no shared drafts, no server draft.** Out of scope on purpose (plan §3.4).
- **Draft code never calls a bank route.** The one writer of a book line stays the Ledger's own add route.
- The draft helper (read, write, expire, validate marks) is a new shared abstraction because WD2 reuses it: keep it pure, small and in `lib/`, with the
  storage access injected so it is testable. Do not build the coach wiring yet.

## Tests and checks

- Unit tests for the pure helpers: write only when worth keeping, key isolation per club/account/person, 14-day expiry, restore, marks validated against what the books offer,
  Start over, started-at resets on a new date, storage throwing.
- A guard test that the draft code touches only browser storage and never a bank route (the existing bank guard tests, e.g. `tests/unit/bank-r2c-screens-guard.test.ts`, show the house shape).
- New sentences go in the words file; run `npm run check:spelling` and the focused verification (`npm run verify:changed`), then `npm run typecheck`
  because the words file is shared. Report anything skipped.
- Dev server: new files were added, so restart per AGENTS.md before handing off. The owner does the browser walk. Offer a short walk: type a balance, leave to the Ledger, book a line, return, watch "Off by" fall to Matches, Save.

## Finish

`/design` on the built desk and phone frames against the drawings, then offer `/simplify` (the helper is new) and `/review`. Help articles, `/docs` and the
owner walks are WD3. Update the plan's status and the TODO.md line. **Do not commit without the owner's yes; stage explicit pathspecs only.**

> WD1 committed `2a64a87d8` 2026-11-07 (after /simplify and /review; record in the plan §7).
