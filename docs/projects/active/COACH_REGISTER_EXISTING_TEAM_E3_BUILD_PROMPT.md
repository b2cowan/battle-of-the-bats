# Build prompt: Register Your Existing Team, E3, the join page's "New Team" warning (drawn first, then built)

> Paste into a fresh session on `dev`. Written 2026-10-19. Stages 1, 1b and 1c are on production (master jobs 280 and
> 281, `release/2026-10-18`); Stage 2 closed 2026-10-16 with no misfiled entries. **E3 was ruled 2026-10-16** (owner,
> "as recommended"; plan §15 Rulings): the coach claim page `/coaches/join` gives New Team the registration form's
> treatment, "New Team last, with the sentence saying it makes a separate team the portal won't show", in the next
> registration build, and it has been owed since. Do not re-open E1 to E3 or the hub's rejected option (hiding New Team).
>
> **The ruling set the direction. It did not set the shape on this page, the exact words beside it, or which coaches
> see it** (the page is a two-button pair, not the form's card list, so "last" has no literal meaning there).
> **So the first gate is a small drawing and three asks (H1 to H3) for the owner. The build follows their answers.**
>
> **Precondition: nothing to wait for. This is parallel-safe with Account-First Sign-up Parts 2 and 3**
> (`ACCOUNT_FIRST_SIGNUP_BUILD_PROMPT.md`); the files that decide it are in Precondition 1.
> **A production release is being promoted from `dev` as this is written. Commit locally on `dev`, and do NOT push
> until the owner says the release's staging sweep is done.** Commit only with the owner's explicit OK for that commit
> (explicit pathspecs, never `git add -A`).

## What the coach will see when this is done (put this to the owner first, in product words)

A coach with a Premium team opens the link in an organizer's email (the registration confirmation, resend access, the
chat sign-up reminder, and, on the free Tournament plan, the "team added" email that is the invitation) and lands on
**Choose Team Profile**. Today that page offers **Existing Team** and **New Team** as two equal buttons and says
nothing about what New Team makes. After this, one line sits directly under the pair, **visible before anything is
tapped**, in the registration form's own words: New Team makes a separate free team, and it won't show in the Premium
team's portal (named). A coach who can't register their Premium team (staff without the Register for tournaments
switch) or whose team is already in that tournament sees no pair today, only a **Continue** that quietly makes a new
free team; the same line goes above Continue for them. Free-team-only coaches and brand-new coaches see the page as
today. **Nothing is blocked and no choice is removed** (the owner chose a warning over hiding New Team): the line
says what the button costs, and the coach decides.

## Preconditions (check before any code; stop and tell the owner if one fails)

