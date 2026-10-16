# Build prompt — Register Your Existing Team, Stage 1b (C1–C3 ruled)

> Run this in a FRESH chat on the `dev` branch. Written 2026-10-15. Every ask is ruled (owner, 2026-10-15: C1 and C3,
> and C2 the owner's own choice). Do not re-open them. Build the server half, then the screens, hand the owner a QA
> walk at the end, and **commit only with the owner's explicit OK for that commit** (explicit pathspecs, never
> `git add -A`; `[orgSlug]` paths need `:(literal)`).

## What the coach sees when this is done (put this to the owner first, in product words)

A coach signs in on a tournament's registration page and picks their Premium team. **They type no names.** The team's
head coach comes from the portal's staff list. Review shows **Head coach** ("From your Coaches Portal") and **Organizer
emails go to** (that head coach). When the team has two head coaches, Step 2 asks which one, from a dropdown. The
organizer's list, their emails and the public Teams page all name the real head coach, whoever pressed Submit, and the
organizer's emails go to the head coach. The person who registered gets the confirmation email, addressed to them.
Free teams and brand-new coaches work as today, except that a signed-in coach never sees name boxes.

## Preconditions (check before any code; stop and tell the owner if one fails)

1. **The free coach header session's "registered" notice is committed.** It edits `app/api/register/route.ts` too
   (`FREE_COACH_HEADER_PARITY_REGISTERED_BUILD_PROMPT.md`; on 2026-10-15 it was built on dev, waiting on the owner's
   word to commit). `git status` must show the route, `components/public/RegisterContent.tsx` and
   `lib/registrable-teams*.ts` clean. Never edit around another session's open file.
2. **Walk §312 (Stage 1 as built).** Read its state in `OWNER_QA_LEDGER.md`. If it is still open, ask the owner
   whether to wait: this build changes the Review step that §312 W1-7 and W3-4 check.
3. **Read the code as committed.** Every reference below is from the 2026-10-15 working copy and will have moved.

## Read first (in this order)

1. `docs/projects/active/COACH_REGISTER_EXISTING_TEAM_PLAN.md` §10–§12: findings G1–G4, the rulings (§11, the
   **Rulings** block is authoritative), the build notes, and the design review. §9 is what Stage 1 built.
2. The hub, **the approved drawings**: https://claude.ai/artifact/9Q9j9rn3cLxXFYt64xmEmm#stage1b. Build to these
   proposed screens, reading every tag's note by clicking it:
   - "2 · The portal names the coach": Step 2 with no name boxes.
   - "2 · Two head coaches": the C2 dropdown.
   - "3 · A manager registered" and "3 · The head coach registered": the Review rows.
   - "What the organizer sees": the values the organizer's record and public Teams page will show.
   - **Not** "2 · Nobody has your name". It is marked *not built* (C3).

   A drawing that cannot be built as drawn is a question for the owner, not a quiet change.
3. `docs/projects/active/COACH_REGISTER_EXISTING_TEAM_PM_BRIEF.md` (the Stage 1b section).
4. The code, comments included (they record owner calls and review findings the change must keep):
   - `components/public/RegisterContent.tsx`: the signed-in path's `nameFields` / `accountHasName`, the Review `dl`,
     `whoRow`, `submitRegistration`.
   - `app/api/register/route.ts`: the D1 check, the insert (`coach`, `email`), the link, the confirmation and
     notification emails.
   - `lib/registrable-teams.ts` (pure; `RegistrableTeam`, `PortalStaffMember`, `buildRegistrableTeams`,
     `whoRegistersSentence`) and `lib/registrable-teams-server.ts`. Its loader fetches staff names **only for locked
     cards**; open Premium cards now need their head coaches' names.
   - `resolveCoachUserIdentities` in `lib/db.ts`: a staff member's name is the club's name for them, else their account
     name.
   - `components/coaches/HeadCoachEditor.tsx` and `PATCH /api/coaches/tournaments/[teamId]`: the portal's own editor
     for an entry's head coach name and coach email. It is the model this build fills in at registration.
   - `lib/coach-email-rules.ts` (`resolveCoachRecipient`: `coach_email ?? email`) and `lib/email.ts`. The
     registration confirmation, waitlist, acceptance, rejection, payment, payment reminder and schedule-published
     emails greet `coachName`; `manualTeamRegistrationHtml` already falls back to "Coach".
   - `docs/agents/db/DATA_DICTIONARY.md` → `teams.coach`, `teams.email`, `teams.coach_email` (coach is nullable on
     both databases; absence is spelled NULL).

## Before any code

Per `AGENCY_RULES.md`, give the owner the plain-language summary above, the task list, and **the two proposals the
rulings do not cover**. Do not wait for a re-ruling of anything ruled.

- **When no name exists at all.** This happens only for a test account or one the platform team made by hand; no real
  account lacked a name on 2026-10-15. The entry's coach is the portal head coach's name when there is one, else left
  empty. It is never the email, because the public Teams page prints the coach. Greetings then fall back to "Coach".
- **The C2 dropdown starts with nothing chosen**, so the pick is deliberate. This is the drawing's reading of "picks".

## Part A — the server half

1. **The head coach on the card.** Each open card for a standalone live Premium portal carries its head coaches as
   `{ id, name, isYou }`, names only. Never send a head coach's email to the browser (Stage 1's /review kept emails off
   the cards for the same reason). `id` is something the server can check, such as the staff row's id.
   - Load the names with the same identity resolver the locked cards use.
   - A club-owned portal (`portal: null`) and a free team carry none. They keep today's behaviour: the registrant is
     the coach.
