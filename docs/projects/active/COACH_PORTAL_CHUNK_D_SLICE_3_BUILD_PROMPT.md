# Chunk D — BUILD PROMPT, Slice 3: the coach byproducts

> **Created 2026-08-01** at the close of the Slices 0/1/2 build session. Paste into a **FRESH
> chat.** Discovery is done, the owner has ruled, mockups are approved, Slices 0–2 are built.
> Your job is **Slice 3 and nothing else.**
>
> ⚠ **Slice 3 is NOT a straight build.** Its anchor item — the per-player season recap — reads
> records the coach kept all season and must **degrade honestly**. Do a ground-truth pass on
> what data actually exists per player before designing a single screen. The previous session's
> handoff contained a false claim that cost real rework; assume yours might too.

---

## Read these FIRST, in order

1. `docs/projects/active/COACH_PORTAL_CHUNK_D_FAMILY_EXPERIENCE_PLAN.md` — **the build spec.**
   §4 (Slice 3 table) is your work items; §6 cross-cutting rules bind; **§9 is the build record
   of Slices 0–2 including the deviations and the two `/review` rounds** — read it, it tells you
   what already exists and what bit the last session.
2. `docs/projects/active/COACH_PORTAL_CHUNK_D_FAMILY_EXPERIENCE_DISCOVERY.md` — §4 (the five
   ledger items, judged), §2 G2/G6 (what data does and does not exist — **G2 is the one that
   shapes this slice**), §10 (owner rulings, binding).
3. **Mockups artifact `2b0cbcab-9848-4a69-a0e6-a8c90cc85eb2` v3 — APPROVED = binding visual
   spec.** Screens **S6** (postgame draft), **S7** (season recap + keepsake card), **S8**
   (printable certificate). Any deviation gets flagged in the plan's deviations section and
   called out at QA, mockup-rule style.
4. `CLAUDE.md` + `AGENCY_RULES.md` — archive opt-in, the blocking PM UX plan, post-edit
   review/simplify/docs offers, verification workflow, branch policy.

## Scope — exactly this

Plan §4, items **3.1–3.6**:

| # | Item | Note |
|---|---|---|
| 3.1 | **Postgame recap draft** | Score entered → "Draft the family email" → prefilled Email-families compose. Opt-in per send (D-E9: **no auto-send to families, ever**). Skipping must leave no visible hole. |
| 3.2 | **Player season recap** | The anchor. A per-player sibling of the shipped Season Wrapped engine. **Degrades honestly** — absent data = absent block, never fabricated. Coach previews before family release. |
| 3.3 | **Keepsake card** | Canvas share-card rail (the shipped Season Wrapped pattern): **first name + jersey only**, OS share sheet, **no public URL**, family-triggered. |
| 3.4 | **Printable certificates** | Print-CSS off `rep_player_awards`, team colours, full name **on paper** (§8.2 reading, owner-approved). Two clicks from awards history. |
| 3.5 | **Engagement counts** | Coach-side aggregates ("12 families opened the recap") — **counts only, never per-person read receipts.** |
| 3.6 | **Org-admin rollup** | Per-team connected-family counts on the org side. Read-only aggregates, no new PII surface. |

**Explicitly OUT:** anything in Slices 0–2 (built); family chat (**CUT 2026-08-01 — do not
revive**); RSVP; photos; per-player game stats (**they do not exist and ruling 3 forbids
capturing them**); any new SKU or price.

## Ground truth — VERIFIED 2026-08-01, but re-verify the load-bearing ones

The per-player ingredients for the recap **all exist** (checked against the live dev snapshot):

- `rep_team_event_attendance` — status per player per event → attendance rate + counts
- `rep_player_development_goals` — `focus_area`, `status` → "worked on this season"
- `rep_player_measurables` — `value`, `unit`, `recorded_on`, `session_id` → before/after trend
- `rep_player_awards` — awards with type + date → recap block AND the certificates (3.4)
- `rep_team_lineup_entries` — `inning_positions`, `starter`, `batting_order` → playing time
- `lib/season-wrapped.ts` — `computeSeasonWrapped()` — **the assembly pattern to mirror**, and
  `WRAPPED_RECORD_EVENT_TYPES` is the existing "which events count" list

**⚠ What does NOT exist and cannot:** per-player in-game statistics. No box scores, no
per-pitch, nothing. Discovery G2 verified this exhaustively across all three game tables. **The
recap is a GROWTH recap, not a stats recap** — that is the differentiated version, not a
consolation prize, and the mockup S7 reflects it. Do not invent a stats block.

**Also true and load-bearing:**
- Announcement bodies ARE stored (`rep_team_announcements.body`), so 3.1's draft can prefill a
  real compose and the archive already works.
