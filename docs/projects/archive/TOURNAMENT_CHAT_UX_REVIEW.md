# Tournament Chat — UX & Design Review + Refinement Plan

**Status:** REVIEW COMPLETE + **PHASE 1 BUILT on `dev`** (2026-06-22, uncommitted; owner browser-test pending). Owner forks locked: **one shared dark style** (token-correct) · **coloured initials now** · **read state = "last seen" + new-messages divider, no per-message receipts** · **Phase 1 first**. Phase 1 diff was adversarially self-reviewed (0 blockers; 7 minor issues found + all fixed); typecheck + focused lint clean. Phases 2–3 await go-ahead. Presentational/UX refinement only — engine, access rules, resolver logic, realtime load-then-stream handling, and column-scoped write grants were **not changed.**
**Companion:** `TOURNAMENT_CHAT_UX_REVIEW_PM_BRIEF.md` · **Reviews the feature shipped in:** `TOURNAMENT_CHAT_PLAN.md` §8–9.

## How this review was produced

12 design dimensions reviewed in parallel against the *actual current code* (not the kickoff description), each benchmarked against a named chat app (iMessage / WhatsApp / Slack / Discord). Every raw finding was then **adversarially verified** against the code and against the engine-invariant guardrail (presentational-only, no engine/API/auth/schema changes). **90 findings survived verification** (7 blocker, 35 high, 29 medium, 19 low; only **2** require a backend change and are deferred). They are consolidated below into 12 themed workstreams (A–L), de-duplicated, with the surfaces/breakpoints they hit.

**Surfaces:** **Organizer tab** (`app/[orgSlug]/admin/tournaments/chat`) · **Org-less coach portal** (`app/coaches/team/[basicTeamId]/chat`, the dominant tournament-coach audience) · **Org-based league/club coach portal** (`app/[orgSlug]/coaches/teams/[teamId]/chat`). All three render the shared `ChatPanel`; the two coach surfaces also share `CoachChatView`; the organizer adds `ChatManagePanel`.

---

## Severity legend
- **Blocker** — broken/unusable or invisible on a real device/mode.
- **High** — clearly sub-par vs. the chat apps people know; every user sees it.
- **Medium** — noticeable polish gap.
- **Low** — refinement / nice-to-have.

---

## A. Light-mode & token correctness — **BLOCKER** (cross-cutting, all surfaces)

The conversation is built with raw `rgba(255,255,255,…)` and `rgba(0,0,0,…)` literals that **do not invert** in light mode. In light mode the "theirs" bubble loses its background and border, the composer textarea goes invisible, and the header/composer bars darken wrongly. The chat surfaces inherit the app's light/dark setting from their layout wrapper, so this is a real, shippable defect — not hypothetical.

| Element | Now | Fix (tokens verified to exist + invert) |
|---|---|---|
| `.bubble` bg / border | `rgba(255,255,255,0.06)` / `0.08` | `var(--white-8)` / `var(--white-10)` |
| `.bubbleMine` | `rgba(logic-lime-rgb,0.14)` / `0.3` (near-invisible) | raise to `0.22` / `0.45` for a clear ownership signal (lime stays lime in both modes) |
| `.input` bg / border | `rgba(255,255,255,0.05)` / `0.12` | `var(--white-5)` / `var(--white-10)` |
| `.header` / `.composer` / `.closed` bars | `rgba(0,0,0,0.15)` / `0.2` | `var(--bg-inset)` (= 0.2 dark / 0.04 light) |
| `.sender` label | `var(--blueprint-blue)` `#1E3A8A` (navy on near-black — **fails AA in dark mode**) | per-sender colour (see C); fallback `var(--info)` |
| `CoachChatView` `.backBtn`, `.roTag` | white-alpha literals | `var(--white-5)` / `var(--white-10)` |
| magic radii (`.panel` 10px) | off-system | `var(--radius-md)` / `var(--radius)` |

> The `check-public-tokens` ratchet does **not** scan `components/chat/*` or the chat surfaces, so this won't fail CI — but light-mode + per-org theming correctness still require it. (Findings 2, 12, 13, 14, 15, 47.)

---

## B. "Doesn't feel like a chat app" — message grouping & dividers — **HIGH** (cross-cutting)

The single biggest gap. Today **every** message repeats the sender name and a timestamp on its own line, with a flat uniform gap and uniform 12px corners — it reads like a log, not a conversation.

