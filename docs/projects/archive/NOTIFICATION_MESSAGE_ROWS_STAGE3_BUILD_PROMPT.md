# Build prompt — Notifications that read at a glance, Stage 3 (the six list notices)

Paste into a fresh session: **"Run the build prompt in docs/projects/active/NOTIFICATION_MESSAGE_ROWS_STAGE3_BUILD_PROMPT.md"**

---

## Your job

Build Stage 3 of `NOTIFICATION_MESSAGE_ROWS_PLAN.md`: the six notices whose body is a list written inside a sentence.
They open as labelled rows with the list on its own lines (folded at 6), using the shared pattern Stage 2 already built.
**Build to the approved drawing:** https://claude.ai/artifact/4oPRNGetZWQ2ei483Gs2i5 (v2; source
`NOTIFICATION_MESSAGE_ROWS_MOCKUP.html` beside this file). All nine asks were ruled on 2026-11-14 — the plan's
"Drawing rulings" section is binding; do not re-open them.

The six kinds (census group C):

| Kind | What the reader hunts for | Drawn? |
|---|---|---|
| `club_schedule_league_changes` (moved games) | which games moved, from where to where | Yes, tab 4 |
| `family_availability_response` (family answers) | who answered what, and the new head count | Yes, tab 5 |
| `coach_insights_digest` (weekly team insights) | up to three findings, one per line | No |
| `club_hand_back_answered` (accepted / declined, on time and late: four builds) | what came off the bill, per payment; or why it was declined | No |
| `card_refund_whose` (a refund needs you to say whose it was) | which children, the total, the receipt | No |
| `champions_crowned` | which team won which division | No |

## Where things stand (check before you start)

- Stage 2 is committed (`ed417b626`) and its review fixes are committed (`b55793822`), on `dev`. Check `git log -8` and
  `git status` first: if the owner's browser check of Stage 2 produced follow-up changes, build on those.
- **Stage 2 gave you everything below. Use it; don't rebuild it:**
  - `lib/notification-facts.ts`: the stored shape (`metadata.facts`), `factRow`, `noticeFacts`, `capFactList`,
    `readNoticeFacts` (all-or-nothing, never throws), and `FACT_LABELS`, the one vocabulary. Add a new label there only
    when no existing word means the idea; each is at most 11 characters (a test holds it).
  - The message block already draws rows, a list under a row, the fold at 6 ("Show N more …"), at most 30 stored, the
    settled line replacing the next step, and the phone sheet's pinned buttons. **No frame work is owed in Stage 3.**
  - The "one words entry per kind, every sender calls it with facts" pattern, e.g. `refundFailedNotice` in
    `lib/online-payment-words.ts`, and the guard test in `tests/unit/notification-facts.test.ts` that every sender
    passes facts. Extend that guard to the six kinds.
- `lib/league-time-notice.ts` exists so the message block never imports a module that reaches the coach portal's big
  stylesheet. **Keep that boundary:** anything the message block imports stays light.

## Read first (in this order)

1. `NOTIFICATION_MESSAGE_ROWS_PLAN.md` — the rulings, "Stage 2 as built" and "Stage 2 review". You are Stage 3.
2. The drawing, tabs 4 and 5 (and tab 1 for the grammar). Open it, switch Frame to Phone, read the pins.
3. `NOTIFICATION_MESSAGE_ROWS_CENSUS.md` group C and "Surprises". **A lead, not evidence:** open the cited lines. The
   census was wrong once already (family answers), and `champions_crowned` needs data the body doesn't carry today.
4. Stage 2's code, as the model: `lib/online-payment-words.ts` (`refundFailedNotice`, `notRecordedNotice`),
   `lib/club-hand-back-words.ts` (`askFacts`), `lib/league-time-notice.ts` (a list under a row).

## Blocking gate — before any code

1. **`/legal` first (ruling Q7).** The moved-games notice can be emailed. Find which of the six kinds email or push from
   the body, say what each email will read after the change, and run `/legal` (CASL) on any whose content changes
   materially. Apply what it finds, or record it as an owner question in the plan. Stage 2's answer for six club kinds
   is in `docs/agents/legal/CASL_LATE_BILL_EMAIL.md` (last section): not a commercial message; check these the same way.
2. **Product-manager UX summary in the chat** (AGENCY_RULES): what a reader sees differently, per kind, per frame
   (computer reader, bell drawer, phone sheet), per role.
