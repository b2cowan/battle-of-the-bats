# The public face, warm: S3b, family emails in the club's name (build prompt)

> **Written 2026-10-23.** **Paste this into a new chat on `dev`.** **Model: Sonnet, effort high** (the plan's row: per-club
> contrast and logos in email, mail-client quirks). Run `/review` before the commit. The plan is `PUBLIC_FACE_WARM_PLAN.md`
> (the S3b row); the identity rules are `docs/agents/brand/VISUAL_IDENTITY.md` (section 3: email); **the words are
> `PUBLIC_FACE_WARM_S3B_COPY.md`** (ruled by `/marketing`; two lines are marked **To confirm**); **the drawings are the
> contract:** https://claude.ai/artifact/Q77tjshN7iDMf4hGMM9HS5 (source `PUBLIC_FACE_WARM_S3B_DRAWINGS.html`). Open the
> drawings first and keep them open: every chip opens its reason, and the frames are the real builders' output.
> **Order (owner Ask 11 + Ask 8 A): S1 ✓ → S3a ✓ → S4 ✓ → S5 ✓ → Club 7c's one-email-per-child follow-up (its own small
> stage, its own walk) → S3b.** If that stage has not landed when you start, say so; this build does not touch the season
> email's sending loop (see "Do not"), it only passes the club to whatever sender that route uses. The tree is shared: run
> `git status` first, stage explicit paths, check the branch is `dev`, and **ask before committing.** `TODO.md`, the plan
> and the ledger carry other sessions' uncommitted edits: commit only your own hunks (see the partial-commit note in the
> auto-memory).

## What this build carries out

Every family email wears the club's identity on the warm envelope: a band in the club's colour with its name as text, a
logo-or-initials tile, a thin accent rule, FieldLogicHQ as a quiet line at the foot, one line that says where a reply goes,
and the club's name in the inbox's sender field. The owner ruled **all nine asks as recommended** (2026-10-23).

| Ask | Ruling |
|---|---|
| 1 | Sender name `{Club} via FieldLogicHQ` on every family email, name cleaned and capped. |
| 2 | Band with the club's name; the logo on a white tile when it is a PNG or JPEG, the initials otherwise. |
| 3 | All 14 family emails wear it: the five on the shared sender, the dues reminder, the tryout receipt, the seven registration emails. A platform-edited (customised) template wears it too. |
| 4 | Person-sent mail replies to its sender. System mail replies to the club's **public-site contact** when it has one, and says "won't reach anyone" when it does not. |
| 5 | The registration mails and the tryout receipt name the club, carry a "Sent by … because …" footnote, and the decline stops pointing at the platform's Gmail. |
| 6 | Dark mode: promise only what holds (the band and its text change together); real apps are checked on the walk. |
| 7 | The free-tier coach announcement and the generic "View" email **stay exactly as S3a left them**. |
| 8 | The 7c one-email-per-child follow-up is its own stage **before** this one. Not in this build. |
| 9 | The seven house-league headlines go to sentence case with no emoji; the game-change link loses its arrow. |

## Step 0: the words are already settled

Apply every line marked **Approved** in `PUBLIC_FACE_WARM_S3B_COPY.md`; leave **Held** lines exactly as they are. Run
`/marketing` on the two **To confirm** lines (headline "Added to the waitlist" and the empty-name sender default) and apply
its ruling. Do not reword a sentence the file does not list. Spelling gate: `npm run check:spelling`.

## What to build (each census line is a lead from 2026-10-23: open it before you rely on it)

**The drawings show the band by string surgery on the real envelope (that is how a drawing was made from real output). Do not
build it that way: compose the band natively in the envelope.**

