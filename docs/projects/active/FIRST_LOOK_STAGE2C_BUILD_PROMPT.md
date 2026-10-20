# The first look — Stage 2c build prompt: the Continue page, forgot and reset

Paste into a fresh session. Written 2026-10-20 by the session that built and committed **Stage 2b** (sign-in and the
way back into it, `04c0ea1c2`; 2a is `d1a5742c2`). **This session builds 2c only**, commits it alone on the owner's word, then closes Stage 2's
records (the ladder row, one QA walk for all of Stage 2, `/docs`). Stage 3 is a separate build.

**The spec is still `FIRST_LOOK_STAGE2_BUILD_PROMPT.md`**: read its *2c*, the `/marketing` table's **Reset screens**
row (the final strings), *Keep*, *Verify*, *QA* and *Success*. `FIRST_LOOK_STAGE2B_BUILD_PROMPT.md` holds the shared
lessons (committing, the verify chain's reds, source pins); read its *Lessons* and *Committing*. This file adds only
what 2b changed, settled or learned. Where they differ, this file is newer.

---

## Read first (delegate the broad reading; read the lines a decision turns on yourself)

1. `CLAUDE.md`, `AGENTS.md`, `AGENCY_RULES.md`. One `dev` branch, explicit pathspecs, ask before the commit, never push.
   Run `git status` first: the working copy is shared.
2. `FIRST_LOOK_SIGNUP_PLAN.md`, **As built, Stage 2** → the **2b** block (what you reuse and why).
3. The undrawn-states page, **U3 and U4** only: https://claude.ai/artifact/353241emo2NHrP1m6tPyjQ (source
   `FIRST_LOOK_STAGE2_UNDRAWN.html`, grep it; it embeds images). Delegate: "the exact drawn order, strings and states
   of U3 and U4", nothing else.
4. `memory/design_decisions.md`, the 2026-10-20 entry **"THE WAIT AND THE WAY BACK"** (the notices' colours were
   corrected at 2b: olive when nothing went wrong, amber for a wait, red for a wrong password alone).

## The blocking gate

1. **A PM UX summary in the chat** for the Continue page, forgot, reset-confirm and reset-password: phone and computer,
   Warm and Dark.
2. **Re-check the drawings against the code** (below). Anything the code does that U3/U4 do not show goes to the owner
   as a question with a recommendation **before** it is built. 2b found four such gaps at its gate and one more in
   review; expect some.
3. No words are open: the Reset screens row and the Continue page's strings are final.

## What 2b built that 2c reuses (do not rebuild it)

