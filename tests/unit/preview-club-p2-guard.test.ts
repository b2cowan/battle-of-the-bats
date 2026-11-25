/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **A PREVIEW CLUB, MADE AND MARKED** (Club Website Track P, Session P2; owner rulings T2–T6, 2026-11-25; drawing
 * Tx3So1rUqL6shn7CzM93Zr, tabs 2, 3 and 5). The never-a-customer rule itself is `preview-org-guard.test.ts` (P1).
 *
 * THE RULES, in the order they are asserted below:
 *   1. Every public form is closed for a preview, ON THE SERVER: each public write route under the folders a visitor
 *      reaches asks the refusal itself, goes through a shared door that asks it, or says why a preview cannot reach it
 *      (`NO_PREVIEW_WRITE`). A new public write route fails here until it decides. The house league and tryout sign-ups
 *      refuse BEFORE they read the body, so a crafted request writes nothing and logs nothing.
 *   2. No file of its own leaves a preview: share images fall back to the plain card; the team feed, the rules PDF and
 *      the form's documents refuse it (owner 2026-11-25, in place of an `X-Robots-Tag` header).
 *   3. Every page says so: the band in the frame every club page shares, the footer line with the removal route, and
 *      "(preview)" in the page title and a pasted link's preview.
 *   4. The one creation step (mig 536): the marker in the club's own insert, nobody seated or named, the tournament
 *      unlisted, the refusals re-checked under one lock, the service role only, and only the owner reaches it.
 *   5. The list and the window's rules (lib/prospect-clubs.ts), as behaviour.
 * ⚠ A source scan for 1–4: a public write added OUTSIDE `PUBLIC_WRITE_DIRS` is review's to catch.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode, readSource, functionBody, between } from './_source-code.ts';
import {
  MAKE_WORDS, makeFieldErrors, prospectCountLine, prospectRows, removalDateLabel, suggestedSlug, type MakeInput,
} from '../../lib/prospect-clubs.ts';
import { previewTitle, previewFootText } from '../../lib/preview-org.ts';

