# PM Brief — Layout Invariant Sweep

**Status:** Built 2026-08-02 on `dev`, uncommitted. Owner QA pending.
**Plan:** [LAYOUT_INVARIANT_SWEEP_PLAN.md](LAYOUT_INVARIANT_SWEEP_PLAN.md)

## The problem in one line

Every automated check we run before handing work over reads **source code or database state**. None
of them looked at a rendered page — so every styling and layout defect reached the owner's eyes as
the first thing in the pipeline that looked at pixels.

## What changes

Nothing a customer sees. This is a change to how work gets checked before it reaches the owner.

Before: a coach-portal screen was handed over having been checked for type errors, hard-coded
colours, date handling, and schema drift — but never opened in a browser at phone width. Layout
defects were found during the owner's visual pass, described in prose, guessed at, and often fixed
wrongly the first time. Our own notes record a screenshot-driven pass producing the wrong fix twice
on one problem.

After: 28 coach-portal screens are opened at four widths and measured against six house rules
before handover. The owner's visual pass becomes a judgement pass — is this *good* — rather than a
defect hunt.

## The six house rules

| Rule | What a coach would have hit |
|---|---|
| Page never scrolls sideways | The whole screen slides left and right under the thumb |
| Every control clears 44px | Buttons too small to hit reliably on a phone |
| Wide content scrolls in its own box | A table drags the entire page sideways |
| Sticky things can actually stick | A rail that should follow you scrolls away |
| Text is readable on what's behind it | Pale text on a pale card |
| Nothing usable hides under fixed chrome | The last row trapped behind the bottom bar |

These rules were not invented. They already existed — written correctly — inside three per-feature
test files, each pinned to one screen. So they protected those three screens and every new screen
started unprotected until a bug taught someone to write another one. This promotes them to
product-wide.

## Why it matters commercially

Accessibility is the sharp end. The sweep found on its first screen that our muted text colour
fails the WCAG AA contrast standard everywhere it is used — 3.83:1 on white where 4.5:1 is
required, and 2.94:1 in the mobile bottom navigation. For Canadian sports organisations, several of
which are municipally affiliated or school-board adjacent, an accessibility complaint is a
procurement problem, not just a design one. We now have a measurement instead of an opinion.

## Cost and tradeoffs

- **Runtime:** the full sweep takes several minutes because it compiles and opens every screen.
  It is a deliberate pre-handover step, not something that runs on every save.
- **It grandfathers existing defects.** A blanket 44px rule fails product-wide today — our shared
  button primitives render at 41px and nav rows at 38.5px. A gate that is red everywhere gets
  switched off, so today's population is recorded and only *new* defects fail the check. The count
  of unexplained entries is printed every run so the number stays uncomfortable.
- **It cannot catch taste.** Weak hierarchy, awkward spacing, drift from an approved mockup — all
  still need the owner's eye. The goal is to stop spending that eye on mechanical defects.
- **Dev-only surface:** the check runs against the local dev server and dev database. It is not
  wired into the production release gate.

## Success criteria

1. A new coach-portal screen is added to the sweep by one line, not a new test file.
2. Layout and contrast defects are found before handover rather than during the owner's pass.
3. The baseline count falls over time rather than growing.
4. No false positives. A gate that cries wolf gets switched off — during the build, two
   false-positive findings were traced and the rule tightened until two independent measurements
   had to agree.

## Open decisions for the owner

1. **`--home-dim` contrast.** Raising the token fixes an accessibility failure portal-wide but
   changes the look of every muted label. Design call — routes to `/design`.
2. **Should the sweep gate handover formally**, or stay advisory? Recommendation: gate.
3. **Coverage beyond the coach portal.** Admin, public site, and consumer surfaces are not in the
   screen list yet. Each is one line.
