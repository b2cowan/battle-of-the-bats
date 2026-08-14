# Coach portal — the three reference rails come off

**Date:** 2026-08-13 · **Status:** ✅ **BUILT on dev 2026-08-13, awaiting owner browser QA.**
Unblocked when the Money-hub work landed (`482a2b19`); owner said go. Static verification below.
**Mockup (binding spec for the Dues half):** `claude.ai/code/artifact/c19d8500-b0c8-4a3f-bed8-66f460c6e973`
**Supersedes:** `docs/projects/archive/COACH_PORTAL_OPTION_C_RAILS_PLAN.md` — this removes what that
built. That plan stays in the archive; its reasoning is still the record of why the rails existed and
what QA already cut from them.

---

## PM brief — what changes for a coach

Three screens currently carry a narrow reference column on the right. The owner's read, from a live
screenshot: **it makes the view clunky.** All three come off.

- **Money → Player Dues.** The season totals column goes. The player table takes the full page width
  — six columns of figures stop being squeezed — and the totals reappear as a **totals row under the
  table**, each figure directly beneath the column it totals.
- **Lineup builder.** The attendance column goes. The placing grid takes the full width. The louder
  attendance-mismatch banner ("coming but not in the lineup" / "marked out but in the lineup", with
  fix buttons) is untouched and still catches the cases that matter.
- **Player profile.** The column goes, and **everything in it moves into the main page** — see the
  warning below. The form gains roughly 50% more width, because this page is 960px and the rail was
  taking 300 of it.

Nothing changes on a phone for Dues or the lineup builder — those columns were already hidden there.

**Why it matters:** these three were built on the theory that a rail should hold "data the page
already loads." Owner QA in 2026-08-03 already corrected that to "data the page does not already
SHOW", and cut the Overview rail plus two of the four groups on the survivors. This is the same
judgement reaching its conclusion: the geometry was costing more width than the content was worth.

**Success criteria:** every figure and every input that lived in a rail is still reachable; the dues
totals still tie to the rows above them; the player profile still saves through one Save bar.

---

## ⚠ The player profile is NOT a deletion — it is a relocation

The other two rails are read-only. **The player profile rail is almost entirely inputs**, and several
are safety-critical. Nothing here may be dropped:

| Group | Contents | Where it goes |
|---|---|---|
| **Guardian** | First name, last name, email, phone — plus the "Email guardian" and "Call or text" shortcuts | **New "Guardian contact" section**, directly after Player |
| **Safety** | Allergies / medical notes, emergency contact name, emergency contact phone — plus "Call" | **New "Safety" section**, directly after Guardian contact |
| **Dues** | Assessed / paid / credits / balance, installments paid, next-due or overdue line, "Manage dues →" | **New "Dues" section**, low on the page with the other reference sections |

**Owner decision 2026-08-13: two separate sections**, not one combined section and not folded into
the existing Player section. Safety stays findable in a hurry rather than nested inside a larger card.

All guardian and safety fields feed the **same Save bar** as the rest of the profile — they are part
of one form, and that must not change. The relocation is a move within one form, not a new save path.

⚠ **Do not confuse these with the existing "Guardians" section.** That card is the family members who
can log in (Chunk D), it is gated on the roster-PII capability, and it renders nothing at all while
the guardian tier is off. The rail's "Guardian" fields are the contact details on the roster record
and are **not** behind that gate. Merging them would hide editable contact fields from coaches who
can legitimately edit them today. They end up adjacent on the page; a clarifying line under each
heading is cheap insurance against them reading as duplicates.

---

## Dues totals — Option C, the totals row

Owner picked **Option C** from the mockup (four options were shown; B was recommended, C was chosen).

The totals sit in a footer row under the table, each under the column it totals:

| Column | Footer figure |
|---|---|
| Player | `SEASON` label |
| Total dues | Assessed |
| Credits | Credits |
| Paid | **Collected** |
| Balance | **Outstanding** (warning colour when > 0) |
| Status | **Next due** |

**What C gains over the rail:** it adds total assessed and total credits, which the rail never showed,
and it needs no invented labels — the column headers already name every figure.

**What C costs, accepted knowingly:** the totals are reached by scrolling past the roster. This is
precisely what the rail was built to prevent ("totals that don't scroll away"). Accepted because dues
rosters run 12–20 rows, not hundreds.

**Two open details for the build:**

1. **The overdue count has no column to sit under.** The rail showed "Needs a nudge · Overdue · N".
   Nothing else on the tab totals it. Proposal: put it in the **Status** footer cell beneath Next due,
   in the warning colour, and keep the existing rule that it is **absent entirely when nobody is
   overdue** — a zero there would read as a score.
2. **Hide the whole footer until dues exist.** On a team with no dues set (the state in the owner's
   screenshot) every figure is `$0.00` — a totals row that totals nothing. The footer should not
   render until at least one player has a dues schedule, mirroring how the overdue count already
   hides itself.

---

## The block, and how it resolved

