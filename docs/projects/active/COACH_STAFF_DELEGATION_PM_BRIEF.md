# PM brief — Manage staff, delegated: a head coach can hand the Staff page to a manager

**Plan:** `COACH_STAFF_DELEGATION_PLAN.md` · **Hub:** `COACH_STAFF_DELEGATION_HUB.html` (artifact) ·
**Directed:** owner, 2026-09-13 · **Priority:** medium — no data exposure today; a real friction for
the team manager role shipped 2026-09-11, and a standalone team's only alternative is a second head
coach.

## What a head coach sees and does differently

- **One more switch on a person's access sheet — "Manage staff".** It sits in the Sensitive group,
  with money and family contacts, so turning it on asks you to confirm first. It is **off** for
  everyone by default.
- **A new Team manager starts with it on.** When you invite someone as a Team manager, the sheet
  shows Manage staff already on before you send — you can switch it off there, like any other
  starting grant. Managers you invited before this shipped are **not** changed; flip it for them
  if you want it.
- With it on, that person **can open your Staff page, invite people, change what others can open,
  resend or cancel invites, and remove someone** — everything you can do there, with three walls:
  1. **They can never touch a head coach.** Not your access, not your role, not remove you. Your row
     opens for them as read-only.
  2. **They can only hand out what they hold.** Everyday access (schedule, attendance, lineups,
     development, chat, scouting book, documents) they can give freely. Sensitive access — money,
     contacts, internal notes, emailing families, tryouts — only up to their own level. A manager
     who can't see internal notes can't give anyone internal notes.
  3. **They can't pass the switch on.** Only a head coach decides who manages staff, so you always
     know exactly who holds it.
- **"Make head coach" stays yours.** Roles — head coach or not — are only ever changed by a head coach.

## What a Team manager (or any granted person) sees differently

- **Staff appears in their Team menu** (desktop, phone bar, and the phone's More sheet) with
  **Invite someone** in the header. Today the page says "Only the head coach manages staff".
- Opening someone's access, **switches they can't hand out are shown but locked**, with the reason
  under each: *"You don't hold this, so you can't hand it out"* — or, on Manage staff, *"Only a
  head coach hands this out."* Everything else works as it does for you.
- Picking a role preset for someone (say, Treasurer) applies it **within their own level** and says
  so on any switch it had to cap — the sheet never sends something the team would refuse.
- Their **own row** opens read-only ("Ask a head coach to change it"). A head coach's row opens
  read-only ("Only another head coach changes a head coach").
- The footer has **Remove from team** but no **Make head coach**.

## What does not change

- Treasurers, helpers and plain assistants: no Staff door, exactly as today.
- Two head coaches, hand-over, the last-head-coach rule, the club admin's oversight page, the
  invite emails: unchanged. Nothing in the database changes shape — no migration, nothing to apply
  to prod separately.
- The coach demo sandbox has no staff rows and no narration about the Staff page, so nothing there
  goes stale.

## Why it matters

The team manager role exists to run the team off the field — money, forms, family emails. Inviting
Saturday's parent helper and chasing a lapsed invite is that job, and today only a head coach can do
it. The only way to hand it over is **Make head coach**, which also hands over every family's contact
details, tryouts, internal notes and the power to remove the head coach. A switch bounded by "only
what you hold" gives the manager the duty without the keys.

## Trade-offs made

- **Default off everywhere except the Manager preset.** Every other preset (Assistant, Treasurer,
  Helper) starts without it. Existing managers keep their current access — a preset is where access
  *starts*, and the master key is the one switch that should never widen by default.
- **The ceiling is about sensitive access, not everything.** A manager without Attendance can still
  give an assistant Attendance — it is a coaching duty, not a data exposure. Bounding everyday grants
  would have made the switch useless to exactly the person it's for.
- **Removal is allowed** for anyone who isn't a head coach. It's disruptive but reversible
  (re-inviting reactivates the same person). One line to flip if you'd rather keep removal head-only.

## One thing worth deciding separately (not built here)

There is **no record of who changed someone's access**, today or after this. With one head coach it
didn't matter; with a manager also editing access, *"who turned on Money for Marcus?"* has no answer.
Proposed follow-up: a "changed by …, date" line on each person's sheet. Logged on the hub's Decisions
tab as Proposed.

## Success criteria

- A head coach can grant Manage staff to a manager and the manager can invite a helper end to end
  without the head coach — and cannot widen anyone's money, contacts, notes, email or tryouts access
  past their own, cannot touch a head coach, and cannot pass the switch on (QA §179, parts A–E).
- Treasurers and helpers still see no Staff door.
- No migration; no demo drift; help article answers "can someone else manage my staff?" in one Q.
