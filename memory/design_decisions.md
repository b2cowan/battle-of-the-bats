# Design Decisions Log

Newest entries first. All decisions here are binding in future sessions unless explicitly overridden.

---

### 2026-06-17 — CoachEmptyState gains a "Quiet" tier for no-action "waiting" empties

**Decision (owner-driven, on the accepted coach tournament page):** the shared `CoachEmptyState` gets a fourth tier — **Quiet** (`quiet` prop) — between Compact and a text-only `<p>`. It's for a section that needs a card body but where the coach can do **nothing but check back** (waiting on the organizer): the tournament Schedule **"not published yet"** and **"no games scheduled yet"** states. Treatment: a calm **flat panel** — drops the radial lime wash (flat `--surface`), the `--highlight-top` shadow, AND the medallion glow halo; the medallion shrinks to `36px` and its icon goes **neutral `--white-40` (never lime)** on a `--white-05`/`--border` shell; **left-aligned, full-width** (no `560px` centering), tighter padding (`1.15rem 1.25rem`) + gap (`0.55rem`), section-weight headline (`0.95rem/700`). Applied to both schedule empties on `/coaches/tournaments/{teamId}` (icon dropped to 18px to suit the smaller medallion). **Opt-in only** — the Full/Compact action empties (first-run "Add your first fee", etc.) keep the lime glow untouched.

**Rationale:** Owner: the unpublished-schedule card "could be the same size as the rest and lighter on the brightness of the icon." Root cause: a no-action waiting state was wearing the **action** treatment (glowing lime medallion + radial wash + centered hero), so it out-weighed the Payment panel right above it and pulled the eye to a place with nothing to do. The glow should signal "there's something to press" — when there isn't, the empty should read as a quiet placeholder. This is the same **flat-note register** already established for `purposeNote`/`recipientNote`/the dashboard metric strip (no box-shadow + neutral non-lime icon + left-aligned = a *note*, not a *card*), now applied as a formal empty-state tier.

**Applies to:** `components/coaches/CoachEmptyState.tsx` (+ `quiet` prop) + `CoachEmptyState.module.css` (`.quiet` + `.quiet .medallion` + `.quiet .headline`), `app/coaches/tournaments/[teamId]/page.tsx` (schedule empty `compact`→`quiet`), `docs/agents/design/COACH_SURFACE_DESIGN_ADDENDUM.md` §iii (4-tier rule). No new tokens, no literal hex. **Generalizes:** an empty whose only "action" is to wait gets the Quiet tier (flat, no glow, neutral `--white-40` icon, left-aligned, section-weight) — match the surrounding data panels, don't out-shout them; the lime glow is reserved for empties that carry a real CTA.

---

### 2026-06-17 — Real logo mark in both shells + coach upsell as a quiet page-footer

**Decision (owner-driven revisions to the COACH_PORTAL_GROWTH Phase-1 quick wins):**

