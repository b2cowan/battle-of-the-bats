# Coach Portal Launch Batch 2 — The "First Week" Bundle — PM Brief

> **Status:** Planning — awaiting mockup approval + five owner decisions. Created 2026-07-28.
> **Plan:** `COACH_PORTAL_LAUNCH_BATCH2_PLAN.md` · **Source:** the 2026-07-28 premium coaches portal UX readiness review (P0 findings #6, #7, #8 + wow idea #1).
> **Mockups (binding once approved):** `claude.ai/code/artifact/c52d7d67-dfeb-4727-b122-40d5ad73afec`

---

## What it does

Three things a coach hits in their first week with the paid portal, all of which currently make the product feel heavier than the free one.

**1. A whole roster goes in at once.** Today, adding fifteen players means opening a form, filling it, saving, and closing — fifteen times. After this, a coach pastes their team list (the one already sitting in a group chat or an email) into a box, sees a preview table they can correct in place, and adds everyone in one tap. Coaches who were handed a spreadsheet by their club can upload it instead. Anyone who still wants to add players one at a time keeps that option, and gains a "save and add another" so they never have to reopen the form.

**2. Forms stop showing everything at once.** The Add Player form asks for eleven things; adding a game asks for up to thirteen. After this, each form opens with just the handful of fields that matter, and the rest sit behind a single "add details" line the coach taps only if they need it. Anything already filled in stays visible when editing — nothing a coach typed ever gets hidden from them. The assistant-coach permissions screen gets the same treatment, with the everyday permissions up front and the sensitive ones (money, family contact details, sending emails to parents) grouped together and confirmed before they're granted.

**3. The home page shows the whole product and celebrates progress.** Today the Overview's setup checklist covers five of the portal's eleven sections — Chat, Staff, Documents, Announcements, and Development are never mentioned, so a coach can hit "100% set up" without knowing half of what they're paying for exists. After this, the setup panel opens with a five-step progress trail — roster in, first game scheduled, first lineup built, first announcement sent, money started — that lights up from the coach's real data as they go, with the remaining setup steps below it and a short "also in your portal" row naming everything else. It retires itself once the coach is through it.

---

## Why it matters

Two of these are commercial risks, not polish. Bulk roster add is the highest-friction task in the first two weeks of the product and a well-known point where a busy volunteer gives up and goes back to a spreadsheet — the customer is lost before they ever see the features they paid for. And the signup page sells dues, documents, attendance, and lineups as reasons to pay $29/month, while nothing inside the product ever walks a new coach past Roster, Schedule, and Budget — that's a direct value-realization gap on a subscription.

The form-overwhelm fix is a credibility problem: the free tier already solved this exact thing on the same forms. Right now the paid product is measurably harder to fill out than the free one, which is a bad look for something billed as premium.

---

## Who benefits

Every premium coach (head coaches and assistants), most sharply in their first week. Head coaches get the bulk add and the permissions grouping — assistants can't edit the roster or grant access, and nothing about that changes here. Assistants with restricted access never see steps or sections they can't act on. No plan-gating changes, no pricing changes, no new charges.

---

## Expected impact

- Getting a fifteen-player roster in goes from fifteen form round-trips to one paste and one tap.
- The two forms coaches fill most open with four visible fields instead of eleven and thirteen.
- Named coverage of the portal's sections on the home page goes from five of eleven to eleven of eleven.
- Permissions that expose money, family contact details, or the ability to email parents can't be granted with a single stray tap any more.
- The lineup step in onboarding stops incorrectly reading "not done" for coaches who have already built lineups.

---

## Tradeoffs made

- **The paste flow deliberately captures names and jersey numbers only** — not guardian emails or birthdates. Trying to parse contact details out of free-typed text produces confident wrong answers with people's personal data. Coaches who need contacts in bulk use the spreadsheet upload, which has labelled columns.
- **The setup panel stays on screen longer than it does today.** It currently disappears as soon as one player is added, which is precisely why a progress trail would never be seen. Every step remains skippable and the panel still has a "hide" control, so a coach who doesn't want it can clear it in a tap.
- **Chat and Development get named but don't become checklist steps.** Neither has an honest "done" state — Chat is structurally empty outside an active tournament, and Development is a hub rather than a task. Pretending otherwise would recreate the false "you're all set" the review is criticising.
- **Bulk add reports per-row failures instead of all-or-nothing.** Fifteen pasted names with one bad line adds fourteen players and says so, rather than silently rejecting the batch.

---

## Priority

**High — P0, pre-go-to-market.** These are the remaining three structural P0s that shape how a coach's first week feels, and interaction patterns calcify: the disclosure primitive and the checklist shape built here get copied into every form and hub added later.

---

## How to test it (owner)

1. **Bulk add** — on a team with an empty roster, tap **Add players**, paste a dozen names (mix formats: `12 Jordan Smith`, `Jordan Smith`, `Jordan Smith 12`), check the preview reads them correctly, fix one in place, remove one, add the rest. Then try the spreadsheet tab with the downloadable template.
2. **Duplicate numbers** — paste two players wearing the same number, and one wearing a number already on the roster; both should be flagged before saving, not after.
3. **Forms** — open Add Player and Add Event on a phone: confirm only the essentials show, that tapping "add details" reveals the rest, and that editing an existing player or game with details filled in shows those details already open.
4. **Permissions** — as a head coach, try granting an assistant money access and contact access; confirm you're asked to confirm. Removing access should be instant. Removing an assistant should use the app's own dialog, not the browser's.
5. **Home page** — on a brand-new team, watch the progress trail light up as you add a roster, schedule a game, build a lineup, send an announcement, and set a budget. Confirm it fits a phone screen, that a game happening today still takes priority over it, and that it retires itself at the end.

---

## Success criteria

- A fifteen-player roster is in the product in under two minutes on a phone, from a paste.
- No coach-facing form in the premium portal opens with more than six visible fields.
- Every one of the eleven portal sections is named somewhere on the Overview page for a new coach.
- The progress trail never reports a step as incomplete when the coach has actually done it.
- Mobile checks pass at both 390- and 360-pixel widths with nothing overflowing sideways and no button sitting under the navigation bar.
- Owner phone pass is clean in both the warm and dark themes, on an org-owned team and a standalone team.
