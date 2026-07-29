# Follow Ownership & Session Partition

**Status:** PLANNED — Phase 1 (seeded-pin sign-out sweep) already applied on dev. Phases 2–4 not started.
**Owner decisions ratified:** 2026-07-21 — (1) signed-in surfaces show ONLY the account's follows; anonymous device follows are parked/hidden for the session; (2) sign-out must not leave any follow that exists on the device *because of* a session.
**Migration:** none expected (all behavior lives in the client follow layer + existing `fan_follows`).
**Related:** [[project_unified_home_redesign]] Phase 6 (follow whole tournaments/orgs), [[project_free_app_conversion]] (seeded-pin model + sign-out hygiene), [[reference_coaches_org_context_seeding]] (N2 account-follow hydration).

---

## Problem

Device-local follows (the "follow a team without an account" feature) live in browser `localStorage` and currently carry **no record of who they belong to**. That produces two related defects:

1. **Sign-out leak.** A follow that only exists on the device because someone signed in — an account-seeded "my team" pin, OR a team the person tapped Follow *while signed in* — survives sign-out. The next person on that device (or the same device, signed out) inherits it. Phase 1 swept the *seeded* subset only; the "tapped-while-signed-in" subset still leaks because it is indistinguishable from a genuinely anonymous follow.

2. **Cross-account bleed while signed in.** On tournament pages, the "My Team" pin, the highlighted standings row, and Follow-button state read the device's `localStorage` follows regardless of who is signed in. So an anonymous device pin masks the signed-in user's own account follow: fan B signs into their account on fan A's device and sees fan A's pinned team, not their own. (The Scores tab is already account-only when signed in, so this bleed is specific to the tournament-page pin surfaces.)

Owner framing: *"we don't want someone's follows to persist on a device simply because they logged in and out"* and *"if I follow 10 teams and my mom logs into her account that follows 1, she shouldn't see 11."*

## Model — a follow is owned by either the device or the account

Tag every device follow with its **origin** at write time:

- **`anonymous`** — created with no session. The genuine no-account feature. Belongs to the device; persists across sign-out; parked while someone else is signed in.
- **`account`** — exists on the device because of a session: auto-seeded pins AND follows tapped while signed in (which are also mirrored into `fan_follows`). Belongs to the account; the account already holds the durable copy.

State machine:

| Moment | Behavior |
|---|---|
| **Follow while signed out** | Save `origin: 'anonymous'`. |
| **Follow while signed in** | Save `origin: 'account'` + mirror to `fan_follows` (unchanged). |
| **Sign in** | Hydrate account follows as `origin: 'account'` pins (existing N2 flow). **Park** anonymous device follows — hidden + inert on every surface for the session. Unclaimed anonymous follows remain available to the existing one-tap "add these teams to your account" claim. |
| **While signed in** | Every surface (Scores, Home, tournament pins, standings highlight, Follow buttons) reflects **account follows only**. |
| **Sign out** | Clear every `origin: 'account'` device follow (teams, tournaments, orgs). **Un-park** anonymous follows — device returns to its pre-session anonymous state. |

Nothing is ever destroyed by parking: account-origin follows live in `fan_follows` and re-seed on next sign-in; anonymous follows are restored on sign-out. This respects the locked *"device→account claim stays explicit"* decision — parking hides, it never silently merges anonymous follows into an account.

---

## Phases

### Phase 1 — Seeded-pin sign-out sweep ✅ APPLIED (dev, uncommitted)
- `clearAllSeededTeamPins()` in `lib/follow.ts` iterates `fl_follow_team_*`, removes `seeded === true`, invalidates the account-sync generation, dispatches `fl-follow-change`.
- Called from `signOut()` in `lib/auth.ts` (covers every shell, not just a mounted tournament page).
- Note: introduces a call-time-only `auth ↔ follow` import cycle (both reference each other only inside function bodies) — compiles clean, verified.
- **Gap it leaves:** only `seeded` pins; not tapped-while-signed-in follows; not tournament/org follows.

### Phase 2 — Provenance tagging + generalized account-owned sweep ✅ APPLIED (dev, uncommitted)
- `FollowOrigin = 'anonymous' | 'account'` added; `origin` stamped on the stored shape for **all three** follow types (`fl_follow_team_*`, `fl_follow_tourn_*`, `fl_follow_org_*`). Seeded pins are `account`.
- Origin resolved synchronously from a module-level `sessionSignedInHint` (no async/network hop in the write path), kept fresh by a self-subscribing `onAuthStateChange` watcher installed once in `lib/follow.ts` (mirrors `ensureAuthWatcher` in `lib/fan-alert-prefs-client.ts`). `null` (unknown) → `anonymous` (safe default; never over-clears).
- Sweep generalized: `clearAllAccountOwnedFollows()` removes every `origin === 'account'` (plus legacy `seeded: true`) entry across teams, tournaments, AND orgs. `seeded` retained as a separate axis for pin reconciliation.
- **Legacy/back-compat:** untagged entries default to `anonymous` (not nuked). Legacy `seeded: true` pins still swept. Only un-swept legacy case: a follow tapped while signed in *before* this shipped — small, self-healing on next re-follow.

