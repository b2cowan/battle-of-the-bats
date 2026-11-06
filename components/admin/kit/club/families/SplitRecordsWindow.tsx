'use client';
/**
 * SPLIT RECORDS — the child page's way to undo a join, or to part two children typed as one (Club Tier Stage 14 S6, Ask 11;
 * drawings tab 5/6/8: "Nothing was deleted, so a split is exact"). The window was not drawn; it is the club roll window's
 * tick list (`repKit.carry`) in the One Window ladder's form size: tick the seasons that belong to a DIFFERENT child, and the
 * foot says why Split waits until some — not none, not all — are ticked. Splitting keeps every season's entry, money and
 * papers, leaves the parent links on the record kept, and stores the pair as "not the same child".
 */
import { useState } from 'react';
import KitDialog from '../KitDialog';
import { repKit } from '../RepKit';
import { jsonInit, moneyFetch, refusalText } from '../money/MoneyKit';
import { CHILD_SPLIT_WORDS as W } from '@/lib/child-join-words';
import { seasonRowPhoneLine, seasonRowPhoneTitle } from '@/lib/child-page-words';
import type { ChildPagePayload } from '@/lib/child-page';

export default function SplitRecordsWindow({ orgSlug, read, onClose, onSplit }: {
  orgSlug: string; read: ChildPagePayload; onClose: () => void; onSplit: (message: string) => void;
}) {
  const [ticked, setTicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seasons = read.seasons;
  const firstName = read.child.firstName;
  const ready = ticked.length > 0 && ticked.length < seasons.length;

  async function split() {
    setBusy(true); setError(null);
    try {
      const r = await moneyFetch<{ error?: string }>(
        `/api/admin/families/children/${encodeURIComponent(read.child.id)}/split?orgSlug=${encodeURIComponent(orgSlug)}`,
        jsonInit('POST', { seasonKeys: ticked }),
      );
      if (!r.ok) { setError(refusalText(r.data, W.failed)); return; }
      onSplit(W.done(firstName));
    } catch {
      setError(W.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      size="medium"
      title={W.title(read.child.name)}
      onClose={onClose}
      busy={busy}
      footerStart={<span className={repKit.footNote}>{ready ? W.count(ticked.length, seasons.length) : W.chooseSome}</span>}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void split()} disabled={!ready || busy}>
            {busy ? W.splitting : W.yes}
          </button>
        </>
      )}
    >
      <p className={repKit.lead}>{W.lede}</p>
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      <p className={repKit.carryLabel} id="splitSeasons">{W.listLabel}</p>
      <div className={repKit.carry} role="group" aria-labelledby="splitSeasons">
        <div className={repKit.rollBody}>
          {seasons.map(s => {
            const on = ticked.includes(s.key);
            return (
              <label key={s.key} className={`${repKit.carryRow} ${on ? repKit.carryRowOn : ''}`}>
                <input type="checkbox" checked={on} onChange={e => setTicked(t => e.target.checked ? [...t, s.key] : t.filter(k => k !== s.key))} />
                <span className={repKit.carryText}>
                  <b>{seasonRowPhoneTitle(s)}</b>
                  <span className={repKit.carryNote}>{seasonRowPhoneLine(s)}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
      <p className={repKit.windowNote}>{W.consequence(firstName)}</p>
      {read.connectedParents.length > 0 && <p className={repKit.windowNote}>{W.parentsStay(read.connectedParents.join(' and '))}</p>}
    </KitDialog>
  );
}
