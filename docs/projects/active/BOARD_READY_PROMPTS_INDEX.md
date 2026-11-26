# Board Ready — prompts index

Plan of record: `BOARD_READY_PLAN.md` (execution order §7b). PM brief: `BOARD_READY_PM_BRIEF.md`. Gates: Business
Decisions 2026-11-10.

**How the prompts are written:** Wave 1 now. Each later prompt is written after the step before it lands, from what
actually shipped. The order is set by dependency and rework risk, never by calendar; the owner sets priority as it goes.

| Step | What | Kind | Prompt | State |
|---|---|---|---|---|
| 1 | Third access sweep: what leaks today, plus the seat-by-seat "who sees what" table | report-only | `BOARD_READY_W1_ACCESS_SWEEP_PROMPT.md` | **swept 2026-11-10**: `BOARD_READY_ACCESS_SWEEP_3.md` (2 serious, 5 medium, ~25 small); fixes are Wave 2 below |
| 2 | Friend requests in the house-league draft | drawings + asks | `BOARD_READY_W1_FRIEND_REQUESTS_PROMPT.md` | **drawn 2026-11-10** (round 2 after `/design` + `/legal`): https://claude.ai/artifact/KxYr8LW6r5yvsUJ7FmvPL8 (round 3 adds tidier board rows); **all asks A1–A15 RULED 2026-11-10** as recommended; drawings committed `bf5ac936c`. **Build prompt written 2026-11-10:** `BOARD_READY_S1_FRIEND_REQUESTS_BUILD_PROMPT.md`, three parts run in order (1 family side + settings · 2 registrar + deletion · 3 draft + board rows). **Part 1 BUILT + committed `9269b5eab` 2026-11-11** (mig 461 applied to dev 2026-11-11; walk §510 https://claude.ai/artifact/2BfsMZ7k3HrkabN3Zo5sM5 ✅ 25/25 2026-11-11); **Part 2 BUILT + committed `f291a8bb1` 2026-11-11** (nightly job mig 472 `3628b51a1`; migs 471 + 472 applied to dev 2026-11-11; walk §516 https://claude.ai/artifact/LEdqsZtJFgVw4NqqQH34bb ✅ 37/37 2026-11-12); **Part 3 BUILT + committed `06a2b17f1` 2026-11-12** (mig 473 applied to dev 2026-11-12; walk §518 https://claude.ai/artifact/LLFzexk8mG9RZZPmk1R9MK ✅ 48/48 2026-11-12); ⛔ release gate: Parts 1 and 2 in one promote, migs 461 → 471 → 472 (/legal) |
| 3 | Two-step sign-in | drawings + decisions | `BOARD_READY_W1_TWO_STEP_SIGNIN_PROMPT.md` | **drawn 2026-11-10** (round 2 after `/design` + `/legal`): https://claude.ai/artifact/5b956A7svYzjzmZhZUfnkc (round 3: ask 1 ruled 2026-11-10, offered to everyone and the club may require it); **all asks RULED 2026-11-10** (2–8 + A–F as recommended); **build prompts written 2026-11-10**: `BOARD_READY_TWO_STEP_BUILD_PROMPTS.md`, four parts: 1 foundation (**Opus**, after Wave 2 Fix A is committed), 2 your account (Sonnet), 3 switches + resets (**Opus**, beside 2), 4 what the club sees + words (Sonnet, last); **Part 1 committed `7c8f092ab` 2026-11-11, walk §511 ✅ 24/24 2026-11-11; Part 2 committed `0a0ee533d` 2026-11-11, walk §513 ✅ 28/28 2026-11-11; Part 3 committed `5a22b498a` 2026-11-11 (mig 470 `d5f9f7f52`; coach door drawn + approved the same day), walk §515 published, commit on the owner's yes, mig 470 its own commit; walk §515 ✅ 35/35 2026-11-12; Part 4 committed `24e5b9e45` 2026-11-12 (mig 475 dev), walk §520 ✅ 29/29 2026-11-12** |

