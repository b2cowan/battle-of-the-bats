# Signed-in family accounts · Stage 4a, The invitation at team placement: build (prompt)

> **Written 2026-11-08** (the drawing session, after the owner ruled). Plan of record: `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md`, Stage 4
> (**RULED 2026-11-08, all 15 asks A**; the plan's "Ruled" list wins where this prompt differs). Drawing (build to it):
> https://claude.ai/artifact/M87dgZ1W4gEWxXvchoZA3M · source `SIGNED_IN_FAMILY_STAGE4_DRAWINGS.html`. Consent and privacy words:
> `docs/agents/legal/drafts/GUARDIAN_CONSENT_STAGE4.md` v0.1 (ask 13: the words the build ships with), including its **six build
> conditions**, which are binding here too. PM brief: `SIGNED_IN_FAMILY_ACCOUNTS_PM_BRIEF.md` (update its Stage 4 line at closeout).
> **Paste this into a new chat on `dev`:** `execute @docs/projects/active/SIGNED_IN_FAMILY_STAGE4_BUILD_PROMPT.md`
>
> **This is Stage 4a only** (ask 2). In / Out / Maybe and the coach's headcount are **4b**: not built here (Part 9 rewrites the
> availability plan so 4b can be drawn). **No chat** (ask 1): `CHAT_PAUSED` stays `true`, no room, no Chat door.

## Binding, do not reopen (the owner's 15 rulings, compressed; full text in the plan)

1. **No chat** in Stage 4. Rep coaches' updates keep their read-only "From the coach" card.
2. **4a only** here: invitation, team page, sign-up inside the app, calendar, club status.
3. **The connection is to the child, on every team in this club** (house league and rep). One acceptance connects the parent to
   **every child on their sign-ups in the club**, now and as each is placed. The accept page **names each child**.
4. **Rep:** the coach's **Send invitation** button on the player's Guardians section **emails** the invitation. **Nothing happens by
   itself at roster add.**
5. **Different email signed in → refuse** (invited address partly hidden, Sign out). **The coach's approval queue for mismatched
   claims goes.**
6. **Calendar: one address per parent**, every child's team, with **Copy** and **Stop this calendar**. Events titled by team, never
   by child.
7. **Neither parent removes the other.** Both see who's connected; each can **leave**; **the club removes**.
8. **A joined second parent's Stop** keeps its line; stopping also ends **only their second-parent connection**, and the confirm page
   says so.
9. **30 days.** "Email me a new invitation" (parent) and **Send again** (club) **re-send the placement email** with a fresh
   invitation. Never a separate "create an account" email.
10. **Club:** a status per address on the **registration record window**, with **Send again** and **Remove a parent**. **Coach:
    nothing new** in 4a (house league).
11. **"Your family" row in the shared account menu**, only for an account with a connected child.
12. **No age question.** Work the band out from the date of birth and the club's province; **no invitation panel for a player 18 or
    older**; the most protective path when either is missing; never show the age.
13. **The /legal draft words**, shipped **switched off**.
14. **The guardian box stays strict** ("I'm {child}'s parent or legal guardian"). A non-guardian can't join; they still get the emails
    and can pay from the link.
15. **Trust the invitation:** a new account made from a valid invitation, with the typed email matching, is created **already
    confirmed** (no confirm email), as a password reset would.

**Standing rules this stage must not break:**
- **The guardian tier stays OFF** (`GUARDIAN_TIER_ENABLED`, `lib/family-guardian.ts:41` [V], off unless the literal `'true'`). Never
  set it in Amplify or any shared environment. **While it is off, nothing changes for anyone:** the placement email has no panel, the
  record window shows no status, the coach card reads as today, the account menu has no row, every new route answers 404. Build that
  as one check, not scattered `if`s. For the owner's walk the session **asks first**, then the owner sets it in his own `.env.local`.
- **No new no-login family door.** The invitation is a one-use hashed token (the `generateNoLoginToken`/`hashNoLoginToken` pattern
  already used by `inviteGuardian`, `lib/family-guardian.ts:340-354` [V]) that **only opens the accept page**; it never signs anyone
  in and never shows the team. The emailed "Your sign-up" link stays exactly as Stage 1 built it; it never becomes an account.
- **No address in any link** (Stage 2 ruling 2). The accept page asks for the email first.
- **The stop IS the removal** (Stage 3b). `second_parent_stops` may be read only where the 3b guard allows
  (`tests/unit/league-second-parent.test.ts:205-210` [H]). **No send path gets a suppression check.** Instead: the stop function
  (`second_parent_stop`, mig 448) is extended so the stop also **cancels open invitations to that address in that club and ends that
  address's second-parent connections** in the same transaction (ruling 8; /legal flag d: never a connection the address holds as the
  **first** parent on its own child's sign-up). An address **typed** into a new invitation path (the rep coach's box) is refused with
  `stoppedSecondParentRefusal` (`lib/league-second-parent-stop.ts:25-32` [H]) and the `SECOND_PARENT_WORDS.stoppedAddress` words.
