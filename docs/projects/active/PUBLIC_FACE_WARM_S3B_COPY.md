# The public face, warm: S3b family-email copy (the `/marketing` pass, Step 0)

> **Written 2026-10-23.** The eight draft lines were ruled by `/marketing` the same day, on the drawings page
> (https://claude.ai/artifact/Q77tjshN7iDMf4hGMM9HS5); the owner then took **all nine asks as recommended** (2026-10-23).
> **Words only.** The look is `PUBLIC_FACE_WARM_S3B_BUILD_PROMPT.md`'s job. **How the build uses this:** it applies every
> line marked **Approved** and leaves every line marked **Held** exactly as it is today. Anything not in this file keeps its
> current wording. Two lines below were added by the drafting session after `/marketing`'s pass and are marked **To confirm**:
> the build's `/marketing` check rules on them before they ship.
>
> Rules applied: `BRAND_STRATEGY.md` (practical, direct, warm; never claim Canadian identity), `VISUAL_IDENTITY.md` P2
> (sentence case), P4 (no arrow), P8 (say what happened), house spelling and the house clock ("8:00 a.m."). None of the
> strings below holds a clock time.

`{Club}` is the club's name as the club typed it. `{Player}` is the child's **first name only**, never a surname or a date of
birth. `{season}`, `{team}`, `{year}` are the names already on the record.

## Summary

| # | Line | Verdict |
|---|---|---|
| 1 | Inbox sender name | **Approved** |
| 2 | Foot of the card | **Approved**, reworded by `/marketing` |
| 3 | Reply line, a named sender | **Approved**, with the fallback |
| 4 | Reply line, nobody reads replies | **Approved**, reworded by `/marketing` |
| 5 | Reply line, the club has a public contact | **Approved** |
| 6 | Eyebrow on an org-wide email | **Approved** (dropped when it repeats the band) |
| 7 | Tryout receipt footnote | **Approved** |
| 8 | Registration footnote | **Approved** |
| 9 | Declined email's contact line | **Approved** |
| 10 | The seven house-league headlines | **Approved** (Ask 9 A); one **To confirm** |
| 11 | The game-change link | **Approved** (Ask 9 A) |
| 12 | The sender name when the club's name is unusable | **To confirm** |
| — | "Sent by {club} because {reason}.", "Unsubscribe from {club} emails", the dues "sent even if you have unsubscribed" sentence, "FieldLogicHQ · Canada" | **Held**, untouched |

---

### 1. Inbox sender name

**Today:** `FieldLogicHQ`, for every email.

**Approved (family emails only, groups A and B):** `{Club} via FieldLogicHQ`, for example `Riverdale Minor Ball via FieldLogicHQ`.

Cleaning rules (the club name is free text typed by a club admin, so it is cleaned before it goes in a header): remove
double quotes, angle brackets, `@`, commas, semicolons, colons and backslashes; remove control characters and line breaks;
collapse runs of spaces; trim. **Cap the club part at 48 characters, ending with an ellipsis if it is cut**, so
" via FieldLogicHQ" is never the part that is lost. "via FieldLogicHQ" is **always** present: the club name is never the
whole sender name (a club could otherwise imitate any organization it likes). The verified sending address does not change.
Every other email the platform sends keeps `FieldLogicHQ`.

### 2. Foot of the card

**Today:** the FieldLogicHQ name line at the top of the card, no words.

**Approved:** `Sent through FieldLogicHQ, the software {Club} uses.` The name line inside it stays Arial text, no image
(`VISUAL_IDENTITY.md` section 3), 12 px, on its own quiet line under the club's paragraph. `/marketing`: a parent has never
heard of FieldLogicHQ, and one clause answers "who are these people?". "Through" here, "via" only in the sender name. Do not
merge this with "Sent by … because …": that sentence is a legal piece and does not move.

### 3. Reply line, a named sender

**Approved:** `Reply to this email to reach {name}.` where `{name}` is the person who sent it (the coach, the registrar).
**Fallback** when the build cannot name them: `Reply to this email to reach the sender.` Used on the emails a person sends and
that reply to that person: "Email families", "Message this family", the rep-team announcement, the house-league season email.

### 4. Reply line, nobody reads replies

**Today:** nothing.

**Approved:** `Replies to this email won't reach anyone. To get in touch, contact {Club} directly.` Used on system mail whose
club has **no** public contact set up: the game-change notice, the dues reminders, the tryout receipt, the seven registration
emails. (`/marketing`: "are not read" read as a rebuke; this states the fact without blaming the parent.)

### 5. Reply line, the club has a public contact

**Approved:** `Reply to this email to reach {Club}.` Used **only** when the email's Reply-To really is the club's public-site
contact address (Ask 4 A). It is a promise that someone reads that inbox: that is the club's to keep, not a copy question.

### 6. Eyebrow on an org-wide email

The small bold line above the headline names whose message it is. When it would repeat the club's name (Email families and
Message this family set the eyebrow to the club's name), it is **dropped**: the band already says it. A team or season name
(the rep-team announcement, the season email, the game-change notice) stays.

### 7. Tryout receipt footnote

**Today:** none (the email names no club).

**Approved:** `Sent by {Club} because {Player} applied for a tryout with {team} {year}.`

### 8. Registration footnote (all seven)

**Today:** none.

**Approved:** `Sent by {Club} because {Player} was registered for {season}.` The passive is accurate whether the parent or the
club did the registering. Used on: approved (both senders), pending, waitlist (both senders), promoted, declined.
No unsubscribe line and no "sent even if you have unsubscribed" sentence on these: they are account notices and were never on
the unsubscribe list. (If the owner later wants one, that is a legal question for `/strategy`, not copy.)

### 9. The declined email's contact line

**Today:** `Please contact fieldlogichq@gmail.com for more information.` (the platform's own inbox: nothing fills the club's
address).

**Approved:** `Please contact {Club} for more information.`
**When the club has a public contact:** `Please contact {Club} at {address} for more information.` The address goes before
"for more information", never after. The address is a link.

### 10. The seven house-league headlines (Ask 9 A)

Sentence case, no emoji. Subjects are already sentence case and do not change.

| Email | Today | Approved |
|---|---|---|
| Approved (public) and admin approved | `✅ Registration Approved!` | `Registration approved` |
| Pending | `Registration Received` | `Registration received` |
| Waitlist | `You're on the Waitlist` | `You're on the waitlist` |
| Admin waitlisted | `Added to Waitlist` | `Added to the waitlist` — **To confirm** (adds one article; `/marketing` has not seen this line) |
| Promoted | `🎉 You're Off the Waitlist!` | `You're off the waitlist` |
| Declined | `Registration Update` | `Registration update` |

The sentences under the headlines do not change in this build. Help articles, `keywords` and `searchText` that quote a
headline change with it (search `lib/help-content` for each old string).

### 11. The game-change link (Ask 9 A)

**Today:** `See the full schedule →`  **Approved:** `See the full schedule`. It stays an olive text link, not a button.

### 12. When the club's name cannot be used for the sender name

**To confirm.** If cleaning leaves nothing (a name made only of removed characters), the sender name is `FieldLogicHQ`
and the band and footnotes still use the club's name as typed. This is a defensive default, not a design; `/marketing` can
rule on it in passing.

---

## Not changed by this file

The "Sent by {club} because {reason}." sentence and "Unsubscribe from {club} emails" (the family footer words in
`lib/family-mail-footer.ts`), the dues reminder's "sent even if you have unsubscribed" sentence, "FieldLogicHQ · Canada"
(held until the owner gives a mailing address), the body sentences of every email, and every tournament, coach, billing and
platform email.
