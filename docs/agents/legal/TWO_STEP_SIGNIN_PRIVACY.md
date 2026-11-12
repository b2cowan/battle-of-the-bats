# Two-step sign-in — what Part 1 holds, and what the policy may say
**Last verified:** 2026-11-12 (Part 4 light review below; 2026-11-11: light review of Board Ready two-step Part 1, read against mig 463, `lib/two-step-codes.ts`,
`app/api/auth/two-step/set-up/start/route.ts`, `lib/demo-session.ts`; PIPEDA/CASL/Law 25 not re-researched — nothing in Part 1
is new law, and the analysis rests on the existing `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md`)
**Re-verify by:** the promote (re-check every policy sentence against the code), or a Québec customer (Parts 3 and 4 reviewed, below)
**Depends on facts:** FieldLogicHQ is an organization in its own right for account holders' data (not the club's service
provider); Supabase (production: us-east-2) is already a listed supplier; no email is sent by Part 1.

## Question(s) this answers
Does Part 1 create a legal problem now, and which "after the build" policy lines stay true as built?

## Finding
- **No blocker.** The data is account-holder security data held in our own-organization role. No new supplier, no new
  email, no child's information, no change to who sees club data. Law 25 adds nothing without a Québec customer. CASL: no
  message sent in Part 1.
- **The authenticator secret is Supabase's, not ours at rest.** It does pass through our server once (our route calls
  enrol and relays the QR code and key to the browser; `set-up/start/route.ts:48-61`). It is not written to our tables and
  the observability wrapper does not log response bodies. So the honest sentence is "we do not keep it", never "it never
  touches our systems".
- **Backup codes: "scrambled (hashed)" is true but weak protection; do not call it more.** Stored as salt + sha-256
  (`lib/two-step-codes.ts:62-66`). A code is 40 random bits and sha-256 is fast, so someone holding a copy of the table
  could try every code offline in hours. *(Updated 2026-11-12: `lib/two-step-codes.ts:36-51` now keys the hash with a server secret, `TWO_STEP_CODE_KEY`, when it is set; without it new codes use the unkeyed form. See the TWO_STEP_CODE_KEY item in the Part 4 review below.)* They would still need the person's password and a live sign-in to use one. Say
  "stored only in a one-way (hashed) form, not as readable codes"; do not say "cannot be recovered" or "secure". A keyed hash
  (server-side secret) would make the plain claim stronger. Build item for `/plan`, not a legal condition.
- **Used backup codes** are kept, deliberately: the used row (when, and the session id it let in) is what keeps that session
  working (`createBackupCodes` deletes only unused ones, `two-step-codes.ts:51-60`; the database rule reads the used row,
  mig 463 lines 144-149). Gone when the account is deleted (`on delete cascade` from `auth.users`, and the staff/Remove
  member delete paths call `auth.admin.deleteUser`). No window shorter than "while the account exists" is built. Rows
  could safely be cleared once their session can no longer be alive; optional tidy-up.
- **Accepted-code rows (`two_step_code_uses`) are NOT "kept 5 minutes".** The sweep of rows older than 5 minutes runs only
  on that person's next code check (`recordCodeUse`, `two-step-codes.ts:120-122`). A person's last row sits until they
  type another code or the account is deleted. The row is user id + a hash of user id and a six-digit code, which anyone
  can reverse (only a million possibilities). Low harm because the code expired within seconds, but the policy must not say
  "five minutes". Fix options: a small scheduled sweep, or accept and word it "short-lived, cleared the next time you
  enter a code, and deleted with the account". Route to `/plan`.
- **Part 3 tables are empty** and hold: grace start per person per club; for owner resets, `asked_by` (an address),
  `asked_how` and a free-text `reason` (`mig 463` lines 108-122). The free text can name a person and is never time-limited
  as built: same class as L16 (staff reasons). Decide in Part 3 a "do not name anyone" line and a retention for finished
  rows; rows cascade away with the club or the person.
- **Demo accounts:** refusal plus authenticator clearing on each visit is real (`set-up/start/route.ts:25`;
  `demo-session.ts:34-39`); nothing for the policy.

## What the product does today
Checked in code as above. Production: not shipped (Part 1 is built on dev; mig 463 is dev only until the promote). No policy
text may describe two-step as a product feature until it is on production and Part 2's release gate (with Part 1) is met.

