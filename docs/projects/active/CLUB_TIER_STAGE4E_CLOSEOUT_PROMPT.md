# Club Tier Stage 4e: a club's own web address, the close-out (prompt)

> **Written 2026-10-24.** **Paste this into a new chat on `dev`.** The 4e build prompt
> (`docs/projects/active/CLUB_TIER_STAGE4E_BUILD_PROMPT.md`) ran: Parts 1–6 and the review fixes are committed. This prompt
> takes 4e from "built" to "walked and closed". It does **not** reopen a single ruling in the build prompt. Other sessions share
> this working copy (TODO, the Club plan, the PM brief, the ledger carry their edits): stage explicit paths only, commit only
> your own hunks, and check `git show --stat HEAD` after every commit.

## What is already done (verify against `git log`, do not trust this table)

| Part | Commit | What it made true |
|---|---|---|
| 1 · correctness | `9295ac4f6`, `9526604ea` | the old shortcuts, robots and the sitemap know a club's own address is not ours |
| words | `ea961b2fb`, `98d9e9488` | every string through `/marketing` (`CLUB_TIER_STAGE4E_COPY.md`) |
| 2 · storage + connect | `53ddd0526` | the address is stored; the owner can connect, check, start again and stop |
| 3 · the Web address row | `da30272f4` | frames a–h on the Public site page |
| safeguard proof | `1307cb6fe` | **passed** on the owner's test domain; record 2 is `sites.fieldlogichq.ca` (kept in our zone) |
| 4 · the club's address serves the club | `43dfee827`, `815821a91`, `b05c6613a` | the host maps to the club; links, the forward, canonical, sitemap, signed-in pieces absent |
| 5 · the share census | `38ac35938` | every copy-link screen hands out the club's address once connected; a test makes new ones choose |
| 6 · the status check + four emails | `3635cda61` | the route and the rules; **nothing runs by itself yet** |
| review fixes | `907c2f459` | four finders over Parts 1–6; nothing crossed clubs or reached admin/auth |

The apex proof was **dropped** by the owner on 2026-10-23 (spike §4: it cannot be tested faithfully with the zone in our own
account). The "my club uses ALIAS" control stays undrawn and unbuilt: bring it drawn only if the end-to-end run below says a
club needs it.

## The close-out log (the only place a step counts as done)

