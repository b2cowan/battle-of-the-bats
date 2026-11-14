# Notifications that read at a glance — labelled rows instead of one paragraph

**Status:** census done 2026-11-14; scope and the one-line rule RULED by the owner 2026-11-14; **Stage 1 drawn
2026-11-14; Q1–Q9 RULED 2026-11-14 (all as recommended, see "Drawing rulings" below); Stage 2 build prompt written
(`NOTIFICATION_MESSAGE_ROWS_STAGE2_BUILD_PROMPT.md`)** — https://claude.ai/artifact/4oPRNGetZWQ2ei483Gs2i5 (v2, `/design` applied; source
`NOTIFICATION_MESSAGE_ROWS_MOCKUP.html`). Q1–Q7 as the drawing prompt asked; Q8 = "A game changed" keeps its sentence
(tab 6's verdict); Q9 = the phone sheet's buttons when a notice outgrows it (moved games measured 131px below the first
view). `/legal` owed before Stage 3 for the moved-games email (Q7). Nothing built beyond the reference case below.
PM brief: `NOTIFICATION_MESSAGE_ROWS_PM_BRIEF.md`.
Census (every kind, its real wording, its group, where it is built): `NOTIFICATION_MESSAGE_ROWS_CENSUS.md`.

## Why

An opened notification shows its body as one paragraph. For many kinds that paragraph strings together a
person, an amount, a date, a place and a next step, or a whole list ("Sat · 11:00 a.m.–12:00 p.m. · Diamond A;
Sat · 12:00–1:00 p.m. · Diamond B, Mar 13 – Apr 3"), so the one fact the reader wants has to be dug out of a
sentence. Found by the owner on "The club gave house league time" (2026-11-14); he asked for a review of every
kind rather than fixing them one at a time.

## The reference case (built 2026-11-14, committed `50622af4e` 2026-11-14)

`house_league_time_given`: the notification stores its facts (`metadata.timeChange`); the opened message — the
reader and the bell's drawer, which share one block — draws them as labelled rows (Season · Schedule · Gives /
Takes back with hours and dates, each slot on its own line), then the next step. The stored body became a
one-line summary, which is what list rows, push and email read. A notice sent before the change keeps its
paragraph. Built bespoke for that one kind; Stage 2 turns it into the shared pattern.

## The census (2026-11-14, 81 kinds)

| Group | Kinds | Treatment |
|---|---|---|
| Done | 1 | the reference case |
| C — a list inside the sentence | 6 | rows + a list |
| B — three or more separate facts | 22 | rows (about 15 are club/owner money notices) |
| X — text a person typed | 4 | untouched, always |
| A — one fact | 42 | untouched |
| Never sent | 6 | tidy-up |

Also found: several kinds are worded differently depending on which code path sends them (e.g. "A refund didn't
reach the card" from five places, "Payment received" from four); three kinds keep their amount or due date in the
TITLE (money received, a payment handed off, a coach's payment reminder); "Score submitted" says only who
submitted it; "Family answers" already stores its facts.

## Owner rulings (2026-11-14)

1. **Scope = all 28** (the 6 list kinds and the 22 few-facts kinds), through ONE shared pattern — not one kind at a time.
2. **The one-line rule:** for each of the 28, the list rows, push and email copy carry a one-line summary; the
   detail lives in the opened message.
3. **Draw it before building** (it is the shared block every notification wears).
4. **Notices already sent keep their paragraph** (pre-customer; no back-fill).
5. **Fix along the way:** one wording per kind across all its senders; the amount-in-title question; the thin "Score submitted".

## Drawing rulings (2026-11-14, owner paste-back: "Yes, as recommended" on each)

- **Q1** Label width on a computer: A, 5.5rem fixed, labels at most 11 characters. On a phone: A, the label beside its
  answer (lists run the full width). This changes the house-league time reference case, which stacks below 480px.
- **Q2** Next step / deadline: A, a deadline is a row; the instruction is one line under the rows; the settled line
  replaces that line once handled.
- **Q3** Long lists: B, fold at 6 ("Show N more …" opens the rest in place; keep up to 30).
- **Q4** Amount in the title (money received, payment handed off, payment reminder): A, leave it in the title.
- **Q5** "Score submitted": A, the one line carries game, score and who entered it (one extra read at send).
- **Q6** "A refund didn't reach the card": one wording, the senders pass facts; titles keep team / child.
- **Q7** Email copy: run `/legal` before Stage 3 (the moved-games email); Stage 2 checks each kind's email.
- **Q8** "A game changed": A, keep the sentence.
- **Q9** The phone sheet's buttons when a notice outgrows it: A, pin the button row at the sheet's foot, only when the
  message scrolls (ruled 2026-11-14, after the paste-back). A change to the reader's frame for every kind, both portals.

## Stages (sequenced by dependency)

1. **Drawing** — one Claude Artifact, before/after at true size, reader on a computer and the phone sheet, five
   real kinds (a money notice, a dispute with a deadline, the moved-games list, family answers, a moved game);
   /design before hand-off. Asks to settle there: the label style, where the next step / deadline sits, how a
   list longer than ~6 lines folds, the amount-in-title kinds, and what "Score submitted" should carry.
2. **The shared pattern + the money group** — one stored-facts shape any kind can fill (label → value rows, an
   optional list, an optional next step), drawn by the shared message block; house league's time moves onto it.
   Then the ~15 money kinds, each kind's senders brought to one wording in the same unit of work.
3. **The list kinds (C)** — family answers (facts already stored), moved games, insights digest, hand-back
   answered, refund whose; champions crowned needs each champion's division, which the body does not carry today.
4. **The remaining few-facts kinds (B)** — coach and league notices (game moved, practice plan, registration,
   withdrawal request, assistant-coach approval, season started, team money sent).
5. **Tidy-up** — the six never-sent kinds; "Score submitted".
6. **One walk** for the whole change, then `/docs` for any help article that quotes a notification's wording.

## Watch items

- **Email copy.** Before shortening a kind's body, check whether its email is built from that body or from its
  own template: an email built from the body would lose its detail (then the email keeps the long form, or gets
  the rows). If any email's content changes materially, run `/legal` (CASL) before hand-off.
- **Needs-attention notices** (most money kinds) carry their own buttons and the settled line; the rows sit
  above both.
- **Bundles** (several notices of one kind on one day) open as a list of members; each member keeps its one-line
  summary — rows are for a single opened notice.
