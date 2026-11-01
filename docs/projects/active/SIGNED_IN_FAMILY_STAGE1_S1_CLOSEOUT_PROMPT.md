# Signed-in family accounts · Stage 1, Session 1 closeout: simplify → review → commit (chained prompt)

> **Written 2026-11-01.** Paste `execute @docs/projects/active/SIGNED_IN_FAMILY_STAGE1_S1_CLOSEOUT_PROMPT.md` into a new chat on
> `dev`. This prompt runs in **three chats**, one step each, with a `/clear` between them. **Every chat starts by reading the
> Progress block below and doing the FIRST step not marked done** — never a step already done, never two steps in one chat.
> At the end of each step: update the Progress block (date, what changed, tests run), then tell the owner in one line
> "Step N done. Run `/clear`, then paste: `execute @docs/projects/active/SIGNED_IN_FAMILY_STAGE1_S1_CLOSEOUT_PROMPT.md`" and stop.
>
> What is being closed: Session 1 (Parts 1–4) of `SIGNED_IN_FAMILY_STAGE1_BUILD_PROMPT.md` — read its **▶ Progress** block
> first; it lists what was built, the choices to report and the known gap. Plan of record `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md`
> Stage 1; drawing `SIGNED_IN_FAMILY_STAGE1_DRAWINGS.html`. The owner's rulings and the drawing are binding: simplify and
> review change HOW the code does it, never what the family or the club sees or the words they read.
>
> Other sessions share this working copy (billing, house league). Re-check `git rev-parse --abbrev-ref HEAD` is `dev`. Never
> `git add -A` / `git add .`. Never touch another session's hunks. Never edit hooks, `.claude/settings*.json`, or a
> `WATCHED_PATHS` file. Write prose with the Write/Edit tools, never a shell string with backticks or `$`; edit regex-bearing
> test files with the Edit tool (heredocs drop backslashes; several files here are CRLF).

## ▶ Progress (read first)

