'use client';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import KitDialog from './KitDialog';
import ck from './ClubKit.module.css';
import css from './CreateLeagueSeasonDialog.module.css';
import ls from './league/LeagueSeason.module.css';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import DateInput from '@/components/shared/DateInput';
import LoadingState from '@/components/shared/LoadingState';
import SublinedChoice, { type SublinedOption } from '@/components/coaches/SublinedChoice';
import SheetFrame from '@/components/coaches/SheetFrame';
import { repKit } from './RepKit';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { isFreeFloorLeague, type LeagueCapKind, type SeasonSlotHolder } from '@/lib/free-floor';
import { OFFERED_SPORT_OPTIONS, DEFAULT_SPORT } from '@/lib/sports';
import { newestFirstSeasons, seasonState } from '@/lib/house-league-season';
import { formatLeagueMoney } from '@/lib/league-money';
import {
  DEFAULT_BRING, START_FROM_WORDS as SF, bornShiftYears, dateShiftDays, datesMoved, honouredBring, isLiveSource, movedDates,
  optionLine, shiftStamp, startName, type Bring, type StartSource,
} from '@/lib/house-league-start-from';
import type { LeagueSeasonSummary } from '@/lib/types';

/**
 * Create a house-league season (Club Tier Stage 9b-1, Part 2; S1·a; drawing §1, words HOUSE_LEAGUE_STAGE9B1_COPY.md §1).
 * Three answers — name, sport, dates — and an explicit Create (create asks). Everything else (age groups and prices, when
 * the form opens and closes, the waiver, how families pay, how new registrations are taken) is set on the season's own
 * page. Its web address is made from the name on the server (a name another season already uses is refused there).
 *
 * START FROM (House League 9f-2; 9f·8–9f·13; drawings s13/s14, words HOUSE_LEAGUE_STAGE9F_COPY.md Part B): the first field,
 * for a club with a season to start from (never the free League plan, §15.16). It opens on the most recent season, or on
 * `startFromId` (a season's rare door). Picking one says first that the source is left exactly as it was, moves the name
 * and the dates, and lists what comes across; "A blank season" is exactly the window above. The decisions are
 * lib/house-league-start-from.ts; the copy itself is the create route's.
 */
type Form = { name: string; sport: string; seasonStartDate: string; seasonEndDate: string };
const BLANK: Form = { name: '', sport: DEFAULT_SPORT, seasonStartDate: '', seasonEndDate: '' };
const BLANK_PICK = 'blank';

/** A picked source's age groups and money, from the season's own read (the Overview's figures, never recomputed). */
type SourceDetail = {
  id: string;
  divisions: { id: string; name: string; bornFromYear: number | null; bornToYear: number | null; teamCount: number; coachCount?: number }[];
  owing: { amount: number; players: number } | null;
};

const asSource = (s: LeagueSeasonSummary['season']): StartSource => ({
  id: s.id, name: s.name, status: s.status, seasonStartDate: s.seasonStartDate ?? null, seasonEndDate: s.seasonEndDate ?? null,
  registrationOpenAt: s.registrationOpenAt ?? null, registrationCloseAt: s.registrationCloseAt ?? null,
  earlyBirdUntil: s.earlyBirdUntil ?? null,
});

/** The club's seasons, newest first, each carrying its season's own fields beside the summary (what the picker reads). */
const sortSeasons = (raw: LeagueSeasonSummary[]) =>
  newestFirstSeasons<LeagueSeasonSummary & LeagueSeasonSummary['season']>(raw.map(s => ({ ...s.season, ...s })));

/** The name, sport and moved dates a picked season puts in the window (9f·13). */
const formFromSeason = (summary: LeagueSeasonSummary): Form => {
  const src = asSource(summary.season);
  const dates = movedDates(src, dateShiftDays(src));
  return {
    name: startName(src), sport: summary.season.sport || DEFAULT_SPORT,
    seasonStartDate: dates.seasonStartDate ?? '', seasonEndDate: dates.seasonEndDate ?? '',
  };
};

