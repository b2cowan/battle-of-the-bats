-- ---------------------------------------------------------------
-- Migration 337 — a team book files its dues under "Player dues" (owner 2026-10-18, tab consistency)
--
-- WHY: the coach's tab names went sentence case (commit 527079d1: "Player Dues" → "Player dues" everywhere a
-- customer reads it, held by check:spelling). The two writers that mirror dues into a team's book — a family's
-- payment (income) and a credit paid back out (expense) — now file the line under 'Player dues'. Every line they
-- wrote before still says 'Player Dues', and the club Ledger's Category filter lists DISTINCT values, so a book
-- spanning the change would offer both and splitting by one would hide the other half. One spelling, in the data too.
--
-- WHAT CHANGES: accounting_entries.category 'Player Dues' → 'Player dues' on lines in TEAM books with no budget word.
-- Nothing else on the line moves (amount, date, status, links untouched).
--   · No budget word (budget_category_id IS NULL): a line a club filed under its OWN word named "Player Dues" carries
--     that word's id and keeps the club's spelling — the word is theirs, not ours.
--   · Team books only: the dues mirror writes nowhere else, and the club fiscal lock (accounting_entries_fiscal_lock)
--     refuses a category change on a closed year's line in an org / tournament / league_season book. Team books are
--     outside that lock, so this cannot fail on a closed year.
--
-- BLAST RADIUS, measured on both databases 2026-10-18 just before writing this (read-only queries):
--   · dev  — 145 lines, all in team books: 17 still linked from rep_dues_payments / rep_dues_payouts /
--            rep_player_dues_installments, 128 voided lines whose payment or payout was taken back (descriptions
--            "Player dues — …" and "Dues credit paid out — …"; the void keeps the audit trail).
--   · prod — 17 lines in one team book: 12 linked, 5 voided ("Player dues — …", $4,750.00 taken back).
-- No line on either database is filed under a budget word.
--
-- ORDER: any time. Safe to run twice (the second run matches nothing). Prod: at the promote that ships 527079d1 —
-- a dues payment recorded on prod between this and that deploy would still be written 'Player Dues' by the old code,
-- so run it AFTER the deploy lands, or run it again then. INVISIBLE to the drift check: declared in
-- MANUAL_PROD_STEPS.json. Verify: SELECT count(*) FROM accounting_entries WHERE category = 'Player Dues'
-- AND budget_category_id IS NULL → 0.
-- ---------------------------------------------------------------

UPDATE public.accounting_entries
   SET category = 'Player dues'
 WHERE category = 'Player Dues'
   AND budget_category_id IS NULL
   AND ledger_id IN (SELECT id FROM public.accounting_ledgers WHERE entity_type = 'team');
