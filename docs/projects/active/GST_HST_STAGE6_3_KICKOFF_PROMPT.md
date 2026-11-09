# GST/HST Stage 6 · step 6.3 — acceptance at every door (kickoff prompt for `/plan`)

> Written 2026-11-09, after the 6.2 owner walk passed 21/21 (ledger §500; build `9f27c527d` + `5f6cc1b8f`). Run it as a **`/plan`
> session on Opus**. Plan of record: [GST_HST_STAGE6_TERMS_PLAN.md](GST_HST_STAGE6_TERMS_PLAN.md) — §3's RULED block is binding
> (**O5** one 18+ line for every account holder, **O7** one set of Terms for everyone, **O8** one-tick "We've published our Terms"
> for existing accounts); **§5 step 6.3 is this session's brief**. PM brief:
> [GST_HST_STAGE6_TERMS_PM_BRIEF.md](GST_HST_STAGE6_TERMS_PM_BRIEF.md). The exact customer words are the Terms draft's **§20 "The
> words the product shows"** — items (1) account creation, (2) the sign-in screen (first publication, after a change, and the
> "terms changed while this window was open" line), (3) the line beside a paid-plan button.

## What this session is

A **planning** session. It writes the **build prompt(s)** for 6.3 (Sonnet; the plan allows "two chunks if heavy" — this session
decides the split), updates the PM brief and the plan's §5 6.3 progress line, and writes the migration task list. **No product
code.** Before the build prompt, present the plain-language UX summary (house rule) and get the owner's answers to the questions
below. Everything 6.3 builds is **dark** behind the 6.2 switch until 6.7.

