-- Migration 291: the depth chart has three states — Best (ranked), Never, blank = fine.
-- (Depth chart three-states plan; owner rulings D1 + D2, 2026-09-12.)
--
-- The Positions picker and the depth chart used to offer a fourth state, "Okay", stored as
-- lineup_profile.canPlay. A coach reported it behaved the same as "Not set" and was right three
-- times over: the product's own legend defined the two with the same words; the game-day Auto-fill
-- read them as distinct only in Competitive mode (Balanced pooled Okay with Best and ignored rank,
-- Development ignored everything but Never); and nothing after Auto-fill ever showed which rung
-- had placed a player. Best is ranked and unlimited, so a fill-in spot is a low-ranked Best.
--
-- DATA-ONLY, and ⚠ INVISIBLE TO EVERY SCHEMA GATE (the mig-264 lesson): no column, index or
-- function changes. Each player's Okay positions are appended to their Best list AFTER the Bests
-- they already had, in the order the coach set them (ruling D2 — nobody loses a preference), and
-- the canPlay key is removed. Best ranks 1 and 2 live in primary_position / secondary_position and
-- ranks 3+ in lineup_profile.morePreferred, so the fold re-splits the concatenated list the same
-- way the app's own write path (lib/lineup-profile.ts:buildLineupProfileWrite) does.
--
-- ⚠⚠ COUNTED BOTH DATABASES BEFORE WRITING THIS FILE (2026-09-12, read-only via
-- scripts/db-query.mjs): dev 2 players / 2 teams carry an Okay list; prod 4 players on ONE team
-- (9 cells). That is the whole effect. The app's normalizer already IGNORES a stray canPlay key on
-- read and drops it on the next write, so either deploy order is safe; this migration exists so
-- the data is clean rather than tolerated. Verify AFTER applying by re-running the count below —
-- "with_okay" must read 0 — and record the numbers, never "applied".
--
--   select count(*) filter (where jsonb_array_length(coalesce(lineup_profile->'canPlay','[]'::jsonb)) > 0) as with_okay,
--          count(*) filter (where jsonb_array_length(coalesce(lineup_profile->'morePreferred','[]'::jsonb)) > 0) as with_best3plus
--   from rep_roster_players;
--
-- Idempotent: a row with no canPlay key is untouched by both statements.
--
-- ⚠ /review Stage 4 (2026-09-12): every canPlay position written through the app's own picker is
-- already guaranteed disjoint from Best at WRITE time (buildLineupProfileWrite strips a preferred
-- position from canPlay before it's ever saved) — but that guarantee holds only for rows the
-- picker itself wrote. This migration is the one place the app builds a profile OUTSIDE that write
-- path, so it re-derives the same guarantee here rather than assuming it: step 1 below drops any
-- canPlay position already present in the row's own Best list before folding, the same
-- one-bucket-per-position invariant normalizeLineupProfile enforces on every other write. Without
-- this, a row that somehow had the overlap would silently duplicate a position into morePreferred —
-- masked at read time (playerPositionPrefs already dedupes) and self-healing on the player's next
-- edit, but a real data-integrity gap this migration shouldn't need to hope never happens. Also
-- guards `jsonb_typeof(...) = 'array'` rather than relying on `coalesce` alone, which does not
-- intercept a stored JSON null (only a SQL NULL) — no current writer produces one, but a data-only
-- migration that has not yet touched production is exactly the place to not need that to stay true.

-- 1. Fold each non-empty Okay list into the Best tail, dropping any Okay position the row's own
--    Best list already holds (see the note above) so the concatenation can never duplicate one.
with src as (
  select id,
         array_remove(array[primary_position, secondary_position], null)
         || case when jsonb_typeof(lineup_profile->'morePreferred') = 'array'
                 then array(select jsonb_array_elements_text(lineup_profile->'morePreferred'))
                 else '{}'::text[] end as existing_best,
         array(select jsonb_array_elements_text(lineup_profile->'canPlay')) as can_play
  from rep_roster_players
  where jsonb_typeof(lineup_profile->'canPlay') = 'array'
    and jsonb_array_length(lineup_profile->'canPlay') > 0
),
folded as (
  select id, existing_best,
         existing_best || coalesce(
           (select array_agg(c) from unnest(can_play) c where c <> all(existing_best)), '{}'::text[]
         ) as best
  from src
)
update rep_roster_players r
set primary_position   = folded.best[1],
    secondary_position = folded.best[2],
    lineup_profile     = (r.lineup_profile - 'canPlay')
                         || jsonb_build_object('morePreferred', coalesce(to_jsonb(folded.best[3:]), '[]'::jsonb))
from folded
where folded.id = r.id;

-- 2. A profile that carries an EMPTY canPlay (the shape every writer produced until now) just
--    loses the key. Rows whose profile is NULL, or already lacks the key, are untouched.
update rep_roster_players
set lineup_profile = lineup_profile - 'canPlay'
where lineup_profile ? 'canPlay';
