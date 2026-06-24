# Tournament Chat — Phase 3: Conversational Depth — PM Brief

**Status:** Approved & in build (owner go-ahead 2026-06-22). Phase 3 of the Tournament Chat UX project (Phase 1 shipped; Phase 2 = visual polish).
**Companion plan:** `TOURNAMENT_CHAT_PHASE3_CONVERSATIONAL_DEPTH_PLAN.md`
**One-liner:** Close the gap to the chat apps coaches already use (WhatsApp) by adding the conversational features that make a group chat feel alive — without the heavy file/voice infrastructure.
**Committed set (9):** the 7 core features below **+ emoji reactions + real polls**. Online presence ("green dot") is dropped; editing your own message is held unless explicitly requested.

## What this is
Phase 1 made our chat *look* like a modern messenger. Phase 3 makes it *behave* like one. Benchmarked against WhatsApp group chat, we picked the features that matter for organizers and coaches and confirmed each one is achievable on our current foundation. **File/photo sharing, voice notes, and calls are deliberately out of scope** for this project (a separate future track) — the good news is that none of the high-impact conversational features need them.

## What the customer will be able to do
**The core set (recommended first):**
- **Pin the important stuff.** The organizer pins the schedule, field map, or a rule note to a banner at the top of the room, so coaches always see it instead of scrolling for it. *(Biggest game-day win.)*
- **Reply to a specific message.** Answer one message in a busy group with the original quoted above your reply — tap it to jump back to context.
- **@mention a coach.** Call out one coach by name; they get a direct notification even if they've muted general chatter — without pinging the whole room.
- **React/emoji faster.** A one-tap emoji button in the message box (typing emoji already works today).
- **Delete your own message.** Remove something you sent to the wrong room or that had sensitive info.
- **Search the conversation.** Find a past message by keyword instead of scrolling.
- **See that it landed.** A "read by 4 of 11" count and per-coach "last seen" so the organizer knows the message got through.

**Richer interactions (committed, prove-it-first):**
- **Emoji reactions.** Tap 👍 👎 ❤️ ✅ 😂 🎉 🙏 on a message with a live count, instead of 40 coaches each typing "ok." A fixed reaction set, not a full picker.
- **Real polls.** A structured vote ("which reschedule time works?") with a live tally — replaces the old "reply with A/B/C" workaround.
- *Each needs a quick feasibility check before the full build (the only two heavier items — which is why they ship last).*

**Dropped / held:** live "online now" dot is **dropped** ("last seen" covers the real need). Editing your own message is **held** — built only if you ask for it.

**Deliberately deferred** (low payoff for our audience): typing indicators and a full per-message "seen by [names]" list (the "read by N" count covers the organizer's real need).

## Who it's for
Tournament organizers (Tournament Plus) and all their coaches — the same audience as today's chat. The pinned-message and @mention features especially help organizers run a clean game day with 20–40 coaches in one room.

## Why it matters
Chat is a visible, sticky reason to be on Tournament Plus. The closer it feels to the apps coaches use daily, the more they'll actually run their tournament communication in-app instead of scattered group texts — and the more credible the whole platform feels.

## Effort & sequencing
Delivered in three waves, each an independently shippable piece behind the review gate:
- **3A — Quick wins (~1.5–2 weeks):** emoji button → delete-own → search → read-by/last-seen. Zero behind-the-scenes data changes; immediately felt.
- **3B — The conversational lift (~2–2.5 weeks):** reply/quote → @mentions → pinned messages. **Pinned is the only feature here that needs a small data change.**
- **3C — Richer interactions (by appetite):** emoji reactions, then real polls. Each needs **one new data store plus a quick feasibility check first** — these are the heavier items.

## Trade-offs made
- We're matching the *conversational* feel, not every WhatsApp capability — file/voice/calls are out, and a full per-message "seen by [names]" list is deferred (the "read by N" count covers the real need at a fraction of the cost).
- **Search ships shallow first:** V1 searches the messages already loaded in the room (labelled "recent messages"); a deeper "search the whole history" version is a fast-follow.
- **Reactions use a fixed emoji set** (not a full picker) — cheaper live-count plumbing and a cleaner quick-ack UX.
- Estimates are grounded in our actual system, so three features carry a behind-the-scenes data change with extra security review — **flagged above: pinned (3B), reactions (3C), polls (3C).** Everything else reuses existing rails.

## Decisions made (owner, 2026-06-22)
1. **Scope approved** — all 7 core features **+ reactions + polls** (9 total). Build order: 3A → 3B → 3C.
2. **No new paywalls inside chat** — the whole surface stays Tournament Plus; every coach in a room gets all 9. Organizer-only powers: pinning + moderation.
3. **Search** — ship "recent messages" first; full-history search is a fast-follow.
4. **Reactions & polls** — run a short feasibility check first, then build both.
5. **Reaction set** — 👍 👎 ❤️ ✅ 😂 🎉 🙏.
6. **Online presence dropped; edit-your-own held** unless explicitly requested.

## Success criteria
- Organizers run game-day coordination in-app: pinned schedule, @mentioned coaches respond, fewer "did everyone see this?" follow-ups.
- The chat reads and behaves like a modern group messenger on phone and desktop, with the engine and access rules intact.
