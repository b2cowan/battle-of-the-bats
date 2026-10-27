# Platform admin support console · Stage 5, Health (build prompt)

> Paste into a new chat on `dev`. Written 2026-10-26, the day the owner ruled the Stage 5 drawings (all ten asks, every
> recommended box ticked). **Re-verify every lead against the code before you build on it:** this prompt is a lead, not
> evidence, and so is any helper's summary. The working copy is shared with Club Tier and Bookkeeping sessions: stage
> explicit paths only, check the branch before every commit, `git show --stat HEAD` after it. Commit nothing without the
> owner's OK. **A reply is the first customer-facing send the console makes, and the callback is a new public address:**
> both are built, reviewed and tested as security changes.

## 1 · What Stage 5 makes true

Support can answer **"is the platform healthy right now, and what did this customer actually receive?"** from the
console, with no trip to the Amplify, Supabase or Resend dashboards. The truth is shown when the screen opens (R7).

1. **Status** (new, first item under Health, every role reads): the sites' latest builds, the app's errors and traffic,
   the databases; a verdict in plain words per line (Fine · Look at it · Act now · Not checked) with one "what to do";
   "Read at 9:42 a.m." and Read again; Today's health line takes the worst verdict from the cheap lines. A reading that
   could not be taken says so and is **never shown as fine**.
2. **Errors, restyled:** one-sentence caveat, house clock, sentence titles, samples as a table with a person and club link.
3. **Feedback gets its own record page** (triage moves inside it behind the pencil) and **a Reply** by email.
4. **A sent-email log with delivery:** an Emails tab on the person record, Health › Sent emails, a Find group, Story rows,
   fed by a **delivery callback** from the mail service.
5. **A kind on every send**, build-enforced.

## 2 · Rulings. Do not reopen them

Plan "Owner rulings 2026-10-26 (Stage 5 drawings)" and `memory/design_decisions.md` 2026-10-26 "SUPPORT CONSOLE STAGE 5",
recorded as ruled:
- **Q1** All four Status groups: our records + a database function now; the AWS list-builds key and a scoped read-only
  Supabase token are **release owner steps** (a separate member if the plan allows). Until a key exists its lines read
  "Not checked: this site has no key for it", never Fine.
- **Q2 = B:** Status reads live; the morning check stays on the owner's PC **unchanged**. Nothing here touches the
  stack-health check, its schedule, its hook or any watched path.
- **Q3** Status: all roles. Errors: unchanged (read Super admin, Product, Support; triage Super admin, Product). The sent
  log (Emails tab, Sent emails, Find's group, the Story's email rows): **new power**, Super admin + Support + Billing,
  **absent** for the rest. Emails sent to staff accounts: Super admin only.
