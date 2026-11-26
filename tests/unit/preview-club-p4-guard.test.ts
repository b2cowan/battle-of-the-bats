import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filesUnder, readCode as code, readSource as read } from './_source-code.ts';
import { ENDED_SHOWN_DAYS, ENDED_WORDS, previewDayLabel, endedPageShows } from '../../lib/preview-ended.ts';
import { isDueForRemoval, removalQueueCounts } from '../../lib/preview-removal.ts';
import { REMOVAL_AFTER_DAYS } from '../../lib/prospect-clubs.ts';
import { PREVIEW_EMAIL_WORDS, previewLinkEmail } from '../../lib/preview-link-email.ts';
import { PREVIEW_EMAIL_ROLES, ROOM_WORDS } from '../../lib/preview-claim.ts';
import { FIELDLOGICHQ_SELLER_MAILING_ADDRESS } from '../../lib/fieldlogichq-contact.ts';

/**
 * CLUB WEBSITE TRACK P, SESSION P4 — the removal, the ended page and the one email (owner rulings T11–T13, 2026-11-25;
 * the nightly job, the overdue line and the address stop on every promotional send ruled 2026-11-26).
 *
 *   1. The ended page: 90 days, then not-found; never the meeting, the maker or the logo; a live club always wins.
 *   2. The removal can only ever remove a preview still unclaimed and past its day: one database step, under the claim's
 *      own locks, that re-checks all four; Delete's pre-cascade list held equal and Delete's own file step; nothing emails
 *      the club.
 *   3. Every removal writes the removal record, which holds no person.
 *   4. The day rules: due on the removal day; Today's "Removed tomorrow" and "Removal overdue".
 *   6. The one email: /legal's words, refused without a mailing address (and the address is blank today), never the code,
 *      the consent record before the send, one per preview, an officer's role only.
 *   7. The unsubscribe follows the address and every FieldLogicHQ promotional send honours it, fail-closed.
 */

const sql = (src: string) => src.replace(/--.*$/gm, '');
const MIG547 = sql(read('supabase/migrations/547_a_preview_is_removed_on_day_30.sql'));
const fnBody = (src: string, name: string) => {
  const at = src.indexOf(`FUNCTION public.${name}(`);
  assert.ok(at >= 0, `${name} is defined`);
  const open = src.indexOf('$$', at);
  return src.slice(open, src.indexOf('$$', open + 2));
};