const PUBLIC_WRITE_DIRS = [
  'app/api/league/[orgSlug]', 'app/api/rep-teams/[orgSlug]', 'app/api/public/sponsorship', 'app/api/pay', 'app/api/register',
  'app/api/consumer/follows',
];
const PREVIEW_WRITE_COVER = /previewWriteRefusal(ById)?\(|openFamilyForm\(|dealForLink\(|resolveFollowable\w*\(|teamBelongsToTournament\(/;
const NO_PREVIEW_WRITE: Record<string, string> = {
  'app/api/league/[orgSlug]/[seasonSlug]/team/[teamId]/calendar-link/route.ts': 'a signed-in house league coach only (resolveCoachPress); a preview has no coaches (T3)',
  'app/api/league/[orgSlug]/[seasonSlug]/team/[teamId]/games/[gameId]/report/route.ts': 'a signed-in house league coach only; a preview has no coaches',
  'app/api/league/[orgSlug]/[seasonSlug]/team/[teamId]/games/[gameId]/score/route.ts': 'a signed-in house league coach only; a preview has no coaches',
  'app/api/register/account-check/route.ts': 'asks whether an email has an account; writes nothing to a club',
  'app/api/consumer/follows/feed/route.ts': 'reads the signed-in fan’s own follows; writes nothing',
};
const WRITES = /export\s+(const|async\s+function)\s+(POST|PUT|PATCH|DELETE)\b/;

describe('preview clubs: every public form is closed, on the server too (rule 1)', () => {
  const routes = PUBLIC_WRITE_DIRS.flatMap(d => filesUnder(d, '.ts')).filter(f => f.endsWith('route.ts') && WRITES.test(readCode(f)));
  it('finds the public writes at all (the scan is not empty)', () => {
    assert.ok(routes.length >= 15, `only ${routes.length} routes found`);
  });
  it('every public write route asks the refusal, goes through a door that does, or says why a preview cannot reach it', () => {
    const open = routes.filter(f => !PREVIEW_WRITE_COVER.test(readCode(f)) && !NO_PREVIEW_WRITE[f]);
    assert.deepEqual(open, [], `Public writes that do not refuse a preview club:\n  ${open.join('\n  ')}`);
  });
  it('the exceptions still exist and still write (the list cannot rot)', () => {
    const stale = Object.keys(NO_PREVIEW_WRITE).filter(f => !routes.includes(f));
    assert.deepEqual(stale, []);
  });
  it('the shared doors ask it: the family form, a sponsor link, and every follow of a tournament or its teams', () => {
    assert.match(functionBody(readCode('lib/club-form-family-route.ts'), 'openFamilyForm'), /previewWriteRefusal\(org\)/);
    assert.match(functionBody(readCode('lib/sponsor-link-route.ts'), 'dealForLink'), /previewWriteRefusal\(org\)/);
    assert.match(functionBody(readCode('lib/fan-follows.ts'), 'resolvePublicTournament'), /org\.isPreview/);
  });
  it('the house league sign-up and the tryout sign-up refuse BEFORE they read the body', () => {
    for (const f of ['app/api/league/[orgSlug]/[seasonSlug]/register/route.ts', 'app/api/rep-teams/[orgSlug]/[teamSlug]/tryouts/[yearId]/register/route.ts']) {
      const code = readCode(f);
      const refusal = code.indexOf('previewWriteRefusal(org)');
      const body = code.search(/req\.(json|formData)\(/);
      assert.ok(refusal > 0 && (body < 0 || refusal < body), f);
    }
  });
  it('the refusal by id fails closed when the marker cannot be read', () => {
    assert.match(functionBody(readCode('lib/preview-write-refusal.ts'), 'previewWriteRefusalById'), /catch[\s\S]*status: 503/);
  });
  it('the sign-up pages show "Registration isn’t open on this preview" in place of the form', () => {
    for (const f of ['app/[orgSlug]/league/[seasonSlug]/register/page.tsx', 'app/[orgSlug]/teams/[teamSlug]/tryouts/register/page.tsx']) {
      assert.match(readCode(f), /isPreview\) return <PreviewClosedForm/, f);
    }
  });
});

describe('preview clubs: no file of its own leaves the site (rule 2)', () => {
  it('the club, team and tryout share images fall back to the plain card', () => {
    for (const f of ['app/[orgSlug]/opengraph-image.tsx', 'app/[orgSlug]/teams/[teamSlug]/opengraph-image.tsx', 'app/[orgSlug]/teams/[teamSlug]/tryouts/opengraph-image.tsx']) {
      assert.match(readCode(f), /org\.isPreview\) return neutralShareCard\(\)/, f);
    }
  });
  it('the tournament, game and team share images draw no card', () => {
    for (const f of ['app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx', 'app/[orgSlug]/[tournamentSlug]/schedule/[gameId]/opengraph-image.tsx', 'app/[orgSlug]/[tournamentSlug]/teams/[id]/opengraph-image.tsx']) {
      assert.match(readCode(f), /getClubBySlug\(orgSlug\)\)\?\.isPreview\) return null/, f);
    }
  });
  it('the team calendar feed, the rules PDF and the sign-up form documents refuse it', () => {
    assert.match(readCode('app/[orgSlug]/teams/[teamSlug]/calendar/route.ts'), /org\.isPreview\) return refusedFeedResponse/);
    assert.match(readCode('app/[orgSlug]/[tournamentSlug]/rules/pdf/route.ts'), /org\.isPreview\) return notFound/);
    assert.match(readCode('app/api/league/[orgSlug]/[seasonSlug]/form/documents/[documentId]/open/route.ts'), /org\.isPreview\) return gone/);
  });
});

