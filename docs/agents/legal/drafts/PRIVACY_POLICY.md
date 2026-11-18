# DRAFT — FieldLogicHQ Privacy Policy, the version after 2026-11-17

| | |
|---|---|
| **Version** | next after 2026-11-17 (posted with a new effective date under §13; no new use and no new kind of company, so no advance email is owed: what we collect does not change, one purpose narrows, one email and one invoice kind are gone, and one existing record is named in two rows) |
| **Status** | draft — held to publish on the same day as the Payments Terms (owner call (b), recommended); not published |
| **Effective date** | — (the day the Payments Terms are published; the file is named by that date) |
| **Last reviewed** | 2026-11-18 (0.2: Board Ready data terms, with its follow-through) |
| **Starts from** | `lib/legal-documents/privacy/2026-11-17.md`, word for word, with the changes in the log |

**Change log**
- **Draft 0.1 (2026-11-18, Stripe-owned pricing Stage 5)** — five edits:
  1. §3, billing-address row (~L34): the purpose no longer names billing "the Stripe fees a club's online payments
     cause" (Stage 4 retired the monthly Stripe-fee invoice, `6dc9c6119`). The data is unchanged: the address is still
     taken before payouts, for the province of the tax inside our fee (Stage 4 owner call (a)).
  2. §3, "Our emails to you" (~L48): "a club's monthly invoice for its Stripe fees" cut (the email no longer exists).
  3. §6, the Stripe row (~L174): "our invoices for Stripe fees" cut; the club's payment account row now says Stripe takes
     our fee from it.
  4. §3, the acceptance row (~L32), and 5. §9, the acceptance-record retention bullet (~L222): both name the Payments
     Terms agreement, which keeps an owner's email for six years after the account closes (Payments Terms §15; mig 497;
     the Payments Terms draft's Before list item 7).
  Fixes the `LEGAL_INDEX.md` carry-forward row (`STRIPE_FEE_INVOICE_RETIREMENT.md`): MUST-FIX before the first production
  club sets up payouts. Nothing else changes.
