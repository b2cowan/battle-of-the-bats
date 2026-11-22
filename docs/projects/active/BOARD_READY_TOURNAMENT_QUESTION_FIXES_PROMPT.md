# Prompt — Board Ready · the tournament registration questions: three fixes (F1–F3)

> One session, pasted into a fresh chat as *"Read and follow
> docs/projects/active/BOARD_READY_TOURNAMENT_QUESTION_FIXES_PROMPT.md"*. Written 2026-11-20 from the Stage 4 forms
> drawing (https://claude.ai/artifact/THVuyR2zxwU8ezeFti5of9, tab 9 findings), owner ruling 15 (2026-11-20, "as
> recommended"): **fix F1–F3 now as a small separate fix; tournaments move onto the club form later, in their own
> stage.** Independent of the Stage 4 build; can run beside it. Plan: `BOARD_READY_PLAN.md` §5 Stage 4, ruling 15.

## What is wrong today (re-read the lines before changing them)
- **F1 · Archived answers vanish.** Archiving only sets `is_archived` (`lib/db.ts` ~L850–856), but every read uses
  `getTournamentRegistrationFields` with archived questions skipped (~L794). The teams route drops any answer whose
  question is missing (`app/api/admin/teams/route.ts` ~L130–132) and the CSV export makes columns only for active
  questions (`app/api/admin/tournaments/[tournamentId]/registrations/export/route.ts` ~L194, ~L228). The archive window
  promises "Answers teams already gave stay with their registrations." **Fix:** keep the promise. Archived questions
  that have answers still show on the team's record (`TeamRecord.tsx` ~L528–534, under a "No longer asked" line) and in
  the export (after the active columns). The public form still never shows them.
- **F2 · A file answer is a dead path.** The upload saves only the storage path in `file_url`
  (`app/api/register/route.ts` ~L594), and nothing signs a link for the bucket `tournament-registration-files`. The
  record and the export show the raw path. **Fix:** the record shows the file name as a link opened through a 1-hour
  signed URL made by a server route that checks the same access as the answers; the export writes "Attached" (never the
  path). This keeps the published Privacy Policy's "links that expire after one hour" promise.
- **F3 · Any file type.** The field has no `accept` and the server stores the browser's claimed type, up to 10 MB
  (~L46, ~L211). **Fix:** PDF, JPEG, PNG or HEIC, checked from the file's content on the server; keep 10 MB unless the
  proxy's per-request limit says otherwise; a refused file gets a field error that names the types. Serve with
  `Content-Disposition: attachment` and `nosniff`.

## Not in this fix
- F4 (answers reach every tournament member) is recorded for the tournament move; don't change access here.
- No migration is expected. If one becomes necessary, stop and say why.

## Done means
- Unit tests for each fix (archived-with-answers reads; the signed-link route refuses a member without access; a
  refused type). `npm run verify:changed`, `npm run typecheck`.
- `/review`, then `/docs` if the organizer's help mentions files or archiving, then a short QA walk (an Artifact).
- Branch `dev`, explicit paths, **no commit without the owner's yes**. Record the hash in the plan's ruling 15 line, the
  prompts index row and the Board Ready board line.
