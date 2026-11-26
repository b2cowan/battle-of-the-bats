# Club Website Stage 2, "Close a place" — CASL and privacy read BEFORE the drawing
**Last verified:** 2026-11-25 (from the code and the earlier CASL topic files; the statute text was NOT re-fetched today: ss.1(2), 6(1), 6(2), 6(6) and SOR/2013-221 s.3(a) were read 2026-11-16 for `CASL_COACH_GROUP_EMAIL.md` and `CASL_LATE_BILL_EMAIL.md`)
**Re-verify by:** the build prompt; any email here gains a link, an offer or free text; Bill C-36; first Québec club
**Depends on facts:** `LEGAL_FACTS.md` two privacy roles (the club's service provider); Resend in the subprocessor list

## Question(s) this answers
One act closes a club place: house league games postponed (family service emails as the Rainout does), rep games marked and the rep head coach emailed, tournament games handed to that tournament's Rain delay (no email), a public "closed" strip.

## Finding
1. **Family emails: same ground.** The Rainout's send runs `sendChangesAndTell` per division (`lib/league-rainout-send.ts:29`), which mails through `sendFamilyServiceBatch` (`lib/league-schedule-mail.ts:316`). That sender reads no suppression list and puts no unsubscribe link in the html (`lib/family-email.ts:270-277`); the envelope says why it arrived ("your family is registered in {season}", `lib/families-words.ts:491`, used at `league-schedule-mail.ts:303`). Privacy §12 (`lib/legal-documents/privacy/2026-11-24.md:326-328`) says schedule changes for your team are sent regardless. A closure-driven send changes nothing in that ground if it calls the SAME path. A new sender, or the club-news sender, would not be on it.
2. **Rep coach email: most likely not a CEM at all (s.1(2))**, the position taken for the coach group email and the late bill. NOT "transactional so no unsubscribe": s.6(6) lifts consent only, never the unsubscribe or identification of a CEM. Fallback exit SOR/2013-221 s.3(a)(i), never the design basis. Privacy §12 (`:328-330`) already promises exactly this shape for club-to-coach mail: no unsubscribe, says who sent it and why, reply to be taken off. It holds only while the email has no link, offer, price or promotional foot.
3. **The existing club-to-coach send is the weaker model.** `club-schedule-send.ts:1194` sends kind `club_schedule_coach` with Reply-To the admin and no `fromName`, so the sender line is the bare platform name (`lib/email.ts:36-37`). The group email's settled shape ("{Club} via FieldLogicHQ", `familySenderName`) names the club in the sender line.
4. **Public strip, coach mark, tournament hand-off:** no new data kind. The strip names a place and a state, which is inside Privacy "publish its schedules" (`:159-160`) and the "never shown on public pages" line (`:221`, children's information). The hand-off adds no email, so no CASL question. Risk is only a free-text reason reaching the public page.
5. **Several seasons at once:** no new legal ground; the family email stays per season/division as today, never counted toward a cap. The risk is accuracy, not law: place matching is weak (plan Stage 2 Part 1 item 1), so a wrong match tells a family a game is off when it is not.

## What the product does today
Nothing built. Code facts above are read from the files cited.

## Recommendation
- Family emails: reuse the Rainout path; no new sender; a preview of games and families before Send.
- Coach email: house mail, From "{Club} via FieldLogicHQ", Reply-To the admin who pressed it, no link at all (the game is on their team page, so none is needed), fixed words, no free text, reason line, removal line.
- Public strip: place and fixed words only; no reason, no person.
- No help or marketing line may say tournament or rep families "are emailed" (they are not).

## Owner calls (asked in the reply)
1. Coach email sender: A, "{Club} via FieldLogicHQ" with the admin's Reply-To.
2. Coach email body: A, fixed words, no admin free text.
3. Public strip: A, no reason text.
4. Send preview with counts and an unmatched-games list before families are emailed: A.

## Sources
- `CASL_COACH_GROUP_EMAIL.md`, `CASL_LATE_BILL_EMAIL.md`, `CASL_SECOND_PARENT_EMAIL.md` (reasoning reused, statute not re-fetched today)

## Lawyer's eye needed?
No for the design as drawn. Same two narrow points as the coach group email (representatives, an unlinked brand foot).

## Shipped words, Session 2B (2026-11-25, read from the code; statute not re-fetched)
Read: `lib/place-closure-mail-words.ts`, `lib/place-closure-mail.ts`, `lib/email-kinds.ts:109`, `tests/unit/place-closure-window.test.ts` (K10 block), `lib/place-closure-window-server.ts:150-211`.

**Holds, with one defect.**
- Skeleton held: From "{Club} via FieldLogicHQ" (`MAIL.from`), who sent it with role and club, reason line from the person's own seat, reply line, removal line, plain-text foot. No anchor is written anywhere, every word is escaped, the test pins no link and no unsubscribe, and there is no admin free text (the press takes none). Privacy §12 (club-to-coach mail: no unsubscribe, says who and why, reply to be taken off) is kept exactly.
- "No head coach" line, "You get it because you coach {Team} and it has no head coach on file.": acceptable. It is true (the others are head_coach-excluded active staff, i.e. assistants), and it states the real reason. One email per person, only to those with an address.
- Families: unchanged. `sendAfterPress` calls `sendRainout` (`place-closure-window-server.ts:177`), which runs `sendChangesAndTell` then `sendFamilyServiceBatch` (`league-rainout-send.ts:29`, `league-schedule-mail.ts:316`). No new family sender.
- K16: `previewSentences` and `CLOSE_WORDS` carry place names and days only; no free-text field exists in the press.

**Defect, nameless sender.** When the pressing admin has no display name, `renderCoachClosureEmail` falls to club mode (`place-closure-mail-words.ts:79`) and the email says "Reply to this email to reach {Club}", but the Reply-To is that admin's own address (`place-closure-mail.ts:41`). The line promises the club; the reply goes to one person who is not named. Also, with no admin address the reply goes to the platform sender and the line is false. The group email blocks this (`SAY.needName`, `SAY.noSenderAddress`); the press does not.
- Fix A (preferred): refuse the press's coach email path with the group email's `SAY.needName` / `SAY.noSenderAddress` wording before any send.
- Fix B (words): in the nameless case use "Reply to this email to reach the {ROLE_EMAIL_LABEL[role]} at {Club} who sent it." and "Not right for you? Reply and tell them."; send no reply line when there is no address.
- Test gap: the K10 block never renders `sender.name: null`.

Minor: `CLOSE_WORDS.repNote` and `repCountPhone` (`place-closure-window.ts:242-243`) say "Its head coach is emailed"; with no head coach the assistants are. Suggest "Its head coach, or its other coaches when it has none, is emailed."

Lawyer's eye: no, beyond the two narrow points already listed above.

## Session 2D, D1 (several diamonds of one park) — 2026-11-26 (read from `git diff HEAD` of `lib/place-closure-mail-words.ts` and `place-closure-window.ts`; statute not re-fetched)
- **K10 skeleton and CASL: pass.** The diff touches only the place words and "is/are". Sender line, reason line, reply and removal lines, foot, no link, no free text, From "{Club} via FieldLogicHQ" and the admin Reply-To are unchanged. No new commercial content. Position unchanged: not a CEM (s.1(2)); the earlier nameless-sender defect is not touched by this change.
- **Reopen wording: pass with change.** "{Club} reopened Lions Park" says the park was closed, but the club closed only some diamonds (and another press may still hold a diamond closed, or a third diamond may never have closed). It is a small accuracy overstatement, not a CASL issue. Replace with count-free words: subject "Diamonds at Lions Park reopened: {Team} game wasn’t moved"; body "{Club} reopened the diamonds at Lions Park that were closed. Your game on {day} at {time} wasn’t moved. Keep it or move it." (plural games: "Your games on … weren’t moved. Keep them or move them."). A count ("2 diamonds") is avoided because later presses can change it.
- **K16: pass.** The public/family mark "2 diamonds at Lions Park closed · waits for a new date" carries place words and a day only: no reason, person, team or child.
- **Accuracy note, not law:** a game with no diamond recorded may be on the diamond that stayed open; "needs a new date" is stated as fact. Acceptable because the email says it is only marked and nothing was moved (owner ruling D1).
- Lawyer's eye: no new points.
