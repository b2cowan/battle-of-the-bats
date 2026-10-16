# Free coach header — the "registered / waitlisted" notice — build prompt

> Paste into a fresh session on `dev`. Written 2026-10-15. **A small build:** one writer, one help line, tests, a walk.
>
> **Where it comes from.** The free coach header build (committed `ad0267e4` 2026-10-15) put every notice the owner
> ruled into a free coach's bell except one: **"registered / waitlisted" from the public registration form.** That
> form's server route was open in the Register Your Existing Team session (Stage 1), and this project's rule is never to
> write inside another session's uncommitted file. The owner ruled on 2026-10-15 to commit without it ("commit") and to
> add it once that session commits. Plan of record: `FREE_COACH_HEADER_PARITY_PLAN.md` §8 ("Owed after it").

## What the coach sees (put this to the owner first, in product words, before any code)

When a coach registers their free team for a tournament through the public form (signed in, with the team picked),
**every other coach on that team** gets a bell notice on a computer:

- **"FCHP Otters is registered for FCHP Plus Cup"**, with *"Sent to FCHP Plus Club for review"* under it, or
- **"FCHP Otters is on the waitlist for FCHP Plus Cup"**, with *"Sent to FCHP Plus Club"*, when the entry lands on the
  waitlist.

The coach who pressed Submit gets nothing in the bell. Every sender follows the same actor rule, and that coach already
has the confirmation screen and the email. The help article "What shows up in my notification bell?" lists the kind
again.

## Preconditions (check before any code)

1. **Register Your Existing Team Stage 1 is committed.** `git log` shows it, and `app/api/register/route.ts`,
   `components/public/RegisterContent.tsx` and `lib/registrable-teams*.ts` are **clean** in `git status`. If the route
   is still modified by another session, **stop and tell the owner**. Do not edit around it.
2. **Read the route as committed.** Every line reference below comes from the 2026-10-15 working copy and will have
   moved.
3. **The free tournament tier build may be in flight** (`FREE_TOURNAMENT_TIER_BUILD_PROMPT.md`): it changes the public
   form for free events. If HEAD has changed how an entry is linked to a team or which statuses it can take, follow HEAD
   and say so in the UX summary.
4. **One browser tester at a time:** ask whether another session is measuring before any probe.

## Read first

- **`lib/team-coach-notices.ts`** — `notifyTeamCoaches`. It reaches every active coach on a genuinely free team
  **linked** to the registration, skips a Premium team's free shadow, skips paused accounts and demo clubs, honours
  `excludeUserIds`, and never throws. It is awaited by every sender (`reference_next_after_amplify`: `after()` drops on
  Amplify).
- **`lib/team-coach-notice-plan.ts`** — `TEAM_COACH_WORDS.registered` and `.waitlisted`, **already written and
  reviewed by `/marketing` (2026-10-13), and unused.** Do not rewrite them.
- **`lib/notification-labels.ts`** — `team_coach_registered` (one event type for both words): its label, description,
  the `know` category, and its place in `TEAM_COACH_EVENTS`. The icon is in `lib/notification-view.ts`. Nothing new is
  needed there.
- **The other senders, for the calling shape:** `app/api/admin/teams/route.ts` (accept, decline, payment recorded), the
  bulk registrations route, and the payment-reminders route.
- **`app/api/register/route.ts`, in this order:**
  1. the D1 check: a picked team must be one the signed-in person may register;
  2. the insert;
  3. `linkTournamentRegistrationToBasicCoachTeam`. It runs **only when the submitter is signed in with the coach
     email**. It links the picked team, or **creates a new free team**, and it swallows its own failure;
  4. the slot claim, which can turn the entry into a **waitlist** entry *after* the insert;
  5. the coach confirmation email (`isWaitlist`, behind `coachEmailEnabled(…, 'confirmation')`) and the club's
     `notify()`.
- **Memory:** `project_free_coach_header_parity`, `feedback_qa_walkthroughs_as_checkable_artifacts`,
  `reference_partial_commit_shared_tree`.

## The build

