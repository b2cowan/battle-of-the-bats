# Prompt — Board Ready · fix B: the rules-and-resources file store (sweep 3, finding 2) · **Sonnet**

> One session, pasted into a fresh chat (`/clear` first). Sonnet is fine: the shape is decided below. Written 2026-11-10.
> Report: `docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md` finding 2. Index: `BOARD_READY_PROMPTS_INDEX.md`. The owner
> asked for these fix sessions on 2026-11-10.

## The defect (proven on dev)
The public `resources` storage bucket grants INSERT and DELETE to **any signed-in account** (mig 087 L20-28; kept by mig 311
because the Rules screen writes from the browser: `lib/db.ts` ~L1570 remove, ~L1586 `uploadResourceFile`). Keys are flat
(`Date.now()-name`) and listable. So any account can delete any club's rules files, or replace one under the same name.
Proof: `.probe/sweep3-prove.mjs`, the storage step at the end. One account uploaded, a different account deleted it.

## The fix (decided; build it)
1. **A server route** for upload and delete, for example `app/api/admin/resources/file/route.ts`. Copy the server-side
   upload pattern of `app/api/admin/tournament-logo` or the sponsor-logo route. It checks the club (`getAuthContextWithScope`
   + `requireTournamentInOrg` + `scopeGuard`) and the `post_rules` capability, and accepts the bucket's own types and size.
   New keys go under `{orgId}/{tournamentId}/{uuid}-{cleanName}`. Delete takes the **resource row id**, never a path: the
   server reads the row, checks it belongs to the club, and removes the stored object, refusing any object outside that
   club's prefix, or an old flat key only when the row names it.
2. **The Rules screen** calls the route instead of the browser storage client. Find every caller of the `resources` storage
   bucket first (grep `.from('resources')` on storage, and the db.ts helpers). The resource **table** writes already go
   through their own path; check that they are org-checked too, and report them if not.
3. **A migration** (check the latest number at commit time) that drops "Authenticated users can upload resources" and
   "…delete resources". It keeps the public read. **Order matters on production: code first, then the migration.** If the
   migration lands first, the live Rules screen breaks. Add it to `MANUAL_PROD_STEPS.json` with that order. Update
   `docs/agents/db/DATA_DICTIONARY.md` and refresh the snapshots (`npm run refresh:snapshots`).
4. Existing files keep their flat keys and URLs. Nothing is moved, and every published link keeps working.

Before code: present the plain-language **UX summary** (AGENCY_RULES, blocking). For an organizer nothing changes: the
upload and delete look the same. A stranger can no longer touch the files.

## Prove, guard, hand off
- Extend the probe: an owner/admin upload and delete through the route works; another club's admin, a coach row and a
  parent are refused; after the dev migration, the direct `supabase.storage.from('resources').remove()` with a user session
  is refused.
- A guard test: no client code calls the storage client on `resources` for writes, and the route checks `post_rules` and the
  club. Kill-test it.
- `npm run verify:changed`; `npm run typecheck` (`lib/db.ts` is shared). Restart the dev server before hand-off.
- `/review`; apply what it finds. Offer `/docs` if the Rules screen's help mentions storage behaviour.
- Record `→ Fixed <hash>` under finding 2 in the report and on the 🔒 TODO line after the owner's yes.
- **No commit without the owner's yes.** Branch `dev`, explicit paths, TODO.md through a private index.
- A product-owner summary, including the production order (code, then the migration).
