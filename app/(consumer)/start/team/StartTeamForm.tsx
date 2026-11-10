'use client';
import { coachTeamPath } from '@/lib/coaches-portal-routes';
import type { StartStepViewer } from '@/lib/start-door';
import StartDoorForm, { type StartCreate } from '../StartDoorForm';

/** Make the free team (the account's own name becomes its primary coach) and answer its home. Through the step's Terms gate. */
const createTeam: StartCreate = async (name, send) => {
  const res = await send('/api/coaches/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res) return null;
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? 'Could not create your team.');
  }
  const data = await res.json() as { id: string };
  return coachTeamPath(data.id);
};

/** Standalone coach team creation, account first (Account-First Sign-up, owner 2026-10-18). */
export default function StartTeamForm(props: { viewer: StartStepViewer | null; initialName?: string; confirmed?: boolean }) {
  return <StartDoorForm door="team" create={createTeam} {...props} />;
}