1. **Group consecutive same-sender messages** (iMessage/WhatsApp): show the sender name **once** at the top of a run; suppress it on continuation bubbles; tighten intra-run spacing and widen the gap at sender transitions; shape run-position corners (first/mid/last/solo).
2. **Suppress repeated timestamps:** show the time at the **end of a run** or when the gap exceeds ~5 min — not on every bubble.
3. **Date dividers** (none today): centered "Today / Yesterday / Sat, Jun 21" pills; remove the inline date-prefix from `timeLabel` so dates live only in dividers.
4. **"New messages" divider** on re-entry into an active room (snapshot at load; see also E/I). (Findings 20–23, 52, 53, 57, 67, 75, 76, 78.)

---

## C. Sender identity — **HIGH** (cross-cutting)

No avatars, no per-sender colour; all other-sender names render in one flat (and dark-mode-invisible) navy.

1. **Initials avatar + per-sender colour** for other-sender messages (deterministic hue from `senderUserId`); suppress on continuation rows so columns stay aligned. WhatsApp-group pattern.
2. **Per-sender name colour** replaces the flat navy (fixes the contrast blocker in A).
3. **Better name fallback:** a realtime message whose sender isn't yet in the participants map currently shows "Coach"; show a transient placeholder until the name hydrates, and reserve "Coach" for genuinely anonymous senders.
4. **Cleaner display name:** the email local-part fallback (`jsmith42`) is exposed as a name — title-case/sanitise it. (One-function change in the display-name hydrator; no schema/API/auth change.)
5. **Initials in the manage-panel roster and the room-list rows** for fast scanning. (Findings 14, 24, 25, 55, 56, 80, 84.)

---

## D. Composer ergonomics — **BLOCKER / HIGH** (cross-cutting)

1. **Autosize textarea — BLOCKER:** it's locked at `rows=1` with no growth; multi-line drafts scroll *inside* a one-line box and the text you typed is invisible. Grow to content up to a clamp.
2. **Send button 44×44 tap target — HIGH** (currently ~24px; below the iOS minimum) and **disabled-state styling** (today empty-draft and mid-send look identical to active).
3. **Character counter** near the 4000-char limit (today users hit a silent wall).
4. **Placeholder colour** + **visible focus ring** (today `outline:none` with only a faint border shift — fails keyboard a11y). (Findings 3, 17, 18, 19, 50, 51, 77.)

---

## E. Scroll & jump-to-latest — **BLOCKER / HIGH** (cross-cutting)

1. **"Jump to latest" pill — BLOCKER:** when scrolled up, new messages arrive silently off-screen with no signal or shortcut back. Add a sticky pill (with a "new" affordance).
2. **Preserve scroll position when loading older messages** (today the viewport jumps when "Load earlier" prepends) — `useLayoutEffect` anchor compensation.
3. **Tighten the auto-scroll threshold** from 160px → ~48px so reading older messages isn't hijacked by an arriving message.
4. **Scroll to first unread** on room open (anchor to the new-messages divider) instead of always slamming to the bottom.
5. Initial scroll via `useLayoutEffect` to avoid a top→bottom flash. (Findings 6, 34, 35, 67, 85.)

---

## F. Full-height & edge-to-edge space — **BLOCKER / HIGH** (per-surface)

The conversation does not truly fill the screen anywhere, and is actively broken on the org-based portal.