1. **The collision check with Account-First Sign-up Parts 2 and 3: parallel-safe for code; three shared files need care.**
   Checked 2026-10-19 against the prompt and plan (re-check `git status` and `git log -3 -- <file>` for each file
   below before starting; line numbers in this prompt are from `a673f321`).
   - **E3's files:** `app/coaches/join/page.tsx` (and, only if the drawing needs a class,
     `app/coaches/join/join.module.css`, the page's own module), `lib/registrable-teams.ts`,
     `components/public/RegisterContent.tsx` (one local function moves out, one import comes in),
     `tests/unit/registrable-teams.test.ts`, and one help article in `lib/help-content/coaches.tsx`.
   - **Parts 2 and 3's files:** `/auth/signup` and `app/api/auth/signup/route.ts`, `/start/tournament`,
     `app/api/org/create`, the onboarding plan route, the billing and league create routes, the Founding Season
     eligibility helper and `lib/start-door*.ts` (Part 2); `app/team/TeamSignupClient.tsx`,
     `app/api/auth/team-signup/route.ts` and the Coach Premium claim `/coaches/claim/[token]` (Part 3). **That "claim
     link" is not `/coaches/join`**: the Account-first plan's scope section lists the join page as out of scope
     ("already ask for the account alone"), and no Account-first commit has touched `app/coaches/join/page.tsx`
     (its last commits are `80f25c09` Verify Every Sign-up, then `d82c4118`).
   - **No source file is in both lists.** Three things are shared in a way that bites:
     1. `lib/help-content/coaches.tsx`: Parts 2 and 3's `/docs` will edit other articles in it (first login,
        confirm-email FAQ). Run `git diff -- lib/help-content/coaches.tsx` before staging; stage only your own hunk
        (temp index or HEAD plus your exact edit; `memory/reference_partial_commit_shared_tree.md`), never the file whole.
     2. `TODO.md` and `docs/projects/active/OWNER_QA_LEDGER.md`: every session adds a § and a line. Take the next free
        § **at the moment you write the ledger entry** (last at writing: §340, so §341 unless another session took it).
        Same partial-commit rule.
     3. `tests/unit/signup-verification-guard.test.ts` lines 108 to 121 read the join page's source, and Parts 2 and 3
        edit that test. **Do not edit it. Keep its anchors true in the page:** `next: verifyReturnPath(),`,
        `<VerifyEmailSent tone="auth"`, `&verified=1\``, the exact line
        `if (verifiedParam && teams !== null && !teams.some(isChoosableTeam)) {`, `autoLinkRef.current ??= fetch('/api/coaches/basic-teams'`
        and `const linked = await autoLinkRef.current;`. If one of those tests fails for a reason that is not your edit,
        report it; do not fix another session's guard.
   - **Also do not add a rule to `app/(consumer)/auth/auth.module.css`.** The join page borrows its card styles from
     it and Part 2 will edit it for `/auth/signup`. Reuse `styles.footerText` the way the locked lines do (page lines
     442 to 446), or use `join.module.css`.
   - If `git status` shows another session's uncommitted edit in `app/coaches/join/page.tsx`, `lib/registrable-teams.ts`
     or `components/public/RegisterContent.tsx`, stop and ask. Never edit around another session's open file.
2. **The release.** Commit locally only. No push, no touching `master` or the release branch, until the owner says the
   staging sweep is done. Confirm the branch with `git rev-parse --abbrev-ref HEAD` before every commit.
3. **Read the code as committed.** Every reference below is from `a673f321` and will have moved.

## Read first (in this order)

1. `docs/projects/active/COACH_REGISTER_EXISTING_TEAM_PLAN.md`: §2 F4 (the original defect), §3 rulings, §14's last
   "Not covered" bullet (the join link), §15 "Where a misfiled entry can still come from" (the join page bullet,
   lines 699 to 715), "The recommendation" and "Rulings" (lines 738 to 769). **Two statements there are now stale;
   say so to the owner:** line 703 calls `d82c4118` "committed, not yet on production". It shipped in master job 281 on
   2026-10-18 (confirm in `reference_prod_release_history.md`), so the free plan's invite-only events are live and
   this page's traffic is real. And lines 704 to 706 (the pair, with the list starting on "Select a team") describe
   only half the page; see "What the code does" below.
2. The hub, https://claude.ai/artifact/9Q9j9rn3cLxXFYt64xmEmm. Tabs: Walk, QA walk, QA walk 1b, QA walk · one entry,
   Stage 1, Stage 1b, **Stage 2 · Misfiled entries** (the E3 finding and the three Stage 2 asks), PM Brief, Full Plan,
   Decisions. The repo copy `docs/projects/active/COACH_REGISTER_EXISTING_TEAM_HUB.html` was saved 2026-10-16 22:10 and
   may be older than the live one; `.probe/reg-existing-hub*` no longer exists. Read the live copy with the Artifact
   `read` action, and read the whole saved file line by line with the Read tool before any republish (a node diff does
   not count).
