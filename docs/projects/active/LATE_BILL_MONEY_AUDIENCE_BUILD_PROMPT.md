# Money terms go only to people who can open Money — build prompt

> Written 2026-11-13 by the planning session (`/plan`) from the owner's ruling and the plan of record:
> [LATE_BILL_MONEY_AUDIENCE_PLAN.md](LATE_BILL_MONEY_AUDIENCE_PLAN.md) (read it first — its tables and "RULED" block bind). PM brief:
> [LATE_BILL_MONEY_AUDIENCE_PM_BRIEF.md](LATE_BILL_MONEY_AUDIENCE_PM_BRIEF.md). The finding: `docs/agents/legal/CASL_LATE_BILL_EMAIL.md`
> finding 4 and owner question 1. **One Sonnet build session, four phases in order, one commit per phase if the owner approves.**
> Marks: **[V]** opened by the planning session 2026-11-13; **[H]** a helper's survey that day — **open the line before relying on it.**
> Line numbers drift: search for the symbol.

## 1. What this builds (owner's view)
Money terms go only to staff who can open Money (`canViewMoney`: money `read` or `write`).
- **Late bill ("Send the bill"):** staff without Money get no email and no bell.
- **Finalize, Send the changes, and the review:** staff without Money still get the slots email and slots bell, with **no** bill
  list, **no** "The bill is on your Money › Club tab" sentence, **no** correction line, **no** credit / owed-back line, and a bell body
  with no dollars. Staff with Money get exactly what they get today.
