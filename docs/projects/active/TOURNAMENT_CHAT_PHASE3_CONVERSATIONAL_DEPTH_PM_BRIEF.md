# Tournament Chat — Phase 3: Conversational Depth — PM Brief

**Status:** Planned, pending owner go-ahead on scope. Phase 3 of the Tournament Chat UX project (Phase 1 shipped; Phase 2 = visual polish).
**Companion plan:** `TOURNAMENT_CHAT_PHASE3_CONVERSATIONAL_DEPTH_PLAN.md`
**One-liner:** Close the gap to the chat apps coaches already use (WhatsApp) by adding the conversational features that make a group chat feel alive — without the heavy file/voice infrastructure.

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

**Optional second wave (by appetite):** edit your own message within a short window; tap-to-react emoji reactions with counts; a live "online now" dot.

**Deliberately deferred** (low payoff for our audience): typing indicators, built-in polls (a simple "reply with A/B/C" covers it for now), and a full per-message "seen by [names]" list.

## Who it's for
Tournament organizers (Tournament Plus) and all their coaches — the same audience as today's chat. The pinned-message and @mention features especially help organizers run a clean game day with 20–40 coaches in one room.

## Why it matters
Chat is a visible, sticky reason to be on Tournament Plus. The closer it feels to the apps coaches use daily, the more they'll actually run their tournament communication in-app instead of scattered group texts — and the more credible the whole platform feels.

## Effort & sequencing
- **Core set: ~3.5–5.5 weeks**, delivered as independently shippable pieces, with only one needing a behind-the-scenes data change. Roughly: a ~2-week wave of fast, low-risk wins (emoji button, delete-own, search, read-by), then a ~2–2.5-week wave for the higher-impact items (reply, @mentions, pinned).
- **Optional second wave** (edit, reactions, live presence) added only if you want them; reactions are the most effort and we'd validate with a quick spike first.

## Trade-offs made
- We're matching the *conversational* feel, not every WhatsApp capability — file/voice/calls are out, and full per-message read receipts are deferred (the "read by N" count covers the real need at a fraction of the cost).
- Estimates are grounded in our actual system, so a few features carry a small data-model change and extra security review; those are flagged.

## Decisions needed from the owner
1. Approve the **core set** (all seven) or trim it?
2. **Reactions** now, or ship the core first and decide reactions with real usage in hand? *(Recommend the latter.)*
3. Accept the **zero-cost pseudo-poll** for now instead of building real polls? *(Recommended.)*
4. OK to run **short feasibility spikes** on reactions / live presence before locking their estimates?

## Success criteria
- Organizers run game-day coordination in-app: pinned schedule, @mentioned coaches respond, fewer "did everyone see this?" follow-ups.
- The chat reads and behaves like a modern group messenger on phone and desktop, with the engine and access rules intact.
