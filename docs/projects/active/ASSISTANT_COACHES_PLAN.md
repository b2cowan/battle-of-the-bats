# Assistant Coaches — First-Class Participants (Build Plan)

**Status:** DECISIONS LOCKED 2026-06-25 — ready to build (not started). Supersedes the scope notes in `ASSISTANT_COACHES_BUILDING_BLOCK.md` (kept as origin) and the review/options version of this doc.
**Created:** 2026-06-24 · **Decisions locked:** 2026-06-25
**PM brief:** `ASSISTANT_COACHES_PM_BRIEF.md`
**Grounding:** 7-investigator + verification workflow vs live dev+prod schema and route handlers (2026-06-24). Every "exists today" claim below was code-verified.
**Related:** `IN_ORG_COACH_CHAT_PLAN.md`, `COACH_CHAT_PLATFORM_PLAN.md`, `COACHES_PORTAL_UNIFIED_PROJECT_PLAN.md`, `COACHES_EXPERIENCE_EVAL_PLAN.md` (J9-003 PII over-grant), `reference_coach_portal_arch_decision`, `decision_one_to_one_vs_multi_org`.

---

## 0. The framing insight

An assistant added to a team's coaching staff **today** inherits **full head-coach access** — roster guardian PII + minor DOB, the team's money (incl. edit), internal notes, document storage, and the ability to **mass-email every guardian**. The head/assistant label is stored and shown but **not enforced** on ~15 of ~17 coach surfaces. So V1's real work is **a per-assistant capability model that closes that over-grant**, not "add chat." Chat then picks assistants up for free (the participant resolvers already include all staff with no role filter).

---

## 1. Locked decisions (owner)

