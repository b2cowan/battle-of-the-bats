'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import QuestionShell, { QuestionCancel, QuestionReason } from '@/components/coaches/QuestionShell';
import { useCoaches } from '@/lib/coaches-context';
import { possessive } from '@/lib/utils';
import { useSeasonBankWarning } from '@/components/coaches/bank/coachBank';
import {
  BRING_ANYWAY_LABEL, DEVELOPMENT_HISTORY_BULLET, documentsWindowLine, ROLL_CHOICE_TITLE, ROLL_LIST_EMPTY, ROLL_LIST_HINT,
  ROLL_LIST_LABEL, ROLL_QUESTION, bornBoxLabel, bornMovedLine, bringAnywayNote, closesLine, comingCount, defaultTicked,
  divisionForMovingUp, divisionHint, rollChoiceLine, rollRequestFields, rollWaitReason, rosterOutcomeLine, DIVISION_MAX,
  type SeasonRollPath, type SeasonWindowFacts,
} from '@/lib/season-roll-path';

/** Local mirror of the parts of RepSeasonRolloverSummary this modal renders (the source type lives
 *  in the server-only lib/rep-season-rollover.ts). */
interface RolloverSummary {
  ok: boolean;
  newSeason: { id: string; name: string; year: number };
  /**
   * ⚠ **ADDED 2026-08-18 TO FIX A LINK THAT HAD STOPPED WORKING.** The success view's "See
   * {season}'s Season Wrapped" button pointed at `/season-end` with no year — and by the time it
   * is pressed the rollover has already made the NEW season the team's working one, so that page
   * resolves the new year and says it is still under way. The season the coach just finished was
   * one field away on the payload the whole time and simply was not mirrored here.
   */
  previousSeason: { id: string; name: string; year: number };
  coaches: { copied: number };
  path: SeasonRollPath;
  roster: { copied: number; failed: number; stayed: { firstName: string; name: string }[] };
  division: string | null;
  budget: { carried: boolean; linesCopied: number; periodsCopied: number; failed: number };
  fees: { carried: boolean; playersCopied: number; failed: number; dueDatesShifted: boolean };
  /** What the new season opened with — the SERVER's figure, not the one this dialog displayed. */
  openingBalance: { carried: boolean; amount: number };
  notes: string[];
  warnings: string[];
}

