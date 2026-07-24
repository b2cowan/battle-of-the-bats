# The Flip — Role ⇄ Public Navigation (unified top-right pill)

**Status:** P1 BUILT on dev (uncommitted) — P1 revised mid-build with the **shared admin header** (below) · **Ratified:** 2026-07-22 (owner approved rev 2 of the proposal artifact `claude.ai/code/artifact/23f4dbce-60dd-42c1-b9ec-7ca6597651e7` — the binding visual spec)
**PM brief:** `ROLE_FLIP_NAVIGATION_PM_BRIEF.md`

> ### REVISION 2026-07-22 — Shared admin header (owner-approved; supersedes the P1 floating desktop pill)
> On browser QA of the built P1 the owner rejected the floating desktop corner pill (it collided with each page's own action buttons) and asked for a **persistent shared admin header** instead — the same fix the review's altitude lens had flagged. **Binding visual spec = mockup artifact `claude.ai/code/artifact/ebc24a16-51db-4393-bd60-6c43127481ac` (owner-approved 2026-07-22).**
> - **One shell-level header on every admin screen** (desktop + mobile), so the flip door is always in the same place and never disappears. It shows event identity — icon + tournament name + **Live / Open / Draft / Completed** state + a meta line (date range) — with the FlipPill anchored top-right. It **collapses on scroll** to a slim name + state + pill strip and expands back at the top, mirroring the public event header.
> - **Two-level chrome (accepted):** the shell header carries event identity + the flip; each page keeps its own unchanged section header (Teams / Schedule…) and action buttons below. They never share the corner.
> - **Replaces the P1 floating desktop dock AND the mobile top bar** (both retired) — the pill now lives only in this header. The mobile notification badge stays in More (P1, unchanged).
> - **Off-tournament target = org public site.** On tournament screens the pill flips to that tournament's public twin (mapped page, else the event's Overview/front page — the "never a wrong guess" fallback, labeled `⇄ Public · Overview`). On non-tournament admin screens (org admin, house league, rep teams, accounting, public-site editor) the header shows the ORG identity and the pill reads `⇄ Public site` → `/{org}`. Focused shells (onboarding/help/preview) render no header (preview keeps its own Exit-preview pill).
**Origin:** owner complaint 2026-07-22 (admins/coaches feel stuck moving between the public tournament site and their portals) + Tournament Seam UX Review "item 8 — context-preserving doors," which was never scoped into P1/P2/P3 (verified: none of B1/B3/B4/B5/B10 shipped). Also closes A8, A18, A19, and the coach-side halves of B21; companion-closes B14.
**Design process:** 11-agent workflow (journey audits, cross-industry pattern research, 4 independent designs, 3 adversarial judge lenses) → synthesis → owner rev-2 amendments (unified top-right pill; bell + share displacement; desktop parity; coach round-trip confirmation).

---

## 1. The model (binding)

> **“The pill in the top-right corner always flips you to the other side of this event — same spot in every area, always the matching page, always in the same tab.”**

One shared **FlipPill** control, top-right, on every surface where a signed-in user holds a role on the tournament in view:

| Surface | Pill reads | Lands on |
|---|---|---|
| Public tournament page (hat-holder) | `⇄ Admin` / `⇄ Coach` / `⇄ Roles ▾` (multi-hat) | Page-matched twin (see §3) |
| Admin shell (mobile top bar + desktop content header) | `⇄ Public · {page}` · draft: `⇄ Preview · {page}` | Page-matched public/preview twin |
| Premium coach shell (NEW slim mobile top bar + desktop header) | `⇄ Public` | Public schedule / tournament page for the team's registration |
| Free coach workspace (existing topbar) | `⇄ Public` | Same as premium |
| Scorekeeper (existing header link, restyled to pill) | `⇄ Public · Schedule` | Public schedule, current day |
| Fans / signed-out / no hat | *(nothing renders — unchanged rule)* | — |