- **Draft 0.2 (2026-11-18, Board Ready data terms; owner Q11 "fold them in now")** — edits P1–P6, P8, P9 of
  `BOARD_READY_DATA_TERMS_REVIEW.md` §3: §6 gains an **ImprovMX** row (forwards mail to our addresses; France until
  delivered, and the US — live since 2026-11-12 and missing from the published version, the risky direction); the Google
  row says the mail is forwarded by ImprovMX; "How we hold them to it" names ImprovMX's agreement; the push row says the
  alert is encrypted so only the device can read it (`lib/web-push.ts:80-90`); one sentence points at the list; §7 says
  mail to our addresses passes through France; §9's three backup sentences say "gone within 7 days"
  (`BACKUPS_AND_RESTORE.md`); §5 points at the Data Terms. **Still no advance email under §13:** ImprovMX is an email
  service, the same kind of company as Resend and Gmail. **P7 folded in 2026-11-18** (§3 and §10: "or your password is changed"; Q5 answered, the host's
  notice is off and our own email covers every reset except an invitation's first password). **Owner kept P7 2026-11-18**
  (Board Ready data terms Section 3): both wordings are true, and this one tells people more; it is true on production once
  `15514dbd9` (our email on the ordinary reset) is there, which ships before this version can publish. **P10 folded in
  2026-11-18** (§4: server logs "deleted after 90 days"; the owner set 90 days on every log group of the website, Q7).
  §6's list address filled: /legal/subprocessors (`/plan` 2026-11-18).

**How to read this draft.** Customer text is everything after the first `---` line, up to "Before this can be
published". Owner notes are in blockquotes that start `> NOTE`.

---

## 1. About this policy

This policy explains how **FieldLogicHQ** (a business registered in Ontario, Canada — "we", "us") handles personal
information.

FieldLogicHQ is software that sports clubs, leagues, tournaments and coaches use to run their organizations. That means
we hold personal information in **two different roles**, and this policy keeps them apart:

| | **We decide** (we are responsible) | **The club decides** (we are its service provider) |
|---|---|---|
| **Whose information** | People who have a FieldLogicHQ account, buy a plan, contact us, or visit our website | Players, parents and guardians, registrants and members that a club, league, tournament or coach puts into FieldLogicHQ |
| **Who to ask about it** | Us | The organization that collected it — and us, if you can't reach them |
| **Covered in** | §3, §4 | §5 |

## 2. Our privacy contact

The **Privacy Officer, FieldLogicHQ** is responsible for this policy and for how we handle personal information.

- Email: **privacy@fieldlogichq.ca**

Questions, requests and complaints go here (see §11).

## 3. Information about account holders

**Who:** people who sign up to run an organization or a team, people a club invites (administrators, coaches, staff,
officials, treasurers, volunteers), and people who buy a plan. Everyone who holds an account confirms they are 18 or older
(§8).

| What we collect | Why |
|---|---|
| Name, email address and password | To create your account, sign you in and contact you about it. Your password is stored by our sign-in provider in a protected (hashed) form; we never see it. |
| Which version of our Terms of Service and this policy you accepted (and, for an owner who sets up online payments for a club, which version of our Payments Terms you agreed to for it), the exact words you ticked, the email address you used, when, and where (for example at sign-up or at checkout) | To show what you agreed to. We keep it for at least six years after your account closes (§9). We don't record your internet (IP) address for this. |
| The organizations and teams you belong to, your role and title | To show you the right screens and let the club control who sees what. |
| For the account owner who buys a plan, or who turns on online payments for a club: the billing address, and (when a card is used) the card's brand, last four digits and country | To bill you for your plan, to work out the sales tax that applies to your plan and, where it applies, to the fee FieldLogicHQ takes from a club's online payments, and to show you which card is on file. Your full card number goes to Stripe, never to us. |
| **For each sale, our tax record of it:** the name on the invoice, the full billing address it was taxed on (including the postal code — **for a coach buying as a person, that is usually a home address**), the card's country, the country of a club's payout account, and, where a buyer declares where they are, which version of that declaration they gave and when | The tax law requires us to keep evidence of where each sale was taxed. It is kept apart from your account, so closing the account does not remove it (§9). Our staff can see it to answer tax questions, and can add a note to a sale that needs a second look. |
| Purchase, plan and invoice history | To run your subscription and keep the business and tax records the law requires. |
| If you use **two-step sign-in**: your backup codes, kept only in a one-way (hashed) form, with when each was used and which sign-in it let in; a short-lived record of codes recently accepted; and the time your account turned two-step on | To check your codes, keep a sign-in that used a backup code working, and show you your own settings. The secret your authenticator app uses is held by our sign-in provider; we do not keep it. |
| If an organization **requires** two-step sign-in for your role: the time your set-up period started in that organization, and the dates we last emailed you about it | To give you your set-up time, and to send each email only once. |
| If you ask us to **reset your two-step sign-in**: the request — which of our staff made it, how you asked, a note of why, when each step happened (you confirming, the reset running, being held or cancelled) — and a one-way (hashed) form of the confirmation link | To confirm it is you, to carry out the reset, and to keep a record in case it is questioned later. |
| Settings you choose (for example light or dark display, reminders you have dismissed) | To remember your preferences. |
| What you send us — support emails, feedback you submit in the product, a request to delete your organization | To answer you and improve FieldLogicHQ. Feedback submitted in the product is stored with your name, email address, role and organization, the page you were on, your internet (IP) address and your browser type, so we can find and fix the problem. Email addresses you type into the message itself are removed. |

**Your use of the product.** We keep records of changes made in an organization's space (for example, who changed a
roster or a schedule) so clubs can see what happened and we can support them. We do not use advertising trackers or
third-party analytics tools.

**Our emails to you.** We send account holders emails about their account, their organization and their plan — for
example sign-in links, invitations, renewal and payment notices, notices when two-step sign-in is turned on or off, or your password is
changed, and, where an organization requires two-step sign-in for your role, an email when your set-up time
starts and a reminder three days before it ends. These are part of the service. If an organization has more than one owner,
each owner receives the emails about its plan — including, when a plan is bought or moved up, the name or email address of
the owner who did it. We only send promotional emails (news about features or offers) in line with Canada's anti-spam
law, and every one has an unsubscribe link.

## 4. Information about website visitors and the public

