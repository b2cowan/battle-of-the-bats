'use client';
/**
 * PUBLISH SCHEDULE (House League 9d-2b Part 2; rulings 9d2·1, 9d2·8; frame e2; words HOUSE_LEAGUE_STAGE9D2_11B_COPY.md
 * "Stage 9d-2b" e1 · e2). A question, asked once: how many games go public and how many families one email each
 * reaches — the server's own count, read when the window opens, so the number pressed is the number written. One press
 * publishes; the button reads "Publishing…" and can't be pressed twice, and a second press anywhere is refused with who
 * published and when. There is no unpublish, so "Keep as a draft" is the way out, never "Cancel".
 */
import { useEffect, useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { repKit } from '../../RepKit';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { SCHEDULE_PUBLISH_WORDS as W } from '@/lib/league-schedule-words';

export interface SchedulePublished { publishedAt: string; families: number }

interface Facts { games: number; teams: number; families: number }

export default function PublishScheduleWindow({ division, api, orgQuery, onDone, onClose }: {
  division: { id: string; name: string };
  /** `/api/admin/house-league/seasons/{id}/schedule` */
  api: string;
  orgQuery: string;
  onDone: (result: SchedulePublished) => void;
  onClose: () => void;
}) {
  const isPhone = useIsPhone();
  const [facts, setFacts] = useState<Facts | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `${api}/publish${orgQuery}`;
  const sep = orgQuery ? '&' : '?';

  useEffect(() => {
    let live = true;
    fetch(`${url}${sep}divisionId=${encodeURIComponent(division.id)}`)
      .then(async r => {
        const data = await r.json().catch(() => null);
        if (!live) return;
        if (r.ok && data) setFacts(data as Facts);
        else setError((data as { error?: string } | null)?.error ?? W.failed);
      })
      .catch(() => { if (live) setError(W.failed); });
    return () => { live = false; };
  }, [url, sep, division.id]);

  async function publish() {
    if (!facts) return;
    setBusy(true); setError(null);
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ divisionId: division.id, games: facts.games }),
    }).catch(() => null);
    const data = (r ? await r.json().catch(() => null) : null) as (SchedulePublished & { error?: string }) | null;
    if (!r?.ok || !data) { setError(data?.error ?? W.failed); setBusy(false); return; }
    onDone({ publishedAt: data.publishedAt, families: data.families });
  }

  const foot = facts ? (isPhone ? W.footPhone(facts.families, facts.teams) : W.foot(facts.families)) : '';
  return (
    <KitDialog kind="question" title={W.title(division.name)} onClose={onClose} busy={busy}
      footerStart={<span>{busy ? W.publishing : foot}</span>}
      footer={(
        <>
          <DialogCancel>{isPhone ? W.notYet : W.keepDraft}</DialogCancel>
          <button type="button" className="btn btn-lime" disabled={busy || !facts} onClick={() => void publish()}>
            {busy ? W.publishing : W.publish}
          </button>
        </>
      )}>
      {facts && !isPhone && <p className={ck.hint}>{W.body(facts.games, facts.teams)}</p>}
      {error && <p className={repKit.formError} role="alert">{error}</p>}
    </KitDialog>
  );
}
