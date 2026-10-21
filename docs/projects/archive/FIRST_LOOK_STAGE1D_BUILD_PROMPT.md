# The first look — Stage 1d build prompt: the top bar, one "Coach a team", the door links, Warm / Dark

Paste into a fresh session. Written 2026-10-19 by the session that built Stage 1a–1c. **This session builds Part 1d
only, then closes Stage 1** (the QA walk, the records, the docs offer).

## Where Stage 1 stands

| Part | What | Commit |
|---|---|---|
| 1a | The shared pieces + Start a team, Start a league season, Run a tournament (intro folded in, `/auth/signup` forwards in `next.config.ts`), step 2, the one check-your-email | `f45f7d019` |
| 1b | Coach Premium, both steps (R1), in one column for new / claim / upgrade / reactivation; the two-option control | `df295fdc6` |
| 1c | The account-only sign-up, both invitations, the coach join page (in the app's frame) | `658cb84e5` |

None is pushed. **The dev server has NOT been restarted since 1a.** `next.config.ts` (the `/auth/signup` forward) and
new files (`app/coaches/join/layout.tsx`) need a restart before anyone tests in a browser (AGENTS.md: stop the server
before clearing `.next`).

## Read first

1. `CLAUDE.md`, `AGENTS.md`, `AGENCY_RULES.md`: one `dev` branch, explicit pathspecs, **ask before every commit**,
   never push, the spelling and clock gates, "disagree out loud". Run `git status` first: the tree is shared.
2. `docs/projects/archive/FIRST_LOOK_STAGE1_BUILD_PROMPT.md`, sections **"The top bar, the phone tabs and the doors"**,
   **"Warm / Dark"**, **Keep**, **Verify**, **QA**. That is the spec; this prompt adds only what 1a–1c learned.
3. The drawings: hub https://claude.ai/artifact/AdLSGDCii8xExFuVdZxvsx (source
   `docs/projects/archive/FIRST_LOOK_SIGNUP_HUB.html`), *S1 · The account form* (the laptop's top bar) and *S1 · Dark*.
   The drawings' source is `.probe/first-look/build-hub.cjs` + `hub2.css` (the dark field edge is `#646b77`, about 3.4:1).
4. The shared pieces as built: `components/auth/AccountForm.tsx` + `.module.css` (StartColumn, StartHead, StartFoot,
   Field, EmailField, PasswordField, AccountFields, hintId, `accountForm` classes), `components/auth/StartSteps.tsx`,
   `components/auth/VerifyEmailSent.tsx`, `components/shared/ChoicePair.tsx`.

## Part 1d — what to build (owner rulings 2026-10-19, unchanged)

### 1. The consumer top bar and phone tabs: sentence case, "Get started ▾"
- `components/consumer/ConsumerNav.tsx` (desktop bar ~:372 renders `<StartMenu …>`; the tournament strip ~:420 renders a
  bare `<StartMenu />`) and `components/consumer/StartMenu.tsx` (button label "Run a tournament" ~:53; items: "Organize a
  tournament" → `/start/tournament`, group label "More ways to start", "Coach a team" → `coachHref`, "Join a team" →
  `/auth/signup?account=1`, "Run a league season" when `showLeague`).
- Ask 13: Home · Scores · Pricing · Sign in / Account in sentence case, T1 (`--nav-label-size`, 600, one 30px pill;
  `memory/design_decisions.md` 2026-08-01). The menu button reads **"Get started ▾"**; items **Run a tournament, Coach a
  team, Join a team, Start a league season** (beta only). Check the phone tab bar labels too (the captures showed
  "HOME · SCORES · SIGN IN" in capitals).
- The marketing bar already says Get started; do not touch the marketing Navbar.

### 2. One door per thing (rule 8, F14)
- **The one rule is `/start`'s `coachOption()`** (`app/(consumer)/start/page.tsx` ~:80): Coach Premium
  (`/coaches/start?source=start`) while checkout is open (`isCoachesPortalPurchasable()`) AND the Founding Season promo
  runs (`isFoundingSeasonPromoActive('team')`); else `/start/team` when checkout is open; else `/for-coaches`.
  `lib/start-menu.ts` `getStartMenuConfig()` returns `coachHref` from checkout alone — make it read the same rule
  (extract one shared function; `/start` and the menu both call it). It is consumed by `app/(consumer)/layout.tsx`,
  `components/consumer/CoachJourneyChrome.tsx` and `app/coaches/layout.tsx` (→ CoachPortalShell → ConsumerNav).
- **The coach demo's start button**: `components/sandbox/SandboxChrome.tsx` ~:803 (banner CTA) and ~:964 (blocked-save
  toast "Start free →") are hard-coded to `/auth/signup` for both demo kinds; `kind: DemoOrgKind` ('tournament' |
  'coach') is a prop there. Coach demo → the one coach rule; tournament demo → `/start/tournament`.
  `tests/unit/demo-sandbox-exit.test.ts` pins that `/auth/signup` counts as leaving the sandbox — check `/start/*` and
  `/coaches/start` do too (`lib/sandbox-exit.ts`).
