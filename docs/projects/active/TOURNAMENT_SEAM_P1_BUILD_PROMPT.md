# Build Prompt — Tournament Seam Fixes P1 ("Broken game-day loops")

**For a NEW chat. This is a BUILD prompt executing an owner-approved plan.** Scope = the six work
items (WI-1…WI-6) of `docs/projects/active/TOURNAMENT_SEAM_P1_PLAN.md` ONLY. P2 (re-pointing the
coach Schedule/Fees doors, Premium parity) and P3 are **NOT** in this chat — do not start them.

Mockups were owner-approved 2026-07-21 and are the **binding visual spec** (NEW / RESTYLED /
UNCHANGED labels): claude.ai artifact `ec4ce258-d2c4-4c0d-b06a-b147ede755a1`
("Tournament Seam Fixes — UX Mockups", frames 1–4). WI-6 + the WI-2 signed-out-chat-push rider
were owner-added 2026-07-22 (WhatsApp model) and have no mockup — build to the plan text.
Where this prompt and the plan disagree, **the plan wins**. Do not re-litigate decisions.

---

## READ FIRST (in order)

1. `docs/projects/active/TOURNAMENT_SEAM_P1_PLAN.md` — the plan you are executing. Line refs were
   scouted 2026-07-22 on a tree with concurrent uncommitted work — **re-verify every cited line
   with a fresh Read before editing it**; treat drift as expected, not alarming.
2. `docs/projects/active/TOURNAMENT_SEAM_P1_PM_BRIEF.md` — the UX outcomes + the owner's 8
   tap-through success criteria (your definition of done mirrors these).
3. `docs/projects/active/TOURNAMENT_SEAM_UX_REVIEW.md` — **only** the appendix entries backing
   each WI (the doc is ~150KB; never read it whole). The exec summary + themes give context fast.
