# FieldLogicHQ Agent Playbook

A practical guide to working with your custom Claude Code agents — how to prompt them, when to use each one, and how to chain them together efficiently.

---

## What the Agent System Is

Each agent is a slash command (e.g. `/design`, `/ux`) that activates a specialised version of Claude pre-loaded with project-specific context — your design tokens, database schema, plan pricing, UX findings, and past decisions. Instead of re-explaining your project every session, you just invoke the right agent and it picks up where things left off.

**The key mechanic:** agents are stateless between conversations, but they read from persistent memory files on every activation. Design decisions, past findings, and project context survive across sessions through those files — not through conversation history.

---

## The Eight Agents

| Command | What it does | Best for |
|---|---|---|
| `/design` | Visual design review and token guidance | Screenshots, colour questions, spacing, component polish |
| `/ux` | User flow and completeness review | Empty states, error handling, loading states, role access gaps |
| `/billing` | Plan gating and Stripe guidance | Gated feature audits, upsell copy, new feature flags |
| `/db` | Supabase schema, queries, and migrations | Writing queries, new tables, RLS policies, migration SQL |
| `/plan` | Implementation plans and PM briefs | Starting any new feature, creating tracking docs |
| `/uat` | Playwright browser-based acceptance tests | Regression validation, finding bugs across both plan tiers |
| `/release` | Production release manager | Pre-flight checks, push dev→staging, promote staging→production, analyse failures, propose fixes |
| `/debug` | Screenshot and error investigation | Runtime errors, broken UI states, API failures, 500s, undefined values |

---

## How Conversations Work

### One agent per conversation (most of the time)

Each agent is designed to be the dominant context in a conversation. Mixing two agents in the same chat — e.g. running `/billing` then `/ux` — can work for short sessions, but on longer reviews the context gets cluttered and the agent loses precision. When in doubt, use a fresh conversation.

### Start each conversation with a handoff line

Since agents load fresh every time, tell them where you left off:

```
/ux — continuing tournament review; dashboard and teams pages done 
(see docs/active/TOURNAMENT_REVIEW_PLAN.md), working on schedule page today
```

The agent reads the plan doc, sees what's checked off, and continues without re-explaining the whole project.

### The plan doc is the thread between sessions

Always create a tracking doc via `/plan` before a multi-session effort. The plan doc is how findings from one agent session get picked up by the next. Without it, things fall through the cracks.

---

## How to Write Good Prompts

### The basics

A good agent prompt has three parts:
1. **The command** — which agent you're activating
2. **Context** — where you are in the project / what you were doing
3. **The ask** — what specific thing you want

```
/ux — tournament review, working on the teams page
what does an org admin see when there are no teams registered yet?
```

### Weak vs. strong prompts

| Weak | Strong |
|---|---|
| `/design can you look at this` | `/design [screenshot] — tournament dashboard, free tier; hierarchy feels flat, what's wrong?` |
| `/ux check this page` | `/ux review app/[orgSlug]/admin/tournaments/registrations/page.tsx — org admin role, check empty states and error recovery` |
| `/billing is this right` | `/billing audit all plan gates in the tournament admin section — looking for missing locks and incorrect free-tier exposure` |
| `/plan I need a new feature` | `/plan — create an implementation plan for adding email notifications when a team is approved for a tournament` |

### Key rules for each agent

**`/design`**
- Include a screenshot whenever you're talking about visuals — descriptions alone are ambiguous
- State which plan tier / user role the screenshot shows
- Say what feels wrong if you know (e.g. "feels cluttered", "hierarchy is unclear") — the agent will agree or push back

**`/ux`**
- Give the agent a **role** (org admin, coach, public visitor) and an **action** (registering a team, viewing the schedule)
- Pointing at a file path is often faster than a screenshot for code-level review
- Ask about specific failure scenarios: "what does the user see when the API call fails?"

**`/billing`**
- Specify which features or pages you're auditing
- Ask in terms of plan tiers: "should this be locked on the free tier?"
- When adding a new feature, ask: "what plan should this be gated to and how do I implement the gate?"

**`/db`**
- Always ask the agent to verify a column or table exists before writing a query
- Include the route context: "this is a server-side API route, org-scoped"
- Ask for the RLS policy alongside any new table migration

