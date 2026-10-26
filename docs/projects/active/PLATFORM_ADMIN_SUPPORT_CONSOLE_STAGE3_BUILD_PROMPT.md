# Platform admin support console · Stage 3, Money (build prompt)

> Paste into a new chat on `dev`. Written 2026-10-26, the day the owner ruled the Stage 3 drawings (every recommended box
> ticked, all twelve). **Re-verify every lead against the code before you build on it:** this prompt is a lead, not
> evidence, and so is any helper's summary. The working copy is shared with Club Tier and Bookkeeping sessions: stage
> explicit paths only, check the branch before every commit, `git show --stat HEAD` after it. Commit nothing without the
> owner's OK. **A refund is a money write:** it is built, reviewed and tested as one.

## 1 · What Stage 3 makes true

Support answers **"was this customer charged twice, and can you fix it?"** from the club's record, with no trip to Stripe's
dashboard. The money truth is shown, never remembered (R7).

1. **The Money tab reads Stripe on open** (never stored, never cached past the visit): the subscription beside our record
   with one agree/disagree line, a joined money band (paid 12 months · refunded · next charge), the card, the charges.
2. **"Charged twice" is named:** five patterns (same period paid twice; two live subscriptions; a plan move's part month
   next to a renewal, named as fine; failed-then-retried, named as fine; a charge not tied to the subscription).
3. **Refund from the console:** all or part, to the original card only, with a reason, a one-sentence consequence, and a
   kit danger button. Every refund is recorded on our side before Stripe is asked, and can never happen twice.
4. **The Story gains its money:** first purchases, charges and refunds, all facts (never a Put it back).
5. **The audit log gets a Reason column** (the migration), old reasons copied in; its raw values and Field move into the
   entry window.
6. **Find takes subscription charge, payment and invoice numbers and an invoice's printed number**; card digits are not
   searched.
7. **Guard rails ruled with it:** M6 (no staff plan change on a club Stripe still bills), the bulk status override under
   free time's rules, one wider "your own club" check shared with free time, one running plan grant per club, one
   spelling for the money words, and the window-foot sentence face.

## 2 · Rulings. Do not reopen them

Plan "Owner rulings 2026-10-26 (Stage 3 drawings)" and `memory/design_decisions.md` 2026-10-26, recorded as ruled:
- **Q1** Super admin + Billing refund; never own club (wide check, free time too); no dollar cap; older than 6 months or a
  6th refund in 24h needs Super admin; Support reads.
- **Q2** All or part; original card only; several parts up to the charge.
- **Q3** Stripe receipt only; owner confirms the Refunds switch is on in prod; no email from us.
- **Q4** A: read Stripe live; our own entries always show. (So **no webhook change** in Stage 3.)
- **Q5** Stripe numbers + invoice number; no card digits; one line says so.
- **Q6** Reason required on every staff change; product jobs none; copy old reasons into the column; "Not recorded".
- **Q7** Bulk changes' Subscription status override follows free time's rules: end required, 6/12-month cap, never own
  club, server-enforced.
- **Q8** The double plan grant fix rides Stage 3's migration.
- **Q9** Refuse a staff plan change while a live Stripe subscription runs; one line says why. (The drawing, G 10, and the
  recommendation the owner ticked: the refusal sits in the one shared plan-change rule, so the pencil, Bulk changes, Put it
  back and the record all obey it; it triggers on a subscription not yet cancelled in Stripe, whatever its billing status;
  Bulk skips that club with a reason line.)
- **Q10** Cancelled + Trial everywhere a person reads them; one renewal label set; Billing status; gated.
- **Q11** D-1: the June 26 red rule governs buttons and doors; refusal and error lines may be red. D-2: a card holding one
  table needs no heading above it; any other card gets one.
- **Q12** Field moves into the audit entry window with the values.
- **Owner direction 2026-10-26:** Old value and New value leave the audit table for the entry window; the export keeps
  every column. **A window's foot sentence must not ship unformatted again** (the 2026-10-25 defect).

Standing: R1–R8; A2 (Stripe numbers read by Super admin, Billing, Support); A3 (records opened, never the words); Q7 of
the kickoff (refund from the console; credits stay in Stripe); Stage 4's rules (`ownPlanOf` for every billing action; no
plan grant while Stripe charges; free time's caps). Warm default, Dark on the setting; desktop only.

## 3 · Read first