1. **The writer, in the register route.** It goes after **both** the link and the final status are settled, which means
   after the slot-claim and waitlist block, beside the confirmation email:
   - It runs only when the entry was linked: `data.id` exists, the submitter is the signed-in coach, and the link did not
     throw. **Track whether the link succeeded.** Without a link there is nobody to tell.
   - Call `notifyTeamCoaches({ registrationIds: [data.id], eventType: 'team_coach_registered', compose: isWaitlist ?
     TEAM_COACH_WORDS.waitlisted : TEAM_COACH_WORDS.registered, excludeUserIds: [signedInCoach.id] })`, awaited.
   - Put it **outside** the `coachEmailEnabled` check: the bell ignores the host's email switches (ruling A6).
   - Check that the notice opens where the other kinds open (the team's tournament page).
2. **Who it actually reaches.** Say all of this in the hand-off, because the owner will ask why a test registration
   lit nothing:
   - A coach registering a **brand-new** team: the link creates the free team and the submitter is its only member, so
     **nobody** gets a notice.
   - A coach registering an **existing** free team that has co-coaches: **the co-coaches** get it.
   - An entry filed under a **Premium** team (Register Your Existing Team B6): **nobody** here. Premium bells are not in
     this project.
   - Someone who registers **without signing in**: the entry is linked later, when they follow the email, so **nobody**
     hears at submit time. This is the same reason "added by the host" was dropped (plan §8).
3. **The help.** `lib/help-content/coaches.tsx`, the `faq-coach-free-bell` entry. At the 2026-10-15 commit the
   registration kind was taken out of the list (`<li>your team registered, or put on a waitlist;</li>` before
   `<li>accepted or declined;</li>`, now merged as `<li>your team accepted or declined;</li>`) and out of `answerText`
   (`your team registered or put on a waitlist, accepted or declined`). Put it back in both, and add `registered` and
   `waitlist` to `keywords`.
   ⚠ **The article introduces that list as "what organizers do with your team"**, but a registration is something a
   coach on the team does. Ask `/marketing` for the line, for example *"a coach on your team registering it, or it going
   on a waitlist"*, rather than restoring the old wording blind. Then offer `/docs`.
4. **Unit tests** (`tests/unit/team-coach-notices.test.ts`, 27 today): the waitlist status picks `waitlisted` and
   anything else picks `registered`; the submitter is excluded; an unlinked entry tells nobody. If the route's branch is
   awkward to test, pull the status-to-words choice into a small pure function. Do not build more structure than that.

## Not in this build

- Premium teams' bells (a follow-up question for the owner, never ruled).
- A notice when a waitlisted team is **promoted**: nothing sends one today.
- "Added by the host": the free tournament tier build turns that email into an invitation.
- The phone: its own design step (`FREE_COACH_HEADER_PARITY_PHONE_DESIGN_PROMPT.md`). Until it lands, these notices show
  only on a computer.

## Verification

- `npm run typecheck`, `npm run verify:changed`, and the unit tests.
- **`/review` at medium.** The lens to include: this route is public and partly unauthenticated, and it now writes
  rows into **other people's** bells. Can anyone make a notice land on a team they cannot register? (The D1 check, the
  signed-in email match and the link should all hold. Prove it from the code.)
- **End to end on dev, in the FCHP world** (`.probe/fchp-build/seed-fixture.mjs`; accounts `fchp-coach-a/b/c@dev.local`,
  password `devpass123`; Avery and Blair coach FCHP Otters). **The world has no open event that Otters is not already
  in.** Extend the seed with one, for example "FCHP Open Cup" with one open division and one full division, so that one
  submit registers and another waitlists. Check how the duplicate-team check scopes a repeat entry before you design the
  steps. The owner approved the FCHP world as this project's dev test data on 2026-10-13; say in the UX summary that you
  are extending it.
- **The owner's walk:** a new Owner QA Ledger section (the next free §) and a **W6** on the hub's QA tab. Edit
  `.probe/fchp/qa-data.cjs` and `build.cjs`, rebuild, parse the script, and republish to
  https://claude.ai/artifact/EA2D38WeFe9mk4Qji9535y. Never edit the built file. **One purpose:** *a co-coach hears
  that the team was registered, or waitlisted.* Steps go Do → You should see, with each account named, in this order:
  - Avery registers FCHP Otters through the form.
  - Blair's bell shows the notice.
  - Avery's bell does not.
  - The waitlisted case, the same way.

  Write every step against the code and quote the button labels exactly; a wrong label cost the last walk a round
  trip. Before recording a pass, read each writing step's row on dev.
- **Commit only when the owner says.** Work on `dev` with explicit pathspecs. The tree is shared, so build the commit
  in a temporary index and move the branch with a compare-and-swap (`reference_partial_commit_shared_tree` §7–8; guard
  every step with `|| exit 1`, because `set -e` did not stop a failed update-ref on 2026-10-15). Then update TODO and
  plan §8 with the hash.
