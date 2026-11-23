-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 527 · A DEAL'S LINK MADE WITH NOTHING EMAILED, AND THE INVOICE COUNTER KEPT TO ITS STEP
-- Board Ready Stage 6, Part 2 (owner rulings 2026-11-23 on the link-only drawing: 1A Make the link only, 3A the reason
-- keeps its own date; plan BOARD_READY_PLAN.md §5 Stage 6).
--
--   club_sponsor_deals.link_unsent_at  NEW. The last new link made with nothing emailed: "Make a new link" on a deal made
--     as a link only, or "Send the link again" once the offer's reason has run out (paid more than two years ago, asked more
--     than six months ago). The deal's history says "new link made Mar 9, not emailed". Null until that happens.
--   club_sponsor_invoice_counters      service_role's grant taken away. Only club_sponsor_deal_receive (SECURITY DEFINER,
--     owned by postgres) takes a number; the server never reads or writes the counter, and a delete through the Data API
--     would let a number be issued twice.
--
-- Additive and re-runnable. ORDER: after 526.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.club_sponsor_deals ADD COLUMN IF NOT EXISTS link_unsent_at timestamptz;

COMMENT ON COLUMN public.club_sponsor_deals.link_unsent_at IS
  'The last new link made with nothing emailed (Make a new link; Send the link again after the reason ran out). Mig 527.';

REVOKE ALL ON public.club_sponsor_invoice_counters FROM service_role;
