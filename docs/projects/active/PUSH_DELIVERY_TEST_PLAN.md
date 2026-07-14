# Android push — confirmation test plan (dev)

**Goal:** confirm push notifications actually reach an Android phone **on the dev environment** before Phase 2 (fan accounts & alerts) relies on them. The earlier failure was on production; dev has its own keys/config, so it must be confirmed on dev specifically.

**Why this works:** the built-in **"Test this device"** tool uses the exact same push plumbing (keys, service worker, delivery path) as fan score alerts. If a test notification is delivered, fan alerts will work too. If it fails, the tool names the exact reason.

**You'll need:** an Android phone + the dev site (dev.fieldlogichq.ca), signed in. ~15 minutes.

---

## Part A — Fast plumbing check (do this first) · ~5 min
1. On the Android phone, open the dev site in Chrome → **install it** (menu → Add to Home screen) and **open it from the home-screen icon**.
2. Sign in, then go to **Account → Notification settings** (`/account/notifications`).
3. Turn notifications **on** and **allow** the permission prompt — this registers this device.
4. Under **"Your notification devices,"** tap **Test this device** and read the result:

| What it says | What it means | What to do |
|---|---|---|
| **"Test notification sent"** and a notification actually appears | ✅ Push is healthy on dev — **Phase 2 is clear to rely on alerts.** | Nothing. Proceed to Part B to confirm the real fan flow. |
| **"Test notification sent"** but nothing appears | The server sent it; the phone or OS blocked it. | Check the phone's own notification settings for FieldLogicHQ (and Do Not Disturb / battery optimization). |
| **"Push isn't configured on the server yet (VAPID keys missing)"** | The dev environment is missing its push keys at runtime. | Set the push keys on the Amplify **dev** environment and redeploy, then retest. This is a settings fix, not a code fix. |
| **"The push service rejected the request… keys don't match"** | The dev push key pair is mismatched. | Correct the key pair, then remove and re-add this device, and retest. |
| **"This device's subscription has expired… turn off and on again"** | The saved device registration went stale (normal over time). | Toggle notifications off/on to re-register, then retest. |

> This one screen tells you *whether* push works on dev and, if not, *exactly why* — it's the whole diagnosis in one tap.

## Part B — End-to-end fan alert (the real Phase 2 path) · ~8 min
Only meaningful once Part A shows "delivered."
5. On a **Tournament Plus** event on dev, open a **team's** page, tap **Follow**, then turn on **score alerts** (the bell) and allow notifications.
6. On a **second device or a desktop**, signed in as an admin for that event, **enter or change a score** for a game that team is playing (or mark the game live).
7. Confirm a **score alert push arrives** on the phone, and tapping it opens that game.
8. Repeat with the app **closed / backgrounded** — the real-world case. The alert should still arrive.

## Part C — Confirm the conditions that historically mattered · quick
- The phone is running the **installed app opened from the home screen** (not just a browser tab).
- Notification permission is **granted** (not "ask" or "blocked") for FieldLogicHQ.
- On a **free-tier** event, the alert control should read **"alerts aren't offered by this event"** — that's the gate working as intended, not a failure.

---

## How to read the outcome
- **Part A "delivered" + Part B alert arrives** → push is confirmed on dev; Phase 2 can proceed.
- **Part A "not configured" or "mismatch"** → that is the blocker, and it's an environment/keys fix (not code). Fix it, retest Part A, then run Part B.
- Log the result (and which result state) into the push-diagnosis notes so we have the dev-environment answer on record.
