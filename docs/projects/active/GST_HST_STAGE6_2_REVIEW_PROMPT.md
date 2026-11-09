# GST/HST Stage 6 · step 6.2 — simplify, then review (kickoff prompt)

> Written 2026-11-09 by the 6.2 build session. **Run in a fresh chat.** Order matters: `/simplify` first (so correctness review reads the
> cleaned-up code), then `/review`. Plan of record: [GST_HST_STAGE6_TERMS_PLAN.md](GST_HST_STAGE6_TERMS_PLAN.md) §5 6.2 RULED block;
> build prompt: [GST_HST_STAGE6_2_BUILD_PROMPT.md](GST_HST_STAGE6_2_BUILD_PROMPT.md).

## What was built (already committed on `dev`, dark)
Two reading pages (Terms of Service, Privacy Policy) and every link to them, all behind a switch that is OFF everywhere except dev's
preview. Nothing is published; `LEGAL_PAGES_PUBLISHED` is `false`.
- **Chunk 1 `9f27c527d`** — the engine: `lib/legal-pages-switch.ts`, `lib/legal-documents.ts` (registry + the rule 6.3 will read),
  `lib/legal-words.ts`, `lib/legal-draft-filter.ts` + `lib/legal-draft-preview.ts` (the dev preview reads the `/legal` draft and filters
  owner notes), `lib/legal-links.ts` + `lib/legal-paths.ts` + `components/legal/LegalLinksProvider.tsx` (every legal link goes through
  one helper or one hook), `lib/fieldlogichq-contact.ts` (one home for the contact address), two new dependencies (`react-markdown`,
  `remark-gfm`).
- **Chunk 2 `5f6cc1b8f`** — the pages and links: `app/legal/**`, `app/terms`, `app/privacy`, `components/legal/*`, `lib/legal-page-data.ts`,
  `lib/legal-sections.ts`; the links in `components/Footer.tsx`, `components/shared/AccountMenu.tsx` (also: the rule above Sign out is now
  drawn only when a row sits above it), `app/(consumer)/account/page.tsx`, the 14 sign-in/sign-up door files, the family accept page and
  family foot; `tests/unit/legal-links-surfaces-guard.test.ts`.
- Diff to review: `git diff 3cb3bbc81..5f6cc1b8f` (the two build commits only; `9f5a4e9b9` is docs).

## Step 1 — `/simplify`
Run `/simplify` on that diff. Things worth a hard look (not a to-do list; judge on the code):
- `LegalFootLinks` was added by script to ~20 `<StartFoot>` sites. Is there a smaller shape (one place) that still follows the census in
  the build prompt (the census deliberately skips a few `StartFoot`s)? Do not change which doors carry the line without asking.
- Overlap between `lib/legal-links.ts`, `lib/legal-paths.ts`, the provider and `lib/legal-page-data.ts`.
- `components/legal/LegalDocumentBody.tsx`: the cell-label plugin, heading ids, and `lib/legal-sections.ts`'s section-reference rewrite.
- Hand-written `useLegalLinks()` checks vs. one helper in the account menu, footer and doors.
Apply what is clearly better; list anything you decline and why.

## Step 2 — `/review`
Then run `/review` (the token-tiered adversarial funnel in `.claude/commands/review.md`). Questions the build session could not close:
1. **Dark means dark.** With `LEGAL_PAGES_PREVIEW` absent, or with a live Stripe key, does ANY route, link, banner, metadata, redirect or
   file read still show or touch the legal pages? (The root layout resolves the switch at render time; confirm it cannot be baked in at
   build for production, and that `app/terms`, `app/privacy`, `app/legal` answer "not found".)
2. **Draft banner and marks can never show on production** (the banner is keyed on the text coming from the draft file, not an env name).
3. **No owner note reaches the page** — the filter's safety-net test runs on both real drafts; try to break the filter with a draft shape
   the test does not cover.
4. **Account menu**: the new "only when a row sits above it" rule for the separator, in the popover, the phone sheet and the support
   console variant; the legal line's roles and tap targets.
5. **Links on club / tournament sites** are absolute platform URLs (a club's own web address answers "not found" for `/legal/*`).
6. **Family accept page**: the Privacy Policy link only through the switch; consent words and `GUARDIAN_CONSENT_VERSION` untouched.
7. `pnpm-lock.yaml` change: only insertions for the two new packages?

## Rules
- `dev` branch only; explicit pathspecs; **ask before committing**. Other sessions share this working copy and have unrelated
  uncommitted changes (also staged renames) — do not stage them. Use the temp-index approach in the partial-commit memory if a shared
  file is involved.
- Do not flip `LEGAL_PAGES_PUBLISHED`, widen the draft filter, touch the consent words, the email envelope, or shared automation
  (hooks, settings, database checks).
- Customer-facing words come from `/legal`; do not rewrite any.
- Known, already routed (do not re-report): Terms §6 "STRIPE CHOICE" shows in the preview (a `/legal` draft edit); `support@` and
  `privacy@` must both receive mail before 6.7; 6.3 and 6.5 must ship before the flip; the full `npm test` run has ~14 failures from
  other sessions' in-flight work, none in legal files.
- Checks: `npx tsc` via `npm run typecheck` (use `NODE_OPTIONS=--max-old-space-size=8192`), `node --import ./tests/ts-resolver.mjs --test
  tests/unit/legal-*.test.ts`, and `node scripts/check-layout-invariants.mjs --only=mkt-legal-terms,mkt-legal-privacy,auth-sign-in
  --workers=1` (dev server must be up with the switch on).

## Hand-over
Report in product-owner terms: what changed for the owner (nothing visible unless the switch is on), anything fixed, anything declined.
Record any new commit hash in this file's Progress block and in the plan's §5 6.2 progress line.

## Progress
- **Simplify + review DONE 2026-11-09, committed `7b8af5ccd`** (29 files): one opt-in `legal` prop on `StartFoot` for the 18 door lines, shared
  redirect helper, per-request page load, heading ids from a remark pass; the account menu's rule above Sign out fixed (it was inert) and the
  phone sheet's doubled rule removed; draft safety-net markers extended to HTML comments and footnotes. Seven questions answered; no Critical/High.
- **Open, for the owner / `/legal`:** the "organization closed" email now says hello@ on production; draft-filter note shapes the drafts do not use
  fail open (routed to `/legal` conventions); the wide-screen account Profile pane has no Terms/Privacy rows; version pages may hold a cached
  "not found" until redeploy (a 6.7 item).
