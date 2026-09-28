# Prod Data API Exposure — close the public-key door on the tournament tables

> **Status:** Stage 1 **APPLIED to dev + prod 2026-09-28** as migration 310 (`310_the_tournament_tables_leave_the_public_key.sql`, owner go "go ahead with stage 1").
> - **The admin-rail decision** took the recommended default: members see a new team's name only.
> - **Verified** with `.probe/dba-310-verify.mjs`: dev 25/25 end to end, prod 14/14 read-only, with a before/after on both envs.
> - **Recorded** in the manual-prod-steps register as applied; snapshots refreshed with 0 drift.
> - **Owed:** a prod smoke of the signed-in live feeds (Owner QA Ledger), and the Stage 2 decision.
>
> Pre-customer, prod went ahead of the dev walk because the probe exercised the same four feeds for real.
>
> **`/review`, 2026-09-28 (three finder lenses plus a catalog dependency sweep) found three code defects, all fixed in the Stage 1 commit.**
> - **Two regressions from 310, latent on prod** (0 archived and 0 sealed tournaments there) and **already broken on dev**:
>   - `getArchiveById` read `tournament_archives` through the bare anon client, so every public archive page would 404. It now uses `readClient()`.
>   - The admin Archives screen loaded the org's tournaments with the browser session, so the "archived, not yet sealed" list came back empty. It now uses the scoped `/api/admin/tournaments` endpoint.
> - **One pre-existing defect:** the dashboard's Recent Activity feed (`LiveEventLog`) carried a binding on `announcements`, which is in no realtime publication. Realtime rejects such a binding, and that takes down the whole channel, so the panel never updated live on either env. The dead binding is removed.
> - **These are code fixes, so they reach prod with the next release.**
> - **The database side is clean:** no policy on another table, no SECURITY INVOKER function and no view reads the eight tables (both envs, with a positive control).
> - **Lesson for Stage 2:** the edge logs only see exercised paths. Nobody opened an archive, so the logs could not show that dependency. The code sweep is mandatory alongside the logs, not optional.
> **Finding:** `docs/agents/db/DB_ARCHITECTURE_REVIEW.md` Finding #44 (evidence, consumer inventory, reasoning).
> **PM brief:** `PROD_DATA_API_EXPOSURE_PM_BRIEF.md`.
> **Origin:** the stack-health "Live-update errors" amber on dev (2026-09-27): 1,926 refused live-update subscriptions. The cause was a missing grant, and it led to this.

## 1. The problem in one paragraph

