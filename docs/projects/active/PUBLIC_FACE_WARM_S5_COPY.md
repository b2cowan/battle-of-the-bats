# The public face, warm: S5 system-screen words (the `/marketing` pass)

> **Written 2026-10-23** by `/marketing`, after the owner ruled every S5 ask as recommended (drawings:
> https://claude.ai/artifact/Jshmg1RJSYXn5VzJM9yiGj, source `PUBLIC_FACE_WARM_S5_DRAWINGS.html`). **Words only.**
>
> **How the build uses this:** apply every line marked **Approved**; leave every line marked **Held** exactly as it is today
> (or off the page, where it says so). A line not in this doc keeps its current wording. A page being restyled does not get its
> sentences rewritten.
>
> Rules applied: `BRAND_STRATEGY.md` voice (practical, direct, warm), `VISUAL_IDENTITY.md` P3 (sentence case), P4 (a button says
> what happens, no arrow), P8 (no system words), the truth rule (copy says only what ships), typographic apostrophes, one spelling
> (`npm run check:spelling`), and "never claim Canadian identity".
>
> **One naming rule for this set:** the way out of a missing or broken page is **Home**, the app's own front door and the name of
> the tab a person sees. The buttons say "Go to Home", never "the home page", because the marketing home page is a different place
> (a browser visit to `/` shows it) and the button does not go there.

## 1. The 404 (`app/not-found.tsx`)

| Where | Today | Ruled |
|---|---|---|
| Eyebrow | Diagnostic Output | **Approved:** 404 · Page not found |
| Headline | [DIAGNOSTIC]: ROUTE_NOT_FOUND | **Approved:** We can’t find that page |
| Sentence | Requested resource is outside the current system scope. Verify the URL and retry, or return to root. | **Approved:** The link may be old, or the address may have a typo. Start from Home and look for it there. |
| Button | Return to Root Node | **Approved:** Go to Home (goes to `/discover`, for everyone) |

## 2. A crash inside a page (`app/error.tsx`)

| Where | Today | Ruled |
|---|---|---|
| Eyebrow | System Diagnostic Report | **Approved:** none |
| Headline | [SYSTEM]: INTERNAL_FAULT | **Approved:** Something went wrong on our side |
| Sentence | An unhandled exception was encountered during request processing. Event has been logged automatically. | **Approved:** We’ve logged it automatically. Try again, and if it keeps happening, go back to Home. |
| Buttons | Retry Request · Return to Root | **Approved:** Try again · Go to Home |
| Development only | the raw error message in a block | **Held** as today (restyled, development only) |

## 3. A crash in the root layout (`app/global-error.tsx`)

| Where | Today | Ruled |
|---|---|---|
| Headline | [SYSTEM]: FATAL_FAULT | **Approved:** Something went wrong on our side |
| Sentence | A fault was encountered before the interface could load. The event has been logged automatically. | **Approved:** The page couldn’t load. We’ve logged it automatically. Try again, or go to Home. |
| Buttons | Retry Request | **Approved:** Try again · Go to Home |

*Note:* if the whole app is down the report may not reach us. The sentence says "logged" as it does today. Drop the middle
sentence if the owner would rather not promise it.

## 4. Offline (`public/offline.html`)

| Where | Today | Ruled |
|---|---|---|
| Title | You're offline · FieldLogicHQ | **Approved:** You’re offline \| FieldLogicHQ |
| Headline | You're offline | **Approved:** You’re offline |
| Sentence | Reconnect to pick up where you left off — this page reloads once you're back. Pages you've already opened stay available. | **Approved:** Check your connection, then try again. Tournament pages you’ve opened before should still open. |
| Button | Try again | **Approved:** Try again |

Why: the page reloads only when the button is pressed (Ask 6 A, no new behaviour), and only public tournament pages are kept,
with a size limit, so "should" is the honest word.

## 5. Unsubscribe confirmed (`app/unsubscribe/confirmed`)

| State | Today | Ruled |
|---|---|---|
| Done, headline | You've been unsubscribed | **Approved:** You’re unsubscribed |
| Done, sentence | Your organization has been removed from FieldLogicHQ marketing emails. You won't receive any further promotional messages. | **Approved:** You won’t get these emails again. (true for an organization, a coach and a parent) |
| Done, note | Transactional emails — billing, account security, and tournament notifications — are not affected by this unsubscribe. | **Held, off the page** until the owner confirms it holds for a parent’s opt-out (Ask 8 B) |
| Bad link, headline | Link not recognised | **Approved:** We can’t use that link |
| Bad link, sentence | This unsubscribe link has expired or is invalid. If you'd like to stop receiving FieldLogicHQ marketing emails, reply to any email you received and we'll remove you within 10 business days as required by CASL. | **Approved:** This unsubscribe link has expired or isn’t valid. Reply to any email you received and we’ll remove you within 10 business days as required by CASL. |
| Our failure, headline (new state) | shows the bad-link words | **Approved:** That didn’t go through |
| Our failure, sentence (new state) | | **Approved:** Something went wrong on our side, so you’re not unsubscribed yet. Open the link in your email again in a few minutes. If it still doesn’t work, reply to any email you received and we’ll remove you within 10 business days as required by CASL. |
| Foot | FieldLogicHQ · Canada | **Held** exactly as today (follows the email sign-off decision; the owner owes a mailing address) |

The 10-business-day sentence and its reference to CASL are the same words as today and are **not** this pass’s to reword.

## 6. Suspended account (`app/(consumer)/auth/suspended`)

| Where | Today | Ruled |
|---|---|---|
| Headline | Workspace access paused | **Approved:** Your access to {club} is paused. With no club name: Your access is paused |
| Sentence | You can't open that workspace right now — contact an administrator at {club} to restore your access. | **Approved:** You can’t open {club} right now. Ask an administrator there to restore your access. With no club name: You can’t open your organization right now. Ask an administrator there to restore your access. |
| Reassurance | Your FieldLogicHQ account still works: you can browse scores and manage your account from the tabs below. | **Approved:** Your FieldLogicHQ account still works. You can browse scores and manage your account. While chat is on, the existing variant keeps "use chat": browse scores, use chat and manage your account. |
| Button | SIGN OUT | **Approved:** Sign out (quiet, not lime) |
| Foot | Signed in as {email} | **Approved** unchanged |

Why the pointer to "the tabs" is gone: on a computer the links sit in the top bar, not below, so the old words were wrong there.

## 7. The neutral share card (`lib/club-share-card-image.tsx`)

**Approved:** the name only (the mark’s tile and the FieldLogicHQ name on paper). No sentence, no club, team or person.

## Rulings on the process

- **Held, not for this pass:** the "FieldLogicHQ · Canada" foot, the CASL sentence, and the "not affected" note.
- **Findings routed, not worded here:** the suspended page reaches only people with no active workspace (F5); the marketing
  share card’s squarer-preview crop risk (an S4 follow-up).
