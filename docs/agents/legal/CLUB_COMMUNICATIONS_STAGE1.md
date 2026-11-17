# Club Communications Stage 1 — who may send family email, who reads the sent list, what the drawing promises
**Last verified:** 2026-11-16 (reasoned from `LEGAL_FACTS.md`, `CASL_COACH_GROUP_EMAIL.md`, `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md`, `IN_CLUB_VISIBILITY_PROMISES.md` and the privacy draft v0.3; read against the code and `DATA_DICTIONARY.md`. No statute re-fetched: nothing here turns on a changed provision. CASL s.6 as read 2026-11-16 in `CASL_COACH_GROUP_EMAIL.md`)
**Re-verify by:** the Stage 1 build prompt (before it is written), or a trigger: Stage 2 or Stage 3 is drawn (their questions are listed at the foot and must be answered first); the sent list gains any field; the list shows a seat a new kind of row; Bill C-36; first Québec customer; club data-processing terms drafted.
**Depends on facts:** `LEGAL_FACTS.md` § FieldLogicHQ's two privacy roles (service provider to the club for the club's families' information); § Where data lives (Resend); no club on sale yet (nothing sold).

## Question(s) this answers
Plan `CLUB_COMMUNICATIONS_PLAN.md` §1 (rulings 4, 5, 11) and §4, drawn in `CLUB_COMMUNICATIONS_STAGE1_DRAWINGS.html`: (a) an admin sends family email without the Families book and sees up to three family names in a sent record's "Opted out" and "Didn't go" lines; (b) one merged sent list, where a league admin or registrar sees club-wide rows (message and counts, names from outside their program withheld); (c) the coach email's door and history move in; (d) a per-person Communications switch; (e) "Families from a list" only for holders of the book; (f) no change to what the emails contain, their footers, unsubscribe or allowance, and no message down both mail paths.

