-- 311 — Prod's grants match dev's: the public key keeps only what the browser genuinely uses
-- (owner go 2026-09-28: "proceed with stage 2"; plan docs/projects/active/PROD_DATA_API_EXPOSURE_PLAN.md
--  §4; finding DB_ARCHITECTURE_REVIEW #44)
--
-- THE CLASS. Row-security policies are identical on dev and prod. What differed was the GRANTS:
-- prod still carried Supabase's legacy blanket grant (anon + authenticated: every privilege on
-- every public table, and on new tables by default); dev holds only what migrations granted. So
-- on prod every permissive policy is a live door for the publishable key, and on dev the same
-- policy is inert — dev cannot reproduce any of it (migs 212, 223, 310 were all this shape).
-- Migration 310 closed the eight tournament tables. This closes the rest by making prod's
-- anon/authenticated privileges IDENTICAL to dev's, table by table — the one posture the whole
-- product is developed and walked against every day.
--
-- WHAT THE BROWSER GENUINELY USES (dev's grants, kept):
--   · chat_rooms, chat_room_members, chat_messages, chat_message_reactions, chat_poll_votes
--       authenticated SELECT — the chat panel's realtime feeds (writes go through the server)
--   · notifications  authenticated SELECT — the bell (mig 310)
--   · games, teams   column grants from mig 310 — the live bracket/scorekeeper/admin rail
--   · org_venues, org_venue_facilities                         authenticated read/write
--   · rules, rule_items, resources, venue_facilities, schedule_facility_lanes
--       anon SELECT + authenticated read/write — the rules/resources editor and venue pickers
-- Everything else: server only (service role), which is how every other read and write already
-- happens (prod edge logs 2026-09-07..27: 277,833 PostgREST calls with the secret key; the only
-- publishable-key calls were 62 server-side reads of `organizations` by proxy.ts's early
-- "Tournament tier has no org admin" bounce, which reads with the visitor's session. After this it
-- is refused and skipped — exactly what it does on dev today — and the org-admin layout, the
-- authoritative guard, redirects the same visit with the service role. No visible change.)
-- A code sweep of app/, components/, lib/ and proxy.ts found no other table read or write through
-- an anon or session client outside the keep-list below (/review, 2026-09-28).
--
-- ALSO CLOSED HERE, same door:
--   · five SECURITY DEFINER / write functions the publishable key could call via /rest/v1/rpc
--     (accepting a tryout and creating dues, claiming a schedule slot, completing a team
--     ownership transfer, an accounting transfer, the error recorder) — every caller in the
--     code uses the service role, so EXECUTE goes to nobody else. Identical on both envs.
--   · four PROD-ONLY storage policies ("Allow public delete/select/update/upload", roles
--     {public}) that let anyone upload, overwrite or delete files in the `resources` bucket. Dev
--     has none; the browser's own upload/delete go through the {authenticated} policies both
--     envs share, and public reads through "Public can read resources".
--   · prod's default privileges, so a table/sequence/function created before Supabase's own
--     2026-10-30 change does not inherit the blanket grant (dev already works this way).
--     service_role's defaults are untouched (Finding #43).
--
-- Idempotent: REVOKE of an absent privilege and DROP POLICY IF EXISTS are no-ops.

begin;

-- 1. Every public table except the browser keep-list: anon/authenticated lose read and write.
--    (games and teams are excluded because a table-level REVOKE SELECT would also strip the
--    column grants mig 310 gave them; they already match dev exactly.)
do $$
declare
  t text;
  keep constant text[] := array[
    'chat_rooms', 'chat_room_members', 'chat_messages', 'chat_message_reactions', 'chat_poll_votes',
    'notifications', 'games', 'teams',
    'org_venues', 'org_venue_facilities',
    'rules', 'rule_items', 'resources', 'venue_facilities', 'schedule_facility_lanes'
  ];
begin
  for t in
    select c.relname from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and c.relname <> all (keep)
    order by 1
  loop
    execute format('revoke select, insert, update, delete on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 2. The keep-list, to dev's exact shape.
--    chat + notifications: signed-in users READ (realtime); nobody else, no writes.
revoke select, insert, update, delete on public.chat_rooms, public.chat_room_members, public.chat_messages,
  public.chat_message_reactions, public.chat_poll_votes, public.notifications from anon;
revoke insert, update, delete on public.chat_rooms, public.chat_room_members, public.chat_messages,
  public.chat_message_reactions, public.chat_poll_votes, public.notifications from authenticated;
--    org venues: signed-in users only.
revoke select, insert, update, delete on public.org_venues, public.org_venue_facilities from anon;
--    public tournament content: visitors READ, signed-in editors write (their policies decide who).
revoke insert, update, delete on public.rules, public.rule_items, public.resources,
  public.venue_facilities, public.schedule_facility_lanes from anon;

-- 3. From now on, postgres-created objects give anon/authenticated nothing unless a migration says
--    so — dev's defaults, and what Supabase itself applies on 2026-10-30.
alter default privileges for role postgres in schema public revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke usage, select, update on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

-- 4. Server-only functions the publishable key could call.
revoke execute on function
  public.accept_tryout_and_create_dues(uuid, jsonb, jsonb),
  public.claim_next_slot(uuid, uuid),
  public.complete_team_workspace_ownership_transfer(uuid, uuid, text, text),
  public.create_accounting_transfer(uuid, uuid, numeric, date, text, text, uuid),
  public.record_error_event(text, text, text, text, text, integer, text, text, text, text, text, uuid, text, uuid, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function
  public.accept_tryout_and_create_dues(uuid, jsonb, jsonb),
  public.claim_next_slot(uuid, uuid),
  public.complete_team_workspace_ownership_transfer(uuid, uuid, text, text),
  public.create_accounting_transfer(uuid, uuid, numeric, date, text, text, uuid),
  public.record_error_event(text, text, text, text, text, integer, text, text, text, text, text, uuid, text, uuid, text, text, text, text, text, jsonb)
  to service_role;

-- 5. The prod-only storage doors on the `resources` bucket. No-ops on dev.
drop policy if exists "Allow public delete" on storage.objects;
drop policy if exists "Allow public select" on storage.objects;
drop policy if exists "Allow public update" on storage.objects;
drop policy if exists "Allow public upload" on storage.objects;

commit;
