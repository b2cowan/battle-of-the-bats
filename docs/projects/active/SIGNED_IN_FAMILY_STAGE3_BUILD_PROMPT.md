# Signed-in family accounts · Stage 3, A second parent's email on the house-league sign-up: build (prompt)

> **Written 2026-11-03.** Plan of record: `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md`, Stage 3 (the **"DRAWN + RULED 2026-11-03"** block
> under it wins where they differ). Drawing: `SIGNED_IN_FAMILY_STAGE3_DRAWINGS.html`
> (https://claude.ai/artifact/5NRGyGJgJU11DaVuhL9fHY). **Open the drawing before building each Part** (Artifact `read`): its
> words, frames and tags are the spec. Where the drawing and this prompt disagree, the drawing's words win and the prompt's
> mechanics win. **Paste this into a new chat on `dev`.**
>
> **Binding inputs, do not reopen — the six Stage 3 asks, ALL ruled A on 2026-11-03:**
> 1. An always-visible box **"Second parent's email"** under Email and Phone. No name is asked. **No "(optional)" tag** (owner
>    ruling 2026-08-26: only required labels carry an asterisk).
> 2. The second address gets **every email about the sign-up**, including the "Your sign-up" link and the pay link, with the
>    drawing's "who added you / not you? tell the club" line on its copy. **Receipts and refunds stay with whoever paid, as today.**
> 3. The marketing tick-box covers the **first parent only**. The second address is **never** put on a marketing or
>    consent-based list.
> 4. The club's **"Email families"** messages reach **both parents of each household, counted once**.
> 5. The **coach sees** the second email; the form's coach line is updated to say so.
> 6. The club screens: **record window (view and edit), "Add registration" window, export column, and search.** The Families
>    book, the draft board, the household counts and the Families book's own second-guardian write are **untouched**.
>
> Also drawn and binding: **one address per sign-up, not per child** (siblings are one household); the same address as the first
> (capitals and spaces ignored) is **refused inline**; the second address has **its own hourly send limit**; **no parent-side edit**
> until Stage 4; the second parent's greeting is **"Hi,"** (no name is asked).
>
> **One migration** (no column exists today; decide from `docs/agents/db/DATA_DICTIONARY.md` and the snapshots, **never from
> migration files**). Latest migration on disk when this was written: 429. **Take the next free number after checking the folder
> and `MANUAL_PROD_STEPS.json`**; other sessions share this working copy. Schema = dictionary in the same unit of work:
> `DATA_DICTIONARY.md`, then `npm run refresh:snapshots`, then `npm run check:dictionary`.
>
> **Helpers' leads are leads.** Lines marked **[V]** were opened by the author on 2026-11-03; lines marked **[H]** came from a
> helper's search and were not opened. Re-verify every [H] before building on it. Stage explicit paths only, commit only your
> own hunks, check `git diff --cached --name-only` before every commit, **commit only when the owner says**. Read "Shared-file
> traps" at the bottom first.
>
> **Recommended model: Opus 5.5, two sessions.** Session 1 = Parts 1–3 (column, intake, the first email). Session 2 = Parts 4–6
> (every other email, the club screens and coach, closeout). Update the Progress block after each Part. Helpers stay on Sonnet
> for reading; the census in Part 4 is a helper job.

## ▶ Progress (read first when resuming)

- Fill in as each Part lands: Part, date, commit hash (written when the owner says to commit), tests run, anything done differently from this prompt and why.
- **Session 1 (Parts 1–3) BUILT 2026-11-03, uncommitted (commit waits on the owner).** Tests: `tests/unit/league-second-parent.test.ts`
  (new; behaviour for the reader and the words, source guards for the route, placement, migration, email builder and form),
  plus the neighbours `house-league-signup-guard`, `house-league-place-guard`, `league-signup`, `league-signup-link`,
  `public-face-s3b-family-emails`: 186/186 pass. `npm run typecheck` clean; `lint:focused`, `check:spelling`,
  `check:dictionary`, snapshot freshness clean. Full `npm test`: 13512/13519, the 7 failures all in other sessions' in-flight
  files (admin overlay, plan billing usage, public tournament stage 6 walk, stripe mode, support console stage 3); none touch
  this stage. `check-schema-parity` lists 430 among the dev-only changes awaiting prod, as expected.
  - **Part 1:** migration **430** `430_a_second_parent_gets_the_signup_emails.sql`, applied to DEV 2026-11-03; prod step in
    `MANUAL_PROD_STEPS.json`. Column `league_registrations.guardian_email_2` + CHECK (lowercased, trimmed, non-empty, ≤ 200,
    **never equal to `guardian_email`**). ⚠ **Differs from the prompt:** the migration ALSO redefines
    `league_registration_place` (from the live dev definition) to write the column from `p_child->>'guardianEmail2'` inside
    the same locked step; a follow-up UPDATE after placing would have let a child be placed without it. The duplicate rule is
    unchanged (still the first address). Grants unchanged (verified). Dictionary entry written; snapshots refreshed.
    ⚠ **For Part 5:** the CHECK means a staff edit of the FIRST email to equal the second is refused by the database. The
    staff route needs a worded refusal before it gets there.
  - **Part 2:** one shared module `lib/league-second-parent.ts` (client-safe) holds every word of the stage and
    `readSecondParentEmail` (empty → none; malformed → refused; the first's own address, case and spaces ignored → refused).
    Part 5's staff screens should call the same reader (their "same" refusal will need staff words, not "yours"). The route
    throttles the second address on its own after the first, before any write. Form box, hint, coach line and finish sentence
    as drawn; placeholder `name@example.com` from the phone frame.
  - **Part 3:** the route sends both parents' copies through **one** `sendTransactionalEmail` call in a loop, each copy in
    its own try (keeps the "one email per sign-up" guard, now read as per parent). The second parent's copy greets "Hi," and
    opens with `SECOND_PARENT_WORDS.addedYou` (one string, for the `/marketing` pass). ⚠ **The custom-template path cannot
    carry the line** (a customised `league_signup` is a platform template with tokens only, and it greets the first parent by
    name), so the second parent **always gets the built-in email**: new `builtInOnly` option on `sendTransactionalEmail`
    (same kind, log and envelope; only the template lookup is skipped). The "tell the club at …" address is the club's
    public contact (`systemMailFace().contact`); with none, "tell {club name}". Logged like the first (kind `league_signup`).
- **Session 2 (Parts 4–5, Part 6 tests) BUILT 2026-11-03, uncommitted (commit waits on the owner).** Tests: new
  `tests/unit/league-second-parent-fanout.test.ts` (behaviour: the recipient rule, the greeting swap, staff words, list search;
  source guards: every census sender, receipts/refunds/bank-debit/consent never, the screens, the coach) + the Session 1 file +
  `house-league-coach-read-guard` (column list updated, ask 5): 50/50. Three neighbours' guards re-pinned to the new wording,
  intent kept (`families-stage5a-guard` the season send still attaches first; `league-signup-link` the answer is still the first
  parent's send; the refusal-words choice renamed `'club'`, since `house-league-gate-guard` reads `'staff'` as a role). Those six
  files: 272/272. Full `npm test`: 13538, 10 failing → the 4 above fixed; the other 6 are other sessions' in-flight files
  (billing free time, public tournament stage 6 walk, key-prefix allow-list, support console footer). Typecheck: clean for this
  stage (one error in another session's `plan-ending.test.ts`). `lint:focused` 0 errors, `check:spelling`, `check:dictionary` clean.
  **Dev server restart owed** before anyone browses it (new modules, `lib/types.ts`, `lib/db.ts`).
  - **Part 4 — the one helper is two modules:** `householdRecipients` / `secondParentsOf` (client-safe, `lib/league-second-parent.ts`)
    is the recipient rule; `lib/league-second-parent-mail.ts` (server) sends. **Census result** (helper census, every line opened):
    accepted, waitlisted, moved off the waitlist, released / declined / withdrawn (`[regId]` route); the new "Your sign-up" link;
    the pay link; placement and moved-team; schedule published and games changed; practice times; practice changes; a season's
    "Email families", its one-household "Message this family" and its "Send to the N it missed". Receipts, refund email and
    bank-debit mail untouched (guarded).
  - **⚠ Differs — the second copy RIDES ON the first parent's:** it goes only when the first parent's copy went (sent, or skipped
    where no mail service is set). So an outbox row's "sent" means both went, and "Send again" after a failure reaches both, never
    a duplicate to the second parent. Cost: a first address that bounces leaves the second unreached until it is fixed. The copies
    go as their OWN batch after the first, so the outbox rows' index-aligned outcomes, the counts and "told" are untouched.
  - **⚠ Differs — the refund's "Email the pay link" answer stays with the first parent** (it carries a refund block; refunds follow
    whoever paid). The plain and price-raise pay links go to both. **The ending emails (release, decline, withdraw) go to both,
    money line included**, as the prompt's table says; the pay link already shows the second parent what is owed and paid.
  - **Greeting:** `secondParentCopy` swaps the builder's first greeting ("Hi <strong>Priya</strong>," / "Hi Priya,") for "Hi,";
    a guard pins every fan-out builder to one of those two shapes. The second copy is always the built-in email (`builtInOnly`).
  - **Added, not in the prompt's table:** "Email me my link" — a second parent typing THEIR OWN address now gets that sign-up's
    link (two reads, never an or-string from typed text; greeted "Hi,"). It widens no one's reach: an address only receives mail
    at itself. A coach who is a second parent this schedule send reached is skipped by the coach copy, as a parent is.
  - **"Email families" counts:** "Will be sent", the server's recount and the history still count HOUSEHOLDS; a household now has
    one more address in a season scope. Suppression stays per address (an opted-out second parent stays out; a household whose
    first parent opted out is reached through the second). Club-wide scopes and the Families book read persons, unchanged.
    No consent gating exists in that audience (census); a guard keeps the marketing consent off the second address.
  - **Part 5:** record window "Second parent" row under Email (dash when none) with an Add / Change link that opens a box in place
    — the record had no edits before; ask 6 ruled this one. **Who may edit: the desk (`register`, the registrar too), as "Add
    registration" types it** — the first email's fix is `run`. Applies to every child of the `signup_ref` (a hand-added child with
    no reference is its own sign-up). **A staff edit sends nothing** (shipped behaviour). The first email's edit now refuses, in
    words, an address equal to the second (mig 430's CHECK would otherwise 500). "Add registration" box; export "Second Parent
    Email" (sensitive) beside Guardian Email; search on screen and on the server; the coach's page mails and copies both (one
    mail door, the second address under the first on a desk).
  - **Not done in this session:** `/simplify`, `/review`, `/docs`, `/marketing` (offered to the owner), the owner walk, the
    plan / TODO / memory records. The "Your sign-up" toast still names the first address only.
- **Stage 3 (Sessions 1–3) committed `bacf24a9b` 2026-11-03** (44 files; mig 430 applied to dev, prod pending; schema snapshots
  not in it — they also hold other sessions' tables; not pushed).
- **Session 3 (/simplify + /review, high-risk tier, 2026-11-03) — fixes landed, one commit of the stage.**
  - **/simplify applied:** the second addresses are read in chunks (`fetchAllIn`; one long read would have failed on a big
    season and been swallowed, leaving every second parent silently unreached); the sign-up confirmation's second copy now
    follows only a first copy that went (it was the one sender that did not); a second copy whose greeting cannot be swapped
    is logged loudly; `sendSecondParentTransactional` lost an unused parameter and return value; the resend and schedule
    sender no longer build per-person / per-household lookups eagerly or quadratically; dead words and exports removed.
    **Skipped:** merging the four outbox senders' parallel `households`/`messages` arrays into one (aligned today, traced in
    all four; the change touches four tested call sites for no behaviour change); using the ending email's helper wrapper
    (the refund stamp is deliberately recorded between the two sends).
  - **/review fixed (security lens, all verified in code):**
    1. **HIGH — a household message reached a stranger.** Outbox emails (placement, schedule, practice times, practice
       changes) are built for everyone under one FIRST address in the season, and the first address is never verified. Someone
       could sign up with a stranger's address as the first and their own as the second, and — once staff placed that child —
       receive the real family's children, teams, times and pay link. **Now a second address receives a household message only
       when it is on EVERY sign-up that message names** (`onEveryRegistration`); a mixed household tells the first parent only.
       The second parent still gets everything that is built from their own one sign-up (confirmation, "Your sign-up" link,
       per-child status emails, pay link). Cost: a mother who adds a second child later without the father's email stops the
       father hearing the household emails until it is added to both — owner may want a staff prompt for that (open question 5).
    2. Staff paths could 500 on an address over 200 characters (the column's CHECK) — now refused in words, both staff windows.
    3. The staff edit of the second address was scoped to the sign-up reference alone; it now also matches the first email and
       the club, like every other reader of "a sign-up" (a reference collision could have written another family's rows).
    4. "Message this family" and "Send to the N it missed" reached the second parent of a declined or withdrawn sign-up (or
       one outside the original audience); both now stop at live / active sign-ups. A resend of a narrower audience (one team)
       can still reach a household's other-team second parent — bounded, recorded as open question 6.
    5. The pay-link second copy followed `no_answer` as well as sent; now the same "first went" rule as every sender.
  - **Owner questions raised (not decided; behaviour as ruled until answered):**
    1. **The ending emails (release / decline / withdraw) carry a money line, and a withdrawal email exists only when money
       moved.** The second parent therefore receives the refund amount, method and the club's "kept" reason, and the
       registrar's free-text family note (up to 2,000 characters; decline and release only). The prompt's table says "both,
       money line included", so it ships as ruled — but it sits next to "refunds follow whoever paid". Options: keep; drop the
       money line for the second parent; or drop only the free-text note.
    2. **No stop link on the second parent's mail.** Everything after the confirmation goes as club service mail (no
       unsubscribe, by design, for first parents too), and the "tell the club and we'll remove you" line is on the
       confirmation only. A stranger typed as a second parent has the club's address as the only way off. Option: add that one
       line to every second copy.
    3. **One address as the second parent of many sign-ups mails them once per household per bulk send.** Throttle limits
       sign-ups per hour per address per server, not the later fan-out. Option: one copy per address per send.
    4. **"Email me my link" for a second parent opens the same sign-up page the first parent has (pay and status).** Accepted
       in ask 2; recorded because the link is a stronger thing than the "check status" the form hint describes.
    5. A household with two sign-ups where only one names a second parent is now told on the first parent's address alone for
       the household-wide emails (see fix 1). Option: show staff when a household's sign-ups disagree.
    6. Resend of a team-scoped "Email families" can reach second parents of the household's other teams.
  - **Advisory, left as is:** a refused second-address sign-up has already spent one of the first address's hourly tokens (the
    comment now says so); the public form silently cuts an over-long address at 200 (the first email's old behaviour); a
    second copy that fails after the household row is recorded is logged, never retried (documented).
  - **Tests:** `league-second-parent.test.ts` + `league-second-parent-fanout.test.ts` and the eight neighbours: 425/426. The one
    failure, `house-league-gate-guard`, is another session's in-flight edit to `seasons/[seasonId]/route.ts` (a role read),
    not this stage's.

## Gate (blocking, before any code)

1. Present the **Product Manager UX plan** in plain language (what a parent, the second parent, club staff and a coach each see
   and do differently; benefits; role differences), per `AGENCY_RULES.md`. The drawing is the visual spec; the plan is words.
2. Do **not** restate prices, plan names or gates anywhere. This stage touches none.
3. Nothing in this stage changes what FieldLogicHQ charges, so the `/accounting` review is **not** triggered.

## Part 1 · The place to keep it (migration + dictionary)

- Add **one nullable text column** on `league_registrations` for the second parent's email (suggested name
  `guardian_email_2`; check the dictionary's naming for siblings of `guardian_email` first). Stored **normalised the same way
  as `guardian_email`** (lowercase, trimmed; `normalizeGuardianEmailRequired` is the helper the route uses [V] — read it).
  Every child in one sign-up carries the **same** value (the sign-up's `signup_ref` already groups them).
- **Why a column and not a table or the outbox tables [H]:** the outbox tables (`league_placement_emails`,
  `league_schedule_emails`, `league_practice_emails`) are one row per guardian email plus a `registration_ids` array. **Do not
  add a second-address column to them.** Part 4 expands the recipients at send time from the registrations. Confirm this
  against the dictionary and the builders before settling; if a builder cannot expand at send time, say so and ask.
- No index unless a query in Part 5 (search) needs one; `guardian_idx` stays as it is.
- Dictionary entry in the same change: what the column holds, who writes it (public form, staff), that it is **never** a
  household key, and that **it is never read for marketing or consent**. Refresh both snapshots. The prod step goes in
  `MANUAL_PROD_STEPS.json` as the other migrations do; **apply to dev only**, prod is applied before the promote.
- **Dev DB schema first:** read it from `information_schema` on dev, not from migration files.

## Part 2 · The form and the route (asks 1, 5; the inline refusals)

- **Form** `components/league/RegisterForm.tsx` [V: Parent or guardian section at 285–317, Email 301–308, Phone 309–313, coach
  line 315–316, guardian state one object near line 69, POST body near 107–112]. Add the **"Second parent's email"** box under
  the Email/Phone row, in its own full-width `formKit` field, **bare label, no asterisk**, with the drawing's hint ("They'll get
  the same emails you do about this sign-up. We only need their email, not their name."). Inputs inherit the 44 px floor from
  `formKit.input`; do not restyle. Error under the input uses `formKit.errorMsg`. Change the coach line to the drawing's words
  ("…and the second parent's email if you add one."). **Draw from the shipped component**; the existing red required asterisk
  on this form is as shipped, leave it.
- **Route** `app/api/league/[orgSlug]/[seasonSlug]/register/route.ts` [V: guardian fields read at 106–111, validation 135–140,
  per-address throttle 147, placement call 165–175, consent 199–205, sign-up email 221–240, staff notice 241–252, response
  254–269]. Read `body.guardianEmail2` (same `str(…, 200)`), then:
  - Empty is fine and changes nothing anywhere.
  - Not empty and not `isValidEmail` → `errors.guardianEmail2 = 'Enter a valid email address.'` (the first email's words).
  - Same as the first after normalising → `errors.guardianEmail2 = "That's the same email as yours. Leave this empty or enter the other parent's."`
    (the drawing's words; use the product's curly apostrophe as the other messages do).
  - **Throttle:** call `throttlePublicFormRecipient` for the second address as well, **before any write**, beside the first call
    at 147 (`lib/public-form-throttle.ts` [H]). A refused second address refuses the whole sign-up with the existing 429 words.
- Pass the normalised second address into `placeLeagueRegistration` (`lib/league-registration-place.ts` [H: normalises the
  first email near line 64]) so **every placed child's row** carries it. Read that module's insert and its duplicate rule
  first; **the duplicate rule must not start keying on the second address**.
- **Response:** add `guardianEmail2` beside `guardianEmail` (254–256) and update the finish screen near RegisterForm 420–441
  [H: "We've emailed this to <guardianEmail>" at 439] to the drawing's sentence: **"We've emailed this to {a} and {b}."**
  With no second address it reads exactly as today.
- **Marketing consent (ask 3):** `recordLeagueMarketingConsent` [V at 199–205] keeps taking **the first address only**. Add a
  source guard test that the second address never reaches it.

## Part 3 · The second parent's confirmation (ask 2, first email)

- In the route's email step [V 221–240], send the **same confirmation** to the second address too: same `leagueSignupHtml`
  content, same "Your sign-up" button (the link is the sign-up's, signed for the first registration, so both parents open the
  same page), **plus the drawing's line at the top** and the greeting **"Hi,"**. The drawing's draft words:
  *"{First parent's name} added your email to {child}'s sign-up so you get the same updates. If you aren't {child}'s parent or
  guardian, tell the club at {club contact email} and we'll remove your address."* For several children use the existing
  children-aware phrasing the first email uses (read `signupSubject` and the builder). **These are draft words for a
  `/marketing` pass in Part 6; build them from one string so that pass is one edit.**
- `leagueSignupHtml` is a template with a custom-template path (`sendTransactionalEmail` key `league_signup`) [V]. Read how the
  custom template and `family` footer work. **A club-customised template must not silently lose the "who added you" line**:
  if the custom path cannot carry it, send the second parent the built-in version and say so in the Progress block.
- Send the second email **independently**: its failure must never fail the sign-up, the first email, or the response (same
  try/catch pattern as 238–240). Log it the way the first is logged.
- The family footer / unsubscribe behaviour stays as the first email has it. **Do not add an unsubscribe link** to the second
  parent's copy: sign-up mail has none today and the drawing's "tell the club" line is how a wrong address comes off.

## Part 4 · Every other email fans out (ask 2, ask 4) — the census part

This is the part most likely to be incomplete. **Start with a helper census** (`general-purpose`, read-only): every place
that sends to a house-league guardian, from this author's [H] list below; open each cited line before relying on it.

| Email | Where [H] | What to do |
|---|---|---|
| Accepted, waitlist-promoted, spot released, declined, withdrawn | `app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts` (≈73, 586, 614, 740, 757) | also send to the registration's second address |
| "Your sign-up" new/replaced link | `lib/league-signup-link-mail.ts` | also to the second address |
| Pay link | `lib/online-payment-receipt.ts` `sendLeaguePayLink` (≈249–297) | also to the second address (ask 2) |
| Placement and moved-team | `lib/house-league-placement-mail.ts` (≈75; outbox row `league_placement_emails`) | expand at send time; counted once per household |
| Schedule published, games changed | `lib/league-schedule-mail.ts` (≈221, 368), `lib/league-game-changes-server.ts` (≈99–104) | expand at send time |
| Practice-change email | `lib/club-schedule-league-mail.ts` (≈78; groups by lower(btrim(guardian_email))) | expand at send time |
| First-practice and practice-times email | `lib/league-practice-tell-server.ts` (≈456, 483–514) | **already ruled to go to both, counted once** (9d-3, 2026-11-01); this is where that ruling lands |
| Club "Email families" | `lib/house-league-email.ts` `sendSeasonEmail` (≈186) | ask 4: both parents, **counted once** in "Will be sent" and the history row |
| Payment receipt, refund notice, bank-debit mail | `lib/online-payment-receipt.ts` (≈52–109), `lib/online-refund-email.ts` (≈182–194) | **unchanged** (follows whoever paid) |

Rules for the whole Part:
- **One shared helper** that, given a registration set, returns the household's recipient list (first address plus every
  distinct second address, de-duplicated case-insensitively, first parent always first). **Every row above calls it; no
  call site writes its own expansion.** If a builder works from the outbox table's `guardian_email` and `registration_ids`,
  the helper takes the `registration_ids` and reads their second addresses.
- **The second address is sent to separately, not as a Cc** (each parent gets their own message; some mail systems show Cc'd
  addresses to both).
- **Suppression:** the club's opt-out list is per address (`family_email_optouts`; `getFamilySuppressionList` [H]). The second
  address follows the same rules the first does for whichever door the email uses (service mail skips suppression; "Email
  families" respects it). **Do not invent a new rule.**
- **Marketing/consent audiences:** read how "Email families" builds its audience before changing it. If any audience is gated on
  a consent row, the second address must stay **out** of it (ask 3). Add a source-guard test.
- **Counts:** "Will be sent" and history rows count a household **once** even though two addresses receive it. Say in the
  Progress block what the number now means; do not change any label.
- Households are keyed on the **first** address everywhere (`householdKey`, `signup_ref` + `guardian_email` in the pay/status
  joins [H]). **None of those changes.** If you find a place that must change to make a row above work, stop and report it.

## Part 5 · The club screens and the coach (asks 5, 6)

All [H] until opened. Open the drawing's tab 3 first.

- **Registration record window** (`components/admin/kit/club/league/registrations/RegistrationRecordWindow.tsx` ≈70–72): add a
  **"Second parent"** row under Email (the drawing), showing a dash when none. **Staff can edit it** in the same place and
  through the same route that changes the first email today (`registrations/[regId]/route.ts` ≈427–446 changes the guardian
  email for the **whole sign-up**; the second address changes the same way: all children in the `signup_ref`). Same validation
  as the form, same refusal when it equals the first. **A staff edit sends nothing** (no email to the new address on edit;
  report this in the Progress block as the shipped behaviour).
- **"Add registration" window** (`AddRegistrationWindow.tsx` ≈115): same optional box, same words.
- **Export** (`registrationsExport.ts` ≈25, 60): a new **"Second Parent Email"** column beside "Guardian Email", **marked
  sensitive the same way**. Position as in the drawing.
- **Search** (`lib/house-league-registrations.ts` ≈447): also match the second address. Siblings grouping (≈366) stays on the
  first.
- **Coach** (`app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx` ≈126–142; supplied by `lib/house-league-coach.ts` ≈476):
  the mailto/copy-emails set includes the second address, de-duplicated. The form's coach line (Part 2) already says so.
- **Not touched:** Families book (`lib/families-read.ts`, `families-export.ts`), draft board and household counts, the public
  status page's masked email, the registrations list columns (no email column exists; do not add one).
- Check any **role-summary or hook that copies fields by hand** (memory `reference_role_summary_hook_copies_fields`): a new
  field on a registration needs the route, the type and any hand-copy.

## Part 6 · Closeout

1. **Tests** (unit; behaviour where the runner allows it, source guards where it cannot, and say which is which): the
   route's three refusals (invalid, same as the first, throttled); empty second address changes nothing; every placed child
   carries the address; consent never takes the second address; the shared recipient helper (dedupe, case, first parent first,
   no second address, siblings with the same second address once); the finish sentence both ways; the record window row, the
   export column and the search; a source guard over the census table that every sender in it calls the helper; and a guard
   that the receipt/refund senders do **not**.
2. `npm run verify:changed`; `npm run typecheck` (API contracts, shared modules, a migration).
3. **Spelling gate** (`check:spelling`) on every new word. The sign-up words: *"Second parent's email"*, the hint, the refusal.
4. **`/simplify`** (a new shared helper is a new abstraction), then **`/review`** (high-risk tier: API, DB, email fan-out; ask for
   the **security lens** on "a typed unverified address receives a link that shows what is owed and takes a payment", already
   an owner-accepted cost in ask 2; the review should check that nothing makes it worse, e.g. the second address reaching an
   email that carries more than the first parent's own link would).
5. **`/docs`**: the sign-up help for families and the registrar article for the record window and export
   (`lib/help-content/*.tsx`; update the `keywords`/`searchText` with the words). **`/marketing`**: the second parent's email
   words (Part 3's single string), the hint, the refusal.
6. **Demos:** none asked per commit. If the demo seed writes league registrations, the new column is nullable and needs nothing.
7. **Owner walk**, one purpose, checkable (house format; memory `feedback_qa_walkthroughs_as_checkable_artifacts`): a sign-up with
   and without a second parent; the same address refused; both inboxes get the confirmation and the second has the added
   line; accept, waitlist and decline reach both; a placement and a schedule reach both once; "Email families" counts one
   household and sends two; a receipt goes only to the payer; the record window row, edit, "Add registration", export, search;
   the coach's copy-emails; put back. Needs a Resend key on dev. Write it to `docs/projects/active/`, publish it, add the next
   §number to `OWNER_QA_LEDGER.md` (never reorder the numbers).
8. Update the plan's Stage 3 block with the commit hash (when the owner says to commit), `TODO.md` (one line), the Progress
   block here, and the memory index. **Before the next promote:** the migration to prod (`MANUAL_PROD_STEPS.json`).
9. **Offer `/review` once** at the end; the owner decides. The counsel (PIPEDA / CASL) review that gates Stage 4 should also be
   shown the Stage 3 drawing; **nothing in this build waits on it**, but say so in the hand-off.

## Shared-file traps

- Several sessions share one working copy on `dev`. `git status` showed unrelated modified files when this was written
  (`CLAUDE.md`, `TODO.md`, plan and pricing docs, `lib/basic-coach-teams.ts`, `lib/user-contexts.ts`, others). **Do not stage them.**
  Stage explicit paths; `git add -p` for hunks in shared files (`TODO.md`, the plan, `OWNER_QA_LEDGER.md`).
- `lib/help-content/*.tsx` is shared across sessions; edit only the house-league sign-up and registrar entries.
- A newly added file, a changed shared module (`lib/types.ts`, `lib/db.ts`) or a migration means the dev server **must be
  restarted before handing off** (`AGENTS.md` restart rule): stop it, delete `.next`, `npm run dev`, confirm login returns 200
  and no Supabase `EACCES`.
- Dev has every plan on sale by design; do not "put it back".
- Never edit hooks or settings; this stage has no reason to.
