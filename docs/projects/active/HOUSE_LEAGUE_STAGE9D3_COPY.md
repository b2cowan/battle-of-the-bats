# House League 9d-3 — the words (proposed 2026-11-01, awaiting the owner)

**Status:** PROPOSED. Nothing here is accepted until the owner says so. The asks behind it are ruled (plan §9, 2026-11-01);
the words are not. Source of the provisional words: `HOUSE_LEAGUE_STAGE9D3_DRAWINGS.html` (Gate & build notes, frames c1–c5,
b2, b3, b5). Written by a `/marketing` helper, spot-checked by the main session against the code (no `practise` anywhere in
`lib/`, `components/` or `app/`; the window's "Teams at once" word is already "per facility"; the built move email has no
time-zone line).

**Rules every string follows:** the clock is `formatTime` ("6:00 p.m."); one spelling (`practice`, the only form the product
uses); no link, button or unsubscribe link in the family email; examples (99 families, Twins, Diamond) live only in the
drawing, never in a string; placeholders are `{n}`, `{team}`, `{date}`.

## Drawing corrections found by the pass (fix when the build prompt is written)

- Step 1 draws "Teams at once · 1 a diamond". The built word is "1 per facility". The drawing must not teach "diamond".
- Frame c2's foot ("The words are the change email 11b built. Nothing new to learn.") is a design note. It must not ship.
- Frame b5's Reset words differ from the built, signed-off ones. Use the built ones (F below).
- Frame c4 puts one venue in the part heading. A team's dates can span venues, so the venue moves onto each date line.

## A. Practice time window

| String | Final words | Note |
|---|---|---|
| Step 1 foot, desk | The practices show on the schedule and on each coach's team page. Next you choose whether to tell the families. | Built foot "Families aren't emailed." is now false. |
| Step 1 foot, phone | Next you choose whether to tell the families. | Replaces the built phone foot. |
| Tell step title | Tell the families their practice times (phone: Tell the families) | Keep as drawn. |
| Statement | {n} practices a week handed out. {m} families haven't been told. | Singular: "1 family hasn't been told." |
| Tiles | Teams · Families ({n} have a child on two teams) · Will be sent (one email each) · No email | Keep as drawn. "Will be sent" counts households. |
| "What each family gets" row | What each family gets · Their child's team practice dates and places. Nothing about fees. · See an example | Dropped "No ratings": it plants an idea nobody had. |
| Buttons | Not yet · Send to {n} families (phone: Send to {n}) | Keep as drawn. |
| Foot, desk | Each family gets one email, sent now. It doesn't count toward {cap noun, see Q1}. | "Your sends" did not say whose or what. |
| Foot, phone | One email each, sent now. Not counted toward {cap noun}. | |
| Left-out line | {n} families have no email that works, so they won't get this. See them | Singular: "1 family has no email that works, so they won't get this." |
| Left-out line, phone | {n} families have no email that works. See them | |
| "See them" title | {n} families won't get this email | |
| "See them" rows | {name} · {team} · no email on file · Add an email / {team} · the address was refused ({address}) · Fix the email | Keep as drawn. |
| "See them" hint, foot, buttons | After you fix an email, Send again goes only to the families who didn't get this one. · A family is marked as told only once its email goes. · Done · Send again to {n} | "Reaches / weren't reached" were the engineer's verbs. |
| Sending | Sending to {n} families… · Keep this window open until it finishes. | "You can't send twice" returns only if the build guarantees it. |
| Result | Reached {x} of {y} families · {n} didn't go through. See them · This send is in the season's history. | "Reached x of y" is the wording every other send already uses. |
| Couldn't send | Couldn't send · Nothing was sent, and no family was marked as told. Check your connection and try again. · The practices are still handed out. · Close · Try again | Foot replaces "You haven't lost anything." |
| Changed while looking | This changed while you were looking · The list of families changed, so nothing was sent. Review it and send again. · Nobody was emailed. · Review the list | The drawn "3 more families" assumed the list grew. |
| Everyone told | Everyone has been told · {name} sent the practice times to {n} families on {date} at {time}. · The reminder on the schedule is gone. If you hand practices out again, this step reopens for the teams whose practices change. | |
| Teams with no practices | {a} of {b} teams have practices. {n} families haven't been told. · {Team names} {has/have} no practices handed out, so their {m} families aren't included. Hand them out, then tell those families. · Hand out for them | Keep as drawn, placeholders only. |

## B. Hand out again, and the reminder

| String | Final words | Note |
|---|---|---|
| Re-hand-out confirm | Hand out {n} practices a week again? · {a} teams' families were already told their practice times. Handing out again replaces those teams' upcoming practices. · {c} teams' practices change. {u} team's don't. · You'll choose whether to tell those families next. · Nobody is emailed until you press Send. · Keep what's there · Hand out again | The drawn single date "on Wed, Jun 16" is untrue when teams were told on different days. |
| Changed-mode step (c2) | Tell the families about the changes · {a} teams' practices changed. {n} families who were told will get the change. {b} teams haven't been told yet, so their {m} families get their practice times for the first time. · Each family gets one email, sent now. It doesn't count toward {cap noun}. | The Now/Was rows are the built 11b ones. |
| The reminder | {n} teams' families haven't been told · Tell them | Singular: "1 team's families haven't been told". |