3. `docs/projects/active/COACH_REGISTER_EXISTING_TEAM_PM_BRIEF.md` (the Stage 2 section) and the auto-memory file
   `C:\Users\b2cow\.claude\projects\c--Users-b2cow-Documents-tournament-website\memory\project_coach_register_existing_team.md`.
   `CLAUDE.md`, `AGENTS.md` (this change uses no Next API beyond what the page already imports) and `AGENCY_RULES.md`:
   plan first, product-manager summary first, disagree out loud, the one-spelling rule, status wording.
4. **The code, comments included** (they record owner calls and review findings the change must keep):
   - `app/coaches/join/page.tsx`: lines 64 to 69 (the lists), 71 (`linkMode` starts `'new'`), 140 to 152 (the
     verified auto-link, pinned by a guard), 157 (`setLinkMode('existing')` only when something is choosable), 265
     (the error), 381 to 464 (the signed-in card), 395 to 437 (the pair and the dropdown), 442 to 451 (the locked and
     already-registered lines), 458 (Continue).
   - `components/public/RegisterContent.tsx`: 414 (`portalTeams`), 920 to 927 (`differentTeamSentence`, the words to
     reuse), 1677 to 1692 (the picker and the comment recording the /design ruling: the sentence "must be visible
     without opening anything").
   - `lib/registrable-teams.ts` (pure; the header's "one computation, three readers" is the reason the sentence must
     live once) and `app/api/coaches/basic-teams/route.ts` (what the join page's cards carry).
   - `lib/basic-coach-teams.ts` `linkTournamentRegistrationToBasicCoachTeam` (line 580): `basicCoachTeamId: null`
     reaches `createBasicCoachTeamForRegistration` at line 673, which is exactly what New Team and the no-pair
     Continue do. Account-first's `clearStartDoor` calls in this function are not yours.
   - `lib/help-content/coaches.tsx` article `faq-premium-register-elsewhere` (line 911; its last paragraph at 925
     already covers the claim email).
5. Per the repo's rule, **broad reading goes to a helper** (a census, or reading Account-first's plan against these
   files); the cited lines above are for you to read yourself. A helper's summary is a lead, not evidence: open the
   cited lines before building on it or telling the owner.

## What the code does (read at `a673f321`; verify, then state it to the owner)

- The pair (Existing Team / New Team) renders only when `basicCoachTeams.length > 0`, where `basicCoachTeams` is the
  choosable cards (`isChoosableTeam`: not locked, not already in this tournament). `linkMode` starts `'new'` and the
  effect flips it to `'existing'` when something is choosable. **The list starts on "Select a team", nothing chosen.**
- **When nothing is choosable but a Premium team is locked or already registered, there is no pair at all.** The page
  prints the locked line ("Brett Jackson (head coach) registers this team. Ask Brett …") and Continue, with `linkMode`
  still `'new'`: Continue makes a new free team with no warning. The plan's E3 text describes only the pair; this is
  the same trap by a second route, and the build must cover it (ask H3).
- `registrableTeams === null` (the list could not load) shows an alert and disables Continue. Keep that: with no list
  there are no portal teams, so no sentence and no guess.
- A coach whose entry is already linked never sees this card (`alreadyLinked` redirects, line 130).
- The subtitle reads "{entry name} will appear in your Coaches Portal." above both choices. After the fix it sits above
  a line that says New Team will not appear in the portal. Leave it as is, tag it UNCHANGED in the drawing, and let the
  owner say if the two contradict for them. The same page also says "Choose Team Profile" and "new team profile"
  (line 265) for what it calls New Team and what the sentence calls a "free team". Report that drift to `/marketing`;
  do not change it unless ruled.

## Before any code

Per `AGENCY_RULES.md`, give the owner the plain-language summary above, the task list, and **three things the plan did
not say**: the second route (the no-pair Continue), that the ruling's "last" needs a shape on a two-button pair, and
that `d82c4118` is already on production. Then run Gate 0. **Skip the drawing only if the owner's opening message waives
it in words** ("build it as recommended"); then record H1 to H3 as answered "as recommended" in the plan and go to Part A.

## Gate 0: a small drawing and three asks (H1 to H3), on the project's hub

One new hub tab, **E3 · Join page**, after "Stage 2 · Misfiled entries". The hub stays ONE artifact: update the same
URL, never a new one. Load the artifact skills the Artifact tool asks for. Build to the owner's standing rules:
true-size 390px phone frames plus one computer width, whole-screen before and after, NEW / CHANGED / UNCHANGED tags,
**every tag clickable with its note** (a hover title is not enough), the end state drawn (not today's look), and each
ask beside the drawing that answers it with one checkbox per option, a notes box and a paste-back summary. Parse the
hub's script data before publishing (one unescaped apostrophe in the JS data kills every tab; `.probe/hub-parse-check.cjs`
exists if still present). Run `/design` on the drawing BEFORE the hand-off, and `/marketing` on the composed lines.

**Screens (after the proposal; before = a capture of today's page if you can get one without writing dev data,
otherwise drawn from the code and labelled "drawn from the code, not captured"):**
1. A Premium head coach with ONE portal team: Existing Team chosen, the list on "Select a team", **the new line under the
   pair**. Plus the same screen with New Team tapped (the line stays; the list goes).
2. A Premium coach with TWO portal teams: the plural wording.
3. A coach whose only Premium team is locked (or already in this tournament): **no pair, the locked line, and the new
   line above Continue**.
4. A free-team-only coach and a brand-new coach: a one-line "no change" tile, not a screen.

**The asks (recommendation first, "what rides on it", other options listed):**
- **H1 · Where the line goes.** Recommend: **one line directly under the Existing Team / New Team pair, always
  visible**, beginning with the choice's name in bold so the sentence reads on its own:
  "**New Team** — Makes a separate free team. It won’t show in your Milton Bats U13 Purple portal." Reason: the form's
  own /design review ruled that this sentence must be visible without opening anything, and a half-width button
  (well under 200px on a 390px phone) cannot carry it. Other options: restyle the pair as the form's two radio cards
  (closest to the form, rebuilds the block); put the sentence inside the New Team button (cramped).
- **H2 · The words, and one label.** Recommend: **the form's sentence verbatim, from ONE function both screens read**
  (one portal: "Makes a separate free team. It won’t show in your {Name} portal.", or "the {Name} portal" when the team
  is locked; two or more: "Makes a separate free team. It won’t show in any of your Coaches Portals."), and **keep the
  label "New Team"** (it pairs with "Existing Team", and the ruling named it). Say plainly that the form and the help
  article call the same choice "A different team"; that is a two-names drift the owner should see, and renaming here
  is the other option. `/marketing` may prefer a lowercase "makes" after the bold name; that is a copy call, and the
  function can return it either way.
- **H3 · When it shows.** Recommend: **whenever the coach has at least one portal team of any kind** (choosable,
  locked, or already registered here), because that is when New Team or Continue cuts the entry off from a portal;
  and **in the no-pair case, the same sentence above Continue**, led by "**Continue**" instead of "**New Team**".
  A free-only or brand-new coach sees nothing new (a second free team costs them nothing; the form's none-variant
  "separate from the ones above" is a card sub-line and does not fit here). Other options: show it to everyone
  (the form's none-variant too); block Continue in the no-pair case (the owner has already chosen warn over block,
  so only on request).

Then **stop** and hand the owner the hub link, the plain-language summary, and the H1 to H3 paste-back instructions.
Do not build before they answer. Save the republished source over the repo copy of the hub and say so.

## Part A: the build (after the answers; the code below assumes the recommendations, so adjust to the rulings)

1. **One sentence, one home.** Move `differentTeamSentence` out of `components/public/RegisterContent.tsx` (lines 920
   to 927) into `lib/registrable-teams.ts` as a pure function of the portal cards
   (`Pick<RegistrableTeam, 'name' | 'locked'>[]`), **byte-identical output for the form** (the curly apostrophe is
   U+2019; the none-variant stays for the form). The form imports it; its call at line 1690 stays. Update the file
   header's "one computation, three readers" so the sentence is named as shared.
2. **The join page** (`app/coaches/join/page.tsx`): beside lines 67 to 69, `portalTeams = (registrableTeams ?? [])
   .filter(t => t.isPortalTeam)`. Render the line per H1, H2 and H3: under the pair inside the existing
   `basicCoachTeams.length > 0` block (after the grid that closes at line 418), **not inside the `linkMode ===
   'existing'` branch**, so it shows before and after any tap; and, when `basicCoachTeams.length === 0 &&
   portalTeams.length > 0`, after the locked and already-registered lines (after line 451), above the error and
   Continue. Nothing renders when `portalTeams` is empty. No API change: the cards already carry `name`,
   `isPortalTeam` and `locked`, and the claim's GET marks `alreadyIn`.
3. **Leave alone:** `linkMode`'s default and line 157; the verified auto-link branch (lines 140 to 152); the Select a
   team requirement; `handleLinkSubmit`; the server (`linkTournamentRegistrationToBasicCoachTeam` and the basic-teams
   POST, including `d82c4118`'s refusal). **No default team is chosen for the coach** (the form preselects a lone
   portal team, but a claim carries an entry name that may belong to a different team than the Premium one, so a
   default could misfile the entry the other way; if the owner wants it, that is a new ask).
4. **Words.** Customers read "registration" on public pages, never "entry"; Title Case buttons as the page has them;
   `npm run check:spelling` applies. Every new customer sentence past `/marketing`.

## The guard (unit, mutation-checked)

In `tests/unit/registrable-teams.test.ts`, one `describe` for the shared sentence:
- the function's output, exact text, for one open portal ("your"), one locked ("the"), two or more, and none (the form's
  variant); compare against literal strings so a character change fails;
