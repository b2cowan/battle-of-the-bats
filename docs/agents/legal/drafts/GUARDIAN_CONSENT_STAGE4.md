# Guardian consent and privacy words — Signed-in family accounts, Stage 4 — DRAFT

| | |
|---|---|
| **Version** | 0.1 |
| **Status** | draft — not owner-approved, not reviewed by a lawyer; rendered by the product (switched off) as the words it ships with (Stage 4a built 2026-11-08) |
| **Effective date** | — (not published) |
| **Last reviewed** | 2026-11-08 |
| **Backlog** | L5 (children's consent wording), L6 (CASL line) |
| **Replaces** | the placeholder in `lib/family-guardian-consent.ts` once the owner approves and the build adopts it |

**Change log:** 0.1 (2026-11-08, Stage 4a Session 4) (d) corrected to what the build does; (a), (b), (c), (e) unchanged; closeout read below. 0.1 (2026-11-08, later) the parked Terms line in (a) written, after Terms v0.2's O7 and O5 (every account holder is 18 or
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

**Closeout read, Stage 4a Session 4 (Parts 6–8, the whole stage), 2026-11-08** — every rendered sentence read against this draft and its six
conditions. Words (b) and (e) ship verbatim. **One word fix:** (d) is corrected (see its note). Answers:
1. **(d) fixed.** "Ends your calendar link" and "about any sign-up" were untrue as built: the parent's one calendar address stays (it just stops
   showing the child), and the same address can be the first parent on another child's sign-up, whose emails continue. The shipped line now
   says what happens. (a) is unchanged, so `GUARDIAN_CONSENT_VERSION` stays v0.1. **Also for the owner:** the Stage 3b stop page's own
   sentences ("will stop sending them", "won't send sign-up emails to {email} again") overshoot the same way for an address that is also a
   first parent; after owner ruling O2 they should read "copies of sign-ups someone else added it to". Not changed here (3b words, its tests).
2. **(b) names the club, not "the club": better, keep.**
3. **"Left the app" and "Removed" statuses on the record window: fine.** The club already sees "joined"; "left" and "removed" are the same
   fact class. Gap, not a blocker: the accept page tells a parent the club "can see that you joined, and can remove you" but not that it sees
   a leave. Recommend adding "and sees if you leave" to that line the next time the words move (it changes the stored text, so it is a
   version bump to 0.2: do it with the privacy-page work below, not now).
4. **"Email me an invitation" on the emailed sign-up page: fine.** It sends only to the first address on the sign-up and answers the same
   either way. It is a requested message to an address already on the sign-up, not a new CASL exposure.
5. **The removed-by-the-club line that stays until reconnected: fine.** It takes no side, names the contact, and nobody is emailed.
6. **A sibling connected later (Session 1 open item 2): acceptable, the record is honest.** The stored text does not pretend the parent saw
   the box for that child: it says the child was connected when placed, under the earlier acceptance (date and invitation). The parent is told
   the same day by the "{team} is in your app" line in the placement email, and can Leave. Owner ruling 3 chose this. Do not change the stored
   text to look like a fresh consent. **Before real families:** consider whether the attestation "I'm the parent of Leo, Ava and Maya" should
   be asked again for a later sibling; the information shown is a team schedule the club already tied to that address, so the risk is low.
7. **Not told to a parent (new finding):** the other connected parent sees their name once they join (Manage, ruling 7). Neither the accept
   page nor (b) says so. Recommend one clause ("{child}'s other parent, if connected, can see your name"), with the 0.2 bump above.
8. **R2 (the record names the children connected at Join, not the ones the page showed): still open, built-to-first before real families.**
9. **FieldLogicHQ privacy page: still the blocker** (answer 3 of the Session 2 read). Fine for the owner's dev walk; the accept page's
   "Draft wording — not final." line stays until it is published.
10. **Coach-team invitation without a mailing address, and the second-parent fine print without (c)'s first sentence: confirmed acceptable**
    on the conditions in answers 1 and 2 of the Session 2 read.
11. **Blockers before the tier goes on for real families:** the published privacy page and its URL; R2; the 0.2 clauses in 3 and 7. **Fine for
    the dev walk:** everything else. The privacy policy draft needs no new promise from this build beyond the follow-through list below,
    plus: ended connections and consent records are kept (no retention period chosen).

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

> You've joined {child}'s team in the app. Stopping removes you from it, and your calendar link stops showing its games. {club} won't
> email this address about a sign-up someone else added it to, and can't add it again.

(Shown only when the address joined through the second-parent invitation. The Stage 3b sentence above it stays. **Changed in 0.2, see
the change log:** 0.1 said "ends your calendar link" and "about any sign-up"; as built the parent's one calendar address stays, and
the same address may be the first parent on another child's sign-up, whose emails continue.)

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
