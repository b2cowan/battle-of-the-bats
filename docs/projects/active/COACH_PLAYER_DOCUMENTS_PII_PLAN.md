# Player documents & guardian PII — access plan

**Status:** planned, awaiting owner go-ahead (2026-07-31)
**Source prompt:** `COACH_PLAYER_DOCUMENTS_PII_PROMPT.md` (spun out of the Coaching-staff layout `/review`)
**PM brief:** `COACH_PLAYER_DOCUMENTS_PII_PM_BRIEF.md`

---

## 1. Investigation results (the prompt's four questions, answered)

### Q1 — Is this live on prod?

**Yes in code, no in data.** Prod HEAD `cf90d626` contains both ungated routes and the
unconditionally-rendered section (verified by `git show cf90d626:<path>`).

But live prod counts are **all zero**:

| `rep_teams` | `rep_team_coaches` | assistants | `rep_roster_players` | `rep_player_documents` |
|---|---|---|---|---|
| 0 | 0 | 0 | 0 | 0 |

No org has built a rep team yet. So this is a **latent** production privacy defect: zero
records exposed today, and it becomes real the moment the first customer uploads a
medical consent form. That removes the incident-response pressure and — importantly —
removes the mid-season-access-reduction problem entirely (see Q3).

### Q2 — Other doors to the same files

**Door A — file bytes: CLOSED.** Live prod `storage.buckets.rep-team-documents` is
`public: false`, and every `storage.objects` SELECT policy is scoped to
`bucket_id = 'resources'`. No policy covers this bucket, so service-role-issued signed
URLs are genuinely the only read route. ✅

**Door B — org-admin route: correctly gated, no change needed.**
`app/api/admin/rep-teams/teams/[teamId]/players/[playerId]/documents/[docId]/route.ts`
gates on `module_rep_teams` + module entitlement + rep-group scope, and restricts DELETE
to owner/admin. It never consults coach capabilities, which is right — org admins are a
different authority. ✅

**Door C — PostgREST metadata bypass: OPEN, and wider than the documents defect.**
Live prod policy state on `rep_player_documents` **and** `rep_roster_players`:

- `anon` and `authenticated` both hold the default `SELECT` grant (confirmed via
  `has_table_privilege`) — the known prod-only posture in `reference_supabase_rls_grants.md`.
- Each table carries two permissive SELECT policies: *"coaches can read assigned team …"*
  (`team_id IN (SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid())`) and
  *"org members can read …"* (any `organization_members` row for the org).
- The browser ships an anon-key Supabase client holding the coach's own session
  (`lib/supabase-browser.ts`).

Those policies key on **assignment, not capability**. So any assigned assistant coach can
query PostgREST directly and read `guardian_email`, `guardian_phone`, `player_date_of_birth`,
`medical_notes`, `emergency_contact_*`, `notes`, `admin_notes` — every column
`redactRosterPlayer` nulls — plus every player-document row. **The entire `rosterPii`
redaction model is bypassable from the browser console.** Fixing only the documents routes
would leave this open, which is precisely the "closed in one place, open in another" case
the prompt warns about.

*Verification note:* impersonation testing on **dev** returns `permission denied` because
dev's `authenticated` role lacks the SELECT grant. Dev structurally cannot reproduce this —
the posture must be read from prod. Prod impersonation was not run to completion because
there are zero rows to read.

Nothing in the app reads these tables with a browser/anon client — every caller goes
through `supabaseAdmin` (service role, `BYPASSRLS`). The four policies are therefore dead
weight, and dropping them is a no-op for the product.

**Door D — exports/bulk: none.** `roster/bulk/*` is import-only (CSV in). No roster or
document export path exists.

### Q3 — This removes access some live assistants have today

**It removes nothing from anyone.** Zero assistant coaches and zero player documents exist
on prod. No notice to head coaches is required, and no assistant workflow can depend on
reading a signed waiver because no signed waiver exists. This lands silently.

### Q4 — Head coaches and org admins unaffected

**Confirmed, not assumed.** `HEAD_COACH_ALL` in `lib/coach-capabilities.ts` sets
`rosterPii: true` and `documents: 'manage'`, and `resolveCoachCapabilities` returns that
bundle wholesale for `head_coach` while ignoring grants. Requiring both is a strict no-op
for head coaches. Org admins never touch this predicate (Door B).