- **both screens read the one function and neither holds the words:** `RegisterContent.tsx` and the join page both import
  `differentTeamSentence`, and neither file contains `Makes a separate free team`;
- **the join page renders the line outside the `linkMode === 'existing'` branch** (source order: the line's element
  precedes `{linkMode === 'existing' && (`), and again in the no-pair case after the locked lines and before Continue.

**Mutation-check each, revert each:** change a word in the shared sentence (the form's guard and the join's both fail);
move the join line inside the `linkMode` branch (fails); paste the sentence literally into the join page (fails). Show
the failing assertion for each.

## Checks

- `npm run verify:changed`. It stops at `npm test` if other sessions' tests fail: run the remaining steps by hand and
  report the failures without fixing them. Watch `signup-verification-guard`, `coach-register` and
  `public-stats-guard`, which read `RegisterContent.tsx` or the join page.
- `npm run typecheck` (a shared lib module with three readers changes), focused lint
  (`npm run lint:focused -- <files>`), `npm run check:spelling`.
- **The join page is not in the layout catalogue**, so `check:layout --changed` has nothing to measure. Measure with a
  Playwright probe at 390 and 1280, in the page's themes: the line wraps without a horizontal scroll; the card still
  clears the fixed top nav (`join.module.css`; the invariant at `scripts/check-layout-invariants.mjs` line 1126 is about
  this exact overlap); the 44px tap rows are unchanged. Ask whether another session is measuring first (one tester at
  a time). The probe reads; it writes no dev data.
