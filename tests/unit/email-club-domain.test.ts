/**
 * CLUB TIER 4e, PART 6: the four emails to a club's owner about its own web address. The words are the copy doc's §11; the rules
 * here are the ones that hold whatever the words become: the right subject, one button that says what it does, no system words,
 * a club's own words escaped, and nothing promised that did not happen.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clubDomainEmail, type DomainEmailFacts, type DomainEmailKind } from '../../lib/email-club-domain.ts';

const F: DomainEmailFacts = {
  clubName: 'Lakeshore Lynx', address: 'www.lakeshorelynx.ca', bare: 'lakeshorelynx.ca', oldAddress: 'fieldlogichq.ca/lakeshore-lynx',
  rowUrl: 'https://www.fieldlogichq.ca/lakeshore-lynx/admin/public-site#address', ownerFirstName: 'Pat',
  padlockDate: 'May 9, 2027', noticedDate: 'March 30, 2027', noticedTime: '9:14 a.m.',
};
const KINDS: DomainEmailKind[] = ['live', 'padlock_missing', 'padlock_reminder', 'gave_up', 'not_working'];
const text = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('the owner emails about a club\'s own address', () => {
  it('each has a plain subject that names the address or the trouble, and one button to the Web address row', () => {
    for (const k of KINDS) {
      const m = clubDomainEmail(k, F);
      assert.ok(m.subject.length > 10 && !/[<>]/.test(m.subject), k);
      assert.equal((m.html.match(/<a [^>]*href="https:\/\/www\.fieldlogichq\.ca\/lakeshore-lynx\/admin\/public-site#address"/g) ?? []).length, 1, `${k}: one button, to the row`);
    }
    assert.equal(clubDomainEmail('live', F).subject, 'www.lakeshorelynx.ca is live');
    assert.equal(clubDomainEmail('not_working', F).subject, 'www.lakeshorelynx.ca is not reaching your site');
  });

  it('the live email says what changed for families, and names the one thing left only when the bare name does not forward', () => {
    const t = text(clubDomainEmail('live', F).html);
    assert.match(t, /fieldlogichq\.ca\/lakeshore-lynx forwards there, so posters and old links keep working/);
    assert.doesNotMatch(t, /One thing is left/);
    assert.match(text(clubDomainEmail('live', { ...F, bareNotForwarding: true }).html), /lakeshorelynx\.ca on its own does not forward/);
  });

  it('the padlock emails carry the date, and say the site still works', () => {
    const t = text(clubDomainEmail('padlock_missing', F).html);
    assert.match(t, /before May 9, 2027/);
    assert.match(t, /Your site still works today/);
    assert.match(text(clubDomainEmail('padlock_reminder', F).html), /runs out on May 9, 2027 ?, two weeks from now/);
    assert.match(text(clubDomainEmail('padlock_missing', { ...F, padlockDate: null }).html), /Put it back where you bought lakeshorelynx\.ca soon/);
  });

  it('the not-working email says when we noticed, that the old address works and has stopped forwarding', () => {
    const t = text(clubDomainEmail('not_working', F).html);
    assert.match(t, /On March 30, 2027 at 9:14 a\.m\. we found/);
    assert.match(t, /fieldlogichq\.ca\/lakeshore-lynx, which works, and the old address has stopped forwarding/);
  });

  it('the gave-up email names which record was never found', () => {
    assert.match(text(clubDomainEmail('gave_up', { ...F, whichMissing: 'record 2' }).html), /did not find record 2/);
    assert.match(text(clubDomainEmail('gave_up', F).html), /did not find either record/);
  });

  it('a club\'s own words are escaped, and no time is promised', () => {
    const m = clubDomainEmail('live', { ...F, clubName: 'A&B <script>x</script>' });
    assert.doesNotMatch(m.html, /<script>x/);
    assert.match(m.html, /A&amp;B &lt;script&gt;/);
    for (const k of KINDS) {
      const t = text(clubDomainEmail(k, F).html);
      assert.ok(!/within minutes|instantly|right away|immediately/i.test(t), k);
      assert.ok(!/\bDNS\b/.test(t), `${k}: never "DNS" on its own`);
      assert.ok(!/\b[AP]M\b/.test(t.replace(/[ap]\.m\./g, '')), `${k}: the clock is a.m. / p.m.`);
    }
  });

  it('greets by first name when known, plainly when not', () => {
    assert.match(text(clubDomainEmail('gave_up', F).html), /Hi Pat,/);
    assert.match(text(clubDomainEmail('gave_up', { ...F, ownerFirstName: null }).html), /Hi, We looked/);
  });
});
