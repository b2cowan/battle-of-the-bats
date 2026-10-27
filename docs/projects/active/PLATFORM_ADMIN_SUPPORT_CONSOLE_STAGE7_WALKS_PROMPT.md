# Support console · Stage 7 · the owner's walks (prompt 2 of 3 — after the finish pass)

> Paste into a new chat on `dev` AFTER `…_STAGE7_FINISH_PROMPT.md` is done and committed. Written 2026-10-27 by the
> Stage 7 build session. Shared working copy: explicit pathspecs, branch check, `git show --stat HEAD` after. Commit
> nothing without the owner's OK.

## The job

Write the owner's two Stage 7 walks as checkable Artifacts, one purpose each, each with its Owner QA Ledger section
(next free § at the time — §394 is Part 0's, §395/§396 were taken by Club Tier on 10-27; grep `^## §` right before you
insert and never sort the §s). House rules: `memory/feedback_qa_walkthroughs_as_checkable_artifacts.md` in the
auto-memory (localStorage ticks with try/catch, progress, pass / issue / needs-a-call per part, notes, a "Build summary"
paste-back, a "Sign in as" card with URL, accounts and passwords and "keep it private"). Copy the head, styles and script
of the published Part 0 walk exactly: `docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE7_P0_WALK.html`
(https://claude.ai/artifact/KaNbQydpHEGTvBLq4SWuLk). Parse every inline script before publishing (one stray apostrophe
kills the page). Read the whole file before publishing it.

1. **Walk A · a lead from the form to signed up** (one purpose: the pipeline does what a growth person needs). Make a
   lead through today's public form on dev (Part 8's question and link tag are NOT built — leave them to Part 8's own
   walk). Then: Needs you (the lead appears as New; the amber count; the menu pill), the band and a step cell, Search
   and Filter, the lead page reads first; the pencil edits whole (step, source and its detail, next action, follow-up);
   the ✓ saves at once; Lost refuses without a reason and says so under the field; a note (dated, signed, no edit);
   Email {first name}'s templates and Mark contacted; link a club by hand through the name search; the "Signed up on …,
   N days after it arrived. Linked by …" line and the plan/trial line; the timeline's sentences; unlink puts the step
   back; Numbers (the band, the tables, the trend's "Paying by month starts on Oct 25, 2026", the definitions); Today's
   three growth rows. ⚠ The OFFERED match needs a club whose owner signed up with the lead's address and confirmed it
   from our email, then signed in — make that with the owner on dev if he wants it walked (a real sign-up on dev), or
   mark the step Held; never fake it from a probe.
2. **Walk B · the guard rails** (one purpose: each role sees only what it should, and nothing leaks). Support, Billing
   and Read only: no Leads, no lead route, Business numbers' three counts and no door, the Audit log's lead entries as
   one quiet line, a club's Story without the lead link; Growth/Product: the same entries in full. Copy emails (only
   said-yes; a lead marked Lost · Asked not to be contacted is never copied) and the export (Excel first; the audit
   entry; an empty email cell for "Asked not to be contacted"; a name typed as `=1+1` opens as text in Excel).
   Campaigns' one line; Promotions in Plans & pricing (labels only); Pitch decks on the kit (New deck window, Publish only
   when there is something to publish); Today's campaign rows count live campaigns only.
3. **The builder's calls** go in a "Calls the build made that you may want to overrule" card on walk A — the list is in
   the plan's "Stage 7 build (2026-10-27)" section (Mark contacted moves only New; the source and Lost reason codes in a
   lead edit's entry; no Details box under Lost; "started a subscription"; only the latest form refill dated; no staff
   notes in the export; catalogue four keep their menu place; no Opened line; Business numbers' back link gone; Pitch
   decks' "Name the deck and add at least one slide to create it.").

**Accounts:** dev staff `growth@dev.local`, `support@dev.local`, `billing@dev.local`, `readonly@dev.local`,
`product@dev.local` (password from `scripts/seed-platform-staff.mjs`); Super admin `uat-platform@fieldlogichq.ca`
(`.env.local`). Dev already holds one lead (the §394 walk's, `walk-s7-p0@example.com`, step Contacted); walk A should
make its own with a fresh made-up address. Every step names what to click and what to see; product-owner words; no
file paths in steps.

**Hand-off:** publish both, add both ledger sections with their URLs, link them from the plan's Stage 7 build section
and the hub index if you have it; the reply names the accounts and the URLs. Before writing a step, open the screen's
code and check the words the step quotes — a step quoting a word the screen does not show is a failed walk.

## Do not

Submit the public form from a probe, seed leads from a script, write either database, refresh `tests/uat/.auth/*.json`,
or build anything. A defect found while writing the walk is a finding to report, not a fix to slip in.
