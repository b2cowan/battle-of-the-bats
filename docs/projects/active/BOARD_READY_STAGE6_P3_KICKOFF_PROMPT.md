# Board Ready Stage 6 · Part 3 — kickoff

Paste into a fresh session: **"Read and follow docs/projects/active/BOARD_READY_STAGE6_P3_KICKOFF_PROMPT.md"**

Written 2026-11-23 by the Part 2 build session, for the session that builds Part 3.

## ⛔ Start condition
**Part 2 must be committed first** (its close-out runs from `BOARD_READY_STAGE6_P2_FINISH_PROMPT.md`; look for its hash in
`BOARD_READY_PLAN.md` §5 Stage 6). Part 3 edits the same files Part 2's `/simplify` and `/review` are still changing
(the deal page, the deal words, the deal server module, the business's page). If you find no Part 2 hash in the plan, **stop
and tell the owner** — don't build on an uncommitted Part 2.

## The task
Read and follow `docs/projects/active/BOARD_READY_STAGE6_SPONSORSHIPS_BUILD_PROMPT.md` — **Part 3** (the invoice, the money
and the books; round 1 tabs 6, 7; round 2 tabs 1 and 2). Plan of record: `BOARD_READY_PLAN.md` §5 Stage 6 — read every
ruling there, including Part 2's calls (a)–(f) and the 2026-11-23 1A/2A/3A paragraph. Its `/legal` build rules and
standing rules bind. Present the UX summary (product-manager voice) and put any open calls to the owner before code.

## What Part 2 left for Part 3
- **The invoice number already exists.** Ruled (a): a business that picks cheque or e-transfer on its page gets its
  invoice number, issue date and due date at once (`{year}-{seq:03}` per club, never reused, taken only inside the
  database step that receives the business's form). Part 3 adds the **PDF, the emailed invoice and the "Paid in full"
  receipt** to that number. Don't give out numbers a second way.
- **Words waiting on the invoice email:** the deal page's Invoiced callout says "was **issued**" (the drawing says "was
  emailed") and the history says "invoice issued" — both become the drawn words once the invoice email exists.
- **The card button** (ruled (b)): Part 2's business page shows only the drawn card-off pay block. Part 3 adds the card
  button and the flow behind it, with **the refund-policy link beside the card button** (owed from `/legal`).
- **A changed invoiced deal:** changing an invoiced deal's amount or tax is refused today ("…can't change once the invoice
  is issued. Withdraw the deal and offer it again."). Part 3's **revised invoice** replaces that refusal, and brings back
  the Charge-tax line's hint "Changing it now sends a revised invoice" (held out of the deal page until then).
- **The money band** on one deal's page shows Paid $0.00 / Owing = total as placeholders; Record a payment fills it.
  "Delivered" is derived (paid + every checklist line ticked), so paying moves the band.
- **The unsubscribe-confirmed page** wording for a sponsor ("{club} will remove you") is owed to Part 3's `/legal` pass.
- **Already done in Part 2, don't redo:** the province rate table **moved** (not copied) to its own shared module, and
  the console's money check reads it from there — the build prompt's Part 3 bullet for it is done.
- The "started to pay by card, but didn't finish" callout for a deal in Form received is already written; Part 3 makes
  it true.

## Watch for
- **Card payments run on the existing online-payments rail** (its land/post steps, its database guard on who may write a
  payment, its webhook). A new flow kind changes guarded database functions: read the guard's rules in
  `DATA_DICTIONARY.md` (online_payments gotchas) and re-create them in a new migration, never by hand. Take the next free
  migration number at the time you write it (527 was the last at this writing; other sessions take numbers too).
- **Card payments stay off in production** (Club Tier Stage 12 turns them on, not this stage). Build behind the switch;
  dev has every plan on sale by design.
- **The drawn figures are the tests** (build prompt Part 3): $1,000 + HST 13% → $1,130.00 by cheque; $1,176.39 by card
  with the sponsor paying the fee, the club receives $1,135.34 and keeps $1,000.00 after $135.34 HST; $1,036.50 with no tax.
  Both fee payers; both rails absent while the switch is off.
- **`/accounting` runs before hand-off** (CLAUDE.md: our application fee and its tax ride on this payment), and `/legal`
  on what the business is told and agrees to when paying by card (the Payments Terms blocks held in
  `docs/agents/legal/drafts/HELD_FOR_PAYMENTS_TERMS_VERSION.md` are relevant). Apply what they find or record an owner question.

## Rules
- Own checks and probes on **UAT Rep Only (`uat-rep-only`) only**; its sponsorship mailing address empty when you finish.
  The Part 2 probe (`.probe/stage6-p2-link-only-probe.mjs`) shows the sign-in pattern. No real card charges, ever.
- Production reads are counts and schema only. Don't seed or reset the demo worlds.
- New migrations to dev only at the owner's word in your session; refresh snapshots and the dictionary in the same unit.
- Restart the dev server after new files or shared-module changes (the running server keeps old modules — Part 2 saw its
  new routes 500 until a restart).
- Branch `dev`, explicit pathspecs, **no commit without the owner's yes**, no Co-Authored-By footer; record the hash in plan
  §5 Stage 6 and the board line (`OWNER_BRIEF_PROJECTS.json`) in the same commit.
- Ends as Part 1 did: `/simplify` → `/review`, `/ux` at 390 on the business's pay and receipt screens, `/docs`, the QA
  walk Artifact (exact logins, one action per step), then the commit at the owner's word.
