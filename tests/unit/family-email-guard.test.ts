/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **EVERY DOOR INTO A GUARDIAN'S INBOX IS ACCOUNTED FOR** (audit + fixes 2026-08-18,
 * CLUB_FAMILIES_BOOK_PLAN.md; owner ruling the same day that dues are transactional).
 *
 * A family can unsubscribe from their club's email. That promise is only as good as the number of
 * senders that honour it — and in August 2026 an audit found it was kept by three of ten. The rest
 * had not routed around the guard on purpose; they were written before it existed and never moved.
 * Nothing failed, nothing logged, and every screen rendered perfectly.
 *
 * So the thing worth testing is not one function's behaviour. It is that **the set of senders stays
 * enumerated**, with each one's posture written down:
 *
 *   - `guarded`      → goes through `sendFamilyEmail`, which refuses an opted-out recipient and
 *                      stamps the club's name plus an unsubscribe link on the way out.
 *   - `transactional`→ deliberately skips the suppression check. A family cannot mute a bill, or an
 *                      offer of a roster spot, by unsubscribing from announcements (owner ruling
 *                      2026-08-18). These still identify their sender — that half is not optional.
 *   - `known-gap`    → skips it and should not. Listed so it stays visible instead of becoming
 *                      folklore.
 *
 * ⚠⚠ **SCOPE LIMITS, so this is not mistaken for coverage.** This is a source SCAN, and it proves
 * only what it can read:
 *
 *   1. **It does not execute a send.** That an opted-out address is actually refused is asserted by
 *      the shape of `lib/family-email.ts` below, not by mailing anyone. A logic bug inside the
 *      guard would pass here.
 *   2. **The drift check is a heuristic.** It flags a file that calls raw `sendEmail` *and* mentions
 *      a guardian-shaped recipient. A new sender that names its recipients something else — as
 *      `lib/basic-coach-announcements.ts` does — slips past it, which is exactly why the manifest
 *      below is hand-maintained and not derived.
 *   3. **It cannot see a NEW kind of family mail that does not exist yet.** No closed list can. The
 *      manifest is a record of an audit, and it goes stale the day someone adds a sender without
 *      reading this comment.
 *
 * If an assertion here fails, the change is not necessarily wrong — it just is not recorded yet.
 * Decide the posture, then edit the manifest in the same commit.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..', '..');
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');

/**
 * Source with comments removed.
 *
 * ⚠ Not a nicety — the first version of this file asserted against raw text and was wrong in BOTH
 * directions. It failed on a doc comment that merely described the old design, and (much worse) it
 * would have PASSED if someone deleted the suppression code while leaving the paragraph explaining
 * it. A guard that reads prose proves the prose.
 */
const codeOf = (rel: string) => {
  const withoutBlocks = read(rel).replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Line comments, per line, and only when the `//` is not inside a string or URL. Anything
  // before it on the line that opens an unclosed quote means we are inside a literal, so leave
  // the line alone rather than truncating it. Guarding only on a preceding `:` (the first
  // attempt) protected `https://` and nothing else — a doubled slash in a path string or a
  // regex literal would have silently eaten the rest of the line, WEAKENING an assertion
  // instead of breaking it. A guard that fails quiet is the thing this file exists to stop.
  return withoutBlocks.split('\n').map(line => {
    for (let i = 0; i < line.length - 1; i++) {
      const c = line[i];
      if (c === '"' || c === "'" || c === '`') {
        const close = line.indexOf(c, i + 1);
        if (close === -1) return line;   // unterminated literal — do not guess
        i = close;
        continue;
      }
      if (c === '/' && line[i + 1] === '/') return line.slice(0, i);
    }
    return line;
  }).join('\n');
};

