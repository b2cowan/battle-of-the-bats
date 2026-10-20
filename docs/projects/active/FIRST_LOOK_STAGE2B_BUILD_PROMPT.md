# The first look — Stage 2b (and then 2c) build prompt: sign-in and the way back into it

Paste into a fresh session. Written 2026-10-20 by the session that built and committed **Stage 2a** (`d1a5742c2`: the
warm email envelope and the two account emails). **This session builds 2b, then 2c if context allows**, each committed
alone, asking the owner before each commit. Stage 3 is a separate build.

**The spec is still `FIRST_LOOK_STAGE2_BUILD_PROMPT.md`.** Read it whole first, including its sections *2b*, *2c*, the
`/marketing` read (the final strings), *Keep*, *Not in Stage 2*, *Verify* and *QA*. This file does not restate it. It
adds only what 2a changed, settled or learned. Where the two differ, this file is newer.

---

## Read first

1. `CLAUDE.md`, `AGENTS.md`, `AGENCY_RULES.md` (delegate the broad reading). The rules that bite:
   - one `dev` branch;
   - explicit pathspecs only, ask before every commit, never push;
   - the spelling and clock gates;
   - "disagree out loud";
   - argue from what the code does.
   The working copy is shared: run `git status` first.
2. `FIRST_LOOK_STAGE2_BUILD_PROMPT.md` (the spec).
3. `FIRST_LOOK_SIGNUP_PLAN.md`, section **As built, Stage 2**: what 2a built, the three owner calls answered at its
   gate, the findings it left open.
4. The undrawn-states page, U1–U8, ruled 2026-10-20: https://claude.ai/artifact/353241emo2NHrP1m6tPyjQ (source
   `FIRST_LOOK_STAGE2_UNDRAWN.html`). It holds the Dark notice colours (the spec, nothing to rule) and the U4 reset
   screens.
5. `memory/design_decisions.md`, the 2026-10-20 entry **"THE WAIT AND THE WAY BACK"**: every U1–U8 ruling in one place.

## The blocking gate (same as Stage 2's; 2a ran it for the emails only)

1. **A product-manager UX summary in the chat** for sign-in, the notices, the callback's reason and "Email me a new
   link" (2b), then the Continue page, forgot and reset (2c). Cover phone and computer, Warm and Dark.
2. **Re-check the drawings against the code** before building each part. Anything the code does that the drawings do
   not show goes to the owner as a question, with a drawing, before it is built.
3. **No words are open.** U1, U2, U3, U7 and the reset screens' strings are final in the spec's `/marketing` table.
   The owner's three gate calls (league sentence, the one-hour line, the account-only sentence) were email-only and
   are built.

## What 2a changed that 2b and 2c build on

- **The confirmation email now names the step the link really goes to.** It takes the start door's sentence only when
  the link returns to that door's step 2; otherwise it says the registration, Home, or "Then you're in." So when
  **"Email me a new link"** or *Send the link again* passes sign-in's `next`, the email already tells the truth about
  where that link lands. Keep passing `next`; do not add a door or a sentence on the screen side.
- **The resend route's answer is unchanged:** the same `{ok:true}` whatever happens, on purpose. U7's wording exists
  because of it. Do not change the route.
- **The emails' "Confirm my email" button opens the Continue page, which still says "Verify Email".** 2c fixes it.
  ⚠ **2a and 2c must reach production in the same release.** Say so in the release record if 2c slips.
- **Reusable from 2a:** none of the email pieces belong on a screen. The screens use Stage 1's `components/auth/`
  pieces, as the spec says.

## Facts re-checked 2026-10-20 (line numbers drift; confirm before editing)

- **Sign-in** (`app/(consumer)/auth/login/page.tsx`):
  - The ids to keep are `#login-email` (~L186), `#login-password` (~L201) and `#login-submit` (~L239).
  - The loading lines "CHECKING SESSION..." (~L158) and "VERIFYING CREDENTIALS..." (~L282) are `HudSkeleton`s; they
    become the product's one loading line (`LoadingState`, auto-memory `decision_one_loading_line`).
  - The waiting-account `ResendLink` is ~L220.
  - Errors come from `SIGN_IN_ERROR_COPY[err]` (~L141).
- **`lib/auth-errors.ts`:**
  - `invalid_credentials` still reads "Incorrect email or password. Please try again."
  - `email_not_confirmed` still says "verify". It is shared with tournament registration (`RegisterContent.tsx`
    spreads the map at ~L90).
  - U1's new sentence carries an inline link, so it probably cannot live in a plain string map. Decide by reading
    both screens, and change a shared line in both places in one commit.
- **`/auth/callback`'s fall-through** is now ~L52, `router.replace('/auth/login')`, not L68 as the spec says. Add the
  reason only when the URL really failed (an error in the hash such as `otp_expired`, or no code at all). Leave every
  success path byte for byte as it is: invitations go through this page.
