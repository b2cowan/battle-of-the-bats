# Kickoff prompt — More than once: a player hands in to a drive as many times as it takes

*(paste into a fresh chat)*

**Build the whole of `COACH_FUNDRAISER_MORE_THAN_ONCE_PLAN.md`, and only that.** The design was
raised by the owner on the §157 walk (2026-09-10), drawn as a mockup, and **agreed on the mockup the
same day, carrying its three recommendations** (§7 below). Carry it verbatim; do not re-litigate the
model.

---

## Read first, in this order

1. **The binding mockup:** https://claude.ai/code/artifact/94c27428-bedf-401f-afba-ce734f5a8c14 —
   four exhibits, before/after on the drive board and on the Record door. **The proposed board is the
   spec.** Where this prompt and the mockup disagree, the mockup wins.
2. **`COACH_FUNDRAISER_MORE_THAN_ONCE_PLAN.md`** — §1 (why the asymmetry exists, argued from the
   code), §3 (the rules table), §4 (the trade), §5.1 (**what must not change**).
3. **`COACH_FUNDRAISING_ONE_WAY_IN_PLAN.md`** — the release this sits on (`1b06f9e7`, migration 285).
   Its whole-team entry is the thing whose grammar you are extending to players.

---

## ⚠ Verify before building — the working copy is shared and it is DIRTY

- ⚠⚠ **THE TREE HAS ~113 UNCOMMITTED FILES** from at least two other chunks of work (the Categories &
  Items door, owner QA §163 owed; plus mid-walk fixes to the fundraising panels). **Several of them
  are files you will touch** — `fundraisers/panel.tsx`, `fundraisers/DriveRoom.tsx`,
  `accounting/expenses/panel.tsx`. Establish what is already modified **before** you edit anything,
  and never assume a diff in those files is yours.
- **Stage explicit pathspecs, always run `git diff --cached --stat` before committing**, and treat any
  file with a surprising line count as somebody else's. ⚠ Bracket directories (`[teamId]`,
  `[orgSlug]`) need `:(literal)` pathspecs or they stage **nothing**.
- ⚠ **`npm run verify:changed` is ALREADY FAILING** on the token-debt ratchet — two hardcoded colours
  in the coaches stylesheet, from the Categories & Items work. **Not yours. Do not fix it**, and do
  not read a red gate as evidence about your own change until you have confirmed which file it names.
- ⚠ **`ls supabase/migrations | tail` before naming yours.** The tail is **286**
  (`one_word_one_line_on_a_plan`) which is **dev-only and prod-owed**; yours is 287 unless another
  session got there first.
- ⚠ **THE §157 WALK IS IN PROGRESS ON THE UAT FIXTURE** — the owner is partway through it, on the
  Chocolate sale, with test entries being added and removed as they go. **Do not reseed or clean that
  team**, and expect its figures to move under you.

---

## What this builds

**A row on the drive's board becomes a PARTICIPANT — a player, or the whole team — carrying their
TOTAL for the drive**, folding open to each individual entry with its own date, amount and credit.
And **every player returns to the "Who raised it" list**, permanently.

### ⚖ The load-bearing constraint, and the thing to get right

**A participant with ONE entry must render byte-for-byte as it does today.** Date inline, Edit and
Remove on the row, no chevron, no fold. A drive where nobody handed in twice must be visually
identical to the drive that exists now. If you find yourself changing the single-entry row, you have
taken a wrong turn — go back to the mockup.

### The rules

Plan §3 carries the full table. The ones most likely to be got wrong:

- **Received**, on a folded row, is the **most recent** entry's date.
- **Edit and Remove live on the entry**, not the summary row. A one-entry row keeps them exactly
  where they are today, because there is no ambiguity about which entry it means.
- **Credit**: each entry keeps the share it was stamped with; the row **sums** them. Do **not**
  re-multiply a summed amount by the drive's current share — that is precisely the trap the
  whole-team entry's 0% stamp exists to avoid (owner ruling 2026-09-08).
- **`N of M players logged` counts DISTINCT PLAYERS** and does not change. `plus N team entries` keeps
  counting entries.
- **Removing the last entry** removes the participant from the board.

### ⚖ The three rulings, as agreed on the mockup 2026-09-10

1. **The product's word stays `entry`.** The mockup's prose says "hand-in" for readability; **it never
   ships**. Screens, confirms, help and demo narration all keep saying *entry*. ⚠ `npm run
   check:spelling` is a gate, and the one-word rule in `CLAUDE.md` is why this matters.
2. **The accidental double is answered by the CONSEQUENCE SENTENCE, not a refusal.** The form's
   existing consequence line gains one clause — *"…and Avery Test's total for this drive becomes
   $576.00"* — shown **only when that player already has an entry**. No confirm, no block.
3. **The whole team folds the same way**, so the board has one grammar.

---

## Where the work lands (plan §5)

1. **Migration 287** — lift the one-entry-per-player uniqueness. Existing rows are already valid under
   the looser rule: **no backfill, nothing to convert.** ⚠ `rep_fundraiser_entries` is in
   `BUDGET_ITEM_REFERENCES`; you are not touching its budget-item link, leave that guard alone.
   ⚠ Update `DATA_DICTIONARY.md` and refresh snapshots in the **same unit of work** —
   `npm run check:dictionary` is a gate.
2. **The entries POST** stops refusing a second entry for a player. **The PATCH is unchanged.**
3. **The board** groups by participant, sums, folds — the bulk of it, and the phone card list too.
4. **The Record door** drops the exclusion, its "N players already have an amount logged" hint and its
   every-player-logged empty state; the consequence sentence gains its clause.
5. **Help + demo.** The fundraising help article and the coach sandbox's drive narration both describe
   logging money to a drive. ⚠ **Re-read them properly** — `CLAUDE.md` records that this exact surface
   has gone stale across three consecutive releases, and `check:demos` can prove breakage but cannot
   tell you the demo is missing something the product gained.

### ⚠ What must NOT change (plan §5.1)

- **Any figure, on any screen, for any drive that exists today.** Prove it, don't assume it.
- The meaning of the `N of M players logged` fraction.
- The whole-team entry's 0% stamp.
- The credit's application path.

---

## Verification before hand-off

- Unit: participant grouping (sums, ordering, most-recent date, the **no-fold single case**), the
  fraction with multi-entry players, credit summing across differing stamped shares.
- Shapes to build a fixture for: one player × 3 entries; two players × 1; the team × 2; a player whose
  last entry is removed; a drive whose share changed between one player's two entries.
- `npm run typecheck` (shared modules and a route change), `npm test`, `npm run verify:changed`
  — remembering the token ratchet is red before you start and is not yours.
- ⚠ **Run any UAT spec you rely on rather than trusting that it runs.** `coach-sponsor-money-lifecycle`
  has had 3 of 17 failing since 2026-09-04 against a block that was deleted, and it went unnoticed
  through two releases.
- Restart the dev server before hand-off — this adds files and changes shared modules.

## After the build

Offer `/simplify` first (this adds a grouping abstraction over an existing board), then `/review`,
then `/docs`. Then write the owner QA walk as a checkable artifact and add it to the run order.
