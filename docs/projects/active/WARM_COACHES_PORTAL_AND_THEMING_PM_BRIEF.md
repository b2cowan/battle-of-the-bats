# PM Brief — Warm Coaches Portal & App-Wide Theming (Exploration)

**Status: exploration + mockups only. Nothing has been built. Owner decisions requested below.**
Full analysis: `WARM_COACHES_PORTAL_AND_THEMING_ANALYSIS.md` (same folder).
Mockups (rev 1): `https://claude.ai/code/artifact/f503dfc9-c4bc-4d7f-a5c0-b63b7ae7040e`

## What was explored

Three related questions about how the app looks and who controls it:

- **A.** Should the coaches' day-to-day workspace (roster, schedule, money, lineups) switch from
  the current dark look to the warm cream look the mobile app and coach sign-up now use?
- **B.** Should users get a theme switcher — Light / Dark / Warm — like Microsoft Teams?
- **C.** If we ever change a brand color, does it update everywhere, or are there spots that
  would silently keep the old color?

## What we found, in plain terms

**The three questions are really one project.** They all depend on the same cleanup (a few hundred
hard-coded colors in the operator screens that ignore the central color system) and one product
decision (when a user's chosen theme and an organization's brand colors conflict, who wins).

**A — Warming the coaches workspace is coherent but big.** It touches roughly 35 screens across
both the free and premium coach portals. About a third recolors cleanly; a third needs new warm
designs for things warm has never had (dense data tables, money ledgers); and a fifth is genuinely
risky (the schedule calendar and the drag-and-drop lineup builder), where a halfway job would look
broken — the exact trap we deliberately avoided before. There's no evidence coaches are unhappy
with the dark workspace, so we recommend **not** doing this as a one-off restyle.

**B — A theme switcher is the better way to get there.** Warm already exists end-to-end on the
consumer app, so a Dark⇄Warm switcher there is a small job. Then the warm coaches workspace, if
ratified, is built as one of the switcher's options — coaches who love the warm look choose it,
coaches who prefer dark keep it, and we never repaint anyone's workspace out from under them.
A true "Light" theme doesn't exist yet anywhere and would be its own design project (fast-follow).

**C — Today, changing a brand color would NOT update everywhere.** Each org's own brand color
system works well. But the platform's colors would visibly miss: the scorekeeper screen (including
a hand-painted logo), parts of the coaches and admin consoles, one card style that reaches public
fan pages, emails, and the installed-app chrome. There's also a hidden duplicate of the platform
blue that hundreds of screens use, which no brand change currently reaches. The fix is a
short, phased cleanup — and its first two days of work (stop new debt + reconcile the duplicate
blue) are worth doing immediately regardless of everything else. A live "brand settings" page is
feasible later — the org-level version already ships — but building it before the cleanup would
be false advertising.

## Recommended order (each step useful on its own)

1. **Decide the rule: org brand always wins on org-branded pages** (fans always see the
   tournament's look; the personal theme only governs the app's own neutral areas). Log it.
2. **Two-day cleanup start** — stop new hard-coded colors in operator screens; fix the duplicate
   platform blue.
3. **Ship the Dark⇄Warm switcher on the consumer app** (Account page). Small, real, visible.
4. **Finish the color cleanup** in the coach/admin screens.
5. **Then, if ratified, build the warm coaches workspace as a theme option** — in an order that
   never shows a half-finished mix, with the risky screens (schedule, lineups) last and mocked up
   first.
6. **Later, optionally:** the Light theme and a platform brand-settings page.

## What the owner sees differently after each step

- After 3: a coach or fan opens Account and picks Warm or Dark for the app's own areas; the choice
  follows their account across devices. Tournament pages keep their organizer branding always.
- After 5: a coach can choose the warm workspace; the default stays dark. No forced change.
- After the cleanup: a future rebrand (or brand-settings page) actually changes everything at once.

## Decisions requested

1. Ratify the precedence rule (org brand wins on org-branded surfaces; personal theme governs
   neutral app areas) — this gates everything.
2. Approve the immediate 2-day cleanup start (no visible change; pure risk reduction).
3. Warm coaches workspace: confirm it becomes a **theme option later** (recommended), not a
   permanent restyle now.
4. Theme switcher scope: consumer app first, coaches portal second, admin deferred, scorekeeper
   excluded — confirm.
5. Review the mockups (warm workspace frames + theme picker) and mark up anything to change; the
   risky screens (schedule modals, lineup builder, extreme team colors) get their own mockup round
   before any build is ratified.

## Success criteria

- No user ever sees a half-converted screen (the established seam rule holds at every step).
- The switcher is obviously visible (a past toggle was removed for being imperceptible — this one
  clears that bar by design).
- After cleanup, one color edit provably propagates: the audit report goes to ~zero misses on the
  covered surfaces and stays there via the automated check.