**Return-memory:** immediately after any flip, the destination side's pill reads `⇄ Back to {origin label}` and targets the exact origin URL. It reverts to the stateless page-matched label once the user navigates to a different section on the arrival side (or after ~20 min). Mechanism: sessionStorage snapshot `{originUrl, label}` written at hop time; stateless twin resolution is ALWAYS the fallback when the snapshot is missing/stale. ⚠ Must be device-verified on installed PWA (Android + iOS) before being treated as reliable — if it proves flaky there, ship stateless-only (still correct, one extra tab-tap on some round trips).

**Same-tab policy:** absolute — mobile AND desktop, both directions. Every `target="_blank"` in this loop is removed (admin sidebar + bottom-nav View Site, coach fan-view links). Desktop power users can ctrl/middle-click (normal links).

**Multi-hat:** pill opens a compact anchored popover (NOT the old BottomSheet): one row per hat held on THIS event + (inside a shell) a `Public · {page}` row. Each row is destination-labeled ("Open admin — lands on Schedule"). This popover is the ONLY hat-chooser surface (no drift; single component).

## 2. Displacements (owner-ratified, rev 2)

1. **TournamentAccountSheet retires.** Hat rows → the pill/popover. Coach one-tap alerts row (N3b) → relocates into the coach shells' overview (both tiers) — MUST land in the same phase that removes the sheet (P2), no coverage gap. Follow-tournament / follow-team / fan bell / get-app / sign-out rows: already have homes (follow strip, Teams tab, alert prompts + Account tab, install prompt, Account tab) — the sheet's copies were duplicates; delete.
2. **Mobile admin notification bell → More.** `AdminMobileTopBar`'s bell slot is taken by the pill. Notifications become a "Notifications" row in the More sheet (icon + unread count), and the unread count rides the More tab as a badge (same bubble-up pattern the draft-phase chat unread already uses). Desktop sidebar bell UNCHANGED. Cost accepted by owner: mobile notifications = 2 taps instead of 1, badge still glanceable.
3. **Public header share button → into the page.** `SharePageButton` leaves the event header (all pages). Replacement: a share row/action on the Overview page content. Game score-card share (`ShareScoreButton`) and champions-page share are content-level already — unchanged. Fan header gets the corner back (long event names win).
4. **"View Site"/"Preview Site" retire** from admin sidebar footer + bottom-nav More as the primary door. Keep ONE page-matched, same-tab mirror row in mobile More for a transition release (muscle-memory searchers), labeled identically to the pill; delete the desktop sidebar footer link outright (the header pill is always visible there).

## 3. Page-twin mapping (single resolver, both directions)

New pure module — `lib/flip-twins.ts` — is the ONE source of truth; the pill (both feed modes), the strip nudge, and any mirror rows all call it. Signature approx: `resolveFlip({ pathname, direction, hat, ctx }) → { href, label } | { targets: [{href,label},{href,label}] }`.

| Public | Admin | Notes |
|---|---|---|
| Overview | Dashboard | loose but accepted |
| News | Communication | clean |
| Schedule | Schedule | clean; day/division filters carried as query params where present |
| Game page | Results, `?highlightGameId=` | highest-value pair |
| Standings | Results | no admin standings screen exists; pill sublabel "standings come from these scores" |
| Teams | Registrations | clean |
| Rules | Setup → Rules & Resources | clean |
| Register CTA | Registrations | same twin as Teams |

