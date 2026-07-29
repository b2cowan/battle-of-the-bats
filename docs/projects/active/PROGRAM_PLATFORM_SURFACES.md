# Program — Platform Surfaces (navigation, notifications, PWA, changelog)

> **Consolidated 2026-07-28.** Replaces 10 cross-cutting surface plan-brief files (§4).
> **Scope:** outstanding work only. Shipped work appears as one-line reference in §3.

---

## 0. Ground truth (verified 2026-07-28)

Everything in this program is **built and live in production**. What remains is almost entirely
**owner device-testing and one polish phase** — plus one genuinely open strategic question (a native
mobile app) that has never progressed past a brief.

---

## 1. Outstanding work

### 1.1 The Flip (role ⇄ public navigation) — P4, the final phase
P1–P3 are shipped to production: one flip control, top-right on every surface, letting operators move
between the public tournament site and their admin/coach portals in the same tab, page-matched, with
"Back to…" return memory. The admin bell moved to More, the public header share moved to the Overview
row, the account sheet retired.

**P4 is the last phase and is deliberately light** — no database change, no new visual language, no
restyling of the shared control. Every surface reuses what already shipped; if a genuinely new visual
emerges, stop and mock it up first. Four work items:

- **WI-1 — Lateral moves between your own roles.** Today the role chooser only exists on the *public*
  control. Inside a portal, the control only flips you back out to public — so someone who is both an
  admin and a coach has to go Admin → public → Coach. P4 adds the person's *other* roles on that same
  event as rows inside the portal control: one row per role held, each labelled with where it goes,
  same tab, return-memory preserved. **A person with only one role sees zero change — that's the
  acceptance bar.** The coach→admin direction is the valuable one; keep it symmetric only where the
  page genuinely knows the context (a coach's record page knows its one event; the scorekeeper chooser
  lists tournaments first and appends role rows only when unambiguous).
- **WI-2 — Staff scoping on the public→admin flip** (a leftover from P2). A staffer with limited
  capabilities currently flips into admin and gets bounced by a redirect on arrival. The
  nearest-permitted-screen logic and its tests already exist; the public control just never receives
  the staffer's permitted screens. Feeding it through removes the wrong-door hop. Authentication
  stance is unchanged — the destination still re-authorises.
- **WI-3 — Hidden pages and finished-event edges.** Organizers can hide public pages, but the
  page-matching resolver doesn't check — so flipping from admin Communication can land on a page the
  organizer deliberately hid. Fall back to the event front page whenever the matched page is hidden.
  Then sweep the edges with evidence: finished/archived tournaments round-trip read-only, drafts still
  route to preview, a failed viewer fetch leaves the public header clean, and the scorekeeper control's
  org-root fallback holds.
- **WI-4 — Close-out.** Sync the admin help guide to the P1-era chrome changes (bell moved to More,
  View Site retired, the flip itself) — the tournament and coach guides were already synced. Then run
  the owner QA script end-to-end, **including the PWA return-memory check on production** (installed
  app, Android and iOS). If "Back to…" proves flaky on a real device, the ratified fallback is
  stateless-only — flag it rather than shipping something flaky.

**Definition of done:** a two-role user jumps laterally in one tap from any portal; a
capability-limited staffer lands on their nearest permitted screen; no flip can land on a hidden
public page; the admin guide matches the shipped chrome; the device return-memory verdict is recorded.
That closes The Flip completely.

### 1.2 Push delivery — diagnosis unfinished, tool is waiting for you
Android PWA push notifications are **not arriving on production**. Likely cause: a VAPID key mismatch
between environments. A **"Test this device" diagnostic tool is live on production** and the
interpretation guide is written — but nobody has run it. This is a one-sitting task that unblocks a
whole notification channel.

### 1.3 Notification pause master switch — device test
Shipped to production 2026-07-22 with migration 194. Pausing silences all org / staff / coach / chat
notifications, the weekly coach digest, and account-routed fan score/news pushes — while deliberately
letting **failed-payment and @mention** through. Fail-open by design. **Remaining: your device test.**

### 1.4 Release Notes & Changelog — built, never turned on
P1–P3 are built: a public `/changelog` (shipped items plus an undated "On the horizon"), an in-app
"What's New" button with a seen-dot for admins and coaches, and `npm run draft:notes` — a
draft-then-approve generator wired into the release flow. No email in V1; the standalone coaches hub
was deferred.