- **The drawings:** https://claude.ai/artifact/FdTWB58ne1jgsBXSwutdLX (source
  `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE3_DRAWINGS.html`). Build **from the drawings**, part by part. Drawing H holds the
  order of a refund, the threat list (23, in the page's first `<script>`) and the tests; drawing G every refusal; the
  formatting check the rules. The example clubs, amounts and Stripe numbers are invented.
- **The plan:** "Stage 3 findings" (the code facts with lines), "Owner rulings 2026-10-26", the S3 ladder row.
- **Stripe's current docs for every call you make** (the owner's standing rule; not memory). The repo pins stripe-node
  22.1.0 and API `2026-04-22.dahlia`; in that version an invoice carries **no** `charge`/`payment_intent` (find a charge's
  invoice through InvoicePayments), a subscription's period end is on its **item**, and the upcoming-invoice call may be
  `invoices.createPreview`: check each. Refunds (create, list by charge, statuses, errors), idempotency (keys pruned after
  ≥24 h), charges and invoices list by customer, subscriptions list by customer (status all), Search (invoice `number`),
  restricted keys.
- `AGENTS.md` (Next 16; `proxy.ts` untouched here), `AGENCY_RULES.md`, `docs/agents/design/` standards, the kit window
  (`components/admin/kit/club/KitDialog.*`, its `footStart` rule from `9c1545220`), `app/platform-admin/RecordWindow.tsx`,
  `PLAN_PRICING_FACTS.md` (restate nothing), `docs/agents/db/DATA_DICTIONARY.md`.

## 4 · Verified state (2026-10-26, re-verify)

| Fact | Where |
|---|---|
| One Stripe client, full key from `STRIPE_SECRET_KEY`; mode by key prefix | `lib/stripe.ts`; `lib/stripe-prices.ts:19` |
| The console already writes Stripe (cancel, customer delete) and reads it (price check, Club trial history); never charges/invoices/cards | `orgs/[id]/cancel-subscription`, `orgs/[id]/delete`, `lib/operator-plan-change.ts` ~134 |
| No subscription charge/invoice/payment ids stored anywhere; family `pi_`/`ch_` only in `online_payments` (dev) | snapshots |
| Webhook handles no refund event; overwrites `plan_id`, `tournament_limit`, status, sub id by customer on every subscription event | `app/api/billing/webhook/route.ts` ~364-384 |
| `subscription_started` / `plan_upgraded` are written to `platform_events`; the Story reads only downgrade, cancel, past due, recovered | `lib/platform-story.ts` ~76-78 |
| **Upgrades already reach the Story** as "Moved up" from `org_audit_log` | `lib/platform-story.ts` ~307 |
| `platform_audit_log` has no `reason`; 70 writer calls + 1 direct insert; 21 keep `new_value.reason`; the writer swallows its error | `lib/platform-audit.ts`; `lib/billing-retention.ts:579` |
| Revoke and add-on toggle already keep a reason (since Stage 2) | `lib/club-record-changes.ts` 123, 148 |
| Audit screen: Timestamp · Superuser · Org · Action · Field · Old · New; entry window with "What changed", Copy, Same moment | `app/platform-admin/audit/AuditTable.tsx` |
| No refund power; `find_stripe` = super_admin, billing, support | `lib/platform-areas.ts` ~71-92 |
| Own-club check reads `organization_members` only | `lib/free-time-writes.ts:91` `staffBelongsTo` |
| `applyOperatorPlanChange` has four callers and never calls Stripe; the `tournament` branch clears the sub id locally | plan, bulk-operations, put-back, record routes; `lib/operator-plan-change.ts` ~105-110 |
| `org_overrides`: no unique or exclusion rule on running plan grants; **a grant that ran out by itself keeps `revoked_at` null** | snapshots; `lib/free-time-writes.ts` ~51-57 |
| Bulk status override: "Optional expiry", no cap, no own-club refusal, up to 100 clubs | `bulk-operations/route.ts` ~76-196 |
| Console foot note: `record.module.css .footNote` = `--type-body` (14px), the kit's is `--type-support` (12px) | `app/platform-admin/record.module.css:99`; `RepKit.module.css:745` |
| "Canceled" vs "Cancelled", "Trialing" vs "Trial", six renewal labels, five billing-status names | the plan's "Stage 3 findings" · Labels |
| Highest migration on disk: 379 (other sessions are numbering too) | `supabase/migrations/` |

