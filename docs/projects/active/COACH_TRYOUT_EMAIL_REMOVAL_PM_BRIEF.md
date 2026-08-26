# PM brief — Tryout decision emails removed

**Priority:** high (risk removal, not a feature). **Status:** built 2026-08-26, QA owed.

## What a coach sees differently

The Decide tab of the tryout room loses the **"Email families my decisions"** switch above the
decision buttons, and every offered player's row loses **"✉ Email this offer"**. Offer, Waitlist and
Not-this-season now do exactly one thing: record the decision. The double-check that used to appear
on "Not this season" is gone too — it only existed because an email couldn't be recalled.

Rows no longer show whether a family has replied (awaiting / accepted / declined / expired), because
there is no longer anything for a family to reply to. When a coach has agreed terms with a family
themselves, they tap **Accept → add to roster** exactly as before, fees and all.

Club administrators running rep tryouts from the admin portal see the same removal.

## Why it matters

A rep offer is a custom letter a family signs — often conditional, usually the opening of a
conversation. A generic platform email is not that document, so the feature's best case was that no
one used it and its worst case was a family getting a system message that contradicted the letter
their coach was about to send. Sitting one tap from "Not this season", it was a mis-tap risk with no
upside. Off-by-default was a mitigation; removal is the answer.

## Customer impact

- **Coaches:** no behaviour to relearn — the switch was off by default, so the common path is
  unchanged. What changes is that the risk is now structurally impossible rather than merely
  defaulted away.
- **Families:** unchanged in practice. They still get an **"Application received"** receipt when they
  submit the tryout form themselves — that one stays. They hear about decisions from their coach,
  which is what already happened.
- **Clubs that wanted system-sent offers:** lose that option. Accepted tradeoff.

## Tradeoffs

This is a **one-way door**. The family self-serve Accept/Decline loop is retired with the email that
carried it, and restoring it later is a rebuild, not a setting. Three figures leave the Tryout report
(awaiting reply, offers expired, declined by family) because they could only ever count emailed
offers. Turnout, evaluated, **offered**, accepted and rostered are untouched.

## Success criteria

- No tryout decision on either surface produces email, under any state, on any device.
- A coach can still run the full cycle: rank, decide, record, accept onto the roster with fees.
- The Tryout report still reports turnout through to rostered without gaps or zeroed columns.
- Help guides describe the recorded-only flow with no reference to a switch that no longer exists.

## How to test

Coach portal → a team with a live tryout → **Tryouts → Decide**. Confirm there is no email switch
above the buttons and no send button on an offered row; make each decision and confirm nothing is
sent and the decision sticks. Accept a player onto the roster and confirm no welcome email. Repeat on
the club-admin tryouts screen. Open the Tryout report and confirm the funnel reads cleanly.
