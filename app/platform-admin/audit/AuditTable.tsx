'use client';
/**
 * The audit log's table, with each entry opening in a window (owner, 2026-10-25; drawings
 * `docs/projects/active/PLATFORM_AUDIT_ENTRY_WINDOW_MOCKUP.html`, every call ruled as recommended):
 *   · the whole row opens the entry — the › at its right edge is the cue and the keyboard's way in; the org name and its
 *     Filter link keep doing their own jobs without opening it;
 *   · the window reads first: who, when, which org, the old and new values in full with the lines that differ tinted;
 *   · "Same moment" lists the other entries this person made in the same second, one level deeper with a way back;
 *   · up to two doors in the foot, olive text (a control that goes somewhere is olive text — design decisions 2026-10-01);
 *     which doors comes from `lib/platform-audit-doors.ts`. No Revert, ever: the log is the record nobody edits.
 * The rows arrive ready to draw (dates formatted, doors decided, filter links built) so the server stays the one place
 * that knows the filters, the viewer's role and the clock.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { valueLines } from '@/lib/platform-audit-diff';
import type { AuditDoor } from '@/lib/platform-audit-doors';
import kit from '../console.module.css';
import styles from './audit.module.css';

export interface AuditRowView {
  id: string;
  actorEmail: string;
  orgId: string | null;
  orgName: string | null;
  action: string;
  actionLabel: string;
  field: string | null;
  oldValue: unknown;
  newValue: unknown;
  dateLabel: string;
  timeLabel: string;
  /** The entry's time to the second — entries by one person sharing it are "the same moment". */
  momentKey: string;
  /** The log narrowed to this org, keeping the page's other filters. */
  orgFilterHref: string | null;
  doors: AuditDoor[];
  scheduled: boolean;
}

