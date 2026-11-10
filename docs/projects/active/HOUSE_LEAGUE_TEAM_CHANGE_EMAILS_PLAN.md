# House League: team-change emails after publishing (plan)

> **Drawn and ruled 2026-11-10.** Raised by the owner during the Family App walk (the three-sibling step): after a division is
> published, every move or late placement opens its own window and sends its own email, so three siblings placed one by one
> mean three emails and a child dragged between teams means more.
> Drawings (HTML page artifact, `/design` pass applied, the confirmation pill redrawn from the shipped notice pill after the
> owner's catch): https://claude.ai/artifact/DSwtAPGb9fJsoEZTTmAD5h, source `HOUSE_LEAGUE_TELL_FAMILIES_DRAWINGS.html`.
> Build prompt: `HOUSE_LEAGUE_TEAM_CHANGE_EMAILS_BUILD_PROMPT.md`. PM brief: `HOUSE_LEAGUE_TEAM_CHANGE_EMAILS_PM_BRIEF.md`.
> Size **M**. One migration (next free number: 459 on 2026-11-10; re-check).

## Rulings (owner, 2026-11-10)

The owner agreed the approach in conversation and then answered the drawings' six asks with "looks good, go ahead and write the
build prompt", which takes each as recommended.

- **TC·1 Moves save at once and email nobody.** After publishing, a drag or a Move to... works as it does before publishing:
  instant and silent. The held "Move and email" and "Place and email" windows go. **This supersedes 9c·12** ("Moving a child
  after publishing asks first, then emails the family the new team"). Both coaches' pages still change at once.
- **TC·2 One banner holds the families not yet told.** It sits under the published notice, stays until acted on (no timer, no
  auto-send, no prompt on leaving), and only people who can run the division see its buttons. The division picker carries the
  amber count it already supports.
- **TC·3 Review and email is one window, one email per family.** It lists each family with what changed for each child
  (new team, or moved from the team they were last told). A family whose net change is nothing (moved and moved back) is not a
  row; it is one quiet line saying why. "See an example email" is a level inside it.
- **TC·4 Choosing not to email is explicit and on the record.** The banner's **Don't email** asks once and clears; inside the
  window each family has **Don't email this family**. Either is saved in the season's Email families history, and Send again on
  a registration still emails later. **After a skip each child counts as told the team they are on now**, so a later move says
  "moved from Cardinals", which is true. (The owner raised the in-front-of-the-parents case.)
- **TC·5 The email names only the children who changed**, new or moved, one email per household. Taking a child off a team still
  emails nobody.
- **TC·6 An untold child wears a small amber "Not told" chip** on their row (a chip with words, not a dot: the design log says a
  plain dot carries no information and removed one for that reason). Never on team cards.
- **TC·7 Phone:** the banner's buttons go under its words at 44px; the review window is a form, so it fills the phone with a
  back arrow and keeps its foot on one row.
- **TC·8 The confirmation after sending or skipping is the screen's own white notice pill** (green tick, bottom right), never a
  second callout.

## What the code does today (read 2026-11-10; the build re-verifies)

- One function moves and places a player after publish (`league_team_place`, mig 377). It refuses with `published` unless
  `confirmed`, then writes one `league_placement_emails` row per move (`placed` if the child had no team, else `moved`, one child,
  `from_team_id`, first parent's email only) and the route sends it in the same request.
- Publish writes one `placed` row per family (grouped by the first parent's email) plus a `teams_published` notice.
- **Nothing records "the team the family was last told".** `previous_team_id` is overwritten by every move and cleared at
  Publish. The change needs a small new fact per child: see the build prompt, Part 2.
- `unsentPlacementEmails` and the "Send the {n} again" banner count every `failed`, `pending` or `sending` row, so silent moves
  must NOT be stored as pending email rows. The untold list is derived from the children, not queued.

## Not in this plan

- The registrations screen still refuses a move on a published division ("Move players on Teams & draft, where the family is
  told."); the build only rewords the line.
- Siblings registered under different first-parent emails still get separate emails (Publish groups the same way). A known
  limit, not new.
- Practice-time and schedule notices are untouched.

## Status log

- 2026-11-10: drawn, `/design` pass applied, ruled TC·1 to TC·8, plan + PM brief + build prompt written. Nothing built.
