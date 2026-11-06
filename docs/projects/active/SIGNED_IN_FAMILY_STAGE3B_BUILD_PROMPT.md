# Signed-in family accounts · Stage 3b, A stop button on the second parent's emails: build (prompt)

> **Written 2026-11-06.** Plan of record: `SIGNED_IN_FAMILY_STAGE3B_SECOND_PARENT_STOP_PLAN.md` (owner calls **O1–O5 ruled, all
> as recommended, 2026-11-06**; the plan wins where this prompt differs). PM brief:
> `SIGNED_IN_FAMILY_STAGE3B_SECOND_PARENT_STOP_PM_BRIEF.md`. Why it exists: `docs/agents/legal/CASL_SECOND_PARENT_EMAIL.md`
> (the `/legal` finding of 2026-11-06). Parent stage: `SIGNED_IN_FAMILY_STAGE3_BUILD_PROMPT.md` (built, walked §457).
> **Paste this into a new chat on `dev`.**
>
> **Binding, do not reopen:**
> 1. **O1** A stop applies to the club, every season, until never. It clears the address from every sign-up of that club and
>    refuses it afterwards.
> 2. **O2** The registrar **cannot undo** a stop in this stage. Build no "allow again".
> 3. **O3** **Nobody is emailed** when an address stops. The registrar's record window shows "Stopped by the address owner,
>    {date}".
> 4. **O4** Typing a stopped address is **refused in words** (form and both registrar windows), never accepted silently.
> 5. **O5** The first parent's emails are **untouched**: no new button, no new footer, same words.
> 6. **The stop IS the removal.** It clears `league_registrations.guardian_email_2`; the nine senders already read that column,
>    so **no send path gets a suppression check**. Do not "also" check the new table at send time.
> 7. **Not** `family_email_optouts`: that table means "no announcements", expands to the whole person through
>    `org_person_emails`, and the sign-up copies never read it. A new table.
> 8. **A confirm page with a POST**, never a destructive GET (mail scanners prefetch links).
>
> **Helpers' leads are leads.** Lines marked **[V]** were opened by the author on 2026-11-06; **[H]** came from a helper and
> were not opened (re-verify before building on them). Stage explicit paths only, commit only your own hunks, check
> `git diff --cached --name-only` before every commit, **commit only when the owner says**. Read "Shared-file traps" first.
>
> **Gate before any code:** present the Product Manager UX plan in plain language (what a second parent, a first parent, a
> registrar see and do differently; benefits; role differences). The PM brief file is the base; say it in the conversation.
> `/accounting` is **not** triggered (no charge changes). `/legal` already reviewed the design; re-run it only if the email
> content changes beyond the button and the line.
>
> **Recommended model: Opus 5.5, two sessions.** Session 1 = Parts 1–3 (the place to keep it, the link and its page, refusing a
> stopped address, the registrar's line). Session 2 = Parts 4–6 (the button on the five sending sites, the line, closeout).
> Update the Progress block after each Part.

## ▶ Progress (read first when resuming)

- Fill in per Part: date, commit hash (when the owner says to commit), tests run, anything done differently and why.
- **Session 1 · Parts 1–3 BUILT 2026-11-06, committed 80c9bc430.**
  - **Part 1.** Migration `448_a_second_parent_can_stop.sql` applied to **dev only**, twice (re-run no-op); proved by a rolled-back
    probe (`.probe/stop3b/probe.sql`: clears one, leaves another org alone, repeat clears 0, ids kept). **Open question answered:**
    `org_person_emails` never takes a second address (only mig 430 mentions `guardian_email_2`; the book is fed from the first
    address), so the stop clears nothing there. **Done differently:** the stop is a SQL function `second_parent_stop(uuid,text,text)`
    (service role only), one transaction, instead of two client calls, so a half-done stop cannot exist. Dictionary entry written,
    snapshots refreshed, `check:dictionary` passes. `tests/unit/team-move-coverage.test.ts` needed a STAYS line for the new
    org_id table. MANUAL_PROD_STEPS entry `448` = `pending` (prod BEFORE the promote). `check:schema-parity` and
    `check:index-coverage` fail today on OTHER sessions' unapplied migrations (441–447 and three older tables), not on 448.
  - **Part 2.** Fourth token family in `lib/unsubscribe-token.ts` (`:stop-second-parent`). Page `app/second-parent-stop/page.tsx`
    (confirm / done / invalid / db; a GET writes nothing; "done" is read from the stop row, so a repeat visit is true).
    POST handler is `app/api/second-parent-stop/route.ts` (a `page.tsx` and `route.ts` cannot share a folder), a plain form post
    answered by a 303, wrapped in `withObservability`. `SystemAction` gained a `submit` prop. `proxy.ts` needed no change (its matcher
    is an allow-list; the route is public like `/unsubscribe`). **Added:** `second-parent-stop` to `lib/reserved-slugs.ts`.
    Probed against the running dev server: GET confirm, GET bad token, POST bad token (nothing changes), POST good (address
    cleared, one stop row), GET after (done, no button), POST repeat (still one row); rows cleaned up afterwards.
  - **Part 3.** `lib/league-second-parent-stop.ts` (server-only: `stoppedSecondParentRefusal`, fails closed; `withSecondParentStops`)
    because `league-second-parent.ts` is imported by the browser form. Refused in the public register route (probed live: 400 with
    the exact sentence, no sign-up created), Add registration and the record-window edit. The record window shows
    `SP.staff.stopped(date)`; the date rides on the list read and on every redrawn row (`fetchReg`). Words added to
    `SECOND_PARENT_WORDS` (`stoppedAddress`, `stop.*`, `staff.stopped`) for the Part 6 `/marketing` pass.
    **Ambiguity resolved:** the prompt says "no Change or Add control" and also "the registrar may still add a different
    address"; I kept the **Add** control (a typed stopped address is refused by the server), because removing it would stop the
    registrar adding a different address. Say so if you wanted it gone.
  - **Tests:** `second-parent-stop-token.test.ts` (7), `league-second-parent.test.ts` extended (now 30), fan-out and
    team-move suites green (88 + 69 across the four files run); `npm run typecheck` clean (needs `NODE_OPTIONS=--max-old-space-size=8192`
    on this machine); `check:spelling`, `check:dictionary`, `check:date-correctness`, `check:snapshot-freshness`,
    `check:observability-coverage` pass. Not yet run: `verify:changed` (Part 6).
  - **Restart-required** (new files, new route, migration): stop the dev server, clear `.next`, `npm run dev` before the owner browses.
  - **Session 2 · Parts 4–6 BUILT and committed 2026-11-06.**
    - **Part 4.** ONE footer builder `lib/league-second-parent-footer.ts` (`withSecondParentStop`, `hasSecondParentStop`) used by the shared point (`secondCopyHtml` in `lib/league-second-parent-mail.ts`, which now takes the club id and the recipient) and the three bypasses (register route’s confirmation, the pay-link loop, `sendLinkNotice`). The club id is threaded into the 3 `sendTransactionalToBothParents` calls, the ending email’s `sendSecondParentTransactional` and the 4 `sendSecondParentServiceCopies` callers (new required `orgId`). No secret, no footer. `escText` in `email-envelope-warm.ts` is now exported (reused instead of an eighth local copy). No send path reads `second_parent_stops`.
    - **Part 5.** `SECOND_PARENT_WORDS.addedYou` takes `{ name, contact, stop }`: four variants (button + club address; button alone; club address alone when no link can be signed; “contact {club}” with neither). `footer.lead` added.
    - **Part 6.** typecheck clean; fan-out, second-parent and stop suites 83/83. `verify:changed`’s unit run shows 9 failures and several check scripts red, ALL in other sessions’ files (billing tax words, practice-plans phone guard, plan-billing usage, public tournament Stage 6 walk, series date groups, support console guards, admin old look/type, org-slug callers, css selectors, export catalog). `check:schema-parity` lists 448’s table as “only on dev” (clears when 448 reaches prod; NOT re-baselined, and it DID add its own lines, contrary to the prompt’s “nothing new”); `check:index-coverage` has nothing of 448’s. **Found and fixed:** the new-table grants guard failed on 448 (no `service_role` grant, prod-only failure after 2026-10-30); the grant was added to the file and re-applied to dev. /marketing (words in `SECOND_PARENT_WORDS` only), /simplify (footer function un-exported), /review security + correctness lenses (one fix: the stop route logged the whole error object; one: `builtInOnly` on the second parent’s link notice; two tests added: a census of every file that can address a second parent, and the footer over a real envelope), /docs (family + registrar articles, search terms), /legal (privacy draft §5/§12, CASL note, index). Walk §472 published.
    - **Left as found, for the owner (five open flags, `CASL_SECOND_PARENT_EMAIL.md`):** reply path with no club contact email; exact-address match (+alias); a millisecond race between the refusal check and the insert; a mixed address using “Email me my link”; two footnotes on the pay-link copy.
    - **Restart-required** (new file, new route, migration): stop the dev server, clear `.next`, `npm run dev` before browsing.

## Part 1 · The place to keep it (migration + dictionary) · Session 1

- **Dev DB schema first**, read from `information_schema` on dev, never from migration files. **Check the next free migration
  number** in `supabase/migrations/` (447 was the highest on 2026-11-06 [V]) and in `supabase/migrations/MANUAL_PROD_STEPS.json`;
  other sessions share this tree.
- **Before writing the migration, answer the open question:** does `org_person_emails` (read by `getFamilySuppressionList`,
  `lib/family-email.ts:86` [H]) ever receive a second-parent address? `lib/league-second-parent.ts` says the second address is
  never a household or person key [V]; confirm by finding what writes `org_person_emails`. If it can, the stop must clear it
  too; say so in the Progress block.
- Table `second_parent_stops`: `id`, `org_id` (FK organizations, cascade as the sibling tables do), `email` (lowercase,
  trimmed, the same 200-character CHECK as `guardian_email_2`), `stopped_at` (default now), `source` (text; `'stop_page'`),
  `registration_ids uuid[]` (the sign-ups the stop cleared; **this is how the record window shows "Stopped"**, decided here so
  Part 3 has what it needs). Unique `(org_id, email)`. RLS on, service role only (copy the policy shape of
  `family_email_optouts`, mig 214 [H]).
- Dictionary entry in the same change: what it holds; written only by the stop page; **never a household key and never read
  for marketing or consent**; read by the form and staff add/edit to refuse a stopped address and by the record window for the
  "Stopped" line. Then `npm run refresh:snapshots` and `npm run check:dictionary`. Prod step in `MANUAL_PROD_STEPS.json`.
  **Apply to dev only**; prod is applied before the promote.

## Part 2 · The link and the stop page · Session 1

- **Token** in `lib/unsubscribe-token.ts` [V]: the file has three HMAC families (org, user, guardian); the guardian one
  (`guardianKey`, `generateGuardianUnsubscribeToken`, `verify…`, `buildGuardianUnsubscribeUrl`, ~lines 99–125) is the pattern.
  Add a **fourth** with its own suffix (`:stop-second-parent`), keyed on `orgId` + normalised email, so the four are
  non-interchangeable. `buildSecondParentStopUrl(orgId, email)` returns null when `UNSUBSCRIBE_SECRET` is unset (no button is
  then drawn, as for the guardian link). Deterministic and never expiring, as the file already documents and accepts.
- **Page** `app/second-parent-stop/page.tsx` (+ a POST handler; Next 16: read the relevant guide in `node_modules/next/dist/docs/`
  first): verify the token, load the club's name, show one sentence and one **Stop these emails** button. POST: insert the stop
  row (idempotent on `(org_id, email)`), set `guardian_email_2 = null` on every `league_registrations` row of that org whose
  `lower(guardian_email_2)` matches, store those row ids in `registration_ids` (append on a repeat), show the done state.
  Already-stopped is a success state. A bad or tampered link says so plainly and does nothing. **No sign-in.** Look and layout
  from the shipped `/unsubscribe/confirmed` page [V: `app/unsubscribe/confirmed/page.tsx`]; draw from the shipped component.
  Public route: check `proxy.ts` for any path allow-list the new route must join (do not recreate `middleware.ts`).
- **Tests:** new `tests/unit/second-parent-stop-token.test.ts` (round trip; wrong org; wrong email; capitals and spaces
  normalised; each of the other three token families fails this verify and this fails theirs; null without the secret) and a
  source guard for the page and handler (verifies the token before any write; writes the row and clears the column; **GET
  writes nothing**).

## Part 3 · Refuse a stopped address; show the registrar · Session 1

- **After** `readSecondParentEmail` (it stays pure) in the three places an address can enter: the public register route
  `app/api/league/[orgSlug]/[seasonSlug]/register/route.ts` (read at ~112–114, errors at ~144 [H]) and the two staff writes
  (Add registration and the record-window edit; routes behind `AddRegistrationWindow.tsx` and `RegistrationRecordWindow.tsx`
  [H], e.g. `app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts`). One shared async helper next to
  `readSecondParentEmail`, so the three cannot drift. Refusal words come from `SECOND_PARENT_WORDS` (one edit for `/marketing`):
  draft **"That address has asked not to get these emails from this club. Enter another or leave it empty."** On the staff
  windows the same sentence works; keep it one string.
- **Record window** (`RegistrationRecordWindow.tsx` [H]): where the second parent's row would be, show **"Stopped by the address
  owner, {date}"** (draft words, in `SECOND_PARENT_WORDS.staff`) when a `second_parent_stops` row's `registration_ids` contains
  this registration. No Change or Add control for a stopped row (O2: no undo); the registrar may still **add a different
  address**, which replaces the line. The date uses `formatStoredDate` (code-gotchas index: dates only through it).
- **Export and search:** unchanged (the column is empty). Confirm, do not edit.
- **Tests:** extend `tests/unit/league-second-parent.test.ts` (a stopped address is refused on all three entry points; the
  record window reads the stop row; the refusal string exists once).

## Part 4 · The button on every second-parent copy (five sites) · Session 2

The census [H, 2026-11-06] found one shared point and three bypasses. **Re-open each cited line before editing.**

- **Shared:** `lib/league-second-parent-mail.ts`, `secondCopyHtml(html, label)` (~88–92), called from
  `sendSecondParentTransactional` (~66–81) and `sendSecondParentServiceCopies` (~102–130). It takes only the HTML today; thread
  the **recipient address and org id** in and splice the footer link before the email's closing card. This covers approve,
  waitlist, promote, decline, placement, schedule, practice times and practice changes.
- **Bypass 1, the register route's confirmation** (~249–264 [H]): the loop over `copies` already marks the second parent's copy
  with `secondParentLine != null`. Add the link there only.
- **Bypass 2, the pay link** (`lib/online-payment-receipt.ts` ~303–309 [H]): a raw `sendEmail` loop using `secondParentsOf` and
  `readSecondParents` directly; it needs its own injection.
- **Bypass 3, sign-up-link and link-replaced notices** (`lib/league-signup-link-mail.ts` ~152–156 [H]): `sendLinkNotice(…,
  secondParent: true)`; the HTML is built in `sendLinkNotice`; inject on that flag.
- **One footer builder** used by all four sites (and by `secondCopyHtml` for the shared point), so they cannot drift. Look from
  `lib/email-envelope-warm.ts` (`warmUnsubscribeFooterHtml`, `WARM_EMAIL_STYLE.finePrintLink` [H]). Words from one string in
  `SECOND_PARENT_WORDS`. No link when the token builder returns null.
- **Do not touch:** "Email families" (`lib/families-email.ts`, `lib/families-audience.ts`): it already carries its own
  per-address unsubscribe and suppression [H]; verify it still does and leave it. Receipts, refunds and bank-debit mail never
  call the copy module (a standing guard in `league-second-parent.test.ts`); keep it so.
- **Tests:** in `tests/unit/league-second-parent-fanout.test.ts` add a guard that **every** second-parent send path carries the
  stop link and **no** first-parent path does (the file already holds the "receipts stay with the payer" guard; same shape).

## Part 5 · The "who added you" line · Session 2

- `SECOND_PARENT_WORDS.addedYou` in `lib/league-second-parent.ts` (~36–41 [V]): with a usable club contact email, say both ("use
  the button below, or tell the club at {email}"); without one, **drop the "tell the club at …" clause** and point to the
  button. No block on clubs and no fallback address (plan, "The contact-email problem shrinks"). Update the existing test
  "a club with no contact address" (`league-second-parent.test.ts` ~37).
- One edit; the wording goes through `/marketing` (Part 6).

## Part 6 · Closeout · Session 2

1. `npm run verify:changed`; `npm run typecheck` (API, auth-adjacent and email fan-out; shared modules changed); the neighbour
   tests of Parts 2–5; `npm run check:spelling`.
2. **`/marketing`** in one pass on the plan's "Words for /marketing" list (button, the line with and without a contact email,
   the confirm page and its states, the refusal, the record window's line). Single edits in `SECOND_PARENT_WORDS` and the page.
3. **`/simplify`** (a new shared footer builder and a new token family are new abstractions), then **`/review`**, asking for the
   **security lens**: token scope (org + address only), scanner prefetch (GET writes nothing), what the refusal sentence lets a
   stranger learn about an address (accepted as low, ruled O4; check nothing worse leaks), idempotence of the POST, and that
   clearing the column cannot touch another org's sign-ups.
4. **`/docs`**: the families' sign-up help (a second parent can stop the emails) and the registrar article (the record window's
   "Stopped" line; a stopped address is refused) in `lib/help-content/house-league.tsx`; update `keywords`/`searchText`.
5. **`/legal`**: add the sentence about other people's addresses and the stop button to `docs/agents/legal/drafts/PRIVACY_POLICY.md`;
   update `CASL_SECOND_PARENT_EMAIL.md` ("What the product does today", the status block) and `LEGAL_INDEX.md`.
6. **Owner walk**, one purpose, checkable (house format; memory `feedback_qa_walkthroughs_as_checkable_artifacts`): a sign-up with a
   second parent; Stop from the confirmation; confirm that a later email (approve) does not reach that address; a second
   sign-up with the same address typed is refused on the form; the registrar's window shows the "Stopped" line and refuses to
   add the address; the first parent's copies carry no new button; a tampered link says so; put back. Fixture: UAT Rep Club's
   open **2026 Fall House League**, `+sp` tags on the owner's inbox (see walk §457). Write it to `docs/projects/active/`,
   publish it, add the next § to `OWNER_QA_LEDGER.md` (never reorder numbers).
7. Update the Stage 3b plan status, the parent plan's Stage 3 block, `TODO.md` (the existing Stage 3 line), this Progress block
   and the memory index. **Before the next promote:** the migration to prod (`MANUAL_PROD_STEPS.json`).
8. **Stage 4 note** (write it into `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md` Stage 4): a stopped address must never be invited to
   sign in.
9. **Demos:** none asked per commit. If the demo seed writes league registrations, the new table needs nothing.
10. **Offer `/review` once** at the end; the owner decides.

## Shared-file traps

- Several sessions share one working copy on `dev`. Do not stage unrelated modified files. Stage explicit paths; `git add -p`
  for hunks in shared files (`TODO.md`, the plans, `OWNER_QA_LEDGER.md`, `lib/help-content/*.tsx`).
- `lib/help-content/*.tsx` is shared; edit only the house-league sign-up and registrar entries.
- New files, a new route and a migration are restart-required changes: stop the dev server, clear `.next`, restart with
  `npm run dev` before handing off for browser testing.
