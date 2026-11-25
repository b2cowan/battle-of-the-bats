# Club Website Stage 0 rulings: the owner's four legal questions (A8, A12, A13, A16)
**Last verified:** 2026-11-24
**Re-verify by:** 2027-11-24, or sooner on any of: the Stage 3 (photo shelf) or Stage 4 (News, Instagram post) build
prompt; the Supreme Court of Canada's judgment in Facebook v. Privacy Commissioner (file 41538); Bill C-36 passing second
reading; the first Québec club; Meta changing its embed or cookie terms.
**Depends on facts:** as `MINORS_IMAGES_AND_CLUB_FEED.md` (service provider to the club for children's information;
no Québec customer; guardian tier off; Privacy Policy and Data Terms version 2026-11-24; subprocessor list version
2026-11-23, published).

Not legal advice and not reviewed by a lawyer. It builds on `MINORS_IMAGES_AND_CLUB_FEED.md` (same day; not re-researched)
and adds only what the owner's questions needed. No professional review is a gate (owner 2026-10-31, 2026-11-04).

**Owner ruled both calls the same day** ("yes soften it, take the middle path"): C8 reads "the players in it are from
this team; anyone else is in the background, not the subject" (Recommendation 1), and A12 is the middle path, the
club's own picture from our copy with a plain link to Instagram (Recommendation 2). With the middle path, **no Privacy
§4 or subprocessor-list change is owed for Instagram**, and the Québec point falls away for this feature. The Stage 4
build still reads `/legal` before hand-off. The photo wording owed before any player photo is public is unchanged
(`MINORS_IMAGES_AND_CLUB_FEED.md`).

## Question(s) this answers

The owner ruled Stage 0 on 2026-11-24 (`docs/projects/active/CLUB_WEBSITE_ENHANCEMENTS_PLAN.md` §7) and asked for the
legal logic behind four of the rulings:
1. **A8** (ruled A): why are we so restricted when Instagram and Facebook let anyone post anything; teams play in public
   parks, and someone is always in the background.
2. **A12** (ruled B, the post loads at once): the ramifications.
3. **A16** (ruled A): the logic behind the restriction on a club's Instagram post that shows players.
4. **A13** (ruled A): clubs have their own terms; why does the product police this?

## Finding

**Why a person can post anything on Instagram.** PIPEDA does not apply to "any individual in respect of personal
information that the individual collects, uses or discloses ... for personal or domestic purposes" (s. 4(2)(b), opened
2026-11-24). A parent posting their child's team at the diamond is outside the Act entirely. That exemption is for
individuals only. It never covers a club, and it never covers us.

**Meta is not freer than we are.** Meta is an organization under PIPEDA. The Federal Court of Appeal found that
Facebook breached the Act's meaningful-consent requirement (*Canada (Privacy Commissioner) v. Facebook*, 2024 FCA 140,
as the OPC reports it; the judgment page refused the fetch). The Supreme Court granted leave on 2025-06-12 and heard the
appeal on 2026-03-19. The docket showed no judgment, but the copy read may not be current. Meta also removes a photo of
a child under 13 on a parent's report (Facebook Help Center, "report content involving you, your child (under 13) ...",
opened). Meta's position is that its users publish and it hosts, with a removal route. That is the same shape as a club
publishing on a site we host.

**A photo taken in a public place is not "publicly available" information.** The PIPEDA list of publicly available
sources (SOR/2001-7) covers directories, public registries, court records and publications the person provided
themselves. It does not cover photos, social media or public places (opened). The OPC's Clearview AI finding
(#2021-001, paras 45, 57, 65) rejected the argument that images reachable on the internet are publicly available.
**So "it was a public park" is not a legal exemption under PIPEDA.** What the park changes is the person's reasonable
expectation, which goes to how much consent is needed and how much harm there is, not whether the Act applies.

**A background bystander is not a featured child, in law or in risk.**
- *Québec:* the Supreme Court's *Aubry v. Éditions Vice-Versa* (1998) is widely reported to treat a person who appears
  incidentally (a crowd, the scenery) differently from the photo's subject. **Not verified from the judgment** (every
  court site refused the fetch, again); read it before relying on it.
- *Federal:* the OPC asked Google to blur Street View faces so people are "not identifiable" (advice to Parliament,
  2009-10-22, opened). That concerned systematic capture of whole streets, which is the opposite end from one team
  photo with a parent in the stands.
- *Ontario:* intrusion upon seclusion needs something "highly offensive" (*Jones v. Tsige*); a person in the background
  at a public game does not come close.
- **What makes a featured child on a team page different is what sits next to it.** The page names the team, and a rep
  team page with a public link also shows its schedule: where that team will be on Saturday at 10:00 a.m. A face plus a
  team name plus a place and time is the combination the OPC's children's guidance worries about (location and
  identification). A bystander in the background carries none of that.

