# Club launch — support posture and rollback runbook

> **What this is:** the owner's page for a club in trouble and a release gone bad, written for the Club release
> (Stage 8 of `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`). Source items: the June checklist
> (`docs/projects/archive/LEAGUE_CLUB_EARLY_ACCESS_READINESS_PLAN.md` lines 36–37: *"Support posture: a documented path
> for cohort issues (who responds, how fast)"* and *"Rollback/runbook if a cohort org hits a blocker mid-season"*).
> **Written 2026-11-18. Read against the code that day; re-read the cited lines before acting on a detail months later.**
>
> **Boundaries — this page points, it does not own:**
> - **The release process itself** (how a promote is gated, tagged, undone, and the safety net before a production
>   database change) is the **Release safety** project: `docs/projects/active/RELEASE_PROCESS_HARDENING_PLAN.md`,
>   finding **T3** and its Stage 1B (item 4: undo covers a many-commit release; item 7: ask before a push to master or a
>   production migration) and Stage 3 (a restore point and a written way back per release; an outside uptime monitor).
>   When those stages ship, their procedure replaces §3 below — do not keep two.
> - **Database backups and restore** are `docs/agents/ops/BACKUPS_AND_RESTORE.md` (daily, kept 7 days, no
>   point-in-time recovery, uploaded files not included, the rehearsal and its trap). Numbers live there only.
> - **The release steps** are `.claude/commands/release.md`; the release record is the release-history memory.

---

## 1. Who answers a club, and how fast

**Who:** the owner. There is no second responder and no rota. **The launch is open, not invite-only (owner
2026-11-18):** any club can buy Club, Club · Association or League Plus at the flip, so the number of clubs is not
capped by an invitation list. This page's by-hand posture holds while the owner can read every message the same day;
§5 names the point to revisit it.

**Where a club reaches us:**

| Door | What happens | Note |
|---|---|---|
| **support@fieldlogichq.ca** | Forwards to the business Gmail (walk §533). The address the Terms name. | `lib/fieldlogichq-contact.ts` |
| **The feedback window** (admin and coach bottom bar, account menu) | Lands in platform admin › Feedback; staff can reply by email within 90 days of the submission. | Reply is one person at a time |
| **"Contact us"** on Billing, the plan-change and team-cap windows | Opens support@ (owner 2026-11-18: no customer ever sees the owner's Gmail; `tests/unit/no-owner-gmail-shown.test.ts` holds it) | `components/billing/PlanMoveDialog.tsx` |

**How fast — what we promise vs. what we aim for:**
- **Promised:** nothing. The Terms (`lib/legal-documents/terms/2026-11-17.md`) say *"we do not promise a response
  time"* (and, at the top, *"We reply to each message"*). **Do not publish a response time** on a page, in an email or
  in help: that changes what the Terms promise and goes through `/legal` first.
- **Aimed for (internal, recommended — owner to confirm):**

| A club says… | Example | Aim |
|---|---|---|
| **Blocked mid-season** | Can't open the club, families can't pay, a schedule or bill won't send, money figures wrong on a board night | Same day; first reply within a few hours in waking hours |
| **Something is wrong but they can work** | A screen error with a way round, a wording problem, a report that reads oddly | Next day |
| **A question or a wish** | How do I…, could it… | Within a few days; answer from the help article where one exists |

**First reply:** acknowledge, say what you are checking, say when you'll write next. Do not promise a fix date.

**Triage, in this order:**
1. **One club or everyone?** Try the same screen on the demo clubs and on another real club's record in platform
   admin. Everyone → §3 (a release problem). One club → its data or its plan state (§4 explains what a cancelled or
   suspended club sees).
2. **Is money involved?** A payment, payout, bill or Stripe figure → open the club's record in platform admin and the
   Stripe dashboard before replying with any figure. Never quote a number you haven't read on both.
3. **Is it a person, not the club?** Can't sign in, wrong page, suspended → §4 "One person".
4. Log it on the club's record (platform admin › the club › notes / Story) so the next reply has the history.

---

## 2. What the owner can and cannot do for a club today

- **Read** the club's record, plan, Stripe state, audit log and its members in platform admin. There is **no
  "view as the club"** (no impersonation). To see what they see, reproduce on dev or ask for a screenshot.
- **Change** its plan, give free time, cancel or end it, put back a plan / limit / section / override
  ("Put it back" never undoes anything that reached Stripe or an inbox).
- **Not** edit a club's own records for them. A data fix is a reviewed script against production — treat it as a
  production database change (§3b).

---

## 3. A promote goes bad

### 3a. The code

1. **Decide fast whether it is the release.** If the problem started at the promote and reproduces on more than one
   club, it is.
2. **Undo the code, not the database** (§3b says why).
3. **Today's undo** is `/release undo` (`.claude/commands/release.md`, "undo" — it prints the steps, never runs them).
   ⚠ **Known gap (Release safety T3):** it reverts **one commit**, and a promote carries many. Until Release safety
   Stage 1B item 4 ships, take the release back to the **previous release** as a whole — the release-history record
   names its commit — and ask `/release` for the exact steps for that release. Do not revert commits one at a time
   on a live incident.
4. **After the undo:** the site is on the previous release; check the screen that broke and one screen that didn't.
   Then write a line in the release-history record (what broke, what was undone, when).

### 3b. The database

- **Migrations are forward-only.** There is no "down" migration. Undoing code does **not** undo a database change.
- **Code undo on a newer database is usually safe**, because migrations go to production *before* the code and are
  additive. **The exception is a dropped column** — the plan puts every DROP COLUMN last, minutes before the push, for
  this reason. If the release dropped a column the previous code still reads, undoing the code will not help; fix
  forward (a new migration or a hotfix) instead.
- **Restoring a backup is for lost or corrupted data, never for a code problem.** Read
  `docs/agents/ops/BACKUPS_AND_RESTORE.md` first. In short: the backup is daily, so a restore loses everything every
  club did since it; it holds no uploaded files; and the Restore button **replaces the live database for every club**.
- **Recommended way to recover data:** restore the backup **to a new project**, read the lost rows there, and put
  back only those rows on production with a reviewed script — then delete the copy (and handle the copy's scheduled
  jobs and keys exactly as that page's "trap" section says). Restoring over production is the last resort, an owner
  decision, and every club must then be told what they lost (§5).
- The written way back **per release**, and a confirmed restore point before every production database change, are
  Release safety **Stage 3** — not built yet.

### 3c. A club hits a blocker mid-season that is not a bad release

A bug that only one club's data shows, or a missing capability they need for Saturday:
1. Find the workaround first (another screen, an export, the owner doing it for them from platform admin where a door
   exists). Tell them the workaround the same day.
2. Fix forward through the normal release; never hot-edit production rows by hand.
3. If they cannot run their season, free time for the affected period is the owner's goodwill door (platform admin ›
   the club › Give free time; a reason is required and logged).

---

## 4. Taking access away, and giving it back

### One person

| Who acts | How | What the person sees | To restore |
|---|---|---|---|
| **The club** (owner or admin with member rights) | Members › the person › **Suspend** | An email ("Your access to {club} was suspended") and a suspended wall on sign-in | **Reinstate** on the same row |
| **The club** | Members › **Remove** | Gone from the club. ⚠ **If this club was their only membership, their whole account is deleted.** Coaches can't be removed here; only an owner removes an owner; the last owner can't be removed. | Invite them again (their account is new) |
| **The owner (platform)** | Platform admin › Users › the person › **Ban** | Can't sign in again. ⚠ **A ban does not sign them out** — also press **Sign out everywhere**. | **Unban** |

Prefer **Suspend** over Remove when a club asks to "lock someone out": it is reversible and keeps the account.

### A whole club

There is **no pause switch** separate from ending the plan. The doors (platform admin › the club):

| Door | When | What the club sees |
|---|---|---|
| **Cancel** | The club is leaving | Everything works until the renewal date, then as below |
| **End now** | Abuse, fraud, a chargeback (a typed reason is required) | At once: every club screen and action refuses ("This organization's subscription has ended"), the admin is sent to Billing, coaches and scorekeepers see the ended wall, the public site closes, tournaments are archived and kept |
| **Keep {plan}** | Withdraws a waiting Cancel | Nothing changes |

A **past-due** club is deliberately *not* locked out.

**To restore an ended club:** change its plan back to active from platform admin. That path also brings back its
public site and its tournaments (up to the plan's limit), and warns if it cannot.
**To let an ended club back in for a while, as a favour:** the club › Access › **Give free time** › **Billing status**
(owner ruling 2026-11-18; the window starts on it for an ended club). It brings the club fully back, the same way
a plan change does: sign-in, the public site, the tournaments up to the plan's limit, and the deletion countdown
stopped. When the free time stops (its last day, End it now, or Put it back) and the club still hasn't paid, it is
closed again exactly as when its plan ended, with a **fresh 90 days** from that day and the owner emailed the new
date. A date end is picked up by the daily job (step `free_time_close_again`), so allow up to a day. A plan or
sections given as free time do **not** let an ended club in (the window says so). If the record shows "bringing
restoring the public site and tournaments failed" or "closing the club again failed", check the club's site and tournaments by hand; the daily job
retries a failed close.

**Delete** removes the club's rows and stored files and cannot be undone. Never use it to suspend.

---

## 5. Who to tell

| Situation | Tell | How |
|---|---|---|
| One club affected | That club's owner (and the person who wrote in) | Reply from support@ |
| Every club affected, fixed within the hour | Nobody unless someone wrote in | Reply to whoever wrote |
| Every club affected for longer, or any data lost | Every club owner | One plain email from support@ to each club owner, by hand: what happened, what they may see, what they need to do (usually nothing), when you'll write next |
| Money wrong (a payment, payout, bill) | The affected club, before they find it | Email from support@ with the corrected figure, read off Stripe and the club's record |
| Personal information exposed | Stop and go to `/legal` first | Privacy law has its own rules about who must be told and when |

**What we do not have:** no status page, no site-wide banner, no "message every club owner" door (platform email
campaigns are marketing only and skip clubs that opted out — never use them for an incident). "What's new" is
release news, not an incident notice. Email by hand is enough while the clubs fit in one sitting; the launch is
open (not capped by invitation), so revisit it — a service-notice door to club owners, and the outside uptime monitor
already in Release safety Stage 3 — before the paying clubs pass ~20 (owner question 4).

---

## 6. Owner questions raised by this page

1. ✅ **RULED 2026-11-18 — no customer sees the owner's Gmail.** Every "Contact us", the emails' fallback contact and
   the feedback reply-to now read support@; the Gmail stays only on mail sent to the owner; a unit test holds it.
2. **Internal reply aims** in §1: confirm them, or set your own. They stay internal.
3. ✅ **RULED 2026-11-18 — free time brings an ended club fully back, and the closing returns when it ends** (all four
   answers as recommended: bring it fully back; email the owner the new date; say, never refuse, a plan or sections;
   close again only clubs free time reopened). Built on dev; §4 says what support now sees. `/legal` 2026-11-18: OK as
   built (Privacy §9 and Terms §9 only promise "kept 90 days", and the window only ever moves later; the re-sent
   "has ended" email stays a data notice). Two follow-ups for the owner, not blockers: **(a)** should the club be
   warned before its free time stops (today it learns of the closing afterwards)? **(b)** should the "has ended"
   email be capped (it repeats each time free time on an ended club runs out)?
4. **Telling every club** is email by hand; revisit before ~20 paying clubs (§5).
5. **An incident email to club owners**: the legal chat confirms it needs no unsubscribe line (owner 2026-11-18:
   left with the legal chat).
6. ✅ **RULED 2026-11-18 — the launch is open**, not invite-only. `/strategy` to log it with the release decision
   (Stage 8's "5–10 Club, invite-only, founder-managed" line is superseded).