- `lib/family-email.ts` is the ONE sanctioned way to email a family — it owns opt-out
  suppression and the CASL footer. **Never call `sendEmail` directly for a family.**
- The guardian tier is **BUILT and SWITCHED OFF** (`GUARDIAN_TIER_ENABLED`, default off).
  3.2/3.3 are DELIVERED to guardians, so their family-facing half is dark until that flag flips.
  **Build it anyway, behind the same flag** — the coach-side preview (3.2) and the certificates
  (3.4) need no flag at all and can ship immediately.
- Migration numbering: **217 is taken.** Check `supabase/migrations/` live and take the next
  free number. Never apply to prod; dev via `scripts/apply-migration-api.mjs`;
  `npm run refresh:snapshots` + dictionary in the SAME unit of work.

## Landmines

- ⚠ **Concurrent sessions share this working copy.** `git status` before you start; stage
  **explicit `:(literal)` pathspecs only**; audit `git show --stat HEAD` after every commit;
  re-check the branch is `dev`. At time of writing another session held `lib/directory.ts` and
  `lib/module-entitlements.ts` mid-edit — **do not "fix" typecheck errors in files you did not
  touch.**
- ⚠ **NO commit/push without explicit per-action owner OK.** Standing rule, never carries over.
- ⚠ **"Degrades honestly" is the whole design constraint of 3.2.** A team that logged no tests
  has NO "worked on" block — not an empty one, not a placeholder, not an encouraging sentence.
  The recap must be truthful for a coach who used one feature all season, and it must never
  imply the coach neglected anything.
- ⚠ **No new recurring coach input.** Every family surface must stay truthful with zero extra
  coach work. 3.1 is the one deliberate exception-shaped item and is safe *because skipping it
  breaks nothing* — families never see a "missing recap" hole.
- ⚠ **The keepsake card is first name + jersey ONLY**, drawn client-side, handed to the OS share
  sheet, **no public URL**. The certificate is the approved paper exception (full name, handed
  over by the coach). Do not create any other surface that names a child.
- ⚠ **The archive is OPT-IN and build-enforced.** The recap is the *approved decision-#2
  exemption* (families read their own past season). Adding anything to
  `APPROVED_ARCHIVE_DOORS` / `APPROVED_SEASON_AWARE_ROUTES` fails the build until the list is
  edited — that is the decision point, not a formality.
- ⚠ **Timezone:** any "today / this season" logic goes through `lib/timezone.ts`. Instant
  comparisons are fine; CALENDAR-DAY reasoning is the trap. Guardrail is at ZERO.
- ⚠ **Design system:** no hex/inline colours (guardrail at ZERO, all scopes). Certificates need
  print CSS — team colours come from the team's stored colour, still via tokens where possible.
- ⚠ **Engagement counts are COUNTS.** Never "who opened it". A per-person read receipt on a
  child's recap is a different product and a worse one.

## Process (owner-mandated)

**Blocking first step: present a plain-language PM UX summary before any code.** Then: build →
`npm run verify:changed` (+ `typecheck` on shared-module touches) → probes (copy
`tests/uat/scenarios/family-access-boundary.spec.ts` — service-role self-provisioning, marker
prefix, asserted teardown, real in-app controls, data-level assertions not screenshots) →
`/simplify` → `/review` at **high-risk** (minors' data; the last two rounds found a Critical
each, both real) → `/docs` → **fresh dev restart** (stop → delete `.next` → start → wait Ready)
→ **owner QA** → commit only on explicit per-action OK.

**Probe personas that matter here:** a follower must reach NO recap and NO keepsake; a guardian
of player A must not reach player B's recap; a coach without `rosterPii` must not reach the
engagement counts; an anonymous caller must reach none of it.

## Program state at handoff

Chunks A·G·H·E·I·C·B on prod. F committed on dev, unreleased. **Chunk D Slices 0, 1 and 2 built
on dev, UNCOMMITTED, owner QA pending** — migrations **214–217 are DEV-ONLY** and must be
applied to prod before any of it promotes (⚠ 215 and 217 contain a FUNCTION and a TRIGGER, and
`check:migrations` gives a **false green** for those — verify via `pg_proc`/`pg_trigger`
directly). The counsel packet
(`COACH_PORTAL_CHUNK_D_COUNSEL_PACKET.md`) is with the owner; the guardian switch turns on only
after sign-off lands in `BUSINESS_DECISIONS.md`. **Slice 4 (family chat) is CUT** — chat stays
coaches/admins only; do not re-propose it.

**One open follow-up inherited from Slice 2** (not yours to fix unless you touch that screen):
a mismatched guardian claim shows the coach only the address they typed, not the claimant's —
blocking before the guardian switch is turned on, harmless while it is off.
