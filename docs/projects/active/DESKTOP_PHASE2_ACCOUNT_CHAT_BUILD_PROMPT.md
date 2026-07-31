# Build prompt — Desktop Phase 2: Account two-column + Chat split-pane

> Paste as the opening message of a fresh chat. Self-contained by design.

---

Two desktop workstreams are **owner-approved to build** (ratified 2026-07-30). Set them up as a project —
plan doc, PM brief, mockups for approval — then build them.

## The two workstreams

### 1. Account becomes a two-column settings screen

**Why:** every other app screen widened to a 980px column in Phase 1. Account deliberately stopped at 720px,
because its rows are single-action bars (one label, one chevron) and stretching them across a wide screen
makes them *worse*, not better. That was recorded at the time as a stopgap, with the two-column screen named
as the real answer. **This closes a gap we knowingly left.**

**Shape:** section list on the left, content on the right. Candidate sections: Profile, Notifications,
Appearance, Get the app, Help. Buttons stop being full-width thumb targets on a desktop.

**Phones are unchanged** — the current single stack is correct there.

### 2. Chat becomes a split pane on desktop

**Why:** Chat is the only screen still shaped entirely like a phone — a full-width conversation list that is
*replaced* by a full-width conversation. It's also the one screen that had to opt out of the new footer,
because it's a fixed-height panel with a pinned composer and there was nowhere to put one.

**Shape:** conversation list on the left, conversation on the right, the way every desktop messaging product
works. The conversation pane is the best-built responsive piece in the product — reuse it as-is rather than
rebuilding.

**Phones are unchanged.** Mobile chat keeps its one-pane-at-a-time flow.

**One caveat the owner accepted:** the original recommendation was to first check whether coaches use chat on
a computer at all. The owner approved building without waiting. Worth surfacing any cheap usage signal you
happen to find, but do not block on it.

## Explicitly NOT in scope

- **Multi-column Home — CLOSED.** Considered and rejected: the side column needs follows-per-account data to
  justify it, that data doesn't exist, and an empty second column is worse than no column. Do not revive it.
- **The desktop navigation rail — separate track.** Under its own investigation; do not build toward it here.
  Both of these screens must work with today's navigation untouched.

## Context you need

- `docs/projects/active/DESKTOP_PUBLIC_UX_PHASE1_PLAN.md` — Phase 1 is COMPLETE and committed
  (`9f1a605e`, `90dc58cc`, `515da826`), on `dev`, **not on prod**. Its Phase 2 section carries these rulings.
- Proposal mockups: `claude.ai/code/artifact/f2b33b25-e051-4396-9dd2-a4b1c64e2bd4` — directional only, not a
  pixel spec. Produce your own mockups and get them approved before building.
- `AGENCY_RULES.md` (planning + PM-brief requirements, branch policy) and `AGENTS.md` (Next.js 16 caveat —
  read the bundled docs before writing code; this repo uses `proxy.ts`, never a root `middleware.ts`).

## Hard-won lessons from Phase 1 — read these, they will save you a cycle

1. **The recurring bug shape: a surface that paints its own background meeting one that doesn't.** This bit
   three times in three days — black gutters beside a centred column, a footer that rendered fully
   transparent, and a 96px black band above the footer. Every instance was invisible in dark mode and obvious
   in light. **Check backgrounds at every seam, in both themes, at several widths.**
2. **The consumer app's warm palette is published by the shell's wrapper.** Anything mounted outside that
   wrapper has none of those values and will render with no colour at all. If you compose the theme class,
   list *both* leaves — `composes` is not transitive in this bundler.
3. **Verify with computed styles, not screenshots.** Playwright reading real values caught things eyeballing
   missed; screenshots alone previously led to wrong fixes. Assert `≤900px` values against the *literal
   pre-change values* so "mobile untouched" is checked independently of what you wrote.
4. **The colour-token guardrail is at a zero baseline** across consumer, marketing and shared scopes. Use
   existing tokens; a new stylesheet must be registered to a scope or the coverage check fails.
5. **The primary-CTA ruling (2026-07-30, in `memory/design_decisions.md`) is binding:** ink chip = the main
   action on a screen you're already in; lime = reserved for conversion moments; olive = links, active tabs,
   the followed star. Account's lime "Create free account" stays lime.
6. **Several sessions share this one working copy and the `dev` branch.** Re-check the branch before
   committing, stage explicit paths only, and confirm with `git show --stat HEAD` that only your files
   landed. Shared files may need hunk-level staging.

## How I want this run

1. **Plan first.** A plan doc in `docs/projects/active/` plus a plain-language **PM brief**, per
   `AGENCY_RULES.md`. Cover both workstreams; they can ship independently.
2. **Mockups before code**, for both screens, desktop *and* phone (phone panels exist to show what stays the
   same). Wait for my approval.
3. **Then build**, one workstream at a time, each fully finished before starting the next.
4. **Verify** with computed-style checks including a `≤900px` no-change pass; run `npm run verify:changed`,
   and `npm run typecheck` if you touch anything shared.
5. **Offer `/simplify` then `/review`** before treating either as done, and `/docs` if a user-facing flow
   changes.
6. **Never commit without my explicit OK**, per commit.

Give me a plain-language UX summary — what a person sees and does differently — before any code. Report
outcomes honestly, including anything you couldn't verify.
