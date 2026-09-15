'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import QuestionShell from '@/components/coaches/QuestionShell';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import {
  KIND_LABELS, AIM_LABELS, HEADLINE_LABELS, MEASURABLE_AIMS, MEASURABLE_KINDS,
  headlineOptionsFor, defaultHeadlineFor, aimSentence, successorSentence, previewChange,
} from '@/lib/measurable-definition';
import { describeHeadline, sessionHeadline } from '@/lib/measurable-series';
import { formatValue } from '@/lib/measurable-format';
import {
  MAX_TYPE_NAME_LEN, MAX_UNIT_LEN, MAX_METHOD_LEN, MAX_DESCRIPTORS, MAX_DESCRIPTOR_LEN, MAX_ATTEMPTS,
} from '@/lib/development-input';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './MetricDefinitionSheet.module.css';
import type { MeasurableAim, MeasurableHeadline, MeasurableKind, RepTeamMeasurableType } from '@/lib/types';

/**
 * ═══ DEFINE A METRIC — one sheet for a test and a skill (development lifecycle Phase 1, mockup
 * screen 2; re-evaluation stage 1, owner rulings 2026-09-14) ═══
 *
 * A SHEET over the screen it was opened from, not a page (stage 1): a metric is one record on the
 * Metrics list, and the portal opens a record over its list the way a player's dues open over the
 * dues table. It opens from the Metrics tab, from the Overview's getting-started card, from the
 * session grid's "+ New test…" and from the player's Record-a-result form — the SAME definition
 * from every door, so a test defined at the fence is a whole test, never the name-and-unit
 * shortcut that used to leave "method not recorded" in every report. Save or cancel lands the
 * coach back where they were; the host re-reads its data on `onSaved`.
 *
 * One column of fields. The consequence of a choice is shown WHERE IT IS MADE: a live one-line
 * read-back under the unit and aim ("Reads back as 8.05 seconds · best attempt · lower is the
 * aim"), and a Preview button that opens the full example — what a result reads like and how the
 * reports describe a change — in a modal over the sheet (owner, 2026-09-14). The preview tells
 * the reports' truth (B4): arithmetic in the unit, dated, the aim stated; never "faster",
 * "stronger" or "better".
 *
 * ⚠ THE RULE FOR LATER is enforced by the server and OFFERED here (owner ruling 3, narrowed
 * 2026-09-14): a rename keeps the series, and so does the METHOD — it is the coach's optional note
 * on how the test is run, never required and never a fork; changing the UNIT on a test that has
 * results starts a new definition and retires this one. The PATCH answers 409 with the offer, the
 * coach is asked, and only a yes posts to `replace`. Retire and Restore live in the footer.
 *
 * ⚠ THE DOOR IS THE GRANT (stage 0, D5): every host offers this sheet only to a coach who holds
 * the Development grant, so there is no read-only face for a LIVE metric. A RETIRED metric's sheet
 * reads as a record (owner, 2026-09-14): every field shown, only the name editable (a retired
 * "60-yd sprint" replaced by a live one needs to be able to say "60-yd sprint (hand-timed)"), and
 * Restore in the footer — the server already refuses to fork a retired definition, so the sheet
 * stops offering doors that end in "restore it first". The sheet is mounted PER OPEN (the host
 * keys it by what it edits), so its state never leaks from one definition to the next.
 */

type Draft = {
  kind: MeasurableKind;
  name: string;
  unit: string;
  aim: MeasurableAim;
  rangeFrom: string;
  rangeTo: string;
  method: string;
  attemptsPerSession: number;
  headline: MeasurableHeadline;
  descriptors: string;
};

const ATTEMPT_WORDS = ['One', 'Two', 'Three', 'Four', 'Five'];

const EMPTY: Draft = {
  kind: 'test', name: '', unit: '', aim: 'lower', rangeFrom: '', rangeTo: '', method: '',
  attemptsPerSession: 1, headline: 'best', descriptors: '',
};

