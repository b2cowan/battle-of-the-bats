# Tournament Chat — Phase 3: Conversational Depth (WhatsApp parity)

**Status:** PLANNED (not started). **Phase 3 of the Tournament Chat UX project** (`TOURNAMENT_CHAT_UX_REVIEW.md` — Phase 1 shipped, Phase 2 = visual polish). This phase adds the *conversational* features that make a group chat feel modern, benchmarked against WhatsApp group chat.
**PM brief:** `TOURNAMENT_CHAT_PHASE3_CONVERSATIONAL_DEPTH_PM_BRIEF.md`
**Scope guard (owner, 2026-06-22):** **infrastructure-heavy items are OUT of scope** for this project — no file/photo/GIF attachments, no voice messages, no calls/stories, no real profile photos (coloured initials stand in). Those stay a separate future track.
**Origin:** owner benchmarked our chat against WhatsApp and asked what's doable + LOE. Estimates below were produced by a feasibility pass that read the **actual** chat engine (schema, write-permission grants, realtime publication, notification system) — not assumptions.

**LOCKED SCOPE (owner, 2026-06-22):** Build **all of Tier 1** + **Emoji reactions** + **real Polls** (not the pseudo-poll). **Online presence is dropped.** **Edit-your-own-message** was not selected — leave optional, build only on explicit request. Reactions/polls each carry a migration + a short spike (owner approved spikes). Net committed set = Tier 1 (7) + reactions + polls = **9 features.**

---

## 1. Engine reality the implementer must respect (why some items are S and some are L)

The chat engine (migration 141) is deliberately locked down; these constraints shape every estimate:

