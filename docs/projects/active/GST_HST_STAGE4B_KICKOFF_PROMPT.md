# GST/HST · Stage 4b kickoff: get the return worksheet ready to build (PLANNING session, not a build)

> Written 2026-11-07, right after GST/HST Stage 3 closed (ledger §477–§479, commit `3bc1457e0`). Recommended model: Opus.
> Plan of record: [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §4 Stage 4. Bookkeeping ladder: [BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md](BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md) §3 (rows 3, 4a, 4b).
> Drawings and rulings: https://claude.ai/artifact/LbCjjVcnZeTP8uUT3yVZan (source `GST_HST_STAGE4_DRAWINGS.html`, tabs 5–8 are 4b).
> Return-line rules: `docs/agents/accounting/GST_HST_RETURN_LINES.md`. Mark every fact [V] (you opened it this session) or [H] (handed over).

## What this session produces

A **build prompt for 4b** (plus its PM brief, per AGENCY_RULES) that a fresh session can execute without guessing. No product code.
If the audit below shows a prerequisite is unbuilt, the session also writes **that** prerequisite's build prompt, and the owner chooses the order.

## Say this out loud first (disagree by default)

The ladder says 4b waits on "the Bookkeeping Reports redesign". **That redesign is not an open drawing job**: ladder row 3
("Reports that answer questions": one View pill over five views) is already **drawn and ruled** and **not built**. The gap is a
build, not a drawing. Open the code and the row before believing either this paragraph or the TODO line; if the View pill already
exists, say so and drop the dependency.

## Step 1: audit (read, don't build). Delegate the reading to a helper; verify the lines you rely on yourself

1. Bookkeeping Stage 2 (accounts list, registers) and Stage 3 (View pill, Spending / By month / Compare / Money position / Tax year): what is **built and committed** versus drawn? Row 3 says Money position needs Stage 2 and Tax year needs the owner-confirmed category-to-line mapping (Q13) and the Travel/Meals split.
2. Where 4b's sixth view ("GST/HST return") would live today: the current Reports screen's structure, and what it would cost to add the view **before** the View pill exists versus after (rework risk).
3. What Stage 3 (the sales side) now gives 4b, and what it does not: the per-invoice record table, `tax_lines`, the backfill from 2026-05-01, Bank of Canada columns, the changeable registration date from 4a.
4. What 4a gives: tax paid by type, the held-credit rule, the export's `credit_cad` column (counts only what counts; held reads 0.00; the owner may want a separate "held" column, still an open walk call).

## Step 2: decide the order with the owner (one question, with a recommendation)

- **A. Build the Reports View pill first, then 4b as its sixth view** (no rework; 4b waits longer).
- **B. Build 4b now as a view on today's Reports screen**, moved under the pill when it lands (sooner; some rework).
Recommend whichever the audit supports; do not ask if the audit settles it.

## Step 3: write the 4b build prompt. It must carry these (all ruled or recorded, do not reopen)

- **One source for sales**: the Stage 3 per-invoice record, read where it lives, never copied into the Bookkeeping store. Never read `platform_fee_invoices` or a Stripe CSV.
- **Sum GST/HST from `tax_lines`** (Canadian GST/HST lines), **not** `tax_total_cents` (that includes US tax and PST).
- **Sales by invoice ISSUE date**, not paid date. A failed or unpaid invoice still owes the tax.
- **Sales before the registration date are not "missing"**: use 4a's changeable setting, never a hard-coded date (registered 2026-09-26; CRA backdate to 2026-05-01 pending).
- **Missing answers stay visible**: list every sale with a missing GST/HST answer as an unresolved item, whether or not staff marked it "looked at"; a customer shared by two portals is listed as unresolved too.
- **Credit notes go on line 107** (103 stays gross); a lost card dispute has no credit note, so its tax stays remitted unless written off (line 107); recovered bad debt on 104.
- **USD sales**: valued at the Bank of Canada rate on the invoice date. A USD credit note's tax goes on 107 at its own day's rate (zero today, because every USD sale is zero-rated).
- **Annual filer, regular method** (no quick method). Lines 101–109, "Before you file", four honest data states, **"Mark as filed" freezes a period**, and the worksheet plus its sources inside the accountant package.
- **Reports VIEW, not a tab** (Ask 7).
- Phone behaviour, the house toolbar, and the one-spelling rule apply (the clock is "8:00 a.m.", "fiscal year" is club-side only).

## Step 4: required before hand-off

- **Product-manager UX summary** in the conversation before any plan text is final (what the owner sees and does differently).
- **PM brief** beside the build prompt; **TODO.md** gets one line (this session adds only its own line; other sessions have uncommitted TODO edits, so stage only your hunk).
- **`/accounting` review** of the build prompt (this changes what we report to the CRA): apply what it finds or record it as an owner question.
- `/design` and `/ux` only if the session also produces a drawing; otherwise not needed.
- Update the Bookkeeping ladder row 4b's State and the plan's Stage 4 status line.

## Rules of the room

- Branch `dev` only. Commit nothing until the owner says to; stage explicit pathspecs (see the partial-commit recipe in memory if a shared file has other hunks).
- Do not change hooks, settings or database checks.
- A helper's summary is a lead, not evidence: open the lines before building on them.
