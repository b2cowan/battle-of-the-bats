# Owner Journey Scripts — refreshed against the as-built lanes (2026-07-17)

Six short journeys, one per persona, on your actual phone (push/install/thumb-feel are the point — the agents can't judge those). **All 12 ratified decisions are now BUILT (Lanes 1+2)** — so each journey is a verify-and-feel pass, not a design probe. Every step lists the expected outcome; anything that doesn't match is a bug — say so and it gets fixed without discussion. These double as promotion QA.

**Before you start:**
- Accounts + password in FREE_APP_CONVERSION_UX_FINDINGS.md (same folder). Sign out between journeys.
- If no games are live today, re-run the live-tournament seeder — **and re-link the QA personas after** (the seeder wipes team rows and orphans Casey's claim + Fiona's follows; relink spec in the FINDINGS doc). Fixtures were last re-seeded + relinked 2026-07-17.
- Playoffs are seeded to land on seed day: semifinals in the morning, final midday. Outside those windows, "live score" moments show as upcoming games instead — both states are correct.

---

## Journey 1 — The grandparent (no account, ~5 min)
**You are:** Ava's grandmother. You heard "she's playing in Milton this weekend." App installed, no account.
**Path:** open the app → Discover → search for the live demo event → find a score → follow a team (when the account offer appears, choose "just follow on this device") → check the Following tab → back into the tournament → now get back to Discover **without** the system back button.
**Expect:** the follow lands first and the account offer arrives a beat later (never on the same tap); the way out is **More → Browse tournaments** (a FieldLogicHQ section at the bottom of the sheet — this is the shipped §8 exit).
**Taste:**
1. The pause before the account nudge — does the ask now feel like a follow-up rather than a toll?
2. Did you find the More-menu exit on your own, and does "Browse tournaments / Live scores" read as *the app* rather than *this event*?
3. Did anything make you feel you *needed* an account when you didn't?

## Journey 2 — The parent who wants alerts (~7 min)
**You are:** a parent who wants a buzz when the game goes live. Start signed out, **fresh browser state** (or clear site data).
**Path:** tournament page → follow a team → when the account offer appears, create the account right there (use a throwaway email) → note where you land → check the team's follow button → Account → Notification settings.
**Expect:** after signup you land **back on the page you were watching** (not a different tab), and the team you followed is **already on the account** — no claim step for it (this is the C2/S4 flow no machine ever tested end-to-end; it's the headline check of the whole session). The schedule's alerts pill reads **"Sign in for alerts"** while signed out — never a dead-looking button. In Notification settings, the **Followed teams** card sits above the device-plumbing card for a fan-only account.
**Taste:**
1. Was the signup moment fair at the diamond — 20 seconds or less?
2. Push test: turn alerts on, have a score change (or use the device tester) — did the buzz arrive?

## Journey 3 — Fiona's daily check + the new-phone moment (~5 min)
**Path:** signed out, fresh state, on the tournament page → sign in as **Fiona** → watch the page for a moment → Teams tab → Following tab → then sign out (Account → sign out) → return to the tournament page.
**Expect:** within a beat of signing in the page *recognizes* her — her most recent team pins itself as "my team" (dock/scorebug on game day, highlighted row on standings, card pinned to the top of Teams) and **both** her teams read "Following" — with zero re-following (this is N2, the "every device" promise). While a game is live, the Following tab shows a quiet **"updated Xs ago"** beside Live now. After sign-out, the auto-pin **disappears** (shared-device hygiene) — but a team followed by actually tapping Follow on the device would stay.
**Taste:**
1. The moment the page personalizes itself a beat after load — delightful or "why did the page just move"? (Reviewers judged it acceptable; you're the tiebreak.)
2. Fast enough to be a daily habit?

## Journey 4 — Riley claims their team (~6 min)
**Path:** sign in as **Riley** → note what's offered → claim Bears U11 → look at what you see FIRST after claiming → find today's game from there.
**Expect:** the Overview's Schedule tile shows the **next or live tournament game** — opponent, venue, "from Live Demo — Game Day," live score with a red LIVE dot during play — never "Schedule: None" mid-event (shipped C5). A quiet **Fan view** link under the tournament history jumps to the public site (S5).
**Taste:**
1. Did the claim offer feel trustworthy or phishy?
2. After claiming — "this is useful" within 10 seconds?

## Journey 5 — Casey's game day + the $29 question (~8 min)
**Path:** sign in as **Casey** → team Overview → Fan view link to the public site → open the account sheet (More on phone) → tap **"Get alerts for your team"** → back to the coach view via the sheet → on the record page find the highlight control → then read the Premium line at the bottom of the Overview → follow it toward checkout → stop at the pay screen.
**Expect:** the sheet offers own-team alerts in one tap (confirms with "Alerts on for your team"); on a desktop-width window the account chip reads **"CC · COACH"**. The old "Follow this team" is now **"Highlight my team"** with a pin icon and copy that says it does NOT send alerts (N3a). The Overview carries one quiet Premium line **with "$29/month per team"** once the team has any content (C4) — no longer parked only on Explore.
**Taste:**
1. The fan⇄coach round trip: would you do it between innings, one-handed?
2. One-tap alerts as a coach — does it feel like the platform finally knows who you are?
3. At the pay screen: did you know exactly what $29/mo buys before you tapped?

## Journey 6 — The rival organizer (~5 min)
**You are:** a parent at someone else's free event thinking "I could run this better." Signed out.
**Path:** open `free-test-org/free-cup` → read the bottom banner → reload once and read it again → tap its button → stop before creating anything → then: Account tab, find "Run a tournament" → and (as Casey) glance at the coaches hub for the "Run your own event" banner.
**Expect:** the banner speaks to ONE audience per impression — lime coach-framed ("Set up your team — free") or blue organizer-framed ("Run an event — free") — and **alternates between visits** (C6a); the Account tab has a proper "Run a tournament" row in both signed-in and signed-out states (C6b); the coaches hub carries a low-pressure organizer banner unless a claim is pending (C6c).
**Taste:**
1. Whichever variant you got — did it read as aimed at YOU?
2. Without the banner, would the Account-tab row have been findable?

---
**While you walk:** mechanical misses get fixed without discussion; taste reactions get logged against the shipped decisions. When all six pass, the release checklist item "conversion-lane QA" is done.