1. **One pure club-identity module** (suggested `lib/email-club-identity.ts`), framework-free and free of anything
   server-only, because the dues preview and the Families "See the email" sample import it in the browser. Input: the plain
   facts of a club (name, `logoUrl`, `themePreset`, `themePrimary`, `themeAccent`). Output: the band's parts: fill, text on
   fill, accent, tile colours, initials, and whether a logo may be used. **Colours come from `clubColourRoles()`
   (`lib/club-colour-roles.ts`) and nothing else; initials come from `clubInitials()` (`lib/club-site.ts:47`).** Never add colour
   logic. The accent rule is dropped when the accent equals the fill, **and also when the accent is a lime or yellow-green**
   (so a lime rule never sits above the email's one lime button).
   *Logo rule:* use the logo only when the URL is https on the project's storage host (the same host test
   `deriveLogoDataUrl` in `lib/export/resolve-pdf-settings.ts` uses), the file is a PNG or JPEG (the stored extension), and
   **its width and height are known**. A relative stock-logo path, an SVG, a WebP or an unknown size means the initials tile.
   ⚠ Dimensions are not stored. Reuse the existing derived-logo cache pattern (`logoDerived` in `pdf_settings`, written with its
   compare-and-swap) to record a logo's size once, **if it can hold it without a schema change**. If it cannot, **STOP and ask**:
   a new column is out of scope. Until a size is known the email shows initials (a safe default), never a squashed logo.
2. **The envelope** (`lib/email-envelope-warm.ts`). `warmEmailDocument` (and `warmEmailBody`) take an optional club identity.
   **With none passed, the output must be byte-for-byte what S3a ships** (a test pins this; every non-family email, the free-tier
   announcement and the generic "View" email depend on it). With one: the card cell carries the class **`fl-flush`, not `fl-card`**
   (⚠ the phone rule `.fl-card{padding:22px 18px!important}` beats an inline `padding:0`, which is exactly how the drawing's
   first phone frame came out inset), the FieldLogicHQ name line leaves the top, and the band sits flush across the card's
   width with the card's own padding moved onto an inner `fl-pad` block. Add `.fl-band` and `.fl-pad` phone rules to the head
   CSS (12 px 18 px and 18 px 18 px 22 px). Band markup as drawn: a table cell with `bgcolor` and `background`, the name as
   text in Arial 18/700 in the text-on-fill colour, a 44 px tile cell, the accent rule as a **`border-bottom` on the band cell
   (never an empty row: Outlook desktop stretches it)**, inner table `width="100%"`, name cell `valign="middle"` with
   `word-break:break-word`. A 53-character name must wrap beside the tile on a phone and on a computer. Tile: initials 16 px/700
   in the tile colours; with a logo, a white tile holding the `<img>` at its real aspect inside 36 px, alt text = the initials in
   the club's ink, `display:block`. No image is ever required to read the club. Card end: the quiet platform line (words 2),
   12 px, `WARM_EMAIL.secondary`, the name line inside it from `emailNameLineHtml()` at 12 px (add a size option; do not copy
   the markup).
3. **The footer order.** One club paragraph in a fixed order: *Sent by {club} because …* → the reply line → the unsubscribe link
   (the announcement mails) — then the platform line. The existing footnote builders take an optional reply line and place it:
   `familyEmailHtml` in `lib/family-email.ts` (between the reason and the unsubscribe link), `transactionalFamilyFooterHtml` in
   `lib/family-mail-footer.ts` and `duesReminderFooterHtml` (after the "speak to your coach" sentence). The existing words
   `familyEnvelopeFooterWords` and the dues "sent even if you have unsubscribed" sentence **do not move** and their tests stay
   as they are.
4. **The sender name** (`lib/email.ts`: `sendEmail` ~63, `sendEmailBatch` ~100, `FROM` ~20). Add an optional per-send display
   name to both. Keep the address from `RESEND_FROM` (take the part inside `<>` if present, otherwise the whole value) and
   build `"{name}" <address>`. The cleaning, the 48-character cap and the "via FieldLogicHQ" rule are in the words file (item 1)
   and live in one small pure function with unit tests (a name with a comma, a quote, an angle bracket, a line break, only
   punctuation, 200 characters, an accented name). The batch path builds each message's From separately.
5. **Reply-To and the reply line.** A small helper: given an org and "person-sent or system", return `{replyTo, line}` per the
   words file (items 3 to 5). The club's contact is **`getOrgPublicSiteContent(orgId).contactEmail`** (`lib/db.ts` ~1366;
   ⚠ `Organization.contactEmail` is always empty: do not read it, and do not fix that TODO here). Read it **once per send or per
   sweep run per club**, never once per email. Person-sent mail: "Email families" and "Message this family" already set
   `replyTo` to the sender (keep; a source test pins it); **add** it for the rep-team announcement (the coach, from
   `createdByUserId`) and the house-league season email (the admin sender). If the sender's address is not readily available at
   one of those two sends, **STOP and ask** rather than invent a lookup. The named-sender line needs a display name: use what
   the route already has, else the "the sender" fallback.
