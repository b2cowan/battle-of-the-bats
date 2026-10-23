# Coach names: the club decides who is listed on team pages. Build prompt

> **Written 2026-10-23.** **Paste this into a new chat on `dev`.** The drawings are ruled (every ask as recommended, plus one
> gap this prompt found, A7 below): https://claude.ai/artifact/ER9Grq3TkLbw7AYjzmhUYS (source
> `COACH_NAMES_CLUB_POLICY_DRAWINGS.html`). Plan: `COACH_NAMES_CLUB_POLICY_PLAN.md`. Product brief: `COACH_NAMES_CLUB_POLICY_PM_BRIEF.md`.
> Part of Club Tier; it rides the Club release and is not separately on sale.

## What this makes true

- The club's owner picks, once for every team, who appears under **Coaches** on a team's public page: **Coaches choose** (today),
  **Head coaches always**, **Head and assistant coaches always**, or **No coach names**.
- A coach's own "Show my name on the team's public page" switch is never overwritten by the club's choice. Where the club has
  decided for that coach's role, the switch is replaced by one sentence and plain text ("Listed by your club" / "Not listed by your
  club"). Going back to Coaches choose returns everyone to what they had set.
- A coach is told once, in the app, when a club choice starts listing them.
- Admins who are not the owner read the choice as plain text; they cannot change it.

## Ruled (owner, 2026-10-23: all six asks as recommended)

| Ask | Ruling |
|---|---|
| A1 | Its own new row on the club's **Public site** page, **Coaches on team pages**, between "Contacts and documents" and "Visibility". That page had five rows; this is the sixth. |
| A2 | **Owner only** to change. An admin sees the same row as plain facts and one sentence ("The owner chooses who is listed."), the way Visibility's non-owner view works. No greyed radio. |
| A3 | Under an "always" choice, everyone not covered **keeps their own switch** (a manager, treasurer or helper under both; an assistant coach under Head coaches always). |
| A4 | **Ask first, with a count, for the two "always" choices only.** "Coaches choose" and "No coach names" save at once with the "Saved" pill. While the window is open the list stays on the old choice; Not now, Escape and a tap outside leave it there. |
| A5 | **One in-app notice** to each coach a choice newly lists. No notice when names are hidden or control is given back. |
| A6 | Under No coach names the coach's row is a sentence plus "Not listed by your club", never removed, never a switch. |

## ⚠ Ask the owner A7 first (a gap the drawings did not cover)

**Where else is a coach's name public?** One more place: the family **tryout page** says "Questions about these tryouts? Email the
head coach", and prints the head coach's name only when that head coach's own switch is on (`getPublicTryoutContact`,
`lib/coach-tryout-contact.ts:65-75`). It is a public name, so a club that chose **No coach names** would still see it. Recommended:
**the club's choice governs that line too**, through the same rule as the Coaches shelf. Under No coach names it reads "the head coach"
with no name; under either "always" choice the head coach who set the address is named; under Coaches choose it is today's behavior.
Ask this as one short question with that proposal. Do not build the tryout line until it is answered; the rest does not wait on it.

## Before any code (the gate)

1. **Mockups are already drawn and ruled** (link above). Read them first. Draw anything that is genuinely new before building it:
   at most the notice's bell row if `/marketing` words it differently, and the tryout line's two name states if A7 is yes.
2. **Ask A7** (above).
3. **Present the product-manager UX summary** (AGENCY_RULES, blocking): what the owner, an admin, a head coach, an assistant, a
   manager and a family each see and do differently.
4. **Words go through `/marketing` before any copy ships.** The drawings' sentences are drafts, not final. Needed: the row's title,
   summary, lead, four choices and their sub-lines, hint, the admin sentence, both windows, the coach's five states, the notice, the
   help articles. Keep one spelling per word (listed / not listed throughout), ’ not ', and the product's clock rules.
5. **Schema through `/db`:** one column, `organizations.coach_names_policy` (text, NOT NULL, DEFAULT `'coaches_choose'`, CHECK in the
   four values). The next migration is **352** (351 is the latest in `supabase/migrations/`; re-check, other sessions share this
   tree). A text CHECK needs no function, so run `npm run check:manual-migrations` to see whether a `MANUAL_PROD_STEPS` entry is
   needed; do not assume. Then `DATA_DICTIONARY.md` (anchor `organizations.coach_names_policy`, style of the `birthday_cutoffs`
   entry), `npm run refresh:snapshots`, and apply to prod **before** the code ships.

## What to build

