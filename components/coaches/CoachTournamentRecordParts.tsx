'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { CoachRow } from '@/components/coaches/CoachRowList';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import { shareLink } from '@/lib/share-card';

/**
 * The client halves of the coach's tournament page (Club Tier Stage 7d, drawing 7) — the record
 * itself is a server component shared by both portals, so the two pieces that need the browser
 * live here.
 */

/**
 * The paid portal's title for one tournament: the ONE page header (CoachPageHeader), titled by the
 * TOURNAMENT (R4), with the back door to the list; its "?" is published to the masthead (the one help
 * door, T3). No action: the Fan view is navigation, so it sits in the chip row under the title. The free portal does not render this — its shell's sticky
 * header names the tournament with the team under it (Ask 12).
 */
export function CoachTournamentRecordHeader({
  title,
  backHref,
  help,
}: {
  title: string;
  backHref?: string;
  help: HelpRequest;
}) {
  return (
    <CoachPageHeader
      title={title}
      backTo={backHref ? { href: backHref, label: 'Tournaments' } : undefined}
      help={help}
      helpLabel="Tournaments"
    />
  );
}

/** "Share this tournament" as a row in From the organizer — the native share sheet, else a copied link. */
export function CoachShareRow({ url, title, text }: { url: string; title: string; text: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'shared' | 'copied'>('idle');
  async function share() {
    if (state === 'busy') return;
    setState('busy');
    const result = await shareLink(`${window.location.origin}${url}`, title, text);
    setState(result === 'idle' ? 'idle' : result);
    if (result !== 'idle') window.setTimeout(() => setState('idle'), 2200);
  }
  return (
    <CoachRow
      as="button"
      onClick={() => { void share(); }}
      disabled={state === 'busy'}
      mark={state === 'copied' || state === 'shared' ? <Check size={15} /> : <Share2 size={15} />}
      title={state === 'copied' ? 'Link copied' : state === 'shared' ? 'Shared' : 'Share this tournament'}
      titleWeight="plain"
      door="chevron"
    />
  );
}
