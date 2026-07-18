# Unified App — Phases 0 + 1 owner test plan

Run this **after the changes are on the dev deploy**. It covers the new front door (Phase 1) and the one-app install identity (Phase 0), plus regression checks that nothing else broke. The device-install part (Part 4) is the same coexistence spike described in `UNIFIED_APP_PHASE0_SPIKE.md`.

**You'll need:** a desktop browser, an Android phone (main event — install behaviour), and an iPhone if you have one. ~30 minutes total. Parts 1–3, 6–7 are quick browser checks; Part 4 is the important one.

**Note on scope:** the dev working copy also carries other in-flight work (coach awards, dues reminders, insights digest). This plan only exercises the unified-app front door and install identity — if something in those other areas looks off, it's unrelated to this.

---

## Part 1 — The new front door (desktop browser) · ~5 min
1. Go to **/discover**. Expect: the tournament directory now sits inside an app-like shell — a top bar with the FieldLogicHQ wordmark on the left and four links (**Discover · Scores · Following · Account**) on the right. No marketing top-nav or footer around it.
2. Click **Scores**. Expect: a "Scores" page. If any tournament is live right now it's listed with a green **Live** tag; otherwise a friendly "No games are live right now" with a **Browse tournaments** button.
3. Click **Following**. Expect (on a device that hasn't followed anyone): "You're not following any teams yet" + a **Browse tournaments** button.
4. Click **Account** while signed out. Expect: "Sign in to manage your organizations, teams, and season" with **Sign in** / **Create free account** buttons, and a note that following needs no account.
5. Click the **FieldLogicHQ wordmark**. Expect: back to Discover.
6. Go to the site **root (/)** in the browser. Expect: the **same organizer marketing homepage as before** (personas, pricing) — NOT the directory. (Only the *installed app* opens to the directory; the website root is unchanged.)

## Part 2 — Follow → Following/Scores wiring · ~5 min
7. From Discover, open a listed tournament and **follow a team** (the follow star on the schedule/teams pages).
8. Go back to **/following**. Expect: the team you followed shows as a card; tapping it takes you to that tournament.
9. Open **Scores**. Expect: a **"Your teams"** section at the top listing your followed team(s).
   - This confirms the tabs are driven by the teams you follow on this device.

## Part 3 — Mobile app shell (phone browser) · ~3 min
10. On a phone browser, open **/discover**. Expect: a **bottom tab bar** (Discover / Scores / Following / Account) instead of the desktop top links; tapping switches pages; the active tab is highlighted.
11. Drill into a tournament from Discover. Expect: the consumer bottom nav **gives way to the tournament's own tabs** (News/Schedule/Standings/Teams/Rules) — no two nav bars stacked.

## Part 4 — One-app install + smart open (Android — the spike) · ~10 min
> This is the go/no-go check for the install-identity change.
12. Android Chrome → open a tournament page → menu → **Add to Home screen**. Expect: the icon is named **FieldLogicHQ** (not the event name) and opens into that tournament.
13. If you still have an **old event-branded icon** from before: confirm it still opens its event, now shows a slim **"You're on an older version — Get the new FieldLogicHQ"** banner, and that both icons sit on the home screen at once without stealing each other's links. *(This coexistence is the spike's pass/fail.)*
14. Open the **new FieldLogicHQ icon while signed out**. Expect: lands on the **directory**, not a login wall.
15. **Sign in**, then reopen the icon. Expect: your normal workspace (a single workspace opens directly; multiple shows the picker) — same as today.
16. With the app installed, tap a **tournament share link**. Expect: it opens **in the app**, on that tournament.
17. Push sanity: follow a team on a **Tournament Plus** event and confirm a score alert arrives. *(This also depends on the separate production push fix — note it if nothing arrives.)*

## Part 5 — iPhone (if available) · ~3 min
18. Safari → a tournament page → Share → **Add to Home Screen**. Expect: label **FieldLogicHQ**, opens into the tournament. *(iOS gives no coexistence guarantees — just record what you see.)*

## Part 6 — Regression: nothing else broke · ~5 min
19. An existing **public tournament page** loads and works (schedule, standings, teams) with its normal look.
20. **Org admin** dashboard loads normally; the "Download app" / install prompt still works.
21. **Coach portal** loads normally.
22. **Scorekeeper** surface loads; its install prompt works; the app/tab name reads FieldLogicHQ.
23. **Sign out and back in** via the normal login → routes to your workspace as before.

## Part 7 — Copy checks · ~3 min
24. Open a **Tournament Plus** event's **Branding → App Icon**. Expect: copy describes your event's **branded space inside the one app**, with no promise of a separate per-event home-screen icon.
25. In-app **Help → Tournaments**, search **"app icon"**. Expect: the answer says fans install **one** FieldLogicHQ app and your event gets a branded space inside it.

---

## Expected / known limits (not bugs)
- **Following and Scores are per-device for now.** A team you follow on your phone won't appear on your laptop yet — account-linked follows that travel across devices are Phase 2.
- **iPhone installs have no coexistence guarantee** — Part 5 is informational only.
- **The Part 4 push alert** depends on the separate production push (VAPID) fix, not this change.

## Pass / fail
- **Go/no-go:** Part 4 steps 12–13 (FieldLogicHQ-named install that opens the tournament, old and new icons coexist) and steps 14–15 (signed-out → directory, signed-in → workspace).
- **Phase 1 gate:** Parts 1–3 (the shell and tabs) and Part 6 (nothing else regressed).
- Log the result into the project's memory note when done.
