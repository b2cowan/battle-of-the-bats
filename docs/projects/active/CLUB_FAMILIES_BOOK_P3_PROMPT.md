# Families Book — Phase 3 session prompt (household actions + the quiet extras)

Paste this into a fresh chat **when the trigger fires** — not before. Phases 1–2 were built to be
independently useful; starting P3 on momentum instead of a trigger is the failure mode the PM brief
warns about.

---

## 0. ⚠ GATES — check every one before writing anything

**Run `git status --porcelain` first** (multiple chats share this working copy; it has bitten
repeatedly — stage explicit pathspecs only, `:(literal)` for bracketed dirs, verify with
`git show --stat HEAD`).

Then verify each gate **from the code and the ledger, not from this prompt** — two earlier prompts
in this project carried claims the code disproved:

1. **Owner QA §54 has PASSED** (`docs/projects/active/OWNER_QA_LEDGER.md`). If it hasn't run, stop
   — P2 has never been seen by human eyes (it is in no rendered sweep), and P3 builds on top of it.
2. **The trigger is real.** One of: a real club actively using the Families area · a privacy
   request that had to be answered · an owner commitment to household money (sibling discount,
   household statement) · the parent-portal decision (§8.2) going live. "It's next in the plan" is
   not a trigger.
3. **Which migrations are on prod.** P2 shipped migs 251–254 as DEV ONLY. If the promote has
   happened, the queue is clear; if not, nothing in P3 changes that rule — code never reaches
   master ahead of its migrations.
4. **For the payment write specifically:** the coach-money QA walks that were owed at P2 time
   (ledger §43–§52 band) have landed. P2 deliberately shipped the family page with **no**
   record-a-payment button because of them.
5. **For the household-money four specifically (discount / assistance / payment plan / credit
   moves): the CHILD-IDENTITY decision (§8.5) is MADE and recorded.** Birth dates exist on ~1 of
   163 roster rows; "siblings" is a name-guess. These features pay real money against that guess.
   **If §8.5 is undecided, those four are OUT OF SCOPE for this session — do not let the build
   settle it by accident.** The right move is a short owner decision session first (options: require
   a birth date somewhere · adopt an explicit child record — `rep_player_continuity_links` is the
   candidate seam · accept the inference in writing with failure modes named).

---

## 1. Read first, in this order

1. `docs/projects/active/CLUB_FAMILIES_BOOK_PLAN.md` — **§5.3 (the P2 design decisions — several
   are BINDING on P3), §5.4 (what P2 actually built + the review lessons), §8 (open questions).**
2. `docs/projects/active/CLUB_FAMILIES_BOOK_PM_BRIEF.md` — the commercial why.
3. The P2 mockups (`claude.ai/code/artifact/e7cc6d9c-343e-45eb-8b94-fb9984f2b949`) — the house
   style any new screen must match, and the record of what was deliberately cut from P2.
4. Migration 251's header — the **Phase-3 warning it recorded on purpose**: once former addresses
   exist, an opt-out filed under a former address must suppress the current one, **checked through
   the PERSON, not the address**. P2 closed this for its own message door (inside the
   `sendFamilyEmail` choke point, `personEmails`); **P3's job is to close it for EVERY door.**
5. The Phase 1 report: `node scripts/report-families-backfill.mjs` — section 5 counts exactly the
   conflicts P3's preference work must resolve (opt-outs on file, people with >1 address).

---

## 2. Scope

