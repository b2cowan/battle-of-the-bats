# Find a child, and "Email these families" from Still owing (Club Tier Stage 13e Session A)
**Last verified:** 2026-11-16
**Re-verify by:** 2027-11-16, or a trigger: the Email families window gains a template, link or promotional foot; the search
returns a new kind of field (date of birth, medical, address, phone); a finished season's registrations gain a purge; Bill C-36
passes; the first Québec customer.
**Depends on facts:** `LEGAL_FACTS.md` "FieldLogicHQ's two privacy roles" (service provider to the club for families and
players); the existing CASL posture of the club's Email families window (`CASL_SECOND_PARENT_EMAIL.md` notes it carries its own
per-address unsubscribe and suppression).

## Question(s) this answers
1. Money › Still owing gains **Email these families**, which opens the season's existing Email families window with the
   families of the children who owe already ticked. Does pre-selecting "families who owe a fee" change the CASL position?
2. House league's home gains **Find a child or a parent**: a read-only search over every registration in the club's running
   seasons (and finished ones on "Search past seasons too"), by child, guardian or either email, showing team, status,
   owing and the team's next game or practice. Any PIPEDA / Law 25 / children's-information concern?

## Finding
**1. CASL: no change.** Who receives the message is now pre-selected; what the message is, and how it is sent, are not.
- A message asking a registered family to pay the fee for a registration they already made is, on its face, not a
  commercial electronic message (its purpose is to complete a transaction the family entered, not to encourage a new one).
  If a club wrote one that also promoted something, s.6(6)(a)'s "facilitate, complete or confirm a commercial transaction
  the person previously agreed to enter into" would lift only the **consent** requirement, never identification and
  unsubscribe (CASL s.6(6) opening words; corrected the same way in `CASL_LATE_BILL_EMAIL.md`). The window already carries
  both on every send, so the exemption is not leaned on.
- The window's own rules decide everything at Send: an opted-out family is counted and never sent to; each family gets its
  own unsubscribe footer; the season's three-a-day allowance applies. A pre-ticked set cannot reach an address the window
  would refuse.
- The free-text body is the window's standing risk (a club can type an offer); unchanged here and already covered by the
  window's wording and the Terms (see `CASL_COACH_GROUP_EMAIL.md` for the same reasoning).

**2. Privacy: no new collection, no new reader, no new kind of field; no blocker.**
- **Who reads.** The search is gated exactly as Registrations (the season list's own gate): owner, club admin, league admin,
  league registrar. The treasurer, refused Registrations, is refused the search. Every field it returns, those same seats
  already read season by season, and a finished house-league season's Registrations already reads in place (owner Q16,
  2026-11-04). So it changes how quickly a permitted person finds a record, not who may see it.
- **Purpose (PIPEDA 4.5, use limited to the purpose).** Answering a family's own question about their child's team, fee or
  next game is the purpose the club collected the registration for. Consistent.
- **What it returns about a child.** Name, division, team, season, status and what is owing, plus the guardian's name and
  email. No date of birth, medical notes, emergency contacts, address or phone. Keep it that way: a field from that list
  is a re-verify trigger.
- **Finished seasons.** "Search past seasons too" surfaces records kept indefinitely today. That is the open retention
  question **L9** (player information has no purge beyond friend requests and families' answers), not something this
  feature creates. It does make the gap easier to hit, so it is noted against L9.
- **Logging.** The search text (a child's or parent's name) travels in the request address. Our own request logging records
  the route's name and method, never the address or its query (`lib/observability/with-observability.ts` ~L30–60), so the
  name does not land in our logs. The host's access logs may keep full addresses; the season's Registrations search already
  sends its text the same way, so this adds nothing new. Not a finding.
- **Roles.** For this data FieldLogicHQ is the club's service provider; the club decides who on its staff holds which seat.

## What the product does today
- Email these families: `app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx` mounts the existing
  `EmailFamiliesWindow` with `ticked` = Still owing's registrations, only for `access.read && access.email`; sends go through
  `app/api/admin/house-league/seasons/[seasonId]/emails/route.ts` → `lib/families-email.ts` (opted-out counted, never sent;
  the choke point `sendFamilyEmailBatch` adds each family's unsubscribe). Money sends nothing itself (pinned in
  `tests/unit/club-stage13e-a.test.ts`).
- Find: `app/api/admin/house-league/find/route.ts`, GET only, `houseLeagueRefusal(ctx, 'read')`, `.eq('org_id', …)`, no write;
  fields built in `lib/house-league-find.ts`.

## Recommendation
- Ship both as built. Nothing to apply.
- Add one sentence to L9 when it is next worked: the house-league search can reach finished seasons, so the purge rule it
  decides is the one that bounds what a search can return.
- No privacy-policy text needed: the draft already says club staff see the registrations the club holds; a faster way to find
  one is not a new use.

## Sources
- [Canada's Anti-Spam Legislation, S.C. 2010, c. 23, s. 1(2) (CEM) and s. 6(6)](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/) — read for `CASL_LATE_BILL_EMAIL.md`, relied on here
- [PIPEDA, Schedule 1, Principle 4.5 (limiting use, disclosure and retention) and 4.7 (safeguards)](https://laws-lois.justice.gc.ca/eng/acts/P-8.6/page-7.html) — read for `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md`, relied on here

## Lawyer's eye needed?
No for either item as built. The retention of finished seasons (L9) is the one place a lawyer's view would help, and it was
already on that list.