- **Admin → public from Results:** two-target expand — `Public · Schedule` / `Public · Standings` (the one single-hat chooser; everywhere else is direct).
- **Unmapped admin screens** (Check-in, Staff Kit, Data Tools, Archives, org-level admin): pill falls back to `⇄ Public · Overview` — **never absent, never a wrong guess** (rev-2 owner principle: the corner must always work).
- **Coach twins (REVISED 2026-07-24 — CONTEXTUAL, not shell-wide):** the coach flip appears ONLY on coach pages that already have a tournament context — the team's **tournament record** page (→ that event's public page; the "check my fees ↔ see us live" loop), the **Overview** when a live/upcoming public tournament exists (→ that event), and the **Tournaments** list rows (each → its event). It does **NOT** appear on team-management pages (roster, lineups, attendance, player development, documents, settings, accounting, tryouts, season history, announcements) — those have no public-tournament counterpart, so a flip there is meaningless. ~~record + coach schedule + overview → public Schedule; other coach pages → public Overview fallback~~ (the always-present-with-Overview-fallback model is SUPERSEDED). Public page → the team's tournament record still holds (the reverse trip). This makes P3 simpler: the flip lives on pages that already know their tournament, so NO new premium mobile top bar and NO shell-wide context plumbing.
- **Draft tournaments:** admin pill reads `⇄ Preview · {page}` → the admin preview shell page-matched (preview mirrors live top tabs per P0-3). Public side: no pill (no public site exists). **Companion (B14):** the preview shell gains a small fixed "Exit preview → Dashboard" pill (preview stays otherwise identity-chrome-free per P0-3).
- **Staff scoping:** resolver checks capabilities; if the twin is out of scope, land on the staffer's nearest permitted screen (never 403). If NO admin screen is permitted, no admin hat row renders (existing hat-resolution behavior).
- **Finished/archived:** twins resolve normally (read-only Results etc.).
- **Org-level public pages `/{org}/`:** OUT OF SCOPE this project (tournament-scoped only); org admin's existing "Back to Site" link untouched.

## 4. Identity & rendering constraints (unchanged architecture)

- **Public tournament routes:** identity is CLIENT-side only (SW caches HTML anonymously — never SSR identity). Pill reuses the exact `useClientSignedIn` + `/api/public/tournament-viewer` flow the chip used. **No-CLS rule:** the header slot reserves the pill's width (as the chip slot does today); pill fades in on resolve; fans/unresolved = empty slot. Offline/slow: pill simply doesn't mount (existing failure mode).
- `/api/public/tournament-viewer` extension: hats already carry `kind/label/href/teamId`; replace static `href` with the CONTEXT the client resolver needs (admin base + tournamentId, coach record path/registrationId, scorekeeper path). Keep the response shape backward-compatible during rollout (ship `href` alongside until all consumers move).
- **Shells (admin/coach/scorekeeper):** server-authenticated, non-SW-cached → pill renders server-fed, no async flash, no new fetches.
- **One literal component** (`components/shared/FlipPill.tsx` + one CSS module) with two feed modes — judge-mandated discipline so the two sides can't visually drift. Neutral "system control" styling (never the event brand); warm-aware tokens for the coach shells (warm is now the platform default theme — 2026-07-22 decision).

## 5. Phases

Each phase independently shippable on `dev`; NO migrations anywhere in this project.

### P1 — Foundation + the admin loop (the sharpest pain)
1. `lib/flip-twins.ts` resolver (both directions, fallbacks, staff scoping, gameId passthrough) + unit tests.
2. `FlipPill` shared component (pill + popover + two-target expand + return-memory read).
3. Admin mobile top bar: bell → More "Notifications" row (+ More tab count badge); pill into the vacated slot, page-matched, `Preview` label pre-launch. *(REVISED — the mobile top bar is now folded into the shared admin header; the bell→More relocation stands.)*
4. ~~Admin desktop: pill top-right of content header~~ **SUPERSEDED by the shared admin header (revision above): one collapsing shell header on every admin screen holds the pill, desktop + mobile; the floating desktop dock is retired.** Delete sidebar-footer View Site (stands).
5. Same-tab everywhere: strip `target="_blank"` from both admin View Site call sites; keep one page-matched mirror row in mobile More.
6. `AdminContextStrip`: new transient candidate `✓ Score saved — See it live ›` after a finalize/score-save on Results (deep-links the public game, highlight param; auto-clears on navigate/dismiss).
7. Unsaved-changes guard on the admin schedule editor + communication composer (same-tab flip can now navigate away from dirty forms that `_blank` accidentally protected).
8. Preview shell "Exit preview" pill (B14).
   **Verify:** typecheck + verify:changed; Playwright — pill presence on every admin screen incl. unmapped fallback, no `_blank` remains, nudge fires post-finalize.

