# Keeping the Stack Current — PM Brief

**Status:** Proposed 2026-08-12 — awaiting your approval; nothing built.
**Full plan:** [DEPENDENCY_UPDATE_PROCESS_PLAN.md](DEPENDENCY_UPDATE_PROCESS_PLAN.md)

## The problem, in one sentence

Security fixes for the exact framework version production runs were published in May, and nothing in
our workflow was ever going to tell us — we found out in August, by accident, while planning an
unrelated upgrade, after four production releases had shipped over the top of the exposure.

## What we'd build (four pieces, ~2 days total)

1. **A security tripwire on every release** *(build first)*. Before any production promote, an
   automatic check asks: "does anything we ship have a published High-severity vulnerability?" If
   yes, the release stops and says so. This is the piece that turns "we found out 3 months later"
   into "we found out the next time we shipped" — it needs no new habit, because it lives inside the
   release step we already always run.
2. **A weekly security pulse.** A scheduled check that stays silent when all is clear and speaks up
   within days — not months — when an advisory lands, with a recommendation attached (small safe
   patch vs bigger jump).
3. **A monthly currency report.** One screen showing how far behind each building block is, so
   "we're aging" becomes a five-minute monthly read and a deliberate scheduling decision instead of
   a surprise.
4. **A written playbook.** The upgrade method we just proved on the framework upgrade — verify the
   claims, scan other teams' field reports, map changes onto our product, ship the upgrade alone,
   know the rollback before starting — recorded as a reusable checklist, scaled down for small
   updates and up for big ones.

## What changes for you

- Releases gain one invisible safety check; they only feel different on the day it catches something.
- You get at most one short security note per week (usually none) and one five-minute report per
  month, each ending in a recommendation, not homework.
- Upgrades stop being research projects: the playbook makes the next one start at step 5 instead of
  step 1.

## What we deliberately did NOT choose

Fully automatic updates (bots that bump versions on their own). They fight how this repo works —
one shared working branch, deliberate exact versions — and automatic bumps without verification are
how other teams ship regressions. Every update stays a human decision; the system's job is making
sure the decision is *prompted* on time.

## Your three decisions

1. Should a High-severity finding **block** a release outright, or warn and let you choose?
   (Recommended: block, with a deliberate owner override.)
2. Scheduled automatic pulses, or scripts we run by hand? (Recommended: scheduled — weekly for
   security, monthly for currency.)
3. Sign off on the default policy numbers: security issues evaluated within 7 days and resolved
   within 14; never more than one framework release-line behind; everything else reviewed quarterly;
   new releases get a 2-week settling period before we adopt them (unless security says sooner).
