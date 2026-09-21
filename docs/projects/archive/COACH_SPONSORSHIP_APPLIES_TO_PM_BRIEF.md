# PM Brief — Sponsorship Applies To

**Status:** ruled 2026-09-21 (D1–D8 as drawn) · built on dev and committed `02a81294` the same day · ✅ owner QA §218 PASSED 2026-09-21, project CLOSED · migration 308 to prod BEFORE the promote
**Hub:** https://claude.ai/artifact/JhhkcVbSpNQycMRCBYzepR · plan `COACH_SPONSORSHIP_APPLIES_TO_PLAN.md`

## What a coach sees differently

- **Each family credited on a sponsorship gets one quiet line: "Applies to the team default — the last
  payment first · Change".** It sits under the family's share on the pledge form and in the sponsor's
  room. A coach who never opens it sees a form one line taller than today and otherwise identical.
- **Change opens that family's own dues payments as checkboxes** — dated, with amounts. Tick the ones
  the parent asked for; the line reads them back as dates ("Applies to Dec 1 · Feb 1"). Two sentences
  carry the rules: cash the family already sent still lands first, and whatever the sponsorship can't
  place on those payments follows the team default.
- **In the family's drawer on Player Dues, the sponsorship lands where it was arranged** and the Note
  says *as arranged*. If the parent pays a named payment in cash anyway, the money fills the next named
  payment, anything left follows the team default, and the drawer says so in a sentence — an
  arrangement never looks ignored.
- **If the dues schedule is re-run after an arrangement,** the sponsor's row and the family's credit ask
  for a look ("check the payments") until the coach presses Keep these or changes it.
- **A family with no dues schedule yet** gets a line pointing at Player Dues, and no Change.
- Everything else reads as it does now: the team setting in Money, reminders, statements, exports,
  season-end settlement, the Money Overview. They all read the one computed figure per family.

## Why it matters

Parents make arrangements with coaches — "put the sponsorship on the December and February payments,
we're tight then." Today the product has one team-wide answer to where any credit lands, and no family
can be the exception. There is no honest workaround: recording the sponsor's cheque as a payment calls a
sponsor's money the parent's cash and changes what the season reports as collected; switching the team
setting moves every family for one. The coach says no, or keeps the promise in their head and hopes the
reminder emails don't contradict it.

## Who it affects, and what happens if we do nothing

Head coaches and treasurers on any team that credits sponsorships to families. Most sponsorships will
never open the door — the team default is right for most families — so the cost to everyone else is one
line of text. Do nothing and the arrangement stays informal, the reminders keep asking for the wrong
month, and the parent's trust in the figures the product sends them is what pays for it.

## Role-based access

Anyone who can write money on the team can make or change an arrangement — the same rule as the split
itself. Read-only staff see it stated on the sponsor's row and in the drawer, without Change.

## Tradeoffs the owner should weigh

- **The pledge form learns a choice about landing.** Landing *arithmetic* was retired from that form on
  Aug 31 and the reason holds; the proposal keeps the default path unchanged to the eye and puts only the
  choice behind a door.
- **The money model's rule changes one word.** "Where a credit lands is derived, never stored" becomes
  "no computed landing is stored; an arrangement may be." Same reason, honoured the same way.
- **Two judgment calls (D3, D4)** — cash paid on a named payment; a schedule re-run under an
  arrangement — each drawn with a recommended answer and a stricter alternative.

## Priority

Medium. A real parent-facing gap with no workaround, on the minority of sponsorships. Sits after the open
fundraising QA walks and before the P4 money-book shelf, because it touches the same pledge and
sponsor-room surfaces.

## Success criteria

- A coach names two payments on a family's share in under a minute from either door, and the drawer shows
  the money on those payments with "as arranged".
- A cash payment on a named payment never strands the sponsor's money; the drawer states where it went.
- The reminder for a named month asks for the lowered figure — with no change to reminder code.
- A coach who never opens the door cannot tell the pledge form changed, beyond one line.
