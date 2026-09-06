-- 278: A DECISION STAYS UNTIL YOU CLEAR IT — "Needs attention" stops emptying itself the moment
-- a row is opened, and learns the difference between looked-at and dealt-with.
-- (COACH_NOTIFICATIONS_FEED_FIXES_PLAN §4 — owner ruling, mockup artifact 9427bc24, 2026-09-06.)
--
-- THE CASE. The bell's "Needs attention" zone is built from `read_at is null` AND an 'act' event
-- type. That makes the zone a READ-STATE list wearing the label of a RESOLVED-STATE one: open a
-- "Payment failed" on the bus, fix nothing, and the row drops out of the zone, greys itself and
-- joins the day feed — the count goes 3 → 2 while the club's subscription is still unpaid. The
-- heading asks "have you dealt with this?"; the data could only answer "have you looked at it?".
--
-- ⚠ THIS IS NOT read_at UNDER ANOTHER NAME, AND THE TWO MUST NOT BE COLLAPSED. Owner ruling D3
-- (2026-09-03) already established that "Mark all read" must LEAVE act rows alone, precisely so one
-- tap cannot make an unhandled decision look handled. That ruling created a distinction the schema
-- had no room for: `read_at` says the coach has seen the words, `cleared_at` says the coach is
-- finished with the thing. Reusing read_at would re-break D3 the day it shipped. The column is
-- nullable with no default and no backfill: every existing act row starts UNCLEARED, which is the
-- honest reading — nobody has ever told this product they were done with one.
--
-- WHY NOT A `metadata` FLAG. `notifications.metadata` is jsonb and would have avoided a migration,
-- which is exactly why it was tempting. It is a bag for per-event payload, not for state the
-- product filters and counts on; a jsonb predicate here would be unindexable and invisible to the
-- data dictionary. A state the UI reads on every render is a column.

alter table notifications
  add column if not exists cleared_at timestamptz;

-- ⚠ NO INDEX ON cleared_at, AND THE REASON IS WORTH KEEPING. The first draft of this migration
-- added `(user_id, org_id) where cleared_at is null`, justified as "the zone reads uncleared act
-- rows on every bell open". That justification was FALSE, and review caught it: no query anywhere
-- filters on cleared_at. The API returns a page of rows for (user_id, org_id) ordered by
-- created_at, and the zone split happens entirely CLIENT-side. Postgres can only choose a partial
-- index when the query's own WHERE entails the index predicate, so that index could never have
-- been selected — it would have cost a write-hot table its maintenance on every insert and update
-- for exactly zero reads. The two indexes the real queries do use already exist:
-- `notifications_user_unread_idx` (user_id, created_at desc) where read_at is null, and
-- `notifications_org_idx` (org_id, created_at desc). If the zone filter ever moves into SQL, add
-- the index THEN, with the query that uses it in the same change.

comment on column notifications.cleared_at is
  'When the recipient said they were FINISHED with this notification — the "Clear" button on a '
  '"Needs attention" row (mig 278). NULL = still owed a decision, which is what pins an ''act'' '
  'event to the zone regardless of read state. ⚠ NOT a second read_at: read_at means the words '
  'were seen, cleared_at means the thing was handled, and owner ruling D3 (2026-09-03) depends on '
  'them staying apart — "Mark all read" must never set this. Clearing DOES set read_at when it is '
  'still null (a row you are finished with should not also sit unread), but never the reverse. '
  'Only ever set for ''act''-category events today; harmless and NULL on every other row.';