**`/plan`**
- Describe the feature in plain English — the agent handles the technical structuring
- Mention the plan tier if the feature is gated
- The agent will produce a PM brief first and won't start the implementation plan until you've seen it

**`/uat`**
- State which suite you want: `auth`, `plan-gating`, `tournament-admin`, `platform-admin`, or `coaches`
- The dev server must be running at `localhost:3000` before invoking
- After the run, the agent proposes fixes — you approve before anything changes
- Use `/uat fix` to re-propose fixes without re-running tests

**`/debug`**
- Paste a screenshot, a terminal error, a network response, or just describe what's broken — any combination works
- The agent reads source files before proposing a fix; it never guesses from a description alone
- Approve fixes with "apply all", "apply 1, 3", "explain 2", or "skip all" — same sign-off gate as `/uat` and `/release`
- Use it reactively when something is broken; for systematic flow review use `/ux` instead

---

## Agent Sequencing

For any significant piece of work, the recommended order is:

```
/plan → /billing → /ux → /design → /uat
```

**Why this order matters:**

1. **`/plan` first** — creates the tracking doc that all subsequent agents update. Without it, findings scatter.
2. **`/billing` second** — audits plan gating before you polish anything. A page with a broken gate isn't ready for visual review.
3. **`/ux` third** — reviews flows and completeness at the code level. Fixing structural issues before visual review means you're not polishing a broken skeleton.
4. **`/design` fourth** — now that the page works correctly for both tiers, polish the visuals. Decisions get logged and carry forward.
5. **`/uat` last** — final validation. Catches regressions from all the changes made in steps 2–4.

### When agents can be combined

Some combinations work well in a single conversation:
- `/billing` + `/ux` — both are code-only, no screenshots; fine for short reviews (3–4 pages max)
- `/design` + `/ux` — when you have a screenshot and want both visual and flow feedback at once

Never combine:
- `/plan` with anything — it needs a clean context to produce clean outputs
- `/uat` with anything — it runs tests and then waits for your approval; mixing in other work creates confusion

---

## The Tournament Review Pipeline

This is the concrete example of sequencing all six agents for a full section review. Use this as a template for any major review effort.

**The goal:** Iron out design, UX, and bugs in the 20-page tournament admin section, for both the free Tournament tier and the paid Tournament Plus tier.

---

### Step 1 — Create the master tracking doc

**New conversation → `/plan`**

```
/plan — create a tournament section review plan covering all 20 admin pages.
I want to audit design, UX flows, plan gating correctness, and bugs for 
both the free Tournament tier and the Tournament Plus tier.
Include a checklist matrix: one row per page, columns for billing gate check, 
UX review, design review, and UAT status.
```

Output: `docs/active/TOURNAMENT_REVIEW_PLAN.md` — your scoreboard for the whole quest.

---

### Step 2 — Audit billing gates

**New conversation → `/billing`**

```
/billing — starting a full tournament section review.
Audit all plan gating in the tournament admin section 
(app/[orgSlug]/admin/tournaments/**).
I want to know: which features are correctly locked to Tournament Plus, 
which free-tier pages accidentally expose Plus features, and 
which Plus-only pages are missing upsell messaging when accessed on the free tier.
Log your findings to docs/active/TOURNAMENT_REVIEW_PLAN.md.
```

---

### Step 3 — UX code review (no browser needed)

**New conversation per batch of 4–6 pages → `/ux`**

```
/ux — tournament review, billing audit complete (see TOURNAMENT_REVIEW_PLAN.md).
Starting UX code review. Review these pages for both Tournament and Tournament Plus states:
- app/[orgSlug]/admin/tournaments/page.tsx
- app/[orgSlug]/admin/tournaments/dashboard/page.tsx
- app/[orgSlug]/admin/tournaments/registrations/page.tsx
Check each for: empty states, loading states, error recovery, 
destructive action confirms, and role-appropriate messaging.
Update TOURNAMENT_REVIEW_PLAN.md with findings.
```

Start a new conversation for the next batch of pages. The plan doc carries findings forward.

---

### Step 4 — Visual design review

