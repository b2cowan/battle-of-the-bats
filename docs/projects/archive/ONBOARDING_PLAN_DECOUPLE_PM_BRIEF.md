# PM Brief — Decouple Plan Selection from the Tournament Setup Wizard

**Date:** 2026-06-04
**Status:** Built, awaiting browser verification
**Priority:** High (production onboarding bug for every new tournament org)

## What's changing

When a new organization signs up, they first **pick a plan** (a standalone screen, where billing/Stripe lives) and then go through a short **setup wizard** to create their first tournament. Today those two things are tangled together: the plan picker is counted as "Step 1 of 7" inside the wizard, which causes three visible problems:

- The **"One quick question"** screen (how many tournaments do you run?) gets **skipped** going forward — the wizard jumps from the plan screen straight to *Create tournament*.
- Pressing **Back** lands the user on the plan screen with no way forward (their current plan shows as a greyed-out "Current plan" with no Continue button) — a dead end.
- The step counter reads **out of 7** with a confusing, unreachable first step.

After this change, plan selection is cleanly separated from setup. The tournament setup wizard becomes a self-contained **6-step flow**: *One quick question → Create tournament → Divisions → Welcome message → Venues → Review & save*, numbered **/6**. Nothing is skipped, Back always works and never dead-ends, and the counter matches what the user actually sees.

## Why it matters

This is the **first thing every new tournament customer does**. A wizard that silently skips a step, dead-ends on Back, and shows a wrong step count erodes trust at the worst possible moment and can stall a sign-up before the first tournament is ever created.

## Customer impact

- **New tournament orgs:** a clear, correct, 6-step setup with no skipped steps and no dead ends. Plan choice (and any billing) happens up front, on its own screen, exactly as expected.
- **League/Club orgs:** no change — their onboarding is a separate flow.
- **Existing orgs changing plans later:** no change.

## Success criteria

- Choosing a plan leads into the setup wizard at the **first** step (the quick question), never skipping it.
- Back navigation always moves to the previous setup step and never strands the user on the plan picker.
- The step counter reads **/6** and matches the screens shown.
- League/Club onboarding and later plan changes are unaffected.
