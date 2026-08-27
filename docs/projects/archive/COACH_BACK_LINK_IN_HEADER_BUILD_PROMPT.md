# Build prompt — the way back moves into the header, portal-wide

**Written 2026-08-26, the day the owner approved the pilot on the real screen. Open this in a FRESH
session.** The pilot is built and committed-pending on `dev`; this phase spreads it. The gate in §1
still has to be run before any code.

**Read first:**
1. `memory/design_decisions.md` **2026-08-11** — the page-header ruling. It put the back link on its
   own row and retired breadcrumbs. **This phase amends ONE clause of it**; everything else stands.
2. `docs/projects/active/COACH_HEADER_ACTIONS_CONSISTENCY_PLAN.md` **§10** — the pilot's own log
   entry, written the day it shipped, with the terms it was approved under.
3. `components/coaches/CoachPageHeader.tsx` — the `backTo` prop's docblock. It is the spec.
4. Owner QA **§104 Part A3** — the pilot as it was walked.

---

## 1 · HOW THIS BEGINS — BLOCKING, NO CODE BEFORE IT

Present in the conversation and WAIT for the owner's go:

1. A **PM-voice summary** of what a coach sees differently, per screen family.
2. The **verified inventory** — re-counted from the tree, not copied from §3 below. This repo's
   plans have been wrong before and this one claims no exemption. ⚠ The owner's own recollection
   was "16"; the truth was 20 across 17 files. Expect §3 to be stale too.
3. **Anywhere the code forces a deviation** — raised, never quietly resolved.

⚠ **No mockup is needed.** The model is approved and shipped; this is a spread, not a design.

---

## 2 · WHAT WAS APPROVED, AND THE ARGUMENT FOR IT

The way back becomes an **arrow in the page header's leading corner** — `← Payables` on desktop, the
bare arrow on a phone — instead of a blue link on its own row above the header.

**The argument came from the 2026-08-11 ruling itself.** That pass decided the help **"?"** is
*chrome, not an action*, anchoring the top-**right** corner **on every page at every width**, so
help has *"one findable home portal-wide"*. A way **up** is the same kind of thing at the opposite
corner. It is **not a breadcrumb** (no trail; the retired `.breadcrumb` mechanism stays retired) and
**not an action** (it sits outside `pageHeaderActions`, behind a hairline).

**What it buys:** a whole row back — roughly **40px desktop / 52px phone** — on every drill-in.

**The clause being amended**, and only this one: *"the header carries the page's name and its
actions, and a way back is neither."*

---

## 3 · THE INVENTORY — verified 2026-08-26, RE-VERIFY IT

**20 call sites across 17 files.** ⚠ Not 16, and not one per file — **three files carry two each**
(`development/board`, `history/development/practices/[eventId]`, `history/opponents/[opponentKey]`).

### ⚠⚠ TWO SHAPES, AND ONLY ONE OF THEM HAS BEEN PROVEN

This is the single most important thing in this prompt.

- **Nested headers — Money hub sub-views** (`accounting/*`): 5 sites. **The pilot was one of these.**
  The header sits under the hub's own, carries no "?", and renders an `<h2>`.
- **Standard headers — the drill-in is its own page**: 15 sites (`development/*`, `history/*`,
  `lineups/*`, `practice/[eventId]`, `roster/[playerId]`). **The arrow has never been rendered on
  one of these.** A standard header has an `<h1>`, an actions group, and — inside the team layout —
  publishes its "?" to the masthead. The leading corner should be free, but **prove it at 390px**,
  where the title row is `title · symbol · ?` and the arrow is a fourth thing competing for it.

### The odd one out — decide it separately

`accounting/expenses/panel.tsx` carries **"Back to Money"**, which is not a drill-in affordance at
all: it only renders on the legacy standalone route (`!embedded`), and every legacy money route now
permanently redirects into the hub. **Establish whether that path is reachable at all before
converting it** — it may be dead code to delete rather than markup to migrate.

### ⚠ EXEMPT — do not touch

`.gdBack` (the game bench console) and `.ppRunBackLink` (practice run mode, including
`_PracticeStationView`). These are field surfaces with their own chrome and are **listed exempt in
the 2026-08-11 ruling itself**. They are not `CoachBackLink` and must not become `backTo`.

---

## 4 · WHAT ELSE HAS TO MOVE WITH IT

- **The pilot's one-site restriction must be lifted, in both places that state it.**
  `KNOWN_PROPS` in `tests/unit/coach-page-actions-guard.test.ts` and the `backTo` docblock both say
  **one call site only, every other drill-in still wears `CoachBackLink`**. Leaving those in place
  while shipping twenty would make the guard's own warning a lie — which is the exact failure mode
  this repo keeps recording. Replace, do not delete: state that the arrow is now the portal's one
  back treatment.
