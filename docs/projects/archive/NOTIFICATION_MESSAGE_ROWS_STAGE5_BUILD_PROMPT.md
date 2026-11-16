# Build prompt — Notifications that read at a glance, Stage 5 (tidy-up: "Score submitted" and the six never-sent kinds)

Paste into a fresh session: **"Run the build prompt in docs/projects/active/NOTIFICATION_MESSAGE_ROWS_STAGE5_BUILD_PROMPT.md"**

---

## Your job

Stage 5 of `NOTIFICATION_MESSAGE_ROWS_PLAN.md`: the tidy-up. Two pieces of work, and they are different in kind:

**A. "Score submitted" (`score_submitted`) says too little.** Today it says only who entered it ("Submitted by
scorekeeper kim@example.com"); it never says which game or what score (the link opens the game). **Owner ruling Q5 (2026-11-14,
binding): the one line carries the game, the score and who entered it, at the cost of one extra read at send.** The drawing's
grammar and the Stage 2–4 shared pattern (one-line body + `metadata.facts` rows) apply; the plan's "Drawing rulings",
"Owner rulings", "Stage 3 rulings" and "Stage 4 rulings" are binding, do not re-open them. Nothing is drawn for this kind;
use the existing grammar, not a new frame.

**B. The six never-sent kinds** have no sender anywhere (the census, "Dead — no sender found"): `roster_change_requested`,
`score_disputed`, `registration_deadline_approaching`, `waitlist_opened`, `coach_access_requested`, `tryout_offer_response`.
They are kept on purpose in the union, the labels and the category map (`lib/notification-labels.ts` ~262–283 says why and
says reinstating one is one line; `tryout_offer_response` is "do not reinstate"; its label still renders old bell rows).
"Tidy-up" was never defined. **Do not build anything for B until the owner has decided what tidy-up means** (see the order of
work). There is nothing to give rows to: a kind that is never sent has no notice to open.

## Order of work (the project's rules, in this order)

1. **Re-verify, then read.** The census is a lead, not evidence. Re-run the "no sender" search for the six (every call to
   `notify()` and every insert into `notifications`, by key, across `lib`, `app`, `components`, and anything built since
   2026-11-14). Read every sender of `score_submitted` (census: `app/api/scorekeeper/[orgSlug]/score/route.ts`,
   `app/api/admin/games/route.ts` ~1480 and ~1513 with its forfeit variants; also check `app/api/official/[orgSlug]/score/` and
   `lib/champions-notify.ts`, which mention the key), and who receives it (org staff, not the person who entered it). Use a
   helper agent for the sweep; open the cited lines yourself.
2. **Plain-language UX summary (blocking, repo rule), then the owner questions, BEFORE any code.** Ask, with a recommendation
   each (as the Stage 4 prompt's questions were asked):
   - Score: the one line's wording (e.g. "Ridge 12U 6, Hawks 4 · Final · entered by kim@example.com"); the rows (Game · Score ·
     Status · Entered by); what a forfeit says (both variants, the awaiting-approval one is a Needs-attention-style question;
     check whether it is a needs-attention kind); a game with no teams named (a bracket slot); a score entered twice or
     corrected (does a second notice read as an update?). Does the extra read cost a query per score on a busy day? Say how many.
   - Dead kinds: options are (1) leave them exactly as they are (recommended unless the code says otherwise: removing a union
     member is a migration-sized change and old bell rows of `tryout_offer_response` still render), (2) remove the five that
     are "waiting on a trigger" from the union, labels and category map and keep `tryout_offer_response`'s label for old rows,
     or (3) write each one's would-be rows now so a future sender drops in. Recommend one with the reason. Anything that touches
     the schema or the notification kind list is a `/db` question; say so.
3. **Build only what the owner ruled.** Same shape as Stages 3–4: the sender builds `{ title, body, facts }` from ONE entry
   point shared by all its senders; labels come from `FACT_LABELS` (sentence case, at most 11 characters; add only what is
   missing); the body is the one line the list, push and email read; keep every needs-attention and one-open-copy metadata key;
   `lib/notification-facts.ts` imports nothing; a blank part must never void the rows (run every blank input through the notice
   and read it back). Add a Stage 5 block to `tests/unit/notification-facts.test.ts` and a guard that every sender of
   `score_submitted` passes facts.
4. **`/legal` first if anything new is stored about a person** (the submitter's email is already in the body today; a game's
   teams and score are not personal). Per the project rule, run `/legal` before hand-off if the change alters what is stored or
   emailed; say plainly if it does not.

## Out of scope

The 27 kinds already done, the 42 one-fact kinds, the four typed-text kinds, `team_coach_game_changed` and
`family_game_update` (they keep their sentences), the shared frame (5.5rem labels, the phone sheet's pinned buttons). Do not
restyle anything. No back-fill: notices already sent keep their paragraph (owner ruling 4).

## Verify, one at a time

`node --import ./tests/ts-resolver.mjs --test <file>` for `notification-facts`, `club-stage2-server-guard`,
`club-stage2-screens-guard`, and the tests of whatever you touched; `npm run check:spelling`;
`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` (only the untracked `tests/unit/layout-run-journal.test.ts` may
fail); `npm run verify:changed`. As of 2026-11-15 it already fails for reasons that are not this work (the coach-stylesheet
chain, the possessive guard, workspace-flip, practice-plans-phone, the schedule sheet guards, billing-plus-tax-words, the
dispute screens, billing rail, "one door for the plan", Home's waiting workspace, tournament preview, console foot-note,
org_id table check, the Stage 6 owner-walk summary, and the non-test gates); a NEW failure in a file you touched is yours.

## Hand-off

- Offer `/simplify` then `/review` (a new shared entry point is a new abstraction), then `/docs` (any help article quoting the
  score notice's wording; the plan's "For `/docs`" list). Do not commit until the owner says; stage explicit pathspecs only,
  `TODO.md` is shared (commit only the Notifications line's hunk).
- Update the plan (Stage 5 as built, status line), the `TODO.md` line, and the auto-memory note
  `project_notification_message_rows.md` and its `MEMORY.md` line.
- **Dev server:** shared modules changed, so it needs a restart before the owner's browser check; first check no other session is
  mid-sweep (several `next start` servers on ports 3046+, or a `.layout-check-head.mjs` process). If one is, report and ask.
- Next: the owner's browser check of Stages 2–5, then the one walk for the whole project (plan Stage 6) and `/docs`.
