# Notifications & Web Push — PM Brief

**Status:** Planned  
**Created:** 2026-05-26  
**Implementation plan:** [NOTIFICATIONS_PLAN.md](NOTIFICATIONS_PLAN.md)

---

## What This Is

A real-time notification system for FieldLogicHQ that alerts admins, staff, and coaches when important events happen — without requiring a native mobile app.

Three layers:
1. **In-app bell** — live badge and panel in the admin sidebar
2. **Notification preferences** — each user chooses which events they care about and how to be alerted
3. **Web Push + PWA** — OS-level phone alerts even when the app is closed

---

## Why It Matters

Right now, admins have no real-time signal when something happens. They find out about new registrations by checking the registrations page, about payments by checking email (if a Stripe webhook is configured), and about score submissions by... not at all. On tournament day, when an admin is walking the facility with their phone, there's no way for the platform to reach them.

This addresses the most common pain point of any event-day operator: "I didn't know that happened."

---

## What Customers Will Experience

**Org admins and staff:**
- A bell icon appears in the admin sidebar with a red badge showing unread counts
- The bell updates in real time — a registration that comes in while you're typing shows up immediately
- Clicking the bell opens a panel: "New registration: River Hawks U13 — 2 min ago" with a direct link
- In Organization → My Notifications, each user configures their own preferences: which events, which channels (in-app, push, email)
- Admins who enable web push receive OS-level phone alerts even when the browser tab is closed

**Coaches:**
- Same bell in the coaches portal, scoped to their own team (waitlist updates, score confirmations)

**Platform admin:**
- Not affected — platform admin manages orgs, not org-level events

---

## No App Required

This uses the Web Push API — a browser standard. No App Store. No Google Play. No SDK.

- **Android:** Works in Chrome out of the box
- **iPhone:** Works once the user adds FieldLogicHQ to their Home Screen (a one-time step). Requires iOS 16.4+.

Adding the PWA manifest also means users get a proper home screen icon, full-screen experience, and the visual polish of a "real app" — at zero extra cost.

---

## Notification Events Covered

| Event | Who sees it |
|---|---|
| New tournament registration | All org admins |
| Registration status changed | The registering coach (if linked) |
| Payment received / failed | Org owners |
| Roster change requested | All org admins |
| Score submitted | Staff scoped to that tournament |
| Score disputed | Staff scoped to that tournament |
| Registration deadline approaching (24h) | All org admins |
| Waitlist spot opened | The specific coach |
| Coach requested portal access | Org owners |
| New house league registration | All org admins |

---

## Notification Preferences

Each user has independent preferences per org. They can:
- Enable or disable individual event types
- Choose channel per event: **Bell** (in-app), **Push** (phone), **Email**
- Default: bell ON for everything, push OFF (opt-in), email OFF

This prevents notification fatigue — an admin who only cares about registrations can silence everything else.

---

## Priority & Success Criteria

**Priority:** High — directly impacts day-of-tournament operator experience and onboarding satisfaction

**Success criteria:**
- Org admin sees a bell notification within 5 seconds of a new registration landing
- Zero missed notifications: if bell is on, 100% delivery to in-app panel
- Push opt-in rate of 30%+ among active admins within 60 days of launch
- Zero stale push subscriptions causing repeated API errors (410 auto-cleanup handles this)

---

## What This Is Not

- A messaging or chat system (that would need its own design)
- A broadcast tool to send messages to teams/registrants (that already exists in Communications)
- A native app (this is a PWA — no App Store involvement)
