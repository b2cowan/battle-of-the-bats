# The deletion request window — Premium Coaches Portal and the Tournament plans
**Last verified:** 2026-11-20
**Re-verify by:** 2027-11-20, or a trigger — the build changes what platform-admin deletion does (subscriptions, accounts,
the deletion record); the first Québec customer; guardian accounts ship (a family then holds its own sign-in in a team's
space); Bill C-36 passes (see `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md`)
**Depends on facts:** `LEGAL_FACTS.md` § two privacy roles, § where data lives (Gmail inbox, ImprovMX, organization
deletion), § consent and email mechanics (every active owner gets the purchase email)

## Question(s) this answers
The drafted "Ask us to delete {name}?" window and its Plan & billing section (drawing
https://claude.ai/artifact/K6TYzjQ1NZSZxfug9u4Rpz tab 6; `docs/projects/active/SETTINGS_BOTH_WORKSPACES_DRAWINGS.html`),
for the Premium Coaches Portal and Tournament / Tournament Plus — the seven questions put with it. Plans:
`TOURNAMENT_PLAN_MISSING_SETTINGS_PLAN.md` Stage 2, `RETIRE_OLD_TOURNAMENT_ONLY_NAV_PLAN.md` step 2b. Owner rulings
taken as given (2026-11-20): placement last on Plan & billing, owner-only; each request recorded (A10); a request does not
cancel the plan and the window says so (A11).

## Finding
1. **This is a customer's instruction, not an individual's privacy request.** Terms §4: everything an organization puts
   in is the customer's ("It is yours"); we act as its service provider and process it "to carry out your instructions".
   Deleting the organization is that instruction. Privacy Policy §11's rights (and its 30-day promise) are about
   information **we** hold about a person (§3, §4) — the requester's own account. The window must keep the two apart,
   and the draft does: what is deleted (the organization), what isn't (your sign-in), where a person asks instead
   (privacy@fieldlogichq.ca, the §2 contact).
2. **The 30 days.** PIPEDA's 30-day limit (s. 8(3), Principle 4.9) is for access requests; nothing in PIPEDA sets a
   deadline for acting on a customer's instruction to delete its own data. Promising a **reply** within 30 days is a
   voluntary promise matching §11's tone. It is safe to make **because** the request is now recorded (A10) and so can be
   shown to have been met. Promise the reply, not the deletion date: nothing in the product deletes on a clock, and
   deletion waits on things outside our control (below).
3. **What survives deletion — the draft's "What isn't" line was too thin.** Published Privacy Policy §9: an
   organization's deletion keeps (a) our tax and billing records (about six years), (b) "our record that the deletion
   happened (the organization's name and web address, who deleted it, when and why)", and (c) copies in routine backups
   that "age out on our database host's schedule". Each person's Terms-acceptance record is tied to their account and is
   untouched. A window that names only "records the law makes us keep" understates (b) and (c). Not a falsehood, but a
   window is where a customer reads what deletion means; say all three in plain words.
4. **Accounts are not deleted.** The platform-admin deletion (`app/api/platform-admin/orgs/[id]/delete/route.ts`) has no
   account deletion in it (checked 2026-11-20: no `auth.admin.deleteUser`); people keep their sign-ins and lose the
   organization. "Your own sign-in" is accurate; the coaches' and staff's sign-ins are kept too, worth one clause.
5. **⚠ A paid plan blocks deletion — the draft's A11 line is incomplete.** The same route **refuses to delete while a
   Stripe subscription is not cancelled** (`:174-181`, "Cancel it first … then return here to delete"), and while a card
   dispute or bank debit is open (`:185-190`). A Premium owner who cancels on the billing page keeps the plan to the end of
   the paid period (Terms §8), so the subscription is still live until then. So a paying customer's request is answered
   in one of two ways only: **we delete when the paid period ends**, or **staff cancel the subscription immediately and
   delete now** — and Terms §8 gives no refund for the unused part. "Cancel it first if you don't want another payment" is
   true but does not tell the customer that deletion cannot happen before the paid time runs out unless they give it up.
   For a coach buying as an individual (Terms §16, `ONTARIO_CONSUMER_INTERNET_AGREEMENTS.md`) an early end with no refund
   must be said before they choose it.
6. **More than one owner.** The purchase email and yearly reminder go to **every active owner** (`LEGAL_FACTS.md`). A
   deletion request from one owner, confirmed only with that owner, lets one owner delete an organization the others
   run. The confirmation should go to every active owner, and deletion should wait for the sender's confirmation with the
   others copied (one confirmation is enough — a co-owner can object in reply).
7. **Families' information.** Deleting a team or organization deletes families' contact details and children's records
   it held. As service provider we follow the customer's instruction (Terms §4); the families' relationship is with the
   club or coach (Privacy Policy §5: "please contact the club first"), and nothing obliges us to notify them. No change to
   the window beyond asking the requester to download what they need first (Terms §9 says the same at plan end).
8. **Where requests land.** The route emails `fieldlogichq@gmail.com`; privacy@fieldlogichq.ca forwards into the same
   Gmail through ImprovMX (`LEGAL_FACTS.md`). Same inbox, two addresses. Sending the request to **privacy@** keeps every
   deletion request under the one address the policy names. Nothing new reaches a supplier either way: ImprovMX and Gmail
   already carry privacy@ mail.
9. **The record (A10).** Privacy Policy §3 already lists "a request to delete your organization" among what we hold "to
   answer you", so recording it is not a new purpose. §9 says nothing of how long it is kept. Keep it with the
   organization; on deletion it becomes part of "our record that the deletion happened" (which §9 already promises, with
   the same fields: name, web address, who, when, why). Hold no more than the email holds today, plus its status and when
   we answered.
10. **CASL.** Our reply is a response to the owner's own request with no commercial purpose: not a commercial
    electronic message. Keep it that way — no win-back offer, no "come back" pricing in the reply.
11. **Staff who are not owners.** They never see this door, and the window is not their route: Privacy Policy §11
    (privacy@) covers their own information, and §5 sends members to the club. No change here. The missing "close my
    account" door on the Account page is a separate gap (policy: "email privacy@").

## What the product does today
- The window and route (`components/admin/kit/club/SettingsKit.tsx:351-373`; `app/api/admin/org/request-deletion/route.ts`):
  owner only, emails the Gmail inbox (org name, slug, id, owner email, plan, reason, time), **records nothing**, sends the
  owner nothing.
- Platform-admin deletion: refuses an active subscription and money in flight; deletes the organization's rows and files;
  leaves accounts; keeps the deletion record (Privacy Policy §9).
- A Tournament or Premium owner has no deletion door at all today (club Settings only); a cancelled Premium coach none.

## Recommendation
Apply to the window and its section (drawing tab 6, wording v0.2; the build takes it from there):

**Section (last on Plan & billing):** "Delete {name}" · "Ask us to delete {what} and everything in it. Nothing is deleted
until you confirm by email." · white button, red words: "Request deletion…" · once sent, until answered: "Request sent
{date}. We'll reply to {owner email} within 30 days."

**Window:**
- Title: **Ask us to delete {name}?**
- "We'll reply by email to {owner email} within 30 days. Nothing is deleted until you confirm." With more than one owner:
  "We'll reply to {name}'s owners within 30 days. Nothing is deleted until you confirm."
- **What is deleted** — Premium: "The team's Coaches Portal and everything in it: every season, the roster and families'
  contact details, money records, documents, and the tournaments you run." Tournament: "The organization and everything
  in it: every tournament with its teams, schedule, results and registrations, your staff list, and the payment records
  here." Then: "Download or print anything you need to keep first."
- **What isn't** — "Your own sign-in, and your coaches' (or: your staff's). They lose access to {name}. To close your own
  account, or to ask what we hold about you, email privacy@fieldlogichq.ca." · "Our records of what you bought, and a
  note that {name} was deleted, by whom, when and why (our privacy policy, section 9)." · "Copies in our backups, which
  expire on their own."
- **Paid plan (Premium, Tournament Plus) — replaces the A11 line, owner call L-A, ⚖ ruled yes 2026-11-20** (and L-B, copy
  every active owner, ruled the same day): "{Plan} is paid until {date}. We can
  delete {name} then, or now. Deleting now ends {plan} early, and the time left isn't refunded. Tell us which when we
  reply." — and no "Cancel it first" pointer (cancelling does not make deletion sooner).
- Online payments part (Tournament Plus with payouts): unchanged, shipped text — except "Export them first from
  Accounting" must name a page the organization has (a build check, not wording).
- "Why are you leaving?" (optional) · "For our records. You can leave it empty."
- Buttons: "Don't send" · red "Send deletion request".

**Build:** send the request to privacy@fieldlogichq.ca; record it (A10: organization, who asked, when, reason, status,
when answered; kept with the organization, then as part of the deletion record); email the confirmation to every active
owner; the reply carries nothing commercial.

**Privacy Policy, next version:** one §9 clause — a deletion request and our answer are kept with the organization, and
after deletion as part of our record that it happened. §3's row already covers holding it. Carried forward in the index.

## Sources
- Personal Information Protection and Electronic Documents Act, s. 8(3) and Schedule 1 Principles 4.1, 4.5.3, 4.9 —
  via `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md` (verified 2026-11-05, not stale).
- FieldLogicHQ Terms of Service 2026-11-17 §4, §8, §9, §16 (`lib/legal-documents/terms/2026-11-17.md`) — read 2026-11-20.
- FieldLogicHQ Privacy Policy 2026-11-17 §2, §3, §5, §9, §11 (`lib/legal-documents/privacy/2026-11-17.md`) — read 2026-11-20.
- Code: `app/api/platform-admin/orgs/[id]/delete/route.ts:97-98, 174-190`; `app/api/admin/org/request-deletion/route.ts` —
  read 2026-11-20.

## Lawyer's eye needed?
No for the window. Optional, low: whether one co-owner's confirmation should be enough to delete an organization others
own (finding 6) — a governance question the Terms do not answer today, worth a line in the Terms' next version.
