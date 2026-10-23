# The public face, warm: S3a, one envelope for every email (build prompt)

> **Written 2026-10-23.** **Paste this into a new chat on `dev`.** It is a **build**, the biggest mechanical one in the
> project. The plan is `PUBLIC_FACE_WARM_PLAN.md` (the S3a row of the ladder, Ask 9 and Ask 11, and "Round 1 rulings");
> the identity rules are `docs/agents/brand/VISUAL_IDENTITY.md`.
> **Model: Sonnet, effort high.** Run `/review` before committing.
> **Order (owner, Ask 11): S1 → S3a → S4 → S5 → S3b.** S1 is built (`7bba2136d`). S3a goes **before Club Stages 9 and 12
> begin** (they add and change emails) and before S3b. Club Tier has builds in flight and the working tree is shared:
> run `git status` first and look at every `lib/*email*` and `lib/notify.ts` line another session has touched. Stage explicit
> paths only; check the branch is `dev` before committing.

## The ruling this build carries out

**Every email we send wears ONE warm envelope.** Today two emails do (the verification email and the password reset, built by
The first look in `lib/email-envelope-warm.ts`) and about 45 more wear a near-black card with a lime letter-spaced
"FIELDLOGICHQ" (`wrap()` in `lib/email.ts`, around line 143). Five more files each hand-build their own shell. S3a moves them
all onto the warm one. It is **a migration onto an existing envelope, not a design**: do not draw a second envelope, add a
palette, or change the envelope's look. If something cannot be done in the existing envelope, stop and report it.

**Keeps today's wordmark line.** The ruled new identity (the Joined FL mark, the Arial name line) ships with S4. S3a keeps the
current Courier "FIELDLOGICHQ" wordmark line exactly as `email-envelope-warm.ts` has it, so nobody sees two identities.
Do not touch it.

**Not in S3a:** the club's logo and colour on family emails (that is S3b); the new wordmark (S4); the operator alert email
(`lib/observability/alerts.ts`, internal); any change to who gets an email or when.

## Step 0: the words come first (Ask 4: "a `/marketing` voice pass in every stage, before its code")

Before any code, run `/marketing` on the words of these emails and have it write its findings to
`docs/projects/active/PUBLIC_FACE_WARM_S3A_EMAIL_COPY.md`: no system words, buttons that say what happens next. The plan
already routes these to it; settle them in the same pass:
- the "FieldLogicHQ · Canada" sign-off (`lib/email.ts` near line 1405, `lib/email-sender.ts` near line 58): brand rule, and a thin
  CASL mailing address;
- the registration email's "FieldLogicHQ does not process online payments" (Club Stage 12 may change it; do not decide it
  here, flag it);
- the Premium welcome's "Everything from your free portal carries over" (`lib/email.ts` near line 638);
- the coach footer link text.

Then **build only the wording that doc approves.** Anything it leaves open stays as it is today. If the owner wants the
building to start before the pass, they will say so; do not assume.

## What "done" means

1. **One envelope.** `wrap(content)` keeps its name and signature (45 callers: 42 in `lib/email.ts`, plus
   `lib/club-schedule-send.ts`, `lib/feedback-email.ts`, `lib/platform-email-templates.ts`) but now produces the warm document
   (`warmEmailDocument` in `lib/email-envelope-warm.ts`): white card, ink text, Arial, `color-scheme: light only`, no footer
   word. Re-read the current `wrap` and `warmEmailDocument` before you start; the census below was taken 2026-10-23 and the
   files may have moved.
2. **The inner colours move too. This is the real work.** About 170 hard-coded colours sit inside the builders' own content
   (`rgba(241,245,249,...)`, `#F1F5F9`, `#94A3B8`, `#0F172A` panels, lime `#D9F99D` as TEXT, blue `#1E3A8A` buttons). Left as
   they are on a white card they become pale text on white. Map them by role, by hand, builder by builder (a script may do the
   mechanical part but a lime heading on dark and a lime button fill are different cases):
   - light body text → `WARM_EMAIL.ink`; muted text → `WARM_EMAIL.secondary`;
   - lime used as text or a link on dark → olive (`WARM_EMAIL.olive`), because lime is never text on paper (identity rule);
   - buttons → `warmEmailButton` (the Outlook-safe lime button with the olive edge), one button style everywhere;
   - dark panels and callouts → the warm callout look already defined in `WARM_MARKUP_LOOK`;
   - borders and rules → `WARM_EMAIL.cardEdge`.
   Add nothing to the palette. If a role has no token, report it.