1. **All writes go through a server route.** The chat tables are column-scoped: browsers cannot write them directly. Every new write (reaction, edit, mention, pin, vote, read-mark) needs a new/extended server route running as service-role, which enforces membership/mute/window/rate-limit. RLS alone can't enforce time-windows or identity for these.
2. **Live updates ride `chat_messages` or a newly-published table.** Realtime is published on `chat_messages` (INSERT/UPDATE, REPLICA IDENTITY FULL) only. A feature can ride a `chat_messages` UPDATE (cheap, the client already handles it) OR needs a **new table added to the realtime publication** (the costly path — set REPLICA IDENTITY first, then publish; re-validate RLS isn't a silent no-op, the lesson from the engine build).
3. **`metadata` (jsonb) is already INSERT-grant-covered.** Reply snippets and @mention lists can ride `metadata` with **no migration**.
4. **Read state = a per-member `last_read_at` watermark** (drives "last seen" + unread). There is no per-message read tracking today; the cheap "read by N" aggregate reuses the watermark, true per-message receipts need a new published table.
5. **Soft-delete already exists and propagates live** — edit/delete-own reuse this path.
6. **`notify()` fans out bell + push** to active members except the sender — @mentions reuse it for a targeted ping.

---

## 2. Feature tiers (engine-grounded LOE)

LOE: **S** ≈ 1–2d · **M** ≈ 3–5d · **L** ≈ 1–2wk+ (each includes the `/review` gate). "Mig" = needs a DB migration. "Spike" = a short feasibility prototype recommended before committing the estimate.

### Tier 1 — Recommended core (best premium-feel per effort; only ONE migration in the whole tier)

| Feature | What the user gets | LOE | Mig | Spike | Fit |
|---|---|---|---|---|---|
| **Pinned messages** | Organizer pins the schedule / field map / rule clarification to a persistent banner at the top of the room | M (3–5d) | **Yes** | — | ⭐ Highest game-day value — coaches open chat expecting to see the schedule |
| **Reply / quote a message** | Answer a specific message in a busy group; quoted snippet shown, tap to jump to the original | M (3–5d) | No¹ | — | ⭐ Biggest "feels like a real chat" lift |
| **@mentions** | Type "@", pick a coach; they're highlighted and get a **targeted** push even if general chat notifications are off | M (3–5d) | No | — | ⭐ Strong for 20–40-coach rooms — surface an action item to one team without spamming all |
| **Emoji picker button** | One-tap emoji grid in the composer (typed emoji already work via the OS keyboard) | S (2–3d) | No | — | High return, lowest risk |
| **Delete your own message** | Remove your own post (wrong room, sensitive info, typo) — shows "Message removed" like a moderator delete | S (2–3d) | No | — | WhatsApp baseline; its absence is friction |
| **In-conversation search** | Filter the room to messages matching a keyword | S (2–3d) | No² | — | High for organizers hunting a buried update |
| **"Read by N" + "last seen"** | Sender sees "✓ read by 4 of 11"; organizer roster shows each coach's last-seen | S (2–3d) | No | — | Reassurance that a message landed, cheaply (reuses the watermark) |

¹ Reply rides the existing `metadata` field → **no migration** for V1; a typed column is a nice-to-have later.
² Search V1 filters the loaded window (label it "searching recent messages"); a "search all" server route is an easy V2.

**Tier 1 total ≈ 17–27 working days (~3.5–5.5 weeks), each item independently shippable. Only "Pinned messages" needs a migration.** This bundle delivers ~80% of the WhatsApp "feel."

### Tier 2 — Optional / heavier (pick by appetite)

| Feature | What the user gets | LOE | Mig | Spike | Fit / caution |
|---|---|---|---|---|---|
| **Edit your own message** | Fix a typo / update a venue or time within ~15 min; shows an "edited" label | M (3–5d) | **Yes** | — | Useful, but widens the write-permission surface — `/review` must scrutinise the access rule; keep the "edited" label + time window |
| **Emoji reactions** | Tap 👍 / ❤️ / ✅ on a message with a count + who reacted — a quiet ack instead of 40 "ok"s | L (6–9d) | **Yes** | **Yes** | High value in big groups, but needs a new live-published table + careful access proof; use a fixed 6–8 emoji set (no full picker) |
| **Online presence ("green dot")** | A live "online now" dot beside members | M (3–5d) | No | **Yes** | Moderate value; **"last seen" ships nearly free** with the read-by item — defer the live green dot |

### Deferred beyond Phase 3 (low value-for-effort for this audience)

- **Typing indicator** — technically small, but near-zero value for *async* tournament coordination (coaches check in between games, not in real-time back-and-forth). Revisit if/when real-time coach↔parent chat ships.
- **Polls** ("which reschedule time works?") — L (7–10d) and niche; a **pseudo-poll** (organizer lists A/B/C, coaches reply, organizer eyeballs the tally) covers most real needs at zero cost. Build the real thing only if reschedule-voting becomes a proven pain.
- **True per-message "seen by [names]" list** — L (8–12d), and a poor fit for 20–40-coach rooms (the list is noise; the "read by N" aggregate covers the organizer's actual need). Defer real per-message receipts to **In-Org Coach Chat** (smaller, persistent staff groups, where it pays off).

---

## 3. Recommended sequence

1. **3A — No-migration quick wins (≈1.5–2 wk):** Emoji button → Delete-own → Search → Read-by/last-seen. Fast, low-risk, immediately felt, zero schema change.
2. **3B — The conversational lift (≈2–2.5 wk):** Reply/quote → @mentions → **Pinned messages** (the one migration). This is the headline "feels like WhatsApp + organizer power" wave.
3. **3C — Optional second wave (by appetite):** Edit-own (migration) → Emoji reactions (migration + spike) → live presence (spike).

Migrations batch sensibly: **Pinned** alone for the core; **Edit** + **Reactions** would each add their own (sequence them so each ships behind `/review`). Per repo rules, migrations are dev-only until release and applied to prod manually at deploy.

---

## 4. Decisions for the owner

1. **Tier 1 scope:** all seven, or trim (e.g. drop search or read-by for now)?
2. **Reactions:** commit the L-effort real reactions, or hold and lean on the emoji button + replies first? (Recommend: ship Tier 1, then decide reactions with real usage in hand.)
3. **Edit window:** 15 minutes the right correction window, and is the "edited" label acceptable (needed for moderation trust)?
4. **Polls:** accept the zero-cost pseudo-poll for now (recommended), or queue the real build?
5. **Spikes:** OK to run a short feasibility spike before committing the estimate on reactions / presence (the two flagged)?

## 5. Verification & guardrails (per build)

- Each feature ships behind the adversarial `/review` gate; the **write-permission expansion** items (edit, reactions, pinned) get extra scrutiny on the access rule.
- Any new live-published table re-runs the engine proving-slice equivalent (the "silent no-op" realtime risk).
- `npm run typecheck` on shared-module changes; focused lint; owner does browser testing.
- Schema changes update the data dictionary + snapshots (repo rule).