- **Every bell that carries a bill follows the same rule** (`club_bill_arrived`; the review bell's "and a $ bill"). Push and the opt-in
  email copy carry the same title and body, so they follow.
- **The "Bill the corrections" switch (ruled IN):** switched off at Send the changes, the emails and the correction bell no longer say
  a correction was billed or a credit given.
- **The Send window** shows who gets which email, and warns when a team's bill reaches nobody.

## 2. Rulings that bind (owner, 2026-11-13)
- The rule above, incl. the review email and bells (question 2 CONFIRMED).
- **Q-D IN** (the switch-off fix). **Q-C:** no backfill of past bells. **Q-E NOT here:** the review email's "Reply Looks good" line is
  untrue for every non-head coach — do not touch that sentence; it is a separate item for `/legal` + `/marketing`.
- **Q-A (hand-back dollars on the coach events route / practice sheet) and Q-B (notification-settings toggles) are OPEN. Do not
  build either.** If you find yourself editing `events/route.ts` or the account notifications page, stop.
- **No migration.** If you think you need one, stop and ask. No dictionary or snapshot change.
- `/legal` is **not** re-run: this removes recipients and removes content from existing emails; it adds neither. If you add any
  customer-facing sentence outside the six in §6, mark it in the hand-over — it goes to the next `/legal` pass.
- Plan tier: Club (the schedule send is `clubSchedulerOn`). Not on sale. Demos follow the product; do nothing for them.

## 3. Read first (≈ 8 reads, then start)
1. The plan (above) — "What the code does today", the five answers, the Tests matrix.
2. `lib/club-schedule-send.ts` — `Person` (~`:82`), `PreviewTeam` (~`:84`), `schedulePeople` (~`:174`), `scheduleUserIds` (~`:193`), the team loop in `previewSend` (~`:783-818`), the `recipientCount` line (~`:834`), `sendSchedule` (~`:856-1013`, esp. the emails at ~`:989`, `billCorrectionsOn` at ~`:878`), `tellTeams` (~`:1111-1140`). **[V]**
3. `lib/club-schedule-words.ts` — `unreachableSentence` and `SCHEDULE_UNREACHABLE` (~`:260-277`), `teamEmail` / `billEmail` / `changesEmail` (~`:305-402`), `SCHEDULE_NOTICES` (~`:407`), `lateBillStatement` / `reviewStatement` (~`:49-53`). **[V]** ⚠ This file has **another session's uncommitted edits** — stage only your hunks.
4. `components/admin/kit/club/schedules/SendWindow.tsx` (the whole file, ~285 lines) and `app/api/admin/schedules/[scheduleId]/send/route.ts` (GET, ~`:27-65`). **[V]**
5. `lib/coach-capabilities.ts`: `STAFF_PRESETS` (~`:268-323`), `resolveCoachCapabilities` (~`:485`), `canViewMoney` (~`:551`). `lib/coach-membership.ts` `isTeamMoneyMember` (~`:367`) and `resolveMembershipCapabilities` (~`:111`). **[V]**
6. `lib/club-money-notify.ts:113-140` (`tellTeamMoneyPeople`) — the existing precedent for money-only audiences. **[H]**
7. `lib/notify.ts` — confirm one `notify({ userIds, title, body })` call writes one body for all of `userIds` and fans the same title/body to push (~`:326`) and the email channel. **[V that it fans out; read the call shape]**
8. `tests/unit/club-schedule-send.test.ts` (pure-function style) and `tests/unit/club-scheduler-guard.test.ts` (source-guard style) — match them.

## 4. The build

### Phase 1 — the pure audience helper (no DB, no UI) + its tests FIRST
- New `lib/club-schedule-money-audience.ts` (no `server-only`): 
  - `moneyOf(membership)` = `canViewMoney(resolveMembershipCapabilities(m))`;
  - `emailFor(team, person)` = `person.money ? team.sample : team.plainSample ?? team.sample`;
  - `bellGroups({ staff, hasBill })` → `{ everyone: string[]; money: string[] }` (userIds);
  - `carriesMoney({ bill, billedCents, lost })` using the **same truthiness the words use**: `!!bill || !!billedCents || (lost && (lost.creditCents || lost.payCents))` — so "carries money" ⇔ the plain variant actually differs.
- `tests/unit/club-schedule-money-audience.test.ts`: build people with `resolveCoachCapabilities('head_coach')` and `resolveCoachCapabilities('assistant_coach', STAFF_PRESETS.assistant | .helper | .treasurer | .manager)` — **never hand-written booleans**. Cover: money `read` counts; the property "`emailFor` never returns a money sample to a money-off person" over every preset pair; `bellGroups` per preset.

### Phase 2 — the send engine (`lib/club-schedule-send.ts`)
- [ ] `Person.money: boolean`, set in `schedulePeople` from the staff rows it already loads (no new query).
- [ ] **`schedulePeople` takes `kind`.** For `'bill'`, keep only Money-holders **before** the `why` is worked out. `why` order: `only_you` (the sender is among the eligible) → `invitation_unanswered` → **new `head_coach_no_email`** when `heads.get(teamId).people.length > 0` → else `no_head_coach`. (Today an active head coach with no email falls through to `no_head_coach`, which is false.)
- [ ] `PreviewTeam.plainSample: EmailWords | null` and `SendPreview.billNotTold: { teamId; teamName; sentence }[]`.
- [ ] Team loop: build the money variant exactly as today. Build the plain variant **only** when `carriesMoney(...)` and the team has ≥1 recipient without money **and** ≥1 with. Call the same builders with `bill: null`, `billedCents: null`, `lost: null` — **the existing words already drop every money line when those are null; do not write new email wording.** `sample` = the money variant if any recipient has Money, else the plain one. `plainSample` only for a mixed team. For `final` / `changes` with a bill (`teamBill` / `billedCents` / `lost`) and **no** Money recipient → add to `billNotTold`.
- [ ] `sendSchedule`: replace the `t.sample` fan-out with `emailFor(t, p)` per recipient.
- [ ] `scheduleUserIds` → `{ userId, money }[]` per team (same `canViewSchedule` filter, plus the flag). `tellTeams`:
  - `final` / `changes`: the slots bell to everyone (unchanged); `club_bill_arrived` (`billBell`) to **Money-holders only**;
  - `review`: Money-holders get `SCHEDULE_NOTICES.review` with `billCents`; the rest get it with `billCents: null` — **two `notify` calls only when the team has a bill**, one otherwise;
  - `bill`: Money-holders only;
  - keep `excludeUserIds: [sender]` and the best-effort try/catch.
- [ ] **Q-D:** `previewSend` takes `opts.corrections` (default `true`). When `false`, the **team-level** `billedCents` and `lost` (and so the emails, the correction bell and the window's team line) are null. ⚠ Do **not** null `p.correction`, `splits`, `teamValues` or the `lost` map the step reads — the step already honours `billCorrectionsOn` itself (`:945-958`); you are fixing only what is *told*. `sendSchedule` passes `{ corrections: billCorrectionsOn }` to its `previewSend`.
- [ ] Re-read `recipientCount`: it must equal the emails that will go (late bill: Money-holders only).

### Phase 3 — the Send window, the route and the words
- [ ] **Route** (`send/route.ts` GET): pass `plainSample`, `billNotTold` and `recipients[].money` through; keep nulling the money `sample` / `bill` / `billedCents` / `lost` for a sender without Accounting (`carriesMoney` must use the shared helper so a mixed team's plain sample survives); read a `corrections=0` query param and pass it to `previewSend`.
- [ ] **Window** (`SendWindow.tsx`): a mixed team's sub-line says who gets it "without the bill"; the email door opens the money sample, plus a second door for a ticked team's `plainSample`; the `billNotTold` callout sits under the unreachable one, same tone and component; the `corrections` switch adds `&corrections=0` to the preview URL and the preview reloads when it moves (add it to `load`'s deps; keep the `useLatestRead` stale-read guard). A sender without Accounting sees the plain door and no money door.
- [ ] **Words** (`lib/club-schedule-words.ts`, hunks only): the six sentences in §6; `unreachableSentence` says "Money access" for `only_you` **when `kind === 'bill'`**; add the `head_coach_no_email` reason. ⚠ Before adding a key to `SCHEDULE_UNREACHABLE`, grep for its other consumers (the reminders reuse the three reasons) and for tests pinning them (`club-schedule-send.test.ts` ~`:115`).
- [ ] `npm run check:spelling` (clock: "8:00 a.m." via `formatTime()`; "installment").
- [ ] Run **`/design`** on the window change before handing off.

### Phase 4 — records, docs, review
- [ ] `docs/agents/legal/CASL_LATE_BILL_EMAIL.md`: finding 4 and owner question 1 → BUILT with the commit hash; keep the 2026-11-13 ruling text. `LEGAL_INDEX.md` has another session's uncommitted edits — your hunk only.
- [ ] `TODO.md` line (search "13c/Finalize: the bill email"): record the positive fact with its anchor ("built, committed `<hash>` <date>"), walk owed. Never "uncommitted". Add the walk to `OWNER_QA_LEDGER.md` as owed (do **not** sort the § numbers). Hunks only.
- [ ] Offer `/simplify`, then `/review`, then `/docs` (Send window + the schedule's help text in `lib/help-content/org.tsx` / `house-league.tsx` — both have others' uncommitted edits; hunks only).
- [ ] Update `memory/MEMORY.md`'s pointer only if the owner asks for a memory note.

## 5. Tests that must exist when done (names fixed now)
The matrix in the plan — **head coach, Assistant, Helper, Treasurer** × **late bill, Finalize, changes, review** — asserting, per cell, who receives the email, which variant (money / plain / none), who gets which bell, and that the plain variants contain no `$`, no "Club tab", no "correction", no "owed", no "bill". Plus:
- a team with only an Assistant and a Helper: late bill → unreachable with the true sentence; Finalize → slots sent and `billNotTold` set;
- `corrections: false` → no correction line and no correction bell, but the step's inputs unchanged;
- `unreachableSentence(..., 'only_you', ..., 'bill')` says "Money access"; `head_coach_no_email` fires only when an active head coach exists;
- a **source guard** (house style, in the scheduler guard file): every `notify` / `sendEmail` site that carries `billEmail`, `SCHEDULE_NOTICES.bill`, a bill-bearing review body or `billedCents` takes the Money-filtered audience;
- the coach `club-schedules` route still returns `[]` (GET) and 403 (POST) for a non-head coach — pins the gate the bill's safety currently rests on **[V]**.

## 6. Customer words (admin-facing, Send window only) — copy exactly
- Late bill statement tail: "…and its coaches who can open Money are emailed the bill; replies come to you."
- Review statement: "Each team’s coaches see their slots, and the ones who can open Money see the bill too."
- Unreachable (late bill, sender only): "{Team} has nobody with Money access but you."
- Unreachable (new reason): "{Team} has a head coach with no email address on file."
- Warning under a final / changes team: "Its bill goes on its Money › Club tab; nobody with Money access is emailed about it."
- Window: "{Name} gets it without the bill." (row) and "See the email {Name} gets, without the bill" (door).
Keep the late bill email's "Questions about the bill? Reply to this email" line and "for the time your team got" — unchanged.

## 7. Working rules for this session
- **Shared tree.** Other sessions have uncommitted edits in `lib/club-schedule-words.ts`, `LEGAL_INDEX.md`, `TODO.md` and the help content. Stage explicit hunks or pathspecs only (never `git add -A` / `.`) — the temp-index method is in memory (`reference_partial_commit_shared_tree.md`). After each commit run `git show --stat HEAD` and confirm only your files landed. Re-check `git rev-parse --abbrev-ref HEAD` is `dev` first.
- **Ask before committing**, and never push.
- **Checks.** Focused while building (`npm run verify:changed`, `npm run lint:focused -- <files>`); `npm run typecheck` once before hand-off (shared module + route contract); serial, not parallel. Tell the owner anything skipped.
- **Dev server.** A new file was added: restart `npm run dev` (stop → remove `.next` → start) once at hand-off. Verify `/platform-admin/login` returns 200 and the log has no Supabase `EACCES`.
- **Browser testing is the owner's.** Do not drive a browser. Say which dev club fixture has a team with a head coach plus an Assistant and a Helper (and whether one must be created); offer to write the walk as a checkable Artifact after the build.
- **Disagree out loud.** If a line here contradicts what the code does, say so before changing course.

## 8. Hand-over (what to send the owner)
Product-owner voice: what an Assistant, a head coach and an admin now see; which words were written beyond §6; Q-A and Q-B still open; Q-E still its own item; checks run and skipped; commit hashes; the walk owed.
