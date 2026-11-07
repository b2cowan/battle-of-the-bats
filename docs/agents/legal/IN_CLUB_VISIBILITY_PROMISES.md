# What the product tells a coach about what the club sees (in-club visibility promises)
**Last verified:** 2026-11-07
**Re-verify by:** 2026-11-07 + 12 months, or a trigger: Club tier goes on sale; the data-processing terms for clubs are drafted;
the guardian tier / family accounts ship (a family-facing sentence about who sees what would then exist); a coach team that
is NOT club-owned can open a club's Money › Club tab.
**Depends on facts:** `LEGAL_FACTS.md` § FieldLogicHQ's two privacy roles; § Who the customers are (nothing sold; Club not on sale).

## Question(s) this answers
The coach was told the club "never sees your families' payments", while the club's Families page shows each club-owned rep
family's dues figures. Was the old wording a privacy exposure, is the new wording sound, and does any FieldLogicHQ policy
draft promise something about what a club sees of a coach's families?

## Finding
- **Who is the organization.** For a club-owned rep team, the families' information is the **club's** under PIPEDA. The head
  coach handles it for the club, and FieldLogicHQ is the club's service provider. A club administrator reading those dues
  figures is the same organization reading its own records. That is not a disclosure to a third party, and PIPEDA's consent
  principle is not engaged by it. Using dues figures to chase what is owed is within the purpose they were collected for
  (registration and fees, PIPEDA Sch. 1 principle 4.5).
- **Who was promised what.** The sentence spoke to the **coach**, an account holder, about the club's view of the team's
  books. No family-facing text makes a who-sees-what promise. A census on 2026-11-07 found none; the player-notes field says
  "private to your coaching staff", which is a separate matter. So the defect was a broken product promise to a user, not a
  privacy-law promise to the people the data is about. It still needs fixing: a product sentence that is false is a defect
  whatever the law says.
- **Past exposure: none practical.** Club is not on sale and nothing has been sold, so no real coach on a real club relied on
  the old line. If one had (for example by telling families "the club can't see your payments"), the exposure would be a
  misled-user complaint, not a statutory breach.
- **Policy drafts.** `drafts/PRIVACY_POLICY.md` §5 promises only that we "display it to the people the club authorizes".
  That is consistent: inside a club, who sees what is the club's own choice, made through Families access. No draft promises
  coach-book privacy against the club. The Terms draft is silent.

## What the product does today
Checked 2026-11-07:
- **Families, per child on a club-owned rep team:** the season's dues, paid and balance (`lib/child-page.ts` ~158-166,
  `lib/child-page-words.ts:63`), and when a dues reminder last reached the family ("Chased", `lib/help-content/families.tsx:93`).
- **The Families export** adds fundraising credits, other credits and amounts handed back (`lib/families-export.ts` ~110-118).
- **Totals only.** Families shows totals, not individual payment entries.
- **Who can open it:** anyone given Families; a member limited to some teams never has it (`lib/families-access.ts`;
  help `families.tsx:274`).
- **The club also sees** what the team recorded paying the payees the club shares (`lib/club-money-words.ts:605`). So
  "never sees your spending" would be **false**; "your other spending" is true.

## Recommendation
**Approve the change, with one wording correction.**

**Coach line** (Money › Club foot):

> "{Club} sees what you owe it, your requests, your cash on hand and what you pay the payees it shares. On its Families page
> it also sees each family's dues: what's owed, credited, paid and handed back, and when a reminder last reached them. It
> never sees your other spending or the rest of your books."

**Club side.** The cash line becomes:

> "(one figure; never its other spending or the rest of its books)"

The new line in "The coach's, and you can read it" says "what each family owes and has paid", **not** "payments". The
word "payments" reads as individual payment entries, which the club does not see.

**Build check.** The coach line must show only where the team's families really appear on that club's Families page (club-owned
rep teams). If any team that is not club-owned can see the Club tab, the sentence would be false the other way. Verify this
when the build lands.

**When the data-processing terms for clubs are drafted** (index row "not started"): in-club boundaries (coach books against
the club) are **product features, not privacy commitments**. Say only that the club controls who in it sees what. Never
write the coach/club split into a contract as a promise.

## Sources
- [PIPEDA, Schedule 1 (principles 4.1 accountability, 4.3 consent, 4.5 limiting use)](https://laws-lois.justice.gc.ca/eng/acts/P-8.6/page-7.html), section headings relied on, text not re-fetched this session. Fuller reading in `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md`.

## Lawyer's eye needed?
No for this wording. Yes later, as part of the data-processing terms for clubs: how a club-owned team's coach (a volunteer
handling the club's records) is described, and whether the club or the coach answers a family's access request for dues
records.