| # | Decision | Locked answer |
|---|---|---|
| D-1 | V1 audience | **Paid/club teams first; free Basic in Phase 3; house league later.** |
| D-2 | Permission model | **Per-assistant area toggles** (head coach assigns duties per assistant — budgets to one, lineups to another). Area-level, not field-level. Least-privilege defaults. |
| D-3 | Default capability set | Per the toggle table in §3. Coaching basics on by default; sensitive areas off by default and individually grantable. |
| D-3a | Birthdates + parent contacts | **Off by default**, head coach grants per assistant. |
| D-3b | Team money | **Three-state per assistant: Off / Read / Read+Write.** Default Off. |
| D-3c | Internal notes | **Off by default**, grantable. |
| D-4 | Announcements | **Draft-only by default**; "can send" is a grantable toggle. |
| D-5 | Who administers | **Head coach administers assistants + their privileges in EVERY case** (standalone + club-run). Org admin = override only (visibility, remove/block) + optional per-org "require admin approval" lever, default off. |
| D-6 | Notifications | **Subset by default** (chat, schedule, game-day, results); no money/dues/PII alerts by default; per-assistant adjustable. |
| D-7 | Free-tier cap | **Small cap (1–2)** assistants per free Basic team; uncapped on paid. |
| D-8 | Chat history on turnover | **Full history in team/tournament rooms;** join-date scoping reserved for future parent chat. |
| D-9 | Scorekeeping | **Out of V1** (coaches can't score today; separate project). |

**Cross-club note (re D-5):** the one-org rule was relaxed (single-org *by default*, multi-membership by deliberate exception — `decision_one_to_one_vs_multi_org`), so it is **not** a hard lock. And because an assistant is added as a **team guest** (no org-membership row), the second-org question doesn't arise at all. No special exception needed.

---

## 2. V1 model (locked)

1. **Assistants = a lightweight, team-scoped login** (a "team guest"), not a new account type and not a full org member. Reuse existing identity.
2. **Per-assistant, per-team capabilities** set by the head coach. The same person assisting two teams can have different grants on each.
3. **Least-privilege defaults:** coaching basics on, everything sensitive off; money defaults Off (Off/Read/Write).
4. **The head coach is the administrator everywhere;** org admin is override-only + optional approval lever.
5. **Free on all tiers**, small cap on free Basic, uncapped on paid; no per-seat fee. Upsell = more assistants / more delegation on paid.
6. **Chat from day one** (free pickup once the role exists); **subset notifications** by default.

---

## 3. The per-assistant capability set (default = least-privilege)

| Area | Default | Settable to | Notes |
|---|---|---|---|
| Team chat | On | On / Off | Core participation |
| Schedule | On (manage) | Manage / Off | |
| Attendance | On | On / Off | |
| Lineups | On | On / Off | A common "specialist" grant |
| Roster — names/jerseys/positions | View | View / Off | |
| Birthdates + parent contacts | **Off** | On / Off | Minor PII; PIPEDA minimization |
| Team money (budget/dues/expenses) | **Off** | **Off / Read / Read+Write** | The "assign to budgets" case |
| Internal notes | **Off** | On / Off | May hold evaluations/medical flags |
| Documents | View only | View / Manage / Off | Manage = upload/delete |
| Parent announcements | Draft only | Draft only / Can send | Send = mass-email guardians |
| Team setup, season, division, billing, upgrade | **Never** | — | Head/owner only (already enforced for season/division) |

On **free Basic** teams the set is the same minus the rep-only areas (no budget/dues/expenses module; money = the manual fee ledger toggled Off/Read/Write the same way; no documents module today).

---

## 4. Phased build

Safety ordering holds inside each tier: **enforcement lands before assistants are invitable.** Each phase ends with `/review` + typecheck; migrations only where a new capability store or cap is required (the role *values* already exist on dev+prod).

### Phase 1 — Capability framework + enforcement (paid) — ✅ BUILT on `dev` 2026-07-02 (unpushed; owner browser-test pending)
> **Done:** mig 173 (`rep_team_coaches.capabilities` jsonb, DEV-applied ⚠ PROD-PENDING) + `lib/coach-capabilities.ts` (role→effective-capability resolver, least-privilege defaults, 3-state money, redaction) threaded onto every `CoachingAssignment`. ~48 coach API routes guarded (money off/read/write, roster-PII + notes redaction, roster-write head-only, documents view/manage, announcements send, tryouts head-only, schedule/attendance/lineups). Nav (desktop + mobile) hides ungranted areas + shows an "Assistant Coach" label; overview made finance-resilient; roster hides add/edit + sensitive export/columns. Adversarial `/review` (high-risk, 4 lenses) caught + FIXED **2 CRITICAL PII leaks** (attendance + lineup GET returned the full unredacted roster — assistants have both by default) plus dues-embed redaction, `roster:'off'` enforcement, head-coach gates on upgrade-summary/retry + team-links (ownership transfer), and removed a latent `next/server` client-bundle hazard. typecheck 0 err · lint 0 err · dictionary ✓ · snapshots ✓ · clean dev restart (200, no EACCES) · 2 guarded routes smoke-tested (401 not 500). ⚠ mig 173 must be applied to PROD before this code promotes to master.
- Define the per-assistant capability model (per-team) and the default least-privilege grant.
- Enforce it across every paid coach surface: money (Off/Read/Write), roster-PII lock, internal notes, documents (view/manage), announcements (draft/send), schedule/attendance/lineups/roster on/off. Hide/disable what's not granted; never rely on the database to enforce (app-layer is the only gate).
- Role label in the coach nav; assistant-aware empty states.
- *Gate: assistants not invitable in the portal until enforcement is proven (the proving step mirrors the chat-slice validation pattern — verify a real assistant sees only granted areas).*

### Phase 2 — Head-coach administration UI + invites + comms (paid) — ✅ CORE BUILT on `dev` 2026-07-02 (unpushed; owner browser-test pending)
> **Done (core):** mig 174 (`assistant_invite_tokens` single-use SHA-256 token / 7d expiry / RLS-no-policies / invited_by FK + `organizations.coach_settings`, DEV-only ⚠PROD-PENDING). Head coach **invites** (email → accept page → account setup → joins), **manages** each assistant's duties (per-assistant grid: 3-state money/documents + on/off toggles) on the coach **Settings** page, and **removes** them. Head-coach-only staff API. **Identity decision (owner-accepted):** the coach portal's sign-in REQUIRES an org membership, so a literal zero-membership guest would need an auth rebuild — instead an assistant gets a **minimal, permission-less `coach` membership** that behaves as a guest (only ever sees their assigned team); the accept path deliberately SKIPS the one-org guard so cross-club assistants work; an orphaned guest membership is cleaned up on removal. Adversarial `/review` (4 lenses) folded in — CRITICAL (claim-token-first replay guard) + HIGH (role-checked membership activation, invited_by FK) + PII/dedup/self-target hardening. typecheck/lint/dictionary/snapshots green; clean dev restart; 3 new routes smoke-tested.
> **Remainder (deferred):** the admin **override surface** — an org-wide "all assistants" view + the **"require admin approval" toggle UI** + an approve-pending action. The approval flow is built server-side but is UNREACHABLE until that toggle ships (so the core is safe). ⚠ migs 173+174 → PROD before promoting.
- Head-coach **invite/remove** for assistants on **both** standalone and club-run teams via a team-scoped invite (no org-membership change). Correct minimal role on accept.
- Head-coach **manage screen**: per-assistant toggle grid (the §3 set) including the three-state money control.
- Org-admin **override surface**: see all assistants across teams, remove/block; optional per-org "require admin approval" setting (default off).
- Assistant **default-subset notifications** via the existing preference system; per-assistant adjustable.
- Chat already includes assistants — verify pickup, no new work.

### Phase 3 — Free Basic teams
- Same model on free teams: activate the reserved free-team assistant slot (no migration for the value), team-scoped invite-to-team flow, role-aware guards, owner-gated setup/upgrade CTAs.
- **Free-tier cap (1–2)** assistants per team; uncapped on paid.
- Path to alert free (non-org) assistants (today's notification engine only reaches org members).

### Phase 4 — Chat lifecycle polish
- Auto-clean chat membership when an assistant is removed from a team.
- (Full history stays for team/tournament rooms per D-8; join-date scoping deferred with parent chat.)

### Phase 5 — House-league coaches (later, separate)
- New team-scoped coaching-staff model for house league (none exists today). Must scope every read to the coach's own team (fixes the J9-003 over-grant pattern in passing).

---

## 5. Surface-by-surface impact

| Surface | Today | V1 change | Phase |
|---|---|---|---|
| Admin team-coaches assignment (paid) | Role selector + badges exist | Keep; add org-admin assistant-override view | 2 |
| Paid coach dashboard / sidebar | Shows role on dashboard only | Role label in sidebar; capability-aware nav (hide ungranted areas) | 1 |
| Paid team pages (roster / money / docs / notes / announce) | Admit any staff equally | Per-assistant capability enforcement | 1 |
| Head-coach manage screen | None | Per-assistant toggle grid (incl. 3-state money) | 2 |
| Invite flow (paid) | Admin-only org invite | Team-scoped head-coach invite/remove | 2 |
| Tournament-view "head coach" editor / upgrade CTA | Editable by any member | Owner-gate | 1 |
| Free portal hub / team pages | Role-blind, single-coach copy | Show assistant teams + role; capability enforcement; owner-gate setup/upgrade | 3 |
| Free invite-to-team | None | Team-scoped invite | 3 |
| Notifications | Org-scoped, single-recipient | Assistant default-subset; reach free assistants | 2 / 3 |
| Chat (tournament/in-org) | Resolvers already include all staff | None to include; membership cleanup on removal | 4 |
| Scorekeeper | Coaches blocked | Out of V1 | — |
| House-league coach surface | None | Out of V1; new team-scoped model later | 5 |

---

## 6. Risks & mitigations

1. **Shipping the over-grant.** Enforcement gates each tier — assistants aren't invitable until least-privilege is proven.
2. **Guardian-PII / mass-email (PIPEDA/CASL).** PII + "can send" are off by default and explicit grants; the head coach owns the decision and the org admin can audit/override.
3. **Repeating J9-003** (team-blind coach reads). Scope every coach read to the coach's own team; house league deferred but must follow this rule.
4. **Cross-club assistants.** Resolved by the team-guest model (no org membership) + the relaxed one-org policy. No hard block.
5. **Stale chat access after removal.** Membership cleanup on removal (Phase 4).
6. **Accidental org-level over-grant** via the current invite workaround. The assistant invite writes a team-scoped role, never the generic over-granting path.
7. **DB won't enforce.** App-layer capability checks on every surface + a guard/lint to keep them in place.

---

## 7. Implementation outline (engineer-facing)

1. **Capability store + resolver:** per-assistant, per-team capability set (paid first; reuse the reserved free-team role slot in Phase 3). One source of truth read by every coach route and the nav.
2. **Paid enforcement:** apply capability checks to the ~15 coach surfaces that ignore role today — money (off/read/write), roster-PII gate, internal notes, documents (view/manage), announcements (draft/send), schedule/attendance/lineups/roster (on/off). UI hides/disables ungranted areas.
3. **Proving step:** validate a real assistant sees only granted areas before exposing invites (mirror the chat-slice validation discipline).
4. **Head-coach admin UI + team-scoped invite:** invite/remove + the per-assistant toggle grid; org-admin override view + optional approval lever.
5. **Comms:** assistant default-subset via existing prefs; non-org delivery path for free assistants.
6. **Free Basic:** activate reserved slot (no migration for the value), invite-to-team, capability enforcement, owner-gated setup/upgrade, free cap.
7. **Chat lifecycle:** membership cleanup on coach removal.
8. **Guardrails:** app-layer checks everywhere; a coach-route enforcement guard; DOB/PII consent acknowledgment when a head coach unlocks PII for an assistant.

Migrations only where a per-assistant capability store or a free cap column is needed; the head/assistant and free `coach` role *values* already exist on dev+prod.
