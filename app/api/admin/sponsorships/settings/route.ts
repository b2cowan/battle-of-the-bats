import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readSettings, saveSettings } from '@/lib/club-sponsorships-server';
import { parseSettingsPatch } from '@/lib/club-sponsorships';
import { writeOrgAudit } from '@/lib/org-audit';

/**
 * INVOICE DETAILS (Board Ready Stage 6, Part 1; round 1 tab 6, round 2 tab 3). PATCH changes the fields sent (the record
 * window saves as you go). Owner, admins and the treasurer only (round 2 ask 4, `invoice: true`), whoever else holds
 * Sponsorships. The mailing address is the club's one column (mig 454), now set here for every club — the site editor's
 * own box keeps its own rule. Read with the place (`GET /api/admin/sponsorships`).
 */
export const dynamic = 'force-dynamic';

export const PATCH = withObservability(async (req: Request) => {
  const gate = await requireSponsorships(req, { invoice: true });
  if ('failure' in gate) return gate.failure;
  const { org, user } = gate.ctx;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return refused('That didn’t go through. Try again.');
  const before = await readSettings(org.id);
  const parsed = parseSettingsPatch(body, before);
  if (!parsed.ok) return refused(parsed.error);
  await saveSettings(org.id, user.id, parsed.value, before);
  // On the club's record (the GST/HST registration will put tax on invoices): which fields changed, never their values.
  const changed = (Object.keys(parsed.value) as (keyof typeof before)[]).filter(k => parsed.value[k] !== before[k]);
  if (changed.length) await writeOrgAudit(org.id, user.id, null, 'sponsorship_invoice_details_changed', { fields: changed });
  return NextResponse.json({ settings: parsed.value });
}, { route: '/api/admin/sponsorships/settings' });