- **An invitation goes only to an address on that child's sign-up** (house league: `guardian_email` or `guardian_email_2` of the
  child's placed registration), or the address the rep coach typed for that player. Never to an address on a sign-up it is not on.
- **A parent who left, or whom the club removed, is never invited again automatically.** Only the club's Send again invites them back.
- **One spelling:** "9:00 a.m." via `formatTime()`; `npm run check:spelling` is part of `verify:changed`.
- **Coach portal and club admin are touched only where the rulings say:** the Guardians section (rep), the account menu row, the
  registration record window, and the words-only change to the join window (below). Nothing else.

**Helpers' leads are leads.** **[V]** = opened by the author 2026-11-08; **[H]** = a helper's citation, re-verify before building on it.
Explicit pathspecs only; commit only your own hunks; `git diff --cached --name-only` before every commit; **commit only when the owner
says.** `TODO.md`, `OWNER_QA_LEDGER.md`, `DATA_DICTIONARY.md`, `MANUAL_PROD_STEPS` and the help files are shared with other sessions.

**Gate before any code:** present the Product Manager UX plan in plain language (what a first parent, a second parent, a rep parent,
a registrar and a rep coach see and do differently; benefits; who sees what). The PM brief is the base; say it in the conversation.
`/accounting` is **not** triggered (nothing charged changes). `/legal` and `/marketing` run in the closeout (Part 9).

**Recommended model: Opus 5.5, four sessions.** Session 1 = Parts 1–3 (the database, who a connection reaches, the invitation rules).
Session 2 = Parts 4–5 (the accept page, the emails). Session 3 = Parts 6–8 (the family pages, the calendar, the club and coach screens).
Session 4 = Part 9 (closeout and walk). Update the Progress block after each Part. Stop at the end of a session; recommend `/clear`.

## ⚠ One owner call is still open: answer it before Part 5

**O1 (CASL memo flag a). A club with no contact email.** The invitation, the accept page's failure screen and the second parent's copy
all say "tell {club} at {contact}". The contact is `org_public_site_content.contact_email` (via `clubPublicContact`,
`lib/club-email-context.ts:111` [H]); `organizations` has no contact column [H]. A club with no public-site contact has nobody to
reach. /legal's two options: **(A) Publish (and the rep Send invitation) refuse until the club has a contact email**, saying where to
set it; or **(B) the line names the registrar's own address** (whoever pressed Publish). Ask the owner at the start of Session 2 if
nobody has ruled it by then; record the answer here and in the plan. Do not build Part 5's fine print until it is answered.

**RULED 2026-11-08 (owner, Session 1): O1 = A.** Publish and the rep Send invitation refuse until the club has a contact email, saying
where to set it. **Only while the guardian tier is on** (tier off = nothing changes, the standing rule). Build it in Part 5.

**O2 RULED 2026-11-08 (owner, Session 1, raised by the build): a stop refuses second-parent invitations only.** The prompt's Part 1.7
said the database refuses *any* new invitation to an address in `second_parent_stops`. The stop page promises only that the club stops
the second-parent copies ("has been sending sign-up emails to {email}… will stop sending them"); a stopped address can still be the
**first** parent on its own child's sign-up. So the trigger refuses a `family_invitations` row for a stopped address **unless that address
is the first parent (`guardian_email`) on a sign-up of that org**, and an acceptance connects such an address only to children it is the
first parent of (the stop already cleared every `guardian_email_2` copy). `guardian_email_2` is refused for a stopped address as written.

## What the code says today (read before Part 1)

- `family_links` (`DATA_DICTIONARY.md` 5921–6014 [H]): `rep_team_id` **NOT NULL** (:5939); `player_id` **NOT NULL by CHECK**
  `role = 'guardian' AND player_id IS NOT NULL` (:5949-5957 [V]); `child_id` NOT NULL since mig 445 (:5946 [V]); live-unique
  `(child_id, rep_team_id, invited_email, role)` where status not in (declined, revoked) (mig 445:64-66 [V]); `status` CHECK
  `requested|invited|pending_approval|verified|declined|revoked` (:5978 [H]); `verified_via` CHECK
  `email_match|coach_approved|registration_match` (:5981 [H]); `calendar_token_hash` **per link** (:5992 [H]); the guardian cap trigger
  counts per child **per team** (:5951 [V]). :6007 says the table is rep-only by design [H]: that sentence changes with Part 1.
