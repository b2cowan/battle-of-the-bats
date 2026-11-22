# Milton Bats presentation: the security read (prep page, roadmap commitments, the brief)
**Last verified:** 2026-11-21
**Re-verify by:** the promote that carries the legal-pages switch (every "only after" condition below turns on it), or
2026-12-21 if the meeting has not happened by then; also any change to the support tools' record of pages opened, the
access-sweep follow-ups, or the Q1 export/closure build
**Depends on facts:** `LEGAL_FACTS.md` § Where data lives (2026-11-18 census); `BOARD_READY_DATA_TERMS_REVIEW.md` §5
(W1–W10, verified 2026-11-18); `docs/agents/ops/BACKUPS_AND_RESTORE.md`; `BREACH_PROCEDURE.md`; production = `origin/master`
`f12aad4d9` (the 2026-11-15 promote; `git log origin/master -1`, fetched 2026-11-21)
**Outputs (2026-11-21):** the brief, published privately for the owner to share: https://claude.ai/artifact/2qBeedXuyYTRPs1MEo8TUR
(source `drafts/SECURITY_BRIEF.md`); the prep page corrected in place (version 2,
https://claude.ai/artifact/9RcK5CiWcRuTWW4LiBpyRn: the Security tab, Start here card 5 and the roadmap call, deck slides 2, 7, 8).
The red Draft note is replaced by a "checked by /legal" note: every line left on the tab carries a say verdict (the
do-not-say list is a list of warnings, each verified), and the conditional lines carry their "after …" chip.

## Question(s) this answers
1. Which security and data lines on the owner's Milton Bats prep page (https://claude.ai/artifact/9RcK5CiWcRuTWW4LiBpyRn)
   may be said in the meeting, in what words, and on what condition?
2. Are the public roadmap's four "Your data is yours" commitments true, and in what words may the roadmap slide carry them?
3. What does the leave-behind security brief say (`drafts/SECURITY_BRIEF.md`)?

Not legal advice. This is a check of what the product does against what the page says, plus the law where a line states it.

## Finding

### 0. The disagreements, settled from the source

| Question | Answer | Evidence |
|---|---|---|
| Are the Terms and Privacy Policy on production? | **No.** Published in code only. | `origin/master:lib/legal-pages-switch.ts:24` `LEGAL_PAGES_PUBLISHED = false`; dev `:26` = true. Live fetch 2026-11-21: /legal/terms, /legal/privacy, /legal/data-terms, /legal/subprocessors and /security all 404 on www and apex; the home footer has no Terms or Privacy link. `BOARD_READY_PLAN.md` §0c's "published 2026-11-17" means published **in code**; the prep page was right. |
| Data Terms and the supplier list published? | **No.** Owner-approved 2026-11-18; the pages are built on dev (`804deade0`, 2026-11-19) and render "not found" until their version file exists; they publish with the held Terms version. So **W2, W8, W9 stay conditional.** | `LEGAL_INDEX.md` rows Data Terms / Subprocessor list; live fetch above |
| Two-step sign-in on production? | **Yes** (2026-11-15 promote). The fixed line (`BOARD_READY_PLAN.md` §0c) may be said. Detail: covered people get a 14-day grace period; both club switches are off until the owner turns them on. | Parts 1–4 `7c8f092ab`, `0a0ee533d`, `5a22b498a`, `24e5b9e45` ancestors of `origin/master`; `lib/two-step-rule.ts:29-31,55-78`, `lib/platform-auth.ts:66-86` (staff, no grace) |
| Deleting a club removes its files, on production? | **No.** `45c134bea` is not an ancestor of `origin/master`; production's delete route has no storage code. It rides the next promote. | `git merge-base --is-ancestor 45c134bea origin/master` → no |
| Family card payments on production? | **Off**, twice: `ONLINE_PAYMENTS_ENABLED` unset, and `LIVE_PAYMENTS_ALLOWED = false` under a live key. | `lib/online-payments-switch.ts:21-29`; `GST_HST_STAGE6_TERMS_PLAN.md:239-240` |
| "No public page shows a child's name" | **True on production, re-verified 2026-11-21** (code census of every no-sign-in route on `origin/master`; `/legal` opened the team page and tryout-scorer lines). Club home, teams, team pages (coaches who opt in, never players: `app/[orgSlug]/teams/[teamSlug]/page.tsx:92-93,189`), team calendar feeds, share images (`lib/club-share.ts:9`), every tournament page incl. champions, the public JSON routes, house-league pages (counts only). **Two limits:** (a) what a club types into a free-text field (news, a team description, a game name) shows as typed; (b) **private links** show names to their holder: a family's emailed "Your sign-up" link shows its own children by first name, a volunteer's tryout-scoring link shows candidates' full names unless the tryout is anonymous (`lib/tryout-score-session.ts:65-70`), a pay link puts the child's first name on Stripe's page. No change on dev adds a public name. | helper census 2026-11-21, lines opened by `/legal` |
| W4 assumes families pay online | Families can't pay online through FieldLogicHQ today. Replacement wording in row 13. | above |

### 1. The verdict table — Security tab

Verdicts: **say as is** · **say reworded** · **do not say**. "Rests on" is what makes the line true; "Condition" is what must
happen before it may be said.

| # | Line as drafted | Verdict | Exact wording to use | Rests on | Condition |
|---|---|---|---|---|---|
| **Diagram** | | | | | |
| 1 | Box: "Families, coaches, board · a phone or a computer · two-step sign-in available" | say reworded | "Board, coaches, families · a phone or a computer · two-step sign-in for every account" | two-step on prod (§0) | — |
| 2 | Box: "FieldLogicHQ app · Amazon Web Services · Ohio, United States" | say as is | — | W1; `amplify.yml`; census 2026-11-18 | — |
| 3 | Box: "Database, sign-in, files · Supabase on AWS · Ohio, United States" | say as is | — | W1 (Supabase Management API, us-east-2, read 2026-11-08) | — |
| 4 | Arrow labels "encrypted", "checked", "sign-in and live score updates" | say as is | — | W5; `lib/api-auth.ts` | — |
| 5 | "Every request: signed in, code entered, a member of this club, allowed for this role" | say reworded | "Every request: signed in, second step where on, belongs to this club, allowed for this role" | "code entered" is only true where two-step is on for that person (`lib/api-auth.ts:180-201,259`) | — |
| 6 | "Encrypted at rest by the host · Daily backups, kept 7 days · Private files open by 1-hour links" | say reworded | "Encrypted at rest by the host · Database backed up daily, kept 7 days · Player documents open by 1-hour links" | W5, W7 (files are not in backups, so "database"); every `createSignedUrl` = 3600 s on prod (rep-team documents, permits) | — |
| 7 | Email box: "Resend, United States · Receives: names, addresses, the message itself" | say as is | — | census `lib/email.ts:34,155` | — |
| 8 | Payments box: "Stripe · Card details are typed on Stripe's own page and never reach us" | say reworded | "Stripe · Card numbers are typed on Stripe's own page and never reach us" | hosted Checkout and portal only, no card fields on `origin/master`; Stripe returns brand and last 4 digits, which we keep, so "card numbers", not "card details" | — |
| 9 | Phone-alert box: "the phone maker's push service · Receives: the device address; the alert is encrypted to the device" | say reworded | "the browser's own push service · Receives: a device address, and the alert, sealed for that device" | `origin/master:lib/web-push.ts:80-92`, `web-push` 3.6.7 aes128gcm (RFC 8291); the service is chosen by the browser (Apple, Google, Mozilla), not only "the phone maker" | — |
| 10 | Caption: "Nothing goes to advertisers, analytics companies or AI services, because the product uses none. Family card payments are switched off today." | say reworded | "Nothing goes to advertisers or analytics companies, and your club's information is never given to an AI service. Families can't pay online through FieldLogicHQ yet." | W3 (incl. its AGENCY_RULES condition); payments switch (§0) | W3 holds only while the AGENCY_RULES production-rows rule stands |
| **Four checks** | | | | | |
| 11 | "Signed in. Passwords are handled by the sign-in service, never stored by us in readable form." | say reworded | "Signed in. Passwords are kept by our sign-in service, Supabase, only in scrambled form. FieldLogicHQ never sees or stores them." | No app table holds a password; sign-in/sign-up/change all through Supabase Auth (`lib/auth.ts:50`, `app/api/auth/signup/route.ts:194`, `reset-password/page.tsx:162`); Supabase Auth stores bcrypt hashes. Two-step backup codes: salted HMAC under `TWO_STEP_CODE_KEY` (`lib/two-step-codes.ts:49-50`; key set at the Amplify app level, release record 2026-11-15) | — |
| 12 | "Code entered. Two-step sign-in is offered to everyone. A club can require it for its board and coaches. Our staff always use it." | say reworded (to the fixed line) | "Second step. Two-step sign-in is available to everyone, and your club can require it for its board and coaches; FieldLogicHQ staff always use it." | `BOARD_READY_PLAN.md` §0c fixed wording; on prod (§0) | — |
| 13 | "A member of this club. The server confirms the person is an active member of that club on every request." | say reworded | "Belongs to this club. On every request our server checks that the person belongs to this club." | `lib/api-auth.ts:236-244` (suspended → refused by the app; not yet by the database layer, so no "shut out at once", D2). **"Active" is too strong:** the base check lets an invited-not-yet-accepted row through; the role-aware checks require active (`:341-349`), coach routes require a coaching assignment instead (`lib/db.ts:4188-4207`), and the database's own second layer counts only active members from mig 505, not yet on prod | — |
| 14 | "Allowed for this role. A registrar, treasurer or coach sees only their part." | say reworded | "Allowed for this role. A registrar, treasurer or coach sees only their part, and that is enforced on our server, not in the browser." | `lib/roles.ts:40-95,151-163`, `requireCapability` `lib/api-auth.ts:443`; build guard `tests/unit/admin-reads-capability-guard.test.ts`; Data Terms §8 bullet 1 | — |
| **Safe to say** | | | | | |
| 15 | "We never sell your club's information or use it to advertise. There are no ad or analytics trackers in the product." | say reworded (to W3) | "We never sell your club's information or use it to advertise. We don't use advertising trackers, third-party analytics or an outside error-monitoring service." | W3; tracker census `origin/master` 2026-11-21 (none; error capture is our own database) | — |
| 16 | "The product sends nothing to an AI service, and our working rule bars AI assistants from reading anyone's personal records." | say reworded (to W3) | "Your club's information is never given to an AI service." | W3 (widened 2026-11-18); `AGENCY_RULES.md` (counts and schema only). Don't add the second clause: it invites "so AI does read your production database?", and the true answer is a rule, not a lock. Do not imply the whole supplier chain is AI-free (Resend's own sub-processors name two AI companies) | Only while the AGENCY_RULES rule stands; if relaxed, fall back to "FieldLogicHQ sends nothing to an AI service" |
| 17 | "Your information is encrypted in transit, and our database host states AES-256 encryption at rest." | say as is | (or W5: "Information is encrypted in transit, and our database host encrypts everything it stores (AES-256).") | W5 | — |
| 18 | "Card and bank details never reach us. Payment happens on Stripe's own page." | say reworded | "Card numbers and bank details never reach us. When you pay for FieldLogicHQ, you pay on Stripe's own page. Families can't pay online through FieldLogicHQ yet; when your club turns that on, they'll pay on Stripe's page into the club's own Stripe account. Stripe states it is certified PCI Service Provider Level 1." | W4 adapted; payments switch (§0) | Do not say "families pay on Stripe's own page" in the present tense until family payments are on in production |
| 19 | "Player documents sit in private storage and open only through short-lived links." | say reworded | "Player documents are stored privately and open only through links that expire after one hour." | Private buckets: `rep-team-documents`, `org-permit-documents`, `tournament-registration-files` (all `public:false`), every signed link 3600 s; no child's document reachable by a public URL. Limit: a club's own **Rules** page files and logos are public by design | — |
| 20 | "Daily backups, kept 7 days. We rehearsed a full restore on Nov 18." | say reworded (to W7) | "Our database is backed up daily, and each backup is kept 7 days. We rehearsed a restore from a backup on November 18." **If asked about files (added 2026-11-21, owner ask):** "Uploaded files aren't in those backups. We keep no backup copy of them, so a file that's deleted or replaced can't be brought back; keep your own copy of anything you can't do without. It also means a deleted file doesn't linger in a backup of ours." Never "redundant" / "several copies": the host states no durability for files | `BACKUPS_AND_RESTORE.md:9-31` and its "Uploaded files" section (passed 2026-11-18, a production backup restored to a new project, counts matched). Not "full": uploaded files are not in the backups and were absent from the copy | — (the 2026-11-16 rule "restore rehearsed only after a rehearsal" is met) |
| 21 | "A full access review in November found nothing that reads another club's people, with its fixes live." | say reworded | "In November we reviewed, route by route, who can see and change what in every club. It found nothing that lets one club see another club's people. Its serious and medium findings are fixed in the live product, and the smaller follow-ups go out with our next release." | Third sweep 2026-11-10 (`BOARD_READY_PLAN.md` §0a: 2 serious, 5 medium, ~25 small; "nothing reads another club's people"); fixes A–E all in `release/2026-11-15`; the 2026-11-18/19 follow-ups are dev-only; two P8 owner calls unruled (`BOARD_READY_ACCESS_SWEEP_3.md:81-84`). "Full" is fair only across all three sweeps (2026-10-16 ×2 covered the rest), so the line says "every club", not "full". One serious finding was a **cross-club write** (any signed-in account could replace any club's rules files): the line says "see … people" exactly so it doesn't overreach, and the owner should know it if asked "did it find anything serious?" | "every finding resolved" (call 22) only after the follow-ups are on production; "every finding fixed" never until roadmap §4 item 5 is met |
| 22 | "Friend requests are deleted when the season ends." | say reworded | "The friend requests families type on a house-league sign-up are deleted when the season is marked finished, or at the latest 60 days after its last day." | migs 471/472 applied to prod 2026-11-15 (trigger on finish + nightly backstop) | — |
| 23 | "Every record our staff open in our support tools is logged, and that log cannot be edited." | say reworded (to W10, narrowed) | "Our support tools log each club and person record our staff open, and keep a permanent record of every change they make." | **"cannot be edited" is false for the opens log**: `platform_record_opens` grants UPDATE/DELETE to the server, no trigger, kept 90 days, best effort and silent on failure on prod (`365_…:309-310`, `lib/platform-record-opens.ts:9-16`). The **change** log is append-only (`429_the_change_log_cannot_be_edited.sql`, triggers block UPDATE/DELETE/TRUNCATE, on prod). List views, feedback, early-access leads and exports are not in the opens log. Never "all staff access is logged" (direct database access is outside it) | — |
| 24 | "Our hosts hold SOC 2 Type 2 certifications. Those are theirs, not ours." | say reworded (to W6) | "Our database host states SOC 2 Type 2 and ISO 27001; our email provider states SOC 2 Type II. These are their certifications, not ours." | W6 (AWS's scope was not readable 2026-11-18, so "our hosts" claims more than was checked) | Second sentence always goes with the first |
| **Do not say** (each a correct warning; verdict on the warning) | | | | | |
| 25 | "Hosted in Canada" / "data stays in Canada" | keep (correct) | — | W1; ruling 0b | — |
| 26 | "Certified", "audited" or "pen-tested" about FieldLogicHQ itself | keep | — | no own certification; pen test out of scope 2026-11-15 | — |
| 27 | "End-to-end encrypted", or that medical notes have their own encryption | keep | — | W5 is host-level encryption only | — |
| 28 | "Our published policy says", until the Terms and Privacy pages are on production | keep (now confirmed) | — | §0 | lifts at the promote |
| 29 | "72-hour breach notice", until the Data Terms are published | keep | (after publish: W8, "If something goes wrong with your club's information, we tell your club's owners within 72 hours of confirming it touches your information, and help you tell your families.") | W8; `BREACH_PROCEDURE.md` §3 step 4 already holds the 72 hours internally | lifts when the Data Terms publish |
| 30 | "Your files are backed up" | keep | — | `BACKUPS_AND_RESTORE.md:15-16` | — |
| 31 | "Every finding fixed". Say "with its fixes live". | keep, sharpened | Say row 21's wording | roadmap §4 item 5; sweep call 22 | — |
| 32 | "Export everything with one button" (Q1 2027) | keep | — | roadmap: "One-button export of everything, and club closure · Not started"; backlog L10 | — |
| 33 | "Deleting your club removes every file". Not on production yet. | keep (confirmed) | after the promote: "When your club is deleted, its information and the files uploaded to it are deleted, and backup copies are gone within 7 days." | §0 (`45c134bea` not on prod); Data Terms §11. Even then, deleting **one** player or person leaves that item's files (done by hand on request) | lifts at the promote that carries `45c134bea` |
| 34 | *(new)* | add | Do not say "that log cannot be edited" or "every page our staff open is logged". | row 23 | — |
| 35 | *(new)* | add | Do not say "families pay on Stripe's own page" as if it happens today. | row 18 | until family payments are on |
| **If he asks** | | | | | |
| 36 | "Where is our data? … Canadian privacy law allows this when the suppliers are under contract, and they are." | say reworded | "In the United States, in Ohio, with our database host Supabase on Amazon Web Services. Email goes out through Resend, and payments through Stripe. Canadian privacy law doesn't require information to stay in Canada. It requires us to stay responsible for it, protect it by contract with every company that handles it, and say plainly that it is held outside Canada, where that country's courts and authorities can sometimes reach it. Each company that stores or sends your club's information is bound by data-processing terms with us." | PIPEDA Sch. 1 cl. 4.1.3 and OPC cross-border guidelines 2009 (`PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md:17-32`, verified 2026-11-05); DPAs accepted 2026-11-18 (Supabase, AWS, Resend), Stripe in place, ImprovMX countersigned (`LEGAL_FACTS.md:90-112`). "They are" was true for all but our Gmail inbox, which receives only what people write to us, hence "stores or sends your club's information" | — (do not add "and our policy says so" before the promote) |
| 37 | "Who can see our kids' information? Your own people, by role. Our support staff through tools that log every record opened. Me as the administrator. No advertisers, no AI tools." | say reworded | "Your own people, each by their role. On our side, our support staff, which today means me, in our support tools, which log each record opened and every change made; and me directly in the database when something has to be repaired. We have no way to sign in as one of your people. No advertisers, and it is never given to an AI service." | Data Terms §5 (support tools vs direct access); row 23; W3 | — |
| 38 | "What if we leave? You download your lists, or ask us for a full copy. A one-button export and a written 60-day window are on the roadmap for Q1 2027. Plans end at the renewal date, with no long contract." | say reworded | "Today you download from the lists that offer it, such as members, registrations and payments, and your owner can ask us for a full copy, which we put together for you. In Q1 2027 we'll add a download of everything, and written terms for leaving: 60 days to take it all with you, then it's deleted. There's no long contract: a cancelled plan ends at its renewal date." | export census (`lib/help-content/exports.tsx:147-160`); roadmap Q1 rows; plans end at renewal on prod since 2026-11-05 | Add "within 30 days" to the full copy only once the Data Terms publish (§11). "No long contract" must also be true of the terms you offer Milton |
| 39 | "What if something happens to you? Yours to answer in your own words…" | say as is | — | ruling 0d (2026-11-16): not in the pack; the owner answers | — |
| 40 | "Have you been independently tested? No. We ran our own full access review this month and fixed what it found. The infrastructure underneath is run by certified hosts." | say reworded | "No independent test. We run our own checks: reviews of who can see and change what in every club (two in October, one on November 10), with the serious and medium findings fixed in the live product, and a rehearsed restore from backup on November 18. The services underneath state their own certifications, which are theirs, not ours." | sweeps (`BOARD_READY_PLAN.md` §0a); `BACKUPS_AND_RESTORE.md`; W6. Pen test out of scope (2026-11-15) | — |
| 41 | "Are you compliant with privacy law? The privacy policy was written to PIPEDA's requirements and a breach procedure was approved on Nov 17. Neither has had a lawyer's review yet." | say reworded | "Our privacy policy and terms are written to the federal privacy law, PIPEDA, and they go live on our site with our next release. We follow a written breach procedure. None of it has been reviewed by a lawyer yet." | `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md`; `BREACH_PROCEDURE.md` (owner-approved 2026-11-17); §0 | After the promote, "go live with our next release" becomes "are published on our site" |
| **Close before the meeting** | | | | | |
| 42 | the four to-dos | replace | See the owner list (§4) | — | — |

### 2. The other lines on the page

| # | Where | Line as drafted | Verdict | Exact wording | Rests on |
|---|---|---|---|---|---|
| 43 | Start here card 5, bullet 2 | "The Terms and Privacy Policy are not published on production yet (they go with the next release). Until then, do not say 'our published policy says'." | say as is (now confirmed) | — | §0 |
| 44 | Card 5, bullet 3 | "The Data Terms and supplier list are approved but unpublished, so the 72-hour breach notice and 30-day supplier notice cannot be quoted yet." | say as is | add: "nor the 30-day full copy" | §0; W8, W9; Data Terms §11 |
| 45 | Card 5, bullet 4 | "The security pack … has not been started. The Security tab here is its first draft. It has not been through /legal…" | replace | "The security brief, the first page of the pack owed to their board, is written and has been through /legal (Nov 21). The Security tab now carries only lines cleared to say, each with its condition." | this file |
| 46 | Card 5, bullet 1 | "Hosting is in the United States (Ohio)…" | say as is | — | ruling 0b |
| 47 | Card 5 title | "Security has a strong story, with four gaps to close or avoid" | say as is | — | — |
| 48 | Value case, note "Comparisons" | "…Stay away from card rates: ours is the higher of the two." | say as is (advice not to make a claim) | — | not a security line; no comparison is made |
| 49 | Value case, note "how do we connect with families?" | "…the club site, registration with a status page, Email families, team schedules in family phone calendars, and score alerts for a followed team. The signed-in family app is built and comes next…" | say as is | — | family calendar feeds carry no player names (census row); the status page is the family's own private link |
| 50 | Value case card "One bill" | "Online payments are switched off, and they sit on the roadmap for Q1 2027." | say as is | — | payments switch (§0) |
| 51 | Deck slide 2 | "…the access review…" | say reworded | "the access review, with its fixes live" | row 21 |
| 52 | Deck slide 7 | "The diagram from the Security tab." | say as is (once the diagram carries rows 1–10) | — | rows 1–10 |
| 53 | Deck slide 8 | "Six plain statements. Hosting in Ohio stated outright." | say reworded | The six (each a row above): (1) "Your club's information is stored in the United States (Ohio), with our database host, Supabase, on Amazon Web Services." (2) "We never sell it or use it to advertise, and it is never given to an AI service." (3) "Your people see only what their role allows, checked on our server for every request. Two-step sign-in is available to everyone, and your club can require it for its board and coaches; FieldLogicHQ staff always use it." (4) "Information is encrypted in transit and at rest, and player documents open only through links that expire after one hour." (5) "Our database is backed up daily, each backup kept 7 days, and we have rehearsed a restore." (6) "Our support tools log each record our staff open and every change they make. In November we reviewed who can see what in every club; its fixes are live." | rows 15–24 |
| 54 | Also include, "A leave-behind" | "Three pages: the security brief, the feature menu, the roadmap. The security brief doubles as the first page of the pack owed to their board." | say as is | — | the brief exists |
| 55 | Also include, "Leave out" | "The word 'Canadian' as a selling point. The hosting is not." | say as is | — | ruling 0b |
| 57 | Start here, Calls table, "Show the roadmap?" | "Three things are owed first: the /legal read of the four data commitments, …" | say reworded | "Two things are owed first: the page's wording brought up to the Nov 18 rulings (and to the four data promises as worded in the Security tab, read by /legal on Nov 21), and a saved snapshot of the version shown." | §3 |
| 58 | Security tab, new "If he asks" | *(new)* "Does any public page show our kids?" | add | "No page anyone can open shows a player's name, date of birth or roster. Your club decides what it publishes. A link we email to a family shows only that family's own sign-up." | §0 (re-verified 2026-11-21) |
| 56 | Also include, sensitive item | The club's current website shows players' photos, schools and parents' phone numbers | say as is (privately) | — | It is the club's own site and its own exposure; the owner raising it privately is fine. Don't put it in the brief or on a slide |

### 3. The roadmap's four "Your data is yours" commitments

Source: `PRODUCT_ROADMAP.md` §6 2026-11-16 (L212–219, the 60 days L229, the move to Q1 L222–223); the public text is the
drawing's `COMMIT` block (`BOARD_READY_ROADMAP_BOARD_VERSION_DRAWINGS.html:375-380`), under the band "What we promise · in
writing from Q1 2027". No earlier `/legal` read exists (roadmap L303–304 said one was running 2026-11-18; no record of it
in `docs/agents/legal/` or the git log), so this is that read.

**The cross-cutting finding.** Three of the four are written in the present tense ("Your club can download everything
itself") and none of them is true today. The owner's own guard (ask 4A, 2026-11-16) says nothing that isn't on production
is in the present tense. A board reads a present-tense promise under "What we promise" as true now; the dated band label
alone doesn't undo that. So 1 and 3 move to the future tense or a noun phrase.

| # | As drawn | Verdict | Exact wording for the slide | True today? | Rests on / condition |
|---|---|---|---|---|---|
| C1 | "Take all of it, any time. Your club can download everything itself, in ordinary spreadsheet files, without asking us." | say reworded | "**Take all of it, any time.** Your club will be able to download all of its records itself, in ordinary spreadsheet files, with its uploaded documents, without asking us." | **No — Q1 commitment.** Not started (roadmap: one-button export · Not started). Today: per-list downloads, and a full copy by hand on request | Condition for the Q1 build: the export must include the uploaded documents, or "all of it" is false and the words drop "with its uploaded documents" (owner/`/plan` call). Until then never "can download everything" (backlog L10) |
| C2 | "A reminder to keep a copy when your season closes and when registration closes." | say as is | — | **No — Q1 commitment** (not built) | A prompt in the product, never the data emailed (ruled 2026-11-16). If it becomes an email it is a service notice about the club's own account (no offer, no price) to stay outside CASL's CEM rules |
| C3 | "60 days to take it with you if your club closes its account. Then it is deleted." | say reworded | "**60 days to take everything with you** if your club closes its account, unless you ask us to delete it sooner. Then it is deleted." | **No — Q1 commitment.** Today a deletion is done by our staff on the owner's request, at once; there is no closure step, no 60-day window and no automatic deletion at the end of one (`LEGAL_FACTS.md`: "no automatic purge") | (a) Q1 build: a closure step, the 60-day window, the deletion at its end; (b) files deleted with it (`45c134bea`, next promote); (c) the Terms version that carries it must sit beside **Terms §9**, which keeps information **90 days** after a *plan ends* (and "may" delete after). Two different events and two numbers: the Terms must say which is which, or a board comparing the two documents finds a contradiction (owner call, §4). "Unless you ask us to delete it sooner" keeps the window from overriding a club's own deletion request (Data Terms §11, PIPEDA 4.5.3) |
| C4 | "No lock-in. No long contracts. A cancelled plan simply ends at its renewal date." | say reworded | "**No lock-in. No long contracts.** A cancelled plan ends at its renewal date, and nothing more is charged." | **Yes, today**, for every plan on sale: plans end at the renewal date on production since 2026-11-05 (Stages 1–2), Terms §8 (in code) | "No lock-in" leans on C1; fine in the Q1 band. Must also be true of the early-access terms offered to Milton: no term longer than the plan's own |

Recorded as done in `PRODUCT_ROADMAP.md` §4 item 4 (2026-11-21).

### 4. For the owner

**Decisions only you can make**
1. **C3's two numbers.** The Terms keep a club's information 90 days after a plan ends; the roadmap promises 60 days after a
   club closes its account. Recommended: keep both, and have the Q1 Terms version define "closing your account" as the
   owner's request to leave and be deleted (60 days to download, then deleted), separate from a plan simply lapsing (90
   days, so you can come back). The alternative, one number (90) for both, is simpler for a board but changes your 60-day
   ruling.
2. **C1's scope.** Does the Q1 export include uploaded documents? Recommended: yes; "take all of it" isn't true otherwise.
3. **The privacy policy's staff line.** The text published in code (2026-11-17 §5, and the next draft) says "every page
   they open in our own tools is recorded". The tools record club, person and email record pages only, not list views,
   feedback or early-access leads, and skip a repeat within ten minutes. Data Terms §5 (approved, unpublished) says the
   same. Recommended: `/plan` adds the record pages that are missing (feedback, early-access leads); the next privacy
   version and the Data Terms say "every club, person or email record they open is recorded". Lists are summaries, and
   logging each one adds nothing a board would value. Your call, because it narrows a published sentence.
4. **The Milton terms.** "No long contracts" (C4, row 38) has to be true of whatever early access you offer them.

**Has to ship or publish before a line may be said**
- The promote carrying the legal-pages switch → "our published policy", "our Terms say", row 41's present tense.
- The same promote with `45c134bea` → row 33 ("deleting your club removes its files").
- The held Terms version with the Data Terms and the supplier list → W2 (six companies, a public list), W8 (72 hours),
  W9 (30 days' notice), "a full copy within 30 days".
- The 2026-11-18/19 access follow-ups (with migs 500–507) on production → "every finding resolved" (sweep call 22). The two
  P8 calls (`BOARD_READY_ACCESS_SWEEP_3.md:81-84`) still need your ruling.
- Family payments switched on → "families pay on Stripe's own page" in the present tense.
- Q1 2027 builds → C1, C2, C3 in the present tense.

**Defects for `/plan`** (a promise the product doesn't keep; not wording)
- **D1 (medium, for a board).** Privacy §5 (published in code) and Data Terms §5 promise "every page they open in our own
  tools is recorded"; the opens log covers three record kinds and fails silently on production (dev now reports a failed
  write). Owner call 3 above.
- **D2 (low).** The database's own member test lets a pending invitee's or a suspended member's browser session read the
  club's venues and teams on production until mig 505/506 ship. Already queued with the trust-fix promote; no new work,
  and until it ships nobody says "a suspended member is shut out at once": the app refuses them, the database layer does
  not yet.
- Not a defect, noted: a club's **Rules** page and logos are public by design; a club could upload a child's document there
  and make it public. A one-line hint on that upload ("Files here are public") would close it; `/plan`'s call.

**For a lawyer's eye** (none a gate; you decide when)
- Row 36: the cross-border line paraphrases PIPEDA 4.1.3 and the OPC's 2009 guidelines for a board. A lawyer should confirm
  it, and whether the club (as the accountable organization for its families) must itself tell families their information
  is held in the US. Our position is that it should, in the club's own privacy notice; the product links the club's privacy
  page on its forms.
- C3 beside Terms §9 (two retention numbers) once the Q1 Terms version is drafted.
- The brief's statements are representations to a prospect's board. If the club relies on one that proves untrue, it is an
  argument outside the Terms' limitation of liability (§14). That is the reason every line here is narrowed to what the
  code proves.

## What the product does today
Checked against `origin/master` (production) unless marked dev: every row's "Rests on" names the path:line. Not checked
from code: the actual value of `ONLINE_PAYMENTS_ENABLED` in Amplify (the second lock, `LIVE_PAYMENTS_ALLOWED`, keeps it
off regardless); `TWO_STEP_CODE_KEY` is recorded as set at the Amplify app level (release record 2026-11-15). The four
helper reports (code claims, public pages, access records, live pages) were cross-checked by opening the load-bearing
lines: the team page and tryout-scorer lines, the opens-log grants and header, the change log's triggers, the base
membership filter, the legal-pages switch on both refs, Terms §9.

## Recommendation
Use the reworded lines above and nothing stronger; publish the brief (`drafts/SECURITY_BRIEF.md`) as written,
since every sentence in it is true on production today with no condition. Promote the legal-pages release before the meeting
if you want to say "our published policy". Route D1 and D2 to `/plan`.

## Sources
- Live production pages fieldlogichq.ca /legal/terms, /legal/privacy, /legal/data-terms, /legal/subprocessors, /security,
  and the home footer — accessed 2026-11-21 (all 404; no legal links)
- PIPEDA Schedule 1 cl. 4.1.3, 4.5.3; OPC *Guidelines for processing personal data across borders* (2009) — via
  `PRIVACY_POLICY_REQUIREMENTS_PIPEDA.md` (verified 2026-11-05)
- Supplier pages as read 2026-11-18 — via `BOARD_READY_DATA_TERMS_REVIEW.md` §2 and Sources

## Lawyer's eye needed?
Yes, for the three items in §4 "For a lawyer's eye". None is a gate.