## 5 · Scope

**Is:** the eight parts in §7, the migration, the guards in §8, help for the console screens and the customer-visible
spelling changes.
**Is not:** credits or balances (stay in Stripe); a refund to any other destination; moving a paying club's Stripe
subscription; cancelling a second subscription from the console (the line links to Stripe); an email from us; card-digit
search; family payments (the club's own money); any webhook change; Status, the sent-email log, Feedback reply (S5); club
web addresses (S6); audit search across pages (M4, S8).

## 6 · Blocking gate: before any code

1. **Re-run §4** and note every row that moved.
2. **Censuses** (delegate; reopen every row that decides anything):
   a. every `writePlatformAuditLog` call and direct insert: staff change (passes a reason) or product job (none), with path;
      this is the reason guard's allowlist;
   b. every reader of `platform_audit_log` (screen, export, Story, free-time Story, person Story, `operator-plan-change`,
      `free-time-writes`), and how each moves to the column;
   c. every caller of `applyOperatorPlanChange` and what each shows on a refusal;
   d. every customer- and console-visible "Canceled", "Trialing", renewal and billing-status label (pages, emails, help,
      `keywords`/`searchText`, `data-label`), for Q10;
   e. every `footerStart` / `footNote` in a console window, for the foot face.
3. **`/billing` (gate):** refunding a subscription invoice's charge directly vs a credit note (recommend the direct charge
   refund; confirm the invoice stays paid and nothing else moves); the age rule on `charge.created`; Q9's refusal wording
   and which customer page it points to; that no billing action starts reading anything but `ownPlanOf`.
4. **`/marketing`:** the customer-visible Cancelled / Trial strings and the refund sentence ("Stripe emails them a receipt").
5. **The double plan grant rule (Q8). Decide with the owner before writing it.** A plain partial unique index on running
   `plan_tier` rows would **block every new grant for a club whose earlier grant ran out by itself** (its `revoked_at`
   stays null). Recommended: an exclusion constraint so two un-revoked plan grants of one club cannot overlap in time
   (`btree_gist`, `tstzrange(starts_at, expires_at)`); check the extension is available on both databases, and that no
   club holds overlapping plan grants today (a read-only query; **never** `apply-migration-api` for a read, it refreshes
   the snapshots against both databases).
6. **The migration, written but not applied until the gate is through:** `platform_audit_log.reason` (text, null) with a
   one-time copy from `new_value->>'reason'`; a server-only refunds record (id = the refund key; org; Stripe customer,
   charge and refund ids; amount and currency; the remainder the person saw; Stripe's reason; status started · done ·
   refused · unknown · not_made; Stripe error code and request id; the typed reason; actor; livemode; times), RLS on with
   no policies, **one unfinished refund per charge** enforced by a partial unique index on the charge where status is
   started or unknown; the Q8 rule. Take the next free number at the time (≥380; check git and other sessions' work).
   Dictionary + snapshots in the same unit of work.
7. **The restricted key:** check Stripe's docs for whether a restricted key can read customers, subscriptions, invoices and
   charges and create refunds **without** creating charges. Recommend one way to the owner (a console key = an Amplify env
   var at release, an owner step), or keep the full key and say why.
8. **Q3:** ask the owner whether the Stripe Refunds email switch is on in production; the sentence depends on it.
9. **Restate the PM summary in five lines** (`AGENCY_RULES`).

## 7 · Build (after the gate), in parts

**Part 1 · The migration and the reason column.** Apply to dev only. The audit writer takes a `reason` (staff writes)
and stops carrying it in `new_value`; a **strict** writer variant (throws on failure) for the refund. Every staff route
passes the person's reason; product jobs pass none. Readers read the column (the copy makes old rows read; a staff row with
none reads **"Not recorded"**, as the Story already says). The export gains the column.

**Part 2 · The audit log screen.** Table: Timestamp · Superuser · Org · Action · **Reason** · ›. Field, Old value and New
value move into the entry window, which gains a Reason line under Action; "What changed", Copy and Same moment stay as
built. The export keeps every column.

