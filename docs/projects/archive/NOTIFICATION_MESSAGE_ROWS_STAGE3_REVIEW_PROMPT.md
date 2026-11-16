# Prompt — Notifications that read at a glance, Stage 3: simplify, review, docs, commit

Paste into a fresh session: **"Run the prompt in docs/projects/active/NOTIFICATION_MESSAGE_ROWS_STAGE3_REVIEW_PROMPT.md"**

---

## Your job

Stage 3 of `NOTIFICATION_MESSAGE_ROWS_PLAN.md` (the six list notices) was built on 2026-11-15 and is **not committed**.
In this order: `/simplify`, then `/review`, then `/docs`, then commit on `dev`. **The owner has said go for the commit**
(2026-11-15), once simplify and review are done and the checks below pass. Never `master`.

Read first: the plan's "Stage 3 as built", "Stage 3 rulings" and "Stage 3 owner questions" sections. **Rulings there are
binding. Do not re-open them.** Do the same for Q1–Q9 ("Drawing rulings"). The approved drawing is
https://claude.ai/artifact/4oPRNGetZWQ2ei483Gs2i5 (tabs 4 and 5).

## The files of this work (and only these)

```
components/notifications/NotificationMessage.tsx
components/notifications/NotificationMessage.module.css
lib/notification-facts.ts
lib/club-schedule-league-words.ts
lib/club-schedule-send.ts
lib/family-availability-words.ts
lib/family-availability-coach-bell.ts
lib/insight-findings.ts
lib/insights-digest.ts
lib/club-hand-back-words.ts
lib/club-hand-back.ts
lib/club-money-notify.ts
lib/online-payment-words.ts
lib/online-payment-landing.ts
lib/champions.ts
lib/champions-notify.ts
tests/unit/notification-facts.test.ts
tests/unit/club-schedule-league-plan.test.ts
tests/unit/family-availability-session3.test.ts
tests/unit/insight-findings.test.ts
docs/projects/active/NOTIFICATION_MESSAGE_ROWS_PLAN.md
docs/projects/active/NOTIFICATION_MESSAGE_ROWS_PM_BRIEF.md
docs/projects/active/NOTIFICATION_MESSAGE_ROWS_STAGE3_BUILD_PROMPT.md   (untracked)
docs/projects/active/NOTIFICATION_MESSAGE_ROWS_STAGE3_REVIEW_PROMPT.md  (this file, untracked)
docs/agents/legal/CASL_LATE_BILL_EMAIL.md        (the last section, "Reviewed 2026-11-15", is this work's)
docs/agents/legal/LEGAL_INDEX.md                 (one row edit: the CASL_LATE_BILL_EMAIL row's 2026-11-15 note)
TODO.md                                          (ONE line: the "Notifications that read at a glance" item)
```

⚠ **The tree is shared.** Another session has many club-schedule / permit / schema-snapshot / ledger files dirty (Several
permits B, mig 488). `TODO.md` and possibly the legal files may also carry another session's edits. Before staging a
shared file, check `git diff <file>`. If it holds foreign hunks, commit only this work's hunks: build a temp index, or
stage the hunks precisely (memory: "Partial commit out of shared files"). `lib/club-schedule-words.ts` is NOT this work's
file (the moved-games words are in `lib/club-schedule-league-words.ts`).

## 1 · `/simplify` (quality only, not bugs)

Look hardest at what Stage 3 added to shared code:
- `lib/notification-facts.ts`: `FactLine` / `factLine` / `factLineText`, `listRow`, `factRow` falling through to
  `listRow` when there is no value, `readNoticeFacts` accepting `value: ''` only with a non-empty list, and `factRow`'s
  `detail` now accepting null. Is `listRow` worth exporting beside `factRow(label, null, { list })`, or is one way enough?
- `NotificationMessage.tsx`: `FactListLines` gained `only` (renders as `<dd>`) and string-or-`FactLine` items.
- Repeats: each kind declares its own fold noun and "and N more …" closer (games, answers, events, findings, payments,
  children, champions). Fine if each sender's words differ; don't invent a registry for its own sake.