- [x] **Step 1 · /simplify** — 2026-11-01. Four reviewers (reuse, simplification, efficiency, altitude) on the Session 1
  files only. **Applied:**
  - **One "still owes".** `signupStillOwes(registrationId, seasonId)` is exported from the door and the mail asks it. The
    mail's copy had already DRIFTED: it left out the open-Stripe-payment check, so on a season past its clock it refused to
    email a link the door would open. ⚠ The one behaviour change, toward the door's documented rule 3 (ask 1): a sign-up whose
    only outstanding item is an open checkout now gets its link emailed. The mail loads money facts only when the clock has
    run out (in parallel), and reads `link_version` with its rows. Before, it loaded the full pay facts for every sign-up
    one at a time, just to get the version.
  - **The door reads the anchor once.** `signupRowsForLink` (which re-read the anchor and re-checked the address) became
    `signupRowsFromAnchor(anchor)`. The door selects `SIGNUP_STATUS_COLUMNS` + address + `link_version` + season in one read.
    The ok result is now `{ registrationId, seasonId, signupKey, rows }`. `version`/`orgId` (nobody read them) and `opts.now`
    (never passed) are gone. The two `invalid` returns are one condition.
  - **The poll** runs the door and its Stripe-session lookup in parallel and matches on `link.seasonId`/`link.signupKey`.
    Its third read of the registration is gone (the test pins that it reads no `league_registrations`).
  - **The email route** uses `holdUntilFloor` (lib/no-tell-floor.ts, forgot password's) and `isValidEmail`
    (lib/auth-errors.ts), not local copies. `sendSignupLinks` returns `void` (nobody read its result). The mail's
    `appUrl()` keeps the house per-file pattern but drops its redundant slash strip (`leaguePayUrl` strips it).
  - **Styles.** `EmailMyLinkForm` no longer imports from the `YourSignup` page component. Its field, label and error use
    `ClubForm.module.css` (the club frame's form faces, as RegisterForm does), and its quiet lines use a `.soft` in its own
    module. The finished-season card on the token page uses that module's `.heading`/`.soft`, not inline copies. YourSignup's
    styles are no longer exported. ⚠ Visible but tiny: the email field now shows the club's focus ring (the inline copy had
    `outline: none` and no focus rule), and the label sits 0.05rem closer.
  - **Dead bits.** `player_last_name` is out of `SIGNUP_STATUS_COLUMNS`/`SignupStatusRow` (nothing read it: the
    first-name page no longer even selects last names). The unused `SIGNUP_LINK_WORDS.seasonLineLead` is removed.
  - **Tests repointed, none deleted.** The mint test now scans ALL of app/lib/components for `leaguePay(Url|Token)(`, not a
    list of four files. Every call must carry the anchor's version; the register route's `0` (a row made a moment ago) is
    the one named literal. The mail test asserts it calls `signupStillOwes` and copies no `owingCents`.
  - **Tests:** the 9 Session 1 suites, 260/260 pass. `tsc`: clean on Session 1, except one error in
    `components/public/PublicRuleSections.tsx:55` (another session's file, not Session 1's). ESLint clean on the 12 touched
    files. Spelling and tokens pass.
  - **Skipped:** a light door mode for the pay/poll (adds an option for one query). Exporting `TOO_MANY` from
    `lib/public-form-throttle.ts` and one repo-wide `appBaseUrl()` (outside Session 1's files). A shared header for the two
    status pages (a new file for ~6 lines). Passing season status into the mail (`LeagueSeason` carries no `finished_at`).
    Folding the withdraw route's name re-read into the door (minor).
  - **Handed to Step 2 (correctness, not cleanup):** (a) `firstNameLabel` (lib/league-pay-view.ts) matches a stored receipt
    description by PREFIX. A child renamed after paying no longer matches, so the full stored label, last name included,
    could reach the family page. Build the label from the registration row and fall back to the stored text only for
    lines with no registration? (b) YourSignup's own withdraw-note field keeps `outline: none` with no focus rule
    (carried from 9b-2), so it shows no keyboard focus.
- [x] **Step 2 · /review** — 2026-11-01. High-risk tier. Four lenses: the token door, "Email me my link" abuse, last
  names in the browser, and compatibility/migration/callers. **The five questions, answered from the code:**
  - **(1) Doors.** Only `openSignupLink` reads a family token. The `[token]` page, pay POST, poll and withdraw POST all go
    through it. The page and withdraw also pin org and season. A replaced link, or a closed season's link that owes nothing,
    opens nothing. The email + reference lookup is gone. The poll's `afterCheckout` drops only the clock: version, signature
    and anchor still run. It answers a state word only for `flow='league_signup'` with the matching season and signup key.
    Anything else gets one identical `unknown` 404, so it is no oracle. A DB error in the door throws (500), so it never
    fails open.
  - **(2) Email me my link.** Body, status and headers are the same whether or not anything matched, and a send failure
    answers the same. The 400, 404 and 429 answers do not depend on the address. The mail and the door agree on every rule,
    so the mail sends no dead links. It mails only the stored address within the URL's org and season, and writes nothing,
    so a stranger cannot replace a family's link.
  - **(3) First names.** The status page and YourSignup props are clean, and so is the withdraw route. Three leaks were
    found and fixed (below).
  - **(4) Version 0.** The signing input, secret, truncation, encoding and separator are byte-identical to HEAD. The tests
    pin it. A `.0` or leading-zero spelling is refused. All 8 mint calls pass the row's own version, apart from the register
    route's named `0`.
  - **(5) Migration 419.** ADD COLUMN with a constant default is metadata-only. There is no backfill and no index. Every
    statement is guarded (`IF NOT EXISTS`, plus a name check for the CHECK). The RLS/grants posture is unchanged.

  **Fixed (all Confirmed in the main loop):**
  - **(High) The pay route's refusal 409** sent "Maya Okafor is already paid" / "…has ended" to the family's browser. It
    now uses the first name only (`leagueRefusalMessage`, lib/league-pay-facts.ts).
  - **(High) The pay route's clearing 409** built `who` from the stored full names. A first-name list (`whoFirst`) now
    goes to both `openSessionFor` calls. The full `who` stays in the club's record (`p_description`).
  - **(High) `firstNameLabel`** (handed over by Step 1) kept the full stored label in three cases: a child renamed after
    paying, a line with no registration of this sign-up, or a case change. It could also garble a near-prefix ("Al Smith"
    → "Alson"). The label is now the registration's first name + the text after the first " · ". The stored name never
    reaches the page. A line with no child shows only the division part.
  - **(Medium) The duplicate sign-up error** still said "Use your reference to check their status", and the reference opens
    nothing. It now reads "…To see their sign-up, use "Email me my link" on the season page." (the drawn door word,
    `SW.door`). The reference comment was corrected with it.
  - **(Medium, a11y) The withdraw-note field** (handed over by Step 1) now uses ClubForm's `.textarea` with its focus ring.
    The inline `inputStyle` with `outline: none` is deleted.
  - **(Medium) The email-my-link floor** was a local 1.5 s, shorter than forgot password's 2 s. Forgot password does less work
    than this route, which reads the sign-ups, computes owing and builds several links. This route now uses the shared `NO_TELL_FLOOR_MS`.
  - **(Low) The dictionary** named the deleted `signupRowsForLink`. It now names `signupRowsFromAnchor`.
  - **Tests:** 3 new pins in `league-signup-link.test.ts` (refusal and clearing first names, the label shape, the focus
    class and duplicate wording). The floor pin was repointed. The 9 suites pass 262/262. `tsc` is fully clean. ESLint is
    clean on the 7 touched files. Spelling and tokens pass. `check:migrations` flags 419 as dev-only (expected) and another
    session's notification-kind constraint.

  **Not changed: owner questions or accepted risk.**
  - **✅ Both owner questions RULED 2026-11-01:** Stripe gets first names, and the email is partly hidden. Both are Session 2
    work, written into the build prompt as **Part 5b**.
  - **Owner question: the Stripe checkout page** shows "Maya Okafor · U9 · 2026 Season" per line. This is the family's
    browser, on Stripe's page. Session 1 left checkout line names alone on purpose ("paying is out of scope"). Should Part 5+
    give Stripe first names? (The club's record keeps full names either way.)
  - **Owner question: the guardian's email in full on the family page.** This is not new: the token page passed it before.
    Before, though, you needed the email to get in; now a forwarded link shows it. Mask it?
  - **Accepted (Low):** the floor hides a match only when the send finishes inside 2 s. A Resend call has no timeout, and the
    serverless host drops work after the response. This is the house limitation, documented in lib/no-tell-floor.ts.
  - **Accepted (Low):** the per-inbox throttle shares its 8/hour bucket with sign-up, so a stranger can make a family wait
    an hour. The in-memory throttles are per instance, and the durable rail is keyed on a spoofable first `x-forwarded-for`
    entry. Both predate this change and are platform-wide.
  - **Accepted (Low):** stored names that anyone typed under an address are mailed back to it, HTML-escaped. This predates
    the change: anyone can register under any email.
  - **Accepted (Low):** the withdraw write does not re-check the version. That leaves a window of milliseconds in which a
    link replaced mid-request still sends one ask, and an ask changes nothing by itself.
  - **Accepted (Advisory):** the door's null-season branch would open, but it is unreachable (to-one FK embed).
  - **Accepted (Advisory):** club-typed free text (the money reason, team names) reaches the family unfiltered.
  - **Accepted (Advisory):** `scripts/.tsx-token-baseline.json` still lists the deleted `StatusLookupForm.tsx`. This is
    harmless, since the check passes. The entry is left for the baseline's own tooling.
  - **For Part 6:** nothing writes `link_version` yet. The reset must bump every row of the sign-up (same `signup_ref` +
    `guardian_email`) in ONE statement, or a sibling's per-child placement link survives.
- [x] **Step 3 · commit + hand over Session 2** — 2026-11-01. **Session 1 committed `d79603110`** on `dev` (39 files,
  parent `19f551396`). Built in a temp index on that base, pre-commit hook run by hand (tokens, dates, lockfile pass),
  `commit-tree` + compare-and-swap `update-ref`. The 9 suites re-run first: 262/262. The three shared records carry Session 1's
  lines only: the house-league session's `house_league_practice_coach_copy` kind, its dictionary entries
  (`coaches_copied_at`, the coach calendar columns) and its MANUAL_PROD_STEPS 415 sentence + 420 entry stay uncommitted in
  the working copy for that session. **Left out on purpose:** the schema snapshot files and `memory/reference_db_schema.md`
  (they also carry the billing session's 416–418; a records commit). No committed file imports another session's uncommitted
  module. This hash line and the build prompt's are uncommitted record edits.

## The Session 1 files (the whole scope of every step)

New: `lib/league-signup-link.ts`, `lib/league-signup-link-mail.ts`,
`app/[orgSlug]/league/[seasonSlug]/status/YourSignup.tsx` (renamed from `StatusLookupForm.tsx`, deleted),
`app/[orgSlug]/league/[seasonSlug]/status/EmailMyLinkForm.tsx` + `EmailMyLinkForm.module.css`,
`app/api/league/[orgSlug]/[seasonSlug]/email-my-link/route.ts`, `supabase/migrations/419_a_familys_link_can_be_replaced.sql`,
`tests/unit/league-signup-link.test.ts`.
Deleted: `app/api/league/[orgSlug]/[seasonSlug]/status-lookup/route.ts`, `app/[orgSlug]/league/[seasonSlug]/status/StatusLookupForm.tsx`.
Changed: `lib/league-pay-link.ts`, `lib/league-pay-facts.ts`, `lib/league-pay-view.ts`, `lib/league-pay-words.ts`,
`lib/league-signup-status.ts`, `lib/house-league-access.ts`, `lib/house-league-placement-mail.ts`, `lib/bank-debit-email.ts`,
`lib/online-payment-receipt.ts`, `lib/no-login-token.ts`, `lib/email-kinds.ts`, `lib/public-league.ts`,
`app/[orgSlug]/league/[seasonSlug]/page.tsx`, `app/[orgSlug]/league/[seasonSlug]/register/page.tsx`,
`app/[orgSlug]/league/[seasonSlug]/status/page.tsx`, `app/[orgSlug]/league/[seasonSlug]/status/[token]/page.tsx`,
`app/api/league/[orgSlug]/[seasonSlug]/register/route.ts`, `app/api/league/[orgSlug]/[seasonSlug]/withdraw-request/route.ts`,
`app/api/pay/league/[token]/route.ts`, `app/api/pay/league/[token]/status/route.ts`, `components/league/RegisterForm.tsx`,
`tests/unit/league-pay.test.ts`, `tests/unit/house-league-signup-guard.test.ts`, `tests/unit/club-frame-guard.test.ts`,
`tests/unit/club-stage4a-guard.test.ts`, `tests/unit/house-league-ratings-guard.test.ts`.
Records (shared files, Session 1's hunks only): `docs/agents/db/DATA_DICTIONARY.md` (the `link_version` / `link_replaced_at`
entry), `supabase/migrations/MANUAL_PROD_STEPS.json` (the 419 entry), `docs/projects/active/SIGNED_IN_FAMILY_STAGE1_BUILD_PROMPT.md`
(its Progress block), and this file.

Before each step, `git diff -- <file>` every changed file above: any hunk Session 1 did not write (another session edits
`lib/online-payment-receipt.ts`, `lib/bank-debit-email.ts`, `lib/email-kinds.ts`, `lib/league-pay-facts.ts` and the records
files) is not yours — leave it alone and keep it out of the commit.

The tests that cover Session 1 (run after any change):
`node --import ./tests/ts-resolver.mjs --test tests/unit/league-signup-link.test.ts tests/unit/league-pay.test.ts tests/unit/house-league-signup-guard.test.ts tests/unit/club-frame-guard.test.ts tests/unit/club-stage4a-guard.test.ts tests/unit/house-league-ratings-guard.test.ts tests/unit/family-email-guard.test.ts tests/unit/support-console-stage5-guard.test.ts tests/unit/support-console-stage5-sender-guard.test.ts`,
then `npx tsc --noEmit --pretty false` (8 GB heap: `NODE_OPTIONS=--max-old-space-size=8192`), `npx eslint <the files above>`,
`node scripts/check-spelling-consistency.mjs`, `node scripts/check-public-tokens.mjs --scope=all`.
Known failures that are NOT Session 1's (report, never fix): `bank-debit-desk` (the billing session's
`lib/platform-stripe-fees.ts`), public-tournament stage 6 champions/walk, support-console stage 3 footers, plan-billing-usage,
the stage0 follower dock; `scripts/verify-changed.mjs`'s ESLint step errors on a react-hooks plugin config (a direct
`npx eslint` passes); `check-org-slug-callers`, `check-demos`, `check-css-selectors` name other areas' files.

## Step 1 · /simplify

Run the built-in `/simplify` skill scoped to the Session 1 files only (not the whole working tree: it holds other sessions'
work). Worth a hard look: the one door (`lib/league-signup-link.ts`) and whether `signupStillOwes` and
`lib/league-signup-link-mail.ts` compute "owes" the same way twice (one helper, used by both, is the likely win); the shared
field styles `YourSignup.tsx` exports for `EmailMyLinkForm.tsx`; the hand-rolled `appUrl()` in the mail file versus an existing
one; the inline `h2` styles on the finished screen versus `EmailMyLinkForm.module.css`'s `.heading`. Keep every guard's intent
(repoint, never delete). Run the tests above. Record what changed in the Progress block.

## Step 2 · /review

Run `/review` (the repo's adversarial funnel, `.claude/commands/review.md`) on the Session 1 files. Questions it must answer
from the code, not from this prompt:
- Can ANY path still open a family page, pay, poll or ask to withdraw with a replaced link, a closed season's link, or the
  email + reference? (Every reader of a family token; the poll's `afterCheckout` skip — does it only answer a state word for a
  session already belonging to that sign-up?)
- "Email me my link": does the response, its status or its timing differ by whether the email has a sign-up? Can it mail a
  link that would not open? Can it be aimed at a stranger's inbox past the throttles?
- First names: does any last name still reach the family's browser (page props, pay block, receipts, the withdraw notice the
  family sees)? Emails keep full names on purpose (ask 7).
- Version 0 = today's links exactly: does any already-emailed link stop working?
- The migration: safe on a table with rows; re-runnable.
Apply what it confirms, run the tests, record findings and fixes in the Progress block (and anything left open as an owner
question).

## Step 3 · commit, then hand over Session 2

The owner has said to commit (this prompt is that word). One commit, Session 1's files only:
1. `git rev-parse --abbrev-ref HEAD` → `dev`. Stage the files above by explicit path (`git add -- <path>`; the deletions with
   `git rm --cached -- <path>` if they are not staged). For each records file and any code file with foreign hunks, stage only
   Session 1's hunks with the temp-index method (memory note "Partial commit out of shared files").
2. **Leave the schema snapshot files out** (`docs/agents/db/schema-snapshots/*`, `memory/reference_db_schema.md`): they also
   carry the billing session's 416–418; they go in a records commit, not this one. Say so in the hand-off.
3. `git diff --cached --name-only` — only Session 1's paths. Message: what the family and the club now see, what migration 419
   does (dev only, prod pending in MANUAL_PROD_STEPS), the deliberate no-new-secret difference, and the known gap (emails'
   reference line until Part 5). End with the attribution line from the system reminder.
4. `git show --stat HEAD` — if a foreign file landed, `git reset --soft HEAD~1`, unstage it, commit again.
5. Record the commit hash in this file's Progress block AND in the build prompt's ▶ Progress ("Session 1 … committed
   `<hash>` <date>"). Those two record edits stay uncommitted unless the owner says otherwise; say which.
6. Then tell the owner, in product-owner words: what was committed, the restart owed before any browser look (new files and a
   migration), and **give them the Session 2 prompt to paste after `/clear`**, exactly:

   ```
   execute @docs/projects/active/SIGNED_IN_FAMILY_STAGE1_BUILD_PROMPT.md — Session 2 (Parts 5–8). Session 1 is committed
   (see its ▶ Progress block); start at Part 5.
   ```