**New conversation per batch of screenshots → `/design`**

```
/design — tournament review, UX pass complete for dashboard and teams pages.
Starting visual design pass. [paste screenshot]
This is the tournament dashboard for a free-tier org admin.
The page loads correctly but the layout feels unbalanced — 
hierarchy isn't guiding the eye anywhere useful. What needs to change?
```

Batch tip: do all free-tier screenshots in one session, all Plus-tier screenshots in another. Decisions made in the first session carry forward automatically via `memory/design_decisions.md`.

---

### Step 5 — UAT validation

**New conversation → `/uat`**

Make sure `npm run dev` is running first.

```
/uat tournament-admin
```

The agent runs Playwright tests against both your free-tier org (`UAT_ORG_SLUG`) and your Plus org (`UAT_PLUS_ORG_SLUG`), reports failures, proposes numbered fixes, and waits for your approval before touching any files.

To apply specific fixes:
```
apply 1, 3, 5
```

To get more detail before deciding:
```
apply 2, explain 4
```

To re-propose fixes without re-running tests (e.g. after you've made manual changes):
```
/uat fix
```

---

### Closing out

Once all pages are checked off in the plan doc and UAT passes cleanly:

```
/plan — tournament review complete.
Mark TOURNAMENT_REVIEW_PLAN.md as done and move it to docs/archive/.
Update TODO.md to reflect this is complete.
```

---

## Sample Prompts by Agent

### `/design` — sample prompts

```
# General visual scan
/design [screenshot] — what are the top 3 issues with this page's visual hierarchy?

# Specific colour question
/design what token should I use for a "payment pending" badge background?

# Component review
/design review app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css — 
does the table styling match our established design system?

# Consistency check
/design [screenshot of new modal] — is this consistent with the modal patterns 
we've established on other pages?

# Continuing a multi-session review
/design — tournament visual review continued; schedule and teams pages signed off 
last session. Today doing the age-groups page. [screenshot]
```

---

### `/ux` — sample prompts

```
# File-based review (no screenshot needed)
/ux review app/[orgSlug]/admin/tournaments/registrations/page.tsx — 
org admin role; check all five flow states: happy path, empty, error, edge cases, recovery

# Role + action framing
/ux — what does a free-tier org admin see when they try to access the 
auto-schedule feature? Is the upgrade path clear?

# Specific failure scenario
/ux — what happens when the bulk team approval API call fails halfway through?
Does the user know which teams succeeded and which didn't?

# End-to-end flow trace
/ux trace the full flow for a team registering for a tournament — 
from landing on the registration page to receiving confirmation. 
What can go wrong and what does the user see at each failure point?

# Section audit
/ux — quickly audit all the empty states in the tournament admin section.
Which pages are missing them entirely?
```

---

### `/billing` — sample prompts

```
# Gate audit
/billing — audit the schedule page (app/[orgSlug]/admin/tournaments/schedule/page.tsx).
Is the auto-schedule feature correctly locked to Tournament Plus? 
Is the upsell message shown when a free-tier admin lands on it?

# Adding a new gated feature
/billing — I want to add a "clone tournament" button to the tournament list page.
Which plan should this be gated to, and walk me through the full implementation: 
type union, FEATURE_MIN_PLAN entry, server guard, and UpgradeGate wrapper.

# Upsell copy check
/billing — review the upsell messaging on the archives page. 
Does it match our plan naming conventions and value proposition?

# Downgrade behaviour question
/billing — if an org downgrades from Tournament Plus to Tournament, 
what happens to their sealed archives? Do they lose access or just visibility?
```

---

### `/db` — sample prompts

```
# Schema check before writing a query
/db — I want to query all teams for a tournament grouped by division and pool.
What columns are available on the teams table and what's the best join pattern?

# Writing a query
/db — write a Supabase server-side query that fetches all active tournaments 
for an org, including the count of registered teams per tournament.
This is in a Server Component, org-scoped.

# New table design
/db — I need a table to store per-tournament notification preferences 
(which events trigger emails, which contacts receive them).
Design the table, write the migration SQL, and include the RLS policy.

# Migration review
/db — review this migration SQL before I run it: [paste SQL].
Check for missing indexes, RLS gaps, and anything that could break existing queries.
```

---

### `/plan` — sample prompts

```
# New feature
/plan — I want to add the ability for org admins to set a registration 
open/close date per division, not just per tournament.
This should be a Tournament Plus feature.

# Review project
/plan — create a full review plan for the tournament admin section covering 
design, UX, billing gates, and bugs. 20 pages, two plan tiers.

# Status update
/plan — mark phases 1 and 2 of TOURNAMENT_REVIEW_PLAN.md as complete.
Billing gates audited and UX code review done for all tournament pages.

# Archive a completed plan
/plan — the tournament review is done. 
Move TOURNAMENT_REVIEW_PLAN.md to docs/archive/ and update TODO.md.
```

---

### `/release` — sample prompts

```
# Push local dev branch to staging (Amplify dev) — safe, no customer impact
/release dev

# Promote Amplify staging → production (safe: uses remote ref, ignores local branch)
# Use this instead of /release master to avoid accidentally picking up uncommitted local work
/release promote

# Push local dev branch directly to production — use only when you know local = staging
/release master

# Pre-flight only — check TypeScript and sync without pushing
/release preflight

# Fetch CloudWatch logs after a failure and propose fixes
/release fix logs dev
/release fix logs master

# Paste an error from the Amplify console directly
/release fix [paste build or runtime error here]

# Check if AWS CLI is configured and what access you have
/release setup

# Print safe revert instructions (never auto-executes)
/release undo
```

**Recommended deploy flow:**
```
/release dev      → push local work to Amplify staging
                    verify in browser
/release promote  → promote the staging build to production
```
This ensures production always receives exactly what was built and verified in staging — no local branch state involved.

---

### `/debug` — sample prompts

```
# Screenshot of a UI error
/debug [screenshot] — clicking Save on the teams form returns a 500; nothing shows in the UI

# Undefined value shown in the browser
/debug [screenshot] — this badge shows "undefined" instead of the team name

# Blank page with no visible error
/debug [screenshot] — the schedule page is blank after loading; no error visible

# Paste a terminal error directly
/debug — TypeError: Cannot read properties of undefined (reading 'plan_id')
  at app/[orgSlug]/admin/page.tsx:42

# API returning the wrong status
/debug — app/api/admin/org/route.ts is returning 403 for org admin users; should not be blocked

# Silent failure (no visible error)
/debug [screenshot] — the modal opens but the Save button does nothing and there's no error

# Stripe / billing issue
/debug — the Stripe webhook is firing but the plan is not updating in the DB

# Browser console errors
/debug [screenshot of browser console] — these errors appear on the dashboard for a Tournament Plus org
```

---

### `/uat` — sample prompts

```
# Run the tournament suite
/uat tournament-admin

# Run plan gating tests (checks free vs. Plus access across all sections)
/uat plan-gating

# Full suite (takes longer — use after major changes)
/uat

# Re-propose fixes without re-running tests
/uat fix

# After reviewing proposals, approve specific fixes
apply 1, 3
# or
apply all
# or  
apply 2, explain 4

# Check setup if UAT env vars aren't configured
/uat setup
```

---

## Quick Reference

```
Starting a new feature?         /plan first, always.
Something looks wrong visually? /design + screenshot.
Flow or state missing?          /ux + file path or screenshot.
Feature gated correctly?        /billing to audit.
Writing a DB query?             /db to verify schema and get the query.
Something is broken in the app? /debug + screenshot or paste the error.
Validating after changes?       /uat [suite-name].
Push to staging?                /release dev → verify in browser.
Promote staging → production?   /release promote (safest path — ignores local branch).
Build failed on Amplify?        /release fix [paste error output].

Separate conversations:  /plan, /uat, /release (always alone)
Can combine sometimes:   /billing + /ux (code-only, short sessions)
Requires browser:        /design (screenshots), /uat (Playwright)
Code-only (no browser):  /billing, /ux, /db, /plan, /release, /debug
```

---

*This document covers the eight custom agents in `.claude/commands/`. 
For the full design token reference, see `memory/design_system.md`. 
For past design decisions, see `memory/design_decisions.md`. 
For open UAT findings, see `UAT_FINDINGS.md`.*
