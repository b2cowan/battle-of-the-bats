-- Grant base table privileges for rules and resources.
-- The authenticated role mutates these directly from the browser (authClient());
-- without a base GRANT PostgreSQL rejects the operation before RLS policies apply.
-- The anon role needs SELECT so server-side public page reads work correctly.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rules      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rule_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resources  TO authenticated;

GRANT SELECT ON public.rules      TO anon;
GRANT SELECT ON public.rule_items TO anon;
GRANT SELECT ON public.resources  TO anon;