- **Cookies.** We use only the cookies needed to run FieldLogicHQ: keeping you signed in, remembering a choice such as
  which division you were looking at, and marking a visit to one of our public demos. **We do not use advertising or
  tracking cookies**, and we do not use third-party analytics. Your browser's own storage also holds a few preferences on
  your device (for example, teams you choose to follow on a tournament site); they stay on your device.
- **Tournament score alerts.** If you turn on alerts on a public tournament site, your browser gives us a notification
  address so we can send them. We don't ask for your name or email. You can turn alerts off at any time in your browser.
- **Early-access and contact forms.** If you fill in a form on our website, we keep what you entered and your browser type,
  to reply to you.
- **Error reports.** If a page fails, we record technical details (including your browser type) to fix it. These reports
  are deleted automatically after 30 days.
- **Server logs.** Like any website, our hosting keeps technical logs that can include internet (IP) addresses, for
  security and to keep the service running. They are deleted after 90 days.

## 5. Information that clubs put into FieldLogicHQ

Clubs, leagues, tournaments and coaches use FieldLogicHQ to manage their members. **They decide what to collect** —
through their registration and tryout forms, rosters and records — and they are responsible for it under privacy law. **We
process it for them, as their service provider**, and only to provide FieldLogicHQ to them.

**What a club may keep in FieldLogicHQ**, depending on the features it uses:
- **About players, many of whom are children:** name, date of birth, team and roster details, jersey size and position,
  medical notes and health confirmations, emergency contacts, tryout results and evaluations, attendance, development
  notes, awards, and documents the club asks for (for example signed waivers, medical consent forms and codes of conduct).
- **About parents and guardians:** name, email addresses, phone number, relationship to the player, registration and
  consent records, payments and amounts owed, and messages.
- **About registrants:** what the registration or tryout form asks for, and a record of the consents given — including
  when, and the internet (IP) address it was given from.

**One record for each child, across seasons.** A club keeps one record for each child, which carries from season to
season. The child's current medical note and emergency contact sit on that record; each season's roster also keeps what it
held at the time. Two records become one only because of a fact (the club moved the team into a new season, or accepted the
child from a tryout) or because someone at the club said yes — a head coach, or club staff who can see the club's families.
FieldLogicHQ may **suggest** that two records look like the same child, from the name, date of birth and a parent's email
address; it never joins them on its own, and **never across two clubs** — our system refuses it. A child's record stays
even when the child is on no team. **A club can't delete a child's record itself today**: a request to delete one comes to
us (§11).

**Other people's email addresses.** A parent can type another person's email address on a sign-up — for example the
other parent's — and that person has not given it to us or to the club themselves. Every email we send to that address
about the sign-up carries a **Stop these emails** link at the bottom (the club's group emails carry their own unsubscribe
link instead), and the first email says who added them. The link opens a page with one button and needs no sign-in.
Pressing it takes the address off every sign-up that club has, for every season, and the club can no longer add it again.
To keep it stopped we keep that address on a short list for that club for as long as the club's account exists. Nobody is
emailed about the stop; the club's registrar can see that the address was stopped and when. Receipts and refunds go to the
person who paid, not to the second address.

**Friends a parent names on a house-league sign-up.** When a club turns it on, a house-league sign-up can ask which other
children a child would like to play with. The parent types the friend's first and last name (one of them is enough),
may add that child's parent's name, or enters the friend's **friend code** — a short code every sign-up is given, so one
family can name another's child without typing the name. The family of the child who is named did not give us that name:
the parent who signed up did, and the form asks them to name only a child whose family is happy for them to. Only the club's
staff who work on sign-ups and teams — the people the club has allowed to open its Registrations — see these names. They
check which sign-up each name means, and they may keep a short note when they cannot honour a request. The team draft then
puts friends on the same team (up to three children together), and the club can also use a request to keep two children on
different teams. **We use these names only to decide which team a child plays on.** A request is not emailed to the family
that is named, is not shown on a public page, and is not in the club's family or people lists; the one place the names are
written out is the Friend requests list the club can download.

