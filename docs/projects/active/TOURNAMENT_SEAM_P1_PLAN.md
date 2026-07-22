# Tournament Seam Fixes — Phase 1 Implementation Plan ("Broken game-day loops")

**Status:** PLANNED (mockups approved 2026-07-21; scouted against dev 2026-07-22) · **PM brief:** `TOURNAMENT_SEAM_P1_PM_BRIEF.md` · **Source review:** `TOURNAMENT_SEAM_UX_REVIEW.md` · **Mockups:** claude.ai artifact "Tournament Seam Fixes — UX Mockups" (frames 1–4; NEW/RESTYLED labels are the visual spec)

Six work items. No migrations, no new API routes, no schema changes. Shared-module touches (`proxy.ts` WI-2; `lib/auth.ts` or the auth-watcher layer WI-6) ⇒ **dev-server restart required at handoff**. Line refs verified on dev 2026-07-22 by read-only scouts; re-verify before editing (concurrent chats share this tree).

**Suggested build order:** WI-5 (security, independent) → WI-3 → WI-4 → WI-1 + WI-2 together (they share the chat-inbox seeding change) → WI-6 (owner-added 2026-07-22).

---

## WI-1 · Chat return path (mockup frame 1)

**UX:** open room header gains an event chip → that tournament's public home; an "Event admin" link renders only for room moderators → admin chat with the right tournament selected; a lone room auto-opens from the Chat tab.

