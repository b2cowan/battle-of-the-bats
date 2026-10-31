# Stage 6 cleanup and adversarial review · 2026-10-31

Manual review required by Part 4 of `PUBLIC_TOURNAMENT_STAGE6_BUILD_PROMPT.md`. Scope: Stage 6's own working-tree
delta against `2fe15478ca86ae66e9d43d17354a46061cbf22a8`, including its new components, styles, fixture scripts and
tests. Unrelated shared-working-copy changes were excluded. This is the manual equivalent requested by the prompt;
no Claude review command or separate reviewer is claimed. Risk: shared navigation/data visibility, with no schema,
authorization, billing or registration-write changes.

## Findings corrected

| Finding | Code evidence and correction | Verification |
|---|---|---|
| The desktop rail could disagree before hydration | It built frame facts from context populated by a client effect; the band/footer already had server facts. The live layout now passes hidden pages, bracket presence and frame facts directly to the rail. Legacy mounts retain their old context fallback. | Real React SSR test renders top tabs, rail and footer with an empty context and compares exact tab keys. |
| A crown stamp could outlive publication | The stamp is one-way. Both layouts now call `tournamentFrameTabContent`, requiring a nonempty, fully published current division list before showing Champions. | Pure tests cover a stamped but withheld event, missing publication, no divisions, and normal published results. Manual fixture modes preserve the stamp while withholding/publishing the reserved one-champion clone. |
| A withheld division with zero games escaped the page's game-count comparison | Filtering games and comparing lengths cannot detect an unpublished division that has no rows. Frame-on live/preview Champions now also require current division publication, matching the inherited image's safety gate. The legacy branch remains intact. | Both real routes are rendered with one decided final plus an empty unpublished division; neither exposes a champion. |
| Hidden Register should win over a stale input fact | The canonical tab helper now checks the organizer's hidden-page list as well as the live CTA fact. | Unit test explicitly supplies conflicting inputs and verifies no Register entry. |

## Cleanup

- Removed the three now-redundant Stage 6 context fields and sync props. `OrgNavContext.tsx` and
  `TournamentNavSync.tsx` return to their HEAD contents; other existing context behaviour stays intact.
- Centralized the four tab facts in one pure helper used by live and preview layouts. No extra database read was
  added. News/Rules still use the existing site-published readers; the Part 1 description of an "existence check"
  describes the question, not a new limited-row query.
- Updated the Stage 1 frame-on rail assertion to pin the explicit props. Its switch-off assertions remain intact.
- Added safe, read-back fixture modes for content visibility, registration's date boundary, and re-withholding a
  stamped champion. They touch only reserved marked development clones, never a source tournament or demo.
- Built the 66-step owner walk in the established Stage 5 shell and tested its actual summary logic. Its private
  published copy has exactly the repository HTML's bytes. The Sites source commit is artifact packaging, separate
  from the product repository's commit decision.

## Review lenses

| Lens | Conclusion |
|---|---|
| All four navigation surfaces | Top tabs/rail/footer share the same list and explicit server facts. Navbar's legacy tournament branch is suppressed at first paint by the existing frame CSS and then returns early after context sync; it is not a fourth visible preview menu. |
| Switch off | News and Register routes/bodies were not rewritten. The legacy Rules JSX and Champions recap remain behind their original fallbacks. The optional tab argument is omitted. The promotional repair and inherited image gate are preview-only. |
| D1 | Games are filtered before champion derivation; current publication also gates page, preview, image and stamped tab. An empty withheld division cannot bypass the reveal gate. |
| Register body | Source hash remains `f72308ffadda444cc7e09a932ecb76641e48e211`, unchanged through Parts 3–4. Existing unrelated edits in that file are outside this stage. |
| Direct links | Empty News/Rules, closed Register and pre-champion pages retain their state bodies. The new admin Champions section has no legacy equivalent and remains preview-switch gated as designed. |
| Privacy | Public rule titles/items and resource labels/URLs alone cross the interactive-list boundary. Division filtering receives only IDs/names. Champions passes formatted card data; no raw notes, emails or payment status. Public contact resolution remains the existing gated helper. |
| Organizer previews | Existing scoped authorization and billing checks remain in `getTournamentPreviewContext`. Rules copy/download/email actions and Champions result/share actions are absent. Register retains its existing submission-disabled preview. No role or membership was granted for testing. |

## Verification and limits

315 focused tests pass, including the real live/preview route renders, share-image gates, SSR navigation comparison,
and the actual HTML walk summary. Full TypeScript and focused Stage 6 lint pass. Final static/layout/smoke results
are recorded in the build prompt's Part 4 execution and owner ledger §435.

The owner remains responsible for visual/browser acceptance. Register's two existing 15 px inline help links are
retained by its unchanged-body ruling; desktop closed-state controls retain their existing sizes under the pointer
width rule. The admin-preview walk requires an accepted membership and a tournament in the owner's permitted scope;
unavailable populated scenarios must be recorded as incomplete. Share apps can cache images. No full-product sweep,
production read/write, help rewrite or demo rewrite belongs to this stage. The database-level public-game read remains
the separate follow-up already recorded by the project.