6. **Thread the club through the senders** (every path is a lead; open each). Shared sender: `sendFamilyEmail` and
   `sendFamilyEmailBatch` take the club identity facts and the sender name; they are the single place the five family emails
   pick it up. Callers: `lib/families-email.ts` (~178), `app/api/admin/families/[personId]/message/route.ts` (~78): both hold
   the whole organization already; `lib/rep-team-announcements.ts` (~273: widen the `organizations` select from `name` to the
   four extra columns); `app/api/admin/house-league/seasons/[seasonId]/email/route.ts` (~103); `lib/family-notify.ts` (~121:
   widen the select the same way; the game-change notice is system mail). Dues: `lib/dues-reminders.ts` (~88-152, the sweep) via
   `getInsightsDigestTeams` in `lib/db.ts` (~3527, selects `id, slug, name`: **add the four colour/logo fields to that one
   read**); the coach route `app/api/coaches/[orgSlug]/teams/[teamId]/dues/send-reminders/route.ts` and the admin route
   `app/api/admin/rep-teams/dues/send-automated-reminders/route.ts` hold the organization. The dues senders use the raw
   `sendEmail` **on purpose** (transactional: do not route them through the family guard). Tryout receipt:
   `tryoutRegistrationConfirmationHtml` (`lib/email.ts` ~963) from `app/api/rep-teams/[orgSlug]/[teamSlug]/tryouts/[yearId]/register/route.ts`
   (~128: the route already holds `org` and does not pass it). Registration mails: the seven builders in `lib/email.ts`
   (~762-953) from `app/api/league/[orgSlug]/[seasonSlug]/register/route.ts` (~184) and
   `app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts`. Each builder takes the club as an optional
   argument and passes it to `wrap()`. **No new select if the route already holds the organization.**
7. **Customised templates** (`lib/platform-email-templates.ts`: `renderResolvedEmail` ~130, `renderPlatformEmailHtml` ~42,
   `sendTransactionalEmail` ~172). A customised row renders a heading, body and button inside the envelope with no club. Pass
   the club (and the footnote and reply line) through so a customised tryout receipt or registration email wears the band and
   the foot too. The operator's heading and body stay theirs. The template editor's live preview and test-send render the
   same envelope: give them a sample club so what the operator sees matches what is sent.
8. **The words in the middle** (words file items 6, 10, 11): drop the eyebrow when it equals the club's name; the seven
   headlines; the arrow. Search `lib/help-content` for each old headline and update any article, `keywords` or `searchText`
   that quotes it.
9. **The two screens that show the email.** The Families "See the email" sample (`components/admin/kit/club/SendParts.tsx`
   `SendSample` ~84 and `sendEnvelope` ~61, used by `EmailFamiliesWindow.tsx` ~269 and `MessageFamilyWindow.tsx` ~153) is a
   small JSX mock that shares footer words with the real email and nothing else: draw the band in it from the pure module, so
   the sample cannot promise a look the email does not have. The dues preview (`components/coaches/DuesReminderPreviewModal.tsx`,
   which renders `duesReminderEmail` in the browser) inherits the band from the builder: pass it the same plain facts, and
   keep `lib/dues-reminder-email.ts` pure (nothing server-only may enter it).

## Do not

- Change who gets an email, how many, or when. **Do not touch the season email's one-at-a-time loop**: that is the separate
  7c stage (Ask 8). Do not add a schema column or migration.
- Touch the unsubscribe or CASL words, "FieldLogicHQ · Canada", the dues "sent even if you have unsubscribed" sentence, the
  suppression guard (`getFamilySuppressionList`, the choke point), or `tests/unit/family-email-guard.test.ts`'s pins (add to
  its manifest only what a new file requires).
- Give the **free-tier coach announcement** (`lib/basic-coach-announcements.ts`) or `notify()`'s email channel (`lib/notify.ts`)
  a band, a sender name or a Reply-To (Ask 7 A). Touch the tournament registration set, the club schedule send, the practice
  plan, allocation reminders, invites, billing or platform campaigns.