**Remaining:** your browser test, and a call on cadence — see **PS-2**.

### 1.5 App icon logo size — close-out
A "Logo size" slider (Small ↔ Large, continuous, with a Default mark) in Public Site → Advanced
Branding → App Icon, Tournament Plus and above, with a live preview. Built. **Remaining:** owner check
that the preview tracks the slider and that the generated icon routes render correctly.

### 1.6 Native mobile app — strategy brief only, no plan
A PM brief exists comparing a focused companion app against mobile web, with level of effort, release
path, store considerations and MVP scope (Home/Today, scorekeeper view, etc.). **No technical
implementation plan was ever written.** The PWA has since absorbed much of the intended scope. See **PS-3**.

### 1.7 Per-user light/dark theme preference — not started
Each user toggles their own theme from their own settings (org admins in org settings, coaches in the
coach portal), stored per-user not per-org, plus a light/dark toggle on public org and tournament sites.
The theming program shipped warm-as-default and a toggle mechanism, so the infrastructure exists.

---

## 2. Decisions required from you

| # | Decision | Recommendation |
|---|----------|----------------|
| PS-1 | **Run the push-delivery diagnostic.** Not really a decision — but Android push has been broken on production for weeks and the tool is sitting there. | Do it this week. A dead notification channel undermines every feature that depends on it. |
| PS-2 | **Changelog cadence** — publish per release, weekly, or only for notable changes? And does "On the horizon" stay public? | Per release, and keep "On the horizon" — it's cheap credibility for an early product. |
| PS-3 | **Native mobile app — kill the brief, or commission a real plan?** It has sat as a brief since early June while the PWA absorbed the use cases. | Kill it for now and revisit after early access. Record the decision via `/strategy` so it stops resurfacing. |
| PS-4 | **Per-user theme preference — build it?** | Low priority. Warm-as-default already resolved the complaint that motivated it. |

---

## 3. Shipped — reference only

- **The Flip P1–P3** — one FlipPill on every surface; same-tab, page-matched movement between public site and admin/coach portals with "Back to…" return memory; admin bell → More; public header share → Overview row; account sheet retired.
- **Unified Home IA** — navigation reduced to Home / Scores / Chat / Account; Home absorbed Discover, Following and the old launchpad; two-tier follow model.
- **Notification pause master switch** — account-level pause enforced at the single notify chokepoint plus fan-notify account targets; failed-payment and @mentions always get through.
- **Platform-wide notification settings** — one "All your notification settings" page, weekly-digest off-switch, mute-only tournaments, grouped view with tri-state rollups, assistant filtering, per-coach unsubscribe fix.
- **Scheduled jobs** — Sunday digest and daily dues cron jobs active on production.
- **Release notes & changelog P1–P3** — public `/changelog`, in-app "What's New" with seen-dot, `npm run draft:notes` generator wired into the release flow.
- **App icon logo size** — continuous slider with live preview in Advanced Branding.
- **Theming program** — warm as the platform default, theme toggle, branding cleanup (Stages 1–6).
- **Push diagnostics** — "Test this device" tool live on production.

---

## 4. Source files consolidated (archive candidates)

`ROLE_FLIP_NAVIGATION_PLAN.md` · `ROLE_FLIP_NAVIGATION_PM_BRIEF.md` · `ROLE_FLIP_P4_BUILD_PROMPT.md` ·
`NOTIFICATION_PAUSE_SWITCH_PLAN.md` · `NOTIFICATION_PAUSE_SWITCH_PM_BRIEF.md` ·
`PUSH_DELIVERY_TEST_PLAN.md` · `RELEASE_NOTES_CHANGELOG_PLAN.md` · `RELEASE_NOTES_CHANGELOG_PM_BRIEF.md` ·
`APP_ICON_LOGO_SIZE_PLAN.md` · `APP_ICON_LOGO_SIZE_PM_BRIEF.md` · `MOBILE_APP_STRATEGY_PM_BRIEF.md`

`ROLE_FLIP_P4_BUILD_PROMPT.md` — **archived 2026-07-28 (owner: archive all build prompts).** It was
the only unexecuted prompt in the repository; its full scope is preserved in §1.1 above, which is now
the build spec for The Flip P4.

> **Keep active:** `PUSH_DELIVERY_TEST_PLAN.md` — the guide you'll read while running the diagnostic.