describe('preview clubs: every page says so (rule 3)', () => {
  it('the band is in the frame every club page shares, so a deep link carries it', () => {
    assert.match(readCode('app/[orgSlug]/layout.tsx'), /org\.isPreview && <PreviewBand clubName=\{org\.name\} \/>/);
  });
  it('the footer repeats it with the removal route, on pages with and without the club frame', () => {
    assert.match(readCode('lib/club-frame-data.ts'), /previewFoot: org\.isPreview \? previewFootText\(org\.name\) : null/);
    assert.match(readCode('components/public/ClubFooter.tsx'), /club\.previewFoot &&/);
    assert.match(readCode('components/public/ClubFrame.tsx'), /\{children\}\{club\.previewFoot &&/);
    assert.match(previewFootText('Oakridge Minor Softball'), /To have it removed, write to support@fieldlogichq\.ca\.$/);
  });
  it('the page title and a pasted link say "(preview)" and carry the band’s words', () => {
    const meta = readCode('lib/club-page-meta.ts');
    assert.match(meta, /club\.isPreview \? previewTitle\(/);
    assert.match(meta, /club\.isPreview \? previewBandText\(club\.name\)/);
    assert.match(readCode('app/[orgSlug]/layout.tsx'), /template: org\.isPreview \?/);
    assert.match(readCode('app/[orgSlug]/[tournamentSlug]/layout.tsx'), /if \(org\.isPreview\)[\s\S]{0,120}previewBandText/);
    assert.equal(previewTitle('Teams · Oakridge'), 'Teams · Oakridge (preview)');
    assert.equal(previewTitle('Teams · Oakridge (preview)'), 'Teams · Oakridge (preview)');
  });
});

describe('preview clubs: the one creation step (rule 4, mig 536)', () => {
  const sql = readSource('supabase/migrations/536_make_a_club_for_a_meeting.sql').replace(/--.*$/gm, '');
  const fn = between(sql, 'CREATE OR REPLACE FUNCTION public.make_preview_club', 'COMMENT ON FUNCTION');
  it('the club is made with the marker in its own insert (never a customer first), on the free start, unlisted', () => {
    assert.match(fn, /is_preview,[\s\S]*?\) VALUES \([\s\S]*?'tournament', 1, 'organization', true, false, true,/);
  });
  it('it seats nobody and names nobody: no member, no team contact, no registration (T3)', () => {
    assert.doesNotMatch(fn, /organization_members|registrations|coach_email|guardian|\bplayers?\b/i);
    assert.doesNotMatch(fn, /INSERT INTO public\.teams \([^)]*\b(coach|email)\b/);
  });
  it('the tournament is never listed, and its divisions are published so the live game shows', () => {
    assert.match(fn, /'Sample Indoor Classic', 'sample-indoor-classic', 'active', true,\s*v_day, v_day, p_sport, false,/);
    assert.match(fn, /'published'/);
  });
  it('the refusals are re-checked under one lock (cap, name, address, Québec, the meeting window)', () => {
    assert.match(fn, /pg_advisory_xact_lock/);
    for (const code of ['PV010', 'PV011', 'PV012', 'PV013', 'PV014', 'PV015']) assert.match(fn, new RegExp(`ERRCODE = '${code}'`), code);
  });
  it('only the service role may call it', () => {
    assert.match(sql, /REVOKE ALL ON FUNCTION public\.make_preview_club\([^)]*\) FROM PUBLIC, anon, authenticated/);
  });
  it('only the owner reaches it, by the one owner allowlist (T2)', () => {
    assert.match(readCode('app/api/platform-admin/prospect-clubs/route.ts'), /requirePlatformOwnerApi\(\)/);
    assert.match(readCode('app/platform-admin/prospect-clubs/page.tsx'), /isPlatformOwner\(auth\)\) redirect/);
  });
});

