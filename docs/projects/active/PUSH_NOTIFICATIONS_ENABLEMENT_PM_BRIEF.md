# PM Brief — Phone/Home‑Screen Notifications (Push Enablement)

**Status:** Built on `dev` 2026‑07‑03 · needs production keys added + deploy · owner browser‑test pending
**Owner ask:** "When I get a message in the admin app, notifications don't show on my phone's home screen — only inside the app. Make it automatic for all admins."

## The problem (what customers hit)

The app had a full push‑notification system built, but three gaps meant OS‑level alerts never reached anyone:

1. **Production was never given its push keys.** The live site received all its other secrets (payments, database, email) but not the notification signing keys — so the server silently registered nothing and sent nothing. No error anyone would notice.
2. **The opt‑in was undiscoverable and broken on mobile.** The only way to turn push on was a per‑event toggle buried in a dense settings table, and the "Allow" confirmation rendered at the top of the page — off‑screen on a phone. Flipping the toggle appeared to do nothing.
3. **Everything defaulted to "no push."** Even a correctly registered phone would have received nothing, because the only push‑on‑by‑default event was chat, which isn't live yet.

## What changes for the user

- **One‑tap turn‑on.** Admins now see a slim, dismissible prompt in the admin app — "Get alerts on this device." One tap fires the phone's Allow dialog right there and registers the device. No hunting through settings.
- **Alerts that actually matter, on by default.** Once a device is on, push automatically covers the time‑sensitive moments: new registrations, payments received/failed, scores submitted/disputed, team no‑shows, and coach/roster requests. Noisier/informational events stay off by default and can be opted into.
- **The detailed settings still work — now on mobile too.** The per‑event on/off page remains for fine‑tuning; enabling push there now triggers the phone's Allow dialog immediately instead of an off‑screen button.

## Why it matters

Organizers miss time‑critical events (a payment failing, a score dispute, a no‑show) when they have to keep the app open to see them. Home‑screen alerts are the whole point of the installed app. This closes the loop for every admin, not just power users who'd dig into settings.

## Tradeoffs

- Defaulting more events to push means a few more phone buzzes. Mitigated by keeping the noisy/low‑urgency events off by default and letting anyone turn any event off per‑event. Push only ever reaches a device that has explicitly opted in, so no one is spammed retroactively.
- Scope is **admin staff** for now. Coaches‑portal push enablement is a fast follow (same building blocks).

## Success criteria

- On production, an admin can enable push in one tap and receive a home‑screen alert for a real event (e.g. a new registration) with the app closed.
- No admin has to visit the settings table to get working phone alerts.

## Hard dependency (owner action)

Production push will not work until the three notification keys are added to the hosting (Amplify) environment and the app is redeployed. Values already exist in local dev. See the plan file for the exact steps.