export default function CreateLeagueSeasonDialog({ orgSlug, startFromId, knownSeasons, onClose, onCreated, onCapHit }: {
  orgSlug: string;
  /** Open with Start from on this season (the Overview's "Start next season from this one…"). */
  startFromId?: string;
  /**
   * The club's seasons, when the page that opens this window already holds them. The window then opens at its final size on
   * the first frame; without them it waits for its own read, so it never shows the small blank window and then grows.
   */
  knownSeasons?: LeagueSeasonSummary[];
  onClose: () => void;
  onCreated: (season: { id: string; name: string }) => void;
  /** The free League plan refused it; the season holding the slot comes with the refusal so the window can name it (9f·5). */
  onCapHit: (kind: LeagueCapKind, holder?: SeasonSlotHolder) => void;
}) {
  const { currentOrg } = useOrg();
  const phone = useIsPhone();
  const offered = !!currentOrg && !isFreeFloorLeague(currentOrg);
  const fieldId = useId();

  // Seeded from the page's own list: the first frame is already the Start from window (no small window that then grows).
  const [initial] = useState(() => {
    if (!offered || !knownSeasons) return null;
    const list = sortSeasons(knownSeasons);
    const first = (startFromId && list.some(s => s.season.id === startFromId)) ? startFromId : list[0]?.season.id ?? null;
    const summary = first ? list.find(s => s.season.id === first) ?? null : null;
    return { list, first, form: summary ? formFromSeason(summary) : BLANK };
  });
  // Until the club's seasons are known the window shows its loading line, not the blank form that then becomes the larger Start from one.
  const [listed, setListed] = useState(!offered || !!initial);
  const [form, setForm] = useState<Form>(initial?.form ?? BLANK);
  const [baseline, setBaseline] = useState<Form>(initial?.form ?? BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<LeagueSeasonSummary[]>(initial?.list ?? []);
  const [pick, setPick] = useState<string>(initial?.first ?? BLANK_PICK);
  const [detail, setDetail] = useState<SourceDetail | null>(null);
  const [bring, setBring] = useState<Bring>(DEFAULT_BRING);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [endTouched, setEndTouched] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const pickRef = useRef(initial?.first ?? BLANK_PICK);
  // What the person has typed, for the list's late arrival: it never overwrites a window already filled in.
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const picked = pick === BLANK_PICK ? null : seasons.find(s => s.season.id === pick) ?? null;
  const source = picked ? asSource(picked.season) : null;
  const live = source ? isLiveSource(source) : false;
  const ready = !!form.name.trim() && (!source || detail?.id === source.id);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  // Pick a season (or the blank one): the name, the sport and the two dates the window shows arrive moved (9f·13), the ticks
  // go back to their defaults, and the source's age groups load for their counts, chips and owing figure.
  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/house-league/seasons/${id}?orgSlug=${encodeURIComponent(orgSlug)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'load failed');
      if (pickRef.current !== id) return;
      const divisions: SourceDetail['divisions'] = Array.isArray(data.divisions) ? data.divisions : [];
      const money = data.money as { owing?: number; owingPlayers?: number } | undefined;
      setDetail({
        id, divisions,
        owing: money && (money.owing ?? 0) > 0 && (money.owingPlayers ?? 0) > 0 ? { amount: money.owing!, players: money.owingPlayers! } : null,
      });
      setChosen(new Set(divisions.map(d => d.id)));
    } catch {
      if (pickRef.current === id) setError('We couldn’t load the season.');
    }
  }, [orgSlug]);

  const choose = useCallback((id: string, list: LeagueSeasonSummary[]) => {
    pickRef.current = id;
    setPick(id);
    setDetail(null);
    setBring(DEFAULT_BRING);
    setEndTouched(false);
    setError(null);
    const summary = id === BLANK_PICK ? null : list.find(s => s.season.id === id) ?? null;
    if (!summary) { setForm(BLANK); setBaseline(BLANK); return; }
    const next = formFromSeason(summary);
    setForm(next);
    setBaseline(next);
    void loadDetail(id);
  }, [loadDetail]);

  // The club's seasons, newest first. Opens on the preset or the most recent, unless the person has already typed.
  useEffect(() => {
    if (!offered) return;
    // The page already handed the list over: the window is drawn from it, only the picked season's detail is still to read.
    if (initial) {
      const first = initial.first;
      if (first) void (async () => { await loadDetail(first); })();
      return;
    }
    let gone = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/house-league/seasons?orgSlug=${encodeURIComponent(orgSlug)}`);
        const data = await res.json().catch(() => ({}));
        if (gone) return;
        if (!res.ok) {
          // From a season's own door, a window that quietly became a blank one would be a different promise: say so.
          if (startFromId) setError('We couldn’t load the season.');
          return;
        }
        const list = sortSeasons(Array.isArray(data.seasons) ? data.seasons as LeagueSeasonSummary[] : []);
        setSeasons(list);
        const first = (startFromId && list.some(s => s.season.id === startFromId)) ? startFromId : list[0]?.season.id;
        if (first && JSON.stringify(formRef.current) === JSON.stringify(BLANK)) choose(first, list);
      } catch {
        // No list, no field: the window is today's (but see above: a season's own door says it could not load).
        if (startFromId && !gone) setError('We couldn’t load the season.');
      } finally {
        if (!gone) setListed(true);
      }
    })();
    return () => { gone = true; };
  }, [offered, orgSlug, startFromId, choose, initial, loadDetail]);

  // The first day moves the other dates by the same gap (s15); the last day follows until the person sets it.
  const setStart = (v: string) => {
    setForm(f => {
      const next = { ...f, seasonStartDate: v };
      if (source && !live && !endTouched) {
        const end = shiftStamp(source.seasonEndDate, dateShiftDays(source, v || null) ?? 0);
        if (end) next.seasonEndDate = end;
      }
      return next;
    });
  };

  // What the ticks would bring, counted from the age groups that come (all; or the chips on a live source).
  const comes = detail ? detail.divisions.filter(d => !live || chosen.has(d.id)) : [];
  const counts = {
    ageGroups: detail ? comes.length : picked?.divisionCount ?? null,
    teams: detail ? comes.reduce((n, d) => n + d.teamCount, 0) : picked?.teamCount ?? null,
    coaches: detail ? comes.reduce((n, d) => n + (d.coachCount ?? 0), 0) : null,
  };
  const shift = source ? dateShiftDays(source, form.seasonStartDate || null) : null;
  const bornBy = source ? bornShiftYears(source, { seasonStartDate: form.seasonStartDate || null, seasonEndDate: form.seasonEndDate || null }) : 0;
  const example = detail?.divisions.find(d => d.bornFromYear != null && d.bornToYear != null);
  const honoured = honouredBring(bring);
  const tick = (k: keyof Bring) => (v: boolean) => setBring(b => ({ ...b, [k]: v }));

  async function create() {
    if (!ready) return;
    // A date range runs forward; the picker's minimum is only a hint, so a typed date is checked here.
    if (form.seasonStartDate && form.seasonEndDate && form.seasonEndDate < form.seasonStartDate) {
      setError('The last day can’t be before the first day.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/house-league/seasons?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          sport: form.sport || DEFAULT_SPORT,
          seasonStartDate: form.seasonStartDate || null,
          seasonEndDate: form.seasonEndDate || null,
          ...(source ? { startFrom: { seasonId: source.id, bring: honoured, divisionIds: live ? [...chosen] : null } } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBusy(false);
        if (data.capHit) { onCapHit(data.capHit, data.holder); return; }
        setError(data.error ?? 'We couldn’t create the season. Try again.');
        return;
      }
      // ⚠ STAY BUSY once it is made: the caller opens the new season's page with this window still open (KitDialog's header),
      // and until the page leaves, a live Create button would send a second request and a live Cancel would cancel the move.
      onCreated({ id: data.id, name: data.name });
    } catch {
      setBusy(false);
      setError('We couldn’t create the season. Try again.');
    }
  }

  // ── Start from: our own picker at the desk (each choice has a second line), a drawer titled Start from on a phone ──
  const pillOf = (s: LeagueSeasonSummary) => seasonState(s.season).label;
  const options: SublinedOption<string>[] = [
    { value: BLANK_PICK, name: SF.blank, sub: SF.blankSub, closedSub: '' },
    ...seasons.map(s => ({ value: s.season.id, name: s.season.name, sub: optionLine(pillOf(s), s.divisionCount, s.teamCount), closedSub: pillOf(s) })),
  ];
  const current = options.find(o => o.value === pick) ?? options[0];
  const startFromField = seasons.length > 0 && (
    <div className={ck.field}>
      <label className={ck.label} htmlFor={fieldId}>{SF.label}</label>
      {phone ? (
        <>
          <button
            ref={opener} id={fieldId} type="button" className={`${ck.select} ${css.phoneField}`}
            aria-haspopup="dialog" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)} disabled={busy}
          >
            <span>{current.name}{current.closedSub ? <span className={css.phoneFieldSub}> · {current.closedSub}</span> : null}</span>
            <ChevronDown size={15} aria-hidden />
          </button>
          {sheetOpen && (
            <SheetFrame label={SF.label} onClose={() => setSheetOpen(false)} opener={opener} overWindow full role="dialog" aria-label={SF.label}>
              <ul className={css.sheetList} role="listbox" aria-label={SF.label}>
                {options.map(o => (
                  <li key={o.value}>
                    <button
                      type="button" role="option" aria-selected={o.value === pick} className={css.sheetOption}
                      onClick={() => { setSheetOpen(false); if (o.value !== pick) choose(o.value, seasons); }}
                    >
                      <strong>{o.name}</strong>
                      <small>{o.sub}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </SheetFrame>
          )}
        </>
      ) : (
        <SublinedChoice
          id={fieldId} label={SF.label} options={options} value={pick} variant="toolbar" showClosedSub
          triggerClassName={`${ck.select} ${shared.convChoiceToolbarField}`} disabled={busy}
          onChange={v => { if (v !== pick) choose(v, seasons); }}
        />
      )}
    </div>
  );

  // The dates' line: a finished source's moved dates, a live source's empty ones, or today's hint for a blank season.
  const datesHint = !source
    ? 'Next, on the season’s page: age groups and prices, when the form opens and closes, the waiver and how families pay. Its web address is made from the name.'
    : live ? SF.datesLive(source.name)
    : shift != null && datesMoved(source, shift) ? SF.dates(source.name, shift, phone)
    : null;

  // The window answers the click at once, as every window here does: its title and Cancel, and the product's loading line.
  if (!listed) {
    return (
      <KitDialog
        kind="form"
        size="medium"
        title="Create a house-league season"
        onClose={onClose}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-lime" disabled>Create season</button>
          </>
        }
      >
        <LoadingState inline label="Loading your seasons…" />
      </KitDialog>
    );
  }

  return (
    <KitDialog
      kind="form"
      size="medium"
      title="Create a house-league season"
      onClose={onClose}
      busy={busy}
      dirty={dirty}
      footerStart={source ? <span className={repKit.footNote}>{SF.foot}</span> : undefined}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={create} disabled={!ready || busy}>
            {busy ? 'Creating…' : 'Create season'}
          </button>
        </>
      }
    >
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      {startFromField}
      {source && (
        <div className={css.statement}>
          <p>{SF.left(source.name)}</p>
          {/* Only for a FINISHED source, and only when someone owes (Q10): a warning, never a block. */}
          {!live && detail?.owing && <p>{SF.owes(detail.owing.players, formatLeagueMoney(detail.owing.amount))}</p>}
        </div>
      )}
      <div className={css.pair}>
        <label className={ck.field}>
          <span className={ck.label}>Name<span className={repKit.req} aria-hidden>*</span></span>
          <input className={ck.input} value={form.name} maxLength={120} placeholder={source && !form.name ? source.name : 'Summer 2027'} onChange={e => set('name', e.target.value)} />
        </label>
        <label className={ck.field}>
          <span className={ck.label}>Sport</span>
          <select className={ck.select} value={form.sport} onChange={e => set('sport', e.target.value)}>
            {OFFERED_SPORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <div className={ck.field}>
        <span className={ck.label} id="create-season-dates">Season dates</span>
        <div className={repKit.fieldGrid} role="group" aria-labelledby="create-season-dates">
          <DateInput className={ck.input} value={form.seasonStartDate} aria-label="First day of the season" onChange={setStart} />
          <DateInput className={ck.input} value={form.seasonEndDate} aria-label="Last day of the season"
            min={form.seasonStartDate || undefined} rangeStart={form.seasonStartDate || undefined}
            onChange={v => { setEndTouched(true); set('seasonEndDate', v); }} />
        </div>
      </div>
      {datesHint && <p className={ck.hint}>{datesHint}</p>}

      {source && (
        <>
          <p className={css.bringTitle} id={`${fieldId}-bring`}>{SF.bringTitle}</p>
          <div className={css.rows} role="group" aria-labelledby={`${fieldId}-bring`}>
            <BringRow id={`${fieldId}-settings`} checked={honoured.settings} onChange={tick('settings')}
              title={SF.settings} sub={phone ? null : SF.settingsSub} />
            <BringRow id={`${fieldId}-ages`} checked={honoured.ageGroups} onChange={tick('ageGroups')}
              title={SF.ageGroups} count={counts.ageGroups}
              sub={live ? SF.ageGroupsLive : SF.ageGroupsSub(example ? { name: example.name, from: example.bornFromYear, to: example.bornToYear } : null, bornBy, phone)}>
              {live && honoured.ageGroups && detail && detail.divisions.length > 0 && (
                <div className={css.chips}>
                  {detail.divisions.map(d => (
                    <button key={d.id} type="button" className={ls.chip} aria-pressed={chosen.has(d.id)}
                      onClick={() => setChosen(c => { const n = new Set(c); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })}>
                      {d.name}
                    </button>
                  ))}
                </div>
              )}
            </BringRow>
            {/* Teams and practice settings live under age groups, and a coach on a team: each needs what it hangs on. */}
            <BringRow id={`${fieldId}-teams`} checked={honoured.teams} onChange={tick('teams')} disabled={!honoured.ageGroups}
              title={SF.teams} sub={phone ? null : SF.teamsSub} count={counts.teams} />
            <BringRow id={`${fieldId}-practice`} checked={honoured.practice} onChange={tick('practice')} disabled={!honoured.ageGroups}
              title={SF.practice} sub={phone ? null : SF.practiceSub} />
            <BringRow id={`${fieldId}-coaches`} checked={honoured.coaches} onChange={tick('coaches')} disabled={!honoured.teams}
              title={SF.coaches} sub={SF.coachesSub(phone)} count={counts.coaches} />
          </div>
          <p className={css.empty}>{SF.empty(phone)}</p>
        </>
      )}
    </KitDialog>
  );
}

/** One "Bring with it" row: the checkbox, the words its label names, anything that belongs below them, and a count. */
function BringRow({ id, checked, onChange, disabled = false, title, sub, count, children }: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  title: string;
  sub?: string | null;
  count?: number | null;
  children?: ReactNode;
}) {
  return (
    <div className={`${css.row}${disabled ? ` ${css.rowOff}` : ''}`}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <div className={css.rowMain}>
        <label htmlFor={id} className={css.rowLabel}>
          <strong>{title}</strong>
          {sub && <small>{sub}</small>}
        </label>
        {children}
      </div>
      {count != null && <span className={css.count}>{count}</span>}
    </div>
  );
}