2. **The pick, one pure function.** Given a portal's staff, the registrant, and an optional picked id, return the head
   coach to record, or a refusal. The rules:
   - One head coach: that head coach, whatever is picked.
   - Two or more: the picked id must be one of them, otherwise refuse with a plain message ("Choose the team's head
     coach").
   - No head coach: fall back to the registrant.

   Unit-test it without a database, the way `tests/unit/registrable-teams.test.ts` does.
3. **`/api/register` records it (C1, C2).** For a standalone Premium card:
   - Re-read the head coaches from the same staff list the D1 check reads. Never trust a name from the browser.
   - Write `coach` = the head coach's name (NULL when none).
   - Write `coach_email` = the head coach's email when it differs from the registrant's.
   - Keep `email` = the registrant's. It remains the claim key.

   For a free team, "A different team" or a club-owned portal: `coach` = the signed-in account's name, or the typed name
   for a new coach, as today; NULL when there is none.
4. **The required-name check.** Today the route refuses a missing `coachName`. Keep that for the new-coach path (that
   form creates the account). Accept an empty one for a signed-in registration, which then follows (3).
5. **The emails.**
   - The registration confirmation (and waitlist) greets **the person who registered**, by their account name, else
     "Coach". It goes to them as today. When the head coach is someone else, it says the organizer's updates go to the
     head coach, by name.
   - The organizer's new-registration email shows the coach and, when that isn't the person who registered, "Registered
     by" with their name and email.
   - Every coach-facing template that greets `coachName` falls back to "Coach" when it is empty.
   - Put each new customer sentence past `/marketing`, as the free coach header build did.
6. **The free coach header's "registered" notice** (precondition 1) runs on the same route. Keep it working, and say in
   the hand-off what it now names.

## Part B — the screens (build to the hub)

1. **No name boxes for a signed-in person (C3).** Remove `nameFields` from the signed-in path, and with it the
   `accountHasName` branch and the "Enter your first and last name" check for signed-in submits.
   - "Registering as" shows the account's name, else the email. It no longer reads typed boxes (G4).
   - The new-coach form keeps its name boxes.
2. **Step 2, two head coaches (C2).** Shown only when the chosen card has two or more head coaches.
   - A dropdown labelled **Head coach \*** with the placeholder "Choose the head coach", listing names only, nothing
     chosen.
   - Required before Review.
   - The line under it as drawn: "Your team has two head coaches. The organizer sees the one you choose as your team's
     coach, and sends their emails to them."
   - A native select in the form's existing select style, as Division is (the pick-one rule, 2026-08-22).
3. **Review, as drawn:**
   - **Head coach**, with "From your Coaches Portal" under it. When the head coach is the person registering, it reads
     "(you)".
   - **Registered by**, with the email under it, only when the person registering is not the head coach.
   - **Organizer emails go to**: the head coach's name, "the head coach", or your own email when you are the head
     coach.
   - The after-note's second sentence: "You can change the head coach or where emails go from there."
   - Free teams and new coaches keep today's Review rows.
4. **Words.** Customers read "registration" on this form, never "entry". `npm run check:spelling` applies.
5. **Public-page rules.** 16px input text on a phone, 44px tap rows, Title Case buttons as the form has them. Run
   `/design` on the built screens at 390px and on a computer, in an organizer's dark theme and a light one (the owner's
   walk was on a dark event theme), before the walk.

## Checks

- `npm run verify:changed`, focused lint, `npm run typecheck`. If other sessions' tests fail, run the remaining steps
  by hand and report the failures without fixing them.
- `check:layout --changed` on the registration page. Ask whether another session is measuring before any browser
  probe (one tester at a time). The layout catalogue has no open-registration screen, so measure the form with a
  Playwright probe instead (`.probe/reg-stage1-look.mjs` is the Stage 1 one).
- `/simplify`, then `/review`, before asking to commit.
- Offer `/docs`: the coach registration help changes (who the organizer sees, no name boxes, the head coach pick).

## Hand-off

- **A QA walk as a checkable tab on the SAME hub.** Republish its source, `.probe/reg-existing-hub.src.html`, through
  `.probe/reg-existing-hub-build.mjs`. If `.probe/` has been cleared, rebuild the tab from the published hub, and read
  the live copy whole before publishing. Add the walk's § to the Owner QA Ledger. One purpose per walk.
- **The test accounts carry names** (2026-10-15): `uat-coach` is Chris Hadley, `uat-asst-money` Nadia Ferreira,
  `uat-asst-nomoney` Owen MacLeod, `uat-asst-treasurer` Grace Mensah. On the standalone teams those names show; the
  older UAT Test Team's club names ("UAT Coach") are unchanged. Cover:
  - the head coach registering a Premium team: no boxes; Review "Chris Hadley (you)";
  - the team manager registering: Review names Chris; the organizer's record shows Coach Chris Hadley and Coach's email;
    the public Teams page reads "Coach: Chris Hadley";
  - two head coaches: make a second one temporarily with Make head coach, pick them, check Review and the record, then
    restore;
  - a free team's registration, unchanged;
  - a brand-new coach, who still gives a name;
  - the portal tournament page's Head coach editor saying where organizer emails go.

  Dev email cannot reach the UAT addresses; say how each email was checked, or that it was not.
- Update the plan, the TODO line and the hub's strip with anchored facts ("committed `<hash>` <date>"), never
  "uncommitted" or "not on prod".

## Do not

- Re-open C1–C3, D1, A1–A6 or B1.
- Show name boxes to a signed-in person, or build saving a name to the account (C3 retired both).
- Keep the entry in step with the portal after Submit (plan §11, "deliberately leaves alone").
- Touch club teams' registration, Stage 2 (misfiled entries) or emailed-code sign-in.
- Change shared automation, hooks or database checks.
