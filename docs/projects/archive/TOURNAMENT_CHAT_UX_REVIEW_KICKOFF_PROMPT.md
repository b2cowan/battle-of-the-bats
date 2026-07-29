# Kickoff Prompt — Full UX & Design Review of Tournament Chat (mobile + desktop)

> **How to use:** open a fresh chat in this repo and paste everything below the line. It is self-contained. The Tournament Chat feature is fully built on `dev` (not committed); your job is to make it look and feel like a best-in-class chat app on **both** mobile and desktop.

---

You are doing a **full UX and visual design review of the Tournament Chat feature**, then refining it. Goal: it should **look clean, manage screen space well, and put every option behind a smooth, obvious flow** — on phones and on desktop. Benchmark against the chat apps people already know (**iMessage, WhatsApp**, and **Slack/Discord** for the member/info panel and multi-room patterns) and borrow what makes them feel effortless.

This is **presentational / UX work**. Do NOT change the chat engine, access rules, resolver logic, realtime "load-history-then-stream" handling, or the column-scoped write grants — those were adversarially reviewed and are correct. Polish the experience, not the plumbing.

## What Tournament Chat is

A live group chat that belongs to a tournament. The **organizer** (on Tournament Plus) runs it; **every participating coach** (free and paid) is in it. There are three surfaces, all built on one shared engine and one shared chat component:

1. **Organizer "Chat" tab** on the tournament (admin shell) — the conversation + a "Manage" panel (member roster incl. "Not yet joined", mute, remove message, close/reopen room).
2. **Coach chat** in the **org-less / standalone coaches portal** (the dominant tournament-coach audience).
3. **Coach chat** in the **org-based league/club coaches portal**.

Plus notifications (in-app bell + web push, no email), unread badges in both coach portals, and a lifecycle-aware admin bottom nav. Gated to Tournament Plus for the host; coaches need no plan.

## Where everything lives (current state, on `dev`, NOT committed)

**Shared chat components** (the heart of the UI — most of your work is here):
- `components/chat/ChatPanel.tsx` + `ChatPanel.module.css` — the conversation: load-history-then-stream, message list, composer, a header (room name + optional right-side action slot `headerRight`), moderator inline delete, mute/closed banners. **Reused by every surface.**
- `components/chat/ChatManagePanel.tsx` + `.module.css` — the organizer moderation drawer (Members, "Not yet joined", mute/unmute, close/reopen). Slide-over on mobile, docked side panel on desktop.
- `components/chat/CoachChatView.tsx` + `.module.css` — the coach surface: self-sizing full-height host, a room **list → panel** master-detail, a "Rooms" switcher in the header when a coach is in more than one room.

**Surfaces / pages:**
- Admin tab: `app/[orgSlug]/admin/tournaments/chat/page.tsx` + `chat-admin.module.css` (full-screen chat + Manage drawer, `UpgradeGate` on `tournament_chat`).
- Coach (org-less): `app/coaches/team/[basicTeamId]/chat/page.tsx`.
- Coach (org-based): `app/[orgSlug]/coaches/teams/[teamId]/chat/page.tsx`.

**Navigation / entry points:**
- `components/admin/admin-nav-config.ts` (Chat in the Operations group), `components/admin/AdminBottomNav.tsx` (lifecycle-aware mobile bar: Chat always primary; pre-live = Teams·Divisions·Schedule·Chat, live = Results·Check-in·Schedule·Chat), `components/admin/AdminMobileTopBar.tsx` (tournament title is a "home" link to the dashboard).
- `components/coaches/CoachPortalShell.tsx` (org-less: Tier-1 "Chat" + unread badge), `components/coaches/CoachesSidebar.tsx` (org-based: TEAM_NAV "Chat" + unread badge), `lib/use-chat-unread.ts` (the badge count).

**Read first for full context:** `docs/projects/active/TOURNAMENT_CHAT_PLAN.md` (§8 surface build, §9 mobile chat-first UX pass — the most recent state) and `TOURNAMENT_CHAT_PM_BRIEF.md`.

**Engine invariants you must NOT break** (read `docs/projects/active/COACH_CHAT_PLATFORM_PLAN.md` §2 + the **Chat** domain in `docs/agents/db/DATA_DICTIONARY.md`): membership-based RLS, own-rows-only member visibility, column-scoped grants (rooms/members/moderation are service-role only), and the **load-history-then-fetch, then treat realtime INSERTs as post-connection updates, dedupe by id** pattern (a message sent during the subscribe gap must not be lost). Keep all of this intact.

## On activation — load design context first

1. Activate the **`/design`** agent (it loads `memory/design_system.md`, `memory/design_decisions.md`, `memory/design_principles.md`) — the design tokens, dark-first philosophy, data-density rules, and binding design decisions.
2. Note the **two distinct aesthetic contexts** the shared ChatPanel must live in: the **admin shell** is an "operational/terminal" look (monospace data font, square-ish corners, blueprint grid, muted) while the **coaches portal** is warmer and more rounded. Evaluate whether one shared chat styling reads well in both, or whether it needs light context-aware theming.

## Your review — walk every surface, both breakpoints

Review **mobile (≤768px and the ≤900px admin breakpoint) AND desktop (≥1024px)** for:
- **Organizer Chat tab** — conversation fill, the "Manage" button + drawer (slide-over mobile / docked desktop), roster, "Not yet joined", mute/close.
- **Coach chat — org-less portal** and **org-based portal** — full-height fill, room list, the "Rooms" switcher, single-room auto-open.
- **Nav integration** — the lifecycle bottom nav, the top-bar "home" title link + house glyph, unread badges in both portals, sidebar entries.