describe('1. the ended page (T12)', () => {
  const removed = '2026-11-25T08:05:00Z';
  it('shows for exactly 90 days after the removal, then never', () => {
    assert.equal(ENDED_SHOWN_DAYS, 90);
    const at = Date.parse(removed);
    assert.equal(endedPageShows(removed, new Date(at)), true);
    assert.equal(endedPageShows(removed, new Date(at + 90 * 86_400_000 - 1)), true);
    assert.equal(endedPageShows(removed, new Date(at + 90 * 86_400_000)), false);
    assert.equal(endedPageShows(null), false);
    assert.equal(endedPageShows('not a date'), false);
  });

  it('says /legal recommendation 7 word for word, with the removal day as the room window names it', () => {
    assert.equal(previewDayLabel('2027-01-07T08:05:00Z'), 'Thu, Jan 7, 2027');
    assert.equal(previewDayLabel('2027-01-07T04:59:00Z'), 'Wed, Jan 6, 2027', 'the day in the club’s zone');
    assert.equal(previewDayLabel('not a date'), null);
    assert.equal(ENDED_WORDS.title, 'This preview has ended');
    assert.equal(ENDED_WORDS.body('Oakridge Minor Softball', 'Thu, Jan 7, 2027'),
      'FieldLogicHQ prepared a preview site for Oakridge Minor Softball. It was removed on Thu, Jan 7, 2027, and its pages, images and sample information were deleted.');
    assert.equal(ENDED_WORDS.help, 'If you’re with the club, write to support@fieldlogichq.ca and we can make a new one.');
  });

  it('reads only the name and the removal, of a never-claimed removed record, and never the meeting, the maker or the logo', () => {
    const server = code('lib/preview-ended-server.ts');
    assert.match(server, /\.select\('org_name, removed_at'\)/);
    assert.match(server, /\.is\('claimed_at', null\)/);
    assert.match(server, /\.not\('removed_at', 'is', null\)/);
    const page = code('components/public/PreviewEnded.tsx');
    for (const banned of ['logo', 'meeting', 'made_by', 'madeBy', 'theme']) assert.ok(!page.includes(banned), `the ended page never shows ${banned}`);
  });

  it('is asked only once the address has no club, so a live club (a claimed preview, a real club) always wins', () => {
    const layout = code('app/[orgSlug]/layout.tsx');
    const body = layout.slice(layout.indexOf('export default async function OrgLayout'));
    assert.match(body, /const org = await getClubBySlug\(orgSlug\);\s*if \(!org\) \{\s*const ended = await readEndedPreview\(orgSlug\);\s*if \(ended\) return <PreviewEnded ended=\{ended\} \/>;\s*notFound\(\);/);
    const meta = layout.slice(layout.indexOf('export async function generateMetadata'), layout.indexOf('export default async function OrgLayout'));
    assert.match(meta, /if \(!org\) \{[\s\S]*readEndedPreview[\s\S]*index: false/, 'the ended page is kept out of search');
  });

  it('the claim page says the same words, and is not-found after the 90 days', () => {
    const server = code('lib/preview-claim-server.ts');
    assert.match(server, /if \(a\.state === 'removed' && !\(await readEndedPreview\(slug\)\)\) return \{ state: 'missing' \};/);
    assert.match(server, /\(await readEndedPreview\(slug\)\) \? \{ ok: false, state: 'removed'/);
    assert.match(code('lib/preview-ended-server.ts'), /if \(liveError \|\| live\) return null;/, 'a club on the address wins');
    assert.match(code('app/(consumer)/start/claim/[slug]/ClaimDoor.tsx'), /<PreviewEnded surface="inline" ended=\{\{ name: club\.name, removedOn: frame\.removedOn \}\} \/>/);
    assert.match(code('components/public/PreviewEnded.tsx'), /ENDED_WORDS\.body\(ended\.name, ended\.removedOn\)/);
  });
});

describe('2. the removal can only remove a preview still unclaimed and past its day (T11)', () => {
  const fn = fnBody(MIG547, 'remove_due_preview');

  it('takes the claim’s locks in the claim’s order before it reads anything it decides on', () => {
    const club = fn.indexOf('FROM public.organizations o WHERE o.id = p_org_id FOR UPDATE');
    const rec = fn.indexOf('FROM public.organization_previews p WHERE p.org_id = p_org_id FOR UPDATE');
    assert.ok(club > 0 && rec > club, 'the club row, then its record');
    const claim = sql(read('supabase/migrations/540_claim_a_club_made_for_a_meeting.sql'));
    const claimFn = fnBody(claim, 'claim_preview_club');
    assert.ok(claimFn.indexOf('FROM public.organizations o WHERE o.id = p_org_id AND o.is_preview FOR UPDATE') <
      claimFn.indexOf('FROM public.organization_previews p WHERE p.org_id = p_org_id FOR UPDATE'), 'the claim locks in the same order');
  });

  it('re-checks a preview, unclaimed, not removed and due, all before the first delete', () => {
    const firstDelete = fn.indexOf('DELETE FROM');
    for (const [check, codeName] of [
      ["v_rec.claimed_at IS NOT NULL", 'PV031'],
      ["v_rec.removed_at IS NOT NULL OR v_org_id IS NULL", 'PV032'],
      ["v_is_prev IS DISTINCT FROM true", 'PV030'],
      ["v_due > v_today", 'PV033'],
    ] as const) {
      const at = fn.indexOf(check);
      assert.ok(at > 0 && at < firstDelete, `${check} is checked before anything is deleted`);
      assert.ok(fn.indexOf(codeName, at) > at, `${check} raises ${codeName}`);
    }
    assert.match(fn, /v_due := \(v_rec\.meeting_at AT TIME ZONE 'America\/Toronto'\)::date \+ 30;/);
    assert.match(fn, /v_today\s+date := \(now\(\) AT TIME ZONE 'America\/Toronto'\)::date;/);
    assert.equal(REMOVAL_AFTER_DAYS, 30, 'the database day rule is the product’s');
  });

  it('only the server can call it', () => {
    assert.match(MIG547, /REVOKE ALL ON FUNCTION public\.remove_due_preview\(uuid, text\) FROM PUBLIC, anon, authenticated;/);
    assert.match(MIG547, /GRANT EXECUTE ON FUNCTION public\.remove_due_preview\(uuid, text\) TO service_role;/);
  });

  it('deletes exactly the tables platform admin’s Delete deletes before the club, in its order', () => {
    const route = code('app/api/platform-admin/orgs/[id]/delete/route.ts');
    const del = route.slice(route.indexOf('export const DELETE'));
    const before = del.slice(0, del.indexOf(".from('organizations')\n    .delete()"));
    const routeTables = [...before.matchAll(/\.from\('([a-z_]+)'\)\.delete\(\)\.eq\('org_id', id\)/g)].map(m => m[1]);
    const fnTables = [...fn.matchAll(/DELETE FROM public\.([a-z_]+) WHERE org_id = p_org_id;/g)].map(m => m[1]);
    assert.ok(routeTables.length >= 5, `found ${routeTables.length} in Delete`);
    assert.deepEqual(fnTables, routeTables);
    assert.match(fn, /DELETE FROM public\.organizations WHERE id = p_org_id;\s*RETURN/);
  });

  it('removes the files with Delete’s own file step, after the rows, and emails nobody', () => {
    const server = code('lib/preview-removal-server.ts');
    const route = code('app/api/platform-admin/orgs/[id]/delete/route.ts');
    for (const src of [route, server]) assert.match(src, /import \{ purgeOrgFiles \} from '[^']*org-files-purge-server';/);
    assert.ok(server.indexOf("rpc('remove_due_preview'") < server.indexOf('await purgeOrgFiles(p.org_id, legacy)'), 'rows first, then files');
    assert.doesNotMatch(server, /sendEmail|sendMarketingEmail|from '\.\/email'/, 'nothing emails the club (T11)');
    // A refusal by the re-check is not a failure: nothing changed.
    assert.match(server, /PV031: 'claimed'/);
    assert.match(server, /PV033: 'not due yet'/);
  });

  it('re-clears files only of a removed preview whose club row is truly gone', () => {
    const server = code('lib/preview-removal-server.ts');
    const retry = server.slice(server.indexOf('async function retryRecentFiles'));
    assert.match(retry, /if \(liveError \|\| !live\) return 0;/);
    assert.match(retry, /if \(stillThere\.has\(id\)\) continue;/);
  });
});

describe('3. every removal writes the removal record, which holds no person', () => {
  const stamp = fnBody(MIG547, 'organization_previews_mark_removed');
  it('is written by the removal stamp itself, so Remove now and Delete write it too', () => {
    assert.match(stamp, /INSERT INTO public\.platform_audit_log/);
    assert.match(stamp, /'preview_removed'/);
    for (const field of ["'name'", "'slug'", "'madeBy'", "'meetingAt'", "'logoSource'", "'madeAt'", "'removedAt'"]) assert.ok(stamp.includes(field), field);
  });
  it('never holds the person met, nor any sample row', () => {
    assert.doesNotMatch(stamp, /preview_email_consents|claim_code'|user_email|claimed_by/);
  });
});

describe('4. the day rules', () => {
  // Meeting Tue, Dec 8, 2026 at 7 p.m. Toronto (00:00 UTC Dec 9): the removal day is Thu, Jan 7, 2027.
  const meeting = '2026-12-09T00:00:00Z';
  it('is due on the removal day, not before', () => {
    assert.equal(isDueForRemoval(meeting, new Date('2027-01-07T04:59:00Z')), false, 'still Jan 6 in Toronto');
    assert.equal(isDueForRemoval(meeting, new Date('2027-01-07T08:05:00Z')), true, 'the run on Jan 7');
  });
  it('Today says "Removed tomorrow" the day before, and "Removal overdue" once the run has had its chance', () => {
    const open = [{ meetingAt: meeting, claimedAt: null, removedAt: null }];
    assert.deepEqual(removalQueueCounts(open, new Date('2027-01-06T17:00:00Z')), { tomorrow: 1, overdue: 0 });
    assert.deepEqual(removalQueueCounts(open, new Date('2027-01-07T07:30:00Z')), { tomorrow: 0, overdue: 0 }, '2:30 a.m.: not yet late');
    assert.deepEqual(removalQueueCounts(open, new Date('2027-01-07T14:00:00Z')), { tomorrow: 0, overdue: 1 });
    assert.deepEqual(removalQueueCounts([{ ...open[0], claimedAt: '2026-12-09T01:00:00Z' }], new Date('2027-01-07T14:00:00Z')), { tomorrow: 0, overdue: 0 });
  });
  it('the Today rows are the owner’s alone', () => {
    const today = code('app/platform-admin/page.tsx');
    assert.match(today, /const owner = isPlatformOwner\(auth\);/);
    assert.match(today, /owner \? readRemovalQueueCounts\(\) : Promise\.resolve\(undefined\)/);
  });
});

describe('6. the one email (T13)', () => {
  const input = {
    club: 'Oakridge Minor Softball', url: 'https://www.fieldlogichq.ca/oakridge-minor-softball', addressText: 'fieldlogichq.ca/oakridge-minor-softball',
    meetingDay: 'Tue, Dec 8', removalDay: 'Thu, Jan 7, 2027', unsubscribeUrl: 'https://www.fieldlogichq.ca/unsubscribe?address=a%40b.test&token=x',
  };

  it('cannot exist without a mailing address, and the address is blank today (owed from the owner)', () => {
    assert.equal(previewLinkEmail({ ...input, mailingAddress: '' }), null);
    assert.equal(previewLinkEmail({ ...input, mailingAddress: '   ' }), null);
    assert.equal(previewLinkEmail({ ...input, mailingAddress: 'PO Box 1, Milton ON', unsubscribeUrl: null }), null, 'nor without an unsubscribe');
    assert.equal(FIELDLOGICHQ_SELLER_MAILING_ADDRESS, '', 'when this fails, the owner has set the address: re-read /legal before the first send');
  });

  it('says /legal recommendation 5 word for word, with our address, a contact and the unsubscribe', () => {
    const email = previewLinkEmail({ ...input, mailingAddress: 'PO Box 1, Milton ON' });
    assert.ok(email);
    assert.equal(email.subject, 'Oakridge Minor Softball: the site from our meeting');
    const text = email.html.replace(/&amp;/g, '&');
    for (const line of [
      'Thank you for meeting with us on Tue, Dec 8. Here is the preview we made for Oakridge Minor Softball, to share with your board:',
      'Everything on it is a sample except the club’s name, logo and colours, which we took from your own site. It stays up until Thu, Jan 7, 2027. If you would rather it came down sooner, reply to this email and we will remove it.',
      'To make it your club, use the claim code on the card from the meeting.',
      'FieldLogicHQ, PO Box 1, Milton ON, support@fieldlogichq.ca.',
      'You’re receiving this one email because you gave us this address when we met about Oakridge Minor Softball on Tue, Dec 8.',
      'fieldlogichq.ca/oakridge-minor-softball',
      input.unsubscribeUrl,
    ]) assert.ok(text.includes(line), line);
    assert.equal(PREVIEW_EMAIL_WORDS.fromName, 'FieldLogicHQ');
  });

  it('the send refuses on the mailing address FIRST, keeps the consent record before it sends, and goes as our own mail', () => {
    const send = code('lib/preview-link-email-server.ts');
    const body = send.slice(send.indexOf('export async function sendPreviewLink'));
    assert.match(body, /\): Promise<PreviewLinkSend> \{\s*if \(previewLinkRefusedForAddress\(\)\) return \{ ok: false, why: 'no_mailing_address' \};/);
    assert.ok(body.indexOf(".from('preview_email_consents')\n    .insert(") < body.indexOf('await sendEmail('), 'the record first');
    assert.match(body, /kind: 'preview_link',\s*orgId: null,/);
    assert.match(body, /idempotencyKey: `preview-link:\$\{r\.org_id\}:\$\{consentId\}`/);
    assert.match(body, /if \(await isAddressStopped\(to\)\) return \{ ok: false, why: 'stopped' \};/);
    assert.match(body, /if \(Date\.now\(\) < Date\.parse\(r\.meeting_at\)\) return \{ ok: false, why: 'before_meeting' \};/);
    assert.match(body, /if \(result\.status === 'sent' \|\| mayHaveGone\)/, 'a mail service that is not set up does not use up the one email');
    assert.match(body, /\} catch \(e\) \{\s*await forget\(\);/, 'a send that throws leaves no record behind');
    // The code is never in an email (T7) — P3's guard holds every *mail* file; this one too.
    assert.doesNotMatch(send + read('lib/preview-link-email.ts'), /claim_code|claimCode|formatClaimCode/);
  });

  it('one per preview, an officer’s role only (no "Other"), and never their name', () => {
    assert.match(MIG547, /CONSTRAINT preview_email_consents_one_per_preview UNIQUE \(org_id\)/);
    const check = /role\s+text NOT NULL CHECK \(role IN \(([^)]*)\)\)/.exec(MIG547)?.[1] ?? '';
    assert.deepEqual(check.split(',').map(s => s.trim().replace(/'/g, '')), PREVIEW_EMAIL_ROLES.map(r => r.key));
    assert.ok(!PREVIEW_EMAIL_ROLES.some(r => /other/i.test(r.label)));
    const table = MIG547.slice(MIG547.indexOf('CREATE TABLE IF NOT EXISTS public.preview_email_consents'), MIG547.indexOf('ENABLE ROW LEVEL SECURITY', MIG547.indexOf('CREATE TABLE IF NOT EXISTS public.preview_email_consents')));
    assert.doesNotMatch(table, /\bname\s+text|first_name|last_name|full_name/);
    assert.match(fnBody(MIG547, 'purge_preview_email_consents'), /interval '3 years'/);
  });

  it('the room window says what the record keeps, and the tick says they agreed', () => {
    assert.equal(ROOM_WORDS.emailTick, 'They gave me this address at the meeting and agreed to one email with the link.');
    assert.equal(ROOM_WORDS.emailHelp, 'One email, to the person you met. It never carries the code. The date, role and send are kept as the consent record; their name is not.');
    assert.doesNotMatch(ROOM_WORDS.removeBody, /no longer opens|stops working/);
  });
});

describe('7. the unsubscribe follows the address', () => {
  it('its own token family, never interchangeable', async () => {
    process.env.UNSUBSCRIBE_SECRET = 'p4-guard-secret-0123456789abcdef';
    const t = await import('../../lib/unsubscribe-token.ts');
    const tok = t.generateAddressUnsubscribeToken('Board@Club.test')!;
    assert.ok(tok);
    assert.equal(t.verifyAddressUnsubscribeToken('board@club.test', tok), true);
    assert.equal(t.verifyAddressUnsubscribeToken('other@club.test', tok), false);
    assert.notEqual(tok, t.generateUserUnsubscribeToken('board@club.test'));
    assert.match(t.buildAddressUnsubscribeUrl('board@club.test')!, /\/unsubscribe\?address=board%40club\.test&token=/);
  });

  it('the route writes the address stop first, before the branches that carry a club', () => {
    const route = code('app/api/unsubscribe/route.ts');
    const post = route.slice(route.indexOf('export const POST'));
    assert.ok(post.indexOf('if (address)') < post.indexOf('if (userId)'));
    assert.match(post, /\.from\('email_address_stops'\)\s*\.upsert\(\{ email: address, source: 'preview_link' \}/);
  });

  it('every file that puts a FieldLogicHQ unsubscribe link in a mail also reads the address stop (the confirm page promises "every promotional email")', () => {
    // /legal P4 build review: the stop page says it stops every promotional email from FieldLogicHQ to the address. That is
    // true only while every sender of our own promotional mail asks isAddressStopped. A new one must ask too, or change the words.
    const builders = /\bbuild(?:User|Address)?UnsubscribeUrl\(/;
    const senders = ['lib', 'app'].flatMap(dir => ['.ts', '.tsx'].flatMap(ext => filesUnder(dir, ext)))
      .filter(f => f !== 'lib/unsubscribe-token.ts' && builders.test(code(f)));
    assert.ok(senders.length >= 2, `found ${senders.join(', ')}`);
    for (const f of senders) assert.match(code(f), /isAddressStopped\(/, `${f} builds our unsubscribe link but never reads the address stop`);
  });

  it('every FieldLogicHQ promotional send honours it, and a stop that cannot be read counts as stopped', () => {
    assert.match(code('lib/email-sender.ts'), /if \(!optedOut\) optedOut = await isAddressStopped\(toEmail\);/);
    const stops = code('lib/email-address-stops.ts');
    assert.match(stops, /if \(error\) \{[\s\S]*return true;\s*\}/);
  });
});
