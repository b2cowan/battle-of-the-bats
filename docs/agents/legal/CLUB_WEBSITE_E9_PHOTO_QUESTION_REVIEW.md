# The one photo question, for teams and for camps (Club Website ask E9)
**Last verified:** 2026-11-25
**Re-verify by:** 2027-11-25, or sooner on any of: the Stage 3 (photo shelf) build prompt; the Board Ready Stage 7 (camps) build prompt; the family app (guardian tier) switched on; the first Québec club; Bill C-36 passing second reading; the Québec statute text read from the primary source.
**Depends on facts:** FieldLogicHQ is a service provider to the club for children's information; the club decides to publish and is responsible for consent; the guardian tier is switched off; a camp sign-up has no account (it is the "Your sign-up" link page); the published Privacy Policy and Data Terms are version 2026-11-24 and say children's information "is never shown on public pages".

Not legal advice and not reviewed by a lawyer. Research and a recommendation. No professional review is a gate (owner 2026-10-31, 2026-11-04). Builds on `MINORS_IMAGES_AND_CLUB_FEED.md` (2026-11-24) and `CLUB_WEBSITE_STAGE0_RULINGS_REVIEW.md`; nothing there is re-researched. The law below is from those files' primary reads, except the Québec statute, which is still not opened.

## Question(s) this answers
Owner ruling E9 (2026-11-25, option A): the club website's Stage 3 owns ONE photo question for every club; camp and clinic sign-ups (Board Ready Stage 7, 12A) ask it in the same words; a photo filed under a camp follows the team rule, using the camp's sign-up list. Left to `/legal`: (1) required or optional; (2) shape and exact words, who answers, what yes permits, what silence means; (3) changing your mind, and what the club does with photos already out; (4) is a camp yes the same consent as a team yes; (5) what PIPEDA, Québec Law 25 and Ontario change; (6) what our Privacy Policy, Data Terms and Terms must say.

## Finding

**1. Required or optional: optional, with two choices and neither picked. Silence is no.**
- The law's test is the same either way: sensitive information (a recognizable child's photo, OPC #2025-005 para 18) needs express opt-in (Schedule 1, 4.3.6), and a photo release as a condition of service is the breach the OPC found (4.3.3). Both "must pick yes or no" and "may leave blank" pass, provided a no or a blank costs nothing and a blank is never read as yes.
- Optional is better on the merits: the 2026-11-24 drawing's asterisk was read as pressure by two reviews; a forced pick can stop a paid camp sign-up at the last box; Board Ready 12A already ruled "optional, can't be made required"; and one question in the same words everywhere should behave the same everywhere. What optional costs: "no" and "didn't answer" look the same to the club. That is acceptable, because both mean no photo, and the family's own page can still say "You haven't answered" and offer the change.
- **This reverses one line in the Stage 0 drawing** (the required asterisk and the helper line "Choose either one."). It does not reverse any owner ruling; E9 left it to us.

**2. Shape, words, who answers, what yes permits.** See "The words" below.
- The **guardian** answers. The camp form starts with the fixed line "I am this child's parent or legal guardian, or have their authority", and the photo question sits after it (the camps drawing has them the wrong way round). The OPC's line is under 13 always a parent, in all but exceptional circumstances; its Children's Privacy Code covers everyone under 18. So the rule is: the guardian answers for every minor. The words say the participant's first name, not "child", so the same words read right for an adult camper.
- We do not verify who ticked. Same as every sign-up answer and the guardian line; the club's responsibility, and a lawyer's question (flag 3).
- **What yes permits:** the club may show photos of that person **from that team or camp**, on **the club's public website** and on **the club's own social media pages**, where anyone can see them. Naming both places is deliberate: the club's admin already confirms "nobody in this post said no" before showing an Instagram post (ask A16), and that attestation means nothing if the family was never asked about social media. Meaningful consent names the places. A yes never covers: sponsor placements, posters, share images, downloads (appropriation of personality; the 2026-11-24 rule stands), or anything under a name. **Owner call O2.**
- **Silence or no** means: no photo showing the person is shown by the product; the person can be in a crowd shot only if the club files that photo under no team/camp, where, as ruled, no recognizable player shows at all.
- A club's own written yes keyed in from paper stays allowed (2026-11-24 lean), marked "recorded by the club" with who and when, for camps too.

