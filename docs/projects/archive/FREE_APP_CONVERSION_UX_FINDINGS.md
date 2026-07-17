# Free App Experience & Conversion — Step 1 Sweep Findings

**Status:** Step 1 COMPLETE (2026-07-14). Six persona journeys walked end-to-end at phone size against live fixtures. 6 mechanical defects fixed silently (appendix), 2 pricing-drift items flagged for /strategy, and the **12 judgment calls below** await owner decisions. Mockups artifact accompanies the visual ones. Step 2 = owner journey scripts (FREE_APP_CONVERSION_UX_JOURNEYS.md).

**Headline take:** the free app is mechanically solid — five of six journeys had zero broken product code, copy is honest everywhere it was checked, and the coach round-trip is genuinely tight (2 taps each way). The gaps are concentrated in three places: (1) the app goes *identity-blind* on public pages — it knows who you are but the page doesn't show it; (2) several conversion pitches are parked in navigation rather than placed at the moment value is felt; (3) the organizer funnel had real breakage (now fixed) and still has reach gaps on mobile.

---

## A. Navigation & identity cluster (the big three — interlocking, decide together)

### N1 [HIGH] — No way back to Discover from inside a tournament (§8, now measured)
Anonymous visitor inside any tournament: every nav link (18 counted) points inward; the wordmark means "this tournament's home"; the only exit is the browser back button — which does not exist for QR/shared-link arrivals in the installed app. This is the deferred §8 decision with hard data behind it.
**Options (mockups in artifact):** (a) an anonymous version of the account-chip sheet (Browse tournaments / Live scores rows for everyone); (b) host the exit inside Tournament-Mobile's proposed G5 "More" bottom-sheet — one sheet for nav + doors + exit (RECOMMENDED if G5 is confirmed — one design, both problems); (c) a split top-bar affordance (wordmark stays tournament-home; a small grid glyph exits).
**Coordination:** G5 supersedes the Phase 3 mobile chip; decide G5 and N1 together.

### N2 [HIGH] — Signed-in follows are invisible on public pages (the "every device" promise gap)
Follow buttons/stars/dock on public tournament pages read only this device's memory. A signed-in fan sees "Follow" on teams her account follows; unfollowing takes two taps; the My Team pin doesn't appear on a new device until she re-follows. The Following tab is correctly account-wide — only in-page personalization is device-siloed.
**Recommendation:** signed-in pages should *display* merged account+device follow state (read-only merge — no silent data writes, preserving the explicit-claim rule; unfollow while signed in updates both). ~1 day on verified fan surfaces; needs your go-ahead, not more design.

### N3 [MED] — The public page never says "you coach this team"
The account chip shows anonymous initials; the sheet inside knows everything ("You coach here — Coach view") but nothing on the page says so. Worse, coach surfaces show a "Follow this team" control that is actually the anonymous device-highlight — a coach would reasonably believe they enabled alerts. The platform's highest-intent alerts customer (a signed-in coach at their own game) has no bridge to own-team alerts.
**Recommendations:** (i) reword the coach-facing "Follow this team" to what it is (device highlight); (ii) add a one-tap "Get alerts for your team" for signed-in coaches (rides the existing account-alerts model); (iii) fold chip labeling into the N1/G5 design.

## B. Conversion moments

### C1 [MED] — The account nudge fires on the same tap as Follow (anonymous)
Reads as an instant signup wall on a one-tap gesture. **Rec:** ~1.5s delay or defer to next navigation; keep the 30-day dismiss.

### C2 [MED] — Signing up from the follow nudge doesn't attach the team that triggered it
The nudge promises "keep this follow" — then lands on /following asking you to claim that very team. **Rec:** auto-attach that ONE team on this entry point only (same device, same session, seconds after the promise); the general claim flow stays explicit. Decision-adjacent to the explicit-claim rule — your call.

### C3 [MED-HIGH, fast approve] — $29/mo visible on only 1 of 3 Premium pitch surfaces
Explore states the price; the per-section nudges and the post-event pitch don't. **Rec:** add the price line to both (copy in artifact).

### C4 [MED] — Premium pitches are nav-parked for exactly the coaches most likely to convert
Per-section nudges only render once that section has content (4 independent thresholds) — a new/light coach sees pitches ONLY on the Explore tab. **Rec:** one light hook on the team Overview once ANY section has its first real entry.

### C5 [MED] — Post-claim "aha" undermined: "Schedule: None" during a live tournament
The freshly-claimed coach's Overview says "Schedule: None — no upcoming events" while their team has a game TODAY (the real schedule lives two taps deeper and is excellent). **Rec (mockup in artifact):** the Overview tile shows the next/live game from the tournament registration.

### C6 [MED] — Organizer-funnel bundle
(i) Acquisition banner headline is coach-framed while the lime CTA is organizer-framed — mismatched hierarchy; (ii) mobile has no organizer door outside that banner (desktop-only header link + an Account-tab footnote); (iii) the coaches hub — a high-intent audience — has zero "run your own event" cross-sell. **Rec:** split the banner into its two audiences (a coach variant already exists in code), add ONE mobile door, add a small cross-sell card on the coaches hub.

## C. Smalls (batch-approve)
- S1 Mobile "Score alerts" pill: add the sign-in cue its sibling controls have (signed-out).
- S2 Live scores: tiny "updated Xs ago" hint while polling.
- S3 Notification settings: fan's "Followed teams" card above the device-plumbing card for fan-only accounts.
- S4 Post-signup destination differs by entry point (nudge → Following; login-link → original intent) — confirm intended.
- S5 Fan view link also on coach team Overview (today: Tournaments tab only).
- S6 Coach nav-rail flashes bare "Home" ~3s after the fan→coach flip (needs a loading skeleton; deferred mechanical).

## D. Drift flags → /strategy (not silently editable)
1. PLAN_PRICING_FACTS.md lists Tournament Plus at $39/mo with no mention of the live Founding-Season $0 promo (ends 2027-01-01) — the canon doc is the one place this is missing.
2. Premium-workspace empty-state copy says the portal "carries over if your organization joins FieldLogicHQ" — Facts doc says absorption is Club-tier only.

---

## Appendix — mechanical defects fixed silently this sweep
1. Share-link "Follow?" banner crushed at phone width for real team names (shrink-to-fit flex; now real width).
2. Acquisition banner's "Run an event" CTA physically untappable on mobile (sat under the tab bar; chrome now lifts clear of it).
3. "Powered by FieldLogicHQ" badge floated mid-page after banner dismissal (server prop couldn't see client dismissal; now client-tracked).
4. Warm-upgrade checkout unreadable on phones (attribute selector beat the mobile collapse; the PAID FUNNEL'S FINAL STEP — now collapses correctly).
5. Account-only signup carried staff-invite copy ("accept your invitation") for fans; neutral fan-first copy now.
6. Four screens (claim page + all three /start forms) 500'd the whole dev server from a stale style import after the Phase 3 auth move (repair verified; bundled for commit).
Plus: demo tournament now listed in the directory so journeys can start from search.

## Fixtures for Step 2 (re-seeded pristine 2026-07-14)
- flhq.qa.fan@outlook.com — Fiona, follows Halton Hawks U11 Jr (Johnstone) + Lions U11
- flhq.qa.coach@outlook.com — Casey, claimed "Milton Bats U11 Purple (Jackson)"
- flhq.qa.coach.unclaimed@outlook.com — Riley, Bears U11 waiting to be claimed
- Password (all): FlhqQa!2026-test · Tournament: dev-test-org/live-demo (re-run the live seeder if the game-day window has passed)