Add a checklist **"4e CLOSE-OUT LOG"** under Stage 4e in `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6
(one `[ ]` line per step below) **before you start**. If it already exists, another chat began this: start at the first
unticked line and re-run nothing ticked. **Tick each line the moment its step finishes**: date, one-line result, files changed
(or "no changes"). A skipped or blocked step gets `[–]` and its reason. Never batch ticks at the end.

## Steps, in order

**0 · Read and re-verify (no writes).** The build prompt's "What 4e makes true", the rulings and the definition of done; the
drawings https://claude.ai/artifact/QiwFeccoRW5XmAnPwfDuVa; the spike §4–§6; the four 4e commit bodies above (Part 6's and the
review fixes' carry the details). Check, read-only, and report in one line each:
- AWS's answer on the quota request `3cf4d5a0e00041faa1a671c4e4b4136cDiAVWLwq` (500 domains per app). Not a blocker either
  way.
- That the app's AWS access exists in `.env.local` **and** in both Amplify branch environments (dev and production), limited to
  the four domain-association calls on this one app. If production lacks it, that is a prod step to record, not to do.
- That `/simplify` ran over Parts 1–6. If no commit or record says so, it is step 3.

**1 · An owner decision the review left open: does a club have to prove it owns the address before we hold it?** The review
fixes' commit says "proof that a club owns the address it connects (a per-club record 2 name) is an owner decision, raised
separately", and **no record shows it was raised.** Do this before anything is switched on:
- **Find out what the product does today**, from the code, for the squatting case: club A connects `www.someoneelse.ca`
  without controlling it. Nobody can serve on it (the padlock record proves control), but the name is **unique across
  clubs**, so A's waiting row may block the real owner. Answer: how long the hold lasts (does "gave up after two days" release
  the name, or does a `not_connected` row keep holding it?), whether the real owner sees a useful refusal, and whether
  platform admin can release a name by hand.
- **Bring the owner one question with a recommendation.** Unless the code says otherwise, the recommendation is the cheap
  one: a name is held only while waiting or connected, a gave-up row releases it, the real owner's refusal says "another
  club is connecting this address; if it is yours, write to us", and platform admin can release a name. Per-club record 2
  names (one target per club, so only the club holding the DNS can complete) are the heavier answer: they change the drawn
  records and the copy, so they come back to the owner drawn, never built on the way past.
- Build only what the owner rules. Its own commit.

**2 · Switch on the status check (watched automation).** The pg_cron job that calls the Part 6 route **every 15 minutes**.
This needs **the owner's yes in your chat, for this job** (an earlier yes in another chat does not carry over, `AGENCY_RULES.md`
"Shared agent automation"). Ask with: what runs, how often, against which database, and the load from Part 6's commit (per
connected club: 24 DNS lookups a day for record 2, plus once a day one DNS lookup, one host read, one certificate read and one
HTTP request; a wake with nothing due writes nothing). Dev first. **Its own commit**, and the message says what now runs by
itself and how often (never "rename" or "wire up"). The production job is a prod step: a `MANUAL_PROD_STEPS.json` entry, not
an action. Confirm `npm run check:automation` lists the commit.

**3 · `/simplify`** over the 4e change only (if step 0 found it not run). New abstractions to look at: the host table and its
cache, the link helper that drops the slug on a club host, the public-origin helper and its census test, the tick's state
machine. Then re-run the unit tests.

**4 · Part 7: help and the demos.** `/docs`: one article, "Use your club's own address" — the two records, keeping record 1
forever, forwarding the bare name at GoDaddy, Namecheap and Hover (look at each registrar's current screens, do not write from
memory), the ALIAS route in one paragraph, email is not affected, Stop and the two-year padlock rule. The "Copy both as a
message" text links to it. Demo clubs: the row shows and refuses on Next (verify; build if missing). Leave a one-line note for
the next `/demos` pass on whether the shop window shows a connected example; do not change a demo here.

**5 · The real connection, end to end, on dev, with the owner's test domain (`b2cowan.com`).** The owner does the DNS steps;
you script them in the chat one at a time and check each result. Connect `www` (or `club.`) on the fixture club → the two
records appear → the owner adds them → Check now says Found → the host reaches live → **the live email arrives** (the job from
step 2 sends it) → the club's pages and one tournament page answer on the club's address → `fieldlogichq.ca/{slug}/…`
forwards when signed out and does not when signed in → the copy-link screens hand out the club's address → remove record 1 →
the warning and its email → put it back → it clears by itself → Stop → everything reverts (the forward, the handed-out
address, the row). Record each step's result in the log. Remove the test association at the end. A failure here is a fix
before the walk, in its own commit.

**6 · `check:layout --changed`** on the Public site page and Settings (dev server, not a whole-product sweep).

**7 · The walk(s).** Checkable Artifacts, one purpose per walk (memory: QA walks). Two walks:
- **A · The owner's journey on the Web address row**: frames a–h at 1440 and 390, owner and admin, Warm and Dark; the
  refusals; the admin's read-only view; Stop.
- **B · What families, coaches and staff see once connected**: the club's address in the browser, the forward, Sign in
  returning to the same page on FieldLogicHQ, the copy-link screens, the staff links that stay on FieldLogicHQ on purpose.
Owner QA Ledger sections: take the next free numbers **at write time** (§370 was the last at the time of this prompt).
Each walk leans on the step 5 run for anything that needs live DNS, so the owner is not asked to edit DNS twice.

**8 · Records, once the walks pass.**
- The Club plan §6 Stage 4e: built, the commits, the walks and their results, "4e CLOSED".
- TODO's Stage 4e line (it still says "build prompt written, not run"): one line, the positive facts with anchors.
- The PM brief's 4e line; the project index (`ArtifactData`, artifact `MBKRySURVFu3V9cZJvmjVr`: read the stage first and pin
  `if_version`).
- `MANUAL_PROD_STEPS.json`: the migration, the app's AWS keys in the production branch environment, the pg_cron job.
  `sites.fieldlogichq.ca` is already in our zone (it serves both environments).

## Do not

- Reopen packaging, the no-frame rule, the spike's five rulings or the drawings' seven asks.
- Create or change any scheduled job, hook or production setting without the owner's yes **in this chat**; never inside an
  unrelated commit.
- Widen `isTrustedAppOrigin`, share the session across hosts, or put sign-in on a club's address.
- Write to AWS or anyone's DNS without the owner's yes in your chat; leave behind anything a test created.
- Add a navigation change (Stage 13), a plan gate or a price.
- Push or promote.

## Git

`dev` only. Explicit pathspecs. One commit per step that changes code; step 2 alone in its own commit.


## Notes for /demos

- **Shop window (2026-10-24):** it shows NO connected example and cannot: both demo clubs are on the server's refusal list (`connectClubDomain` answers `demo`, "The demo club can’t use its own address. Your club can, from this row."), and neither is a club-plan site (one is a tournament organization, one a coaches portal), so the Web address row is not a demo screen. Nothing in the demos changed.
