# Club Tier Readiness, Stage 4e: draw "connect your address" (prompt)

> **Written 2026-10-23**, at the end of the 4e hosting spike (a long chat; this prompt carries what the next one needs). **Paste
> this into a new chat on `dev`.** Other sessions share this working copy (TODO, the Club plan, the PM brief carry their edits):
> stage explicit paths only, and commit only your own hunks.
>
> **This is a drawing session, not a build.** No product code, migration, seed or help article.

## What 4e is, and what is already settled

A club owner connects the club's own web address (e.g. `www.miltongirlssoftball.ca`) once; from then on the club's public pages
answer at it, and its shared links, previews and sitemap use it. Sign-in, the admin and the coaches portal stay on FieldLogicHQ.

**Ruled — do not reopen** (record each as ruled; add nothing):
- 2026-10-19: true hosting through the club's DNS with automatic certificates, never a frame; forwarding needs no build and gets a
  help article; every plan with the public site carries it **at no extra charge** (re-affirmed 2026-10-23 when a $5 add-on was
  raised and declined).
- 2026-10-23, the spike's five asks, all as recommended (`CLUB_TIER_STAGE4E_HOSTING_SPIKE.md` §7): (1) our own host (Amplify),
  nothing built on a front; (2) the club connects **`www`** and forwards the bare name at its registrar, with ALIAS offered where
  its DNS host supports it; (3) the club's **tournament pages** ride its address too; (4) the old `fieldlogichq.ca/{club}` address
  **forwards** to the club's (and search engines are told); (5) on the club's address the **signed-in pieces are hidden**, with one
  "Sign in" link to FieldLogicHQ.
- The AWS domain limit is **not** a blocker (owner): 3 free slots carry the first clubs; a raise to 500 is with AWS (spike §5).

## The facts the drawing rests on (from the spike's proof, 2026-10-23)

| Fact | Consequence for the screen |
|---|---|
| The two records a club must add are known **about 10 seconds** after the owner types the address | Show them on the very next step; no "we'll email you" |
| Record 1: a certificate-check CNAME (`_long-random-name` → `_long-random-value.acm-validations.aws`). Record 2: `www` CNAME → our target | Two copyable rows, each with a copy button and one plain line on what it is for |
| Live **minutes** after the records are right in the proof; AWS says "up to 48 hours" at third-party DNS; the host re-checks every few minutes, then every few hours | A "checking" state that can last a day without looking broken; the owner can leave and come back; a "check now" |
| The certificate renews by itself (the proof's lasted **~198 days**) **only while record 1 stays in place**. Deleted → the site breaks at the next renewal | Say "keep both records for good" plainly; draw the **warning** state (record 1 gone, renewal at risk, date) — the build checks daily |
| A name still attached to another host (a previous provider on the same edge network) is refused | An error state that says what to do (remove it at the old provider), not a code |
| HSTS: once connected, browsers insist on HTTPS for that name for 2 years, even after a disconnect | The disconnect step says so in one sentence |
| Safeguard recommended for the build (spike §7): clubs point `www` at **a name we own** (e.g. `sites.fieldlogichq.ca`), so a future change of host needs no club to touch DNS. Unproven until the build's first test | Draw record 2's value as our own name; mark it provisional |
| Demo clubs can never connect an address | Not drawn for demos; say so in a note |
| No peer (TeamSnap, SportsEngine, TeamLinkt) is self-serve: each ends in a ticket, email or form; each gives the bare name A-record IPs, which we cannot | Our advantage is "no ticket"; our gap is the bare name — the forwarding advice must be clear and kind |

## Read first

`AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (broad reading → a helper; a helper's summary is a lead; disagree out loud). The spike
result `docs/projects/active/CLUB_TIER_STAGE4E_HOSTING_SPIKE.md` (§3 the apex and the peers, §4 the proof, §6 the sizing, §7 the
rulings) and its owner page https://claude.ai/artifact/7PXZEvQexJnUZ8J4d1BnsY. The Stage 4 drawings (shape to follow)
https://claude.ai/artifact/QhdgL1QnfRndu4ZAoTB67k and the Public site builder's drawings (where the owner's public-site controls
live now — find the link in `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 4). The house UI rulings in the auto-memory index
that touch this screen: a record reads first and edits whole; edit autosaves, create asks; a window's foot (sentence left, buttons
right); one loading line; a disabled button fades; absent beats disabled; every highlight is clickable; the phone's secondary
action is its symbol alone. Check each against the code before drawing on it.

