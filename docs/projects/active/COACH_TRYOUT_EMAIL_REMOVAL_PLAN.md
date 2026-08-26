# Tryout decision emails — full removal

**Owner ruling 2026-08-26, binding.** FieldLogicHQ sends **nothing** to a tryout family as a
consequence of a coach's or club admin's decision. Not by default, not behind a switch, not from a
per-row button.

## Why (owner's reasoning, recorded verbatim in substance)

An offer is a **custom letter the family signs**, frequently **conditional**, and frequently the
start of a back-and-forth conversation. A generic FieldLogicHQ offer email is not that artifact and
never could be. So the best case for the feature was that nobody used it; the worst case was a
family receiving a system email that contradicts the letter their coach was about to send. A control
that can only be neutral-or-harmful, sitting one tap from "Not this season", is a **fat-finger risk
with no upside**.

Note this is a stronger claim than "the switch defaults off". Off-by-default is a mitigation. The
ruling is that the capability itself is wrong for this domain.

## Scope decisions (owner, 2026-08-26)

1. **Both surfaces** — the coach Decide board AND the club-admin tryouts screen. The argument is
   about the club's offer *process*, not about who clicks. Leaving it on admin would also have
   forced the entire reply-link machinery to stay alive to serve one screen.
2. **Retire the whole reply loop**, not just the controls. The Accept/Decline link only ever
   travelled inside the offer email, so with the email gone the loop is unreachable — leaving the
   page, the badges, the notification and the report figures in place would leave a screen full of
   things that can never happen.

## The cascade (why this is bigger than deleting two buttons)

`extendTryoutOffer` was the ONLY minting site for the family response token, and the offer email was
its only delivery vehicle. Everything below hangs off that one fact:

| Surface | Fate |
| --- | --- |
| "Email families my decisions" switch (both screens, device-remembered) | deleted |
| "✉ Email this offer" / "Resend offer" per-row button | deleted |
| "Pass on X?" confirm dialog | deleted — it existed ONLY because an email can't be unsent |
| Offer badges: awaiting / family accepted / family declined / expired | deleted |
| "declined by family" tally + the stale-offer banner | deleted |
| `/tryout-response/[token]` page + API | deleted |
| `tryout_offer_response` notification | UI row removed (house dead-event pattern) |
| Report funnel: `awaitingReply`, `offerExpired`, `familyDeclined` | deleted |
| `decisionLabel` "Offered — family accepted/declined" | collapsed to "Offered" |
| Email layouts: offer / waitlist / declined / accepted | deleted |
| Platform email templates `tryout_offer_extended`, `tryout_declined`, `tryout_offer_accepted` | rows deleted (new migration) |

### What SURVIVES, and why it is not an oversight

- **`tryout_application_received`** — the family's receipt for the family's OWN action (submitting
  the public form). Not a coach decision being announced on their behalf. Removing it would leave
  applicants with no proof their application landed.
- **The report's "Offered" figure.** `first_offered_at` is stamped by a **DB trigger** on the
  status transition (mig 223), not by the email. It keeps working untouched. Do not "fix" it.
- **The "no email on file" chip** — reworded. Its old copy said no decision email could reach the
  family; its new job is telling a coach who must now reach out personally that there is no address
  on file. Genuinely more useful after this change, not less.
- **`clearTryoutOffer`** — kept as durable hygiene so a legacy token on an existing row is wiped on
  the next transition. Nothing mints new ones.
- **The DB columns** (`offer_token_hash`, `offer_sent_at`, `offer_expires_at`, `offer_response`,
  `offer_responded_at`) and their mapped type fields. Real columns holding real history; dropping
  them is a migration with dictionary work and no benefit. They are simply no longer written or read.
- **`tryout-response` in reserved-slugs.** A retired route's path must not become claimable by an org.

## One-way door

There is no switch to flip back. Restoring system-sent offers later means rebuilding the token
mint, the public reply page, the badges and the notification. That is the accepted cost.

## Verification

- `npm run verify:changed`, then `npm run typecheck` (shared modules: `lib/db.ts`, `lib/email.ts`,
  `lib/types.ts`, `lib/notification-labels.ts`).
- Dev-server restart required at handoff — files deleted + shared modules changed.
- Demo sandbox: checked 2026-08-26 — the coach tour's tryout step and the moments dock's tryout-day
  line describe ranking and blind scoring only, and never mention decision emails. **No demo copy
  change needed.** The tour anchor `[data-sandbox-tour="tryout-decisions"]` sits on the board card,
  not on the removed switch row, so it survives.

