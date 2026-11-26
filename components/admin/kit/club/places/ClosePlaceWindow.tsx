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
 *
 * A GAME'S ROW (owner 2026-11-26; it replaces the one dotted line of the drawing's note 6): one fact a place — the
 * teams with the division under them, the time in its own column (the day and "Started" under it), the park in its own
 * with the diamond under it. A phone, with no columns: the teams, then time and division, then park and diamond.
 *
 * SEVERAL PLACES IN ONE PRESS (Session 2D, M1–M8, D1; the drawing CLUB_WEBSITE_STAGE2_PLACES_DRAWINGS.html): Day and
 * Until first (M4: the day decides the season's parks), then a Places field that takes ticks (`TickPicker`; empty means
 * NOTHING, never every park) and a row per chosen park with its own diamond ticks and ✕. From the schedule the season's
 * parks that day start chosen and follow the day until the admin changes the choice (M2); from the Venue library or the
 * Overview nothing is (M3). "All our fields" stands in for the parks and gives them back when removed (M5). The game
 * ticks survive a change of places, diamonds or days (`carryTicks`).
 *
 * WHAT THE SITE WILL SAY (S1–S3, owner 2026-11-26; the summary drawing's tab 6): the preview is the public strip itself
 * (`closePreview`: the closures already showing, which the frame's read carries, plus the chosen places), and "Your site
 * won't change." when a wider closure already says it. The result reads the same.
 *
 * NO PLACES YET (T1, owner 2026-11-26): an owner or an admin, and a house league admin from a season's schedule, get the
 * window with one place to tick, "All our fields"; everyone else keeps the door to the Venue library. The server decides
 * (`mayCloseEveryPlaceHere`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronDown, X } from 'lucide-react';
import KitDialog, { DialogCancel } from '../KitDialog';
import ck from '../ClubKit.module.css';
import { repKit } from '../RepKit';
import { SendRow, SendRows } from '../SendParts';
import { Statement } from '../schedules/ScheduleParts';
import FormTable, { type FormTableGroup, type FormTableRow } from '@/components/shared/FormTable';
import LoadingState from '@/components/shared/LoadingState';
import DateInput from '@/components/shared/DateInput';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { formatShortWeekdayDate, orgDayKey } from '@/lib/timezone';
import { teamsHearing } from '@/lib/league-game-changes';
import {
  CLOSE_LINE_MAX, CLOSE_MAX_ENTRIES, CLOSE_WORDS as W, canLink, carryTicks, closePreview, closeSummary, diamondTickOff,
  closeClock, isTyped, lastCloseDay, linkTargets, pickCount, pickParam, placeGroups, toggleDiamond,
  typedKind,
  type ClosePreview, type CloseFrame, type CloseSource, type PlacePick, type RepReach, type StaffClosure,
} from '@/lib/place-closure-window';
import type { ClosureVerb } from '@/lib/place-closures';
import { ClosureStripBox } from '@/components/public/ClubClosureStrip';
import frameStyles from '@/components/public/ClubFrame.module.css';
import { useOrg } from '@/lib/org-context';
import { clubFace } from '@/lib/club-site';
import { shortDivision, type RainSendDivision } from '@/lib/league-rainout';
import TickPicker, { type TickBand, type TickOption } from './TickPicker';
import s from './ClosePlace.module.css';

interface PressResult {
  closureIds: string[]; replay: boolean;
  league: { verb: ClosureVerb; games: number; teams: number; divisions: (RainSendDivision & { seasonId: string })[]; unsent: boolean };
  rep: { games: number; teams: { teamId: string; name: string; reach: RepReach; sent: boolean }[] };
}

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)));

const wholePark = (venueId: string): PlacePick => ({ venueId, diamonds: [] });

/** What the site will say after the press, for the window and its result: the strip in its public shape (S1–S3), or "Your
 *  site won't change." when a wider closure already says it. `lead` is the sentence over the strip. */
function SitePreview({ preview, lead }: { preview: ClosePreview; lead: string }) {
  // The club's own face, as its site wears it (the tryout preview's rule).
  const face = clubFace(useOrg().currentOrg?.themeFont);
  if (preview.alreadySays) return <div className={s.site}><b>{W.unchanged}</b>{W.alreadySays(preview.alreadySays)}</div>;
  if (!preview.strip) return null;
  return (
    <>
      <p className={s.siteLead}>{lead}</p>
      <div className={`${frameStyles.tokens} ${s.preview}`} data-club-face={face}>
        <ClosureStripBox groups={preview.strip.groups} smallLine={preview.strip.smallLine} />
      </div>
    </>
  );
}

