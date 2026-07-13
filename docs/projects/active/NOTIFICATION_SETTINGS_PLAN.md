# Platform-Wide Notification Settings — Implementation Plan

> **Status:** Planning — awaiting owner sign-off on direction (no code until approved)
> **Created:** 2026-07-13
> **Branch:** dev
> **Companion:** docs/projects/active/NOTIFICATION_SETTINGS_PM_BRIEF.md

## Goal

One coherent notification-preference experience across the whole platform — every notification, every recipient persona, every channel (bell / push / email) — that stays simple for each individual user while being complete. The immediate trigger: the weekly coach Insights digest shipped push-on-by-default with **no coach-facing off switch**, because coaches have no notification-settings surface at all. Rather than bolt a one-off toggle onto the coaches portal, this plan designs the whole system once: a full audit of what exists (Part 1), three strategy options with a judged recommendation (Part 2), and a phased build (Part 3).

## PM Brief

See docs/projects/active/NOTIFICATION_SETTINGS_PM_BRIEF.md (kept as its own file; summary: give every audience a findable, honest notification-settings surface built on the one existing engine — coaches first, admin honesty fixes second, a cross-hat "all my settings" container third — while explicitly parking fan-account settings until Unified App Phase 2 and guardian email compliance as its own project.)

---

# Part 1 — Audit (verified against live code 2026-07-13)

Run as a 10-agent audit (8 readers + completeness critic + adversarial fact-check) over the live tree + dev schema snapshots. Corrections from the fact-check are folded in. Where docs disagreed with code, code truth is recorded and drift flagged (§1.8).

## 1.1 Four parallel notification systems exist

| # | System | Channels | Audience | Preference storage |
|---|--------|----------|----------|--------------------|
| 1 | **`notify()` engine** (`lib/notify.ts`) | bell + push + email | org members only (owner/admin/staff/coach accounts) | `notification_preferences` (user, org, event → bell/push/email booleans) + `tournament_notification_preferences` (user, tournament, event → `opted_out` veto, no channels) |
| 2 | **Anonymous fan push** (`lib/fan-notify.ts`) | push only | accountless devices following a tournament/team | `fan_push_subscriptions` (endpoint + tournament, NO user_id; `notify_scores`/`notify_messages` booleans) + localStorage |
| 3 | **Direct email stack** (`lib/email.ts` / `lib/email-sender.ts` / `lib/platform-email-templates.ts`) | email only | coaches, guardians, org owners, invitees (~50 templates) | none per-recipient; only `organizations.email_marketing_opt_out` (org-level, marketing-only) |
| 4 | **Platform ops alerts** (`lib/observability/alerts.ts`, feedback route) | email only | hardcoded single `ADMIN_EMAIL` constant | none |

Engine resolution order (per recipient, verified): ① tournament veto row (`opted_out=true` ⇒ skip entirely — a mute, never per-channel) → ② exact `notification_preferences` row (three channel booleans used verbatim) → ③ `systemDefaults()`: bell **always ON**, push ON iff event ∈ `PUSH_DEFAULT_ON_EVENTS` (17 of 21 events), email ON only for `payment_failed` × owner/admin. No wildcard/org-default rows exist. Push devices (`push_subscriptions`) are **user-global** (one device list across all orgs).

## 1.2 Event-type matrix — 21 declared, 16 live, 5 dead

**Live events** (trigger → recipients; defaults = bell/push/email when no row exists):