### P2 — Public side (chip → pill; sheet retires)
1. Pill replaces chip in the tournament header slot (client-resolved, reserved width, no CLS); single-hat = direct nav, multi-hat = popover.
2. Return-memory (write on every flip both directions; PWA device verification task — Android + iOS installed app).
3. Retire `TournamentAccountSheet` (+ its module CSS); relocate the coach alerts row into both coach shells' overview in THIS phase.
4. Share displacement: remove header `SharePageButton`; add the Overview share row.
5. `/api/public/tournament-viewer` context extension (backward-compatible).
   **Verify:** anonymous 390px header = title only (no chip, no share); hat-holder gets pill post-hydration with zero layout shift; SW-cached HTML carries no identity; fan flows (follow/bell/install/sign-out) all reachable at their existing homes.

### P3 — Coach side (both tiers) + Scorekeeper

> **✅ BUILT on dev 2026-07-23 (uncommitted — owner reviews first). Owner approved rev 3 of the mockup artifact `claude.ai/code/artifact/564697a9-6622-4511-9815-07a3a7c24508` (= binding visual spec) after two adjustment rounds:** (a) **NO Overview header pill** — the flip rides the live-event surface as a per-event `⇄ Fan view` link (the corner pill exists on exactly ONE coach page: the tournament record, which IS one event); (b) **one placement rule** — the flip link sits on its own line directly beneath the event card/row it belongs to (consistent between Overview and list rows); (c) the free portal-wide cross-team registrations list **joins** the per-row treatment. Build: resolver no-tournament fallback + `resolveScorekeeperFlip` + coach/scorekeeper origin labels (+9 tests, 26 pass); record-page pill + public links single-sourced through exported resolver helpers; both overviews + all three tournaments lists routed through `resolveFlip` (icon honesty fix: ⇄ replaces the open-in-new-tab glyph on same-tab links; accent restyle); score API selects `slug` (NO migration) and ships a `publicTournaments` list consumed by a client context bridging the page fetch → header pill (1 event = direct, 2+ = chooser, none = org site). Logged in `memory/design_decisions.md` (2026-07-23 P3 entry). Remaining: /simplify + /review (HIGH) + /docs + owner QA + commit.

> **SCOPED + REVISED 2026-07-24 — build prompt: `ROLE_FLIP_P3_BUILD_PROMPT.md` (the hard gate above was satisfied — brief + page map + rev-3 mockups approved).** Binding corrections: (a) **Coach flip is CONTEXTUAL, not shell-wide** (owner call — see the revised §3 Coach twins). It lives ONLY on tournament-context coach pages (tournament record, live-tournament Overview, Tournaments-list rows) and NOT on team-management pages (roster/accounting/tryouts/lineups/development/etc.). This makes items 1–4 below SIMPLER: **NO new premium mobile top bar** and **NO shell-wide `useCoachFlip` context plumbing** — the flip lives on pages that already carry their tournament context (`pickAlertRegistration`/`fanViewEntry`/`CoachTournamentRecord`). (b) **Scorekeeper is IN P3, WITH the chooser** — the scorekeeper shell IS tournament-scoped so it keeps a constant header pill; 1 event → direct, 2+ → the `multi` popover. The "scorekeeper existing header link, restyle to pill" below is **stale — none exists; the pill is ADDED**, and the score data carries **no tournament slug** today (SELECT + prop change, no migration). (c) **`resolveToPublic`'s coach/official branch has a no-tournament bug** (broken `//schedule`) — add an org-root fallback. (d) **Warm theme = ZERO pill work** (neutral tokens already remap under the coach warm gate). Items 1–4 below describe the OLD shell-wide model and are superseded by the contextual model in the build prompt.

1. Premium mobile: NEW slim top bar (team/context title + pill) — warm-native tokens, coordinates with the released warm portal; mounts across the org-scoped premium shell.
2. Free workspace: pill into the existing topbar; the two in-page "Fan view" links become page-matched (kept as redundant content links).
3. Landings: public → tournament record; record/schedule/overview → public Schedule; fallbacks per §3.
4. Coach desktop: pill in content header; align `CoachesSidebar` "Back to {org}" behavior (unchanged door, but no `_blank` anywhere).
   **Verify:** J3 round trip = 1 tap out / 1 tap back from record on BOTH tiers; premium coach with zero Basic history (claim-token/org-added) resolves the pill on public pages (WI-2C recognizer).

