# Two-step sign-in — what Part 1 holds, and what the policy may say
**Last verified:** 2026-11-11 (light review of Board Ready two-step Part 1, read against mig 463, `lib/two-step-codes.ts`,
`app/api/auth/two-step/set-up/start/route.ts`, `lib/demo-session.ts`; PIPEDA/CASL/Law 25 not re-researched — nothing in Part 1
is new law, and the analysis rests on the existing `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md`)
**Re-verify by:** Part 3 ships (emails, owner reset, switches) or a Québec customer
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
  could try every code offline in hours. They would still need the person's password and a live sign-in to use one. Say
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

## Sources
- Code and migration paths listed above — read 2026-11-11.
- Supabase MFA behaviour: plan section "Sign-in service facts" (supabase.com, read 2026-11-10, probes 2026-11-11) — not re-read.

## Lawyer's eye needed?
No for Part 1. Flag for later, owner's timing: (a) that "we offered it" is a mitigation, not a shield, if a privacy regulator
looks at medical notes behind a password-only seat (already recorded in the plan); (b) the support-reset path for a sole
owner (identity fraud exposure and what the Terms promise); (c) the security-safeguards standard (PIPEDA 4.7) if hashes
stay unkeyed and a breach involves them.
