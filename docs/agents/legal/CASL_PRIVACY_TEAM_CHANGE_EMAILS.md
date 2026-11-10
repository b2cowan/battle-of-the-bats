# Team-change emails after publishing — CASL and privacy review
**Last verified:** 2026-11-10 (CASL text itself was read on 2026-11-06 for `CASL_SECOND_PARENT_EMAIL.md`; this memo applies that reading and re-fetches nothing)
**Re-verify by:** the first time the email gains any promotional line, link or offer; Bill C-36 passes; a Québec customer; family accounts change what a family can see
**Depends on facts:** `LEGAL_FACTS.md` (FieldLogicHQ is the service provider for a club's families' data; the club is the organization responsible for it); `CASL_SECOND_PARENT_EMAIL.md` for the s.1(2) / s.6(6) reading and the second-parent copy

## Question(s) this answers
House League team-change emails (plan `HOUSE_LEAGUE_TEAM_CHANGE_EMAILS_PLAN.md`, TC·1 to TC·8, built on dev 2026-11-10): after publishing, a move emails nobody; the convenor reviews and sends one consolidated email per household naming only the children who changed, or chooses Don't email, which is recorded.
1. Does the consolidated email stay a service message, as the Publish email was treated?
2. Is the Don't email record, or the new "last told team" fact, a privacy matter beyond what the registration already holds?
3. Does the email's content need anything more?

## Finding
1. **Same class as the Publish email; nothing new.** The message tells a registered family which team their child is on and who coaches it, and the practice dates once that team has been told them. On the reading in `CASL_SECOND_PARENT_EMAIL.md` that is not a message encouraging commercial activity at all, and if a reader still called it one, s.6(6)'s factual-information-about-an-existing-membership limb is the defence. Sending **one** email in place of several per household lowers volume and changes nothing in kind. The one soft spot is unchanged: the "Your sign-up" pay button, drawn only while money is owed, is the same pay-link caveat already open in the second-parent memo (a). No unsubscribe link is added (service mode, as Publish); that is unchanged and still defensible for the first parent.
2. **No new category of personal information.** `told_team_id` and `told_at` record which team a family was last told. The child's team is already held; this adds when and what the family was told. It is cleared when the child leaves accepted or changes division, and it follows the registration's existing retention (the known gap in `LEGAL_FACTS.md`: no purge rule for player information, unchanged by this build). The skip record is an operational record: who pressed (a staff account), when, and counts. It names no family and no child. A staff member's name in a history row is the same kind of record Publish already writes.
3. **Content is the same as the placement email.** Child's full name, team, coach names, division, season, optional practice dates. Nothing new is disclosed to the recipient: it goes to the first parent's own address, and the second parent's copy follows the existing fan-out and stop link.

## What the product does today
Read from the build on 2026-11-10: the email goes through the family service sender with the placement kind (no new kind, no cap); the skip is one season-history row; no family-facing text promises an email on a team change **except one line**, below.

**⚠ Finding (a product promise, not a CASL point).** `lib/family-home-words.ts` `noTeam`: *"Not on a team right now. The club will email you when teams are set."* Before this build a late placement always emailed the family. Now the convenor may choose Don't email, or never press Send, so the line can be untrue for a child placed after publishing. Recommended fix (words only): *"Not on a team right now. Their team shows here once the club sets it."* **Not changed in the build** because the owner is mid-walk on `SIGNED_IN_FAMILY_STAGE4A_WALK.html`, which quotes the old line (step near line 269). Route to the owner: reword after that walk and update the walk step in the same change.

## Recommendation
- Reword the `noTeam` line as above after the owner's 4A walk.
- No change to the email, the record, or the privacy policy draft. The privacy draft makes no promise about notifying families of team changes (searched 2026-11-10).
- A family whose convenor chose Don't email still sees the new team on their status page and in the family app; the home page for a placed child is the source of truth. That is a product choice for the convenor, not a legal gap.

## Sources
- [Canada's Anti-Spam Legislation, s.1(2), s.6(1), s.6(6)](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html) — read 2026-11-06 (see `CASL_SECOND_PARENT_EMAIL.md`); applied, not re-fetched, 2026-11-10

## Lawyer's eye needed?
No new item. The standing open one (does a service message carrying a pay link count as a CEM) is already listed in `CASL_SECOND_PARENT_EMAIL.md`; the owner decides when.
