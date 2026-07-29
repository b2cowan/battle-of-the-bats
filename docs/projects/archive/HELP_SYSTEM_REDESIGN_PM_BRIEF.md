# Help System Redesign — PM Brief

**Status:** Proposed (review complete) · **Created:** 2026-06-17 · **Priority:** High (operator-flagged dissatisfaction)
**Full plan:** [HELP_SYSTEM_REDESIGN_PLAN.md](HELP_SYSTEM_REDESIGN_PLAN.md)

## What this is

A from-scratch review of how help is presented in the app — both the dedicated Help center and the contextual help on the pages where tournament organizers actually work. The operator flagged that the current help "has very little structure, everything is mangled together, and it's hard to find what I'm looking for." We ran a structured multi-perspective review to confirm *why* and to propose a concrete redesign.

This supersedes the earlier tournament-help plan, whose layout we built and shipped — the current design *is* that plan's result, and it's what the operator is now unhappy with.

## What we found (plain language)

- **The guide pages work like a slideshow.** You see one topic at a time with a "Topic 4 of 18" counter and Previous/Next buttons. You can't scan the whole guide, can't use Ctrl+F, and can't tell at a glance whether the answer is even in there.
- **The sidebar puts a block of questions between the search box and the topic list** — exactly the "questions in between search and content headers" complaint.
- **The content is filed under two systems at once** — a set of "how-to recipes" *and* a set of subject topics — so the same thing (e.g. building a schedule) shows up twice in slightly different words. That roughly doubles the apparent length and halves the clarity.
- **The Help hub has four front doors** (featured cards, role paths, "How do I…" links, and the guide grid) all shouting at the same volume, so every visit starts with a navigation decision instead of an answer.
- **On the actual work pages, help is almost absent.** Only 2 of ~20 tournament pages have any contextual help, and it only appears when the page is empty — it vanishes the moment you start working. The pages with the most confusing controls (divisions/pools, registration statuses, communication, check-in) have none.

## The answer to "enough or too much?"

**Too little, in the wrong places, in inconsistent forms.** There's plenty of help *content* in aggregate — it's just buried in a separate center and structured confusingly, while the moments of real confusion (mid-task, on the page) get nothing.

## The answer to "are we using the right approach for each?"

Not consistently. The plan includes a **pattern decision matrix** — which help vehicle fits which moment (a one-line tooltip for an obscure label, always-visible hint text for a 2–3 sentence explanation, a warning banner before an irreversible action, a "help on this page" slide-over for a deep question, a first-run checklist for orientation). Today we have two tools (a "?" tooltip and a banner), one of which is broken on touch devices, and we need about five.

## Why it matters

Tournament organizers operate under time pressure — opening registration, fixing a schedule, entering scores from the field. Help that requires leaving the page, scanning a slideshow, and guessing which of two near-identical topics to read actively slows them down and drives avoidable support questions. Better-structured, in-context help should let an organizer answer "what do I do next?" and "what does this control/status mean?" in seconds.

## The three help needs (the organizing idea)

The redesign is built around three distinct moments, so each gets the right tool instead of one cluttered catch-all:

- **Reference** — "I know what I want, where's the answer?" → the guide pages.
- **Contextual** — "What does *this* mean, right now?" → tooltips / hint text / a "help on this page" panel.
- **Discovery & Orientation** — "Where do I start? What can this do for me? What will everyone experience?" → a new guided layer for first-time, non-technical organizers (see below). This is the need we serve worst today.

## Proposed direction (the redesign)

1. **Guide pages:** kill the slideshow — one scrollable article with a sticky, grouped table of contents that tracks where you are; questions move below the section they belong to.
2. **Content:** collapse the two filing systems into one workflow-ordered set of ~10–12 topics (down from 18); fold "recipes" into their subject topic as numbered steps.
3. **In-app help:** a consistent "?" entry point in every tournament page header that opens the relevant guide section right there, plus targeted hints/warnings on the highest-confusion controls; fix the touch-broken tooltip.
4. **Hub:** reduce to a prominent search + one clean grid of guide cards; demote the role paths to a "New here?" disclosure.
5. **Discovery & Orientation (new-user journey):** extend the setup wizard + draft dashboard across the *whole* lifecycle — a "what's next" cue that evolves from draft to game-day to wrap-up; gentle, dismissible "Did you know?" nudges that surface time-savers an organizer wouldn't think to look for (hand scorekeeping/check-in to volunteers, fan alerts, the Playoff Wizard) *at the moment they matter*; a "What your parents, coaches & volunteers will experience" panel so organizers understand the journey they're creating; and outcome-worded "I want to…" shortcuts. Anti-overwhelm is the hard rule throughout — one action at a time, just-in-time, never blocking, invisible to returning users.
6. **Accessibility & polish:** keyboard/touch/screen-reader fixes and token alignment.

> Full design for #5 is in §13 of the plan, including lifecycle map, mockups, and a two-step rollout (5a high-value/low-risk surfaces first, 5b persona panel + full nudge suite).

## Customer impact

- Organizers find the right answer by scanning or searching one page, not paging through a slideshow.
- Help is available *where the work happens*, without losing task context.
- New organizers get a clearer first-run path; returning organizers get fast answers to operational questions.
- Expected drop in repeat support questions about schedules, scores, registration statuses, publishing, and close-out.

## Priority & sequencing

High. Five phases, front-loaded for leverage: **Phase 1** (structural guide fix — biggest perceived improvement), **Phase 2** (in-context help on the work pages), **Phase 3** (hub simplification), **Phase 4** (accessibility/polish), **Phase 5** (first-run checklist + search gaps).

## Success criteria

- An organizer can find a relevant answer in under ~30 seconds, by scan or search, on one page.
- Every tournament admin page offers in-context help without navigating away.
- The tournament guide is one coherent set of ~10–12 topics on a single axis, fully scannable and Ctrl+F-searchable.
- Help vehicles are matched to moments per the pattern matrix; the contextual-help toolkit is consistent and touch/keyboard accessible.
- The pattern is reusable so other modules (house league, rep teams, accounting, org) can adopt it without rebuilding.

## Open decisions for the owner (see §10 of the plan)

Single-scroll vs. accordion for guides · in-context slide-over vs. simpler deep-link-in-new-tab · where role-path onboarding should live · tournaments-only now vs. all modules · reusable vs. tournament-specific setup checklist · whether to show a topic-count signal. These shape scope and are genuinely product calls — surfaced for decision before implementation begins.
