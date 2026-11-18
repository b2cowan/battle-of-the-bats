# The payer's name on the club ledger (online payments)
**Last verified:** 2026-11-18
**Re-verify by:** the ledger export or a purge path changes; the guardian tier or a family-facing statement reads ledger lines; first Québec customer; Bill C-36
**Depends on facts:** `LEGAL_FACTS.md` § FieldLogicHQ's two privacy roles (service provider to the club for the club's records); § Personal information the product holds

## Question(s) this answers
A landed card or bank payment now writes the payer's name on the club's ledger line: a house-league guardian's full name, or a tournament team's coach (`stampPayerOnLines`, `lib/online-payment-landing.ts`). The ledger shows it, with how it was paid ("Online, card"). Does that need a policy, Data Terms or consent change? Is any of it a child's information?

## Finding
**No policy, Data Terms or consent change is owed; nothing blocks the commit. Three things the owner should know.** Not legal advice; a lawyer is not a gate.
- **No new collection, no new purpose, no new audience of consequence.** The guardian's name and the coach's name are already held and are already what the dispute file calls "the payer"; the line is already named for the child. The published policy covers a guardian's "payments and amounts owed" (privacy 2026-11-17, ~L79-81) and says the club controls which of its people see which records (~L154-155). The new text is read by the same accounting seats that already read the line. Role in PIPEDA terms: FieldLogicHQ is the club's service provider for this; the club decides who holds Accounting.
- **Not a child's information.** An adult's name. The child's name was already in the line's description; nothing new about a child is added (no date of birth, medical or consent detail).
- **The audience is a little wider than the old line, narrower than the registrar's screen.** Anyone holding Accounting (owner, admin, treasurer by default; a registrar only by an owner's grant) now reads a guardian's name on a house-league fee line, where the line had no detail before. Registrars, coaches, families, public pages, the statement, bank reconciliation and email do not read it (census, 2026-11-18).

**Three items the owner decides (none blocks):**
1. **A deletion request cannot reach the name.** No purge touches `accounting_entries.payee_payer`; lines go only with the organization (cascade); a line in a closed fiscal year cannot be edited. The policy says a child's record is deleted at the club's or a parent's request (~L226-229) and says nothing about ledger lines. This is the same gap that already exists for the child's name in the line's description, and belongs with backlog **L9** (retention and purge of player information); say so in the next policy version rather than promise a clearing the product does not do.
2. **The Ledger export now carries the name** (the Detail column). The catalog entry says `includesSensitiveFields: false` (`lib/export/catalog.ts:246`); a guardian's full name is personal information, so that flag is now arguably stale. The export is for owner/admin/treasurer only and the file leaves the system once downloaded. Flipping the flag is the owner's call (it is documentation; check what the export menu does with it first). **Fixed in the same change:** the export now neutralises a name that starts with `=`, `+`, `-` or `@` (a guardian's name is typed by a stranger on the public sign-up form), so Excel cannot run it.
3. **A cleared payer comes back.** If staff blank the payer on a landed line, the next replay of the landing writes it again (only an empty payer is filled). Rare; say so if a club asks for a name to stay off.

## What the product does today
- Writer: `lib/online-payment-landing.ts` `stampPayerOnLines` (called at the three landing points; fills only an empty payer and an empty payee link; 200 characters; never blocks a landing; logs ids, not names).
- Readers: the Ledger tab, its edit window, the raw entries route, and the Ledger export. Gate: the Accounting module (capability plus plan). Not read by the Payees list, the house-league money reads, the season ledger route, bank reconciliation, the budget reads, the coach portal, the statement, emails, public pages or the audit log (census read 2026-11-18, path:line in the session record; the reviewer confirmed the route gates).
- Name is not stamped on refund or processing-cost lines; payments that landed before this change are named when their landing is next replayed.

## Recommendation
Commit as built. At the next privacy version, add one sentence that a club's ledger records who paid, and what a deletion request does and does not reach (with L9). Decide the export flag. Nothing for `/accounting`.

## Sources
- Code and census 2026-11-18 (this session); `lib/legal-documents/privacy/2026-11-17.md` ~L79-81, ~L154-155, ~L226-229.
- `BOARD_READY_DATA_TERMS_REVIEW.md` (the service-provider role); backlog L9 in `LEGAL_INDEX.md`.

## Lawyer's eye needed?
No gate. If the owner wants one later: whether a club's ledger lines are a "record" a family's deletion request must reach, and the export flag.
