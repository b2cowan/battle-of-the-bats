# Coach Portal Launch Batch 1 — PM Brief

> **Companion to:** `COACH_PORTAL_LAUNCH_BATCH1_PLAN.md` · **Created:** 2026-07-28 · **Status:** Awaiting owner ratification (mockups + 4 decisions)

## What it does

Fixes the first batch of go-to-market blockers from the premium coach portal UX readiness review (2026-07-28):

1. **Phones stop eating taps.** Today, on nearly every add/edit form in the portal (adding a player, logging an expense, setting up dues, creating a fundraiser, requesting a payment), the Save/Add button can sit *underneath* the fixed bottom navigation bar — a coach's tap lands on a nav tab instead of saving their work. After this batch, every form opens as a full-height sheet on mobile with the Save button pinned safely above the phone's home indicator, and the nav bar steps out of the way while any form is open. Critically, the fix flips the underlying default so **every future form is safe automatically** — the current bug pattern can't be reintroduced by forgetting a step.
2. **The overflow menu always fits the screen.** The mobile "More" menu currently grows with the coach's access level and team count and can push its top rows — including the team switcher and sign-out — clean off the top of smaller phones with no way to reach them. It now caps its height and scrolls internally.
3. **The Tournaments page starts telling the truth.** Three changes:
   - **It works for org-owned teams for the first time.** Today a rep team created by a league/club org can *never* show tournaments — the page is disconnected from the data even after the org admin links a registration to the team. The batch connects the existing admin "Link to rep team" action through to the coach's portal, so that admin workflow finally delivers what it implies.
   - **Empty states explain how tournaments get here**, with different honest guidance for a standalone team ("register on any organization's public tournament page with this account's email and it appears here automatically") vs. an org team ("entries appear once your organization registers and links your team").
   - **The list sorts sensibly** (live and upcoming first, then past) and gains the same "?" in-context help button the Tryouts page already has.

## Why it matters

These were rated P0 in the readiness review: a paying customer silently losing a Save tap is a trust-breaking bug on the exact device coaches use at the field, and the Tournaments page — a headline reason to buy this product — currently renders as an unexplained blank for the very teams most likely to be paying (org rep teams). Both are structural: the modal pattern gets copied into every new feature, and the empty page reads as "this product doesn't do tournaments."

## Who benefits

All premium coaches (head and assistant) on mobile; org-created rep-team coaches additionally get a functioning Tournaments page. Org admins benefit indirectly — their "Link to rep team" action becomes visibly useful. No billing/plan changes.

## Expected customer impact

- Mobile forms feel native and trustworthy: full-screen sheet, back arrow, Save always reachable, no mystery mis-taps.
- The More menu is always fully reachable regardless of phone size or how many teams/permissions a coach has.
- A coach opening Tournaments always sees either their events in a sensible order, or a clear explanation of how to get them there — never a shrug.

## Priority

**High** — first execution batch of the pre-launch P0 list; deliberately sequenced first because it's contained (no migrations, no new schema) while removing the scariest mobile bug and the most visible dead end.

## Success criteria

- Automated checks confirm no form button overlaps the nav bar on any inventoried modal at standard phone sizes, and the More menu fits a small-phone viewport.
- An org rep team with an admin-linked registration sees that tournament in the coach portal, with live/upcoming events listed first.
- Each of the three empty-state variants renders for the right team situation.
- Owner phone pass: iOS home-indicator clearance, Android keyboard behavior on sheet forms, warm + dark themes.

## Decisions — ALL RATIFIED 2026-07-28 (owner, at the recommendations)

1. **D1 — APPROVED:** mobile sheet treatment becomes the default for all portal forms (deliberate opt-out for small confirm dialogs).
2. **D2 — APPROVED:** the admin "Link to rep team" data feeds the coach Tournaments page so org teams populate.
3. **D3 — APPROVED:** the "nav bar hides while a form is open" safety net ships in this batch.
4. **D4 — APPROVED:** standalone-team empty state offers "Browse public tournaments" as a secondary action. The directory was confirmed LIVE on prod (2026-07-22 bundle; stale "Planning" doc headers trued up 2026-07-28), so this points at a real, shipped surface.

## Mockups

Visual spec: **Coach Portal Batch 1 — Mockups** artifact (approval makes it the binding spec; elements labeled NEW / RESTYLED / UNCHANGED).
