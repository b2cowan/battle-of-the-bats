# Kickoff Prompt — Build Tournament Chat Phase 3 (Conversational Depth)

> **How to use:** open a fresh chat in this repo and paste everything below the line. It is self-contained.

---

You are building **Phase 3 of the Tournament Chat project** — the WhatsApp-parity *conversational* features. The chat engine + all three surfaces + the full visual/UX overhaul (Phases 1–2) are **committed on `dev`** (commit `76c7ab4`). Your job is to add the features that make the group chat *behave* like a modern messenger.

## ⛔ BLOCKING — before you write ANY code

Per `AGENCY_RULES.md`, **write a Product-Manager UX brief and present it in the chat for the owner's approval BEFORE editing a single line of code.** Do not touch code until the owner approves the brief.

The brief must be **plain-language and owner-facing** (not engineering): for each feature, what the user sees and does; the build sequence; what's plan-gated; the few small behind-the-scenes data changes (flagged, not detailed); the tradeoffs; and your recommended order. If anything in scope is ambiguous, confirm it with the owner in the brief. Only after the owner says go do you start building.

## What's already decided (do not re-litigate)

- **Committed scope — 9 features.** Tier 1: **pinned messages, reply/quote a message, @mentions, an emoji-picker button, delete-your-own-message, in-conversation search, "read by N" / "last seen"** — PLUS **emoji reactions** and **real polls**.
- **Dropped:** online presence ("green dot").
- **Optional / unselected:** edit-your-own-message — build ONLY if the owner explicitly asks.
- **Out of scope (separate future track):** file/photo/GIF attachments, voice messages, calls, real profile photos, typing indicators, and a full per-message "seen by [names]" list.

## Read first (the plan is already written and engine-grounded)

- `docs/projects/active/TOURNAMENT_CHAT_PHASE3_CONVERSATIONAL_DEPTH_PLAN.md` — **your spec.** Feature tiers, engine-grounded LOE, build sequence, engine constraints, locked scope.
- `docs/projects/active/TOURNAMENT_CHAT_PHASE3_CONVERSATIONAL_DEPTH_PM_BRIEF.md` — the owner-facing brief you extend.
- `docs/projects/active/TOURNAMENT_CHAT_UX_REVIEW.md` — what Phases 1–2 delivered (the styling/structure you build on; note the binding desktop design decision).
- `docs/projects/active/COACH_CHAT_PLATFORM_PLAN.md` §2 — the canonical engine spec.
- The **Chat** domain in `docs/agents/db/DATA_DICTIONARY.md`.

## The engine you're extending (respect these — they shaped the estimates)

The chat engine (migration `141_chat_foundation.sql`) is deliberately locked down:
1. **All writes go through a server route** (service-role). The chat tables are **column-scoped** — browsers cannot write them directly. Every new write (reaction, pin, vote, mention, delete-own) needs a new/extended server route that enforces membership / mute / window / rate-limit. RLS alone can't enforce time-windows or identity for these.
2. **Live updates** either ride a `chat_messages` UPDATE (cheap — the client already handles it) OR need a **new table added to the realtime publication** (set `REPLICA IDENTITY FULL` *first*, then `ALTER PUBLICATION`; then re-validate RLS isn't a silent no-op — the proving-slice lesson).
3. **`metadata` (jsonb) is already INSERT-grant-covered** — reply snippets and @mention lists ride it with **no migration**.
4. **Read state = a per-member `last_read_at` watermark** (drives "last seen" + unread). There is no per-message read tracking — "read by N" reuses the watermark cheaply.
5. **Soft-delete already exists and propagates live** — delete-your-own reuses it.
6. **`notify()` fans out bell + push** to active members except the sender — @mentions reuse it for a targeted ping.

## Recommended build sequence (confirm/adjust in your PM brief)

1. **3A — no-migration quick wins:** emoji-picker button → delete-own → in-conversation search → "read by N" / "last seen".
2. **3B — conversational lift:** reply/quote → @mentions → **pinned messages** (one migration).
3. **3C — heavier (owner pre-approved a short feasibility spike first):** emoji reactions (new realtime-published table) → real polls.

Each feature is independently shippable behind the `/review` gate.

## Guardrails (this repo is strict)

- **Branch = `dev`** (shared working copy — other agents may touch it). Stage **explicit pathspecs only**, never `git add -A`; run `git show --stat HEAD` after every commit to confirm only your files landed; **commit only when the owner asks**; never push `master` without an explicit deploy request.
- **Migrations are dev-only until release** (applied to prod manually at deploy). Any schema/field change MUST update `docs/agents/db/DATA_DICTIONARY.md` + refresh snapshots (`npm run refresh:snapshots`); `npm run check:dictionary` gates it. **Decide whether a column exists from the live snapshots, never from migration files.** Any NEW realtime-published table must pass its own RLS validation (extend `scripts/validate-chat-slice.mjs`; keep it green).
- **Reuse, don't reinvent:** build on the shared `components/chat/ChatPanel.tsx` and its load-history-then-stream + dedupe-by-id realtime pattern; reuse `lib/chat-service.ts` (post/notify/moderation), the participant resolvers, and the existing notification event.
- **Run `/review`** (the adversarial funnel) before calling each feature done — extra scrutiny on the write-permission expansions (pinned, reactions, polls, delete-own) and any new realtime table.
- `npm run typecheck` on shared-module / API / schema changes; `npm run lint:focused -- <files>`; the public-CSS token ratchet runs in `npm run verify:changed`. Prefer focused checks; run full sweeps only when warranted.
- **Design consistency:** keep new chat UI inside the binding 2026-06-22 design decision — the chat is a bounded full-height pane with a centered ~820px reading column on desktop; use design tokens (`var(--*)`), never literal hex in public CSS modules.
- **Owner does browser testing.** Give a crisp "what to click" per feature. **Dev caveat:** the PWA service worker caches static chunks cache-first, so in dev the owner should keep DevTools → Application → Service Workers → **"Update on reload"** ticked, or they'll see a stale screen after edits.
- **Restart the dev server** (stop → `rm -rf .next` → `npm run dev` → wait for Ready) after adding new files / shared-module / migration / config changes — batch and restart once near handoff. The server needs network access for Supabase; confirm `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returns 200 with no Supabase `EACCES`.
- Lead owner-facing messages in plain **product-owner language** (what they see/do), not file names.

## Deliverables

1. **A PM brief in chat for the owner's approval (blocking — no code before approval).**
2. After approval: each Phase-3 feature built, `/review`-passed, typecheck/lint clean, with a per-feature "what to click."
3. Keep the Phase 3 plan, `TODO.md`, and the data dictionary current; offer `/docs` whenever a user-facing flow or term changes.