**Emails a club sends through FieldLogicHQ.** When a club emails its families, its coaches or its board through
FieldLogicHQ, we keep a record of the email in the club's account: who sent it, when, which group it went to, its subject and
message, and how many people it reached. For an email to coaches or to the board the record also keeps the name and role (or
team) of each person it went to, as they were when it was sent; for an email to families it keeps the last name of each
family it was sent to and whether it reached them or they had opted out. The record does not hold anyone's email address (our email provider holds
addresses to deliver the email: §6). Only the club's people the club has allowed to use Communications can read it, and what
each can read depends on their role: someone who runs one program sees only the emails that reached that program's people,
and an email to the board can be read only by the person who sent it, the people it went to, and the club's owner and admins.

**Two-step sign-in, and what your club sees.** A club's owners and admins (no other role) can see, for each person in the
club, whether two-step sign-in is on and when it was set up. Where the club requires it for a role, they also see how many
days that person has left to set it up, or that the time has passed. The club's Overview shows its owners and admins a short
list of the people who still need to set it up (up to three names, with their role and the earliest date), and the members
list the club can download carries the same column. **The club never sees your codes, your authenticator app or your
devices.** If an owner or admin resets your two-step sign-in, it is only when your account is used for that club alone; if
your account reaches anywhere else, the club is told only that FieldLogicHQ support must do it, with no reason given.