- Reach: `readChildTeamEntries` (`lib/family-access.ts:428-445` [H]) reads **only** `rep_roster_players` (no call-ups);
  `lib/family-link-reach.ts` is pure (`reachedEntry` :36, `reachesLive` :45 [H]). Every reader goes through
  `getVerifiedLinkForUserTeam` (:386) and `reachingLinks` (:411) [H]. The calendar: `ensureFamilyCalendarToken` :449,
  `resolveLinkByCalendarToken` :463; a closed season answers an empty calendar (`app/api/family/calendar/[token]/route.ts:40-50` [H]).
- The invite today: `inviteGuardian` (`lib/family-guardian.ts:308-364` [V]) inserts an `invited` link with a 14-day token and **sends
  nothing**; the coach card shows the link (`components/coaches/PlayerGuardiansCard.tsx:262` [H]). `claimGuardianInvite` (:374-426 [V])
  downgrades a mismatched claimant to `pending_approval` (ruling 5 removes that branch). Consent words: `lib/family-guardian-consent.ts`
  [V] (placeholders, an age-band select, and a draft notice that says "being confirmed with our privacy advisor": **false since
  2026-11-04, replace it**).
- The family pages: `app/(consumer)/family/claim/[token]/` and `app/(consumer)/family/teams/[teamId]/` (rep team id only) [V];
  `FamilyTeamClient.tsx` [V] holds Your player, From the coach, Schedule, Up next and the calendar row. There is no family index page.
- House league: a child record exists for every registration since mig 435 (`league_registrations.child_id`, created at sign-up insert,
  never matched automatically) [H]. Date of birth: `league_registrations.player_date_of_birth`, `org_children.date_of_birth`,
  `rep_roster_players.player_date_of_birth` [H]. **There is no club province column** [H]: the only one found is
  `billing_locations.region_code` keyed by `org_id`. Use it when present; when absent, take the most protective path (Quebec's under-14
  rule) and record that the province was unknown. Do not add a province column in this stage.
- The placement email: `leagueTeamsPlacedHtml` (`lib/email.ts:1276-1306` [V]) and `leagueTeamMovedHtml` (:1309 [V]), sent by
  `sendPlacementEmails` (`lib/house-league-placement-mail.ts:76`, `sendClaimed` :134, the batch send :216, second-parent copies via
  `sendSecondParentServiceCopies` :231 [H]). Triggers: Publish (`.../publish/route.ts:85`, resend :45) and a late placement or move
  (`.../placement/route.ts:53`) [H]. Unused words `placedMail.button`/`movedMail.button` = "See your registration"
  (`lib/house-league-teams-words.ts:127,135` [V]): delete them in Part 5 if still unused.
- Pre-confirmed accounts already exist: `auth.admin.createUser` with `email_confirm: true` (`app/api/auth/signup/route.ts:179-182`,
  `coach-signup/route.ts:140-143` [H]). Reuse that path.
- The account menu: `components/shared/AccountMenu.tsx` (rows :205-317), rendered by `AdminTopStrip.tsx:140` and `CoachTopStrip.tsx:112` [H].
- The join window: `components/admin/kit/club/families/ChildrenDuplicates.tsx` (confirm :113-128) [H]; split: `SplitRecordsWindow.tsx`
  (already names connected parents, `lib/child-page.ts` `connectedParents`) [H]. Joining moves links to the kept child
  (`org_children_join`, mig 445:174-199 [H]).
- The registration record window: `components/admin/kit/club/league/registrations/RegistrationRecordWindow.tsx`, details :124-141,
  actions :202-216 [H]; "Send a new link" comes from `lib/house-league-registrations.ts:416` [H].

## Part 1 — The database (migration 453)

Next free number **453** [H] (re-check: another session may have taken it). One migration, re-runnable, with a header naming the
prod pre-checks. Decide every column from the snapshots / live `information_schema`, never from migration files.

1. **`family_links` holds a house-league child and stops being per team.** Make `rep_team_id` and `player_id` nullable; replace the
   strict CHECK with `child_id IS NOT NULL` (keep the constraint name if the convention in 445 kept names). Replace the live-unique
   index with `(child_id, invited_email, role)` where status is live. Re-key the guardian cap trigger to **two live guardians per
   child** (not per team). Keep `player_id` as "the entry this link was made on", now nullable; keep the cascade for rep rows.
   **Pre-check (dev and prod):** count live links that would collide under the new key (same child and address on two teams); the
   migration merges them (keep the most-connected, end the rest) and says how many it touched.
2. **How a connection was made**, for ruling 8 and flag d: a new column (e.g. `invited_as`: `first_parent | second_parent |
   rep_coach | requested`), backfilled (`rep_coach` for existing invited links, `requested` for the old ask path). Only
   `second_parent` connections are ended by a stop.
3. **How a connection ended**, for "never re-invited automatically": e.g. `ended_by` (`parent | club | stop | join`) alongside the
   existing `revoked_at`. Leaving = `revoked` + `ended_by = 'parent'`.
