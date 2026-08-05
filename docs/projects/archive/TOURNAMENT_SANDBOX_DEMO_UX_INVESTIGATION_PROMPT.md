# "See it live" — demo UX investigation (do this BEFORE Phase 2)

**Written 2026-08-03 by the chat that built Phase 1, at the owner's request after the first QA pass.**

---

## ⛔ STOP — read this before anything else

**This is a DESIGN investigation. Do not write feature code. Do not change a component, a
stylesheet, or a copy string until the owner has approved mockups.**

The required order, and it is not negotiable:

1. **Investigate + diagnose.** Read, measure, form a view. No edits.
2. **Present an Implementation Plan / task list, and a plain-language PM UX summary** — written for
   a product manager, not an engineer: what a visitor sees and does differently, and why.
   `AGENCY_RULES.md` makes this a **blocking step**: no code may begin until it has been presented.
3. **Produce mockups**, published as a **Claude Artifact**, every element labelled
   **NEW / RESTYLED / UNCHANGED**.
4. **Get the owner's explicit approval.**
5. **Only then build** — and offer `/simplify`, then `/review`, then `/docs` at the end.

Two exceptions, both narrow. You MAY, before approval:
- **read anything**, and **measure the running app** (Playwright, curl, probes) — measurement is the
  whole point, and it is what turned this investigation's central finding around;