**3. Changing your mind.**
- The family changes the answer on **Your sign-up** at any time the link works. Today a family can change answers only "until that child's teams are made" (`lib/help-content/house-league.tsx:377`, and the same help at 417). **This one answer must be exempt from that lock**, or the family loses the right to withdraw exactly when photos start appearing. A change from yes to no and from no to yes both ask a short confirm that states what happens.
- **On the club's website:** a no, or a blank, hides the photo on the next page view (the rule is checked every time the page is served, as ruled 2026-11-24). Immediate, no club action.
- **On the club's own social media:** the product cannot see or delete a post there. The club must take it down; our wording promises only that the club will, and the Terms put that duty on the club (item 6). The Stage 3 "photos that mention this camp or team" list should show the admin the posts to remove (those the product knows of: shelf photos marked "posted to social").
- **Stored copy on the shelf:** hidden, not deleted, until the club deletes it or the 12-months-unused clock runs (4.5.3). The admin gets a one-tap "Delete". What no wording can do: recall copies other people saved or shared. The question says so (4.3.8: tell the person the implications of withdrawing).
- **Where the link is dead** (a finished season's link stops working; a lost email): a parent writes to the club. The public page's line "Want a photo taken down? Contact {club}" and the admin's "Take down" (findings F1, F2 below) are the route. A club-recorded change is marked as such.
- No number of days is set by PIPEDA for acting on a withdrawal; "straight away" on the website and "promptly" for social is the standard to hold.

**4. A camp yes and a team yes are two consents.** Same words, each answered separately, each kept on the sign-up it was given on and read only for that program. Reasons: consent must be for a specific purpose and time (Schedule 1 4.3.2, 4.2.4; Québec Law 25 asks for consent "for each purpose", see 5); a camp is a different group on different days, often a different mix of families; a camp family may say no to a camp and yes to a team, or the other way round; carrying a yes forward silently is the weaker choice (2026-11-24). The only difference in the words is the name of the program ("from the 2027 Spring Camp", "from the U12 Bats"). A camp child on a team photo, or the reverse, is not governed by either answer: the photo is filed under one program, and every player the club says is in it must have a yes from that program. A returning camper is asked again at the next camp sign-up. A club-wide standing answer is a family-app idea, not now.
- Only an **accepted** sign-up's answer counts. A waitlisted, declined or withdrawn child has no sign-up on the list, so no photo of them shows.
- No account is no obstacle: the answer sits on the sign-up row, written through the Your sign-up link door, the same one used for other answers (`lib/club-form-family-route.ts:14`).

**5. The law, the parts that matter here.**
- **PIPEDA:** a recognizable photo of a child is personal information, treated as sensitive; express opt-in; withdrawable (4.3.8); the club carries the consent duty; our own commercial activity is covered so we design to PIPEDA whatever the club's status (2026-11-24). Whether a non-profit club's own page is "commercial activity" is still uncertain.
- **Québec Law 25** (statute text not opened; read earlier through the CAI guideline 2023-1): a child under 14 consents through the holder of parental authority; 14 and over may consent themselves or through the parent, so a guardian's yes still works. As I understand the Act, consent must be requested "separately from any other information", for each purpose, in clear and simple terms; that favours this question being its own box and not inside a waiver. Québec payouts are refused and no Québec club exists, so this is only a re-read trigger, but an Ontario club's camp can enrol a Québec child. The right to one's image (Civil Code arts. 35–36, *Aubry*) is also not opened.
- **Ontario:** no provincial private-sector privacy statute; no statutory age of consent for a photo. Common-law exposure is low for a team photo (Jones v. Tsige) and highest for use in advertising (appropriation of personality). So nothing in Ontario changes the answer, and nothing weakens it.
- **Not law, but the norm sport bodies hold:** explicit prior consent from the participant and, where fitting, the parent before posting (SDRCC template). The words also say a young person who does not want their photo shown should tell the coach; the club honours it (a help line, not a field).

## What the product does today
- **No built-in photo question exists.** Club plan line 179: "No photo consent is asked anywhere"; the only consent scopes written are `marketing` and `child_data` (`lib/org-people.ts:59`, `:94`; `lib/family-invitation.ts:175`).
- **A club can build its own photo question today, and make it required.** A yes/no question type exists (`lib/club-form-signup.ts:109`, `:148`), has a required flag (`:28`) and a required question must be answered (`:178`). A required "photo yes/no" is not what #2025-005 found against (that was a release as a condition), but a required "photo release" document is, and the product currently suggests one: `lib/help-content/house-league.tsx:335` ("a waiver, a code of conduct and a photo release. Every document is required."), with the keyword 'photo release' at `:266` and `:1369`. (F4 in the 2026-11-24 review.)
- Families change sign-up answers only until teams are made (`lib/help-content/house-league.tsx:377`).
- The camp form (Stage 7) is **not built**; 12A and the camp review's item 8(c) (`BOARD_READY_STAGE5_7_EVENTS_CAMPS_REVIEW.md`) already ship it as an optional yes/no with "required" refused in the builder.
- No code records a withdrawal of any consent (2026-11-24 F1); there is no take-down route (F2).

## The words (for the build; not yet owner-approved)
`{Name}` is the participant's first name, `{Club}` the club's name, `{Program}` the team's or camp's name. Fixed words: the club cannot reword them (a club that rewrote "yes" to reach sponsor ads would stretch the consent). The answer stores the exact sentence and its version (no IP, like the other sign-up ticks).

**Heading:** Photos of {Name}

**Question:**
{Club} would like to show photos of {Name} from {Program} on its public website and on its own social media pages, such as Instagram or Facebook. Anyone can see those pages. {Club}'s website never puts {Name}'s name beside a photo.

( ) Yes, {Club} may show photos of {Name} from {Program}.
( ) No, please don't show photos of {Name}.

**Help line under it:** This is your choice and it has no effect on {Name}'s place. If you leave it blank, the answer is no. You can change it any time on Your sign-up. If a young person in a photo does not want it shown, tell the coach or the club.

**Your sign-up row:** Photos of {Name} · Yes / No / Not answered (counts as no) · Change

**Change to no (confirm window), "the no / withdraw wording":**
Title: Stop showing photos of {Name}?
Body: {Club}'s website stops showing photos of {Name} from {Program} right away. {Club} will take down any it posted on its own social media pages. Copies that other people have already saved or shared can't be taken back.
Buttons: Stop showing photos · Keep it as it is

**Change to yes (confirm window):**
Title: Allow photos of {Name}?
Body: {Club} may show photos of {Name} from {Program} on its public website and on its own social media pages. Anyone can see them. You can change this any time.
Buttons: Allow photos · Not now

**Saved no:** Photos of {Name} are not shown. You can change this any time.

**Public page line (for a parent with no link):** Want a photo of your child taken down? Contact {Club}.

## What changes for Board Ready's camp form
1. Drop 12A's own photo question. The camp form carries the Stage 3 built-in, in these words, with only the program name filled in.
2. Order: the fixed guardian line first, then the photo question (the drawing has them reversed).
3. Still optional; the builder still refuses "required" on it; fixed words, not editable.
4. Stored on the camp sign-up, per child per sign-up (not per session), and written and changed through the same Your sign-up door.
5. Exempt it from the "answers closed" lock.
6. No "photo release" document suggested for camps.
7. **Safe fallback if Stage 7 builds before Stage 3:** ship the camp form with no photo question. A missing answer is no, so no camp photo can show until the question exists; adding it later puts a "Photos" row on each Your sign-up that families can answer then. Nothing needs to wait, and nothing can leak.

## Recommendation (what the owner decides)
**Ruled 2026-11-25: all five as recommended, no notes** (asked as P1–P5 on the club website's events drawing; O1 = P1 … O5 = P5; record in `CLUB_WEBSITE_ENHANCEMENTS_PLAN.md` §7, ask E9). The ruling settles the five calls below; the exact words in "The words" were not on the asks and are not part of it.
- **O1.** Optional, neither chosen, blank = no (recommended). Alternative: required pick, which the OPC finding allows but two reviews felt as pressure.
- **O2.** One yes covers the website and the club's own social media pages, both named (recommended). Alternative: website only, which makes the A16 attestation about Instagram posts unsupported by what the family was told.
- **O3.** Camp and team yes are separate answers (recommended). Alternative: one club-wide answer, which belongs with the family app.
- **O4.** The photo answer stays changeable after the "answers closed" lock, for as long as the link works, and a club may record a written change marked "recorded by the club" (recommended).
- **O5.** The words are fixed and versioned per answer; the club cannot edit them (recommended).

## What our documents must say (item 6)
All of this is part of the one new Privacy and Terms version already owed before any player photo (the 2026-11-24 review's list); this review adds only the camp and withdrawal pieces. **Most likely a material change** (a new kind of information and public use): the version session reads Terms §18 and Privacy §13 for notice.
- **Data Terms lines 38 and 138 and Privacy line 221** ("never shown on public pages"): the one exception, now worded to include a camp: "A photo is the one exception. Your organization may choose to publish a photo filed under a team or a camp; we show it only while the parent or guardian of every person your organization says is in it has said yes for that team or camp, we never put a name with it, and it comes down when an answer changes."
- **Privacy §3, §5, §9:** the photo answer is recorded with the sign-up (the sentence shown, its version, the time, who it was recorded by, which can be the club); a family changes it any time on Your sign-up; it is kept as long as the sign-up and removed with it; uploaded photos are re-saved without location data; unused photos are kept at most 12 months (the owner's number).
- **Data Terms §12 (sign-up answers):** adds the photo answer; **the club's duties:** ask only through the built-in question, never make it a condition of signing up, take down posts it made elsewhere when an answer changes, and use an answer only for the program it names.
- **Terms "Public pages" (line 75) and "Your responsibilities":** photos added to the examples; the club is responsible for who is in a photo it publishes and for removing its own social media posts when asked.
- **A promise to stay clear of:** the question says the club "will take down" what it posted on its own pages. We can only state that on the club's behalf, backed by the Terms duty above; the product must not suggest we do it.
- Privacy §4 and the subprocessor list: no change for the club's own social posts (outside our product); the Instagram embed shape is unchanged from the A12 ruling (the club's picture from our copy plus a plain link).

## Findings for `/plan` (new or sharpened)
- E9-1. The photo answer must be changeable after "answers closed" and while the link works, and a changed answer must hide on the next page view (extends F1).
- E9-2. A finished season's link ends, so a parent with a camp photo and no link needs the public "contact the club" line and the admin "Take down" (extends F2).
- E9-3. A club can make its own photo yes/no required today, and the help text still suggests a required "photo release" document (F4 stands; apply when the built-in question ships).
- E9-4. The answer is stored with the exact sentence and version; "recorded by the club" is a marked source.

## Sources
- Everything in `MINORS_IMAGES_AND_CLUB_FEED.md` § Sources (PIPEDA text, OPC #2025-005, OPC consent guidelines, Children's Privacy Code, CAI Lignes directrices 2023-1, Jones v. Tsige, SDRCC template) — accessed 2026-11-24, not re-opened.
- **Not opened (the site refused again 2026-11-25, legisquebec.gouv.qc.ca):** the Québec private-sector Act ss. 4.1, 8.1, 14; Civil Code arts. 35–36; *Aubry*. The Québec points above rest on the CAI guideline and my recollection of the statute; re-read before the first Québec club.

## Lawyer's eye needed?
Yes, one list, before the photo shelf ships:
1. **One yes for the website and social media:** whether naming two places in one optional question is meaningful consent for a minor, or two questions are safer.
2. **The club's promise to remove its own social posts** on withdrawal, said in our words on the club's behalf, and what we owe a parent who writes to us and not to the club.
3. **An unverified guardian:** two parents who disagree; a no from either should win (the recommended behaviour, not checked by law); whether a link-holder's yes is enough evidence.
4. **A club-recorded written yes** keyed in from paper.
5. **The material-change route** for the Privacy Policy, Data Terms and Terms (notice, timing, fresh acceptance).
6. **Québec:** a Québec child at an Ontario camp, and the separate-request rule, before the first Québec club.