1. **Org-based coach portal height is broken — BLOCKER.** `CoachChatView` computes `100dvh − var(--coach-topbar-h,52px) − var(--coach-bottomnav-h,64px) − safe-area`, but the org-based portal **never defines those vars** (so it subtracts a 52px top bar that doesn't exist) **and** its `.coachesMain` adds `2rem` / `1rem 1rem 6rem` padding that double-counts the bottom nav. Result: the chat box floats with dead space and a nested scroll. **Fix robustly with flex-fill** (shell `height:100dvh; overflow:hidden`, main `flex:1; min-height:0`, host `flex:1; min-height:0`) so height comes from the real parent, not guessed chrome offsets — retire the fragile per-portal viewport math.
2. **Mobile is not edge-to-edge — HIGH.** Both the admin (`adminMain` 1rem gutter, ≤900px) and coach content areas inset the panel ~1rem and keep a rounded card border. Full-bleed it on mobile: cancel the gutter, drop side borders + corner radius.
3. **Org-less desktop 40px dead gap** at the viewport bottom (`100dvh − 2.5rem` with no bottom chrome). → `100dvh`.
4. **Manage slide-over starts behind the admin top bar** on mobile (z 61 vs 250) — its header/close are occluded. Offset its top below the bar + notch.
5. **Draft-tournament context strip** adds a third chrome band above the composer on the chat route — suppress the strip on `/admin/tournaments/chat`. (Findings 5, 7, 11, 36, 37, 38, 68, 69, 70, 86, 87.)

---

## G. Manage / info panel — **HIGH** (organizer tab)

Benchmark: WhatsApp "group info" + Slack member list.

1. **Smooth dock open** at desktop (today mount/unmount snaps the chat column 340px) — animate width; round the docked panel's outer corners + add a gap so it reads as a second card, not a fused seam. The desktop X should read as "collapse," not "dismiss."
2. **"Close room" is the first thing in the panel and a red button** — one misclick from the open gesture. Move it into a bottom "danger zone" with a confirm.
3. **Discoverability:** the "Manage (N)" button needs a directional cue (`Members (N) ›`) so the slide-over is obvious on mobile.
4. **Mute is opaque:** show the **duration** ("Mute (72 h)" and "Muted · until Jun 25") so the organizer knows when it lifts.
5. **Roster polish:** last-seen wraps instead of clipping next to the email; the "Not yet joined" email action gets a visible label + 44px target; initials avatars on member rows. (Findings 26–29, 58, 59, 74, 80, 81.)

---

## H. Room list & switcher — **HIGH / MEDIUM** (coach surfaces)

Built so future per-division rooms slot in — but the desktop pattern and tap targets need work.

1. **Persistent room sidebar at desktop ≥1024px** (Slack/Discord) instead of full-swapping list↔detail; highlight the active room; keep the full-swap on mobile.
2. **"Rooms" back button is a ~25px pill** — 44px target, larger chevron, label collapses on very narrow screens.
3. **Channel-identity icon + (optional) member/tournament sub-label** in the single-room header so the room name has a visual anchor.
4. **0-room empty state** gets a real next action ("View your tournaments →") and a larger icon.
5. **Room-row monograms** (team colour + initials) instead of an identical icon on every row; **refetch the list on return** so unread counts aren't stale; accessible unread labels. (Findings 32, 33, 63, 64, 65, 84.)

---

## I. States & copy — **HIGH / MEDIUM** (cross-cutting)

1. **Error + empty render together** on a failed first load → add a dedicated error state with a Retry, and reserve the red banner for send-time feedback only.
2. **Redundant double-messaging:** muted (403) and closed (403) each set a red banner **and** the footer — two "you are muted" messages at once. The footer is canonical; drop the banners.
3. **Rate-limit vs failure colour:** the 429 "slow down" uses the same red as a hard send failure — make it a warning (amber).
4. **Muted vs closed look identical** (same class) — muted = personal/temporary (amber, VolumeX); closed = room-wide/permanent (neutral, Lock).
5. **Loading vs empty look identical** once the spinner clears; give each a distinct treatment; drop the 👋 emoji on the operational admin surface (neutral copy via an optional prop).
6. **Banner has no dismiss** and persists — add a dismiss + auto-clear. (Findings 39–42, 71, 77, 88, 89, 90.)

---

## J. Accessibility — **BLOCKER / HIGH / MEDIUM** (cross-cutting)

1. **Manage slide-over is not a dialog — BLOCKER:** no `role="dialog"`, `aria-modal`, focus-on-open, focus trap, or Escape-to-close (the app already does this correctly in the coach "More" sheet — mirror it). Add `aria-expanded`/`aria-controls` on the Manage toggle.
2. **Message list isn't a live region:** add `role="log"` so realtime arrivals are announced.
3. **Tap targets:** delete (22px), send (~24px), "Rooms" (~25px) all below 44px on touch.
4. **Contrast:** timestamps at `--white-35` and section labels/`.blockHead` fail AA → `--white-60/70`.
5. **Focus-visible rings** on room rows, load-earlier, and the composer (lime, not the invisible navy default).
6. **Reduced-motion:** per-module spinner override + guard the JS smooth-scroll.
7. **Accessible unread labels** on the nav badges (today some are `aria-hidden`). (Findings 1, 8, 9, 10, 43, 44, 45, 46, 54, 60, 64, 82.)

---

## K. Navigation & unread badges — **BLOCKER / HIGH / MEDIUM** (entry points)

1. **Organizer is blind on desktop — BLOCKER:** the admin sidebar has **no chat unread badge**. Add one (lime, distinct from amber worklist counts), gated to the tournament nav.
2. **Chat is unreachable on the org-based mobile portal — HIGH (reachability):** the league/club bottom nav has no Chat tab and Chat isn't in its overflow sheet either. Add a Chat tab (with badge).
3. **Three divergent inline badge blocks** (rail, bottom-nav, sidebar) with a hardcoded `#0b0f14` text colour → extract one shared `ChatUnreadBadge` component using tokens.
4. **Badge staleness up to 60s** — subscribe the unread hook to realtime inserts (re-poll on signal) while keeping the 60s safety net.
5. Accessible badge labels on bottom-nav tabs. (Findings 4, 30, 31, 60, 61, 62, 66*, 83. *66 has a backend-dependent sub-part — deferred.)

---

## L. Bubble polish — **MEDIUM / LOW** (cross-cutting)

1. **Deleted-message bubble** inherits full bubble chrome — demote to a dashed "tombstone."
2. **Naked URLs** can overflow on narrow viewports — add `overflow-wrap: anywhere`. (Findings 48, 49.)

---

## Deferred (require a backend change — out of presentational scope)

- **Room-list message preview prefix** ("Alex: …") — needs the service to resolve the last sender's name. Defer to the division-sub-rooms project (Finding 79).
- **Team-scoped unread badge** on the org-based sidebar — needs a per-team room fetch. Add the org-based mobile **Chat tab** now (presentational); scope its badge later (Finding 66B).

---

# Prioritized refinement plan

Three phases. Everything is presentational and lives inside the chat components + their CSS + the page wrappers + the nav components. No engine/API/resolver/auth/realtime/schema changes. After each phase: `npm run typecheck` (shared modules touched) + focused lint; owner does browser testing.

### Phase 1 — Make it usable & make it feel like chat (blockers + the core "chat-app feel") — ✅ BUILT on `dev`
The highest-leverage, mostly-CSS-and-small-JSX set. Ships a chat that fills the screen, reads like a conversation, and is reachable & accessible everywhere. (Coloured initials from C pulled forward per the owner's fork.)
- **A** Light-mode/token correctness (incl. visible "mine" bubble, readable sender colour).
- **B** Message grouping + date dividers (the single biggest "feels like a chat app" lever).
- **D** Composer autosize + 44px send + disabled state.
- **E** Jump-to-latest pill + scroll-position preservation + tighter auto-scroll.
- **F** Full-height fix (org-based flex-fill) + edge-to-edge mobile + org-less desktop gap + manage-panel top offset + draft-strip suppression.
- **J(blocker)** Manage slide-over as a proper dialog (focus trap/Escape/aria) + `role="log"` + the worst tap-target/contrast fixes.
- **K(core)** Admin desktop sidebar unread badge + org-based mobile Chat tab (reachability).

### Phase 2 — High-value polish (+ remaining visual refinements) — ✅ BUILT on `dev` 2026-06-22
*Most of the originally-scoped Phase 2 shipped early inside Phase 1 + the desktop design pass (coloured initials, accessible manage drawer, unread badges, distinct states, tombstone, contrast/tap-targets). The Phase 2 build delivered the genuine remainder: the **desktop persistent room sidebar** (multi-room coaches), **tidied display-name fallback** (no raw email local-part), **roster initials avatars** in the Members panel, **calmer status banners** (amber rate-limit vs red failure + dismiss + auto-clear + assertive announce on failures), and the final a11y polish. Adversarially reviewed (0 blockers; 3 minor issues fixed — incl. a desktop room-list CSS specificity bug); typecheck + lint clean.*
- **C** Sender identity (initials + per-sender colour + name-fallback cleanup).
- **G** Manage panel UX (smooth dock, danger-zone close + confirm, mute duration, directional cue, roster polish).
- **H** Room list/switcher (desktop persistent sidebar, 44px back, header icon, empty-state CTA, room monograms, refetch-on-return).
- **I** States & copy (dedicated error+Retry, de-duplicated muted/closed, warn-vs-danger banner, distinct muted/closed/loading/empty, banner dismiss).
- **K** Shared `ChatUnreadBadge` component + realtime-triggered unread + accessible labels.
- **J** Remaining a11y (focus-visible rings, reduced-motion, full tap-target sweep).
- **L + refinements** (folded in from the old Phase 3): deleted-message tombstone, URL overflow-wrap, manage/room-row avatars, dock "collapse" semantics, monogram tuning, remaining low items.

### Phase 3 — Conversational depth (WhatsApp parity) → **own plan**
The WhatsApp-benchmarked *behavioural* features (pinned messages, reply/quote, @mentions, emoji button, delete-own, search, read-by, and an optional second wave of edit/reactions/presence) are scoped in a dedicated plan, since they add new features + a few small data-model changes rather than visual polish. Infrastructure-heavy items (attachments/voice/calls) are out of scope.
**See:** `TOURNAMENT_CHAT_PHASE3_CONVERSATIONAL_DEPTH_PLAN.md` + `_PM_BRIEF.md`.

### Owner forks (confirm before/at Phase 1)
1. **Aesthetic:** one shared (token-correct) dark style for both shells — *recommended* — vs. adding a lightweight "warm/rounder" variant for the coach portals.
2. **Sender identity depth:** initials + per-sender colour now (Phase 1/2) vs. names-only polish vs. defer avatars.
3. **Read state:** keep organizer "last seen" + add a new-messages divider, **no** per-coach read receipts in V1 — *recommended/assumed* unless told otherwise.
4. **Implementation scope to start now:** Phase 1 only, Phase 1+2, or all three.