### Phase 3 — Session partition on the team-pin surfaces ✅ APPLIED (dev, uncommitted)
- While signed in, an anonymous device team pin is **parked** (moved to a distinct `fl_parked_team_*` key) so the account's own follow occupies the single "my team" slot. Every pin surface (dock, standings highlight, teams sort) keeps reading the primary key unchanged — zero surface re-plumbing — and lights up with the account's team, not the device owner's.
- Restore is two-path: `restoreAllParkedFollows()` (global, off the sign-out event) + `restoreParkedPin()` (per-tournament self-heal in `syncAccountFollowsToDevice`'s signed-out branch / later anonymous visit). The device returns to its pre-session anonymous set.
- Tournament/org follows are NOT parked — confirmed correct: their signed-in display (`FollowingList`) already switches wholesale to server-computed account data, so only the team pin (which reads localStorage directly) needed storage-level partition.

### Architecture note (post-`/simplify`)
- Hygiene runs off a single self-subscribed `onAuthStateChange` watcher in `lib/follow.ts`: any no-session state (`SIGNED_OUT` or a signed-out `INITIAL_SESSION` on load) → clear account-owned + restore parked. `lib/auth.ts#signOut()` stays a thin Supabase wrapper (no import from the follow layer; no cycle). Self-heals on any signed-out load.
- Shared helpers: `collectStorageKeys` (one guarded scan) + `restoreParkedByKey` (one restore rule).
- Static checks green (lint + typecheck). `/simplify` DONE.

### `/review` — DONE (high-risk tier, deterministic gate green, 4 lenses: correctness / concurrency / regression / key-collision)
- **Cleared:** key-prefix collision (`fl_parked_team_` vs `fl_follow_team_` — no overlap), park↔restore key round-trip, sign-out-vs-navigation timing (traced supabase-js: the sync watcher completes inside `signOut()`'s `await Promise.all(subscribers)`, before navigation), the removed import cycle, reconcile cases (a)-(e), the stale-generation guard, and double-handling between the global watcher and per-tournament `AccountFollowSync`.
- **Fixed (confirmed data-loss guards):** `parkAnonymousPin` no longer overwrites an already-parked pin; `restoreParkedByKey` checks the primary slot is free *before* deleting the parked value. Closes a silent loss of a device-only anonymous follow under reload-while-signed-in / two-tab sign-out sequences.
- **Known limitation (accepted, documented in code + here):** the auth watcher's first event resolves async, so a follow tapped in the brief post-load window by a signed-in user is tagged `anonymous` and survives the sign-out sweep — a *narrow* shared-device leak of at most one follow. Every fix considered was worse (stale-token prime → permanent loss; account-list re-tag → sweeps genuine anonymous follows), and the account layer stays correct via the fan_follows mirror. Left as `null → anonymous` (prefer a narrow leak over any data loss). Residual future work if it ever bites: shrink the window / a safe synchronous session signal.
- Static checks green after fixes. **Not yet:** owner browser test.

### Phase 3 — Session partition on tournament pin surfaces
- While a session is active, the tournament-page pin/highlight/Follow-button layer must **ignore anonymous device follows** and derive pinned/followed state from the account set only.
- Mechanism: when signed in, the "effective device pin" for a tournament is the account-seeded pin (origin `account`), never an anonymous pin. Park anonymous entries (namespaced or filtered) for the session; restore on sign-out.
- Surfaces to audit: My-Team dock, standings highlight row, Teams-tab sort/highlight, every `FollowAlertsToggle` / Follow button reading `useFollowedTeam` / `useAllFollowedTeams` / `useAccountFollowedTeamIds`.
- Confirm Scores/Home already partition correctly (signed-in GET = account union) and add a regression note if any consumer reads device follows while signed in.

### Phase 4 — Verification + QA matrix
- Playwright/manual matrix across the edge cases below (read computed state / storage directly per [[feedback_verify_with_playwright_not_screenshots]]).
- `/docs` sync if any user-facing follow copy changes (likely none — behavior, not UI).
- `/simplify` then `/review` (new shared-module logic in the follow layer).

---

## Edge cases (acceptance)

1. **Shared device, two accounts** — A signs in (A's teams seed), signs out (all account-origin cleared), B signs in (B's teams seed). No cross-contamination. ✓
2. **Solo device, all follows tapped while signed in** — cleared on sign-out, fully restored on sign-in from `fan_follows`. Momentary blank while actively signed out, by design. ✓
3. **True anonymous follower, never signs in** — follows persist forever. ✓
4. **Anonymous follower who later makes an account** — anonymous follows parked during the session; existing one-tap claim upgrades them to `account` deliberately. No silent merge. ✓
5. **Anonymous pin + signed-in account follow, same tournament** — signed-in view shows the *account's* team, not the anonymous pin (Phase 3). ✓
6. **Legacy untagged follows on real devices** — treated as anonymous; not nuked. ✓
7. **Cross-tab** — a sign-out sweep in one tab propagates via `storage` + `fl-follow-change`; parked/restored state stays consistent. ✓

## Non-goals
- No change to the explicit device→account claim flow (stays explicit; already shipped).
- No "clear ALL device follows on sign-out" (would destroy the anonymous-follow feature).
- No new migration or `fan_follows` schema change.

## Success criteria
- Signing out leaves zero follows that existed only because of the session (teams, tournaments, orgs).
- While signed in, every follow surface reflects the account only; anonymous device follows are invisible and inert.
- Signing back out restores exactly the pre-session anonymous follow set.
- Anonymous-only users are unaffected end to end.