function draftFrom(t: RepTeamMeasurableType): Draft {
  return {
    kind: t.kind,
    name: t.name,
    unit: t.unit ?? '',
    aim: t.aim,
    rangeFrom: t.rangeFrom == null ? '' : String(t.rangeFrom),
    rangeTo: t.rangeTo == null ? '' : String(t.rangeTo),
    method: t.method ?? '',
    attemptsPerSession: t.attemptsPerSession,
    headline: t.headline,
    descriptors: t.descriptors.join('\n'),
  };
}

/** The body a create, a patch and a replace all take — the reader supplies the rest. */
function bodyFrom(d: Draft): Record<string, unknown> {
  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  const isTest = d.kind === 'test';
  return {
    kind: d.kind,
    name: d.name,
    unit: isTest ? d.unit : null,
    aim: isTest ? d.aim : 'record',
    rangeFrom: isTest && d.aim === 'range' ? num(d.rangeFrom) : null,
    rangeTo: isTest && d.aim === 'range' ? num(d.rangeTo) : null,
    method: isTest ? d.method : null,
    attemptsPerSession: isTest ? d.attemptsPerSession : 1,
    headline: isTest ? d.headline : 'last',
    descriptors: isTest ? [] : d.descriptors.split('\n').map(s => s.trim()).filter(Boolean),
  };
}

/** Sample attempts for the preview — a sprint's, or the band's neighbours for a range test. */
function sampleAttempts(d: Draft): number[] {
  if (d.aim === 'range') {
    const from = Number(d.rangeFrom), to = Number(d.rangeTo);
    if (Number.isFinite(from) && Number.isFinite(to) && from < to) {
      const mid = (from + to) / 2;
      const step = Math.max((to - from) / 2, 0.5);
      return [Number((from - step / 2).toFixed(1)), Number(mid.toFixed(1)), Number((to + step / 2).toFixed(1))].slice(0, Math.max(1, d.attemptsPerSession));
    }
  }
  return [8.12, 8.05, 8.2, 8.16, 8.09].slice(0, Math.max(1, d.attemptsPerSession));
}