describe('Prospect clubs: the window and the list (rule 5)', () => {
  const now = new Date('2026-11-25T15:00:00Z');
  const good: MakeInput = {
    name: 'Oakridge Minor Softball', slug: 'oakridge-minor-softball', sport: 'softball', province: 'ON',
    logo: { type: 'image/png', size: 40_000 }, source: 'https://oakridgeminorsoftball.ca', primary: '#1f3a5f', accent: '#c9a227',
    line: 'Softball for Oakridge kids', meeting: '2026-12-08T19:00', meetingAt: '2026-12-09T00:00:00.000Z',
  };
  it('a filled window has no refusals', () => {
    assert.deepEqual(makeFieldErrors(good, now), {});
  });
  it('refuses Québec, a logo with no source, an SVG, a meeting out of the window, and numbers in the line', () => {
    const e = makeFieldErrors({
      ...good, province: 'QC', source: '', logo: { type: 'image/svg+xml', size: 10 }, meetingAt: '2027-03-01T00:00:00.000Z', line: 'U9 to U15',
    }, now);
    assert.equal(e.province, MAKE_WORDS.err.quebec);
    assert.equal(e.source, MAKE_WORDS.err.source);
    assert.equal(e.logo, MAKE_WORDS.err.logoType);
    assert.equal(e.meeting, MAKE_WORDS.err.meetingWindow);
    assert.equal(e.line, MAKE_WORDS.err.lineNumbers);
    assert.equal(makeFieldErrors({ ...good, meetingAt: '2026-11-24T00:00:00.000Z' }, now).meeting, MAKE_WORDS.err.meetingWindow);
    assert.equal(makeFieldErrors({ ...good, source: 'mailto:someone@example.com' }, now).source, MAKE_WORDS.err.sourceShape);
  });
  it('the address follows the name', () => {
    assert.equal(suggestedSlug('Oakridge Minor Softball'), 'oakridge-minor-softball');
    assert.equal(suggestedSlug('  St. Mary’s  Ball '), 'st-mary-s-ball');
  });
  it('the removal date is the meeting’s own day plus 30, in the club’s zone (an evening meeting is not the next UTC day)', () => {
    assert.equal(removalDateLabel('2026-12-09T00:00:00.000Z', true), 'Thu, Jan 7, 2027');
  });
  it('the list: open first by the next meeting, then claimed, then removed; the count line', () => {
    const rows = prospectRows([
      { orgId: 'r', slug: 'pine', name: 'Pine Hollow', meetingAt: '2026-10-05T23:00:00Z', madeBy: 'me', claimedAt: null, removedAt: '2026-11-04T07:00:00Z' },
      { orgId: 'c', slug: 'west', name: 'Westvale', meetingAt: '2026-10-28T23:00:00Z', madeBy: 'me', claimedAt: '2026-11-02T18:00:00Z', removedAt: null },
      { orgId: 'p', slug: 'lake', name: 'Lakeshore', meetingAt: '2026-11-12T23:00:00Z', madeBy: 'me', claimedAt: null, removedAt: null },
      { orgId: 'o', slug: 'oak', name: 'Oakridge', meetingAt: '2026-12-09T00:00:00Z', madeBy: 'me', claimedAt: null, removedAt: null },
      { orgId: 'h', slug: 'harb', name: 'Harbourview', meetingAt: '2026-11-30T23:30:00Z', madeBy: 'other', claimedAt: null, removedAt: null },
    ], 'me', now);
    assert.deepEqual(rows.map(r => r.orgId), ['h', 'o', 'p', 'c', 'r']);
    assert.equal(rows[0].meeting, 'Mon, Nov 30 · 6:30 p.m.');
    assert.equal(rows[0].meetingWhen, 'In 5 days');
    assert.equal(rows[0].madeBy, 'Someone else');
    assert.deepEqual(rows[1].removal, { date: 'Thu, Jan 7', left: '43 days left' });
    assert.equal(rows[2].meetingWhen, '13 days ago');
    assert.equal(rows[3].removal, null);
    assert.equal(rows[3].claimed, 'Claimed Nov 2');
    assert.deepEqual(rows[4].removal, { date: 'Wed, Nov 4', left: null });
    assert.equal(prospectCountLine(rows), '3 open · 1 claimed · 1 removed');
  });
});
