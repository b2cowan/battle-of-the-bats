# Money terms go only to people who can open Money — Implementation Plan

> **Status:** on the board (Owner Morning Brief).
> **History (not kept current):** CLOSED 2026-11-14 (owner). Built 2026-11-13 — committed `507f4505b` (the send engine) and `39eb59955` (the Send window); /simplify + /review applied; the owner's walk PASSED 49/49 on 2026-11-14, W5 optional Treasurer walk skipped (OWNER_QA_LEDGER §527). Q-A, Q-B and Q-E are still open.
> **Created:** 2026-11-13
> **Branch:** dev
> **Plan tier:** Club (the schedule send is `clubSchedulerOn`; the Club tier is not on sale)
> **Ruled:** owner, 2026-11-13 — money terms go only to people who can open Money (`docs/agents/legal/CASL_LATE_BILL_EMAIL.md` finding 4, owner question 1). This plan is the *how*.
> **PM brief:** `docs/projects/active/LATE_BILL_MONEY_AUDIENCE_PM_BRIEF.md`

## Goal

A club schedule send (review / Finalize / changes / late bill) tells each team's staff about the bill only if they can open
Money (`canViewMoney`, `lib/coach-capabilities.ts:551` — money `read` counts). Today the audience is "head coach and staff
with schedule access" (`canViewSchedule`), so an Assistant or Helper (schedule on, money `off`: `coach-capabilities.ts:269-274`,
`:317-322`) is emailed amounts, dates and "The bill is on **your** Money › Club tab" — untrue for them — and gets a bell and
push with the same figures.

The rule, as ruled:
- **Late bill (`kind: 'bill'`):** staff without Money are not emailed and get no bell.
- **Finalize (`final`) and changes (`changes`):** they still get the slots email and the slots bell, **without** the bill list,
  the "The bill is on your Money › Club tab" sentence, the correction line, the credit / owed-back line or any money line.
