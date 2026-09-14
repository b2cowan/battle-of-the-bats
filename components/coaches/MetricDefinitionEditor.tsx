'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ListChecks } from 'lucide-react';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachLoading from '@/components/coaches/CoachLoading';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import SharedUnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { skillsAndGoalsHref } from '@/lib/development-address';
import { useCoaches } from '@/lib/coaches-context';
import { canWriteDevelopment } from '@/lib/coach-capabilities';
import {
  KIND_LABELS, AIM_LABELS, HEADLINE_LABELS, MEASURABLE_AIMS, MEASURABLE_KINDS,
  headlineOptionsFor, defaultHeadlineFor, aimSentence, successorSentence, type DefinitionChangeReason,
} from '@/lib/measurable-definition';
import { describeHeadline, sessionHeadline } from '@/lib/measurable-series';
import { formatValue } from '@/lib/measurable-format';
import {
  MAX_TYPE_NAME_LEN, MAX_UNIT_LEN, MAX_METHOD_LEN, MAX_DESCRIPTORS, MAX_DESCRIPTOR_LEN, MAX_ATTEMPTS,
} from '@/lib/development-input';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './MetricDefinitionEditor.module.css';
import type { MeasurableAim, MeasurableHeadline, MeasurableKind, RepTeamMeasurableType } from '@/lib/types';