3. **The "house" look is retired.** `emailLookFor` / `wearsWarmEnvelope` stop splitting two keys from the rest: every platform
   template (customised ones, the founding-season campaigns, the editor's preview, the test-send) renders warm. Remove the
   dark `house` tokens in `lib/email-markup.ts`, or leave a single look if removing breaks a type; say which.
4. **The five own-shell files move onto the envelope**, content and legal wording unchanged:
   - `lib/notify.ts` (`notificationEmailHtml`): dark shell + blue "View →" button → envelope + `warmEmailButton`.
   - `lib/basic-coach-announcements.ts` (`announcementEmailHtml`): keep the team-name line and the roster-contact footer line,
     word for word.
   - `lib/family-email.ts` (`familyEmailHtml`): shell and palette only. **Keep the guardian unsubscribe footer exactly**
     (`familyEnvelopeFooterWords`, `buildGuardianUnsubscribeUrl`). The team name stays as a plain text line. **No club logo or
     club colour: that is S3b.**
   - `lib/dues-reminder-email.ts` (`duesReminderEmail`): it is also imported by a client component
     (`components/coaches/DuesReminderPreviewModal.tsx`), so it must stay pure and framework-free. The envelope file already is.
     Keep `transactionalFamilyFooterHtml` wording ("sent even if you have unsubscribed").
   - `lib/practice-plan-email.ts` (`practicePlanEmail`): nearest to warm already (ink `#241E15` vs `#211c15`, Inter vs Arial).
     Fold onto the shared tokens. Its time column is Courier: use the data role the type check defines if
     `VISUAL_IDENTITY.md` says a time column qualifies, otherwise Arial with tabular figures; say which you chose.
5. **The unsubscribe footer** `injectUnsubscribeFooter` in `lib/email-sender.ts` (dark, lime-tinted) becomes a warm footer
   with the same legal words and the same link. It is inserted before `</body>` or appended, so it must work on a full document.
6. **`coachPortalFooter`** (lime link on a dark rule, `lib/email.ts` near line 175) becomes an olive link on a warm rule, same
   words (as the Step 0 doc allows). Keep it OUT of `wrap` (the comment there says why).
7. **The plain-text part is unchanged.** `htmlToText` already strips `<head>`; verify the new document does not leak style text
   into it.
8. **Times and dates in emails** go through `formatTime()` / `formatStoredDate()` only (house clock: "8:00 a.m."). Do not hand-roll
   one while you are in these strings.
9. **Spelling:** `npm run check:spelling` is part of `verify:changed`. Fix, never silence.

## Guards to add or update (the build is not done without these)

- **`tests/unit/first-look-stage2-emails.test.ts`** pins `wrap`'s exact dark opening (around lines 143 to 145) and the
  editor/send paths' two-look split (around 134 to 140). Both must be **rewritten to pin the new truth**, not deleted: `wrap` produces
  the warm document; every key renders warm. Re-read the whole file first; it also pins the Courier wordmark, which stays.
- **A new guard:** no email source file (the `EMAIL_FILES` list in `scripts/check-public-type.mjs` plus the five files above)
  contains the old dark palette (`#111827`, `rgba(241,245,249`, `rgba(30,58,138`, the blue `#1E3A8A` button, lime as `color:`
  text). It should name the file and line when it fails. Look at how `public-type-guard.test.ts` builds its scratch-tree tests
  and follow that.
- **`npm run check:public-type`:** the EMAILS section of `--report` is this stage's to-do list (about 9 face, 34 caps, 25 heavy
  on the day it was run). Take the counts down by actually fixing them, not by adding `type-ok` markers; then run the ratchet
  so the baseline in `scripts/.public-type-baseline.json` is lowered and locked. Seven `#reference` numbers and an org ID in
  `lib/email.ts` are the "data" role from S1; they need a helper that can carry a marker (an email template string cannot hold a
  comment: mark the line above).
