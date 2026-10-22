# Club Tier Stage 7c: after the build (next-steps prompt)

> **Written 2026-10-22** at the end of the 7c build session. **Paste this into a new chat on `dev`.** Stage 7c (Email
> families) is BUILT in the working tree, **uncommitted**, migration 347 applied to DEV only. This chat runs the cleanup and
> quality passes on it, keeps the records true, and commits **only when the owner says so**. It does not build anything new.

## Read first

- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. They bind you, in particular: broad reading goes to a helper agent; a helper's
  summary is a lead, not evidence; disagree out loud before doing the work; stage explicit pathspecs only, never `git add -A`.
- The build prompt `docs/projects/active/CLUB_TIER_STAGE7C_BUILD_PROMPT.md` (what 7c was asked to make true).
- The plan record: `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 7, the "**7c BUILT 2026-10-22**"
  paragraph (owner answers, departures, corrections, follow-up, found-not-fixed).
- The design log `memory/design_decisions.md`, top entry "2026-10-22 — STAGE 7C" (the six owner answers and why).
- The Owner QA Ledger §359 (`docs/projects/active/OWNER_QA_LEDGER.md`, the last entry) and the walk page
  `docs/projects/active/CLUB_TIER_STAGE7C_WALK.html`, published at https://claude.ai/artifact/7yK3vG8tTbvFRd2XkMz1cK.

## What 7c is (the files)

**New:** `lib/families-audience.ts` (the one pure audience function: preview, button count, re-count and send),
`lib/families-email.ts` (preview + the press: re-count, `changed` refusal, claim, batches, give-back, log),
`lib/families-email-coaches.ts` (the head coach copy, colleague mail, deliberately a separate file),
`lib/families-emails-log.ts` (the Emails tab's merged, paged read), `app/api/admin/families/email/route.ts`,
`app/api/admin/families/emails/route.ts`, `app/api/admin/families/emails/[sendId]/route.ts`,
`app/[orgSlug]/admin/families/emails/page.tsx`, `components/admin/kit/club/families/EmailFamiliesWindow.tsx`,
`components/admin/kit/club/families/EmailsTab.tsx`, `supabase/migrations/347_the_club_can_email_every_family.sql`,
`tests/unit/families-email.test.ts`, `scripts/check-family-email-race.mjs`, the walk page above.

**Changed:** `lib/email.ts` (`sendEmailBatch`, `EMAIL_BATCH_SIZE`), `lib/family-email.ts` (`sendFamilyEmailBatch`),
`lib/families-read.ts` (the three row predicates moved out to `families-audience.ts` and imported; `loadFamilyAudience`
added), `lib/families-words.ts` (`CLUB_EMAIL_CAP`, `CLUB_EMAIL_STOPPED_AFTER_MS`, `FAMILY_EMAIL_WORDS`,
`FAMILY_EMAILS_TAB_WORDS`), `lib/admin-kit-nav.ts` (third Families tab), `components/admin/kit/club/SendParts.tsx`
(`SendRow` takes `pick.radio`), `FamiliesBook.tsx` (the door + the window + a notice pill), `FamiliesFrame.tsx` (tab title),
`Families.module.css` (`.emailBody`), `tests/unit/family-email-guard.test.ts` (manifest entry, batch-door shape check,
`CALLS_GUARDED_SEND` accepts `sendFamilyEmailBatch`), `tests/unit/admin-kit-nav.test.ts`, `tests/unit/team-move-coverage.test.ts`,
`scripts/check-families-record.mjs` + `scripts/families-record.sql` (T12 + three mutations), `scripts/layout-screens.mjs` (two
Families entries), `supabase/migrations/MANUAL_PROD_STEPS.json` (347, pending), `docs/agents/db/DATA_DICTIONARY.md`
(`family_email_sends`), the schema snapshots, and the records (plan, TODO, design log, ledger §359).

⚠ **The working tree holds other sessions' edits too** (at least `lib/registration-words.ts`, TODO, the readiness plan and
its PM brief, the ledger, the design log, Stage 4c-2 files). Verify with `git diff` which hunks are 7c's before you touch or
stage a shared file.

## The steps, in this order

**Run each skill as the skill (the Skill tool), not a summary of it.** After each step, say in two or three plain sentences
what changed for a club admin, if anything.

1. **`/simplify`** on the 7c diff only. The new abstractions are the batch door (`sendEmailBatch` + `sendFamilyEmailBatch`),
   the pure audience module, and `SendRow`'s radio option. Look hard at: duplication between `familyEmailPreview` and
   `sendFamilyEmailToClub` (both build the audience and the choices); the two `state` computations in `families-emails-log.ts`
   (`readEmailLog` and `readClubEmail` derive "stopped" twice); `audienceChoices` re-running `familyAudience` once per team and
   season (fine for a club of hundreds; say so or fix it). ⚠ Do NOT "simplify" these away, they are deliberate: the coach copy
   living outside `families-email.ts` (the family-email guard forbids `sendEmail(` anywhere in a guarded file); the work all
   finishing inside the request (never `after()`, never answer-then-send: Amplify has no `waitUntil` bridge, memory
   `reference_next_after_amplify`); the press attaching before the re-count; the `changed` refusal before the claim.
2. **`/review`** on the result (`.claude/commands/review.md`, its deterministic gate first). Hold the findings to the owner
   answers in the design log; a finding that contradicts one is put to the owner, not fixed.
3. **`/design`** on the built window and the Emails tab at **390 and 1440**, against drawing 4 and drawing 5
   (https://claude.ai/artifact/MLqvD7TXbLM5QX8H9mmapZ, source `CLUB_TIER_STAGE7_DRAWINGS.html`). Known departures, already
   recorded in the plan: the kit's closing ask; "Show them" absent once something is typed; the tab's all-time count; Reached
   meaning "accepted". Report anything else; change only what the owner agrees to.
4. **`/marketing`** on every new sentence in `FAMILY_EMAIL_WORDS` and `FAMILY_EMAILS_TAB_WORDS` (drafts as drawn). Rules
   that bind it: never the word "Messages" (a test enforces it); the unit is "families" everywhere (a test enforces it); the
   clock is "8:00 a.m."; `check:spelling` must stay green. ⚠ **If a word changes, the walk page quotes it**: update
   `CLUB_TIER_STAGE7C_WALK.html` in the same pass and republish it to the same URL (publish the same file path, or pass the
   `url`), and grep the other walk pages for the same sentence (memory: rewrite one walk, grep every walk). Update the unit
   test that pins `reach()`/`send()`/`sent()` if those change.
5. **`/docs`** for the user-facing flow: Families gets "Email families" and the Emails tab; the House league season email
   article should point to Email families for a club-wide send. In-app help is `lib/help-content/families.tsx` (and the house
   league's file); keep `keywords`/`searchText` in the one spelling.
6. **`/strategy`**: one confirmation only. `docs/agents/strategy/PLAN_PRICING_FACTS.md` already says Families is on League Plus
   and Club; 7c adds no gate. Ask it to confirm there is no drift and log nothing new unless it finds some. Do not restate a
   price anywhere.

After steps 1–5, re-run: `npx next typegen` then `npm run typecheck`; the focused tests
(`node --import ./tests/ts-resolver.mjs --test tests/unit/families-email.test.ts tests/unit/family-email-guard.test.ts
tests/unit/families-stage5a-guard.test.ts tests/unit/club-stage5-families-guard.test.ts tests/unit/kit-dialog-foot-text-guard.test.ts
tests/unit/one-window-stage1-guard.test.ts tests/unit/one-window-stage2-guard.test.ts tests/unit/admin-kit-nav.test.ts`);
`npm run verify:changed`; and, if any server rule moved, `npm run check:families-record -- --mutate` and
`node scripts/check-family-email-race.mjs` (both DEV only; the race script makes and deletes a throwaway club).

⚠ **Known, not yours:** one suite failure, `tournament-stage3-part7-guard` ("one side for search"), comes from the Stage 7b
follow-up commit `b7c7d8ce2`; `check:schema-parity` flags migrations 342–347 as dev-only until the release applies them. Do
not re-baseline either. Do not run the whole-product layout sweep on dev; `check:layout` on the Families entries only, with
`--workers=1` (the machine ran out of memory at four).

## The walk and its cleanup

The owner's walk (§359) may happen before, during or after this chat. **Do not wait for it, and never treat it as a gate.**
When the owner pastes walk results back:
- record the verdict in §359 (the format of §358's "✅ PASSED …" line), the plan's 7c paragraph, the TODO line, the design log
  (the three calls), and the project index (`ArtifactData`, artifact `MBKRySURVFu3V9cZJvmjVr`, `stages/s7` + one `log` row, read
  first and pin `if_version`);
- **clean up dev** (the walk page's lede promised this): delete the opt-out set up for the walk
  (`family_email_optouts` where `org_id = '54726fc1-a7a1-4b4d-8b28-8155e21f6c33' and source = 'walk_7c'`) and that club's
  `family_email_sends` rows, plus any one-household `family_messages` row the walk created (Part 8, Kate Patel). Use
  `node scripts/db-query.mjs --dev -q "…"`. **DEV only, never prod.** Say what you removed.

## Committing

**Only when the owner says to commit**, in this conversation. Then: re-check the branch is `dev`; commit through a private
index (memory `reference_partial_commit_shared_tree`) with explicit paths and only 7c's hunks of any shared file; run
`git show --stat HEAD` and confirm nothing foreign landed; end the message with the attribution lines the session gives you.
Suggested split: one commit for the code, migration, tests and scripts; one for the docs and records. Never push, never touch
`master`, and never apply migration 347 to prod (it goes with the release, `MANUAL_PROD_STEPS.json` says how).

## Not in this chat

- Rewiring the house-league season email onto the batched sender (the recorded follow-up).
- Widening Families' "this season" rule to a `registration_closed` season (walk call c3; the owner decides).
- Stage 7d (the coach's Tournaments) — its own prompt.

## The hand-off

Write it to the owner as a product owner (what a club admin sees, what changed, what is still owed), not as an engineer.
List each step's outcome, every finding you did not fix and why, what you put to the owner, and the commit hashes if the owner
asked you to commit.
