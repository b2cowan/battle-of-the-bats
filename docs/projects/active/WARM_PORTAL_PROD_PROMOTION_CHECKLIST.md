# Warm Coaches Portal — Production Promotion Checklist

**Status:** READY on dev (`origin/dev` @ `5d63fc68`), NOT on prod. Prepared 2026-07-22.
**Prod baseline:** `origin/master` @ `4ad3f772` (schema watermark: migs ≤ **192** applied).
**Orchestrate with `/release`** — it enforces the gates below. This doc is the human-readable pre-flight.

---

## 0. READ THIS FIRST — scope reality

**Promoting is a whole-branch release, not a warm-portal-only release.** The prod deploy mechanism is
`git push origin dev:master`, which ships **every commit on `dev` (currently 53 ahead of prod)** — the
warm coaches portal AND everything else other chats have landed on `dev` (Tournament Seam P3, chat
reports/self-mute, notification settings, rep-team registrations, etc.). There is no supported way to
ship *only* the warm portal without cherry-picking to a separate branch (not the normal flow).

**Decision required before promoting:** are we shipping the **entire current `dev`** to production? If
yes, every feature on `dev` must be release-ready (below). If the intent is warm-portal-only, stop and
plan a cherry-pick release instead.

---

## 1. Database migrations — apply to PROD *first* (BEFORE the code promote)

Migrations are **never** auto-applied and the deploy does not run them. Prod is at #192; `dev` carries
**four** prod-pending migrations. All four ride the promote, so all four must be applied to prod first:

- [ ] `193_chat_reports_and_self_mute.sql` (chat safety — another feature)
- [ ] `194_user_notification_settings.sql` (notifications — another feature)
- [ ] **`195_user_preferences.sql` — the theme-storage table the warm/dark preference persists to (THIS feature)**
- [ ] `196_rep_team_tournament_registrations.sql` (rep-team seam — another feature)

Process (per binding release rules):
- [ ] Apply each to prod via the prod migration tool (`apply-migration-api.mjs --prod`), in order.
- [ ] Refresh prod + dev snapshots (`npm run refresh:snapshots`).
- [ ] Run `npm run check:migrations` → **GREEN** (prod schema matches dev).
- [ ] **Manually verify #195 landed on LIVE prod** — the gate is BLIND to CHECK/RLS/index/nullability;
      confirm the `user_preferences` table + its `theme` column exist in live prod `information_schema`.
      (All four are additive; #195 is a new table keyed on `user_id` — safe, idempotent, no backfill.)

---

## 2. Pre-promote verification on the DEPLOYED dev environment

**Warm portal (this feature) — walk in BOTH themes:**
- [ ] A coach who has **never chosen a theme** sees **Warm** across the whole coaches workspace
      (overview, roster, schedule, lineups, depth chart, money/dues, chat, tryouts, check-in).
- [ ] Switching to **Dark** in Account → Appearance flips the portal dark and **persists across devices**
      (sign in elsewhere → still dark); switching back to Warm works.
- [ ] Dark is **byte-identical to today** for anyone who picks Dark (no regressions).
- [ ] **Tryouts sunlight floor**: check-in states + offer/waitlist/cut are solid fills + labels, legible.
- [ ] **Tournament pages are unaffected** — a coach/fan viewing a public event still sees the organizer's
      branding regardless of their Warm/Dark choice.
- [ ] **Admin console unaffected** — still dark (no warm leakage).
- [ ] **Mobile**: the status-bar strip matches the theme (cream on warm, dark on dark) on coach routes.
- [ ] No-flash: hard-reload a coach page in each theme — no dark/warm flash before paint.

**Everything else on `dev` (rides along):**
- [ ] Confirm the other dev features (Tournament Seam P3, chat reports, notification settings, rep-team
      registrations) are release-ready / owner-accepted. Flag any that are NOT owner-tested — historically
      several promotes shipped untested-on-dev by owner choice; make that choice knowingly here.

## 3. Release notes + marketing (MANDATORY)
- [ ] Add a customer-facing changelog entry (`lib/release-notes.ts`) — headline the warm look + "pick your
      theme in Account → Appearance," plus the other shipping features.
- [ ] **`/marketing` tone review of the changelog is mandatory before sign-off** (binding rule).

## 4. The promote
- [ ] `git fetch origin` and review `git log origin/master..dev` — confirm the commit set is what you expect.
- [ ] Deploy: `git push origin dev:master` (never merge a possibly-stale local master).
- [ ] Amplify CI/CD builds + deploys master automatically.

## 5. Post-promote verification + rollback
- [ ] Smoke-check prod: a coach page loads warm for a non-chooser; Appearance toggle works; tournament
      pages org-branded; admin dark.
- [ ] **Rollback plan:** the warm default is low-risk and reversible in code (re-point the default to dark
      / revert the theme commits) with no data migration to undo — `195_user_preferences` is additive and
      can stay. A full-release rollback is a `git push origin <prev-master>:master` (standard release revert).

---

## Warm-portal commit set (subset of the promote)
`289f651e` Stage 5 (chat + tryouts) · `929589b2` Stage 6 QA (dark-island sweep) · `c23feb82` public
release + Warm-as-default · `5dfe1aac` help docs · `5d63fc68` mobile status-bar tint.

## Notes / residuals
- The operator token ratchet still doesn't scan `components/accounting/` (pre-existing; small follow-up).
- Design decisions (warm-as-default, olive-never-a-fill) are logged in `memory/design_decisions.md` but
  that file is uncommitted (it also carries a parallel chat's entry) — not a release blocker.