**Files**
- `lib/chat-service.ts` — `ChatInboxRoom` type (~1717-1733) + `getChatInboxForUser` (~1743-1799): add `orgSlug`, `tournamentSlug`, `isModerator`. `isModerator` is already computed in `listRoomsForUser` (`member_role === 'moderator'`, ~749) and dropped in the map (~1767-1794) — stop dropping it. Slugs: add one parallel lookup *inside the existing `Promise.all`* (tournaments(id,slug) by `room.refId`, organizations(id,slug) by `room.orgId`; both non-nullable), build id→slug Maps, degrade non-fatally to null on error (mirror the contextLabel pattern ~729-731). Do **not** touch `listRoomsForUser`/`ChatRoomListItem` (keeps CoachChatView's `/api/chat/rooms` path untouched).
- `app/(consumer)/chat/ChatInbox.tsx` — mirror the 3 fields on `InboxRoom` (~10-20); line ~44 `selectedId` → lazy init `initialRooms.length === 1 ? initialRooms[0].roomId : null` (CoachChatView pattern, runs once so Back never re-opens).
- `app/(consumer)/chat/ChatConversation.tsx` — pass ChatPanel's **existing, unwired** `headerRight` prop (ChatPanel.tsx:63,1326; precedent: admin chat "Manage room", CoachChatView "Rooms"): event chip `Link` → `/${room.orgSlug}/${room.tournamentSlug}` (label = `room.eventName`), gated on both slugs non-null; admin `Link` → `/${room.orgSlug}/admin/tournaments/chat?tournamentId=${room.eventId}` gated on `room.isModerator && room.orgSlug`. (`?tournamentId=` override confirmed honored by TournamentProvider, lib/tournament-context.tsx:88-103.)
- `app/(consumer)/chat/chat-inbox.module.css` — `.eventChip`/`.adminLink`: icon+label desktop, **icon-only ≤ mobile breakpoint** (house rule), chip label gets own max-width+ellipsis.

**Risks:** header flex row is tight on mobile (iconBefore+title+search+headerRight) — icon-only + ellipsis mandatory; null-guard every link (suspended org ⇒ hide link, never a broken href, never filter the room out).

**QA:** single-room coach → Chat opens the room directly; event chip lands on the tournament home; org owner sees + uses Event admin (lands with correct tournament selected, not last-active); plain coach sees no admin link; ≥2 rooms → inbox first, Back works; mobile width → no wrap/overflow.

---

## WI-2 · Notification deep links (mockup frame 2)

**UX:** chat pushes open the room; score-submitted opens Results with the game expanded; sign-in round-trip preserves the destination. (`score_disputed`: **already absent** from all settings surfaces on dev — verify-only, spend no change.)

**Files**
- `lib/chat-service.ts` :965, :977 — add `link: `/chat?room=${params.roomId}`` to both notify() calls (chat_message + chat_mention). (sw.js already opens `payload.link`; today it falls back to `/`.)
- `app/(consumer)/chat/page.tsx` — read `room` from the async `searchParams` prop → `<ChatTab initialRoomId>`.
- `app/(consumer)/chat/ChatTab.tsx` — forward to `<ChatInbox initialSelectedId>`.
- `app/(consumer)/chat/ChatInbox.tsx` — seed `selectedId` from `initialSelectedId` (composes with WI-1's lone-room lazy init: explicit param wins, else lone-room, else null). `rooms.find` already no-ops safely on a stale/foreign id.
- score_submitted link, **3 call sites** → `/${org.slug}/admin/tournaments/results?tournamentId=${tid}&gameId=${gid}`: `app/api/scorekeeper/[orgSlug]/score/route.ts:71`, `app/api/admin/games/route.ts:850` (forfeit), `:879` (admin submit).
- `app/[orgSlug]/admin/tournaments/results/page.tsx` — read `gameId` via `useSearchParams()` (registrations page precedent, no Suspense wrapper needed here); once games load, **snap `filterGroup`/`viewMode`/`selectedStatuses` to include the target game before GameList renders** (else it's filtered out of view), pass `focusGameId` down.
- `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx` — `focusGameId?: string | null`: add to `expanded` Set **once** (ref guard — polling refresh must not fight a user who collapsed the row), scroll into view; `data-game-id` on the row container (~402) as scroll target.
- `proxy.ts:126` — login redirect `next=` currently drops the query string (`pathname` only); change to `pathname + request.nextUrl.search` **on the org-admin/scorekeeper/check-in branch only** (lines 157/173 left alone). `safeNextPath` already preserves `search` on consumption — the loss is purely here. **Shared module ⇒ dev restart before handoff.**

**Risks:** the Results filter-snap is the critical step — without it the deep-linked game is invisible under default filters; ref-guard the auto-expand; keep the proxy diff to one branch.

**Owner decision (2026-07-22):** a signed-out tap on a *chat* push must prompt sign-in and then land in the room (WhatsApp model — matches the score-push behavior). `/chat` is not auth-gated, so implement in the chat page itself: when `room=` is present with no session, render the sign-in redirect (`/auth/login?next=/chat?room=…`, going through `safeNextPath`) instead of the public ChatPreview pitch. Bare `/chat` with no param keeps today's public preview. (Note: WI-6's sign-out teardown makes this path rare — it mainly covers session *expiry*.)

**QA:** mention push → conversation opens; plain message push → room opens; score push (scorekeeper submit, forfeit, admin submit — all 3) → Results with correct tournament/division/view, row expanded + scrolled; signed-out score push → login → **same** deep link; signed-out chat push → login → **the room**, not the inbox or preview; bare /chat signed-out → public preview unchanged; no "Score disputed" row anywhere in notification settings (verify-only).

---

## WI-3 · Volunteer session-expiry recovery (mockup frame 3)

**UX:** on a 401 mid-save the notice renders *inside* the sheet above the score; typed numbers survive the sign-in round-trip; volunteer returns to the same game, same date, values restored. Check-in gets a real "sign back in" affordance instead of generic "Action failed."

**Files**
- `app/[orgSlug]/scorekeeper/page.tsx`
  1. Factor notice JSX (~498-508) into `noticeBlock`; render at old position only when the sheet is closed; also render inside the sheet between `.sheetHeader` (~609) and `.scoreGrid` (~613). No CSS change (normal flow inside sheet).
  2. `PENDING_KEY = 'sk:pendingScore'`: in the 401 branch (~352) write `{orgSlug, gameId, homeScore, awayScore, date}` to sessionStorage (try/catch); remove on successful save (~365).
  3. Restore effect (`useRef` once-guard, deps `[cards, loading, date]`): skip while loading; drop on orgSlug mismatch; if `pending.date !== date` → `setDate(pending.date)` and let it re-fire; else find card by gameId, re-check `canEdit`, reopen sheet with values, always clear the key. Do **not** touch `closeScoreEntry()`.
- `components/admin/CheckInBoard.tsx` (+ module.css) — distinguish 401 from other failures (~191-196, 274): 401 ⇒ "Signed out — sign back in" notice with login link (`next=` from current pathname — verify on **both** mount routes: gate `/check-in` and admin check-in); non-401 ⇒ keep visible failure text (today it can clear silently).

**Risks:** sessionStorage is per-tab (survives the login nav; precedent: TeamSignupClient draft) — no beforeunload guard needed; stale-restore after Cancel-without-signin is mitigated by the `canEdit` re-check; non-today restores refetch once (slightly slower, correct).

**QA:** type score → kill session → Save ⇒ notice inside sheet; sign in ⇒ same game reopen, values intact, Save succeeds; repeat for a non-today date (date auto-switches); cancel after 401 + fresh reload ⇒ no stale sheet if game scored elsewhere; check-in 401 ⇒ visible sign-in notice; check-in network failure ⇒ error stays visible.

---

## WI-4 · Mobile Results "Completed N" chip (mockup frame 4)

**UX:** mobile summary strip gains the desktop's muted Completed-count chip; tap toggles finalized games into the list; default view unchanged.

**Files**
- `app/[orgSlug]/admin/tournaments/results/page.tsx` (~602-623) — the whole strip is currently **one `<button>`**: restructure to a `<div>` containing (a) text-span button → opens the settings sheet, (b) **new** Completed chip button reusing the exact desktop chip pattern (~476-485: `s.filterChip s.chip_success` + `chipActive` + `chipCount`, `data-empty` when 0) toggling `'completed'` in `selectedStatuses`, (c) sliders-icon button → sheet. (Never nest buttons — invalid HTML.)
- `results-admin.module.css` (~638-739) — two small button-reset rules; give the new chip ≥34px touch target (the row-2 mobile override doesn't reach it) and `flex-shrink:0`.

**Risks:** scoped to results-admin only (registrations/schedule share the strip pattern in their own modules — don't touch); chip state persists via the existing per-tournament localStorage cache (same as the sheet toggle — expected).

**QA:** ≤760px: default list still excludes completed; strip shows stage label + [Submitted pill] + [Completed N chip] + sliders; chip tap adds/removes completed+forfeit games; text/icon still open the sheet; sheet's Completed toggle stays in sync; state survives reload; 0-completed renders extra-muted; desktop unchanged.

---

## WI-5 · Assistant-coach money redaction (security — build first)

**UX:** an assistant with money capability `off` sees schedule/roster but **no fee data anywhere** — including the network payload, not just the pixels. `money='read'` and head coaches unchanged.

**Files**
- `app/[orgSlug]/coaches/teams/[teamId]/tournaments/[registrationId]/page.tsx` (~11-32, currently checks only `user?.email`) — resolve org by slug + caller's assignment via `getCoachingAssignmentsForUser`; `moneyRedacted = !canViewMoney(assignment?.capabilities)` (**fail closed** when no assignment resolves — same resolver already keys the whole portal); pass down.
- `components/coaches/CoachTournamentRecord.tsx` — new `moneyRedacted?: boolean` (default false — free-portal caller unchanged): spread-copy `coachStatus.fee` to a neutral `no-schedule` object + null `pendingFeeAmount`. This single point cascades: TeamHQ fee strip, checklist Fee row, and "Pay your entry fee" next-step all key off `fee.hasSchedule` — no TeamHQ edit.
- `components/coaches/TournamentStatusBlock.tsx` (~73-91) — `hideFeeRow?: boolean` wrapping the Fee row (it otherwise renders a "No fee set" fallback that would look like data).
- `app/api/coaches/[orgSlug]/teams/[teamId]/tournament-history/route.ts` — resolve caller capability; null `amountDue` when money=off (closes the Overview-tile **network** leak; the tile UI is already render-gated).

**Risks:** fail-closed could hide fees on a resolver miss — acceptable (portal nav already depends on the same resolver); cosmetic: 'Payment' section heading may sit over a feeless block for redacted viewers (fine); confirm `canViewMoney('read') === true` (it is: `money !== 'off'`).

**QA:** invite an assistant with default (money off) → open a fee-bearing tournament record: no fee strip/row/amount anywhere; devtools: tournament-history JSON has `amountDue: null` on every entry; head coach + money-read assistant: identical to today.

---

## WI-6 · Push lifecycle follows the session (WhatsApp model) — owner-added 2026-07-22

**UX:** signing out stops this device's account notifications (chat previews stop arriving on a signed-out/shared device); signing back in silently resumes them — no prompt, no visible step (the browser-level permission survives sign-out, so re-subscribe needs no dialog). Missed items are already waiting server-side (bell + chat unread are account-keyed). A different account signing in on the same device takes the device over — verified: the subscribe API **upserts by endpoint and re-points `user_id`** (app/api/notifications/push/subscribe/route.ts:52-67), so re-registration under the new session is the whole mechanism.

**Files**
- `lib/auth.ts` `signOut()` (~40-46) — **before** `supabase.auth.signOut()` (the unsubscribe API needs the still-live session): best-effort call of the existing `removePushDevice(endpoint)` (lib/push-client.ts:151-171 — already does local unsubscribe + authoritative server delete) with the endpoint from `getCurrentPushEndpoint()` (:174-183). Wrap in try/catch + a short timeout so a dead network can never block sign-out. Do NOT hang this off the SIGNED_OUT event (session already gone there — that pattern fits follows, which are local, not this).
- Sign-in re-attach — a small client helper (new fn in `lib/push-client.ts`): if `Notification.permission === 'granted'`, silently `pushManager.subscribe()` (getSubscription-or-subscribe, reusing the existing subscribe options ~:92-95) + POST to the subscribe route (idempotent upsert). Invoke on session establishment: the consumer shell / auth watcher SIGNED_IN path (same layer the Follow Ownership watcher lives in — mirror its self-subscribed pattern) so every sign-in route is covered without per-page wiring.

**Scope guard:** teardown touches **only** the account `push_subscriptions` row for this endpoint — never the separate legacy anonymous fan-alert delivery rows (that system is already retired-for-new-optins; don't reach into it).

**Risks:** sign-out on a dead connection leaves the server row behind (device keeps receiving until next 410-prune or next sign-in re-points it) — accepted, matches the "best-effort local / authoritative server" split already documented in push-client; permission === 'denied'/'default' ⇒ re-attach silently no-ops (the existing opt-in prompt flow remains the only path that ever asks); multiple tabs racing sign-in re-attach is harmless (idempotent upsert).

**QA:** enable pushes → sign out → send yourself a mention → **no push arrives**; sign back in (no prompt appears) → next mention **does** arrive; sign in as a second account on the same device → that account's alerts arrive, the first account's don't; sign out with airplane mode on → sign-out still completes normally; a device that never granted permission sees zero new prompts anywhere.

---

## Cross-cutting

- **Verification:** `npm run verify:changed` per edit batch; `npm run typecheck` once at the end (shared modules touched: `lib/chat-service.ts`, `proxy.ts`, `lib/auth.ts`, `lib/push-client.ts`). No migrations ⇒ no dictionary/snapshot work.
- **Restart:** `proxy.ts` + `lib/auth.ts` + new files ⇒ stop server → `rm -rf .next` → `npm run dev` before owner testing.
- **Out of scope (flagged during scouting):** tournament-scoped Chat *tab* entry (needs room-disambiguation logic — P2); the other 4 dead notification event types (only score_disputed was in scope; it's already gone). ~~/chat sign-in on `?room=`~~ and ~~push teardown at sign-out~~ both PROMOTED INTO SCOPE 2026-07-22 (WI-2 rider + WI-6) by owner decision.
- **Commit:** explicit pathspecs only; `git show --stat HEAD` after; no push without owner OK.
