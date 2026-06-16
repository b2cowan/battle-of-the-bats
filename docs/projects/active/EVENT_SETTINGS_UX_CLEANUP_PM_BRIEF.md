# Event Settings UX Cleanup — PM Brief

**One-liner:** Make the Event Settings page scannable by giving each card one clear job, renaming the fee card, and fixing a confusing "Pause all" switch.

**Why it matters:** Event Settings is where the organizer configures the whole tournament. Today one card ("Notifications & Contact") is a catch-all holding five unrelated things, including a scoring rule that doesn't belong and a master email switch whose label means the opposite of what it reads ("Pause all: On" = all emails off). Organizers told us it feels long, wordy, and hard to find a purpose in.

**What changes (customer-visible):**
- The **"Fee Schedule"** card becomes **"Fees & Payments"** — it always held payment instructions too, not just a schedule.
- The crowded **"Notifications & Contact"** card splits into two focused cards: **Contact** (who people reach / who you notify) and **Coach Emails** (what the system auto-sends).
- **Score Finalization** (whether scorekeeper entries are final immediately or need admin approval) moves to **Schedule Rules**, where the other game-results decisions live.
- The confusing **"Pause all automatic emails"** switch becomes a plain **"Automatic coach emails: On / Off"** — On means emails send. No more double-negative.
- Long descriptive paragraphs are trimmed so the cards are shorter and faster to scan.

**Customer impact:** Faster, less confusing setup; fewer mis-clicks on the email switch. **No behavior change** — every setting does exactly what it did, just better organized and labelled.

**Roles:** organizers/admins running tournaments. No coach/fan/volunteer impact.

**Priority:** Medium (polish on the most-used config screen). **Risk:** Low — presentation-only; no database, API, or save-format change; nothing a setting controls is altered.

**Success criteria:** Each card has one obvious purpose; the fee card is named for what it holds; the email master switch reads in the affirmative; Score Finalization sits with the other scoring rules; all settings still save unchanged.