4. **Invitations as their own record**, because one acceptance covers several children (ruling 3): `family_invitations` (org, the
   normalized address, token hash unique, `expires_at` = +30 days, `source` placement | rep_coach, the rep player when rep, who sent
   it, `used_at`, `cancelled_at`, `replaced_by`). Sending again replaces (the old one answers "expired, or replaced", drawing state D).
   **Grants:** an explicit `service_role` grant (the grants guard caught 448 without one). No row is readable by `anon`/`authenticated`.
5. **One calendar address per parent** (ruling 6): `family_calendar_feeds` (user, token hash unique, created, stopped). Drop nothing:
   leave `family_links.calendar_token_hash` in place this stage, unread once Part 7 lands, and note it for a later drop.
6. **A rep invitation stop** (/legal, the coach's email): `family_invite_stops` (org, normalized address, created). The rep Send
   invitation is refused for a stopped address with plain words ("That address has asked not to get invitations from this club.").
   Not `second_parent_stops`, not `family_email_optouts`.
7. **Close the stop race in the database** (CASL flag c): a trigger refusing `league_registrations.guardian_email_2` (insert or update)
   and a new `family_invitations` row for an address in `second_parent_stops` for that org. This is the one sanctioned database read of
   the stop table; the 3b guard test is over TypeScript, so check it still passes and add a line to its comment.
8. **Extend `second_parent_stop`** (mig 448) in the same migration: in its one transaction, cancel open `family_invitations` to that
   address in that org and end `family_links` with `invited_as = 'second_parent'` for that address in that org (`ended_by = 'stop'`).
9. **Extend `org_children_join`** so the confirm can name connected parents (if the window needs a read function), and keep "a third
   live guardian refuses the join" with the new per-child cap.

Same unit of work: `DATA_DICTIONARY.md` (rewrite the `family_links` rep-only sentence at :6007, every new column and table),
`npm run refresh:snapshots`, `npm run check:dictionary`, `tests/unit/team-move-coverage.test.ts` STAYS lines for the new org tables,
a `MANUAL_PROD_STEPS` entry **453 = pending, after 435, 441, 445 and 448** (prod has none of 445's columns as of the last snapshot:
`DRIFT_dev_vs_prod.json` lists `family_links.child_id` as dev-only [H]). Prove it with a rolled-back probe in `.probe/`.

## Part 2 — Who a connection reaches

1. `readChildTeamEntries` reads **both** the child's rep entries (non-call-up) **and** its house-league registrations that are placed
   on a team (team set, registration active) in a live season, for the organization of the link. Keep `family-link-reach.ts` pure: feed
   it one list of entries with a kind (`rep | league`). Live = the season is draft or active (house league: the season's own status;
   **house-league seasons read in place**, owner ruling 2026-11-04, but a parent sees only live seasons in 4a).
2. A link now reaches **every team** its child is live on. Replace "the link for this user on this team" with "the user's verified
   links in this org, and the teams each reaches". Every caller of `getVerifiedLinkForUserTeam` keeps its guarantee (a parent reaches a
   team only through a verified link whose child is live on it). The recap door stays rep-only and unchanged.
3. Unit tests: a child on a rep team and a house-league team reaches both; a withdrawn registration stops reaching; a moved child
   reaches the new team and not the old; a closed season stops reaching; a link in another org reaches nothing; a call-up reaches nothing.

## Part 3 — The invitation rules (one module, server-only)

One module (e.g. `lib/family-invitation.ts`) owns: who is invited, when, and what an acceptance connects. Words in a words module.

1. **House league, at placement** (Publish, a late placement, a move): for each address on the placed child's sign-up (first and, under
   the Stage 3 rule, second), decide **invite | already connected | none**. *None* when: the tier is off; the child is 18 or older;
   the address has an ended link for this child with `ended_by` in (`parent`, `club`, `stop`); the address is stopped (it cannot be on
   the sign-up anyway, but the database refuses it too). *Already connected* when the address's account already holds a live link to
   this child.
2. **What an acceptance connects** (ruling 3): every child in this org whose **placed** registration carries the accepted address
   (as first or second parent), plus the rep player for a rep invitation. Children who are signed up but not placed yet connect when
   they are placed, by the same rule, with no new invitation. Each link records `invited_as`.
3. **Rep:** the coach's Send invitation creates a `rep_coach` invitation for that player and address (refused for a stopped address, an
   invitation-stopped address, an 18+ player, or a child at two live guardians).
4. **Accepting** (Part 4 calls it): the token is valid, unused, not expired, not replaced, not cancelled; the signed-in account's email
   equals the invitation's address (otherwise refuse, ruling 5; **delete** the `pending_approval` branch of `claimGuardianInvite` and
   its approve path; existing dev rows in `pending_approval` are left as they are, unreachable, and noted for cleanup); both consent
   boxes ticked. Writes the links `verified` with `verified_via = 'registration_match'` (house league) or `email_match` (rep), the
   consent record per **/legal condition 4** (the exact words shown, the wording version, time, IP, club, child; **not** the age band),
   and marks the invitation used.
