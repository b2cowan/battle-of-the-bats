# Legal prompt — Notifications that read at a glance, Stage 4: the built notices against the `/legal` proposal

Paste into a fresh session: **"Run the prompt in docs/projects/active/NOTIFICATION_MESSAGE_ROWS_STAGE4_LEGAL_PROMPT.md"**

---

## Your job

Run `/legal`. Stage 4 of `NOTIFICATION_MESSAGE_ROWS_PLAN.md` is committed (`3902fc9e5`, hash note `a12c7917c`, 2026-11-15). `/legal`
reviewed the PROPOSAL on 2026-11-15 ("Stage 4 proposal" in `docs/agents/legal/CASL_LATE_BILL_EMAIL.md`); the project rule is that a
change which alters what the product stores about people or emails them gets a `/legal` review of **what was built**, before it is
treated as handed off. This is that review. Read `LEGAL_INDEX.md` first; re-research only a stale topic.

Do not change product code. A finding that needs product work is an owner question or goes to `/plan`. Edit only the legal
files named below. Do not commit unless the owner says so.

## What to check, against the built code (open the lines; the plan is a lead, not evidence)

1. **The withdrawal note (owner Q4, `/legal`'s own recommendation).** The family's note is now stored IN FULL in the notice's
   stored rows (`metadata.facts`), and kept out of the one-line body (so out of the push and the email). Confirm in
   `lib/house-league-money-words.ts` (`ASK_WORDS.notice`) and the withdraw-request route that the note appears in no
   body, title or push/email path. Then do the owed edit: **privacy draft retention finding 11**
   (`docs/agents/legal/drafts/PRIVACY_POLICY.md`, ~line 562) must name the withdrawal note as kept in full on the stored notice,
   with no retention clock (a settled notice stays; there is no deletion job). Say what a retention rule would need; do not invent one.
2. **The registration audience (Q2).** Both senders (`app/api/league/[orgSlug]/[seasonSlug]/register/route.ts`, the admin's
   `.../house-league/seasons/[seasonId]/registrations/route.ts`) now go to `houseLeagueDeskUserIds` only. Confirm the children's
   and guardian's names are no longer sent to members with no house-league access, and that an empty desk sends nothing.
3. **The assistant-coach approval (Q5).** The invitee's email address is in the line AND in an Invited row, and is stored in the
   notice. Confirm the privacy draft §6 (push service row, reworded 2026-11-15) is true of what the push now carries (a person, a
   child or a team can be named in the alert text). Check no other policy sentence still says a push carries "no name or email".
4. **The practice plan and the season-started notice.** New stored rows: a person's stations; the team's roster count, budget,
   fee plan, opening balance, last season's name, tryouts' state. Is any of it personal information about a child? Does it
   join finding 11's class? Does the push for either carry anything new?
5. **CASL.** Stage 4's proposal found CASL not owed on any of the six. Confirm that still holds for what shipped: the push and the
   email print the body, and no body gained a promotional or marketing sentence. (`[marketing]` tags are copy, not a CASL class.)
6. **Finding 11 as a whole.** Re-read it: with Stages 2–4 the stored rows now hold names, a note, an address, amounts and dates
   for ~27 kinds. Is the wording of finding 11 and its remedy still honest? Tighten it; do not soften it.

## Record

- A short "Reviewed 2026-11-15 — Stage 4 as built" section in `docs/agents/legal/CASL_LATE_BILL_EMAIL.md` (the file the
  proposal section lives in), and the one-line pointer in `docs/agents/legal/LEGAL_INDEX.md`.
- The finding 11 edit in `docs/agents/legal/drafts/PRIVACY_POLICY.md`.
- Anything that needs the owner: a plain question, a recommendation, and what happens if he says no.

## Hand-off

Product-owner voice: what was true, what changed in the draft, what (if anything) the owner decides. Say plainly whether a
lawyer should look at any of it (the owner decides when; no gate). Next: Stage 5, `NOTIFICATION_MESSAGE_ROWS_STAGE5_BUILD_PROMPT.md`.
