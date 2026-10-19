'use client';
import { planStepPath, type StartPricing, type StartStepViewer } from '@/lib/start-door';
import StartDoorForm from '../StartDoorForm';
import { slugifyOrgName } from '@/lib/utils';

/**
 * The public address, generated server-side from the name (the final one may gain a number if it is taken). Olive,
 * not the pale lime it wore on cream — F08 (the hub's drawing; the league form's line has the same fix).
 */
const publicAddress = (name: string) => (
  <>Your public address: <strong>fieldlogichq.ca/{slugifyOrgName(name) || 'your-org'}</strong> — you can change this later.</>
);

/**
 * Run a tournament, account first (Account-First Sign-up Part 2, owner A1–A7 2026-10-18). Step 2 names the
 * organization; one tap makes it, its address, the owner seat and the Founding Season offer (/api/org/create), then the
 * plan step opens with the pricing page's plan chosen when there was one (A6).
 */
export default function StartTournamentForm({ pricing, ...props }: {
  viewer: StartStepViewer | null;
  confirmed?: boolean;
  pricing: StartPricing | null;
}) {
  async function createOrganization(orgName: string): Promise<string> {
    const res = await fetch('/api/org/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName }),
    });
    const data = await res.json().catch(() => ({})) as { orgSlug?: string; error?: string };
    if (!res.ok || !data.orgSlug) {
      throw new Error(data.error ?? 'Could not create your organization.');
    }
    return planStepPath(data.orgSlug, pricing);
  }

  return <StartDoorForm door="organization" create={createOrganization} help={publicAddress} {...props} />;
}