5. **The age band** (ruling 12): from the date of birth the club holds and the club's province (`billing_locations.region_code` when
   present; unknown → the most protective path). 18+ → no invitation at all. The band is never shown and never asked.
6. Unit tests for every *none* case, for one acceptance connecting three siblings across two teams, for a mismatch refusal, for an
   expired and a replaced token, and for a stop cancelling an open invitation and ending only a second-parent connection.

## Part 4 — The accept page (drawing tab 2)

Rebuild `app/(consumer)/family/claim/[token]/` to the drawing, in the family app's look (paper ground, the ink pill button), no club band.
1. **Email first:** "Type the email this invitation was sent to", with "This invitation is for p••••••@example.com." The server
   compares; the page never receives the full address.
2. Then **new account** (choose a password; created pre-confirmed, ruling 15) or **existing account** (password sign-in with Forgot
   password), or **signed in already** (state A). The parent fills the page **once**: no 401 bounce, no second form.
3. **"Before you join"** with /legal draft (a) verbatim, and the two boxes. With several children (state B), the page lists them and
   the box reads "I'm the parent or legal guardian of Leo, Ava and Maya." No age question. The draft notice reads "Draft wording — not
   final." while the words are a draft, and nothing on a real page claims a review is under way.
4. **Failure states, exactly as drawn:** C (another email: refuse, Sign out; on rep it names the coach, not the club), D (expired or
   replaced: "Email me a new invitation", which re-sends the placement email (house league) or the coach's invitation (rep) to the
   invited address only, and answers the same either way), E (already joined: Open the team), F (no longer works: names the club's
   contact; no sign-in button). A page that tells a stranger *why* an invitation stopped working is a defect.
5. After joining: the team page with the one-time "You've joined" note (tab 3). Throttle the email box and the re-send button with the
   family form buckets (`lib/public-form-throttle.ts`).

## Part 5 — The emails (drawing tab 1) · needs O1 answered

