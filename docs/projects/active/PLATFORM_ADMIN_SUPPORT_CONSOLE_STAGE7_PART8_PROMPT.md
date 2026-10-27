# Support console · Stage 7 · frame J, then Part 8 — the public form (prompt 3 of 3)

> Paste into a new chat on `dev` whenever the owner chooses (it does not wait for the walks; it does wait for the finish
> pass, so it builds on reviewed code). Written 2026-10-27 by the Stage 7 build session. **A release item with customer
> copy.** Shared working copy: explicit pathspecs, branch check, `git show --stat HEAD`. Commit nothing without the
> owner's OK. This prompt is a lead, not evidence.

## Read first

The build prompt `…_STAGE7_BUILD_PROMPT.md` §7 Part 8, §8 guards 5–6, §11; the plan's "Owner rulings 2026-10-27 (Stage
7 drawings)" and the **build gate answers** under it (frame J to be drawn and OK'd before Part 8; the repo's existing
public-form throttle goes on the early-access route; the captcha stays later; `/marketing`'s words for the question);
the plan's "Stage 7 build (2026-10-27)". The drawings: https://claude.ai/artifact/QTrwrgyGqgBZugpGfvpJHM, source
`PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE7_DRAWINGS.html` (drawing C's last frame shows C and D as OPTIONS only).

## Step 1 · frame J (blocking; owner OK before any Part 8 code)

Draw frame J on the drawings page in the drawn rows' shape (house mockup rules: whole-screen before/after, true size,
`/design` before hand-off): **(a)** the public early-access form and the coach start form with the optional "How did
you hear about us?" question (no star; first option "Choose one"), choices exactly as `/marketing` wrote them (the plan's
"§6-6 `/marketing` words" bullet: eight choices, each mapping to one staff source); **(b)** the lead page's Source row
with "From the form: {the visitor's words}" under it and "Link: {label}"; **(c)** Numbers' "By link tag" table and the
Filter's Link tag; **(d)** the timeline's "Filled the form again, on the {page} page" now dated per refill. Republish the
drawings Artifact (read it first with the Artifact tool; it is the owner's), ask the owner, record his answer as given.

## Step 2 · Part 8 (after the OK)

- **The overwrite fix (Q10, threat 4):** a second form from a known address never turns a "no" into a "yes" and never
  overwrites a lead staff have worked (any step past New, a note, a source, a link); its words land on the timeline as
  "filled the form again". A lead still at New with no staff work takes the visitor's new words, never their "yes" over a
  "no". The response is the same for a known and an unknown address. ⚠ **Two writers:** `app/api/early-access/route.ts`
  AND `lib/basic-coach-interest.ts` (a coach team's interest button, `app/api/coaches/teams/[basicTeamId]/interest`) —
  the rule covers both, or the second is a back door.
- **A migration** (next free number at the time; others number in parallel — check disk and MANUAL_PROD_STEPS): a store
  for each refill (date, page, the visitor's words) so the timeline can date every one (today only the latest is kept);
  whatever C and D need beyond mig 398's `heard_from` / `ref_tag` columns (format-checked; the LISTS live in code). New
  tables grant `service_role` explicitly (Supabase stops auto-granting 2026-10-30; `migration-table-grants-guard`).
  Dictionary + snapshots in the same unit; count dev rows each data move touches (read-only).
- **C:** the optional question on both forms; the answer kept as given; it fills the lead's Source only when staff have
  set none, never overwrites one; the lead page shows "From the form: …".
- **D:** a `ref` tag read from the address the visitor arrived on, kept in that tab's session storage (no cookie, no new
  consent), sent with the form; only tags on a short list in code are stored (a commit adds one, with its label);
  anything else dropped, never shown raw, cut to a fixed length (threat 16); a known address keeps its first tag. Shown
  as "Link: {label}", filterable, its own table in Numbers (the screens already render `byTag` and the Link tag filter
  when tags exist — check, then wire the labels).
- **The throttle:** `throttlePublicForm(req)` (`lib/public-form-throttle.ts`; see the house-league register route for
  the call) on the early-access route. The form answers a database error with a fixed sentence, never Supabase's words
  (today it returns `error.message` at two places).
- **Guards:** build prompt §8 guard 5 (no → yes never; a worked lead keeps its fields and gains a timeline entry; an
  unknown tag dropped; a long tag cut; the form's answer never overwrites a staff source) and guard 6 for the new fields;
  the public POST computes no match and answers known and unknown addresses alike (already guarded — keep it passing);
  move threats 4, 10 (throttle part) and 16 from OWED to guarded in `support-console-stage7-guard.test.ts`'s THREATS.

## Hand-off

Its own walk (the form's question, a tagged link, a resubmission on a worked lead), a ledger section, a `/review` with
the privacy lens on the public route, `/docs` (the public form's help if any; the Leads article's source paragraph),
the prod steps named not run (the new migration joins 398 at the release; the public form is a release item with its
customer copy). Records: the plan, TODO, PM brief, auto-memory.

## Do not

Submit the public form from a probe; store a referrer, IP, device or cookie; compute a match in the public route; add a
captcha (a later pass); fix the `/for-coaches` interest-form 400 (a TODO finding, its own work); touch production.
