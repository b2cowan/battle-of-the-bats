# Board Ready Stage 4 Part 1 — the built words and behaviour, against the /legal build rules
**Last verified:** 2026-11-20
**Re-verify by:** the Part 2 build (family side), and again at Part 3; or any edit to `lib/club-form-words.ts`, `club_form_ticks` or the register route's tick step
**Depends on facts:** the published Privacy Policy 2026-11-17 (§5 sign-up data, §9 retention); `BOARD_READY_STAGE4_FORMS_BUILD_PROMPT.md` "/legal build rules"; migration 513 is dev only (production holds 0 seasons with waiver text, so the waiver move touches nothing there)

## Question(s) this answers
Does what Part 1 built keep the drawing's /legal rules? Plus the one question the prompt hands /legal for Part 2: may health answers be kept in the browser tab until sent?

## Finding — passes
- Builder carries "Don’t ask for a health card number or a photo of one." for short answer, long answer and file only (`QuestionWindow.tsx:207`, `asksForTyping`).
- Health switch, keyword suggestion (offers, never blocks), health forced off the draft board in the type and in the table (`club_form_questions_health_not_on_board`).
- A file question can never be required (type rule and table check).
- A tick records document, version, fingerprint, exact sentence, guardian, server time; no IP column anywhere (mig 513 `club_form_ticks`; the route logs codes only).
- No "scanned", "virus-checked" or "we confirm they read it" anywhere in the built words (`DocumentWindow.tsx:13` states the rule).
- Moved ticks have no version, no fingerprint, no hand-over (table check `club_form_ticks_moved_bare`); the sentence given them, "I have read and agree to the waiver.", is the label the shipped checkbox carried (`git show HEAD:components/league/RegisterForm.tsx`).
- Copy copies questions and documents only (`copyForm`; `copyBody`, `copyLineSub` say "Nothing families answered last season is copied" / "No answers are copied").
- Every table service-role only; the new bucket is private and on the purge list.
- The club's own PDF opens by a 1-hour signed link, redirected, `no-store`, `no-referrer`, `nosniff`, opened in a tab. Acceptable for a club's own document (not personal information; the family will read the same file). A family's attached file is different: Part 3 must download it (`Content-Disposition: attachment`), 1 hour, logged.

## Findings that need a change
1. **"Waiver accepted" is now claimed for any document.** The register route sets `waiver_accepted_at` whenever the club has any live document, including a code of conduct ticked "I have read". Readers say "Waiver accepted {date}" (`lib/children-duplicates-read.ts:118`), list the child's "signed copy" (`lib/child-page.ts:192`, `child-page-words.ts:178`) and export it (`lib/families-export.ts:182`). A club with no waiver would show one.
2. **Health answers would be collected before anyone can read or guard them.** Parts 1 and 2 let a club ask and a family answer; the record, exports, guard tests and retention are Part 3. Collecting health information the club cannot see is a data-minimisation fault, and the "stays out of list columns, the draft board and emails" promise has no guard test until Part 3.
3. **`club_form_submissions` keeps a guardian's email with no deletion path.** The registration-delete trigger removes answers, ticks and files but not the sign-up row (ticks only SET NULL).
4. **The consent ledger text must cover PDFs in Part 2.** Joining every document's sentence and text is fine (the ticks table is the real evidence; the ledger's one-live-row-per-guardian rule means a repeat guardian's later text lives only in ticks). But `liveTextDocuments` skips PDFs, so once Part 2 adds them the joined text must carry the sentence plus the file name and version, or the ledger will say nothing about a PDF.
5. **Keyword list misses common health wording** ("special needs", "dietary", "mobility", "mental", "anxiety", "vision", "hearing", "glasses", "accommodation") and trips on "conditions" in "terms and conditions". A suggestion only, but the miss is the costly side.
6. **Moved ticks and Replace.** A document with only moved ticks shows version 1 with "no ticks yet", so "They must tick again" would read as affecting nobody. Part 3's "text as the club held it on {date}" must use the move date (the version's created time), never the tick date, because the waiver was editable before the move.

## Release rule
Part 1 alone is not promotable (the migration header says so for PDFs). Widen it: **Parts 1, 2 and 3 reach production together**, or at minimum Part 3's record read, health guards and export rules ship before any club can ask a question.

## Part 2 — health answers kept in the tab
Recommendation: keep ordinary typed answers in session storage (tab-scoped, device-only); **never keep an answer to a health-flagged question, and never a file**. A health answer lives in memory only; after a reload the form says "Answers to health questions aren’t kept if the page reloads. Please answer them again." Clear everything on a successful send. Never a server-side draft (it would be health data held with no registration, outside every retention rule). Reason: a shared family tablet or library computer; the cost is re-typing on a reload. Owner call to confirm.

## Sources
Not re-researched: PIPEDA safeguards principle and the policy's own §5/§9 promises, read through the published text and the migration.

## Lawyer's eye needed?
Same list as the build prompt (club-written health questions, Ontario health card numbers, Québec Law 25, tick as evidence, a public no-login endpoint taking files). Nothing new from Part 1; no gate.