The same row-security policies exist on dev and prod; only the **grants** differ. Prod still carries Supabase's legacy blanket grant: `anon` and `authenticated` hold every privilege on 181 of 184 public tables. Dev holds only what migrations explicitly granted. On prod, therefore, every `USING (true)` policy is a live door for the publishable key, which ships in every page. The worst are `teams` (every club's registrations: contact emails, payment status, amounts, admin notes), `games` (the scorekeeper's email on all 53 games), `tournaments` (a contact email the club chose to hide) and `announcements` (sender email, failed family addresses). There are two write doors: the prod-only `pools` policy lets any signed-in account change any club's pools, and `teams_anon_insert` lets anyone insert a registration into any tournament.

## 2. What the product actually uses (why the fix is safe)

- **Code:** every read and write of these tables goes through the service role. Public pages pass `{ admin: true }`, and registration inserts with `supabaseAdmin`. The five session-client writers left in `lib/db.ts` have no callers.
- **Dev:** has run for months without these grants.
- **Prod logs (2026-09-21..27):** all 1,928 PostgREST calls to these tables used the secret key from the server, and none used the publishable key.
- **The only genuine browser readers are realtime** (Supabase filters both subscriptions and payloads by **column** privilege):

| Feed | Where | Role | Table / event | Fields it reads |
|---|---|---|---|---|
| Public bracket | schedule + standings pages | anon / authenticated | `games` UPDATE by `tournament_id` | id, status, scores, team ids |
| Scorekeeper board | `/[org]/scorekeeper` | authenticated | `games` UPDATE | refetch trigger |
| Admin live rail | admin layout + dashboard | authenticated | `games` UPDATE, `teams` INSERT | scores/status; a new team's `name` |
| Notification bell | both portals | authenticated | `notifications` INSERT by `user_id` | `org_id` |

`LiveEventLog`'s `announcements` binding is dead: `announcements` is in neither publication. It is harmless, and left alone.

## 3. Stage 1 — one migration, both envs, no code dependency

Next free migration number (310 at time of writing). The draft SQL is below; the build session must re-read the live columns first.

```sql
-- The tournament tables leave the public Data API; the browser keeps exactly what its live feeds read.

-- 1. Server-only tables (dev already looks like this).
revoke all on public.tournaments, public.divisions, public.pools, public.announcements,
              public.diamonds, public.tournament_archives, public.teams, public.games
  from anon, authenticated;

-- 2. teams: the admin rail's "new team registered" line needs a member to see a new team's NAME.
grant select (id, tournament_id, name) on public.teams to authenticated;
drop policy if exists "teams_anon_read"     on public.teams;
drop policy if exists "teams_anon_insert"   on public.teams;   -- closes cleanup item T5
drop policy if exists "teams_member_update" on public.teams;
drop policy if exists "teams_member_delete" on public.teams;
create policy "teams_member_read_for_live_feed" on public.teams
  for select to authenticated using (public.can_access_tournament(tournament_id));

-- 3. games: the public schedule, minus who scored it and the admin note.
grant select (id, tournament_id, division_id, home_team_id, away_team_id, game_date, game_time,
  location, diamond_id, home_score, away_score, status, is_playoff, bracket_id, bracket_code,
  home_placeholder, away_placeholder, home_slot_id, away_slot_id, score_submitted_at,
  score_submission_source, venue_facility_id, schedule_facility_lane_id, generator_locked,
  duration_minutes, round_label, bracket_label)
  on public.games to anon, authenticated;
drop policy if exists "games_member_insert" on public.games;
drop policy if exists "games_member_update" on public.games;
drop policy if exists "games_member_delete" on public.games;
-- games_anon_read (USING true) stays: it is the public schedule, now column-limited.

-- 4. pools: the prod-only "any signed-in account may write" rule (mig 199 missed it: not spelled USING (true)).
drop policy if exists "Allow all for authenticated users on pools" on public.pools;

-- 5. notifications: the bell's live count. A no-op on prod; turns the bell on for dev.
grant select on public.notifications to authenticated;

-- 6. Publication parity: teams is in prod's realtime publication, not dev's.
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'teams') then
    alter publication supabase_realtime add table public.teams;
  end if;
end $$;
```

Deliberately **not** in Stage 1:
- The other inert `*_anon_read` policies (tournaments, divisions, pools, announcements, diamonds, archives) stay. With no grant they open nothing. Stage 2 decides their fate along with every other table.
- `org_public_site_content`, `rules`, `rule_items`, `resources`, `venue_facilities` and `schedule_facility_lanes` are public content with explicit grants on both envs. They go to Stage 2.
- The dead session-client writers in `lib/db.ts`: delete them in the same commit if convenient. They would fail after the revoke, as they already do on dev, and nothing calls them.

Same unit of work: update `DATA_DICTIONARY.md` (the `teams`/`games`/`pools` security notes, the new policy, the games column list, the notifications grant, the publication change) and run `npm run refresh:snapshots`.

### Order

1. Apply to **dev**. The revokes are no-ops there; the grants, policy changes and publication change are real.
2. **Owner walk on dev** (§5): live features that have never worked on dev start working. From here on, dev and prod hold **identical** grants on these nine tables.
3. Apply to **prod**. It does not wait for a code promote, because prod's code needs nothing.
4. Prod verification (§5). Next morning, the dev "Live-update errors" row should read near zero.

### Rollback

If a live feed misses a field it needs, add that one column to the grant. Never re-grant the table: re-granting `all` reopens every column and every `USING (true)` door at once.

## 4. Stage 2 — converge prod's grants on dev's, every table

Policies already match (305/306), so after Stage 2 dev becomes a faithful replica of prod security everywhere. This retires the whole class: any mig-212-shaped policy nobody has found yet stops being a door on prod.

- **Evidence gate:** 14 days of prod edge logs, grouped by table × key type. Any publishable-key or browser call to a table that the dev ACL does not grant must be resolved before applying. The probe is `.probe/dba-rest-callers.mjs`; widen its table filter to all tables.
- **Build:** generate one migration from dev's live ACL. Revoke everything from `anon`/`authenticated` on each public table, then replay dev's explicit grants.
- It must not collide with Supabase's 2026-10-30 default-privileges change (Finding #43), which touches future tables only.

## 5. Verification

**Dev (owner walk, after Stage 1 on dev):**
1. **Public bracket:** open a tournament's public schedule with a bracket in one window, score a game in another. The bracket updates without a reload.
2. **Admin live rail:** a score change pops on the admin dashboard, and a test registration shows "new team registered".
3. **Notification bell:** the bell count rises without a reload when a notification arrives.
4. **Scorekeeper board:** it updates live.
5. **Regressions:** public registration still works, and admin pool editing still saves.

**Prod (read-only, after Stage 1 on prod):**
- Catalog:
  - `anon` holds no privilege on `teams`.
  - `authenticated` holds column SELECT on only `teams.(id, tournament_id, name)`.
  - `anon`/`authenticated` hold no SELECT on `games.score_submitted_by_email`, `score_submitted_by_user_id` or `notes`.
  - Neither role holds INSERT/UPDATE/DELETE on any of the eight tables.
  - `pg_policies` holds no identity-blind write policy.
- A rolled-back transaction as `anon`: `select count(*) from public.teams` → permission denied, while `select id, home_score from public.games limit 1` → succeeds.
- PostgREST with the publishable key:
  - `teams?select=id` → denied.
  - `games?select=id,home_score` → 200.
  - `games?select=score_submitted_by_email` → denied.
- **Owner smoke on prod:** the public bracket still updates live.

## 6. Owner decisions

1. **Approve Stage 1** as drafted.
2. **The admin rail's "new team registered" line:** keep it (the draft: members see only the new team's name), or drop it. Dropping it means a small code change and removing `teams` from prod's publication.
3. **Advisory:** limit `games_anon_read` to published schedules, which hides draft schedules from the public key. Its severity is low.
4. **Guards, which are watched automation and built only on your explicit ask:**
   - Teach the snapshot/drift tooling to compare grants and policy bodies. It has now hidden a prod-only security door twice.
   - Add a migration guard that rejects new identity-blind write policies.
