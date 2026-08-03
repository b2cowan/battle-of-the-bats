# Desktop Phase 2 — Account two-column + Chat split-pane (Plan)

**Status:** ✅ BOTH WORKSTREAMS BUILT + VERIFIED on dev 2026-07-31, **uncommitted** — mockups approved same day; owner QA passed (incl. two chat-width tunings); **/simplify DONE + /review DONE (all fixes applied), 509 checks green**; remaining = commit (per-commit OK) → /docs

**/simplify PASS DONE 2026-07-31** (4 lenses). Applied: `getAuthUserCached` (React `cache()`-memoized auth lookup in `lib/supabase-server.ts` — collapses 2-3 Supabase auth round-trips per /account/* request to 1; 7 call sites incl. the consumer layout + chat page); shared `lib/hooks/useIsDesktop.ts` (was hand-copied in CoachChatView + ChatInbox); CSS `composes` consolidation in `account.module.css` (`.stackShell` shared shell for `.page`/`.sectionPane`; `.desktopTitle`/`.paneHeading` compose `.title`; `.inlineSignOut` composes `.ctaGhost`; `.railNote` composes `.pinNote`); identity block + inbox head hoisted to single JSX consts; rail filter simplified (explicit `signedInOnly: false`); `--chat-max` default single-sourced in `globals.css :root` (ChatPanel fallbacks stay as safety net). Skipped by design: sectionPane-composes-page (would couple panes to the stack's desktop `display:none` — a source-order trap), organizer-note extraction (4 static lines, over-extraction), get-the-app reusing the device-gated card (would client-hydrate a server page), mobile-stack JS-gating (CSS-gating is the repo pattern; effects cheap), grouping memoization (trivial room counts).

**/review PASS DONE 2026-07-31** (high-risk tier, deterministic gate green, 4 lenses, 12 deduped findings → 6 fixed, 1 hardened, 5 skipped-with-cause). **Fixed:**
1. **CRITICAL — ChatInbox branched its ROOT JSX shape on `isDesktop`** → React remounted the whole ChatPanel on every 1024px crossing (destroying an unsent composer draft, refetching history, resubscribing realtime) AND flashed the mobile layout + double-loaded on every desktop deep-link/single-room load. Fixed with CoachChatView's constant-shape recipe: ONE tree at every width, CSS does the swap (`.split`/`.splitHasSel`; mobile full-swap now `display:none` rules ≤1023). Verified by DOM-node-identity probes across 1280→390→1280 resizes (panel never remounts).
2. **MEDIUM — desktop /account showed the get-the-app QR ZERO times** (stack QR hidden ≥1024, footer yields by pathname) — the Profile pane now mounts the same self-gating card; exactly-one-QR guarantee restored and asserted at 1024/1280/1440 both themes.
3. **MEDIUM-HIGH — stale-badge race**: a departed room's refresh GET can beat its read-marking PATCH → the just-read room's badge resurrected. Fixed: departing room zeroes optimistically and the zero is pinned through the next refresh commit (`justReadRef`); applied to both desktop switch and mobile Back (the pre-existing variant). Asserted: fake server keeps reporting unread=3, list stays zeroed.
4. **MEDIUM — ChatConversation's local `muted` state** went stale vs same-key refreshed props → now derived from the parent's rooms list (single source).
5. **LOW — `/account/notifications` rendered a second `<h1>` inside the desktop shell** → its title is an `<h2>` (matches sibling panes; visuals identical).
6. **Lint (react-hooks/refs)**: ref writes moved into stable `useCallback` handlers (`onRowClick` via `data-room-id`, `closeRoom`).
Hardened: `get-the-app/page.tsx` gains explicit `force-dynamic` (defense-in-depth; the dynamic layout already forces it). **Skipped with cause:** desktop Help visible to signed-out (owner-approved mockup shows it; mobile signed-out never had the row — intentional divergence, flagged), signed-out deep-link to notifications shows no active rail item (cosmetic; page is a sign-in prompt), room-vanishing-on-membership-revoke shows the placeholder unexplained (honest, rare), Footer's 2-item exact-pathname QR list (defensible; lift to a shared list if a 3rd QR route appears), refresh-on-switch full refetch (deliberate freshness trade, live sidebar = flagged follow-up). Security lens: CLEAN across `cache()` scoping, SW denylist prefix coverage, sign-in/out transitions, open-redirect posture.
**Final state: 509 Playwright checks green** (386 account + 84 chat signed-out + 39 controlled-split incl. no-remount + race-fix probes), typecheck + focused lint clean, all token baselines ZERO.

**Build notes (2026-07-31):**
- **Owner-QA amendment (same day, mockup artifact updated):** the chat split is **full screen width**, not the 980px `--app-col` measure — owner compared against WhatsApp on a ~1911px screen and the centred pane read small. List track is now `clamp(300px, 24vw, 400px)`; the conversation pane takes the remainder, and readable line length is preserved by ChatPanel's own internal `--chat-max` (820px) centring. Verified at 1280 (list 307px) and 1911 (list 400px, conversation ≥1400px, split fills viewport); all ≤1023 no-change checks still green. Account keeps the 980 measure — the ruling is scoped to the app-pane surface, not settings/reading columns.
- **Owner tuning pass 2 (same day): the message spread inside the panel widened too.** `ChatPanel.module.css` no longer self-declares `--chat-max` on `.panel` (the 820px default now lives purely in the nine `var(--chat-max, 820px)` fallbacks — byte-identical for admin/coach/phone hosts, verified no other declaration exists repo-wide), which makes the knob ancestor-overridable as its own comment always intended; `.splitConv` sets `--chat-max: calc(100% - 5rem)` → the 100%s cancel in the gutter calc → a clean 2.5rem (40px) inset on messages/composer/pinned/reply/popovers. Bubbles keep their `min(78%, 520px)` cap, so long messages wrap readably — the WhatsApp shape (spread anchored to edges, bubbles capped). Verified: spread inset 40px at 1280; both chat suites green (117 checks).
- Built exactly to plan; one deviation of note: the chat shell (not an inner host) takes the ≥1024 viewport bound with `overflow-y:auto`, so the coach-arrival return bar (`?back=`) shares the bound and the non-split states (pitch/loading/error) scroll inside the pane on short screens instead of clipping.
- One real defect caught by verification: the split's 300px list was floored to ~444px by flex `min-width:auto` (nowrap preview lines) — fixed with `min-width:0`; row ellipsis absorbs the narrowness as on phones.
- `AccountSignOutButton` gained an `inline` prop (desktop ghost); `ChatConversation` gained `hideBack`; `SUPPORT_MAILTO` extracted to `account/support.ts` (two mounts).
- **Verification: 493 checks green post-clean-restart** — WS-1: 380 (both themes × 390/768/900/1023 literal pre-change equality from a pre-edit baseline capture + 1024/1280/1440 shell contract, seam probes at both edges, footer QR dedup on exactly `/account` + `/account/get-the-app`); WS-2: 84 signed-out (≤1023 literal vs baseline; ≥1024 bounded shell, both themes) + 29 signed-in split checks against a **controlled inbox payload** (route interception: placeholder/no-auto-open, back-button suppression, open-room badge yield, sidebar refetch on select, room switch, resize 1280→390 dissolves to the fixed full-swap with literal top 48px / bottom 72px, deep-link preselect, 1023 legacy swap).
- **NOT verified by automation:** chat with REAL rooms/messages (no UAT account has any chat membership — `org-owner`/`org-admin`/`coach`/`platform-admin` all return 0 rooms; ChatPanel is reused unmodified). Owner QA should open Chat on desktop with a real membership account. Also unexercised: the `?back=` coach-return bar inside the bounded shell (layout is plain flex; reasoned, not measured).
- typecheck clean; verify:changed 0 errors (1 warning in a concurrent session's file); all six token baselines ZERO; SW denylist already covers `/account` by prefix (no change needed).
**Charter:** Owner-ratified 2026-07-30 (Phase 1 plan §"Phase 2 — owner rulings"; build prompt `DESKTOP_PHASE2_ACCOUNT_CHAT_BUILD_PROMPT.md`)
**PM brief:** `DESKTOP_PHASE2_ACCOUNT_CHAT_PM_BRIEF.md`
**Mockups (approval gate):** https://claude.ai/code/artifact/3c0ba411-1752-40fb-9fc5-eab7695f4c9c (directional-only predecessor: `claude.ai/code/artifact/f2b33b25-e051-4396-9dd2-a4b1c64e2bd4`)
**Out of scope (binding):** multi-column Home (CLOSED), desktop navigation rail (separate track). Both screens must work with today's navigation untouched. Phones (≤900px) unchanged on both workstreams; tablet (901–1023px) also unchanged — everything gates at `min-width: 1024px`, the program's established widening breakpoint.

---

## Workstream 1 — Account becomes a two-column settings screen

### Today (verified from code)

- `/account` = `warm.warmTab + .accountFill` (full-bleed paper) → `.page` (560px cap, 720px at ≥1024 — the recorded stopgap; the CSS comment at `account.module.css:209-217` names this exact two-column build as "the real desktop answer").
- Content order: title → identity card → AppearanceCard → (signed-in: rows list — Notifications link / Install row (phone-only) / coach-only Coaches-help + Send-feedback / Help mailto / Sign out) or (signed-out: lime "Sign in" + ghost "Create free account") → GetAppCard (desktop-only complement of the install row, both auth states) → bottom-pinned organizer note.
- `/account/notifications` = separate route, **780px fixed cap, no desktop media query at all**, own `<h1>`, deep-link contract `?focus=<key>` from bells across the app, scroll-offset math reads `#consumer-topbar`.
- ⚠ Finding vs the brief: the lime chip is on **"Sign in"** (`.ctaPrimary`); "Create free account" is the ghost. No colour change proposed — flagged to owner.

### Target shape (≥1024px only)

A shared settings shell across **all `/account/*` routes**, provided by a new `app/(consumer)/account/layout.tsx`:

- `h1` "Account" over the whole screen, then a two-column grid centred in the `--app-col` (980px) measure: **left rail ~248px** (section list) + **right content pane** (~680px), gap ~2rem.
- **Sections are real routes** (rail = plain links, active state from pathname — no client section-state machinery, browser back/refresh/deep links all work):
  - `/account` → **Profile** (identity card + inline Sign out; signed-out: the CTA pair, constrained to ~340px — buttons stop being full-width thumb targets)
  - `/account/notifications` → **Notifications** (existing route + content, mounted in the pane; URL + `?focus=` contract preserved)
  - `/account/appearance` → **Appearance** (existing AppearanceCard) — NEW route
  - `/account/get-the-app` → **Get the app** (existing GetAppQr card unit) — NEW route
  - `/account/help` → **Help** (Help & support mailto + coach-only Coaches Portal help + Send feedback) — NEW route
- Rail bottom carries the quiet organizer note (mono, `--home-dim`), replacing the desktop pin-to-bottom.
- Signed-out rail hides Notifications (mirrors today's absence of that link when signed out).
- **Phones/tablet:** `/account` keeps today's single stack byte-identically (the desktop panes and rail are `≥1024px`-gated; the mobile stack is hidden ≥1024). The three new sub-routes render as simple stacked pages if visited directly on a phone (nothing links to them there).

### Build notes / decisions

1. **One paper owner.** The new layout takes over `warm.warmTab` + fill for all `/account/*` at every width; the page-level wrappers (`account/page.tsx`, notifications route) drop theirs. Guards the recurring "surface paints its own ground meeting one that doesn't" defect — background on the full-bleed layout wrapper, width via background-less inner children only. The ≤900px `.warm::after` bottom-nav paper extension must keep applying (it rides on the same class).
2. **The 720px stopgap block is replaced**, not layered over (`account.module.css:215-217` + its comment).
3. **Notifications in the pane:** its 780px `.page` cap no-ops inside the ~680px pane; add a ≥1024 rule in its module to drop the doubled horizontal padding; its own `<h1>` becomes the pane heading (visually reconciled). Deep-link scroll (`?focus=`) keeps working because the page still scrolls at page level — the pane is not an independent scroll container.
4. **Footer QR dedup extends** to the new QR-bearing route: `Footer.tsx`'s exact-match `isAccount` check also matches `/account/get-the-app` (the /review lesson: suppress exactly where the page shows its own QR, never a prefix).
5. New sub-routes: metadata per route (noindex, like notifications); confirm SW cache denylist treats `/account` as a prefix (FP-2 rule) — verify, expected already covered.
6. New CSS lives under `app/(consumer)/account/` → auto-covered by the `consumer` token scope; tokens only (`--home-*` + global structural), `--home-ink-soft` for real copy (never `--home-dim` for body text).
7. All buttons in panes become inline-width (max-content / constrained), per the charter.

### Files (expected)

- NEW: `app/(consumer)/account/layout.tsx`, `settings-shell.module.css` (or folded into `account.module.css`), `appearance/page.tsx`, `get-the-app/page.tsx`, `help/page.tsx`
- EDIT: `account/page.tsx` (branch split), `account.module.css` (rail/pane styles; stopgap block replaced), `notifications/page.tsx` + `AccountNotifications.module.css` (wrapper handoff + ≥1024 padding), `components/Footer.tsx` (QR dedup)

---

## Workstream 2 — Chat becomes a split pane on desktop

### Today (verified from code)

- List↔conversation is a **full component swap on pure client state** (`ChatInbox.selectedId`); URL never changes after the initial `?room=` deep link; browser back leaves `/chat` entirely.
- **No height contract exists ≥901px** — the fixed-height panel everyone remembers is mobile-only (`.conversation` `position:fixed` inside `@media (max-width:900px)`); on desktop today the page scrolls. The bounded-pane recipe to adapt is `CoachChatView` (≥1024 split: 264px sidebar + pane, `height:calc(100dvh - …)` host, `matchMedia` isDesktop suppressing its redundant back button, ChatPanel reused unmodified).
- `ChatConversation` needs the full `InboxRoom` object and **always renders its own back button** (no suppression prop yet).
- ChatInbox never mounts with 0 rooms (ChatPreview handles that) and has **no "select a conversation" placeholder** — must be built new.
- Only one `ChatPanel` ever mounts (no double-subscribe risk); list has no live-refresh while a conversation is open (today refresh happens on Back).
- Footer: `/chat` opts out unconditionally in `Footer.tsx`.
- Usage-signal check (owner asked): the only chat telemetry is `chat_tab_opened {signedIn}` and `chat_inbox_loaded {roomCount}` — **no viewport/device dimension exists, so desktop chat usage cannot be measured with current instrumentation.** Surfaced, not blocking, per the charter.

### Target shape (≥1024px only)

- `.chatShell` becomes a **bounded viewport pane**: `height: calc(100dvh - var(--consumer-top-h))`, `overflow: hidden`, paper ground full-bleed, content centred in the 980px measure (padding push-in pattern).
- Inside: **left inbox card ~300px** (own scroll: "Chat" heading + event-kicker groups + rows exactly as today) + **right conversation card** (flex:1, `ChatConversation`/`ChatPanel` reused as-is — the bounded ancestor finally gives ChatPanel the definite height its pinned-composer layout expects on desktop).
- No selection → **placeholder pane** (medallion + "Select a conversation" empty state, per the established chat empty-state idiom).
- Selecting a room: client state as today (no router wiring — list is always visible so "back" has no meaning on desktop); in-conversation back button suppressed via an `isDesktop` `matchMedia` prop, mirroring CoachChatView.
- List freshness on desktop v1: `refresh()` on room switch + optimistic unread-clear on the selected room (mute already updates optimistically). A live sidebar (realtime/poll) is flagged as follow-up, not built now.
- Auto-open: existing single-room auto-open and `?room=` deep link keep working; with >1 rooms, **no auto-select** (auto-opening would mark a room read without user intent).
- **Footer: Chat stays opted out — now structurally true on desktop too** (a footer below a `100dvh` non-scrolling pane is unreachable). The Phase-1 comment in `Footer.tsx` gets updated to reflect that the rationale is now real at every width. Explicit decision for owner sign-off, since the charter framed the split pane as "fixing" the opt-out screen: the split pane fixes the *phone-shaped layout*; the opt-out itself remains correct.
- **Phones (≤900px) byte-identical; tablet 901–1023 keeps the current swap behaviour.** ChatPreview (signed-out / 0 rooms), loading/error states, safety sheet: unchanged.

### Files (expected)

- EDIT: `ChatInbox.tsx` (isDesktop split render + placeholder + refresh-on-switch), `ChatConversation.tsx` (back-button suppression prop), `chat-inbox.module.css` (split layout, bounded shell, ≥1024 only), `components/Footer.tsx` (comment truth-up only)
- No API, DB, or realtime changes.

---

## Sequencing

Account first, complete + verified, then Chat (per charter: one workstream at a time; they ship independently). New files in both → **dev-server restart before each owner QA handoff**.

## Verification (both workstreams)

- Playwright **computed-style** checks (not screenshots), warm **and** dark themes, at 1440/1280/1024/1023/900/390:
  - ≥1024: grid/rail/pane widths; chat shell bounded height = viewport − topbar; composer pinned (messages scroll, composer static); backgrounds at every seam (rail/pane/paper/footer) in both themes.
  - **≤1023 asserted against literal pre-change values** captured before any edit (Account 560px cap + stack order; notifications 780px; chat swap + `position:fixed` conversation ≤900).
  - Footer: absent on `/chat` at all widths; present on `/account*` ≥901 with QR-dedup on exactly `/account` and `/account/get-the-app`.
- `npm run verify:changed` per workstream; `npm run typecheck` (shared components touched: Footer, ChatConversation contract, new layout).
- Token baselines stay ZERO (new CSS token-only, auto-scoped).
- Post-build: offer `/simplify` → `/review` per workstream; `/docs` (both are user-facing flows).

## Risks

- **Seam/background class of bug (3 Phase-1 instances):** mitigated by single-paper-owner rule + both-theme seam checks. Highest-risk spots: the new Account layout wrapper handoff, and the chat split's card edges against paper.
- **Notifications deep-link scroll** (`?focus=`) after re-parenting: verified explicitly (it stays page-level scroll, but the topbar-offset math is exercised in QA).
- **`pinNote` bottom-pin** depends on the old single flex column — re-scoped deliberately (rail on desktop, unchanged stack on mobile).
- **Concurrent sessions on `dev`:** several files here are shared (Footer.tsx). Stage explicit pathspecs, re-check branch, `git show --stat HEAD` after each commit; hunk-level staging where needed.
