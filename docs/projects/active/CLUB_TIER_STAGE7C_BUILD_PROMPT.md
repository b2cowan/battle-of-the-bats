# Club Tier Stage 7c: Email families (build prompt)

> **Written 2026-10-22** after Stage 7a's walk passed, Stage 7b's walk §358 passed 28/28 and 7b was reviewed. Ruling: Stage 7
> round 1, **Asks 6 and 7, option A each** (design log `memory/design_decisions.md` "Decision (7c — Asks 6, 7 — A, A)", ~L88;
> the asks themselves are in `docs/projects/active/CLUB_TIER_STAGE7_DRAWINGS.html` ~L1141–1161). **Paste this into a new chat
> on `dev`.** This prompt is **7c only**. 7d (the coach's Tournaments) gets its own prompt; do not build it here. Ask 13: **7c
> gets its own checkable walk page** (one purpose per walk), a § in the Owner QA Ledger. Check the ledger's last § right before
> you write the entry (§358 was the last on 2026-10-22; other sessions take numbers).
>
> **No new design session is needed for the window and the tab.** Drawing 4 (the window, desktop and phone) and drawing 5 (the
> Emails tab) are drawn and ruled. Build to the drawings, and where this prompt says a drawing is out of date or in conflict,
> build to the prompt and say so in the hand-off. **Two items below are conflicts the owner must settle first (Put to the owner
> 1 and 2); do not build the part they touch until they are answered.**

## What 7c makes true

A club admin on **Families** presses **Email families**, picks who (every family, some rep teams, or one house-league season),
writes a subject and a message, optionally copies each team's head coach, sees "**88 families get it. 7 opted out and won't.**",
and presses **Send to 88**. Each family gets the email **once** however many children it has; a family that opted out of club
email is skipped and the footer's unsubscribe holds; **replies go to the sender's own inbox**; the sender is never a recipient.
A new **Emails** tab on Families lists every email the club sent from Families (club-wide and one-household), newest first, with
**delivered of sent**. Email only: no replies product, no push, no family login, and **never the word "Messages"** (that word
belongs to the chat pause's E2).

Today no send reaches every family (finding G02). The house league has a season email, but it is not batched, not deduped, has
no cap and no preview, and sends nothing back to the sender. A club with 600 families has no way to say "picture day moved".

## Read first

- **Drawings and rulings:** https://claude.ai/artifact/MLqvD7TXbLM5QX8H9mmapZ (source `CLUB_TIER_STAGE7_DRAWINGS.html`). Read
  drawing 4 "Families › Email families" (`#e-mail`, ~L732–808, desktop at 1440 and the phone at 390, with its "What the window
  does" list), drawing 5 "Families › Emails" (`#e-log`, ~L813–835), the "Not drawn → The build carries → 7c" bullet (~L1036),
  Asks 6 and 7, and finding G02.
- **The one club send window ruling:** `memory/design_decisions.md` 2026-10-11 "ONE CLUB SEND: ONE WINDOW AND ONE LOG SHAPE"
  (~L1379). **Two mail paths, never mixed**: staff as colleague mail; a family only through the family choke point and its
  suppression list. The server recomputes the preview from what the sender confirmed, claims the send in the database before
  a single email goes, replies reach the sender, the sender is never a recipient, and every send is a row in its log.
- The Stage 5a record (`CLUB_TIER_STAGE5A_BUILD_PROMPT.md`, plan `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 5) for
  Families' one-household message, and `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` ~L671 (Ask 9).
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **CLAUDE.md binds you: broad reading goes to a helper agent, and a helper's
  summary is a lead, not evidence.** The leads below were gathered 2026-10-22 at HEAD `b7c7d8ce2`; the load-bearing ones
  (`sendFamilyEmail`, the house-league route's loop, the one-household message route's order, `loadOrgFamilyWorld`'s export,
  the two log tables' lack of counts) were re-opened by the main session. Re-read before you rely on any.
- `docs/agents/db/DATA_DICTIONARY.md`: any migration updates it, and `npm run refresh:snapshots`, in the same unit of work.
  Decide what a column is from the dictionary and snapshots, never from a migration file.

## The ruled spec

| Part | Ruled | Drawn |
|---|---|---|
| The door | An **Email families** button in the Families toolbar, beside Ask the coaches. It opens the one club send window. | drawing 4 |
| Who | **Every family** (counted) · **Some rep teams** (pick the teams) · **A house league season** (pick the season, its family count). | drawing 4 |
| Each family once | The audience is Families' de-duplicated list of households: a guardian with two children on two teams gets it once. "Every family" counts only families with a child on a live team or in an open season, **never a tryout-only applicant**. | drawing 4 |
| Head coaches copied | A tick, "Copy each team's head coach · 9 coaches, as colleagues", on by default as drawn. | drawing 4 |
| Subject, message | Subject and message fields; **See the email** shows the sample with the footer; a "Last sent Oct 12 by Sam Owner · “…” · 87 families" line. | drawing 4 |
| Nobody to send to | "12 children have no family on file. Show them" (opens Families filtered to them). | drawing 4 |
| The foot | "88 families get it. 7 opted out and won't." then **Cancel** and **Send to 88**, the lime counting who it reaches. | drawing 4 |
| Email only | No replies product, no push, no family login. Replies go to the sender's own inbox (Reply-To). | drawing 4 |
| Opt-outs hold | Through the family choke point and its suppression list, with the unsubscribe footer. | drawing 4 |
| The press | **Re-counts on the server and records the send before the first email leaves.** | drawing 4 |
| Who may send | **Anyone with Families access** (owners always; others by the per-person grant). | Ask 7 A |
| The cap | **3 club-wide sends a day.** | Ask 7 A |
| The log | An **Emails** tab on Families: every club-wide and one-household email, newest first, with "Reached 86 of 88"; a row opens the email as sent and its list. | drawing 5 |
| League Plus | Carries Families too; its "Every family" is every season's families. A plan-inclusion line for `/strategy` to confirm, **not a new gate**. | drawing 4 |
| The name | Never "Messages". The house league's season email keeps its own log and its own screen. | Ask 6, drawing 5 |

The words are `/marketing`'s: build the placements, flag every sentence.

## Put to the owner at the start (do not guess; two of these are conflicts)

1. **⚠ CONFLICT: what the Emails tab may keep.** Drawing 5 says a row "opens the email as sent and its list: who got it, who
   opted out, who bounced". But the ratified Stage 5a rule (design log Stage 5, item 5; Ask 9) is that **each send keeps its
   date and its sender, never its words or its recipients**, and `family_messages` stores only person, sender and date. A
   tab that shows the email as sent and its list needs the **subject, the body and a per-recipient result stored**: a privacy
   decision about family addresses and the club's words, kept for how long. Options:
   **(a, recommended)** keep the subject, the audience description and **counts** (sent, delivered, opted out, failed), and the
   body, but **no per-recipient list**; a row opens the email as sent and the counts, and "who bounced" is a count, not
   names. **(b)** as drawn: a per-recipient child record (family, result) kept for a stated period. **(c)** the 5a rule
   unchanged: date, sender, audience and counts only, no body; the row opens the counts and the audience line.
   Recommendation (a) because the tab's job is "what did we tell families and did it land", and a stored address list is the
   thing a data request would ask for. Either way, one-household messages already sent stay as they are (date and sender);
   say how the tab shows an old row (no subject, no counts) instead of inventing numbers.
2. **⚠ CONFLICT: the cap.** Ask 7 says "3 club-wide sends a day". The existing cap is **3 per person in a rolling 24 hours**
   (`FAMILY_MESSAGE_CAP`, mig 334's claim). Decide: a **club-wide send** means one Email families send (any audience); a
   one-household message still counts only against that person. Recommended: **a separate per-club count of 3 per rolling 24
   hours, over Email families sends only**, said once in the window as a plain sentence when it bites ("Your club has sent 3
   today. Try again tomorrow at …"); one-household messages do not count toward it, and an Email families send does not count
   against any person's cap. Say if one-household messages should count too.
3. **A big club.** `sendEmail` is one provider call per recipient with no batch API, and no route here sets a duration limit.
   A 600-family send in one request will time out. Recommended: **the press records the send, then the emails go in bounded
   parallel batches, the response returns the claim and the progress is read from the log row** (counts update as it goes, the
   Emails tab shows "Sending…" then "Reached x of y"). Alternative: a hard ceiling per send with a plain sentence. Ask which
   the owner wants; do not ship an unbounded loop.
4. **A half-sent send.** If the server dies after the claim and before the last batch, the log row would read "Sending…"
   forever. Recommended: the row shows "Stopped at x of y" after a stated grace period, and **a resend to the rest is not
   built** (the cap and the claim make it a new send). Say if the owner wants Resume.
5. **Head coaches copied.** Drawing 4 copies "each team's head coach, as colleagues". Confirm: **each head coach gets one copy of
   the email** (not one per team they coach), as **colleague mail** (their own mail path, not the family footer), and a head
   coach who is also a guardian in the audience gets the family copy only. Recommended: yes to all three. For "Every family"
   the copy goes to the head coach of every team that has an audience family on it.
6. **Quiet hours.** Does an email sent at 2:00 a.m. matter? Recommended: **no restriction** (the club decides), but the window
   shows nothing about time.

## Corrections to what the drawings and plan said (verified in code 2026-10-22)

1. **The plan's "`org_announcements` (+ send log)" (plan §6 Stage 7 migrations line) is superseded** by Ask 7: the record is
   an **Emails tab on Families**, not an announcements table. Build a send log for Families' club-wide sends (Hard part 3),
   not an `org_announcements` table, and correct the plan line in the hand-off.
2. **"Reuses the house-league broadcast sender once it is batched" cannot be met by reuse: that sender is not batched.** It is a
   sequential `for … await sendFamilyEmail` loop in `app/api/admin/house-league/seasons/[seasonId]/email/route.ts` (~L103) with
   no concurrency, no preview, no claim, no cap, no Reply-To and no dedupe (a guardian with two children gets two). Build the
   7c sender as a **shared, bounded-parallel family sender** (`inParallel` in `lib/supabase-paging.ts`, ~L47, is the existing
   helper) that 7c uses. **Do not rewire the house-league route onto it in this stage** unless the owner asks; say it is the
   natural follow-up and record it in the plan.
3. **There is no audience resolver.** The nearest assembly is `loadOrgFamilyWorld` / `buildWorklist` / `householdOf` in
   `lib/families-read.ts` (exported at the bottom, ~L983; `buildWorklist` ~L472, `repChildrenWithNoFamily` ~L589). A child is
   live if its status is not `declined` or `withdrawn`; "current" means an active rep year or an open/active house-league season;
   each family row already carries `optedOut`. Build **one audience function** over that world and use it for the preview, the
   count, the server re-count and the send. Never a second definition of "a live family".
4. **An unattached house-league registration has an email but no person.** `families_attach_people` /
   `attachPeopleForOrg` (`lib/org-people.ts`) must run before the audience is read (the one-household message uses
   `{attach: true}`), or those families are missed from the count and the send.
5. **The cap is a different number in a different place.** `FAMILY_MESSAGE_CAP = 3` (`lib/families-words.ts` ~L15) is per
   person, held equal to `v_cap` in `family_message_claim` (mig 334) by `tests/unit/families-stage5a-guard.test.ts` ~L98. The
   club-wide cap is a **new** number with a new claim function; do not reuse or widen the person cap.
6. **"Copy each team's head coach" is colleague mail, not family mail.** It goes through `loadHeadCoaches`
   (`lib/club-team-board`) and the plain mail path, **never `sendFamilyEmail`**, and the family-email guard's manifest
   (`tests/unit/family-email-guard.test.ts`, `FAMILY_SENDERS`, ~L67–95; its unlisted-sender heuristic ~L335–365) must list the
   new sender as `guarded` and say where the colleague copy goes. A coach copied must not receive the family footer.
7. **The Families page has no header actions and no Tools menu.** The toolbar row (Show pill, spacer, search) is in
   `components/admin/kit/club/families/FamiliesBook.tsx` (~L222–226); "Ask the coaches" appears only when the Show filter is
   "No family on file" (~L234). The drawing shows **Email families** beside Ask the coaches in the tools row; decide where it
   sits when Ask the coaches is not showing, and follow the standing toolbar rule (scope · Search · Filter · Tools; "one
   toolbar; rare tools behind Tools"). Email families is a **common** door, so it stays visible, not behind Tools. On a phone, a
   secondary action is its symbol alone (standing rule); this is a primary action, so it keeps its words.
8. **The Families tab bar has two tabs and a guard that says so.** `familiesTabs` in `lib/admin-kit-nav.ts` (~L388–396) and
   `tests/unit/club-stage5-families-guard.test.ts` (~L131, "Families has two tabs behind a server gate") change to three; the
   Emails tab is a new route under `app/[orgSlug]/admin/families/`.
9. **The window's foot has changed since the drawing.** The drawing's "closing asks" are superseded by One window 2d: the
   "Close without saving?" sentence is hidden everywhere (buttons only), and a form window closes on Cancel, ← or Escape, never a
   scrim tap. Use `KitDialog` (`kind="form"`, `size="medium"` = 640, `dirty` once anything is typed) and the club send window's
   shared parts. The count sentence "88 families get it. 7 opted out and won't." belongs in **`footerStart`, left**, buttons
   right (guard `tests/unit/kit-dialog-foot-text-guard.test.ts`); on a phone it sits above the buttons as drawn.

## Leads (all under the repo root; line numbers approximate)

| Need | Where |
|---|---|
| The family choke point (`sendFamilyEmail`, `getFamilySuppressionList`, the footer, `replyTo`) | `lib/family-email.ts` (~L77, ~L168), transport `lib/email.ts` ~L62–87 |
| One-household message (the pattern: access, validate, claim and cap, send with shared suppression, give back on none-reached, counts-only audit) | `app/api/admin/families/[personId]/message/route.ts`; `family_message_claim` (mig 334); `lib/families-words.ts` (`FAMILY_MESSAGE_WORDS` ~L32, `FAMILY_MESSAGE_CAP`) |
| The org-level template (preview GET with `lastSent`, claim with a per-club lock and a 60-second `just_sent`, recipients) | `app/api/admin/families/coach-ask/route.ts`, `lib/families-coach-ask.ts`, `family_coach_ask_claim` (mig 335/336), table `family_coach_asks` |
| The scheduler's send (preview, server recompute, claim, completed log row, colleague mail) | `lib/club-schedule-send.ts` (header ~L38–60), `club_schedule_send_claim` (mig 326), table `club_schedule_sends` |
| The window parts to reuse | `components/admin/kit/club/SendParts.tsx` (`SendRows`, `SendStanding`, `sendEnvelope`, `EmailWordsSample`, `SendSample`); templates `families/MessageFamilyWindow.tsx`, `families/CoachAskWindow.tsx`, `schedules/SendWindow.tsx`, `money/RemindersWindow.tsx`; `KitDialog`, `Statement`, `moneyFetch`, `refusalText`, `FormError` |
| The audience world | `lib/families-read.ts` (`loadOrgFamilyWorld`, `householdOf`, `buildWorklist` ~L472, `repChildrenWithNoFamily` ~L589, `loadHouseholdReach` ~L913), `lib/org-people.ts` (`attachPeopleForOrg`) |
| Bounded parallelism | `lib/supabase-paging.ts` (`inParallel` ~L47, `fetchAll`, `fetchAllIn`) |
| The house-league season email (do not touch; its own log) | `app/api/admin/house-league/seasons/[seasonId]/email/route.ts`; `league_email_log` (`lib/db.ts` ~L2568/2591) |
| The Families page, frame and tabs | `app/[orgSlug]/admin/families/page.tsx`, `layout.tsx` (`canOpenFamilies`), `components/admin/kit/club/families/FamiliesBook.tsx`, `FamiliesFrame.tsx`, `lib/admin-kit-nav.ts` ~L385–396 |
| Access | `lib/families-auth.ts` `requireFamiliesAccess` (~L26); `tests/unit/families-access-guard.test.ts` (the capability is off in every role default, owners always) |
| Sources of a guardian | `rep_roster_players`, `league_registrations`, `rep_tryout_registrations` (tryout-only people have a person but no child), `family_links` (a co-guardian counts only with a `verified` newest link), `org_people`, `org_person_emails` |
| Words and help | `lib/families-words.ts` (`FAMILY_LIST_WORDS` ~L165, `FAMILY_COACH_ASK_WORDS` ~L283); `lib/help-content/families.tsx` |
| Guards to read first | `family-email-guard`, `families-stage5a-guard`, `club-stage5-families-guard`, `club-stage5c-families-guard`, `families-access-guard`, `club-schedule-send.test`, `kit-dialog-foot-text-guard` (all `tests/unit/`); scripts `check:families-record` (`scripts/check-families-record.mjs` + `families-record.sql`), `scripts/check-family-message-race.mjs` |

## Hard parts (design these before you write)

1. **One audience, counted four times.** The preview, the number on the button, the server's re-count and the actual send must
   all come from the **same function**, fed by what the sender confirmed (audience kind and ids), never a list from the browser.
   The count on the lime button is "families that will get it" (deduped, not opted out); the sentence beside it names the
   opted-out and, if any, the unreachable. A test that fails if the preview and the send can disagree for the same input.
2. **Each family once, and the household.** Dedupe by person; a household with verified co-guardians (`householdOf`) sends to
   **each guardian's current address**, as the one-household message does, but counts as **one family** in the preview. Decide
   and state: "88 families" counts households; the log's "Reached" counts families reached (at least one address delivered),
   not addresses. Make the unit one word everywhere ("families"), with a test.
3. **The send log and the claim.** New migration (check the next free number; 346 was the last): a send-log table for club-wide
   family sends (sender, sent_at, subject, audience kind and description, team or season ids, counts: audience, sent,
   delivered, opted out, failed, and a status of sending / done / stopped, plus what the owner rules in Put to the owner 1)
   and a **claim function** in the style of `family_coach_ask_claim`: a per-club lock, the 3-per-rolling-24-hours cap
   (Put to the owner 2), and a short `just_sent` refusal against a double press, **all before the first email**, returning the
   log row's id. A refused claim writes nothing. Give the claim back (delete the row) when **nobody** was reached, as the
   one-household message does, so a send that failed entirely does not eat the day's allowance. Prove it with a **two-process
   race** in `scripts/check-family-message-race.mjs`'s style (two presses at once yield one send), extend
   `check:families-record`, and put the migration in `supabase/migrations/MANUAL_PROD_STEPS.json` (ORDER-CRITICAL for the
   release; function-and-table migrations are verified by `pg_proc` and `information_schema`). Update the data dictionary and
   snapshots in the same unit of work.
4. **The Emails tab reads two sources.** One-household messages are in `family_messages` (person, sender, date; no subject or
   counts) and club-wide sends in the new table. The tab is a **read that merges them** (paged; every Families read is paged,
   guard `families-stage5a-guard` ~L127), newest first. A one-household row has no "Reached"; show it honestly ("1 family"
   with no x of y) rather than inventing a number. Reading the tab needs the same Families access gate. "Nothing here is
   editable."
5. **Email only, nothing new for families.** No reply inbox, no push, no family login, no new notification kind, no chat. Check
   that no code path creates a `notify()`, a push or a chat message for this send. The send is an email through the choke
   point and the log; the admin bell does not need to fire for the sender's own send. The copy to head coaches is the only
   colleague mail (Corrections 6).
6. **The sender is never a recipient, and a coach is not a family.** If the sender's address is in the audience, they are
   skipped from the family copy (say so in the window's count, "You are not counted"), as the scheduler's sends do. A head
   coach copied who is also in the audience gets one copy only (Put to the owner 5).
7. **Demo and test mail.** `sendEmail` has no demo check of its own; the proxy refuses a demo club's POST and `notify()` stays
   silent for one (`club-schedule-send.ts` header). Confirm the new route is covered by the same refusal and **no email leaves
   a demo club or a test run to a real address**: the UAT fixture must use the mail stub or the send log, as 7b's probe did.
8. **Plain failures.** A provider error for some families is a count ("Reached 86 of 88"), not a failed send; all failing gives
   the claim back and says so in one sentence in the window with the typed text kept (the cap race in `MessageFamilyWindow`
   already keeps the typed text). Validate: subject up to 200, message up to 5000 characters (the one-household limits), a
   blank subject or message refused in words.
9. **Plan inclusion.** League Plus carries Families; its "Every family" is every season's families. Do not add a gate. Note it
   for `/strategy` in the hand-off and check the Plan Facts doc says Families is included on that plan (do not restate a price).
10. **League and rep both.** "Every family" reads rep rosters **and** house-league registrations (and `family_links`
    co-guardians). A club with no house league sees no "A house league season" option; a club with no rep teams sees no "Some
    rep teams" option. Say which options exist from what the club runs, not from a plan flag alone.

## Definition of done

1. The window opens from **Email families** on Families (desktop 640; the phone full screen with 44 px fields and foot
   buttons, the sentence above the buttons), with Who, the head coach tick, Subject, Message, "Nobody to send to", "See the
   email", "Last sent …", and the foot sentence and **Send to N** counting. `check:layout --changed` on the Families screens at
   361 and 1440, plus the window open if the script supports it.
2. A send: the preview, the confirmed audience and the server's re-count agree; the claim is taken before the first email; each
   family gets one email; opted-out families get none; replies go to the sender; the sender is not a recipient; head coaches
   get their colleague copy once; the log row reads Sending then the final counts; a double press and a second admin at once
   produce one send; the fourth send in a rolling day is refused with the plain sentence; a send that reached nobody gives
   back its claim. Tests for each, **including the race**, and `check:families-record` extended and green on dev.
3. The **Emails** tab: third tab on Families, newest first, club-wide and one-household rows, "Reached x of y" for the former,
   an honest line for the latter, a row that opens what the owner ruled in Put to the owner 1; paged; behind the Families gate.
4. The family-email guard's manifest lists the new sender; the colleague copy is outside `sendFamilyEmail`; the guards for the
   tab count, the cap equality (the club cap stated once on screen and in the claim function, held equal by a test) and the
   words ("Messages" appears nowhere in the feature; `check:spelling` green) are updated or added.
5. Access: a member without the Families grant, a member limited to a group of teams, and a coach cannot open the window or
   post the send (server-refused); an owner and a granted member can. A demo club cannot send.
6. The UAT fixture (`uat-rep-club`): a real send to a small audience (rep and house league, one family with two children, one
   opted-out family, one tryout-only applicant, one unattached house-league registration) lands in the mail stub or the send log
   only, with the counts the preview promised. Nothing real was emailed.
7. Gates: `npm run verify:changed`, `typecheck` (a migration and shared modules), the Families and email unit tests, `check:layout
   --changed`, `check:spelling`, `check:dictionary`, `check:snapshots`, `check:manual-migrations`. **Do not run the whole-product
   layout sweep on dev.**
8. Records: plan §6 Stage 7 "7c BUILT" (departures, found-not-fixed, and the corrected "`org_announcements`" line), TODO, design log
   for each new ruling (Put to the owner 1–6), Owner QA Ledger § (check the last number), the project index (`stages/s7` + a log
   row), **the 7c walk page** (Ask 13): setup, the window and its count, a send to every family, a send to some teams, a send to
   a season, the opt-out and the sender-not-a-recipient, the double press and the cap, the Emails tab, the coach copy, the phone.
   Offer `/review`, `/simplify` (a shared batched sender is a new abstraction), `/design` (run it on the built window at 390 and
   1440), `/docs` (Families: Email families and Emails; the House league season email article points to it), `/marketing` for
   every sentence, and `/strategy` for the League Plus inclusion note, per CLAUDE.md; **commit only when the owner says**,
   through a private index (the tree holds other sessions' edits in TODO, plan, ledger, design log).

## Not in 7c

- Folding the house league's season email into this window or its log (the Messages project's first step, E6).
- Replies, push, a family login, a family-facing archive of what was sent.
- Rewiring the house-league route onto the new batched sender (record it as the follow-up).
- Scheduling a send for later, recurring sends, templates, attachments, and merge fields beyond the family footer.
- The coach's Tournaments (7d).
