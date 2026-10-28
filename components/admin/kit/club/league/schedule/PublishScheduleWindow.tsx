'use client';
/**
 * PUBLISH SCHEDULE (House League 9d-2b Part 2; rulings 9d2·1, 9d2·8; frame e2; words HOUSE_LEAGUE_STAGE9D2_11B_COPY.md
 * "Stage 9d-2b" e1 · e2). A question, asked once: how many games go public and how many families one email each
 * reaches — the server's own count, read when the window opens, so the number pressed is the number written. One press
 * publishes; the button reads "Publishing…" and can't be pressed twice, and a second press anywhere is refused with who
 * published and when. There is no unpublish, so "Keep as a draft" is the way out, never "Cancel".
 * "See the email" (Part 4) takes the window's place behind a named back (the send windows' level, owner 2026-10-26) —
 * the one moment the question is drawn as a form, since only a form has the back.
 */
import { useCallback, useEffect, useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { repKit } from '../../RepKit';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { SCHEDULE_PUBLISH_WORDS as W, reachedLine } from '@/lib/league-schedule-words';
import { formatStoredDate } from '@/lib/timezone';
import { SampleMail, SendDoor, useEmailSample, useSendLevel } from '../../SendParts';

/** `said`: "Published May 25 · 101 families emailed." — or how many it reached when some didn't send. */
export interface SchedulePublished { publishedAt: string; families: number; said: string }

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

  /** The question's numbers, read from the server — on open, and again after a refusal that says they moved. */
  const readFacts = useCallback(async (isLive: () => boolean = () => true, keepError = false) => {
    try {
      const r = await fetch(`${url}${sep}divisionId=${encodeURIComponent(division.id)}`);
      const data = await r.json().catch(() => null);
      if (!isLive()) return;
      if (r.ok && data) setFacts(data as Facts);
      else if (!keepError) setError((data as { error?: string } | null)?.error ?? W.failed);
    } catch { if (isLive() && !keepError) setError(W.failed); }
  }, [url, sep, division.id]);
  useEffect(() => {
    let live = true;
    void readFacts(() => live);
    return () => { live = false; };
  }, [readFacts]);

  async function publish() {
    if (!facts) return;
    setBusy(true); setError(null);
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ divisionId: division.id, games: facts.games }),
    }).catch(() => null);
    const data = (r ? await r.json().catch(() => null) : null) as { publishedAt: string; families: number; reached?: number; failed?: number; error?: string } | null;
    // No answer, or a platform error with no words, means it may have gone: say so rather than "try again".
    if (!r?.ok || !data) {
      setError(!r || (r.status >= 500 && !data) ? W.unsure : data?.error ?? W.failed);
      // The count moved (a game added or taken away while this was open) or someone published first: the next press must carry
      // the numbers as they are now, not the ones it just failed with.
      if (r?.status === 409) await readFacts(undefined, true);
      setBusy(false); return;
    }
    const day = formatStoredDate(data.publishedAt, { withYear: false });
    const failed = data.failed ?? 0;
    onDone({
      publishedAt: data.publishedAt, families: data.families,
      // The families it missed are offered again on the season's Email families history.
      said: failed > 0 ? `${W.publishedOn(day)} · ${reachedLine(data.reached ?? 0, data.families, failed)}` : W.done(day, data.families),
    });
  }

  const lv = useSendLevel(W.title(division.name));
  const email = useEmailSample(`${url}${sep}divisionId=${encodeURIComponent(division.id)}&preview=1`);
  const mail = lv.level === 'email';

  const foot = facts ? (isPhone ? W.footPhone(facts.families, facts.teams) : W.foot(facts.families)) : '';
  return (
    <KitDialog kind={mail ? 'form' : 'question'} {...(mail ? { ...lv.dialog, size: 'medium' as const } : {})} title={W.title(division.name)} onClose={onClose} busy={busy}
      footerStart={<span>{busy ? W.publishing : foot}</span>}
      footer={(
        <>
          <DialogCancel>{isPhone ? W.notYet : W.keepDraft}</DialogCancel>
          <button type="button" className="btn btn-lime" disabled={busy || !facts} onClick={() => void publish()}>
            {busy ? W.publishing : W.publish}
          </button>
        </>
      )}>
      {mail ? (
        <SampleMail state={email} failedText={W.sampleFailed} />
      ) : (
        <>
          {facts && !isPhone && <p className={ck.hint}>{W.body(facts.games, facts.teams)}</p>}
          {facts && facts.families > 0 && !busy && <SendDoor onOpen={() => { lv.open('email'); void email.load(); }}>{W.seeEmail}</SendDoor>}
        </>
      )}
      {error && <p className={repKit.formError} role="alert">{error}</p>}
    </KitDialog>
  );
}