- `family-availability-words.ts` `coachBellWords`: the `before()` helper vs the inline "was X" in the events shape.
- `club-hand-back-words.ts` `bellAnswered`: one entry for four builds, as ruled. Keep it ONE entry.
- **Keep:** the light-module boundary (the message block imports only `lib/notification-facts.ts` and other light modules;
  `notification-open-in-place-guard` is already failing for an unrelated chain, so don't let a new one hide behind it),
  every `[marketing]` tag, and every needs-attention / one-open-copy metadata key (`handBackId`, `unassignedRefundId`,
  `stripeRefundId`, `seasonId`, `sendId`, `teamId`, `eventId`, `bundle`).

## 2 · `/review` (the adversarial funnel, `.claude/commands/review.md`)

What would actually break:
- **All-or-nothing reads:** can any of the six senders store `facts` that `readNoticeFacts` rejects, so the notice silently
  falls back to its one line with no paragraph? (E.g. an empty child name, an empty division or champion, a blank receipt,
  an empty eventDay.) A one-line body under a fallback is a lost fact. Check every input each entry can receive.
- **Family answers fold:** both write paths (fold `update` and fresh `notify`) store `facts` built from the SAME bundle
  as the title and body. The dev-only old-vocabulary shim (`withCurrentAnswerWords`) runs before `coachBellWords`.
- **Insights:** rows never show a finding the coach's permissions withheld (same `chosen` list as the body).
- **Hand-back:** a declined reason is quoted exactly (up to 500 characters, never cut); the late-ask builds read right;
  `tellTeamMoneyPeople` puts `facts` in metadata without dropping `teamId` or the caller's metadata; `club_hand_back_lapsed`
  (same helper, no facts) is unchanged.
- **Refund whose:** `raiseOnce` gets `body` and `facts` from the spread; the one-open-copy key is untouched.
- **Champions:** the no-champion body is byte-identical to before and stores no facts; the fans' push still gets
  `headline` (names only).
- **Moved games:** the body no longer has line breaks; the next step appears only when games wait.
- **The message block:** a list-only row renders no empty `<dd>`; the fold and "Show fewer" still work on it; the
  phone sheet's pinned buttons (Q9) still measure correctly.
- Apply real fixes. Record copy or ruling questions in the plan's "Stage 3 owner questions"; don't decide them.

## 3 · `/docs`

`/legal` (2026-11-15) flagged one article: the coaches' help answer "What is the ‘Your week in review’ notification?"
(`lib/help-content/coaches.tsx`, around line 1991). It says the push carries "the top items from Insights". It now leads
with ONE finding and counts the rest; the note opens to all of them. Also check for any help text that quotes the other
five notices' old wording (champions alert, moved games, family answers, hand-back answers, refund whose); the champions
article (~line 1836) describes the alert, not its words, so it likely stands. Keep `keywords` / `searchText` in step
and run `npm run check:spelling`.

## 4 · Verify (one at a time)

- `node --import ./tests/ts-resolver.mjs --test <file>` for each test file above, then any test `/simplify` or `/review`
  touched.
- `npm run check:spelling`, then `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`, then `npm run verify:changed`.
- **Already failing, not this work's** (confirm each by name, report, don't fix): `notification-open-in-place-guard`,
  `online-payments-card-dispute-screens` (fixture dates passed), `support-console-stage4b-inforce-guard`
  (`lib/workspace-upgrade-status.ts`), ESLint's missing `react-hooks` plugin, and ~20 more from other sessions' dirty files
  as of 2026-11-15: possessive-guard (PlayerGuardiansCard), coach-schedule-sheet / -phone / series-date-groups /
  kit-dialog-floor guards, workspace-flip, org-billing-access, plan-billing-usage, plan-reader-door,
  billing-plus-tax-words, account-first-signup, club-accounting-teams, club-stage13a-doors, coach-practice-plans-phone,
  support-console-stage3, team-move-coverage, public-tournament-stage6-walk. A NEW failure in a file of this work is yours.

## 5 · Commit

- `git rev-parse --abbrev-ref HEAD` must be `dev`. Stage explicit pathspecs only (never `git add -A` / `.`).
- One commit, message in product-owner voice, e.g. "Notifications read at a glance, Stage 3: the six list notices open as
  rows (moved games, family answers, weekly insights, the club's hand-back answer, refund whose, champions with their
  division)", plus what simplify and review changed. End with the attribution line the session's system reminder gives.
- `git show --stat HEAD`: only this work's files. Foreign files slipped in → `git reset --soft HEAD~1`, unstage them,
  re-commit. Do not push unless the owner asks.

## Hand-off

- Write the commit hash into the plan's Status line ("Stage 3 committed `<hash>` 2026-11-15"), the TODO line and the
  auto-memory note `project_notification_message_rows.md` (and its MEMORY.md line). Fold a short "Stage 3 review" section
  into the plan, the way Stage 2's was. If those edits come after the commit, make them a small second commit.
- **Restart the dev server before the owner's browser check** (shared modules changed): stop it, `rm -rf .next`,
  `npm run dev` with network access, wait for Ready, check
  `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returns 200. Check first that no other session is
  mid-sweep on it.
- PM summary in product-owner voice: what simplify and review changed for a reader, the help article change, the commit,
  and the open copy questions.
- Next: the owner's browser check of Stages 2 and 3, then Stage 4 (the few-facts coach and league notices).
