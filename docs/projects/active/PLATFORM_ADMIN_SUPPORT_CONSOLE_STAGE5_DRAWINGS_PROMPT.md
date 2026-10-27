# Platform admin support console · Stage 5, Health (drawings prompt)

> Paste into a new chat on `dev`. Written 2026-10-26, the day the owner passed the Stage 3 money walk (ledger §384, 44 of 44 + 9 calls accepted); the guard-rails walk (§385) runs in parallel and does not block this.
> **This session draws and asks. It builds nothing.** The output is a drawings Artifact, the owner's rulings on it, and
> then a Stage 5 build prompt (written last, like Stages 2, 3 and 4). **Re-verify every lead against the code before you
> draw on it:** this prompt is a lead, not evidence, and so is any helper's summary. The working copy is shared with Club
> Tier and Bookkeeping sessions: stage explicit paths only, check the branch before every commit, `git show --stat HEAD`
> after it. Commit nothing without the owner's OK.

## 1 · What Stage 5 makes true (the objective)

Support can answer **"is the platform healthy right now, and what did this customer actually receive?"** from inside the
console, without opening the Amplify, Supabase, CloudWatch or Resend dashboards. The kickoff counted five or six places
a person has to look today. Stage 5 makes it one idea, the same one Stage 3 used: **the truth is shown when the screen
opens, never remembered (R7).**

1. **Status (new, under Health, reads on open).** One screen: the deployed sites (production, and staging if it exists),
   their latest builds, the databases (are they up, how loaded), and the app's own error and traffic rollups. "Dev
   servers" is **ruled** to mean the deployed sites, their builds and the databases (Q6, first half). Each line says
   green / amber / red in plain words with one "what to do". A reading that could not be taken says so; it is never
   shown as fine.
2. **Errors, restyled, with a person link.** The Errors screen today shows a sample event whose email is plain text.
   Make the email open that person's record (the person record exists since Stage 2). Also retire the stale coverage
   caveat on the screen (the plan's census says 546 of 581 routes are wrapped; **re-count, do not trust it**).
3. **Feedback reply.** Feedback has no reply today. Support can answer a customer from the feedback item. **A reply is
   a customer-facing send**, so it is its own ask (R5: a sent message can never be "put back").
4. **A sent-email log, with delivery.** Account emails (sign-in, invites, receipts, "I never got the email") are logged
   nowhere today; only campaign sends are recorded. Stage 5 makes "did they get it?" answerable: what was sent, to
   whom, when, and what the provider says happened to it (delivered, bounced, complained), through a **delivery
   callback** from the email provider. That callback is a new public endpoint and a provider setting: draw its cost.
5. **The morning check on Status (Q6, second half, STILL OPEN).** Whether Status shows the morning stack-health check's
   result is **not ruled**. Draw the options honestly (§6-2). **Nothing that touches the stack-health check, its
   schedule or any watched path is changed in this session or built without the owner's word in that conversation.**

**Not Stage 5** (later or elsewhere; do not draw them as if built):
- club web addresses and the Amplify quota (S6);
- Leads, Campaigns, Pitch decks, Plans & pricing, Templates (S7), and Campaigns' own send log (it exists; do not redraw it);
- staff and roles, audit search, Help (S8);
- the **club's** own email history to families (Club Tier's families emails log): a different surface for a different
  reader. Say on the drawings how the console's log differs, and do not merge them;
- Coaches Portal free time (S4b, a separate drawing).

## 2 · Standing rulings (do not reopen)

- The plan's "Owner rulings 2026-10-24", "2026-10-25", "2026-10-26" and the standing rules **R1–R8**. Especially **R5**
  (undo is Put it back, never for anything that reached an inbox) and **R7** (shown, not remembered).
- **Q4:** desktop only, but **Status and Today stay readable on a phone.** Draw Status at phone width too.
- **Q6, first half:** "dev servers" = the deployed sites, their builds and the databases.
- **Sequence ruled 2026-10-26:** S3, then S5, then S4b (S4b slots ahead of the Founding turn-off deadline).
- Stages 1–4 are done (S3 walked, §384 and §385 both ✅). Shell, Find, the menu by job, Today, the record and Story, Put it back,
  free time, the Money tab: as built. Draw Stage 5's parts **on** them. The menu already has a **Health** group holding
  Errors and Feedback: Status joins it, it does not create a group.
- Warm is the default; Dark follows the account setting. Draw both.
- **A reason on every change to a customer's club, person, plan, money or retention** (Stage 3, ruled). A feedback
  reply and an email log are the console's own work tools: they write none unless the owner says otherwise (§6).
