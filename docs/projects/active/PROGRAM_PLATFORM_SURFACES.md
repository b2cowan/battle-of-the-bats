# Program — Platform Surfaces (navigation, notifications, PWA, changelog)

> **Consolidated 2026-07-28.** Replaces 10 cross-cutting surface plan-brief files (§4).
> **Scope:** outstanding work only. Shipped work appears as one-line reference in §3.

---

## 0. Ground truth (verified 2026-07-28)

Everything in this program is **built and live in production**. After the 2026-07-28 sweep, what
remains is **one build phase (The Flip P4)**, one small owner check (the app-icon slider), and one
low-priority idea (per-user theme).

**Closed 2026-07-28:** push delivery confirmed working · changelog confirmed live and in active use ·
notification pause switch closed at owner request · native mobile app killed and logged.

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

### 1.2 Push delivery — ✅ CLEARED 2026-07-28
⚠ *Corrected: an earlier draft of this doc said Android push was dead on production and the
diagnostic unrun. Both were true on 2026-07-04 and stopped being true on 2026-07-28.*

Android installed-PWA push delivered nothing on production from 2026-07-04. The owner ran the
self-serve **"Test this device"** diagnostic on production and it **delivered successfully** — the
channel works end-to-end from a real device. The 2026-07-04 diagnosis put the break between server
send and device delivery (i.e. configuration); whatever resolved it, push is confirmed working.

**Standing caution:** re-test before any release that depends on push, rather than assuming this
result holds. The channel broke silently once and reported success while doing so.

### 1.3 App icon logo size — close-out
A "Logo size" slider (Small ↔ Large, continuous, with a Default mark) in Public Site → Advanced
Branding → App Icon, Tournament Plus and above, with a live preview. Built. **Remaining:** owner check
that the preview tracks the slider and that the generated icon routes render correctly.

### 1.4 Per-user light/dark theme preference — not started
Each user toggles their own theme from their own settings (org admins in org settings, coaches in the
coach portal), stored per-user not per-org, plus a light/dark toggle on public org and tournament sites.
The theming program shipped warm-as-default and a toggle mechanism, so the infrastructure exists.

---

## 2. Decisions required from you

| # | Decision | Recommendation |
|---|----------|----------------|
| ~~PS-1~~ | ~~Run the push-delivery diagnostic~~ | ✅ **Resolved 2026-07-28 — owner ran it on production, push delivered.** Re-test before any push-dependent release; don't assume it holds. |
| ~~PS-2~~ | ~~Changelog cadence~~ | ✅ **Resolved in practice** — running per-release at ~20 entries; "On the horizon" retained. |
| ~~PS-3~~ | ~~Native mobile app — kill or commission a plan?~~ | ✅ **KILLED 2026-07-28 (owner).** Logged in `BUSINESS_DECISIONS.md`. Do not resurface without a new decision. |
| PS-4 | **Per-user theme preference — build it?** | Low priority. Warm-as-default already resolved the complaint that motivated it. |

---

## 3. Shipped — reference only

- **The Flip P1–P3** — one FlipPill on every surface; same-tab, page-matched movement between public site and admin/coach portals with "Back to…" return memory; admin bell → More; public header share → Overview row; account sheet retired.
- **Unified Home IA** — navigation reduced to Home / Scores / Chat / Account; Home absorbed Discover, Following and the old launchpad; two-tier follow model.
- **Notification pause master switch** — account-level pause enforced at the single notify chokepoint plus fan-notify account targets; failed-payment and @mentions always get through.
- **Platform-wide notification settings** — one "All your notification settings" page, weekly-digest off-switch, mute-only tournaments, grouped view with tri-state rollups, assistant filtering, per-coach unsubscribe fix.
- **Scheduled jobs** — Sunday digest and daily dues cron jobs active on production.
- **Release notes & changelog — LIVE and in active use** (⚠ *corrected 2026-07-28: an earlier draft of this doc said "built, never turned on." Wrong — it's on and being maintained*): public `/changelog` linked from the site footer, **20 entries with the latest dated 2026-07-27**, the undated "On the horizon" section retained, a "new" dot in **both** the admin and coaches sidebars, a link in from the help hub, seen-state marked on visit, and the draft-then-approve generator wired into the release flow. The original plan's separate "What's New" button + portaled panel was superseded in build by this simpler shape (sidebar dot → help link → the public page).
- **App icon logo size** — continuous slider with live preview in Advanced Branding.
- **Theming program** — warm as the platform default, theme toggle, branding cleanup (Stages 1–6).
- **Push diagnostics** — "Test this device" tool live on production; **used 2026-07-28 to confirm Android production push is delivering again** after the 2026-07-04 outage.

---

## 4. Source files consolidated (archive candidates)

`ROLE_FLIP_NAVIGATION_PLAN.md` · `ROLE_FLIP_NAVIGATION_PM_BRIEF.md` · `ROLE_FLIP_P4_BUILD_PROMPT.md` ·
`NOTIFICATION_PAUSE_SWITCH_PLAN.md` · `NOTIFICATION_PAUSE_SWITCH_PM_BRIEF.md` ·
`PUSH_DELIVERY_TEST_PLAN.md` · `RELEASE_NOTES_CHANGELOG_PLAN.md` · `RELEASE_NOTES_CHANGELOG_PM_BRIEF.md` ·
`APP_ICON_LOGO_SIZE_PLAN.md` · `APP_ICON_LOGO_SIZE_PM_BRIEF.md` · `MOBILE_APP_STRATEGY_PM_BRIEF.md`

`ROLE_FLIP_P4_BUILD_PROMPT.md` — **archived 2026-07-28 (owner: archive all build prompts).** It was
the only unexecuted prompt in the repository; its full scope is preserved in §1.1 above, which is now
the build spec for The Flip P4.

> **Keep active:** `PUSH_DELIVERY_TEST_PLAN.md` — the interpretation guide for the "Test this device"
> tool. Still useful as a standing re-test procedure before push-dependent releases, even though the
> 2026-07-04 outage is resolved.
