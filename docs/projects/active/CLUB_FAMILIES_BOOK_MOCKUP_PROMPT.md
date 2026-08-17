# Families Book — Phase 2 mockup session prompt

Paste this into a fresh chat. **This is a DESIGN session. Write no code.**

---

## Your task

Produce the **Phase 2 mockups** for the Families area, published as a Claude Artifact.

You are **not** starting from a blank page. Approved mockups already exist and are good:
`claude.ai/code/artifact/f089153c-8583-4c5c-b8c3-d70c5278602b`. Your job is to take them to buildable
— which means resolving the places where they promise something the product cannot honestly deliver,
and adding the screens they never covered.

Read first, in this order:

1. `docs/projects/active/CLUB_FAMILIES_BOOK_PLAN.md` — **§5 (the reordered phases), §5.1 (what Phase 1
   actually established), §5.2 (where the mockups promise more than the data can keep), §8 (open
   questions).** §5.2 is the spine of this session.
2. The existing mockups (above).
3. `docs/projects/active/CLUB_FAMILIES_BOOK_PM_BRIEF.md` — why this exists commercially.
4. Phase 1's report, so the numbers below are yours and not hearsay:
   `node scripts/report-families-backfill.mjs`

---

## 1. Scope

**In — five screens:**

1. **The worklist**, as the landing. Not an A–Z list.
2. **The family page**, where a worklist row lands.
3. **The duplicate review queue.**
4. **⚠ The empty and thin states** — never mocked, and not an edge case here. See §3 below.
5. **⚠ The permission surface** — how an admin is granted the Families capability, and what the area
   looks like to someone without it. Never mocked.

**Out — do not design:**

- Anything from the plan's P3 (sibling discount, financial assistance, household payment plan, moving
  a credit between siblings, bounced-address flag, internal notes). The first four are **blocked on
  an open question** (§8.5) and mocking them invites a promise we cannot keep.
- Any coach-facing surface. Families is admin-only (owner decision).
- Any parent-facing surface. Open question §8.2, deliberately not in this project.

---

## 2. Settled — do not reopen

- **Tiers: Club AND League.** League is first-class.
- **Access: a dedicated Families capability, off by default.**
- **Actions live inside the Families area** — but every action **writes through the same code path as
  the equivalent action on its existing surface**. Two doors, one mechanism. This is a design
  constraint too: if your mockup implies a *different* flow from the existing screen, you have forked
  the write in the design and someone will fork it in the code.
- **Org-scoped, never platform-wide.** The same parent at two clubs is deliberately two records.
- **Worklist-first, with actions in the first release** (owner-approved 2026-08-17). The plan's
  earlier read-only-directory ordering is dead; §5 explains why.
- Naming: the area is **Families**. Not Members (already means staff), not People.

---

## 3. The data you are actually designing for

⚠ **Design the thin states FIRST, not last.** These are not edge cases — on real data they are most of
the screen. Every number below is from Phase 1's live run, not an estimate:

| Reality | Consequence for your mockup |
|---|---|
| **64 of 163 roster children name no parent at all** | Two in five rows in the worklist's own source data cannot join a family. What does the worklist show for them? Are they in it? |
| **117 people, and family invitations exist for only 12** | Most families will show one guardian, no second guardian, and no portal access. The mockup's Guardians panel is near-empty for ~90% of families. |
| **0 parents span rep AND house league** | The single most valuable thing this project promises has never once occurred in the data. Design what the family page shows when it is the ordinary one-programme case. |
| **0 duplicates, 0 former addresses** | The merge queue and the "former email" search are the *reason* for the project and both render empty today. The queue's empty state matters as much as its full one. |
| **Birth dates on 1 of 163 rep roster rows** | "These two children are siblings" is a guess. Do not design a screen that states it as a fact. |

**A messy fixture club is chunk A of the build** (plan §5, P2·A) precisely so these stop being zero.
You are designing ahead of it — so design for both the thin reality and the populated ideal, and say
which is which.

---

## 4. ⚠ Verify before designing — this plan has been wrong repeatedly

Three claims in the first draft of this plan were corrected by the schema, and Phase 1's build prompt
contained two more errors. **Argue from what the code and data do, never from what a document says.**

**Already settled — do not re-introduce (both proven during Phase 1):**

- ❌ **"Team emails · On / Club newsletter · Opted out" — the data has ONE switch, not two.** The
  opt-out list is deliberately org-wide and channel-less. Its own words: *an opt-out suppresses ALL
  family email from this org, which is the honest reading of a parent clicking unsubscribe in a team
  email.* Designing two toggles means either designing per-channel preferences properly (a real
  change with a consent story attached) or showing one honest switch. **Do not draw the second row
  and leave it to the builder.**
