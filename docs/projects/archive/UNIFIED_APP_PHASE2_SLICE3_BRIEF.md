# UX Brief — Phase 2, Slice 3: Alerts are what signing in gets you (REVISED, rev 3)

**Status:** proposed (revision 3) — owner-directed shape, for final sign-off before build. Final piece of Phase 2. Follows Slice 2 (the Following feed), built + committed 2026-07-14.
**Revision trail:** v1 = per-team All/Game-day/Mute controls in the feed (rejected: complicated, clunky). v2 = one global card on the unified notifications page, serving signed-in AND signed-out fans (rejected: two parallel settings stores — a fan could sign in, turn alerts off, and a hidden device-level setting could keep buzzing; owner caught this). **v3 (this brief) = owner decision 2026-07-14: score alerts require a signed-in account.** One store, one card, no hidden state.
**Visual reference:** https://claude.ai/code/artifact/0873b0fe-8557-499c-a1d9-2e0f934d7e36 — the signed-in card, the signed-out "sign in to get alerts" state, and the untouched feed.

## The one rule (the whole model)
> **Anyone can follow teams and watch live scores — no account. Alerts are what signing in gets you.**

## What changes for people
- **Signed in:** the Account → Notifications page (the same page admins and coaches already use) gains a **Followed teams** card — two switches covering *all* followed teams:
  - **Game alerts** — a push when one of your teams' games goes live, and the final when it ends.
  - **Event news** — announcements from the events your teams are in (rain delays, schedule changes).
  - Plus one honest line when any followed event doesn't offer alerts (free-tier events), naming it: *"Backyard Fall Ball doesn't offer alerts — following and live scores still work there."* This is where the logged G2 legibility commitment is satisfied.
- **Signed out:** no alert settings exist anywhere — nothing hidden, nothing to fall out of sync. Following, the live feed, and the Scores board all work exactly as today. Wherever alerts are pitched (the public page's alerts button, the Account tab), a signed-out fan sees one consistent line: **"Sign in to get score alerts"** — which opens the existing sign-in sheet from Slice 1.
- **The setting travels.** Turn Game alerts off on your phone, they're off on your tablet too — the preference belongs to the account, not the device. (Each device still asks its one-time "allow notifications?" permission — an operating-system rule, not a setting of ours.)
- **The Following feed stays exactly as shipped** — no controls added to rows.

## What this retires
- **Anonymous device-only alerts.** Today a fan can turn on score alerts with no account; that path closes for new opt-ins when this ships (existing anonymous opt-ins are effectively zero — no real fan-alert usage on prod). Anonymous *following* is untouched and permanent.
- The in-app help currently says "no fan account is required" for alerts — the help-docs sync at build time updates this (standing rule).
- **This is a positioning change worth logging** (it amends the shipped "alerts are tied to the device, no account" behavior): route through /strategy on sign-off.

## Why it matters
- **Zero ambiguity.** One settings store means the confusing scenario (invisible device settings continuing to fire while signed in) is structurally impossible, not just avoided.
- **A real reason to create an account.** "Get score alerts" is a far stronger sign-in hook than "keep your follows" — and account growth is what the whole consumer-layer strategy is building toward (family features, chat, retention).
- **A smaller build.** No signed-out settings page variant, no device-vs-account merge logic, no dual-path delivery to keep honest forever.

## Tradeoffs & notes (plain-language)
- **One extra step at the field.** A fan who wants alerts now signs in first (the follow-time sheet already exists and handles this in one screen). Following and live scores remain instant and account-free, so the "zero-friction fan" path survives — it just doesn't include push.
- **Global, not per-team.** Same position as rev 2: score alerts only fire when *your* teams actually play, so global switches cover the practical need. Per-team overrides and a "game-day only" level stay explicitly deferred until league-season volume (Phase 5) demands them.
- **Delivery wiring is now in scope.** With the anonymous path retired, routing alert delivery through account follows is part of this slice (it reuses the existing push machinery per device — invisible to users, but it's the bulk of the engineering here).
- No pricing or packaging change: alerts remain a Tournament Plus feature; the gate is unchanged, just legible.

## How you'll test it
1. Signed out: follow a team, open the feed — everything works; confirm the only alerts mention anywhere is "Sign in to get score alerts," and that tapping it opens the sign-in sheet.
2. Sign in, follow teams in two events (one Plus, one free): Account → Notifications shows the Followed teams card; the free event is named in the honest line.
3. Turn Game alerts on, allow notifications, have a game go live → push arrives; final arrives. Turn the switch off on a second signed-in device → no more pushes on either.
4. Confirm an admin-who-is-also-a-fan sees their org card and the Followed teams card on one page.

## Not in this slice
Per-team overrides / game-day-only (deferred, above). Phase 3 (one-home connective tissue) and beyond.