| Event | Trigger | Recipients | Defaults (B/P/E) | Mutable today? |
|---|---|---|---|---|
| registration_new | public reg form; admin manual add | all active org members (staff tournament-scoped) | on/on/off | admin surfaces only |
| registration_status_changed | admin accept/reject/waitlist (single + bulk) | same | on/off/off | admin surfaces only |
| payment_received | admin marks paid | same | on/on/off | admin surfaces only |
| payment_failed | Stripe webhook | all org members (org-wide) | on/on/**email on for owner+admin** | admin org page only |
| score_submitted | admin/scorekeeper score entry, forfeit | all org members (staff scoped) | on/on/off | admin surfaces only |
| team_no_show | gate check-in no-show | same | on/on/off | admin surfaces only |
| house_league_registration_new | **admin manual add only** (public self-reg is silent — gap) | all org members | on/off/off | admin org page only |
| chat_message | chat post / poll (Plus+ orgs) | room members minus mentioned | bell suppressed (talk)/on/off | admin surfaces only |
| chat_mention | @mention in chat | mentioned users | bell suppressed/on/off | **nobody — deliberately unmutable** |
| tryout_offer_response | guardian accepts/declines via link | every `rep_team_coaches` row for the team, **all seasons, capability-blind** | on/on/off | admin org page only (coaches can't reach it) |
| assistant_coach_joined | invite accepted | head coaches of that team | on/on/off | **nobody** (hidden lifecycle event) |
| assistant_coach_approval_requested | head coach invites, org requires approval | **ALL org members** (over-broad) | on/on/off | **nobody** (hidden) |
| playoffs_set | bracket first materialized (once) | all org members (staff scoped) + parallel fan push | on/on/off | admin surfaces only |
| champions_crowned | bracket completes (once) | same + parallel fan push | on/on/off | admin surfaces only |
| tournament_announcement | organizer posts w/ notify options | all org members (staff scoped) + optional fan push + optional direct coach email | on/on/off | admin surfaces only |
| coach_insights_digest | weekly Sunday sweep (pg_cron mig 183, dev-only) → per-coach | each rep-team coach; digest **content** capability-filtered, delivery is not | on/**on**/off | **nobody — the gap that triggered this plan** |

**Dead events** (declared + labeled + toggleable in settings UI, but zero call sites — the settings page promises things that never fire): `roster_change_requested`, `score_disputed`, `registration_deadline_approaching`, `waitlist_opened`, `coach_access_requested`.

**Recipient-targeting defects found (engine, not UI — deferred to a separate project, §3.6):**
- Coaches hold `organization_members` role `'coach'` rows, and only role `'staff'` is tournament-assignment-scoped ⇒ **a coach receives playoffs_set / champions_crowned / score_submitted for every tournament in the org**, not just their team's.
- `notify()` has zero capability awareness ⇒ a `tryouts:false` assistant still gets tryout pings; recipients for tryout_offer_response span all program years.
- `assistant_coach_approval_requested` fans out to all members incl. staff who can't approve.

**Engine coverage gaps (candidate new triggers/events, deferred):** public house-league self-registration and bulk CSV team import never call `notify()` (silent to admins); house-league status changes have no event type at all; `PATCH /api/registrations/[id]` mutates status + emails the coach but never calls `notify()` (verify whether that route is even live); tournament-completed has no staff event (email-only to coaches).

## 1.3 Existing preference surfaces (all of them)

| Surface | Who can reach it | What it controls |
|---|---|---|
| `/{org}/admin/org/notifications` | League/Club org members only (Tournament tiers hard-redirected away from `/admin/org/*`); reached via bell-panel gear only (no nav item — binding decision) | 17 event rows × Bell/Push/Email; push device manager (`PushDeviceTester`). Writes `notification_preferences`. Any org role can reach by URL (nav hides it for staff; API only requires membership) |
| `/{org}/admin/tournaments/settings/notifications` | all tiers; the ONLY surface for Tournament/Tournament Plus (bell gear routes here via `getNotificationSettingsHref`) | ⚠ a "Receive via" channel block that **looks tournament-scoped but batch-writes the org-level rows** across the 9–10 tournament event types; plus an honest per-event Receive/Mute + "Mute all" writing the tournament veto table; chat section when plan has `tournament_chat` |
| Fan bell (public tournament pages, Plus+ orgs) | anonymous device | 2 toggles (score alerts incl. playoffs/champions; tournament messages), per device per tournament |
| Coaches shells | **nothing** — rep-coach bell has no settings link (deliberately omitted: nowhere to land); `/coaches/notifications` is a read-only feed; basic-coach shell has no bell and no push-enrollment UI; standalone Premium Coaches Portal has no settings page anywhere | — |
| Scorekeeper (`official`), consumer `/account`, platform-admin | **nothing** (no bell / placeholder stub / hardcoded ops email) | — |

## 1.4 Personas × control (the gap map)

