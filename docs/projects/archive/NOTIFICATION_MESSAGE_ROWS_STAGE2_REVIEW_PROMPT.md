# Notifications read at a glance, Stage 2: simplify, review, commit the fixes

**Owner go:** running this prompt is the owner's go to commit the fixes it produces. That covers commits on `dev` only:
explicit pathspecs, never `master`, never a push to `master`.

## Where things stand (checked 2026-11-15)

- Stage 2 is **already committed**: `ed417b626` (2026-11-14), pushed to `origin/dev`, not on `master`.
- That commit also swept in about 25 files from other sessions (attendance, the GST walk, family availability,
  coach-alert registration, help content, the permits plan and others). **Those files are out of scope.** Review and
  simplify only the Stage 2 files listed below, and only their Stage 2 hunks. Use `git show ed417b626 -- <file>` for each.
- Records to correct: the plan's Status line, the TODO.md line and the "Stage 2 as built" section still say
  "commit owed". Change them to "committed `ed417b626` 2026-11-14".

**Stage 2 files**

- **New:** `lib/notification-facts.ts`, `lib/league-time-notice.ts`, `tests/unit/notification-facts.test.ts`
- **The message block:** `components/notifications/NotificationMessage.tsx`, its `.module.css`, `NotificationReader.tsx`
- **House league:** `lib/league-time-handoff.ts`, `lib/league-time-handoff-server.ts`
- **Money:** `lib/online-payment-words.ts`, `lib/online-payment-landing.ts`, `lib/online-payment-endings.ts`,
  `lib/online-payment-owner-notices.ts`
- **Club:** `lib/club-money-notify.ts`, `lib/club-money-words.ts`, `lib/club-schedule-words.ts`,
  `lib/club-schedule-money-audience.ts`, `lib/club-schedule-send.ts`, `lib/families-words.ts`, `lib/families-payment.ts`,
  `lib/club-hand-back-words.ts`, `lib/club-hand-back.ts`
- **Tests updated:** `club-stage13d-time-handoff`, `online-payments-12c-review-fixes`, `online-payments-card-dispute`,
  `online-payments-paid-twice`, `club-hand-back-change-guard`, `bank-debit-desk`, `sheet-frame-guard`

Plan of record: `NOTIFICATION_MESSAGE_ROWS_PLAN.md`, "Stage 2 as built" section. The binding rulings Q1–Q9 are in that
plan. **Do not change the drawing** (5.5rem label column, labels ≤ 11 characters, fold at 6, at most 30 stored, the next
step replaced by the settled line, and phone buttons pinned only when the message is taller than the sheet).

## 1. `/simplify` on the Stage 2 diff

Things worth a hard look:

- **The words layer.** `lib/online-payment-words.ts` grew helpers: `asSentence`, `railWord`, `railTarget`,
  `receiptLead`, `amountRow`, `bookRow`, `owesAgainRow`, `toldRow`, `tellYourself`. Are any duplicates of each other or
  of existing money formatters? Are any used only once?
- **Two shapes for one notice.** `endingBell` sits beside `endingNotice` in `lib/online-payment-endings.ts`. It is kept
  apart on purpose, because the Payouts card reads `endingNotice`. Check that the split is still the simplest one.
- **The light module.** `lib/league-time-notice.ts` exists so the message block doesn't import the module that reaches
  the coach portal's large stylesheet. Keep that boundary.
- **Pinning.** `useOutgrows` in `NotificationReader.tsx`, and the `pinActions` prop.

Leave alone:

- the shared sheet frame;
- the senders' needs-attention metadata keys (the resolvers read them);
- the one-open-copy subject keys.

## 2. `/review` on the result

Run it after `/simplify`. Spend the adversarial effort on these:

- **`readNoticeFacts` is all-or-nothing.** A malformed `metadata.facts` must fall back to the body, never throw. A
  notice stored with the old `metadata.timeChange` must still draw as rows.
- **The `card_refund_failed` amounts** in `raiseSendBackFailed` and `teamRefundFailedWords`. The refund row's amount
  wins when it exists. Otherwise it is base plus fee only when the fee goes back and the family paid it. "Couldn’t be
  sent" must never say "came back".
- **`debit_reversed` for a team** must say "team".
- **Every one of the fifteen kinds** writes `facts`, and each kind has ONE words entry that all its senders call.
- **Pinning on a phone:** no flicker loop. The pinned row takes the same room as the unpinned one. Nothing changes on a
  computer.
- **Six club kinds can email** (the generic email prints the body). Bodies stay one line and must not lose the one fact
  the email reader needs.

Fix what is real. Record anything that needs an owner call as a question in the plan; don't decide it.

## 3. Verify

Run all of these, one at a time:

- the unit tests that touch these files (`node --import ./tests/ts-resolver.mjs --test <file>`);
- `npm run verify:changed`;
- `npm run check:spelling`;
- `npm run typecheck` (if it runs out of memory: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`).

These failures were already there and are **not this work's to fix**. Report them, don't touch them:

- `notification-open-in-place-guard`: the admin Notifications page reaches `coaches.module.css` through
  PlaceFrame → AdminBarPlace → admin-kit-nav → league-time (another session's change, committed since 11-12);
- `online-payments-card-dispute-screens`: its fixture dates have passed;
- ESLint's missing `react-hooks` plugin.

## 4. Commit

1. Confirm the branch is `dev` (`git rev-parse --abbrev-ref HEAD`).
2. Stage explicit pathspecs only: the Stage 2 files you changed, plus the plan and TODO.md truth-up. Never use
   `git add -A` or `git add .`.
3. If another session has uncommitted edits in one of these files, commit only your hunks (temp index), or stop and say
   so.
4. Commit with a one-line message that says what behaviour changed (e.g. "Notifications Stage 2 review: …"). End it with
   the attribution line the session gives you.
5. Run `git show --stat HEAD` and confirm only your files landed.
6. Push `dev` only if the owner's standing practice for `dev` allows it. Otherwise leave it local and say so.

Don't touch:

- hooks, settings or shared automation;
- Stage 3–5 kinds;
- "A game changed";
- `master`.

## Hand-off

Write it in product-owner voice:

- what `/simplify` changed (or "nothing worth changing");
- what `/review` found and fixed, and anything left as an owner question;
- the verify results, with the existing failures named as existing;
- the new commit hash.

Then update the memory note `project_notification_message_rows.md` and its `MEMORY.md` line, if anything changed. Then
the next step: the owner's browser check of Stage 2, then Stage 3. The dev server must be restarted before that browser
check (Stage 2 added new shared files).