- **Restart rule:** `lib/registrable-teams.ts` is a shared module, so `AGENTS.md` wants a dev-server restart before
  the owner's browser test (`npm run dev` only; stop the server before deleting `.next`). The working copy and dev
  server are shared with other sessions; ask the owner before restarting if another walk is running.
- Offer `/review` once (copy plus one moved function, low risk; ask it to check the form's text did not change by a
  character, the sentence is never hidden or invented when the list failed to load, and the pinned join anchors
  still hold). No `/simplify` offer: one function moved, nothing layered on. Then offer `/docs`: the registration help
  article `faq-premium-register-elsewhere` gains one sentence about the claim page's New Team and its line, with the
  article's `keywords` and `answerText` kept in step (the one-spelling rule covers them).

## Hand-off

- **A QA walk as a checkable tab on the SAME hub** ("QA walk · join page"), and its entry in the Owner QA Ledger as the
  next free § (re-check the tail before writing: §340 was last at writing). **One purpose: the join page says what New
  Team makes, and says it where the coach decides.** Checkboxes and a paste-back. Name the accounts, and verify each
  on dev (read-only) before writing a step:
  - **`uat-coach@uat-test-org.local` (Chris Hadley, head coach of the standalone teams):** open the claim link for an
    organizer-added entry carrying his email; the line names the portal(s), shows before any tap, stays when New Team
    is tapped; Existing Team then Continue is unchanged and lands on the portal's tournament page. Say which of the one
    and two portal wordings dev gives, and note that a team already in the tournament shows as the already-registered
    line, not a choice.
  - **`uat-asst-nomoney@uat-test-org.local` (Owen MacLeod, an assistant whose Register for tournaments switch is off):**
    the locked line, no pair, and the new line above Continue. **Do not press Continue** (it makes a free team).
  - **A free-team-only account:** name one after reading dev, or say none exists; the page is as today.
  - The registration form's "A different team" line reads exactly as before (the function moved).
  - A phone (390px) and a computer.
  The claim link needs a pending entry whose email equals the signed-in account's. **Dev email cannot reach UAT
  addresses**; build the URL by hand from the entry (`/coaches/join?registered=1&registrationId=<id>&email=<email>&next=…`)
  and say so. Creating organizer-added entries writes dev data: get the owner's go, name the rows (for example "E3
  Walk …"), and remove them after the paste-back, or reuse unclaimed ones. Mind one team, one entry: if the coach's
  team is already in the chosen tournament it shows as already registered, which is a different screen.