**Parents saying whether a player is coming.** When a team's coach turns it on, a parent who has joined the team in the app can
say In, Late, Maybe or Out for each upcoming game or practice the coach has chosen, and may add one short note (up to 200 characters).
That answer **is the player's attendance for that event**: there is one answer per player and event, kept in the team's attendance
record, and the latest change wins, whether a parent or a coach who takes attendance made it. Parents can change it only until the
event starts. We store the answer, who set it (a parent's account, or "coach") and when, the answer before it if it changed, and the
parent's note. The coaches of that team who take attendance see the answer, who set it and when, the note and the parent's first
name; the coach's own private note about a player is never shown to a family. A parent sees, for their own child only, who set the
answer and when, including a coach's change ("Coach, today"), and never another child's answer. The child's other connected parent
sees the answer, the first name and the day, and that a note was left, but not what it says. Other families never see it, and other
staff of the team (those who open the lineup or the practice plan, but do not take attendance) see the answer and whether a family or a coach set it, never a parent's name or note. We do not send a parent a message when a coach changes an answer. A coach can also press
**Remind**. That sends an in-app note, and an email to the account's own address, to each connected parent of a player who has no
answer yet (a player the coach has already marked is not reminded). The email says an event is coming and the coach asked whether the player is coming; it has
no answer link, never goes to an address that has not joined, and has the club's unsubscribe link. A parent who has unsubscribed
from the club's emails still gets the in-app note. We ask parents not to put health details in a note.

**What we do with it:** store it, keep it secure, display it to the people the club authorizes, send the emails the club
asks us to send, and help the club when it asks for support. **We do not sell it, we do not use it for advertising, and
we do not use it for our own purposes.** Our Data Terms for organizations make these commitments to each club as part of
our Terms of Service.

**What we don't do:** FieldLogicHQ does not show a player's name, date of birth or roster on any public page. A club can
publish its schedules, standings, team names, and the names of coaches who choose to show theirs.

**Who can see it.** The club controls which of its people can see which records. A small number of FieldLogicHQ support
staff can view a club's records when it is needed to support the club, investigate a problem or a payment dispute, or
keep the platform safe. Our staff can also see which clubs and Coaches Portals have a plan coming up for renewal or a bill
unpaid, to run billing. Every change our staff make is permanently recorded, every page they open in our own tools is
recorded, and every download of a billing list is recorded. We have no way to sign in as a customer.

**If you are a parent, guardian or member** and have a question about information a club holds about you or your child —
including asking to see, correct or delete it — **please contact the club first.** It decides what is collected and kept.
If you can't reach the club, contact us (§2) and we will pass your request on and help.

## 6. Who we share personal information with

We share personal information only with the companies that run parts of FieldLogicHQ for us, and only what each one
needs. We do not sell personal information, and we do not share it with advertisers.

| Company | What it does for us | What it receives | Where it processes data |
|---|---|---|---|
| **Supabase** | Database, sign-in and file storage | Everything stored in FieldLogicHQ | United States (Ohio) |
| **Amazon Web Services (AWS)** | Hosts the website; holds our own business records (expenses and receipts, tax returns) | Everything that passes through the website. Our business records hold no customer's name or address | United States (Ohio) |
| **Resend** | Sends our emails, and the emails clubs send through FieldLogicHQ | Recipient's name and email address, and the message | United States |
| **ImprovMX** | Forwards email sent to our own addresses to our inbox | Messages people send us, which can include contact details | France (held only until delivered) and the United States |
| **Stripe** | Card payments for our plans; and, when a club takes payments online, the club's own payment account, from which Stripe also takes FieldLogicHQ's fee | For our plans and invoices: the owner's email, the billing name and address, the card, and a reference to the account that made the purchase. For club payments: the payer's email, card, what is being paid for and the player names on the payment | Canada, the United States and other countries |
| **Google** (a Gmail account) | Our business email inbox — the addresses on this page arrive there, forwarded by ImprovMX | Messages people send us, which can include contact details | The United States and other countries |
| **Your browser's push service** (for example Google, Apple or Mozilla) | Delivers notifications you turn on | A notification address, and the alert, encrypted so that only your device can read it | Varies |

The full list, with each company's own security pages and how we tell organizations about a new one, is at
[fieldlogichq.ca/legal/subprocessors](/legal/subprocessors).

**How we hold them to it.** Supabase, AWS, Resend and Stripe each protect the personal information they handle for us under
their standard data-processing terms, which form part of our agreement with each of them. ImprovMX handles it under its
data-processing agreement. Our Gmail inbox is a free account,
which those business terms don't cover — so we keep what arrives there to what people send us.

**Professional advisers.** We may share our business records with professional advisers, such as an accountant, who must
keep them confidential. Those records name the club that bought each plan and the province it was taxed in; a coach who
bought as a person appears only as "Coach".

**When a club takes payments online,** the payment is between the family and the club: the club is the merchant, and the
payment is processed in the **club's own Stripe account**. Stripe handles that information under its own terms with the
club.

**Other reasons we may disclose information:** if the law requires it (for example a court order); to protect someone's
safety; or as part of selling or transferring FieldLogicHQ's business, in which case the buyer must continue to protect it
as this policy says, and we will tell account holders.

## 7. Information stored outside Canada

FieldLogicHQ is run from Ontario, but **the companies in §6 store and process personal information outside Canada,
mainly in the United States.** Email sent to our own addresses passes through France on its way to our inbox. While it is there, it is protected by our agreements with them, but it is also subject to
the laws of that country, and **the courts, law enforcement and national-security authorities there may be able to
obtain it** under those laws.

## 8. Children

FieldLogicHQ is not designed for children to use on their own. Everyone who holds a FieldLogicHQ account confirms they are
18 or older, or the age of majority where they live, and we do not knowingly let a child create an account. Children's
information comes into FieldLogicHQ **through a club** (§5), which is responsible for getting the consent of a parent or
guardian where the law requires it — generally for any child under 13.

We treat children's information, and health information about anyone, as **sensitive**: it is never shown on public pages,
uploaded documents open only through short-lived private links, and our error logs strip out dates of birth, phone numbers
and email addresses.

## 9. How long we keep information

- **Your account** is kept while it is open. When it is closed, we delete it, except where we must keep records (below).
- **When a paid plan ends,** the organization's information is kept so the club can come back: **90 days** for an
  organization and **365 days** for a Premium Coaches Portal. We will try to email a warning before that period ends. After
  that, it **may be permanently deleted**.
- **Billing, tax and invoice records** are kept for at least as long as Canadian tax law requires — generally **six years**
  after the end of the tax year they relate to. They include, for each sale, the name, billing address and card country it
  was taxed on. Closing your account, deleting an organization, or asking us to delete your information does not remove
  these records before that period ends.
- **The record of which version of our Terms of Service you accepted**, and of which version of our Payments Terms an
  owner agreed to for a club (§3), is kept for **at least six years** after your
  account closes, so we can show what was agreed if a question about it comes up later. It keeps the email address you used at the
  time; closing your account does not remove it before that period ends.
- **Information a club keeps** stays while its organization exists; the club decides how long to keep its members'
  information. A club can remove a player from a team, but a child's record (§5) is kept until we delete it at the club's
  or a parent's request, or the organization is deleted. **When an organization is deleted, its information and the files
  uploaded to it are deleted with it**, except our own tax records (above), the record of the Payments Terms its owners
  agreed to (above), and our record that the deletion happened (the
  organization's name and web address, who deleted it, when and why). Copies in our routine database backups are gone within
  7 days.
- **Two-step sign-in records** (§3) are kept while your account exists, or, for your set-up time in an organization, while
  that organization exists; they are deleted with the account or the organization. Your backup codes are removed when you
  turn two-step off or replace your phone; the record of codes recently accepted is cleared the next time you enter a code.
  A **support reset request** and the note of why are kept with your account or your organization, with no separate time
  limit.
- **Friend requests** (§5) are deleted when the club marks the season finished. If a club never does, they are deleted
  automatically 60 days after the season's last day, and the friend code on each sign-up is cleared at the same time. A
  copy of the Friend requests list that a club downloaded is the club's own, and copies in our routine database backups are gone within
  7 days. To have a friend request removed, ask the club: its registrar can delete a request at any time.
- **A parent's answers about whether a player is coming** (§5). The words of a note are deleted 30 days after the event. The answer
  itself is the player's attendance record, which is the club's: it is kept as the team's attendance, and this clean-up never deletes
  it. Who set the answer (a parent's account) and the answer before it are removed 60 days after the last event on the team's
  calendar for that season; this happens whether or not the club has closed the season, and a coach adding an event later moves the
  date. A parent who is no longer connected to a child (they left, the club removed them, or they stopped the emails) and has no other connection to that child has their notes
  about that child deleted at once, but their answers stay as the child's attendance, and their first name stays beside them until
  that date; a parent whose account is deleted loses their notes, and the answers stay without their name. If a club joins two records
  of the same child, the attendance goes with the child. If an event moves to a new day, its answers are kept, and parents and coaches
  update them by hand. The in-app notes the coach receives about answers are kept like any other in-app note. An in-app note is kept until the person it was sent to deletes it, or until their account or the club is deleted (no end date today). A note can hold a name, a child’s name, an email address and, for a request to withdraw a child, the words the family wrote.
- **Emails a club sends** (§5): the subject and message are deleted 12 months after the email is sent, and the names of the
  people it went to 24 months after; the date, sender, group and counts are kept while the organization exists. Deleting an
  organization deletes these records with it. Copies in our routine database backups are gone within 7 days.
- **Error reports** are deleted after 30 days; the detailed log of records our staff opened, after 90 days; performance
  measurements, after one year. The list of pages our staff visit in our own tools is kept with no set end date today.

## 10. How we protect information

- Access to each organization's information is limited to the people it authorizes, and enforced on our servers.
- Sensitive records can only be read through our server, never directly from a browser.
- Uploaded documents are private and open only through links that expire after one hour.
- Links in our emails (unsubscribe, calendar feeds, pay links) are signed so they can't be guessed or altered, and
  sign-in-free links are stored only in a scrambled (hashed) form.
- Information is encrypted in transit (TLS), and our database provider encrypts all stored data at rest (AES-256).
- Our staff's changes are permanently recorded, and the pages they open are recorded too.
- **Two-step sign-in.** You can protect your account with a second step, a code from an authenticator app; an organization
  can require it for its members. Backup codes are stored only in a one-way (hashed) form, not as readable codes. We email
  you when two-step sign-in is turned on or off, or when your password is changed, so a change you did not make is noticed.
- **If you lose your phone and your backup codes,** your club's owner or an admin can reset your two-step sign-in when your
  account is used only for that club. Otherwise, or if you own the club, FieldLogicHQ support resets it after you confirm by
  email; when you own a club, we also tell its other owners, admins and treasurer, and the reset waits 24 hours, during
  which signing in with a code cancels it.

No system is perfectly secure. We keep a written procedure for handling a breach of our safeguards and a record of every
one. If a breach creates a **real risk of significant harm** to you, we will tell you, and the Privacy Commissioner of
Canada, as soon as we can, and tell you what you can do to protect yourself. If the breach affects information a club
holds, we will tell the club straight away so it can notify its members.

## 11. Your rights and how to use them

For information **we** are responsible for (§3, §4), you can:
- **ask what we hold** about you, how we use it, and who we have shared it with, and get a copy;
- **ask us to correct** it if it's wrong — including your name or email address, which you can't change yourself in the
  product yet;
- **withdraw your consent** — for example, unsubscribe from promotional email, or close your account — subject to
  information we must keep by law or contract;
- **ask us to close your account and delete your information**, except the records the law makes us keep (§9).

Email **privacy@fieldlogichq.ca**. We will answer within **30 days** and tell you if we need longer. We may need to confirm
who you are first. There is no charge.

For information **a club** holds about you or your child, see §5 — contact the club first.

**If you're not satisfied** with our answer, you can complain to the **Office of the Privacy Commissioner of Canada**
(priv.gc.ca, 1-800-282-1376).

## 12. Unsubscribing from emails

Every promotional email from us, and every non-essential email a club sends through FieldLogicHQ, has an unsubscribe
link. You can unsubscribe from one organization's emails or from all of them. Emails needed to run your account or a
registration you made (sign-in links, receipts, schedule changes for your team) are sent regardless.
A second parent whose address a parent typed on a sign-up has a **Stop these emails** link at the bottom of every sign-up
email instead; it works for that club for every season (see §5).

## 13. Changes to this policy

We will post any change here with a new effective date. If a change means we will use your information in a new way, or
share it with a new kind of company, we will tell account holders by email **before** it takes effect, and ask for your
consent where the law requires it.

## 14. Where this policy applies

This policy is written for Canada. FieldLogicHQ is **not currently offered in Québec** (see our Terms of Service).

## 15. Contact

Privacy Officer, FieldLogicHQ · privacy@fieldlogichq.ca

## Before this can be published

> NOTE — Owner material from here to the end; the preview drops it.

**Owner decisions**
- **(b)** When it publishes — **AGREED by the owner 2026-11-18:** on the same day as the Payments Terms (v0.2, approved
  O4), at switch-on. The
  published 2026-11-17 version over-describes (it names a fee invoice we no longer send), which is the safe direction
  while online payments are off in production; it **must** be replaced before the first production club sets up payouts
  (`STRIPE_FEE_INVOICE_RETIREMENT.md`).

**Things that must be true first**
1. The Payments Terms publish the same day (this version names them in §3 and §9).
2. **This version is live before the first Payments Terms agreement is recorded on production** (the tick writes that
   record; the 2026-11-17 version does not name it).
3. The billing address is still asked for before payouts (Stage 4 owner call (a), built: `hasBillingLocation`). If that
   step is ever dropped, the §3 purpose changes again.
4. **(0.2)** ~~ImprovMX's pre-signed DPA is countersigned (owner Q4).~~ **Met 2026-11-18: the owner countersigned it**, so
   §6 "How we hold them to it" keeps its ImprovMX sentence.
5. **(0.2)** The sub-processor list (`drafts/SUBPROCESSOR_LIST.md`) is live at /legal/subprocessors, the address §6 now
   names (a `/plan` build, Board Ready plan 0a-5). **If the list is not published by this version's day, cut that one sentence** — this version
   must not wait for the list (it is the must-fix before the first production payout); the ImprovMX row stays either way.
6. **(0.2)** The §5 Data Terms sentence stays only if the Data Terms publish the same day (they ride in the next Terms
   version, owner Q6); otherwise cut it.

**Publishing steps**
1. Freeze the text as `lib/legal-documents/privacy/<date>.md` (the filter's output), add `{ version, sha256 }` to
   `lib/legal-documents.ts`, set `current`, keep `oldestAccepted` (a minor change: no one accepts again), set `draftPath`
   back to null and delete this draft.
2. Delete the `LEGAL_INDEX.md` carry-forward row for the fee invoice.

## For a lawyer's eye

Nothing new: the five edits narrow a purpose, remove a retired email and invoice, and name an existing record. The 0.2
edits name a supplier already in use and state facts; the only exposure they touch (privacy requests reaching a free Gmail
account and a forwarder) is on file in `drafts/SUBPROCESSOR_LIST.md` § For a lawyer's eye.
