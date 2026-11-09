# Signed-in family accounts · Stage 4a, Session 2 closeout: simplify → review → legal → commit (chained prompt)

> **Written 2026-11-08** (the build Session 2 chat, at the owner's request). Paste
> `execute @docs/projects/active/SIGNED_IN_FAMILY_STAGE4_S2_CLOSEOUT_PROMPT.md` into a new chat on `dev`. This prompt runs in
> **three chats**, one step each, with a `/clear` between them. **Every chat starts by reading the Progress block below and doing
> the FIRST step not marked done** — never a step already done, never two steps in one chat. At the end of each step: update the
> Progress block (date, what changed, tests run), then tell the owner in one line "Step N done. Run `/clear`, then paste:
> `execute @docs/projects/active/SIGNED_IN_FAMILY_STAGE4_S2_CLOSEOUT_PROMPT.md`" and stop.
>
> **What is being closed:** build Session 2 (Parts 4–5) of `SIGNED_IN_FAMILY_STAGE4_BUILD_PROMPT.md` — read its **▶ Progress**
> block first: the "Session 2" bullet lists what was built, what differs from the prompt and drawing on purpose, and the tests.
> Plan of record `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md` Stage 4 (the 15 rulings + O1–O4). Drawing tabs 1 (the emails) and 2 (the
> accept page): https://claude.ai/artifact/M87dgZ1W4gEWxXvchoZA3M, source `SIGNED_IN_FAMILY_STAGE4_DRAWINGS.html`. Consent and
> privacy words: `docs/agents/legal/drafts/GUARDIAN_CONSENT_STAGE4.md` v0.1 and its six build conditions.
>
> **Binding:** the owner's rulings, the drawing and /legal's words. Simplify and review change HOW the code does it, never what a
> parent, a coach or a registrar sees or the words they read. A finding that would change what someone sees or reads is an owner
> question: record it, don't apply it. **The guardian tier stays OFF** (never set `GUARDIAN_TIER_ENABLED` anywhere shared). This
> closeout is NOT the Stage 4a closeout (that is build Session 4, Part 9: /marketing, /docs, the UAT specs, the walk) — do not
> start it here.
>
> **The commit (Step 3) is authorized by the owner** (2026-11-08, "include a commit at the end"): Step 3 commits without asking
> again, and only this session's files. Nothing is pushed.
>
> Other sessions share this working copy (bank check, billing / GST, permits, platform admin, help). Re-check
> `git rev-parse --abbrev-ref HEAD` is `dev`. Never `git add -A` / `git add .`. Never touch another session's hunks. Never edit hooks,
> `.claude/settings*.json`, or a `WATCHED_PATHS` file. **Write prose and regex-bearing tests with the Write/Edit tools, never a
> shell string or heredoc** (backticks execute; heredocs drop backslashes — both bit the build session). Restart nothing: the dev
> server is the owner's.

## What Session 2 touched (the scope of every step)

New: `lib/family-invitation-mail.ts` (the sends: the placement mailer, the rep invitation, its re-send),
`lib/family-invitation-panel.ts` (the pure HTML: slots, panel, one-liner, who-added and sender lines, the rep email),
`app/api/family/claim/[token]/email/route.ts`, `app/api/family/claim/[token]/resend/route.ts`, `app/invitation-stop/page.tsx`,
`app/api/invitation-stop/route.ts`, `supabase/migrations/454_a_club_names_its_mailing_address.sql`,
`tests/unit/family-invitation-mail.test.ts`.
Changed: `lib/family-invitation.ts` (inspect with viewer/sender/team lines, `invitationSenderOf`, `acceptWithNewAccount`,
`invitationEmailCheck`, `invitationToResend`, `accountNameOf`, the reconnect option), `lib/family-invitation-rules.ts` (teamLine),
`lib/family-invitation-words.ts`, `lib/family-guardian-consent.ts` (the privacy-policy seam), `lib/house-league-placement-mail.ts`
(the mailer wired into the send; `resendPlacementInvitation`), `lib/league-second-parent-mail.ts` (`finish`),
`lib/league-second-parent-footer.ts` (comment), `lib/email.ts` (the two slots), `lib/email-club-identity.ts`
(`coachInvitationSenderName`), `lib/email-kinds.ts` (`family_invitation`), `lib/club-email-context.ts` (`clubMailingAddress`),
`lib/unsubscribe-token.ts` (the invite-stop signer), `lib/reserved-slugs.ts`, `lib/types.ts`, `lib/db.ts`,
`lib/public-site-patch.ts`, `lib/public-site-words.ts`, `app/[orgSlug]/admin/public-site/page.tsx`,
`app/api/admin/public-site/route.ts`, `app/api/admin/house-league/seasons/[seasonId]/publish/route.ts`,
`app/api/coaches/[orgSlug]/teams/[teamId]/guardians/route.ts`, `app/api/family/claim/[token]/route.ts`,
`app/(consumer)/family/claim/[token]/page.tsx` + `ClaimClient.tsx`, `app/(consumer)/family/family.module.css`,
`tests/unit/league-second-parent-fanout.test.ts` (bypass 4), `tests/unit/plan-reader-door-guard.test.ts` (one allowlist line),
`lib/public-form-throttle.ts` (added by the Step 2 review: the per-invitation bucket; unmodified by anyone else when it was edited).
Records: `DATA_DICTIONARY.md` (the `mailing_address` entry ONLY), the schema snapshots, `MANUAL_PROD_STEPS.json` (the 454 entry),
`SIGNED_IN_FAMILY_STAGE4_BUILD_PROMPT.md` (O3/O4 + Progress), `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md` (the O3/O4 paragraph), this file.

## ▶ Progress (read first)

- [x] **Step 1 · /simplify — DONE 2026-11-08** (4 parallel reviewers: reuse, simplification, efficiency, altitude). **Applied:** one
  read of the public-site row serves both the sender's contact and the mailing address (`clubContactAndMailingAddress`; the
  separate `clubMailingAddress` is gone and the O3 guard now reads the new function); the coach's email is read lazily and only
  for a coach team's accept page (a club's page skipped one auth lookup); `connectablesOf` and the rep invitation email take the
  team name in the player read (embedded `rep_teams(name)`, already used in `children-duplicates-read.ts`) instead of a second
  read, and the rep email's club facts load in parallel; one `readClubEmailOrg` replaces two hand-built organization reads;
  one `authUserOf` replaces `coachOf` + `senderEmailOf`; the placement send reads its invitation mailer in the same
  `Promise.all` as the other facts, and its second-parent finish no longer needs three index-aligned side arrays (each household
  carries its unfilled copy, children and first-parent name; `mailChildrenOf` / `guardianFullName` are shared with the re-send);
  the re-send reads the sender and the placed sign-ups together; the pass-through re-export is gone; `family_invitation` sits
  after `league_signup_link_replaced`; the stop page's three reads are cached per request; small one-liners. **Skipped (on
  purpose):** the five-copy tier-off 404 and the slot closure (source-reading guards pin their exact text; a helper would be a
  test rewrite for no behavior), `secondCopyHtml` for the re-send (the Stage 3b fan-out guard deliberately lists which files may
  call the stop-footer helper), the stop write moved into `lib/` and the shared stop-page shell (bigger than a cleanup; sibling
  `/second-parent-stop` keeps its own), a `useAsyncAction` hook / `join` rewrite in `ClaimClient` (UI risk, marginal), the
  password-minimum and `FAMILY_HOME_PATH` moves, serial `firstFill` parallelism (changes token-issue order for no measured
  need), a shared placed-email builder (the two HTML builds stay separate so tier-off bytes cannot drift). Test change: the
  `inspectInvitation` guard now cuts at the function's own close (its end marker was an un-exported helper that no longer
  follows it). **Ran:** the new test file, `family-invitation-rules`, `league-second-parent-fanout`, `league-second-parent`,
  `plan-reader-door-guard` (147 pass); `npx tsc --noEmit` clean (no errors anywhere); `npx eslint` on the touched files clean.
  Original brief: /simplify over the files above (reuse, simplification, efficiency, altitude). Where to look first: (a)
  `resendPlacementInvitation` re-reads facts `sendClaimed` already knows how to read — share a builder only if the placement
  email's HTML stays byte-identical; (b) `connectablesOf` now makes a rep-team read per call; (c) `invitationSenderOf` runs on
  every accept-page view and every Publish — one read of the public-site row serves both the contact and the address; (d)
  `inspectInvitation` may call `holdsVerifiedLinkInOrg` twice; (e) the two shell-built `.cjs` splices left nothing behind (no
  duplicate `const W`, no dead imports). Keep the HTML byte-identical with the tier off (guard (a) in the new test file). Run the
  new test file, `family-invitation-rules`, `league-second-parent-fanout`, `league-second-parent`, `plan-reader-door-guard`, and
  `npx tsc --noEmit` (8 GB heap: `NODE_OPTIONS=--max-old-space-size=8192`; ignore other sessions' errors and name them).
- [x] **Step 2 · /review — DONE 2026-11-08** (high-risk tier; 4 Sonnet finders: security/auth/privacy, send-path correctness,
  tier-off regression, concurrency/data; ~45 findings → ~30 after dedup; the High and the uncertain adjudicated in the main loop
  against the code). **Nothing a parent, coach or registrar sees or reads changed** (no word, no state, no screen); every fix is
  in how a failure, a race or an abuser is handled.
  **Held, checked in the code:** the token signs no one in (guard f; the browser signs in with the typed password); the page and
  every response carry only the masked address (the one full address is a coach team's own contact, which the email also shows);
  account existence comes only after a typed match; the new-account checks all run before `createUser`; D answers `{ ok: true }`
  every way; an invitation failure cannot fail a placement email (the mailer's own `.catch`, `tokenFor` caught, the send's catch);
  the second parent's recipients are still Stage 3's `onEveryRegistration`/`secondParentsOf`, and the households/messages pairing
  holds; the re-send goes to the one address; no send path reads `second_parent_stops`; tier off: every new route and the stop
  page 404 first, the slots are '' (bytes unchanged), Publish's gate short-circuits, the About row's box is hidden, the address is
  shown on no page; the stop page writes nothing on GET, and its HMAC suffix is distinct; mig 454 is additive and nullable.
  **Applied (6):** (1) the address check and the new-account submit spent the per-ADDRESS mail bucket, which neither stopped a
  link holder guessing the address behind the mask (a fresh bucket per guess) nor sent mail, and let a stranger with a made-up
  link burn a parent's registration budget for an hour. Now a per-INVITATION bucket, 10 an hour (`throttleInvitationAttempt`,
  `lib/public-form-throttle.ts`); D's re-send keeps the per-address one (it sends mail). (2) `createUser`'s every 422 read as
  "account exists"; Auth answers 422 for a refused password too, which would have flipped a new parent to "Your password" for an
  address with no account. Now only `email_exists`/`user_already_exists`. (3) A join that failed part-way (a write throwing after
  the claim) left the invitation used, so the retry showed F, and the new account was deleted even after a link was written; the
  link's `user_id` is `SET NULL` (snapshot), so that left a verified connection with no account, counting toward the child's two.
  Now `acceptInvitation` gives the claim back (`releaseClaim`, only while this account holds it), and the new-account path removes
  the account only when it holds no link (kept otherwise: the retry gets "Your password" and connects the rest); a failed delete is
  logged, not swallowed. (4) An older link could undo the coach's Cancel: Cancel marks the newest invitation only, and the
  replaced one still answered D and re-issued. `invitationToResend` now follows `replaced_by` and returns nothing when any later
  one was cancelled. (5) The rep re-send named the original coach without checking they still coach the team; now it sends only
  for a coach seat on that team with `rosterPii` (the Send invitation button's own permission). (6) A failed cancel of an unsent
  rep invitation was ignored (`{ error }` unchecked); now logged. Also: the address check answers only for an OPEN invitation;
  the stop page's `generateMetadata` 404s with the tier off before any read; the dictionary's `mailing_address` entry named the
  removed `clubMailingAddress` (now `clubContactAndMailingAddress`; the migration comment is history, left). Tests: two pinned
  guards updated and strengthened (the account-removal and email-check guards) plus one new guard (Cancel + coach seat).
  **Dropped (refuted or by design):** the stop route's redirect origin (identical to the shipped `/second-parent-stop`); the
  page showing the children's first names and team line before the address is typed (that IS drawing tab 2's open state; guard
  (f) is about sign-in, and the route comment's "never shows a team" means the token opens no team page); the email-check timing
  difference (it reveals only the match the answer already says).
  **⚖ Owner questions (recorded, not applied — each changes what someone receives):**
  - **R1 · Does the parent's own "Email me a new invitation" keep a Send again's reconnect?** The code passes the old
    invitation's `reconnects` through; the dictionary says the parent's own re-send leaves it false; ruling 9 does not say. Kept,
    a parent who missed a Send again for 30 days can get it back themselves, and so can anyone holding that old email, again and
    again, after the club has changed its mind. Not kept, their new invitation connects nothing (F). The code and the
    dictionary disagree until this is ruled. Recommendation: not kept (the club's power stays the club's; the parent asks the club).
  - **R2 · The consent record names the children connected at Join, not the ones the page showed.** If a division is published
    between page load and Join, the record (and the connection) includes a child the parent never saw named. Closing it means
    the page sends what it showed and the server refuses ("this changed, look again") on a difference: a new refusal state, so
    the owner's and /legal's (Step 3).
  - **R3 · An address joined with nothing.** If every child hits the two-guardian cap in a race, the join still says joined
    and the invitation is used. Rare; the fix is a new answer on the page.
  Low, for Session 3 / 4 (no visible change, not applied here): Publish issues placement tokens one at a time before the first
  email (a few hundred families = a few hundred round trips inside the request); a send that fails after `family_invitation_issue`
  leaves the replaced invitation dead (the old link still re-sends, the coach can retry; restoring it needs a DB function change);
  the second-parent re-send's who-added line names only the first sign-up's first parent when one address is second parent on
  two families' sign-ups; a second-parent re-send with no Stop secret sends the plain placement email; the invitation-stop POST
  says done when its cancel of open rep invitations failed (logged; new sends are still refused); the Publish gate answers
  `needsContact` before `already`; the `invitation-stop` reserved slug, so confirm no org holds it before the promote
  (`select slug from organizations where slug = 'invitation-stop'`, dev and prod); the accept page's sender lookup runs for dead
  tokens too; ruling 15 means whoever holds a forwarded link AND knows the address can set the account's password (by design;
  /legal may want it named, Step 3).
  **Ran:** typecheck (`npx tsc --noEmit`, 8 GB) clean, twice; `npx eslint` on the scope 0 errors (the warnings were there
  before); the five Step 1 test files + `register-form-throttle`, `league-signup-link`, `support-console-stage7-part8` (204
  pass); `check:migrations` only reports prod behind dev on other migrations (454 is dev-only by design). `check:layout
  --only=admin-public-site` (the one swept screen in scope; the accept and stop pages are not on the list) ✓ at 361/390/768/1440,
  no new findings, on the owner's running dev server (nothing restarted).
  Original brief: /review (the adversarial funnel, `.claude/commands/review.md`) over the same scope. Hold these against the code,
  not the Progress block's claims: the token never signs anyone in or shows a team (guard f); the page never receives the full
  invited address; account existence is told only after a typed match; the new-account path creates a confirmed account only after
  every refusal and deletes it if the join loses; D answers the same whatever happened; an invitation failure can never fail a
  placement email; the second parent's copy goes only where the Stage 3 household rule already sends it, and the re-send goes to
  ONE address; with the tier off every new route 404s and every email, the record window, the coach card and the public site's
  About row are unchanged; no send path reads `second_parent_stops`; the stop page writes nothing on GET; the rep invitation is
  cancelled when its email fails; Publish refuses only with the tier on. Apply what is real; record what is the owner's.
- [x] **Step 3 · /legal, then the commit — DONE 2026-11-08** (hashes recorded at the foot of this block).
  **/legal's five answers** (full text in the closeout block of `drafts/GUARDIAN_CONSENT_STAGE4.md`; no shipped word changed):
  (i) the second parent's fine print without draft (c)'s first sentence: acceptable, because the who-added line says it in the
  same email; restore the sentence if that line is ever removed. (ii) a coach team's rep invitation with no mailing address (O4):
  acceptable, because the invitation is not a commercial message on the `CASL_MEMBER_INVITE_EMAILS.md` reading; never print a
  volunteer's home address; reverses if it ever carries an offer. (iii) no privacy policy page: **a blocker before the tier goes on
  for real families, not while it is off**: the consent box says the account runs "as the privacy policy … describe", so publish
  the policy (owner items P1–P7 first), set `FIELDLOGICHQ_PRIVACY_POLICY_URL`, drop the "Draft wording — not final." line,
  re-read the box. (iv) the rep invitation's stop also cancelling that club's open rep invitations: acceptable; the page's
  words stay true. (v) R2 is /legal's (condition 4: the record stores the exact words shown): build the "page sends what it
  showed, server refuses on a difference" fix before the tier is on for real; its refusal words are the owner's. Ruling 15 is a
  safeguards judgment, not an obligation: confirm "your sign-up" shows a stranger with a forwarded link no date of birth or
  medical notes; promise nothing like "only the parent can open this account".
  **Checks:** new test file + the Step 1/2 files + `register-form-throttle`, `league-signup-link`, `support-console-stage7-part8`
  (204 pass); `npx tsc --noEmit` clean; eslint on the scope 0 errors; spelling, dictionary coverage, manual-prod, date checks clean.
  `verify:changed`: ONE new failure was in this scope and is fixed: the workspace-flip guard's census did not list
  `lib/family-invitation.ts` (it reads `account_kind` to tell a coach's own team from a club, live), so it was added to
  `LIVE_ROW_FILES` in `tests/unit/workspace-flip-guard.test.ts`. The other failures (~13) are other sessions' work: billing tax
  words, the billing rail, free time, `lib/console-money-sales-tax-wait.ts` (portal census), `workspace-upgrade-status`, the
  permits layout, support-console footers, team-move `platform_charge_tax_looks`, the admin shell island, practice plans, series
  date groups, public tournament preview/stage 6 walk.
  Original brief:
  1. `/legal` reads the rendered words against `GUARDIAN_CONSENT_STAGE4.md` v0.1 and its six conditions, for Parts 4–5 only, and
     answers five things (record the answers in the Progress block and, where they change the draft, in the draft and
     `LEGAL_INDEX.md`): (i) the second parent's fine print drops draft (c)'s first sentence because the drawn who-added line above
     says it — acceptable, or restore it; (ii) a coach team's rep invitation prints no mailing address (O4) — what the
     commercial-message standard needs there; (iii) **FieldLogicHQ has no privacy policy page**, so "How we use your information"
     renders without a link — confirm this is a blocker before the tier goes on anywhere real, and say what is owed; (iv) the stop
     link on the rep invitation also cancels that address's open rep invitations; (v) from Step 2: R2 (the consent record names
     the children connected at Join, which can differ from the ones the page named) and the ruling-15 note (a forwarded link plus
     the address sets the account's password) — say whether either is /legal's, and what it would need. Do not change product words in this step unless
     /legal says the shipped words are untrue; anything else is an owner question for Session 4.
  2. Run the checks again: the test files from Step 1, `npx tsc --noEmit`, `npx eslint` on the scope, `node
     scripts/check-spelling-consistency.mjs`, `check-dictionary-coverage`, `check-manual-prod-migrations`, `check-date-correctness`.
     The full `npm run verify:changed` fails today on other sessions' work (15 named failures in the build Progress block); run it
     and confirm no NEW failure is in this scope.
  3. **Commit** (authorized above). `git rev-parse --abbrev-ref HEAD` = `dev`. Stage with explicit pathspecs: every file in the
     scope list above, whole, EXCEPT `docs/agents/db/DATA_DICTIONARY.md`, which holds another session's bank hunk (around the
     `statement_end_date` entry): stage ONLY the `org_public_site_content.mailing_address` hunk — build the patch with
     `git diff -U0 -- docs/agents/db/DATA_DICTIONARY.md`, keep the one hunk that adds `dict:col:org_public_site_content.mailing_address`,
     and `git apply --cached --unidiff-zero` it (a temp-index commit is the fallback; see the auto-memory note on partial commits
     out of shared files). Before staging any other file, `git diff` it and confirm every hunk is this session's; a foreign hunk is
     left out the same way. Then `git diff --cached --name-only` and read the list. Message:
     ```
     Signed-in family Stage 4a Session 2: the accept page is one form, the placement email carries the invitation, the rep coach's Send invitation emails it (Parts 4-5)

     Accept page rebuilt to drawing tab 2 (email first; new account created confirmed and joined in one request, or the existing
     password; states A-F). Placement and moved emails draw the invitation's slots only with the tier on (tier off = today's email).
     Second parent's copy: who-added line, own invitation, Stop footer, sender line with the club's mailing address. Rep Send
     invitation emails, with a POST-only "Don't send me invitations" page. One-address placement re-send (D, Send again, Part 6).
     Publish refuses (tier on only) until the club has a contact email and a mailing address (O1 = A, O3). Coach team contact =
     the coach's own email (O4). Mig 454 (org_public_site_content.mailing_address), dev only.

     Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
     ```
     After the commit: `git show --stat HEAD` and confirm only this scope landed (a foreign file → `git reset --soft HEAD~1`,
     unstage it, re-commit). Then record the hash: in this file's Progress block, in the build prompt's Progress "Session 2" bullet
     ("committed `<hash>` 2026-11-08"), and in the auto-memory note `project_end_state_signed_in_family_app.md` + its `MEMORY.md`
     line ("S2 … commit owed" → "S2 committed `<hash>`"). Commit those record edits as a second commit
     (`Signed-in family Stage 4a Session 2: record the commit hash (<hash>) and the closeout in the build prompt`), same rules.
     Do not push.
  4. Tell the owner, in product-owner words: what changed in the closeout (if anything a person sees changed, there should be
     nothing), /legal's five answers, the Step 2 owner questions R1–R3, the two hashes, and the next step: **build Session 3 = Parts 6–8**, pasted as
     `execute Session 3 (Parts 6–8) of @docs/projects/active/SIGNED_IN_FAMILY_STAGE4_BUILD_PROMPT.md` after `/clear`.
