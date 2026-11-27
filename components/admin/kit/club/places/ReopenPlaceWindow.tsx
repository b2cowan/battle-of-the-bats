'use client';
/**
 * REOPEN (Club Website Stage 2, K11 A; "Closed places, summarized" Session B, the summary drawing's tab 5, S5 and S6; the
 * gate's ten answers, owner 2026-11-26 "Build as you've written"). One window per row of the Venue library's box:
 *   one place             — "Reopen Diamond 2 at Lions Park?" (today's window).
 *   a park's diamonds     — "Reopen diamonds at Lions Park?": a tick per diamond, all ticked; one press, one email per
 *                           coach (S5).
 *   covered               — every chosen closure is still said by a wider one: "Remove Diamond 1’s own closure?" with
 *                           "It stays closed." (the site doesn't change; Not now / Remove its closure).
 *   a row with rows under — "All our fields" (or a whole park) with places closed on their own: named, and one unticked
 *                           "Reopen those as well" (S6).
 * ⚖ What the site still says is the strip itself, minus the chosen closures (`reopenSite`, the site's own `closureStrip`),
 *   never words built here. The counts and the coaches are the server's (`reopenPreview`), never added up in the browser.
 * ⚖ The press reopens the whole set at once (`useReopenSet`, shared with the several window): one read of whom to tell,
 *   one coach send. It moves no game, so the postponed house league games stay under "Needs a new date" and the result
 *   goes to them.
 */
import { useMemo, useState } from 'react';
import KitDialog, { DialogCancel } from '../KitDialog';
import { repKit } from '../RepKit';
import { SendRow, SendRows } from '../SendParts';
import {
  CLOSE_WORDS as W, alsoWords, lowerEvery, oneSentence, rowsUnder, type ClosureRow, type StaffClosure,
} from '@/lib/place-closure-window';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { formatShortWeekdayDate } from '@/lib/timezone';
import { diamondsNamed } from '@/lib/place-closures';
import StripPreview from './StripPreview';
import { ReopenFigures, ReopenResult, ReopenWarn, useReopenSet, type ReopenOutcome } from './ReopenParts';
import s from './ClosePlace.module.css';

