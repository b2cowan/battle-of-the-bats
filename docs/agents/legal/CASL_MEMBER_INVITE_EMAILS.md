# The club's member invitations — CASL and what they promise
**Last verified:** 2026-11-07; run-out build reviewed 2026-11-18 (code-time) (applies the CASL text read 2026-11-06 for `CASL_SECOND_PARENT_EMAIL.md` — s.1(2), s.6(1),
s.6(2), s.6(6) — to these two emails; no new source opened)
**Re-verify by:** 2026-11-07 + 12 months, or a trigger: either email gains a plan name, a price, an offer or a link to pricing
or sign-up; the invite starts going to people with no role (e.g. "tell a friend"); Bill C-36 / CASL amendments.
**Depends on facts:** `LEGAL_FACTS.md` § FieldLogicHQ's two privacy roles; § Where data lives (Resend).

> **2026-11-18 — trust close-out 13 (code-time review, no re-research):** an existing confirmed account is now INVITED,
> never added on the spot. It gets the invite template's existing-account form ("You already have a FieldLogicHQ account,
> so there’s nothing to set up. Sign in, then accept or decline the invitation on your Home page. Nothing changes until you
> accept.", button "Sign in to accept", link a plain sign-in to Home). Still not a CEM: no offer, price, plan or sign-up
> link, and it is plainer than the new-account invite. **Updated 2026-11-18 (P2b, owner ruling): the "added" email is
> RETIRED, no sender remains.** A club's own coach offered a board role gets this same existing-account invitation with
> `keepsCoaching`: first line "{Inviter} invited you to be a {role} at {club} on FieldLogicHQ.", and the "next" paragraph ends
> "Nothing changes until you accept. Your coaching stays as it is either way." Home's card reads "{Club} invited you to be
> its {Role}" and "You keep coaching either way." **Reviewed 2026-11-18: still not a CEM** (no plan, price, offer or
> sign-up link; plainer than the new-account invite, and the reader already holds the account and the role relationship);
> no privacy finding (the inviter's name and role-in-club and the role's access sentence were already shown to every
> existing-account invitee; a coach is already in the club). Declining tells the club (separate change). Cancelling a pending invitation
> sends no email. Accepting from Home records no new Terms tick (the account agreed at its own sign-up). Unaccepted
> invitations sit on existing accounts too (recommendation 3 was wider, not new); **they now run out and are removed, built later the same day (see "An ignored invitation stays")**.

## Question(s) this answers
Are the club's member-invitation emails (new account: "You're invited"; existing account: "You're invited" in its
existing-account form since 2026-11-18, before that "You've been added to …", now retired), with
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
  would fit (d), factual notice of a membership or account (that "added" email no longer exists, 2026-11-18).
- **Roles (keep apart).** The club decides who is invited and supplies the address. FieldLogicHQ sends it and "causes or
  permits" the send. The invitee's address is the club's collection, and the email itself is the notice that names the club
  and, when known, the person who sent it.

## What the product does today
Checked 2026-11-07 against the Stage 13b Session B build: `lib/email.ts` `orgInviteHtml` (`orgMemberAddedHtml` retired 2026-11-18),
`ORG_INVITE_EMAIL_WORDS`; the shared envelope `wrap()` → `warmEmailDocument` with no club band, so **no** promotional footer
and no platform line; `app/api/admin/members/invite/route.ts`; `lib/invite-links.ts` (resend uses the same template).
- **The role's sentence is true at send time.** The picker offers a role only where the plan carries its program (treasurer
  only with Accounting, `lib/board-roles.ts:78`). The sentence is the accept page's own (`memberOpensSentence`). The "added"
  email is gone (2026-11-18): every existing account, a club's own coach included, is invited and nothing changes until
  they accept, so "Nothing changes until you accept" and "Your coaching stays as it is either way" are true as built (guards:
  `tests/unit/existing-account-invite-guard.test.ts`, `club-stage13b-arrival-guard.test.ts`).
- **The product line is a claim about each sender.** "…the online system {club} uses to manage registration, schedules and
  results" is not true of every org that can send it: a club using only some programs, and possibly a one-team workspace,
  if that workspace's Staff & access uses this invite (not checked). The family emails already describe the product as
  "Sent through FieldLogicHQ, the software {club} uses." (`lib/email-club-identity.ts:224`), which is true for every sender.
- **Reply-To is not an inbox** (pre-existing, recorded in memory 2026-09-26): an invitee who replies "is this real?" reaches
  nobody.
