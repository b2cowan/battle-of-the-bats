# A1 — Retiring the roster switch · PM brief

**Created 2026-08-03.** Plain-language companion to `COACH_ROSTER_BASELINE_A1_PLAN.md`.
**Mockups:** https://claude.ai/code/artifact/1f7c75ac-b7bc-42c7-b4bf-69fe71a70a5a

---

## What this is

A head coach can currently hide the player list from an assistant. **The control never worked.** An
audit of every screen that prints a player's name found four screens obeyed it and four ignored it —
an assistant with the roster hidden still saw every full name and number in the lineup builder, the
playing-time report, the dues page and awards.

This removes the switch, and makes players' names, numbers and positions visible to everyone with
access to a team's portal.

## Why it matters

A switch that half-works is worse than no switch. A head coach who set it deliberately believed they
had protected something, and had not — the product was making a safety promise it could not keep.

The information that genuinely needs protecting — **guardian contact details, birthdates, medical
notes and emergency contacts** — sits behind a separate control (*Contacts & birthdates*), is off by
default, and is **completely untouched** by this change. That switch was always the one doing the real
work.

## What a coach sees differently

**Head coaches** lose one control from the staff card and gain a line of text explaining what is true
now and where the real protection lives. Nothing else on that card moves.

**Assistant coaches** who had the roster hidden gain the sections that were being hidden from them —
and, more usefully, stop meeting screens that show them money or a lineup with the people blanked
out. ⚠ This is a visible change for any team that used the switch, and belongs in the release notes.

**Helpers** — the parent volunteers invited to run one station — see names on their practice plan
exactly as they do today. Whether they gain anything else is **the one open question** (below).

**Nobody loses anything.** No coach's access narrows.

## The one decision needed

**Does a helper get the roster page?**

The retired switch was quietly doing two jobs: deciding whether a name could appear on a screen, *and*
deciding whether whole sections existed at all. Making names baseline answers the first. The second
still needs an answer, and the ruling as written is silent on it.

- **Recommended:** names appear wherever a person's work needs them; sections stay decided by the
  duties the head coach has actually given them. A helper keeps their plan and their schedule, and
  the roster page, development board and season numbers stay closed.
- **The alternative:** retire the switch with nothing behind it. Simpler, and defensible on the
  literal wording — but it hands a parent volunteer the full team record, which is a widening rather
  than the simplification this was meant to be.

See frame 2 of the mockups for both, drawn side by side.

## Two things that would break quietly

Folded into this work rather than left to be caught in testing:

1. **The word "Helper" would vanish from the staff card.** It is worked out from the switches a person
   holds, and the retired one is part of that sum. Every helper would be relabelled "Assistant" — no
   access change, but the head coach loses the only place the product tells them what they invited.
2. **The end-of-season screen would stop appearing.** A helper whose season closes should meet
   *"This season has finished."* That screen is decided by the same retired switch — so it would
   disappear, and the helper would land on the team's season review instead, complete with a button
   that shares a card carrying a child's first name. **That door was closed one ruling ago; this
   would reopen it**, and it would look like an unrelated tidy-up.

## Priority and sequencing

**Next up.** It is the first of three items from the 2026-08-03 rulings and has to go first — the
other two (closing the season review to non-coaches, and correcting the staff-removal wording) build
on the model this establishes. Doing them first means writing conditions this change immediately
invalidates.

## Success criteria

- No coach's access narrows; nobody loses a screen they had.
- An assistant granted team money sees the names beside the amounts.
- Guardian contacts, birthdates and medical notes remain exactly as protected as they are today.
- A helper still meets the honest end-of-season screen, and still reads "Helper" on the staff card.
- The permission model is **smaller** — one visible switch and one hidden grant removed, nothing added.

## What this does not touch

No pricing, plan, packaging or billing change. No database change. No effect on families, parents or
public pages.

## Testing note

⚠ Browser testing needs **a second signed-in account set up as a helper**. Phase 4 could not check the
helper's own screens for exactly this reason, and this change alters them.