- **The layout sweep** (`scripts/layout-screens.mjs`) still has no `/auth/*` screen. The spec says to add sign-in, the
  Continue page, forgot and reset-confirm as anonymous entries.
  - ⚠ Another session has that file uncommitted right now. Add your entries as HEAD plus your exact edits (see
    *Committing* below).
- **The QA ledger's last section was §350** on 2026-10-20. Take the next free number at build time and never sort.

## Lessons from 2a (they cost time; skip the cost)

- **Edit code with the Edit tool or a script written to a FILE.** A bash heredoc dropped the backslashes from regex
  strings twice in 2a (auto-memory `reference_js_replace_dollar_patterns`). Several of these files have CRLF line
  endings, and Edit handles that.
- **`npm run verify:changed` stops at the first red, and on 2026-10-20 four reds belonged to other sessions:**
  - a coaches colour in `coaches.module.css`;
  - `components/auth/PasswordInput.module.css` belonging to no token scope (committed `640d27031`);
  - a duplicated `color` in `GuidanceRail.module.css`;
  - dev and prod schema parity (mig 338 is on dev only until the promote).

  Run the chain's remaining steps yourself past a red that is not yours, and report each red as theirs. If
  `PasswordInput.module.css` is still unscoped when you touch `components/auth/`, it is in your area: say so and offer
  to scope it, but do not do it unasked (it is a check's registry, so it is the owner's call).
- **Source pins.** `tests/unit/account-first-signup.test.ts` and `signup-verification-guard.test.ts` pin exact lines:
  the login error-box JSX, `ResendLink`'s "Sent again at {clock}…" line, the
  `classes={{ button: styles.errorAction, … }}` object, and `.errorAction { min-height: 44px }`.
  2a's own pins are in `tests/unit/first-look-stage2-emails.test.ts`. Moving sign-in onto the shared module breaks
  several pins. Update each pin in the same change, keeping what it protects: the 44px resend target, the announced
  status line, the `next` pass-through.
- **`/simplify` then `/review` found three real defects in 2a that tests did not.** Run both before each commit, and
  give the correctness lens the concrete paths to trace: a door account resending from a sign-in headed elsewhere, a
  registration after a 409, an expired link vs a used link vs no code. Verify every finding against the code before
  acting on it.
- **Localhost has verification off.** To reach the waiting-account and check-your-email states, answer the sign-up
  POST with `requiresEmailVerification: true` in Playwright (`.probe/first-look/cap-in.mjs`). An expired or used link
  needs a real one: use an old verification link on staging. `.probe/first-look/cap-stage2a.mjs` shows how to render
  through the real builders without a server.

## Committing (each part alone, on the owner's word)

- Stage explicit paths. Run `git diff HEAD --stat` on each file first. **Shared docs** (`FIRST_LOOK_SIGNUP_PLAN.md`,
  `memory/design_decisions.md`, `OWNER_QA_LEDGER.md`, `TODO.md`) and any code file another session is mid-way
  through carry hunks that are not yours.
- Stage those as **HEAD plus your exact section**: build the blob from `git show HEAD:<path>` with your section
  inserted, `git hash-object -w`, then `git update-index --cacheinfo`. The script 2a used is
  `.probe/first-look/partial-stage-2a.cjs` (gitignored, local). Copy it and change its two anchors and section
  headings for your sections.
- Never stage the working copy of those files whole. After the commit, `git show --stat HEAD`, and confirm the other
  sessions' hunks are still unstaged in the working copy.
- Records per part:
  - add **As built** lines under the plan's *As built, Stage 2* (2b, then 2c);
  - after the last part, set the Stage 2 row in the plan's ladder;
  - write one QA walk for all of Stage 2 (the spec's *QA*), including 2a's owed real-inbox check: Gmail, Apple Mail
    and Outlook, light and dark, phone, plus a customised copy of each template sent and then removed. That check is
    staging-only, because localhost has no mail key.
- After 2c, offer `/docs` once for all of Stage 2. Help quotes "Send the link again" and the sign-in error placement:
  `lib/help-content/coaches.tsx` ~L191 and ~L219–227, `platform-admin.tsx` ~L42 and ~L122–124, `tournaments.tsx`
  ~L724–729. The "Reset Password" in `platform-admin.tsx` (~L54, 77, 104) names the admin's menu action, not the
  email; leave it.

## Open findings handed on (report; do not fix on the way past)

- The forgot-password route has no rate limit (the spec's finding; the owner's call).
- The assistant-coach invitation page sends no `next` to the coach sign-up. Someone invited who signs up with a
  different address than the invitation's lands on `/coaches` with nothing to accept.
- The template rows' seed words (mig 083) still say "Verify…". A data migration is owed with The public face's S3,
  or sooner on the owner's word.
- A registration whose POST returns no id still sends the registration sentence. Low; it needs a malformed response.
- `htmlToText` leaves `&quot;` in a plain-text part (every email, pre-existing).

## Success

The spec's *Success* section, unchanged. Plus: no screen or email in Stage 2 says "verify" to a customer.
