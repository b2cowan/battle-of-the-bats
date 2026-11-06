# A second parent's email typed by the first parent — CASL and PIPEDA
**Last verified:** 2026-11-06 (CASL s.1(2), s.6(1), s.6(2), s.6(6) and Electronic Commerce Protection Regulations s.4 read on
laws-lois.justice.gc.ca; PIPEDA clause 4.3 / indirect collection primary text **not** fetched, see Sources)
**Re-verify by:** first Québec customer; Bill C-36 (federal privacy reform) passes; family accounts Stage 4 ships (it adds a
sign-in invitation to the same address); any change to what the second parent's copy contains
**Depends on facts:** `LEGAL_FACTS.md` § Consent and email mechanics (no express opt-in at signup; unsubscribe at three
levels); the build prompt `docs/projects/active/SIGNED_IN_FAMILY_STAGE3_BUILD_PROMPT.md` (Progress block, owner questions 1–6)

## Question(s) this answers
A house-league parent can type a second parent's email on the sign-up. The club's system then emails that address copies of
the sign-up confirmation, status, pay link, team, schedule and "Email families" messages. The address is typed by someone else
and never confirmed. Is that lawful under Canada's anti-spam law (CASL) and privacy law (PIPEDA), and what is the exposure?

## Finding
**CASL — two separate questions.**
1. *Is the message a "commercial electronic message" (CEM) at all?* A CEM is a message that, reading its content, links and
   contact details, it is reasonable to conclude has as one of its purposes to encourage participation in a commercial
   activity (s.1(2)). A message carrying a season fee, how to pay and a pay link plausibly meets that on its face; a plain
   status or schedule message plausibly does not. A CEM needs the recipient's consent (s.6(1)(a)) **and** the sender's
   identification, contact details and an unsubscribe mechanism (s.6(1)(b), s.6(2)).
2. *If it is a CEM, is it exempt from consent?* Section 6(6) lifts only the consent requirement, and only for a message that
   *solely* confirms or completes a transaction "that the person to whom the message is sent previously agreed to enter
   into" (b), or gives factual notice of "the ongoing subscription, membership, account … or similar relationship of the
   person to whom the message is sent" (d), or delivers what that person "is entitled to receive" (f). **Each paragraph is
   about the recipient's own transaction or relationship.** The first parent signed up and agreed. The second parent agreed
   to nothing and has no relationship with the club on record. So the exemption that comfortably covers the first parent's
   copy does **not** cleanly cover the second parent's. (Reading of the text; no regulator decision on this fact pattern was
   found.)
3. *Other doors.* **Implied consent:** the CRTC's published position is that consent may be implied for members of a club or
   voluntary organization, but the second parent is not shown to be a member; the sender carries the burden of proving consent.
   **Referral exclusion** (Regulations s.4): covers only the **first** CEM sent following a referral, requires the referrer
   to have a family or personal relationship with both the sender and the recipient, and requires the message to disclose the
   referrer's **full name** and **state that it is sent as a result of the referral**. The shipped confirmation's "who added
   you" line is close to this for the *first* message (it names the first parent with first and last name), but the line does
   not say "sent as a result of a referral", the exclusion does not reach later messages, and "referral" is a strained fit for
   a parent adding a spouse to a child's sign-up.
4. *Penalty frame.* CASL is enforced by the CRTC with administrative monetary penalties (to $10 million per violation for a
   business); the sender and anyone who "causes or permits" the message are exposed. The Act's private right of action was
   suspended before it took effect (my recollection, not re-read this session). Penalty figures and that status come from
   memory, not from a source I opened; verify both before quoting either.

**PIPEDA.** The second parent's email is personal information about someone who is not a user and never saw a notice. The
club collects it indirectly from the first parent. The principle is knowledge and consent (clause 4.3): the individual should
know what is collected and why. Consent does not have to be collected from the second parent first when the information is
collected for a purpose they would reasonably expect and they are told promptly, which is what the "who added you" line does
on first contact. The OPC's guidance is also clear that consent does not waive other duties (accountability, safeguards,
reasonable purpose). *(Indirect-collection text of PIPEDA itself not fetched; treat as the OPC's general position, not a
quoted rule.)*

**The role split (keep apart).** For the club's families' data, FieldLogicHQ is the service provider and the **club** is the
sender and the organization responsible for consent; FieldLogicHQ "causes or permits" the send. FieldLogicHQ's own privacy
policy cannot cover the club's collection, but it must not promise what the product does differently.