- Check `tests/unit/email-markup.test.ts` (pins the house button `#D9F99D`) and glance at `family-email-guard`, `practice-plan-send`
  and the Club stage guards for markup assertions before you change the builders they cover.

## How to see what you built

There is **no preview surface for most builders** (only the platform-admin template editor, the Families "See the email" sample,
the dues-reminder modal and the admin campaign preview). Write a one-off script in `.probe/` (gitignored) that renders every
builder with sample data into one HTML page you can open, and use it to check each email by eye before handing over. Do not
commit it. If you script the colour swap, write the edit script to a `.cjs` FILE and use split/join rather than `replace()` with
`$` patterns (known trap), and read every diff, because the same colour means different things in different places.

Also ask: do any stored platform templates in the dev database hold hard-coded dark colours in their saved body (rather than
tokens)? Report it; do not write to production.

## Constraints

- Concurrent sessions: shared tree. Stage explicit paths only. Ask before committing.
- Shared modules are touched (`lib/email.ts`, the sender, the envelope): run `npm run typecheck` and `npm run verify:changed`,
  and restart the dev server before the owner tests (AGENTS.md restart rule).
- No migration is expected. If you find you need one, stop and say why.
- Real send path unchanged: same recipients, subjects, batching, opt-out checks. This is a look change. If a diff touches who
  receives an email, revert it.

## Before code (AGENCY_RULES)

Give the owner the plain-language UX summary first (what a person opening any of these emails sees differently, and that the
words are unchanged except what `/marketing` approved), then build.

## After the build

- `/review` (offer `/simplify` too: this build touches a shared helper and many call sites), then commit after the owner says yes.
- Offer `/docs` only if a help article describes how emails look.
- **A checkable QA walk Artifact** (house walk format: one purpose, checkboxes, paste-back). The honest test of an email is an
  inbox, so the walk is: the owner sends themselves one of each **family** of email from the platform-admin test-send (account,
  registration and tournament, coach and team, league, billing and org, family and dues, practice plan, the unsubscribe footer),
  and opens them in **Gmail, Apple Mail and Outlook, in light and in dark mode**. Each step names the email, says what to
  expect (white card, readable ink, one button style, wordmark line unchanged, footer words intact) and has a "Skipped" twin
  where the owner has no Outlook. Sending real test mail to the owner's own address is the owner's call: ask first.
- Records: the plan's ladder row ("built, commit `<hash>` <date>"), the ledger (new section, never reorder the numbers), TODO's
  public-face line (only if no other session has uncommitted edits in TODO.md), and the auto-memory `project_public_face_warm`.
- Offer a `/demos` note only if a demo story shows an email's look.

## Census taken 2026-10-23 (verify; it is a lead, not evidence)

- `lib/email-envelope-warm.ts` (156 lines): `WARM_EMAIL` palette (ground `#f6f1ea`, card `#fff`, cardEdge `#dad3c9`, ink `#211c15`,
  secondary `#665f57`, olive `#55641c`, lime `#d9f99d`, Arial), `warmEmailDocument`, `warmEmailBody`, `warmEmailButton`,
  `warmEmailHeading/Paragraph/Small`, `WARM_MARKUP_LOOK`, `wearsWarmEnvelope`, `emailLookFor`.
- `wrap()` at `lib/email.ts` around line 143: a fragment (no doctype), `#111827`, lime FIELDLOGICHQ. 42 call sites there; also
  `club-schedule-send.ts`, `feedback-email.ts` (two uses) and `platform-email-templates.ts` (the house path for every
  non-warm template, so campaigns too).
- `lib/email.ts` carries about 146 of the ~174 hard-coded dark-palette colours in `lib/`; the rest are in `email-markup.ts` (6),
  `basic-coach-announcements.ts` (4), `family-email.ts` (5), `feedback-email.ts` (5), `notify.ts` (3), `email-sender.ts` (2),
  `family-mail-footer.ts` (2), `club-schedule-send.ts` (1). `feedback-email.ts` and `club-schedule-send.ts` are not in the five
  named copies but have their own dark colours: they move too.