- **Find may never log** the words typed (A3). Anything new that is searchable (an email address in the sent log) must
  keep that.
- **Shared automation changes only on the owner's word, in the conversation, in their own commit**
  (`AGENCY_RULES.md`). The stack-health check, its hook, its scheduled task, `scripts/check-agent-automation.mjs` and
  the `.claude/settings*.json` hooks are watched. A check is report-only.

## 3 · Read first

- The plan (`PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md`: ladder row S5, "Kickoff findings" Task 3 and tasks 4–12 (email
  unlogged, feedback has no reply), the Stage 2/3/4 findings), the PM brief, and the index
  https://claude.ai/artifact/TLP8d5Zec4xVkTSYrQU8tp (news goes in as an `ArtifactData` write to `stages/s5` and
  `log/…`; never republish it).
- The end state https://claude.ai/artifact/RCpPoxNNxGDfiC4FFo4m1g: its **Status screen** was drawn before Stages 1–4
  existed. **Redraw it on the real shell**, do not copy it.
- The Stage 3 drawings https://claude.ai/artifact/FdTWB58ne1jgsBXSwutdLX and walk
  https://claude.ai/artifact/CBCDtZjmsd9pFr5o8toUUV for the format the owner approved: true size, Warm and Dark, before
  = a capture from dev, NEW / RESTYLED / UNCHANGED / LATER tags, each clickable with its reason, a checkable paste-back
  with a recommendation beside every ask. **Draw every screen FROM its capture, part by part** (the Stage 4 lesson), and
  keep ONE example throughout rather than three different stories (the Stage 3 lesson).
