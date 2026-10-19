'use client';
import type { StartStepViewer } from '@/lib/start-door';
import StartDoorForm from '../StartDoorForm';
import { slugifyOrgName } from '@/lib/utils';

/** Make the league workspace and answer the existing house-league onboarding wizard. */
async function createLeague(orgName: string): Promise<string> {
  const res = await fetch('/api/league/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgName }),
  });
  const data = await res.json().catch(() => ({})) as { ok?: boolean; orgSlug?: string; error?: string };
  if (!res.ok || !data.orgSlug) {
    throw new Error(data.error ?? 'Could not create your league.');
  }
  return `/${data.orgSlug}/admin/onboarding`;
}

/** The public address, in olive rather than the pale lime it wore on cream (the drawing; the same fix as F08). */
const publicPage = (name: string) => <>Your public page: <strong>fieldlogichq.ca/{slugifyOrgName(name) || 'your-league'}</strong></>;

/** Free League Starter create form (capped beta), account first (Account-First Sign-up, owner 2026-10-18). */
export default function StartLeagueForm(props: { viewer: StartStepViewer | null; initialName?: string; confirmed?: boolean }) {
  return <StartDoorForm door="league" create={createLeague} help={publicPage} {...props} />;
}
