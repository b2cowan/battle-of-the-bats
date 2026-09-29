'use client';
/**
 * THE CLUB'S SEASON WINDOWS (Club Tier Stage 2, specimen 3 — Ask 1 (a), owner 2026-09-28): the
 * standalone head coach's doors, held by the club for a club team, calling session 1's routes
 * (`…/teams/[teamId]/seasons` and, for a brand-new team, `…/program-years`).
 *
 *   StartSeasonDialog  — the consequence first; name and year; the five carries (budget and fee plan
 *                        optional, both on); NO money figure; the unsettled-money warning as COUNTS in
 *                        a white card with an amber edge — it never blocks; who is told.
 *   CloseSeasonDialog  — the same warning; nothing is created, moved or deleted. With two seasons
 *                        open it asks WHICH (the server never guesses — `choose_season`).
 *   FirstSeasonDialog  — a name and a year, nothing to carry.
 * Every sentence is `lib/club-season-words.ts`'s. Creating asks (an explicit Start); a refusal is
 * said in the window, in the server's words.
 */
import { useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import KitDialog from './KitDialog';
import ck from './ClubKit.module.css';
import { Callout, repKit } from './RepKit';
import {
  CLOSE_BODY, CLOSE_LATER, FIRST_SEASON_TITLE, START_CARRIES, START_STAFF_NOTE,
  closeTitle, closeWarning, firstSeasonLine, hasUnsettled, rosterCarryDetail, startButton, startLead,
  startToldLine, startWarningTail, unsettledIntro, unsettledLines, type UnsettledCounts,
} from '@/lib/club-season-words';

export interface SeasonRef { id: string; name: string; year: number; status: string; isLive: boolean }
/** What `GET …/teams/[teamId]/seasons` answers (it never refuses). */
export interface SeasonPreflight {
  season: SeasonRef | null;
  lastClosed: SeasonRef | null;
  rollsFrom: SeasonRef | null;
  suggested: { year: number; name: string } | null;
  openSeasons: SeasonRef[];
  canReopen: boolean;
  reopenSeason: SeasonRef | null;
  hasSeasons: boolean;
  unsettled: UnsettledCounts | null;
}

async function send(url: string, method: 'POST' | 'PATCH', body: unknown): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: typeof data.error === 'string' ? data.error : 'That didn’t work. Please try again.' };
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' };
  }
}

function UnsettledWarning({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Callout tone="warn" role="note" icon={<AlertTriangle size={15} aria-hidden />}>
      <b>{heading}</b>
      <div className={repKit.calloutSub}>{children}</div>
    </Callout>
  );
}

export function StartSeasonDialog({
  orgSlug, teamId, teamName, preflight, rosterCount, headCoachName, onClose, onStarted,
}: {
  orgSlug: string;
  teamId: string;
  teamName: string;
  preflight: SeasonPreflight;
  /** The roster rule's count on the season it rolls from (the carry's "the 14 active players"). */
  rosterCount: number;
  headCoachName: string | null;
  onClose: () => void;
  onStarted: (seasonName: string) => void;
}) {
  const from = preflight.rollsFrom!;
  const [name, setName] = useState(preflight.suggested?.name ?? `${from.year + 1} Season`);
  const [year, setYear] = useState(String(preflight.suggested?.year ?? from.year + 1));
  const [carryBudget, setCarryBudget] = useState(true);
  const [carryFees, setCarryFees] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const yearNum = Number(year);
  const ready = name.trim().length > 0 && Number.isInteger(yearNum) && yearNum > from.year;
  const lines = unsettledLines(preflight.unsettled);

  async function start() {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    const out = await send(`/api/admin/rep-teams/teams/${teamId}/seasons?orgSlug=${encodeURIComponent(orgSlug)}`, 'POST', {
      year: yearNum, name: name.trim(), carryBudget, carryFees,
    });
    setBusy(false);
    if (!out.ok) { setError(out.error); return; }
    onStarted(name.trim());
  }

  return (
    <KitDialog
      kind="form"
      title={Number.isInteger(yearNum) && yearNum > 0 ? `Start the ${yearNum} Season?` : 'Start the next season?'}
      eyebrow={teamName}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <span className={repKit.footNote}>{startToldLine(headCoachName)}</span>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={start} disabled={!ready || busy}>
            {busy ? 'Starting…' : startButton(Number.isInteger(yearNum) ? yearNum : null)}
          </button>
        </>
      }
    >
      <p className={repKit.lead}>{startLead({ fromName: from.name, fromIsLive: from.isLive })}</p>
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      <div className={repKit.fieldGrid}>
        <label className={ck.field}>
          <span className={ck.label}>Season name<span className={repKit.req} aria-hidden>*</span></span>
          <input className={ck.input} value={name} maxLength={100} onChange={e => setName(e.target.value)} />
        </label>
        <label className={ck.field}>
          <span className={ck.label}>Year<span className={repKit.req} aria-hidden>*</span></span>
          <input className={ck.input} value={year} inputMode="numeric" maxLength={4} onChange={e => setYear(e.target.value.replace(/[^0-9]/g, ''))} />
        </label>
      </div>

      <p className={repKit.carryLabel}>What comes with the team</p>
      <div className={repKit.carry}>
        <div className={repKit.carryRow}>
          <Check size={16} className={repKit.carryFixed} aria-hidden />
          <span className={repKit.carryText}><span><b>{START_CARRIES.roster.title}</b> · {rosterCarryDetail(rosterCount)}</span><span className={repKit.carryNote}>{START_CARRIES.roster.note}</span></span>
        </div>
        <label className={repKit.carryRow}>
          <input type="checkbox" checked={carryBudget} onChange={e => setCarryBudget(e.target.checked)} />
          <span className={repKit.carryText}><b>{START_CARRIES.budget.title}</b><span className={repKit.carryNote}>{START_CARRIES.budget.note(from.name)}</span></span>
        </label>
        <label className={repKit.carryRow}>
          <input type="checkbox" checked={carryFees} onChange={e => setCarryFees(e.target.checked)} />
          <span className={repKit.carryText}><b>{START_CARRIES.fees.title}</b><span className={repKit.carryNote}>{START_CARRIES.fees.note(from.name)}</span></span>
        </label>
        <div className={repKit.carryRow}>
          <Check size={16} className={repKit.carryFixed} aria-hidden />
          <span className={repKit.carryText}><b>{START_CARRIES.balance.title}</b><span className={repKit.carryNote}>{START_CARRIES.balance.note(from.name)}</span></span>
        </div>
        <div className={repKit.carryRow}>
          <Check size={16} className={repKit.carryFixed} aria-hidden />
          <span className={repKit.carryText}><b>{START_CARRIES.history.title}</b><span className={repKit.carryNote}>{START_CARRIES.history.note}</span></span>
        </div>
      </div>
      <p className={repKit.windowNote}>{START_STAFF_NOTE}</p>

      {from.isLive && hasUnsettled(preflight.unsettled) && (
        <div className={repKit.windowWarn}>
          <UnsettledWarning heading="Before you start">
            {unsettledIntro(teamName, from.year)}
            <ul className={repKit.factList}>{lines.map(l => <li key={l}>{l}</li>)}</ul>
            {startWarningTail({ headCoachName, seasonName: from.name })}
          </UnsettledWarning>
        </div>
      )}
    </KitDialog>
  );
}