## Finding
1. **(a) does not change FieldLogicHQ's position under PIPEDA, and no promise of ours moves.** We are the club's service provider for these families; who inside the club sees what is the club's configuration. The privacy draft says exactly that ("The club controls which of its people can see which records", §5) and promises nothing about the Families grant. The Families grant is a product safeguard (PIPEDA 4.7, safeguards in proportion to sensitivity), not a statement to anyone. The sensitive content it guards (medical notes, emergency contacts, dates of birth) is not what Stage 1 opens: a surname and "opted out of club email" is low sensitivity, and the opt-out is a fact about the household's relationship with the club, which the club already holds and acts on every send. Reading it as the club's own staff reading the club's own record is the position in `IN_CLUB_VISIBILITY_PROMISES.md`.
2. **Family names for an admin without the book: acceptable, no law issue; keep the admin and the registrar on different lines on purpose.** The registrar's line (numbers only on a wider row) exists because the registrar is a one-program seat and the row mixes programs. An admin is a whole-club seat ("owner and admins see everything", ruled). Do not copy the registrar rule onto the admin. The narrower option, if the owner wants it, is names for "Didn't go" (a delivery problem the sender must know about) and a count for "Opted out" (a household's choice). Not required.
3. **(b) The registrar rule is the right line, but the drawing states it two ways.** Tab 3's record shows the registrar bare numbers on a family email (Opted out 3, Didn't go 2); Ask 4 says "names only for your own people". For FAMILY emails there is no per-recipient program tag to name "your own" people by: `family_email_recipients` keeps `person_ids`, `family_name` and `status` only, and the plan decides visibility "from the kind of group, not each recipient". So for family rows it must be bare numbers, full stop. Names for "your own people" is possible only for coach emails (the coach log keeps a team line per recipient). The season's own door still names a season's own families, as today.
4. **The withholding must be done on the server.** Today `readClubEmail` returns `missedNamed` and `optedOutNamed` to whoever the route admits (`lib/families-emails-log.ts:~214-222`; route `app/api/admin/families/emails/[sendId]/route.ts`). A drawn "numbers only" that is a hidden column in the screen leaks in the JSON. The rule belongs in the reader, keyed on the seat.
5. **(b)/Q2 The body of a club-wide email becoming readable by more seats: low risk, one sentence of transparency.** A registrar already sees every house-league child's registration, so a message to every family is less sensitive than what the seat holds. Free text can name a child, but only to the families it went to, who already read it; the new readers are club staff on a need-to-know ("what stops the double send"). The rows that could carry rep-only content (rep coaches, rep families) are already excluded from the registrar's list. What is missing is telling the sender who can read it, so the sender can choose words with that in mind (PIPEDA 4.2/4.8 openness inside the club, and the same fairness the coach email owes its sender). The privacy policy needs no sentence about who inside a club reads a sent message: it is the club's setting, §5 already says so. It does need the log sentence already owed (finding 8 below).
6. **Retention (Q3): the merge creates no new store, so no new obligation; two already-open ones widen.** The merged list is a read over `family_email_sends` + `family_email_recipients` + `family_messages` and the coach log (to be added). PIPEDA has no register-of-processing duty; the hooks are 4.5.3 (keep only as long as needed; guidelines and destruction) and 4.1.4(d) (the policy states retention). **Both logs keep the free-text body and the per-recipient names with no clock** (`family_email_recipients.family_name` per family per send, and the coach log's named recipients); same class as backlog L9 and L16 and finding 8 of `CASL_COACH_GROUP_EMAIL.md`. The one clock owed to `/plan` must cover BOTH logs and the family one-household record, not the coach log alone. Also: `DATA_DICTIONARY.md` § `family_email_sends` still says the log keeps "NEVER a list of families" (owner 2026-10-22), which stopped being true when 9d-1 added `family_email_recipients` (surnames and person ids). Correct that sentence in the Stage 1 dictionary update.
7. **CASL (Q4): nothing in Stage 1 touches the two-paths rule or the family unsubscribe, provided the window and sender stay exactly as shipped.** Families are still emailed from the club, with the family envelope, the club's unsubscribe, the opt-out suppression and the club's 3 in 24 hours, none of which depend on who pressed Send. Consent and identification (s.6(2)(a), name of the sender and the person on whose behalf) are unchanged: "from the club, your address to reply to". Letting more people send changes who is exposed by the Reply-To (every admin, not just the book's holders): same low-risk class as finding 5 of `CASL_COACH_GROUP_EMAIL.md`, answered by the window already saying where replies go. One New email button with two choices is a UI grouping, not a shared path, as long as the two windows keep their own senders and the build guard (coach sender may not import the family envelope, and the family manifest guard) stays. A registrar newly sending to house-league coaches rests on the same s.1(2) "not a CEM" reading as every coach email; the SOR/2013-221 s.3(a)(i) fallback is weaker for volunteer house-league coaches (already noted in the coach file; not a Stage 1 blocker).
8. **Who may now send is a seat-table question, and the server must hold it.** The existing gate also refuses a member limited to some rep-team groups (`lib/families-auth.ts`, `team_limited`), because a family email reaches teams outside their group. The drawing says "no Communications place for a limited member"; that must be the ROUTE's refusal too, not only a hidden nav row. Same for a registrar posting the "All coaches" or "Every family" choice by hand: the send route must refuse a group the seat was not offered.
9. **(d) The Communications switch and (e) the list door: no issue.** Off means no group email is a stronger control, not a weaker one. "Families from a list" for book holders only is right: choosing "owes money" or "no consent on file" tells the sender a fact about each household, which is the book's content.
10. **(Q5) Claims on the drawing checked against the code.**
    - "No seat sees an email address. The lists and records carry names only." **Not true in one edge, which Stage 1 must make true.** A one-family message row's "To" is `personDisplayName(p)`, which falls back to `email_normalized` when the person has no first or last name (`lib/families-read.ts:376-379`; used at `lib/families-emails-log.ts:177`, `:189`). A name-less family therefore shows an address to every seat that reads that row. The recipients' `family_name` is a surname or null and is never an address (`lib/families-audience.ts:286-288`), so the opt-out and missed lines are safe: a null name makes `familiesNamed` return null, and the line counts instead of naming (`lib/families-words.ts:490-494`).
    - "A message to one family (its date and sender, never its words)": **true** (`family_messages` keeps date, sender and person; subject is null in the reader). But the row names the household, which is the household record's "last messaged by whom". An admin without the book would learn which household staff contacted. Owner ruled admins see everything; raise it as an ask (finding in Recommendation 6), do not decide it silently.
    - "Reached counts the families whose email the mail service accepted; a bounce later isn't shown": **true** (`status = sent` is "accepted", dictionary).
    - "Up to three named": **true** (`familiesNamed`, more than three is counted, never named).
    - "Opted out" and "Didn't go" naming for the registrar: see findings 3 and 4.
    - "A league admin or registrar can write to exactly who they can today, plus house-league coaches": the plus is a real new capability (colleague mail) and rests on the coach drawing's ask 1 (who may send), still open.

## What the product does today
Checked 2026-11-16 against: `lib/families-auth.ts` (the Families grant, plus the team-limited refusal, gates the club door and the list); `lib/families-emails-log.ts` (the list reader; `readClubEmail` names up to three opted-out and missed families to whoever the route admits; `readSeasonHistory` for the season door, gated by the house-league `email` right, not the grant); `app/api/admin/families/emails/[sendId]/route.ts` (grant) and `app/api/admin/house-league/seasons/[seasonId]/emails/history/route.ts` (season email right, season-scoped); `lib/families-audience.ts:286-288` (surname or null); `docs/agents/db/DATA_DICTIONARY.md` § `family_email_sends`, `family_email_recipients`, `family_messages`. **Not built:** Communications, the merged reader, the coach log, the Communications switch's read. `module_communications` is a dormant flag read by no screen. The privacy draft (v0.3) lists "messages" among what a club may keep, says the club controls who sees what, and carries no sentence about a sent-email log.

## Recommendation
**Must change in the drawing before the owner sees it**
1. **Tab 3 and Ask 4: one rule for the registrar.** On a family email: the message, the counts, and **no names at all** (Opted out 3, Didn't go 2, as drawn on the record). "Names for your own people" applies to the coach record only. Reword Ask 4 to say so. Add the build rule: the withholding is in the reader, per seat, never a hidden column.
2. **Tab 4 "What no seat gains": replace "No seat sees an email address" with "No list or record shows an email address; a family with no name on file reads 'A family', never its address."** Build item: the merged reader must not use the address fallback.
3. **Tabs 2 and 3: tell the sender who can read the message.** One quiet line under each window's message box when opened from Communications, in the family window and the coach window alike, for example: "The club's owner and admins can read this and see who it reached. League admins and registrars can too, when it goes to house-league people." (Words to `/marketing`.) The coach email already says replies come to the sender; this is its sibling.
4. **Tab 4: say the seat rules are enforced by the send and read routes,** including: a limited member refused, and a registrar or league admin refused any group they are not offered. Fold into the seat-table test already planned.

**Add as an owner ask (a plan decision, not a legal blocker)**
5. **Admin without the book: names in the Opted out and Didn't go lines.** Recommend keeping them as drawn (finding 2). Offer the narrower option as the alternative.
6. **One-family message rows for an admin without the book.** Recommend either show them only to holders of the book, or show them as "1 family" with no name. Owner has ruled that admins see everything, so this is his call, not ours.

**Owed later (not blockers for the drawing)**
7. **Privacy draft §5/§9:** one sentence that a club's sent emails (subject, message, who it reached by family name or coach name, counts) are kept in the club's record for as long as the retention clock says; wording after `/plan` sets the clock. Not publishable until that clock exists (`/plan`: one clock for the family log, the family recipients, the one-household record and the coach log).
8. **`DATA_DICTIONARY.md`:** correct "NEVER a list of families" under `family_email_sends`; document the coach log's recipients and the seat rule in the same unit as the migration.
9. **Re-check on build:** (i) the merged reader's per-seat output (a JSON test: a registrar's record carries no `optedOutNamed` or `missedNamed`); (ii) the build guard from the coach file still passes; (iii) the family-email manifest guard still passes; (iv) `/docs` article that moves says admins no longer need the Families book to email families, and does not say household records opened.
10. **`/legal` re-run** before the Stage 1 build prompt is written, against the answered asks.

## Questions to settle in `/legal` BEFORE the next stages are drawn (list only, not answered here)
**Stage 2 (one message to families and coaches, two mailings; plan ruling 7)**
- What does the window say or refuse when a promotional message has both kinds ticked, given coach mail carries no unsubscribe and may only carry non-commercial content?
- Which daily allowance does a mixed send count toward, and does the coach half count at all?
- A person who is both a parent and a coach gets one copy: the family copy. If that parent opted out of club family email, do they silently stop receiving a coaches' meeting notice? What overrides, if anything?
- The reason and removal lines when one message goes down two paths: one shared line or each its own?
- The same body is read by parents and by coaches who are not the child's coach: does the window need a rule about naming a child?
- One record row with two mailings: what a registrar sees when one mailing is theirs and the other is not; when Stopped on one mailing and not the other, what is offered and to whom.
- Head-coach copies (the existing colleague copy sent from the family sender) alongside a coach tick: dedupe and which envelope wins.
- Who sees the recount's names for a mixed group (a rep coach's name on a registrar's screen).

**Stage 3 (the club's record lists coaches' emails to their own team's families; plan ruling 8)**
- Notice: the plain line in the coach's window ("the club can see these"): exact words; does a family or the coach's own terms need to say it; is it a change of purpose for emails a coach already sent before the stage ships?
- Who in the club reads them (owner and admin only, or registrars too), and do they see the body, which can name a child?
- Where the line sits between "the club's own team" and a coach's standalone portal, and what happens when a team moves between the two, a coach leaves a club, or the club ends.
- Retention of a coach's team emails in the club's record versus the coach's own record (`rep_team_announcements`), and what a deletion or access request from a family reaches.
- Does listing change who is the sender for CASL identification (the coach, on whose behalf?), and does the listed row count as the club "causing or permitting" a coach's message?
- The fixed-wording coach sends joining the list (Ask the coaches, Send the schedule, reminder waves): their bodies name players and amounts; which fields may a list row show to which seat (a "no guardian on file" list names children; a bill names an amount).
- Tournament announcements as rows: public text versus private recipient lists; which tournament director seat reads a club row.

## Sources
- No new primary source read. Reasoning reuses the primary reads logged in `CASL_COACH_GROUP_EMAIL.md` (CASL s.1(2), s.6; SOR/2013-221 s.3, accessed 2026-11-16) and the PIPEDA principles in `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md` (4.1.4, 4.2, 4.5.3, 4.7, 4.8).
- Code and dictionary paths as cited above, read 2026-11-16.

## Lawyer's eye needed?
No for Stage 1 as corrected. Two narrow points if the club tier goes on sale: whether a surname plus "opted out of club email" shown to a seat without the household record is within the club's reasonable-expectation use, and (already on file) whether volunteer house-league coaches are "representatives" for the CASL fallback. A lawyer should look at Stage 3 (a coach's emails listed in the club's record) before it is built, as it changes whose record a coach's words sit in.

## Addendum 2026-11-16 — The board as a group
**Asked by the owner 2026-11-16:** add "The board" as a third group in Stage 1 ("To the board", window "Email the board"), down the colleague path. **Last verified:** 2026-11-16, reasoned from `CASL_COACH_GROUP_EMAIL.md` (Recommendation 5 and the build guard; no statute re-fetched, nothing here turns on a changed provision) and read against the code: `lib/board-people.ts:9-13` (`BOARD_ROLES` = owner, admin, league_admin, league_registrar, treasurer; the NAMES ONLY ruling, R1, owner 2026-11-06), `app/api/admin/board/route.ts:6-19` (any active member of the club may read the board, `{ name, role }` only), `lib/member-names.ts:88-123` (`boardNames`: `status = 'active'` only; a member with no name, or a name containing "@", is left out), `docs/agents/db/DATA_DICTIONARY.md` `organization_members.status` (`invited | active | suspended`). **Re-verify trigger for this addendum:** the group is ever widened beyond member seats (Board Ready Stage 3 People, or the plan's old Stage 4 "Board" row, holding a director with no account or a typed address); the board tab gains a field; Bill C-36; first Québec customer.

### What the group is, from the code
Member seats, one account each, live from `organization_members` where `status = 'active'` and `role` is in `BOARD_ROLES`. Never guardians, never families, never a typed address: every recipient signed in once and confirmed their own address. That makes this a *safer* group than coaches (whose addresses the club types and nobody verifies; finding 6 of the coach file) and the opposite of a Stage 3 account-less group.

### 1. The conditions, (a)–(g) of Recommendation 5
| | Verdict | Why |
|---|---|---|
| (a) in the group because the club recorded that role | **Pass** | The seat table is the record. Build rule: the board audience builder reads `organization_members` only and may not import the families modules. Suspended and `invited` seats are excluded. |
| (b) the reason line is true | **Pass once reworded** | "You're on {Club}'s board" is untrue for the volunteer webmaster admin and says something about a person that a club's real board of directors would call a governance status. Use the per-recipient line below. |
| (c) about the recipient's own role; no shared who-owes-what list; no child detail | **Pass with the line** | (c) was written for fixed-wording sends; board mail is free text, so, as with coaches, the control is the line at the message box, not code. The board is the group most likely to paste a family's arrears or a named child; the line (Q3) says so. The product cannot read the body. |
| (d) no commercial content, same guard | **Pass** | The guard is unchanged. The group adds only a label and a reason line, both built from fixed words, so both go under the guard's zero-commercial-words rule. |
| (e) a way off that works with no account | **Pass, with an honest consequence** | Every recipient has an account, so the "no account" worry does not arise. But nobody can take themselves off the board list (the seat is the membership): "Reply and tell {Sender}" reaches a person who cannot act on it except by not picking that member next time, or by the owner changing the seat. Keep the line (it is the courtesy, not a statutory unsubscribe; this is not a CEM); see owner ask 4. |
| (f) no link; account-less links only by allowlist | **Pass** | Zero links, guard unchanged. Do not add an "Open in Communications" link to board mail: it is tempting and it breaks the guard for nothing. |
| (g) re-run this checklist before the build | **This is the run;** it re-runs at the Stage 1 build prompt as already required. |

**Is the "representative of an organization" fallback (SOR/2013-221 s.3(a)(i)) stronger or weaker than for coaches? Stronger.** The recipients are the club's owner, admins and officers, each with an account in the club's own space, so "representative" is hardest to dispute; the doubtful ones in the coach file are volunteer house-league coaches and parent helpers. Two limits: the exit covers only a message that *concerns the organization's activities* (a personal note down this path would not qualify), and the volunteer-webmaster admin is a representative only because the club gave them the seat, which is the same fact. Keep it a fallback, never the design basis: the design basis stays s.1(2), not a CEM.

**Changes (no change to the removal line or the guard's rules; additions only):**
- Reason line, rendered per recipient from their own seat: "You get it because you're on {Club}'s board in FieldLogicHQ, as {an admin}." (`roleWithArticle` already gives "an admin", "a treasurer", "an owner", "a league registrar"). It is built only from a role in `BOARD_ROLES`.
- Removal line unchanged: "Not right for you? Reply and tell {Sender}."
- Build guard: add the board kind to the sample renders (reason and removal lines must pass the zero-links and zero-commercial-words checks); the foot and From name stay exact; one new test that the board audience builder imports no families module and no guardian/person table.
- A sole-owner club (N = 0 after leaving out the sender) must not be offered "To the board": a dead choice, same as any group with nobody in it.

### 2. Privacy and ruling R1
**R1 is a rule about what a screen or route shows: a person and their role, never an email or a phone number** (`lib/board-people.ts:9`, `app/api/admin/board/route.ts:10-11`). Emailing the board stays inside it **if** the address never leaves the server to any screen: the audience is built server-side from the members' own accounts; the window's picker and the record are read through the same names-and-roles reader; the recipients table keys on account id plus the name and role at send time, never an address. Sending to someone's account address for club business is the purpose they hold the account for; no new collection.

**Does a treasurer or registrar sender see anything new? Almost nothing.** Any active member already reads every board member's name and role, so the picker and a record naming recipients by name and role show them what they can read today. Three real edges:
1. **A pending invitee ("left out and named").** The board tab lists `active` seats only, so a treasurer cannot see today that someone has been invited. Naming "Jules hasn't accepted yet" to a treasurer or registrar discloses that. Name the pending member to **owner and admin** senders (they manage invitations); to every other seat say a count only ("1 board member hasn't accepted yet and won't get this").
2. **A suspended member** is never named, never counted in N, never "left out": suspension is not shown on the board tab.
3. **A seat with no name** (`boardNames` leaves it out; a send-side read must not, or N would not match the recipients): the record and picker show the role alone, "A board member (treasurer)", never the address (same fallback defect as finding 10 of this file).

**The Reply-To.** The sender's address reaches every recipient, and by R1 board members' addresses are not otherwise visible to each other. That is not an R1 breach (R1 limits what the product displays; here the sender chooses to write and the window says "Replies come to you at {address}") and each recipient gets their own copy, so no recipient's address reaches another. It matters slightly more here than for coaches because a board member may use a personal mailbox. The window's statement is the fix; no block.

### 3. Free text, the log, and who may read it
**Control recommended (three parts):**
1. **A line at the message box**, in the board window, in place of the generic ask-11 line: "Everyone you send this to, and the club's owner and admins, can read it afterwards. Leave out a child's or a family's details unless everyone on the board should see them." Followed by the standing line: "Keep it to the club's own business. Don't use this to sell or promote anything, for you or for a sponsor."
2. **Read rule, held in the reader on the server, per seat (not a hidden column):** a board email's row, body and recipient names are readable by the **sender, the people it went to (by account id), and the club's owner and admins**. Not by a league admin, registrar or treasurer who was not a recipient, and not by a seat added later unless it is an owner or admin seat. A non-recipient does not see the row at all: its existence says a board conversation happened without them. This **replaces** the proposed "every board seat with Communications sees the row", which is wrong twice: a "Board members you pick" email did not reach everyone, and a seat added later never had it in its inbox. "Finish a stopped email" (ask 14) follows the same rule: the sender, owner and admins; others are told who can.
3. **The log's retention clock** (already owed, finding 6) must cover the board mail's body. Board bodies are the most sensitive free text the log will hold; keep the clock able to expire the body before the who-and-when (owner ask 5).

Owners and admins reading all board mail is the existing ruling (asks 11, 12) and the line says it; its cost is that an admin can read a board exchange that is about them. Offered as owner ask 2.

### 4. The privacy policy and the club data-processing terms
**Nothing beyond what is already owed for the coach-email log, plus two small widenings.** (i) The §5/§9 sentence owed for the sent-email log ("sender, group, body, who it reached by name") should say "by name and role" so it covers board mail; it still cannot publish until `/plan` sets the clock. (ii) The club data-processing terms (not started) list sent-email records as a category the club controls, with the seat rule above as the club's configuration. No new data kind: board recipients are account holders whose address we already hold for the account. §5's "the club controls which of its people can see which records" stays true.

### 5. Is "The board" an honest name?
**Not a problem to the policy** (no document says "board"), but a real wording risk in the product: the group is the set of **member seats**, not a club's legal board of directors. A director with no account is not in it; the webmaster admin is. Two honest costs: (a) a club may treat "I emailed the board" as notice to its directors, and a director with no account here never got it; (b) the reason line says "on the board" to a person who is not a director. Keep the name (the Organization tab already calls these seats "The board", so the group matches what the owner sees) and add the honest words:
- **Sub line under "Everyone on the board · N":** "Everyone on Organization › The board: owner, admins, league admin, registrar and treasurer. People with an account only." The picker's sub line: "Pick from the people on Organization › The board."
- **Window statement:** "Emails each person on the board you pick, one email each, from the club. Replies come to you at {address}." The count never includes the sender.
- **Help article (`/docs`):** never "notice to the board" or "notice of a meeting"; "a message to the people who hold a board seat here". A club's governance notices are its own obligation.

### Owner asks this raises (recommendation first)
1. **Who may send:** owner, admin and the other three board seats, as proposed. **Recommend yes** (no CASL difference; peers writing to peers), on the read rule in Q3. A treasurer's Communications place then holds only this one choice, consistent with the plan's "the place appears when the seat has a group to write to". The treasurer's Communications switch default (ruling 5 set league admin and registrar on) needs a call: **recommend on for all board seats**, off-able per person.
2. **Do owners and admins read board mail they were not sent?** **Recommend yes** (ruled for all club email, line tells the sender); other non-recipient seats no.
3. **Pending and suspended members:** pending named to owner and admin only, a count for others; suspended never shown. **Recommend as written.**
4. **A mute for board mail on the receiving side:** **Recommend no**: a board seat that mutes board mail defeats the group; the exit is the seat.
5. **Body expiry shorter than the record's:** **Recommend** one clock now, body and metadata separable, so the owner can shorten the body later without a rebuild.
6. **The name and sub line:** approve "The board" with the sub line above.

### Owed later
Privacy §5/§9 sentence widened and the clock (`/plan`, one clock for every log). `DATA_DICTIONARY.md`: board recipients keyed by account id with role at send time; the seat rule. Build tests: audience reads `organization_members` only; suspended and invited absent from N; a non-recipient seat's reader JSON carries no row, body or names; no address fallback for a nameless seat; guard samples include the board kind. `/docs` wording (no "notice"). `/legal` re-runs at the Stage 1 build prompt and again if the group is ever widened to a person with no account (conditions (a), (e) and (f) then bite as for any Stage 3 group).

### Lawyer's eye needed?
No. The only open points are the two already on file: whether volunteers are "representatives" for the s.3(a)(i) fallback (this group is the strongest case for it, not a new question), and, if the club tier goes on sale, whether an unlinked brand line in the foot is promotion. A club using board mail as formal governance notice is the club's own obligation, not FieldLogicHQ's.


---

## Build-prompt checklist 2026-11-16 (Stage 1, fully ruled)
**Run:** the `/legal` re-run the Stage 1 section above required before the build prompt is written. **Last verified:** 2026-11-16. Reasoned from `LEGAL_FACTS.md`, `CASL_COACH_GROUP_EMAIL.md`, this file (including the board addendum), the privacy draft v0.3, `CLUB_COMMUNICATIONS_PLAN.md` §1 and §3 Stage 1, `CLUB_COMMUNICATIONS_STAGE1_DRAWINGS.html` (all nine tabs) and the coach email drawing (`BOARD_READY_STAGE2_GROUP_EMAIL_DRAWINGS.html`, tabs 2 to 9), and spot-read against the code (`lib/email-club-identity.ts` `familySenderName`/`platformLineWords`; `lib/families-read.ts:376`; `lib/board-people.ts`; `lib/member-names.ts` `boardNames`; `lib/families-email-coaches.ts`; `tests/unit/family-email-guard.test.ts`; `DATA_DICTIONARY.md` § `family_email_sends`). No statute re-fetched: nothing here turns on a changed provision (CASL s.1(2), s.6 and SOR/2013-221 s.3 as read in `CASL_COACH_GROUP_EMAIL.md`, 2026-11-16). **Re-verify by:** any change to a fixed word below; a group widened beyond member seats or a person with no account; the first club on a plan that carries Communications; Bill C-36; first Québec customer. **Not built yet: nothing below describes shipped code.**

**The ruled set in one line:** three groups (families, coaches, the board); family mail on the family path, coach and board mail on the colleague path; names and counts only; registrar and league admin see wider rows without outside names; board mail is read by its sender, its recipients, and the owner and admins; the Communications switch gates sending from every screen; one retention clock is owed for every log.

### 1. Does anything ruled contradict an earlier finding?
**No legal contradiction.** Every ruling is inside what the findings above and `CASL_COACH_GROUP_EMAIL.md` allow (admin names on the Opted out / Didn't go lines is finding 2's "acceptable"; ask 13 is finding 6's first option; coach asks 1, 8, 9, 10, 12 are Recommendation 1 to 3 of the coach file). **Eight drawing-level conflicts the build prompt must settle as below (each is a wording or interaction fix, none reopens a ruling):**

| # | Conflict | Fix the build carries |
|---|---|---|
| C1 | Tab 8 says owners and admins "see [the pending member's] name in the foot" but quotes a count line ("1 invited member hasn't accepted yet and won't."). | The **foot is the count line for every sender**. The pending member's **name appears only in "See who gets it", as a dimmed row, and only to an owner or admin sender** (addendum §2 edge 1). Other seats get no row. A suspended member appears nowhere. |
| C2 | Ruling 5 ("you see every email that reached people in the programs you run") would, if one visibility function covers every kind, show a registrar or league admin a board email they were not sent: the board includes registrar and league-admin seats, so "house-league people were in it" is true of almost any board email. | **Board is its own branch in the reader, chosen by kind before any program rule runs.** Ruling 5's rule never applies to a board row. Tab 3's own last line ("only if they sent it or it went to them") is the rule. |
| C3 | Coach drawing ask 1: "A treasurer … gets no tab." Ask 16 (board): a treasurer gets a Communications place holding one button. | Both stand: the treasurer's place holds **only** "Email the board" and board emails they sent or received. Every family route and every coach route refuses a treasurer. |
| C4 | Ruling 5 ("the switch off = no group email from ANY screen") sits beside ask 19 ("board members can't switch board email off"). | Different things: the switch governs **sending and the place** (and the read routes that live in the place). **Receiving a board email depends only on the seat**. A board seat with the switch off still gets board mail in their inbox, cannot open the record, and cannot send. |
| C5 | The coach email carries "{Sender} ({Role}, {Club}) sent this." (coach drawing, level 2). The board sample on tab 8 does not. | **Both colleague kinds carry the sender line.** Identification is the reason the s.3(a)(i) fallback and the "reply and tell" route work, and it must not differ by kind. |
| C6 | Coach drawing: "You are not counted." Board drawing: "You aren't counted." | One wording: **"You aren't counted."** (the house contractions). Applies to the coach foot too. |
| C7 | The readers line says owners and admins "see who it reached" and "League admins and registrars can too". For a registrar reading a wider family email, that is untrue: they see counts and no names (ask 4). | Reword so the second sentence does not promise names: **"League admins and registrars can read it too when it reaches house-league families or coaches."** Words go through the `/marketing` pass, but they may not say more than this. |
| C8 | The coach drawing's reason line is "by group". "All coaches" mixes rep staff and house-league coaches, so one group line is untrue of half the recipients. | **The reason line is computed per recipient from their own qualifying basis, not from the group the sender chose** (§2b). |

Also noted, not a conflict: the drawing keeps the "Reply to this email to reach {Sender}." line "when the sender has an address"; the removal line ("Reply and tell {Sender}") rests on the same fact. §2a rule 8 makes both safe.

---

### 2. Build requirements with a legal basis

#### (a) Mail paths and envelopes
1. **Two paths, one message per send.** A send request is exactly one kind: **family** (club door, season door) or **colleague** (coach, board). The colleague route refuses any audience that is a family, guardian, parent or player; the family route refuses a coach or board kind. A request that names both is refused with nothing sent. (Basis: CASL two-paths rule; family mail carries the unsubscribe and the allowance, colleague mail does not and may not be used to reach a family: `CASL_COACH_GROUP_EMAIL.md` Rec 5(a).)
2. **Family envelope unchanged.** The family send keeps its footer, club band, unsubscribe, opt-out suppression, 3 in 24 hours and Reply-To exactly as shipped. Who may press Send changes; none of those depend on who pressed it. The existing head-coach copy (`lib/families-email-coaches.ts`) is untouched and stays a colleague copy sent from the family send.
3. **Colleague envelope.** House mail, one email per recipient (one To, no Cc, no Bcc, no recipient list in any copy), five at a time, From name `{Club} via FieldLogicHQ`, Reply-To the sender's account address, no unsubscribe, no club band, no family footer, no link anywhere in anything the product adds.
4. **The colleague sender's imports are an allowlist, enforced by a test.** It may import the transport (`lib/email.ts`), the house-mail HTML builder and words types the existing colleague sends use (`club-schedule-send`'s `emailHtml`, `club-schedule-words`' `EmailWords`), and from `lib/email-club-identity.ts` **only** `familySenderName` and `platformLineWords`. It may not import `lib/families-email.ts`, `lib/families-words.ts`' family words, any unsubscribe builder, `clubBand` or `FamilyMailFace`/`familyReplyPlan`, or call a family `kind`.
5. **The board audience builder reads `organization_members` only** (plus account name reads for a member with no display name). It may not import any `lib/families-*` module and may not read any table that holds a family, guardian, person or player. A member counts only if `status = 'active'` and `role` is in `BOARD_ROLES` (`lib/board-people.ts`). It is **not** `boardRecipients` (`lib/two-step-emails.ts`: owner, admin, treasurer): that is a narrower list for another purpose.
6. **No coach or board audience is ever computed from guardians.** Rep coaches: active staff memberships on a team that is not archived. House-league coaches: the live season's coach rows that are not removed. A coach who is also a parent is emailed as a coach, from the coach path, and separately from the family path if the family send reaches them (Stage 1 never merges them).
7. **The build guard (fails the build)** runs over the rendered HTML and text of **every colleague kind**: rep staff, house-league coach, picked coach, and the board for **each** role in `BOARD_ROLES`, using a plain sample body, plus the words file:
   - zero `<a`, `href=`, `http:`, `https:`, `www.`, `mailto:`;
   - zero commercial words in anything the product adds: no plan name or price read from `lib/plan-config.ts`, no `$`, none of pricing, price, per month, free trial, trial, sign up, sign-up, subscribe, upgrade, discount, offer, buy, "try FieldLogicHQ", "your own club", "learn more", "get started";
   - the foot is exactly `Sent through FieldLogicHQ, the software {Club} uses.` as plain text; the From name is exactly `familySenderName(club)` output, `{Club} via FieldLogicHQ`;
   - the removal line and the sender line are present in every kind;
   - none of the family envelope's words or markup ("Stop these emails", unsubscribe, club band) appears;
   - the board reason line is built only from a role in `BOARD_ROLES` (a role outside it throws);
   - the admin's own body is **not** scanned.
8. **No usable sender address, no send.** If the account pressing Send has no usable address, the colleague route refuses and nothing is sent. The Reply-To statement, "Reply to this email to reach {Sender}.", and the removal line ("Reply and tell {Sender}.") all rest on replies reaching the sender; dropping only the first (the coach file's wording) would leave the other two false. (It can hardly occur for a signed-in account; build the refusal, it is one line.)
9. **The sender never gets a copy and is never counted.** Recipients are de-duplicated by trimmed lower-cased address (coaches) or account id (board).
10. **No daily allowance on coach or board mail; only the just-sent check**, as long as the check is the family send's length. Do not copy the family allowance onto it, and do not add an allowance to the family path "for symmetry". (Ruled: coach ask 12.)
11. **No tracking.** No open or click tracking, no read receipt, no per-recipient link, on any of the three kinds.

#### (b) Fixed words the product adds to colleague mail and its windows, as last settled
Quoted from the drawings and the coach file. `{ }` are filled by the product. Words may go through the `/marketing` pass; **the meaning and the facts each line states may not be reduced**, and the build guard pins the foot, From, removal and reason lines exactly.

| Where | Words |
|---|---|
| From | `{Club} via FieldLogicHQ` (`familySenderName`: strips quotes and commas; fallback `FieldLogicHQ`) |
| Reply-To | the sender's account address |
| Greeting | `Hi {First},` or `Hi,` when there is no first name |
| Sender line (every colleague kind, C5) | `{Sender} ({Role}, {Club}) sent this.` |
| Reply line | `Reply to this email to reach {Sender}.` |
| Reason line, rep staff (incl. managers, assistants) | `You get it because you're on {Club}'s coaching staff.` |
| Reason line, house-league coach | `You get it because you coach in {Club}'s house league.` |
| Reason line, a picked coach | `You get it because {Sender} picked you.` |
| Reason line, **the board, per recipient** | `You get it because you're on {Club}'s board in FieldLogicHQ, as {an admin}.` (`roleWithArticle`: "an owner", "an admin", "a league admin", "a league registrar", "a treasurer") |
| Removal line (every colleague kind) | `Not right for you? Reply and tell {Sender}.` |
| Foot (every colleague kind) | `Sent through FieldLogicHQ, the software {Club} uses.` plain text, no link, no logo-as-link |
| Coach window statement | `Emails each coach you pick, one email each. Replies come to you at {address}.` (phone: `Emails each coach you pick. Replies come to you.`) |
| Board window statement | `Emails each board member you pick, from the club, one email each. Replies come to you at {address}.` |
| Family window statement (shipped, unchanged) | `Sends one email to each family you choose, from the club, with your address to reply to. A family that opted out of club email is skipped.` |
| Under the message box, **coach window and family window** | `Keep it to the club's own business. Don't use this to sell or promote anything, for you or for a sponsor.` (coach window; the family window keeps its shipped lines) **and** the readers line, corrected per C7: `The club's owner and admins can read this in Communications and see who it reached. League admins and registrars can read it too when it reaches house-league families or coaches.` |
| Under the message box, **board window** (replaces the readers line) | `Everyone you send this to, and the club's owner and admins, can read it afterwards. Leave out a child's or a family's details unless everyone on the board should see them.` then `Keep it to the club's own business. Don't use this to sell or promote anything, for you or for a sponsor.` |
| Board "Everyone" sub line | `Everyone on Organization › The board: owner, admins, league admins, league registrars and treasurer. People with an account only.` |
| Board pick sub line / pick note | `Pick from the people on Organization › The board` / `For this email only. The pick isn't saved.` |
| Foots | `{N} board members get it. You aren't counted.` / `{N} coaches get it. {M} invited coach hasn't accepted yet and won't.` / board: `{M} invited member hasn't accepted yet and won't.` (count only, C1) |
| Record notes | Coach and board: `Sent means the mail service accepted it. It can't tell whether it was read. People are named as they were when it went.` Family (shipped): `Reached counts the families whose email the mail service accepted. An email that bounces later isn't shown here.` |
| Wider coach record, outside names | `{N} rep coaches` with `Names are shown only to people who send to rep coaches` |
| Stopped, reader who may not finish | `{Sender} or an admin can send it to the ones it missed.` |
| Choices | `To families` / `To coaches` / `To the board`, second line as on tab 2 (the board's: `Everyone on the board, or the ones you choose`) |

**Never in any customer-facing word for the board** (window, email, empty state, help, What's new): "notice", "formal notice", "notice of a meeting", "directors", "the club's board of directors". Say "the people who hold a board seat here".

**Do not rely on a words change to fix a fact.** If the product can't make a line true for a recipient (for example no role in `BOARD_ROLES`, no sender address), the send is refused, not the line softened.

**Reason-line rule (C8).** Computed per recipient: a rep-staff member gets the coaching-staff line; a house-league-only coach gets the house-league line; a person who is both gets the coaching-staff line; a "Coaches you pick" send gives every recipient the picked line; the board gives each recipient their own seat. A reason line is never built from the group label.

#### (c) Who may send, who may read: enforced by the SERVER, per route
Navigation is cosmetic. **Every row below is a route test; a hidden button proves nothing.** Applies to every route in the first column: active membership only (`invited` and `suspended` refused, whatever the cookie says); the plan carries that group; the person's Communications switch is on (ruling 11 and ask 5); a member limited to some rep-team groups (`team_limited`) is refused; the refusal body carries no row, name or count.

| Route (by job) | Admitted | Refused (must be tested) |
|---|---|---|
| **Options** (which groups is this seat offered, counts) | whatever the send rules below admit, nothing more | a group the seat was not offered must not appear in the response either |
| **Family send, club door** | owner, admin (the Families grant is **not** required: ruling 4) | league admin, registrar (they use the season window), treasurer, staff, volunteer, coach |
| **"Families from a list" audience** | only a holder of the Families grant (it tells the sender a fact per household) | an admin without the grant posting the audience by hand |
| **Family send, season door** | the house-league `email` right (owner, admin, league admin, registrar) **and** the Communications switch | switch off (ask 5: off means no group email from any screen) |
| **Coach send / count / recount** | owner, admin: every coach group. League admin, registrar: **house-league coaches only**, and a "pick" made only from house-league coaches | a registrar or league admin posting "All coaches", "Rep coaches", any rep coach id in a pick; treasurer and every other seat |
| **Board send / count / recount** | the five board seats (owner, admin, league admin, registrar, treasurer), active, switch on. Audience built on the server | a posted pick containing an id that is not an active board seat; a send where the board is only the sender (N = 0: no choice offered and the route refuses) |
| **List reader** | owner, admin: every row. Others: the rules below | a row the seat may not read is **absent** from the response, not hidden by the screen |
| **Record reader (one email)** | same filter as the list. A row the seat may not read returns **not found, not forbidden**: a refusal would confirm that a board conversation happened without them | |
| **Finish a stopped email / send again** | anyone admitted to send to **that same group now**; for a board email the sender, the owner or an admin only; resend goes back down the path the email came from; **refused once the body has expired** (the clock below) | any seat not admitted; the refusal for a reader who may not names who can ("{Sender} or an admin can send it to the ones it missed.") |
| **"Last sent" line in each window** | filtered by the same read rule (it shows a subject: it must not show a board subject to a non-reader) | |
| **Old `/admin/families/emails` address** | forwards for a person who can't open Families; the destination applies the Communications gate | |

**What each seat may read (the reader holds this; never a hidden column):**
- **Owner, admin:** every row, every named line, every board email (ask 17: they read board mail they were not sent; the board window's line says so).
- **League admin, registrar, family kinds:** every email to a house-league season; every email to Every family or All coaches (house-league people were in it); a coach pick made only from house-league coaches; a message to one family **only if sent from their season** (as the season's own list shows today). **A wider family email: the message and the counts and no names at all** (ask 4; the family record cannot tell which named families are house-league ones). Never: rep teams' families, rep coaches, a pick that includes a rep coach, a Families list, a message to one family sent from Families.
- **League admin, registrar, coach kinds:** their own house-league coaches named; every other recipient is one counted line ("7 rep coaches"). Outside names are absent from the JSON.
- **Admin without the Families book:** the family names (surname, up to three) in Opted out and Didn't go, as a holder of the book sees them (ask 12); **no one-family message rows** (ask 13) and no household record.
- **Board kind (own branch, C2):** readable by the **sender, a recipient (by account id), the owner and the admins, and nobody else**: not a league admin, registrar or treasurer who was not a recipient; not a seat added later unless it is an owner or admin seat. Evaluated at read time: the reader must still be an active member with the switch on; a recipient who has since been suspended or removed reads nothing. A non-recipient gets no row in the list, no record, no subject in "Last sent", no count of board emails.
- **Treasurer's place:** only board emails they sent or received. Empty state: "No board emails yet".

**Names withheld in the reader (not the screen).** The reader builds a per-seat shape: a registrar's wider-family record has **no `optedOutNamed` or `missedNamed` key at all** (today `readClubEmail` returns both to whoever the route admits: `lib/families-emails-log.ts`, route `app/api/admin/families/emails/[sendId]/route.ts`). A test serialises the response and searches it for a surname.

**No-address-fallback rule.** No list, record, picker, audience or count response carries an email address, and a person with no usable name never reads as their address. Required fixes: the one-family row's "To" must not use `personDisplayName`'s address fallback (`lib/families-read.ts:376-379`; used at `lib/families-emails-log.ts:177,189`): such a family reads **"A family"**; a coach with no name reads **"A coach"** plus the team line; a board seat with no name reads **"A board member (treasurer)"** (role alone). The recipients' `family_name` is a surname or null and is never an address (`lib/families-audience.ts:286-288`); a null name counts instead of naming (`lib/families-words.ts:490-494`). Note `boardNames` leaves a nameless member out; the **send-side read must not**, or N would not match who was emailed.

**Pending and suspended.** Pending (invited, not accepted) is left out of N and of the send; named in "See who gets it" to an owner or admin sender only; counted in the foot for everyone; to any other seat a count only (the board tab does not show pending people, so naming one would disclose it). Suspended is never emailed, never counted, never named, never "left out": suspension is not shown on the board tab. House-league coaches are included whether or not they have signed in (as their copies do today); invited rep coaches are left out and named (to the seats that may see rep names).

#### (d) What the logs store, and must not store
**Store:** sender account id; the kind and group label; the group's parameters (season, division, picked ids); the subject and the body (**each in its own column or row so a body can be blanked while the who-and-when stays**); counts and status; timestamps; for each recipient: the **id of the source row** (account id; for a house-league coach with no account, the coach row id), the **name as it was at send time**, the **role or team line** at send time (the board: role at send time), and `status` (`sent` = the mail service accepted it; `didn't go`). **Left-out people** (pending, no email on file): a count only.

**Must not store, anywhere (table, log line, error, provider-error echo):**
1. **Any recipient's email address** in the new tables or in the record. A resend resolves the address from the source row at send time (so a corrected address is honoured and a stale one is not kept). The existing `family_email_recipients` already keeps people and surname, never addresses; the new tables follow it.
2. **The sender's address** (it is the account's; read it live for Reply-To).
3. The recipient's **IP, device, or any open or click data**.
4. **A rendered copy per recipient**: the body is stored once.
5. **Guardian, family, child or player data** in a coach or board record.
6. **The body or an address in a console or server log.** A send failure logs the send id and the club id only (the provider's error text can echo an address).
7. The names of people **left out** (pending, suspended, no address).

**The clock.** Nothing in these tables lives forever by accident: see §4. The new tables cascade with the organization (as `family_email_recipients` does with its send), so deleting an organization removes them.

#### (e) Tests the build must include (one assertion each)
| # | Test | Assertion |
|---|---|---|
| T1 | colleague guard, rendered | Every colleague kind (rep staff, house-league, picked, board × each `BOARD_ROLES` role) renders with zero links, zero commercial words, the exact foot, the exact From name, the sender line, the removal line. |
| T2 | colleague guard, words | The words file contains none of the banned words and no plan name or price from `plan-config.ts`. |
| T3 | reason lines are true | Each recipient's reason line follows their own basis (C8); the board line is built from the recipient's own role; a role outside `BOARD_ROLES` throws. |
| T4 | colleague import allowlist | The colleague sender imports only the allowed modules and, from `email-club-identity`, only `familySenderName` and `platformLineWords`; it never imports `families-email`, a family footer, an unsubscribe builder or `clubBand`. |
| T5 | board audience import rule | The board audience builder imports no `families-*` module and reads only `organization_members` (and account names). |
| T6 | family manifest guard | `family-email-guard.test.ts` still passes unedited, and its drift heuristic does not flag the new colleague senders. |
| T7 | never both paths | A request naming a family audience and a coach or board audience is refused by both routes; the family route refuses a coach or board kind; the colleague route refuses a family audience; nothing is sent in any. |
| T8 | envelope shape | Each colleague message has exactly one To and no Cc or Bcc; Reply-To is the sender's address; no `unsubscribe` text or header from the family builders. |
| T9 | seat table | Table-driven: every seat (owner, admin, league admin, registrar, treasurer, staff, volunteer, coach, team-limited member, suspended, invited, switch off, plan without the group) against every route in §2c is admitted or refused as the table says. |
| T10 | a group not offered | A registrar posting "All coaches", "Rep coaches" or a rep id in a pick is refused; a registrar or league admin posting "Every family" through the club door is refused; an admin without the Families grant posting a Families-list audience is refused. |
| T11 | switch off | With Communications off, the club window, the season window, the Families-list button route and every read route refuse; the same person still **receives** board mail. |
| T12 | no names on a wider family row | A registrar's record of an "Every family" email has no named-lines keys, and the serialised JSON contains none of the seeded surnames. |
| T13 | wider coach row | A registrar's record of an "All coaches" email names only their house-league coaches; the serialised JSON contains no rep coach's name. |
| T14 | board read rule | A non-recipient registrar, league admin or treasurer gets no row in the list, not found in the record, no subject in Last sent; the sender, a recipient, an owner and an admin read it; a seat added later reads it only if owner or admin; a suspended recipient reads nothing. |
| T15 | board audience | Suspended and invited members are in neither N nor the recipients; the sender is not counted; a nameless seat is counted and emailed; N = 0 offers no "To the board" and the route refuses. |
| T16 | pending naming | Pending is named in "See who gets it" to an owner or admin sender only, counted for everyone else; a suspended member appears in no response. |
| T17 | no address anywhere | The serialised JSON of options, counts, recount, list and record responses contains no `@` for a nameless family, coach or board seat; those read "A family", "A coach", "A board member (treasurer)". |
| T18 | no address stored | The new recipients tables have no email column and an insert carrying an address is rejected or ignored; the log row keeps no sender address. |
| T19 | separable body | The body is stored apart from the who-and-when so that blanking it leaves the recipients; "Send again" copies the subject only and opens an empty message. |
| T20 | recount | A swap with the same total is held, nothing is sent, and the response names who changed (up to three). |
| T21 | no sender address | A sender with no usable address is refused and nothing is sent. |
| T22 | lines present | Each of the three windows' words contains its under-the-box lines (readers line or board line, plus the not-to-promote line where drawn); the readers line says nothing about names for a registrar (C7). |
| T23 | old address | `/admin/families/emails` forwards for a person who cannot open Families, and lands on the Communications gate, not a 404. |
| T24 | clock (if built in Stage 1) | The scheduled job blanks bodies and subjects older than the body clock and recipient names older than the names clock, leaves counts, sender and date, and never touches a row newer than the clock. |
| T25 | resend after expiry | A stopped email whose body has expired cannot be finished and says so in plain words. |
| T26 | dictionary | `npm run check:dictionary` passes with the new tables and the corrected `family_email_sends` sentence (the repo's schema = dictionary rule). |

---

### 3. What must NOT ship in Stage 1
1. **One message down both paths**, or any tick-across window. A mixed send is Stage 2 and has its own question list above.
2. **Any link in colleague mail**: including an "Open in Communications" link, an unsubscribe link, a logo or brand link, a link in the reason, removal or foot line. (A link the sender types in their own body is the sender's; the line under the box carries that risk. Do not strip links in the body and do not add any of ours.)
3. **Listing a coach's own team emails to families** (`rep_team_announcements`), the automatic notices, the fixed-wording coach sends (Ask the coaches, Send the schedule, reminder waves) or tournament announcements as rows. Those are Stage 3 and need the questions above settled first.
4. **Any address** in a list, record, picker, audience, count or recount, or a log row; an address fallback for a nameless person.
5. **Names on a registrar's or league admin's wider family row**, or rep coaches' names on their screen.
6. **Board mail readable by any board seat that was not a recipient**, or visible to a league admin or registrar through the program rule.
7. **The board computed from anything other than active member seats**: no directors with no account, no typed address, no volunteer, no guardian (that is Stage 4, and conditions (a), (e), (f) re-run then).
8. **A mute, off switch or personal unsubscribe for receiving board or coach mail**: the seat is the membership (ask 19) and the way off is the removal line. Do not add a half-unsubscribe to colleague mail; it implies a CEM and a promise nobody honours.
9. **"Notice", "formal notice" or "directors" language** for the board anywhere (§2b).
10. **A daily allowance on coach or board mail**, an allowance on the family path changed, or any change to the family unsubscribe, suppression or Reply-To.
11. **Open or click tracking, read receipts, BCC copies, saved lists, attachments, send later.**
12. **Any change to the existing colleague sends' From name** (Ask the coaches, the schedule send, head-coach copies): the coach drawing's ask 9 limits the new name to this send.
13. **A policy, Terms or help sentence about the sent-email log published before the clock is real** (§4).

---

### 4. Documents owed, and when

| Document | What | When |
|---|---|---|
| **Privacy policy §5 and §9** (draft v0.4) | The two sentences below, written into `drafts/PRIVACY_POLICY.md` as part of the Stage 1 unit of work (before hand-off), with the owner-decided lengths filled in. **Published with the promote that puts the clock on production** (the same way the friend-request text and the attendance text were "publish with the promote"); never earlier. | Before the Stage 1 hand-off to `/review`; publication with 6.7 or the promote, whichever is later |
| **Retention clock** | Owner decides the lengths (below); the clock is **built in Stage 1's migrations as a scheduled job**, not left to `/plan` as a later stage, because it covers the new tables. | Decided before the build prompt is written; built with the new tables |
| **Data dictionary** | Replace the stale sentence under `family_email_sends` ("NEVER a list of families or addresses", owner 2026-10-22: superseded by 9d-1, which added `family_email_recipients` with surname and person ids) with: it keeps counts, and per recipient (in `family_email_recipients`) the people and the last name, **never an address**. Add the coach and board log tables: columns, recipients keyed by source-row id with name and role or team line as sent, no address column, the separable body, the read rules, the clock. Run `npm run refresh:snapshots` (dev and prod). | Same unit of work as the migration (`npm run check:dictionary` fails otherwise) |
| **Help articles** (`/docs`) | The Emails article moves under Communications. It must say an admin **no longer needs the Families book to email families** and must **not** say admins can open household records; must not call board email "formal notice", "notice of a meeting" or notice to directors ("a message to the people who hold a board seat here"; a club's governance notices are its own obligation); must say who can read a sent email (the readers line, corrected); must not say board mail can be turned off or that a board member can opt out (they reply to the sender); must not say "no one sees an email address" (say names only) and must say replies go to the sender. | After the build, before hand-off; the Communications article is one of the help topics (N12) |
| **Club data-processing terms** | Still not started. Owed **before the club tier goes on sale**, not before this promote. They must list **sent-email records** (subject, message, who it reached by name and role or family surname, counts) as a category the club controls, with the seat rules above as the club's configuration, and say FieldLogicHQ reads a body only to support the club on request. | Before the club tier is on sale |
| **Terms** | No change (§5 already forbids commercial email that does not meet CASL). | n/a |
| **`/legal` as-built review** | Read the finished code against §2 before hand-off (CLAUDE.md: a change to what the product collects, tells people, or emails runs `/legal` before hand-off). The checks that matter: the §2c route table, the JSON tests, the guard samples, the three window lines. | Before hand-off |

**The two privacy sentences (draft; filled lengths in `{ }` are the owner's call, my recommended defaults shown).**
- **§5, after "messages" in what a club may keep (a new short paragraph):** "**Emails a club sends through FieldLogicHQ.** When a club emails its families, its coaches or its board through FieldLogicHQ, we keep a record of the email in the club's account: who sent it, when, which group it went to, its subject and message, and how many people it reached. For an email to coaches or to the board the record also keeps the name and role (or team) of each person it went to, as they were when it was sent; for an email to families it keeps the last name of each family it did not reach or that had opted out. The record does not hold anyone's email address (our email provider holds addresses to deliver the email: §6). Only the club's people the club has allowed to use Communications can read it, and what each can read depends on their role: someone who runs one program sees only the emails that reached that program's people, and an email to the board can be read only by the person who sent it, the people it went to, and the club's owner and admins."
- **§9, a new bullet:** "**Emails a club sends** (§5): the subject and message are deleted {12 months} after the email is sent, and the names of the people it went to {24 months} after; the date, sender, group and counts are kept while the organization exists. Deleting an organization deletes these records with it. Copies in our routine database backups age out on our database host's schedule."
- Spelling gate: these obey `npm run check:spelling`. No bracketed blank is left in customer text (the preview filter turns a bare `[text]` into a "to be filled" marker).

**The retention clock: what the owner must decide, and the default I recommend.**
1. **How long the words live.** *Recommended default: subject and message 12 months after the send; the names and roles of recipients 24 months; the sender, date, group and counts for as long as the organization exists.* Reasons: the record's jobs are to stop a double send (days), to answer "what did we tell people this season" (a season, 12 months covers the next season's look-back) and to chase a bounce (days); the words are the only part that can hold a child's details or a board dispute, so they expire first; recipients' names are low sensitivity but identify who was contacted, so they go second; counts are not personal information. PIPEDA 4.5.3 asks for a stated limit and destruction procedures; every other short-lived record in §9 is 30 to 90 days or one season.
2. **Whether board bodies get a shorter clock than other bodies.** *Recommend one clock now, bodies separable* (ask 5 of the board addendum), so the owner can shorten the board's later without a rebuild.
3. **Automatic or by hand.** *Recommend automatic, a nightly scheduled job* in the same migrations as the tables, as migration 472 does for friend requests. A by-hand step turns §9's "deleted" into "may be deleted" (privacy draft finding 1) and a policy that says "deleted" while nothing deletes is the defect this agent is told to stop.
4. **Existing family logs.** The same clock covers `family_email_sends` and `family_email_recipients` and the one-household message record's content (the one-household record keeps a date, sender and person, not words, so its clock is the household's). **The first run blanks the words of every family email older than the clock.** The owner should know that before the migration, and the family "send to the ones it missed" door must refuse once the body is gone (T25).
5. **Backups.** Do not state a backup period in the sentence (same open question as finding 2 of the privacy draft's notes).

---

### 5. Release gate: may Stage 1's code reach production before the privacy sentence and the retention clock exist?
**No.** Same reasoning as friend requests (the retention rule and the policy text travelled with the code that created the data, migrations 471 and 472 and §5/§9 text "publish with the promote"). Stage 1 creates two **new** stores of free text and names (the coach log and the board log), and it widens who can read the existing family log. With no clock they would be the least-limited records in the product holding the most sensitive free text the product keeps (board bodies), and with no sentence a club's staff would be writing into a record whose existence the policy does not mention (PIPEDA 4.1.4 openness, 4.5.3 retention).

Three things must be true on the day the code reaches production: (1) the **owner has decided the clock** (§4); (2) **the clock exists as a scheduled job in Stage 1's migrations** covering the new tables and the existing family log; (3) **the §5/§9 sentences are written into the policy draft** (v0.4) and publish with the promote. The privacy policy page itself being unpublished does not by itself hold the promote (nothing is sold and no policy is yet published, so no promise exists to break), but this code is not exempt: Communications rides the League Plus and Club plans, so the first paying club on those plans would use it on day one. The one narrow exception: a promote in which Communications is **not reachable and no write path to the new tables is live** (the place switched off for every role) may ride, because it creates no record; it is not a way around the gate once the place is on.

The dictionary correction is not a gate (it is a build step; `check:dictionary` fails the build without it). The club data-processing terms are a gate for the **club tier going on sale**, not for this promote.

### Lawyer's eye needed? (for this section)
No for Stage 1 as ruled and as written here. Unchanged from above: whether volunteer house-league coaches are "representatives" for the s.3(a)(i) fallback (the design basis is s.1(2), not a CEM), and whether an unlinked brand line in the foot is promotion; a lawyer should read Stage 3 before it is built.

---

## Addendum 2026-11-17 — Replies to the club, a copy to the club's inbox (owner rulings R1–R4)
**Last verified:** 2026-11-17. Reasoned from `CASL_COACH_GROUP_EMAIL.md` (s.1(2), s.6, SOR/2013-221 s.3 as read 2026-11-16; nothing here turns on a provision not read then) and the code: `lib/email-club-identity.ts` `familyReplyPlan` (the shipped "system" reply line "Reply to this email to reach {Club}."), `lib/club-email-context.ts:105` `clubPublicContact` (the club's public-site contact address, `usableContactEmail`), `lib/families-email-coaches.ts:63-72` (the head-coach copy names the sender in its outro and replies to the sender). **Re-verify by:** the checklist's triggers, plus any address other than the club's public contact becoming a reply or copy target.

**The rulings (plan §1, 2026-11-17):** R1 a sender with no name is refused. R2 replies go to the club's public contact by default and the email names the club, not the person; the sender may switch to "Replies come to me"; a club with no public contact replies to the sender. R3 the same choice in all three windows (families, coaches, the board). R4 no typed CC or BCC; a "Send a copy to the club's inbox" tick instead.

### Findings
1. **Colleague mail in club mode is still not a CEM, and the fallback still holds.** s.1(2) turns on content, links and contact details, not on whether a person is named; naming the club instead of the person changes neither. SOR/2013-221 s.3(a)(i) asks whether the message is *sent by* a representative to another representative about the organization's activities: a fact about who pressed Send (kept in the record), not a line the email must print. If it were read as a CEM, s.6(2) identification is of the person sending and the person on whose behalf it is sent, with contact details valid for 60 days; "{Club} sent this." identifies the club, and the club's published address is a more durable contact than a volunteer's own mailbox. No blocker.
2. **Family mail's Reply-To may change; nothing else in the family envelope may.** Checklist §2a.2 and §3 item 10 ("Reply-To exactly as shipped") are **amended by R2/R3 for the Reply-To and the reply line only**. In club mode the family reply line is the shipped system variant, "Reply to this email to reach {Club}.". Unsubscribe, opt-out suppression, 3 in 24 hours, footer and band stay exactly as shipped. CASL s.6(2)(b) contact information is the envelope's job and the envelope does not change.
3. **The choice governs every message one send produces**: the family copies, the head-coach copies of a family email (today their outro names the sender and they reply to the sender, `lib/families-email-coaches.ts:70`), and the club-inbox copy. In club mode a head-coach copy replies to the club and its outro names the club. A send that names the sender to some of its recipients and the club to others must not ship.
4. **The pick's reason line named the sender** ("You get it because {Sender} picked you."). In club mode it reads "You get it because {Club} picked you for this email.". Other reason lines and the board line are unchanged.
5. **"No usable sender address, no send" (§2a.8) becomes "no usable reply target, no send".** Club mode needs the club's public contact (and is not offered without one: R2's fallback); "Replies come to me" needs the sender's own usable address. **R1 (no name, refused)** is the owner's product rule; in club mode no line of the email uses the sender's name, so its basis is the record's By fact and the "me" switch. Recorded as ruled.
6. **The board.** Board mail is read in FieldLogicHQ only by its sender, its recipients, and the owner and admins (ask 17), and the board line under the box says so. The club's public contact is often a shared mailbox (a webmaster, a volunteer registrar). **(a) A club-inbox copy of a board email** puts the whole message in a mailbox outside that read rule and makes the board line false: **it must not be offered on board email.** (b) Replies to a board email in club mode land in the same shared mailbox; that is the replier's own choice of what to write, and the window and the email both say where replies go, so it is lawful. **Owner question (not a blocker): should the board window open on "Replies come to me"?** Recommended yes; the default stays club, as ruled, until the owner says otherwise.
7. **The club-inbox copy (R4) is the club's own mail to itself**, sent by us as its service provider to an address the club published; no consent question arises. It must be: one message, one To (the club's public contact), no Cc or Bcc; **built as a colleague copy, never with the family envelope** (a family unsubscribe link in it would be keyed to no family or the wrong one; model it on the head-coach copy: a lead naming the group and count, the subject, the message, no link of ours, no recipient names, no addresses); **not a recipient** (not in N, Reached, "Who it went to" or any recount); **recorded as a fact, never the address** (a mark that a copy was asked for and whether it went; the address is read live at send time); **skipped** when the contact is already a recipient of that send, which the record says; offered on family and coach email only (6a). §2a.9 reworded below.
8. **Privacy §5 needs no new sentence for R2/R4.** "Who sent it" is still kept; the record holds no address (the copy is a mark, the reply target is read live). Optional, not owed: "and, when the sender asks, a copy to the club's own email address".

### The corrected fixed-string table (replaces the matching rows of checklist §2b; other rows unchanged)
| Where | Club mode (default when the club has a public contact) | "Replies come to me" (and every send from a club with no contact) |
|---|---|---|
| Reply-To | the club's public contact (`clubPublicContact`) | the sender's account address |
| Sender line (every colleague kind) | `{Club} sent this.` | `{Sender} ({Role}, {Club}) sent this.` |
| Reply line | `Reply to this email to reach {Club}.` | `Reply to this email to reach {Sender}.` |
| Removal line | `Not right for you? Reply and tell {Club}.` | `Not right for you? Reply and tell {Sender}.` |
| Reason line, a picked coach | `You get it because {Club} picked you for this email.` | `You get it because {Sender} picked you.` |
| Coach window statement | `Emails each coach you pick, one email each. Replies go to {Club} at {club address}.` (phone: `… Replies go to the club.`) | `Emails each coach you pick, one email each. Replies come to you at {address}.` (phone: `… Replies come to you.`) |
| Board window statement | `Emails each board member you pick, from the club, one email each. Replies go to {Club} at {club address}.` | `Emails each board member you pick, from the club, one email each. Replies come to you at {address}.` |
| Family window statement | `Sends one email to each family you choose, from the club, with the club's address to reply to. A family that opted out of club email is skipped.` | shipped, unchanged |
| Family reply line (envelope) | `Reply to this email to reach {Club}.` (shipped system variant) | shipped, unchanged |
| Head-coach copy of a family email | replies to the club; outro names `{Club}` | shipped, unchanged |
| The switch (window) | labelled by where replies go: `Replies go to {Club}` / `Replies come to me`; not shown when the club has no public contact | |
| The copy tick (family, coach windows) | `Send a copy to the club's inbox ({club address})`; not shown without a public contact; never on the board window | |
| Record facts | `A copy went to the club's inbox.` / `A copy to the club's inbox didn't go.` / `The club's inbox was already on the list.`; plus `Replies went to {Club}` or `Replies went to {Sender}` | |

The build guard pins the sender, reply, removal and reason lines **in both modes**, exactly.

**§2a.9 reworded:** "The sender is never counted and never gets a copy as a recipient. Recipients are de-duplicated by trimmed lower-cased address (coaches) or account id (board). The only extra message a send may produce is the club-inbox copy (R4), which is not a recipient and is not counted."

### Test changes
- **T1:** every colleague kind renders in **both** modes; in club mode no sender name appears in anything the product adds, and the picked reason line names the club.
- **T8:** Reply-To is the club's contact in club mode and the sender's address in me mode; the club-inbox copy is its own message with exactly one To, no Cc or Bcc.
- **T21** becomes "no usable reply target": me mode with no sender address is refused; club mode whose contact is gone at Send is refused, not silently switched.
- **T22:** each window's statement in both modes.
- **New T27 (the inbox copy):** no family envelope words or unsubscribe, no link; not counted or listed; refused on board kinds; recorded with no address; skipped when the contact is a recipient.
- **New T28 (one mode per send):** in club mode no message of the send (family copies, head-coach copies, the inbox copy) names the sender or replies to them. `family-email-guard.test.ts` still passes unedited (T6).

### Must not ship (adds to §3)
14. A reply target or copy address other than the club's public contact or the sender's own account address (including any typed address, R4).
15. A club-inbox copy of a board email.
16. A send that mixes modes across its messages.
17. The club's contact address stored in a log row, or returned in a list, record or recount response. (The window's statement may show it, as it shows the sender's own address; the club published it.)
18. A club-inbox copy built from the family envelope.

### Lawyer's eye needed? (for this addendum)
No. Unchanged from the sections above.