---

## 2. Approach decision

**Requiring both `documents !== 'off'` AND `rosterPii` — as approved. No new capability.**

A dedicated capability was considered and rejected: it costs a migration, new grid UI, and
a fourth thing for a head coach to reason about, to express something the existing two
capabilities already say together. Requiring both makes both June 2026 rulings true at once
("documents view-only by default" AND "guardian PII off by default") with zero migration.

## 3. Changes

### Fix 1 — gate player-attached documents behind guardian-PII

`lib/coach-capabilities.ts` — two new predicates beside the existing pair:

```ts
/** Per-player signed forms (waiver/medical) — the file itself may hold exactly the guardian
 *  and medical details `redactRosterPlayer` nulls, so it requires BOTH grants. Team-level
 *  blank templates keep gating on `documents` alone. */
export const canViewPlayerDocuments   = (c) => canViewDocuments(c)   && c.rosterPii;
export const canManagePlayerDocuments = (c) => canManageDocuments(c) && c.rosterPii;
```

Applied to all four per-player entry points plus the surface:

| File | Change |
|---|---|
| `…/roster/[playerId]/documents/route.ts` GET | `canViewDocuments` → `canViewPlayerDocuments` |
| `…/roster/[playerId]/documents/route.ts` POST | `canManageDocuments` → `canManagePlayerDocuments` |
| `…/documents/[docId]/route.ts` GET (signed URL) | `canViewDocuments` → `canViewPlayerDocuments` |
| `…/documents/[docId]/route.ts` DELETE | `canManageDocuments` → `canManagePlayerDocuments` |
| `…/roster/[playerId]/page.tsx` | wrap the section in the view gate; pass the manage gate |

`…/documents/templates/route.ts` (team blank forms) is deliberately **untouched**.

### Fix 2 — make the confirmation promise true

`components/coaches/CoachStaffPanel.tsx`:

- Move the `documents` segment from `SENSITIVE_SEGMENTS` → `EVERYDAY_SEGMENTS`. Once
  per-player files need `rosterPii`, `documents` grants blank team forms and doesn't warrant
  a speed bump.
- Drop the `documents` term from `sensitiveGrantCount`.
- Add `CONFIRM_ON_GRANT` entries for `tryouts` and `notes`.

`GRANT_LABELS` / `DEFAULT_ON` / `DEFAULT_OFF` derive from those arrays, so the access rail
follows automatically — no second edit, no second chance to lie.

Result: all four remaining Sensitive items prompt. The sentence becomes true, unchanged.

### Fix 3 (NEW — needs owner go-ahead) — close the PostgREST door

Migration dropping the four dead SELECT policies, leaving RLS enabled with no policies —
the platform's standard service-role posture per `reference_supabase_rls_grants.md`:

```sql
DROP POLICY IF EXISTS "coaches can read assigned team player documents" ON rep_player_documents;
DROP POLICY IF EXISTS "org members can read player documents"           ON rep_player_documents;
DROP POLICY IF EXISTS "coaches can read assigned team roster"           ON rep_roster_players;
DROP POLICY IF EXISTS "org members can read rep_roster_players"         ON rep_roster_players;
```

Post-apply proof (prod): `set local role authenticated` + a coach's `sub` → `count = 0`.
Dictionary + snapshots refresh in the same unit of work.

**Without fix 3, fix 1 does not actually close the leak** — it only closes the UI door.

### Also worth doing (not in scope, flagged)

`storage.objects` carries `"Allow public update"` with `USING = null` (all rows) and
`WITH CHECK = bucket_id = 'resources'`. A row in the private `rep-team-documents` bucket
satisfies USING, so the check permits rewriting it *into* the public `resources` bucket,
which has a public read policy. Whether the Storage API surfaces this depends on its own
source-object permission check — unproven either way, and unexploitable today (zero
objects). Worth a hardening pass; not part of this change.

## 4. Verification

- `npm run verify:changed`, `npm run typecheck`, `npm run lint:focused -- <files>`
- Unit coverage for the two new predicates across head/assistant × grant combinations
- `/review` at the **high-risk tier** (auth/capability gating, children's medical records)
- `/docs` — Coaching staff and Documents guides describe the access model
- Owner QA in browser; dev has seeded rep teams to exercise the flows