## C. The family's first practice email (no link, no button, no unsubscribe)

| String | Final words | Note |
|---|---|---|
| Subject | {Team}'s practice times (two or more: Practice times for {A} and {B}; three: {A}, {B}, and {C}) | Matches "practice times" everywhere else. |
| Greeting | Hi {first name}, ("Hi," with no name) | See Q5 for a second parent. |
| Intro | Here are the practice times for {season}. Every date is listed, because the time can change from week to week. | The drawn sentence described the club's rotation, which a family does not need. |
| Part heading (bold) | {Child}'s practices with {team}: | Same opening as the built change email. |
| Date line | {Wed, Jun 23}, {time range} · {venue} · {facility} | Built with the same date and range helpers as the change email. |
| A household with one told team and one new team | Told team's part: "{club} changed {Child}'s practices with {team}, from {date}:" then Now/Was lines. New team's part: "{Child}'s practices with {team}:" then every date. Subject: Practice times for {A} and {B}. | The drawing named this case without wording it. |
| Close | Questions? Ask {team}'s coach. (two teams: Questions? Ask the {A} or {B} coach.) | Built `familyClose`, kept. |
| Footer | Sent by {club} because your family is registered in {season}. Times in {zone}. | Built, kept. |

## D. The coach's copy

| String | Final words |
|---|---|
| Subject | {Team} families were sent their practice times |
| Greeting | Hi {first name}, |
| Body | {club} emailed {n} {team} families their practice times today. The email lists all {k} dates, and the same dates are on your team page. |
| Link | Open {team}'s team page → |
| Footer | You're getting this because you coach {team} in {season}. |

## E. Coach page lines and the history row

| String | Final words | Note |
|---|---|---|
| Told | Families were told these practice times on {date}. | Keep as drawn. |
| Not told yet | Families haven't been told these practice times yet. A club admin or league admin sends them. | Helper wrote "Only the league admin can send them"; owners and club admins can too (gate table), so it names both. |
| Told different times | Families were told different times on {date}. They haven't been sent these times yet. | States the gap, promises nothing. |
| No practices yet | No practices yet. Nobody has handed any out. | Practices come from Practice time, not from publishing the game schedule. The build checks the cause before this ships. |
| History row, kind | Practice times sent: {division} · tag "Automatic" | Same pattern as "Practices changed: {division}". |
| History row, body | FieldLogicHQ sent this when a league admin told {division}'s families their practice times: one email per family, about their own children's teams. Automatic emails don't count toward {cap noun}. | |

## F. The coach's Subscribe

The window reuses the built, signed-off words (title, lead, "Your link", "Yours alone", "How often", "Read by your calendar today", Done). **Do not fork them.**

| String | Final words | Note |
|---|---|---|
| Button | Subscribe (phone mark: accessible label "Subscribe in your calendar app") | The phone mark needs a name for a screen reader. |
| "What's in it", desk | This season's games and practices. Cancelled events stay, marked. A game appears once {division}'s schedule is published, and a change to a game appears once the league admin sends it. | The only new house-league sentence in the window. |
| "What's in it", phone | This season's games and practices. Cancelled events stay, marked. When the season closes, its events leave your calendar. | Keep as drawn. |
| Reset | Reset your calendar link? · The calendar you added it to stops updating, and {team}'s events leave it the next time it checks. Subscribe again with the new link. · Cancel · Reset the link | The built shared Reset; see Q2. |

## G. The moved-child block (new, in the 9c·12 "new team" email)

Current email, kept: subject "{Child first}'s new team — {season}"; heading "A new team for {first}"; "{Child} has moved from {from} to {to} in {division}."; coaches line; button "See your registration".

| String | Final words | Note |
|---|---|---|
| Block under the coach line (only when the new team's practices were handed out) | {First}'s practices with {toTeam}: then every upcoming date, one line each: {Wed, Jun 23}, {time range} · {venue} · {facility}. Then: Times in {zone}. | Same part opening and date lines as the first email. The email gains a time-zone line because it now carries times. No second button. |

The built subject has an em dash. That is existing copy and is flagged only.

## Open wording questions, with a recommendation

1. **What "doesn't count" counts.** The drawing says "your sends"; the built history bodies say "the season's cap"; the c6 caption says typed sends a day. *Recommendation:* "It doesn't count toward your {n} emails a day." — one noun in the Tell step, the changed-mode step and the history body. The build checks the number comes from the real cap.
2. **Reset: "Cancel" or "Keep it".** *Recommendation:* keep the built shared "Cancel". Changing it means changing the rep coach's window too, for no gain.
3. **Name the coach in the family email.** *Recommendation:* keep the built close ("Ask {team}'s coach") with no name. The club decides whether a coach's name is shown, and an email must not override that. The placement email names coaches only because of that policy.
4. **Single-team close.** The built form reads "Ask Reds' coach."; the two-team form reads "Ask the Reds or Blues coach." *Recommendation:* keep both as built; unifying them touches the built change email.
5. **A second parent's greeting.** One registration, two addresses, one first name. *Recommendation:* the first address reads "Hi Sarah,"; the second address reads "Hi," because the sign-up asks for that address only, not a name.
6. **"You can't send twice" and the "Automatic" tag.** Restore the sentence only if the build guarantees one send per household. A hand-pressed send is tagged "Automatic" in history; that is ruled and matches 11b.
