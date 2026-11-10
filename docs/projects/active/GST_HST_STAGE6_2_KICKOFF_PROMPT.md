# GST/HST Stage 6 · step 6.2 — the legal pages, versioning and links (kickoff prompt for `/plan`)

> Written 2026-11-08 by the 6.1 legal-pass session, after the drafts reached v0.2 (committed `72d532a09`). Run it as a **`/plan`
> session on Opus**. Plan of record: [GST_HST_STAGE6_TERMS_PLAN.md](GST_HST_STAGE6_TERMS_PLAN.md) — §3's RULED block (with the
> O1 correction and O1′) is binding; **§5 step 6.2 is this session's brief**; §5.3 and §5.4 say what later steps will need from it.
> PM brief: [GST_HST_STAGE6_TERMS_PM_BRIEF.md](GST_HST_STAGE6_TERMS_PM_BRIEF.md).

## What this session is

A **planning** session. It writes the **build prompt** for 6.2 (a Sonnet build session, one or two chunks) and updates the PM
brief and the plan's §5 6.2 progress line. **No product code.** Before the build prompt, present the plain-language UX summary
(house rule) and get the owner's answers to the questions below. Nothing is published: everything 6.2 builds is **dark** behind
one switch until 6.7.

## What 6.2 delivers (from the plan, §5 6.2 — re-read it there)
- **Two reading pages**, the Terms of Service and the Privacy Policy, at `/legal/terms` and `/legal/privacy`; `/terms` and
  `/privacy` redirect there. (Payments terms later, with L3 — leave room, build nothing for them.)
- **Every published version stays readable at its own address** (`/legal/terms/<version>`), because an acceptance record (6.3)
  points at a version and we must be able to show what someone agreed to.
- **Version = the effective date `YYYY-MM-DD`** (the payments-terms shape). **Two values per document:** the current version, and
  the oldest version that still counts as accepted. A minor change moves the first; a significant one moves both and brings back
  the sign-in screen (Terms §18 and §20). 6.3 reads these; 6.2 defines them.
- **One switch.** Off: the routes 404 and no link renders anywhere. On (dev first): every link below renders.
- **The links**, from the plan's census (§7, a helper's — [H], open each before planning on it): the marketing footer's bottom
  row; the shared account menu; the account page's reserved row (`app/(consumer)/account/page.tsx:68–72`, comment of
  2026-07-20); inside the sign-in and sign-up cards (those pages hide the footer on purpose); the platform email envelope's
  footer, for FieldLogicHQ's own account emails only. **Not** on club or tournament public sites (they are the club's pages; the
  club's own privacy link is a different thing) — the account-making doors there get their links with 6.3's tick-box line.
- **Done when:** with the switch on in dev every surface above links the pages; with it off nothing renders.

## Read first (only these until a question needs more)
1. The plan: §0, §3 RULED block, §5 6.2 / 6.3 / 6.7, §7 entry points.
2. `docs/agents/legal/drafts/TERMS_OF_SERVICE.md` — only §1, §18, §20 and the header (what the pages must carry and how
   versions behave). `drafts/PRIVACY_POLICY.md` header only.
3. `docs/agents/legal/LEGAL_INDEX.md` § Documents (the one-home rule).
4. `lib/online-payments-switch.ts` (the switch pattern) and `docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md` (the house
   standard for public reading pages).
5. The `GUARDIAN_CONSENT_STAGE4.md` closeout item 3 (a null privacy-URL constant in the family code is waiting on this page).

Census work (every link surface, every existing hard-coded privacy/terms URL or contact email) goes to an `Explore` helper with
"return path:line and a verdict"; open the cited lines before the build prompt rests on one.

## Questions this session must settle (bring a recommendation for each; the owner rules)

1. **⚠ Where the page's words live, without two copies.** The drafts are the one home of the text until 6.7, when the plan says
   the product's copy becomes the single source and the drafts are deleted. But 6.2 builds pages that render text *now*, dark.
   Two copies that can drift for weeks is the exact failure the one-home rule exists to stop. Options to weigh: (a) the pages
   render a placeholder while dark, and the text moves into the product once, at 6.7; (b) the text moves into the product now
   and the draft files become pointers immediately (then `/legal` edits the product's copy from here on); (c) something else.
   Constraints either way: **owner notes (`> NOTE` blocks, `[brackets]`, the Stripe choice) never reach a customer**; a
   **published version is frozen** (its address shows the same words forever — one stored text per published version, never an
   edited file); the §20 "words the product shows" are product copy for 6.3/6.4, not page text. Recommend one; it decides the
   build's shape.
2. **⚠ The switch on dev.** The plan says "one constant, the payments-switch pattern". But that pattern's code constant is
   `false` and is what keeps production off — copied exactly, it keeps **dev** off too, and the plan wants 6.2–6.4 walked on dev
   before the text is approved. The payments switch is really two keys (an environment variable for "on here" and a code
   constant for "allowed on production"). Decide the legal pages' equivalent: e.g. environment on in dev, and a code constant
   that must also be true for production, flipped in its own reviewed commit at 6.7.
3. **The contact address.** The product already uses **hello@fieldlogichq.ca** as its reply-to and its contact constant
   (`lib/email-sender.ts:194`, `lib/online-payment-words.ts:1129`); the Terms say **support@fieldlogichq.ca**, the policy
   **privacy@fieldlogichq.ca**. Do the pages and the new links point at one constant, and does hello@ change to support@
   (an owner call — every sent email's reply-to changes)?
4. **Does a reading page need a drawing?** The house rule is to build to approved mockups; a legal page is a long reading page
   under the public layout standard, plus link placements in menus that already exist. Recommend whether a short `/design`
   drawing round (the page, the link in the account menu and the sign-in card, phone and desktop) comes before the build.
5. **What the page shows above the text:** the version / effective date, "earlier versions" (a list of past versions' addresses
   — or none until a second version exists), and a last-updated line. Keep it to what the record needs.

## Rules that bind the build prompt
- **Customer-facing words come from `/legal`'s drafts**, not from the build. Any new words (a page title, a link label, an
  "earlier versions" heading) are drafted by `/legal`; the build prompt marks them as `/legal`-owned and lists them.
- One spelling (`npm run check:spelling` on the product files): "Privacy Policy" as the document title (the drafts' choice,
  2026-11-08; owner confirmation pending — keep it one constant so a change is one edit).
- The demos: a demo tour must not break with the switch on (the tour check is the build's gate).
- **No personal name or home address anywhere** (O1′, ruled 2026-11-08): the seller is "FieldLogicHQ" only.
- `/legal` reviews what is collected, linked and promised before hand-off (CLAUDE.md); `/docs` gets one help line for where the
  legal pages live; offer `/review` after the build. No release timing in the plan (house rule).
- Explicit pathspecs only, on `dev`; ask before committing. Other sessions share this working copy and stage files of their own.

## Hand-over
End with: the build prompt's path, the PM-brief update, the plan's §5 6.2 progress line, the TODO line, and a short
product-owner summary (what a person will see once the switch is on; what stays hidden; what the owner ruled). Next after the
build: **6.3** (acceptance at every door) and **6.4** (the purchase email, the yearly reminder, the Québec refusal), both needing
6.2's version values. **6.5** (deleting an organization removes its files) can run any time, in parallel.
