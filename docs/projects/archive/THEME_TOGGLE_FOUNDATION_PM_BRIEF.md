# PM Brief — Theme Toggle Foundation (Cleanup + Consumer Dark⇄Warm Switcher)

**Ratified 2026-07-21. This brief covers the first build slice of the theming program.**
Plan: `THEME_TOGGLE_FOUNDATION_PLAN.md` · Decisions: design log TH-1…TH-4 · Mockups: rev 1 artifact.

## What ships, in order

**1. A two-day invisible cleanup (first).** Nothing changes on screen. Two things get fixed under
the hood: a hidden duplicate of the platform blue that hundreds of screens use (so future color
changes actually reach everything), and a new automated guard that blocks any NEW hard-coded
colors from creeping into the coach/admin/scorekeeper screens. One question will come back to you
during this step: whether a custom-branded org's color should start flowing into its coaches
portal accents, or the portal stays platform-blue (quick call, we'll present both looks).

**2. The theme switcher on the consumer app.** A new "Appearance" card on the Account tab with
Dark and Warm options. Warm stays the default on the consumer app — people who never touch the
setting see zero change. The choice follows the signed-in account across devices, applies
instantly with no flash on load, and even tints the phone's status bar to match. Tournament pages
are untouched — fans always see the organizer's branding, exactly as ratified.

**3. In parallel: the round-2 mockups** for the hard coaches-portal screens (the schedule editor
and calendar grid, the drag-and-drop lineup builder, the depth chart, and the boundary moments
where warm meets dark). These are what stand between today and green-lighting the warm coaches
workspace as a theme option.

## Why this order matters

The cleanup makes every later theming and branding step trustworthy; the switcher proves the whole
preference mechanism on the surface where warm already exists; and the warm coaches workspace then
arrives as a *choice* coaches can make rather than a repaint they're forced into.

## How you'll test it

- Flip Dark⇄Warm on the Account tab: all four app tabs (Home/Scores/Chat/Account) follow
  immediately; reload and navigate — no flash of the wrong theme.
- Sign in on a second device: your choice follows you.
- Open any tournament page in both modes: identical, organizer-branded, always.
- Don't touch the setting at all: everything looks exactly like today.

## Not in this slice

The warm coaches workspace itself (waits on round-2 mockup approval), a Light theme (real design
project, later), the remaining color-debt cleanup tranches in coach/admin screens (background
workstream), and any owner-facing brand-settings page (after the debt work).
