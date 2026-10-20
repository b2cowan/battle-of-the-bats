/**
 * The club site's small decisions (Club Tier Stage 4b-1). `node --test lib/club-site.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clubPageTitle, clubDescription, clubInitials, clubSocials, clubFace } from './club-site.ts';

test('titles: "page · club"; the home is the club alone', () => {
  assert.equal(clubPageTitle('15U AAA tryouts', 'Lakeshore Lynx'), '15U AAA tryouts · Lakeshore Lynx');
  assert.equal(clubPageTitle(null, 'Lakeshore Lynx'), 'Lakeshore Lynx');
  assert.equal(clubPageTitle('  ', 'Lakeshore Lynx'), 'Lakeshore Lynx');
});

test('description: the tagline, else the first sentence, else the name — never the platform\'s line', () => {
  assert.equal(clubDescription({ tagline: 'Rep baseball · ages 9 to 16', description: 'x' }, 'Lynx'), 'Rep baseball · ages 9 to 16');
  assert.equal(
    clubDescription({ tagline: null, description: 'Youth soccer since 1987. We play at Harbour Park.' }, 'Harbourview FC'),
    'Youth soccer since 1987.',
  );
  assert.equal(clubDescription({ tagline: '', description: null }, 'Harbourview FC'), 'Harbourview FC');
  // An abbreviation is not the end of the first sentence.
  assert.equal(
    clubDescription({ tagline: null, description: 'St. Catharines Minor Ball has run house league since 1962. Join us.' }, 'X'),
    'St. Catharines Minor Ball has run house league since 1962.',
  );
  assert.equal(clubDescription(null, 'Harbourview FC'), 'Harbourview FC');
  const long = clubDescription({ tagline: null, description: 'word '.repeat(60) }, 'X');
  assert.ok(long.length <= 160 && long.endsWith('…'), long);
});

test('initials: two words at most, letters and digits only', () => {
  assert.equal(clubInitials('Lakeshore Lynx'), 'LL');
  assert.equal(clubInitials('Harbourview'), 'H');
  assert.equal(clubInitials('St. Catharines Minor Ball'), 'SC');
  assert.equal(clubInitials('  riverdale   ridge  '), 'RR');
});

test('social links: the footer\'s order, absent when not given, web addresses only', () => {
  assert.deepEqual(clubSocials({ socialInstagram: 'https://instagram.com/lynx', socialFacebook: null, socialX: 'javascript:alert(1)', socialWebsite: ' https://lynx.ca ' }), [
    { kind: 'instagram', href: 'https://instagram.com/lynx' },
    { kind: 'website', href: 'https://lynx.ca' },
  ]);
  assert.deepEqual(clubSocials(null), []);
});

test('faces: the warm pair by default; DM Serif and Inter kept', () => {
  assert.equal(clubFace(undefined), 'warm');
  assert.equal(clubFace('system'), 'warm');
  assert.equal(clubFace('barlow'), 'warm');
  assert.equal(clubFace('dm-serif'), 'dm-serif');
  assert.equal(clubFace('inter'), 'inter');
});
