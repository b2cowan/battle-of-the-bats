# Children's photos on a club's public site, coach uploads, and showing an Instagram post
**Last verified:** 2026-11-24
**Re-verify by:** 2027-11-24, or sooner on any of: the Stage 3 (photo shelf) build prompt; Bill C-36 passing second
reading; the first Québec club; the guardian tier switched on; Meta changing its embed terms; a US customer.
**Depends on facts:** FieldLogicHQ is a service provider to the club for families' and children's information
(Data Terms §"service provider"); no Québec customer; the guardian tier is switched off; no cookie notice exists;
the published Privacy Policy and Data Terms are version 2026-11-24.

Not legal advice and not reviewed by a lawyer. Research and a recommendation; the "Lawyer's eye" list at the end says
what a professional should look at. No professional review is a gate (owner 2026-10-31, 2026-11-04).

## Question(s) this answers

Club Website Enhancements idea 11, "the club's own feed" (`docs/projects/active/CLUB_WEBSITE_ENHANCEMENTS_PLAN.md`
§5.1, calls C5–C9), reviewed BEFORE it was drawn:
1. A coach uploads photos of other families' children to the club: who is the publisher, what is the coach told.
2. The consent rule for a photo filed under a team; where the question is asked; whether it carries across seasons;
   a photo filed under no team.
3. A win photo in a News post, against Stage 0's "a news photo shows no recognizable player".
4. Showing one Instagram or Facebook post on a club's public page from a pasted link.
5. Who may paste such a link.
6. Storing photos: location data, retention, deletion; the published "never shown on public pages" wording.
7. A narrow "can post, nothing else" permission.
8. Made-for-Instagram images of a win going out.
9. (Parked) connecting a club's Instagram account.

## Finding

**The law, from the primary text (read 2026-11-24).**
- A recognizable photo of a child is personal information ("information about an identifiable individual", PIPEDA
  s. 2(1)), and the regulator treats children's information as sensitive. OPC, PIPEDA Findings #2025-005 (a swimming
  pool, dated 2025-11-25; read twice, independently): a pool that made a photo waiver a condition of lessons, for use
  on its website and social media, breached Principles 4.3.3 and 4.3.6. Para 18: "images of children in swim attire –
  is sensitive personal information." Para 24: the fix was a registration process where parents can choose "express
  opt-in consent" for promotional use and public posting. Two rules follow, and both bind the drawing:
  **the yes is its own opt-in choice, and a family can sign up while answering no.**
- Schedule 1, 4.3.6: "An organization should generally seek express consent when the information is likely to be
  considered sensitive." 4.3.8: "An individual may withdraw consent at any time, subject to legal or contractual
  restrictions and reasonable notice", and the organization "shall inform the individual of the implications of such
  withdrawal." 4.5.3: information no longer needed "should be destroyed, erased, or made anonymous." No number of days
  is fixed anywhere for acting on a withdrawal.
- OPC, Guidelines for obtaining meaningful consent ("Consent and children"): for those who cannot consent for
  themselves, "in all but exceptional circumstances, this means anyone under the age of 13", consent comes from a
  parent or guardian. The OPC's Children's Privacy Code (guidance, not law; final report modified 2026-10-20): "Where
  a child is under 13, parental consent is always required"; it covers everyone under 18.
- **Who is accountable.** The club decides to publish and is the organization responsible for consent (our Terms
  "Your responsibilities", Data Terms §2). FieldLogicHQ hosts as its service provider. Whether PIPEDA reaches the
  club itself is uncertain: PIPEDA applies to "commercial activities" (s. 4(1)); the OPC says "Non-profit status does
  not automatically exempt an organization" and treats membership fees and fundraising as non-commercial. A club's own
  team-photo page is probably outside PIPEDA; a page carrying paid sponsors is less clear. No OPC text decides it.
  **FieldLogicHQ's own activity is commercial on any reading**, so we design to the PIPEDA standard whatever the
  club's status, and our own published promises bind us regardless.