**1. The rule, in one place.** A pure function in `lib/` (own file, unit-tested) answering: given the club's policy, a coach's role
word and that coach's own switch, is this person **listed**, and does their **own switch apply**? Role word =
`staffKindLabel(resolveMembershipCapabilities(m), m.staffKind)` (`lib/coach-capabilities.ts:422`): `'head'`, `'assistant'`, or
manager / treasurer / helper. ⚠ Do not filter on `coach_role`: a manager or treasurer has `coach_role = 'assistant_coach'`.
⚠ `staffKindLabel` is documented as display only; this policy is display, so using it is right, but leave the comment alone and do
not use the new function to gate access to anything. A row with no stored kind falls back to its grant shape (that is existing
behavior; test it). Every consumer below calls this one function; no second copy of the table.

| Policy | Head coach | Assistant coach | Manager, treasurer, helper |
|---|---|---|---|
| coaches_choose | own switch | own switch | own switch |
| heads_always | listed | own switch | own switch |
| heads_and_assistants_always | listed | listed | own switch |
| none | not listed | not listed | not listed |

**2. The column and its plumbing.** Map `coachNamesPolicy` everywhere `birthdayCutoffs` is mapped: `lib/db.ts` (`mapOrg`),
`lib/server-organizations.ts` (row type and mapper), `lib/api-auth.ts` (row type and context mapping, with its fail-closed fallback
to `'coaches_choose'` if the migration is not applied yet) and `lib/types.ts` (`Organization`). The client gets it through the org
context with no extra mapping. Default everywhere is `'coaches_choose'`.

**3. The club's route.** A new route under `app/api/admin/org/`, modelled on `coach-settings/route.ts` and tightened to the owner
(`ctx.role === 'owner'`, as `birthday-cutoffs/route.ts` does), gated on `module_rep_teams` capability and entitlement. PATCH sets the
policy (validated against the four values). A GET (owner or admin) returns, for a candidate policy, the **counts** the window needs:
people who would be **newly listed** (heads, assistants, and how many teams), counting only active staff with a name on file on
teams that have a live season and are not already listed, plus how many switch-on coaches would **no longer be listed**. The window
sentences say what the real count is; no hard-coded numbers. Keep it out of `org-settings` (owner-only fields there are a
different mechanism) and out of `app/api/coaches` (the year guard scans that folder).

**4. The Coaches shelf.** `listPublicNameMemberships` keeps its exact `.eq('status','active').eq('show_name_public', true)` chain
(`club-stage4c2b-guard.test.ts:84` pins it) and serves Coaches choose. For the other policies add a sibling that reads active
memberships of the team and filters through the rule function; `none` returns an empty list without querying.
`getPublicTeamCoaches` takes the policy (the team page already has the org). Keep: name and role only, head coach first then by
name, no email or phone, a coach with no name on file left out (`publicPersonName`), listed only while the team has a live season
and is not archived (the existing guard at `app/[orgSlug]/teams/[teamSlug]/page.tsx:90`). The shelf's look does not change.

**5. The coach's row.** In the team GET (`app/api/coaches/[orgSlug]/teams/[teamId]/route.ts:153-155`) extend `publicPage` with the
club's policy, whether this coach is **listed by the club**, and whether their **own switch applies**, all computed server-side
from the rule function (the client never decides). In `components/coaches/CoachPublicPageDoor.tsx` and the `publicPage` type in
`settings/page.tsx:46` draw the five states exactly as ruled: the row keeps its label "Show my name on the team's public page" in
every state; where the switch applies it stays (with the club's sentence under it when the club has decided something); where it
does not, the description is the sentence and the control slot is plain text, with **no tag, pill or greyed switch**. A phone wraps
the full text. The PATCH for the switch stays as it is: the policy never writes the switch, a forced coach who somehow sends it just
sets their own saved choice, and the stored value is what returns when the club goes back to Coaches choose. Update
`club-stage4c2b-guard.test.ts:129-130` deliberately, because it pins the exact `showMyName: membership.showNamePublic` text.

**6. The owner's row on Public site.** `page.tsx` gets a sixth `BuilderRow` (`RowKey`, `summary`, words in
`lib/public-site-words.ts`). Shown only when the club has the rep-teams module (team pages are a Club feature); absent otherwise,
never locked. Owner: the four choices as **one framed list** with the product's radio, built with `SendRows` / `SendRow`
(`pick.radio`) from `components/admin/kit/club/SendParts.tsx`; do not copy the drawing's CSS, the drawing's own Design check says the
radio colours are for the build to confirm in the warm portal. Saves by itself through `SavePill`. For the two "always" choices a
`KitDialog kind="question"` (buttons only at the foot, cancel on the left, no close glyph, 26rem at most) holds the pick until
"List them"; controlled radio, so Not now / Escape / outside tap leave the old choice. Admin: the `.facts` read-only shape of
`VisibilityPanel.tsx:51-62` plus one sentence. Phone: same words, wrapping, every choice at least 44 px.

