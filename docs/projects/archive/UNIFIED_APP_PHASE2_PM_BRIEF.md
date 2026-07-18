# PM / UX Brief — Unified App Phase 2: Fan accounts & follows

**Status:** Awaiting owner sign-off (the plan's per-phase pre-build gate). No code started.
**Decision cover:** Gate **G2 already ratified 2026-07-11** (fan push stays Tournament Plus; the follow UI must make the gate legible). No new business decisions are needed to build this.
**Mockups:** https://claude.ai/code/artifact/fb678e17-c8ef-44b0-bc52-ec17c74ab9fe
**Plan:** `UNIFIED_APP_CONSUMER_LAYER_PLAN.md` (Phase 2).

## In one paragraph
Today a fan's follow list lives only on the single device that tapped Follow — a parent with a phone and a laptop has two disconnected lists, and a new phone starts empty. Phase 2 adds a **free fan account, created at the moment of following** (one email field, no role questions, browsing never gated), so follows, live scores, and alerts follow the *person* across every device. The empty Following/Scores tabs become a real signed-in home; alerts become tunable per team; and the Account tab gets an identity. It is the first phase with a database change, and the first that makes the follow layer feel like an account layer.

## What each person sees differently
- **Fan / parent:** Tapping **Follow** now offers a one-field sign-up ("so your teams follow you on every device"). They can still choose **"Just follow on this device"** — the anonymous path never goes away. Once signed in, **Following** shows every team they follow across all events (live first, then upcoming, then recent), and they can set **All / Game-day only / Mute** per team. On a free-tier event the alert control honestly reads **"Alerts aren't offered by this event"** rather than a dead toggle. Right after sign-up, if the device already had follows, we offer to **claim them onto the account** (explicit, pre-checked list — never silent).
- **Coach / organizer:** No change to their world. A fan account is not a coach or an org membership, and the fan-push gate does not move. Organizers benefit indirectly: a legible "alerts on Tournament Plus" moment is now visible to fans as organizer value.
- **A signed-out visitor:** unchanged from Phase 1 — browse everything, follow on-device, see the sign-in/create-account Account tab.

## What will look different or (intentionally) not change
- **Different:** the Follow tap now sometimes shows an account sheet; the Following/Scores tabs show real cross-device data once signed in; the Account tab shows an identity; alert preferences exist per team.
- **Not changing:** browsing is never walled; the device-only follow path persists forever (two mechanisms, deliberately); no new roles; **no pricing or gate change** (fan push stays Tournament Plus); admin/coach/scorekeeper surfaces untouched.

## Prerequisites & guardrails (engineering-side, tracked here for transparency)
- **First database change in this project** — a `fan_follows` record of who-follows-what, service-role-only (same locked-down posture as our other membership tables). Comes with the data-dictionary + snapshot update in the same unit of work.
- **Push must be confirmed working on dev** before this leans on alerts (the known Android production push issue — resolve/verify first).
- **New signed-in surfaces** (`/following`, account/alert pages) get added to the offline-cache denylist in the same change — the standing rule that protects shared devices from cached personal content.
- **Fail-closed routing preserved** — a signed-in fan with no coach/org context lands on the Follows feed, never an operator picker, without weakening the org-context guarantees.
- **Reconciliation is always an explicit offer** — never auto-merge follows on a shared family device.

## How you'll test it (after build + deploy)
1. Follow a team while signed out → get the sign-up sheet → choose "Just follow on this device" → confirm it still works with no account.
2. Follow again → create an account with your email → confirm the "claim your device follows" offer appears and adds them.
3. On a **second device/browser**, sign in → confirm the same follow list and alert settings are there (the core cross-device win).
4. Set a team to Game-day only / Mute → confirm alert behavior matches.
5. Open a **free-tier** event's team → confirm the alert control reads "alerts aren't offered by this event," not a broken button.
6. Sign in as someone who also coaches → confirm the Account tab surfaces both the fan identity and the workspaces doorway.
7. Privacy check: confirm no signed-in content is cached to the shared offline store.

## Success criteria
- A three-tournament family has **one login and one follow list on every device**; follows survive a new phone.
- A zero-context signup lands on the **Follows feed**, never the operator picker.
- Free-tier events read as **"alerts not offered"**; Plus events deliver alerts — the gate reads as organizer value.
- The anonymous device-only follow path still works end-to-end for people who never make an account.
