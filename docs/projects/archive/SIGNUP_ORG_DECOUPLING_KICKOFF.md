# Kickoff prompt for the next chat

> **ARCHIVED 2026-06-15** — this kickoff was executed; the decoupling was built on `feat/free-tier-coaches` (dev). Live status: `docs/projects/active/SIGNUP_ORG_DECOUPLING_PLAN.md` + `INVITE_RECONCILIATION_PLAN.md`. Kept for historical record only.

> Paste everything in the code block below into a fresh Claude Code chat in this repo. It points the new session at the full build spec and sets expectations.

```
Read docs/projects/active/SIGNUP_ORG_DECOUPLING_BUILD_PROMPT.md in full, then execute it.

That file is a self-contained spec to decouple user-account creation from organization
creation in the FieldLogicHQ signup front door. It has a "Decisions locked" section at the
top with owner-confirmed choices — build to those, not to any generic version:
  1. Branch hard on intent at /start (owners vs invited users see different paths; no
     universal interstitial; keep the owner flow feeling like ONE tight flow).
  2. Keep org creation BEFORE email verification (do not move it behind the verify gate).
  3. Protect the owner funnel as the priority — do not regress the common new-org path.
  4. Add the platform-admin cleanup surface for unverified users / empty orgs (most of the
     user side already exists in app/platform-admin/customer-users/ — reuse it; the gaps are
     a bulk "unconfirmed" filter and an empty-org indicator/filter on the orgs page).

This is the parent project's continuation — read docs/projects/active/INVITE_RECONCILIATION_PLAN.md
and memory/project_invite_reconciliation.md first for context (Phases 0-2 + minimal Phase 3
are already built on the feat/free-tier-coaches branch and ship the invite-reconciliation fix;
the minimal Phase 3 signup interstitial gets RETIRED once this decoupling covers the same case
— confirm parity before deleting it).

This is HIGH-RISK, auth-critical work. Follow AGENCY_RULES:
  - Present the PM UX summary + Implementation Plan BEFORE writing any code (blocking step).
  - Create/update the _PLAN.md + _PM_BRIEF.md pair in docs/projects/active/ and a TODO.md line.
  - Build on the feat/free-tier-coaches branch (or confirm with me first if you'd prefer a new
    branch). Never push to master.
  - Run npm run typecheck + lint:focused + verify:changed; offer /review (high-risk) after
    substantive changes. I (the user) do the browser testing.

ALSO resolve these two open items as part of your plan (surface them to me as explicit
decisions before building):
  (a) Cross-org accept guard: today neither accept path (POST /api/auth/invitations/[id] nor
      the accept-invite POST) checks for a pre-existing ACTIVE membership in another org, so
      accept can create a 2nd active membership. Decide: enforce one-org at accept/org-create,
      or formally allow multi-org? (The whole signup model assumes a user can hold multiple
      workspaces via /home, so this needs an explicit call.)
  (b) Invite-project Phase 4a (tiny, may already be done — check git): invite/route.ts one-org
      query should add .neq('status','invited') so a PENDING invite elsewhere doesn't
      false-block a legit invite (J10-001). If it hasn't been done on the branch yet, fold it in.

Start by reading the three docs, then give me the PM UX summary + plan. Do not write code yet.
```

## Notes for me (the owner) — not part of the paste

- Before that chat: the dev server needs a restart (new shared modules from the invite work) and migration 128 must be applied to prod before any master deploy. Neither blocks the next chat's *building* on dev, but don't deploy until both are handled.
- Phase 4a (the `.neq('status','invited')` fix) is tiny and standalone — I can also just do it on this branch now instead of deferring to the next chat. Decide which.
