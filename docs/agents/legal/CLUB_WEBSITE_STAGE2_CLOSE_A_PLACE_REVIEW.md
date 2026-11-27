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

## Closed places, summarized — Session A (S1–S3 + T1), 2026-11-26 (read from `git diff HEAD` of `lib/club-notice.ts`, `lib/place-closures.ts`, `lib/place-closures-server.ts`, `lib/place-closure-window.ts`, the route and `place-closure-mail*.ts`; statute not re-fetched)
**No MUST-FIX. Nothing to change before commit.**
- **Public strip words: pass (K16).** New fixed words only: a day heading ("Closed today", "Closed tomorrow (Fri, Nov 27)", "Closed through Sun, Nov 29"), "{Park}: Diamond 1 and Diamond 2", "all diamonds", a place's name alone, "Show N more places" / "Show fewer". No reason, person, team, count or child. The place id read for the cover rule and the facility kinds read for "all diamonds" stay on the server (`closureStrip` passes words, `endsAt` and the small line only); a facility's kind is not personal information. No new data kind on a public page, so Privacy "publish its schedules" still covers it.
- **The covered diamond not named: pass, it is true.** "All our fields are closed today." includes the diamond for the same day; a narrower closure that runs longer, or starts on a day the wider one misses, keeps its own line, so the site never implies a place reopens sooner than it does; reopening the wider one brings the narrower line back on the next page read. "all diamonds" shows only when every facility of the park is a diamond, so it never understates a closed field or court.
- **Admin words: pass.** "Your site shows this at once, until the end of {day}:" says the day only when every row ends then; "Your site won’t change. It already says …" and "Your site didn’t change: it already says …" are true by construction (the cover rule, or the same place pressed again for those days). Soft spot, staff-only and accuracy not law: the window reads the closures showing when it opens, so a change by another admin while it is open can leave the preview out of date until it is reopened.
- **T1 (no places, "All our fields"): no new legal ground.** Same press, same family send (`sendRainout` → `sendFamilyServiceBatch`, the service-notice path), same rep coach email (not a CEM, s.1(2)), same strip. A house league admin pressing it is named with their role in the coach email's sender line (true), still reads rep as counts with no team names (minimisation holds), and the 2B nameless-sender defect is fixed in the code (`replyNameless` / `removalNameless`; no address = not sent). The owner's accepted cost (that admin closing fields for every program) is an operational choice, not a legal one.
- Lawyer's eye: no new points.

## Session B: one reopen, several closures — 2026-11-26 (read from the proposed words in the owner's brief and `lib/place-closure-mail-words.ts` `reopenedPlace` / `reopenSubject` / `reopenBody`; statute not re-fetched)
**CASL / privacy: pass, nothing changes.** Still one email per team per recipient, still no link, button, free text or offer; sender, reason, reply and removal lines untouched. Position unchanged: not a CEM (s.1(2)); Privacy §12 club-to-coach shape kept. The new text adds only place names, days and times of the coach's own team's games (no opponent, player, reason or person), so no new data kind. Accuracy, not law, is the whole question here.

**The rule that settles every case: name the place the coach's GAME is at, never the scope of the closure that was lifted, and say "reopened {P}" / "all its fields" only when nothing inside {P} stays closed on those days.** (Same reasoning as the D1 note above: "Lions Park reopened" overstated when a diamond stayed closed.)

| Case | Verdict |
|---|---|
| 1. Same place for every game | PASS, unchanged. |
| 2. Different diamonds of one park (or park + one of its diamonds together) | PASS. Subject "Diamond 1 and Diamond 2 at Lions Park reopened: U13 Ospreys games weren’t moved"; body as proposed. Say "reopened Lions Park" only when the games are at the park with no diamond recorded AND no diamond of that park stays closed on those days; if the park was reopened but a diamond stays closed by its own press, name the games' diamonds instead (or, for a no-diamond game, use case 3's "some of its fields" form). |
| 3. Games at different parks | PASS. Subject "Fields reopened: U13 Ospreys games weren’t moved"; body as proposed. Optional readability (not legal): "Your games on Sat, Nov 28 at 12:30 p.m. (Diamond 1 at Lions Park) and Sun, Nov 29 at 10:00 a.m. (Alder Fields) weren’t moved." The closed email uses "at … at …", so consistency is an equally good reason to keep it. A game with no known place is listed by day and time with no "at …". |
| 4. "All our fields" reopened while a place stays closed on its own | **MUST-FIX (accuracy, not CASL).** "reopened all its fields" is false when Lions Park Diamond 1 and Diamond 2 stay closed, the same class of overstatement as D1. |

**Case 4 words (only when some closure still covers any of those days; when nothing stays closed, today’s "reopened all its fields" is true and PASSES):**
- Game’s place known (preferred, same as case 1): subject "Alder Fields reopened: U13 Ospreys game wasn’t moved"; body "Kestrel Bay Softball Association reopened Alder Fields. Your game on Sat, Nov 28 at 12:30 p.m. wasn’t moved. Keep it or move it." (A game on a diamond reads "Diamond 3 at Lions Park". Several games: cases 2 or 3 by their places.)
- Game’s place unknown: subject "Fields reopened: U13 Ospreys game wasn’t moved"; body "Kestrel Bay Softball Association lifted its closure of all its fields. Some places stay closed on their own. Your game on Sat, Nov 28 at 12:30 p.m. wasn’t moved. Keep it or move it." (plural: "Your games on … weren’t moved. Keep them or move them.") "Lifted its closure of all its fields" is literally what was done; "Some places stay closed on their own" is included only when the press left one closed.
- **Mixed list** (one game held by "all our fields", another by a diamond): use case 3 form: subject "Fields reopened: U13 Ospreys games weren’t moved"; body "Kestrel Bay Softball Association reopened some of its fields. Your games on Sat, Nov 28 at 12:30 p.m. at Alder Fields and Sun, Nov 29 at 10:00 a.m. at Diamond 1 at Lions Park weren’t moved. Keep them or move them." Never "all its fields" in a mixed list.

**Build consequence (for /plan, not a legal fix):** the reopen mail needs each game’s own place (and, for the "all its fields" and park cases, whether anything inside that place stays closed on the same days). Today `CoachMailGame` carries only the closure, `placeWords` and `reopenPark`, so `reopenedPlace` cannot do this yet. Coaches are emailed only about games no closure still holds, which is right and unchanged; the same email must never say more is open than is.

Lawyer’s eye: no new points.
