# Coach portal — the three reference rails come off

**Date:** 2026-08-13 · **Status:** ⏸ **APPROVED, BUILD BLOCKED** — owner ratified the shape
2026-08-13 and explicitly deferred the build: *"don't build until the other money work from the
other chat is completed as there might be conflict."*
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

## ⚠ Why this is blocked, specifically

Another session has **uncommitted work across the entire Money hub on this same branch**, including
the dues screen this plan edits, plus four new files not yet committed. Editing the dues panel now
means two sessions writing the same file with no merge boundary between them.

**The blocking overlap is the Money hub only.** The player profile and the lineup builder are clean
in the working tree and share no file with that work except the portal stylesheet. If the owner wants
progress before the Money work lands, **those two can be built safely on their own** — the dues half
waits regardless.

**Before starting, re-check:** that the Money-hub files are committed, and that the dues screen's
layout has not been changed by that work in a way that moves this target.

---

## Build order (when unblocked)

1. **Player profile** — relocate guardian, safety and dues into three new sections; remove the rail
   geometry; confirm one Save bar still owns every field.
2. **Lineup builder** — remove the rail; grid takes full width.
3. **Money → Player Dues** — remove the rail; add the Option C totals row, with the two open details
   above resolved.
4. **Stylesheet** — the shared rail geometry is left in place: the player profile is not its only
   remaining consumer question to settle at build time. Check whether anything still uses it before
   deleting; a shared class with no callers is dead code, but removing one still in use is a
   regression on a surface nobody was looking at.

**Verification:** typecheck, focused lint, unit suite, the six token ratchets, and `check:layout`
(this touches three of the four surfaces that gate held clean when the rails shipped — a re-render at
361 / 390 / 768 / 1440 is the check that the columns collapse correctly). No migration.

**Follow-through:** help docs mention the dues screen; check whether any guide describes the totals
panel. Owner QA is browser-based per the standing division of labour.
