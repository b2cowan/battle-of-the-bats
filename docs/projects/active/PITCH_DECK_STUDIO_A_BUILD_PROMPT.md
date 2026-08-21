# Build prompt — Pitch Deck Studio, Stage A: the library view (READ-ONLY)

Paste into a **fresh session**. Stage A only — read the stop line below before planning anything
larger.

## Read first, in this order

1. `docs/projects/active/PITCH_DECK_STUDIO_PLAN.md` — the whole project and the owner's three
   rulings. **Binding.** Its findings F1–F5 are the reason this project exists; do not re-derive
   them.
2. `docs/projects/active/PITCH_DECK_STUDIO_PM_BRIEF.md` — the plain-language version.
3. `docs/projects/active/PITCH_SLIDE_LIBRARY_PLAN.md` — the parent. Read the **"What P2b actually
   settled"** block; the library you are about to display was finished on 2026-08-21.
4. `memory/design_decisions.md`, the two 2026-08-21 entries.

## ⚠⚠ THE STOP LINE — BUILD STAGE A AND NOTHING ELSE

Stage A is **the library view, read-only.** Every slide on one page with its picture, its words,
which decks name it, and whether it has gone stale. Every deck with its purpose, its running order,
its count, and where it is published. **No editing. No save button. No composer.**

This matters because Stage B is where all the risk lives — it is where two public marketing pages
gain a data dependency they have never had, and where every invariant the build check enforces must
move into a save path. **A read-only view answers "what do we have?" for a fraction of the cost and
none of that exposure.** Ship it, let the owner use it, then plan B.

⚠ **SCHEDULING (owner, 2026-08-21): this project starts only AFTER the §69 phone-legibility batch
lands** — the three coach slides converting from photographs into drawings. That batch edits the
same slide bank and retires three captures this view reads, so the owner sequenced it first rather
than running the two in parallel. **Confirm those three slides have landed before you start**; if
they have not, the library you display is about to change underneath you.

## What it is

A room in **platform-admin**, in the **Growth** group of the nav — beside Early Access and Email
Campaigns, because it is company-owned material aimed at people who are not customers yet. Follow
the existing platform-admin page conventions rather than inventing a layout; `email-templates` is
the closest precedent for a "list of company content" screen.

## What it must show

**Every slide** (23 today — 15 coach, 8 tournament; `#08` retired, `#18`–`#20` held for the club
deck):
- its picture, rendered at a size you can actually judge;
- its permanent number, its pain and its claim;
- **which decks name it, and at what position** — this is the thing no surface answers today;
- ⚠ **whether it is reachable at all.** The parent project found five finished coach slides that
  could be seen nowhere in the product. This view is where that becomes visible rather than being
  discovered a year later.

**Every deck** — audience, running order, count, and which public page pulls from it.

**Staleness, per slide** — the honest version of what a machine can check:
- a captured slide: does its picture file still exist, and does the manifest still carry its alt,
  caption and size? (There is already a check that answers this — reuse it, do not re-implement.)
- ⚠ **a DRAWN slide has no manifest entry at all**, so the capture-side staleness question is
  meaningless for it. Say so in the UI rather than showing a false green tick. Roughly a third of
  the library is drawn.
- a plan line: does the capability it names still match the live plan configuration? **This is the
  highest-value column on the screen** — the 2026-08-20 persona audit found nineteen overclaims,
  including a capability advertised on six surfaces that the product cannot do, and the same copy
  feeds the in-app upgrade panels, so an overclaim reaches paying customers.

## ⚠ What you will find missing, and must NOT fix here

**A slide is not page-ready.** A public page panel carries two things the slide deliberately does
not: the long unattended `answer`, and the plan line where a feature is gated. Both are written
per page today, not per slide. Writing that copy for all 23 slides is a one-time **editorial** pass
and it belongs to Stage C, where the composer needs it. **Surface the gap in this view — "this
slide has no page copy" is exactly the kind of thing the library view exists to tell you — but do
not write the copy.**

## Hard rules carried in from the parent project

- ⚠⚠ **DECKS ARE DATA, SLIDES ARE CODE** (owner ruling, plan §1). Stage A writes nothing at all, so
  this cannot be breached here — but **do not add an edit affordance "while you are in there."** The
  owner was offered an editable-with-review-queue option and declined it.
- **NO PLAN OR SUBSCRIPTION NAME ON A SLIDE.** The page adds one where a feature is gated. A build
  check enforces it.
- **Plain `<img>` / inline markup, never `next/image`** — it would be the repo's first request-time
  sharp caller on Amplify, a recorded outage class.
- Read `AGENTS.md` before writing code — this is not the Next.js in your training data.
- **Do not restart the shared dev server casually**; other sessions are using it.

## Product Manager UX plan first

`AGENCY_RULES.md` makes this blocking: present a plain-language summary of what the owner sees and
does differently **before** any code. For a screen whose whole job is legibility, that summary is
most of the design.

## Wire up

Plan + PM brief updated · Owner QA §-row (§71 or next free — **never renumber**) · `TODO.md`
pointer · both memory stores. Then `/simplify` → `/review` → `npm run verify:changed`.

⚠ **Schema parity is RED with pre-existing dev-only drift from other sessions** — confirm it is not
yours, then run the post-parity checks individually. `npx next typegen` before `npm run typecheck`.

## Commit

Explicit pathspecs only. **⚠ Several sessions are working in this tree** — check `git status` before
staging and **filter foreign hunks out of shared documents** (`TODO.md`, the QA ledger,
`memory/MEMORY.md`) rather than sweeping another session's work in. `git show --stat HEAD` after.
Commit only on explicit owner OK.