- **An ignored invitation stays.** The new-account invite creates an unconfirmed account and a pending membership holding the
  address (`invite/route.ts`, `generateLink` then the `invited` insert). "You can safely ignore this email" is true for the
  reader (nothing is charged or sent). **Checked 2026-11-18:** nothing ever removes an unaccepted invitation, and since
  trust close-out 13 an existing account's invitation is a pending row too (it holds a seat and sends its reader to Home at
  each sign-in until they act). **Ruled 2026-11-18 (owner, recommendation 3 taken); BUILT 2026-11-18 (Board Ready trust
  queue P2c; `lib/invitation-lapse.ts`, `lib/invitation-sweep.ts`; built and proved on dev, uncommitted when reviewed):** an
  unaccepted invitation runs out 30 days after it was last sent (a Resend restarts it): no seat, off Home, refused at both
  accept doors ("This invitation has run out. Ask {club} to send it again."), shown on Members as "Invitation ran out" with
  Resend and Cancel. A nightly sweep removes it 30 days after that (the pending row; a coach's waiting board role is cleared,
  the coaching kept) and deletes the sign-in account only if never confirmed, never signed in to, used for nothing else and
  made by this club's first invitation, re-read just before the delete; any doubt keeps it. Each removal writes the club audit
  line "Invitation removed after it ran out" with the address (as Cancel does). **The sweep's schedule is NOT switched on in
  production (owner's go owed): the live privacy policy says nothing about invitations and stays silent; the §9 bullet in
  `drafts/PRIVACY_POLICY.md` (0.3) publishes only once the schedule has run on production.**

## Review of the run-out build (2026-11-18, code-time, no re-research)
1. **No CASL issue.** The run-out wording adds no commercial content; no email is sent on run-out or removal; the Resend
   notice ("It stays open for 30 days.") and the expired-link screen are service text to a person the club named. "Ask {club}
   to send it again" points to the sender, not to FieldLogicHQ pricing or sign-up: fine (a pointer back to the club is what
   keeps it non-commercial).
2. **No disclosure to a non-invitee.** The club name on the expired-link screen comes from the link's own `org` parameter
   (club names are public pages); the run-out refusals at the two accept doors need the invitee's own session or link; the
   Resend notice and "Invitation ran out" show only to the club's admins. Nothing says who else was invited. Low, no action.
3. **The audit line keeps the address of a person whose never-used account is deleted. Keep it** (Low): it is the club's own
   record of an address the club typed and the same line Cancel writes today; dropping it would make "who did we invite?"
   unanswerable and would be inconsistent with every other `member_removed` line. The cost is real but small (an email
   address, no account, club-owner-readable only, no new use). The honesty fix is in the privacy draft's §9 bullet (the line
   is named, and kept while the organization exists); the append-only log means an invitee's erasure request cannot reach it
   (same class as backlog L16; route to `/plan` only if the owner wants a purge clock on `org_audit_log` payload emails).
4. **Privacy policy:** live 2026-11-17 text needs NO change now (silent on unaccepted invitations; "your account is kept while
   it is open" stays true). Draft 0.3 adds a §9 bullet, conditional on the sweep being scheduled and run on production.
5. **Soft spot (UX, not law):** the expired-link screen's "Set a password" goes to forgot-password; after the sweep deletes the
   never-used account, that path has no account to reset. The wording ("If it has run out, ask them to send it again") covers
   it; confirm forgot-password's reply does not name whether an account exists.

## Recommendation
1. CASL: no change needed. Keep both emails free of commercial content. A guard that fails the build when either template
   gains a plan name, price or pricing/sign-up link would hold this for free.
2. The product line: make it true for every sender. Either "FieldLogicHQ is the online system {club} uses for things like
   registration, schedules and results." (keeps /marketing's nouns), or reuse the family emails' "the software {club} uses".
   Exposure is low either way (not a contract term, no commercial representation). Prefer the first for the anti-scam purpose.
3. Pre-existing, for the owner: the Reply-To that reaches nobody. Retention of unaccepted invitations: **built 2026-11-18**
   (see above and the review); the privacy policy may say they are removed only once the nightly sweep is scheduled and has
   run on production.

## Sources
- [Canada's Anti-Spam Legislation (S.C. 2010, c. 23) — s.1(2), s.6(1), s.6(2), s.6(6)](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html) — accessed 2026-11-06 (via `CASL_SECOND_PARENT_EMAIL.md`)

## Lawyer's eye needed?
No, for these emails as built. Yes if either one ever carries an offer or a link to buy (then the new-account invite needs a
consent basis it does not have).
