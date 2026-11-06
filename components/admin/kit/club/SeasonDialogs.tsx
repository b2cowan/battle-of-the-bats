'use client';
/**
 * THE CLUB'S SEASON WINDOWS (Club Tier Stage 2, specimen 3 — Ask 1 (a), owner 2026-09-28): the
 * standalone head coach's doors, held by the club for a club team, calling session 1's routes
 * (`…/teams/[teamId]/seasons` and, for a brand-new team, `…/program-years`).
 *
 *   StartSeasonDialog  — the consequence first; then the question "What is the team doing next season?"
 *                        (Stage 14a, ruled 2026-11-04 — the coach's window asks it in the same words): (a) the
 *                        players come, ticked INLINE (active ticked, inactive unticked, call-ups never listed),
 *                        the division may move up; (b) a new group, nobody comes unless brought anyway. Nothing
 *                        is chosen when it opens. Name and year; the carries (budget and fee plan
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
  closeTitle, closeWarning, firstSeasonLine, hasUnsettled, startButton, startLead,
  startToldLine, startWarningTail, unsettledIntro, unsettledLines, type OwedToClub, type UnsettledCounts,
} from '@/lib/club-season-words';
import {
  BRING_ANYWAY_LABEL, DIVISION_MAX, ROLL_CHOICE_TITLE, documentsWindowLine, ROLL_LIST_EMPTY, ROLL_LIST_HINT,
  ROLL_LIST_LABEL, ROLL_QUESTION, bringAnywayNote, comingCount, defaultTicked, divisionForMovingUp, divisionHint,
  rollChoiceLine, rollRequestFields, rollWaitReason, type SeasonRollPath, type SeasonWindowFacts,
} from '@/lib/season-roll-path';

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
  /** What the team owes the club in the season (Stage 3a, Ask 5b) — warns, never blocks. */
  owedToClub?: OwedToClub | null;
  /** What the Start window asks with (Stage 14a): last season's players, the division, the birth years. */
  roll?: SeasonWindowFacts | null;
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
  orgSlug, teamId, teamName, preflight, headCoachName, onClose, onStarted,
}: {
  orgSlug: string;
  teamId: string;
  teamName: string;
  preflight: SeasonPreflight;
  headCoachName: string | null;
  onClose: () => void;
  /** Awaited while the window stays busy: the page reloads before the window closes (Stage 13 fix-now 7, F-O4-3). */
  onStarted: (seasonName: string, warnings: string[]) => void | Promise<void>;
}) {
  const from = preflight.rollsFrom!;
  const [name, setName] = useState(preflight.suggested?.name ?? `${from.year + 1} Season`);
  const [year, setYear] = useState(String(preflight.suggested?.year ?? from.year + 1));
  const [carryBudget, setCarryBudget] = useState(true);
  const [carryFees, setCarryFees] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // ⚖ The question (Stage 14a): nothing chosen when it opens; path (a)'s list and division ready before it is picked.
  const roll = preflight.roll ?? null;
  const [path, setPath] = useState<SeasonRollPath | null>(null);
  const [ticked, setTicked] = useState<string[]>(() => (roll ? defaultTicked(roll.players) : []));
  const [division, setDivision] = useState(() => divisionForMovingUp(roll?.division));
  const [bringAnyway, setBringAnyway] = useState(false);
  const yearNum = Number(year);
  const ready = name.trim().length > 0 && Number.isInteger(yearNum) && yearNum > from.year;
  const waitReason = rollWaitReason(path, roll, !roll);
  const showsDivision = !!roll?.division?.trim();
  const papersLine = documentsWindowLine(roll?.documents, name.trim() || `${from.year + 1} Season`);
  const hasActive = !!roll?.players.some(p => p.status === 'active');
  const nobodyComes = path === 'moving_up' ? ticked.length === 0 : path === 'new_group' ? !bringAnyway : false;
  const choiceFacts = {
    portal: 'club' as const, division: roll?.division ?? null,
    born: roll?.born ?? { from: null, to: null }, cutoff: roll?.cutoff ?? { m: 1, d: 1 },
  };
  const lines = unsettledLines(preflight.unsettled, preflight.owedToClub);

  async function start() {
    if (!ready || busy || !path || !roll) return;
    setBusy(true);
    setError('');
    const out = await send(`/api/admin/rep-teams/teams/${teamId}/seasons?orgSlug=${encodeURIComponent(orgSlug)}`, 'POST', {
      year: yearNum, name: name.trim(), carryBudget, carryFees,
      ...rollRequestFields({ path, ticked, bringAnyway, facts: roll, division }),
    });
    if (!out.ok) { setBusy(false); setError(out.error); return; }
    // The season has started; what the roll could not do (a player or the division that did not carry) rides along. The
    // window stays on "Starting…" until the page holds the new season (Stage 13 fix-now 7).
    const w = (out.data.summary as { warnings?: unknown } | undefined)?.warnings;
    await onStarted(name.trim(), Array.isArray(w) ? w.filter((x): x is string => typeof x === 'string') : []);
    setBusy(false);
  }

  return (
    <KitDialog
      kind="form"
      size="medium"
      title={Number.isInteger(yearNum) && yearNum > 0 ? `Start the ${yearNum} Season?` : 'Start the next season?'}
      eyebrow={teamName}
      onClose={onClose}
      busy={busy}
      footerStart={<span className={repKit.footNote}>{waitReason ?? startToldLine(headCoachName)}</span>}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-lime" onClick={start} disabled={!ready || busy || !!waitReason}>
            {busy ? 'Starting…' : startButton(Number.isInteger(yearNum) ? yearNum : null)}
          </button>
        </>
      }
    >
      <p className={repKit.lead}>{startLead({ fromName: from.name, fromIsLive: from.isLive })}</p>
      {error && <p className={repKit.formError} role="alert">{error}</p>}

      {/* ── THE QUESTION (Stage 14a) — the coach's window asks it in these words; the club's lines name the birth
          years too, because the club sets them. The list is INLINE, never a next step. */}
      <fieldset className={repKit.rollChoices}>
        <legend className={repKit.carryLabel}>{ROLL_QUESTION}</legend>
        <div className={repKit.carry}>
          {(['moving_up', 'new_group'] as const).map(p => (
            <label key={p} className={`${repKit.carryRow} ${path === p ? repKit.carryRowOn : ''}`}>
              <input type="radio" name="clubRollPath" checked={path === p} onChange={() => setPath(p)} />
              <span className={repKit.carryText}><b>{ROLL_CHOICE_TITLE[p]}</b><span className={repKit.carryNote}>{rollChoiceLine(p, choiceFacts)}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      {path === 'moving_up' && roll && (
        <>
          {showsDivision && (
            <label className={`${ck.field} ${repKit.rollDivision}`}>
              <span className={ck.label}>Division</span>
              <input className={ck.input} value={division} maxLength={DIVISION_MAX} onChange={e => setDivision(e.target.value)} />
              <span className={repKit.carryNote}>{divisionHint(roll.division)}</span>
            </label>
          )}
          <p className={repKit.carryLabel} id="clubRollPlayers">{ROLL_LIST_LABEL}</p>
          {roll.players.length === 0 ? <p className={repKit.carryNote}>{ROLL_LIST_EMPTY}</p> : (
            <>
              <div className={repKit.carry} role="group" aria-labelledby="clubRollPlayers">
                <div className={repKit.rollHead}>
                  <span aria-live="polite">{comingCount(ticked.length, roll.players.length)}</span>
                  <button type="button" className={repKit.rollLink} onClick={() => setTicked(roll.players.map(p => p.id))}>All</button>
                  <span aria-hidden>·</span>
                  <button type="button" className={repKit.rollLink} onClick={() => setTicked([])}>None</button>
                </div>
                <div className={repKit.rollBody}>
                  {roll.players.map(p => {
                    const on = ticked.includes(p.id);
                    return (
                      <label key={p.id} className={`${repKit.carryRow} ${on ? repKit.carryRowOn : ''}`}>
                        <input type="checkbox" checked={on} onChange={e => setTicked(t => e.target.checked ? [...t, p.id] : t.filter(id => id !== p.id))} />
                        <span className={repKit.carryText}><b>{p.name}{p.number ? <small className={repKit.rollNum}>#{p.number}</small> : null}</b></span>
                        {p.status === 'inactive' && <span className={repKit.rollChip}>Inactive</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
              <p className={repKit.windowNote}>{ROLL_LIST_HINT}</p>
            </>
          )}
        </>
      )}

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
        {/* The fixed roster row is gone (Stage 14a): on (a) the players are the list above; on (b) this box. */}
        {path === 'new_group' && hasActive && (
          <label className={repKit.carryRow}>
            <input type="checkbox" checked={bringAnyway} onChange={e => setBringAnyway(e.target.checked)} />
            <span className={repKit.carryText}><b>{BRING_ANYWAY_LABEL}</b><span className={repKit.carryNote}>{bringAnywayNote()}</span></span>
          </label>
        )}
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
        {/* Linked history exists only for players who come: say nothing when the choice brings nobody. */}
        {!nobodyComes && (
          <div className={repKit.carryRow}>
            <Check size={16} className={repKit.carryFixed} aria-hidden />
            <span className={repKit.carryText}><b>{START_CARRIES.history.title}</b><span className={repKit.carryNote}>{START_CARRIES.history.note}</span></span>
          </div>
        )}
      </div>
      <p className={repKit.windowNote}>{START_STAFF_NOTE}</p>
      {/* Club Tier Stage 14 S4: the coach window's papers line, same words (both portals). */}
      {papersLine && <p className={repKit.windowNote}><b>{papersLine.title}</b>{papersLine.rest}</p>}

      {from.isLive && hasUnsettled(preflight.unsettled, preflight.owedToClub) && (
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
  /** Awaited while the window stays busy (Stage 13 fix-now 7). */
  onClosed: (seasonName: string) => void | Promise<void>;
}) {
  const open = preflight.openSeasons;
  // With two open (the state old Add Program Year could make), the club names WHICH — never a guess.
  const [seasonId, setSeasonId] = useState(open.length === 1 ? open[0].id : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const target = open.find(s => s.id === seasonId) ?? null;
  const warning = closeWarning(preflight.unsettled, preflight.owedToClub);

  async function close() {
    if (!target || busy) return;
    setBusy(true);
    setError('');
    const out = await send(`/api/admin/rep-teams/teams/${teamId}/seasons?orgSlug=${encodeURIComponent(orgSlug)}`, 'PATCH', {
      action: 'close', seasonId: target.id,
    });
    if (!out.ok) { setBusy(false); setError(out.error); return; }
    await onClosed(target.name);
    setBusy(false);
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
  /** Awaited while the window stays busy (Stage 13 fix-now 7). */
  onStarted: (seasonName: string) => void | Promise<void>;
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
    if (!out.ok) { setBusy(false); setError(out.error); return; }
    await onStarted(name.trim());
    setBusy(false);
  }

  return (
    <KitDialog
      kind="form"
      size="medium"
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
