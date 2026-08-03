# Phase B build prompt — "each section teaches itself"

> Paste this into a fresh chat, or point the new session at this file.
> Parent plan: `docs/projects/active/COACH_ONBOARDING_QUIET_MODE_PLAN.md`
> PM brief: `docs/projects/active/COACH_ONBOARDING_QUIET_MODE_PM_BRIEF.md`

---

## The job

Make every premium coach-portal section explain itself at its own empty state, so a coach learns
what a feature is and what it unlocks **at the moment they're curious about it** — when they open
it and find it empty — rather than from a checklist on the dashboard.

This is **Phase B** of Coach Onboarding Quiet Mode. Phase A shipped (commits `85d2a015` +
`8d07e7fb`, on `dev`, owner-QA'd). Phase C (the one-time tour) is not started.

**This is mostly a writing job, not a building job.** The component you need already exists. Read
`components/coaches/CoachEmptyState.tsx` first — including its decision rules in the header comment
(full card vs compact vs quiet vs "keep a plain `<p>`"). Do not build a new empty-state component.

---

## Why this exists (don't re-litigate)

The premium Overview used to lead with a full-width setup panel carrying a row of unlabelled chips
("Chat", "Development", "Insights") as its entire feature-discovery mechanism. A chip cannot tell a
coach whether they care about Development. Phase A shrank the panel to a header control and a
one-line prompt; the chips survive **inside that control as a placeholder** and are Phase B's to
retire.

Teaching in place also works for coaches who never saw a setup panel at all — someone joining a
team mid-season, an assistant, a coach on their third team.

---

## The contract — every section's empty state says three things

1. **What it is** — one plain sentence. No jargon, no feature-marketing.
2. **What it unlocks elsewhere** — the cross-section payoff. *This is the sentence that matters and
   the one the chips could never carry.* "Lineups feed game sheets and attendance automatically,
   and Insights uses them to track playing-time fairness."
3. **What's blocking it** — the honest prerequisite, if any. "You'll need players on your roster
   first."

Then **exactly one** primary action, and one quiet link into the fuller guide via the help drawer.

Worked example (Lineups, empty, no roster yet):

```
┌─ Lineups ───────────────────────────────────────────────────┐
│                        ⊞                                    │
│         Build a batting order and field positions           │
│         once, then reuse it game to game.                   │
│                                                             │
│         Game sheets and attendance fill in from it          │
│         automatically, and Insights uses it to track        │
│         playing time fairness across the season.            │
│                                                             │
│         You'll need players on your roster first.           │
│                                                             │
│         [ Add players → ]      [ How lineups work ⓘ ]       │
└─────────────────────────────────────────────────────────────┘
```

---

## Sections in scope

Audit each one's current empty state first — several already have a `CoachEmptyState`; the job
there is rewriting copy to the contract and adding the help link, not rebuilding.

**Tranche B1a — ship first.** These are the four the readiness review flagged as invisible, and the
ones the retired chips were failing to explain:
Lineups · Development · Insights · Chat

**Tranche B1b — the remainder:**
Roster · Schedule · Money (dues/budget) · Announcements · Documents · Staff · Tournaments · Tryouts

Sections not yet rewritten keep what they have — there is no intermediate broken state, so ship
tranche by tranche rather than in one drop.

**When B1a and B1b are both done:** remove the "Also in your portal" chips from the season-setup
popover on the team Overview (`app/[orgSlug]/coaches/teams/[teamId]/page.tsx`, the
`discoverySections` block) and the now-unused `DISCOVERY_SECTIONS` constant. Not before — deleting
them early opens a discovery gap.

---

## Hard constraints

**Capability gating — the lesson Phase A's review paid for.** Gate on the capability that lets a
coach **complete** the action, not the one that lets them **open the page**. Phase A shipped setup
steps that told assistant coaches to "Add players" and sent them to a read-only roster, because
assistants never receive roster write. Before you put a CTA in an empty state, check
`lib/coach-capabilities.ts` for the grant that actually permits the action, and confirm the
matching API route's `denyUnless` gate agrees. `lib/coach-nav-visibility.ts` is the existing
source of truth for whether a coach can even see a section.

An empty state a coach cannot act on should say so plainly and drop the CTA — `CoachEmptyState`'s
`quiet` variant exists for exactly this.

**Reuse, don't invent.**
- `components/coaches/CoachEmptyState.tsx` — the component. Respect its decision rules.
- The help drawer (`useHelpDrawer().openHelp(...)`) for the "How X works" link. Content lives in
  `lib/help-content/coaches.tsx` — check what already exists before writing new guide sections.
- Existing icons come from `lucide-react`; the portal bans circles (see the component header).

**Styling.** Custom CSS modules only — no UI libraries. **No raw hex or brand `rgba()`** anywhere;
the colour-token guardrail is at a zero baseline across all 201 stylesheets and `verify:changed`
will fail you. Use the design tokens.

**Sport-neutral.** Score/period vocabulary and rules come from the Sport Pack (`lib/sports.ts`).
The example above says "batting order" because the dev org is softball — real copy must not
hard-code one sport's vocabulary where the Sport Pack should supply it.

**Help-docs sync.** This changes user-facing flows and terminology, so offer `/docs` when the
copy work lands — in-app guides are single-sourced in `lib/help-content/*.tsx` and drift is a
code-time problem, not a periodic sweep.

---

## Process expected in this repo

- **Present a plain-language PM summary before writing code.** Blocking step, per `AGENCY_RULES.md`.
- Work on the **`dev`** branch. Never `master`. Stage explicit pathspecs only — use
  `:(literal)` for `[orgSlug]`/`[teamId]` paths, since brackets are glob syntax and a plain
  `git add` on those directories silently stages nothing.
- **Never commit without explicit per-action approval from the owner.**
- ⚠ **Concurrent sessions share this working copy.** During Phase A another session's broad stage
  swept uncommitted work into its own commit. Re-check `git rev-parse --abbrev-ref HEAD` before
  committing and run `git show --stat HEAD` after, to confirm only intended files landed.
- Verification: `npm run verify:changed` and `npm run lint:focused -- <files>` for routine work;
  `npm run typecheck` if you touch shared modules. The owner does all browser testing.
- Update `TODO.md` (one line, linking the plan) and the plan doc as phases complete.
- Offer `/simplify` then `/review` before treating the work as done — that funnel caught five real
  defects in Phase A, including the assistant-gating bug above.

---

## Definition of done

1. Every section in scope explains itself at its own empty state, to the three-sentence contract.
2. No empty state offers a CTA the viewing coach's capabilities forbid.
3. The "Also in your portal" chips and `DISCOVERY_SECTIONS` are gone.
4. A coach who never opens the dashboard's setup control can still discover every section.
5. Gate green: `verify:changed`, focused lint, tests, all token baselines at zero.

---

## Out of scope

- The setup chip, the next-action line, or anything else Phase A shipped — that's done and QA'd.
- Phase C (the tour, and moving the two device-local coach preferences to account-level storage).
  Note Phase C also owns **C0**: extracting a shared popover primitive to retire the four
  hand-rolled copies now in the codebase.
- The free coach portal — it has a deliberately separate onboarding family (the two-family ruling:
  free = consumer "companion", premium = operator "HQ").
- Org-admin and platform-admin surfaces.