4. Per-WI key files (read the ones for the WI you're building, not all upfront):
   - WI-1/WI-2 chat: `lib/chat-service.ts` (inbox mapper ~1717-1799 + notify calls ~965-987),
     `app/(consumer)/chat/{page,ChatTab,ChatInbox,ChatConversation}.tsx`,
     `components/chat/ChatPanel.tsx` (`headerRight` prop — already wired, precedents in admin
     chat + CoachChatView), `lib/tournament-context.tsx` (`?tournamentId=` override).
   - WI-2 results deep link: `app/[orgSlug]/admin/tournaments/results/page.tsx`,
     `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx`,
     `app/api/scorekeeper/[orgSlug]/score/route.ts` + `app/api/admin/games/route.ts` (3 link
     sites), `proxy.ts` (~126 — the ONE branch that gets `+ search`), `lib/safe-redirect.ts`.
   - WI-3: `app/[orgSlug]/scorekeeper/page.tsx` + `scorekeeper.module.css`,
     `components/admin/CheckInBoard.tsx`; sessionStorage precedent in `app/team/TeamSignupClient.tsx`.
   - WI-4: `app/[orgSlug]/admin/tournaments/results/page.tsx` (~602-623 summary strip) +
     `results-admin.module.css` (~291 mobile hide; ~638-739).
   - WI-5: `app/[orgSlug]/coaches/teams/[teamId]/tournaments/[registrationId]/page.tsx`,
     `components/coaches/{CoachTournamentRecord,TournamentStatusBlock}.tsx`,
     `app/api/coaches/[orgSlug]/teams/[teamId]/tournament-history/route.ts`,
     `lib/coach-capabilities.ts` (`canViewMoney`, `ASSISTANT_DEFAULTS`).
   - WI-6: `lib/auth.ts` (`signOut()` — teardown goes BEFORE `supabase.auth.signOut()`),
     `lib/push-client.ts` (`removePushDevice`, `getCurrentPushEndpoint`, subscribe options),
     `app/api/notifications/push/subscribe/route.ts` (endpoint upsert re-points `user_id` — this
     IS the account-switch mechanism), `lib/follow.ts` (the self-subscribed auth-watcher pattern
     WI-6's sign-in re-attach mirrors — but note teardown canNOT ride SIGNED_OUT; session's gone).

## Workflow requirements (AGENCY_RULES — blocking)

Before any code: present in-conversation (a) an **Implementation Plan / task list** for this build
and (b) a **plain-language PM UX summary** (base it on the PM brief). Then build.

## Build order + hard constraints

**WI-5 (security) → WI-3 → WI-4 → WI-1 + WI-2 together → WI-6.** Per-WI steps, risks, and QA live
in the plan; the non-negotiables:

- **WI-5:** enforcement is **server-side redaction** (fail closed when no assignment resolves),
  never CSS hiding; the tournament-history API must null `amountDue` for money-off assistants
  (network payload, not just pixels); `money='read'` and head coaches byte-identical to today.
- **WI-3:** the 401 notice renders **inside** the sheet; typed scores survive the auth round-trip
  (sessionStorage, per-tab); restore re-checks editability; never clear on the 401 path. Check-in
  gets 401-vs-other-failure distinction + a sign-in link that works from BOTH mount routes.
- **WI-4:** the strip is currently ONE `<button>` — split it; never nest buttons. ≥34px touch
  target on the new chip. Scoped to results only (registrations/schedule share the pattern —
  don't touch).
- **WI-1:** slugs + `isModerator` join the inbox payload via the existing parallel lookup —
  do NOT touch `listRoomsForUser`/`ChatRoomListItem` (CoachChatView's path stays untouched).
  Null-guard every link (hide it, never a broken href, never drop the room from the list).
  Header links: icon+label desktop, **icon-only mobile** (house rule) + ellipsis on the chip.
- **WI-2:** Results must **snap filters/view to the target game before GameList renders** or the
  deep link silently shows nothing; ref-guard the auto-expand (polling must not fight the user);
  `proxy.ts` diff stays on the one branch; signed-out chat-push tap → sign-in → **the room**
  (owner decision — implement in the chat page when `room=` + no session; bare `/chat` keeps the
  public preview); `score_disputed` is verify-only (already gone).
- **WI-6:** teardown before session destroy, best-effort + timeout (sign-out must never hang on a
  dead network); sign-in re-attach is **silent** (only runs when permission already granted — no
  new prompts anywhere, ever); touch ONLY account `push_subscriptions`, never the legacy
  anonymous fan-alert rows.

## Discipline

- One shared **`dev`** branch (re-check HEAD before committing); **explicit pathspecs only** —
  the tree may carry other chats' uncommitted work (theming tranche, etc.); `git show --stat HEAD`
  after every commit; **NO commit/push without the owner's per-action OK.**
- `npm run verify:changed` per batch; **`npm run typecheck`** at the end (shared modules:
  `lib/chat-service.ts`, `proxy.ts`, `lib/auth.ts`, `lib/push-client.ts`).
- **Restart the dev server before owner handoff** (proxy + auth + new files: stop → `rm -rf .next`
  → `npm run dev` → wait for Ready).
- No migrations expected; if one becomes necessary, stop and surface it (dictionary + snapshots
  rule) rather than improvising.
- No new top-level routes expected; if one appears, SW cache denylist + version bump (PII rule).
- After the build: offer **`/simplify`** (new push-lifecycle + deep-link plumbing = new
  abstractions), then **`/review`** (high-risk: auth flows, proxy, a security redaction, push).
  Then **`/docs`** — user-facing flows changed (chat header chip + event-admin door, notification
  landing behavior, sign-out now stopping device notifications, mobile Results chip; the
  notifications guide + chat FAQs must not drift).
- Report honestly at handoff: what was skipped, residual risk, exact owner test script (the PM
  brief's 8 criteria + each WI's QA list in the plan). Owner performs all browser/device testing.

## Out of scope (do not start)

P2/P3 seam fixes · tournament-scoped Chat *tab* entry · the other 4 dead notification event
types · in-app fee payment · offline shells for authed routes · any coach Schedule/Fees door
re-pointing · Premium public-page coach detection (P2) · anything in the theming program.

## Definition of done

All six WIs built on dev; per-WI QA lists + the PM brief's 8 owner criteria pass in your own
verification (Playwright/probe where feasible — computed state, not screenshots); typecheck +
verify:changed green; dev server restarted; `/simplify` + `/review` + `/docs` run or explicitly
offered; TODO.md's Tournament Seam P1 entry updated to BUILT status; memory
(`project_tournament_seam_ux_review.md`) updated; commits only with per-action owner OKs.
