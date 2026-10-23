# The public face, warm: S3a email copy (the `/marketing` pass, Step 0)

> **Written 2026-10-23** by `/marketing`, before any S3a code (Ask 4). Scope: the four lines the plan routed here, plus the
> one rule the new envelope forces on every button. **Words only.** The look is `PUBLIC_FACE_WARM_S3A_BUILD_PROMPT.md`'s job.
> **How the build uses this:** it applies every item marked **Approved** and leaves every item marked **Held** exactly
> as it is today. Anything not in this doc keeps its current wording.
>
> Rules applied: `BRAND_STRATEGY.md` (practical, direct, warm; "Canadian" only as a factual callout, never an identity claim),
> `VISUAL_IDENTITY.md` P4 (a button says what happens, no arrow) and P8 (no system words), house spelling, and the house clock
> ("8:00 a.m."). None of the strings below holds a clock time.

## Summary

| # | Line | Verdict |
|---|---|---|
| 1 | "FieldLogicHQ · Canada" sign-off | **Held** as today. Needs one thing from the owner: a mailing address. |
| 2 | "FieldLogicHQ does not process online payments" | **Held** as today. Flagged for Club Stage 12. |
| 3 | Premium welcome: "Everything from your free portal carries over" | **Approved**, reworded. |
| 4 | Coach footer link | **Approved**, two small edits. |
| 5 | Button arrows (all emails) | **Approved**: the arrow comes off as each button moves onto the shared one. |

---

### 1. The sign-off: "FieldLogicHQ · Canada"

Where: `lib/email.ts` (~line 1405, the Tournament Plus welcome's own unsubscribe block), `lib/email-sender.ts` (~line 58,
the footer added to every marketing send), and, outside S3a's files, the unsubscribe confirmation page
(`app/unsubscribe/confirmed/page.tsx`, ~line 125).

**Current:** `Unsubscribe · FieldLogicHQ · Canada`

**Finding, brand rule.** "Canada" here is a place, not a claim of identity, so it does not break the rule against "Canadian"
in headlines and brand statements (that rule is about positioning). But it is not doing the job the line exists for either.
An unsubscribe footer is where a sender identifies itself, and a country is not an identification. So the brand rule is not
the problem. **The line is thin.**

**Finding, CASL.** Canada's anti-spam law asks a commercial message to identify the sender and give a way to reach them,
and the usual practice is a mailing address. "FieldLogicHQ · Canada" carries neither. This pass is not legal advice: the
owner or counsel should confirm what the footer needs. The fix is the same either way.

**Proposed:** `Unsubscribe · FieldLogicHQ, <mailing address>`

**Why:** it names the sender and where to reach them, which is the footer's whole job, and it drops a country label that
reads as filler. No address exists anywhere in the repo, so I cannot write the real line.

**Verdict: Held.** The build keeps "FieldLogicHQ · Canada" exactly as it is in all three places. **Owner to supply the
mailing address (and confirm with counsel).** When it arrives, the change is one shared footer string used by the sender,
the Tournament Plus welcome and the unsubscribe page, so it should be one edit in one place, not three.

---

### 2. The registration email: "FieldLogicHQ does not process online payments"

Where: `lib/email.ts` (~line 256), the "Registration received" email, shown only when the tournament tracks payments.

**Current:** `If payment is required, the organizer will share payment instructions directly. FieldLogicHQ does not process online payments.`

**Finding.** Today the sentence is true. Club Stage 12 (families pay online) is built to make it false for house league and
tournaments, and copy says only what ships (the 2026-10-19 truth rule). The first half, "the organizer will share payment
instructions directly", stays accurate while organizers also take payment offline. The second half is the one that goes stale.

**What I will not do:** reword it now. Any replacement would describe a flow that has not shipped.

**Recommendation for Stage 12 (a note, not a decision).** When tournament online payment ships, this line should stop being a
fixed sentence and follow the tournament: if it takes online payment, say how to pay online; if not, keep the organizer
sentence and drop the second half. The sentence should never claim a thing the tournament cannot do.

**Verdict: Held.** The build moves the sentence onto the new envelope word for word. **Flag carried to Stage 12.**

---

### 3. The Premium welcome: "Everything from your free portal carries over"

Where: `lib/email.ts` (~line 638, `teamWorkspaceWelcomeHtml`). Sent once when a Premium workspace is first set up, from the
checkout and from a comped (founding-season) start.

**Current:** `Your Premium Coaches Portal is ready for <team>. Everything from your free portal carries over — plus the full season toolkit.`

**Finding.** The sentence assumes the coach had a free portal first. Most new Premium coaches did not: they came straight to
Premium. To them it reads as a promise about something they never had, and it makes the welcome feel like it was written
for someone else. The em dash and "plus" also make it a pitch line, where a welcome should say what is ready.

**Proposed:** `Your Premium Coaches Portal is ready for <team>, with the full season toolkit.`

**Option B (not recommended):** keep the carry-over line only when the coach had a free portal. It is a better sentence for
that coach, but it needs a new fact passed to the email for one line of copy, and the two callers do not have it today.

**Why:** it is true for every coach, it says what is ready, and the "What's included now" box right under it already lists
the toolkit, so the sentence does not need to oversell it.

**Verdict: Approved** (the proposed line).

---

### 4. The coach footer link

Where: `lib/email.ts` (`coachPortalFooter`, ~line 175), at the foot of the coach emails.

**Current:** `See your team's schedule, status & updates in your Coaches Portal →`

**Finding.** The sentence is good: it says what the coach gets, which is the reason to tap. Two small things. "&" is a
shorthand the rest of the emails spell "and". The arrow comes off under P4. It stays a quiet olive text link, not a button,
since the page's one lime button per view is the email's main action.

**Proposed:** `See your team's schedule, status and updates in your Coaches Portal`

**Why:** same promise, house spelling, no arrow.

**Verdict: Approved.**

---

### 5. Button arrows (every email)

**Current:** most buttons end in an arrow: "Open your Coaches Portal →", "View →" and so on.

**Rule (P4):** a button says what happens, sentence case, no arrow. The shared warm button is one style everywhere, so the
build drops the trailing arrow (the entity or the glyph) from each label as it moves onto it. **The label's words do not
change.** A label that is only "View" or a bare verb is not rewritten here: that is a wording call per email and stays as
today. If the build finds one that is unclear without its arrow, it lists it for me instead of rewriting it.

**Verdict: Approved** for the arrow only.

---

### Left alone on purpose

- The unsubscribe sentence "You're receiving this because you signed up for FieldLogicHQ." Legal wording, unchanged.
- The family guardian footer and the "sent even if you have unsubscribed" line. The build prompt keeps both word for word.
- Emoji and exclamation marks in subject lines and headings ("Registration Received!"). Not in this pass's scope. If the
  owner wants them reviewed it is a separate voice sweep over about 45 emails.
- Callout labels that were set in forced capitals ("Registration Details", "What's included now"). The words stay exactly as
  typed. Only the forced capitals go (P3), because the envelope's callout label has none. A label typed in Title Case shows in
  Title Case. Recasing them is a voice sweep over the same ~45 emails, with the headings, and is not part of S3a.