## What the product does today
- A second email is stored per sign-up and every child of the sign-up carries it (`lib/league-second-parent.ts` header).
- It receives its own copy of the sign-up confirmation (with the "who added you / tell the club and they'll take your address
  off" line, `lib/league-second-parent.ts` `addedYou`; sent from the register route's email step) and a copy of every later
  sign-up email (`lib/league-second-parent-mail.ts` header): status, pay link, team, schedule, practice, "Email families".
- Receipts, refunds and bank-debit mail go to the payer only (same header).
- **The stop is BUILT (Stage 3b, Sessions 1+2, 2026-11-06, committed).** Before it, the second parent’s
  copies had no unsubscribe at all (service mail "by design", owner question 2) and the confirmation’s line was the only way
  off; that text is superseded. Now:
  - **Every second-parent copy carries a "Stop these emails" link** at the foot of the card, from ONE footer builder
    (`lib/league-second-parent-footer.ts`): the sign-up confirmation, the "Your sign-up" and replaced-link notices, the pay link,
    and approve / waitlist / promote / decline / placement / schedule / practice times / practice changes. The first parent’s
    copies get no new button and no new words (owner call O5). Guarded by `tests/unit/league-second-parent-fanout.test.ts`
    (four files may draw it; a census of every file that can address a second parent).
  - **Not carrying it, on purpose:** "Email families" (its own per-address unsubscribe and suppression) and receipts, refunds
    and bank-debit mail (payer only).
  - **The link opens a confirm page; a GET writes nothing** (mail scanners prefetch links). One button POSTs; no sign-in. The
    token is a fourth HMAC family keyed on club + address (`lib/unsubscribe-token.ts`, `:stop-second-parent`), deterministic and
    never expiring; with no `UNSUBSCRIBE_SECRET` no link is drawn and the confirmation’s line says "tell the club" instead.
  - **The stop IS the removal** (owner calls O1–O5): one database function clears the address from every sign-up of that club
    and records the stop in a small table; no send path checks the table. The address is then refused in words on the family
    form and both registrar windows; the registrar sees "Stopped by the address owner, {date}" and cannot undo it; nobody is
    emailed. Migration 448 is applied to **dev only**; prod is owed before the promote that ships the code.
  - **The confirmation’s "who added you" line** now offers the button and, where the club has a public contact email, that
    address too; a club with no contact email gets the button alone (no "tell {club}" dead end while the button exists).
- The address is **never** used as a household key and **never** reaches a marketing or consent list (header comment; held by
  `tests/unit/league-second-parent.test.ts`). A household's group emails reach a second parent only if that address is on
  every sign-up the message names (the review's security fix).
- A typed address that equals the first parent's is refused; an hourly send limit applies to it.
- **Not checked:** how a recipient who is not the child's parent replies, and what the "Your sign-up" link shows to someone
  holding it (amount owed, child's name) — raised by the review as owner question 1.

## Recommendation
Plain language for the owner; this is a recommendation, not legal advice.

1. **The product's design is reasonable and closer to the law than most.** It tells the person who added them, names the
   adder, gives a way off, never puts them on a marketing list, and withholds money receipts. Keep it.
2. **The real gap is the stop link, not the wording.** For the first parent a service message with no unsubscribe is defensible
   under s.6(6). For the second parent that defence is weaker (they agreed to nothing), so a person who is *not* the child's
   parent has only a manual email to the club to make it stop. **Recommended: put a one-click stop on the second parent's copies
   only** (a per-address stop that mutes that address for this club's sign-up emails). That closes the largest CASL exposure
   and the largest "stranger's address" complaint at once, and costs the first parent nothing. This is owner question 2 in the
   build prompt; I recommend answering it yes. Route the build to `/plan`.
3. **Make the contact-email gap impossible.** The line must always name a working address. Either block a club from taking
   second-parent sign-ups without a contact email, or fall back to a FieldLogicHQ address. Otherwise the only safeguard can be a
   dead end.
4. **The privacy policy draft is silent on this.** `drafts/PRIVACY_POLICY.md` does not mention that a club or parent can add
   another person's email, and its promise that "every non-essential email a club sends through FieldLogicHQ has an
   unsubscribe link" is only true of the second parent's mail if their copies count as essential. Add a sentence under
   "information about other people" once recommendation 2 is decided, and keep the unsubscribe promise true.
5. **Wording check for the "who added you" line** (with `/marketing`'s polish): add the adder's *full name* (already there)
   and keep a plain statement of why they got it ("so you get the same emails about it"). Do not rely on the referral exclusion;
   it does not fit and does not reach later messages.
6. **Owner's remaining exposure if nothing changes:** a stranger or ex-partner receives a child's name, season, and what is
   owed, and can only ask the club to stop. The harm is annoyance and a complaint, not data theft (the review closed the
   cross-household leak). The CASL risk is modest in practice because the messages are service messages, but it is not zero.

## Status of the recommendations
- 2026-11-06: recommendation 2 (a one-click stop on the second parent's copies) is planned as Stage 3b, owner calls ruled as recommended; not built. Recommendation 3 is replaced: with a stop button the contact-email gap no longer needs a block or a fallback address (plan `SIGNED_IN_FAMILY_STAGE3B_SECOND_PARENT_STOP_PLAN.md`). Recommendations 4 and 5 ride on the same build.
- 2026-11-06 (later): **recommendation 2 BUILT** (Stage 3b Sessions 1+2); recommendation 3 closed by it; recommendation 4 done
  in `drafts/PRIVACY_POLICY.md` §5 and §12 (0.1, 2026-11-06); recommendation 5 done as the new "who added you" line. Prod: migration
  448 owed before the promote. Open flags below are the owner’s to decide; none is decided here.

## Open flags after the build (2026-11-06) — for the owner; none decided here
**(a) The honour path has no guaranteed receiver.** The stop page’s "link isn’t valid" and "didn’t go through" states say to
reply to any email from the club and ask to be taken off, "within 10 business days". A reply reaches the club only when the club
has a public contact email (Reply-To is set only then, per the Stage 3b plan’s own note on `familyReplyPlan`,
`lib/email-club-identity.ts`); otherwise it goes to a platform sending address, and whether anyone reads that mailbox is
UNCONFIRMED (not checked). CASL’s ten-business-day rule is the sender’s, and the sender here is the club,
with FieldLogicHQ the service provider. Options for the owner: confirm a monitored address and say so in the words, or keep the
words short of a promise. (A pre-existing gap the plan already noted: "unchanged and not this stage’s".)
**(b) Exact-address stop.** A `+alias` of the same mailbox (`j.doe+x@…` vs `jdoe@…`) is a different address and is not caught.
Inherent to matching on the address; the refusal will not catch it.
**(c) A millisecond race.** A sign-up that passes the "stopped?" check just before a stop commits can still add the stopped
address; nothing in the database refuses it afterwards and no send path checks the table, so mail could flow until someone
notices. Needs the stop and the sign-up to land in the same instant. A database-level refusal would close it.
**(d) A mixed address.** Someone who is a second parent on one sign-up and a first parent on another, using "Email me my
link", gets one email carrying the Stop footer whose wording ("a parent added your email") is wrong for the sign-ups where they
are the first parent. Rare. (The greeting "Hi," has behaved this way since Stage 3.)
**(e) Two footnotes on the pay-link copy.** The second parent’s pay link carries the transactional notice ("sent even if you have
unsubscribed … speak to your coach") and the Stop footer. Wording only; for the `/marketing` pass if it matters.
**Also noted by the review, accepted:** the "that address has asked not to get these emails" sentence lets someone who can reach
a club’s open sign-up form test whether an address has stopped (owner call O4, rate-limited, same status code as any other
validation error); the stop page names the club and the address only to a holder of a valid link.

## Sources
- [Canada's Anti-Spam Legislation (S.C. 2010, c. 23) — s.1(2), s.6(1), s.6(2), s.6(6)](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html) — accessed 2026-11-06
- [Electronic Commerce Protection Regulations (SOR/2013-221) — s.2, s.4 referral exclusion](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2013-221/FullText.html) — accessed 2026-11-06
- [CRTC — Frequently Asked Questions about CASL (implied consent for club members; third-party addresses; burden of proof)](https://crtc.gc.ca/eng/com500/faq500.htm) — surfaced by search 2026-11-06, page itself not opened
- [OPC — PIPEDA consent principle](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_consent/) — accessed 2026-11-06 (general consent text only; clause 4.3 indirect collection not quoted)

## Lawyer's eye needed?
Yes, for two things, owner decides when: (a) whether a service message carrying a pay link to a non-party counts as a CEM and
whether s.6(6) reaches a second parent; (b) whether the PIPEDA position on indirect collection of a non-user's email holds
for a club (a not-for-profit) using a platform. Neither blocks Stage 3; both are cheaper to settle before Stage 4 invites
that same address to sign in.
