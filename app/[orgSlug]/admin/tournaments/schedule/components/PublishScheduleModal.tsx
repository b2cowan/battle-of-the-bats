'use client';
/** The Publish window (per division: real names on the public page, registration closes). Moved out of the schedule page, Stage 3 Part 0. */
import React from 'react';
import { AlertCircle, Globe, Send, X } from 'lucide-react';
import { willScheduleGameDayReminder } from '@/lib/schedule-publish-rules';
import { GAME_DAY_REMINDER_SENTENCE, SCHEDULE_REFUSAL, readRefusal } from '@/lib/schedule-words';
import { isSandboxRefusal } from '@/lib/coach-sandbox-refusal';
import { useKitStyle } from '@/components/admin/AdminKitProvider';
import { KIT_INK } from '@/components/admin/kit/kit-inline';

export default function PublishScheduleModal({
  defaultDivisionId,
  divisions,
  tournament,
  canNotify,
  planId,
  orgSlug,
  onClose,
  onPublished,
  onDivisionClosed,
}: {
  defaultDivisionId: string;
  divisions: import('@/lib/types').Division[];
  tournament: import('@/lib/types').Tournament;
  canNotify: boolean;
  /** Read by the reminder sentence's rule — the same checks the publish route makes (F73). */
  planId: import('@/lib/types').OrgPlan | null;
  orgSlug: string;
  onClose: () => void;
  onPublished: (updates: { id: string; scheduleVisibility: 'published' }[]) => void;
  onDivisionClosed: (id: string) => void;
}) {
  const kx = useKitStyle();
  // Kit patches used inside lists or in both of the window's states — built once per render.
  const errorBannerStyle: React.CSSProperties = { marginBottom: '1rem', padding: '0.6rem 0.75rem', background: 'rgba(var(--danger-rgb), 0.08)', border: '1px solid rgba(var(--danger-rgb), 0.3)', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--danger-light)' };
  const openTargetNameStyle = kx({ fontSize: '0.83rem', color: 'var(--white-70)', padding: '0.2rem 0' }, KIT_INK.secondary);
  const divisionNameStyle = kx({ flex: 1, fontWeight: 600, fontSize: '0.85rem', color: 'var(--fl-text)' }, KIT_INK.primary);
  const liveTagStyle = kx(
    { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--success)', background: 'rgba(var(--success-rgb),0.1)', border: '1px solid rgba(var(--success-rgb),0.25)', padding: '1px 6px', borderRadius: '2px' },
    { color: 'var(--success-light)', background: 'rgba(var(--success-rgb), 0.08)', border: '1px solid rgba(var(--success-rgb), 0.3)' },
  );
  const publishable = divisions.filter(g => !g.scheduleVisibility || g.scheduleVisibility === 'unpublished');

  const [selectedIds, setSelectedIds] = React.useState<string[]>([defaultDivisionId]);
  const [notify, setNotify] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ notified: number } | null>(null);
  const [showRegCloseWarning, setShowRegCloseWarning] = React.useState(false);

  const targets = publishable.filter(g => selectedIds.includes(g.id));
  const allUnpublishedSelected = publishable.length > 0 && publishable.every(d => selectedIds.includes(d.id));
  // Publishing always uses real names and closes the division (mig 129). Any still-open
  // selected division will be closed as part of publishing.
  const openTargets = targets.filter(g => !g.isClosed);
  const willCloseOnPublish = openTargets.length > 0;
  // F73: the reminder sentence shows only when this publish will really schedule the reminder.
  const willRemind = willScheduleGameDayReminder({ notify, planId, settings: tournament.settings });

  function toggleDivision(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function doPublish() {
    setLoading(true);
    setError(null);
    try {
      const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
      const divisionIds = targets.map(g => g.id);

      // Publishing always uses real team names, so close any still-open selected
      // divisions first — stopping new public submissions.
      if (openTargets.length > 0) {
        const closed = await Promise.all(openTargets.map(g =>
          fetch(`/api/admin/divisions${orgQuery}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set-closed', id: g.id, data: { isClosed: true } }),
          })
        ));
        // F71: a refused close used to be ignored and the division shown closed anyway. Mark only what closed,
        // and stop before publishing with the server's reason.
        openTargets.forEach((g, i) => { if (closed[i].ok || isSandboxRefusal(closed[i])) onDivisionClosed(g.id); });
        const refused = closed.find(r => !r.ok && !isSandboxRefusal(r));
        if (refused) throw new Error(await readRefusal(refused, SCHEDULE_REFUSAL.divisionFallback));
      }

      const res = await fetch(`/api/admin/schedule-publish${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: tournament.id, divisionIds, visibility: 'published', notify }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to publish');
      const data = await res.json();
      setResult({ notified: data.notified ?? 0 });
      onPublished(divisionIds.map(id => ({ id, scheduleVisibility: 'published' as const })));
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
      setShowRegCloseWarning(false);
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (willCloseOnPublish) {
      setShowRegCloseWarning(true);
      return;
    }
    void doPublish();
  }

  const titleText = targets.length === 0 ? 'Publish Schedule'
    : targets.length === 1 ? `Publish ${targets[0].name}`
    : `Publish ${targets.length} Divisions`;

  return (
    <div className="modal-overlay" onClick={result ? onClose : undefined}>
      <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={16} style={kx({ color: 'var(--logic-lime)' }, KIT_INK.accent)} /> {titleText}
          </h3>
          <button className="btn btn-ghost btn-data" onClick={onClose}><X size={16} /></button>
        </div>

        <div>
          {result ? (
            <div style={{ textAlign: 'center', padding: '0.5rem 0 0.25rem' }}>
              <div style={kx({
                width: '44px', height: '44px', margin: '0 auto 0.75rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', fontSize: '1.5rem', fontWeight: 700,
                color: 'var(--success)',
                background: 'rgba(var(--success-rgb),0.12)',
                border: '1px solid rgba(var(--success-rgb),0.35)',
              }, {
                color: 'var(--success-light)',
                background: 'rgba(var(--success-rgb), 0.08)',
                border: '1px solid rgba(var(--success-rgb), 0.3)',
              })}>✓</div>
              <p style={kx({ fontWeight: 700, color: 'var(--logic-lime)', marginBottom: result.notified > 0 ? '0.35rem' : 0 }, KIT_INK.success)}>Schedule Published!</p>
              {result.notified > 0 && (
                <p style={kx({ fontSize: '0.85rem', color: 'var(--white-60)' }, KIT_INK.secondary)}>
                  Notified {result.notified} team{result.notified !== 1 ? 's' : ''} by email.
                </p>
              )}
              <button className="btn btn-primary btn-data" onClick={onClose} style={{ marginTop: '1.25rem', minWidth: '160px' }}>Done</button>
            </div>
          ) : showRegCloseWarning ? (
            /* ── Registration close confirmation screen ── */
            <div>
              <p style={kx({ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.65rem', color: 'var(--fl-text)' }, KIT_INK.primary)}>
                Close registration and publish?
              </p>
              <p style={kx({ fontSize: '0.85rem', color: 'var(--white-60)', lineHeight: 1.55, marginBottom: openTargets.length > 1 ? '0.75rem' : '1.25rem' }, KIT_INK.secondary)}>
                {openTargets.length === 1
                  ? `Registration for ${openTargets[0].name} is still open. Publishing will close it — stopping new submissions from the public page.`
                  : `Registration is still open for ${openTargets.length} divisions. Publishing will close them — stopping new submissions from the public page.`}
              </p>
              {openTargets.length > 1 && (
                <div style={kx(
                  { marginBottom: '1.25rem', background: 'var(--white-5)', border: '1px solid var(--white-8)', borderRadius: '2px', padding: '0.5rem 0.75rem' },
                  { background: 'var(--home-paper)', border: '1px solid var(--home-line)' },
                )}>
                  {openTargets.map(g => (
                    <div key={g.id} style={openTargetNameStyle}>{g.name}</div>
                  ))}
                </div>
              )}
              {error && (
                <div style={errorBannerStyle}>
                  {error}
                </div>
              )}
              <div className="modal-footer">
                <button className="btn btn-ghost btn-data" onClick={() => setShowRegCloseWarning(false)} disabled={loading}>Go Back</button>
                <button className="btn btn-primary btn-data" onClick={() => void doPublish()} disabled={loading}>
                  {loading ? 'Publishing…' : 'Close Registration & Publish'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Division selector — shown only when there are multiple unpublished divisions */}
              {publishable.length > 1 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <p style={kx({ fontSize: '0.8rem', fontWeight: 700, color: 'var(--white-50)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }, KIT_INK.eyebrow)}>
                      Divisions
                    </p>
                    {!allUnpublishedSelected && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-data"
                        style={{ fontSize: '0.65rem', padding: '2px 8px' }}
                        onClick={() => setSelectedIds(publishable.map(d => d.id))}
                      >
                        Select all unpublished
                      </button>
                    )}
                  </div>
                  <div style={kx(
                    { background: 'var(--white-5)', border: '1px solid var(--white-10)', borderRadius: '2px' },
                    { background: 'var(--home-paper)', border: '1px solid var(--home-line)' },
                  )}>
                    {divisions.map(g => {
                      const isLive = g.scheduleVisibility && g.scheduleVisibility !== 'unpublished';
                      const isChecked = selectedIds.includes(g.id);
                      return (
                        <label
                          key={g.id}
                          style={kx({
                            display: 'flex', alignItems: 'center', gap: '0.65rem',
                            padding: '0.5rem 0.75rem',
                            borderBottom: '1px solid var(--white-5)',
                            cursor: isLive ? 'default' : 'pointer',
                            opacity: isLive ? 0.5 : 1,
                          }, {
                            borderBottom: '1px solid var(--home-line)',
                          })}
                        >
                          <input
                            type="checkbox"
                            checked={isLive ? false : isChecked}
                            disabled={isLive}
                            onChange={() => !isLive && toggleDivision(g.id)}
                            style={{ flexShrink: 0 }}
                          />
                          <span style={divisionNameStyle}>{g.name}</span>
                          {isLive ? (
                            <span style={liveTagStyle}>LIVE</span>
                          ) : (
                            <span style={kx(
                              { fontSize: '0.73rem', color: g.isClosed ? 'var(--logic-lime)' : 'var(--white-30)' },
                              { color: g.isClosed ? 'var(--home-olive)' : 'var(--text-tertiary)' },
                            )}>
                              {g.isClosed ? 'Reg. closed' : 'Reg. open'}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <p style={kx({ color: 'var(--white-70)', fontSize: '0.88rem', marginBottom: willCloseOnPublish ? '0.85rem' : '1.25rem', lineHeight: 1.55 }, KIT_INK.secondary)}>
                {targets.length === 0
                  ? 'Select at least one division to publish.'
                  : targets.length === 1
                    ? 'This division\'s schedule will appear on your public tournament page with real team names. Saved edits are visible automatically after publishing.'
                    : `${targets.length} division${targets.length !== 1 ? 's' : ''} will appear on your public tournament page with real team names. Saved edits are visible automatically after publishing.`}
              </p>

              {willCloseOnPublish && (
                <div style={kx({
                  display: 'flex', alignItems: 'flex-start', gap: '0.55rem',
                  marginBottom: '1.25rem', padding: '0.6rem 0.75rem',
                  background: 'rgba(var(--logic-lime-rgb),0.06)',
                  border: '1px solid rgba(var(--logic-lime-rgb),0.25)', borderRadius: '2px',
                }, {
                  background: 'var(--home-olive-soft)',
                  border: '1px solid var(--home-olive)',
                })}>
                  <AlertCircle size={14} style={kx({ color: 'var(--logic-lime)', marginTop: '2px', flexShrink: 0 }, KIT_INK.accent)} />
                  <div style={kx({ fontSize: '0.8rem', color: 'var(--white-70)', lineHeight: 1.45 }, KIT_INK.secondary)}>
                    {openTargets.length === 1
                      ? `Registration for ${openTargets[0].name} is still open and will be closed when you publish.`
                      : `Registration is still open for ${openTargets.length} of the selected divisions and will be closed when you publish.`}
                  </div>
                </div>
              )}

              <div style={kx(
                { borderTop: '1px solid var(--white-8)', paddingTop: '1rem', marginBottom: '1rem' },
                { borderTop: '1px solid var(--home-line)' },
              )}>
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
                  cursor: canNotify ? 'pointer' : 'default',
                  opacity: canNotify ? 1 : 0.5,
                }}>
                  <input
                    type="checkbox"
                    checked={notify}
                    onChange={e => canNotify && setNotify(e.target.checked)}
                    disabled={!canNotify}
                    style={{ marginTop: '3px', flexShrink: 0 }}
                  />
                  <div>
                    <div style={kx({ fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }, KIT_INK.primary)}>
                      <Send size={12} /> Notify registered teams by email
                      {!canNotify && (
                        <span style={kx({
                          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
                          color: 'var(--blueprint-blue)', background: 'rgba(var(--blueprint-blue-rgb),0.12)',
                          border: '1px solid rgba(var(--blueprint-blue-rgb),0.25)',
                          padding: '1px 6px', borderRadius: '2px',
                        }, {
                          color: 'var(--info-light)', background: 'rgba(var(--info-rgb), 0.08)', border: '1px solid rgba(var(--info-rgb), 0.3)',
                        })}>Tournament Plus</span>
                      )}
                    </div>
                    <div style={kx({ fontSize: '0.78rem', color: 'var(--white-50)', marginTop: '0.2rem', lineHeight: 1.45 }, KIT_INK.tertiary)}>
                      {canNotify
                        ? 'Send a "schedule is live" email to all accepted team contacts.'
                        : 'Upgrade to Tournament Plus to send schedule notifications.'}
                    </div>
                  </div>
                </label>
              </div>

              {targets.length > 0 && willRemind && (
                <div style={kx({
                  display: 'flex', alignItems: 'flex-start', gap: '0.55rem',
                  marginBottom: '1rem', padding: '0.6rem 0.75rem',
                  background: 'var(--white-03)',
                  border: '1px solid var(--white-10)', borderRadius: '2px',
                }, {
                  background: 'var(--home-paper)', border: '1px solid var(--home-line)',
                })}>
                  <AlertCircle size={14} style={kx({ color: 'var(--white-40)', marginTop: '2px', flexShrink: 0 }, KIT_INK.tertiary)} />
                  <div style={kx({ fontSize: '0.78rem', color: 'var(--white-50)', lineHeight: 1.45 }, KIT_INK.tertiary)}>
                    {GAME_DAY_REMINDER_SENTENCE}
                  </div>
                </div>
              )}

              {error && (
                <div style={errorBannerStyle}>
                  {error}
                </div>
              )}

              <div className="modal-footer">
                <button className="btn btn-ghost btn-data" onClick={onClose} disabled={loading}>Cancel</button>
                <button className="btn btn-primary btn-data" onClick={handleConfirm} disabled={loading || targets.length === 0}>
                  {loading ? 'Publishing…' : `Publish${targets.length > 1 ? ` ${targets.length} Divisions` : ''}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