export function CloseSeasonDialog({
  orgSlug, teamId, teamName, preflight, onClose, onClosed,
}: {
  orgSlug: string;
  teamId: string;
  teamName: string;
  preflight: SeasonPreflight;
  onClose: () => void;
  onClosed: (seasonName: string) => void;
}) {
  const open = preflight.openSeasons;
  // With two open (the state old Add Program Year could make), the club names WHICH — never a guess.
  const [seasonId, setSeasonId] = useState(open.length === 1 ? open[0].id : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const target = open.find(s => s.id === seasonId) ?? null;
  const warning = closeWarning(preflight.unsettled);

  async function close() {
    if (!target || busy) return;
    setBusy(true);
    setError('');
    const out = await send(`/api/admin/rep-teams/teams/${teamId}/seasons?orgSlug=${encodeURIComponent(orgSlug)}`, 'PATCH', {
      action: 'close', seasonId: target.id,
    });
    setBusy(false);
    if (!out.ok) { setError(out.error); return; }
    onClosed(target.name);
  }

  return (
    <KitDialog
      kind="question"
      title={target ? closeTitle(target.name) : 'Close which season?'}
      eyebrow={teamName}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={close} disabled={!target || busy}>
            {busy ? 'Closing…' : 'Close the season'}
          </button>
        </>
      }
    >
      {open.length > 1 && (
        <label className={ck.field}>
          <span className={ck.label}>Which season<span className={repKit.req} aria-hidden>*</span></span>
          <select className={ck.select} value={seasonId} onChange={e => setSeasonId(e.target.value)} data-autofocus="">
            <option value="">Choose a season</option>
            {open.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      <p>{CLOSE_BODY}</p>
      <p className={repKit.carryNote}>{CLOSE_LATER}</p>
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      {warning && preflight.season && target?.id === preflight.season.id && (
        <div className={repKit.windowWarn}>
          <UnsettledWarning heading="Before you do">{warning}</UnsettledWarning>
        </div>
      )}
    </KitDialog>
  );
}

export function FirstSeasonDialog({
  orgSlug, teamId, teamName, onClose, onStarted,
}: {
  orgSlug: string;
  teamId: string;
  teamName: string;
  onClose: () => void;
  onStarted: (seasonName: string) => void;
}) {
  const thisYear = new Date().getFullYear();
  const [name, setName] = useState(`${thisYear} Season`);
  const [year, setYear] = useState(String(thisYear));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const yearNum = Number(year);
  const ready = name.trim().length > 0 && Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 2100;

  async function start() {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    const out = await send(`/api/admin/rep-teams/teams/${teamId}/program-years?orgSlug=${encodeURIComponent(orgSlug)}`, 'POST', {
      name: name.trim(), year: yearNum,
    });
    setBusy(false);
    if (!out.ok) { setError(out.error); return; }
    onStarted(name.trim());
  }

  return (
    <KitDialog
      kind="form"
      title={FIRST_SEASON_TITLE}
      eyebrow={teamName}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={start} disabled={!ready || busy}>
            {busy ? 'Starting…' : startButton(Number.isInteger(yearNum) ? yearNum : null)}
          </button>
        </>
      }
    >
      <p className={repKit.lead}>{firstSeasonLine(teamName)}</p>
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      <div className={repKit.fieldGrid}>
        <label className={ck.field}>
          <span className={ck.label}>Season name<span className={repKit.req} aria-hidden>*</span></span>
          <input className={ck.input} value={name} maxLength={100} onChange={e => setName(e.target.value)} />
        </label>
        <label className={ck.field}>
          <span className={ck.label}>Year<span className={repKit.req} aria-hidden>*</span></span>
          <input className={ck.input} value={year} inputMode="numeric" maxLength={4} onChange={e => setYear(e.target.value.replace(/[^0-9]/g, ''))} />
        </label>
      </div>
    </KitDialog>
  );
}