- **Records, anchored facts only** ("committed `<hash>` <date>", never "uncommitted" or "not on prod"):
  - plan: ladder row 2 (line 96) E3 "owed" becomes the anchored fact; a new §16 holding the H1 to H3 rulings **as the
    owner ruled them, adding nothing they did not rule** (the build's own calls listed separately), the walk, and the
    verification; correct §15's stale "not yet on production" sentence (line 703) with the production anchor;
  - PM brief: the Stage 2 section's second success criterion, anchored, plus three plain lines on E3;
  - `TODO.md`: the E3 line (line 463) is ticked and moved to Completed when verified; no file paths in the line;
  - the hub's Decisions tab (H1 to H3, dated) and strip; the Owner QA Ledger entry above;
  - the auto-memory: `project_coach_register_existing_team.md` (its description still says "OWED = join page New Team
    warning") and the matching clause of `MEMORY.md`'s index line for this project. Update both; do not touch the
    in-repo `memory/` directory.
- **Commit** only after the owner confirms: explicit pathspecs, partial staging for the shared files named in
  Precondition 1, `git show --stat HEAD` afterwards to confirm only your files landed (if a foreign file slipped in:
  `git reset --soft HEAD~1`, restore it from the index, re-commit). Local commit only; **no push** until the owner
  says the release's staging sweep is done.

## Do not

- Re-open E1 to E3, hide or remove New Team, or block Continue (warn, never block, unless the owner asks).
- Pick a default team for the coach on the claim page (see Part A, 3).
- Touch the server's claim or the registration API, `lib/basic-coach-teams.ts`, `app/api/coaches/basic-teams`, the
  verified auto-link, or `signup-verification-guard.test.ts`.
- Add a rule to `app/(consumer)/auth/auth.module.css`, or reword the page's "team profile" language unasked.
- Count misfiled entries again (E2: only on a report from a coach or organizer) or build a repair door.
- Change shared automation, hooks, database checks, or push.