### P4 — Polish, docs, QA
1. Multi-hat lateral moves: popover inside shells lists other hats (Admin ⇄ Coach) page-aware.
2. Edge sweep: staff capability fallbacks, finished tournaments, hidden public tabs (organizer hid Teams/News → resolver skips those twins), offline.
3. `/docs` help sync: tournament guide (chip → pill copy — help was synced to "chip as tools door" on 2026-07-21 and must be re-synced), admin guide (bell moved to More, flip), coach guide (new top bar + flip).
4. Owner QA script (below) + `/review` (HIGH — nav + auth-adjacent surfaces) before commit.

## 6. Ratified-decision amendments (logged in memory/design_decisions.md)

1. **2026-07-20 Phase 5 §4 door map + 2026-07-21 chip hat-gating** — AMENDED: the hat rows leave the sheet; the chip becomes the FlipPill (hat-gating rule itself unchanged — operators only). The sheet is retired.
2. **"View Site" behavior** — REVERSED: same-tab + page-matched + promoted out of More (mirror kept one release).
3. **Admin mobile top bar composition** — bell relocates to More (badge on More); pill owns the corner.
4. **Public header composition** — share moves into page content (Overview row); operators' corner = pill.
5. **NOT amended:** 4-tab consumer bar (R1 intact — fans unchanged), chrome-floor budget (slot swap, zero net height), P0-3 preview identity-chrome rule (Exit-preview pill is navigation, not identity), red-badge policy for the CONSUMER nav (the More notification badge is admin-shell internal, mirroring the bell count that exists today).

## 7. Risks

- **Return-memory on installed PWA** — sessionStorage across OS context switches unverified → device-test in P2; fallback is stateless resolution (design still works).
- **Same-tab + dirty forms** — the `_blank` removal exposes unsaved-state loss on admin Schedule/composer → P1 item 7 is a hard prerequisite of item 5.
- **Coach top bar vs warm portal** — new chrome on a just-released surface; build warm-native, review with `/design` against the warm frames (TH-5) before P3 merge.
- **Habit disruption** — View Site/bell moved; mitigations: More mirror row (one release), badge parity on More, help-docs sync in P4.
- **No admin standings screen** — Standings→Results is honest-but-imperfect; companion suggestion (compact standings readout on admin Results) logged as a future item, NOT in scope.
- **Concurrent dev-branch work** — warm portal Stage 6 + seam WI-2C are uncommitted/near-committed on `dev`; explicit pathspec staging per branch policy; coordinate before touching shared coach layout files.

## 8. Success criteria

- J1 (fix score spotted on public) ≤ 3 taps; J2 (verify from admin, return) ≤ 2 taps; J3 (coach round trip) = 2 taps both tiers; J4 (multi-hat lateral) ≤ 5 taps — all zero new-tab forks.
- Pill present (or deliberate fan-absence) on 100% of tournament-scoped screens; unmapped shell screens fall back to `Public · Overview`, never absent.
- Anonymous public pages byte-identical except header share removal; zero CLS on pill mount; SW-cached HTML identity-free (existing Playwright check extended).
- Mobile admin notifications ≤ 2 taps with unread badge visible on More.

## 9. Owner QA script (phone, installed app, dev org)

1. As owner at a live test tournament: public Schedule → pill → lands admin Schedule → Results → change + finalize a score → strip nudge "See it live" → lands that game public → pill reads "Back to Results" → returns exactly. Confirm no browser breakout anywhere.
2. Draft tournament: admin pill reads "Preview · …" and round-trips the preview shell; "Exit preview" works.
3. As coach (both tiers): portal overview → pill → public Schedule → pill "Coach view" → tournament record (fee status visible) → Money via tabs → pill → public.
4. Multi-hat account: pill "Roles" popover on public; lateral Coach→Admin via popover inside the shell.
5. Fan sanity: anonymous + signed-in-no-hat see no pill; share row on Overview; game share unchanged; sign-out via Account tab.
6. Admin notifications: bell gone; More badge shows count; row opens the feed.
