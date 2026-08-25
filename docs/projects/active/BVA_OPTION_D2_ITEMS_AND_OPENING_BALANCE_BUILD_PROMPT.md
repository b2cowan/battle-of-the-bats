# Prompt — D-2: every figure opens, and a season can carry money forward

**Written 2026-08-24, at the owner's direction, with every ruling taken. Open this in a fresh
session.** D-1 (the two bands, the totals, the Net row, the four lenses) is BUILT ON DEV and its
walk is **owner QA §85**. This prompt is the second and final half of Option D.

✅ **THE GATE IS CLEARED — §85 PASSED 2026-08-24.** The owner walked D-1 live and ruled seven chrome
corrections in flight (two-ground rows, the hairline across the pinned seam, the label column that
could not wrap, the current-month marker, the inverted row hierarchy, band gutters, and the
lens-naming rule); all were fixed, re-measured and are committed. **The bands you are building on
top of are signed off.** Start when told.

⚠ Re-verify every code claim against the tree — this repo's plans have been wrong before, and this
one is a day old. You share `dev` and one working copy with concurrent sessions (AGENCY_RULES
concurrent-work safety: explicit pathspecs, re-check the branch, expect foreign hunks in
TODO/ledger/help files). **A money-centralization P2 session was mid-flight on 2026-08-24** and owns
the Player Dues panel and the money hub header — coordinate, don't collide.

**Read first, in order:**
1. `docs/projects/active/BVA_MONTHLY_INCOME_PLAN.md` §2 and §2.1 — the whole project record and
   what D-1 actually shipped, including its five build decisions and the guard rebuild.
