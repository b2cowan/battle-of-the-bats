# Build prompt — Notifications that read at a glance, Stage 2 (the shared pattern + the money notices)

Paste into a fresh session: **"Run the build prompt in docs/projects/active/NOTIFICATION_MESSAGE_ROWS_STAGE2_BUILD_PROMPT.md"**

---

## Your job

Build Stage 2 of `NOTIFICATION_MESSAGE_ROWS_PLAN.md`: the ONE shared rows pattern every opened notification can wear,
house league's time moved onto it, the phone sheet's pinned buttons (Q9), then the fifteen money notices listed below,
each brought to one wording across its senders. **Build to the approved drawing:**
https://claude.ai/artifact/4oPRNGetZWQ2ei483Gs2i5 (v2; source `NOTIFICATION_MESSAGE_ROWS_MOCKUP.html` beside this file).
All nine asks were ruled on 2026-11-14 — the plan's "Drawing rulings" section is binding; do not re-open them.

## Read first (in this order)

1. `NOTIFICATION_MESSAGE_ROWS_PLAN.md` — Why, the owner's rulings (scope, one-line rule, old notices keep their
   paragraph), the Drawing rulings Q1–Q9, the stages. You are Stage 2.
2. The drawing (tabs 1–3 and 7 are yours; tabs 4–6 are later stages). Open it, switch Frame to Phone, read the pins.
3. `NOTIFICATION_MESSAGE_ROWS_CENSUS.md` group B — every money kind's wording and senders. **A lead, not evidence:**
   open the cited lines; the code is the truth (the census was wrong once already, on family answers).
4. The reference case: `components/notifications/NotificationMessage.tsx` (`TimeChangeRows`) +
   `NotificationMessage.module.css` (`.facts` and below) + `lib/league-time-handoff.ts` (`TIME_HANDOFF_WORDS.bell`,
   `readTimeChangeFacts`). Check with `git log` / `git status` whether it is committed before you start; if it is still
   only in the working tree, it was built 2026-11-14 by an earlier session — build on it, don't redo it.
5. The frames: `NotificationReader.tsx` + `components/coaches/SheetFrame.module.css` (the phone sheet), the drawer
   (`NotificationDrawer.tsx`, `notifications.module.css`), `lib/notify.ts` (`notificationEmailHtml`: the generic email
   prints the body).

## Blocking gate — before any code

1. **Product-manager UX summary in the chat** (AGENCY_RULES): what a reader sees differently, per frame, per role.
2. **Confirm the shared facts shape with the owner only if you must change the drawing.** The drawing is approved;
   anything you would draw differently is a question, not a silent change.
3. **The email check, per kind** (ruling Q7): for each of the fifteen, find whether an email or push is built from its
   body. Today the debit and dispute notices have email off with no setting; confirm each of the others. If any email's
   content changes materially, run `/legal` (CASL) before hand-off and apply or record what it finds.

## What to build

**A · The shared pattern** (one stored-facts shape; one drawing of it)
- A stored-facts shape any kind can fill: label → value rows (a value may be a bold lead plus a quieter detail), an
  optional list under one row, an optional next-step line. Read it back defensively, like `readTimeChangeFacts`
  (a notice without facts — every notice sent before this — keeps its paragraph: ruling 4).
- The message block draws it (the reader and the drawer share the block). Rulings: **Q1** label column 5.5rem, labels
  ≤ 11 characters (add a test over every kind's labels), sentence case, quiet ink, 14px semibold — never the small-caps
  eyebrow face; **on a phone the label stays beside its answer** and a list under a row spans the full width (this
  changes the reference case's `@media (max-width: 480px)` stacking). **Q2** a deadline is a row ("Answer by"); the
  instruction is one line under the rows; once `settled`, the settled line REPLACES the next-step line. **Q3** a list
  shows 6 lines, then "Show N more <noun>" opens the rest in place ("Show fewer <noun>"); store at most 30, past 30 the
  last line reads "and N more …".
- House league's time moves onto the shared shape (its stored facts stay readable — notices already sent with
  `metadata.timeChange` must still draw).

**B · The phone sheet's pinned buttons (Q9)** — on a phone, when the opened message is taller than the sheet, the button
row is pinned at the sheet's foot under a hairline and the message scrolls above it; a message that fits is unchanged.
Both portals' readers. The frame belongs to the Sheet Frame project — change the reader's use of it, not every sheet.

**C · The fifteen money notices** — each stores its facts, its stored body becomes the one-line summary (list rows,
push, email: ruling 2), and every sender of a kind uses ONE wording (ruling 5):
`debit_returned`, `debit_reversed`, `card_disputed`, `card_dispute_lost`, `card_refund_failed`,
`card_refund_still_enrolled`, `online_payment_not_recorded`, `online_payment_over`, `payments_ending`,
`team_money_sent`, `club_bill_arrived`, `club_schedule_review`, `club_payment_not_received`, `club_hand_back_asked`,
`club_hand_back_unasked`.
- Rows and one lines for `debit_returned` and `card_disputed` are drawn (tabs 2–3): build them as drawn, including the
  "Reason" label, the dispute's "Held" row without a second figure, the desk copy's "Who answers" / "Answer by", the
  no-email variant, and the settled states. The other thirteen follow the same grammar; their labels come from one
  shared vocabulary (Amount, Account, Returned, Reason, Paid by, Held, Answer by, For, Sent to …) — one word per idea.
- **Q6** `card_refund_failed`: one words entry; all five senders pass facts only (amount, where it went, who it was for,
  card or bank). Titles keep their two forms (team / child). While there, check sender B (a team's bank send-back
  states the payment's whole `base_amount`): confirm whether that is the refund's amount; fix it if not.
- Words are draft copy: new labels, one lines and next-step lines go past `/marketing` in the words files'
  usual `[marketing]` tags, and through `npm run check:spelling` (clock = `formatTime`).

## Don't

- Don't touch Stage 3–5 kinds (lists, coach/league few-facts, tidy-up, "Score submitted") or the 53 untouched kinds.
- Don't back-fill old notices (ruling 4). Don't add rows to the three title-carries-the-figure kinds (ruling Q4).
- Don't change "A game changed" (ruling Q8: it keeps its sentence).
- Don't touch hooks, settings or shared automation. Commit only with the owner's go, explicit pathspecs, on `dev`.

## Verify

- Unit tests: the facts shape round-trips; a notice without facts keeps its paragraph; the label-length rule; each
  money kind's senders produce identical words for identical facts; the settled line replaces the next step.
- `npm run verify:changed`; `npm run typecheck` (shared modules change).
- Offer `/review` (substantive change) and `/simplify` (a new shared abstraction) per CLAUDE.md; offer `/docs` if a help
  article quotes a notice's wording. The owner does the browser checks.

## Hand-off

- PM summary (product-owner voice), the email-check result per kind, `/legal`'s outcome if it ran.
- Update the plan's Status line, the TODO.md line, and the auto-memory note `project_notification_message_rows.md`
  with what was built and its commit (or "built, commit owed").
