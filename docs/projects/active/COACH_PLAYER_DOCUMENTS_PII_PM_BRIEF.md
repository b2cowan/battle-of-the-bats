# PM brief — Who can open a player's medical form

**Status:** planned, awaiting go-ahead (2026-07-31) · **Priority:** high (ship before the first rep team is built)
**Plan:** `COACH_PLAYER_DOCUMENTS_PII_PLAN.md`

## The problem, in one screen

A head coach invites an assistant. By design that assistant gets the everyday tools and
**not** family contact details — so on a player's page they see the guardian name, email,
phone, birthdate and medical notes fields deliberately blanked out.

Directly underneath those blanked fields is a Documents table listing that same child's
**Medical Consent** and **Waiver** PDFs by filename, with a working Download button. The
files themselves routinely contain the very guardian details and medical history the fields
above just hid.

The screen hides the information and then hands over the document containing it.

## Why it happened

"Documents" currently means two different things under one switch: blank team forms
(harmless, genuinely useful to an assistant) and completed forms signed for an individual
child. Only the first one is what the June decision meant by "documents view-only by default".

## What changes

**1. Completed player forms now need family-contact access too.** An assistant sees a
child's signed waiver or medical consent only if the head coach has granted *both*
Documents *and* Contacts & birthdates. Blank team forms are unaffected — assistants keep
those. Head coaches and org admins are unaffected; they already have both.

**2. Documents moves out of "Sensitive access" into "Everyday coaching."** Once it only
grants blank team forms, it no longer warrants a warning.

**3. Two missing confirmations get added.** The Sensitive group promises "You'll be asked
to confirm before granting these" — but only 3 of 6 actually asked. **Tryouts** and
**Internal notes** handed over silently, and Tryouts is the widest of them: guardian contact
details for prospective players, children not yet on the team. Both now prompt. We fixed the
behaviour rather than softening the sentence — "some of these" would tell a coach nothing
about which.

**4. A second, quieter door gets closed.** Investigation found the database itself would let
any assigned coach read the full unredacted roster — guardian emails, phones, birthdates,
medical notes — straight from the browser, bypassing every check the app makes. Closing only
the screen would have left that open. This one needs your go-ahead separately as it touches
the database.

## Customer impact

**Nobody loses anything.** No organization has built a rep team on production yet — zero
teams, zero assistant coaches, zero uploaded documents. This is a defect caught *before* the
first real family's medical form ever lands in it. No mid-season access reduction, no notice
to head coaches, no migration of existing grants.

That is also the deadline: the moment the first customer uploads a medical consent form,
this stops being theoretical.

## Tradeoffs

- **Two switches instead of one dedicated "Player files" switch.** A dedicated switch would
  be more literal, but costs a database migration, new grid UI, and a fourth access decision
  per assistant — to express what the two existing switches already say together.
- **An assistant who legitimately needs to check a waiver now needs contact access too.**
  Correct: reading a child's signed medical form *is* seeing their family's details. The head
  coach makes that call deliberately, with a confirmation prompt.
- **One more prompt when granting Tryouts or Internal notes.** Friction on purpose, on the
  two grants that were quietest about what they hand over.

## Success criteria

- An assistant with Documents but not Contacts sees no player-documents section at all — and
  a direct link to the file is refused, not just hidden.
- The same assistant still opens blank team forms from the Documents page.
- Head coaches see no change anywhere.
- Every item remaining in "Sensitive access" prompts before granting; none prompts on revoke.
- With the database change applied, a coach's own browser session reads zero roster rows
  directly.
