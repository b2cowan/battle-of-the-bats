# The public face, warm: S3b, family emails in the club's name (drawing session prompt)

> **Written 2026-10-23.** **Paste this into a new chat on `dev`.** **Model: Sonnet, effort high.** **A drawing and wording session:
> nothing is built.** Touches no code. Plan: `PUBLIC_FACE_WARM_PLAN.md` (Q5, Ask 6 A, the S3b row of the ladder).
> Order: S1 ✓ → S3a ✓ → S4 ✓ → S5 ✓ (committed `2e205823d`) → **S3b**. The tree is shared: run `git status` first, stage explicit
> paths if you commit anything, check the branch is `dev`, and **ask before committing.**

## What this session is for

A parent who gets an email from their child's club should know at a glance **it is their club's email**, and should not mistake
it for a marketing blast from a software company. Today they cannot tell: every family email wears the warm envelope S3a built, but
the club appears only as a line of grey text, and several family emails never name the club at all. The owner ruled the direction
on 2026-10-23 (**Ask 6 A**): *the club's logo and colour join the warm envelope; FieldLogicHQ stays in the footer; the envelope is
never replaced* (`VISUAL_IDENTITY.md` P10).

This session **draws every family email as it is and as proposed, words what changes, and gets the owner's rulings.** The build
is a later session (Sonnet, high; the plan's S3b row). Do not build.

## What is ruled (do not reopen)

- One warm envelope for every email (S3a, built). Paper-white card, ink text, Arial, `color-scheme: light only`, one Outlook-safe
  lime button, the FieldLogicHQ name line as **Arial text with no image** (`emailNameLineHtml()` in `lib/brand-mark.ts`). The
  club's identity is **added to** that envelope. It never replaces it, and no second palette is added.
- **Lime is a fill, never text on paper.** One button per email. Sentence case. No arrows.
- Voice: "Practical. Direct. Warm." **Never claim Canadian identity.** No sport-specific symbol. Words come from `/marketing`.
- The legal pieces do not move: the guardian unsubscribe footer (`familyEnvelopeFooterWords`, `buildGuardianUnsubscribeUrl`) and the
  "sent even if you have unsubscribed" line (`transactionalFamilyFooterHtml`, pinned by `public-face-s3a-emails.test.ts`).
- Who gets an email and when is out of scope. This is look and words only.

## Read first

- `docs/projects/active/PUBLIC_FACE_WARM_PLAN.md`: finding 3 (~line 73), Q5 (~line 138), the S3b ladder row (~line 234).
- `docs/agents/brand/VISUAL_IDENTITY.md`: P1–P10, §3 and §4 (the email name line and why it is text only).
- `lib/email-envelope-warm.ts` (the envelope and its tokens), `lib/family-email.ts` (`familyEmailHtml`), `lib/family-mail-footer.ts`,
  `lib/club-colour-roles.ts` (what contrast the club's colours are already guaranteed), `lib/export/resolve-pdf-settings.ts`
  (`deriveLogoDataUrl`, the safe logo read), `lib/club-share-card-image.tsx` (the club card is the precedent for "club colour + logo
  or initials tile").
- Auto-memory: `feedback_mockups_as_claude_artifacts`, `feedback_always_run_design_on_mockups`, `feedback_clickable_design_annotations`,
  `feedback_push_back_by_default`, `feedback_past_decisions_are_reference_not_authority`, `project_public_face_warm`,
  `project_club_tier_readiness`.

## The census (taken 2026-10-23: **verify each line in the code before you draw it**)

**A. Go through the shared family sender** (`sendFamilyEmail` / `sendFamilyEmailBatch`, one builder `familyEmailHtml`). The club's whole
`Organization` (name, `logoUrl`, `themePreset`, `themePrimary`, `themeAccent`) is available at 1, 2 and 4; **not** at 3 and 5:

1. "Email families" (`lib/families-email.ts`): staff to every family, a set of teams, or a house-league season. Reply-To is the sender.
2. "Message this family" (`app/api/admin/families/[personId]/message/route.ts`). Reply-To is the sender.
3. Rep-team announcement (`lib/rep-team-announcements.ts`): a Premium coach to the roster's guardians. **Loads the club name only.**
4. House-league season email (`app/api/admin/house-league/seasons/[seasonId]/email/route.ts`).
5. Game-change notice (`lib/family-notify.ts`): schedule change, cancelled, reinstated. **Loads name and slug only.**

**B. Transactional family mail (sent even if unsubscribed; each builds its own body and footer):**

6. Dues reminder (`lib/dues-reminder-email.ts`, `transactionalFamilyFooterHtml`): the nightly sweep knows only the club's name
   (`lib/db.ts` ~3563 selects `id, slug, name`); the admin and coach routes have the whole org. The coach's preview modal
   (`DuesReminderPreviewModal`) renders the same builder in the browser, so it must stay pure.
7. Tryout application received (`tryoutRegistrationConfirmationHtml`, `lib/email.ts`): **names no club at all**; the route has the
   org but does not pass it. (The tryout offer, waitlist and release emails were deleted by owner ruling 2026-08-26.)
8. House-league registration emails: approved, pending, waitlist, admin approved, admin waitlisted, waitlist promoted, declined.
   **They name no club and have no footer.** The decline email's "contact …" falls back to the platform's address because
   `contactEmail` is never filled (`TODO.md` line ~482, plan Stage 4 "Judgement calls": a per-reader decision, not one wiring).
9. A platform operator can **customise** items 7 and 8 (`platform_email_templates`); a customised template bypasses any club
   identity unless the build threads it through. Say what the owner should expect.

**C. Not decided yet:** the free-tier coach's announcement (`lib/basic-coach-announcements.ts`) has **no club** (`basic_coach_teams`
has no `org_id`); `notify()`'s email channel (`lib/notify.ts`) sends a generic "View" email to a signed-in parent who turns email
on, and loads no club data. Both are parent-facing. Propose what they do and ask.

**D. Not family mail, so out unless the owner widens it:** the tournament registration set (`lib/email.ts` ~225–1023: it goes to
registering coaches and carries the tournament host's identity), the club schedule send and practice plan (team staff only),
allocation reminders, invites, billing, platform campaigns. Say so in one line and move on.

## Four things to settle that the plan did not see

1. **The inbox shows the sender's name before anything else, and today it is always "FieldLogicHQ".** `lib/email.ts` sends from
   `FieldLogicHQ <RESEND_FROM>` for every email; the club appears only after the parent opens the message. For recognition, **the
   display name in the inbox may matter more than a logo** inside the message (most mail apps block remote images by default).
   Draw the inbox row: today's, and a proposal such as *"Riverdale Minor Ball via FieldLogicHQ"* (display name changes; the
   verified sending address does not). Push back if you think it is wrong: say what it costs in deliverability and in
   spoofing risk, and what Reply-To already does today (set only on items 1 and 2 of group A).
2. **A logo may not show.** `sendEmail` supports no attachments, no email builder embeds an image, and the name line is text for
   exactly this reason. Draw every email **with images blocked**: the design must read as the club's without the logo. A
   club-coloured band carrying the club's name in text is the likely answer; the logo is then an enhancement, or dropped. State
   what a hosted logo URL costs (a public image address in a parent's inbox, Outlook desktop's sizing, dark-mode inversion) against
   what it buys. Do not propose a data-URI logo or an attachment without saying that Gmail strips the first and the sender cannot
   send the second today.
3. **Club colour on a white card.** `clubColourRoles` guarantees a fill, its text colour and a dark-enough "ink", and was tested on
   the club site's ground and on white. Draw a **pale club**, a **very dark club**, a **club with no colours chosen** (falls back
   to the platform's navy) and a **club with no logo** (initials tile, as the club site's bar does), each as a real email. Show
   what the design does when the club's colour is a poor email colour. (Gmail and Apple Mail dark mode can still invert a "light
   only" email; draw one dark-mode frame and say what is guaranteed.)
4. **Which emails wear the club.** The ruling says "family emails". Propose which of A, B and C do (the five in group A, the three in
   group B, the two in group C), why the tryout receipt and registration mails should or should not start **naming the club** for
   the first time, and what `Reply-To` each should have (this is where the `contactEmail` TODO bites: the club's real contact is
   the public site's contact, not a field on the organization). Do not decide; recommend and ask.

## Two dependencies to state, not solve

- **Club 7c's open follow-up** (plan: `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` ~2604): the house-league season email still sends one
  at a time and mails a guardian once per child. Moving it onto the batched sender changes **who gets how many emails**, which is
  not a look change. Recommend whether it is its own small stage before S3b or a separate commit inside it, and ask.
- **Club Stage 12's receipt "in the club's name"** (plan ~2911) should reuse whatever S3b draws. Show the **receipt-shaped email** as
  one frame (a paid amount, a reference, the club's band) so Stage 12 inherits a drawing instead of inventing one. The registration
  email's "FieldLogicHQ does not process online payments" line is `/marketing`'s and Stage 12's, not yours: flag, do not change.

## What to produce

**One published Artifact**, its own page (never a Club hub). Source: `docs/projects/active/PUBLIC_FACE_WARM_S3B_DRAWINGS.html`. Start
with the Artifact tool's `quickstart` (intent `design`) and follow what it returns. Then:

1. **Today:** every email in A and B as it renders, at true size (600 wide on a computer, about 390 on a phone), with what is good
   and what is missing marked. Render them from the real builders where you can (a `.probe/` script; do not commit it).
2. **The proposal:** each email whole, before and after, on a computer and a phone, with images shown and images blocked, one
   Dark-mode-mail frame, and the four club cases from item 3 above. An inbox row for the sender-name question.
3. **Words:** the exact text of every changed line (new club line, the footer's FieldLogicHQ line, any new headline), from `/marketing`.
   Keep the "Sent by … because …" sentence and the unsubscribe words as they are unless the owner rules otherwise.
4. **What the build will touch and what could regress:** the builders' tests and pins (`public-face-s3a-emails.test.ts`,
   `family-email-guard.test.ts`, the Families "See the email" sample, which is a JSX mock that would need redrawing), the dues
   sweep's wider club read, the customised-template path, and the type ratchet.
5. **Asks:** one checkbox per option, a recommendation on each, notes boxes, a paste-back block (house format). Every highlight
   opens its explanation on click. Disagree out loud: if a premise is wrong (for example, if a sender display name beats the logo,
   or if the registration mails should not change at all), say so before drawing around it.
6. **Run `/design` on the page before the hand-off**, then `/marketing` on the words. Apply their changes, republish, say what changed.

## Do not

- Build, edit a live email, a template or a sender. Change who gets an email or when. Touch the unsubscribe or CASL wording.
- Reopen the identity, the palette, always-warm, one-lime-per-view, or "the envelope is never replaced".
- Add an image the sender cannot send, or a font that is not on Google Fonts (an email is Arial anyway).
- Edit `TODO.md` if another session has uncommitted edits in it (say so instead).

## Records, same unit of work

- The plan's S3b row: "drawn <date>, asks open" plus the artifact link. The project index artifact
  (`https://claude.ai/artifact/D5ZENgbwc8EjPQFn5MS8uu`, stage `s3b-family`, a data write, not a republish). The auto-memory
  `project_public_face_warm`.
- Record rulings as ruled, adding nothing the owner did not rule. After the owner rules, write the S3b words file and the build prompt
  as S3a and S5 did.

## Why Sonnet is enough, and where it stops being

The identity, the envelope and the palette are decided. This session applies them to a known set of emails and checks what a mail
client can and cannot show, which is verification, not new taste. **Switch to Opus** if the owner rejects the first round and wants a
different idea for the whole look, or if `/design` finds that club colours cannot be made reliable on a white card and a real
trade-off (a fixed neutral band, or no colour) has to be argued.