/** The "maybe" games in one list, league then rep, as the table and the result both name them (rep is absent for a house
 *  league admin, K1). */
function typedGames(source: CloseSource) {
  const divName = new Map(source.seasons.flatMap(x => x.divisions.map(d => [d.id, d.name] as const)));
  return [
    ...source.league.filter(g => isTyped(g) && g.published).map(g => ({
      id: g.id, at: g.scheduledAt, name: `${g.home} vs ${g.away}`,
      tail: divName.has(g.divisionId) ? `House league · ${shortDivision(divName.get(g.divisionId)!)}` : 'House league',
      typed: g.typed, started: g.started, venueId: g.venueId, linkedToPlace: g.linkedToPlace,
    })),
    ...(source.repHidden ? [] : source.rep.filter(isTyped)).map(g => ({
      id: g.id, at: g.startsAt, name: g.opponent ? `${g.teamName} vs ${g.opponent}` : g.teamName, tail: 'Rep',
      typed: g.typed, started: g.started, venueId: g.venueId, linkedToPlace: g.linkedToPlace,
    })),
  ];
}

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
  /** The closures showing when the window opened (the frame's own read carries them): the preview reads them (S1). */
  const [showingNow, setShowingNow] = useState<StaffClosure[]>([]);
  const [seasonPlaces, setSeasonPlaces] = useState<string[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  /** The chosen parks, in the order chosen (the press's order), each whole or some of its diamonds; and "All our fields". */
  const [picks, setPicks] = useState<PlacePick[]>([]);
  const [all, setAll] = useState(false);
  /** M2: the season's parks are chosen for the admin, and follow the day, until the admin changes the choice. */
  const seasonDriven = useRef(true);
  const [firstDay, setFirstDay] = useState('');
  const [lastDay, setLastDay] = useState('');
  const [verb, setVerb] = useState<ClosureVerb>('postponed');
  const [source, setSource] = useState<CloseSource | null>(null);
  const [sourceFailed, setSourceFailed] = useState(false);
  /** The ticks the ADMIN set, and whether the game had started when they did: all the window remembers of ticks. */
  const [chosen, setChosen] = useState<ReadonlyMap<string, { ticked: boolean; started: boolean }>>(() => new Map());
  /** "Link both" is chosen FOR these parks: a changed choice of parks never re-points it at other games. */
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [othersOpen, setOthersOpen] = useState(false);
  const [lineShown, setLineShown] = useState(false);
  const [line, setLine] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PressResult | null>(null);
  const [typedSeen, setTypedSeen] = useState(false);
  /** The window's read again after a refusal (`press`); and a season's places for new days still on their way. */
  const [reread, setReread] = useState(0);
  const [seasonPending, setSeasonPending] = useState(false);
  /** The days the season's places were last read for. */
  const seasonDays = useRef<{ first: string; last: string } | null>(null);

  // The frame first: the club's places, its day, and (from a season's schedule) that season's places today.
  useEffect(() => {
    let live = true;
    void (async () => {
      // From a season's schedule the frame names the season (T1: the server decides whether "All our fields" is offered).
      const first = await fetch(`${api}?${q}${seasonId ? `&from=${seasonId}` : ''}`, { cache: 'no-store' }).catch(() => null);
      const data = first?.ok ? await first.json().catch(() => null) : null;
      const f = (data as { frame?: CloseFrame } | null)?.frame;
      if (!live) return;
      if (!f) { setLoadFailed(true); return; }
      setShowingNow((data as { closures?: StaffClosure[] }).closures ?? []);
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
      // M2: from the schedule, the season's parks that day; M3: from the Venue library or the Overview, nothing — unless
      // the door named a place.
      const start = initialVenueId && f.venues.some(v => v.id === initialVenueId) ? initialVenueId : null;
      setPicks(sp.length ? sp.map(wholePark) : start ? [wholePark(start)] : []);
    })();
    return () => { live = false; };
  }, [q, seasonId, initialVenueId]);

  // K15: the season's places follow the window's days (a closure set for Saturday closes Saturday's places, not today's).
  // The CHOICE follows them only while the admin hasn't changed it (M2) — and then always, even to none: a day the season
  // uses no place reads "Choose places", never the last day's parks under the new day (nothing is read while they are on
  // their way). A failed read changes nothing.
  useEffect(() => {
    if (!seasonId || !firstDay || !seasonDays.current) return;
    const last = lastDay || firstDay;
    // Back on the days already read (a change undone before its answer came): nothing is on its way.
    if (seasonDays.current.first === firstDay && seasonDays.current.last === last) { setSeasonPending(false); return; }
    let live = true;
    setSeasonPending(seasonDriven.current);
    void fetch(`${api}?${q}&seasonId=${seasonId}&day=${firstDay}&dayLast=${last}`, { cache: 'no-store' }).catch(() => null)
      .then(r => (r?.ok ? r.json().catch(() => null) : null))
      .then(d => {
        if (!live) return;
        seasonDays.current = { first: firstDay, last };
        const sp = (d as { seasonPlaces?: string[] } | null)?.seasonPlaces;
        if (sp) {
          setSeasonPlaces(sp);
          if (seasonDriven.current) setPicks(sp.map(wholePark));
        }
        setSeasonPending(false);
      });
    return () => { live = false; };
  }, [seasonId, firstDay, lastDay, q]);

  const count = pickCount(picks);
  const placesParam = pickParam(picks, all);
  const parksKey = all ? 'all' : picks.map(p => p.venueId).sort().join(',');
  const link = linkFor !== null && linkFor === parksKey;

  // T1: "All our fields" from a season's schedule names the season (a house league admin may close every place only so).
  const fromSeason = all && seasonId ? `&from=${seasonId}` : '';
  const read = useCallback(async (): Promise<CloseSource | null> => {
    if (!placesParam || !firstDay) return null;
    const r = await fetch(`${api}?${q}&places=${placesParam}&first=${firstDay}&last=${lastDay || firstDay}${fromSeason}`, { cache: 'no-store' }).catch(() => null);
    const d = r?.ok ? await r.json().catch(() => null) : null;
    return (d as { source?: CloseSource } | null)?.source ?? null;
  }, [placesParam, firstDay, lastDay, q, fromSeason]);

  // The window's read, again whenever the places, the diamonds or the days change, or after a refusal — one path, so a
  // late answer to an earlier choice is always dropped. Nothing chosen reads nothing: no games, no button.
  useEffect(() => {
    if (!placesParam || !firstDay || seasonPending) { setSource(null); setSourceFailed(false); return; }
    let live = true;
    setSource(null); setSourceFailed(false);
    void read().then(src => {
      if (!live) return;
      if (!src) { setSourceFailed(true); return; }
      setSource(src);
      // On a phone, only the groups that need a choice stay open: the typed group, and any holding a started game.
      setOpen(new Set(['typed', ...src.league.filter(g => g.started && g.match === 'linked').map(g => `s:${g.seasonId}`),
        ...(src.rep.some(g => g.started && g.match === 'linked') ? ['rep'] : [])]));
    });
    return () => { live = false; };
  }, [read, placesParam, firstDay, seasonPending, reread]);

  // What is ticked is worked out, never stored: the admin's own choices over how each listed game stands NOW.
  const ticked = useMemo(() => (source ? carryTicks(source, chosen) : new Set<string>()), [source, chosen]);
  const tick = useCallback((ids: readonly string[], on: boolean) => {
    const started = new Set([...(source?.league ?? []), ...(source?.rep ?? [])].filter(g => g.started).map(g => g.id));
    setChosen(prev => {
      const next = new Map(prev);
      for (const id of ids) next.set(id, { ticked: on, started: started.has(id) });
      return next;
    });
  }, [source]);
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
  // What the site will say after the press (S1–S3): the closures showing plus the chosen places, as families will read it.
  const diamondParks = useMemo(() => new Set((frame?.venues ?? []).filter(v => v.allDiamonds).map(v => v.id)), [frame]);
  const preview = useMemo(() => (source
    ? closePreview(source.places, firstDay, lastDay || firstDay, showingNow, new Date().toISOString(), diamondParks)
    : null), [source, firstDay, lastDay, showingNow, diamondParks]);

  // ── The table: house league (one group per season), rep, typed by hand ─────────────────────────────────────────
  const { rows, groups, drafts, typedCount } = useMemo(() => {
    const rows: FormTableRow[] = [];
    const groups: FormTableGroup[] = [];
    if (!source) return { rows, groups, drafts: [] as string[], typedCount: 0 };
    const divName = new Map(source.seasons.flatMap(x => x.divisions.map(d => [d.id, d.name] as const)));
    // Note 6: with two or more parks chosen, or every place, each row names its park; with one, the diamond alone (and
    // the park where a game there has no diamond). A game with no library park (every place closed) shows its typed words.
    const namePark = source.places[0]?.scope === 'all' || placeGroups(source.places).length > 1;
    const venueName = new Map((frame?.venues ?? []).map(v => [v.id, v.name]));
    /** One game, drawn for both widths: the desk's Time and Place cells and the line under the teams; the phone's lines
     *  under them. `typed` is a hand-typed place's own words; `note` a rep game's "who is emailed". */
    const gameRow = (g: { at: string; started: boolean; venueId: string | null; field: string | null; division: string | null; typed?: string | null; note?: string | null }) => {
      const venue = g.venueId ? venueName.get(g.venueId) : undefined;
      const park = namePark || !g.field ? venue : undefined;
      const main = park ?? g.field;
      const under = park ? g.field : null;
      const day = multiDay ? formatShortWeekdayDate(orgDayKey(g.at)) : null;
      const typed = g.typed ? W.typedLine(g.typed) : null;
      return {
        underName: g.division || g.note ? <>{g.division}{g.note && <span className={s.sub}>{g.note}</span>}</> : null,
        cells: {
          time: (
            <>
              <span className={s.time}>{closeClock(g.at)}</span>
              {day && <span className={s.sub}>{day}</span>}
              {g.started && <span className={s.sub}><b>{W.started}</b></span>}
            </>
          ),
          place: <>{main}{under && <span className={s.sub}>{under}</span>}{typed && <span className={s.sub}>{typed}</span>}</>,
        },
        phoneLine: (
          <>
            <span className={s.line}>{[day, closeClock(g.at), g.division].filter(Boolean).join(' · ')}</span>
            {main && <span className={s.line}>{park ? <><span className={s.park}>{park}</span>{under ? `, ${under}` : ''}</> : main}</span>}
            {typed && <span className={s.line}>{typed}</span>}
            {g.started && <span className={s.line}><b>{W.started}</b></span>}
            {g.note && <span className={s.line}>{g.note}</span>}
          </>
        ),
      };
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
        rows.push({
          key: g.id, group: key, name, ticked: ticked.has(g.id), onTick: on => tick([g.id], on), tickLabel: name,
          ...gameRow({ at: g.scheduledAt, started: g.started, venueId: g.venueId, field: g.field, division: divName.has(g.divisionId) ? shortDivision(divName.get(g.divisionId)!) : null, typed: g.linkedToPlace ? null : g.typed }),
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
          rows.push({
            key: g.id, group: 'rep', name, ticked: ticked.has(g.id), onTick: on => tick([g.id], on), tickLabel: name,
            ...gameRow({ at: g.startsAt, started: g.started, venueId: g.venueId, field: g.field, division: null, typed: g.linkedToPlace ? null : g.typed, note: g.started ? null : W.repNote(source.repReach[g.teamId] ?? 'none') }),
          });
        }
        group('rep', W.rep, phone ? W.repCountPhone(games.length, games.every(g => source.repReach[g.teamId] === 'head') ? 'head' : games.every(g => source.repReach[g.teamId] === 'none') ? 'none' : 'others') : W.repCount(games.length), games.map(g => g.id), true);
      }
    }
    // Typed by hand (K7): found by the place's name in the typed words, unticked.
    const typed = typedGames(source).sort((a, b) => a.at.localeCompare(b.at));
    for (const g of typed) {
      // "Typed" only for a place typed by hand: a game picked from the library with no diamond was never typed.
      rows.push({
        key: g.id, group: 'typed', name: g.name, ticked: ticked.has(g.id), onTick: on => tick([g.id], on), tickLabel: g.name,
        ...gameRow({ at: g.at, started: g.started, venueId: g.venueId, field: null, division: g.tail, typed: g.linkedToPlace ? null : g.typed }),
      });
    }
    // Its name says what it holds: a place typed by hand, a game at the park with no diamond recorded (a diamond closure's
    // "maybe"), or both.
    if (typed.length) group('typed', W.typed(typedKind(typed)), W.typedCount(source.places, typed.length), typed.map(g => g.id), true);
    const drafts = source.seasons.flatMap(x => x.divisions.filter(d => !d.published && source.league.some(g => g.divisionId === d.id)).map(d => d.name));
    return { rows, groups, drafts, typedCount: typed.length };
  }, [source, ticked, tick, open, toggleOpen, multiDay, phone, frame]);

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
      links: link ? links : [],
      // T1: every place from a season's schedule names the season (the server's rule for a house league admin).
      ...(all && seasonId ? { seasonId } : {}),
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
      // Refused because something moved on: read again (the admin's ticks kept, `carryTicks`).
      if (res?.status === 409) setReread(n => n + 1);
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
    // The typed games left unticked: still "on" and maybe at the closed place (amber, so the strip and they never disagree
    // silently).
    const typedLeftGames = typedGames(source).filter(g => !ticked.has(g.id));
    const seasonId = result.league.divisions[0]?.seasonId ?? source.seasons[0]?.id ?? null;
    const seasonHref = seasonId ? `/${orgSlug}/admin/house-league/seasons/${seasonId}/schedule` : null;
    const tournaments = source.tournaments;
    const rainDelayHref = (t: CloseSource['tournaments'][number]) => {
      const qs = new URLSearchParams({ tournamentId: t.id, tool: 'rain-delay', day: firstDay });
      if (t.diamondIds.length) {
        const said = W.rainDelayPlaces(places);
        qs.set('diamonds', t.diamondIds.join(',')); qs.set('closed', said.words);
        if (said.several) qs.set('several', '1');
      }
      return `/${orgSlug}/admin/tournaments/schedule?${qs.toString()}`;
    };
    return (
      <KitDialog kind="form" size="medium" eyebrow={formatShortWeekdayDate(firstDay)} title={W.doneTitle(places)} onClose={onClose}
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
              <span><b>{W.doneTyped(typedLeftGames.length, typedKind(typedLeftGames))}</b>{W.doneTypedRest(places)}</span>
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
        {preview?.alreadySays
          ? <p className={s.para}>{W.doneUnchanged(preview.alreadySays, places.length)}</p>
          : preview && (<>
            <SitePreview preview={preview} lead={W.doneShows(preview.sameEnd, lastDay || firstDay)} />
            <p className={s.para}>{W.doneReopen(places.length)}</p>
          </>)}
        {result.league.games > 0 && <p className={s.para}>{W.doneNoUndo(result.league.verb)}</p>}
      </KitDialog>
    );
  }

  // ── The window (tab 2) ──────────────────────────────────────────────────────────────────────────────────────────────
  const noPlaces = !!frame && frame.venues.length === 0;
  // T1: with no places, "All our fields" where the server offers it (an owner or an admin; a house league admin from the
  // schedule).
  const allOnly = noPlaces && frame!.canAll;
  const listedLeague = source ? source.league.filter(g => g.published).length : 0;
  const nothing = !!source && listedLeague === 0 && source.rep.length === 0;
  const repHiddenGames = source?.repHidden ? source.rep : [];
  const others = source ? { tournaments: source.tournaments, practices: source.practices, rep: repHiddenGames.length } : null;
  const othersCount = others ? others.tournaments.length + others.practices + others.rep : 0;
  const emails = sum?.families ?? 0;
  const total = sum ? W.closing(sum.games, sum.teams) : '';
  const left = CLOSE_LINE_MAX - line.length;

  // The calendar refuses days outside its limits, but a typed date (or some phones' own picker) can still hand one over:
  // the field keeps the day it had.
  // Until moves with the Day while the two match (a one-day closure stays one day, owner 2026-11-26); a longer range the
  // admin picked keeps its last day while the new Day still allows it.
  function chooseDay(d: string) {
    if (!frame || d < frame.today || d > lastCloseDay(frame.today)) return;
    setFirstDay(d);
    if (!lastDay || lastDay === firstDay || lastDay < d || lastCloseDay(d) < lastDay) setLastDay(d);
  }
  function chooseLastDay(d: string) {
    if (d < firstDay || d > lastCloseDay(firstDay)) return;
    setLastDay(d);
  }

  // ── The Places field (M1–M7) and the chosen rows ──────────────────────────────────────────────────────────────────
  const chosenIds = new Set(picks.map(p => p.venueId));
  const atLimit = count >= CLOSE_MAX_ENTRIES;
  const placeOption = (v: { id: string; name: string }): TickOption => ({
    id: v.id, label: v.name, checked: all || chosenIds.has(v.id), disabled: all || (atLimit && !chosenIds.has(v.id)),
  });
  const byName = [...(frame?.venues ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const seasonSet = new Set(seasonPlaces);
  // M2 / note 3: with the season, its parks that day first (the club's order, the press's), then every other park.
  const placeBands: TickBand[] = season && seasonPlaces.length
    ? [
      { key: 'season', label: W.bandSeason(isToday), options: (frame?.venues ?? []).filter(v => seasonSet.has(v.id)).map(placeOption) },
      { key: 'other', label: W.bandOther, options: byName.filter(v => !seasonSet.has(v.id)).map(placeOption) },
    ]
    : [{ key: 'all', options: byName.map(placeOption) }];
  function choosePlace(id: string, on: boolean) {
    // "All our fields" stands in for the parks and gives them back (M5): it changes nothing about the parks themselves.
    if (id === '__all') { setAll(on); return; }
    seasonDriven.current = false;
    setPicks(prev => (on ? (prev.some(p => p.venueId === id) ? prev : [...prev, wholePark(id)]) : prev.filter(p => p.venueId !== id)));
  }
  function chooseDiamond(venueId: string, id: string, on: boolean, order: readonly string[]) {
    const pick = picks.find(p => p.venueId === venueId);
    const next = pick ? toggleDiamond(pick, id, on, order) : null;
    if (!next || next === pick || next.diamonds.join() === pick!.diamonds.join()) return;
    seasonDriven.current = false;
    setPicks(prev => prev.map(p => (p.venueId === venueId ? next : p)));
  }
  /** The door to the Venue library (the library page opens its Add window instead of navigating). */
  const venueDoor = (className?: string) => (onOpenVenueLibrary
    ? <button type="button" className={className} onClick={() => { onOpenVenueLibrary(); onClose(); }}>{W.noPlacesDoor}</button>
    : <Link className={className} href={venueLibraryHref}>{W.noPlacesDoor}</Link>);
  const placesField = frame && (allOnly ? (
    // T1: the one place there is to close, unticked, and why there is nothing else.
    <div className={ck.field}>
      <span className={ck.label}>{W.places}</span>
      <SendRows>
        <SendRow title={W.everyPlace} pick={{ checked: all, onChange: on => { if (!busy) setAll(on); } }} />
      </SendRows>
      <p className={s.noPlacesHint}>{W.noPlacesAll} {venueDoor()}</p>
    </div>
  ) : (
    <div className={ck.field}>
      <span className={ck.label}>{W.places}</span>
      <TickPicker title={W.places} face={W.chosen(picks.length, all)} bands={placeBands} phone={phone} disabled={busy}
        pinned={frame.canAll ? [{ id: '__all', label: W.everyPlace, checked: all }] : undefined}
        foot={atLimit && !all ? W.limit(frame.canAll) : undefined}
        search={frame.venues.length > 8 ? W.find : undefined}
        onToggle={choosePlace} doneLabel={W.done} />
    </div>
  ));
  const pickRows = !allOnly && (all || picks.length > 0) && frame && (
    <div className={s.picks}>
      {all
        ? (
          <div className={s.pick}>
            <span className={s.pickName}>{W.everyPlace}</span>
            <button type="button" className={s.pickRemove} aria-label={W.remove(W.everyPlace)} disabled={busy}
              onClick={() => choosePlace('__all', false)}><X size={16} aria-hidden /></button>
          </div>
        )
        : picks.map(p => {
          const v = frame.venues.find(x => x.id === p.venueId);
          if (!v) return null;
          const order = v.facilities.map(f => f.id);
          const value = W.diamondsValue(v.facilities.filter(f => p.diamonds.includes(f.id)).map(f => f.name), v.facilities.length);
          return (
            <div key={p.venueId} className={s.pick}>
              <span className={s.pickName}>{v.name}</span>
              {v.facilities.length > 1 && (
                <TickPicker compact title={v.name} face={value} faceLabel={W.diamondsLabel(v.name, value)} phone={phone} disabled={busy}
                  bands={[{ key: 'd', options: [
                    { id: '', label: W.allDiamonds, checked: p.diamonds.length === 0 },
                    ...v.facilities.map(f => ({ id: f.id, label: f.name, checked: p.diamonds.includes(f.id), disabled: diamondTickOff(p, f.id, order, count) })),
                  ] }]}
                  onToggle={(id, on) => chooseDiamond(p.venueId, id, on, order)} doneLabel={W.done} />
              )}
              <button type="button" className={s.pickRemove} aria-label={W.remove(v.name)} disabled={busy}
                onClick={() => choosePlace(p.venueId, false)}><X size={16} aria-hidden /></button>
            </div>
          );
        })}
    </div>
  );

  if (noPlaces && !allOnly) {
    return (
      <KitDialog kind="form" size="medium" title={W.title} onClose={onClose}
        footer={(
          <>
            <DialogCancel>{W.notNow}</DialogCancel>
            {venueDoor('btn btn-lime')}
          </>
        )}>
        <div className={s.empty}><b>{W.noPlacesTitle}</b>{W.noPlacesBody}</div>
      </KitDialog>
    );
  }

  return (
    <KitDialog kind="form" size="medium" steady eyebrow={eyebrow} title={W.title} onClose={onClose} busy={busy}
      dirty={!busy && (line.length > 0 || verb !== 'postponed' || link)}
      footerStart={source ? <span>{busy ? W.sending : phone ? W.footPhone : W.foot}</span> : undefined}
      footer={(
        <>
          <DialogCancel>{W.notNow}</DialogCancel>
          {/* Nothing chosen: the button stands, off, in the window's own name (the drawing's tab 3). */}
          <button type="button" className="btn btn-lime" disabled={busy || !source || !sum} onClick={() => void press()}>
            {busy ? W.sending : source && sum ? W.go(places, emails, phone) : W.title}
          </button>
        </>
      )}>
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      {loadFailed && <p className={ck.hint} role="alert">{W.loadFailed}</p>}
      {!frame && !loadFailed && <LoadingState inline label={W.title} />}
      {frame && (<>
        {/* M4: Day and Until first — the day decides which parks the season is using. */}
        <div className={s.days}>
          <label className={ck.field}>
            <span className={ck.label}>{W.day}</span>
            <DateInput className={ck.input} value={firstDay} min={frame.today} max={lastCloseDay(frame.today)}
              required onChange={chooseDay} disabled={busy} />
          </label>
          <label className={ck.field}>
            <span className={ck.label}>{W.until}</span>
            <DateInput className={ck.input} value={lastDay || firstDay} min={firstDay} max={lastCloseDay(firstDay)}
              rangeStart={firstDay} required onChange={chooseLastDay} disabled={busy} />
          </label>
        </div>
        {placesField}
        {pickRows}

        {!placesParam && <div className={s.empty}>{W.chooseFirst}</div>}
        {placesParam && sourceFailed && <p className={ck.hint} role="alert">{W.loadFailed}</p>}
        {placesParam && !source && !sourceFailed && <LoadingState inline label={W.title} />}
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
          {nothing && <div className={s.empty}>{W.empty(places, firstDay, !preview?.alreadySays)}</div>}
          {rows.length > 0 && (
            <div className={s.block}>
              <FormTable stacked ariaLabel={W.whatsAt(places)} leadLabel={W.colGame}
                columns={[{ key: 'time', label: W.colTime, width: 112 }, { key: 'place', label: W.colPlace, width: '34%' }]}
                rows={rows} groups={groups} closing={{ label: total, cells: {}, phone: total }} />
            </div>
          )}
          {typedCount > 0 && typedLinkable.length > 0 && places[0]?.scope !== 'all' && (
            <p className={s.linkFoot}>
              {link
                ? <>{W.linkOn(links.length, places)} <button type="button" onClick={() => setLinkFor(null)}>{W.linkUndo}</button></>
                : <><button type="button" onClick={() => setLinkFor(parksKey)}>{W.linkLabel(linkCount, anyTypedTicked, places)}</button>{W.linkHelp}</>}
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
          {preview && <SitePreview preview={preview} lead={W.siteShows(preview.sameEnd, lastDay || firstDay)} />}

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

