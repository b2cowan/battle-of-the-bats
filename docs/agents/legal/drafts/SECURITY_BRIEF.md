# DRAFT — Security page copy (the public `/security` page, and the private brief shared with any club or league board)

| | |
|---|---|
| **Version** | 0.4 |
| **Status** | `/legal`-reviewed 2026-11-21 · `/marketing` page-copy pass 2026-11-21 (Security page S1) · **not reviewed by a lawyer** · published as a private Artifact for the owner to share with any prospect: https://claude.ai/artifact/2qBeedXuyYTRPs1MEo8TUR · **its public home is the marketing site's Security page** (Board Ready plan §0c, steps S2–S5; built in the release that carries the legal pages). When S3 builds the page, the product's copy becomes the home and this file is replaced by a pointer (the `/legal` one-home rule) |
| **Effective date** | — (a description of what the product does, not a contract) |
| **Last reviewed** | 2026-11-21 |
| **Research** | `MILTON_PRESENTATION_SECURITY_BRIEF_REVIEW.md` (every sentence below maps to a row there; all are true on production `f12aad4d9` with no condition, except the lines marked **held** and the one marked **page condition**) |
| **Change log** | 0.1 · 2026-11-21 · first version, written from W1–W10 and the 2026-11-21 code read · 0.1 (same day, owner ask) · the backups bullet splits in two: uploaded files get their own bullet saying what happens to them (no backup copy, a deleted or replaced file can't come back, keep your own copy, and nothing lingers in a backup). Source: the host's own pages, read 2026-11-21 (`BACKUPS_AND_RESTORE.md` "Uploaded files"). Deliberately NOT said: that files are stored redundantly or durably — the host's pages state no such thing · **0.2 · 2026-11-21 (owner: "go ahead with both")** · made generic for any prospect (eyebrow, opening, file renamed from `MILTON_BOARD_SECURITY_BRIEF.md`); the checked "where your information lives" diagram added as "The picture" (labels = review rows 1–10, as on the prep page); the supplier table renamed "Who handles it". No claim changed · **0.3 · 2026-11-21 (owner: "go ahead with the three changes")** · "Who handles it" gains an "Its certifications" column (AWS added: Amplify confirmed in AWS's SOC and ISO 27001 scope; Stripe's SOC 2 added; "Type 2" spelled one way), the "theirs, not ours; no certification or independent audit of our own" sentence sits directly under the table, and the certifications bullet leaves "The checks we run ourselves" (it is not a check we run). Research: `SUPPLIER_CERTIFICATIONS_AND_SOC2.md`. Not said, deliberately: that a supplier's report can be handed over (Supabase's needs a Team plan; production is on Pro). Republished to the same link · **0.4 · 2026-11-21 (Security page S1, `/marketing` with `/legal` on every moved sentence)** · the brief becomes the page copy; see "v0.4: what moved" below. Republished to the same link |

**Revise when** (S5's release check reads this list at every promote; the "as of" date moves only after that read):
- **The legal pages are on production** → the page may be built and go live (S3, the same release), with "Read more" version A. Nothing on it says "our published policy" before then.
- **The Data Terms and the list of companies publish** → switch on the four **held** lines below (W2, W8, W9, the 30 days) and "Read more" version B, in the same change.
- **The owner confirms the by-hand full-copy procedure (club on-sale plan Ask 29), or the Data Terms publish** → the page may show the full-copy line (its **page condition**); `BoardQuestions` answer 4's "or ask us for a full copy" follows the same rule.
- **`45c134bea` is on production** → add review row 33's line ("When your club is deleted, its information and the files uploaded to it are deleted, and backup copies are gone within 7 days.") under "Your information stays yours", with `/legal`.
- **Family payments are switched on** → the Stripe bullet and the diagram's caption to the present tense (row 18).
- **The access follow-ups are on production** → "every finding resolved" may be said (sweep call 22). Never "every finding fixed".
- **Migs 505 and 506 are on production** → only then may anything be said about suspended members (plan §0c D2).
- **A supplier changes** (incl. the Gmail inbox moving, `BUSINESS_EMAIL_ADDRESSES`) → the table, the diagram and the held W2 count.
- **The AGENCY_RULES production-rows rule changes** → the AI line falls back to "FieldLogicHQ sends nothing to an AI service" (W3), everywhere it appears (short answer, caption).
- **The staff record-opens log changes** (plan §0c D1) → re-read "Our own staff".

**Never add:** anything about what happens if the owner can't run the business, softened or not ("we're built to last" included; ruling 0d, 2026-11-16); "Canadian" hosting or Canada as a selling point (ruling 0b, 2026-11-10); a certification, audit or penetration test of our own (pen test ruled out of scope 2026-11-15); "every finding fixed"; "full restore"; "your files are backed up"; "export everything"; "end-to-end encrypted"; "that log cannot be edited"; a price, a plan name or an offer (pitch ruling 2026-08-21: this page is about security, not a plan).

---

# How FieldLogicHQ protects your club's information

*Security*

Two questions come first: does our information leak, and is it sold? This page answers both. It says exactly where your
club's information is kept, who can see it, and which checks we run ourselves.

## The short answer

- **We never sell your club's information, use it to advertise, or share it with advertisers.** We don't use advertising
  trackers, third-party analytics or an outside error-monitoring service, and your club's information is never given to
  an AI service.
- **It is stored in the United States (Ohio)**, with our database host, Supabase, on Amazon Web Services.
- **Your people see only what their role allows**, and our server checks that on every request.

## What's never on a public page

FieldLogicHQ never shows a player's name, date of birth or roster on a public page. Your club decides what it publishes:
schedules, standings, team names, and the names of coaches who choose to show theirs. A link we email to a family shows
only that family's own sign-up.

## Where your information lives

*(The checked diagram, unchanged. Its labels, each checked in the review file, rows 1–10:)*
- **Board, coaches, families** · a phone or a computer · two-step sign-in for every account → *encrypted* →
  **FieldLogicHQ app** · Amazon Web Services · Ohio, United States → *checked* → **Database, sign-in, files** · Supabase on
  AWS · Ohio, United States. A dashed line from people straight to the database: *sign-in and live score updates*.
- Under the app: "Every request: signed in, second step where on, belongs to this club, allowed for this role".
- Under the database: "Encrypted at rest by the host · Database backed up daily, kept 7 days · Player documents open by
  1-hour links".
- From the app: *sends email* → **Email delivery** · Resend, United States · Receives: names, addresses, the message
  itself; *hands off checkout* → **Payments** · Stripe · Card numbers are typed on Stripe's own page and never reach us;
  *sends an alert* → **Phone alerts** · the browser's own push service · Receives: a device address, and the alert,
  sealed for that device.
- Caption: "Where a club's information lives and who it passes through. Nothing goes to advertisers or analytics
  companies, and your club's information is never given to an AI service. Families can't pay online through FieldLogicHQ
  yet."

## Who handles it

| Company | What it does for us | What it receives | Where | Its certifications |
|---|---|---|---|---|
| **Supabase** | Our database, sign-in and file storage | Everything your club keeps in FieldLogicHQ | United States (Ohio) | SOC 2 Type 2, ISO 27001 |
| **Amazon Web Services** | Runs our website and its server | Every page and form passes through it | United States (Ohio) | SOC 2, ISO 27001, for the hosting service we use |
| **Resend** | Sends every email FieldLogicHQ sends | The name and address of each person emailed, and the message | United States | SOC 2 Type 2 |
| **Stripe** | Card payments | The payer's details and what is being paid for. Card numbers go to Stripe, never to us | Canada, the United States and other countries | PCI Service Provider Level 1, SOC 2 Type 2 |
| **ImprovMX** and **Google (Gmail)** | Deliver email that people send to our own addresses | Only what people write to us | France (until delivered), the United States | None stated |

These are each company's own certifications, as each states them, not ours. FieldLogicHQ has no certification or
independent audit of its own.

> **Held until the Data Terms and the list of companies publish** (W2, W9; switch on with "Read more" version B):
> "Six companies help us run FieldLogicHQ. Our public list names each one, what it receives, where, and links its own
> security pages." · "Before a new company starts handling your club's information, we email your club's owners at least
> 30 days ahead. The Data Terms say what happens if one must be replaced urgently."

Canadian privacy law lets an organization use service providers outside Canada. We stay responsible for your
information while they handle it, and each company that stores or sends your club's information is bound by
data-processing terms with us. While information is in the United States, that country's courts and authorities can
sometimes obtain it.

## Who can see what

Each person at your club gets a role. These are the defaults, and your club's owner can widen or narrow each person's
access.

| Role | Can open |
|---|---|
| **Owner** | Everything, including billing and the club's settings |
| **Admin** | Every program on your plan, except billing, settings and the Families area unless the owner grants it |
| **Treasurer** | The club's books and its member list |
| **League admin** | The house league and the member list |
| **League registrar** | The house league |
| **Staff** | Game-day help: schedule updates, scores, check-in and announcements |
| **Volunteer** | Scores and check-in, as a scorekeeper or at the gate |
| **Coach** | Their own team in the Coaches Portal, and nothing club-wide |

**What the club sees of a team.** The club sees each of its teams' roster, schedule, results and cash on hand. A coach's
lineups and private notes stay with the coach.

**Our own staff.** Our support staff can open your club's records only to help when you ask, investigate a problem, or
keep the service running. Our support tools log each club and person record our staff open, and keep a permanent record of
every change they make. We have no way to sign in as one of your people.

## How it is protected

- **Signing in.** Passwords are kept by our sign-in service, Supabase, only in scrambled form. FieldLogicHQ never sees or
  stores them. Two-step sign-in is available to everyone, and your club can require it for its board and coaches;
  FieldLogicHQ staff always use it.
- **Checked on our server.** On every request our server checks who the person is, that they belong to your club, and
  what their role allows. This is enforced on our server, not in the browser.
- **Encryption.** Information is encrypted in transit, and our database host encrypts everything it stores (AES-256).
- **Player documents** are stored privately and open only through links that expire after one hour.
- **Card numbers and bank details never reach us.** When you pay for FieldLogicHQ, you pay on Stripe's own page. Stripe
  states it is certified PCI Service Provider Level 1. Families can't pay online through FieldLogicHQ yet; when your club
  turns that on, they will pay on Stripe's page into your club's own Stripe account.
- **Phone alerts** are sealed so that only the receiving device can read them.

## Backups, and if something goes wrong

- **Our database is backed up daily, and each backup is kept 7 days.** We rehearsed a restore from a backup on
  November 18, 2026.
- **Uploaded files are not in those backups.** Player documents, logos and rules files are kept separately, with the
  same host in the same place, and we keep no backup copy of them. A file that is deleted or replaced can't be brought
  back, so keep your own copy of any document you can't do without. It also means a deleted file doesn't linger in a
  backup of ours.
- **If something goes wrong** with your club's information, we follow a written breach procedure: we contain it, tell
  your club's owners straight away with what we know, help you tell your families, and fix what caused it.

> **Held until the Data Terms publish** (W8; replaces the bullet above): "**If something goes wrong** with your club's
> information, we follow a written breach procedure: we contain it, tell your club's owners straight away, and within
> 72 hours of confirming it touches your information, with what we know, help you tell your families, and fix what
> caused it."

## Your information stays yours

- You can download your records from the lists that offer it, such as members, registrations, payments and your books,
  in Excel, CSV or PDF.
- Your club's owner can ask us for a full copy of your club's information, and we will put it together for you.
  *(**Page condition:** on the public page this line shows only once the owner has confirmed the by-hand procedure,
  Ask 29, or the Data Terms publish; the same rule as `BoardQuestions` answer 4. The private brief carries it today, on
  review row 38.)*
- Your club's owner can ask us to delete your club's information.
- There is no long contract. A cancelled plan ends at its renewal date, and nothing more is charged.

> **Held until the Data Terms publish** (Data Terms §11; replaces the full-copy line above): "Your club's owner can ask
> us in writing for a full copy of your club's information, and we will put it together for you within 30 days."

## The checks we run ourselves

We have not commissioned an independent penetration test. These are the checks we run ourselves:
- **Reviews of who can see and change what in every club**: two in October 2026 and one on November 10, 2026. The
  November review found nothing that lets one club see another club's people. Its serious and medium findings are fixed
  in the live product.
- **A rehearsed restore** from backup, on November 18, 2026.

## Questions

Write to our privacy contact: **privacy@fieldlogichq.ca**

## Read more *(the public page only)*

- **Version A** (the page goes live with the legal pages, so it always has these): Terms of Service · Privacy Policy
- **Version B** (once the Data Terms and the list of companies publish): Terms of Service · Privacy Policy · Data Terms ·
  Companies that handle your information

*(Link words are the footer's own, from `lib/legal-words.ts`, in the footer's order. Hrefs through the legal-links helper,
so a page that isn't live is never linked.)*

---

*This page describes how FieldLogicHQ works as of {date}.* (Today: November 21, 2026. The date is set by the person who
re-reads every line against production at a promote — S4 for the first, S5's release check after — and by nobody else;
an edit that does not re-read every line does not move it.)

---

## The page's furniture (for S2 and S3)

| Element | Words | Notes |
|---|---|---|
| Page title (browser tab, search result) | **Security and your club's information** | Renders as "Security and your club's information \| FieldLogicHQ" through the site's title template. The words a board member would search |
| Search description | **Where your club's information is stored (the United States, Ohio), who can see it, and the checks we run ourselves. We never sell it or use it to advertise.** | 155 characters; only claims already on the page |
| Eyebrow over the headline | **Security** | One word, so it reads the same on the public page and the private brief |
| Footer link (beside the legal links) | **Security** | Before Terms of Service, so the three or five links read as one group |
| `BoardQuestions` answer 3 link (S3) | **See how we protect it** | Second link, after "Read the Privacy Policy". Safe: both render only while the legal pages are published |
| "As of" line | "This page describes how FieldLogicHQ works as of {date}." | See above for who moves it |

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
