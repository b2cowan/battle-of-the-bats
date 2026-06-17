# FP-5 Staffing — PM Brief

**One-liner:** Get the right day-of volunteer onto the right screen — pick a purpose when inviting, hop between scoring and gate in one tap, and hand out both screens as scannable QR codes on game-day morning.

**Why it matters:** Officials already have permission to both submit scores and check teams in, but the product only ever routes them to the scorekeeper app. Gate volunteers get the wrong link, and there's no in-product way to reach the gate board except an admin texting a raw URL. On a multi-diamond morning that's real friction at the worst possible time.

**What changes (customer-visible):**
- **Invite by purpose** — when adding a volunteer, the organizer picks *Scorekeeping*, *Gate / check-in*, or *Both*. The invite email points them at the right screen.
- **One-tap hop** — the scoring and gate screens link to each other (when the volunteer has access), so nobody's stuck on the wrong one.
- **Day-of Staff Kit** — a new tournament-admin page that shows a QR code + copy-link for each volunteer screen, plus a printable one-pager for the volunteer table. Volunteers scan and they're in.

**Deferred:** the free-tier volunteer seat cap (J1-078) is a pricing decision flagged to /billing, not built here.

**Customer impact:** faster, less error-prone volunteer onboarding on game day; no more wrong-screen volunteers or texted URLs. **No new permissions or data changes.**

**Roles:** organizers/admins (invite + Staff Kit) and volunteers (right landing + cross-link). No coach/fan impact.

**Priority:** Medium-High (J1-077 is a confirmed day-of friction bug; J1-080 is a high-delight finish). **Risk:** Low — routing/copy + one new admin screen that only surfaces links that already exist (volunteers still authenticate on landing). Adds one small client-side QR dependency.

**Success criteria:** inviting a gate volunteer lands them on the check-in board; the two volunteer screens cross-link; the Staff Kit renders working QR codes for both screens and prints cleanly.