## What 6.3 delivers (re-read it in the plan, §5 6.3)
- **The record:** an append-only acceptance log — which document, which version, who, the email as text (it outlives a deleted
  user — the payouts shape), when, and **which door**. No IP address. The accepted version is mirrored onto the user's
  server-only metadata so a check costs no query (a helper's suggestion — verify).
- **Every door that makes an account** refuses, on the server, without the box: club/fan sign-up, coach sign-up, team sign-up, the
  tournament registration that makes an account, the staff invitation's set-password step, the follow nudge, and the family
  accept page. Platform-admin staff are exempt (they are us).
- **Before an organization or a plan:** org create, league create, the coach-portal creation, every checkout route, plan move,
  next-season choice, payment-method set-up — all refuse when the current version isn't accepted, with a code that opens the
  accept window instead of failing. Comped and Founding accounts go through the same check.
- **Existing accounts:** one shared server check called by the five signed-in layouts (consumer/family, club and tournament admin,
  club coaches, coach portal, platform admin) — **not** the request proxy alone, which misses the club Coaches Portal and the
  family app, and which magic-link and invite sign-ins skip.
- **Demos and fixtures:** demo sandbox users and orgs are exempt (a shared demo user must never see the screen); seed and walk
  fixture scripts record acceptance so probes aren't stopped.
- **Done when:** a census test lists every account-, org- and plan-creating route and fails when one lacks the check (the
  `HISTORY_ENDPOINTS` guard pattern), and the walk covers every door.

## What 6.2 left you (open these; they are real now)
- `lib/legal-documents.ts` — `currentVersion(doc)` and `oldestAcceptedVersion(doc)`. **⚠ They return `'draft'` in the dev preview,
  the dated version when published, and `null` when the pages are off.** Everything 6.3 builds must treat `null` as "do nothing at
  all": no box, no screen, no refusal, no record. That is what keeps production exactly as it is today until 6.7.
- `lib/legal-pages-switch.ts` — `legalPagesMode()` (`off` | `preview` | `published`); `lib/legal-links.ts` and `lib/legal-words.ts`
  — the link addresses and the one contact constant.
- The payouts route already has an acceptance (`app/api/admin/payouts/route.ts`, the `agree_terms` action checks the version
  shown; the `connect` action checks only that the box was ticked — **a known defect the plan says to fix in this build**).
- The guardian-consent family accept page links to the privacy page already (6.2); its own consent words are unchanged.

## Read first (only these until a question needs more)
1. The plan: §3 RULED block, §5 6.3 / 6.4 / 6.7, §7 entry points (a helper's census — open each cited line before you rest on it).
2. `docs/agents/legal/drafts/TERMS_OF_SERVICE.md` — §3, §18, §20 only.
3. `docs/agents/legal/LEGAL_INDEX.md` § Documents, and `LEGAL_FACTS.md` for what is recorded about people.
4. `lib/legal-documents.ts`, `lib/legal-pages-switch.ts`, `tests/unit/legal-pages-switch.test.ts` (the pattern to extend), and
   `tests/unit/coach-history-endpoint-guard.test.ts` (the shape of a census guard).
5. `docs/agents/db/DATA_DICTIONARY.md` — the conventions for a new table; **a migration is the first task in the plan**, with the
   dictionary + `npm run refresh:snapshots` (dev and prod) task beside it.

Census work (every account-making door, every org/plan-creating route, the five signed-in layouts, every place an account is made
by something other than a form — a webhook, an invite link, a magic link, an import, a seed) goes to an `Explore` helper:
"return path:line and a verdict, leave the file dumps out". **The census is the heart of this stage — a missed door is a
person who becomes a customer without agreeing.** Open every cited line yourself.

## Questions this session must settle (bring a recommendation for each; the owner rules)

1. **⚠ One table or two, and what a row says.** The record needs document, version, user, email text, time, door. Does the
   age statement ("18 or older") need its own field, or is it part of "what the box said" (a wording id)? A box that carries
   two promises needs a record of both. Recommend a shape; it decides the migration.
2. **⚠ What happens on dev while the switch is "preview".** The version a door records is the literal word `draft`. Recommend
   how acceptance of `draft` behaves: it satisfies the check in preview (so the dev walk is liveable), and it satisfies nothing
   on a published version (so every dev account accepts again at the flip). Confirm it can't leak into production, where the
   mode is `off`.
3. **⚠ The existing-account screen on an installed phone app.** The family app and coach portal are used as installed apps; a
   required full screen before anything opens can strand a person if it fails to render or to submit. Recommend what the screen
   does on a failed save, on a slow network, and on a signed-in session that was already open when the version moved (the
   "terms changed while this window was open" line).
4. **Who is exempt, and how that is spelled.** Platform-admin staff, demo sandboxes, fixture users. Recommend one flag or list
   with a single home, and a test that fails if a non-exempt account type is added to it.
5. **Account-making that isn't a form.** Anything that creates a login without a person ticking a box — an invite accepted by
   magic link, an import, a webhook, a seed. Recommend which of these must show the box at the first screen they land on, and
   which are covered by the sign-in screen (2) the first time that person signs in.
6. **The line beside paid buttons (§20 item 3).** The plan puts the checkout *refusal* in 6.3 and the *email* in 6.4. Confirm the
   line beside the button also belongs to 6.3 — and what a blocked checkout looks like when the person is mid-way through a
   purchase.
7. **Chunking.** Recommend the split (for example: A — the record, the shared check and the account-creation doors; B — the
   sign-in screen, the purchase and organization gates, the census test) and which chunk each fixture/seed change rides in.
8. **Words for `/legal`.** Any sentence not in §20 (a failed-save line, a refusal message, a button) is drafted by `/legal`, not
   the build. List them.

## Rules that bind the build prompt
- **Customer-facing words come from the Terms draft §20**, copied exactly; new words are `/legal`-owned and listed.
- **Dark means invisible.** With the pages off, nothing in this stage may render, record or refuse. The build's tests prove the
  off state for every door and every layout.
- **One spelling** (`npm run check:spelling`); "Privacy Policy" is the one constant. **No personal name or home address**
  anywhere (O1′).
- **Disagree out loud.** The plan was written before the build of 6.2; argue from what the code does. If a door the plan lists
  doesn't exist, or one it doesn't list does, say so before the prompt rests on it.
- The demos: a demo tour must not break with the switch on (the tour check is the build's gate).
- `/legal` reviews what is collected, stored and promised (the record, the age statement, the email kept as text) **before
  hand-off**; `/accounting` isn't needed here (nothing is priced) but the 6.4 email will need it. `/docs`: the help line is
  written at 6.7. Offer `/simplify` then `/review` after the build. No release timing in the plan.
- Explicit pathspecs only, on `dev`; ask before committing — other sessions share this working copy.
- The walk is a checkable Artifact: one purpose (every door, switch on, then off), the fixture teardown listed at the end.

## Hand-over
End with: the build prompt's path(s), the migration task list, the PM-brief update, the plan's §5 6.3 progress line, the TODO
line, and a short product-owner summary (what a person sees at each door once the switch is on; what stays hidden; what the
owner ruled). Next after the build: **6.4** (the purchase email with the version link, the yearly reminder, the Québec refusal —
needs 6.2's versions and `/accounting` on the tax lines). **6.5** can run any time in parallel.