**Where our rule is the law and where it is our own choice.**
- *The law (PIPEDA as the OPC applies it, #2025-005):* express opt-in consent for a recognizable child, never a
  condition of signing up, a parent's for a child under 13, withdrawable at any time.
- *Our own choice, stricter than the law:* "everyone in it has said yes", checked every time the page is served, and
  hidden at once on a change. It was chosen because the product can enforce it automatically and a club volunteer
  cannot. It is also what a club board will ask about first.
- *Our own published promise:* the Privacy Policy and Data Terms say children's information is "never shown on public
  pages". That promise is ours and binds us whatever the law says. A new version of each is already owed before any
  player photo is public.

**Loading Meta's script on every visit (A12 = B).**
- Not unlawful federally or in Ontario. No statute requires a cookie banner or click-to-load. CASL does not apply,
  because a web page is not a commercial electronic message.
- Meta says it "uses cookies and receives information when you visit those sites and apps" that use its products,
  "whether or not you have a Facebook or Instagram account or are logged in" (Meta Cookies Policy, opened; it names the
  Like button and "Meta technologies", not post embeds by name). The OPC found in 2011 that Facebook "receives log level
  data every time a user visits a website that hosts a social plug-in" (#2011-006).
- *Children:* the OPC's Children's Privacy Code (final report, 2026-10-20; guidance, not law) applies to an organization
  under PIPEDA whose service is "likely to be accessed by children". Its "Default high privacy settings" expectation has
  a "Third party data sharing" part that treats sharing with third parties as off by default (fragment read; the full
  text was too long for the tool to quote). It has no words on plug-ins or embeds. The OPC's advertising position: avoid
  "tracking on websites aimed at children". A club site is not aimed at children, but it is likely accessed by them.
- *Québec (not verified from the primary text):* Law 25 requires technology that can identify, locate or profile a
  person to be off by default. A Québec club would need the tap version, so "load at once" would have to become a
  setting by province, not one behaviour.
- **A club's discretion does not move this exposure off us.** The club chooses which post to show. We wrote the code
  that loads Meta's script, and we publish the promise "we do not use advertising or tracking cookies". A visitor's
  browser data is ours to describe, not the club's.
- *The middle path Meta allows:* none that avoids Meta. The embed HTML "contains a reference to the Instagram embed.js
  JavaScript library" (Meta's oEmbed docs, opened). Meta removed `thumbnail_url` and `author_name` from the response on
  2025-11-03, so we cannot draw a static preview from Meta's data. An iframe of the post still loads from Instagram
  (not confirmed in Meta's docs either way), so it gives no privacy gain.

## What the product does today

Not re-checked beyond `MINORS_IMAGES_AND_CLUB_FEED.md` (same day). Re-opened 2026-11-24: Privacy Policy 2026-11-24 §4
(`lib/legal-documents/privacy/2026-11-24.md:58-61`, "We do not use advertising or tracking cookies, and we do not use
third-party analytics"); the subprocessor list 2026-11-23 (`lib/legal-documents/subprocessors/2026-11-23.md:4`, "We don't
use advertising trackers", and `:42-56`, "Services that are not on this list, and why", with the map-link model at
`:52-53`). Nothing in this topic is built.

## Recommendation

1. **A8, ruled A: keep it, and soften one line.** The rule's subjects are the players the coach says are in the photo.
   **Recommended for the owner to confirm:** C8's "only that team in the photo" becomes "the players in it are from this
   team; anyone else is in the background, not the subject". The coach's tick should read that way. A recognizable
   child from another team as a subject still needs that family's answer, which we do not have, so it does not show.
   This is supportable because PIPEDA has no public-place exemption but does weigh reasonable expectations, and because
   *Aubry* (unverified) draws the same line. It answers the owner's diamond point without weakening the rule for the
   children the photo is about.
2. **A12, ruled B: what has to happen before it ships, and a middle path to consider.**
   - *Text first:*
     - Privacy §4: the cookie sentence gains its one exception, for example: "One exception: a club may show a post from
       Instagram on its pages. When a page with one opens, your browser loads the post from Meta, and Meta may set its
       own cookies and learn that you visited that page."
     - The subprocessor list's "not on this list" section gains an Instagram entry. Its line 4 ("We don't use
       advertising trackers") and the map-link sentence stay true only if that entry is worded as Meta's own
       collection, not ours.
     - **A material change** to the Privacy Policy (a new third party receives visitors' information). Read Privacy §13
       for notice.
   - *The children point:* guidance, not law. The exposure is an OPC complaint, plus the headline "youth sports
     platform lets Meta follow kids' visits". It is low-probability and high-embarrassment.
   - *Québec:* the first Québec club needs the tap version. Build B so one setting can turn it into the tap.
   - *The middle path, for the owner to consider* (not a reversal of B): **the club's own picture shows at once from
     our copy, with "See this post on Instagram" as a plain link.** The picture is one the club already holds (the coach
     usually sent it), so it goes through our photo rule, which also settles A16. It loads as fast as any page, sends
     nothing to Meta until a tap, and keeps Privacy §4 true as written. The cost is one extra step for the admin (pick
     the picture as well as paste the link), and the post's likes and comments do not show. If the owner keeps B as
     ruled, the text above is what it needs.
3. **A16, ruled A: the logic.** A family's no was given for "the club's public website". A post that lives on
   Instagram is the club's own publication there, and its exposure is the club's. Shown on the club's site, it is a
   second publication, on a page we serve, of a child whose family told the club no. Our photo rule cannot see inside
   the post, so the ruled answer is the club's word (the admin confirms that it is the club's own post and that nobody
   in it has said no). **That is the "club's discretion" the owner wants. It is not us policing.** The product only
   makes sure the club is asked once, at the moment it decides.
4. **A13, ruled A: why the product asks the family at all.** The owner is right that the club is the one responsible:
   our Terms and Data Terms already say so, and we do not check its consent. The product still needs **a yes or no per
   child**, for three reasons that a club's own terms cannot supply:
   - *To show or hide a photo automatically.* A page cannot read a paper form.
   - *Withdrawal.* A family may change its mind at any time (Schedule 1, 4.3.8). With a recorded answer the photo comes
     down at once. With a club's terms it stays up until a volunteer notices.
   - *The usual club photo release is a required tick at registration,* and that is exactly what the OPC found against
     in #2025-005 (a pool's photo waiver as a condition of lessons). If the product relied on it, we would be building
     the found-against pattern into our own sign-up flow.

   **A13 = A already lets the club's own written answers count** (keyed in, marked "recorded by the club" with who and
   when), so a club that collects consent on paper keeps doing so. What we do not accept is one blanket release in place
   of a per-child answer. Relying on a club's terms instead would cost: rewriting the Data Terms and Privacy Policy to
   "your organization decides who may appear; we do not check"; no automatic hide; a weaker answer to a board's first
   question; and, for us as a commercial host, a published promise we could no longer keep.

**What should be added to the club-website plan** (the session that records it, not this agent):
- §7 under A8 and C8: the background-bystander wording above, as an owner call to confirm (it changes C8's "only that
  team in the photo").
- §7 under A12: the text changes before Stage 4 ships, the material-change note, the province setting for Québec, and
  the middle path as an option the owner may take or leave.
- §7 under A13 and A16: "answered by `/legal` 2026-11-24, ruling unchanged" with a pointer here.

## Sources
- [PIPEDA s. 4(2)](https://laws-lois.justice.gc.ca/eng/acts/p-8.6/page-1.html) — accessed 2026-11-24
- [Regulations Specifying Publicly Available Information, SOR/2001-7](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2001-7/FullText.html) — accessed 2026-11-24
- [OPC, PIPEDA Findings #2021-001 (Clearview AI)](https://www.priv.gc.ca/en/opc-actions-and-decisions/investigations/investigations-into-businesses/2021/pipeda-2021-001/) — accessed 2026-11-24
- [OPC, advice to Parliament on Street View, 2009-10-22](https://priv.gc.ca/en/opc-actions-and-decisions/advice-to-parliament/2009/parl_20091022_ed) — accessed 2026-11-24
- [OPC statement on 2024 FCA 140](https://priv.gc.ca/en/opc-news/speeches/2024/s-d_20240909) and [SCC docket 41538](https://www.scc-csc.ca/case-dossier/info/dock-regi-eng.aspx?cas=41538) — accessed 2026-11-24
- [Facebook Help Center, reporting a photo of your child](https://www.facebook.com/help/428478523862899) — accessed 2026-11-24
- [Meta Cookies Policy](https://www.facebook.com/privacy/policies/cookies/) — accessed 2026-11-24
- [Meta, Instagram oEmbed](https://developers.facebook.com/docs/instagram-platform/oembed) and [oEmbed field removals, 2025](https://developers.facebook.com/blog/post/2025/04/08/oembed-updates/) — accessed 2026-11-24
- [OPC, Children's Privacy Code, final report](https://www.priv.gc.ca/en/privacy-topics/privacy-for-businesses/protection-of-children-for-businesses/childrens-privacy-code/children-code-final-report-2026/) — accessed 2026-11-24 (read twice; §"Default high privacy settings" seen by heading and fragment only)
- The rest as cited in `MINORS_IMAGES_AND_CLUB_FEED.md`.
- **Not opened (refused):** *Aubry v. Éditions Vice-Versa*, [1998] 1 SCR 591; 2024 FCA 140 itself; the Québec Act s. 8.1.

## Lawyer's eye needed?
Yes, on two points added here (the five in `MINORS_IMAGES_AND_CLUB_FEED.md` stand):
1. **The bystander line:** whether "background, not the subject" holds under PIPEDA for a commercial host, and
   *Aubry*'s exact paragraphs for Québec.
2. **Loading Meta's script at once on a site children visit:** whether the reworded §4 is enough openness, and the
   Québec default-off rule from the Act's text.
