# Hosted-event filing shelf — the event's own words, shown only where they belong

**Status:** BUILT ON DEV 2026-10-21 after the owner walked the mockup (https://claude.ai/artifact/VeA9bKNN2Ndt1YKdRaovhF) and said go; the owner's three calls were taken as the plan's recommended answers (§6). Migration 344 applied to DEV only; the existing dev event was filled in by hand (8 words added, second run 0). Committed 0bd1c2e1e 2026-10-21 after /simplify and /review (the review hardened the migration: the fill-in now names one club at a time, the word-adding function refuses a category the club does not own, the settings item always counts as Entry fees; the Budget planner folds every event shelf; Enter and "already exists" read what the list shows). PRODUCTION: migration 344 and the fill-in wait for the owner's explicit go at promote. Origin: the owner's screenshot of the club's
*Add an entry* window (UAT Rep Club — General), asking why the hosted tournament's shelf holds only
*Entry fees* while Gate / admission, Concession revenue and Registration revenue sit on the generic
*Tournaments* shelf. Part of the Club release (Club Tier Stage 7a follow-up). PM brief:
`HOSTED_EVENT_FILING_SHELF_PM_BRIEF.md`.

## 1. What the code does today (read 2026-10-21)

- A hosted tournament gets ONE private category, `Hosted tournament · <name>`, holding ONE item,
  *Entry fees* (money in). Created by `club_tournament_fee_word` (mig 342 L58-83), `scope='org'`,
  `is_default=false`; the link lives in `tournament_fee_book_settings`. It exists so registration
  payments file themselves with no one choosing a word.
- Gate, concession, sponsorship and the event's costs are filed by hand. The only words offered are the
  generic *Tournaments* shelf (Concession revenue, Gate / admission, Registration revenue) and the rest
  of the library — none of them belong to the event.
- **By activity groups by budget category and nothing else** (`lib/club-budget-report.ts`,
  `lib/coach-budget-rollup.ts` ActivityBlock). A line counts toward the tournament only if it is filed
  under the tournament's category. So gate money filed on the generic shelf does NOT reach the event's
  profit — the owner's screenshot is a real gap, not a cosmetic one.
- The Add entry window is handed `book: {id, name, kind}` (`LedgerWindows.tsx` L59) — **no tournament
  id**. The book→tournament link is `accounting_ledgers.entity_type='tournament'` + `entity_id`.
- Ruled and built (Stage 7 Ask 3, option A): the tournament is one category holding its revenue and its
  costs; By activity is the coach's report shape, unchanged; "by book" was rejected. Category name
  carries the event so it cannot be confused with the club's own *Tournaments* expense category (S7-02).

## 2. What this plan is NOT (and why)

**Not a flat list plus a "Which tournament?" tag.** Examined and rejected: a ledger line has no
event/tournament column; By activity has no tag dimension; the coach and club reports share one shape,
so a tag means rebuilding both portals' report and guards; and it reverses Ask 3. A tag solves the
list-length worry but costs far more than the worry is worth. Revisit only if the owner re-rules Ask 3.

**Not copying every word onto every event and showing them all.** Five events × ~5 words = ~25 extra
rows with repeated names ("gate" matching six rows). The words must exist per event (the report needs
them) — the answer is to *show* only the relevant shelf.

## 3. Proposal

### 3.1 Each hosted event's shelf carries the words an event needs
Entry fees (exists) plus, money in: **Gate / admission, Concession revenue, Registration revenue,
Sponsorship**; money out: the event's usual costs (**Permits & fields, Officials, Awards, Supplies** —
final list to be taken from the standard *Tournaments* shelf and the coach event words; owner confirms).
Created with the shelf (in `club_tournament_fee_word`), so a new event is complete from its first payment.

### 3.2 The picker shows only the relevant event shelf
- **Inside a tournament's own book:** that event's shelf only, listed first. The generic *Tournaments*
  shelf is hidden *for money in*; for money out it stays (fees to enter other tournaments).
- **Inside the club's general book:** event shelves only for events whose dates fall in the fiscal year
  being entered, **collapsed** (one heading row each) until the treasurer types or opens one.
- **Typing searches everything visible**, as today. A line already filed under a hidden shelf still
  shows its own word (the picker's standing rule: a saved record's word never drops out).
- Coaches are unaffected: org-scope categories are already filtered out of the team picker
  (`budget-categories?scope=team`) — to be confirmed in verification (§5).

### 3.3 Existing events
A one-time backfill adds the §3.1 words to every existing hosted-event shelf. **Live-data change — runs
only on the owner's explicit go**, dev first, with a before/after count per event. Lines already filed
under the generic *Tournaments* words are NOT moved (a move is a money-record edit); the owner may ask
for a "re-file" tool later.

## 4. Work, in order

1. **Verify (read-only)** the three open points in §5. Report before building.
2. **Owner mockup session** — the picker with 1, 5 and 20 hosted events, in the tournament's book and the
   general book, desktop and phone (per the house rule: mockup → `/design` → owner yes before build).
3. **Migration** — new events get the full word set; backfill function for existing events (not run).
   Dictionary + both snapshots refreshed in the same unit of work.
4. **Picker** — an optional "event" hint to the word list (`BookRef` gains the tournament id, read from
   the book's `entity_id`); grouping/collapse rules in the club's Add / Edit entry windows only. The
   shared `BudgetItemPicker` stays domain-blind (its header forbids learning a domain) — the *caller*
   passes which shelf leads and which collapse.
5. **Guards** — extend `scripts/check-club-money-arithmetic.mjs` (event with gate + concession + cost →
   By activity net), `budget-item-references-guard`, and a picker test for the 1 / 5 / 20 event lists.
6. **Help** — By activity and Filed under articles (`/docs`). **Walk** — one owner QA walk (new ledger §).
7. **Backfill on dev**, owner walks, then the owner's go for prod at promote.

## 5. Open points to verify before the mockup

1. Do any other readers of the budget-category list (coach picker, org word list, merge/remove tools)
   show or mishandle the new per-event words? (By scope filter they should not reach coaches.)
2. Can the picker lead with / collapse shelves without breaking its keyboard order and counts? (Its
   option indices are computed from lead group + items + create row.)
3. Delete/merge guards: a word on a hosted shelf is referenced by the settings table (NO ACTION FK on the
   one item) — confirm the added items follow the ordinary reference rules and cannot be merged away
   under a live event.

## 6. Decisions the owner owes

- The exact word list for an event (§3.1) — especially the money-out words.
- Whether the general book shows event shelves at all (§3.2), or only the tournament's own book does and
  general-book entries for an event are made from the tournament's book.
- Backfill: all events, or only events from this fiscal year on.

## 7. Risks

- Per-event words multiply `budget_items` rows (≈ 8 per event). Harmless to the report; the picker's
  filtering is what keeps the list short — so the filtering is the feature, not a nicety.
- A treasurer who files gate money on the generic shelf by habit still under-reports the event. Showing
  the event shelf first in the event's own book is the whole mitigation; the picker never *forces* it.
- Any change here touches money records' vocabulary — dev first, walk before prod, no prod backfill
  without the owner's explicit go.
