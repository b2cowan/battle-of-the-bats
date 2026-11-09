# FieldLogicHQ — Legal Facts
**Last updated:** 2026-11-04 (seeded from a repo census the day the agent was built — each fact carries
its source; re-open the source before a draft rests on it)

The facts the Legal Agent (`/legal`) reasons from. About **FieldLogicHQ the business** and what the
product actually does, not about any club's own obligations. Update the moment one changes, and name the
topic files and drafts it puts at risk.

## The business — read it from its one home
Legal form, owner, trading name, province, GST/HST registration, staff and fiscal year live in
`docs/agents/accounting/ACCOUNTING_FACTS.md` § Structure / Jurisdiction / Registrations / Staffing.
**Do not copy them here.** The ones that matter most to legal work, as of this date: sole proprietorship
(not incorporated — the owner is personally liable), Ontario, no employees, **business name FieldLogicHQ
registered with ServiceOntario 2026-11-06** (renewal date still to be read off the registry dashboard).

## Who the customers are
- **Clubs and leagues** (organizations) buy the tournament / league / club plans.
- **Coaches** buy coach plans — often as **individuals**, so consumer-protection rules for internet
  agreements may apply to them where they would not to a club. *(Unconfirmed: whether any coach plan is
  bought by a club rather than the coach — check before relying on "always a consumer".)*
- **Families, guardians and players** are end users of a club's space; family sign-in is the ruled end
  state (`memory` → project_end_state_signed_in_family_app).
- **Canada only today.** US customers are in scope once the US work is done
  (`docs/agents/strategy/BUSINESS_DECISIONS.md` ~L251–255). Québec: no customer on record — the first one
  triggers Law 25 and the French-language standard-form contract rules.
- **Nothing has been sold yet** (`ACCOUNTING_FACTS.md` § Registrations).

## FieldLogicHQ's two privacy roles
1. **Its own organization** for account holders' information (owner, coaches, club admins: name, email,
   billing address for sales tax).
2. **Service provider to each club** for the information the club puts in — rosters, players, families,
   tryout registrants. The club decides what it collects; FieldLogicHQ processes it for the club. The
   documents must say which role applies to what.

## Personal information the product holds (lead list — verify against `docs/agents/db/DATA_DICTIONARY.md`)
- **About minors:** date of birth, medical notes, emergency contacts (dictionary ~L2057, ~L2261,
  ~L2885–2889); uploaded signed medical and waiver files; tryout consent records including IP address
  (~L4348).
- **About a person who is not a user:** a second parent's email address, typed by the first parent on a house-league sign-up,
  unconfirmed; gets copies of sign-up emails with no unsubscribe link (shipped Stage 3, 2026-11-03; see
  `CASL_SECOND_PARENT_EMAIL.md`). `drafts/PRIVACY_POLICY.md` does not yet mention it.
- No public sharing of a child's data (`BUSINESS_DECISIONS.md` ~L2871); no one-to-one adult–minor
  messaging (`docs/projects/active/COACH_PORTAL_CHUNK_D_COUNSEL_PACKET.md` ~L188).
- **Known gaps on file:** no player-information retention or purge rule (TODO, raised 2026-07-17); the
  club export's "everything this organization holds" statement is not true
  (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md` E04, ~L258).

## Where data lives and who touches it
- **Supabase and AWS (us-east-2) and Stripe — i.e. outside Canada**
  (`docs/agents/accounting/RECORDS_RETENTION_AND_LOCATION.md` ~L8, ~L42).
- **Confirmed by code census 2026-11-05:** email goes through **Resend** (`lib/email.ts:31`); **no third-party analytics,
  error monitoring, advertising cookies, AI/LLM service or SMS**; fonts are served from our own site; web push uses the
  browser's push service. The business inbox that receives org-deletion requests is a **free Gmail account**. **Supabase
  production project: AWS us-east-2 (USA), Pro plan** (read from the Supabase Management API 2026-11-08; the dev project is
  ca-central-1 and is not what any policy describes). Stripe's customer portal is always opened with our own configuration,
  built from code: cancel at the period end, no refund, no plan switches (production code, read 2026-11-08; the live copy is
  created on the first live open). No MFA exists. No automatic purge at the end of a retention window; org delete
  does not touch file storage. Full list: `drafts/PRIVACY_POLICY.md` § Product findings.
- **Stripe:** a data-processing addendum is in place (`FACILITATED_PAYMENTS_COUNSEL_BRIEF.md` ~L37).
  *(Unconfirmed: Supabase, AWS and the email provider's DPA status — establish before a subprocessor list
  is published.)*
- **Payments:** Stripe Connect direct charges; **the club is the merchant of record**; no card data stored.
  The fee is legally FieldLogicHQ's charge to the club (`BUSINESS_DECISIONS.md` T3, ~L243).

## Consent and email mechanics that exist today
- **Payments terms:** a checkbox clubs tick when setting up payouts; the version and time are recorded.
  The text is a **placeholder** ("counsel to write"). This is the shape to reuse for signup acceptance.
- **Tryout registration:** two required consents (data collection, eligibility) and a separate optional
  marketing consent.
- **League registration:** a waiver checkbox, required and recorded.
- **Guardian consent:** placeholder wording; the guardian tier is switched off.
- **Club privacy link:** each club may set its own privacy-policy web address; it is shown on their forms.
- **Unsubscribe:** signed links at three levels — organization, user and per family.
- **Signup records an opt-out, not an express opt-in** — the lawful basis for any commercial email must be
  settled before one is sent (`BUSINESS_DECISIONS.md` ~L3537).

## What does NOT exist
- No **published** FieldLogicHQ Terms of Service, privacy policy, cookie notice or subprocessor list (drafts v0.1 of the
  Terms and the privacy policy exist from 2026-11-05 — see the index; the privacy draft's §6 doubles as the first
  subprocessor list).
- No legal links in the site footer; the account page leaves Terms and Privacy out on purpose (owner
  2026-07-20: omit rather than link a page that 404s).
- No "I agree" at account or organization signup. **Census 2026-11-08** (Stage 6 plan §7): accounts are created at about eight
  doors, two with no sign-up page (the account a tournament registration makes for the registering coach; the "follow this
  tournament" nudge, which lets anyone — possibly a teenage player — make an account). Organizations at four routes; plans at
  about six.

## Professional review — no gates
- Not gates: an accountant; a US lawyer (owner 2026-10-31); **Canadian counsel for online payments in
  production and for the guardian tier** (owner 2026-11-04, "we can deal with that later"). The questions
  those gates covered stay open as backlog L3–L6; they no longer hold a launch.

## IP
- Trademark search for "FieldLogicHQ": Canada only, word mark only, no conflicting hits, closed
  2026-10-23 (`docs/agents/brand/VISUAL_IDENTITY.md` ~L195). Not filed.