## Review findings (`/review`, high-risk tier, 2026-08-26) — all fixed

The security, data-contract, correctness and regression lenses returned **no Critical/High defects**:
the deletion propagated cleanly to every consumer, every auth/IDOR/capability gate survived, the
contract changes reached every reader, and migration 264 is safe and idempotent.

**The copy lens found four more false promises the build could not see, and that is the lesson.**
The first pass grepped for the CONTROL LABELS — "Email families my decisions", "Email this offer",
`notifyFamily` — and every one of these four phrases the same idea in different words, so none of
them matched:

| Where | What it said | Why it survived the first sweep |
| --- | --- | --- |
| Club-admin help, consent FAQ | *"Status emails about their own application (offer, waitlist, decline, welcome) are transactional and are sent regardless — the form says so plainly"* | Same FILE as a passage that WAS rewritten, 15 lines below it. It also cross-referenced the public form — the very sentence that had just been corrected to say the opposite. |
| Families help, unsubscribe FAQ | *"Dues reminders and tryout emails still go out. A family can't switch off a bill, or an offer of a roster spot…"* | Phrased as "tryout emails", never as a control name. This is the script staff read to a complaining parent, so it would have produced a false statement TO a family. |
| Coach "How tryouts work" guide | *"Reach families yourself — or turn on family emails and offers land with a secure reply link"* | Says "turn on family emails", not the switch's label. A coach believing it would assume families were being emailed and never follow up. |
| Demo seed `TRYOUT_DESCRIPTION` | *"Decisions go out by email within a week of callbacks"* | **Seeded DATA, not code** — rendered on the demo's PUBLIC tryout page, which is live on prod. No code grep for a control name could ever have reached it. |

⚠ **Generalize this: when removing a capability, sweep for the CONCEPT in the customer's words, not
for the identifiers the code uses.** A promise is written in the language of the person reading it.
The four misses plus the register-form promise caught earlier make **five** instances, in five
different vocabularies, of one removed feature.

**Also fixed (Low):** a dead `'Offered — family accepted'` member in `IMPLIES_A_SPOT` whose
justifying comment was WRONG (the label is recomputed from `status` on every read, never stored) —
notable because one verifier accepted the dead member *citing that comment as evidence*, which is
the "a guard that reads prose proves the prose" failure in miniature; an orphaned doc comment left
above `recount()`; stale docblocks in `family-mail-footer.ts` and the tryout history page; and the
orphaned CSS (`.notifyRow/.notifyText/.notifyLabel/.notifyHint/.resendBtn/.offerNudge` + warm
overrides, and `.filteredNote`) — two of which sat inside GROUPED selectors that had to survive.

**Deliberately NOT changed:** the tryout history page still renders "Offered · declined" from a
stored `offer_response` on legacy rows. That is true history for seasons where the retired reply
loop really ran, and the column was not dropped. It now reads differently from the Tryout report's
label for the same row — accepted, because the history page is the more truthful of the two about
what actually happened.

**Considered and rejected:** having migration 264 also null the offer-token columns repo-wide. It
would make "no live token exists" true by construction rather than by "the resolver is deleted" —
but `first_offered_at` was BACKFILLED from `offer_sent_at` (mig 223), so wiping it destroys the only
source if that backfill ever needs redoing. The security lens confirmed `offer_token_hash` is never
selected into any API response, so the leftover state is inert. History kept.

### Rendered check (`check:layout`)

`--changed` widened to the full 59-screen sweep (18 shared files touched — most by concurrent work,
not this change) and **aborted on the memory floor** at screen 6, which is a failure, not a pass. A
scoped re-run (`--only=coach-tryouts,coach-notifications`) completed: **`coach-tryouts` — the screen
this change actually edits — has ZERO new findings** at 361 / 390 / 768 / 1440.

⚠ That run reports **27 NEW findings on `coach-notifications`** (the coach BELL page at
`/{org}/coaches/notifications`): sideways page scroll of 82px at 361, a 28px "Mark all read" button
against a 44px floor, and timestamp text at 1.43:1 against a 4.5:1 requirement. **They are not from
this change** — that page's own `page.tsx` and `components/notifications/NotificationsPageContent.tsx`
are unmodified, and neither reads `NOTIFICATION_SECTIONS`, the only thing this change touched in
`lib/notification-labels.ts` beyond comments. (The settings page this change DID edit is a different
route: `/account/notifications`.) The shared coach chrome `coaches.module.css` is under concurrent
edit (+98 lines) and is the likeliest source. **Recorded rather than fixed, because it belongs to
whoever owns that work — but it is a real defect and it will fail the gate for the next commit.**
