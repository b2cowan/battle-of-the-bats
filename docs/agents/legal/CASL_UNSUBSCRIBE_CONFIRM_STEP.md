# CASL — the unsubscribe link opens a confirm page, the button writes
**Last verified:** 2026-11-11
**Re-verify by:** the bulletin text is read in full (it returned 403 on 2026-11-11 and was known only through search snippets); or the page gains a second step or a field; or Bill C-36
**Depends on facts:** none that change; the three footer families (org, person, family address) in `lib/unsubscribe-token.ts`

## Question(s) this answers
Board Ready sweep 3, finding 7: mail scanners pre-open links, so the old `GET /unsubscribe` opted people (and whole clubs) out. The link now opens a confirm page that writes nothing; one button POSTs to `/api/unsubscribe`. Is that still an easy unsubscribe under CASL?

## Finding
- **s. 11(1):** the mechanism must let the person stop the messages "at no cost to them" and give an electronic address **or a web page link** to which the request can be sent. A link to a page with a button is a web page mechanism.
- **s. 11(2):** the address or page must stay valid at least 60 days after the message is sent. Links already in inboxes keep working (same URLs), so this holds.
- **s. 11(3):** effect "without delay, and in any event no later than 10 business days", with no further action from the person. The button's POST writes at once.
- **CRTC Regulations (SOR/2012-36) s. 3:** the mechanism must be "set out clearly and prominently" (3(1)) and "able to be readily performed" (3(2)).
- **The standard in practice** (CRTC Bulletin 2012-548, read only through search snippets): simple, quick and easy; its own web-page example is a link to a page where the person makes a choice, so link-then-one-click is the shape the regulator describes. No numeric step cap appears in what I found. The enforcement cases (Rogers Media, 2018) were about a mechanism that did not work or could not be readily performed.
- **What would break it:** a login, a typed address, a reason, a survey, a second confirm, or a button that does not work. None is present.
- **Gmail / Yahoo one-click:** not CASL. Google's bulk-sender rule (more than 5,000 messages a day to Gmail) wants `List-Unsubscribe` plus `List-Unsubscribe-Post: List-Unsubscribe=One-Click` on marketing mail. We set neither header today (`lib/email-sender.ts`).

## What the product does today
Page: `app/unsubscribe/page.tsx` (reads, writes nothing; already-opted-out and bad links go to `/unsubscribe/confirmed`). Writer: `app/api/unsubscribe/route.ts` (POST; also reads the query string, so it can answer a mail client's one-click POST later). Words: `lib/unsubscribe-words.ts`. No sign-in, no field, one button.

## Recommendation
1. **The confirm step is fine under CASL.** Keep it exactly one press: no sign-in, no fields, no "are you sure" after the button.
2. **Reword the note** (done in the same session): drop the scanner sentence. It explains our plumbing, not the choice in front of the person. Use: "Nothing changes until you press the button. If you opened this by mistake, just close the page."
3. **Say what stops.** s. 11(1) lets a person stop "all messages or a specified class". "These emails" is vague. Prefer "emails like the one you received". For the family-address branch, do not write "all emails from the club" unless `family_email_optouts` really suppresses every club email to that address (not checked; the existing done page already says "You won't get these emails again").
4. **Mask the address on the family-address page** the way `/invitation-stop` does (`maskEmail`). It is the person's own address and already in the link, but a forwarded link shows it to whoever holds it; the person still recognizes it.
5. **List-Unsubscribe headers: owner question, not built.** Not required by CASL. Worth doing for deliverability and because a mail client's own button then POSTs straight to `/api/unsubscribe` (the route is ready for it). It changes the shared sender, so it is its own owner-approved change, and Resend's support for custom headers is unchecked.

## Sources
- [CASL s. 11](https://laws-lois.justice.gc.ca/eng/acts/E-1.6/section-11.html) — accessed 2026-11-11
- [Electronic Commerce Protection Regulations (CRTC), SOR/2012-36, s. 3](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2012-36/page-1.html) — accessed 2026-11-11
- [CRTC Bulletin 2012-548](https://crtc.gc.ca/eng/archive/2012/2012-548.htm) — not opened (403); search snippets only, 2026-11-11
- [Google, email sender guidelines](https://support.google.com/a/answer/81126) — accessed 2026-11-11

## Lawyer's eye needed?
No for the confirm step. Only if the owner wants certainty on "readily performed" for a page with an extra step.
