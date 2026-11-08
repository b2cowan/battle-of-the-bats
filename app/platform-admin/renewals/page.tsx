import type { Metadata } from 'next';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import { readComingUp, readUnpaid } from '@/lib/renewals-read';
import { buildComingView, buildUnpaidView, paramsFrom } from '@/lib/renewals';
import { stripeKeyIsLive } from '@/lib/stripe-mode';
import { tournamentToday } from '@/lib/timezone';
import RenewalsClient from './RenewalsClient';

export const metadata: Metadata = { title: 'Renewals — Support console' };
export const dynamic = 'force-dynamic';

/**
 * CUSTOMERS › RENEWALS (Plans & pricing Stage 2 Part 4b; drawings PqUgoHqg57j1SGSo2YypjP, owner ruled all ten asks
 * 2026-11-07). Super admin, Billing and Support read it (Online payments' readers). Two views on one switch:
 *   • Coming up — what renews or ends in the dates picked, from our club records;
 *   • Unpaid bills — open and written-off bills from our own invoice record, in the site's Stripe mode.
 * ⚠ NOTHING on this page writes, and it never calls Stripe. Viewing is not logged (lists never are); a row's door opens the
 * club record, which logs the open. The state lives in the address, so Today's doors and the export read the same list.
 */
export default async function RenewalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformAreaView('renewals');
  const sp = await searchParams;
  const params = paramsFrom(k => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  });
  const today = tournamentToday();
  const live = stripeKeyIsLive();
  const data = params.view === 'unpaid'
    ? buildUnpaidView(await readUnpaid(live), params, today)
    : buildComingView(await readComingUp(), params, today);
  return <RenewalsClient params={params} live={live} data={data} />;
}
