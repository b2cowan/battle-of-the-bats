# Families say if they're coming (Stage 4b) — the answer record, the reminder email, the coach bell
**Last verified:** 2026-11-13 (words and sender read in code; migs 476, 477, 480, 482 read in full; CASL text NOT re-fetched — the 2026-11-06 reading in
`CASL_SECOND_PARENT_EMAIL.md` is relied on; PIPEDA clauses 4.3 / 4.5 / 4.7 cited from the principles, text not re-fetched this session)
**Re-verify by:** the migrations reach production; the guardian tier goes on for real families; the reminder gains any offer, price, link or sign-up
line; house-league answers ship (ask 4); Bill C-36; first Québec customer
**Depends on facts:** `LEGAL_FACTS.md` § two privacy roles (FieldLogicHQ = service provider for the club's records) and § consent and email
mechanics; `drafts/GUARDIAN_CONSENT_STAGE4.md`; the build prompt `docs/projects/active/SIGNED_IN_FAMILY_STAGE4B_BUILD_PROMPT.md` (rulings 1–15, O1–O4,
Progress block, Session 4 rulings)

## Question(s) this answers
1. Is anything in the rendered words, the reminder email or the bell a legal problem (CASL, PIPEDA), read against the drawing's tab 9?
2. What does the guardian consent need now, and does `GUARDIAN_CONSENT_VERSION` move?
3. What retention can the policy publish, and is each part of it true of the migrations?
4. Does the Stage 3b Stop line still read true for a second parent who has joined?
5. Two owner calls from the review: no per-parent cap on Remind; a removed coach keeps bell lines.

## Finding
**The reminder.** An email to a connected parent's own account address, saying an event is coming and the coach asked whether the player is coming.
No offer, price, plan or sign-up link: on its face not a commercial electronic message (CASL s.1(2)), so consent is not the question; it still carries
the club's unsubscribe and the sender's identity because it goes through the one family door. The privacy basis is the parent's own join box ("email me
about {child}'s team"). Built the careful way: the account's address (never the typed or invited one), no answer link or token, no address in a link,
a failed unsubscribe-list read stops the send. **No legal problem; the words ship as built.**

**The answer is a record about a child that a parent writes.** The owner ruled (ask 5) that the join tick-box is enough. It holds because the write is
re-derived from the signed-in account on every save, the note is one line of 200 characters, and no family sees another's. The residual risk is the
free-text note (health or family detail despite a request) — mitigated by the request in the hint, the 30-day clean-up, the bell never carrying the
words, and the coach side being limited to the `attendance` capability. A lawyer's question, not a blocker (listed in the guardian draft).

**The one required wording fix:** the sheet's hint tells a parent who the other parent is and what the other parent sees, but not that **their own**
first name and the day go with the answer — and a parent who already had an account is never asked for a name (the O2 box is new-account only), so the
hint is the only notice that the name they already gave is now shown.

**Retention (verified below):** publishable now that the purge exists. The hint and §9 may promise only what the migrations do; the bell lines are the
one place that is not covered (finding below).

## What the product does today
**The sheet's hint** — `lib/family-availability-words.ts:69-75`, rendered under the note box on every open of the sheet
(`app/(consumer)/family/teams/[teamId]/FamilyAnswers.tsx:263`): coaches see answer and note; the other connected parent (named, or "The other parent")
sees the answer, not the note; other families neither; a health-details request. It does not say the coaches see your first name and the day (they do:
`CoachFamilyLine.by/day`, `:106-118`), nor that the other parent sees your first name and the day (`otherAnswered`, `:77-78`), nor how long a note
stays.

**The O2 box** — `lib/family-invitation-words.ts:51-53`, `ClaimClient.tsx:277-282`: asked only on the new-account path when the sign-up holds no name;
hint "Your child's coaches and the other parent see it beside your answers." Name read from `user_metadata.first_name`, else the first word of
`full_name` / `display_name`, else "the other parent" / "a parent" (`lib/family-availability-rules.ts:64-69`); never from the email. The hint is not
part of `guardianConsentText` (`lib/family-guardian-consent.ts:91-105`), which stores the box words under `GUARDIAN_CONSENT_VERSION` (`:21`, v0.1).

**The reminder** — `lib/family-availability-remind.ts`: recipients are verified links **with an account** of players with no family answer and no coach
mark (`:85-133`); the address is `auth.admin.getUserById(...).email` (`:128-131`), never `invited_email`; `getFamilySuppressionList` fails closed
(`:126`); each email goes through `sendFamilyEmail` (`:255`) with `content.cta.href` = the signed-in team page (`:167, 266`) and `reason` =
"you're connected to {child}'s team in the app" (`family-availability-words.ts:245-246`); a parent on the club's list gets the in-app note only
(`:252`); the 24-hour claim is a database function (mig 476 `:119-137`); the bell goes after the emails and is given back when all emails fail
(`:281-293`). Subject names team, event and day, never the child (`:235-236`).

**The coach bell** — `lib/family-availability-coach-bell.ts`; words `family-availability-words.ts:297-347`: child first name, parent first name, the
answer, "left a note" (never its words); stored in `notifications.metadata` and updated in place when bundled (`:119-155`).

**The migrations (read in full 2026-11-13):**
- 476 `:147-191` `event_availability_purge()`: notes nulled when `greatest(starts_at, coalesce(ends_at, starts_at)) < now() - 30 days`; answers deleted
  when the season's last event (latest start or end of **any** event of that team-year, cancelled ones included) is over 60 days past, closed or not;
  answers whose event is gone; the Remind log by the same rule. Never touches `rep_team_event_attendance`.
- 477 `:16-19`: `cron.schedule('family-answers-purge', '35 8 * * *', ...)` — nightly, 08:35 GMT.
- 480 `:29-35` a new org day (America/Toronto) deletes the event's answers and Remind log; `:47-72` a verified link with an account that ends
  (status leaves verified, account cleared, or row deleted) nulls that account's notes on that child — not when `ended_by = 'merged'`, not while the
  same account still holds another verified link to the child; `:75-88` an answering account that is deleted loses its note (the FK
  `answered_by_user_id ... on delete set null`, 476 `:52`).
- 482 `:68-78` a child join re-points the absorbed child's answers to the kept child (the newer `answered_at` wins a clash on the same event).
- Not checked: the dev database itself. The build record says migs 476/477/480/482 are on dev and the SQL fixtures passed (10/10, 11/11); I did not query
  `cron.job` or the answer table, so "the purge has run on dev" is the build record's statement, not mine.

## Recommendation
**1. Words (product), in the order I would do them:**
- `sheet.privacy` (`lib/family-availability-words.ts:69-75`), current → proposed:
  "Your team’s coaches see your answer and note." → "Your team’s coaches see your answer, your note, your first name and the day you answered."
  "{Priya}, {Ava}’s other parent, sees the answer but not your note." → "{Priya}, {Ava}’s other parent, sees your answer and first name, but not your note."
  fallback "The other parent sees the answer but not your note." → "The other parent sees your answer and first name, but not your note."
  "Other families see neither." → "Other families see none of it."
  new, **ship only when the purge is on production:** "Notes are deleted 30 days after the event."
  (the health line stays last.)
- Leave and Stop confirms, `lib/family-home-words.ts:120, 122, 185`: append "Any notes you added to {child}'s answers are deleted; your answers stay in
  the team's record until the season is over." — true of mig 480 plus the 60-day rule; "until the season is over" is the lay wording of "60 days after
  the season's last event" and does not overstate. Recommended before real families.
- The accept page's 0.2 lines and the version: `drafts/GUARDIAN_CONSENT_STAGE4.md` "(a) 0.2" and answer 5 of its closeout read.
- O2 hint: no change required. Optional: add "if your team asks families to say whether they're coming" after "answers", because the hint speaks of
  answers before the box words do; the 0.2 lines make that unnecessary.
- Reminder words (`FAMILY_REMINDER_WORDS`): no change. Coach confirm (`FAMILY_REMIND_COACH_WORDS`): no change.

**2. The Stage 3b Stop line for a second parent who has since joined** (`lib/league-second-parent.ts:60`, "A parent added your email to this sign-up.
Don’t want these?"; `addedYou` `:67-78`). With O1 re-ruled (reminder only; the Stop line stays on every second-parent copy) it **still reads true**: a
parent did add the address, and the line is a statement of origin, not of status. The soft spot is the question "Don't want these?" next to a button
that, for a joined parent, also removes them from the app — but the confirm page they land on says so before anything is written
(`family-home-words.ts:185`), and nothing is stopped by a footer click. So no word change; I do not recommend a joined-parent variant, because it would
need every second-parent sender to read join state, which is the cost the owner already declined. Two consequences to carry: the reminder itself carries
**no** Stop line and no "a parent added your email" (it goes to the account's own address), so CASL memo flags (d) and (e) are untouched by it; and the
sign-up copies that still go to the same address keep their two footnotes (flag (e) stays open — the drawing's "ask 14 closes e" no longer holds).

**3. Weighing in on the two /review owner calls**
- **(a) No per-parent daily cap on Remind.** Not a CASL or PIPEDA defect (one email per event per 24 hours; the coach is trusted staff; no commercial
  content). The real cost is on the parent's consent relationship: a parent who gets one email for each of a dozen events in one sitting has one
  available way to stop it, the club's unsubscribe, which silences **every** club family email, not only reminders. I recommend a cap: **one reminder
  email per parent per day**; further events that day go as the in-app note only, which the confirm already has a state for ("app note only"). An owner
  call on effort; not a blocker for the tier, and I would build it before the first real family.
- **(b) A removed coach keeps bell lines naming a child, a parent's first name and the answer.** Low sensitivity (first names, an answer, no note
  words, no surname, no health), and the same posture as every notification kind: `app/api/notifications/route.ts:55-96` reads by user and bell scope
  only, not by current membership. I would **accept for 4b and fix at the root, not per kind**: one rule that a member's removal hides or deletes that
  org's bell lines (a `/plan` item). The privacy draft records it as product finding 11, with the bell lines' lack of any retention clock.

**4. Open for the owner (none blocks the walk):** the cap above; the Leave/Stop sentence; whether bell lines of this kind get a clock (finding 11).

## Sources
- `docs/projects/active/SIGNED_IN_FAMILY_STAGE4B_BUILD_PROMPT.md` lines 12–67, 83–104, 339–357, 375–722 — read 2026-11-13
- `docs/projects/active/SIGNED_IN_FAMILY_STAGE4B_DRAWINGS.html` tab 9 (lines 762–811) — read 2026-11-13
- Migrations `supabase/migrations/476_*.sql`, `477_*.sql`, `480_*.sql`, `482_*.sql` — read 2026-11-13
- [Canada's Anti-Spam Legislation s.1(2), s.6](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html) — read 2026-11-06 (in `CASL_SECOND_PARENT_EMAIL.md`); not re-fetched
- PIPEDA Schedule 1, clauses 4.3, 4.5, 4.7 — principles cited, not re-fetched this session

## Lawyer's eye needed?
Yes, owner decides when, for: (1) whether a free-text note about a child is acceptable on a tick-box consent, including a Québec child under 14;
(2) whether 30 days (notes) and 60 days after the season's last event (answers) meet "retain only as long as needed" (PIPEDA 4.5), given the periods are
the owner's choice; (3) whether a leaving parent's first name staying beside their answers until then sits with withdrawal of consent (4.3.8);
(4) the not-a-CEM reading of the reminder (the same open question the second-parent memo records). None blocks the dev walk.