- fix an **outright defect you trip over** (something visibly broken, not something you'd redesign)
  — say so plainly when you do, and keep it separate from the design work.

If the investigation makes you want to change something and you cannot tell which side of that line
it falls on, **it is design. Put it in the mockups and ask.**

> ℹ Phase 1's own mockups (2026-08-02) are **binding until the owner replaces them**. Much of what
> follows is a proposal to change them. Where you propose a change, say so explicitly and say why —
> "the owner didn't like it" is a reason to re-open a spec, not to quietly ignore one.

---

## Why this exists

Phase 1 is code-complete and the machinery is sound: nothing saves, nothing sends, the demo keeps
itself alive. But the owner sat in front of it and said:

> *"I honestly still don't know what these buttons are supposed to accomplish, they don't seem to do
> anything except see the organizer's side."*

That is the finding. Everything below serves it.

---

## Read first

1. `TOURNAMENT_ADMIN_SANDBOX_PLAN.md` — the plan, ratified decisions D0–D4, and **build notes 1–25**.
2. `TOURNAMENT_SANDBOX_MOCKUPS.html` — the approved Phase 1 spec (artifact
   `118b8d75-1b83-4272-b9f2-bfe0ae9f7ddf`). **Everything in this investigation is a proposal to
   CHANGE it**, so read it as the thing you are arguing with, not the thing you must obey.
3. `BUSINESS_DECISIONS.md` 2026-08-02 — the door is **ungated, permanently**. No email, no form,
   no lead capture, ever. That is not open for redesign.
4. `OWNER_QA_LEDGER.md` §5.2 — the QA steps, and the state of the owner's first pass.

---

## What is already known — measured, not guessed

Do not re-derive these. They were measured with Playwright against the running app on 2026-08-03,
after a screenshot led the previous chat to the wrong conclusion twice.

**The tour chips are NOT broken. They work, and the visitor cannot tell.**

| Chip | What it actually does when clicked | Why it reads as dead |
|---|---|---|
| 1 · "Scores update on their own" | Scrolls the page 209px and puts a lime ring on the real Live Now section | The section was already almost on screen. A small scroll and a ring nobody is looking at is indistinguishable from nothing. |
| 2 · "The bracket fills itself in" | Navigates successfully to the Playoffs page | **There is no Playoffs link in the tournament's own left nav** (verified: zero `/playoffs` anchors on the page). The visitor is teleported somewhere they had no idea existed and no obvious way back. |
| 3 · "See the organizer's side" | Works, and is the only one the owner recognised as working | It changes the whole screen. It is *legible*. |

**The lesson: legibility, not function, is the problem.** A tour step that produces a subtle change
on the page you are already looking at will always read as a broken button. Chip 3 works because the
world visibly changes.

**Two layout defects were found and FIXED during this diagnosis** (both already applied):

- The consumer top strip is `z-index: 200` and was pinned at `top: 0`, so it sat **on top of** the
  sandbox banner and hid the entire honesty claim — the promise, the countdown and the CTA. It
  reads `--desktop-strip-h` as a *height*, not a *top*, which is why it escaped the first sweep.
- The same strip vacating its usual band left a **48px empty gap** below the chip rail.

⚠ **The geometry contract has now produced three separate defects in one 110px band.** Any redesign
that adds to the fixed chrome must treat that as a known-fragile area, and **must be verified by
measuring the rendered page, not by looking at it.** See `memory/feedback_verify_with_playwright_not_screenshots.md`.

---

## The three questions to answer

### 1. What should the tour actually be?

The current pattern is a rail of numbered buttons that silently scroll or navigate. Consider whether
the demo should **lead** rather than **offer** — e.g. a stepped walkthrough that moves the visitor,
tells them what just happened, and says what is next ("Step 2 of 4 · Next →"), so no step can be
pressed without the visitor knowing something occurred.

Things worth resolving either way:
- **Narration.** After a step fires, does anything say what changed? Today nothing does.
- **Return path.** Chip 2 strands a visitor on a page with no nav entry. Any step that travels needs
  a way back that a stranger can see.
- **Two sides, one tour.** The fan side and the operator side currently share one chip pattern but
  are really two different demos. Should they?
- **The ninety-second question.** What is the ONE thing a prospect must witness? Design outward from
  that, not from a list of features we happen to have seeded.

### 2. Should the demo's admin nav be curated harder — and how?

Today four corners are hidden (billing, staff invitations, exports, deep event settings) and
everything else is fully reachable. The owner asks whether the rest should be narrowed to the
sections that demo well (dashboard, schedule, results) with the remainder replaced by an explainer.

**The previous chat's recommendation, offered as a starting position to argue with, not a
conclusion:**

- **Do not use pop-ups.** A modal that explains a screen is a worse version of the screen, it
  interrupts, and a demo that is half product / half brochure teaches "this is a brochure."
- **Do not hide more, either.** The plan is explicit that the tournament module is meant to be shown
  *deeply, not defensively* — the four hidden corners are "four corners, not a curtain."
- **Instead: guide attention rather than remove choice.** The tour becomes the spine; sections that
  are thin in a demo (Venues, Chat, Rules) can carry a short in-place line at the top — honest,
  skippable, and not a wall.

Whatever is decided, it must not become a security posture: **the write block is the real control**
and the hiding is cosmetic. Never let the two get confused (`lib/sandbox-curation.ts` says so).

### 3. What else would make the demo land?

Open brief. Things the previous chat noticed but did not act on:
- The fan side opens on a page whose most interesting content is below the fold.
- Nothing ever tells the visitor the score just changed — the one thing that proves it is live.
- The "Start your own — free" CTA appears in the banner and the toast, but no dead end *offers* it.
- The countdown is proof the demo is running, but a stranger has no idea what it is counting to.

---

## The gate (restated — it is the top of this document, and it is the deliverable)

**Mockups are binding in this project.** This investigation ENDS in mockups: published as a
**Claude Artifact** (owner convention — always, for version history; republish to the same path on
revision), every element labelled **NEW / RESTYLED / UNCHANGED**, alongside the plain-language PM
summary that `AGENCY_RULES.md` makes a blocking step.

**Nothing gets built until the owner approves them.** If you find yourself editing a component to
"see how it would look", stop and draw it instead.

What the mockups must cover, at minimum:
- the tour in whatever form you propose, on **both** the fan side and the operator side;
- what a visitor sees immediately **after** a step fires (the narration gap is the core finding);
- the admin nav treatment, if you propose changing it;
- how the whole thing behaves at phone width — the chrome is already 110px tall on desktop.

---

## Do not break these

1. **The door stays ungated.** No email, no form, no interstitial for a logged-out visitor. The one
   confirm screen that exists is shown ONLY to somebody already signed in, warning them before their
   own session is replaced — that is warning a customer, not gating a stranger.
2. **"Live" is a TIME WINDOW, not a status.** Do not tidy the game times; you will kill the liveness.
3. **The 89–92 HEALTHY schedule baseline is load-bearing** and was hard-won across all 72 cycle ×
   phase combinations. The "try to break it" beat needs an intact baseline.
4. **Top-pinned chrome must carry `--sandbox-chrome-h`**, and the failure is silent — the banner
   keeps its space and something paints over it.
5. **A real customer must be untouched.** Everything sandbox-only is gated on a hardcoded allow-list;
   keep it that way and re-verify.
6. **Other agents share this working copy.** Branch is `dev`, stage explicit pathspecs only, and
   confirm afterwards that only your files landed — a concurrent session silently reverted a file
   mid-build during Phase 1.
7. **No commits without the owner's explicit, per-action OK.** Ask before restarting the dev server
   and before any schema change.

## Definition of done

An owner — or a stranger — can press anything in the demo's guidance and immediately know what
happened and what to do next. Nothing in the demo is a button that appears to do nothing.