1. The **invitation panel** in the placement and moved emails, only when the tier is on and Part 3 says *invite*: /legal draft (c) fine
   print. The "already in the app" one-liner when Part 3 says *already connected*. **Nothing at all** (today's email) when *none*. The
   panel **promotes nothing** (/legal condition 6): no plan, price, offer, FieldLogicHQ pitch. While money is owed the "Your sign-up"
   button stays in the body (Stage 1) and the panel keeps its own button below it, as drawn.
2. The **second parent's copy:** the band and contact line like every copy, the who-added line, the panel with the ignore line directly
   under the button, the Stop footer, and the club's mailing address (/legal: build it to the commercial-message standard). No reminders.
3. The **rep coach's invitation email:** sender = the coach for the club ("Sam Ortiz via {club}"); a standalone coach team with no club
   shows the FieldLogicHQ wordmark and names the coach and FieldLogicHQ; mailing address and contact; "ignore if not you"; the
   **Don't send me invitations** link → a confirm page with a POST (never a destructive GET), writing `family_invite_stops`.
4. **Send again** (club, Part 8) and **Email me a new invitation** (parent, Parts 4 and 6) re-send the placement email for that family
   and address with a fresh invitation (ruling 9); the old token is replaced.
5. Words in one words module; built-in templates only for the panel (a customised placement template gets no panel and says nothing
   wrong: check how Stage 3 handled `builtInOnly`).

## Part 6 — The family pages (drawing tabs 3, 4 and 5)

1. **Routes.** One family page per team for both kinds (decide the route shape: a kind segment, or one id space; the rep route keeps
   working for existing links). A **"Your family" page** (the list) when the parent has more than one team **or none right now**; with
   exactly one team, "Your family" opens that team. A house-league team page has **no "From the coach" card**.
2. **The team page** gains: the one-time joined note; **Your sign-up** row (Paid or the amount owed, opening the in-app sign-up);
   **Your calendar** row (Part 7); /legal draft (b) privacy line; **Connected to {child}** with Manage → the list of connected adults
   (the second parent shown by address until they join), the club's contact line, and **Leave {child}'s team** (/legal draft (e), the
   first-parent and second-parent variants).
3. **No team right now** (withdrawn, or between seasons): the child row "Not on a team right now. The club will email you when teams
   are set." and the sign-up row while the sign-up page is open.
4. **Removed by the club:** "You're no longer connected to {child}. If you think that's wrong, contact {club} at {contact}." No email.
5. **"Your sign-up" inside the app** = the same page and component as the emailed one (`status/YourSignup.tsx` [H]), found by the
   signed-in parent's connection, not by the link: the back link goes to the team; the "Anyone with this link" line becomes "You're
   seeing this because you're signed in as {child}'s parent." Paying, the receipt field and Ask to withdraw behave identically.
6. **The emailed sign-up page** gains the way-back block, once a child on it is placed: "Joined {child}'s team? Sign in to see it" (the
   ordinary sign-in) and "Not yet? Email me an invitation" (sent to the address on the sign-up only; same answer either way).
7. **The account menu row** "Your family" (`components/shared/AccountMenu.tsx`), only for an account with a live verified link and the
   tier on.
8. What a parent **never** sees: the roster, other children, other families' contacts. Add a test that the family payloads carry no
   teammate fields (`lib/family-guardian-view.ts:23-26` [H] is the current shape).

## Part 7 — The calendar (drawing tab 6)

One address per parent (ruling 6), minted only from the signed-in family page: **Make my link**, then the address, **Copy**, and
**Stop this calendar** (asks once). It serves every team each of the parent's live links reaches, events titled by team ("Otters
practice"), never a child's name. A season close, a move, a leave or a removal changes what it serves; it goes empty when nothing is
reached (the S6 empty-calendar answer, not an error). The address is an https URL as built. Keep the per-link feed route answering for
existing dev tokens until Part 9 notes the drop.

## Part 8 — The club and the coach (drawing tabs 7 and 8)

1. **Registration record window:** under Email and Second parent, one status each: **In the app since {date}** · **Invited {date}**
   with **Send again** · **Not invited yet** (before Publish) · the 3b **Stopped** line unchanged. In Actions: **Remove a parent from
   {child}'s team** (asks once; ends the link with `ended_by = 'club'`; the parent is not emailed) with the hint "Removing someone stops
   them seeing {child}'s team. It doesn't change the sign-up or who gets emails." Who may use them: anyone who can change registrations
   (the same right as "Send a new link"). The Families book is **unchanged**.
2. **Rep Guardians section** (`PlayerGuardiansCard.tsx`): "Invite a guardian" (drop "directly"), the sentence "We'll email them an
   invitation. It works for 30 days.", **Send invitation**; the invited row and Cancel invite as built; **remove the mismatch approval
   rows**. Nothing at roster add.
3. **The join window** (`ChildrenDuplicates.tsx` confirm): names the connected parents of both records before the club confirms
   (words only; drawing tab 8). The split window already does.
4. **The stop confirm page** (`app/second-parent-stop/page.tsx`): when the address holds a second-parent connection, add /legal draft
   (d) before the one press.
5. **House-league coach: nothing new** (ruling 10). Check the coach team page still lists both parents' emails as today.

## Part 9 — Closeout (Session 4)

1. `/simplify` (new module and shared readers), then `/review`. `npm run verify:changed`; `npm run typecheck` (auth and API contracts
   change); the unit suites above; update `tests/uat/scenarios/family-guardian-tier-boundary.spec.ts` and `family-access-boundary.spec.ts`
   [H] (tier off = nothing changes; tier on = the new rules), and check `children-duplicates`, `club-stage1-server-guard`,
   `club-stage6d-feeds-guard`, `coach-call-ups-guard`, `team-move-coverage` and `family-recap-boundary` [H].
2. **Guards that must exist as tests:** (a) with the tier off, the placement email, record window, coach card and account menu render
   exactly as before; (b) no send path reads `second_parent_stops` (the 3b guard still passes); (c) an invitation is never created for
   an address not on the child's sign-up (house league); (d) a stop ends only `second_parent` connections; (e) an ended link blocks the
   automatic invitation; (f) the invitation token never signs anyone in or shows a team; (g) no family payload carries teammates.
3. `/legal`: re-read the rendered words against draft 0.1 and its six conditions; update the draft's status, the privacy policy draft if
   a promise changed, `LEGAL_INDEX.md`, and the CASL memo ("re-verify when Stage 4 ships").
4. `/marketing`: the email panel, the accept page, the family page lines, the coach sentence, the club statuses.
5. `/docs`: registrar help (the record window statuses, Send again, Remove a parent), rep coach help (Send invitation), and any family
   help the hub carries (`lib/help-content/registrations.tsx`, `house-league.tsx`, `rep-teams.tsx`, `families.tsx`, `coaches.tsx` [H]).
6. **Rewrite `COACH_AVAILABILITY_RSVP_PLAN.md` to the app channel** (plan item 4): replies happen in the signed-in family page (the
   drawn 4b sheet: In / Out / Maybe and a note), a new reply record that never overwrites the coach's attendance, the coach's headcount
   (not drawn: 4b needs its own drawing session). Remove the emailed-link door from the plan. Docs only.
7. **The walk:** a checkable QA Artifact (one purpose: Stage 4a), its own **Owner QA Ledger section** with the next free §number,
   covering: placement email with and without money owed; second parent's copy and Stop; three siblings on two teams with one
   acceptance; each accept-page state A–F; leave, club removal, re-placement without a re-invite; the in-app and emailed sign-up pages;
   the calendar make, copy, stop, a move; the record window; the rep Send invitation and its stop; the tier off. It needs a Resend key
   on dev and the tier on in the owner's `.env.local` (ask first). Restart the dev server before the walk (new files, shared modules).
8. Records: this Progress block, the plan's Stage 4 status (commit hashes, migration 453 dev only, prod step), the PM brief's Stage 4
   line, the TODO line, `MANUAL_PROD_STEPS` 453, the auto-memory note. Offer `/strategy` only if a ruling turned out to need logging.

## ▶ Progress (read first when resuming)

- Fill in per Part: date, commit hash (when the owner says to commit), tests run, anything done differently and why.
- **Session 1 (2026-11-08): Parts 1–3 BUILT, committed `7823c406c` 2026-11-08 (owner said to commit).** PM UX plan presented; O1 = A and
  O2 = second-parent only ruled (above, and in the plan).
  - **Part 1 — migration 453** `453_a_family_joins_the_child_on_every_team.sql`, applied to DEV 2026-11-08 (pre-check: 14 links, all
    live, 0 colliding, 0 over the cap; re-applied twice, re-runnable). Proved by `tests/sql/family-invitation-fixture.sql` (S4A FIXTURE OK
    10/10, rolled back) and `tests/sql/child-join-split-fixture.sql` still S6 FIXTURE OK 12/12; API probes `.probe/s4a-reads.mjs` (8 reads)
    and `.probe/s4a-rpc.mjs` (issue + replace). Dictionary, snapshots, `MANUAL_PROD_STEPS` 453 = pending, team-move STAYS, the 3b guard's
    comment + a 453 assertion. **Differs from the prompt:** `ended_by` also takes `coach` (a rep coach's Remove / Cancel) and `merged`
    (453's duplicate merge and the join; only `merged` does not block the automatic invitation); `invited_as` is NOT NULL with default
    `rep_coach` (the older rep-side writers: UAT specs, seeds, the join fixture) and a new CHECK `family_links_made_on_entry_ck` stops a
    house-league link taking that default; `family_invitations.reconnects` (true only for the club's Send again — the one thing that
    lets a parent who left or was removed back on); the issue is one SQL function `family_invitation_issue` (advisory-locked, replaces
    the open one); the cap trigger no longer re-counts an update that keeps a row live on the same child; the join also moves a rep
    invitation's child. Nothing in 9 (the join window's names) needed SQL: `lib/child-page.ts` already reads connected parents.
  - **Part 2 — reach** (`lib/family-link-reach.ts` `teamsReached`, `lib/family-access.ts` `getFamilyReach`,
    `getVerifiedLinkForUserTeam` by child, `verifiedLinksReachingRepTeam`; notify, engagement, rollup, labels, families-read moved off
    `rep_team_id`). **Differs from the prompt (decided on the code, recorded in the plan):** a house-league child reaches a team only once
    its division's teams are PUBLISHED (the draft board sets `team_id` before Publish); a house-league season is live until completed or
    archived (its registration statuses are when teams publish). The coach's guardians card now reads by child (a house-league parent of a
    rep player shows there) and excludes call-ups (a borrowed player's parents never show to the borrowing coach).
  - **Part 3 — the rules**: `lib/family-invitation-rules.ts` (pure), `lib/family-invitation.ts` (server), `lib/family-invitation-words.ts`;
    consent words rewritten to /legal draft 0.1 (a) in `lib/family-guardian-consent.ts` (no age band; notice "Draft wording — not final.";
    the several-children form is the one-child sentence with the names joined — **/legal and /marketing re-read it in Session 4**).
    Removed: `approveGuardianLink`, `claimGuardianInvite` (its mismatch branch), `inviteGuardian`, `inviteCoGuardian` and the
    `/api/family/teams/[teamId]/co-guardian` route (**the parent-typed "invite another adult" door broke "an invitation goes only to an
    address on the sign-up"**; it had no UI caller). Rewired: the coach's guardians route (Send invitation issues a rep invitation; no
    link returned; Cancel invite cancels it; no approve), the claim route (accept, refuse a different email), and — ahead of Part 8 — the
    card's tab 7 words ("Invite a guardian", "We'll email them an invitation. It works for 30 days.", Send invitation; the approval rows
    and the copy-a-link box gone). The accept page is an **interim** stand-in until Part 4 (no age question, the /legal words).
  - **Tests:** `tests/unit/family-invitation-rules.test.ts` 34/34 (every *none* case, three siblings on two teams, a mismatch, expired and
    replaced, the stop); guard edits in `children-duplicates`, `coach-call-ups-guard`, `roster-delete-guard`, `league-second-parent`,
    `team-move-coverage`; `npx tsc --noEmit` clean (8 GB heap; `npm run typecheck` ran out of memory at the default). `verify:changed`:
    15,597 tests, 12 failing, **all other sessions' work in progress** (billing tax words in help files, practice-plan door, admin shell
    island, plan-billing usage, public tournament stage 6 walk, series date groups, two support-console guards, workspace-flip, and
    team-move's `platform_charge_tax_looks`); the tail checks: spelling, dates, dictionary, manual-prod, demos, observability clean; lint 0
    errors; schema parity lists 453 as dev-only (expected until prod).
  - **Open for later Parts / owner:** (1) Part 5 must send the rep invitation email (Send invitation issues the token and sends nothing
    yet) and add O1's no-contact refusal; until then do not switch the tier on. (2) `connectAlreadyJoined` connects a newly placed sibling
    under the earlier acceptance and writes a consent record saying so (ruling 3 "as each is placed") — /legal to re-read in Session 4.
    (3) `family_invite_stops` does not follow a standalone team into its club (team-move STAYS says so) — carry it the next time
    `move_team_into_club` is re-created. (4) `family_links.calendar_token_hash` and the per-link feed stay until Part 7/9. (5) UAT specs
    `family-guardian-tier-boundary` / `family-access-boundary` still exercise the old claim body (Part 9). (6) Old `pending_approval`
    rows: none on dev (pre-check 0).
  - **Files (Session 1):** supabase/migrations/453_a_family_joins_the_child_on_every_team.sql, supabase/migrations/MANUAL_PROD_STEPS.json
    (the 453 entry only), docs/agents/db/DATA_DICTIONARY.md (family_links, family_invitations, family_calendar_feeds,
    family_invite_stops, second_parent_stops gotcha 6), docs/agents/db/schema-snapshots/* (refreshed by the hook), lib/family-access.ts,
    lib/family-link-reach.ts, lib/family-guardian.ts, lib/family-guardian-consent.ts, lib/family-invitation.ts,
    lib/family-invitation-rules.ts, lib/family-invitation-words.ts, lib/family-notify.ts, lib/family-engagement.ts, lib/families-read.ts,
    app/api/coaches/[orgSlug]/teams/[teamId]/guardians/route.ts, app/api/family/claim/[token]/route.ts,
    app/api/family/calendar/[token]/route.ts, app/api/family/teams/[teamId]/co-guardian/route.ts (deleted),
    app/(consumer)/family/claim/[token]/page.tsx + ClaimClient.tsx, components/coaches/PlayerGuardiansCard.tsx,
    components/coaches/FamilyCard.module.css, tests/sql/family-invitation-fixture.sql, tests/unit/family-invitation-rules.test.ts,
    tests/unit/{children-duplicates,coach-call-ups-guard,roster-delete-guard,league-second-parent,team-move-coverage}.test.ts, this
    prompt, SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md (the O1/O2 + build-decisions paragraph).
  - **Next: Session 2 = Parts 4–5** (the accept page to the drawing; the emails, with O1 = A). `/clear` first.
- **Session 2 starts here (handed over by Session 1).** Paste: `execute Session 2 (Parts 4–5) of @docs/projects/active/SIGNED_IN_FAMILY_STAGE4_BUILD_PROMPT.md`.
  - The PM UX gate was met in Session 1 for the whole stage; present a short plain-language recap of what Parts 4–5 change before code.
  - **Build on what exists, do not re-make it:** `inspectInvitation`, `acceptInvitation`, `invitationEmailMatches`, `maskEmail`,
    `issuePlacementInvitation` (returns null when the stop refuses), `issueRepInvitation`, `planPlacementInvitations` (Part 3's
    invite / already connected / none, per address) in `lib/family-invitation.ts` + `lib/family-invitation-rules.ts`; the consent words
    in `lib/family-guardian-consent.ts`; the rep refusal words in `lib/family-invitation-words.ts` (add the email words to that module).
  - **The interim accept page** (`app/(consumer)/family/claim/[token]/`) is the thing Part 4 replaces. The claim route already returns
    `consent_required` (400), `another_email` + `maskedEmail` (409) and a state (404); extend, don't fork.
  - **Owed by Part 5 before the tier can go on:** the rep Send invitation issues a token and **sends nothing yet** — Part 5.3 sends it;
    O1 = A's no-contact refusal (Publish and the rep Send invitation, tier on only) lands here, with words saying where to set the contact.
  - Where the placement email is assembled and how Stage 3 handled `builtInOnly`: not yet read this stage — locate it with a helper first.
  - Tier stays OFF everywhere shared; dev browser checks need the owner's `.env.local` (ask first). Restart the dev server before any
    browser check (Session 1 added and deleted files and changed shared modules).
