# PM Brief — Offer / Release Emails + Waitlist Auto-Promote (Coaches Portal Tryouts, Phase 2B.5)

> **Created:** 2026-07-02 · **Status:** Building (decisions ratified) · **Plan:** COACHES_PORTAL_TRYOUTS_EVAL_PHASE2B5_PLAN.md

**What it does:** Closes the family-communication loop on tryout decisions. Families get **org-branded** emails when they're offered a spot, waitlisted, or released. An offer email carries **Accept / Decline** buttons that open a simple, secure, no-login page; the family's response **notifies the coach**, who finalizes adding them to the roster (with fees) using the one-step flow from the last phase. Offers carry a **7-day "respond by"** date, and when a spot opens the board **nudges the coach** that waitlisted players are waiting.

**Why it matters:** Today a waitlisted family hears nothing, offers have no branding or deadline, and there's no self-serve way for a family to say yes/no — coaches chase responses by phone/text. This makes the club look professional, sets clear expectations, and cuts the manual back-and-forth.

**Who benefits:** Candidate families (clear, branded, self-serve responses — no new login) and Premium coaches / club admins (less chasing; the waitlist advances with one click when they're ready).

**Key decisions (ratified):**
- **Accept doesn't auto-roster.** A family's "Accept" signals intent and flags the coach; the coach still confirms and sets fees. Keeps the coach in control.
- **The waitlist never emails a family automatically.** When a spot opens, the coach is nudged and decides who to offer — no system-triggered emails to families.
- **Offers expire after 7 days** (adjustable), checked whenever the coach opens the board (no background jobs).

**Expected impact:** Fewer "did they get the offer?" phone calls, no silent waitlist, and a polished, on-brand family experience — while the coach keeps final say over the roster and fees.

**Trade-offs:** We deliberately did **not** auto-add accepted players or auto-advance the waitlist by email — safer and keeps a human in the loop (can revisit later). No parent accounts — just secure links in emails, consistent with the "no parent logins yet" direction.

**Success criteria:**
- A guardian can Accept or Decline an offer from the email in one tap, with no account, and the coach is notified.
- Offer / waitlist / release emails are org-branded and go out from both the coach board and the admin area.
- Offers show a respond-by date and read as "expired" after it passes; the board flags when waitlisted players are available.
- No card is charged and no family is emailed by an automated system event.

**Before ship:** family-facing email copy reviewed by `/marketing`; help docs updated; adversarial review of the public link surface.