- **Civil exposure in Ontario** is low for a team photo at a public game: intrusion upon seclusion needs an invasion
  "highly offensive to a reasonable person" of matters such as "financial or health records" (Jones v. Tsige, 2012
  ONCA 32, paras 70–72). The closest fit is appropriation of personality if a child's image were used commercially
  (Athans v. Canadian Adventure Camps, discussed at Jones para 28): one more reason no player photo goes into
  sponsor placements, posters or share images.
- **A visitor's browser and a third party's script.** No federal or Ontario statute or regulation requires a cookie
  banner or click-to-load. The pressure is the openness principle (4.8) and the OPC's tracking position: organizations
  "should avoid knowingly tracking children and tracking on websites aimed at children" (OPC policy position on online
  behavioural advertising). The OPC found in 2011 (PIPEDA #2011-006) that Facebook "receives log level data every time
  a user visits a website that hosts a social plug-in". The closest OPC support for loading only on a tap is its
  MyDemocracy finding (Privacy Act, a federal institution, so persuasive only): sharing should occur "only after a user
  has deliberately initiated a social sharing action."
- **Québec (a future trigger; we do not serve Québec).** The statute and Civil Code text could not be opened
  (legisquebec, CanLII and the SCC site refused the fetch). Read instead: the CAI's Lignes directrices 2023-1: consent
  of a child under 14 is given by the holder of parental authority, and identification, location or profiling
  functions need "un geste positif" from the person. Aubry v. Éditions Vice-Versa (the right to one's image) is known
  only from secondary summaries. **Re-read both from the primary text before the first Québec club.**
- **Reform.** Bill C-36 (45th Parliament, 1st session; first reading 2026-06-15, at second reading, not passed)
  defines a child as under 18 and makes "a child's personal information" sensitive by statute. PIPEDA is still the
  law; the bill would turn today's guidance into a rule, which the design below already meets.
- **Sport norms (not law).** The SDRCC's interactions policy template: photos and videos of participants taken "with
  explicit prior consent from the Participant and where appropriate, their parent … before being posted on social
  media", and none "captured in changing areas".

**Meta's side** (Meta's developer pages, read 2026-11-24; detail in the plan §5.1). Showing one public post from its
link is an official service (oEmbed), with no Meta app, key or review since 2026-06-15. Use is limited to "displaying
content in websites and apps"; analytics on it is prohibited. Meta's pages say nothing on embedding another person's
post or posts that show children. What the embed stores in a signed-out visitor's browser is not stated by Meta; one
consent-tool vendor lists a two-year Facebook identifier (secondary, unverified).

## What the product does today

Checked against the code and the published texts 2026-11-24 (a helper census; the published sentences and the two
upload routes re-opened by the session).
- **The published promise that a player photo would break.** Privacy Policy 2026-11-24 §"children" (line 221):
  children's information "is never shown on public pages". Data Terms 2026-11-24 (line 138): the same sentence; and
  (line 38) "We **never show** a player's name, date of birth or roster on a public page. You choose what your
  organization publishes (schedules, standings, team names, and the names of coaches who choose to show theirs)."
  A recognizable photo of a child is children's information. **Publishing one would make both documents untrue.**
- **The published promise an Instagram post loaded at once would strain.** Privacy §4 (lines 58–60): "We use only the
  cookies needed to run FieldLogicHQ … **We do not use advertising or tracking cookies**, and we do not use
  third-party analytics." Subprocessor list (lines 4–5): "We don't use advertising trackers". Its "not on this list,
  and why" section names fonts, push, calendars and map links, and the map sentence is the model: "Nothing is sent to
  a map service unless you click it."
- **No text covers a public photo.** No published sentence says photo, image or picture. Terms line 92 forbids
  uploading "anything you do not have the right to share"; Terms lines 79–80 license us to "host, copy, process and
  display Customer Data only as needed"; Terms lines 189–191 let us remove content "needed to protect children".
  There is no route for a parent to ask for a photo to come down.
- **Public pictures already exist with no rule under them:** the club logo, tournament logo and banner are stored in
  public storage exactly as uploaded (`app/api/admin/org-hero-banner/route.ts:60-68`, verified); only the sponsor logo
  is re-saved (`lib/sponsor-logo-image.ts:31-35`, verified). A banner taken on a phone can carry its location.
- **Consent today.** House league: a club's own documents are ticked at registration, one record per child's
  registration, scope `child_data`; a club can already add a yes/no question of its own to its sign-up form (dev only),
  tied to that season's registration. Tryouts: three ticks with time and IP. `family_consents` has three scopes
  (`family_comms`, `child_data`, `marketing`) and **no code writes a withdrawal**. A family cannot change an answer in
  the product; "Ask to withdraw" only flags staff.
- **Rep teams.** A player joins a rep roster because a coach types them in, or accepts a tryout registration. With the
  guardian tier off (`GUARDIAN_TIER_ENABLED`, default off), the only question a rep parent ever answers in the product
  is the tryout form; a player a coach typed in has no parent in the product at all.
- **Visitors.** Fonts are served from our own site; no analytics or error-monitoring company; every cookie is our own.
  The club's Instagram address is a plain link today. No cookie notice exists.
- **Permissions.** Capabilities exist and the owner can grant one to a member (`lib/roles.ts`; `post_announcements`,
  `manage_branding` are examples). Writing to the public site is fixed to the owner and admins
  (`lib/public-site-rules.ts:17`, verified); `module_public_site` gives a read-only editor.

## Recommendation

Numbered to the nine questions. "Drawing" = what the Stage 0 page must show; "Text" = what our published documents
need before a build ships; none of it is built.

1. **A coach's upload.** The club is the publisher; the coach acts for the club; we host. Sending photos to the club
   publishes nothing: it is a collection by the club from its own staff. *Drawing:* the send window says where the
   photos go and who decides ("Goes to {Club}'s admins. They choose what shows on the club's site."), asks for no
   names in the caption, and carries one required tick: only this team is in the photos. No change-room photo rule is
   written into the window as law, but the help text carries it. *Text:* none for the send itself.
2. **The consent rule.** A roster-level "everyone has said yes" rule is sound and stricter than the law needs. It must
   be: **its own question, a yes or a no with neither chosen for the family, never a condition of signing up, the
   words saying the photo is public and unnamed and how to change the answer** (#2025-005). A club's existing "photo
   release" document that must be ticked to register is the pattern the OPC found against; the built-in question must
   not ride a required document. *Where it is asked:* house league registration and the rep tryout sign-up. A rep
   player a coach typed in has no answer, so the answer is no. Two honest ways to close that gap: wait for the family
   app (strict), or let the club record a family's written answer, marked "recorded by the club" with who and when
   (lawful, because the club is the one responsible for consent and our terms say we do not check it; weaker, because
   the family cannot change it themselves). **Owner call; `/legal` leans to allowing the recorded answer, marked.**
   *Seasons:* asked each season; an answer covers the photos of that season for as long as they show, until changed.
   Carrying a yes forward silently is the weaker choice for a child whose circumstances changed. *Not everyone in the
   photo:* the sender or the admin may say who is in it, and the rule then reads those players only; otherwise one no
   blanks a team for a season, which invites clubs to work around the rule. *No team:* a photo filed under no team
   shows no recognizable player. *Other people's children:* a photo with another team's players, siblings or the
   crowd cannot be governed by our record and is not shown.
3. **A win photo in News.** Stage 0's line stands for a photo filed under no team and is replaced for one filed under
   a team: the same rule as the team photo, checked every time the page is served. It never enters a share preview,
   a poster, a sponsor placement or a downloadable image (copies cannot be recalled; appropriation of personality).
4. **One Instagram or Facebook post.** Lawful to offer. **Recommended: the post loads only when the visitor taps
   "Show this post"**, with one plain line that Instagram will see they opened it. That keeps Privacy §4 and the
   subprocessor list true as written (it is the map-link position), meets the OPC's "avoid … tracking on websites
   aimed at children" for a site whose audience includes them, and is the Québec-ready shape. Loading at once is not
   unlawful federally or in Ontario; it needs the Privacy §4 cookie sentence and the "not on this list" section
   rewritten first, and it leaves the unverified cookie question open. Caption off by default; the admin may turn it
   on after reading it. The post must be the club's own: one required tick, because Meta's service no longer returns
   the author's name to check against the club's saved address.
   **A family's no must hold here too** (raised by the `/ux` review of the drawing, 2026-11-24). Our own question
   asks about "photos … on its public website". A post that lives on Instagram is outside our record, so the product
   cannot check it; shown on the club's page it would put a child whose family said no on that website. The drawing's
   answer: when adding the post the admin is shown how many families on the chosen team said no, and confirms that it
   is the club's own post and that nobody in it has said no. That is an attestation, not a check, and it is the
   owner's ask A16; a link out with nothing shown on the page is the option with no exposure.
   **A required answer is not a required yes.** The question makes the family pick Yes or No; picking No costs
   nothing. That is an active choice, which the opt-in standard allows, but two reviews read the asterisk as pressure,
   so the helper line says "Choose either one. It has no effect on {child}'s place." A lawyer's eye item with flag 1.
5. **Who pastes.** A coach may send a link to the club the same way as a photo; an admin (or the narrow seat in 7)
   decides. A coach publishing a link directly would put a post the club never read on the club's site.
6. **Storage.** Every picture re-saved on arrival, dropping location and device data (children's location "carries
   heightened risks", Children's Privacy Code). Photos nobody used should not be kept indefinitely (4.5.3): a clock
   is recommended, 12 months unused, the owner's number. A family's no hides at once; deleting the stored photo is
   the club's decision as the responsible organization, on the family's request. Organization deletion already
   removes files; "no backup copy of uploaded files" stays true. **A parent needs a way to ask**: one line on the
   public page pointing at the club's contact, and an admin "Take down" that acts at once.
7. **The narrow seat.** Sound; it reduces how many people need full admin. It sees the photo shelf (children's
   images) and nothing of a family's record. Granted by the owner, as every capability is today.
8. **Images going out.** A team-level win image with no child's name and no player photo carries no personal
   information; nothing is owed. It must never include a shelf photo.
9. **Connecting an account (parked).** If ever built: Meta's platform terms require deleting its data on disconnect or
   on request and using it only as our privacy policy describes; the policy and the subprocessor list's "not on this
   list" section gain a paragraph; tokens are secrets. Nothing to do now.

**Text that must be published before any player photo is public** (a new Privacy Policy and Terms version; the Data
Terms change only with a Terms version):
- Data Terms line 38 and line 138, Privacy line 221: "never shown on public pages" becomes true again by naming the
  one exception. Draft sentence: "A photo is the one exception. Your organization may choose to publish a photo of a
  team on its public pages; we show it only while the parent or guardian of every player your organization says is in
  it has agreed, we never put a name with it, and it comes down when an answer changes."
- Privacy §5 and §9: uploaded photos (who sends them, that location data is removed, how long unused ones are kept),
  and the photo answers.
- Terms "Public pages" (line 75): add photos to the examples, and "you are responsible for who is in a photo you
  publish".
- If an Instagram post is offered: Privacy §4 and the subprocessor list's "not on this list" gain "A post from
  Instagram or Facebook that a club chooses to show. Nothing is sent to Meta unless you tap to show it; then your
  browser loads the post from Meta."
- **This is most likely a material change** (a new kind of information and a new public use), so the version session
  reads Terms §18 and Privacy §13 and plans the notice to existing customers; it is not a quiet minor version.

**Findings for `/plan` (product falls short today):**
- F1. No way for a family to withdraw or change any consent answer in the product, and no code records a withdrawal.
  The photo rule needs one before it ships.
- F2. No take-down route for a parent, and no staff take-down "to protect children" (Terms line 191 promises the power).
- F3. Banner, club logo and tournament logo are stored as uploaded, location data included. Small fix, independent.
- F4. A club's "photo release" as a required document at registration is the pattern in #2025-005. The help text that
  suggests it (`lib/help-content/house-league.tsx:335`) should stop suggesting it once the built-in question exists.

## Sources
- [PIPEDA, S.C. 2000, c. 5, incl. Schedule 1](https://laws-lois.justice.gc.ca/eng/acts/p-8.6/FullText.html) — accessed 2026-11-24
- [OPC, PIPEDA Findings #2025-005 (swimming pool, photo consent)](https://www.priv.gc.ca/en/opc-actions-and-decisions/investigations/investigations-into-businesses/2025/pipeda-2025-005/) — accessed 2026-11-24 (two independent reads)
- [OPC, Guidelines for obtaining meaningful consent](https://www.priv.gc.ca/en/privacy-topics/collecting-personal-information/consent/gl_omc_201805/) — accessed 2026-11-24
- [OPC, Children's Privacy Code, final report](https://www.priv.gc.ca/en/privacy-topics/privacy-for-businesses/protection-of-children-for-businesses/childrens-privacy-code/children-code-final-report-2026/) — accessed 2026-11-24
- [OPC, The application of PIPEDA to charitable and non-profit organizations](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/r_o_p/02_05_d_19/) — accessed 2026-11-24
- [OPC, Policy position on online behavioural advertising](https://www.priv.gc.ca/en/privacy-topics/technology/online-privacy-tracking-cookies/tracking-and-ads/bg_ba_1206/) — accessed 2026-11-24
- [OPC, PIPEDA #2011-006 (social plug-ins)](https://www.priv.gc.ca/en/opc-actions-and-decisions/investigations/investigations-into-businesses/2011/pipeda-2011-006/) — accessed 2026-11-24
- [OPC, MyDemocracy finding (Privacy Act)](https://www.priv.gc.ca/en/opc-actions-and-decisions/investigations/investigations-into-federal-institutions/2016-17/pa_20170719_pco/) — accessed 2026-11-24
- [Jones v. Tsige, 2012 ONCA 32](https://www.ontariocourts.ca/decisions/2012/2012ONCA0032.htm) — accessed 2026-11-24
- [CAI, Lignes directrices 2023-1 (consentement)](https://www.cai.gouv.qc.ca/uploads/pdfs/CAI_Criteres_Validite_Consentement.pdf) — accessed 2026-11-24
- [Bill C-36, 45th Parliament, 1st session (LEGISinfo)](https://www.parl.ca/legisinfo/en/bill/45-1/c-36) — accessed 2026-11-24
- [SDRCC, Interactions Policy, Tier 1 template](https://www.crdsc-sdrcc.ca/eng/documents/Interactions_Policy_Tier_1.pdf) — accessed 2026-11-24 (a norm, not law)
- [Meta, Tokenless access to Meta oEmbed APIs (2026-06-15)](https://developers.facebook.com/blog/post/2026/06/15/tokenless-access-to-meta-oembed-apis/) and [Instagram oEmbed](https://developers.facebook.com/documentation/instagram-platform/oembed.md) — accessed 2026-11-24
- **Not opened (the site refused):** the Québec private-sector Act ss. 4.1, 8.1, 9.1, 12; Civil Code arts. 35–36;
  Aubry v. Éditions Vice-Versa, [1998] 1 SCR 591; Jane Doe 464533 v. N.D., 2016 ONSC 541.

## Lawyer's eye needed?
Yes, before the photo shelf ships, for five things:
1. **Minors' images and withdrawal:** whether "every player the club says is in it" is enough when the club gets it
   wrong, and what we owe a parent who writes to us directly and not to the club.
2. **Whether PIPEDA reaches a non-profit club's photo page**, and so who answers to the OPC: decides how much of the
   rule is law and how much is our own standard.
3. **A club-recorded yes** (paper consent keyed in by an admin): the evidence it gives the club, and us.
4. **The material-change route** for the Privacy Policy and Data Terms sentences: notice, timing, fresh acceptance.
5. **A Meta embed on a site children use:** whether a tap-to-show is enough everywhere we sell, and Québec before the
   first Québec club.