## Recommendation
- Privacy draft §10 may gain one line after promote: "You can protect your account with a second step, a code from an
  authenticator app; an organization can require it for its members. Backup codes are stored only in a one-way form."
  Do not say "we require" or "all accounts". (The ask 1 ruling already limits the claim to "available".)
- §3/§9 data kinds: sign-in second-step records (backup codes in hashed form, when used and which sign-in they let in; a
  short-lived record of recently accepted codes; the time a person's grace started in a club). Retention wording must follow
  the findings above (the 5-minute figure is wrong as built).
- §5: admins see the on/off state only (confirm when Part 3 builds the Members column).
- The medical-notes finding 5 and the "No MFA exists" fact: reworded as the plan says, at promote.
- `BREACH_PROCEDURE.md` gains "a fraudulent reset" and L16 gains the support reset reason, both with Part 3.
- Part 3 watch: the emails to a club's other admins and treasurer (24-hour hold notice) and to the person after a reset
  are security/account notices (CASL s.6(6)-class, no commercial content). Keep them free of plan, price or offer.

## Part 3 light review (2026-11-11) — the switches, the grace period, the resets
Read against `lib/two-step-emails.ts`, `app/(consumer)/auth/two-step/confirm-reset/page.tsx`, `lib/two-step-support-reset.ts`,
`lib/two-step-club-reset.ts`, mig 469. No new law researched (same classes as above and `CASL_MEMBER_INVITE_EMAILS.md`).
- **CASL: no blocker.** All four new emails are security / account notices with no plan, price, offer or sign-up link
  (`two_step_reset`, `two_step_requirement_off`, `two_step_owner_reset_confirm`, `two_step_owner_reset_notice`). They need no
  unsubscribe as long as that stays so. Three carry "This email has no link on purpose"; the confirmation is the one with a
  link, sent only to the account's own address.
- **Must-fix before the walk (fixed in the build the same day): "reply to this email" must reach someone.** The club notice
  invites the other admins to reply to hold the reset. A reply goes to the From address unless a Reply-To is set, and
  `CASL_MEMBER_INVITE_EMAILS.md` already found that Reply-To reaches nobody on other emails. The notice now sets Reply-To to
  the published contact address (`FIELDLOGICHQ_CONTACT_EMAIL`), the same address the email names. ⚠ Owner: confirm that
  address is read daily during a reset's 24 hours, or the hold promise is not real.
- **Telling the club's admins that the owner asked is a disclosure of the owner's request.** It rests on the owner's own
  confirmation: both the email and the confirmation page say, before the press, that the other admins and treasurer are
  told. Keep that sentence above the button. A person who owns no club is told nothing about a club (fixed in the build).
- **What the club now sees about a member:** on / off and since when (the Manage window, the team staff window), and
  whether the club can reset it. The "only support can reset this one" line gives no reason, but it does tell an admin that
  the account reaches *somewhere* beyond the club (a narrow inference, accepted by the ask 3 ruling). §5 should say it.
- **New records (§3 / §9):** a support reset request — who on our staff asked, how the person asked, a free-text Why, when
  it was confirmed, ran, held or cancelled, and a one-way hash of the link's token; a person's grace start in a club. The
  free-text Why can name a person and has **no retention limit as built** (rows go with the person or the club): same class
  as L16. Later, not a blocker: a "do not name anyone else" hint on the Why field and a retention for finished rows.
- **Part 4 policy follow-through must add:** §3 / §9 the two record kinds above; §5 "your club's owners and admins see
  whether two-step sign-in is on and when it was set up, never your codes, app or devices"; §10 the reset paths (your club,
  or support with an email confirmation, a notice to the club's other admins when you own the club, and a 24-hour wait);
  `BREACH_PROCEDURE.md` "a fraudulent reset"; L16 gains the support reset Why.

## Part 4 light review (2026-11-12) — the five new emails, the club's view, the policy text
Read against `lib/two-step-email-words.ts`, `lib/two-step-grace-emails.ts`, `lib/two-step-club-status.ts`, the three routes that send the
alarms (`app/api/auth/password/route.ts`, `two-step/set-up/verify/route.ts`, `two-step/turn-off/route.ts`, `two-step/reset-password/route.ts`), the
reminder screen (`app/(consumer)/auth/two-step/page.tsx`) and the data dictionary. CASL not re-researched: same class and same
reasoning as `CASL_MEMBER_INVITE_EMAILS.md` and the Part 3 review above.
- **CASL: no blocker.** All five are account or security notices to the person's own sign-in address, with no plan, price,
  offer or sign-up link, so they are not commercial messages (s.1(2)) and need no unsubscribe. They stay that way only while
  no offer or link is added (a new "upgrade to Club" line would make them commercial). Each also names a fact the person acts
  on, which is the s.6(6) security/account-information class.
- **Must-fix before the walk: two alarm lines state a result unconditionally that the route can fail to deliver.**
  "Your other devices were signed out" (`two-step-email-words.ts:150`) is sent even when `othersSignedOut` is false
  (`password/route.ts:84-95`) or the sign-out threw (`reset-password/route.ts:33-37`). "Codes from the old app no longer work"
  (`:116`) is sent when `oldRemoved` is false and the route still returns ok (`set-up/verify/route.ts:54-83`). A warning that
  says the door is shut when it is open is worse than none. Pass the flag to the builder and use the cautious sentence on failure.
- **Later: "That way a stolen password can't open the club's books or its families' details"** (`:51-52`) is an absolute.
  It is not "secure" in so many words, but the Part 1 caution applies: "makes it much harder for someone with only a stolen
  password to open…" is the true sentence.
- **Later: "Your other teams and places on FieldLogicHQ stay open"** (`:71`, `:92`) is not true for a person whose other club also
  requires it and is past its deadline (the screen offers "Go to my other teams" only when something is open, `page.tsx:28`).
  Say "Places that don't need it stay open".
- **Later (product gap, already known): the "Forgot your password?" email-link reset sends no email of ours.** The alarms'
  advice (`:107`) sends a worried person down exactly that path, and its result is the one password change nobody is told about.
  Zero-code cover is the sign-in service's own "password changed" notification in production Auth settings: an owner call,
  not touched. Also check at the walk that the link reset signs out a second, already-signed-in browser: the advice only evicts
  a person holding a session if it does.
- **Owner (carried from Part 3, now bigger): is `FIELDLOGICHQ_CONTACT_EMAIL` read daily?** Six emails now tell a person who
  may have lost their account to write there. The alarms say "write to", not "reply" (right: a reply reaches nobody); only the
  Part 3 club notice sets Reply-To.
- **What the club sees:** on / off, since when, days left or "past the deadline", and the Overview list (up to three names, role,
  earliest deadline), owners and admins only, plus the export. This discloses to the club that a named person has not set up a
  protection: accepted by the ask 6 ruling, and said plainly in §5 (applied). Keep treasurers, registrars and the public board
  page off it (a list of whose password is worth stealing).
- **Later: the policy says nothing about the sent-email record** (recipient, kind, time; `sendEmail` logs each of these five
  as an account kind). Pre-existing; check what the record keeps (the message body?) before adding a sentence to §3.
- **Carry to `/release`: `TWO_STEP_CODE_KEY` must exist on production before the first backup code is made.** Without it new
  codes use the unkeyed hash, and a keyed code is refused if the secret later goes missing (`two-step-codes.ts:57-59`). The
  policy's "one-way (hashed)" is true either way; the stronger claim is not made.
- **Applied (2026-11-12):** `drafts/PRIVACY_POLICY.md` §3 (three row kinds; the account and set-up emails), §5 (what owners and
  admins see), §9 (retention as built: with the person or the club, no separate limit; never "five minutes"), §10 (the
  two-step paragraph; the reset paths), notes 3 and 4, finding 5 reworded and not closed; all marked live-only-at-promote.
  `LEGAL_FACTS.md` two-step line; `BREACH_PROCEDURE.md` §1 and §3 step 1; `LEGAL_INDEX.md` L16 (the support reset's free-text
  Why is the same class).

## Sources
- Code and migration paths listed above — read 2026-11-11.
- Supabase MFA behaviour: plan section "Sign-in service facts" (supabase.com, read 2026-11-10, probes 2026-11-11) — not re-read.

## Lawyer's eye needed?
No for Part 1. Flag for later, owner's timing: (a) that "we offered it" is a mitigation, not a shield, if a privacy regulator
looks at medical notes behind a password-only seat (already recorded in the plan); (b) the support-reset path for a sole
owner (identity fraud exposure and what the Terms promise); (c) the security-safeguards standard (PIPEDA 4.7) if hashes
stay unkeyed and a breach involves them.