## Push back (out loud, in the drawings page, before the work)

1. **Where it lives.** The 2026-10-19 ruling says "in Settings". Since the Public site builder (ruled 2026-10-21) the club's
   public-site controls moved **into the Public site page**: the Look came in from Settings, and the owner-only choices (the on/off
   switch, who is listed as a coach) sit there (`app/[orgSlug]/admin/public-site/page.tsx`: `isOwner`, `CoachNamesPanel`). An
   address in Settings would be the one public-site control left behind. **Make this the first ask**, recommendation stated, and
   draw the door in the place you recommend (and show the other as a thumbnail).
2. **Who may connect.** The ruling says the owner. An admin who manages the site but cannot connect it will ask why. Recommend
   (owner only, an admin sees the state read-only, or both edit) with a reason, as an ask.
3. **Is "forward your bare name" enough?** Volunteers know A records from every peer. If the drawing shows they will be lost,
   say so, and draw the help: the two or three registrars Canadian clubs most use, linked to the help article (written later by
   `/docs`, not here).

## What to produce

1. **One published Artifact** (source `docs/projects/active/CLUB_TIER_STAGE4E_DRAWINGS.html`; load `artifact-design` first), in
   the shape of the Stage 4 drawings: before = today's screen where the door goes; after = drawn at **true size**, a desktop and a
   phone for each frame; NEW / RESTYLED / UNCHANGED tags; clickable flags; one checkbox per option for each ask; a paste-back
   summary at the end.
2. **Frames (the whole journey):** (a) the door: no address connected; (b) type the address (refusals: a bare name without `www`,
   a FieldLogicHQ address, a demo club, not a domain); (c) the two records to copy + the bare-name advice; (d) checking (minutes to a
   day; check now); (e) connected (the address, "your site is at", the date the certificate renews); (f) **warning** (record 1
   removed, renewal at risk, with the date); (g) **errors** (record wrong or missing after a day; name held by another provider);
   (h) disconnect (the HSTS sentence; what happens to the old links). Plus **what changes elsewhere once connected:** the copy-link
   and share lines on the admin and coach screens hand out the club's address; the public-site preview names it.
3. **Words:** provisional, marked provisional. Final words go through `/marketing` **after the owner rules**, before any code (house
   rules: sentence case, "8:00 a.m.", the bare possessive, `npm run check:spelling`). Never say "DNS" without saying where the club
   finds it ("where you bought your domain").
4. **Flow + design:** run `/ux` on the journey (who, where, how long, what goes wrong). Run `/design` on the whole page **before
   the hand-off**, apply its fixes, republish, report what it changed.
5. **Asks:** numbered, each with a recommendation; **ask 1 = where it lives**.
6. **Records, same unit of work:** `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 4 under 4e ("drawn, asks open", the link),
   `TODO.md` (the 4e line only), a PM brief line (what an owner, an admin and a family see differently), and the link into the
   auto-memory file `project_club_stage4e_hosting_spike.md`. Record rulings as ruled.

## Do not

- Build, migrate, seed, or touch AWS or DNS. The proof is done; nothing is attached to the app beyond our own two domains.
- Reopen packaging, the "no frame" ruling, or the five spike rulings. Push back only if a frame exposes a real conflict, and name it.
- Draw the club's public pages themselves (4a–4d drew them); only what changes on them (the address in shared links, the hidden
  signed-in pieces with one "Sign in" link — one small frame is enough).
- Add a navigation change (Stage 13).
- Promise timing in customer words beyond what the facts table supports.

## Definition of done

The drawings page is published and linked from the plan; `/ux` and `/design` have run and their changes are reported; every frame
in item 2 is drawn in its empty, working and failed states; ask 1 is where the door lives; the records say "drawn, asks open"; and a
4e build prompt can be written from the owner's answers plus spike §6 without re-deciding anything.