export default function MetricDefinitionSheet({ orgSlug, teamId, typeId, initial = null, onClose, onSaved }: {
  orgSlug: string;
  teamId: string;
  /** Null = defining a new metric. */
  typeId: string | null;
  /**
   * The record as the host already holds it (the Metrics tab opens a row it is looking at), so
   * the sheet paints at once instead of behind a loading frame; the read still runs, for
   * `hasReadings` and to catch a stale row. Omit it from a host that has no copy.
   */
  initial?: RepTeamMeasurableType | null;
  /** The host closes the sheet (after the discard guard has had its say). */
  onClose: () => void;
  /**
   * A definition was created, edited, replaced (the SUCCESSOR is handed over), retired or
   * restored — the host re-reads what it shows and closes the sheet.
   */
  onSaved: (type: RepTeamMeasurableType) => void;
}) {
  const confirm = useConfirm();
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/development/measurable-types`;

  const [current, setCurrent] = useState<RepTeamMeasurableType | null>(initial);
  const [hasReadings, setHasReadings] = useState(false);
  const [loading, setLoading] = useState(typeId !== null && !initial);
  const [draft, setDraft] = useState<Draft>(initial ? draftFrom(initial) : EMPTY);
  // What the host's copy said at mount — so the read can tell a field the coach TYPED from one
  // that merely differs because the host's copy was behind the server (another coach's edit).
  const seed = useRef<Draft | null>(initial ? draftFrom(initial) : null);
  // What the record says now — derived from `current`, never a second copy to keep in step.
  const baseline = useMemo(() => (current ? draftFrom(current) : EMPTY), [current]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!typeId) return;
    let cancelled = false;
    fetch(`${apiBase}/${typeId}`)
      .then(async res => ({ ok: res.ok, json: await res.json().catch(() => null) }))
      .then(({ ok, json }) => {
        if (cancelled) return;
        if (!ok || !json?.type) throw new Error(json?.error ?? 'Could not load this metric — try again.');
        setCurrent(json.type);
        setHasReadings(!!json.hasReadings);
        // Reconcile against the host's seed: an untouched field takes the server's value (a stale
        // host copy must not read as "dirty", nor be SENT), a typed one is kept.
        const fresh = draftFrom(json.type);
        const was = seed.current;
        setDraft(d => (was ? (Object.fromEntries((Object.keys(fresh) as (keyof Draft)[]).map(k => [k, d[k] === was[k] ? fresh[k] : d[k]])) as Draft) : fresh));
        setLoading(false);
      })
      .catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Could not load this metric — try again.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [apiBase, typeId]);

  const dirty = (Object.keys(draft) as (keyof Draft)[]).some(k => draft[k] !== baseline[k]);
  // Every way out of the sheet — Cancel, the X, the scrim, Escape, the phone's back arrow — asks
  // first when there is typed work to lose; the route guard (a link, a reload) rides the shell.
  const requestClose = useDiscardGuard({ dirty, close: onClose, noun: 'definition' });

  const isTest = draft.kind === 'test';
  const isNew = typeId === null;
  const headlineOptions = headlineOptionsFor(draft.aim);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(d => {
      const next = { ...d, [key]: value };
      // Moving between aims re-points a headline the new aim does not admit onto the ruled default.
      if (key === 'aim' && !headlineOptionsFor(next.aim).includes(next.headline)) next.headline = defaultHeadlineFor(next.aim);
      return next;
    });
  }

  // ── the read-back and the preview ─────────────────────────────────────────
  const preview = useMemo(() => {
    const previewDef = {
      aim: draft.aim, headline: draft.headline,
      rangeFrom: draft.aim === 'range' && draft.rangeFrom.trim() !== '' ? Number(draft.rangeFrom) : null,
      rangeTo: draft.aim === 'range' && draft.rangeTo.trim() !== '' ? Number(draft.rangeTo) : null,
    };
    const attempts = sampleAttempts(draft);
    const headline = sessionHeadline(attempts, previewDef);
    return { attempts, headline, line: describeHeadline(attempts, previewDef), def: previewDef };
    // Only the fields the preview reads — a keystroke in Name or Method must not recompute it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.aim, draft.headline, draft.rangeFrom, draft.rangeTo, draft.attemptsPerSession]);
  const unitWord = draft.unit.trim() || 'unit';
  const headlineFigure = preview.headline == null
    ? '—'
    : draft.aim === 'range' && draft.headline === 'in_range'
      ? `${preview.headline} of ${preview.attempts.length} in range`
      : `${formatValue(preview.headline)} ${unitWord}`;
  const readBackAim = aimSentence({ aim: draft.aim, unit: draft.unit.trim() || null, rangeFrom: preview.def.rangeFrom, rangeTo: preview.def.rangeTo });
  const change = previewChange(draft.aim);

  // ── writes ────────────────────────────────────────────────────────────────
  async function save() {
    if (busy) return;
    setError('');
    if (!draft.name.trim()) { setError('Give the metric a name.'); return; }
    if (isTest && !draft.unit.trim()) { setError('A test needs a unit — seconds, mph, inches.'); return; }
    setBusy(true);
    try {
      const body = bodyFrom(draft);
      if (isNew) {
        const res = await fetch(apiBase, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.type) throw new Error(json?.error ?? 'Could not save the definition — try again.');
        onSaved(json.type);
        return;
      }
      // An existing definition: send only what changed, so an untouched field is never "changed".
      const patch: Record<string, unknown> = {};
      const savedBody = bodyFrom(baseline);
      for (const [k, v] of Object.entries(body)) {
        if (k === 'kind') continue;
        if (JSON.stringify(v) !== JSON.stringify(savedBody[k])) patch[k] = v;
      }
      if (Object.keys(patch).length === 0) { onClose(); return; }
      const res = await fetch(`${apiBase}/${typeId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const json = await res.json().catch(() => null);
      if (res.status === 409 && json?.successor) {
        const ok = await confirm({
          title: `Start a new definition of “${baseline.name}”?`,
          message: `${successorSentence(baseline.name)} New results will record under the new definition; the retired one stays listed with its results.`,
          confirmText: 'Start a new definition', cancelText: 'Keep editing', tone: 'warning',
        });
        if (!ok) return;
        const rep = await fetch(`${apiBase}/${typeId}/replace`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const repJson = await rep.json().catch(() => null);
        if (!rep.ok || !repJson?.successor) throw new Error(repJson?.error ?? 'Could not start the new definition — try again.');
        onSaved(repJson.successor);
        return;
      }
      if (!res.ok || !json?.type) throw new Error(json?.error ?? 'Could not save the definition — try again.');
      onSaved(json.type);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the definition — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function setActive(isActive: boolean) {
    if (busy || !typeId) return;
    if (!isActive) {
      const ok = await confirm({
        title: `Retire “${baseline.name}”?`,
        message: 'It leaves new sessions and the pickers. Every saved result stays visible in the session and player history it belongs to, marked retired. You can restore it any time.',
        confirmText: 'Retire', cancelText: 'Cancel', tone: 'warning',
      });
      if (!ok) return;
    }
    setBusy(true); setError('');
    try {
      const res = await fetch(`${apiBase}/${typeId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.type) throw new Error(json?.error ?? 'Could not update the definition — try again.');
      onSaved(json.type);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the definition — try again.');
    } finally {
      setBusy(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  const title = isNew ? 'Define a metric' : (current?.name ?? 'Metric');
  const retired = current ? !current.isActive : false;
  const replaced = !!current?.replacedById;
  // ONE decision for the whole form: on a retired metric a field with a `locked` text reads as
  // that VALUE, not its control, and carries no help — the record of what its results were taken
  // under. A field without one (the name) stays a control. The label keeps its `htmlFor` so the
  // pair still reads as one to a screen reader.
  const field = (label: string, id: string, control: React.ReactNode, opts: { help?: string; locked?: string; multiline?: boolean } = {}) => (
    <div className={shared.field}>
      <label className={shared.label} htmlFor={id}>{label}</label>
      {retired && opts.locked !== undefined
        ? <p id={id} className={opts.multiline ? `${css.value} ${css.valueText}` : css.value}>{opts.locked || '—'}</p>
        : control}
      {!retired && opts.help && <p className={css.help}>{opts.help}</p>}
    </div>
  );

  return (
    <>
      <QuestionShell
        open
        onClose={requestClose}
        ariaLabel={isNew ? 'Define a metric' : `Edit ${title}`}
        title={title}
        subtitle={retired ? `Retired${replaced ? ' — replaced by a newer definition that carries this name' : ''}. Its saved results stay where they were recorded.` : undefined}
        busy={busy}
        scroll
        leaveGuard={{ dirty, message: 'You have unsaved changes to this definition. Leave without saving them?' }}
      >
        {loading ? (
          <div className={`${shared.formBody} ${shared.scrollPane}`}><p className={shared.loadingState}>Loading this metric…</p></div>
        ) : !isNew && !current ? (
          <div className={`${shared.formBody} ${shared.scrollPane}`}><p className={shared.errorText} role="alert">{error || 'Metric not found.'}</p></div>
        ) : (
          <form id="metric-definition-form" className={`${shared.formBody} ${shared.scrollPane} ${css.form}`} onSubmit={e => { e.preventDefault(); void save(); }}>
            {field('Kind of metric', 'metric-kind',
              isNew
                ? (
                  <select id="metric-kind" className={shared.select} value={draft.kind} onChange={e => set('kind', e.target.value as MeasurableKind)}>
                    {MEASURABLE_KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                  </select>
                )
                : <p className={css.value}>{KIND_LABELS[draft.kind]}</p>,
              { help: isTest ? 'Record a number using the same method each time.' : 'Describe what you saw, in your own words — never a score.' },
            )}

            {field('Name', 'metric-name',
              <input id="metric-name" className={shared.input} type="text" value={draft.name} maxLength={MAX_TYPE_NAME_LEN} required
                onChange={e => set('name', e.target.value)} placeholder={isTest ? 'e.g. 60-yd sprint' : 'e.g. Sets feet before throwing'} />,
            )}

            {isTest && (
              <>
                <div className={css.pair}>
                  {field('Attempts per session', 'metric-attempts',
                    <select id="metric-attempts" className={shared.select} value={draft.attemptsPerSession} onChange={e => set('attemptsPerSession', Number(e.target.value))}>
                      {Array.from({ length: MAX_ATTEMPTS }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{ATTEMPT_WORDS[n - 1]}</option>
                      ))}
                    </select>,
                    { locked: ATTEMPT_WORDS[draft.attemptsPerSession - 1] ?? String(draft.attemptsPerSession) },
                  )}
                  {field('Headline result', 'metric-headline',
                    <select id="metric-headline" className={shared.select} value={draft.headline} onChange={e => set('headline', e.target.value as MeasurableHeadline)}>
                      {headlineOptions.map(h => <option key={h} value={h}>{HEADLINE_LABELS[h]}</option>)}
                    </select>,
                    { locked: HEADLINE_LABELS[draft.headline] },
                  )}
                </div>
                {!retired && <p className={css.help}>Every attempt is kept. The headline is what rows and charts lead with; the average and the spread are always behind it.</p>}

                <div className={css.pair}>
                  {field('Unit', 'metric-unit',
                    <input id="metric-unit" className={shared.input} type="text" value={draft.unit} maxLength={MAX_UNIT_LEN} required
                      onChange={e => set('unit', e.target.value)} placeholder="seconds" />,
                    { locked: draft.unit },
                  )}
                  {field('What is the aim?', 'metric-aim',
                    <select id="metric-aim" className={shared.select} value={draft.aim} onChange={e => set('aim', e.target.value as MeasurableAim)}>
                      {MEASURABLE_AIMS.map(a => <option key={a} value={a}>{AIM_LABELS[a]}</option>)}
                    </select>,
                    { locked: AIM_LABELS[draft.aim] },
                  )}
                </div>
                {draft.aim === 'range' && (
                  <>
                    <div className={css.pair}>
                      {field('From', 'metric-range-from',
                        <input id="metric-range-from" className={shared.input} type="text" inputMode="decimal" value={draft.rangeFrom}
                          onChange={e => set('rangeFrom', e.target.value)} placeholder="62" />,
                        { locked: draft.rangeFrom },
                      )}
                      {field('To', 'metric-range-to',
                        <input id="metric-range-to" className={shared.input} type="text" inputMode="decimal" value={draft.rangeTo}
                          onChange={e => set('rangeTo', e.target.value)} placeholder="68" />,
                        { locked: draft.rangeTo },
                      )}
                    </div>
                    {!retired && <p className={css.help}>A range test has no “best” attempt. Its headline is how many attempts landed in the range, or the average.</p>}
                  </>
                )}
                {draft.aim === 'record' && !retired && (
                  <p className={css.help}>Record only claims no direction — the reports will never say “faster” or “better” about this test.</p>
                )}

                {/* The consequence, where the change is made: one live line under the four fields it depends on. */}
                <p className={css.readLine} aria-live="polite">
                  Reads back as <strong>{headlineFigure}</strong>
                  {draft.attemptsPerSession > 1 && draft.aim !== 'range' ? ` · ${HEADLINE_LABELS[draft.headline].toLowerCase()}` : ''}
                  {` · ${readBackAim}`}
                </p>

                {/* One word for it everywhere — the label, the row, the preview (owner, 2026-09-14: a row said
                    "method not recorded" and nothing on the sheet said "method"). Optional, and never a fork. */}
                {field('Method', 'metric-method',
                  <textarea id="metric-method" className={shared.textarea} rows={4} value={draft.method} maxLength={MAX_METHOD_LEN}
                    onChange={e => set('method', e.target.value)}
                    placeholder="Standing start on the same marked 60-yd course. Two timed attempts after warm-up. Use the same timing method." />,
                  { locked: draft.method, multiline: true, help: 'How do you run the test? Optional — a note for whoever runs it next, so results are taken the same way.' },
                )}
              </>
            )}

            {!isTest && (
              field('Descriptors to choose from (optional)', 'metric-descriptors',
                <textarea id="metric-descriptors" className={shared.textarea} rows={4} value={draft.descriptors}
                  onChange={e => set('descriptors', e.target.value)}
                  placeholder={'With support — coach guides the setup\nWith a reminder — one verbal cue\nIndependently — without a cue'} />,
                { locked: draft.descriptors, multiline: true, help: `One per line, in your order — up to ${MAX_DESCRIPTORS}, each ${MAX_DESCRIPTOR_LEN} characters or fewer. “Not observed” stays separate; it is an evidence state, never the lowest rung.` },
              )
            )}

            {retired ? (
              <p className={css.rule}>
                <strong>A retired metric is a record.</strong> Its saved results were taken under this definition, so only the name can change here
                {replaced ? '.' : ' — restore it to change anything else.'}
              </p>
            ) : isTest && (
              <p className={css.rule}>
                <strong>Changing a definition later.</strong> Rename, a new aim or a new method keeps the series. Changing the unit
                {hasReadings ? ' starts a new definition and retires this one' : ' — once results exist — starts a new definition and retires this one'} — every saved result stays
                under the unit it was recorded with, and the two are never drawn as one line.
              </p>
            )}

            {error && <p className={shared.errorText} role="alert">{error}</p>}
          </form>
        )}

        {!loading && (isNew || current) && (
          <div className={`${shared.modalFooter} ${css.foot}`}>
            <button type="button" className={shared.btnGhost} disabled={busy} onClick={() => setPreviewOpen(true)}>Preview</button>
            {!isNew && !retired && (
              <button type="button" className={shared.btnGhost} disabled={busy} onClick={() => void setActive(false)}>Retire</button>
            )}
            {!isNew && retired && !replaced && (
              <button type="button" className={shared.btnGhost} disabled={busy} onClick={() => void setActive(true)}>Restore</button>
            )}
            <span className={css.footSpacer} />
            <button type="button" className={shared.btnSecondary} disabled={busy} onClick={() => void requestClose()}>Cancel</button>
            <button type="submit" form="metric-definition-form" className={shared.btnPrimary} disabled={busy || (!isNew && !dirty)}>
              {busy ? 'Saving…' : isNew ? 'Save definition' : 'Save changes'}
            </button>
          </div>
        )}
      </QuestionShell>

      {/* The full example, over the sheet: what a result reads like, and how the reports describe a change. */}
      <QuestionShell open={previewOpen} onClose={() => setPreviewOpen(false)} ariaLabel="What a result of this metric reads like" title="What the coach records" subtitle={draft.name.trim() || (isTest ? 'Your test' : 'Your skill')}>
        <div className={`${shared.formBody} ${css.preview}`}>
          {isTest ? (
            <>
              <p className={css.big}>
                {preview.headline == null ? '—' : formatValue(preview.headline)}
                <small>{draft.aim === 'range' && draft.headline === 'in_range' ? `of ${preview.attempts.length} in range` : unitWord}</small>
              </p>
              <p className={css.meta}>{preview.line}</p>
              <p className={css.meta}>An example session · entered by you</p>
              <div className={css.previewRule} />
              <p className={css.previewHead}>How the result reads back</p>
              {draft.aim === 'range' ? (
                <p className={css.readBack}>
                  {readBackAim}<br />
                  <strong>“moved into the range”</strong> — never faster, slower or better.
                </p>
              ) : draft.aim === 'record' ? (
                <p className={css.readBack}>Two dated numbers in {unitWord} — <strong>no direction claimed</strong>.</p>
              ) : change ? (
                <p className={css.readBack}>
                  {formatValue(change.from)} → {formatValue(change.to)} {unitWord}<br />
                  <strong>{formatValue(change.delta)} {unitWord} {change.word}</strong> since the earlier date.
                </p>
              ) : null}
              <p className={css.hint}>The reports say what changed, in the unit, and state the aim — never “faster”, “stronger” or “better”.</p>
            </>
          ) : (
            <>
              <span className={css.tag}>Observation</span>
              <div className={css.previewRule} />
              <p className={css.previewHead}>{draft.descriptors.split('\n').map(s => s.trim()).filter(Boolean)[0] ?? 'What you saw'}</p>
              <p className={css.readBack}>A description of one observation, in a stated setting — never an overall grade.</p>
              <p className={css.meta}>An example date · entered by you · in a session</p>
            </>
          )}
        </div>
        <div className={shared.modalFooter}>
          <button type="button" className={shared.btnSecondary} onClick={() => setPreviewOpen(false)}>Close</button>
        </div>
      </QuestionShell>
    </>
  );
}