/** Calls the raw transport. Does NOT match `sendFamilyEmail(` — different identifier. */
const CALLS_RAW_SEND = /\bsendEmail\s*\(/;
const CALLS_GUARDED_SEND = /\bsendFamilyEmail\s*\(/;

type Posture = 'guarded' | 'transactional' | 'known-gap';

/** Every module that puts a message in a GUARDIAN's inbox. Ten doors, audited 2026-08-18. */
const FAMILY_SENDERS: { file: string; posture: Posture; what: string }[] = [
  // ── Announcements: the club talking to families. All guarded. ──────────────────────────────
  { file: 'app/api/admin/families/[personId]/message/route.ts', posture: 'guarded',
    what: 'Message this family, from the Families area' },
  { file: 'lib/rep-team-announcements.ts', posture: 'guarded',
    what: 'A paid rep coach\'s team announcement' },
  { file: 'lib/family-notify.ts', posture: 'guarded',
    what: 'Game updates to followers when a coach saves a score' },
  { file: 'app/api/admin/house-league/seasons/[seasonId]/email/route.ts', posture: 'guarded',
    what: 'The house-league season broadcast — guarded 2026-08-18; before that it was a bulk ' +
          'announcement carrying no unsubscribe link at all, the clearest exposure in the audit' },

  // ── Transactional: money owed, and a place on a roster. Suppression skipped ON PURPOSE. ────
  { file: 'app/api/coaches/[orgSlug]/teams/[teamId]/dues/send-reminders/route.ts', posture: 'transactional',
    what: 'A coach\'s "Send due reminders"' },
  { file: 'app/api/coaches/[orgSlug]/teams/[teamId]/dues/remind-unpaid/route.ts', posture: 'transactional',
    what: 'A coach\'s "Remind unpaid" — the fifth hand-built copy of the dues email' },
  { file: 'app/api/admin/rep-teams/dues/send-automated-reminders/route.ts', posture: 'transactional',
    what: 'The org admin\'s dues wave' },
  { file: 'lib/dues-reminders.ts', posture: 'transactional',
    what: 'The nightly automatic dues sweep — unattended, so the least visible of the four' },
  { file: 'lib/tryout-notifications.ts', posture: 'transactional',
    what: 'Tryout offer, waitlist and release. Suppressing these would cost a child a roster spot ' +
          'because a parent unsubscribed from newsletters two seasons ago' },

  // ── The one that is simply wrong, kept visible. ────────────────────────────────────────────
  { file: 'lib/basic-coach-announcements.ts', posture: 'known-gap',
    what: 'The FREE-tier coach\'s "Email families". Identical in kind to the paid coach\'s ' +
          'announcement above, which IS guarded — so today whether a family\'s opt-out is honoured ' +
          'depends on what their club pays. NOT fixable by routing it through the choke point: ' +
          '`basic_coach_teams` has no `org_id`, and both the suppression list and the unsubscribe ' +
          'token are keyed on an org. Closing it needs its own per-team opt-out record, which is ' +
          'an owner decision. Do not "fix" this by deleting the line.' },
];

/** Matches the drift heuristic but mails STAFF, not families — invitations to join an org. */
const NOT_FAMILY_MAIL = [
  'app/api/admin/members/invite/route.ts',
  'lib/invite-links.ts',
  'lib/email.ts', // the transport itself
];

describe('Family email — the choke point keeps its shape', () => {
  const src = codeOf('lib/family-email.ts');

  it('suppression expands THROUGH THE PERSON, not just the address it was filed under', () => {
    assert.match(
      src, /org_person_emails/,
      'getFamilySuppressionList no longer reads org_person_emails. That read is what makes an ' +
      'opt-out filed under a FORMER address silence the current one — the trap migration 251 ' +
      'recorded on purpose. Without it a parent who changes their email is silently re-subscribed.',
    );
  });

  it('the suppression read is PAGED — a silent 1000-row cap would under-suppress', () => {
    assert.match(
      src, /\.range\(/,
      'The suppression reads dropped their paging. PostgREST caps an unbounded read at 1000 rows ' +
      'and says nothing; here that means quietly failing to suppress someone who opted out.',
    );
  });

  it('no per-caller "person addresses" argument has come back', () => {
    assert.ok(
      !/personEmails/.test(src),
      'sendFamilyEmail has regained a personEmails-style argument. That was the ORIGINAL design ' +
      'and it is what failed: through-the-person suppression protected only the one door that ' +
      'remembered to pass it. The expansion belongs in getFamilySuppressionList, where every ' +
      'sender gets it without knowing the concept exists.',
    );
  });

  it('it still fails CLOSED — a suppression-list error must never become an empty set', () => {
    assert.ok(
      !/catch[\s\S]{0,80}return new Set\(\)/.test(src),
      'The suppression lookup now swallows an error and returns an empty set, which mails ' +
      'everyone who opted out. Refusing to send is a missed message; this is a compliance breach.',
    );
  });
});

describe('Family email — every sender is accounted for', () => {
  for (const sender of FAMILY_SENDERS) {
    it(`${sender.posture}: ${sender.file}`, () => {
      assert.ok(
        existsSync(join(REPO, sender.file)),
        `${sender.file} is in the family-sender manifest but no longer exists. If it moved, move ` +
        'this entry with it — a manifest that names nothing guards nothing.',
      );
      const s = read(sender.file);

      if (sender.posture === 'guarded') {
        assert.match(
          s, CALLS_GUARDED_SEND,
          `${sender.file} is recorded as guarded but no longer calls sendFamilyEmail. ${sender.what}`,
        );
        assert.ok(
          !CALLS_RAW_SEND.test(s),
          `${sender.file} is recorded as guarded but calls the raw sendEmail transport. That ` +
          'bypasses the opt-out check AND the unsubscribe footer — the exact shape of the bug ' +
          'this manifest exists to prevent.',
        );
      } else {
        assert.match(
          s, CALLS_RAW_SEND,
          `${sender.file} is recorded as "${sender.posture}" but no longer calls sendEmail ` +
          'directly. If it now goes through the choke point, that is good news — move it to ' +
          'guarded in this manifest.',
        );
      }
    });
  }

  /**
   * ⚠⚠ THIS TEST USED TO CHECK ONLY THE DUES HALF, and ran green while the rule was half-met.
   * The ruling has two clauses — a transactional sender must NAME itself AND explain why an
   * unsubscribe did not stop it — and the tryout mails had neither: they identified the club only
   * when a caller remembered to pass its name, and said nothing about the override. A test that
   * asserts the easy half of a rule is worse than no test, because its green is read as the whole
   * rule holding. Every transactional sender in the manifest is checked here now.
   */
  it('EVERY transactional notice carries the shared footer — the price of skipping the opt-out', () => {
    const transactional = FAMILY_SENDERS.filter(s => s.posture === 'transactional');
    assert.equal(
      transactional.length, 5,
      'The transactional set changed size — re-audit it. Each member skips the unsubscribe check, ' +
      'so each one owes a family an explanation of why it arrived anyway.',
    );
    for (const s of transactional) {
      // Dues senders build their own body and reach the footer via the dues template; the tryout
      // sender delegates its whole body to templates in lib/email.ts. Accept either route in, but
      // require that SOME path to the shared footer exists.
      const body = read(s.file) + (/tryout/.test(s.file) ? read('lib/email.ts') : '');
      assert.ok(
        /transactionalFamilyFooterHtml|duesReminderFooterHtml|duesReminderEmail/.test(body),
        `${s.file} no longer reaches the shared transactional footer. It is exempt from the ` +
        'unsubscribe check, which makes naming itself and explaining the override the ONLY things ' +
        'it owes the family. That is not decoration — it is the trade that makes the exemption honest.',
      );
    }
  });

  it('all three tryout templates carry the footer, not just the one someone remembered', () => {
    const emailSrc = read('lib/email.ts');
    const uses = emailSrc.match(/transactionalFamilyFooterHtml\(/g) ?? [];
    assert.ok(
      uses.length >= 3,
      `Expected the shared transactional footer in all three tryout templates (offer, waitlist, ` +
      `release) — found ${uses.length}. A family that gets a release email with no sender and no ` +
      'explanation is the case this rule was written for.',
    );
  });

  it('the free-tier gap has not been silently "closed" by deleting the note', () => {
    const gaps = FAMILY_SENDERS.filter(s => s.posture === 'known-gap');
    assert.equal(
      gaps.length, 1,
      'The known-gap list changed. If the free-tier coach\'s "Email families" now honours an ' +
      'unsubscribe, say so by moving it to guarded — and check that a free team finally has ' +
      'somewhere to record an opt-out, because it had no org to key one against.',
    );
  });
});

describe('Family email — no unlisted sender has appeared', () => {
  const FAMILY_RECIPIENT = /guardianEmail|guardian_email|recipientEmails|invited_email|guardianFirst/;

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(join(REPO, dir))) {
      const rel = `${dir}/${entry}`;
      if (statSync(join(REPO, rel)).isDirectory()) walk(rel, out);
      else if (/\.tsx?$/.test(rel)) out.push(rel);
    }
    return out;
  }

  it('any file mailing a guardian-shaped recipient raw is in the manifest', () => {
    const known = new Set([...FAMILY_SENDERS.map(s => s.file), ...NOT_FAMILY_MAIL]);
    const unlisted: string[] = [];
    for (const root of ['app/api', 'lib']) {
      for (const file of walk(root)) {
        const s = read(file);
        if (CALLS_RAW_SEND.test(s) && FAMILY_RECIPIENT.test(s) && !known.has(file)) {
          unlisted.push(file);
        }
      }
    }
    assert.deepEqual(
      unlisted, [],
      'These files mail a guardian-shaped recipient through the raw transport and are not in the ' +
      'family-sender manifest:\n  ' + unlisted.join('\n  ') +
      '\n\nDecide the posture — guarded (route it through sendFamilyEmail), or transactional ' +
      '(a bill or a roster offer, which must still name its sender) — and record it above.',
    );
  });

  it('the not-family-mail exclusions still exist and still mail staff', () => {
    for (const file of NOT_FAMILY_MAIL) {
      assert.ok(
        existsSync(join(REPO, file)),
        `${file} is excluded from the family-sender scan but no longer exists. A stale exclusion ` +
        'is a hole: a future file at that path would be skipped without anyone deciding to.',
      );
    }
  });
});
