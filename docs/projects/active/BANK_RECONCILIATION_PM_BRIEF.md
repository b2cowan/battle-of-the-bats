# PM brief: the bank balance check (both portals)

**Plan:** `BANK_RECONCILIATION_PLAN.md` · **Drawings:** https://claude.ai/artifact/XdxsbzGpGwyDvWttJcjFeN ·
**Priority:** High (inside the Club release, owner 2026-10-12; planned and drawn before Stage 8) · **Status:** re-planned
2026-11-05 by the owner. Ten drawing asks ruled as recommended 2026-11-05; plan rewritten 2026-11-05; three edge-case
asks (Q1–Q3) ruled as recommended 2026-11-05. Next: stage BC1, behind the scenes. The earlier tick-off version (built on dev 2026-11-04/05) is
superseded and is taken apart in BC1.

## What it does

A club treasurer, or a team's coach or team treasurer, opens their bank statement and types two things: the statement's
**date** and its **balance**. FieldLogicHQ counts every line in their books up to that date and shows three figures side
by side: **The bank says**, **Should be in the bank**, and the **Difference**. When they agree it says **Matches**. When
they don't, it says **Off by $75.00**, says which way, and helps find it. They save the check either way.

## Why it matters

- **It fits how volunteers actually work.** Treasurers and coaches aren't accountants. They log what they see in the bank
  and want to know "are my books right as of the statement?" Ticking off every line, the earlier design, was an
  accountant's job; the owner stopped it for that reason.
- **It is the form associations already ask for.** Minor-hockey associations ask each team for a monthly bank
  reconciliation: bank balance, plus deposits not yet in, less cheques not yet cashed, equals the books. The balance
  check is that form, and its saved check prints as that page.
- **It makes a claim true again.** "Payment reconciliation" came off the Club pages on 2026-10-19 because nothing did it.
- **Competitors don't do it.** Team apps track payments but don't check the bank; accounting tools do, but volunteers
  don't run a team in QuickBooks.

## What people see

- **Club:** Accounting → **Bank**. The first time, they pick a statement they already have and type its date and balance
  ("Start checking Club chequing"). From then on, the check sits at the top of the tab and the saved checks sit below.
- **Coach:** Money → Ledger → View: **Bank**. No starting question: the season's opening balance is the start. An
  optional box, **Cash not deposited yet**, covers the envelope of cash a coach hasn't banked.
- **When it's off, Find helps:** a line of exactly the difference ("Cheque #214 is exactly $75.00, the bank may not have
  cashed it yet"), a line of half the difference (entered the wrong way round), or two or three lines that add up to it,
  plus the list of lines since the last check that matched. Two buttons: **Not in the bank yet** (counts that cheque as
  still waiting, for this check), and **Add the missing line** (opens the usual add form, filled in, for a bank fee or
  interest they hadn't entered).
- **Online payments (club only):** money families paid online that Stripe hasn't paid out yet shows as one line, "Online
  payments on their way to your bank", worked out automatically. If Stripe can't be reached, the line says so and isn't
  counted.
- **Saved checks:** each one shows the bank's figure, what should have been there, and the result. Any check can be
  deleted, and the record keeps who did it and when. If someone edits the books afterwards, the saved check keeps its
  figures and adds a quiet **Books now say $X**. Nothing warns or blocks on the money forms.
- **Elsewhere, quietly:** one line on each Overview ("Bank: Club chequing checked through Oct 31, 2026", with an amber
  "Off by $X" when the latest check is off); each team's mark on the club's Teams tab; a printable one-page report with
  signature lines; a reminder (never a block) at the fiscal-year close and at the coach's season close.

## Who can do what

- **Club:** whoever can move club money checks; on the club side today, that is everyone who can open Accounting.
- **Coach:** money write can check; money read sees the checks and the mark but not the form.
- **The club** sees each linked team's mark, read-only. A standalone team's mark is seen by no club.
- **Plans:** part of Accounting on Club and Club · Association; on the coach side, the Premium Coaches Portal. No price or
  plan change (logged 2026-11-04).

## Tradeoffs made

- **No line-by-line ticking.** Faster and plainer. What it gives up: a check that's off says *how much*, not *which
  line*. Find's hints narrow it down.
- **Cash is one figure, not a cash box.** Nothing changes on any money form. A cash box can come later as a second
  account.
- **Three edge cases, ruled 2026-11-05:** a cheque that crosses a coach's season rollover can still be found (Find also
  looks at the end of last season); a cheque written before the club's starting statement and cashed after it can be
  marked "Waiting at the start", which fixes every later check; and when a book moves to a different bank account,
  earlier saved checks keep the books they counted.

## Success criteria

- A treasurer with a statement in hand reaches "Matches" or a named "Off by" in under two minutes on a desk or a phone,
  without help.
- The two worked examples in the drawings (Lakeshore Lynx club, Ridge 13U coach) figure exactly as drawn.
- A check that's off by a single uncashed cheque names the cheque in Find.
- The printed report carries the association's formula and two signature lines.
- Nothing in the bank check writes to the books on its own.
- The owner walk passes in both portals, desk and phone, before "bank reconciliation" returns to any Club page.