**⚠ P3 starts with its own MOCKUP SESSION** (standing rule: every new surface gets an owner-approved
mockup before build; P2's mockup session explicitly declined to design these screens). Design in
the existing artifact's house style; current-state-first; thin states first. Then build.

**In — the unblocked six, in this order:**

- **A · Contact preferences attached to the person (THE correctness fix).** Today opt-outs/consents
  live keyed on (org, email) and the person inherits them by join. P3 attaches them to the person
  with **strictest-wins** resolution, and — the real deliverable — **moves the through-the-person
  suppression check into the shared send path for ALL family email**, not just the Families message
  door. Every existing sender (coach announcements, league email, dues reminders) must come out the
  other side unable to mail a person who opted out under any address they ever used. This is the
  one piece of P3 that is pure correctness, and it goes first.
- **B · Record a payment against the family** (gate 4). Two doors, one mechanism — the write goes
  through the SAME path the money hub uses; if no shared path exists, extract one, never fork.
  Splitting one payment across children is in scope; how credits apply is NOT re-derived here
  (P2's rule: the money module owns that arithmetic).
- **C · A real per-family send log.** P2 killed the "Last contacted" column honestly — nothing
  records per-recipient family email (announcements store counts only, BY DESIGN — data
  minimization). P3 decides this properly: either a per-recipient log with a stated retention
  posture, or a per-household "last message" stamp. **A decision with a privacy story, not a
  column smuggled in.** Same unit of work: the message door's missing **rate/idempotency cap**
  (the announcements path has a 24h cap; Families has none — recorded as accepted debt in §5.4).
- **D · Second guardian: the write.** P2 shows co-guardians the data already names (verified links
  only — that filter is load-bearing, see §5.4's Critical). P3 adds "add/invite a guardian",
  through the existing family-link invitation path.
- **E · Internal notes** — author + date, admin-only, never family-visible.
- **F · The person↔staff match** ("also an assistant coach") — optional, smallest. The join is
  guardian email → auth account → staff membership; normalize the account email side explicitly
  (nothing guarantees it is stored lowercase). A WRONG match shows a person a role they don't
  hold — propose, verify, never assume.

**Out:**
- The household-money four unless gate 5 is green — and even then, they get their own mockup pass.
- The bounced/undeliverable flag (P4 in the catalogue).
- Retention/erasure (§8.4 — its own decision; note `org_person_merges` snapshots and any new send
  log land inside whatever is decided there).
- Anything coach-facing or parent-facing (§8.1 / §8.2 — owner decisions, not build items).

---

## 3. Settled — do not reopen (P2's decisions bind you)

- One org-wide email switch; no per-channel toggles without a consent story.
- Money is asymmetric: rep = ledger dollars, league = paid/not-paid. Never summed.
- Children are joined through the PARENT; no sibling claim from a name match — anywhere, ever.
- `status='verified'` on family links is LOAD-BEARING in every household read (§5.4 Critical — a
  revoked guardian is a coach's explicit removal; custody disputes are the canonical case).
- Attachment has ONE home (`families_attach_people`, run on area entry). **No per-route minting**,
  including any new P3 write path.
- Merging is never automatic; merges are one transaction (`families_merge_people`); "not the same
  person" tombstones are permanent.
- The Families capability stays off by default for every role — pinned by
  `tests/unit/families-access-guard.test.ts`; changing that is an owner decision, not a cleanup.
- Every read answers TWO questions: holds the capability AND the record belongs to this org.

---

## 4. ⚠ Lessons P2 paid for — carry them

- **Verify every claim in this prompt against the code.** Two earlier prompts in this project were
  wrong in ways only the schema/code revealed; P2's own build found mig 251 had silently broken
  every league registration insert. Read the guard tests and the live schema, not the prose.
- **Closed lists don't learn about new things.** P2's new module was invisible to the
  feature-matrix drift detector and the cancellation shutdown copy (both closed maps, both
  compile-silent). Anything P3 adds that other systems enumerate — a new capability, a new consent
  basis/scope, a new send kind — gets grepped for every closed list that should know about it.
- **Compliance writes are awaited, never fire-and-forget** (the Amplify teardown gotcha). The
  confirmation email may be void; the ledger row may not.
- **Stale-response guards on every new PII screen** (org-switch must never paint another club's
  families).
- **Dates through `formatStoredDate`, colors through tokens** — the deterministic gate catches
  both, but don't make it.
- **The Families screens are in no rendered sweep.** If the layout-screens work has landed by P3
  time, add them; if not, owner QA remains the only visual coverage and the QA entry must say so.
- Fixture club `qa-families-fixture` (`node scripts/seed-families-fixture.mjs`) is the test bed —
  extend it with P3's cases (a second-guardian invite, a payment split, a preference conflict)
  rather than inventing a new world. Never seed into `riverdale-*`.

---

## 5. Definition of done

- Mockups owner-approved before build; the plan gains §5.5 recording P3's decisions and build.
- Chunk A provably closes the through-the-person hole for **every** sender (a test that mails an
  opted-out-under-former-address person through each path and sees zero sends).
- Every write goes through an existing shared path or an extracted one — named in the plan.
- Migration(s) + data dictionary + snapshot refresh in the same unit of work; new tables RLS'd;
  dev-only until the owner's promote step.
- `/simplify` → `/review` (this will be high-risk again: money writes + consent + PII) → `/docs`
  (the Families guide gains the new actions; the send-log decision gets an FAQ).
- Owner QA ledger gains its section; TODO.md line updated; PM brief updated in the same unit.
- Tests: the access-guard test extended for anything new that must stay off by default; a
  strictest-wins preference test; a payment-write two-doors test.
