# GST/HST Stage 6 · step 6.2 — the legal pages, versioning and links, built dark (build prompt)

> Written 2026-11-08 by the 6.2 planning session (`/plan`, Opus) from
> [GST_HST_STAGE6_2_KICKOFF_PROMPT.md](GST_HST_STAGE6_2_KICKOFF_PROMPT.md). **Run as a Sonnet build session, two chunks.**
> Plan of record: [GST_HST_STAGE6_TERMS_PLAN.md](GST_HST_STAGE6_TERMS_PLAN.md) — §3 RULED block (O1 correction, O1′) and the
> **§5 6.2 RULED block (Q1–Q6, 2026-11-08)** are binding. PM brief: [GST_HST_STAGE6_TERMS_PM_BRIEF.md](GST_HST_STAGE6_TERMS_PM_BRIEF.md).
> **Drawings:** drawn 2026-11-08/09, round 2 after the `/design` review — https://claude.ai/artifact/MWPQ7ZMos5js7gBCdrkjxr
> (source [GST_HST_STAGE6_2_DRAWINGS.html](GST_HST_STAGE6_2_DRAWINGS.html); words: Terms draft §20 item (4), 4a–4f, by `/legal`).
> **⚖ APPROVED 2026-11-09 (owner, "i agree with your recommendations, go ahead") — all seven asks as recommended:**
> **1A** a contents list beside the text at ≥1080 px only (sticky under the bar + `--offer-bar-h`, height-capped, scrolls on its
> own), none narrower; every "§N" links to its section and every heading carries an anchor · **2A** the account menu gets a
> "Terms · Privacy" line under Sign out behind its own separator (12 px, underlined, 28 px desk row / 44 px sheet row, menu-item
> role, full titles as accessible names) · **3A** the account page gets two rows, "Terms of Service" and "Privacy Policy", just
> above Sign out — **and the same two rows under the signed-out page's two buttons** · **4A** the menu draws its separator only
> when a row sits above it (fixes the support console's double hairline) · **5A** the earlier-version line in the olive-edged
> callout, its link on its own 44 px line · **6A** the draft banner in the text column above the title, the amber notice with a
> 16 px title line · **7A** the shared legal foot line stays on every door, tick-box doors included (6.3).
> Tab 9's "Build notes for Chunk 2" are part of this prompt. **Chunk 1 does not wait for them; Chunk 2 is built to these
> drawings.**
> Marks: **[V]** opened by the planning session 2026-11-08; **[H]** a helper's census that day — open the lines before relying on them.

## What this builds (owner's view)
Two reading pages — the Terms of Service and the Privacy Policy — on FieldLogicHQ's own site, every published version
readable at its own address forever, and links to them from the site footer, the account menu, the account page and under
the sign-in and sign-up forms. **All of it dark:** with the switch off the pages are "not found" and no link renders. On dev,
a **preview** shows the `/legal` drafts themselves, filtered of every owner note, under a "Draft" banner. Nothing is published
until step 6.7.

## The six rulings this build implements (2026-11-08, "agree as recommended")
1. **Q1 — The words' one home.** Until 6.7 the drafts (`docs/agents/legal/drafts/TERMS_OF_SERVICE.md`, `PRIVACY_POLICY.md`)
   stay the one home. The dev preview **reads the draft file itself** and filters out the owner parts. At 6.7 the approved
   text is written **once** as that date's frozen version file and the draft is deleted. A published version's file is
   frozen **by the build** (its content hash is recorded; an edit fails a test). No copy of the text exists anywhere else.
2. **Q2 — Two locks, the payments-switch pattern.** A server-only env var `LEGAL_PAGES_PREVIEW` (literal `'true'`) opens the
   preview; it **also requires a Stripe test key** (`stripeKeyIsTest`, `lib/stripe-mode.ts:20` [V]) — the same "this is not
   production" identity `lib/online-payments-switch.ts:26` [V] already uses. A code constant `LEGAL_PAGES_PUBLISHED = false`
   is the publication lock, flipped in its own reviewed commit at 6.7. Flipping it fails the build unless both documents have
   a dated published version.
3. **Q3 — One home for the contact address; hello@ stays for now.** The product's contact address moves into one constant;
   its value stays `hello@fieldlogichq.ca` because support@ does not receive mail yet (owner step owed). At 6.7, once the
   owner confirms support@ works, one edit makes support@ the one public address (reply-to included); hello@ keeps forwarding.
4. **Q4 — Drawn first.** Chunk 2 waits on the `/design` round.
5. **Q5 — Above the text:** the title and "Effective {date}" only. No "last updated" line. No "earlier versions" list until a
   second version exists. An earlier version carries the line "This is an earlier version, in effect from {date} to {date}.
   Read the current version." (final words: `/legal`'s page words).
6. **Q6 — No link in our own emails.** The platform envelope keeps no footer (owner 2026-10-20, `lib/email-envelope-warm.ts:169–175`
   [V]). The 6.4 purchase email carries the version link in its body. **Do not touch the envelope.**

## Read first (only these)
- `AGENTS.md` (Next 16; `proxy.ts`), and the Next docs in `node_modules/next/dist/docs/` for any route API you use
  (`notFound`, `redirect`, `generateStaticParams`, metadata).
- `lib/online-payments-switch.ts` [V] (the shape to copy) and `tests/unit/online-payments-switch.test.ts` (the test shape).
- Terms draft: the header (L1–29), §1 (L31–59), §18, §20 (L346–431) [V]; Privacy draft header (L1–34) [V] — the structure the
  filter must handle.
- The plan's §5 6.2 RULED block and §5 6.3 (what 6.3 will need from the version values).

---

## Chunk 1 — the engine (no visible surface; does not wait for drawings)

### 1a. The switch — `lib/legal-pages-switch.ts` (new)
```ts
export const LEGAL_PAGES_PUBLISHED: boolean = false;   // 6.7 flips this, alone, in a reviewed commit
export type LegalPagesMode = 'off' | 'preview' | 'published';
export function legalPagesMode(env = process.env): LegalPagesMode {
  if (LEGAL_PAGES_PUBLISHED) return 'published';
  if (env.LEGAL_PAGES_PREVIEW !== 'true') return 'off';
  return stripeKeyIsTest(env.STRIPE_SECRET_KEY) ? 'preview' : 'off';   // never a preview where the key is live or absent
}
export const legalPagesOn = (env = process.env) => legalPagesMode(env) !== 'off';
```
Header comment in the payments switch's style: the two locks, why (a reversal that matters is a commit), what "off" means
(routes 404, no link renders). Server-only; never `NEXT_PUBLIC_`.

### 1b. The registry — `lib/legal-documents.ts` (new)
- `LegalDocKey = 'terms' | 'privacy'` (leave room for `'payments'` with L3 — a comment, no entry).
- Per document: `draftPath` (the draft file, repo-relative), `published: { version: 'YYYY-MM-DD'; sha256: string }[]`
  (empty today), `current: string | null`, `oldestAccepted: string | null` (both null today).
- `currentVersion(doc, env?)` → the dated `current` when published; **`'draft'` in preview**; `null` when off.
  `oldestAcceptedVersion(doc, env?)` → same rule. 6.3 records whatever `currentVersion` returns and treats a recorded version
  as accepted when it is a date `>= oldestAccepted`; `'draft'` never satisfies a dated `oldestAccepted`. Write that rule in the
  file's header so 6.3 reads it there — **do not build acceptance here.**
- `isPublishedVersion(doc, v)`; `publishedVersions(doc)` (newest first); `versionSpan(doc, v)` → `{ from, to | null }` for
  the earlier-version line.
- Published version files live at `lib/legal-documents/<doc>/<YYYY-MM-DD>.md` (customer text only; none exist yet).
- **Deferred, write it as a comment only:** a significant change's 30 days' notice (§18) needs the new version readable before
  it is current — an `upcoming` field, added at the first significant change, not now.

### 1c. The words — `lib/legal-words.ts` (new)
`TERMS_TITLE = 'Terms of Service'`, `PRIVACY_TITLE = 'Privacy Policy'` (one constant each so a spelling change is one edit —
**do not add a spelling-gate rule**, no owner ruling to widen the gate), and the page words `/legal` drafted for the drawing
round (effective-date line, earlier-version line, draft banner, the "to be filled" mark, the account-row label, menu labels).
Every string here is `/legal`-owned: copy from the Terms draft §20 "Page words" block, never invent. Until `/legal` has
written them, Chunk 1 uses `TODO(/legal)` placeholders that Chunk 2 must replace (a test fails while one remains).

### 1d. The contact address — `lib/fieldlogichq-contact.ts` (new)
`FIELDLOGICHQ_CONTACT_EMAIL = 'hello@fieldlogichq.ca'` with a comment: becomes `support@` at 6.7 after the owner confirms that
mailbox receives mail (Q3); hello@ keeps forwarding forever (old emails carry it). Point these at it [H — open each]:
- `lib/email-sender.ts:194` — the hard-coded `reply_to`.
- `lib/online-payment-words.ts:1129` `PLATFORM_CONTACT_EMAIL` → re-export / alias the constant (its callers stay).
- `app/(consumer)/account/support.ts:5` `SUPPORT_MAILTO` → built from the constant.
- ⚠ `app/api/platform-admin/orgs/[id]/delete/route.ts:172` tells a closed organization to write to **support@**, which does
  not receive mail today — point it at the constant (a real defect, fixed here).
- **Leave:** `lib/email-sender.ts:28` (the FROM default, env `RESEND_FROM`) and `scripts/stack-health.mjs:499` (a script that
  runs by itself — shared automation, owner rule; not in this change).

### 1e. The draft reader and filter — `lib/legal-draft-preview.ts` (new, server-only)
`readDraftForPreview(doc)` returns the filtered markdown **only when `legalPagesMode() === 'preview'`**; otherwise it returns
`null` **before touching the file system**. Reads `path.join(process.cwd(), draftPath)`. The filter (the drafting conventions
`/legal` keeps — write them, word for word, into `docs/agents/legal/LEGAL_INDEX.md` § Documents as "Drafts the dev preview
reads", so `/legal` knows the shape it must keep):
1. Drop everything up to and including the **first line that is exactly `---`** (the DRAFT title, header table, change log,
   "How to read" block). The page title comes from `legal-words.ts`, never the draft's `#`.
2. Drop every blockquote block (contiguous `>` lines) whose first line starts `> NOTE` or `> NOTES`.
3. Drop the subsection `### The words the product shows` up to the next `## ` heading or `---` line (product copy, not page text).
4. Drop from the first `## Before this can be published` heading to the end of the file; trim a trailing `---`.
5. A `[text]` that is **not** a link (not followed by `(`) is a still-blank fact: render it as the "to be filled" mark.
- **The test is the safety net:** run the filter on both **real** drafts and assert the output contains none of `> NOTE`,
  `NOTE —`, `[V`, `[H`, `` `/legal` ``, `Stage 6`, `RULED`, `O1′`, `DRAFT`. If a draft trips it, the fix is a `/legal` edit to the
  draft (report it), not a wider filter. ("owner" is NOT on the list — §18 says "account owner".)

### 1f. The freeze test and the switch test
- `tests/unit/legal-pages-switch.test.ts`: `LEGAL_PAGES_PUBLISHED === false` (production is off); no env → off; env + live key
  → off; env + no key → off; env + test key → preview.
- `tests/unit/legal-documents.test.ts`: every `published` entry is a `YYYY-MM-DD`, its file exists, its sha256 matches
  (**a published version is frozen**); every file in `lib/legal-documents/<doc>/` is listed; `oldestAccepted <= current`; each
  published file contains no filter marker (1e's list) and no `[bracket]` blank; **when `LEGAL_PAGES_PUBLISHED` is true, both
  documents have a non-null `current` and `oldestAccepted` that are listed**; no `TODO(/legal)` left in `legal-words.ts`
  (this one may be `.todo` in Chunk 1 and becomes live in Chunk 2).
- `tests/unit/legal-draft-preview.test.ts`: the filter on both real drafts (1e), plus small fixtures for each rule.

### 1g. The markdown renderer
No renderer exists in the repo [H: none in `package.json`]. Add **`react-markdown` + `remark-gfm`** (tables), rendered in a
server component, raw HTML **off** (no `rehype-raw`). Use the repo's package manager and lockfile; pin exact versions at least
two weeks old; name the new dependencies in the commit message (a new dependency is a decision the owner sees). Wrap it once
in `components/legal/LegalDocumentBody.tsx` — links inside the text open in the same tab; the "to be filled" mark is a
component, not raw HTML.

### 1h. The switch reaches client components — one provider
The account menu, the foot rows and the family accept page are client components and must not read env. Mount one
`LegalLinksProvider` in `app/layout.tsx` (server) with `{ mode, termsHref, privacyHref }` resolved on the server; a
`useLegalLinks()` hook returns `null` when off. **Every legal link anywhere goes through `legalPageHref(doc)` (server) or this
hook (client)** — no hand-typed `/legal/` href.
- `legalPageHref(doc, version?)` returns an **absolute platform URL** (the canonical app origin — find the existing helper in
  `lib/app-origin.ts`). Why: on a club's own web address `/legal/...` is "not found" by design (`lib/club-host.ts:191` [V]), and
  the account menu also renders on club and tournament sites (`ClubBar`, `TournamentBand` [H]).
- A guard test (the online-payments guard shape): no file outside the helper/hook contains a `"/legal/` or `'/legal/` href.

**Chunk 1 done when:** the three tests pass, the contact constant is the one home, the provider is mounted and returns `null`
everywhere (switch off in every environment until dev's `.env.local` gains `LEGAL_PAGES_PREVIEW=true` in Chunk 2).
`npm run verify:changed` and `npm run typecheck` (shared modules + root layout). Root layout + new files = dev server restart.

---

## Chunk 2 — the pages and the links (built to the approved drawings)

### 2a. Routes (all render nothing but "not found" while off)
- `app/legal/terms/page.tsx`, `app/legal/privacy/page.tsx` — current version: in **published** mode, the frozen file of
  `current`; in **preview**, `readDraftForPreview` under the draft banner; **off** → `notFound()` (the
  `app/invitation-stop/page.tsx:60` pattern [H]).
- `app/legal/terms/[version]/page.tsx` (and privacy) — published only: a listed version renders its frozen file; the current
  one renders like the main page; an earlier one carries the earlier-version line; anything else `notFound()`. Preview → every
  `[version]` is `notFound()`. `generateStaticParams` from the registry.
- `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/legal/page.tsx` — **page-level** `redirect()` to the current page when on,
  `notFound()` when off. **Not** `next.config.ts` redirects: those are unconditional and would announce the pages while dark.
- Metadata via `marketingMetadata` (`lib/marketing-metadata.ts`); preview and earlier versions are `noindex`; **do not** add
  the pages to any sitemap (6.7 does that).
- The reserved words already exist (`lib/reserved-slugs.ts:32–33` [V]: `legal`, `privacy`, `terms`) — no change. Confirm the
  request proxy lets a signed-out visitor reach `/legal/*` (a marketing path), and that a club host still answers "not found".
- The frame: the **marketing frame**. Add `/legal` to the footer's marketing surface (`components/Footer.tsx` `STATIC_ROOTS`
  L15–23 [H]) and confirm the marketing top nav shows. Layout as drawn.

### 2b. The links (each renders only through 1h; nothing when off)
| Surface | Where [H unless V] | What |
|---|---|---|
| Marketing footer bottom row | `components/Footer.tsx:160–164` [V] | the two links beside "© … FieldLogicHQ" |
| Account menu (all seven portals) | `components/shared/AccountMenu.tsx` `settingRows` L272–323 [V], sign-out L325, separator L366–368 / L387–389 | as drawn (lead option: a small "Terms · Privacy" line under Sign out), desk popover **and** phone sheet; the platform console variant (`showAccount` false) too |
| Account page reserved row | `app/(consumer)/account/page.tsx:68–72` [V] | the row as drawn; **replace the 2026-07-20 comment** with one saying the row follows the switch |
| Under sign-in / sign-up forms | `StartFoot`, `components/auth/AccountForm.tsx:25` [V] | one shared `LegalFootLinks` beside or under `StartFoot` as drawn, on every door the census lists: auth login :252, account-only signup :145, the `/start` door form (:252/:323/:403), team signup (`app/team/TeamSignupClient.tsx` :453/:484/:557), coach join (:366/:388/:421/:573), accept-invite :168, accept-assistant-invite :268, accept-league-coach :202, forgot-password :115, reset-confirm :70, signup-confirm :55, `VerifyEmailSent` :58, reset-password (after :178) |
| Platform-admin login | `app/platform-admin/login/page.tsx:181` | inside its card, as drawn |
| Family accept page + family rows | `lib/family-guardian-consent.ts:33` [V] `FIELDLOGICHQ_PRIVACY_POLICY_URL = null`; `ClaimClient.tsx:262–263`, `family/_parts/FamilyRows.tsx:40–43` | replace the null constant with the hook (client) / helper (server); the "How we use your information" link appears only when on. **Leave** `GUARDIAN_CONSENT_DRAFT_NOTICE`, the consent words and `GUARDIAN_CONSENT_VERSION` alone — closeout items 3(c)–(d) are 6.7's |
- **Not here:** club and tournament public pages' own footers (the club's pages; the club's own privacy link `org.privacy_policy_url`
  is a different thing — leave every use); the account-making doors on those sites (the registration form, the follow nudge)
  get links with 6.3's tick-box line; **no email** (Q6); the payments terms placeholder (`lib/online-payment-words.ts:37,41`, L3).
- A guard test lists every surface above and fails when one stops rendering the links with the mode forced to `preview`, and
  when any renders them with the mode `off`.

### 2c. Dev on
Add `LEGAL_PAGES_PREVIEW=true` to dev's `.env.local` (and to `.env.example` with a comment, if that file exists). Restart the
dev server (env + new routes).

### 2d. Checks
`npm run verify:changed` (spelling and demos checks run inside it), `npm run typecheck`, the unit tests above,
`tests/unit/demo-destinations-guard.test.ts` (**the tour check is the gate**: a demo tour must not break with the switch on —
the demo sandbox's menu gains the links on dev, nothing else), `tests/unit/public-page-layout-guard.test.ts` (must still pass;
the legal pages are marketing pages, not `PublicPage` pages). `check:layout --changed` on the two pages and one sign-in page.

**Chunk 2 done when:** with the switch on in dev, every surface in 2b links the pages and the preview shows both drafts with no
owner note; with it off, every route is "not found" and nothing renders.

---

## Rules that bind this build
- **Customer-facing words come from `/legal`**: titles, link labels, the page words (Terms draft §20 "Page words"). The build
  writes no customer sentence. The draft text itself is never copied into the product in this step (Q1).
- **No personal name or home address anywhere** (O1′): the seller is "FieldLogicHQ" only. The phone and mailing address stay
  blank (`[phone]`, `[mailing address]`) until 6.7, and show only as the preview's "to be filled" mark.
- **No release timing**; explicit pathspecs only, on `dev`; **ask before committing** — other sessions share this working copy.
  Two commits are natural (Chunk 1, Chunk 2). `LEGAL_PAGES_PUBLISHED` stays `false` in both.
- Before hand-off: **`/legal` reviews** what is linked and the preview's output (no owner note reaches a page; the draft banner;
  the family link). `/accounting` is not needed (nothing is charged). Offer `/simplify` (new shared provider + helper) then
  `/review`. `/docs`: the one help line for where the legal pages live is **written at 6.7**, not now — a help line pointing at
  pages that are "not found" on production would be a broken promise (planning-session call, 2026-11-08; say so in the hand-over).
- Write the owner's walk as a checkable Artifact (one purpose: the dark switch on dev): each surface with the switch on, then
  switch off and every surface gone.

## Hand-over
Record the commit hashes in this file's Progress block, the plan's §5 6.2 progress line and the TODO line. Then:
**6.3** (acceptance at every door — reads `currentVersion` / `oldestAcceptedVersion`, adds the links beside the tick-box at the
club-site doors) and **6.4** (the purchase email with the version link, the yearly reminder, the Québec refusal). **6.5** can run
any time.

## Progress
- **BUILT 2026-11-09, dark.** Chunk 1 (the engine) `9f27c527d`; Chunk 2 (the pages and the links) `5f6cc1b8f`. `LEGAL_PAGES_PUBLISHED` is false in both; dev's `.env.local` carries `LEGAL_PAGES_PREVIEW=true`. Owner walk (switch on, then off): https://claude.ai/artifact/FAR1R1TUATP26Sipu7VdHb (ledger section not yet written). `/legal` review: nothing to change in the build; open for the draft: Terms §6 "STRIPE CHOICE" shows in the preview; for 6.7: privacy@ and support@ must both receive mail, and 6.3 + 6.5 must have shipped before the flip. `/docs` help line: written at 6.7, not now.
