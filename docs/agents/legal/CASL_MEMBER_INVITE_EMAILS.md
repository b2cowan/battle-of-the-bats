# The club's member invitations — CASL and what they promise
**Last verified:** 2026-11-07 (applies the CASL text read 2026-11-06 for `CASL_SECOND_PARENT_EMAIL.md` — s.1(2), s.6(1),
s.6(2), s.6(6) — to these two emails; no new source opened)
**Re-verify by:** 2026-11-07 + 12 months, or a trigger: either email gains a plan name, a price, an offer or a link to pricing
or sign-up; the invite starts going to people with no role (e.g. "tell a friend"); Bill C-36 / CASL amendments.
**Depends on facts:** `LEGAL_FACTS.md` § FieldLogicHQ's two privacy roles; § Where data lives (Resend).

## Question(s) this answers
Are the club's member-invitation emails (new account: "You're invited"; existing account: "You've been added to …"), with
Club Tier Stage 13b's additions (the role's sentence, one line on what FieldLogicHQ is, the role's own name, the link landing
on the role's home), still outside CASL's consent rules? Do any of their lines promise what the product does not do?

## Finding
- **Not a commercial electronic message.** s.1(2) asks whether, reading the content, links and contact details, one purpose
  is to encourage participation in a commercial activity. These emails ask a named person to take up a role the club gave
  them (treasurer, admin, volunteer…) on the club's own account. Nothing is offered for sale and nothing links to pricing or
  sign-up. A line saying what FieldLogicHQ *is*, with no offer and no plan, identifies the sender; it does not promote. So
  consent (s.6(1)(a)) and the unsubscribe and identification content (s.6(2)) are not engaged.
- **The condition that keeps it so:** no plan name, price, "try FieldLogicHQ for your own club" line, or link to the pricing
  or sign-up pages, in either email. If one were added, the new-account invite would have no clean s.6(6) door (the recipient
  has no relationship yet; (b), (d) and (f) are all about the recipient's own transaction or relationship). The "added" email
  would fit (d), factual notice of a membership or account.
- **Roles (keep apart).** The club decides who is invited and supplies the address. FieldLogicHQ sends it and "causes or
  permits" the send. The invitee's address is the club's collection, and the email itself is the notice that names the club
  and, when known, the person who sent it.

## What the product does today
Checked 2026-11-07 against the Stage 13b Session B build: `lib/email.ts` `orgInviteHtml`, `orgMemberAddedHtml`,
`ORG_INVITE_EMAIL_WORDS`; the shared envelope `wrap()` → `warmEmailDocument` with no club band, so **no** promotional footer
and no platform line; `app/api/admin/members/invite/route.ts`; `lib/invite-links.ts` (resend uses the same template).
- **The role's sentence is true at send time.** The picker offers a role only where the plan carries its program (treasurer
  only with Accounting, `lib/board-roles.ts:78`). The sentence is the accept page's own (`memberOpensSentence`). The "added"
  email's "You'll" is true: the membership is written before the email goes.
- **The product line is a claim about each sender.** "…the online system {club} uses to manage registration, schedules and
  results" is not true of every org that can send it: a club using only some programs, and possibly a one-team workspace,
  if that workspace's Staff & access uses this invite (not checked). The family emails already describe the product as
  "Sent through FieldLogicHQ, the software {club} uses." (`lib/email-club-identity.ts:224`), which is true for every sender.
- **Reply-To is not an inbox** (pre-existing, recorded in memory 2026-09-26): an invitee who replies "is this real?" reaches
  nobody.
- **An ignored invitation stays.** The new-account invite creates an unconfirmed account and a pending membership holding the
  address (`invite/route.ts`, `generateLink` then the `invited` insert). "You can safely ignore this email" is true for the
  reader (nothing is charged or sent). **Not checked:** whether anything ever removes an unaccepted invitation.

## Recommendation
1. CASL: no change needed. Keep both emails free of commercial content. A guard that fails the build when either template
   gains a plan name, price or pricing/sign-up link would hold this for free.
2. The product line: make it true for every sender. Either "FieldLogicHQ is the online system {club} uses for things like
   registration, schedules and results." (keeps /marketing's nouns), or reuse the family emails' "the software {club} uses".
   Exposure is low either way (not a contract term, no commercial representation). Prefer the first for the anti-scam purpose.
3. Pre-existing, for the owner: the Reply-To that reaches nobody, and the retention of unaccepted invitations (backlog L9).
   The privacy policy draft must not say unaccepted invitations are deleted unless a build makes that true.

## Sources
- [Canada's Anti-Spam Legislation (S.C. 2010, c. 23) — s.1(2), s.6(1), s.6(2), s.6(6)](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html) — accessed 2026-11-06 (via `CASL_SECOND_PARENT_EMAIL.md`)

## Lawyer's eye needed?
No, for these emails as built. Yes if either one ever carries an offer or a link to buy (then the new-account invite needs a
consent basis it does not have).