2. **The mockups ARE the spec, and every ruling in them is taken:**
   - `claude.ai/code/artifact/da5d08b9-b81e-4848-a758-35a83923a98a` — **what opens behind every
     figure** (this build's main deliverable). Drawn in the DARK portal, which is the theme the
     owner works in.
   - `claude.ai/code/artifact/4a61dfc0-d6ee-49e3-80a7-70032a0f24b2` — the original Option D panel,
     which holds the **opening-balance workflow**: the Start-next-season carry step and the Team
     settings row, both walked and accepted.
3. `memory/design_decisions.md` — the **2026-08-24** entries are binding: the one-rule drill-in
   model, the lens-naming rule, the pinned-column/table-chrome rules, the row hierarchy, and the
   Statement’s cash bridge.
4. `lib/coach-cash-strip.ts` and `lib/coach-budget-months.ts` — D-1's arithmetic. Their headers
   carry the register contract and the band rules. **Extend, never fork.**
5. `scripts/check-money-report-arithmetic.mjs` — the build-blocking guard as D-1 left it. Its header
   explains what it proves and what it deliberately does not. §3 below extends it.
6. `app/api/coaches/[orgSlug]/teams/[teamId]/register/route.ts` — the cash contract, and the surface
   the opening balance must reach in the same unit of work.
7. **The Statement’s cash bridge** (owner QA §98, built 2026-08-24) — it explains the Statement→Months
   gap from `cashStrip.excluded`. ⚠ **The opening balance does NOT belong in it.** The bridge
   reconciles two ways of counting ONE season’s spending; money carried in from LAST season is not
   part of that and would make a correct reconciliation stop balancing.

---

## §1 · Part A — every revenue figure opens (no migration)

**The one rule, from the drawings — nine rows behave the same way:**
1. **The chevron opens where the money came from** — the actual families, drives, sponsors and
   requests. Never budget items.
2. **The number opens what makes it up** — individual records, dated, **read-only always**. The grid
   reaches the forms; it never becomes a second editor. No Record-a-payment button in these panels.
3. **At most TWO doors per panel: the ledger, and the thing itself.** ⚠ Some rows earn only ONE —
   a typed arrival and a recorded refund have no "thing itself"; the record IS the thing.

| Row (lens) | Item rows | Panel contents | Doors |
|---|---|---|---|
| Player dues (Actual) | per family | each payment: date, amount, method | Player Dues · Transactions |
| Fundraising (Actual) | per drive | each entry: who raised it, gross, **rebate as a NOTE not a figure** | this drive · Transactions |
| Sponsorships (Actual) | per sponsor | the arrival: date received, amount | this sponsor · Transactions |
| Other income (Actual) | per item filed under | each record: date, description | Transactions |
| Money back (Actual) | two rows: *Money back you recorded* · *Repaid by the club* | each one, **naming WHAT IT REPAID** | Transactions (+ Club on the club row) |
| Player dues (Scheduled) | per family still owing | instalment #, due date, **remainder not face value** | Player Dues |
| Sponsorships (Scheduled) | per pledged sponsor | amount promised, when recorded | Sponsors |
| Asked of the club (Scheduled) | per pending request | description, amount, date asked | Club |
| Paid back to families (Actual) | **per family** | each payout, with its REASON on the meta line | Player Dues · Transactions |

- **Elide nothing.** Every family renders; the drawings' "…nine more families" was drawing economy.
- **Family names are gated exactly as the Player Dues tab is** (`canViewMoney`) — no wider.
- **A pledge/pending panel totals to "Possible", never "Total".** One word; it is the thing that
  stops a coach banking money nobody has agreed to.
- **"Paid back to families" was never in the original spec.** It is in scope now by owner call
  (2026-08-24): by family, mirroring dues, with the *why* on each payment's own meta line rather
  than as a second grouping level.
- ⚠ **Revenue cells are not clickable today.** D-1 deliberately made them inert so nothing looked
  tappable that wasn't. Turning them on is this build's job — check none stay inert by accident.
- ⚠ **Phones: rows grow, columns don't.** Do not touch the phone-table reflow (separate sequenced
  session, TODO's phone-money-list item).

## §2 · Part B — the season opening balance (needs a migration)

Drawn in artifact `4a61dfc0`, workflow walked and accepted 2026-08-23.

- **Migration** on `rep_program_years`: one nullable numeric + a carried-from marker. **Check the
  next free number first** — concurrent sessions mint migrations. Schema change ⇒ DATA_DICTIONARY +
  `npm run refresh:snapshots` in the SAME unit of work.
- **Born at rollover.** A "Carry your money forward?" step in Start-next-season, after the existing
  warnings step: carry all (default, showing the register's own closing figure) · carry a different
  amount · start at $0. Unsettled money still WARNS, never blocks; the modal says settling up
  happens BEFORE rollover. The closing figure is computed **server-side from the register's own
  arithmetic** — never trust the client's displayed number. Written atomically with the rollover.
- **Corrected in Team settings → Money**, beside the dues settings: "Season opening balance" with a
  provenance line ("Carried from the &lt;season&gt; when this one was started"), a consequence
  sentence, money-write capability only. Serves mid-stream first seasons too.
- **Read in three places, all read-only:** the register's FIRST line (linking to the settings row),
  the Months summary block's first row, and inside Cash on hand. **Hidden everywhere when zero and
  never carried.**
- **A handoff, not a live link** — nothing reaches back after the carry; the settings row is the
  only correction path.
- ⚠⚠ **The matched pair moves together or the surfaces argue.** `money-summary`'s `onHand` and the
  register's balance accumulation must gain the same addend in the same change; `check:register`
  §§1–2 must fold it in.

## §3 · The guard extension

- `check:money-report`'s claim 6 currently reads **`const opening = 0`** with a comment naming
  itself as the thing to change when carry-forward ships. **Change it there.** Read the real field
  and delete the `?? 0` habit with it, so a missing field fails loudly instead of reading as zero.
  (A first draft read a payload field that never existed and silently defaulted — caught by
  `/review`, and the comment exists so it cannot happen twice.)
- Add a fixture-honesty gate for **a season that carries an opening balance**; without one, claim 6
  cannot fail and a green run is not evidence.
- The item rows must not break the existing band↔register identity: the sum of a group's item rows
  must equal the group, per month. Assert it.

## §4 · Traps (verified 2026-08-24)

1. **`qa-money-lab` → QA Money U13 reconciles to the drawings to the dollar** — revenue $8,141.69,
   expenses $5,279.00, net $2,862.69, and cash on hand agrees with the register. Use it as the first
   live check. Its $599/$61 family-paid costs, its $20 payout and its pending $450 club request are
   the exact edge shapes.
2. **The UAT money spec was rotten and is now repaired** — its whole "Money by month" block had been
   failing on NAVIGATION since the View/Showing controls became dropdowns. It runs 10/10 now. **One
   test in it still fails and is NOT yours**: it asserts a last-season column that an owner ruling
   removed on 2026-08-21. Deleting or repurposing it is an owner call.
3. **The dark theme is an ACCOUNT preference** (`fl_user_theme`), not a media query — warm is the
   platform default and every fresh browser renders warm. The owner works in dark. Verify visual
   work in BOTH, or you will verify the wrong one (this cost several rounds on 2026-08-24).
4. **Verify layout by measuring, not by looking.** Three visual diagnoses in the D-1 session were
   wrong until computed styles settled them. Render the page and read the values.
5. **Help + demos aftercare** (CLAUDE.md): the coaches help guide's Months section changes again
   (drill-ins, family names, opening balance); the coach demo tour narrates BvA at step 4 and the
   register at step 5 — re-read both, and `check:demos` must stay green.
6. **QA ledger — verify the next free number** (§98 was taken 2026-08-24 and sections are being minted fast by concurrent sessions), TODO line, plan + PM brief, `design_decisions`
   built-stamp.
7. **The bridge is now a build-blocking claim.** `check:money-report` proves spending + money back
   − family-paid + payouts = the Months cash total. Any change to what the cash arithmetic includes
   or excludes moves that identity — if it fails, the bridge on screen has stopped adding up, which
   is the one thing worse than not having one.
8. **2,452+ unit tests, typecheck, `verify:changed`** (schema-parity fails on pre-existing
   cross-session drift — not yours unless you migrated, in which case snapshots first).
9. **No commit without the owner's explicit OK.** Product-owner voice in every summary.