- **The kit, `components/auth/AccountForm`:** `StartColumn`, `StartHead`, `Field`, `EmailField` (now with `invalid`
  → red edge + `aria-invalid`), `PasswordField` (`purpose="create"` puts "At least 8 characters." under it, which is
  the reset screen's drawn hint), `StartFoot`, and the classes `primary` / `secondary` / `notice` / `noticeWarn` /
  `noticeError` / `noticeSent` / `hintError` / `forgotRow` / `footLink` / `body` / `callout`.
  - A notice is `<div className={accountForm.noticeWarn} role="alert|status"><strong>Title.</strong>{' '}Body.</div>`.
  - ⚠ **Turbopack's `composes` is not transitive.** A new variant lists `callout` itself, or it draws no box. 2b's first
    build shipped invisible notices this way; only the captures caught it.
- **The one loading line:** `<StartColumn><LoadingState label="Loading …" /></StartColumn>`. The label must start with
  "Loading" and end with "…". reset-password's "Verifying reset link…" fails both rules and says "verify".
- **U3 is half-built.** `SIGN_IN_REASON.expiredLink` and `expiredLinkSignInHref(next)` are in `lib/auth-errors.ts`,
  and sign-in already shows the amber notice plus "Email me a new link". The Continue page's invalid state should
  `router.replace(expiredLinkSignInHref(…))` (no screen of its own). Its link carries no reliable `next`, so pass
  `null` unless the URL really has one. Then correct the `SIGN_IN_REASON` comment, which says the Continue page
  "joins it in 2c".
- **Capture and accessibility probes:** `.probe/first-look/cap-stage2b.mjs` (phone + laptop, Warm + Dark, with
  browser-answered auth calls) and `aria-stage2b.mjs` (the accessibility tree per state). Copy them for 2c.
  `partial-stage-2b.cjs` stages the plan and the design log as HEAD plus your exact section.

## Facts re-checked 2026-10-20 (line numbers drift; confirm before editing)

- **All four pages** still import `../auth.module.css`, use its card/header/iconWrap/submitBtn/footer classes, and
  style with inline `var(--font-data)` monospace plus `--fl-text`, `--data-gray`, `--danger-light`, `--logic-lime`.
  Moving them off the module moves those colours too, or lime text lands on paper.
  - After 2c, **only `suspended`** (and `suspended/SignOutButton.tsx`) imports `auth.module.css`. Delete the classes
    nothing imports, and keep the file and `.authSurface` (the layout's). `tests/unit/account-first-signup.test.ts`
    ~L510 forbids some old class names in it.
- **Headings today:** "Verify Email" (signup-confirm ~L71), "Reset Password" (forgot ~L102, reset-confirm ~L89), "Set New
  Password" (reset-password ~L117).
- **signup-confirm:** `verifyLink()` (~L10) is the Supabase-host check; the button navigates in `onClick` only (~L47).
  Keep both exactly; a test pins `verifyLink`. The invalid state (~L28–33) is today's "This verification link is
  invalid…" plus a *Create account* link to `/auth/signup`, which U3 replaces with the redirect.
- **reset-confirm:**
  - Keep exactly:
    - `authActionLink()` (~L15), the Supabase-origin check;
    - the `onClick`-only navigation (~L55, so a mail scanner cannot spend the token);
    - the `RESET_RETURN_KEY` / `stampResetReturn` stamp (~L62).
  - Its invalid state (~L38) is "This link is invalid. Request a new one below."
- **reset-password:**
  - It has **five** states: `waiting | ready | expired | success | error` (~L10). Keep all five.
  - Keep the destination after success: `readResetReturn(RESET_RETURN_KEY)` (~L85).
  - It has its own eye toggle (~L158); the shared `PasswordField` replaces it.
- **forgot-password:**
  - It reads `next` through `registrationReturnPath` and `email` from the URL (~L13–14).
  - Its route always answers `{ok:true}` and has **no rate limit**. Report that as a finding and do not add one (the
    owner's call).
  - Since 2b, sign-in's *Forgot your password?* passes `next` (not `email`).
- **Layout sweep:** add forgot, reset-confirm (the tap page and its invalid state) and the Continue page as anonymous
  entries next to 2b's `auth-sign-in*` block in `scripts/layout-screens.mjs`.
  - Run them with `--only=<ids>`, never `--changed`: other sessions' files widen it to the whole list.
  - The app bar's 27px wordmark link is a known shared-chrome finding (reported at 2b). Do not baseline it.

## Close Stage 2 after 2c (records)

- Add **2c** lines under *As built, Stage 2*.
- Set the Stage 2 ladder row to Built, with the three commit hashes.
- Write **one QA walk for all of Stage 2** (spec's *QA*, one checkable Artifact, one job per walk; next free § in
  `OWNER_QA_LEDGER.md`, never sorted). It must cover:
  - 2a's owed real-inbox check: Gmail, Apple Mail and Outlook, light and dark, phone, plus a customised copy of each
    template sent and then removed. Staging only.
  - A real expired link and a used link (staging).
  - A waiting account (staging; localhost has confirmation off).
  - An expired **organization invitation** link: it should land on the invitation's own "This invitation link has
    expired" screen (the owner's call at the 2b review).
  - Wrong password, existing address, forgot → reset end to end.
- The TODO line.
- **Offer `/docs` once for all of Stage 2.** The help that is now wrong:
  - `lib/help-content/coaches.tsx` ~L219–227, `tournaments.tsx` ~L724–729, `platform-admin.tsx` ~L122–124: they say
    the resend sits "in" the message and that sign-in says "verify". Since 2b it sits under the amber notice.
  - `platform-admin.tsx` ~L58 ("Forgot password flow").
  - `.claude/commands/helpdesk.md` ~L54, ~L145 match the old "incorrect email or password" text. That file is a
    shared agent command, so ask before changing it.
  - Leave `platform-admin.tsx`'s "Reset Password" (~L54, 77, 104) alone: it names the admin's menu action.
- **⚠ 2a and 2c must reach production in the same release** (the emails' button opens the Continue page). Say so in the
  release record if 2c slips.
- **Restart the dev server before the owner's walk** (2b and 2c change shared modules). Stop it before clearing `.next`.

## Open findings carried (report; do not fix on the way past)

- The forgot-password route has no rate limit.
- The team sign-up (`app/team`) and the platform-admin sign-in keep their own copies of the old error words.
- The account-only sign-up shows a sign-in failure's raw code.
- The UAT scenarios each carry their own sign-in steps (a shared helper would stop the next markup change touching 17
  files).
- `components/auth/PasswordInput.module.css` belongs to no colour-token scope (`check:tokens` red). It is in this area:
  offer to scope it, but it is a check's registry, so it is the owner's call.
- 2a's handed-on list (the invitation page's missing `next`, the seed words, `&quot;` in plain text) stands.

## Success

The spec's *Success*, plus: no screen or email in Stage 2 says "verify" to a customer, and every Stage 2 screen is on
the kit (only `suspended` still wears `auth.module.css`).
