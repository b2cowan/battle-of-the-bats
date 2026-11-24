# DRAFT — Security page copy (the public `/security` page, and the private brief shared with any club or league board)

| | |
|---|---|
| **Version** | 0.5 |
| **Status** | `/legal`-reviewed 2026-11-21 · `/marketing` page-copy pass 2026-11-21 (Security page S1) · **not reviewed by a lawyer** · published as a private Artifact for the owner to share with any prospect: https://claude.ai/artifact/2qBeedXuyYTRPs1MEo8TUR · **its public home is the marketing site's Security page** (Board Ready plan §0c, steps S2–S5; built in the release that carries the legal pages). **Since S3 (2026-11-21) the page's words live in `lib/security-page-words.ts` and this file holds a pointer plus the records (the `/legal` one-home rule); the private Artifact above keeps its own v0.4 copy** |
| **Effective date** | — (a description of what the product does, not a contract) |
| **Last reviewed** | 2026-11-21 |
| **Research** | `MILTON_PRESENTATION_SECURITY_BRIEF_REVIEW.md` (every sentence in the words file maps to a row there; all are true on production `f12aad4d9` with no condition, except the lines marked **held** and the one marked **page condition**, recorded below) |
| **Change log** | 0.1 · 2026-11-21 · first version, written from W1–W10 and the 2026-11-21 code read · 0.1 (same day, owner ask) · the backups bullet splits in two: uploaded files get their own bullet saying what happens to them (no backup copy, a deleted or replaced file can't come back, keep your own copy, and nothing lingers in a backup). Source: the host's own pages, read 2026-11-21 (`BACKUPS_AND_RESTORE.md` "Uploaded files"). Deliberately NOT said: that files are stored redundantly or durably — the host's pages state no such thing · **0.2 · 2026-11-21 (owner: "go ahead with both")** · made generic for any prospect (eyebrow, opening, file renamed from `MILTON_BOARD_SECURITY_BRIEF.md`); the checked "where your information lives" diagram added as "The picture" (labels = review rows 1–10, as on the prep page); the supplier table renamed "Who handles it". No claim changed · **0.3 · 2026-11-21 (owner: "go ahead with the three changes")** · "Who handles it" gains an "Its certifications" column (AWS added: Amplify confirmed in AWS's SOC and ISO 27001 scope; Stripe's SOC 2 added; "Type 2" spelled one way), the "theirs, not ours; no certification or independent audit of our own" sentence sits directly under the table, and the certifications bullet leaves "The checks we run ourselves" (it is not a check we run). Research: `SUPPLIER_CERTIFICATIONS_AND_SOC2.md`. Not said, deliberately: that a supplier's report can be handed over (Supabase's needs a Team plan; production is on Pro). Republished to the same link · **0.4 · 2026-11-21 (Security page S1, `/marketing` with `/legal` on every moved sentence)** · the brief becomes the page copy; see "v0.4: what moved" below. Republished to the same link · **0.5 · 2026-11-21 (Security page S3, built)** · the page-copy section is replaced by a pointer to `lib/security-page-words.ts`, the words' one home; the records stay here (held lines and page condition, furniture, "what moved", "Revise when", "Never add", "For a lawyer's eye"). `/legal` read the built page against v0.4 and the drawing: no word differs; findings in `LEGAL_INDEX.md`'s row. No claim changed. The private Artifact is not changed · **0.6 · 2026-11-24 (owner ruling 4A, data-flow drawing)** · the private Artifact (version 6) gains "What happens to a family's sign-up": the ruled data-flow drawing (`docs/projects/active/BOARD_READY_DATA_FLOW_DIAGRAM_DRAWINGS.html`) with a phone step list and a "what is kept, and for how long" table, the same payments words as the Security page (caption, Stripe bullet, "Card and bank payments"), the backups bullet naming files families attach to a sign-up, and a footer that keeps its 21 November date and names the section and payment wording as checked 24 November. `/legal` read the placement and four corrections went in (the caption says "three" companies no longer; step 6 is "whenever staff open it"; the desk notice is bell-only unless a person turns a phone alert or email on; the second parent's email). NOT on the public Security page (ruling 4A) |

**Revise when** (S5's release check reads this list at every promote; the "as of" date moves only after that read):
- **The legal pages are on production** → the page may be built and go live (S3, the same release), with "Read more" version A. Nothing on it says "our published policy" before then.
- **The Data Terms and the list of companies publish** → switch on the four **held** lines (W2, W8, W9, the 30 days; recorded below, words in the words file) and "Read more" version B, in the same change.
- **The owner confirms the by-hand full-copy procedure (club on-sale plan Ask 29), or the Data Terms publish** → the page may show the full-copy line (its **page condition**); `BoardQuestions` answer 4's "or ask us for a full copy" follows the same rule.
- **`45c134bea` is on production** → add review row 33's line ("When your club is deleted, its information and the files uploaded to it are deleted, and backup copies are gone within 7 days.") under "Your information stays yours", with `/legal`.
- ~~**Family payments are switched on** → the Stripe bullet and the diagram's caption to the present tense (row 18).~~ **Done 2026-11-24** (owner: online payments are on in production): the caption now reads "Where a club has turned on online payments, families and teams pay on Stripe's own page." and the Stripe bullet "Once your club has turned on online payments, families and teams pay on Stripe's page too, into your club's own Stripe account." Conditional on purpose: it holds for any club that has connected its Stripe account, whether or not one has yet. The Stripe table row now reads "Card and bank payments". `/legal` read the two sentences against the payments switch (`/legal` review 2026-11-24). The "as of" date is NOT moved: that waits for a full re-read at a promote.
- **The access follow-ups are on production** → "every finding resolved" may be said (sweep call 22). Never "every finding fixed".
- **Migs 505 and 506 are on production** → only then may anything be said about suspended members (plan §0c D2).
- **A supplier changes** (incl. the Gmail inbox moving, `BUSINESS_EMAIL_ADDRESSES`) → the table, the diagram (both its desktop and phone forms, and its accessible description, which names Resend and Stripe) and the held W2 count; and, in the board brief only, the sign-up section's diagram, step list and table (`BOARD_READY_DATA_FLOW_DIAGRAM_DRAWINGS.html`).
- **A retention rule changes** (the waiting-file sweep, the 90/120-day clock, friend requests, a way for a club to delete one registration) → the sign-up section's "what is kept" table in the board brief, and the privacy policy line that is owed for the same clocks.
- **The AGENCY_RULES production-rows rule changes** → the AI line falls back to "FieldLogicHQ sends nothing to an AI service" (W3), everywhere it appears (short answer, caption).
- **The staff record-opens log changes** (plan §0c D1) → re-read "Our own staff". (Re-read 2026-11-22 with mig 521: feedback and early-access lead records joined the log; the page's sentence now names club, person, sent email, feedback and early-access lead records.)

**Never add:** anything about what happens if the owner can't run the business, softened or not ("we're built to last" included; ruling 0d, 2026-11-16); "Canadian" hosting or Canada as a selling point (ruling 0b, 2026-11-10); a certification, audit or penetration test of our own (pen test ruled out of scope 2026-11-15); "every finding fixed"; "full restore"; "your files are backed up"; "export everything"; "end-to-end encrypted"; "that log cannot be edited"; a price, a plan name or an offer (pitch ruling 2026-08-21: this page is about security, not a plan).

---

# The page copy now lives in the product (Security page S3, 2026-11-21)

**Where the words are.** `lib/security-page-words.ts` is their one home: the opening, every section's sentences, the
roles and supplier tables, the diagram's labels, its accessible description and caption, the "as of" sentence and its
date, the furniture strings below, and both forms of every held line. It was copied from this draft's v0.4 text and the ruled
drawing (`docs/projects/active/BOARD_READY_SECURITY_PAGE_DRAWINGS.html` v2), never retyped; a script confirmed every string
equals the drawing's. The page is `components/legal/SecurityPage.tsx` and `SecurityDiagram.tsx`, route `app/security/page.tsx`
("not found" while `resolveLegalLinks()` is null); `tests/unit/security-page.test.ts` pins the words, the conditions and the
two surfaces that follow them.

**To change a word:** a `/legal` pass (against `MILTON_PRESENTATION_SECURITY_BRIEF_REVIEW.md`, the "Revise when" list and
"Never add" below), then one edit in the words file. Do not edit a sentence here; this file no longer holds one.

**The private brief Artifact** (https://claude.ai/artifact/2qBeedXuyYTRPs1MEo8TUR) keeps its own v0.4 copy and was not changed
by S3. It is a leave-behind, so it can drift from the page; when its text next changes, republish it from the words file.

## The held lines and the page condition (the records; the words are in the words file)

| Line | Constant | Switches on when | Replaces / sits |
|---|---|---|---|
| W2 "Six companies help us run FieldLogicHQ. **Our public list** names each one…" | `SECURITY_HELD_W2` | Data Terms **and** the list both published (`securityVersionB(links)`) | A new paragraph under "Who handles it"'s "not ours" sentence, before the cross-border paragraph; "Our public list" links the list |
| W9 "Before a new company starts handling your club's information, we email your club's owners at least 30 days ahead. **The Data Terms** say what happens if one must be replaced urgently." | `SECURITY_HELD_W9` | Same | Directly after W2; "The Data Terms" links the Data Terms |
| W8 breach line with "within 72 hours of confirming" (Data Terms §9) | `SECURITY_BREACH_HELD` | Same | Replaces the breach bullet (`SECURITY_BREACH`); keeps "straight away" beside the 72 hours |
| Full copy "in writing… within 30 days" (Data Terms §11) | `SECURITY_YOURS_FULL_COPY_HELD` | Same | Replaces the plain full-copy bullet |
| **Page condition:** the plain full-copy bullet "…we will put it together for you." | `SECURITY_YOURS_FULL_COPY` | `fullCopyOffered(links)` in `lib/full-copy-promise.ts`: the Data Terms published, **or** `FULL_COPY_BY_HAND_CONFIRMED` (the owner's club on-sale plan Ask 29; currently false) | The bullet is absent otherwise. `BoardQuestions` answer 4's "or ask us for a full copy" asks the same predicate; the Ask 29 confirmation is one edit in that file and flips both |

"Read more" is Terms of Service and Privacy Policy always (the page exists only while the legal pages do), and grows to four
links (Data Terms, Companies that handle your information) in the same version B; hrefs come from the legal-links helper, so a
page that is not live is never linked. `/legal` on version B requiring both pages (2026-11-21, S3 review): right for the four
held lines, which cite the list and the Data Terms together and are planned to publish together (Board Ready 0a-5); with only
the Data Terms live the page shows the plain full-copy line, which is true and promises less than the contract, the safe
direction.

---

## The page's furniture (for S2 and S3)

| Element | Words | Notes |
|---|---|---|
| Page title (browser tab, search result) | **Security and your club's information** | Renders as "Security and your club's information \| FieldLogicHQ" through the site's title template. The words a board member would search |
| Search description | **Where your club's information is stored (the United States, Ohio), who can see it, and the checks we run ourselves. We never sell it or use it to advertise.** | 155 characters; only claims already on the page |
| Eyebrow over the headline | **Security** | One word, so it reads the same on the public page and the private brief |
| Footer link (beside the legal links) | **Security** | Before Terms of Service, so the three or five links read as one group |
| `BoardQuestions` answer 3 link (S3) | **See how we protect it** | Second link, after "Read the Privacy Policy". Safe: both render only while the legal pages are published |
| "As of" line | "This page describes how FieldLogicHQ works as of {date}." | `SECURITY_AS_OF` in the words file; its header says who moves it (a full re-read at a promote, never a build) |

## v0.4: what moved, and `/legal`'s verdict (2026-11-21)

| # | Before (v0.3) | After (v0.4) | `/legal` |
|---|---|---|---|
| 1 | "Boards ask us two plain questions: does our information leak, and is it sold? This brief answers both." | "Two questions come first: does our information leak, and is it sold? This page answers both." | **Say as is.** A framing line, no product claim; the rest of the opening ("exactly where … which checks we run ourselves") unchanged |
| 2 | Short answer: "We never sell your club's information or use it to advertise." + "What we never do": "Sell your information, use it to advertise, or share it with advertisers." · "Give it to an AI service." | "We never sell your club's information, use it to advertise, or share it with advertisers." The two list bullets are cut as repeats | **Say as merged.** Every claim kept; the subject is now "your club's information" throughout, the narrower of the two (row 15), so nothing widened. The AI line still stands in the short answer and the caption |
| 3 | "What we never do" · "Show a player's name, date of birth or roster on a public page." | "What's never on a public page" · "FieldLogicHQ never shows a player's name, date of birth or roster on a public page." | **Say as is.** Same claim, now a sentence (rows 34, 58; matches `BoardQuestions` answer 3's "FieldLogicHQ never shows …"). "Your club decides what it publishes" stays: it is what covers free text a club types |
| 4 | Backups: "on November 18" | "on November 18, 2026" | **Say as is.** Same date; a public page needs the year |
| 5 | Volunteer row: "(scorekeeper or gate) · Scores and check-in" (file) / "Scores and check-in, as a scorekeeper or at the gate" (live page) | the live page's wording | **Say as is.** The two texts had drifted by one cell; same claim |
| 6 | Full-copy line, said with no condition | the same line, with a **page condition** | **Finding.** Row 38 cleared it for the meeting; the club pages (`CLUB_ON_SALE_COPY.md` answer 4, Ask 29) hold the same promise until the Data Terms publish or the owner confirms the by-hand procedure, and that owner step is still owed. A public page and the club pages must hold one rule, so the page follows the stricter one. The cheapest fix is the owner's confirmation, which lets both say it |
| 7 | *(none)* | Held W2 + W9 under the table | **Say reworded, held.** W9 as cleared said "30 days before"; the Data Terms say "at least 30 days ahead" to "your organization's owners", with an urgent-replacement exception. The page says "at least" and "owners", and points at the Data Terms for the exception rather than promising a flat 30 days the contract doesn't. Keepable: the owner subscribed to Supabase's, AWS's and Stripe's notices 2026-11-18 (`LEGAL_FACTS.md`) |
| 8 | *(none)* | Held W8 breach bullet | **Say reworded, held.** Keeps "straight away" beside the 72 hours (Data Terms §9: "without delay, and within 72 hours of confirming…"), so the held line is never weaker than today's |
| 9 | *(none)* | Held 30-day full copy | **Say, held.** Data Terms §11: "on a written request … within 30 days" |
| 10 | *(none)* | Search description, `BoardQuestions` link label | **Say as is.** Only claims already on the page |

Moved without a claim changing (no `/legal` read needed, per the lock): section order (the public-page line moves up, beside
the short answer; the diagram and the supplier table follow it); headings ("The picture" → "Where your information lives";
"What we never do" → "What's never on a public page"); the eyebrow ("Security brief · for club and league boards" →
"Security"); the "Read more" block; the furniture.

**Spelling settled (one spelling, `AGENCY_RULES.md`):** "date of birth". The product's field labels say "Date of birth"
(15, including the family registration form) against "Birth date" (2); `BoardQuestions` answer 3 says "birth date" and
changes in S3. The wider drift (help articles and the duplicates cards say "birth date") is a separate chore, not this page.

---

## For a lawyer's eye
- The cross-border paragraph paraphrases PIPEDA Sch. 1 cl. 4.1.3 and the OPC's 2009 cross-border guidelines for a lay
  reader. Confirm the wording, and whether the club should tell its families in its own privacy notice that information is
  held in the US (our view: yes).
- This page is a representation to anyone who reads it, outside the Terms. Each line is narrowed to what the code proves on
  2026-11-21; any later change to the product that makes a line untrue makes the page misleading until it is revised (see
  "Revise when"). That is why the "as of" date moves only with a full re-read.