1. **The real brand mark replaces the typed "FL" square in BOTH shells.** The coach `CoachPortalShell` `.brandMark` (solid lime "FL" text square) and the admin `AdminSidebar` `.brandSquare` are both replaced by the actual logo asset — **`/favicon.svg` (the ">" "logic mark": lime chevron on a dark blueprint square)** rendered at 30px via a decorative `<img alt="" aria-hidden>` (accessible name comes from the wrapping link/wordmark), **identical in both shells** (the logo is the cross-shell continuity anchor — exempt from the per-shell radius dialect). Owner chose the ">" logic mark over the FL lettermark (the FL lettermark assets are font-dependent / detailed and don't render crisply at 30px; the favicon is pure geometry, font-independent, the official app icon). New `.brandLogo` class (30×30 block) in both modules; the old text-square rules (incl. their `#0f1123`) removed.

2. **The per-page coach upsell (`ScopeShelf`) is a quiet page-FOOTER, not a card or a one-line footnote.** Evolution this session: dismissible card → one-line footnote → (final) a divider-separated **page-footer zone** at the bottom of each Tier-2 section page (Roster/Schedule/Fees/Announcements). Treatment: `border-top: 1px var(--border-2)` + `2rem` top margin (**not** viewport-pinned — avoids a stranded footer on short pages); three muted tiers — `--font-data` uppercase `--white-40` eyebrow **"Premium Coaches Portal"** → `--white-40` 0.8rem body (`max-width:72ch`) carrying the section value + a whole-team teaser + **"Your free tools stay free."** → a quiet `--white-40`→`--logic-lime`-hover link **"See everything it includes →"** (`/for-coaches?source=coach_footer_{section}`). **Info-first, NOT "express interest"** — the lead-capture ask lives on the `/for-coaches` marketing page; the in-product footer only routes to info. No icon, no card, no button, no dismiss; lime reserved to the link hover (CP-1). Stays per-page, content-gated; now a plain server-renderable component (no `'use client'`/localStorage).

3. **Naming canon enforced** (per the Brand Strategy Coaches Portal Unification Addendum 2026-05-25): the paid tier is **"Premium Coaches Portal"** (Premium as prefix, mirroring "Basic Coaches Portal"), the product is **"Coaches Portal"** — never "Coaches Portal Premium" / "Coach Portal" / "Team plan". Recorded in `docs/agents/brand/PRICING_PAGE_COPY.md`.

**Rationale:** Owner: the typed "FL" wasn't the real logo; "express interest" implied an ask when the goal is to lead coaches to *information*; and the upsell should be a non-intrusive page footer that "can include more information." Using the official mark gives true cross-shell brand identity; routing the in-product upsell to the `/for-coaches` explainer (info-first) with the ask deferred to that page is the correct funnel split; a divider-separated footer reads as the page's end without competing with the working content.

**Applies to:** `components/coaches/CoachPortalShell.tsx` + `.module.css` (`.brandLogo` replaces `.brandMark`), `components/admin/AdminSidebar.tsx` + `.module.css` (`.brandLogo` replaces `.brandSquare`), `components/coaches/ScopeShelf.tsx` + `.module.css` (card → `.footer`/`.footerEyebrow`/`.footerBody`/`.footerLink`), `docs/agents/brand/PRICING_PAGE_COPY.md` (naming canon). No new tokens; no literal hex in our CSS (favicon's hex lives in the asset). **Generalizes:** the logo is the one device that stays identical across shells (continuity anchor, exempt from dialect rules); an always-present informational upsell is a divider-separated footer zone (eyebrow + capped-width muted body + quiet info link → marketing explainer), distinct from a dismissible nudge card, and routes to *info* not an *ask*.

---

### 2026-06-17 — Coach Fees: two-type model (Everyone / One player) + atomic bulk-create + one add button

**Decision (model + flow redesign on `components/coaches/FeeEditor.tsx`; supersedes the same-day "whole-team fee type" framing):**

1. **Two fee types only, via a segmented "Who owes this?" control** in the add form (reuses the established `.segmented`/`.segmentBtn` lime-active pattern from `ScheduleEditor` EventForm — selection-state lime, distinct from the submit action, CP-1 holds): **Everyone** (default) bulk-creates one independent per-player fee for every roster player; **One player** reveals a player picker. The old "whole team / one shared amount" type is **dropped from the add flow**. A quiet `.assignNote` **impact-preview** states the blast radius ("Adds a $200 fee to all 15 players — $3,000 total"); the lime submit label is **dynamic** ("Add fee for N players"). Edit mode hides the segmented control (edits label/amount/notes; keeps the existing assignment). The `.form` is **de-glowed** to neutral.
2. **Bulk-create is a new atomic write path** — `createBasicCoachTeamFeesForAllPlayers` (single N-row `.insert`, owner-guarded `POST .../fees/bulk`, player_ids server-derived so no cross-team smuggling, capped at 200). Client add paths **de-optimized** to match `ScheduleEditor` (await POST → append real rows; removed the `Date.now()` that newly tripped `react-hooks/purity`).
3. **Existing player-less fees survive in a demoted, conditional "Other fees" section** (`.legacyBlock` top-divider + `.legacyTitle` `--white-60`/0.86rem + cleanup note), only when such fees exist — never hide recorded money; self-retires when cleared.
4. **One add button per page.** The top "Add fee" is the single add entry; the "Roster fees" empty/remainder prompts are **explain-only text** (no buttons) that point at "Add fee" above — fixes "two buttons doing the same thing." Copy reframed to "Charge everyone at once or one player at a time."

**Rationale:** Owner: the common case (every player owes the same season fee/installment) had no option — you'd add it N times by hand; "whole team" was confusing (sounded like an expense); and two add buttons did the same thing. Naming exactly two who-owes choices, defaulting to the common "Everyone" with a per-player bulk-create + impact preview, demoting the deprecated type to a self-retiring legacy section, and collapsing to one add button resolves it without expanding scope into debit/credit (Premium).

**Applies to:** `components/coaches/FeeEditor.tsx` + `FeeEditor.module.css` (`.segmented`/`.segmentBtn`/`.fieldLabel`/`.legacyBlock`/`.legacyTitle`; de-glowed `.form`; `.remainderRow`/`.playerFeesEmpty` → text-only; removed `TEAM_WIDE`), `lib/basic-coach-fees.ts` (`createBasicCoachTeamFeesForAllPlayers` + error constants), new `app/api/coaches/teams/[basicTeamId]/fees/bulk/route.ts`. No new tokens; `#0f1123` is the established dark-on-lime literal. **Generalizes:** a small fixed choice set uses the established segmented control (not a select); a fan-out action shows a quiet impact-preview + a blast-radius-naming submit label (no modal) and bulk-creates atomically server-side; deprecating a data type keeps existing records in a demoted self-retiring legacy section; and a page has exactly one button per action (contextual empties explain + point at it, they don't duplicate it).

### 2026-06-17 — Coach Fees ledger: single-direction framing + legible paid-action + shared delete modal

**Decision (operability + clarity pass on `components/coaches/FeeEditor.tsx`, building on the same-day purpose-strip/gating decision):**

1. **Single-direction money model, made explicit.** The free coach Fees tool tracks **money owed TO the coach only** (player dues/jerseys + whole-team fees the coach collects) — NOT a debit/credit ledger and NOT team expenses (those are the paid accounting module). Copy reframed to state this: purpose strip leads "Track what your **team** owes you" (covers per-player AND whole-team) with an aside "Everything here is money owed *to you* — your private record of what to collect." The ambiguous **"Team-wide charges" → "Whole-team fees"** ("charges" read as an expense/bill); subline "A shared amount the whole team owes you — tracked once, not split between players." Assignment select: "The whole team (one shared fee)" + helper ending "Either way, it's money owed to you."
2. **Mark-paid is a labelled control, not a bare icon.** Unpaid row → neutral `.markPaidBtn` ("✓ Mark paid", lime on hover only); paid row → lime `.paidPill` ("Paid · {date}") + quiet `.undoBtn`. The cryptic leftmost dashed-check toggle is retired. Lime stays reserved (one solid-lime "Add fee" primary; paid is the established status tint) — CP-1 holds across N rows.
3. **Zero-fee players never render $0 rows** (they implied a phantom split of a whole-team fee). Players with ≥1 fee → cards; the rest → either a quiet `.remainderRow` (count + a real `btn btn-ghost` "Add a player fee") when some players have fees, or a left-aligned `.playerFeesEmpty` inline prompt (real ghost button) when none do. **No centered empty-state card nested under a left-aligned section heading** (reads floaty) and **no two stacked gray text lines**. Section subline shows only when player-fee cards exist.
4. **Destructive deletes use the shared `FeedbackModal` (`type='danger'`), not native `confirm()`** — across all three coach editors (fee/player/event); the modal body names the item. `FeedbackModal` gained Escape-to-close + focus-the-Cancel-on-open + focus-restore-on-close + `role="dialog"`/`aria-modal`/`aria-labelledby`; its focus effect keys on `[isOpen]` with `onClose` via an effect-synced ref (callers pass inline-arrow onClose; keying on it caused focus churn on every re-render-while-open — caught in `/review`).

**Rationale:** Owner used the page and still hit confusion: couldn't find "mark paid", couldn't tell if a whole-team "charge" was owed-to-them or an expense they pay, saw $0 player rows implying a split, and the add-affordance "didn't look like a button." Root cause was an unnamed money model + an invisible core verb. Naming the direction everywhere, making the verb a labelled control, suppressing misleading zero rows, and using the app-standard modal + buttons resolves it without expanding scope into debit/credit (which stays Premium).

**Applies to:** `components/coaches/FeeEditor.tsx` + `FeeEditor.module.css` (`.markPaidBtn`/`.paidPill`/`.undoBtn`/`.blockSub`/`.assignNote`/`.remainderRow`/`.playerFeesEmpty`; retired `.statusPaid`/`.statusUnpaid`/`.collapsedPlayers`), `components/coaches/RosterEditor.tsx` + `ScheduleEditor.tsx` (delete modals), `components/FeedbackModal.tsx` (a11y). No new tokens, no literal hex. **Generalizes:** name a non-obvious money/data DIRECTION in persistent copy (not just labels); a list's recurring core action is a labelled neutral control (accent reserved for status + the one primary); never render zero-value rows that imply a false relationship; reuse the shared modal + global `btn` classes for cross-surface consistency; and a shared modal's focus effect must key on open-state with callbacks via refs to avoid re-render churn.

### 2026-06-17 — Coach Fees page: persistent purpose strip + purpose-led empty gating

**Decision:** The org-less coach Fees page (`components/coaches/FeeEditor.tsx` + `.module.css`; route `/coaches/team/{id}/fees`) gets a persistent orientation strip + three-stage empty-gating, because a first-time coach couldn't tell what the page was for or which direction money flows.

1. **Persistent purpose strip (`.purposeNote`)** under the hero, on all stages — flat-note register: `--surface` / `--border` / `--radius`, **no `box-shadow`** (the missing highlight is what keeps it a *note*, not a *card*), `Wallet` 18px `--white-40` icon (quiet — never lime, never amber). Three-level type: bold `--white` lead ("Track what your players owe you") → `--white-60` continuation (dues/jerseys/cost-split + "record & check off") → demoted `--white-40` aside ("Your private tracker — no payments run through FieldLogicHQ, and it's not where you pay a tournament's entry fee"). The aside is the critical money-direction disambiguation and lives in the persistent strip because the empty state vanishes after the first fee but the misconception doesn't.
2. **Three-stage body gating:** (a) no players → existing **compact** `CoachEmptyState` "No roster to bill yet"; (b) players + no fees → one **full** `CoachEmptyState` "No fees yet" with a single lime "Add your first fee" primary (the one earned lime moment); (c) players + ≥1 fee → today's full ledger. The Owed/Paid/Unpaid summary strip, per-player $0.00 rows, and standalone Add-fee button are all **suppressed until ≥1 fee exists** — machinery never precedes purpose. Page header "{n} unpaid" meta also suppressed at zero fees.
3. **Money-visibility guard (from /review):** the first gate is `!hasPlayers && !hasFees` (not `!hasPlayers`) so a **team-wide charge stays visible when the roster is empty** — a tracked charge must never disappear behind the no-roster empty state. The per-player "Roster fees" block additionally gates on `hasPlayers` so it doesn't render an empty heading in that rare state.

**Rationale:** Owner: "it doesn't tell me what these fees are for… is this how I pay for tournaments? is this what I charge my players?" The page opened with dollar totals + machinery and zero orientation. A persistent flat-note (the 2026-06-05 metric-strip "small info doesn't warrant box weight" register, same family as the 2026-06-15 pending-portal strip) answers whose-money / what-for / track-only / what-it's-NOT durably; purpose-led empty-states defer the ledger until there's real data; lime stays reserved for the single first-action primary. The /review guard prevents the restructure from hiding a recorded team-wide charge on a money surface.

**Applies to:** `components/coaches/FeeEditor.tsx` + `FeeEditor.module.css` (new `.purposeNote`/`.purposeIcon`/`.purposeText`/`.purposeLead`/`.purposeAside`; `hasPlayers`/`hasFees` gating), `app/coaches/team/[basicTeamId]/fees/page.tsx` (conditional header meta). No new tokens, no literal hex. **Generalizes:** a coach section whose purpose or money-direction is ambiguous gets a persistent flat-panel orientation note (not a card/banner, neutral non-lime icon, three-level type with the disambiguation as a demoted aside); machinery (stat strips, per-row ledgers) is suppressed behind a purpose-led **full** empty-state until real data exists; and empty-gating on a money surface must never hide already-recorded data (gate on data-presence, not just the precondition).

### 2026-06-17 — Coach Announcements: form-first single-accent layout + recipient-clarity caption

**Decision:** The org-less coach Announcements section (`components/coaches/AnnouncementEditor.tsx` + `.module.css`) is restructured from four competing container idioms (two glowing) into two surface families, and the recipient stats are made legible:

1. **No-contacts state → text-note, not a card.** The full `CoachEmptyState` medallion card is replaced by a slim `--warning`-hued inline row under the stat strip (`rgba(var(--warning-rgb),0.08)` bg + `0.25` border + `--radius-sm`, `TriangleAlert` 16px, ~46px tall) with a quiet ghost "Refresh contacts" action pinned right. Per addendum §iii the section's content is the compose form, so the missing contacts are a *prerequisite warning* (text-note tier), not actionable content that IS the section.
2. **Compose form promoted above the fold + de-glowed.** It loses its lime border + `--glow-sm` and becomes a neutral `--surface`/`--border` card. The primary working surface earns prominence by *position*, not glow. The lime accent (CP-1) is spent only on the Tier-1 `btn-lime` Send button — one earned moment per surface.
3. **"Recent announcements" gains a real `--surface` card** (`.logCard`); its inner `.row` items flatten to `--surface-2`/`--border-2`/`--radius-sm` to avoid a card-on-card double box.
4. **Skipped stat tile hidden when 0** (`data-cols` switches the strip 3-col→2-col).
5. **Recipient clarity:** the "Will email" tile relabels to **"Will receive"** (the old label read as an action, not a count), and a quiet text-note caption sits under the strip — `--white-40`, 0.78rem, 13px `Users` icon (icon matches text, **never lime**), no surface — naming the send rule + restating the count in words: *"Sent to the contact email on file for each player on your Roster — N person/people will receive this."* Shown only when `recipientCount > 0` (the amber warning owns the zero state, no duplication). Copy via `/marketing`; labels "On roster"/"Skipped" unchanged.

**Rationale:** Owner: "everything is just stacked and the shapes change as we go; the no-contacts message is very big and pushes the main part of the page down" + later "Will email / On roster aren't clear — who actually gets this?" Four surface idioms with two competing glows gave the eye no anchor and buried the actual job (compose) below the fold. Demoting the precondition to a text-note, de-glowing the form, and carding the log collapses to flat-metadata-strip + neutral-cards with zero competing glows. The recipient caption applies the 2026-06-05 metric-strip register ("small info doesn't warrant box weight") to answer "who gets this" without surface weight; the bare stat number that drives a consequential action (who is emailed) gets a one-line plain-language caption rather than relying on the label alone — caption carries meaning, tile carries the glance.

**Applies to:** `components/coaches/AnnouncementEditor.tsx` + `AnnouncementEditor.module.css` (new `.recipientsWarn`/`.recipientsWarnAction`/`.recipientsWarnIcon`, `.recipientNote`/`.recipientNoteIcon`, `.logCard`, `.formHint`, `.summary[data-cols]`; removed `.empty`/`.refreshBtn`/`data-muted`; `.row` flattened; `.form` de-glowed). No new tokens, no literal hex. **Generalizable pattern for coach editor sections:** the primary working surface earns prominence by position not glow (reserve glow/lime for the single most-important action); precondition warnings are `--warning` text-notes not full empty-state cards; a consequential bare stat gets a one-line metric-strip-register caption that explains the rule + restates the count in words.

---

### 2026-06-16 — Coaches Portal mobile shell: adopt the admin "4 primary + More" bottom-nav pattern

**Decision:** The org-less Coaches Portal mobile shell (`CoachPortalShell.tsx`, ≤1023px) is realigned to the established `AdminBottomNav` pattern. (1) **TOP BAR** becomes a team-first context strip — team color-dot + team name (full width, `--white` `0.95rem` `700`) + lifecycle chip; the "Coaches Portal" wordmark is dropped on mobile (optional small "FL" mark only), and the standalone email-initial account chip is removed. (2) **BOTTOM NAV** is fixed at 4 primary tabs (Overview, Tournaments, + first two activated Tier-2 / Explore) + a 5th **"More"** tab (`MoreHorizontal`/`X`). (3) **"More"** opens a single sheet holding: the team switcher (>1 team, "Current team" label, mirroring the admin `tournamentBlock`), ALL overflow sections ("Sections" label), and account utilities (All workspaces, Send feedback, Sign out). `isMoreActive` highlights More when the route is inside it. The previous account bottom-sheet behind the "B" chip is retired (its contents move into More).

**Rationale:** The coach shell invented its own mobile model and hit three failures: the bottom nav capped at 4 and silently dropped activated sections (functional dead-end), the brand outranked the truncated team name (inverted priority), and a bare-letter "B" chip created an opaque second nav home competing with the bottom bar. The admin shell already solved unbounded-section overflow with "4 primary + More" and keeps switcher+account inside More (one overflow home). Adopting it fixes all three, scales to any number of activated Tier-2 sections, puts the team identity first, and gives users the same mobile convention across admin and coach surfaces.

**Applies to:** `components/coaches/CoachPortalShell.tsx` + `CoachPortalShell.module.css` (mobile top bar, bottom nav, account sheet → More sheet). Reuses `AdminBottomNav` conventions (`moreWrap`/`dropdown`/`dropSectionLabel`/`tournamentBlock` equivalents). No new tokens.

---

### 2026-06-16 — Coach schedule: differentiate event types (game vs practice vs event) by colour + icon + row accent

**Decision:** The coach team Schedule list (`components/coaches/ScheduleEditor.tsx`) previously distinguished event types only by a 2-letter lime monogram (`GM`/`PR`/`EV`) — identical colour for all three, so games and practices blurred together. Now differentiated on three reinforcing axes, all reusing existing tokens:
1. **Per-type chip colour** (`.typeChip[data-type]`): **game = `--logic-lime`** (the marquee event keeps the brand accent), **practice = `--info-rgb`** (blue — the platform's "scheduled/routine" status colour), **event = neutral** (`--white-50` text / `--white-05` fill / `--border-2`).
2. **Icon instead of letters** (`TYPE_ICON` map): game = `Trophy`, practice = `Dumbbell`, event = `CalendarDays` (16–17px lucide, `aria-label` carries the type name for SR).
3. **Left status-strip row accent** (`.row[data-type]`): game = `border-left: 3px solid var(--logic-lime)` (strong), practice = `rgba(var(--info-rgb),0.5)` (faint), event = default border (quietest) — same convention as the admin/public schedule rows.

**Rationale:** Owner: games and practices should "stand out as different a little more." The one element meant to distinguish them (the chip) was visually identical across types. Colour is the fastest scan axis; icon reinforces it language-free; the row-edge strip makes games "pop" as the list scans (the established status-strip trick). Game = lime because it's the marquee event; practice = `--info` blue because that's the platform's routine/scheduled colour (pairs cleanly against lime, and avoids amber which already means "submitted/needs-attention" on schedule status-strips). No new tokens.

**Applies to:** `components/coaches/ScheduleEditor.tsx` (`TYPE_ICON`, row `data-type`, icon chip), `components/coaches/ScheduleEditor.module.css` (`.typeChip[data-type='game'|'practice'|'event']`, `.row[data-type='game'|'practice']`). Pattern for any future event/type list: colour + icon + optional left status-strip, keyed off the existing status-colour RGB tokens; reserve lime for the primary/marquee type.

---

### 2026-06-15 — Coach pending portal: status-hero + persistent "what happens next" strip + demoted manage zone

**Decision:** The coach pending tournament page (`/coaches/tournaments/{teamId}`, pending/waitlist phase) is restructured from a flat build-order card stack into three tiers: **(1)** the `TeamHQ` status hero (the answer — unchanged except the pending checklist "Registered" state now reads **"Submitted {date}"** to kill the ambiguous bare date); **(2)** a NEW persistent, non-dismissible **"What happens next"** 3-step strip (`components/coaches/CoachNextSteps.tsx` — borderless numbered rows on `--surface`/`--border`/`--radius`, lime step markers reusing the `CoachWelcomeBanner` `.iconWrap` recipe at `1.5rem`; NOT a `card`, NOT the lime banner — it carries the forward-orientation the dismissible welcome banner used to own, so it survives dismissal); **(3)** a visually-demoted **"Manage your entry"** zone (Head Coach in a `CollapsibleCard`, `defaultOpen={false}` while pending → `true` once accepted; a `.zoneNote` "Optional for now…" line). The dismissible `CoachWelcomeBanner` slims to a one-line lime greeting + resource links (body paragraph + "What happens next" block removed). The **Registration Details card is deleted on the pending phase** (fully duplicated by the hero; kept for accepted+). The "Back to Coaches Portal" breadcrumb is removed. New pending order: **hero → what-happens-next strip → manage-your-entry (collapsed) → announcements.**

**Rationale:** This is the first place a brand-new coach lands and they know nothing about the platform. The only orientation lived in a dismissible banner; the rest was equal-weight cards in build order (head coach → reg details → announcements) including a verbatim-duplicate details card. A persistent quiet strip — same register as the 2026-06-05 dashboard metric-strip decision ("small info doesn't warrant box weight") — gives durable "what now" orientation; `CollapsibleCard` demotes optional-while-pending prep without removing it; deleting the duplicate card removes redundancy. Reserve the lime wash for the celebratory dismissible greeting only, so the persistent strip (neutral) and the greeting (lime) don't compete.

**Applies to:** `app/coaches/tournaments/[teamId]/page.tsx`, `app/coaches/tournaments/[teamId]/detail.module.css` (`.zoneNote`; removed `.breadcrumb`), `components/coaches/TeamHQ.tsx`, `components/coaches/CoachWelcomeBanner.tsx` (+ module CSS), new `components/coaches/CoachNextSteps.tsx` (+ module CSS). Reuses `CollapsibleCard`. No new tokens; no literal hex (lime `rgba(217,249,157,…)` values match existing banner usage). Pattern: phase-adaptive coach pages lead with a status hero, carry forward-orientation in a persistent borderless strip (not a card), and demote optional-while-pending actions via `CollapsibleCard`. **Companion decision STAGED (separate session):** team-scoped coach shell nav mirroring tournament-admin (team name + status chip at rail top, dropdown only when >1 team; drop the "My Teams" nav link + team-list section; add a portal subtitle).

---

### 2026-06-15 — Schedule toolbar (rev 7): dropdown-overlap bug fixed; narrower division select; actions stay pinned right

**Decision:** Two real fixes + one reverted experiment, all MEASURED in Playwright.
1. **Dropdown menus were visually broken (rows overlapping).** Root cause MEASURED: the rev-5 height rule `.scheduleEndGroup :global(button){height:28px}` is a *descendant* selector, so it also clamped the **dropdown `[role=menuitem]` buttons** (Auto / Unpublish menus render inside `.scheduleEndGroup`) to 28px — crushing each item's two-line title+subtitle (measured 28px, overlapping). Fix: scope both the desktop (28px) and mobile (34px) height rules to `:global(button:not([role="menuitem"]))` so only trigger buttons are pinned; menu items size to content (measured 48px after). Also widened the Auto menu to `minWidth:250px` + `whiteSpace:nowrap` so its short titles ("Round-Robin Generator") stop wrapping. **Binding rule: never use a bare descendant `:global(button)` height/size rule on a container that also holds a dropdown menu — exclude `[role=menuitem]`.**
2. **Division select was gratuitously wide** (shared `ToolbarSelect` defaults `min-width:13rem` ≈ 208px; with label ≈ 270px). Added `className={styles.scheduleDivisionSelect}` to the Division select and `@media (min-width:769px) .scheduleDivisionSelect :global(select){ min-width:9rem }` — fits the longest realistic division name, tightens the left group, reduces premature wrapping.
3. **Reverted:** an experiment to cluster all controls left (drop `space-between`, `margin-left:0` on the action group, `flex:0 1 auto` on the left group). It closed the middle gap but moved the emptiness to the right edge. Owner chose **actions pinned right** (original `space-between`) — the middle gap reads as intentional "what you're viewing" (left) vs "actions" (right) separation. So the toolbar keeps `space-between` + grown left group + right-aligned action cluster.

**Rationale:** Owner: dropdowns "look visually broken" (the overlap bug — real, fixed) and "weird spacing" (the wide select + the gap). Turned out the gap itself was wanted; the wide division select was the avoidable part. The dropdown bug was a self-inflicted regression from the rev-5 height fix — caught only by measuring menu-item heights, not by eye.

**Applies to:** `schedule-admin.module.css` (height rules now `:not([role=menuitem])`; new desktop `.scheduleDivisionSelect` min-width), `page.tsx` (Auto menu `minWidth`/`nowrap`; `className` on the Division `ToolbarSelect`). The rev-6 `align-items:flex-start` stands; the rev-7 clustering experiment is NOT in the codebase.

---

### 2026-06-15 — Schedule toolbar (rev 6): top-align groups so the action cluster doesn't float between wrapped left rows

**Decision:** `.scheduleToolbar.scheduleToolbar { align-items: flex-start }` (desktop; double-class for specificity over the shared `.toolbar { align-items:center }`). MEASURED root cause via Playwright (y-centers, not eyeballed): the left toolbar group (Division + Stage + View) wraps to **two rows** on a narrow desktop / with devtools open — Division+Stage at y-mid 98, View toggle at y-mid 134 (group height 64px). The right action cluster (Build Bracket / Publish / Auto, 28px) was centered by the parent's `align-items:center` to y-mid **116** — exactly halfway between the two left rows, so it visually floated in the gap (user: "the buttons on the right are in between the 2 sets of buttons on the left"). Top-aligning pulls the cluster to y-mid **98**, level with the FIRST left row (Division/Stage). Verified before/after by measurement + screenshot; mobile unaffected (its `@media` `align-items:flex-end` rule still wins).

**Rationale:** Six revisions in, the persistent "not aligned" complaint was never about button *height* (rev 5 fixed that) — it was vertical *anchoring* against a wrapping multi-row sibling. `align-items:center` + a wrapping neighbor = the classic "short element floats to the centroid of the tall element" trap. flex-start is the correct anchor whenever a toolbar's groups can wrap to differing row counts.

**Applies to:** `schedule-admin.module.css` (`.scheduleToolbar.scheduleToolbar` align-items). No page.tsx change. Pattern: any space-between toolbar whose groups can wrap to different heights should top-align, not center.

---

### 2026-06-15 — Schedule toolbar (rev 5): button-height consistency, MEASURED via Playwright

**Decision:** Pinned consistent button heights in the schedule toolbar, verified by driving the page in Playwright and reading computed `getBoundingClientRect().height` (not by eye). Measured before/after:
- **Mobile Row 2** (Publish + wrench Tools, beside search): were **32px (Publish, `.mobileIconButton`) vs 24px (Tools, default `.btn-data`)**. The old `.scheduleEndGroup :global(button){height:38px}` rule only hit the desktop group (hidden on mobile), so the mobile controls had no shared height. Fixed: `@media (max-width:768px) .scheduleMobilePublish :global(button), .scheduleMobileTools :global(button) { height:34px }` — matches the 34px division select + stage toggle. After: **all 34px.**
- **Desktop Row 1 action cluster** (Build Bracket / Publish / Auto): were **22–25px ragged** (`.btn-data` ~22–23px, ghost dropdown triggers ~25px). Fixed: `@media (min-width:769px) .scheduleEndGroup :global(button){ height:28px }` — matches the adjacent venue button + filter chips (28px). After: **all 28px.** The Stage/View segmented toggles stay 22px deliberately — a distinct control family in their own zone, reads as grouping not misalignment.

**Process note (binding for future visual work):** stop iterating blind on screenshots. The repo has a Playwright UAT harness (`tests/uat/`, saved sessions in `.auth/`); a throwaway spec that loads a session, sets the viewport, drives the control, and dumps computed heights + a screenshot gives exact numbers to fix against and confirms the fix landed. Several prior revs missed the height bug because it was eyeballed. Measure, fix, re-measure, then delete the temp spec.

**Applies to:** `schedule-admin.module.css` (mobile `.scheduleMobilePublish`/`.scheduleMobileTools` height; desktop `.scheduleEndGroup` button height; retired the stale mobile 38px rule). No page.tsx change.

---

### 2026-06-15 — Schedule toolbar (rev 4): mobile publish = sibling beside Tools (not inside); bracket actions join the right action cluster

**Decision:** Two corrections to rev 3 after testing.
1. **Mobile Publish/Unpublish is a standalone button BESIDE the Tools menu**, not a section inside it. Rendered as `.scheduleMobilePublish` (a sibling on Row 2, `order:2`, just left of the wrench Tools menu `order:3`; `margin-left:auto` pushes the publish+tools pair to the right edge). The Publish section was removed from `MobileToolsMenu` again (its publish props dropped) — the Tools menu now holds only Playoffs + Generate. Reuses the lime `.publishButton` / `UnpublishControl`, both icon-collapsing via `.mobileIconButton`.
2. **Bracket actions (Build / Edit + Clear) live in the RIGHT action cluster**, not the left view group. In rev 3 they sat in the grown left group and **wrapped to a second line** in desktop Playoffs (3-option View toggle + 2 bracket buttons exceeded the row), orphaning them. They're now the lead of the right `align="end"` cluster: `[Edit][Clear] · [Publish/Unpublish] · [Auto]`, all right-aligned in one `nowrap` group. This matches the Round Robin look the owner approved (right-aligned action cluster) and removes both the mid-row gap and the wrapping. The left group reverts to just Division + Stage + View.

**Rationale:** Owner: "didn't want publish inside Tools on mobile — put it beside it"; and desktop Playoffs alignment "still off" because the bracket buttons had wrapped below. One coherent right-aligned action cluster in both stages is the consistent, non-wrapping answer; mobile keeps publish as a visible peer of Tools rather than buried a tap deep.

**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (`.scheduleMobilePublish` sibling, bracket `.bracketActions` moved into the right `ToolbarGroup`, `MobileToolsMenu` publish section removed again), `schedule-admin.module.css` (`.scheduleMobilePublish` show/hide + order, `.scheduleMobileTools` margin removed, `.bracketActions` mobile-hide dropped since it now lives in the mobile-hidden `.scheduleEndGroup`). Supersedes rev 3's "bracket actions in left group" and rev 1/rev 3's mobile-publish placement. Header `meta` status + "Published / · names hidden" wording (rev 2) still stand.

---

### 2026-06-15 — Schedule toolbar (rev 3): publish ACTION back in toolbar, bracket actions grouped left, mobile Tools = wrench-only

**Decision:** Final layout after browser testing rev 2. The split is now: **status = header meta (left, under subtitle)**; **action = toolbar Row 1**, not the header actions row.
1. **Publish/Unpublish ACTION moved back to the toolbar Row 1 right group** (with the Auto menu). The header actions row carries only Export + Add Game. The published *status* (dot + "Published" / "· names hidden") stays in the header `meta` slot from rev 2 — status and action are now in different rows, which is fine: status orients (left, under title), action sits with the other toolbar actions (right).
2. **Mobile: publish lives in the Tools menu again.** The desktop Row-1 group is `display:none` on mobile, so the Publish section was restored to `MobileToolsMenu` (sits next to search on Row 2). This reverses rev 1's "header-only / not in Tools" call — owner preferred publish next to Tools on mobile.
3. **Mobile Tools trigger = wrench icon only.** Dropped the "Tools" word from the `MobileToolsMenu` button (kept the chevron + `aria-label`/`title`) to save row space. The menu only renders on mobile, so this is mobile-only by construction.
4. **Bracket actions (Build / Edit + Clear) grouped with the view controls (left), not the right action group.** They're contextual to the playoff view; wrapped in a desktop-only `.bracketActions` flex group placed immediately after the View toggle. This removes the large empty gap that appeared in desktop Playoffs view — previously they sat in the right `align="end"` group and got stranded across the `space-between` gap from the grown left group. Mobile reaches bracket build/edit via the Tools menu's Playoffs section (unchanged); `.bracketActions` hides on mobile.

**Rationale:** Owner, after testing rev 2: wanted the publish action back with the toolbar button cluster (not header); the mobile Tools button label wasted space; and desktop Playoffs showed "a lot of empty space" between the view controls and the stranded Edit/Clear/Auto buttons. Grouping bracket actions with the view they belong to (left) collapses the gap and reads as a coherent cluster.

**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (toolbar Row 1 publish action, `.bracketActions` wrapper in left group, `MobileToolsMenu` publish section + wrench-only trigger restored), `schedule-admin.module.css` (`.bracketActions` + its mobile hide). Amends rev 2 (action is in the toolbar, not header actions) and rev 1 (publish IS in the mobile Tools menu). The header `meta` status (rev 2) and "Published / · names hidden" wording stand.

---

### 2026-06-15 — Schedule publish (rev 2): status moved to header meta (left), "Published / · names hidden" wording, full-width mobile stage toggle

**Decision:** Same-day follow-up after browser testing the rev-1 control (below). Three fixes:
1. **Status moved OUT of the actions row into the header `meta` slot** (`TournamentAdminHeader meta`, rendered in `.headerMeta` under the subtitle, left-aligned). It was sharing the actions row with the Export / Unpublish / Add Game buttons, where a height-less text span never aligned cleanly with the ~34–38px buttons. The actions row now carries **only the action** (Publish button when unpublished, `UnpublishControl` when published); status is pure orientation on the left. Fixes the desktop + mobile alignment complaint outright.
2. **Wording: drop "Teams".** Published status now reads **`● Published`** in the common (real-names) case, and **`● Published · names hidden`** only in `published_generic` mode (`.publishStatusFlag`, `--white-40`, lighter weight). "Teams" was unclear and only the matchups-hidden state actually warrants a flag. Full meaning stays in the `title` tooltip on both modes.
3. **Locked tournament:** actions render nothing (read-only); if published, status still shows in meta. The old locked "Not Published" pill in actions was removed.
4. **Mobile stage toggle is now full-width** on its own row (`.mobileStageToggle { flex: 1 1 100% }`, buttons `flex: 1 1 0`), and `.scheduleStartGroup` wraps with the division select at `flex: 1 1 100%`. Eliminates the dead space that sat to the right of the Round Robin/Playoffs toggle when it hugged its content width.

**Rationale:** User-reported after rev 1: status "looks like a button / takes too much space," misaligned with adjacent buttons on both breakpoints; "why Teams?"; empty space beside the mobile stage toggle. Putting status in the orientation layer (left, under title) and keeping only actions on the right is the clean separation the 2026-06-01 decision intended; the meta slot already exists for exactly this.

**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (`TournamentAdminHeader meta`, simplified `actions`), `schedule-admin.module.css` (`.publishStatusText` no longer flex-shrink-pinned, new `.publishStatusFlag`, retired `.publishGroup`, full-width `.mobileStageToggle`/`.mobileStageBtn`, `.scheduleStartGroup` wrap). Amends the rev-1 entry below: status lives in header meta (not the actions row), wording is "Published / · names hidden" (not "Published · Teams/Placeholder").

---

### 2026-06-15 — Schedule publish: dual-state header control, plain-text status, both stages, single mobile home

**Decision:** Reworked the schedule publish control into a single dual-state element in `TournamentAdminHeader.actions` (left of Export), shown in **both** Round Robin and Playoffs stages (publish is division-scoped — it covers the whole division's schedule, so hiding it in Playoffs was misleading):
1. **Unpublished → the control IS the action:** a lime `.publishButton` (Globe + "Publish"). On a locked tournament it falls back to the read-only `.publishStatusDraft` "Not Published" pill (no action).
2. **Published → plain text + leading dot, NO box** (`.publishStatusText` + `.publishStatusDot`): a 6px lime dot followed by neutral `--data-gray` uppercase "Published · Teams / · Placeholder", with the existing `UnpublishControl` chevron beside it. Mirrors the sidebar's `● Live / ● Open` indicators. Lime is carried only by the dot — the lime *fill/border* pill (`.publishStatus`) is retired for the published state so status never reads as a CTA next to real buttons.
3. **Visible on mobile.** The old `.publishStatus { display:none }` mobile rule left no published signal in the visible chrome (user couldn't tell if a division was published); `.publishStatusText` stays shown on mobile (slightly smaller), so state is always glanceable.
4. **Single action home on mobile.** Publish/Unpublish is header-only on every breakpoint. The **Publish section was removed from `MobileToolsMenu`** (and its now-dead props dropped) — that menu carries only Playoffs + Generate. No more two-paths-to-publish.
5. **Stage toggle de-duplicated.** The **Stage (Round Robin / Playoffs)** section was removed from the mobile view-settings bottom sheet; the always-visible on-screen `.mobileStageToggle` is the single home. Stage is the primary context switch, not passive view config (the sheet keeps View / Venue / Game Status).

**Rationale:** User-reported: published pill "looks like a button and takes up too much space" on desktop; "can't see if it's published or not" on mobile; publish appeared in both header and Tools menu; Stage toggle appeared twice. Confirms the standing "status = quiet orientation / action = lime button" hierarchy (dashboard metric-strip + 2026-06-01 publish-status decisions). Publish being division-scoped means it must appear in both stages.

**Supersedes / amends:** the 2026-06-01 "publish status moved to header" entry (status is now plain dot+text, not the lime `.publishStatus` pill, and is visible on mobile) and the 2026-06-01 "mobile Tools menu" entry's Publish section (publish is now header-only on mobile, not in the Tools menu — Generate/Playoffs remain).

**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (header dual-state control, `MobileToolsMenu` signature + body, bottom-sheet Stage removal), `schedule-admin.module.css` (`.publishStatusText`, `.publishStatusDot`, `.publishGroup`; mobile `.publishStatusText` override). Pattern for any future per-division publish control: dual-state header element, plain dot+text status, single action home across breakpoints.

---

### 2026-06-12 — Schedule toolbar: destructive "Clear Bracket" de-emphasized vs neutral "Auto" menu

**Decision:** In the Schedule admin toolbar's Row 1 right action group, the new **Clear Bracket** button (shown in Playoffs view once a bracket exists, beside the **Auto ▾** tools menu) drops `btn-ghost` and adopts a new recessive/tertiary treatment (`.clearBracketBtn` in `schedule-admin.module.css`): transparent fill + `var(--data-gray)` text/icon at rest, with a danger reveal on hover (`rgba(var(--danger-rgb),0.12)` bg, `0.3` border, `--danger` text). It keeps `btn-data` sizing **and a 1px transparent border** so its box height matches the bordered `.btn-ghost` Auto trigger exactly (a borderless button would render 2px shorter — `.btn` is `border:none`, `.btn-ghost` adds 1px). Double-class selector (`.clearBracketBtn.clearBracketBtn`) for specificity over the global `.btn`/`.btn-ghost`. Auto stays the neutral ghost pill, unchanged. Establishes a 3-tier action hierarchy in this cluster: **create = prominent** (Build Bracket `btn-lime`), **everyday tool = secondary** (Auto `btn-ghost`), **destroy = recessive** (Clear Bracket transparent→danger-on-hover).

**Rationale:** Adding Clear Bracket put two visually identical gray ghost pills side by side, giving a rare destructive "delete the whole bracket" action the same resting weight as the everyday Auto menu and letting them blur together. Pairs with the binding rule "status = label vs action = button" and the admin convention "btn-lime/ghost/danger/data only." Destructive, infrequently-used actions should recede at rest and only signal danger on intent (hover), not compete with neutral tools. Transparent border preserves height parity so the pair still reads as a clean, aligned group.

**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (Clear Bracket button className), `app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css` (`.clearBracketBtn`). Pattern is the standard for any future inline destructive action sitting beside a neutral peer in an admin toolbar cluster: recessive at rest, danger on hover, keep a transparent border for height parity.

---

### 2026-06-08 — Public registration form: de-duplicated header + inline payment panel (height reduction)

**Decision:** The public tournament registration form (`app/[orgSlug]/[tournamentSlug]/register/page.tsx` + `app/[orgSlug]/register/register.module.css`) was compacted to fit one screen:
1. **Removed the page-level `.public-page-header`** (eyebrow "Register" + h1 "Team Registration" + paragraph). Tournament identity is already carried by the shell's desktop top-context bar **and** the card `.formHeader` ("Register Your Team" + tournament sub-line — that sub-line stays, it's the only on-form identity at mobile widths). The removed paragraph's two claims (confirmation email; organizer-handled payment) are already stated in the payment panel + success screen, so no information is lost.
2. **Fee/deposit render as inline data rows, not boxed cards** (`.paymentDetails`): label (uppercase `--white-40`, fixed `5.5rem` min-width) · value (`--font-data` `1rem` `--white`) · due (`--white-50`); flex-column, no inner `border`/`background`/box padding. Direct application of the 2026-06-05 dashboard metric-strip decision — two numbers don't warrant bordered-box weight.
3. **Tightened chrome:** `.steps margin-bottom 2.5rem → 1.5rem`; `.formHeader margin-bottom 1.75rem → 1rem` + `padding-bottom 1.25rem → 0.85rem`; `.formIcon 48px → 40px`.
4. **Footer copy trimmed:** *"FieldLogicHQ records registration and payment status for the organizer, but payments are made outside the platform."* → *"Payments are made directly to the organizer, outside the platform."*

Net ≈230px recovered (fits a 1366×768 laptop viewport). **Field spacing deliberately left alone** — the bloat was redundant chrome, not the inputs. The green→amber→red availability bar is unchanged.

**Rationale:** The form announced the tournament/intent three times (shell top bar + page header + card header) before the first input, and the payment panel repeated the "heavy box for a small number" anti-pattern the dashboard already retired. User reported the form exceeded one viewport for very little information.

**Applies to:** `app/[orgSlug]/[tournamentSlug]/register/page.tsx`, `app/[orgSlug]/register/register.module.css`. Establishes: on transactional public forms inside the tournament shell, don't repeat the identity header the shell + card already provide; render small numeric summaries as inline data rows, not boxed cards.

---

### 2026-06-07 — Public bracket: mouse drag-to-pan + edge fades for horizontal scroll

**Decision:** `LogicSyncBracket` now wraps its SVG in a `BracketScroller` (in-file) instead of a bare `<div style={{ overflowX: 'auto' }}>`. It adds: (1) **mouse click-drag-to-pan** with a `grab`/`grabbing` cursor (pointer events, mouse-only via `e.pointerType === 'mouse'`; a >3px move sets pointer capture and a capture-phase click-swallow so a pan never reads as a tap); (2) **soft left/right edge fades** (`ScrollEdge`, `linear-gradient(... var(--surface) 88%)`) shown only when there's hidden content that way; (3) `overscroll-behavior-x: contain` + `scrollbar-width: thin`. A `ResizeObserver` on both the viewport and the inner content tracks overflow/scroll position. Touch/trackpad keep native momentum scrolling (drag-pan is mouse-only). The inner `width: fit-content; margin: 0 auto` (centers when it fits, left-aligns when it overflows) is preserved.

**Rationale:** On a tall double-elim fork the native horizontal scrollbar sits **below the fold** — unreachable without scrolling the whole page past the bracket — and a mouse wheel only scrolls vertically, so mouse users had no way to reach the Losers bracket / Grand Final (user-reported "can't scroll horizontally"). Nothing was clipping; the affordance was just undiscoverable. Drag-to-pan (Figma/Trello/maps pattern) + a visible edge fade makes the hidden content reachable and obvious without hijacking page scroll. Bracket nodes have no click/navigation behaviour, so drag-pan is safe.

**Applies to:** `components/bracket/LogicSyncBracket.tsx` (`BracketScroller`, `ScrollEdge`). The bracket renders only on public Schedule (Playoffs → Bracket) and Standings. Pattern is the standard for any future wide, scroll-region visualization.

---

### 2026-06-07 — Light mode: lift muted-text tokens (-40/-45/-50) for contrast on bright displays

**Decision:** In the tournament light-mode token override (`app/[orgSlug]/[tournamentSlug]/layout.tsx` `lightModeVars`), the mid muted-text tokens were darkened ~0.12: `--white-50` 0.5→0.62, `--white-45` 0.45→0.58, `--white-40` 0.4→0.52 (alpha of `#0F1123` on white). The brighter structural faints (`--white-35/-30/-10`, used for dividers/placeholders) are unchanged, as are the already-strong `--white-60`→`-90`. A literal alpha port of the dark scale washes out on white surfaces; these tokens drive secondary text (bracket round labels, dates, metadata) which was low-contrast (~3.6:1) on bright laptop panels.

**Rationale:** User on a new (bright/vivid) laptop reported the light theme "very bright and hard to read." Body text was already fine (near-black `--white: #0F1123` on white ≈ 18:1) — the genuine issue was washed-out *muted* text. This is a targeted contrast-floor lift, not a surface change: the raw glare of pure-white surfaces is a monitor-brightness matter (Night Light / lower brightness / the platform's dark-first default), deliberately not "fixed" by dimming surfaces. Scoped to light mode only (dark mode untouched). Pairs with the 2026-06-01 accent-contrast-floor decision.

**Applies to:** `app/[orgSlug]/[tournamentSlug]/layout.tsx` (`lightModeVars`). Any future light-mode token tuning lifts muted *text* alphas rather than dimming `--surface`/`--bg`.

---

### 2026-06-07 — Install app prompt: solid-primary Install button replaces blue→lime gradient

**Decision:** The `InstallAppPrompt` "Install" CTA (the dismissible add-to-home-screen banner on public/fan tournament pages) no longer uses the global `btn btn-primary btn-sm`, which rendered the banned `linear-gradient(135deg, var(--primary), var(--primary-light))` blue→lime gradient. It now uses a self-contained module class `.install`: **solid `var(--primary)` fill, `#FFFFFF` text, `box-shadow: 0 2px 8px rgba(var(--primary-rgb), 0.35)`**, uppercase `--font-data` (matching the banner's `.title` treatment), `var(--radius-sm)`. Hover = `color-mix(in srgb, var(--primary) 88%, #000 12%)` + slightly lifted shadow + `translateY(-1px)`. The class is fully self-contained (does not rely on `.btn`) so it can never inherit the global `.btn-primary` gradient regardless of whether `[data-color-mode]` is present on the surface.

**Rationale:** Same blue→lime gradient the user rejected on the schedule segmented toggles (2026-06-01). Violates the binding principle *"gradients on functional UI elements (decorative use only; never on buttons or form inputs)"* and the *"btn-primary is banned outside overlay modals"* audit rule. Solid `var(--primary)` is the established **public-page** primary-CTA convention and matches the banner's existing `border-top: 2px solid var(--primary)` accent, so the banner reads as one cohesive branded unit. Using `var(--primary)` (not lime) keeps the button branded per-tournament for Plus orgs with custom accents; the theming layer's accent contrast floor (2026-06-01 #4) keeps white-on-primary legible.

**Applies to:** `components/InstallAppPrompt.tsx`, `components/InstallAppPrompt.module.css` (`.install`). This is the fan-app/member-app install banner used on public tournament pages and authenticated shells. Any future install/PWA prompt CTA follows the same solid-primary pattern.

---

### 2026-06-05 — Dashboard: metric strip replaces stat cards; game-day board is card-free

**Decision:** The four stat cards (Teams / Scheduled / Completed / Days Away) are replaced by:
1. **A compact inline metric strip** (`renderMetricStrip`) on active pre/post-event and completed states: lime tabular numerals + tiny uppercase labels, separated by faint mid-dots, underscored by a single blueprint hairline. Pre-event: Teams · Scheduled · Days Away (hidden when ≤0). Completed: Teams · Scheduled · Completed.
2. **No strip at all on game day** (`isGameDay`). The game-day board (Games Progress, Team Check-in, Schedule Health, By Division) provides full operational context — a stat strip would be redundant noise.
3. The Customize button is gated to `(isActive && !isGameDay) || isCompleted` — hidden entirely on game day (nothing to customize in the fixed game-day layout).
4. **7-day registration sparkline** added to the Registration panel header (72×22px SVG polyline, lime stroke, no library). Derived from existing `acceptedTeams.registered_at` in the dashboard API — no additional DB query. Only renders when at least one non-zero day exists. Hidden ≤640px.

**Rationale:** Three large card boxes for three numbers was a disproportionately heavy container — ~130px of vertical space for minimal information. Game-day operators need the board immediately on load; pre-event admins need the registration and payment panels; the metric strip gives orientation context in one line. The sparkline adds trend intelligence that a raw count doesn't provide, answering "is registration picking up or stalling?"

**Applies to:** `app/[orgSlug]/admin/tournaments/dashboard/page.tsx`, `dashboard.module.css`, `app/api/admin/tournament-dashboard/route.ts`. Stat card drag/sort/icon code left in place (panel zone customization still uses the same `isCustomizing` flow).

---

### 2026-06-05 — Shared admin chrome: density toggle removed from UI; sidebar LIVE indicator uses `isWithinEventDates`

**Decision:** (1) **Density toggle removed** from both the desktop sidebar footer and the mobile More sheet "Display" section. The auto-detection (`pointer: coarse` → comfortable default on touch, compact on desktop) does the right thing for most users; exposing a manual override produced a toggle whose effect was imperceptible (8px row height, 10px control height) and confused users who clicked it and saw nothing obvious change. The density tokens and `useAdminDensity` context remain — auto-detection still fires — only the two UI toggle blocks were removed. (2) **Sidebar "● Live" now gated on `isWithinEventDates()`** — previously any `status === 'active'` tournament showed "● Live" in the sidebar even if it was 40 days away. Now: within dates → "● Live"; active but pre-event → "● Open"; draft/completed/archived unchanged. Matches the resolved-phase logic the mobile top app-bar already used.

**Rationale:** The density toggle was discovered to be "barely noticeable" in browser testing — a toggle that produces no perceived change has negative UX value (confusion > benefit). The LIVE sidebar mislabel was flagged visually: "Battle of the Bats 2026" (40 days out) showed LIVE alongside "Live Demo — Game Day" (actually live today) — identical labels for different states.

**Applies to:** `components/admin/AdminSidebar.tsx`, `components/admin/AdminBottomNav.tsx` (Display section removed, `useAdminDensity` import removed from both). `AdminSidebar.tsx` now imports `isWithinEventDates` from `@/lib/tournament-phase`.

---

### 2026-06-05 — Dashboard mobile: in-header status chip removed; Customize button hidden on mobile

**Decision:** The `.statusChipMobile` block (status dot + colored status text + sub-label row, mobile-only, rendered in the page header below the tournament name) was removed from the dashboard JSX. The mobile top app-bar pill (`AdminMobileTopBar`) already communicates the phase; the in-header chip duplicated it with a different label ("PRE-EVENT" vs "OPEN") creating both redundancy and inconsistency. The `statusBlockDesktop` hide breakpoint was extended from `max-width: 640px` to `max-width: 900px` to match the full shell mobile threshold (both representations were showing between 641–900px). The Customize button is now `display: none` at ≤900px — on mobile the Customize action is deprioritized (game-day operators, the primary mobile use case, should reach operational content without navigating edit mode).

**Rationale:** Two status indicators on the same screen with different labels is worse than one. The Customize button on mobile game day was occupying ~36px of precious above-fold space for an admin utility that mobile operators don't need mid-event.

**Applies to:** `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` (statusChipMobile JSX removed), `dashboard.module.css` (new `max-width: 900px` block).

---

---

### 2026-06-03 — Venue/facility select: full label in closed state
**Decision:** Facility `<option>` elements inside a venue `<optgroup>` must include the parent venue name in their text: `{venue.name} — {facility.name}` (e.g. "Milton Diamond — diamond #1"). The `<optgroup label>` is invisible when the `<select>` is closed; facility names alone (e.g. "diamond #1") are not self-identifying. When open, the optgroup still groups by venue name — minor redundancy, standard grouped-select pattern.
**Rationale:** User-reported: "diamond #1" with no venue name is not specific enough and wastes the available width.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx` venue/facility select. Apply the same pattern to any other grouped facility selects added in future (Generator date-slot venue select, if it ever becomes a `<select>` instead of checkboxes).

---

### 2026-06-02 - Tournament admin export placement: header actions

**Decision:** Page-level tournament admin exports belong in `TournamentAdminHeader.actions`, immediately to the left of the primary add/create button when one exists. Applied to Teams, Schedule, Results, and already-matching Venues. Toolbars should retain context selectors, filters, publish/generate tools, mobile action overflow, and multi-select controls, but not the main page export dropdown.

**Rationale:** Exports are page-level utilities, not view/filter controls. Keeping them in the header creates a consistent scan path across Teams, Schedule, Results, and Venues, and avoids each page placing Export in a different toolbar cluster. On mobile, the shared `ExportMenu` already collapses to icon-only, so Schedule no longer needs a duplicate Export section inside `MobileToolsMenu`.

**Supersedes:** The 2026-06-01 Schedule toolbar mobile decision that placed Export inside the mobile Tools menu, and older Results reformat notes that moved Export into the toolbar.

---

### 2026-06-02 — Schedule Generator: full density + compliance overhaul

**Decision:** Applied comprehensive design system alignment to the Schedule Generator modal (`Generator.tsx` + `schedule-admin.module.css`):

1. **Modal header** — `.generatorHeader h3` changed from `1.25rem sans-serif` to `font-data 0.82rem 800 uppercase letter-spacing:0.08em`, matching the binding `.modal-header h3` HUD standard.
2. **Mode toggle** — replaced `btn btn-sm btn-primary / btn-ghost` pair with a `.generatorSegmented` control: `border: 1px solid blueprint-blue`, no-gap inline buttons, active state = `var(--primary)` solid fill + `#fff` text. (`btn-primary` outside a modal is banned by prior decision.)
3. **Date slot rows** — stripped the double-boxed card structure (container `1rem padding bg-2` + per-row `0.75rem border card`). New layout: `.dateSlotList` = a bordered wrapper with no internal padding; `.dateSlotRow` = a flat 5-column grid (`1fr auto auto auto auto`) at `0.35rem 0.6rem` padding. Inputs (`.dateSlotSelect`, `.dateSlotTime`) are 28px compact, same visual weight as the inline edit form. Separator is `–` plain text not a full-width center div.
4. **Priority limits** — replaced two `.priorityField` card-boxed inputs with a `.limitsRow` inline row: `MAX / DAY [52] per team  ·  MIN REST [60] min between games`. Inputs are 52px wide, `font-data 0.82rem 700`. No cards, no labels inside boxes.
5. **Preference checkboxes** — replaced `.priorityCheck` card cells (border + bg + `min-height:100%` stretch) with `.prefChecks` + `.prefCheck`: a flex-wrap row of simple inline `[☑] label` pairs. No boxes, no borders, no height matching. Effort select moved to a compact `.effortRow` with an inline hint.
6. **Number inputs** — `gamesPerTeam`, `gameLength`, `breakLength` now use `.compactNumberInput` (`max-width: 80px; text-align: center`) so 1–3 digit values don't span half the modal width.
7. **Generate button** — changed from `btn btn-primary btn-lg` (two violations: btn-primary banned outside modals; btn-lg not admin standard) to `btn btn-lime btn-data` + `.generateBtn` (full-width, `min-height: 34px`).
8. **Mobile overlay** — at ≤540px the generator becomes a bottom sheet: `padding:0; align-items:flex-end`; modal gets `border-radius: 12px 12px 0 0; max-height:93vh`. At ≤680px overlay padding reduces to 1rem.

**Rationale:** The generator violated five separate binding design decisions simultaneously. The date slot double-boxing wasted ~120px of vertical space per row. The preference checkbox cards grew to match the Effort select height, making three simple toggles look like a decision matrix. btn-primary + btn-lg on the generate button were both violations; the lime data button is both brand-correct and proportional to the form.

**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/Generator.tsx`, `schedule-admin.module.css` (new classes: `.generatorSegmented`, `.generatorSegBtn`, `.generatorSegBtnActive`, `.dateSlotList`, `.dateSlotRow`, `.dateSlotSelect`, `.dateSlotTime`, `.dateSlotSep`, `.dateSlotDel`, `.compactNumberInput`, `.limitsRow`, `.limitItem`, `.limitLabel`, `.limitInput`, `.limitUnit`, `.effortRow`, `.effortHint`, `.prefChecks`, `.prefCheck`, `.generateBtn`). Pattern is binding for any future generator-style wizard modal.

---

### 2026-06-02 — Team names reflow (2-line wrap) instead of truncating in matchup rows

**Decision:** Long team names (30+ chars) must never be cut off with an ellipsis where games/teams are listed. The fix pattern, applied everywhere a matchup or score pair renders:
1. **Reflow, don't split rigidly.** The two sides of a matchup use `flex: 0 1 auto` (admin) / drop `flex: 1` (public) inside a `justify-content: center` matchup cell, so a long name borrows the slack a short opponent isn't using and the pair stays anchored around the centred "VS".
2. **Wrap to 2 lines, never truncate.** Team-name elements use the venue-cell clamp pattern — `overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.2–1.25` — replacing `white-space: nowrap; text-overflow: ellipsis`. A name reflows to a second line (row grows only for that row) rather than hiding characters.
3. **`title` tooltip safety net** on the dense admin/public schedule matchup names for the rare >2-line case.
Page width kept at 1100px (no widening) — reflow handles it within the existing layout.

**Rationale:** Equal `flex: 1` halves truncated a long name even when its opponent was short and there was free space (the "Halton Hawks U11 Jr (…" screenshot). Truncation also violates the principle *"never hide critical admin data — reflow, stack, or scroll instead."* Two 30-char names can't co-exist on one line at any realistic matchup-column width, so wrapping is the only thing that guarantees the 30-char requirement. Standings `.teamCell` and the public Teams card already wrapped — this brings the matchup/score surfaces in line.

**Applies to:** `schedule/components/GameList.tsx` (planning + scoring matchup — admin Schedule AND admin Results, which reuses GameList) + `schedule-admin.module.css` (`.planningTeamAway/.planningTeamHome` base rules, new `.scoringTeamName`); public `schedule.module.css` (`.matchSide`, `.matchTeam`) + `ScheduleContent.tsx` (title attrs); `standings.module.css` (`.scoreTeamName`) and legacy `results.module.css` (`.scoreName`); `teams-admin.module.css` (`.registrationNameCell` hardened with `overflow-wrap: anywhere`). Pattern is binding for any future matchup/score-pair rendering.

---

### 2026-06-01 — Rules admin mobile: data-density pass (cards + section headers)

**Decision:** Comprehensive mobile tightening of `RulesAdmin.tsx` at `≤720px`:
- **Section header**: row layout (no column flip), `border-bottom: none`, `padding-bottom: 0.15rem`, `gap: 0.35rem` to first card — eliminates the visual dead-zone the border + gap created.
- **Section title**: demoted to `0.62rem --font-data uppercase white-30` — reads as a quiet label, not a structural heading.
- **Card title**: switched from `--font-display 1rem 800` to `--font-data 0.82rem 700` on mobile — matches the operational data-density scale used across all other admin list pages.
- **Card header padding**: `0.85rem → 0.5rem 0.65rem`, `align-items: flex-start → center`.
- **Rule items list**: padding `0.85rem → 0.45rem 0.65rem`, gap `0.4rem → 0.2rem`.
- **Textarea font**: `0.9rem → 0.82rem`, `line-height: 1.5 → 1.45`.
- **Applies-to row**: padding `0.5rem 0.85rem → 0.3rem 0.65rem`, label font `0.8rem → 0.75rem`.
- **Section save bar**: padding `0.75rem 1.25rem → 0.5rem 0.65rem`.
- **Rules stack gap**: `1.5rem → 0.65rem` between cards.
- **Section-to-section gap**: `2.5rem → 1.75rem`.
**Rationale:** The page needs to show rule point text efficiently — a tournament may have 5–10 sections with multiple points each. The `--font-display` card title and generous padding were inherited from a desktop-first edit flow; mobile is a review/scan context where data density is the priority.
**Applies to:** `RulesAdmin.tsx` inline `<style jsx global>` `@media (max-width: 720px)` block.

---

### 2026-06-01 — Divisions: flat-row table matching Schedule/Results/Teams pattern

**Decision:** Replaced the card-flip responsive table with the standard admin flat-row pattern used by all other admin list pages:
1. **`mobileActionsInline={true}`** added to `TournamentAdminHeader` + local CSS `flex-wrap: nowrap` override at ≤760px forces the "+" button to stay on the same line as the "DIVISIONS" title. Previously the flex-wrap caused the button to orphan on its own row below the header.
2. **Flat-row table with column hiding** replaces the card-flip system. Five columns: Division / Age Range / Teams / Pools / Status / Actions. Pools hides at ≤768px; Age Range and Teams hide at ≤640px. Actions (edit + delete icon buttons) are always visible in a right-aligned `.rowActions` flex cluster.
3. **`.divisionMeta` sub-line** inside the Division cell shows age range + team count at ≤640px only (compensates for the two hidden columns), rendered in `--white-40 0.68rem font-data` beneath the `badge-primary` name. No data is lost on mobile — it's just compacted.
4. **Previous card-flip CSS removed** — no more `@media (max-width: 720px)` card block in `admin-page.module.css`.
**Rationale:** Cards were inconsistent with every other admin list page; the flat-row + column-hiding pattern is the established platform standard. The orphaned "+" button was a layout bug from the un-gated `flex-wrap` on the header.
**Applies to:** `app/[orgSlug]/admin/tournaments/divisions/admin-page.module.css`, `app/[orgSlug]/admin/tournaments/divisions/page.tsx`.

---

### 2026-06-01 — Divisions mobile: card layout remediation

**Decision:** Six mobile-specific fixes applied to the Divisions admin page:
1. **Removed `max-width: 900px`** from `.page` — enforces the global "no page-level max-width in admin shell" rule.
2. **Fixed undefined CSS tokens** — `var(--bg-surface)` → `rgba(255,255,255,0.02)`, `var(--border-subtle)` → `var(--border-2)`, `var(--text-tertiary)` → `var(--white-40)`. All three were undefined in the design system.
3. **Division name as card title** — on mobile, the `badge-primary` chrome (border, background, padding) is stripped; the name renders at `0.95rem var(--logic-lime) font-weight:700` as a full-width card heading with no label column (`grid-template-columns: 1fr`). Matches the pattern of treating the first data row as a card title rather than a styled badge.
4. **Action buttons moved to top-right corner** — `td[data-label="Actions"]` is `position: absolute; top: 0.85rem; right: 0.85rem` on mobile; the `tr` is `position: relative`. The "ACTIONS" pseudo-label is suppressed. Each button is a 36×36px square icon (`flex: none; padding: 0`). The `tr` has `padding-right: 5.75rem` to keep card content from sliding under the buttons. Status row gets explicit `border-bottom: 0` since it's now the visually last row in flow.
5. **Add Division collapses to icon-only on mobile** — below 760px, a `.addDivisionLabel` span is hidden and the button shrinks to 32×32px, matching the `addTeamButton` / `addGameButton` pattern on Registrations and Schedule.
6. **"No pools" muted color** — `var(--white-20)` → `var(--white-30)` for minimum readable contrast on the dark card surface.
**Rationale:** Three undefined tokens were causing unpredictable rendering. The full-text Add button and the ACTIONS row were inconsistent with all other admin mobile pages. The absolute-positioned action buttons eliminate a ~50px wasted row at the bottom of every card.
**Applies to:** `app/[orgSlug]/admin/tournaments/divisions/admin-page.module.css`, `app/[orgSlug]/admin/tournaments/divisions/page.tsx`.

---

### 2026-06-01 — Public schedule: "matchups TBA" notice for placeholder-published divisions

**Decision:** When a division's `scheduleVisibility === 'published_generic'` (published with placeholder/TBD names — times, fields, and scores are real but matchups are withheld), the public schedule shows an **info-tinted notice** above the games: *"Game times and locations are set — matchups will be announced soon."* (`.tbaNotice`, `Info` icon, `rgba(--info-rgb,…)` border/bg matching the "scheduled" status-strip colour). This sets expectations so a TBD grid isn't mistaken for a finalized schedule.
**Rationale:** Owner raised that TBD games could give a false sense of a settled schedule. Truly `unpublished` divisions already show **no games** (existing empty state) — so the only gap was the deliberate `published_generic` state, which had no signal that names/matchups were still pending. A notice is preferred over hiding the grid because the times/fields ARE committed and useful (teams know when/where to show up); the org controls full secrecy by keeping a division `unpublished`. Confirms the three-state model: unpublished = nothing public; generic = committed grid + TBA notice, names withheld; teams = full names.
**Applies to:** `components/public/ScheduleContent.tsx` (notice above main content, gated on `activeVisibility === 'published_generic'`), `app/[orgSlug]/schedule/schedule.module.css` (`.tbaNotice`).

---

### 2026-06-01 — Public schedule: drop ICS export, always-on team search, no TBD in team filters

**Decision:** (1) **Removed the iCal/Calendar export** from the public schedule controls — `handleExportICS`, the `Calendar`/`Team Calendar` button (`.calendarButton`), and the `@/lib/export` import are gone. (2) **Team search is now always available** when the division is published — the gate dropped from `activeVisibility !== 'published_generic' && !== 'unpublished'` to just `!== 'unpublished'`. (3) **Team filters (search + "My Team Games") never surface unresolved "TBD" matchups.** `teamFiltered` now matches on the *displayed* names via `getTeamDisplay` (not the hidden underlying `team.name`), excludes any game where both slots display `TBD`, and for the followed-team path returns true only when the followed team's own slot resolves to a real (non-TBD) name. The old loose `homePlaceholder/awayPlaceholder` substring matching was dropped (placeholders already flow through `getTeamDisplay`).
**Rationale:** Owner removed the calendar export and wanted a visible team search + "My Team Games" that doesn't list placeholder/TBD games. **Consequence (by design):** in `published_generic` ("placeholder names") mode every slot displays `TBD`, so name search and "My Team Games" return nothing — you can't filter a team by name when the org has chosen to hide names. The filters become meaningful once a division is published with real team names (`published_teams`). Flagged to owner.
**Applies to:** `components/public/ScheduleContent.tsx` (`teamFiltered`, controls block, imports). `.calendarButton` CSS now unused (left in place).

---

### 2026-06-01 — Results scoring rows: date · time on one line (match planning mode)
**Decision:** In `GameList.tsx`, the scoring-mode (Results) date cell now renders **`{date} · {time}` as two inline spans in a single `white-space: nowrap` div**, identical in structure to planning mode (Schedule). Previously it stacked the time in a separate block `<div>` under the date, so on mobile the row read "Jul 15" / "2:00 PM" on two lines — out of step with the Schedule rows ("Jul 15 · 9:00 AM"). The mobile status sub-line (`.scoringMobileStatus`: ✓ FINAL / ⚠ REVIEWING / SCHEDULED) stays below the date·time line; `.scoringDateCell` is now `flex-direction: column; gap: 0.12rem` on mobile to mirror `.planningDateCell`'s spacing. Applies to both desktop and mobile (the 130px desktop date column fits the inline format; planning already proved this).
**Rationale:** User flagged the Results mobile rows looked "messed up" vs Schedule — the stacked date/time was the cause. Scoring and planning rows share `GameList` and should present date/time identically; the only legitimate difference between the two modes is the score inputs / status semantics, not the date format.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx` (scoring date cell), `schedule-admin.module.css` (`.scoringDateCell` ≤768px). Mirrors the planning-mode date cell.

---

### 2026-06-01 — Public schedule: adopt admin flat-row layout (SUPERSEDES "tightened cards, not a list")

**Decision:** After seeing both rendered, the owner chose the admin schedule/results **flat row** over the card treatment. This **overrides** the earlier same-day "tightened card rows (density), not a list" decision — the public schedule is now a list, matching the admin `GameList` anatomy. Row structure (desktop grid `76px 188px 1fr 116px`): **left status color-strip → time → location → matchup → status**. Specifics:
- **Status color-strip** = `border-left: 3px solid` keyed off `data-status`, same mapping as admin: scheduled `rgba(--info-rgb,0.5)`, submitted `rgba(--warning-rgb,0.55)`, completed `rgba(--success-rgb,0.5)`, cancelled `rgba(--danger-rgb,0.55)`.
- **Time** only (date lives in the date-group header), `--font-data`.
- **Location** via `LocationLink`.
- **Matchup** = `[awayScore] awayTeam  VS  homeTeam [homeScore]` — away on the left, home on the right (per owner spec), team names `--font-data`, scores shown only when present and colored by outcome (win `--success` / tie `--warning` / loss `rgba(--danger-rgb,0.7)`). **W/L/T letters dropped** — colour alone conveys outcome.
- **Status** = `Final`/`Pending`/`Cancelled` badge (none for scheduled), plus a small lime follow-star and any playoff bracket badge.
- Rows are **flat** (no `.card`): `border-bottom: 1px solid var(--border-2)`, `min-height: 2.85rem`, hover = `--white-03` bg (no translateX). Followed game = `rgba(--primary-rgb,0.07)` row tint. Mobile (≤768px) uses `grid-template-areas` so time/status flank a stacked matchup-over-location.
**Rationale:** Owner found the flat admin row "cleanest" once both were live. Consistency between admin and public schedule reduces cognitive load and reuses the established status-strip + matchup language.
**Applies to:** `components/public/ScheduleContent.tsx` (`renderGameCard`), `app/[orgSlug]/schedule/schedule.module.css` (`.gameRow` + `.timeCell/.locationCell/.matchupCell/.matchSide/.matchTeam/.matchScore/.matchVs/.statusCell/.followStar`). Mirrors `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx`. The earlier card-density entry and the `.scoreChip/.outcomeLetter/.teams/.teamA/.teamB/.vsChip` classes are now obsolete (left in CSS, unused).

---

### 2026-06-01 — Public schedule rows: removed per-row clock icon + even single-line rhythm

**Decision:** (1) **Clock icon removed** from `.gameTime` (`<Clock>` and its lucide import). It was decorative and rendered inconsistently — on two-digit-hour times ("10:00 AM") the 80px time grid track + no `flex-shrink:0` caused flexbox to collapse the SVG to ~0 width, so it appeared as a "dot" on some rows and vanished on others. Time text stands alone (admin results has no per-row clock either). (2) **Score chip flattened to a single row** — `.scoreChip` `flex-direction: column → row` so the FINAL/Pending badge sits inline beside the numbers instead of stacked above them; this makes scored rows the same height as unscored "VS" rows (the stacked badge was the real cause of uneven vertical rhythm, not padding). (3) **`.gameRow` gets `min-height: 2.75rem`** (and padding `0.45rem → 0.4rem`) for a steady ~44px row baseline + comfortable tap target. (4) **Matchup cap `max-width: 520px → 480px`** to group the team names a touch tighter.
**Rationale:** The "can we do better with spacing" complaint was really row-height unevenness from the stacked score badge; flattening it + a min-height baseline gives even rhythm. The "dot on some times" was the clock icon clipping — removed rather than patched since it's decorative and off-pattern with admin.
**Applies to:** `components/public/ScheduleContent.tsx` (`renderGameCard`, lucide import), `app/[orgSlug]/schedule/schedule.module.css` (`.gameRow`, `.scoreChip`, `.teams`).

---

### 2026-06-01 — Schedule toolbar mobile: Publish/Auto/Export collapse into one "Tools" menu
**Decision:** On mobile (`≤760px`) the three Row-1 action controls — Publish/Unpublish (incl. the split "all published" option), the Auto/Generate menu, and the Export menu — are hidden (`.scheduleEndGroup { display: none }`) and replaced by a single **`Tools ▾`** dropdown (`MobileToolsMenu`, local to `schedule/page.tsx`) rendered on **Row 2, right of the search field**. The menu has three labelled sections — **Publish · Generate · Export** — each item wired to the same handlers the desktop controls use (no duplicated behaviour or new endpoints). Plan gating is preserved: locked Generate/PDF items show a `Lock` glyph + upgrade tooltip; the publish section mirrors desktop (Publish when unpublished; Unpublish this division / Unpublish all (N) when published, gated to round-robin view). With the action cluster gone from Row 1, the **division selector now reclaims the full first row** on mobile (it was previously squished sharing the row with three fixed-width buttons). Search drops from `flex: 1 1 100%` to `flex: 1 1 auto` so the Tools button sits beside it. Desktop is unchanged — the three separate controls remain.
**Rationale:** The division `<select>` is the primary context control on this page; on a ~380px screen it was getting only `viewport − (3 buttons)` ≈ 180px and truncating long division names. Add Game (the top CTA) already lives in the header, so Publish/Auto/Export are all secondary on mobile and don't each need a visible button — a single overflow menu is the correct mobile pattern. Kept distinct from the existing view-settings bottom sheet (Stage/Grouping/Venue/Status), which is for passive view config; actions and view-settings stay separate surfaces. Establishes: when a dense admin toolbar's action cluster crowds the primary control on mobile, collapse the actions into one labelled Tools menu rather than shrinking the primary control.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (`MobileToolsMenu`), `schedule-admin.module.css` (`.scheduleMobileTools`, `.scheduleEndGroup`/`.scheduleSearch` ≤760px).

---

### 2026-06-01 — Public schedule scores: color-coded W/L/T, no trophy (match admin results)

**Decision:** The public schedule's scored-game rows drop the trophy icon and loser-dimming in favour of the admin results color model. Each score is flanked by a **W/L/T letter**, and both the letter and score are coloured by outcome: **win `var(--success)`**, **tie `var(--warning)`**, **loss `rgba(var(--danger-rgb), 0.65)`** (muted red). Team names stay neutral white (no dim, no trophy). Layout: `[W/L/T] [homeScore] – [awayScore] [W/L/T]` inside the existing centered score chip, with the FINAL/Pending badge above. New `.outcomeLetter` class (`font-data`, 900, 0.82rem); colours applied inline per game. The old `.winTeam/.loseTeam/.scoreWin/.winIcon` classes are now unused (left in CSS, harmless).
**Rationale:** User asked the public results to read like the admin results page (`GameList` scoring rows), which uses exactly these semantic colours + W/L/T letters. Color-coding communicates outcome faster than a trophy and is consistent across admin + public.
**Applies to:** `components/public/ScheduleContent.tsx` (`renderGameCard` scored branch), `app/[orgSlug]/schedule/schedule.module.css` (`.outcomeLetter`). Mirrors `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx` scoring rows. Standings' 1st-place trophy is a leader indicator (different semantic) and was left unchanged.

---

### 2026-06-01 — Public schedule: tightened card rows (density), not a list

**Decision:** The public schedule keeps its **card-row** layout but is compacted — a stacked/striped "list" was explicitly rejected. Rationale: public pages are consumer surfaces (parents/coaches) and must stay on the card visual language used across the rest of the public site; a dense list reads as an admin tool, its density win is mostly desktop-only (mobile columns collapse anyway), and it would force rework of the score chip / "My Team" highlight / winner + cancelled treatments. Compaction in `schedule.module.css`: `.gameRow` padding `0.625rem 1.25rem → 0.45rem 1rem`, gap `1.5rem → 1rem`; `.gamesList` gap `0.75rem → 0.5rem`; `.dateGroup` margin-bottom `1.75rem → 1.25rem`; `.dateLabel` margin/padding `1rem/0.5rem → 0.65rem/0.4rem`; and the key fix — **`.teams` is capped to `max-width: 520px; margin: 0 auto`** so the matchup groups in the center instead of spreading to the row's far edges (the wide dead zone on desktop). Net ≈2× games per screen. Search (team/coach) + Follow My Team remain the per-user scroll reducers; the team search only renders when a division is published with real names (generic/"placeholder" mode has nothing to filter).
**Rationale:** Solves the "rows too big / too much scrolling" complaint while preserving consumer brand feel, touch ergonomics, and existing badge/score/highlight styling at low regression risk.
**Applies to:** `app/[orgSlug]/schedule/schedule.module.css` (`.gameRow`, `.gamesList`, `.teams`, `.dateGroup`, `.dateLabel`). Any future public schedule density work stays card-based, not list-based.

---

### 2026-06-01 — Schedule Unpublish: split-button with "All published (N)" bulk option
**Decision:** The toolbar Unpublish control is now a split button (`UnpublishControl`, local to `schedule/page.tsx`, mirroring the `ScheduleToolsMenu` dropdown pattern). When exactly **one** division is live it stays a plain `Unpublish` button (direct action, unchanged). When **2+** divisions are live it becomes `Unpublish ▾`, opening a menu with **"This division"** (current division name as sub-label) and **"All published (N)"**. Bulk unpublish (`handleUnpublishAll`) loops the existing per-division `set-visibility` API (no new endpoint) and confirms via `FeedbackModal` with an `items` list of the affected division names. The page's `feedback` state type gained an `items?` field to support that list.
**Rationale:** Publishing is already a bulk operation (the Publish modal multi-selects divisions), but Unpublish was single-division only — an asymmetry that forced N round-trips to pull a multi-division tournament off the public page. Unpublish has no options (no name-mode/notify) and is reversible, so a full multi-select modal would be overkill; the split button adds the bulk path exactly where the per-division action already lives and self-hides when only one division is live (≤1 published → no dropdown). Establishes: paired publish/unpublish actions should have symmetric bulk capability; a split-button menu is the chosen pattern for "this one vs all" on a toolbar action.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (`UnpublishControl`, `handleUnpublishAll`, `feedback` state).

---

### 2026-06-01 — Public tournament pages: mobile remediation direction (from deep design review)

Four owner-confirmed decisions from the public-pages design evaluation. These govern the remediation work; see `docs/projects/active/PUBLIC_TOURNAMENT_MOBILE_POLISH_PLAN.md`.

1. **Home page is state-dependent.** Before the event (`status !== 'active'`) the home page may keep a hero/landing treatment; once the tournament is **live/active** it must lead with data (today's / next games) and the oversized `display-xl` + `min-height: 100vh` hero must collapse on mobile. The marketing hero is a pre-event affordance, not a game-day one. Aligns the home page with the 2026-06-01 sub-page header-compaction decision (which called `display-lg`/hero sizing "inappropriate for operational lookup pages").
2. **Standings stays a TABLE on mobile — no card layout.** Cards were tried and abandoned in past sessions for consuming too much vertical space on mobile; this is now binding for standings. The mobile fix: retain `<table>`, add a compact `≤640px` breakpoint (reduced cell padding/font), keep the **Team column frozen left**, and **freeze the PTS column right** (two sticky anchors) so the two numbers that matter — team and points — are always visible while W/L/T/RF/RA/RD scroll between them. Do NOT replace the table with stacked cards.
3. **Schedule auto-scrolls to "today" on load** (all users, not only followed-team users), so the core game-day job is a glance, not scroll-and-hunt. The existing `.todayGroup` highlight stays.
4. **Enforce a contrast floor on custom org accents.** Rather than expecting Tournament Plus customers to understand WCAG ratios, the platform guards accent luminance so a poorly-chosen custom `--primary` / `--primary-light` can't render as low-contrast (brand-damaging) text on light or dark surfaces. Implemented in the theming layer (`lib/themes.ts` / light-mode token overrides), not left to the customer.

**Applies to:** `components/public/{TournamentHomeContent,StandingsContent,ScheduleContent}.tsx`, `app/[orgSlug]/{Home,standings,schedule}/*.module.css`, `app/globals.css` (`.empty-state` contrast), `lib/themes.ts`, `app/[orgSlug]/[tournamentSlug]/layout.tsx` (light-mode vars).

---

### 2026-06-01 — Schedule publish status: moved to header, renamed "Live · Generic" → "Published · Placeholder"
**Decision:** The per-division publish-status pill (`.publishStatus`) was removed from the schedule toolbar's Row 1 action group and moved into the page header `actions`, positioned **left of the Add Game button**. The toolbar retains only the Publish/Unpublish *button* (the action); the read-only status no longer sits among the view/action controls. Wording changed from `Live · Teams` / `Live · Generic` to **`Published · Teams`** / **`Published · Placeholder`**: (1) "Placeholder" matches the publish modal's own "Placeholder names" radio option, eliminating the unexplained "Generic" term; (2) "Published" (not "Live") avoids semantic collision with the sidebar's tournament-level `● LIVE` activation dot, which means a different thing. The pill stays `display:none` below the mobile breakpoint as before.

**Unpublished state added (same session):** The header now also reports the unpublished state with a muted neutral pill — **`Not Published`** (EyeOff icon, `.publishStatusDraft`: `--border-2` border, `--white-5` bg, `--data-gray` text). Lime stays reserved for the live "Published" states; the resting/default state must read quiet, not as an alert. The pill is suppressed when no single division is selected (`filterGroup === ''` / "All Divisions") since there's no single publish state to report. Net model: header always names the selected division's state (Not Published / Published · Placeholder / Published · Teams); toolbar carries only the matching action (Publish / Unpublish).
**Rationale:** A read-only status rendered in lime (`--logic-lime`, the reserved CTA colour) inside a row of clickable controls inverted the visual hierarchy and pulled the eye to a non-actionable element. Status belongs in the header (orientation layer); actions belong in the toolbar. "Generic" was undocumented anywhere else in the UI and confused the user. Establishes: status displays move to the header; only actions live in the toolbar; status wording must match the dialog that produces the state.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx` (`TournamentAdminHeader` actions + Row 1 publish group).

---

### 2026-06-01 — Schedule segmented toggles: solid primary fill replaces blue→lime gradient

**Decision:** The `.segmentActive` state (Pool Play/Playoffs, List/Bracket) no longer uses `linear-gradient(135deg, var(--primary), var(--primary-light))` + `var(--glow-sm)` + `var(--bg)` text. It now matches the established public-page `[data-color-mode] .btn-primary` convention: **solid `var(--primary)` fill, `#FFFFFF` text, tight `box-shadow: 0 2px 8px rgba(var(--primary-rgb), 0.35)`**. Supporting changes in `schedule.module.css`: container `.segmentedControl` bg `--white-10` → `--white-5` + `1px solid var(--border-2)` for a defined edge; inactive `.segmentButton` text `--white-60` → `--white-70` with a new `:hover` (`--white` text + `--white-5` bg); removed the obsolete mobile `box-shadow: none` override.
**Rationale:** The diagonal blue→lime gradient read as muddy/faded (user-reported), and gradients on functional controls violate the design principle "gradients on functional UI elements (decorative use only; never on buttons or form inputs)." `#FFFFFF` literal is intentional — the `--white` token flips to near-black in light color mode, but the active button always sits on the saturated org primary, mirroring the existing `[data-color-mode] .btn-primary` rule.
**Applies to:** `app/[orgSlug]/schedule/schedule.module.css` — and any future public segmented control should follow the same solid-primary pattern, not a gradient.

---

### 2026-06-01 — Public tournament pages: compact header + tightened section rhythm

**Decision:** Reduced the oversized hero-style header on all public tournament pages and centralized it.
1. **New global `.public-page-header` class** (`globals.css`) replaces the per-module `.pageHeader` block that was duplicated identically across 6 public modules. Spec: `padding: 1.25rem 0` (was `2rem 0 2.5rem`); `h1 { font-size: clamp(1.5rem, 3.5vw, 2.25rem); line-height: 1.15; margin: 0.25rem 0 }` (was `display-lg` = `clamp(2.25rem, 6vw, 4rem)`, up to 64px); `p { color: var(--white-60); max-width: 640px }`. The `display-lg` class was removed from every public page `<h1>`.
2. **Duplicated `.pageHeader` blocks deleted** from `schedule/standings/teams/rules/news/register` modules. Components/pages switched from `styles.pageHeader` → literal `className="public-page-header"`: `ScheduleContent`, `StandingsContent`, `TeamsContent`, `[tournamentSlug]/teams/[id]/page.tsx`, `rules/page.tsx`, `news/page.tsx`, `register/page.tsx`.
3. **Register header folded into the neutral global** — previously had a distinct primary-tinted gradient (`rgba(--primary-rgb,0.12)`) and larger `4rem 0 3rem` padding; now consistent with all other public pages.
4. **Global `.section` padding tightened**: desktop `2rem 0 4rem` → `1.5rem 0 3rem`; mobile (≤768px) `3rem 0` → `1.25rem 0 2.5rem` (mobile top padding was previously *larger* than desktop — backwards).
5. **Schedule segmented controls** (`schedule.module.css`): `.segmentButton` min-height `40px → 34px` (desktop), `44px → 40px` (≤640px); padding `0.45rem 0.85rem → 0.4rem 0.8rem`; `.calendarButton` min-height `40 → 34`. `.segmentActive` `box-shadow` dropped at ≤640px.
6. **Schedule spacing**: `.dateGroup` margin-bottom `2.5rem → 1.75rem`; unpublished/empty-state inline padding `4rem 0` / `3rem 0` → `2.5rem 0`.

**Rationale:** `display-lg` is a marketing-hero size inappropriate for operational lookup pages (review heuristic: "avoid oversized hero-style treatments inside operational tools"). Combined with double-stacked header+section padding, ~130–150px was wasted above the fold on desktop, and two full-width glowing filter buttons dominated mobile. Centralizing the header also removes the 6-way duplication and prevents future drift. Root-level legacy single-tenant pages (`app/schedule`, `app/teams`, etc.) import their own co-located modules and were intentionally left untouched.
**Applies to:** `globals.css`; all `app/[orgSlug]/{schedule,standings,teams,rules,news,register}/*.module.css`; `components/public/{Schedule,Standings,Teams}Content.tsx`; `app/[orgSlug]/[tournamentSlug]/{rules,news,register,teams/[id]}/page.tsx`.

---

### 2026-05-30 — Teams page: compact dropdown filter menus in Row 2 (desktop); mobile keeps bottom sheet

**Decision:** Desktop Row 2 uses two compact dropdown buttons matching the Schedule page's `VenueFilterMenu` pattern: (1) **Status** button ("All statuses" / active status label / "N statuses") opens a checkmark panel with Pending/Accepted/Waitlist/Rejected + counts; default is P+A+W so button shows "All statuses" in that state. (2) **Payment** button ("All payments" / label / "N payments") opens a panel with Unpaid/Deposit paid/Paid in full/Past due + counts; only shown when `paymentToolsAvailable`. Panel header shows "Reset" when non-default. Active state (lime) fires when filter deviates from default. Component is `RegistrationFilterMenu` at bottom of `page.tsx`; styles are `regFilter*` classes in `teams-admin.module.css`. Both buttons live in `.desktopFilterChips` (hidden ≤640px). Mobile is unchanged — bottom sheet handles all filters.
**Rationale:** Compact buttons match the venue filter aesthetic — one button per filter type, no chip sprawl. The panel checkmark model is more explicit about multi-select state than chips, especially for the status filter where the default is 3-of-4 selected. Mirrors an established pattern already in the codebase.
**Applies to:** `app/[orgSlug]/admin/tournaments/registrations/page.tsx`, `registrations/teams-admin.module.css`.

---

### 2026-05-29 — Teams page: attention panel and drawer removed
**Decision:** The "Needs Attention" banner strip and its associated bottom-sheet drawer have been removed from the Teams/Registrations admin page. The dashboard-level registration metrics (unpaid counts, waitlist counts by division) are the correct and sufficient surface for this aggregate view. The filter chips and payment filter on the Teams page give admins everything they need once they are in operational mode.
**Rationale:** The banner was redundant — the page is already filtered by division, every team's status is visible inline, and the filter chips serve the same "show me problem teams" function the drawer was trying to provide. Aggregate cross-division metrics belong on the dashboard, not embedded in an operational list page. Removing the drawer also eliminates a broken UX path (the drawer opened a "CHOOSE DIVISION" picker that duplicated the division filter already at the top of the page).
**Applies to:** `app/[orgSlug]/admin/tournaments/registrations/page.tsx` — `attentionPanel`, `attentionDrawerOpen` state, and all associated computed values removed. URL param deep-linking from dashboard (`?attention=unpaid&division=...`) is preserved.

---

### 2026-05-29 — Table wrappers with tooltips: use overflow: visible, not overflow: hidden
**Decision:** Table wrapper divs (`.tableWrap` pattern) must use `overflow: visible` rather than `overflow: hidden`. `overflow: hidden` clips absolutely positioned tooltip balloons (`.tooltipPopover`) when they extend above the table header row, hiding the top portion of the popup. The tooltip's `z-index: 60` handles stacking over non-positioned `<th>` cells once clipping is removed. The `border-radius: 2px` wrapper border is unaffected visually at that small radius.
**Rationale:** First discovered on the org Members page: top-row role tooltips were clipped by `.tableWrap { overflow: hidden }`. The same pattern would affect any table wrapper that uses this convention.
**Applies to:** All `.tableWrap`-style wrappers globally — `app/[orgSlug]/admin/org/members/members.module.css` fixed; audit any other page using `overflow: hidden` on a table wrapper that also hosts `HelpTooltip`.

---

### 2026-05-27 — Tournament Notifications page: 6 fixes from design review
**Decision:** (1) `pageHeader margin-bottom` corrected to `1.25rem` (was `1.75rem`) — matches binding standard. (2) `.headerLeft align-items` corrected to `flex-start` (was `center`) — matches binding icon-box alignment decision. (3) `.channelItem cursor` corrected to `pointer` (was `default`) — `<label>` elements wrapping interactive toggles must use pointer cursor. (4) `.channelItemLabel font-size` reduced to `0.82rem` (was `0.85rem`) — matches the data body range (0.72–0.82rem) used in all other admin shell data text. (5) `.muteCardActive .muteSub` gets `color: var(--white-60)` — `--white-40` is low-contrast against the danger-tinted surface in the active/muted state. (6) `.muteCard background` changed from `var(--surface)` to `rgba(255,255,255,0.02)` — matches the channelCard background for surface parity between the two adjacent cards.
**Rationale:** Fixes 1–2 enforce the binding page-header standard from the 2026-05-25 dashboard audit. Fix 3 is a basic interactive affordance. Fix 4 enforces data density. Fix 5 is a contrast improvement in an important destructive-state indicator. Fix 6 removes a surface token inconsistency between neighbouring cards.
**Applies to:** `app/[orgSlug]/admin/tournaments/settings/notifications/notifications.module.css`.

---

### 2026-05-26 — Public Site (Branding) page: accordion, locked-card redesign, renames, button fixes

**Decision:** (1) **Rename** — sidebar nav item `Branding` → `Public Site`; page h1 → `Public Site`. The old name was too generic and didn't communicate that this controls the public-facing tournament website. (2) **Locked cards — compact row pattern** — when a feature requires Tournament Plus, the card renders only its title row + LOCKED badge + a one-line description of the feature (`.lockedHint`). No disabled form controls, no disabled swatches, no disabled grids. The `.lockedHint` is hidden on mobile (≤600px) since the consolidated upsell block covers it. (3) **Single consolidated upsell block** — one `CompactUpsell` component placed above all locked sections replaces the five individual per-card upgrade paragraphs. Free tier sees one CTA; not five. This uses the existing `CompactUpsell` component from `@/components/admin/tournament`. (4) **Mobile accordion** — on ≤600px, each section card collapses to its title row + chevron. Public Pages opens by default; all Advanced Branding sections start closed. On desktop (≥601px) all sections are always expanded. The `.accordionTrigger` button uses `pointer-events: none; cursor: default` on desktop so it behaves as a plain block wrapper. (5) **`TournamentAdminHeader`** replaces the hand-rolled header (48px icon, `margin-bottom: 2rem`, oversized title). Back link removed for consistency with Venues page migration. (6) **Background toggle active state** — `.modeToggleBtnActive` changed from `var(--primary)` navy to `var(--logic-lime)` + `#0f1123` text, matching all other segmented controls in the admin shell. (7) **Logo square** — `.logoPreview border-radius: 50%` → `2px`, matching the sharp-corner HUD aesthetic. Border changed from `2px solid var(--primary)` to `1px solid rgba(var(--primary-rgb), 0.35)`. (8) **Button fixes** — Save Changes: `btn-primary` → `btn btn-lime btn-data`; Upload/Remove buttons: `btn btn-outline btn-data` / `btn btn-ghost btn-data`. Mobile full-width override on `.modeToggle, .modeToggleBtn` removed.
**Rationale:** Locked disabled UI creates a bad free-tier experience by showing features the user can't touch — overwhelming and scroll-heavy. The compact locked row + single upsell block is calmer and more effective. Accordion addresses ~2400px mobile scroll. All button and token fixes enforce prior binding decisions.
**Applies to:** `app/[orgSlug]/admin/tournaments/branding/page.tsx`, `branding.module.css`, `components/admin/AdminSidebar.tsx`.

---

### 2026-05-26 — Mobile bottom nav More dropdown: every item belongs under a section header
**Decision:** No nav item in the More dropdown exists outside a section header (Operations / Setup / Admin). Even a single-item section retains its header. The structural rule is: items always live under a subheader.
**Rationale:** Retrofitting section labels when new items are added is avoidable friction. A consistent header-first structure keeps the dropdown scannable regardless of item count.
**Applies to:** `components/admin/AdminBottomNav.tsx` — More dropdown section structure.

---

### 2026-05-26 — Mobile bottom nav: full design system alignment + 5-tab layout
**Decision:** (1) **Color system** — all purple accent values (`#c084fc`, `rgba(139,47,201,...)`, `#1A1530`) replaced with design system tokens. Active tabs now use `var(--logic-lime)` + `rgba(var(--logic-lime-rgb), 0.12)` icon background + lime `activeDot` glow — matching the desktop sidebar active state exactly. Borders use `rgba(var(--blueprint-blue-rgb), ...)`. Nav bar background changed to `rgba(17,24,39,0.97)` (= `--hud-surface` at 97%, preserving `backdrop-filter` frosted-glass). Dropdown background changed to `var(--hud-surface)`. (2) **setLiveBtn** (inactive tournament CTA in dropdown) restyled from purple to lime ghost: `rgba(--logic-lime-rgb, 0.08)` background, `rgba(--logic-lime-rgb, 0.35)` border, `var(--logic-lime)` text. (3) **5-tab layout** — Dashboard added to `PRIMARY_KEYS` at position 0 (order: Dashboard → Registrations → Schedule → Results → More); removed from `OPERATIONS_MORE`. (4) **Preview Site** moved from `tournamentBlock` (prominent top position) to the dropdown footer — a muted `.dropUtilItem` link positioned between the last section divider and Logout, mirroring its placement in the desktop sidebar footer.
**Rationale:** The purple accent predated the multi-org platform pivot and was never part of the design system. Mobile and desktop admin now share a single active-state color. 5 tabs is the mobile nav convention; Dashboard is the tournament command center and earns a primary slot. Preview Site is a utility action, not a primary workflow step — footer placement matches its priority.
**Applies to:** `components/admin/AdminBottomNav.tsx`, `components/admin/AdminBottomNav.module.css`.

---

### 2026-05-26 — Results + Registrations: mobile toolbar standardized to Schedule model
**Decision:** Both pages now match the Schedule 5-row mobile stack: (1) Division, (2) Round Robin | Flat [native selects], (3) action buttons, (4) Search, (5) Status chips. Specifics: **Results** — new `results-admin.module.css` with `mobileModePair` + `desktopModeControl` pattern (same as Schedule); start group reordered to Division → RR|PO → Flat|Pools on desktop; `ToolbarMenu (Tools)` added containing "Open Scorekeeper View" (moved out of header, header now bare like Schedule); fullWidth row swapped to Search then chips; chip touch targets 34px. **Registrations** — fullWidth row DOM order swapped: `ToolbarSearch` before chips div (fixes both desktop and mobile ordering simultaneously since `flex-direction: column` on mobile means DOM order = display order); chip touch targets 28px → 34px; multi-select icon buttons 28px → 32px; Add Team icon button 28px → 32px.
**Rationale:** Consistent 5-row mobile order across all three pages reduces cognitive friction for admins switching between pages. Swapping DOM order is cleaner than CSS `order` hacks when flex-direction already controls stacking.
**Applies to:** `app/[orgSlug]/admin/tournaments/results/page.tsx`, `results/results-admin.module.css`, `registrations/page.tsx`, `registrations/teams-admin.module.css`. Commit `07b4e25`.

---

### 2026-05-26 — Schedule admin: mobile touch targets, division label, publish live state
**Decision:** (1) **Touch targets** — primary filter controls (mode selects, venue filter button) bumped from `28px` → `34px` height on mobile; secondary icon buttons (publish/export/tools, add game) bumped `28px` → `32px`. (2) **Division label** — `.scheduleDivisionSelect > span` color changed from `rgba(148,163,184,0.58)` to `var(--white-50)` — the faint slate tint was barely perceptible against the toolbar background; `--white-50` matches the `controlLabel` convention used elsewhere. (3) **Toolbar bottom margin** — `margin-bottom` bumped `1rem` → `1.25rem` on mobile to give breathing room between the 5-row toolbar and the game list below. (4) **Publish live state indicator** — `data-live="true"` attribute added to the publish button when `isPublished`; CSS rule `.publishButton[data-live]:disabled` overrides the gray disabled style to retain lime coloring (`rgba(--logic-lime-rgb, 0.35)` border, `0.07` background, `0.65` text), making the live state visible on mobile where the "Live · Teams" text badge is hidden.
**Rationale:** 28px touch targets are below comfortable thumb-tap size for an admin operating on mobile. The lime live-state indicator closes a visibility gap where admins had no way to confirm a schedule was published without checking the public page. Division label at `--white-50` matches established toolbar label standards.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/schedule-admin.module.css`, `app/[orgSlug]/admin/tournaments/schedule/page.tsx`. The `34px` filter control / `32px` icon button pattern should be adopted on other mobile admin toolbars (registrations, results) in future sessions.

---

### 2026-05-26 — Schedule admin: mobile toolbar row order (mobileModePair)
**Decision:** The two mobile mode selects (Round Robin/Playoffs and Flat/Pools or List/Bracket) are wrapped in a `div.mobileModePair` that is `display:none` on desktop and `display:flex; flex: 1 1 100%; order:1` on mobile. This gives them their own dedicated full-width row within `scheduleActionsGroup`, cleanly separating them from the venue filter and action buttons row below. Mobile toolbar now stacks: (1) Division, (2) Round Robin | Flat, (3) Venue | buttons, (4) Search, (5) Status filters.
**Rationale:** Previously the mode selects relied on flex `order` alone, causing inconsistent rendering — Round Robin sometimes appeared full-width instead of 50%/50% beside Flat. The wrapper is an unambiguous full-row boundary.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx`, `schedule-admin.module.css`.

---

### 2026-05-25 — Select optgroup labels: white-50 on hud-surface
**Decision:** Native `<select>` `<optgroup>` group headers globally use `color: var(--white-50)`, `background: var(--hud-surface)`, `font-style: normal`, `font-weight: 700`. Applied via `globals.css` alongside the existing `select option` rule. Blueprint-blue was tried first but lacked contrast on the dark surface.
**Rationale:** Browser default optgroup rendering produces a light-gray background and italic gray text — near-invisible on the dark HUD surface. `--white-50` is legible as a dimmed label/header while being clearly distinct from selectable options (`--white`). `font-style: normal` overrides the browser-default italic.
**Applies to:** All `<optgroup>` elements globally (`app/globals.css`); most visible in schedule admin venue/slot selects.

---

### 2026-05-25 - Schedule admin: filter row alignment follow-up
**Decision:** Schedule admin filter controls were refined after desktop/mobile review: (1) Desktop Row 2 is `ToolbarSearch` -> venue filter -> right-aligned status chips, so empty space sits between venue and filters instead of after the filters. (2) Desktop shows the Division label and hides mobile mode selects with stronger CSS specificity, preventing duplicate segmented/select controls. (3) Mobile uses a labeled full-width Division row, schedule-local native mode dropdowns that bypass the shared `ToolbarSelect` mobile `width: 100%` rule so they can sit side by side, Venue stretching beside compact icon actions, then Search and status filters. (4) Planning rows always render the venue column on desktop; empty venue cells are hidden visually but still reserve column space, preventing matchup drift between rows with and without venues. Empty venue cells are fully hidden on mobile to avoid a blank third row.
**Rationale:** The filtering workflow should read as a single cluster, and game row columns must remain stable regardless of optional venue data.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx`, `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx`, `schedule-admin.module.css`.

---

### 2026-05-25 — Registrations: payment panel typography + toolbar layout
**Decision:** (1) **Payment input fields**: `border-radius: 6px → 2px` (HUD sharp corners), `background: var(--hud-surface) → var(--bg-2)` (matches textarea, avoids lighter-than-panel artifact on `rgba(0,0,0,0.2)` expanded row), `font-family: var(--font-data)` added (mono numbers), `font-size: 0.88rem → 0.82rem` (standard data body size), `:focus { border-color: var(--blueprint-blue); outline: none }` added (matches textarea). (2) **Payment field labels** (`.paymentField span`): `font-family: var(--font-data)` added — without this they fell back to sans-serif despite uppercase/tight-letter-spacing treatment. (3) **"Deposit due" line** (`.paymentDue`): `font-family: var(--font-data)` added, `font-size: 0.8rem → 0.72rem` (tighter data density). (4) **FLAT|POOLS segmented control moved to context group**: Was in `align="end"` group alongside EXPORT/SELECT MANY/TOOLS. Moved to `grow` context group alongside DIVISION select. View mode is context, not utility — grouping it with Division closes the large dead-space gap on desktop between the single Division select and the action cluster. (5) **Filter row search right-aligned**: Added `justify-content: space-between` to `.registrationFilterGroup` so status filter chips stay left and search sits at the far right edge.
**Rationale:** Input background using `var(--hud-surface)` (solid `#111827`) against an `rgba(0,0,0,0.2)` transparent expanded row panel produced a visually lighter floating box. `var(--bg-2)` (`#0F172A`) gives a consistent dark inset feel matching the textarea. Toolbar Row 1 had a single Division select stretching a `flex: 1` grow group, creating a wide empty middle zone on desktop. Moving FLAT|POOLS to the left group mirrors the schedule page layout standard where all context selectors live left, all utility actions live right.
**Applies to:** `app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css` (`.paymentField span`, `.paymentField input`, `.paymentField input:focus`, `.paymentDue`, `.registrationFilterGroup`); `app/[orgSlug]/admin/tournaments/registrations/page.tsx` (toolbar group restructure).

---

### 2026-05-25 — Tournament Venues: Export in header (exception), inline edit, Navigation icon for Maps
**Decision:** (1) **Export back in header** — for setup pages with no filter controls (Venues), Export lives in the header alongside Add Venue as a secondary ghost button. The "Export in toolbar" rule applies to operational pages (Registrations, Schedule) where export is filter-state-aware. No filters = no toolbar needed. (2) **Inline edit** — clicking the pencil icon on a venue card switches the card header to an inline edit form (Name, Address, Notes), auto-expanding to show the facilities panel simultaneously. Modal edit is removed for this surface; `AddVenueModal` is now Add-only. (3) **`Navigation` icon for Maps button** — replaces `ExternalLink`. The navigation arrow communicates "get directions / open in Maps" far more clearly than a generic new-tab icon. (4) **`venueCard.editing` border** — lime border (`rgba(--logic-lime-rgb, 0.35)`) on cards in edit mode; consistent with the lime active-state pattern used on segmented controls and active chips. (5) **`btn-primary` in `AddVenueModal` fixed** — replaced with `btn-lime btn-data` per the global ban on btn-primary outside modals (and then the broader btn-primary ban).
**Rationale:** Removing the toolbar eliminates a full row of vertical dead space. Inline edit reduces modal proliferation and follows the schedule game row editing pattern already established. Navigation icon is universally understood as maps/directions. Editing border gives clear feedback without disrupting surrounding UI.
**Applies to:** `app/[orgSlug]/admin/tournaments/venues/page.tsx`, `venues-admin.module.css`, `components/admin/AddVenueModal.tsx`.

---

### 2026-05-25 — Setup section pages: Export exception to toolbar rule
**Decision:** Setup-section admin pages (Venues, Branding, Event Settings etc.) that have no filter controls may place ExportMenu in the `TournamentAdminHeader` actions alongside the primary CTA. The "Export belongs in toolbar" rule only applies when there is at least one filter control (division select, status chips, search) that makes the export filter-state-aware. A toolbar solely to hold Export creates a full row of dead space and is not justified.
**Rationale:** The original toolbar-placement rule was written for Registrations and Schedule. Those pages have 3–7 filter controls; Export contextualises with them. A setup page with no filters has no filter context to preserve — the toolbar row is pure waste.
**Applies to:** All setup-section admin pages globally.

---

### 2026-05-25 — Tournament Venues page: migrated to TournamentAdminHeader + toolbar; venue list max-width 860px
**Decision:** (1) The tournament venues page (`app/[orgSlug]/admin/tournaments/venues/page.tsx`) was migrated from a hand-rolled custom header (`styles.pageHeader` / `styles.headerLeft`) to the shared `TournamentAdminHeader` + `TournamentAdminToolbar` components, matching Registrations and Schedule. (2) **Export and "Import from Library" moved to toolbar** (`ToolbarGroup align="end"`) — these are utility actions, not primary CTAs. (3) **"Add Venue" remains the sole lime CTA in the header** — one primary action only. (4) `.venueList { max-width: 860px }` — venues is a setup/config page with few items; the full-width list felt sprawling on wide monitors. This is an inner content constraint (not the `.page` wrapper), consistent with how branding.module.css constrains `.settingsContent`. (5) `venueCard border-radius: 8px → 4px` — sharpened toward HUD aesthetic. (6) `facilityEmptyNote` italic removed; `font-family: var(--font-data)` added. (7) `ImportFromLibraryModal` inline styles extracted to CSS classes (`.libraryNote`, `.libraryVenueList`, `.libraryVenueItem`, `.libraryVenueItemSelected`, `.libraryVenueName`, `.libraryVenueAddress`, `.libraryVenueFacilities`, `.libraryEmpty`) in `venues-admin.module.css`.
**Rationale:** Header standardisation makes venues visually consistent with all other admin pages. The smaller `TournamentAdminHeader` (30px icon, 1.05rem lime monospace title, 0.5rem bottom margin vs the old 48px/1.25rem/1.25rem) directly addresses the "too big" space complaint. The `max-width: 860px` on the venue list follows the Event Settings pattern — setup-section pages with few items benefit from a contained width. The toolbar placement rule for Export is established and was violated.
**Applies to:** `app/[orgSlug]/admin/tournaments/venues/page.tsx`, `app/[orgSlug]/admin/org/venues/venues-admin.module.css`. Note: the org venues page (`app/[orgSlug]/admin/org/venues/page.tsx`) still uses the old header classes (they remain in the CSS for backward compat) and is a candidate for the same migration in a future session.

---

### 2026-05-25 — btn-primary is banned from modals; modal confirm uses btn-lime
**Decision:** `btn-primary` (navy gradient) is **banned everywhere** — including inside `.modal` wrappers. The earlier rule permitting it in modals is superseded. Modal confirm/destructive actions use `btn-lime btn-data` (positive/neutral confirms) or `btn-danger btn-data` (destructive confirms). Cancel/close actions use `btn-ghost btn-data`. The navy gradient is invisible on `--hud-surface` dark backgrounds and has no place in the platform's visual language.
**Rationale:** The Activate Tournament confirmation modal made this explicit — `btn-primary` rendered as a near-invisible dark button on the dark modal background. `btn-lime` is the platform's single confirm action colour across all contexts.
**Applies to:** All `.modal` wrappers globally. Supersedes all prior `btn-primary` modal permissions. Audit: grep for `btn-primary` anywhere in the codebase and replace.

---

### 2026-05-25 — Dashboard: ACTIVATE button intentionally compact
**Decision:** The `.activateChip` button on the draft dashboard retains its original compact size (`padding: 0.35rem 0.7rem`) on all viewports including mobile. A 44px min-height override was tried and reverted — the larger size dominated the checklist header and felt visually out of proportion.
**Rationale:** The button sits inline with the "Draft Launch Checklist" heading; a full-height touch target there over-weights a secondary action. The checklist item cards are the primary interaction surface.
**Applies to:** `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css` — `.activateChip`

---

### 2026-05-25 — Modal buttons use btn-data; FeedbackModal fully audited
**Decision:** All buttons inside `.modal` wrappers use `btn-data` as the size modifier — this overrides the earlier rule that said modal footer buttons use "default size." Confirmed preference after seeing both rendered. Specifically in `FeedbackModal.tsx`: (1) × close → `btn-ghost btn-data`, X icon reduced 16px → 14px. (2) Close/Cancel footer → `btn-ghost btn-data`. (3) Confirm footer → `btn-${type} btn-data`. (4) Header icon reduced 24px → 16px to match the 0.75rem h3 title. (5) Message body div set to `font-data 0.82rem --white-70 line-height:1.55` — message text was a bare string in a div, not a `<p>`, so the `.modal p` global rule didn't reach it. (6) Items list `borderRadius: 8` → `0` (sharp corners).
**Rationale:** Default-size `.btn` is proportioned for standalone CTAs and page-level actions. Inside a compact HUD modal, `btn-data` keeps buttons consistent with the operational density of the admin shell. The size contrast between the small monospace title and a large default button was jarring.
**Applies to:** `components/FeedbackModal.tsx` and all future modal implementations globally — `btn-data` is the standard size for all buttons inside `.modal` wrappers.

---

### 2026-05-25 — Global modal: full HUD rebrand
**Decision:** The global `.modal`, `.modal-header`, `.modal-header h3`, `.modal p`, and `.modal-footer` rules in `globals.css` were updated to match the admin shell HUD aesthetic: (1) `border-radius: var(--radius-lg)` (20px) → `border-radius: 0` — sharp corners are mandatory everywhere in the admin shell. (2) `background: var(--bg-2)` → `background: var(--hud-surface)` — canonical dark admin surface. (3) `border: var(--border)` → `border: 1px solid rgba(var(--blueprint-blue-rgb), 0.4)` — standard admin blueprint-blue border. (4) `box-shadow` changed to use `var(--glow-blue)` instead of `var(--glow-sm)` — blue glow is the admin shell standard. (5) `padding: 2rem` → `1.5rem` — tighter for data-dense context. (6) `.modal-header` gains `border-bottom: 1px solid rgba(var(--blueprint-blue-rgb), 0.25)` and `padding-bottom: 0.75rem`; `margin-bottom: 1.5rem` → `1rem`. (7) `.modal-header h3` changed from `font-display sans-serif 1.5rem 800` to `font-data monospace 0.75rem 700 uppercase letter-spacing:0.1em color:var(--fl-text)`. (8) `.modal p` baseline added: `font-data 0.82rem var(--white-70) line-height:1.55` — prevents body text defaulting to browser sans-serif. (9) `.modal-footer` `border-top` updated to `rgba(var(--blueprint-blue-rgb), 0.25)` matching header separator; margin/padding tightened.
**Rationale:** The pre-existing modal styles used design tokens from a generic light-mode component library (`--radius-lg`, `--bg-2`, `--border`, `--font-display`). Every one of these violated established HUD conventions. The fix is global and applies to all `.modal` usage platform-wide.
**Applies to:** `app/globals.css` — all `.modal` usages globally, including admin shell, platform-admin, and coaches portal.

---

### 2026-05-25 — Dashboard: full design system audit applied (Draft state)
**Decision:** Applied all binding design system rules to `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` and `dashboard.module.css` (Draft state review): (1) `.page { max-width: 960px }` removed — no page-level max-width in admin shell. (2) `h1` reduced from `text-2xl` (1.5rem) → `text-xl` (1.25rem) — page title binding standard. (3) Header `mb-8` (2rem) → `mb-5` (1.25rem) — page header margin-bottom binding standard. (4) Status badge `hidden md:block` wrapper removed — status chip now always visible on all screen sizes; mobile admin operating mode requires status visibility. (5) `.activateChip` hardcoded `color: #ccff66` and `::before background: #ccff66` replaced with `var(--logic-lime)` — no raw hex values for platform brand tokens. (6) Activate confirmation modal converted from `.card` to `.modal` + `.modal-header` + `.modal-footer` — `btn-primary` is only valid inside a `.modal` wrapper. (7) All `btn-sm` removed from both modals: modal ×-close buttons → `btn-ghost btn-data`; modal footer confirm/cancel buttons → default size (no modifier). (8) Dead CSS block (`.setupLinks`, `.setupLink`, `.setupLinkIcon`, `.setupLinkBody`, ~55 lines) deleted — these classes were never referenced in JSX. (9) Optional items accordion toggle inline styles (~12 properties) extracted to `.optionalToggle` CSS class.
**Rationale:** All rules enforce existing binding decisions. The modal `.card` → `.modal` fix is particularly important as `btn-primary` inside `.card` is non-compliant with the btn-primary isolation rule.
**Applies to:** `app/[orgSlug]/admin/tournaments/dashboard/page.tsx`, `app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css`.

---

### 2026-05-25 — Venues admin: full design system audit applied
**Decision:** Applied all binding design system rules to `app/[orgSlug]/admin/org/diamonds/` (the shared Venues page used by both the org-level and tournament-level venues routes): (1) `btn-primary btn-sm` on Add Venue → `btn btn-lime btn-data`. (2) `.page { max-width: 960px }` removed — no page-level max-width in admin shell. (3) `.pageTitle` font-size reduced `1.75rem` → `1.25rem`. (4) `.pageHeader` margin-bottom reduced `2rem` → `1.25rem`. (5) `.headerLeft` align-items changed `center` → `flex-start` (icon top-aligns with title). (6) `flex-shrink: 0` added to `.headerIcon` to prevent shrinkage. (7) All row action buttons (`Maps` link, Edit pencil, Delete trash) changed from `btn-sm` → `btn-data`. (8) Delete modal close `×` changed from `btn-ghost btn-sm` → `btn-ghost btn-data`. (9) Passive table-row empty state replaced with `.empty-state` block (MapPin icon, "No venues added yet" title, description, `btn btn-lime` CTA) rendered outside the table conditionally. (10) Inline `style={{ color: 'var(--white-60)', fontSize: '0.875rem' }}` on address/notes cells extracted to `.cellMuted` CSS class. (11) Removed now-unused `.emptyTableCell` mobile override rules from the CSS. Added `.cellMuted` and `.emptyCta` classes.
**Rationale:** Every rule above was a binding decision from prior sessions applied consistently to a page that predated those decisions.
**Applies to:** `app/[orgSlug]/admin/org/diamonds/page.tsx`, `app/[orgSlug]/admin/org/diamonds/diamonds-admin.module.css` (also affects `app/[orgSlug]/admin/tournaments/venues/page.tsx` which re-exports this page).

---

### 2026-05-25 — Schedule admin: toolbar restructure matches registrations pattern
**Decision:** Schedule admin toolbar rebuilt to exactly match the registrations layout template: (1) **Add Game button** in `TournamentAdminHeader` with `mobileActionsInline` — keeps button top-right on mobile, same as Add Team in registrations. (2) **Toolbar Row 1** split into `ToolbarGroup grow` (Round Robin/Playoffs segmented + Division select + Flat/Pools or List/Bracket segmented) and `ToolbarGroup align="end"` (Publish control + ExportMenu + Tools menu). All utility buttons in the same end group. (3) Publish control: unpublished state shows a ghost `Globe` icon button (`btn-ghost btn-data`) labeled "Publish" (mobileIconButton collapse); published state shows a compact lime badge ("Live · Teams" or "Live · Generic") + Update + Unpublish (`btn-ghost btn-data`). The badge uses `0.62rem` text and `Live ·` prefix for compactness. (4) **Toolbar Row 2** is a `ToolbarGroup fullWidth` with status filter chips (`s.statusFilters + styles.scheduleStatusFilters`) + ToolbarSearch on the same row. On mobile the fullWidth group stacks below Row 1.
**Rationale:** The previous structure put five independent control groups in the start group (segmented × 2, division select, publish status, publish action), causing overflow and inconsistency. The registrations pattern (grow context group + end utility group + fullWidth filter row) is the established admin shell standard.
**Applies to:** `app/[orgSlug]/admin/tournaments/schedule/page.tsx`, `schedule-admin.module.css`.

---

### 2026-05-25 — Schedule admin: mobile row density, status filters, and button audit
**Decision:** (1) **Venue column hide breakpoint** raised from `680px` to `768px` in `admin-common.module.css` — frees the venue column space (≈120px) at all standard mobile viewports; location is still accessible in the expanded inline panel. (2) **Game-row mobile override** (`.gameRowMain`) added to `schedule-admin.module.css` — overrides admin-common's `@768px` rule that wraps rows and pads `1rem`; game rows now stay single-line with `0.35rem 0.75rem` padding and `min-height: 40px`. Applied to both planning-mode and scoring-mode rows in `GameList.tsx`. (3) **Desktop badge / mobile compact marker** — planning-mode status area replaced with `.planningStatusCell` class (96px desktop → auto on mobile); full badge text wrapped in `.desktopStatusBadge` (hidden on mobile); a `.gameStatusMarker` 18px square initial (`✓` for Final, `✕` for Cancelled) shown on mobile via `data-status` variants matching the registrations `mobileStatusMarker` pattern. (4) **Game status filter chips** — four chips (All / Scheduled / Cancelled / Final) with colour-coded `::before` dots added to the second toolbar row alongside search; chips use the existing `.filterChip` / `.chipActive` admin-common class system with four new variants (`chip_all`, `chip_scheduled`, `chip_cancelled`, `chip_completed`). `filterStatus` state added to `ScheduleAdminPage`; `divisionGames` + `statusCounts` computed for chip counts; filter resets on division or view-mode change. Clicking an active non-all chip toggles it back to "All". (5) **Add Game icon-only on mobile** — `.addGameButton` + `.addGameLabel` classes collapse the header CTA to `32×28px` icon-only below 760px, matching the registrations `addTeamButton` pattern. (6) **Inline form footer btn-sm purge** — all `btn-ghost btn-sm`, `btn-danger btn-sm`, and `btn-lime btn-data btn-sm` in `GameList.tsx` inline form footer replaced with `btn-data` variants; inline `fontSize: '0.72rem'` overrides removed. (7) **Publish toolbar btn-sm purge** — two `btn-ghost btn-sm` buttons (Update / Unpublish) replaced with `btn-ghost btn-data`; inline height/font overrides removed.
**Rationale:** Porting the registrations mobile pattern to schedule: compact rows, status markers, and filter chips are now consistent across both admin list pages. btn-sm is banned in the admin shell; btn-data is the uniform size standard.
**Applies to:** `admin-common.module.css` (breakpoint + chip variants), `schedule-admin.module.css` (all new classes), `app/[orgSlug]/admin/tournaments/schedule/page.tsx`, `app/[orgSlug]/admin/tournaments/schedule/components/GameList.tsx`.

---

### 2026-05-25 — Event Settings page: layout, spacing, and button audit
**Decision:** (1) `.page` max-width removed — the branding.module.css shared by Event Settings and the Branding admin page had `max-width: 720px` which caused large wasted whitespace on the right. Removed entirely per the global "no page-level max-width in admin" rule. (2) `pageTitle` font-size reduced from `1.75rem` to `1.25rem` — the large monospace heading was an oversized hero-style treatment inconsistent with operational admin pages. (3) `.pageHeader` and `.settingsTitleRow` margin-bottom both reduced from `2rem` to `1.25rem` — stacked 2rem margins created 4rem of vertical dead space before the first content card. (4) `btn-primary` on the Save Changes footer button replaced with `btn-lime btn-data` — `btn-primary` is banned outside `.modal` wrappers. (5) `btn-outline btn-sm` on the upsell "Review Tournament Plus" link replaced with `btn-outline btn-data` — `btn-sm` is not the admin shell size standard. (6) `.segmentButtonActive` background changed from `var(--blueprint-blue)` to `var(--logic-lime)` with `color: #0f1123` — logic-lime is the platform's interactive accent; blueprint-blue active state was inconsistent with the layout-toggle pattern already using lime.
**Rationale:** Rules 1–5 enforce existing binding decisions. Rule 6 consolidates segmented control active-state to the single correct accent color across all admin components.
**Applies to:** `app/[orgSlug]/admin/tournaments/branding/branding.module.css` (shared by Branding + Event Settings pages), `app/[orgSlug]/admin/tournaments/settings/event/page.tsx`; segmented control lime active state applies globally to any component using this pattern.

---

### 2026-05-25 — Rules/Resources public page layout toggles
**Decision:** Rules and Resources sections on the public rules page each have an independent admin-controlled layout: Rules = `'columns'` (2-col grid, default) | `'single'` (full-width); Resources = `'list'` (stacked, default) | `'grid'` (2-col). Stored in `tournaments.settings` JSONB. Defaults preserve current behaviour for all existing tournaments. Toggle UI in each `section-header` uses two adjacent `icon-btn` buttons in a `.layout-toggle` pill; active state uses `--logic-lime`/`rgba(--logic-lime-rgb, 0.08)` background. Both layout variants collapse to 1 column at ≤768px on the public page.
**Rationale:** Two-col rule cards look good for 2–4 short sections but squish at 6+. A full-width option serves content-heavy orgs. Resources grid aids scanability for 4+ links. Separate control per section because content volume differs. JSONB settings avoids column sprawl for future small preferences.
**Applies to:** `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx`, `app/[orgSlug]/[tournamentSlug]/rules/page.tsx`, `app/[orgSlug]/rules/rules.module.css`; `tournaments.settings` JSONB for future per-tournament prefs.

---

### 2026-05-24 — Public pricing page: eyebrow + label colour, featured segment card, section order
**Decision:** (1) All eyebrow labels, table category headers, and "from→to" bridge labels on public pages use `var(--logic-lime)`, not `var(--blueprint-blue)`. Blueprint blue on a near-black surface fails contrast and reads as dark-blue-on-dark — lime is the correct readable accent. (2) The `segmentCardFeatured` lime highlight was removed from the Coach/Team Manager segment card. Featured styling is reserved for plans that can be purchased; coming-soon products get neutral (muted opacity) treatment. If any segment card needs a highlight in future, it must be the top-revenue live plan (Tournament Plus). (3) Page section order: Hero → Segment picker → **Org plans** (moved up) → Coaches Portal callout → Compare table → Upgrade bridges → Coming soon → FAQ → CTA. The live plan cards must appear before any coming-soon product sections. (4) Coaches Portal feature list condensed from 7 bullets to 3 high-level pillars to reduce text volume. (5) Comparison table converted to a client component (`ComparisonTable.tsx`) with per-category accordion collapse; only the first 2 categories (Tournaments & Scheduling, Registration Operations) are open by default. (6) Page background remains `--pitch-black` (#0A0A0A) for public/marketing pages; `--hud-surface` (#111827) is the admin shell surface and should not be used as the base background for public pages.
**Rationale:** Contrast failure on eyebrows was a direct readability issue across all sections. The featured card misdirected visitors toward a product they couldn't buy. Section order misaligned with visitor intent (most arrive wanting to see plan prices). Table was 48+ rows always-visible; collapsing reduces scroll fatigue without losing information.
**Applies to:** `app/pricing/page.tsx`, `app/pricing/page.module.css`, `app/pricing/ComparisonTable.tsx`; eyebrow-colour rule applies globally to all public-facing pages.

---

### 2026-05-24 — Rules page: btn-purple eliminated, all buttons normalised to design system
**Decision:** `btn-purple` was a phantom class (no CSS definition anywhere) used on 4 buttons in both `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx` and `app/admin/rules/RulesAdmin.tsx`. Replaced globally: "Save Changes" (dirty state) → `btn-lime btn-data`; "Save Changes" (clean) → `btn-ghost btn-data`; "Seed Default Data" → `btn-outline btn-data`; "Add Section" → `btn-lime btn-data`; "Upload File" → `btn-lime btn-data`; "Add Link" → `btn-outline btn-data`; resource inline Save → `btn-lime btn-data`; resource inline Cancel → `btn-ghost btn-data`. `btn-purple` is now completely absent from the codebase.
**Rationale:** Phantom classes silently fail — buttons rendered with no colour modifier, looking like unstyled `.btn`. The btn-data + btn-lime/btn-outline/btn-ghost pattern is the correct admin shell standard. Every design review should grep for `btn-purple` (and any other non-system modifier) to catch this category of error.
**Applies to:** `app/[orgSlug]/admin/tournaments/rules/RulesAdmin.tsx`, `app/admin/rules/RulesAdmin.tsx`, and globally (btn-purple is banned)

---

### 2026-05-24 — AUDIT RULE: btn-primary is banned outside overlay modals — replace with btn-lime btn-data
**Decision:** `btn-primary` (navy gradient) is **only** permitted inside a `div.modal` (true overlay dialog with backdrop). Every other primary action in the admin shell — page headers, inline panels, compose forms, drawers, toolbars, inline CTAs — must use `btn-lime btn-data`. This has come up repeatedly across sessions (Announcements, Communications, and others); the root cause is that `btn-primary` is the React/form default and gets used by mistake on new components. **Every design review must grep for `btn-primary` and audit each hit against this rule.**
**Rationale:** The admin shell's brand identity is the logic-lime / dark HUD aesthetic. Navy gradients belong to the modal confirm pattern only. Consistency across pages requires an explicit audit step, not per-page corrections.
**Applies to:** All admin shell pages globally. Audit command: search for `btn-primary` in `app/[orgSlug]/admin/` and verify each is inside a `.modal` wrapper.

---

### 2026-05-24 — btn-data is the standard size modifier for all admin shell action buttons
**Decision:** All buttons in the admin shell use `btn-data` as their size modifier unless a specific exception applies. This covers: page header CTAs, toolbar buttons, inline panel action bars (compose, edit, filters), and inline form submit/cancel buttons. The two documented exceptions are: (1) empty state CTAs — use `btn btn-lime` with a local size class instead; (2) true modal confirm/cancel buttons — use `btn btn-primary` or `btn btn-ghost` at default size. Do not use `btn-sm`, `btn-lg`, or unsized `btn` for admin shell action buttons.
**Rationale:** The platform's operational/terminal aesthetic requires compact, monospace, uppercase buttons throughout the admin shell. Using default `.btn` sizing creates large buttons that look out of place next to data tables and toolbars. `btn-data` enforces: 0.62rem monospace font, uppercase, 2px radius, tight padding.
**Applies to:** All admin shell pages and components globally. See `app/globals.css` `.btn-data` for the definition.

---

### 2026-05-24 — Compose panel: max-width 860px centered, btn-data on all action buttons
**Decision:** The communications compose panel uses `max-width: 860px; margin: 0 auto` so all sections (templates, fields, channels, actions) share the same width and are centered in the content area. The page header remains full-width. All three action buttons (× Cancel, Save Draft, Post to Site/Send) use `btn-data` to match the operational data-density aesthetic of other admin pages (Registrations, Schedule). `channelDesc` needs no `max-width` because the panel's own constraint prevents over-stretching.
**Rationale:** Consistent width across all compose sections avoids the "narrow fields, wide channels" mismatch. btn-data aligns the form's button aesthetic with the rest of the admin shell.
**Applies to:** `app/[orgSlug]/admin/tournaments/communication/communication.module.css`, compose panel pattern

---

### 2026-05-24 — .empty-state svg selector must be direct-child only
**Decision:** The global rule targeting SVGs inside `.empty-state` must use the direct-child combinator: `.empty-state > svg`, not `.empty-state svg`. The descendant form matches SVG icons inside buttons nested within the empty state, applying `opacity: 0.4` and `margin-bottom: 1rem` to button icons — causing visual misalignment.
**Rationale:** The rule was written for the decorative icon only. Any `.empty-state` that contains a button with a Lucide icon would be broken by the broad selector.
**Applies to:** `app/globals.css` — global fix affecting all empty states platform-wide

---

### 2026-05-24 — Branded checkbox: global platform style for all input[type="checkbox"]
**Decision:** All checkboxes across the platform use a custom branded style: `appearance: none`, 16×16px, 2px border-radius, `--blueprint-blue-rgb` border (unchecked), `--logic-lime` checkmark via `::before` pseudo-element, `--logic-lime-rgb` border + tint background (checked). Applied globally via `input[type="checkbox"]` in `globals.css`. The 18×18px `.selectionCheckbox` variant in `teams-admin.module.css` is the reference; the global uses 16px for standard form checkboxes. All `accent-color` overrides have been removed from module CSS files and inline TSX styles — they have no effect once `appearance: none` is set. The `--logic-lime-rgb` fallback is `217, 249, 157` (matching the global token, not the incorrect `194, 255, 74` used in old fallbacks).
**Rationale:** Standard browser checkboxes clash with the dark HUD aesthetic. The lime-on-dark brand palette makes checked states immediately readable and on-brand. A global rule ensures no new checkboxes are accidentally left unstyled.
**Applies to:** All `input[type="checkbox"]` globally; the 18px `.selectionCheckbox` class in `teams-admin.module.css` is the reference for larger table-row selection variants.

---

### 2026-05-24 — Page header icon box: align-items flex-start not center
**Decision:** `.headerLeft` (the icon + title/subtitle flex row in the page header) uses `align-items: flex-start` so the icon box top-aligns with the title text. `align-items: center` caused the 48px icon box to float ~4px below the title start when the text block was taller — visually misaligned.
**Rationale:** Icon boxes should anchor to the title, not to the midpoint of the entire text group.
**Applies to:** `communication.module.css`, any page header using the icon-box + title/subtitle layout

---

### 2026-05-24 — Empty state CTAs must not use btn-data
**Decision:** Buttons inside `.empty-state` must use `btn btn-lime` (or `btn btn-outline`) without `btn-data`. `btn-data` enforces 0.62rem monospace uppercase, which is correct for header/table CTAs but creates an undersized, stiff appearance as a centered page-level call-to-action. The empty state CTA gets its own padding via a local `.emptyCta` class.
**Rationale:** `btn-data` is the "operational terminal" aesthetic for data-dense contexts. An empty state is an invitation, not an action bar row. The size and weight need to match the informational hierarchy of the surrounding text.
**Applies to:** Communications page empty state; empty state CTA pattern globally

---

### 2026-05-24 — Communications page replaces Announcements + old Communications pages
**Decision:** The unified `/admin/tournaments/communication` page supersedes both the old Announcements page and the previous Communications page. It handles site posts and email sends from one compose panel with a shared history log. Template chips use a pill style (`--bg-inset`, `--border-subtle`, 20px border-radius). A "× Clear" text button (`.draftClear` style) appears inline at the end of the template row only when title or body has content — preferred over a "Blank" template chip, which is semantically awkward.
**Rationale:** Consolidating site posts and emails into one place reduces context switching. The inline Clear affordance reuses the existing draft-clear pattern for consistency.
**Applies to:** `app/[orgSlug]/admin/tournaments/communication/page.tsx`, template clear pattern globally

---

### 2026-05-24 — Admin pages use full width, no page-level max-width
**Decision:** Tournament admin pages must not set a `max-width` on the `.page` wrapper. The shared admin shell provides its own container constraints. Page-level max-width creates inconsistent layout where the header button appears stranded far from the right edge.
**Rationale:** All pages (Registrations, Schedule, Results) stretch full width. Announcements had a leftover `max-width: 860px` that was removed.
**Applies to:** All tournament admin pages, global

---

### 2026-05-24 — btn-lime for primary admin shell CTAs, btn-primary for modal actions
**Decision:** Primary action buttons in the admin shell page header (Add Team, Add Game, New Post, etc.) use `btn-lime btn-data`. `btn-primary` (navy gradient) is reserved for modal save/confirm buttons.
**Rationale:** The global CSS comment at `.btn-lime` is explicit about this convention. Mixing btn-primary into the admin header produces the wrong brand color (dark navy vs. logic-lime).
**Applies to:** All tournament admin page headers, global convention
**⚠ Extended:** See newer entries "AUDIT RULE: btn-primary is banned outside overlay modals" and "btn-data is the standard size modifier" — those entries supersede the page-header-only scope of this one and apply the rule to all admin shell contexts.

---

### 2026-05-24 — Export button belongs in the toolbar (align="end"), not the page header
**Decision:** ExportMenu always lives in a `ToolbarGroup align="end"` on the first toolbar row, before the Tools menu. It must not live in `TournamentAdminHeader` actions. The header is reserved for one primary lime CTA (Add Team, Add Game) and secondary outline actions (Open Scorekeeper View). Export is a utility/data-extraction action contextually tied to the current filter state.
**Rationale:** Export respects current filter state (division, status), so it belongs near the filters. The header should have one clear primary action. Well-established admin tool pattern: filters + export in the toolbar row, primary create action in the header.
**Applies to:** All tournament admin pages with export (Registrations, Schedule, Results), global convention

Newest entries first. All decisions here are binding in future sessions unless explicitly overridden.

---

### 2026-05-24 — News Posts: remove delivery note banner
**Decision:** Removed the "Public post only / Email Teams" banner from the News Posts list page entirely.
**Rationale:** The page subtitle ("This does not send email") already communicates the key distinction. Communication is adjacent in the nav. The banner was pure redundancy that added visual weight before users could see their posts.
**Applies to:** `app/[orgSlug]/admin/tournaments/announcements/page.tsx`

---

### 2026-05-24 — News Posts: action-oriented empty state
**Decision:** Empty state now shows an icon, a "Keep teams informed" title, a one-line description, and an inline "Publish First Post" CTA button — replacing the passive "No posts yet. Create one above." pattern.
**Rationale:** Empty states should be self-contained action prompts, not pointers to other parts of the UI. Removes the awkward "above" reference when the header button is not in the user's focus area.
**Applies to:** `app/[orgSlug]/admin/tournaments/announcements/page.tsx`, empty state pattern globally

---

### 2026-05-24 — Upgrade upsells must not interrupt active task flows
**Decision:** The Tournament Plus locked-targeting upsell was removed from the New/Edit Post modal. The `NEWS PAGE VISIBILITY` section only renders when `canTargetAnnouncements` is true (Plus/League/Club). Free orgs see a clean Title → Body → Pin → Publish flow.
**Rationale:** Free org posts are all-divisions by default — there is no decision to make, so showing a locked feature block mid-form adds friction to every create/edit action without enabling any task. Upsells belong on plan/subscription pages, not inside creation modals.
**Applies to:** `app/[orgSlug]/admin/tournaments/announcements/page.tsx`, upgrade gate placement globally
