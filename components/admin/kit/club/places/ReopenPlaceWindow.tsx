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
 * ⚖ The press reopens the whole set at once (`POST …/place-closures/reopen`): one read of whom to tell, one coach send.
 *   It moves no game, so the postponed house league games stay under "Needs a new date" and the result goes to them.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import KitDialog, { DialogCancel } from '../KitDialog';
import ck from '../ClubKit.module.css';
import { repKit } from '../RepKit';
import { SendRow, SendRows } from '../SendParts';
import {
  CLOSE_WORDS as W, alsoWords, closedParks, lowerEvery, oneSentence, reopenSite, rowsUnder,
  type ClosureRow, type ReopenPreview, type ReopenSite, type StaffClosure,
} from '@/lib/place-closure-window';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { formatShortWeekdayDate } from '@/lib/timezone';
import { diamondsNamed } from '@/lib/place-closures';
import StripPreview from './StripPreview';
import s from './ClosePlace.module.css';

interface Done { reopened: string[]; failed: string[]; coaches: number; stillWaiting: number; seasonIds: string[] }

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
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
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
  const idsKey = ids.join(',');

  const [nowIso] = useState(() => new Date().toISOString());
  const site: ReopenSite = useMemo(() => reopenSite(closures, new Set(ids), diamondParks, nowIso), [closures, ids, diamondParks, nowIso]);
  const covered = site.kind === 'covered';

  // The server's figures for the chosen set, read again when the ticks change (the last read wins).
  const [preview, setPreview] = useState<{ key: string; p: ReopenPreview } | null>(null);
  // The set whose read failed: a new set of ticks reads afresh, without the old error standing over it.
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const readFailed = failedKey === idsKey;
  useEffect(() => {
    if (!idsKey) return;
    let stale = false;
    // org-slug-ok: `q` is built from the orgSlug prop above
    fetch(`/api/admin/org/place-closures/reopen?${q}&ids=${idsKey}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(d => { if (stale) return; if (d) { setPreview({ key: idsKey, p: d as ReopenPreview }); setFailedKey(null); } else setFailedKey(idsKey); });
    return () => { stale = true; };
  }, [q, idsKey]);
  const p = preview?.key === idsKey ? preview.p : null;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ d: Done; site: ReopenSite; all: boolean; names: string[]; team: string | null } | null>(null);

  // The place's short name (the covered window's "Diamond 1’s own closure"): a diamond, a park, or every place.
  const shortName = row.scope === 'diamonds' ? (row.diamonds.length === 1 ? row.diamonds[0].name : null) : row.scope === 'place' ? row.placeName : W.everyPlace;
  const parkName = row.placeName ?? '';
  const alsoSaid = wide ? alsoWords(under) : null;
  const several = park && tickedNames.length > 1;
  // The one place the window speaks of: a park's single ticked diamond, or the row's own short name.
  const oneName = park ? (tickedNames.length === 1 ? tickedNames[0] : null) : shortName;

  async function reopen() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/admin/org/place-closures/reopen?${q}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (!res?.ok || !data) { setError((data as { error?: string } | null)?.error ?? W.reopenPressFailed); return; }
    const d = data as Done;
    onReopened();
    const failedNames = closedParks(closures.filter(c => d.failed.includes(c.id)));
    if (!d.reopened.length) { setError(W.reopenFailed(failedNames)); return; }
    // What the site says now is read over what DID reopen: a closure that failed is still showing.
    const all = ids.every(id => d.reopened.includes(id));
    const after = all ? site : reopenSite(closures, new Set(d.reopened), diamondParks, nowIso);
    setDone({ d, site: after, all, names: failedNames, team: p?.team ?? null });
  }

  // ── The result ─────────────────────────────────────────────────────────────────────────────────────────────────
  if (done) {
    const { d } = done;
    const seasonHref = d.seasonIds[0] ? `/${orgSlug}/admin/house-league/seasons/${d.seasonIds[0]}/schedule` : null;
    // A park's title names only the diamonds that did reopen (a failed one is said below).
    const reopenedNames = row.diamonds.filter(x => ticked.has(x.name) && x.closureIds.every(id => d.reopened.includes(id))).map(x => x.name);
    // Did the row's own closures all come off? A title never names a place that is partly still closed.
    const rowOpened = park ? reopenedNames.length > 0 : row.closureIds.every(id => d.reopened.includes(id));
    const title = covered
      ? (!done.all ? W.partlyRemoved : row.scope === 'all' ? W.removedAll : several ? W.removedPark : W.removed(oneName ?? row.title))
      : !rowOpened ? W.partlyReopened
      : park ? W.reopenedPark(diamondsNamed(reopenedNames, parkName)) : W.reopened(row.scope === 'all' ? W.everyPlace : row.title);
    const still = done.site.kind === 'stops' ? done.site.still : null;
    const sentence = oneSentence(still);
    const coachWords = W.reopenedCoaches(d.coaches, done.team);
    // More than one sentence still shows: the strip itself, under its own lead, after what the press did.
    const strip = still && !sentence ? still : null;
    const gone: 'it' | 'they' | 'anything' = wide && also && row.scope === 'all' ? 'anything' : several || (wide && also) ? 'they' : 'it';
    return (
      <KitDialog kind="form" eyebrow={formatShortWeekdayDate(row.firstDay)} title={title} onClose={onClose}
        footer={(
          <>
            <DialogCancel>{W.done}</DialogCancel>
            {!covered && d.stillWaiting > 0 && seasonHref && <Link className="btn btn-lime" href={seasonHref}>{W.newDates}</Link>}
          </>
        )}>
        {(!strip || coachWords) && (
          <div className={`${ck.notice} ${ck.noticeGood}`} aria-live="polite">
            <CheckCircle2 size={16} aria-hidden />
            <span className={ck.noticeBody}>
              {done.site.kind === 'covered'
                ? W.removedSite(several, lowerEvery(done.site.by))
                : sentence
                  ? <>{W.reopenedNowSays}<b>{sentence}</b></>
                  : !strip && W.reopenedGone(gone)}
              {strip ? coachWords.trim() : coachWords}
            </span>
          </div>
        )}
        {strip && <StripPreview strip={strip} lead={W.reopenedNowShows} />}
        {done.names.length > 0 && (
          <div className={`${ck.notice} ${ck.noticeWarn}`}>
            <AlertTriangle size={16} aria-hidden />
            <span className={ck.noticeBody}>{W.reopenFailed(done.names)}</span>
          </div>
        )}
        {!covered && d.stillWaiting > 0 && (
          <div className={`${ck.notice} ${ck.noticeWarn}`}>
            <AlertTriangle size={16} aria-hidden />
            <span className={ck.noticeBody}><b>{W.reopenedStill(d.stillWaiting)}</b>{W.reopenedStillRest(d.stillWaiting)}</span>
          </div>
        )}
      </KitDialog>
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
        <div className={`${ck.notice} ${ck.noticeWarn}`}>
          <AlertTriangle size={16} aria-hidden />
          <span className={ck.noticeBody}><b>{W.removeStays(several)}</b>{W.removeBy(site.by)}</span>
        </div>
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
        <div className={`${ck.notice} ${ck.noticeWarn}`}>
          <AlertTriangle size={16} aria-hidden />
          <span className={ck.noticeBody}>{W.alsoClosed(alsoSaid.names, alsoSaid.one)}</span>
        </div>
        <SendRows>
          <SendRow title={W.alsoTick(alsoSaid.count, alsoSaid.diamonds)}
            pick={{ checked: also, onChange: on => { if (!busy) setAlso(on); } }} />
        </SendRows>
      </>)}
      {none ? <p className={s.para}>{W.reopenNone}</p> : (<>
        {siteLines()}
        {!p && !readFailed && <p className={ck.hint}>{W.reopenLoading}</p>}
        {readFailed && <p className={repKit.formError} role="alert">{W.reopenReadFailed}</p>}
        {p && p.marksOff > 0 && <p className={s.para}>{W.reopenMarksSet(p.marksOff, p.team, marksWhat)}</p>}
        {p && p.kept > 0 && <p className={s.para}>{W.reopenKept(p.kept, p.keptWhile)}</p>}
        {!covered && p && p.stillWaiting > 0 && <p className={s.para}><b>{W.reopenStill(p.stillWaiting)}</b>{W.reopenStillRest(p.stillWaiting)}</p>}
      </>)}
    </KitDialog>
  );
}
