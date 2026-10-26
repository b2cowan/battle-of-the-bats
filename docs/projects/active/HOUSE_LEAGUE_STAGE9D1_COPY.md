# Club Tier Stage 9d-1: the words (one email composer)

> **/marketing, 2026-10-26**, on the drawings' provisional strings (`HOUSE_LEAGUE_STAGE9D1_DRAWINGS.html`, artifact
> Xy8ENL1KbUZVbWpDthD9EB) under the plan's §0g rulings. These are the build's words: the code puts them in one words
> object (beside `FAMILY_EMAIL_WORDS` in `lib/families-words.ts`, so a season and the club say a shared thing once) and a
> screen never hand-types a second spelling.
>
> **Binding inputs:** 9d1·12, the allowance is **any rolling 24 hours**, so no allowance sentence says "today" or "a day"
> (9d1·8's example "left today" is superseded). The customer word is **"emails", never "sends"** (/design). Sentence case,
> the bare possessive (`possessive()`), the house clock ("4:12 p.m.", through `formatTime`), `npm run check:spelling`.
> **Owner 2026-10-26 (build session):** "a season's families" = **families with an active child** (on a finished season,
> active when it finished) from **both** doors: the season's window and the Families window's season choice.

## The four settlements that shape everything else

1. **The allowance counts what was sent, not what is "left today".** A rolling window has no "today": "2 left today" is
   untrue at 11 p.m., when one may free up at 9:14 a.m. The club's refusal already says *"Your club has sent 3 emails to
   families in the last 24 hours. The next can go at …"*. The season and the club now say the allowance the same way at
   every state:

   | State | Window foot (after the reach sentence) | Season page subtitle |
   |---|---|---|
   | None sent | This season can send 3 emails in any 24 hours. | {Season} · up to 3 emails in any 24 hours |
   | Some sent | This season has sent 1 of its 3 emails in the last 24 hours. | {Season} · 1 of 3 emails sent in the last 24 hours |
   | All sent | (the refusal, below; Send is absent) | {Season} · 3 of 3 emails sent in the last 24 hours; the next can go at 4:12 p.m. |

   The club door uses the same three with "The club" / "its": *"The club can send 3 emails in any 24 hours."* ·
   *"The club has sent 2 of its 3 emails in the last 24 hours."* A season picked on the club door uses the season's line
   with the season's name: *"Draft Test 2027 can send 3 emails in any 24 hours."* Phone subtitle drops the season name
   (the eyebrow carries it): *"1 of 3 emails sent in the last 24 hours"*. "The next can go" uses the existing `whenNext`
   ("at 4:12 p.m." the same day, "tomorrow at 9:14 a.m." otherwise).

2. **"Send" stays a verb; "sends" never appears as a noun.** The drawings' "See the send", "Earlier sends", "3 sends a day"
   and Families' existing *"This send stopped partway"* all change (below).

3. **Counts read "{name} · {n}" on chips; the unit lives in the sentence.** The drawing mixed "Division A · 7 families"
   with "Cardinals · 2". Every chip (division, team, status) is *"{name} · {n}"*; the foot says "families".

4. **A family is named by its last name: "the Kim family".** From the registration's guardian last name. Two or three
   are joined with `joinWithAnd`: *"the Rossi and Nguyen families"*, *"the Dubois, Kim and Patel families"*. Four or more
   are counted, not named.

## The window

| Element | Drawn | Settled | Why |
|---|---|---|---|
| Title (season or club, whole audience) | Email families | Email families | the door's name, unchanged |
| Title (ticked families) | Email 3 families | Email 3 families | |
| Title (one family) | Message this family | Message this family | Families' one-family window's name |
| Eyebrow (season door) | Dev House League 2026 | {Season name} | no time in an uppercase eyebrow (/design) |
| Statement, season, desk | Sends one email to each family you choose in Dev House League 2026, from the club, with your address to reply to. A family that opted out of club email is skipped. | (as drawn) | mirrors the club statement word for word, adds only the season |
| Statement, season, phone | One email to each family you choose in this season, from the club. Families who opted out are skipped. | (as drawn) | |
| Statement, club | (today's) | (today's, unchanged) | |
| Who label | Who | Who | |
| Everyone row | Everyone in the season / Families with an active child, each once / 10 families · 11 children | (as drawn) | the owner's definition, said where it applies |
| Division row | A division / Division A, Division B | A division / Pick one or more | the sub-line says what to do, not a list the chips repeat |
| Team row | A team / Teams in a published division | (as drawn) | |
| Status row | By status / Active, to review, waitlist or ended | (as drawn) | the Registrations tab names, lowercased mid-sentence |
| Chips | Division A · 7 families · Cardinals · 2 · Active · 10 | {name} · {n} for every chip | settlement 3 |
| Status chip names | Active · To review · Ended | Active · To review · Waitlist · Ended | the four Registrations tabs; a zero chip is absent |
| Team hint | Families with an active child on the team. A team's coach is not copied unless you tick it (ask 9). | Families with an active child on the team. | the box beside it says the rest |
| Copy coaches box (one team) | (not drawn) | Copy the team's coaches · 2 coaches | 9d1·9's words; the count says who gets it |
| Copy coaches box (two or more teams) | (not drawn) | Copy each team's coaches · 4 coaches | |
| Copy coaches sub-line | (not drawn) | They get a copy as colleagues and aren't counted as families. | 9d1·9 said where the box is |
| Unpublished division | U10 Division A's teams aren't published yet. Families hear their teams when you publish on Teams & draft. | {Division}'s teams aren't published yet, so they aren't listed. Families hear their teams when you publish them on Teams & draft. | says why a team is missing, up front |
| No team published at all | — | No team is published yet. Families hear their teams when you publish them on Teams & draft. | |
| Its link | Go to Teams & draft | Go to Teams & draft | shown only to someone who can open Teams & draft |
| Pick prompts (foot, in Send's place) | Pick a team. | Pick a division. · Pick a team. · Pick a status. | |
| Subject / Message | Subject \* / Message \* | Subject / Message (required marker) | |
| Subject placeholder | e.g. Rainout tonight / e.g. Henry's shin pads | e.g. Picture day is Saturday | one placeholder that suits every audience |
| Message placeholder | Write your message here… | (as drawn) | |
| Links | See who gets it · See the email | (as drawn) | |
| Last sent | Last sent Oct 26 by Alex Rivera · "Picture day is Saturday" · 10 families | (today's `lastSentValue`, this season's or the club's) | |
| Never sent | — | Not sent from here yet | today's word |

### The foot, before Send

| State | Settled |
|---|---|
| Reach, season | 10 families get it (11 children). |
| Reach, club | 15 families get it. (today's) |
| Opted out, 1–3 named | 10 families get it (11 children). 1 opted out of club email and won't: the Dubois family. |
| Opted out, 4 or more | … 4 opted out of club email and won't. |
| Then the allowance | settlement 1, as its own sentence |
| Sending | Sending… |
| Buttons | Cancel · Send to 10 |
| One family | Sends to henry.kim@dev.local. A message to one family doesn't count toward the season's 3. |
| One family, from Families | (today's one-family window, unchanged) |

### One family and ticked families

| Element | Settled |
|---|---|
| One family's block | The Kim family / Ava and Henry · henry.kim@dev.local |
| Ticked block | The 3 families you ticked / Chen (Liam) · Rossi (Sofia) · Patel (Noah) |
| Ticked, more than five | … · and 4 more |
| Two children of one family ticked | You ticked 2 children of one family, so this is a message to that family. It doesn't count toward the season's 3. |
| One family's own limit | The Kim family has had 3 messages from the club in the last 24 hours. The next can go at 2:14 p.m. |

### Refusals (the window opens on them; Send is absent, only Close)

| Door | Settled |
|---|---|
| Season, desk | Dev House League 2026 has sent its 3 emails to families in the last 24 hours. The next can go at 4:12 p.m. Automatic notices and a message to one family still go. |
| Season, phone | This season has sent its 3 emails in the last 24 hours. The next can go at 4:12 p.m. |
| Club | Your club has sent 3 emails to families in the last 24 hours. The next can go at 11:05 a.m. Each house league season has its own 3: pick one under Who to email its families. |
| Just sent (either) | This was just sent. Check Last sent before sending it again. (today's) |

The club refusal no longer closes the window: picking a season under Who moves the send to that season's 3 (9d1·6), so
the refusal sits on the club-wide choices only.

### Recount and closing

| State | Settled |
|---|---|
| Counting | Counting who this reaches… |
| Changed | Who this reaches changed while you were writing: it now goes to 11 families. Check it and send again. (today's `changed`) |
| Close with words typed | Close without sending? What you typed won't be kept. · Keep writing · Close (today's Registrations words) |

The drawing's "(Maya Singh's was accepted)" is dropped: the window can't honestly say which change moved the count.

### See who gets it

| Element | Settled |
|---|---|
| A family's line | Liam Chen · Cardinals / Ava and Henry Kim · Tigers (children, then team; no team, no dot) |
| Opted-out tag | Opted out |
| Past ten | and 8 more families · Show all |

## Results

| Result | Settled |
|---|---|
| All reached, season | Sent. Reached 10 of 10 families. This season has sent 1 of its 3 emails in the last 24 hours. |
| Partly | Sent. Reached 8 of 10 families. 2 couldn't be sent: the Rossi and Nguyen families. Check their addresses on Registrations. · Open the email |
| None reached, season | This didn't reach any family, so it doesn't count toward the season's 3. Please try again. |
| None reached, club | This didn't reach any family, so it doesn't count toward the club's 3. Please try again. |
| Couldn't tell | We couldn't tell whether this went out. Check Last sent before you send it again. |
| Coaches copied | 2 coaches copied. |
| One family, sent | Sent to the Kim family. It doesn't count toward the season's 3. |
| One family, failed | This didn't reach the Kim family. Check henry.kim@dev.local on Henry's registration, then try again. Your message is still here. |
| Ticked, partly | Sent. Reached 2 of 3 families. The Patel family's email couldn't be sent. |
| Note on the page after the window closed mid-send | Dev House League 2026: reached 8 of 10 families. 2 didn't get it. · Open the email |
| All opted out, one family | The Dubois family opted out of club email, so nobody would get it. |
| All opted out, several | Every family you picked opted out of club email, so nobody would get it. (today's) |
| No address | Nobody to send to: the 1 child picked has no family email on file. · Show them |

"See the send" became **"Open the email"**: it opens the history row's window, and "send" is not a screen noun.

## A stopped email (9d1·10)

| Element | Settled |
|---|---|
| Row chip and figures | Stopped · Stopped at 100 of 101 (today's) |
| Window note | This email stopped partway. 1 family it hadn't reached didn't get it. |
| Button | Send to the 1 it missed |
| Under it | Sending to the families it missed doesn't count toward the season's 3. (the club's: "…toward the club's 3.") |
| Result | Sent to the 1 it missed. Reached 101 of 101 families. |

Families' existing *"This send stopped partway. The families it hadn't reached yet didn't get it; send it again to reach
them."* is replaced by the same note and button (9d1·10 reaches Families › Emails too; "send it again" now means a
counted new email, which is no longer the advice).

## The season's sent history (the rail's Email families page)

| Element | Settled |
|---|---|
| Eyebrow / title | House league · season / Email families |
| Subtitle | settlement 1 |
| Primary button | Email families (phone: Email) |
| Columns | Sent · Subject · To · By · Reached (today's Emails tab) |
| To: everyone / divisions / teams / statuses | Everyone in the season · Division A · Division B · Cardinals · Jays · To review · Waitlist |
| To: ticked | 3 ticked families |
| To: one family | The Kim family |
| Reached | 10 of 10 (today's) · a one-family row: 1 family |
| One-family row's Subject | A message to this family (today's) |
| Automatic row | Teams published: Division B · tag Automatic |
| Footnote | Automatic emails to one family (accepted, waitlisted, declined) aren't listed here. Each goes to the family when the child's registration changes. (Build: the drawn "Each shows on that child's registration" was untrue — the history shows the change, not the email, and no waitlist move.) |
| Phone row | Oct 26 · 9:14 a.m. · Everyone · Alex Rivera |
| Divider | Earlier emails · counted per child |
| Old row, To | (stored words, e.g. All active registrants) · a bare division / team / status: A division (which one wasn't recorded) |
| Old row, Reached | 11 sent · 11 sent · 2 didn't go |

The drawing's "Earlier sends · before Oct 2026" became **"Earlier emails · counted per child"** on both sizes: "sends"
is not a screen noun, and the date would have to be the day 9d-1 reached each database, which nobody reading can use.

### The row's window

| Element | Settled |
|---|---|
| Facts | Sent · By · To · Going to · Reached · Opted out · Didn't go (today's labels) |
| Going to | 10 families (11 children) |
| Opted out / Didn't go, 1–3 | 1: the Dubois family |
| What it said | What it said |
| Reached note | (today's `reachedNote`) |
| One-family row | A message to one family keeps its date and who sent it, never its words. (today's) |

### The Automatic tag (clicked, it opens)

| Element | Settled |
|---|---|
| Body | FieldLogicHQ sent this when Division B's teams were published. Automatic emails don't count toward the season's 3. |
| Link | Open Teams & draft (only for someone who can open it) |

The drawing's "when you published" is wrong when someone else did; "3 sends a day" broke two rules at once.

### Empty and finished

| State | Settled |
|---|---|
| Nothing sent yet | No emails to this season's families yet / Emails you send to Dev House League 2027's families are listed here, with the ones FieldLogicHQ sends for you when you publish teams. |
| No families, open season | No families in test season yet / Once families sign up you can email them from here. |
| No families, finished season | No families in Dev House League 2025 (no button) |
| Finished season line | This season is finished. Its record is locked; you can still email its families. |

## The Families side

| Element | Settled |
|---|---|
| Season row's sub-line | A house league season / Families with an active child, each once (was "Everyone in it, each family once") |
| Picker option | Draft Test 2027 · Registration closed · 101 families (status = the season's own status chip label) |
| Picker hint | Counts toward Draft Test 2027's 3 emails, not the club's. To email a division, a team or a status, use the season's own Email families. · Open Draft Test 2027 |
| Emails tab, a season row's To | Dev House League 2026 · Everyone · Dev House League 2026 · Jays · Dev House League 2026 · The Kim family |
| Season filter | All · Club-wide · {each season's name} |
| Club "none reached" | settled above ("the club's 3", was "the three a day") |

## The family's email

| Element | Settled |
|---|---|
| Season footer reason | your family is registered in Dev House League 2026 → "Sent by Dev League Org because your family is registered in Dev House League 2026." |
| Club footer | (today's: "…registered with this organization.") |
| Coach copy's lead, house league | A copy of the email {org} sent to the families on {audience} ({n} reached). You're getting it as a coach. Families don't see this note. |

## Words that leave the product with the old composer

The old page's: "Back to compose", "Preview email", "Send to {label}", "Email sent — {n} delivered" and its tails,
"Emails go out immediately and cannot be recalled" and its body, "Sent history", "No emails sent for this season yet.",
"Loading the sent history…", the three audience descriptions. The Registrations window's: "Sending to {n} guardian(s).",
"No recipients match this selection.", "Sent to {n} guardians." and its "skipped" tail, "By division", "By team",
"Select a division…", "Select a team…", "Waitlisted" as a status option. "All active registrants" stays only as stored
words on an old row.
