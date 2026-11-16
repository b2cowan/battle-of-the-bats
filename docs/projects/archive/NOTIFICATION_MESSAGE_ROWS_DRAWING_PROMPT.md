# Drawing prompt — Notifications that read at a glance (Stage 1)

Paste into a fresh session: **"Run the drawing prompt in docs/projects/active/NOTIFICATION_MESSAGE_ROWS_DRAWING_PROMPT.md"**

---

## Your job

Draw the owner's mockup for turning one-paragraph notification bodies into labelled rows. **Drawing only:
no product code, no commits.** The deliverable is ONE Claude Artifact (an HTML page) the owner opens, reads, and
rules on. Run `/design` on it before you hand it over, and apply what it finds.

## Read first (in this order)

1. `docs/projects/active/NOTIFICATION_MESSAGE_ROWS_PLAN.md` — why, the owner's five rulings of 2026-11-14 (do not
   re-open them), the stages. You are Stage 1.
2. `docs/projects/active/NOTIFICATION_MESSAGE_ROWS_CENSUS.md` — every kind, its exact wording, its facts, where it
   is built. **A lead, not evidence:** open the cited lines for the five kinds you draw and take the wording from
   the code.
3. The reference case, built 2026-11-14 and uncommitted: `components/notifications/NotificationMessage.tsx`
   (`TimeChangeRows`) + `NotificationMessage.module.css` (`.facts` and below), and `lib/league-time-handoff.ts`
   (`TIME_HANDOFF_WORDS.bell`). That is the first cut of the pattern: draw the pattern properly, and show where
   the reference case changes if your drawing improves on it.
4. The frames the message block is drawn in: the bell's drawer (`components/notifications/NotificationDrawer.tsx`,
   the pane beside the list, computer only) and the reader (`components/notifications/NotificationReader.tsx`:
   a small centred dialog on a computer, a sheet on a phone). Also the list row on the Notifications pages
   (`components/notifications/NotificationFeedBody.tsx`). Draw each one from its SHIPPED component and stylesheet,
   not from memory.

The owner's drawing conventions are in the Claude auto-memory (loaded with the session). Follow them, in particular:
mockups are Claude Artifacts (HTML page, never the canvas); the house layout (sticky tabs, an "Everything / Show
only what differs" switch); whole-screen before/after at TRUE SIZE; draw a control from its shipped component;
phone figures are rows, not tiles; every highlight is clickable; the Portal's written rules are the formatting
benchmark; `formatTime` clock spelling ("8:00 a.m."); one spelling per word (`npm run check:spelling` rules). Admin
type rule: labels in sentence case, not the small-capitals eyebrow face (the admin type check rejects the latter).

## What to draw

**Tab 1: the pattern.** One opened notice, anatomy called out: the eyebrow (kind and time), the title, the
labelled rows, an optional list under a row, the next-step line, then the buttons (Open · Done · Close · Delete,
in that order, unchanged). Computer (drawer and dialog) and phone (sheet).

**Tabs 2 to 6: five real kinds, before and after,** in the frame each recipient really sees, with the values from
the census example. On each, show the list row's one-line summary as well (ruling 2):

| Tab | Kind | Who receives it | What the drawing must answer |
|---|---|---|---|
| 2 | `debit_returned` — A bank debit was returned | club owner and admins | the money rows; where "Needs attention" and the settled line sit relative to the rows |
| 3 | `card_disputed` — A card payment was disputed | club owner and admins | a deadline as a row versus a highlighted line; amount held |
| 4 | `club_schedule_league_changes` — The club changed house league's practices | league admins and owners | a list of up to 6 moved games, and what happens past 6 ("and 3 more") |
| 5 | `family_availability_response` — Family answers | coaches (Coaches Portal, warm skin) | a folded list of children and answers plus the headcount, in the coach's portal |
| 6 | `team_coach_game_changed` — A game changed | coach | the smallest few-facts case: does a three-row notice read better than its sentence? If not, say so |

**Tab 7: the open questions, each with options and your recommendation** (the owner rules on these; do not decide
them silently):

- Q1 Label style and width (computer); on a phone, label above the value or beside it.
- Q2 The next step or deadline: a row, a line under the rows, or emphasis.
- Q3 Long lists: how many lines before they fold, and what the fold says.
- Q4 The three kinds that keep their amount or due date in the TITLE (`club_money_received`,
  `club_payment_handed_off`, `team_coach_payment_reminder`): leave it there, move it to a row, or both.
- Q5 "Score submitted" today says only who submitted it: what should it carry (game, score, by whom)?
- Q6 A kind whose senders word it differently (census "Surprises"): show one example and the proposed single wording.
- Q7 Email copy: for each of the five kinds, check in the code whether its email is built from the notification
  body or from its own template, and say what the one-line rule would do to it. If an email's content would change
  materially, flag `/legal` (CASL) as owed before the build.

End with a decision sheet: Q1–Q7, the options, your recommendation, and a box for the owner's answer.

## Don't

- Don't re-open the rulings: scope = all 28; one-line summary for list rows, push and email; draw before build;
  old notices keep their paragraph; the fixes ride along.
- Don't touch product code, hooks, settings or tests; don't commit.
- Don't draw the 53 untouched kinds (one fact, typed text, never sent).

## When you hand off

- Publish the Artifact; give the owner the link and a short plain-language summary (product-owner voice, no file
  names).
- Record the link and "drawn <date>, asks Q1–Q7 owed" in the plan's Status line, the TODO.md line for this
  project, and the auto-memory note `project_notification_message_rows.md`.
- Save the page's HTML source as `docs/projects/active/NOTIFICATION_MESSAGE_ROWS_MOCKUP.html`.