/** Someone dragging to copy an email or a value ends the drag inside the row: that is not a request to open it. */
function selectingText(): boolean {
  return (window.getSelection()?.toString() ?? '').length > 0;
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '-';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 80)}...` : s;
}

function plainValue(v: unknown): string {
  if (v === null || v === undefined) return '-';
  return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
}

/** The entry as plain text, for pasting into a ticket or a message. */
function entryText(r: AuditRowView): string {
  return [
    `${r.actionLabel} (${r.action})`,
    `${r.dateLabel}, ${r.timeLabel}`,
    `Superuser: ${r.actorEmail}`,
    `Org: ${r.orgName ?? 'None'}`,
    `Field: ${r.field ?? '-'}`,
    `Old value: ${plainValue(r.oldValue)}`,
    `New value: ${plainValue(r.newValue)}`,
  ].join('\n');
}

export default function AuditTable({ rows }: { rows: AuditRowView[] }) {
  // The entries open, oldest first (a same-moment entry opens one level deeper). Kept with the list they came from: a new
  // list (a filter, the next page) shows none, so the window never outlives the rows it was about.
  const rowsKey = rows.map(r => r.id).join(',');
  const [open, setOpen] = useState<{ key: string; ids: string[] }>({ key: '', ids: [] });
  const ids = open.key === rowsKey ? open.ids : [];
  const byId = new Map(rows.map(r => [r.id, r] as const));
  const current = ids.length > 0 ? byId.get(ids[ids.length - 1]) ?? null : null;
  const previous = ids.length > 1 ? byId.get(ids[ids.length - 2]) ?? null : null;

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openEntry = (id: string) => setOpen({ key: rowsKey, ids: [id] });
  const stepInto = (id: string) => {
    const at = ids.indexOf(id);
    setOpen({ key: rowsKey, ids: at >= 0 ? ids.slice(0, at + 1) : [...ids, id] });
  };
  const close = () => setOpen({ key: rowsKey, ids: [] });

  async function copy(r: AuditRowView) {
    try {
      await navigator.clipboard.writeText(entryText(r));
    } catch {
      return; // Refused (an older browser, an insecure page): say nothing rather than claim a copy that did not happen.
    }
    setCopiedId(r.id);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopiedId(null), 1600);
  }

  const sameMoment = current
    ? rows.filter(r => r.id !== current.id && r.actorEmail === current.actorEmail && r.momentKey === current.momentKey)
    : [];
  const oldLines = current ? valueLines(current.oldValue, current.newValue) : [];
  const newLines = current ? valueLines(current.newValue, current.oldValue) : [];
  const anyChanged = oldLines.some(l => l.changed) || newLines.some(l => l.changed);

  return (
    <>
      <div className={`${kit.tableWrap} table-cards`}>
        <table className={`${kit.comfortable} ${styles.logTable}`}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Superuser</th>
              <th>Org</th>
              <th>Action</th>
              <th>Field</th>
              <th>Old value</th>
              <th>New value</th>
              <th aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className={kit.empty}>No audit entries found.</td>
              </tr>
            )}
            {rows.map(row => (
              <tr key={row.id} className={kit.clickableRow} onClick={() => { if (!selectingText()) openEntry(row.id); }}>
                <td className={`${kit.nowrap} table-cards-title ${styles.leadCell}`}>
                  {row.dateLabel}
                  <span className={kit.sub}>{row.timeLabel}</span>
                </td>
                <td data-label="Superuser">{row.actorEmail}</td>
                <td data-label="Org">
                  {row.orgId && row.orgName ? (
                    <span className={styles.orgCell}>
                      <Link href={`/platform-admin/orgs/${row.orgId}`} className={kit.nameLink} onClick={e => e.stopPropagation()}>
                        {row.orgName}
                      </Link>
                      {row.orgFilterHref && (
                        <Link href={row.orgFilterHref} className={`${kit.door} ${kit.doorSm}`} onClick={e => e.stopPropagation()}>
                          Filter
                        </Link>
                      )}
                    </span>
                  ) : (
                    <span className={kit.muted}>-</span>
                  )}
                </td>
                <td data-label="Action">{row.actionLabel}</td>
                <td data-label="Field" className={kit.muted}>{row.field ?? '-'}</td>
                <td data-label="Old value"><span className={styles.val}>{fmtValue(row.oldValue)}</span></td>
                <td data-label="New value"><span className={styles.val}>{fmtValue(row.newValue)}</span></td>
                <td className={`${kit.rowDoor} ${styles.openCell}`}>
                  <button
                    type="button"
                    className={styles.openBtn}
                    aria-label={`Open entry: ${row.actionLabel}, ${row.dateLabel} ${row.timeLabel}`}
                    onClick={e => { e.stopPropagation(); openEntry(row.id); }}
                  >
                    ›
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {current && (
        <KitDialog
          kind="form"
          size="medium"
          record
          eyebrow="Audit entry"
          title={current.actionLabel}
          identity={`${current.dateLabel} · ${current.timeLabel}`}
          levelKey={current.id}
          back={previous ? { label: previous.field ? `${previous.actionLabel} · ${previous.field}` : previous.actionLabel, onBack: () => setOpen({ key: rowsKey, ids: ids.slice(0, -1) }) } : undefined}
          onClose={close}
          footerStart={current.scheduled ? <span>This ran on a schedule, so there is nothing to open.</span> : undefined}
          footer={current.doors.length > 0 ? (
            <>
              {current.doors.map(d => (
                <Link key={d.href + d.label} href={d.href} className={styles.footDoor} onClick={close}>{d.label}</Link>
              ))}
            </>
          ) : undefined}
        >
          <div className={styles.entry}>
            <div className={styles.facts}>
              <div>
                <div className={kit.eye}>Superuser</div>
                <div className={styles.factValue}>{current.actorEmail}</div>
              </div>
              <div>
                <div className={kit.eye}>Org</div>
                <div className={styles.factValue}>{current.orgName ?? <span className={kit.muted}>None</span>}</div>
              </div>
              <div>
                <div className={kit.eye}>Field</div>
                <div className={`${styles.factValue} ${kit.code}`}>{current.field ?? '-'}</div>
              </div>
              <div>
                <div className={kit.eye}>Action key</div>
                <div className={`${styles.factValue} ${kit.code}`}>{current.action}</div>
              </div>
            </div>

            <div>
              <div className={styles.changeHead}>
                <strong>What changed</strong>
                <button type="button" className={styles.copyBtn} onClick={() => copy(current)} aria-live="polite">
                  {copiedId === current.id ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className={styles.panes}>
                <div className={styles.pane}>
                  <div className={`${kit.eye} ${styles.paneHead}`}>Old value</div>
                  <pre className={styles.paneBody}>
                    {oldLines.map((l, i) => <span key={i} className={l.changed ? styles.lineOld : undefined}>{l.text || ' '}</span>)}
                  </pre>
                </div>
                <div className={styles.pane}>
                  <div className={`${kit.eye} ${styles.paneHead}`}>New value</div>
                  <pre className={styles.paneBody}>
                    {newLines.map((l, i) => <span key={i} className={l.changed ? styles.lineNew : undefined}>{l.text || ' '}</span>)}
                  </pre>
                </div>
              </div>
              {anyChanged && <p className={`${kit.caption} ${styles.legend}`}>Tinted lines are the ones that differ.</p>}
            </div>

            {sameMoment.length > 0 && (
              <div className={styles.moment}>
                <div className={styles.momentHead}>
                  <strong>Same moment</strong>
                  <span>{sameMoment.length} other {sameMoment.length === 1 ? 'entry' : 'entries'} by this person at {current.timeLabel} in this list</span>
                </div>
                {sameMoment.map(r => (
                  <button key={r.id} type="button" className={styles.momentRow} onClick={() => stepInto(r.id)}>
                    <span>
                      {r.actionLabel}
                      {r.field && <span className={`${kit.code} ${styles.momentField}`}>{r.field}</span>}
                    </span>
                    <span aria-hidden className={styles.momentGo}>›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </KitDialog>
      )}
    </>
  );
}