Evaluate against chat-app best practice:
- **Message design:** bubble shape/radius/contrast, "mine vs theirs" alignment + colour, spacing/density, line length, long-message + link/word-break handling.
- **Grouping & time:** consecutive same-sender grouping (don't repeat the name on every line — see iMessage/WhatsApp), **date dividers**, sparse/relative timestamps, a "new messages" divider.
- **Sender identity:** names vs **avatars/initials + per-sender colour** (WhatsApp group chats), how the current fallback ("email local-part" / "Coach") reads.
- **Composer ergonomics:** pinned input, autosize, Enter-to-send / Shift-Enter newline, send affordance, disabled/muted/closed states, character limit feedback; note (don't necessarily build) attachments/emoji as future.
- **Scroll behaviour:** auto-scroll on new message, "jump to latest" pill, scroll-to-first-unread, keeping position when loading older messages.
- **The info/manage panel** (benchmark WhatsApp "group info" + Slack member list): is "Manage" discoverable, smooth, and well-organized? Desktop docked width + default open/closed? Member rows, mute affordances, the invite actions in "Not yet joined".
- **Room list + switcher** (benchmark Slack/Discord channel list) for 0 / 1 / many rooms — built so future per-division rooms slot in cleanly.
- **States:** empty / loading / error / closed-room / muted — clarity and tone (follow brand voice: practical, warm, no hype).
- **Unread indicators:** the sidebar badge vs in-chat unread — consistent and trustworthy.
- **Space management:** edge-to-edge use, slim chrome, no wasted boxes; is the conversation truly filling the screen?
- **Accessibility:** focus management on the slide-over, keyboard nav, ARIA, contrast, reduced-motion, tap-target sizes.

## Known rough edges (a head start — verify and address)

- Mobile chat is **not truly edge-to-edge** — it inherits ~1rem side padding from the admin/coach content area.
- **Org-based (league/club) coach portal full-height fit** uses a viewport-height calc with CSS-var fallbacks — confirm it fits that portal's chrome precisely on real devices.
- **Desktop "Manage" docked panel** — width, default state, and whether docked-vs-overlay is the right call per breakpoint.
- On **draft** tournaments, the "Finish tournament setup" banner competes for space at the bottom of the chat.
- **No message grouping, no date dividers, no avatars, no message-status** today — every message repeats the sender name + a timestamp. This is the biggest "doesn't feel like a chat app" gap.
- **No "jump to latest" / new-message divider**; auto-scroll only pins when already near the bottom.
- Coaches see no read state; the organizer sees per-member "last seen" in Manage — decide what's right.

## Deliverables

1. A **findings report** at `docs/projects/active/TOURNAMENT_CHAT_UX_REVIEW.md` — per surface, per breakpoint, each finding with a severity, a concrete recommendation, and the chat-app pattern it borrows from. ASCII mockups / before-after sketches where they help.
2. A **prioritized plan** (quick wins vs. larger refactors) **+ a short PM brief** (`_PM_BRIEF.md`), per `AGENCY_RULES.md` (planning-first; present a plain-language UX summary before coding).
3. After presenting the plan, **implement the high-value polish** — presentational only. Keep changes inside the chat components + their CSS + the page wrappers; do not alter engine/API/resolver/auth logic or the load-then-stream behaviour.
4. **Verify** (`npm run typecheck` if shared modules are touched; `npm run lint:focused -- <files>`; the public-CSS token ratchet runs in `verify:changed`). **You write the code; the owner does browser testing** — give a crisp "what to click" on each surface + breakpoint.

## Conventions & guardrails (this repo is strict)

- **Mobile-first.** Use **design tokens** (`var(--*)`) — never literal hex in public CSS modules (the `check-public-tokens` ratchet will flag it). Match each surface's aesthetic (admin terminal vs coach portal).
- **Next.js 16 with the `proxy.ts` convention** — read `node_modules/next/dist/docs/` for anything framework-level; do not assume training-data Next; do not create `middleware.ts`.
- **Restart the dev server** (`stop → rm -rf .next → npm run dev → wait for Ready`) after adding new files or touching shared modules — batch and restart once near handoff. The app needs network access for Supabase; start with escalated/network permissions and confirm `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returns 200.
- **Test data:** Tournament Chat only appears for a **Tournament Plus** host with participating coaches who have logged in. Use the dev seed (`memory/reference_seed_live_tournament.md` → `scripts/seed-live-tournament.mjs`, dev orgs like `dev-test-org` / `dev-standalone-team`) and post a few messages from a coach + the organizer so you have real content to review. Re-run `node --env-file=.env.local scripts/validate-chat-slice.mjs` if you suspect you disturbed the engine (should stay 12/12).
- **Branch:** work on `dev` (shared working copy — stage **explicit pathspecs only**, never `git add -A`; `git show --stat HEAD` after any commit). Commit only when the owner asks.
- Run **`/review`** before calling substantive changes done, then offer **`/docs`** if any user-facing copy/flow changed (the in-app guides for Tournament Chat live in `lib/help-content/tournaments.tsx` and `coaches.tsx`).
- Lead your handoff to the owner in plain product-owner language (what they see/do, not file names).

## Definition of done

On both mobile and desktop, across the organizer tab and both coach portals: the conversation fills the screen and reads like a modern chat app (grouped messages, sensible timestamps/date dividers, clear sender identity, a pinned composer, smooth scrolling with jump-to-latest); every option (manage/roster/moderation, room switching, invites) is one obvious, smooth tap away; space is used edge-to-edge with slim chrome; states (empty/loading/closed/muted) are clear and on-brand; and it looks at home in both the admin and coach aesthetics. A findings report + plan + PM brief are delivered, the agreed polish is implemented and statically verified, and the engine/access rules are untouched.
