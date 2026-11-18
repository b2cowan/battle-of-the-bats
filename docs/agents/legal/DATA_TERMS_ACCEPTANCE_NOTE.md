# How a club accepts the Data Terms, and what that needs from the product
**Last verified:** 2026-11-18
**Re-verify by:** the Terms version that carries the Data Terms is drafted; or a trigger: the acceptance record changes
shape; a club asks to sign a separate agreement
**Depends on facts:** `LEGAL_FACTS.md` § What does NOT exist (the accept step, mig 455: account id, email, both versions,
box sentence, door, time); published Terms 2026-11-17 §4, §13, §18, §19, §20

## Question(s) this answers
How does a club accept `drafts/DATA_TERMS_FOR_ORGANIZATIONS.md` — a separate signature, a separate tick, or the existing
Terms acceptance — and what must the product change?

## Finding
**The Data Terms are part of the Terms of Service, so a club accepts them by the tick it already gives.** No signature,
no second box. Three reasons:
1. **The record already pins the version.** The accept step records which Terms version (and which privacy version) each
   account holder ticked, and the Terms §20 promise keeps it six years. If the Data Terms change only with a new Terms
   version, the recorded Terms version names the Data Terms text exactly. A separately versioned document would need its
   own column in the acceptance record (a migration) and its own "accept again" door.
2. **Our own suppliers do it this way.** Supabase's, AWS's and Resend's data-processing terms are part of their service
   terms, accepted with them (`LEGAL_FACTS.md` § supplier data-processing terms). A board recognizes the shape.
3. **Adding them needs no fresh acceptance.** The draft adds obligations to FieldLogicHQ and none to the club beyond what
   Terms §4 already sets, so under Terms §18 it is not a change that "reduces your rights or increases what you pay": it
   takes effect when posted. **Keep it that way** — a clause that puts a new duty on the club turns this into a §18
   change with 30 days' notice and a tick at next sign-in.

**The sub-processor list is not accepted at all.** It is a living page with a dated change table, and the Data Terms §6
make the promise (notice before a new company). Changing the list is a notice, not a new contract version.

**A club that asks to sign something.** Offer the same text as a PDF with the version date, countersigned by the owner if
the club insists. Don't negotiate per-club terms: one text for every club is what lets the record above stay true.

## What the product does today
- The accept step at every account door, append-only record, current-Terms check before a purchase or a new organization
  (`LEGAL_FACTS.md` § What does NOT exist, superseding note 2026-11-16).
- Legal pages are frozen dated files served at /legal/terms and /legal/privacy, with a `draftPath` preview for the next
  version (`LEGAL_INDEX.md` § Drafts the dev preview reads).
- Nothing renders a Data Terms page or a sub-processor list (census 2026-11-18).

## Recommendation
**Text edits to the Terms (the next Terms version, `drafts/TERMS_OF_SERVICE.md`):**
- **T1 · §4** — after "Licence to us": "**Our Data Terms.** Our Data Terms for organizations [link] are part of these
  Terms. They set out how we handle Customer Data for you: what we never do with it, the companies that help us, where it
  is handled, what we do if something goes wrong, and how you get it out."
- **T2 · §13** — "the hosting and email providers named in our Privacy Policy" → "the companies on our list of the
  companies that handle your information [link]"; and the closing "(Privacy Policy §6)" → "(our Data Terms §6)".
- **T3 · §18** — "Smaller changes (for example, fixing a typo or naming a new service provider) take effect when we post
  them." → "Smaller changes (for example, fixing a typo) take effect when we post them. Before a new company starts
  handling Customer Data, we tell account owners as our Data Terms (§6) say."
- **T4 · §19 Whole agreement** — the draft's sentence becomes "These Terms (including our Data Terms) and the Privacy
  Policy, together with the Payments Terms for an organization that takes payments online, are the whole agreement
  between us about FieldLogicHQ."

**Which Terms version:** recommended, **the held next version** (the one that publishes with the Payments Terms), if the
owner approves the Data Terms before that day; otherwise the version after. Owner question 6.

**Route to `/plan` (not code here):**
1. **Render two pages** beside the Terms and Privacy Policy: the Data Terms (frozen as part of the Terms version, the same
   hash check) and the sub-processor list (a dated living page; it may change without a Terms version). Link both from
   the Terms §4, the site footer's legal links, and the Security page when it exists.
2. **A way to send the 30-day notice** to every organization's owners. At today's size the owner can send it by hand
   (one message per organization, from the business address); a build is worth it only when the number of organizations
   makes that impractical. Record each notice's date in the list's change table either way.
3. **No change to the acceptance record.** Nothing new is ticked.

## Sources
- Published Terms of Service, version 2026-11-17 (`lib/legal-documents/terms/2026-11-17.md`) §4, §13, §18, §19, §20 —
  read 2026-11-18
- [Supabase DPA](https://supabase.com/legal/dpa), [AWS Service Terms §1.14.1](https://aws.amazon.com/service-terms/),
  [Resend DPA](https://resend.com/legal/dpa) — the incorporation-by-acceptance shape, read 2026-11-08 and 2026-11-18

## Lawyer's eye needed?
Briefly — whether incorporating the Data Terms by reference into a click-through is enough for a club that is itself a
non-profit corporation with a board (it is the norm, and the record shows who ticked and which version). Not a blocker.
