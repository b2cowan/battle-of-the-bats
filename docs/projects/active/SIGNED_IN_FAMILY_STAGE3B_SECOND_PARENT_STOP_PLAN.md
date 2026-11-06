# A stop button for the second parent's emails — Implementation Plan (Signed-in family accounts, Stage 3b)

> **Status:** Planning — owner calls O1–O5 RULED 2026-11-06 (all five as recommended); no code yet
> **Created:** 2026-11-06
> **Branch:** dev
> **Build prompt:** `SIGNED_IN_FAMILY_STAGE3B_BUILD_PROMPT.md` (written 2026-11-06, two sessions; it settles the "Stopped" line by storing the cleared sign-up ids on the stop row)
> **Parent plan:** `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md` Stage 3 · closes build-prompt owner question 2 and the
> `/legal` finding in `docs/agents/legal/CASL_SECOND_PARENT_EMAIL.md` (2026-11-06)
> **Plan gating:** none. House League sign-ups on every plan that has them; the button rides on the second parent's copies.

## Goal

Give the person behind a second-parent address a one-click way to end every sign-up email to that address, and make it
permanent: the address is removed from the sign-up(s) and cannot be re-added to that club. The stop is the removal, so no
send path needs a suppression check; the nine places that already read the column simply find it empty.

## PM Brief
See `SIGNED_IN_FAMILY_STAGE3B_SECOND_PARENT_STOP_PM_BRIEF.md`.

## Design (argued from what the code does)

**Why not reuse the existing family unsubscribe.** It writes `family_email_optouts` keyed on org + email and is read only by
the "Email families" door (`lib/family-email.ts:86, 235`; `lib/families-audience.ts:289`). The census found that
`sendSecondParentTransactional`, `sendSecondParentServiceCopies`, the pay-link loop, the sign-up-link loop and the register
route's copy never read it, so reusing it would mute announcements but leave the sign-up copies flowing, and widening it means
a read at five more send sites. Its suppression also expands to every address of the same person through `org_person_emails`,
so a real second parent who is also a first parent elsewhere in the club could mute her own household's mail by tapping Stop
on someone else's sign-up. Removal from the sign-up has neither problem.

**What Stop does** (org-wide for that address, all seasons):
1. Records the stop (new small table, one row per org + address).
2. Clears `guardian_email_2` on every `league_registrations` row of that org whose second address matches. Sends read that
   column, so they stop with no change to the nine senders.
3. Refuses the address afterwards on the public form and the staff windows.

**Confirm page, not a bare GET.** The existing `/unsubscribe` is a one-click GET (`app/unsubscribe/route.ts`). A destructive
GET is hit by mail scanners that prefetch links (an address would be stopped by a robot). The link opens a short page that
names the club and the sign-up and has one **Stop these emails** button (POST). The CASL test is "readily performed"; one
page and one button is that.

**Token.** A fourth HMAC suffix in `lib/unsubscribe-token.ts` (`:stop-second-parent`), keyed on org + normalised email, same
secret, same "deterministic, never expires" trade the file already documents. The suffix keeps it non-interchangeable with the
other three. Null when `UNSUBSCRIBE_SECRET` is unset, in which case no button is drawn (as the guardian link does today).