- **Q4** The Errors person link: every Errors reader; a staff account links for Super admin only (others read "A staff
  account"); a deleted account is text; nobody signed in says so; the link follows the person record's own rule.
- **Q5** Reply: email from us; From "FieldLogicHQ support" at the no-reply address; Reply-To fieldlogichq@gmail.com
  (the admin inbox rule); signed first name + "FieldLogicHQ support"; plain text, their message quoted; **new power**
  (Super admin + Support; Billing and Product keep triage and have no door); **no reason asked**; sending moves New to
  Acknowledged (never Resolved); only feedback under 90 days, to the same address that wrote it.
- **Q6** Account emails only; **no body, no links, no subject**; the row keeps recipient, a fixed kind label, time, the
  mail service number, state and its time, club, asked-for-by; 90 days; Story rows for sign-up, sign-in, reset, invites
  and replies (billing and registration emails appear on the Emails tab only).
- **Q7** Build the callback: a migration, a public address, a signing secret, the Resend setting, a release step.
- **Q8** A **kind is required on every send call**, enforced by the build. Account kinds are logged; family kinds are not;
  the morning check's alert stays outside the sender.
- **Q9** Rides S5: the Errors caveat as one sentence; the house clock on Errors and Feedback **and the spelling gate
  learns the leading zero**; the two new powers in the rulebook; Feedback's record page. **Not S5:** browser errors split
  by address (a later errors pass). **Report only, do not touch:** the morning check's build reads failed on the owner's
  PC (owner will look); its alert falls back to the product mail key (own commit, only on the owner's word).
- **Q10** S5-D1 a send is **lime**, and the written note is reworded ("red is for what destroys or takes away what a
  customer had; a send is lime, with 'cannot be taken back' in its sentence"); S5-D2 Read again is the refresh symbol on
  a phone, named for screen readers; S5-D3 keep today's "Org / Affected orgs" words, settled in Stage 8.

Standing: R1–R8; A3 (Find never logs the words typed, including the new Sent emails group); the Stage 2 rulebook
(`PLATFORM_POWERS`); the reason-on-every-customer-change rule does **not** apply to the reply or the log (console work
tools, ruled: no reason). Warm default, Dark on the setting; desktop, **Status and Today readable on a phone**.

## 3 · Read first

- **The drawings:** https://claude.ai/artifact/BQmiMi3jXGKBwXQHr8UugB (source
  `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE5_DRAWINGS.html`, 1,604 lines). Build **from the drawings, part by part**. One
  example runs through them (an administrator, a TypeError on Registrations, feedback, an invite that bounces; invented).
  Drawing H holds the **27-item threat list** (the `THREATS` array in the page's script) and the ten tests; drawing G
  every failure wording and the roles table; drawing F the callback; drawing E the six state words and the empty states.
- **The plan:** "Stage 5 findings" (code facts), "Owner rulings 2026-10-26 (Stage 5 drawings)", the S5 ladder row.
- **Current provider docs for every call you make** (not memory): Resend (webhooks: Svix signatures and the exact
  verification; event names and payload shape; retries ~1 day; `tags` round-trip; `Idempotency-Key` 24 h; `GET /emails`
  `last_event`; send rate 10 req/s per team), AWS Amplify (`ListJobs` resource scope on `apps/<id>/branches/<b>`), Supabase
  Management API (scoped tokens, health and logs endpoints, rate limits), Amplify env var handling for server code.
- `AGENTS.md` (Next 16; `proxy.ts` is touched only if the callback's public address needs it: see §6-6),
  `AGENCY_RULES.md`, `docs/agents/design/`, `app/platform-admin/**` (observability, feedback, person record, Story),
  `lib/platform-areas.ts`, `lib/platform-waiting.ts`, `lib/platform-story.ts`, `lib/email.ts`, `lib/email-sender.ts`,
  `app/api/stripe/connect-webhook` or its equivalent (the pattern for a public signed route: 503 without the secret,
  dedupe table), `docs/agents/db/DATA_DICTIONARY.md` and the snapshots.

## 4 · Verified state (2026-10-26, re-verify)

| Fact | Where |
|---|---|
| Every send goes through `sendEmail`/`sendEmailBatch` (~53 + 2 direct calls; wrappers `sendTransactionalEmail` ×25, family senders ×6) or `sendMarketingEmail` (campaigns ×5, the only logger, `email_sends.resend_message_id`, no delivery state). The stack-health alert bypasses | `lib/email.ts`, `lib/email-sender.ts` |
| The shared sender returns no message id and writes no row; auth links are `generateLink` + our sender | same |
| `RESEND_FROM` prod `noreply@fieldlogichq.ca`; `ADMIN_EMAIL = fieldlogichq@gmail.com` (the business-email-addresses plan is queued behind this stage; replies go to the Gmail inbox meanwhile) | `lib/email.ts:40`; `AMPLIFY_DEV_ENV_PLAN.md` |
| No Resend webhook route, no svix dependency; `/api/*` outside `/api/admin*` passes `proxy.ts` unauthenticated | `proxy.ts` |
| `error_events` (30 days; sampled: all to 50, then 1 in 10; stores `user_id` AND `user_email`, plus IP/UA never shown); `request_metrics_rollup` (5-minute buckets, a year); no latency recorded | snapshots |
| Wrapped routes 591 of 616 (575 direct + 16 via `lib/coach-tag-routes.ts`): **re-count** before writing the caveat's numbers | `app/**/route.ts` |
| `feedback_submissions`: no reply/thread/notes; anonymous allowed (ids null); signed-in rows keep `user_id` + `user_email`; states new/triaged/acknowledged/resolved in code only; Today counts `status='new'`. A "we received your feedback" email goes out, unlogged | snapshots; `lib/platform-waiting.ts` |
| Powers: `errors_triage` = super_admin, product; `feedback_triage` = super_admin, support, billing, product; `observability` view = super_admin, product, support; `feedback` view = super_admin, product, support, billing | `lib/platform-areas.ts` ~88, ~176-179 |
| `fmtDateTime` prints `06:18 p.m.` on Errors/Feedback; the console elsewhere `5:52 p.m.`; the spelling gate misses the leading zero | `check:spelling` |
| Morning check reads Supabase with one account token and Amplify with the PC's AWS login; nothing in `app/`/`lib/` reads `.health/` | `scripts/stack-health.mjs` (read-only) |
| Highest migration on disk was **388** at writing (other sessions number too); prod already owes **365, 367, 373, 380** | `supabase/migrations/` |

## 5 · Scope

**Is:** the parts in §7, one migration, the two new powers, the guards in §8, console help, the one-sentence caveat, the
clock fix and its gate.
**Is not:** the morning check's history on Status; in-console customer answers (a customer's reply to our reply goes to
the admin inbox); open/click tracking; logging family emails (the club's own Families › Emails stays separate; each email
lands in exactly one log); a Today queue for bounced emails; regrouping browser errors; Campaigns' own delivery states
(S7); club web addresses (S6); any stack-health change.

## 6 · Blocking gate: before any code

1. **Re-run §4** and note every row that moved.
2. **Censuses** (delegate; reopen every row that decides anything):
   a. **every send call** (including the 2 direct and the wrappers): file, current kind-equivalent, account vs family vs
      alert vs campaign, and whether a child's name or a club/team name can reach its subject or body. This is the kind
      list and the build guard's allowlist. **Propose the fixed label per kind to the owner as one table before building**
      (the drawings show only examples: "Reply to their feedback", "Feedback received", "Password reset link", "Trial
      ending", "Invitation to a club").
   b. every reader of `error_events`/`feedback_submissions` that will move (screens, routes, Today, export);
   c. every place a clock label is built for Errors and Feedback, and the gate's regex;
   d. every `.env`/Amplify variable the server reads (for naming the two new keys and the Resend secret: `docs/amplify.yml`
      names only; **never print a value**).
3. **Provider-docs check:** write down, from the current docs, Resend's exact signature scheme and tolerance, the events
   to subscribe (sent, delivered, delayed, bounced, complained, failed, suppressed or the nearest current names; never
   opens or clicks), whether tags round-trip in webhook payloads, AWS `ListJobs` scoping, and what a Supabase scoped token
   can and cannot read. If the plan cannot scope a Supabase token read-only to two projects, **say so and do not build
   its three lines** (T4); the owner makes that risk call.
4. **`/release` (gate):** the callback is a new public route + a Resend setting + a signing secret (production and staging
   each their own, set **before** the webhook is turned on) + the AWS and Supabase keys + the migration joining
   365/367/373/380. Draft the release steps; run none.
5. **`/marketing`:** the reply email's foot ("You are getting this because you sent us feedback from inside FieldLogicHQ.
   Reply to this email to answer.") and the signature.
6. **Public route:** how the callback passes `proxy.ts` (it is outside the admin area on purpose, like the Stripe one;
   the route guard lists it as a known public address with that reason). Change `proxy.ts` only if the census proves it
   necessary.
7. **Restate the PM summary in five lines** (`AGENCY_RULES`).

## 7 · Build (after the gate), in parts

**Part 1 · The migration (dev only; written, then applied after the gate).** The email log and its timeline (one row per
account email: recipient, kind, club, asked-for-by, mail service number, state, state time; **no subject, body or link**;
90-day prune); handled callback numbers (kept 7 days); feedback replies (draft → sending → sent/failed/unknown, the row
number is the mail service's once-only key, words fixed once sending starts); Status's shared reading (one row, claim
before reading); the read-only database function for connections and scheduled jobs (counts, job names, times,
pass/fail **only**; never a job's command, a run's message or a session's query/user/address; search path pinned; revoke
PUBLIC, anon, authenticated). RLS on, no policies, an explicit `GRANT … TO service_role` on every table. Take the next free
number at the time. Dictionary + snapshots in the same unit of work. It joins 365, 367, 373, 380 at the release.

**Part 2 · The sender and the kind.** `kind` required on every call (type-level and a build guard that fails on a send
without one). Account kinds write a row **before** the send and never make the send wait on it; family and alert kinds
write none; the shared sender returns the mail service number. Log failure is counted in the server log only (never
into error capture) and never blocks the customer's email. A missing key or a refusal ends the row as Not sent or Failed.

**Part 3 · The delivery callback.** Verify the signature **before reading** the body (5-minute window, 64 KB cap, several
signatures allowed, constant-time compare); secret unset = "not ready" (the service retries for a day); our row tag must
look like one of our row numbers before any lookup; a callback matching no row is accepted and **nothing is kept, not
even its number**; mark a number handled only after its change is saved; move the row forward only (Sent → Delayed →
Delivered → the finals Bounced / Failed / Not sent / Marked as spam) in one database step; the timeline adds a row per
number; write only the state, its time and a bounce reason from a short fixed list; nothing to the server log.

**Part 4 · Status.** One server route; reads at most once per 30 seconds for all staff together (shared through the
database, with a claim), each provider read limited to 5 seconds; fixed answer shape (verdict words, numbers, times), never
browser-cached, **never raw logs, settings or provider error text**; every provider error becomes a fixed sentence. Lines
as drawn: production and staging builds (AWS), staging site (an ordinary visit), errors, error rate, traffic, counts up
to date (ours), database answers, connections and scheduled jobs (the function), database services, gateway errors,
staging database (Supabase). A stale reading carries its age ("counts 47 minutes old"); the header turns amber after
10 minutes. Today's line takes the worst verdict from the cheap lines **only** and never calls Amplify or Supabase. Phone:
cards, "Read from" dropped, Read again as the refresh symbol (S5-D2). Foot: "Not judged here: week-over-week trends,
database advisors and agent tooling. Those are in the owner's morning check."

**Part 5 · Errors.** Kept as drawn (band, chart, four panels, filters, table, triage, related feedback, 14-day chart,
export, labels). Restyled: the one-sentence caveat with **re-counted** numbers, the house clock, sentence titles, samples
as a table (When · Who · Club · Source · Status code), the person link and its four states (Q4), the sample window's foot.
Related feedback opens the feedback's own record.

**Part 6 · Feedback.** List: Date · Type · Category · Org · From · Title · Status · Replied (Not yet · No address); the
per-row dropdown and Escalate button go. The record reads first, edits whole behind the pencil (State, Severity,
Escalated; no reason asked); the conversation in the Story's row idiom, including the automatic "We received your
feedback" email (now logged). Today's New feedback count is unchanged.

**Part 7 · The Reply.** Window "Reply to {name}": the sentence first ("This sends an email to {address}. It cannot be
taken back. The feedback moves to Acknowledged."), From / Replies go to / Subject, Message (required, up to 4,000
characters), signature line, foot "Sends at once.", lime **Send reply** (S5-D1). **There is no To field:** the server takes
the address from the account behind the feedback; the browser sends the feedback number, the text and the reply's own
number. Refuse before any read for roles without the power; refuse: anonymous, account gone, address changed after the
feedback, unconfirmed or blocked, over 90 days; subject built on the server from the title with line breaks removed; a
daily limit per staff member counted in the database; records the staff member and writes an audit entry; escapes both
parts. Failure and doubt wording exactly as drawing G/D: mail service refused ("nothing was sent", message kept), no answer
("Not confirmed"; retry within a day is safe and sends once; after a day refused with the "send a new reply" line), and
a concurrent reply ("Read it first", offering "Send mine too" as a new reply with a new number). A reply clears the item
from Today only because it moves New to Acknowledged.

**Part 8 · The sent log.** Person record: a fourth tab **Emails** (Sent · Email · Club · What happened); Health › **Sent
emails** (search by address, filter, last 90 days; Sent · To · Email · Club · What happened; "no account" rows); the email
window (To, Club, Asked for by, Email, Mail service number, timeline, "What to do", foot "The email itself is not kept.");
Find's **Sent emails · n** group for an address with no account; Story rows for the Q6 kinds only. The six state words and
the empty states **exactly as drawing E**. Everything checks the new sent-log power on the server first; staff-account
emails filtered in the database for all but Super admin; each email opened from Sent emails writes a records-opened trail
row; a daily search limit per staff member in the database; Find still keeps nothing it was typed.

**Part 9 · Powers, menu, clock, words.** `PLATFORM_POWERS` gains **reply** (Super admin, Support) and **sent log** (Super
admin, Support, Billing); the menu gains Status and Sent emails in the Health group; the Story server-side drops email rows
for roles without the sent-log power. The house clock on Errors and Feedback via `formatTime()`/the shared formatter, and
the spelling gate learns the leading zero (`06:18` is the bad form). Reword the written button/colour note (S5-D1) in the
design docs and log it.

## 8 · Guards (new unit tests; ten suites from drawing H, plus)

1. **Fake mail service:** signatures against the published examples (a valid old signature with a changed time; several
   signatures on one call); the same callback twice = one change; half-failed then retried = applied once; Delivered and
   Bounced at the same instant = Bounced; a bad, missing, old, future or oversize callback refused with nothing written;
   no row / another site's row accepted with nothing kept, not even the number; secret unset = "not ready".
2. **Reply:** a double click on two servers = one email; retry with the same number = one send, edited words refused,
   after a day refused; a browser-sent recipient ignored; Billing, Product, Growth, Read only refused by the server;
   anonymous, deleted, changed, unconfirmed or blocked address, or over 90 days refused; staff member and audit entry
   recorded; line breaks in the title never reach the subject.
3. **Status:** fixed answer shape, never browser-cached, holds only verdict words, numbers and times (a test fails on a key
   name, web address, log line, commit message or provider error text); missing key = Not checked; a 5-second timeout =
   Not checked; a late counting job = "may be out of date"; Today never calls a provider.
4. **Sender:** the build fails on a send without a kind; family and alert kinds write no row; a stored row holds only an
   allowed label (no child's name, no link); no key or a refusal ends as Not sent or Failed; a log failure never blocks the
   email nor reaches error capture.
5. **Who sees the log:** Product's Story shows no email rows; staff-account emails hidden from all but Super admin; every
   email opened from Sent emails writes a trail row.
6. **Database function and tables:** the same grant checks as Stage 2; the function text never names a job's command, a
   run's message, or a session's query, user or address.
7. **Settings:** the build fails if a new setting is not passed to the server by the build, or is named public or starts
   with `AWS_`; the AWS or Supabase key names never appear where a browser loads.
8. **Powers:** the rulebook test learns reply and sent log; every new route asks its power **before** reading; the menu
   and Find hide what the rulebook hides.
9. **Find:** A3's guard extends to the Sent emails group and search.
10. **The clock:** the gate fails on a leading-zero time; Errors and Feedback print the house form.
11. **The threat list (27):** each has a guard above or a named reason it cannot (T25, the unprotected callback address,
    is on purpose: the route guard lists it as public with that reason).

## 9 · Verify

- `npx next typegen` then `npm run typecheck` (shared modules, proxy-adjacent and API contracts change); `lint:focused`
  on changed files; the guards directly with `node --import ./tests/ts-resolver.mjs --test <files>` (relative imports
  in what a test imports); `check:spelling`; `check:dictionary`.
- ⚠ `npm test` / `verify:changed` clear `test-results/` for every session: run them only when no other session is
  mid-walk, and say so. Report your reds apart from other sessions'.
- **Restart the dev server** at hand-off (new files, shared modules), via `npm run dev` only, before the layout check.
- `check:layout -- --changed` on Status (desktop **and phone**), Errors, Feedback and its record, the person record's
  Emails tab, Sent emails; Warm and Dark.
- **Read-only probes only** (`.probe/pasc/`, abort non-GET); `pa-state.json` expires and the sign-in must wait for the
  page to hydrate (`capture-s3b.mjs`); never overwrite `tests/uat/.auth/*.json`.
- **No reply and no real email from a probe**, in any mode. The owner's walk sends the test emails on dev. The callback
  is tested against the fake service; a real round trip is a release check (one test email to the admin inbox reaching
  Delivered on the Emails screen).

## 10 · Hand-off

- **Walks, one purpose each,** as checkable Artifacts with matching Owner QA Ledger sections (never sort the §):
  (1) **"I never got the email"** (the bounced invite from Find to the answer; the Emails tab; Sent emails; the staff
  and no-account cases; the empty states; Product's and Read only's views); (2) **Feedback and the reply** (the record,
  triage inside it, Reply, the failure wordings, Billing's and Product's missing door, an anonymous item, Today clearing);
  (3) **Status and Errors** (every verdict, Not checked lines with no key, Read again, the phone, the person link states).
- **Prod steps, named not run:** the migration joins **365, 367, 373, 380**; the Resend webhook + signing secret
  (production and staging, secret first); the AWS list-builds key (ListJobs on the two branches, nothing else) and the
  Supabase scoped token as Amplify settings; the release check above. **Needs `/release`.**
- **The index:** `stages/s5` state + anchor ("Built `<hash>` <date>"), a `log/` row, the walks' links.
- **Records:** the plan's S5 row and Status (+ a "Stage 5 threats → guards" list), TODO, the PM brief, the auto-memory
  `project_platform_admin_support_console.md`.
- **The finish pass is a step of the build:** `/simplify`, then a high-risk `/review` with the **security lens** (the
  callback, the reply route, the key handling, the sent log's visibility), `/docs` (console help for Status, Errors,
  Feedback and Reply, the sent log; the staff guide), `/strategy` only if a pricing or packaging fact moves (it should
  not), `/demos` is not asked.
- No commit without the owner's OK.

## 11 · Do not

- Touch the stack-health check, its schedule, hook, alert path or any watched script (the two report-only findings stay
  report-only unless the owner asks, in their own commit).
- Store an email's body, subject or links; show an address to a role without the sent-log power; log what Find was typed.
- Open a build or a log with the AWS key; run a query with the Supabase token; return raw provider text anywhere.
- Let the browser name a reply's recipient or any header; send a reply from a probe.
- Subscribe to open or click events; add a scheduled job; touch production; change `proxy.ts` without the census proving it.
- Restate a price, plan name or limit; build S6 or S7 parts; regroup browser errors.

## 12 · Git

On `dev` only. Explicit pathspecs. Branch check before every commit, `git show --stat HEAD` after. Separate commits:
- the migration, the dictionary and snapshots;
- the sender (kind on every call), the log writes and the callback with their guards;
- the powers, Status and its keys' plumbing;
- Errors, Feedback and its record, the Reply;
- the sent-log screens, Find group, Story rows;
- the clock and spelling-gate change, the docs/rule note rewording, help.

## 13 · Context you would otherwise miss

- The drawings' example people and addresses are invented; **no real customer appears on them**.
- The queued business-email-addresses project (support@/hello@/noreply@) runs right after this stage: replies go to the
  Gmail inbox until then, and the Reply-To is one setting to change later.
- The Stage 3 refund pattern is the model for the reply: write our record first, one outside call with a once-only key,
  never re-send to learn the outcome, fixed sentences chosen from the code.
- Drawing H's security pass found 4 high, 9 medium and 3 low issues in the first design; the 27 threats are the fixed
  design. Do not weaken one to ease the build; raise it at the gate.