3. **The four undrawn kinds follow the drawn grammar.** If a kind needs a row, a label or a fold the drawing doesn't
   settle, put it to the owner as a question. Don't decide it.

## What to build

For each kind: store its facts, make the stored body the one-line summary (list rows, push and email read it; ruling 2),
and give the kind ONE words entry that every sender calls (ruling 5). A notice sent before this keeps its paragraph
(ruling 4); no back-fill.

- **`club_schedule_league_changes`.** The only kind whose body already has line breaks. The summary sentence becomes
  the one line; the moved games become the list under a row (one game per line: division · day: from → to), folded at 6.
  Counts (practices moved, games moved, games waiting in Changes to send) are rows. Keep "Families hear once you send
  them" as the next-step line. Built at `lib/club-schedule-league-words.ts` and `lib/club-schedule-send.ts`.
- **`family_availability_response`.** Its structured bundle is already stored (`metadata.bundle`), and the same unread
  notice is re-written when more answers fold into it. **The facts must be re-written with it, or an old row will show
  stale rows over a fresh title.** One row per answer or a list of `Child · Answer`, then the head count as a row; a
  single change ("Was Out · a note") and one family answering several events each get their own shape. Closest to the
  house-league reference case.
- **`coach_insights_digest`.** One finding per line (the good-news one first, then warnings). Each coach's notice
  depends on that coach's permissions: the rows must never show a finding the stored body wouldn't have.
- **`club_hand_back_answered`.** Four builds (accepted, declined, each on time and late): one words entry. Accepted: the
  credit, what the club owes back, and one line per payment that dropped ("Feb 1 · $864.00 → $432.00"). **Declined: the
  reason is typed by a person, so it stays a quoted line, unshortened and unreworded.**
- **`card_refund_whose`.** The children are what the reader chooses among (a list); the total and receipt are rows. The
  title keeps the refunded amount and the guardian.
- **`champions_crowned`.** One line per champion with its division. **The division isn't in the body today, so this
  kind needs new data at send:** read it where the notice is built (`lib/champions-notify.ts`), and keep the "no
  champions found" body as it is.

Words are draft copy: tag new labels, one lines and next steps `[marketing]` in the words files, and run
`npm run check:spelling` (clock = `formatTime`, one spelling per word).

## Don't

- Don't touch Stage 4–5 kinds, the 53 untouched kinds, or "A game changed" (ruling Q8: it keeps its sentence).
- Don't change the drawing: 5.5rem label column, labels ≤ 11 characters, fold at 6, at most 30 stored, the settled line
  replacing the next step, phone buttons pinned only when the message outgrows the sheet.
- Don't leave the senders' needs-attention metadata keys or the one-open-copy subject keys changed: the resolvers read them.
- Don't touch hooks, settings or shared automation. Stage explicit pathspecs only; another session's files may be dirty
  in the same tree (Stage 2's commit swept in about 25). Commit on `dev` only when the owner says go; never `master`.

## Verify

- Unit tests: each kind's facts round-trip; a notice without facts keeps its paragraph; every label is in the shared
  vocabulary and at most 11 characters; every sender of a kind produces the same words for the same facts; a list past 30
  closes with "and N more …"; a family answer folded into an existing notice re-writes its facts.
- Run one at a time: the new and touched unit tests (`node --import ./tests/ts-resolver.mjs --test <file>`),
  `npm run verify:changed`, `npm run check:spelling`, `npm run typecheck` (if it runs out of memory:
  `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`).
- **Already failing, not this work's to fix, report them:** `notification-open-in-place-guard` (the admin Notifications
  page reaches `coaches.module.css` through another session's change), `online-payments-card-dispute-screens` (fixture
  dates have passed), ESLint's missing `react-hooks` plugin, and whatever else `verify:changed` shows in files you
  didn't touch (confirm each by name).
- Offer `/simplify` (before `/review`), then `/review`, per CLAUDE.md. Offer `/docs` if a help article quotes one of
  these notices' wording. The owner does the browser checks.

## Hand-off

- PM summary (product-owner voice): what each of the six looks like now, the email check per kind, `/legal`'s outcome.
- Any copy or ruling question for the owner, written into the plan, not decided.
- Update the plan's Status line, the TODO.md line and the auto-memory note `project_notification_message_rows.md` with
  what was built and its commit (or "built, commit owed").
- The dev server must be restarted before the owner's browser check if you added new files or shared modules.
- Next: the owner's browser check of Stage 3, then Stage 4 (the few-facts coach and league notices).
