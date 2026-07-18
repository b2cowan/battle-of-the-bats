# PM Brief — Unified Home Redesign (GameChanger-Style Front Door)

**Date:** 2026-07-18 · **Status:** Direction ratified, mockup rounds next · **Plan:** UNIFIED_HOME_IA_REDESIGN_PLAN.md

## What changes for users

The app's bottom nav becomes **Home · Scores · Chat · Account** — the same four tabs for everyone, signed in or not.

**Home** becomes the single front door, modeled on GameChanger. At the top, one search bar finds any Tournament, Team, or Organization on the platform. Below it, a card for everything you're part of: your admin/coach/official workspaces (with your role on the card — Owner, Coach, Official…) and everything you follow. Tapping a card drops you straight into that world. The separate Discover and Following tabs disappear — their content lives on Home now — and the old workspace-picker page folds in too. Old links keep working.

**How following shows up (owner-refined model):** following a team in a tournament is about *that tournament* — highlighted scores, notifications, your team's view of the event. So on Home it appears under a **Tournaments** section: the card is the tournament, with your team and its latest result/next game on it; tapping in shows your team's tournament experience. Later, a separate **Teams** section will carry a new, richer kind of follow — persistent teams with schedules and scores across events, and eventually parent chat (recommended foundation: the rep-team structure the coaches side already uses, pending owner confirmation). That future phase is explicitly gated on the family-privacy compliance review.

**Scores** answers "what's happening for everything I care about" without drowning: a compact strip on top rolls each followed tournament/league into one chip ("● 3 live", "12 today") that links into the event, while your own teams' games — including teams you coach, even if you never followed them — appear as full rows: live games pinned first, then grouped by day.

**Chat** joins the nav for everyone. Members (coaches/organizers) get something new and genuinely useful: one inbox of every chat room across all their teams and tournaments, with unread badges. Logged-out visitors and fans see a polished sample conversation and a pitch — never real messages; rooms stay member-only. A "report a message" button ships in the same release.

**Account** slims to a real settings page: profile, notifications, install-the-app, help, legal, sign out.

## Why it matters

- One mental model — search, find, follow, return — matching the category leader parents already know.
- Every user hat (fan, coach, organizer, official) gets one consistent front door; the app stops feeling like separate products stitched together.
- Chat's visibility markets the product's stickiest feature to every visitor without weakening its privacy posture.
- The tournament-first follow presentation keeps v1 honest about what a follow means today, while reserving a clean, richer "Teams" concept for later instead of shipping a confusing hybrid.

## Sign-in behavior (deliberate)

Single-workspace organizers still land straight in their workspace when they sign in — no new taps for the most common paying customer. But tapping Home always shows Home; it never bounces you away.

## Rollout shape

Mockup rounds first (owner approval per round), then phased build: nav + redirects → Home → search expansion → Scores → Chat → Account/polish. Fast-follow: following whole tournaments/organizations. Future, gated: persistent Teams + parent chat. A one-time "what's new" intro greets existing users after the nav change.

## Success criteria

Search usage and follow conversions from Home; card tap-through; Chat inbox adoption among coaches; no drop in organizer sign-in speed; no support spike about "where did my stuff go" (mitigated by the what's-new intro).

## Risks accepted / managed

Old links and already-sent emails keep working via permanent redirects; shared-device privacy protections (no personal data in cacheable pages) are carried forward from the earlier incident's fix pattern; per-tier admin routing is reused, not rebuilt. Full risk register in the plan.