### Wave 2 — the third sweep's fixes (written 2026-11-10 from `BOARD_READY_ACCESS_SWEEP_3.md`)

**Run now, each in its own new chat (four):**

| Fix | What | Model | Prompt |
|---|---|---|---|
| A | Coaches, scorekeepers and staff stop reading the tournament emails, recipient lists and full tournament records; the score-review switch gets a permission (findings 1 + 3, **serious**) | **Opus**: shared sign-in check, wide blast radius, census first | `BOARD_READY_W2_FIX_A_MEMBER_READS_PROMPT.md` |
| B | The rules-and-resources file store moves behind the server (finding 2, **serious**) | Sonnet: shape decided; production order is code, then the migration | `BOARD_READY_W2_FIX_B_RESOURCES_STORE_PROMPT.md` |
| C | A hidden Schedule sends no games; Unsubscribe asks before it acts (`/legal`); public smalls (findings 6 + 7) | Sonnet | `BOARD_READY_W2_FIX_C_PUBLIC_AND_EMAIL_PROMPT.md` |
| D | Demo billing refused (`/accounting`); team pay links get a version; feedback throttle; defence-in-depth smalls | Sonnet | `BOARD_READY_W2_FIX_D_DEMO_LINKS_THROTTLES_PROMPT.md` |

