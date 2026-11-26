'use client';
/**
 * CLOSE A PLACE (Club Website Stage 2, Session 2B; rulings K1–K17, plan CLUB_WEBSITE_ENHANCEMENTS_PLAN.md §7; the drawing
 * CLUB_WEBSITE_STAGE2_DRAWINGS.html tabs 2 and 3; words `CLOSE_WORDS`). Today's Rainout window widened from one season's
 * day to one place's day across the club: the place (or one diamond, K2), the Day and Until (K3), postpone or cancel, then
 * what is there grouped by program — house league (ticked), rep (ticked, marked for the coach, never moved), the places
 * typed by hand (unticked, with "Link both", K7), games already started (unticked, K6) — and what nothing here changes:
 * tournaments (their own Rain delay, K13) and practices. The list and the sentences under it are the preview: there is no
 * second screen. NO HOLD (K5): the press sends. Then the result, in the same window.
 *
 * Three buttons open it, all worded "Close a place" with the rain cloud (owner 2026-11-26): the Venue library's toolbar,
 * the Overview's first heading, and the house league schedule's (K15, `season`: it opens on that season's places that
 * day). A house league admin sees rep and tournaments as counts with no door (K1; the server leaves their names out).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import KitDialog, { DialogCancel } from '../KitDialog';
import ck from '../ClubKit.module.css';
import { repKit } from '../RepKit';
import { SendRow, SendRows } from '../SendParts';
import { Statement } from '../schedules/ScheduleParts';
import FormTable, { type FormTableGroup, type FormTableRow } from '@/components/shared/FormTable';
import { ViewSwitch } from '@/components/coaches/kit';
import LoadingState from '@/components/shared/LoadingState';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { addCalendarDays, orgDayKey } from '@/lib/timezone';
import { teamsHearing } from '@/lib/league-game-changes';
import {
  CLOSE_LINE_MAX, CLOSE_WORDS as W, canLink, closeDays, closeSummary, defaultTicks, gameWhereLine, isTyped, linkTargets,
  placesWord, previewSentences, untilDays,
  type CloseFrame, type CloseSource, type RepReach,
} from '@/lib/place-closure-window';
import type { ClosureVerb } from '@/lib/place-closures';
import { shortDivision, type RainSendDivision } from '@/lib/league-rainout';
import s from './ClosePlace.module.css';

type Pick = { kind: 'venue'; venueId: string } | { kind: 'all' } | { kind: 'season' };

interface PressResult {
  closureIds: string[]; replay: boolean;
  league: { verb: ClosureVerb; games: number; teams: number; divisions: (RainSendDivision & { seasonId: string })[]; unsent: boolean };
  rep: { games: number; teams: { teamId: string; name: string; reach: RepReach; sent: boolean }[] };
}

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)));

export default function ClosePlaceWindow({ orgSlug, eyebrow, season, initialVenueId, venueLibraryHref, onOpenVenueLibrary, onClosed, onOpenChanges, onNewDates, onClose }: {
  orgSlug: string;
  /** "Venue library" · the season's name (its schedule). None from the Overview: the bar already names where you are. */
  eyebrow?: string;
  /** K15: opened from a season's schedule — on that season's places that day. */
  season?: { id: string; name: string } | null;
  initialVenueId?: string | null;
  venueLibraryHref: string;
  /** The no-places state's door (the Venue library page opens its Add window instead of navigating). */
  onOpenVenueLibrary?: () => void;
  /** The press wrote: the page reads again. */
  onClosed?: () => void;
  /** The season door's "Open Changes to send" and "Give them new dates" (else these are links to the season schedule). */
  onOpenChanges?: (divisionId: string | null) => void;
  onNewDates?: (divisionId: string) => void;
  onClose: () => void;
}) {
  const phone = useIsPhone();
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const api = '/api/admin/org/place-closures';
  const pressKey = useRef(newKey());
  /** What the key stands for: a changed press after a failed one (the answer lost) is a NEW press, never a replay. */
  const pressFor = useRef('');
  // The season by its id: a caller passes a fresh object each render, and the frame is read once per window.
  const seasonId = season?.id ?? null;

  const [frame, setFrame] = useState<CloseFrame | null>(null);
  const [seasonPlaces, setSeasonPlaces] = useState<string[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);
  const [diamond, setDiamond] = useState('');
  const [firstDay, setFirstDay] = useState('');
  const [lastDay, setLastDay] = useState('');
  const [verb, setVerb] = useState<ClosureVerb>('postponed');
  const [source, setSource] = useState<CloseSource | null>(null);
  const [sourceFailed, setSourceFailed] = useState(false);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const [link, setLink] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [othersOpen, setOthersOpen] = useState(false);
  const [lineShown, setLineShown] = useState(false);
  const [line, setLine] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PressResult | null>(null);
  const [typedSeen, setTypedSeen] = useState(false);

  // The frame first: the club's places, its day, and (from a season's schedule) that season's places today.
  useEffect(() => {
    let live = true;
    void (async () => {
      const first = await fetch(`${api}?${q}`, { cache: 'no-store' }).catch(() => null);
      const data = first?.ok ? await first.json().catch(() => null) : null;
      const f = (data as { frame?: CloseFrame } | null)?.frame;
      if (!live) return;
      if (!f) { setLoadFailed(true); return; }
      let sp: string[] = [];
      let day = f.today;
      if (seasonId) {
        // The season's places today, or on its next day with games (where the one-season Rainout opened).
        const r = await fetch(`${api}?${q}&seasonId=${seasonId}&day=${f.today}&next=1`, { cache: 'no-store' }).catch(() => null);
        const d = r?.ok ? await r.json().catch(() => null) : null;
        sp = ((d as { seasonPlaces?: string[] } | null)?.seasonPlaces ?? []);
        day = ((d as { seasonDay?: string } | null)?.seasonDay ?? f.today);
        if (!live) return;
      }
      seasonDays.current = { first: day, last: day };
      setFrame(f); setSeasonPlaces(sp); setFirstDay(day); setLastDay(day);
      const start = initialVenueId && f.venues.some(v => v.id === initialVenueId) ? initialVenueId : null;
      setPick(sp.length > 1 ? { kind: 'season' }
        : sp.length === 1 ? { kind: 'venue', venueId: sp[0] }
        : start ? { kind: 'venue', venueId: start }
        : f.venues[0] ? { kind: 'venue', venueId: f.venues[0].id } : null);
    })();
    return () => { live = false; };
  }, [q, seasonId, initialVenueId]);

  // K15: the season's places follow the window's days (a closure set for Saturday closes Saturday's places, not today's).
  const seasonDays = useRef<{ first: string; last: string } | null>(null);
  useEffect(() => {
    if (!seasonId || !firstDay || !seasonDays.current) return;
    const last = lastDay || firstDay;
    if (seasonDays.current.first === firstDay && seasonDays.current.last === last) return;
    seasonDays.current = { first: firstDay, last };
    let live = true;
    void fetch(`${api}?${q}&seasonId=${seasonId}&day=${firstDay}&dayLast=${last}`, { cache: 'no-store' }).catch(() => null)
      .then(r => (r?.ok ? r.json().catch(() => null) : null))
      .then(d => {
        if (!live) return;
        const sp = ((d as { seasonPlaces?: string[] } | null)?.seasonPlaces ?? []);
        setSeasonPlaces(sp);
        // Only the season's own pick follows the days; a place the admin chose stays chosen.
        setPick(prev => (prev?.kind !== 'season' ? prev
          : sp.length > 1 ? prev : sp.length === 1 ? { kind: 'venue', venueId: sp[0] } : prev));
      });
    return () => { live = false; };
  }, [seasonId, firstDay, lastDay, q]);

  const venue = pick?.kind === 'venue' ? frame?.venues.find(v => v.id === pick.venueId) ?? null : null;
  const placesParam = !pick ? null
    : pick.kind === 'all' ? 'all'
    : pick.kind === 'season' ? seasonPlaces.join(',')
    : diamond ? `${pick.venueId}:${diamond}` : pick.venueId;

  const read = useCallback(async (): Promise<CloseSource | null> => {
    if (!placesParam || !firstDay) return null;
    const r = await fetch(`${api}?${q}&places=${placesParam}&first=${firstDay}&last=${lastDay || firstDay}`, { cache: 'no-store' }).catch(() => null);
    const d = r?.ok ? await r.json().catch(() => null) : null;
    return (d as { source?: CloseSource } | null)?.source ?? null;
  }, [placesParam, firstDay, lastDay, q]);

  // The window's read, again whenever the place, the diamond or the days change (the ticks reset to what's on the place).
  useEffect(() => {
    if (!placesParam || !firstDay) return;
    let live = true;
    setSource(null); setSourceFailed(false);
    void read().then(src => {
      if (!live) return;
      if (!src) { setSourceFailed(true); return; }
      setSource(src); setTicked(defaultTicks(src)); setLink(false);
      // On a phone, only the groups that need a choice stay open: the typed group, and any holding a started game.
      setOpen(new Set(['typed', ...src.league.filter(g => g.started && g.match === 'linked').map(g => `s:${g.seasonId}`),
        ...(src.rep.some(g => g.started && g.match === 'linked') ? ['rep'] : [])]));
    });
    return () => { live = false; };
  }, [read, placesParam, firstDay]);

  const tick = useCallback((ids: readonly string[], on: boolean) => setTicked(prev => {
    const next = new Set(prev);
    for (const id of ids) { if (on) next.add(id); else next.delete(id); }
    return next;
  }), []);
  const toggleOpen = useCallback((key: string) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  }), []);

  const sum = useMemo(() => (source ? closeSummary(source, ticked) : null), [source, ticked]);
  const places = source?.places ?? [];
  const multiDay = !!lastDay && lastDay !== firstDay;
  const isToday = firstDay === frame?.today;
  const links = useMemo(() => (source ? linkTargets(source, ticked) : []), [source, ticked]);

  // ── The table: house league (one group per season), rep, typed by hand ─────────────────────────────────────────
  const { rows, groups, drafts, typedCount } = useMemo(() => {
    const rows: FormTableRow[] = [];
    const groups: FormTableGroup[] = [];
    if (!source) return { rows, groups, drafts: [] as string[], typedCount: 0 };
    const divName = new Map(source.seasons.flatMap(x => x.divisions.map(d => [d.id, d.name] as const)));
    const where = (iso: string, field: string | null, tail: string | null) => gameWhereLine(iso, field, tail, multiDay, orgDayKey);
    let firstStarted = true;
    const startedLine = (iso: string) => {
      const note = firstStarted ? <> {W.startedTick}</> : null;
      firstStarted = false;
      return <span className={s.sub}><b>{W.started(iso)}</b>{note}</span>;
    };
    const group = (key: string, label: string, count: string, ids: string[], fold: boolean) => {
      const n = ids.filter(id => ticked.has(id)).length;
      groups.push({
        key, label, count, state: n === 0 ? 'none' : n === ids.length ? 'all' : 'some',
        onTick: on => tick(ids, on), tickLabel: `${label}: ${count}`, phoneFigure: `${n} of ${ids.length}`,
        fold: fold ? { open: open.has(key), onToggle: () => toggleOpen(key), label: `${label}: ${count}` } : undefined,
      });
    };
    // House league, linked to the place, published (a draft division's games are never listed: one line names it).
    for (const season of source.seasons) {
      const games = source.league.filter(g => g.seasonId === season.id && g.match === 'linked' && g.published)
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id));
      if (!games.length) continue;
      const key = `s:${season.id}`;
      for (const g of games) {
        const name = `${g.home} vs ${g.away}`;
        const line = where(g.scheduledAt, g.field, divName.has(g.divisionId) ? shortDivision(divName.get(g.divisionId)!) : null);
        const extra = g.started ? startedLine(g.scheduledAt) : null;
        rows.push({
          key: g.id, group: key, name, ticked: ticked.has(g.id), onTick: on => tick([g.id], on), tickLabel: name,
          cells: { when: <>{line}{extra}</> }, phoneLine: <>{line}{extra}</>,
        });
      }
      group(key, W.league, W.leagueCount(season.name, games.length, teamsHearing(games).size), games.map(g => g.id), true);
    }
    // Rep, linked to the place: marked for the coach (an owner's or an admin's view; a house league admin's is a count).
    if (!source.repHidden) {
      const games = source.rep.filter(g => g.match === 'linked').sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      if (games.length) {
        for (const g of games) {
          const name = g.opponent ? `${g.teamName} vs ${g.opponent}` : g.teamName;
          const line = where(g.startsAt, g.field, null);
          const extra = g.started ? startedLine(g.startsAt) : <span className={s.sub}>{W.repNote(source.repReach[g.teamId] ?? 'none')}</span>;
          rows.push({
            key: g.id, group: 'rep', name, ticked: ticked.has(g.id), onTick: on => tick([g.id], on), tickLabel: name,
            cells: { when: <>{line}{extra}</> }, phoneLine: <>{line}{extra}</>,
          });
        }
        group('rep', W.rep, phone ? W.repCountPhone(games.length, games.every(g => source.repReach[g.teamId] === 'head') ? 'head' : games.every(g => source.repReach[g.teamId] === 'none') ? 'none' : 'others') : W.repCount(games.length), games.map(g => g.id), true);
      }
    }
    // Typed by hand (K7): found by the place's name in the typed words, unticked.
    const typedLeague = source.league.filter(g => isTyped(g) && g.published);
    const typedRep = source.repHidden ? [] : source.rep.filter(isTyped);
    const typed = [
      ...typedLeague.map(g => ({ id: g.id, at: g.scheduledAt, name: `${g.home} vs ${g.away}`, tail: divName.has(g.divisionId) ? `House league · ${shortDivision(divName.get(g.divisionId)!)}` : 'House league', typed: g.typed, started: g.started })),
      ...typedRep.map(g => ({ id: g.id, at: g.startsAt, name: g.opponent ? `${g.teamName} vs ${g.opponent}` : g.teamName, tail: 'Rep', typed: g.typed, started: g.started })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    for (const g of typed) {
      const line = where(g.at, null, g.tail);
      const extra = <>{g.typed && <span className={s.sub}>{W.typedLine(g.typed)}</span>}{g.started && startedLine(g.at)}</>;
      rows.push({
        key: g.id, group: 'typed', name: g.name, ticked: ticked.has(g.id), onTick: on => tick([g.id], on), tickLabel: g.name,
        cells: { when: <>{line}{extra}</> }, phoneLine: <>{line}{extra}</>,
      });
    }
    if (typed.length) group('typed', W.typed, W.typedCount(source.places, typed.length), typed.map(g => g.id), true);
    const drafts = source.seasons.flatMap(x => x.divisions.filter(d => !d.published && source.league.some(g => g.divisionId === d.id)).map(d => d.name));
    return { rows, groups, drafts, typedCount: typed.length };
  }, [source, ticked, tick, open, toggleOpen, multiDay, phone]);

  const typedLinkable = useMemo(() => (source ? [
    ...source.league.filter(g => isTyped(g) && g.published && canLink(g)),
    ...(source.repHidden ? [] : source.rep.filter(g => isTyped(g) && canLink(g))),
  ] : []), [source]);
  const anyTypedTicked = typedLinkable.some(g => ticked.has(g.id));
  const linkCount = anyTypedTicked ? typedLinkable.filter(g => ticked.has(g.id)).length : typedLinkable.length;

  async function press() {
    if (!source || !sum) return;
    setBusy(true); setError(null);
    const body = {
      pressKey: pressKey.current, verb, line, firstDay, lastDay: lastDay || firstDay,
      places: source.places.map(p => ({ venueId: p.venueId, facilityId: p.facilityId })),
      league: source.league.filter(g => ticked.has(g.id) && g.published).map(g => ({ id: g.id, seen: g.seen })),
      rep: source.rep.filter(g => ticked.has(g.id)).map(g => ({ id: g.id, seen: g.seen })),
      links: link && source.places[0]?.scope !== 'all' ? links : [],
    };
    const what = JSON.stringify({ ...body, pressKey: null });
    if (pressFor.current && pressFor.current !== what) pressKey.current = newKey();
    pressFor.current = what;
    body.pressKey = pressKey.current;
    const res = await fetch(`${api}?${q}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (!res?.ok || !data) {
      setError(!res ? W.errNetwork : (data as { error?: string } | null)?.error ?? W.errChanged);
      // Refused because something moved on: read again, keeping the ticks that still name a listed game — except a game
      // that has STARTED since (K6: never called off mid-game unless ticked as started) — and ticking a game newly on the
      // place, as the window opens.
      if (res?.status === 409) {
        const src = await read();
        if (src) {
          const before = new Map([...source.league, ...source.rep].map(g => [g.id, g.started]));
          const now = [...src.league, ...src.rep];
          const fresh = defaultTicks(src);
          const keep = new Set(now.filter(g => {
            if (!before.has(g.id)) return fresh.has(g.id);
            if (g.started && !before.get(g.id)) return false;
            return ticked.has(g.id);
          }).map(g => g.id));
          setSource(src); setTicked(keep);
        }
      }
      return;
    }
    onClosed?.();
    setResult(data as PressResult);
  }

  // ── The result (tab 3) ────────────────────────────────────────────────────────────────────────────────────────────
  if (result && source) {
    const told = result.league.divisions.filter(d => d.outcome === 'told');
    const failed = result.league.divisions.filter(d => d.outcome === 'failed');
    const emails = told.reduce((n, d) => n + d.emails, 0);
    const failedGames = failed.reduce((n, d) => n + d.games, 0);
    const sentences = previewSentences(places, firstDay, lastDay || firstDay, frame?.today ?? firstDay);
    // The typed games left unticked: still "on" and maybe at the closed place (amber, so the strip and they never disagree
    // silently).
    const typedLeftGames = [...source.league.filter(g => isTyped(g) && g.published && !ticked.has(g.id)).map(g => ({ id: g.id, name: `${g.home} vs ${g.away}` })),
      ...(source.repHidden ? [] : source.rep.filter(g => isTyped(g) && !ticked.has(g.id)).map(g => ({ id: g.id, name: g.opponent ? `${g.teamName} vs ${g.opponent}` : g.teamName })))];
    const seasonId = result.league.divisions[0]?.seasonId ?? source.seasons[0]?.id ?? null;
    const seasonHref = seasonId ? `/${orgSlug}/admin/house-league/seasons/${seasonId}/schedule` : null;
    const tournaments = source.tournaments;
    const rainDelayHref = (t: CloseSource['tournaments'][number]) => {
      const qs = new URLSearchParams({ tournamentId: t.id, tool: 'rain-delay', day: firstDay });
      if (t.diamondIds.length) { qs.set('diamonds', t.diamondIds.join(',')); qs.set('closed', placesWord(places)); }
      return `/${orgSlug}/admin/tournaments/schedule?${qs.toString()}`;
    };
    return (
      <KitDialog kind="form" size="medium" eyebrow={W.dayValue(firstDay, '')} title={W.doneTitle(places)} onClose={onClose}
        footer={(
          <>
            <DialogCancel>{W.done}</DialogCancel>
            {failed.length > 0 || result.league.unsent
              ? (onOpenChanges
                ? <button type="button" className="btn btn-lime" onClick={() => { onOpenChanges(failed[0]?.divisionId ?? null); onClose(); }}>{W.failOpen}</button>
                : seasonHref && <Link className="btn btn-lime" href={seasonHref}>{W.failOpen}</Link>)
              : result.league.verb === 'postponed' && told.length > 0 && (onNewDates
                ? <button type="button" className="btn btn-outline" onClick={() => { onNewDates(told[0].divisionId); onClose(); }}>{W.newDates}</button>
                : seasonHref && <Link className="btn btn-outline" href={seasonHref}>{W.newDates}</Link>)}
          </>
        )}>
        {result.replay && <p className={ck.hint}>{W.replay}</p>}
        {(result.league.games > 0 || result.league.unsent) && (
          <div className={`${ck.notice} ${failed.length || result.league.unsent ? ck.noticeWarn : ck.noticeGood}`} aria-live="polite">
            {failed.length || result.league.unsent ? <AlertTriangle size={16} aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
            <span className={ck.noticeBody}>
              {told.length === 0 && failed.length === 0 && result.league.divisions.some(d => d.outcome === 'already')
                ? W.doneAlready(result.league.games, result.league.verb)
                : W.doneLeague(result.league.games, result.league.verb, emails, told, result.league.teams)}
              {failed.length > 0 && <> {W.doneFailed(failed.map(d => d.name).filter(Boolean), result.league.verb, failedGames || result.league.games)}</>}
              {result.league.unsent && <> {W.doneUnsent}</>}
            </span>
          </div>
        )}
        {result.rep.games > 0 && (
          <div className={`${ck.notice} ${result.rep.teams.every(t => t.sent) ? ck.noticeGood : ck.noticeWarn}`}>
            {result.rep.teams.every(t => t.sent) ? <CheckCircle2 size={16} aria-hidden /> : <AlertTriangle size={16} aria-hidden />}
            <span className={ck.noticeBody}>{W.doneRep(result.rep.games, source.repHidden ? [] : result.rep.teams)}</span>
          </div>
        )}
        {typedLeftGames.length > 0 && (
          <div className={`${ck.notice} ${ck.noticeWarn}`}>
            <AlertTriangle size={16} aria-hidden />
            <div className={`${ck.noticeBody} ${s.resultRow}`}>
              <span><b>{W.doneTyped(typedLeftGames.length)}</b>{W.doneTypedRest(places)}</span>
              {typedSeen
                ? <ul className={s.typedList}>{typedLeftGames.map(g => <li key={g.id}>{g.name}</li>)}</ul>
                : <button type="button" className="btn btn-outline" onClick={() => setTypedSeen(true)}>{W.seeTyped(typedLeftGames.length)}</button>}
            </div>
          </div>
        )}
        {tournaments.map(t => (
          <div key={t.id} className={`${ck.notice} ${ck.noticeWarn}`}>
            <AlertTriangle size={16} aria-hidden />
            <div className={`${ck.noticeBody} ${s.resultRow}`}>
              {t.diamondIds.length
                ? <span><b>{W.doneTournament(t.name, t.atPlace, places)}</b>{t.door ? W.doneTournamentRest : W.doneTournamentNoDoor}</span>
                : <span><b>{W.doneUnlinked(t.name, isToday)}</b>{W.doneUnlinkedRest(places)}</span>}
              {t.door && <Link className="btn btn-outline" href={rainDelayHref(t)}>{W.openRainDelay}</Link>}
            </div>
          </div>
        ))}
        <p className={s.para}>{W.doneSite(sentences, lastDay || firstDay)}</p>
        {result.league.games > 0 && <p className={s.para}>{W.doneNoUndo(result.league.verb)}</p>}
      </KitDialog>
    );
  }

  // ── The window (tab 2) ──────────────────────────────────────────────────────────────────────────────────────────────
  const noPlaces = !!frame && frame.venues.length === 0;
  const listedLeague = source ? source.league.filter(g => g.published).length : 0;
  const nothing = !!source && listedLeague === 0 && source.rep.length === 0;
  const repHiddenGames = source?.repHidden ? source.rep : [];
  const others = source ? { tournaments: source.tournaments, practices: source.practices, rep: repHiddenGames.length } : null;
  const othersCount = others ? others.tournaments.length + others.practices + others.rep : 0;
  const sentences = source ? previewSentences(places, firstDay, lastDay || firstDay, frame?.today ?? firstDay) : [];
  const emails = sum?.families ?? 0;
  const total = sum ? W.closing(sum.games, sum.teams) : '';
  const left = CLOSE_LINE_MAX - line.length;
  const days = frame ? closeDays(frame.today, addCalendarDays) : [];
  const untils = firstDay ? untilDays(firstDay, addCalendarDays) : [];

  const placeValue = !pick ? '' : pick.kind === 'all' ? '__all' : pick.kind === 'season' ? '__season' : pick.venueId;
  function choosePlace(v: string) {
    setDiamond('');
    setPick(v === '__all' ? { kind: 'all' } : v === '__season' ? { kind: 'season' } : { kind: 'venue', venueId: v });
  }
  function chooseDay(d: string) {
    setFirstDay(d);
    if (!lastDay || lastDay < d || addCalendarDays(d, 13) < lastDay) setLastDay(d);
  }
  const diamondViews = venue && venue.facilities.length > 1
    ? [{ id: '', label: W.allDiamonds }, ...venue.facilities.map(f => ({ id: f.id, label: f.name }))]
    : null;

  if (noPlaces) {
    return (
      <KitDialog kind="form" size="medium" title={W.title} onClose={onClose}
        footer={(
          <>
            <DialogCancel>{W.notNow}</DialogCancel>
            {onOpenVenueLibrary
              ? <button type="button" className="btn btn-lime" onClick={() => { onOpenVenueLibrary(); onClose(); }}>{W.noPlacesDoor}</button>
              : <Link className="btn btn-lime" href={venueLibraryHref}>{W.noPlacesDoor}</Link>}
          </>
        )}>
        <div className={s.empty}><b>{W.noPlacesTitle}</b>{W.noPlacesBody}</div>
      </KitDialog>
    );
  }

  return (
    <KitDialog kind="form" size="medium" eyebrow={eyebrow} title={W.title} onClose={onClose} busy={busy}
      dirty={!busy && (line.length > 0 || verb !== 'postponed' || link)}
      footerStart={source ? <span>{busy ? W.sending : phone ? W.footPhone : W.foot}</span> : undefined}
      footer={(
        <>
          <DialogCancel>{W.notNow}</DialogCancel>
          {source && sum && (
            <button type="button" className="btn btn-lime" disabled={busy} onClick={() => void press()}>
              {busy ? W.sending : W.go(places, emails, phone)}
            </button>
          )}
        </>
      )}>
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      {loadFailed && <p className={ck.hint} role="alert">{W.loadFailed}</p>}
      {!frame && !loadFailed && <LoadingState inline label={W.title} />}
      {frame && pick && (<>
        <label className={ck.field}>
          <span className={ck.label}>{W.place}</span>
          <select className={ck.select} value={placeValue} onChange={e => choosePlace(e.target.value)} disabled={busy}>
            {season && seasonPlaces.length > 1 && <option value="__season">{W.seasonPlaces(seasonPlaces.length, isToday)}</option>}
            {frame.venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            {frame.canAll && <option value="__all">{W.everyPlace}</option>}
          </select>
        </label>
        {diamondViews && (
          <div className={s.block}>
            {diamondViews.length <= 3
              ? <ViewSwitch views={diamondViews} value={diamond} onChange={setDiamond} label={W.diamonds} />
              : (
                <label className={ck.field}>
                  <span className={repKit.srOnly}>{W.diamonds}</span>
                  <select className={ck.select} value={diamond} onChange={e => setDiamond(e.target.value)} disabled={busy}>
                    {diamondViews.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                </label>
              )}
          </div>
        )}
        <div className={s.days}>
          <label className={ck.field}>
            <span className={ck.label}>{W.day}</span>
            <select className={ck.select} value={firstDay} onChange={e => chooseDay(e.target.value)} disabled={busy}>
              {days.map(d => <option key={d} value={d}>{W.dayValue(d, frame.today)}</option>)}
            </select>
          </label>
          <label className={ck.field}>
            <span className={ck.label}>{W.until}</span>
            <select className={ck.select} value={lastDay || firstDay} onChange={e => setLastDay(e.target.value)} disabled={busy}>
              {untils.map(d => <option key={d} value={d}>{d === firstDay ? W.untilSame : W.untilDay(d)}</option>)}
            </select>
          </label>
        </div>

        {sourceFailed && <p className={ck.hint} role="alert">{W.loadFailed}</p>}
        {!source && !sourceFailed && <LoadingState inline label={W.title} />}
        {source && (<>
          {listedLeague > 0 && (<>
            <p className={repKit.factsLabel} id="close-what-label">{W.what}</p>
            <SendRows group={{ radio: true, labelledBy: 'close-what-label' }}>
              <SendRow title={W.postpone} sub={phone ? W.postponeSubPhone : W.postponeSub}
                pick={{ checked: verb === 'postponed', onChange: on => on && setVerb('postponed'), radio: 'close-what' }} />
              <SendRow title={W.cancel} sub={phone ? W.cancelSubPhone : W.cancelSub}
                pick={{ checked: verb === 'cancelled', onChange: on => on && setVerb('cancelled'), radio: 'close-what' }} />
            </SendRows>
          </>)}

          <p className={repKit.factsLabel}>{multiDay ? W.whatsAtDays(places) : W.whatsAt(places)}</p>
          {nothing && <div className={s.empty}>{W.empty(places, firstDay)}</div>}
          {rows.length > 0 && (
            <div className={s.block}>
              <FormTable ariaLabel={W.whatsAt(places)} leadLabel={W.colGame} columns={[{ key: 'when', label: W.colWhen }]}
                rows={rows} groups={groups} closing={{ label: total, cells: { when: '' }, phone: total }} />
            </div>
          )}
          {typedCount > 0 && typedLinkable.length > 0 && places[0]?.scope !== 'all' && (
            <p className={s.linkFoot}>
              {link
                ? <>{W.linkOn(links.length, places)} <button type="button" onClick={() => setLink(false)}>{W.linkUndo}</button></>
                : <><button type="button" onClick={() => setLink(true)}>{W.linkLabel(linkCount, anyTypedTicked, places)}</button>{W.linkHelp}</>}
            </p>
          )}
          {drafts.map(name => <p key={name} className={ck.hint}>{W.draft(name)}</p>)}

          {others && othersCount > 0 && (
            <div className={s.others}>
              {phone
                ? (
                  <button type="button" className={s.othersHead} aria-expanded={othersOpen} onClick={() => setOthersOpen(o => !o)}>
                    <b>{W.notChanged}</b>
                    <span>{W.notChangedCount(others.tournaments.length, others.practices, others.tournaments.some(t => t.door))}</span>
                    <ChevronDown size={16} aria-hidden className={othersOpen ? s.othersOpen : undefined} />
                  </button>
                )
                : <div className={s.othersHead}><b>{W.notChanged}</b></div>}
              {(!phone || othersOpen) && (<>
                {others.rep > 0 && (<>
                  <div className={s.otherGroup}>{W.rep} · {W.repHiddenCount(others.rep)}</div>
                  <div className={s.otherRow}><div><strong>{W.repHiddenLine(others.rep, places)}</strong>
                    <span className={s.sub}>{others.rep === 1 ? W.repHiddenSub : W.repHiddenSubMany}</span></div></div>
                </>)}
                {others.tournaments.length > 0 && (<>
                  <div className={s.otherGroup}>{W.tournament} · {others.tournaments.some(t => t.door) ? W.tournamentSub : W.tournamentSubNoDoor}</div>
                  {others.tournaments.map(t => (
                    <div key={t.id} className={s.otherRow}>
                      <div>
                        <strong>{t.name}</strong>
                        <span className={s.sub}>{t.diamondIds.length
                          ? (places[0]?.scope === 'all' ? W.tournamentAtAll(t.atPlace, isToday) : W.tournamentAt(t.atPlace, places, isToday))
                          : W.tournamentUnlinked(isToday)}</span>
                      </div>
                      {t.door && <span className={s.otherDoor}>{W.tournamentDoor}</span>}
                    </div>
                  ))}
                </>)}
                {others.practices > 0 && <p className={`${s.practices} ${s.otherRow}`}>{W.practices(others.practices, places, isToday)}</p>}
              </>)}
            </div>
          )}

          {sum && sum.games > 0 && (
            <Statement lead={phone ? W.sumPhone(sum) : W.sumComputer(sum)} rest={sum.emails > 0 ? W.sumCap : undefined} />
          )}
          {(() => { const w = W.site(sentences, lastDay || firstDay); return <div className={s.site}>{w.lead}<b>{w.said}</b>{w.rest}</div>; })()}

          {listedLeague > 0 && (phone && !lineShown && !line
            ? (
              <p className={s.practices}>
                <button type="button" className={s.lineOpen} onClick={() => setLineShown(true)}>{W.lineOpen}</button>
                {' '}{W.lineOpenHelp}
              </p>
            )
            : (
              <label className={ck.field}>
                <span className={ck.label}>{W.lineLabel}</span>
                <span className={s.lineStack}>
                  <textarea className={ck.textarea} rows={2} value={line} maxLength={CLOSE_LINE_MAX}
                    placeholder={W.linePlaceholder} onChange={e => setLine(e.target.value)} disabled={busy} aria-describedby="close-line-hint" />
                  <span id="close-line-hint" className={ck.hint}>{W.lineHint}</span>
                  {line.length > 0 && <span className={s.counter} aria-live="polite">{W.lineCount(left)}</span>}
                </span>
              </label>
            ))}
        </>)}
      </>)}
    </KitDialog>
  );
}