**Part 3 · The Money tab (read).** A server route under the Stripe-reading power (A2); roles without it get our record
and one line, and **no Stripe call is made for them**. Reads with a time limit: customer, subscriptions (all statuses, to
see two live ones), the card on file, charges for 12 months (paged; "Show older charges" reads further), invoices and their
payments, the next charge (Stripe's own preview, never a price). Nothing is stored. Draw from drawing A, part by part:
the kit callout as the agree line (olive / amber / red rail; "Read again"); the joined band (paid 12 months · refunded ·
next charge); "The subscription" heading + a table (Our record · Stripe), a difference as a **"Differs"** chip; the charges
table (When · What it paid for · Card · Stripe says · Amount · ›); the family-payments line. States: no Stripe customer;
Stripe unreachable; a role that does not read Stripe; **test mode** (the product's existing "Test mode" chip and "Test
payment: no money moves.", from the key's prefix). **Ownership on every read:** a charge, invoice or `?charge=` is shown
only if it belongs to exactly this club's Stripe customer (non-null, not shared with another club) and matches the key's
mode.

**Part 4 · "Charged twice".** The five patterns from Stripe's invoices and periods (never from amounts and times alone),
said once in the agree line and again under the charge; "Refund the later one" is a door (absent for Support). The tab
never corrects our record.

**Part 5 · The charge window and the refund.** The charge reads first (the kit record window): amount, paid for, card,
Stripe says, refunded so far, Stripe charge, the flag line; **"Refund this charge"** (outlined) only for the refund power.
The refund window: **All of it / Part of it** radio rows (part: an amount up to what is left, "of $X still refundable"),
**Why***, the sentence (amount, card, **This cannot be undone.**, the plan and subscription unchanged, the next charge
unchanged, 5 to 10 business days, and the receipt clause per Q3), the kit **danger** button "Refund $X", foot sentence left.
The route, in this order:
1. A new **refund power** (super_admin, billing) in `PLATFORM_POWERS`; checked before anything is read.
2. Refusals, each a fixed sentence, zero writes: the **wider own-club check** (member, team staff, a Coaches Portal owner
   or billing owner the club pays for, a pending invite, a staff email equal to the owner's or the customer's; one shared
   function that **free time adopts too**); a demo club; a charge not owned (Part 3's rule); a mode mismatch; not paid or
   disputed; the amount not whole cents, ≤ 0, or above Stripe's remainder; the person's remainder ≠ Stripe's; Billing and a
   charge older than 6 months (Stripe's `created`) or a 6th refund by that person in 24 h (counted from the refunds
   record); a blank reason, an over-long one, or one holding a Luhn-valid 13–19 digit run.
3. Insert the refunds record as **started** with the strict writer (the unique rule holds the charge). If it fails, stop:
   Stripe is never asked.
4. One Stripe call: `refunds.create` with the charge, the **amount always explicit**, Stripe's reason (`duplicate` when the
   charge was flagged, else `requested_by_customer`; **never** `fraudulent`), metadata of our refund id, the club and the
   staff member only (**never the typed reason**), and our refund id as the idempotency key.
5. Complete the record: **done** (with the `re_` id) · **refused** (only on Stripe's definite 4xx; keep its code and
   request id, never its raw text) · **unknown** (timeout or 5xx). Write the audit entry with the strict writer, reason in
   its column. Answer with fixed sentences chosen from the code.
6. **Recovery never re-sends a refund.** Opening the charge finds started/unknown records old enough that their request
   cannot still be running, lists the charge's refunds in Stripe, and matches our id in metadata: found → done; not found
   → not_made (releases the charge). Stripe forgets keys after about a day, so a second POST could make a second refund.
The window's answers after a click (refused, more than is left, no answer, our record failed) are the kit field error
inside the window; refusals known before the click are the console's refusal line with the door absent (drawing G).

**Part 6 · The Story.** First purchases ("Bought {plan}, {period}") from `platform_events.subscription_started`; **not**
`plan_upgraded` (upgrades already show as "Moved up" from `org_audit_log`: no doubles). Charges and refunds made in
Stripe's dashboard from Part 3's read, only for the Stripe-reading roles; console refunds from the refunds record ("to the
card it came from", no card details), shown even when Stripe is down; de-duplicate by the `re_` id. All facts: no Put it
back. The line becomes **"Not in the Story yet: account emails such as password resets."** Stripe-down line; the
other-roles line (money entries are shown to Super admin, Billing and Support).

**Part 7 · Find.** Whole `ch_`/`pi_`/`in_` numbers: `online_payments` first (as today), then one exact retrieve on our
own account, the club by its customer (exactly one). An invoice's printed number through Search with a **strict shape
check before any query is built** (quotes and OR never reach Stripe), the exact `:` operator. "Not found" and "found but
not ours" read the same: **Nothing matches “…”.** Results read "Stripe charge … · $X · date · plan" under **"Stripe · n"**;
Enter opens the club's Money tab on that charge (ownership-checked again there). The Find route still writes nothing; the
record-opened trail is unchanged. Card digits: the existing foot.

**Part 8 · The guard rails.**
- **Q9 (M6):** inside `applyOperatorPlanChange`: refuse when the club holds a Stripe subscription id that is not a mock
  and not cancelled (our status `canceled` is the webhook's word; confirm at the gate), whatever its billing status; the
  `tournament` branch stops clearing the sub id. Pencil: the plan field is replaced by the one line (G 10); Put it back and
  the record refuse with it; Bulk skips that club with the line in its result.
- **Q7:** the bulk Subscription status override takes an end ("Free through", the shared date field, required), Billing up
  to 6 months and Super admin 12 (the free-time caps), refuses a club the staff member belongs to (the wider check), all
  on the server; "Optional expiry" is gone.
- **Q10:** "Cancelled" and "Trial" wherever a person reads them (console, both customer billing pages, emails, help and
  their search words); one renewal label set on the band and the Money tab (Renews · Trial ends · Ended · Free through);
  "Billing status" everywhere in the console; the spelling gate learns "Canceled" (stored values unchanged).
- **The window foot face:** `record.module.css .footNote` moves to the kit's foot-note face (support size, tertiary
  ink), so every console window's foot sentence matches the product's.

## 8 · Guards (new unit tests)

1. **Mocked Stripe (no network):** a double submit makes one refund; a retry with the same key makes one; "already
   refunded", "disputed" and "more than the charge" leave no money moved and a refused record; a lost answer more than a
   day old is recovered by **listing** and makes **zero** refund POSTs; an in-flight start keeps its hold, an abandoned one
   releases it; two starts for one charge, the database refuses the second.
2. **Server rules:** no refund power → refused before any read; each own-club case (member, team staff, portal owner,
   billing owner, pending invite, matching email) and a demo club refused; a null-customer charge on a null-customer club,
   a customer shared by two clubs, another club's charge (refund **and** read paths, `?charge=`), a mode mismatch: refused;
   amounts 20.1, "20.10", empty, 0, negative, huge: refused; "all" with a changed remainder: refused; 6 months and the 6th
   refund in 24 h for Billing, from Stripe's date: refused; a blank reason and a Luhn reason: refused.
3. **Order:** the first write fails → Stripe never called; the audit entry exists whether Stripe accepts or refuses.
4. **Words that leave us:** refund metadata holds no free text; Stripe error text containing `rk_live_`/`acct_` never
   reaches the response or our records.
5. **No card data kept:** a scan that fails if a refund, audit or Story write carries a card number, expiry, holder name,
   billing details or fingerprint.
6. **Reads:** roles without the Stripe-reading power cause no Stripe call; Stripe down renders our record and one line;
   nothing Stripe returns is stored.
7. **Find:** a quote, `OR`, or anything not shaped like a Stripe or invoice number never builds a Stripe query.
8. **Q9:** the shared plan rule refuses an uncancelled subscription (active, past_due, unpaid, incomplete, trialing)
   through the pencil, Bulk, Put it back and the record; Bulk skips with a line; the tournament branch keeps the sub id.
9. **Q6:** every staff writer passes a reason (the census allowlist names the product jobs); old reasons read back from
   the column.
10. **Q7:** the bulk status override refuses no end, a past day, over the cap per role, and an own club.
11. **Q8:** two overlapping plan grants for one club are refused by the database; a new grant after one ran out by itself
    is **allowed**.
12. **The window foot:** every text in a console window's foot left wears the foot-note face (bare, or a foot-note class at
    the support size); the 2026-10-25 fix had no test.
13. **The threat list (23):** each has a guard or a named reason it cannot.

## 9 · Verify

- `npx next typegen` then `npm run typecheck` (shared modules change); `lint:focused` on changed files; the guards
  directly with `node --import ./tests/ts-resolver.mjs --test <files>` (relative imports in what a test imports);
  `check:spelling`; `check:dictionary`.
- ⚠ `npm test` / `verify:changed` clear `test-results/` for every session: run them only when no other session is
  mid-walk, and say so. Report your reds apart from other sessions'.
- **Restart the dev server** at hand-off (new files, shared modules), via `npm run dev` only. On 2026-10-26 it sat at
  ~4 GB and Chromium crashed during a Dark capture pass: restart before the layout check, not after.
- `check:layout -- --changed` on the club record (Money, Story), the audit log, Find, Bulk changes, both customer billing
  pages; Warm and Dark.
- Read-only probes only (`.probe/pasc/`, abort non-GET except Find's read-only POST); `pa-state.json` expires, and the
  sign-in must wait for the page to hydrate (`capture-s3b.mjs`); never overwrite `tests/uat/.auth/*.json`.
- **No refund from a probe**, even in test mode. The owner's walk makes the test-mode refunds on dev. Dev's UAT Club Org has
  a Stripe customer and no subscription: the walk needs a test-mode subscription with charges (checkout with Stripe's test
  card on dev), set up with the owner.

## 10 · Hand-off

- **Two QA walks, one purpose each,** as checkable Artifacts with matching Owner QA Ledger sections (never sort the §):
  (1) **a double charge, found and refunded from the record** (Money tab, the patterns, the charge, a part and a full
  refund in test mode, the Story, the audit Reason, Find by charge and invoice number, Support's and Read only's views);
  (2) **the guard rails** (M6 refusal through the pencil, Bulk and Put it back; the bulk status override's end and cap;
  own club; Cancelled/Trial on the console and the customer pages; the audit table and its window; window feet).
- **Prod steps, named not run:** Stage 3's migration joins **365, 367 and 373** at the next release; the owner confirms
  the Stripe Refunds email switch (Q3); a console restricted key is an Amplify env var if chosen (§6-7). **No webhook
  change** (Q4 A). Any future webhook change is a production release step through `/release`.
- **The index:** `stages/s3` state + anchor ("Built `<hash>` <date>"), a `log/` row, the walks' links.
- **Records:** the plan's S3 row and Status (+ a "Stage 3 threats → guards" list), TODO, the PM brief, the auto-memory
  `project_platform_admin_support_console.md`, `PROGRAM_BILLING_AND_ENTITLEMENTS.md` (console refunds exist).
- **The finish pass is a step of the build, not an afterthought:** `/simplify`, then a high-risk `/review` with the money
  lens (the refund route, recovery, ownership, the strict writer), `/docs` (console help for Money, refunds, the audit log;
  the customer billing help's words), `/strategy` (refund authority and the 24 h brake as a Decided business decision; no
  price moves), `/billing` drift check against `PLAN_PRICING_FACTS.md`.
- No commit without the owner's OK.

## 11 · Do not

- Change the Stripe webhook, or subscribe it to new events.
- Refund to anything but the original card; offer credits; send `fraudulent`; send the typed reason to Stripe.
- Store or log card data, or Stripe's raw replies.
- Re-send a refund to learn whether the first went through.
- Send an email from us; add a scheduled job; touch production.
- Move or cancel a customer's Stripe subscription from the console (beyond today's cancel).
- Make a Stripe call for a role without the Stripe-reading power.
- Refund from a probe, in any mode.
- Restate a price, plan name or limit; edit shared automation or watched scripts; change `proxy.ts`.

## 12 · Git

On `dev` only. Explicit pathspecs. Branch check before every commit, `git show --stat HEAD` after. Separate commits:
- the migration, the dictionary and snapshots;
- the reason column through the writer, routes and readers (+ the audit screen and window);
- the refund: power, route, recovery, the wider own-club check (with free time adopting it), and their guards;
- the Money tab, the patterns, the charge and refund windows, the Story, Find;
- the guard rails (Q9, Q7, Q8 rule's use), the labels (Q10, console and customer), the foot face;
- docs and help.

## 13 · Context you would otherwise miss

- The drawings' UAT Rep Club (a clean Tournament Plus history) and UAT Club Org's payment history are invented; dev's
  real UAT Club Org has a Stripe customer, no subscription, and a "Subscription ended in Stripe" Story entry.
- "Not recorded" is the Story's existing word for an old row with no reason; the audit log uses the same.
- The Money tab is the subscription, never the family payments rail (Club Tier Stage 12, a different session).
- `.probe/pasc/capture-s3b.mjs` and `render-s3.mjs` are the drawings' capture and render scripts.
- The drawings page was assembled from Stage 4's skeleton; after the owner's 10-26 edits the `.html` in
  `docs/projects/active/` is the source (the scratch assembler is stale).