/**
 * ═══ DEFINE A METRIC — one editor for a measured test and an observed skill (development
 * lifecycle Phase 1, mockup screen 2; owner-approved 2026-09-11) ═══
 *
 * A page, not a modal (a modal is for a question, not for a field — 2026-08-26): the form on the
 * left, and on the right what a saved record will READ BACK AS before the definition is saved,
 * so the coach sees the consequence of a unit or aim choice immediately. Kind is the one choice
 * that changes the rest of the form — a test takes a unit, an aim and a method; a skill takes
 * descriptors — and it is fixed once a definition exists.
 *
 * ⚠ THE RULE FOR LATER is enforced by the server and OFFERED here (owner ruling 3): a rename keeps
 * the series; changing the unit or a written method on a test that has readings starts a new
 * definition and retires this one. The PATCH answers 409 with the offer, the coach is asked, and
 * only a yes posts to `replace`. Retire and Restore live here now (they were on the old list).
 *
 * ⚠ THE DOOR IS THE GRANT (re-evaluation stage 0, D5, 2026-09-14): a coach without the Development
 * grant never reaches this page — `development/layout.tsx` answers them with the not-granted block.
 * The read-only face below (`canWrite` false → values where the controls would be) survives only
 * for the moment before the assignment is known on the client; retire it with station 1's build
 * rather than mid-flight (/simplify, 2026-09-14). The Metrics tab links every row here.
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

export default function MetricDefinitionEditor({ orgSlug, teamId, typeId }: {
  orgSlug: string;
  teamId: string;
  /** Null = defining a new metric. */
  typeId: string | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  // A NEW definition has no server read to learn the grant from — the assignment in context says
  // it; an EXISTING one takes the GET's own `canWrite` (the server's answer wins when it arrives).
  const { assignments } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/development/measurable-types`;
  const metricsHref = skillsAndGoalsHref(base, 'metrics');

  const [current, setCurrent] = useState<RepTeamMeasurableType | null>(null);
  const [hasReadings, setHasReadings] = useState(false);
  const [serverCanWrite, setCanWrite] = useState<boolean | null>(null);
  const canWrite = serverCanWrite ?? (assignment ? canWriteDevelopment(assignment.capabilities) : false);
  const [loading, setLoading] = useState(typeId !== null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  // What the record says now — derived from `current`, never a second copy to keep in step.
  const baseline = useMemo(() => (current ? draftFrom(current) : EMPTY), [current]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Set the instant a save lands: the draft is still "dirty" against the pre-save record until the
  // page unmounts, and the page guard must not prompt about changes that are already saved.
  const [saved, setSavedNow] = useState(false);

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
        setCanWrite(!!json.canWrite);
        setDraft(draftFrom(json.type));
        setLoading(false);
      })
      .catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Could not load this metric — try again.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [apiBase, typeId]);

  const dirty = !saved && (Object.keys(draft) as (keyof Draft)[]).some(k => draft[k] !== baseline[k]);
  // Cancel asks in place (the modal idiom); the header's way back, browser Back and a closed tab are
  // the PAGE guard's job (`SharedUnsavedChangesGuard` below) — the split the templates editor uses.
  const requestClose = useDiscardGuard({
    dirty: canWrite && dirty,
    close: () => router.push(metricsHref),
    noun: 'definition',
  });

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

  // ── the preview ───────────────────────────────────────────────────────────
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

  // ── writes ────────────────────────────────────────────────────────────────
  async function save() {
    if (busy) return;
    setError('');
    if (!draft.name.trim()) { setError('Give the metric a name.'); return; }
    if (isTest && !draft.unit.trim()) { setError('A measured test needs a unit — seconds, mph, inches.'); return; }
    // The mockup draws the method as required for a NEW test: a number only means what its
    // recorded method supports. A legacy test may keep an empty one (it was never recorded).
    if (isTest && isNew && !draft.method.trim()) { setError('Say how the test is run, so every result is comparable.'); return; }
    setBusy(true);
    try {
      const body = bodyFrom(draft);
      if (isNew) {
        const res = await fetch(apiBase, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json) throw new Error(json?.error ?? 'Could not save the definition — try again.');
        setSavedNow(true);
        router.push(metricsHref);
        return;
      }
      // An existing definition: send only what changed, so an untouched field is never "changed".
      const patch: Record<string, unknown> = {};
      const savedBody = bodyFrom(baseline);
      for (const [k, v] of Object.entries(body)) {
        if (k === 'kind') continue;
        if (JSON.stringify(v) !== JSON.stringify(savedBody[k])) patch[k] = v;
      }
      if (Object.keys(patch).length === 0) { router.push(metricsHref); return; }
      const res = await fetch(`${apiBase}/${typeId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const json = await res.json().catch(() => null);
      if (res.status === 409 && json?.successor) {
        const reasons = json.successor.reasons as DefinitionChangeReason[];
        const ok = await confirm({
          title: `Start a new definition of “${baseline.name}”?`,
          message: `${successorSentence(reasons, baseline.name)} New results will record under the new definition; the retired one stays listed with its results.`,
          confirmText: 'Start a new definition', cancelText: 'Keep editing', tone: 'warning',
        });
        if (!ok) return;
        const rep = await fetch(`${apiBase}/${typeId}/replace`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const repJson = await rep.json().catch(() => null);
        if (!rep.ok || !repJson) throw new Error(repJson?.error ?? 'Could not start the new definition — try again.');
        setSavedNow(true);
        router.push(metricsHref);
        return;
      }
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not save the definition — try again.');
      setSavedNow(true);
      router.push(metricsHref);
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
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not update the definition — try again.');
      setSavedNow(true);
      router.push(metricsHref);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the definition — try again.');
    } finally {
      setBusy(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  const title = isNew ? 'Define a metric' : (current?.name ?? 'Metric');
  const header = (
    <CoachPageHeader
      icon={ListChecks}
      title={title}
      backTo={{ href: metricsHref, label: 'Metrics' }}
      helpLabel="Metrics"
      help={{ module: 'coaches', sectionIds: ['premium-development'], fullGuideHref: `/${orgSlug}/coaches/help#premium-development` }}
    />
  );

  if (loading) {
    return <div className={shared.page}>{header}<CoachLoading label="Loading this metric…" /></div>;
  }
  if (!isNew && !current) {
    return <div className={shared.page}>{header}<p className={shared.errorText} role="alert">{error || 'Metric not found.'}</p></div>;
  }

  const retired = current ? !current.isActive : false;
  const replaced = !!current?.replacedById;
  const field = (label: string, id: string, control: React.ReactNode, help?: string) => (
    <div className={shared.field}>
      <label className={shared.label} htmlFor={id}>{label}</label>
      {control}
      {help && <p className={css.help}>{help}</p>}
    </div>
  );
  const readValue = (v: string) => <p className={css.value}>{v || '—'}</p>;

  return (
    <div className={shared.page}>
      <SharedUnsavedChangesGuard active={canWrite && dirty} message="You have unsaved changes to this definition. Leave without saving them?" />
      {header}
      {retired && (
        <p className={shared.devCardNote} style={{ marginBottom: '0.8rem' }}>
          Retired{replaced ? ' — replaced by a newer definition that carries this name' : ''}. Its saved results stay where they were recorded.
        </p>
      )}
      {!canWrite && (
        <p className={shared.devCardNote} style={{ marginBottom: '0.8rem' }}>
          Read-only — changing a definition needs the Development grant. Ask your head coach.
        </p>
      )}

      <div className={css.split}>
        <form className={css.editor} onSubmit={e => { e.preventDefault(); void save(); }} aria-label={isNew ? 'Define a metric' : 'Edit this metric'}>
          {field('Kind of metric', 'metric-kind',
            isNew && canWrite
              ? (
                <select id="metric-kind" className={shared.select} value={draft.kind} onChange={e => set('kind', e.target.value as MeasurableKind)}>
                  {MEASURABLE_KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                </select>
              )
              : readValue(KIND_LABELS[draft.kind]),
            isTest ? 'Record a number using the same method each time.' : 'Describe what you saw, in your own words — never a score.',
          )}

          {field('Name', 'metric-name',
            canWrite
              ? <input id="metric-name" className={shared.input} type="text" value={draft.name} maxLength={MAX_TYPE_NAME_LEN} required
                  onChange={e => set('name', e.target.value)} placeholder={isTest ? 'e.g. 60-yd sprint' : 'e.g. Sets feet before throwing'} />
              : readValue(draft.name),
          )}

          {isTest && (
            <>
              <div className={css.pair}>
                {field('Attempts per session', 'metric-attempts',
                  canWrite
                    ? (
                      <select id="metric-attempts" className={shared.select} value={draft.attemptsPerSession} onChange={e => set('attemptsPerSession', Number(e.target.value))}>
                        {Array.from({ length: MAX_ATTEMPTS }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{['One', 'Two', 'Three', 'Four', 'Five'][n - 1]}</option>
                        ))}
                      </select>
                    )
                    : readValue(String(draft.attemptsPerSession)),
                )}
                {field('Headline result', 'metric-headline',
                  canWrite
                    ? (
                      <select id="metric-headline" className={shared.select} value={draft.headline} onChange={e => set('headline', e.target.value as MeasurableHeadline)}>
                        {headlineOptions.map(h => <option key={h} value={h}>{HEADLINE_LABELS[h]}</option>)}
                      </select>
                    )
                    : readValue(HEADLINE_LABELS[draft.headline]),
                )}
              </div>
              <p className={css.help}>Every attempt is kept. The headline is what rows and charts lead with; the average and the spread are always behind it.</p>

              <div className={css.pair}>
                {field('Unit', 'metric-unit',
                  canWrite
                    ? <input id="metric-unit" className={shared.input} type="text" value={draft.unit} maxLength={MAX_UNIT_LEN} required
                        onChange={e => set('unit', e.target.value)} placeholder="seconds" />
                    : readValue(draft.unit),
                )}
                {field('What is the aim?', 'metric-aim',
                  canWrite
                    ? (
                      <select id="metric-aim" className={shared.select} value={draft.aim} onChange={e => set('aim', e.target.value as MeasurableAim)}>
                        {MEASURABLE_AIMS.map(a => <option key={a} value={a}>{AIM_LABELS[a]}</option>)}
                      </select>
                    )
                    : readValue(AIM_LABELS[draft.aim]),
                )}
              </div>
              {draft.aim === 'range' && (
                <>
                  <div className={css.pair}>
                    {field('From', 'metric-range-from',
                      canWrite
                        ? <input id="metric-range-from" className={shared.input} type="text" inputMode="decimal" value={draft.rangeFrom}
                            onChange={e => set('rangeFrom', e.target.value)} placeholder="62" />
                        : readValue(draft.rangeFrom),
                    )}
                    {field('To', 'metric-range-to',
                      canWrite
                        ? <input id="metric-range-to" className={shared.input} type="text" inputMode="decimal" value={draft.rangeTo}
                            onChange={e => set('rangeTo', e.target.value)} placeholder="68" />
                        : readValue(draft.rangeTo),
                    )}
                  </div>
                  <p className={css.help}>A range test has no “best” attempt. Its headline is how many attempts landed in the range, or the average.</p>
                </>
              )}
              {draft.aim === 'record' && (
                <p className={css.help}>Record only claims no direction — the product will never say “faster” or “better” about this test.</p>
              )}

              {field('How do you run the test?', 'metric-method',
                canWrite
                  ? <textarea id="metric-method" className={shared.textarea} rows={4} value={draft.method} maxLength={MAX_METHOD_LEN}
                      onChange={e => set('method', e.target.value)}
                      placeholder="Standing start on the same marked 60-yd course. Two timed attempts after warm-up. Use the same timing method." />
                  : readValue(draft.method || 'Method not recorded'),
                !isNew && !baseline.method ? 'Not recorded when this test was defined. Writing it now keeps the series — only changing a written method starts a new definition.' : 'Written once, so every result is comparable.',
              )}
            </>
          )}

          {!isTest && (
            <>
              {field('Descriptors to choose from (optional)', 'metric-descriptors',
                canWrite
                  ? <textarea id="metric-descriptors" className={shared.textarea} rows={4} value={draft.descriptors}
                      onChange={e => set('descriptors', e.target.value)}
                      placeholder={'With support — coach guides the setup\nWith a reminder — one verbal cue\nIndependently — without a cue'} />
                  : readValue(draft.descriptors || 'No descriptors'),
                `One per line, in your order — up to ${MAX_DESCRIPTORS}, each ${MAX_DESCRIPTOR_LEN} characters or fewer. “Not observed” stays separate; it is an evidence state, never the lowest rung.`,
              )}
              <p className={css.help}>An observed skill is defined here now. Recording an observation against it comes in a later release.</p>
            </>
          )}

          {isTest && (
            <p className={css.rule}>
              <strong>Changing a definition later.</strong> Rename fixes a typo and keeps the series. Changing the unit or the method
              {hasReadings ? ' starts a new definition and retires this one' : ' — once results exist — starts a new definition and retires this one'} — every saved result stays
              under the name and unit it was recorded with, and the two are never drawn as one line.
            </p>
          )}

          {error && <p className={shared.errorText} role="alert">{error}</p>}

          {canWrite && (
            <div className={css.actions}>
              <button type="submit" className={shared.btnPrimary} disabled={busy || (!isNew && !dirty)}>
                {busy ? 'Saving…' : isNew ? 'Save definition' : 'Save changes'}
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void requestClose()}>Cancel</button>
              <span className={css.actionsSpacer} />
              {!isNew && !retired && (
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void setActive(false)}>Retire</button>
              )}
              {!isNew && retired && !replaced && (
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void setActive(true)}>Restore</button>
              )}
            </div>
          )}
          {!canWrite && (
            <div className={css.actions}>
              <Link href={metricsHref} className="btn btn-ghost">Back to Metrics</Link>
            </div>
          )}
        </form>

        <aside className={css.preview} aria-label="Example recording preview">
          <p className={css.eyebrow}>What the coach records</p>
          <h2 className={css.previewName}>{draft.name.trim() || (isTest ? 'Your test' : 'Your skill')}</h2>
          {isTest ? (
            <>
              <p className={css.big}>
                {preview.headline == null ? '—' : formatValue(preview.headline)}
                <small>{draft.aim === 'range' && draft.headline === 'in_range' ? `of ${preview.attempts.length} in range` : (draft.unit.trim() || 'unit')}</small>
              </p>
              <p className={css.meta}>{preview.line}</p>
              <p className={css.meta}>An example session · {draft.method.trim() ? 'the method you wrote' : 'method not recorded'} · recorded by you</p>
              <div className={css.previewRule} />
              <p className={css.previewHead}>How the result reads back</p>
              {draft.aim === 'range' ? (
                <p className={css.readBack}>
                  {aimSentence({ aim: 'range', unit: draft.unit.trim() || null, rangeFrom: preview.def.rangeFrom, rangeTo: preview.def.rangeTo })}<br />
                  <strong>“moved into the range”</strong> — never faster, slower or better.
                </p>
              ) : draft.aim === 'record' ? (
                <p className={css.readBack}>Two dated numbers in {draft.unit.trim() || 'the unit'} — <strong>no direction claimed</strong>.</p>
              ) : (
                <p className={css.readBack}>
                  8.40 → 8.05 {draft.unit.trim() || 'unit'}<br />
                  <strong>0.35 {draft.unit.trim() || 'unit'} {draft.aim === 'lower' ? 'lower' : 'higher'}</strong> between the two recorded dates.
                </p>
              )}
              <p className={css.hint}>
                Arithmetic in the unit, dated. {draft.aim === 'lower' ? '“Faster” is said only because lower is the stated aim;' : draft.aim === 'higher' ? '“Stronger” is said only because higher is the stated aim;' : 'Nothing is said about direction;'} “better athlete” is never said.
              </p>
            </>
          ) : (
            <>
              <span className={css.tag}>Coach observation</span>
              <div className={css.previewRule} />
              <p className={css.previewHead}>{draft.descriptors.split('\n').map(s => s.trim()).filter(Boolean)[0] ?? 'What you saw'}</p>
              <p className={css.readBack}>A description of one observation, in a stated setting — never an overall grade.</p>
              <p className={css.meta}>An example date · you · the drill it happened in</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
