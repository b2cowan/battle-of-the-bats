# Prompt — Board Ready · fix A: the tournament-admin reads check "is a member" (sweep 3, findings 1 + 3) · **Opus**

> One session, pasted into a fresh chat (`/clear` first), **on Opus** (shared auth, wide blast radius). Written
> 2026-11-10. Report: `docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md` findings 1 and 3. Plan:
> `BOARD_READY_PLAN.md` §5 Stage 0a. Index: `BOARD_READY_PROMPTS_INDEX.md`. The owner asked for these fix sessions on 2026-11-10.

## The defect (proven on dev, same code on production)
A club's assistant coaches, scorekeepers and staff open tournament-admin routes that check only "is an active member":
- `GET /api/admin/communications` returns every announcement and email, with `emailRecipients` (the visiting teams' contact
  addresses), failed addresses and the sender.
- `GET /api/admin/tournaments` returns `select('*')`, including contact email and settings.
- `PATCH /api/admin/tournament-branding` takes `requireScoreFinalization` outside the `manage_branding` gate.
- Traced, not probed: `GET /api/admin/divisions`, `GET`/`POST /api/admin/org/startup-tasks`, and
  `GET /api/admin/members/[memberId]/assignments` (plain `getAuthContext`, which admits `invited`).

**Root.** Every accepted assistant-coach invite writes an **active, capability-less `role='coach'`** club membership
(`lib/assistant-invites.ts:592-600`). `getAuthContextWithScope` (`lib/api-auth.ts:337-362`) admits any active member, and
"no assignment rows" means unrestricted. The proof is `.probe/sweep3-prove.mjs`: `coach@dev.local` and
`j8-scorekeeper@dev.local` got 200 on all three routes. The sessions are minted by a sign-in link, so no password changes.

## Step 1 — the census, before any code (delegate it; check its cited lines yourself)
List **every** caller of `getAuthContextWithScope`, `getAuthContextWithRole` and plain `getAuthContext` under `app/api/admin/**`
and `app/api/official/**`, `app/api/scorekeeper/**`, `app/api/check-in/**`. For each, say whether a capability or role check
follows, and what it returns or writes. Then answer:
- Which screens do a `coach` row, an `official` and a `staff` member actually use through these routes? Their client code is
  the only legitimate caller. The scorekeeper and check-in screens must keep working.
- Does any Coaches Portal flow call an `/api/admin/**` route? For example tournament chat, coach registration, team links.

## Step 2 — choose the shape (give the owner a recommendation; don't ask a question with a conventional answer)
- **A. Shared:** a capability-less `coach` row fails `getAuthContextWithScope`/`WithRole`, and the Coaches Portal keeps its own
  resolvers. That closes the class for coach rows in one place, but officials and staff still need per-route gates.
- **B. Per route:** each read gets the capability its screen implies. `module_tournaments` is the floor, and communications
  needs `module_communications` or `send_communications`; `requireScoreFinalization` needs `create_tournaments`;
  startup-tasks POST is owner/admin; assignments GET uses the accepted-member helper plus `manage_members` (or self).
- The likely answer is **both**: B for the named routes, and A only if the census proves no coach-row caller depends on it.
  Argue from the census.

Before code: present the plain-language **UX summary** (AGENCY_RULES, blocking). Nothing visible changes for owners and
admins. A coach or scorekeeper who somehow opened those screens is now refused. Say which seats lose what.

## Step 3 — build, prove, guard
- A guard test in `tests/unit/` that fails the build when an `app/api/admin/**` GET returns rows behind a scope check with no
  capability check. Take the pattern from `team-reads-guard.test.ts`, kill-test it with mutants, and keep an explicit
  allow-list for routes that are meant to be open to every member.
- Re-run `.probe/sweep3-prove.mjs`: both probe accounts must now be refused on every route. Add an owner/admin
  control that still gets 200, and a scorekeeper check that its own score screen still works.
- `npm run verify:changed`, then `npm run typecheck`, because this touches shared auth. Restart the dev server before
  hand-off: `lib/api-auth.ts` is shared.
- Run `/review`, and apply what it finds.

## Hand-off
- Record the outcome under findings 1 and 3 in the report (`→ Fixed <hash> <date>`), and on the 🔒 TODO line. Put the hash
  in the report and on the TODO line only after the owner's yes and the commit.
- **No commit without the owner's yes.** Branch `dev`, explicit paths. TODO.md goes through a private index.
- A product-owner summary: what each seat can no longer open, what was checked still works, and what the owner should click
  to see it.
- If the census finds the same hole on a route outside the named list, fix it in the same unit of work. It is the same class.