- **`CoachBackLink` goes only when the last call site does.** Until then it is the treatment for
  anything unconverted. If it reaches zero, delete the component **and** `.lineupBackLink`, each with
  a headstone naming this ruling — the same discipline the retired required-asterisk marker got.
- **The layout baseline should SHRINK.** The old link carried a phone tap-floor entry on roughly
  twenty screens (`CoachBackLink`'s own docblock records this). When the row goes, those entries go
  stale — run `npm run check:layout -- --prune` and **report the count that dropped**. A migration
  that removes a control should visibly remove its debt; if the count does not move, something did
  not actually change.
- **Any header whose actions change** needs its `SITES` row updated in the page-actions guard.

---

## 5 · TRAPS, ALL PAID FOR ALREADY

- ⚠⚠ **THE TAP FLOOR COMES FROM THE SURFACE A CONTROL SITS ON.** A new header slot inherits nothing
  from `.pageHeaderActions`. The pilot's rule sets `min-height`/`min-width` at ≤640 for exactly this
  reason; an export relocated without it once landed at 30px. Verify at 390, do not assume.
- **The label disappears on a phone, the destination must not.** House rule 3 turns words into
  symbols; the `aria-label` carries "Back to X" at every width. Do not let a bare arrow become an
  unlabelled control.
- **Ink is `--text-secondary`, not the link blue.** On its own row the blue said "this is a link";
  inside a header, beside the record's NAME, it would be the loudest thing in the row.
- **Do not reinstate a breadcrumb.** One arrow, one destination word, one level up.
- **`check:layout` cannot open a modal**, but every one of these is a page or a sub-view, so the
  sweep CAN see all of them. There is no excuse for an unswept screen here.
- **Concurrent sessions on `dev`.** Explicit pathspecs on every commit; `git show --stat HEAD`
  afterwards. Several of these files have been actively edited this week.

---

## 6 · EVERY PHASE CARRIES THESE

Typecheck · focused lint · unit tests (**the page-actions guard is the one that matters**) ·
`check:layout` on **every affected screen** at 361/390/768/1440 — not a sample · `check:layout
--prune` with the dropped count reported · `check:demos` · **help docs re-read** (any guide that
describes "the back link" by appearance) · **both demo sandboxes re-read** — the guided tours
describe navigation, and this changes what a coach sees · a new **Owner QA ledger section** ·
TODO + the header-actions plan §10 updated in the same unit of work.

---

## 7 · WHAT THIS MUST NOT DO

- **No breadcrumbs**, no second level, no trail.
- **No new back treatment.** If a surface cannot take the arrow, it keeps `CoachBackLink` and the
  reason is written down — it does not get a third thing invented for it.
- **Do not touch the exempt field surfaces.**
- **Do not "finish the job" on the Money hub's own header** — the arrow is for drill-ins, not for a
  hub that is already the top of its own section.
- **No unrelated header tidying.** This is one change, twenty times.

---

## ✅ EXECUTED 2026-08-26 — and what this prompt got wrong

Built on `dev`, no migration. Full record: `COACH_HEADER_ACTIONS_CONSISTENCY_PLAN.md` §10 (final
entry). Design ruling: `memory/design_decisions.md` 2026-08-26. Owner QA: **§113**.

**§1's blocking gate was the most valuable thing in this document**, and it earned its keep four
times over. The inventory below is the verified one; **§3 above is preserved unedited as the
counter-example** — a plan re-stating its own earlier count as fact, which is the failure this
repo keeps recording.

| §3 claimed | The tree said |
|---|---|
| 20 call sites, 17 files | **22 renders, 19 files** — two were **hand-written** copies of the retired style (Budget Plan, Budget vs. Actual). The 2026-08-11 component sweep missed them *because they never imported the component*. |
| 5 nested Money sub-views | **1** live one. The other four were dead. |
| One "odd one out" to check for reachability | **Six** unreachable `!embedded` branches — every legacy money route permanently redirects, and one folder has no route file at all. **Deleted, not migrated.** |
| §5: "every one of these is a page … the sweep CAN see all of them" | **Six of the twelve had no `check:layout` entry at all**, and **three had no fixture row to open.** Now listed and seeded. |
| §4: the layout baseline should shrink by ~20 | **It was already zero.** The shared `.lineupBackLink` ≤640 rule cleared those entries in August. §4's *"if the count does not move, something did not change"* test would have raised a false alarm. |

**Ruled at the gate, owner approved:** three surfaces keep `CoachBackLink` because they render **no
page header for an arrow to sit in** — the team board's and opponent detail's failed-load branches,
and the awards certificate print bar. The list is now **build-enforced**, replacing the pilot's
one-site comment, which nothing had ever checked.

**One screen needed more than a prop:** the finished-season practice plan's link sat *above* its
loading/error fork. Its header is hoisted so a still-loading or failed plan keeps a way out.

**A seventh back-link treatment** (`.recordBackLink`, the free tournament record) was found, left
alone, and written into the exempt list.