| Persona | Bell | Push control | Email control | Verdict |
|---|---|---|---|---|
| Org owner/admin (League/Club) | ✓ | ✓ | ✓ (engine events) | covered |
| Org owner/admin (Tournament/T+) | ✓ | ✓ but mislabeled scope | ✓ same | covered, **dishonest UI** |
| Staff (assigned-tournament) | ✓ | ✓ (via URL/bell gear) | ✓ | covered |
| Scorekeeper (official) | none | — | — | receives nothing today; fine |
| Rep head coach | ✓ | **none** | **none** | **uncovered; digest lands here** |
| Assistant coach (capability-scoped) | ✓ | **none** | **none** | **uncovered**; also over-notified |
| Basic (free) tournament coach | no bell | none (no enrollment UI) | none | mostly chat-only exposure |
| Standalone Premium Coaches Portal coach | ✓ | **none** | **none** | **uncovered — no settings page exists in their whole product** |
| Coach who also runs a tournament (multi-hat) | ✓✓ | per-org hunting | per-org hunting | fragmented |
| Fan/parent (anonymous device) | n/a | 2 toggles per tournament | n/a (no fan email exists) | covered but per-device/per-tournament only |
| Fan with an account | — | **nothing account-linked yet** | — | Unified App Phase 2 territory |
| Guardian (email contact, no account) | n/a | n/a | **no opt-out for recurring dues/announcement emails** | **compliance frontier (CASL)** |
| Platform admin | n/a | n/a | hardcoded single inbox | explicitly out of scope (§3.7) |

## 1.5 Email layer reality (parallel to the engine)

- The engine's `channel_email` is a real per-event opt-in (default off) — but reaches org members only.
- ~50 direct templates bypass the engine entirely. The recurring ones with **no recipient opt-out**: dues reminders (3 identical-copy trigger paths: daily cron sweep, admin wave, coach button — any future toggle must govern all three), team announcements to guardians, organizer broadcast emails, game-day reminders (explicitly `skipOptOutCheck`), schedule-published, results-finalized.
- Coach-facing registration lifecycle emails are gated by **per-tournament admin toggles** (`coachEmailEnabled`), i.e. the sender controls the recipient's email, never the recipient.
- Unsubscribe = org-level marketing-only flag. **Confirmed CASL bug:** the `spotlight_coaches_coach` campaign emails individual coaches but its unsubscribe link flips the *org's* opt-out, not the coach's (cross-identity consent). → narrow fix ticketed in Phase 2; the broader per-person suppression model stays parked (§Parked).
- No per-person suppression table exists anywhere in the schema.

## 1.6 Multi-hat / multi-org facts

One user_id can simultaneously be org admin (Org A), coach (Org A and/or B), tournament official, basic coach (email-keyed), and fan (device-keyed). Preferences are strictly per-(user, org); a multi-org human configures each org separately. Push devices are the one user-global piece. `/home` picker (`getUserAccessContexts()`) already enumerates every hat — the natural aggregation substrate.

## 1.7 Binding constraints inherited from prior decisions

1. Extend `notification_preferences` + the tournament veto table — never fork a parallel prefs schema.
2. Toggles read **ON = "I receive this"** (never expose raw `opted_out`).
3. Chat stays off the bell (owner-locked); chat prefs belong near the Chat UI.
4. No sidebar nav items for preference pages — the bell-panel "Manage preferences" link is the pattern (conscious reversal requires logging).
5. Tournament/Tournament Plus orgs must never be routed into `/admin/org/*`.
6. `PUSH_DEFAULT_ON_EVENTS` stays the single source of truth for push defaults.
7. Honest channel UI: push only reaches enrolled devices; keep the verify-real-subscription pattern (`verifyFanAlertsLive` precedent, `PushDeviceTester` copy).
8. Unified App Phase 2 owns fan accounts: `fan_follows` + per-follow 3-state (all / game-day only / mute); anonymous + account fan paths coexist forever, reconciliation is explicit, never auto-merge. Do not pre-build.
9. Every new authed route ships with a same-change `public/sw.js` cache-denylist entry (already covered here: new routes below nest under `/coaches` and `/account`, both denylisted — verify at build time).
10. Dues copy stays byte-identical across its three trigger paths.
11. `NOTIFICATION_CATEGORY` (act/know/talk, total map) is the taxonomy to reuse, not replace.

## 1.8 Doc/code drift flagged (for follow-up, not this build)

- `docs/agents/strategy/PLAN_PRICING_FACTS.md:63` says fan tournament-message push is "not yet built" — it **is** built and live-wired (announcement fan push gated on `fan_score_alerts`). → flag to `/strategy` for a Facts-doc correction.
- `COACH_INSIGHTS_DIGEST_PM_BRIEF.md` tells customers the digest is "switchable off per-person" — false until Phase 1 here ships; update that brief when it does.
- `NOTIFICATIONS_PLAN.md` (May 2026) header still says `Status: Planning`, but its Phases A–E are built and live per this audit, and its canonical event-type table (11 events) is materially incomplete vs. today's 21 declared / 16 live. Recommend marking it Complete/archiving (its D5 no-nav-links decision and two-layer model remain binding regardless).

