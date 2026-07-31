# Prompt — Assistant coaches can download players' signed medical/waiver files

**Spun out of the Coaching-staff layout study `/review`, 2026-07-31. Owner-approved both fixes below.**
**Do not start until the Coaching-staff layout work is committed** (same files/portal — concurrent edits will collide).

---

## The defect

`ASSISTANT_DEFAULTS` gives a newly-invited assistant `roster: 'view'`, `rosterPii: false`, `documents: 'view'`.

The **Documents** capability spans two unrelated things:

1. **Team-level blank templates** — `rep_document_templates` (no `player_id` column). Harmless, genuinely useful to an assistant.
2. **Completed per-player files** — `rep_player_documents`, `player_id` NOT NULL FK to `rep_roster_players`. Types are CHECK-constrained to `waiver | medical_consent | code_of_conduct | other`.

The per-player routes gate on `canViewDocuments` **only** — they never consult `rosterPii`:
- `app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/documents/route.ts` (GET list)
- `.../documents/[docId]/route.ts` (GET → **1-hour Supabase signed URL to the actual file**)

`components/coaches/PlayerDocumentsSection.tsx` renders on the player detail page **unconditionally** — only the Upload/Delete buttons check `canManageDocuments`. (Contrast the Development section on the same page, which *is* capability-gated.)

Meanwhile the player-detail data route gates on `canViewRoster` then calls `redactRosterPlayer(...)`, which nulls `guardianFirstName/LastName/Email/Phone`, `playerDateOfBirth`, `medicalNotes`, `emergencyContactName/Phone` when `rosterPii` is false.

**Net effect on one screen:** a default assistant sees the guardian email/phone/DOB/medical-notes fields **blanked out**, and directly beneath them a table listing that same child's `Medical Consent` and `Waiver` PDFs by real filename with a working Download button. The redaction is defeated from the surface that performs it — and the file contents may hold exactly the guardian details, medical history, or identity documents the redaction exists to hide.

Corroborating: `lib/coach-nav-visibility.ts` → `case 'Documents': return caps.documents !== 'off';` (door already open), and the Documents page's own empty state says *"Signed forms are collected per player from the roster, not on this page"* — i.e. the product already treats these as two different things.

---

## Approved fix 1 — gate player-attached documents behind guardian-PII

**Require BOTH `documents !== 'off'` AND `rosterPii` for per-player documents.** Team templates keep gating on `documents` alone.

**DO NOT change `ASSISTANT_DEFAULTS.documents` to `'off'`.** That reverses the locked owner decision of 2026-06-25 ("documents view-only by default", recorded in the `lib/coach-capabilities.ts` header) *and* takes blank templates away from assistants who legitimately need them. Requiring both capabilities makes **both** June rulings true simultaneously — "documents view-only by default" AND "guardian PII off by default" — with no migration.

Cover the list route, the download route, and the UI section (don't render a section whose every action 403s). Consider whether `canManageDocuments` (upload/delete of a player's file) should require `rosterPii` too — it almost certainly should.

If you conclude a dedicated capability is better than requiring both, say so with reasoning before building — but note it costs a migration, new UI, and another grant for head coaches to reason about.

## Approved fix 2 — make the confirmation promise true

The Sensitive group's note promises *"You'll be asked to confirm before granting these."* Only 3 of 6 actually prompt (`CONFIRM_ON_GRANT` in `components/coaches/CoachStaffPanel.tsx`): money, rosterPii, announcementsSend. **Documents, Internal notes and Tryouts hand over silently.**

Owner ruling: **fix the behaviour, not the sentence** — softening the copy to "some of these" tells a coach nothing about which, and trades a real protection for a tidy sentence.

Sequenced after fix 1, because fix 1 changes what `documents` means:
- **Move Documents out of Sensitive into Everyday coaching** — once per-player files need `rosterPii`, the `documents` grant is blank team forms and doesn't warrant a speed bump. Update `sensitiveGrantCount` accordingly (it currently counts `documents`).
- **Add confirm-on-grant for Tryouts and Internal notes.** Tryouts is the biggest gap: its own declaration comments it as *"tryout candidates + decisions (guardian PII, roster-building)"* — guardian contact details for prospective players, children not yet on the team, handed over with no prompt.
- Revoking stays unconfirmed (existing rule: a head coach taking access back is always in a hurry).

Result: every remaining Sensitive item prompts, the promise becomes true, and no copy changes.

---

## Investigate before calling it fixed

1. **Is this live on prod?** The premium coach portal launched 2026-07-29 (prod HEAD `cf90d626`) and the assistant-capability model shipped earlier. If live, this is a production privacy defect and severity/sequencing changes — check before scheduling.
2. **Other doors to the same files.** A leak closed in one place and left open in another is not closed. Check at minimum: org-admin roster/player surfaces, platform-admin, any export or bulk-download path, and the `rep-team-documents` storage bucket's own policy (are signed URLs the only access route, and is the bucket genuinely private?). Per `memory/reference_supabase_rls_grants.md`, read posture from the **live** DB, never from migration files.
3. **This REMOVES access some live assistants have today.** Correct, and the point — but it is a mid-season access reduction for real users. Decide whether it lands silently or with a note to head coaches, and confirm no assistant workflow depends on reading a player's signed waiver (if one does, that's an argument for the dedicated-capability option, not for leaving the hole open).
4. Confirm head coaches and org admins are unaffected (head coaches resolve `rosterPii: true`, so requiring both should be a no-op for them — verify, don't assume).

## Working rules

- Branch **`dev`** (shared by all agents). Re-check `git rev-parse --abbrev-ref HEAD` before committing; stage explicit pathspecs only, never `git add -A`. Bracket dirs like `[playerId]` need `:(literal)` pathspecs.
- **No commit or push without explicit per-action owner OK.**
- Present a plain-language **PM UX summary before writing code** (blocking, per `AGENCY_RULES.md`), and create the `_PLAN.md` + `_PM_BRIEF.md` pair in `docs/projects/active/`.
- Gate: `npm run verify:changed` + `npm run typecheck` + `npm run lint:focused -- <files>`. All were green at hand-off (schema parity 0, all six colour ratchets 0).
- This is a **high-risk** change (auth/capability gating on a live surface handling children's medical records). Run `/review` at the high-risk tier when built. `/docs` afterwards — the Coaching staff and Documents help guides describe the current access model.
- Log the outcome to `memory/design_decisions.md` (the 2026-07-31 Coaching-staff entry has the full trail) and update this file's TODO line.

## Already settled — do not re-litigate

- Documents defaulting to view-only: **stays** (owner decision 2026-06-25).
- Guardian PII off by default: **stays**.
- Flipping the documents default to `'off'` as the fix: **rejected** — a UI/route lying about a decision is a bug in the UI/route, not grounds to reverse the decision.
- Softening the confirmation copy instead of adding the missing confirmations: **rejected**.