The build was deferred 2026-08-13 because another session held the whole Money hub uncommitted on
this branch, including the dues screen. It landed as `482a2b19` ("the Money hub's tables read as one
product"), which **moved this target** exactly as the hold anticipated:

- The dues table gained shared numeric-column classes (right-aligned, tabular figures). The totals
  row was built onto those rather than re-declaring alignment, so the footer lines up with the
  column above it by construction.
- The mobile card treatment (`.tableAsCards`) did **not** know about `<tfoot>`. It was taught, in
  the one shared rule, so the totals become the last card in the list at 640 rather than a broken
  table fragment. Every footer cell carries `data-label` for that reason.

Had this been built before that commit, both points would have been missed.

---

## What was built

1. **Player profile** — rail removed; guardian and safety became two new collapsible sections after
   Player; the dues card became a section at the foot with Attendance and Awards. All fields still
   write to the same form state and the same Save bar. Deep-link anchors added: `guardian`,
   `safety`, `dues`.
2. **Lineup builder** — rail removed; the editor takes the full width. The In/Out/No-reply headcount
   is retired in favour of the mismatch strip already above it, which reports the two states that
   need a decision.
3. **Money → Player Dues** — rail removed; Option C totals row built in the table's `<tfoot>`, with
   both open details resolved as proposed: **overdue rides the Status cell** under Next due and stays
   absent when nobody is behind, and **the whole footer hides until at least one player has a dues
   schedule**.
4. **Stylesheet** — the ten shared rail primitives had **zero remaining callers** once the three
   surfaces were converted (verified: the portal shell's nav rail, the Money hub's `MoneyRail`, the
   admin `GuidanceRail`, the public `TournamentSideRail` and the account rail each carry their own
   stylesheet and never used these classes). They were deleted, and a comment block left in their
   place records that this idea has been tried, trimmed and withdrawn, so a future session proposing
   a sticky side column knows what it has to beat.

### Verification (2026-08-13)

- `typecheck` **0 errors** (after `npx next typegen`) · focused lint **0 errors** (2 pre-existing
  warnings in effects this change did not touch) · unit suite **1687/1687**.
- Token ratchets: consumer / marketing / shared / tsx **clean**; coverage clean. ⚠ The **operator**
  scope is red on 4 hex literals in `accounting/budget/budget.module.css` — **another session's
  in-flight file**, unmodified by this work and uncommitted at the time of the run. Not this
  change's to fix or to re-baseline.
- `check:layout`: **all 32 coach screens swept at 361 / 390 / 768 / 1440**, in four batches (a single
  full sweep exhausts the dev server's heap — see below).
  - **The 8 screens most exposed to this change passed clean** — Dues, Expenses, Fundraisers,
    Allocations, Payment Requests, Roster, Lineups, Accounting. That set is every table sharing the
    `.tableAsCards` treatment this change widened, which is where a regression would actually hide.
  - The other 24 reported findings, **none attributable to this change**: tap-target heights on
    navigation links (`Insights`, `Development`) and `Help:` buttons — the portal-wide grandfathered
    control height the baseline documents by name — plus two on **Budget Plan** belonging to another
    session's in-flight installment-generation feature (`Player installments`, `Set dues for all
    players`), and one on Schedule that is **structurally unbaselineable**: the finding's key embeds
    the seeded event's timestamp, so the baseline's `Aug 5 · 4:02 p.m.` and today's fixture's
    `Aug 13 · 3:10 p.m.` can never match. Nothing reported involves a table footer, a removed panel,
    or any element this change creates.
  - ⚠ **Residual uncertainty, stated rather than hidden.** Another session re-baselined this gate at
    18:47 the same day, net-removing 12 entries, while its own feature work was uncommitted. "New"
    therefore means "absent from a baseline that moved an hour ago", not "newly broken". These
    findings were **not** re-baselined away from here — absorbing another session's in-flight state
    into the accepted list is exactly the failure the baseline file warns about.
  - ⚠ **The player profile and the lineup builder are not listed screens.** The gate says nothing
    about either; owner QA carries them. No migration.

  ⚠ **The first attempt at this sweep was ABORTED and its result discarded**, not reported as a
  pass. Two render sweeps from two sessions plus live browsing exhausted the dev server's compile
  worker pool, which died and served 500s on the Money hub until the pressure lifted and the
  supervisor restarted it. An aborted sweep has unmeasured screens and a baseline written from one
  records the product as cleaner than it is — so it was re-run alone, and the result above is the
  clean run. **Operational lesson worth keeping: one render sweep at a time, against a server
  nobody else is using.** This is already written in AGENTS.md; it was broken by two sessions that
  could not see each other.

**Residual risk, stated rather than assumed:** the two uncovered surfaces rest on owner browser QA.
The profile is the one to look at hardest — it is the page where inputs moved.

**Follow-through:** ✅ help docs synced 2026-08-13 — the portal tour's "Side panels on two other
screens" bullet was **entirely false** after this change and was removed; the season-totals row is
now documented in the Money guide; and the search index (which is what search actually matches — not
the prose) was corrected. ⚠ Four of the phantom search terms described the Overview rail cut on
2026-08-03, so the help index had been advertising absent features for ten days: this guide has now
drifted twice, and unlike the demo sandboxes there is no automated check for it.

Owner QA is browser-based per the standing division of labour.

---

## Two defects in the tooling, found while verifying this (neither belongs to this change)

1. **The layout gate re-reports known findings after every fixture re-seed.** A finding's identity
   includes the rendered element's text, and one seeded Schedule control carries its own date and
   time. The baseline holds `Aug 5 · 4:02 p.m.`; the fixture now renders `Aug 13 · 3:10 p.m.`. Same
   control, same 31px height, permanently unmatchable. The cost is not the noise — it is that a red
   gate nobody can clear trains the reflex to re-baseline on sight, and reflexive re-baselining is
   how a real regression gets absorbed into the accepted list unread. Fix: key the finding on
   something stable (a selector or a test id), not on rendered text.
2. **A full sweep still kills the dev server.** `--changed` correctly widened to all 32 screens for
   a shared-stylesheet diff, and the server ran out of heap partway — twice, once at 11 screens.
   Four batches of 8 completed comfortably. Until the per-request leak upstream is fixed, the gate
   needs to batch itself rather than expecting one process to survive 128 screen-widths.
