# PM Brief — Platform-Wide Notification Settings

> Companion plan: docs/projects/active/NOTIFICATION_SETTINGS_PLAN.md
> Status: awaiting owner sign-off on direction — nothing is built yet.

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

**What ships when:**
- **Phase 1 (the urgent one):** Coaches get a settings page — the weekly digest gets a prominent off switch (fixing the promise already made in the digest's brief) — and the misleading tournament screen gets honest labels. Dead toggles disappear. No database changes.
- **Phase 2:** A simpler default view for everyone (two plain-language groups instead of a 17-row grid, with full detail one tap away), assistant coaches only see toggles for things they can actually receive, settings doors for standalone and free coaches, and a fix for an unsubscribe-link bug that opts out the wrong party.
- **Phase 3 (timed with the fan-accounts project):** the "all my settings" page for multi-hat people, which the fan project plugs into.
- **Explicitly parked, each with a named trigger:** parent/guardian email opt-out (its own compliance project — needs more than a settings screen), the engine's over-notification fixes, and internal ops-alert routing.

**Priority:** High. The digest is already live on dev heading to prod with no off switch, and the coaches audience is the platform's most engaged. The tournament-screen honesty fix protects trust with our core paying customers.

**Success criteria:**
- A coach can turn the weekly digest off in three taps from their own portal, without help docs.
- Every audience has a reachable settings surface (or an explicit, dated reason it's parked).
- No settings toggle exists for a notification that can't actually fire, and no control changes more than it claims to.
- The fan-accounts project lands its settings into this structure without rework.

**Decisions needed from the owner (sign-off gate):**
1. Approve the overall direction (shared panel + per-shell doors now, one aggregate page later)?
2. Coach settings as its own page next to their notifications feed (recommended) or a tab on it?
3. Remove dead toggles outright (recommended) or label them "coming soon"?
4. Ticket the engine over-notification fix now as a separate project (recommended)?
5. Build the aggregate "all my settings" page when fan accounts start (recommended) or sooner?
6. Should coaches see read-only entries for behind-the-scenes events (like "an assistant joined your team") on their new settings page, or keep those invisible as they are today (recommended: keep invisible)?
7. Confirm parking the parent/guardian email opt-out as its own later project (recommended — the one live unsubscribe bug still gets fixed in Phase 2), or expedite it now for compliance?