- Add a data-URI logo (Gmail strips it) or an attachment (the sender cannot send one). Add an image anything depends on.
- Add a colour or a token silently. Reopen the envelope, the palette or "one lime per view".
- Reword "FieldLogicHQ does not process online payments" (a coach-facing tournament email; Stage 12's and `/marketing`'s).
- Commit, push or touch `master` without the owner's say-so. Edit `TODO.md` while another session has uncommitted edits in it
  (say so instead).

## Guards (the build is not done without these)

- A new test file (suggested `tests/unit/public-face-s3b-family-emails.test.ts`) pinning: **a call with no club returns the exact
  S3a document** (compare against the builder's output with no club for one email of each group); each of the nine drawing
  cases (ocean preset, soft yellow `#FFE9A8`, cream `#F3F0E6`, pink `#E0457B`, grey `#808080`, night navy `#0F1B33`, no colours,
  green with accent `#FACC15`, a 53-character name) keeps the name on the band at 4.5:1 or better; a WebP, SVG, relative or
  unknown-size logo yields the initials tile; the band has `bgcolor`, the name as text and no `<img>` when there is no usable
  logo; the card cell is `fl-flush`; the accent rule is a border and is dropped for a lime accent; the sender-name cleaner;
  the eyebrow rule; the reply helper (person-sent, system with a contact, system without); the seven headlines and the
  arrow-less link; **the plain-text part** (`htmlToText`, `lib/email.ts`) of a banded email starts with the club's name and
  carries no stray alt text.
- `tests/unit/public-face-s3a-emails.test.ts` still passes untouched (the old palette is gone, the footers are pinned);
  `tests/unit/family-email-guard.test.ts` still passes (the Message door still sets `replyTo`; no unlisted family sender).
- A parity test: the Families sample and the real family email show the same band for the same club (the sample and the email
  must never drift).
- `npm run check:public-type` (the email Arial is already in scope; update the baseline file only if a count really falls),
  `npm run check:spelling` (clock: "a.m."), `npm run typecheck` (shared modules changed), `npm run verify:changed`. The unit
  suite for emails. `check:layout --changed` on the two Families windows only (not a whole-product sweep on the dev server).
- **Behaviour, by hand:** send "Message this family" to an address the owner controls and look at the real message in Gmail
  (web), the Gmail app, Apple Mail and Outlook desktop where available, **light and dark, images off and on**: the club
  identity must read with images off, the band must be flush on a phone, the sender name must show in the inbox row, and
  Reply must land where the reply line says. ⚠ Nothing in this prompt's drawings was rendered in those clients; this is the
  first time. Record what each one showed, including anything that differs from the drawings (Outlook's blocked-image box, a
  forced dark inversion of a very dark band).
- Restart the dev server before the owner tests (new files, a shared module change): stop it, clear `.next`, `npm run dev`.

## Before code (AGENCY_RULES)

Present the short plan and the plain-language UX summary in the conversation first: what a parent sees in the inbox and in
the message, what a club admin sees in the sample and the previews, what a platform operator sees in the template editor,
the benefits, and that nothing is role-gated. The drawings are the approved mockups: tag what you build NEW, RESTYLED or
UNCHANGED against them.

## After the build

1. `/review` on the diff; offer `/simplify` for the new club-identity module and the reply helper.
2. **A checkable walk, published as an Artifact** (checkboxes plus a paste-back; one purpose per walk) and a new section in
   `OWNER_QA_LEDGER.md` (read its tail for the next number; never sort the section numbers). Stations: each of the 14
   emails' look through the in-product previews (Families sample, the dues preview, the template editor), a pale and a very
   dark club, a club with no logo and a club with a logo, a long club name on a phone, the sender name in a real inbox, the
   reply path for one person-sent and one system email, and the real-inbox check of Part C (Gmail, Apple Mail, Outlook,
   light and dark) as its own part the owner may skip, as S3a's was.
3. Records, same unit of work: the plan's S3b row, the project index artifact (`stage s3b-family`, a data write, not a
   republish), the auto-memory `project_public_face_warm`.
4. The offer of `/docs`: the Families "See the email" article and the dues reminder article show the email; search
   `lib/help-content` and offer it if any match.
5. **A What's new line is needed** (parents will see the change): draft "Emails to your families now show your club's name,
   colours and logo, and replies go where you expect." and hand it to `/release` at promote; do not append it to the release
   notes before then.