- `/for-tournament-organizers`'s Tournament Plus card (`app/for-tournament-organizers/page.tsx` ~:288) keeps its plan:
  `?plan=tournament_plus&billing=monthly`, as `components/PricingSection.tsx` `getSignupHref` (~:325) builds it.

### 3. The door links skip the hop (Ask 6)
Census done 2026-10-19 — point these at `/start/tournament` (keep any `plan`/`billing`); **never** touch an
`/auth/signup?account=1` link (StartMenu "Join a team", `/start`'s invite aside, `app/(consumer)/account/page.tsx`
:112/:148, `app/(consumer)/auth/login/page.tsx` ~:258):
- `components/PricingSection.tsx` `ctaHref` for tournament, tournament_plus, league, club (:75, :116, :145, :177) — the
  plan rides on the URL via `getSignupHref`. League/Club are F08, Stage 3; pointing them at `/start/tournament` changes
  nothing (the forward goes there today).
- `app/pricing/page.tsx` :88 / :363 / :476; `app/for-tournament-organizers/page.tsx` :126 / :243 / :288 / :329 / :395;
  `app/for-clubs/page.tsx` :311; `app/for-leagues/page.tsx` :249; `app/platform/tournaments/page.tsx` :55 / :126;
  `components/marketing/WalkthroughPage.tsx` :120; `components/Footer.tsx` :45; `lib/user-contexts.ts` :394 (a
  fallback destination); `app/(consumer)/auth/signup-confirm/page.tsx` :33 is Stage 2's expired-link screen — leave it.
- ⚠ `tests/uat/scenarios/marketing-seam.spec.ts` ~:86 asserts `#org-plans a[href^="/auth/signup"]` count is 0 while a
  signed-in operator's state resolves. Once the pricing links move, that selector passes vacuously: widen it to
  `/start/tournament` too, in the same change.
- Re-grep after: `grep -rn "auth/signup" app components lib` should leave only `account=1` links, the API fetches, the
  page itself, and signup-confirm.

