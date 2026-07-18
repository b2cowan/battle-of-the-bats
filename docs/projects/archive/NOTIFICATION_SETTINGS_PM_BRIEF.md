# PM Brief — Platform-Wide Notification Settings

> Companion plan: docs/projects/active/NOTIFICATION_SETTINGS_PLAN.md · visual decision pack: https://claude.ai/code/artifact/f84fbc06-0753-47e7-a796-26f764fd4366
> Status: **direction approved — all 7 decisions locked by the owner 2026-07-13.** Nothing built yet; build starts on owner go.
>
> **What was decided:** Because the platform has no live coaches or customer orgs yet, the owner chose the stronger end-state directly: **one "All your notification settings" page ships first**, and every portal's bell links straight into it, opened on the section you came from. The tournament screen becomes purely "mute this tournament." Dead toggles are removed outright. The engine over-notification fix is ticketed as its own project. Behind-the-scenes pings stay invisible in settings. The wrong-party unsubscribe bug gets fixed in Phase 2 while the full parent-email opt-out is parked as its own project (risk explicitly accepted).

**What it does:** Gives every kind of user one findable, honest place to control what the platform sends them — the bell, phone push, and email — built on the notification engine we already have. Today only org admins have any controls; coaches, fans, and parents have none.

**Why it matters:** We keep adding notifications faster than we add ways to manage them. The new weekly coach digest went out push-on-by-default with literally no off switch for coaches — not because anyone chose that, but because coaches have no settings screen at all. Every audience we can't offer an off switch to is a future complaint (or an anti-spam compliance problem) waiting to happen.

**Who benefits:**
- **Coaches** (head, assistant, standalone premium, and eventually free tournament coaches) — first-ever notification settings, in their own portal.
- **Tournament organizers** — their current settings screen stops misleading them (a "for this tournament" control that secretly changes every tournament).
- **People wearing several hats** (admin + coach, multiple orgs) — one place to see all their settings instead of hunting shell to shell.
- **Fans/parents** — their settings home is reserved and coordinated with the fan-accounts project, so the two won't collide.

**What we found in the audit (the headline):**
- Four separate notification systems run in parallel: the main engine (bell/push/email to org staff and coaches), an anonymous fan-push system, ~50 direct email types, and internal ops alerts.
- 21 notification types exist; 5 of them are dead — they show up as toggles on the admin settings screen but can never actually fire.
- Whole audiences have zero control: coaches (the digest gap), fans with accounts, parents/guardians (who receive recurring dues-reminder and announcement emails with no way to opt out — our biggest anti-spam exposure), and scorekeepers.
- The tournament-level settings screen has a real honesty bug: its channel choices look tournament-specific but silently apply org-wide.
- Coaches are also over-notified by the engine itself (they get playoff/score alerts for every tournament in the org, not just their own team's) — flagged as its own follow-up project, separate from this one.

**The recommendation (after weighing three options):** Don't build one giant settings page, and don't scatter one-off toggles. Build **one shared settings panel used everywhere**: each audience gets a door in the shell they already live in (bell icon → settings, same as admins have today), and later one "all my notification settings" page collects every hat a person wears — which is also exactly where fan-account settings will land when that project ships. Three rules lock the experience: anything that's on by default gets an always-visible off switch (never buried); no control ever silently changes more than it says it does; and one plain sentence explains scope everywhere: "Org settings decide what you receive; tournament settings can only mute."

**What ships when (as decided):**
- **Phase 1:** The "All your notification settings" page — one card per role you hold, with the coach card leading with the weekly digest's off switch (fixing the promise already made in the digest's brief). Every bell across the product links into it. The misleading tournament screen becomes honestly mute-only, and the five dead toggles disappear. No database changes.
- **Phase 2:** The simpler default view (two plain-language groups instead of a 17-row grid, full detail one tap away), assistant coaches only see toggles for things they can actually receive, an entry point for free coaches, and the fix for the unsubscribe-link bug that opts out the wrong party.
- **Phase 3 (at fan-accounts kickoff):** the fan "Following" card lands on the already-shipped page — per-team alert choices (all / game-day only / mute).
- **Explicitly parked, each with a named trigger:** parent/guardian email opt-out (its own compliance project — needs more than a settings screen), the engine's over-notification fixes (now ticketed), and internal ops-alert routing.

**Priority:** High. The digest is already live on dev heading to prod with no off switch, and the coaches audience is the platform's most engaged. The tournament-screen honesty fix protects trust with our core paying customers.

**Success criteria:**
- A coach can turn the weekly digest off in three taps from their own portal, without help docs.
- Every audience has a reachable settings surface (or an explicit, dated reason it's parked).
- No settings toggle exists for a notification that can't actually fire, and no control changes more than it claims to.
- The fan-accounts project lands its settings into this structure without rework.

**Decisions made (owner, 2026-07-13):**
1. Direction: **the aggregate page ships first** (revised from "doors now, page later" once the owner confirmed no live coaches/customer orgs exist to disrupt); every bell links into it.
2. Coach settings stay a separate destination from their activity feed. ✓
3. Dead toggles removed outright. ✓
4. Engine over-notification fix ticketed now as its own project. ✓
5. The fan "Following" card joins the page at fan-accounts kickoff. ✓
6. Behind-the-scenes events stay invisible in settings. ✓
7. Parent-email opt-out parked as its own project; the wrong-party unsubscribe bug is fixed in Phase 2. ✓ (interim risk explicitly accepted)