/** Money in this dialog's own voice. */
function fmtMoney(n: number): string {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Start next season — the rollover form, and then what it did.
 *
 * ⚖ THE ONE WINDOW (One Window Stage 2c, owner rulings B3 and B5, 2026-10-19): a form that fills a phone (it was a
 * small centred card), whose keyboard stays inside. With anything changed from where it opened, ×, Cancel, Escape
 * and the phone's Back ask in the foot first; a stray tap outside does nothing. Once the season has started, every
 * way out of the window is "Go to {new season}" (`onDone`) — the old season is closed by then, so there is no form
 * to go back to.
 */
export default function StartNextSeasonModal({
  orgSlug,
  teamId,
  currentSeasonName,
  defaultNextYear,
  onClose,
  onDone,
}: {
  orgSlug: string;
  teamId: string;
  currentSeasonName: string;
  defaultNextYear: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(`${defaultNextYear} Season`);
  const [nameTouched, setNameTouched] = useState(false);
  const [year, setYear] = useState(String(defaultNextYear));
  const [carryBudget, setCarryBudget] = useState(true);
  const [carryFees, setCarryFees] = useState(true);
  /* ⚠ DEFAULTS TO CARRYING EVERYTHING, and that is the honest default rather than the convenient
     one: the team really is holding that money on day one of the new season. */
  const [carryCash, setCarryCash] = useState<'all' | 'amount' | 'none'>('all');
  const [carryAmount, setCarryAmount] = useState('');
  /** The register's own closing figure — read here only to SHOW it. The server computes the number
   *  it writes (a stale tab must never decide what a season opens with). */
  const [closingCash, setClosingCash] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<RolloverSummary | null>(null);
  /* ⚖ WHAT IS THE TEAM DOING NEXT SEASON? (Club Tier Stage 14a, Asks 1–3, ruled 2026-11-04). NOTHING is chosen when
     the window opens, and the main button waits for an answer with the reason in the foot. (a) the players come — a
     tick list, active ticked, inactive unticked, call-ups never listed — and the division moves up in a box; (b) a new
     group: nobody comes unless the box brings them anyway, and the birth years move a year later. */
  const [path, setPath] = useState<SeasonRollPath | null>(null);
  const [facts, setFacts] = useState<SeasonWindowFacts | null>(null);
  const [factsFailed, setFactsFailed] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);
  const [division, setDivision] = useState('');
  const [bringAnyway, setBringAnyway] = useState(false);
  // Chunk E WI-12: rollover carries roster/coaches/budget/fees and ZERO tryout data — a
  // mid-flight tryout becomes silently unreachable. Warn (never block) when unresolved
  // candidates or open scoring exist. Best-effort: a coach without the tryouts grant (or a
  // team that never used tryouts) just sees no line.
  const [tryoutWarning, setTryoutWarning] = useState<string | null>(null);
  // The bank's sentence (BC8a): a quiet read when the window opens, only when this season has a check.
  const bankWarning = useSeasonBankWarning(orgSlug, teamId, 'start');

  // Only teams that have actually USED tryouts get the check — the nav's own signal. This also
  // skips the fetch for coaches without the tryouts grant (403) and avoids lazily creating a
  // tryout workspace row for teams that never opened the feature (review finding).
  //
  // ⚠ Scoped to the ACTIVE season deliberately (2026-08-16 review). `tryout-overview` resolves the
  // team's active program year (`getActiveRepProgramYear`) and answers about THAT tryout, so the
  // gate in front of it has to ask the same season's signal. A team can legitimately hold a draft
  // AND an active year at once, the assignments list has no ORDER BY, and a bare
  // `.find(a => a.teamId === teamId)` returns whichever the database happened to hand back first —
  // so the draft row winning the race silently suppressed the warning on a live season. Invisible
  // until 2026-08-16, when the signal started being computed per season: before that both rows
  // carried the same aliased value, so the ambiguity was hidden rather than absent.
  const { assignments } = useCoaches();
  const teamAssignments = assignments.filter(a => a.teamId === teamId);
  const hasTryoutSignal =
    (teamAssignments.find(a => a.programYearStatus === 'active') ?? teamAssignments[0])
      ?.hasTryoutSignal ?? false;
  useEffect(() => {
    if (!hasTryoutSignal) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/tryout-overview`);
        if (!res.ok) return;
        const data = await res.json();
        const s = data?.stats;
        if (!s || !alive) return;
        // Waitlisted candidates are lost in the roll exactly like pending/offered ones — a
        // parked kid is still awaiting an outcome (review finding).
        const awaiting = (s.pending ?? 0) + (s.offered ?? 0) + (s.waitlisted ?? 0);
        const scoringOpen = (s.scoredCount ?? 0) > 0 && !s.locked;
        if (awaiting > 0 || scoringOpen) {
          const parts: string[] = [];
          if (awaiting > 0) parts.push(`${awaiting} candidate${awaiting === 1 ? ' is' : 's are'} still awaiting an outcome`);
          if (scoringOpen) parts.push('scoring is open');
          setTryoutWarning(`Your tryout isn’t finished — ${parts.join(' and ')}. It won’t carry into the new season.`);
        }
      } catch { /* best-effort — no warning beats a broken rollover form */ }
    })();
    return () => { alive = false; };
  }, [orgSlug, teamId, hasTryoutSignal]);

  /* The register's closing figure, so "Carry $X into the 2027 season" can name a real number.
     ⚠ DISPLAY ONLY. The server recomputes it from the same walk when the season is actually
     created; if this read fails the option simply stops quoting a figure rather than quoting a
     wrong one, and the roll goes ahead either way. */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/register`);
        if (!res.ok) return;
        const data = await res.json();
        if (alive && typeof data?.cashOnHand === 'number') setClosingCash(data.cashOnHand);
      } catch { /* best-effort — an unnamed figure beats a stale one */ }
    })();
    return () => { alive = false; };
  }, [orgSlug, teamId]);

  /* Last season's players, the division and the birth years — the seasons preflight's `roll`. ⚠ Without them the
     window cannot honour a tick, so it says so and does not start; it never guesses who comes. */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/seasons`);
        const data = res.ok ? await res.json() : null;
        if (!alive) return;
        if (data?.roll) {
          const roll = data.roll as SeasonWindowFacts;
          setFacts(roll);
          // Path (a)'s starting state, ready before it is picked: the active players ticked, the age group up.
          setTicked(defaultTicked(roll.players));
          setDivision(divisionForMovingUp(roll.division));
        } else setFactsFailed(true);
      } catch { if (alive) setFactsFailed(true); }
    })();
    return () => { alive = false; };
  }, [orgSlug, teamId]);

  const showsDivision = !!facts?.division?.trim();
  const papersLine = documentsWindowLine(facts?.documents, name.trim() || `${defaultNextYear} Season`);
  const bornMoved = facts ? bornMovedLine(facts.born, facts.cutoff) : null;
  const choiceFacts = { portal: 'coach' as const, division: facts?.division ?? null, born: facts?.born ?? { from: null, to: null }, cutoff: facts?.cutoff ?? { m: 1, d: 1 } };
  const waitReason = rollWaitReason(path, facts, factsFailed);

  // Anything changed from where the form opened would be lost on close.
  const dirty = !summary && (name !== `${defaultNextYear} Season` || year !== String(defaultNextYear) || !carryBudget || !carryFees
    || carryCash !== 'all' || carryAmount !== '' || path !== null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!path || !facts) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/seasons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), year: Number(year), carryBudget, carryFees,
          carryCash: carryCash === 'amount'
            ? { mode: 'amount', amount: Number(carryAmount.trim().replace(/[$,]/g, '')) }
            : { mode: carryCash },
          ...rollRequestFields({ path, ticked, bringAnyway, facts, division }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not start the new season.');
        return;
      }
      setSummary(data.summary as RolloverSummary);
    } catch {
      setError('Could not start the new season. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <QuestionShell open onClose={summary ? onDone : onClose} dirty={dirty} busy={submitting}
      ariaLabel="Start next season" title={summary ? 'New season started' : 'Start next season'}
      footer={summary ? (
        <>
          {/* D4: the just-closed season's ceremony is one tap away from the moment it
              closes. Deliberately a FULL navigation (plain <a>, not <Link>): the rollover
              just changed which season is active, and only a hard load re-seeds the
              coaches context — a client-side hop here would land on Season's End with the
              old season still reported as active (adversarial review; same reason the
              Settings call site uses window.location.assign for its onDone). */}
          {/* ⚠ NAMES THE SEASON IT MEANS. Without the year this lands on the page's
              working-season branch — which is now the season that just STARTED — and tells the
              coach it is still under way, one press after they finished the one they wanted. */}
          <a
            href={`/${orgSlug}/coaches/teams/${teamId}/season-end?year=${encodeURIComponent(summary.previousSeason.id)}`}
            className={styles.btnSecondary}
          >
            See {possessive(currentSeasonName)} Season Wrapped
          </a>
          <button type="button" className={styles.btnPrimary} onClick={onDone}>
            Go to {summary.newSeason.name}
          </button>
        </>
      ) : (
        <>
          <QuestionCancel className={styles.btnSecondary} />
          <button type="submit" form="start-next-season-form" className={styles.btnPrimary} disabled={submitting || !!waitReason}>
            {submitting ? 'Starting...' : 'Start next season'}
          </button>
        </>
      )}
      footerStart={!summary && waitReason ? <span className={styles.rollFootNote}>{waitReason}</span> : undefined}>
      {summary ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={18} style={{ color: 'var(--logic-lime)', flexShrink: 0 }} />
            <p style={{ margin: 0, color: 'var(--white-90)' }}>
              <strong>{summary.newSeason.name}</strong> is now your active season.
            </p>
          </div>

          <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.88rem', color: 'var(--white-70)' }}>
            {/* ⚖ The one bullet the drawing changed (Stage 14a): who came, as what, who stayed and where. */}
            <li>
              {rosterOutcomeLine({
                path: summary.path, copied: summary.roster.copied, division: summary.division,
                stayed: summary.roster.stayed, fromSeasonName: summary.previousSeason.name,
              })}
              {summary.roster.failed > 0 ? ` ${summary.roster.failed} couldn’t be copied.` : ''}
            </li>
            {summary.budget.carried && (
              <li>{summary.budget.linesCopied} planned budget line{summary.budget.linesCopied === 1 ? '' : 's'} carried.</li>
            )}
            {summary.fees.carried && (
              <li>{summary.fees.playersCopied} player{summary.fees.playersCopied === 1 ? '' : 's'}&apos; fee plan{summary.fees.playersCopied === 1 ? '' : 's'} carried.</li>
            )}
            {/* ⚠ THE SERVER'S FIGURE, NOT THE ONE THIS DIALOG DISPLAYED — so a coach can see what
                actually landed rather than what was on offer when the form was drawn. */}
            {summary.openingBalance.carried && (
              <li>
                <strong>{fmtMoney(summary.openingBalance.amount)}</strong> carried forward as the new
                season&apos;s opening balance.
              </li>
            )}
            <li>The schedule starts fresh — last season&apos;s games, payments, and spending stay with {currentSeasonName}.</li>
          </ul>

          {summary.notes.length > 0 && (
            <div style={{ background: 'var(--white-05)', border: '1px solid var(--home-line, rgba(255,255,255,0.1))', borderRadius: 8, padding: '0.7rem 0.85rem' }}>
              <p style={{ margin: '0 0 0.35rem', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--white-55)' }}>Check these</p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--white-70)' }}>
                {summary.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}

          {summary.warnings.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {summary.warnings.map((w, i) => (
                <p key={i} style={{ margin: 0, display: 'flex', gap: '0.4rem', alignItems: 'flex-start', fontSize: '0.85rem', color: 'var(--danger)' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{w}</span>
                </p>
              ))}
            </div>
          )}

        </div>
      ) : (
        <form id="start-next-season-form" onSubmit={handleSubmit}>
          {/* ── THE CONSEQUENCE, FIRST ────────────────────────────────────────────────────────
              ⚠⚠ **THIS MOVED, AND ITS PROMISE WAS CORRECTED** (2026-08-18,
              COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN §3.2). The plan line said this dialog never told
              a coach the old season stops being editable. The CODE said otherwise: it did — in an
              amber caution at the very bottom, under two checkboxes and a bullet list, which is
              why it read as absent. Two things were actually wrong with it, and both are fixed
              here rather than by adding a second sentence saying the same thing:

                1. **It was last.** The one fact that would prevent the mistake this product
                   cannot undo (starting a season by accident — plan §3.4, deliberately unbuilt)
                   sat below everything a coach scrolls past. It is now the first thing in the
                   form, above the carry list, which is what §3.2 was asking for.
                2. **Half of it stopped being true.** It promised "the Insights archive keeps
                   every result and money record" — that archive is gone. A closed season is ONE
                   PAGE, and this now says what that page actually holds.

              ⚠ Not styled as a warning. Rolling forward is the ordinary, expected thing to do at
              the end of a year; an amber alert box around it made the common case look dangerous
              and, by doing so, taught coaches to scroll past the box. */}
          <div style={{
            background: 'var(--white-05)', border: '1px solid var(--home-line, rgba(255,255,255,0.1))',
            borderRadius: 8, padding: '0.8rem 0.9rem', marginBottom: '1rem',
          }}>
            {/* "This closes the 2026 Season." — it read "…2026 Season season." (Stage 14a fixed it in one place). */}
            <p style={{ margin: '0 0 0.4rem', fontSize: '0.92rem', fontWeight: 650, color: 'var(--white-90)' }}>
              {closesLine(currentSeasonName)}
            </p>
            <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--white-70)', lineHeight: 1.55 }}>
              <strong>{currentSeasonName}</strong> becomes a record you can open any time — results,
              roster, practices and money. Nothing is lost, but you will not be able to change it.
            </p>
          </div>

          {/* ── THE QUESTION (Stage 14a) — first after the consequence, because it decides what the rest mean.
              It replaces the one-sentence roster promise that stood here (every active player, always). */}
          <fieldset className={styles.rollChoices}>
            <legend>{ROLL_QUESTION}</legend>
            {(['moving_up', 'new_group'] as const).map(p => (
              <label key={p} className={`${styles.rollChoice} ${path === p ? styles.rollChoiceOn : ''}`}>
                <input type="radio" name="rollPath" checked={path === p} onChange={() => setPath(p)} />
                <span>
                  <b>{ROLL_CHOICE_TITLE[p]}</b>
                  <span>{rollChoiceLine(p, choiceFacts)}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {path === 'moving_up' && facts && (
            <>
              {showsDivision && (
                <div className={styles.field} style={{ marginBottom: '1rem' }}>
                  <label className={styles.label} htmlFor="snsDivision">Division</label>
                  <input id="snsDivision" className={styles.input} value={division} maxLength={DIVISION_MAX}
                    onChange={e => setDivision(e.target.value)} />
                  <p className={styles.formHint}>{divisionHint(facts.division)}</p>
                </div>
              )}
              <div className={styles.field} style={{ marginBottom: '1rem' }}>
                <span className={styles.label} id="snsPlayersLabel">{ROLL_LIST_LABEL}</span>
                {facts.players.length === 0 ? (
                  <p className={styles.formHint}>{ROLL_LIST_EMPTY}</p>
                ) : (
                  <>
                    <div className={styles.debtList} role="group" aria-labelledby="snsPlayersLabel">
                      <div className={styles.rollListHead}>
                        <span aria-live="polite">{comingCount(ticked.length, facts.players.length)}</span>
                        <button type="button" className={styles.linkBtnAccent}
                          onClick={() => setTicked(facts.players.map(p => p.id))}>All</button>
                        <span aria-hidden>·</span>
                        <button type="button" className={styles.linkBtnAccent} onClick={() => setTicked([])}>None</button>
                      </div>
                      <div className={styles.rollListBody}>
                        {facts.players.map(p => {
                          const on = ticked.includes(p.id);
                          return (
                            <label key={p.id} className={`${styles.debtRow} ${on ? styles.debtRowOn : ''}`}>
                              <input type="checkbox" checked={on}
                                onChange={e => setTicked(t => e.target.checked ? [...t, p.id] : t.filter(id => id !== p.id))} />
                              <span className={styles.debtWhat}>
                                <b>{p.name}{p.number ? <small className={styles.rollNum}>#{p.number}</small> : null}</b>
                              </span>
                              {p.status === 'inactive' && <span className={styles.chipQuiet}>Inactive</span>}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <p className={styles.formHint}>{ROLL_LIST_HINT}</p>
                  </>
                )}
              </div>
            </>
          )}

          {path === 'new_group' && facts && (
            <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {bornMoved && (
                <div className={styles.field}>
                  <span className={styles.label}>{bornBoxLabel(name.trim() || `${year} Season`)}</span>
                  <p style={{ margin: 0, fontSize: 'var(--type-body)', color: 'var(--text-primary)' }}>
                    {bornMoved.now}<span className={styles.rollWas}>{bornMoved.was}</span>
                  </p>
                </div>
              )}
              {facts.players.some(p => p.status === 'active') && (
                <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--white-80)' }}>
                  <input type="checkbox" checked={bringAnyway} onChange={e => setBringAnyway(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>
                    <strong>{BRING_ANYWAY_LABEL}</strong>
                    <span style={{ display: 'block', fontSize: 'var(--type-support)', color: 'var(--text-tertiary)' }}>{bringAnywayNote()}</span>
                  </span>
                </label>
              )}
            </div>
          )}

          <div className={styles.formGrid}>
            <div className={`${styles.field} ${styles.formGridFull}`}>
              <label className={styles.label} htmlFor="snsName">Season name</label>
              <input id="snsName" className={styles.input} value={name} maxLength={100}
                onChange={e => { setName(e.target.value); setNameTouched(true); }} required />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="snsYear">Year</label>
              <input id="snsYear" className={styles.input} type="number" value={year} min={2000} max={2100}
                onChange={e => { const v = e.target.value; setYear(v); if (!nameTouched) setName(v ? `${v} Season` : ''); }} required />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1rem' }}>
            <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--white-80)' }}>
              <input type="checkbox" checked={carryBudget} onChange={e => setCarryBudget(e.target.checked)} style={{ marginTop: 3 }} />
              <span>Carry over the <strong>planned budget</strong> (projected buckets only — actual spending stays behind).</span>
            </label>
            <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--white-80)' }}>
              <input type="checkbox" checked={carryFees} onChange={e => setCarryFees(e.target.checked)} style={{ marginTop: 3 }} />
              <span>Carry over the <strong>fee plan</strong> (amounts &amp; installments; due dates shift forward a year — paid history does not carry).</span>
            </label>
          </div>

          {/* ── Carry your money forward? (mig 262, owner ruling 2026-08-23, drawn) ────────
              ⚠⚠ DRAWN AS "step 2 of 3" AND BUILT AS A BLOCK, deliberately. This dialog is one
              form, and its opening "This closes the {season} season" panel was owner-placed at the
              top in 2026-08-18 precisely so the consequence is read before anything else.
              Restructuring it into a wizard to house one question would move that panel behind a
              Next button — a bigger change than the ruling asked for, and to the one sentence
              that prevents the mistake this product cannot undo.
              ⚠ SETTLING UP HAPPENS BEFORE THIS, and the note says so: a closed season's book takes
              no new payments. That is the standing warn-never-block tradeoff, unchanged — nothing
              here refuses a roll. */}
          <fieldset style={{ border: 0, margin: '1rem 0 0', padding: 0 }}>
            <legend style={{ padding: 0, fontSize: '0.92rem', fontWeight: 650, color: 'var(--white-90)' }}>
              Carry your money forward?
            </legend>
            {closingCash !== null && (
              <p style={{ margin: '0.25rem 0 0.6rem', fontSize: '0.85rem', color: 'var(--white-55)' }}>
                Cash on hand today: <strong>{fmtMoney(closingCash)}</strong> — the register&apos;s own closing figure.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--white-80)' }}>
                <input type="radio" name="carryCash" checked={carryCash === 'all'}
                  onChange={() => setCarryCash('all')} style={{ marginTop: 3 }} />
                <span>
                  <strong>Carry {closingCash !== null ? fmtMoney(closingCash) : 'it all'} into {name.trim() || 'the new season'}.</strong>{' '}
                  It becomes the new season&apos;s opening balance — the first line of its register and its report.
                </span>
              </label>
              <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--white-80)' }}>
                <input type="radio" name="carryCash" checked={carryCash === 'amount'}
                  onChange={() => setCarryCash('amount')} style={{ marginTop: 3 }} />
                <span>
                  <strong>Carry a different amount.</strong> Planning to pay families back or settle with the
                  club first? Carry what will be left.
                </span>
              </label>
              {carryCash === 'amount' && (
                <input
                  className={styles.input}
                  type="text"
                  inputMode="decimal"
                  aria-label="Amount to carry into the new season"
                  placeholder="0.00"
                  value={carryAmount}
                  onChange={e => setCarryAmount(e.target.value)}
                  style={{ maxWidth: 160, marginLeft: '1.7rem', minHeight: 44, textAlign: 'right' }}
                />
              )}
              <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--white-80)' }}>
                <input type="radio" name="carryCash" checked={carryCash === 'none'}
                  onChange={() => setCarryCash('none')} style={{ marginTop: 3 }} />
                <span>
                  <strong>Start the new season at $0.</strong> The {currentSeasonName} season keeps its own
                  record either way.
                </span>
              </label>
            </div>
            <p style={{ margin: '0.6rem 0 0', fontSize: '0.82rem', color: 'var(--white-55)', lineHeight: 1.5 }}>
              You can adjust this later in <strong>Team settings → Money</strong>. Settling up happens{' '}
              <strong>before</strong> this step — a closed season&apos;s book can&apos;t take new payments.
            </p>
          </fieldset>

          {/* What ISN'T a choice — the two things families ask about that this dialog used to
              omit (readiness review f5-7): development history and awards. */}
          <ul style={{ margin: '1rem 0 0', paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--white-70)' }}>
            {/* ⚖ Replaced 2026-11-04 (Stage 14a): the old line promised a per-player goals offer that left the
                player's page on 2026-09-16 (the roll's own comment says so). */}
            <li>
              <strong>{DEVELOPMENT_HISTORY_BULLET.title}</strong>{DEVELOPMENT_HISTORY_BULLET.rest}
            </li>
            {/* Club Tier Stage 14 S4 (drawing 2A): the papers, from the team's own settings — only when it has any. */}
            {papersLine && (
              <li>
                <strong>{papersLine.title}</strong>{papersLine.rest}
              </li>
            )}
            <li>
              <strong>Awards</strong> stay on the team&apos;s all-time record — nothing to carry.
            </li>
          </ul>

          {/* WI-12: a live tryout doesn't survive the roll — say so before the coach commits. */}
          {tryoutWarning && (
            <div style={{
              display: 'flex', gap: '0.55rem', alignItems: 'flex-start', marginTop: '1rem',
              background: 'rgba(var(--warning-rgb), 0.1)', border: '1px solid rgba(var(--warning-rgb), 0.3)',
              borderRadius: 8, padding: '0.7rem 0.85rem',
            }}>
              <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} aria-hidden />
              <span style={{ fontSize: '0.85rem', color: 'var(--white-80)', lineHeight: 1.5 }}>{tryoutWarning}</span>
            </div>
          )}

          {/* The bank (BC8a; K6, R0 tab 7): when this season has a check, say where it stands before the roll. Warn, never
              block, and the sentence alone: a door to the Bank view would leave this form and lose what is typed (the
              one-window rule). The roll itself is untouched (lib/rep-season-rollover.ts knows nothing of the bank). */}
          {bankWarning && (
            <div style={{
              display: 'flex', gap: '0.55rem', alignItems: 'flex-start', marginTop: '1rem',
              background: 'rgba(var(--warning-rgb), 0.1)', border: '1px solid rgba(var(--warning-rgb), 0.3)',
              borderRadius: 8, padding: '0.7rem 0.85rem',
            }}>
              <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} aria-hidden />
              <span style={{ fontSize: '0.85rem', color: 'var(--white-80)', lineHeight: 1.5 }}>{bankWarning}</span>
            </div>
          )}

          {/* ⚠ The amber "once you start, {season} locks as read-only" block that stood here is
              GONE — moved to the TOP of this form and re-written (see the note above). It is not
              repeated: two statements of one consequence, one of which named an archive that no
              longer exists, is how a dialog trains a coach to skim. */}

          <QuestionReason className={styles.errorText}>{error}</QuestionReason>
        </form>
      )}
    </QuestionShell>
  );
}