- What Stage 5 stands on: `app/platform-admin/observability/**`, `app/platform-admin/feedback/**`,
  `app/platform-admin/email/**` (Campaigns), `console-menu.ts`, the `PLATFORM_POWERS` rulebook in
  `lib/platform-areas.ts`, `lib/platform-waiting.ts` (Today's queues already read new errors and feedback),
  `lib/platform-story.ts`, `lib/email.ts` and `lib/email-sender.ts` (the one place account email leaves), the
  `email_sends` table (campaign sends), and the person record.
- `scripts/stack-health.mjs`, `scripts/lib/supabase-ops.mjs`, `docs/projects/active/STACK_HEALTH_CHECK_PLAN.md` and
  `.health/latest.md` (a sample of what the morning check reads and says). **Read-only: learn what it reads and what
  keys it needs; do not run anything that writes.** The check's history lives on the owner's PC, so the deployed
  console can never read it. That is the heart of ask 2.
- `docs/agents/db/` snapshots for any table you draw on (**not** migration files), `AGENTS.md`, `AGENCY_RULES.md` (PM UX
  summary before code; disagree out loud), `docs/agents/design/` standards. **Check the AWS Amplify, Supabase
  Management API and email provider's current docs for every API you draw on, not memory**, as for Stripe in Stage 3.

## 4 · Verify these leads first (the plan has been wrong before)

| Claim | Check against |
|---|---|
| Nothing in `app/` reads the morning check, and the deployed console cannot | What the console runs on (Amplify), whether `.health/` exists there (it should not), and every `.health` reference under `app/` and `lib/` |
| Builds, database vitals and advisors live in the Amplify, Supabase and CloudWatch consoles | The calls `stack-health.mjs` makes and `scripts/lib/supabase-ops.mjs`: which are read-only, which key or token each needs, whether the key can be **scoped read-only** (a Supabase Management API token is usually account-wide: say so if it is), and where a deployed function would keep it. The plan says "read-only AWS + Supabase keys on prod (owner step)": confirm that is possible at all before drawing a screen that needs it |
| Observability reads only the app's own `error_events`, `error_groups` and request rollups | The Errors page and its routes; what the Today queue's "new errors" reads; whether a Status line can come **from these alone** (a Status with no new keys is the cheapest honest version: draw it as a real option) |
| The Errors coverage caveat is stale (546 of 581) | Re-count wrapped routes yourself, and how the screen words the caveat now |
| The email in a sample event is plain text | The sample-event component, what else in an event is personal (path, query, user id), and whether the person link can resolve every event's user. An event with no known person must draw honestly |
| Account emails are unlogged | `lib/email.ts` and `lib/email-sender.ts`: every sender that does not go through `email_sends`, and what a log row could hold **without the body** (recipient, template, subject, sent time, provider message id). Count the sender call sites; the build must cover all or say which it leaves |
| Delivery status is unknown to us | Whether an email-provider webhook route already exists (grep for the provider's signature header and event names), what events the provider offers, how a callback is **verified**, and what the provider's own dashboard already shows (the case for building this at all) |
| Campaign sends are recorded in `email_sends` | Its columns in the dev snapshot, whether it holds delivery state, and whether one table can serve both campaign and account sends or a second is cleaner |
| Feedback has no reply | The feedback table and its routes, who submits (signed in or anonymous), whether the submitter's email is always known, and what "status" a feedback item has |
| Who may see what | `PLATFORM_POWERS`: which powers exist for health, errors, feedback and email, which staff roles hold them, and whether Status, a reply or the sent log need a **new power** (a rulebook change: draw it) |
| Today already counts new errors and feedback | `lib/platform-waiting.ts`: a reply must clear the feedback item from Today the way the other queues clear (see the "needs attention clears itself" lesson in the project memory) |

## 5 · The drawings (blocking: no code in this session at all)

Published as one Artifact from `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE5_DRAWINGS.html`, linked from the index's `stages/s5`.
True size, 1440 wide, Warm and Dark, plus Status at phone width. Whole-screen before → after. Every highlight clickable
with its reason.

- **A · Status.** The deployed sites with their latest build; the databases; the app's error and traffic rollups; each
  line with a plain verdict and a "what to do". The screen's own time stamp ("read at 9:42 a.m.", house clock). Draw the
  lines that exist **without** new keys and mark, separately and clickably, the lines that need the read-only keys
  (so the owner sees what the key buys).
- **B · The morning check on Status.** The three options of ask 2 side by side, each with its cost, so the owner can
  see them. Do not pick.
- **C · Errors, restyled.** The list and a group's detail on the kit, the sample event with the email as a person link,
  the new-errors count unchanged. Draw an event whose person is unknown.
- **D · Feedback and the reply.** The item, the thread, the reply window (what support types, what the customer will
  receive, from which address, with which signature), the confirm sentence with its **plain consequence** ("This sends
  an email to the customer. It cannot be taken back."), and the item after. Draw an anonymous submitter (no address to
  reply to) and a reply that fails to send. **A customer-facing send needs its own ask (§6-5).**
- **E · The sent-email log.** Where it lives (a tab on the person record? the club record? both? a screen under
  Health?), the columns, the delivery states in plain words, and the "I never got the email" journey from Find to the
  answer in as few clicks as possible. Draw bounced, delivered-but-not-opened-is-not-a-thing (say what we do not know),
  and no-record-at-all (sent before the log existed).
- **F · The delivery callback.** Not a screen: a one-page diagram of the new public endpoint (what calls it, how it is
  verified, what it writes, what happens when it is called twice or out of order), the provider setting the owner must
  turn on, and the **release step** it adds (a new public route and a provider setting are `/release` items).
- **G · When it cannot work.** Amplify or Supabase unreachable; the key missing, expired or refused; a reading that is
  slow; a stale reading must never look fresh; a bounce arriving before our row exists; the same delivery event twice; a
  reply to a feedback item someone else already answered; a role that may read but not reply (draw each role).
- **H · The threat list and test plan.** A written threat list over the *design*: the read-only keys never reach the
  browser; the Status route returns verdicts and counts, **not raw logs or environment values** (a build log can hold a
  secret); a delivery callback that is unverified or replayed; a reply that lets a staff member set the recipient or
  inject headers (the recipient comes from the feedback record, never the browser); a reply sent twice on a double click
  (idempotent, one send per click); the sent log exposing a customer's address to roles that should not see it; the
  Errors person link leaking a record to a role without the power; what is logged and what is not. Run **`/review`**'s
  security lens over the design. State the tests the build must carry, including a fake-provider suite that proves a
  duplicate callback and a retried reply each change nothing twice.
- **I · The boundary.** One page marking every part NEW / RESTYLED / UNCHANGED / LATER so the owner sees what Stage 5
  will and will not deliver. Nothing may imply S6 or S7 is built. Example data labelled "example", and **no real
  customer's name or address** on a drawing.
- Run **`/design`** on the drawings before the hand-off, apply its fixes, and list any written-rule conflict for the owner.

## 6 · Asks for the owner (one recommendation each, beside the drawing it decides)

Draft these, reword to the drawings: **do not decide for the owner.**
1. **What Status shows, and which lines need new keys.** Recommend starting with what the app already knows (its own
   errors and traffic, plus whatever the deployed code can read with no new key), and adding builds and database
   vitals only if a **read-only** key exists for each. State what each key can and cannot do, and if a key cannot be
   scoped read-only, say so plainly: that is the owner's risk call.
2. **The morning check on Status (Q6, second half).** (A) not at all: Status's own live reads replace it; (B) Status
   runs its own live reads and the morning check stays on the owner's PC unchanged; (C) the morning check writes its
   summary somewhere the console can read (a shared automation change: its own commit, only on the owner's word, and a
   new write path from a PC job to production). Recommend with the cost of each; the live reads give the same facts for
   *now*, and the check's real extra is its history and "worse than the last seven days" judgement. Say which of
   those the owner loses under A or B.
3. **Who sees Status, Errors detail, the sent log:** which roles (the matrix is the starting point), and does the sent
   log show a customer's address to Support only or to everyone who reads the record?
4. **The Errors person link:** to the person record for every role that can read Errors, or only those who can already
   open people? (Recommend the second: a link must never grant a view.)
5. **Feedback reply:** by email from us, or an in-app note only? From which address, with whose name, replies back to
   which inbox (the admin inbox rule: fieldlogichq@gmail.com only)? May Billing reply, or Support and Super admin only?
   Does a reply need a reason (a customer-facing send)? Does sending a reply close the item? This is a customer-facing
   send and must be ruled in its own right.
6. **The sent-email log:** which emails (account emails only, or everything incl. family and club sends), what is
   stored (never the body; recipient, template, subject, time, provider id, delivery state), how long it is kept, and
   whether a **Story** row appears for an email ("sent a sign-in link"). Recommend account emails only, no body, kept
   90 days (to match the access trail), and a Story row only for emails a person would ask about.
7. **The delivery callback:** build it (a migration, a public route, a provider setting, a release step) or read
   delivery live from the provider's API when a person opens the record (nothing stored, nothing public, but rate limits
   and no history)? State both costs, and prefer the answer that works when the provider is down.
8. **Cover every sender or the main ones:** if the call-site count is large, is logging "all account emails through the
   one sender" enough, or must every direct send be moved to it first?
9. **Anything the drawings surface** that the census found: the stale Errors caveat (rides this stage unless the owner
   says otherwise), unlogged senders, a power that needs adding.

## 7 · Hand-off

- Restate the **PM summary in five lines** (`AGENCY_RULES`): what support sees and does, what the customer receives (a
  feedback reply is the only new customer-facing send), what is deliberately left for S6/S7, Warm/Dark/phone, roles.
- Update the index (`stages/s5` state + anchor + a `log/` row), the plan's S5 row and Status, the PM brief, and the
  auto-memory file `project_platform_admin_support_console.md`. A ruling is recorded exactly as ruled; add nothing it did
  not rule. (The index's TODO line is owed too: `TODO.md` is shared and has other sessions' edits, so add only your line.)
- When the owner has ruled: write `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE5_BUILD_PROMPT.md`, in Stage 3's shape (verified
  state, scope is / is not, parts, **gate = a census of senders and keys, `/release` for the callback and any key, a
  provider-docs check**, guards, verify, hand-off, do not). If a table or a migration is ruled in, say so there; this
  session writes none. Plan the finish pass (`/simplify`, a high-risk `/review`, `/docs`, `/strategy` only if a pricing
  or packaging fact moves, which it should not) as a step of the build.
- Prod already owes migrations 365, 367, 373 and 380 at the next release: if Stage 5 adds one, the build prompt says it
  joins that list, and **a new public route, a provider setting or a new key in production is a release step that needs
  `/release`**.

## 8 · Do not

- Write or change code, schema, `proxy.ts`, hooks, env settings, the stack-health check or any watched script.
- Use a production key, or any key, to do more than a **read** that teaches you a response shape. Never send an email,
  reply to a feedback item, create or change anything at AWS, Supabase or the email provider, even in test mode, from a
  probe. Do not run `apply-migration-api` for a read query (it refreshes the snapshots against both databases).
- Redraw what Stages 1–4 ruled (the shell, Find, the menu, Today's frame, the Story, the one pencil, free time, the
  Money tab).
- Draw S6, S7 or the club's own families email log as if they exist.
- Draw a screen from memory of the kit: capture it from dev first (the probe's saved sign-in expires; the Stage 3
  capture script re-signs in; never overwrite `tests/uat/.auth/platform-admin.json`; one page at a time and Warm first,
  because the dev server runs hot).
- Decide an ask for the owner, or tick a box for them.
