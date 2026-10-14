# Build prompt — Register Your Existing Team, Stage 1 (every ask ruled)

> Run this in a FRESH chat on the `dev` branch. Every decision is ruled (owner, 2026-10-13: D1 and
> A1–A6, all as recommended). Do not re-open them. Build the server half first, then the screens, hand
> the owner a QA walk at the end, and **commit only with the owner's explicit OK for that commit**
> (explicit pathspecs, never `git add -A`; `[orgSlug]` paths need `:(literal)`).

## Read first (in this order)

1. `docs/projects/active/COACH_REGISTER_EXISTING_TEAM_PLAN.md`: findings F1–F7, the rulings (§3), Stage 1
   (§5), the design review (§7) and the build notes (§8). The rulings section is authoritative.
2. The hub, **the approved drawings**: https://claude.ai/artifact/9Q9j9rn3cLxXFYt64xmEmm (Stage 1 tab, the
   "Proposed" screens; read every tag's note by clicking it). Build to them. A drawing that cannot be built
   as drawn is a question for the owner, not a quiet change.
3. `docs/projects/active/COACH_REGISTER_EXISTING_TEAM_PM_BRIEF.md`.
4. What was built ahead of this stage (committed `eb150914` 2026-10-13): the register and join pickers
   offer a live Premium portal's twin (only the free team the portal points at) under the portal's current
   name, first (`lib/premium-team-labels.ts`, `labelLivePremiumTeams` in `lib/coach-team-page.ts`), and
   Sign In returns to a registration page on all three bars that carry it (`signInHrefFor` in
   `lib/consumer-routes.ts`, used by `ConsumerNav` and `Navbar`). Build on these; do not duplicate them.
5. The staff permission model: `lib/coach-capabilities.ts` (grants, presets, the head-coach rule),
   `lib/coach-staff-labels.ts`, `components/coaches/CoachStaffSheet.tsx` (`SENSITIVE`, `controlsFor`),
   `lib/coach-staff-delegation.ts` (the ceiling rules a non-head holder of Manage staff lives under).
6. `components/public/RegisterContent.tsx` and `app/api/register/route.ts`, comments included. The
   comments record owner calls and review findings (A4.3, A4.4, J6-035, J6-037, preview mode, file
   uploads) that the redraw must keep.

## Before any code

Per `AGENCY_RULES.md`, give the owner a short plain-language UX summary of what you are about to build
(the hub's screens, in words) and the task list, then start. Do not wait for a re-ruling of what is
already ruled.

## Part A — the server half

1. **The grant.** Add "Register for tournaments" as a staff grant: Sensitive group, directly under Run
   tournaments (A6). The head coach always holds it. The Team manager preset starts with it ON; Assistant
   coach, Team treasurer and Helper start OFF. Offered in a standalone Premium workspace only, like Run
   tournaments (a club's teams are out of scope). Name it in the one labels table, add its sentence ("Enter
   the team in other organizers' tournaments, from the tournament's registration page."), add it to the
   Team manager role's invite-email list of what the role grants, and make sure the delegation ceiling
   rules cover it like every other Sensitive switch.
2. **Existing managers get it (A3).** Every existing staff row whose role is Team manager, in a standalone
   Premium workspace, gets the grant ON. First establish how a staff member's role (manager vs assistant)
   is stored: `rep_team_coaches` carries `coach_role` (head/assistant) and `capabilities`; find where the
   kind ("Team manager") lives before writing anything. A data migration means the dictionary, the
   snapshots and the manual-prod-steps record in the same unit of work (`AGENCY_RULES.md`).
3. **Who may register a team (D1), one computation.** For a signed-in person: their free teams, plus
   every LIVE Premium team where they are the head coach or hold the grant, each offered through its
   free-team twin (resolve or create it with `resolveBasicCoachTeamIdForWorkspace`) under the portal's
   current name. Premium teams where they are staff WITHOUT the grant come back as **locked**, carrying the
   names and roles of the people who can register it (the head coach and every holder) for the greyed
   card. Today only the portal's primary owner belongs to the twin; this must not depend on twin
   membership.
4. **The server agrees with the form.** Attaching an entry to a Premium team's twin is allowed exactly
   when (3) says the person may register that team. Today `/api/register` and
   `linkTournamentRegistrationToBasicCoachTeam` check twin membership only. A staff member who registers
   must not be added to the twin as an owner as a side effect; check what the coach-side tournament
   record and chat need to show them the entry (the "your team in your own tournament" Part D bridge) and
   say what you found.
5. **The account check for Step 1.** One request: does this email have an account. Rate-limit it like
   sign-in. It reveals nothing today's form doesn't already reveal at Submit. A FieldLogicHQ staff email
   is refused the same way `/api/register` refuses it.
6. **After Submit**, a Premium entry lands on that portal's record for the tournament, not the free
   portal. Check where today's redirect sends a Premium coach before changing it.

Unit-test the computation in (3) and the server check in (4) without a database, the way
`tests/unit/premium-team-labels.test.ts` does.

## Part B — the screens (build to the hub)

1. **The registration form, email first (A1).** Steps "You · Team · Review". Step 1 asks only for an
   email; an email with an account asks for the password in place, with Forgot password returning to the
   form; an email without one goes to today's new-coach fields with the email filled in. A coach who is
   already signed in starts at Step 2. Keep the fan off-ramp, preview mode, closed and waitlist states,
   the organizer's custom questions and file uploads, the payment panel, and every failure-copy lesson in
   the current file's comments.
2. **Step 2, which team.** One card per team the person can register: Premium first, under the portal's
   name, tagged Coaches Portal, already chosen when it is the only one; free teams next; "A different
   team" last, saying it makes a separate team the portal won't show. Locked Premium teams render greyed
   with the people who can register them. These are radio rows with a sentence under each option, not a
   dropdown (§7 of the plan says why).
3. **The name in this tournament (A2)**: editable, filled in with the chosen team's name; Review shows it
   only when it differs from the team's name.
4. **Review** names the team the entry joins and says the tournament will show in that portal.
5. **The staff sheet** shows the new switch.
6. **The join page** (`/coaches/join`) uses the same team list. Give it the same data; keep its layout.
7. Public-page rules: 16px input text on a phone, 44px tap rows, Title Case buttons as the form has them.
   Run `/design` on the built screens at 390px and on a computer before the walk.

## Checks

- `npm run verify:changed`, focused lint, and `npm run typecheck` (shared modules change). On
  2026-10-13 three failures already sat in other sessions' work (coach-portal `.occGroupPermit` ink, the
  dark Months/scrollbar test, a `GuidanceRail.module.css` selector clash). Do not fix those; check whether
  they are still there and report.
- `check:layout --changed` on the registration page and the staff sheet.
- `/simplify`, then `/review`, before asking to commit.
- Offer `/docs`: the coach registration help and the staff-access help both change.

## Hand-off

- A QA walk as a checkable tab on the SAME hub (republish the hub's source,
  `.probe/reg-existing-hub.src.html`, through `.probe/reg-existing-hub-build.mjs`; if `.probe/` has been
  cleared, rebuild the tab from the published hub). Include a signed-out coach on a phone, a coach already
  signed in, a team manager, an assistant without the switch, a brand-new coach, and the staff sheet. Add
  its § to the Owner QA Ledger.
- Update the plan, the TODO line and the hub's stage strip with anchored facts ("committed `<hash>`
  <date>"), never "uncommitted" or "not on prod".

## Do not

- Re-open D1 or A1–A6.
- Build the misfiled-entry repair (Stage 2) or emailed-code sign-in (Later).
- Touch club teams' registration.
- Change shared automation, hooks or database checks.
