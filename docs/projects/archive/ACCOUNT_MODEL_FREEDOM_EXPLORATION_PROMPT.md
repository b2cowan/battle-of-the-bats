# Exploration Prompt — Account Model Deep Dive: user freedom vs. product simplicity

Paste this into a fresh chat. This is an **analysis project, not a build** — no code changes, no
migrations, no decisions recorded as final. The deliverable is a decision-grade analysis the owner
can ratify option-by-option.

---

You are running a **deep-dive analysis of how FieldLogicHQ manages user accounts** — what one
person can own, join, coach, and pay for — commissioned by the owner (2026-07-23, in their words):

> "I want to know the best balance we can strike with not making our product too complex but also
> allowing the most freedom for users. Should users be able to own 2 org subscriptions? Or be
> members of 2 orgs? Can we effectively allow these things without overcomplicating the user
> experience? Can a coach be a coach of 2 premium teams? How easy is this to manage from a billing
> perspective? How easy/hard from a support perspective (can we troubleshoot user issues applicable
> to 1 org and not impact another)? I want to ensure we offer freedom to our users (more
> subscriptions means more money) but also not ruin their user experience. This should also be
> marketed efficiently. Deep analysis; give me all recommended options with their trade-offs."

## ⚠ Standing decisions this analysis is ALLOWED to challenge (owner-sanctioned re-open)

Normally these are don't-re-litigate. The owner is deliberately reopening them **for this analysis
only** — treat them as the incumbent baseline, evaluate them honestly, and propose amendments where
warranted. Nothing changes until the owner ratifies; record any direction as **Proposed**, never
Decided.

1. `memory/decision_one_to_one_vs_multi_org` (auto-memory): single-org default, multi-org by
   exception, ONE home org per user (2026-06).
2. One-Premium-portal-per-coach (2026-06-19 intent; enforcement was flagged during Founding Season
   Phase 3 and the owner explicitly questioned whether it's even right — the DB safeguard decision
   is PARKED awaiting exactly this analysis).
3. Free (basic) vs paid (rep) coach models stay SEPARATE with upgrade migration
   (`reference_coach_portal_arch_decision`) — likely stays, but its account-model consequences are
   in scope.

## Read first (in this order)

1. Auto-memory: `MEMORY.md` index → `decision_one_to_one_vs_multi_org`,
   `reference_coach_portal_arch_decision`, `project_founding_season_coaches_free` (the $0 comp is
   LIVE on prod as of 2026-07-23 — more free portals per person is now a real, immediate question),
   `project_coach_premium_upgrade_flow`, `project_coaches_portal_architecture`,
   `reference_coaches_org_context_seeding` (multi-org coaches ALREADY exist and have already caused
   a context-resolution bug), `reference_invite_auth_flow`, `project_tournament_coach_portal`
   (identity key = registration email matching — email-keyed identity is load-bearing),
   `project_role_flip_navigation` (multi-hat is now a first-class, shipped UX — the Roles popover).
2. `docs/agents/strategy/PLAN_PRICING_FACTS.md` — canonical plans/prices/gating. Reconcile every
   pricing statement against it; flag drift to /strategy, never restate numbers freshly.
3. `docs/agents/strategy/BUSINESS_DECISIONS.md` — the binding decisions log (D1–D4 founding season
   entries included).
4. Code reality (verify, don't trust docs): org membership + roles (`lib/roles.ts`,
   `lib/api-auth.ts`, org invite flows), the home-org / org-context resolution
   (`lib/org-context`, `lib/user-contexts` or equivalent), coaching assignments
   (`getCoachingAssignmentsForUser`, `rep_team_coaches`), team workspaces + entitlements
   (`team_workspaces`, `team_entitlements`, `lib/coach-team-page.ts` — note
   `team_workspaces.primary_owner_user_id` has NO uniqueness backstop today), Stripe billing
   (org subscriptions vs per-team subscriptions, `lib/billing-*`), platform-admin support tooling
   (what a support session can see/change per org), and the schema snapshot
   (`memory/reference_db_schema.md`) for the actual relationship cardinalities.

## The questions (expand each into evidence, then options)

