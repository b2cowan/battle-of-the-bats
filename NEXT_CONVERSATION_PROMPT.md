# Handoff Prompt — Next Conversation

Copy and paste the block below as your opening message in the next session.

---

You are continuing the FieldLogic brand implementation for a Next.js tournament management
platform. The project is a multi-tenant sports tournament SaaS running on Next.js (App Router),
Supabase (Postgres + Realtime), and AWS Amplify. All code goes to the `dev` branch.

---

## Current Sprint Status

- Sprint 1 (Visual Foundation — Phases 1, 6, 7, 9): ✅ Complete
- Sprint 2 (Admin Command Center — Phases 2, 8): ✅ Complete
- Sprint 3, Phase 3 (Logic-Sync Bracket — public SVG bracket view): ✅ Complete
- Sprint 4, Phase 4 (Official Accounts — field scoring role): ⬜ NOT STARTED — this is your task

---

## Your Task

Plan and implement **Phase 4: Official Accounts** — a lightweight invite-based role that gives
field officials scoped access to score entry without exposing any admin functionality.

The full specification for Phase 4 is in `FIELDLOGIC_IMPLEMENTATION_PLAN.md` under
"Phase 4 — Official Accounts: Field Scoring Access."

---

## Mandatory Pre-Implementation Steps

Before writing a single line of application code, you MUST:

1. **Read `FIELDLOGIC_IMPLEMENTATION_PLAN.md`** — specifically Phase 4 and its checklist. Pay
   attention to the "What Was Learned from the Prototype" section — it contains confirmed facts
   about the write path, status enum, and field names that will save you from repeating mistakes.

2. **Read `lib/types.ts`** — confirm the current `OrgRole` type definition. The plan proposes
   adding `'official'` as a new role value alongside `'owner' | 'admin' | 'staff'`.

3. **Read `lib/api-auth.ts`** (or wherever `getAuthContext` is defined) — understand how role
   checks work today so the `official` layout guard uses the same pattern.

4. **Read `app/[orgSlug]/admin/layout.tsx`** — this is the existing admin auth guard. The
   Official route needs its own layout with a parallel but more restrictive role check.

5. **Read `app/[orgSlug]/admin/members/page.tsx`** (or equivalent) — understand the existing
   invite flow so the Official invite can reuse the same infrastructure rather than reinventing it.

6. **Read `app/[orgSlug]/admin/results/page.tsx`** — understand the existing desktop score entry
   page. The Official scoring UI wraps the same `updateGame` write path.

7. **Read `lib/db.ts`** — specifically `updateGame` (around line 477). Confirm that calling it
   with `status: 'completed'` triggers `advancePlayoffs`. The Official's FINAL action must go
   through a server action that calls `updateGame`, not a direct browser client write.

8. **Check `TODO.md`** for any open items that affect Phase 4 scope.

---

## After Reading — Write the Plan First

Before any code, you MUST produce a written plan that includes:

1. **Purpose of the phase** — what real operational problem does this solve, and for whom?
   Be specific: who are officials, what is their tournament-day workflow, and what does this
   feature change about that workflow?

2. **Enhancement details** — exactly what is being built:
   - DB changes required (role enum, migration)
   - Auth/invite flow changes
   - New routes and what each renders
   - How score writes flow from the Official UI through to the bracket and standings

3. **Goals and success criteria** — how will you know this phase is done and working correctly?
   What does an official's full journey look like from invite email to finalizing a game?

4. **Open decisions** — flag anything that requires a user decision before implementation
   (e.g., what games an official can see, whether officials are per-diamond or per-division,
   whether they can revert a score, etc.)

5. **Ordered task checklist** with file paths

Save the plan as `SPRINT4_PLAN.md` in the repo root. Add a one-line summary entry to `TODO.md`
linking to it. Then **stop and wait for user approval** before touching any application files.

---

## Key Rules (from AGENCY_RULES.md)

- All commits go to the `dev` branch. Never touch `master`.
- Do not modify `BracketBuilder.tsx` under any circumstances.
- Do not modify the public schedule page list view, pool inference, or tab logic.
- `TODO.md` is high-level only (one line per item, link to plan file). Detailed steps go
  in `SPRINT4_PLAN.md`.
- After implementation is approved and complete, mark the Phase 4 checklist items in
  `FIELDLOGIC_IMPLEMENTATION_PLAN.md` and update the Sprint status table.
