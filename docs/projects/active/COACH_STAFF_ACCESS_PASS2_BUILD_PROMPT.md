# Kickoff prompt — Coaching staff, pass 2: the list, the sheet, four roles, and access set before the invite

*(paste into a fresh chat)*

**Build pass 2 of `COACH_STAFF_ACCESS_PLAN.md` (§2 – §5), and only that.** Reviewed, mocked up,
and **approved by the owner on 2026-09-10** ("looks good, I agree with your recommendations"), with
a treasurer role and the dropdown added the same day at the owner's request. Pass 1 (enforcement)
is **committed on `dev` as `b0914edb`** and passed owner QA §168 28/28. Carry the plan verbatim;
do not re-litigate the roles, the presets or the page shape.

---

## Read first, in this order

1. **The binding mockup, round 2:** https://claude.ai/code/artifact/c8982bc5-6d0c-4063-bc82-400850600b1d
   — §02 (the list), §03 (the invite sheet and the open dropdown), §04 (a person's sheet),
   §05 (moving between roles), §06 (phone, true size), §09 (the ten decisions). **Where this prompt
   and the mockup disagree, the mockup wins.** Source: `docs/projects/active/COACH_STAFF_ACCESS_MOCKUP.html`.
2. **`COACH_STAFF_ACCESS_PLAN.md`** — the status header (what pass 1 changed and what `/review`
   corrected), the **five stated assumptions** at the top, then §2.1 (migration 288), §2.2 (the
   capability module), §2.3 (plans on schedule edit), §2.4 (membership + invites), §2.5 (API),
   §2.6 (the screen, frame by frame), §2.7 (copy), §2.8 (tests), §2.9 (exit), §3 (out of scope).
3. **`COACH_STAFF_ACCESS_REVIEW.md`** §8 (why each departure from a logged decision is on merit) and
   §10 (the open questions — answered by the plan's five assumptions; 4b is the awards question,
   left open).
4. **`COACH_STAFF_ACCESS_PM_BRIEF.md`** — the role table and the trade-offs, in the owner's terms.

---

## ⚠ Verify before building — the working copy is shared and dirty

- **The code has moved since the plan was written.** A separate session (2026-09-11, ledger §171)
  added a `scoutingBook` grant to `lib/coach-capabilities.ts`, widened the helper's Insights door
  for the Scouting Book tab, and edited `lib/coach-schedule-doors.ts`, `history/page.tsx` and
  `coach-helper-preset.test.ts` — some of it possibly still uncommitted. **Read the current files,
  not the plan's description of them.** The `staffKindLabel` derivation, the `HELPER_PRESET` and
  the staff panel's `grantsFrom()` (which must enumerate EVERY grant or a PATCH drops it) are the
  three places a new grant changes what pass 2 has to persist.
- **Establish what is already modified before editing anything**: `git status --porcelain`. Another
  session has ~40 uncommitted files staged and unstaged. **Stage explicit pathspecs only; build the
  commit in a private index** (`GIT_INDEX_FILE`) and `git diff --cached --stat` before committing —
  the shared index has been clobbered once before. Bracket directories (`[teamId]`, `[orgSlug]`)
  need `:(literal)` pathspecs or they stage nothing.
- `npm run verify:changed` may be red on `check:root-files` (a stray mangled temp-path file at the
  repo root from another session) and on two token-ratchet colours in the coaches stylesheet. **Not
  yours. Report, do not fix.** `npm test` at plain HEAD is red on 8 BvA/campaign-registry guards
  whose subject files are another session's uncommitted work — same rule.
- **Migration 288 is expected** (`staff_kind` on `rep_team_staff_memberships` and
  `assistant_invite_tokens`, CHECK-constrained, with a DATA-ONLY backfill of existing helpers). Check
  `supabase/migrations/` for the current highest number before naming it — 287 was the last at the
  time of writing. Dictionary + `npm run refresh:snapshots` in the same unit of work; `check:dictionary`
  must be green. ⚠ The backfill is invisible to `check:migrations`; its prod state is knowable only by
  querying the rows. Say so in the ledger entry.

---

## What this builds (the owner's words)

- **The Staff page becomes a list of people** — the head coach included, pending invites included —
  one row each: role chip, a one-line summary of what they can open (sensitive grants in amber),
  "Edit access ›". Whole staff above the fold on a laptop and on a phone. **No sentence under the page
  title** (page-header rule). Inviting is one button in the header.
- **The sheet** (one component, two modes). Role at the top as the app's **sub-lined dropdown**
  (`SublinedChoice` — ⚠ its `label` prop is the ARIA name only; draw the visible `<label>` yourself).
  Every grant beneath with one sentence each; Schedule is **one three-way control** (Hidden / View /
  View + edit) over the same two stored keys; Sensitive is a visible group, not a fold; saves per tap
  as today, with the existing confirm-on-grant copy and the Documents + Contacts compound rule carried
  over unchanged. Footer: **Remove from team** · **Make head coach** (last-head-coach refusal).
- **Invite mode:** email → role dropdown, nothing chosen, the access section a quiet note until a
  role is picked → the grid prefilled from the preset, editable → **Send invite**, with every
  sensitive grant confirmed once, together, at send. Success = a pending row.
- **Pending invites are rows**: days left, Resend, Cancel, starting access editable until acceptance.
  Shown to the head coach (new) and the club admin (today's oversight page, unchanged).
- **Four roles as a STORED label** that gates nothing: `assistant` / `manager` / `treasurer` /
  `helper`. Presets exactly as the plan's §2.2: manager = schedule edit, staff chat, documents manage,
  money edit, contacts, email families; treasurer = schedule view + money edit, everything else off.
  `staffKindLabel(caps, storedKind)` prefers the stored kind and falls back to today's derivation for
  NULL. Every nav gate and route keeps deciding on the individual grant.
- **Practice-plan writing follows "Schedule: View + edit"** (the plan's §2.3 route list) — a
  widening for existing assistants, stated on the control's sentence.
- **Copy in the same unit of work:** help article `premium-staff` (four kinds, the dropdown, pending
  invites, Make head coach), the Overview setup step, the four invite emails from one
  `STAFF_KIND_COPY` table, the accept page, the admin oversight page's row and approval wording.

## The five assumptions this builds under (owner agreed to the recommendations as drawn)

1. Team manager starts **without** Attendance. 2. **Two head coaches allowed**; removing or demoting
the last is refused. 3. Every existing assistant with schedule editing **gains plan writing on
deploy**. 4. Pending invites show to **both** the head coach and the club admin. 5. Treasurer starts
with **Contacts & birthdates off** and **Staff chat off**. — If the owner reverses one, it is a
one-line change; ask only if the code makes one of them impossible.

## Blocking gate, in order

1. **No new mockup unless you deviate.** The mockup is approved. If the build must depart from a
   frame (a control the design system lacks, a phone width that breaks), republish
   `COACH_STAFF_ACCESS_MOCKUP.html` to the SAME artifact URL with the deviation drawn and tagged, and
   say so before building it — never after.
2. **Read the current staff code** (`components/coaches/CoachStaffPanel.tsx`, `lib/coach-membership.ts`,
   `lib/assistant-invites.ts`, `app/api/coaches/[orgSlug]/teams/[teamId]/staff/**`, the admin
   oversight page and API) and list, in one message to the owner, anything the plan's §2 gets wrong
   about them. Then build the whole pass — first-pass complete, not a slice.
3. **Tests per §2.8**; `verify:changed` + `typecheck`; **`/simplify` then `/review`** (the sheet and
   the presets table are new abstractions — simplify before correctness review).
4. **Owner QA §169** as a checkable Artifact walk (checkboxes + localStorage + paste-back; pin
   identities, not figures): the head coach invites one of each role from one sheet; resend and
   cancel a pending invite; change a role both directions; make and un-make a head coach; the
   last-head refusal; a second account accepts each kind and lands with the right doors; the whole
   thing at 390px. Name the UAT accounts (`uat-helper`, `uat-asst-nomoney`, `uat-asst-money`,
   `uat-asst-treasurer` on `uat-test-org`).
5. **`/docs`** for the help article, and the demo question: the coach sandbox seeds no assistants —
   recommend seeding one assistant and one pending invite so the shop window shows this screen, but
   **ask before touching the demo fixture**; it has its own gate (`check:demos`).
6. **Do not commit without the owner's word.** When told to, stage by pathspec in a private index,
   verify the candidate tree in a throwaway worktree (typecheck + the staff tests) before moving
   `dev`, then `git show --stat HEAD` and confirm only this pass's files landed.

## Out of scope — do not build on the way past

Roster editing as a grant (R9, later) · a compare matrix (mockup §07, declined) · staff-chat
history scoping · the staff/family double-record merge · free-tier assistants · whether money
should count towards awards (review §10 4b — flag it in the ledger entry, do not narrow it).
