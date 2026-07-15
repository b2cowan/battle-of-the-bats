# Prompt — Free App Conversion: Lane 1 Execution

*Owner-authored kickoff for a dedicated build chat. Paste the block below verbatim. Created 2026-07-14 by the conversion-project steward chat; decisions herein are owner-ratified — do not re-open them.*

---

Execute Lane 1 of the Free App Conversion project. All decisions are OWNER-RATIFIED (2026-07-14) — build, don't re-litigate.

READ FIRST: memory/project_free_app_conversion.md (state), docs/projects/active/FREE_APP_CONVERSION_UX_FINDINGS.md (the spec — item IDs below refer to it), the mockups artifact https://claude.ai/code/artifact/8b59eb10-572d-40b7-b3b8-3c9b45c2cc84 (approved visuals for C5/C6; build to them per the build-to-approved-mockups rule).

ALREADY IN THE WORKING TREE, UNCOMMITTED (built by the steward chat — include in your commit, don't redo): C1 nudge 1.6s delay (FollowAccountNudge), C3 price lines (ScopeShelf + ScopeCeilingInterest), coach-bridge Club-only copy (app/coaches/teams/page.tsx), /strategy Facts-doc promo line (PLAN_PRICING_FACTS.md).

BUILD (Lane 1 — no overlap with the Tournament Mobile project):
1. **C2 — auto-attach the triggering team on nudge signup.** In FollowAccountNudge's success path only: after account creation, POST the followed team to the account-follows API (the fire-and-forget mirror already used by the follow button) so the team that prompted signup is attached — no claim-card detour for it. General claim flow stays explicit (locked decision — this entry point only).
2. **S4 (pairs with C2) — nudge success returns to the page the fan was on** (their intent), not /following. Login-link path already honors next; this unifies them.
3. **C5 — post-claim Overview tile.** When the self-entered schedule is empty but the team has tournament registrations, the Overview schedule tile shows the next/live game from the registration (live score + venue + "from {tournament}") per the artifact mock. Data comes from what the registration record page already loads — reuse, don't duplicate (see lib/basic-coach-teams + the tournaments record page).
4. **C4 — one light Premium hook on the team Overview** once ANY section has ≥1 real entry (players/events/fees/announcements) — single quiet line + link in TeamHQ standalone variant, styled like existing ScopeShelf footers, WITH the $29/mo price. Never on the tournament variant (game-day stays pitch-free — locked).
5. **C6a — split the acquisition banner by audience** per artifact: coach-framed banner (existing .coachBanner variant, lime CTA "set up your team") vs organizer-framed (blue-accent CTA "run an event"); pick per visitor context (default alternate/rotate for anonymous; simple heuristic fine — document choice). One CTA each + dismiss.
6. **C6b — mobile organizer door:** on the consumer Account tab, promote the "Run a tournament" footnote to a proper ghost row (both signed-in and signed-out states).
7. **C6c — coaches-hub cross-sell card:** small low-pressure "Run your own event — free to start" card on /coaches (app/coaches/page.tsx), mirroring the existing nudge-card pattern there.
8. **N3a — reword the coach-facing "Follow this team"** (components/coaches/CoachLiveSchedule.tsx): it's a device-only public-page highlight, not alerts — copy must say so (meaning: "pin/highlight on this device's public page").
9. **N3b — one-tap own-team alerts for coaches:** in TournamentAccountSheet, when the viewer has a coach hat, add a "Get alerts for your team" row → follows the team on the account (same mirror API) + turns gameAlerts on + registers this device — reuse lib/fan-alert-prefs-client's saveFanAlertPref/enablePushOnThisDevice patterns (see FollowAlertsToggle's signed-in turn-on). Desktop chip label: initials + "· COACH" per artifact when a coach hat exists (sheet fetch already returns hats).
10. **S2 —** subtle "updated Xs ago" on the Following feed while live-polling. **S3 —** on /account/notifications, render the fan "Followed teams" card above the device card for accounts with zero org/coach cards. **S5 —** quiet "Fan view" link on the coach team Overview when a registration exists. **S6 —** loading skeleton for the coach bottom rail (no more bare-"Home" flash after the fan→coach flip).

DO NOT TOUCH (Lane 2 — queued behind the Tournament Mobile project's remaining rounds; check memory/project_tournament_mobile_polish.md status first): N2 (account-follows hydration of public follow buttons), S1 (ScheduleContent alerts pill), N1 (Discover exit rows — lives inside their G5 More-sheet once built). If Tournament Mobile has committed its Standings/Bracket/Teams rounds AND G5, ask the owner before pulling Lane 2 in.

FIXTURES: flhq.qa.fan@ / flhq.qa.coach@ / flhq.qa.coach.unclaimed@ (all @outlook.com, password FlhqQa!2026-test) on dev-test-org/live-demo. Casey tests C4/C5/N3; Fiona tests C2/S2/S3. Re-seed spec in the FINDINGS doc if state drifts. Verify each item against its journey step with a quick Playwright pass at 390x844 (computed styles, not screenshots alone).

STANDING RULES: dev branch only; another chat shares this working copy (re-check HEAD; explicit pathspecs; git show --stat after commit); verify:changed + typecheck (shared modules touched); restart dev server after file-adds/shared edits (stop → rm .next → start, and beware a sibling chat's server on :3000); NO commit without explicit owner OK; offer /simplify then /review after the build; /docs if user-facing flows changed (C6/N3 qualify); product-owner voice in summaries; update memory/project_free_app_conversion.md + TODO.md line when done.
