'use client';
/**
 * REOPEN SEVERAL (owner 2026-11-27: "if most of these were closed on one click, why can't I reopen on one click?", then
 * "build it as sketched"): the Venue library box's "Reopen 4 places", for two ticked rows or more. One row ticked opens
 * that row's own window (`ReopenPlaceWindow`), which knows its diamonds and what sits under it.
 *   the question — what is being reopened, a row each with its days; a row a closure left showing still says reads "Stays
 *     closed: …"; places left closed under a ticked row are named; what the site will then say; the marks and the one
 *     email per coach (the server's figures). Every row covered: "Remove these closures?", and the site doesn't change.
 *   the result   — how many places reopened, what the site says now, who was emailed, what didn't reopen, what stays.
 * ⚖ What the site says is the strip itself minus the chosen closures (`reopenSite`), never words built here.
 */
import { useMemo, useState } from 'react';
import KitDialog, { DialogCancel } from '../KitDialog';
import { repKit } from '../RepKit';
import { SendRow, SendRows } from '../SendParts';
import {
  CLOSE_WORDS as W, alsoWords, oneSentence, pickedLabel, pickedPlaces, rowDays, rowsUnder, staysLines,
  type ClosureRow, type StaffClosure,
} from '@/lib/place-closure-window';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { formatShortWeekdayDate } from '@/lib/timezone';
import StripPreview from './StripPreview';
import { ReopenFigures, ReopenResult, ReopenWarn, useReopenSet, type ReopenOutcome } from './ReopenParts';
import s from './ClosePlace.module.css';

export default function ReopenSeveralWindow({ orgSlug, picked, rows, closures, diamondParks, onReopened, onClose }: {
  orgSlug: string;
  /** The ticked rows, in the box's order. */
  picked: readonly ClosureRow[];
  /** Every row (the unticked ones under a ticked row are named as staying closed). */
  rows: readonly ClosureRow[];
  /** Every closure showing (what the site says now). */
  closures: readonly StaffClosure[];
  diamondParks: ReadonlySet<string>;
  onReopened: () => void;
  onClose: () => void;
}) {
  const phone = useIsPhone();
  const ids = useMemo(() => picked.flatMap(r => r.closureIds), [picked]);
  const { nowIso, site, covered, p, readFailed, tooMany, busy, error, press } = useReopenSet(orgSlug, ids, closures, diamondParks, onReopened);
  const [done, setDone] = useState<ReopenOutcome | null>(null);

  // By row key: what a ticked row says when a closure left showing still holds some of it, once `gone` have come off.
  const staying = (gone: ReadonlySet<string>) => new Map(picked.flatMap(r => {
    const lines = staysLines(r, closures, gone, diamondParks, nowIso);
    return lines.length ? [[r.key, lines] as const] : [];
  }));
  const held = staying(new Set(ids));
  const leftUnder = picked.flatMap(r => rowsUnder(rows, r.key)).filter(r => !picked.includes(r));
  const alsoSaid = leftUnder.length ? alsoWords(leftUnder) : null;
  // One date over the result only when every ticked row is that one day.
  const oneDay = picked.every(r => r.firstDay === picked[0].firstDay && r.lastDay === picked[0].firstDay) ? picked[0].firstDay : null;

  async function reopen() {
    const r = await press();
    if (r) setDone(r);
  }

  // ── The result ─────────────────────────────────────────────────────────────────────────────────────────────────
  if (done) {
    const stayed = staying(done.gone);
    // A count only where all of it opened: with something still closed, the title claims no number.
    const counted = pickedPlaces(picked);
    const title = covered ? (done.all ? W.removedSeveral : W.partlyRemoved)
      : !done.all ? W.partlyReopened
      : stayed.size ? W.reopenedPlain
      : counted.all ? (counted.places ? W.reopenedPlain : W.reopenedAll)
      : W.reopenedPlaces(counted.places);
    return (
      <ReopenResult orgSlug={orgSlug} eyebrow={oneDay ? formatShortWeekdayDate(oneDay) : undefined} title={title} done={done}
        covered={covered} coveredSaid={() => W.severalStayedAll} goneWord="they" onClose={onClose}>
        {!covered && picked.filter(r => stayed.has(r.key)).map(r => (
          <ReopenWarn key={r.key}><b>{r.title}</b>{stayed.get(r.key)!.map(line => <span key={line} className={s.tickLine}>{line}</span>)}</ReopenWarn>
        ))}
      </ReopenResult>
    );
  }

  // ── The question ───────────────────────────────────────────────────────────────────────────────────────────────
  const coaches = p?.coaches ?? 0;
  const label = pickedLabel(picked);
  // Some of what is ticked stays closed: neither the title nor the button says a number of places will reopen.
  const mixed = !covered && held.size > 0;
  const siteLines = () => {
    if (site.kind === 'covered') return <ReopenWarn><b>{W.severalStaysAll}</b></ReopenWarn>;
    const sentence = oneSentence(site.still);
    if (sentence) return <p className={s.para}>{W.reopenThenSays}<b>{sentence}</b></p>;
    if (site.still) return <StripPreview strip={site.still} lead={W.reopenThenShows} />;
    // Nothing of these places will still show: everything the site says goes, or only what it says of them.
    const everything = closures.every(c => ids.includes(c.id));
    return <p className={s.para}>{everything ? W.reopenNothingLeft : W.reopenSite('they’re closed')}</p>;
  };

  return (
    <KitDialog kind="question" title={covered ? W.severalRemoveTitle : mixed ? W.severalMixedTitle : `${label}?`} onClose={onClose} busy={busy}
      footer={(
        <>
          <DialogCancel>{covered ? W.notNow : W.severalKeep}</DialogCancel>
          <button type="button" className="btn btn-lime" disabled={busy || !p} onClick={() => void reopen()}>
            {busy ? (covered ? W.removing : W.reopening) : covered ? W.removeGo(true) : mixed ? W.reopenGo(coaches, phone) : W.severalGo(label, coaches, phone)}
          </button>
        </>
      )}>
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      <SendRows group={{ label: W.severalListLabel }}>
        {picked.map(r => {
          const stays = held.get(r.key) ?? [];
          return (
            <SendRow key={r.key} title={r.title}
              sub={[rowDays(r), ...stays].map(line => <span key={line} className={s.tickLine}>{line}</span>)} />
          );
        })}
      </SendRows>
      {alsoSaid && <ReopenWarn>{W.alsoStays(alsoSaid.names, alsoSaid.one)}</ReopenWarn>}
      {siteLines()}
      <ReopenFigures p={p} readFailed={readFailed} tooMany={tooMany} covered={covered}
        marksWhat={picked.some(r => r.scope === 'all') ? null : 'the places'} />
    </KitDialog>
  );
}
