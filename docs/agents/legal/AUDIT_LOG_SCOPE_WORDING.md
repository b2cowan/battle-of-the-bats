# The Audit log screen's scope note, and "recorded in the audit log" promises
**Last verified:** 2026-11-12 (wording review against the code; no outside sources — nothing here rests on a statute's text)
**Re-verify by:** the day the Audit log screen gains or loses an event kind (owner has ruled no expansion, 2026-11-12), or when the club data-processing terms are drafted
**Depends on facts:** `LEGAL_FACTS.md` § Personal information the product holds; the screen reads `MEMBER_AUDIT_ACTIONS` only

## Question(s) this answers
Does the scope note on the Audit log screen (club and tournament-side), and the help copy around it, say what a user will actually find? Can the Families help article say "every export is recorded in the club's audit log"?

## Finding
- The table behind the screen (`org_audit_log`) holds more than the screen shows. The screen filters to member and access changes
  (invites, removals, role, access, suspensions, Rep Teams groups, two-step settings). Family actions (family exported, emailed,
  merged, note deleted, payment recorded) and house-league sign-up contact edits are written to the table and **never shown**.
- So "it doesn't **record** families or money" would be false. The honest verb is **"isn't listed here."** Shipped that way.
- Families help said "Every export is recorded in the club's audit log." True of the table, untrue of what an owner can open:
  an owner looking for it finds nothing. That is a promise the product's screen does not keep (same class as the "club will email
  you" finding in `CASL_PRIVACY_TEAM_CHANGE_EMAILS.md`).
- Privacy angle (PIPEDA accountability and safeguards, plain terms): the law asks the organization to be able to account for who
  handled personal information and to protect it; it does not require showing the club a log. The product keeping the record is
  good practice. Telling the club it can check the record, when it cannot, is the problem.

## What the product does today
Screen: `app/api/admin/members/audit/route.ts` (`scope=members`), `lib/member-audit.ts`. Family export write:
`app/api/admin/families/[personId]/export/route.ts:31`. Promise: `lib/help-content/families.tsx:588`. Not checked: whether any
FieldLogicHQ staff screen reads the family rows.

## Recommendation
1. Scope note and member-audit help: reworded to "lists … isn't listed here" (done 2026-11-12).
2. Families help: replace "Every export is recorded in the club's audit log." with a sentence that is true today — e.g. "We keep a
   record of every export (who made it and when). It isn't shown on the Audit log screen." — or delete the sentence. **Owner
   decision pending; not edited.**
3. If the owner later wants clubs to see family activity, that is a screen build (route to `/plan`), not wording.

## Sources
Code only (paths above). No statute text was fetched for this note.

## Lawyer's eye needed?
No for the wording. A lawyer would only matter if the club data-processing terms promise the club access to activity records.
