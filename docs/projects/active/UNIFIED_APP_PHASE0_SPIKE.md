# Phase 0 spike — multi-install coexistence (unified-app)

**Purpose:** the plan gates Phase 0 on a technical spike verifying that old, per-tournament/scorekeeper PWA installs and the new single-identity install coexist cleanly during the transition (`UNIFIED_APP_CONSUMER_LAYER_PLAN.md` §Phase 0.7). App-install behaviour can only be confirmed on real devices, so this doc has two parts: (A) why the build is correct by construction, and (B) the device protocol for the owner to run on the dev deploy.

## A. Why coexistence is correct by construction

- **PWA identity is keyed on the manifest `id`.** Before: platform `id: /home`, per-tournament `id: /{org}/{tournament}`, scorekeeper `id: /{org}/scorekeeper` — three separate identities. After: one `id: /`, `scope: /`, `start_url: /?source=pwa`.
- **A changed `id` never migrates an existing install in place** — the browser treats the new `id` as a different app. So every old install (platform `/home`, each per-tournament icon, scorekeeper) stays exactly as it was: it still launches its old deep URL, still works as a shortcut, but is frozen (no further manifest updates) and can sit beside the new install. Nothing errors; the underlying pages all still exist.
- **New installs pick up the one identity.** Any page — a tournament page, `/home`, scorekeeper — now points `<link rel="manifest">` at `/manifest.json` (`id: /`), so a fresh "Add to Home Screen" from anywhere installs the same FieldLogicHQ app.
- **Link capture:** the new install's `scope: /` means the OS routes any in-app `https://<origin>/…` link into the one app. The old per-tournament installs had a narrow scope (`/{org}/{tournament}`), so they only ever captured their own event's links — they can't steal links from the new app, and vice-versa the new app captures everything else.
- **Launch routing:** the app opens at `/?source=pwa`. The root router (`app/page.tsx`) sends a signed-in user to their workspace and an anonymous user to `/discover`; a browser visit to `/` with no `source=pwa` still renders the marketing homepage unchanged (SEO intact).
- **Legacy nudge:** `LegacyInstallBanner` self-gates to standalone sessions that launched with the old `?pwa=1` marker (per-tournament/scorekeeper) and links out to `/discover` in the browser so the user can install the current app. The new app never sets `pwa=1`, so it never shows the banner.
- **Old manifest URLs still resolve:** the per-tournament and scorekeeper `manifest.webmanifest` routes now 308-redirect to `/manifest.json`, so an old install re-fetching its manifest gets the unified one (and, per the `id`-change rule above, still does not migrate — it stays frozen). No 404s, no broken installs.

## B. Device protocol (owner — run on the dev deploy)

> Requires one commit+push to `dev` first (device testing can't hit localhost). ~15 min. Use an Android phone (primary) and an iPhone if available.

**Android — coexistence (the core check):**
1. *Before updating*, if you still have an old tournament-branded icon on the home screen, leave it there. (If not, it's fine — the near-zero installed base is the whole reason we're doing this now.)
2. Open a tournament page in Chrome → menu → **Add to Home screen**. Expect the icon to be named **FieldLogicHQ** (not the event name) and to open into that tournament.
3. Confirm the **old** tournament icon (if any) still opens its event and now shows the slim "You're on an older version — Get the new FieldLogicHQ" banner. Confirm both icons sit on the home screen at once and neither hijacks the other's links.
4. Tap a tournament share link while the new app is installed → it should open **in the app** (scope `/`), landing on that tournament.
5. Push sanity: on the new install, follow a team on a Tournament Plus event and confirm a score alert still arrives (this also depends on the separate prod VAPID fix — note if it doesn't).

**Android — entry routing:**
6. Open the new FieldLogicHQ icon while **signed out** → expect the directory (`/discover`), not a login wall.
7. Sign in, reopen the icon → expect your normal workspace (single workspace auto-opens; multiple shows the picker). No change from today.

**iPhone (if available):**
8. Open a tournament page in Safari → Share → **Add to Home Screen** → expect the label **FieldLogicHQ** and that it opens into the tournament. (iOS gives no install API and no coexistence guarantees; this is a best-effort check — record what you see.)

**Copy check (any browser):**
9. Open a Tournament Plus event's **Branding → App Icon**: the copy should describe your event's branded space *inside the one app*, with no promise of a separate per-event home-screen icon. Confirm the pricing page never promised "your own app" (it doesn't).

**Pass/fail:** the spike passes if step 3 (two installs coexist, no link hijack) and steps 6–7 (entry routing) hold on Android. iOS is informational. Log the result back into the project memory file.
