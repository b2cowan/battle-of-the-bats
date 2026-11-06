/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A CREDIT NOTE'S PDF LINK IS FOR STAFF WHO CAN REFUND — GST/HST Stage 2 Part 7, owner Q2 (2026-11-06), the build guard
 * (docs/projects/active/GST_HST_STAGE2_BUILD_PROMPT.md ▶ Progress, Part 7; Part 6b's open item P2-4).
 *
 * The charge window lists the invoice's credit notes. Stripe's PDF carries the club's billing name, address and tax details,
 * and support reads Stripe (`find_stripe`) without the power to refund. Hiding the link in the window alone would still send
 * it to a support browser, so the gate is the ROUTE's: the charge read returns `pdf: null` to a role without `refund`, and
 * the note's number, total and date to everyone who can open the charge. Pinned here:
 *   1. the power table still separates the two (a role that reads the charge but cannot refund exists — otherwise the gate
 *      is moot and this guard should be re-read, not deleted);
 *   2. the mapping (`toChargeCreditNote`) drops the link unless asked for it, and only ever hands on an https link — run, not read;
 *   3. the charge route maps every note through it with `withPdf` = `hasPlatformPower(auth.role, 'refund')`;
 *   4. nothing else under platform admin or the console's money modules reads a credit note's `pdf`;
 *   5. the same rule for the console's fee list: an owed fee invoice's Stripe pay link only with the refund power.
 * Source reads go through `readCode`, which strips comments: a guard that reads prose proves the prose.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode } from './_source-code.ts';
import { PLATFORM_POWERS, hasPlatformPower } from '../../lib/platform-areas.ts';
import { toChargeCreditNote } from '../../lib/console-money.ts';

const CHARGE_ROUTE = 'app/api/platform-admin/orgs/[id]/money/charges/[chargeId]/route.ts';
const MAPPING = 'lib/console-money.ts';
const NOTE = { id: 'cn_1', number: 'MBEEZ5VW-0001-CN-01', total: 9999, currency: 'cad', created: 1793900000, pdf: 'https://pay.stripe.com/credit_notes/x/pdf' };

describe('Q2 · a credit note’s PDF link goes only to a role that can refund', () => {
  it('a role can open a charge without the power to refund (support): the gate has someone to keep out', () => {
    const readers = PLATFORM_POWERS.find_stripe.filter(r => !hasPlatformPower(r, 'refund'));
    assert.ok(readers.includes('support'), `support reads Stripe and cannot refund (readers without refund: ${readers.join(', ')})`);
    assert.ok(!hasPlatformPower('support', 'refund'));
  });

  it('the mapping drops the link unless asked for it, keeps the number, total and date, and never hands on a non-https link', () => {
    const without = toChargeCreditNote(NOTE, { withPdf: false });
    assert.deepEqual(without, { id: 'cn_1', number: 'MBEEZ5VW-0001-CN-01', totalCents: 9999, currency: 'cad', createdAt: new Date(1793900000 * 1000).toISOString(), pdf: null });
    assert.equal(toChargeCreditNote(NOTE, { withPdf: true }).pdf, NOTE.pdf);
    assert.equal(toChargeCreditNote({ ...NOTE, pdf: 'javascript:alert(1)' }, { withPdf: true }).pdf, null);
    assert.equal(toChargeCreditNote({ ...NOTE, pdf: null }, { withPdf: true }).pdf, null);
  });

  it('the charge route maps every note through it, with the link decided by the refund power', () => {
    const code = readCode(CHARGE_ROUTE);
    const gate = code.match(/const (\w+) = hasPlatformPower\(auth\.role, 'refund'\);/);
    assert.ok(gate, 'the route asks hasPlatformPower(auth.role, \'refund\')');
    const maps = [...code.matchAll(/toChargeCreditNote\(\w+, \{ withPdf: (\w+) \}\)/g)].map(m => m[1]);
    assert.ok(maps.length >= 1, 'the route maps its notes through toChargeCreditNote');
    for (const v of maps) assert.equal(v, gate![1], 'withPdf is the refund power, never true or another power');
    assert.doesNotMatch(code, /\bpdf:/, 'no note is built inline beside the mapping');
    // The read itself stays open to every Stripe reader (support sees the number, total and date).
    assert.match(code, /requirePlatformPower\('find_stripe'\)/);
  });

  it('the console’s fee list sends an owed invoice’s pay link only to a role that can refund (Part 7, as Q2)', () => {
    const code = readCode('app/api/platform-admin/orgs/[id]/money/stripe-fees/route.ts');
    const gate = code.match(/const (\w+) = hasPlatformPower\(auth\.role, 'refund'\);/);
    assert.ok(gate, 'the route asks the refund power');
    assert.match(code, new RegExp(`readClubFees\\(id, \\{ limit: 100 \\}\\)\\)\\.map\\(f => \\(${gate![1]} \\? f : \\{ \\.\\.\\.f, payUrl: null \\}\\)\\)`));
    assert.doesNotMatch(code, /fees: await readClubFees/, 'the raw fee list (with its links) is never sent as read');
  });

  it('no other platform-admin route or console money module reads a credit note’s pdf', () => {
    const files = [...filesUnder('app/api/platform-admin', '.ts'), ...filesUnder('lib', '.ts').filter(f => /^lib\/(console-money|platform-story)/.test(f))];
    // Reading Stripe's `.pdf` off a note (`n.pdf`, `note?.pdf`); the ChargeCreditNote TYPE declaring the field reads nothing.
    const others = files.filter(f => f !== MAPPING && /\b[A-Za-z_]\w*\??\.pdf\b/.test(readCode(f)) && /creditNote|CreditNote/.test(readCode(f)));
    assert.deepEqual(others, [], 'a credit note’s PDF is read in the mapping only');
  });
});