- ❌ **A household balance is NOT symmetric across the two programmes.** A rep child has real dues —
  schedules, installments, credits. A house-league child has a *paid / not paid* flag against a
  registration fee. The existing mockup shows dollar amounts for house-league children. Decide, and
  say which you chose.

**Verify yourself, from the code, before you draw them:**

1. **"Last contacted · 3 Aug · dues reminder"** — is there a per-family record of what was sent, or
   only per-batch? This worklist column and the family page's "What we've sent them" panel stand or
   fall together.
2. **A child's history spanning rep AND house league** (the mockup's *"Amara — 2024 · House league"*).
   Rep-to-rep across seasons is already linked. **Rep-to-league is not, and cannot be without the
   child-identity decision.** Likely answer: show them as separate rows rather than claiming they are
   one child — honest and still useful. Make it a stated design call, not a discovery mid-build.
3. **"also an assistant coach, Hawks U11"** — the existing mockup's own caption calls this one of the
   three things that justify the person record. It needs a person↔staff match that Phase 1 did not
   build. Check what it would take before promising it.
4. **Forms and consent per child** — rep document templates exist; whether house league has any
   equivalent is unverified. If it does not, the family page's forms panel is rep-only.
5. **Where Families sits in the admin navigation.** The existing mockup's tab strip
   (*Teams / House league / Families / Money / Settings*) is a simplification, not the real nav.
   Read the actual admin sections and place it truthfully.
6. **⚠ Which capability system.** There are TWO and they are unrelated: the typed **coach** capability
   grants (assistant-coach permissions on a team) and the **org member** capability map (a free-form
   record on an org membership, alongside the role). **Families is an ORG-ADMIN capability, not a
   coach one.** Do not model the permission surface on the coach one.

⚠ The **lesson** that does transfer from the coach side: the player-documents leak happened because a
surface checked **one** permission where it needed **two**. Your permission mockup should make it
obvious *which family's* data is being authorised, not just *whether the viewer is an admin*.

---

## 5. The deliverable

**One Claude Artifact**, in the house style of the existing Families mockup — which is itself a good
model: screen-by-screen, each mockup followed by a caption saying what it proves and what it costs.

It must contain:

- The five screens in §1, each in both a **populated** and a **thin/empty** state.
- **A short section resolving each of §5.2's seven gaps** — for each, what you decided and why. This
  is the part that makes the artifact buildable rather than aspirational. A gap you route around
  silently will be discovered by the builder at the worst moment.
- **Anything you think is wrong.** The existing mockups were written before Phase 1 ran and before
  anyone knew two in five children name no guardian. If a screen no longer makes sense, say so.

Publish it as an Artifact and give the owner the link. Then add a short section to
`CLUB_FAMILIES_BOOK_PLAN.md` pointing at it and recording the decisions — the plan is the durable
record; the artifact is the picture.

---

## 6. ⚠ Concurrent work — check this FIRST

**Run `git status --porcelain` before anything else.** Multiple chats share one working copy, and this
has bitten repeatedly.

At the time of writing, **another session was actively working and had files STAGED in the shared
index, including deletions.** A plain `git commit` would have swept all of it into someone else's
commit. Phase 1 was committed with explicit per-path commits to avoid exactly that.

**A design session should barely touch the repo at all** — the artifact lives outside it, and your
only file change should be the plan. That is your protection: keep it that way. Stage explicit
pathspecs, never `git add -A`, and run `git show --stat HEAD` afterwards.

`TODO.md` is a known coordination point — it has been carrying another session's uncommitted
post-release edits. Add your line, but **do not commit it** without checking who owns the rest.

---

## 7. Definition of done

- The artifact is published and the owner has the link.
- All seven of §5.2's gaps are resolved in writing, each with a decision and a reason.
- Thin states designed for all five screens.
- The plan records the outcome; no code, no migration, no route, no component has been written.
- If you found the existing mockups wrong somewhere, that is a **successful session**, not a failed
  one. Say so plainly.

---

## 8. What matters most

**The worklist is the product; the family page is where a row lands.** The plan's §2 says a lookup
tool is opened when something goes wrong and a worklist is opened every Monday — and then the phase
list contradicted it for three revisions before the owner corrected it. Do not quietly slide back to
designing a directory with a search box, because that is the version that gets built and never
opened.

**And be honest about emptiness.** This area concentrates every family's contact details, consent and
balances on one screen, and today it would render mostly blank. A mockup that shows only the
populated ideal is how a team builds a screen that looks broken on the day it ships.
