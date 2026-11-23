# Held for the Payments Terms version

**What this is.** At the Club release (2026-11-23) the Terms, Privacy Policy, Data Terms and list of companies were frozen
as the product's own text (`lib/legal-documents/<doc>/2026-11-23.md`) and their drafts were deleted. These sentences were
**taken out of that release on purpose** (owner ruling 2026-11-22: the Club flip does not wait for online payments, so the
Payments Terms do not publish with it). They are kept here word for word, copied from the drafts as they stood in commit
`422d55a35`, and **ride the later version that publishes the Payments Terms** (`drafts/PAYMENTS_TERMS.md`). Do not lose them.

**Publishing condition then (Privacy):** the Privacy version carrying its part must be live **before the first Payments Terms
agreement is recorded on production** (the tick writes that record; the version without these words does not name it). A Data
Terms change rides a Terms version only (`DATA_TERMS_ACCEPTANCE_NOTE.md`). Start each new draft from the published 2026-11-23
file, add these, set the document's `draftPath` in `lib/legal-documents.ts`, and publish as a new dated version.

---

## Terms of Service

Held for the Payments Terms version (word for word from 0.1; do not lose)
- §1, after the Privacy Policy sentence: "If your organization takes payments online through FieldLogicHQ, our
  [Payments Terms](/legal/payments) also apply to it." (the route does not exist until the Payments Terms publish).
- §13, after "Stripe's own terms": "; taking payments online is also covered by our Payments Terms (§1)".
- §19 Whole agreement: "These Terms (including our Data Terms) and the Privacy Policy, together with the Payments Terms for an
  organization that takes payments online, are the whole agreement between us about FieldLogicHQ."

## Privacy Policy

Held for the Payments Terms version (word for word from 0.1; do not lose; restore when the Payments Terms publish)
- **Publishing condition then:** this restoration needs a Privacy version live **before the first Payments Terms agreement is
  recorded on production** (the tick writes that record; the version without these words does not name it).
- §3, acceptance row: after "which version of our Terms of Service and this policy you accepted" add " (and, for an owner who
  sets up online payments for a club, which version of our Payments Terms you agreed to for it)".
- §9, the acceptance-record bullet: "The record of which version of our Terms of Service you accepted, and of which version of
  our Payments Terms an owner agreed to for a club (§3), is kept for at least six years after your account closes, …" (the rest
  of the bullet unchanged).
- §9, the organization-deleted bullet: after "except our own tax records (above)," add " the record of the Payments Terms its
  owners agreed to (above),".

## Data Terms for organizations

Restore with it: §11, the keep-list bullet "What we keep after that": "the record of
the Terms and Payments Terms your owners agreed to" (today: "the record of the Terms your owners agreed to"). Data Terms change
only with a Terms version, so this rides the Terms version that adds the Payments Terms.
