'use client';
import { useMemo, useState } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import styles from './TryoutAcceptDrawer.module.css';

export interface AcceptIdentity {
  playerFirstName: string;
  playerLastName: string | null;
  playerDateOfBirth: string | null;
  guardianFirstName: string | null;
  guardianLastName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
}

export interface AcceptSuggestedDues {
  totalAmount: number;
  installments: { installmentNumber: number; amount: number; dueDate: string }[];
  source: 'prevailing' | 'budget_plan';
  complete: boolean;
}

export interface AcceptPayload {
  roster: { playerNumber: string | null; primaryPosition: string | null; jerseySize: string | null };
  dues: { totalAmount: number; notes: string | null; installments: { installmentNumber: number; amount: number; dueDate: string }[] } | null;
}

interface Props {
  identity: AcceptIdentity;
  suggestedDues: AcceptSuggestedDues | null;
  onClose: () => void;
  onConfirm: (payload: AcceptPayload) => Promise<void>;
}

interface InstRow { amount: string; dueDate: string }

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toFixed(2);

export default function TryoutAcceptDrawer({ identity, suggestedDues, onClose, onConfirm }: Props) {
  const playerName = `${identity.playerFirstName} ${identity.playerLastName ?? ''}`.trim();

  const [playerNumber, setPlayerNumber] = useState('');
  const [primaryPosition, setPrimaryPosition] = useState('');
  const [jerseySize, setJerseySize] = useState('');

  // Fees default ON only when we derived a fully-dated standard (prevailing dues). A budget-plan hint
  // (undated) is offered but starts OFF — the coach opts in and sets the date.
  const [feesOn, setFeesOn] = useState<boolean>(!!(suggestedDues && suggestedDues.complete));
  const [total, setTotal] = useState<string>(suggestedDues ? String(suggestedDues.totalAmount) : '');
  const [notes, setNotes] = useState('');
  const [installments, setInstallments] = useState<InstRow[]>(
    suggestedDues && suggestedDues.installments.length
      ? suggestedDues.installments.map(i => ({ amount: String(i.amount), dueDate: i.dueDate }))
      : [{ amount: '', dueDate: '' }],
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalNum = Number(total);
  const sum = useMemo(
    () => round2(installments.reduce((s, i) => s + (Number(i.amount) || 0), 0)),
    [installments],
  );
  const sumMatches = Math.abs(sum - (Number.isFinite(totalNum) ? totalNum : NaN)) <= 0.01;

  const feesValid = !feesOn || (
    Number.isFinite(totalNum) && totalNum > 0 &&
    installments.length > 0 &&
    installments.every(i => Number(i.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(i.dueDate)) &&
    sumMatches
  );

  function setInst(idx: number, patch: Partial<InstRow>) {
    setInstallments(rows => rows.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }
  function addInst() {
    setInstallments(rows => [...rows, { amount: '', dueDate: '' }]);
  }
  function removeInst(idx: number) {
    setInstallments(rows => rows.length > 1 ? rows.filter((_, i) => i !== idx) : rows);
  }
  function splitEvenly() {
    const t = Number(total);
    if (!Number.isFinite(t) || t <= 0 || !installments.length) return;
    const base = round2(t / installments.length);
    setInstallments(rows => rows.map((r, i) => ({
      ...r,
      amount: String(i === rows.length - 1 ? round2(t - base * (rows.length - 1)) : base),
    })));
  }

  async function handleConfirm() {
    setError(null);
    if (feesOn && !feesValid) {
      setError('Check the fee schedule — each installment needs an amount and date, and they must add up to the total.');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm({
        roster: {
          playerNumber: playerNumber.trim() || null,
          primaryPosition: primaryPosition.trim() || null,
          jerseySize: jerseySize.trim() || null,
        },
        dues: feesOn ? {
          totalAmount: round2(totalNum),
          notes: notes.trim() || null,
          installments: installments.map((i, idx) => ({
            installmentNumber: idx + 1,
            amount: round2(Number(i.amount)),
            dueDate: i.dueDate,
          })),
        } : null,
      });
      // Parent closes + shows feedback on success.
    } catch (e: any) {
      setError(e?.message ?? 'Could not add the player. Please try again.');
      setSubmitting(false);
    }
  }

  const dob = identity.playerDateOfBirth
    ? new Date(identity.playerDateOfBirth + 'T00:00:00').toLocaleDateString('en-CA')
    : null;

  return (
    <div className={styles.scrim} onClick={submitting ? undefined : onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()} role="dialog" aria-label={`Accept ${playerName}`}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.headerTitle}>Accept {playerName}</h3>
            <p className={styles.headerSub}>Add to the roster{feesOn ? ' with their fees' : ''}</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} disabled={submitting} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Identity — carried from the tryout registration (read-only) */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Player &amp; guardian</p>
            <div className={styles.readField}><span className={styles.readLabel}>Player</span><span className={styles.readValue}>{playerName}</span></div>
            {dob && <div className={styles.readField}><span className={styles.readLabel}>Date of birth</span><span className={styles.readValue}>{dob}</span></div>}
            {(identity.guardianFirstName || identity.guardianLastName) && (
              <div className={styles.readField}><span className={styles.readLabel}>Guardian</span><span className={styles.readValue}>{`${identity.guardianFirstName ?? ''} ${identity.guardianLastName ?? ''}`.trim()}</span></div>
            )}
            {identity.guardianEmail && <div className={styles.readField}><span className={styles.readLabel}>Email</span><span className={styles.readValue}>{identity.guardianEmail}</span></div>}
            {identity.guardianPhone && <div className={styles.readField}><span className={styles.readLabel}>Phone</span><span className={styles.readValue}>{identity.guardianPhone}</span></div>}
          </div>

          {/* Optional roster fields */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Roster details <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.35)' }}>· optional</span></p>
            <div className={styles.row3}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="acc-num">Number</label>
                <input id="acc-num" className={styles.input} value={playerNumber} onChange={e => setPlayerNumber(e.target.value)} maxLength={8} inputMode="numeric" />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="acc-pos">Position</label>
                <input id="acc-pos" className={styles.input} value={primaryPosition} onChange={e => setPrimaryPosition(e.target.value)} maxLength={30} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="acc-jsz">Jersey size</label>
                <input id="acc-jsz" className={styles.input} value={jerseySize} onChange={e => setJerseySize(e.target.value)} maxLength={12} />
              </div>
            </div>
          </div>

          {/* Fees */}
          <div className={styles.section}>
            <div className={styles.feesHead}>
              <p className={styles.sectionTitle} style={{ margin: 0 }}>Fees</p>
              <button
                type="button"
                className={styles.toggle}
                onClick={() => setFeesOn(v => !v)}
                aria-pressed={feesOn}
                disabled={submitting}
              >
                <span className={`${styles.switch} ${feesOn ? styles.switchOn : ''}`}><span className={styles.knob} /></span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{feesOn ? 'On' : 'Off'}</span>
              </button>
            </div>

            {!feesOn && (
              <p className={styles.hint}>No fees will be added now. You can set up dues later on the team&apos;s Dues page. This only records what&apos;s owed — no card is charged.</p>
            )}

            {feesOn && (
              <>
                {suggestedDues && (
                  <p className={styles.hint}>
                    {suggestedDues.source === 'prevailing'
                      ? <>Pre-filled from your team&apos;s <span className={styles.hintAccent}>standard fee</span> — edit anything below.</>
                      : <>Estimated from your team budget — <span className={styles.hintAccent}>set a due date</span> and adjust before saving.</>}
                  </p>
                )}
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="acc-total">Total fee (CAD)</label>
                  <input
                    id="acc-total" className={styles.input} inputMode="decimal"
                    value={total} onChange={e => setTotal(e.target.value)} placeholder="0.00"
                  />
                </div>

                <p className={styles.label} style={{ marginBottom: '-0.1rem' }}>Installments</p>
                <div className={styles.instList}>
                  {installments.map((inst, idx) => (
                    <div key={idx} className={styles.instRow}>
                      <span className={styles.instNum}>{idx + 1}</span>
                      <input
                        className={styles.input} inputMode="decimal" placeholder="Amount"
                        aria-label={`Installment ${idx + 1} amount`}
                        value={inst.amount} onChange={e => setInst(idx, { amount: e.target.value })}
                      />
                      <input
                        className={styles.input} type="date"
                        aria-label={`Installment ${idx + 1} due date`}
                        value={inst.dueDate} onChange={e => setInst(idx, { dueDate: e.target.value })}
                      />
                      <button
                        type="button" className={styles.removeBtn}
                        onClick={() => removeInst(idx)} disabled={installments.length <= 1}
                        aria-label={`Remove installment ${idx + 1}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className={styles.instTools}>
                  <button type="button" className={styles.linkBtn} onClick={addInst}><Plus size={13} /> Add installment</button>
                  <button type="button" className={styles.linkBtn} onClick={splitEvenly}>Split evenly</button>
                </div>

                <div className={styles.sumRow}>
                  <span className={styles.sumLabel}>Installments total</span>
                  <span className={sumMatches ? styles.sumOk : styles.sumBad}>
                    ${fmt(sum)}{!sumMatches && Number.isFinite(totalNum) ? ` / $${fmt(totalNum)}` : ''}
                  </span>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="acc-notes">Note <span style={{ color: 'rgba(255,255,255,0.35)' }}>· optional</span></label>
                  <input id="acc-notes" className={styles.input} value={notes} onChange={e => setNotes(e.target.value)} maxLength={200} placeholder="e.g. Sibling discount applied" />
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          {error && <p className={styles.errText} style={{ marginRight: 'auto', alignSelf: 'center' }}>{error}</p>}
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            type="button" className="btn btn-primary"
            onClick={handleConfirm}
            disabled={submitting || (feesOn && !feesValid)}
          >
            {submitting ? 'Adding…' : feesOn ? 'Add to roster + fees' : 'Add to roster'}
          </button>
        </div>
      </div>
    </div>
  );
}