export default function ReopenPlaceWindow({ orgSlug, row, rows, closures, diamondParks, onReopened, onClose }: {
  orgSlug: string;
  /** The Venue library's row pressed. */
  row: ClosureRow;
  /** Every row (the ones under this one are offered with it, S6). */
  rows: readonly ClosureRow[];
  /** Every closure showing (what the site says now). */
  closures: readonly StaffClosure[];
  diamondParks: ReadonlySet<string>;
  onReopened: () => void;
  onClose: () => void;
}) {
  const phone = useIsPhone();
  const under = useMemo(() => rowsUnder(rows, row.key), [rows, row.key]);
  const wide = under.length > 0;
  const park = row.scope === 'diamonds' && row.diamonds.length > 1;
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set(row.diamonds.map(d => d.name)));
  const [also, setAlso] = useState(false);
  const tickedNames = row.diamonds.filter(d => ticked.has(d.name)).map(d => d.name);

  const ids = useMemo(() => {
    if (park) return row.diamonds.filter(d => ticked.has(d.name)).flatMap(d => d.closureIds);
    return [...row.closureIds, ...(wide && also ? under.flatMap(r => r.closureIds) : [])];
  }, [park, row, ticked, wide, also, under]);

  const { site, covered, p, readFailed, tooMany, busy, error, press } = useReopenSet(orgSlug, ids, closures, diamondParks, onReopened);
  const [done, setDone] = useState<ReopenOutcome | null>(null);

  // The place's short name (the covered window's "Diamond 1’s own closure"): a diamond, a park, or every place.
  const shortName = row.scope === 'diamonds' ? (row.diamonds.length === 1 ? row.diamonds[0].name : null) : row.scope === 'place' ? row.placeName : W.everyPlace;
  const parkName = row.placeName ?? '';
  const alsoSaid = wide ? alsoWords(under) : null;
  const several = park && tickedNames.length > 1;
  // The one place the window speaks of: a park's single ticked diamond, or the row's own short name.
  const oneName = park ? (tickedNames.length === 1 ? tickedNames[0] : null) : shortName;

  async function reopen() {
    const r = await press();
    if (r) setDone(r);
  }

  // ── The result ─────────────────────────────────────────────────────────────────────────────────────────────────
  if (done) {
    // A park's title names only the diamonds that did reopen (a failed one is said below).
    const reopenedNames = row.diamonds.filter(x => ticked.has(x.name) && x.closureIds.every(id => done.gone.has(id))).map(x => x.name);
    // Did the row's own closures all come off? A title never names a place that is partly still closed.
    const rowOpened = park ? reopenedNames.length > 0 : row.closureIds.every(id => done.gone.has(id));
    const title = covered
      ? (!done.all ? W.partlyRemoved : row.scope === 'all' ? W.removedAll : several ? W.removedPark : W.removed(oneName ?? row.title))
      : !rowOpened ? W.partlyReopened
      : park ? W.reopenedPark(diamondsNamed(reopenedNames, parkName)) : W.reopened(row.scope === 'all' ? W.everyPlace : row.title);
    return (
      <ReopenResult orgSlug={orgSlug} eyebrow={formatShortWeekdayDate(row.firstDay)} title={title} done={done} covered={covered}
        coveredSaid={by => W.removedSite(several, lowerEvery(by))}
        goneWord={wide && also && row.scope === 'all' ? 'anything' : several || (wide && also) ? 'they' : 'it'} onClose={onClose} />
    );
  }

  // ── The question ───────────────────────────────────────────────────────────────────────────────────────────────
  const none = park && tickedNames.length === 0;
  const coaches = p?.coaches ?? 0;
  const title = covered
    ? (row.scope === 'all' ? W.removeAllTitle : several ? W.removeParkTitle(parkName) : W.removeTitle(oneName ?? row.title))
    : park ? W.reopenParkTitle(parkName)
    : W.reopenTitle(row.scope === 'all' ? lowerEvery(W.everyPlace) : row.scope === 'place' ? parkName : row.title);
  const go = covered ? W.removeGo(several)
    : park ? W.reopenParkGo(tickedNames, coaches, phone)
    : wide ? W.reopenWideGo(row.placeName, also, coaches, phone)
    : W.reopenGo(coaches, phone);
  const marksWhat = row.scope === 'all' ? null : park ? (tickedNames.length === 1 ? 'the diamond' : 'the diamonds')
    : row.scope === 'diamonds' ? 'the diamond' : 'the place';

  const siteLines = () => {
    if (site.kind === 'covered') {
      return (<>
        <ReopenWarn><b>{W.removeStays(several)}</b>{W.removeBy(site.by)}</ReopenWarn>
        {!site.samePlace && <p className={s.para}>{W.removeThen(several ? null : oneName, site.byName)}</p>}
      </>);
    }
    const sentence = oneSentence(site.still);
    if (wide) {
      return (<>
        {sentence && <p className={s.para}>{W.reopenThenSays}<b>{sentence}</b></p>}
        {site.still && !sentence && <StripPreview strip={site.still} lead={W.reopenThenShows} />}
        {!site.still && <p className={s.para}>{row.scope === 'all' ? W.reopenNothingLeft : W.reopenSite('they’re closed')}</p>}
      </>);
    }
    const what = park ? (tickedNames.length === 1 ? `${tickedNames[0]} is closed` : 'they’re closed') : site.own ?? undefined;
    return (<>
      <p className={s.para}>{W.reopenSite(what)}{sentence && <>{W.reopenStillSays}<b>{sentence}</b></>}</p>
      {site.still && !sentence && <StripPreview strip={site.still} lead={W.reopenStillShows} />}
    </>);
  };

  return (
    <KitDialog kind="question" title={title} onClose={onClose} busy={busy}
      footer={(
        <>
          <DialogCancel>{covered ? W.notNow : W.reopenKeep}</DialogCancel>
          <button type="button" className="btn btn-lime" disabled={busy || none || !p} onClick={() => void reopen()}>
            {busy ? (covered ? W.removing : W.reopening) : go}
          </button>
        </>
      )}>
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      {park && (
        <SendRows group={{ label: W.reopenTicksLabel }}>
          {row.diamonds.map(d => (
            <SendRow key={d.name} title={d.name} sub={d.lines.map(line => <span key={line} className={s.tickLine}>{line}</span>)}
              pick={{ checked: ticked.has(d.name), onChange: on => { if (!busy) setTicked(t => { const n = new Set(t); if (on) n.add(d.name); else n.delete(d.name); return n; }); } }} />
          ))}
        </SendRows>
      )}
      {wide && alsoSaid && (<>
        <ReopenWarn>{W.alsoClosed(alsoSaid.names, alsoSaid.one)}</ReopenWarn>
        <SendRows>
          <SendRow title={W.alsoTick(alsoSaid.count, alsoSaid.diamonds)}
            pick={{ checked: also, onChange: on => { if (!busy) setAlso(on); } }} />
        </SendRows>
      </>)}
      {none ? <p className={s.para}>{W.reopenNone}</p> : (<>
        {siteLines()}
        <ReopenFigures p={p} readFailed={readFailed} tooMany={tooMany} marksWhat={marksWhat} covered={covered} />
      </>)}
    </KitDialog>
  );
}
