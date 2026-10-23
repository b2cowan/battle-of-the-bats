# The public face, warm — S5: the system screens and the neutral link-preview card (drawing session prompt)

> **Written 2026-10-23.** **Paste this into a new chat on `dev`.** **Model: Sonnet, effort high** (see "Why Sonnet" at the
> foot). **A drawing and wording session: nothing is built.** Touches no code. Plan: `PUBLIC_FACE_WARM_PLAN.md` (the S5 row in
> the ladder). Order: S1 ✓ → S3a ✓ → S4 ✓ (both walks passed 2026-10-23, ledger §367 and §368) → **S5** → S3b.

## What this session is for

S5 is the last warm-up of the screens a visitor meets **when something goes wrong or nothing is there**: the page that does
not exist, the page that crashed, the page with no connection, the unsubscribe confirmation, the suspended-account screen,
and the grey card a shared link falls back to. Today some of them still read like a terminal. The bar for the whole project
(owner, 2026-10-19): a volunteer, coach or organizer feels this was **made to run their league or team, not a terminal.**
A screen that appears when a person is already confused is where that matters most.

This session **draws every screen, words it, and gets the owner's rulings.** The build is a later, smaller session
(Sonnet, medium; the plan's row 221). Do not build.

## What is ruled (do not reopen)

- Always warm; the type rules P1–P10 (`docs/agents/brand/VISUAL_IDENTITY.md`); one lime button per view; **lime is a fill,
  never text on paper**; paper `#F8F4ED`, ink `#241E15`, olive `#57651E`, lime `#D9F99D` as a fill only.
- The refined Joined FL mark and the FieldLogicHQ name (olive mark, "FieldLogic" ink, "HQ" olive; on Dark the name takes the
  text colour) are **ruled and built** (S4 Part B). Use the shared name component's look; do not redraw the mark.
- Voice: "Practical. Direct. Warm." Positioning "community sport". **Never claim Canadian identity.** No sport-specific
  symbol (the product serves many sports).
- A font that is not on Google Fonts is a standing no-go (self-hosted fonts are ruled out).
- The words come from `/marketing`. Draft them, then have `/marketing` rule on them; do not ship your own wording as final.

## Read first

- `docs/projects/active/PUBLIC_FACE_WARM_PLAN.md`: the system-screens census row (~line 47), the S5 ladder row (~line 237),
  and the S1 `check:public-type --report`, which is the to-do list for these screens (run it and quote what it still finds).
- `docs/agents/brand/BRAND_STRATEGY.md` (voice) and `VISUAL_IDENTITY.md` (P1–P10, §4 the name).
- `docs/projects/active/PUBLIC_FACE_WARM_S4_COPY.md` for the house phrasing already approved on the marketing set.
- The auto-memory: `feedback_mockups_as_claude_artifacts` (always an Artifact; true size; whole-screen before and after),
  `feedback_always_run_design_on_mockups` (run `/design` before the hand-off), `feedback_clickable_design_annotations`,
  `feedback_push_back_by_default`, `feedback_past_decisions_are_reference_not_authority`, `decision_one_loading_line`,
  `project_public_face_warm`.

## The screens (verify each in the code before you say what it does today; the census is from 10-22 and S4 touched some)

1. **404** (`app/not-found.tsx`). Today it can still read "[DIAGNOSTIC]: ROUTE_NOT_FOUND" and "Return to Root Node" in
   typewriter capitals. It renders outside any shell, so it follows the user's saved theme itself. Draw it warm **and** Dark.
2. **Crash inside a page** (`app/error.tsx`) and **crash in the root layout** (`app/global-error.tsx`). The second has no
   stylesheet and no fonts (it builds its own `<html>` with inline styles and a hard-coded near-black ground), so **what it
   can draw is limited.** State plainly what it can and cannot do (system font stack, inline colours, no theme to follow, the
   name as inline SVG) and draw only that. This is the screen where the owner most needs to hear "you can't have that" early.
3. **Offline** (`public/offline.html`). S4 Part B already gave it the new name on paper; check what is still old (words,
   icon, type) and draw the rest. A static file: no app fonts, no theme.
4. **Unsubscribe confirmed** (`app/unsubscribe/confirmed`). S4 put the new name on it; its own look was left for here.
5. **Suspended account** (an `/auth/*` screen, the last reader of `auth.module.css`; find its route). Draw it so the person
   learns what happened and what to do, in the project's tone, without alarm.
6. **The neutral link-preview card** (the fallback that `lib/club-share-card-image.tsx` and the marketing share card use when
   there is nothing specific to show). 1200 × 630, same ground as the marketing card S4 built.

## Two carry-ins that are NOT drawings: list them, do not draw them

- **The install banner off the sign-up steps** (U7) and **the screen-reader pass on the shared account form**
  (`components/auth/AccountForm`). Each gets one line in the hand-off saying what the build will do and what the owner
  should check. No mockup.

## What to produce

**One published Artifact**, its own page, never a Club hub. Source: `docs/projects/active/PUBLIC_FACE_WARM_S5_DRAWINGS.html`.
Start with the Artifact tool's `quickstart` (intent `design`) and follow what it returns. Then:

1. **Today:** each screen as it renders now, true size, in warm and in Dark where the screen follows the setting. Mark
   what reads as a terminal and what already works.
2. **The proposal, per screen:** the whole screen before and after, at a desktop and a phone width, warm and Dark. For each
   crash/offline screen, say which constraints shaped it. Every highlight (a chip, a flag, a note) opens its explanation on
   click; a hover title is not enough.
3. **Words:** the exact text for each screen and each button, from `/marketing` (run it on the words). The 404 and the crash
   screens must each leave a person one obvious next step, and say nothing about "systems", "nodes", "diagnostics" or "routes".
4. **Behaviour that a picture cannot show:** where the 404's button goes (home, or the person's own home when signed in),
   what "Try again" does on the crash screen, how the offline page recovers, what an unsubscribe tells the person is now true,
   and whether any of these screens reports the error to us (keep today's reporting; do not add new tracking).
5. **What the build will touch and what could regress:** the screens that share a stylesheet, the service worker's cached copy
   of the offline page (a version bump is the S4 precedent), and anything a test pins (the S1 type check, the S4 guards).
6. **Asks:** one checkbox per option, a recommendation on each, notes boxes, and a paste-back block (the house format).
   Disagree out loud if a screen should not exist in the form listed (for example, if the suspended screen and a "your
   account is paused" notice are really the same thing).
7. **Run `/design` on the page before the hand-off**, then `/marketing` on the words. Apply their changes, republish, and
   say what changed.

## Do not

- Build, edit a live page, change an icon or a service-worker file.
- Reopen the identity, the palette, always-warm, or one-lime-per-view.
- Invent a new illustration style. If a screen wants a picture, propose the smallest thing that works and say why; the offline
  page's existing line icon is the precedent.
- Edit `TODO.md` if another session has uncommitted edits in it (say so instead).

## Records, same unit of work

- The plan's S5 ladder row: "drawn <date>, asks open" plus the artifact link.
- The project index artifact (`PUBLIC_FACE_WARM_INDEX.html`, db-backed: update it with a data write, not a republish).
- The auto-memory `project_public_face_warm`.
- Record rulings as ruled, adding nothing the owner did not rule. After the owner rules, write the S5 words file
  (`PUBLIC_FACE_WARM_S5_COPY.md`) and the build prompt, as S4 did.

## Why Sonnet is enough for this session (and where it stops being)

Everything that needs design judgment is already decided: the identity, the palette, the type rules, the name and the mark.
This session applies those to six small screens and drafts plain words; there is no new identity question. What it must do
carefully is **verify what each screen can technically show** (the root crash and offline screens have no theme and no
fonts), which is checking, not taste. **Switch to Opus** only if the owner rejects the first round and asks for a different
idea for the whole family of screens, or if `/design` finds the crash screens cannot be made warm within their limits and a
real trade-off has to be argued.
