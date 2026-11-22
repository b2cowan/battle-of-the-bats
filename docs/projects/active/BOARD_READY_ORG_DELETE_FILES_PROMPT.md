# Prompt — Board Ready · 0a: deleting an organization removes its stored files (Stage 6 step 6.5 / P7) · **Sonnet**

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-15. Sonnet is fine: the shape is decided below,
> but the work deletes things, so **prove it on dev with real objects before you call it done**. Plan of record:
> `BOARD_READY_PLAN.md` Stage 0a ("Org delete removes its file storage"). It is the same item as step **6.5 (P7)** in
> `GST_HST_STAGE6_TERMS_PLAN.md`: one build, recorded in both. Index: `BOARD_READY_PROMPTS_INDEX.md`.

## Why this matters (read first)
The draft privacy policy (§9) says *"When an organization is deleted, its information and the files it uploaded are deleted
with it."* The draft itself says **do not publish that sentence before this ships** (`docs/agents/legal/drafts/PRIVACY_POLICY.md`
note 2, and `GST_HST_STAGE6_TERMS_PLAN.md` §6.7, which lists P7 as a publication prerequisite). Today it is false: the
database rows go, the files stay. Some of those files are children's signed medical and waiver documents. The board asked
"does our data leak"; a deleted club's files sitting in storage is the answer we cannot give. This also unblocks the
privacy-policy publication and the board pack.

## What the code does today (census 2026-11-15; helper-reported, the key facts re-read — re-verify the ones you build on)
- **The only door** is `DELETE app/api/platform-admin/orgs/[id]/delete/route.ts` (super admin only, typed slug, reason).
  It has **no storage call at all** (re-checked: zero matches for "storage"). Order today: owner email → audit row →
  explicit deletes of the NO ACTION tables → `stopClubDomain` (best effort) → `organizations.delete()` (the DB cascade does the
  rest) → optional Stripe customer delete (best effort, after). The owner's "Request account deletion" button only emails
  staff, who then run this route by hand. There is no soft delete and no undo.
- **Six org buckets**, and almost every object is keyed `{orgId}/…` (the uuid, never the slug), so a recursive list of that
  prefix finds it from the id alone:

  | Bucket | Public | Path shape |
  |---|---|---|
  | `org-logos` | yes | `{orgId}/logo.*`, `{orgId}/stock-*.png`, `{orgId}/sponsors/{uuid}.png`, `{orgId}/{tournamentId}/logo.*` |
  | `org-assets` | yes | `{orgId}/hero-banner.*` |
  | `resources` | yes | new: `{orgId}/{tournamentId}/{uuid}-{name}`; **legacy: flat `1699…-name.pdf` with no org id** |
  | `org-permit-documents` | no | `{orgId}/permits/{permitId}/{uuid}-{name}` |
  | `rep-team-documents` | no | `{orgId}/teams/{teamId}/players/{playerId}/…` (signed medical and waiver files) and `{orgId}/templates/…` |
  | `tournament-registration-files` | no | `{orgId}/{tournamentId}/{registrationId}/{fieldId}-{uuid}-{name}` |

  `rep-team-documents` is created by hand, not in a migration, so treat "bucket not found" as nothing to delete, not an error.
- **The one gap:** legacy flat `resources` keys carry no org id. They can only be found from the `resources.url` rows
  (`resourceKeyFromUrl` in `lib/resource-file-storage.ts`), and those rows vanish with the cascade. **Read them BEFORE the org
  row is deleted.** The new `{orgId}/…` keys are found by prefix.
- **Supabase `.list()` is not recursive and returns at most 100 entries** by default. A prefix delete must walk subfolders and
  page. No shared helper exists; the only list-then-remove code is `scripts/seed-club-fixture.mjs` ~L1589 (two folders, and the
  reason is in its comment).
- Not Supabase and out of scope: the platform's own bookkeeping receipts (AWS S3, FieldLogicHQ's own tax records, which the
  policy keeps).

## The decision (build this)
1. **One server helper**, for example `lib/org-storage-purge.ts`, `removeOrgFiles({ orgId, legacyResourceKeys })`:
   - Walks **every bucket in one exported list** (single home for the six names) recursively, with paging, removing in batches.
   - Tolerates a missing bucket and a missing prefix; reports per bucket the number removed and any error.
   - Takes the legacy `resources` keys the caller read earlier and removes those from `resources` too.
   - Never throws past the caller: returns `{ removed, failed: [{bucket, keyOrPrefix, message}] }`.
   - Refuses an empty or non-uuid `orgId` (a bad prefix must never list the bucket root).
