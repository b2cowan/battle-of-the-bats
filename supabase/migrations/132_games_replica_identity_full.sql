-- Migration 132: set REPLICA IDENTITY FULL on public.games (live-logic false SCORE_UPDATE fix)
--
-- THE BUG: the admin "Live Logic" rail (components/live-logic/LiveLogicProvider.tsx) subscribes to
-- postgres_changes UPDATE on public.games and decides whether to show a SCORE_UPDATE / GAME_COMPLETE
-- toast by comparing the OLD row's score + status to the NEW row's. But with the default replica
-- identity Postgres logs only the primary key in the WAL `old` image, so old.home_score /
-- old.away_score / old.status arrive as `undefined`. The "did the score change?" test then reads
-- `undefined !== <new>` = true on EVERY game write, so saving a bracket — which re-writes the
-- schedule fields of every game in it — pops one false "SCORE_UPDATE · HOME 0 - 0 AWAY" toast per
-- game even though no score changed (FP-3 / live-logic).
--
-- THE FIX: REPLICA IDENTITY FULL makes Postgres log the entire previous row, so the realtime `old`
-- payload carries the prior score + status and the comparison is honest. Pairs with a client-side
-- guard (LiveLogicProvider) that ignores updates whose previous values are missing, so the false
-- toasts stop even before this migration is applied.
--
-- COST: FULL replica identity writes the whole old row to the WAL on every UPDATE/DELETE of a game.
-- `games` is low-write (score + schedule edits, not a hot path), so the overhead is negligible.
--
-- Idempotent — relreplident is checked first, so re-running (or running where it was already set via
-- the dashboard) is a no-op.
--
-- DEPLOY: dev-first (apply-migration-api.mjs --dev), then prod (--prod); check:migrations gates it.

do $$
begin
  if (select relreplident from pg_class where oid = 'public.games'::regclass) <> 'f' then
    alter table public.games replica identity full;
  end if;
end $$;
