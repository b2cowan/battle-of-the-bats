# Removing the fixed notice above a club's own sign-up questions
**Last verified:** 2026-11-21
**Re-verify by:** the first Québec club (Law 25 s. 8, the club's notice at collection); the guardian tier switches on; any edit to the published Terms §4 or Privacy §5/§7
**Depends on facts:** production data is in AWS us-east-2 (LEGAL_FACTS "Where data lives"); the published Terms and Privacy Policy 2026-11-17; FieldLogicHQ is the club's service provider for family data (Terms §4, Privacy §5); no Québec customer yet (index L7)

## Question(s) this answers
Can the fixed notice above a club's own sign-up questions be removed outright? The notice reads: "These questions come from
{club}. The club decides what to ask and what to do with your answers. FieldLogicHQ stores them for the club, in the United
States, and uses them for nothing else. Questions about your answers go to the club first." The club's privacy link sits
beside it. If it can go, what has to exist instead, and does removing it change when the next Privacy version and Data Terms
§12 have to be live?

The owner's argument: (1) everything in the database is stored in the United States and no other collection point says so,
so saying it here alone is inconsistent; the Privacy Policy covers it. (2) A family sees one form from the club. They don't
tell the club's added questions apart from the default fields (name, email, jersey number, position), and those never had
a notice.

## Finding: yes, it can be removed outright, with one thing kept
- **Saying data is stored outside Canada at collection is the CLUB's job, not ours, and our published Terms already say
  so.** The OPC's cross-border guidance (2009) asks the *organization collecting* to "make it plain" that information may be
  processed abroad, "ideally at collection". For family data, the collecting organization is the club, and FieldLogicHQ is
  its service provider. A transfer to a provider is a *use*, not a disclosure that needs new consent. The published Terms
  2026-11-17 §4 say our providers store Customer Data "outside Canada, mainly in the United States" and add: "Your members
  should know this too; your own privacy notice is the place to tell them." The published Privacy Policy §5 names "what the
  registration or tryout form asks for", medical notes and documents the club asks for, and §7 names the United States. The
  notice repeated, on the club's behalf, a statement the Terms leave to the club. **The owner's point (1) is correct:** the
  only family-facing place "United States" appears is this notice. Neither the default fields, the tryout form, the
  guardian accept page nor tournament registration says it.
- **On point (2), the owner is right, and for a deeper reason than the one given.** The default fields are the club's
  collection as well. Who wrote a question doesn't change who is responsible for it. The club is responsible for every
  answer on its form either way. The only real difference is how sensitive a question is, and that is handled elsewhere:
  - the health line under each health question ("Only answer what {club} needs to keep {child} safe.") stays;
  - health answers stay off emails, lists and plain exports, by product rule;
  - express consent for sensitive information is the club's (Terms §4, Data Terms §2 and §12).
- **"Uses them for nothing else" and "questions go to the club first" stop nothing by being removed.** The promise lives in
  the published Privacy Policy and Terms. Removing the sentence from the form withdraws no promise.
- **The one thing to keep is the club's privacy link.** Published Terms §4 tells clubs "you can link your own privacy policy
  on your forms". On this form, that link exists only inside the notice (`components/league/SignupFormFields.tsx:301-305`),
  so removing the notice would remove the link too and make that Terms sentence untrue for this form. Move it to the foot
  of the form, near the submit button, where the tryout form already attaches it to its consent line
  (`components/rep-teams/TryoutRegisterForm.tsx:308-323`). It still shows only when the club has one.

## What the product does today (census 2026-11-21, cited lines opened)
- The notice shows once, above the first club question the page displays, and only when the form has questions
  (`components/league/RegisterForm.tsx:350`, `:483`, `:586`).
- The club's privacy link: only inside the notice, and only when `organizations.privacy_policy_url` is set.
- Other privacy wording on the form: the friend-request line (`lib/league-friends.ts:120`), the coach-sees line
  (`lib/league-second-parent.ts:29`) and the optional email-consent tick. **No link to FieldLogicHQ's Privacy Policy, and no
  footer legal link.**
- **Product finding (exists already, not caused by this change): no club can set its own privacy link.** No admin screen or
  route writes `privacy_policy_url`. `lib/privacy-policy.ts:13` says "today operator-only; a future admin UI will let tenants
  set it". So the Terms §4 sentence "you can link your own privacy policy on your forms" is true only when our staff set it
  by hand. Route to `/plan`: a club setting for its privacy link. It is small, it serves every consent surface at once (tryout
  form, guardian accept page, this form), and it is the mechanism the published Terms rely on for the cross-border notice.

## Does removal change the Privacy 0.4 / Data Terms §12 timing?
The condition doesn't change, but it loses its cushion. `BOARD_READY_STAGE4_PART3_BUILT_REVIEW.md` release condition 3
("Privacy 0.4 and the Data Terms §12 sentence are live no later than the first club that asks a question on production")
stands as written. Its reason, "the form's own fixed notice says the same thing at the point of collection, so a short gap
is the safe direction", no longer applies once the notice goes. The remaining gap is small: the published policy already
covers form answers, medical notes, documents and United States storage. What 0.4 and §12 add are the specifics (files a
family attaches, one-hour links, the audit line, never in an email). Those are commitments in the club's and family's
favour, not missing disclosures. Hold condition 3 to the letter; no new condition is needed.

## Recommendation (**RULED by the owner 2026-11-21: notice removed, link moved under Sign up, setting added to the Board Ready plan as Stage 4, 4.P**)
1. **Remove the notice outright** (the owner's call). This needs owner approval, because the product file's header says
   the notice "may be tuned, never narrowed", and that rule was this agent's own. This review withdraws it.
2. **Keep the club's privacy link**: move it to the foot of the form (by the submit button), shown when the club has one.
3. **Keep the health line** under health questions. It does a different job (data minimisation) and is not part of the
   question asked.
4. **Route to `/plan`:** a club admin setting for its own privacy link (finding above).
5. Help: two articles in `lib/help-content/house-league.tsx` describe the notice. `/docs` removes them when the build lands.

## Sources
- OPC, *Guidelines for processing personal data across borders* (2009-01-27). Already researched in
  `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md` (verified 2026-11-05, not stale); not re-fetched.
- PIPEDA Sch. 1 principle 4.1.3 (accountability for transfers to a provider). Same file.
- Québec, *Act respecting the protection of personal information in the private sector*, s. 8 (information at collection,
  including the possibility of communication outside Québec): an obligation on the collecting enterprise. Index L7 holds the
  Québec research and is triggered by the first Québec customer.
- The published Terms and Privacy Policy 2026-11-17 (`lib/legal-documents/`), read 2026-11-21.

## Addendum 2026-11-21 — the club's setting is built (Board Ready 4.P), its words read
The trigger "a club admin setting for its own privacy link ships" fired: built on dev 2026-11-21 (4.P; the commit is recorded
on the plan's 4.P line). The owner or an admin sets it on Organization › Settings, card "Your privacy policy"; http/https only,
by the seam's one rule (`lib/privacy-policy.ts`); the three doors are unchanged readers. **The product finding above is closed
by it:** Terms §4's "you can link your own privacy policy on your forms" is now true without our staff.
- **Words (read against Terms §4):** label, error sentences and help lines say only what the code does. One addition
  recommended, an owner call: the helper names what the policy is for, in the Terms' own words. With the form notice gone,
  this field is the only place a club meets Terms §4's "your own privacy notice is the place to tell them" at the moment it
  acts on it. It restates our published Terms and does not advise the club on its own law. Wording: "The web address of your
  club’s own privacy policy. Families see a link to it on your sign-up forms and when they accept an invitation. It is where
  you tell them how your club uses their information, and that FieldLogicHQ stores it outside Canada, mainly in the United
  States. Leave it empty for no link."
- **http:// accepted: no exposure of ours worth refusing it for.** We send nothing to the club's page. The guardian accept
  page's address carries a token, and its link is `noreferrer`. The browser's default referrer rule sends no address on an
  https→http step and only our origin on https→https, so the sign-up pages, whose addresses hold no personal information,
  leak nothing either. Refusing http would only block a small club with an old site. The "Not secure" warning on its page is
  the club's matter.
- **Not legal (passed to the build):** the Settings page already has a field labelled "Web address" (the club's own
  address), so a second "Web address" on the same page invites a paste into the wrong box.
- **Still open:** at the first Québec club, whether this link is enough for its s. 8 notice (unchanged below).

## Lawyer's eye needed?
Low priority, no gate. One line: whether a service provider that hosts a club's form, on its own domain, carries any
point-of-collection duty of its own toward a family, given Terms §4 places it on the club. The current reading (PIPEDA
accountability rests with the collecting organization) says no. At the first Québec club, also: whether a Québec club needs a
field on the form for its own s. 8 notice, beyond the privacy link.