**The contact-email problem shrinks.** My earlier recommendation was to guarantee a working club address in the "who added
you" line. With a button, the line no longer depends on it: when the club has no usable public contact email, the line drops the
"tell the club at …" clause and points to the button. No block on clubs, no fallback address. (Replies still reach nobody when
`face.contact` is null: `familyReplyPlan`, `lib/email-club-identity.ts` ~170–190; unchanged and not this stage's.)

## Owner calls — RULED 2026-11-06, all five as recommended (the first option in each)

- **O1 · Scope of the stop.** *Recommended:* this club, every season, until the registrar of a *different* sign-up cannot
  re-add it either. Alternative: this one sign-up only (first parent can re-add the same address next season: the harassment
  loop returns).
- **O2 · Can the registrar undo a stop?** *Recommended:* **no** in this stage (an address that said stop stays stopped; the
  person can sign up themselves). Alternative: a registrar "allow again" after the person asks; costs a window and an audit row.
- **O3 · Does anyone get told?** *Recommended:* nobody is emailed; the registrar's record window shows "Stopped by the address
  owner, {date}". Alternative: one short email to the first parent. Disclosing the decision can itself cause friction.
- **O4 · Wording when a stopped address is typed.** *Recommended:* refuse in words ("That address has asked not to get these
  emails from this club. Enter another or leave it empty."). Alternative: accept silently and never send (the first parent
  would believe the other parent is being told: worse).
- **O5 · First parent's copies.** *Recommended:* untouched. A Stop on the *first* parent's mail is a separate, existing owner
  question (no unsubscribe on service mail "by design"); not widened here.

## Phases

### Phase 1 — The place to keep it (migration first)
- [ ] Migration `448_a_second_parent_can_stop.sql` (next free number after 447): table `second_parent_stops`
      (`org_id uuid` FK organizations, `email text` lowercase/trimmed with the same 200-character CHECK as
      `guardian_email_2`, `stopped_at timestamptz`, `source text`), unique `(org_id, email)`, RLS on, service role only.
      Dev first; prod before the promote. Check the next free number again at build time.
- [ ] `docs/agents/db/DATA_DICTIONARY.md` entry (what it holds; written only by the stop page; **never** a household or marketing
      key; checked by the form and staff add/edit) + `npm run refresh:snapshots` (dev + prod) + `npm run check:dictionary`.
- [ ] `supabase/migrations/MANUAL_PROD_STEPS.json` entry.

### Phase 2 — The link and the stop page
- [ ] `lib/unsubscribe-token.ts`: `generateSecondParentStopToken` / `verify…` / `buildSecondParentStopUrl(orgId, email)`; unit
      tests in a new `tests/unit/second-parent-stop-token.test.ts` (round trip, wrong org, wrong email, cross-family tokens fail
      each other's verify, null without secret, normalisation).
- [ ] New page `app/second-parent-stop/page.tsx` + a POST handler: verify the token, show the club name and "stop sign-up
      emails to {address}", POST inserts the stop row and clears `guardian_email_2` for the org, then a confirmed state. Invalid
      or already-stopped links say so plainly (already-stopped is a success state, idempotent). Build from the shipped
      `/unsubscribe/confirmed` page's look. No sign-in.

### Phase 3 — The button on every second-parent copy (five sites)
- [ ] `lib/league-second-parent-mail.ts` `secondCopyHtml`: take the recipient address and org id and splice a footer link before
      the closing card (covers approve, waitlist, promote, decline, placement, schedule, practice times and changes: census Q3).
- [ ] The three callers that bypass it: the register route's confirmation (`secondParentLine != null` already marks the second
      parent's copy), the pay-link loop in `lib/online-payment-receipt.ts` (~303–309), and the sign-up-link notices in
      `lib/league-signup-link-mail.ts` (~152–156, where `secondParent` is already a flag).
- [ ] One shared footer builder so the five sites cannot drift. Use `WARM_EMAIL_STYLE.finePrintLink` and the footer helpers in
      `lib/email-envelope-warm.ts`.
- [ ] A guard test in `tests/unit/league-second-parent-fanout.test.ts` that **every** second-parent send path carries the link
      and **no** first-parent path does (the fan-out file already holds the "receipts stay with the payer" guard; same shape).
- [ ] "Email families" (`lib/families-email.ts`) already carries its own per-address unsubscribe; verify it still does and
      leave it alone.

### Phase 4 — Refuse a stopped address; show the registrar
- [ ] After `readSecondParentEmail` in the public register route and the staff routes (Add registration, record-window edit),
      look the address up in `second_parent_stops` and refuse with the O4 words. Keep `readSecondParentEmail` pure; the lookup
      lives in the routes (or one shared async helper next to it).
- [ ] Record window: where the address was, show "Stopped by the address owner, {date}" (read from the stop row via the cleared
      address's last known value is not possible once nulled, so show it from the stop row joined on sign-up: store `signup_refs`
      cleared in the stop row, or accept showing the line only on sign-ups cleared in this action; decide at build and record it).
- [ ] Export and search: unchanged (empty column).

### Phase 5 — The "who added you" line
- [ ] `lib/league-second-parent.ts` `addedYou`: when the club has no usable contact email, drop the "tell the club at …" clause
      and point to the button; with one, say both ("use the button below, or tell the club at {email}"). One edit; the words go
      through `/marketing` (below). Update the existing "a club with no contact address" test (`league-second-parent.test.ts` ~37).

### Phase 6 — Follow-through
- [ ] `/docs`: the families' sign-up help (a second parent can stop the emails) and the registrar article (the record window's
      "Stopped" line, the refusal) in `lib/help-content/house-league.tsx` (+ `keywords`/`searchText`).
- [ ] `/legal`: add the sentence to `docs/agents/legal/drafts/PRIVACY_POLICY.md` about other people's addresses and the stop
      button; update `CASL_SECOND_PARENT_EMAIL.md` (what the product does today) and the index.
- [ ] `/marketing`: the words below, one pass, before the walk.
- [ ] `/simplify` then `/review` (email fan-out and a public no-login page that edits data: ask the security lens: token
      scope, scanner prefetch, enumeration through the refusal message).
- [ ] Owner walk: one purpose, checkable. A sign-up with a second parent → Stop from the confirmation, then from a later email
      → nothing further arrives, the first parent's copies are unchanged, the record window shows the stopped line, re-adding
      the address is refused on the form and by the registrar → put back. Next free § in `OWNER_QA_LEDGER.md`.
- [ ] `TODO.md` one line; Stage 3 block in the parent plan; build prompt Progress block.

## Architectural decisions
- **Decision:** the stop clears the column rather than adding a suppression check at each send. **Rationale:** nine senders
  already read the column; a stop that depends on nine new reads is a stop that one future sender forgets.
- **Decision:** a new table, not `family_email_optouts`. **Rationale:** that table means "no announcements", expands to the
  whole person, and is not read by the sign-up copies (census Q1, Q7).
- **Decision:** confirm page with a POST. **Rationale:** scanners prefetch GETs.
- **Decision:** nothing is added to the first parent's mail. **Rationale:** O5; the first parent's position is a separate
  ruled design.

## Words for /marketing
- [ ] "Stop these emails" — the button on every second-parent copy — second parent
- [ ] The line on top of the confirmation, new version (with and without a club contact email) — second parent
- [ ] The confirm page: heading, one sentence naming the club and sign-up, the button, the done state, the "link not valid"
      state — second parent (a person who may not know the club well)
- [ ] "That address has asked not to get these emails from this club. Enter another or leave it empty." — form and registrar
      windows — first parent, registrar
- [ ] "Stopped by the address owner, {date}" — record window — registrar
- Privacy-policy sentence: `/legal` writes it; `/marketing` reads it for voice.

## Open Questions
- [ ] O1–O5 above.
- [ ] Phase 4's "Stopped" line needs the cleared sign-ups remembered; decide between a `signup_refs` array on the stop row and
      showing the line from the stop action's own write. Smallest thing that lets the registrar see it.
- [ ] Does `org_person_emails` ever take a second address (census Q7 did not check)? If it does, the stop should clear it
      there too. Check in Phase 1 before the migration is written.
- [ ] Stage 4 will invite this same address to sign in; a stopped address must not be invited. Note in Stage 4's plan.