- **Every bell that carries a bill follows the same rule** (`club_bill_arrived`, and the review bell's "and a $ bill").

## PM Brief
See `LATE_BILL_MONEY_AUDIENCE_PM_BRIEF.md`.

## What the code does today (read 2026-11-13)

- **Emails.** `schedulePeople` (`lib/club-schedule-send.ts:174-190`) keeps `canViewSchedule` staff with an email, never the sender.
  `previewSend` builds ONE `sample` per team (`:812-817`); `sendSchedule` sends it to every recipient (`:989-990`).
- **Bells.** `scheduleUserIds` (`:193-198`) is the same `canViewSchedule` filter, bell needs no email. `tellTeams` (`:1111-1140`)
  writes review / final / changes / `club_bill_arrived` rows through `notify`, which also fans the same title + body to push and
  to the opt-in email channel (`lib/notify.ts` ~`:278`, `:326`).
- **The words already turn money off by an argument.** `teamEmail` is conditional on `p.bill` throughout (list, subject "slots
  and bill", the Club-tab outro lines). `changesEmail` drops its money sentences when `billedCents` and `lost` are null.
  `SCHEDULE_NOTICES.review` drops "and a $ bill" when `billCents` is null. **So the no-money variant needs no new wording**;
  it is the same builder called with the money arguments nulled. Only `billEmail` and `SCHEDULE_NOTICES.bill` are bill-only
  and are never built for a non-Money person.
- **Capabilities.** A head coach is `HEAD_COACH_ALL` (money `write`), so every team with an active head coach has a Money
  recipient. Manager and Treasurer presets hold money `write`; Assistant and Helper hold `off`.
- **Precedent.** `lib/club-money-notify.ts:113-140` (`tellTeamMoneyPeople`) already tells money people only, filter
  `isTeamMoneyMember` (`lib/coach-membership.ts:367-369`) — the same predicate. The schedule send did not use it.

## Answers to the brief's five questions

### 1. Per-person email — the smallest change
One variant per **team**, picked per **recipient**.
- `Person` gains `money: boolean` (`canViewMoney(resolveMembershipCapabilities(m))`, read in `schedulePeople` from the staff rows
  it already loads — no extra query).
- In the team loop of `previewSend`, build the money variant exactly as today, and — only when the team carries money content
  (`teamBill`, `billedCents`, or a `lost` with an amount) **and** has at least one recipient without money — build the plain
  variant by calling the same builder with `bill: null`, `billedCents: null`, `lost: null`.
- `PreviewTeam.sample` keeps its meaning "the email this team's coaches get": it is the money variant when any recipient holds
  Money, else the plain one (so the Send window never shows an email nobody receives). New `PreviewTeam.plainSample: EmailWords | null`
  is set only for a **mixed** team (some recipients with Money, some without). New `Person.money`.
- One pure picker `emailFor(team, person)` = `person.money ? team.sample : team.plainSample ?? team.sample`, used at `:989` — so
  the preview and the send cannot disagree. `sendSchedule` already recomputes the preview server-side (`:866`), so nothing new
  trusts the browser.
- Send window's counts stay true: `recipientCount` and the "who is emailed" row names read the same `recipients`; for a late
  bill `recipients` is already the money-only list.

### 2. The review email (kind `review`)
It carries the bill list, "slots and bill" in its subject, "or your Club tab" in its outro, and its bell says "and a $ bill".
**Owner confirmation wanted (one line):** apply the same rule to the review email and bell, the changes email's correction and
credit / owed-back lines, and every bell that carries a bill. This plan assumes yes — they are the same bill terms and the plain
variant is the existing wording with the money switched off.

### 3. A team with nobody eligible
- **Head coach always holds Money**, so the case is a team with no active head coach (invitation pending, or none), or the
  sender being the only Money-holder.
- **Late bill:** the money filter runs *before* the reasons are worked out, so `why` is computed on the Money-holders:
  `only_you` if the sender is among them; `invitation_unanswered` if a head-coach invitation is pending; else `no_head_coach`.
  A team whose only schedule people are an Assistant and a Helper is therefore unreachable, and the Send window says
  "Its bill goes on its Money › Club tab; nobody is emailed about it." (already worded).
  - `only_you` currently reads "has nobody with schedule access but you" (`SCHEDULE_UNREACHABLE`, `lib/club-schedule-words.ts:260-264`);
    for kind `bill` it must read "has nobody with Money access but you". `unreachableSentence` already takes `kind`.
  - **Inherited defect, same function (recommend fixing here):** the last fallback `no_head_coach` is also reached when an
    *active* head coach exists but has no email on file (`loadHeadCoaches` returns them in `people`). Add a fourth reason keyed on
    `heads.get(teamId).people.length` ("has a head coach with no email address on file") so the sentence stays honest.
- **Finalize / changes:** the team is still emailed its slots (Assistants hold schedule), but if the team has a bill and no
  recipient with Money, **nobody is told about the bill**. New `SendPreview.billNotTold: { teamId, teamName, sentence }[]`, shown
  in the window as a warning callout under the unreachable one: "Its bill goes on its Money › Club tab; nobody with Money access
  is emailed about it." Nothing is skipped; it is information.
- **The send log's `people_count`** counts emails actually sent (`:1007`), so it stays honest with no change. The bell is not
  counted, as today.

### 4. Where the bill's amounts still show — everything found
Read by the plan author and a helper survey; cited lines were verified except where marked *(to verify at build)*.

**Covered by the rule (this plan fixes):**
| Surface | Where | Fix |
|---|---|---|
| Review / Finalize email (bill list, "Club tab" lines) | `teamEmail` via `:816` | plain variant |
| Changes email (correction line, `HAND_BACK_WORDS.lostEmail`) | `changesEmail` via `:815` | plain variant |
| Late bill email | `billEmail` via `:813` | money recipients only |
| Bells: review ("and a $ bill"), `club_bill_arrived` (title and body carry dollars) | `tellTeams` `:1126-1133` | split bell audience |
| Push and opt-in email copy of those bells | same `notify` call (`lib/notify.ts` `:278`, `:326`) | covered by the split — separate `notify` calls per audience |

**Already safe — no change:**
- The coach review card and window (`ClubReviewCard.tsx`) and the Looks good / Ask for a change reply: the GET returns `[]` and the
  POST returns 403 unless the caller is the head coach (`app/api/coaches/.../club-schedules/route.ts:27, :37-39`). Safe only
  incidentally (head coach ⇒ Money). **Guard it in the tests** so a future "delegate replying" cannot open it.
- The admin Send window and send log: `app/api/admin/schedules/[scheduleId]/send/route.ts:48-52` hides `bill`, `billedCents`, `lost`
  and the money `sample` from a sender without Accounting; the send log route strips `billed`, `owedBack`, `settled`
  (`app/api/admin/schedules/[scheduleId]/route.ts:72-74`, per helper). `plainSample` carries no money, so it is always safe to return.
- The coach schedule page and the practice detail pages carry no bill text (helper survey, grep).
- `needs-attention` reads no notification body.

**NOT covered by the ruling — owner questions (listed, not built):**
- **Q-A. Hand-back dollars.** `events/route.ts:132, :152` returns `clubSources` (ask cents, `ClubSourceAsk.cents` at
  `lib/club-schedule-coach.ts:62, :78`) to every `canViewSchedule` viewer; the practice sheet shows "with $X back" to staff with
  schedule-manage (the Assistant preset) — partly deliberate per the helper *(prop comments to verify at build)*. A different money
  (hand-back credits, not the bill). Should the same rule apply?
- **Q-B. Notification settings.** Staff with money off are still offered toggles for `club_bill_arrived` (and the three schedule
  events) on the account notifications page *(helper cite; to verify at build)*. After this change they would never receive the bill
  one. Hide the bill row for money-off staff, as the other money rows already are?
- **Q-C. Past bells.** Notifications already written with dollars stay in the recipient's bell history. Club tier is not on sale,
  so I recommend no backfill. Confirm.
- **Q-D. "Bill the corrections" switch (found while reading, recommend including).** `sendSchedule` honours the switch for the
  *money step* only (`:878`, `:945-958`); the emails and the correction bell are still built from `billedCents` / `lost`
  (`:804-805`, `:1133`). Switch it off and the email still says "a correction of $X is on your Money › Club tab" and the credit
  line. That is a false money line to people who DO hold Money. Fix: `previewSend` takes a `corrections` option (default true);
  `sendSchedule` passes `billCorrectionsOn`; the window passes it on the GET and reloads when the switch moves. Same lines as this
  plan, no new recipient or content.
- **Q-E. The review email's reply line.** "Reply Looks good, or Ask for a change" goes to every recipient, but only the head coach
  can answer (403 for the rest). Untrue for every non-head coach, with Money or without — a separate promise defect. Recommended:
  a head-coach-only variant of that sentence; **not** done here because it adds a third variant and new wording.

### 5. Migration
**None.** Each notification is its own row with its own body, so splitting a bell audience needs no column; `club_schedule_sends`
already counts people. No dictionary or snapshot change.

## Phases

### Phase 1 — the pure audience helper (first; no UI, no DB)
- [ ] New `lib/club-schedule-money-audience.ts`: `moneyOf(membership)`, `splitByMoney(people)`, `emailFor(team, person)`, and
      `bellGroups({ staff, hasBill, kind })` returning `{ slots: userId[]; bill: userId[] }`. Pure, so every variant is unit-tested.
- [ ] `tests/unit/club-schedule-money-audience.test.ts` — see "Tests" below.

### Phase 2 — the send engine (`lib/club-schedule-send.ts`)
- [ ] `Person.money`; `schedulePeople` reads it, and for `kind === 'bill'` filters to Money-holders *before* working out `why`
      (and, in the same function, the head-coach-without-email reason).
- [ ] `previewSend` team loop: build the plain variant for a mixed team; set `PreviewTeam.plainSample`; set
      `SendPreview.billNotTold` for a final / changes team with a bill and no Money recipient; `sample` = plain when no recipient has Money.
- [ ] `sendSchedule` `:989`: `emailFor(team, person)` per recipient.
- [ ] `scheduleUserIds` returns `{ userId, money }`; `tellTeams` sends the slots bell to everyone, the bill bells
      (`club_bill_arrived`) and the review bell's bill body to Money-holders only, and the review bell *without* "and a $ bill"
      to the rest. One `notify` call per audience (push and email copies follow).
- [ ] Q-D (if the owner agrees): `previewSend` `corrections` option; `sendSchedule` passes `billCorrectionsOn`; route and window pass it.

### Phase 3 — the Send window and its words
- [ ] `app/api/admin/schedules/[scheduleId]/send/route.ts`: pass `plainSample` and `billNotTold` through; keep stripping `sample`
      for a sender without Accounting; `recipients[].money` goes through (no figures in it).
- [ ] `components/admin/kit/club/schedules/SendWindow.tsx`: a mixed team's row says who gets it "without the bill"; the email door
      shows the money sample, plus a second door "See the email {name} gets, without the bill" when a ticked team has a `plainSample`;
      a `billNotTold` callout. Run `/design` on the window before hand-off (house rule: every mockup and window change).
- [ ] `lib/club-schedule-words.ts` (shared file — other sessions have uncommitted edits; stage explicit hunks): `lateBillStatement`,
      `reviewStatement`, `unreachableSentence` (`only_you` for bill; the new reason), the `billNotTold` sentence. Words list below.
- [ ] `npm run check:spelling` ("8:00 a.m." via `formatTime`, "installment").

### Phase 4 — records, docs, review
- [ ] Update `docs/agents/legal/CASL_LATE_BILL_EMAIL.md` (finding 4 and owner question 1: BUILT) and `LEGAL_INDEX.md` (shared, uncommitted by
      another session — stage the hunk only).
- [ ] `/docs` — the Send window and the schedule's help text (`lib/help-content/org.tsx`, shared/uncommitted — hunks only).
- [ ] `/simplify`, then `/review`. `/legal` is **not** re-run: the change removes recipients and removes content from existing
      emails; it adds no new recipient or new content. Re-run it only if Q-E's new reply sentence is built.
- [ ] `npm run verify:changed`; `npm run typecheck` (shared module and route contract change). Restart the dev server before the
      owner's browser check (new file added).
- [ ] Move the TODO line to done when verified; add the line to `OWNER_QA_LEDGER.md` as a walk owed (do not sort the § numbers).

## Tests (Phase 1 + 2, names fixed now)
A matrix of presets × sends, built with `resolveCoachCapabilities` and `STAFF_PRESETS` (not hand-written booleans):

| Person | Late bill | Finalize | Changes (correction + credit) | Review |
|---|---|---|---|---|
| Head coach | email + bell, full | slots + bill, bell + bill bell | slots + correction + credit, both bells | slots + bill, bell with $ |
| Treasurer (schedule + money write) | same as head coach | same | same | same |
| Assistant | **no email, no bell** | slots email, slots bell; no bill list, no "Club tab" line, no bill bell | slots email + slots bell only; no money sentence | slots only; bell without "and a $ bill" |
| Helper | **none** | same as Assistant | same as Assistant | same as Assistant |

Plus:
- money `read` counts as access (a custom assistant with `money: 'read'` gets the full variant);
- a team with only an Assistant and a Helper: late bill → unreachable, sentence true; Finalize → slots sent, `billNotTold` set;
- a mixed team's `plainSample` contains no `$`, no "Club tab", no "correction", no "owed" and the money sample does;
- `emailFor` never hands a money-off person the money sample (property check over all preset pairs);
- a build guard in the existing guard file: every `notify` / `sendEmail` site that carries `billEmail`, `SCHEDULE_NOTICES.bill`, a
  bill-bearing review body, or `billedCents` is fed the Money-filtered audience (so a future send kind cannot reintroduce it);
- `unreachableSentence('…', 'only_you', …, 'bill')` says "Money access"; the head-coach-without-email reason fires only when an
  active head coach exists;
- the coach club-schedules route returns `[]` / 403 for a non-head coach (pins the "safe only incidentally" gate).

## Words for /marketing
> One pass, before the walk. Admin-facing only; no price, plan name or offer. The emails' own words are unchanged (the plain
> variant is the existing wording with the money arguments off).
- [ ] "…and its coaches who can open Money are emailed the bill; replies come to you." — Send window, late bill statement — club admin
- [ ] "Each team's coaches see their slots, and the ones who can open Money see the bill too." — Send window, review statement — club admin
- [ ] "{Team} has nobody with Money access but you." — Send window, unreachable, late bill — club admin
- [ ] "{Team} has a head coach with no email address on file." — Send window, unreachable — club admin (if the inherited-defect fix is kept)
- [ ] "Its bill goes on its Money › Club tab; nobody with Money access is emailed about it." — Send window, warning under a final / changes team — club admin
- [ ] "{Name} gets it without the bill." / "See the email {Name} gets, without the bill" — Send window row and email door — club admin

## Architectural Decisions
- **Decision:** one email variant per team, chosen per recipient — not per-person emails. **Rationale:** the words builders already
  switch money off by argument, so there are at most two variants and the window can show both truthfully.
- **Decision:** reuse the money predicate the club money notices already use (`canViewMoney` via the staff rows already loaded),
  in a new pure helper. **Rationale:** one meaning of "can open Money", unit-testable without a database.
- **Decision:** split bells into separate `notify` calls rather than filtering at read time. **Rationale:** the body is written once
  per call and fans out to push and email; there is no read-side redaction to lean on.
- **Decision:** the late bill's recipient list is filtered before the unreachable reasons are worked out. **Rationale:** otherwise a
  team with only an Assistant reads as reachable and the window's counts lie.

## RULED 2026-11-13 (owner: "I agree with your recommendations")
- **Question 2 CONFIRMED:** the rule covers the review email and bell, the changes correction and credit lines, and every bell that carries a bill.
- **Q-C RULED:** no backfill of past bells.
- **Q-D RULED:** the "Bill the corrections off" email fix is IN this build.
- **Q-E RULED:** NOT in this build; it is a separate item (the review email's reply line is untrue for every non-head coach). It adds a
  third variant and a new sentence, so it goes to `/legal` and `/marketing` when it is picked up. Build prompt:
  `LATE_BILL_MONEY_AUDIENCE_BUILD_PROMPT.md`.

## Open Questions (owner)
I gave no recommendation on these two, so they stay open and are **not built**:
- [x] Q-A hand-back dollars to money-off staff — **RULED 2026-11-14: extend the rule** (the dollar figure hides from staff without Money; the hand-back itself stays visible). Verify what the practice sheet actually shows a Money-off Assistant before building. Not built.
- [x] Q-B hide the bill-event toggles from money-off staff on the notification settings page — **RULED 2026-11-14: hide it** (the slots toggles stay for everyone). Not built.

## Built 2026-11-13 — what landed and what is still open
- **`507f4505b`** the send engine: `lib/club-schedule-money-audience.ts` (every per-team decision, pure), the unreachable reasons (filter first; new `head_coach_no_email`; "only you" now means nobody else is eligible), the Q-D switch (`opts.corrections` — only what is told), the route (money sample never reaches a sender without Accounting; `billNotTold` only to a Money sender), the guard tests.
- **`39eb59955`** the Send window: the second line on a mixed team, the two doors, the "Bill not emailed" callout (ticked teams only), the corrections switch reloads the preview, Send waits for a read and after a failed one.
- **Checks:** 160 focused tests; lint; spelling; typecheck (needs `NODE_OPTIONS=--max-old-space-size=8192`; the default 4 GB heap ran out once on this tree); each commit proved on a clean copy. `verify:changed` had 22 failures, all in other sessions' files. `check:layout` does not sweep the club admin windows.
- **Ruled and BUILT 2026-11-14:** Q-A hand-back dollars read only to someone who can open Money (taken out on the server in the events route; the ask line, the later-ask line, the club's answer and the "money people can ask" line each read without the figure; `lib/club-hand-back-money.ts`, `tests/unit/club-hand-back-money-audience.test.ts`) · Q-B the "The club billed your team" toggle is offered only to staff who hold the team's money. Walk owed. **Q-E BUILT 2026-11-14 (the simplest form, no new words):** the review email and bell go to everyone with schedule access as before, but anyone who is not the head coach reads the email without the reply sentence and the "Review it" link (the card is the head coach's alone), and their bell has no "Reply by". Walk owed.
- **CLOSED by the owner 2026-11-14** ("close all of these up"): the walk for Q-A, Q-B and Q-E was waived, so they are built and checked by tests, not walked; the optional Treasurer walk (W5) was skipped. Left open on purpose, now owner-closed: a reload while the email view is open can drop a mixed team's second email; the second door names only the first person who doesn't get the bill; the Finalize and changes hints. Commits: `04402a69c` (credit check, "credit" wording, the door), `77c04f4b1` (Q-A, Q-B), `67a34dcdf` (Q-E, committed inside that GST/HST commit).
- **Settled 2026-11-14 after the walk:** finding (1) is fixed (a send whose changes take time from a team now meets the Money check; a sender without it is told to ask someone who holds Accounting, or turn the corrections switch off, with what that costs), (2) is fixed (a credit-only team reads "credit"), and the Send window's two doors open a ticked team's email; the Finalize and changes hints and the Send help article were already corrected. `/legal` read the words the same day: no law issue (CASL_LATE_BILL_EMAIL.md). **Still open:** (3) the second door names only the first person (accurate, left), (5) the reload with the email view open, and a review email that tells an Assistant to reply.
- **Found by /review (before the walk):** (1) a Send the changes with credits only (no bill) never meets the Money check for a sender without Money — older than this build, in the step's `p_losses`; (2) the "Bill not emailed" sentence says "bill" for a credit-only team; (3) the second door names only the first person when two coaches don't get the bill; (4) the Finalize and changes hints, and the Send help article (`lib/help-content/org.tsx`), still say coaches get "their slots and their bill" — a `/docs` job; (5) a reload while the email view is open can drop the mixed team's second email and leave the form under the email header.
