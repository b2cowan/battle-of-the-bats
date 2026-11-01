# Signed-in family accounts · Stage 1, Session 2 closeout: simplify → review → docs → commit (chained prompt)

> **Written 2026-11-01.** Paste `execute @docs/projects/active/SIGNED_IN_FAMILY_STAGE1_S2_CLOSEOUT_PROMPT.md` into a new chat on
> `dev`. This prompt runs in **four chats**, one step each, with a `/clear` between them. **Every chat starts by reading the
> Progress block below and doing the FIRST step not marked done** — never a step already done, never two steps in one chat.
> At the end of each step: update the Progress block (date, what changed, tests run), then tell the owner in one line
> "Step N done. Run `/clear`, then paste: `execute @docs/projects/active/SIGNED_IN_FAMILY_STAGE1_S2_CLOSEOUT_PROMPT.md`" and stop.
>
> What is being closed: Session 2 (Parts 5–8) of `SIGNED_IN_FAMILY_STAGE1_BUILD_PROMPT.md` — read its **▶ Progress** block
> first (the "Session 2" bullet lists what was built, the choices to report and the owner calls). Plan of record
> `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md` Stage 1; drawing `SIGNED_IN_FAMILY_STAGE1_DRAWINGS.html` (tabs 4 and 5 are this session's
> spec). The owner's rulings and the drawing are binding: simplify and review change HOW the code does it, never what the
> family or the club sees or the words they read. Two owner calls are OPEN (the masked receipt-email field; the new-link
> email's words): do not decide them, leave them as built.
>
> Other sessions share this working copy (billing, house league 9d-3, public tournament). Re-check
> `git rev-parse --abbrev-ref HEAD` is `dev`. Never `git add -A` / `git add .`. Never touch another session's hunks. Never edit
> hooks, `.claude/settings*.json`, or a `WATCHED_PATHS` file. **Write prose and regex-bearing tests with the Write/Edit tools,
> never a shell string or heredoc**: backticks in a shell string EXECUTE (it happened twice in the build session) and heredocs
> drop backslashes. Several files are CRLF. Production reads were refused in the build session; do not retry them.

## ▶ Progress (read first)

- [x] **Step 1 · /simplify** — done 2026-11-01 (4 review agents: reuse, simplification, efficiency, altitude). No word a
  family or club reads changed. **Applied:**
  - Register route: the confirmation's "Your sign-up" button is signed at version 0 (the row made in this request, as
    the success screen's `signupToken` already was) instead of a full `loadLeaguePayFacts` on EVERY sign-up;
    `leagueMailLink` now runs only when a child is accepted (for the card words). Guard repointed: the one-literal
    exception in `league-signup-link.test.ts` covers this route's two mints (token + confirmation URL), nothing else.
    ⚠ Step 2 should confirm the literal is safe (a reset between the insert and the send would need the row's id first).
  - `league-signup-link-mail.ts`: `sendSignupLinks` and `replaceSignupLink` share a private `sendLinkNotice` (heading,
    "Hi", the caller's lines, the footnote, the transactional send); HTML byte-identical.
  - RegistrationsScreen: the confirm's inline IIFE is gone; a module-level `signupKids(reg, all)` gives the menu hint
    and the confirm the same names (+ `many`).
  - Pay route: Stripe line names come from the child's own `firstName` / `divisionName` (`childOf` map), not by
    re-splitting the club's description string.
  - `lib/utils.ts`: one `MASK` constant shared by `maskEmail` / `isMaskedEmail`.
  - `signupsOwingNow`: a pointer that its clearing read is `isRegClearing`'s test, batched; bank debit's `DebitContext`
    doc says why `canPayAgain` differs (team = no refusal; league = owing).
  **Skipped:** redesigning the masked receipt-email field so it never round-trips (changes what the family sees, and the
  field is an OPEN owner call); a shared `owedSignupUrl(facts)` / unsubscribe-footer policy helper (optional, each
  behaviour correct); unifying the four sign-up-set queries (row shapes differ); `online` → boolean (5 signatures, no
  gain); `timingSafeEqual` in the unsubscribe compare (the loop is correct, tokens must stay byte-identical).
  **Tests:** the 20 suites 905/905; `tsc` clean; ESLint 0 errors (RegistrationsScreen's 8 `preserve-manual-memoization`
  warnings are identical at HEAD); spelling, tokens, dictionary pass. Tests touched: `league-signup-link`,
  `league-pay`, `house-league-signup-guard` (repointed, none deleted).
- [x] **Step 2 · /review** — done 2026-11-01 (high-risk tier; 4 lenses: reset + mints, the owed rule, address + Stripe,
  unsubscribe + blast radius; 22 findings → 3 confirmed and fixed, the rest verified OK or left as owner notes below). No
  word a family or club reads changed. **Fixed:**
  - `replaceSignupLink`: a send that THROWS after the version write (Resend network error; `sendEmail` rethrows with no
    `timeoutMs`) gave the registrar the generic 500 with the old link already stopped. Now `.catch(() => null)` →
    `send_failed` → "Couldn't send the new link. Try again." (pressing again mints the next version).
  - `isMaskedEmail`: any "•" (was the exact "•••" run). A half-edited mask ("m••@gmail.com") passed the route's regex
    and reached Stripe as `customer_email` → a 502; now it falls back to the address on file like an untouched one.
  - `unsubscribe-token` `getSecret`: the secret signs exactly as set (the `.trim()` is only the emptiness test). A
    production value with stray whitespace would otherwise have changed every token already in an inbox. Tokens are
    otherwise byte-identical to HEAD (same messages, sha256 hex, first 32).
  **Verified OK (from the code):** one UPDATE moves every sibling (`.in(ids)`, the door's exact set; versions cannot
  diverge — only the column default 0 and this update write it); `register` permission + finished-season 423 + org and
  season on every read; every mint reads the live version (placement, receipts, bank debit, pay view, "Email me my link");
  every reader goes through `openSignupLink`; the register route's literal 0 is safe (fresh `signup_ref`, default 0; the
  only gap is a reset in the milliseconds between insert and send); the button follows tab 5 for every email kind
  (waitlisted has none); `signupsOwingNow` agrees with `loadLeaguePayFacts` (shared `childDue`, same set and clearing
  read); no full address reaches the browser (page props, pay view, pay/poll/withdraw/email-my-link answers); Stripe line
  names are first name + division + season; every `buildUnsubscribeUrl` caller handles null; team-side emails unchanged.
  **Left as built (owner notes, not defects):**
  - "Owed" in emails is `owingCents > 0`, which counts a clearing bank debit as paid; the page's open-link rule
    (`signupStillOwes`) counts clearing and an open checkout as still owing. So a receipt for one child while a sibling's
    debit clears carries no button, though the link stays open. Defensible (money in flight); owner may rule otherwise.
  - Stripe's PaymentIntent `description` (the club's dashboard) keeps full names, as before; the ruling covered the
    lines Stripe's page shows. If Stripe's emailed receipt is ruled a family surface too, that string needs first names.
  - With UNSUBSCRIBE_SECRET unset, family announcements still SEND with no unsubscribe link (only marketing is refused);
    the build chose this on purpose. Moot while the secret is set (the owed Amplify check).
  - Low, not changed: a send that fails still leaves the "New link sent; the old one stopped" history line (the old one
    did stop); two registrars pressing at once can send two emails, the first one's link stopped; a reset while the family
    is on Stripe returns them to "this link no longer works" (the receipt carries the new link); with no Resend key (dev
    only) the reset toasts "sent".
  **Gate:** the 20 suites 905/905; `tsc` clean; ESLint 0 errors; spelling, tokens, dictionary pass. `check:layout`
  SKIPPED: the UAT sign-in on the shared dev server had expired, and re-running auth setup was not done on a server
  others are using (the screen change is a menu row + a confirm window, which the sweep does not open). Tests touched:
  `league-signup-link` (3 pins added, none removed).
- [x] **Step 3 · /docs** — done 2026-11-01, for both Stage 1 sessions. Words checked against the shipped strings
  (`SIGNUP_LINK_WORDS`, `REGS_WORDS.newLink`, the menu hint, the season page's "Already signed up? Email me my link"). The
  two open owner calls are not described word for word (the new-link email is "a short email"; the masked receipt-email field
  is not mentioned). **Changed:** `lib/help-content/house-league.tsx` — *What families see when they sign up*: summary,
  keywords, searchText; *The reference, the email and the family's Your sign-up page* (first names, the reference to quote,
  the foot line; the email-plus-reference lookup removed); **new sub-topic `family-signup-link`** (the one email button and
  when it is carried, Email me my link, the 30-day end unless owed, "This link no longer works"); *Paying by card* (Pay now on
  the confirmation and the page, the emails carry Your sign-up; the pay link no longer "never expires"; Stripe lists first
  names); bank debit (returned email carries Your sign-up); every "status page" → the family's sign-up page; the lost-reference
  FAQ rewritten (id kept); *Card payments and the pay link* (the pay link email's button); **new sub-topic
  `registrations-new-link`** (*Sending a family a new link*: steps, siblings, the old link's screen, the history line, who and
  when, the failed-send note) + the section's keywords/searchText; *Who can do what* (the registrar sends a new link).
  `lib/help-content/registrations.tsx` — the "Too many attempts" FAQ names the Email me my link form (was the status lookup);
  "from their sign-up page". `lib/help-content/org.tsx` — the withdrawal-request row says "sign-up page". No anchor renamed or
  removed; no hub card change (no new page). **Not changed:** `families.tsx` searchText keeps "status page" as a search term
  only. **Checks:** `measure:help` 0 unconverted (both new sub-topics under 350; *Paying by bank debit* at 376 was over
  before this edit, words unchanged in length); ESLint 0 errors (the line-1 unused-disable warning is old); spelling passes;
  the 8 suites that read these guides 235/235. `tsc` not re-run here (no contract change); Step 4 re-runs it.
- [x] **Step 4 · commit** — 2026-11-01. **Session 2 committed `0e8294ddf`** on `dev` (44 files, parent `e6b3cad3a`). The 20
  suites re-run first: 905/905; `tsc` clean. Built in a temp index on that base, pre-commit hook run by hand (tokens, dates,
  lockfile pass), `commit-tree` + compare-and-swap `update-ref`. Two files carry Session 2's lines only: the Owner QA Ledger
  (§437; the billing session's paste-back above it stays in the working copy) and `league-practice-tell.test.ts` (the
  moved-email pin; house league's published-division reader test and `lib/club-schedule-league-mail.ts` stay in the working
  copy). **Also committed:** `SIGNED_IN_FAMILY_STAGE1_DRAWINGS.html` (Session 1 left it untracked while committed code and docs
  already named it). **Left out on purpose:** the schema snapshot files, `memory/reference_db_schema.md`, `.probe/`. No
  committed file imports another session's uncommitted module. This hash line and the other record edits (build prompt, plan,
  TODO, §437, memory) are uncommitted record edits.

## The Session 2 files (the whole scope of every step)

New: `docs/projects/active/SIGNED_IN_FAMILY_STAGE1_S2_WALK.html` (walk §437, published
https://claude.ai/artifact/3sFyR5BcRptmAZ9isBKYRk), this file. Dev-only helpers, never committed: `.probe/signed-in-family-s2/`
(fixture.mjs, walk-body.html, assemble.cjs, ledger-437.md).

Changed, code: `lib/email.ts`, `lib/league-pay-words.ts`, `lib/house-league-money-words.ts`, `lib/league-pay-view.ts`,
`lib/league-pay-facts.ts`, `lib/house-league-placement-mail.ts`, `lib/bank-debit-email.ts`, `lib/online-payment-receipt.ts`,
`lib/utils.ts`, `lib/db.ts`, `lib/types.ts`, `lib/house-league-registrations.ts`, `lib/league-signup-link-mail.ts`,
`lib/email-kinds.ts`, `lib/unsubscribe-token.ts`, `lib/email-sender.ts`, `lib/family-email.ts`,
`app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts`,
`app/api/league/[orgSlug]/[seasonSlug]/register/route.ts`, `app/api/pay/league/[token]/route.ts`,
`app/[orgSlug]/league/[seasonSlug]/status/[token]/page.tsx`, `app/[orgSlug]/league/[seasonSlug]/status/YourSignup.tsx`,
`components/public/LeaguePayBlock.tsx`, `components/admin/kit/club/league/registrations/RegistrationsScreen.tsx`,
`app/api/billing/create-checkout/route.ts`.

Changed, help (Step 3, commit with the rest): `lib/help-content/house-league.tsx`, `lib/help-content/registrations.tsx`,
`lib/help-content/org.tsx`.

Changed, tests: `tests/unit/league-signup-link.test.ts`, `tests/unit/house-league-signup-guard.test.ts`,
`tests/unit/house-league-registrations.test.ts`, `tests/unit/league-pay.test.ts`, `tests/unit/public-face-s3b-family-emails.test.ts`,
`tests/unit/league-practice-tell.test.ts` (one hunk only: the moved-team email's "one button" pin).

Records (shared files, Session 2's hunks only): `docs/agents/db/DATA_DICTIONARY.md` (the 419 entry's "writer is
replaceSignupLink" sentence; `no_unsubscribe_secret` in the email_sends failure reasons), `supabase/migrations/MANUAL_PROD_STEPS.json`
(the 419 note's UNSUBSCRIBE_SECRET sentence), `docs/projects/active/OWNER_QA_LEDGER.md` (§437), `TODO.md` (the Signed-in family
line), `docs/projects/active/SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md` (the Stage 1 "Built" note), `SIGNED_IN_FAMILY_STAGE1_BUILD_PROMPT.md`
(Progress block), `SIGNED_IN_FAMILY_STAGE1_S1_CLOSEOUT_PROMPT.md` (Session 1's uncommitted hash-line edit), this file.

**Known foreign hunks** (another session's, leave them out): `lib/email-kinds.ts` (`house_league_practice_coach_copy`,
`billing_drift_alert`), `tests/unit/league-practice-tell.test.ts` (house league 9d-3), and every records file above. Before each
step, `git diff -- <file>` every file listed: any hunk Session 2 did not write is not yours.

**The tests that cover Session 2** (run after any change):
`node --import ./tests/ts-resolver.mjs --test tests/unit/league-signup-link.test.ts tests/unit/house-league-registrations.test.ts tests/unit/house-league-signup-guard.test.ts tests/unit/league-pay.test.ts tests/unit/club-frame-guard.test.ts tests/unit/club-stage4a-guard.test.ts tests/unit/house-league-ratings-guard.test.ts tests/unit/family-email-guard.test.ts tests/unit/support-console-stage5-guard.test.ts tests/unit/support-console-stage5-sender-guard.test.ts tests/unit/league-practice-tell.test.ts tests/unit/stripe-fees-owner-rulings.test.ts tests/unit/public-face-s3b-family-emails.test.ts tests/unit/public-face-s3a-emails.test.ts tests/unit/house-league-gate-guard.test.ts tests/unit/club-stage5c-families-guard.test.ts tests/unit/marketing-campaign-registry.test.ts tests/unit/plan-billing-host-links.test.ts tests/unit/house-league-9d3-coach.test.ts tests/unit/bank-debit-desk.test.ts`
(905/905 at hand-off), then `npx tsc --noEmit --pretty false` with `NODE_OPTIONS=--max-old-space-size=8192` (clean at hand-off),
`npx eslint <the code files above>` (0 errors; the `any` warnings in lib/db.ts are old), `node scripts/check-spelling-consistency.mjs`,
`node scripts/check-public-tokens.mjs --scope=all`, `npm run check:dictionary`. `scripts/verify-changed.mjs`'s ESLint step errors on a
react-hooks plugin config issue that a direct `npx eslint` does not hit (known, not ours).

## Step 1 · /simplify

Run the built-in `/simplify` skill scoped to the Session 2 code and test files only (not the whole working tree). Worth a hard
look:
- `signupsOwingNow` (lib/league-pay-facts.ts) re-derives "owed" for many sign-ups; is `childDue` the only formula, and does
  its clearing read duplicate `signupDebits`/`isRegClearing`?
- `replaceSignupLink` (lib/league-signup-link-mail.ts) re-implements the sign-up set (`signup_ref` + `guardian_email`) a third
  time beside `signupRowsFromAnchor` (lib/league-signup-status.ts) and `signupRows` (lib/league-pay-facts.ts), and the client's
  `signupChildren` (lib/house-league-registrations.ts) a fourth. One server home is the likely win; keep the client one.
- `replaceSignupLink` and `sendSignupLinks` build near-identical emails (heading, hi, body, button, reference, footnote, send).
- `leagueMailLink`'s `url` / `owedUrl` / `online` shape, and the route's `link.owedUrl` at two senders.
- The RegistrationsScreen confirm's inline IIFE (`act?.kind === 'newLink' && (() => …)()`).
- The bank debit context's `payLabel` (team vs league).
Keep every guard's intent (repoint, never delete). Run the tests. Record what changed in the Progress block.

## Step 2 · /review

Run `/review` (the repo's adversarial funnel, `.claude/commands/review.md`) on the Session 2 files. Questions it must answer from
the code, not from this prompt:
- **The reset.** Does "Send a new link" stop EVERY sibling's old link in one write, including a sibling whose row has a
  different `link_version` (could one ever differ)? Two registrars pressing at once? A send failing after the write (the old
  link is stopped and no email went: is the registrar told plainly, and can they press again)? Is it refused for a member
  without `register`, on a finished season, for a row of another club or season (org + season checked on the read)?
- **Every mint after a reset.** Does any email, page or pay link still sign the OLD version after a reset (placement mail per
  child, receipts, bank debit, "Email me my link", the register route's literal 0)?
- **The owed rule.** Does each email carry the button exactly per the drawing's tab 5 table (confirmation always; accepted,
  promoted, placed, moved, receipt-with-balance, pay link, bank debit returned/reversed only while owed; waitlisted never)?
  Is `owingCents > 0` the right "owed" (a clearing debit; an open Stripe checkout)? Does `signupsOwingNow` agree with
  `loadLeaguePayFacts` for the same sign-up?
- **The address.** Can the full guardian address still reach the family's browser anywhere (page props, the pay block, the
  post-checkout poll, a 409 message, the withdraw answer)? Can a masked address reach Stripe as `customer_email`?
- **Stripe line names.** First names only on every line Stripe shows; the club's record keeps full names.
- **Unsubscribe.** With the secret unset: no link drawn, every token refused, marketing sends refused and logged, nothing
  throws on a send path (`buildUnsubscribeUrl` returns null now: every caller handles it?). With it set: byte-identical tokens
  to before (existing links in inboxes keep working).
Apply what it confirms, run the tests, record findings and fixes in the Progress block (anything left open as an owner question).

## Step 3 · /docs

Run `/docs` (`.claude/commands/docs.md`) for the user-facing changes of BOTH Stage 1 sessions (Session 1 shipped no docs):
the family page is "Your sign-up" (first names, reference to quote, the foot line); "Email me my link" replaced the email +
reference lookup; a link ends 30 days after the season is finished unless money is owed; one "Your sign-up" button in family
emails, only while owed after the confirmation; the club's "Send a new link" row (who can, what it stops, the history line);
"Email the pay link" now opens their sign-up page. Known stale spots: `lib/help-content/house-league.tsx` (around lines 961,
1055, 1058: the old page and the reference lookup) and the "Paying by card" article. Grep the help content and its
`keywords`/`searchText` for "Check your registration", "status page", "reference and your email", "View your receipt",
"See your registration". One spelling everywhere (`check:spelling`). Record what changed.

## Step 4 · commit

The owner has said to commit (this prompt is that word). One commit, Session 2's files only:
1. `git rev-parse --abbrev-ref HEAD` → `dev`. Re-run the tests above first.
2. Stage the files above by explicit path (`git add -- <path>`). For each records file and each code/test file with foreign
   hunks (`lib/email-kinds.ts`, `tests/unit/league-practice-tell.test.ts`, and any file another session touched since), stage
   only Session 2's hunks with the temp-index method (memory note "Partial commit out of shared files": temp index, exact
   edits, `commit-tree` + compare-and-swap `update-ref`). Run the pre-commit hook's checks by hand if you build the commit that way.
3. **Leave out** the schema snapshot files and `memory/reference_db_schema.md` (they carry other sessions' work; a records
   commit), and `.probe/`.
4. **No committed file may import another session's uncommitted module.** Check the staged tree's imports.
5. `git diff --cached --name-only` before the commit; `git show --stat HEAD` after it. Only Session 2's files.
6. Message: "Signed-in family accounts Stage 1, Session 2 (Parts 5-8): one "Your sign-up" button in family emails; the club's
   Send a new link; first names on Stripe; the parent's address masked; no fallback unsubscribe secret", plus the
   attribution line from the system reminder.
7. Record the hash in this Progress block, in the build prompt's Session 2 bullet, the plan's Stage 1 note, the TODO line,
   §437 in the ledger and the memory note `project_end_state_signed_in_family_app.md` (+ its MEMORY.md line). Those record
   edits stay uncommitted (say so), as Session 1 did.
8. Tell the owner, in product-owner words: what is now committed, that walk §437 is the next step
   (https://claude.ai/artifact/3sFyR5BcRptmAZ9isBKYRk), and the production steps still owed before any promote that carries
   Stage 1: migration 419 to prod, UNSUBSCRIBE_SECRET confirmed in Amplify, and a check of production's customised family
   email templates. The two owner calls stay open.