### 4. Warm / Dark (Ask 10)
- Today the start column pins warm: `components/auth/AccountForm.module.css` `.page` composes `warm warmVars` from
  `components/consumer/warmTheme.module.css`. Make it follow the setting the way `/auth` does: compose **`warmTab`**
  (it composes `warm warmVars`; Turbopack's `composes` is NOT transitive, so list all three), whose
  `:global(html[data-user-theme="dark"]) .warmTab` block remaps every `--home-*` token to the dark shell.
- Inside `/auth/*` the layout already wraps `warm.warmTab` + `authSurface`; the column nests another surface there —
  check the nested `warmTab` does not re-capture `--home-lime` as olive (the layout comment explains the trap;
  `--home-lime` is `var(--logic-lime-fixed)` in warmVars, which should be safe — verify on screen).
- **The field edge in Dark** (D-F10): `.input`, `.secondary`, `.sentAgain` and `ChoicePair` use `--home-line-strong`,
  which is `--white-20` in Dark (~1.6:1). The drawing's edge is `#646b77` on `#14171c` (about 3.4:1). Add a dark rule
  using a token, not a literal (`check:tokens`): `--white-35` is the nearest.
- The nav: `ConsumerNav` paints warm on `isWarmSkinPath` (journey routes, `lib/consumer-routes.ts`). Check what it does
  under a Dark setting on `/start/*`, `/coaches/start`, `/coaches/join` vs the four consumer tabs, so the bar and the
  page agree.
- Also pinned warm today and in scope: `components/coaches/CoachStartInterest.module.css` `.wrap` (the gated Premium
  branch — the build prompt says leave that branch untouched; leave it warm and say so), `app/(consumer)/start/start.module.css`
  (the `/start` chooser and the league waitlist — the chooser IS a first-run screen; follow the setting).
- A newcomer has no setting, so they see warm (`lib/no-flash-script.ts` sets dark only on an explicit stored `dark`).

## Then close Stage 1
- **Restart the dev server** (stop it, clear `.next`, `npm run dev`; check the platform-admin login returns 200).
- **One checkable QA walk** on the hub (a QA tab; auto-memory `feedback_qa_walkthroughs_as_checkable_artifacts`): one
  purpose per walk, phone + computer, Warm + Dark, each door to its first screen (team, league beta on localhost,
  tournament with and without `?plan=`, the old `/auth/signup?plan=…` forward, account-only, both invitations, the join
  page's states, Coach Premium new / signed-in step 2 / upgrade / reactivation / claim), the top bar and menu, the coach
  demo button. Localhost has verification off: show the check-your-email screens by answering the sign-up POST with
  `requiresEmailVerification: true` (`.probe/first-look-build/cap-1a.mjs`, `cap-1b.mjs`, `cap-1c.mjs` do exactly this;
  `cap-1b.mjs` signs in a fixture for Premium step 2). Take the next free § in `OWNER_QA_LEDGER.md` (re-check; never
  sort the §s).
- **Records:** `FIRST_LOOK_SIGNUP_PLAN.md` "As built, Stage 1" (the commits, the deliberate departures below), the PM
  brief, `TODO.md`, the hub's ladder (Stage 1 built). Rules 1–9 as one dated entry in `memory/design_decisions.md`
  (in-repo) for `/design`, and the words rules for `/marketing` (Ask 3).
- **Offer `/docs`** — help quotes the old words: `lib/help-content/coaches.tsx` :184 ("Create Team"; now "Create
  team"), :191 (Premium "Create / Sign in" — the toggle is gone; signing in is the foot link), :219–226 ("Use a different
  email" now shows at every door); `lib/help-content/tournaments.tsx` :2153 ("Run a Tournament" button → "Get started").
- **Offer `/marketing`** on the sentences the rulings did not fix word for word: the account-only sub ("Your teams,
  scores and alerts in one place."), the join page's sub ("Your registration is in. Your account shows its status,
  schedule and results." / "Your account shows your team's registrations, schedule and results."), "Create account and
  join", Premium's reactivation sub ("Restore your team workspace instead of starting a new one.").

## Deliberate departures and open owner calls from 1a–1c (put them in the walk and the records)
- Run a tournament's step 2 sub is "Free to start." (step 1's "…You'll name your organization next." would be wrong
  on the step that names it).
- Step 2 drops its small print (as drawn for team); **Start a league season keeps its limits line on step 2** (people
  land there from the email, often on another device).
- The tournament intro's "← Back to all options" is gone, as drawn.
- Premium: the "Portal URL preview" is gone (as drawn); a reactivating coach has no "Create account" foot link; Create
  team is always tappable and says why (missing name, wrong account) instead of fading.
- **Owner call owed:** the join page's sub cannot name the team and tournament as drawn — signed out the page knows
  only the registration id and email. Naming them needs a new signed-out lookup by registration id. Recommendation:
  keep the plain line for Stage 1.
- **Owner call owed:** the foot links ("Sign in", "Reset it") are bold olive without an underline, as drawn; the
  accessibility review notes WCAG 1.4.1 prefers an underline on a link inside a sentence. A `/design` call.
- Small: the club invitation's name fields lost the 60-character typing limit (the server trims to 60).

## Traps this build hit (save yourself the time)
- **Backticks inside a double-quoted shell string execute** (they ate several comments). Write edit scripts as `.cjs`
  files with the Write tool, or use the Edit tool. A here-doc also drops backslashes.
- Some files are CRLF: a `node -e` string match with `\n` misses them — use the Edit tool.
- **`tests/unit/account-first-signup.test.ts` line 2 carries another session's uncommitted edit** (the archived hub
  path). Each 1a–1c commit staged that file without it (a blob from the working copy with that one line reverted,
  `git update-index --cacheinfo`). Check `git diff HEAD` on it before staging.
- A server page cannot dot into `accountForm` from the `'use client'` AccountForm module; import
  `@/components/auth/AccountForm.module.css` directly (as `app/coaches/claim/[token]/page.tsx` does).
- `npx next typegen` before `npm run typecheck` after adding a layout.
- The full `npm test` had two failures from other sessions' files (`coach-semantic-ink`, a club calendar test) and
  `check-css-selectors` one (`GuidanceRail.module.css`) — not this work; re-check they are still theirs.
- Before each commit: `/simplify` then `/review` (sign-up flows are high risk), then ask.
