# Retire the public demos — PM Brief

> Plan: [RETIRE_PUBLIC_DEMOS_PLAN.md](RETIRE_PUBLIC_DEMOS_PLAN.md) · Ruling: Business Decisions Log, 2026-11-25 "Both public
> demos are RETIRED" · Status lives on the board ("Retire the public demos").

**What it does:** Removes the two public "See it live" demos (the Riverdale tournament and the Riverdale Ridge coach's season)
from the product completely: every button and link to them, every sentence that says a demo is running, the shared demo
accounts and their data, and the special sign-in handling those shared accounts needed.

**Why it matters:** The demos rested on a reason that no longer holds (the paid tier was free for everyone until 2027). They
caused about a dozen sign-in and session bugs, the last one on production on 22 Nov. They need upkeep as the product grows, and
nothing shows anyone used them. Removing them takes away the most common source of sign-in bugs in the product.

**Who benefits:**
- **Every signed-in user:** sign-in, sign-out and two-step setup no longer carry exceptions for a shared account, so they behave
  the same everywhere.
- **The owner and every build session:** no curation passes, no demo checks at release, nothing to keep current.
- **Prospects:** they no longer find a demo that drifted behind the product.
- No plan restrictions change.

**Expected impact:**
- **On the public site:**
  - The home page, pricing, the three persona pages and the footer no longer offer a demo.
  - The pitch page stops promising that "the demo is running right now".
  - An old demo address lands on the pricing page.
- **What a prospect does instead:** they see the screenshots and walkthroughs, or they see the product with us in a meeting
  (the deck, their own club preview, a world built for the meeting).
- **What stays the same:** every plan is still bought at checkout.
- **Inside the product, nothing visible changes** except that Sign out is never hidden.

**Trade-off, said plainly:** there is no longer a way to try the live product alone before signing up. The marketing screenshots
were taken in the demos; they stay, but can't be retaken from them.

**Priority:** Medium. It is not launch work, and the danger is already contained: the demos stay guarded until they go. But the
removal pays for itself in fewer sign-in bugs, and every week the demos stay live they drift further from the product. The owner
sets where it sits on the board.

**How it is sequenced (four steps, each safe on its own):**
1. **Shut the doors and change the words.** This can be undone; no data is touched.
2. **Retire the release check and the nightly jobs, then delete the demo data.** Production only on the owner's yes.
3. **Remove the code** that handled the shared accounts.
4. **Tidy the records.**

**Success criteria:**
- No public page links to a demo or says one is running. An old demo address lands on pricing, signed out.
- The demo data and the two shared accounts no longer exist, on dev or production.
- No release step, build step, check or nightly job mentions the demos.
- Sign in, sign out, two-step setup and the account menu pass one short walk on each portal.
- The prospect previews and the Milton world are unaffected.

**Owner rulings (2026-11-25, both A):**
1. An old demo address lands on the **pricing page**.
2. The **building session** runs the production deletion, after the owner has seen its dry-run counts and said yes in that session.