**7. The notice.** A new `'know'` kind (so Needs attention and its twelve-kind test are untouched), registered everywhere
`club_season_changed` is: `NotificationEventType` (`lib/types.ts`), `NOTIFICATION_EVENT_LABELS`, `NOTIFICATION_EVENT_DESCRIPTIONS`,
`PUSH_DEFAULT_ON_EVENTS`, `NOTIFICATION_CATEGORY`, `lib/notification-view.ts`, and the preferences list in
`AccountNotificationsClient.tsx` (two guard tests pin the registration). Model it on `tellClubTeamStaff`
(`lib/club-season-notify.ts`): best-effort in a try/catch, `notify({ userIds, excludeUserIds:[the owner], link, metadata })`. There
is **no org-wide "active coach user ids" helper**, so write one (active memberships on live-season, non-archived teams). Send **one
notice per person** (de-duplicate across teams) to exactly those who are listed under the **new** policy and were not under the
**old**; link to that coach's Team settings. Pure words in their own file like `club-season-notice.ts`.

**8. The tryout line (only after A7 is yes).** `getPublicTryoutContact` calls the same rule function for the setter (who must still
be a live head coach, as today). Update the exact-text pins at `club-stage4c2b.test.ts:139-140`, and re-check the allow-list at
`club-stage4c2b-guard.test.ts:41-51`. The tryout page copy and the help sentence at `lib/help-content/coaches.tsx:438` follow.

**9. Help, through `/docs`.** `lib/help-content/coaches.tsx` ~6011-6012 (the name-switch article and its "When names show" note),
~6052-6058 (the FAQ: `answerText` and the JSX are separate copies, change both, and its `keywords`), ~438, ~5919-5920, ~5994-5995.
`lib/help-content/org.tsx` ~1141-1142 ("five rows" becomes six) and a new article for the setting; check ~1049-1062 and ~1152,
~1189-1192. Run `npm run check:help-shots` if a captured screen changes.

## Tests (write them with the change)

- The rule function: every policy × every role word × switch on and off, plus the no-stored-kind fallback.
- The shelf, per policy: who is listed, order, a coach with no name on file, a manager under each "always" choice, a team with no
  live season, an archived team.
- The club route: owner may change it; admin cannot (403); a club without the rep-teams module cannot; bad values rejected; counts
  count only newly listed people. Guard that the setting is not in `org-settings` (like `club-stage4c2-settings.test.ts:196-201`).
- The coach GET: the three new fields per policy and role; the PATCH leaves the stored switch untouched under every policy.
- The notice: registered and categorised, sent once per person, not sent for hiding names or for going back to Coaches choose.
- Update, do not delete, the exact-text pins named above; say in the commit why each moved.

## Fixtures and demos

Use **UAT Lakeshore Lynx**, the rep-only club (`buildRepOnlyClub` in `scripts/seed-club-fixture.mjs`; Jordan Reyes head, switch on;
Sam Okafor assistant, off; Pat Lindqvist head, off). The owner flips the policy in the walk, so no seed change is needed for the
four choices. A team manager would make the "manager keeps their switch" step real: propose the smallest addition, get a yes, then
seed, and never seed mid-sweep. The demos default to Coaches choose and need no change; run `npm run check:demos`.

## Definition of done

`npm run verify:changed`, then `npm run typecheck` (shared modules and org context change), `npm test`, `npm run check:dictionary`,
`npm run check:snapshots`, `npm run check:manual-migrations`, `npm run check:spelling`. Run `npm test` first and report any failure
that is not this change's instead of fixing it here. A walk as its own checkable Artifact, **each step naming the role it is signed in
as** (OWNER sets the policy; ADMIN reads it; JORDAN the head coach; SAM the assistant; a manager; and a family in a private window on
the team page and the tryout page), with a phone pass. Records: the plan's ladder, the TODO line, a new Owner QA Ledger § (next free,
never sort the numbers), memory `project_club_tier_readiness`. Offer `/review`, `/simplify` if a new abstraction landed, `/docs`.

## Do not

- No per-team exception and no per-coach override by the club; the choice is one for the whole club.
- No email, phone or player on any public page. No name for a coach with none on file.
- Never write a coach's own switch from the club's choice, and never delete it.
- No notice when names are hidden. No new Needs attention kind.
- No change to who may set **Schedule visibility** (separate; if you find a gap there, report it, do not fix it here).
- No copy without `/marketing`. No new CSS custom properties without flagging a design-system extension.
- No writes to prod. No change to shared agent automation, hooks or the database checks.

## Git

One shared branch, `dev`. Stage explicit paths only. ⚠ `app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx` already holds an
uncommitted reword of the Schedule visibility help text (made in the session that drew this, a separate change; that file may also hold other sessions' edits); stage your hunks only. Other
sessions have edits in TODO and the plan files. Check `git show --stat HEAD` after each commit. No push without the owner's word.