**A. Current-state capability matrix (do this FIRST — it grounds everything).** For each persona —
org owner, org admin/staff, rep coach, free basic coach, standalone Premium coach, tournament-coach
(email-keyed), scorekeeper, fan/parent — establish what the code ACTUALLY allows today vs. what
policy says: Can they hold two org memberships? Own two orgs? Own two org subscriptions? Coach in
two orgs? Own two Premium team workspaces? Coach two rep teams in one org? What breaks or gets
weird when they do (context resolution, notifications, theme prefs, follows, billing portal,
The Flip's hat resolution)? Cite file/line or live-schema evidence for every cell. Distinguish
"blocked by code", "blocked by policy/copy only", "allowed and works", "allowed but buggy".

**B. The owner's freedom questions.** (1) One user owning 2+ org subscriptions; (2) one user as
member of 2+ orgs; (3) one coach with 2+ Premium teams (same org / different orgs / standalone
workspaces); (4) combinations (owner of org A + coach in org B — the multi-hat case The Flip
already serves). For each: who actually wants this (real personas — e.g. the club administrator who
also coaches, the coach with a kid on two teams, the tournament director serving two associations),
how common, and what revenue it represents.

**C. Billing manageability per option.** One Stripe customer per user vs per org vs per workspace —
what exists today; what each freedom option does to: checkout, the billing portal, receipts,
refunds scoped to one org, comp/promo handling (founding season comps are live), delinquency
(suspend one subscription without collateral damage), and the January 2027 manual conversion
runbook. Rate each option: trivial / manageable / expensive.

**D. Support isolation per option.** Can support troubleshoot org A without touching org B for the
same human? Audit: platform-admin tooling scope, impersonation/inspection paths, audit logging,
notification fan-out, and the email-keyed identity edges (same email on registrations in two orgs —
already partially handled by WI-2C same-org bridging; what breaks cross-org?). Name the support
runbook cost of each freedom option.

**E. UX complexity per option.** Where does multi-anything surface today (org switcher? coach team
picker? the Flip Roles popover? Account tab)? For each option: what NEW chrome/choices does it force
on users who have only one of everything (the 95% case)? Hard rule to evaluate every option
against: **single-everything users must never see multi-anything UI.** Assess against the shipped
one-account-wide theme preference, ONE home org, and the seeded-pin/follow model.

**F. Marketing & packaging.** How would each option be communicated efficiently (pricing page,
in-product upsells, plan copy)? Does per-team Premium multiplying per coach read as fair or as
nickel-and-diming? Is there a bundle story (e.g. second workspace discount, Club-includes-coaches
already exists)? Keep consistent with brand voice (`memory/marketing_brand_voice.md`) and route any
copy proposals through /marketing conventions.

## Method (ultracode expected)

Run this as multi-agent workflows: a parallel evidence sweep for the capability matrix (one agent
per persona/subsystem, structured findings with citations), an adversarial verify pass on every
"blocked/allowed/buggy" claim (these become owner-facing facts — they must survive refutation),
then an options-design round (2–3 independent option-set drafts judged for coverage/simplicity)
before synthesis. Do NOT skip the verify pass on billing and support claims — wrong facts there
poison the decision.

## Deliverables

1. `docs/projects/active/ACCOUNT_MODEL_FREEDOM_ANALYSIS.md` — the full analysis: capability matrix
   (evidence-cited), per-question findings, and **3–4 coherent OPTION PACKAGES** (not à-la-carte
   toggles — e.g. "Simple: one of everything, exceptions by support", "Freedom-with-guardrails:
   multi-membership free, multi-ownership allowed, one home org, per-workspace billing",
   "Full freedom") each scored on: user freedom, revenue upside, UX complexity for the
   single-everything majority, billing cost, support cost, build cost, migration/back-compat risk.
   End with a clear recommendation + the runner-up and why.
2. `docs/projects/active/ACCOUNT_MODEL_FREEDOM_PM_BRIEF.md` — plain-language brief (what changes
   for users, why it matters, what it earns, what it risks).
3. In-chat: the PM brief summary + a numbered **owner decision list** (each item phrased as a
   yes/no/pick-one the owner can ratify), including the parked one-per-owner safeguard as decision
   #1 since it's blocking a migration today.
4. After owner ratification: offer /strategy to log the decisions (Proposed → Decided) and update
   `decision_one_to_one_vs_multi_org` — do NOT log anything as Decided before ratification.

## Constraints

- **Analysis only** — no code, no migrations, no gating flips. TODO.md gets one summary line
  linking the analysis doc.
- Facts before options: every claim about "what happens today" needs a citation (file:line, live
  schema, or a traced flow). The adversarial-verify pass is not optional.
- Pricing/packaging statements reconcile against PLAN_PRICING_FACTS.md; drift → flag to /strategy.
- Write owner-facing sections in product-owner voice (UX and money first, mechanics in appendices).
- Founding-season context matters: the $0 comp is live, so "can I get a second free portal?" is a
  TODAY question, not a January one. Weigh options for both the promo period and post-January.
