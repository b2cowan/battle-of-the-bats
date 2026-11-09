# Build prompt — Navigation, Phase 0: the chosen tournament is right on first paint

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-09, after the owner ruled asks E1–E16 of the
> navigation evaluation (all as recommended). Plan of record: `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md`
> (§1 "Two facts that shape the build", §5 Phase 0, ask E12 (3)). Index: `ADMIN_NAV_BUILD_PROMPTS_INDEX.md`.
> Every later phase reads what this one builds: the tournament moves into the sidebar's top cell in Phase 2, and a cell
> that paints the club and then swaps to the event is a visible flicker at the head of the navigation.

---

Product code. **No visible change** except that a tournament screen no longer names the club (or the organization) for
a moment before it names the tournament.

## The defect (measured 2026-11-09)
A tournament has no address: `/{org}/admin/tournaments/<page>` carries no event. The chosen event lives in browser
storage (`lib/tournament-context.tsx`: the provider fetches the list on the client after mount, then picks the caller's
pick → `?tournamentId` / `?tournamentSlug` → the saved id in `localStorage` → the active one → the first). Until that
fetch resolves, `useAdminPlace` (`components/admin/useAdminPlace.tsx`) has no `currentTournament.slug`, so the desktop
strip and the phone bar name the organization. On the dev server the strip named "UAT Rep Club" for several seconds on
`/uat-rep-club/admin/tournaments/divisions` before "UAT Rep Club Invitational 2026" (`.probe/nav-eval/measure.mjs`,
re-run with `WAIT=9000`).

## Read first
1. The plan's §1 and §5 (Phase 0) and the ruled design log entry (2026-11-09, top of `memory/design_decisions.md`).
2. `lib/tournament-context.tsx` (whole provider: `refresh`, `storageKey`, `setCurrentTournament`, the sandbox contract
   with the demo chrome), `app/[orgSlug]/admin/layout.tsx` (what the server already loads for the org context),
   `components/admin/useAdminPlace.tsx`, `components/admin/AdminTopStrip.tsx`, `components/admin/AdminEventHeader.tsx`,
   `app/[orgSlug]/admin/AdminTitleManager.tsx` (the browser tab title also names the event).
3. `proxy.ts` only if a cookie must be set or read there (AGENTS.md: the proxy convention; do not create `middleware.ts`).
4. Memory `reference_root_hydration_wipes_html_attrs` (a server/client mismatch here would be a hydration failure).

Broad reading goes to a helper (CLAUDE.md); check its claims against the code.

## What this session changes
- The choice is also kept where the **server** can read it (a cookie per organization, written wherever the choice is
  written today: the switcher, a caller's pick, an address's `?tournamentId`/`?tournamentSlug`). `localStorage` may stay
  as the client's copy; one reader decides which wins, and it is the same rule as today.
- The admin layout reads it and hands the provider its **initial** tournament (and enough of it for the bar: name, slug,
  dates, status/phase), so the first server paint names the event. The client fetch still runs and replaces the seed
  with the full list; it must not change what is on screen when nothing changed.
- A chosen event that no longer exists, belongs to another org, or is not one this person may open falls back exactly as
  today (active → first), on the server too. No event a person cannot open is ever named.
- Unchanged: the switcher's behaviour (switching keeps you on the same page), the address shape, the demo sandbox's
  contract with its chrome.

**Not this session:** the sidebar's cell, the strip's content, any restyle. Whether an event earns its own address is a
separate question — record it in the plan's "Not done here", do not build it.

## Gotchas
- A cookie read on the server makes the admin layout dynamic per request; confirm it already is (it reads the session).
- Two tabs on two different events: the last choice wins on the next load in both (today's `localStorage` behaviour).
  Keep it; say so in the walk.
- The tournament list fetch also feeds the sidebar rows and counts — the seed must not render an empty sidebar.
- Sign-out / org switch: a cookie from org A is never read for org B (key it by org).

## Steps
1. Present the **product-manager UX summary** (blocking) and the task list.
2. Build. Then `npm run verify:changed`, `npm run typecheck` (shared context provider), `npm run check:demos`.
3. **Measure and report** with the probe (dev server, saved sign-ins refreshed first): the strip's text on the FIRST
   paint (no wait) and after load on Divisions and Teams for a club's event and a tournament-only org's event, 1440 and
   390. Today: the org's name first. Target: the event's name on the first paint, identical after load. Also a stale
   cookie (a deleted event) and an address-chosen event.
4. `/review` (auth-adjacent: a server read of a client choice). The dev server must be restarted before hand-off (shared
   provider + layout change; AGENTS.md).
5. No separate walk: Phase 2's walk carries "a tournament page names the event from the first moment". Record the
   measurement in the plan's Phase 0 section; update the TODO line and project memory with the positive fact.
6. **Do not commit without asking me.** On my yes, only this session's files, through a private index on HEAD.

## Done when
- On a tournament page the strip (desktop), the phone bar and the tab title name the chosen event on the first paint.
- A stale, foreign or forbidden choice falls back as today, on the server.
- Nothing else on screen changed (measured before/after on a club place and a coach page).
- verify, typecheck, demos pass; `/review` findings applied or recorded.