---

# Part 2 — Options considered and recommendation

Three independent designs were produced and scored by three judges (persona-simplicity, engineering-fit, compliance/defaults):

| Option | One-liner | Judge outcome |
|---|---|---|
| **A — Per-shell-first** | One shared PreferenceCenter component, five shell-native pages, plus a nullable `tournament_id` on `notification_preferences` for true per-tournament channels | Lost all three lenses — the migration is unforced (the scope problem is a labeling problem); best ideas grafted: capability-filtered rows, "Weekly summary" digest framing, declarative row contract |
| **B — One human, one page** | Single universal `/account/notifications` aggregating every hat via `getUserAccessContexts()`; every bell points there; tournament page becomes veto-only | Won engineering lens (zero schema change, cleanest Phase 2 fan-card container); persona judge dinged findability (coaches don't look in /account) and the big-bang bell rewiring |
| **C — Smallest true fix first** | Coach page + digest switch + tournament-page honesty relabel now, no schema, everything else parked with explicit triggers | Won persona + compliance lenses; only weakness: defers the multi-hat answer entirely |

**Recommendation — converged C→B ("one engine, one component, shell doors now, one container later"):** build Option C's increments in Option A/B's target architecture, with B's universal page as a *named, committed* Phase 3 rather than an unparked idea:

- **One shared `PreferencesTable` component** (declarative rows: eventType, section, visibility, per-channel editability) consumed by every surface — admin org page, tournament page, new coach page(s), and later the universal container. One rendering engine, N doors.
- **Shell-native doors stay the primary path** (bell gear in each shell) — findability wins; a coach never has to discover `/account`.
- **`/account/notifications` becomes the cross-hat container in Phase 3** — one card per context (same `getUserAccessContexts()` the /home picker uses), the reserved landing spot for Unified App Phase 2's fan "Following" card (container ≠ storage; fan prefs keep their own model). Shell doors gain a "See all your notification settings" link when the user has 2+ contexts.
- **Locked interaction rules** (judge fatal-flaws, adopted as named rules):
  - **R1 — Default-ON is never buried:** any default-ON notification (the digest) gets an always-visible control on the page's unexpanded default view, never inside an accordion.
  - **R2 — No silent batch writes:** any rollup control that writes multiple event rows shows a tri-state (on / off / mixed) and captions its blast radius ("applies to N notification types"); the per-event grid remains the truth. This is the exact bug class the tournament page has today — never reintroduce it at a new grain.
  - **R3 — Two-sentence scope model, verbatim everywhere:** "Org settings decide what you receive. Tournament settings can only mute — they can't turn a channel back on."
  - **R4 — Toggles a persona can't act on don't render:** assistant rows are filtered by capability grants; module/plan gating filters sections (UI mitigation only; the engine fan-out fix is a separate project).

---

# Part 3 — Phases

## Phase 1 — Coach surface + honesty fixes (no migration, no schema change)

- [ ] Extract shared `components/notifications/PreferencesTable.tsx` from the two existing near-duplicate grids (`app/[orgSlug]/admin/org/notifications/page.tsx`, `app/[orgSlug]/admin/tournaments/settings/notifications/page.tsx`) — pure refactor, no behavior change; adopt the declarative `PreferenceRow` contract (eventType, sectionLabel, visible, channels, channelsEditable, tournamentScoped)
- [ ] New rep-coach settings page `app/[orgSlug]/coaches/notifications/settings/page.tsx` (sibling of the read-only feed): top section **"Weekly summary"** with the `coach_insights_digest` Bell/Push toggles always visible (rule R1); below, "Team activity" rows for coach-relevant events (`tryout_offer_response`); one-line pointer "Chat notification settings live in Chat →" (constraint 3). Whether the assistant lifecycle bells (`assistant_coach_joined`/`assistant_coach_approval_requested`) appear as informational non-toggleable rows or stay fully hidden as today is an owner decision (see Open Questions). Reuses `PushDeviceTester` for device enrollment (first push-enrollment UI coaches have ever had)
- [ ] Wire the existing-but-unused `settingsHref` prop on the coaches bell (`components/coaches/CoachesSidebar.tsx`) → the new page; add a settings affordance atop the `/coaches/notifications` feed page
- [ ] `lib/notification-labels.ts`: add a coach-shell event list (digest + coach events) — the digest finally gets its promised row; remove the 5 dead event types from `NOTIFICATION_SECTIONS` (one coordinated change — the admin grid stops advertising toggles that never fire; the `NotificationEventType` union, labels, and the `NOTIFICATION_CATEGORY` total map are untouched, preserving the Notification Center Rework's typecheck drift guard)
- [ ] Tournament settings page honesty fix (copy/layout only, zero API change): split into two labeled blocks — **"This tournament only"** (the veto toggles, honest today) and **"Your notification channels — all tournaments in {org}"** (the existing channel block, relabeled with rule R3 copy; keep the block for Tournament tiers since it's their only channel surface; League/Club get a link to the org page)
- [ ] API: reuse `/api/admin/org/notification-preferences` unchanged from the coach page (it only requires org membership; rep coaches and team-workspace coaches are members). Confirm the standalone team_workspace org resolves correctly
- [ ] Verify sw.js denylist coverage for the new route (nested under `/coaches` — already covered; confirm) 
- [ ] Update `COACH_INSIGHTS_DIGEST_PLAN.md` (opt-out gap closed) + offer `/docs` (coaches guide: how to manage notifications; digest FAQ) + offer `/review`

## Phase 2 — Simple views, capability scoping, reach + hygiene

- [ ] Simple/Advanced view on the admin org page + coach page: default view = plain-language groups from `NOTIFICATION_CATEGORY` ("Needs your attention" / "What's happening") with tri-state per-channel rollups per rule R2; full per-event grid demoted into a `CollapsibleCard` "Customize individual notifications" expansion
- [ ] Assistant-coach capability filtering (rule R4): coach page rows filtered by resolved capability grants (e.g. no tryouts capability ⇒ no tryout toggle) — UI visibility only
- [ ] Basic (free) coach door: minimal settings entry in `CoachPortalShell` ("More" sheet) — needs a small coaches-scoped API route (same table; basic coaches aren't org members so the admin-scoped route won't authorize them) — no schema change; any new route gets its `public/sw.js` denylist check in the same change (constraint 9)
- [ ] Standalone Premium Coaches Portal door: point the same `PreferencesTable` at the team_workspace org context (near-zero incremental cost once Phase 1 lands)
- [ ] `/home` workspace cards gain a "Notification settings" secondary action deep-linking each context's shell door (the cheap multi-hat fix, pulled forward)
- [ ] **CASL unsubscribe mis-scoping bugfix** (standalone commit, `/review` required): the coach-campaign unsubscribe link must not flip the org's opt-out; narrowest correct fix, explicitly NOT a new suppression system
- [ ] `/docs` sync for all new/changed surfaces

## Phase 3 — The universal container (trigger: Unified App Phase 2 kickoff, or owner priority)

- [ ] `/account/notifications` under `app/(consumer)/account/`: one card per context via `getUserAccessContexts()`, each card = the same `PreferencesTable` scoped to that context; shared push-device block (devices are user-global); `?focus=` deep-link support; confirm `public/sw.js` denylist coverage in the same change (`/account` prefix is already listed — verify, constraint 9). Note: Unified App Phase 2 also extends `getUserAccessContexts()` (adds a `fan` context kind) — cross-coordinate any change to that helper
- [ ] Shell doors stay primary; doors + `/home` link to the container for 2+ context users ("See all your notification settings")
- [ ] Reserved "Following" card slot for Unified App Phase 2 fan follows (container only — fan prefs keep their own per-follow 3-state model and storage; zero pre-build)
- [ ] Decide then whether admin bells re-point here (default: no — doors stay primary)

## Explicitly parked (each with a trigger — do not build here)

| Parked item | Why | Unpark trigger |
|---|---|---|
| **Guardian email opt-out / per-person suppression (CASL)** | guardians have no account/user_id; a half-fix inside a settings pass creates a second parallel prefs system | Unified App Phase 4 (family accounts + PIPEDA/CASL review) kickoff, or owner/legal urgency — then its own plan + PM brief |
| **`notify()` recipient-scoping fixes** (coach org-wide over-notification; capability-blind tryout fan-out; approval-request over-broadcast) | shared-dispatch logic change touching every event's fan-out; needs its own review + tests | next deliberate touch of `lib/notify.ts`, or coach noise complaints — ticket now, build separately |
| **Fan account notification settings** | Unified App Phase 2 owns `fan_follows` + per-follow prefs | Phase 2 kickoff (lands as a card in this plan's Phase 3 container) |
| **Per-tournament channel granularity** (nullable `tournament_id` on `notification_preferences`) | unforced migration; the current problem is labeling, fixed in Phase 1 | genuine demand for different channel mixes per tournament → dedicated `/db`-reviewed project |
| **Platform-admin ops alert routing** (6-role `platform_users` table vs one hardcoded inbox) | no persona/engine overlap; single-operator reality today | platform staff headcount > 1 |
| **Engine coverage gaps** (silent house-league self-reg, silent bulk import, house-league status events, orphan PATCH route) | new triggers/events = product decisions, not settings UI | fold into the notify() scoping project above or a dedicated pass |

## Architectural decisions

- **Decision:** Shell-native doors + one shared component now; universal `/account/notifications` container in Phase 3. **Rationale:** persona findability (coaches look in their shell, not /account) + zero big-bang bell rewiring, while still committing to the one-human-one-page endgame the multi-hat audit demands; the container doubles as the landing spot for Unified App Phase 2 fan cards.
- **Decision:** No schema changes in any phase of this plan. **Rationale:** every identified fix is achievable against the existing two preference tables; the only tempting migration (per-tournament channels) solves a problem that is actually a mislabeled UI.
- **Decision:** Rules R1–R4 locked (default-ON never buried; no silent batch writes — tri-state + blast-radius caption; the two-sentence scope copy verbatim; capability/module filtering of visible rows). **Rationale:** direct answers to the judged fatal-flaws; R2 specifically prevents reintroducing the tournament-page bug class at rollup grain.
- **Decision:** Digest defaults stay push-ON; the fix is a first-class off switch, not a default flip. **Rationale:** reach is the digest's point (quiet weeks already send nothing); the compliance problem was the missing off switch, and `PUSH_DEFAULT_ON_EVENTS` stays authoritative (constraint 6).
- **Decision:** Dead event types come out of the settings UI (labels/union stay). **Rationale:** a settings page must not promise controls over notifications that cannot fire; reinstating a row when a trigger ships is one line.
- **Decision:** Chat preferences stay out of these pages (pointer only). **Rationale:** owner-locked chat-off-bell decision; chat's surface is the Chat tab.

## Open questions (owner decisions needed at sign-off)

- [ ] Approve the converged direction (Option C sequencing toward Option B's container) — or prefer pure per-shell (never build the container) / pure one-page (bells re-point to `/account/notifications` on day one)?
- [ ] Coach settings placement: sibling route `/coaches/notifications/settings` (recommended) vs a tab inside the existing feed page?
- [ ] Dead toggles: remove outright (recommended) vs keep with a "coming soon" tag?
- [ ] Confirm rule R2's mixed-state behavior: clicking a mixed rollup sets the whole group ON, with the "applies to N types" caption and the grid reflecting it immediately (recommended) vs a confirm dialog?
- [ ] Ticket the `notify()` recipient-scoping project now (recommended — it's a confirmed over-notification, just not this project's build)?
- [ ] Phase 3 timing: at Unified App Phase 2 kickoff (recommended) vs immediately after Phase 2 here?
- [ ] Assistant lifecycle bells on the coach page: show as informational non-toggleable rows, or stay fully hidden as today (recommended: hidden — surfacing previously-invisible lifecycle events is a product change, not a settings fix)?
- [ ] Confirm the guardian-email CASL parking: acceptable at current volume to defer per-person email opt-out to its own project (recommended, with the narrow unsubscribe-bug fix still landing in Phase 2), or does compliance exposure warrant expediting it ahead of Phases 1–3?

## Success criteria

- A rep coach (head or assistant) can turn the weekly digest off in ≤ 3 taps from their own shell, on the default view, without help docs.
- Every persona in §1.4 with a checkmark-able gap has a reachable surface (coaches incl. standalone; basic coach by Phase 2), and no persona sees a toggle for a notification they cannot receive.
- The tournament settings page never implies a channel change is tournament-scoped when it is org-wide.
- No new preference schema; no change to `PUSH_DEFAULT_ON_EVENTS`; Unified App Phase 2 lands its fan card into Phase 3's container without reworking it.
- Zero settings rows for events that never fire.