**Later in this wave · don't start yet:**
- **Fix E**, the inside-club seat reads: the two owner calls (the returning-player scan, the staff export), the scorekeeper
  feed, the permit file, group limits and the family-link revoke. **Waits for fix A to be committed** (neighbouring
  routes; it builds on A's census and guard). Sonnet. `BOARD_READY_W2_FIX_E_SEAT_READS_PROMPT.md`.
- **Trust close-out fixes 1–11** (owner rulings 2026-11-18, as recommended): finished by
  `BOARD_READY_TRUST_CLOSE_FINISH_PROMPT.md` (/simplify → /review → /docs → one commit per fix), **committed 2026-11-18**
  (hashes in `BOARD_READY_ACCESS_SWEEP_3.md` under the RULED block); walk `OWNER_QA_LEDGER.md` §539. Fixes 12–14 and the
  second-caller guard are separate work.

If B and D both need a migration, each checks the latest migration number at commit time.

### Stage 0a — the remaining trust-pack fix (written 2026-11-15)

| Item | What | Model | Prompt |
|---|---|---|---|
| Org delete | Deleting an organization removes its stored files (same item as Stage 6 step 6.5 / P7); prove on dev with real objects; report-only list of files already orphaned | Sonnet: shape decided; no migration, code only | `BOARD_READY_ORG_DELETE_FILES_PROMPT.md` — built, committed `45c134bea` 2026-11-15 |

### Stage 2 — group email to coaches (written 2026-11-16)

| Step | What | Kind | Prompt | State |
|---|---|---|---|---|
| Drawing | Live coach groups on the shipped send window, the door, the recount, history, phone; the owner's asks | drawings + asks | `BOARD_READY_STAGE2_GROUP_EMAIL_DRAWING_PROMPT.md` | **drawn 2026-11-16** (round 2 after `/ux`, `/design`, `/legal`): https://claude.ai/artifact/WVuNq47ywkxKgmFSYew2eF; asks 1–13 owed (plan §5 Stage 2); build prompt written after the rulings |
| Build | **Replaced by Club Communications Stage 1** (owner 2026-11-16): the coach and board email is built inside the Communications place, not as an Organization tab | built, 3 sessions + Close | `CLUB_COMMUNICATIONS_STAGE1_BUILD_PROMPT.md`, `CLUB_COMMUNICATIONS_CLOSE_PROMPT.md` | sessions 1–3 committed `95cac82d6` `817c95523` `684ee0b38` `cc99f58e9` (2026-11-17 to 2026-11-20); walks §537 (35/35) and §547 (47/47) passed; Close built 2026-11-22 — status on the board |

### Stages 4 and 6 — custom forms, then sponsorships (written 2026-11-20, in the owner's order of that day, plan §7b)

| Step | What | Kind | Prompt | State |
|---|---|---|---|---|
| Stage 4 drawing | The club form (question types, document blocks that replace today's waiver without losing its records), the house-league sign-up with per-child and per-family questions, copy last season's form, answers in the registrations list, export and draft notes; drawn so the sponsor link and camp sign-ups can reuse it | drawings + asks | `BOARD_READY_STAGE4_FORMS_DRAWING_PROMPT.md` | **drawn 2026-11-20** (round 2 after `/legal`, `/ux`, `/design`): https://claude.ai/artifact/THVuyR2zxwU8ezeFti5of9, source `BOARD_READY_STAGE4_FORMS_DRAWINGS.html`; **all 20 asks RULED 2026-11-20 as recommended** (plan §5 Stage 4). **Build prompt written 2026-11-20:** `BOARD_READY_STAGE4_FORMS_BUILD_PROMPT.md`, three parts in order (1 the form and the waiver move · 2 the family side · 3 the club side, retention and close-out). **Part 1 built 2026-11-20** (mig 513 on dev; walk §546 https://claude.ai/artifact/UVoT5NPhYxC8B1UzKgsVui). **Part 2 committed `2b3269da6` 2026-11-20** (the family side; mig 515 on dev; walk §551 https://claude.ai/artifact/4T7SUVwYi2Fa67tcjsU3VN passed 50 of 50, 2026-11-21); **Part 3 committed `4dd9e659f` 2026-11-20** (the club's side and the clock; migrations 518 and 519 on dev, 516's schedule committed alone on the owner's yes; walk §553 https://claude.ai/artifact/QhtSYswpFHJqAAkyy8X6Dk, passed 32 of 32, 2026-11-21) |
| Tournament question fixes | F1–F3 from the Stage 4 drawing (archived answers hidden, a file answer is a dead path, any file type), ruling 15 | small fix | `BOARD_READY_TOURNAMENT_QUESTION_FIXES_PROMPT.md` | **committed `bd74851a3` 2026-11-20**; **walked 31 of 31 passed 2026-11-20** (https://claude.ai/artifact/UXVbq4LEexfFFtT6xuZ9eg; the optional phone-photo step skipped); the nosniff gap accepted by the owner 2026-11-20 |
| Stage 6 drawing | Packages, deals and their states, the sponsor link (its questions a Stage 4 form), the club's invoice under the §9 tax shape, delivery, renewal, the deal feeding the one sponsor list; asks include the tournament sponsor-display gate and the card fee | drawings + asks | `BOARD_READY_STAGE6_SPONSORSHIPS_DRAWING_PROMPT.md` | **drawn 2026-11-22**: round 1 https://claude.ai/artifact/1z9y6ctHK3PNLaJ2HR11U8 (15 asks) and round 2 https://claude.ai/artifact/Jw44YSkZ6dFFGTmAVW6ScQ (9 asks), **all 24 RULED 2026-11-22 as recommended** (plan §5 Stage 6). **Build prompt written 2026-11-22:** `BOARD_READY_STAGE6_SPONSORSHIPS_BUILD_PROMPT.md`, four parts in order (1 the place, access, Setup, Packages and the one sponsor list · 2 offering a deal and the business's page · 3 the invoice, money and books · 4 Offer again, the e-transfer sweep, close-out). **Part 1 built and committed 2026-11-22** (migration 525 on dev; production before the promote), walk §560 https://claude.ai/artifact/6ri13cEaq4CXSCUmMsDaqA. Parts 2, 3a and 3b committed and walked (§561 50/50, §562 46/46, §564 47/47, §565 30/30; plan §5 Stage 6 holds the hashes). **Part 4 prompt written 2026-11-24:** `BOARD_READY_STAGE6_P4_BUILD_PROMPT.md`, split in two sessions (4a Offer again, drawing of its gaps first; 4b the product-wide e-transfer sweep, the old sponsor list column, the `/legal` close-out). **Part 4a drawn 2026-11-25** (https://claude.ai/artifact/UDHBeMq7hwLkmtJP3MHryJ, source `BOARD_READY_STAGE6_P4A_OFFER_AGAIN_DRAWINGS.html`); **all 12 asks RULED 2026-11-25 as recommended** (plan §5 Stage 6); `/legal` read ask 8 the same day (five must-fixes, all built); **Part 4a BUILT on dev 2026-11-25** (the Full fix, one send step, the batch window and callout, Offer again on one old deal); the finish reviews ran and the 17 owner calls were ruled and built 2026-11-25; walk §566 published (https://claude.ai/artifact/NJ1CzUfyXfRo5cSWDcKHWp); walk §566 PASSED 37 of 37 on 2026-11-25; the commit is owed at the owner's yes (plan §5 Stage 6); **finish prompt written 2026-11-25:** `BOARD_READY_STAGE6_P4A_FINISH_PROMPT.md`. The tournament sponsors drawing prompt is unblocked and updated · **Part 4b legal close-out drafted and ruled 2026-11-25** (approval page https://claude.ai/artifact/TcfDR73akZPhvEVRKGgnnv; publishes with the card-payment release) · **e-transfer sweep committed 2026-11-25**, walk §569 passed 30 of 30 https://claude.ai/artifact/Lnmcr3g9BvxYPspTSgxKpe · **old sponsor list column removed from the code and the help read committed 2026-11-25** (the drop, mig 538, is held until the release is live) · **the logo fix from its review committed 2026-11-25**; walk §570 passed 38 of 38 on 2026-11-25 https://claude.ai/artifact/FR713RKu5wxYxopDMDSfW5 |
| Stage 6 fixes, Part A | A refund a club makes in its own Stripe dashboard is recorded on the deal and in its books; the club finishes it with a reason | Opus: database change (542) | `BOARD_READY_STAGE6_FIXES_BUILD_PROMPT.md` — Part A; finish prompt `BOARD_READY_STAGE6_FIXES_A_FINISH_PROMPT.md` | **built, reviewed and live-tested on dev 2026-11-26** (asks 1–7 ruled A 2026-11-25; 542 applied to dev 2026-11-26); walk §576 published 2026-11-26, 43 steps and 3 owner calls (https://claude.ai/artifact/WoaUgqxo7PhCAPxnsTHQu8) |
| Stage 6 fixes, Part B | Private links out of error reports; "Send the link again" says what it will do; a bank only asking is not a dispute; paying on a club’s own web address | Sonnet: no migration | `BOARD_READY_STAGE6_FIXES_BUILD_PROMPT.md` — Part B | **built on dev and committed 2026-11-26** (B1–B5 ruled A 2026-11-25); walk §572 published (https://claude.ai/artifact/JK1NstHfhR75WCKSYa5yjn, 34 steps) |

### Stages 5 and 7 — club events, then camps and clinics (drawing prompt written 2026-11-24, plan §7b order steps 3 and 5)

| Step | What | Kind | Prompt | State |
|---|---|---|---|---|
| Stages 5 + 7 drawing | Events in Programs, what an event holds and who it is for, field time from a permit, champs day, a free sign-up, the calendar, the club site and family app; then camp sessions, ages and the camp form, the waitlist, paying, the instructor, keeping a child's answers, books and tax, the receipt, the words | drawings + asks | `BOARD_READY_STAGE5_7_DRAWING_PROMPT.md` | **drawn 2026-11-24** (round 1, after `/legal`, `/accounting`, `/billing`, `/design`, `/marketing`): https://claude.ai/artifact/RdoaEjuySmXcVLyEQc6RtD, source `BOARD_READY_STAGE5_7_EVENTS_CAMPS_DRAWINGS.html`; **all 19 asks RULED 2026-11-24 as recommended** (plan §5 Stage 5 and Stage 7). Round 2, paid events, **drawn 2026-11-25**: https://claude.ai/artifact/AZ7sSezJQzbStt7zCiJ2CA, source `BOARD_READY_STAGE5_PAID_EVENTS_DRAWINGS.html`, asks 20–33 owed. Round 3, team sign-ups, **drawn 2026-11-25**: https://claude.ai/artifact/PYZ1ewhJmPQNBQ1v18v3oB, source `BOARD_READY_STAGE5_TEAM_SIGNUPS_DRAWINGS.html`; **all 16 asks (34–49) RULED 2026-11-25 as recommended** (plan §5 Stage 5); built as Stage 5 Part 5, after round 2. No build prompt until the owner says "build" |

### Stage 0c — the board pack's public Security page (written 2026-11-21, owner ruling of that day; plan §0c steps S1–S5)

| Step | What | Kind | Prompt | State |
|---|---|---|---|---|
| S1 | The words: the security brief edited in place into the page copy (one text for the private brief and the public page), every claim locked to the `/legal` review of 2026-11-21, the page's own links and labels, the held Data Terms sentences, one spelling shared with "Questions a board asks" | `/marketing` + `/legal` on any changed claim; no code | `BOARD_READY_SECURITY_PAGE_S1_WORDS_PROMPT.md` | **done 2026-11-21**: the brief is v0.4, the page copy; republished at the same link; S3 tasks in the plan |
| S2 | The drawing: the page in the site's own kit, desktop and phone, Warm and Dark; the diagram's phone form with its ten checked labels unchanged; the two tables on a phone; before and after the Data Terms publish; the two doors in (footer, "Questions a board asks"); print; the share card | `/design` drawing, `/legal` on any new or moved word; no code | `BOARD_READY_SECURITY_PAGE_S2_DRAWING_PROMPT.md` | **drawn 2026-11-21** (https://claude.ai/artifact/9yp7PVd33SjyRQrSBqXZmv, source `BOARD_READY_SECURITY_PAGE_DRAWINGS.html`); **all eleven asks RULED as recommended 2026-11-21**; `/legal` on the six moves: all say as is |
| S3 | The build: `/security` as a static marketing page gated with the legal pages, to the ruled drawing (document head, the redrawn diagram in two forms, the short-answer card, the tables, versions A/B, print, share card), the footer link and "Questions a board asks" answer 3 | build + `/review` + `/legal` on the page as built against the drawing | `BOARD_READY_SECURITY_PAGE_S3_BUILD_PROMPT.md` | **written 2026-11-21; run 2026-11-21: built on dev**, reviewed (`/design`, `/legal`), committed `f9197cb05`; owner walk §554 https://claude.ai/artifact/MsJw2L8YVgvKyxuKZhoWPG passed 33 of 33 on 2026-11-22; ships in the release that carries the legal pages |
| S4–S5 | `/legal` on the page as built against production at the promote, the release check line | later prompts | — | not written |

The three Wave 1 prompts can run at the same time. Only step 1 runs probes, on dev only, and none of them writes product code. The
builds for steps 2 and 3 come as later prompts. If both need a migration, each checks the latest migration number at
commit time.

**Stage 4.P · a club sets its own privacy link** (owner ask 2026-11-21; build, no migration): prompt `BOARD_READY_CLUB_PRIVACY_LINK_PROMPT.md`, written 2026-11-21. One settings field, one route, an audit line and two help lines; the three family doors that already read the link then show it. `/legal` and `/review` before hand-off. **Built and committed `f11841ac8` 2026-11-22** (owner and admin set it; the change shows on the owner's Audit log; walk §555 passed 19 of 19, 2026-11-22).

**Standing for every prompt:**
- Branch `dev`.
- Stage explicit paths only. Shared files go through a private index.
- **No commit without the owner's yes.**
- Broad reading goes to helpers, and their claims are checked against the code.
- A product-owner summary at hand-off.
