# Guardian consent and privacy words — Signed-in family accounts, Stage 4 — DRAFT

| | |
|---|---|
| **Version** | 0.1 |
| **Status** | draft — not owner-approved, not reviewed by a lawyer, not rendered by the product |
| **Effective date** | — (not published) |
| **Last reviewed** | 2026-11-08 |
| **Backlog** | L5 (children's consent wording), L6 (CASL line) |
| **Replaces** | the placeholder in `lib/family-guardian-consent.ts` once the owner approves and the build adopts it |

**Change log:** 0.1 (2026-11-08, later) the parked Terms line in (a) written, after Terms v0.2's O7 and O5 (every account holder is 18 or
older and accepts one set of Terms); "no child holds a login" still reads true beside O5. 0.1 (2026-11-08) first draft for the Stage 4 drawings (`docs/projects/active/SIGNED_IN_FAMILY_STAGE4_DRAWINGS.html`,
tabs 1, 2, 3, 5). Braces are filled by the product: {child} first name, {club} the club's name, {coach}, {email}, {contact} the
club's contact email, {first parent} full name of the parent who added the address.

**Closeout read, Stage 4a Session 2 (Parts 4–5), 2026-11-08** — the shipped words (`lib/family-invitation-words.ts`,
`lib/family-guardian-consent.ts`) read against this draft. No shipped sentence is untrue, so no product word changed. Answers:
1. **Second parent's fine print without draft (c)'s first sentence: acceptable.** The drawn who-added line ("{first parent} added your
   email to {child}'s sign-up so you get the same updates") sits in the same email, directly under the greeting, and says the same
   thing (who, whose sign-up). Condition kept: it must always render in that copy (`whoAddedHtml` is in the one second-parent
   builder); if it is ever removed, restore the sentence in the fine print.
2. **Coach team's rep invitation prints no mailing address (O4): acceptable.** The invitation asks a person to see their own
   child's team and offers nothing for sale, so on the reading in `CASL_MEMBER_INVITE_EMAILS.md` it is not a commercial message and
   the sender-identity content (name, mailing address, a contact) is not required; the line printed is a courtesy and an
   anti-scam aid. Do not print a volunteer coach's home address. If the email ever gains a plan, price, offer or sign-up link
   for FieldLogicHQ, this answer reverses (then a mailing address is required for the coach team). The regulation text for the
   exact content list (CRTC's Electronic Commerce Protection Regulations) was not re-fetched this session.
3. **No FieldLogicHQ privacy policy page: a blocker before the tier goes on for real families; not a blocker while it is off.**
   The consent box says the account is run "as the privacy policy and {club}'s privacy notice describe", and the "How we use your
   information" link is missing (`FIELDLOGICHQ_PRIVACY_POLICY_URL` is null). Consent that points to a document the parent cannot
   read is not meaningful consent (PIPEDA principles 4.3 and 4.8), and the stored record becomes weak evidence. Owed, in order:
   (a) publish `drafts/PRIVACY_POLICY.md` as a page (its owner items P1–P7 first; its nine product findings; and the Stage 4
   paragraphs in the section below), (b) set the URL constant, (c) remove the "Draft wording — not final." line from the accept
   page, (d) re-read the consent box against the published policy and move `GUARDIAN_CONSENT_VERSION` if any word changes.
4. **The stop link on the rep invitation also cancels that club's open rep invitations to the address: acceptable, no word change.**
   The page says "{club} won't send invitations to {address} again" and "emails about a sign-up of your own still come" — both true
   as built, and cancelling the open ones is what a reader of "won't send invitations again" expects. It touches no connection and no
   sign-up email. Known gap (Session 3/4, logged by the review): if the cancel write fails, the page still says done.
5. **From the review.** *R2 (the record names the children connected at Join, not the ones the page showed):* this IS /legal's,
   because build condition 4 says the record stores "the exact words shown". A race (a division published between page load and
   Join) breaks it. Needs: the page sends the children it showed; the server connects only those and stores the text built from
   them, and refuses with a "this changed, look again" state on a difference. That state's words are the owner's. Do it before the
   tier goes on for real families. *Ruling 15 (a forwarded link plus the address lets someone set the new account's password):* not a
   privacy-law obligation; it is a safeguards judgment (PIPEDA 4.7, proportionate to what the account opens). The honest limit is what
   "your sign-up" shows a stranger who holds the link: confirm it carries no date of birth or medical notes before the tier is on.
   The real parent can still reset the password (that proves control of the address), and the club can remove the connection.
   No policy sentence is needed for it; do not promise "only the parent can open this account".

**Home rule:** when the build renders these words, the product copy (`lib/family-guardian-consent.ts` and the email builders) is the
single source and this file is replaced by a pointer in `LEGAL_INDEX.md`.

## Build conditions that make these words true

Each is a fact the words rely on. If the build differs, the words change.
1. **No age question.** The page does not ask the player's age. The product works the band out from the date of birth the club holds
   and never shows it. A parent always attests and agrees on the child's behalf. A player 18 or older gets no invitation panel
   (a parent cannot attest for an adult); the club decides how that player joins.
2. **A working {contact} always exists** where the words say "tell the club" (CASL memo flag a).
3. **Stop on a connected address removes only a connection made through the second-parent invitation**; it never ends the connection of a
   parent who is the first parent on the child's own sign-up (CASL memo flag d, raised to "before the build" here).
4. **The record stores** the exact words shown, the wording version, the time, the IP address, the club and the child. Not the age band.
5. **The accept page links** the FieldLogicHQ privacy policy and the club's privacy notice. If the club has none, the link is replaced by
   "Ask {club} for its privacy notice at {contact}."
6. **The placement email's panel promotes nothing**: no plan, price, offer, FieldLogicHQ pitch or sign-up link beyond the invitation.

## (a) Accept page — "Before you join"

> **Before you join**
>
> {club} already has {child}'s sign-up. Joining lets you see {child}'s team, practices and games here, and your sign-up.
>
> **Who sees what**
> - **You** see {child}'s team, coach, practice and game times and places, and your sign-up. Nothing about other children.
> - **{child}'s coaches and {club}'s staff** see the name, email and phone number on {child}'s sign-up. {club} can also see that you
>   joined, and can remove you.
> - **Other families** can't see you or {child} here.
> - **FieldLogicHQ**, the software {club} uses, keeps your account (your email and password). It opens {club}'s records only to support
>   the club. [How we use your information] [{club}'s privacy notice]
>
> Joining is your choice. It doesn't put you on any newsletter.
>
> ☐ I'm {child}'s parent or legal guardian.
>
> ☐ I agree that FieldLogicHQ and {club} may use my name, email and phone number to run my account and to email me about {child}'s
> team, as the privacy policy and {club}'s privacy notice describe.
>
> [Join {child}'s team]

Both boxes required; neither pre-ticked. Do not use "I agree to {club} using {child}'s information": the club already holds it from the
sign-up, so a tick-box "agreeing" to that is not a real choice (meaningful consent); the new thing the parent chooses is their own account.

**The Terms line (un-parked 2026-11-08, Terms v0.2).** The owner ruled O7 (2026-11-08): one set of Terms for every account holder, with a
part "If you joined through an organization" that covers a parent (Terms §3). So a parent does accept the Terms — but **not on this page,
and not as a third box**. They accept at the account's own door (Terms §20): the sign-up tick if this page creates the account, or the
one-time sign-in screen if they already had one. This page only says so, in one line under the button:

> Your FieldLogicHQ account comes with our [Terms of Service] — the part for people who joined through a club applies to you.

Keep it a statement, not a tick-box: the consent boxes above are about this club and this child, and folding the Terms into them would
blur a meaningful consent into a contract. If the build lets someone reach this page with an account that has not yet accepted, the
Terms §20 sign-in screen comes first.

## (b) The parent's first screen — one line

> Other families can't see you or {child} here. {child}'s coaches and {club} see the name, email and phone on the sign-up.
> [How your information is used]

## (c) Invitation panel fine print (email)

**First parent, placement email** (replaces "works for 30 days…"):

> This invitation is for {email} and works for 30 days. If you aren't {child}'s parent or guardian, ignore it and tell {club} at
> {contact}. Joining is your choice. You'll get emails about {child}'s team either way, and joining doesn't add you to any newsletter.

**Second parent's copy** (the existing "who added you" line stays above the panel; the Stop footer stays below):

> {first parent} added your email to {child}'s sign-up. This invitation is for {email} and works for 30 days. If you aren't {child}'s
> parent or guardian, ignore it. Don't want these emails? Use **Stop these emails** below.
>
> Sent by {club}, {club's mailing address}, {contact}, through FieldLogicHQ.

**Rep coach's invitation** (sent to an address the coach typed; built to the commercial-message standard on purpose):

> {coach}, coach of {team}, invited this address to see {child}'s team in the app. This invitation is for {email} and works for 30 days.
> If you aren't {child}'s parent or guardian, or you don't want invitations like this, ignore it or [don't send me invitations].
>
> Sent by {coach} for {club or "a FieldLogicHQ coach team"}, through FieldLogicHQ. Contact: {contact}.

## (d) Stop confirm — second parent who has joined

> You've joined {child}'s team in the app. Stopping removes you from it and ends your calendar link. {club} won't email this address
> about any sign-up, and can't add it again.

(Shown only when the address joined through the second-parent invitation. The Stage 3b sentence above it stays.)

## (e) Leave confirm

**First parent:**

> Leave {child}'s team? You'll stop seeing {team} here, and your calendar link stops showing its games. {club} will still email you
> about {child}'s sign-up. You can join again only if {club} sends you a new invitation.

**Second parent:**

> Leave {child}'s team? You'll stop seeing {team} here, and your calendar link stops showing its games. {club} may still email you
> about {child}'s sign-up. To stop those too, use **Stop these emails** at the bottom of one. You can join again only if {club} sends
> you a new invitation.

## Privacy policy follow-through (not product copy; for `drafts/PRIVACY_POLICY.md` when Stage 4 is real)

- §3 gains a short paragraph: a parent's family account holds email, password, name and phone from the sign-up, who they are connected to,
  the time and IP address of the join, and the exact words shown. FieldLogicHQ is the organization for that account data; the child's
  information stays the club's (§5).
- §5 "Stop these emails" paragraph gains: "If the address had joined a child's team, the stop ends that connection too."
- §8 note 1: the family-account paragraph replaces "we do not knowingly let a child create an account" only by adding to it; no child holds a login.
- Retention: consent and connection records are kept indefinitely today (packet Q7). Do not publish a retention promise until a period is chosen.

## For a lawyer's eye

- (a) Whether a tick-box attestation of parenthood is enough for the information shown (team, times, places, own sign-up), and where it stops being enough.
- (a) Québec: consent for a child under 14 comes from the holder of parental authority; whether the product's design (parent always consents,
  band worked out from the date of birth) meets Law 25 for a Québec club. No Québec customer exists; text not re-fetched this session.
- (c) Second parent and the rep coach's invitation: CASL classification of an invitation to a non-party's address (memo `CASL_SECOND_PARENT_EMAIL.md`).
- (d) A stop that also ends a connection: custody-adjacent; the product, not the club, ends a parent's access.