2. **The delete route** (a) reads the club's legacy `resources` keys first, (b) keeps its current order for the database, and
   (c) **runs the file purge after the organization row is gone**, then (d) writes the outcome into the existing audit trail
   (files removed per bucket, and any failure). Why after, not before: a failed database delete must not leave a club that is
   still there with its files already gone. The org id still works as a prefix once the row is deleted, so nothing is lost by
   waiting. **If any file removal fails:** the route still succeeds for the database, returns a visible warning with the failed
   items, writes a `delete_organization_files_failed` audit row naming the org id and the failed prefixes (so a retry is
   possible), and calls `captureError`. Follow the Stripe-customer pattern at L237-257 of the route for shape.
3. **The preview (GET) counts the files too** (a total, and per bucket if cheap), and the platform-admin window
   (`app/platform-admin/orgs/[id]/ClubRecord.tsx` ~L1384–1403) says "and its N stored files" and shows a file-removal failure
   plainly if one comes back. Today it says "and everything in it", which is not true of files.
4. **A build guard** so a seventh bucket cannot be forgotten: a unit test that finds every bucket name the app writes to
   (`.storage.from('…')`, the bucket constants) and fails when one is not in the purge list or on a short, commented list of
   exclusions (`proprietor-receipts`, platform-level). Kill-test it by removing a bucket from the list.
5. **A unit test with a fake storage client** proving: recursion into subfolders, paging past 100 entries, a missing bucket is
   fine, a failed batch is reported not thrown, an empty or malformed org id refuses, legacy keys are removed.
6. **A one-time report for already-orphaned files.** Orgs deleted before this ships left files behind. Write a **report-only**
   script (`scripts/` plus `.probe/` output, never auto-deleting) that lists top-level prefixes in each org bucket that match
   no row in `organizations`. Run it on **dev**. Running it on production is a read of production: **ask the owner first**
   (AskUserQuestion, say what it reads and that it writes nothing) and keep names out of the console. Removing production
   orphans is a separate owner decision after the report. Do not remove anything on production in this session.

**No migration.** No schema change, so no dictionary or snapshot work. Production order is simply: the code ships with the
next promote, nothing to apply first.

## Out of scope — report, do not fix, do not widen
- Deleting a single tournament, rep team or player also leaves files behind (`lib/db.ts` ~L349 and ~L4637). The policy sentence is
  about deleting an organization; list these as findings with where each is, for a later decision.
- `app/api/platform-admin/users/[id]/delete/route.ts` (deleting a person) has no storage handling. Same: a finding.
- **Demo orgs:** the proxy's demo write guard keys on the slug in the URL, and this route puts the slug in the body, so a demo org
  is protected only by "super admin plus the typed slug". Do **not** add a refusal on your own; report it as an owner call with
  your recommendation.
- No retention or purge scheduling. The "pending purge" state still holds data; that is a separate finding in the policy draft.

## Before code (blocking, AGENCY_RULES)
Present the plain-language **UX summary**: customers see nothing different. A staff member deleting a club sees the
confirmation window count the stored files and, after the delete, a line saying how many were removed (or which could not be).
The visible change for a club is a promise becoming true. Then write the **Task list**.

## Prove, guard, hand off
- **A dev proof with real objects** (`.probe/`, dev only, throwaway org and users; follow the probe-sign-in note in memory
  and load `.env.local` so it never reads the prod env): create a throwaway org, upload one object into **each of the six
  buckets** using the path shapes above, plus **at least 120 objects** under one prefix to exercise paging, plus one legacy flat
  `resources` key with its row. Run the real route (or its helper plus the same ordering) and read back: **zero objects left** under
  the org's prefix in every bucket, the legacy key gone, a **second org's objects untouched**, and the audit row written.
  Then force a failure (point one bucket name at a bad value or make one remove error) and confirm the warning and the
  `delete_organization_files_failed` row. Delete everything you created.
- `npm run verify:changed`; `npm run typecheck` (the route is shared admin code). New files, so **restart the dev server before
  hand-off**.
- `/review`; apply what it finds. This change alters **what the policy promises**, so run `/legal` before hand-off
  (CLAUDE.md): it should confirm the §9 sentence is now true and say which note to clear. Apply what it finds or record an
  owner question. `/docs` is not needed (staff-only screen), unless help text names file handling.
- **Update the records after the owner's yes, not before:** `LEGAL_FACTS.md` L66-67 ("org delete does not touch file
  storage" becomes true-now text), the privacy draft's note 2 and findings list (do not publish the draft; just clear the
  blocker), `GST_HST_STAGE6_TERMS_PLAN.md` step 6.5 and `LEGAL_INDEX.md`, the Board Ready plan's Stage 0a line, TODO.md (one
  line, through a private index). Record the state positively: "built, committed `<hash>` <date>", never "not yet".
- **No commit without the owner's yes.** Branch `dev` (re-check it before committing), explicit paths only, `git show --stat
  HEAD` after, shared files (TODO.md, plan, ledgers) through a private index.
- A product-owner summary at the end: what staff see, what a club is promised, the three findings above, and the production
  order (code only). Say plainly if anything was skipped.
