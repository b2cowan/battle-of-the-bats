# Build Prompt — The Flip, Phase 2: the public side (chip → pill, sheet retires, "see it live" flash)

Paste this into a fresh chat to build Phase 2 of the ratified Role⇄Public navigation project. Phase 1 (the admin side + shared header) is COMMITTED on `dev` (`cb52d118` + `c043736`).

---

You are building **Phase 2 of "The Flip"** — the public side of the unified role⇄public navigation (ratified 2026-07-22; admin side shipped Phase 1).

## Read first (in this order)
1. `docs/projects/active/ROLE_FLIP_NAVIGATION_PLAN.md` — the full spec; Phase 2 = §5 P2 (items 1–5) plus the highlight-consumption seam (below). §2 (displacements), §3 (twin map), §4 (identity/rendering constraints) are binding.
2. `memory/design_decisions.md` — the 2026-07-22 "The Flip RATIFIED" entry, the 2026-07-22 shared-admin-header revision, and the 2026-07-23 uniform "Public site" label decision. Binding.
3. The committed Phase-1 code you build ON (do not re-derive):
   - `lib/flip-twins.ts` — the single twin resolver. The **`to-role` direction is already built + unit-tested** (`lib/flip-twins.test.ts`) — Phase 2 wires it to the public pill. Note the param convention: **public deep-links use `?highlightGameId=`; admin uses `?gameId=`** (do not mix them).
   - `components/shared/FlipPill.tsx` — the ONE shared pill (single + multi popover + `compact` icon-only + return-memory READ). Phase 2 adds its **client-fed mode** on public pages.
   - `lib/use-admin-flip.ts` — the admin adapter hook. Phase 2 needs a **public adapter** (client-resolved via the anonymous tournament-viewer flow) — mirror this pattern, do NOT fold public logic into the admin hook.
4. `git status` + `git log --oneline -5` — `dev` carries concurrent uncommitted work. Work on `dev` (never another branch), stage **explicit pathspecs only**, **never commit without an explicit owner OK**.

## Phase 2 scope (public tournament pages — do NOT touch the admin shell or coach shells; those are done / P3)
1. **Pill replaces the account chip** in the public tournament header slot. Client-resolved via the EXACT `useClientSignedIn` + `/api/public/tournament-viewer` flow the chip used (SW caches HTML anonymously — never SSR identity). **No-CLS:** reserve the pill's width like the chip slot does today; fade in on resolve; fans/unresolved = empty slot. Single-hat = direct nav; multi-hat = the FlipPill popover (one row per hat held on THIS event). Neutral styling, never event-brand.
2. **`/api/public/tournament-viewer` context extension** — replace each hat's static `href` with the CONTEXT the client resolver needs (admin base + tournamentId; coach record path/registrationId; scorekeeper path). Keep the response backward-compatible during rollout (ship `href` alongside until all consumers move).
3. **Return-memory WRITES** — write the sessionStorage snapshot `{originUrl, label}` on every flip, BOTH directions (the read + helpers already exist in `lib/flip-twins.ts`). ⚠ **Device-verify on the installed PWA (Android + iOS)** before treating it as reliable; if flaky there, ship stateless-only (the read already falls back).
4. **Retire `TournamentAccountSheet`** (+ its module CSS). Hat rows are now the pill/popover. **In the SAME phase**, relocate the coach one-tap alerts row (N3b) into BOTH coach shells' overview — no coverage gap. The fan rows (follow / bell / get-app / sign-out) were duplicates of the follow strip / Teams tab / alert prompts / install prompt / Account tab — delete.
5. **Share displacement** — remove the header `SharePageButton` (all public tournament pages); add a share row/action into the **Overview** page content. Game score-card share + champions-page share are content-level already — leave them. The fan header gets its corner back.
6. **THE SEAM (Phase-1 → Phase-2 handoff): the public schedule must consume `?highlightGameId=`.** Today the admin "✓ Score saved — See it live" nudge + the pill deep-link land on `…/schedule?highlightGameId={id}` but nothing highlights the game. Wire `ScheduleContent` (used by the live route AND the admin preview `[section]` route) to read the param, **scroll to that game's row and briefly flash/emphasize it**, then clear the param. This closes the loop the owner called "see it live." Respect the public-token guardrail (no literal hex) + no-CLS.

## Constraints
- **NO migration.** No admin-shell or coach-shell changes (P1 done / P3 separate). Do NOT touch the 4-tab consumer bar (fans byte-identical). SW-cached HTML must stay identity-free (existing Playwright check — extend it).
- Sport-neutral copy; CSS modules only; match surrounding code style. Public `*.module.css` = the public-token ratchet applies (tokens only, no hex).
- `npm run verify:changed` + `npm run typecheck` (shared modules touched). Dev-server restart rule (new files + shared modules → stop server, `rm -rf .next`, restart before owner testing).
- After building: offer `/review` (HIGH — public identity rendering + anonymous-SW-cache safety + the viewer-API contract) and `/docs` (the tournament help was synced to "chip as tools door" on 2026-07-21 and must be re-synced to the pill; this is P4's full sweep, but flag any copy that's actively WRONG after P2).
- Completion summary in product-owner voice (UX outcomes), ending with the P2 slice of the owner QA script (plan §9 steps 3–5 + the highlight check).

## Definition of done
- On a public tournament page, a hat-holder (coach/admin/official) sees the pill in the header corner (client-resolved, reserved width, zero CLS); a fan/signed-out visitor sees no pill; the pill flips same-tab, page-matched, into their tools.
- The account pop-up sheet is gone; the coach alerts row lives in both coach overviews; Share lives in the Overview page; the fan follow/bell/install/sign-out doors all still work at their existing homes.
- Finalizing a score and tapping "See it live" (or the pill from Results) lands on the public schedule with **that game scrolled into view and highlighted**.
- Anonymous public HTML byte-identical except the header share removal; SW-cached HTML identity-free.
- typecheck + verify:changed green; NOT committed (owner reviews first).
