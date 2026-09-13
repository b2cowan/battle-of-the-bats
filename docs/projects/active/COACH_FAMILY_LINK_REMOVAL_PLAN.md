# Coach Portal — Family link removal (plan of record)

**Owner ruling 2026-09-12:** "remove any family link functionality." Scope ruled the same day:
**the link and the follower tier go; Schedule visibility survives and moves to Team settings;
the guardian tier and its portal are untouched.** Project hub (mockup · brief · this plan ·
decisions): `docs/projects/active/COACH_FAMILY_LINK_REMOVAL_HUB.html`
(https://claude.ai/code/artifact/46987cce-34c3-4643-b0e8-b09d6e5c0f1f).

**Status:** built on dev 2026-09-12 (this session); **mig 290 applied to dev 2026-09-12, prod
PENDING and ORDER-CRITICAL** (see §5). Owner QA walk owed.

## 1. What was true, and why "make dev like prod" had no code meaning

Chunk D Slice 1 (2026-08) shipped a team-level family link: a coach minted one from the
"Team family access" card at the bottom of Roster, relatives opened `/family/join/<token>`, signed
in, asked to follow, and the coach approved from the same card. Followers saw the schedule and
results and nothing player-level; the guardian tier (a parent tied to one child) shipped behind
`GUARDIAN_TIER_ENABLED`, off pending counsel.

Dev and prod ran identical code for all of it — the card, its routes and the gate were
byte-identical on `dev` and `origin/master` — and the panel hides itself only when a team is not
entitled to the premium portal. The one real team on production (a standalone team workspace with
a live entitlement) therefore saw the card too. There was nothing to make dev "like"; the removal
was the whole job. Verified against both databases before building: **zero teams had ever minted
a link, and zero follower rows existed** (dev 13 family links, prod 12, every one a verified
guardian — the coach demo's seeded families).

## 2. Scope (built)

| Area | Change |
|---|---|
| Roster page | The Team family access section is gone — not folded, not gated. The help-drawer pointer to the family guide goes with it. |
| Team settings → Sharing | Gains **Schedule visibility** (Staff only / Families / Public link), the same three words and the portal's own segmented control. Section now shows for any premium team (it used to appear only for a Club-plan team with book sharing on); each row hides on its own rule — absent, never locked. Summary line names the visibility first. |
| Team API | GET serves `scheduleVisibility: { value, canEdit } \| null` (null = not entitled). PATCH accepts `scheduleVisibility`, gated on `canManageSchedule` (the grant that shares a game), premium gate re-checked on the write. |
| Coach family-access routes | Deleted (panel payload, mint/reset, approve/decline/revoke). |
| Family join page + API | Deleted. The team family link's landing page was the only way to ask to follow — and the only way a parent could ask to be a guardian by naming a child. |
| `lib/family-access.ts` | `FamilyRole` is `'guardian'` only; link mint/resolve, follower request, `approveFamilyLink`, `listTeamFamilyLinks`, `getOwnLinkForUserTeam`, `getFamilyAdoptionCounts` and `FOLLOWER_SAFETY_CEILING` removed; decline/revoke lose their `role` parameter; the club rollup is `{ connected, awaiting }`. |
| `lib/family-guardian.ts` | `requestGuardianLink` (ask-via-link) removed; `requested_player_name` gone from the DTO; `getGuardiansByPlayer` returns the map alone (no `unattachedRequests` — nothing can produce a player-less request). The guardians card drops its "says they're a parent of …" line and the pending-request list; a mismatched claim still queues under its player. |
| Club admin rep-teams list | The per-team family count is `connected` (verified guardians) + `awaiting`; the follower split is gone. Rendering unchanged. |
| Staff sheet / panel | The "also connected as a family member" label stays (a verified guardian is still a second connection); the removal warning now points at **Guardians on the player's page**, not "Family access on your Roster page". |
| Help | Coach guide `premium-family-access` rewritten as **Families and your season recap (Premium)** — recap preview, where Schedule visibility lives, and a "where did the card go" FAQ; link/approve/follower subtopics and FAQs removed; Team settings guide gains Schedule visibility under Sharing; the staff-removal FAQ, the share-game section, the club-admin "families connected" article and both help hubs re-pointed. Section id kept so every existing link lands. |
| Stylesheets | `FamilyAccessPanel.module.css` → `FamilyCard.module.css` (shared by the Guardians card and the Share-game row); the panel-only segmented control removed. The join page's orphaned rules removed from `family.module.css` (the CSS-selector gate caught them). |
| Tests | Three UAT specs rewritten with a **verified guardian** as the connected persona and a signed-in **outsider** as the unconnected one; join/reset/follower probes retired; new probes for the team-settings write (200 / 400 / refused for a family member) and for the database refusing a follower row and a player-less guardian. 38/38 pass on dev. |
| Database (mig 290) | See §5. |

**Out of scope, deliberately:** the guardian tier and its portal, the family season recap, the
keepsake card, calendar feeds (team-wide and per-family), sharing a single game, the club admin's
connected-families counts, and both demo sandboxes (they seed guardians, never followers, and
narrate neither — `check:demos` green after the change). Undoing the August premium-packaging
decision is not implied: the family layer stays premium.

## 3. Consequences worth knowing

- **The guardian tier now has one door.** A parent could ask through the team link by naming
  their child (the coach attached the roster row at approval). That path was the link; it is
  gone. When the tier opens, a parent enters only through a coach-sent invite to the address
  already on the roster row. A claim from a different address still lands in the coach's queue,
  so approval still exists. The help guide says so.
- **`family_links.player_id` is NOT NULL again (by CHECK).** Mig 216 relaxed it for the
  ask-via-link request; mig 290 restores mig 215's strict form. Nothing that can still be written
  violates it (a mismatched claim inherits the invite's player).
- **Schedule visibility keeps all three meanings.** Staff only still refuses a shared game page;
  Families lets connected guardians read the schedule (none can exist while the tier is off, so
  Staff only and Families look alike to a coach today); Public link still puts the schedule on
  the public team page. The control was moved intact rather than collapsed to a switch, so a
  team on `staff` is never silently widened to `families`.

## 4. Approach and the alternative it beat

Delete rather than hide. A hidden panel with live endpoints behind it is the "write controls the
server refuses" shape the coaches-portal rules forbid. The migration went in the same unit of
work as the code because a column nothing reads and a role nothing writes are drift the gates
cannot see (the mig-264 lesson, and CLAUDE.md's standing rule). Leaving them "in case" was
proposed to the owner and rejected with the go-ahead.

## 5. Rollout — mig 290 is prod-pending and order-critical

`supabase/migrations/290_family_link_and_follower_tier_removed.sql`: a data-only DELETE of
follower rows (verified zero on both databases), the role CHECK narrowed to `guardian`, the
role/player CHECK restored to strict, `requested_player_name` dropped, and the three
`rep_teams.family_link_*` columns dropped (their partial index and FK go with them).

- **Applied to dev 2026-09-12** and verified by query: both CHECKs read as written, zero
  `family_link_%` columns on `rep_teams`, `requested_player_name` gone, 13 guardian links intact.
- **Prod: PENDING**, registered in `MANUAL_PROD_STEPS.json`. Every piece is invisible to
  `check:migrations` (a DELETE, DROP COLUMNs, rewritten CHECKs). It IS visible to the
  schema-parity gate on the master build, which is what makes it **order-critical: apply to prod
  BEFORE or WITH the promote, never after** — the master build stays red until it is on both
  databases (the mig-286 lesson). Verify on prod by query, never by this note.
- Snapshots refreshed 2026-09-12; `DRIFT_dev_vs_prod` names the four columns / one constraint /
  one index that prod still carries until then. The dictionary keeps the three `rep_teams`
  anchors on the "dropped" entries on purpose (the coverage gate unions dev + prod).
- Release notes: `/release` drafts the entry at promote time — one line: the card is gone, the
  setting moved to Team settings → Sharing.
- Dev server restart at hand-off (files deleted, shared modules changed).

## 5b. `/review` 2026-09-12 — five lenses, all Critical/High findings were COPY the diff had not reached

Security, data/migration, correctness, regression and product-truth finders over the scoped diff; the
rendered check on the six touched screens. Confirmed and fixed in the same session:

- **Public team page** told families to "ask the coach for the team's family link" (High) — footnote removed.
- **Coach walkthrough / pitch deck** slides #05 and #07 narrated "share one link and approve who joins"
  and "families who follow the team" (High) — rewritten to the public page + shared game page; #07 no
  longer promises a final-score message (that goes to connected families, and none can exist today).
- **`PLAN_PRICING_FACTS.md`** listed the link, the approval queue and the follower tier as Premium
  inclusions (High, binding same-unit-of-work rule) — narrowed; no packaging consequence.
- **Help "What Premium adds" bullet** (3,400 lines from the rewritten section) still described the
  link (High) — rewritten. Club-admin "Waiting" bullet re-framed as the rare mismatched-claim case.
- Rendered check: the new Schedule visibility control spilled 14px at 361 and sat under the tap floor
  at 768 — fixed with a row-wide modifier at phone width and a tap floor in the tablet band.
- Settings control now re-reads the server's answer on success (like the club-book switch); a dead
  `already_connected` error code and two present-tense "follower" dictionary sentences removed.

Adjudicated and left: the staff-removal warning points at the Guardians card, which does not render
while the guardian switch is off — but the warning can only fire for a verified guardian, and none can
exist for a real coach while the switch is off (demo seed emails do not overlap staff), so it reads
correctly on the only day it can appear. Two fail-closed `role === 'guardian'` checks are now
tautological and stay. Surfaced to the owner: who may change visibility moved from guardian-contact
access (the old card) to schedule management; and "Families" has no live audience until the guardian
switch opens.

## 6. Owner QA walk (owed)

Sign in as the UAT coach on `uat-test-org / UAT Test Team`.

**Part A — Roster.** Open Roster (list view), scroll to the bottom. Below "Drag to set the order
players appear in" there is nothing: no Team family access section, folded or otherwise. The
help "?" on Roster lists the roster recipes and no family guide.

**Part B — Team settings → Sharing.** Open Team settings. A **Sharing** section is present
(collapsed) with a summary reading `Schedule: Families`. Open it: a **Schedule visibility** row
with a three-way control — Staff only / Families / Public link — and a one-sentence explanation
that changes with the selection. Pick **Public link**; the summary line updates. Open the team's
public page in another tab: the schedule is there. Pick **Staff only**; the public page loses it,
and on the Schedule, sharing a game refuses with "Schedule visibility is set to Staff only…". Set
it back to **Families**.

**Part C — the club-book row is unaffected.** On a Club-plan team with book sharing on, the
Sharing section shows both rows; on the UAT team (no club book) only the visibility row appears.

**Part D — assistant without schedule management.** Signed in as an assistant who does not manage
the schedule (or a helper): the Sharing section shows the current visibility as text with "only
coaches who manage the schedule can change it", no control.

**Part E — help.** Coaches help → "Families and your season recap (Premium)" reads as rewritten;
"Team settings (Premium)" → "Sharing: who can see your schedule, and your book" exists; searching
"family link" surfaces the "Where did the Team family access card and the family link go?" FAQ.

**Part F — nothing else moved.** A player's page still shows Family season recap → Preview;
sharing a single game from the Schedule still works at Families; the club admin's Rep Teams list
still shows a Families count on the coach demo's 13U team.
