# Prompt — Board Ready · fix E: inside-club seat reads, including the two owner calls (sweep 3, findings 4 + 5 + seat smalls) · **Sonnet**

> One session, pasted into a fresh chat (`/clear` first). **Start only after fix A is committed.** It touches neighbouring
> tournament-admin routes, so build on A's census and guard, don't race it. Written 2026-11-10. Report:
> `docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md`. Index: `BOARD_READY_PROMPTS_INDEX.md`.

## The two owner calls — check that they are ruled before building them
Read the report's findings 4 and 5 for a `⚖ Ruled` line. **If either is not ruled, ask the owner first** (the
recommendation is below). Build the rest of this prompt either way.
- **Finding 4. The returning-player scan** (`GET /api/coaches/[orgSlug]/teams/[teamId]/development/continuity`) shows
  past-season guardian names, emails and birth dates with the Development permission only. Recommended: redact
  `prior.guardian*` and `prior.dateOfBirth` unless `rosterPii`, and keep the match itself working.
- **Finding 5. Tournament staff export** (`GET /api/admin/tournaments/[tournamentId]/registrations/export`, and `admin_notes`
  in `/api/registrations` GET). Recommended: the export, and the private admin notes in the screen read, need
  `manage_registrations`. Staff keep the team list they need for schedule and check-in.

## The rest (re-read each before changing it)
- **Scorekeeper feed** (`app/api/official/[orgSlug]/score/get-score.ts` ~L175-190, ~L310-312): stop sending
  `score_submitted_by_email` and venue notes. Check what the scorekeeper screen shows before removing game notes. If the
  screen uses them, keep them.
- **Venue permit file** (`app/api/admin/org/permits/document/route.ts` gate ~L34-48): non-money seats get the file, which can
  state the fee that their screens hide (owner ruling 2026-10-11 hides the cost). Limit the file to the Venue library's
  savers plus money seats. `?teams=1` on the permits list honours the group limit (`repGroupIds`).
- **Rep-team link to a tournament registration** (`app/api/admin/teams/rep-team-link`): add `repGroupScopeGuard`, as
  `our-teams` does.
- **Coach revoke of a family link** (`lib/family-access.ts` ~L353-368): since mig 453 the link is child-wide, so ending it
  from team A ends the parent's access on every team. Recommended: the coach's revoke ends only that team's connection,
  or the confirm window says plainly that it ends every team. If the wording route is chosen, `/design` checks the
  window first.
- **House-league registrations search** (`app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts` ~L37): strip
  `,()` and `.` from `search`, or filter in code.
- **Members:** an admin can no longer edit an owner row's display name and title; `members/invite` pages past 1,000 users
  in `listUsers`; the existing-account branch that adds a member as active with no acceptance is a **consent call for the
  owner**, so record it and ask. Don't change it unasked.

Before code: present the plain-language **UX summary** (AGENCY_RULES, blocking). Name each seat that loses a read.
Help-docs sync: offer `/docs` (coach permissions help, tournament staff help, the Members help).

## Prove, guard, hand off
- A dev probe per seat: an assistant without `rosterPii`; tournament staff; a scorekeeper; a group-limited admin. Each loses
  exactly the named read and keeps its screen. Extend fix A's guard where the class matches.
- `npm run verify:changed`; `npm run typecheck`. Restart the dev server if a shared module changed.
- `/review`; apply what it finds. `/legal` if the family-link revoke wording changes what a parent is told.
- Record `→ Fixed <hash>` / `⚖ Ruled` in the report, update the existing sweep-2 owner-call TODO line (the returning-player
  scan) and the 🧹 third-sweep line, after the owner's yes.
- **No commit without the owner's yes.** Branch `dev`, explicit paths, TODO.md through a private index.
- A product-owner summary.
